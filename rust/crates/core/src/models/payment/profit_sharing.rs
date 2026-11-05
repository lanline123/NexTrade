//! 分账结算域（payment::profit_sharing）DTO / VO / 纯函数。
//! Java `ProfitSharingController`（3 端点，admin）+ `ProfitSharingOrderServiceImpl`。
//! 表 `profit_sharing_order`（28 列，主键 id BIGINT，datetime 为字符串列）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 状态：待分账。
pub const STATUS_PENDING: i32 = 0;
/// 状态：分账中。
pub const STATUS_PROCESSING: i32 = 1;
/// 状态：分账成功。
pub const STATUS_SUCCESS: i32 = 2;
/// 状态：分账失败。
pub const STATUS_FAILED: i32 = 3;
/// 状态：已作废。
pub const STATUS_CANCELLED: i32 = 4;
/// 完结状态：未完结。
pub const FINISH_UNFINISHED: i32 = 0;
/// 完结状态：已完结。
pub const FINISH_FINISHED: i32 = 1;
/// 触发类型：手动。
pub const TRIGGER_MANUAL: i32 = 1;

pub const MSG_IDS_EMPTY: &str = "订单ID列表不能为空";
pub const MSG_NOT_EXISTS: &str = "分账单不存在";
pub const MSG_ALREADY_FINISHED: &str = "分账单已完结, 无需重复操作";
pub const MSG_CANCEL_RACE: &str = "分账状态已变化，不能作废，请刷新后重试";
pub const MSG_CHANNEL_UNMIGRATED: &str =
    "分账渠道 API（微信/支付宝分账）尚未迁移到 Rust 侧，当前未发起渠道分账";
pub const MSG_FINISH_CHANNEL_UNMIGRATED: &str =
    "分账渠道完结 API 尚未迁移到 Rust 侧，当前未完结渠道分账单";
/// 手动作废原因（Java 原文）。
pub const RESULT_DESC_CANCEL: &str = "手动作废: 未发起过渠道分账";

/// 状态文案（Java `ProfitSharingStatus`）。
#[must_use]
pub fn status_desc(status: i32) -> Option<&'static str> {
    match status {
        STATUS_PENDING => Some("待分账"),
        STATUS_PROCESSING => Some("分账中"),
        STATUS_SUCCESS => Some("分账成功"),
        STATUS_FAILED => Some("分账失败"),
        STATUS_CANCELLED => Some("已作废"),
        _ => None,
    }
}

/// 完结状态文案。
#[must_use]
pub fn finish_desc(finish: i32) -> Option<&'static str> {
    match finish {
        FINISH_UNFINISHED => Some("未完结"),
        FINISH_FINISHED => Some("已完结"),
        _ => None,
    }
}

/// 触发类型文案。
#[must_use]
pub fn trigger_desc(trigger: i32) -> Option<&'static str> {
    match trigger {
        TRIGGER_MANUAL => Some("手动"),
        2 => Some("自动"),
        _ => None,
    }
}

/// `status` 查询参数解析（数字或枚举名，大小写不敏感；失败/空 ⇒ None）。
#[must_use]
pub fn parse_status(raw: Option<&str>) -> Option<i32> {
    let value = raw?.trim();
    if value.is_empty() {
        return None;
    }
    if let Ok(code) = value.parse::<i32>() {
        return Some(code);
    }
    match value.to_ascii_uppercase().as_str() {
        "PENDING" => Some(STATUS_PENDING),
        "PROCESSING" => Some(STATUS_PROCESSING),
        "SUCCESS" => Some(STATUS_SUCCESS),
        "FAILED" => Some(STATUS_FAILED),
        "CANCELLED" => Some(STATUS_CANCELLED),
        _ => None,
    }
}

/// `finishStatus` 查询参数解析。
#[must_use]
pub fn parse_finish_status(raw: Option<&str>) -> Option<i32> {
    let value = raw?.trim();
    if value.is_empty() {
        return None;
    }
    if let Ok(code) = value.parse::<i32>() {
        return Some(code);
    }
    match value.to_ascii_uppercase().as_str() {
        "UNFINISHED" => Some(FINISH_UNFINISHED),
        "FINISHED" => Some(FINISH_FINISHED),
        _ => None,
    }
}

/// 是否可完结（Java `canFinish`：未完结 && status ∈ {成功, 分账中}）。
#[must_use]
pub fn can_finish(status: i32, finish_status: i32) -> bool {
    finish_status != FINISH_FINISHED && (status == STATUS_SUCCESS || status == STATUS_PROCESSING)
}

/// 是否可作废（Java `canCancel`：待分账且无渠道交易号）。
#[must_use]
pub fn can_cancel(status: i32, transaction_id: &str) -> bool {
    status == STATUS_PENDING && transaction_id.trim().is_empty()
}

/// 排序字段 → 列名（未知回退主键）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "orderId" | "order_id" => "order_id",
        "orderSn" | "order_sn" => "order_sn",
        "shopId" | "shop_id" => "shop_id",
        "vendorId" | "vendor_id" => "vendor_id",
        "totalAmount" | "total_amount" => "total_amount",
        "splitAmount" | "split_amount" => "split_amount",
        "status" => "status",
        "finishStatus" | "finish_status" => "finish_status",
        "createTime" | "create_time" => "create_time",
        "modifyTime" | "modify_time" => "modify_time",
        _ => "id",
    }
}

