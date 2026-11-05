//! AI 图片与地图设置（v5.8.61 `/adminapi/file/aiImage/*`、`/setting/config/*`）。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

const CONFIG_KEYS: [&str; 13] = [
    "aiImageEnabled",
    "aiImageProvider",
    "aiImageApiKey",
    "aiImageSecret",
    "aiImageModel",
    "aiImageTranslateSource",
    "amapWebKey",
    "amapWebSecret",
    "mapProvider",
    "aiImageTranslateEnabled",
    "aiImageAuthorization",
    "aiImageProjectId",
    "aiImageTranslateProductText",
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/file/aiImage/getTranslateConfig",
            get(get_translate_config),
        )
        .route("/file/aiImage/translate", post(translate))
        .route("/file/aiImage/inpaint", post(inpaint))
        .route("/file/aiImage/localesList", post(locales_list))
        .route("/setting/config/aiImageSettings", get(ai_image_settings))
        .route("/setting/config/saveAiImage", post(save_ai_image))
        .route("/setting/config/amapSettings", get(amap_settings))
        .route("/setting/config/saveAmapSettings", post(save_amap))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/api/file/aiImage/getTranslateConfig"),
        ("POST", "/api/file/aiImage/translate"),
        ("POST", "/api/file/aiImage/inpaint"),
        ("POST", "/api/file/aiImage/localesList"),
        ("GET", "/api/setting/config/aiImageSettings"),
        ("POST", "/api/setting/config/saveAiImage"),
        ("GET", "/api/setting/config/amapSettings"),
        ("POST", "/api/setting/config/saveAmapSettings"),
    ]
    .iter()
    .map(|(m, p)| tigshop_openapi::RouteDoc::new(m, p, "AiImageController/ConfigController"))
    .collect()
}

async fn load(state: &AdminState) -> Result<Value, AppError> {
    let rows = state
        .system
        .config_basic
        .repo()
        .find_by_codes(&CONFIG_KEYS)
        .await
        .map_err(|e| AppError(e))?;
    let get = |key: &str| {
        rows.iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
            .unwrap_or_default()
    };
    Ok(json!({
        "enabled": get("aiImageEnabled") == "1",
        "provider": get("aiImageProvider"),
        "apiKey": mask(&get("aiImageApiKey")),
        "secret": mask(&get("aiImageSecret")),
        "model": get("aiImageModel"),
        "translateEnabled": get("aiImageTranslateEnabled") == "1",
        "authorization": mask(&get("aiImageAuthorization")),
        "projectId": get("aiImageProjectId"),
        "translateProductText": get("aiImageTranslateProductText") == "1",
        "mapProvider": get("mapProvider"),
        "amapWebKey": mask(&get("amapWebKey")),
        "amapWebSecret": mask(&get("amapWebSecret"))
    }))
}

fn mask(v: &str) -> String {
    if v.is_empty() {
        String::new()
    } else if v.len() <= 4 {
        "****".into()
    } else {
        format!("****{}", &v[v.len() - 4..])
    }
}

async fn get_translate_config(State(state): State<AdminState>) -> ApiResult<Value> {
    let rows = sqlx::query(
        "SELECT lang_code,lang_name FROM ai_translate_language WHERE is_source=1 ORDER BY sort,id",
    )
    .fetch_all(&state.repos.pool)
    .await
    .map_err(|e| AppError(Error::Database(e.to_string())))?;
    use sqlx::Row;
    let list: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "language": r.try_get::<String,_>("lang_code").unwrap_or_default(),
                "languageName": r.try_get::<String,_>("lang_name").unwrap_or_default()
            })
        })
        .collect();
    ok(json!({"sourceLanguageList": list}))
}
async fn ai_image_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(load(&state).await?)
}
async fn amap_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(load(&state).await?)
}

