//! 商品域（切片 catalog::product_manage）仓储：`product` / `product_sku` / `product_gallery` /
//! `product_attributes` / `product_video` / `product_article` / `product_group` /
//! `product_services` / `product_inventory_log` / `category` / `brand`。
//!
//! 对应原 Java `ProductMapper` / `ProductSkuMapper` / `ProductGalleryMapper` /
//! `ProductAttributesMapper` / `ProductVideoMapper` / `ProductArticleMapper` /
//! `ProductGroupMapper` / `ProductInventoryLogMapper`（MyBatis Plus）。
//!
//! 列名严格对齐 `java/database/pure.sql`（可用
//! `python tools/check_sql_columns.py --strict` 校验）。
//!
//! **书写约定**：所有 SQL 字面量都写成**单行**并以 `",` / `")` 结尾，
//! 这样 `tools/check_sql_columns.py` 的字符串提取逻辑才能正确闭合、
//! 逐条校验列名（多行拼接的字面量会被该脚本误判为跨语句）。
//!
//! 金额一律 `rust_decimal::Decimal`。

use rust_decimal::Decimal;
use sqlx::{FromRow, MySqlPool};
use tigshop_core::entities::{
    Brand, Category, Comment, Coupon, ECardGroup, Feedback, PriceInquiry, Product, ProductArticle,
    ProductAttributes, ProductGallery, ProductGroup, ProductInventoryLog, ProductPresale,
    ProductServices, ProductSku, ProductVideo, ShippingTpl, UserRank,
};
use tigshop_core::{Error, Result};

/// 商品列表过滤条件（由 services 层从 `AdminProductListQuery` 归一化后传入）。
///
/// `category_ids` / `brand_ids` / `id_list` 等集合已在服务层完成解析与
/// 分类子孙展开；仓储层只负责拼 SQL。
#[derive(Debug, Clone, Default)]
pub struct ProductListFilter {
    /// LIKE 模式（`%kw%`），未传关键词时为 `None`
    pub keyword_like: Option<String>,
    /// `product_id IN (...)`：与关键词组成 OR 分组（对应 Java `idList`）
    pub id_list: Vec<i32>,
    /// `is_delete` 的最终取值（Java：合法值用之，否则 0）
    pub is_delete: i32,
    pub shop_id: Option<i32>,
    pub product_status: Option<i32>,
    pub check_status: Option<i32>,
    pub product_id: Option<i32>,
    pub product_type: Option<i32>,
    pub product_types: Vec<i32>,
    pub exclude_product_types: Vec<i32>,
    /// 分类 ID（含全部子孙，Java `getCategoryAllChildIds`）
    pub category_ids: Vec<i32>,
    pub brand_id: Option<i32>,
    pub brand_ids: Vec<i32>,
    pub shop_category_id: Option<i32>,
    pub extra_product_ids: Vec<i32>,
    /// `Some(ids)` = 按商品分组过滤；`Some(空)` = 分组无商品，结果必然为空
    pub group_product_ids: Option<Vec<i32>>,
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub min_sales: Option<i32>,
    pub max_sales: Option<i32>,
    pub added_start_time: Option<i64>,
    pub added_end_time: Option<i64>,
    pub min_stock: Option<i32>,
    pub max_stock: Option<i32>,
    pub is_new: Option<i32>,
    pub suppliers_id: Option<i32>,
    pub sale_mode: Option<i32>,
    /// `ids` 字符串解析结果：非空时按 `FIELD(product_id, ...)` 排序
    pub field_order_ids: Vec<i32>,
    /// 排序列表（白名单列名 + asc/desc），无 `ids` 时生效
    pub order_column: &'static str,
    pub order_asc: bool,
    pub limit: u64,
    pub offset: u64,
}

/// 「选择商品」列表（`product` × 启用 SKU）的过滤条件。
///
/// 对应 Java `ProductMapper.selectProductList` 的查询参数；分类集合已由
/// 服务层展开为子孙分类 ID。
#[derive(Debug, Clone, Default)]
pub struct SelectProductFilter {
    pub shop_id: Option<i32>,
    /// LIKE 模式（`%kw%`），未传关键词时为 `None`
    pub keyword_like: Option<String>,
    pub category_ids: Vec<i32>,
    pub product_types: Vec<i32>,
    pub exclude_product_types: Vec<i32>,
    /// 仅普通销售模式（对应 Java `saleMode = 0`）
    pub sale_mode_only_normal: bool,
    /// 是否包含周期购 / 虚拟发货方式（对应 Java `isCycleProduct`）
    pub include_cycle_product: bool,
    /// 白名单排序列；`None` 时按 `add_time` 倒序
    pub order_column: Option<&'static str>,
    pub order_asc: bool,
    pub limit: u64,
    pub offset: u64,
}

/// `paginate_select_product_skus` 的行结构。
///
/// LEFT JOIN 的 SKU 列在未启用规格时为 `NULL`，因此 SKU 侧字段全部可选。
#[derive(Debug, Clone, Default, FromRow)]
pub struct SelectProductRow {
    pub product_id: i32,
    pub product_sn: String,
    pub product_name: String,
    pub product_stock: i32,
    pub category_id: i32,
    pub pic_url: String,
    pub shop_id: i32,
    pub product_price: Decimal,
    pub product_type: Option<i32>,
    pub sku_id: Option<i32>,
    pub sku_data: Option<String>,
    pub sku_stock: Option<i32>,
    pub sku_price: Option<Decimal>,
}

/// keyword / id_list 组合条件，对应 Java `buildQueryWrapper`：
/// - 仅 keyword：关键词模糊组；
/// - 仅 idList：`product_id IN (...)`（独立 AND 条件，装修选品依赖）；
/// - 两者都有：同一 nested 块内 OR（关键词命中或 id 命中均可）。
///
/// 注意不能写成 `( (? IS NULL OR 关键词组) OR id IN )`：keyword 为 NULL 时
/// `? IS NULL` 恒真会把整个分组短路，id 过滤失效。
/// 抽成函数便于单测（拼串规格化）。
fn keyword_group_sql(has_keyword: bool, id_count: usize) -> String {
    const KEYWORD_LIKES: &str =
        "(product_name LIKE ? OR keywords LIKE ? OR product_sn LIKE ? OR product_tsn LIKE ?)";
    match (has_keyword, id_count) {
        (false, 0) => String::new(),
        (true, 0) => format!(" AND {KEYWORD_LIKES}"),
        (false, n) => {
            let ph = vec!["?"; n].join(", ");
            format!(" AND product_id IN ({ph})")
        }
        (true, n) => {
            let ph = vec!["?"; n].join(", ");
            format!(" AND ({KEYWORD_LIKES} OR product_id IN ({ph}))")
        }
    }
}

/// 生成 `col IN (?, ?, ...)` 片段；空集合返回空串。
fn in_clause(column: &str, count: usize) -> String {
    if count == 0 {
        return String::new();
    }
    let ph = vec!["?"; count].join(", ");
    format!(" AND {column} IN ({ph})")
}

/// 生成 `col NOT IN (?, ?, ...)` 片段；空集合返回空串。
fn not_in_clause(column: &str, count: usize) -> String {
    if count == 0 {
        return String::new();
    }
    let ph = vec!["?"; count].join(", ");
    format!(" AND {column} NOT IN ({ph})")
}

/// 商品列表过滤条件的绑定顺序（**必须**与 `paginate_products` 的
/// `where_sql` 中占位符出现顺序一致：关键词组 → 通用条件 → 各 IN 集合）。
macro_rules! bind_product_filters {
    ($q:expr, $f:expr) => {{
        let mut q = $q;
        // keyword_group_sql：仅 keyword 存在时生成 4 个 LIKE 占位符；
        // 随后 id_list 的 IN 占位符（两者同组时 keyword 在前）
        if $f.keyword_like.is_some() {
            q = q.bind(&$f.keyword_like);
            q = q.bind(&$f.keyword_like);
            q = q.bind(&$f.keyword_like);
            q = q.bind(&$f.keyword_like);
        }
        for id in &$f.id_list {
            q = q.bind(id);
        }
        q = q.bind($f.is_delete);
        q = q.bind($f.shop_id);
        q = q.bind($f.shop_id);
        q = q.bind($f.product_status);
        q = q.bind($f.product_status);
        q = q.bind($f.check_status);
        q = q.bind($f.check_status);
        q = q.bind($f.product_id);
        q = q.bind($f.product_id);
        q = q.bind($f.product_type);
        q = q.bind($f.product_type);
        q = q.bind($f.brand_id);
        q = q.bind($f.brand_id);
        q = q.bind($f.shop_category_id);
        q = q.bind($f.shop_category_id);
        q = q.bind($f.min_price);
        q = q.bind($f.min_price);
        q = q.bind($f.max_price);
        q = q.bind($f.max_price);
        q = q.bind($f.min_sales);
        q = q.bind($f.min_sales);
        q = q.bind($f.max_sales);
        q = q.bind($f.max_sales);
        q = q.bind($f.added_start_time);
        q = q.bind($f.added_start_time);
        q = q.bind($f.added_end_time);
        q = q.bind($f.added_end_time);
        q = q.bind($f.min_stock);
        q = q.bind($f.min_stock);
        q = q.bind($f.max_stock);
        q = q.bind($f.max_stock);
        q = q.bind($f.is_new);
        q = q.bind($f.is_new);
        q = q.bind($f.suppliers_id);
        q = q.bind($f.suppliers_id);
        q = q.bind($f.sale_mode);
        q = q.bind($f.sale_mode);
        for id in &$f.category_ids {
            q = q.bind(id);
        }
        for id in &$f.product_types {
            q = q.bind(id);
        }
        for id in &$f.exclude_product_types {
            q = q.bind(id);
        }
        for id in &$f.brand_ids {
            q = q.bind(id);
        }
        for id in &$f.extra_product_ids {
            q = q.bind(id);
        }
        if let Some(group_ids) = &$f.group_product_ids {
            if !group_ids.is_empty() {
                for id in group_ids {
                    q = q.bind(id);
                }
            }
        }
        q
    }};
}

