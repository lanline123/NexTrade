//! 订单结算域（trade::check）DTO / VO / 纯函数。
//!
//! 对应原 Java `com.tigshop.api.controller.order.CheckController`
//! （`@RequestMapping("/api/order/check")`，6 个端点）。
//!
//! # 迁移口径（逐端点）
//!
//! | 端点 | 实现 |
//! |------|------|
//! | `POST index` / `update` / `updateCoupon` | 结算页数据装配：购物车勾选行、商品金额、可用优惠券（含选中券抵扣）、余额/积分、支付方式、配送方式；运费模板/秒杀/拼团/满减活动未接入（当前运费 0，活动折扣 0） |
//! | `GET  getStoreShippingType` | 按店铺返回 `shipping_type` 列表 |
//! | `GET  getAvailablePaymentType` | 完整 DB/config 实现（`useOffline` / `useSurplus` 开关 + 礼品卡 flowType=12） |
//! | `GET  getInvoice` | 完整 DB 实现（`order_invoice` 最近一条） |
//!
//! 金额 `rust_decimal::Decimal`（JSON 字符串）；时间 i32 秒。
use std::collections::HashMap;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（文案逐字对齐 Java / i18n）
// ——————————————————————————————————————————————

/// `请先登录`（Java `getCurrentUserId()` 无登录态时不可用）。
pub const MSG_LOGIN_REQUIRED: &str = "请先登录";
/// 购物车没有勾选商品。
pub const MSG_CART_EMPTY: &str = "请先选择要结算的商品";

/// 支付类型：在线支付（Java `PaymentType.ONLINE`）。
pub const PAYMENT_TYPE_ONLINE: i32 = 1;
/// 支付类型：线下支付（Java `PaymentType.OFFLINE`）。
pub const PAYMENT_TYPE_OFFLINE: i32 = 3;
/// 礼品卡支付 flowType（Java `getAvailablePaymentType` 特判 12）。
pub const FLOW_TYPE_GIFT_CARD: i32 = 12;
/// 支付类型名称（i18n `payment.type.*`）。
pub const PAYMENT_NAME_ONLINE: &str = "在线支付";
pub const PAYMENT_NAME_OFFLINE: &str = "线下支付";
pub const PAYMENT_NAME_GIFT_CARD: &str = "礼品卡兑换";
/// 配置键：线下支付开关（Java `SettingsEnum.USE_OFFLINE`）。
pub const CONFIG_USE_OFFLINE: &str = "useOffline";
/// 配置键：余额支付开关（Java `SettingsEnum.USE_SURPLUS`）。
pub const CONFIG_USE_SURPLUS: &str = "useSurplus";

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 配置值是否开启（Java `"1".equals(bizVal)`；缺失/异常 → false）。
#[must_use]
pub fn config_enabled(raw: Option<&str>) -> bool {
    raw.map(str::trim) == Some("1")
}

/// 构造支付类型列表（Java `OrderCheckServiceImpl#getAvailablePaymentType`）。
#[must_use]
pub fn build_payment_types(
    use_offline: bool,
    use_surplus: bool,
    has_payment_channels: bool,
    flow_type: Option<i32>,
) -> Vec<PaymentTypeVO> {
    let mut result = Vec::new();
    if flow_type == Some(FLOW_TYPE_GIFT_CARD) {
        result.push(PaymentTypeVO {
            type_id: PAYMENT_TYPE_ONLINE,
            type_name: PAYMENT_NAME_GIFT_CARD.to_string(),
            disabled: false,
            disabled_desc: String::new(),
            is_show: true,
        });
        return result;
    }
    if use_surplus || has_payment_channels {
        result.push(PaymentTypeVO {
            type_id: PAYMENT_TYPE_ONLINE,
            type_name: PAYMENT_NAME_ONLINE.to_string(),
            disabled: false,
            disabled_desc: String::new(),
            is_show: true,
        });
    }
    result.push(PaymentTypeVO {
        type_id: PAYMENT_TYPE_OFFLINE,
        type_name: PAYMENT_NAME_OFFLINE.to_string(),
        disabled: false,
        disabled_desc: String::new(),
        is_show: use_offline,
    });
    result
}

/// 发票查询参数归一（Java `getLastInvoice`：null → 0）。
#[must_use]
pub fn invoice_filter(invoice_type: Option<i32>, title_type: Option<i32>) -> (i32, i32) {
    (invoice_type.unwrap_or(0), title_type.unwrap_or(0))
}

