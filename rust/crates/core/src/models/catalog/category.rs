//! 商品分类域（catalog::category）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.product.CategoryListDTO`（→ [`CategoryListQuery`]）
//! - `com.tigshop.bean.dto.product.CategoryDTO`（→ [`CategoryDTO`]）
//! - `com.tigshop.bean.dto.product.MoveCatDTO`（→ [`MoveCatDTO`]）
//! - `com.tigshop.bean.dto.common.{OperateDTO, BatchDTO, UpdateFieldDTO}`
//! - `com.tigshop.bean.dto.product.ProductRelateDTO`（→ [`ProductRelateQuery`]）
//! - `cn.hutool.core.lang.tree.Tree<Integer>`（→ [`CategoryTreeVO`]）
//! - `com.tigshop.bean.vo.product.ProductLookAlsoVO` / `RelateRankVO`
//! - `com.tigshop.bean.dto.order.CategoryParentTreeDTO`
//!
//! JSON 字段名保持 camelCase，与原接口一致。
//!
//! 说明：共享 `models::catalog` 中已有 `CategoryDTO` 等结构，但本切片按
//! 仓库既定约定（`product_manage` / `brand` / `user_center`）持有**独占副本**，
//! 以避免跨切片互相耦合；字段与原接口逐一对齐。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 管理端：查询 / 请求参数
// ——————————————————————————————————————————————

/// 商品分类列表查询参数，对应 Java `CategoryListDTO extends BasePage`。
///
/// 注意 `BasePage.getSize()` 缺省 15、上限 100（见 `BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryListQuery {
    /// 父级 id；`>= 0` 时按父级过滤（Java 判定 `parentId != null && parentId >= 0`）
    pub parent_id: Option<i32>,
    /// 是否显示（Java DTO 声明了该字段，但 `CategoryServiceImpl.list` **未使用**）
    pub is_show: Option<String>,
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（驼峰属性名或数据库列名）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序，对应 `buildSortOrder`）
    pub sort_order: Option<String>,
}

/// 分类 DTO：字段与 `Category` 实体一一对应，另带 `hasChildren`。
///
/// 对应 Java `CategoryDTO`（`detail` / `create` / `update` 共用）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDTO {
    pub category_id: Option<i32>,
    #[serde(default)]
    pub category_name: Option<String>,
    #[serde(default)]
    pub seo_identification: Option<String>,
    #[serde(default)]
    pub keywords: Option<String>,
    #[serde(default)]
    pub category_desc: Option<String>,
    #[serde(default)]
    pub parent_id: Option<i32>,
    #[serde(default)]
    pub sort_order: Option<i32>,
    #[serde(default)]
    pub measure_unit: Option<String>,
    #[serde(default)]
    pub is_show: Option<i32>,
    #[serde(default)]
    pub seo_title: Option<String>,
    #[serde(default)]
    pub short_name: Option<String>,
    #[serde(default)]
    pub category_pic: Option<String>,
    #[serde(default)]
    pub category_ico: Option<String>,
    #[serde(default)]
    pub is_hot: Option<i32>,
    #[serde(default)]
    pub search_keywords: Option<String>,
    /// 直接子分类数量（`list` 接口批量统计后回填）
    #[serde(default)]
    pub has_children: Option<i64>,
}

