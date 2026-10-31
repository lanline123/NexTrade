//! 图像搜索管理端（v5.8.61 `/adminapi/setting/imageSearch`）。
//!
//! 配置存 `config` 表 `imageSearch*` 键；任务存 `image_search_sync_job`。
//! 阿里云图库写入/检索适配器尚未接入，构建设置为 PENDING 台账任务。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError};
use base64::Engine as _;
use hmac::{Hmac, Mac};
use reqwest::multipart::{Form, Part};
use sha1::Sha1;

use crate::AdminState;

const CONFIG_KEYS: [&str; 17] = [
    "imageSearchEnabled", "imageSearchH5Enabled", "imageSearchPcEnabled",
    "imageSearchAppEnabled", "imageSearchShopEnabled", "imageSearchProvider",
    "imageSearchIndexName", "imageSearchSimilarityPercent", "imageSearchMaxResults",
    "imageSearchAliyunRegionId", "imageSearchAliyunAccessKeyId", "imageSearchAliyunAccessKeySecret",
    "imageSearchAliyunSecurityToken", "imageSearchAliyunVpc",
    "imageSearchAliyunConnectTimeoutMillis", "imageSearchAliyunReadTimeoutMillis",
    "imageSearchVersion",
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/imageSearch/regions", get(regions))
        .route("/setting/imageSearch/detail", get(detail))
        .route("/setting/imageSearch/save", post(save))
        .route("/setting/imageSearch/check", post(check))
        .route("/setting/imageSearch/build", post(build))
        .route("/setting/imageSearch/syncProduct", post(sync_product))
        .route("/setting/imageSearch/task", get(task))
        .route("/setting/imageSearch/retry", post(retry))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/api/setting/imageSearch/regions", "ImageSearchAdminController.regions"),
        ("GET", "/api/setting/imageSearch/detail", "ImageSearchAdminController.detail"),
        ("POST", "/api/setting/imageSearch/save", "ImageSearchAdminController.save"),
        ("POST", "/api/setting/imageSearch/check", "ImageSearchAdminController.check"),
        ("POST", "/api/setting/imageSearch/build", "ImageSearchAdminController.build"),
        ("POST", "/api/setting/imageSearch/syncProduct", "ImageSearchAdminController.syncProduct"),
        ("GET", "/api/setting/imageSearch/task", "ImageSearchAdminController.task"),
        ("POST", "/api/setting/imageSearch/retry", "ImageSearchAdminController.retry"),
    ]
    .iter()
    .map(|(m, p, h)| tigshop_openapi::RouteDoc::new(m, p, h))
    .collect()
}

async fn load_config(state: &AdminState) -> Result<Vec<(String, String)>, Error> {
    state
        .system
        .config_basic
        .repo()
        .find_by_codes(&CONFIG_KEYS)
        .await
}

fn cfg_get<'a>(rows: &'a [(String, String)], key: &str) -> &'a str {
    rows.iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.as_str())
        .unwrap_or("")
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegionsQuery {
    provider: Option<String>,
}

async fn regions(Query(q): Query<RegionsQuery>) -> ApiResult<Value> {
    if q.provider.as_deref().unwrap_or("aliyun") != "aliyun" {
        return Err(tigshop_security::web::AppError(Error::biz(400, "图搜厂商尚未接入")));
    }
    ok(json!([
        {"regionId":"cn-shanghai","regionName":"华东2（上海）"},
        {"regionId":"cn-beijing","regionName":"华北2（北京）"},
        {"regionId":"cn-hangzhou","regionName":"华东1（杭州）"},
        {"regionId":"cn-shenzhen","regionName":"华南1（深圳）"}
    ]))
}

