//! 相册图片域（content::gallery_pic）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.setting.GalleryPicController`
//!   （`@RequestMapping("/adminapi/setting/galleryPic")`，10 个端点）
//! - `com.tigshop.service.setting.impl.GalleryPicServiceImpl`
//! - 入参 `GalleryPicListDTO` / `GalleryPicSortDTO` / `GalleryPicTransferDTO` /
//!   `GalleryPicBatchDTO` / `GalleryPicExternalDTO` / `UpdateFieldDTO` / `OperateDTO`
//! - 出参 `GalleryListResVO` / `GalleryPicUploadVO` / `GalleryPicDTO` / `GalleryPicResDTO`
//!
//! # 口径说明
//!
//! - 列表页尺寸取 Java `BasePage`：缺省 15、上限 100（**不是** gallery 域的固定 99）。
//! - 多租户 scope 与 gallery 域一致（`x-admin-type` / `x-shop-id` / `x-vendor-id`）。
//! - `GalleryPicDTO.shopId` 在 Java 里是 `String`，而实体是 `Integer`，
//!   `BeanUtils.copyProperties` 因类型不兼容**不会复制**，故该字段恒为 `null`；
//!   本实现保留 `Option<String>` 并同样置空（见 `uncertain_points`）。
//! - `uploadImg` / `batchDownload` 依赖对象存储 / zip 打包（未迁移）：
//!   本域完成本地校验后返回明确的「未迁移」业务错误，不伪造成功。

use serde::{Deserialize, Serialize};

use crate::models::content::gallery::GalleryDTO;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（文案逐字对齐 Java）
// ——————————————————————————————————————————————

/// Java `GalleryPicConstants.FILE_NOT_EXIST`。
pub const FILE_NOT_EXIST: &str = "文件不存在";
/// Java `GalleryConstants.GALLERY_ID_IS_NULL`。
pub const GALLERY_ID_IS_NULL: &str = "相册不存在";
/// `id不能为空`
pub const ERR_ID_REQUIRED: &str = "id不能为空";
/// `未选择项目`
pub const ERR_UNSELECTED_ITEM: &str = "未选择项目";
/// `分组ID不能为空`（排序）
pub const ERR_GALLERY_ID_REQUIRED: &str = "分组ID不能为空";
/// `排序ID列表不能为空`
pub const ERR_SORT_IDS_REQUIRED: &str = "排序ID列表不能为空";
/// `素材ID列表不能为空`（移动 / 批量删除 / 批量下载）
pub const ERR_IDS_REQUIRED: &str = "素材ID列表不能为空";
/// `目标分组ID不能为空`
pub const ERR_TARGET_ID_REQUIRED: &str = "目标分组ID不能为空";
/// `类型不能为空`
pub const ERR_TYPE_REQUIRED: &str = "类型不能为空";
/// `图片地址不能为空`
pub const ERR_PIC_URL_REQUIRED: &str = "图片地址不能为空";
/// `来源不能为空`
pub const ERR_SOURCE_REQUIRED: &str = "来源不能为空";
/// `URL不能为空`
pub const ERR_URL_EMPTY: &str = "URL不能为空";
/// `URL必须以http://或https://开头`
pub const ERR_URL_SCHEME: &str = "URL必须以http://或https://开头";
/// `不支持网页搜索结果地址，请提供图片/视频直链`
pub const ERR_URL_BLOCKED: &str = "不支持网页搜索结果地址，请提供图片/视频直链";
/// `文件不能为空`
pub const ERR_UPLOAD_FILE_EMPTY: &str = "文件不能为空";
/// `不支持的文件类型`
pub const ERR_UPLOAD_FILE_TYPE: &str = "不支持的文件类型";
/// `没有可下载的素材`
pub const ERR_NO_DOWNLOADABLE: &str = "没有可下载的素材";
/// `field 的值有误`
pub const ERR_FIELD_INVALID: &str = "field 的值有误";
/// 图片上传「未迁移」业务错误（不伪造成功）。
pub const ERR_UPLOAD_NOT_MIGRATED: &str =
    "图片上传依赖对象存储服务（OSS/COS/七牛/S3/本地存储）与图片尺寸解析，当前 Rust 侧尚未迁移，本接口暂不可用";
