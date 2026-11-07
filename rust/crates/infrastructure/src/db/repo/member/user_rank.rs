//! 会员等级域（member::user_rank）仓储：`user_rank` / `user_rank_config` / `user`。
//!
//! 对应原 Java：
//! - `com.tigshop.mapper.user.UserRankMapper`（`BaseMapper<UserRank>`）
//! - `com.tigshop.mapper.user.UserRankConfigMapper`
//! - `com.tigshop.mapper.user.UserMapper`（仅用于 `selectCount(eq(rank_id))`）
//! - `com.tigshop.service.common.impl.BaseServiceImpl` 的通用方法
//!   （`save` / `updateById` / `removeById` / `removeByIds` / `updateField`）
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table user_rank`）：
//!
//! `user_rank`（15 列，主键 `rank_id`）：
//!
//! | 列 | 类型 | 可空 |
//! |----|------|------|
//! | `rank_id` | `int unsigned` | NOT NULL（AUTO_INCREMENT） |
//! | `rank_name` | `varchar(30)` | NOT NULL |
//! | `min_growth_points` | `decimal(10,2) unsigned` | NOT NULL |
//! | `max_growth_points` | `int unsigned` | NOT NULL |
//! | `discount` | `decimal(4,1) unsigned` | NOT NULL |
//! | `show_price` | `tinyint unsigned` | NOT NULL |
//! | `rank_type` | `tinyint unsigned` | NOT NULL |
//! | `rank_logo` | `varchar(255)` | NOT NULL |
//! | `rank_ico` | `varchar(255)` | NOT NULL |
//! | `rank_bg` | `varchar(255)` | NOT NULL |
//! | `rank_point` | `varchar(30)` | NOT NULL |
//! | `free_shipping` | `tinyint unsigned` | NOT NULL |
//! | `rank_card_type` | `tinyint unsigned` | NOT NULL |
//! | `rights` | `text` | **NULL** |
//! | `rank_level` | `varchar(30)` | NOT NULL |
//!
//! `user_rank_config`（4 列，主键 `id`）：`id` / `code` / `rank_type` / `data`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：`min_growth_points`（`decimal(10,2)`）与 `discount`（`decimal(4,1)`）
//! 全程使用 `rust_decimal::Decimal`，**不经过 f64**。
//!
//! ## ⚠️ `rank_level` 的「实体是 `String`、Java 是 `Integer`」
//!
//! 自动生成的实体 `tigshop_core::entities::user::UserRank` 里
//! `rank_level: String`（库列 `varchar(30)`），而 Java 实体 / VO 都是
//! `Integer`。因此：
//! - **读**：服务层用 `tigshop_core::models::member::user_rank::rank_level_to_i32` 转换；
//! - **写**：本仓储的 [`UserRankWrite::rank_level`] 是 `i32`，绑定前转成
//!   `String`（MySQL 对 varchar 列接受整数并转成十进制字符串，
//!   与 Java 写 `Integer` 的落库结果一致）。

use rust_decimal::Decimal;
use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::user::{UserRank, UserRankConfig};
use tigshop_core::models::member::user_rank::UserRankListQuery;
use tigshop_core::{Error, Result};

/// 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合；
/// 与 `entities::user::UserRank` 的 15 个字段一一对应，顺序也一致）。
const USER_RANK_SELECT: &str = "SELECT rank_id, rank_name, min_growth_points, max_growth_points, \
     discount, show_price, rank_type, rank_logo, rank_ico, rank_bg, rank_point, \
     free_shipping, rank_card_type, rights, rank_level FROM user_rank";

/// `user_rank_config` 的固定 SELECT 列清单。
const USER_RANK_CONFIG_SELECT: &str =
    "SELECT id, code, rank_type, data FROM user_rank_config";

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<T>`：`None` 表示**不写该列**
/// （对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`）。
///
/// 用宏而非函数是为了避免 `sqlx::query_builder::Separated` 的多重生命周期
/// 参数在辅助函数签名里难以书写（与 admin_user / pc_cat_floor / area_code / tax_rate
/// 同一思路）。
///
/// 注意：`macro_rules!` 必须**先定义后使用**（按文本顺序展开），故本宏置于
/// 导入区之后、`impl` 之前，不能挪到文件末尾。
macro_rules! push_assign {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(v) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind_unseparated(v);
        }
    };
}

