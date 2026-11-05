//! 退款记录域（payment::refund_log）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.finance.{RefundLogCreateDTO, RefundLogListDTO, RefundLogUpdateDTO}`
//! - `com.tigshop.bean.dto.common.{OperateDTO, BatchDTO, UpdateFieldDTO}`
//! - `com.tigshop.bean.vo.finance.RefundLogVO` + `vo.finance.refundapply.RefundApplyVO`
//! - `com.tigshop.common.constant.finance.RefundLogConstants.REFUND_TYPE_MAP`
//!
//! 实体 `tigshop_core::entities::RefundLog`（表 `refund_log`，10 列）已由 schema
//! 生成；金额 `refund_amount` 是 `decimal(10,2)` → `Decimal`。
//!
//! # 关键语义
//!
//! - `list` 的 SQL 来自 `RefundLogServiceImpl#list`（MPJ wrapper）：`keyword`
//!   只匹配**售后单号** `aftersales.aftersales_sn`（经
//!   `refund_apply.refund_id = refund_log.refund_apply_id`、
//!   `aftersales.aftersale_id = refund_apply.aftersale_id` 两级 LEFT JOIN），
//!   `type` 对应 `refund_type`；排序三参 `buildSortOrder`（默认主键降序）。
//! - `addTime` 在 list 的 VO 里格式化为 `yyyy-MM-dd HH:mm:ss`；`refundTypeText`
//!   来自 `REFUND_TYPE_MAP`（未知类型 Java 取到 `null`）。
//! - `detail` 只做 `BeanUtils.copyProperties`，**不**格式化时间、**不**设置
//!   `refund` / `refundTypeText` —— 故保持 `null`（`Option`）。
//! - `updateField` 白名单是 `GENERAL_FIELDS = {"is_show","sort_order","status"}`，
//!   本表没有这三列 ⇒ 任何字段名都会以「field 的值有误」拒绝（与 Java 一致：
//!   `getColumnByPropertyName` 未知属性回退主键 `log_id`，不在白名单）。
//! - `batch` 仅 `type = "del"` 生效，其余静默 `false`（控制器 void）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `getKeyColumn` → `log_id`）。
pub const KEY_COLUMN: &str = "log_id";
/// 主键属性名（Java `getKeyProperty` → `logId`）。
pub const KEY_PROPERTY: &str = "logId";
/// `updateField` 白名单（Java `CheckFieldConstants.GENERAL_FIELDS`）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// `id不能为空`（Java `OperateDTO.id` / `UpdateFieldDTO.id` 的 `@NotNull` 文案）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
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
/// 退款记录不存在（Java detail 对空记录会 NPE，本实现改为业务 500，见模块偏差）。
pub const MSG_NOT_EXISTS: &str = "退款记录不存在";

/// 退款类型文案（Java `RefundLogConstants.REFUND_TYPE_MAP`；未知 → `None` = null）。
///
/// `1 → 原路返回`、`2 → 余额退回`、`3 → 线下退回`。
#[must_use]
pub fn refund_type_text(refund_type: i32) -> Option<&'static str> {
    match refund_type {
        1 => Some("原路返回"),
        2 => Some("余额退回"),
        3 => Some("线下退回"),
        _ => None,
    }
}

