//! 区号管理域（system::area_code）仓储：`area_code`。
//!
//! 对应原 Java `com.tigshop.mapper.setting.AreaCodeMapper`
//! （`BaseMapper<AreaCode>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table area_code`）：
//!
//! `area_code`（5 列，主键 `id`）：
//! `id` / `code` / `name` / `is_available` / `is_default`
//! —— 全部 `NOT NULL`，其中 `code` / `name` 是 `varchar(64)`，
//! `is_available` / `is_default` 是 `tinyint unsigned`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::AreaCode;
use tigshop_core::models::system::area_code::AreaCodeListQuery;
use tigshop_core::{Error, Result};

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<Option<T>>`：
/// - 外层 `None`（调用方明确「不写该列」）与内层 `None`（值为 null）都**不写**
///   —— 对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`
/// - `Some(Some(v))` 才绑定参数
///
/// 用宏而非函数是为了避免 `sqlx::query_builder::Separated` 的多重生命周期
/// 参数在辅助函数签名里难以书写（与 admin_user / pc_cat_floor 同一思路）。
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
/// 与 `entities::AreaCode` 的 5 个字段一一对应，顺序也一致）。
const AREA_CODE_SELECT: &str = "SELECT id, code, name, is_available, is_default FROM area_code";

#[derive(Clone)]
pub struct AreaCodeRepository {
    pool: MySqlPool,
}

impl AreaCodeRepository {
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

