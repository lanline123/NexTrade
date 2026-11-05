//! 电子卡券域 DTO / VO / 查询参数 / 纯函数。
//!
//! 对应 Java：
//! - `com.tigshop.bean.query.product.ECardPageQuery`（extends `BasePage`）
//! - `com.tigshop.bean.param.product.ECardSaveParam`
//! - `com.tigshop.bean.param.product.ECardEditParam`（extends `ECardSaveParam`）
//! - `com.tigshop.bean.vo.product.ECardVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! - `com.tigshop.common.constant.product.ECardConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.E_CARD_GROUP_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage` / `SortItem`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#buildSortOrder`
//! - `com.tigshop.common.config.TimestampToDateSerializer`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! # 与 Java 的对照要点
//!
//! - `ECardPageQuery` 同时有 `cardNumber` 与继承自 `BasePage` 的 `keyword`，
//!   但 `ECardServiceImpl#list` **只用 `keyword`** 对 `card_number` 做
//!   `LIKE`（`cardNumber` 字段未被读取）。本实现保留两字段，`card_number`
//!   仅作反序列化兼容。
//! - `ECardServiceImpl#list` 用 `buildSortOrder(BasePage)`（**会读
//!   `sortItems`**）；本域 `sort_items` 逐项追加 `ORDER BY`，为空时回退
//!   单字段排序（Java 原样）。
//! - `ECardVO` 的 `addTime` / `upTime` 在 Java 中先 `Long.toString()` 存进
//!   `String`，再由 `TimestampToDateSerializer` 按 `Asia/Shanghai` 转成
//!   `yyyy-MM-dd HH:mm:ss`；`0` / 空 ⇒ `""`。本实现直接格式化（UTC+8）。
//! - `updateField` 的允许字段是 `CheckFieldConstants.E_CARD_GROUP_FIELDS`
//!   = `{"is_use"}`（`ECardController` 也复用它，不是笔误）。
//! - `ECardConstants` 里 `@Size(max = 255)` 的 message 写的是「不能超过50」
//!   （原文如此），本实现按**真实上限 255 字符**执行、message 逐字符照抄。

use serde::{Deserialize, Serialize};

use crate::entities::ECard;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `BaseServiceImpl#getKeyColumn` → `card_id`）。
pub const KEY_COLUMN: &str = "card_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `cardId`）。
pub const KEY_PROPERTY: &str = "cardId";

/// `e_card` 的真实列清单（`python tools/schema_parser.py --table e_card`）。
///
/// 顺序与实体 [`crate::entities::ECard`] 的字段顺序一致。
pub const CARD_COLUMNS: [&str; 9] = [
    "card_id",
    "group_id",
    "card_number",
    "card_pwd",
    "is_use",
    "order_id",
    "order_item_id",
    "add_time",
    "up_time",
];

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.E_CARD_GROUP_FIELDS = {"is_use"}`）。
pub const E_CARD_FIELDS: [&str; 1] = ["is_use"];

/// Java `@Size(max = 255)` 的真实上限（message 写的是 50，见模块注释）。
pub const FIELD_MAX_CHARS: usize = 255;

/// 卡号必填（Java `@NotNull(message = "电子卡券名称不能为空")`）。
pub const CARD_NUMBER_REQUIRED: &str = "电子卡券名称不能为空";

/// 卡号超长（Java `@Size(max = 255, message = "电子卡券名称长度不能超过50")`）。
pub const CARD_NUMBER_OVER_LENGTH: &str = "电子卡券名称长度不能超过50";

/// 卡券 ID 必填（Java `@NotNull(message = "电子卡券id不能为空")`）。
pub const CARD_ID_REQUIRED: &str = "电子卡券id不能为空";

/// 卡券密码必填（Java `@NotNull(message = "电子卡券密码不能为空")`）。
pub const CARD_PWD_REQUIRED: &str = "电子卡券密码不能为空";

/// 卡券密码超长（Java `@Size(max = 255, message = "电子卡券密码长度不能超过50")`）。
pub const CARD_PWD_OVER_LENGTH: &str = "电子卡券密码长度不能超过50";

/// 分组 ID 必填（Java `@NotNull(message = "电子卡券分组id不能为空")`）。
pub const GROUP_ID_REQUIRED: &str = "电子卡券分组id不能为空";

/// 卡券已存在（Java `ECardConstants.CARD_NUMBER_EXISTS`）。
pub const CARD_NUMBER_EXISTS: &str = "电子卡券已存在";

/// 卡券不存在（Java `ECardConstants.CARD_NOT_EXISTS`）。
pub const CARD_NOT_EXISTS: &str = "电子卡券不存在";

/// 卡券已被订单占用（Java `ECardConstants.CARD_USED_BY_ORDER`）。
pub const CARD_USED_BY_ORDER: &str = "该卡券已被使用，无法修改!";

/// 字段值有误（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const INVALID_FIELD_VALUE: &str = "field 的值有误";

/// 主键为空（Java `OperateDTO` / `UpdateFieldDTO` 的 `@NotNull` 文案）。
pub const ID_REQUIRED: &str = "id不能为空";

/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// 未选择项目（Java `BatchDTO.ids` 的 `@NotEmpty` 文案）。
pub const UNSELECTED_ITEM: &str = "未选择项目";

/// 操作类型为空（Java `BatchDTO.type` 的 `@NotNull` 文案）。
pub const OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

// ——————————————————————————————————————————————
// 入参
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

/// 电子卡券列表查询（对应 Java `ECardPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardPageQuery {
    /// 卡号（Java DTO 有该字段，但 service 未使用；保留以兼容请求）
    pub card_number: Option<String>,
    /// 卡券分组 ID（`@NotNull(message = "电子卡券分组id不能为空")`）
    pub group_id: Option<i32>,
    /// 搜索关键字（`BasePage.keyword`，对 `card_number` 做 `LIKE`）
    pub keyword: Option<String>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 多字段排序（Java `buildSortOrder(BasePage)` 会读取；非空时优先）
    pub sort_items: Option<Vec<SortItem>>,
    /// 页码，从 1 开始（Java `BasePage.page`，null ⇒ 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，null ⇒ 15，上限 100）
    pub size: Option<u64>,
}

