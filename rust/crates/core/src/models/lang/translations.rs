//! 业务数据翻译（lang::translations）DTO / VO。
//!
//! Java 来源：
//! - `com.tigshop.bean.dto.lang.TranslationsDataDTO`（`getTranslations` 返回项）
//! - `com.tigshop.bean.vo.lang.TranslationsDetailVO`（`getTranslations` 出参）
//! - `com.tigshop.bean.param.lang.TranslationsCreateParam`（`createTranslations`
//!   入参，`items` 为各语言的译文）
//!
//! 表 `translations_data`（实体 `entities::TranslationsData`）。

use serde::{Deserialize, Serialize};

/// 图片本地化数据类型（Java `DataType.IMAGE_TITLE` = 7）。
///
/// 仅该类型的译文会持久化 `translation_source`（Java `createTranslations`
/// 的 `handleSource` 分支）。
pub const DATA_TYPE_IMAGE_TITLE: i32 = 7;

/// 规格图片数据类型（Java `DataType.IMAGE_SPEC` = 8）。
///
/// 与 [`DATA_TYPE_IMAGE_TITLE`] 一起构成「图片类译文」：两者都会把译文
/// 视为图片 URL，并双写 `image_i18n`（海外站图片本地化）。
pub const DATA_TYPE_SPEC_IMAGE: i32 = 8;

/// 默认译文来源（任务约定：AI 翻译写入 `translation_source = 1`）。
pub const DEFAULT_TRANSLATION_SOURCE: i32 = 1;

/// 翻译数据项（Java `TranslationsDataDTO`，camelCase 直出实体列）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationsDataVO {
    pub id: Option<i32>,
    /// 数据 id（商品/分类/品牌/导航等）
    pub data_id: Option<i32>,
    /// 数据类型
    pub data_type: Option<i32>,
    /// 语言 id（`locales.id`）
    pub locale_id: Option<i32>,
    /// 翻译 key（`md5(translationName)`）
    pub translation_key: Option<String>,
    /// 待翻译内容
    pub translation_name: Option<String>,
    /// 翻译值
    pub translation_value: Option<String>,
    /// 译文来源：0-未知/人工，1-AI翻译，2-AI智能消除
    pub translation_source: Option<i32>,
}

/// 翻译详情（Java `TranslationsDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationsDetailVO {
    /// 数据 id（Java 里塞的是入参 `dataId`）
    pub id: Option<i32>,
    /// 数据类型
    pub data_type: Option<i32>,
    /// 翻译词汇（命中数据的第一条 `translationName`）
    pub translation_name: Option<String>,
    /// 各语言译文
    pub items: Vec<TranslationsDataVO>,
}

/// `getTranslations` 入参（Java `TranslationsDataDTO` 的请求形态）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsGetDTO {
    pub id: Option<i32>,
    pub data_id: Option<i32>,
    pub data_type: Option<i32>,
    pub locale_id: Option<i32>,
    pub translation_key: Option<String>,
    pub translation_name: Option<String>,
}

/// `createTranslations` 单条译文（Java `TranslationsData` 实体的请求形态）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsCreateItem {
    /// 语言 id（Java：为 `null` 的项直接跳过）
    pub locale_id: Option<i32>,
    /// 翻译值
    pub translation_value: Option<String>,
    /// 译文来源（item 级优先于 param 级）
    pub translation_source: Option<i32>,
}

/// `createTranslations` 入参（Java `TranslationsCreateParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsCreateParam {
    /// 数据 id
    pub data_id: Option<i32>,
    /// 数据类型
    pub data_type: Option<i32>,
    /// 翻译词汇（原文）
    pub translation_name: Option<String>,
    /// 各语言译文
    #[serde(default)]
    pub items: Vec<TranslationsCreateItem>,
    /// 译文来源默认值（item 未带时生效）
    pub translation_source: Option<i32>,
}

// ——————————————————————————————————————————————
// 管理端 CRUD（Java `TranslationsController` 的 list/detail/batch/del/
// translation/multiple/batchCreate/batchCreateTranslations/getLocalesLimit3）
// ——————————————————————————————————————————————