/// 批量下载「未迁移」业务错误（不伪造成功）。
pub const ERR_DOWNLOAD_NOT_MIGRATED: &str =
    "批量下载依赖 zip 打包与对象存储下载，当前 Rust 侧尚未迁移，本接口暂不可用";

/// 允许的图片 MIME（Java `Constants.ALLOWED_IMAGE_TYPES`）。
pub const ALLOWED_IMAGE_TYPES: [&str; 5] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff",
];
/// 外部直链允许的扩展名（Java `ALLOWED_IMAGE_EXTENSIONS`）。
pub const ALLOWED_IMAGE_EXTENSIONS: [&str; 5] = ["bmp", "jpg", "jpeg", "png", "gif"];
/// 禁止的网页搜索结果地址片段（Java `BLOCKED_URL_PATTERNS`）。
pub const BLOCKED_URL_PATTERNS: [&str; 5] = [
    "baidu.com/s?",
    "image.baidu.com/search",
    "google.com/search",
    "bing.com/images/search",
    "sogou.com/pics",
];
/// `updateField` 白名单（Java `CheckFieldConstants.GALLERY_FIELDS`）。
pub const GALLERY_FIELDS: [&str; 1] = ["pic_name"];
/// 配置键：图片上传最大尺寸 MB（Java `SettingsEnum.IMAGE_UPLOAD_MAX_SIZE`）。
pub const CONFIG_IMAGE_UPLOAD_MAX_SIZE: &str = "imageUploadMaxSize";
/// 图片上传最大尺寸默认值（Java 枚举 `defaultValue = "20"`）。
pub const DEFAULT_IMAGE_UPLOAD_MAX_SIZE: &str = "20";
/// 外部图片默认名称（Java `"外部图片"`）。
pub const DEFAULT_EXTERNAL_PIC_NAME: &str = "外部图片";
/// 相册图片列表固定返回的子相册图片预览数（Java `new Page<>(1, 4)`）。
pub const CHILD_PREVIEW_PIC_LIMIT: u64 = 4;

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// Java `BasePage#getPage/getSize`：缺省 1 / 15，上限 100。
#[must_use]
pub fn page_params(page: Option<u64>, size: Option<u64>) -> (u64, u64) {
    (page.unwrap_or(1).max(1), size.unwrap_or(15).clamp(1, 100))
}

/// 由 page/size 构造 [`PageQuery`]。
#[must_use]
pub fn page_query(page: Option<u64>, size: Option<u64>) -> PageQuery {
    let (page, size) = page_params(page, size);
    PageQuery {
        page,
        page_size: size,
    }
}

/// 来源筛选归一化（Java `buildGalleryPicQueryWrapper`）：
/// `external` → `external`；`local`/`upload` → `upload`；其它/空 → 不过滤。
#[must_use]
pub fn normalize_source_filter(raw: Option<&str>) -> Option<&'static str> {
    let source = raw?.trim();
    if source.is_empty() {
        return None;
    }
    if source.eq_ignore_ascii_case("external") {
        Some("external")
    } else if source.eq_ignore_ascii_case("local") || source.eq_ignore_ascii_case("upload") {
        Some("upload")
    } else {
        None
    }
}

