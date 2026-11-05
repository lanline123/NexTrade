//! 分类/品牌 DTO/VO。
//! 对应 `com.tigshop.bean.dto.product.CategoryDTO` / `CategoryListDTO` /
//! `MoveCatDTO`，以及 `bean.dto.common.OperateDTO` / `BatchDTO` / `UpdateFieldDTO`。
//!
//! JSON 字段名保持 camelCase，与原接口一致。

use serde::{Deserialize, Serialize};

/// 分类树节点 VO（含子分类）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTreeNode {
    pub category_id: i32,
    pub category_name: Option<String>,
    pub parent_id: Option<i32>,
    pub sort: Option<i32>,
    pub children: Vec<CategoryTreeNode>,
}

/// 品牌 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandVO {
    pub brand_id: i32,
    pub brand_name: Option<String>,
    pub is_show: Option<i32>,
}

/// 分类 DTO：字段与 `Category` 实体一一对应，另带 `hasChildren`。
///
/// 对应 Java `CategoryDTO`。`BeanUtils.copyProperties(category, dto)` 之后
/// 再设置 `hasChildren`，因此 `category_id` 在新增时可能为 `null`。
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
    /// 直接子分类数量（`list` 接口批量统计后回填）。
    #[serde(default)]
    pub has_children: Option<i64>,
}

/// 分类分页查询参数，对应 Java `CategoryListDTO extends BasePage`。
///
/// Java 侧只用了 `parentId` 与分页/排序字段；`isShow` 虽在 DTO 中声明，
/// 但 `CategoryServiceImpl.list` 未使用，故此处也不参与过滤。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryListQuery {
    /// 父分类 ID，`>= 0` 时按父级过滤；为 `null` 表示全部。
    pub parent_id: Option<i32>,
    /// 页码，从 1 开始。
    pub page: Option<u64>,
    /// 每页条数（Java 的 `BasePage.size`）。
    pub size: Option<u64>,
    /// 排序字段（驼峰属性名或数据库列名）。
    pub sort_field: Option<String>,
    /// `asc` / `desc`；缺省按 Java 语义为降序。
    pub sort_order: Option<String>,
}

/// 单 ID 操作请求体，对应 Java `OperateDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作请求体，对应 Java `BatchDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求体，对应 Java `UpdateFieldDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    #[serde(default)]
    pub field: Option<String>,
    #[serde(default)]
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish")]
    pub val: Option<String>,
}

/// 移动分类请求体，对应 Java `MoveCatDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCatDTO {
    pub id: Option<i32>,
    pub target_cat_id: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dtos_accept_camel_case_json() {
        // 前端按 camelCase 提交，字段必须能反序列化。
        let d: CategoryDTO =
            serde_json::from_str(r#"{"categoryId":3,"categoryName":"手机","parentId":0}"#)
                .expect("CategoryDTO 应接受 camelCase");
        assert_eq!(d.category_id, Some(3));
        assert_eq!(d.category_name.as_deref(), Some("手机"));
        assert_eq!(d.has_children, None);
    }

    #[test]
    fn batch_dto_type_is_not_reserved_collision() {
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#)
            .expect("BatchDTO 应接受 type 字段");
        assert_eq!(b.r#type.as_deref(), Some("del"));
        assert_eq!(b.ids, Some(vec![1, 2]));
    }

    #[test]
    fn move_cat_dto_round_trips() {
        let m: MoveCatDTO = serde_json::from_str(r#"{"id":5,"targetCatId":9}"#).unwrap();
        assert_eq!((m.id, m.target_cat_id), (Some(5), Some(9)));
        let back = serde_json::to_string(&m).unwrap();
        assert!(
            back.contains("targetCatId"),
            "序列化应保持 camelCase: {back}"
        );
    }
}
