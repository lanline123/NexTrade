//! 限时折扣域 DTO/VO。
//! 对应原 Java `param.promotion.TimeDiscountSaveParam` /
//! `TimeDiscountEditParam`、`vo.promotion.TimeDiscountDetailVO`。
//!
//! JSON 字段名保持 camelCase 与原前端接口一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 限时折扣分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimeDiscountListQuery {
    pub keyword: Option<String>,
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 折扣明细入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimeDiscountItemDTO {
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub product_id: Option<i32>,
    /// 适用 SKU 列表；为空表示作用于该商品全部规格
    #[serde(default, deserialize_with = "de_i32_list")]
    pub sku_ids: Vec<i32>,
    /// 折扣值：`discount_type` 为 1 时是折扣率（如 8.5 表示 8.5 折），
    /// 为 2 时是立减金额，为 3 时是固定折扣价
    #[serde(default, deserialize_with = "de_opt_decimal")]
    pub value: Option<Decimal>,
    /// 1 折扣率 2 立减 3 固定价
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub discount_type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub start_time: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub end_time: Option<i32>,
}

/// 原版前端会把数字以字符串提交（含数组元素），这里统一宽松解析。
fn de_opt_i32<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.as_i64().and_then(|v| i32::try_from(v).ok()),
        Some(serde_json::Value::String(s)) => s.trim().parse::<i32>().ok(),
        _ => None,
    })
}

fn de_opt_decimal<'de, D>(deserializer: D) -> Result<Option<Decimal>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.to_string().parse::<Decimal>().ok(),
        Some(serde_json::Value::String(s)) => s.trim().parse::<Decimal>().ok(),
        _ => None,
    })
}

fn de_i32_list<'de, D>(deserializer: D) -> Result<Vec<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    let Some(serde_json::Value::Array(items)) = value else {
        return Ok(Vec::new());
    };
    Ok(items
        .into_iter()
        .filter_map(|v| match v {
            serde_json::Value::Number(n) => n.as_i64().and_then(|x| i32::try_from(x).ok()),
            serde_json::Value::String(s) => s.trim().parse::<i32>().ok(),
            _ => None,
        })
        .collect())
}

/// 创建限时折扣请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimeDiscountCreateDTO {
    pub promotion_name: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub start_time: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub end_time: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub shop_id: Option<i32>,
    /// 参与活动的商品 ID 列表（用于跨活动冲突校验）
    #[serde(default, deserialize_with = "de_i32_list")]
    pub product_ids: Vec<i32>,
    #[serde(default)]
    pub item: Vec<TimeDiscountItemDTO>,
}

/// 更新限时折扣请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimeDiscountUpdateDTO {
    pub discount_id: i32,
    #[serde(flatten)]
    pub base: TimeDiscountCreateDTO,
}

/// 折扣明细 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeDiscountItemVO {
    pub item_id: i32,
    pub discount_id: i32,
    pub product_id: i32,
    /// 适用 SKU 列表（空表示全部规格）
    pub sku_ids: Vec<i32>,
    pub value: Decimal,
    pub discount_type: i32,
    /// 折扣类型中文名
    pub discount_type_name: String,
    pub start_time: i32,
    pub end_time: i32,
}

/// 限时折扣详情 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeDiscountDetailVO {
    pub discount_id: i32,
    pub promotion_name: String,
    pub start_time: i32,
    pub end_time: i32,
    pub shop_id: i32,
    pub add_time: i32,
    pub item: Vec<TimeDiscountItemVO>,
    /// 派生状态：1 未开始 2 进行中 3 已结束
    pub status: i32,
    pub status_name: String,
}

/// 前台折扣商品列表项。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeDiscountPromotionVO {
    pub item_id: i32,
    pub discount_id: i32,
    pub product_id: i32,
    pub sku_ids: Vec<i32>,
    /// 折扣值（含义随 `discountType` 变化）
    pub value: Decimal,
    pub discount_type: i32,
    pub discount_type_name: String,
    /// 折扣力度展示文案，如 "8.5折" / "立减10.00" / "到手价9.90"
    pub discount_label: String,
    pub start_time: i32,
    pub end_time: i32,
    pub remain_seconds: i64,
    pub started: bool,
}

/// 折扣类型（对应库中 `discount_type`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscountType {
    /// 折扣率：`value` 为折数（8.5 表示 8.5 折，即原价 × 0.85）
    Rate = 1,
    /// 立减：`value` 为减免金额
    Reduce = 2,
    /// 固定价：`value` 为折后到手价
    Fixed = 3,
}

impl DiscountType {
    pub fn name(self) -> &'static str {
        match self {
            Self::Rate => "折扣",
            Self::Reduce => "立减",
            Self::Fixed => "固定价",
        }
    }

    /// 按折扣值生成展示文案。
    pub fn label(self, value: Decimal) -> String {
        match self {
            Self::Rate => format!("{value}折"),
            Self::Reduce => format!("立减{value}"),
            Self::Fixed => format!("到手价{value}"),
        }
    }
}