/// 单 ID 操作请求体，对应 Java `bean.dto.common.OperateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作请求体，对应 Java `bean.dto.common.BatchDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    /// 操作类型；仅 `del` 有实际实现（其余走 `BaseServiceImpl.batch` 返回 false）
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求体，对应 Java `bean.dto.common.UpdateFieldDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    /// 字段名（数据库列名，取值受 `CATEGORY_FIELDS` 白名单限制）
    #[serde(default)]
    pub field: Option<String>,
    /// 新值（Java 侧为 `String`）
    #[serde(default)]
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish")]
    pub val: Option<String>,
}

/// 移动分类请求体，对应 Java `bean.dto.product.MoveCatDTO`。
///
/// 语义（见 `CategoryServiceImpl.moveCat`）：把 **`id` 分类下的商品**
/// 批量改挂到 `targetCatId`，而不是移动分类节点自身。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCatDTO {
    pub id: Option<i32>,
    pub target_cat_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 管理端：VO
// ——————————————————————————————————————————————

/// 分类树节点 VO（对应 hutool `Tree<Integer>` + `TreeNodeConfig`）。
///
/// 字段名取自 Java `convertTreeList`：
/// `setIdKey("categoryId")` / `setParentIdKey("parentId")` /
/// `setNameKey("categoryName")` / `setWeightKey("sortOrder")`，
/// 以及 `putExtra("isShow", ...)` / `putExtra("categoryPic", ...)`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTreeVO {
    /// 对应 `Tree.id`
    pub category_id: i32,
    /// 对应 `Tree.parentId`
    pub parent_id: i32,
    /// 对应 `Tree.name`（原 Java 会走多语言翻译，Rust 侧暂未接入翻译域）
    pub category_name: String,
    /// 对应 `Tree.weight`（= `category.sort_order`）
    pub sort_order: i32,
    /// 对应 `Tree.extra.isShow`
    pub is_show: i32,
    /// 对应 `Tree.extra.categoryPic`
    pub category_pic: String,
    /// 子节点（hutool `Tree.children`）；叶子节点为**空数组**而非 null
    pub children: Vec<CategoryTreeVO>,
}

/// 父级分类树节点，对应 Java `bean.dto.order.CategoryParentTreeDTO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryParentTreeVO {
    /// 当前层级分类 id
    pub category_id: i32,
    /// 当前层级分类名（Java 侧标注 `@JsonTranslate`）
    pub category_name: String,
    /// 当前层级的父级 id
    pub parent_id: i32,
    /// 该父级下的同级分类列表（`is_show = 1`）
    pub cat_list: Vec<CategoryTreeVO>,
}

// ——————————————————————————————————————————————
// 前台：相关商品 / 排行 / 品牌 / 文章 / 分类
// ——————————————————————————————————————————————

/// 商品相关查询参数，对应 Java `bean.dto.product.ProductRelateDTO`。
///
/// Java 构造器默认值：`size = 10`、`rankNum = 5`、`intro = "hot"`、
/// `productId = 0`（见 [`ProductRelateQuery::with_defaults`]）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductRelateQuery {
    /// 商品 ID
    pub product_id: Option<i32>,
    /// 查询数量（默认 10）
    pub size: Option<u32>,
    /// 排行榜显示数量（默认 5）
    pub rank_num: Option<u32>,
    /// 商品情况：`新品` / `精品` / 其他（默认按热卖）
    ///
    /// ⚠️ Java 侧比较的是 `IntroType.getDesc()`（中文「新品」/「精品」），
    /// 但 DTO 构造器把默认值写成英文 `"hot"`，因此**默认永远落到热卖分支**。
    /// 本实现照抄该行为（见 `intro_kind`）。
    pub intro: Option<String>,
    /// 店铺 ID（透传给商品价格解析；价格域未迁移，见服务层说明）
    pub shop_id: Option<i32>,
}

impl ProductRelateQuery {
    /// 归一化：把 Java 构造器的默认值补齐到本结构上。
    #[must_use]
    pub fn with_defaults(&self) -> Self {
        Self {
            product_id: Some(self.product_id.unwrap_or(0)),
            size: Some(self.size.unwrap_or(10)),
            rank_num: Some(self.rank_num.unwrap_or(5)),
            intro: Some(self.intro.clone().unwrap_or_else(|| "hot".to_string())),
            shop_id: self.shop_id,
        }
    }

    /// 生效的 `size`（Java 直接透传给 `last("limit n")`，负数无意义，这里下限取 1）。
    #[must_use]
    pub fn size_or_default(&self) -> u32 {
        self.size.unwrap_or(10).max(1)
    }

    /// 生效的 `rankNum`。
    #[must_use]
    pub fn rank_num_or_default(&self) -> u32 {
        self.rank_num.unwrap_or(5).max(1)
    }
}

/// 「看了还看」商品卡片，对应 Java `bean.vo.product.ProductLookAlsoVO`。
///
/// 价格字段在 Java 中是 `String`（`BigDecimal.toString()`），这里保持一致，
/// 避免前端契约变化。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductLookAlsoVO {
    /// 市场价（字符串，对应 `ProductLookAlsoVO.marketPrice`）
    pub market_price: String,
    /// 缩略图
    pub pic_thumb: String,
    /// 图片
    pub pic_url: String,
    /// 最终价格（字符串）
    pub price: String,
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品编号
    pub product_sn: String,
    /// 店铺 ID
    pub shop_id: i32,
    /// 首条批发价（批发域未迁移，恒为 `None`）
    pub first_wholesale_price: Option<Decimal>,
    /// 卡片可直接加购的起批数（批发域未迁移，恒为 `None`）
    pub wholesale_card_moq: Option<i32>,
    /// 起批维度（批发域未迁移，恒为 `None`）
    pub wholesale_moq_dimension: Option<i32>,
    /// 倍数购买（批发域未迁移，恒为 `None`）
    pub wholesale_multiple: Option<i32>,
}

