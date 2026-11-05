//! 前台用户订单域（trade::user_order）DTO / VO / 纯函数。
//!
//! 对应原 Java `com.tigshop.api.controller.user.UserOrderController`
//! （`@RequestMapping("/api/user/order")`，本域负责 6 个端点：
//! `orderNum` / `reasonConfig` / `delOrder` / `confirmReceipt` / `shippingInfo` / `buyAgain`；
//! `list` / `detail` / `cancelOrder` 已有基线实现）。
//!
//! # 口径说明
//!
//! - 契约 auth = optional（Java `permitAll` + JWT 过滤器）：合法令牌 → 会员上下文；
//!   无令牌 → 游客。但订单相关接口在 Java 内部都调用 `getCurrentUserId()`，
//!   游客实际无法完成业务，故本实现要求登录（游客 → 401「请先登录」）。
//! - `orderNum` 统计口径：`is_del = 0`，按 `order_status` / `comment_status` 分列计数；
//!   售后中计数取 `aftersales.status IN (1,2,3,4,5,21,22)`（Java `inProgressStatus`）。
//! - 时间字段 i32 秒；金额 `rust_decimal::Decimal`。
//! - `reasonConfig` 读取 config 表 `afterSalesReasonEnabled` / `afterSalesReasonList`
//!   （JSON 数组），并保留 Java 默认值作为兜底；i18n 翻译未迁移（原样返回）。

use crate::models::trade::check::tolerant_opt_i32;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（文案逐字对齐 Java）
// ——————————————————————————————————————————————

/// `订单状态错误`
pub const MSG_ORDER_STATUS_ERROR: &str = "订单状态错误";
/// `订单不存在`
pub const MSG_ORDER_NOT_EXIST: &str = "订单不存在";
/// `请先登录`
pub const MSG_LOGIN_REQUIRED: &str = "请先登录";
/// 物流查询未迁移（物流平台对接/快递100/快递鸟等）。
pub const MSG_LOGISTICS_NOT_MIGRATED: &str =
    "物流查询依赖第三方物流平台对接（快递100/快递鸟等），当前 Rust 侧尚未迁移，本接口暂不可用";

/// 订单状态：待支付（Java `OrderStatusEnum.PENDING`）。
pub const ORDER_STATUS_PENDING: i32 = 0;
/// 订单状态：已确认待发货（Java `CONFIRMED`）。
pub const ORDER_STATUS_CONFIRMED: i32 = 1;
/// 订单状态：处理中/已发货（Java `PROCESSING`）。
pub const ORDER_STATUS_PROCESSING: i32 = 2;
/// 订单状态：已取消（Java `CANCELLED`）。
pub const ORDER_STATUS_CANCELLED: i32 = 3;
/// 订单状态：无效（Java `INVALID`）。
pub const ORDER_STATUS_INVALID: i32 = 4;
/// 订单状态：已完成（Java `COMPLETED`）。
pub const ORDER_STATUS_COMPLETED: i32 = 5;
/// 配送状态：已收货（Java `ShippingStatusEnum.SHIPPED`）。
pub const SHIPPING_STATUS_SHIPPED: i32 = 2;
/// 评价状态：待评价（Java `CommentStatus.PENDING`）。
pub const COMMENT_STATUS_PENDING: i32 = 0;
/// 订单类型：预约上门（Java `OrderType.RESERVATION_HOME`）。
pub const ORDER_TYPE_RESERVATION_HOME: i32 = 10;

/// 售后进行中状态集合（Java `AftersalesStatusEnum.inProgressStatus`）：
/// 1 审核处理中 / 2 审核通过 / 3 审核未通过 / 4 待回寄 / 5 待商家收货 / 21 待供应商审核 / 22 待供应商收货。
pub const AFTERSALES_IN_PROGRESS: [i32; 7] = [1, 2, 3, 4, 5, 21, 22];

/// 配置键：售后/取消原因开关（Java `SettingsEnum.AFTER_SALES_REASON_ENABLED`）。
pub const CONFIG_REASON_ENABLED: &str = "afterSalesReasonEnabled";
/// 配置键：售后/取消原因列表（Java `SettingsEnum.AFTER_SALES_REASON_LIST`）。
pub const CONFIG_REASON_LIST: &str = "afterSalesReasonList";
/// Java 默认原因列表（枚举 defaultValue 反序列化后的 5 项，逐字一致）。
pub const DEFAULT_REASON_LIST: [&str; 5] = [
    "多拍/拍错/不喜欢",
    "未按约定时间发货",
    "协商一致退款",
    "地址/电话填错了",
    "其他",
];
/// 默认开关：开启（Java 枚举 defaultValue `"1"`）。
pub const DEFAULT_REASON_ENABLED: i32 = 1;

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 解析 config 表中的原因列表 JSON（字符串数组）；解析失败返回默认列表。
#[must_use]
pub fn parse_reason_list(raw: Option<&str>) -> Vec<String> {
    let Some(raw) = raw else {
        return DEFAULT_REASON_LIST
            .iter()
            .map(|item| (*item).to_string())
            .collect();
    };
    match serde_json::from_str::<Vec<String>>(raw.trim()) {
        Ok(list) if !list.is_empty() => list,
        _ => DEFAULT_REASON_LIST
            .iter()
            .map(|item| (*item).to_string())
            .collect(),
    }
}

