//! 视频相册信息（content::gallery_video_info）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.GalleryVideoInfoController`
//!   （`@RequestMapping("/adminapi/setting/galleryVideoInfo")`，6 个端点）
//! - 服务 `GalleryVideoInfoServiceImpl`
//! - 入参 `GalleryVideoInfoDTO` / `GalleryVideoInfoListDTO` + 公共 `OperateDTO`
//! - 出参 `GalleryVideoInfoVO` / `GalleryVideoInfoDetailVO` / `GalleryVideoResDTO`
//!   / `UploadVideoInfoVO`
//! - 表 `gallery_video_info`（实体 [`crate::entities::GalleryVideoInfo`]），
//!   列表附带 `gallery_video` 子相册与视频
//!
//! # 端点（6，全部 admin）
//! `GET /adminapi/setting/galleryVideoInfo/{list,detail}`、
//! `POST /adminapi/setting/galleryVideoInfo/{del,uploadVideo,create,update}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`uploadVideo` 未迁移**：Java 依赖对象存储（本地/OSS/COS/七牛/S3）上传 +
//!    FFmpeg 首帧封面提取（`FFmpegFrameGrabber`）；本实现完成本地文件校验
//!    （空文件 / 扩展名 / content-type）后返回明确「未迁移」业务错误，不伪造地址。
//! 2. 列表 `Page<GalleryVideoInfo>` 以 [`crate::types::PageResult`] 表达
//!    （字段 `total/list/total_page/page_size/page`，与 Java Page 的
//!    `records/total/size/current` 命名不同，项目统一约定）。
//! 3. 实体 JSON 字段一律转 camelCase 输出（Java Jackson 同义）。
//! 4. `childGalleryList` 与「每相册前 4 条视频」Java 未显式 `ORDER BY`，
//!    本实现按 `id ASC` 稳定输出（差异 1 的形式化）。
//! 5. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

use crate::entities::{GalleryVideo, GalleryVideoInfo};
use crate::types::{PageQuery, PageResult};

/// Java `GalleryVideoInfoDTO.videoUrl` 的 `@NotBlank`。
pub const MSG_VIDEO_URL_REQUIRED: &str = "视频地址不能为空";
/// Java `GalleryVideoInfoDTO.videoName` 的 `@NotBlank`。
pub const MSG_VIDEO_NAME_REQUIRED: &str = "视频名称不能为空";
/// Java `GalleryVideoInfoServiceImpl#detail` 的缺行文案。
pub const MSG_VIDEO_INFO_NOT_FOUND: &str = "系统未找到视频信息";
/// Java `OperateDTO` 的 `id` 校验文案（项目统一）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// Java `ExceptionConstants.UPLOAD_FILE_IS_NULL`。
pub const MSG_FILE_EMPTY: &str = "文件不能为空";
/// Java `ExceptionConstants.UPLOAD_FILE_TYPE_ERROR`。
pub const MSG_FILE_TYPE: &str = "不支持的文件类型";
/// Java `ExceptionConstants.VIDEO_CODEC_NOT_SUPPORTED`（保留文案，上传未迁移时不用）。
pub const MSG_CODEC_NOT_SUPPORTED: &str = "该视频的编码格式不支持，请重新上传视频";
/// 外链视频 URL 为空（Java `validateExternalVideoUrl`）。
pub const MSG_EXTERNAL_URL_REQUIRED: &str = "视频URL不能为空";
/// 外链视频协议非法（Java `validateExternalVideoUrl`）。
pub const MSG_EXTERNAL_URL_SCHEME: &str = "URL必须以http://或https://开头";
/// 外链为搜索结果页（Java `validateExternalVideoUrl`）。
pub const MSG_EXTERNAL_URL_BLOCKED: &str = "不支持网页搜索结果地址，请提供视频直链";
/// 外链扩展名非法（Java 文案 + `String.join(", ", ALLOWED_VIDEO_EXTENSIONS)`）。
pub const MSG_EXTERNAL_URL_EXT: &str = "不支持的视频格式，允许的格式: mp4, flv, webm, avi";
/// `uploadVideo` 未迁移业务错误。
pub const MSG_UPLOAD_NOT_MIGRATED: &str =
    "视频上传依赖对象存储（本地/OSS/COS/七牛/S3）与 FFmpeg 首帧封面提取，当前 Rust 侧尚未迁移，请改用「外链视频」方式录入";

