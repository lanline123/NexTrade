//! IM 客服会话域 DTO / VO / 查询参数 / 纯函数（im::im_conversation）。
//!
//! 对应 Java：
//! - `com.tigshop.bean.query.im.ImConversationPageQuery`（extends `BasePage`）
//! - `com.tigshop.bean.dto.im.{ImConversationCreateDTO, ImConversationUpdateDTO,
//!   TransferDTO, DelDTO, SaveRemarkDTO, WaitServantListDTO}`
//! - `com.tigshop.bean.model.im.ImConversation`
//! - `com.tigshop.bean.vo.im.{ImConversationVO, WaitServantListVO,
//!   ConsultHistoryListVO, ImMessageVO, ImSearchUserVO, ImSearchConversationVO,
//!   ImSearchShopVO}`
//! - `com.tigshop.bean.dto.common.{BatchDTO, UpdateFieldDTO}`
//! - `com.tigshop.common.constant.im.ImConversationConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.GENERAL_FIELDS`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#buildSortOrder`
//! - `com.tigshop.common.utils.TigUtils#handelTime` / `#toTimestampYmd`
//!
//! JSON 字段全部保持 camelCase（`#[serde(rename_all = "camelCase")]`）。
//!
//! # 关键语义
//!
//! - 时间：实体列是秒级 `int`，Java `Long`；VO 输出为
//!   `yyyy-MM-dd HH:mm:ss`（UTC+8）。`TigUtils.handelTime(null/0)` → `""`
//!   （见 [`format_unix_time`]）；`consultHistory` 是「非 null 才 set」，
//!   故该 VO 用 `Option<String>`。
//! - `ImMessageVO.content` 复用 `models::im::im_message::ContentVO`
//!   （JSON 文本反序列化），`messageTypeText` 复用 `message_type_text`。
//! - `ImMessageVO.extend` 在 Java 是 `Object`（由 `String` 拷贝而来）⇒
//!   本实现用 `serde_json::Value` 承载原始 JSON 文本，序列化后仍是字符串。
//! - `buildSortOrder` 有两种重载：`BasePage` 版（**读 `sortItems`**，list /
//!   consultHistory 使用）与三参版（**忽略 `sortItems`**，waitServantList 使用）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::ImConversation;
use crate::models::im::im_message::ContentVO;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `BaseServiceImpl#getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `id`）。
pub const KEY_PROPERTY: &str = "id";

/// `im_conversation` 的真实列清单（`python tools/schema_parser.py --table im_conversation`）。
pub const CONVERSATION_COLUMNS: [&str; 11] = [
    "id",
    "user_id",
    "last_servant_id",
    "add_time",
    "shop_id",
    "user_from",
    "status",
    "last_update_time",
    "is_delete",
    "remark",
    "summary",
];

/// `updateField` 允许字段（Java `CheckFieldConstants.GENERAL_FIELDS`）。
///
/// `im_conversation` 只有 `status` 命中；`is_show` / `sort_order` 归一后
/// 回退主键列 ⇒ 被白名单拒绝（与 Java 现网一致）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 转接参数缺失（Java i18n `error.im.transfer.target.required`）。
pub const MSG_TRANSFER_TARGET_REQUIRED: &str = "请选择要转接的客服和会话";

/// 会话不存在（Java i18n `error.im.conversation.not.exist`）。
pub const MSG_CONVERSATION_NOT_EXISTS: &str = "会话不存在";

/// 无权限（Java i18n `error.im.no.permission`）。
pub const MSG_NO_PERMISSION: &str = "没有权限";

/// 字段值有误（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// 主键为空（Java `OperateDTO` / `UpdateFieldDTO` 的 `@NotNull` 文案）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// 未选择项目（Java `BatchDTO.ids` 的 `@NotEmpty` 文案）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";

/// 操作类型为空（Java `BatchDTO.type` 的 `@NotNull` 文案）。
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

/// 会话 ID 为空（Java `ImConversationConstants.IM_CONVERSATION_ID_NOT_NULL`）。
pub const MSG_CONVERSATION_ID_REQUIRED: &str = "客服会话id不能为空";

/// 会话状态：0 待接入。
pub const CONVERSATION_STATUS_NOT_CONNECTED: i32 = 0;
/// 会话状态：1 会话中。
pub const CONVERSATION_STATUS_IN_PROGRESS: i32 = 1;
/// 会话状态：2 已结束。
pub const CONVERSATION_STATUS_CLOSED: i32 = 2;

/// 配置项 `biz_code`：商城简称（Java `SettingsEnum.SHOP_NAME`）。
pub const CONFIG_SHOP_NAME: &str = "shopName";

/// 配置项 `biz_code`：商城 LOGO（Java `SettingsEnum.SHOP_LOGO`）。
pub const CONFIG_SHOP_LOGO: &str = "shopLogo";

/// 配置项 `biz_code`：会员默认头像（Java `SettingsEnum.DEFAULT_AVATAR`）。
pub const CONFIG_DEFAULT_AVATAR: &str = "defaultAvatar";

/// 配置项 `biz_code`：平台门店名称（Java `SettingsEnum.STORE_SELF_OPERATED_NAME`）。
pub const CONFIG_STORE_SELF_OPERATED_NAME: &str = "storeSelfOperatedName";

/// 配置项 `biz_code`：平台门店 LOGO（Java `SettingsEnum.STORE_SELF_OPERATED_LOGO`）。
pub const CONFIG_STORE_SELF_OPERATED_LOGO: &str = "storeSelfOperatedLogo";

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// `BasePage.sortItems` 的一项（Java `com.tigshop.common.core.entity.SortItem`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SortItem {
    /// 排序字段（属性名或列名，未识别回退主键）
    pub field: Option<String>,
    /// `asc` / 其它（Java：仅 `asc` 升序，其余一律降序）
    pub order: Option<String>,
}

/// 客服会话列表 / 历史会话查询（对应 Java `ImConversationPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImConversationPageQuery {
    /// 时间类型：1 会话开始时间；3 最后会话时间（2 暂未实现）
    pub time_type: Option<i32>,
    /// 开始时间（`yyyy-MM-dd`）
    pub start_time: Option<String>,
    /// 结束时间（`yyyy-MM-dd`）
    pub end_time: Option<String>,
    /// 用户名（list 过滤 users；consultHistory 过滤 user.username）
    pub username: Option<String>,
    /// 最后客服 ID（`-1` ⇒ 不过滤）
    pub last_servant_id: Option<i32>,
    /// 用户来源
    pub user_from: Option<String>,
    /// 状态：`-2` ⇒ 不过滤；`-1` ⇒ 会话中 + 已结束
    pub status: Option<i32>,
    /// 会话备注（`LIKE`）
    pub remark: Option<String>,
    /// 店铺 ID（控制器用请求头覆盖）
    pub shop_id: Option<i32>,
    /// 用户 ID（前台登录态覆盖）
    pub user_id: Option<i32>,
    /// 是否删除（Java `buildQueryWrapper` 里会再追加一条 `eq(is_delete, 参数)`）
    pub is_delete: Option<i32>,
    /// 搜索开始时间（`handleParam` 由 `startTime` 解析，consultHistory 用）
    pub search_start_time: Option<i64>,
    /// 搜索结束时间（`handleParam` 由 `endTime` 解析，consultHistory 用）
    pub search_end_time: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 多字段排序（list / consultHistory 读取）
    pub sort_items: Option<Vec<SortItem>>,
    /// 页码（Java `BasePage.page`，null ⇒ 1）
    pub page: Option<i64>,
    /// 每页条数（Java `BasePage.size`，null ⇒ 15，上限 100）
    pub size: Option<i64>,
}

