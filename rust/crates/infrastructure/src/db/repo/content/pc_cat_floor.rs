//! PC 分类抽屉域（content::pc_cat_floor）仓储：`pc_cat_floor` + `category`。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table pc_cat_floor`）：
//!
//! - `pc_cat_floor`（10 列，主键 `cat_floor_id`）：
//!   `cat_floor_id` / `cat_floor_name` / `category_ids` / `category_names` /
//!   `floor_ico` / `hot_cat` / `is_show` / `sort_order` / `floor_ico_font` /
//!   `brand_ids`
//!   其中 `category_ids` / `category_names` / `brand_ids` 三列都是
//!   `varchar NOT NULL`，存 JSON 文本（`null` 会被写成字面量 `"null"`）。
//! - `category`（本域只读 3 列）：`category_id` / `category_name` / `parent_id`
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::{Category, PcCatFloor};
use tigshop_core::models::content::pc_cat_floor::PcCatFloorListQuery;
use tigshop_core::{Error, Result};

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<Option<T>>`：
/// - 外层 `None`（JSON 缺键）与内层 `None`（JSON 显式 null）都**不写该列**
///   —— 对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`
/// - `Some(Some(v))` 才绑定参数
///
/// 用宏而非函数是为了避免 `sqlx::query_builder::Separated` 的多重生命周期
/// 参数在辅助函数签名里难以书写（与 admin_user 的 `bind_all!` 同一思路）。
macro_rules! push_assign {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(Some(v)) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind_unseparated(v);
        }
    };
}

/// 新增时待写入的分类抽屉（对应 Java 实体 `PcCatFloor` 的 `null` 语义：
/// `None` = MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 跳过该列，
/// 于是 MySQL 会施加库级 DEFAULT，而不是写入 `0` / `''`）。
///
/// 这与 [`FloorPatch`] 的三态不同 —— `create` 走的是 `INSERT`，
/// 未列出的列由数据库补默认值；`update` 走的是 `UPDATE ... SET`，未列出的列保持原值。
#[derive(Debug, Clone, Default)]
pub struct FloorInsert {
    /// `cat_floor_name`
    pub cat_floor_name: Option<String>,
    /// `category_ids`（JSON 文本；Java `create` 已把 null 转成 `"null"`）
    pub category_ids: Option<String>,
    /// `category_names`（JSON 文本；同上）
    pub category_names: Option<String>,
    /// `floor_ico`
    pub floor_ico: Option<String>,
    /// `hot_cat`
    pub hot_cat: Option<String>,
    /// `is_show`
    pub is_show: Option<i32>,
    /// `sort_order`
    pub sort_order: Option<i32>,
    /// `floor_ico_font`
    pub floor_ico_font: Option<String>,
    /// `brand_ids`（JSON 文本；同上）
    pub brand_ids: Option<String>,
}

/// INSERT 的绑定值（避免为 7 个文本列 + 2 个整型列定义 9 个平行 `Vec`）。
#[derive(Debug, Clone, Copy)]
enum SqlBind<'a> {
    /// 文本列
    Text(&'a str),
    /// 整型列
    Int(i32),
}

/// 列表查询的固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合）。
const FLOOR_SELECT: &str = "SELECT cat_floor_id, cat_floor_name, category_ids, category_names, \
                            floor_ico, hot_cat, is_show, sort_order, floor_ico_font, brand_ids \
                            FROM pc_cat_floor";