/// 排序字段 → 列名（Java `getColumnByPropertyName`：属性名或列名均可，
/// 未知回退主键列 `log_id`，防 SQL 注入）。
#[must_use]
pub fn map_refund_log_column(field: &str) -> &'static str {
    match field {
        "logId" | "log_id" => "log_id",
        "refundApplyId" | "refund_apply_id" => "refund_apply_id",
        "refundType" | "refund_type" => "refund_type",
        "refundPayCode" | "refund_pay_code" => "refund_pay_code",
        "transactionId" | "transaction_id" => "transaction_id",
        "refundAmount" | "refund_amount" => "refund_amount",
        "addTime" | "add_time" => "add_time",
        "description" => "description",
        "userId" | "user_id" => "user_id",
        "orderId" | "order_id" => "order_id",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段归一 + 白名单判定。
///
/// 本表没有 `is_show` / `sort_order` / `status` 列，因此**永远**返回 `None`
/// （调用方据此报「field 的值有误」，与 Java 行为一致）。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_refund_log_column(field);
    if GENERAL_FIELDS.contains(&column) {
        Some(column)
    } else {
        None
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`0` ⇒ `""`
/// （Java `TigUtils.handelTime`；list 仅在非 0 时格式化）。
#[must_use]
pub fn format_unix_time(secs: i32) -> String {
    if secs == 0 {
        return String::new();
    }
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

/// 列表查询（Java `RefundLogListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundLogListQuery {
    /// 页码（Java `BasePage.page`，缺省 1）
    pub page: Option<i64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
    /// 关键字（售后单号 `aftersales.aftersales_sn LIKE`）
    pub keyword: Option<String>,
    /// 退款类型：1 接口原路退回 / 2 余额退回 / 3 线下退回
    pub r#type: Option<i32>,
}

impl RefundLogListQuery {
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
            map_refund_log_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }

    /// 关键字（Java `StringUtils.isNotEmpty`：null/空串不参与过滤）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }
}

/// 创建入参（Java `RefundLogCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundLogCreateDTO {
    /// 来自的退款申请 ID（实体列 `refund_apply_id`）
    pub refund_id: Option<i32>,
    /// 退款类型
    pub refund_type: Option<i32>,
    /// 接口退款时的支付方式 code
    pub refund_pay_code: Option<String>,
    /// 接口退款时的支付流水号
    pub transaction_id: Option<String>,
    /// 实际退款金额
    pub refund_amount: Option<Decimal>,
    /// 退款时间（创建时被当前时间覆盖）
    pub add_time: Option<i32>,
    /// 退款描述
    pub description: Option<String>,
    /// 退款会员 ID
    pub user_id: Option<i32>,
    /// 退款的订单 ID
    pub order_id: Option<i32>,
}

/// 更新入参（Java `RefundLogUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundLogUpdateDTO {
    /// 接口退款日志 ID（主键）
    pub log_id: Option<i32>,
    /// 来自的退款申请 ID
    pub refund_id: Option<i32>,
    /// 退款类型
    pub refund_type: Option<i32>,
    /// 支付方式 code
    pub refund_pay_code: Option<String>,
    /// 支付流水号
    pub transaction_id: Option<String>,
    /// 实际退款金额
    pub refund_amount: Option<Decimal>,
    /// 退款时间
    pub add_time: Option<i32>,
    /// 退款描述
    pub description: Option<String>,
    /// 退款会员 ID
    pub user_id: Option<i32>,
    /// 退款的订单 ID
    pub order_id: Option<i32>,
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

/// 售后单摘要（Java `OrderFinanceAftersales` 实体，表 `aftersales`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AftersalesVO {
    pub aftersale_id: i32,
    pub aftersale_type: i32,
    pub status: i32,
    pub pics: String,
    pub description: String,
    pub reply: String,
    /// Java 实体是 `Long`（秒级），保持数值透传
    pub add_time: i32,
    pub tracking_no: String,
    pub logistics_name: String,
    pub return_address: Option<String>,
    pub aftersale_reason: Option<String>,
    pub aftersales_sn: Option<String>,
    pub order_id: Option<i32>,
    pub user_id: Option<i32>,
    pub refund_amount: Decimal,
    pub shop_id: i32,
    pub audit_time: i32,
    pub deal_time: i32,
    pub final_time: i32,
}

/// 退款申请摘要（Java `RefundApplyVO` 经 `BeanUtils.copyProperties(RefundApply)`
/// 后 + `setAftersales(...)`；Java 未调用 `assembleData`，故
/// `refundTypeName` / `refundStatusName` / `addTime` 保持 null）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundLogRefundVO {
    pub refund_id: i32,
    /// 退款类型（申请口径：1 订单 / 2 商品）
    pub refund_type: i32,
    pub order_id: i32,
    pub user_id: i32,
    pub aftersale_id: i32,
    pub refund_status: i32,
    pub refund_note: String,
    pub online_balance: Decimal,
    pub offline_balance: Decimal,
    pub refund_balance: Decimal,
    pub is_online: i32,
    pub is_offline: i32,
    pub payment_voucher: Option<String>,
    pub is_receive: i32,
    pub paylog_refund_id: i32,
    pub shop_id: i32,
    /// Java `BeanUtils` 类型不符未拷贝 ⇒ null
    pub add_time: Option<String>,
    /// Java 未调用 `assembleData` ⇒ null
    pub refund_type_name: Option<String>,
    /// Java 未调用 `assembleData` ⇒ null
    pub refund_status_name: Option<String>,
    pub aftersales: Option<AftersalesVO>,
    /// 账期字段 Java 未赋值 ⇒ null
    pub is_credit_order: Option<i32>,
    pub credit_amount: Option<Decimal>,
    pub credit_refund_amount: Option<Decimal>,
}

