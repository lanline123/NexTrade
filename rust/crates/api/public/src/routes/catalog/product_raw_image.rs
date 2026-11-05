//! 商品原图批量下载 —— 对齐 Java `ProductRawImageDownloadService`。
//!
//! 路由：`GET /api/product/product/downloadRawImages?id=`（在
//! [`super::product_manage::routes`] 注册，与商品详情共用 `optional_auth`）。
//!
//! 对应 Java 链路：
//! `ProductController.downloadRawImages`（`tigshop-api`，111–124 行）
//! → `ProductRawImageDownloadService#download`（`tigshop-service`，47–93 行）。
//!
//! 本实现复刻的关键语义：
//! - `allowedScopes()`：总开关、`X-Client-Type` 渠道白名单、打包范围合法性；
//! - `collect()`：主图（含门店独立主图）/ SKU 规格图 / 详情图三范围，按 folder+url 去重；
//! - `getRawImageDownloadContext()`：商品须已上架（`product_status = 1 AND is_delete = 0`）；
//! - `originalUrl()`：HTML 实体解码、补协议、剥离 OSS/云处理缩略参数、保留签名串；
//! - `writeArchive()`：`{商品名}/主图|SKU图/{规格}|详情图/` 分目录、按真实格式命名、
//!   **任一源图读取失败即整体失败返回 JSON 错误**（不产出残缺包）；
//! - 响应头暴露 `Content-Disposition` / `Content-Length`（前端要读文件名并校验完整性）。
//!
//! Rust 侧加固（Java 无显式上限）：单图 20 MB、单次最多 500 张，避免异常商品打爆内存。
//! Java 的 `ImageSearchSourceReader` 可读本地源文件；本实现统一走 HTTP(S) 读取，
//! 相对路径按请求 Host 补齐（与迁移前行为一致）。

use axum::{
    body::Body,
    extract::{Extension, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
};
use serde::Deserialize;
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Write};
use std::time::Duration;
use tigshop_core::models::system::config_client::{
    parse_config_string_list, DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS,
    DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
};
use tigshop_core::Error;
use tigshop_security::web::{AppError, AuthUser};
use zip::write::SimpleFileOptions;

use crate::PublicState;

const BIZ_ENABLED: &str = "productRawImageDownloadEnabled";
const BIZ_CHANNELS: &str = "productRawImageDownloadChannels";
const BIZ_SCOPES: &str = "productRawImageDownloadScopes";
const BIZ_STORE_ASSIGN_IMAGE: &str = "storeAssignProductImage";
const VALID_SCOPES: [&str; 3] = ["main", "sku", "detail"];
const VALID_CHANNELS: [&str; 4] = ["pc", "h5", "miniProgram", "app"];
const MAX_FILES: usize = 500;
const MAX_BYTES: u64 = 20 * 1024 * 1024;

