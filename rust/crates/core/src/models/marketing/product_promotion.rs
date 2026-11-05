//! 商品促销（`marketing::product_promotion`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.promotion.ProductPromotionController`
//!   （`@RequestMapping("/adminapi/promotion/productPromotion")`，9 个端点：
//!   `list` / `detail` / `create` / `update` / `del` / `updateField` / `batch` /
//!   `config` / `conflict`）
//! - `com.tigshop.service.promotion.impl.ProductPromotionServiceImpl`
//! - DTO：`ProductPromotionDTO` / `ProductPromotionListDTO`；Query：`ConflictPageQuery`
//! - VO：`ProductPromotionVO` / `ConflictPageVO` / `ProductPromotionConfigVO`
//! - 枚举：`ProductPromotionTypeEnum`（1满减/2满折/3赠品）、`PromotionTimeStatusEnum`
//!   （1活动进行中/2活动已结束/3活动未开始）、`PromotionRangeEnum`（0全部/3指定商品/4不含商品）
//!
//! 金额 `rust_decimal::Decimal`；表内时间为秒级时间戳（`i32`），对外 VO 输出
//! `yyyy-MM-dd HH:mm:ss` 字符串（Java `DateUtil.format`）。

use std::collections::BTreeMap;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 活动类型：满减。
pub const PROMOTION_TYPE_FULL_REDUCE: i32 = 1;
/// 活动类型：满折。
pub const PROMOTION_TYPE_FULL_DISCOUNT: i32 = 2;
/// 活动类型：满赠。
pub const PROMOTION_TYPE_FULL_GIVE: i32 = 3;

/// `promotion` 表类型：满减（Java `PromotionType.TYPE_REDUCE`）。
pub const GAIN_TYPE_REDUCE: i32 = 3;
/// `promotion` 表类型：满折（Java `PromotionType.TYPE_DISCOUNT`）。
pub const GAIN_TYPE_DISCOUNT: i32 = 4;
/// `promotion` 表类型：满赠（Java `PromotionType.TYPE_GIVE`）。
pub const GAIN_TYPE_GIVE: i32 = 5;

/// 活动范围：全部商品。
pub const RANGE_ALL: i32 = 0;
/// 活动范围：指定商品。
pub const RANGE_PRODUCT: i32 = 3;
/// 活动范围：指定商品不参与。
pub const RANGE_EXCLUDE_PRODUCT: i32 = 4;

/// 时间状态：活动进行中。
pub const TIME_STATUS_ON: i32 = 1;
/// 时间状态：活动已结束。
pub const TIME_STATUS_OFF: i32 = 2;
/// 时间状态：活动未开始。
pub const TIME_STATUS_FORTHCOMING: i32 = 3;

/// 冲突活动业务码（Java `HttpStatus.EXIST_CONFLICT_PROMOTION_ERROR`）。
pub const EXIST_CONFLICT_PROMOTION_ERROR: i32 = 5001;
/// 冲突活动提示（Java `ProductPromotionConstants.EXIST_CONFLICT_PROMOTION`）。
pub const EXIST_CONFLICT_PROMOTION: &str = "存在冲突活动，请重新设置活动";

/// 名称必填。
pub const PROMOTION_NAME_NOT_NULL: &str = "满减活动名称不能为空";
/// 名称超长。
pub const PROMOTION_NAME_OVER_LENGTH: &str = "满减活动名称长度不能超过50";
/// ID 必填。
pub const PRODUCT_PROMOTION_ID_NOT_NULL: &str = "满减活动id不能为空";
/// 类型错误。
pub const PRODUCT_PROMOTION_TYPE_ERROR: &str = "类型错误";
/// 删除：id 错误。
pub const DEL_ID_ERROR: &str = "id错误";
/// 删除：活动不存在。
pub const PROMOTION_NOT_EXISTS: &str = "优惠活动不存在";
/// 删除：启用中不可删除。
pub const CANNOT_DELETE_WHILE_ENABLED: &str = "请先停用该活动，再删除";
/// 字段值非法（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const INVALID_FIELD_VALUE: &str = "field 的值有误";
/// `updateField` 白名单（Java `CheckFieldConstants.PRODUCT_PROMOTION_FIELDS`）。
pub const PRODUCT_PROMOTION_FIELDS: [&str; 2] = ["is_available", "sort_order"];