/// 相关排行，对应 Java `bean.vo.product.RelateRankVO`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelateRankVO {
    /// 相同价位
    pub price: Vec<ProductLookAlsoVO>,
    /// 相同品牌
    pub brand: Vec<ProductLookAlsoVO>,
    /// 相同类别
    pub cate: Vec<ProductLookAlsoVO>,
}

/// 相关品牌，对应 Java `Brand` 实体的响应子集。
///
/// Java `getRelateBrand` 只 `select` 了
/// `brand_id / brand_name / brand_logo / site_url / first_word` 五列。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelateBrandVO {
    pub brand_id: i32,
    pub brand_name: String,
    pub brand_logo: Option<String>,
    pub site_url: String,
    pub first_word: Option<String>,
}

/// 相关文章，对应 Java `bean.vo.content.ArticleVO`（本切片仅返回列表项字段）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelateArticleVO {
    pub article_id: i32,
    pub article_title: String,
    pub article_category_id: i32,
    pub article_thumb: String,
    pub article_author: String,
    pub description: Option<String>,
    pub is_show: Option<i32>,
    pub is_hot: i32,
    pub is_top: i32,
    pub click_count: i32,
    pub add_time: i32,
}

/// 相关分类，对应 Java `getRelateCategory` 返回的 `Category` 实体列表。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelateCategoryVO {
    pub category_id: i32,
    pub category_name: String,
    pub parent_id: i32,
    pub sort_order: i32,
    pub is_show: i32,
    pub category_pic: String,
    pub category_ico: String,
}

/// `updateField` 允许更新的列白名单。
///
/// 对应 Java `com.tigshop.common.constant.CheckFieldConstants.CATEGORY_FIELDS`：
/// `{"category_name", "measure_unit", "is_hot", "is_show", "sort_order"}`。
pub const CATEGORY_FIELDS: [&str; 5] = [
    "category_name",
    "measure_unit",
    "is_hot",
    "is_show",
    "sort_order",
];

// ——————————————————————————————————————————————
// 纯逻辑辅助
// ——————————————————————————————————————————————

/// 「看了还看」的筛选维度，对应 Java `IntroType` 分支。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntroKind {
    /// 新品（`is_new = 1`）
    New,
    /// 精品（`is_best = 1`）
    Best,
    /// 热卖（`is_hot = 1`，默认分支）
    Hot,
}

/// 由 `intro` 字符串决定筛选维度。
///
/// 逐字对齐 Java `ProductServiceImpl.getLookAlso`：
/// ```text
/// if (IS_NEW.getDesc().equals(introType))        // "新品"
/// else if (IS_BEST.getDesc().equals(introType))  // "精品"
/// else                                           // 热卖
/// ```
/// 注意 `ProductRelateDTO` 的无参构造器把 `intro` 初始化为英文 `"hot"`，
/// 所以默认请求永远走热卖分支——这里照抄该行为而不是「修正」它。
#[must_use]
pub fn intro_kind(intro: Option<&str>) -> IntroKind {
    match intro {
        Some("新品") => IntroKind::New,
        Some("精品") => IntroKind::Best,
        _ => IntroKind::Hot,
    }
}

/// 排序字段白名单（对应 `BaseServiceImpl.getColumnByPropertyName`
/// 的防注入兜底：未知字段回退主键 `category_id`）。
const SORTABLE_COLUMNS: [&str; 8] = [
    "category_id",
    "category_name",
    "parent_id",
    "sort_order",
    "is_show",
    "is_hot",
    "measure_unit",
    "short_name",
];

/// 解析排序字段：驼峰或下划线均可，未知字段回退 `category_id`。
#[must_use]
pub fn resolve_sort_column(field: Option<&str>) -> &'static str {
    match field {
        Some(f) if !f.is_empty() => {
            let snake = to_snake(f);
            SORTABLE_COLUMNS
                .iter()
                .find(|c| **c == snake)
                .copied()
                .unwrap_or("category_id")
        }
        // Java：`sortField` 为空时直接使用主键
        _ => "category_id",
    }
}

