//! 营销活动仓储（marketing::promotion）。
//!
//! 表 `promotion`（15 列，实体 `tigshop_core::entities::Promotion`）。
//! 对应 Java `PromotionServiceImpl#list` / `getCount` / `create` / `update`。
//!
//! 时间类型条件（与 models 模块头一致）：
//! - `1` 进行中：`(start_time <= ? AND end_time >= ?) OR (start_time = 0 AND end_time = 0)`
//! - `2` 7 天内到期：`start_time <= ? AND end_time >= ? AND end_time <= ?`
//! - `3` 已结束：`end_time > 0 AND end_time < ?`
//!
//! 查询统一运行时 `sqlx::query_as`；`range_data`/`sku_ids`/`member_marks`
//! 为 JSON 文本列（Java `List.toString()`，读取时由服务层兼容解析）。

use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::entities::Promotion;
use tigshop_core::models::marketing::promotion::{
    SEVEN_DAYS_SECS, MSG_PROMOTION_NOT_FOUND, TIME_ENDED, TIME_EXPIRING_7D, TIME_ONGOING,
};
use tigshop_core::{Error, Result};

/// `promotion` 固定 SELECT 列（15 列；`type` 为 MySQL 非保留字，可直接选）。
pub const PROMOTION_COLUMNS: &str = "promotion_id, promotion_name, start_time, end_time, type, shop_id, relation_id, `range`, range_data, sku_ids, is_available, is_delete, member_range, member_marks, member_scope";

/// 活动数量行。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct PromotionCountRow {
    pub time_type1_count: i64,
    pub time_type2_count: i64,
    pub time_type3_count: i64,
}

/// 营销活动仓储。
#[derive(Clone)]
pub struct PromotionRepository {
    pool: MySqlPool,
}