/// 会员等级域仓储。
#[derive(Clone)]
pub struct UserRankRepository {
    pool: MySqlPool,
}

impl UserRankRepository {
    /// 构造（与其它切片仓储同一约定）。
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— user_rank 查询 —————————————————————

    /// 会员等级分页（对应 Java `UserRankServiceImpl#list` / `#listNotPro` 的
    /// `this.page(page, queryWrapper)`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `keyword`：`rank_name LIKE %keyword%`（`StrUtil.isNotEmpty` 口径，
    ///   见 [`UserRankListQuery::effective_keyword`]）
    /// - `rankType`：`rank_type = ?`（仅 `!= null && > 0` 时加，
    ///   见 [`UserRankListQuery::effective_rank_type`]）
    ///
    /// ORDER BY 由服务层决定后传入 `order_clause`
    /// （`list` 与 `listNotPro` 的默认方向不同，见
    /// [`UserRankListQuery::order_clause`]）。
    pub async fn paginate(
        &self,
        q: &UserRankListQuery,
        order_clause: &str,
    ) -> Result<(u64, Vec<UserRank>)> {
        let page = q.page_query();
        let (limit, offset) = page.limit_offset();

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM user_rank WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{USER_RANK_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 的列名来自 models::tigshop_core::models::member::user_rank::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(order_clause);
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<UserRank> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &UserRankListQuery) {
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND rank_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
        if let Some(rank_type) = q.effective_rank_type() {
            qb.push(" AND rank_type = ");
            qb.push_bind(rank_type);
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, rank_id: i32) -> Result<Option<UserRank>> {
        sqlx::query_as::<_, UserRank>(&format!("{USER_RANK_SELECT} WHERE rank_id = ? LIMIT 1"))
            .bind(rank_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 全部会员等级，按 `rank_id` 升序
    /// （对应 Java `UserRankServiceImpl#detail` 的
    /// `orderByAsc(UserRank::getRankId)`）。
    pub async fn list_ordered_by_rank_id(&self) -> Result<Vec<UserRank>> {
        sqlx::query_as::<_, UserRank>(&format!(
            "{USER_RANK_SELECT} ORDER BY rank_id ASC"
        ))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 全部会员等级，无排序
    /// （对应 Java `UserRankServiceImpl#update` 的 `this.lambdaQuery().list()`）。
    pub async fn list_all(&self) -> Result<Vec<UserRank>> {
        sqlx::query_as::<_, UserRank>(USER_RANK_SELECT)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 统计某等级下的用户数
    /// （对应 Java `userMapper.selectCount(eq(User::getRankId, rankId))`）。
    ///
    /// ⚠️ Java **没有**任何附加过滤（注释里说「正式会员 `user_type = 0`」
    /// 但代码并未实现），因此本查询同样只按 `rank_id` 过滤。
    pub async fn count_users_by_rank_id(&self, rank_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM `user` WHERE rank_id = ?")
            .bind(rank_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0)
    }

    /// 一次性统计多个等级下的用户数（返回 `rank_id -> count`）。
    ///
    /// 与逐行 [`Self::count_users_by_rank_id`] **语义等价**（同一张表、
    /// 同一个 `rank_id = ?` 条件），只是把 Java 的 N+1 次查询合并为一次
    /// `GROUP BY`。返回的 map 只包含有用户的等级；调用方对缺失键取 0。
    pub async fn count_users_by_rank_ids(&self, rank_ids: &[i32]) -> Result<Vec<(i32, i64)>> {
        if rank_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT rank_id, COUNT(*) FROM `user` WHERE rank_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in rank_ids {
            sep.push_bind(*id);
        }
        drop(sep);
        qb.push(") GROUP BY rank_id");
        let rows: Vec<(i32, i64)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows)
    }

    /// 等级名称是否已存在（对应 Java `UserRankServiceImpl#checkUserRank` 的
    /// `this.count(eq(UserRank::getRankName, name))`）。
    ///
    /// ⚠️ Java 的 `count` **不带** `rank_id <> ?` 排除自身 —— 这是 `create`
    /// 专用的查重（`update` 不走这条路径），因此本实现同样不排除自身。
    pub async fn exists_rank_name(&self, rank_name: &str) -> Result<bool> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM user_rank WHERE rank_name = ?")
                .bind(rank_name)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0 > 0)
    }

    // ————————————————————— user_rank_config —————————————————————

    /// 按 `code` 查询配置行，取第一条
    /// （对应 Java `UserRankConfigServiceImpl#getUserRankConfig`
    /// 的 `eq(code).last("limit 1")`）。
    pub async fn find_config_by_code(&self, code: &str) -> Result<Option<UserRankConfig>> {
        sqlx::query_as::<_, UserRankConfig>(&format!(
            "{USER_RANK_CONFIG_SELECT} WHERE code = ? LIMIT 1"
        ))
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— user_rank 写入 —————————————————————

    /// 新增会员等级，返回自增主键
    /// （对应 Java `BaseServiceImpl#save` / MyBatis-Plus `insert`）。
    ///
    /// `None` 字段**不写该列**，由 MySQL 施加列默认值
    /// （`FieldStrategy.NOT_NULL` 的等价语义）。
    /// `rank_id` 为 `Some` 时会显式写入主键
    /// （MyBatis-Plus 的 `IdType.AUTO` 在 id 非空时同样显式写）。
    pub async fn insert(&self, w: &UserRankWrite) -> Result<i32> {
        let mut conn = self.pool.acquire().await.map_err(map_err)?;
        insert_row(&mut conn, w).await
    }

    /// 按主键更新（对应 Java `BaseServiceImpl#updateById`，
    /// `FieldStrategy.NOT_NULL`：**只写非 null 字段**）。
    pub async fn update(&self, rank_id: i32, w: &UserRankWrite) -> Result<u64> {
        let mut conn = self.pool.acquire().await.map_err(map_err)?;
        update_row(&mut conn, rank_id, w).await
    }

    /// 按主键硬删除（对应 Java `BaseServiceImpl#del` → `removeById`）。
    ///
    /// `user_rank` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, rank_id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM user_rank WHERE rank_id = ?")
            .bind(rank_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 按主键批量硬删除（对应 Java `BaseServiceImpl#batch` → `removeByIds`）。
    ///
    /// 调用方需先经
    /// [`tigshop_core::models::member::user_rank::BatchDTO::effective_ids`] 去重。
    pub async fn delete_many(&self, rank_ids: &[i32]) -> Result<u64> {
        if rank_ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM user_rank WHERE rank_id IN (");
        let mut sep = qb.separated(", ");
        for id in rank_ids {
            sep.push_bind(*id);
        }
        drop(sep);
        qb.push(")");
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`：
    /// `UPDATE user_rank SET <column> = ? WHERE rank_id = ?`）。
    ///
    /// `column` 必须由服务层经
    /// [`tigshop_core::models::member::user_rank::map_update_field_column`] +
    /// [`tigshop_core::models::member::user_rank::USER_RANK_FIELDS`] 白名单校验后传入。
    ///
    /// `val` 为 `None` 时绑定 SQL `NULL`（复刻 Java
    /// `UpdateWrapper.set(field, null)` 的 `SET <column> = null`）。
    pub async fn update_field(
        &self,
        rank_id: i32,
        column: &str,
        val: Option<&str>,
    ) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::member::user_rank::USER_RANK_FIELDS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE user_rank SET {column} = ? WHERE rank_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(rank_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    // ————————————————————— update 的整体事务 —————————————————————

    /// 在一个事务里执行 Java `UserRankServiceImpl#update` 的全部写操作
    /// （该方法带 `@Transactional`）。
    ///
    /// 执行顺序**逐条对齐** Java：
    /// 1. `removeBatchByIds(delUserRanks)` —— 先删掉本次没出现在 `data` 里的等级
    /// 2. `saveBatch(saveUserRanks)` —— `rankId == null` 的条目新增
    /// 3. `updateBatchById(editUserRanks)` —— `rankId != null` 的条目更新
    /// 4. `user_rank_config` 里 `code = 'rank_config'` 的行 upsert
    /// 5. `growUpSetting != null && rankType == 1` 时，
    ///    `code = 'grow_config'` 的行 upsert
    ///
    /// 任一步失败整体回滚，与 Java 的 `@Transactional` 一致。
    pub async fn apply_edit(&self, plan: &RankEditPlan) -> Result<EditOutcome> {
        let mut tx = self.pool.begin().await.map_err(map_err)?;

        // ① 删除
        let mut deleted = 0_u64;
        if !plan.delete_ids.is_empty() {
            let mut qb: QueryBuilder<'_, sqlx::MySql> =
                QueryBuilder::new("DELETE FROM user_rank WHERE rank_id IN (");
            let mut sep = qb.separated(", ");
            for id in &plan.delete_ids {
                sep.push_bind(*id);
            }
            drop(sep);
            qb.push(")");
            let res = qb.build().execute(&mut *tx).await.map_err(map_err)?;
            deleted = res.rows_affected();
        }

        // ② 新增
        let mut inserted = 0_u64;
        for w in &plan.inserts {
            insert_row(&mut tx, w).await?;
            inserted += 1;
        }

        // ③ 更新
        let mut updated = 0_u64;
        for (rank_id, w) in &plan.updates {
            updated += update_row(&mut tx, *rank_id, w).await?;
        }

        // ④ rank_config upsert
        if let Some(cfg) = &plan.rank_config {
            upsert_config(
                &mut tx,
                tigshop_core::models::member::user_rank::RANK_CONFIG_CODE,
                cfg.rank_type,
                cfg.data.as_deref(),
            )
            .await?;
        }

        // ⑤ grow_config upsert（仅 rankType == 1 且传了 growUpSetting）
        if let Some(data) = &plan.grow_config {
            upsert_config(
                &mut tx,
                tigshop_core::models::member::user_rank::GROW_CONFIG_CODE,
                1,
                Some(data.as_str()),
            )
            .await?;
        }

        tx.commit().await.map_err(map_err)?;
        Ok(EditOutcome {
            deleted,
            inserted,
            updated,
        })
    }
}

/// `update` 端点的写入计划（由服务层按 Java 逻辑组装）。
#[derive(Debug, Clone, Default)]
pub struct RankEditPlan {
    /// 需要删除的等级主键（`data` 里没出现的旧行）
    pub delete_ids: Vec<i32>,
    /// 需要新增的行（`data` 里 `rankId == null` 的条目）
    pub inserts: Vec<UserRankWrite>,
    /// 需要更新的行（`data` 里 `rankId != null` 的条目）
    pub updates: Vec<(i32, UserRankWrite)>,
    /// `rank_config` 行的目标状态（`None` ⇒ 不触碰该表）
    pub rank_config: Option<RankConfigWrite>,
    /// `grow_config` 行的目标 `data`（`None` ⇒ 不触碰）
    pub grow_config: Option<String>,
}

/// `user_rank_config` 的 upsert 内容。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RankConfigWrite {
    /// `rank_type`
    pub rank_type: i32,
    /// `data`（`None` ⇒ 不写该列，保留旧值；对应 Java `JsonUtil.toJson(null)`
    /// 返回 null 后被 `FieldStrategy.NOT_NULL` 跳过）
    pub data: Option<String>,
}

/// `update` 的写入结果统计（便于排障；Java 全部丢弃返回值）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct EditOutcome {
    /// 删除行数
    pub deleted: u64,
    /// 新增行数
    pub inserted: u64,
    /// 更新行数
    pub updated: u64,
}

/// 新增 / 更新会员等级时待写入的列。
///
/// `None` = **不写该列**（MyBatis-Plus `FieldStrategy.NOT_NULL` 的等价语义）。
/// ⚠️ 空串 `""` 与 `0` 都会照常写入 —— 不能用「值为空就跳过」简化。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct UserRankWrite {
    /// `rank_id`（`None` ⇒ 走 AUTO_INCREMENT；`Some` ⇒ 显式写主键）
    pub rank_id: Option<i32>,
    /// `rank_name`
    pub rank_name: Option<String>,
    /// `min_growth_points`（`decimal(10,2)`）
    pub min_growth_points: Option<Decimal>,
    /// `max_growth_points`
    pub max_growth_points: Option<i32>,
    /// `discount`（`decimal(4,1)`）
    pub discount: Option<Decimal>,
    /// `show_price`
    pub show_price: Option<i32>,
    /// `rank_type`
    pub rank_type: Option<i32>,
    /// `rank_logo`
    pub rank_logo: Option<String>,
    /// `rank_ico`
    pub rank_ico: Option<String>,
    /// `rank_bg`
    pub rank_bg: Option<String>,
    /// `rank_point`（库列是 `varchar(30)`）
    pub rank_point: Option<String>,
    /// `free_shipping`
    pub free_shipping: Option<i32>,
    /// `rank_card_type`
    pub rank_card_type: Option<i32>,
    /// `rights`（JSON 文本）
    pub rights: Option<String>,
    /// `rank_level`（Java 是 `Integer`，库列是 `varchar(30)` ⇒ 绑定前转字符串）
    pub rank_level: Option<i32>,
}

impl UserRankWrite {
    /// 是否有任何列会被写入（`rank_id` 不计入：它只影响 INSERT 的主键列）。
    #[must_use]
    pub fn has_payload(&self) -> bool {
        self.rank_name.is_some()
            || self.min_growth_points.is_some()
            || self.max_growth_points.is_some()
            || self.discount.is_some()
            || self.show_price.is_some()
            || self.rank_type.is_some()
            || self.rank_logo.is_some()
            || self.rank_ico.is_some()
            || self.rank_bg.is_some()
            || self.rank_point.is_some()
            || self.free_shipping.is_some()
            || self.rank_card_type.is_some()
            || self.rights.is_some()
            || self.rank_level.is_some()
    }
}

/// INSERT 的绑定值（避免为文本列与数值列定义平行 `Vec`）。
#[derive(Debug, Clone)]
enum BindValue<'a> {
    /// 文本列
    Text(&'a str),
    /// 临时构造的文本（如 `rank_level` 的整数转字符串）
    OwnedText(String),
    /// 整型列
    Int(i32),
    /// `decimal` 列
    Decimal(Decimal),
}

/// 组装 `INSERT INTO user_rank (...)`，返回 SQL 与**顺序一致**的绑定值。
///
/// 列顺序固定（与 [`UserRankWrite`] 字段声明顺序一致），便于测试断言。
fn build_insert(w: &UserRankWrite) -> (String, Vec<BindValue<'_>>) {
    let mut columns: Vec<&'static str> = Vec::with_capacity(15);
    let mut binds: Vec<BindValue<'_>> = Vec::with_capacity(15);

    if let Some(v) = w.rank_id {
        columns.push("rank_id");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.rank_name.as_deref() {
        columns.push("rank_name");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.min_growth_points {
        columns.push("min_growth_points");
        binds.push(BindValue::Decimal(v));
    }
    if let Some(v) = w.max_growth_points {
        columns.push("max_growth_points");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.discount {
        columns.push("discount");
        binds.push(BindValue::Decimal(v));
    }
    if let Some(v) = w.show_price {
        columns.push("show_price");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.rank_type {
        columns.push("rank_type");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.rank_logo.as_deref() {
        columns.push("rank_logo");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.rank_ico.as_deref() {
        columns.push("rank_ico");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.rank_bg.as_deref() {
        columns.push("rank_bg");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.rank_point.as_deref() {
        columns.push("rank_point");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.free_shipping {
        columns.push("free_shipping");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.rank_card_type {
        columns.push("rank_card_type");
        binds.push(BindValue::Int(v));
    }
    if let Some(v) = w.rights.as_deref() {
        columns.push("rights");
        binds.push(BindValue::Text(v));
    }
    if let Some(v) = w.rank_level {
        columns.push("rank_level");
        binds.push(BindValue::OwnedText(v.to_string()));
    }

    debug_assert_eq!(columns.len(), binds.len());
    let placeholders = vec!["?"; columns.len()].join(", ");
    let sql = format!(
        "INSERT INTO user_rank ({}) VALUES ({placeholders})",
        columns.join(", ")
    );
    (sql, binds)
}

/// 组装并执行 `UPDATE user_rank SET ... WHERE rank_id = ?`。
///
/// 没有任何列可写时**不执行 SQL**（避免生成 `UPDATE ... SET  WHERE`）；
/// Java 在这种情况下同样是无意义更新（MyBatis-Plus 会生成非法 SQL 而报错，
/// 见 `uncertain_points`）。
async fn update_row(
    conn: &mut sqlx::MySqlConnection,
    rank_id: i32,
    w: &UserRankWrite,
) -> Result<u64> {
    if !w.has_payload() {
        return Ok(0);
    }
    let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE user_rank SET ");
    let mut sep = qb.separated(", ");
    push_assign!(sep, "rank_name", w.rank_name);
    push_assign!(sep, "min_growth_points", w.min_growth_points);
    push_assign!(sep, "max_growth_points", w.max_growth_points);
    push_assign!(sep, "discount", w.discount);
    push_assign!(sep, "show_price", w.show_price);
    push_assign!(sep, "rank_type", w.rank_type);
    push_assign!(sep, "rank_logo", w.rank_logo);
    push_assign!(sep, "rank_ico", w.rank_ico);
    push_assign!(sep, "rank_bg", w.rank_bg);
    push_assign!(sep, "rank_point", w.rank_point);
    push_assign!(sep, "free_shipping", w.free_shipping);
    push_assign!(sep, "rank_card_type", w.rank_card_type);
    push_assign!(sep, "rights", w.rights);
    if let Some(v) = w.rank_level.as_ref() {
        sep.push("rank_level");
        sep.push_unseparated(" = ");
        sep.push_bind_unseparated(v.to_string());
    }
    drop(sep);
    qb.push(" WHERE rank_id = ");
    qb.push_bind(rank_id);
    let res = qb.build().execute(conn).await.map_err(map_err)?;
    Ok(res.rows_affected())
}

/// `user_rank_config` 的 upsert
/// （对应 Java `UserRankServiceImpl#update` 里对两张配置行的
/// 「先 `selectOne` 判断存在性，再 `updateById` / `insert`」）。
///
/// ⚠️ 只按 `code` 定位，**不**限定 `id`（Java 也是按 `code` 查的）。
/// `data` 为 `None` 时：存在则**不写 data 列**（保留旧值），
/// 不存在则 INSERT 时不带该列（落到列默认 NULL）。
async fn upsert_config(
    conn: &mut sqlx::MySqlConnection,
    code: &str,
    rank_type: i32,
    data: Option<&str>,
) -> Result<()> {
    let existing: Option<(i32,)> =
        sqlx::query_as("SELECT id FROM user_rank_config WHERE code = ? LIMIT 1")
            .bind(code)
            .fetch_optional(&mut *conn)
            .await
            .map_err(map_err)?;

    match (existing, data) {
        (Some((id,)), Some(d)) => {
            sqlx::query("UPDATE user_rank_config SET rank_type = ?, data = ? WHERE id = ?")
                .bind(rank_type)
                .bind(d)
                .bind(id)
                .execute(&mut *conn)
                .await
                .map_err(map_err)?;
        }
        (Some((id,)), None) => {
            sqlx::query("UPDATE user_rank_config SET rank_type = ? WHERE id = ?")
                .bind(rank_type)
                .bind(id)
                .execute(&mut *conn)
                .await
                .map_err(map_err)?;
        }
        (None, Some(d)) => {
            sqlx::query("INSERT INTO user_rank_config (code, rank_type, data) VALUES (?, ?, ?)")
                .bind(code)
                .bind(rank_type)
                .bind(d)
                .execute(&mut *conn)
                .await
                .map_err(map_err)?;
        }
        (None, None) => {
            sqlx::query("INSERT INTO user_rank_config (code, rank_type) VALUES (?, ?)")
                .bind(code)
                .bind(rank_type)
                .execute(&mut *conn)
                .await
                .map_err(map_err)?;
        }
    }
    Ok(())
}

/// 组装并执行 `INSERT INTO user_rank ...`，返回自增主键。
async fn insert_row(conn: &mut sqlx::MySqlConnection, w: &UserRankWrite) -> Result<i32> {
    let (sql, binds) = build_insert(w);
    let mut q = sqlx::query(&sql);
    for b in &binds {
        q = match b {
            BindValue::Text(t) => q.bind(*t),
            BindValue::OwnedText(t) => q.bind(t.as_str()),
            BindValue::Int(i) => q.bind(*i),
            BindValue::Decimal(d) => q.bind(*d),
        };
    }
    let res = q.execute(conn).await.map_err(map_err)?;
    Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("等级不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("测试常量必须是合法 Decimal")
    }

    fn full_write() -> UserRankWrite {
        UserRankWrite {
            rank_id: Some(7),
            rank_name: Some("铂金会员".into()),
            min_growth_points: Some(dec("100.00")),
            max_growth_points: Some(999),
            discount: Some(dec("9.5")),
            show_price: Some(1),
            rank_type: Some(2),
            rank_logo: Some("logo.png".into()),
            rank_ico: Some("card2".into()),
            rank_bg: Some("bg.png".into()),
            rank_point: Some("3".into()),
            free_shipping: Some(1),
            rank_card_type: Some(2),
            rights: Some("[]".into()),
            rank_level: Some(2),
        }
    }

    /// INSERT 的列顺序与绑定数量必须一致，且覆盖全部 15 列。
    #[test]
    fn insert_lists_every_column_in_fixed_order() {
        let fw = full_write();
        let (sql, binds) = build_insert(&fw);
        assert_eq!(binds.len(), 15);
        let expected = [
            "rank_id",
            "rank_name",
            "min_growth_points",
            "max_growth_points",
            "discount",
            "show_price",
            "rank_type",
            "rank_logo",
            "rank_ico",
            "rank_bg",
            "rank_point",
            "free_shipping",
            "rank_card_type",
            "rights",
            "rank_level",
        ];
        let cols = sql
            .split("VALUES")
            .next()
            .expect("应有 VALUES")
            .trim_end_matches(' ')
            .to_string();
        let mut last = 0_usize;
        for c in expected {
            let pos = cols.find(c).unwrap_or_else(|| panic!("缺少列 {c}: {sql}"));
            assert!(pos >= last, "列顺序异常: {c} 出现在 {sql}");
            last = pos;
        }
        assert_eq!(sql.matches('?').count(), 15, "sql={sql}");
        assert!(!sql.contains("SELECT *"));
    }

    /// `None` 字段不得出现在 INSERT 里（MySQL 列默认值生效）。
    #[test]
    fn insert_skips_none_fields() {
        let w = UserRankWrite {
            rank_name: Some("黄金会员".into()),
            ..Default::default()
        };
        let (sql, binds) = build_insert(&w);
        assert_eq!(binds.len(), 1);
        assert!(sql.contains("rank_name"));
        assert!(!sql.contains("discount"));
        assert!(!sql.contains("rank_id"), "rank_id 为 None 时不写主键: {sql}");
        assert_eq!(sql.matches('?').count(), 1);
    }

    /// 空串与 0 都必须照常写入（不能按「空就跳过」简化）。
    #[test]
    fn insert_keeps_empty_string_and_zero() {
        let w = UserRankWrite {
            rank_name: Some(String::new()),
            discount: Some(Decimal::ZERO),
            free_shipping: Some(0),
            rank_level: Some(0),
            ..Default::default()
        };
        let (sql, binds) = build_insert(&w);
        assert_eq!(binds.len(), 4, "sql={sql}");
        assert!(sql.contains("rank_name"));
        assert!(sql.contains("discount"));
        assert!(sql.contains("free_shipping"));
        assert!(sql.contains("rank_level"));
    }

    /// `has_payload` 必须与 `update_row` 实际会写的列一致：
    /// 只有 `rank_id` 时不算「有内容」（否则会生成非法 SQL）。
    #[test]
    fn has_payload_excludes_rank_id() {
        let w = UserRankWrite {
            rank_id: Some(3),
            ..Default::default()
        };
        assert!(!w.has_payload());
        assert!(full_write().has_payload());
    }

    /// 逐字段验证每个字段都能独立触发「会写」。
    #[test]
    fn each_field_triggers_payload() {
        let cases = [
            UserRankWrite {
                rank_name: Some("x".into()),
                ..Default::default()
            },
            UserRankWrite {
                min_growth_points: Some(dec("0.00")),
                ..Default::default()
            },
            UserRankWrite {
                max_growth_points: Some(0),
                ..Default::default()
            },
            UserRankWrite {
                discount: Some(dec("0.0")),
                ..Default::default()
            },
            UserRankWrite {
                show_price: Some(0),
                ..Default::default()
            },
            UserRankWrite {
                rank_type: Some(0),
                ..Default::default()
            },
            UserRankWrite {
                rank_logo: Some(String::new()),
                ..Default::default()
            },
            UserRankWrite {
                rank_ico: Some(String::new()),
                ..Default::default()
            },
            UserRankWrite {
                rank_bg: Some(String::new()),
                ..Default::default()
            },
            UserRankWrite {
                rank_point: Some(String::new()),
                ..Default::default()
            },
            UserRankWrite {
                free_shipping: Some(0),
                ..Default::default()
            },
            UserRankWrite {
                rank_card_type: Some(1),
                ..Default::default()
            },
            UserRankWrite {
                rights: Some("[]".into()),
                ..Default::default()
            },
            UserRankWrite {
                rank_level: Some(0),
                ..Default::default()
            },
        ];
        for (i, w) in cases.iter().enumerate() {
            assert!(w.has_payload(), "第 {i} 个写入应被判为「有内容」");
        }
    }

    /// SELECT 子句的列清单必须与 schema 一致（防止漏列导致 FromRow 运行期报错）。
    #[test]
    fn select_clause_lists_all_schema_columns() {
        for col in tigshop_core::models::member::user_rank::USER_RANK_COLUMNS {
            assert!(
                USER_RANK_SELECT.contains(col),
                "SELECT 缺少列 {col}: {USER_RANK_SELECT}"
            );
        }
        for col in tigshop_core::models::member::user_rank::USER_RANK_CONFIG_COLUMNS {
            assert!(
                USER_RANK_CONFIG_SELECT.contains(col),
                "SELECT 缺少列 {col}: {USER_RANK_CONFIG_SELECT}"
            );
        }
        assert!(!USER_RANK_SELECT.contains('*'));
        assert!(!USER_RANK_CONFIG_SELECT.contains('*'));
    }

    /// 表名与实体常量一致。
    #[test]
    fn table_names_match_entities() {
        assert_eq!(UserRank::TABLE, "user_rank");
        assert_eq!(UserRankConfig::TABLE, "user_rank_config");
        assert!(USER_RANK_SELECT.contains("FROM user_rank"));
        assert!(USER_RANK_CONFIG_SELECT.contains("FROM user_rank_config"));
    }

    /// `RankEditPlan` 的默认值必须什么都不做。
    #[test]
    fn empty_plan_is_noop() {
        let p = RankEditPlan::default();
        assert!(p.delete_ids.is_empty());
        assert!(p.inserts.is_empty());
        assert!(p.updates.is_empty());
        assert!(p.rank_config.is_none());
        assert!(p.grow_config.is_none());
        assert_eq!(EditOutcome::default().deleted, 0);
    }
}