/// 列表排序（Java `GalleryPicServiceImpl#list`）：
/// - `sortOrder == "manual"` ⇒ `pic_sort ASC`；
/// - 否则 `sortField` 缺省 `addTime`，`sortOrder` 为 `desc` 时降序、其余升序。
///
/// 返回 `(列名, 是否降序)`；`sortOrder == "manual"` 时降序恒 false。
#[must_use]
pub fn resolve_sort(sort_field: Option<&str>, sort_order: Option<&str>) -> (&'static str, bool) {
    let order = sort_order.map(str::trim);
    if order == Some("manual") {
        return ("pic_sort", false);
    }
    let field = sort_field.map(str::trim).filter(|f| !f.is_empty());
    let column = match field {
        Some("addTime") | Some("add_time") => "add_time",
        Some("picName") | Some("pic_name") => "pic_name",
        Some("picSize") | Some("pic_size") => "pic_size",
        Some("picWidth") | Some("pic_width") => "pic_width",
        Some("picHeight") | Some("pic_height") => "pic_height",
        Some("picSort") | Some("pic_sort") => "pic_sort",
        Some("picId") | Some("pic_id") => "pic_id",
        Some("galleryId") | Some("gallery_id") => "gallery_id",
        Some("fileType") | Some("file_type") => "file_type",
        _ => "add_time",
    };
    (column, order == Some("desc"))
}

/// `updateField` 属性名/列名 → 列名（Java `getColumnByPropertyName` + 白名单）。
#[must_use]
pub fn resolve_gallery_pic_field(field: &str) -> Option<&'static str> {
    match field.trim() {
        "picName" | "pic_name" => Some("pic_name"),
        _ => None,
    }
}

/// 提取 URL 扩展名（Java `extractExtension`：去 query/hash，取最后一个 `.` 后小写）。
#[must_use]
pub fn extract_extension(url: &str) -> String {
    if url.trim().is_empty() {
        return String::new();
    }
    let mut path = url;
    if let Some(index) = url.find('?') {
        if index > 0 {
            path = &url[..index];
        }
    }
    if let Some(index) = path.find('#') {
        if index > 0 {
            path = &path[..index];
        }
    }
    match path.rfind('.') {
        Some(index) if index > 0 && index < path.len() - 1 => path[index + 1..].to_lowercase(),
        _ => String::new(),
    }
}

/// 外部直链校验（Java `validateExternalUrl`，文案逐字）。
///
/// 返回小写扩展名。
///
/// # Errors
/// 返回错误文案（与 Java `GlobalException` 一致）。
pub fn validate_external_url(url: &str, allowed_extensions: &[&str]) -> Result<String, String> {
    let url = url.trim();
    if url.is_empty() {
        return Err(ERR_URL_EMPTY.to_string());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(ERR_URL_SCHEME.to_string());
    }
    for pattern in BLOCKED_URL_PATTERNS {
        if url.contains(pattern) {
            return Err(ERR_URL_BLOCKED.to_string());
        }
    }
    let ext = extract_extension(url);
    if ext.is_empty() || !allowed_extensions.iter().any(|a| *a == ext) {
        return Err(format!(
            "不支持的文件格式，允许的格式: {}",
            allowed_extensions.join(", ")
        ));
    }
    Ok(ext)
}

/// 上传文件本地校验（Java `filterImageType` + `filterImageSize`）：
/// 类型必须在 [`ALLOWED_IMAGE_TYPES`]，大小不超过配置上限（MB）。
///
/// # Errors
/// 返回 `(业务码, 文案)`：类型/空文件为 `1001`，尺寸超限为 `1001`（Java `SERVICE_DATA_ERROR`）。
pub fn validate_upload_file(
    content_type: Option<&str>,
    size: u64,
    max_size_mb: &str,
) -> Result<(), (i32, String)> {
    if size == 0 {
        return Err((1001, ERR_UPLOAD_FILE_EMPTY.to_string()));
    }
    let allowed = content_type.is_some_and(|ct| ALLOWED_IMAGE_TYPES.contains(&ct));
    if !allowed {
        return Err((1001, ERR_UPLOAD_FILE_TYPE.to_string()));
    }
    let max_mb = parse_max_size_mb(max_size_mb);
    let max_bytes = max_mb * 1024.0 * 1024.0;
    if size as f64 > max_bytes {
        return Err((
            1001,
            format!("图片大小不能超过{}MB", format_max_size(max_mb)),
        ));
    }
    Ok(())
}