/// 外链视频允许的扩展名（Java `ALLOWED_VIDEO_EXTENSIONS`）。
pub const ALLOWED_VIDEO_EXTENSIONS: [&str; 4] = ["mp4", "flv", "webm", "avi"];
/// 本地上传仅允许 mp4（Java `ALLOWED_UPLOAD_VIDEO_EXTENSIONS`）。
pub const ALLOWED_UPLOAD_VIDEO_EXTENSIONS: [&str; 1] = ["mp4"];
/// 本地上传允许的 content-type（Java `ALLOWED_UPLOAD_VIDEO_CONTENT_TYPES`）。
pub const ALLOWED_UPLOAD_CONTENT_TYPES: [&str; 2] = ["video/mp4", "application/octet-stream"];
/// 外链黑名单（Java `BLOCKED_URL_PATTERNS`）。
pub const BLOCKED_URL_PATTERNS: [&str; 5] = [
    "baidu.com/s?",
    "image.baidu.com/search",
    "google.com/search",
    "bing.com/images/search",
    "sogou.com/pics",
];

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 视频信息创建/更新入参（Java `GalleryVideoInfoDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryVideoInfoDTO {
    /// 主键（更新时必填）。
    pub id: Option<i32>,
    /// 相册 ID 级联列表（Java `List<Integer>`，取最后一个 >0 的）。
    pub gallery_id: Vec<i32>,
    /// 视频地址（`@NotBlank(message = 视频地址不能为空)`）。
    pub video_url: Option<String>,
    /// 视频名称（`@NotBlank(message = 视频名称不能为空)`）。
    pub video_name: Option<String>,
    /// 视频封面。
    pub video_cover: Option<String>,
    /// 视频简介。
    pub description: Option<String>,
    /// 视频格式后缀。
    pub format: Option<String>,
    /// 视频封面（第一帧）。
    pub video_first_frame: Option<String>,
    /// 时长。
    pub duration: Option<String>,
    /// 大小。
    pub size: Option<String>,
    /// 来源：upload / external。
    pub source: Option<String>,
}

impl GalleryVideoInfoDTO {
    /// Java `resolveGalleryId`：取 `galleryId` 中最后一个 `> 0` 的值，否则 0。
    #[must_use]
    pub fn resolve_gallery_id(&self) -> i32 {
        self.gallery_id
            .iter()
            .rev()
            .copied()
            .find(|id| *id > 0)
            .unwrap_or(0)
    }
}

/// 列表查询参数（Java `GalleryVideoInfoListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryVideoInfoListQuery {
    /// 页码。
    pub page: Option<u64>,
    /// 页大小。
    pub size: Option<u64>,
    /// 排序字段（Java 本接口未使用，固定 id 降序）。
    pub sort_field: Option<String>,
    /// 排序方向（同上，忽略）。
    pub sort_order: Option<String>,
    /// 名称关键字（`video_name LIKE`）。
    pub keyword: Option<String>,
    /// 相册 ID 过滤（`> 0` 时含该相册及全部子孙相册）。
    pub id: Option<i32>,
    /// 格式过滤（精确）。
    pub format: Option<String>,
    /// 来源过滤（external 精确；local 匹配非 external，兼容历史空值）。
    pub source: Option<String>,
}

impl GalleryVideoInfoListQuery {
    /// 归一化分页（Java `BasePage`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// 是否按相册子树过滤。
    #[must_use]
    pub fn gallery_filter(&self) -> Option<i32> {
        self.id.filter(|id| *id > 0)
    }
}

/// 删除入参（Java 公共 `OperateDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 备注（未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（未使用）。
    pub page_type: Option<i32>,
}

