//! 代客下单订单结算域（trade::proxy_shopping_order_check）DTO / VO / 查询参数。
//!
//! 对应原 Java（`tigshop-adminapi` 的 `ProxyShoppingOrderCheckController`，
//! `@RequestMapping("/adminapi/proxyShopping/order/check")`）：
//! - `com.tigshop.bean.param.order.OrderCheckParam`（+ 父类
//!   `com.tigshop.bean.param.o2o.BaseChangePriceParam`）— 结算入参
//! - `com.tigshop.bean.query.shop.PickupPageQuery`（+ 父类 `BasePage`）— 自提点分页查询
//! - `com.tigshop.bean.vo.order.OrderCheckVO` — 结算页出参（**未迁移**，见下）
//! - `com.tigshop.bean.vo.o2o.PickupListVO` — 自提点出参
//! - `com.tigshop.bean.vo.order.OrderSubmitVO` — 下单结果（**未迁移**，见下）
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! # 为什么 `OrderCheckVO` / `OrderSubmitVO` 没有在这里定义
//!
//! `OrderCheckVO` 是「结算页」的完整契约（370 行、20+ 嵌套类：购物车行、
//! 促销、优惠券、运费模板、积分/余额/账期/礼品卡、抹零、改价…），由
//! `OrderCheckServiceImpl#getOrderCheckData`（Java 约 385 行，累计调用 40+ 未迁移
//! 服务）填充；`OrderSubmitVO` 由 `#submit`（Java 约 2000 行）填充。
//! 本切片**不伪造**这两个 VO：相关 handler 走
//! [`crate::Error::biz`] 的「未迁移」明确错误，详见 `services::proxy_shopping_order_check` 模块头。
//! 因此本文件只声明「已迁移且真实使用」的类型。
//!
//! # 字段可空性说明
//!
//! Java `OrderCheckParam` 的字段均为包装类型（可为 `null`），且同一个 `param`
//! 实例在控制器里被**逐步赋值**（`indexInitParam` → `setSelectFrom` → …），
//! 部分字段在赋值前被读取。故本文件一律用 `Option<T>` 还原，不做「缺省即 0」
//! 的静默归一化 —— 否则会改变 Java 的判定分支（例如
//! `Boolean.FALSE.equals(param.getEnableChangePrice())` 对 `null` 为 `false`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ————————————————————— 结算入参 —————————————————————

/// 结算操作入参（Java `OrderCheckParam extends BaseChangePriceParam`）。
///
/// 字段顺序与注释均按 Java 声明整理，仅保留本切片实际会读写的字段 +
/// 原样透传字段（透传字段在服务层未迁移时会原样保留，便于将来接上
/// `getOrderCheckData` 时无需再改 DTO）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderCheckParam {
    // —— Java `BaseChangePriceParam` 部分 ——
    /// 是否是从购物车列表的数据进行改价（DB 中的数据）
    pub is_cart_list: Option<bool>,
    /// 只是改价（不进行存储）
    pub only_show: Option<bool>,
    /// 是否改价（购物车商品对应改价 / 总体改价）
    pub use_change_price: Option<bool>,
    /// 购物车改价列表（要和购物车进行对比）
    pub cart_change_prices: Option<Vec<CartChangePrice>>,
    /// 整体改价之前的原价
    pub original_price: Option<Decimal>,
    /// 改价的值（一口价就是价格，折扣就是折扣值 0-100，减少的值）
    pub change_price_value: Option<Decimal>,
    /// 总体改价类型（1 一口价 2 折扣 3 减少）
    pub total_change_price_type: Option<i32>,
    /// 抹分金额
    pub round_off_cents: Option<bool>,
    /// 抹角金额
    pub round_off_dime: Option<bool>,
    /// 现金金额
    pub cash_amount: Option<Decimal>,
    /// 现金找零金额
    pub cash_change_amount: Option<Decimal>,

    // —— Java `OrderCheckParam` 自有部分 ——
    /// 抽奖记录 id
    pub lottery_record_id: Option<i32>,
    /// 定金金额
    pub deposit_amount: Option<Decimal>,
    /// 用户 id（收银台 / 代客下单必填，控制器校验 > 0）
    pub user_id: Option<i32>,
    /// 预约人
    pub reservation_name: Option<String>,
    /// 预约手机
    pub reservation_mobile: Option<String>,
    /// 是否启用改价（false = 不启用；不传或 true = 启用）
    pub enable_change_price: Option<bool>,
    /// 配送方式（1 物流配送，2 自提，3 同城配送）
    pub delivery_type: Option<i32>,
    /// 地址 ID
    pub address_id: Option<i32>,
    /// 配送方式明细（键为店铺 ID）
    pub shipping_type: Option<HashMap<i32, ShippingType>>,
    /// 支付方式 ID
    pub pay_type_id: Option<i32>,
    /// 是否使用积分
    pub use_point: Option<i32>,
    /// 是否使用余额
    pub use_balance: Option<Decimal>,
    /// 是否使用账期支付：0 不使用，1 使用
    pub use_credit: Option<i32>,
    /// 是否使用礼品卡
    pub use_gift_card: Option<Decimal>,
    /// 使用的优惠券 ID 列表
    pub use_coupon_ids: Option<Vec<i32>>,
    /// 备注
    pub buyer_note: Option<String>,
    /// 发票
    pub invoice_data: Option<InvoiceData>,
    /// 流程类型（`CartTypeEnum`，本控制器恒置 15 = 代客下单）
    pub flow_type: Option<i32>,
    /// 是否使用默认优惠券
    pub use_default_coupon_ids: Option<i32>,
    /// 选择的用户优惠券 ID 列表
    pub select_user_coupon_ids: Option<Vec<i32>>,
    /// 附加属性
    pub product_extra: Option<HashMap<String, String>>,
    /// 区域
    pub region_ids: Option<Vec<i32>>,
    /// 从哪个页面跳转（`SelectFromEnum`：1 首次加载 / 2 结算页 / 3 更新优惠券 / 4 提交）
    pub select_from: Option<i32>,
    /// 门店 id
    pub shop_id: Option<i32>,
    /// 产品预约时间 ID
    pub product_reservation_time_id: Option<i32>,
    /// 预约日期
    pub reservation_date: Option<String>,
    /// 经度
    pub longitude: Option<Decimal>,
    /// 纬度
    pub latitude: Option<Decimal>,
    /// 后台管理员 id（下单时写入 `posUserId`）
    pub pos_user_id: Option<i32>,
    /// 订单来源（代客下单固定「代客下单」）
    pub order_source: Option<String>,
    /// 自提点 ID
    pub pickup_id: Option<i32>,
    /// 自提联系人 ID
    pub pickup_contact_id: Option<i32>,
    /// 自提联系人姓名
    pub pickup_contact_name: Option<String>,
    /// 自提联系人手机号
    pub pickup_contact_mobile: Option<String>,
    /// 税率
    pub tax_rate: Option<Decimal>,
}

