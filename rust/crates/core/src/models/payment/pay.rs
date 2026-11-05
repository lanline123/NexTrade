//! 订单支付域（payment::pay）DTO / VO / 纯函数。
//!
//! 对应原 Java `com.tigshop.api.controller.order.PayController` 的 6 个端点
//! （契约 `auth=optional`）：
//! - `GET /api/order/pay/index`（`getPayOrderInfo`）
//! - `GET /api/order/pay/paymentList`（`getPaymentSelection`）
//! - `GET /api/order/pay/getPayLog`
//! - `GET /api/order/pay/checkStatus`（`getCheckStatus`）
//! - `GET /api/order/pay/create`（`create`）
//! - `GET /api/order/pay/createDepositPayment`（`createDepositPayment`）
//!
//! # 已实现
//!
//! - 支付方式列表：完整复刻 `PaymentServiceImpl#getAvailablePayment` 的开关判定
//!   （微信/支付宝/PayPal/Apple Pay/拉卡拉/YaBand/云支付/汇付/易宝/线下）+
//!   `paymentOrder` 配置排序（父级映射：yabanpay/yunpay/huifu/lakala/yeepay）。
//! - 线下支付说明：`useOffline` + 各线下汇款开关/文案（`{$order_sn}` 替换）。
//! - `index`：订单归属校验 + 订单摘要 + 支付方式（按 `pay_type_id` 过滤 offline）
//!   + 线下支付说明。
//! - `getPayLog`：订单/拆单子订单定位 + 最后一笔成功 `paylog` + 实付金额/支付名称
//!   + 预售定金/尾款口径 + 预约信息。
//! - `checkStatus`：订单 `pay_status` / `paylog.pay_status` + 最后一笔 paylog 口径。
//!
//! # 未迁移（外部渠道 SDK）
//!
//! - `create` / `createDepositPayment`：微信/支付宝/拉卡拉/汇付/易宝/PayPal/
//!   ApplePay 下单全部依赖渠道 SDK 与证书，**完成本地校验后返回明确未迁移错误**，
//!   绝不伪造支付参数。
//! - `checkStatus` 的微信付款码轮询分支（`PayConstants.CODE_PAY_CODE`）依赖微信
//!   支付查询 SDK，未迁移：直接返回本地 `pay_status` 口径（见偏差 3）。
//!
//! # 偏差
//!
//! 1. `index.order` 为**订单摘要**（orderId/orderSn/userId/totalAmount/paidAmount/
//!    unpaidAmount/balance/payStatus/orderStatus/isPresale/presaleType/payTypeId），
//!    不是 Java `OrderVO` 全量（商品/可用动作/优惠等由订单域迁移，当前切片不重建）。
//!    因此 Java 的 `availableActions.toPay` 用「`pay_status == 2` ⇒ 已支付」近似。
//! 2. `create/createDepositPayment` 的渠道参数（`type/code`）只做存在性/归属校验，
//!    渠道类型合法性由渠道 SDK 判定（未迁移）。
//! 3. `checkStatus` 微信包装支付轮询分支未迁移，返回本地口径。
//! 4. i18n 文案（`messageHelper`）未迁移；使用与 Java 默认中文一致的固定文案。

use std::collections::{BTreeMap, HashMap};

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 配置键（SettingsEnum bizCode）
// ——————————————————————————————————————————————