impl ImConversationPageQuery {
    /// `(LIMIT, OFFSET)`（Java `BasePage.getPage()/getSize()` 口径）。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// 复刻 `ImConversationPageQuery#handleParam()`（consultHistory 前调用）：
    /// 用请求头店铺覆盖 `shopId`，并把 `startTime` / `endTime` 解析成时间戳。
    pub fn handle_param(&mut self, shop_id: Option<i32>) {
        self.shop_id = shop_id;
        if let Some(start) = self
            .start_time
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            self.search_start_time = parse_timestamp_ymd(start);
        }
        if let Some(end) = self
            .end_time
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            self.search_end_time = parse_timestamp_ymd(end);
        }
    }

    /// 是否为「后台会话列表」查询（`TigUtils.getClientTypeByToken()` 为 true）：
    /// 后台列表默认按 `lastUpdateTime desc`，且强制 `lastServantId = 当前客服`。
    ///
    /// 本方法仅做排序默认值准备（list 不修改 shop/user 过滤）。
    #[must_use]
    pub fn list_order_clause(&self) -> String {
        self.order_clause_with_default("lastUpdateTime")
    }

    /// `consultHistory` 排序（`buildSortOrder(BasePage)`，默认主键降序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        self.order_clause_with_default(KEY_PROPERTY)
    }

    /// `waitServantList` 排序（三参 `buildSortOrder`，**忽略 sortItems**）。
    #[must_use]
    pub fn flat_order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }

    /// `buildSortOrder(BasePage)` 的通用实现：`sortItems` 非空时逐项追加；
    /// 否则以 `default_field` 为缺省字段走单字段逻辑。
    fn order_clause_with_default(&self, default_field: &str) -> String {
        if let Some(items) = &self.sort_items {
            if !items.is_empty() {
                let mut parts: Vec<String> = Vec::new();
                for item in items {
                    let Some(field) = item
                        .field
                        .as_deref()
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                    else {
                        continue;
                    };
                    let column = if field == KEY_PROPERTY || field == KEY_COLUMN {
                        KEY_COLUMN
                    } else {
                        map_order_column(field)
                    };
                    let dir = if item
                        .order
                        .as_deref()
                        .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
                    {
                        "ASC"
                    } else {
                        "DESC"
                    };
                    parts.push(format!("{column} {dir}"));
                }
                return if parts.is_empty() {
                    String::new()
                } else {
                    format!(" ORDER BY {}", parts.join(", "))
                };
            }
        }
        let raw = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let field = if raw.is_empty() { default_field } else { raw };
        let column = if field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "userId" | "user_id" => "user_id",
        "lastServantId" | "last_servant_id" => "last_servant_id",
        "addTime" | "add_time" => "add_time",
        "shopId" | "shop_id" => "shop_id",
        "userFrom" | "user_from" => "user_from",
        "status" => "status",
        "lastUpdateTime" | "last_update_time" => "last_update_time",
        "isDelete" | "is_delete" => "is_delete",
        "remark" => "remark",
        "summary" => "summary",
        // Java 找不到时返回主键列（防 SQL 注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段归一（Java `getColumnByPropertyName`）。
#[must_use]
pub fn map_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// `updateField` 白名单校验（Java `Arrays.asList(GENERAL_FIELDS).contains(...)`）。
#[must_use]
pub fn is_allowed_update_field(field: &str) -> bool {
    GENERAL_FIELDS.contains(&map_field_column(field))
}

/// `status` 过滤分支（Java `buildQueryWrapper` 的 `-2` / `-1` 特判）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StatusFilter {
    /// 不过滤
    None,
    /// `status IN (...)`（Java `-1` ⇒ 会话中 + 已结束）
    In(Vec<i32>),
    /// `status = ?`
    Eq(i32),
}

