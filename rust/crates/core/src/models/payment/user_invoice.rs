//! 发票资质域（payment::user_invoice）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.finance.{UserInvoiceCreateDTO, UserInvoiceListDTO, UserInvoiceUpdateDTO}`
//! - `com.tigshop.bean.dto.common.{OperateDTO, BatchDTO, UpdateFieldDTO}`
//! - `com.tigshop.bean.vo.finance.UserInvoiceVO`
//! - `com.tigshop.common.constant.finance.UserInvoiceConstants.STATUS_NAME`
//!
//! 实体 `tigshop_core::entities::UserInvoice`（表 `user_invoice`，15 列）已由
//! schema 生成；本表没有金额列，金额 `Decimal` 约定不适用。
//!
//! # 关键语义
//!
//! - `list` 的 SQL 来自 `UserInvoiceServiceImpl#list`（MP LambdaQueryWrapper）：
//!   `status` 仅在 `!= null && > -1` 时过滤；`keyword` 匹配
//!   `(company_name LIKE ? OR user_id IN (username LIKE ? 的 user_id))`
//!   （Java 先查用户名命中集，集合为空时只按 `company_name` 过滤）。
//! - `addTime` 在 list 的 VO 里由秒级时间戳格式化为 `yyyy-MM-dd HH:mm:ss`；
//!   detail 只做 `copyProperties`（VO 是 String、实体是 Integer，类型不符被跳过）
//!   ⇒ detail 的 `addTime` 为 **null**。
//! - `statusName` 仅在 list 里派生（`STATUS_NAME={1:审核通过,2:待审核,3:审核未通过}`，
//!   未命中如 0 → null）；detail 不设置。
//! - `@Sensitive(type = PHONE)`（`companyPhone` / `mobile`）只在
//!   `tigshop.is-demo: 1` 的演示站生效，脱敏逻辑在服务层（`IS_DEMO` 常量）。
//! - `updateField` 白名单 `GENERAL_FIELDS = {"is_show","sort_order","status"}`，
//!   本表只有 `status` 命中，其它字段返回「field 的值有误」。
//! - `batch` 仅 `type = "del"` 生效，其余静默 `false`（控制器 void）。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `getKeyColumn` → `invoice_id`）。
pub const KEY_COLUMN: &str = "invoice_id";
/// 主键属性名（Java `getKeyProperty` → `invoiceId`）。
pub const KEY_PROPERTY: &str = "invoiceId";
/// `updateField` 白名单（Java `CheckFieldConstants.GENERAL_FIELDS`）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 专用发票审核状态：审核通过（Java `UserInvoiceConstants.STATUS_APPROVED`）。
pub const STATUS_APPROVED: i32 = 1;
/// 专用发票审核状态：待审核（Java `STATUS_AUDIT`）。
pub const STATUS_AUDIT: i32 = 2;
/// 专用发票审核状态：审核未通过（Java `STATUS_REJECTED`）。
pub const STATUS_REJECTED: i32 = 3;

/// `id不能为空`（Java `OperateDTO.id` / `UpdateFieldDTO.id` 的 `@NotNull` 文案）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// `发票资质id不能为空`（Java `UserInvoiceConstants.USER_INVOICE_ID_NOT_NULL`，
/// `UserInvoiceUpdateDTO.invoiceId` 的 `@NotNull` 文案）。
pub const MSG_INVOICE_ID_REQUIRED: &str = "发票资质id不能为空";
/// `字段名不能为空`（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// `值不能为空`（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// `field 的值有误`（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// `未选择项目`（Java `BatchDTO.ids` 的 `@NotEmpty` 文案，服务层防御）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// `操作类型不能为空`（Java `BatchDTO.type` 的 `@NotNull` 文案，服务层防御）。
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";
/// 发票资质不存在（Java detail 对空记录会 NPE，本实现改为业务 500）。
pub const MSG_NOT_EXISTS: &str = "发票资质不存在";

/// 审核状态文案（Java `UserInvoiceConstants.STATUS_NAME.get(status)`：
/// 未命中（含 `0 未申请`、未知值）返回 `None` = JSON null）。
#[must_use]
pub fn status_name(status: i32) -> Option<&'static str> {
    match status {
        STATUS_APPROVED => Some("审核通过"),
        STATUS_AUDIT => Some("待审核"),
        STATUS_REJECTED => Some("审核未通过"),
        _ => None,
    }
}

