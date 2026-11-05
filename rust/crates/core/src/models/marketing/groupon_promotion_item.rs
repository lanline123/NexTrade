//! 拼团活动商品（`marketing::groupon_promotion_item`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.promotion.GrouponPromotionItemController`
//!   （`@RequestMapping("/adminapi/promotion/groupon/item")`，8 个端点：
//!   `create` / `update` / `del` / `batch` / `detail` / `list` / `post` / `productList`）
//! - `com.tigshop.service.promotion.impl.GrouponPromotionItemServiceImpl`
//! - 入参：`PromotionPromotionItemCreateParam` / `PromotionPromotionItemUpdateParam`
//! - VO：`GrouponPromotionItemDetailVO` / `GrouponPromotionItemPageVO` /
//!   `GrouponProductVO` / `GrouponPostVO`
//! - 表：`groupon_promotion_item` / `groupon_promotion_detail`（SKU 拼团价）
//!
//! `group_num` / `group_price` 均为 JSON 数组列：
//! - `group_num`: `[{"groupNumKey":1,"groupNum":2}]`
//! - `group_price`: `[{"groupNumKey":1,"price":"9.90"}]`

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 未知拼团活动商品。
pub const MSG_UNKNOWN_ITEM: &str = "未知的拼团活动商品";
/// 未知拼团活动。
pub const MSG_UNKNOWN_PROMOTION: &str = "未知的拼团活动";
/// 商品已存在秒杀活动（Java `TimeDiscountConstants.PRODUCT_EXIST_SECKILL`）。
pub const MSG_EXIST_SECKILL: &str = "选择的商品已存在限时秒杀活动";
/// 商品已存在限时折扣活动。
pub const MSG_EXIST_TIME_DISCOUNT: &str = "选择的商品已存在限时折扣活动";
/// 时间段内已参与其他拼团。
pub const MSG_EXIST_OTHER_GROUPON: &str = "该商品在时间段内已参与其他拼团活动，不能重复绑定";
/// SKU 已禁用（Java `ProductSkuServiceImpl#checkSkuEnabled`）。
pub const MSG_SKU_DISABLED: &str = "商品规格已禁用，请重新选择";

/// 拼团类型：普通团。
pub const GROUP_TYPE_NORMAL: i32 = 1;
/// 拼团类型：阶梯团。
pub const GROUP_TYPE_LADDER: i32 = 2;

/// 创建入参（Java `PromotionPromotionItemCreateParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateParam {
    pub groupon_promotion_id: Option<i64>,
    pub product_id: Option<i64>,
    /// 1 普通团 / 2 阶梯团
    pub group_type: Option<i32>,
    /// 每单限购数量；0 不限购
    pub order_limit_num: Option<i32>,
    pub is_auto_group: Option<i32>,
    pub min_group_num: Option<i32>,
    pub min_group_price: Option<Decimal>,
    pub sort: Option<i32>,
    pub group_nums: Option<Vec<GrouponNumParam>>,
    pub groupon_promotion_details: Option<Vec<DetailParam>>,
}

impl CreateParam {
    /// Java `@Valid` 校验（逐字消息）。
    pub fn validate(&self) -> Result<(), String> {
        if self.groupon_promotion_id.unwrap_or(0) <= 0 {
            return Err("拼团活动 ID 不能为空".to_string());
        }
        if self.product_id.unwrap_or(0) <= 0 {
            return Err("商品ID不能为空".to_string());
        }
        if self.group_type.is_none() {
            return Err("拼团类型不能为空".to_string());
        }
        if self.order_limit_num.is_none() {
            return Err("每单限购数量不能为空".to_string());
        }
        if self.is_auto_group.is_none() {
            return Err("是否自动成团不能为空".to_string());
        }
        if self.min_group_num.is_none() {
            return Err("成团最低人数不能为空".to_string());
        }
        if self.group_nums.as_deref().unwrap_or_default().is_empty() {
            return Err("成团人数集合不能为空".to_string());
        }
        let details = self
            .groupon_promotion_details
            .as_deref()
            .unwrap_or_default();
        if details.is_empty() {
            return Err("拼团信息不能为空".to_string());
        }
        for d in details {
            if d.product_id.unwrap_or(0) <= 0 {
                return Err("商品ID不能为空".to_string());
            }
            if d.sku_id.unwrap_or(0) <= 0 {
                return Err("商品规格 id不能为空".to_string());
            }
            if d.limit_num.is_none() {
                return Err("可售数量不能为空".to_string());
            }
            if d.is_join.is_none() {
                return Err("是否参加不能为空".to_string());
            }
            if d.group_promotion_detail_prices
                .as_deref()
                .unwrap_or_default()
                .is_empty()
            {
                return Err("拼团价不能为空".to_string());
            }
        }
        Ok(())
    }
}

