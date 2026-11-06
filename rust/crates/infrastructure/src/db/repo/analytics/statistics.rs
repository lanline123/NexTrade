//! 访问统计域（analytics::statistics）仓储。
//!
//! 对应原 Java：
//! - `com.tigshop.mapper.log.StatisticsBaseMapper`（表 `statistics_base`）
//! - `com.tigshop.mapper.user.UserMapper`（表 `user`）
//! - `com.tigshop.mapper.order.OrderMapper`（表 `order`）
//! - `com.tigshop.mapper.finance.UserRechargeOrderMapper`
//!   （表 `user_recharge_order`）
//!
//! 本域没有单表 CRUD，四条接口全是**聚合报表**，因此仓储方法都是
//! 「按区间汇总 / 去重计数 / 排行分页」，而不是 `find_by_id` 那一套。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table <表名>`）：
//!
//! | 表 | 用到的列 |
//! |----|---------|
//! | `statistics_base` | `date`(DATE,NULL) / `click_count`(int,NULL) / `visitor_count`(int,NULL) / `shop_id`(int,NULL) |
//! | `user` | `user_id` / `username` / `mobile` / `reg_time`(int) |
//! | `order` | `order_id` / `user_id` / `pay_status` / `add_time` / `pay_time` / `shop_id` / `total_amount` |
//! | `user_recharge_order` | `user_id` / `add_time` |
//!
//! ⚠️ `user` 表**没有** `shop_id` 列（`reg_time` 是 `int` 秒级时间戳），
//! `user_recharge_order` 也**没有** `shop_id` 列 —— 请不要凭直觉加。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! ## 整数聚合为什么要 `CAST(... AS SIGNED)`
//!
//! MySQL 的 `SUM(int_col)` 返回 **DECIMAL**，而 sqlx 的 `i64` 解码器
//! 只接受整数类型；`COUNT(*)` 虽然返回 `BIGINT`，但忘记 `COALESCE`
//! 时无行会得到 `NULL`。故这里统一
//! `CAST(COALESCE(SUM(...), 0) AS SIGNED)`，既是整数类型又不会为 NULL。
//!
//! ## 金额
//!
//! `order.total_amount` 是 `decimal(10,2)`，一律用
//! `rust_decimal::Decimal` 承载，并在 **SQL 侧** `SUM()`，
//! 绝不在 Rust 侧用 `f64` 累加。

use rust_decimal::Decimal;
use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::models::analytics::statistics::PAYMENT_STATUS_PAID;
use tigshop_core::{Error, Result};

/// `statistics_base` 按日聚合的一行。
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DailyVisitRow {
    /// 刻度（`DATE_FORMAT(date, '%Y-%m-%d')`，永不为 NULL）
    pub period: String,
    /// 该日点击/浏览量合计
    pub click_count: i64,
    /// 该日访客数合计
    pub visitor_count: i64,
}

/// 会员消费排行的一行（`order LEFT JOIN user` 聚合结果）。
///
/// ⚠️ `order_amount` 必须是 `Decimal`（**不得**用 `f64`）。
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RankingRow {
    /// 会员名称（LEFT JOIN 未命中时为 NULL）
    pub username: Option<String>,
    /// 手机号（LEFT JOIN 未命中时为 NULL）
    pub mobile: Option<String>,
    /// 订单数（`COUNT(order.order_id)`）
    pub order_num: i64,
    /// 消费总额（`SUM(order.total_amount)`）
    pub order_amount: Decimal,
}

/// 会员消费排行的取数条件（由服务层把 DTO 翻译好后传入）。
#[derive(Debug, Clone, Default)]
pub struct RankingQuery {
    /// `order.add_time >= start_ts`（秒）
    pub start_ts: Option<i64>,
    /// `order.add_time <= end_ts`（秒）
    pub end_ts: Option<i64>,
    /// `order.shop_id = shop_id`（`Some` 即过滤，含 `0`）
    pub shop_id: Option<i32>,
    /// 关键字（`username LIKE %k%` OR `mobile LIKE %k%`）
    pub keyword: Option<String>,
    /// 排序：`(列名, 是否升序)`；列名只允许是白名单常量
    /// （见 `StatisticsService::ranking_order_by`）
    pub order_by: Option<(&'static str, bool)>,
    /// `LIMIT`
    pub limit: u64,
    /// `OFFSET`
    pub offset: u64,
}

#[derive(Clone)]
pub struct StatisticsRepository {
    pool: MySqlPool,
}

impl StatisticsRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————— 访问量 / 访客数（statistics_base） —————————————————

