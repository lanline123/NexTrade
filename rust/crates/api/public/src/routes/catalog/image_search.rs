//! 消费者图片搜索（v5.8.61 `/api/search/image`）。
//!
//! 启用且配置阿里云图库时，使用阿里云 ImageSearch RPC `SearchImageByPic`；
//! 未启用/未配置/云请求失败返回明确业务错误。

use axum::{
    extract::{Multipart, State},
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use serde_json::{json, Value};
use sha1::Sha1;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::PublicState;

type HmacSha1 = Hmac<Sha1>;

const KEYS: [&str; 15] = [
    "imageSearchEnabled",
    "imageSearchH5Enabled",
    "imageSearchPcEnabled",
    "imageSearchAppEnabled",
    "imageSearchShopEnabled",
    "imageSearchProvider",
    "imageSearchIndexName",
    "imageSearchSimilarityPercent",
    "imageSearchMaxResults",
    "imageSearchAliyunRegionId",
    "imageSearchAliyunAccessKeyId",
    "imageSearchAliyunAccessKeySecret",
    "imageSearchAliyunSecurityToken",
    "imageSearchAliyunConnectTimeoutMillis",
    "imageSearchAliyunReadTimeoutMillis",
];

pub fn routes(state: &PublicState) -> Router<PublicState> {
    let _ = state;
    Router::new()
        .route("/search/image/capabilities", get(capabilities))
        .route("/search/image/search", post(search))
        .route("/search/image/results", post(results))
}

#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    [
        ("GET", "/api/search/image/capabilities", "ImageSearchController.capabilities"),
        ("POST", "/api/search/image/search", "ImageSearchController.search"),
        ("POST", "/api/search/image/results", "ImageSearchController.results"),
    ]
    .iter()
    .map(|(m, p, h)| RouteDoc::new(m, p, h))
    .collect()
}

async fn rows(state: &PublicState) -> Result<Vec<(String, String)>, AppError> {
    state
        .system
        .config_basic
        .repo()
        .find_by_codes(&KEYS)
        .await
        .map_err(AppError)
}

fn cfg<'a>(rows: &'a [(String, String)], key: &str) -> &'a str {
    rows.iter().find(|(k, _)| k == key).map(|(_, v)| v.as_str()).unwrap_or("")
}

fn on(rows: &[(String, String)], key: &str) -> bool {
    cfg(rows, key) == "1"
}

async fn capabilities(State(state): State<PublicState>) -> ApiResult<Value> {
    let rows = rows(&state).await?;
    let enabled = on(&rows, "imageSearchEnabled");
    ok(json!({
        "enabled": enabled,
        "h5Enabled": enabled && on(&rows, "imageSearchH5Enabled"),
        "pcEnabled": enabled && on(&rows, "imageSearchPcEnabled"),
        "appEnabled": enabled && on(&rows, "imageSearchAppEnabled"),
        "shopEnabled": enabled && on(&rows, "imageSearchShopEnabled"),
        "formats": ["JPEG", "PNG", "WEBP", "BMP", "GIF", "TIFF"]
    }))
}