fn biz(code: i32, msg: impl Into<String>) -> AppError {
    AppError(Error::biz(code, msg))
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct RawQuery {
    id: Option<i32>,
    shop_id: Option<i32>,
    nearest_shop_id: Option<i32>,
}

#[derive(Debug, Clone, Default)]
struct RawImageSettings {
    enabled: Option<i32>,
    channels: Option<Vec<String>>,
    scopes: Option<Vec<String>>,
    /// Java `SettingsEnum.STORE_ASSIGN_PRODUCT_IMAGE`：门店独立商品主图。
    store_assign_image: bool,
}

#[derive(Debug)]
struct RawImageProduct {
    name: String,
    sn: String,
    desc: Option<String>,
    pic_url: Option<String>,
    pic_original: Option<String>,
    shop_id: i32,
}

#[derive(Debug, Clone)]
struct RawImageEntry {
    folder: String,
    category: &'static str,
    url: String,
    label: Option<String>,
}

/// `GET /api/product/product/downloadRawImages?id=`：登录后打包下载商品原图。
pub async fn download_raw_images(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    headers: HeaderMap,
    Query(q): Query<RawQuery>,
) -> Result<Response, AppError> {
    let user_id = auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0);
    if user_id <= 0 {
        return Err(biz(401, "请先登录后下载商品原图"));
    }
    let product_id = q.id.unwrap_or(0);
    if product_id <= 0
        || q.shop_id.is_some_and(|v| v < 0)
        || q.nearest_shop_id.is_some_and(|v| v < 0)
    {
        return Err(biz(400, "商品或门店参数不合法"));
    }

    let settings = load_settings(&state).await?;
    let scopes = allowed_scopes(&settings, channel_of(&headers))?;
    let product = load_product(&state, product_id).await?;
    let base = request_base(&headers);
    let entries = collect_entries(&state, &product, &scopes, &settings, &q, &base).await?;
    if entries.is_empty() {
        return Err(biz(400, "该商品没有可下载的原图"));
    }

    let extensions = load_extensions(&state, &entries, &base).await;
    let data = build_archive(&entries, &extensions, &product).await?;

    let ascii_code = safe_file_name_part(&product.sn, &product_id.to_string());
    let filename = format!("{}_{}_原图.zip", safe_name(&product.name, "商品"), ascii_code);
    let disposition = format!(
        "attachment; filename=\"product_{}_raw_images.zip\"; filename*=UTF-8''{}",
        ascii_code,
        percent_encode(&filename)
    );
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/zip")
        .header(header::CONTENT_LENGTH, data.len())
        .header(header::CONTENT_DISPOSITION, disposition)
        .header(header::CACHE_CONTROL, "no-store")
        .header(
            header::ACCESS_CONTROL_EXPOSE_HEADERS,
            "Content-Disposition, Content-Length",
        )
        .body(Body::from(data))
        .map_err(|e| AppError(Error::Internal(e.to_string())))
}

// ————————————————————— 配置与校验 —————————————————————
/// Java `SettingsEnum.PRODUCT_RAW_IMAGE_DOWNLOAD_*` 的默认值（配置行缺失时生效）。
fn java_default_settings() -> RawImageSettings {
    RawImageSettings {
        enabled: Some(0),
        channels: Some(
            DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS
                .iter()
                .map(|v| (*v).to_owned())
                .collect(),
        ),
        scopes: Some(
            DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES
                .iter()
                .map(|v| (*v).to_owned())
                .collect(),
        ),
        store_assign_image: false,
    }
}


async fn load_settings(state: &PublicState) -> Result<RawImageSettings, AppError> {
    let rows = sqlx::query(
        "SELECT biz_code, biz_val FROM config WHERE biz_code IN (?, ?, ?, ?) AND is_del = 0",
    )
    .bind(BIZ_ENABLED)
    .bind(BIZ_CHANNELS)
    .bind(BIZ_SCOPES)
    .bind(BIZ_STORE_ASSIGN_IMAGE)
    .fetch_all(&state.repos.pool)
    .await
    .map_err(|e| AppError(Error::Database(e.to_string())))?;

    // Java `SettingsHelper#getRaw`：配置行缺失时回落 SettingsEnum.defaultValue；
    // 行存在但值空白时 parse(JSON_ARRAY, blank) = null，由下面循环覆盖为 None。
    let mut out = java_default_settings();
    for row in rows {
        let code = row.try_get::<String, _>("biz_code").unwrap_or_default();
        let value: Option<String> = row.try_get("biz_val").ok().flatten();
        match code.as_str() {
            BIZ_ENABLED => {
                out.enabled = value.as_deref().and_then(|v| v.trim().parse::<i32>().ok());
            }
            BIZ_CHANNELS => out.channels = parse_config_string_list(value.as_deref()),
            BIZ_SCOPES => out.scopes = parse_config_string_list(value.as_deref()),
            BIZ_STORE_ASSIGN_IMAGE => {
                out.store_assign_image = value.as_deref().is_some_and(|v| v.trim() == "1");
            }
            _ => {}
        }
    }
    Ok(out)
}

/// Java `HeaderUtils.getClientType()` + `allowedScopes()` 的渠道归一。
fn channel_of(headers: &HeaderMap) -> &'static str {
    match headers
        .get("x-client-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim()
    {
        "pc" => "pc",
        "h5" | "wechat" => "h5",
        "miniProgram" => "miniProgram",
        "app" | "android" | "ios" => "app",
        // pos / 未知 / 缺失：Java `default -> ""`，随后被渠道白名单拒绝。
        _ => "",
    }
}