    /// 按日聚合指定区间内的 `statistics_base`（**精确匹配** `shop_id`）。
    ///
    /// 复刻 Java `StatisticsAccessServiceImpl#getAccessStatistics` 的
    /// `.eq(StatisticsBase::getShopId, shopId)` —— 注意这里是**无条件 eq**，
    /// 与 `StatisticsBaseServiceImpl#getVisitNum` 的「`shop_id > 0` 才过滤」
    /// 是**两套口径**：
    /// - 平台管理员 `HeaderUtils.getShopId()` 返回 `0` ⇒ SQL 变成
    ///   `shop_id = 0`，只会命中显式写成 0 的行（而创建链路写入的是
    ///   `NULL`），因此平台视图恒为空轴 —— 这是 Java 的既有行为，
    ///   本实现逐条复刻，未做「顺手修正」。
    /// - 店铺管理员 ⇒ `shop_id = 该店铺`。
    ///
    /// `shop_id` 为 `NULL` 时 Java 会生成 `shop_id = NULL`（永不命中），
    /// 由服务层直接返回空列表，不必查询。
    pub async fn fetch_daily_visits(
        &self,
        start: &str,
        end: &str,
        shop_id: i32,
    ) -> Result<Vec<DailyVisitRow>> {
        sqlx::query_as::<_, DailyVisitRow>(
            "SELECT DATE_FORMAT(`date`, '%Y-%m-%d') AS period, \
                    CAST(COALESCE(SUM(click_count), 0) AS SIGNED) AS click_count, \
                    CAST(COALESCE(SUM(visitor_count), 0) AS SIGNED) AS visitor_count \
             FROM statistics_base \
             WHERE `date` >= ? AND `date` <= ? AND shop_id = ? \
             GROUP BY period ORDER BY period ASC",
        )
        .bind(start)
        .bind(end)
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 区间内 `statistics_base` 的合计：`(访客数, 浏览量)`。
    ///
    /// 复刻 Java `StatisticsBaseServiceImpl#getVisitNum(data, accessFlag,
    /// productFlag, shopId)` 在 `shopId == 0` 时的口径：
    /// `.eq(shopId > 0, "shop_id", ...)` ⇒ **不加店铺条件**，
    /// 把平台行与各店铺行全部相加（`productFlag` 在 Java 里被完全忽略）。
    ///
    /// 无数据返回 `(0, 0)`（Java 返回 `0`，不返回 `null`）。
    pub async fn sum_visit_counts(&self, start: &str, end: &str) -> Result<(i64, i64)> {
        let row: (i64, i64) = sqlx::query_as(
            "SELECT CAST(COALESCE(SUM(visitor_count), 0) AS SIGNED), \
                    CAST(COALESCE(SUM(click_count), 0) AS SIGNED) \
             FROM statistics_base WHERE `date` >= ? AND `date` <= ?",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row)
    }

    /// 按日聚合指定区间内的 `statistics_base`，**不限店铺**。
    /// 对齐 Java `StatisticsLogServiceImpl#getVisitList` 中
    /// `shopId == 0` 时 `.eq(shopId > 0, "shop_id", ...)` 条件不生效的口径。
    pub async fn fetch_daily_click_counts(&self, start: &str, end: &str) -> Result<Vec<DailyVisitRow>> {
        sqlx::query_as::<_, DailyVisitRow>(
            "SELECT DATE_FORMAT(`date`, '%Y-%m-%d') AS period,                     CAST(COALESCE(SUM(click_count), 0) AS SIGNED) AS click_count,                     CAST(COALESCE(SUM(visitor_count), 0) AS SIGNED) AS visitor_count              FROM statistics_base              WHERE `date` >= ? AND `date` <= ?              GROUP BY period ORDER BY period ASC",
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————— 新增会员（user） —————————————————

    /// 区间内新增会员的 `reg_time`（秒级时间戳）列表，按时间升序。
    ///
    /// 复刻 Java `StatisticsUserServiceImpl#getAddUserTrends` 的
    /// `lambdaQuery().between(regTime, start, end).orderByAsc(regTime)`：
    /// Java 把整批明细捞进内存后按刻度归并（`getLongitudinalAxis`），
    /// 本实现同样只取 `reg_time`（比捞整行更省），归并放服务层做，
    /// 以便离线单测分桶逻辑。
    ///
    /// ⚠️ Java **完全没有** `shop_id` 条件（`query.shopId` 读了但没用），
    /// `user` 表也没有该列。
    pub async fn fetch_user_reg_times(&self, start_ts: i64, end_ts: i64) -> Result<Vec<i64>> {
        let rows: Vec<(i64,)> = sqlx::query_as(
            "SELECT CAST(reg_time AS SIGNED) FROM `user` \
             WHERE reg_time >= ? AND reg_time <= ? ORDER BY reg_time ASC",
        )
        .bind(start_ts)
        .bind(end_ts)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(t,)| t).collect())
    }

    /// 区间内新增会员数（`user.reg_time`，秒级时间戳）。
    ///
    /// 对应 Java `UserMapper.selectCount(new QueryWrapper<User>()
    /// .between("reg_time", toTimestampYmdHms(start + " 00:00:00"),
    /// toTimestampYmdHms(end + " 23:59:59")))`。
    pub async fn count_users_by_reg_time(&self, start_ts: i64, end_ts: i64) -> Result<i64> {
        let (n,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM `user` WHERE reg_time >= ? AND reg_time <= ?",
        )
        .bind(start_ts)
        .bind(end_ts)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(n)
    }

    // ————————————————— 用户统计面板（order / user_recharge_order） —————————————————

    /// 区间内**成交用户数**：`order` 按 `user_id` 去重计数。
    ///
    /// 复刻 Java `OrderMapper.selectCount(... .ge("pay_status",
    /// PaymentStatus.PAID.getCode()).between("pay_time", ...)
    /// .select("distinct user_id"))`：
    /// - `pay_status` 用的是 **`>=`**（≥2：已支付/退款中/已退款都算），不是 `=`；
    /// - 时间列是 **`pay_time`**（不是 `add_time`）；
    /// - 店铺过滤是 **`shop_id > 0`** 才加（与排行接口的 `!= null` 不同）。
    pub async fn count_paid_order_users(
        &self,
        start_ts: i64,
        end_ts: i64,
        shop_id: Option<i32>,
    ) -> Result<i64> {
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(DISTINCT user_id) FROM `order` WHERE pay_status >= ");
        qb.push_bind(PAYMENT_STATUS_PAID);
        if let Some(s) = shop_id.filter(|s| *s > 0) {
            qb.push(" AND shop_id = ");
            qb.push_bind(s);
        }
        qb.push(" AND pay_time >= ");
        qb.push_bind(start_ts);
        qb.push(" AND pay_time <= ");
        qb.push_bind(end_ts);

        let (n,): (i64,) = qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(n)
    }

    /// 区间内**充值用户数**：`user_recharge_order` 按 `user_id` 去重计数。
    ///
    /// 复刻 Java `UserRechargeOrderMapper.selectCount(... between("add_time",...)
    /// .select("distinct user_id"))`：Java **没有**状态过滤，
    /// `user_recharge_order` 也没有 `shop_id` 列。
    pub async fn count_recharge_users(&self, start_ts: i64, end_ts: i64) -> Result<i64> {
        let (n,): (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT user_id) FROM user_recharge_order \
             WHERE add_time >= ? AND add_time <= ?",
        )
        .bind(start_ts)
        .bind(end_ts)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(n)
    }

