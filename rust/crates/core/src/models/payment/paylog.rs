//! 支付日志域 DTO/VO。
//! 对应原 Java `dto.finance.Paylog*` / `vo.finance.PaylogVO`。
//!
//! JSON 字段名保持 camelCase 与原前端接口一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 支付日志分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PaylogListQuery {
    pub order_sn: Option<String>,
    pub pay_status: Option<i32>,
    /// 业务类型：0=商品订单 1=充值单 2=付费会员订单
    pub order_type: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 支付日志 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaylogVO {
    pub paylog_id: i32,
    pub pay_sn: String,
    pub pay_name: String,
    pub order_id: i32,
    pub order_sn: String,
    pub order_amount: Decimal,
    pub order_type: i32,
    /// 业务类型中文名
    pub order_type_name: String,
    pub pay_amount: Decimal,
    pub pay_status: i32,
    /// 支付状态中文名
    pub pay_status_name: String,
    pub pay_code: String,
    pub transaction_id: String,
    pub profit_sharing_channel: Option<String>,
    pub add_time: i32,
    pub refund_amount: Decimal,
}

/// 创建支付日志请求（管理端手工补录）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PaylogCreateDTO {
    pub pay_sn: Option<String>,
    pub pay_name: Option<String>,
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub order_amount: Option<Decimal>,
    pub order_type: Option<i32>,
    pub pay_amount: Option<Decimal>,
    pub pay_code: Option<String>,
    pub transaction_id: Option<String>,
}

/// 更新支付日志请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PaylogUpdateDTO {
    pub paylog_id: i32,
    pub pay_status: Option<i32>,
    pub transaction_id: Option<String>,
    pub notify_data: Option<String>,
}

/// 发起支付的结果（供前端调起支付）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayCreateVO {
    /// 商户支付单号
    pub pay_sn: String,
    /// 支付方式编码（wechat/alipay/balance/...）
    pub pay_code: String,
    /// 应付金额
    pub pay_amount: Decimal,
    /// 是否复用已有待支付单（未新建日志）
    pub reused: bool,
    /// 渠道支付参数（由具体渠道实现填充）
    pub pay_params: serde_json::Value,
}

/// 退款日志 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaylogRefundVO {
    pub paylog_refund_id: i32,
    pub paylog_id: Option<i32>,
    pub refund_sn: String,
    pub paylog_desc: String,
    pub order_id: i32,
    pub refund_amount: Decimal,
    pub add_time: i32,
    pub admin_id: i32,
    pub pay_code: Option<String>,
    /// 退款状态：0 处理中 1 成功 2 失败
    pub status: i32,
    pub status_name: String,
    pub notify_time: i32,
}

/// 支付状态（对应库中 `paylog.pay_status`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayStatus {
    /// 待支付
    Unpaid = 0,
    /// 已支付
    Paid = 1,
    /// 已退款
    Refunded = 2,
}

impl PayStatus {
    pub fn name(self) -> &'static str {
        match self {
            Self::Unpaid => "待支付",
            Self::Paid => "已支付",
            Self::Refunded => "已退款",
        }
    }
}

impl TryFrom<i32> for PayStatus {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::Unpaid),
            1 => Ok(Self::Paid),
            2 => Ok(Self::Refunded),
            other => Err(format!("非法支付状态: {other}")),
        }
    }
}

/// 业务类型（对应库中 `paylog.order_type`）。
///
/// **关键**：`paylog` 被三类业务共用，`order_id` 会撞号，
/// 任何按订单查询都必须带此类型。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayOrderType {
    /// 商品订单（`order` 表）
    Product = 0,
    /// 充值单（`user_recharge_order` 表）
    Recharge = 1,
    /// 付费会员订单（`premium_member_order` 表）
    Premium = 2,
}

impl PayOrderType {
    pub fn name(self) -> &'static str {
        match self {
            Self::Product => "商品订单",
            Self::Recharge => "充值单",
            Self::Premium => "付费会员订单",
        }
    }
}

impl TryFrom<i32> for PayOrderType {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::Product),
            1 => Ok(Self::Recharge),
            2 => Ok(Self::Premium),
            other => Err(format!("非法业务类型: {other}")),
        }
    }
}

/// 退款状态（对应 `paylog_refund.status`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefundStatus {
    Processing = 0,
    Success = 1,
    Failed = 2,
}

impl RefundStatus {
    pub fn name(self) -> &'static str {
        match self {
            Self::Processing => "处理中",
            Self::Success => "退款成功",
            Self::Failed => "退款失败",
        }
    }
}

impl TryFrom<i32> for RefundStatus {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::Processing),
            1 => Ok(Self::Success),
            2 => Ok(Self::Failed),
            other => Err(format!("非法退款状态: {other}")),
        }
    }
}

