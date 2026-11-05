//! 站内信（C 端）域（member::user_message）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.api.controller.user.UserMessageController`
//!   （`@RequestMapping("/api/user/message/")`，6 个端点，auth=optional）
//! - 服务 `UserMessageServiceImpl`（继承 `BaseServiceImpl`）
//! - 入参 `UserMessageListPageQuery` / `UserMessageUpdateDTO` / 公共 `OperateDTO`
//! - 出参 `UserMessageVO` / `UnreadMessageCountVO`
//! - 表：`user_message`（实体 [`crate::entities::UserMessage`]）
//!
//! # 端点（6）
//! `GET /api/user/message/list`、`POST /api/user/message/{updateAllRead,
//! updateOrderMessageRead,updateMessageRead,del}`、`GET /api/user/message/unreadCount`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`orderInfo` 恒为 `null`**：Java `list` 对 `link.path == "order"` 的通知会
//!    调 `OrderService#detail(orderId, userId)` 组装订单信息，并在订单不可见
//!    （拆单父单已删/`ORDER_SPLIT_ERROR`）时**隐藏该条通知**。该逻辑依赖
//!    trade 订单用例层，本实现保留通知、`orderInfo` 为 `null`（不伪造订单数据）。
//! 2. **`messageTemplate` 翻译未迁移**：Java 用 `TranslatePackage#translate` +
//!    `MessageTemplateUtils.fillMessageTemplate` 重算 `content`；本实现返回
//!    库中原始 `content`。
//! 3. `link` 按 JSON 对象返回（Java `JSONObject`）；解析失败 → `null`。
//! 4. 时间按 UTC+8 格式化（Java 用 JVM 默认时区，生产 `Asia/Shanghai`）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::PageQuery;

/// 消息类型：订单通知（Java `user_message.type = 1`）。
pub const TYPE_ORDER: i64 = 1;

/// Java 控制器匿名访问时的登录校验文案。
pub const MSG_USER_NOT_LOGIN: &str = "用户未登录";
/// Java `UserMessageServiceImpl#deleteUserMessage` 的「id 为空/0」文案。
pub const MSG_DEL_NOT_FOUND: &str = "删除失败，消息不存在";
/// Java `UserMessageServiceImpl#deleteUserMessage` 的无权限文案。
pub const MSG_DEL_NO_PERMISSION: &str = "删除失败，您没有权限删除此消息";
/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO.id`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// Java `UserMessageConstants.TITLE_NOT_NULL`。
pub const MSG_TITLE_NOT_NULL: &str = "站内消息名称不能为空";
/// Java `UserMessageConstants.TITLE_OVER_LENGTH`。
pub const MSG_TITLE_OVER_LENGTH: &str = "站内消息名称长度不能超过50";

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `user_message` 表可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 11] = [
    "message_id",
    "message_log_id",
    "user_id",
    "user_rank",
    "is_read",
    "title",
    "content",
    "message_template",
    "link",
    "add_time",
    "type",
];

/// Java `BaseServiceImpl#getColumnByPropertyName` 的属性名 → 列名映射。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "messageId" | "message_id" => "message_id",
        "messageLogId" | "message_log_id" => "message_log_id",
        "userId" | "user_id" => "user_id",
        "userRank" | "user_rank" => "user_rank",
        "isRead" | "is_read" => "is_read",
        "title" => "title",
        "content" => "content",
        "messageTemplate" | "message_template" => "message_template",
        "link" => "link",
        "addTime" | "add_time" => "add_time",
        "type" => "type",
        // Java：找不到属性 → 主键列（防注入）
        _ => "message_id",
    }
}

/// 解析列表排序（Java `buildSortOrder(page, sortField, sortOrder)`）。
///
/// - 缺省/空或等于主键属性 → `message_id`
/// - `asc` → 升序；`desc` 或空 → 降序；其它非空值 → 不设置 `ORDER BY`
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let column = match sort_field.map(str::trim).filter(|s| !s.is_empty()) {
        None => "message_id",
        Some(f) => normalize_column(f),
    };
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("message_id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    (column, desc)
}