    // ————————————————— 会员消费排行（order LEFT JOIN user） —————————————————

    /// 会员消费排行（`GROUP BY user_id`）+ 总数，供分页返回。
    ///
    /// 复刻 Java `MPJLambdaWrapper<Order>`：
    /// ```sql
    /// SELECT t1.username, t1.mobile, COUNT(t.order_id) AS order_num,
    ///        SUM(t.total_amount) AS order_amount
    /// FROM `order` t LEFT JOIN `user` t1 ON t1.user_id = t.user_id
    /// WHERE t.pay_status = 2
    ///   [AND t.shop_id = ?]        -- shopId != null 即过滤
    ///   [AND t.add_time >= ?]      -- startTime 非空
    ///   [AND t.add_time <= ?]
    ///   [AND (t1.username LIKE ? OR t1.mobile LIKE ?)]
    /// GROUP BY t1.user_id
    /// [ORDER BY order_num|order_amount ASC|DESC]
    /// ```
    ///
    /// ⚠️ 金额由 SQL 侧 `SUM()` 并落到 `Decimal`，Rust 侧不做浮点累加。
    /// ⚠️ `GROUP BY` 额外带上 `u.username, u.mobile`：`user_id` 在 `user`
    /// 表唯一，分组结果与 Java 的 `GROUP BY user_id` 完全一致，但可避免
    /// 未关闭 `ONLY_FULL_GROUP_BY` 的会话报错。
    /// ⚠️ 未传 `sortField` 时 Java 不加 `ORDER BY`（分页顺序由 MySQL 决定），
    /// 本实现保持一致。
    pub async fn fetch_consumption_ranking(
        &self,
        q: &RankingQuery,
    ) -> Result<(u64, Vec<RankingRow>)> {
        // 总数：与明细同一套 JOIN / WHERE，按 user_id 去重
        let mut cq: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT COUNT(DISTINCT o.user_id) FROM `order` o \
             LEFT JOIN `user` u ON u.user_id = o.user_id WHERE o.pay_status = ",
        );
        cq.push_bind(PAYMENT_STATUS_PAID);
        push_ranking_filters(&mut cq, q);
        let (total,): (i64,) = cq
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT u.username AS username, u.mobile AS mobile, \
                    COUNT(o.order_id) AS order_num, \
                    SUM(o.total_amount) AS order_amount \
             FROM `order` o LEFT JOIN `user` u ON u.user_id = o.user_id \
             WHERE o.pay_status = ",
        );
        qb.push_bind(PAYMENT_STATUS_PAID);
        push_ranking_filters(&mut qb, q);
        qb.push(" GROUP BY o.user_id, u.username, u.mobile");
        if let Some((column, asc)) = q.order_by {
            // `column` 只能来自服务层白名单常量，无注入面
            qb.push(" ORDER BY ");
            qb.push(column);
            qb.push(if asc { " ASC" } else { " DESC" });
        }
        qb.push(" LIMIT ");
        qb.push_bind(q.limit);
        qb.push(" OFFSET ");
        qb.push_bind(q.offset);

        let rows = qb
            .build_query_as::<RankingRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((total.max(0) as u64, rows))
    }
}