/// Java `ProductRawImageDownloadService#allowedScopes`（95–117 行）。
fn allowed_scopes(settings: &RawImageSettings, channel: &str) -> Result<Vec<String>, AppError> {
    if settings.enabled != Some(1) {
        return Err(biz(400, "商品原图下载未开启"));
    }
    let channels = settings.channels.as_deref().unwrap_or(&[]);
    if channel.is_empty()
        || !VALID_CHANNELS.contains(&channel)
        || !channels.iter().any(|c| c == channel)
    {
        return Err(biz(400, "当前渠道未开放商品原图下载"));
    }
    let scopes = settings.scopes.clone().unwrap_or_default();
    if scopes.is_empty() || scopes.iter().any(|s| !VALID_SCOPES.contains(&s.as_str())) {
        return Err(biz(400, "商品原图下载未配置有效的打包范围"));
    }
    Ok(scopes)
}

// ————————————————————— 采集 —————————————————————

async fn load_product(state: &PublicState, product_id: i32) -> Result<RawImageProduct, AppError> {
    let row = sqlx::query(
        "SELECT product_name, product_sn, product_desc, pic_url, pic_original, shop_id \
         FROM product WHERE product_id = ? AND is_delete = 0 AND product_status = 1 LIMIT 1",
    )
    .bind(product_id)
    .fetch_optional(&state.repos.pool)
    .await
    .map_err(|e| AppError(Error::Database(e.to_string())))?
    .ok_or_else(|| biz(400, "商品不存在"))?;

    let text = |key: &str| -> Option<String> { row.try_get::<Option<String>, _>(key).ok().flatten() };
    Ok(RawImageProduct {
        name: row
            .try_get::<String, _>("product_name")
            .unwrap_or_default(),
        sn: row.try_get::<String, _>("product_sn").unwrap_or_default(),
        desc: text("product_desc"),
        pic_url: text("pic_url"),
        pic_original: text("pic_original"),
        shop_id: row.try_get::<i32, _>("shop_id").unwrap_or(0),
    })
}

fn request_base(headers: &HeaderMap) -> String {
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("127.0.0.1");
    let proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    format!("{proto}://{host}/")
}

fn first(preferred: Option<String>, fallback: Option<String>) -> Option<String> {
    match preferred {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => fallback,
    }
}

async fn galleries(
    state: &PublicState,
    product_id: i32,
    shop_id: i64,
) -> Result<Vec<(Option<String>, Option<String>)>, AppError> {
    let rows = sqlx::query(
        "SELECT pic_url, pic_original FROM product_gallery \
         WHERE product_id = ? AND shop_id = ? ORDER BY sort_order, pic_id",
    )
    .bind(product_id)
    .bind(shop_id)
    .fetch_all(&state.repos.pool)
    .await
    .map_err(|e| AppError(Error::Database(e.to_string())))?;
    Ok(rows
        .iter()
        .map(|r| {
            (
                r.try_get::<Option<String>, _>("pic_original").ok().flatten(),
                r.try_get::<Option<String>, _>("pic_url").ok().flatten(),
            )
        })
        .collect())
}