/// 解析购物车 `sku_data`/`extra_sku_data` JSON 字符串为数组（非法/空 → 空数组）。
#[must_use]
pub fn parse_sku_data(raw: Option<&str>) -> serde_json::Value {
    raw.and_then(|v| serde_json::from_str::<serde_json::Value>(v).ok())
        .filter(serde_json::Value::is_array)
        .unwrap_or_else(|| serde_json::Value::Array(Vec::new()))
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 结算参数（Java `OrderCheckParam` 的常用字段子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderCheckParam {
    pub user_id: Option<i32>,
    pub flow_type: Option<i32>,
    pub shop_id: Option<i32>,
    pub delivery_type: Option<i32>,
    pub address_id: Option<i32>,
    pub pay_type_id: Option<i32>,
    pub use_point: Option<i32>,
    pub use_balance: Option<Decimal>,
    pub use_credit: Option<i32>,
    pub use_coupon_ids: Option<Vec<i32>>,
    pub select_user_coupon_ids: Option<Vec<i32>>,
    pub use_default_coupon_ids: Option<i32>,
    /// 前端表单 `shippingType`：`{shopId: {typeId, shopId, typeName}}`，原样回显。
    pub shipping_type: Option<serde_json::Value>,
    pub buyer_note: Option<String>,
    pub select_from: Option<i32>,
    pub enable_change_price: Option<bool>,
}

/// 店铺配送方式查询（Java `StoreShippingTypeQuery`）。
/// 容错的 `Option<i32>` 反序列化：非法值（"NaN"/"undefined"/非数字串/浮点）
/// 一律回 `None` 而不是让整个请求 400。
///
/// 背景：H5 路由 `?flowType=undefined` 经 `Number()` 得 `NaN` 并拼进 GET
/// 参数，严格 serde 解析会让 `getStoreShippingType` 等接口整体 400，
/// 前端静默失败后结算页显示「该收货地址不支持配送」。
pub fn tolerant_opt_i32<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct V;
    impl<'de> serde::de::Visitor<'de> for V {
        type Value = Option<i32>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("i32 or ignorable value")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(i32::try_from(v).ok())
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(i32::try_from(v).ok())
        }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(if v.is_finite() && v.fract() == 0.0 {
                i32::try_from(v as i64).ok()
            } else {
                None
            })
        }
        fn visit_bool<E>(self, v: bool) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(i32::from(v)))
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let s = v.trim();
            if s.is_empty()
                || s.eq_ignore_ascii_case("nan")
                || s.eq_ignore_ascii_case("undefined")
                || s.eq_ignore_ascii_case("null")
            {
                return Ok(None);
            }
            Ok(s.parse::<i32>().ok())
        }
    }
    deserializer.deserialize_any(V)
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StoreShippingTypeQuery {
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub shop_id: Option<i32>,
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub flow_type: Option<i32>,
    pub user_id: Option<i32>,
    pub address_id: Option<i32>,
    pub pay_type_id: Option<i32>,
    pub use_point: Option<i32>,
    pub use_balance: Option<Decimal>,
    pub use_coupon_ids: Option<Vec<i32>>,
    pub exclude_quick_product: Option<bool>,
}

/// 支付方式查询（Java `@RequestParam flowType`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PaymentTypeQuery {
    pub flow_type: Option<i32>,
}

/// 发票查询（Java `@RequestParam invoiceType/titleType`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct InvoiceQuery {
    pub invoice_type: Option<i32>,
    pub title_type: Option<i32>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 支付方式（Java `OrderCheckVO.PaymentType`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PaymentTypeVO {
    pub type_id: i32,
    pub type_name: String,
    pub disabled: bool,
    pub disabled_desc: String,
    pub is_show: bool,
}

/// 订单发票（Java `OrderInvoice` 实体字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceVO {
    pub id: i32,
    pub user_id: i32,
    pub order_id: i32,
    pub invoice_type: i32,
    pub status: i32,
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
    pub add_time: i32,
    pub invoice_attachment: Option<String>,
    pub invoicing_time: Option<i32>,
}

/// 结算页返回（Java `OrderCheckVO` 常用字段子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderCheckVO {
    pub cart_list: Vec<CheckCartByStoreVO>,
    pub total: CheckTotalVO,
    pub has_change_price: bool,
    pub change_price_type: i32,
    pub price_change_type: i32,
    pub cart_change_price_type: i32,
    pub available_points: i32,
    pub coupon_list: CouponListVO,
    pub item: CheckItemVO,
    pub use_coupon_ids: Option<Vec<i32>>,
    pub select_user_coupon_ids: Option<Vec<i32>>,
    pub tmpl_ids: Vec<String>,
    pub flow_type: i32,
    pub message: Option<String>,
    pub delivery_option: Option<serde_json::Value>,
    pub product_presale: Option<serde_json::Value>,
    pub credit_payment_info: Option<serde_json::Value>,
    /// 批发行被排除的券抵扣金额（当前恒 "0"）。
    pub coupon_exclude_amount: String,
    /// 批发行被排除的积分抵扣金额（当前恒 "0"）。
    pub points_exclude_amount: String,
}

/// 按店铺分组的购物车行（Java `CartByStoreVO` 常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckCartByStoreVO {
    pub shop_id: i32,
    pub shop_title: String,
    pub no_shipping: i32,
    pub min_order_amount_diff: String,
    pub is_not_reach_min_order_amount: bool,
    pub carts: Vec<CheckCartVO>,
    pub total: CartStoreTotalVO,
    pub used_promotions: Vec<serde_json::Value>,
    pub enable_use_promotion: Vec<serde_json::Value>,
    pub gift: Vec<serde_json::Value>,
}

/// 结算页购物车行（Java `CartVO` 常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckCartVO {
    pub cart_id: i32,
    pub user_id: i32,
    pub product_id: i32,
    pub product_sn: String,
    pub seo_link: Option<String>,
    pub pic_thumb: String,
    pub market_price: Option<Decimal>,
    pub original_price: Decimal,
    pub quantity: i32,
    pub sku_id: i32,
    pub sku_data: serde_json::Value,
    pub extra_sku_data: serde_json::Value,
    pub product_type: i32,
    pub is_checked: bool,
    pub shop_id: i32,
    #[serde(rename = "type")]
    pub r#type: i32,
    pub update_time: i32,
    pub product_name: String,
    pub product_price: Decimal,
    pub category_id: i32,
    pub brand_id: i32,
    pub product_stock: i32,
    pub price: Decimal,
    pub stock: i32,
    pub has_sku: bool,
    pub subtotal: Decimal,
    pub origin_price: Decimal,
    pub is_disabled: bool,
}