/// 解析配置的最大图片尺寸（MB）；缺失/非法/非正 → 默认 20。
#[must_use]
pub fn parse_max_size_mb(raw: &str) -> f64 {
    raw.trim()
        .parse::<f64>()
        .ok()
        .filter(|value| *value > 0.0)
        .unwrap_or(20.0)
}

/// 尺寸文案（Java `BigDecimal.stripTrailingZeros().toPlainString()`）：`20.0` → `"20"`。
#[must_use]
pub fn format_max_size(value: f64) -> String {
    if (value.fract()).abs() < f64::EPSILON {
        format!("{}", value as i64)
    } else {
        let text = format!("{value}");
        text.trim_end_matches('0').trim_end_matches('.').to_string()
    }
}

/// 素材类型是否为视频（Java `"video".equals(type)`）。
#[must_use]
pub fn is_video_type(type_: Option<&str>) -> bool {
    type_ == Some("video")
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 相册图片列表查询（Java `GalleryPicListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicListQuery {
    /// 相册 id；不传/为 0 表示全部（含未归组）
    pub gallery_id: Option<i32>,
    /// 格式筛选（jpg/png/webp…）
    pub format: Option<String>,
    /// 来源筛选：local/upload/external
    pub source: Option<String>,
    /// 关键词（`pic_name LIKE`）
    pub keyword: Option<String>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    /// `manual` 表示按 `pic_sort` 升序
    pub sort_order: Option<String>,
}

impl GalleryPicListQuery {
    /// 分页换算（Java `BasePage`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        page_query(self.page, self.size)
    }

    /// 生效的相册过滤：`galleryId > 0` 才按「自身及子孙」过滤。
    #[must_use]
    pub fn gallery_filter(&self) -> Option<i32> {
        self.gallery_id.filter(|id| *id > 0)
    }

    /// 有效关键词（Java `StrUtil.isNotBlank`，LIKE 用原始值不 trim）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|kw| !kw.trim().is_empty())
    }

    /// 有效格式（Java `isNotBlank(format)`）。
    #[must_use]
    pub fn effective_format(&self) -> Option<&str> {
        self.format.as_deref().filter(|f| !f.trim().is_empty())
    }
}

/// 图片手动排序（Java `GalleryPicSortDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicSortDTO {
    /// 当前分组 id（@NotNull 分组ID不能为空）
    pub gallery_id: Option<i32>,
    /// 排序后的 picId 列表（@NotEmpty）
    pub ids: Option<Vec<i32>>,
}

/// 批量移动素材（Java `GalleryPicTransferDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicTransferDTO {
    pub ids: Option<Vec<i32>>,
    pub target_gallery_id: Option<i32>,
    /// image / video
    pub r#type: Option<String>,
}

/// 批量删除/下载素材（Java `GalleryPicBatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicBatchDTO {
    pub ids: Option<Vec<i32>>,
    /// image / video
    pub r#type: Option<String>,
}

/// 外部直链创建图片（Java `GalleryPicExternalDTO`，字段均必填）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicExternalDTO {
    pub pic_url: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_name: Option<String>,
    pub gallery_id: Option<i32>,
    pub source: Option<String>,
}

/// 通用操作（Java `OperateDTO`，`del` 只用 `id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 更新字段（Java `UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: i32,
    pub field: String,
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_stringish")]
    pub val: String,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 相册图片 DTO（Java `GalleryPicDTO`；`shopId` 恒 null，见模块注释）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicDTO {
    pub pic_id: i32,
    /// Java DTO 为 String 而实体 Integer → BeanUtils 不复制 → 恒 null
    pub shop_id: Option<String>,
    pub gallery_id: i32,
    pub pic_ower_id: i32,
    pub pic_url: String,
    pub pic_name: String,
    pub pic_thumb: String,
    pub add_time: String,
    pub file_type: Option<String>,
    pub pic_width: Option<i32>,
    pub pic_height: Option<i32>,
    pub pic_size: Option<i64>,
}

