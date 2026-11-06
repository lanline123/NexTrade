//! 代客下单配送方式域（trade::proxy_shopping_delivery）DTO / 纯函数。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingDeliveryController`
//! （`/adminapi/proxyShopping/delivery`，2 个端点）。
//!
//! 两个端点都依赖未迁移的计算引擎：
//! - `getDeliveryOptions`：`productService.getDeliveryOption`（O2O 同城配送距离/门店自提）
//! - `getStoreShippingType`：`orderCheckService.getStoreShippingType`（运费模板/区域校验）
//!
//! 本域保留端点与 Java 校验后返回明确「未迁移」业务错误，不编造配送数据。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// `请选择用户`（i18n `error.user.select.required`）
pub const MSG_USER_REQUIRED: &str = "请选择用户";
/// 代客下单配送方式未迁移。
pub const MSG_DELIVERY_NOT_MIGRATED: &str =
    "代客下单配送方式（同城配送/门店自提距离计算）依赖 O2O 配送引擎，当前 Rust 侧尚未迁移，本接口暂不可用";
/// 店铺配送方式未迁移。
pub const MSG_STORE_SHIPPING_NOT_MIGRATED: &str =
    "获取店铺配送方式依赖购物车价格计算与运费模板引擎，当前 Rust 侧尚未迁移，本接口暂不可用";
/// 代客下单购物车类型（Java `CartTypeEnum.TYPE_ADMIN_SHOPPING`）。
pub const CART_TYPE_ADMIN_SHOPPING: i32 = 15;

/// 配送选项查询（Java `@RequestParam latitude/longitude/userId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DeliveryOptionsQuery {
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    /// @RequestParam userId（必填）
    pub user_id: Option<i32>,
}

/// 店铺配送方式查询（Java `StoreShippingTypeQuery`，代客下单场景）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProxyStoreShippingTypeQuery {
    pub address_id: Option<i32>,
    pub flow_type: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_id: Option<i32>,
    pub pay_type_id: Option<i32>,
    pub use_point: Option<i32>,
    pub use_balance: Option<Decimal>,
    pub use_coupon_ids: Option<Vec<i32>>,
    pub exclude_quick_product: Option<bool>,
}

/// 配送选项返回（Java `DeliveryOptionVO`；未迁移时不构造数据，仅对齐类型）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DeliveryOptionVO {
    pub delivery_type: Option<i32>,
    pub delivery_products: Vec<serde_json::Value>,
    pub pickup_products: Vec<serde_json::Value>,
    pub shop_delivery_data: Vec<serde_json::Value>,
    pub shop_delivery_products: Vec<serde_json::Value>,
}

/// 配送方式（Java `OrderCheckVO.ShippingType` 常用字段）。
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
}

/// 校验用户 id（Java `error.user.select.required`）。
#[must_use]
pub fn validate_user_id(user_id: Option<i32>) -> Result<i32, String> {
    user_id
        .filter(|id| *id > 0)
        .ok_or_else(|| MSG_USER_REQUIRED.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_validation_matches_java() {
        assert_eq!(validate_user_id(None).unwrap_err(), MSG_USER_REQUIRED);
        assert_eq!(validate_user_id(Some(0)).unwrap_err(), MSG_USER_REQUIRED);
        assert_eq!(validate_user_id(Some(7)).unwrap(), 7);
    }

    #[test]
    fn not_migrated_messages_are_explicit() {
        assert!(MSG_DELIVERY_NOT_MIGRATED.contains("尚未迁移"));
        assert!(MSG_STORE_SHIPPING_NOT_MIGRATED.contains("尚未迁移"));
        assert_eq!(CART_TYPE_ADMIN_SHOPPING, 15);
    }

    #[test]
    fn queries_accept_java_names() {
        let q: DeliveryOptionsQuery =
            serde_json::from_str(r#"{"latitude":30.1,"longitude":120.2,"userId":3}"#).unwrap();
        assert_eq!(q.user_id, Some(3));
        assert!(q.latitude.is_some());
        let q: ProxyStoreShippingTypeQuery =
            serde_json::from_str(r#"{"userId":3,"shopId":1,"flowType":15}"#).unwrap();
        assert_eq!(q.flow_type, Some(15));
    }
}