/// 解析 `status` 过滤条件（Java `if (status != null && status != -2)`）。
#[must_use]
pub fn status_filter(status: Option<i32>) -> StatusFilter {
    match status {
        None | Some(-2) => StatusFilter::None,
        Some(-1) => StatusFilter::In(vec![
            CONVERSATION_STATUS_IN_PROGRESS,
            CONVERSATION_STATUS_CLOSED,
        ]),
        Some(v) => StatusFilter::Eq(v),
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`null`/`0` ⇒ `""`。
///
/// 对应 Java `TigUtils.handelTime(Long)`。
#[must_use]
pub fn format_unix_time(secs: Option<i32>) -> String {
    let Some(secs) = secs.filter(|s| *s != 0) else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 「非 null 才格式化」版（`consultHistory` 的 `if (addTime != null)`）。
#[must_use]
pub fn format_unix_time_opt(secs: Option<i32>) -> Option<String> {
    secs.map(|_| format_unix_time(secs))
}

/// `yyyy-MM-dd` → 秒级时间戳（UTC+8 零点）。
///
/// 对应 Java `TigUtils.toTimestampYmd`（`DateUtil.parse(dateStr, "yyyy-MM-dd")`）。
/// 解析失败 ⇒ `None`（Java 会抛异常；本实现容错，见 `uncertain_points`）。
#[must_use]
pub fn parse_timestamp_ymd(raw: &str) -> Option<i64> {
    let date = raw.trim().get(..10)?;
    let naive = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    let midnight = naive.and_hms_opt(0, 0, 0)?;
    Some(midnight.and_utc().timestamp() - 8 * 3600)
}

/// 日期/时间字符串 → 秒级时间戳（UTC+8）。
///
/// 对应 Java `StringUtils.dateToTimestampExample`：
/// - 无 `:` ⇒ 补 ` 00:00:00`（纯日期视为当天零点）
/// - 只有到分钟 ⇒ 补 `:00`
/// - 支持 `yyyy-MM-dd` / `yyyy-MM-dd HH:mm` / `yyyy-MM-dd HH:mm:ss`
///
/// 解析失败 ⇒ `None`（Java 抛 `DateTimeParseException`；本实现容错跳过该过滤）。
#[must_use]
pub fn parse_timestamp_datetime(raw: &str) -> Option<i64> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let mut normalized = raw.to_string();
    if !raw.contains(':') {
        normalized = format!("{raw} 00:00:00");
    } else if raw.len() == 16 {
        // `yyyy-MM-dd HH:mm`
        normalized = format!("{raw}:00");
    }
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"] {
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&normalized, fmt) {
            return Some(naive.and_utc().timestamp() - 8 * 3600);
        }
        if let Ok(date) = chrono::NaiveDate::parse_from_str(&normalized, fmt) {
            return Some(date.and_hms_opt(0, 0, 0)?.and_utc().timestamp() - 8 * 3600);
        }
    }
    None
}