/// 子相册预览（Java `GalleryPicResDTO extends GalleryDTO` + `galleryPics`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryPicResVO {
    /// 嵌套相册字段（flatten 后与原 GalleryDTO JSON 同级）
    #[serde(flatten)]
    pub gallery: GalleryDTO,
    /// 该相册前 4 张图片
    pub gallery_pics: Vec<GalleryPicDTO>,
}

/// 相册图片列表返回（Java `GalleryListResVO`）。
///
/// `PageResult` 没有实现 `Default`，故这里手写 `Default` 而不是 derive。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryListResVO {
    pub child_gallery_list: Vec<GalleryPicResVO>,
    pub gallery_pic_page: crate::types::PageResult<GalleryPicDTO>,
    pub gallery_info: Option<GalleryDTO>,
}

impl Default for GalleryListResVO {
    fn default() -> Self {
        Self {
            child_gallery_list: Vec::new(),
            gallery_pic_page: crate::types::PageResult {
                total: 0,
                list: Vec::new(),
                total_page: 0,
                page_size: 0,
                page: 0,
            },
            gallery_info: None,
        }
    }
}

/// 上传/外部创建返回（Java `GalleryPicUploadVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicUploadVO {
    pub pic_thumb: String,
    pub pic_url: String,
    pub pic_name: String,
    pub pic_id: i32,
    pub pic_width: Option<i32>,
    pub pic_height: Option<i32>,
    pub pic_size: Option<i64>,
    pub gallery_id: i32,
    pub file_type: Option<String>,
}