/// 店铺维度金额小计（Java `CartByStoreVO.total`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CartStoreTotalVO {
    pub coupon_ids: Vec<i32>,
    pub discount_coupon_amount: Decimal,
    pub discount_product_promotion_amount: Decimal,
    pub discount_seckill_amount: Decimal,
    pub discount_time_discount_amount: Decimal,
    pub discount_discount_amount: Decimal,
    pub discounts: Decimal,
}

/// 结算总额（Java `OrderCheckVO.Total` 常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckTotalVO {
    pub product_amount: Decimal,
    pub checked_count: i32,
    pub discounts: Decimal,
    pub discount_after: Option<String>,
    pub total_count: i32,
    pub discount_coupon_amount: Decimal,
    pub discount_discount_amount: Decimal,
    pub discount_seckill_amount: Decimal,
    pub discount_product_promotion_amount: Decimal,
    pub discount_time_discount_amount: Decimal,
    pub service_fee: Decimal,
    pub paid_amount: Decimal,
    pub coupon_amount: Decimal,
    pub discount_amount: Decimal,
    pub exchange_points: i32,
    pub points_amount: Decimal,
    pub shipping_fee: Decimal,
    pub store_shipping_fee: HashMap<i32, Decimal>,
    pub total_amount: Decimal,
    pub order_send_point: i32,
    pub balance: Decimal,
    pub unpaid_amount: Decimal,
    pub store_shipping_rule: Option<serde_json::Value>,
    pub tax_rate: Decimal,
    pub tax_rate_amount: Decimal,
    pub gift_card_amount: Decimal,
    /// 账期支付金额（useCredit=1 且可用时等于应付金额）。
    pub credit_amount: Decimal,
    /// 预售定金金额（仅定金预售）。
    pub deposit_amount: Option<Decimal>,
    /// 预售尾款金额（仅定金预售）。
    pub final_payment_amount: Option<Decimal>,
    /// 本次实际支付定金（可能被余额抵扣后）。
    pub actual_pay_deposit_amount: Option<Decimal>,
}

/// 优惠券列表（Java `OrderCheckVO.CouponList`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponListVO {
    pub enable_coupons: Vec<CheckCouponVO>,
    pub disable_coupons: Vec<serde_json::Value>,
}

/// 结算页可用优惠券（Java `OrderCheckVO.Coupon`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckCouponVO {
    pub id: i32,
    pub coupon_id: i32,
    pub coupon_name: String,
    pub coupon_type: i32,
    pub coupon_money: Decimal,
    pub min_order_amount: Decimal,
    pub coupon_desc: String,
    pub is_global: bool,
    pub coupon_discount: Decimal,
    pub shop_id: i32,
    pub end_date: String,
    pub user_coupon_id: i32,
    pub selected: bool,
}

/// 结算项（Java `OrderCheckVO.Item`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckItemVO {
    pub address_id: i32,
    /// `{shopId: {typeId, shopId, typeName}}`，原样回显前端表单。
    pub shipping_type: serde_json::Value,
    pub pay_type_id: i32,
    pub use_point: i32,
    pub use_balance: Decimal,
    pub use_credit: i32,
    pub use_coupon_ids: Option<Vec<i32>>,
    pub select_user_coupon_ids: Option<Vec<i32>>,
    pub flow_type: i32,
    pub delivery_type: Option<i32>,
}

/// 配送方式（Java `OrderCheckVO.ShippingType`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeVO {
    pub shipping_type_id: i32,
    pub shipping_type_name: String,
    pub origin_shipping_type_name: String,
    pub shipping_default_id: Option<i32>,
    pub shipping_type_desc: Option<String>,
    pub shipping_time_desc: Option<String>,
    pub is_support_cod: Option<i32>,
    pub sort_order: i32,
    pub shop_id: i32,
}

// ——————————————————————————————————————————————
// 拼团购物车数据（加购时随 `grouponData` 写入 cart.extra_data）
// ——————————————————————————————————————————————

/// 加购时的拼团上下文（Java `AddToCartDTO.GrouponData`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponCartData {
    /// 拼团活动 ID。
    pub groupon_promotion_id: Option<i64>,
    /// 拼团活动商品 ID。
    pub groupon_promotion_item_id: Option<i64>,
    /// 成团信息（明细）ID。
    pub groupon_detail_id: Option<i64>,
    /// 成团人数 key（阶梯团用）。
    pub group_num_key: Option<i32>,
    /// 拼团价。
    pub price: Option<Decimal>,
    /// 开团记录 ID（参团时由前端/购物车带入）。
    pub groupon_promotion_record_id: Option<i64>,
}

impl GrouponCartData {
    /// 是否包含完整拼团上下文（活动 + 活动商品）。
    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.groupon_promotion_id.unwrap_or(0) > 0
            && self.groupon_promotion_item_id.unwrap_or(0) > 0
    }
}