async fn save_ai_image(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let pairs = [
        ("aiImageEnabled", "enabled"),
        ("aiImageProvider", "provider"),
        ("aiImageApiKey", "apiKey"),
        ("aiImageSecret", "secret"),
        ("aiImageModel", "model"),
        ("aiImageTranslateEnabled", "translateEnabled"),
        ("aiImageAuthorization", "authorization"),
        ("aiImageProjectId", "projectId"),
        ("aiImageTranslateProductText", "translateProductText"),
    ];
    for (code, field) in pairs {
        if let Some(v) = body.get(field) {
            let value = if let Some(b) = v.as_bool() {
                if b { "1" } else { "0" }.to_string()
            } else {
                v.to_string().trim_matches('"').to_string()
            };
            state
                .system
                .config_basic
                .repo()
                .save_code(code, &value)
                .await?;
        }
    }
    ok(())
}

async fn save_amap(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    for (code, field) in [
        ("amapWebKey", "amapWebKey"),
        ("amapWebSecret", "amapWebSecret"),
        ("mapProvider", "mapProvider"),
    ] {
        if let Some(v) = body.get(field) {
            state
                .system
                .config_basic
                .repo()
                .save_code(code, v.as_str().unwrap_or(""))
                .await?;
        }
    }
    ok(())
}

async fn translate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<Value>,
) -> ApiResult<Value> {
    let rows = state
        .system
        .config_basic
        .repo()
        .find_by_codes(&CONFIG_KEYS)
        .await
        .map_err(AppError)?;
    let get = |key: &str| {
        rows.iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
            .unwrap_or_default()
    };
    if get("aiImageEnabled") != "1" {
        return Err(AppError(Error::biz(400, "AI图片处理功能未启用")));
    }
    let authorization = get("aiImageAuthorization");
    let project_id = get("aiImageProjectId");
    if authorization.is_empty() || project_id.is_empty() {
        return Err(AppError(Error::biz(
            400,
            "请先配置AI Authorization和Project ID",
        )));
    }
    let urls: Vec<String> = body
        .get("imgUrls")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    if urls.is_empty() {
        return Err(AppError(Error::biz(400, "图片列表不能为空")));
    }
    if urls.len() > 10 {
        return Err(AppError(Error::biz(400, "单次最多处理10张图片")));
    }
    let source = body
        .get("sourceLanguage")
        .and_then(Value::as_str)
        .unwrap_or("zh");
    let target = body
        .get("targetLanguage")
        .and_then(Value::as_str)
        .unwrap_or("en");
    let translate_product = body
        .get("isTranslateProductText")
        .and_then(Value::as_bool)
        .unwrap_or_else(|| get("aiImageTranslateProductText") == "1");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    let mut results = Vec::new();
    for url in urls {
        let id = uuid::Uuid::new_v4().simple().to_string();
        let req = json!({
            "request_id": id,
            "customer_id": "tigshop",
            "image": url,
            "lang_from": source,
            "lang_to": target,
            "engine": "2",
            "commodity_protection": !translate_product,
            "return_text": false
        });
        let resp = client
            .post("https://api.fengniaoai.com/api/v1/img/translate")
            .header("Authorization", &authorization)
            .header("fengniaoai-project", &project_id)
            .json(&req)
            .send()
            .await;
        let mut item = json!({"originalUrl": url, "translateImgId": id, "success": false});
        match resp {
            Ok(r) => {
                let v: Value = r.json().await.unwrap_or(Value::Null);
                if v.get("code").and_then(Value::as_i64) == Some(200) {
                    if let Some(temp) = v
                        .get("result")
                        .and_then(|r| r.get("translatedUrl"))
                        .and_then(Value::as_str)
                    {
                        match client.get(temp).send().await {
                            Ok(dl) if dl.status().is_success() => {
                                if let Ok(bytes) = dl.bytes().await {
                                    let size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
                                    match state
                                        .content
                                        .gallery_pic
                                        .upload_img(
                                            None,
                                            Some("image/jpeg"),
                                            size,
                                            Some("ai-translate.jpg"),
                                            &bytes,
                                            0,
                                            auth.id,
                                        )
                                        .await
                                    {
                                        Ok(vo) => {
                                            let url_out = serde_json::to_value(vo)
                                                .ok()
                                                .and_then(|v| {
                                                    v.get("url")
                                                        .and_then(Value::as_str)
                                                        .map(ToString::to_string)
                                                })
                                                .unwrap_or(temp.to_string());
                                            item["translatedUrl"] = Value::String(url_out);
                                            item["success"] = Value::Bool(true);
                                        }
                                        Err(e) => item["errorMsg"] = Value::String(e.to_string()),
                                    }
                                }
                            }
                            _ => item["errorMsg"] = Value::String("翻译结果下载失败".into()),
                        }
                    } else {
                        item["errorMsg"] = Value::String("蜂鸟翻译响应缺少结果图URL".into());
                    }
                } else {
                    let msg = v
                        .get("msg")
                        .and_then(Value::as_str)
                        .or_else(|| v.get("errmsg").and_then(Value::as_str))
                        .unwrap_or("蜂鸟AI调用失败");
                    item["errorMsg"] = Value::String(msg.to_string());
                }
            }
            Err(e) => item["errorMsg"] = Value::String(format!("蜂鸟AI请求异常: {e}")),
        }
        results.push(item);
    }
    ok(json!({"results": results}))
}