impl From<&crate::entities::GalleryPic> for GalleryPicDTO {
    fn from(pic: &crate::entities::GalleryPic) -> Self {
        Self {
            pic_id: pic.pic_id,
            // Java String/Integer 不兼容 → BeanUtils 不复制
            shop_id: None,
            gallery_id: pic.gallery_id,
            pic_ower_id: pic.pic_ower_id,
            pic_url: pic.pic_url.clone(),
            pic_name: pic.pic_name.clone(),
            pic_thumb: pic.pic_thumb.clone(),
            add_time: pic.add_time.clone(),
            file_type: pic.file_type.clone(),
            pic_width: pic.pic_width,
            pic_height: pic.pic_height,
            pic_size: pic.pic_size,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_url_validation_matches_java() {
        assert_eq!(
            validate_external_url("", &ALLOWED_IMAGE_EXTENSIONS).unwrap_err(),
            ERR_URL_EMPTY
        );
        assert_eq!(
            validate_external_url("ftp://a/b.jpg", &ALLOWED_IMAGE_EXTENSIONS).unwrap_err(),
            ERR_URL_SCHEME
        );
        assert_eq!(
            validate_external_url(
                "https://image.baidu.com/search/index?tn=baiduimage",
                &ALLOWED_IMAGE_EXTENSIONS
            )
            .unwrap_err(),
            ERR_URL_BLOCKED
        );
        assert!(validate_external_url(
            "https://image.baidu.com/search/photo.jpg",
            &ALLOWED_IMAGE_EXTENSIONS
        )
        .is_err());
        assert_eq!(
            validate_external_url("https://cdn.x.com/a.webp?x=1", &ALLOWED_IMAGE_EXTENSIONS)
                .unwrap_err(),
            "不支持的文件格式，允许的格式: bmp, jpg, jpeg, png, gif"
        );
        assert_eq!(
            validate_external_url("https://cdn.x.com/a.PNG?x=1#f", &ALLOWED_IMAGE_EXTENSIONS)
                .unwrap(),
            "png"
        );
    }

    #[test]
    fn extension_and_source_and_sort_helpers() {
        assert_eq!(extract_extension("https://a/b/c.tar.gz?q=1"), "gz");
        assert_eq!(extract_extension("noext"), "");
        assert_eq!(extract_extension(""), "");
        assert_eq!(normalize_source_filter(Some("external")), Some("external"));
        assert_eq!(normalize_source_filter(Some(" LOCAL ")), Some("upload"));
        assert_eq!(normalize_source_filter(Some("other")), None);
        assert_eq!(normalize_source_filter(None), None);
        assert_eq!(resolve_sort(None, Some("manual")), ("pic_sort", false));
        assert_eq!(resolve_sort(None, Some("desc")), ("add_time", true));
        assert_eq!(resolve_sort(Some("picSize"), None), ("pic_size", false));
        assert_eq!(resolve_sort(Some("bad;drop"), None), ("add_time", false));
        assert_eq!(resolve_gallery_pic_field("picName"), Some("pic_name"));
        assert_eq!(resolve_gallery_pic_field("source"), None);
    }

    #[test]
    fn upload_validation_matches_java() {
        assert_eq!(
            validate_upload_file(Some("image/png"), 0, "20")
                .unwrap_err()
                .1,
            ERR_UPLOAD_FILE_EMPTY
        );
        assert_eq!(
            validate_upload_file(Some("text/plain"), 100, "20")
                .unwrap_err()
                .1,
            ERR_UPLOAD_FILE_TYPE
        );
        assert!(validate_upload_file(Some("image/png"), 1024, "20").is_ok());
        // 超限：20MB 配置
        assert_eq!(
            validate_upload_file(Some("image/jpeg"), 21 * 1024 * 1024, "20")
                .unwrap_err()
                .1,
            "图片大小不能超过20MB"
        );
        assert_eq!(parse_max_size_mb("bad"), 20.0);
        assert_eq!(parse_max_size_mb("2.5"), 2.5);
        assert_eq!(format_max_size(20.0), "20");
        assert_eq!(format_max_size(2.5), "2.5");
    }

    #[test]
    fn query_helpers_match_base_page() {
        let q = GalleryPicListQuery {
            page: Some(2),
            size: Some(500),
            gallery_id: Some(0),
            keyword: Some("  ".into()),
            ..Default::default()
        };
        let page = q.page_query();
        assert_eq!(page.page, 2);
        assert_eq!(page.page_size, 100);
        assert_eq!(q.gallery_filter(), None);
        assert_eq!(q.effective_keyword(), None);
        let q = GalleryPicListQuery {
            gallery_id: Some(3),
            keyword: Some("图".into()),
            ..Default::default()
        };
        assert_eq!(q.gallery_filter(), Some(3));
        assert_eq!(q.effective_keyword(), Some("图"));
        assert!(is_video_type(Some("video")));
        assert!(!is_video_type(Some("image")));
        assert!(!is_video_type(None));
    }

    #[test]
    fn dto_and_vo_serialize_camel_case() {
        let pic = crate::entities::GalleryPic {
            pic_id: 1,
            shop_id: 0,
            gallery_id: 2,
            pic_ower_id: 3,
            pic_url: "https://x/a.jpg".into(),
            pic_name: "a".into(),
            pic_thumb: "t".into(),
            add_time: "1700000000".into(),
            vendor_id: 0,
            hidden: None,
            pic_width: Some(1),
            pic_height: Some(2),
            pic_size: Some(3),
            file_type: Some("jpg".into()),
            pic_sort: None,
            source: "external".into(),
        };
        let dto = GalleryPicDTO::from(&pic);
        assert_eq!(dto.shop_id, None);
        let value = serde_json::to_value(&dto).unwrap();
        assert_eq!(value["picId"], 1);
        assert_eq!(value["galleryId"], 2);
        assert_eq!(value["picOwerId"], 3);
        assert!(value["shopId"].is_null());

        let vo = GalleryPicUploadVO {
            pic_id: 5,
            pic_url: "u".into(),
            pic_name: "n".into(),
            gallery_id: 9,
            ..Default::default()
        };
        let value = serde_json::to_value(&vo).unwrap();
        assert_eq!(value["picId"], 5);
        assert_eq!(value["galleryId"], 9);
    }
}
