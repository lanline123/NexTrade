//! 代客下单购物车域仓储（trade::proxy_shopping_cart）。
//!
//! 涉及表（列名严格对齐 `schema_parser`）：
//! - `cart`（购物车，`type = 15` 代客下单）
//! - `product` / `product_sku`（商品快照与规格校验）
//! - `shop`（门店标题）
//!
//! 查询统一使用运行时 `sqlx::query_as`（**不使用** `query!` 宏）。

use rust_decimal::Decimal;
use sqlx::MySqlPool;

use tigshop_core::models::trade::proxy_shopping_cart::{
    cart_type_from_product_type, CartItemVO, CART_TYPE_ADMIN_SHOPPING,
};
use tigshop_core::{Error, Result};

/// 购物车行（联表商品/门店）。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct CartRow {
    pub cart_id: i32,
    pub user_id: i32,
    pub product_id: i32,
    pub sku_id: Option<i32>,
    pub quantity: i32,
    pub is_checked: i32,
    pub product_sn: String,
    pub pic_thumb: Option<String>,
    pub market_price: Option<Decimal>,
    pub original_price: Decimal,
    pub product_type: i32,
    pub shop_id: i32,
    pub sku_data: Option<String>,
    pub update_time: i64,
    pub product_name: Option<String>,
    pub product_status: Option<i32>,
    pub product_stock: Option<i32>,
    pub shop_title: Option<String>,
}

impl CartRow {
    /// 行 → 列表 VO。
    ///
    /// `price` / `subtotal` 对齐 Java `CartVO`：`price` 取 DB 快照价，
    /// `subtotal = price * quantity`（价格/活动引擎未迁移，不做优惠分摊）。
    #[must_use]
    pub fn to_vo(&self) -> CartItemVO {
        let price = self.original_price;
        CartItemVO {
            cart_id: self.cart_id,
            user_id: self.user_id,
            product_id: self.product_id,
            sku_id: self.sku_id,
            quantity: self.quantity,
            is_checked: self.is_checked,
            product_sn: self.product_sn.clone(),
            pic_thumb: self.pic_thumb.clone(),
            market_price: self.market_price,
            original_price: self.original_price,
            price,
            subtotal: price * Decimal::from(self.quantity),
            product_type: self.product_type,
            shop_id: self.shop_id,
            sku_data: self.sku_data.clone(),
            update_time: self.update_time,
            product_name: self.product_name.clone(),
            product_status: self.product_status,
            product_stock: self.product_stock,
        }
    }
}

/// 商品快照（加入购物车校验 + 价格快照）。
#[derive(Debug, Clone, Default)]
pub struct ProductSnapshot {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub pic_thumb: String,
    pub product_price: Decimal,
    pub product_status: i32,
    pub product_type: i32,
    pub product_stock: i32,
    pub shop_id: i32,
    pub is_delete: i32,
}

/// 规格快照。
#[derive(Debug, Clone, Default)]
pub struct SkuSnapshot {
    pub sku_price: Option<Decimal>,
    pub market_price: Option<Decimal>,
    pub sku_data: Option<String>,
    pub sku_stock: Option<i32>,
    pub is_enabled: i32,
}

/// 同商品/规格已存在购物车行。
#[derive(Debug, Clone, Default)]
pub struct ExistingCart {
    pub cart_id: i32,
    pub quantity: i32,
    pub product_id: i32,
    pub sku_id: i32,
    pub product_type: i32,
}

/// 代客下单购物车仓储（持有连接池）。
#[derive(Clone)]
pub struct ProxyShoppingCartRepository {
    pool: MySqlPool,
}