/// 活动类型文案（Java `ProductPromotionTypeEnum.getTypeName`）。
#[must_use]
pub fn promotion_type_name(promotion_type: i32) -> &'static str {
    match promotion_type {
        PROMOTION_TYPE_FULL_REDUCE => "满减",
        PROMOTION_TYPE_FULL_DISCOUNT => "满折",
        PROMOTION_TYPE_FULL_GIVE => "赠品",
        _ => "",
    }
}

/// 商品促销类型 → `promotion` 表类型（Java `gainType`，未知 → 「类型错误」）。
pub fn gain_type(promotion_type: i32) -> Result<i32, String> {
    match promotion_type {
        PROMOTION_TYPE_FULL_REDUCE => Ok(GAIN_TYPE_REDUCE),
        PROMOTION_TYPE_FULL_DISCOUNT => Ok(GAIN_TYPE_DISCOUNT),
        PROMOTION_TYPE_FULL_GIVE => Ok(GAIN_TYPE_GIVE),
        _ => Err(PRODUCT_PROMOTION_TYPE_ERROR.to_string()),
    }
}

/// 时间状态文案（Java `PromotionTimeStatusEnum`）。
#[must_use]
pub fn time_status_name(code: i32) -> &'static str {
    match code {
        TIME_STATUS_ON => "活动进行中",
        TIME_STATUS_OFF => "活动已结束",
        TIME_STATUS_FORTHCOMING => "活动未开始",
        _ => "",
    }
}

