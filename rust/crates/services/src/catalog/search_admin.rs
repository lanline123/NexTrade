//! 商品搜索服务（`catalog/search_admin`：管理端 2 条 + 前台 3 条）。
//!
//! 对应原 Java：
//! - 管理端 `com.tigshop.adminapi.controller.search.SearchController`
//!   （`aggregate` / `product` → 委托 `ProductService#list(ProductListDTO)`）；
//! - 前台 `com.tigshop.api.controller.search.SearchController`
//!   （`getProduct` / `getFilter` / `getAttributeSuggestions` →
//!   `ProductSearchServiceImpl`）。
//!
//! 管理端 2 条路由直接复用 `catalog/product_manage` 的 `admin_list`
//! （`ProductListDTO` ↔ `AdminProductListQuery` / `ProductListResDTO` ↔
//! `ProductListItemVO` 已是一一对应的迁移结果），本服务提供前台 3 条所需的
//! MySQL 搜索逻辑。
//!
//! # 与 Java 的差异 / 未迁移
//!
//! 1. **ES 分支未迁移**：Java 在 `selectSearchType=es` 时走
//!    `ProductEsSearchService`（Elasticsearch）；本工作区无 ES 依赖，恒走 MySQL
//!    分支（等价于 Java ES 异常后的回退路径）。
//! 2. **店铺分类筛选项**：`shopCategory` 依赖店铺域 `shop_product_category`，
//!    本切片不跨域装配，字段恒 `None`（Java 在 `shopId > 0` 时返回）。
//! 3. **`shopId` 头语义**：管理端搜索 Java 用 `HeaderUtils.getShopId()` 覆盖
//!    `shopId`；Rust JWT 无 `shop_id`，只认查询参数（多租户缺口同其它 wave1/2 特性）。
//! 4. **营销/批发/周期购/礼品卡等扩展过滤**：
//!    Java `ProductListDTO` 的 `couponId` / `posProductSource` /
//!    `excludeCycleProduct` / `excludeGiftCardProduct` / `isFilterPresaleProduct`
//!    需要促销/批发/卡券域参与，当前仅解析不使用（记录于下方 `test` 与报告）。
//! 5. **分类筛选列表**：Java 在 `cat > 0` 取子分类，否则在 `intro`/`keyword`
//!    存在时按「命中商品所属分类」反查；本实现统一取「父分类的下一级」
//!    （`cat>0` 取其子级，否则取根级），与 Java 主路径一致，反查分支未迁移。
//! 6. `translatePackage` 未迁移，分类/品牌名输出库中原值。

use std::collections::HashMap;
use std::sync::Arc;

use rust_decimal::Decimal;