/// 排序字段 → 列名（Java `getColumnByPropertyName`：属性名或列名均可，
/// 未知回退主键列 `invoice_id`，防 SQL 注入）。
#[must_use]
pub fn map_user_invoice_column(field: &str) -> &'static str {
    match field {
        "invoiceId" | "invoice_id" => "invoice_id",
        "userId" | "user_id" => "user_id",
        "status" => "status",
        "applyReply" | "apply_reply" => "apply_reply",
        "addTime" | "add_time" => "add_time",
        "titleType" | "title_type" => "title_type",
        "companyName" | "company_name" => "company_name",
        "companyCode" | "company_code" => "company_code",
        "companyAddress" | "company_address" => "company_address",
        "companyPhone" | "company_phone" => "company_phone",
        "companyBank" | "company_bank" => "company_bank",
        "companyAccount" | "company_account" => "company_account",
        "mobile" => "mobile",
        "email" => "email",
        "invoiceContent" | "invoice_content" => "invoice_content",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段归一 + 白名单判定：本表只有 `status` 命中 GENERAL_FIELDS。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_user_invoice_column(field);
    if GENERAL_FIELDS.contains(&column) {
        Some(column)
    } else {
        None
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`None`/`0` ⇒ `""`
/// （Java `TigUtils.handelTime`；list 只在 list 里格式化）。
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

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `UserInvoiceListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserInvoiceListQuery {
    /// 页码（Java `BasePage.page`，缺省 1）
    pub page: Option<i64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
    /// 关键字（单位名称或会员用户名）
    pub keyword: Option<String>,
    /// 审核状态（Java `status`，`> -1` 才过滤）
    pub status: Option<i32>,
}

impl UserInvoiceListQuery {
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

    /// ORDER BY（三参 `buildSortOrder`：默认主键降序；未知方向不排序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_user_invoice_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }

    /// 关键字（Java `StringUtils.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// 状态是否参与过滤（Java `status != null && status > -1`）。
    #[must_use]
    pub fn effective_status(&self) -> Option<i32> {
        self.status.filter(|s| *s > -1)
    }
}

/// 创建入参（Java `UserInvoiceCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserInvoiceCreateDTO {
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 审核状态
    pub status: Option<i32>,
    /// 审核失败时的回复内容
    pub apply_reply: Option<String>,
    /// 添加时间（创建时被当前时间覆盖）
    pub add_time: Option<i32>,
    /// 抬头：1 个人 / 2 企业
    pub title_type: Option<i32>,
    /// 单位名称
    pub company_name: Option<String>,
    /// 纳税人识别号
    pub company_code: Option<String>,
    /// 单位地址
    pub company_address: Option<String>,
    /// 单位电话
    pub company_phone: Option<String>,
    /// 开户银行
    pub company_bank: Option<String>,
    /// 开户账号
    pub company_account: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 发票内容
    pub invoice_content: Option<String>,
}

/// 更新入参（Java `UserInvoiceUpdateDTO`；`invoiceId` 必填）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserInvoiceUpdateDTO {
    /// 发票信息 ID（`@NotNull`，文案「发票资质id不能为空」）
    pub invoice_id: Option<i32>,
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 审核状态
    pub status: Option<i32>,
    /// 审核失败时的回复内容
    pub apply_reply: Option<String>,
    /// 抬头：1 个人 / 2 企业
    pub title_type: Option<i32>,
    /// 单位名称
    pub company_name: Option<String>,
    /// 纳税人识别号
    pub company_code: Option<String>,
    /// 单位地址
    pub company_address: Option<String>,
    /// 单位电话
    pub company_phone: Option<String>,
    /// 开户银行
    pub company_bank: Option<String>,
    /// 开户账号
    pub company_account: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 发票内容
    pub invoice_content: Option<String>,
}

