//! 会员消息管理（member::user_message_log）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.user.UserMessageLogController`
//!   （`@RequestMapping("/adminapi/user/userMessageLog")`，5 个端点）
//! - 服务 `UserMessageLogServiceImpl`（继承 `BaseServiceImpl`）
//! - 入参 `UserMessageListPageQuery` / `UserMessageLogCreateDTO` /
//!   `UserMessageLogRecallParam` / 公共 `BatchDTO`
//! - 出参 `UserMessageLogPageVO`；表 `user_message_log`（实体
//!   [`crate::entities::UserMessageLog`]），发送时批量写 `user_message`。
//!
//! # 端点（5，全部 admin）
//! `GET /adminapi/user/userMessageLog/list`、
//! `POST /adminapi/user/userMessageLog/{create,del,batch,recall}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **「会员标签 / 组合人群」发送未迁移**：Java `findUserIds` 对
//!    `sendUserType=4`（memberAudience）与 `sendUserTarget`（组合人群）走
//!    `MemberAudienceService`（member_audience 域，尚未迁移）；本实现返回明确
//!    业务错误，**不伪造**目标人群。
//! 2. `sendUserType=3`（按会员名）的「名字数量与命中数不一致」文案逐字照抄。
//! 3. `messageLink` 用 `serde_json::to_string` 序列化（等价 Java fastjson
//!    `JSON.toJSONString`：字符串入参会带引号）。
//! 4. `del` 是 `BaseServiceImpl#del`（按 `message_log_id` 删日志行），
//!    **不级联**删除 `user_message`（Java 原样；撤回 `recall` 才级联删）。

/// Java `UserMessageLogRecallParam.id` 的 `@NotNull`。
pub const MSG_LOG_ID_REQUIRED: &str = "会员消息ID不能为空";
/// Java `UserMessageLogServiceImpl#findUserIds` 的 `Assert.notEmpty` 文案。
pub const MSG_NO_MEMBERS: &str = "该会员选择类型下没有会员";
/// Java `findUserIds` 的「按会员名发送」校验失败文案。
pub const MSG_USERNAME_INVALID: &str = "请检查输入的每个会员名称是否正确";
/// 发送类型 4（会员标签）/ 5（组合人群）未迁移文案。
pub const MSG_TARGET_NOT_MIGRATED: &str =
    "会员标签/组合人群发送暂未迁移（依赖 member_audience 域），请改用全部/单个/等级/指定会员名";
/// 未选择项目（Java `ResultTextConstants.UNSELECTED_ITEM`）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";

/// 发送类型：全部（Java `SendUserTypeEnum.ALL`）。
pub const SEND_USER_TYPE_ALL: i32 = 0;
/// 发送类型：单个（`SINGLE`）。
pub const SEND_USER_TYPE_SINGLE: i32 = 1;
/// 发送类型：等级（`RANK`）。
pub const SEND_USER_TYPE_RANK: i32 = 2;
/// 发送类型：部分（`PART`，按会员名 CSV）。
pub const SEND_USER_TYPE_PART: i32 = 3;
/// 发送类型：会员标签（`TAG`，未迁移）。
pub const SEND_USER_TYPE_TAG: i32 = 4;
/// 发送类型：组合人群（`COMBINED`，未迁移）。
pub const SEND_USER_TYPE_COMBINED: i32 = 5;

/// `user_message_log` 表可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 10] = [
    "message_log_id",
    "message_type",
    "send_user_type",
    "user_ids",
    "user_rank",
    "message_title",
    "message_content",
    "message_link",
    "send_time",
    "is_recall",
];

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 属性名 → 列名（Java `getColumnByPropertyName`；未知回退主键）。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "messageLogId" | "message_log_id" => "message_log_id",
        "messageType" | "message_type" => "message_type",
        "sendUserType" | "send_user_type" => "send_user_type",
        "userIds" | "user_ids" => "user_ids",
        "userRank" | "user_rank" => "user_rank",
        "messageTitle" | "message_title" => "message_title",
        "messageContent" | "message_content" => "message_content",
        "messageLink" | "message_link" => "message_link",
        "sendTime" | "send_time" => "send_time",
        "isRecall" | "is_recall" => "is_recall",
        _ => "message_log_id",
    }
}

/// 列表排序（Java `buildSortOrder`；缺省主键降序）。
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let column = match sort_field.map(str::trim).filter(|s| !s.is_empty()) {
        None => "message_log_id",
        Some(f) => normalize_column(f),
    };
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("message_log_id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    (column, desc)
}