/// 退款记录 VO（Java `RefundLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundLogVO {
    /// 接口退款日志 ID
    pub log_id: i32,
    /// 来自的退款申请 ID
    pub refund_id: i32,
    /// 退款类型（1 原路 / 2 余额 / 3 线下）
    pub refund_type: i32,
    /// 退款类型文案（list 有值；detail Java 不设置 ⇒ null）
    pub refund_type_text: Option<String>,
    /// 接口退款时的支付方式 code
    pub refund_pay_code: String,
    /// 接口退款时的支付流水号
    pub transaction_id: String,
    /// 实际退款金额
    pub refund_amount: Decimal,
    /// 退款时间（list 为格式化字符串；detail Java 不设置 ⇒ null）
    pub add_time: Option<String>,
    /// 退款描述
    pub description: Option<String>,
    /// 退款会员 ID
    pub user_id: i32,
    /// 退款的订单 ID
    pub order_id: i32,
    /// 分销员 ID（Java 未赋值 ⇒ null）
    pub salesman_id: Option<i32>,
    /// 退款申请（list 有值；detail Java 不设置 ⇒ null）
    pub refund: Option<RefundLogRefundVO>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refund_type_text_matches_java_map() {
        assert_eq!(refund_type_text(1), Some("原路返回"));
        assert_eq!(refund_type_text(2), Some("余额退回"));
        assert_eq!(refund_type_text(3), Some("线下退回"));
        assert_eq!(refund_type_text(0), None);
        assert_eq!(refund_type_text(99), None);
    }

    #[test]
    fn update_field_is_always_rejected() {
        // 本表没有 GENERAL_FIELDS 里的任何列
        for field in [
            "logId",
            "log_id",
            "refundType",
            "refund_amount",
            "status",
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
        let q = RefundLogListQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.order_clause(), " ORDER BY log_id DESC");
        let q = RefundLogListQuery {
            page: Some(3),
            size: Some(500),
            sort_field: Some("refundAmount".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (100, 200));
        assert_eq!(q.order_clause(), " ORDER BY refund_amount ASC");
        // 列名直传也接受
        assert_eq!(map_refund_log_column("refund_amount"), "refund_amount");
        // 未知/注入字符串回退主键
        let q = RefundLogListQuery {
            sort_field: Some("x; DROP TABLE refund_log".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY log_id DESC");
        // 非 asc/desc 的方向不产生 ORDER BY
        let q = RefundLogListQuery {
            sort_order: Some("sideways".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    #[test]
    fn keyword_blank_is_ignored() {
        let mut q = RefundLogListQuery::default();
        assert!(q.effective_keyword().is_none());
        q.keyword = Some(String::new());
        assert!(q.effective_keyword().is_none());
        q.keyword = Some("SH2024".into());
        assert_eq!(q.effective_keyword(), Some("SH2024"));
    }

    #[test]
    fn query_params_are_camel_case_and_type_works() {
        let q: RefundLogListQuery = serde_json::from_value(serde_json::json!({
            "page": 2, "size": 20, "sortField": "addTime", "sortOrder": "desc",
            "keyword": "sn", "type": 2
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.sort_field.as_deref(), Some("addTime"));
        assert_eq!(q.r#type, Some(2));
    }

    #[test]
    fn add_time_zero_is_empty_and_epoch_converts() {
        assert_eq!(format_unix_time(0), "");
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(format_unix_time(1_700_000_000), "2023-11-15 06:13:20");
    }

    #[test]
    fn vo_serializes_camel_case_with_nullable_detail_fields() {
        let vo = RefundLogVO {
            log_id: 9,
            refund_id: 3,
            refund_type: 2,
            refund_type_text: Some("余额退回".into()),
            refund_pay_code: "balance".into(),
            transaction_id: "T1".into(),
            refund_amount: Decimal::new(1299, 2),
            add_time: Some("2024-12-01 10:00:00".into()),
            description: None,
            user_id: 5,
            order_id: 6,
            salesman_id: None,
            refund: None,
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["logId"], 9);
        assert_eq!(v["refundId"], 3);
        assert_eq!(v["refundTypeText"], "余额退回");
        assert_eq!(v["refundAmount"], "12.99");
        assert!(v["description"].is_null());
        assert!(v["salesmanId"].is_null());
        assert!(v["refund"].is_null());
    }
}