pub const CFG_USE_WECHAT: &str = "useWechat";
pub const CFG_USE_ALIPAY: &str = "useAlipay";
pub const CFG_USE_PAYPAL: &str = "usePaypal";
pub const CFG_USE_APPLE_PAY: &str = "useApplePay";
pub const CFG_USE_LAKALA: &str = "useLakala";
pub const CFG_USE_YABANPAY: &str = "useYabanpay";
pub const CFG_USE_YABANPAY_WECHAT: &str = "useYabanpayWechat";
pub const CFG_USE_YABANPAY_ALIPAY: &str = "useYabanpayAlipay";
pub const CFG_USE_YUNPAY: &str = "useYunpay";
pub const CFG_USE_HUIFU: &str = "useHuifu";
pub const CFG_USE_YEEPAY: &str = "useYeepay";
pub const CFG_USE_OFFLINE: &str = "useOffline";
pub const CFG_PAYMENT_ORDER: &str = "paymentOrder";
pub const CFG_OFFLINE_PAY_BANK_ENABLE: &str = "offlinePayBankEnable";
pub const CFG_OFFLINE_PAY_BANK: &str = "offlinePayBank";
pub const CFG_OFFLINE_PAY_COMPANY_ENABLE: &str = "offlinePayCompanyEnable";
pub const CFG_OFFLINE_PAY_COMPANY: &str = "offlinePayCompany";
pub const CFG_THIRD_PARTY_TRANSFER_ENABLE: &str = "thirdPartyPaymentTransferEnable";
pub const CFG_THIRD_PARTY_TRANSFER: &str = "thirdPartyPaymentTransfer";
pub const CFG_OTHER_REMITTANCE_ENABLE: &str = "otherPaymentRemittanceEnable";
pub const CFG_OTHER_REMITTANCE: &str = "otherPaymentRemittance";
pub const CFG_APPLE_PROVIDER: &str = "applePayAcquirerProvider";
pub const CFG_APPLE_PROCESSING_KEY: &str = "applePayProcessingPrivateKey";
pub const CFG_APPLE_MERCHANT_ID: &str = "applePayMerchantId";
pub const CFG_APPLE_DISPLAY_NAME: &str = "applePayDisplayName";
pub const CFG_APPLE_MERCHANT_CERT: &str = "applePayMerchantIdentityCert";
pub const CFG_APPLE_MERCHANT_KEY: &str = "applePayMerchantIdentityKey";
pub const CFG_APPLE_GATEWAY: &str = "applePayAcquirerGateway";
pub const CFG_APPLE_MERCHANT_NO: &str = "applePayAcquirerMerchantNo";
pub const CFG_APPLE_ACQUIRER_KEY: &str = "applePayAcquirerKey";

/// `order_type` 预约到店。
pub const ORDER_TYPE_RESERVATION_STORE: i32 = 9;
/// `order_type` 预约上门。
pub const ORDER_TYPE_RESERVATION_HOME: i32 = 10;
/// `paylog.order_type` 商品订单。
pub const PAYLOG_ORDER_TYPE_ORDER: i32 = 0;
/// 支付状态：已支付。
pub const PAY_STATUS_PAID: i32 = 2;
/// `paylog.pay_status` 已支付。
pub const PAYLOG_STATUS_PAID: i32 = 1;

// ——————————————————————————————————————————————
// 文案（Java `GlobalException` / PayController 原文）
// ——————————————————————————————————————————————

/// 用户未登录。
pub const MSG_NOT_LOGGED_IN: &str = "用户未登录";
/// 订单不存在。
pub const MSG_ORDER_NOT_FOUND: &str = "订单不存在";
/// 参数缺失（`getPayLog` 缺 id）。
pub const MSG_PARAM_MISSING: &str = "参数缺失";
/// 订单已支付（Java `error.order.already.paid` 默认中文）。
pub const MSG_ORDER_ALREADY_PAID: &str = "订单已支付";
/// 渠道 SDK 未迁移（create / createDepositPayment）。
pub const MSG_CHANNEL_UNMIGRATED: &str =
    "支付渠道客户端（微信/支付宝/拉卡拉/汇付/易宝/PayPal/Apple Pay）尚未迁移到 Rust 侧，当前未创建支付单";