async fn search(
    State(state): State<PublicState>,
    mut multipart: Multipart,
) -> ApiResult<Value> {
    let rows = rows(&state).await?;
    if !on(&rows, "imageSearchEnabled") {
        return Err(AppError(Error::biz(400, "图像搜索未启用")));
    }
    let provider = cfg(&rows, "imageSearchProvider").trim().to_lowercase();
    if provider != "aliyun" {
        return Err(AppError(Error::biz(400, "图搜厂商尚未接入")));
    }
    let key_id = cfg(&rows, "imageSearchAliyunAccessKeyId").trim();
    let key_secret = cfg(&rows, "imageSearchAliyunAccessKeySecret").trim();
    let index = cfg(&rows, "imageSearchIndexName").trim();
    let region = cfg(&rows, "imageSearchAliyunRegionId").trim();
    if key_id.is_empty() || key_secret.is_empty() || index.is_empty() || region.is_empty() {
        return Err(AppError(Error::biz(400, "图像搜索服务未配置")));
    }

    let mut file: Option<Vec<u8>> = None;
    while let Ok(Some(field)) = multipart.next_field().await {
        if field.name().map(|n| n == "file").unwrap_or(false) {
            file = Some(field.bytes().await.map_err(|_| AppError(Error::biz(400, "无法读取上传图片")))?.to_vec());
        }
    }
    let Some(bytes) = file.filter(|b| !b.is_empty()) else {
        return Err(AppError(Error::biz(400, "图片为空")));
    };
    if bytes.len() > 4 * 1024 * 1024 {
        return Err(AppError(Error::biz(400, "图片不能超过4MB")));
    }
    let max_results: i32 = cfg(&rows, "imageSearchMaxResults").parse().unwrap_or(20).clamp(1, 100);
    let similarity: i32 = cfg(&rows, "imageSearchSimilarityPercent").parse().unwrap_or(0);
    let score_threshold = format!("{:.2}", similarity as f64 / 100.0);
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    // 阿里云 SearchImageByPic 只接受 OSS URL；先走 AuthorizeFileUpload 上传。
    let pic_url = upload_transfer(&client, key_id, key_secret, region, &bytes).await?;

    let nonce = uuid::Uuid::new_v4().to_string();
    let timestamp = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let params = vec![
        ("Action".to_string(), "SearchImageByPic".to_string()),
        ("InstanceName".to_string(), index.to_string()),
        ("PicContent".to_string(), pic_url),
        ("Num".to_string(), max_results.to_string()),
        ("Start".to_string(), "0".to_string()),
        ("ScoreThreshold".to_string(), score_threshold),
        ("Crop".to_string(), "true".to_string()),
        ("SignatureNonce".to_string(), nonce),
        ("Timestamp".to_string(), timestamp),
    ];
    let body = sign("POST", key_id, key_secret, region, &params);
    let url = format!("https://imagesearch.{region}.aliyuncs.com/");
    let response = client
        .post(url)
        .header(reqwest::header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| AppError(Error::biz(400, format!("图像搜索服务暂不可用：{e}"))))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(AppError(Error::biz(400, format!("图像搜索服务返回 {status}"))));
    }
    let data: Value = serde_json::from_str(&text)
        .map_err(|_| AppError(Error::biz(400, "图像搜索响应无法解析")))?;
    if data.get("Success").and_then(Value::as_bool) == Some(false) {
        let msg = data.get("Message").and_then(Value::as_str).unwrap_or("图像搜索失败");
        return Err(AppError(Error::biz(400, msg.to_string())));
    }
    let auctions = data
        .get("Auctions")
        .and_then(Value::as_array)
        .or_else(|| data.get("Data").and_then(|d| d.get("Auctions")).and_then(Value::as_array))
        .cloned()
        .unwrap_or_default();
    let product_ids: Vec<i64> = auctions
        .iter()
        .filter_map(|a| a.get("ProductId").and_then(Value::as_str).and_then(|s| s.parse::<i64>().ok()))
        .collect();
    let records = products(&state, &product_ids).await?;
    ok(json!({
        "searchToken": "",
        "nextCursor": 0,
        "hasMore": false,
        "records": records,
        "candidateInfo": null
    }))
}

async fn products(state: &PublicState, ids: &[i64]) -> Result<Vec<Value>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut uniq = ids.to_vec();
    uniq.sort_unstable();
    uniq.dedup();
    let placeholders = vec!["?"; uniq.len()].join(",");
    let sale = tigshop_infrastructure::db::repo::catalog::product_sale::ProductSaleRepository::sale_condition();
    let sql = format!(
        "SELECT JSON_OBJECT('productId',product_id,'productName',product_name,'productSn',product_sn,'picThumb',pic_thumb,'productPrice',product_price,'marketPrice',market_price,'seoLink',CONCAT('/product/',product_id)) FROM product WHERE product_id IN ({placeholders}) AND product_status=1 AND is_delete=0 {sale} ORDER BY FIELD(product_id,{})",
        uniq.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")
    );
    let mut q = sqlx::query_as::<_, (Value,)>(&sql);
    for id in &uniq {
        q = q.bind(*id);
    }
    let rows = q
        .fetch_all(&state.repos.pool)
        .await
        .map_err(|e| AppError(Error::Database(e.to_string())))?;
    Ok(rows.into_iter().map(|(v,)| v).collect())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResultsQuery {
    search_token: Option<String>,
    cursor: Option<i32>,
    size: Option<i32>,
}

async fn results(
    State(state): State<PublicState>,
    Json(_q): Json<ResultsQuery>,
) -> ApiResult<Value> {
    let rows = rows(&state).await?;
    if !on(&rows, "imageSearchEnabled") {
        return Err(AppError(Error::biz(400, "图像搜索未启用")));
    }
    // 当前每次搜索直接返回有限结果；无跨请求会话。
    ok(json!({"searchToken":"","nextCursor":0,"hasMore":false,"records":[],"candidateInfo":null}))
}

