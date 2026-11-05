//! 分销商品域（marketing::salesman_product）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.salesman.SalesmanProduct`（表 `salesman_product`）
//! - `SalesmanProductSaveParam` / `SalesmanProductEditParam` /
//!   `SalesmanProductPageQuery` / `SalesmanProductAnalysisDTO`
//! - `SalesmanProductVO` / `SalesmanProductListVO` / `SalesmanProductDetailVO`
//! - 枚举 `SalesmanProductType` / `SalesmanProductCommissionTypeEnum`
//! - 常量 `SalesmanProductConstants`
//!
//! # 偏差（如实标注）
//!
//! - **列表 VO 简化**：Java `SalesmanProductListVO` 直接 copy 商品全部 ~70 个字段
//!   （含 `ProductListDTO` 继承的查询条件与 `ProductImage` 相册）；本实现保留
//!   商品核心字段 + 相册 + 分销配置（见 [`SalesmanProductListVO`]），其余字段
//!   不返回（前端管理列表主要使用核心字段 + 佣金配置）。
//! - **`decorate`/翻译注解**（`@JsonTranslate`）未迁移，原样返回库中文。
//! - **`SalesmanProductType.getAll()`** 仍返回全部 4 项（Java 同）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 分销商品 ID 不能为空（Java `SalesmanProductConstants.SALESMAN_PRODUCT_ID_NOT_NULL`）。
pub const MSG_SALESMAN_PRODUCT_ID_REQUIRED: &str = "分销商品id不能为空";
/// 商品 ID 不能为空（Java `SalesmanProductSaveParam.productId` 的 `@NotNull`）。
pub const MSG_PRODUCT_ID_REQUIRED: &str = "商品ID不能为空";
/// 未知的分销商品（Java `update` 的 `Assert.notNull`）。
pub const MSG_UNKNOWN_SALESMAN_PRODUCT: &str = "未知的分销商品";
/// 未找到匹配的等级（Java 客户端详情）。
pub const MSG_LEVEL_NOT_FOUND: &str = "未找到匹配的等级";

/// 分销商品类型：1 不参与推广的商品。
pub const TYPE_NOT_JOIN: i32 = 1;
/// 分销商品类型：2 自定义比例的商品。
pub const TYPE_CUSTOM_SCALE: i32 = 2;
/// 分销商品类型：3 参与推广的商品。
pub const TYPE_JOIN: i32 = 3;
/// 分销商品类型：4 自定义金额的商品。
pub const TYPE_CUSTOM_AMOUNT: i32 = 4;

/// 佣金方式：1 默认。
pub const COMMISSION_DEFAULT: i32 = 1;
/// 佣金方式：2 自定义比例。
pub const COMMISSION_CUSTOM_RATE: i32 = 2;
/// 佣金方式：3 自定义金额。
pub const COMMISSION_CUSTOM_PRICE: i32 = 3;

/// `SalesmanProductType.getAll()` 的等价映射（code → 描述）。
#[must_use]
pub fn product_type_map() -> Vec<(i32, &'static str)> {
    vec![
        (TYPE_NOT_JOIN, "不参与推广的商品"),
        (TYPE_CUSTOM_SCALE, "自定义比例的商品"),
        (TYPE_JOIN, "参与推广的商品"),
        (TYPE_CUSTOM_AMOUNT, "自定义金额的商品"),
    ]
}

/// 佣金等级数据（Java `SalesmanProductVO.CommissionData.LevelData`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommissionLevelData {
    pub level: Option<i32>,
    pub rate: Option<String>,
    pub down_salesman_rate: Option<String>,
}

/// 佣金数据（Java `SalesmanProductVO.CommissionData`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommissionData {
    pub level_arr: Option<Vec<CommissionLevelData>>,
}

/// 佣金规则文案（Java `SalesmanProductVO.ProductCommission`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductCommission {
    pub product_commission: String,
    pub sub_commission: String,
}

/// 分销商品配置 VO（Java `SalesmanProductVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanProductVO {
    pub salesman_product_id: Option<i32>,
    pub product_id: Option<i32>,
    pub is_join: Option<i32>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<Vec<CommissionData>>,
    pub add_time: Option<String>,
    pub update_time: Option<String>,
    pub shop_id: Option<i32>,
    pub product_commission: Option<ProductCommission>,
}