/// 实体 → 列表/详情 VO 的基础字段（不含关联数据）。
#[must_use]
pub fn conversation_base_vo(entity: &ImConversation) -> ImConversationVO {
    ImConversationVO {
        id: entity.id,
        conversation_id: None,
        user_id: entity.user_id,
        last_servant_id: entity.last_servant_id,
        add_time: Some(format_unix_time(entity.add_time)),
        last_update_time: Some(format_unix_time(entity.last_update_time)),
        shop_id: entity.shop_id,
        user_from: entity.user_from.clone(),
        status: entity.status,
        remark: Some(entity.remark.clone()),
        summary: Some(entity.summary.clone()),
        is_delete: entity.is_delete,
        unread_message_count: 0,
        unread_servant_message_count: 0,
        user: None,
        last_message: None,
        shop: None,
    }
}

/// 实体 → 「create 返回的」实体镜像（Java 控制器直接返回 `ImConversation`）。
#[must_use]
pub fn conversation_entity_vo(entity: &ImConversation) -> ImConversationEntityVO {
    ImConversationEntityVO {
        id: entity.id,
        user_id: entity.user_id,
        last_servant_id: entity.last_servant_id,
        add_time: entity.add_time.map(i64::from),
        shop_id: entity.shop_id,
        user_from: entity.user_from.clone(),
        status: entity.status,
        last_update_time: entity.last_update_time.map(i64::from),
        is_delete: entity.is_delete,
        remark: entity.remark.clone(),
        summary: entity.summary.clone(),
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 创建会话入参（对应 Java `ImConversationCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImConversationCreateDTO {
    /// 用户 ID
    pub user_id: Option<i32>,
    /// 最后客服 ID（控制器用当前管理员 ID 覆盖）
    pub last_servant_id: Option<i32>,
    /// 店铺 ID（控制器用请求头覆盖）
    pub shop_id: Option<i32>,
    /// 用户来源
    pub user_from: Option<String>,
}

/// 转接入参（对应 Java `TransferDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TransferDTO {
    /// 待转接客服 ID（为空时控制器回填当前管理员 ID）
    pub servant_id: Option<i32>,
    /// 会话 ID
    pub conversation_id: Option<i32>,
    /// 类型（服务层写死 `autoTransfer`）
    pub r#type: Option<String>,
    /// 旧客服 ID（服务层回填，Java 侧实际写的是新客服 ID —— bug 一并复刻）
    pub old_servant_id: Option<i32>,
}

/// 删除入参（对应 Java `DelDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DelDTO {
    /// 会话 ID
    pub conversation_id: Option<i32>,
    /// 店铺 ID（控制器用请求头覆盖）
    pub shop_id: Option<i32>,
}

/// 保存备注入参（对应 Java `SaveRemarkDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SaveRemarkDTO {
    /// 会话 ID
    pub conversation_id: Option<i32>,
    /// 备注
    pub remark: Option<String>,
    /// 会话总结
    pub summary: Option<String>,
    /// 店铺 ID（控制器用请求头覆盖）
    pub shop_id: Option<i32>,
}

