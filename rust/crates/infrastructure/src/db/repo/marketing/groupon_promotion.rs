//! 拼团活动域仓储（marketing::groupon_promotion）。
//!
//! 涉及表（列名严格对齐 `schema_parser`）：
//! - `groupon_promotion`（活动）/ `groupon_promotion_item`（活动商品）/
//!   `groupon_promotion_detail`（拼团价明细）/ `groupon_promotion_record`（成团记录）/
//!   `groupon_promotion_shops`（适用店铺）
//! - `promotion`（营销活动主表，`type = 7 拼团`）/ `product` / `product_sku` / `shop` / `user`
//! - `config`（`h5Domain` 推广域名）
//!
//! 查询统一使用运行时 `sqlx::query_as` / `QueryBuilder`（**不使用** `query!` 宏）。
//!
//! # 事务
//!
//! Java `create` / `update` / `finish` / `del` 均为 `@Transactional`
//! （拼团活动 + promotion 主表 + 适用店铺三处写入）。本仓储提供
//! [`GrouponPromotionRepository::begin`] + `*_in_tx` 方法，由服务层编排事务。
//!
//! # 与 Java 的差异
//!
//! - Java 列表 SQL（`GrouponPromotionMapper.xml`）里商品名筛选写作 `p.name`，
//!   但 `product` 表真实列是 `product_name`（XML 为历史笔误）；本实现用
//!   `p.product_name`，避免 SQL 报错（见 `uncertain_points`）。
//! - 客户端列表 XML 无 `GROUP BY`，join 商品会产生重复活动行；本实现只查
//!   `groupon_promotion`（过滤条件不涉及商品列），避免重复行。

use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::entities::{
    GrouponPromotion, GrouponPromotionDetail, GrouponPromotionItem, GrouponPromotionRecord,
    GrouponPromotionShops, Promotion, Shop,
};
use tigshop_core::models::marketing::groupon_promotion::promotion_sort_column;
use tigshop_core::{Error, Result};

/// `product` 列表/详情所需列（避免 `SELECT *` 拉 81 列）。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct ProductRow {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_price: rust_decimal::Decimal,
    pub product_brief: String,
    pub pic_url: String,
    pub pic_thumb: String,
    pub virtual_sales: i32,
}

/// 管理端拼团分页筛选（对应 Java `GrouponPromotionPageQuery` + `list` XML）。
#[derive(Debug, Clone, Default)]
pub struct AdminPromotionListFilter {
    pub groupon_name: Option<String>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub shop_id: Option<i32>,
    pub status: Option<i32>,
    /// Java `searchStatusTime`（`queryData()` 在 status 非空时写入当前秒）
    pub search_status_time: i64,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub group_type: Option<i32>,
    pub sort_column: &'static str,
    pub sort_asc: bool,
    pub page: u64,
    pub size: u64,
}

/// 客户端拼团分页筛选（对应 Java `GrouponPromotionClientPageQuery` + `clientList` XML）。
#[derive(Debug, Clone, Default)]
pub struct ClientPromotionListFilter {
    pub groupon_name: Option<String>,
    pub status: Option<i32>,
    pub search_status_time: i64,
    pub sort_column: &'static str,
    pub sort_asc: bool,
    pub page: u64,
    pub size: u64,
}

/// 客户端拼团商品分页筛选（对应 Java `GrouponItemPageQuery` + `itemList`）。
#[derive(Debug, Clone, Default)]
pub struct GrouponItemListFilter {
    /// 允许的拼团活动 id（用户标识过滤后的可见活动）
    pub allowed_ids: Vec<i64>,
    pub keyword: Option<String>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub page: u64,
    pub size: u64,
}

/// 拼团活动域仓储（持有连接池）。
#[derive(Clone)]
pub struct GrouponPromotionRepository {
    pool: MySqlPool,
}