/// 解析原因开关：非 0/1/缺失 → 默认开启。
#[must_use]
pub fn parse_reason_enabled(raw: Option<&str>) -> i32 {
    match raw.and_then(|value| value.trim().parse::<i32>().ok()) {
        Some(0) => 0,
        Some(1) => 1,
        _ => DEFAULT_REASON_ENABLED,
    }
}

/// 是否允许删除订单（Java `availableActions.delOrder`：已取消/无效/已完成且未删除）。
#[must_use]
pub fn can_delete_order(order_status: i32, is_del: i32) -> bool {
    is_del == 0
        && matches!(
            order_status,
            ORDER_STATUS_CANCELLED | ORDER_STATUS_INVALID | ORDER_STATUS_COMPLETED
        )
}

/// 是否允许确认收货（Java `availableActions.confirmReceipt`：处理中/已发货）。
#[must_use]
pub fn can_confirm_receipt(order_status: i32, is_del: i32) -> bool {
    is_del == 0 && order_status == ORDER_STATUS_PROCESSING
}

/// 商品类型 → 购物车类型（Java `CartTypeEnum` 映射，用于 `buyAgain` 加购）。
///
/// 1 普通→1；2 虚拟→6；3 卡密→8；9 预约到店→9；10 预约上门→10；11 礼品卡→11；
/// 其它 → 1 普通。
#[must_use]
pub fn cart_type_from_product_type(product_type: Option<i32>) -> i32 {
    match product_type.unwrap_or(1) {
        2 => 6,
        3 => 8,
        9 => 9,
        10 => 10,
        11 => 11,
        _ => 1,
    }
}

// ——————————————————————————————————————————————
// 入参 / 出参
// ——————————————————————————————————————————————

/// orderId 入参（Java `OrderIdDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderIdDTO {
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub id: Option<i32>,
    pub description: Option<String>,
}

/// 订单数量（Java `OrderNumVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderNumVO {
    /// 待付款数量
    pub await_pay: i64,
    /// 待发货数量
    pub await_shipping: i64,
    /// 待收货数量
    pub await_received: i64,
    /// 待评价数量
    pub await_comment: i64,
    /// 订单完成数量
    pub order_completed: i64,
    /// 产品收藏数量
    pub product_collect: i64,
    /// 店铺收藏数量
    pub shop_collect: i64,
    /// 售后中订单数
    pub await_aftersales_collect: i64,
}

/// 买家售后与取消订单共用原因配置（Java `Map<String,Object>`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReasonConfigVO {
    pub after_sales_reason_enabled: i32,
    pub after_sales_reason_list: Vec<String>,
}

/// 物流信息（Java `ShippingResult`，字段名保持 Java JSON 命名）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingResult {
    #[serde(rename = "eBusinessID")]
    pub e_business_id: Option<String>,
    pub shipper_code: Option<String>,
    /// 配送方式 code
    pub logistic_code: Option<String>,
    pub state: Option<String>,
    pub state_ex: Option<String>,
    /// 定位地址
    pub location: Option<String>,
    pub traces: Vec<ShippingTraceVO>,
    pub success: Option<String>,
}

/// 物流轨迹节点（Java `ShippingResult.TraceVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTraceVO {
    pub action: Option<String>,
    pub accept_time: Option<String>,
    pub accept_station: Option<String>,
    pub location: Option<String>,
}

/// 订单轻量行（仓储查询结果，供服务层判断）。
#[derive(Debug, Clone, Default)]
pub struct OrderBrief {
    pub order_id: i32,
    pub order_sn: String,
    pub order_status: i32,
    pub shipping_status: i32,
    pub comment_status: i32,
    pub order_type: Option<i32>,
    pub shop_id: i32,
    pub tracking_no: String,
    pub logistics_id: i32,
    pub is_del: i32,
}

