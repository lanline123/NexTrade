//! 首页分类栏（H5）域（content::mobile_cat_nav）仓储：`mobile_cat_nav`（+ 只读关联 `category`）。
//!
//! 对应原 Java `com.tigshop.mapper.decorate.MobileCatNavMapper`
//! （`BaseMapper<MobileCatNav>` + `BaseServiceImpl` 的通用方法），
//! 以及 `MobileCatNavServiceImpl#list` 里对 `CategoryService#getCategoryByIds`
//! 的关联查询。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table mobile_cat_nav`）：
//!
//! `mobile_cat_nav`（9 列，主键 `mobile_cat_nav_id`）：
//! `mobile_cat_nav_id` / `category_id` / `cat_color` / `child_cat_ids` /
//! `brand_ids` / `is_show` / `img_url` / `sort_order` / `cat_name_alias`
//! —— 除 `cat_name_alias`（`varchar(255) NULL`）外全部 `NOT NULL`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::{Category, MobileCatNav};
use tigshop_core::models::content::mobile_cat_nav::MobileCatNavListQuery;
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
/// 与 `entities::MobileCatNav` 的 9 个字段一一对应，顺序也一致）。
const MOBILE_CAT_NAV_SELECT: &str = "SELECT mobile_cat_nav_id, category_id, cat_color, \
     child_cat_ids, brand_ids, is_show, img_url, sort_order, cat_name_alias \
     FROM mobile_cat_nav";

#[derive(Clone)]
pub struct MobileCatNavRepository {
    pool: MySqlPool,
}

impl MobileCatNavRepository {
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