/// Unix 秒 → `(yyyy-MM-dd HH:mm:ss, yyyy-MM-dd, HH:mm:ss)`（东八区）。
///
/// Java `DateUtil.date(addTime * 1000)` + 三种 `DateUtil.format`；
/// `add_time` 为 NOT NULL，故恒有返回值（0 即 1970-01-01 08:00:00）。
#[must_use]
pub fn format_message_times(secs: i32) -> (String, String, String) {
    use chrono::TimeZone;
    let dt = chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .unwrap_or_else(|| {
            // 理论上不可达（东八区恒定可构造）；退化到 epoch
            chrono::FixedOffset::east_opt(0)
                .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
                .expect("epoch timestamp must be valid")
        });
    (
        dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        dt.format("%Y-%m-%d").to_string(),
        dt.format("%H:%M:%S").to_string(),
    )
}

/// 解析 `user_message.link`（Java `JsonUtil.fromJson(link, JSONObject.class)`）。
///
/// 空串 / 非法 JSON / JSON `null` → `None`；对象 / 数组等 → `Some(Value)`。
#[must_use]
pub fn parse_link(raw: &str) -> Option<Value> {
    let text = raw.trim();
    if text.is_empty() {
        return None;
    }
    match serde_json::from_str::<Value>(text) {
        Ok(v) if v.is_null() => None,
        Ok(v) => Some(v),
        Err(_) => None,
    }
}

/// 列表查询参数（Java `UserMessageListPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMessageListQuery {
    /// 当前页码（缺省 1）。
    pub page: Option<u64>,
    /// 分页大小（缺省 15，上限 100）。
    pub size: Option<u64>,
    /// 排序字段（缺省 `messageId`）。
    pub sort_field: Option<String>,
    /// 排序方向（缺省 `desc`）。
    pub sort_order: Option<String>,
    /// 关键字（Java `BasePage.keyword`；`UserMessageServiceImpl#list` 未使用）。
    pub keyword: Option<String>,
    /// 只看未读：1 = 只看未读（Java `unread`）。
    pub unread: Option<i32>,
    /// 兼容字段（Java `messageTitle`；本域列表未使用）。
    pub message_title: Option<String>,
    /// 消息类型；`> 0` 时精确过滤，否则排除订单通知（type = 1）。
    pub r#type: Option<i64>,
}

impl UserMessageListQuery {
    /// 归一化分页（Java `BasePage#getPage` / `#getSize`）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// 通用分页参数（供 [`crate::types::PageResult`] 使用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }

    /// 是否只看未读（Java `unread == 1`）。
    #[must_use]
    pub fn only_unread(&self) -> bool {
        self.unread == Some(1)
    }
}

/// 单条消息操作入参（Java `UserMessageUpdateDTO` / 公共 `OperateDTO` 的 id 视角）。
///
/// - `updateMessageRead`：Java `UserMessageUpdateDTO{id}`（无 `@NotNull`）
/// - `del`：Java 公共 `OperateDTO`（有 `@NotNull(id不能为空)`）
/// 两者结构相同，本域共用一个 DTO。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMessageIdDTO {
    /// 站内消息 ID。
    pub id: Option<i32>,
    /// 备注（Java `OperateDTO.adminNote`，本域未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（Java `OperateDTO.pageType`，本域未使用）。
    pub page_type: Option<i32>,
}

