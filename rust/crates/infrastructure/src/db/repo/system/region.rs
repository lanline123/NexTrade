//! 地区管理域（system::region）仓储：`region` 表。
//!
//! 对应原 Java `com.tigshop.mapper.setting.RegionMapper`
//! （`BaseMapper<Region>` + `BaseServiceImpl` 的通用方法），
//! 由 `com.tigshop.adminapi.controller.setting.RegionController` 调用。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table region`）：
//!
//! | 列 | 类型 | 可空 | Rust |
//! |----|------|------|------|
//! | `region_id` | int unsigned | NOT NULL（主键，自增） | `i32` |
//! | `level` | tinyint unsigned | NULL | `Option<i32>` |
//! | `region_name` | varchar(200) | NOT NULL | `String` |
//! | `parent_id` | mediumint unsigned | NOT NULL | `i32` |
//! | `is_hot` | tinyint unsigned | NOT NULL | `i32` |
//! | `sort_order` | int | NOT NULL | `i32` |
//! | `first_word` | varchar(50) | NOT NULL | `String` |
//! | `standard_code` | varchar(8) | NULL | `Option<String>` |
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`，
//! 宏会编译失败）。
//!
//! 本域**不涉及任何金额列**，因此没有 `rust_decimal::Decimal` 出场；
//! 也**不涉及库存扣减**。
//!
//! > **与 system::region_client 的关系**：system::region_client 的仓储也读 `region` 表，但服务的是
//! > **前台**地区接口（省份/城市/级联/路径）。本文件是**管理端** CRUD 的
//! > 落点，两边都是独占文件，故各自持有自己的 SQL，**不跨切片复用**
//! > （遵循「独占文件互不引用」的约定）。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::Region;
use tigshop_core::models::system::region::RegionListQuery;
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
/// 与 `entities::Region` 的 8 个字段一一对应，顺序也一致）。
const REGION_SELECT: &str =
    "SELECT region_id, level, region_name, parent_id, is_hot, sort_order, first_word, standard_code FROM region";

#[derive(Clone)]
pub struct RegionRepository {
    pool: MySqlPool,
}

impl RegionRepository {
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

    /// 地区分页（对应 Java `RegionServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `parent_id`：仅当 `>= 0` 时 `eq`（Java `parentId != null && parentId >= 0`）
    /// - `region_id`：仅当 `>= 0` 时 `eq`
    /// - ORDER BY：由 [`RegionListQuery::order_clause`] 生成
    ///   （`sortField` 空 ⇒ `sort_order ASC, region_id ASC`；
    ///   非空 ⇒ `buildSortOrder` 单列语义）
    pub async fn paginate(&self, q: &RegionListQuery) -> Result<(u64, Vec<Region>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM region WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{REGION_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q);
        // ORDER BY 子句的列名来自 models::region 的白名单映射，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<Region> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(qb: &mut QueryBuilder<'_, sqlx::MySql>, q: &RegionListQuery) {
        if let Some(parent_id) = q.effective_parent_id() {
            qb.push(" AND parent_id = ");
            qb.push_bind(parent_id);
        }
        if let Some(region_id) = q.effective_region_id() {
            qb.push(" AND region_id = ");
            qb.push_bind(region_id);
        }
    }

    /// 按主键查询（对应 Java `BaseServiceImpl#getById`）。
    ///
    /// 管理端 `detail` / `update` / `getRegionTree` 的父节点校验都用它。
    pub async fn find_by_id(&self, region_id: i32) -> Result<Option<Region>> {
        sqlx::query_as::<_, Region>(&format!("{REGION_SELECT} WHERE region_id = ? LIMIT 1"))
            .bind(region_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 只取某地区的 `level`（对应 Java `updateRegion` 里
    /// `this.getById(parentId).getLevel()` 的最小化读取）。
    ///
    /// 返回 `Option<Option<i32>>`（Java 语义对齐）：
    /// - `None`：**行不存在** ⇒ Java `parent == null` ⇒ 「上级地区不存在」
    /// - `Some(None)`：行存在但 `level` 列为 NULL ⇒ Java `parent.getLevel() == null`
    ///   ⇒ 同样报「上级地区不存在」
    /// - `Some(Some(l))`：行存在且 level 非 null ⇒ `level = l + 1`
    ///
    /// 这三态区分**必须**保留：Java 的两个条件
    /// （`parent == null || parent.getLevel() == null`）会产生同一句错误文案，
    /// 但原因不同，合并成 `Option<i32>` 会丢掉「行存在」这一信息。
    pub async fn find_level_by_id(&self, region_id: i32) -> Result<Option<Option<i32>>> {
        let row: Option<(Option<i32>,)> =
            sqlx::query_as("SELECT level FROM region WHERE region_id = ? LIMIT 1")
                .bind(region_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(|r| r.0))
    }

    /// 取全表地区（对应 Java `getAllRegionTree` 里
    /// `this.list(queryWrapper)` —— `level >= 0` 或 `level > 0`）。
    ///
    /// `min_level`：
    /// - `Some(0)`：`level >= 0`（Java `isOverseas == 1` 分支）
    /// - `Some(1)`：`level > 0`（Java 默认分支）
    ///
    /// ⚠️ Java 的 `ge(Region::getLevel, 0)` / `gt(Region::getLevel, 0)`
    /// 在列值为 `NULL` 时 **SQL 三值逻辑会直接排除该行**
    /// （`NULL >= 0` 与 `NULL > 0` 都是 `UNKNOWN`）。这里用同样的比较运算符，
    /// 行为逐字一致，**不要**改成 `(level IS NULL OR ...)`。
    ///
    /// 排序：Java 侧 `this.list(wrapper)` 没有 ORDER BY，InnoDB 按主键序返回；
    /// 这里显式 `ORDER BY region_id ASC` 让树构建结果稳定可复现
    /// （Hutool `TreeUtil.build` 的输出顺序依赖输入顺序）。
    pub async fn find_all_for_tree(&self, min_level: i32) -> Result<Vec<Region>> {
        let sql = if min_level == 0 {
            format!("{REGION_SELECT} WHERE level >= 0 ORDER BY region_id ASC")
        } else {
            format!("{REGION_SELECT} WHERE level > 0 ORDER BY region_id ASC")
        };
        sqlx::query_as::<_, Region>(&sql)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增地区（对应 Java `RegionServiceImpl#create` → `this.save(region)`）。
    ///
    /// 语义与 Java `BeanUtils.copyProperties(dto, region)` + MyBatis-Plus
    /// `insert`（`FieldStrategy.NOT_NULL`）一致：
    /// - `region_name` / `parent_id` 由服务层保证非 null（必填校验）
    /// - `level` / `is_hot` / `sort_order` / `first_word` 为 `None` 时
    ///   **不写该列**，交给 MySQL 列默认值
    ///
    /// ⚠️ Java 的 `create` **不做**任何业务校验（不查父级、不推导 level、
    /// 不推导首字母），只做 `@NotNull` / `@Size` 的 Bean Validation。
    /// 本方法同样不做 —— 规则留在服务层，且与 Java 逐条一致。
    ///
    /// ⚠️ `first_word` 列是 `NOT NULL`，若不写列则 MySQL 会填 `''`
    /// （`varchar NOT NULL` 无显式 DEFAULT 时隐含默认空串），
    /// 与 Java 的行为相同。
    ///
    /// ⚠️ `region_id` 是自增主键：Java 的 `RegionCreateDTO` 虽带 `regionId`
    /// 字段，`BeanUtils.copyProperties` 也会把它拷进实体，MyBatis-Plus 的
    /// `IdType.AUTO` 在 `regionId` 非 null 时**仍会把它作为显式值写入**
    /// （`INSERT` 含该列）。这里用 `region_id: Some(v)` 表达同一行为。
    pub async fn insert(&self, v: &RegionInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(8);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(8);

        // 主键：仅在调用方显式给了非空值时才写列（否则走 AUTO_INCREMENT）
        if let Some(region_id) = v.region_id {
            columns.push("region_id");
            binds.push(InsertValue::Int(region_id));
        }
        // 两个必填列由服务层保证非 null
        columns.push("region_name");
        binds.push(InsertValue::Text(&v.region_name));
        columns.push("parent_id");
        binds.push(InsertValue::Int(v.parent_id));

        if let Some(level) = v.level {
            columns.push("level");
            binds.push(InsertValue::Int(level));
        }
        if let Some(is_hot) = v.is_hot {
            columns.push("is_hot");
            binds.push(InsertValue::Int(is_hot));
        }
        if let Some(sort_order) = v.sort_order {
            columns.push("sort_order");
            binds.push(InsertValue::Int(sort_order));
        }
        if let Some(first_word) = v.first_word.as_deref() {
            columns.push("first_word");
            binds.push(InsertValue::Text(first_word));
        }
        // `standard_code` **不在** Java `RegionCreateDTO` 里，
        // 管理端 create 不写该列；保留字段仅为完整性（恒为 None）。
        if let Some(standard_code) = v.standard_code.as_deref() {
            columns.push("standard_code");
            binds.push(InsertValue::Text(standard_code));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO region ({}) VALUES ({placeholders})",
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
    /// 本域 `updateRegion` 走的路径是「先 `getById` 取出实体，再
    /// `region.setXxx(...)` 逐字段覆盖，最后 `updateById`」，
    /// 因此**被 set 的字段一定是 `Some(Some(v))`**（包括显式设成 0 的值），
    /// 只有根本没碰的字段才是 `None`。见
    /// `RegionServiceImpl#updateRegion` 的 `set` 清单：
    /// `regionName` / `parentId` / `level` / `isHot` / `sortOrder` / `firstWord`
    /// —— `standardCode` **不在**其中，故永远不参与更新。
    pub async fn update(&self, region_id: i32, patch: &RegionPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE region SET ");
        {
            let mut sep = qb.separated(", ");
            push_assign!(sep, "region_name", patch.region_name);
            push_assign!(sep, "parent_id", patch.parent_id);
            push_assign!(sep, "level", patch.level);
            push_assign!(sep, "is_hot", patch.is_hot);
            push_assign!(sep, "sort_order", patch.sort_order);
            push_assign!(sep, "first_word", patch.first_word);
            push_assign!(sep, "standard_code", patch.standard_code);
        }
        qb.push(" WHERE region_id = ");
        qb.push_bind(region_id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自 [`tigshop_core::models::system::region::REGION_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    ///
    /// ⚠️ Java 的 `update(wrapper)` 在 `UPDATE` 后**不校验是否存在该行**，
    /// 影响 0 行也算「执行成功」（返回 `false`，不抛异常）；
    /// 这里返回 `rows_affected`，由服务层折算布尔值。
    pub async fn update_field(&self, region_id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::system::region::REGION_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE region SET {column} = ? WHERE region_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(region_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `RegionServiceImpl#del` → `BaseServiceImpl#del`
    /// → `removeById`）。
    ///
    /// `region` 表**没有**软删标记列，因此就是 `DELETE`。
    ///
    /// ⚠️ Java **不校验**该地区是否有子节点 —— 删父级会留下孤儿行。
    /// 本实现逐字复刻该行为（见 `uncertain_points`）。
    pub async fn delete(&self, region_id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM region WHERE region_id = ?")
            .bind(region_id)
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
            QueryBuilder::new("DELETE FROM region WHERE region_id IN (");
        {
            let mut sep = qb.separated(", ");
            for id in ids {
                sep.push_bind(*id);
            }
        }
        qb.push(")");
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 统计某地区的**直接子节点**数（本域新增的防御性查询，非 Java 概念）。
    ///
    /// ⚠️ **Java 没有这个查询**，`del` 也不做子节点检查。
    /// 保留它是为了让主会话 / 产品在确认「删除父级是否应拦截」后
    /// 一行接入（默认**不调用**，见 `uncertain_points`）。
    pub async fn count_children(&self, region_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM region WHERE parent_id = ?")
            .bind(region_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0)
    }
}

/// 新增时待写入的地区（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
#[derive(Debug, Clone, Default)]
pub struct RegionInsert {
    /// `region_id`（`None` ⇒ 走 `AUTO_INCREMENT`；`Some` ⇒ 显式写入）
    pub region_id: Option<i32>,
    /// `region_name`（必填，服务层已校验）
    pub region_name: String,
    /// `parent_id`（必填，服务层已校验）
    pub parent_id: i32,
    /// `level`（`None` ⇒ 不写列）
    pub level: Option<i32>,
    /// `is_hot`（`None` ⇒ 不写列）
    pub is_hot: Option<i32>,
    /// `sort_order`（`None` ⇒ 不写列）
    pub sort_order: Option<i32>,
    /// `first_word`（`None` ⇒ 不写列，MySQL 填 `''`）
    pub first_word: Option<String>,
    /// `standard_code`（管理端 create 不写该列，恒为 `None`）
    pub standard_code: Option<String>,
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
pub struct RegionPatch {
    /// `region_name`
    pub region_name: Option<Option<String>>,
    /// `parent_id`
    pub parent_id: Option<Option<i32>>,
    /// `level`
    pub level: Option<Option<i32>>,
    /// `is_hot`
    pub is_hot: Option<Option<i32>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `first_word`
    pub first_word: Option<Option<String>>,
    /// `standard_code`（本域 update 不写该列）
    pub standard_code: Option<Option<String>>,
}

impl RegionPatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.region_name, Some(Some(_)))
            && !matches!(self.parent_id, Some(Some(_)))
            && !matches!(self.level, Some(Some(_)))
            && !matches!(self.is_hot, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.first_word, Some(Some(_)))
            && !matches!(self.standard_code, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("地区不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = RegionPatch {
            region_name: Some(Some(String::new())),
            is_hot: Some(Some(0)),
            sort_order: Some(Some(0)),
            ..RegionPatch::default()
        };
        assert!(!patch.is_empty());

        let empty = RegionPatch {
            region_name: None,
            parent_id: Some(None),
            ..RegionPatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 全 `None` 的补丁是空的（对应「没有任何字段被 set」）。
    #[test]
    fn default_patch_is_empty() {
        assert!(RegionPatch::default().is_empty());
    }

    /// `RegionInsert` 的默认值全都是「不写列」。
    #[test]
    fn insert_default_skips_optional_columns() {
        let v = RegionInsert {
            region_name: "北京市".into(),
            parent_id: 0,
            ..RegionInsert::default()
        };
        assert_eq!(v.region_id, None);
        assert_eq!(v.level, None);
        assert_eq!(v.is_hot, None);
        assert_eq!(v.sort_order, None);
        assert_eq!(v.first_word, None);
        assert_eq!(v.standard_code, None);
    }

    /// 固定 SELECT 清单的列名与 `entities::Region` 一致（防手改漏改）。
    #[test]
    fn select_columns_are_the_entity_columns() {
        for col in [
            "region_id",
            "level",
            "region_name",
            "parent_id",
            "is_hot",
            "sort_order",
            "first_word",
            "standard_code",
        ] {
            assert!(REGION_SELECT.contains(col), "SELECT 缺少列 {col}");
            assert!(
                tigshop_core::models::system::region::REGION_COLUMNS.contains(&col),
                "{col} 不在 REGION_COLUMNS 白名单"
            );
        }
        assert!(!REGION_SELECT.contains("SELECT *"));
    }
}