//! 推荐 域仓储（system::recommend）—— wave9。
//!
//! 直接读 `product` 表（上架、未删除、店铺过滤），运行时 sqlx。

use rust_decimal::Decimal;
use sqlx::mysql::MySqlPool;
use sqlx::FromRow;

use tigshop_core::models::system::recommend::GuessLikeQuery;
use tigshop_core::{Error, Result};

/// 推荐商品行。
#[derive(Debug, Clone, FromRow)]
pub struct RecommendProductRow {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品货号
    pub product_sn: String,
    /// 售价
    pub product_price: Decimal,
    /// 主图
    pub pic_url: String,
    /// 缩略图
    pub pic_thumb: String,
    /// 店铺 ID
    pub shop_id: i32,
    /// 商品类型
    pub product_type: Option<i32>,
    /// 虚拟销量
    pub virtual_sales: Option<i32>,
}

/// 推荐仓储。
#[derive(Clone)]
pub struct RecommendRepository {
    pool: MySqlPool,
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

impl RecommendRepository {
    /// 构造仓储。
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 猜你喜欢分页（Java `getProductList`）。
    pub async fn guess_like(
        &self,
        q: &GuessLikeQuery,
    ) -> Result<(u64, Vec<RecommendProductRow>)> {
        let mut conds: Vec<String> = vec![
            "is_delete = 0".to_string(),
            "product_status = 1".to_string(),
        ];
        let mut binds: Vec<i64> = Vec::new();
        if let Some(shop_id) = q.shop_id.filter(|v| *v > 0) {
            conds.push("shop_id = ?".to_string());
            binds.push(i64::from(shop_id));
        }
        if let Some(t) = q.product_type {
            conds.push("product_type = ?".to_string());
            binds.push(i64::from(t));
        }
        if let Some(c) = q.category_id.filter(|v| *v > 0) {
            conds.push("category_id = ?".to_string());
            binds.push(i64::from(c));
        }
        let where_sql = format!(" WHERE {}", conds.join(" AND "));
        let page = q.page_query();
        let size = u64::from(page.page_size);
        let offset = u64::from(page.page - 1) * size;
        let count_sql = format!("SELECT COUNT(*) FROM product{where_sql}");
        let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &binds {
            cq = cq.bind(*b);
        }
        let total = cq.fetch_one(&self.pool).await.map_err(map_err)?.0;
        let dir = if q.ascending() { "ASC" } else { "DESC" };
        let order_sql = match q.sort_field.as_deref() {
            Some("sales") => format!(" ORDER BY virtual_sales {dir}, product_id DESC"),
            Some("click") => format!(" ORDER BY click_count {dir}, product_id DESC"),
            Some("new") => format!(" ORDER BY add_time {dir}, product_id DESC"),
            _ => " ORDER BY is_best DESC, click_count DESC, product_id DESC".to_string(),
        };
        let sql = format!(
            "SELECT product_id, product_name, product_sn, product_price, pic_url, pic_thumb, \
             shop_id, product_type, virtual_sales FROM product{where_sql}{order_sql} LIMIT ? OFFSET ?"
        );
        let mut rq = sqlx::query_as::<_, RecommendProductRow>(&sql);
        for b in &binds {
            rq = rq.bind(*b);
        }
        let rows = rq
            .bind(i64::try_from(size).unwrap_or(10))
            .bind(i64::try_from(offset).unwrap_or(0))
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total).unwrap_or(0), rows))
    }

    /// 推荐商品 ID 列表（Java `getProductIds`）。
    pub async fn recommend_ids(&self, limit: u32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT product_id FROM product WHERE is_delete = 0 AND product_status = 1 \
             ORDER BY is_best DESC, click_count DESC, product_id DESC LIMIT ?",
        )
        .bind(i64::from(limit))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 精品 + 热销商品 ID。
    ///
    /// 对应 Java `getRecommendedProductIds` 的第 1、2 段（`is_best = 1 LIMIT 10`
    /// 与 `is_hot = 1 LIMIT 10`）。原版是两次查询后并集去重，这里合成一次，
    /// 用 `is_best DESC` 保证精品始终排在热销之前。
    pub async fn best_hot_ids(&self, limit: u32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT product_id FROM product WHERE is_delete = 0 AND product_status = 1 \
             AND (is_best = 1 OR is_hot = 1) \
             ORDER BY is_best DESC, click_count DESC, product_id DESC LIMIT ?",
        )
        .bind(i64::from(limit))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 会员浏览记录中的商品 ID（Java `User.historyProductIds`，按最近在前截取）。
    ///
    /// Java 侧用 hutool `JSONUtil.toList(raw, Integer.class)` 解析，落库是 JSON 数组；
    /// 这里兼容可能出现的逗号分隔写法，解析失败一律当作空。
    pub async fn history_ids(&self, user_id: i32, limit: u32) -> Result<Vec<i32>> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT history_product_ids FROM user WHERE user_id = ?")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;

        let Some((Some(raw),)) = row else {
            return Ok(Vec::new());
        };
        let raw = raw.trim();
        if raw.is_empty() {
            return Ok(Vec::new());
        }

        let mut ids: Vec<i32> = serde_json::from_str::<Vec<i32>>(raw).unwrap_or_else(|_| {
            raw.split(',')
                .filter_map(|s| s.trim().trim_matches('"').parse::<i32>().ok())
                .collect()
        });
        ids.truncate(limit as usize);
        Ok(ids)
    }

    /// 兜底热门商品 ID。
    ///
    /// 对应原版第 4 段「不足 40 个时补全」。原版用 `ORDER BY RAND()` 且只从
    /// `is_hot = 1` 里取，本站热销商品仅 4 个、补不出量；这里改为按点击量取
    /// 在售商品，结果稳定、可缓存，也避免每次请求都做全表随机排序。
    pub async fn popular_ids(&self, limit: u32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT product_id FROM product WHERE is_delete = 0 AND product_status = 1 \
             ORDER BY click_count DESC, product_id DESC LIMIT ?",
        )
        .bind(i64::from(limit))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }
}
