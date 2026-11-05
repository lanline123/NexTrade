//! 退款申请域 DTO/VO。
//! 对应原 Java `param.finance.refundapply.*` 与 `vo.finance.refundapply.*`。
//!
//! JSON 字段名保持 camelCase 与原前端接口一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 退款申请分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundApplyListQuery {
    pub order_sn: Option<String>,
    pub refund_status: Option<i32>,
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 创建退款申请请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundApplyCreateDTO {
    /// 退款类型：1 订单 2 商品
    pub refund_type: Option<i32>,
    pub order_id: Option<i32>,
    pub user_id: Option<i32>,
    pub aftersale_id: Option<i32>,
    /// 线上退款金额
    pub online_balance: Option<Decimal>,
    /// 线下退款金额
    pub offline_balance: Option<Decimal>,
    /// 退款说明
    pub refund_note: Option<String>,
    pub shop_id: Option<i32>,
}

/// 审核请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundApplyAuditDTO {
    pub refund_id: i32,
    /// 目标状态：1 处理中 3 取消/退回售后 4 拒绝
    pub refund_status: i32,
    /// 审核备注；**拒绝时必填**（对应 Java 的校验）
    pub refund_note: Option<String>,
}

/// 确认线下转账请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OfflineAuditDTO {
    pub refund_id: i32,
    /// 支付凭证（线下转账凭据）
    pub payment_voucher: Option<String>,
}

/// 更新退款申请请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundApplyUpdateDTO {
    pub refund_id: i32,
    pub online_balance: Option<Decimal>,
    pub offline_balance: Option<Decimal>,
    pub refund_note: Option<String>,
}

/// 退款申请 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundApplyVO {
    pub refund_id: i32,
    pub refund_type: i32,
    pub refund_type_name: String,
    pub order_id: i32,
    pub user_id: i32,
    pub aftersale_id: i32,
    pub refund_status: i32,
    pub refund_status_name: String,
    pub add_time: i32,
    pub refund_note: String,
    /// 线上退款金额
    pub online_balance: Decimal,
    /// 线下退款金额
    pub offline_balance: Decimal,
    /// 退款总额（线上+线下）
    pub refund_balance: Decimal,
    pub is_online: i32,
    pub is_offline: i32,
    /// 是否已确认收货（线下退款流程）
    pub is_receive: i32,
    pub paylog_refund_id: i32,
    pub shop_id: i32,
    pub payment_voucher: Option<String>,
}

/// 退款操作日志 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundLogVO {
    pub log_id: i32,
    pub refund_apply_id: i32,
    pub refund_type: i32,
    pub refund_type_name: String,
    /// 退款支付方式编码
    pub refund_pay_code: String,
    pub transaction_id: String,
    pub refund_amount: Decimal,
    pub add_time: i32,
    pub description: Option<String>,
    pub user_id: i32,
}

/// 退款申请详情 VO（含操作日志）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundApplyDetailVO {
    #[serde(flatten)]
    pub base: RefundApplyVO,
    pub logs: Vec<RefundLogVO>,
}

/// 退款**申请**状态（对应库中 `refund_apply.refund_status`）。
///
/// 注意与 `paylog::RefundStatus`（**退款流水** `paylog_refund.status`：
/// 0 处理中 / 1 成功 / 2 失败）区分：两者是不同表的不同状态机。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefundApplyStatus {
    /// 待处理
    Wait = 0,
    /// 处理中
    Processing = 1,
    /// 已处理
    Processed = 2,
    /// 已取消（退回售后人员重新处理）
    Cancel = 3,
    /// 已拒绝
    Rejected = 4,
}

impl RefundApplyStatus {
    pub fn name(self) -> &'static str {
        match self {
            Self::Wait => "待处理",
            Self::Processing => "处理中",
            Self::Processed => "已处理",
            Self::Cancel => "已取消",
            Self::Rejected => "已拒绝",
        }
    }

    /// 是否计入「已占用可退额度」。
    ///
    /// 对应 Java `sumOccupiedRefundAmount` 的 `IN (0,1,2)` 口径：
    /// 已取消(3)/已拒绝(4) 的申请**不应**再占用额度，否则该笔支付
    /// 会永久无法再次退款。
    pub fn occupies_quota(self) -> bool {
        matches!(self, Self::Wait | Self::Processing | Self::Processed)
    }

    /// 是否为终态（不可再流转）。
    pub fn is_final(self) -> bool {
        matches!(self, Self::Processed | Self::Cancel | Self::Rejected)
    }
}

impl TryFrom<i32> for RefundApplyStatus {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::Wait),
            1 => Ok(Self::Processing),
            2 => Ok(Self::Processed),
            3 => Ok(Self::Cancel),
            4 => Ok(Self::Rejected),
            other => Err(format!("非法退款状态: {other}")),
        }
    }
}

/// 退款类型（对应库中 `refund_apply.refund_type`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefundType {
    /// 整单退款
    Order = 1,
    /// 单商品退款
    Product = 2,
}

impl RefundType {
    pub fn name(self) -> &'static str {
        match self {
            Self::Order => "订单",
            Self::Product => "商品",
        }
    }
}

