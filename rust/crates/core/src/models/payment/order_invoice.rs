//! 发票申请域（payment::order_invoice）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.finance.orderinvoice.OrderInvoicePageQuery`
//! - `com.tigshop.bean.param.finance.orderinvoice.{OrderInvoiceSaveParam,
//!   OrderInvoiceEditParam}`
//! - `com.tigshop.bean.vo.finance.OrderInvoiceVO`
//! - `com.tigshop.bean.enums.finance.{OrderInvoiceStatusEnum, OrderInvoiceType}`
//! - `com.tigshop.bean.dto.common.{OperateDTO, BatchDTO, UpdateFieldDTO}`
//! - `com.tigshop.service.finance.impl.OrderInvoiceServiceImpl`
//!
//! 实体 `tigshop_core::entities::OrderInvoice`（表 `order_invoice`，21 列）已由
//! schema 生成；金额 `amount` 是 `decimal(10,2)` → `Decimal`。
//!
//! # 关键语义
//!
//! - `list` 的 SQL 来自 `OrderInvoiceMapper.xml#orderInvoicePage`：
//!   `left join order / user`，`keyword` 同时匹配 `user.username` 与
//!   `oi.company_name`；`status` / `invoiceType` 可选；排序三参
//!   `buildSortOrder`（默认主键降序）。
//! - `addTime` 在 VO 里由秒级时间戳格式化为 `yyyy-MM-dd HH:mm:ss`
//!   （Java 仅在非空白时格式化）。
//! - `updateField` 白名单是 `CheckFieldConstants.GENERAL_FIELDS`，本表只有
//!   `status` 命中。
//! - `batch` 仅 `type = "del"` 时 `removeByIds`，其余静默 false（控制器 void）。
//! - `update` 会把「订单存在时的 `invoicing_time` / 附件 JSON」写入实体，
//!   并把发票快照回写 `order.invoice_data`（订单侧字段，未迁移，见服务层）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// `order_invoice` 的 21 个列（顺序与实体一致）。
pub const INVOICE_COLUMNS: [&str; 21] = [
    "id",
    "user_id",
    "order_id",
    "invoice_type",
    "status",
    "apply_reply",
    "title_type",
    "company_code",
    "company_name",
    "company_address",
    "company_phone",
    "company_bank",
    "company_account",
    "invoice_content",
    "invoice_no",
    "amount",
    "mobile",
    "email",
    "add_time",
    "invoice_attachment",
    "invoicing_time",
];

/// 主键列（Java `getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";
/// 主键属性名（Java `getKeyProperty` → `id`）。
pub const KEY_PROPERTY: &str = "id";

/// `updateField` 白名单（Java `CheckFieldConstants.GENERAL_FIELDS`）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 状态：待处理。
pub const STATUS_WAIT: i32 = 0;
/// 状态：已开。
pub const STATUS_PASS: i32 = 1;
/// 状态：失败/作废。
pub const STATUS_REFUSE: i32 = 2;

/// 发票类型：普通发票。
pub const INVOICE_TYPE_ORDINARY: i32 = 1;
/// 发票类型：增值税专用发票。
pub const INVOICE_TYPE_SPECIAL: i32 = 2;

/// 发票申请不存在（Java `OrderInvoiceConstants.ORDER_INVOICE_NOT_EXIST`）。
pub const MSG_NOT_EXISTS: &str = "发票申请不存在";
/// 主键为空（Java `OperateDTO` 的 `@NotNull` 文案）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// 字段值有误（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// 未选择项目（Java `BatchDTO.ids` 的 `@NotEmpty` 文案；本控制器无 `@Valid`，
/// 仅作服务层防御）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// 操作类型为空。
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";
/// 单位/个人名称必填（`OrderInvoiceSaveParam.companyName` 的 `@NotNull`）。
pub const MSG_COMPANY_NAME_REQUIRED: &str = "单位/个人名称不能为空";
/// 单位/个人名称超长（`@Size(max = 100)`）。
pub const MSG_COMPANY_NAME_TOO_LONG: &str = "单位/个人名称最多100个字符";

// ————————————————————— 枚举名 —————————————————————

/// 发票状态名（Java `OrderInvoiceStatusEnum.getStatusName`；未知返回 `""`）。
#[must_use]
pub fn status_name(status: i32) -> &'static str {
    match status {
        STATUS_WAIT => "待处理",
        STATUS_PASS => "已开",
        STATUS_REFUSE => "失败/作废",
        _ => "",
    }
}

/// 发票类型名（Java `OrderInvoiceType.getTypeName`；未知返回 `""`）。
#[must_use]
pub fn invoice_type_name(invoice_type: i32) -> &'static str {
    match invoice_type {
        INVOICE_TYPE_ORDINARY => "普通发票",
        INVOICE_TYPE_SPECIAL => "增值税专用发票",
        _ => "",
    }
}