impl ECardPageQuery {
    /// 转成内部 [`PageQuery`]（Java `BasePage.getPage()` / `getSize()` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).min(100),
        }
    }

    /// 有效关键字（Java `StrUtil.isNotBlank(keyword)`：去空白后判空，
    /// `LIKE` 绑定原始值）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.trim().is_empty())
    }

    /// 解析 ORDER BY 子句（列名来自白名单，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(BasePage)` 等价：
    /// - `sortItems` 非空：逐项追加（`asc` 升序，其它一律降序；空 field 跳过；
    ///   未识别字段回退主键列）；全部项都无效 ⇒ 不追加排序
    /// - `sortItems` 为空 / 缺失：回退三参重载语义 —— 未识别字段回退主键，
    ///   `asc` 升序，`desc`/空降序，其它值不追加排序
    #[must_use]
    pub fn order_clause(&self) -> String {
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
                    let column = map_order_column(field);
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

/// 排序字段 → 列名（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中，未命中回退主键列。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "cardId" | "card_id" => "card_id",
        "groupId" | "group_id" => "group_id",
        "cardNumber" | "card_number" => "card_number",
        "cardPwd" | "card_pwd" => "card_pwd",
        "isUse" | "is_use" => "is_use",
        "orderId" | "order_id" => "order_id",
        "orderItemId" | "order_item_id" => "order_item_id",
        "addTime" | "add_time" => "add_time",
        "upTime" | "up_time" => "up_time",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（Java `getColumnByPropertyName`：
/// 属性名/列名命中返回真实列，否则回退主键列）。
#[must_use]
pub fn map_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// `updateField` 白名单校验（Java `Arrays.asList(E_CARD_GROUP_FIELDS)
/// .contains(getColumnByPropertyName(field))`）。
#[must_use]
pub fn is_allowed_update_field(field: &str) -> bool {
    E_CARD_FIELDS.contains(&map_field_column(field))
}

/// 电子卡券创建入参（对应 Java `ECardSaveParam`）。
///
/// Java 校验注解：
/// - `cardNumber`：`@NotNull(message = "电子卡券名称不能为空")`
///   + `@Size(max = 255, message = "电子卡券名称长度不能超过50")`
/// - `cardPwd`：`@NotNull(message = "电子卡券密码不能为空")`
///   + `@Size(max = 255, message = "电子卡券密码长度不能超过50")`
/// - `groupId`：`@NotNull(message = "电子卡券分组id不能为空")`
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardSaveParam {
    /// 卡号
    pub card_number: Option<String>,
    /// 卡号密码
    pub card_pwd: Option<String>,
    /// 卡券分组 ID
    pub group_id: Option<i32>,
    /// 0:未使用 1:已使用（DTO 可空；Java NOT_NULL 策略下不传则用列默认值 0）
    pub is_use: Option<i32>,
}

/// 电子卡券更新入参（对应 Java `ECardEditParam extends ECardSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardEditParam {
    /// 卡券 ID（`@NotNull(message = "电子卡券id不能为空")`）
    pub card_id: Option<i32>,
    /// 卡号（继承自 `ECardSaveParam`）
    pub card_number: Option<String>,
    /// 卡号密码（继承）
    pub card_pwd: Option<String>,
    /// 卡券分组 ID（继承）
    pub group_id: Option<i32>,
    /// 是否使用（继承；`None` ⇒ 不更新该列）
    pub is_use: Option<i32>,
}

