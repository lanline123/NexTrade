//! 订单 DTO，对应原 Java `dto/order`、`query/order`、`vo/order`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 随单发票提交数据。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct InvoiceDataDTO {
    /// 发票类型：1-普通发票 2-增值税专用发票
    pub invoice_type: Option<i32>,
    /// 抬头类型：1-个人 2-单位
    pub title_type: Option<i32>,
    /// 发票抬头
    pub title: Option<String>,
    /// 纳税人识别号
    pub tax_no: Option<String>,
    /// 发票内容
    pub content: Option<String>,
    /// 单位电话
    pub tax_phone: Option<String>,
    /// 个人或单位名称
    pub company_name: Option<String>,
    /// 收票人邮箱
    pub email: Option<String>,
    /// 收票人手机号
    pub mobile: Option<String>,
}

/// 创建订单请求（提交结算页数据）。
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderCreateDTO {
    /// 购物车行ID列表
    pub cart_ids: Vec<i32>,
    /// 收货地址ID；自提时可空
    pub address_id: Option<i32>,
    /// 配送方式：1-快递 2-自提 3-同城配送
    pub shipping_method: Option<i32>,
    /// 兼容前端配送类型字段名
    #[serde(default, alias = "deliveryType")]
    pub delivery_type: Option<i32>,
    /// 自提点ID（自提时有效）
    #[serde(default)]
    pub pickup_id: Option<i32>,
    /// 自提联系人姓名
    #[serde(default)]
    pub pickup_contact_name: Option<String>,
    /// 自提联系人手机号
    #[serde(default)]
    pub pickup_contact_mobile: Option<String>,
    /// 使用优惠券ID
    pub coupon_id: Option<i32>,
    /// 使用积分（前端结算表单字段名为 `usePoint`）
    #[serde(default, alias = "usePoint")]
    pub use_points: Option<i32>,
    /// 买家备注
    pub buyer_note: Option<String>,
    /// 支付方式：对应 pay_type_id
    pub pay_type_id: Option<i32>,
    /// 使用余额金额（0/缺省 = 不使用；`true` 兼容旧前端 = 尽可能全额抵扣）
    #[serde(default, deserialize_with = "de_use_balance")]
    pub use_balance: Option<Decimal>,
    /// 前端结算表单里的用户优惠券 ID 列表（`useCouponIds`）
    #[serde(default)]
    pub use_coupon_ids: Option<Vec<i32>>,
    /// 随单发票申请信息
    #[serde(default)]
    pub invoice_data: Option<InvoiceDataDTO>,
    /// 订单来源（如 "web", "代客下单" 等）
    #[serde(default)]
    pub order_source: Option<String>,
    /// POS/代客下单后台管理员ID
    #[serde(default)]
    pub pos_user_id: Option<i32>,
}

/// 兼容前端三种 `useBalance` 入参：数字（余额抵扣金额）、布尔、字符串数字。
fn de_use_balance<'de, D>(deserializer: D) -> std::result::Result<Option<Decimal>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::Deserialize;
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    let Some(value) = value else {
        return Ok(None);
    };
    match value {
        serde_json::Value::Null => Ok(None),
        serde_json::Value::Bool(true) => Ok(Some(Decimal::MAX)),
        serde_json::Value::Bool(false) => Ok(None),
        serde_json::Value::Number(n) => Ok(n.to_string().parse::<Decimal>().ok()),
        serde_json::Value::String(s) => Ok(s.trim().parse::<Decimal>().ok()),
        _ => Ok(None),
    }
}

impl Default for OrderCreateDTO {
    fn default() -> Self {
        Self {
            cart_ids: Vec::new(),
            address_id: None,
            shipping_method: Some(1),
            delivery_type: None,
            pickup_id: None,
            pickup_contact_name: None,
            pickup_contact_mobile: None,
            coupon_id: None,
            use_points: None,
            buyer_note: None,
            pay_type_id: None,
            use_balance: None,
            use_coupon_ids: None,
            invoice_data: None,
            order_source: None,
            pos_user_id: None,
        }
    }
}