    /// 首页分类栏分页（对应 Java `MobileCatNavServiceImpl#list` 的 `this.page(...)`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `isShow`：**只有 0 / 1** 才 `eq`（Java 的双重判断，由
    ///   [`MobileCatNavListQuery::effective_is_show`] 表达）
    /// - `keyword`：`category_id LIKE %keyword%`（Java
    ///   `like(MobileCatNav::getCategoryId, keyword)` —— **拿整型列做 LIKE**，
    ///   靠 MySQL 把 `category_id` 隐式转成字符串比较，照抄不改）
    /// - ORDER BY：由 [`MobileCatNavListQuery::order_clause`] 生成
    ///
    /// ⚠️ Java `LambdaQueryWrapper` 未显式指定 ORDER BY 时，
    /// `buildSortOrder` 总会被调用并追加一个 ORDER BY（见 `order_clause`），
    /// 只有「`sortOrder` 非空且既非 asc 也非 desc」时才没有排序。
    pub async fn paginate(&self, q: &MobileCatNavListQuery) -> Result<(u64, Vec<MobileCatNav>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM mobile_cat_nav WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{MOBILE_CAT_NAV_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::content::mobile_cat_nav::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<MobileCatNav> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &MobileCatNavListQuery) {
        if let Some(is_show) = q.effective_is_show() {
            qb.push(" AND is_show = ");
            qb.push_bind(is_show);
        }
        if let Some(keyword) = q.effective_keyword() {
            // Java `like(MobileCatNav::getCategoryId, keyword)`：
            // 对 `category_id`（int unsigned）做 LIKE，MySQL 隐式转字符串。
            qb.push(" AND category_id LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<MobileCatNav>> {
        sqlx::query_as::<_, MobileCatNav>(&format!(
            "{MOBILE_CAT_NAV_SELECT} WHERE mobile_cat_nav_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按 `category_id` 批量取分类名（对应 Java `MobileCatNavServiceImpl#list`
    /// 里的 `categoryService.getCategoryByIds(categoryIds)`）。
    ///
    /// Java `CategoryServiceImpl#getCategoryByIds`（第 353–360 行）：
    /// ```text
    /// if (ids == null || ids.isEmpty()) return List.of();
    /// wrapper.in(Category::getCategoryId, ids);
    /// return this.list(wrapper);
    /// ```
    /// —— **没有** `is_show` 之类的附加过滤，纯 `IN`。
    ///
    /// `list` 关联其实只需要 `category_name`，但 `Category` 实体有 15 个字段，
    /// `FromRow` 少取列会直接报错，因此这里取 `category` 表的**全部 15 列**
    /// （顺序与 `entities::Category` 的字段顺序一致）。
    pub async fn find_categories_by_ids(&self, ids: &[i32]) -> Result<Vec<Category>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT category_id, category_name, seo_identification, keywords, category_desc, \
             parent_id, sort_order, measure_unit, is_show, seo_title, short_name, category_pic, \
             category_ico, is_hot, search_keywords FROM category WHERE category_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 分类是否存在（轻量存在性检查，避免全列映射）。
    ///
    /// 本切片**未**在任何链路上调用（Java 也没做外键校验），
    /// 保留它是为了让 `category` 的读取集中在本切片仓储里，便于后续
    /// `create` 时补「分类必须存在」的校验；不影响覆盖率统计。
    pub async fn category_exists(&self, category_id: i32) -> Result<bool> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM category WHERE category_id = ?")
                .bind(category_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0 > 0)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增首页分类栏，返回自增主键（对应 Java `save`）。
    ///
    /// Java `create` 先 `BeanUtils.copyProperties(createDTO, mobileCatNav)`
    /// 再覆盖三列 JSON，因此**只有 DTO 里非 null 的字段**会写进实体，
    /// 其余保持 `null` ⇒ MyBatis-Plus `FieldStrategy.NOT_NULL` 跳过该列
    /// ⇒ 由 MySQL 施加列默认值（本表 8 列 `NOT NULL` 且 `pure.sql` 未声明
    /// 显式 DEFAULT，MySQL 对整型隐含默认 `0`、对 `varchar`/`text` 隐含 `''`）。
    /// 因此这里用三态 `Option` 区分「写列」与「不写列」。
    pub async fn insert(&self, v: &MobileCatNavInsert) -> Result<i32> {
        // 固定顺序保证 SQL 可预测；只 push 有值的列。
        let mut columns: Vec<&'static str> = Vec::with_capacity(9);
        if v.category_id.is_some() {
            columns.push("category_id");
        }
        if v.cat_color.is_some() {
            columns.push("cat_color");
        }
        if v.child_cat_ids.is_some() {
            columns.push("child_cat_ids");
        }
        if v.brand_ids.is_some() {
            columns.push("brand_ids");
        }
        if v.is_show.is_some() {
            columns.push("is_show");
        }
        if v.img_url.is_some() {
            columns.push("img_url");
        }
        if v.sort_order.is_some() {
            columns.push("sort_order");
        }
        if v.cat_name_alias.is_some() {
            columns.push("cat_name_alias");
        }

        if columns.is_empty() {
            // Java `save` 全 null 实体 ⇒ MyBatis-Plus 生成
            // `INSERT INTO mobile_cat_nav () VALUES ()`，MySQL 语法错误。
            // 这里给出可诊断的校验错误而不是拼出非法 SQL。
            return Err(Error::Validation(
                "首页分类栏无任何可写入字段".to_string(),
            ));
        }

        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO mobile_cat_nav ({}) VALUES ({placeholders})",
            columns.join(", ")
        );

        // 绑定顺序必须与 columns 完全一致：按同一判据再走一遍。
        let mut query = sqlx::query(&sql);
        if let Some(category_id) = v.category_id {
            query = query.bind(category_id);
        }
        if let Some(cat_color) = v.cat_color.as_ref() {
            query = query.bind(cat_color);
        }
        if let Some(child_cat_ids) = v.child_cat_ids.as_ref() {
            query = query.bind(child_cat_ids);
        }
        if let Some(brand_ids) = v.brand_ids.as_ref() {
            query = query.bind(brand_ids);
        }
        if let Some(is_show) = v.is_show {
            query = query.bind(is_show);
        }
        if let Some(img_url) = v.img_url.as_ref() {
            query = query.bind(img_url);
        }
        if let Some(sort_order) = v.sort_order {
            query = query.bind(sort_order);
        }
        if let Some(cat_name_alias) = v.cat_name_alias.as_ref() {
            query = query.bind(cat_name_alias);
        }

        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ `MobileCatNavUpdateDTO` 全部字段（含 `mobileCatNavId`）都没有
    /// `@NotNull` 之外的必填约束，且 `update` 里三列 JSON 是**无条件**
    /// `toJson(...)`：`imgUrl` / `childCatIds` / `brandIds` 为 null 时
    /// `toJson` 返回 `null` ⇒ MyBatis-Plus 跳过那列（保留旧值）。
    pub async fn update(&self, id: i32, patch: &MobileCatNavPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE mobile_cat_nav SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "category_id", patch.category_id);
        push_assign!(sep, "cat_color", patch.cat_color);
        push_assign!(sep, "child_cat_ids", patch.child_cat_ids);
        push_assign!(sep, "brand_ids", patch.brand_ids);
        push_assign!(sep, "is_show", patch.is_show);
        push_assign!(sep, "img_url", patch.img_url);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "cat_name_alias", patch.cat_name_alias);
        drop(sep);
        qb.push(" WHERE mobile_cat_nav_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::content::mobile_cat_nav::MOBILE_CAT_NAV_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::content::mobile_cat_nav::MOBILE_CAT_NAV_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE mobile_cat_nav SET {column} = ? WHERE mobile_cat_nav_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `MobileCatNavServiceImpl#del` → `removeById`）。
    ///
    /// `mobile_cat_nav` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM mobile_cat_nav WHERE mobile_cat_nav_id = ?")
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
            QueryBuilder::new("DELETE FROM mobile_cat_nav WHERE mobile_cat_nav_id IN (");
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

/// 新增时待写入的首页分类栏。
///
/// 每个字段 `None` = 不写该列（⇒ 走 MySQL 列默认值），
/// 对应 Java `BeanUtils.copyProperties` 后实体字段为 `null`
/// 被 MyBatis-Plus `FieldStrategy.NOT_NULL` 跳过的行为。
#[derive(Debug, Clone, Default)]
pub struct MobileCatNavInsert {
    /// `category_id`
    pub category_id: Option<i32>,
    /// `cat_color`
    pub cat_color: Option<String>,
    /// `child_cat_ids`（JSON 文本，服务层已序列化）
    pub child_cat_ids: Option<String>,
    /// `brand_ids`（JSON 文本；Java `toJson(null)` = null ⇒ 不写列）
    pub brand_ids: Option<String>,
    /// `is_show`
    pub is_show: Option<i32>,
    /// `img_url`（JSON 文本，服务层已序列化）
    pub img_url: Option<String>,
    /// `sort_order`
    pub sort_order: Option<i32>,
    /// `cat_name_alias`
    pub cat_name_alias: Option<String>,
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
pub struct MobileCatNavPatch {
    /// `category_id`
    pub category_id: Option<Option<i32>>,
    /// `cat_color`
    pub cat_color: Option<Option<String>>,
    /// `child_cat_ids`（JSON 文本）
    pub child_cat_ids: Option<Option<String>>,
    /// `brand_ids`（JSON 文本）
    pub brand_ids: Option<Option<String>>,
    /// `is_show`
    pub is_show: Option<Option<i32>>,
    /// `img_url`（JSON 文本）
    pub img_url: Option<Option<String>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `cat_name_alias`
    pub cat_name_alias: Option<Option<String>>,
}

impl MobileCatNavPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.category_id, Some(Some(_)))
            && !matches!(self.cat_color, Some(Some(_)))
            && !matches!(self.child_cat_ids, Some(Some(_)))
            && !matches!(self.brand_ids, Some(Some(_)))
            && !matches!(self.is_show, Some(Some(_)))
            && !matches!(self.img_url, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.cat_name_alias, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("首页分类栏不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = MobileCatNavPatch {
            cat_name_alias: Some(Some(String::new())),
            is_show: Some(Some(0)),
            sort_order: Some(Some(0)),
            ..MobileCatNavPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = MobileCatNavPatch {
            category_id: None,
            cat_color: Some(None),
            ..MobileCatNavPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 全 `None` 补丁 ⇒ 不产生任何 `SET`（MyBatis-Plus 会生成非法 SQL，
    /// 服务层需据此短路）。
    #[test]
    fn default_patch_is_empty() {
        assert!(MobileCatNavPatch::default().is_empty());
    }

    /// `MobileCatNavInsert` 的默认值全都是「不写列」。
    #[test]
    fn insert_default_skips_all_columns() {
        let v = MobileCatNavInsert::default();
        assert_eq!(v.category_id, None);
        assert_eq!(v.cat_color, None);
        assert_eq!(v.child_cat_ids, None);
        assert_eq!(v.brand_ids, None);
        assert_eq!(v.is_show, None);
        assert_eq!(v.img_url, None);
        assert_eq!(v.sort_order, None);
        assert_eq!(v.cat_name_alias, None);
    }

    /// 固定 SELECT 清单必须包含实体全部 9 列（防止 `FromRow` 缺列）。
    #[test]
    fn select_list_covers_entity_columns() {
        for col in tigshop_core::models::content::mobile_cat_nav::MOBILE_CAT_NAV_COLUMNS {
            assert!(
                MOBILE_CAT_NAV_SELECT.contains(col),
                "SELECT 清单缺少列 {col}"
            );
        }
    }
}