/// 待接入客户列表查询（对应 Java `WaitServantListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WaitServantListQuery {
    /// 用户来源（`isNoneBlank` 才过滤）
    pub user_from: Option<String>,
    /// 店铺 ID（控制器用请求头覆盖）
    pub shop_id: Option<i32>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`
    pub sort_order: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
}

impl WaitServantListQuery {
    /// `(LIMIT, OFFSET)`（Java `BasePage` 口径）。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// 排序（三参 `buildSortOrder`：忽略 sortItems；默认主键降序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }
}

/// 批量操作（对应 Java `BatchDTO`；控制器有 `@Valid`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合
    pub ids: Option<Vec<i32>>,
    /// 操作类型，本域仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（本域未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新（对应 Java `UpdateFieldDTO`；控制器有 `@Valid`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 会话 VO（对应 Java `ImConversationVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImConversationVO {
    pub id: i32,
    pub conversation_id: Option<i32>,
    pub user_id: Option<i32>,
    pub last_servant_id: Option<i32>,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`；Java 用 `handelTime`，null/0 → ""）
    pub add_time: Option<String>,
    pub last_update_time: Option<String>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub status: Option<i32>,
    pub remark: Option<String>,
    pub summary: Option<String>,
    pub is_delete: Option<i32>,
    /// 未读消息数（客服视角：type=1 且 is_read=0）
    pub unread_message_count: i64,
    /// 客户未读客服消息数（type=2 且 is_read=0）
    pub unread_servant_message_count: i64,
    pub user: Option<ImUserVO>,
    /// 最后一条消息（Java 实际返回该会话全部匹配消息，按 sendTime 倒序）
    pub last_message: Option<Vec<ImMessageVO>>,
    pub shop: Option<ImShopVO>,
}

/// 会话实体的 camelCase 镜像（`create` 端点 Java 直接返回 `ImConversation`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImConversationEntityVO {
    pub id: i32,
    pub user_id: Option<i32>,
    pub last_servant_id: Option<i32>,
    /// 秒级时间戳（Java `Long`）
    pub add_time: Option<i64>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub status: Option<i32>,
    pub last_update_time: Option<i64>,
    pub is_delete: Option<i32>,
    pub remark: String,
    pub summary: String,
}

/// 用户简要信息（Java 各 VO 内嵌 `UserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImUserVO {
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
}

/// 店铺简要信息（Java `ImConversationVO.ShopVO` / `ImSearchConversationVO.ShopVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImShopVO {
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
}

