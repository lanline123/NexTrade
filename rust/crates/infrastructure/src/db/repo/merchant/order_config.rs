//! 订单配置域（merchant::order_config）仓储：`order_config`。
//!
//! 对应原 Java `com.tigshop.mapper.shop.OrderConfigMapper`
//! （`BaseMapper<OrderConfig>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table order_config`）：
//!
//! `order_config`（4 列，主键 `id`）：
//! `id` / `shop_id` / `code` / `data`
//! —— `id` / `shop_id` 是 `int unsigned NOT NULL`，
//! `code` 是 `varchar(50) NOT NULL`，`data` 是 `text NULL`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::OrderConfig;
use tigshop_core::models::merchant::order_config::OrderConfigListQuery;
use tigshop_core::{Error, Result};

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<Option<T>>`：
/// - 外层 `None`（调用方明确「不写该列」）与内层 `None`（值为 null）都**不写**
///   —— 对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`
/// - `Some(Some(v))` 才绑定参数
///
/// 用宏而非函数是为了避免 `sqlx::query_builder::Separated` 的多重生命周期
/// 参数在辅助函数签名里难以书写（与 admin_user / pc_cat_floor / area_code 同一思路）。
///
/// 注意：`macro_rules!` 必须**先定义后使用**（按文本顺序展开），故本宏置于
/// 导入区之后、`impl` 之前，不能挪到文件末尾。
macro_rules! push_assign {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(Some(v)) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind_unseparated(v);
        }
    };
}

/// 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合；
/// 与 `entities::OrderConfig` 的 4 个字段一一对应，顺序也一致）。
const ORDER_CONFIG_SELECT: &str = "SELECT id, shop_id, code, data FROM order_config";

#[derive(Clone)]
pub struct OrderConfigRepository {
    pool: MySqlPool,
}

