//! 商品分组域仓储：对应原 Java `ProductGroupMapper`。
//!
//! 列名严格对齐权威 schema（`python tools/schema_parser.py --table product_group`）：
//! `product_group_id` / `product_group_name` / `product_group_sn` /
//! `product_group_description` / `product_ids` / `add_time` / `shop_id`。
//!
//! 所有列表 SQL 显式列出列名，不用 `SELECT *`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! # Java 语义对照
//!
//! - `list`：`eq(shopId, getShopId())` **恒定**店铺过滤（多租户隔离点）+
//!   `keyword` / `productGroupIds` 两个可选过滤 + `buildSortOrder`。
//! - `clientList`：控制器直接 `lambdaQuery().like(name).list()`，
//!   **不带店铺过滤**（Java 原样）；本实现保持同样语义。
//! - `create` / `update`：MyBatis-Plus `save` / `updateById` 默认
//!   `FieldStrategy.NOT_NULL` —— 只写非 null 字段；`product_ids` 在服务层
//!   总是编码成 JSON（空列表 ⇒ `"[]"`）后写入。

use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::entities::ProductGroup;
use tigshop_core::models::catalog::product_group::ProductGroupListQuery;
use tigshop_core::types::PageQuery;
use tigshop_core::{Error, Result};

/// `product_group` 固定 SELECT 列清单（顺序与实体字段一致）。
const GROUP_SELECT: &str = "SELECT product_group_id, product_group_name, product_group_sn, product_group_description, product_ids, add_time, shop_id FROM product_group";

/// 把「DTO 有值才写」的列追加为 `col = ?` 赋值片段。
///
/// `$field` 是 `&Option<T>`：`None` ⇒ 不写该列（等价 MyBatis-Plus
/// `FieldStrategy.NOT_NULL` 跳过 null 字段）；`Some(v)` ⇒ 写该列（含空串）。
macro_rules! push_assign_opt {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(v) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind_unseparated(v);
        }
    };
}

/// 商品分组创建时待写入的字段。
///
/// `product_group_id` 由库自增；`add_time` / `shop_id` 由服务层解析后传入。
#[derive(Debug, Clone, Default)]
pub struct ProductGroupInsert {
    /// 分组名称
    pub product_group_name: Option<String>,
    /// 分组别名
    pub product_group_sn: Option<String>,
    /// 分组描述
    pub product_group_description: Option<String>,
    /// 关联商品 ID 的 JSON 文本（服务层保证已编码）
    pub product_ids: String,
    /// 添加时间（秒级时间戳）
    pub add_time: i32,
    /// 店铺 ID（服务层用请求头解析值覆盖）
    pub shop_id: i32,
}

/// 商品分组更新补丁（对应 MyBatis-Plus `updateById` 的 NOT_NULL 策略）。
///
/// - `None`：不写该列（Java 实体字段为 null ⇒ 从 `SET` 中剔除）
/// - `Some(v)`：写该列（空串也会写）
///
/// `product_ids` **总是**写入（Java `setProductIds(...)` 后必然非 null）。
#[derive(Debug, Clone, Default)]
pub struct ProductGroupPatch {
    /// 分组名称
    pub product_group_name: Option<String>,
    /// 分组别名
    pub product_group_sn: Option<String>,
    /// 分组描述
    pub product_group_description: Option<String>,
    /// 关联商品 ID 的 JSON 文本（总是写入）
    pub product_ids: String,
    /// 店铺 ID（DTO 传了才覆盖）
    pub shop_id: Option<i32>,
}

/// 商品分组域仓储（持有连接池）。
#[derive(Clone)]
pub struct ProductGroupRepository {
    pool: MySqlPool,
}