/// 商品图片（Java `SalesmanProductListVO.ProductImage`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductImageVO {
    pub pic_id: i32,
    pub product_id: i32,
    pub pic_url: String,
    pub pic_desc: String,
    pub pic_thumb: String,
    pub pic_original: String,
    pub pic_large: String,
    pub sort_order: i32,
}

/// 分销商品列表 VO（简化版，见模块头偏差）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanProductListVO {
    pub salesman_product_id: Option<i32>,
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_tsn: Option<String>,
    pub product_stock: i32,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub cost_price: Option<Decimal>,
    pub product_status: i32,
    pub product_type: Option<i32>,
    pub pic_url: String,
    pub pic_thumb: String,
    pub is_delete: i32,
    pub add_time: Option<i32>,
    pub update_time: Option<i32>,
    pub is_join: Option<i32>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<String>,
    pub pics: Vec<ProductImageVO>,
    pub salesman_product: Option<SalesmanProductVO>,
}

/// 客户端详情 VO（Java `SalesmanProductDetailVO` 的简化版）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanProductDetailVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_tsn: Option<String>,
    pub product_stock: i32,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub product_status: i32,
    pub product_type: Option<i32>,
    pub product_brief: String,
    pub product_desc: Option<String>,
    pub pic_url: String,
    pub pic_thumb: String,
    pub pic_original: String,
    pub pics: Vec<ProductImageVO>,
    pub salesman_product: Option<SalesmanProductVO>,
    /// 当前分销员等级的最终推广佣金（Java `finalCommissionPrice`）
    pub final_commission_price: String,
}

/// 列表查询（Java `SalesmanProductPageQuery extends ProductListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductPageQuery {
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub keyword: Option<String>,
    pub product_name: Option<String>,
    pub status: Option<i32>,
    pub salesman_product_type: Option<i32>,
    pub is_join: Option<i32>,
    pub user_id: Option<i32>,
    pub shop_id: Option<i32>,
}

impl SalesmanProductPageQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// 商品名（兼容 `keyword` / `productName`）。
    #[must_use]
    pub fn effective_name(&self) -> Option<&str> {
        self.product_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .or_else(|| {
                self.keyword
                    .as_deref()
                    .map(str::trim)
                    .filter(|s| !s.is_empty())
            })
    }
}

/// 商品成交分析参数（Java `SalesmanProductAnalysisDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductAnalysisQuery {
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub date_type: Option<i32>,
    /// 逗号分隔的起止时间（Java `startEndTime`）
    pub start_end_time: Option<String>,
}

impl SalesmanProductAnalysisQuery {
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// 解析起止时间（`yyyy-MM-dd HH:mm:ss,yyyy-MM-dd HH:mm:ss`）。
    ///
    /// Java `TigUtils.getDateRange` 支持多种 dateType；本实现只接受完整时间串，
    /// 解析失败 ⇒ 不限制时间范围（偏差已记录）。
    #[must_use]
    pub fn search_range(&self) -> (Option<i32>, Option<i32>) {
        let Some(raw) = self.start_end_time.as_deref() else {
            return (None, None);
        };
        let parts: Vec<&str> = raw.split(',').collect();
        let parse = |s: &str| crate::models::marketing::lottery_activity::parse_datetime(s).ok();
        match parts.len() {
            2 => (parse(parts[0]), parse(parts[1])),
            1 => (parse(parts[0]), parse(parts[0])),
            _ => (None, None),
        }
    }
}

/// 创建参数（Java `SalesmanProductSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductSaveParam {
    pub product_id: Option<i32>,
    pub is_join: Option<bool>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<Vec<CommissionData>>,
}

impl SalesmanProductSaveParam {
    /// `productId` 必填（Java `@NotNull`）。
    pub fn validate(&self) -> Result<i32, String> {
        self.product_id
            .ok_or_else(|| MSG_PRODUCT_ID_REQUIRED.to_string())
    }

    /// `commission_data` 序列化（Java `JSON.toJSONString`；空列表也序列化为 `null`）。
    #[must_use]
    pub fn commission_json(&self) -> String {
        match &self.commission_data {
            Some(data) if !data.is_empty() => {
                serde_json::to_string(data).unwrap_or_else(|_| "null".to_string())
            }
            _ => "null".to_string(),
        }
    }
}

/// 更新参数（Java `SalesmanProductEditParam extends SalesmanProductSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductEditParam {
    pub salesman_product_id: Option<i32>,
    pub product_id: Option<i32>,
    pub is_join: Option<bool>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<Vec<CommissionData>>,
}

