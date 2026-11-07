//! 示例域（system::example）仓储：`example`。
//!
//! 对应原 Java `com.tigshop.mapper.example.ExampleMapper`
//! （`BaseMapper<Example>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table example`）：
//!
//! `example`（7 列，主键 `example_id`）：
//!
//! | 列 | 类型 | 可空 |
//! |----|------|------|
//! | `example_id` | `int unsigned` | NOT NULL（AUTO_INCREMENT） |
//! | `example_name` | `varchar(60)` | NOT NULL |
//! | `example_pic` | `varchar(80)` | NOT NULL |
//! | `example_desc` | `text` | NOT NULL |
//! | `sort_order` | `tinyint unsigned` | NOT NULL |
//! | `is_show` | `tinyint unsigned` | NOT NULL |
//! | `status` | `tinyint` | **NULL** |
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::setting::Example;
use tigshop_core::models::system::example::{is_show_filterable, ExampleListQuery};
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
/// 与 `entities::setting::Example` 的 7 个字段一一对应，顺序也一致）。
const EXAMPLE_SELECT: &str =
    "SELECT example_id, example_name, example_pic, example_desc, sort_order, is_show, status FROM example";

#[derive(Clone)]
pub struct ExampleRepository {
    pool: MySqlPool,
}

impl ExampleRepository {
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