/// 解析购物车 `extra_data` 中的拼团上下文（非法/空 → None）。
#[must_use]
pub fn parse_groupon_data(raw: Option<&str>) -> Option<GrouponCartData> {
    let raw = raw?.trim();
    if raw.is_empty() || raw == "null" {
        return None;
    }
    let data: GrouponCartData = serde_json::from_str(raw).ok()?;
    if data.is_valid() {
        Some(data)
    } else {
        None
    }
}

/// 从活动商品 `group_num` JSON 中取指定 key 的成团人数（缺失→最小成团人数）。
#[must_use]
pub fn groupon_min_group_num(group_num_json: &str, group_num_key: Option<i32>) -> i32 {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(group_num_json) else {
        return 0;
    };
    let Some(list) = value.as_array() else {
        return 0;
    };
    if let Some(key) = group_num_key {
        for tier in list {
            if tier.get("groupNumKey").and_then(serde_json::Value::as_i64) == Some(i64::from(key)) {
                if let Some(num) = tier.get("groupNum").and_then(serde_json::Value::as_i64) {
                    return i32::try_from(num).unwrap_or(0);
                }
            }
        }
    }
    list.iter()
        .filter_map(|tier| tier.get("groupNum").and_then(serde_json::Value::as_i64))
        .min()
        .and_then(|v| i32::try_from(v).ok())
        .unwrap_or(0)
}

/// 从明细 `group_price` JSON 中取指定 key 的拼团价（缺失→最低价）。
#[must_use]
pub fn groupon_price_for(group_price_json: &str, group_num_key: Option<i32>) -> Option<Decimal> {
    let value = serde_json::from_str::<serde_json::Value>(group_price_json).ok()?;
    let list = value.as_array()?;
    let price_of = |tier: &serde_json::Value| -> Option<Decimal> {
        tier.get("price").and_then(|v| {
            v.as_str()
                .and_then(|s| s.parse::<Decimal>().ok())
                .or_else(|| v.as_f64().and_then(Decimal::from_f64_retain))
        })
    };
    if let Some(key) = group_num_key {
        for tier in list {
            if tier.get("groupNumKey").and_then(serde_json::Value::as_i64) == Some(i64::from(key)) {
                if let Some(price) = price_of(tier) {
                    return Some(price);
                }
            }
        }
    }
    list.iter().filter_map(price_of).min()
}

// ——————————————————————————————————————————————
// 结算计算纯函数（结算页与下单共用，保证金额口径一致）
// ——————————————————————————————————————————————

/// 积分抵扣计算结果。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PointsCalc {
    /// 本单最多可用积分（受用户积分 / 积分价值 / 支付比例封顶）。
    pub available_points: i32,
    /// 实际使用积分。
    pub used_points: i32,
    /// 积分抵扣金额。
    pub points_amount: Decimal,
}

/// Decimal → i32（截断并钳制到 `[0, i32::MAX]`；用于积分等整数口径）。
fn dec_clamp_i32(value: Decimal) -> i32 {
    let text = value.trunc().to_string();
    text.parse::<i64>()
        .unwrap_or(i64::MAX)
        .clamp(0, i64::from(i32::MAX)) as i32
}

/// 计算积分抵扣（Java `getOrderAvailablePoints` / `getPointValueAmount`）。
///
/// - `integral_scale`：每 100 积分可抵扣金额（Java `integralScale`）；
/// - `integral_percent`：每 `integral_percent_base` 元最多可使用的积分（Java `integralPercent`）；
/// - `base`：可抵扣基数（商品金额 - 优惠券）；
/// - 返回可用积分、实际使用积分与抵扣金额（金额不超过 `base`）。
#[must_use]
pub fn calc_points(
    use_point: i32,
    user_points: i32,
    base: Decimal,
    integral_scale: Decimal,
    integral_percent: Decimal,
    integral_percent_base: Decimal,
) -> PointsCalc {
    let zero = Decimal::ZERO;
    let base = base.max(zero);
    if user_points <= 0 || base <= zero || integral_scale <= zero {
        return PointsCalc::default();
    }
    // 积分价值上限：每 100 积分抵 integral_scale 元 → 覆盖 base 需要的积分
    let value_points = dec_clamp_i32((base * Decimal::ONE_HUNDRED / integral_scale).ceil());
    // 支付比例上限
    let percent_base = if integral_percent_base > zero {
        integral_percent_base
    } else {
        Decimal::ONE_HUNDRED
    };
    let max_percent_points = if integral_percent > zero {
        dec_clamp_i32((base * integral_percent / percent_base).trunc())
    } else {
        0
    };
    let available = user_points.min(value_points).min(max_percent_points).max(0);
    let used = use_point.max(0).min(available);
    let mut points_amount = Decimal::from(used) * integral_scale / Decimal::ONE_HUNDRED;
    if points_amount > base {
        points_amount = base;
    }
    PointsCalc {
        available_points: available,
        used_points: used,
        points_amount: points_amount.max(zero),
    }
}

