//! 营销活动（marketing::promotion）DTO / VO / 纯逻辑。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.PromotionController`
//! （`@RequestMapping("/adminapi/promotion/promotion")`，4 个端点）+
//! `PromotionServiceImpl` + `PromotionListDTO` / `PromotionVO` /
//! `PromotionCountVO` / `PromotionCreateDTO` / `PromotionUpdateDTO` +
//! `PromotionType`。
//!
//! 表：`promotion`（实体 `tigshop_core::entities::Promotion`：
//! `promotion_id` / `promotion_name` / `start_time` / `end_time` / `type` /
//! `shop_id` / `relation_id` / `range` / `range_data` / `sku_ids` /
//! `is_available` / `is_delete` / `member_range` / `member_marks` /
//! `member_scope`）。
//!
//! # 端点（4）
//! `GET list`、`GET getPromotionCount`、`POST create`、`POST update`。
//!
//! # 时间类型（Java `PromotionServiceImpl#list` 的 `timeType`）
//! - `1` 进行中：`(start_time <= now <= end_time)` 或 `(start_time = 0 AND end_time = 0)`
//! - `2` 7 天内到期：`start_time <= now` 且 `now <= end_time <= now + 7d`
//! - `3` 已结束：`0 < end_time < now`
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. `create/update` 中 Java 用 `memberAudienceService.resolveWriteScope`
//!    解析人群圈选写入 `member_scope`；人群服务未迁移，Rust 原样透传
//!    `memberAudience`/`sendUserTarget` 于 VO（不落 `member_scope`）。
//! 2. `rangeData`/`skuIds`/`memberMarks` 在 Java 中为 `List.toString()` 形式
//!    （非 JSON），Rust 统一按 JSON 序列化（既有其它 domain 约定），
//!    读取时兼容两种格式。
//! 3. 校验文案：Java DTO 注解文案未在源码显式声明（`@NotBlank` 默认），
//!    Rust 采用「营销活动名称不能为空」/「id不能为空」并在模块头记录。
//!
//! # 金额：本域无金额列。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 营销类型（Java `PromotionType`，数值与名称逐字）。
pub const TYPE_SECKILL: i32 = 1;
pub const TYPE_COUPON: i32 = 2;
pub const TYPE_REDUCE: i32 = 3;
pub const TYPE_DISCOUNT: i32 = 4;
pub const TYPE_GIVE: i32 = 5;
pub const TYPE_LIMIT_DISCOUNT: i32 = 6;
pub const TYPE_GROUPON: i32 = 7;
pub const TYPE_LOTTERY: i32 = 8;

/// 时间类型（列表/统计筛选）。
pub const TIME_ONGOING: i32 = 1;
pub const TIME_EXPIRING_7D: i32 = 2;
pub const TIME_ENDED: i32 = 3;
pub const SEVEN_DAYS_SECS: i64 = 7 * 24 * 3600;

/// 错误文案（`name` 为 Java 注解默认文案的 Rust 近似，见差异 3）。
pub const MSG_NAME_REQUIRED: &str = "营销活动名称不能为空";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_PROMOTION_NOT_FOUND: &str = "营销活动不存在";
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 类型名称（Java `PromotionType#getTypeName`）。
#[must_use]
pub fn type_text(r#type: i32) -> &'static str {
    match r#type {
        TYPE_SECKILL => "秒杀",
        TYPE_COUPON => "优惠券",
        TYPE_REDUCE => "满减",
        TYPE_DISCOUNT => "满折",
        TYPE_GIVE => "满赠",
        TYPE_LIMIT_DISCOUNT => "限时折扣",
        TYPE_GROUPON => "拼团",
        TYPE_LOTTERY => "抽奖活动",
        _ => "",
    }
}

/// 时间类型判定（Java `list` 的 `timeType` 分支，纯函数）。
#[must_use]
pub fn time_bucket(now: i64, start_time: i32, end_time: i32) -> i32 {
    let start = i64::from(start_time);
    let end = i64::from(end_time);
    if (start <= now && now <= end) || (start == 0 && end == 0) {
        return TIME_ONGOING;
    }
    if start <= now && now <= end && end <= now + SEVEN_DAYS_SECS {
        return TIME_EXPIRING_7D;
    }
    if end > 0 && end < now {
        return TIME_ENDED;
    }
    -1
}

/// 列表查询（Java `PromotionListDTO` + `BasePage` 字段）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionListQuery {
    /// 活动名称模糊搜索（Java `BasePage.keyword`）
    pub keyword: Option<String>,
    /// 类型 csv，如 `1,2`（Java `StringUtils.str2IntList`）
    pub r#type: Option<String>,
    /// 时间类型 1 进行中 / 2 7 天内到期 / 3 已结束
    pub time_type: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 活动列表 VO（Java `PromotionVO` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromotionVO {
    pub promotion_id: i32,
    pub promotion_name: String,
    pub start_time: i32,
    pub end_time: i32,
    #[serde(rename = "type")]
    pub r#type: i32,
    pub type_text: String,
    pub shop_id: i32,
    pub relation_id: Option<i32>,
    pub range: Option<i32>,
    pub range_data: Option<Value>,
    pub sku_ids: Option<Value>,
    pub is_available: Option<i32>,
    pub is_delete: Option<i32>,
    pub member_range: i32,
    pub member_marks: Option<Value>,
}

/// 活动数量（Java `PromotionCountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromotionCountVO {
    pub time_type1_count: i64,
    pub time_type2_count: i64,
    pub time_type3_count: i64,
}

