//! 代客下单配送方式域仓储（trade::proxy_shopping_delivery）。
//!
//! 表：`cart`；查询使用运行时 `sqlx::query_as`。配送计算本身未迁移，
//! 仓储仅提供购物车存在性/数量校验。

use rust_decimal::Decimal;
use sqlx::MySqlPool;

use tigshop_core::models::trade::proxy_shopping_delivery::CART_TYPE_ADMIN_SHOPPING;
use tigshop_core::{Error, Result};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CartProductItem {
    pub product_id: i32,
    pub shop_id: i32,
    pub quantity: i32,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ProductDeliveryAttr {
    pub product_id: i32,
    pub product_name: String,
    pub pic_thumb: Option<String>,
    pub product_type: i32,
    pub is_shop_pickup: i32,
    pub is_logistics: i32,
    pub no_shipping: i32,
    pub is_shop_delivery: i32,
}

/// 代客下单配送方式仓储。
#[derive(Clone)]
pub struct ProxyShoppingDeliveryRepository {
    pool: MySqlPool,
}

impl ProxyShoppingDeliveryRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 代客下单购物车商品数量（校验用户是否有可配送商品）。
    pub async fn sum_cart_quantity(&self, user_id: i32, shop_id: Option<i32>) -> Result<i64> {
        let row: Option<(Option<Decimal>,)> = sqlx::query_as(
            "SELECT SUM(quantity) FROM cart
             WHERE user_id = ? AND type = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(user_id)
        .bind(CART_TYPE_ADMIN_SHOPPING)
        .bind(shop_id)
        .bind(shop_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row
            .and_then(|(sum,)| sum)
            .map(|sum| i64::try_from(sum).unwrap_or(0))
            .unwrap_or(0))
    }

    /// 查询代客下单购物车项
    pub async fn find_cart_items(
        &self,
        user_id: i32,
        shop_id: Option<i32>,
    ) -> Result<Vec<CartProductItem>> {
        sqlx::query_as(
            "SELECT product_id, shop_id, quantity FROM cart
             WHERE user_id = ? AND type = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(user_id)
        .bind(CART_TYPE_ADMIN_SHOPPING)
        .bind(shop_id)
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 批量查询商品配送属性
    pub async fn find_products_delivery_attr(
        &self,
        product_ids: &[i32],
    ) -> Result<Vec<ProductDeliveryAttr>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = product_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT product_id, product_name, pic_thumb, product_type, is_shop_pickup, is_logistics, no_shipping, is_shop_delivery FROM product WHERE product_id IN ({placeholders})"
        );
        let mut query = sqlx::query_as::<_, ProductDeliveryAttr>(&sql);
        for id in product_ids {
            query = query.bind(id);
        }
        query.fetch_all(&self.pool).await.map_err(map_err)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repository_type_exists() {
        assert!(std::any::type_name::<ProxyShoppingDeliveryRepository>()
            .contains("ProxyShoppingDelivery"));
    }
}

