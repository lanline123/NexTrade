//! 视频号账号（content::wechat_video_account）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.content.WechatVideoAccountController`
//!   （`@RequestMapping("/adminapi/content/wechatVideoAccount")`，5 个端点）
//! - 服务 `WechatVideoAccountServiceImpl`
//! - 入参 `WechatVideoAccountCreateDTO` / `UpdateDTO` / `ListDTO`
//! - 出参 `WechatVideoAccountVO`；表 `wechat_video_account`
//!   （实体 [`crate::entities::WechatVideoAccount`]）
//!
//! # 端点（5，全部 admin）
//! `GET /adminapi/content/wechatVideoAccount/{list,detail}`、
//! `POST /adminapi/content/wechatVideoAccount/{create,update,delete}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. 列表分页以 [`crate::types::PageResult`] 表达（字段命名与 Java Page 不同，
//!    项目统一约定）。
//! 2. `relationTime` 与 Java `formatTimestamp` 一致：`null`/`<=0` → `""`，
//!    否则 `yyyy-MM-dd HH:mm:ss`（东八区）。
//! 3. `relationTimeStart/End` 解析：兼容 `yyyy-MM-dd` 与 `yyyy-MM-dd HH:mm:ss`；
//!    结束日期为纯日期时取当天 23:59:59（Java `getEndOfDayTimestamp` 同义）。
//! 4. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

use serde::{Deserialize, Serialize};

use crate::types::{PageQuery, PageResult};

/// Java `VIDEO_ACCOUNT_ID_NOT_NULL`。
pub const MSG_ID_REQUIRED: &str = "视频号账号ID不能为空";
/// Java `VIDEO_ACCOUNT_NOT_EXISTS`。
pub const MSG_NOT_FOUND: &str = "视频号账号不存在";
/// Java `VIDEO_ACCOUNT_FINDER_ID_NOT_BLANK`。
pub const MSG_FINDER_ID_REQUIRED: &str = "视频号ID不能为空";
/// Java `VIDEO_ACCOUNT_FINDER_ID_MAX_LENGTH`。
pub const MSG_FINDER_ID_MAX_LENGTH: &str = "视频号ID长度不能超过64";
/// Java `VIDEO_ACCOUNT_FINDER_ID_EXISTS`。
pub const MSG_FINDER_ID_EXISTS: &str = "该视频号ID已关联";

/// 视频号 ID 最大长度（Java `@Size(max = 64)`）。
pub const FINDER_ID_MAX_LEN: usize = 64;
/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `wechat_video_account` 可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 5] = ["id", "finder_id", "add_time", "update_time", "shop_id"];

/// 属性名 → 列名（Java `getColumnByPropertyName`；未知回退主键）。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "id" => "id",
        "finderId" | "finder_id" => "finder_id",
        "addTime" | "add_time" => "add_time",
        "updateTime" | "update_time" => "update_time",
        "shopId" | "shop_id" => "shop_id",
        _ => "id",
    }
}

/// 列表排序（Java `buildSortOrder`；缺省主键降序）。
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let column = match sort_field.map(str::trim).filter(|s| !s.is_empty()) {
        None => "id",
        Some(f) => normalize_column(f),
    };
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    (column, desc)
}

/// 列表查询参数（Java `WechatVideoAccountListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatVideoAccountListQuery {
    /// 页码。
    pub page: Option<u64>,
    /// 页大小。
    pub size: Option<u64>,
    /// 排序字段。
    pub sort_field: Option<String>,
    /// 排序方向。
    pub sort_order: Option<String>,
    /// 关键字（Java `BasePage.keyword`；服务未使用）。
    pub keyword: Option<String>,
    /// 视频号 ID（LIKE 过滤）。
    pub finder_id: Option<String>,
    /// 关联开始时间（`yyyy-MM-dd` 或 `yyyy-MM-dd HH:mm:ss`）。
    pub relation_time_start: Option<String>,
    /// 关联结束时间（同上；纯日期取当天 23:59:59）。
    pub relation_time_end: Option<String>,
}

impl WechatVideoAccountListQuery {
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
}

/// 创建入参（Java `WechatVideoAccountCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatVideoAccountCreateDTO {
    /// 视频号 ID（`@NotBlank(message = 视频号ID不能为空)`）。
    pub finder_id: Option<String>,
}

/// 更新入参（Java `WechatVideoAccountUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatVideoAccountUpdateDTO {
    /// 主键（`@NotNull(message = 视频号账号ID不能为空)`）。
    pub id: Option<i32>,
    /// 视频号 ID。
    pub finder_id: Option<String>,
}

/// 删除入参（Java 公共 `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 备注（未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（未使用）。
    pub page_type: Option<i32>,
}

/// 视频号账号 VO（Java `WechatVideoAccountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatVideoAccountVO {
    /// 主键。
    pub id: i32,
    /// 视频号 ID。
    pub finder_id: String,
    /// 关联时间（`yyyy-MM-dd HH:mm:ss`，`null`/`0` → `""`）。
    pub relation_time: String,
}

