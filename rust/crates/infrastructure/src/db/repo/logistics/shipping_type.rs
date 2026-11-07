//! 配送类型域（logistics::shipping_type）仓储：`shipping_type`。
//!
//! 对应原 Java `com.tigshop.mapper.setting.ShippingTypeMapper`
//! （`BaseMapper<ShippingType>` + `BaseServiceImpl` 的通用方法）。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table shipping_type`）：
//!
//! `shipping_type`（8 列，主键 `shipping_type_id`）：
//!
//! | 列 | 类型 | 可空 |
//! |----|------|------|
//! | `shipping_type_id` | `int unsigned` | NOT NULL（AUTO_INCREMENT） |
//! | `shipping_type_name` | `varchar(120)` | NOT NULL |
//! | `shipping_default_id` | `int unsigned` | NOT NULL |
//! | `shipping_type_desc` | `varchar(255)` | NOT NULL |
//! | `shipping_time_desc` | `varchar(255)` | NOT NULL |
//! | `is_support_cod` | `tinyint unsigned` | NOT NULL |
//! | `sort_order` | `smallint unsigned` | NOT NULL |
//! | `shop_id` | `int unsigned` | NOT NULL |
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：本域**不涉及任何金额列**（运费模板 `shipping_tpl_info` 才有）。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::setting::ShippingType;
use tigshop_core::models::logistics::shipping_type::ShippingTypeListQuery;
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
/// 与 `entities::setting::ShippingType` 的 8 个字段一一对应，顺序也一致）。
const SHIPPING_TYPE_SELECT: &str = "SELECT shipping_type_id, shipping_type_name, shipping_default_id, \
     shipping_type_desc, shipping_time_desc, is_support_cod, sort_order, shop_id FROM shipping_type";

#[derive(Clone)]
pub struct ShippingTypeRepository {
    pool: MySqlPool,
}

impl ShippingTypeRepository {
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