/// ORDER BY（默认主键 DESC）。
#[must_use]
pub fn order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let field = sort_field.map(str::trim).unwrap_or("");
    let column = if field.is_empty() {
        "id"
    } else {
        map_order_column(field)
    };
    let dir = if sort_order
        .map(|s| s.trim().eq_ignore_ascii_case("asc"))
        .unwrap_or(false)
    {
        "ASC"
    } else {
        "DESC"
    };
    format!(" ORDER BY {column} {dir}")
}

/// `(LIMIT, OFFSET)`。
#[must_use]
pub fn limit_offset(page: Option<i64>, size: Option<i64>) -> (i64, i64) {
    let page = page.unwrap_or(1).max(1);
    let size = match size {
        None => 15,
        Some(v) if v > 100 => 100,
        Some(v) if v < 1 => 1,
        Some(v) => v,
    };
    (size, (page - 1) * size)
}

/// 分页查询（Java `ProfitSharingPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProfitSharingPageQuery {
    pub shop_id: Option<i32>,
    pub settlement_type: Option<i32>,
    pub vendor_id: Option<i32>,
    pub status: Option<String>,
    pub finish_status: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl ProfitSharingPageQuery {
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
}

/// 批量发起分账入参（Java `ProfitSharingSubmitParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProfitSharingSubmitParam {
    pub settlement_ids: Option<Vec<i64>>,
}

impl ProfitSharingSubmitParam {
    /// 校验并返回 id 列表（空 ⇒「订单ID列表不能为空」）。
    pub fn validate(&self) -> Result<Vec<i64>, String> {
        match self.settlement_ids.as_deref() {
            Some(ids) if !ids.is_empty() => Ok(ids.to_vec()),
            _ => Err(MSG_IDS_EMPTY.to_string()),
        }
    }
}

/// 分账单 VO（Java `ProfitSharingOrderVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfitSharingOrderVO {
    pub id: i64,
    pub out_order_no: String,
    pub order_id: i64,
    pub order_sn: String,
    pub shop_id: i32,
    pub shop_name: Option<String>,
    pub vendor_id: i32,
    pub vendor_name: Option<String>,
    pub settlement_type: i32,
    pub transaction_id: String,
    pub total_amount: Decimal,
    pub split_amount: Decimal,
    pub service_fee: Decimal,
    pub commission_fee: Decimal,
    /// 状态码文本（Java VO 为 String）
    pub status: String,
    pub status_desc: String,
    pub finish_status: String,
    pub finish_status_desc: String,
    pub trigger_type: String,
    pub can_finish: bool,
    pub can_cancel: bool,
    pub settlement_id: i64,
    pub result_desc: String,
    pub create_time: String,
    pub modify_time: String,
}

/// 分账单已完结错误文案（含状态值）。
#[must_use]
pub fn status_not_finishable_message(status: i32) -> String {
    format!("分账单当前状态不允许完结, status={status}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_texts() {
        assert_eq!(status_desc(0), Some("待分账"));
        assert_eq!(status_desc(4), Some("已作废"));
        assert_eq!(finish_desc(1), Some("已完结"));
        assert_eq!(trigger_desc(1), Some("手动"));
        assert_eq!(trigger_desc(2), Some("自动"));
    }

    #[test]
    fn status_parsing() {
        assert_eq!(parse_status(Some("2")), Some(2));
        assert_eq!(parse_status(Some(" success ")), Some(2));
        assert_eq!(parse_status(Some("Cancelled")), Some(4));
        assert_eq!(parse_status(Some("")), None);
        assert_eq!(parse_status(None), None);
        assert_eq!(parse_finish_status(Some("finished")), Some(1));
        assert_eq!(parse_finish_status(Some("0")), Some(0));
    }

    #[test]
    fn finish_cancel_and_messages() {
        assert!(can_finish(STATUS_SUCCESS, FINISH_UNFINISHED));
        assert!(can_finish(STATUS_PROCESSING, FINISH_UNFINISHED));
        assert!(!can_finish(STATUS_PENDING, FINISH_UNFINISHED));
        assert!(!can_finish(STATUS_SUCCESS, FINISH_FINISHED));
        assert!(can_cancel(STATUS_PENDING, ""));
        assert!(!can_cancel(STATUS_PENDING, " T "));
        assert!(!can_cancel(STATUS_SUCCESS, ""));
        let dto = ProfitSharingSubmitParam::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_IDS_EMPTY);
        assert_eq!(dto.validate().unwrap_or_default(), Vec::<i64>::new());
        let dto = ProfitSharingSubmitParam {
            settlement_ids: Some(vec![]),
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_IDS_EMPTY);
        let dto = ProfitSharingSubmitParam {
            settlement_ids: Some(vec![1, 2]),
        };
        assert_eq!(dto.validate().unwrap(), vec![1, 2]);
        assert_eq!(
            status_not_finishable_message(3),
            "分账单当前状态不允许完结, status=3"
        );
    }

    #[test]
    fn paging_and_sorting() {
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(2), Some(10)), (10, 10));
        assert_eq!(order_clause(None, None), " ORDER BY id DESC");
        assert_eq!(
            order_clause(Some("splitAmount"), Some("asc")),
            " ORDER BY split_amount ASC"
        );
        assert_eq!(
            order_clause(Some("x; DROP TABLE profit_sharing_order"), None),
            " ORDER BY id DESC"
        );
    }
}
