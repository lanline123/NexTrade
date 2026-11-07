//! 优惠券管理域仓储（marketing::coupon_manage）。
//!
//! 涉及表（列名严格对齐 `schema_parser`）：
//! - `coupon`（优惠券）/ `promotion`（营销活动主表，`type = 2 优惠券`）
//! - `coupon_issue_log`（发放日志）/ `coupon_issue_batch`（发放批次）
//! - `user`（会员）/ `user_coupon`（用户券，余量与已用时间）/ `user_member_tag`（标签）/ `user_rank`
//! - `config`（默认头像）
//!
//! 查询统一使用运行时 `sqlx::query_as` / `QueryBuilder`（**不使用** `query!` 宏）。

use rust_decimal::Decimal;
use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::entities::{Coupon, Promotion, UserRank};
use tigshop_core::{Error, Result};

/// 优惠券更新补丁（Java `BeanUtils.copyProperties` + `updateById`
/// 只写非 null 字段；本补丁按「DTO 传了才更新」语义下发）。
#[derive(Debug, Clone, Default)]
pub struct CouponUpdatePatch {
    pub coupon_name: Option<String>,
    pub coupon_money: Option<Decimal>,
    pub coupon_discount: Option<Decimal>,
    pub coupon_desc: Option<String>,
    pub coupon_type: Option<i32>,
    pub send_range: Option<i32>,
    pub send_range_data: Option<String>,
    pub min_order_amount: Option<Decimal>,
    pub send_start_date: Option<i32>,
    pub send_end_date: Option<i32>,
    pub send_type: Option<i32>,
    pub use_day: Option<i32>,
    pub use_start_date: Option<i32>,
    pub use_end_date: Option<i32>,
    pub is_show: Option<i32>,
    pub is_global: Option<i32>,
    pub is_new_user: Option<i32>,
    pub enabled_click_get: Option<i32>,
    pub limit_user_rank: Option<String>,
    pub is_delete: Option<i32>,
    pub limit_num: Option<i32>,
    pub delay_day: Option<i32>,
    pub send_num: Option<i32>,
    pub max_order_amount: Option<Decimal>,
    pub coupon_unit: Option<i32>,
    pub reduce_type: Option<i32>,
    /// 恒更新（Java `dataJudge` 无条件 set）
    pub shop_id: Option<i32>,
}

/// 发放日志联表行。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct IssueLogRow {
    pub id: i64,
    pub batch_id: i64,
    pub coupon_id: i32,
    pub coupon_name: Option<String>,
    pub user_coupon_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub mobile: Option<String>,
    pub avatar: Option<String>,
    pub issue_time: i64,
    pub source_type: i32,
    pub used_time: Option<i64>,
}

/// 发放批次联表行。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct IssueBatchRow {
    pub id: i64,
    pub coupon_id: i32,
    pub coupon_name: Option<String>,
    pub user_count: i32,
    pub coupon_count: i32,
    pub issue_time: i64,
    pub source_type: i32,
}

/// 优惠券管理域仓储（持有连接池）。
#[derive(Clone)]
pub struct CouponManageRepository {
    pool: MySqlPool,
}