fn percent_encode(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn sign(method: &str, key_id: &str, secret: &str, region: &str, params: &[(String, String)]) -> String {
    sign_version(method, key_id, secret, region, "2020-12-14", params)
}

fn sign_version(
    method: &str,
    key_id: &str,
    secret: &str,
    region: &str,
    version: &str,
    params: &[(String, String)],
) -> String {
    let mut all = params.to_vec();
    all.push(("AccessKeyId".into(), key_id.into()));
    all.push(("Format".into(), "JSON".into()));
    all.push(("RegionId".into(), region.into()));
    all.push(("SignatureMethod".into(), "HMAC-SHA1".into()));
    all.push(("SignatureVersion".into(), "1.0".into()));
    all.push(("Version".into(), version.into()));
    all.sort_by(|a, b| a.0.cmp(&b.0));
    let canonical = all
        .iter()
        .map(|(k, v)| format!("{}={}", percent_encode(k), percent_encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let string_to_sign = format!("{}&%2F&{}", method, percent_encode(&canonical));
    let mut mac = HmacSha1::new_from_slice(format!("{secret}&").as_bytes()).expect("HMAC key");
    mac.update(string_to_sign.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    format!("{canonical}&Signature={}", percent_encode(&signature))
}

/// 把上传图片写入阿里云图搜授权 OSS，返回可供 PicContent 使用的 URL。
async fn upload_transfer(
    client: &reqwest::Client,
    key_id: &str,
    secret: &str,
    region: &str,
    bytes: &[u8],
) -> Result<String, AppError> {
    let auth_params = vec![
        ("Action".to_string(), "AuthorizeFileUpload".to_string()),
        ("Product".to_string(), "ImageSearch".to_string()),
        ("SignatureNonce".to_string(), uuid::Uuid::new_v4().to_string()),
        ("Timestamp".to_string(), Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    ];
    let auth_query = sign_version("GET", key_id, secret, region, "2019-12-19", &auth_params);
    let auth: Value = client
        .get(format!("https://openplatform.aliyuncs.com/?{auth_query}"))
        .send()
        .await
        .map_err(|e| AppError(Error::biz(400, format!("图像上传授权失败：{e}"))))?
        .json()
        .await
        .map_err(|e| AppError(Error::biz(400, format!("图像上传授权响应异常：{e}"))))?;
    let s = |k: &str| auth.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let bucket = s("Bucket");
    let endpoint = s("Endpoint");
    let object_key = s("ObjectKey");
    if bucket.is_empty() || endpoint.is_empty() || object_key.is_empty() {
        return Err(AppError(Error::biz(400, "图像上传授权信息不完整")));
    }
    let part = Part::bytes(bytes.to_vec())
        .file_name(object_key.clone())
        .mime_str("application/octet-stream")
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    let form = Form::new()
        .text("OSSAccessKeyId", s("AccessKeyId"))
        .text("policy", s("EncodedPolicy"))
        .text("Signature", s("Signature"))
        .text("key", object_key.clone())
        .text("success_action_status", "201")
        .part("file", part);
    let upload = client
        .post(format!("https://{bucket}.{endpoint}/"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError(Error::biz(400, format!("图像上传失败：{e}"))))?;
    if !upload.status().is_success() {
        let status = upload.status();
        return Err(AppError(Error::biz(400, format!("图像上传失败：{status}"))));
    }
    Ok(format!("https://{bucket}.{endpoint}/{object_key}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_encoding_matches_aliyun_rules() {
        assert_eq!(percent_encode("a b+c/中"), "a%20b%2Bc%2F%E4%B8%AD");
    }

    #[test]
    fn signature_is_deterministic_and_sorted() {
        let params = vec![
            ("Action".to_string(), "SearchImageByPic".to_string()),
            ("InstanceName".to_string(), "idx".to_string()),
            ("SignatureNonce".to_string(), "n".to_string()),
            ("Timestamp".to_string(), "t".to_string()),
        ];
        let a = sign("POST", "kid", "secret", "cn-shanghai", &params);
        let b = sign("POST", "kid", "secret", "cn-shanghai", &params);
        assert_eq!(a, b);
        assert!(a.contains("Signature="));
        assert!(a.starts_with("AccessKeyId=kid&"));
        assert!(a.contains("Action=SearchImageByPic"));
    }
}