impl GrouponPromotionRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（与其它仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 开启事务（服务层编排 create/update/finish/del 的多表写入）。
    pub async fn begin(&self) -> Result<sqlx::Transaction<'static, MySql>> {
        self.pool.begin().await.map_err(map_err)
    }

    // ————————————————————— groupon_promotion 读写 —————————————————————

    /// 按主键查拼团活动（Java `this.getById`）。
    pub async fn find_promotion(&self, id: i64) -> Result<Option<GrouponPromotion>> {
        sqlx::query_as::<_, GrouponPromotion>(
            "SELECT * FROM groupon_promotion WHERE groupon_promotion_id = ? LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 事务内按主键查拼团活动。
    pub async fn find_promotion_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        id: i64,
    ) -> Result<Option<GrouponPromotion>> {
        sqlx::query_as::<_, GrouponPromotion>(
            "SELECT * FROM groupon_promotion WHERE groupon_promotion_id = ? LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(map_err)
    }

    /// 插入拼团活动（Java `this.save(grouponPromotion)`），返回自增 id。
    pub async fn insert_promotion_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        p: &GrouponPromotion,
    ) -> Result<i64> {
        let res = sqlx::query(
            "INSERT INTO groupon_promotion
               (name, start_time, end_time, group_type, expiration_time,
                groupon_image, pc_groupon_image, share_image, groupon_explain,
                shop_id, add_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.name)
        .bind(p.start_time)
        .bind(p.end_time)
        .bind(p.group_type)
        .bind(p.expiration_time)
        .bind(&p.groupon_image)
        .bind(&p.pc_groupon_image)
        .bind(&p.share_image)
        .bind(&p.groupon_explain)
        .bind(p.shop_id)
        .bind(p.add_time)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(i64::try_from(res.last_insert_id()).unwrap_or(i64::MAX))
    }

    /// 更新拼团活动（Java `this.updateById(grouponPromotion)`）。
    ///
    /// ⚠️ Java 的 `buildGrouponPromotion()` 会把 `addTime` 重新赋值为当前时间，
    /// 因此 `updateById` 也会覆盖 `add_time`；本实现保持一致。
    pub async fn update_promotion_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        p: &GrouponPromotion,
    ) -> Result<bool> {
        let affected = sqlx::query(
            "UPDATE groupon_promotion SET name = ?, start_time = ?, end_time = ?,
               group_type = ?, expiration_time = ?, groupon_image = ?,
               pc_groupon_image = ?, share_image = ?, groupon_explain = ?,
               shop_id = ?, add_time = ?
             WHERE groupon_promotion_id = ?",
        )
        .bind(&p.name)
        .bind(p.start_time)
        .bind(p.end_time)
        .bind(p.group_type)
        .bind(p.expiration_time)
        .bind(&p.groupon_image)
        .bind(&p.pc_groupon_image)
        .bind(&p.share_image)
        .bind(&p.groupon_explain)
        .bind(p.shop_id)
        .bind(p.add_time)
        .bind(p.groupon_promotion_id)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected > 0)
    }

    /// 删除拼团活动（Java `this.removeById(id)`）。
    pub async fn delete_promotion_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        id: i64,
    ) -> Result<bool> {
        let affected = sqlx::query("DELETE FROM groupon_promotion WHERE groupon_promotion_id = ?")
            .bind(id)
            .execute(&mut **tx)
            .await
            .map_err(map_err)?
            .rows_affected();
        Ok(affected > 0)
    }

    /// 仅更新结束时间（Java `finish`：`updateById` 后只改 `end_time`，
    /// 本方法等价于「加载实体现值 + 更新」）。
    pub async fn update_promotion_end_time(
        &self,
        id: i64,
        end_time: i64,
    ) -> Result<bool> {
        let affected =
            sqlx::query("UPDATE groupon_promotion SET end_time = ? WHERE groupon_promotion_id = ?")
                .bind(end_time)
                .bind(id)
                .execute(&self.pool)
                .await
                .map_err(map_err)?
                .rows_affected();
        Ok(affected > 0)
    }

    // ————————————————————— 列表查询 —————————————————————

    /// 管理端拼团分页（Java `GrouponPromotionMapper#list` + `buildSortOrder`）。
    pub async fn paginate_promotions(
        &self,
        f: &AdminPromotionListFilter,
    ) -> Result<(u64, Vec<GrouponPromotion>)> {
        let mut count_qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT COUNT(DISTINCT gp.groupon_promotion_id) FROM groupon_promotion gp \
             LEFT JOIN groupon_promotion_item gpi \
               ON gp.groupon_promotion_id = gpi.groupon_promotion_id \
             LEFT JOIN product p ON gpi.product_id = p.product_id WHERE 1 = 1",
        );
        Self::push_admin_filters(&mut count_qb, f);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT gp.* FROM groupon_promotion gp \
             LEFT JOIN groupon_promotion_item gpi \
               ON gp.groupon_promotion_id = gpi.groupon_promotion_id \
             LEFT JOIN product p ON gpi.product_id = p.product_id WHERE 1 = 1",
        );
        Self::push_admin_filters(&mut row_qb, f);
        row_qb.push(" GROUP BY gp.groupon_promotion_id ORDER BY gp.");
        row_qb.push(f.sort_column);
        row_qb.push(if f.sort_asc { " ASC" } else { " DESC" });
        row_qb.push(" LIMIT ").push_bind(f.size as i64);
        row_qb
            .push(" OFFSET ")
            .push_bind(((f.page - 1) * f.size) as i64);
        let rows = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 管理端列表 WHERE 片段（COUNT 与行查询共用）。
    fn push_admin_filters(qb: &mut QueryBuilder<'_, MySql>, f: &AdminPromotionListFilter) {
        if let Some(name) = f.groupon_name.as_deref().filter(|v| !v.is_empty()) {
            qb.push(" AND gp.name LIKE ").push_bind(format!("%{name}%"));
        }
        // 注：Java XML 写作 `p.name`（product 表无该列），本实现用真实列 `product_name`
        if let Some(name) = f.product_name.as_deref().filter(|v| !v.is_empty()) {
            qb.push(" AND p.product_name LIKE ")
                .push_bind(format!("%{name}%"));
        }
        if let Some(sn) = f.product_sn.as_deref().filter(|v| !v.is_empty()) {
            qb.push(" AND p.product_sn LIKE ")
                .push_bind(format!("%{sn}%"));
        }
        if let Some(shop_id) = f.shop_id {
            qb.push(" AND gp.shop_id = ").push_bind(shop_id);
        }
        if let Some(group_type) = f.group_type {
            qb.push(" AND gp.group_type = ").push_bind(group_type);
        }
        match f.status {
            Some(1) => {
                qb.push(" AND ")
                    .push_bind(f.search_status_time)
                    .push(" >= gp.start_time AND ")
                    .push_bind(f.search_status_time)
                    .push(" <= gp.end_time");
            }
            Some(2) => {
                qb.push(" AND gp.end_time < ")
                    .push_bind(f.search_status_time);
            }
            Some(3) => {
                qb.push(" AND gp.start_time > ")
                    .push_bind(f.search_status_time);
            }
            _ => {}
        }
        // Java XML：startTime 非空 → `gp.start_time <= endTime`；endTime 非空 → `gp.end_time >= startTime`
        if let Some(end_time) = f.end_time {
            qb.push(" AND gp.start_time <= ").push_bind(end_time);
        }
        if let Some(start_time) = f.start_time {
            qb.push(" AND gp.end_time >= ").push_bind(start_time);
        }
    }

    /// 客户端拼团分页（Java `GrouponPromotionMapper#clientList`）。
    pub async fn paginate_client_promotions(
        &self,
        f: &ClientPromotionListFilter,
    ) -> Result<(u64, Vec<GrouponPromotion>)> {
        let mut count_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM groupon_promotion gp WHERE 1 = 1");
        Self::push_client_filters(&mut count_qb, f);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT gp.* FROM groupon_promotion gp WHERE 1 = 1");
        Self::push_client_filters(&mut row_qb, f);
        row_qb.push(" ORDER BY gp.").push(f.sort_column);
        row_qb.push(if f.sort_asc { " ASC" } else { " DESC" });
        row_qb.push(" LIMIT ").push_bind(f.size as i64);
        row_qb
            .push(" OFFSET ")
            .push_bind(((f.page - 1) * f.size) as i64);
        let rows = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    fn push_client_filters(qb: &mut QueryBuilder<'_, MySql>, f: &ClientPromotionListFilter) {
        if let Some(name) = f.groupon_name.as_deref().filter(|v| !v.is_empty()) {
            qb.push(" AND gp.name LIKE ").push_bind(format!("%{name}%"));
        }
        match f.status {
            Some(1) => {
                qb.push(" AND gp.start_time >= ")
                    .push_bind(f.search_status_time)
                    .push(" AND gp.end_time <= ")
                    .push_bind(f.search_status_time);
            }
            Some(2) => {
                qb.push(" AND gp.end_time < ")
                    .push_bind(f.search_status_time);
            }
            Some(3) => {
                qb.push(" AND gp.start_time > ")
                    .push_bind(f.search_status_time);
            }
            _ => {}
        }
    }

    /// 进行中的拼团活动（`start_time <= now <= end_time`，图片列表用，按开始时间倒序）。
    pub async fn paginate_ongoing_promotions(
        &self,
        now: i64,
        page: u64,
        size: u64,
    ) -> Result<(u64, Vec<GrouponPromotion>)> {
        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM groupon_promotion WHERE start_time <= ? AND end_time >= ?",
        )
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        let rows = sqlx::query_as::<_, GrouponPromotion>(
            "SELECT * FROM groupon_promotion WHERE start_time <= ? AND end_time >= ? \
             ORDER BY start_time DESC LIMIT ? OFFSET ?",
        )
        .bind(now)
        .bind(now)
        .bind(size as i64)
        .bind(((page - 1) * size) as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 当前生效的拼团活动（`start_time < now && end_time > now`，严格不等式）。
    pub async fn list_active_promotions(&self, now: i64) -> Result<Vec<GrouponPromotion>> {
        sqlx::query_as::<_, GrouponPromotion>(
            "SELECT * FROM groupon_promotion WHERE start_time < ? AND end_time > ?",
        )
        .bind(now)
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 未结束的拼团活动（`end_time >= now`，客户端商品列表用户过滤用）。
    pub async fn list_not_ended_promotions(&self, now: i64) -> Result<Vec<GrouponPromotion>> {
        sqlx::query_as::<_, GrouponPromotion>(
            "SELECT * FROM groupon_promotion WHERE end_time >= ?",
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 适用店铺 —————————————————————

    /// 查适用店铺绑定（Java `selectOne(eq(grouponPromotionId))`）。
    pub async fn find_shop_binding(
        &self,
        promotion_id: i64,
    ) -> Result<Option<GrouponPromotionShops>> {
        sqlx::query_as::<_, GrouponPromotionShops>(
            "SELECT * FROM groupon_promotion_shops WHERE groupon_promotion_id = ? LIMIT 1",
        )
        .bind(i32::try_from(promotion_id).unwrap_or(i32::MAX))
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 事务内统计适用店铺绑定数（Java `selectCount`）。
    pub async fn count_shop_binding_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        promotion_id: i64,
    ) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM groupon_promotion_shops WHERE groupon_promotion_id = ?",
        )
        .bind(i32::try_from(promotion_id).unwrap_or(i32::MAX))
        .fetch_one(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 事务内插入适用店铺。
    pub async fn insert_shop_binding_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        binding: &GrouponPromotionShops,
    ) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO groupon_promotion_shops (groupon_promotion_id, shop_ids) VALUES (?, ?)",
        )
        .bind(binding.groupon_promotion_id)
        .bind(&binding.shop_ids)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 事务内更新适用店铺（Java `update(entity, eq(grouponPromotionId))`）。
    pub async fn update_shop_binding_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        binding: &GrouponPromotionShops,
    ) -> Result<bool> {
        let affected = sqlx::query(
            "UPDATE groupon_promotion_shops SET shop_ids = ? WHERE groupon_promotion_id = ?",
        )
        .bind(&binding.shop_ids)
        .bind(binding.groupon_promotion_id)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected > 0)
    }

    /// 全部店铺 id（Java `shopMapper.selectList(...)`，create 的 `-1` 分支用）。
    pub async fn find_all_shop_ids(&self) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as("SELECT shop_id FROM shop")
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 批量查店铺（详情适用组织）。
    pub async fn find_shops(&self, ids: &[i32]) -> Result<Vec<Shop>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT * FROM shop WHERE shop_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 按主键查店铺（客户端详情/列表回填店铺名）。
    pub async fn find_shop(&self, shop_id: i32) -> Result<Option<Shop>> {
        sqlx::query_as::<_, Shop>("SELECT * FROM shop WHERE shop_id = ? LIMIT 1")
            .bind(shop_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 批量查店铺标题（列表回填 `shopName`，避免 N+1）。
    pub async fn find_shop_titles(&self, ids: &[i32]) -> Result<Vec<(i32, Option<String>)>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT shop_id, shop_title FROM shop WHERE shop_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    // ————————————————————— promotion 主表 —————————————————————

    /// 插入营销活动主表（Java `savePromotion`），返回自增 id。
    pub async fn insert_promotion_row_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        row: &Promotion,
    ) -> Result<i32> {
        let res = sqlx::query(
            // `range` 是 MySQL 8 保留字，必须加反引号（同表的 `type` 同理，历史写法已带引号时可保持）
            "INSERT INTO promotion
               (promotion_name, start_time, end_time, `type`, shop_id, relation_id,
                `range`, member_range, member_marks, member_scope)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&row.promotion_name)
        .bind(row.start_time)
        .bind(row.end_time)
        .bind(row.r#type)
        .bind(row.shop_id)
        .bind(row.relation_id)
        .bind(row.range)
        .bind(row.member_range)
        .bind(&row.member_marks)
        .bind(&row.member_scope)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 事务内无条件更新营销活动（Java `updatePromotion`：人群三字段必须无条件 set）。
    pub async fn update_promotion_row_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        relation_id: i64,
        row: &Promotion,
    ) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE promotion SET promotion_name = ?, start_time = ?, end_time = ?,
               member_range = ?, member_marks = ?, member_scope = ?
             WHERE relation_id = ? AND type = ?",
        )
        .bind(&row.promotion_name)
        .bind(row.start_time)
        .bind(row.end_time)
        .bind(row.member_range)
        .bind(&row.member_marks)
        .bind(&row.member_scope)
        .bind(i32::try_from(relation_id).unwrap_or(i32::MAX))
        .bind(row.r#type)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 事务内仅更新结束时间（Java `finish` 的 promotion 更新）。
    pub async fn update_promotion_row_end_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        relation_id: i64,
        end_time: i32,
    ) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE promotion SET end_time = ? WHERE relation_id = ? AND type = ?",
        )
        .bind(end_time)
        .bind(i32::try_from(relation_id).unwrap_or(i32::MAX))
        .bind(7_i32)
        .execute(&mut **tx)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 事务内删除营销活动（Java `promotionMapper.delete(relationId, type)`）。
    pub async fn delete_promotion_row_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, MySql>,
        relation_id: i64,
    ) -> Result<u64> {
        let affected =
            sqlx::query("DELETE FROM promotion WHERE relation_id = ? AND type = ?")
                .bind(i32::try_from(relation_id).unwrap_or(i32::MAX))
                .bind(7_i32)
                .execute(&mut **tx)
                .await
                .map_err(map_err)?
                .rows_affected();
        Ok(affected)
    }

    /// 查营销活动（Java `selectOne(relationId, type).last("limit 1")`；`.one()` 多行会抛异常）。
    pub async fn find_promotion_row(&self, relation_id: i64) -> Result<Option<Promotion>> {
        sqlx::query_as::<_, Promotion>(
            "SELECT * FROM promotion WHERE relation_id = ? AND type = ? LIMIT 1",
        )
        .bind(i32::try_from(relation_id).unwrap_or(i32::MAX))
        .bind(7_i32)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 批量查营销活动（用户标识过滤用）。
    pub async fn find_promotion_rows(&self, relation_ids: &[i64]) -> Result<Vec<Promotion>> {
        if relation_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT * FROM promotion WHERE type = 7 AND relation_id IN (");
        let mut sep = qb.separated(", ");
        for id in relation_ids {
            sep.push_bind(i32::try_from(*id).unwrap_or(i32::MAX));
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 批量按主键查拼团活动（客户端列表/详情回填、活动重开冲突检查）。
    pub async fn find_promotions_by_ids(&self, ids: &[i64]) -> Result<Vec<GrouponPromotion>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT * FROM groupon_promotion WHERE groupon_promotion_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    // ————————————————————— 商品 / 拼团明细 / 记录 —————————————————————

    /// 拼团商品分页（Java `itemList` 的 MPJ 查询）。
    pub async fn paginate_items(
        &self,
        f: &GrouponItemListFilter,
        now: i64,
    ) -> Result<(u64, Vec<GrouponPromotionItem>)> {
        if f.allowed_ids.is_empty() {
            return Ok((0, Vec::new()));
        }
        let mut count_qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT COUNT(*) FROM groupon_promotion_item gpi \
             JOIN product p ON p.product_id = gpi.product_id \
             JOIN groupon_promotion gp \
               ON gp.groupon_promotion_id = gpi.groupon_promotion_id \
             WHERE p.product_status = 1 AND p.is_delete = 0 AND gp.end_time >= ",
        );
        count_qb.push_bind(now);
        Self::push_item_filters(&mut count_qb, f);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT gpi.* FROM groupon_promotion_item gpi \
             JOIN product p ON p.product_id = gpi.product_id \
             JOIN groupon_promotion gp \
               ON gp.groupon_promotion_id = gpi.groupon_promotion_id \
             WHERE p.product_status = 1 AND p.is_delete = 0 AND gp.end_time >= ",
        );
        row_qb.push_bind(now);
        Self::push_item_filters(&mut row_qb, f);
        // Java：仅当 sortField 为 sale（销量）/ price（拼团价）且 sortOrder 为 asc/desc 时排序
        let order = (f.sort_field.as_deref(), f.sort_order.as_deref());
        match order {
            (Some("sale"), Some("desc")) => {
                row_qb.push(" ORDER BY p.virtual_sales DESC");
            }
            (Some("sale"), Some("asc")) => {
                row_qb.push(" ORDER BY p.virtual_sales ASC");
            }
            (Some("price"), Some("desc")) => {
                row_qb.push(" ORDER BY gpi.min_group_price DESC");
            }
            (Some("price"), Some("asc")) => {
                row_qb.push(" ORDER BY gpi.min_group_price ASC");
            }
            _ => {}
        }
        row_qb.push(" LIMIT ").push_bind(f.size as i64);
        row_qb
            .push(" OFFSET ")
            .push_bind(((f.page - 1) * f.size) as i64);
        let rows = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    fn push_item_filters(qb: &mut QueryBuilder<'_, MySql>, f: &GrouponItemListFilter) {
        if let Some(keyword) = f.keyword.as_deref().map(str::trim).filter(|k| !k.is_empty()) {
            qb.push(" AND p.product_name LIKE ")
                .push_bind(format!("%{keyword}%"));
        }
        qb.push(" AND gpi.groupon_promotion_id IN (");
        let mut sep = qb.separated(", ");
        for id in &f.allowed_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
    }

    /// 按商品 id 在允许的活动内取拼团商品（Java `selectOne(...).last("limit 1")`）。
    pub async fn find_item_by_product(
        &self,
        product_id: i32,
        allowed_ids: &[i64],
    ) -> Result<Option<GrouponPromotionItem>> {
        if allowed_ids.is_empty() {
            return Ok(None);
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT * FROM groupon_promotion_item WHERE product_id = ",
        );
        qb.push_bind(i64::from(product_id));
        qb.push(" AND groupon_promotion_id IN (");
        let mut sep = qb.separated(", ");
        for id in allowed_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(") LIMIT 1");
        drop(sep);
        qb.build_query_as()
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 订单取消：恢复拼团明细可售数量（Java `incLimitNum`）。
    pub async fn inc_detail_limit(&self, groupon_detail_id: i64, quantity: i32) -> Result<u64> {
        if quantity <= 0 {
            return Ok(0);
        }
        Ok(sqlx::query(
            "UPDATE groupon_promotion_detail SET limit_num = limit_num + ? \
             WHERE groupon_detail_id = ?",
        )
        .bind(quantity)
        .bind(groupon_detail_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected())
    }

    /// 拼团活动下的全部明细（Java `grouponPromotionDetailService.list(eq(promotionId))`，
    /// 活动重开冲突检查用）。
    pub async fn find_details_by_promotion(
        &self,
        promotion_id: i64,
    ) -> Result<Vec<GrouponPromotionDetail>> {
        sqlx::query_as::<_, GrouponPromotionDetail>(
            "SELECT * FROM groupon_promotion_detail WHERE groupon_promotion_id = ?",
        )
        .bind(promotion_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 某商品在其它拼团活动中的明细（Java `ne(grouponPromotionId)` 查询）。
    pub async fn find_details_by_product(
        &self,
        product_id: i64,
        exclude_promotion_id: i64,
    ) -> Result<Vec<GrouponPromotionDetail>> {
        sqlx::query_as::<_, GrouponPromotionDetail>(
            "SELECT * FROM groupon_promotion_detail \
             WHERE product_id = ? AND groupon_promotion_id <> ?",
        )
        .bind(product_id)
        .bind(exclude_promotion_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 批量查明细（客户端商品列表/详情用）。
    pub async fn find_details_by_item_ids(
        &self,
        item_ids: &[i64],
    ) -> Result<Vec<GrouponPromotionDetail>> {
        if item_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT * FROM groupon_promotion_detail WHERE groupon_promotion_item_id IN (");
        let mut sep = qb.separated(", ");
        for id in item_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 批量查活动 id 下的拼团记录（管理端列表组装用）。
    pub async fn find_records_by_promotion_ids(
        &self,
        promotion_ids: &[i64],
    ) -> Result<Vec<GrouponPromotionRecord>> {
        if promotion_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT * FROM groupon_promotion_record WHERE groupon_promotion_id IN (");
        let mut sep = qb.separated(", ");
        for id in promotion_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 批量查拼团商品下的记录（客户端商品列表用）。
    pub async fn find_records_by_item_ids(
        &self,
        item_ids: &[i64],
    ) -> Result<Vec<GrouponPromotionRecord>> {
        if item_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT * FROM groupon_promotion_record WHERE groupon_promotion_item_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in item_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 拼团成功且开团的记录数（Java `getGrouponInfo` 的 `groupSuccessCount`）。
    pub async fn count_open_success_records(
        &self,
        promotion_id: i64,
        product_id: i32,
    ) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM groupon_promotion_record \
             WHERE groupon_promotion_id = ? AND join_type = 1 AND join_status = 2 \
               AND product_id = ?",
        )
        .bind(promotion_id)
        .bind(i64::from(product_id))
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 待成团记录数（Java `getGrouponInfo` 的 `joinNumCount`：
    /// 仅按 `product_id + join_status`，**不带活动过滤**）。
    pub async fn count_wait_records_by_product(&self, product_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM groupon_promotion_record \
             WHERE product_id = ? AND join_status = 1",
        )
        .bind(i64::from(product_id))
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 可用 SKU id 集合（Java `productSkuService.lambdaQuery().eq(isEnabled, YES)`）。
    pub async fn find_enabled_sku_ids(&self, product_id: i32) -> Result<Vec<i64>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT sku_id FROM product_sku WHERE product_id = ? AND is_enabled = 1",
        )
        .bind(product_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| i64::from(id)).collect())
    }

    // ————————————————————— 商品 / 用户 / 配置 —————————————————————

    /// 批量查商品摘要（Java `selectBatchIds`）。
    pub async fn find_products(&self, ids: &[i32]) -> Result<Vec<ProductRow>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT product_id, product_name, product_sn, product_price, product_brief,
                    pic_url, pic_thumb, virtual_sales FROM product WHERE product_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 单个商品摘要（Java `productMapper.selectById`）。
    pub async fn find_product(&self, id: i32) -> Result<Option<ProductRow>> {
        sqlx::query_as::<_, ProductRow>(
            "SELECT product_id, product_name, product_sn, product_price, product_brief,
                    pic_url, pic_thumb, virtual_sales FROM product WHERE product_id = ? LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 会员标记（Java `user.getMark()`，拼团人群旧口径）。
    pub async fn find_user_mark(&self, user_id: i32) -> Result<Option<i32>> {
        let row: Option<(i32,)> =
            sqlx::query_as("SELECT mark FROM user WHERE user_id = ? LIMIT 1")
                .bind(user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(|(mark,)| mark))
    }

    /// 读取配置值（Java `ConfigService#getConfigVal`：行缺失/`biz_val` NULL → None）。
    pub async fn find_config_value(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND is_del = 0 LIMIT 1",
        )
        .bind(biz_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|(value,)| value))
    }

    /// 排序字段解析辅助（供服务层复用）。
    #[must_use]
    pub fn sort_column(field: Option<&str>) -> &'static str {
        promotion_sort_column(field)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("拼团数据不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_column_helper_delegates_to_model_whitelist() {
        assert_eq!(
            GrouponPromotionRepository::sort_column(Some("startTime")),
            "start_time"
        );
        assert_eq!(
            GrouponPromotionRepository::sort_column(Some("bad column")),
            "groupon_promotion_id"
        );
    }

    #[test]
    fn item_filter_requires_allowed_ids() {
        // allowed_ids 为空时仓储短路为空页（不触库）。
        let f = GrouponItemListFilter {
            allowed_ids: Vec::new(),
            page: 1,
            size: 15,
            ..Default::default()
        };
        assert!(f.allowed_ids.is_empty());
    }

    #[test]
    fn admin_filter_defaults_are_empty() {
        let f = AdminPromotionListFilter {
            sort_column: "groupon_promotion_id",
            sort_asc: false,
            page: 1,
            size: 15,
            ..Default::default()
        };
        assert_eq!(f.sort_column, "groupon_promotion_id");
        assert!(f.groupon_name.is_none());
        assert_eq!(f.search_status_time, 0);
    }
}