/// 新增活动入参（Java `PromotionCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionCreateDTO {
    pub promotion_name: Option<String>,
    /// 平台账号创建时指定归属店铺；店铺账号只能落本店（多租户，见
    /// `infrastructure::db::repo::marketing::tenant::TenantScope`）。
    pub shop_id: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub start_time: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub end_time: Option<i32>,
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub relation_id: Option<i32>,
    pub range: Option<i32>,
    pub range_data: Option<Value>,
    pub sku_ids: Option<Value>,
    pub member_range: Option<i32>,
    pub member_marks: Option<Value>,
    pub member_audience: Option<Value>,
    pub send_user_target: Option<i32>,
}

/// 编辑活动入参（Java `PromotionUpdateDTO`，多 `promotionId`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionUpdateDTO {
    pub promotion_id: Option<i32>,
    pub promotion_name: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub start_time: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub end_time: Option<i32>,
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub relation_id: Option<i32>,
    pub range: Option<i32>,
    pub range_data: Option<Value>,
    pub sku_ids: Option<Value>,
    pub member_range: Option<i32>,
    pub member_marks: Option<Value>,
    pub member_audience: Option<Value>,
    pub send_user_target: Option<i32>,
}

/// `types` 参数解析（Java `str2IntList`：忽略空段与非法值）。
#[must_use]
pub fn parse_type_list(raw: Option<&str>) -> Option<Vec<i32>> {
    let list: Vec<i32> = raw?
        .split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .collect();
    if list.is_empty() {
        None
    } else {
        Some(list)
    }
}

/// 校验新增入参（差异 3）。
///
/// # Errors
/// 名称为空 → `营销活动名称不能为空`。
pub fn validate_create(dto: &PromotionCreateDTO) -> std::result::Result<(), String> {
    match dto.promotion_name.as_deref().map(str::trim) {
        Some(v) if !v.is_empty() => Ok(()),
        _ => Err(MSG_NAME_REQUIRED.to_string()),
    }
}

/// 兼容 Java `List.toString()` 与 JSON 两种存储形态（差异 2）。
#[must_use]
pub fn parse_value(raw: Option<&str>) -> Option<Value> {
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    if let Ok(v) = serde_json::from_str::<Value>(text) {
        return Some(v);
    }
    // Java `[1, 2, 3]` 形态无法被 serde 接受（无引号）→ 手工转换
    let inner = text.trim_start_matches('[').trim_end_matches(']');
    if inner.is_empty() {
        return None;
    }
    let parts: Vec<Value> = inner
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.parse::<i64>()
                .map_or_else(|_| Value::String(s.to_string()), Value::from)
        })
        .collect();
    Some(Value::Array(parts))
}

/// Value → 存储文本（JSON 优先，保持统一）。
#[must_use]
pub fn value_to_text(v: Option<&Value>) -> Option<String> {
    v.filter(|v| !v.is_null())
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn type_texts_match_java_enum() {
        assert_eq!(type_text(1), "秒杀");
        assert_eq!(type_text(2), "优惠券");
        assert_eq!(type_text(6), "限时折扣");
        assert_eq!(type_text(8), "抽奖活动");
        assert_eq!(type_text(99), "");
    }

    #[test]
    fn time_bucket_branches() {
        let now = 1_700_000_000i64;
        assert_eq!(time_bucket(now, 0, 0), TIME_ONGOING);
        assert_eq!(time_bucket(now, 0, 0), 1);
        assert_eq!(
            time_bucket(now, (now - 10) as i32, (now + 100) as i32),
            TIME_ONGOING
        );
        // 进行中优先于「7 天内到期」
        assert_eq!(
            time_bucket(now, (now - 10) as i32, (now + 3600) as i32),
            TIME_ONGOING
        );
        // 未开始
        assert_eq!(time_bucket(now, (now + 10) as i32, (now + 20) as i32), -1);
        // 已结束
        assert_eq!(
            time_bucket(now, (now - 20) as i32, (now - 10) as i32),
            TIME_ENDED
        );
    }

    #[test]
    fn type_list_and_value_parsing() {
        assert_eq!(parse_type_list(Some("1,2, x ,3")), Some(vec![1, 2, 3]));
        assert_eq!(parse_type_list(Some("x")), None);
        assert_eq!(parse_type_list(None), None);
        assert_eq!(parse_value(Some(r#"{"a":1}"#)).unwrap()["a"], 1);
        assert_eq!(
            parse_value(Some("[1, 2, 3]")).unwrap(),
            serde_json::json!([1, 2, 3])
        );
        assert_eq!(
            parse_value(Some(r#"["a","b"]"#)).unwrap(),
            serde_json::json!(["a", "b"])
        );
        assert!(parse_value(None).is_none());
        assert_eq!(
            value_to_text(Some(&serde_json::json!([1, 2]))),
            Some("[1,2]".into())
        );
        assert_eq!(value_to_text(None), None);
    }

    #[test]
    fn create_validation_text_and_vo_serde() {
        assert_eq!(
            validate_create(&PromotionCreateDTO::default()).unwrap_err(),
            MSG_NAME_REQUIRED
        );
        let vo = PromotionVO {
            promotion_id: 3,
            promotion_name: "活动".into(),
            r#type: 1,
            type_text: type_text(1).into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["promotionId"], 3);
        assert_eq!(json["type"], 1);
        assert_eq!(json["typeText"], "秒杀");
    }
}