impl CouponManageRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（与其它仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 开启事务（create/update/del/batch 的 coupon + promotion 双写）。
    pub async fn begin(&self) -> Result<sqlx::Transaction<'static, MySql>> {
        self.pool.begin().await.map_err(map_err)
    }

    // ————————————————————— 优惠券读写 —————————————————————

    /// 按主键查优惠券（Java `getById`，**不过滤 is_delete**）。
    pub async fn find_coupon(&self, id: i32) -> Result<Option<Coupon>> {
        sqlx::query_as::<_, Coupon>("SELECT * FROM coupon WHERE coupon_id = ? LIMIT 1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 插入优惠券（Java `this.save(coupon)`），返回自增 id。
    pub async fn insert_coupon_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        c: &Coupon,
    ) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO coupon
               (coupon_name, coupon_money, coupon_discount, coupon_desc, coupon_type,
                send_range, send_range_data, min_order_amount, send_start_date,
                send_end_date, send_type, use_day, use_start_date, use_end_date,
                is_show, is_global, is_new_user, enabled_click_get, limit_user_rank,
                shop_id, is_delete, limit_num, delay_day, send_num, max_order_amount,
                coupon_unit, reduce_type, add_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&c.coupon_name)
        .bind(c.coupon_money)
        .bind(c.coupon_discount)
        .bind(&c.coupon_desc)
        .bind(c.coupon_type)
        .bind(c.send_range)
        .bind(&c.send_range_data)
        .bind(c.min_order_amount)
        .bind(c.send_start_date)
        .bind(c.send_end_date)
        .bind(c.send_type)
        .bind(c.use_day)
        .bind(c.use_start_date)
        .bind(c.use_end_date)
        .bind(c.is_show)
        .bind(c.is_global)
        .bind(c.is_new_user)
        .bind(c.enabled_click_get)
        .bind(&c.limit_user_rank)
        .bind(c.shop_id)
        .bind(c.is_delete)
        .bind(c.limit_num)
        .bind(c.delay_day)
        .bind(c.send_num)
        .bind(c.max_order_amount)
        .bind(c.coupon_unit)
        .bind(c.reduce_type)
        .bind(c.add_time)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 按补丁更新优惠券（Java `updateById`：只写非 null 字段）。
    pub async fn update_coupon_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        id: i32,
        patch: &CouponUpdatePatch,
    ) -> Result<bool> {
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new("UPDATE coupon SET coupon_id = ");
        qb.push_bind(id);
        let mut sep = qb.separated(", ");
        if let Some(v) = &patch.coupon_name {
            sep.push("coupon_name = ").push_bind_unseparated(v.clone());
        }
        if let Some(v) = patch.coupon_money {
            sep.push("coupon_money = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.coupon_discount {
            sep.push("coupon_discount = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.coupon_desc {
            sep.push("coupon_desc = ").push_bind_unseparated(v.clone());
        }
        if let Some(v) = patch.coupon_type {
            sep.push("coupon_type = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.send_range {
            sep.push("send_range = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.send_range_data {
            sep.push("send_range_data = ").push_bind_unseparated(v.clone());
        }
        if let Some(v) = patch.min_order_amount {
            sep.push("min_order_amount = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.send_start_date {
            sep.push("send_start_date = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.send_end_date {
            sep.push("send_end_date = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.send_type {
            sep.push("send_type = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.use_day {
            sep.push("use_day = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.use_start_date {
            sep.push("use_start_date = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.use_end_date {
            sep.push("use_end_date = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.is_show {
            sep.push("is_show = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.is_global {
            sep.push("is_global = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.is_new_user {
            sep.push("is_new_user = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.enabled_click_get {
            sep.push("enabled_click_get = ").push_bind_unseparated(v);
        }
        if let Some(v) = &patch.limit_user_rank {
            sep.push("limit_user_rank = ").push_bind_unseparated(v.clone());
        }
        if let Some(v) = patch.is_delete {
            sep.push("is_delete = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.limit_num {
            sep.push("limit_num = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.delay_day {
            sep.push("delay_day = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.send_num {
            sep.push("send_num = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.max_order_amount {
            sep.push("max_order_amount = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.coupon_unit {
            sep.push("coupon_unit = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.reduce_type {
            sep.push("reduce_type = ").push_bind_unseparated(v);
        }
        if let Some(v) = patch.shop_id {
            sep.push("shop_id = ").push_bind_unseparated(v);
        }
        drop(sep);
        qb.push(" WHERE coupon_id = ").push_bind(id);
        let affected = qb
            .build()
            .execute(&mut **tx)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected > 0)
    }

    /// 单个字段更新（Java `updateField`：白名单列 + 字符串值）。
    pub async fn update_coupon_field(
        &self,
        id: i32,
        column: &'static str,
        value: &str,
    ) -> Result<bool> {
        let sql = format!("UPDATE coupon SET {column} = ? WHERE coupon_id = ?");
        let affected = sqlx::query(&sql)
            .bind(value)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected > 0)
    }

    /// 批量软删除优惠券（Java `batch`：`is_delete = 1`）。
    pub async fn soft_delete_coupons_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        ids: &[i32],
    ) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("UPDATE coupon SET is_delete = 1 WHERE coupon_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build()
            .execute(&mut **tx)
            .await
            .map_err(map_err)
            .map(|r| r.rows_affected())
    }

    // ————————————————————— promotion 主表 —————————————————————

    /// 统计优惠券对应的营销活动数（Java `promotionService.count`）。
    pub async fn count_promotion_row(&self, relation_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM promotion WHERE relation_id = ? AND type = 2",
        )
        .bind(relation_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 插入营销活动（Java `promotionService.save`）。
    pub async fn insert_promotion_row_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        row: &Promotion,
    ) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO promotion
               (promotion_name, start_time, end_time, type, shop_id, relation_id,
                `range`, range_data, is_available, member_range, member_marks, member_scope)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&row.promotion_name)
        .bind(row.start_time)
        .bind(row.end_time)
        .bind(row.r#type)
        .bind(row.shop_id)
        .bind(row.relation_id)
        .bind(row.range)
        .bind(&row.range_data)
        .bind(row.is_available)
        .bind(row.member_range)
        .bind(&row.member_marks)
        .bind(&row.member_scope)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 更新营销活动（Java `savePromotion` 的 `promotionService.update` 分支）。
    pub async fn update_promotion_row_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        relation_id: i32,
        row: &Promotion,
    ) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE promotion SET promotion_name = ?, start_time = ?, end_time = ?,
               is_available = ?, range = ?, range_data = ?, member_range = ?,
               member_marks = ?, member_scope = ?
             WHERE relation_id = ? AND type = 2",
        )
        .bind(&row.promotion_name)
        .bind(row.start_time)
        .bind(row.end_time)
        .bind(row.is_available)
        .bind(row.range)
        .bind(&row.range_data)
        .bind(row.member_range)
        .bind(&row.member_marks)
        .bind(&row.member_scope)
        .bind(relation_id)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 批量软删除营销活动（Java `savePromotion` 的删除分支：`is_delete = 1`）。
    pub async fn soft_delete_promotions_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        relation_ids: &[i32],
    ) -> Result<u64> {
        if relation_ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "UPDATE promotion SET is_delete = 1 WHERE type = 2 AND relation_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in relation_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build()
            .execute(&mut **tx)
            .await
            .map_err(map_err)
            .map(|r| r.rows_affected())
    }

    // ————————————————————— 配置 / 会员等级 —————————————————————

    /// 全部会员等级（Java `userRankService.list()`）。
    pub async fn list_user_ranks(&self) -> Result<Vec<UserRank>> {
        sqlx::query_as::<_, UserRank>("SELECT * FROM user_rank")
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 每级正式会员数（Java `select rank_id, COUNT(*) ... user_type = 0 group by rank_id`）。
    pub async fn count_users_by_rank(&self) -> Result<Vec<(i32, i64)>> {
        let rows: Vec<(i32, i64)> = sqlx::query_as(
            "SELECT rank_id, COUNT(*) FROM user WHERE user_type = 0 GROUP BY rank_id",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows)
    }

    /// 默认头像配置（Java `configService.getConfigByCode(DEFAULT_AVATAR)`）。
    pub async fn find_default_avatar(&self) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND is_del = 0 LIMIT 1",
        )
        .bind("defaultAvatar")
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|(value,)| value))
    }

    // ————————————————————— 发放日志 / 批次 —————————————————————

    /// 发放日志分页（Java `CouponIssueLogServiceImpl#list`，联表 coupon/user/user_coupon）。
    pub async fn paginate_issue_logs(
        &self,
        coupon_id: Option<i32>,
        batch_id: Option<i64>,
        user_id: Option<i32>,
        source_type: Option<i32>,
        page: u64,
        size: u64,
    ) -> Result<(u64, Vec<IssueLogRow>)> {
        let mut count_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM coupon_issue_log l WHERE 1 = 1");
        if let Some(v) = coupon_id {
            count_qb.push(" AND l.coupon_id = ").push_bind(v);
        }
        if let Some(v) = batch_id {
            count_qb.push(" AND l.batch_id = ").push_bind(v);
        }
        if let Some(v) = user_id {
            count_qb.push(" AND l.user_id = ").push_bind(v);
        }
        if let Some(v) = source_type {
            count_qb.push(" AND l.source_type = ").push_bind(v);
        }
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT l.id, l.batch_id, l.coupon_id, c.coupon_name, l.user_coupon_id,
                    l.user_id, u.username, u.nickname, u.mobile, u.avatar,
                    l.issue_time, l.source_type, uc.used_time
             FROM coupon_issue_log l
             LEFT JOIN coupon c ON c.coupon_id = l.coupon_id
             LEFT JOIN user u ON u.user_id = l.user_id
             LEFT JOIN user_coupon uc ON uc.id = l.user_coupon_id
             WHERE 1 = 1",
        );
        if let Some(v) = coupon_id {
            qb.push(" AND l.coupon_id = ").push_bind(v);
        }
        if let Some(v) = batch_id {
            qb.push(" AND l.batch_id = ").push_bind(v);
        }
        if let Some(v) = user_id {
            qb.push(" AND l.user_id = ").push_bind(v);
        }
        if let Some(v) = source_type {
            qb.push(" AND l.source_type = ").push_bind(v);
        }
        qb.push(" ORDER BY l.issue_time DESC LIMIT ")
            .push_bind(size as i64)
            .push(" OFFSET ")
            .push_bind(((page - 1) * size) as i64);
        let rows = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 发放批次分页（Java `CouponIssueBatchServiceImpl#list`，联表 coupon）。
    pub async fn paginate_issue_batches(
        &self,
        coupon_id: Option<i32>,
        source_type: Option<i32>,
        page: u64,
        size: u64,
    ) -> Result<(u64, Vec<IssueBatchRow>)> {
        let mut count_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM coupon_issue_batch b WHERE 1 = 1");
        if let Some(v) = coupon_id {
            count_qb.push(" AND b.coupon_id = ").push_bind(v);
        }
        if let Some(v) = source_type {
            count_qb.push(" AND b.source_type = ").push_bind(v);
        }
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT b.id, b.coupon_id, c.coupon_name, b.user_count, b.coupon_count,
                    b.issue_time, b.source_type
             FROM coupon_issue_batch b
             LEFT JOIN coupon c ON c.coupon_id = b.coupon_id
             WHERE 1 = 1",
        );
        if let Some(v) = coupon_id {
            qb.push(" AND b.coupon_id = ").push_bind(v);
        }
        if let Some(v) = source_type {
            qb.push(" AND b.source_type = ").push_bind(v);
        }
        qb.push(" ORDER BY b.issue_time DESC LIMIT ")
            .push_bind(size as i64)
            .push(" OFFSET ")
            .push_bind(((page - 1) * size) as i64);
        let rows = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    // ————————————————————— 手动发放目标解析 —————————————————————

    /// 按用户 id 批量取正式会员（Java `selectBatchIds` + `user_type = MEMBER`）。
    pub async fn find_member_users_by_ids(
        &self,
        ids: &[i32],
    ) -> Result<Vec<tigshop_core::models::marketing::coupon_manage::TargetUser>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT user_id, nickname, mobile, status FROM user \
             WHERE user_type = 0 AND user_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let rows: Vec<(i32, Option<String>, String, Option<i32>)> =
            qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(
                |(user_id, nickname, mobile, status)| {
                    tigshop_core::models::marketing::coupon_manage::TargetUser {
                        user_id,
                        nickname: nickname.unwrap_or_default(),
                        mobile,
                        status: status.unwrap_or(0),
                    }
                },
            )
            .collect())
    }

    /// 按会员等级取正式会员（Java `in(rank_id, ...).eq(user_type, MEMBER)`）。
    pub async fn find_member_users_by_ranks(
        &self,
        rank_ids: &[i32],
    ) -> Result<Vec<tigshop_core::models::marketing::coupon_manage::TargetUser>> {
        if rank_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT user_id, nickname, mobile, status FROM user \
             WHERE user_type = 0 AND rank_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in rank_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let rows: Vec<(i32, Option<String>, String, Option<i32>)> =
            qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(
                |(user_id, nickname, mobile, status)| {
                    tigshop_core::models::marketing::coupon_manage::TargetUser {
                        user_id,
                        nickname: nickname.unwrap_or_default(),
                        mobile,
                        status: status.unwrap_or(0),
                    }
                },
            )
            .collect())
    }

    /// 按会员标签解析用户 id（Java `UserMemberTagService#resolveUserIdsByTags`）：
    /// `match_all = 0` 满足任一；`1` 满足全部。
    pub async fn resolve_user_ids_by_tags(
        &self,
        tag_ids: &[i64],
        match_all: bool,
    ) -> Result<Vec<i32>> {
        if tag_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT DISTINCT user_id FROM user_member_tag WHERE tag_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in tag_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        if match_all {
            qb.push(" GROUP BY user_id HAVING COUNT(DISTINCT tag_id) = ")
                .push_bind(tag_ids.len() as i64);
        }
        let rows: Vec<(i64,)> = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows
            .into_iter()
            .filter_map(|(id,)| i32::try_from(id).ok())
            .collect())
    }

    /// 已发放张数（Java `getRemainingIssueCount` 的 `user_coupon` 计数）。
    pub async fn count_user_coupons(&self, coupon_id: i32) -> Result<i64> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM user_coupon WHERE coupon_id = ?")
                .bind(coupon_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("优惠券数据不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 更新补丁默认为空：不产生任何 SET 列（对应 Java `updateById` 全 null 场景）。
    #[test]
    fn empty_patch_has_no_updates() {
        let patch = CouponUpdatePatch::default();
        assert!(patch.coupon_name.is_none());
        assert!(patch.shop_id.is_none());
    }

    /// 发放日志联表行字段与 VO 对齐（FromRow 前提）。
    #[test]
    fn issue_log_row_fields_exist() {
        let row = IssueLogRow {
            id: 1,
            batch_id: 2,
            coupon_id: 3,
            coupon_name: Some("券".into()),
            user_coupon_id: 4,
            user_id: 5,
            username: Some("u".into()),
            nickname: Some("n".into()),
            mobile: Some("138".into()),
            avatar: None,
            issue_time: 100,
            source_type: 2,
            used_time: Some(0),
        };
        assert_eq!(row.source_type, 2);
        assert_eq!(row.used_time, Some(0));
    }

    #[test]
    fn issue_batch_row_fields_exist() {
        let row = IssueBatchRow {
            id: 1,
            coupon_id: 2,
            coupon_name: None,
            user_count: 3,
            coupon_count: 3,
            issue_time: 4,
            source_type: 2,
        };
        assert_eq!(row.coupon_count, 3);
    }
}
