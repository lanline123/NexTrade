//! 税率管理域（payment::tax_rate）仓储：`tax_rate`。
//!
//! 对应原 Java `com.tigshop.mapper.setting.TaxRateMapper`
//! （`BaseMapper<TaxRate>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table tax_rate`）：
//!
//! `tax_rate`（8 列，主键 `tax_rate_id`）：
//!
//! | 列 | 类型 | 可空 |
//! |----|------|------|
//! | `tax_rate_id` | `int(11)` | NOT NULL（AUTO_INCREMENT） |
//! | `region_id` | `int(11)` | NOT NULL |
//! | `region_name` | `varchar(100)` | NULL |
//! | `rate` | `decimal(10,4)` | NOT NULL |
//! | `is_active` | `tinyint(1)` | NOT NULL |
//! | `remark` | `varchar(500)` | NULL |
//! | `create_time` | `bigint(20)` | NULL |
//! | `update_time` | `bigint(20)` | NULL |
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：`rate` 是 `decimal(10,4)`，绑定类型为 `rust_decimal::Decimal`
//! （sqlx 的 `Decimal` feature 已由 workspace 启用），**全程不经过 f64**。

use rust_decimal::Decimal;
use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::setting::TaxRate;
use tigshop_core::models::payment::tax_rate::TaxRateListQuery;
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
/// 与 `entities::setting::TaxRate` 的 8 个字段一一对应，顺序也一致）。
const TAX_RATE_SELECT: &str =
    "SELECT tax_rate_id, region_id, region_name, rate, is_active, remark, create_time, update_time FROM tax_rate";

#[derive(Clone)]
pub struct TaxRateRepository {
    pool: MySqlPool,
}

impl TaxRateRepository {
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