/// 单 ID 操作（Java `OperateDTO`，本控制器只用到 `id`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 字段更新（Java `UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 发票资质 VO（Java `UserInvoiceVO`）。
///
/// `companyPhone` / `mobile` 在 Java 上带 `@Sensitive(type = PHONE)`：
/// 仅演示站（`tigshop.is-demo: 1`）序列化时脱敏，服务层按此处理。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInvoiceVO {
    /// 发票信息 ID
    pub invoice_id: i32,
    /// 会员 ID
    pub user_id: i32,
    /// 会员名称（LEFT JOIN `user.username`，可空）
    pub username: Option<String>,
    /// 审核状态
    pub status: i32,
    /// 审核状态文案（list 派生；detail Java 不设置 ⇒ null）
    pub status_name: Option<String>,
    /// 审核失败时的回复内容
    pub apply_reply: String,
    /// 添加时间（list 为格式化字符串；detail Java 类型不符未拷贝 ⇒ null）
    pub add_time: Option<String>,
    /// 抬头：1 个人 / 2 企业
    pub title_type: i32,
    /// 单位名称
    pub company_name: String,
    /// 纳税人识别号
    pub company_code: String,
    /// 单位地址
    pub company_address: String,
    /// 单位电话（演示站脱敏）
    pub company_phone: String,
    /// 开户银行
    pub company_bank: String,
    /// 开户账号
    pub company_account: String,
    /// 手机号（演示站脱敏）
    pub mobile: String,
    /// 邮箱
    pub email: String,
    /// 发票内容
    pub invoice_content: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_names_match_java_constant_map() {
        assert_eq!(status_name(STATUS_APPROVED), Some("审核通过"));
        assert_eq!(status_name(STATUS_AUDIT), Some("待审核"));
        assert_eq!(status_name(STATUS_REJECTED), Some("审核未通过"));
        // 0 = 未申请，Java Map 里没有 ⇒ null
        assert_eq!(status_name(0), None);
        assert_eq!(status_name(99), None);
    }

    #[test]
    fn update_field_only_status_is_allowed() {
        assert_eq!(resolve_update_field("status"), Some("status"));
        for field in [
            "invoiceId",
            "companyName",
            "company_name",
            "mobile",
            "is_show",
            "sort_order",
            "nope",
            "",
        ] {
            assert_eq!(resolve_update_field(field), None, "{field}");
        }
    }

    #[test]
    fn paging_and_order_follow_base_page() {
        let q = UserInvoiceListQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.order_clause(), " ORDER BY invoice_id DESC");
        let q = UserInvoiceListQuery {
            page: Some(2),
            size: Some(10),
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (10, 10));
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
        // 列名直传也接受
        assert_eq!(map_user_invoice_column("company_name"), "company_name");
        // 未知/注入字符串回退主键
        let q = UserInvoiceListQuery {
            sort_field: Some("x; DROP TABLE user_invoice".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY invoice_id DESC");
        // 非 asc/desc 的方向不产生 ORDER BY
        let q = UserInvoiceListQuery {
            sort_order: Some("sideways".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    #[test]
    fn status_filter_requires_greater_than_minus_one() {
        // Java: `if (status != null && status > -1)`
        let q = UserInvoiceListQuery {
            status: Some(0),
            ..Default::default()
        };
        assert_eq!(q.effective_status(), Some(0));
        let q = UserInvoiceListQuery {
            status: Some(-1),
            ..Default::default()
        };
        assert_eq!(q.effective_status(), None);
        assert_eq!(UserInvoiceListQuery::default().effective_status(), None);
    }

    #[test]
    fn query_and_dto_fields_are_camel_case() {
        let q: UserInvoiceListQuery = serde_json::from_value(serde_json::json!({
            "page": 2, "size": 20, "sortField": "addTime", "sortOrder": "desc",
            "keyword": "TigShop", "status": 2
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.sort_field.as_deref(), Some("addTime"));
        assert_eq!(q.keyword.as_deref(), Some("TigShop"));
        assert_eq!(q.status, Some(2));

        let dto: UserInvoiceUpdateDTO = serde_json::from_value(serde_json::json!({
            "invoiceId": 7, "companyName": "TigShop", "titleType": 2
        }))
        .unwrap();
        assert_eq!(dto.invoice_id, Some(7));
        assert_eq!(dto.company_name.as_deref(), Some("TigShop"));
        assert_eq!(dto.title_type, Some(2));
        // 缺参不报错（Java 全部可选）
        let empty: UserInvoiceUpdateDTO = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(empty.invoice_id.is_none());
    }

    #[test]
    fn add_time_formatting_matches_java() {
        assert_eq!(format_unix_time(None), "");
        assert_eq!(format_unix_time(Some(0)), "");
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(format_unix_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }

    #[test]
    fn vo_serializes_camel_case_with_nullable_fields() {
        let vo = UserInvoiceVO {
            invoice_id: 7,
            user_id: 3,
            username: Some("bob".into()),
            status: STATUS_AUDIT,
            status_name: Some("待审核".into()),
            apply_reply: String::new(),
            add_time: Some("2024-12-01 10:00:00".into()),
            title_type: 2,
            company_name: "TigShop".into(),
            company_code: "91360000".into(),
            company_address: "南昌".into(),
            company_phone: "13812348000".into(),
            company_bank: "工行".into(),
            company_account: "6222".into(),
            mobile: "13812348000".into(),
            email: "a@b.com".into(),
            invoice_content: "商品明细".into(),
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["invoiceId"], 7);
        assert_eq!(v["statusName"], "待审核");
        assert_eq!(v["companyPhone"], "13812348000");
        // detail 语义：这两个字段可为 null
        let detail = UserInvoiceVO {
            status_name: None,
            add_time: None,
            ..vo
        };
        let v = serde_json::to_value(&detail).unwrap();
        assert!(v["statusName"].is_null());
        assert!(v["addTime"].is_null());
    }
}