    /// 区号分页（对应 Java `AreaCodeServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `name`：`name LIKE %name%`（Java `StrUtil.isNotEmpty(name)`）
    /// - ORDER BY：由 [`AreaCodeListQuery::order_clause`] 生成
    ///   （Java `buildSortOrder(page, sortField, sortOrder)`，
    ///   未识别字段回退主键列，非法 `sortOrder` 不追加排序）
    ///
    /// ⚠️ Java 在 `sortOrder` 为空时会显式降序（`else if` 分支），
    /// 只有「非空且既非 asc 也非 desc」的非法值才完全不排序。
    /// 这两种情况都由 `order_clause()` 表达，此处直接拼接。
    pub async fn paginate(&self, q: &AreaCodeListQuery) -> Result<(u64, Vec<AreaCode>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM area_code WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{AREA_CODE_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::system::area_code::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<AreaCode> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &AreaCodeListQuery) {
        if let Some(name) = q.effective_name() {
            qb.push(" AND name LIKE ");
            qb.push_bind(format!("%{name}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<AreaCode>> {
        sqlx::query_as::<_, AreaCode>(&format!("{AREA_CODE_SELECT} WHERE id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 查询全部「已启用」的区号，默认项排最前
    /// （对应 Java `AreaCodeServiceImpl#mobileAreaCode`：
    /// `eq(isAvailable, 1).orderByDesc(isDefault)`）。
    ///
    /// ⚠️ 本方法**不对应本切片的任何管理端路由**，供前台（注册/登录页区号选择）
    /// 的切片复用，见 `AreaCodeService::mobile_area_code`。
    pub async fn find_available(&self) -> Result<Vec<AreaCode>> {
        sqlx::query_as::<_, AreaCode>(&format!(
            "{AREA_CODE_SELECT} WHERE is_available = 1 ORDER BY is_default DESC, id ASC"
        ))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 统计「除 `exclude_id` 外」`code` 相同的记录数
    /// （对应 Java `checkAreaCode` 里的 `count(ne(areaCodeId != null, id, areaCodeId)
    /// .eq(code, param.getCode()))`）。
    ///
    /// `exclude_id = None` 表示新建场景，不排除任何记录
    /// （Java `ne(condition, ...)` 在条件为 false 时整个片段被丢弃）。
    pub async fn count_by_code(&self, code: &str, exclude_id: Option<i32>) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM area_code
             WHERE code = ? AND (? IS NULL OR id <> ?)",
        )
        .bind(code)
        .bind(exclude_id)
        .bind(exclude_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 统计「除 `exclude_id` 外」`name` 相同（用传入值比较）的记录数。
    ///
    /// ⚠️ **Java 原代码此处是一个 bug**：`AreaCodeServiceImpl#checkAreaCode`
    /// 第 144 行写的是
    /// `this.count(new LambdaQueryWrapper<AreaCode>()
    ///     .ne(null != areaCodeId, AreaCode::getId, areaCodeId)
    ///     .eq(AreaCode::getName, param.getCode()))` ——
    /// 拿 **`name` 列**去比较 **`code` 字段**（复制粘贴错误）。
    /// 因此 Java 实际做的是「`code` 已被占用 ⇒ 第二遍再查一次 `code`」，
    /// 且因为它排在 `code` 检查之后，**永远不可达**
    /// （`code` 重复时第一段已抛 `AREA_CODE_IS_EXISTS`），
    /// 于是 `AREA_CODE_NAME_IS_EXISTS`（「区号名称已存在」）**从未被抛出过**，
    /// 名称重复实际上**不校验**。
    ///
    /// 本方法保留**正确的**语义（按 `name` 列比较），由服务层决定是否启用；
    /// `tigshop_services::system::area_code::AreaCodeService::check_area_code` 默认
    /// **不调用**它，以逐字符复刻 Java 的可观测行为（见该方法的说明
    /// 与返回值的 `uncertain_points`）。
    pub async fn count_by_name(&self, name: &str, exclude_id: Option<i32>) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM area_code
             WHERE name = ? AND (? IS NULL OR id <> ?)",
        )
        .bind(name)
        .bind(exclude_id)
        .bind(exclude_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增区号，返回自增主键（对应 Java `save`）。
    ///
    /// 四个业务列都显式写入：Java 侧 `AreaCodeSaveParam.createAreaCode()`
    /// 构造实体时把 `isAvailable` / `isDefault` 一并 set（可能为 `null`），
    /// MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 会跳过 `null` 列、
    /// 由 MySQL 施加列默认值（本表两列 `NOT NULL` 且 `pure.sql` 未声明
    /// 显式 DEFAULT，MySQL 对 `tinyint unsigned NOT NULL` 隐含默认 `0`）。
    /// 因此这里用 [`InsertValue`] 区分「写列」与「不写列」。
    pub async fn insert(&self, v: &AreaCodeInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(4);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(4);

        columns.push("code");
        binds.push(InsertValue::Text(&v.code));
        columns.push("name");
        binds.push(InsertValue::Text(&v.name));
        if let Some(is_available) = v.is_available {
            columns.push("is_available");
            binds.push(InsertValue::Int(is_available));
        }
        if let Some(is_default) = v.is_default {
            columns.push("is_default");
            binds.push(InsertValue::Int(is_default));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO area_code ({}) VALUES ({placeholders})",
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
    /// ⚠️ Java `AreaCodeEditParam` 的四个业务字段都带 `@NotBlank` / 无 `@NotNull`：
    /// `code` / `name` 必填（`@NotBlank`），`isAvailable` / `isDefault`
    /// **可以为 null**。为 null 时 MyBatis-Plus 跳过该列，原值保持不动
    /// —— 这正是 [`AreaCodePatch`] 的三态语义。
    pub async fn update(&self, id: i32, patch: &AreaCodePatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE area_code SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "code", patch.code);
        push_assign!(sep, "name", patch.name);
        push_assign!(sep, "is_available", patch.is_available);
        push_assign!(sep, "is_default", patch.is_default);
        drop(sep);
        qb.push(" WHERE id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::system::area_code::AREA_CODE_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::system::area_code::AREA_CODE_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE area_code SET {column} = ? WHERE id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 把「除某条以外」的默认标记全部清 0
    /// （对应 Java `create` / `update` / `updateField` 里的
    /// `lambdaUpdate().set(isDefault, NO).eq(isDefault, YES).update()`）。
    ///
    /// `exclude_id` 为 `None` 时清全部（Java `create` 的写法就是无 `ne` 条件，
    /// 因为新记录还没入库）；为 `Some(id)` 时保留该条
    /// （本实现相对 Java 的有意收敛，见 `uncertain_points`）。
    pub async fn clear_default_flag(&self, exclude_id: Option<i32>) -> Result<u64> {
        let sql = "UPDATE area_code SET is_default = ?
                   WHERE is_default = ? AND (? IS NULL OR id <> ?)";
        let res = sqlx::query(sql)
            .bind(tigshop_core::models::system::area_code::NO)
            .bind(tigshop_core::models::system::area_code::YES)
            .bind(exclude_id)
            .bind(exclude_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `AreaCodeServiceImpl#del` → `removeById`）。
    ///
    /// `area_code` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM area_code WHERE id = ?")
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
            QueryBuilder::new("DELETE FROM area_code WHERE id IN (");
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

/// 新增时待写入的区号（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
#[derive(Debug, Clone, Default)]
pub struct AreaCodeInsert {
    /// `code`（必填，服务层已校验）
    pub code: String,
    /// `name`（必填，服务层已校验）
    pub name: String,
    /// `is_available`（`None` ⇒ 不写列）
    pub is_available: Option<i32>,
    /// `is_default`（`None` ⇒ 不写列）
    pub is_default: Option<i32>,
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
pub struct AreaCodePatch {
    /// `code`
    pub code: Option<Option<String>>,
    /// `name`
    pub name: Option<Option<String>>,
    /// `is_available`
    pub is_available: Option<Option<i32>>,
    /// `is_default`
    pub is_default: Option<Option<i32>>,
}

impl AreaCodePatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.code, Some(Some(_)))
            && !matches!(self.name, Some(Some(_)))
            && !matches!(self.is_available, Some(Some(_)))
            && !matches!(self.is_default, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("区号不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = AreaCodePatch {
            code: Some(Some(String::new())),
            is_default: Some(Some(0)),
            ..AreaCodePatch::default()
        };
        assert!(!patch.is_empty());

        let empty = AreaCodePatch {
            code: None,
            name: Some(None),
            ..AreaCodePatch::default()
        };
        assert!(empty.is_empty());
    }

    /// `AreaCodeInsert` 的默认值全都是「不写列」。
    #[test]
    fn insert_default_skips_flag_columns() {
        let v = AreaCodeInsert {
            code: "86".into(),
            name: "中国".into(),
            ..AreaCodeInsert::default()
        };
        assert_eq!(v.is_available, None);
        assert_eq!(v.is_default, None);
    }
}