async fn inpaint(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<Value>,
) -> ApiResult<Value> {
    let rows = state
        .system
        .config_basic
        .repo()
        .find_by_codes(&CONFIG_KEYS)
        .await
        .map_err(AppError)?;
    let get = |key: &str| {
        rows.iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.clone())
            .unwrap_or_default()
    };
    if get("aiImageEnabled") != "1" {
        return Err(AppError(Error::biz(400, "AI图片处理功能未启用")));
    }
    let authorization = get("aiImageAuthorization");
    let project_id = get("aiImageProjectId");
    if authorization.is_empty() || project_id.is_empty() {
        return Err(AppError(Error::biz(
            400,
            "请先配置AI Authorization和Project ID",
        )));
    }
    let urls: Vec<String> = body
        .get("imgUrls")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default();
    if urls.is_empty() {
        return Err(AppError(Error::biz(400, "图片列表不能为空")));
    }
    if urls.len() > 10 {
        return Err(AppError(Error::biz(400, "单次最多处理10张图片")));
    }
    let options: Vec<String> = body
        .get("inpaintOptions")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_else(|| vec!["text".into()]);
    if options != vec!["text".to_string()] {
        return Err(AppError(Error::biz(
            400,
            "当前仅支持文字消除(inpaintOptions=[\"text\"])",
        )));
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(320))
        .build()
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    let mut results = Vec::new();
    for url in urls {
        let mut item = json!({"originalUrl": url, "success": false});
        match inpaint_one(&state, &auth, &client, &authorization, &project_id, &url).await {
            Ok(out) => {
                item["resultUrl"] = Value::String(out);
                item["success"] = Value::Bool(true);
            }
            Err(e) => item["errorMsg"] = Value::String(e),
        }
        results.push(item);
    }
    ok(json!({"results": results}))
}

