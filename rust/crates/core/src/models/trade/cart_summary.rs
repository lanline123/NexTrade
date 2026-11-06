//! 购物车数量/优惠券试算域（trade::cart_summary）DTO / 纯函数。
//!
//! 对应原 Java `com.tigshop.api.controller.cart.CartController` 中本域负责的 2 个端点：
//! - `GET /api/cart/cart/getCount`（`cartService.getCartCount(shopId, userId)`）
//! - `GET /api/cart/cart/getCouponDiscount`（`getCouponDiscount`，需优惠券计算引擎）
//!
//! `getCouponDiscount` 依赖未迁移的优惠券/促销计算引擎 → 保留端点与 Java 校验后
//! 返回明确「未迁移」业务错误，不编造金额。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// `请先登录`
pub const MSG_LOGIN_REQUIRED: &str = "请先登录";
/// `id不能为空`（Java `ID_CANNOT_IS_NULL`）
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 购物车优惠券试算未迁移。
pub const MSG_COUPON_NOT_MIGRATED: &str =
    "购物车优惠券试算依赖优惠券/促销计算引擎，当前 Rust 侧尚未迁移，本接口暂不可用";

/// 购物车数量查询（Java `@RequestParam shopId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CartCountQuery {
    pub shop_id: Option<i32>,
}

/// 优惠券折扣查询（Java `@RequestParam couponId`，@NotNull）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponDiscountQuery {
    pub coupon_id: Option<i32>,
}

/// 购物车优惠券试算返回（Java `CartCouponDiscountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CartCouponDiscountVO {
    pub min_order_amount: Option<Decimal>,
    pub coupon_money: Option<Decimal>,
    pub coupon_unit: Option<i32>,
    pub product_price: Option<Decimal>,
    pub quantity_count: Option<i32>,
    pub discount_money: Option<Decimal>,
}

/// 校验优惠券 id（Java `@NotNull(message = ID_CANNOT_IS_NULL)`）。
#[must_use]
pub fn validate_coupon_id(coupon_id: Option<i32>) -> Result<i32, String> {
    coupon_id
        .filter(|id| *id > 0)
        .ok_or_else(|| MSG_ID_REQUIRED.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coupon_id_validation_matches_java_annotation() {
        assert_eq!(validate_coupon_id(None).unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(validate_coupon_id(Some(0)).unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(validate_coupon_id(Some(5)).unwrap(), 5);
    }

    #[test]
    fn not_migrated_message_is_explicit() {
        assert!(MSG_COUPON_NOT_MIGRATED.contains("尚未迁移"));
    }

    #[test]
    fn queries_accept_java_names() {
        let q: CartCountQuery = serde_json::from_str(r#"{"shopId":2}"#).unwrap();
        assert_eq!(q.shop_id, Some(2));
        let q: CouponDiscountQuery = serde_json::from_str(r#"{"couponId":9}"#).unwrap();
        assert_eq!(q.coupon_id, Some(9));
    }
}
