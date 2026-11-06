//! 订单日志 域仓储（trade::order_log）—— wave9。
//!
//! 表 `order_log`（列名以 `java/database/pure.sql` 为准）：
//! `log_id` / `order_id` / `order_sn` / `admin_id` / `user_id` /
//! `description` / `log_time` / `shop_id`。运行时 sqlx（**不**用 `query!`）。

use sqlx::mysql::MySqlPool;
use sqlx::FromRow;

use tigshop_core::models::trade::order_log::OrderLogListQuery;
use tigshop_core::{Error, Result};

/// `order_log` 查询行。
#[derive(Debug, Clone, FromRow)]
pub struct OrderLogRow {
    /// 日志 ID
    pub log_id: i32,
    /// 订单 ID
    pub order_id: i32,
    /// 订单号
    pub order_sn: String,
    /// 管理员 ID
    pub admin_id: i32,
    /// 用户 ID
    pub user_id: i32,
    /// 日志内容
    pub description: String,
    /// 操作时间（秒）
    pub log_time: i64,
    /// 店铺 ID
    pub shop_id: i32,
}

/// 订单日志仓储。
#[derive(Clone)]
pub struct OrderLogRepository {
    pool: MySqlPool,
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

impl OrderLogRepository {
    /// 构造仓储。
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 日志分页（Java `OrderLogController.list`）。
    pub async fn paginate(
        &self,
        q: &OrderLogListQuery,
        shop_scope: Option<i32>,
    ) -> Result<(u64, Vec<OrderLogRow>)> {
        let mut conds: Vec<String> = Vec::new();
        let mut binds: Vec<Bind> = Vec::new();
        // 多租户：店铺账号只能看本店日志；平台账号不限制。
        if let Some(shop_id) = shop_scope.filter(|v| *v > 0) {
            conds.push("shop_id = ?".to_string());
            binds.push(Bind::I32(shop_id));
        }
        if let Some(order_id) = q.order_id.filter(|v| *v > 0) {
            conds.push("order_id = ?".to_string());
            binds.push(Bind::I32(order_id));
        }
        if let Some(kw) = q.keyword.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            conds.push("(order_sn LIKE ? OR description LIKE ?)".to_string());
            binds.push(Bind::Str(format!("%{kw}%")));
            binds.push(Bind::Str(format!("%{kw}%")));
        }
        let where_sql = if conds.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conds.join(" AND "))
        };
        let (size, offset) = q.limit_offset();
        let count_sql = format!("SELECT COUNT(*) FROM order_log{where_sql}");
        let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
        for b in &binds {
            cq = match b {
                Bind::I32(v) => cq.bind(*v),
                Bind::Str(v) => cq.bind(v.clone()),
            };
        }
        let total = cq.fetch_one(&self.pool).await.map_err(map_err)?.0;
        let rows_sql = format!(
            "SELECT log_id, order_id, order_sn, admin_id, user_id, description, log_time, shop_id \
             FROM order_log{where_sql} ORDER BY log_id DESC LIMIT ? OFFSET ?"
        );
        let mut rq = sqlx::query_as::<_, OrderLogRow>(&rows_sql);
        for b in &binds {
            rq = match b {
                Bind::I32(v) => rq.bind(*v),
                Bind::Str(v) => rq.bind(v.clone()),
            };
        }
        let rows = rq
            .bind(i64::try_from(size).unwrap_or(15))
            .bind(i64::try_from(offset).unwrap_or(0))
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total).unwrap_or(0), rows))
    }

    /// 插入日志（Java `OrderLogController.create`）。
    #[allow(clippy::too_many_arguments)]
    pub async fn insert(
        &self,
        order_id: i32,
        order_sn: &str,
        admin_id: i32,
        user_id: i32,
        description: &str,
        log_time: i64,
        shop_id: i32,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO order_log (order_id, order_sn, admin_id, user_id, description, log_time, shop_id) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(order_id)
        .bind(order_sn)
        .bind(admin_id)
        .bind(user_id)
        .bind(description)
        .bind(log_time)
        .bind(shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(())
    }
}

enum Bind {
    I32(i32),
    Str(String),
}