impl OrderCheckParam {
    /// 对应 Java `OrderCheckParam#indexInitParam()`。
    ///
    /// Java 原文（`OrderCheckParam.java:234-239`）：
    /// ```text
    /// this.selectFrom = SelectFromEnum.FIRST_LOAD.getValue(); // 1
    /// this.useBalance = BigDecimal.ZERO;
    /// this.useGiftCard = BigDecimal.ZERO;
    /// this.usePoint = 0;
    /// ```
    ///
    /// ⚠️ 该方法**不**默认开启任何支付方式，而是把「余额 / 礼品卡 / 积分」
    /// 一律清零（代客下单首次加载不允许默认抵扣）。
    pub fn index_init_param(&mut self) {
        self.select_from = Some(SELECT_FROM_FIRST_LOAD);
        self.use_balance = Some(Decimal::ZERO);
        self.use_gift_card = Some(Decimal::ZERO);
        self.use_point = Some(0);
    }
}

/// `SelectFromEnum.FIRST_LOAD`（Java `SelectFromEnum.java:14`）。
pub const SELECT_FROM_FIRST_LOAD: i32 = 1;

/// `CartTypeEnum.TYPE_ADMIN_SHOPPING`（Java `CartTypeEnum.java:39`）。
///
/// 本控制器 7 个写接口全部把它写入 `flowType`，是「代客下单」的域标识。
pub const CART_TYPE_ADMIN_SHOPPING: i32 = 15;

/// `OrderDeliveryTypeEnum.PICKUP`（Java `OrderDeliveryTypeEnum.java:18`）。
pub const ORDER_DELIVERY_TYPE_PICKUP: i32 = 2;

/// 发票（Java `OrderCheckParam.InvoiceData`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct InvoiceData {
    /// 发票类型
    pub invoice_type: Option<i32>,
    /// 抬头类型
    pub title_type: Option<i32>,
    /// 抬头
    pub title: Option<String>,
    /// 税号
    pub tax_no: Option<String>,
    /// 内容
    pub content: Option<String>,
    /// 电话
    pub tax_phone: Option<String>,
    /// 个人/单位名称
    pub company_name: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
}

/// 配送方式（Java `OrderCheckParam.ShippingType`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingType {
    /// 配送方式 ID
    pub type_id: Option<i32>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 配送方式名称
    pub type_name: Option<String>,
    /// 自提点 id
    pub pickup_id: Option<i32>,
    /// 自提时间
    pub expect_pickup_time: Option<String>,
}