impl ProxyShoppingCartRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（与其它仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 购物车读 —————————————————————

    /// 用户代客下单购物车（Java `cartService.getCartList(..., TYPE_ADMIN_SHOPPING)` 的 DB 子集）。
    pub async fn list_carts(
        &self,
        user_id: i32,
        shop_id: Option<i32>,
        product_id: Option<i32>,
        is_checked: Option<i32>,
    ) -> Result<Vec<CartRow>> {
        let rows = sqlx::query_as::<_, CartRow>(
            "SELECT c.cart_id, c.user_id, c.product_id, c.sku_id, c.quantity, c.is_checked,
                    c.product_sn, c.pic_thumb, c.market_price, c.original_price, c.product_type,
                    c.shop_id, c.sku_data, c.update_time,
                    p.product_name, p.product_status, p.product_stock, s.shop_title
             FROM cart c
             LEFT JOIN product p ON p.product_id = c.product_id
             LEFT JOIN shop s ON s.shop_id = c.shop_id
             WHERE c.user_id = ? AND c.type = ?
               AND (? IS NULL OR c.shop_id = ?)
               AND (? IS NULL OR c.product_id = ?)
               AND (? IS NULL OR c.is_checked = ?)
             ORDER BY c.update_time DESC, c.cart_id DESC",
        )
        .bind(user_id)
        .bind(CART_TYPE_ADMIN_SHOPPING)
        .bind(shop_id)
        .bind(shop_id)
        .bind(product_id)
        .bind(product_id)
        .bind(is_checked)
        .bind(is_checked)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows)
    }

    /// 有效购物车行（按 id 列表）。
    pub async fn find_carts_by_ids(&self, cart_ids: &[i32]) -> Result<Vec<CartRow>> {
        if cart_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = placeholders(cart_ids.len());
        let sql = format!(
            "SELECT c.cart_id, c.user_id, c.product_id, c.sku_id, c.quantity, c.is_checked,
                    c.product_sn, c.pic_thumb, c.market_price, c.original_price, c.product_type,
                    c.shop_id, c.sku_data, c.update_time,
                    p.product_name, p.product_status, p.product_stock, s.shop_title
             FROM cart c
             LEFT JOIN product p ON p.product_id = c.product_id
             LEFT JOIN shop s ON s.shop_id = c.shop_id
             WHERE c.cart_id IN ({placeholders})"
        );
        let mut q = sqlx::query_as::<_, CartRow>(&sql);
        for id in cart_ids {
            q = q.bind(*id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 同用户 + 商品 + 规格 + 购物车类型的已有行（Java addProductToCart 的合并查找）。
    pub async fn find_same_cart(
        &self,
        user_id: i32,
        product_id: i32,
        sku_id: i32,
        cart_type: i32,
    ) -> Result<Option<ExistingCart>> {
        let row = sqlx::query_as::<_, (i32, i32, i32, i32, i32)>(
            "SELECT cart_id, quantity, product_id, COALESCE(sku_id, 0) AS sku_id, product_type FROM cart
             WHERE user_id = ? AND product_id = ? AND type = ? AND (sku_id <=> ?) LIMIT 1",
        )
        .bind(user_id)
        .bind(product_id)
        .bind(cart_type)
        .bind(sku_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(cart_id, quantity, product_id, sku_id, product_type)| ExistingCart {
            cart_id,
            quantity,
            product_id,
            sku_id,
            product_type,
        }))
    }

    /// 用户代客下单购物车全部行（冲突校验用）。
    pub async fn list_existing_carts(
        &self,
        user_id: i32,
        shop_scope: Option<i32>,
    ) -> Result<Vec<ExistingCart>> {
        // 多租户：店铺账号强制 shop_scope；平台账号 None 时不过滤。
        let rows = sqlx::query_as::<_, (i32, i32, i32, i32, i32)>(
            "SELECT cart_id, quantity, product_id, COALESCE(sku_id, 0) AS sku_id, product_type FROM cart
             WHERE user_id = ? AND type = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(user_id)
        .bind(CART_TYPE_ADMIN_SHOPPING)
        .bind(shop_scope)
        .bind(shop_scope)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(|(cart_id, quantity, product_id, sku_id, product_type)| ExistingCart {
                cart_id,
                quantity,
                product_id,
                sku_id,
                product_type,
            })
            .collect())
    }

    // ————————————————————— 商品 / 规格 —————————————————————

    /// 商品快照（Java `productService.getById`）。
    pub async fn product_snapshot(&self, product_id: i32) -> Result<Option<ProductSnapshot>> {
        let row = sqlx::query_as::<
            _,
            (
                i32,
                String,
                String,
                Option<String>,
                Decimal,
                i32,
                Option<i32>,
                i32,
                i32,
                i32,
            ),
        >(
            "SELECT product_id, product_name, product_sn, pic_thumb, product_price,
                    product_status, product_type, product_stock, shop_id, is_delete
             FROM product WHERE product_id = ? LIMIT 1",
        )
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|r| ProductSnapshot {
            product_id: r.0,
            product_name: r.1,
            product_sn: r.2,
            pic_thumb: r.3.unwrap_or_default(),
            product_price: r.4,
            product_status: r.5,
            product_type: r.6.unwrap_or(1),
            product_stock: r.7,
            shop_id: r.8,
            is_delete: r.9,
        }))
    }

    /// 规格快照（Java `productSkuService.checkSkuEnabled` + SKU 价格）。
    pub async fn sku_snapshot(&self, product_id: i32, sku_id: i32) -> Result<Option<SkuSnapshot>> {
        if sku_id <= 0 {
            return Ok(None);
        }
        let row = sqlx::query_as::<_, (Option<Decimal>, Option<Decimal>, Option<String>, Option<i32>, i32)>(
            "SELECT sku_price, market_price, sku_data, sku_stock, is_enabled
             FROM product_sku WHERE sku_id = ? AND product_id = ? LIMIT 1",
        )
        .bind(sku_id)
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|r| SkuSnapshot {
            sku_price: r.0,
            market_price: r.1,
            sku_data: r.2,
            sku_stock: r.3,
            is_enabled: r.4,
        }))
    }

    // ————————————————————— 写操作 —————————————————————

    /// 插入购物车行（价格取 DB 快照；`type = 15`）。
    #[allow(clippy::too_many_arguments)]
    pub async fn insert_cart(
        &self,
        user_id: i32,
        product: &ProductSnapshot,
        sku_id: i32,
        sku: Option<&SkuSnapshot>,
        quantity: i32,
        cart_type: i32,
        update_time: i32,
    ) -> Result<i32> {
        let price = sku
            .and_then(|s| s.sku_price)
            .unwrap_or(product.product_price);
        let market_price = sku.and_then(|s| s.market_price);
        let sku_data = sku.and_then(|s| s.sku_data.clone());
        let extra_data = serde_json::json!({ "isQuick": false }).to_string();
        let res = sqlx::query(
            "INSERT INTO cart
               (user_id, product_id, product_sn, pic_thumb, market_price, original_price,
                quantity, sku_id, sku_data, product_type, is_checked, shop_id, type,
                update_time, salesman_id, extra_data, is_wholesale_line, wholesale_grade_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, 0, 0)",
        )
        .bind(user_id)
        .bind(product.product_id)
        .bind(&product.product_sn)
        .bind(&product.pic_thumb)
        .bind(market_price)
        .bind(price)
        .bind(quantity)
        .bind(if sku_id > 0 { Some(sku_id) } else { None })
        .bind(sku_data)
        .bind(product.product_type)
        .bind(product.shop_id)
        .bind(cart_type)
        .bind(update_time)
        .bind(extra_data)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 合并数量（Java addProductToCart 命中已有行的 `quantity += number`）。
    pub async fn add_cart_quantity(
        &self,
        cart_id: i32,
        quantity: i32,
        update_time: i32,
    ) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE cart SET quantity = quantity + ?, update_time = ? WHERE cart_id = ?",
        )
        .bind(quantity)
        .bind(update_time)
        .bind(cart_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 更新数量（Java `updateCartItem` 的 `updateById(quantity)`）。
    pub async fn update_quantity(
        &self,
        cart_id: i32,
        quantity: i32,
        update_time: i32,
        shop_scope: Option<i32>,
    ) -> Result<u64> {
        // 多租户：店铺账号只能更新自身店铺的购物车行。
        let affected = sqlx::query(
            "UPDATE cart SET quantity = ?, update_time = ? WHERE cart_id = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(quantity)
        .bind(update_time)
        .bind(cart_id)
        .bind(shop_scope)
        .bind(shop_scope)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 批量更新选中状态（Java `updateCheck` → `updateBatchById`）。
    pub async fn update_checked(
        &self,
        cart_id: i32,
        is_checked: i32,
        shop_scope: Option<i32>,
    ) -> Result<u64> {
        // 多租户：店铺账号只能更新自身店铺的购物车行。
        let affected = sqlx::query(
            "UPDATE cart SET is_checked = ? WHERE cart_id = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(is_checked)
        .bind(cart_id)
        .bind(shop_scope)
        .bind(shop_scope)
        .execute(&self.pool)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected)
    }

    /// 按 id 批量删除（Java `removeBatchByIds`）。
    pub async fn delete_by_ids(&self, cart_ids: &[i32], shop_scope: Option<i32>) -> Result<u64> {
        if cart_ids.is_empty() {
            return Ok(0);
        }
        // 多租户：店铺账号只能删除自身店铺的购物车行。
        let sql = format!(
            "DELETE FROM cart WHERE cart_id IN ({}) AND (? IS NULL OR shop_id = ?)",
            placeholders(cart_ids.len())
        );
        let mut q = sqlx::query(&sql);
        for id in cart_ids {
            q = q.bind(*id);
        }
        q = q.bind(shop_scope).bind(shop_scope);
        q.execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .map_err(map_err)
    }

    /// 清空用户指定类型购物车（Java `clearCart(userId, type)`）。
    pub async fn clear_carts(
        &self,
        user_id: i32,
        cart_type: i32,
        shop_scope: Option<i32>,
    ) -> Result<u64> {
        // 多租户：店铺账号只清空自身店铺的购物车行。
        let affected = sqlx::query(
            "DELETE FROM cart WHERE user_id = ? AND type = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(user_id)
        .bind(cart_type)
        .bind(shop_scope)
        .bind(shop_scope)
            .execute(&self.pool)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected)
    }

    // ————————————————————— 计数 —————————————————————

    /// 汇总数量（Java `getCount`：过滤 `type = 15`，可选 shopId）。
    pub async fn sum_quantity(&self, user_id: i32, shop_id: Option<i32>) -> Result<i64> {
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
            .and_then(|sum| i64::try_from(sum).ok())
            .unwrap_or(0))
    }
}

/// 生成 `?, ?, ?` 占位符串。
fn placeholders(count: usize) -> String {
    vec!["?"; count].join(", ")
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cart_type_used_by_insert() {
        assert_eq!(cart_type_from_product_type(1), 1);
        assert_eq!(CART_TYPE_ADMIN_SHOPPING, 15);
    }

    #[test]
    fn placeholders_shape() {
        assert_eq!(placeholders(2), "?, ?");
    }

    #[test]
    fn row_to_vo_keeps_snapshot_fields() {
        let row = CartRow {
            cart_id: 1,
            user_id: 2,
            product_id: 3,
            sku_id: Some(4),
            quantity: 5,
            is_checked: 1,
            product_sn: "SN".into(),
            pic_thumb: None,
            market_price: None,
            original_price: Decimal::new(1999, 2),
            product_type: 1,
            shop_id: 6,
            sku_data: Some("红色".into()),
            update_time: 7,
            product_name: Some("商品".into()),
            product_status: Some(1),
            product_stock: Some(10),
            shop_title: Some("门店".into()),
        };
        let vo = row.to_vo();
        assert_eq!(vo.original_price, Decimal::new(1999, 2));
        assert_eq!(vo.product_name.as_deref(), Some("商品"));
    }
}