/// `update` 的部分更新补丁（对应 MyBatis-Plus `updateById` 的
/// `FieldStrategy.NOT_NULL`：**只写非 null 字段**）。
///
/// 每个字段的三种状态：
/// - `None`：JSON 里缺该键 ⇒ 与 Java 的 `null` 等价 ⇒ **不写该列**
/// - `Some(None)`：JSON 显式 `null` ⇒ 同样 **不写该列**
/// - `Some(Some(v))`：写该列
///
/// ⚠️ 关键差异（已核对 mybatis-plus 3.5 的 `NOT_NULL` 策略）：
/// Java 只跳过 `null`，**空串 `""` 与 `0` 都会照常写入**。
/// 因此本补丁不能用「值为空就跳过」的简化写法，必须由调用方显式构造
/// `Some(Some(""))` / `Some(Some(0))`。
#[derive(Debug, Clone, Default)]
pub struct FloorPatch {
    /// `cat_floor_name`
    pub cat_floor_name: Option<Option<String>>,
    /// `category_ids`（JSON 文本；显式 null 时 Java 写入字面量 `"null"`）
    pub category_ids: Option<Option<String>>,
    /// `category_names`（JSON 文本；同上）
    pub category_names: Option<Option<String>>,
    /// `floor_ico`
    pub floor_ico: Option<Option<String>>,
    /// `hot_cat`
    pub hot_cat: Option<Option<String>>,
    /// `is_show`
    pub is_show: Option<Option<i32>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `floor_ico_font`
    pub floor_ico_font: Option<Option<String>>,
    /// `brand_ids`（JSON 文本；同上）
    pub brand_ids: Option<Option<String>>,
}

impl FloorPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据与 `push_assign!` 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都不产生 `SET` 片段。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.cat_floor_name, Some(Some(_)))
            && !matches!(self.category_ids, Some(Some(_)))
            && !matches!(self.category_names, Some(Some(_)))
            && !matches!(self.floor_ico, Some(Some(_)))
            && !matches!(self.hot_cat, Some(Some(_)))
            && !matches!(self.is_show, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.floor_ico_font, Some(Some(_)))
            && !matches!(self.brand_ids, Some(Some(_)))
    }
}

#[derive(Clone)]
pub struct PcCatFloorRepository {
    pool: MySqlPool,
}