/// 计算定金（Java `ProductPresaleService#calcDepositAmount` 口径）。
///
/// - `deposit_type`：1=按比例，2=固定金额；
/// - 比例：`amount * ratio / 100`，`round_down` 时向下取整；
/// - 结果不超过 `amount`。
#[must_use]
pub fn calc_deposit(
    amount: Decimal,
    deposit_type: Option<i32>,
    ratio: Option<i32>,
    fixed_amount: Option<Decimal>,
    round_down: Option<i32>,
) -> Decimal {
    let amount = amount.max(Decimal::ZERO);
    let mut deposit = match deposit_type {
        Some(1) => {
            let ratio = Decimal::from(ratio.unwrap_or(0).clamp(0, 100));
            let mut value = amount * ratio / Decimal::ONE_HUNDRED;
            if round_down == Some(1) {
                value = value.trunc();
            }
            value
        }
        Some(2) => fixed_amount.unwrap_or_default(),
        _ => Decimal::ZERO,
    };
    let deposit = deposit.max(Decimal::ZERO).min(amount);
    if deposit > Decimal::ZERO {
        deposit.round_dp(2)
    } else {
        Decimal::ZERO
    }
}

/// 满减/满折规则阶梯（`product_promotion.promotion_type_data` JSON）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PromotionTier {
    /// 门槛（金额或件数，取决于 `unit`）。
    pub min_amount: Decimal,
    /// 满减金额（type=1）或折扣（type=2，几折）。
    pub reduce: Decimal,
    /// 满赠赠品 ID（type=3）。
    pub gift_id: Option<i32>,
    /// 满赠数量（type=3）。
    pub num: i32,
}

/// 解析 `promotion_type_data`（`[{"minAmount":100,"reduce":10}]`，兼容字符串/数字）。
#[must_use]
pub fn parse_promotion_tiers(raw: &str) -> Vec<PromotionTier> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        return Vec::new();
    };
    let Some(list) = value.as_array() else {
        return Vec::new();
    };
    let as_decimal = |v: &serde_json::Value| -> Option<Decimal> {
        v.as_str()
            .and_then(|s| s.parse::<Decimal>().ok())
            .or_else(|| v.as_f64().and_then(Decimal::from_f64_retain))
    };
    list.iter()
        .filter_map(|item| {
            let min = item.get("minAmount").and_then(|v| as_decimal(v))?;
            let reduce = item
                .get("reduce")
                .and_then(|v| as_decimal(v))
                .unwrap_or(Decimal::ZERO);
            let gift_id = item
                .get("giftId")
                .and_then(|v| v.as_i64())
                .map(|v| i32::try_from(v).unwrap_or(0))
                .filter(|v| *v > 0);
            let num = item
                .get("num")
                .and_then(|v| v.as_i64())
                .map(|v| i32::try_from(v).unwrap_or(0))
                .unwrap_or(0);
            Some(PromotionTier {
                min_amount: min,
                reduce,
                gift_id,
                num,
            })
        })
        .collect()
}

/// 选取满足门槛的最高档（`isMoreApplicablePromotionRule`：minAmount 更大者优先）。
#[must_use]
pub fn pick_promotion_tier(
    tiers: &[PromotionTier],
    compare_data: Decimal,
) -> Option<&PromotionTier> {
    tiers
        .iter()
        .filter(|tier| tier.min_amount > Decimal::ZERO && tier.min_amount <= compare_data)
        .max_by(|a, b| a.min_amount.cmp(&b.min_amount))
}

/// 计算满减/满折后的总优惠与价格比例（Java `ProductPromotionServiceImpl#parsePrice`）。
///
/// - `promotion_type`：1 满减，2 满折（3 满赠不参与价格计算）；
/// - `rules_type`：1 阶梯（只减一次），其他为循环优惠（按门槛倍数叠减）；
/// - 返回 `(总优惠金额, 折后价格比例)`；不满足门槛返回 None。
#[must_use]
pub fn promotion_discount(
    promotion_type: i32,
    rules_type: i32,
    tier: &PromotionTier,
    compare_data: Decimal,
    price_amount: Decimal,
) -> Option<(Decimal, Decimal)> {
    if price_amount <= Decimal::ZERO
        || compare_data < tier.min_amount
        || tier.min_amount <= Decimal::ZERO
    {
        return None;
    }
    match promotion_type {
        1 => {
            let mut total = if rules_type == 1 {
                tier.reduce
            } else {
                let times = (compare_data / tier.min_amount).trunc().max(Decimal::ONE);
                tier.reduce * times
            };
            total = total.min(price_amount).max(Decimal::ZERO);
            let proportion = if total >= price_amount {
                Decimal::ZERO
            } else {
                (price_amount - total) / price_amount
            };
            Some((total, proportion))
        }
        2 => {
            let ten = Decimal::from(10);
            let proportion = tier.reduce.max(Decimal::ZERO).min(ten) / ten;
            let total = (price_amount * (Decimal::ONE - proportion)).max(Decimal::ZERO);
            Some((total, proportion))
        }
        _ => None,
    }
}

/// 优惠券抵扣金额（Java `coupon_discount_amount`）：
/// `coupon_type == 2` 为折扣券（`coupon_discount` 为几折），否则为满减券（`coupon_money`）；
/// `max_order_amount > 0` 时封顶。
#[must_use]
pub fn coupon_rule_discount(
    coupon_type: i32,
    coupon_money: Decimal,
    coupon_discount: Decimal,
    max_order_amount: Decimal,
    base: Decimal,
) -> Decimal {
    let base = base.max(Decimal::ZERO);
    let mut amount = if coupon_type == 2 {
        let ten = Decimal::from(10);
        let discount = coupon_discount.max(Decimal::ZERO).min(ten);
        base * (ten - discount) / ten
    } else {
        coupon_money
    };
    if max_order_amount > Decimal::ZERO {
        amount = amount.min(max_order_amount);
    }
    amount.max(Decimal::ZERO).min(base)
}