/// Java `PayMethodType` 的 code→中文名（未知返回原 code）。
#[must_use]
pub fn pay_method_name(code: &str) -> String {
    match code {
        "wechat" => "微信".into(),
        "alipay" => "支付宝".into(),
        "lakala" => "拉卡拉".into(),
        "lakalaWechat" => "拉卡拉微信".into(),
        "lakalaAlipay" => "拉卡拉支付宝".into(),
        "huifuWechat" => "汇付微信".into(),
        "huifuAlipay" => "汇付支付宝".into(),
        "yeepayWechat" => "易宝微信".into(),
        "yeepayAlipay" => "易宝支付宝".into(),
        "paypal" => "paypal".into(),
        "applepay" => "Apple Pay".into(),
        "offline" => "线下支付".into(),
        "balance" => "余额".into(),
        "cash" => "现金".into(),
        "other" => "其他".into(),
        other => other.to_string(),
    }
}

/// 是否预约订单（Java `OrderType.isReservationOrder`：9/10）。
#[must_use]
pub fn is_reservation_order(order_type: Option<i32>) -> bool {
    matches!(
        order_type,
        Some(ORDER_TYPE_RESERVATION_STORE | ORDER_TYPE_RESERVATION_HOME)
    )
}

/// 配置读取辅助：值非空且为 1。
fn enabled(configs: &HashMap<String, String>, key: &str) -> bool {
    configs.get(key).map(|v| v.trim() == "1").unwrap_or(false)
}

/// 配置文本（缺失返回空串）。
fn value<'a>(configs: &'a HashMap<String, String>, key: &str) -> &'a str {
    configs.get(key).map(String::as_str).unwrap_or("")
}

/// Apple Pay 配置是否齐全（Java `isApplePayConfigComplete`）。
#[must_use]
pub fn apple_pay_config_complete(configs: &HashMap<String, String>) -> bool {
    let provider = if value(configs, CFG_APPLE_PROVIDER).is_empty() {
        "generic"
    } else {
        value(configs, CFG_APPLE_PROVIDER)
    };
    let processing_key_ready = !provider.eq_ignore_ascii_case("generic")
        || value(configs, CFG_APPLE_PROCESSING_KEY) == "1";
    !value(configs, CFG_APPLE_MERCHANT_ID).trim().is_empty()
        && !value(configs, CFG_APPLE_DISPLAY_NAME).trim().is_empty()
        && value(configs, CFG_APPLE_MERCHANT_CERT) == "1"
        && value(configs, CFG_APPLE_MERCHANT_KEY) == "1"
        && processing_key_ready
        && !value(configs, CFG_APPLE_GATEWAY).trim().is_empty()
        && !value(configs, CFG_APPLE_MERCHANT_NO).trim().is_empty()
        && !value(configs, CFG_APPLE_ACQUIRER_KEY).trim().is_empty()
}

/// 支付方式排序索引（Java `getPaymentOrderIndex`：父级映射 + 微信在支付宝前）。
#[must_use]
pub fn payment_order_index(order_list: &[String], method: &str) -> usize {
    if let Some(index) = order_list.iter().position(|v| v == method) {
        return index;
    }
    for prefix in ["yabanpay", "yunpay", "huifu", "lakala", "yeepay"] {
        if method.starts_with(prefix) {
            if let Some(index) = order_list.iter().position(|v| v == prefix) {
                return if method.contains("Wechat") {
                    index
                } else {
                    index + 1
                };
            }
        }
    }
    order_list.len()
}