/// 分账渠道白名单（与 Java `PROFIT_SHARING_CHANNELS` 一致）。
pub const PROFIT_SHARING_CHANNELS: [&str; 3] = ["WECHAT", "HUIFU", "ALIPAY"];

/// 归一化可选分账渠道：空白视为 `None`。
pub fn normalize_channel(channel: Option<&str>) -> Option<String> {
    channel
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_uppercase())
}

/// 校验分账渠道是否合法（必填场景）。
pub fn require_channel(channel: &str) -> Result<String, String> {
    let c = channel.trim().to_uppercase();
    if c.is_empty() {
        return Err("分账渠道不能为空".into());
    }
    if !PROFIT_SHARING_CHANNELS.contains(&c.as_str()) {
        return Err(format!(
            "不支持的分账渠道: {c}（可选 {}）",
            PROFIT_SHARING_CHANNELS.join("/")
        ));
    }
    Ok(c)
}

/// 两个分账渠道快照是否等价（`None` 与空串视为相同）。
pub fn same_channel(a: Option<&str>, b: Option<&str>) -> bool {
    normalize_channel(a) == normalize_channel(b)
}

/// 生成商户支付单号。
///
/// 对应 Java `generatePaySn`：`PAY` 前缀 + 时间戳 + 随机串，
/// 保证同秒内多次下单不冲突。
///
/// 实现说明：`core` crate 不依赖 `tigshop-common`（依赖方向相反），
/// 故此处用 `uuid` 的随机段而非 `common::utils::gen_sn`。
pub fn generate_pay_sn() -> String {
    let now = chrono::Local::now();
    // 取 UUID v4 的前 8 位十六进制作为随机段
    let rand: String = uuid::Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(8)
        .collect();
    format!("PAY{}{}", now.format("%Y%m%d%H%M%S"), rand)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pay_status_names() {
        assert_eq!(PayStatus::try_from(0).unwrap().name(), "待支付");
        assert_eq!(PayStatus::try_from(1).unwrap().name(), "已支付");
        assert_eq!(PayStatus::try_from(2).unwrap().name(), "已退款");
        assert!(PayStatus::try_from(9).is_err());
    }

    #[test]
    fn order_type_names() {
        assert_eq!(PayOrderType::try_from(0).unwrap().name(), "商品订单");
        assert_eq!(PayOrderType::try_from(1).unwrap().name(), "充值单");
        assert_eq!(PayOrderType::try_from(2).unwrap().name(), "付费会员订单");
        assert!(PayOrderType::try_from(3).is_err());
    }

    #[test]
    fn refund_status_names() {
        assert_eq!(RefundStatus::try_from(1).unwrap().name(), "退款成功");
        assert_eq!(RefundStatus::try_from(2).unwrap().name(), "退款失败");
    }

    #[test]
    fn normalize_channel_trims_and_uppercases() {
        assert_eq!(
            normalize_channel(Some(" wechat ")).as_deref(),
            Some("WECHAT")
        );
        // 空白视为 None（对应 Java normalizeOptionalProfitSharingChannel）
        assert_eq!(normalize_channel(Some("   ")), None);
        assert_eq!(normalize_channel(None), None);
    }

    #[test]
    fn require_channel_rejects_unknown() {
        assert_eq!(require_channel("wechat").unwrap(), "WECHAT");
        assert!(require_channel("").is_err());
        assert!(require_channel("paypal").is_err());
    }

    #[test]
    fn same_channel_treats_none_and_blank_equal() {
        // 对应 Java sameProfitSharingChannel：空值与空串视为同一快照
        assert!(same_channel(None, Some("")));
        assert!(same_channel(Some("wechat"), Some("WECHAT")));
        assert!(!same_channel(Some("WECHAT"), Some("ALIPAY")));
        assert!(!same_channel(None, Some("WECHAT")));
    }

    #[test]
    fn pay_sn_format_and_uniqueness() {
        let a = generate_pay_sn();
        let b = generate_pay_sn();
        assert!(a.starts_with("PAY"));
        // PAY + 14 位时间 + 8 位随机十六进制 = 25
        assert_eq!(a.len(), 25);
        assert_ne!(a, b, "同秒内两次生成不应相同");
    }

    #[test]
    fn list_query_is_default_tolerant() {
        let q: PaylogListQuery = serde_json::from_str("{}").unwrap();
        assert!(q.order_sn.is_none() && q.page.is_none());
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = PaylogVO {
            paylog_id: 1,
            order_type: 0,
            order_type_name: "商品订单".into(),
            pay_status: 1,
            pay_status_name: "已支付".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["orderTypeName"], "商品订单");
        assert_eq!(v["payStatusName"], "已支付");
    }
}