/// `GET /adminapi/lang/translations/list` 查询参数（Java `TranslationsListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    /// 待翻译标识模糊匹配
    pub translation_name: Option<String>,
    /// 数据类型（0 页面 / 1 接口）
    pub data_type: Option<i32>,
    /// 语言 id 逗号分隔串（如 `1,2`；用于行内译文列）
    pub locale_ids: Option<String>,
}

impl TranslationsListQuery {
    /// 分页参数（Java `BasePage` 口径）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        (
            self.page.unwrap_or(1).max(1),
            self.size.unwrap_or(15).clamp(1, 100),
        )
    }

    /// 解析 `localeIds` 逗号串（脏段跳过，与列表行内译文列对应）。
    #[must_use]
    pub fn locale_id_list(&self) -> Vec<i32> {
        self.locale_ids
            .as_deref()
            .map(|s| {
                s.split(',')
                    .filter_map(|p| p.trim().parse::<i32>().ok())
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// 翻译词条 VO（Java `TranslationsVO`：`translations` 行 + 行内译文）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationsVO {
    pub id: Option<i32>,
    pub data_type: Option<i32>,
    pub translation_name: Option<String>,
    pub translation_key: Option<String>,
    pub shop_id: Option<i32>,
    /// 各语言译文（行内列；`localeIds` 为空时为空数组）
    pub items: Vec<TranslationsDataVO>,
}

/// `batch` / `del` 请求体（Java `TranslationsBatchParam` / `TranslationsDelParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsBatchParam {
    pub ids: Option<Vec<i32>>,
    /// Java 仅实现 `del`
    pub r#type: Option<String>,
}

/// 机器翻译请求（Java `TranslationTextDTO`：`{code, text}`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationTextDTO {
    /// 目标语言代码
    pub code: Option<String>,
    pub text: Option<String>,
}

/// 机器翻译结果（Java `TranslateTextResponse.Translation`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationTextVO {
    pub detected_source_language: Option<String>,
    pub translation: Option<String>,
}

/// 一键翻译请求（Java `MultipleTranslationDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MultipleTranslationDTO {
    pub data_type: Option<i32>,
    pub locales_id: Option<i32>,
    pub update_type: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    #[serde(default)]
    pub ids: Vec<i32>,
}

/// 批量创建翻译词条请求（Java `TranslationsCreateDTO`：
/// `translationName` 按换行拆分为多条）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TranslationsCreateDTO {
    pub translation_name: Option<String>,
    #[serde(default)]
    pub data_type: Vec<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detail_vo_serializes_camel_case() {
        let vo = TranslationsDetailVO {
            id: Some(3),
            data_type: Some(7),
            translation_name: Some("Red".to_string()),
            items: vec![TranslationsDataVO {
                locale_id: Some(2),
                translation_value: Some("红色".into()),
                ..Default::default()
            }],
        };
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains(r#""dataType":7"#));
        assert!(json.contains(r#""translationName":"Red""#));
        assert!(json.contains(r#""localeId":2"#));
        assert!(json.contains(r#""translationValue":"红色""#));
    }

    #[test]
    fn get_dto_accepts_frontend_body() {
        let dto: TranslationsGetDTO =
            serde_json::from_str(r#"{"dataType":1,"dataId":5,"translationName":"Red"}"#).unwrap();
        assert_eq!(dto.data_type, Some(1));
        assert_eq!(dto.data_id, Some(5));
        assert_eq!(dto.translation_name.as_deref(), Some("Red"));
    }

    #[test]
    fn create_param_accepts_frontend_body() {
        let p: TranslationsCreateParam = serde_json::from_str(
            r#"{"dataType":7,"dataId":1,"translationName":"Red",
                "translationSource":1,"items":[{"localeId":2,"translationValue":"红色"}]}"#,
        )
        .unwrap();
        assert_eq!(p.items.len(), 1);
        assert_eq!(p.items[0].locale_id, Some(2));
    }
}