impl OrderConfigRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 查询 —————————————————————

    /// 订单配置分页（对应 Java `OrderConfigServiceImpl#list`）。
    ///
    /// ⚠️ **没有任何 WHERE 条件** —— 这是对 Java 的忠实复刻：
    /// `OrderConfigServiceImpl#list` 里 `isShow` 与 `keyword` 两段过滤代码
    /// **都被整段注释掉了**（Java 第 61–64 行与第 67–70 行），
    /// 因此 Java 侧实际执行的就是无条件分页。
    ///
    /// ORDER BY 由 [`OrderConfigListQuery::order_clause`] 生成
    /// （Java `buildSortOrder(page, sortField, sortOrder)`，
    /// 未识别字段回退主键列，非法 `sortOrder` 不追加排序）。
    pub async fn paginate(&self, q: &OrderConfigListQuery) -> Result<(u64, Vec<OrderConfig>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        // 无条件 COUNT：与 Java `this.page(page, new LambdaQueryWrapper<>())` 一致
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM order_config")
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(ORDER_CONFIG_SELECT);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::merchant::order_config::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<OrderConfig> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<OrderConfig>> {
        sqlx::query_as::<_, OrderConfig>(&format!("{ORDER_CONFIG_SELECT} WHERE id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按 `shop_id` + `code` 查询单条
    /// （对应 Java `OrderConfigServiceImpl#shopOrderConfigDetail` 与
    /// `saveOrderConfig` 里的
    /// `eq(code, ...).eq(shopId, ...)` + `getOne` / `one`）。
    ///
    /// ⚠️ Java 的 `one()` 在结果 > 1 行时会抛
    /// `TooManyResultsException`。本表**没有** `(shop_id, code)` 唯一索引
    /// （`pure.sql` 仅声明主键），因此重复行在 MySQL 默认配置下确实可能出现。
    /// 本实现用 `LIMIT 1` 取第一行（不抛异常），这是一处**有意收敛**，
    /// 见 `uncertain_points`。
    ///
    /// ⚠️ 本方法**不对应本切片的任何管理端路由**（本切片 7 条接口里没有
    /// 店铺前台查询订单配置的入口）；保留它是为了让同一张表的读取逻辑
    /// 集中在一处，供**前台**切片复用
    /// （对应`OrderConfigServiceImpl#shopOrderConfigDetail`）。
    pub async fn find_by_shop_and_code(
        &self,
        shop_id: i32,
        code: &str,
    ) -> Result<Option<OrderConfig>> {
        sqlx::query_as::<_, OrderConfig>(&format!(
            "{ORDER_CONFIG_SELECT} WHERE shop_id = ? AND code = ? ORDER BY id ASC LIMIT 1"
        ))
        .bind(shop_id)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增订单配置，返回自增主键（对应 Java `save`）。
    ///
    /// 列写入策略对齐 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`：
    /// **只写非 null 字段**，`None` 的列不出现在 INSERT 里、由 MySQL 施加列默认值。
    ///
    /// ⚠️ 但 `shop_id` / `code` 两列是 `NOT NULL` 且 `pure.sql` 未声明显式
    /// DEFAULT（MySQL 对 `int unsigned NOT NULL` 隐含默认 `0`，对
    /// `varchar NOT NULL` 隐含默认 `''`），所以「不写列」不会报错、
    /// 而是静默落成 `0` / `''`。服务层负责在落库前把这些值补齐
    /// （见 `OrderConfigService::create`）。
    pub async fn insert(&self, v: &OrderConfigInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(4);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(4);

        if let Some(shop_id) = v.shop_id {
            columns.push("shop_id");
            binds.push(InsertValue::Int(shop_id));
        }
        if let Some(code) = v.code.as_deref() {
            columns.push("code");
            binds.push(InsertValue::Text(code));
        }
        if let Some(data) = v.data.as_deref() {
            columns.push("data");
            binds.push(InsertValue::Text(data));
        }

        if columns.is_empty() {
            // 等价 MyBatis-Plus 对「所有字段为 null」的实体：INSERT 无列时
            // 会退化成 `INSERT INTO t () VALUES ()`，这里显式拒绝以免拼出非法 SQL。
            return Err(Error::Validation("没有可写入的字段".into()));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO order_config ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for b in &binds {
            query = match b {
                InsertValue::Text(t) => query.bind(*t),
                InsertValue::Int(i) => query.bind(*i),
            };
        }
        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ 若补丁里没有任何列（[`OrderConfigPatch::is_empty`]），
    /// 调用方**不得**调用本方法：Java 的 `updateById` 在全 null 时会生成
    /// `UPDATE order_config SET WHERE id = ?`（无 SET 项）⇒ MySQL 语法错误。
    /// 服务层已提前拦截（见 `OrderConfigService::update`）。
    pub async fn update(&self, id: i32, patch: &OrderConfigPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE order_config SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "shop_id", patch.shop_id);
        push_assign!(sep, "code", patch.code);
        push_assign!(sep, "data", patch.data);
        drop(sep);
        qb.push(" WHERE id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::merchant::order_config::ORDER_CONFIG_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    ///
    /// ⚠️ 服务层当前**永远不会调用**本方法：Java 的
    /// `CheckFieldConstants.ORDER_CONFIG_FIELDS` 是空数组，
    /// 任何字段都会先被白名单拒绝（见 `OrderConfigService::update_field`）。
    /// 保留它是为了白名单一旦启用即可直接复用。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::merchant::order_config::ORDER_CONFIG_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE order_config SET {column} = ? WHERE id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `OrderConfigServiceImpl#del` → `removeById`）。
    ///
    /// `order_config` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM order_config WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量硬删除（对应 Java `BaseServiceImpl#batch` → `removeByIds`）。
    ///
    /// 返回**实际删除的行数**；Java 的 `removeByIds` 返回
    /// `SqlHelper.retBool(rows)`（`rows >= 1`），调用方据此折算布尔值。
    pub async fn delete_many(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM order_config WHERE id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }
}

/// 新增时待写入的订单配置（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
///
/// ⚠️ `shop_id` / `code` 为 `None` 时不会报错，而是由 MySQL 落到
/// `0` / `''`（两列 `NOT NULL` 且无显式 DEFAULT）。
/// 服务层负责在落库前补齐有意义的值。
#[derive(Debug, Clone, Default)]
pub struct OrderConfigInsert {
    /// `shop_id`
    pub shop_id: Option<i32>,
    /// `code`
    pub code: Option<String>,
    /// `data`
    pub data: Option<String>,
}

/// INSERT 的绑定值（避免为文本列与整型列定义平行 `Vec`）。
#[derive(Debug, Clone, Copy)]
enum InsertValue<'a> {
    /// 文本列
    Text(&'a str),
    /// 整型列
    Int(i32),
}

/// `update` 的部分更新补丁（对应 MyBatis-Plus `updateById` 的
/// `FieldStrategy.NOT_NULL`：**只写非 null 字段**）。
///
/// 每个字段的三种状态：
/// - `None`：调用方明确该列不参与 `SET`（等价 Java 实体字段为 `null`）
/// - `Some(None)`：值显式为 null ⇒ 同样**不写该列**
/// - `Some(Some(v))`：写该列
///
/// ⚠️ 关键差异（已核对 mybatis-plus 3.5 的 `NOT_NULL` 策略）：
/// Java 只跳过 `null`，**空串 `""` 与 `0` 都会照常写入**。
/// 因此本补丁不能用「值为空就跳过」的简化写法，必须由调用方显式构造
/// `Some(Some(""))` / `Some(Some(0))`。
#[derive(Debug, Clone, Default)]
pub struct OrderConfigPatch {
    /// `shop_id`
    pub shop_id: Option<Option<i32>>,
    /// `code`
    pub code: Option<Option<String>>,
    /// `data`
    pub data: Option<Option<String>>,
}

impl OrderConfigPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    ///
    /// 服务层用本方法拦截「全 null 补丁」—— 那种情况下 Java 的 `updateById`
    /// 会生成 `UPDATE order_config SET WHERE id = ?`（无 SET 项）并抛 SQL 语法错误。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.shop_id, Some(Some(_)))
            && !matches!(self.code, Some(Some(_)))
            && !matches!(self.data, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("订单配置不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = OrderConfigPatch {
            code: Some(Some(String::new())),
            shop_id: Some(Some(0)),
            ..OrderConfigPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = OrderConfigPatch {
            shop_id: None,
            code: Some(None),
            data: Some(None),
        };
        assert!(empty.is_empty());
    }

    /// `data` 是唯一可空列；显式写 null 与不写列在 MyBatis-Plus 下等价（都不写）。
    #[test]
    fn patch_data_null_is_skipped() {
        let patch = OrderConfigPatch {
            data: Some(None),
            ..OrderConfigPatch::default()
        };
        assert!(patch.is_empty());
    }

    /// `OrderConfigInsert` 的默认值全都是「不写列」。
    #[test]
    fn insert_default_skips_all_columns() {
        let v = OrderConfigInsert::default();
        assert_eq!(v.shop_id, None);
        assert_eq!(v.code, None);
        assert_eq!(v.data, None);
    }

    /// `SELECT` 清单必须与实体字段顺序一致（防止 `query_as` 错位）。
    #[test]
    fn select_list_matches_entity_columns() {
        assert_eq!(
            ORDER_CONFIG_SELECT,
            "SELECT id, shop_id, code, data FROM order_config"
        );
    }
}