/// 更新入参（Java `PromotionPromotionItemUpdateParam` = 创建参数 + 主键）。
///
/// > 注：`flatten` 与容器级 `default` 不能共存，故此处只保留 camelCase；
/// > 缺失的 `Option` 字段由 serde 的 `Option` 缺省语义处理（等价 Java null）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateParam {
    pub groupon_promotion_item_id: Option<i64>,
    #[serde(flatten)]
    pub base: CreateParam,
}

/// 成团人数项（Java `GrouponNumParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponNumParam {
    pub group_num_key: Option<i32>,
    pub group_num: Option<i32>,
}

/// 拼团明细入参（Java `GrouponPromotionDetailParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetailParam {
    pub groupon_detail_id: Option<i64>,
    pub product_id: Option<i64>,
    pub sku_id: Option<i64>,
    pub limit_num: Option<i32>,
    pub is_join: Option<i32>,
    pub group_promotion_detail_prices: Option<Vec<PriceParam>>,
}

/// 拼团价入参（Java `GrouponPromotionDetailPriceParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PriceParam {
    pub group_num_key: Option<i32>,
    pub price: Option<Decimal>,
}

/// 批量操作入参（拼团商品主键为 i64，故本地定义而非复用 `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ItemBatchParam {
    pub ids: Option<Vec<i64>>,
    pub r#type: Option<String>,
}

/// 商品列表查询（Java `GrouponPromotionItemPageQuery` + BasePage）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ItemPageQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub groupon_promotion_id: Option<i64>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_group_id: Option<i32>,
    pub brand_id: Option<i32>,
    pub keyword: Option<String>,
}

impl ItemPageQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }

    /// 排序白名单（Java `buildSortOrder`；未知回退主键）。
    #[must_use]
    pub fn sort_column(&self) -> &'static str {
        match self.sort_field.as_deref().map(str::trim) {
            Some("sort") => "gi.sort",
            Some("productName") => "p.product_name",
            Some("productSn") => "p.product_sn",
            Some("productPrice") => "p.product_price",
            _ => "gi.groupon_promotion_item_id",
        }
    }
}

/// 可选商品查询（Java `GrouponProductPageQuery` + BasePage）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPageQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub groupon_promotion_id: Option<i64>,
    pub product_name: Option<String>,
    pub brand_id: Option<i32>,
}

impl ProductPageQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }

    #[must_use]
    pub fn sort_column(&self) -> &'static str {
        match self.sort_field.as_deref().map(str::trim) {
            Some("productPrice") => "product_price",
            Some("productStock") => "product_stock",
            _ => "product_id",
        }
    }
}

/// 成团人数 VO（Java `GrouponNumVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponNumVO {
    pub group_num_key: Option<i32>,
    pub group_num: Option<i32>,
}

/// 拼团价 VO（Java `GrouponPromotionDetailPriceVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetailPriceVO {
    pub group_num_key: Option<i32>,
    pub price: Option<Decimal>,
}

/// SKU 简版（Java `ProductSkuDTO` 的核心字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkuLite {
    pub sku_id: i32,
    pub product_id: i32,
    pub sku_value: String,
    pub sku_data: Option<String>,
    pub sku_sn: Option<String>,
    pub sku_stock: Option<i32>,
    pub sku_price: Option<Decimal>,
    pub is_enabled: i32,
}

