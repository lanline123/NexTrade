//! 商品搜索仓储（`catalog/search_admin` / 前台筛选与属性建议）。
//!
//! 对应原 Java `ProductSearchServiceImpl` 的 MySQL 分支：
//! - `productService.list(ProductListDTO)` 商品分页（分类含子孙、品牌多选、
//!   价格区间、活动类型、关键词、排序）；
//! - `productService.getMaxPrice(...)`（筛选项最高价）；
//! - `productService.getProductBrandList(...)`（筛选项品牌）；
//! - `categoryService.getCategoryByParentId(...)`（分类筛选）；
//! - `productAttributesMapper.selectList(...)`（属性搜索建议，`attr_type = 0`）。
//!
//! 全部 SQL 为运行时 `sqlx::query_as` / `QueryBuilder`（禁止 `query!` 宏）。
//! Java 的 ES 分支（`ProductEsSearchServiceImpl`）在本工作区无 Elasticsearch
//! 依赖，恒走 MySQL 分支（等价于 Java ES 失败后的回退路径）。

use rust_decimal::Decimal;
use sqlx::mysql::MySqlPool;
use sqlx::{MySql, QueryBuilder};

use tigshop_core::entities::{Brand, Category, Product};
use tigshop_core::models::catalog::search_admin::SearchAttrObj;
use tigshop_core::types::PageQuery;
use tigshop_core::{Error, Result};

/// 商品搜索过滤条件（由 `ProductSearchClientQuery` 归一化而来）。
#[derive(Debug, Clone, Default)]
pub struct ProductSearchFilter {
    /// `%keyword%`（商品名 / 关键词 / 货号）
    pub keyword_like: Option<String>,
    /// 分类 ID（已展开「本分类 + 全部子孙分类」）
    pub category_ids: Vec<i32>,
    pub brand_ids: Vec<i32>,
    /// `min` / `max`（仅 > 0 生效）
    pub min_price: Option<Decimal>,
    pub max_price: Option<Decimal>,
    pub shop_id: Option<i32>,
    pub shop_category_id: Option<i32>,
    /// 活动类型：`new` / `hot` / `best`
    pub intro: Option<String>,
    /// 商品状态（Java 前台缺省 1）
    pub product_status: Option<i32>,
    /// 排序字段（白名单：`virtual_sales` / `product_price` / `product_id` / `sort_order`）
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    /// 属性筛选（PC 搜索页 `attrs: [{attrName, attrValue[]}]`；
    /// 对应 Java ES 分支的 nested 属性查询，MySQL 回退用 `product_attributes` EXISTS）。
    pub attrs: Vec<SearchAttrObj>,
}

/// 属性计数行：`(attr_name, attr_value, count)`。
pub type AttributeCountRow = (String, String, i64);

#[derive(Clone)]
pub struct SearchAdminRepository {
    pool: MySqlPool,
}

