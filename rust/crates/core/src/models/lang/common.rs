//! lang 域管理端 CRUD 公共 DTO（Java `com.tigshop.bean.dto.common`）。
//!
//! 供 `lang/locales`、`lang/currency`、`lang/localesRelation`、
//! `lang/translations` 四个控制器的 `list/detail/batch/updateField/del`
//! 共用；与 Java `BasePage` / `OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! 字段一一对应（camelCase）。

use serde::{Deserialize, Serialize};

/// 分页基类（Java `BasePage`：`page` / `size` + 排序字段）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BasePageQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    /// 排序字段（Java `buildSortOrder`，驼峰属性名或数据库列名）。
    pub sort_field: Option<String>,
    /// `asc` / `desc`；缺省按 Java 语义为升序（MyBatis-Plus 默认）。
    pub sort_order: Option<String>,
}

impl BasePageQuery {
    /// 分页参数（Java `BasePage`：缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        (
            self.page.unwrap_or(1).max(1),
            self.size.unwrap_or(15).clamp(1, 100),
        )
    }
}

/// 单 ID 操作请求体（Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作请求体（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    pub r#type: Option<String>,
    pub value: Option<i32>,
}

/// 通用字段更新请求体（Java `UpdateFieldDTO`）。
///
/// `val` 为字符串形态（Java `String value`，前端可能传 0/1 或 "xx"）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    pub val: Option<String>,
}

/// Java `CheckFieldConstants.CURRENCY_FIELDS`（locales / currency 共用）：
/// `updateField` 允许修改的列白名单。
pub const LANG_CRUD_FIELDS: [&str; 3] = ["is_enabled", "is_default", "sort"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_page_defaults_and_clamp() {
        let q = BasePageQuery::default();
        assert_eq!(q.page_params(), (1, 15));
        let q = BasePageQuery {
            page: Some(0),
            size: Some(9999),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (1, 100));
    }

    #[test]
    fn update_field_accepts_camel_case() {
        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"isDefault","val":"1"}"#).unwrap();
        assert_eq!(dto.id, Some(1));
        assert_eq!(dto.field.as_deref(), Some("isDefault"));
        assert_eq!(dto.val.as_deref(), Some("1"));
    }

    #[test]
    fn batch_dto_accepts_ids_and_type() {
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2,3],"type":"del"}"#).unwrap();
        assert_eq!(dto.ids.as_deref(), Some(&[1, 2, 3][..]));
        assert_eq!(dto.r#type.as_deref(), Some("del"));
    }
}