/// 把一笔（全局券）优惠按店铺商品金额比例分摊；最后一家承担舍入余额，保证合计精确。
#[must_use]
pub fn allocate_discount(
    total_discount: Decimal,
    store_amounts: &std::collections::BTreeMap<i32, Decimal>,
) -> HashMap<i32, Decimal> {
    let mut result: HashMap<i32, Decimal> = HashMap::new();
    let total_amount: Decimal = store_amounts.values().copied().sum();
    if total_discount <= Decimal::ZERO || total_amount <= Decimal::ZERO {
        return result;
    }
    let mut allocated = Decimal::ZERO;
    let shops: Vec<i32> = store_amounts.keys().copied().collect();
    for (idx, shop_id) in shops.iter().enumerate() {
        let amount = if idx + 1 == shops.len() {
            (total_discount - allocated).max(Decimal::ZERO)
        } else {
            let store_amount = store_amounts.get(shop_id).copied().unwrap_or_default();
            (total_discount * store_amount / total_amount)
                .round_dp(2)
                .min(total_discount - allocated)
                .max(Decimal::ZERO)
        };
        allocated += amount;
        result.insert(*shop_id, amount);
    }
    result
}

/// 运费模板规则（`shipping_tpl` + `shipping_tpl_info` 的结算相关字段）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ShippingRule {
    pub pricing_type: i32,
    pub is_free: bool,
    pub start_number: Decimal,
    pub start_price: Decimal,
    pub add_number: Decimal,
    pub add_price: Decimal,
    pub free_price: Decimal,
}

