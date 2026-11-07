//! 店铺商品分类信息域（merchant::shop_product_category）仓储：`shop_product_category`（+ `product` 的级联解绑）。
//!
//! 对应原 Java `com.tigshop.mapper.shop.ShopProductCategoryMapper`
//! （`BaseMapper<ShopProductCategory>` + `BaseServiceImpl` 的通用方法），
//! 外加 `delHandle` 里对 `productMapper` 的一次批量解绑。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table shop_product_category`）：
//!
//! `shop_product_category`（8 列，主键 `category_id`）：
//! - `category_id` `int unsigned` NOT NULL（自增主键）
//! - `category_name` `varchar(90)` NOT NULL
//! - `shop_id` `int unsigned` NOT NULL
//! - `parent_id` `smallint unsigned` NOT NULL
//! - `sort_order` `tinyint unsigned` NOT NULL
//! - `is_show` `tinyint unsigned` NOT NULL
//! - `add_time` `int` **NULL**
//! - `category_pic` `varchar(255)` NOT NULL
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::{Product, ShopProductCategory};
use tigshop_core::models::merchant::shop_product_category::ShopProductCategoryListQuery;
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

/// 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合）。
///
/// 顺序与 `entities::ShopProductCategory` 的 8 个字段完全一致，
/// 因此 `query_as` 可直接按位置映射（`sqlx(rename_all = "snake_case")`）。
const CATEGORY_SELECT: &str = "SELECT category_id, category_name, shop_id, parent_id, \
     sort_order, is_show, add_time, category_pic FROM shop_product_category";

/// 分类列表 / 树 / 子级计数共用的排序（对应 Java
/// `orderByAsc(parentId).orderByAsc(sortOrder).orderByAsc(categoryId)`）。
const TREE_ORDER: &str = " ORDER BY parent_id ASC, sort_order ASC, category_id ASC";

#[derive(Clone)]
pub struct ShopProductCategoryRepository {
    pool: MySqlPool,
}

impl ShopProductCategoryRepository {
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