impl SkuLite {
    #[must_use]
    pub fn from_entity(s: &crate::entities::ProductSku) -> Self {
        Self {
            sku_id: s.sku_id,
            product_id: s.product_id,
            sku_value: s.sku_value.clone(),
            sku_data: s.sku_data.clone(),
            sku_sn: s.sku_sn.clone(),
            sku_stock: s.sku_stock,
            sku_price: s.sku_price,
            is_enabled: s.is_enabled,
        }
    }
}

/// 拼团明细 VO（Java `GrouponPromotionDetailVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetailVO {
    pub groupon_detail_id: i64,
    pub product_id: i64,
    pub sku_id: i64,
    pub product_sku: Option<SkuLite>,
    pub limit_num: i32,
    pub is_join: i32,
    pub group_promotion_detail_prices: Vec<DetailPriceVO>,
}

/// 商品详情 VO（Java `GrouponPromotionItemDetailVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ItemDetailVO {
    pub groupon_promotion_item_id: i64,
    pub groupon_promotion_id: i64,
    pub product_id: i64,
    pub product_skus: Vec<SkuLite>,
    pub product_price: Decimal,
    pub product_stock: i32,
    pub group_type: i32,
    pub order_limit_num: i32,
    pub is_auto_group: i32,
    pub min_group_num: i32,
    pub sort: i32,
    pub group_nums: Vec<GrouponNumVO>,
    pub groupon_promotion_details: Vec<DetailVO>,
}

/// 商品列表 VO（Java `GrouponPromotionItemPageVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ItemPageVO {
    pub groupon_promotion_item_id: i64,
    pub product_id: i64,
    /// 原始成团人数 JSON（Java 字段 `groupNum: String`）
    pub group_num: String,
    pub sort: i32,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_large: Option<String>,
    pub pic_url: Option<String>,
    pub product_price: Option<Decimal>,
    pub min_group_price: Option<Decimal>,
    pub max_group_price: Option<Decimal>,
    pub min_group_num: Option<i32>,
    pub max_group_num: Option<i32>,
    pub min_limit_num: Option<i32>,
    pub max_limit_num: Option<i32>,
    pub product_brief: Option<String>,
}

/// 推广信息 VO（Java `GrouponPostVO`；Java 实现恒返回 null）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPostVO {
    pub promotion_name: Option<String>,
    pub promotion_type: Option<String>,
    pub promotion_pic_url: Option<String>,
    pub wechat_short_link: Option<String>,
    pub short_link: Option<String>,
    pub original_link: Option<String>,
    pub promotion_brief: Option<String>,
    pub promotion_date_time: Option<String>,
    pub mini_code: Option<String>,
}

/// 商品简版（可选商品列表 `Product` 的展示字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductLite {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub pic_thumb: String,
    pub pic_large: String,
    pub pic_url: String,
    pub product_price: Decimal,
    pub product_stock: i32,
    pub product_brief: String,
    pub brand_id: i32,
    pub shop_id: i32,
    pub product_type: Option<i32>,
    pub sale_mode: i32,
}

impl ProductLite {
    #[must_use]
    pub fn from_entity(p: &crate::entities::Product) -> Self {
        Self {
            product_id: p.product_id,
            product_name: p.product_name.clone(),
            product_sn: p.product_sn.clone(),
            pic_thumb: p.pic_thumb.clone(),
            pic_large: p.pic_large.clone(),
            pic_url: p.pic_url.clone(),
            product_price: p.product_price,
            product_stock: p.product_stock,
            product_brief: p.product_brief.clone(),
            brand_id: p.brand_id,
            shop_id: p.shop_id,
            product_type: p.product_type,
            sale_mode: p.sale_mode,
        }
    }
}