/// 按当前时间计算活动状态（Java `convert` 三分支）：
/// 进行中 → 1；未开始 → 3；已结束 → 2。
#[must_use]
pub fn time_status_code(start_time: i64, end_time: i64, now: i64) -> i32 {
    if now < start_time {
        TIME_STATUS_FORTHCOMING
    } else if now > end_time {
        TIME_STATUS_OFF
    } else {
        TIME_STATUS_ON
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`；`<= 0` 返回 `"0"`（Java `convert`）。
#[must_use]
pub fn format_time(secs: i64) -> String {
    if secs <= 0 {
        return "0".to_string();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(secs, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => "0".to_string(),
    }
}

/// 日期字符串 → 秒级时间戳（Java `StringUtils.dateToTimestampExample`；
/// 支持 `yyyy-MM-dd HH:mm:ss` / `yyyy-MM-dd HH:mm` / `yyyy-MM-dd`，非法返回 0）。
#[must_use]
pub fn parse_datetime(raw: &str) -> i64 {
    let raw = raw.trim();
    if raw.is_empty() {
        return 0;
    }
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"] {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(raw, fmt) {
            use chrono::TimeZone;
            if let Some(local) = chrono::Local.from_local_datetime(&dt).earliest() {
                return local.timestamp();
            }
        }
    }
    if let Ok(date) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        use chrono::TimeZone;
        if let Some(dt) = date.and_hms_opt(0, 0, 0) {
            if let Some(local) = chrono::Local.from_local_datetime(&dt).earliest() {
                return local.timestamp();
            }
        }
    }
    0
}

/// `List<Integer>` → JSON 数组串（Java `List.toString()` / `JSON.toJSONString` 兼容）。
#[must_use]
pub fn int_list_json(items: &[i32]) -> String {
    serde_json::to_string(items).unwrap_or_else(|_| "[]".to_string())
}

/// JSON 数组串 → `Vec<i32>`（兼容 `[1,2]` 与 `[1, 2]`；非法项忽略）。
#[must_use]
pub fn parse_int_list_json(raw: &str) -> Vec<i32> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Vec::new();
    }
    if let Ok(v) = serde_json::from_str::<Vec<i32>>(raw) {
        return v;
    }
    raw.trim_matches(['[', ']'])
        .split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .collect()
}

/// `promotion_type_data` 中最小满额（Java `dataJudge`：取 `minAmount` 最小值，空 → 0）。
#[must_use]
pub fn min_amount_from_type_data(data: &[PromotionTypeData]) -> Decimal {
    data.iter()
        .filter_map(|d| d.min_amount)
        .min()
        .unwrap_or(Decimal::ZERO)
}

/// 排序字段白名单（Java `buildSortOrder`：属性名 → 列名，未知回退主键）。
#[must_use]
pub fn sort_column(field: Option<&str>) -> &'static str {
    match field.map(str::trim) {
        Some("promotionName") | Some("promotion_name") => "promotion_name",
        Some("startTime") | Some("start_time") => "start_time",
        Some("endTime") | Some("end_time") => "end_time",
        Some("minOrderAmount") | Some("min_order_amount") => "min_order_amount",
        Some("maxOrderAmount") | Some("max_order_amount") => "max_order_amount",
        Some("isAvailable") | Some("is_available") => "is_available",
        Some("sortOrder") | Some("sort_order") => "sort_order",
        Some("promotionType") | Some("promotion_type") => "promotion_type",
        Some("unit") => "unit",
        _ => "promotion_id",
    }
}

/// 活动类型相关数据（Java `ProductPromotionDTO.PromotionTypeData`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionTypeData {
    /// 满额
    pub min_amount: Option<Decimal>,
    /// 优惠额（Java 为 String，如 "10" / "0.9"）
    pub reduce: Option<String>,
    pub gift_id: Option<i32>,
    pub gift_stock: Option<i32>,
    pub gift_name: Option<String>,
    /// 赠送数量
    pub num: Option<i32>,
}

/// 创建/更新入参（Java `ProductPromotionDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPromotionDTO {
    pub promotion_id: Option<i32>,
    pub promotion_name: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub limit_user_rank: Option<Vec<i32>>,
    pub range: Option<i32>,
    pub range_data: Option<Vec<i32>>,
    pub min_order_amount: Option<Decimal>,
    pub max_order_amount: Option<Decimal>,
    pub promotion_type: Option<i32>,
    pub promotion_type_data: Option<Vec<PromotionTypeData>>,
    pub is_available: Option<i32>,
    pub sort_order: Option<i32>,
    pub shop_id: Option<i32>,
    pub rules_type: Option<i32>,
    pub unit: Option<i32>,
    /// 适用会员范围：0 全部会员 / 1 指定标记会员
    pub member_range: Option<i32>,
    pub member_marks: Option<Vec<i32>>,
    /// 会员人群圈选（历史结构，本实现仅原样保存 JSON）
    pub member_audience: Option<serde_json::Value>,
    /// 发送会员/参与人群（优先于 memberAudience，本实现仅原样保存 JSON）
    pub send_user_target: Option<serde_json::Value>,
}

impl ProductPromotionDTO {
    /// Java `@Valid` 注解口径的校验（名称/长度/类型）。
    pub fn validate(&self) -> Result<(), String> {
        let name = self
            .promotion_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| PROMOTION_NAME_NOT_NULL.to_string())?;
        if name.chars().count() > 50 {
            return Err(PROMOTION_NAME_OVER_LENGTH.to_string());
        }
        gain_type(self.promotion_type.unwrap_or(0))?;
        Ok(())
    }
}

/// 列表查询（Java `ProductPromotionListDTO` + BasePage）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPromotionListQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub keyword: Option<String>,
    /// 逗号串，如 `"1,2"`
    pub promotion_type: Option<String>,
    /// 1 进行中 / 2 已结束 / 3 未开始
    pub is_going: Option<i32>,
    /// 平台视角店铺 id（Java `HeaderUtils.getShopId()` 缺省 0）
    pub shop_id: Option<i32>,
}