/// 追加消费排行的公共过滤条件（明细与计数两条 SQL 必须完全一致）。
fn push_ranking_filters(qb: &mut QueryBuilder<'_, MySql>, q: &RankingQuery) {
    if let Some(s) = q.start_ts {
        qb.push(" AND o.add_time >= ");
        qb.push_bind(s);
    }
    if let Some(e) = q.end_ts {
        qb.push(" AND o.add_time <= ");
        qb.push_bind(e);
    }
    // Java：`eq(shopId != null, shop_id, shopId)` —— Some 即过滤（含 0）
    if let Some(s) = q.shop_id {
        qb.push(" AND o.shop_id = ");
        qb.push_bind(s);
    }
    if let Some(k) = q.keyword.as_deref() {
        let like = format!("%{k}%");
        qb.push(" AND (u.username LIKE ");
        qb.push_bind(like.clone());
        qb.push(" OR u.mobile LIKE ");
        qb.push_bind(like);
        qb.push(")");
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("统计数据不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 金额字段必须是 `Decimal`（不是 f64）——编译期护栏。
    #[test]
    fn ranking_row_amount_is_decimal() {
        let row = RankingRow {
            username: Some("u".into()),
            mobile: None,
            order_num: 3,
            order_amount: "12345.67".parse().expect("合法 Decimal"),
        };
        assert_eq!(row.order_amount.to_string(), "12345.67");
        assert_eq!(row.order_num, 3);
    }

    /// `DailyVisitRow` 的 `period` 一定来自 `DATE_FORMAT`，非空字符串。
    #[test]
    fn daily_visit_row_shape() {
        let row = DailyVisitRow {
            period: "2024-05-01".into(),
            click_count: 10,
            visitor_count: 3,
        };
        assert_eq!(row.period.len(), 10);
        assert!(row.click_count >= row.visitor_count);
    }

    /// `RankingQuery` 默认值应「不过滤、不排序、limit=0」。
    #[test]
    fn ranking_query_default_is_empty() {
        let q = RankingQuery::default();
        assert!(q.start_ts.is_none());
        assert!(q.end_ts.is_none());
        assert!(q.shop_id.is_none());
        assert!(q.keyword.is_none());
        assert!(q.order_by.is_none());
        assert_eq!(q.limit, 0);
        assert_eq!(q.offset, 0);
    }
}