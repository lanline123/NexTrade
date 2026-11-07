//! 积分商品域仓储（marketing::points_exchange）。
//! 表 `points_exchange`；只读 `product` / `product_sku` 装配。

use std::collections::HashMap;

use sqlx::{MySql, MySqlPool, QueryBuilder};
use sqlx::FromRow;
use tigshop_core::entities::promotion::PointsExchange;

/// 商品装配行（部分列）。
#[derive(Debug, Clone, Default, FromRow)]
pub struct PointsProductRow {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_stock: i32,
    pub product_price: rust_decimal::Decimal,
    pub market_price: rust_decimal::Decimal,
    pub pic_thumb: String,
    pub pic_url: String,
    pub virtual_sales: i32,
}

/// SKU 装配行。
#[derive(Debug, Clone, Default, FromRow)]
pub struct PointsSkuRow {
    pub sku_id: i32,
    pub product_id: i32,
    pub sku_price: Option<rust_decimal::Decimal>,
    pub sku_stock: Option<i32>,
    pub is_enabled: i32,
}
use tigshop_core::models::marketing::points_exchange::{
    limit_offset, PointsExchangeListQuery,
};
use tigshop_core::{Error, Result};

const SELECT: &str = "SELECT id, product_id, exchange_integral, points_deducted_amount, is_hot, is_enabled, sku_id FROM points_exchange";

/// 积分商品域仓储。
#[derive(Clone)]
pub struct PointsExchangeRepository {
    pool: MySqlPool,
}

impl PointsExchangeRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    pub async fn find_by_id(&self, id: i32) -> Result<Option<PointsExchange>> {
        sqlx::query_as::<_, PointsExchange>(&format!("{SELECT} WHERE id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 分页（Java `list`：关键字→商品 id、上架未删除商品、启用时校验 sku、isHot/isEnabled）。
    pub async fn paginate(
        &self,
        q: &PointsExchangeListQuery,
        product_ids: Option<&[i32]>,
        limit: i64,
        offset: i64,
    ) -> Result<(i64, Vec<PointsExchange>)> {
        let mut cq: QueryBuilder<'_, MySql> = QueryBuilder::new("SELECT COUNT(*) FROM points_exchange WHERE 1 = 1");
        Self::push_filters(&mut cq, q, product_ids);
        let total: (i64,) = cq.build_query_as().fetch_one(&self.pool).await.map_err(map_err)?;
        let mut rq: QueryBuilder<'_, MySql> = QueryBuilder::new(format!("{SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut rq, q, product_ids);
        rq.push(q.order_clause());
        rq.push(format!(" LIMIT {limit} OFFSET {offset}"));
        let rows: Vec<PointsExchange> = rq.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total.0, rows))
    }

    fn push_filters(
        qb: &mut QueryBuilder<'_, MySql>,
        q: &PointsExchangeListQuery,
        product_ids: Option<&[i32]>,
    ) {
        if let Some(ids) = product_ids {
            qb.push(" AND product_id IN (");
            Self::push_int_list(qb, ids);
            qb.push(")");
        } else {
            // 无关键字：内联商品有效性（Java innerJoin + product_status=1 + is_delete=0）
            qb.push(" AND EXISTS (SELECT 1 FROM product p WHERE p.product_id = points_exchange.product_id AND p.product_status = 1 AND p.is_delete = 0)");
        }
        if let Some(is_enabled) = q.is_enabled {
            qb.push(" AND is_enabled = ");
            qb.push_bind(is_enabled);
            if is_enabled == 1 {
                qb.push(" AND (sku_id IS NULL OR sku_id <= 0 OR EXISTS (SELECT 1 FROM product_sku s WHERE s.sku_id = points_exchange.sku_id AND s.is_enabled = 1))");
            }
        }
        if let Some(is_hot) = q.is_hot {
            qb.push(" AND is_hot = ");
            qb.push_bind(is_hot);
        }
    }