impl PromotionRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 分页（Java `list`：keyword LIKE + type IN + timeType 条件 +
    /// 排序白名单，缺省 `promotion_id DESC`）。
    pub async fn paginate(
        &self,
        keyword: Option<&str>,
        shop_id: Option<i32>,
        types: Option<&[i32]>,
        time_type: Option<i32>,
        now: i64,
        sort_field: Option<&str>,
        sort_order: Option<&str>,
        limit: u64,
        offset: u64,
    ) -> Result<(u64, Vec<Promotion>)> {
        let like = keyword
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|k| format!("%{k}%"));
        let column = resolve_sort_column(sort_field);
        let dir = if sort_order.is_some_and(|o| o.eq_ignore_ascii_case("asc")) {
            "ASC"
        } else {
            "DESC"
        };

        let mut count_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM promotion WHERE 1 = 1");
        push_filters(
            &mut count_qb,
            like.as_deref(),
            shop_id,
            types,
            time_type,
            now,
        );
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(format!(
            "SELECT {PROMOTION_COLUMNS} FROM promotion WHERE 1 = 1"
        ));
        push_filters(&mut qb, like.as_deref(), shop_id, types, time_type, now);
        qb.push(format!(" ORDER BY {column} {dir} LIMIT "));
        qb.push_bind(limit.max(1));
        qb.push(" OFFSET ");
        qb.push_bind(offset);
        let rows = qb.build_query_as::<Promotion>().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    /// 活动数量（Java `getCount` → `PromotionCountVO` 三个时间桶）。
    pub async fn count_buckets(&self, now: i64) -> Result<PromotionCountRow> {
        let sql = format!(
            "SELECT \
             CAST(SUM(CASE WHEN (start_time <= ? AND end_time >= ?) OR (start_time = 0 AND end_time = 0) THEN 1 ELSE 0 END) AS SIGNED) AS time_type1_count, \
             CAST(SUM(CASE WHEN start_time <= ? AND end_time >= ? AND end_time <= ? THEN 1 ELSE 0 END) AS SIGNED) AS time_type2_count, \
             CAST(SUM(CASE WHEN end_time > 0 AND end_time < ? THEN 1 ELSE 0 END) AS SIGNED) AS time_type3_count \
             FROM promotion"
        );
        let row: (Option<i64>, Option<i64>, Option<i64>) = sqlx::query_as(&sql)
            .bind(now)
            .bind(now)
            .bind(now)
            .bind(now)
            .bind(now + SEVEN_DAYS_SECS)
            .bind(now)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(PromotionCountRow {
            time_type1_count: row.0.unwrap_or(0),
            time_type2_count: row.1.unwrap_or(0),
            time_type3_count: row.2.unwrap_or(0),
        })
    }

    /// 按主键查询（Java `getById`）。
    pub async fn find_by_id(&self, promotion_id: i32) -> Result<Option<Promotion>> {
        let sql = format!(
            "SELECT {PROMOTION_COLUMNS} FROM promotion WHERE promotion_id = ? LIMIT 1"
        );
        sqlx::query_as::<_, Promotion>(&sql)
            .bind(promotion_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 新增（Java `save`），返回主键。
    pub async fn insert(&self, p: &Promotion) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO promotion (promotion_name, start_time, end_time, type, shop_id, relation_id, `range`, range_data, sku_ids, is_available, is_delete, member_range, member_marks, member_scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.promotion_name)
        .bind(p.start_time)
        .bind(p.end_time)
        .bind(p.r#type)
        .bind(p.shop_id)
        .bind(p.relation_id)
        .bind(p.range)
        .bind(&p.range_data)
        .bind(&p.sku_ids)
        .bind(p.is_available)
        .bind(p.is_delete)
        .bind(p.member_range)
        .bind(&p.member_marks)
        .bind(&p.member_scope)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 更新（Java `updateById`）。
    pub async fn update(&self, p: &Promotion) -> Result<bool> {
        let res = sqlx::query(
            "UPDATE promotion SET promotion_name = ?, start_time = ?, end_time = ?, type = ?, shop_id = ?, relation_id = ?, `range` = ?, range_data = ?, sku_ids = ?, is_available = ?, is_delete = ?, member_range = ?, member_marks = ?, member_scope = ? WHERE promotion_id = ?",
        )
        .bind(&p.promotion_name)
        .bind(p.start_time)
        .bind(p.end_time)
        .bind(p.r#type)
        .bind(p.shop_id)
        .bind(p.relation_id)
        .bind(p.range)
        .bind(&p.range_data)
        .bind(&p.sku_ids)
        .bind(p.is_available)
        .bind(p.is_delete)
        .bind(p.member_range)
        .bind(&p.member_marks)
        .bind(&p.member_scope)
        .bind(p.promotion_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }
}

/// 追加过滤条件（keyword / types / timeType）。
fn push_filters(
    qb: &mut QueryBuilder<'_, MySql>,
    like: Option<&str>,
    shop_id: Option<i32>,
    types: Option<&[i32]>,
    time_type: Option<i32>,
    now: i64,
) {
    if let Some(k) = like {
        qb.push(" AND promotion_name LIKE ");
        qb.push_bind(k.to_string());
    }
    // 多租户：店铺账号强制 `WHERE shop_id = ?`；平台账号不过滤
    if let Some(id) = shop_id {
        qb.push(" AND shop_id = ");
        qb.push_bind(id);
    }
    if let Some(types) = types.filter(|t| !t.is_empty()) {
        qb.push(" AND type IN (");
        let mut sep = qb.separated(", ");
        for t in types {
            sep.push_bind(*t);
        }
        sep.push_unseparated(")");
    }
    match time_type {
        Some(TIME_ONGOING) => {
            qb.push(" AND (((start_time <= ");
            qb.push_bind(now);
            qb.push(" AND end_time >= ");
            qb.push_bind(now);
            qb.push(") OR (start_time = 0 AND end_time = 0)))");
        }
        Some(TIME_EXPIRING_7D) => {
            qb.push(" AND (start_time <= ");
            qb.push_bind(now);
            qb.push(" AND end_time >= ");
            qb.push_bind(now);
            qb.push(" AND end_time <= ");
            qb.push_bind(now + SEVEN_DAYS_SECS);
            qb.push(")");
        }
        Some(TIME_ENDED) => {
            qb.push(" AND (end_time > 0 AND end_time < ");
            qb.push_bind(now);
            qb.push(")");
        }
        _ => {}
    }
}

/// 排序字段白名单（`promotion` 实存列；未知回退主键）。
#[must_use]
pub fn resolve_sort_column(field: Option<&str>) -> &'static str {
    match field {
        Some("promotionId") | Some("promotion_id") => "promotion_id",
        Some("startTime") | Some("start_time") => "start_time",
        Some("endTime") | Some("end_time") => "end_time",
        Some("type") => "`type`",
        _ => "promotion_id",
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound(MSG_PROMOTION_NOT_FOUND.into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn columns_cover_entity() {
        assert_eq!(PROMOTION_COLUMNS.split(", ").count(), 15);
        assert!(!PROMOTION_COLUMNS.contains('*'));
        assert!(PROMOTION_COLUMNS.contains("`range`"));
    }

    #[test]
    fn sort_whitelist_quotes_reserved_word() {
        assert_eq!(resolve_sort_column(None), "promotion_id");
        assert_eq!(resolve_sort_column(Some("type")), "`type`");
        assert_eq!(resolve_sort_column(Some("startTime")), "start_time");
        assert_eq!(resolve_sort_column(Some("1;DROP TABLE promotion")), "promotion_id");
    }
}