/// 时间戳 → `yyyy-MM-dd HH:mm:ss`（东八区；`<= 0` → `""`）。
#[must_use]
pub fn format_timestamp(timestamp: i64) -> String {
    use chrono::TimeZone;
    if timestamp <= 0 {
        return String::new();
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(timestamp, 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// 解析开始时间（Java `StringUtils.dateToTimestampExample`）。
///
/// 支持 `yyyy-MM-dd HH:mm:ss` 与 `yyyy-MM-dd`（当天 00:00:00）。
#[must_use]
pub fn parse_start_time(raw: &str) -> Option<i64> {
    parse_datetime(raw)
}

/// 解析结束时间（Java `parseRelationEndTime`）：纯日期 → 当天 23:59:59。
#[must_use]
pub fn parse_end_time(raw: &str) -> Option<i64> {
    let value = raw.trim();
    if is_date_only(value) {
        return parse_datetime(&format!("{value} 00:00:00")).map(|ts| ts + 86_399);
    }
    parse_datetime(value)
}

/// 是否为纯日期（`yyyy-MM-dd`，Java `\d{4}-\d{2}-\d{2}$`）。
#[must_use]
pub fn is_date_only(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 10
        && b[4] == b'-'
        && b[7] == b'-'
        && b[..4].iter().all(u8::is_ascii_digit)
        && b[5..7].iter().all(u8::is_ascii_digit)
        && b[8..].iter().all(u8::is_ascii_digit)
}

/// 解析 `yyyy-MM-dd HH:mm:ss` / `yyyy-MM-dd`（按东八区解释）→ unix 秒。
fn parse_datetime(raw: &str) -> Option<i64> {
    use chrono::{NaiveDateTime, TimeZone};
    let value = raw.trim();
    let candidate = if is_date_only(value) {
        format!("{value} 00:00:00")
    } else {
        value.to_string()
    };
    let tz = chrono::FixedOffset::east_opt(8 * 3600)?;
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"] {
        if let Ok(dt) = NaiveDateTime::parse_from_str(&candidate, fmt) {
            return tz
                .from_local_datetime(&dt)
                .single()
                .map(|dt| dt.timestamp());
        }
    }
    None
}

/// 校验 finderId（Java `@NotBlank` + `@Size(max=64)`）。
///
/// # Errors
/// - 空白 → 「视频号ID不能为空」
/// - 超长 → 「视频号ID长度不能超过64」
pub fn validate_finder_id(finder_id: Option<&str>) -> Result<String, String> {
    let value = finder_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_FINDER_ID_REQUIRED.to_string())?;
    if value.chars().count() > FINDER_ID_MAX_LEN {
        return Err(MSG_FINDER_ID_MAX_LENGTH.to_string());
    }
    Ok(value.to_string())
}

/// 分页结果别名（便于路由签名可读）。
pub type WechatVideoAccountPage = PageResult<WechatVideoAccountVO>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_parsing_matches_java_range_semantics() {
        let start = parse_start_time("2023-11-15").unwrap();
        assert_eq!(start, 1_699_977_600); // 2023-11-15 00:00:00 +08:00
        let end = parse_end_time("2023-11-15").unwrap();
        assert_eq!(end, start + 86_399);
        assert_eq!(
            parse_start_time("2023-11-15 06:13:20").unwrap(),
            1_700_000_000
        );
        assert_eq!(parse_start_time("bad"), None);
        assert!(is_date_only("2023-11-15"));
        assert!(!is_date_only("2023-11-15 00:00:00"));
    }

    #[test]
    fn format_timestamp_matches_java() {
        assert_eq!(format_timestamp(0), "");
        assert_eq!(format_timestamp(-1), "");
        assert_eq!(format_timestamp(1_700_000_000), "2023-11-15 06:13:20");
    }

    #[test]
    fn finder_id_validation_messages() {
        assert_eq!(
            validate_finder_id(None).unwrap_err(),
            MSG_FINDER_ID_REQUIRED
        );
        assert_eq!(
            validate_finder_id(Some("   ")).unwrap_err(),
            MSG_FINDER_ID_REQUIRED
        );
        assert_eq!(
            validate_finder_id(Some(&"x".repeat(65))).unwrap_err(),
            MSG_FINDER_ID_MAX_LENGTH
        );
        assert_eq!(validate_finder_id(Some(" finder_1 ")).unwrap(), "finder_1");
    }

    #[test]
    fn sort_and_page_defaults() {
        assert_eq!(resolve_sort(None, None), ("id", Some(true)));
        assert_eq!(
            resolve_sort(Some("relationTime"), Some("asc")),
            ("id", Some(false))
        );
        assert_eq!(
            resolve_sort(Some("add_time"), Some("desc")),
            ("add_time", Some(true))
        );
        let q: WechatVideoAccountListQuery =
            serde_json::from_value(serde_json::json!({"page": 2, "size": 500})).unwrap();
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 100);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = WechatVideoAccountVO {
            id: 1,
            finder_id: "finder_1".into(),
            relation_time: "2023-11-15 06:13:20".into(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["finderId"], "finder_1");
        assert_eq!(json["relationTime"], "2023-11-15 06:13:20");
    }
}