/// 排序方向：Java `buildSortOrder` 仅在 `"asc"` 时升序，
/// 其余（含空）一律降序。
#[must_use]
pub fn resolve_sort_desc(sort_order: Option<&str>) -> bool {
    !sort_order.is_some_and(|o| o.eq_ignore_ascii_case("asc"))
}

/// `sortOrder` → `sort_order`。
#[must_use]
pub fn to_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for ch in s.chars() {
        if ch.is_ascii_uppercase() {
            out.push('_');
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn category_list_query_accepts_camel_case_and_size_alias() {
        let q: CategoryListQuery =
            serde_json::from_str(r#"{"parentId":3,"page":2,"size":20,"sortField":"sortOrder"}"#)
                .expect("应接受 camelCase 查询参数");
        assert_eq!(q.parent_id, Some(3));
        assert_eq!(q.page_size, Some(20), "size 应被识别为每页条数");
        assert_eq!(q.sort_field.as_deref(), Some("sortOrder"));

        // 前端也可能按 pageSize 传
        let q: CategoryListQuery =
            serde_json::from_str(r#"{"pageSize":5}"#).expect("应接受 pageSize");
        assert_eq!(q.page_size, Some(5));
    }

    #[test]
    fn category_dto_round_trips_camel_case() {
        let dto: CategoryDTO = serde_json::from_str(
            r#"{"categoryId":7,"categoryName":"手机","parentId":0,"hasChildren":2}"#,
        )
        .unwrap();
        assert_eq!(dto.category_id, Some(7));
        assert_eq!(dto.has_children, Some(2));
        let back = serde_json::to_string(&dto).unwrap();
        assert!(back.contains("\"hasChildren\""), "序列化须保持 camelCase");
    }

    #[test]
    fn move_cat_dto_deserializes() {
        let m: MoveCatDTO = serde_json::from_str(r#"{"id":1,"targetCatId":2}"#).unwrap();
        assert_eq!((m.id, m.target_cat_id), (Some(1), Some(2)));
    }

    #[test]
    fn intro_kind_matches_java_branch_order() {
        // Java 比较的是中文 desc
        assert_eq!(intro_kind(Some("新品")), IntroKind::New);
        assert_eq!(intro_kind(Some("精品")), IntroKind::Best);
        // DTO 构造器默认值 "hot" 落到默认分支（热卖）
        assert_eq!(intro_kind(Some("hot")), IntroKind::Hot);
        assert_eq!(intro_kind(None), IntroKind::Hot);
        assert_eq!(intro_kind(Some("热卖")), IntroKind::Hot);
        // 英文 is_new / is_best 也不会命中（照抄 Java 的字符串比较）
        assert_eq!(intro_kind(Some("is_new")), IntroKind::Hot);
    }

    #[test]
    fn relate_query_defaults_match_java_constructor() {
        let q = ProductRelateQuery::default().with_defaults();
        assert_eq!(q.product_id, Some(0));
        assert_eq!(q.size, Some(10));
        assert_eq!(q.rank_num, Some(5));
        assert_eq!(q.intro.as_deref(), Some("hot"));
        assert_eq!(q.shop_id, None);
    }

    #[test]
    fn sort_column_falls_back_to_primary_key() {
        assert_eq!(resolve_sort_column(None), "category_id");
        assert_eq!(resolve_sort_column(Some("")), "category_id");
        assert_eq!(resolve_sort_column(Some("sortOrder")), "sort_order");
        assert_eq!(resolve_sort_column(Some("sort_order")), "sort_order");
        assert_eq!(resolve_sort_column(Some("categoryName")), "category_name");
        // 防注入：未知字段回退主键
        assert_eq!(
            resolve_sort_column(Some("1;DROP TABLE category")),
            "category_id"
        );
    }

    #[test]
    fn sort_direction_defaults_to_desc() {
        assert!(!resolve_sort_desc(Some("asc")));
        assert!(!resolve_sort_desc(Some("ASC")));
        assert!(resolve_sort_desc(Some("desc")));
        assert!(resolve_sort_desc(None), "缺省方向为降序（Java 语义）");
        assert!(resolve_sort_desc(Some("")));
    }

    #[test]
    fn to_snake_is_idempotent() {
        assert_eq!(to_snake("sortOrder"), "sort_order");
        assert_eq!(to_snake("sort_order"), "sort_order");
    }
}