impl ProductPromotionListQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    /// `promotionType` CSV → `Vec<i32>`（Java `Arrays.stream(split(","))`）。
    #[must_use]
    pub fn promotion_types(&self) -> Vec<i32> {
        self.promotion_type
            .as_deref()
            .map(|s| {
                s.split(',')
                    .filter_map(|v| v.trim().parse::<i32>().ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }
}

/// 商品促销 VO（Java `ProductPromotionVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPromotionVO {
    pub promotion_id: i32,
    pub promotion_name: String,
    pub start_time: String,
    pub end_time: String,
    pub limit_user_rank: Vec<i32>,
    pub range: i32,
    pub range_data: Vec<i32>,
    pub min_order_amount: Decimal,
    pub max_order_amount: Decimal,
    pub promotion_type: i32,
    pub promotion_type_data: Vec<PromotionTypeData>,
    pub is_available: i32,
    pub sort_order: i32,
    pub shop_id: i32,
    pub rules_type: i32,
    pub unit: i32,
    pub promotion_type_name: String,
    pub product_status: String,
    pub product_time: Vec<String>,
    pub product_gift: Vec<GiftVO>,
    pub member_range: Option<i32>,
    pub member_marks: Option<Vec<i32>>,
    pub member_audience: Option<serde_json::Value>,
    pub send_user_target: Option<serde_json::Value>,
}

/// 赠品信息（Java `ProductGift` 的展示字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftVO {
    pub gift_id: i32,
    pub gift_name: String,
    pub gift_stock: i32,
    pub product_id: i32,
    pub sku_id: i32,
}

/// 配置 VO（Java `ProductPromotionConfigVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPromotionConfigVO {
    /// 活动时间状态：code → description
    pub promotion_status: BTreeMap<i32, String>,
    pub rank_list: Vec<RankVO>,
}

/// 会员等级简版（Java `UserRank` 列表）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RankVO {
    pub rank_id: i32,
    pub rank_name: String,
}

/// 活动冲突列表查询（Java `ConflictPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ConflictPageQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub range: Option<i32>,
    /// 逗号串商品 id
    pub range_data: Option<String>,
    pub promotion_type: Option<i32>,
    pub shop_id: Option<i32>,
}