/// 可用支付方式（Java `PaymentServiceImpl#getAvailablePayment` 的等价实现）。
///
/// `kind = "order"` 时追加 `offline`（线下支付），`checkout` 不追加。
#[must_use]
pub fn available_payments(
    configs: &HashMap<String, String>,
    client_type: &str,
    kind: &str,
) -> Vec<String> {
    let in_wechat = client_type == "miniProgram" || client_type == "wechat";
    let mut list: Vec<String> = Vec::new();
    if enabled(configs, CFG_USE_WECHAT) {
        list.push("wechat".into());
    }
    if enabled(configs, CFG_USE_ALIPAY) && !in_wechat {
        list.push("alipay".into());
    }
    if enabled(configs, CFG_USE_PAYPAL) {
        list.push("paypal".into());
    }
    if enabled(configs, CFG_USE_APPLE_PAY)
        && (client_type == "h5" || client_type == "pc")
        && apple_pay_config_complete(configs)
    {
        list.push("applepay".into());
    }
    if enabled(configs, CFG_USE_LAKALA) {
        list.push("lakalaWechat".into());
        if !in_wechat {
            list.push("lakalaAlipay".into());
        }
    }
    if enabled(configs, CFG_USE_YABANPAY) {
        if enabled(configs, CFG_USE_YABANPAY_WECHAT) {
            list.push("yabanpayWechat".into());
        }
        if enabled(configs, CFG_USE_YABANPAY_ALIPAY) && !in_wechat {
            list.push("yabanpayAlipay".into());
        }
    }
    if enabled(configs, CFG_USE_YUNPAY) {
        list.push("yunpayWechat".into());
        if !in_wechat {
            list.push("yunpayAlipay".into());
        }
    }
    if enabled(configs, CFG_USE_HUIFU) {
        list.push("huifuWechat".into());
        if !in_wechat {
            list.push("huifuAlipay".into());
        }
    }
    if enabled(configs, CFG_USE_YEEPAY) {
        list.push("yeepayWechat".into());
        if !in_wechat {
            list.push("yeepayAlipay".into());
        }
    }
    if enabled(configs, CFG_USE_OFFLINE) && kind == "order" {
        list.push("offline".into());
    }
    // paymentOrder 排序（稳定排序，未配置的排在末尾并保持原顺序）
    let raw = value(configs, CFG_PAYMENT_ORDER);
    if !raw.trim().is_empty() {
        let order_list: Vec<String> = raw
            .split(',')
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .collect();
        let mut keyed: Vec<(usize, usize, String)> = list
            .iter()
            .enumerate()
            .map(|(idx, method)| {
                (
                    payment_order_index(&order_list, method),
                    idx,
                    method.clone(),
                )
            })
            .collect();
        keyed.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
        list = keyed.into_iter().map(|(_, _, method)| method).collect();
    }
    list
}

/// 线下支付说明（Java `getPayOrderInfo` 的 offlinePaymentList 构建）。
#[must_use]
pub fn offline_payment_list(
    configs: &HashMap<String, String>,
    payment_list: &[String],
    order_sn: &str,
) -> BTreeMap<String, String> {
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    let mut offline = payment_list.iter().any(|m| m == "offline");
    if !offline && enabled(configs, CFG_USE_OFFLINE) {
        offline = true;
    }
    if !offline {
        return map;
    }
    let push =
        |map: &mut BTreeMap<String, String>, enable_key: &str, text_key: &str, name: &str| {
            if enabled(configs, enable_key) {
                let text = value(configs, text_key).replace("{$order_sn}", order_sn);
                map.insert(name.to_string(), text);
            }
        };
    push(
        &mut map,
        CFG_OFFLINE_PAY_BANK_ENABLE,
        CFG_OFFLINE_PAY_BANK,
        "offlinePayBank",
    );
    push(
        &mut map,
        CFG_OFFLINE_PAY_COMPANY_ENABLE,
        CFG_OFFLINE_PAY_COMPANY,
        "offlinePayCompany",
    );
    push(
        &mut map,
        CFG_THIRD_PARTY_TRANSFER_ENABLE,
        CFG_THIRD_PARTY_TRANSFER,
        "thirdPartyPaymentTransfer",
    );
    push(
        &mut map,
        CFG_OTHER_REMITTANCE_ENABLE,
        CFG_OTHER_REMITTANCE,
        "otherPaymentRemittance",
    );
    map
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// `index?id=`。
use crate::models::trade::check::tolerant_opt_i32;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PayIndexQuery {
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub id: Option<i32>,
}

/// `getPayLog?id=`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PayLogQuery {
    pub id: Option<i32>,
}

/// `checkStatus?id=&paylogId=`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckStatusQuery {
    pub id: Option<i32>,
    pub paylog_id: Option<i32>,
}