/// Java `ProductRawImageDownloadService#collect`（119–164 行）。
async fn collect_entries(
    state: &PublicState,
    product: &RawImageProduct,
    scopes: &[String],
    settings: &RawImageSettings,
    q: &RawQuery,
    base: &str,
) -> Result<Vec<RawImageEntry>, AppError> {
    let mut entries: Vec<RawImageEntry> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut add = |folder: String,
                   category: &'static str,
                   source: Option<String>,
                   label: Option<String>|
     -> Result<(), AppError> {
        let Some(src) = source.filter(|s| !s.trim().is_empty()) else {
            return Ok(());
        };
        let url = original_url(&src, base).map_err(|m| biz(400, m))?;
        if seen.insert(format!("{folder}\n{url}")) {
            entries.push(RawImageEntry {
                folder,
                category,
                url,
                label,
            });
        }
        Ok(())
    };

    // main：相册主图（门店独立主图优先，回退平台主图），无相册时用商品主图列。
    if scopes.iter().any(|s| s == "main") {
        let context_shop = q
            .nearest_shop_id
            .filter(|v| *v > 0)
            .or_else(|| q.shop_id.filter(|v| *v > 0))
            .unwrap_or(product.shop_id);
        let gallery_shop = if settings.store_assign_image && context_shop > 0 {
            i64::from(context_shop)
        } else {
            0
        };
        let mut rows = galleries(state, q.id.unwrap_or(0), gallery_shop).await?;
        if rows.is_empty() && gallery_shop != 0 {
            rows = galleries(state, q.id.unwrap_or(0), 0).await?;
        }
        if rows.is_empty() {
            let fallback = if gallery_shop != 0 {
                first(product.pic_url.clone(), product.pic_original.clone())
            } else {
                first(product.pic_original.clone(), product.pic_url.clone())
            };
            add("主图".to_owned(), "主图", fallback, None)?;
        } else {
            for (pic_original, pic_url) in rows {
                add(
                    "主图".to_owned(),
                    "主图",
                    first(pic_original, pic_url),
                    None,
                )?;
            }
        }
    }

    // sku：规格图属于单个规格值，与销售 SKU 组合和启用状态无关。
    if scopes.iter().any(|s| s == "sku") {
        let rows = sqlx::query(
            "SELECT attr_name, attr_value, attr_pic FROM product_attributes \
             WHERE product_id = ? AND attr_type = 1 ORDER BY sort_order, attributes_id",
        )
        .bind(q.id.unwrap_or(0))
        .fetch_all(&state.repos.pool)
        .await
        .map_err(|e| AppError(Error::Database(e.to_string())))?;
        for row in rows {
            let attr_name = row.try_get::<String, _>("attr_name").unwrap_or_default();
            let attr_value = row.try_get::<String, _>("attr_value").unwrap_or_default();
            let label = safe_name(&format!("{attr_name}_{attr_value}"), "默认规格");
            add(
                format!("SKU图/{label}"),
                "SKU",
                row.try_get::<Option<String>, _>("attr_pic").ok().flatten(),
                Some(label),
            )?;
        }
    }

    // detail：商品详情富文本内的全部 <img src>。
    if scopes.iter().any(|s| s == "detail") {
        if let Some(desc) = product.desc.as_deref() {
            for src in extract_img_srcs(desc) {
                add("详情图".to_owned(), "详情", Some(src), None)?;
            }
        }
    }

    Ok(entries)
}

// ————————————————————— 打包 —————————————————————

/// Java `GalleryPic.fileType` 优先；key 同时按归一化 URL 与原始 URL 建立。
async fn load_extensions(
    state: &PublicState,
    entries: &[RawImageEntry],
    base: &str,
) -> HashMap<String, String> {
    let mut urls: Vec<String> = entries.iter().map(|e| e.url.clone()).collect();
    urls.sort();
    urls.dedup();
    let mut out = HashMap::new();
    if urls.is_empty() {
        return out;
    }
    let mut builder = sqlx::QueryBuilder::<sqlx::MySql>::new(
        "SELECT pic_url, file_type FROM gallery_pic WHERE file_type IS NOT NULL AND pic_url IN (",
    );
    let mut separated = builder.separated(", ");
    for url in &urls {
        separated.push_bind(url);
    }
    builder.push(")");
    let Ok(rows) = builder.build().fetch_all(&state.repos.pool).await else {
        return out;
    };
    for row in rows {
        let url = row.try_get::<String, _>("pic_url").unwrap_or_default();
        let file_type = row
            .try_get::<Option<String>, _>("file_type")
            .ok()
            .flatten()
            .unwrap_or_default();
        if !is_safe_extension(&file_type) {
            continue;
        }
        let ext = file_type.to_ascii_lowercase();
        if let Ok(normalized) = original_url(&url, base) {
            out.entry(normalized).or_insert_with(|| ext.clone());
        }
        out.entry(url).or_insert(ext);
    }
    out
}

