//! 积分商品域（marketing::points_exchange）DTO / VO / 纯函数。
//! Java `PointsExchangeController`（7 端点，admin）+ `PointsExchangeServiceImpl`。
//! 表 `points_exchange`（7 列，主键 id）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

pub const COLUMNS: [&str; 7] = [
    "id",
    "product_id",
    "exchange_integral",
    "points_deducted_amount",
    "is_hot",
    "is_enabled",
    "sku_id",
];
pub const KEY_COLUMN: &str = "id";
pub const UPDATE_FIELDS: [&str; 2] = ["is_hot", "is_enabled"];

pub const MSG_PRODUCT_REQUIRED: &str = "请选择积分商品";
pub const MSG_ID_REQUIRED: &str = "积分商品id不能为空";
pub const MSG_DUPLICATE: &str = "已存在相同的积分商品";
pub const MSG_INTEGRAL_INVALID: &str = "兑换积分不能小于或等于0";
pub const MSG_SKU_DISABLED: &str = "商品规格已禁用，请重新选择";
pub const MSG_NOT_EXISTS: &str = "积分商品不存在";

#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "productId" | "product_id" => "product_id",
        "exchangeIntegral" | "exchange_integral" => "exchange_integral",
        "pointsDeductedAmount" | "points_deducted_amount" => "points_deducted_amount",
        "isHot" | "is_hot" => "is_hot",
        "isEnabled" | "is_enabled" => "is_enabled",
        "skuId" | "sku_id" => "sku_id",
        _ => KEY_COLUMN,
    }
}

#[must_use]
pub fn order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let field = sort_field.map(str::trim).unwrap_or("");
    let column = if field.is_empty() {
        KEY_COLUMN
    } else {
        map_order_column(field)
    };
    let dir = if sort_order
        .map(|s| s.trim().eq_ignore_ascii_case("asc"))
        .unwrap_or(false)
    {
        "ASC"
    } else {
        "DESC"
    };
    format!(" ORDER BY {column} {dir}")
}

#[must_use]
pub fn limit_offset(page: Option<i64>, size: Option<i64>) -> (i64, i64) {
    let page = page.unwrap_or(1).max(1);
    let size = match size {
        None => 15,
        Some(v) if v > 100 => 100,
        Some(v) if v < 1 => 1,
        Some(v) => v,
    };
    (size, (page - 1) * size)
}

/// `updateField` 白名单（Java `POINTS_EXCHANGE_FIELDS`）。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    UPDATE_FIELDS.contains(&column).then_some(column)
}

/// 列表查询（Java `PointsExchangeListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PointsExchangeListQuery {
    pub is_hot: Option<i32>,
    pub is_enabled: Option<i32>,
    pub product_name: Option<String>,
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl PointsExchangeListQuery {
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .or(self.product_name.as_deref())
            .filter(|s| !s.is_empty())
    }
}

/// 创建入参（Java `PointsExchangeCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PointsExchangeCreateDTO {
    pub product_id: Option<i32>,
    pub exchange_integral: Option<i32>,
    pub points_deducted_amount: Option<Decimal>,
    pub is_hot: Option<i32>,
    pub is_enabled: Option<i32>,
    pub sku_id: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PointsExchangeCreate {
    pub product_id: i32,
    pub exchange_integral: i32,
    pub points_deducted_amount: Decimal,
    pub is_hot: i32,
    pub is_enabled: i32,
    pub sku_id: Option<i32>,
}

impl PointsExchangeCreateDTO {
    pub fn validate(&self) -> Result<PointsExchangeCreate, String> {
        let product_id = self
            .product_id
            .ok_or_else(|| MSG_PRODUCT_REQUIRED.to_string())?;
        let exchange_integral = self.exchange_integral.unwrap_or(0);
        if exchange_integral <= 0 {
            return Err(MSG_INTEGRAL_INVALID.to_string());
        }
        Ok(PointsExchangeCreate {
            product_id,
            exchange_integral,
            points_deducted_amount: self.points_deducted_amount.unwrap_or(Decimal::ZERO),
            is_hot: self.is_hot.unwrap_or(0),
            is_enabled: self.is_enabled.unwrap_or(0),
            sku_id: self.sku_id,
        })
    }
}

/// 更新入参（Java `PointsExchangeUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PointsExchangeUpdateDTO {
    pub id: Option<i32>,
    pub product_id: Option<i32>,
    pub exchange_integral: Option<i32>,
    pub points_deducted_amount: Option<Decimal>,
    pub is_hot: Option<i32>,
    pub is_enabled: Option<i32>,
    pub sku_id: Option<i32>,
}

