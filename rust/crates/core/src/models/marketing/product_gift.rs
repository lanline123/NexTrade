//! 活动赠品域（marketing::product_gift）DTO / VO / 纯函数。
//! Java `ProductGiftController`（7 端点，admin）+ `ProductGiftServiceImpl`。
//! 表 `product_gift`（6 列，主键 gift_id）。

use serde::{Deserialize, Serialize};

pub const COLUMNS: [&str; 6] = [
    "gift_id",
    "gift_name",
    "gift_stock",
    "product_id",
    "sku_id",
    "shop_id",
];
pub const KEY_COLUMN: &str = "gift_id";
/// Java `GENERAL_FIELDS`（本表无这些列 ⇒ updateField 恒「field 的值有误」）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

pub const MSG_GIFT_NAME_REQUIRED: &str = "活动赠品名称不能为空";
pub const MSG_GIFT_NAME_TOO_LONG: &str = "活动赠品名称长度不能超过100";
pub const MSG_ID_REQUIRED: &str = "活动赠品id不能为空";
pub const MSG_STOCK_REQUIRED: &str = "赠品库存必须大于0";
pub const MSG_PRODUCT_REQUIRED: &str = "请选择商品";
pub const MSG_PRODUCT_EXISTS: &str = "商品已存在";
pub const MSG_STOCK_EXCEED_PRODUCT: &str = "赠品库存不能超过商品库存";
pub const MSG_STOCK_EXCEED_SKU: &str = "赠品库存不能超过商品规格库存";
pub const MSG_GIFT_CARD_ECARD: &str = "礼品卡电子卡不允许作为赠品";
pub const MSG_SKU_DISABLED: &str = "商品规格已禁用，请重新选择";
pub const MSG_NOT_EXISTS: &str = "活动赠品不存在";

#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "giftId" | "gift_id" => "gift_id",
        "giftName" | "gift_name" => "gift_name",
        "giftStock" | "gift_stock" => "gift_stock",
        "productId" | "product_id" => "product_id",
        "skuId" | "sku_id" => "sku_id",
        "shopId" | "shop_id" => "shop_id",
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

/// `updateField` 白名单：GENERAL_FIELDS 列在本表均不存在 ⇒ 恒 `None`。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    GENERAL_FIELDS.contains(&column).then_some(column)
}

/// 列表查询（Java `ProductGiftListDTO extends BasePage`，仅 keyword）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGiftListQuery {
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl ProductGiftListQuery {
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
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }
}

/// 创建入参（Java `ProductGiftCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGiftCreateDTO {
    pub gift_name: Option<String>,
    pub gift_stock: Option<i32>,
    pub product_id: Option<i32>,
    pub sku_id: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductGiftCreate {
    pub gift_name: String,
    pub gift_stock: i32,
    pub product_id: i32,
    pub sku_id: Option<i32>,
}

impl ProductGiftCreateDTO {
    pub fn validate(&self) -> Result<ProductGiftCreate, String> {
        let name = self
            .gift_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| MSG_GIFT_NAME_REQUIRED.to_string())?;
        if name.chars().count() > 100 {
            return Err(MSG_GIFT_NAME_TOO_LONG.to_string());
        }
        let gift_stock = self.gift_stock.unwrap_or(0);
        if gift_stock < 1 {
            return Err(MSG_STOCK_REQUIRED.to_string());
        }
        let product_id = self
            .product_id
            .ok_or_else(|| MSG_PRODUCT_REQUIRED.to_string())?;
        if product_id < 1 {
            return Err(MSG_PRODUCT_REQUIRED.to_string());
        }
        Ok(ProductGiftCreate {
            gift_name: name.to_string(),
            gift_stock,
            product_id,
            sku_id: self.sku_id,
        })
    }
}

/// 更新入参（Java `ProductGiftUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGiftUpdateDTO {
    pub gift_id: Option<i32>,
    pub gift_name: Option<String>,
    pub gift_stock: Option<i32>,
    pub product_id: Option<i32>,
    pub sku_id: Option<i32>,
}

/// 校验后的更新参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductGiftUpdate {
    pub gift_id: i32,
    pub gift_name: Option<String>,
    pub gift_stock: Option<i32>,
    pub product_id: Option<i32>,
    pub sku_id: Option<i32>,
}

impl ProductGiftUpdateDTO {
    pub fn validate(&self) -> Result<ProductGiftUpdate, String> {
        let gift_id = self.gift_id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        if let Some(stock) = self.gift_stock {
            if stock < 1 {
                return Err(MSG_STOCK_REQUIRED.to_string());
            }
        }
        Ok(ProductGiftUpdate {
            gift_id,
            gift_name: self.gift_name.clone(),
            gift_stock: self.gift_stock,
            product_id: self.product_id,
            sku_id: self.sku_id,
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

impl UpdateFieldDTO {
    pub fn validate(&self) -> Result<(&'static str, i32, String), String> {
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
        Ok((column, id, val.to_string()))
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

/// 活动赠品 VO（Java `ProductGiftVO`，productInfo/skuInfo 为商品实体）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductGiftVO {
    pub gift_id: i32,
    pub gift_name: String,
    pub gift_stock: i32,
    pub product_id: i32,
    pub sku_id: i32,
    pub shop_id: i32,
    pub product_info: Option<serde_json::Value>,
    pub sku_info: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_validation_messages() {
        let dto = ProductGiftCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_GIFT_NAME_REQUIRED);
        let dto = ProductGiftCreateDTO {
            gift_name: Some("x".repeat(101)),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_GIFT_NAME_TOO_LONG);
        let dto = ProductGiftCreateDTO {
            gift_name: Some("赠品".into()),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_STOCK_REQUIRED);
        let dto = ProductGiftCreateDTO {
            gift_name: Some("赠品".into()),
            gift_stock: Some(0),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_STOCK_REQUIRED);
        let dto = ProductGiftCreateDTO {
            gift_name: Some("赠品".into()),
            gift_stock: Some(5),
            product_id: Some(0),
            sku_id: None,
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_PRODUCT_REQUIRED);
        let dto = ProductGiftCreateDTO {
            gift_name: Some("赠品".into()),
            gift_stock: Some(5),
            product_id: Some(3),
            sku_id: Some(9),
        };
        let input = dto.validate().unwrap();
        assert_eq!(input.product_id, 3);
        assert_eq!(input.gift_stock, 5);
    }

    #[test]
    fn update_validation() {
        let dto = ProductGiftUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        let dto = ProductGiftUpdateDTO {
            gift_id: Some(1),
            gift_stock: Some(0),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_STOCK_REQUIRED);
        let dto = ProductGiftUpdateDTO {
            gift_id: Some(1),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap().gift_id, 1);
    }

    #[test]
    fn update_field_all_invalid_and_sorting() {
        for field in ["is_show", "sort_order", "status", "giftId", "nope"] {
            let dto = UpdateFieldDTO {
                id: Some(1),
                field: Some(field.into()),
                val: Some("1".into()),
            };
            assert_eq!(dto.validate().unwrap_err(), "field 的值有误", "{field}");
        }
        assert_eq!(resolve_update_field("any"), None);
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(order_clause(None, None), " ORDER BY gift_id DESC");
        assert_eq!(
            order_clause(Some("giftStock"), Some("asc")),
            " ORDER BY gift_stock ASC"
        );
    }
}