async fn inpaint_one(
    state: &AdminState,
    auth: &AuthUser,
    client: &reqwest::Client,
    authorization: &str,
    project_id: &str,
    url: &str,
) -> Result<String, String> {
    let ocr = fengniao_post(
        client,
        authorization,
        project_id,
        "/api/v1/editor/ocr",
        json!({"image": url}),
    )
    .await?;
    let data = ocr.get("data").ok_or("蜂鸟任务创建响应缺少 data")?;
    let task_id = data
        .get("id")
        .or_else(|| data.get("taskid"))
        .and_then(Value::as_str)
        .ok_or("蜂鸟任务创建响应缺少任务ID")?;
    let task_key = data.get("key").and_then(Value::as_str).unwrap_or("2");
    let ocr_item = poll_task(client, authorization, project_id, task_key, task_id).await?;
    let texts = ocr_item
        .get("result")
        .and_then(|r| r.get("texts"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if texts.is_empty() {
        return Ok(url.to_string());
    }
    let origin = client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&origin).map_err(|e| format!("原图解析失败: {e}"))?;
    let (w, h) = (img.width(), img.height());
    let mut mask = image::RgbImage::new(w, h);
    for t in &texts {
        let x = t.get("x").and_then(Value::as_i64).unwrap_or(0).max(0) as u32;
        let y = t.get("y").and_then(Value::as_i64).unwrap_or(0).max(0) as u32;
        let rw = t.get("width").and_then(Value::as_i64).unwrap_or(0).max(0) as u32;
        let rh = t.get("height").and_then(Value::as_i64).unwrap_or(0).max(0) as u32;
        for py in y..(y + rh).min(h) {
            for px in x..(x + rw).min(w) {
                mask.put_pixel(px, py, image::Rgb([255, 255, 255]));
            }
        }
    }
    let mut mask_bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(mask)
        .write_to(&mut mask_bytes, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    let mask_bytes = mask_bytes.into_inner();
    let size = u64::try_from(mask_bytes.len()).unwrap_or(u64::MAX);
    let vo = state
        .content
        .gallery_pic
        .upload_img(
            None,
            Some("image/png"),
            size,
            Some("ai-mask.png"),
            &mask_bytes,
            0,
            auth.id,
        )
        .await
        .map_err(|e| e.to_string())?;
    let mask_url = serde_json::to_value(vo)
        .ok()
        .and_then(|v| {
            v.get("url")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .ok_or("遮罩图上传失败")?;
    let elim = fengniao_post(
        client,
        authorization,
        project_id,
        "/api/v1/editor/eliminate",
        json!({"originImage": url, "maskImage": mask_url}),
    )
    .await?;
    let data = elim.get("data").ok_or("蜂鸟消除任务创建响应缺少 data")?;
    let elim_id = data
        .get("id")
        .or_else(|| data.get("taskid"))
        .and_then(Value::as_str)
        .ok_or("蜂鸟消除任务创建响应缺少任务ID")?;
    let key = data.get("key").and_then(Value::as_str).unwrap_or("1");
    let item = poll_task(client, authorization, project_id, key, elim_id).await?;
    let result = item.get("result").cloned().unwrap_or(Value::Null);
    let temp = extract_result_url(&result).ok_or("蜂鸟消除响应缺少结果图URL")?;
    let bytes = client
        .get(&temp)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    let vo = state
        .content
        .gallery_pic
        .upload_img(
            None,
            Some("image/jpeg"),
            size,
            Some("ai-inpaint.jpg"),
            &bytes,
            0,
            auth.id,
        )
        .await
        .map_err(|e| e.to_string())?;
    serde_json::to_value(vo)
        .ok()
        .and_then(|v| {
            v.get("url")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .ok_or_else(|| "结果图转存失败".to_string())
}

async fn fengniao_post(
    client: &reqwest::Client,
    auth: &str,
    project: &str,
    path: &str,
    body: Value,
) -> Result<Value, String> {
    let resp = client
        .post(format!("https://api.fengniaoai.com{path}"))
        .header("Authorization", auth)
        .header("fengniaoai-project", project)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status();
    let v: Value = resp.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || v.get("code").and_then(Value::as_i64) != Some(200) {
        let msg = v
            .get("msg")
            .and_then(Value::as_str)
            .or_else(|| v.get("errmsg").and_then(Value::as_str))
            .unwrap_or("蜂鸟AI调用失败");
        return Err(msg.to_string());
    }
    Ok(v)
}

async fn poll_task(
    client: &reqwest::Client,
    auth: &str,
    project: &str,
    key: &str,
    id: &str,
) -> Result<Value, String> {
    let mut interval = 800u64;
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(280);
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(interval)).await;
        if tokio::time::Instant::now() > deadline {
            return Err("蜂鸟任务轮询超时(280s)".into());
        }
        let v = fengniao_post(
            client,
            auth,
            project,
            "/api/v1/editor/task/info",
            json!({"ids":[{"key":key,"value":id}]}),
        )
        .await?;
        let arr = v
            .get("data")
            .and_then(Value::as_array)
            .ok_or("任务查询响应缺少 data")?;
        let item = arr.first().cloned().ok_or("任务查询响应缺少 data")?;
        match item.get("status").and_then(Value::as_str) {
            Some("3") => return Ok(item),
            Some("4") => return Err("蜂鸟任务执行失败".into()),
            _ => {}
        }
        interval = (interval + 500).min(2000);
    }
}

fn extract_result_url(result: &Value) -> Option<String> {
    if let Some(arr) = result.as_array() {
        if let Some(first) = arr.first() {
            if let Some(s) = first.as_str() {
                return Some(s.to_string());
            }
            for k in ["url", "image", "result_url"] {
                if let Some(s) = first.get(k).and_then(Value::as_str) {
                    return Some(s.to_string());
                }
            }
        }
    }
    for k in ["url", "image", "result_url"] {
        if let Some(s) = result.get(k).and_then(Value::as_str) {
            return Some(s.to_string());
        }
    }
    None
}

async fn locales_list(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<Value> {
    use sqlx::Row;
    let mut qb: sqlx::QueryBuilder<sqlx::MySql> = sqlx::QueryBuilder::new(
        "SELECT l.id,l.locale_code,l.language,l.flag_picture,l.is_enabled,l.is_default,l.currency_id,l.sort,l.last_updated,c.name AS currency_name,c.symbol AS currency_symbol FROM locales l LEFT JOIN currency c ON c.id=l.currency_id WHERE 1=1",
    );
    if let Some(v) = body.get("isEnabled").and_then(Value::as_i64) {
        qb.push(" AND l.is_enabled=").push_bind(v as i32);
    }
    if let Some(k) = body
        .get("keyword")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let like = format!("%{k}%");
        qb.push(" AND (l.locale_code LIKE ")
            .push_bind(like.clone())
            .push(" OR l.language LIKE ")
            .push_bind(like)
            .push(")");
    }
    qb.push(" ORDER BY l.sort,l.id");
    let rows = qb
        .build()
        .fetch_all(&state.repos.pool)
        .await
        .map_err(|e| AppError(Error::Database(e.to_string())))?;
    let list: Vec<Value> = rows.into_iter().map(|r| json!({
        "id": r.try_get::<i32,_>("id").unwrap_or(0),
        "localeCode": r.try_get::<Option<String>,_>("locale_code").unwrap_or_default(),
        "language": r.try_get::<Option<String>,_>("language").unwrap_or_default(),
        "flagPicture": r.try_get::<Option<String>,_>("flag_picture").unwrap_or_default(),
        "isEnabled": r.try_get::<Option<i32>,_>("is_enabled").unwrap_or(Some(0)),
        "isDefault": r.try_get::<Option<i32>,_>("is_default").unwrap_or(Some(0)),
        "currencyId": r.try_get::<Option<i32>,_>("currency_id").unwrap_or(Some(0)),
        "sort": r.try_get::<Option<i32>,_>("sort").unwrap_or(None),
        "lastUpdated": r.try_get::<Option<i32>,_>("last_updated").unwrap_or(Some(0)),
        "currencyName": r.try_get::<Option<String>,_>("currency_name").unwrap_or_default(),
        "currencySymbol": r.try_get::<Option<String>,_>("currency_symbol").unwrap_or_default(),
    })).collect();
    ok(Value::Array(list))
}
