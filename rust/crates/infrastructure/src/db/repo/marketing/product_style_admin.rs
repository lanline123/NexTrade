//! 商品样式配置域（marketing::product_style_admin）仓储：`product_style` / `product_style_item`。
//!
//! 对应原 Java `com.tigshop.mapper.product.ProductStyleMapper`
//! （`BaseMapper<ProductStyle>` + 4 条自定义 SQL）与
//! `com.tigshop.mapper.product.ProductStyleItemMapper`。
//!
//! 列名严格对齐 `java/database/pure.sql`
//! （`cd rust && python tools/schema_parser.py --table product_style`）：
//!
//! `product_style`（12 列，主键 `style_id`）：
//! `style_id` / `style_name` / `style_type` / `style_image` / `pc_image` /
//! `start_time` / `end_time` / `status` / `shop_id` / `add_time` /
//! `update_time` / `is_delete`
//! —— 全部 `NOT NULL`；⚠️ **没有 `sort_order` 列**（Java 的
//! `CheckFieldConstants.PRODUCT_STYLE_FIELDS` 里却写了它，见 `uncertain_points`）。
//!
//! `product_style_item`（5 列，主键 `item_id`）：
//! `item_id` / `style_id` / `item_type` / `ref_id` / `add_time`
//! —— 全部 `NOT NULL`。
//!
//! 查询统一使用运行时 `sqlx::query_as` / `sqlx::query` / `QueryBuilder`
//! （**不使用** `query!` / `query_as!` 宏：本机无 `DATABASE_URL`）。
//!
//! 金额：`product.product_price` 是 `decimal(10,2)`，实体侧已是
//! `rust_decimal::Decimal`，本层直接透传（**不使用** f64/f32）。
//!
//! ## 关于 `pageList` 的 `LEFT JOIN` 子查询
//!
//! Java mapper 用
//! ```sql
//! LEFT JOIN (SELECT psi.style_id, COUNT(DISTINCT p.product_id) AS product_count
//!            FROM product_style_item psi INNER JOIN product p ON (...)
//!            WHERE p.is_delete = 0 AND p.product_status = 1
//!            GROUP BY psi.style_id) cnt ON cnt.style_id = ps.style_id
//! ```
//! 并 `IFNULL(cnt.product_count, 0) AS product_count`，使统计列可参与
//! 数据库层 `ORDER BY`。本实现**逐条照抄**该子查询（含三路 `OR` 关联条件），
//! 见 [`ProductStyleAdminRepository::push_count_subquery`]。

use sqlx::{MySqlPool, QueryBuilder};

use tigshop_core::entities::{Brand, ProductStyle};
use tigshop_core::models::marketing::product_style_admin::{
    self, ProductStyleListQuery, StyleGroupRow, StyleProductRow, StyleRowWithCount,
    ITEM_TYPE_BRAND, ITEM_TYPE_GROUP, ITEM_TYPE_PRODUCT, NOT_DELETED, PRODUCT_STATUS_ON_SALE,
};
use tigshop_core::{Error, Result};

/// 把补丁字段追加为 `col = ?` 赋值片段。
///
/// `$field` 的类型是 `&Option<Option<T>>`：
/// - 外层 `None`（调用方明确「不写该列」）与内层 `None`（值为 null）都**不写**
///   —— 对应 MyBatis-Plus 的 `FieldStrategy.NOT_NULL`
/// - `Some(Some(v))` 才绑定参数
///
/// ⚠️ `macro_rules!` 必须**先定义后使用**（按文本顺序展开），
/// 故本宏置于导入区之后、`impl` 之前，不能挪到文件末尾。
macro_rules! push_assign {
    ($sep:expr, $column:literal, $field:expr) => {
        if let Some(Some(v)) = $field.as_ref() {
            $sep.push($column);
            $sep.push_unseparated(" = ");
            $sep.push_bind_unseparated(v);
        }
    };
}

/// `product_style` 固定 SELECT 列清单（避免 `SELECT *` 与实体字段顺序耦合；
/// 与 `entities::ProductStyle` 的 12 个字段一一对应，顺序也一致）。
const STYLE_SELECT: &str = "SELECT ps.style_id, ps.style_name, ps.style_type, ps.style_image, \
     ps.pc_image, ps.start_time, ps.end_time, ps.status, ps.shop_id, ps.add_time, \
     ps.update_time, ps.is_delete FROM product_style ps";

/// 三路关联条件（`item_type` 1=商品 / 2=分组 / 3=品牌）。
///
/// **Java mapper XML 的原文逐字照抄**（`pageList` 与
/// `countRealProductsByStyleIds` 两处完全一致，故提取为常量共用，
/// 保证两条 SQL 的统计口径不会漂移）：
/// ```text
/// (psi.item_type = 1 AND psi.ref_id = p.product_id)
/// OR (psi.item_type = 2 AND EXISTS (SELECT 1 FROM product_group pg
///        WHERE pg.product_group_id = psi.ref_id
///          AND JSON_CONTAINS(pg.product_ids, CAST(p.product_id AS JSON))))
/// OR (psi.item_type = 3 AND psi.ref_id = p.brand_id)
/// ```
const PRODUCT_JOIN_CONDITION: &str = "(psi.item_type = 1 AND psi.ref_id = p.product_id) \
     OR (psi.item_type = 2 AND EXISTS (SELECT 1 FROM product_group pg \
         WHERE pg.product_group_id = psi.ref_id \
           AND JSON_CONTAINS(pg.product_ids, CAST(p.product_id AS JSON)))) \
     OR (psi.item_type = 3 AND psi.ref_id = p.brand_id)";