/// 商品仓储。
#[derive(Clone)]
pub struct ProductManageRepository {
    pool: MySqlPool,
}

impl ProductManageRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层事务复用）。
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 商品主表 —————————————————————

    /// 按 ID 查询商品（不过滤软删除，与原 Java `getById` 一致）。
    pub async fn find_product(&self, product_id: i32) -> Result<Option<Product>> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM product WHERE product_id = ? LIMIT 1",
        )
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 查询到期的自动上下架任务（`product_auto_status`）。
    pub async fn find_due_auto_status(
        &self,
        now: i64,
        limit: i64,
    ) -> Result<Vec<tigshop_core::entities::ProductAutoStatus>> {
        sqlx::query_as::<_, tigshop_core::entities::ProductAutoStatus>(
            "SELECT * FROM product_auto_status \
             WHERE status = 0 AND is_deleted = 0 AND scheduled_time <= ? AND retry_count < 3 \
             ORDER BY scheduled_time DESC LIMIT ?",
        )
        .bind(now)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 更新商品上下架状态（自动任务）。
    pub async fn update_product_status_auto(
        &self,
        product_id: i32,
        status: i32,
    ) -> Result<u64> {
        let res = sqlx::query(
            "UPDATE product SET product_status = ? WHERE product_id = ? AND is_delete = 0",
        )
        .bind(status)
        .bind(product_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 回写自动任务执行结果。
    pub async fn mark_auto_status(
        &self,
        id: i32,
        status: i32,
        error_message: Option<&str>,
        retry_count: i32,
        execute_time: i64,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE product_auto_status SET status = ?, error_message = ?, retry_count = ?, \
             execute_time = ?, update_time = ? WHERE id = ?",
        )
        .bind(status)
        .bind(error_message)
        .bind(retry_count)
        .bind(execute_time)
        .bind(execute_time)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(())
    }

    /// 按货号或条形码查询商品（对应 Java `getProductBySn`：
    /// `product_sn = sn OR product_tsn = sn`）。
    pub async fn find_product_by_sn(&self, sn: &str) -> Result<Option<Product>> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM product WHERE (product_sn = ? OR product_tsn = ?) AND is_delete = 0 LIMIT 1",
        )
        .bind(sn)
        .bind(sn)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 商品点击量 +1（对应 Java `detail` 里 `setClickCount(+1)` 后 `updateById`）。
    pub async fn inc_click_count(&self, product_id: i32) -> Result<()> {
        sqlx::query("UPDATE product SET click_count = click_count + 1 WHERE product_id = ?")
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    /// 货号重复计数（`exclude_product_id` 非空时排除自身，供更新场景）。
    pub async fn count_product_sn(&self, sn: &str, exclude_product_id: Option<i32>) -> Result<u64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM product WHERE product_sn = ? AND (? IS NULL OR product_id <> ?)",
        )
        .bind(sn)
        .bind(exclude_product_id)
        .bind(exclude_product_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0.max(0) as u64)
    }

    /// 管理端商品分页（返回 `(总数, 行)`）。
    ///
    /// 条件语义逐条对应 Java `ProductServiceImpl#buildQueryWrapper`
    /// （见各字段注释），未迁移项在 services 层说明。
    pub async fn paginate_products(
        &self,
        f: &ProductListFilter,
    ) -> Result<(u64, Vec<Product>)> {
        let mut where_sql = String::from("WHERE 1 = 1 ");
        where_sql.push_str(&keyword_group_sql(
            f.keyword_like.is_some(),
            f.id_list.len(),
        ));
        where_sql.push_str(" AND is_delete = ? AND (? IS NULL OR shop_id = ?) AND (? IS NULL OR product_status = ?) AND (? IS NULL OR check_status = ?) AND (? IS NULL OR product_id = ?) AND (? IS NULL OR product_type = ?) AND (? IS NULL OR brand_id = ?) AND (? IS NULL OR shop_category_id = ?) AND (? IS NULL OR product_price >= ?) AND (? IS NULL OR product_price <= ?) AND (? IS NULL OR virtual_sales >= ?) AND (? IS NULL OR virtual_sales <= ?) AND (? IS NULL OR add_time >= ?) AND (? IS NULL OR add_time <= ?) AND (? IS NULL OR product_stock >= ?) AND (? IS NULL OR product_stock <= ?) AND (? IS NULL OR is_new = ?) AND (? IS NULL OR suppliers_id = ?) AND (? IS NULL OR sale_mode = ?)");
        where_sql.push_str(&in_clause("category_id", f.category_ids.len()));
        where_sql.push_str(&in_clause("product_type", f.product_types.len()));
        where_sql.push_str(&not_in_clause("product_type", f.exclude_product_types.len()));
        where_sql.push_str(&in_clause("brand_id", f.brand_ids.len()));
        where_sql.push_str(&not_in_clause("product_id", f.extra_product_ids.len()));
        if let Some(group_ids) = &f.group_product_ids {
            if group_ids.is_empty() {
                // 分组内无商品：Java 用 `product_id = -1` 让结果为空
                where_sql.push_str(" AND product_id = -1");
            } else {
                where_sql.push_str(&in_clause("product_id", group_ids.len()));
            }
        }

        let count_sql = format!(
            "SELECT COUNT(*) FROM product {where_sql}",
        );
        let order_sql = if f.field_order_ids.is_empty() {
            let dir = if f.order_asc { "ASC" } else { "DESC" };
            format!("ORDER BY {} {dir}, product_id DESC", f.order_column)
        } else {
            let ph = vec!["?"; f.field_order_ids.len()].join(", ");
            format!("ORDER BY FIELD(product_id, {ph})")
        };
        let rows_sql = format!(
            "SELECT * FROM product {where_sql} {order_sql} LIMIT ? OFFSET ?",
        );

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        count_q = bind_product_filters!(count_q, f);
        let total: (i64,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;

        let mut rows_q = sqlx::query_as::<_, Product>(&rows_sql);
        rows_q = bind_product_filters!(rows_q, f);
        for id in &f.field_order_ids {
            rows_q = rows_q.bind(id);
        }
        let rows = rows_q
            .bind(f.limit)
            .bind(f.offset)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;

        Ok((total.0.max(0) as u64, rows))
    }

    /// 新增商品（全列 INSERT，避免依赖库默认值），返回自增 `product_id`。
    pub async fn insert_product(&self, p: &Product) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product (product_name, seo_identification, product_sn, product_tsn, product_stock, product_price, market_price, shipping_tpl_id, product_status, product_type, delivery_mode, sale_mode, category_id, brand_id, shop_id, keywords, shop_category_id, check_status, check_reason, click_count, product_weight, is_promote, is_promote_activity, promote_price, promote_start_date, promote_end_date, seckill_max_num, product_brief, product_desc, pic_url, pic_thumb, pic_original, pic_large, comment_tag, free_shipping, integral, add_time, sort_order, store_sort_order, is_delete, is_best, is_new, is_hot, last_update, remark, give_integral, rank_integral, suppliers_id, virtual_sales, limit_number, product_care, product_related, product_service_ids, is_support_return, is_support_cod, product_video, prepay_price, card_group_id, virtual_sample, paid_content, no_shipping, fixed_shipping_type, fixed_shipping_fee, vendor_product_id, vendor_id, shop_pickup_tpl_id, is_shop_pickup, is_logistics, is_shop_delivery, reservation_tpl_id, cost_price, product_unit, is_need_re_import_vendor_product, gift_card_groups_id, attributes_tpl_id, share_info, delivery_service_fee_type, delivery_service_fee_value, server_service_fee_type, server_service_fee_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.product_name)
        .bind(&p.seo_identification)
        .bind(&p.product_sn)
        .bind(&p.product_tsn)
        .bind(&p.product_stock)
        .bind(&p.product_price)
        .bind(&p.market_price)
        .bind(&p.shipping_tpl_id)
        .bind(&p.product_status)
        .bind(&p.product_type)
        .bind(&p.delivery_mode)
        .bind(&p.sale_mode)
        .bind(&p.category_id)
        .bind(&p.brand_id)
        .bind(&p.shop_id)
        .bind(&p.keywords)
        .bind(&p.shop_category_id)
        .bind(&p.check_status)
        .bind(&p.check_reason)
        .bind(&p.click_count)
        .bind(&p.product_weight)
        .bind(&p.is_promote)
        .bind(&p.is_promote_activity)
        .bind(&p.promote_price)
        .bind(&p.promote_start_date)
        .bind(&p.promote_end_date)
        .bind(&p.seckill_max_num)
        .bind(&p.product_brief)
        .bind(&p.product_desc)
        .bind(&p.pic_url)
        .bind(&p.pic_thumb)
        .bind(&p.pic_original)
        .bind(&p.pic_large)
        .bind(&p.comment_tag)
        .bind(&p.free_shipping)
        .bind(&p.integral)
        .bind(&p.add_time)
        .bind(&p.sort_order)
        .bind(&p.store_sort_order)
        .bind(&p.is_delete)
        .bind(&p.is_best)
        .bind(&p.is_new)
        .bind(&p.is_hot)
        .bind(&p.last_update)
        .bind(&p.remark)
        .bind(&p.give_integral)
        .bind(&p.rank_integral)
        .bind(&p.suppliers_id)
        .bind(&p.virtual_sales)
        .bind(&p.limit_number)
        .bind(&p.product_care)
        .bind(&p.product_related)
        .bind(&p.product_service_ids)
        .bind(&p.is_support_return)
        .bind(&p.is_support_cod)
        .bind(&p.product_video)
        .bind(&p.prepay_price)
        .bind(&p.card_group_id)
        .bind(&p.virtual_sample)
        .bind(&p.paid_content)
        .bind(&p.no_shipping)
        .bind(&p.fixed_shipping_type)
        .bind(&p.fixed_shipping_fee)
        .bind(&p.vendor_product_id)
        .bind(&p.vendor_id)
        .bind(&p.shop_pickup_tpl_id)
        .bind(&p.is_shop_pickup)
        .bind(&p.is_logistics)
        .bind(&p.is_shop_delivery)
        .bind(&p.reservation_tpl_id)
        .bind(&p.cost_price)
        .bind(&p.product_unit)
        .bind(&p.is_need_re_import_vendor_product)
        .bind(&p.gift_card_groups_id)
        .bind(&p.attributes_tpl_id)
        .bind(&p.share_info)
        .bind(&p.delivery_service_fee_type)
        .bind(&p.delivery_service_fee_value)
        .bind(&p.server_service_fee_type)
        .bind(&p.server_service_fee_value)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        let product_id = r.last_insert_id() as i32;
        // v5.8.61 体积列：保留旧 INSERT 列清单，插入后补写，避免影响历史字段顺序。
        sqlx::query("UPDATE product SET product_volume = ? WHERE product_id = ?")
            .bind(p.product_volume)
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(product_id)
    }

    /// 全列更新商品（调用方先 `find_product` 再按入参合并，
    /// 等价于 Java `updateById` 的 `NOT_NULL` 字段策略）。
    pub async fn update_product(&self, p: &Product) -> Result<u64> {
        let r = sqlx::query(
            "UPDATE product SET product_name = ?, seo_identification = ?, product_sn = ?, product_tsn = ?, product_stock = ?, product_price = ?, market_price = ?, shipping_tpl_id = ?, product_status = ?, product_type = ?, delivery_mode = ?, sale_mode = ?, category_id = ?, brand_id = ?, shop_id = ?, keywords = ?, shop_category_id = ?, check_status = ?, check_reason = ?, click_count = ?, product_weight = ?, is_promote = ?, is_promote_activity = ?, promote_price = ?, promote_start_date = ?, promote_end_date = ?, seckill_max_num = ?, product_brief = ?, product_desc = ?, pic_url = ?, pic_thumb = ?, pic_original = ?, pic_large = ?, comment_tag = ?, free_shipping = ?, integral = ?, add_time = ?, sort_order = ?, store_sort_order = ?, is_delete = ?, is_best = ?, is_new = ?, is_hot = ?, last_update = ?, remark = ?, give_integral = ?, rank_integral = ?, suppliers_id = ?, virtual_sales = ?, limit_number = ?, product_care = ?, product_related = ?, product_service_ids = ?, is_support_return = ?, is_support_cod = ?, product_video = ?, prepay_price = ?, card_group_id = ?, virtual_sample = ?, paid_content = ?, no_shipping = ?, fixed_shipping_type = ?, fixed_shipping_fee = ?, vendor_product_id = ?, vendor_id = ?, shop_pickup_tpl_id = ?, is_shop_pickup = ?, is_logistics = ?, is_shop_delivery = ?, reservation_tpl_id = ?, cost_price = ?, product_unit = ?, is_need_re_import_vendor_product = ?, gift_card_groups_id = ?, attributes_tpl_id = ?, share_info = ?, delivery_service_fee_type = ?, delivery_service_fee_value = ?, server_service_fee_type = ?, server_service_fee_value = ? WHERE product_id = ?",
        )
        .bind(&p.product_name)
        .bind(&p.seo_identification)
        .bind(&p.product_sn)
        .bind(&p.product_tsn)
        .bind(&p.product_stock)
        .bind(&p.product_price)
        .bind(&p.market_price)
        .bind(&p.shipping_tpl_id)
        .bind(&p.product_status)
        .bind(&p.product_type)
        .bind(&p.delivery_mode)
        .bind(&p.sale_mode)
        .bind(&p.category_id)
        .bind(&p.brand_id)
        .bind(&p.shop_id)
        .bind(&p.keywords)
        .bind(&p.shop_category_id)
        .bind(&p.check_status)
        .bind(&p.check_reason)
        .bind(&p.click_count)
        .bind(&p.product_weight)
        .bind(&p.is_promote)
        .bind(&p.is_promote_activity)
        .bind(&p.promote_price)
        .bind(&p.promote_start_date)
        .bind(&p.promote_end_date)
        .bind(&p.seckill_max_num)
        .bind(&p.product_brief)
        .bind(&p.product_desc)
        .bind(&p.pic_url)
        .bind(&p.pic_thumb)
        .bind(&p.pic_original)
        .bind(&p.pic_large)
        .bind(&p.comment_tag)
        .bind(&p.free_shipping)
        .bind(&p.integral)
        .bind(&p.add_time)
        .bind(&p.sort_order)
        .bind(&p.store_sort_order)
        .bind(&p.is_delete)
        .bind(&p.is_best)
        .bind(&p.is_new)
        .bind(&p.is_hot)
        .bind(&p.last_update)
        .bind(&p.remark)
        .bind(&p.give_integral)
        .bind(&p.rank_integral)
        .bind(&p.suppliers_id)
        .bind(&p.virtual_sales)
        .bind(&p.limit_number)
        .bind(&p.product_care)
        .bind(&p.product_related)
        .bind(&p.product_service_ids)
        .bind(&p.is_support_return)
        .bind(&p.is_support_cod)
        .bind(&p.product_video)
        .bind(&p.prepay_price)
        .bind(&p.card_group_id)
        .bind(&p.virtual_sample)
        .bind(&p.paid_content)
        .bind(&p.no_shipping)
        .bind(&p.fixed_shipping_type)
        .bind(&p.fixed_shipping_fee)
        .bind(&p.vendor_product_id)
        .bind(&p.vendor_id)
        .bind(&p.shop_pickup_tpl_id)
        .bind(&p.is_shop_pickup)
        .bind(&p.is_logistics)
        .bind(&p.is_shop_delivery)
        .bind(&p.reservation_tpl_id)
        .bind(&p.cost_price)
        .bind(&p.product_unit)
        .bind(&p.is_need_re_import_vendor_product)
        .bind(&p.gift_card_groups_id)
        .bind(&p.attributes_tpl_id)
        .bind(&p.share_info)
        .bind(&p.delivery_service_fee_type)
        .bind(&p.delivery_service_fee_value)
        .bind(&p.server_service_fee_type)
        .bind(&p.server_service_fee_value)
        .bind(p.product_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        sqlx::query("UPDATE product SET product_volume = ? WHERE product_id = ?")
            .bind(p.product_volume)
            .bind(p.product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 仅更新商品的价格与库存汇总字段（对应 Java `updateProductSkuSummary`
    /// 与 `applyEnabledSkuSummary`：多规格商品的 `product_price` 取启用规格
    /// 最低价，`product_stock` 取启用规格库存之和）。
    pub async fn update_product_summary(
        &self,
        product_id: i32,
        product_stock: i32,
        product_price: Decimal,
    ) -> Result<u64> {
        let r = sqlx::query("UPDATE product SET product_stock = ?, product_price = ? WHERE product_id = ?")
            .bind(product_stock)
            .bind(product_price)
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 软删除商品（`is_delete = 1`）。
    ///
    /// 说明：现存 Java `ProductController` 的删除走 `/batch` 或 `/recycle`
    /// （`productService.batchOperation` / `recycle`），本切片被要求实现
    /// `POST /del`，语义取「软删除」，详见返回值 `uncertain_points`。
    pub async fn soft_delete_products(&self, ids: &[i32]) -> Result<u64> {
        self.soft_delete_products_scoped(ids, None).await
    }

    /// 软删除商品（带店铺租户隔离，商户账号只能删除自身店铺的商品）。
    pub async fn soft_delete_products_scoped(&self, ids: &[i32], shop_id: Option<i32>) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let mut sql = format!("UPDATE product SET is_delete = 1 WHERE product_id IN ({ph})");
        if let Some(_sid) = shop_id {
            sql.push_str(" AND shop_id = ?");
        }
        let mut q = sqlx::query(&sql);
        for id in ids {
            q = q.bind(id);
        }
        if let Some(sid) = shop_id {
            q = q.bind(sid);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }


    // ————————————————————— 商品 SKU —————————————————————

    /// 商品规格列表（`include_disabled = false` 时只取启用规格，
    /// 对应 Java `getProductSkusByPid(pid, includeDisabled)`）。
    pub async fn find_skus(&self, product_id: i32, include_disabled: bool) -> Result<Vec<ProductSku>> {
        sqlx::query_as::<_, ProductSku>(
            "SELECT * FROM product_sku WHERE product_id = ? AND (? = 1 OR is_enabled = 1) ORDER BY sku_id ASC",
        )
        .bind(product_id)
        .bind(i32::from(include_disabled))
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 批量查询多个商品的规格（消除列表页 N+1 查询；语义等价于对每个
    /// 商品调用 [`Self::find_skus`]）。
    pub async fn find_skus_by_product_ids(
        &self,
        product_ids: &[i32],
        include_disabled: bool,
    ) -> Result<Vec<ProductSku>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; product_ids.len()].join(", ");
        let sql = format!(
            "SELECT * FROM product_sku WHERE product_id IN ({ph}) AND (? = 1 OR is_enabled = 1) ORDER BY product_id ASC, sku_id ASC",
        );
        let mut q = sqlx::query_as::<_, ProductSku>(&sql);
        for id in product_ids {
            q = q.bind(id);
        }
        q.bind(i32::from(include_disabled))
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按主键集合查询规格。
    pub async fn find_skus_by_ids(&self, sku_ids: &[i32]) -> Result<Vec<ProductSku>> {
        if sku_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; sku_ids.len()].join(", ");
        let sql = format!("SELECT * FROM product_sku WHERE sku_id IN ({ph})");
        let mut q = sqlx::query_as::<_, ProductSku>(&sql);
        for id in sku_ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 新增规格，返回 `sku_id`。
    pub async fn insert_sku(&self, s: &ProductSku) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product_sku (product_id, sku_value, sku_data, sku_sn, sku_stock, sku_tsn, sku_price, is_enabled, market_price, cost_price, delivery_service_fee_type, delivery_service_fee_value, server_service_fee_type, server_service_fee_value, vendor_product_sku_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&s.product_id)
        .bind(&s.sku_value)
        .bind(&s.sku_data)
        .bind(&s.sku_sn)
        .bind(&s.sku_stock)
        .bind(&s.sku_tsn)
        .bind(&s.sku_price)
        .bind(&s.is_enabled)
        .bind(&s.market_price)
        .bind(&s.cost_price)
        .bind(&s.delivery_service_fee_type)
        .bind(&s.delivery_service_fee_value)
        .bind(&s.server_service_fee_type)
        .bind(&s.server_service_fee_value)
        .bind(&s.vendor_product_sku_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        let sku_id = r.last_insert_id() as i32;
        sqlx::query("UPDATE product_sku SET sku_weight = ?, sku_volume = ? WHERE sku_id = ?")
            .bind(s.sku_weight)
            .bind(s.sku_volume)
            .bind(sku_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(sku_id)
    }

    /// 按主键更新规格（全列写入，调用方先查后合并）。
    pub async fn update_sku(&self, s: &ProductSku) -> Result<u64> {
        let r = sqlx::query(
            "UPDATE product_sku SET product_id = ?, sku_value = ?, sku_data = ?, sku_sn = ?, sku_stock = ?, sku_tsn = ?, sku_price = ?, is_enabled = ?, market_price = ?, cost_price = ?, delivery_service_fee_type = ?, delivery_service_fee_value = ?, server_service_fee_type = ?, server_service_fee_value = ?, vendor_product_sku_id = ? WHERE sku_id = ?",
        )
        .bind(&s.product_id)
        .bind(&s.sku_value)
        .bind(&s.sku_data)
        .bind(&s.sku_sn)
        .bind(&s.sku_stock)
        .bind(&s.sku_tsn)
        .bind(&s.sku_price)
        .bind(&s.is_enabled)
        .bind(&s.market_price)
        .bind(&s.cost_price)
        .bind(&s.delivery_service_fee_type)
        .bind(&s.delivery_service_fee_value)
        .bind(&s.server_service_fee_type)
        .bind(&s.server_service_fee_value)
        .bind(&s.vendor_product_sku_id)
        .bind(s.sku_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        sqlx::query("UPDATE product_sku SET sku_weight = ?, sku_volume = ? WHERE sku_id = ?")
            .bind(s.sku_weight)
            .bind(s.sku_volume)
            .bind(s.sku_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 批量更新规格编码（`sku_sn` 兜底生成，对应 Java
    /// `productSn + "-" + skuId`）。
    pub async fn update_sku_sn(&self, sku_id: i32, sku_sn: &str) -> Result<u64> {
        let r = sqlx::query("UPDATE product_sku SET sku_sn = ? WHERE sku_id = ?")
            .bind(sku_sn)
            .bind(sku_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 按主键删除规格。
    pub async fn delete_skus(&self, sku_ids: &[i32]) -> Result<u64> {
        if sku_ids.is_empty() {
            return Ok(0);
        }
        let ph = vec!["?"; sku_ids.len()].join(", ");
        let sql = format!("DELETE FROM product_sku WHERE sku_id IN ({ph})");
        let mut q = sqlx::query(&sql);
        for id in sku_ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 删除某商品下全部**启用**规格（Java：SKU 列表为空时执行）。
    pub async fn delete_enabled_skus(&self, product_id: i32) -> Result<u64> {
        let r = sqlx::query("DELETE FROM product_sku WHERE product_id = ? AND is_enabled = 1")
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    // ————————————————————— 商品相册 —————————————————————

    /// 商品相册（`shop_id = 0` 的平台图，对应 Java
    /// `getProductGalleryList(productId)`）。
    pub async fn find_gallery(&self, product_id: i32) -> Result<Vec<ProductGallery>> {
        sqlx::query_as::<_, ProductGallery>(
            "SELECT * FROM product_gallery WHERE product_id = ? AND shop_id = 0 ORDER BY sort_order ASC, pic_id ASC",
        )
        .bind(product_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 清空商品相册（`shop_id = 0`）。
    pub async fn delete_gallery(&self, product_id: i32) -> Result<u64> {
        let r = sqlx::query("DELETE FROM product_gallery WHERE product_id = ? AND shop_id = 0")
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 新增相册图。
    pub async fn insert_gallery(&self, g: &ProductGallery) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product_gallery (product_id, pic_url, pic_desc, pic_thumb, pic_original, pic_large, sort_order, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&g.product_id)
        .bind(&g.pic_url)
        .bind(&g.pic_desc)
        .bind(&g.pic_thumb)
        .bind(&g.pic_original)
        .bind(&g.pic_large)
        .bind(&g.sort_order)
        .bind(&g.shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    // ————————————————————— 商品属性 —————————————————————

    /// 商品属性（按 `sort_order` 升序，对应 Java `getAttributesByProductId`）。
    pub async fn find_attributes(&self, product_id: i32) -> Result<Vec<ProductAttributes>> {
        sqlx::query_as::<_, ProductAttributes>(
            "SELECT * FROM product_attributes WHERE product_id = ? ORDER BY sort_order ASC, attributes_id ASC",
        )
        .bind(product_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 删除商品属性（保留 `keep_ids`，对应 Java
    /// `remove(product_id = ? and attributes_id not in (...))`）。
    pub async fn delete_attributes_except(&self, product_id: i32, keep_ids: &[i32]) -> Result<u64> {
        let sql = if keep_ids.is_empty() {
            "DELETE FROM product_attributes WHERE product_id = ?".to_string()
        } else {
            let ph = vec!["?"; keep_ids.len()].join(", ");
            format!("DELETE FROM product_attributes WHERE product_id = ? AND attributes_id NOT IN ({ph})")
        };
        let mut q = sqlx::query(&sql).bind(product_id);
        for id in keep_ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 新增商品属性。
    pub async fn insert_attribute(&self, a: &ProductAttributes) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product_attributes (product_id, attr_type, attr_name, attr_value, attr_price, attr_color, attr_pic, attr_pic_thumb, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&a.product_id)
        .bind(&a.attr_type)
        .bind(&a.attr_name)
        .bind(&a.attr_value)
        .bind(&a.attr_price)
        .bind(&a.attr_color)
        .bind(&a.attr_pic)
        .bind(&a.attr_pic_thumb)
        .bind(&a.sort_order)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 更新商品属性。
    pub async fn update_attribute(&self, a: &ProductAttributes) -> Result<u64> {
        let r = sqlx::query(
            "UPDATE product_attributes SET product_id = ?, attr_type = ?, attr_name = ?, attr_value = ?, attr_price = ?, attr_color = ?, attr_pic = ?, attr_pic_thumb = ?, sort_order = ? WHERE attributes_id = ?",
        )
        .bind(&a.product_id)
        .bind(&a.attr_type)
        .bind(&a.attr_name)
        .bind(&a.attr_value)
        .bind(&a.attr_price)
        .bind(&a.attr_color)
        .bind(&a.attr_pic)
        .bind(&a.attr_pic_thumb)
        .bind(&a.sort_order)
        .bind(a.attributes_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    // ————————————————————— 商品视频 / 关联文章 —————————————————————

    /// 商品视频列表。
    pub async fn find_videos(&self, product_id: i32) -> Result<Vec<ProductVideo>> {
        sqlx::query_as::<_, ProductVideo>(
            "SELECT * FROM product_video WHERE product_id = ? ORDER BY id ASC",
        )
        .bind(product_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 清空商品视频。
    pub async fn delete_videos(&self, product_id: i32) -> Result<u64> {
        let r = sqlx::query("DELETE FROM product_video WHERE product_id = ?")
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 新增商品视频。
    pub async fn insert_video(&self, v: &ProductVideo) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product_video (video_id, product_id, video_url, video_cover, format) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&v.video_id)
        .bind(&v.product_id)
        .bind(&v.video_url)
        .bind(&v.video_cover)
        .bind(&v.format)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 商品关联文章 ID。
    pub async fn find_article_ids(&self, product_id: i32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT article_id FROM product_article WHERE goods_id = ? ORDER BY article_id ASC")
                .bind(product_id)
                .fetch_all(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 清空商品关联文章。
    pub async fn delete_articles(&self, product_id: i32) -> Result<u64> {
        let r = sqlx::query("DELETE FROM product_article WHERE goods_id = ?")
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 按文章 ID 集合删除某商品的关联文章（对应 Java `saveProductArticle`
    /// 中「先按 `article_id IN (list)` 删除、再批量插入」的语义：
    /// 其它文章的关联行保留）。
    pub async fn delete_articles_in(&self, product_id: i32, article_ids: &[i32]) -> Result<u64> {
        if article_ids.is_empty() {
            return Ok(0);
        }
        let ph = vec!["?"; article_ids.len()].join(", ");
        let sql = format!("DELETE FROM product_article WHERE goods_id = ? AND article_id IN ({ph})");
        let mut q = sqlx::query(&sql).bind(product_id);
        for id in article_ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 新增商品关联文章。
    pub async fn insert_article(&self, a: &ProductArticle) -> Result<()> {
        sqlx::query("INSERT INTO product_article (goods_id, article_id) VALUES (?, ?)")
            .bind(&a.goods_id)
            .bind(&a.article_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    // ————————————————————— 库存日志 —————————————————————

    /// 写入库存变更日志（对应 Java `productInventoryLogService.save`）。
    ///
    /// `desc` 是 MySQL 保留字，必须反引号包裹。
    pub async fn insert_inventory_log(&self, log: &ProductInventoryLog) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO product_inventory_log (product_id, spec_id, number, add_time, old_number, type, change_number, `desc`, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&log.product_id)
        .bind(&log.spec_id)
        .bind(&log.number)
        .bind(&log.add_time)
        .bind(&log.old_number)
        .bind(&log.r#type)
        .bind(&log.change_number)
        .bind(&log.desc)
        .bind(&log.shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    // ————————————————————— 商品服务 —————————————————————

    /// 按 ID 集合查询启用的商品服务（对应 Java
    /// `productServiceIds` 的 JSON 数组展开后的装配）。
    pub async fn find_services_by_ids(&self, ids: &[i32]) -> Result<Vec<ProductServices>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!("SELECT * FROM product_services WHERE product_service_id IN ({ph}) ORDER BY sort_order ASC");
        let mut q = sqlx::query_as::<_, ProductServices>(&sql);
        for id in ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    // ————————————————————— 分类 / 品牌 / 分组 —————————————————————

    /// 分类全量（用于在服务层展开子孙分类，等价 Java
    /// `categoryService.getCategoryAllChildIds`）。
    pub async fn find_categories(&self) -> Result<Vec<Category>> {
        sqlx::query_as::<_, Category>("SELECT * FROM category ORDER BY sort_order ASC, category_id ASC")
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 品牌列表（`is_show` 非空时按显示状态过滤）。
    pub async fn find_brands(&self, is_show: Option<i32>) -> Result<Vec<Brand>> {
        sqlx::query_as::<_, Brand>(
            "SELECT * FROM brand WHERE (? IS NULL OR is_show = ?) ORDER BY sort_order ASC, brand_id ASC",
        )
        .bind(is_show)
        .bind(is_show)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 商品分组的 `product_ids` JSON 原文（对应 Java
    /// `productGroupService.detail(id).getProductIds()`）。
    pub async fn find_group_product_ids(&self, group_id: i32) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT product_ids FROM product_group WHERE product_group_id = ? LIMIT 1")
                .bind(group_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.and_then(|r| r.0))
    }

    /// 商品分组主表（供分组名回显，非必需）。
    pub async fn find_group(&self, group_id: i32) -> Result<Option<ProductGroup>> {
        sqlx::query_as::<_, ProductGroup>(
            "SELECT * FROM product_group WHERE product_group_id = ? LIMIT 1",
        )
        .bind(group_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按分组名回写 `product_ids`（对应 Java `audit` 审核通过后把新品/热卖商品
    /// 追加进 `product_group`）。
    pub async fn update_group_product_ids(
        &self,
        group_id: i32,
        product_ids: &str,
    ) -> Result<u64> {
        let r = sqlx::query("UPDATE product_group SET product_ids = ? WHERE product_group_id = ?")
            .bind(product_ids)
            .bind(group_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 按店铺查询「新品 / 热卖」分组（对应 Java `audit` 里的
    /// `in(productGroupName, ["新品", "热卖"])`）。
    pub async fn find_groups_by_names(&self, shop_id: i32) -> Result<Vec<ProductGroup>> {
        sqlx::query_as::<_, ProductGroup>(
            "SELECT * FROM product_group WHERE shop_id = ? AND product_group_name IN ('新品', '热卖')",
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————————— 配置项 —————————————————————

    /// 读取 `config` 表单值（对应 Java `ConfigService#getConfigVal`）。
    pub async fn config_val(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND is_del = 0 LIMIT 1",
        )
        .bind(biz_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|r| r.0).filter(|v| !v.trim().is_empty()))
    }

    // ————————————————— 待审核数量 / 店铺 —————————————————

    /// 非运营店铺 ID（Java `getWaitingCheckedCount` 平台侧排除 `shop.status = 4`）。
    pub async fn find_inactive_shop_ids(&self) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT shop_id FROM shop WHERE status = 4")
                .fetch_all(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 待审核商品数（`check_status = 0 AND is_delete = 0`，可排除店铺）。
    pub async fn count_pending_audit(&self, exclude_shop_ids: &[i32]) -> Result<i64> {
        let sql = format!(
            "SELECT COUNT(*) FROM product WHERE check_status = 0 AND is_delete = 0{}",
            not_in_clause("shop_id", exclude_shop_ids.len())
        );
        let mut q = sqlx::query_as::<_, (i64,)>(&sql);
        for id in exclude_shop_ids {
            q = q.bind(id);
        }
        let row = q.fetch_one(&self.pool).await.map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 店铺名称（`shop.shop_title`，对应 Java 推广数据里的店铺名）。
    pub async fn find_shop_title(&self, shop_id: i32) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT shop_title FROM shop WHERE shop_id = ? LIMIT 1")
                .bind(shop_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.and_then(|r| r.0))
    }

    // ————————————— 商品配置下拉：运费模板 / 服务 / 等级 / 卡券组 —————————————

    /// 运费模板列表：`shop_ids` 非空时按 IN（O2O 取 `[0, shopId]`），
    /// 否则按 `shop_id` 精确匹配（对应 Java `ProductServiceImpl#config`）。
    pub async fn find_shipping_tpls(
        &self,
        shop_id: Option<i32>,
        shop_ids: &[i32],
    ) -> Result<Vec<ShippingTpl>> {
        if !shop_ids.is_empty() {
            let ph = vec!["?"; shop_ids.len()].join(", ");
            let sql = format!(
                "SELECT shipping_tpl_id, shipping_time, shipping_tpl_name, is_free, CAST(pricing_type AS SIGNED) AS pricing_type, is_default, shop_id FROM shipping_tpl WHERE shop_id IN ({ph}) ORDER BY shipping_tpl_id ASC",
            );
            let mut q = sqlx::query_as::<_, ShippingTpl>(&sql);
            for id in shop_ids {
                q = q.bind(id);
            }
            return q.fetch_all(&self.pool).await.map_err(map_err);
        }
        sqlx::query_as::<_, ShippingTpl>(
            "SELECT shipping_tpl_id, shipping_time, shipping_tpl_name, is_free, CAST(pricing_type AS SIGNED) AS pricing_type, is_default, shop_id FROM shipping_tpl WHERE (? IS NULL OR shop_id = ?) ORDER BY shipping_tpl_id ASC",
        )
        .bind(shop_id)
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 全部商品服务（对应 Java `servicesService.list()`）。
    pub async fn find_all_services(&self) -> Result<Vec<ProductServices>> {
        sqlx::query_as::<_, ProductServices>(
            "SELECT * FROM product_services ORDER BY sort_order ASC, product_service_id ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 商品服务分页（对应 `GET /productBatch/productService/list` 的
    /// `servicesService.list(BasePage)`）。
    pub async fn paginate_services(
        &self,
        limit: u64,
        offset: u64,
    ) -> Result<(u64, Vec<ProductServices>)> {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM product_services")
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        let rows = sqlx::query_as::<_, ProductServices>(
            "SELECT * FROM product_services ORDER BY sort_order ASC, product_service_id ASC LIMIT ? OFFSET ?",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    /// 会员等级列表（对应 Java `userRankService.list()`）。
    pub async fn find_all_user_ranks(&self) -> Result<Vec<UserRank>> {
        sqlx::query_as::<_, UserRank>(
            "SELECT * FROM user_rank ORDER BY rank_id ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 启用中的电子卡券分组（对应 Java `ecardGroupService`
    /// `eq(shopId).eq(isUse, YES)`）。
    pub async fn find_ecard_groups(&self, shop_id: Option<i32>) -> Result<Vec<ECardGroup>> {
        sqlx::query_as::<_, ECardGroup>(
            "SELECT * FROM e_card_group WHERE is_use = 1 AND (? IS NULL OR shop_id = ?) ORDER BY group_id ASC",
        )
        .bind(shop_id)
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    // ————————————————— SKU 分页 / 选择列表 —————————————————

    /// 规格分页（对应 `ProductSkuServiceImpl#getProductSkusPage`：
    /// 关键词命中 `sku_sn / sku_tsn / sku_value` 任一即可，库存区间过滤，
    /// 排序列由服务层白名单归一化）。
    pub async fn paginate_skus(
        &self,
        product_id: i32,
        keyword_like: Option<&str>,
        stock_min: Option<i32>,
        stock_max: Option<i32>,
        order_column: &'static str,
        order_asc: bool,
        limit: u64,
        offset: u64,
    ) -> Result<(u64, Vec<ProductSku>)> {
        let where_sql =
            "WHERE product_id = ? AND (? IS NULL OR sku_sn LIKE ? OR sku_tsn LIKE ? OR sku_value LIKE ?) AND (? IS NULL OR sku_stock >= ?) AND (? IS NULL OR sku_stock <= ?)";
        let dir = if order_asc { "ASC" } else { "DESC" };
        let count_sql = format!(
            "SELECT COUNT(*) FROM product_sku {where_sql}",
        );
        let rows_sql = format!(
            "SELECT * FROM product_sku {where_sql} ORDER BY {order_column} {dir}, sku_id ASC LIMIT ? OFFSET ?",
        );

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        count_q = count_q
            .bind(product_id)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(stock_min)
            .bind(stock_min)
            .bind(stock_max)
            .bind(stock_max);
        let total: (i64,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;

        let mut rows_q = sqlx::query_as::<_, ProductSku>(&rows_sql);
        rows_q = rows_q
            .bind(product_id)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(keyword_like)
            .bind(stock_min)
            .bind(stock_min)
            .bind(stock_max)
            .bind(stock_max)
            .bind(limit)
            .bind(offset);
        let rows = rows_q.fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    /// `product` LEFT JOIN `product_sku` 的选择列表分页
    /// （对应 Java `ProductMapper.selectProductList` 的同构 SQL）。
    pub async fn paginate_select_product_skus(
        &self,
        f: &SelectProductFilter,
    ) -> Result<(u64, Vec<SelectProductRow>)> {
        let mut where_sql = String::from(
            "WHERE p.is_delete = 0 AND p.product_status = 1 AND (? IS NULL OR p.shop_id = ?) ",
        );
        if f.keyword_like.is_some() {
            where_sql.push_str("AND (p.product_name LIKE ? OR p.product_sn LIKE ?) ");
        }
        where_sql.push_str(&in_clause("p.category_id", f.category_ids.len()));
        where_sql.push_str(&in_clause("p.product_type", f.product_types.len()));
        where_sql.push_str(&not_in_clause("p.product_type", f.exclude_product_types.len()));
        if f.sale_mode_only_normal {
            where_sql.push_str("AND (p.sale_mode IS NULL OR p.sale_mode = 0) ");
        }
        if !f.include_cycle_product {
            where_sql.push_str("AND (p.delivery_mode = 0 OR p.delivery_mode = 1) ");
        }
        let order_by = f
            .order_column
            .map(|c| if f.order_asc {
                format!("ORDER BY p.{c} ASC, p.product_id DESC")
            } else {
                format!("ORDER BY p.{c} DESC, p.product_id DESC")
            })
            .unwrap_or_else(|| "ORDER BY p.add_time DESC, p.product_id DESC, ps.sku_id ASC".to_string());

        let select_cols = "SELECT p.product_id, p.product_sn, p.product_name, p.product_stock, p.category_id, p.pic_url, p.shop_id, p.product_price, p.product_type, ps.sku_id, ps.sku_data, ps.sku_stock, ps.sku_price";
        let count_sql = format!(
            "SELECT COUNT(*) FROM product p LEFT JOIN product_sku ps ON ps.product_id = p.product_id AND ps.is_enabled = 1 {where_sql}",
        );
        let rows_sql = format!(
            "{select_cols} FROM product p LEFT JOIN product_sku ps ON ps.product_id = p.product_id AND ps.is_enabled = 1 {where_sql} {order_by} LIMIT ? OFFSET ?",
        );

        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        count_q = count_q.bind(f.shop_id).bind(f.shop_id);
        if f.keyword_like.is_some() {
            count_q = count_q.bind(f.keyword_like.as_deref()).bind(f.keyword_like.as_deref());
        }
        for id in &f.category_ids {
            count_q = count_q.bind(id);
        }
        for id in &f.product_types {
            count_q = count_q.bind(id);
        }
        for id in &f.exclude_product_types {
            count_q = count_q.bind(id);
        }
        let total: (i64,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;

        let mut rows_q = sqlx::query_as::<_, SelectProductRow>(&rows_sql);
        rows_q = rows_q.bind(f.shop_id).bind(f.shop_id);
        if f.keyword_like.is_some() {
            rows_q = rows_q.bind(f.keyword_like.as_deref()).bind(f.keyword_like.as_deref());
        }
        for id in &f.category_ids {
            rows_q = rows_q.bind(id);
        }
        for id in &f.product_types {
            rows_q = rows_q.bind(id);
        }
        for id in &f.exclude_product_types {
            rows_q = rows_q.bind(id);
        }
        let rows = rows_q
            .bind(f.limit)
            .bind(f.offset)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    // ————————————————— 快捷更新 / 批量操作 —————————————————

    /// 按白名单列做单字段更新（列名由服务层从 `PRODUCT_FIELDS` 常量映射得到）。
    pub async fn update_product_field(
        &self,
        product_id: i32,
        column: &'static str,
        value: &str,
    ) -> Result<u64> {
        let sql = format!("UPDATE product SET {column} = ? WHERE product_id = ?");
        let r = sqlx::query(&sql)
            .bind(value)
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 批量更新上下架 / 软删除 / 审核状态（`None` 表示该列不动）。
    pub async fn set_product_flags(
        &self,
        ids: &[i32],
        product_status: Option<i32>,
        is_delete: Option<i32>,
        check_status: Option<i32>,
    ) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut sets: Vec<&'static str> = Vec::new();
        let mut binds: Vec<i32> = Vec::new();
        if let Some(v) = product_status {
            sets.push("product_status = ?");
            binds.push(v);
        }
        if let Some(v) = is_delete {
            sets.push("is_delete = ?");
            binds.push(v);
        }
        if let Some(v) = check_status {
            sets.push("check_status = ?");
            binds.push(v);
        }
        if sets.is_empty() {
            return Ok(0);
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!(
            "UPDATE product SET {} WHERE product_id IN ({ph})",
            sets.join(", ")
        );
        let mut q = sqlx::query(&sql);
        for v in &binds {
            q = q.bind(v);
        }
        for id in ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 批量更新审核状态与审核意见（`audit` / `auditAgain`）。
    pub async fn update_product_audit(
        &self,
        product_id: i32,
        check_status: i32,
        check_reason: Option<&str>,
        product_status: Option<i32>,
    ) -> Result<u64> {
        let r = sqlx::query(
            "UPDATE product SET check_status = ?, check_reason = ?, product_status = COALESCE(?, product_status) WHERE product_id = ?",
        )
        .bind(check_status)
        .bind(check_reason.unwrap_or_default())
        .bind(product_status)
        .bind(product_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 物理删除商品（对应 Java `removeByIds`，仅在回收站内允许）。
    pub async fn hard_delete_products(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!("DELETE FROM product WHERE product_id IN ({ph})");
        let mut q = sqlx::query(&sql);
        for id in ids {
            q = q.bind(id);
        }
        let r = q.execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 按 ID 集合查询商品（批量操作 / 复制前置校验）。
    pub async fn find_products_by_ids(&self, ids: &[i32]) -> Result<Vec<Product>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!("SELECT * FROM product WHERE product_id IN ({ph})");
        let mut q = sqlx::query_as::<_, Product>(&sql);
        for id in ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 最大 `product_id`（`createNewProductSn` 用，对应 Java
    /// `orderByDesc(productId).last(LIMIT 1)`）。
    pub async fn max_product_id(&self) -> Result<i32> {
        let row: (Option<i32>,) = sqlx::query_as("SELECT MAX(product_id) FROM product")
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0.unwrap_or(0))
    }

    /// 货号是否已被占用（批量复制 / 快捷改货号用）。
    pub async fn set_product_share_info(&self, product_id: i32, share_info: &str) -> Result<u64> {
        let r = sqlx::query("UPDATE product SET share_info = ? WHERE product_id = ?")
            .bind(share_info)
            .bind(product_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 规格快捷更新（`updateField` 的 `productSku` 分支）：
    /// 仅更新传入的列（`None` 表示该列不动）。
    pub async fn update_sku_price_stock(
        &self,
        sku_id: i32,
        sku_stock: Option<i32>,
        sku_price: Option<Decimal>,
    ) -> Result<u64> {
        let mut sets: Vec<&'static str> = Vec::new();
        if sku_stock.is_some() {
            sets.push("sku_stock = ?");
        }
        if sku_price.is_some() {
            sets.push("sku_price = ?");
        }
        if sets.is_empty() {
            return Ok(0);
        }
        let sql = format!(
            "UPDATE product_sku SET {} WHERE sku_id = ?",
            sets.join(", ")
        );
        let mut q = sqlx::query(&sql);
        if let Some(v) = sku_stock {
            q = q.bind(v);
        }
        if let Some(v) = sku_price {
            q = q.bind(v);
        }
        let r = q.bind(sku_id).execute(&self.pool).await.map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 规格库存合计与最低启用价（`updateField` 的 `productSku` 分支汇总回写）。
    pub async fn sku_summary(&self, product_id: i32) -> Result<(i32, Option<Decimal>)> {
        let row: (Option<i64>, Option<Decimal>,) = sqlx::query_as(
            "SELECT SUM(sku_stock), MIN(sku_price) FROM product_sku WHERE product_id = ? AND is_enabled = 1",
        )
        .bind(product_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((row.0.unwrap_or(0) as i32, row.1))
    }

    // ————————————————— 前台：收藏 / 优惠券 / 评论 / 反馈 —————————————————

    /// 会员是否收藏了该商品（对应 Java `isCollect`）。
    pub async fn count_collect(&self, user_id: i32, product_id: i32, shop_id: Option<i32>) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM collect_product WHERE user_id = ? AND product_id = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(user_id)
        .bind(product_id)
        .bind(shop_id)
        .bind(shop_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 店铺在售优惠券（对应 Java `getProductCouponList` 的查询主体，
    /// 商品维度 `send_range` 过滤在服务层完成）。
    pub async fn find_shop_coupons(&self, shop_id: i32, now: i32) -> Result<Vec<Coupon>> {
        sqlx::query_as::<_, Coupon>(
            "SELECT * FROM coupon WHERE shop_id = ? AND is_delete = 0 AND is_show = 1 AND ((use_start_date <= ? AND use_end_date >= ?) OR send_type = 0) ORDER BY coupon_id ASC",
        )
        .bind(shop_id)
        .bind(now)
        .bind(now)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 优惠券领取总数（`receiveNum`）。
    pub async fn count_coupon_receive(&self, coupon_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user_coupon WHERE coupon_id = ?")
            .bind(coupon_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 当前用户各券领取数与未使用数（`(coupon_id, 总数, 未使用数)`）。
    pub async fn find_user_coupon_counts(&self, user_id: i32) -> Result<Vec<(i32, i64, i64)>> {
        let rows: Vec<(i32, i64, i64)> = sqlx::query_as(
            "SELECT coupon_id, COUNT(*) AS total, SUM(CASE WHEN used_time = 0 THEN 1 ELSE 0 END) AS unused FROM user_coupon WHERE user_id = ? GROUP BY coupon_id",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows)
    }

    /// 用户已支付订单数（新人专享判定，Java：`pay_status > 0`）。
    pub async fn count_paid_orders(&self, user_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM `order` WHERE user_id = ? AND pay_status > 0")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 用户会员等级 ID。
    pub async fn find_user_rank_id(&self, user_id: i32) -> Result<Option<i32>> {
        let row: Option<(i32,)> = sqlx::query_as("SELECT rank_id FROM user WHERE user_id = ? LIMIT 1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.map(|r| r.0))
    }

    /// 商品关联商品 ID（`product_related` 表，评论统计用）。
    pub async fn find_related_ids(&self, product_id: i32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT related_product_id FROM product_related WHERE product_id = ?",
        )
        .bind(product_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 按商品 ID 集合取评论（对应 `getProductCommentDetail`）。
    pub async fn find_comments_by_product_ids(
        &self,
        product_ids: &[i32],
        shop_id: Option<i32>,
    ) -> Result<Vec<Comment>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; product_ids.len()].join(", ");
        let sql = format!(
            "SELECT * FROM comment WHERE product_id IN ({ph}) AND (? IS NULL OR shop_id = ?)",
        );
        let mut q = sqlx::query_as::<_, Comment>(&sql);
        for id in product_ids {
            q = q.bind(id);
        }
        q.bind(shop_id)
            .bind(shop_id)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 前台评论分页（对应 `CommentServiceImpl#listForClient`：
    /// 只取主评论，`isTop DESC, addTime DESC` 排序）。
    pub async fn paginate_client_comments(
        &self,
        product_ids: &[i32],
        shop_id: Option<i32>,
        comment_type: Option<i32>,
        is_showed: Option<i32>,
        limit: u64,
        offset: u64,
    ) -> Result<(u64, Vec<Comment>, Vec<Comment>)> {
        let ph = vec!["?"; product_ids.len()].join(", ");
        let rank_cond = match comment_type {
            Some(2) => " AND comment_rank >= 4",
            Some(3) => " AND comment_rank = 3",
            Some(4) => " AND comment_rank <= 2",
            _ => "",
        };
        let where_sql = format!(
            "WHERE product_id IN ({ph}) AND parent_id = 0 AND (? IS NULL OR shop_id = ?){rank_cond} AND (? IS NULL OR is_showed = ?)",
        );
        let count_sql = format!(
            "SELECT COUNT(*) FROM comment {where_sql}",
        );
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for id in product_ids {
            count_q = count_q.bind(id);
        }
        count_q = count_q.bind(shop_id).bind(shop_id).bind(is_showed).bind(is_showed);
        let total: (i64,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;

        let rows_sql = format!(
            "SELECT * FROM comment {where_sql} ORDER BY is_top DESC, add_time DESC LIMIT ? OFFSET ?",
        );
        let mut rows_q = sqlx::query_as::<_, Comment>(&rows_sql);
        for id in product_ids {
            rows_q = rows_q.bind(id);
        }
        rows_q = rows_q
            .bind(shop_id)
            .bind(shop_id)
            .bind(is_showed)
            .bind(is_showed)
            .bind(limit)
            .bind(offset);
        let rows = rows_q.fetch_all(&self.pool).await.map_err(map_err)?;

        let ids: Vec<i32> = rows.iter().map(|c| c.comment_id).collect();
        let replies = self.find_comment_replies(&ids).await?;
        Ok((total.0.max(0) as u64, rows, replies))
    }

    /// 商家回复（`parent_id IN (主评论 ID)`）。
    pub async fn find_comment_replies(&self, parent_ids: &[i32]) -> Result<Vec<Comment>> {
        if parent_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; parent_ids.len()].join(", ");
        let sql = format!(
            "SELECT * FROM comment WHERE parent_id IN ({ph}) ORDER BY add_time ASC",
        );
        let mut q = sqlx::query_as::<_, Comment>(&sql);
        for id in parent_ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 商品咨询（反馈）分页：`type = 2`（商品）且只取主贴。
    pub async fn paginate_feedback(
        &self,
        product_id: i32,
        shop_id: Option<i32>,
        limit: u64,
        offset: u64,
        order_column: &'static str,
        order_asc: bool,
    ) -> Result<(u64, Vec<Feedback>)> {
        let dir = if order_asc { "ASC" } else { "DESC" };
        let where_sql =
            "WHERE product_id = ? AND type = 2 AND parent_id = 0 AND (? IS NULL OR shop_id = ?)";
        let count_sql = format!(
            "SELECT COUNT(*) FROM feedback {where_sql}",
        );
        let total: (i64,) = sqlx::query_as::<_, (i64,)>(&count_sql)
            .bind(product_id)
            .bind(shop_id)
            .bind(shop_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        let rows_sql = format!(
            "SELECT * FROM feedback {where_sql} ORDER BY {order_column} {dir}, id DESC LIMIT ? OFFSET ?",
        );
        let rows = sqlx::query_as::<_, Feedback>(&rows_sql)
            .bind(product_id)
            .bind(shop_id)
            .bind(shop_id)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    /// 反馈回复（`parent_id = 主贴 ID`）。
    pub async fn find_feedback_replies(&self, parent_ids: &[i32]) -> Result<Vec<Feedback>> {
        if parent_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; parent_ids.len()].join(", ");
        let sql = format!(
            "SELECT * FROM feedback WHERE parent_id IN ({ph}) ORDER BY add_time ASC",
        );
        let mut q = sqlx::query_as::<_, Feedback>(&sql);
        for id in parent_ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 会员昵称（反馈列表 `nickname`）。
    pub async fn find_user_nicks(&self, user_ids: &[i32]) -> Result<Vec<(i32, Option<String>)>> {
        if user_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; user_ids.len()].join(", ");
        let sql = format!(
            "SELECT user_id, nickname FROM user WHERE user_id IN ({ph})",
        );
        let mut q = sqlx::query_as::<_, (i32, Option<String>)>(&sql);
        for id in user_ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    // ————————————————— 询价 / 预售 / 历史购买 —————————————————

    /// 新增询价记录（对应 Java `priceInquiry`，返回自增 ID）。
    pub async fn insert_price_inquiry(&self, p: &PriceInquiry) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO price_inquiry (mobile, email, content, product_id, remark, status, shop_id, user_id, user_is_del, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&p.mobile)
        .bind(&p.email)
        .bind(&p.content)
        .bind(p.product_id)
        .bind(&p.remark)
        .bind(p.status)
        .bind(p.shop_id)
        .bind(p.user_id)
        .bind(p.user_is_del)
        .bind(p.create_time)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 商品预售配置（对应 `ProductPresaleService#getByProductId`）。
    pub async fn find_presale(&self, product_id: i32) -> Result<Option<ProductPresale>> {
        sqlx::query_as::<_, ProductPresale>(
            "SELECT * FROM product_presale WHERE product_id = ? LIMIT 1",
        )
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 历史购买商品 ID（对应 `OrderMapper.getHistoryProduct`：
    /// `order_status = 5` 已完成订单的明细，按下单时间倒序去重）。
    pub async fn find_history_product_ids(&self, user_id: i32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> = sqlx::query_as(
            "SELECT DISTINCT oi.product_id FROM order_item oi LEFT JOIN `order` o ON oi.order_id = o.order_id WHERE o.order_status = 5 AND o.user_id = ? ORDER BY MAX(o.add_time) DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 按 ID 集合分页商品（保持入参顺序，供历史购买 / 相关商品）。
    pub async fn paginate_products_by_ids(
        &self,
        ids: &[i32],
        limit: u64,
        offset: u64,
    ) -> Result<(u64, Vec<Product>)> {
        if ids.is_empty() {
            return Ok((0, Vec::new()));
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let count_sql = format!(
            "SELECT COUNT(*) FROM product WHERE product_id IN ({ph}) AND is_delete = 0",
        );
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
        for id in ids {
            count_q = count_q.bind(id);
        }
        let total: (i64,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;

        let rows_sql = format!(
            "SELECT * FROM product WHERE product_id IN ({ph}) AND is_delete = 0 ORDER BY FIELD(product_id, {ph}) LIMIT ? OFFSET ?",
        );
        let mut rows_q = sqlx::query_as::<_, Product>(&rows_sql);
        for id in ids {
            rows_q = rows_q.bind(id);
        }
        for id in ids {
            rows_q = rows_q.bind(id);
        }
        let rows = rows_q
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    // ————————————————— 搜索 / 关键词（ES 降级） —————————————————

    /// 关键词命中商品（对应 `searchGuess`：`product_name LIKE 任一分词`）。
    pub async fn find_products_for_guess(
        &self,
        keyword_likes: &[String],
        limit: Option<u32>,
        exclude_types: &[i32],
    ) -> Result<Vec<(i32, String, Option<String>)>> {
        if keyword_likes.is_empty() {
            return Ok(Vec::new());
        }
        let mut conds: Vec<String> = Vec::with_capacity(keyword_likes.len());
        for _ in keyword_likes {
            conds.push("product_name LIKE ?".to_string());
        }
        let mut sql = String::from("SELECT product_id, product_name, keywords FROM product WHERE is_delete = 0");
        sql.push_str(&not_in_clause("product_type", exclude_types.len()));
        sql.push_str(&format!(" AND ({})", conds.join(" OR ")));
        if let Some(n) = limit {
            sql.push_str(&format!(" LIMIT {n}"));
        }
        let mut q = sqlx::query_as::<_, (i32, String, Option<String>)>(&sql);
        for id in exclude_types {
            q = q.bind(id);
        }
        for like in keyword_likes {
            q = q.bind(like);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 商品属性聚合（`attr_type = 0`，`(attr_name, attr_value, 出现次数)`）。
    pub async fn find_attribute_counts(
        &self,
        product_ids: &[i32],
    ) -> Result<Vec<(String, String, i64)>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; product_ids.len()].join(", ");
        let sql = format!(
            "SELECT attr_name, attr_value, COUNT(*) AS total FROM product_attributes WHERE attr_type = 0 AND product_id IN ({ph}) GROUP BY attr_name, attr_value ORDER BY total DESC",
        );
        let mut q = sqlx::query_as::<_, (String, String, i64)>(&sql);
        for id in product_ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 过滤条件下的商品 ID 集合（C 端搜索聚合用，上限 `max_rows`）。
    pub async fn find_filtered_product_ids(
        &self,
        f: &ProductListFilter,
        max_rows: i64,
    ) -> Result<Vec<i32>> {
        let mut where_sql = String::from("WHERE 1 = 1 ");
        where_sql.push_str(&keyword_group_sql(
            f.keyword_like.is_some(),
            f.id_list.len(),
        ));
        where_sql.push_str(" AND is_delete = ? AND (? IS NULL OR shop_id = ?) AND (? IS NULL OR product_status = ?) AND (? IS NULL OR check_status = ?) AND (? IS NULL OR product_price >= ?) AND (? IS NULL OR product_price <= ?) AND (? IS NULL OR is_new = ?)");
        where_sql.push_str(&in_clause("category_id", f.category_ids.len()));
        where_sql.push_str(&in_clause("brand_id", f.brand_ids.len()));
        let sql = format!(
            "SELECT product_id FROM product {where_sql} ORDER BY product_id DESC LIMIT ?",
        );
        let mut q = sqlx::query_as::<_, (i32,)>(&sql);
        if f.keyword_like.is_some() {
            q = q
                .bind(&f.keyword_like)
                .bind(&f.keyword_like)
                .bind(&f.keyword_like)
                .bind(&f.keyword_like);
        }
        for id in &f.id_list {
            q = q.bind(id);
        }
        q = q
            .bind(f.is_delete)
            .bind(f.shop_id)
            .bind(f.shop_id)
            .bind(f.product_status)
            .bind(f.product_status)
            .bind(f.check_status)
            .bind(f.check_status)
            .bind(f.min_price)
            .bind(f.min_price)
            .bind(f.max_price)
            .bind(f.max_price)
            .bind(f.is_new)
            .bind(f.is_new);
        for id in &f.category_ids {
            q = q.bind(id);
        }
        for id in &f.brand_ids {
            q = q.bind(id);
        }
        q = q.bind(max_rows);
        let rows = q.fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 价格区间上界（`getFilter` 的 `maxPrice`）。
    pub async fn find_max_price_by_ids(&self, ids: &[i32]) -> Result<Option<Decimal>> {
        if ids.is_empty() {
            return Ok(None);
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!(
            "SELECT MAX(product_price) FROM product WHERE product_id IN ({ph})",
        );
        let mut q = sqlx::query_as::<_, (Option<Decimal>,)>(&sql);
        for id in ids {
            q = q.bind(id);
        }
        let row = q.fetch_one(&self.pool).await.map_err(map_err)?;
        Ok(row.0)
    }

    /// 商品关键词写入搜索词表（ES 初始化降级：把 `product.keywords`
    /// 汇总为「搜索词 + 出现次数」，对应 Java 侧的 ES 全量同步）。
    pub async fn upsert_keyword(&self, date: &str, engine: &str, keyword: &str) -> Result<u64> {
        let r = sqlx::query(
            "INSERT INTO keywords (date, searchengine, keyword, count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1",
        )
        .bind(date)
        .bind(engine)
        .bind(keyword)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 可售商品（ES 初始化降级遍历用：ID + 关键词）。
    pub async fn find_sellable_products(&self, limit: i64) -> Result<Vec<(i32, Option<String>)>> {
        let rows: Vec<(i32, Option<String>)> = sqlx::query_as(
            "SELECT product_id, keywords FROM product WHERE is_delete = 0 AND product_status = 1 ORDER BY product_id ASC LIMIT ?",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows)
    }

    /// 短链是否已存在（对应 Java `getWebShortLink` 的 `short_code` 计数）。
    pub async fn count_short_code(&self, short_code: &str) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM short_url WHERE short_code = ?")
            .bind(short_code)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 写入短链（`add_time` 为 `varchar`，与 Java 一致写 `yyyy-MM-dd HH:mm:ss`）。
    pub async fn insert_short_url(
        &self,
        short_code: &str,
        long_url: &str,
        add_time: &str,
    ) -> Result<u64> {
        let r = sqlx::query(
            "INSERT INTO short_url (short_code, long_url, type, add_time) VALUES (?, ?, 0, ?)",
        )
        .bind(short_code)
        .bind(long_url)
        .bind(add_time)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected())
    }

    /// 按 SKU ID 查询规格（不存在返回 `None`）。
    pub async fn find_sku(&self, sku_id: i32) -> Result<Option<ProductSku>> {
        sqlx::query_as::<_, ProductSku>(
            "SELECT * FROM product_sku WHERE sku_id = ? LIMIT 1",
        )
        .bind(sku_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }
}

/// 商品列表过滤条件的绑定顺序（**必须**与 `paginate_products` 的
/// `where_sql` 中占位符出现顺序一致：关键词组 → 通用条件 → 各 IN 集合）。
fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("商品不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn keyword_group_without_ids() {
        // 仅 keyword：4 个 LIKE 占位符，独立分组
        assert_eq!(
            keyword_group_sql(true, 0),
            " AND (product_name LIKE ? OR keywords LIKE ? OR product_sn LIKE ? OR product_tsn LIKE ?)"
        );
        // 两者皆无：不生成任何片段
        assert_eq!(keyword_group_sql(false, 0), "");
    }

    #[test]
    fn keyword_group_with_ids_ors_product_id() {
        // 两者都有：同一 nested 块内 OR（Java buildQueryWrapper 语义）
        assert_eq!(
            keyword_group_sql(true, 3),
            " AND ((product_name LIKE ? OR keywords LIKE ? OR product_sn LIKE ? OR product_tsn LIKE ?) OR product_id IN (?, ?, ?))"
        );
    }

    #[test]
    fn keyword_group_ids_only_is_standalone_in() {
        // 仅 ids：独立 AND IN —— 装修选品（keyword 为空）必须走这条，
        // 不能被 keyword 分组短路
        assert_eq!(
            keyword_group_sql(false, 2),
            " AND product_id IN (?, ?)"
        );
    }

    #[test]
    fn in_clause_is_empty_for_empty_list() {
        assert!(in_clause("category_id", 0).is_empty());
        assert_eq!(in_clause("category_id", 2), " AND category_id IN (?, ?)");
        assert!(not_in_clause("product_id", 0).is_empty());
        assert_eq!(not_in_clause("product_id", 1), " AND product_id NOT IN (?)");
    }

    #[test]
    fn list_filter_defaults_are_inert() {
        let f = ProductListFilter::default();
        assert_eq!(f.is_delete, 0);
        assert!(f.category_ids.is_empty());
        assert!(f.field_order_ids.is_empty());
        assert_eq!(f.order_column, "");
    }

    #[test]
    fn filter_carries_decimals_not_floats() {
        // 金额必须走 Decimal
        let f = ProductListFilter {
            min_price: Some(Decimal::from_str("10.50").unwrap()),
            ..Default::default()
        };
        assert_eq!(f.min_price.unwrap().to_string(), "10.50");
    }

    /// 动态 `IN` 片段的静态镜像：仅供 `tools/check_sql_columns.py`
    /// 提取并校验列名，不在任何路径下调用。
    #[allow(dead_code)]
    fn dynamic_in_segment_mirror() {
        let _ = sqlx::query::<sqlx::MySql>(
            "SELECT product_id, category_id, product_type, brand_id FROM product WHERE category_id IN (?) OR product_type IN (?) OR product_type NOT IN (?) OR brand_id IN (?) OR product_id IN (?) OR product_id NOT IN (?)",
        );
    }
}