/// 创建订单结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderCreateVO {
    pub order_id: i32,
    pub order_sn: String,
    /// 应付总额
    pub total_amount: Decimal,
    /// 需在线支付金额
    pub online_amount: Decimal,
    /// 支付流水号（预支付用）
    pub out_trade_no: String,
    /// 1=需继续支付（跳支付页）；2=无需支付（余额已全额抵扣，前端直接跳订单列表）
    #[serde(default = "default_return_type")]
    pub return_type: i32,
    /// 拼团记录 ID（下单成功时回填）
    #[serde(default)]
    pub groupon_promotion_record_id: Option<i32>,
    /// 余额支付的金额
    #[serde(default)]
    pub balance: Option<Decimal>,
    /// 是否为次卡兑换的 0 元子订单
    #[serde(default)]
    pub is_card_redeem: Option<bool>,
}

fn default_return_type() -> i32 {
    1
}

/// 订单列表项 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderVO {
    pub order_id: i32,
    pub order_sn: String,
    pub shop_id: i32,
    pub order_status: i32,
    /// 原版前端订单卡读取 `orderStatusName`（不能只给 statusLabel）
    pub order_status_name: String,
    pub status_label: String,
    pub pay_status: i32,
    pub shipping_status: i32,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
    pub consignee: String,
    pub mobile: String,
    pub add_time: String,
    pub item_count: i32,
    /// 订单商品明细（前端订单卡需要渲染 items）
    pub items: Vec<serde_json::Value>,
    /// 订单可操作项（前端直接访问 availableActions.toPay 等）
    pub available_actions: serde_json::Value,
    pub cancel_remark: Option<String>,
    pub order_type: Option<i32>,
    pub parent_order_sn: Option<String>,
    pub is_card_order: bool,
    /// 周期购标记（旧前端读 `Number(isCycleOrder) !== 1`，必须下发数字 0/1 而非布尔）
    pub is_cycle_order: i32,
    pub is_pickup: bool,
    pub presale_info: Option<serde_json::Value>,
    pub order_source: Option<String>,
    pub cycle_card_info: Option<serde_json::Value>,
    /// 发票申请数据（发票列表页读取 `invoiceData`）
    pub invoice_data: Option<serde_json::Value>,
    /// 订单状态提示文案（Java `orderStatusTip`，PC 订单详情无倒计时时展示）
    pub order_status_tip: String,
    /// 订单支付时间（未支付为 null）
    pub pay_time: Option<String>,
    /// 订单发货时间（未发货为 null）
    pub shipping_time: Option<String>,
    /// 订单收货时间（未收货为 null）
    pub received_time: Option<String>,
    /// 买家备注（PC 订单详情展示）
    pub buyer_note: String,
    /// 线上支付金额（PC 订单金额明细）
    pub online_paid_amount: Decimal,
    /// 线下支付金额（PC 订单金额明细）
    pub offline_paid_amount: Decimal,
    /// 账期支付金额（PC 订单金额明细）
    pub credit_amount: Decimal,
    /// 发票费用
    pub invoice_fee: Decimal,
    pub balance: Decimal,
    pub shipping_fee: Decimal,
    // ————— 详情页需要的扩展字段 —————
    pub pay_status_name: String,
    pub shipping_status_name: String,
    pub pay_end_time: Option<String>,
    pub shipping_type_name: String,
    pub tracking_no: String,
    pub logistics_name: String,
    pub user_address: String,
    pub pay_type_id: i32,
    pub product_amount: Decimal,
    pub coupon_amount: Decimal,
    pub points_amount: Decimal,
    pub discount_amount: Decimal,
    pub service_fee: Decimal,
    pub unpaid_amount: Decimal,
    pub is_presale: bool,
    pub auto_delivery_days: Option<i32>,
    pub join_status: Option<i32>,
    pub join_status_desc: Option<String>,
    pub after_sales_ing: bool,
    pub pickup_detail: Option<serde_json::Value>,
    pub delivery_order_info: Option<serde_json::Value>,
    pub order_reservation: Option<serde_json::Value>,
    pub is_reservation_home: bool,
    pub shop: Option<serde_json::Value>,
}