impl ConflictPageQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    /// `rangeData` CSV → `Vec<i32>`。
    #[must_use]
    pub fn range_product_ids(&self) -> Vec<i32> {
        self.range_data
            .as_deref()
            .map(|s| {
                s.split(',')
                    .filter_map(|v| v.trim().parse::<i32>().ok())
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// 冲突活动 VO（Java `ConflictPageVO`，由 `ProductPromotion` 直接构造）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ConflictPageVO {
    pub promotion_id: i32,
    pub promotion_name: String,
    pub start_time: String,
    pub end_time: String,
    pub limit_user_rank: String,
    pub range: i32,
    pub range_data: String,
    pub min_order_amount: Decimal,
    pub max_order_amount: Decimal,
    pub promotion_type: i32,
    pub promotion_type_name: String,
    pub promotion_type_data: String,
    pub is_available: i32,
    pub sort_order: i32,
    pub shop_id: i32,
    pub rules_type: i32,
    pub unit: i32,
}

/// `ProductPromotion` 实体 → 冲突 VO。
#[must_use]
pub fn conflict_vo_from_entity(e: &crate::entities::ProductPromotion, now: i64) -> ConflictPageVO {
    let _ = now;
    ConflictPageVO {
        promotion_id: e.promotion_id,
        promotion_name: e.promotion_name.clone(),
        start_time: format_time(i64::from(e.start_time)),
        end_time: format_time(i64::from(e.end_time)),
        limit_user_rank: e.limit_user_rank.clone(),
        range: e.range,
        range_data: e.range_data.clone(),
        min_order_amount: e.min_order_amount,
        max_order_amount: e.max_order_amount,
        promotion_type: e.promotion_type,
        promotion_type_name: promotion_type_name(e.promotion_type).to_string(),
        promotion_type_data: e.promotion_type_data.clone(),
        is_available: e.is_available,
        sort_order: e.sort_order,
        shop_id: e.shop_id,
        rules_type: e.rules_type,
        unit: e.unit,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn type_names_and_gain_type_match_java() {
        assert_eq!(promotion_type_name(1), "满减");
        assert_eq!(promotion_type_name(2), "满折");
        assert_eq!(promotion_type_name(3), "赠品");
        assert_eq!(promotion_type_name(9), "");
        assert_eq!(gain_type(1).unwrap(), 3);
        assert_eq!(gain_type(2).unwrap(), 4);
        assert_eq!(gain_type(3).unwrap(), 5);
        assert_eq!(gain_type(4).unwrap_err(), "类型错误");
        assert_eq!(time_status_name(1), "活动进行中");
        assert_eq!(time_status_name(2), "活动已结束");
        assert_eq!(time_status_name(3), "活动未开始");
    }

    #[test]
    fn time_status_and_format_match_java() {
        assert_eq!(time_status_code(100, 200, 150), TIME_STATUS_ON);
        assert_eq!(time_status_code(100, 200, 99), TIME_STATUS_FORTHCOMING);
        assert_eq!(time_status_code(100, 200, 201), TIME_STATUS_OFF);
        assert_eq!(format_time(0), "0");
        assert_eq!(format_time(-5), "0");
        assert_eq!(parse_datetime(""), 0);
        assert_eq!(parse_datetime("not-a-date"), 0);
        let ts = parse_datetime("2026-10-18 10:00:00");
        assert!(ts > 0);
        assert_eq!(format_time(ts), "2026-10-18 10:00:00");
    }

    #[test]
    fn dto_validation_is_verbatim() {
        let mut dto = ProductPromotionDTO::default();
        assert_eq!(dto.validate().unwrap_err(), PROMOTION_NAME_NOT_NULL);
        dto.promotion_name = Some("   ".into());
        assert_eq!(dto.validate().unwrap_err(), PROMOTION_NAME_NOT_NULL);
        dto.promotion_name = Some("名".repeat(51));
        dto.promotion_type = Some(1);
        assert_eq!(dto.validate().unwrap_err(), PROMOTION_NAME_OVER_LENGTH);
        dto.promotion_name = Some("活动".into());
        dto.promotion_type = Some(4);
        assert_eq!(dto.validate().unwrap_err(), PRODUCT_PROMOTION_TYPE_ERROR);
        dto.promotion_type = Some(2);
        assert!(dto.validate().is_ok());
    }

    #[test]
    fn int_list_and_min_amount_helpers() {
        assert_eq!(int_list_json(&[1, 2]), "[1,2]");
        assert_eq!(parse_int_list_json("[1, 2, x]"), vec![1, 2]);
        assert_eq!(parse_int_list_json(""), Vec::<i32>::new());
        let data = vec![
            PromotionTypeData {
                min_amount: Some(Decimal::from_str("100.00").unwrap()),
                ..Default::default()
            },
            PromotionTypeData {
                min_amount: Some(Decimal::from_str("50.00").unwrap()),
                ..Default::default()
            },
            PromotionTypeData::default(),
        ];
        assert_eq!(
            min_amount_from_type_data(&data),
            Decimal::from_str("50.00").unwrap()
        );
        assert_eq!(min_amount_from_type_data(&[]), Decimal::ZERO);
    }

    #[test]
    fn sort_whitelist_rejects_injection() {
        assert_eq!(sort_column(Some("promotionName")), "promotion_name");
        assert_eq!(sort_column(Some("minOrderAmount")), "min_order_amount");
        assert_eq!(sort_column(Some("1; DROP TABLE promotion")), "promotion_id");
        assert_eq!(sort_column(None), "promotion_id");
    }
}