async fn build_archive(
    entries: &[RawImageEntry],
    extensions: &HashMap<String, String>,
    product: &RawImageProduct,
) -> Result<Vec<u8>, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|e| AppError(Error::Internal(e.to_string())))?;
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let root = safe_name(&product.name, "商品");
    let mut sequence: HashMap<String, usize> = HashMap::new();
    let mut written = 0usize;
    let read_error = || biz(400, "商品原图读取失败，未生成压缩包，请稍后重试");

    for entry in entries.iter().take(MAX_FILES) {
        let response = client
            .get(&entry.url)
            .send()
            .await
            .map_err(|_| read_error())?;
        if !response.status().is_success()
            || response.content_length().is_some_and(|n| n > MAX_BYTES)
        {
            return Err(read_error());
        }
        let bytes = response.bytes().await.map_err(|_| read_error())?;
        if bytes.is_empty() || bytes.len() as u64 > MAX_BYTES {
            return Err(read_error());
        }
        let extension = match extensions.get(&entry.url) {
            Some(ext) => ext.clone(),
            None => detect_extension(&bytes, &entry.url).map_err(|m| biz(400, m))?,
        };
        let number = sequence.entry(entry.folder.clone()).or_insert(0);
        *number += 1;
        let label = entry
            .label
            .as_ref()
            .map(|l| format!("_{}", safe_name(l, "图片")))
            .unwrap_or_default();
        let file_name = format!("{}_{number:03}{label}.{extension}", entry.category);
        let path = format!("{root}/{}/{file_name}", entry.folder);
        zip.start_file(path, options)
            .map_err(|e| AppError(Error::Internal(e.to_string())))?;
        zip.write_all(&bytes)
            .map_err(|e| AppError(Error::Internal(e.to_string())))?;
        written += 1;
    }
    if written == 0 {
        return Err(biz(400, "商品原图打包失败，请稍后重试"));
    }
    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|e| AppError(Error::Internal(e.to_string())))
}

// ————————————————————— 纯逻辑工具 —————————————————————