/// 单 ID 操作请求（对应 Java `bean.dto.common.OperateDTO`，只用到 `id`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作请求（对应 Java `bean.dto.common.BatchDTO`）。
///
/// `ECardController` 带 `@Validated`，`ids @NotEmpty` / `type @NotNull` 生效。
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

/// 通用字段更新请求（对应 Java `bean.dto.common.UpdateFieldDTO`）。
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

/// 电子卡券 VO（对应 Java `ECardVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ECardVO {
    /// 卡券 ID
    pub card_id: i32,
    /// 卡券分组 ID
    pub group_id: i32,
    /// 卡号
    pub card_number: String,
    /// 卡号密码
    pub card_pwd: String,
    /// 0:未使用 1:已使用
    pub is_use: i32,
    /// 订单 ID（0 表示未绑定）
    pub order_id: i32,
    /// 订单明细 ID（0 表示未绑定）
    pub order_item_id: i32,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，0/空 ⇒ `""`）
    pub add_time: String,
    /// 更新时间（`yyyy-MM-dd HH:mm:ss`，0/空 ⇒ `""`）
    pub up_time: String,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8）。
///
/// 对应 Java `TimestampToDateSerializer`（`Asia/Shanghai`）；`None` / `0`
/// ⇒ `""`（序列化器在 `timestamp <= 0` 时写空串）。
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

