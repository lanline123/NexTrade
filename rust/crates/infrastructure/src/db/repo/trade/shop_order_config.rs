//! 店铺订单配置域仓储（trade::shop_order_config）。
//!
//! 表：`order_config(id, shop_id, code, data)`；查询使用运行时 `sqlx::query_as`。

use sqlx::MySqlPool;

use tigshop_core::{Error, Result};

/// 店铺订单配置仓储。
#[derive(Clone)]
pub struct ShopOrderConfigRepository {
    pool: MySqlPool,
}

impl ShopOrderConfigRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 查配置行 id + data（Java `getOne(eq(code).eq(shopId))`）。
    pub async fn find_config(&self, shop_id: i32, code: &str) -> Result<Option<(i32, Option<String>)>> {
        sqlx::query_as::<_, (i32, Option<String>)>(
            "SELECT id, data FROM order_config WHERE shop_id = ? AND code = ? LIMIT 1",
        )
        .bind(shop_id)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 插入配置（Java `this.save`）。
    pub async fn insert_config(&self, shop_id: i32, code: &str, data: &str) -> Result<i32> {
        let res = sqlx::query("INSERT INTO order_config (shop_id, code, data) VALUES (?, ?, ?)")
            .bind(shop_id)
            .bind(code)
            .bind(data)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 按主键更新 data（Java `updateById`）。
    pub async fn update_config(&self, id: i32, data: &str) -> Result<u64> {
        let affected = sqlx::query("UPDATE order_config SET data = ? WHERE id = ?")
            .bind(data)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected)
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
        assert!(std::any::type_name::<ShopOrderConfigRepository>().contains("ShopOrderConfig"));
    }
}