/// 可选商品列表 VO（Java `GrouponProductVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponProductVO {
    pub product: Option<ProductLite>,
    pub product_skus: Vec<SkuLite>,
    /// 是否已加入当前拼团活动
    pub is_added: bool,
    /// 是否已参加其它拼团活动
    pub is_other_groupon_product: bool,
    /// 是否预约商品（`product_type` 5/6）
    pub is_reservation_product: bool,
    /// 是否预售商品（`sale_mode` 1/2）
    pub is_presale_product: bool,
    /// 是否正在秒杀
    pub is_seckill_product: bool,
    /// 是否正在限时折扣
    pub is_time_discount_product: bool,
}

// ————————————————————— JSON 构建/解析（可单测） —————————————————————

/// 成团人数 → `group_num` JSON（Java `JSONArray.toJSONString(groupNums)`）。
#[must_use]
pub fn build_group_num_json(items: &[GrouponNumParam]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

/// 拼团价 → `group_price` JSON（Java `JSONArray.toJSONString(prices)`）。
#[must_use]
pub fn build_group_price_json(items: &[PriceParam]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

/// 解析 `group_price` JSON（兼容非法/空 → 空表）。
#[must_use]
pub fn parse_price_json(raw: &str) -> Vec<DetailPriceVO> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// 解析 `group_num` JSON。
#[must_use]
pub fn parse_group_num_json(raw: &str) -> Vec<GrouponNumVO> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// 列表 VO 的聚合计算（Java `GrouponPromotionItemPageVO#assembleData`）：
/// 返回 `(min_group_price, max_group_price, min_group_num, max_group_num,
/// min_limit_num, max_limit_num)`。
#[must_use]
pub fn assemble_ranges(
    details: &[DetailVO],
) -> (
    Option<Decimal>,
    Option<Decimal>,
    Option<i32>,
    Option<i32>,
    Option<i32>,
    Option<i32>,
) {
    let prices: Vec<Decimal> = details
        .iter()
        .flat_map(|d| d.group_promotion_detail_prices.iter())
        .filter_map(|p| p.price)
        .collect();
    let min_price = prices.iter().copied().min();
    let max_price = prices.iter().copied().max();
    let min_limit = details.iter().map(|d| d.limit_num).min();
    let max_limit = details.iter().map(|d| d.limit_num).max();
    (min_price, max_price, None, None, min_limit, max_limit)
}

/// 成团人数 min/max（Java `assembleData` 中 groupNums 部分）。
#[must_use]
pub fn group_num_range(nums: &[GrouponNumVO]) -> (Option<i32>, Option<i32>) {
    let values: Vec<i32> = nums.iter().filter_map(|n| n.group_num).collect();
    (values.iter().copied().min(), values.iter().copied().max())
}

/// 是否预约商品（Java `isReservationProduct`：`product_type` 5/6）。
#[must_use]
pub fn is_reservation_product(product_type: Option<i32>) -> bool {
    matches!(product_type, Some(5) | Some(6))
}

/// 是否预售商品（Java `sale_mode` 1/2）。
#[must_use]
pub fn is_presale_product(sale_mode: i32) -> bool {
    (1..=2).contains(&sale_mode)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn create_param_validation_is_verbatim() {
        let mut p = CreateParam::default();
        assert_eq!(p.validate().unwrap_err(), "拼团活动 ID 不能为空");
        p.groupon_promotion_id = Some(1);
        assert_eq!(p.validate().unwrap_err(), "商品ID不能为空");
        p.product_id = Some(9);
        assert_eq!(p.validate().unwrap_err(), "拼团类型不能为空");
        p.group_type = Some(1);
        assert_eq!(p.validate().unwrap_err(), "每单限购数量不能为空");
        p.order_limit_num = Some(0);
        assert_eq!(p.validate().unwrap_err(), "是否自动成团不能为空");
        p.is_auto_group = Some(0);
        assert_eq!(p.validate().unwrap_err(), "成团最低人数不能为空");
        p.min_group_num = Some(2);
        assert_eq!(p.validate().unwrap_err(), "成团人数集合不能为空");
        p.group_nums = Some(vec![GrouponNumParam {
            group_num_key: Some(1),
            group_num: Some(2),
        }]);
        assert_eq!(p.validate().unwrap_err(), "拼团信息不能为空");
        p.groupon_promotion_details = Some(vec![DetailParam {
            product_id: Some(9),
            sku_id: Some(0),
            limit_num: Some(10),
            is_join: Some(1),
            group_promotion_detail_prices: Some(vec![PriceParam {
                group_num_key: Some(1),
                price: Some(Decimal::new(990, 2)),
            }]),
            ..Default::default()
        }]);
        assert_eq!(p.validate().unwrap_err(), "商品规格 id不能为空");
        p.groupon_promotion_details = Some(vec![DetailParam {
            product_id: Some(9),
            sku_id: Some(3),
            limit_num: Some(10),
            is_join: Some(1),
            group_promotion_detail_prices: Some(vec![PriceParam {
                group_num_key: Some(1),
                price: Some(Decimal::new(990, 2)),
            }]),
            ..Default::default()
        }]);
        assert!(p.validate().is_ok());
    }

    #[test]
    fn json_builders_and_parsers_roundtrip() {
        let nums = vec![GrouponNumParam {
            group_num_key: Some(1),
            group_num: Some(2),
        }];
        let json = build_group_num_json(&nums);
        assert!(json.contains("groupNumKey"));
        let parsed = parse_group_num_json(&json);
        assert_eq!(parsed[0].group_num, Some(2));

        let prices = vec![PriceParam {
            group_num_key: Some(1),
            price: Some(Decimal::from_str("9.90").unwrap()),
        }];
        let json = build_group_price_json(&prices);
        let parsed = parse_price_json(&json);
        assert_eq!(parsed[0].price, Some(Decimal::from_str("9.90").unwrap()));
        assert!(parse_price_json("not-json").is_empty());
        assert!(parse_group_num_json("").is_empty());
    }

    #[test]
    fn assemble_ranges_and_flags_match_java() {
        let details = vec![
            DetailVO {
                limit_num: 10,
                group_promotion_detail_prices: vec![DetailPriceVO {
                    group_num_key: Some(1),
                    price: Some(Decimal::from_str("9.90").unwrap()),
                }],
                ..Default::default()
            },
            DetailVO {
                limit_num: 5,
                group_promotion_detail_prices: vec![DetailPriceVO {
                    group_num_key: Some(1),
                    price: Some(Decimal::from_str("8.80").unwrap()),
                }],
                ..Default::default()
            },
        ];
        let (min_p, max_p, _, _, min_l, max_l) = assemble_ranges(&details);
        assert_eq!(min_p, Some(Decimal::from_str("8.80").unwrap()));
        assert_eq!(max_p, Some(Decimal::from_str("9.90").unwrap()));
        assert_eq!(min_l, Some(5));
        assert_eq!(max_l, Some(10));
        let (min_n, max_n) = group_num_range(&[
            GrouponNumVO {
                group_num: Some(5),
                ..Default::default()
            },
            GrouponNumVO {
                group_num: Some(2),
                ..Default::default()
            },
        ]);
        assert_eq!((min_n, max_n), (Some(2), Some(5)));
        assert!(is_reservation_product(Some(5)));
        assert!(is_reservation_product(Some(6)));
        assert!(!is_reservation_product(Some(1)));
        assert!(is_presale_product(1));
        assert!(is_presale_product(2));
        assert!(!is_presale_product(0));
    }

    #[test]
    fn page_query_sort_whitelist() {
        let q = ItemPageQuery {
            sort_field: Some("sort".into()),
            ..Default::default()
        };
        assert_eq!(q.sort_column(), "gi.sort");
        let q = ItemPageQuery {
            sort_field: Some("1; DROP TABLE".into()),
            ..Default::default()
        };
        assert_eq!(q.sort_column(), "gi.groupon_promotion_item_id");
        assert!(ItemPageQuery::default().ascending() == false);
        let mut q = ProductPageQuery::default();
        q.sort_order = Some("ASC".into());
        assert!(q.ascending());
    }
}