async fn detail(State(state): State<AdminState>) -> ApiResult<Value> {
    let rows = load_config(&state).await?;
    let job = sqlx::query(
        "SELECT * FROM image_search_sync_job ORDER BY id DESC LIMIT 1",
    )
    .fetch_optional(&state.repos.pool)
    .await
    .map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    let build_job = job.map(|r| job_json(&r)).unwrap_or(Value::Null);
    let number = |v: &str| v.parse::<i64>().unwrap_or(0);
    ok(json!({
        "version": number(cfg_get(&rows, "imageSearchVersion")),
        "settings": {
            "enabled": cfg_get(&rows, "imageSearchEnabled") == "1",
            "h5Enabled": cfg_get(&rows, "imageSearchH5Enabled") == "1",
            "pcEnabled": cfg_get(&rows, "imageSearchPcEnabled") == "1",
            "appEnabled": cfg_get(&rows, "imageSearchAppEnabled") == "1",
            "shopEnabled": cfg_get(&rows, "imageSearchShopEnabled") == "1",
            "provider": cfg_get(&rows, "imageSearchProvider"),
            "indexName": cfg_get(&rows, "imageSearchIndexName"),
            "similarityPercent": number(cfg_get(&rows, "imageSearchSimilarityPercent")),
            "maxResults": number(cfg_get(&rows, "imageSearchMaxResults")),
            "aliyun": {
                "regionId": cfg_get(&rows, "imageSearchAliyunRegionId"),
                "accessKeyId": mask(cfg_get(&rows, "imageSearchAliyunAccessKeyId")),
                "accessKeySecret": mask(cfg_get(&rows, "imageSearchAliyunAccessKeySecret")),
                "securityToken": mask(cfg_get(&rows, "imageSearchAliyunSecurityToken")),
                "vpc": cfg_get(&rows, "imageSearchAliyunVpc") == "1",
                "connectTimeoutMillis": number(cfg_get(&rows, "imageSearchAliyunConnectTimeoutMillis")),
                "readTimeoutMillis": number(cfg_get(&rows, "imageSearchAliyunReadTimeoutMillis"))
            }
        },
        "buildJob": build_job
    }))
}

fn mask(value: &str) -> String {
    if value.is_empty() {
        String::new()
    } else if value.len() <= 4 {
        "****".to_string()
    } else {
        format!("****{}", &value[value.len() - 4..])
    }
}

async fn save(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let old_version = load_config(&state)
        .await?
        .iter()
        .find(|(k, _)| k == "imageSearchVersion")
        .and_then(|(_, v)| v.parse::<i64>().ok())
        .unwrap_or(0);
    let version = body.get("version").and_then(Value::as_i64).unwrap_or(-1);
    if version != old_version {
        return Err(tigshop_security::web::AppError(Error::biz(400, "配置已被修改，请刷新后重试")));
    }
    let settings = body.get("settings").cloned().unwrap_or(Value::Null);
    let map = [
        ("imageSearchEnabled", "enabled"),
        ("imageSearchH5Enabled", "h5Enabled"),
        ("imageSearchPcEnabled", "pcEnabled"),
        ("imageSearchAppEnabled", "appEnabled"),
        ("imageSearchShopEnabled", "shopEnabled"),
        ("imageSearchProvider", "provider"),
        ("imageSearchIndexName", "indexName"),
        ("imageSearchSimilarityPercent", "similarityPercent"),
        ("imageSearchMaxResults", "maxResults"),
    ];
    for (code, field) in map {
        if let Some(v) = settings.get(field) {
            let value = if let Some(b) = v.as_bool() {
                if b { "1" } else { "0" }.to_string()
            } else {
                v.to_string().trim_matches('"').to_string()
            };
            state.system.config_basic.repo().save_code(code, &value).await?;
        }
    }
    if let Some(aliyun) = settings.get("aliyun") {
        let keys = [
            ("imageSearchAliyunRegionId", "regionId"),
            ("imageSearchAliyunAccessKeyId", "accessKeyId"),
            ("imageSearchAliyunAccessKeySecret", "accessKeySecret"),
            ("imageSearchAliyunSecurityToken", "securityToken"),
            ("imageSearchAliyunVpc", "vpc"),
            ("imageSearchAliyunConnectTimeoutMillis", "connectTimeoutMillis"),
            ("imageSearchAliyunReadTimeoutMillis", "readTimeoutMillis"),
        ];
        for (code, field) in keys {
            if let Some(v) = aliyun.get(field) {
                let value = if let Some(b) = v.as_bool() {
                    if b { "1" } else { "0" }.to_string()
                } else {
                    v.to_string().trim_matches('"').to_string()
                };
                state.system.config_basic.repo().save_code(code, &value).await?;
            }
        }
    }
    state
        .system
        .config_basic
        .repo()
        .save_code("imageSearchVersion", &(old_version + 1).to_string())
        .await?;
    ok(())
}