/// 会话消息 VO（对应 Java `ImMessageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImMessageVO {
    pub message_type_text: Option<String>,
    pub id: Option<i32>,
    pub conversation_id: Option<i32>,
    pub content: Option<ContentVO>,
    pub message_type: Option<String>,
    pub r#type: Option<i32>,
    pub user_id: Option<i32>,
    pub servant_id: Option<i32>,
    /// 发送时间（`yyyy-MM-dd HH:mm:ss`）
    pub send_time: Option<String>,
    pub status: Option<i32>,
    /// Java `Object`（由 `String` 拷贝而来）
    pub extend: Option<serde_json::Value>,
    pub push_status: Option<i32>,
    pub is_read: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
}

/// 待接入客户 VO（对应 Java `WaitServantListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaitServantListVO {
    pub id: i32,
    pub user_id: Option<i32>,
    /// 实体无该字段，Java `copyProperties` 后恒为 null
    pub avatar: Option<String>,
    pub last_servant_id: Option<i32>,
    pub add_time: Option<String>,
    pub last_update_time: Option<String>,
    pub shop_id: Option<i32>,
    pub status: Option<i32>,
    pub remark: Option<String>,
    pub summary: Option<String>,
    pub is_delete: Option<i32>,
    pub user: Option<ImUserVO>,
    /// 最近两条消息（`order by id desc limit 2`）
    pub user_last_two_message: Option<Vec<ImMessageVO>>,
    pub user_from: Option<String>,
}

/// 客服历史会话 VO（对应 Java `ConsultHistoryListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsultHistoryListVO {
    pub id: Option<i32>,
    pub user_id: Option<i32>,
    pub last_servant_id: Option<i32>,
    pub add_time: Option<String>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub status: Option<i32>,
    pub last_update_time: Option<String>,
    pub is_delete: Option<i32>,
    pub remark: Option<String>,
    pub summary: Option<String>,
    /// mapper 只 select `ic.*` ⇒ 该字段恒为 null
    pub first_response_time: Option<i32>,
    /// mapper 只 select `ic.*` ⇒ 该字段恒为 null
    pub conversation_duration: Option<Decimal>,
    pub user: Option<ImUserVO>,
    /// mapper 只 select `ic.*` ⇒ 该字段恒为 null
    pub average_response_time: Option<i32>,
    pub servant: Option<ConsultServantVO>,
    pub first_user_message: Option<Vec<FirstUserMessageVO>>,
    pub servant_message: Option<Vec<ServantMessageVO>>,
}

/// 历史会话内嵌客服信息（Java `ConsultHistoryListVO.ServantVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsultServantVO {
    pub admin_id: Option<i32>,
    pub username: Option<String>,
    pub mobile: Option<String>,
    pub avatar: Option<String>,
}

/// 首次用户消息（Java `ConsultHistoryListVO.FirstUserMessageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserMessageVO {
    pub message_type_text: Option<String>,
    pub conversation_id: Option<i32>,
    pub user_id: Option<i32>,
    pub send_time: Option<String>,
    pub message_type: Option<String>,
}

/// 客服消息统计（Java `ConsultHistoryListVO.ServantMessageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServantMessageVO {
    pub message_type_text: Option<String>,
    pub conversation_id: Option<i32>,
    pub servant_id: Option<i32>,
    pub last_send_time: Option<i64>,
    pub first_send_time: Option<i64>,
    pub message_count: Option<i64>,
    pub message_type: Option<String>,
}

/// 后台搜索-用户结果（对应 Java `ImSearchUserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImSearchUserVO {
    pub id: Option<i32>,
    pub user_id: Option<i32>,
    pub last_servant_id: Option<i32>,
    pub add_time: Option<String>,
    pub last_update_time: Option<String>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub status: Option<i32>,
    pub remark: Option<String>,
    pub summary: Option<String>,
    pub is_delete: Option<i32>,
    pub user: Option<ImUserVO>,
}