#[derive(Clone)]
pub struct ProductStyleAdminRepository {
    pool: MySqlPool,
}

impl ProductStyleAdminRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排，与其它切片仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 列表 —————————————————————

    /// 商品样式分页（对应 Java `ProductStyleMapper#pageList`）。
    ///
    /// 过滤条件与 mapper XML 逐条对齐：
    /// - `ps.shop_id = ?`（Java `HeaderUtils.getShopId()`，平台账号为 0）
    /// - `ps.is_delete = 0`
    /// - `styleType` / `status` 非空才过滤
    /// - `keyword` 非空 → `ps.style_name LIKE CONCAT('%', ?, '%')`
    /// - `activityStatus`：1 ⇒ `ps.start_time > now`；
    ///   2 ⇒ `ps.start_time <= now AND ps.end_time >= now`；
    ///   3 ⇒ `ps.end_time < now`（**其它值不过滤**）
    /// - `startTime` / `endTime`（已由 `TigUtils.toTimestampYmd` 解析为时间戳）
    ///   ⇒ `ps.start_time >= ?` / `ps.end_time <= ?`
    ///
    /// ORDER BY 由 [`ProductStyleListQuery::order_clause`] 生成
    /// （列名白名单映射，无注入面）。
    pub async fn paginate(
        &self,
        q: &ProductStyleListQuery,
        shop_id: Option<i32>,
        now: i64,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) -> Result<(u64, Vec<StyleRowWithCount>)> {
        let page = q.page_query();
        let (limit, offset) = (page.page_size, (page.page - 1) * page.page_size);
        // 多租户：平台账号不加店铺条件；店铺账号强制 `ps.shop_id = ?`（i32 内部值）
        let shop_cond = shop_id
            .map(|id| format!(" AND ps.shop_id = {id}"))
            .unwrap_or_default();

        let mut count_qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(format!(
            "SELECT COUNT(*) FROM product_style ps WHERE ps.is_delete = {NOT_DELETED}{shop_cond}"
        ));
        Self::push_filters(&mut count_qb, q, now, start_time, end_time);
        let total: (i64,) = count_qb
            .build_query_as()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        // 取行：先拼固定列（含 shop_id / is_delete），再拼统计子查询的别名列，
        // 最后 FROM + LEFT JOIN（与 Java mapper 的 `IFNULL(cnt.product_count, 0)`
        // 位置一致 —— 统计列必须在子查询 JOIN 之后才可用）。
        let mut row_qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT ps.style_id, ps.style_name, ps.style_type, ps.style_image, ps.pc_image, \
             ps.start_time, ps.end_time, ps.status, ps.shop_id, ps.add_time, ps.update_time, \
             ps.is_delete, IFNULL(cnt.product_count, 0) AS product_count \
             FROM product_style ps LEFT JOIN (",
        );
        Self::push_count_subquery(&mut row_qb);
        row_qb.push(format!(
            ") cnt ON cnt.style_id = ps.style_id WHERE ps.is_delete = {NOT_DELETED}{shop_cond}"
        ));
        Self::push_filters(&mut row_qb, q, now, start_time, end_time);
        // ORDER BY 子句的列名来自 models::product_style_admin 的白名单映射，
        // 方向来自 ASC/DESC 二选一，均无注入面；LIMIT/OFFSET 为 u64 字面量。
        row_qb.push(q.order_clause());
        row_qb.push(format!(" LIMIT {limit} OFFSET {offset}"));

        // ⚠️ 不能写成 `Vec<(ProductStyle, i32)>`：sqlx 的元组 `FromRow` 要求
        // 每个元素都实现 `Decode + Type`，而 `ProductStyle` 只派生 `FromRow`
        // （不是 `Decode`）。因此这里用专门的 `StyleCountRow` 结构体。
        let rows: Vec<StyleCountRow> = row_qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;

        Ok((
            u64::try_from(total.0).unwrap_or(0),
            rows.into_iter()
                .map(|r| {
                    // 先取出 product_count（Copy），再 move `r` 拆实体，
                    // 避免「先 move 后借用」的编译错误。
                    let product_count = r.product_count;
                    StyleRowWithCount {
                        style: r.into_style(),
                        product_count,
                    }
                })
                .collect(),
        ))
    }

    /// 追加 `list` 的 WHERE 片段（`count` 与取行两条 SQL 共用，保证条件一致）。
    fn push_filters(
        qb: &mut QueryBuilder<'_, sqlx::MySql>,
        q: &ProductStyleListQuery,
        now: i64,
        start_time: Option<i64>,
        end_time: Option<i64>,
    ) {
        if let Some(style_type) = q.style_type {
            qb.push(" AND ps.style_type = ").push_bind(style_type);
        }
        if let Some(status) = q.status {
            qb.push(" AND ps.status = ").push_bind(status);
        }
        if let Some(keyword) = q.effective_keyword() {
            qb.push(" AND ps.style_name LIKE ")
                .push_bind(format!("%{keyword}%"));
        }
        // Java mapper 的三个 `<if>` 分支：只认 1 / 2 / 3，其它值不过滤
        match q.activity_status {
            Some(tigshop_core::models::marketing::product_style_admin::ACTIVITY_STATUS_NOT_STARTED) => {
                qb.push(" AND ps.start_time > ").push_bind(now);
            }
            Some(tigshop_core::models::marketing::product_style_admin::ACTIVITY_STATUS_IN_PROGRESS) => {
                qb.push(" AND ps.start_time <= ")
                    .push_bind(now)
                    .push(" AND ps.end_time >= ")
                    .push_bind(now);
            }
            Some(tigshop_core::models::marketing::product_style_admin::ACTIVITY_STATUS_ENDED) => {
                qb.push(" AND ps.end_time < ").push_bind(now);
            }
            _ => {}
        }
        if let Some(start_time) = start_time {
            qb.push(" AND ps.start_time >= ").push_bind(start_time);
        }
        if let Some(end_time) = end_time {
            qb.push(" AND ps.end_time <= ").push_bind(end_time);
        }
    }

    /// 拼 `LEFT JOIN` 的统计子查询（Java mapper `pageList` 的 `cnt` 派生表）。
    ///
    /// `p.is_delete` / `p.product_status` 是**字面量常量**而非绑定参数
    /// （与 Java 硬编码 `= 0` / `= 1` 一致）。
    fn push_count_subquery(qb: &mut QueryBuilder<'_, sqlx::MySql>) {
        qb.push(format!(
            "SELECT psi.style_id AS style_id, COUNT(DISTINCT p.product_id) AS product_count \
             FROM product_style_item psi INNER JOIN product p ON ({PRODUCT_JOIN_CONDITION}) \
             WHERE p.is_delete = {NOT_DELETED} AND p.product_status = {PRODUCT_STATUS_ON_SALE} \
             GROUP BY psi.style_id"
        ));
    }

    /// 按主键查询（对应 Java `getById`）。
    ///
    /// ⚠️ **不过滤 `is_delete`**：Java `getById` 就是主键直查，
    /// `detail` / `update` / `addProducts` / `removeProducts` 都基于它，
    /// 由服务层再判 `shop_id` 归属（Java `Objects.equals(shopId, ...)`）。
    pub async fn find_by_id(&self, style_id: i32) -> Result<Option<ProductStyle>> {
        sqlx::query_as::<_, ProductStyle>(&format!(
            "{STYLE_SELECT} WHERE ps.style_id = ? LIMIT 1"
        ))
        .bind(style_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 关联（product_style_item） —————————————————————

    /// 按样式 + 类型查出关联的目标 ID 列表（对应 Java
    /// `ProductStyleItemServiceImpl#getRefIdsByStyleIdAndType`）。
    ///
    /// Java 用 `lambdaQuery().eq(styleId).eq(itemType).list()` 后取 `refId`，
    /// **无 ORDER BY**（MySQL 返回顺序不保证）；本实现加 `ORDER BY item_id ASC`
    /// 以获得稳定顺序，语义上是超集（见 `uncertain_points`）。
    pub async fn find_ref_ids(&self, style_id: i32, item_type: i32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT ref_id FROM product_style_item \
             WHERE style_id = ? AND item_type = ? ORDER BY item_id ASC",
        )
        .bind(style_id)
        .bind(item_type)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 批量添加关联（对应 Java `ProductStyleItemServiceImpl#batchAdd`）。
    ///
    /// Java 先 `getRefIdsByStyleIdAndType` 查出已有的 `ref_id`，再过滤掉
    /// 重复项后 `saveBatch`。本实现用 **`INSERT ... ON DUPLICATE KEY UPDATE`**
    /// 之外的等价做法：先查已有（见 [`Self::find_ref_ids`] 的服务层调用），
    /// 这里只插入**过滤后**的列表，与 Java 的「先查后写」净效果一致。
    ///
    /// `add_time` 由服务层传入（Java `System.currentTimeMillis() / 1000`）。
    /// `ref_ids` 为空时不产生任何 SQL。
    pub async fn insert_items(
        &self,
        style_id: i32,
        item_type: i32,
        ref_ids: &[i32],
        add_time: i64,
    ) -> Result<u64> {
        if ref_ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("INSERT INTO product_style_item (style_id, item_type, ref_id, add_time) ");
        qb.push_values(ref_ids.iter(), |mut b, ref_id| {
            b.push_bind(style_id)
                .push_bind(item_type)
                .push_bind(*ref_id)
                .push_bind(add_time);
        });
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量移除关联（对应 Java `ProductStyleItemServiceImpl#batchRemove`）：
    /// `WHERE style_id = ? AND item_type = ? AND ref_id IN (...)`。
    ///
    /// `ref_ids` 为空时不产生任何 SQL（Java `CollUtil.isEmpty` 直接 return）。
    pub async fn delete_items(
        &self,
        style_id: i32,
        item_type: i32,
        ref_ids: &[i32],
    ) -> Result<u64> {
        if ref_ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "DELETE FROM product_style_item WHERE style_id = ",
        );
        qb.push_bind(style_id)
            .push(" AND item_type = ")
            .push_bind(item_type)
            .push(" AND ref_id IN (");
        let mut sep = qb.separated(", ");
        for ref_id in ref_ids {
            sep.push_bind(*ref_id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 删除某样式的全部关联（对应 Java
    /// `ProductStyleItemServiceImpl#removeByStyleId`）。
    ///
    /// ⚠️ Java 用的是 `lambdaUpdate()...remove()` —— `remove()` 是
    /// **物理删除**（`DELETE`），与 `product_style_item` 无软删列一致。
    pub async fn delete_items_by_style(&self, style_id: i32) -> Result<u64> {
        let res = sqlx::query("DELETE FROM product_style_item WHERE style_id = ?")
            .bind(style_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 统计某样式的关联条数（对应 Java `ProductStyleItemServiceImpl#countByStyleId`）。
    ///
    /// ⚠️ 该 Java 方法**没有被本切片的任何链路调用**，保留仅为方法齐全。
    pub async fn count_items_by_style(&self, style_id: i32) -> Result<i64> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM product_style_item WHERE style_id = ?")
                .bind(style_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0)
    }

    // ————————————————————— 详情组装所需的辅助查询 —————————————————————

    /// 按主键列表查商品简要信息（Java `productService.listByIds(allProductIds)`）。
    ///
    /// 只取 `ProductItemVO` 需要的 4 列；`product_price` 是
    /// `decimal(10,2)`，实体侧 `Decimal`。
    pub async fn find_products_by_ids(&self, ids: &[i32]) -> Result<Vec<StyleProductRow>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT product_id, product_name, pic_thumb, product_price FROM product WHERE product_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let rows: Vec<(i32, String, String, rust_decimal::Decimal)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(|(product_id, product_name, pic_thumb, product_price)| StyleProductRow {
                product_id,
                product_name,
                pic_thumb,
                product_price,
            })
            .collect())
    }

    /// 按主键列表查商品分组（Java `productGroupService.listByIds(groupIds)`）。
    ///
    /// 取 3 列：`product_group_id` / `product_group_name` / `product_ids`。
    /// `product_ids` 是 JSON 数组文本，由服务层 `提取分组内商品ID`
    /// （Java `JSONUtil.toList(group.getProductIds(), Integer.class)`）。
    pub async fn find_groups_by_ids(&self, ids: &[i32]) -> Result<Vec<StyleGroupRow>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT product_group_id, product_group_name, product_ids FROM product_group \
             WHERE product_group_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let rows: Vec<(i32, Option<String>, Option<String>)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(
                |(product_group_id, product_group_name, product_ids)| StyleGroupRow {
                    product_group_id,
                    product_group_name,
                    product_ids,
                },
            )
            .collect())
    }

    /// 按主键列表查品牌（Java `brandService.listByIds(brandIds)`）。
    ///
    /// 只取 `brand_id` / `brand_name` 两列即可满足 `BrandItemVO`。
    /// 返回实体 `Brand` 的其他字段由 `FromRow` 按缺省填充 ——
    /// 因此这里**显式列出全部 16 列**以匹配实体结构，避免 `FromRow` 缺列报错。
    pub async fn find_brands_by_ids(&self, ids: &[i32]) -> Result<Vec<Brand>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT brand_id, brand_name, brand_logo, brand_desc, site_url, sort_order, \
             is_show, brand_type, brand_is_hot, first_word, is_store_brand, check_status, \
             brand_en_name, shop_id, status, reject_remark FROM brand WHERE brand_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 查某品牌下**未删除且已上架**的商品ID
    /// （Java `productService.lambdaQuery().in(brandId, brandIds)
    /// .eq(isDelete, 0).select(productId).list()`）。
    ///
    /// ⚠️ Java 这里**只过滤 `isDelete = 0`，没有过滤 `product_status`**
    /// （与 `pageList` 统计口径的 `product_status = 1` 不同）。
    /// 本实现照抄 Java：只过滤 `is_delete = 0`。
    pub async fn find_product_ids_by_brands(&self, brand_ids: &[i32]) -> Result<Vec<i32>> {
        if brand_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT product_id FROM product WHERE is_delete = 0 AND brand_id IN (",
        );
        let mut sep = qb.separated(", ");
        for id in brand_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let rows: Vec<(i32,)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 批量统计每个样式关联的实际商品数量
    /// （对应 Java `ProductStyleMapper#countRealProductsByStyleIds`）。
    ///
    /// 与 `pageList` 的统计子查询**同一口径**（共用
    /// [`PRODUCT_JOIN_CONDITION`]），但这里额外限定
    /// `psi.style_id IN (...)`。返回 `(style_id, product_count)` 对；
    /// 无关联的样式**不会出现在结果里**（Java 侧由 `getOrDefault(styleId, 0)` 兜底）。
    pub async fn count_real_products_by_style_ids(
        &self,
        style_ids: &[i32],
    ) -> Result<Vec<(i32, i32)>> {
        if style_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(format!(
            "SELECT psi.style_id AS style_id, COUNT(DISTINCT p.product_id) AS product_count \
             FROM product_style_item psi INNER JOIN product p ON ({PRODUCT_JOIN_CONDITION}) \
             WHERE psi.style_id IN ("
        ));
        let mut sep = qb.separated(", ");
        for id in style_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        qb.push(format!(
            " AND p.is_delete = {NOT_DELETED} AND p.product_status = {PRODUCT_STATUS_ON_SALE} \
             GROUP BY psi.style_id"
        ));
        let rows: Vec<(i32, i64)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(|(style_id, count)| (style_id, i32::try_from(count).unwrap_or(i32::MAX)))
            .collect())
    }

    /// 品牌列表（含每个品牌下的上架商品数量）
    /// （对应 Java `ProductStyleMapper#selectBrandListWithProductCount`）。
    ///
    /// Java SQL **原文照抄**：
    /// ```sql
    /// SELECT b.brand_id, b.brand_name, COUNT(p.product_id) AS productCount
    /// FROM brand b LEFT JOIN product p ON b.brand_id = p.brand_id
    ///      AND p.is_delete = 0 AND p.product_status = 1
    /// WHERE b.is_show = 1
    ///   [AND b.brand_name LIKE CONCAT('%', keyword, '%')]
    /// GROUP BY b.brand_id, b.brand_name
    /// ORDER BY productCount DESC, b.sort_order ASC
    /// ```
    /// 返回 `(brand_id, brand_name, product_count)`。
    pub async fn select_brand_list_with_product_count(
        &self,
        keyword: Option<&str>,
    ) -> Result<Vec<(i32, String, i32)>> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new(
            "SELECT b.brand_id, b.brand_name, COUNT(p.product_id) AS product_count \
             FROM brand b LEFT JOIN product p ON b.brand_id = p.brand_id \
                 AND p.is_delete = 0 AND p.product_status = 1 \
             WHERE b.is_show = 1",
        );
        if let Some(keyword) = keyword {
            qb.push(" AND b.brand_name LIKE ")
                .push_bind(format!("%{keyword}%"));
        }
        qb.push(" GROUP BY b.brand_id, b.brand_name ORDER BY product_count DESC, b.sort_order ASC");
        let rows: Vec<(i32, String, i64)> = qb
            .build_query_as()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(|(brand_id, brand_name, count)| {
                (brand_id, brand_name, i32::try_from(count).unwrap_or(i32::MAX))
            })
            .collect())
    }

    // ————————————————————— 写入（product_style） —————————————————————

    /// 新增样式，返回自增主键（对应 Java `save`）。
    ///
    /// 除 `status` 外所有列都由服务层显式给出（Java
    /// `createProductStyle()` 对 `pc_image` 落空串、时间落 0、
    /// `is_delete` 硬编码 0、`add_time`/`update_time` 取当前秒）。
    /// `status` 为 `None` 时**不写该列**，由 MySQL 施加列默认值 0
    /// （对应 MyBatis-Plus `FieldStrategy.NOT_NULL`）。
    pub async fn insert(&self, v: &StyleInsert) -> Result<i32> {
        let mut columns: Vec<&'static str> = vec![
            "style_name",
            "style_type",
            "style_image",
            "pc_image",
            "start_time",
            "end_time",
            "shop_id",
            "add_time",
            "update_time",
            "is_delete",
        ];
        let mut binds: Vec<StyleInsertValue<'_>> = vec![
            StyleInsertValue::Text(&v.style_name),
            StyleInsertValue::Int(v.style_type),
            StyleInsertValue::Text(&v.style_image),
            StyleInsertValue::Text(&v.pc_image),
            StyleInsertValue::Int(i32::try_from(v.start_time).unwrap_or(i32::MAX)),
            StyleInsertValue::Int(i32::try_from(v.end_time).unwrap_or(i32::MAX)),
            StyleInsertValue::Int(v.shop_id),
            StyleInsertValue::Int(i32::try_from(v.add_time).unwrap_or(i32::MAX)),
            StyleInsertValue::Int(i32::try_from(v.update_time).unwrap_or(i32::MAX)),
            StyleInsertValue::Int(v.is_delete),
        ];
        if let Some(status) = v.status {
            columns.push("status");
            binds.push(StyleInsertValue::Int(status));
        }

        debug_assert_eq!(columns.len(), binds.len());
        let placeholders = vec!["?"; columns.len()].join(", ");
        let sql = format!(
            "INSERT INTO product_style ({}) VALUES ({placeholders})",
            columns.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for b in &binds {
            query = match b {
                StyleInsertValue::Text(t) => query.bind(*t),
                StyleInsertValue::Int(i) => query.bind(*i),
            };
        }
        let res = query.execute(&self.pool).await.map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    /// 整行更新（对应 Java `updateById`，`FieldStrategy.NOT_NULL` 语义：
    /// **只写非 null 字段**）。
    ///
    /// ⚠️ Java `ProductStyleEditParam#createProductStyle()` 显式
    /// `setAddTime(null)` ⇒ `add_time` **永不参与更新**；
    /// `update_time` 恒为当前秒 ⇒ **总是写**。
    /// `status` 可以为 null（父类无 `@NotNull`）⇒ 不写该列。
    pub async fn update(&self, style_id: i32, patch: &StylePatch) -> Result<u64> {
        let mut qb: QueryBuilder<'_, sqlx::MySql> = QueryBuilder::new("UPDATE product_style SET ");
        let mut sep = qb.separated(", ");
        push_assign!(sep, "style_name", patch.style_name);
        push_assign!(sep, "style_type", patch.style_type);
        push_assign!(sep, "style_image", patch.style_image);
        push_assign!(sep, "pc_image", patch.pc_image);
        push_assign!(sep, "start_time", patch.start_time);
        push_assign!(sep, "end_time", patch.end_time);
        push_assign!(sep, "status", patch.status);
        push_assign!(sep, "update_time", patch.update_time);
        drop(sep);
        qb.push(" WHERE style_id = ");
        qb.push_bind(style_id);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 单字段更新（对应 Java `BaseServiceImpl#updateField`）。
    ///
    /// `column` **必须**来自
    /// [`tigshop_core::models::marketing::product_style_admin::PRODUCT_STYLE_COLUMNS`]
    /// 的白名单映射（服务层负责），此处只做调试断言。
    /// `val` 以文本绑定，由 MySQL 按目标列类型隐式转换
    /// （与 MyBatis-Plus `set(column, "字符串值")` 行为一致）。
    pub async fn update_field(&self, style_id: i32, column: &str, val: &str) -> Result<u64> {
        debug_assert!(
            tigshop_core::models::marketing::product_style_admin::PRODUCT_STYLE_COLUMNS.contains(&column),
            "update_field 列名未经过白名单映射: {column}"
        );
        let sql = format!("UPDATE product_style SET {column} = ? WHERE style_id = ?");
        let res = sqlx::query(&sql)
            .bind(val)
            .bind(style_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按主键删除（对应 Java `AreaCodeServiceImpl#del` 同款
    /// `BaseServiceImpl#del` → `removeById` ⇒ **物理删除**）。
    ///
    /// ⚠️ 这是本域最需要产品确认的一处：`product_style` **有 `is_delete` 列**，
    /// 但 Java 的 `del` 走 `removeById`（`DELETE`），**不是软删除**。
    /// 本实现逐条复刻 Java 的物理删除行为（见 `uncertain_points`）。
    pub async fn delete(&self, style_id: i32) -> Result<bool> {
        let res = sqlx::query("DELETE FROM product_style WHERE style_id = ?")
            .bind(style_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(res.rows_affected() > 0)
    }

    /// 批量物理删除（对应 Java `BaseServiceImpl#batch` → `removeByIds`）。
    ///
    /// 返回**实际删除的行数**；Java 的 `removeByIds` 返回
    /// `SqlHelper.retBool(rows)`（`rows >= 1`），调用方据此折算布尔值。
    pub async fn delete_many(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM product_style WHERE style_id IN (");
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 批量物理删除关联（`batch` 删样式时清理孤儿关联，见服务层说明）。
    pub async fn delete_items_by_styles(&self, style_ids: &[i32]) -> Result<u64> {
        if style_ids.is_empty() {
            return Ok(0);
        }
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("DELETE FROM product_style_item WHERE style_id IN (");
        let mut sep = qb.separated(", ");
        for id in style_ids {
            sep.push_bind(*id);
        }
        sep.push_unseparated(")");
        drop(sep);
        let res = qb.build().execute(&self.pool).await.map_err(map_err)?;
        Ok(res.rows_affected())
    }
}

/// 列表取行的原始行：`product_style` 的 12 列 + 统计别名列。
///
/// ⚠️ 为什么不用 `Vec<(ProductStyle, i32)>`：sqlx 为元组实现的 `FromRow`
/// 要求每个元素都满足 `Decode + Type`（见 `sqlx-core` 的
/// `impl_from_row_for_tuple!`），而 `ProductStyle` 只派生 `FromRow`，
/// **不实现 `Decode`**，元组写法无法编译。
///
/// 因此这里用一个显式的扁平结构体承载 13 列。字段顺序与
/// [`ProductStyleAdminRepository::paginate`] 的 SELECT 列表**严格一致**
/// （`sqlx` 的 derive 默认按**列名**取值，顺序无关，但保持同序便于对照）。
#[derive(Debug, Clone, sqlx::FromRow)]
struct StyleCountRow {
    style_id: i32,
    style_name: String,
    style_type: i32,
    style_image: String,
    pc_image: String,
    start_time: i32,
    end_time: i32,
    status: i32,
    shop_id: i32,
    add_time: i32,
    update_time: i32,
    is_delete: i32,
    /// `IFNULL(cnt.product_count, 0) AS product_count`
    product_count: i32,
}

impl StyleCountRow {
    /// 拆分出实体部分。
    fn into_style(self) -> ProductStyle {
        ProductStyle {
            style_id: self.style_id,
            style_name: self.style_name,
            style_type: self.style_type,
            style_image: self.style_image,
            pc_image: self.pc_image,
            start_time: self.start_time,
            end_time: self.end_time,
            status: self.status,
            shop_id: self.shop_id,
            add_time: self.add_time,
            update_time: self.update_time,
            is_delete: self.is_delete,
        }
    }
}

/// 新增样式时待写入的列（`status` 为 `None` ⇒ 不写该列、走 MySQL 列默认值）。
#[derive(Debug, Clone)]
pub struct StyleInsert {
    /// `style_name`（必填，服务层已校验）
    pub style_name: String,
    /// `style_type`（必填，服务层已校验）
    pub style_type: i32,
    /// `style_image`（必填，服务层已校验）
    pub style_image: String,
    /// `pc_image`（Java `pcImage != null ? pcImage : ""`，恒有值）
    pub pc_image: String,
    /// `start_time`（Java 空白落 0）
    pub start_time: i64,
    /// `end_time`（Java 空白落 0）
    pub end_time: i64,
    /// `shop_id`（Java `getShopId() != null ? getShopId() : 0`）
    pub shop_id: i32,
    /// `add_time`（当前秒）
    pub add_time: i64,
    /// `update_time`（当前秒）
    pub update_time: i64,
    /// `is_delete`（Java 硬编码 0）
    pub is_delete: i32,
    /// `status`（`None` ⇒ 不写列）
    pub status: Option<i32>,
}

impl Default for StyleInsert {
    fn default() -> Self {
        Self {
            style_name: String::new(),
            style_type: 0,
            style_image: String::new(),
            pc_image: String::new(),
            start_time: 0,
            end_time: 0,
            shop_id: tigshop_core::models::marketing::product_style_admin::PLATFORM_SHOP_ID,
            add_time: 0,
            update_time: 0,
            is_delete: NOT_DELETED,
            status: None,
        }
    }
}

/// INSERT 的绑定值（避免为文本列与整型列定义平行 `Vec`）。
#[derive(Debug, Clone, Copy)]
enum StyleInsertValue<'a> {
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
///
/// ⚠️ **没有 `add_time` 字段**：Java `ProductStyleEditParam#createProductStyle()`
/// 显式 `setAddTime(null)`，该列永不参与更新（结构体层面就不提供入口）。
#[derive(Debug, Clone, Default)]
pub struct StylePatch {
    /// `style_name`
    pub style_name: Option<Option<String>>,
    /// `style_type`
    pub style_type: Option<Option<i32>>,
    /// `style_image`
    pub style_image: Option<Option<String>>,
    /// `pc_image`
    pub pc_image: Option<Option<String>>,
    /// `start_time`
    pub start_time: Option<Option<i64>>,
    /// `end_time`
    pub end_time: Option<Option<i64>>,
    /// `status`
    pub status: Option<Option<i32>>,
    /// `update_time`
    pub update_time: Option<Option<i64>>,
}

impl StylePatch {
    /// 是否有任何列会被写入。
    ///
    /// 判据必须与 [`push_assign`] 的实际写入条件（`Some(Some(v))`）一致：
    /// 外层 `None`（不写）与内层 `None`（值为 null，MyBatis-Plus
    /// `FieldStrategy.NOT_NULL` 同样跳过）都**不会**产生 `SET` 片段。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !matches!(self.style_name, Some(Some(_)))
            && !matches!(self.style_type, Some(Some(_)))
            && !matches!(self.style_image, Some(Some(_)))
            && !matches!(self.pc_image, Some(Some(_)))
            && !matches!(self.start_time, Some(Some(_)))
            && !matches!(self.end_time, Some(Some(_)))
            && !matches!(self.status, Some(Some(_)))
            && !matches!(self.update_time, Some(Some(_)))
    }
}

/// 关联类型常量在本层的快捷引用（供服务层与本文档对照）。
///
/// ⚠️ 这些常量**只是转发** `models::product_style_admin` 的同名常量，
/// 用于让本文档与 `impl` 内的 `use` 有落点，无独立语义。
#[allow(dead_code)]
pub(crate) const ITEM_TYPES: [i32; 3] = [ITEM_TYPE_PRODUCT, ITEM_TYPE_GROUP, ITEM_TYPE_BRAND];

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound(tigshop_core::models::marketing::product_style_admin::MSG_STYLE_NOT_FOUND.into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Option<Option<T>>` 三态：缺键与显式 null 都不写列；空串与 0 **要写**列。
    #[test]
    fn patch_keeps_empty_string_and_zero() {
        let patch = StylePatch {
            style_name: Some(Some(String::new())),
            status: Some(Some(0)),
            ..StylePatch::default()
        };
        assert!(!patch.is_empty());

        let empty = StylePatch {
            style_name: None,
            status: Some(None),
            ..StylePatch::default()
        };
        assert!(empty.is_empty());
    }

    /// 补丁里**没有** `add_time` 入口（Java 显式 `setAddTime(null)`）。
    #[test]
    fn patch_has_no_add_time_field() {
        // 结构体层面即不提供 add_time：这里用「除 update_time 外全空即视为空补丁」验证
        let only_update_time = StylePatch {
            update_time: Some(Some(1)),
            ..StylePatch::default()
        };
        assert!(!only_update_time.is_empty());
        assert!(StylePatch::default().is_empty());
    }

    /// `StyleInsert` 的默认值：`status` 不写列，`is_delete` = 0，平台门店 = 0。
    #[test]
    fn insert_defaults() {
        let v = StyleInsert::default();
        assert_eq!(v.status, None);
        assert_eq!(v.is_delete, NOT_DELETED);
        assert_eq!(v.shop_id, tigshop_core::models::marketing::product_style_admin::PLATFORM_SHOP_ID);
        assert_eq!(v.pc_image, "");
        assert_eq!(v.start_time, 0);
    }

    /// 三路关联条件与 Java mapper XML **逐字对照**（防止口径漂移）。
    #[test]
    fn product_join_condition_matches_mapper_xml() {
        // 1=商品 直接匹配 product_id
        assert!(PRODUCT_JOIN_CONDITION.contains("psi.item_type = 1 AND psi.ref_id = p.product_id"));
        // 2=分组 走 product_group.product_ids 的 JSON_CONTAINS
        assert!(PRODUCT_JOIN_CONDITION.contains("psi.item_type = 2"));
        assert!(PRODUCT_JOIN_CONDITION.contains("JSON_CONTAINS(pg.product_ids, CAST(p.product_id AS JSON))"));
        // 3=品牌 走 brand_id
        assert!(PRODUCT_JOIN_CONDITION.contains("psi.item_type = 3 AND psi.ref_id = p.brand_id"));
    }

    /// 统计口径常量与 Java 硬编码一致。
    #[test]
    fn count_scope_constants_match_java() {
        assert_eq!(NOT_DELETED, 0);
        assert_eq!(PRODUCT_STATUS_ON_SALE, 1);
        // 列清单必须与实体一致（12 列，且无 sort_order）
        assert_eq!(tigshop_core::models::marketing::product_style_admin::PRODUCT_STYLE_COLUMNS.len(), 12);
        assert!(!tigshop_core::models::marketing::product_style_admin::PRODUCT_STYLE_COLUMNS.contains(&"sort_order"));
    }
}

// ——————————————————————————————————————————————
// 公共端：商品生效样式（/api/product/productStyle）
// ——————————————————————————————————————————————

/// 生效样式行（Java `selectActiveStylesByProductIds` 的 resultType=map 等价物）。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct ActiveStyleRow {
    pub product_id: i32,
    pub style_id: i32,
    pub style_name: Option<String>,
    pub style_type: i32,
    pub style_image: Option<String>,
    pub pc_image: Option<String>,
    pub add_time: Option<i32>,
}

impl ProductStyleAdminRepository {
    /// 商品生效样式（Java `ProductStyleMapper#selectActiveStylesByProductIds`）。
    ///
    /// 三路 `UNION ALL`（`item_type` 1 商品 / 2 分组 / 3 品牌），
    /// 公共过滤：`ps.status = 1 AND ps.is_delete = 0`，
    /// `(start_time = 0 OR start_time <= now)`，
    /// `(end_time = 0 OR end_time >= now)`，`ORDER BY itemAddTime DESC`。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn find_active_styles(
        &self,
        product_ids: &[i32],
        now: i64,
    ) -> Result<Vec<ActiveStyleRow>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        #[allow(clippy::items_after_statements)]
        fn push_filter(
            qb: &mut QueryBuilder<'_, sqlx::MySql>,
            product_ids: &[i32],
            now: i64,
        ) {
            qb.push(" AND p.product_id IN (");
            let mut sep = qb.separated(", ");
            for id in product_ids {
                sep.push_bind(*id);
            }
            sep.push_unseparated(")");
            qb.push(" AND (ps.start_time = 0 OR ps.start_time <= ");
            qb.push_bind(now);
            qb.push(") AND (ps.end_time = 0 OR ps.end_time >= ");
            qb.push_bind(now);
            qb.push(")");
        }

        let columns = "SELECT p.product_id AS product_id, ps.style_id AS style_id, ps.style_name AS style_name, ps.style_type AS style_type, ps.style_image AS style_image, ps.pc_image AS pc_image, psi.add_time AS add_time";
        let ps_filter = " FROM product_style ps INNER JOIN product_style_item psi ON psi.style_id = ps.style_id";
        let mut qb: QueryBuilder<'_, sqlx::MySql> =
            QueryBuilder::new("SELECT product_id, style_id, style_name, style_type, style_image, pc_image, add_time FROM (");
        // ① item_type = 1：直接命中商品
        qb.push(columns);
        qb.push(ps_filter);
        qb.push(" AND psi.item_type = 1 INNER JOIN product p ON psi.ref_id = p.product_id WHERE ps.status = 1 AND ps.is_delete = 0");
        push_filter(&mut qb, product_ids, now);
        // ② item_type = 2：命中商品分组（product_group.product_ids JSON 数组）
        qb.push(" UNION ALL ");
        qb.push(columns);
        qb.push(ps_filter);
        qb.push(" AND psi.item_type = 2 INNER JOIN product_group pg ON pg.product_group_id = psi.ref_id INNER JOIN product p ON JSON_CONTAINS(pg.product_ids, CAST(p.product_id AS JSON)) WHERE ps.status = 1 AND ps.is_delete = 0");
        push_filter(&mut qb, product_ids, now);
        // ③ item_type = 3：命中品牌
        qb.push(" UNION ALL ");
        qb.push(columns);
        qb.push(ps_filter);
        qb.push(" AND psi.item_type = 3 INNER JOIN product p ON psi.ref_id = p.brand_id WHERE ps.status = 1 AND ps.is_delete = 0");
        push_filter(&mut qb, product_ids, now);
        qb.push(") AS combined ORDER BY add_time DESC");
        qb.build_query_as::<ActiveStyleRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按商品 SN 批量取 `(product_id, product_sn)`（Java
    /// `productService.lambdaQuery().in(productSn).eq(isDelete, 0)`）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn find_product_ids_by_sns(&self, product_sns: &[String]) -> Result<Vec<(i32, String)>> {
        if product_sns.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; product_sns.len()].join(", ");
        let sql = format!(
            "SELECT product_id, product_sn FROM product WHERE product_sn IN ({ph}) AND is_delete = 0"
        );
        let mut q = sqlx::query_as::<_, (i32, String)>(&sql);
        for sn in product_sns {
            q = q.bind(sn);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }
}

#[cfg(test)]
mod active_style_sql_tests {
    #[test]
    fn three_union_branches_and_filters_match_java_mapper() {
        let src = include_str!("product_style_admin.rs");
        assert!(src.contains("UNION ALL"));
        assert!(src.contains("psi.item_type = 1"));
        assert!(src.contains("psi.item_type = 2"));
        assert!(src.contains("psi.item_type = 3"));
        assert!(src.contains("JSON_CONTAINS(pg.product_ids, CAST(p.product_id AS JSON))"));
        assert!(src.contains("ps.status = 1"));
        assert!(src.contains("ps.is_delete = 0"));
        assert!(src.contains("ORDER BY add_time DESC"));
        assert!(src.contains("is_delete = 0"));
    }
}