/// 计算一个店铺的运费（Java `ShippingTplInfoService#getShippingFee` 的口径）：
/// - 包邮 / 满额包邮 → 0；
/// - 按件 `pricing_type=1`、按重 `2`、按体积 `3`；
/// - 首件/首重/首体积内 → `start_price`；
/// - 超出部分按（`add_number`，`add_price`）向上取整累加。
#[must_use]
pub fn calc_shipping_fee(
    rule: &ShippingRule,
    shop_amount: Decimal,
    quantity: Decimal,
    weight: Decimal,
    volume: Decimal,
) -> Decimal {
    if rule.is_free {
        return Decimal::ZERO;
    }
    if rule.free_price > Decimal::ZERO && shop_amount >= rule.free_price {
        return Decimal::ZERO;
    }
    let base = match rule.pricing_type {
        2 => weight.max(Decimal::ZERO),
        3 => volume.max(Decimal::ZERO),
        _ => quantity.max(Decimal::ZERO),
    };
    if rule.start_number <= Decimal::ZERO || rule.add_number <= Decimal::ZERO {
        // 规则不完整：只收首价（不猜测续价）
        return rule.start_price.max(Decimal::ZERO);
    }
    // 体积计费与原版一致：只有严格超过首体积才加收续费。
    let over = base > rule.start_number;
    if !over {
        return rule.start_price.max(Decimal::ZERO);
    }
    let extra = base - rule.start_number;
    let units = (extra / rule.add_number).ceil();
    (rule.start_price + units * rule.add_price).max(Decimal::ZERO)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payment_types_match_java_logic() {
        let types = build_payment_types(true, true, true, Some(12));
        assert_eq!(types.len(), 1);
        assert_eq!(types[0].type_name, "礼品卡兑换");

        let types = build_payment_types(false, false, false, None);
        assert_eq!(types.len(), 1);
        assert_eq!(types[0].type_id, PAYMENT_TYPE_OFFLINE);
        assert!(!types[0].is_show);

        let types = build_payment_types(true, true, false, None);
        assert_eq!(types.len(), 2);
        assert_eq!(types[0].type_id, PAYMENT_TYPE_ONLINE);
    }

    #[test]
    fn config_and_invoice_defaults() {
        assert!(config_enabled(Some("1")));
        assert!(!config_enabled(Some("0")));
        assert!(!config_enabled(None));
        assert_eq!(invoice_filter(None, None), (0, 0));
    }

    #[test]
    fn params_accept_frontend_form_state() {
        let param: OrderCheckParam = serde_json::from_str(
            r#"{"flowType":1,"addressId":3,"useCouponIds":[1,2],"useBalance":10.5,
                "shippingType":{"0":{"typeId":1,"shopId":0,"typeName":"快递发货"}}}"#,
        )
        .unwrap();
        assert_eq!(param.flow_type, Some(1));
        assert_eq!(param.use_coupon_ids, Some(vec![1, 2]));
        assert!(param.shipping_type.is_some());
    }

    #[test]
    fn check_vo_serializes_frontend_field_names() {
        let vo = OrderCheckVO {
            flow_type: 1,
            available_points: 100,
            total: CheckTotalVO {
                product_amount: Decimal::new(1050, 2),
                total_amount: Decimal::new(1050, 2),
                ..Default::default()
            },
            ..Default::default()
        };
        let value = serde_json::to_value(&vo).unwrap();
        assert_eq!(value["flowType"], 1);
        assert_eq!(value["availablePoints"], 100);
        assert_eq!(value["total"]["productAmount"], "10.50");
        assert!(value.get("couponList").is_some());
        assert!(value.get("cartList").is_some());
    }

    #[test]
    fn parse_sku_data_tolerates_bad_json() {
        assert_eq!(parse_sku_data(None), serde_json::json!([]));
        assert_eq!(parse_sku_data(Some("not-json")), serde_json::json!([]));
        assert_eq!(
            parse_sku_data(Some(r#"[{"name":"颜色","value":"红"}]"#)),
            serde_json::json!([{"name":"颜色","value":"红"}])
        );
    }

    #[test]
    fn cart_empty_message_is_explicit() {
        assert_eq!(MSG_CART_EMPTY, "请先选择要结算的商品");
        assert_eq!(MSG_LOGIN_REQUIRED, "请先登录");
    }

    #[test]
    fn points_calc_respects_scale_and_percent() {
        // integralScale=1（100 积分=1 元），integralPercent=50（每 100 元最多 50 积分）
        let calc = calc_points(
            9999,
            1000,
            Decimal::new(20000, 2), // 200 元
            Decimal::from(1),
            Decimal::from(50),
            Decimal::from(100),
        );
        // 200 元最多用 100 积分（50/100 * 200）
        assert_eq!(calc.available_points, 100);
        assert_eq!(calc.used_points, 100);
        assert_eq!(calc.points_amount, Decimal::ONE);
    }

    #[test]
    fn points_calc_capped_by_user_and_base() {
        let calc = calc_points(
            500,
            10,
            Decimal::new(100, 2), // 1 元
            Decimal::from(1),
            Decimal::from(50),
            Decimal::from(100),
        );
        // 1 元最多 0 积分（50/100 * 1 向下取整）→ 不可用
        assert_eq!(calc.available_points, 0);
        assert_eq!(calc.points_amount, Decimal::ZERO);

        let calc = calc_points(
            5,
            1000,
            Decimal::new(500, 2),
            Decimal::from(1),
            Decimal::from(100),
            Decimal::from(100),
        );
        assert_eq!(calc.used_points, 5);
        assert_eq!(calc.points_amount, Decimal::new(5, 2));
    }

    #[test]
    fn coupon_rule_money_and_discount() {
        // 满减券
        assert_eq!(
            coupon_rule_discount(
                1,
                Decimal::from(10),
                Decimal::from(0),
                Decimal::ZERO,
                Decimal::from(150)
            ),
            Decimal::from(10)
        );
        // 折扣券 8.5 折 → 优惠 15%
        assert_eq!(
            coupon_rule_discount(
                2,
                Decimal::ZERO,
                Decimal::new(85, 1),
                Decimal::ZERO,
                Decimal::from(100)
            ),
            Decimal::new(15, 0)
        );
        // 封顶
        assert_eq!(
            coupon_rule_discount(
                1,
                Decimal::from(100),
                Decimal::ZERO,
                Decimal::from(30),
                Decimal::from(200)
            ),
            Decimal::from(30)
        );
    }

    #[test]
    fn shipping_fee_first_and_additional_units() {
        let rule = ShippingRule {
            pricing_type: 1, // 按件
            is_free: false,
            start_number: Decimal::from(1),
            start_price: Decimal::from(5),
            add_number: Decimal::from(2),
            add_price: Decimal::from(2),
            free_price: Decimal::from(100),
        };
        // 1 件：首价 5
        assert_eq!(
            calc_shipping_fee(
                &rule,
                Decimal::from(10),
                Decimal::from(1),
                Decimal::ZERO,
                Decimal::ZERO
            ),
            Decimal::from(5)
        );
        // 4 件：5 + ceil((4-1)/2)*2 = 9
        assert_eq!(
            calc_shipping_fee(
                &rule,
                Decimal::from(10),
                Decimal::from(4),
                Decimal::ZERO,
                Decimal::ZERO
            ),
            Decimal::from(9)
        );
        // 满 100 包邮
        assert_eq!(
            calc_shipping_fee(
                &rule,
                Decimal::from(100),
                Decimal::from(1),
                Decimal::ZERO,
                Decimal::ZERO
            ),
            Decimal::ZERO
        );
        // 包邮模板
        let free = ShippingRule {
            is_free: true,
            ..rule
        };
        assert_eq!(
            calc_shipping_fee(
                &free,
                Decimal::from(1),
                Decimal::from(1),
                Decimal::ZERO,
                Decimal::ZERO
            ),
            Decimal::ZERO
        );
    }

    #[test]
    fn shipping_volume_pricing() {
        let rule = ShippingRule {
            pricing_type: 3,
            is_free: false,
            start_number: Decimal::new(1, 1), // 0.1m³
            start_price: Decimal::from(6),
            add_number: Decimal::new(5, 2), // 0.05m³
            add_price: Decimal::from(3),
            free_price: Decimal::ZERO,
        };
        // 0.25m³：6 + ceil((0.15)/0.05)*3 = 15
        assert_eq!(
            calc_shipping_fee(
                &rule,
                Decimal::from(10),
                Decimal::ZERO,
                Decimal::ZERO,
                Decimal::new(25, 2)
            ),
            Decimal::from(15)
        );
    }

    #[test]
    fn shipping_weight_pricing() {
        let rule = ShippingRule {
            pricing_type: 2,
            is_free: false,
            start_number: Decimal::new(1000, 3), // 1kg
            start_price: Decimal::from(8),
            add_number: Decimal::new(500, 3), // 0.5kg
            add_price: Decimal::from(2),
            free_price: Decimal::ZERO,
        };
        // 2.2kg：8 + ceil((1.2)/0.5)=3 → 14
        assert_eq!(
            calc_shipping_fee(
                &rule,
                Decimal::from(10),
                Decimal::ZERO,
                Decimal::new(2200, 3),
                Decimal::ZERO
            ),
            Decimal::from(14)
        );
    }

    #[test]
    fn discount_allocation_sums_exactly() {
        let mut stores = std::collections::BTreeMap::new();
        stores.insert(0, Decimal::from(100));
        stores.insert(1, Decimal::from(50));
        stores.insert(2, Decimal::from(50));
        let alloc = allocate_discount(Decimal::from(10), &stores);
        assert_eq!(alloc.values().copied().sum::<Decimal>(), Decimal::from(10));
        assert_eq!(alloc.get(&0).copied(), Some(Decimal::from(5)));
    }

    #[test]
    fn presale_deposit_ratio_fixed_and_rounding() {
        // 10% of 32 = 3.2
        assert_eq!(
            calc_deposit(Decimal::from(32), Some(1), Some(10), None, Some(0)),
            Decimal::new(320, 2)
        );
        // 向下取整：33 * 10% = 3.3 → 3
        assert_eq!(
            calc_deposit(Decimal::from(33), Some(1), Some(10), None, Some(1)),
            Decimal::from(3)
        );
        // 固定金额，且不超过订单金额
        assert_eq!(
            calc_deposit(
                Decimal::from(5),
                Some(2),
                None,
                Some(Decimal::from(8)),
                None
            ),
            Decimal::from(5)
        );
        // 未配置类型 → 0
        assert_eq!(
            calc_deposit(Decimal::from(10), None, None, None, None),
            Decimal::ZERO
        );
    }

    #[test]
    fn groupon_cart_data_parse_and_tiers() {
        let raw = r#"{"grouponPromotionId":43,"grouponPromotionItemId":65,"groupNumKey":2,"price":"35.00"}"#;
        let data = parse_groupon_data(Some(raw)).unwrap();
        assert!(data.is_valid());
        assert_eq!(data.group_num_key, Some(2));
        assert_eq!(data.price, Some(Decimal::new(3500, 2)));
        assert!(parse_groupon_data(Some("{}")).is_none());
        assert!(parse_groupon_data(None).is_none());

        let group_num = r#"[{"groupNum":3,"groupNumKey":1},{"groupNum":5,"groupNumKey":2}]"#;
        assert_eq!(groupon_min_group_num(group_num, Some(2)), 5);
        assert_eq!(groupon_min_group_num(group_num, Some(9)), 3);

        let prices = r#"[{"price":40,"groupNumKey":1},{"price":35,"groupNumKey":2}]"#;
        assert_eq!(groupon_price_for(prices, Some(2)), Some(Decimal::from(35)));
        assert_eq!(groupon_price_for(prices, None), Some(Decimal::from(35)));
        assert_eq!(groupon_price_for("not-json", Some(1)), None);
    }

    #[test]
    fn promotion_tiers_and_discount() {
        let tiers = parse_promotion_tiers(
            r#"[{"minAmount":100,"reduce":10},{"minAmount":300,"reduce":50}]"#,
        );
        assert_eq!(tiers.len(), 2);
        let tier = pick_promotion_tier(&tiers, Decimal::from(350)).unwrap();
        assert_eq!(tier.reduce, Decimal::from(50));
        // 阶梯满减：350 减 50
        let (total, proportion) =
            promotion_discount(1, 1, tier, Decimal::from(350), Decimal::from(350)).unwrap();
        assert_eq!(total, Decimal::from(50));
        assert!(proportion < Decimal::ONE);
        // 循环优惠：350/300 = 1 倍 → 50
        let (loop_total, _) =
            promotion_discount(1, 0, tier, Decimal::from(600), Decimal::from(600)).unwrap();
        assert_eq!(loop_total, Decimal::from(100));
        // 满折 8.5 折
        let tier = PromotionTier {
            min_amount: Decimal::from(100),
            reduce: Decimal::new(85, 1),
            gift_id: None,
            num: 0,
        };
        let (total, proportion) =
            promotion_discount(2, 1, &tier, Decimal::from(200), Decimal::from(200)).unwrap();
        assert_eq!(total, Decimal::from(30));
        assert_eq!(proportion, Decimal::new(85, 2));
        assert!(promotion_discount(1, 1, &tier, Decimal::from(10), Decimal::from(10)).is_none());
    }
}

#[cfg(test)]
mod tolerant_query_tests {
    use super::*;

    #[test]
    fn tolerant_flow_type_ignores_garbage() {
        // H5 路由漏参:Number(undefined)=NaN → "NaN" 入查询串
        let q: StoreShippingTypeQuery =
            serde_json::from_str(r#"{"flowType":"NaN"}"#).expect("NaN must not fail");
        assert_eq!(q.flow_type, None);

        let q: StoreShippingTypeQuery =
            serde_json::from_str(r#"{"flowType":"undefined"}"#).expect("undefined must not fail");
        assert_eq!(q.flow_type, None);

        // 正常值不受影响
        let q: StoreShippingTypeQuery =
            serde_json::from_str(r#"{"flowType":"12"}"#).expect("12 must parse");
        assert_eq!(q.flow_type, Some(12));

        // 缺省 → None
        let q: StoreShippingTypeQuery = serde_json::from_str("{}").expect("missing ok");
        assert_eq!(q.flow_type, None);
    }
}