/// 视频信息详情 VO（Java `GalleryVideoInfoDetailVO`）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoInfoDetailVO {
    /// 主键。
    pub id: i32,
    /// 相册 ID。
    pub gallery_id: i32,
    /// 视频地址。
    pub video_url: String,
    /// 视频名称。
    pub video_name: String,
    /// 视频封面。
    pub video_cover: Option<String>,
    /// 视频简介。
    pub description: Option<String>,
    /// 视频格式后缀。
    pub format: Option<String>,
    /// 时长。
    pub duration: Option<String>,
    /// 大小。
    pub size: Option<String>,
    /// 添加时间（unix 秒，Java `Long`）。
    pub add_time: i64,
}

/// 列表行 VO（Java 直接返回 `GalleryVideoInfo` 实体，本实现显式 camelCase VO）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoInfoItemVO {
    /// 主键。
    pub id: i32,
    /// 商户 ID。
    pub shop_id: i32,
    /// 相册 ID。
    pub gallery_id: i32,
    /// 视频地址。
    pub video_url: String,
    /// 视频名称。
    pub video_name: String,
    /// 视频封面。
    pub video_cover: Option<String>,
    /// 添加时间（unix 秒）。
    pub add_time: i32,
    /// 创建人 ID。
    pub add_user_id: i32,
    /// 视频格式后缀。
    pub format: Option<String>,
    /// 视频封面（第一帧）。
    pub video_first_frame: Option<String>,
    /// 时长。
    pub duration: Option<String>,
    /// 大小。
    pub size: Option<String>,
    /// 供应商 ID。
    pub vendor_id: i32,
    /// 来源。
    pub source: String,
    /// 视频简介。
    pub description: Option<String>,
}

impl From<&GalleryVideoInfo> for GalleryVideoInfoItemVO {
    fn from(e: &GalleryVideoInfo) -> Self {
        Self {
            id: e.id,
            shop_id: e.shop_id,
            gallery_id: e.gallery_id,
            video_url: e.video_url.clone(),
            video_name: e.video_name.clone(),
            video_cover: e.video_cover.clone(),
            add_time: e.add_time,
            add_user_id: e.add_user_id,
            format: e.format.clone(),
            video_first_frame: e.video_first_frame.clone(),
            duration: e.duration.clone(),
            size: e.size.clone(),
            vendor_id: e.vendor_id,
            source: e.source.clone(),
            description: e.description.clone(),
        }
    }
}

/// 相册行 VO（Java `GalleryVideoResDTO extends GalleryVideo` 的父字段）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoResVO {
    /// 主键。
    pub id: i32,
    /// 商户 ID。
    pub shop_id: i32,
    /// 父级 ID。
    pub parent_id: i32,
    /// 名称。
    pub name: String,
    /// 排序。
    pub sort: i32,
    /// 添加时间（unix 秒）。
    pub add_time: i32,
    /// 创建人 ID。
    pub add_user_id: i32,
    /// 供应商 ID。
    pub vendor_id: i32,
    /// 该相册下前 4 条视频（Java `limit 4`）。
    pub gallery_video_info_list: Vec<GalleryVideoInfoItemVO>,
}

impl From<&GalleryVideo> for GalleryVideoResVO {
    fn from(e: &GalleryVideo) -> Self {
        Self {
            id: e.id,
            shop_id: e.shop_id,
            parent_id: e.parent_id,
            name: e.name.clone(),
            sort: e.sort,
            add_time: e.add_time,
            add_user_id: e.add_user_id,
            vendor_id: e.vendor_id,
            gallery_video_info_list: Vec::new(),
        }
    }
}

/// 列表聚合 VO（Java `GalleryVideoInfoVO`）。
///
/// `PageResult` 没有 `Default`，故手写 `Default`。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoInfoVO {
    /// 当前相册的直接子相册（含各自前 4 条视频）。
    pub child_gallery_list: Vec<GalleryVideoResVO>,
    /// 视频信息分页。
    pub gallery_video_info_page: PageResult<GalleryVideoInfoItemVO>,
    /// 当前相册（Java `GalleryVideo` 实体；`id` 为 0/缺省时 `null`）。
    pub gallery_video: Option<GalleryVideoResVO>,
}