/// `create?id=&type=&code=` / `createDepositPayment`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PayCreateQuery {
    pub id: Option<i32>,
    pub r#type: Option<String>,
    pub code: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 订单摘要（见模块偏差 1；Java `OrderVO` 全量由订单域迁移）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayOrderVO {
    pub order_id: i32,
    pub order_sn: String,
    pub user_id: i32,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
    pub unpaid_amount: Decimal,
    pub balance: Decimal,
    /// 会员可用余额（前端支付页余额抵扣读取 `balanceAmount`）
    pub balance_amount: Decimal,
    pub pay_status: i32,
    pub order_status: i32,
    pub is_presale: i32,
    pub presale_type: Option<i32>,
    pub pay_type_id: i32,
    /// 下单时间（Java `TigUtils.handelTime` 格式化串，H5 支付页直接展示）
    pub add_time: String,
    /// 配送方式名称（`order.shipping_type_name` 列；空串时 H5 回退「专线物流」）
    pub shipping_type_name: Option<String>,
}

/// 支付页面（Java `PayIndexVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayIndexVO {
    pub order: Option<PayOrderVO>,
    pub payment_list: Vec<String>,
    pub offline_payment_list: BTreeMap<String, String>,
}

/// 预约订单信息（Java `OrderReservationVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderReservationVO {
    pub order_reservations_id: i32,
    pub order_id: i32,
    pub product_reservation_time_id: Option<i32>,
    pub sku_id: i32,
    pub reservation_date: String,
    pub start_time: String,
    pub end_time: String,
    pub time_slot_description: String,
    pub add_time: String,
}

/// 支付日志（Java `PaylogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaylogVO {
    pub paylog_id: Option<i32>,
    pub pay_sn: Option<String>,
    pub pay_name: Option<String>,
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub order_amount: Option<Decimal>,
    pub order_type: Option<i32>,
    pub pay_amount: Option<Decimal>,
    pub pay_status: Option<i32>,
    pub pay_code: Option<String>,
    pub add_time: Option<i64>,
    pub transaction_id: Option<String>,
    pub notify_data: Option<String>,
    pub refund_amount: Option<Decimal>,
    pub token_code: Option<String>,
    pub order_reservation: Option<OrderReservationVO>,
}