/// 后台/前台搜索-会话结果（对应 Java `ImSearchConversationVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImSearchConversationVO {
    pub id: Option<i32>,
    pub user_id: Option<i32>,
    pub last_servant_id: Option<i32>,
    pub add_time: Option<String>,
    pub last_update_time: Option<String>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub status: Option<i32>,
    pub remark: Option<String>,
    pub summary: Option<String>,
    pub is_delete: Option<i32>,
    pub content: Option<ContentVO>,
    pub user: Option<ImUserVO>,
    pub shop: Option<ImShopVO>,
}

/// 前台搜索-店铺结果（对应 Java `ImSearchShopVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImSearchShopVO {
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
}

/// 后台 `search` 返回（Java `Map{userList, conversationList}`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminSearchResult {
    pub user_list: Vec<ImSearchUserVO>,
    pub conversation_list: Vec<ImSearchConversationVO>,
}

/// 前台 `frontSearch` 返回（Java `Map{shopList, conversationList}`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontSearchResult {
    pub shop_list: Vec<ImSearchShopVO>,
    pub conversation_list: Vec<ImSearchConversationVO>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 分页 / 排序 ————————————————

    #[test]
    fn limit_offset_matches_base_page() {
        let q = ImConversationPageQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        let q = ImConversationPageQuery {
            page: Some(3),
            size: Some(200),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (100, 200));
        let q = ImConversationPageQuery {
            page: Some(2),
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (1, 1));
    }

    #[test]
    fn list_order_defaults_to_last_update_time_desc() {
        // Java：sortField 为空 → 强制 lastUpdateTime desc
        assert_eq!(
            ImConversationPageQuery::default().list_order_clause(),
            " ORDER BY last_update_time DESC"
        );
        // 显式 sortField 优先
        let q = ImConversationPageQuery {
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.list_order_clause(), " ORDER BY add_time ASC");
        // 未识别字段回退主键（防注入）
        let q = ImConversationPageQuery {
            sort_field: Some("x; DROP TABLE im_conversation".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.list_order_clause(), " ORDER BY id ASC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY
        let q = ImConversationPageQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.list_order_clause(), "");
    }

    #[test]
    fn order_clause_reads_sort_items_but_flat_ignores_them() {
        let q: ImConversationPageQuery = serde_json::from_str(
            r#"{"sortItems":[{"field":"lastUpdateTime","order":"asc"},
                              {"field":"addTime","order":"desc"}]}"#,
        )
        .unwrap();
        assert_eq!(
            q.order_clause(),
            " ORDER BY last_update_time ASC, add_time DESC"
        );
        // consultHistory 默认也是主键降序
        assert_eq!(
            ImConversationPageQuery::default().order_clause(),
            " ORDER BY id DESC"
        );
        // waitServantList 的 flat 版忽略 sortItems，默认主键降序
        let flat = WaitServantListQuery {
            sort_field: None,
            sort_order: None,
            ..Default::default()
        };
        assert_eq!(flat.order_clause(), " ORDER BY id DESC");
        let flat = WaitServantListQuery {
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(flat.order_clause(), " ORDER BY add_time ASC");
        // 空 sortItems ⇒ 回退单字段
        let q: ImConversationPageQuery =
            serde_json::from_str(r#"{"sortItems":[],"sortOrder":"asc"}"#).unwrap();
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
    }

    // ———————————————— 状态过滤 ————————————————

    #[test]
    fn status_filter_three_branches() {
        assert_eq!(status_filter(None), StatusFilter::None);
        assert_eq!(status_filter(Some(-2)), StatusFilter::None);
        assert_eq!(
            status_filter(Some(-1)),
            StatusFilter::In(vec![
                CONVERSATION_STATUS_IN_PROGRESS,
                CONVERSATION_STATUS_CLOSED
            ])
        );
        assert_eq!(status_filter(Some(0)), StatusFilter::Eq(0));
        assert_eq!(status_filter(Some(2)), StatusFilter::Eq(2));
    }

    // ———————————————— updateField 白名单 ————————————————

    #[test]
    fn update_field_whitelist_only_status() {
        assert!(is_allowed_update_field("status"));
        // 其它真实列能归一但不在白名单
        for field in [
            "id",
            "userId",
            "lastServantId",
            "addTime",
            "shopId",
            "remark",
            "summary",
            "isDelete",
            "is_show",
            "sort_order",
        ] {
            assert!(!is_allowed_update_field(field), "{field} 不应在白名单内");
        }
        assert_eq!(map_field_column("remark"), "remark");
        assert_eq!(map_field_column("isShow"), "id");
    }

    // ———————————————— 时间 ————————————————

    #[test]
    fn handel_time_matches_java() {
        assert_eq!(format_unix_time(None), "");
        assert_eq!(format_unix_time(Some(0)), "");
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(format_unix_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_unix_time_opt(None), None);
        assert_eq!(
            format_unix_time_opt(Some(1_700_000_000)).as_deref(),
            Some("2023-11-15 06:13:20")
        );
    }

    #[test]
    fn parse_ymd_uses_utc8_midnight() {
        // 2024-01-02 00:00:00 +08:00 = 2024-01-01T16:00:00Z
        assert_eq!(parse_timestamp_ymd("2024-01-02"), Some(1_704_124_800));
        assert_eq!(parse_timestamp_ymd(" 2024-01-02 "), Some(1_704_124_800));
        assert_eq!(parse_timestamp_ymd("bad-date"), None);
        assert_eq!(parse_timestamp_ymd(""), None);
    }

    #[test]
    fn parse_datetime_supports_java_date_to_timestamp_example() {
        // dateToTimestampExample：无冒号 ⇒ 当天 00:00:00
        assert_eq!(parse_timestamp_datetime("2024-01-02"), Some(1_704_124_800));
        // 到分钟补 :00
        assert_eq!(
            parse_timestamp_datetime("2024-01-02 03:04"),
            Some(1_704_135_840)
        );
        // 完整时间
        assert_eq!(
            parse_timestamp_datetime("2024-01-02 03:04:05"),
            Some(1_704_135_845)
        );
        assert_eq!(parse_timestamp_datetime(""), None);
        assert_eq!(parse_timestamp_datetime("nope"), None);
    }

    // ———————————————— VO 序列化 ————————————————

    #[test]
    fn vo_uses_camel_case_and_null_like_java() {
        let entity = ImConversation {
            id: 7,
            user_id: Some(3),
            last_servant_id: Some(0),
            add_time: Some(1_700_000_000),
            shop_id: Some(0),
            user_from: Some("h5".into()),
            status: Some(0),
            last_update_time: None,
            is_delete: Some(0),
            remark: "备注".into(),
            summary: "总结".into(),
        };
        let vo = conversation_base_vo(&entity);
        assert_eq!(vo.add_time.as_deref(), Some("2023-11-15 06:13:20"));
        assert_eq!(vo.last_update_time.as_deref(), Some(""));
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["userId"], 3);
        assert_eq!(json["lastServantId"], 0);
        assert_eq!(json["addTime"], "2023-11-15 06:13:20");
        assert_eq!(json["unreadMessageCount"], 0);

        let entity_vo = conversation_entity_vo(&entity);
        let json = serde_json::to_value(&entity_vo).unwrap();
        assert_eq!(json["addTime"], 1_700_000_000_i64);
        assert_eq!(json["lastUpdateTime"], serde_json::Value::Null);
    }

    #[test]
    fn message_vo_extend_carries_raw_json_string() {
        let vo = ImMessageVO {
            extend: Some(serde_json::Value::String("{\"a\":1}".into())),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["extend"], "{\"a\":1}");
    }
}