impl Default for GalleryVideoInfoVO {
    fn default() -> Self {
        Self {
            child_gallery_list: Vec::new(),
            gallery_video_info_page: PageResult {
                total: 0,
                list: Vec::new(),
                total_page: 0,
                page_size: 0,
                page: 0,
            },
            gallery_video: None,
        }
    }
}

/// 上传视频返回 VO（Java `UploadVideoInfoVO`）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadVideoInfoVO {
    /// 视频地址。
    pub video_url: String,
    /// 视频名称。
    pub video_name: String,
    /// 格式后缀。
    pub format: String,
    /// 首帧封面地址。
    pub video_cover: String,
}

/// 校验创建/更新入参的必填项（Java `@Valid`）。
///
/// # Errors
/// - `videoUrl` 空白 → 「视频地址不能为空」
/// - `videoName` 空白 → 「视频名称不能为空」
pub fn validate_required(dto: &GalleryVideoInfoDTO) -> Result<(String, String), String> {
    let url = dto
        .video_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_VIDEO_URL_REQUIRED.to_string())?;
    let name = dto
        .video_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_VIDEO_NAME_REQUIRED.to_string())?;
    Ok((url.to_string(), name.to_string()))
}

/// 外链视频 URL 校验（Java `validateExternalVideoUrl`，仅 `source == "external"` 时调用）。
///
/// # Errors
/// 空 / 非 http(s) / 搜索结果页 / 扩展名非法 → 对应逐字文案。
pub fn validate_external_video_url(url: Option<&str>) -> Result<(), String> {
    let url = url.map(str::trim).unwrap_or("");
    if url.is_empty() {
        return Err(MSG_EXTERNAL_URL_REQUIRED.to_string());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(MSG_EXTERNAL_URL_SCHEME.to_string());
    }
    if BLOCKED_URL_PATTERNS.iter().any(|p| url.contains(p)) {
        return Err(MSG_EXTERNAL_URL_BLOCKED.to_string());
    }
    let ext = extract_extension(Some(url));
    if ext.is_empty() || !ALLOWED_VIDEO_EXTENSIONS.contains(&ext.as_str()) {
        return Err(MSG_EXTERNAL_URL_EXT.to_string());
    }
    Ok(())
}

/// 取扩展名（Java `extractExtension`：去掉 `?` / `#` 后取最后一个 `.` 之后，转小写）。
#[must_use]
pub fn extract_extension(name: Option<&str>) -> String {
    let Some(name) = name else {
        return String::new();
    };
    let path = name.split(['?', '#']).next().unwrap_or("");
    match path.rfind('.') {
        Some(idx) if idx > 0 && idx + 1 < path.len() => path[idx + 1..].to_lowercase(),
        _ => String::new(),
    }
}