    /// 示例分页（对应 Java `ExampleServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `isShow`：**仅当**值为 0 或 1 时 `eq(is_show, ?)`
    ///   （Java `IsShowType.fromTypeCode(isShow) != null`；
    ///   其它值含 null 都**不加**条件）
    /// - `keyword`：`example_name LIKE %keyword%`
    ///   （Java `StrUtil.isNotEmpty` —— 纯空白**仍**算有效关键字）
    ///
    /// ORDER BY 由 [`ExampleListQuery::order_clause`] 生成
    /// （Java **无条件**调 `buildSortOrder`，`sortField` 空 ⇒ 主键列 DESC）。
    pub async fn paginate(&self, q: &ExampleListQuery) -> Result<(u64, Vec<Example>)> {
        let page = q.page_query();
        let (limit, offset) = page.limit_offset();

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM example WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{EXAMPLE_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::system::example::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<Example> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    ///
    /// ⚠️ `is_show` 的过滤条件必须走 [`is_show_filterable`]
    /// （只有 0/1 才加条件），否则 `isShow=2` 会被当成有效筛选，
    /// 与 Java 行为不一致（Java 返回全部数据）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &ExampleListQuery) {
        if is_show_filterable(q.is_show) {
            qb.push(" AND is_show = ");
            qb.push_bind(q.is_show);
        }
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND example_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<Example>> {
        sqlx::query_as::<_, Example>(&format!("{EXAMPLE_SELECT} WHERE example_id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增示例，返回自增主键（对应 Java `save`）。
    ///
    /// `Option` 字段为 `None` 时**不写该列**，由 MySQL 施加列默认值
    /// （MyBatis-Plus `FieldStrategy.NOT_NULL` 的等价语义）。
    pub async fn insert(&self, v: &ExampleInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(7);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(7);

        if let Some(name) = v.example_name.as_deref() {
            columns.push("example_name");
            binds.push(InsertValue::Text(name));
        }
        if let Some(pic) = v.example_pic.as_deref() {
            columns.push("example_pic");
            binds.push(InsertValue::Text(pic));
        }
        if let Some(desc) = v.example_desc.as_deref() {
            columns.push("example_desc");
            binds.push(InsertValue::Text(desc));
        }
        if let Some(order) = v.sort_order {
            columns.push("sort_order");
            binds.push(InsertValue::Int(order));
        }
        if let Some(is_show) = v.is_show {
            columns.push("is_show");
            binds.push(InsertValue::Int(is_show));
        }
        if let Some(status) = v.status {
            columns.push("status");
            binds.push(InsertValue::Int(status));
        }

        // 所有列都没值时也要能编译出合法 SQL：Java 的 `save` 同样会
        // 生成 `INSERT INTO example () VALUES ()` 并让 MySQL 用默认值。
        // MySQL 支持这种写法，因此这里不加特殊分支，保持一致。
        let sql = if columns.is_empty() {
            "INSERT INTO example () VALUES ()".to_string()
        } else {
            let placeholders = vec!["?"; columns.len()].join(", ");
            format!(
                "INSERT INTO example ({}) VALUES ({placeholders})",
                columns.join(", ")
            )
        };
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

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义）。
    ///
    /// ⚠️ Java `update` 的写法是**直接 new 一个空实体**
    /// （`Example example = new Example()` 后
    /// `BeanUtils.copyProperties(updateDTO, example)`），**不是**先 `getById`。
    /// 因此 DTO 里没传的字段是 `null`，被 NOT_NULL 策略跳过
    /// ⇒ **保留库里的旧值**。本实现由服务层构造补丁即可。
    ///
    /// ⚠️ 注意本域的 `update` **无法改 `example_desc`**
    /// （`ExampleUpdateDTO` 没有该字段），因此补丁里 `example_desc`
    /// 由服务层显式传 `None`（不写列）。
    pub async fn update(&self, id: i32, patch: &ExamplePatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE example SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "example_name", patch.example_name);
        push_assign!(sep, "example_pic", patch.example_pic);
        push_assign!(sep, "example_desc", patch.example_desc);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "is_show", patch.is_show);
        push_assign!(sep, "status", patch.status);
        drop(sep);
        qb.push(" WHERE example_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自
    /// [`tigshop_core::models::system::example::EXAMPLE_COLUMNS`] 的白名单映射
    /// （服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::system::example::EXAMPLE_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE example SET {column} = ? WHERE example_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `removeById`）。
    ///
    /// `example` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM example WHERE example_id = ?")
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
            QueryBuilder::new("DELETE FROM example WHERE example_id IN (");
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

/// 新增时待写入的示例（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
#[derive(Debug, Clone, Default)]
pub struct ExampleInsert {
    /// `example_name`（`None` ⇒ 不写列）
    pub example_name: Option<String>,
    /// `example_pic`（`None` ⇒ 不写列）
    pub example_pic: Option<String>,
    /// `example_desc`（`None` ⇒ 不写列）
    pub example_desc: Option<String>,
    /// `sort_order`（`None` ⇒ 不写列）
    pub sort_order: Option<i32>,
    /// `is_show`（`None` ⇒ 不写列）
    pub is_show: Option<i32>,
    /// `status`（`None` ⇒ 不写列；该列可空）
    pub status: Option<i32>,
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
pub struct ExamplePatch {
    /// `example_name`
    pub example_name: Option<Option<String>>,
    /// `example_pic`
    pub example_pic: Option<Option<String>>,
    /// `example_desc`（本域 `update` 不会写它，保留给其它调用点）
    pub example_desc: Option<Option<String>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `is_show`
    pub is_show: Option<Option<i32>>,
    /// `status`（可空列：`Some(Some(v))` 写值，`Some(None)` 仍不写）
    pub status: Option<Option<i32>>,
}

impl ExamplePatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.example_name, Some(Some(_)))
            && !matches!(self.example_pic, Some(Some(_)))
            && !matches!(self.example_desc, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.is_show, Some(Some(_)))
            && !matches!(self.status, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("示例不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = ExamplePatch {
            example_name: Some(Some(String::new())),
            sort_order: Some(Some(0)),
            ..ExamplePatch::default()
        };
        assert!(!patch.is_empty());

        let empty = ExamplePatch {
            example_name: None,
            example_pic: Some(None),
            ..ExamplePatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 默认补丁为「不写任何列」。
    #[test]
    fn patch_default_is_empty() {
        assert!(ExamplePatch::default().is_empty());
    }

    /// 每个字段都能独立触发「会写」。
    #[test]
    fn patch_each_field_triggers_write() {
        let cases = [
            ExamplePatch {
                example_name: Some(Some("x".into())),
                ..Default::default()
            },
            ExamplePatch {
                example_pic: Some(Some(String::new())),
                ..Default::default()
            },
            ExamplePatch {
                example_desc: Some(Some("d".into())),
                ..Default::default()
            },
            ExamplePatch {
                sort_order: Some(Some(0)),
                ..Default::default()
            },
            ExamplePatch {
                is_show: Some(Some(0)),
                ..Default::default()
            },
            ExamplePatch {
                status: Some(Some(1)),
                ..Default::default()
            },
        ];
        for (i, p) in cases.iter().enumerate() {
            assert!(!p.is_empty(), "第 {i} 个补丁应被判为「会写」");
        }
    }

    /// `ExampleInsert::default()` 全是「不写列」（走 MySQL 默认值）。
    #[test]
    fn insert_default_skips_all_columns() {
        let v = ExampleInsert::default();
        assert!(v.example_name.is_none());
        assert!(v.example_pic.is_none());
        assert!(v.example_desc.is_none());
        assert!(v.sort_order.is_none());
        assert!(v.is_show.is_none());
        assert!(v.status.is_none());
    }

    /// SELECT 子句必须覆盖全部 7 列，且不得使用 `SELECT *`。
    #[test]
    fn select_clause_lists_all_schema_columns() {
        for col in tigshop_core::models::system::example::EXAMPLE_COLUMNS {
            assert!(
                EXAMPLE_SELECT.contains(col),
                "SELECT 缺少列 {col}: {EXAMPLE_SELECT}"
            );
        }
        assert!(!EXAMPLE_SELECT.contains('*'));
    }
}