/// 发送时间格式化（Java `UserMessageLogPageVO` + `TigUtils.handelTime`）：
/// `null` / `0` → `""`；`> 0` → `yyyy-MM-dd HH:mm:ss`（东八区）。
#[must_use]
pub fn format_send_time(secs: i32) -> String {
    use chrono::TimeZone;
    if secs <= 0 {
        return String::new();
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// 列表查询参数（Java `UserMessageListPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMessageLogListQuery {
    /// 页码。
    pub page: Option<u64>,
    /// 页大小。
    pub size: Option<u64>,
    /// 排序字段。
    pub sort_field: Option<String>,
    /// 排序方向。
    pub sort_order: Option<String>,
    /// 标题关键字（Java `BasePage.keyword`，作用于 `message_title LIKE`）。
    pub keyword: Option<String>,
    /// 是否未读（Java `UserMessageListPageQuery.unread`；日志列表未使用）。
    pub unread: Option<i32>,
    /// 消息标题（Java `messageTitle`；日志列表未使用）。
    pub message_title: Option<String>,
    /// 消息类型（Java `type`；日志列表未使用）。
    pub r#type: Option<i64>,
}

impl UserMessageLogListQuery {
    /// 归一化分页（Java `BasePage`）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// 通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        let (page, size) = self.page_params();
        crate::types::PageQuery {
            page,
            page_size: size,
        }
    }
}

/// 创建会员消息入参（Java `UserMessageLogCreateDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMessageLogCreateDTO {
    /// 消息类型。
    pub message_type: Option<i32>,
    /// 标题。
    pub message_title: Option<String>,
    /// 内容。
    pub message_content: Option<String>,
    /// 链接（任意 JSON；Java `Object`）。
    pub message_link: Option<serde_json::Value>,
    /// 发送类型（见 `SEND_USER_TYPE_*`）。
    pub send_user_type: Option<i32>,
    /// 用户列表（历史字段，未使用）。
    pub user_list: Option<String>,
    /// 单个用户主键（历史字段，未使用）。
    pub user_id: Option<i32>,
    /// 用户集合（`sendUserType=1` 时是单个 ID；`=3` 时是会员名 CSV）。
    pub user_ids: Option<String>,
    /// 会员等级（`sendUserType=2`）。
    pub user_rank: Option<i32>,
    /// 会员标签人群（历史结构，未迁移）。
    pub member_audience: Option<serde_json::Value>,
    /// 组合人群（未迁移）。
    pub send_user_target: Option<serde_json::Value>,
}

/// 统一人群结构（Java `SendUserTargetDTO`，只保留站内信发送所需字段）。
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SendUserTargetDTO {
    /// 0=全部会员（默认） 1=部分会员。
    pub scope: Option<i32>,
    /// 指定会员 ID（scope=1）。
    pub user_ids: Option<Vec<i32>>,
    /// 会员等级 ID（scope=1）。
    pub rank_ids: Option<Vec<i32>>,
    /// 会员标签 ID（scope=1）。
    pub tag_ids: Option<Vec<i64>>,
    /// 标签匹配：0=任一 1=全部。
    pub tag_match_mode: Option<i32>,
}

impl SendUserTargetDTO {
    /// Java `scopeOrDefault()`：缺省为全部会员。
    #[must_use]
    pub fn scope_or_default(&self) -> i32 {
        self.scope.unwrap_or(0)
    }

    /// Java `matchModeOrDefault()`：只有 1 表示「全部」。
    #[must_use]
    pub fn match_all(&self) -> bool {
        self.tag_match_mode == Some(1)
    }
}

/// 撤回 / 删除入参（Java `UserMessageLogRecallParam`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMessageLogRecallParam {
    /// 会员消息 ID（`@NotNull(message = 会员消息ID不能为空)`）。
    pub id: Option<i32>,
}

/// 批量操作入参（Java 公共 `BatchDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型（仅 `"del"` 生效）。
    pub r#type: Option<String>,
    /// 操作值（未使用）。
    pub value: i32,
}

/// 会员消息列表 VO（Java `UserMessageLogPageVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMessageLogPageVO {
    /// 主键。
    pub message_log_id: i32,
    /// 消息类型。
    pub message_type: i32,
    /// 发送类型。
    pub send_user_type: i32,
    /// 用户集合。
    pub user_ids: String,
    /// 会员等级。
    pub user_rank: i32,
    /// 标题。
    pub message_title: String,
    /// 内容。
    pub message_content: String,
    /// 链接地址。
    pub message_link: String,
    /// 是否撤回。
    pub is_recall: i32,
    /// 发送时间（`yyyy-MM-dd HH:mm:ss`；0 → `""`）。
    pub send_time: String,
}