impl SalesmanProductEditParam {
    /// 校验 `salesmanProductId`（Java `@NotNull`）+ 继承的 `productId`。
    pub fn validate(&self) -> Result<i32, String> {
        let id = self
            .salesman_product_id
            .ok_or_else(|| MSG_SALESMAN_PRODUCT_ID_REQUIRED.to_string())?;
        if self.product_id.is_none() {
            return Err(MSG_PRODUCT_ID_REQUIRED.to_string());
        }
        Ok(id)
    }

    #[must_use]
    pub fn commission_json(&self) -> String {
        match &self.commission_data {
            Some(data) if !data.is_empty() => {
                serde_json::to_string(data).unwrap_or_else(|_| "null".to_string())
            }
            _ => "null".to_string(),
        }
    }
}

/// 解析 `commission_data` JSON 文本（非法/`null` ⇒ None）。
#[must_use]
pub fn parse_commission_data(raw: Option<&str>) -> Option<Vec<CommissionData>> {
    let raw = raw?.trim();
    if raw.is_empty() || raw == "null" {
        return None;
    }
    serde_json::from_str(raw).ok()
}

/// 批量操作（Java `BatchDTO`）。
///
/// Java 来源：新版管理端前端 `view/admin/src/api/salesman/product.ts#batchSubmit`
/// （body `{ type, ids }`；仅 `type = "del"` 生效）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: String,
}

/// 佣金方式文案（Java `SalesmanProductCommissionTypeEnum`）。
#[must_use]
pub fn commission_type_text(commission_type: i32) -> &'static str {
    match commission_type {
        COMMISSION_DEFAULT => "默认",
        COMMISSION_CUSTOM_RATE => "自定义比例",
        COMMISSION_CUSTOM_PRICE => "自定义金额",
        _ => "",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_type_map_matches_java_enum() {
        let map = product_type_map();
        assert_eq!(map.len(), 4);
        assert_eq!(map[0], (1, "不参与推广的商品"));
        assert_eq!(map[2], (3, "参与推广的商品"));
        assert_eq!(commission_type_text(1), "默认");
        assert_eq!(commission_type_text(3), "自定义金额");
        assert_eq!(commission_type_text(9), "");
    }

    #[test]
    fn save_param_validation_and_commission_json() {
        let p = SalesmanProductSaveParam::default();
        assert_eq!(p.validate().unwrap_err(), "商品ID不能为空");
        let p = SalesmanProductSaveParam {
            product_id: Some(7),
            is_join: Some(true),
            commission_type: Some(1),
            commission_data: None,
        };
        assert_eq!(p.validate().unwrap(), 7);
        assert_eq!(p.commission_json(), "null");

        let data = vec![CommissionData {
            level_arr: Some(vec![CommissionLevelData {
                level: Some(1),
                rate: Some("10".into()),
                down_salesman_rate: Some("2".into()),
            }]),
        }];
        let p = SalesmanProductSaveParam {
            product_id: Some(7),
            commission_data: Some(data),
            ..Default::default()
        };
        let raw = p.commission_json();
        assert!(raw.contains("levelArr"));
        assert!(parse_commission_data(Some(&raw)).is_some());
        assert!(parse_commission_data(Some("null")).is_none());
        assert!(parse_commission_data(Some("not-json")).is_none());
    }

    #[test]
    fn edit_param_requires_both_ids() {
        let p = SalesmanProductEditParam::default();
        assert_eq!(p.validate().unwrap_err(), "分销商品id不能为空");
        let p = SalesmanProductEditParam {
            salesman_product_id: Some(3),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap_err(), "商品ID不能为空");
        let p = SalesmanProductEditParam {
            salesman_product_id: Some(3),
            product_id: Some(9),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap(), 3);
    }

    #[test]
    fn page_and_analysis_helpers() {
        let q = SalesmanProductPageQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.effective_name(), None);
        let q = SalesmanProductPageQuery {
            keyword: Some(" 手机 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_name(), Some("手机"));
        let q = SalesmanProductAnalysisQuery {
            start_end_time: Some("2024-12-01 00:00:00,2024-12-02 00:00:00".into()),
            ..Default::default()
        };
        let (start, end) = q.search_range();
        assert!(start.is_some() && end.is_some());
        assert!(q.limit_offset() == (15, 0));
    }
}