    /// 配送类型分页（对应 Java `ShippingTypeServiceImpl#list`）。
    ///
    /// 过滤条件与 Java 逐条对齐：
    /// - **强制** `shop_id = ?`（Java `queryWrapper.eq(shopId, getShopId())`，
    ///   值来自请求头，请求参数里的 `shopId` 被忽略）
    /// - `keyword`：`shipping_type_name LIKE %keyword%`
    ///   （Java `StrUtil.isNotEmpty(keyword)` —— 纯空白**仍**算有效关键字）
    ///
    /// ORDER BY 由 [`ShippingTypeListQuery::order_clause`] 生成
    /// （Java **无条件**调用 `buildSortOrder`，因此 `sortField` 空时
    /// 是「主键列 DESC」而不是「无排序」）。
    pub async fn paginate(
        &self,
        q: &ShippingTypeListQuery,
        shop_id: i32,
    ) -> Result<(u64, Vec<ShippingType>)> {
        let page = q.page_query();
        let (limit, offset) = page.limit_offset();

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM shipping_type WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q, shop_id);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new(format!("{SHIPPING_TYPE_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q, shop_id);
        // ORDER BY 子句的列名来自 models::tigshop_core::models::logistics::shipping_type::map_order_column 的白名单，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<ShippingType> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &ShippingTypeListQuery,
        shop_id: i32,
    ) {
        // Java：`queryWrapper.eq(ShippingType::getShopId, getShopId())` —— 无条件生效
        qb.push(" AND shop_id = ");
        qb.push_bind(shop_id);

        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND shipping_type_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
    }

    /// 按主键查询（对应 Java `getById`）。
    /// 全部配送方式（前台结算用，按排序号升序）。
    ///
    /// # Errors
    /// 数据库错误。
    pub async fn list_all(&self) -> Result<Vec<ShippingType>> {
        sqlx::query_as::<_, ShippingType>(
            "SELECT * FROM shipping_type ORDER BY sort_order ASC, shipping_type_id ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    pub async fn find_by_id(&self, id: i32) -> Result<Option<ShippingType>> {
        sqlx::query_as::<_, ShippingType>(&format!(
            "{SHIPPING_TYPE_SELECT} WHERE shipping_type_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按主键批量查询物流公司名称
    /// （对应 Java `list` 里对每行调用的
    /// `logisticsCompanyService.getLogisticsCompanyById(shippingDefaultId)`）。
    ///
    /// 表 `logistics_company` 的主键是 `logistics_id`、名称列是
    /// `logistics_name`（`python tools/schema_parser.py --table
    /// logistics_company` 已核对）。
    ///
    /// ⚠️ 与 Java 的**唯一差异**：Java 在 `stream().map(...)` 里
    /// **逐行**发起一次查询（N+1）；本实现改为**一次 IN 查询**再组 Map，
    /// 结果集完全相同（按主键取唯一行），但把 N 次往返降为 1 次。
    /// 这是纯粹的性能优化，不改变可观测行为（见 `uncertain_points`）。
    ///
    /// `ids` 为空时直接返回空 Map（避免生成 `IN ()` 非法 SQL）。
    pub async fn find_logistics_names(
        &self,
        ids: &[i32],
    ) -> Result<std::collections::HashMap<i32, String>> {
        let mut out = std::collections::HashMap::new();
        if ids.is_empty() {
            return Ok(out);
        }
        // 去重，减少 IN 列表长度
        let mut unique: Vec<i32> = ids.to_vec();
        unique.sort_unstable();
        unique.dedup();

        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT logistics_id, logistics_name FROM logistics_company WHERE logistics_id IN (");
        let mut sep = qb.separated(", ");
        for id in &unique {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);

        let rows: Vec<(i32, String)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        for (id, name) in rows {
            out.insert(id, name);
        }
        Ok(out)
    }

    // ————————————————————— 写入 —————————————————————

    /// 新增配送类型，返回自增主键（对应 Java `save`）。
    ///
    /// `Option` 字段为 `None` 时**不写该列**，由 MySQL 施加列默认值
    /// （MyBatis-Plus `FieldStrategy.NOT_NULL` 的等价语义）。
    ///
    /// ⚠️ `shop_id` 用裸 `i32`：Java `create` 里
    /// `shippingType.setShopId(getShopId())` **无条件覆盖**，
    /// 请求体里的 `shopId` 被丢弃，因此这里必然有值。
    pub async fn insert(&self, v: &ShippingTypeInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = Vec::with_capacity(8);
        let mut binds: Vec<InsertValue<'_>> = Vec::with_capacity(8);

        // shop_id 必写（Java 用请求头覆盖）
        columns.push("shop_id");
        binds.push(InsertValue::Int(v.shop_id));

        if let Some(name) = v.shipping_type_name.as_deref() {
            columns.push("shipping_type_name");
            binds.push(InsertValue::Text(name));
        }
        if let Some(id) = v.shipping_default_id {
            columns.push("shipping_default_id");
            binds.push(InsertValue::Int(id));
        }
        if let Some(desc) = v.shipping_type_desc.as_deref() {
            columns.push("shipping_type_desc");
            binds.push(InsertValue::Text(desc));
        }
        if let Some(desc) = v.shipping_time_desc.as_deref() {
            columns.push("shipping_time_desc");
            binds.push(InsertValue::Text(desc));
        }
        if let Some(cod) = v.is_support_cod {
            columns.push("is_support_cod");
            binds.push(InsertValue::Int(cod));
        }
        if let Some(order) = v.sort_order {
            columns.push("sort_order");
            binds.push(InsertValue::Int(order));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO shipping_type ({}) VALUES ({placeholders})",
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

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义）。
    ///
    /// ⚠️ Java `update` 的写法是**直接 new 一个空实体**
    /// （`ShippingType shippingType = new ShippingType()` 后
    /// `BeanUtils.copyProperties(updateDTO, shippingType)`），
    /// **不是**先 `getById` 再覆盖。因此 DTO 里没传的字段是 `null`，
    /// 被 NOT_NULL 策略跳过 ⇒ **保留库里的旧值**。
    /// 净结果与「先查后并」相同，故本实现由服务层构造补丁即可。
    pub async fn update(&self, id: i32, patch: &ShippingTypePatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE shipping_type SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "shipping_type_name", patch.shipping_type_name);
        push_assign!(sep, "shipping_default_id", patch.shipping_default_id);
        push_assign!(sep, "shipping_type_desc", patch.shipping_type_desc);
        push_assign!(sep, "shipping_time_desc", patch.shipping_time_desc);
        push_assign!(sep, "is_support_cod", patch.is_support_cod);
        push_assign!(sep, "sort_order", patch.sort_order);
        push_assign!(sep, "shop_id", patch.shop_id);
        drop(sep);
        qb.push(" WHERE shipping_type_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自
    /// [`tigshop_core::models::logistics::shipping_type::SHIPPING_TYPE_COLUMNS`] 的白名单映射
    /// （服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    ///
    /// ⚠️ 复刻 Java 缺陷：若服务层把 `is_show` 映射为主键列并放行，
    /// 本方法会真的执行 `SET shipping_type_id = ?`（见 models 里的说明）。
    pub async fn update_field(&self, id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::logistics::shipping_type::SHIPPING_TYPE_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE shipping_type SET {column} = ? WHERE shipping_type_id = ?");
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
    /// `shipping_type` 表**没有**软删标记列，因此就是 `DELETE`。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM shipping_type WHERE shipping_type_id = ?")
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
            QueryBuilder::new("DELETE FROM shipping_type WHERE shipping_type_id IN (");
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

/// 新增时待写入的配送类型（`None` = 不写该列 ⇒ 走 MySQL 列默认值）。
///
/// `shop_id` 用裸 `i32`：Java `create` 无条件用请求头值覆盖。
#[derive(Debug, Clone)]
pub struct ShippingTypeInsert {
    /// `shop_id`（必写，来自请求头）
    pub shop_id: i32,
    /// `shipping_type_name`（`None` ⇒ 不写列）
    pub shipping_type_name: Option<String>,
    /// `shipping_default_id`（`None` ⇒ 不写列）
    pub shipping_default_id: Option<i32>,
    /// `shipping_type_desc`（`None` ⇒ 不写列）
    pub shipping_type_desc: Option<String>,
    /// `shipping_time_desc`（`None` ⇒ 不写列）
    pub shipping_time_desc: Option<String>,
    /// `is_support_cod`（`None` ⇒ 不写列）
    pub is_support_cod: Option<i32>,
    /// `sort_order`（`None` ⇒ 不写列）
    pub sort_order: Option<i32>,
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
pub struct ShippingTypePatch {
    /// `shipping_type_name`
    pub shipping_type_name: Option<Option<String>>,
    /// `shipping_default_id`
    pub shipping_default_id: Option<Option<i32>>,
    /// `shipping_type_desc`
    pub shipping_type_desc: Option<Option<String>>,
    /// `shipping_time_desc`
    pub shipping_time_desc: Option<Option<String>>,
    /// `is_support_cod`
    pub is_support_cod: Option<Option<i32>>,
    /// `sort_order`
    pub sort_order: Option<Option<i32>>,
    /// `shop_id`（本切片 `update` 不会用到，保留给其它调用点）
    pub shop_id: Option<Option<i32>>,
}

impl ShippingTypePatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    /// 因此只有 `Some(Some(_))` 才算「会写」。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.shipping_type_name, Some(Some(_)))
            && !matches!(self.shipping_default_id, Some(Some(_)))
            && !matches!(self.shipping_type_desc, Some(Some(_)))
            && !matches!(self.shipping_time_desc, Some(Some(_)))
            && !matches!(self.is_support_cod, Some(Some(_)))
            && !matches!(self.sort_order, Some(Some(_)))
            && !matches!(self.shop_id, Some(Some(_)))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("配送类型不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = ShippingTypePatch {
            shipping_type_name: Some(Some(String::new())),
            sort_order: Some(Some(0)),
            ..ShippingTypePatch::default()
        };
        assert!(!patch.is_empty());

        let empty = ShippingTypePatch {
            shipping_type_name: None,
            shipping_type_desc: Some(None),
            ..ShippingTypePatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 默认补丁为「不写任何列」。
    #[test]
    fn patch_default_is_empty() {
        assert!(ShippingTypePatch::default().is_empty());
    }

    /// 每个字段都能独立触发「会写」。
    #[test]
    fn patch_each_field_triggers_write() {
        let cases = [
            ShippingTypePatch {
                shipping_type_name: Some(Some("x".into())),
                ..Default::default()
            },
            ShippingTypePatch {
                shipping_default_id: Some(Some(0)),
                ..Default::default()
            },
            ShippingTypePatch {
                shipping_type_desc: Some(Some(String::new())),
                ..Default::default()
            },
            ShippingTypePatch {
                shipping_time_desc: Some(Some("t".into())),
                ..Default::default()
            },
            ShippingTypePatch {
                is_support_cod: Some(Some(0)),
                ..Default::default()
            },
            ShippingTypePatch {
                sort_order: Some(Some(1)),
                ..Default::default()
            },
            ShippingTypePatch {
                shop_id: Some(Some(2)),
                ..Default::default()
            },
        ];
        for (i, p) in cases.iter().enumerate() {
            assert!(!p.is_empty(), "第 {i} 个补丁应被判为「会写」");
        }
    }

    /// SELECT 子句必须覆盖全部 8 列，且不得使用 `SELECT *`。
    #[test]
    fn select_clause_lists_all_schema_columns() {
        for col in tigshop_core::models::logistics::shipping_type::SHIPPING_TYPE_COLUMNS {
            assert!(
                SHIPPING_TYPE_SELECT.contains(col),
                "SELECT 缺少列 {col}: {SHIPPING_TYPE_SELECT}"
            );
        }
        assert!(!SHIPPING_TYPE_SELECT.contains('*'));
    }
}