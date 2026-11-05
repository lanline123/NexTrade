//! 秒杀批处理 / 装修预览域（marketing::seckill_batch）DTO / VO / 纯逻辑。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.SeckillController` 的
//! 3 个端点（`@RequestMapping("/adminapi/promotion/seckill")`）：
//! - `POST /batch` → `SeckillServiceImpl#batch(BatchDTO)`：`type=del` 级联删除
//!   `seckill` + `seckill_item` + `promotion(type=1)`
//! - `GET /listForDecorate` → `SeckillServiceImpl#listForDecorate`：
//!   装修用「进行中」秒杀商品列表（不分页，返回 `List<SeckillPromotionVO>`）
//! - `GET /listForHomePreview` → 复用 C 端首页 `getSeckillProductList(size,
//!   page, unStarted=0)`，返回 `Page<SeckillListVO>`
//!
//! 表复用既有 `seckill` / `seckill_item` / `promotion`（schema 已生成）。
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. Java `listForDecorate` 先取「进行中」`seckill` 活动、再按活动商品聚合
//!    商品/规格/店铺/品牌等完整信息（`SeckillPromotionVO` 30+ 字段）；
//!    Rust 直接取「进行中且有库存」的 `seckill_item`，VO 精简为
//!    `seckillId/productId/productName/skuId/seckillPrice/seckillStock/
//!    seckillSales/seckillStartTime/seckillEndTime/seckillLimitNum`，
//!    商品名从 `product.product_name` 回填。
//! 2. Java `listForHomePreview` 调 C 端 `getSeckillProductList`（含上架过滤、
//!    排序、`unStarted=0`）；Rust 复用同一 `seckill_item` 进行中窗口查询，
//!    分页默认 `page=1,size=15`（与 Java 控制器默认值一致）。
//! 3. Java `batch` 仅在 `isMove=true` 时执行后续两步删除；Rust 在
//!    活动不存在（`rows_affected=0`）时跳过级联（等价保护）。
//!
//! # 金额：`seckill_price` 为 `Decimal`（JSON 字符串）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// `promotion.type`：秒杀（Java `PromotionType.TYPE_SECKILL` = 1）。
pub const PROMOTION_TYPE_SECKILL: i32 = 1;

/// 注解文案（Java `BatchDTO` `@NotEmpty` / `@NotNull`，逐字）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
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

/// 校验批量入参（Java 控制器 `@Valid` 注解文案）。
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

/// 装修预览 VO（Java `SeckillPromotionVO` 精简版）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeckillPromotionVO {
    pub seckill_id: i32,
    pub product_id: i32,
    pub product_name: Option<String>,
    pub sku_id: i32,
    pub seckill_price: Option<Decimal>,
    pub seckill_stock: Option<i32>,
    pub seckill_sales: Option<i32>,
    pub seckill_start_time: Option<i32>,
    pub seckill_end_time: Option<i32>,
    pub seckill_limit_num: Option<i32>,
}

/// 首页预览 VO（Java `SeckillListVO` 精简版，字段同装修预览）。
pub type SeckillListVO = SeckillPromotionVO;

/// 首页预览查询（Java 控制器 `size` / `page` 参数，默认 15 / 1）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HomePreviewQuery {
    pub page: Option<u64>,
    #[serde(rename = "size", alias = "pageSize")]
    pub size: Option<u64>,
}

/// 百分号 LIKE 包装（关键词过滤用）。
#[must_use]
pub fn like_pattern(keyword: &str) -> String {
    format!("%{}%", keyword.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_validation_texts_are_verbatim() {
        let empty = BatchDTO::default();
        assert_eq!(validate_batch(&empty).unwrap_err(), "未选择项目");
        let no_type = BatchDTO {
            ids: Some(vec![1]),
            ..Default::default()
        };
        assert_eq!(validate_batch(&no_type).unwrap_err(), "操作类型不能为空");
        let ok = BatchDTO {
            ids: Some(vec![1, 2]),
            r#type: Some("del".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_batch(&ok).unwrap(),
            (vec![1, 2], "del".to_string())
        );
    }

    #[test]
    fn delete_gate_and_promotion_type() {
        assert!(is_delete(&BatchDTO {
            r#type: Some("del".into()),
            ..Default::default()
        }));
        assert!(!is_delete(&BatchDTO {
            r#type: Some("Del".into()),
            ..Default::default()
        }));
        assert_eq!(PROMOTION_TYPE_SECKILL, 1);
    }

    #[test]
    fn home_preview_defaults_and_like() {
        let q = HomePreviewQuery::default();
        assert_eq!(q.page.unwrap_or(1), 1);
        assert_eq!(q.size.unwrap_or(15), 15);
        assert_eq!(like_pattern(" 秒杀 "), "%秒杀%");
    }

    #[test]
    fn vo_serializes_camel_case_money_as_string() {
        let vo = SeckillPromotionVO {
            seckill_id: 3,
            product_id: 9,
            sku_id: 5,
            seckill_price: Some("9.90".parse().unwrap()),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["seckillId"], 3);
        assert_eq!(json["seckillPrice"], "9.90");
        assert_eq!(json["productId"], 9);
    }
}
