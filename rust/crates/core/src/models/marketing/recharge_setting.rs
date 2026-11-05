//! 充值余额配置域（marketing::recharge_setting）DTO / VO / 纯函数。
//! Java `RechargeSettingController`（7 端点）+ `RechargeSettingServiceImpl`。
//! 表 `recharge_setting`（5 列，主键 recharge_id）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

pub const COLUMNS: [&str; 5] = [
    "recharge_id",
    "money",
    "discount_money",
    "sort_order",
    "is_show",
];
pub const KEY_COLUMN: &str = "recharge_id";
pub const UPDATE_FIELDS: [&str; 4] = ["money", "discount_money", "sort_order", "is_show"];

pub const MSG_MONEY_REQUIRED: &str = "充值金额不能为空";
pub const MSG_DISCOUNT_REQUIRED: &str = "赠送金额不能为空";
pub const MSG_ID_REQUIRED: &str = "充值id不能为空";
pub const MSG_NEGATIVE: &str = "充值金额或赠送金额不能小于0";
pub const MSG_NOT_EXISTS: &str = "充值余额配置不存在";

#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "rechargeId" | "recharge_id" => "recharge_id",
        "money" => "money",
        "discountMoney" | "discount_money" => "discount_money",
        "sortOrder" | "sort_order" => "sort_order",
        "isShow" | "is_show" => "is_show",
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

#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    UPDATE_FIELDS.contains(&column).then_some(column)
}

/// 列表查询（Java `RechargeSettingListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RechargeSettingListQuery {
    pub is_show: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl RechargeSettingListQuery {
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
    /// Java 仅当 isShow ∈ {0,1} 时过滤。
    #[must_use]
    pub fn effective_is_show(&self) -> Option<i32> {
        self.is_show.filter(|v| *v == 0 || *v == 1)
    }
}

/// 创建入参（Java `RechargeSettingCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RechargeSettingCreateDTO {
    pub money: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub sort_order: Option<i32>,
    pub is_show: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RechargeSettingCreate {
    pub money: Decimal,
    pub discount_money: Decimal,
    pub sort_order: i32,
    pub is_show: i32,
}

impl RechargeSettingCreateDTO {
    pub fn validate(&self) -> Result<RechargeSettingCreate, String> {
        let money = self.money.ok_or_else(|| MSG_MONEY_REQUIRED.to_string())?;
        let discount_money = self
            .discount_money
            .ok_or_else(|| MSG_DISCOUNT_REQUIRED.to_string())?;
        if money < Decimal::ZERO || discount_money < Decimal::ZERO {
            return Err(MSG_NEGATIVE.to_string());
        }
        Ok(RechargeSettingCreate {
            money,
            discount_money,
            sort_order: self.sort_order.unwrap_or(0),
            is_show: self.is_show.unwrap_or(0),
        })
    }
}

/// 更新入参（Java `RechargeSettingUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RechargeSettingUpdateDTO {
    pub recharge_id: Option<i32>,
    pub money: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub sort_order: Option<i32>,
    pub is_show: Option<i32>,
}

/// 校验后的更新参数（金额 @NotNull）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RechargeSettingUpdate {
    pub recharge_id: i32,
    pub money: Decimal,
    pub discount_money: Decimal,
    pub sort_order: Option<i32>,
    pub is_show: Option<i32>,
}

impl RechargeSettingUpdateDTO {
    pub fn validate(&self) -> Result<RechargeSettingUpdate, String> {
        let recharge_id = self
            .recharge_id
            .ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        let money = self.money.ok_or_else(|| MSG_MONEY_REQUIRED.to_string())?;
        let discount_money = self
            .discount_money
            .ok_or_else(|| MSG_DISCOUNT_REQUIRED.to_string())?;
        Ok(RechargeSettingUpdate {
            recharge_id,
            money,
            discount_money,
            sort_order: self.sort_order,
            is_show: self.is_show,
        })
    }
}

/// 删除入参。
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

/// 批量入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 充值余额 VO（Java `RechargeSettingVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RechargeSettingVO {
    pub recharge_id: i32,
    pub money: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub sort_order: Option<i32>,
    pub is_show: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_validation() {
        let dto = RechargeSettingCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_MONEY_REQUIRED);
        let dto = RechargeSettingCreateDTO {
            money: Some(Decimal::new(100, 2)),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_DISCOUNT_REQUIRED);
        let dto = RechargeSettingCreateDTO {
            money: Some(Decimal::new(-1, 2)),
            discount_money: Some(Decimal::ZERO),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_NEGATIVE);
        let dto = RechargeSettingCreateDTO {
            money: Some(Decimal::new(10000, 2)),
            discount_money: Some(Decimal::new(500, 2)),
            sort_order: Some(2),
            is_show: Some(1),
        };
        let input = dto.validate().unwrap();
        assert_eq!(input.money, Decimal::new(10000, 2));
        assert_eq!(input.is_show, 1);
    }

    #[test]
    fn update_validation_and_field_whitelist() {
        let dto = RechargeSettingUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        let dto = RechargeSettingUpdateDTO {
            recharge_id: Some(1),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_MONEY_REQUIRED);
        for (field, column) in [
            ("money", "money"),
            ("discountMoney", "discount_money"),
            ("sortOrder", "sort_order"),
            ("is_show", "is_show"),
        ] {
            assert_eq!(resolve_update_field(field), Some(column));
        }
        assert_eq!(resolve_update_field("rechargeId"), None);
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(order_clause(None, None), " ORDER BY recharge_id DESC");
    }
}
