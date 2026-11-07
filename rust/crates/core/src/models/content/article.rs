//! 内容（文章）DTO/VO。
//! 对应 `com.tigshop.bean.dto.content.*` / `vo.content.*`。
//!
//! JSON 字段名保持 camelCase，与原前端接口一致。

use serde::{Deserialize, Serialize};

/// 文章分页查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ArticleListQuery {
    pub keyword: Option<String>,
    pub article_category_id: Option<i32>,
    pub is_show: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 文章 VO（列表项，不含正文以减小响应体）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleVO {
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

impl From<&crate::entities::Article> for ArticleVO {
    fn from(a: &crate::entities::Article) -> Self {
        // 实体按真实库可空性建模：NOT NULL 列为裸类型，可空列为 Option。
        // VO 层保持与原 Java 接口一致的 JSON 契约。
        Self {
            article_id: a.article_id,
            article_title: a.article_title.clone(),
            article_category_id: a.article_category_id,
            article_thumb: a.article_thumb.clone(),
            article_author: a.article_author.clone(),
            description: a.description.clone(),
            is_show: a.is_show,
            is_hot: a.is_hot,
            is_top: a.is_top,
            click_count: a.click_count,
            add_time: a.add_time,
        }
    }
}

/// 文章详情 VO（含正文与 SEO 字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleDetailVO {
    #[serde(flatten)]
    pub base: ArticleVO,
    pub content: String,
    pub keywords: String,
    pub article_sn: String,
    pub article_tag: String,
    pub link: String,
    /// 关联商品 ID（Java `ArticleDetailVO.productIds`，取自 `product_article.goods_id`，
    /// 服务层填充；旧 PC 文章详情据此渲染「相关商品」区块）。
    #[serde(default)]
    pub product_ids: Vec<i32>,
}

impl From<&crate::entities::Article> for ArticleDetailVO {
    fn from(a: &crate::entities::Article) -> Self {
        Self {
            base: ArticleVO::from(a),
            content: a.content.clone(),
            keywords: a.keywords.clone(),
            article_sn: a.article_sn.clone(),
            article_tag: a.article_tag.clone(),
            link: a.link.clone(),
            product_ids: Vec::new(),
        }
    }
}

/// 文章分类 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleCategoryVO {
    pub article_category_id: i32,
    pub article_category_name: String,
    pub category_sn: String,
    pub category_type: i32,
    pub sort_order: i32,
    pub parent_id: i32,
}

impl From<&crate::entities::ArticleCategory> for ArticleCategoryVO {
    fn from(c: &crate::entities::ArticleCategory) -> Self {
        Self {
            article_category_id: c.article_category_id,
            article_category_name: c.article_category_name.clone(),
            category_sn: c.category_sn.clone(),
            category_type: c.category_type,
            sort_order: c.sort_order,
            parent_id: c.parent_id,
        }
    }
}

/// 文章分类树节点（含子分类）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleCategoryTreeNode {
    #[serde(flatten)]
    pub node: ArticleCategoryVO,
    pub children: Vec<ArticleCategoryTreeNode>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_vo_maps_camel_case() {
        let a = crate::entities::Article {
            article_id: 5,
            article_title: "标题".into(),
            article_category_id: 2,
            ..Default::default()
        };
        let v = serde_json::to_value(ArticleVO::from(&a)).unwrap();
        assert_eq!(v["articleId"], 5);
        assert_eq!(v["articleTitle"], "标题");
        assert_eq!(v["articleCategoryId"], 2);
    }

    #[test]
    fn detail_vo_flattens_base() {
        let a = crate::entities::Article {
            article_id: 9,
            article_title: "T".into(),
            content: "<p>x</p>".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(ArticleDetailVO::from(&a)).unwrap();
        // flatten 后 base 字段与 content 同级
        assert_eq!(v["articleId"], 9);
        assert_eq!(v["content"], "<p>x</p>");
    }

    #[test]
    fn category_tree_node_serializes_children() {
        let n = ArticleCategoryTreeNode {
            node: ArticleCategoryVO {
                article_category_id: 1,
                article_category_name: "帮助".into(),
                ..Default::default()
            },
            children: Vec::new(),
        };
        let v = serde_json::to_value(&n).unwrap();
        assert_eq!(v["articleCategoryId"], 1);
        assert_eq!(v["children"].as_array().unwrap().len(), 0);
    }
}