    /// 店铺商品分类分页（对应 Java `ShopProductCategoryServiceImpl#list` 的
    /// `this.page(page, queryWrapper)`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `parent_id`：Java `eq(listDTO.getParentId() != null, parentId, ...)`
    ///   ⇒ 非 null 时等值过滤（**`parentId = 0` 也会过滤**，与 `tree` 不同）
    /// - `shop_id`：Java `if (shopId != null && shopId > 0)` ⇒ 仅 `> 0` 才过滤。
    ///   注意 Java 控制器**总是**把 DTO 的 `shopId` 覆盖为请求头值，
    ///   服务层再套这个条件；因此平台账号（`shopId = 0`）时**不加**过滤
    ///   ⇒ 能跨店铺看到全部分类（Java 的实际可观测行为）。
    /// - `category_name`：见 [`ShopProductCategoryListQuery::effective_keyword`]
    ///   —— Java 条件写反，非空关键字**不过滤**，空串才产生 `LIKE '%%'`（恒真）。
    ///
    /// 返回 `(总数, 当前页行)`。
    pub async fn paginate(&self, q: &ShopProductCategoryListQuery, shop_id: Option<i32>) -> Result<(u64, Vec<ShopProductCategory>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM shop_product_category WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q, shop_id);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{CATEGORY_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q, shop_id);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::merchant::shop_product_category::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<ShopProductCategory> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &ShopProductCategoryListQuery,
        shop_id: Option<i32>,
    ) {
        if let Some(parent_id) = q.parent_id {
            qb.push(" AND parent_id = ");
            qb.push_bind(parent_id);
        }
        // Java `if (listDTO.getShopId() != null && listDTO.getShopId() > 0)`
        if let Some(sid) = shop_id.filter(|v| *v > 0) {
            qb.push(" AND shop_id = ");
            qb.push_bind(sid);
        }
        // Java 第 152 行的取反条件：只有「非 null 且空串」才拼 LIKE（恒真）
        if let Some(kw) = q.effective_keyword() {
            qb.push(" AND category_name LIKE ");
            qb.push_bind(format!("%{kw}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<ShopProductCategory>> {
        sqlx::query_as::<_, ShopProductCategory>(&format!(
            "{CATEGORY_SELECT} WHERE category_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按店铺查询分类（对应 Java `getCategoryAllChildIds` 里的
    /// `list(new LambdaQueryWrapper<ShopProductCategory>().eq(shopId, shopId))`）。
    ///
    /// **不带** `is_show` 过滤（Java 同样不带），三列升序。
    /// 供 [`crate::db::repo::merchant::shop_product_category::ShopProductCategoryRepository::find_by_shop`] 的调用方
    /// `getCategoryByParentId` / `getCategoryAllChildIds` 复用。
    pub async fn find_by_shop(&self, shop_id: i32) -> Result<Vec<ShopProductCategory>> {
        sqlx::query_as::<_, ShopProductCategory>(&format!(
            "{CATEGORY_SELECT} WHERE shop_id = ?{TREE_ORDER}"
        ))
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 店铺可见分类树的数据源（对应 Java `tree(shopId)`：
    /// `eq(shopId, ?).eq(isShow, 1)` + 三列升序）。
    ///
    /// ⚠️ Java **只**按 `shop_id` 与 `is_show` 过滤，**不**按 `parent_id` 过滤
    /// （`tree(shopId)` 传 `rootId = 0` 给 `TreeUtil.build`，由内存建树）。
    pub async fn find_visible_by_shop(&self, shop_id: i32) -> Result<Vec<ShopProductCategory>> {
        sqlx::query_as::<_, ShopProductCategory>(&format!(
            "{CATEGORY_SELECT} WHERE shop_id = ? AND is_show = 1{TREE_ORDER}"
        ))
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 统计某分类下的子分类数（对应 Java `list` 里的
    /// `lambdaQuery().eq(parentId, categoryId).count()`）。
    ///
    /// ⚠️ Java 的这条 count **不带** `shop_id` 约束（与所在 `list` 的过滤条件无关），
    /// 本实现照抄：`WHERE parent_id = ?` 单条件。
    pub async fn count_children(&self, category_id: i32) -> Result<i64> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM shop_product_category WHERE parent_id = ?")
                .bind(category_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增分类，返回自增主键（对应 Java `save`）。
    ///
    /// Java 的 `ShopProductCategoryServiceImpl#create` 先
    /// `BeanUtils.copyProperties(createDTO, entity)` 再
    /// `setAddTime(StringUtils.getCurrentTime())`，随后 `save`。
    /// MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 会跳过 `null` 列、
    /// 由 MySQL 施加列默认值。
    ///
    /// `add_time` 由服务层显式给出（Java 在该方法里强制覆盖，不取 DTO 值）。
    pub async fn insert(&self, v: &CategoryInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(7);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(7);

        columns.push("category_name");
        binds.push(InsertValue::Text(&v.category_name));
        if let Some(shop_id) = v.shop_id {
            columns.push("shop_id");
            binds.push(InsertValue::Int(shop_id));
        }
        if let Some(parent_id) = v.parent_id {
            columns.push("parent_id");
            binds.push(InsertValue::Int(parent_id));
        }
        if let Some(sort_order) = v.sort_order {
            columns.push("sort_order");
            binds.push(InsertValue::Int(sort_order));
        }
        if let Some(is_show) = v.is_show {
            columns.push("is_show");
            binds.push(InsertValue::Int(is_show));
        }
        columns.push("add_time");
        binds.push(InsertValue::Int(v.add_time));
        if let Some(pic) = v.category_pic.as_deref() {
            columns.push("category_pic");
            binds.push(InsertValue::Text(pic));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO shop_product_category ({}) VALUES ({placeholders})",
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

    /// 整行部分更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ Java `ShopProductCategoryUpdateDTO` 七个业务字段都**没有** `@NotNull`。
    /// 为 null 时 MyBatis-Plus 跳过该列，原值保持不动
    /// —— 这正是 [`CategoryPatch`] 的三态语义。
    pub async fn update(&self, id: i32, patch: &CategoryPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE shop_product_category SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "category_name", patch.category_name);
        push_assign!(sep, "shop_id", patch.shop_id);
        push_assign!(sep, "parent_id", patch.parent_id);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "is_show", patch.is_show);
        push_assign!(sep, "category_pic", patch.category_pic);
        drop(sep);
        qb.push(" WHERE category_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `ShopProductCategoryServiceImpl#updateField`
    /// 里的 `this.update(updateWrapper)`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::merchant::shop_product_category::SHOP_PRODUCT_CATEGORY_FIELDS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    ///
    /// ⚠️ 白名单里的 `measure_unit` / `is_hot` **不是本表列**，
    /// 拼出的 SQL 会被 MySQL 以 `Unknown column` 拒绝 —— 这与 Java 线上一模一样，
    /// 属于**有意的缺陷复刻**（见 `models::shop_product_category` 模块头与 `uncertain_points`），
    /// 因此这里**不能**用 `debug_assert` 把它们拦下（那会改变可观测行为）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        let sql = format!("UPDATE shop_product_category SET {column} = ? WHERE category_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `removeById(id)`）。
    ///
    /// `shop_product_category` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM shop_product_category WHERE category_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 把引用了该分类的商品解绑（对应 Java `delHandle` 的
    /// `productMapper.updateById(product)` 循环）。
    ///
    /// Java 逐个 `selectList(shop_category_id = ?)` 后
    /// `setShopCategoryId(0)` + `updateById`（**逐行 UPDATE**）；
    /// 本实现用一条等价的 `UPDATE product SET shop_category_id = 0
    /// WHERE shop_category_id = ?`，净结果相同（同样是「置 0」，
    /// `product` 表没有 `shop_category_id = 0` 之外的字段被改动）。
    ///
    /// 返回受影响行数。
    pub async fn unbind_products(&self, category_id: i32) -> Result<u64> {
        let res = sqlx::query("UPDATE product SET shop_category_id = 0 WHERE shop_category_id = ?")
            .bind(category_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 查询引用了该分类的商品（对应 Java `delHandle` 里
    /// `productMapper.selectList(eq(shop_category_id, id))`）。
    ///
    /// 仅用于诊断 / 测试断言（Java 用它是为了逐行 update），
    /// 服务层的解绑走 [`Self::unbind_products`]。
    pub async fn find_products_by_category(&self, category_id: i32) -> Result<Vec<Product>> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM product WHERE shop_category_id = ? ORDER BY product_id ASC",
        )
        .bind(category_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }
}

/// 新增时待写入的分类（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
///
/// `category_name` 与 `add_time` 是必填（Java 在该方法里必然写入这两列）。
#[derive(Debug, Clone, Default)]
pub struct CategoryInsert {
    /// `category_name`（必填，服务层已校验）
    pub category_name: String,
    /// `shop_id`（控制器用请求头值覆盖；`None` ⇒ 不写列）
    pub shop_id: Option<i32>,
    /// `parent_id`（`None` ⇒ 不写列）
    pub parent_id: Option<i32>,
    /// `sort_order`（`None` ⇒ 不写列）
    pub sort_order: Option<i32>,
    /// `is_show`（`None` ⇒ 不写列）
    pub is_show: Option<i32>,
    /// `add_time`（秒级时间戳；Java 用 `StringUtils.getCurrentTime()` 覆盖）
    pub add_time: i32,
    /// `category_pic`（`None` ⇒ 不写列）
    pub category_pic: Option<String>,
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
pub struct CategoryPatch {
    /// `category_name`
    pub category_name: Option<Option<String>>,
    /// `shop_id`
    pub shop_id: Option<Option<i32>>,
    /// `parent_id`
    pub parent_id: Option<Option<i32>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `is_show`
    pub is_show: Option<Option<i32>>,
    /// `category_pic`
    pub category_pic: Option<Option<String>>,
}

impl CategoryPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.category_name, Some(Some(_)))
            && !matches!(self.shop_id, Some(Some(_)))
            && !matches!(self.parent_id, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.is_show, Some(Some(_)))
            && !matches!(self.category_pic, Some(Some(_)))
    }
}

/// `sqlx::Error` → 项目 `Error`（与 area_code 同一映射）。
fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("分类不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = CategoryPatch {
            category_name: Some(Some(String::new())),
            is_show: Some(Some(0)),
            ..CategoryPatch::default()
        };
        assert!(!patch.is_empty());

        // 外层 None（明确不写）与内层 None（值为 null）都不产生 SET 片段
        let empty = CategoryPatch {
            category_name: None,
            category_pic: Some(None),
            ..CategoryPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// `CategoryInsert` 的可选列默认都是「不写列」；`add_time` 必写。
    #[test]
    fn insert_default_skips_optional_columns() {
        let v = CategoryInsert {
            category_name: "男装".into(),
            ..CategoryInsert::default()
        };
        assert_eq!(v.parent_id, None);
        assert_eq!(v.is_show, None);
        assert_eq!(v.category_pic, None);
        // `add_time` 不是 Option：默认 0，由服务层覆盖为当前时间戳
        assert_eq!(v.add_time, 0);
    }

    /// SELECT 列清单的列数与实体字段数一致，且不含幻觉列。
    #[test]
    fn select_columns_are_real_columns() {
        for col in [
            "category_id",
            "category_name",
            "shop_id",
            "parent_id",
            "sort_order",
            "is_show",
            "add_time",
            "category_pic",
        ] {
            assert!(CATEGORY_SELECT.contains(col), "SELECT 缺少列 {col}");
        }
        assert!(!CATEGORY_SELECT.contains("measure_unit"));
        assert!(!CATEGORY_SELECT.contains("is_hot"));
        // 固定顺序与实体字段声明顺序一致（query_as 按位置映射）
        let pos: Vec<usize> = [
            "category_id",
            "category_name",
            "shop_id",
            "parent_id",
            "sort_order",
            "is_show",
            "add_time",
            "category_pic",
        ]
        .iter()
        .map(|c| CATEGORY_SELECT.find(c).unwrap())
        .collect();
        assert!(pos.windows(2).all(|w| w[0] < w[1]), "SELECT 列顺序错乱");
    }
}