/// 校验后的更新参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PointsExchangeUpdate {
    pub id: i32,
    pub product_id: i32,
    pub exchange_integral: i32,
    pub points_deducted_amount: Option<Decimal>,
    pub is_hot: Option<i32>,
    pub is_enabled: Option<i32>,
    pub sku_id: Option<i32>,
}

impl PointsExchangeUpdateDTO {
    pub fn validate(&self) -> Result<PointsExchangeUpdate, String> {
        let id = self.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        let product_id = self
            .product_id
            .ok_or_else(|| MSG_PRODUCT_REQUIRED.to_string())?;
        let exchange_integral = self.exchange_integral.unwrap_or(0);
        if exchange_integral <= 0 {
            return Err(MSG_INTEGRAL_INVALID.to_string());
        }
        Ok(PointsExchangeUpdate {
            id,
            product_id,
            exchange_integral,
            points_deducted_amount: self.points_deducted_amount,
            is_hot: self.is_hot,
            is_enabled: self.is_enabled,
            sku_id: self.sku_id,
        })
    }
}

/// 删除入参（Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
    pub admin_note: Option<String>,
    pub page_type: Option<i32>,
}

impl OperateDTO {
    pub fn validate_id(&self) -> Result<i32, String> {
        self.id.ok_or_else(|| "id不能为空".to_string())
    }
}

/// 字段更新入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 校验后的字段更新。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldUpdate {
    pub id: i32,
    pub column: &'static str,
    pub val: String,
}

impl UpdateFieldDTO {
    pub fn validate(&self) -> Result<FieldUpdate, String> {
        let id = self.id.ok_or_else(|| "id不能为空".to_string())?;
        let field = self
            .field
            .as_deref()
            .ok_or_else(|| "字段名不能为空".to_string())?;
        let val = self
            .val
            .as_deref()
            .ok_or_else(|| "值不能为空".to_string())?;
        let column = resolve_update_field(field).ok_or_else(|| "field 的值有误".to_string())?;
        Ok(FieldUpdate {
            id,
            column,
            val: val.to_string(),
        })
    }
}

/// 批量操作入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 积分商品 VO（Java `PointsExchangeVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointsExchangeVO {
    pub id: i32,
    pub product_id: i32,
    pub exchange_integral: i32,
    pub points_deducted_amount: Decimal,
    pub is_hot: i32,
    pub is_enabled: i32,
    pub sku_id: Option<i32>,
    pub product_name: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub product_price: Option<Decimal>,
    pub discounts_price: Option<Decimal>,
    pub product_stock: Option<i32>,
    pub virtual_sales: Option<i32>,
    pub product_sn: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_validation_messages() {
        let dto = PointsExchangeCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_PRODUCT_REQUIRED);
        let dto = PointsExchangeCreateDTO {
            product_id: Some(3),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_INTEGRAL_INVALID);
        let dto = PointsExchangeCreateDTO {
            product_id: Some(3),
            exchange_integral: Some(10),
            points_deducted_amount: Some(Decimal::new(500, 2)),
            ..Default::default()
        };
        let input = dto.validate().unwrap();
        assert_eq!(input.product_id, 3);
        assert_eq!(input.exchange_integral, 10);
        assert_eq!(input.points_deducted_amount, Decimal::new(500, 2));
        assert_eq!(input.is_hot, 0);
    }

    #[test]
    fn update_validation_messages() {
        let dto = PointsExchangeUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        let dto = PointsExchangeUpdateDTO {
            id: Some(1),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_PRODUCT_REQUIRED);
        let dto = PointsExchangeUpdateDTO {
            id: Some(1),
            product_id: Some(2),
            exchange_integral: Some(-1),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_INTEGRAL_INVALID);
    }

    #[test]
    fn field_update_whitelist_and_sorting() {
        let dto = UpdateFieldDTO {
            id: Some(1),
            field: Some("isHot".into()),
            val: Some("1".into()),
        };
        assert_eq!(dto.validate().unwrap().column, "is_hot");
        assert_eq!(resolve_update_field("is_enabled"), Some("is_enabled"));
        assert_eq!(resolve_update_field("exchangeIntegral"), None);
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(2), Some(10)), (10, 10));
        assert_eq!(order_clause(None, None), " ORDER BY id DESC");
        assert_eq!(
            order_clause(Some("x; DROP TABLE points_exchange"), None),
            " ORDER BY id DESC"
        );
    }
}
