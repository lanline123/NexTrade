//! `cart` 仓储，替代 `CartMapper`。

use rust_decimal::Decimal;
use sqlx::MySqlPool;
use tigshop_core::entities::Cart;
use tigshop_core::{Error, Result};

#[derive(Clone)]
pub struct CartRepository {
    pool: MySqlPool,
}

impl CartRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 用户购物车列表（可按店铺过滤）。
    pub async fn find_by_user(&self, user_id: i32, shop_id: Option<i32>) -> Result<Vec<Cart>> {
        sqlx::query_as::<_, Cart>(
            "SELECT * FROM cart WHERE user_id = ? AND (? IS NULL OR shop_id = ?) ORDER BY cart_id DESC",
        )
        .bind(user_id)
        .bind(shop_id)
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按 ID 查询（校验归属）。
    pub async fn find_owned(&self, cart_id: i32, user_id: i32) -> Result<Option<Cart>> {
        sqlx::query_as::<_, Cart>("SELECT * FROM cart WHERE cart_id = ? AND user_id = ? LIMIT 1")
            .bind(cart_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 同款商品（product+sku）是否已在购物车。
    pub async fn find_line(
        &self,
        user_id: i32,
        product_id: i32,
        sku_id: Option<i32>,
    ) -> Result<Option<Cart>> {
        sqlx::query_as::<_, Cart>(
            "SELECT * FROM cart
             WHERE user_id = ? AND product_id = ?
               AND (sku_id = ? OR (sku_id IS NULL AND ? IS NULL))
             LIMIT 1",
        )
        .bind(user_id)
        .bind(product_id)
        .bind(sku_id)
        .bind(sku_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 新增购物车行，返回 cart_id。
    pub async fn insert(&self, cart: &Cart) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO cart
             (user_id, product_id, product_sn, pic_thumb, market_price,
              original_price, quantity, sku_id, sku_data, product_type,
              is_checked, shop_id, `type`, update_time, extra_data, extra_sku_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(cart.user_id)
        .bind(cart.product_id)
        .bind(&cart.product_sn)
        .bind(&cart.pic_thumb)
        .bind(cart.market_price)
        .bind(cart.original_price)
        .bind(cart.quantity)
        .bind(cart.sku_id)
        .bind(&cart.sku_data)
        .bind(cart.product_type)
        .bind(cart.is_checked)
        .bind(cart.shop_id)
        .bind(cart.r#type)
        .bind(cart.update_time)
        .bind(&cart.extra_data)
        .bind(&cart.extra_sku_data)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 更新数量。
    pub async fn update_quantity(&self, cart_id: i32, user_id: i32, quantity: i32) -> Result<()> {
        let affected = sqlx::query(
            "UPDATE cart SET quantity = ?, update_time = ? WHERE cart_id = ? AND user_id = ?",
        )
        .bind(quantity)
        .bind(tigshop_common::utils::now_seconds() as i32)
        .bind(cart_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        if affected == 0 {
            return Err(Error::NotFound("购物车记录不存在".into()));
        }
        Ok(())
    }

    /// 合并同款行时刷新附加属性 JSON 与含附加价到手价
    /// （Java 加购对已存在行是「删旧插新」，`extraSkuData` / `originalPrice`
    /// 均按本次选择重算；此处用 UPDATE 等价实现）。
    pub async fn update_extra_sku_data(
        &self,
        cart_id: i32,
        user_id: i32,
        extra_sku_data: Option<&str>,
        original_price: Decimal,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE cart SET extra_sku_data = ?, original_price = ?, update_time = ? WHERE cart_id = ? AND user_id = ?",
        )
        .bind(extra_sku_data)
        .bind(original_price)
        .bind(tigshop_common::utils::now_seconds() as i32)
        .bind(cart_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(())
    }

    /// 更新勾选状态。
    pub async fn update_checked(&self, cart_id: i32, user_id: i32, checked: bool) -> Result<()> {
        sqlx::query("UPDATE cart SET is_checked = ? WHERE cart_id = ? AND user_id = ?")
            .bind(i32::from(checked))
            .bind(cart_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    /// 取消当前会员全部购物车勾选（立即购买前使用，避免旧勾选商品被结算）。
    pub async fn uncheck_all(&self, user_id: i32) -> Result<u64> {
        let res = sqlx::query("UPDATE cart SET is_checked = 0 WHERE user_id = ?")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量删除。
    pub async fn delete(&self, cart_ids: &[i32], user_id: i32) -> Result<u64> {
        if cart_ids.is_empty() {
            return Ok(0);
        }
        let placeholders = vec!["?"; cart_ids.len()].join(", ");
        let sql = format!("DELETE FROM cart WHERE user_id = ? AND cart_id IN ({placeholders})");
        let mut q = sqlx::query(&sql).bind(user_id);
        for id in cart_ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 清空购物车。
    pub async fn clear(&self, user_id: i32) -> Result<u64> {
        let r = sqlx::query("DELETE FROM cart WHERE user_id = ?")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("购物车记录不存在".into()),
        other => Error::Database(other.to_string()),
    }
}