impl PcCatFloorRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— pc_cat_floor 查询 —————————————————————

    /// 分类抽屉分页（对应 Java `PcCatFloorServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `is_show`：仅当值为 0/1 时生效（不合法值整体忽略该条件）
    /// - `keyword`：`cat_floor_name LIKE %kw%`（Java `StrUtil.isNotEmpty`）
    /// - ORDER BY：由 [`PcCatFloorListQuery::order_clause`] 生成
    ///   （Java `buildSortOrder`，未识别字段回退主键列）
    ///
    /// ⚠️ Java `MyBatis-Plus` 在 `sortField` 为空时**也会**追加主键排序，
    /// 但 MySQL 的 `ORDER BY` 在无显式排序时结果本就不确定，故此处**总是**
    /// 追加显式 ORDER BY（等价且更稳定）。
    pub async fn paginate_floors(&self, q: &PcCatFloorListQuery) -> Result<(u64, Vec<PcCatFloor>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM pc_cat_floor WHERE 1 = 1");
        self.push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{FLOOR_SELECT} WHERE 1 = 1"));
        self.push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::content::pc_cat_floor::map_order_column 的白名单，
        // 方向来自 asc/desc 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<PcCatFloor> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(&self, qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &PcCatFloorListQuery) {
        if let Some(v) = q.effective_is_show() {
            qb.push(" AND is_show = ");
            qb.push_bind(v);
        }
        if let Some(kw) = q.effective_keyword() {
            qb.push(" AND cat_floor_name LIKE ");
            qb.push_bind(format!("%{kw}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    ///
    /// JSON 文本列原样返回，由 VO 层决定是否解析（`list` 不解析、`detail` 解析）。
    pub async fn find_floor(&self, id: i32) -> Result<Option<PcCatFloor>> {
        sqlx::query_as::<_, PcCatFloor>(&format!("{FLOOR_SELECT} WHERE cat_floor_id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    // ————————————————————— pc_cat_floor 写入 —————————————————————

    /// 新增分类抽屉，返回自增主键（对应 Java `save` / `INSERT`）。
    ///
    /// ⚠️ **必须只写「非 null」的列**，与 MyBatis-Plus 的
    /// `FieldStrategy.NOT_NULL` 完全一致。原因是本表多列带库级默认值
    /// （`is_show` DEFAULT 1、`sort_order` DEFAULT 50、文本列 DEFAULT ''），
    /// 而 Java 在 DTO 缺值时**不写该列**、由 MySQL 施加默认值。
    /// 若这里改成「缺值写 0 / 写空串」，`is_show` 会从 1 变成 0、
    /// `sort_order` 会从 50 变成 0 —— 是**静默的数据语义错误**。
    ///
    /// 特别注意 `category_ids` / `category_names` / `brand_ids`：Java 在
    /// `create` 里已经把 `null` 转成了**字面量字符串 `"null"`**
    /// （`JsonUtil.toJson(null)`），所以这三列的 `None` 只表示
    /// 「DTO 缺键 ⇒ 不写列 ⇒ 走 DEFAULT ''」，与 `update` 的语义不同。
    pub async fn insert_floor(&self, f: &FloorInsert) -> Result<i32> {
        // 逐列判断「是否要写」。这里刻意写成 9 个显式分支而不是循环：
        // 列的 SQL 字面量、绑定顺序、参数类型三者必须在源码里一眼可核对，
        // 而 INSERT 的列清单与参数顺序一旦错位，只有连库跑才会暴露。
        let mut columns: Vec<&'static str> = Vec::with_capacity(9);
        let mut binds: Vec<SqlBind<'_>> = Vec::with_capacity(9);

        if let Some(v) = f.cat_floor_name.as_deref() {
            columns.push("cat_floor_name");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.category_ids.as_deref() {
            columns.push("category_ids");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.category_names.as_deref() {
            columns.push("category_names");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.floor_ico.as_deref() {
            columns.push("floor_ico");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.hot_cat.as_deref() {
            columns.push("hot_cat");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.is_show {
            columns.push("is_show");
            binds.push(SqlBind::Int(v));
        }
        if let Some(v) = f.sort_order {
            columns.push("sort_order");
            binds.push(SqlBind::Int(v));
        }
        if let Some(v) = f.floor_ico_font.as_deref() {
            columns.push("floor_ico_font");
            binds.push(SqlBind::Text(v));
        }
        if let Some(v) = f.brand_ids.as_deref() {
            columns.push("brand_ids");
            binds.push(SqlBind::Text(v));
        }

        if columns.is_empty() {
            return Err(Error::Validation("创建分类抽屉至少需要一个字段".into()));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO pc_cat_floor ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for b in &binds {
            query = match b {
                SqlBind::Text(v) => query.bind(*v),
                SqlBind::Int(v) => query.bind(*v),
            };
        }
        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 部分更新（对应 Java `updateById` + `FieldStrategy.NOT_NULL`）。
    ///
    /// 返回受影响行数；`0` 表示主键不存在**或**新旧值完全相同，
    /// 与 MyBatis-Plus 的返回值语义一致（调用方不得据 `0` 判定记录不存在）。
    pub async fn update_floor(&self, id: i32, patch: &FloorPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("UPDATE pc_cat_floor SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "cat_floor_name", patch.cat_floor_name);
        push_assign!(sep, "category_ids", patch.category_ids);
        push_assign!(sep, "category_names", patch.category_names);
        push_assign!(sep, "floor_ico", patch.floor_ico);
        push_assign!(sep, "hot_cat", patch.hot_cat);
        push_assign!(sep, "is_show", patch.is_show);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "floor_ico_font", patch.floor_ico_font);
        push_assign!(sep, "brand_ids", patch.brand_ids);
        drop(sep);
        qb.push(" WHERE cat_floor_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::content::pc_cat_floor::PC_CAT_FLOOR_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_floor_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::content::pc_cat_floor::PC_CAT_FLOOR_COLUMNS.contains(&column),
            "update_floor_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE pc_cat_floor SET {column} = ? WHERE cat_floor_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `BaseServiceImpl#del` → `removeById`）。
    pub async fn delete_floor(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM pc_cat_floor WHERE cat_floor_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量硬删除（对应 Java `removeByIds`）。
    ///
    /// 返回**实际删除的行数**；Java 的 `removeByIds` 返回
    /// `SqlHelper.retBool(rows)`（`rows >= 1`），调用方据此折算布尔值。
    pub async fn delete_floors(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM pc_cat_floor WHERE cat_floor_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    // ————————————————————— category（只读，用于拼 cat_floor_name） —————————————————————

    /// 按 ID 批量取分类（对应 Java `CategoryService#getById` 的逐个调用，
    /// 此处合并为一次 `IN` 查询以消除 N+1；结果顺序**不保证**，
    /// 调用方必须按自己的 ID 顺序重新对齐）。
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
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("分类抽屉不存在".into()),
        other => Error::Database(other.to_string()),
    }
}