impl SearchAdminRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 商品搜索分页（Java `ProductSearchServiceImpl#list` 的 MySQL 分支）。
    pub async fn paginate(
        &self,
        f: &ProductSearchFilter,
        page: &PageQuery,
    ) -> Result<(u64, Vec<Product>)> {
        let mut cq = QueryBuilder::<MySql>::new("SELECT COUNT(*) FROM product");
        push_filters(&mut cq, f);
        let total: (i64,) = cq
            .build_query_as::<(i64,)>()
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        let (limit, offset) = page.limit_offset();
        let mut qb = QueryBuilder::<MySql>::new("SELECT * FROM product");
        push_filters(&mut qb, f);
        push_order(&mut qb, f);
        qb.push(" LIMIT ")
            .push_bind(limit as i64)
            .push(" OFFSET ")
            .push_bind(offset as i64);
        let rows = qb
            .build_query_as::<Product>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((total.0.max(0) as u64, rows))
    }

    /// 筛选范围最高价（Java `productService.getMaxPrice`）。
    pub async fn max_price(&self, f: &ProductSearchFilter) -> Result<Option<Decimal>> {
        let mut qb = QueryBuilder::<MySql>::new("SELECT MAX(product_price) FROM product");
        push_filters(&mut qb, f);
        let row: Option<(Option<Decimal>,)> = qb
            .build_query_as::<(Option<Decimal>,)>()
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.and_then(|r| r.0))
    }

    /// 筛选范围出现的品牌 ID（Java `getProductBrandList` 的简化版：去重 ID）。
    pub async fn distinct_brand_ids(&self, f: &ProductSearchFilter) -> Result<Vec<i32>> {
        let mut qb = QueryBuilder::<MySql>::new(
            "SELECT brand_id FROM product",
        );
        push_filters(&mut qb, f);
        qb.push(" GROUP BY brand_id ORDER BY brand_id ASC");
        let rows: Vec<(i32,)> = qb
            .build_query_as::<(i32,)>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 命中商品的去重分类 ID（Java `getProductCategoryList` 的 DISTINCT 段）。
    pub async fn distinct_category_ids(&self, f: &ProductSearchFilter) -> Result<Vec<i32>> {
        let mut qb = QueryBuilder::<MySql>::new("SELECT category_id FROM product");
        push_filters(&mut qb, f);
        qb.push(" GROUP BY category_id ORDER BY category_id ASC");
        let rows: Vec<(i32,)> = qb
            .build_query_as::<(i32,)>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 按 ID 批量取分类（Java `categoryService.listByIds`，不附加过滤）。
    pub async fn find_categories_by_ids(&self, ids: &[i32]) -> Result<Vec<Category>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!("SELECT * FROM category WHERE category_id IN ({ph})");
        let mut q = sqlx::query_as::<_, Category>(&sql);
        for id in ids {
            q = q.bind(id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 按 ID 批量取品牌（筛选项展示品牌名）。
    pub async fn find_brands(&self, brand_ids: &[i32]) -> Result<Vec<Brand>> {
        if brand_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; brand_ids.len()].join(", ");
        let sql = format!(
            "SELECT * FROM brand WHERE brand_id IN ({placeholders}) ORDER BY brand_id ASC"
        );
        let mut q = sqlx::query_as::<_, Brand>(&sql);
        for id in brand_ids {
            q = q.bind(*id);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }

    /// 全部分类（用于展开子孙分类 & 分类筛选）。
    pub async fn find_all_categories(&self) -> Result<Vec<Category>> {
        sqlx::query_as::<_, Category>(
            "SELECT * FROM category WHERE is_show = 1 ORDER BY sort_order ASC, category_id ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按父分类取下一级分类（Java `categoryService.getCategoryByParentId`）。
    pub async fn find_categories_by_parent(
        &self,
        parent_id: i32,
        limit: i64,
    ) -> Result<Vec<Category>> {
        sqlx::query_as::<_, Category>(
            "SELECT * FROM category WHERE parent_id = ? AND is_show = 1 \
             ORDER BY sort_order ASC, category_id ASC LIMIT ?",
        )
        .bind(parent_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按 ID 取分类（已选项名称）。
    pub async fn find_category(&self, category_id: i32) -> Result<Option<Category>> {
        sqlx::query_as::<_, Category>("SELECT * FROM category WHERE category_id = ? LIMIT 1")
            .bind(category_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 满足过滤条件的商品 ID（属性搜索建议用，Java 只 select product_id）。
    pub async fn matching_product_ids(&self, f: &ProductSearchFilter) -> Result<Vec<i32>> {
        let mut qb = QueryBuilder::<MySql>::new("SELECT product_id FROM product");
        push_filters(&mut qb, f);
        qb.push(" ORDER BY product_id ASC");
        let rows: Vec<(i32,)> = qb
            .build_query_as::<(i32,)>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(rows.into_iter().map(|r| r.0).collect())
    }

    /// 属性值计数（Java `getAttributeSuggestionsFromMysql`：
    /// `attr_type = 0`，按 `attr_name, attr_value` 分组降序）。
    pub async fn attribute_counts(&self, product_ids: &[i32]) -> Result<Vec<AttributeCountRow>> {
        if product_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb = QueryBuilder::<MySql>::new(
            "SELECT attr_name, attr_value, COUNT(*) FROM product_attributes \
             WHERE attr_type = 0 AND product_id IN (",
        );
        for (i, id) in product_ids.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push_bind(*id);
        }
        qb.push(") GROUP BY attr_name, attr_value ORDER BY COUNT(*) DESC");
        qb.build_query_as::<AttributeCountRow>()
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }
}

/// 属性值归一化：支持逗号分隔（`","` / `"，"`），去空白、去空串，
/// 返回 `LIKE` 绑定参数 `%value%`（对应 Java ES 属性查询的 wildcard）。
#[must_use]
fn normalize_attr_values(values: &Option<Vec<String>>) -> Vec<String> {
    let mut out = Vec::new();
    for raw in values.iter().flatten() {
        for v in raw.split([',', '，']) {
            let v = v.trim();
            if !v.is_empty() {
                out.push(format!("%{v}%"));
            }
        }
    }
    out
}

/// 追加公共 WHERE（顺序与 Java `buildProductListDTO` / 属性建议查询一致）。
fn push_filters(qb: &mut QueryBuilder<'_, MySql>, f: &ProductSearchFilter) {
    qb.push(" WHERE is_delete = 0");
    qb.push(super::product_sale::ProductSaleRepository::sale_condition());
    if let Some(status) = f.product_status {
        qb.push(" AND product_status = ").push_bind(status);
    }
    if let Some(kw) = &f.keyword_like {
        qb.push(" AND (product_name LIKE ")
            .push_bind(kw.clone())
            .push(" OR keywords LIKE ")
            .push_bind(kw.clone())
            .push(" OR product_sn LIKE ")
            .push_bind(kw.clone())
            .push(")");
    }
    if !f.category_ids.is_empty() {
        qb.push(" AND category_id IN (");
        for (i, id) in f.category_ids.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push_bind(*id);
        }
        qb.push(")");
    }
    if !f.brand_ids.is_empty() {
        qb.push(" AND brand_id IN (");
        for (i, id) in f.brand_ids.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push_bind(*id);
        }
        qb.push(")");
    }
    if let Some(min) = f.min_price.filter(|v| *v > Decimal::ZERO) {
        qb.push(" AND product_price >= ").push_bind(min);
    }
    if let Some(max) = f.max_price.filter(|v| *v > Decimal::ZERO) {
        qb.push(" AND product_price <= ").push_bind(max);
    }
    if let Some(shop_id) = f.shop_id.filter(|v| *v > 0) {
        qb.push(" AND shop_id = ").push_bind(shop_id);
    }
    if let Some(shop_category_id) = f.shop_category_id.filter(|v| *v > 0) {
        qb.push(" AND shop_category_id = ")
            .push_bind(shop_category_id);
    }
    match f.intro.as_deref() {
        Some("new") => {
            qb.push(" AND is_new = 1");
        }
        Some("hot") => {
            qb.push(" AND is_hot = 1");
        }
        Some("best") => {
            qb.push(" AND is_best = 1");
        }
        _ => {}
    }
    // 属性筛选：对齐 Java ES 分支（原型 attributes nested 查询）。
    // - 每个 attrName 一条 EXISTS（多属性之间 AND）；
    // - 同一属性多值之间 OR；
    // - 值支持逗号分隔（Java 对 `,` / `，` 拆分后 trim）；
    // - 只匹配普通属性 `attr_type = 0`，名称/值均为 `LIKE %...%`（ES wildcard 等价）。
    for attr in &f.attrs {
        let Some(name) = attr
            .attr_name
            .as_deref()
            .map(str::trim)
            .filter(|n| !n.is_empty())
        else {
            continue;
        };
        let values = normalize_attr_values(&attr.attr_value);
        if values.is_empty() {
            continue;
        }
        qb.push(" AND EXISTS (SELECT 1 FROM product_attributes pa WHERE pa.product_id = product.product_id AND pa.attr_type = 0 AND pa.attr_name LIKE ")
            .push_bind(format!("%{name}%"))
            .push(" AND (");
        for (i, v) in values.iter().enumerate() {
            if i > 0 {
                qb.push(" OR ");
            }
            qb.push("pa.attr_value LIKE ").push_bind(v.clone());
        }
        qb.push("))");
    }
}

/// 追加排序（白名单，未知字段回退 `product_id DESC`）。
fn push_order(qb: &mut QueryBuilder<'_, MySql>, f: &ProductSearchFilter) {
    let column = match f.sort_field.as_deref() {
        Some("virtual_sales") => "virtual_sales",
        Some("product_price") => "product_price",
        Some("sort_order") => "sort_order",
        Some("product_id") => "product_id",
        _ => "product_id",
    };
    let dir = if f.sort_field.as_deref() == Some("product_id") {
        "DESC"
    } else if f.sort_order.as_deref().is_some_and(|o| o.eq_ignore_ascii_case("asc")) {
        "ASC"
    } else {
        "DESC"
    };
    qb.push(" ORDER BY ").push(column).push(" ").push(dir);
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("商品不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_sql(f: &ProductSearchFilter) -> String {
        let mut qb = QueryBuilder::<MySql>::new("SELECT COUNT(*) FROM product");
        push_filters(&mut qb, f);
        let sql = qb.sql().to_string();
        qb.build();
        sql
    }

    #[test]
    fn filters_bind_values_instead_of_inlining() {
        let f = ProductSearchFilter {
            keyword_like: Some("%手机%".into()),
            category_ids: vec![1, 2],
            brand_ids: vec![3],
            min_price: Some(Decimal::new(100, 2)),
            max_price: Some(Decimal::new(9000, 2)),
            shop_id: Some(7),
            intro: Some("new".into()),
            product_status: Some(1),
            ..Default::default()
        };
        let sql = build_sql(&f);
        assert!(sql.contains("is_delete = 0"));
        assert!(sql.contains("product_status = ?"));
        assert!(sql.contains("category_id IN (?, ?)"));
        assert!(sql.contains("brand_id IN (?)"));
        assert!(sql.contains("is_new = 1"));
        assert!(!sql.contains("%手机%"), "关键词必须走绑定参数");
        // product_status(1) + keyword(3) + category(2) + brand(1) + min(1) + max(1) + shop(1)
        assert_eq!(sql.matches('?').count(), 10);
    }

    #[test]
    fn default_filter_only_excludes_deleted() {
        let sql = build_sql(&ProductSearchFilter::default());
        assert_eq!(sql.matches('?').count(), 0);
        assert!(sql.contains("WHERE is_delete = 0"));
    }

    #[test]
    fn zero_price_bounds_are_ignored() {
        let f = ProductSearchFilter {
            min_price: Some(Decimal::ZERO),
            max_price: Some(Decimal::ZERO),
            ..Default::default()
        };
        let sql = build_sql(&f);
        assert!(!sql.contains("product_price"));
    }

    #[test]
    fn order_whitelist() {
        let mut qb = QueryBuilder::<MySql>::new("SELECT * FROM product");
        push_order(
            &mut qb,
            &ProductSearchFilter {
                sort_field: Some("virtual_sales".into()),
                sort_order: Some("asc".into()),
                ..Default::default()
            },
        );
        let sql = qb.sql().to_string();
        qb.build();
        assert!(sql.contains("ORDER BY virtual_sales ASC"));
        // 未知字段回退主键
        let mut qb = QueryBuilder::<MySql>::new("SELECT * FROM product");
        push_order(
            &mut qb,
            &ProductSearchFilter {
                sort_field: Some("1;DROP TABLE".into()),
                ..Default::default()
            },
        );
        let sql = qb.sql().to_string();
        qb.build();
        assert!(sql.contains("ORDER BY product_id DESC"));
    }
}

#[cfg(test)]
mod attr_filter_tests {
    use super::*;

    fn build_sql(f: &ProductSearchFilter) -> String {
        let mut qb = QueryBuilder::<MySql>::new("SELECT COUNT(*) FROM product");
        push_filters(&mut qb, f);
        let sql = qb.sql().to_string();
        qb.build();
        sql
    }

    #[test]
    fn attr_filter_uses_exists_and_binds() {
        let f = ProductSearchFilter {
            attrs: vec![SearchAttrObj {
                attr_name: Some("颜色".into()),
                attr_value: Some(vec!["红,蓝".into()]),
            }],
            ..Default::default()
        };
        let sql = build_sql(&f);
        assert!(sql.contains("EXISTS (SELECT 1 FROM product_attributes pa"));
        assert!(sql.contains("pa.attr_type = 0"));
        assert!(sql.contains("pa.attr_name LIKE ?"));
        assert!(sql.contains("pa.attr_value LIKE ? OR pa.attr_value LIKE ?"));
        // 属性名 1 + 两个值 = 3 个绑定参数，且值不能内联
        assert_eq!(sql.matches('?').count(), 3);
        assert!(!sql.contains("颜色"));
        assert!(!sql.contains("红"));
    }

    #[test]
    fn attr_values_split_commas_and_trim() {
        assert_eq!(
            normalize_attr_values(&Some(vec![" 红,蓝 ，绿 ".into()])),
            vec!["%红%".to_string(), "%蓝%".to_string(), "%绿%".to_string()]
        );
        assert!(normalize_attr_values(&None).is_empty());
        assert!(normalize_attr_values(&Some(vec![" , ，".into()])).is_empty());
    }

    #[test]
    fn multiple_attrs_add_one_exists_each() {
        let f = ProductSearchFilter {
            attrs: vec![
                SearchAttrObj { attr_name: Some("颜色".into()), attr_value: Some(vec!["红".into()]) },
                SearchAttrObj { attr_name: Some("尺寸".into()), attr_value: Some(vec!["L".into()]) },
            ],
            ..Default::default()
        };
        let sql = build_sql(&f);
        assert_eq!(sql.matches("EXISTS (SELECT 1 FROM product_attributes pa").count(), 2);
        // 2 属性名 + 2 值
        assert_eq!(sql.matches('?').count(), 4);
    }

    #[test]
    fn blank_attr_name_or_values_are_ignored() {
        let f = ProductSearchFilter {
            attrs: vec![
                SearchAttrObj { attr_name: Some("  ".into()), attr_value: Some(vec!["红".into()]) },
                SearchAttrObj { attr_name: Some("颜色".into()), attr_value: Some(vec![" ,  ".into()]) },
            ],
            ..Default::default()
        };
        assert_eq!(build_sql(&f).matches('?').count(), 0);
    }
}