/// 支付创建返回（Java `PayCreateVO`；本切片仅用于类型占位，`create` 恒返回未迁移错误）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayCreateVO {
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub order_amount: Option<Decimal>,
    pub pay_info: Option<serde_json::Value>,
    pub code: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect()
    }

    #[test]
    fn pay_names_and_reservation() {
        assert_eq!(pay_method_name("wechat"), "微信");
        assert_eq!(pay_method_name("huifuAlipay"), "汇付支付宝");
        assert_eq!(pay_method_name("unknownCode"), "unknownCode");
        assert!(is_reservation_order(Some(9)));
        assert!(is_reservation_order(Some(10)));
        assert!(!is_reservation_order(Some(1)));
        assert!(!is_reservation_order(None));
    }

    #[test]
    fn available_payments_switch_and_client_filter() {
        let configs = cfg(&[
            (CFG_USE_WECHAT, "1"),
            (CFG_USE_ALIPAY, "1"),
            (CFG_USE_HUIFU, "1"),
            (CFG_USE_OFFLINE, "1"),
        ]);
        let list = available_payments(&configs, "pc", "order");
        assert_eq!(
            list,
            vec!["wechat", "alipay", "huifuWechat", "huifuAlipay", "offline"]
        );
        // 微信环境排除支付宝类
        let list = available_payments(&configs, "wechat", "order");
        assert_eq!(list, vec!["wechat", "huifuWechat", "offline"]);
        // checkout 不含 offline
        let list = available_payments(&configs, "pc", "checkout");
        assert!(!list.contains(&"offline".to_string()));
        // 全部关闭 ⇒ 空
        assert!(available_payments(&HashMap::new(), "pc", "order").is_empty());
    }

    #[test]
    fn available_payments_sorted_by_payment_order() {
        let configs = cfg(&[
            (CFG_USE_WECHAT, "1"),
            (CFG_USE_ALIPAY, "1"),
            (CFG_USE_PAYPAL, "1"),
            (CFG_PAYMENT_ORDER, "paypal,yabanpay,wechat,alipay"),
        ]);
        let list = available_payments(&configs, "pc", "checkout");
        assert_eq!(list, vec!["paypal", "wechat", "alipay"]);
    }

    #[test]
    fn apple_pay_requires_complete_config_and_client() {
        let configs = cfg(&[
            (CFG_USE_APPLE_PAY, "1"),
            (CFG_APPLE_MERCHANT_ID, "merchant.com.x"),
            (CFG_APPLE_DISPLAY_NAME, "TigShop"),
            (CFG_APPLE_MERCHANT_CERT, "1"),
            (CFG_APPLE_MERCHANT_KEY, "1"),
            (CFG_APPLE_GATEWAY, "https://gw"),
            (CFG_APPLE_MERCHANT_NO, "m1"),
            (CFG_APPLE_ACQUIRER_KEY, "k1"),
            (CFG_APPLE_PROCESSING_KEY, "1"),
        ]);
        assert!(available_payments(&configs, "pc", "checkout").contains(&"applepay".to_string()));
        assert!(
            !available_payments(&configs, "wechat", "checkout").contains(&"applepay".to_string())
        );
        // provider=generic 且未上传处理私钥 ⇒ 不完整
        let mut configs = configs;
        configs.insert(CFG_APPLE_PROCESSING_KEY.into(), "0".into());
        assert!(!apple_pay_config_complete(&configs));
    }

    #[test]
    fn offline_payment_list_builds_text_and_replaces_order_sn() {
        let configs = cfg(&[
            (CFG_USE_OFFLINE, "1"),
            (CFG_OFFLINE_PAY_BANK_ENABLE, "1"),
            (CFG_OFFLINE_PAY_BANK, "请汇款至账户，订单号 {$order_sn}"),
            (CFG_OFFLINE_PAY_COMPANY_ENABLE, "0"),
            (CFG_THIRD_PARTY_TRANSFER_ENABLE, "1"),
            (CFG_THIRD_PARTY_TRANSFER, "转账备注 {$order_sn}"),
        ]);
        let list = vec!["offline".to_string()];
        let map = offline_payment_list(&configs, &list, "SN2026");
        assert_eq!(
            map.get("offlinePayBank").map(String::as_str),
            Some("请汇款至账户，订单号 SN2026")
        );
        assert_eq!(
            map.get("thirdPartyPaymentTransfer").map(String::as_str),
            Some("转账备注 SN2026")
        );
        assert!(!map.contains_key("offlinePayCompany"));
        // 未开启线下 ⇒ 空 map
        let empty = offline_payment_list(&HashMap::new(), &[], "SN");
        assert!(empty.is_empty());
    }

    #[test]
    fn payment_order_parent_mapping() {
        let order = vec!["huifu".to_string(), "wechat".to_string()];
        assert_eq!(payment_order_index(&order, "huifuWechat"), 0);
        assert_eq!(payment_order_index(&order, "huifuAlipay"), 1);
        assert_eq!(payment_order_index(&order, "wechat"), 1);
        assert_eq!(payment_order_index(&order, "alipay"), order.len());
    }

    #[test]
    fn pay_queries_deserialize_camel_case() {
        let q: CheckStatusQuery = serde_json::from_str(r#"{"id": 5, "paylogId": 9}"#).unwrap();
        assert_eq!(q.id, Some(5));
        assert_eq!(q.paylog_id, Some(9));
        let q: PayCreateQuery =
            serde_json::from_str(r#"{"id": 5, "type": "wechat", "code": "c"}"#).unwrap();
        assert_eq!(q.r#type.as_deref(), Some("wechat"));
    }
}