impl TryFrom<i32> for RefundType {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            1 => Ok(Self::Order),
            2 => Ok(Self::Product),
            other => Err(format!("非法退款类型: {other}")),
        }
    }
}

/// 校验拒绝原因（对应 Java `audit` 中拒绝分支的校验）。
///
/// 规则：trim 后非空、长度 ≤ 255。
pub fn validate_reject_reason(reason: Option<&str>) -> Result<String, String> {
    let r = reason.unwrap_or_default().trim();
    if r.is_empty() {
        return Err("拒绝原因不能为空".into());
    }
    if r.chars().count() > 255 {
        return Err("拒绝原因不能超过255个字符".into());
    }
    Ok(r.to_string())
}

/// 计算退款总额（线上 + 线下，不为负）。
pub fn total_refund(online: Decimal, offline: Decimal) -> Decimal {
    (online.max(Decimal::ZERO) + offline.max(Decimal::ZERO)).max(Decimal::ZERO)
}

/// 可退余额 = 实付 - 已占用。
pub fn refundable_of(paid: Decimal, occupied: Decimal) -> Decimal {
    (paid - occupied).max(Decimal::ZERO)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }

    #[test]
    fn status_names_and_conversion() {
        assert_eq!(RefundApplyStatus::try_from(0).unwrap().name(), "待处理");
        assert_eq!(RefundApplyStatus::try_from(2).unwrap().name(), "已处理");
        assert_eq!(RefundApplyStatus::try_from(3).unwrap().name(), "已取消");
        assert_eq!(RefundApplyStatus::try_from(4).unwrap().name(), "已拒绝");
        assert!(RefundApplyStatus::try_from(9).is_err());
    }

    #[test]
    fn occupies_quota_only_for_active_statuses() {
        // 待处理/处理中/已处理 计入已占用
        assert!(RefundApplyStatus::Wait.occupies_quota());
        assert!(RefundApplyStatus::Processing.occupies_quota());
        assert!(RefundApplyStatus::Processed.occupies_quota());
        // 已取消/已拒绝 不再占用（否则无法重新退款）
        assert!(!RefundApplyStatus::Cancel.occupies_quota());
        assert!(!RefundApplyStatus::Rejected.occupies_quota());
    }

    #[test]
    fn final_statuses() {
        assert!(RefundApplyStatus::Processed.is_final());
        assert!(RefundApplyStatus::Rejected.is_final());
        assert!(!RefundApplyStatus::Wait.is_final());
        assert!(!RefundApplyStatus::Processing.is_final());
    }

    #[test]
    fn refund_type_names() {
        assert_eq!(RefundType::try_from(1).unwrap().name(), "订单");
        assert_eq!(RefundType::try_from(2).unwrap().name(), "商品");
        assert!(RefundType::try_from(3).is_err());
    }

    #[test]
    fn reject_reason_required_and_length_capped() {
        assert!(validate_reject_reason(None).is_err());
        assert!(validate_reject_reason(Some("  ")).is_err());
        assert_eq!(
            validate_reject_reason(Some(" 质量问题 ")).unwrap(),
            "质量问题"
        );
        // 超长拒绝
        let long = "x".repeat(256);
        assert!(validate_reject_reason(Some(&long)).is_err());
        // 255 恰好合法
        let ok = "x".repeat(255);
        assert!(validate_reject_reason(Some(&ok)).is_ok());
    }

    #[test]
    fn total_refund_sums_and_floors_at_zero() {
        assert_eq!(total_refund(dec("10.00"), dec("5.00")), dec("15.00"));
        // 负数输入不应产生负总额
        assert_eq!(total_refund(dec("-10.00"), dec("-5.00")), Decimal::ZERO);
    }

    #[test]
    fn refundable_never_negative() {
        assert_eq!(refundable_of(dec("100.00"), dec("30.00")), dec("70.00"));
        // 已占用超过实付（异常数据）→ 可退为 0
        assert_eq!(refundable_of(dec("50.00"), dec("80.00")), Decimal::ZERO);
    }

    #[test]
    fn audit_dto_parses_camel_case() {
        let d: RefundApplyAuditDTO =
            serde_json::from_str(r#"{"refundId":7,"refundStatus":4,"refundNote":"质量不合格"}"#)
                .unwrap();
        assert_eq!(d.refund_id, 7);
        assert_eq!(d.refund_status, 4);
        assert_eq!(d.refund_note.as_deref(), Some("质量不合格"));
    }

    #[test]
    fn create_dto_is_default_tolerant() {
        let d: RefundApplyCreateDTO = serde_json::from_str("{}").unwrap();
        assert!(d.refund_type.is_none() && d.order_id.is_none());
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = RefundApplyDetailVO {
            base: RefundApplyVO {
                refund_id: 1,
                refund_status: 0,
                refund_status_name: "待处理".into(),
                refund_type: 1,
                refund_type_name: "订单".into(),
                ..Default::default()
            },
            logs: Vec::new(),
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["refundStatusName"], "待处理");
        assert_eq!(v["refundTypeName"], "订单");
        assert!(v["logs"].is_array());
    }
}