/// 本地上传文件类型校验（Java `filterVideoType`）。
///
/// # Errors
/// 空文件 → 「文件不能为空」；扩展名 / content-type 非法 → 「不支持的文件类型」。
pub fn validate_upload_file(
    file_name: Option<&str>,
    content_type: Option<&str>,
) -> Result<(), String> {
    let name = file_name.map(str::trim).unwrap_or("");
    if name.is_empty() {
        return Err(MSG_FILE_EMPTY.to_string());
    }
    let ext = extract_extension(Some(name));
    if !ALLOWED_UPLOAD_VIDEO_EXTENSIONS.contains(&ext.as_str()) {
        return Err(MSG_FILE_TYPE.to_string());
    }
    if let Some(ct) = content_type.map(str::trim).filter(|s| !s.is_empty()) {
        if !ALLOWED_UPLOAD_CONTENT_TYPES.contains(&ct.to_lowercase().as_str()) {
            return Err(MSG_FILE_TYPE.to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_gallery_id_matches_java() {
        let mut dto = GalleryVideoInfoDTO::default();
        assert_eq!(dto.resolve_gallery_id(), 0);
        dto.gallery_id = vec![3, 7, 0, 2];
        assert_eq!(dto.resolve_gallery_id(), 2);
        dto.gallery_id = vec![0, 0];
        assert_eq!(dto.resolve_gallery_id(), 0);
    }

    #[test]
    fn required_validation_messages() {
        assert_eq!(
            validate_required(&GalleryVideoInfoDTO::default()).unwrap_err(),
            MSG_VIDEO_URL_REQUIRED
        );
        let dto = GalleryVideoInfoDTO {
            video_url: Some(" https://a.com/v.mp4 ".into()),
            video_name: None,
            ..Default::default()
        };
        assert_eq!(
            validate_required(&dto).unwrap_err(),
            MSG_VIDEO_NAME_REQUIRED
        );
        let dto = GalleryVideoInfoDTO {
            video_url: Some(" https://a.com/v.mp4 ".into()),
            video_name: Some(" 宣传 ".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_required(&dto).unwrap(),
            ("https://a.com/v.mp4".to_string(), "宣传".to_string())
        );
    }

    #[test]
    fn external_url_validation_matches_java() {
        assert_eq!(
            validate_external_video_url(None).unwrap_err(),
            MSG_EXTERNAL_URL_REQUIRED
        );
        assert_eq!(
            validate_external_video_url(Some("ftp://a.com/v.mp4")).unwrap_err(),
            MSG_EXTERNAL_URL_SCHEME
        );
        assert_eq!(
            validate_external_video_url(Some("https://www.baidu.com/s?wd=mp4")).unwrap_err(),
            MSG_EXTERNAL_URL_BLOCKED
        );
        assert_eq!(
            validate_external_video_url(Some("https://a.com/v.m3u8")).unwrap_err(),
            MSG_EXTERNAL_URL_EXT
        );
        assert!(validate_external_video_url(Some("https://cdn.a.com/v.MP4?sign=1#t=1")).is_ok());
    }

    #[test]
    fn extract_extension_handles_query_hash_and_case() {
        assert_eq!(extract_extension(None), "");
        assert_eq!(extract_extension(Some("a.mp4?x=1")), "mp4");
        assert_eq!(extract_extension(Some("a/b/c.FLV#t")), "flv");
        assert_eq!(extract_extension(Some("a")), "");
        assert_eq!(extract_extension(Some(".mp4")), "");
    }

    #[test]
    fn upload_file_validation_matches_java() {
        assert_eq!(
            validate_upload_file(None, None).unwrap_err(),
            MSG_FILE_EMPTY
        );
        assert_eq!(
            validate_upload_file(Some("a.mov"), Some("video/mp4")).unwrap_err(),
            MSG_FILE_TYPE
        );
        assert_eq!(
            validate_upload_file(Some("a.mp4"), Some("text/plain")).unwrap_err(),
            MSG_FILE_TYPE
        );
        assert!(validate_upload_file(Some("a.MP4"), Some("video/mp4")).is_ok());
        assert!(validate_upload_file(Some("a.mp4"), Some("application/octet-stream")).is_ok());
        assert!(validate_upload_file(Some("a.mp4"), None).is_ok());
    }

    #[test]
    fn list_query_defaults_and_gallery_filter() {
        let q: GalleryVideoInfoListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.gallery_filter(), None);
        let q: GalleryVideoInfoListQuery =
            serde_json::from_value(serde_json::json!({"id": 5, "size": 999})).unwrap();
        assert_eq!(q.gallery_filter(), Some(5));
        assert_eq!(q.page_query().page_size, 100);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = GalleryVideoInfoDetailVO {
            id: 1,
            gallery_id: 2,
            video_url: "https://a.com/v.mp4".into(),
            video_name: "宣传".into(),
            add_time: 1_700_000_000,
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["galleryId"], 2);
        assert_eq!(json["videoUrl"], "https://a.com/v.mp4");
        assert_eq!(json["videoName"], "宣传");
        assert_eq!(json["addTime"], 1_700_000_000);
        assert!(json["videoCover"].is_null());
    }
}