/// 订单商品行（`buyAgain` 加购用）。
#[derive(Debug, Clone, Default)]
pub struct OrderItemSeed {
    pub product_id: i32,
    pub sku_id: i32,
    pub quantity: i32,
    pub price: Decimal,
    pub product_sn: String,
    pub pic_thumb: String,
    pub sku_data: String,
    pub product_type: i32,
    pub shop_id: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reason_config_parse_matches_java() {
        assert_eq!(
            parse_reason_list(Some(r#"["多拍/拍错/不喜欢","未按约定时间发货"]"#)),
            vec![
                "多拍/拍错/不喜欢".to_string(),
                "未按约定时间发货".to_string()
            ]
        );
        // 非法/空 → Java 默认 5 项
        assert_eq!(
            parse_reason_list(Some("not-json")),
            DEFAULT_REASON_LIST.map(str::to_string).to_vec()
        );
        assert_eq!(parse_reason_list(Some("[]")).len(), 5);
        assert_eq!(parse_reason_list(None).len(), 5);
        assert_eq!(parse_reason_list(None)[0], "多拍/拍错/不喜欢");
        assert_eq!(parse_reason_enabled(Some("0")), 0);
        assert_eq!(parse_reason_enabled(Some("1")), 1);
        assert_eq!(parse_reason_enabled(Some("bad")), 1);
        assert_eq!(parse_reason_enabled(None), 1);
    }

    #[test]
    fn order_action_guards_match_java_actions() {
        assert!(can_delete_order(ORDER_STATUS_CANCELLED, 0));
        assert!(can_delete_order(ORDER_STATUS_INVALID, 0));
        assert!(can_delete_order(ORDER_STATUS_COMPLETED, 0));
        assert!(!can_delete_order(ORDER_STATUS_PENDING, 0));
        assert!(!can_delete_order(ORDER_STATUS_COMPLETED, 1));
        assert!(can_confirm_receipt(ORDER_STATUS_PROCESSING, 0));
        assert!(!can_confirm_receipt(ORDER_STATUS_CONFIRMED, 0));
        assert!(!can_confirm_receipt(ORDER_STATUS_PROCESSING, 1));
    }

    #[test]
    fn cart_type_mapping_and_aftersales_codes() {
        assert_eq!(cart_type_from_product_type(Some(1)), 1);
        assert_eq!(cart_type_from_product_type(Some(2)), 6);
        assert_eq!(cart_type_from_product_type(Some(3)), 8);
        assert_eq!(cart_type_from_product_type(Some(10)), 10);
        assert_eq!(cart_type_from_product_type(None), 1);
        assert_eq!(AFTERSALES_IN_PROGRESS, [1, 2, 3, 4, 5, 21, 22]);
    }

    #[test]
    fn vo_serializes_camel_case_and_shipping_names() {
        let vo = OrderNumVO {
            await_pay: 1,
            await_shipping: 2,
            await_received: 3,
            await_comment: 4,
            order_completed: 5,
            product_collect: 6,
            shop_collect: 7,
            await_aftersales_collect: 8,
        };
        let value = serde_json::to_value(&vo).unwrap();
        assert_eq!(value["awaitPay"], 1);
        assert_eq!(value["awaitAftersalesCollect"], 8);
        assert_eq!(value["orderCompleted"], 5);

        let shipping = ShippingResult {
            e_business_id: Some("EB".into()),
            traces: vec![ShippingTraceVO {
                action: Some("签收".into()),
                ..Default::default()
            }],
            ..Default::default()
        };
        let value = serde_json::to_value(&shipping).unwrap();
        assert_eq!(value["eBusinessID"], "EB");
        assert_eq!(value["traces"][0]["action"], "签收");

        let config = ReasonConfigVO {
            after_sales_reason_enabled: 1,
            after_sales_reason_list: parse_reason_list(None),
        };
        let value = serde_json::to_value(&config).unwrap();
        assert_eq!(value["afterSalesReasonEnabled"], 1);
        assert_eq!(value["afterSalesReasonList"][0], "多拍/拍错/不喜欢");
    }

    #[test]
    fn order_id_dto_accepts_java_names() {
        let dto: OrderIdDTO =
            serde_json::from_str(r#"{"id":12,"description":"不想要了"}"#).unwrap();
        assert_eq!(dto.id, Some(12));
        assert_eq!(dto.description.as_deref(), Some("不想要了"));
        let dto: OrderIdDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.id, None);
    }
}

#[cfg(test)]
mod tolerant_order_id_tests {
    use super::*;

    /// H5 取消订单契约 `OrderIdDTO{id, description}`(Java OrderIdDTO 同名);
    /// 详情页入口的 id 可能是 URL 字符串,须容忍(Jackson 同款)。
    #[test]
    fn cancel_order_dto_accepts_string_id() {
        let dto: OrderIdDTO =
            serde_json::from_str(r#"{"id":"29","description":"不想要了"}"#).expect("string id ok");
        assert_eq!(dto.id, Some(29));
        assert_eq!(dto.description.as_deref(), Some("不想要了"));
        let dto: OrderIdDTO = serde_json::from_str(r#"{"id":29}"#).expect("numeric id ok");
        assert_eq!(dto.id, Some(29));
    }
}