/// 排序字段 → 列名（Java `getColumnByPropertyName`，未知回退主键）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "userId" | "user_id" => "user_id",
        "orderId" | "order_id" => "order_id",
        "invoiceType" | "invoice_type" => "invoice_type",
        "status" => "status",
        "applyReply" | "apply_reply" => "apply_reply",
        "titleType" | "title_type" => "title_type",
        "companyCode" | "company_code" => "company_code",
        "companyName" | "company_name" => "company_name",
        "companyAddress" | "company_address" => "company_address",
        "companyPhone" | "company_phone" => "company_phone",
        "companyBank" | "company_bank" => "company_bank",
        "companyAccount" | "company_account" => "company_account",
        "invoiceContent" | "invoice_content" => "invoice_content",
        "invoiceNo" | "invoice_no" => "invoice_no",
        "amount" => "amount",
        "mobile" => "mobile",
        "email" => "email",
        "addTime" | "add_time" => "add_time",
        "invoiceAttachment" | "invoice_attachment" => "invoice_attachment",
        "invoicingTime" | "invoicing_time" => "invoicing_time",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段归一 + 白名单判定：仅 `status` 命中 GENERAL_FIELDS。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    if GENERAL_FIELDS.contains(&column) {
        Some(column)
    } else {
        None
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`null`/`0` ⇒ `""`
/// （Java `DateUtil.format`；list 只在 `addTime` 非空白时格式化）。
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

/// `invoice_attachment` JSON 文本 → `Vec<Value>`（Java `JSON.parseArray`）。
///
/// `None` / 空串 → `None`（Java 仅在非空白时解析）；非法 JSON → `None`
/// （Java 抛异常 ⇒ 500；本实现容错，见 `uncertain_points`）。
#[must_use]
pub fn parse_attachment(raw: Option<&str>) -> Option<Vec<serde_json::Value>> {
    let raw = raw?.trim();
    if raw.is_empty() {
        return None;
    }
    serde_json::from_str::<Vec<serde_json::Value>>(raw).ok()
}

/// `Vec<Value>` → JSON 文本（Java `JSONArray.toJSONString`）。
#[must_use]
pub fn attachment_to_json(items: &[serde_json::Value]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `OrderInvoicePageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoicePageQuery {
    /// 状态
    pub status: Option<i32>,
    /// 发票类型
    pub invoice_type: Option<i32>,
    /// 关键字（用户名 / 单位名称）
    pub keyword: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数（Java `size`）
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl OrderInvoicePageQuery {
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

    /// ORDER BY（三参 `buildSortOrder`：默认主键降序）。
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

    /// 关键字是否参与过滤（Java `keyword != null && keyword != ''`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }
}

/// 创建入参（Java `OrderInvoiceSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceSaveParam {
    /// 订单发票申请 ID（Java 会 copy 进实体；新建时一般传 null）
    pub id: Option<i32>,
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 订单 ID
    pub order_id: Option<i32>,
    /// 发票类型
    pub invoice_type: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    /// 失败回复
    pub apply_reply: Option<String>,
    /// 抬头类型
    pub title_type: Option<i32>,
    /// 纳税人识别号
    pub company_code: Option<String>,
    /// 个人/单位名称（`@NotNull` + `@Size(max = 100)`）
    pub company_name: Option<String>,
    /// 单位地址
    pub company_address: Option<String>,
    /// 单位电话
    pub company_phone: Option<String>,
    /// 开户银行
    pub company_bank: Option<String>,
    /// 银行账号
    pub company_account: Option<String>,
    /// 发票内容
    pub invoice_content: Option<String>,
    /// 发票号码
    pub invoice_no: Option<String>,
    /// 发票金额
    pub amount: Option<Decimal>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 申请时间（秒级时间戳）
    pub add_time: Option<i64>,
}

impl OrderInvoiceSaveParam {
    /// 注解校验：`companyName` 必填且 ≤100 字符。
    pub fn validate(&self) -> Result<(), String> {
        match self.company_name.as_deref() {
            None => Err(MSG_COMPANY_NAME_REQUIRED.to_string()),
            Some(name) if name.trim().is_empty() => Err(MSG_COMPANY_NAME_REQUIRED.to_string()),
            Some(name) if name.chars().count() > 100 => Err(MSG_COMPANY_NAME_TOO_LONG.to_string()),
            Some(_) => Ok(()),
        }
    }
}

/// 编辑入参（Java `OrderInvoiceEditParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceEditParam {
    /// 发票申请 ID
    pub id: Option<i32>,
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 订单 ID
    pub order_id: Option<i32>,
    /// 发票类型
    pub invoice_type: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    /// 失败回复
    pub apply_reply: Option<String>,
    /// 抬头类型
    pub title_type: Option<i32>,
    /// 纳税人识别号
    pub company_code: Option<String>,
    /// 个人/单位名称
    pub company_name: Option<String>,
    /// 单位地址
    pub company_address: Option<String>,
    /// 单位电话
    pub company_phone: Option<String>,
    /// 开户银行
    pub company_bank: Option<String>,
    /// 银行账号
    pub company_account: Option<String>,
    /// 发票内容
    pub invoice_content: Option<String>,
    /// 发票号码
    pub invoice_no: Option<String>,
    /// 发票金额
    pub amount: Option<Decimal>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 申请时间（秒级时间戳）
    pub add_time: Option<i32>,
    /// 发票附件
    pub invoice_attachment: Option<Vec<serde_json::Value>>,
}

/// 单 ID 操作（Java `OperateDTO`）。
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

/// 发票申请 VO（Java `OrderInvoiceVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderInvoiceVO {
    pub id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    pub order_id: i32,
    pub order_sn: Option<String>,
    pub invoice_type: i32,
    pub invoice_type_name: String,
    pub status: i32,
    pub status_name: String,
    pub apply_reply: String,
    pub title_type: i32,
    pub company_code: String,
    pub company_name: String,
    pub company_address: String,
    pub company_phone: String,
    pub company_bank: String,
    pub company_account: String,
    pub invoice_content: String,
    pub invoice_no: String,
    pub amount: Decimal,
    pub mobile: String,
    pub email: String,
    /// Java 未赋值 ⇒ null
    pub order_invoice_add_time: Option<i32>,
    /// 申请时间（格式化字符串；Java 仅在原值非空白时格式化）
    pub add_time: String,
    pub invoice_attachment: Option<Vec<serde_json::Value>>,
    /// Java 未赋值 ⇒ null
    pub invoice_time: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_names_match_java() {
        assert_eq!(status_name(STATUS_WAIT), "待处理");
        assert_eq!(status_name(STATUS_PASS), "已开");
        assert_eq!(status_name(STATUS_REFUSE), "失败/作废");
        assert_eq!(status_name(9), "");
        assert_eq!(invoice_type_name(INVOICE_TYPE_ORDINARY), "普通发票");
        assert_eq!(invoice_type_name(INVOICE_TYPE_SPECIAL), "增值税专用发票");
        assert_eq!(invoice_type_name(0), "");
    }

    #[test]
    fn update_field_only_status_is_allowed() {
        assert_eq!(resolve_update_field("status"), Some("status"));
        // 其它真实列能归一但不在 GENERAL_FIELDS
        for field in [
            "id",
            "userId",
            "orderId",
            "invoice_type",
            "companyName",
            "amount",
            "is_show",
            "sort_order",
            "nope",
        ] {
            assert_eq!(resolve_update_field(field), None, "{field}");
        }
    }

    #[test]
    fn page_query_paging_and_order() {
        let q = OrderInvoicePageQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
        let q = OrderInvoicePageQuery {
            page: Some(2),
            size: Some(10),
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (10, 10));
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
        // 未识别字段回退主键
        let q = OrderInvoicePageQuery {
            sort_field: Some("x; DROP TABLE order_invoice".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
    }

    #[test]
    fn save_param_validates_company_name() {
        let mut p = OrderInvoiceSaveParam::default();
        assert_eq!(p.validate().unwrap_err(), MSG_COMPANY_NAME_REQUIRED);
        p.company_name = Some("  ".into());
        assert_eq!(p.validate().unwrap_err(), MSG_COMPANY_NAME_REQUIRED);
        p.company_name = Some("a".repeat(101));
        assert_eq!(p.validate().unwrap_err(), MSG_COMPANY_NAME_TOO_LONG);
        p.company_name = Some("TigShop".into());
        assert!(p.validate().is_ok());
    }

    #[test]
    fn attachment_parse_and_serialize() {
        assert!(parse_attachment(None).is_none());
        assert!(parse_attachment(Some("")).is_none());
        assert!(parse_attachment(Some("not json")).is_none());
        let items = vec![serde_json::json!({"name": "a.pdf"})];
        let json = attachment_to_json(&items);
        let back = parse_attachment(Some(&json)).unwrap();
        assert_eq!(back, items);
    }

    #[test]
    fn add_time_formatting_matches_java() {
        assert_eq!(format_unix_time(None), "");
        assert_eq!(format_unix_time(Some(0)), "");
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(format_unix_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }
}