impl TryFrom<i32> for DiscountType {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            1 => Ok(Self::Rate),
            2 => Ok(Self::Reduce),
            3 => Ok(Self::Fixed),
            other => Err(format!("非法折扣类型: {other}")),
        }
    }
}

/// 活动时间状态（对应原 Java `PromotionTimeStatusEnum`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromotionTimeStatus {
    /// 未开始
    Forthcoming = 1,
    /// 进行中
    On = 2,
    /// 已结束
    Off = 3,
}

impl PromotionTimeStatus {
    pub fn description(self) -> &'static str {
        match self {
            Self::Forthcoming => "未开始",
            Self::On => "进行中",
            Self::Off => "已结束",
        }
    }

    /// 按时间窗推导状态（边界包含：等于起止时间均算进行中）。
    pub fn of(now: i32, start: i32, end: i32) -> Self {
        if now < start {
            Self::Forthcoming
        } else if now > end {
            Self::Off
        } else {
            Self::On
        }
    }
}

/// 解析 `sku_ids` JSON 列。
///
/// 库中该列为 `text`，存 JSON 数组字符串；空值/空数组表示
/// 「作用于该商品全部规格」（与 Java `appliesToSku` 语义一致）。
pub fn parse_sku_ids(raw: Option<&str>) -> Vec<i32> {
    let Some(s) = raw else { return Vec::new() };
    let t = s.trim();
    if t.is_empty() || t == "null" || t == "[]" {
        return Vec::new();
    }
    serde_json::from_str::<Vec<i32>>(t).unwrap_or_default()
}

/// 序列化 SKU 列表为库中 JSON 列格式（空列表存 `null`）。
pub fn serialize_sku_ids(ids: &[i32]) -> Option<String> {
    if ids.is_empty() {
        None
    } else {
        serde_json::to_string(ids).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }

    #[test]
    fn discount_type_names_and_labels() {
        assert_eq!(DiscountType::Rate.name(), "折扣");
        assert_eq!(DiscountType::Rate.label(dec("8.5")), "8.5折");
        assert_eq!(DiscountType::Reduce.label(dec("10.00")), "立减10.00");
        assert_eq!(DiscountType::Fixed.label(dec("9.90")), "到手价9.90");
        assert!(DiscountType::try_from(9).is_err());
    }

    #[test]
    fn time_status_boundaries_inclusive() {
        // 未开始
        assert_eq!(
            PromotionTimeStatus::of(100, 200, 300),
            PromotionTimeStatus::Forthcoming
        );
        // 边界：等于开始时间 → 进行中
        assert_eq!(
            PromotionTimeStatus::of(200, 200, 300),
            PromotionTimeStatus::On
        );
        // 边界：等于结束时间 → 进行中
        assert_eq!(
            PromotionTimeStatus::of(300, 200, 300),
            PromotionTimeStatus::On
        );
        // 已结束
        assert_eq!(
            PromotionTimeStatus::of(301, 200, 300),
            PromotionTimeStatus::Off
        );
    }

    #[test]
    fn parse_sku_ids_tolerates_all_forms() {
        assert_eq!(parse_sku_ids(Some("[1,2,3]")), vec![1, 2, 3]);
        // 空值 / null / 空数组 → 表示全部规格
        assert!(parse_sku_ids(None).is_empty());
        assert!(parse_sku_ids(Some("")).is_empty());
        assert!(parse_sku_ids(Some("null")).is_empty());
        assert!(parse_sku_ids(Some("[]")).is_empty());
        // 非法 JSON 不应 panic
        assert!(parse_sku_ids(Some("not-json")).is_empty());
    }

    #[test]
    fn serialize_sku_ids_empty_is_null() {
        assert_eq!(serialize_sku_ids(&[]), None);
        assert_eq!(serialize_sku_ids(&[5, 6]).as_deref(), Some("[5,6]"));
    }

    #[test]
    fn create_dto_parses_camel_case() {
        let d: TimeDiscountCreateDTO = serde_json::from_str(
            r#"{"promotionName":"双11折扣","startTime":100,"endTime":200,
                "productIds":[7],"item":[{"productId":7,"skuIds":[1,2],
                "value":"8.5","discountType":1}]}"#,
        )
        .unwrap();
        assert_eq!(d.promotion_name.as_deref(), Some("双11折扣"));
        assert_eq!(d.product_ids, vec![7]);
        assert_eq!(d.item[0].sku_ids, vec![1, 2]);
        assert_eq!(d.item[0].discount_type, Some(1));
    }

    #[test]
    fn update_dto_flattens_base() {
        let d: TimeDiscountUpdateDTO =
            serde_json::from_str(r#"{"discountId":9,"promotionName":"改名"}"#).unwrap();
        assert_eq!(d.discount_id, 9);
        assert_eq!(d.base.promotion_name.as_deref(), Some("改名"));
    }

    #[test]
    fn item_dto_sku_ids_defaults_empty() {
        // skuIds 缺省时应为空列表（表示全部规格），而非报错
        let d: TimeDiscountItemDTO =
            serde_json::from_str(r#"{"productId":3,"value":"5","discountType":2}"#).unwrap();
        assert!(d.sku_ids.is_empty());
    }
}