async fn check(State(state): State<AdminState>) -> ApiResult<Value> {
    let rows = load_config(&state).await?;
    let key = cfg_get(&rows, "imageSearchAliyunAccessKeyId");
    let secret = cfg_get(&rows, "imageSearchAliyunAccessKeySecret");
    let region = cfg_get(&rows, "imageSearchAliyunRegionId");
    let index = cfg_get(&rows, "imageSearchIndexName");
    let configured = !key.is_empty() && !secret.is_empty() && !region.is_empty() && !index.is_empty();
    if !configured {
        return ok(json!({"reachable": false, "requestId": Value::Null, "configured": false}));
    }
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(20)).build()
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    let params = vec![
        ("Action".to_string(), "Detail".to_string()),
        ("InstanceName".to_string(), index.to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let body = sign_version("POST", key, secret, region, "2020-12-14", &params);
    let resp = client.post(format!("https://imagesearch.{region}.aliyuncs.com/"))
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body).send().await;
    match resp {
        Ok(r) => {
            let status = r.status();
            let v: Value = r.json().await.unwrap_or(Value::Null);
            let request_id = v.get("RequestId").cloned().unwrap_or(Value::Null);
            let reachable = status.is_success() && v.get("Success").and_then(Value::as_bool) != Some(false);
            ok(json!({"reachable": reachable, "requestId": request_id, "configured": true}))
        }
        Err(e) => ok(json!({"reachable": false, "requestId": Value::Null, "configured": true, "message": e.to_string()})),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuildQuery {
    product_id: Option<i32>,
}

async fn build(State(state): State<AdminState>) -> ApiResult<Value> {
    let rows = load_config(&state).await?;
    validate_sync_config(&rows)?;
    let job_key = format!("{}:build", cfg_get(&rows, "imageSearchIndexName"));
    let id = insert_job(&state, &job_key, 0, &rows).await?;
    spawn_build(state, id, 0);
    ok(json!({"taskId": id, "state": "PENDING"}))
}

async fn sync_product(
    State(state): State<AdminState>,
    Query(q): Query<BuildQuery>,
) -> ApiResult<Value> {
    let product_id = q.product_id.unwrap_or(0);
    if product_id <= 0 {
        return Err(AppError(Error::Validation("productId 必须为正整数".into())));
    }
    let rows = load_config(&state).await?;
    validate_sync_config(&rows)?;
    let job_key = format!("{}:product:{}", cfg_get(&rows, "imageSearchIndexName"), product_id);
    let id = insert_job(&state, &job_key, product_id, &rows).await?;
    spawn_build(state, id, product_id);
    ok(json!({"taskId": id, "state": "PENDING"}))
}

fn validate_sync_config(rows: &[(String, String)]) -> Result<(), AppError> {
    if cfg_get(rows, "imageSearchEnabled") != "1" {
        return Err(AppError(Error::biz(400, "图搜未启用")));
    }
    for key in [
        "imageSearchIndexName",
        "imageSearchAliyunRegionId",
        "imageSearchAliyunAccessKeyId",
        "imageSearchAliyunAccessKeySecret",
    ] {
        if cfg_get(rows, key).trim().is_empty() {
            return Err(AppError(Error::biz(400, "图搜配置不完整")));
        }
    }
    Ok(())
}

fn spawn_build(state: AdminState, job_id: i64, product_id: i32) {
    tokio::spawn(async move {
        if let Err(e) = run_build(state.clone(), job_id, product_id).await {
            mark_job_failed(&state, job_id, &e).await;
        }
    });
}

/// 商品变更后入队增量同步（Java ProductEsSyncEvent 等价入口）。
pub(crate) async fn enqueue_product_sync(state: &AdminState, product_id: i32) {
    if product_id <= 0 {
        return;
    }
    let Ok(rows) = load_config(state).await else { return; };
    if cfg_get(&rows, "imageSearchEnabled") != "1" {
        return;
    }
    if cfg_get(&rows, "imageSearchIndexName").is_empty()
        || cfg_get(&rows, "imageSearchAliyunAccessKeyId").is_empty()
        || cfg_get(&rows, "imageSearchAliyunAccessKeySecret").is_empty()
    {
        return;
    }
    let job_key = format!("{}:product:{}", cfg_get(&rows, "imageSearchIndexName"), product_id);
    if let Ok(id) = insert_job(state, &job_key, product_id, &rows).await {
        spawn_build(state.clone(), id, product_id);
    }
}

async fn insert_job(
    state: &AdminState,
    job_key: &str,
    product_id: i32,
    rows: &[(String, String)],
) -> Result<i64, Error> {
    let now = tigshop_common::utils::now_seconds() as i64;
    let index = cfg_get(rows, "imageSearchIndexName");
    let target = format!("aliyun:{index}");
    let kind = if product_id > 0 { "PRODUCT" } else { "FULL" };
    let r = sqlx::query(
        "INSERT INTO image_search_sync_job(job_key,target_key,provider,index_name,kind,product_id,version,state,cursor_id,max_product_id,scanned,added,skipped,deleted,attempts,next_run_at,last_error,created_at,updated_at) \
         VALUES(?, ?, 'aliyun', ?, ?, ?, 1, 'PENDING', 0, 0, 0, 0, 0, 0, 0, 0, '', ?, ?) \
         ON DUPLICATE KEY UPDATE version=version+1, state='PENDING', target_key=VALUES(target_key), index_name=VALUES(index_name), kind=VALUES(kind), product_id=VALUES(product_id), updated_at=VALUES(updated_at)",
    )
    .bind(job_key)
    .bind(target)
    .bind(index)
    .bind(kind)
    .bind(product_id)
    .bind(now)
    .bind(now)
    .execute(&state.repos.pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    Ok(r.last_insert_id() as i64)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TaskQuery {
    task_id: Option<i64>,
}

async fn task(State(state): State<AdminState>, Query(q): Query<TaskQuery>) -> ApiResult<Value> {
    let task_id = q.task_id.unwrap_or(0);
    let row = sqlx::query("SELECT * FROM image_search_sync_job WHERE id = ? LIMIT 1")
        .bind(task_id)
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    ok(row.map(|r| job_json(&r)).unwrap_or(Value::Null))
}

async fn retry(
    State(state): State<AdminState>,
    Query(q): Query<TaskQuery>,
) -> ApiResult<()> {
    let task_id = q.task_id.unwrap_or(0);
    sqlx::query("UPDATE image_search_sync_job SET state='PENDING', attempts=attempts+1, last_error='', updated_at=? WHERE id=?")
        .bind(tigshop_common::utils::now_seconds() as i64)
        .bind(task_id)
        .execute(&state.repos.pool)
        .await
        .map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    let row = sqlx::query("SELECT product_id FROM image_search_sync_job WHERE id=? LIMIT 1")
        .bind(task_id)
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    let product_id = row.and_then(|r| r.try_get::<i32, _>("product_id").ok()).unwrap_or(0);
    spawn_build(state, task_id, product_id);
    ok(())
}

fn job_json(row: &sqlx::mysql::MySqlRow) -> Value {
    json!({
        "taskId": row.try_get::<i64, _>("id").unwrap_or(0),
        "state": row.try_get::<String, _>("state").unwrap_or_default(),
        "scanned": row.try_get::<i64, _>("scanned").unwrap_or(0),
        "added": row.try_get::<i64, _>("added").unwrap_or(0),
        "skipped": row.try_get::<i64, _>("skipped").unwrap_or(0),
        "deleted": row.try_get::<i64, _>("deleted").unwrap_or(0),
        "lastError": row.try_get::<String, _>("last_error").unwrap_or_default()
    })
}

// ————————————————————— 阿里云图库构建 worker —————————————————————

type HmacSha1 = Hmac<Sha1>;

async fn run_build(state: AdminState, job_id: i64, product_id: i32) -> Result<(), String> {
    let rows = load_config(&state).await.map_err(|e| e.to_string())?;
    let key = cfg_get(&rows, "imageSearchAliyunAccessKeyId").to_string();
    let secret = cfg_get(&rows, "imageSearchAliyunAccessKeySecret").to_string();
    let region = cfg_get(&rows, "imageSearchAliyunRegionId").to_string();
    let index = cfg_get(&rows, "imageSearchIndexName").to_string();
    if key.is_empty() || secret.is_empty() || region.is_empty() || index.is_empty() {
        return Err("图搜配置不完整".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(40))
        .build()
        .map_err(|e| e.to_string())?;
    set_job_state(&state, job_id, "RUNNING", 0).await;
    sqlx::query("UPDATE image_search_sync_job SET last_error='', updated_at=? WHERE id=?")
        .bind(tigshop_common::utils::now_seconds() as i64)
        .bind(job_id)
        .execute(&state.repos.pool)
        .await
        .ok();
    let sql = if product_id > 0 {
        "SELECT product_id,product_status,is_delete,pic_url,pic_original,pic_large,pic_thumb FROM product WHERE product_id=? LIMIT 1"
    } else {
        "SELECT product_id,product_status,is_delete,pic_url,pic_original,pic_large,pic_thumb FROM product WHERE is_delete=0 AND product_status=1 ORDER BY product_id"
    };
    let mut q = sqlx::query(sql);
    if product_id > 0 {
        q = q.bind(product_id);
    }
    let products = q.fetch_all(&state.repos.pool).await.map_err(|e| e.to_string())?;
    let mut scanned = 0i64;
    let mut added = 0i64;
    let mut skipped = 0i64;
    for product in products {
        let pid: i32 = product.try_get("product_id").unwrap_or(0);
        let active = product.try_get::<i32, _>("is_delete").unwrap_or(1) == 0
            && product.try_get::<i32, _>("product_status").unwrap_or(0) == 1;
        if product_id > 0 && !active {
            let pic_name = format!("product-{pid}.jpg");
            let _ = delete_image(&client, &region, &key, &secret, &index, pid, &pic_name).await;
            scanned += 1;
            continue;
        }
        let url = ["pic_url", "pic_original", "pic_large", "pic_thumb"]
            .iter()
            .find_map(|c| product.try_get::<Option<String>, _>(*c).ok().flatten())
            .filter(|u| !u.trim().is_empty());
        scanned += 1;
        if let Some(url) = url {
            let pic_name = format!("product-{pid}.jpg");
            if check_exists(&client, &region, &key, &secret, &index, pid, &pic_name).await.unwrap_or(false) {
                skipped += 1;
            } else {
                match download_upload_add(&client, &region, &key, &secret, &index, pid, &pic_name, &url).await {
                    Ok(()) => added += 1,
                    Err(e) => {
                        skipped += 1;
                        let short = e.chars().take(120).collect::<String>();
                        sqlx::query("UPDATE image_search_sync_job SET last_error=?, updated_at=? WHERE id=?")
                            .bind(&short).bind(tigshop_common::utils::now_seconds() as i64).bind(job_id)
                            .execute(&state.repos.pool).await.ok();
                        tracing::warn!(product_id = pid, error = %short, "图搜单商品同步失败");
                    }
                }
            }
        } else {
            skipped += 1;
        }
        sqlx::query("UPDATE image_search_sync_job SET scanned=?, added=?, skipped=?, cursor_id=?, updated_at=? WHERE id=?")
            .bind(scanned).bind(added).bind(skipped).bind(pid)
            .bind(tigshop_common::utils::now_seconds() as i64).bind(job_id)
            .execute(&state.repos.pool).await.ok();
    }
    sqlx::query("UPDATE image_search_sync_job SET state='COMPLETED', scanned=?, added=?, skipped=?, updated_at=? WHERE id=?")
        .bind(scanned).bind(added).bind(skipped)
        .bind(tigshop_common::utils::now_seconds() as i64).bind(job_id)
        .execute(&state.repos.pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn set_job_state(state: &AdminState, job_id: i64, state_name: &str, attempts: i32) {
    sqlx::query("UPDATE image_search_sync_job SET state=?, attempts=?, updated_at=? WHERE id=?")
        .bind(state_name).bind(attempts).bind(tigshop_common::utils::now_seconds() as i64).bind(job_id)
        .execute(&state.repos.pool).await.ok();
}

async fn mark_job_failed(state: &AdminState, job_id: i64, error: &str) {
    let short = error.chars().take(120).collect::<String>();
    sqlx::query("UPDATE image_search_sync_job SET state='FAILED', last_error=?, updated_at=? WHERE id=?")
        .bind(short).bind(tigshop_common::utils::now_seconds() as i64).bind(job_id)
        .execute(&state.repos.pool).await.ok();
}

async fn download_upload_add(
    client: &reqwest::Client,
    region: &str,
    key: &str,
    secret: &str,
    index: &str,
    product_id: i32,
    pic_name: &str,
    url: &str,
) -> Result<(), String> {
    let bytes = client.get(url).send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    if bytes.is_empty() || bytes.len() > 6 * 1024 * 1024 {
        return Err("图片为空或超过6MB".into());
    }
    let pic_url = upload_transfer(client, region, key, secret, &bytes).await?;
    let params = vec![
        ("Action".to_string(), "AddImage".to_string()),
        ("InstanceName".to_string(), index.to_string()),
        ("PicContent".to_string(), pic_url),
        ("PicName".to_string(), pic_name.to_string()),
        ("ProductId".to_string(), product_id.to_string()),
        ("CustomContent".to_string(), product_id.to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let body = sign_version("POST", key, secret, region, "2020-12-14", &params);
    let resp = client.post(format!("https://imagesearch.{region}.aliyuncs.com/"))
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body).send().await.map_err(|e| e.to_string())?;
    let text = resp.text().await.unwrap_or_default();
    let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    if v.get("Success").and_then(Value::as_bool) == Some(false) || v.get("Code").and_then(Value::as_i64).unwrap_or(1) != 0 {
        return Err(v.get("Message").and_then(Value::as_str).unwrap_or("AddImage 失败").to_string());
    }
    Ok(())
}

async fn delete_image(
    client: &reqwest::Client,
    region: &str,
    key: &str,
    secret: &str,
    index: &str,
    product_id: i32,
    pic_name: &str,
) -> Result<(), String> {
    let params = vec![
        ("Action".to_string(), "DeleteImage".to_string()),
        ("InstanceName".to_string(), index.to_string()),
        ("PicName".to_string(), pic_name.to_string()),
        ("ProductId".to_string(), product_id.to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let body = sign_version("POST", key, secret, region, "2020-12-14", &params);
    let resp = client.post(format!("https://imagesearch.{region}.aliyuncs.com/"))
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body).send().await.map_err(|e| e.to_string())?;
    let v: Value = resp.json().await.unwrap_or(Value::Null);
    if v.get("Success").and_then(Value::as_bool) == Some(false) {
        return Err(v.get("Message").and_then(Value::as_str).unwrap_or("DeleteImage 失败").to_string());
    }
    Ok(())
}

async fn check_exists(
    client: &reqwest::Client,
    region: &str,
    key: &str,
    secret: &str,
    index: &str,
    product_id: i32,
    pic_name: &str,
) -> Result<bool, String> {
    let params = vec![
        ("Action".to_string(), "CheckImageExists".to_string()),
        ("InstanceName".to_string(), index.to_string()),
        ("PicName".to_string(), pic_name.to_string()),
        ("ProductId".to_string(), product_id.to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let body = sign_version("POST", key, secret, region, "2020-12-14", &params);
    let resp = client.post(format!("https://imagesearch.{region}.aliyuncs.com/"))
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body).send().await.map_err(|e| e.to_string())?;
    let v: Value = resp.json().await.unwrap_or(Value::Null);
    Ok(v.get("Exists").and_then(Value::as_bool).unwrap_or(false))
}

async fn upload_transfer(
    client: &reqwest::Client,
    region: &str,
    key: &str,
    secret: &str,
    bytes: &[u8],
) -> Result<String, String> {
    let params = vec![
        ("Action".to_string(), "AuthorizeFileUpload".to_string()),
        ("Product".to_string(), "ImageSearch".to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let query = sign_version("GET", key, secret, region, "2019-12-19", &params);
    let response = client.get(format!("https://openplatform.aliyuncs.com/?{query}"))
        .send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    let auth: Value = serde_json::from_str(&text)
        .map_err(|e| format!("OSS 授权响应解析失败: {e} / {text}"))?;
    if !status.is_success() {
        return Err(format!("获取 OSS 上传授权失败: HTTP {status} {text}"));
    }
    let s = |k: &str| auth.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let bucket = s("Bucket");
    let endpoint = s("Endpoint");
    let object_key = s("ObjectKey");
    if bucket.is_empty() || endpoint.is_empty() || object_key.is_empty() {
        return Err(format!("获取 OSS 上传授权失败: {text}"));
    }
    let part = Part::bytes(bytes.to_vec()).file_name(object_key.clone()).mime_str("application/octet-stream")
        .map_err(|e| e.to_string())?;
    let form = Form::new()
        .text("OSSAccessKeyId", s("AccessKeyId"))
        .text("policy", s("EncodedPolicy"))
        .text("Signature", s("Signature"))
        .text("key", object_key.clone())
        .text("success_action_status", "201")
        .part("file", part);
    let resp = client.post(format!("https://{bucket}.{endpoint}/")).multipart(form).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("OSS 上传失败：{}", resp.status()));
    }
    Ok(format!("https://{bucket}.{endpoint}/{object_key}"))
}

fn sign_version(method: &str, key_id: &str, secret: &str, region: &str, version: &str, params: &[(String, String)]) -> String {
    let mut all = params.to_vec();
    all.push(("AccessKeyId".into(), key_id.into()));
    all.push(("Format".into(), "JSON".into()));
    all.push(("RegionId".into(), region.into()));
    all.push(("SignatureMethod".into(), "HMAC-SHA1".into()));
    all.push(("SignatureVersion".into(), "1.0".into()));
    all.push(("Version".into(), version.into()));
    all.sort_by(|a, b| a.0.cmp(&b.0));
    let canonical = all.iter().map(|(k, v)| format!("{}={}", pe(k), pe(v))).collect::<Vec<_>>().join("&");
    let string_to_sign = format!("{}&%2F&{}", method, pe(&canonical));
    let mut mac = HmacSha1::new_from_slice(format!("{secret}&").as_bytes()).expect("HMAC");
    mac.update(string_to_sign.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    format!("{canonical}&Signature={}", pe(&signature))
}

fn pe(input: &str) -> String {
    let mut out = String::new();
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