/// 购物车行改价（Java `OrderCheckParam.CartChangePrice`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CartChangePrice {
    /// 购物车 ID
    pub cart_id: Option<i32>,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// 原价（改价前的值：单个商品的价格 × 个数）
    pub original_price: Option<Decimal>,
    /// 改价值（一口价 = 价格；折扣 = 折扣值；减少 = 减少值）
    pub change_price_value: Option<Decimal>,
    /// 改价类型（1 一口价 2 折扣 3 减少）
    pub change_price_type: Option<i32>,
}

// ————————————————————— 自提点查询 / 出参 —————————————————————

/// 自提点分页查询（Java `PickupPageQuery extends BasePage`）。
///
/// 分页字段沿用 Java `BasePage` 语义：`page` 缺省 1，`size` 缺省 15、上限 100。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupPageQuery {
    /// 当前页码
    pub page: Option<u64>,
    /// 分页大小
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`，本地图查询未使用）
    pub sort_field: Option<String>,
    /// 查询参数（按门店详细地址模糊匹配）
    pub keyword: Option<String>,
    /// 显示顺序 `asc` / `desc`（本地图查询未使用）
    pub sort_order: Option<String>,
    /// 地区 ID（按 `shop_region_id` JSON 串模糊匹配）
    pub region_id: Option<String>,
    /// 父门店 ID（映射 `shop.store_parent_id`）
    pub shop_id: Option<i32>,
    /// 经度
    pub longitude: Option<Decimal>,
    /// 纬度
    pub latitude: Option<Decimal>,
}

impl PickupPageQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断为 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }
}

/// 自提点出参（Java `PickupListVO`）。
///
/// ⚠️ Java 侧 `contactJson` / `shopOpenCloseConfigJson` / `shopRegionIdsJson`
/// 三个「原始 JSON 字符串」字段带 `@JsonIgnore`，**不出现在响应体**里；
/// 本结构体因此不声明它们，只保留解析后的三个字段。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickupListVO {
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 店铺标题
    pub shop_title: Option<String>,
    /// 距离，单位 m
    pub distance: Option<Decimal>,
    /// 经度
    pub longitude: Option<Decimal>,
    /// 纬度
    pub latitude: Option<Decimal>,
    /// 联系方式（Java `List<StoreExtendedDto.ShopContactConfig>`，未迁移其类型定义，
    /// 按原始 JSON 透传）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_configs: Option<serde_json::Value>,
    /// 运营时间（同上，按原始 JSON 透传）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shop_open_close_config: Option<serde_json::Value>,
    /// 门店 regionId 列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shop_region_ids: Option<Vec<i32>>,
    /// 门店 regionId 对应的地区名列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shop_region_names: Option<Vec<String>>,
    /// 门店详细地址
    pub address: Option<String>,
}

// ————————————————————— 可用支付方式 —————————————————————

/// 可用支付方式查询（Java `@RequestParam(value = "flowType", required = false)`）。
///
/// ⚠️ `flowType` 是**查询参数**（非 JSON body），前端拼在 URL 上，
/// 故必须 `rename_all = "camelCase"` 才能把它映射到 `flow_type`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AvailablePaymentTypeQuery {
    /// 流程类型（`CartTypeEnum`；12 时只返回礼品卡支付）
    pub flow_type: Option<i32>,
}

/// 支付方式出参（Java `OrderCheckVO.PaymentType`）。
///
/// `typeId` 取 `PaymentType` 枚举 code：1 在线支付 / 2 货到付款 /
/// 3 线下支付 / 4 现金支付。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentTypeVO {
    /// 支付方式 ID
    pub type_id: Option<i32>,
    /// 支付方式名称
    pub type_name: Option<String>,
    /// 是否禁用
    pub disabled: bool,
    /// 禁用原因
    pub disabled_desc: String,
    /// 是否展示（Java 字段名 `isShow`）
    #[serde(rename = "isShow")]
    pub is_show: bool,
}

/// `PaymentType.ONLINE`（Java `PaymentType.java:25`）。
pub const PAYMENT_TYPE_ONLINE: i32 = 1;
/// `PaymentType.OFFLINE`（Java `PaymentType.java:33`）。
pub const PAYMENT_TYPE_OFFLINE: i32 = 3;

/// 礼品卡支付流程标识（Java `CartTypeEnum.TYPE_GIFT_EXCHANGE` 的 code 为 12；
/// `OrderCheckServiceImpl.java:2996` 直接比较字面量 `flowType == 12`）。
pub const FLOW_TYPE_GIFT_CARD: i32 = 12;
