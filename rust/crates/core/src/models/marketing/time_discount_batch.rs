//! 限时折扣批处理域（marketing::time_discount_batch）DTO / 纯函数。
//!
//! 对应原 Java `TimeDiscountServiceImpl#batch(BatchDTO)`：
//! `type == "del"` 时删除活动 + 活动商品 + 对应营销活动（`promotion.type=6`）。
//!
//! 本 feature 是 `marketing/time_discount` 的**补充批处理端点**
//! （`POST /adminapi/promotion/timeDiscount/batch`），实体/表复用既有
//! `TimeDiscount` / `TimeDiscountItem` / `Promotion`（schema 已生成）。
//!
//! 文案逐字对齐 Java：`未选择项目` / `操作类型不能为空`。

use serde::{Deserialize, Serialize};

/// `promotion.type`：限时折扣（Java `PromotionType.TYPE_LIMIT_DISCOUNT` = 6）。
pub const PROMOTION_TYPE_LIMIT_DISCOUNT: i32 = 6;

/// `未选择项目`（Java `BatchDTO.ids` 的 `@NotEmpty` 文案）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// `操作类型不能为空`（Java `BatchDTO.type` 的 `@NotNull` 文案）。
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

/// 批量操作入参（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 校验批量入参（Java 注解文案；控制器带 `@Valid`）。
///
/// # Errors
/// 空 ids ⇒「未选择项目」；缺 type ⇒「操作类型不能为空」。
pub fn validate_batch(dto: &BatchDTO) -> Result<(Vec<i32>, String), String> {
    let ids = dto.ids.clone().unwrap_or_default();
    if ids.is_empty() {
        return Err(MSG_UNSELECTED_ITEM.to_string());
    }
    let op_type = dto
        .r#type
        .clone()
        .ok_or_else(|| MSG_OPERATION_TYPE_REQUIRED.to_string())?;
    Ok((ids, op_type))
}

/// 是否删除操作（Java `"del".equals(batchDTO.getType())`）。
#[must_use]
pub fn is_delete(dto: &BatchDTO) -> bool {
    dto.r#type.as_deref() == Some("del")
}

/// 生成 `IN (?, ?, ...)` 占位符串（供仓储拼接）。
#[must_use]
pub fn in_placeholders(len: usize) -> String {
    let mut parts = vec!["?"; len];
    if parts.is_empty() {
        parts.push("NULL");
    }
    format!("({})", parts.join(", "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_texts_are_verbatim() {
        let dto = BatchDTO::default();
        assert_eq!(validate_batch(&dto).unwrap_err(), "未选择项目");
        let dto = BatchDTO {
            ids: Some(vec![1, 2]),
            ..Default::default()
        };
        assert_eq!(validate_batch(&dto).unwrap_err(), "操作类型不能为空");
        let dto = BatchDTO {
            ids: Some(vec![1, 2]),
            r#type: Some("del".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_batch(&dto).unwrap(),
            (vec![1, 2], "del".to_string())
        );
    }

    #[test]
    fn delete_gate_is_exact_match() {
        assert!(is_delete(&BatchDTO {
            r#type: Some("del".into()),
            ..Default::default()
        }));
        assert!(!is_delete(&BatchDTO {
            r#type: Some("Del".into()),
            ..Default::default()
        }));
        assert!(!is_delete(&BatchDTO::default()));
    }

    #[test]
    fn placeholders_and_promotion_type() {
        assert_eq!(in_placeholders(3), "(?, ?, ?)");
        assert_eq!(in_placeholders(0), "(NULL)");
        // Java `PromotionType.TYPE_LIMIT_DISCOUNT`
        assert_eq!(PROMOTION_TYPE_LIMIT_DISCOUNT, 6);
    }
}