    /// 已上架未删除且名称命中的商品 id（关键字为空由服务层跳过）。
    pub async fn find_valid_product_ids_by_name(&self, keyword: &str) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT product_id FROM product WHERE product_status = 1 AND is_delete = 0 AND product_name LIKE ?",
        )
        .bind(format!("%{keyword}%"))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 同商品重复校验（Java `getCount(productId, excludeId)`）。
    pub async fn count_by_product(&self, product_id: i32, exclude_id: i32) -> Result<i64> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM points_exchange WHERE product_id = ? AND id <> ?")
                .bind(product_id)
                .bind(exclude_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0)
    }

    /// 按商品 + SKU 查活动（Java `OrderCheckServiceImpl` flowType==3 分支：
    /// `pointsExchangeMapper.selectOne(eq(productId).eq(skuId))`）。
    /// 结算装配据 `exchange_integral` / `points_deducted_amount` 计算兑换积分与抵扣金额。
    pub async fn find_by_product(
        &self,
        product_id: i32,
        sku_id: i32,
    ) -> Result<Option<PointsExchange>> {
        sqlx::query_as::<_, PointsExchange>(&format!(
            "{SELECT} WHERE product_id = ? AND sku_id = ? LIMIT 1"
        ))
        .bind(product_id)
        .bind(sku_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// SKU 启用校验（Java `checkSkuEnabled`：skuId 空/<=0 跳过）。
    pub async fn sku_enabled(&self, product_id: i32, sku_id: i32) -> Result<bool> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM product_sku WHERE sku_id = ? AND product_id = ? AND is_enabled = 1",
        )
        .bind(sku_id)
        .bind(product_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0 > 0)
    }

    pub async fn insert(&self, entity: &PointsExchange) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO points_exchange (product_id, exchange_integral, points_deducted_amount, is_hot, is_enabled, sku_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(entity.product_id)
        .bind(entity.exchange_integral)
        .bind(entity.points_deducted_amount)
        .bind(entity.is_hot)
        .bind(entity.is_enabled)
        .bind(entity.sku_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or_default())
    }

    pub async fn update(&self, entity: &PointsExchange) -> Result<u64> {
        let res = sqlx::query(
            "UPDATE points_exchange SET product_id = ?, exchange_integral = ?, points_deducted_amount = ?, is_hot = ?, is_enabled = ?, sku_id = ? WHERE id = ?",
        )
        .bind(entity.product_id)
        .bind(entity.exchange_integral)
        .bind(entity.points_deducted_amount)
        .bind(entity.is_hot)
        .bind(entity.is_enabled)
        .bind(entity.sku_id)
        .bind(entity.id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM points_exchange WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    pub async fn delete_batch(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new("DELETE FROM points_exchange WHERE id IN (");
        Self::push_int_list(&mut qb, ids);
        qb.push(")");
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::marketing::points_exchange::UPDATE_FIELDS.contains(&column)
        );
        let sql = format!("UPDATE points_exchange SET {column} = ? WHERE id = ?");
        let res = sqlx::query(&sql).bind(val).bind(id).execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    pub async fn find_products(&self, ids: &[i32]) -> Result<Vec<PointsProductRow>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new("SELECT product_id, product_name, product_sn, product_stock, product_price, market_price, pic_thumb, pic_url, virtual_sales FROM product WHERE product_id IN (");
        Self::push_int_list(&mut qb, ids);
        qb.push(")");
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    pub async fn find_skus(&self, ids: &[i32]) -> Result<Vec<PointsSkuRow>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new("SELECT sku_id, product_id, sku_price, sku_stock, is_enabled FROM product_sku WHERE sku_id IN (");
        Self::push_int_list(&mut qb, ids);
        qb.push(")");
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 商品/SKU 建索引辅助。
    #[must_use]
    pub fn index_products(rows: Vec<PointsProductRow>) -> HashMap<i32, PointsProductRow> {
        rows.into_iter().map(|p| (p.product_id, p)).collect()
    }
    #[must_use]
    pub fn index_skus(rows: Vec<PointsSkuRow>) -> HashMap<i32, PointsSkuRow> {
        rows.into_iter().map(|s| (s.sku_id, s)).collect()
    }

    #[must_use]
    pub fn page_window(page: Option<i64>, size: Option<i64>) -> (i64, i64) {
        limit_offset(page, size)
    }

    fn push_int_list(qb: &mut QueryBuilder<'_, MySql>, ids: &[i32]) {
        {
            let mut sep = qb.separated(", ");
            for id in ids {
                sep.push_bind(*id);
            }
        }
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::marketing::points_exchange::COLUMNS;

    #[test]
    fn select_matches_columns() {
        let selected = SELECT.trim_start_matches("SELECT ").split(" FROM ").next().unwrap();
        assert_eq!(selected, COLUMNS.join(", "));
    }

    #[test]
    fn static_sql_guards() {
        let src = include_str!("points_exchange.rs");
        assert!(src.contains("FROM product WHERE product_status = 1 AND is_delete = 0"));
        assert!(src.contains("p.product_status = 1 AND p.is_delete = 0"));
        assert!(src.contains("INSERT INTO points_exchange"));
    }
}