use tigshop_core::entities::{Category, Product};
use tigshop_core::models::catalog::product::ProductVO;
use tigshop_core::models::catalog::search_admin::{
    AttributeSuggestionVO, AttributeValueCountVO, ProductSearchClientQuery,
    ProductSearchFilterListVO, ProductSearchFilterSelectedVO, SearchBrandVO, SearchCategoryVO,
    SearchFilterVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::catalog::search_admin::{
    AttributeCountRow, ProductSearchFilter,
};
use tigshop_infrastructure::db::Repositories;

/// 分类筛选项最多返回的下一级数量（Java `getCategoryByParentId(.., 100)`）。
const CATEGORY_FILTER_LIMIT: i64 = 100;
/// 属性建议：最多属性名数量（Java `count >= 6` 截断）。
pub const MAX_SUGGESTION_ATTRS: usize = 6;
/// 属性建议：每个属性名最多值数量（Java `values.subList(0, 20)`）。
pub const MAX_SUGGESTION_VALUES: usize = 20;

pub struct SearchAdminService {
    repos: Arc<Repositories>,
}

impl SearchAdminService {
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    // ————————————————————— 前台：商品列表 —————————————————————

    /// `POST /api/search/search/getProduct`：商品搜索分页。
    ///
    /// 对应 Java `ProductSearchServiceImpl#list`（MySQL 分支）：
    /// `page` 缺省 1、`size` 缺省/超 50 → 25；`productStatus` 缺省 1；
    /// 分类含全部子孙；品牌多选；价格区间；排序 `sale`/`price`/`time`。
    pub async fn search_products(
        &self,
        q: &ProductSearchClientQuery,
    ) -> Result<PageResult<ProductVO>> {
        validate_location(q.longitude, q.latitude)?;
        let page = q.page_query();
        let filter = self.build_filter(q).await?;
        let (total, rows) = self
            .repos.catalog.search_admin
            .paginate(&filter, &page)
            .await?;
        let list = rows.iter().map(to_product_vo).collect();
        Ok(PageResult::new(total, list, &page))
    }

    // ————————————————————— 前台：筛选项 —————————————————————

    /// `POST /api/search/search/getFilter`：分类 / 品牌 / 最高价 + 已选项。
    ///
    /// 对应 Java `ProductSearchServiceImpl#getFilterList` +
    /// `#getFilterSelected`：
    /// - 分类：`cat > 0` 取其下一级，否则取根级（最多 100）；
    /// - 品牌：命中商品中出现过的品牌；
    /// - 最高价：清空 min/max 后取 `MAX(product_price)`；
    /// - 已选：分类名（`keyword` 为空时 Java 会用 `seoTitle` 覆盖）、品牌名串、
    ///   `intro` / `keyword` / `attrs` 透传。
    pub async fn get_filter(&self, q: &ProductSearchClientQuery) -> Result<SearchFilterVO> {
        let filter = self.build_filter(q).await?;

        // Java `getFilterListCategoryList` 三分支：
        // cat>0 → 子分类；intro/keyword 存在 → 命中商品所属分类反查；否则根分类。
        let categories = if let Some(cat) = q.cat.filter(|c| *c > 0) {
            self.repos
                .catalog
                .search_admin
                .find_categories_by_parent(cat, CATEGORY_FILTER_LIMIT)
                .await?
        } else if q.intro.is_some() || q.keyword.is_some() {
            let ids = self
                .repos
                .catalog
                .search_admin
                .distinct_category_ids(&filter)
                .await?;
            self.repos
                .catalog
                .search_admin
                .find_categories_by_ids(&ids)
                .await?
        } else {
            self.repos
                .catalog
                .search_admin
                .find_categories_by_parent(0, CATEGORY_FILTER_LIMIT)
                .await?
        };
        let category_vos: Vec<SearchCategoryVO> = categories.iter().map(to_category_vo).collect();

        // Java：shopId>0 时返回店铺自定义分类（shopCategoryId 的子级，无则根级）
        let shop_category: Option<Vec<serde_json::Value>> =
            match q.shop_id.filter(|s| *s > 0) {
            Some(shop_id) => {
                let parent = q.shop_category_id.filter(|c| *c > 0).unwrap_or(0);
                let mut rows = self
                    .repos
                    .merchant
                    .shop_product_category
                    .find_visible_by_shop(shop_id)
                    .await?;
                rows.sort_by_key(|c| c.sort_order);
                let vos: Vec<serde_json::Value> = rows
                    .into_iter()
                    .filter(|c| c.parent_id == parent)
                    .map(|c| {
                        serde_json::to_value(SearchCategoryVO {
                            category_id: c.category_id,
                            category_name: c.category_name,
                            parent_id: c.parent_id,
                            sort_order: c.sort_order,
                        })
                        .unwrap_or(serde_json::Value::Null)
                    })
                    .collect();
                Some(vos)
            }
            None => None,
        };

        let brand_ids = self
            .repos.catalog.search_admin
            .distinct_brand_ids(&filter)
            .await?;
        let brands = self
            .repos.catalog.search_admin
            .find_brands(&brand_ids)
            .await?;
        let brand_vos: Vec<SearchBrandVO> = brands
            .iter()
            .map(|b| SearchBrandVO {
                brand_id: b.brand_id,
                brand_name: b.brand_name.clone(),
            })
            .collect();

        // Java：先把 min/max 清空再取最高价
        let price_filter = ProductSearchFilter {
            min_price: None,
            max_price: None,
            ..filter.clone()
        };
        let max_price = self
            .repos.catalog.search_admin
            .max_price(&price_filter)
            .await?;

        let filter_list = ProductSearchFilterListVO {
            category: Some(category_vos),
            brand: Some(brand_vos),
            shop_category,
            max_price,
        };
        let selected = self.build_selected(q).await?;
        Ok(SearchFilterVO {
            filter: filter_list,
            filter_selected: selected,
        })
    }

    /// 已选筛选项（Java `ProductSearchServiceImpl#getFilterSelected`）。
    async fn build_selected(
        &self,
        q: &ProductSearchClientQuery,
    ) -> Result<ProductSearchFilterSelectedVO> {
        let mut selected = ProductSearchFilterSelectedVO {
            intro: q.intro.clone(),
            keyword: q.keyword.clone(),
            attrs: q.attrs.clone(),
            ..Default::default()
        };

        if let Some(cat) = q.cat.filter(|c| *c > 0) {
            if let Some(category) = self
                .repos.catalog.search_admin
                .find_category(cat)
                .await?
            {
                // Java：有关键词时用 categoryName；无关键词时再被 seoTitle 覆盖
                selected.category = Some(category.category_name.clone());
                if q.keyword.is_none() && !category.seo_title.trim().is_empty() {
                    selected.category = Some(category.seo_title.clone());
                }
            }
        }

        let brand_ids = q.parsed_brand_ids();
        if !brand_ids.is_empty() {
            let brands = self
                .repos.catalog.search_admin
                .find_brands(&brand_ids)
                .await?;
            let names: Vec<String> = brands.into_iter().map(|b| b.brand_name).collect();
            if !names.is_empty() {
                // Java 保持请求里的品牌顺序（getBrandNameByIds），这里按查询顺序映射
                selected.brand = Some(names.join(","));
            }
        }
        Ok(selected)
    }

    // ————————————————————— 前台：属性搜索建议 —————————————————————

    /// `GET /api/search/search/getAttributeSuggestions`：属性建议。
    ///
    /// 对应 Java `getAttributeSuggestionsFromMysql`：
    /// 1. 先按搜索条件取商品 ID（只 select `product_id`）；
    /// 2. 查 `product_attributes`（`attr_type = 0`）按 `attr_name, attr_value`
    ///    统计次数降序；
    /// 3. 最多 6 个属性名、每个属性名最多 20 个值。
    pub async fn attribute_suggestions(
        &self,
        q: &ProductSearchClientQuery,
    ) -> Result<Vec<AttributeSuggestionVO>> {
        let filter = self.build_filter(q).await?;
        let product_ids = self
            .repos.catalog.search_admin
            .matching_product_ids(&filter)
            .await?;
        let rows = self
            .repos.catalog.search_admin
            .attribute_counts(&product_ids)
            .await?;
        Ok(group_attribute_counts(&rows))
    }

    // ————————————————————— 内部：过滤条件归一化 —————————————————————

    /// 由前台搜索参数构建仓储过滤条件（Java `buildProductListDTO` 的可迁移部分）。
    async fn build_filter(&self, q: &ProductSearchClientQuery) -> Result<ProductSearchFilter> {
        let category_ids = match q.cat.filter(|c| *c > 0) {
            Some(root) => {
                let cats = self
                    .repos.catalog.search_admin
                    .find_all_categories()
                    .await?;
                expand_category_ids(&cats, root)
            }
            None => Vec::new(),
        };
        let (sort_field, sort_order) = match q.sort_mapping() {
            Some((field, order)) => (Some(field), Some(order)),
            None => (None, None),
        };
        Ok(ProductSearchFilter {
            keyword_like: q
                .keyword
                .as_deref()
                .map(str::trim)
                .filter(|k| !k.is_empty())
                .map(|k| format!("%{k}%")),
            category_ids,
            brand_ids: q.parsed_brand_ids(),
            min_price: q.min,
            max_price: q.max,
            shop_id: q.shop_id,
            shop_category_id: q.shop_category_id,
            intro: q.intro.clone(),
            // Java：productStatus 缺省 1（只搜上架）
            product_status: Some(q.product_status.unwrap_or(1)),
            sort_field,
            sort_order,
            attrs: q.attrs.clone().unwrap_or_default(),
        })
    }
}

// ————————————————————— 纯函数（可单测） —————————————————————

/// 经纬度校验（Java `validateLocation`）：
/// 都不传 → 不启用定位；只传一项或越界 → 业务错误。
pub fn validate_location(longitude: Option<Decimal>, latitude: Option<Decimal>) -> Result<()> {
    if longitude.is_none() && latitude.is_none() {
        return Ok(());
    }
    let (Some(lon), Some(lat)) = (longitude, latitude) else {
        return Err(Error::biz(1001, "经度和纬度必须同时传递"));
    };
    if lon < Decimal::from(-180) || lon > Decimal::from(180) {
        return Err(Error::biz(1001, "经度范围必须在 -180 到 180 之间"));
    }
    if lat < Decimal::from(-90) || lat > Decimal::from(90) {
        return Err(Error::biz(1001, "纬度范围必须在 -90 到 90 之间"));
    }
    Ok(())
}

/// 展开分类「本分类 + 全部子孙分类」（Java `getCategoryAllChildIds`）。
#[must_use]
pub fn expand_category_ids(categories: &[Category], root: i32) -> Vec<i32> {
    let mut children: HashMap<i32, Vec<i32>> = HashMap::new();
    for c in categories {
        children.entry(c.parent_id).or_default().push(c.category_id);
    }
    let mut out = Vec::new();
    let mut stack = vec![root];
    while let Some(id) = stack.pop() {
        if out.contains(&id) {
            continue;
        }
        out.push(id);
        if let Some(kids) = children.get(&id) {
            stack.extend(kids.iter().copied());
        }
    }
    out
}

/// `product_attributes` 计数行 → 属性建议（Java `getAttributeSuggestionsFromMysql`
/// 的分组 + 截断逻辑）：属性名按首次出现顺序，值按次数降序，最多 6×20。
#[must_use]
pub fn group_attribute_counts(rows: &[AttributeCountRow]) -> Vec<AttributeSuggestionVO> {
    let mut order: Vec<String> = Vec::new();
    let mut grouped: HashMap<String, Vec<AttributeValueCountVO>> = HashMap::new();
    for (name, value, count) in rows {
        if !grouped.contains_key(name) {
            order.push(name.clone());
        }
        grouped
            .entry(name.clone())
            .or_default()
            .push(AttributeValueCountVO {
                value: value.clone(),
                count: *count,
            });
    }
    order
        .into_iter()
        .take(MAX_SUGGESTION_ATTRS)
        .map(|name| {
            let mut values = grouped.remove(&name).unwrap_or_default();
            // 同一属性内按次数降序（稳定排序，保持查询顺序做 tie-break）
            values.sort_by(|a, b| b.count.cmp(&a.count));
            values.truncate(MAX_SUGGESTION_VALUES);
            AttributeSuggestionVO { name, values }
        })
        .collect()
}

/// 分类实体 → 筛选项 VO。
fn to_category_vo(c: &Category) -> SearchCategoryVO {
    SearchCategoryVO {
        category_id: c.category_id,
        category_name: c.category_name.clone(),
        parent_id: c.parent_id,
        sort_order: c.sort_order,
    }
}

/// 商品实体 → 前台列表 VO（与 `catalog/product.rs` 的 `to_vo` 同构）。
fn to_product_vo(p: &Product) -> ProductVO {
    ProductVO {
        product_id: p.product_id,
        product_name: p.product_name.clone(),
        product_sn: p.product_sn.clone(),
        product_price: p.product_price,
        market_price: p.market_price,
        product_stock: p.product_stock,
        product_status: p.product_status,
        category_id: p.category_id,
        brand_id: p.brand_id,
        shop_id: p.shop_id,
        pic_url: p.pic_url.clone(),
        pic_thumb: p.pic_thumb.clone(),
        sales: p.virtual_sales,
        price: Some(p.product_price),
        virtual_sales: p.virtual_sales,
        add_time: p.add_time,
        store_product_name: None,
        store_product_price: None,
        store_pic_url: None,
        store_product_status: None,
        store_product_stock: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn location_validation_matches_java() {
        // 都不传 → 不启用定位
        assert!(validate_location(None, None).is_ok());
        // 只传一项 → 业务错误
        assert_eq!(
            validate_location(Some(Decimal::from(120)), None)
                .unwrap_err()
                .business_code(),
            1001
        );
        assert!(validate_location(None, Some(Decimal::from(30))).is_err());
        // 越界
        assert!(validate_location(
            Some(Decimal::from(181)),
            Some(Decimal::from(30))
        )
        .is_err());
        assert!(validate_location(
            Some(Decimal::from(120)),
            Some(Decimal::from(-91))
        )
        .is_err());
        // 合法
        assert!(validate_location(
            Some(Decimal::from(120)),
            Some(Decimal::from(30))
        )
        .is_ok());
    }

    #[test]
    fn category_expansion_includes_descendants() {
        let cats: Vec<Category> = vec![
            Category { category_id: 1, parent_id: 0, ..Default::default() },
            Category { category_id: 2, parent_id: 1, ..Default::default() },
            Category { category_id: 3, parent_id: 2, ..Default::default() },
            Category { category_id: 4, parent_id: 0, ..Default::default() },
        ];
        let mut ids = expand_category_ids(&cats, 1);
        ids.sort_unstable();
        assert_eq!(ids, vec![1, 2, 3]);
    }

    #[test]
    fn attribute_grouping_limits_and_sorts() {
        // 7 个属性名 → 只保留前 6 个首次出现的
        let mut rows: Vec<AttributeCountRow> = (0..7)
            .map(|i| (format!("属性{i}"), "值".to_string(), 1_i64))
            .collect();
        // 属性0 的 21 个值 → 截断到 20，且按 count 降序
        for i in 0..21 {
            rows.push(("属性0".to_string(), format!("v{i}"), i as i64));
        }
        let out = group_attribute_counts(&rows);
        assert_eq!(out.len(), MAX_SUGGESTION_ATTRS);
        let attr0 = out.iter().find(|a| a.name == "属性0").unwrap();
        assert_eq!(attr0.values.len(), MAX_SUGGESTION_VALUES);
        assert_eq!(attr0.values[0].count, 20);
        assert_eq!(attr0.values[19].count, 1);
    }

    #[test]
    fn attribute_grouping_empty_input() {
        assert!(group_attribute_counts(&[]).is_empty());
    }
}