    /// 税率分页（对应 Java `TaxRateServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - `regionName`：`region_name LIKE %regionName%`（`StrUtil.isNotBlank`）
    /// - `isActive`：`is_active = ?`（`!= null` 才加）
    /// - `startTime`：`create_time >= ?`（转时间戳，`isNotBlank`）
    /// - `endTime`：`create_time <= ?`（转时间戳，`isNotBlank`）
    ///
    /// ORDER BY 由服务层决定后传入 `order_clause`：
    /// - `sortField` 非空 → [`TaxRateListQuery::order_clause`]
    /// - `sortField` 为空 → [`tigshop_core::models::payment::tax_rate::default_order_clause`]
    ///
    /// ⚠️ 时间范围的时间戳转换在**服务层**完成（Java 在 service 里调
    /// `StringUtils.dateToTimestampExample`），因此本方法接收已转换好的
    /// `Option<i64>`，保持仓储只做 SQL 的职责边界。
    pub async fn paginate(
        &self,
        q: &TaxRateListQuery,
        start_ts: Option<i64>,
        end_ts: Option<i64>,
        order_clause: &str,
    ) -> Result<(u64, Vec<TaxRate>)> {
        let page = q.page_query();
        let (limit, offset) = page.limit_offset();

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM tax_rate WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q, start_ts, end_ts);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{TAX_RATE_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q, start_ts, end_ts);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::payment::tax_rate::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(order_clause);
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<TaxRate> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    ///
    /// ⚠️ 这里**必须**与 Java 的判断口径一致：Java 用 `StrUtil.isNotBlank`，
    /// 因此 `regionName` 为 `"   "` 时**不加**过滤条件
    /// （`effective_region_name()` 已按 isBlank 口径实现）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &TaxRateListQuery,
        start_ts: Option<i64>,
        end_ts: Option<i64>,
    ) {
        if let Some(region_name) = q.effective_region_name() {
            qb.push(" AND region_name LIKE ");
            qb.push_bind(format!("%{region_name}%"));
        }
        if let Some(is_active) = q.is_active {
            qb.push(" AND is_active = ");
            qb.push_bind(is_active);
        }
        if let Some(ts) = start_ts {
            qb.push(" AND create_time >= ");
            qb.push_bind(ts);
        }
        if let Some(ts) = end_ts {
            qb.push(" AND create_time <= ");
            qb.push_bind(ts);
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<TaxRate>> {
        sqlx::query_as::<_, TaxRate>(&format!("{TAX_RATE_SELECT} WHERE tax_rate_id = ? LIMIT 1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按 `region_id` 查询「启用」的税率，取最新一条
    /// （对应 Java `TaxRateServiceImpl#getActiveByRegionId`：
    /// `eq(region_id).eq(is_active, 1).orderByDesc(update_time)
    ///  .orderByDesc(create_time).orderByDesc(tax_rate_id).last("LIMIT 1")`）。
    ///
    /// ⚠️ 本方法**不对应本切片的任何 adminapi 路由**（Java 里
    /// `getActiveByRegionId` 由前台/其它服务调用），保留给前台切片复用。
    ///
    /// 注意 `update_time` / `create_time` 可空：MySQL 的 `ORDER BY ... DESC`
    /// 对 `NULL` 的处理是「NULL 最小」，因此 NULL 行排在最后 —— 与 Java 相同
    /// （同为 MySQL 排序，不需要额外 `NULLS LAST`）。
    pub async fn find_active_by_region_id(&self, region_id: i32) -> Result<Option<TaxRate>> {
        sqlx::query_as::<_, TaxRate>(&format!(
            "{TAX_RATE_SELECT} WHERE region_id = ? AND is_active = 1
             ORDER BY update_time DESC, create_time DESC, tax_rate_id DESC LIMIT 1"
        ))
        .bind(region_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按 `region_id` 查询地区名称
    /// （对应 Java `TaxRateServiceImpl` 里的
    /// `regionService.getById(dto.getRegionId()).getRegionName()`）。
    ///
    /// 表 `region` 的主键是 `region_id`、名称列是 `region_name`
    /// （`python tools/schema_parser.py --table region` 已核对）。
    ///
    /// ⚠️ 只 SELECT `region_name` 一列，不加载整行：Java 也只用到了
    /// `getRegionName()`。查询用 `LIMIT 1` 避免主键缺失时多行报错。
    ///
    /// 记录不存在时返回 `Ok(None)`（不报错），
    /// 与 Java「`region == null` 就跳过 setRegionName」一致。
    ///
    /// 列类型已核对：`region.region_name` 是 `varchar(200) NOT NULL`
    /// （`python tools/schema_parser.py --table region`），
    /// 因此元组里用裸 `String` 解码；查不到行才是 `None`。
    pub async fn find_region_name(&self, region_id: i32) -> Result<Option<String>> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT region_name FROM region WHERE region_id = ? LIMIT 1")
                .bind(region_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(|r| r.0))
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增税率，返回自增主键（对应 Java `save`）。
    ///
    /// 与 area_code 的 `AreaCodeInsert` 同一思路：`Option` 字段为 `None`
    /// 时**不写该列**，由 MySQL 施加列默认值
    /// （MyBatis-Plus `FieldStrategy.NOT_NULL` 的等价语义）。
    ///
    /// ⚠️ `rate` 与 `region_id` 在本域是 `NOT NULL` 且 Java 侧有 `@NotNull`，
    /// 因此它们用**裸类型**（非 `Option`）——服务层已完成校验，写库必然有值。
    /// `create_time` / `update_time` 由服务层用当前秒级时间戳填充。
    pub async fn insert(&self, v: &TaxRateInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(8);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(8);

        columns.push("region_id");
        binds.push(InsertValue::Int(v.region_id));
        columns.push("rate");
        binds.push(InsertValue::Decimal(v.rate));
        columns.push("is_active");
        binds.push(InsertValue::Int(v.is_active));
        if let Some(region_name) = v.region_name.as_deref() {
            columns.push("region_name");
            binds.push(InsertValue::Text(region_name));
        }
        if let Some(remark) = v.remark.as_deref() {
            columns.push("remark");
            binds.push(InsertValue::Text(remark));
        }
        if let Some(create_time) = v.create_time {
            columns.push("create_time");
            binds.push(InsertValue::BigInt(create_time));
        }
        if let Some(update_time) = v.update_time {
            columns.push("update_time");
            binds.push(InsertValue::BigInt(update_time));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO tax_rate ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for b in &binds {
            query = match b {
                InsertValue::Text(t) => query.bind(*t),
                InsertValue::Int(i) => query.bind(*i),
                InsertValue::BigInt(i) => query.bind(*i),
                InsertValue::Decimal(d) => query.bind(*d),
            };
        }
        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ Java `update` 的语义是**先 `getById` 查出旧行，再
    /// `BeanUtils.copyProperties(dto, taxRate)` 覆盖到旧实体上，
    /// 最后 `updateById`**。因此「DTO 里没传的字段」保留**旧值**
    /// （copyProperties 对 null 源值同样会覆盖成 null，
    /// 但 MyBatis-Plus 的 NOT_NULL 策略又把 null 跳过 ⇒ 净效果是保留旧值）。
    ///
    /// 本实现由**服务层**先 `find_by_id` 取出旧行、把 DTO 的非空字段合并
    /// 进去，再构造出一个「全字段补丁」调用本方法，从而得到相同净结果。
    /// 因此这里的 [`TaxRatePatch`] 在 `update` 场景下**每个字段都是
    /// `Some(Some(v))`**；三态能力保留给其它调用点（如 `updateField`）。
    pub async fn update(&self, id: i32, patch: &TaxRatePatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE tax_rate SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "region_id", patch.region_id);
        push_assign!(sep, "region_name", patch.region_name);
        push_assign!(sep, "rate", patch.rate);
        push_assign!(sep, "is_active", patch.is_active);
        push_assign!(sep, "remark", patch.remark);
        push_assign!(sep, "create_time", patch.create_time);
        push_assign!(sep, "update_time", patch.update_time);
        drop(sep);
        qb.push(" WHERE tax_rate_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键硬删除（对应 Java `TaxRateServiceImpl#del` → `removeById`）。
    ///
    /// `tax_rate` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM tax_rate WHERE tax_rate_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }
}

/// 新增时待写入的税率（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
#[derive(Debug, Clone)]
pub struct TaxRateInsert {
    /// `region_id`（`NOT NULL`，服务层已校验必填）
    pub region_id: i32,
    /// `rate`（`NOT NULL`，服务层已校验 0..=100 与精度）
    pub rate: Decimal,
    /// `is_active`（服务层已填默认 `YES`）
    pub is_active: i32,
    /// `region_name`（`None` ⇒ 不写列）
    pub region_name: Option<String>,
    /// `remark`（`None` ⇒ 不写列）
    pub remark: Option<String>,
    /// `create_time`（秒级时间戳）
    pub create_time: Option<i64>,
    /// `update_time`（秒级时间戳）
    pub update_time: Option<i64>,
}

/// INSERT 的绑定值（避免为文本列与整型列定义平行 `Vec`）。
#[derive(Debug, Clone, Copy)]
enum InsertValue<'a> {
    /// 文本列
    Text(&'a str),
    /// 整型列
    Int(i32),
    /// `bigint` 列
    BigInt(i64),
    /// `decimal(10,4)` 列
    Decimal(Decimal),
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
pub struct TaxRatePatch {
    /// `region_id`
    pub region_id: Option<Option<i32>>,
    /// `region_name`
    pub region_name: Option<Option<String>>,
    /// `rate`
    pub rate: Option<Option<Decimal>>,
    /// `is_active`
    pub is_active: Option<Option<i32>>,
    /// `remark`
    pub remark: Option<Option<String>>,
    /// `create_time`
    pub create_time: Option<Option<i64>>,
    /// `update_time`
    pub update_time: Option<Option<i64>>,
}

impl TaxRatePatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.region_id, Some(Some(_)))
            && !matches!(self.region_name, Some(Some(_)))
            && !matches!(self.rate, Some(Some(_)))
            && !matches!(self.is_active, Some(Some(_)))
            && !matches!(self.remark, Some(Some(_)))
            && !matches!(self.create_time, Some(Some(_)))
            && !matches!(self.update_time, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("税率不存在".into()),
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

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = TaxRatePatch {
            region_name: Some(Some(String::new())),
            is_active: Some(Some(0)),
            ..TaxRatePatch::default()
        };
        assert!(!patch.is_empty());

        let empty = TaxRatePatch {
            region_id: None,
            remark: Some(None),
            ..TaxRatePatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 所有字段都是「不写」时 `is_empty()` 必须为真
    /// （防止实现判 `Some(Some(_))` 而测试只判 `is_none()` 的假绿）。
    #[test]
    fn patch_all_none_is_empty() {
        assert!(TaxRatePatch::default().is_empty());
    }

    /// 单独验证每一个字段都能独立触发「会写」。
    #[test]
    fn patch_each_field_triggers_write() {
        let cases = [
            TaxRatePatch {
                region_id: Some(Some(1)),
                ..Default::default()
            },
            TaxRatePatch {
                region_name: Some(Some("x".into())),
                ..Default::default()
            },
            TaxRatePatch {
                rate: Some(Some(dec("1"))),
                ..Default::default()
            },
            TaxRatePatch {
                is_active: Some(Some(0)),
                ..Default::default()
            },
            TaxRatePatch {
                remark: Some(Some("".into())),
                ..Default::default()
            },
            TaxRatePatch {
                create_time: Some(Some(0)),
                ..Default::default()
            },
            TaxRatePatch {
                update_time: Some(Some(1)),
                ..Default::default()
            },
        ];
        for (i, p) in cases.iter().enumerate() {
            assert!(!p.is_empty(), "第 {i} 个补丁应被判为「会写」");
        }
    }

    /// SELECT 子句的列清单必须与 schema 一致（防止漏列导致 FromRow 运行期报错）。
    #[test]
    fn select_clause_lists_all_schema_columns() {
        for col in tigshop_core::models::payment::tax_rate::TAX_RATE_COLUMNS {
            assert!(
                TAX_RATE_SELECT.contains(col),
                "SELECT 缺少列 {col}: {TAX_RATE_SELECT}"
            );
        }
        // 不得使用 SELECT *
        assert!(!TAX_RATE_SELECT.contains('*'));
    }
}