impl ProductGroupRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层事务编排；本域当前无多语句事务）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 查询 —————————————————————

    /// 按主键查询（对应 Java `getById` / `selectById`）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<ProductGroup>> {
        sqlx::query_as::<_, ProductGroup>(&format!(
            "{GROUP_SELECT} WHERE product_group_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 分组分页（对应 Java `ProductGroupServiceImpl#list`）。
    ///
    /// - `shop_id = ?`：**恒定**归属过滤（值由服务层按请求头解析）
    /// - `product_group_name LIKE %keyword%`：仅当 keyword 非空
    /// - `product_group_id IN (...)`：仅当 `productGroupIds` 解析出有效 ID
    /// - ORDER BY 由 [`ProductGroupListQuery::order_clause`] 生成（白名单列）
    pub async fn paginate(
        &self,
        q: &ProductGroupListQuery,
        shop_id: i32,
        page: &PageQuery,
    ) -> Result<(u64, Vec<ProductGroup>)> {
        let (limit, offset) = page.limit_offset();

        let mut count_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM product_group WHERE 1 = 1");
        Self::push_filters(&mut count_qb, q, shop_id);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let mut row_qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new(format!("{GROUP_SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut row_qb, q, shop_id);
        // ORDER BY 列名来自 models 白名单（未知回退主键），方向二选一，
        // LIMIT/OFFSET 为 u64 字面量，均无注入面。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        let rows: Vec<ProductGroup> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 追加 `list` 的 WHERE 片段（count 与取行共用，保证条件一致）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, MySql>,
        q: &ProductGroupListQuery,
        shop_id: i32,
    ) {
        // 归属过滤恒定存在（Java `eq(ProductGroup::getShopId, getShopId())`）
        qb.push(" AND shop_id = ");
        qb.push_bind(shop_id);
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND product_group_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
        }
        if let Some(ids) = q.effective_group_ids() {
            qb.push(" AND product_group_id IN (");
            let mut sep = qb.separated(", ");
            for id in ids {
                sep.push_bind(id);
            }
            sep.push_unseparated(")");
            drop(sep);
        }
    }

    /// 前台选择器用的分组列表（对应 Java `ProductGroupController#client`）。
    ///
    /// Java 原样：`lambdaQuery().like(isNotBlank(name), name).list()` ——
    /// **不带店铺过滤、不分页、无显式排序**。本实现额外固定
    /// `ORDER BY product_group_id ASC` 让结果稳定可测（MySQL 实际通常也按
    /// 主键返回；见 `uncertain_points`）。
    pub async fn client_list(&self, name: Option<&str>) -> Result<Vec<ProductGroup>> {
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new(format!("{GROUP_SELECT} WHERE 1 = 1"));
        if let Some(name) = name {
            qb.push(" AND product_group_name LIKE ");
            qb.push_bind(format!("%{name}%"));
        }
        qb.push(" ORDER BY product_group_id ASC");
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    // ————————————————————— 写操作 —————————————————————

    /// 新增分组，返回自增主键（对应 Java `save`）。
    pub async fn insert(&self, row: &ProductGroupInsert) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO product_group (product_group_name, product_group_sn, product_group_description, product_ids, add_time, shop_id) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&row.product_group_name)
        .bind(&row.product_group_sn)
        .bind(&row.product_group_description)
        .bind(&row.product_ids)
        .bind(row.add_time)
        .bind(row.shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(res.last_insert_id() as i32)
    }

    /// 部分更新（对应 Java `updateById`，NOT_NULL 语义：只写非 null 字段）。
    ///
    /// 返回受影响行数；Java `updateById` 影响 0 行返回 `false` 但不报错，
    /// 由服务层决定是否透传（本域控制器返回 `void`，忽略结果）。
    pub async fn update(&self, id: i32, patch: &ProductGroupPatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new("UPDATE product_group SET ");
        let mut sep = qb.separated(", ");
        push_assign_opt!(sep, "product_group_name", patch.product_group_name);
        push_assign_opt!(sep, "product_group_sn", patch.product_group_sn);
        push_assign_opt!(
            sep,
            "product_group_description",
            patch.product_group_description
        );
        push_assign_opt!(sep, "shop_id", patch.shop_id);
        // Java `setProductIds(...)` 必然非 null ⇒ 总是写该列
        sep.push("product_ids");
        sep.push_unseparated(" = ");
        sep.push_bind_unseparated(&patch.product_ids);
        drop(sep);
        qb.push(" WHERE product_group_id = ");
        qb.push_bind(id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键删除（对应 Java `removeById`；表无删除标记列）。
    pub async fn delete(&self, id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM product_group WHERE product_group_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量删除（对应 Java `removeByIds`）。返回实际删除行数。
    pub async fn delete_batch(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("DELETE FROM product_group WHERE product_group_id IN (");
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

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => {
            Error::NotFound(tigshop_core::models::catalog::product_group::GROUP_NOT_FOUND.into())
        }
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::catalog::product_group::GROUP_COLUMNS;

    #[test]
    fn select_list_covers_entity_columns() {
        // 列清单与 schema 逐列对齐（顺序即实体字段顺序）
        assert_eq!(
            GROUP_COLUMNS,
            [
                "product_group_id",
                "product_group_name",
                "product_group_sn",
                "product_group_description",
                "product_ids",
                "add_time",
                "shop_id",
            ]
        );
        let selected = GROUP_SELECT
            .trim_start_matches("SELECT ")
            .split(" FROM ")
            .next()
            .unwrap();
        assert_eq!(selected, GROUP_COLUMNS.join(", "));
        assert_eq!(
            tigshop_core::models::catalog::product_group::KEY_COLUMN,
            "product_group_id"
        );
    }

    #[test]
    fn patch_defaults_write_only_product_ids() {
        // 默认补丁：product_ids 为空串（由服务层编码成 "[]"），其余列不写
        let patch = ProductGroupPatch::default();
        assert!(patch.product_group_name.is_none());
        assert!(patch.product_group_sn.is_none());
        assert!(patch.product_group_description.is_none());
        assert!(patch.shop_id.is_none());
        assert_eq!(patch.product_ids, "");
    }

    #[test]
    fn insert_defaults_are_nullable_except_required() {
        // product_group 除自增主键外全部可空；product_ids / add_time / shop_id
        // 由服务层保证有值
        let row = ProductGroupInsert::default();
        assert!(row.product_group_name.is_none());
        assert_eq!(row.product_ids, "");
        assert_eq!(row.add_time, 0);
        assert_eq!(row.shop_id, 0);
    }
}
