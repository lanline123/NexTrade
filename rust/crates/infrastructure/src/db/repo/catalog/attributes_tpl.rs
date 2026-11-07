//! 商品属性模板域（catalog::attributes_tpl）仓储：`product_attributes_tpl`。
//!
//! 对应原 Java `com.tigshop.mapper.product.AttributesTplMapper`
//! （`BaseMapper<AttributesTpl>`，**无自定义 SQL** —— 全部走
//! MyBatis-Plus 的通用方法 + `BaseServiceImpl`）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table product_attributes_tpl`）：
//!
//! `product_attributes_tpl`（5 列，主键 `tpl_id`）：
//! - `tpl_id`      `int unsigned` `NOT NULL` → `i32`
//! - `tpl_name`    `varchar(80)`  `NOT NULL` → `String`
//! - `tpl_data`    `text`         `NOT NULL` → `String`
//! - `shop_id`     `int unsigned` `NOT NULL` → `i32`
//! - `category_id` `int unsigned` `NULL`     → `Option<i32>`
//!
//! ⚠️ **本表没有任何软删列**（无 `is_del` / `delete_time`），
//! 也没有 `add_time` / `update_time` 审计列。因此：
//! - `del` / `batch(del)` 是**硬删除**（`DELETE FROM ...`）
//! - `list` 无「已删除」过滤条件
//!
//! ⚠️ `category_id` 是表里**唯一可空**的列，但 Java `AttributesTplDTO`
//! 给它加了 `@NotNull`。即：库允许 NULL，接口层不允许（见服务层校验）。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**（5 列全是整型与文本）。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::ProductAttributesTpl;
use tigshop_core::models::catalog::attributes_tpl::AttributesTplListQuery;
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
/// 与 `entities::ProductAttributesTpl` 的 5 个字段一一对应，顺序也一致）。
const TPL_SELECT: &str =
    "SELECT tpl_id, tpl_name, tpl_data, shop_id, category_id FROM product_attributes_tpl";

/// 商品属性模板域仓储（持有连接池）。
#[derive(Clone)]
pub struct AttributesTplRepository {
    pool: MySqlPool,
}

impl AttributesTplRepository {
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

