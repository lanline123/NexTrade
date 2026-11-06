//! 购物车数量/优惠券试算域服务（trade::cart_summary）。
//!
//! - `get_count`：完整 DB 实现（`SUM(quantity)`，排除代客下单购物车）。
//! - `get_coupon_discount`：保留端点与 Java `@NotNull` 校验后返回明确「未迁移」业务错误
//!   （优惠券/促销计算引擎未迁移），不编造金额。

use std::sync::Arc;

use rust_decimal::Decimal;
use tigshop_core::models::trade::cart_summary::{
    validate_coupon_id, CartCouponDiscountVO,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::trade::cart_summary::CartSummaryRepository;
use tigshop_infrastructure::db::Repositories;

/// 购物车汇总服务。
pub struct CartSummaryService {
    repos: Arc<Repositories>,
}

impl CartSummaryService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.trade.cart_summary`）。
    #[must_use]
    pub fn repo(&self) -> &CartSummaryRepository {
        &self.repos.trade.cart_summary
    }

    /// 购物车数量（Java `getCount`）。
    pub async fn get_count(&self, user_id: i32, shop_id: Option<i32>) -> Result<i32> {
        let total = self.repo().sum_quantity(user_id, shop_id).await?;
        Ok(i32::try_from(total).unwrap_or(i32::MAX))
    }

    /// 优惠券试算（Java `CartServiceImpl#getCouponDiscount`）。
    pub async fn get_coupon_discount(
        &self,
        user_id: i32,
        coupon_id: Option<i32>,
    ) -> Result<CartCouponDiscountVO> {
        let coupon_id = validate_coupon_id(coupon_id).map_err(Error::Validation)?;
        let coupon = self
            .repos
            .marketing
            .coupon
            .find_by_id(coupon_id)
            .await?
            .ok_or_else(|| Error::NotFound("优惠券不存在".into()))?;

        let carts = self.repos.trade.cart.find_by_user(user_id, None).await?;
        let checked_carts: Vec<_> = carts.into_iter().filter(|c| c.is_checked()).collect();

        let send_range_data: Vec<i32> = serde_json::from_str(&coupon.send_range_data)
            .unwrap_or_default();

        let mut quantity_count = 0;
        let mut checked_product_price_sum = Decimal::ZERO;

        for cart in &checked_carts {
            let prod = self.repos.catalog.product.find_by_id(cart.product_id).await?;
            let category_id = prod.as_ref().map(|p| p.category_id).unwrap_or(0);
            let brand_id = prod.as_ref().map(|p| p.brand_id).unwrap_or(0);

            let matches = match coupon.send_range {
                1 => send_range_data.contains(&category_id),
                2 => send_range_data.contains(&brand_id),
                3 => send_range_data.contains(&cart.product_id),
                4 => !send_range_data.contains(&cart.product_id),
                _ => true,
            };

            if !matches {
                continue;
            }

            quantity_count += cart.quantity;
            let price = if cart.original_price > Decimal::ZERO {
                cart.original_price
            } else {
                cart.market_price.unwrap_or_default()
            };
            checked_product_price_sum += price * Decimal::from(cart.quantity);
        }

        let discount_money = if coupon.coupon_type == 1 {
            coupon.coupon_money
        } else {
            let discount = coupon.coupon_discount / Decimal::from(10);
            let discount_rate = Decimal::ONE - discount;
            (checked_product_price_sum * discount_rate).round_dp(2)
        };

        let min_order_amount = if coupon.reduce_type == 2 {
            Decimal::ZERO
        } else {
            coupon.min_order_amount
        };

        Ok(CartCouponDiscountVO {
            min_order_amount: Some(min_order_amount),
            coupon_money: Some(coupon.coupon_money),
            coupon_unit: Some(coupon.coupon_unit),
            product_price: Some(checked_product_price_sum),
            quantity_count: Some(quantity_count),
            discount_money: Some(discount_money),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coupon_id_validation_check() {
        assert!(validate_coupon_id(None).is_err());
        assert_eq!(validate_coupon_id(Some(5)).unwrap(), 5);
    }
}