/// 站内信 VO（Java `UserMessageVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMessageVO {
    /// 站内消息 ID。
    pub message_id: i32,
    /// 消息标题。
    pub title: String,
    /// 消息日志 ID。
    pub message_log_id: i32,
    /// 用户 ID。
    pub user_id: i32,
    /// 用户等级。
    pub user_rank: i32,
    /// 是否已读：0 未读 / 1 已读。
    pub is_read: i32,
    /// 消息内容。
    pub content: String,
    /// 相关链接（JSON 对象；解析失败/空 → null）。
    pub link: Option<Value>,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`。
    pub add_time: String,
    /// 添加时间日期 `yyyy-MM-dd`。
    pub add_time_date: String,
    /// 添加时间分秒 `HH:mm:ss`。
    pub add_time_hms: String,
    /// 订单信息（Java 会组装 `OrderVO`；本实现未迁移，恒 null）。
    pub order_info: Option<Value>,
}

/// 未读消息统计（Java `UnreadMessageCountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnreadMessageCountVO {
    /// 站内信未读数量（全部类型）。
    pub user_message_count: i64,
    /// 订单消息未读数量（type = 1）。
    pub order_message_count: i64,
    /// IM 消息未读数量（`im_message.type = 2`）。
    pub im_message_count: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_resolution_matches_base_service_impl() {
        assert_eq!(resolve_sort(None, None), ("message_id", Some(true)));
        assert_eq!(resolve_sort(Some(""), Some("")), ("message_id", Some(true)));
        assert_eq!(
            resolve_sort(Some("messageId"), Some("asc")),
            ("message_id", Some(false))
        );
        assert_eq!(
            resolve_sort(Some("addTime"), Some("DESC")),
            ("add_time", Some(true))
        );
        // 非 asc/desc → Java 不设 ORDER BY
        assert_eq!(resolve_sort(Some("title"), Some("x")), ("title", None));
        // 未知字段回退主键
        assert_eq!(
            resolve_sort(Some("title; DROP TABLE x"), Some("asc")),
            ("message_id", Some(false))
        );
    }

    #[test]
    fn page_defaults_follow_java_base_page() {
        let q: UserMessageListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_params(), (1, 15));
        assert!(!q.only_unread());
        assert_eq!(q.r#type, None);
        let q: UserMessageListQuery = serde_json::from_value(serde_json::json!({
            "page": 2, "size": 500, "unread": 1, "type": 1, "sortField": "addTime"
        }))
        .unwrap();
        assert_eq!(q.page_params(), (2, 100));
        assert!(q.only_unread());
        assert_eq!(q.r#type, Some(1));
        assert_eq!(q.sort_field.as_deref(), Some("addTime"));
    }

    #[test]
    fn times_format_east_eight() {
        let (full, date, hms) = format_message_times(1_700_000_000);
        assert_eq!(full, "2023-11-15 06:13:20");
        assert_eq!(date, "2023-11-15");
        assert_eq!(hms, "06:13:20");
        // 0 → 1970-01-01 08:00:00（Java 同样格式化，不判空）
        let (full, date, hms) = format_message_times(0);
        assert_eq!(full, "1970-01-01 08:00:00");
        assert_eq!(date, "1970-01-01");
        assert_eq!(hms, "08:00:00");
    }

    #[test]
    fn link_parsing_matches_json_object_semantics() {
        assert_eq!(parse_link(""), None);
        assert_eq!(parse_link("  "), None);
        assert_eq!(parse_link("null"), None);
        assert_eq!(parse_link("not-json"), None);
        let v = parse_link(r#"{"path":"order","id":12}"#).unwrap();
        assert_eq!(v["path"], "order");
        assert_eq!(v["id"], 12);
        let v = parse_link(r#"{"path":"goods"}"#).unwrap();
        assert_eq!(v["path"], "goods");
    }

    #[test]
    fn vo_and_unread_counts_serialize_camel_case() {
        let (add_time, add_time_date, add_time_hms) = format_message_times(1_700_000_000);
        let vo = UserMessageVO {
            message_id: 1,
            title: "t".into(),
            message_log_id: 2,
            user_id: 3,
            user_rank: 0,
            is_read: 0,
            content: "c".into(),
            link: parse_link(r#"{"path":"order","id":9}"#),
            add_time,
            add_time_date,
            add_time_hms,
            order_info: None,
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["messageId"], 1);
        assert_eq!(json["messageLogId"], 2);
        assert_eq!(json["isRead"], 0);
        assert_eq!(json["addTime"], "2023-11-15 06:13:20");
        assert_eq!(json["addTimeDate"], "2023-11-15");
        assert_eq!(json["addTimeHms"], "06:13:20");
        assert_eq!(json["link"]["path"], "order");
        assert!(json["orderInfo"].is_null());

        let counts = UnreadMessageCountVO::default();
        let json = serde_json::to_value(&counts).unwrap();
        assert_eq!(json["userMessageCount"], 0);
        assert_eq!(json["orderMessageCount"], 0);
        assert_eq!(json["imMessageCount"], 0);
    }

    #[test]
    fn id_dto_accepts_camel_case() {
        let d: UserMessageIdDTO = serde_json::from_value(serde_json::json!({"id": 7})).unwrap();
        assert_eq!(d.id, Some(7));
        let d: UserMessageIdDTO = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(d.id, None);
    }
}