/// 实体 → VO（对应 Java `new ECardVO(eCard)`）。
#[must_use]
pub fn card_to_vo(entity: &ECard) -> ECardVO {
    ECardVO {
        card_id: entity.card_id,
        group_id: entity.group_id,
        card_number: entity.card_number.clone(),
        card_pwd: entity.card_pwd.clone(),
        is_use: entity.is_use,
        order_id: entity.order_id,
        order_item_id: entity.order_item_id,
        add_time: format_unix_time(entity.add_time),
        up_time: format_unix_time(entity.up_time),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 查询参数 ————————————————

    #[test]
    fn page_query_accepts_java_param_names() {
        let q: ECardPageQuery = serde_json::from_str(
            r#"{"groupId":3,"cardNumber":"SN1","keyword":"SN","page":2,"size":30,
                "sortField":"addTime","sortOrder":"asc"}"#,
        )
        .expect("ECardPageQuery 应接受 camelCase Java 参数名");
        assert_eq!(q.group_id, Some(3));
        assert_eq!(q.card_number.as_deref(), Some("SN1"));
        assert_eq!(q.effective_keyword(), Some("SN"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
    }

    #[test]
    fn page_query_defaults_match_base_page() {
        let q: ECardPageQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.effective_keyword(), None);
        // 空 sortField ⇒ 主键列；空 sortOrder ⇒ 降序
        assert_eq!(q.order_clause(), " ORDER BY card_id DESC");
    }

    #[test]
    fn sort_items_take_priority_over_single_field() {
        // Java `buildSortOrder(BasePage)`：sortItems 非空时逐项追加
        let q: ECardPageQuery = serde_json::from_str(
            r#"{"sortField":"cardNumber","sortOrder":"asc",
                "sortItems":[{"field":"addTime","order":"asc"},{"field":"group_id","order":"desc"},
                             {"field":"  ","order":"asc"}]}"#,
        )
        .unwrap();
        assert_eq!(
            q.order_clause(),
            " ORDER BY add_time ASC, group_id DESC",
            "空 field 跳过；非 asc 一律降序"
        );
        // 未识别字段回退主键列
        let q: ECardPageQuery =
            serde_json::from_str(r#"{"sortItems":[{"field":"nope","order":"desc"}]}"#).unwrap();
        assert_eq!(q.order_clause(), " ORDER BY card_id DESC");
        // 全部无效项 ⇒ 不追加 ORDER BY
        let q: ECardPageQuery =
            serde_json::from_str(r#"{"sortItems":[{"field":"","order":"asc"}]}"#).unwrap();
        assert_eq!(q.order_clause(), "");
        // 空数组等价缺失 ⇒ 回退单字段
        let q: ECardPageQuery =
            serde_json::from_str(r#"{"sortItems":[],"sortOrder":"asc"}"#).unwrap();
        assert_eq!(q.order_clause(), " ORDER BY card_id ASC");
    }

    #[test]
    fn order_clause_follows_java_three_branches() {
        for (field, column) in [
            ("cardNumber", "card_number"),
            ("card_pwd", "card_pwd"),
            ("isUse", "is_use"),
            ("orderId", "order_id"),
            ("up_time", "up_time"),
        ] {
            let q = ECardPageQuery {
                sort_field: Some(field.into()),
                sort_order: Some("DESC".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), format!(" ORDER BY {column} DESC"));
        }
        // 未识别字段回退主键（防注入）
        let q = ECardPageQuery {
            sort_field: Some("x; DROP TABLE e_card".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY card_id ASC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY
        let q = ECardPageQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    #[test]
    fn map_order_column_rejects_unknown() {
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("cardNumber"), "card_number");
        assert_eq!(map_order_column("card_number"), "card_number");
    }

    // ———————————————— updateField 白名单 ————————————————

    #[test]
    fn update_field_whitelist_only_is_use() {
        assert_eq!(E_CARD_FIELDS, ["is_use"]);
        assert!(is_allowed_update_field("isUse"));
        assert!(is_allowed_update_field("is_use"));
        // 其它真实列能归一但不在白名单 ⇒ 「field 的值有误」
        for input in [
            "cardId",
            "card_id",
            "cardNumber",
            "card_number",
            "group_id",
            "orderId",
            "addTime",
            "nope",
        ] {
            assert!(!is_allowed_update_field(input), "{input} 不应在白名单内");
        }
        assert_eq!(map_field_column("cardNumber"), "card_number");
    }

    // ———————————————— VO ————————————————

    fn entity() -> ECard {
        ECard {
            card_id: 7,
            group_id: 3,
            card_number: "SN001".into(),
            card_pwd: "PWD".into(),
            is_use: 0,
            order_id: 0,
            order_item_id: 0,
            add_time: Some(1_700_000_000),
            up_time: Some(1_700_000_100),
        }
    }

    #[test]
    fn card_vo_maps_all_fields_and_formats_times() {
        let vo = card_to_vo(&entity());
        assert_eq!(vo.card_id, 7);
        assert_eq!(vo.group_id, 3);
        assert_eq!(vo.card_number, "SN001");
        assert_eq!(vo.card_pwd, "PWD");
        assert_eq!(vo.is_use, 0);
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(vo.add_time, "2023-11-15 06:13:20");
        assert_eq!(vo.up_time, "2023-11-15 06:15:00");

        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["cardId"], 7);
        assert_eq!(json["cardNumber"], "SN001");
        assert_eq!(json["orderItemId"], 0);
        assert_eq!(json["addTime"], "2023-11-15 06:13:20");
    }

    #[test]
    fn zero_or_missing_time_serializes_empty() {
        assert_eq!(format_unix_time(None), "");
        assert_eq!(format_unix_time(Some(0)), "");
        let mut e = entity();
        e.add_time = None;
        e.up_time = Some(0);
        let vo = card_to_vo(&e);
        assert_eq!(vo.add_time, "");
        assert_eq!(vo.up_time, "");
    }

    #[test]
    fn save_and_edit_params_parse() {
        let s: ECardSaveParam =
            serde_json::from_str(r#"{"cardNumber":"SN","cardPwd":"PW","groupId":2,"isUse":1}"#)
                .unwrap();
        assert_eq!(s.card_number.as_deref(), Some("SN"));
        assert_eq!(s.card_pwd.as_deref(), Some("PW"));
        assert_eq!(s.group_id, Some(2));
        assert_eq!(s.is_use, Some(1));

        let e: ECardEditParam =
            serde_json::from_str(r#"{"cardId":9,"cardNumber":"SN","cardPwd":"PW","groupId":2}"#)
                .unwrap();
        assert_eq!(e.card_id, Some(9));
        assert_eq!(e.is_use, None);
    }
}