/// Java `ProductRawImageDownloadService#originalUrl`（237–261 行）：
/// 反转义、补协议、去掉已知图片处理参数，保留令牌 / 签名等其余查询串。
fn original_url(source: &str, base: &str) -> Result<String, String> {
    let mut value = html_unescape(source.trim());
    if value.is_empty() {
        return Err("商品图片地址不合法".to_owned());
    }
    if value.starts_with("//") {
        value = format!("https:{value}");
    }
    let absolute = if value.starts_with("http://") || value.starts_with("https://") {
        value
    } else {
        format!("{}{}", base, value.trim_start_matches('/'))
    };
    let (head, query) = match absolute.split_once('?') {
        Some((h, q)) => (h, Some(q)),
        None => (absolute.as_str(), None),
    };
    let scheme_end = head.find("://").map_or(0, |i| i + 3);
    let path_start = head[scheme_end..]
        .find('/')
        .map_or(0, |i| scheme_end + i);
    if path_start == 0 || head.len() <= path_start + 1 {
        return Err("商品图片地址不合法".to_owned());
    }
    let kept: Vec<&str> = query
        .map(|q| {
            q.split('&')
                .filter(|item| {
                    let key = item.split('=').next().unwrap_or("").to_ascii_lowercase();
                    !matches!(key.as_str(), "x-oss-process" | "x-image-process" | "imagemogr2" | "imageview2")
                        && !key.starts_with("imagemogr2/")
                        && !key.starts_with("imageview2/")
                })
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default();
    Ok(if kept.is_empty() {
        head.to_owned()
    } else {
        format!("{head}?{}", kept.join("&"))
    })
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

/// 提取富文本内全部 `<img src>`（大小写不敏感，兼容单引号 / 无引号 / 实体）。
fn extract_img_srcs(html: &str) -> Vec<String> {
    let lower = html.to_ascii_lowercase();
    let mut out = Vec::new();
    let mut cursor = 0usize;
    while let Some(relative) = lower[cursor..].find("<img") {
        let start = cursor + relative;
        let Some(end) = lower[start..].find('>') else {
            break;
        };
        let tag = &html[start..start + end];
        if let Some(value) = attribute_value(tag, "src") {
            out.push(html_unescape(&value));
        }
        cursor = start + end + 1;
    }
    out
}

fn attribute_value(tag: &str, name: &str) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let mut cursor = 0usize;
    while let Some(relative) = lower[cursor..].find(name) {
        let index = cursor + relative;
        // 属性名必须独立出现：`data-src` / `v-bind:src` 不算 `src`
        // （Java 用 HtmlPolicyBuilder 的 allowAttributes("src") 精确匹配）。
        let boundary_ok = index == 0 || bytes[index - 1].is_ascii_whitespace();
        let mut after = index + name.len();
        while after < tag.len() && bytes[after].is_ascii_whitespace() {
            after += 1;
        }
        if boundary_ok && bytes.get(after) == Some(&b'=') {
            after += 1;
            while after < tag.len() && bytes[after].is_ascii_whitespace() {
                after += 1;
            }
            let quote = bytes.get(after).copied();
            if quote == Some(b'"') || quote == Some(b'\'') {
                let quote = quote.unwrap_or(b'"');
                if let Some(end) = tag[after + 1..].find(quote as char) {
                    return Some(tag[after + 1..after + 1 + end].to_owned());
                }
            } else {
                let value: String = tag[after..]
                    .chars()
                    .take_while(|c| !c.is_whitespace() && *c != '>')
                    .collect();
                if !value.is_empty() {
                    return Some(value);
                }
            }
        }
        cursor = index + name.len();
    }
    None
}

fn is_safe_extension(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 12
        && value.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Java `detectedExtension`：优先文件头探测，JPEG 的 jpg/jpeg 别名按已存后缀保留。
fn detect_extension(bytes: &[u8], url: &str) -> Result<String, String> {
    let stored = url_extension(url);
    let detected = magic_extension(bytes);
    if let Some(found) = detected {
        if (found == "jpg" || found == "jpeg")
            && (stored == "jpg" || stored == "jpeg")
        {
            return Ok(stored);
        }
        return Ok(found.to_owned());
    }
    if is_safe_extension(&stored) {
        return Ok(stored.to_ascii_lowercase());
    }
    Err("商品原图文件格式无法识别".to_owned())
}

fn url_extension(url: &str) -> String {
    let path = url.split('?').next().unwrap_or(url);
    let tail = path.rsplit('/').next().unwrap_or(path);
    match tail.rsplit_once('.') {
        Some((_, ext)) => ext.to_ascii_lowercase(),
        None => String::new(),
    }
}

fn magic_extension(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else if bytes.starts_with(b"BM") {
        Some("bmp")
    } else {
        None
    }
}

fn safe_file_name_part(value: &str, fallback: &str) -> String {
    if value.trim().is_empty() {
        return fallback.to_owned();
    }
    let cleaned: String = value
        .chars()
        .map(|c| {
            if "\\/:*?\"<>|".contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned
        .trim_matches(|c| c == '.' || c == ' ')
        .trim()
        .to_owned();
    if trimmed.is_empty() {
        fallback.to_owned()
    } else {
        trimmed
    }
}

fn safe_name(value: &str, fallback: &str) -> String {
    safe_file_name_part(value, fallback)
        .chars()
        .take(70)
        .collect()
}

fn percent_encode(input: &str) -> String {
    let mut out = String::new();
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_mapping_matches_java() {
        assert_eq!(channel_of(&HeaderMap::new()), "");
        let mut headers = HeaderMap::new();
        for (raw, expected) in [
            ("pc", "pc"),
            ("wechat", "h5"),
            ("h5", "h5"),
            ("miniProgram", "miniProgram"),
            ("android", "app"),
            ("ios", "app"),
            ("app", "app"),
            ("pos", ""),
        ] {
            headers.insert("x-client-type", raw.parse().unwrap());
            assert_eq!(channel_of(&headers), expected, "clientType={raw}");
        }
    }

    #[test]
    fn java_enum_defaults_are_applied_when_config_rows_are_missing() {
        // Java `enabled.defaultValue = "0"`，只有管理员打开开关后才谈得上渠道/范围默认值。
        let defaults = java_default_settings();
        assert_eq!(defaults.enabled, Some(0));
        assert!(allowed_scopes(&defaults, "pc").is_err());
        let settings = RawImageSettings {
            enabled: Some(1),
            ..defaults
        };
        assert_eq!(allowed_scopes(&settings, "pc").ok().unwrap().len(), 3);
        assert!(allowed_scopes(&settings, "miniProgram").is_ok());
        assert!(allowed_scopes(&settings, "app").is_ok());
        assert!(allowed_scopes(&settings, "").is_err());
        let blank_row = RawImageSettings {
            channels: None,
            ..settings
        };
        assert!(allowed_scopes(&blank_row, "pc").is_err());
    }

    #[test]
    fn allowed_scopes_enables_switch_channel_and_scope() {
        let settings = RawImageSettings {
            enabled: Some(1),
            channels: Some(vec!["pc".to_owned(), "h5".to_owned()]),
            scopes: Some(vec!["main".to_owned(), "sku".to_owned(), "detail".to_owned()]),
            ..RawImageSettings::default()
        };
        assert_eq!(allowed_scopes(&settings, "pc").ok().unwrap().len(), 3);
        assert!(allowed_scopes(&settings, "app").is_err());
        let off = RawImageSettings {
            enabled: Some(0),
            ..settings.clone()
        };
        assert!(allowed_scopes(&off, "pc").is_err());
        let bad_scope = RawImageSettings {
            scopes: Some(vec!["main".to_owned(), "unknown".to_owned()]),
            ..settings
        };
        assert!(allowed_scopes(&bad_scope, "pc").is_err());
    }

    #[test]
    fn original_url_strips_image_processing_but_keeps_signature() {
        assert_eq!(
            original_url(
                "https://oss.example.com/a/b.jpg?x-oss-process=image/resize,w_400&token=abc",
                "http://shop.test/",
            )
            .unwrap(),
            "https://oss.example.com/a/b.jpg?token=abc"
        );
        assert_eq!(
            original_url(
                "https://oss.example.com/a/b.png?imageMogr2/thumbnail/400x&sign=xyz",
                "http://shop.test/",
            )
            .unwrap(),
            "https://oss.example.com/a/b.png?sign=xyz"
        );
    }

    #[test]
    fn original_url_handles_relative_protocol_relative_and_entities() {
        assert_eq!(
            original_url("images/a.jpg?x-oss-process=style", "https://shop.test/").unwrap(),
            "https://shop.test/images/a.jpg"
        );
        assert_eq!(
            original_url("//cdn.test/a.jpg", "https://shop.test/").unwrap(),
            "https://cdn.test/a.jpg"
        );
        assert_eq!(
            original_url("https://x.test/a.jpg?a=1&amp;b=2", "https://shop.test/").unwrap(),
            "https://x.test/a.jpg?a=1&b=2"
        );
        assert!(original_url("", "https://shop.test/").is_err());
    }

    #[test]
    fn img_srcs_are_extracted_with_entity_decoding() {
        let html = r#"<p><IMG SRC='https://x.test/1.jpg?a=1&amp;b=2'/></p><img src="https://x.test/2.png"><img data-src="no">"#;
        let srcs = extract_img_srcs(html);
        assert_eq!(srcs.len(), 2);
        assert_eq!(srcs[0], "https://x.test/1.jpg?a=1&b=2");
        assert_eq!(srcs[1], "https://x.test/2.png");
    }

    #[test]
    fn extension_detection_prefers_magic_bytes() {
        assert_eq!(
            detect_extension(&[0xFF, 0xD8, 0xFF, 0xE0], "https://x/a.jpeg").unwrap(),
            "jpeg"
        );
        assert_eq!(
            detect_extension(b"\x89PNG\r\n\x1a\n", "https://x/a.jpg").unwrap(),
            "png"
        );
        assert_eq!(
            detect_extension(&[0x01, 0x02], "https://x/a.webp").unwrap(),
            "webp"
        );
        assert!(detect_extension(&[0x01, 0x02], "https://x/a").is_err());
    }

    #[test]
    fn config_string_list_and_safe_names() {
        assert_eq!(
            parse_config_string_list(Some(r#"["pc","h5"]"#)).unwrap(),
            vec!["pc".to_owned(), "h5".to_owned()]
        );
        assert_eq!(
            parse_config_string_list(Some("main, sku")).unwrap(),
            vec!["main".to_owned(), "sku".to_owned()]
        );
        assert_eq!(parse_config_string_list(Some("[]")), None);
        assert_eq!(parse_config_string_list(None), None);
        assert_eq!(safe_file_name_part("../a:b", "商品"), "_a_b");
        assert!(safe_name(&"长".repeat(100), "商品").chars().count() == 70);
    }
}