/// 校验「按会员名发送」的用户名列表（Java `StrUtil.split(userIds, ',')`）。
///
/// 返回去空白后的非空会员名；空列表由调用方报「该会员选择类型下没有会员」。
#[must_use]
pub fn split_usernames(raw: Option<&str>) -> Vec<String> {
    raw.map(|s| {
        s.split(',')
            .map(str::trim)
            .filter(|n| !n.is_empty())
            .map(ToString::to_string)
            .collect()
    })
    .unwrap_or_default()
}

/// 批量删除判定（Java `BaseServiceImpl#batch`：仅 `type == "del"` 且 ids 非空）。
#[must_use]
pub fn is_delete_batch(dto: &BatchDTO) -> bool {
    dto.r#type.as_deref() == Some("del") && !dto.ids.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_resolution_matches_base_service_impl() {
        assert_eq!(resolve_sort(None, None), ("message_log_id", Some(true)));
        assert_eq!(
            resolve_sort(Some("sendTime"), Some("asc")),
            ("send_time", Some(false))
        );
        assert_eq!(
            resolve_sort(Some("messageTitle"), None),
            ("message_title", Some(true))
        );
        // 非 asc/desc → 不设 ORDER BY；未知字段回退主键
        assert_eq!(
            resolve_sort(Some("send_time"), Some("x")),
            ("send_time", None)
        );
        assert_eq!(
            resolve_sort(Some("1=1 --"), Some("asc")),
            ("message_log_id", Some(false))
        );
    }

    #[test]
    fn page_defaults_follow_java_base_page() {
        let q: UserMessageLogListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_params(), (1, 15));
        let q: UserMessageLogListQuery =
            serde_json::from_value(serde_json::json!({"page": 3, "size": 1000})).unwrap();
        assert_eq!(q.page_params(), (3, 100));
    }

    #[test]
    fn send_time_format_matches_handel_time() {
        assert_eq!(format_send_time(0), "");
        assert_eq!(format_send_time(-1), "");
        assert_eq!(format_send_time(1_700_000_000), "2023-11-15 06:13:20");
    }

    #[test]
    fn usernames_split_trims_and_drops_empty() {
        assert_eq!(split_usernames(None), Vec::<String>::new());
        assert_eq!(
            split_usernames(Some(" a, b ,,c ")),
            vec!["a".to_string(), "b".to_string(), "c".to_string()]
        );
    }

    #[test]
    fn batch_delete_rule_matches_base_service() {
        assert!(is_delete_batch(&BatchDTO {
            ids: vec![1],
            r#type: Some("del".into()),
            value: 0,
        }));
        assert!(!is_delete_batch(&BatchDTO {
            ids: vec![],
            r#type: Some("del".into()),
            value: 0,
        }));
        assert!(!is_delete_batch(&BatchDTO {
            ids: vec![1],
            r#type: Some("show".into()),
            value: 0,
        }));
        assert!(!is_delete_batch(&BatchDTO::default()));
    }

    #[test]
    fn create_dto_binds_camel_case() {
        let d: UserMessageLogCreateDTO = serde_json::from_value(serde_json::json!({
            "messageType": 1, "messageTitle": "标题", "messageContent": "内容",
            "messageLink": {"path": "order", "id": 1}, "sendUserType": 1,
            "userIds": "9", "userRank": 2
        }))
        .unwrap();
        assert_eq!(d.message_type, Some(1));
        assert_eq!(d.message_title.as_deref(), Some("标题"));
        assert_eq!(d.send_user_type, Some(1));
        assert_eq!(d.user_ids.as_deref(), Some("9"));
        assert_eq!(d.user_rank, Some(2));
        assert_eq!(d.message_link.unwrap()["path"], "order");

        let vo = UserMessageLogPageVO {
            message_log_id: 1,
            message_type: 1,
            send_user_type: 0,
            user_ids: "1,2".into(),
            user_rank: 0,
            message_title: "t".into(),
            message_content: "c".into(),
            message_link: "{}".into(),
            is_recall: 0,
            send_time: "2023-11-15 06:13:20".into(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["messageLogId"], 1);
        assert_eq!(json["sendUserType"], 0);
        assert_eq!(json["isRecall"], 0);
        assert_eq!(json["sendTime"], "2023-11-15 06:13:20");
    }
}
