//! 文章分类管理域（content::article_category）DTO / 纯函数。
//!
//! 对应原 Java `ArticleCategoryController` 的 3 个端点：
//! `POST /adminapi/content/articleCategory/update`、`updateField`、`batch`。
//! 表：`article_category`；`updateField` 白名单 = Java `ARTICLE_CATEGORY_FIELDS`。

use serde::{Deserialize, Serialize};

/// `id不能为空`
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// `field 的值有误`
pub const MSG_FIELD_INVALID: &str = "field 的值有误";
/// `未选择项目`
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// `操作类型不能为空`
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

/// `updateField` 白名单（Java `CheckFieldConstants.ARTICLE_CATEGORY_FIELDS`）。
pub const ARTICLE_CATEGORY_FIELDS: [&str; 3] =
    ["article_category_name", "category_sn", "sort_order"];

/// 文章分类创建/更新入参（Java `ArticleCategoryDTO` 常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ArticleCategoryDTO {
    pub article_category_id: Option<i32>,
    pub article_category_name: Option<String>,
    pub category_sn: Option<String>,
    pub category_type: Option<i32>,
    pub keywords: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub parent_id: Option<i32>,
}

/// 更新字段（Java `UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: i32,
    pub field: String,
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_stringish")]
    pub val: String,
}

/// 批量操作（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Vec<i32>,
    pub r#type: String,
}

/// 分类行（详情/列表复用）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ArticleCategoryVO {
    pub article_category_id: i32,
    pub article_category_name: String,
    pub category_sn: String,
    pub category_type: i32,
    pub keywords: String,
    pub description: String,
    pub sort_order: i32,
    pub parent_id: i32,
}

/// 属性名/列名 → 白名单列。
#[must_use]
pub fn resolve_field(field: &str) -> Option<&'static str> {
    let column = match field.trim() {
        "articleCategoryName" | "article_category_name" => "article_category_name",
        "categorySn" | "category_sn" => "category_sn",
        "sortOrder" | "sort_order" => "sort_order",
        _ => return None,
    };
    ARTICLE_CATEGORY_FIELDS.contains(&column).then_some(column)
}

/// 批量操作是否删除类型（Java `"del".equals(type)`）。
#[must_use]
pub fn is_delete_batch(type_: &str) -> bool {
    type_ == "del"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn field_whitelist_matches_java() {
        assert_eq!(
            resolve_field("articleCategoryName"),
            Some("article_category_name")
        );
        assert_eq!(resolve_field("category_sn"), Some("category_sn"));
        assert_eq!(resolve_field("sortOrder"), Some("sort_order"));
        assert_eq!(resolve_field("parent_id"), None);
        assert_eq!(resolve_field("x;drop"), None);
    }

    #[test]
    fn batch_type_and_ids() {
        assert!(is_delete_batch("del"));
        assert!(!is_delete_batch("on"));
        assert_eq!(MSG_UNSELECTED_ITEM, "未选择项目");
        assert_eq!(MSG_OPERATION_TYPE_REQUIRED, "操作类型不能为空");
    }

    #[test]
    fn dto_accepts_java_names() {
        let dto: ArticleCategoryDTO = serde_json::from_str(
            r#"{"articleCategoryId":1,"articleCategoryName":"帮助","categorySn":"help","sortOrder":2,"parentId":0}"#,
        )
        .unwrap();
        assert_eq!(dto.article_category_name.as_deref(), Some("帮助"));
        assert_eq!(dto.parent_id, Some(0));
    }
}