    /// 属性模板分页（对应 Java `AttributesTplServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `shop_id = ?`：**恒定的归属过滤**，值由服务层传入
    ///   （Java `queryWrapper.eq(AttributesTpl::getShopId, shopId)`，
    ///   `shopId = Optional.ofNullable(HeaderUtils.getShopId()).orElse(0)`）
    /// - `tpl_name LIKE %keyword%`：仅当 `keyword` 非空
    ///   （Java `if (basePage.getKeyword() != null) queryWrapper.like(tplName, keyword)`）
    /// - ORDER BY：由 [`AttributesTplListQuery::order_clause`] 生成
    ///   （Java `buildSortOrder(page, sortField, sortOrder)`，
    ///   未识别字段回退主键列，非法 `sortOrder` 不追加排序）
    ///
    /// ⚠️ **`shop_id` 过滤条件必须恒在**：这是 Java 的多租户隔离点，
    /// 漏掉会导致店铺账号看到平台模板。因此它不走
    /// `AttributesTplListQuery`，而是作为独立入参强制传入。
    pub async fn paginate(
        &self,
        q: &AttributesTplListQuery,
        shop_id: i32,
    ) -> Result<(u64, Vec<ProductAttributesTpl>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM product_attributes_tpl WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q, shop_id);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{TPL_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q, shop_id);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::catalog::attributes_tpl::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<ProductAttributesTpl> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &AttributesTplListQuery,
        shop_id: i32,
    ) {
        // 归属过滤恒定存在（Java `eq(AttributesTpl::getShopId, shopId)`）
        qb.push(" AND shop_id = ");
        qb.push_bind(shop_id);
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND tpl_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
    }

    /// 按主键查询（对应 Java `getById` / `lambdaQuery().eq(tplId, id).one()`）。
    ///
    /// ⚠️ **不带 `shop_id` 条件** —— 归属校验由服务层的
    /// [`AttributesTplRepository::find_owned`] 负责。本方法供后台运维 / 调试使用。
    pub async fn find_by_id(&self, tpl_id: i32) -> Result<Option<ProductAttributesTpl>> {
        sqlx::query_as::<_, ProductAttributesTpl>(&format!(
            "{TPL_SELECT} WHERE tpl_id = ? LIMIT 1"
        ))
        .bind(tpl_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按主键 + 店铺归属查询
    /// （对应 Java `AttributesTplServiceImpl#assertOwned`）：
    /// ```text
    /// this.lambdaQuery()
    ///     .eq(AttributesTpl::getTplId, id)
    ///     .eq(AttributesTpl::getShopId, currentShopId())
    ///     .one()
    /// ```
    ///
    /// 这正是本域**所有写操作**的第一道闸：不属于当前店铺的模板一律查不到，
    /// 服务层据此报 `模板不已存在`（Java `Assert.notNull(..., TPL_NOT_FOUND)`）。
    ///
    /// Java 的 `.one()` 在命中多行时会抛 `TooManyResultsException`；
    /// 本实现加 `LIMIT 1` 取首行（`tpl_id` 是主键，正常情况下最多一行）。
    pub async fn find_owned(
        &self,
        tpl_id: i32,
        shop_id: i32,
    ) -> Result<Option<ProductAttributesTpl>> {
        sqlx::query_as::<_, ProductAttributesTpl>(&format!(
            "{TPL_SELECT} WHERE tpl_id = ? AND shop_id = ? LIMIT 1"
        ))
        .bind(tpl_id)
        .bind(shop_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按类目查询当前店铺的全部属性模板
    /// （对应 Java `AttributesTplServiceImpl#listByCategory`）：
    /// ```text
    /// this.lambdaQuery()
    ///     .eq(AttributesTpl::getShopId, Optional.ofNullable(HeaderUtils.getShopId()).orElse(0))
    ///     .eq(AttributesTpl::getCategoryId, categoryId)
    ///     .list()
    /// ```
    ///
    /// ⚠️ Java 这条查询**没有任何 ORDER BY**，因此返回顺序由 MySQL 决定
    /// （通常是主键序，但**不保证**）。本实现同样不追加 ORDER BY，
    /// 以逐字符复刻 Java 行为（见 `uncertain_points`）。
    ///
    /// ⚠️ `category_id` 可空：`= ?` 对 NULL 不成立，与 Java
    /// `eq(categoryId, categoryId)` 生成的 `category_id = ?` 行为一致
    /// （NULL 行不会被选中）。
    pub async fn find_by_category(
        &self,
        category_id: i32,
        shop_id: i32,
    ) -> Result<Vec<ProductAttributesTpl>> {
        sqlx::query_as::<_, ProductAttributesTpl>(&format!(
            "{TPL_SELECT} WHERE shop_id = ? AND category_id = ?"
        ))
        .bind(shop_id)
        .bind(category_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增属性模板，返回自增主键（对应 Java `save`）。
    ///
    /// 5 列**全部显式写入**：Java `convertToBean` 会把 DTO 的每个字段
    /// 都 set 到实体上（`BeanUtils.copyProperties`），其中：
    /// - `tpl_id` 由库自增（`@TableId(type = IdType.AUTO)`），不写
    /// - `tpl_name` / `shop_id` / `category_id` 必填（服务层已校验）
    /// - `tpl_data` 由 `Optional.ofNullable(dto.getTplData()).map(...).orElse("")`
    ///   兜底为**空串**（列 `NOT NULL`，空串合法）
    ///
    /// ⚠️ `category_id` **总是显式绑定**（含 `None` → SQL NULL）。这是对
    /// MyBatis-Plus `FieldStrategy.NOT_NULL` 的**有意偏离**：Java 在
    /// `categoryId` 为 null 时会**跳过该列**，由 MySQL 施加列默认值
    /// —— 而 `pure.sql` 里 `category_id` 是 `int unsigned DEFAULT NULL`，
    /// 两者净结果都是 NULL，故行为等价。服务层的 `@NotNull` 校验
    /// 已经拦掉了 null，这里显式绑定只是为了少一条分支。
    pub async fn insert(&self, v: &TplInsert) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO product_attributes_tpl (tpl_name, tpl_data, shop_id, category_id)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&v.tpl_name)
        .bind(&v.tpl_data)
        .bind(v.shop_id)
        .bind(v.category_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ Java `update` 先 `assertOwned(dto.getTplId())` 做归属校验，
    /// 再 `updateById(convertToBean(dto))`。**注意 `updateById` 的 WHERE
    /// 只有主键**，归属校验只在前面那道查询里做（存在 TOCTOU 窗口）。
    /// 本实现保持同样结构：服务层先 `find_owned`，这里按主键更新。
    ///
    /// ⚠️ `tpl_id` 不在 `SET` 列表里（Java `updateById` 也不会更新主键）。
    /// `shop_id` **会被写入**（Java `dto.setShopId(currentShopId())` 后
    /// `copyProperties`），但值恒等于服务层解析出的 `shop_id`。
    pub async fn update(&self, tpl_id: i32, patch: &TplPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE product_attributes_tpl SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "tpl_name", patch.tpl_name);
        push_assign!(sep, "tpl_data", patch.tpl_data);
        push_assign!(sep, "shop_id", patch.shop_id);
        push_assign!(sep, "category_id", patch.category_id);
        drop(sep);
        qb.push(" WHERE tpl_id = ");
        qb.push_bind(tpl_id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::catalog::attributes_tpl::TPL_FIELDS`]
    /// ∩ [`tigshop_core::models::catalog::attributes_tpl::TPL_COLUMNS`]（服务层负责），
    /// 此处只做调试断言。
    ///
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    ///
    /// ⚠️ Java 的 `UpdateWrapper` 只生成 `WHERE <主键> = ?`，
    /// **不含 `shop_id`** —— 归属校验由前面那次 `assertOwned` 完成。
    /// 本实现保持相同结构（见 `uncertain_points` 里的 TOCTOU 说明）。
    pub async fn update_field(&self, tpl_id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::catalog::attributes_tpl::TPL_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        debug_assert_ne!(column, "tpl_id", "update_field 不允许改主键");
        let sql = format!("UPDATE product_attributes_tpl SET {column} = ? WHERE tpl_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(tpl_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `AttributesTplServiceImpl#del` → `removeById`）。
    ///
    /// `product_attributes_tpl` 表**没有**软删标记列，因此就是 `DELETE`。
    ///
    /// ⚠️ Java `del` 先 `assertOwned(id)`（不存在 / 非本店铺 ⇒ 抛
    /// `模板不已存在`），再 `super.del(id)`（`id == null` 返回 false，
    /// 否则 `removeById`）。服务层负责前一步。
    pub async fn delete(&self, tpl_id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM product_attributes_tpl WHERE tpl_id = ?")
            .bind(tpl_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量硬删除（对应 Java `BaseServiceImpl#batch` → `removeByIds`）。
    ///
    /// 返回**实际删除的行数**；Java 的 `removeByIds` 返回
    /// `SqlHelper.retBool(rows)`（`rows >= 1`），调用方据此折算布尔值。
    ///
    /// ⚠️ 本方法**不带 `shop_id` 条件**：归属校验由服务层在调用前
    /// 对每个 id 逐个 `find_owned` 完成（Java `ids.forEach(this::assertOwned)`）。
    pub async fn delete_many(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM product_attributes_tpl WHERE tpl_id IN (");
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

/// 新增时待写入的属性模板。
///
/// `tpl_id` 由库自增，不在其中。`tpl_data` 是已编码的 JSON 文本
/// （`None` 在服务层已由 `encode_tpl_data` 折成空串）。
#[derive(Debug, Clone, Default)]
pub struct TplInsert {
    /// `tpl_name`（必填，服务层已校验）
    pub tpl_name: String,
    /// `tpl_data`（JSON 文本，`NOT NULL`）
    pub tpl_data: String,
    /// `shop_id`（必填，服务层已解析）
    pub shop_id: i32,
    /// `category_id`（列可空；服务层 `@NotNull` 校验后必为 `Some`）
    pub category_id: Option<i32>,
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
pub struct TplPatch {
    /// `tpl_name`
    pub tpl_name: Option<Option<String>>,
    /// `tpl_data`
    pub tpl_data: Option<Option<String>>,
    /// `shop_id`
    pub shop_id: Option<Option<i32>>,
    /// `category_id`
    pub category_id: Option<Option<i32>>,
}

impl TplPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.tpl_name, Some(Some(_)))
            && !matches!(self.tpl_data, Some(Some(_)))
            && !matches!(self.shop_id, Some(Some(_)))
            && !matches!(self.category_id, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("模板不已存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = TplPatch {
            tpl_name: Some(Some(String::new())),
            category_id: Some(Some(0)),
            ..TplPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = TplPatch {
            tpl_name: None,
            tpl_data: Some(None),
            ..TplPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 全默认补丁不下发任何 `SET` 片段。
    #[test]
    fn default_patch_is_empty() {
        assert!(TplPatch::default().is_empty());
    }

    /// `TplInsert` 必填列有默认值，`category_id` 默认 `None`（写 SQL NULL）。
    #[test]
    fn insert_defaults() {
        let v = TplInsert {
            tpl_name: "手机模板".into(),
            tpl_data: String::new(),
            shop_id: 0,
            category_id: None,
        };
        assert_eq!(v.category_id, None);
        assert!(v.tpl_data.is_empty());
    }

    /// SELECT 列清单必须与实体字段一一对应（顺序也一致）。
    #[test]
    fn select_columns_match_entity() {
        assert_eq!(
            TPL_SELECT,
            "SELECT tpl_id, tpl_name, tpl_data, shop_id, category_id FROM product_attributes_tpl"
        );
        // 表名与实体常量一致
        assert!(TPL_SELECT.contains(ProductAttributesTpl::TABLE));
        // 5 列，无 SELECT *
        assert!(!TPL_SELECT.contains('*'));
        for col in tigshop_core::models::catalog::attributes_tpl::TPL_COLUMNS {
            assert!(TPL_SELECT.contains(col), "SELECT 缺少列 {col}");
        }
    }
}