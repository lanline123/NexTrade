//! 优惠券管理域（marketing::coupon_manage）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.promotion.CouponController` 中由本域负责的
//!   9 条端点（其余 list/detail/validList/listByIds/issue/users/issue/send 已有基线实现）
//! - `com.tigshop.service.promotion.impl.CouponServiceImpl`（create/update/del/
//!   updateField/batch/config + savePromotion）
//! - `com.tigshop.service.user.impl.UserCouponServiceImpl#previewManualIssue`（手动发放预览）
//! - `CouponIssueLogServiceImpl#list` / `CouponIssueBatchServiceImpl#list`（发放日志/批次）
//! - 入参 `CouponDTO` / `UpdateFieldDTO` / `BatchDTO` / `OperateDTO` /
//!   `CouponManualIssueParam`；查询 `CouponIssueLogPageQuery` / `CouponIssueBatchPageQuery`
//! - 出参 `CouponIssueLogVO` / `CouponIssueBatchVO` / `CouponManualIssuePreviewVO` /
//!   `CouponManualIssueFailDetailVO` / `UserRank`
//!
//! # 口径说明
//!
//! - 金额字段沿用 marketing 域约定直接用 `rust_decimal::Decimal`（与 `seckill` /
//!   `time_discount` / `groupon_promotion` 一致）。
//! - `coupon.send_range_data` / `limit_user_rank`：Java `List.toString()` 形态
//!   （`"[1, 2]"`），见 [`java_list_string`]；空为 `"[]"`。
//! - 手动发放预览的会员范围口径（USER 指定会员 / RANK 会员等级 / TAG 会员标签）
//!   与 Java `UserCouponServiceImpl` 一致；标签匹配走 `user_member_tag`
//!   （0=满足任一，1=满足全部）。
//! - `config` 返回会员等级 + 每级正式会员数（`user_type = 0`，含禁用）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（文案逐字对齐 Java）
// ——————————————————————————————————————————————

/// `优惠券名称不能为空`
pub const MSG_NAME_REQUIRED: &str = "优惠券名称不能为空";
/// `优惠券名称长度不能超过50`
pub const MSG_NAME_TOO_LONG: &str = "优惠券名称长度不能超过50";
/// `优惠券id不能为空`
pub const MSG_ID_REQUIRED: &str = "优惠券id不能为空";
/// `优惠券不存在`
pub const MSG_NOT_EXIST: &str = "优惠券不存在";
/// `优惠券金额不能大于或等于最低订单金额`
pub const MSG_COUPON_MONEY_EXCEED_MIN_ORDER_AMOUNT: &str = "优惠券金额不能大于或等于最低订单金额";
/// `id不能为空`
pub const MSG_UPDATE_ID_REQUIRED: &str = "id不能为空";
/// `字段名不能为空`
pub const MSG_FIELD_REQUIRED: &str = "字段名不能为空";
/// `值不能为空`
pub const MSG_VALUE_REQUIRED: &str = "值不能为空";
/// `field 的值有误`
pub const MSG_FIELD_INVALID: &str = "field 的值有误";
/// `未选择项目`
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// `操作类型不能为空`
pub const MSG_OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";
/// `无权发放该优惠券`
pub const MSG_ISSUE_NO_PERMISSION: &str = "无权发放该优惠券";
/// `发放模式不正确`
pub const MSG_ISSUE_MODE_INVALID: &str = "发放模式不正确";
/// `请选择会员`
pub const MSG_ISSUE_MEMBER_REQUIRED: &str = "请选择会员";
/// `手动发放暂不支持混合选择`
pub const MSG_ISSUE_MIXED_UNSUPPORTED: &str = "手动发放暂不支持混合选择";
/// `请选择会员等级`
pub const MSG_ISSUE_RANK_REQUIRED: &str = "请选择会员等级";
/// `请选择会员标签`
pub const MSG_ISSUE_TAG_REQUIRED: &str = "请选择会员标签";
/// `发放模式不能为空`
pub const MSG_ISSUE_TYPE_REQUIRED: &str = "发放模式不能为空";
/// 会员不存在（失败明细原因）
pub const MSG_MEMBER_NOT_EXIST: &str = "会员不存在";
/// 会员已禁用（失败明细原因）
pub const MSG_MEMBER_DISABLED: &str = "会员已禁用";

/// 优惠券类型：满减券（Java `couponType = 1`）。
pub const COUPON_TYPE_MONEY: i32 = 1;
/// 满减类型：满多少（Java `reduceType = 1`）。
pub const REDUCE_TYPE_THRESHOLD: i32 = 1;
/// 满减类型：无门槛（Java `reduceType = 2`）。
pub const REDUCE_TYPE_NO_THRESHOLD: i32 = 2;
/// 发放使用时间方式：按领取后多少天（Java `sendType = 0`）。
pub const SEND_TYPE_DAYS: i32 = 0;
/// 正式会员（Java `UserTypeEnum.MEMBER`）。
pub const USER_TYPE_MEMBER: i32 = 0;
/// 会员状态：正常（Java `User.status = 1`）。
pub const USER_STATUS_NORMAL: i32 = 1;

/// 发放方式：USER（Java `CouponManualIssueParam.ISSUE_TYPE_USER`）。
pub const ISSUE_TYPE_USER: &str = "USER";
/// 发放方式：RANK。
pub const ISSUE_TYPE_RANK: &str = "RANK";
/// 发放方式：TAG。
pub const ISSUE_TYPE_TAG: &str = "TAG";

/// `updateField` 允许的列白名单（Java `CheckFieldConstants.COUPON_FIELDS`）。
pub const COUPON_FIELDS: [&str; 5] = [
    "coupon_name",
    "coupon_money",
    "coupon_discount",
    "min_order_amount",
    "is_show",
];

/// 配置键：默认头像（Java `SettingsEnum.DEFAULT_AVATAR`）。
pub const CONFIG_DEFAULT_AVATAR: &str = "defaultAvatar";
/// 营销活动类型：优惠券（Java `PromotionType.TYPE_COUPON`）。
pub const PROMOTION_TYPE_COUPON: i32 = 2;
/// 营销活动可用（Java `Constants.YES`）。
pub const PROMOTION_AVAILABLE_YES: i32 = 1;

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// Java `List.toString()`（`"[1, 2]"`）；空列表 → `"[]"`。
#[must_use]
pub fn java_list_string(values: &[i32]) -> String {
    let body = values
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>()
        .join(", ");
    format!("[{body}]")
}

/// 发放来源文案（Java `SOURCE_TYPE_MAP`：0 用户领取 / 1 抽奖中奖 / 2 手动发放）。
#[must_use]
pub fn source_type_name(source_type: i32) -> &'static str {
    match source_type {
        0 => "用户领取",
        1 => "抽奖中奖",
        2 => "手动发放",
        _ => "未知",
    }
}

/// 日期/时间字符串 → 秒级时间戳（Java `StringUtils.dateToTimestampExample`）。
#[must_use]
pub fn parse_datetime(raw: &str) -> Option<i64> {
    let raw = raw.trim();
    if raw.is_empty() || raw == "0" {
        return None;
    }
    if let Ok(secs) = raw.parse::<i64>() {
        return Some(secs);
    }
    use chrono::NaiveDateTime;
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"] {
        if let Ok(dt) = NaiveDateTime::parse_from_str(raw, fmt) {
            return Some(dt.and_utc().timestamp() - 8 * 3600);
        }
    }
    chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| dt.and_utc().timestamp() - 8 * 3600)
}

/// Java `BasePage#getPage/getSize`：缺省 1 / 15，上限 100。
#[must_use]
pub fn page_params(page: Option<u64>, size: Option<u64>) -> (u64, u64) {
    (page.unwrap_or(1).max(1), size.unwrap_or(15).clamp(1, 100))
}

/// 由 page/size 构造 [`PageQuery`]。
#[must_use]
pub fn page_query(page: Option<u64>, size: Option<u64>) -> PageQuery {
    let (page, size) = page_params(page, size);
    PageQuery {
        page,
        page_size: size,
    }
}

/// `updateField` 属性名/列名 → 列名（Java `getColumnByPropertyName` + 白名单）。
#[must_use]
pub fn resolve_coupon_field(field: &str) -> Option<&'static str> {
    let column = match field.trim() {
        "couponName" | "coupon_name" => "coupon_name",
        "couponMoney" | "coupon_money" => "coupon_money",
        "couponDiscount" | "coupon_discount" => "coupon_discount",
        "minOrderAmount" | "min_order_amount" => "min_order_amount",
        "isShow" | "is_show" => "is_show",
        _ => return None,
    };
    COUPON_FIELDS.contains(&column).then_some(column)
}

/// 归一化发放模式（Java `normalizeIssueType`：trim + 大写 + 枚举校验）。
#[must_use]
pub fn normalize_issue_type(raw: &str) -> Option<&'static str> {
    match raw.trim().to_uppercase().as_str() {
        "USER" => Some(ISSUE_TYPE_USER),
        "RANK" => Some(ISSUE_TYPE_RANK),
        "TAG" => Some(ISSUE_TYPE_TAG),
        _ => None,
    }
}

/// 剩余可发放张数（Java `getRemainingIssueCount`：`sendNum <= 0` 视为不限）。
#[must_use]
pub fn remaining_issue_count(send_num: i32, issued: i64) -> i64 {
    if send_num <= 0 {
        return i64::MAX;
    }
    (i64::from(send_num) - issued).max(0)
}

/// 券量不足错误文案（Java `validateManualIssueLimits` 的 `String.format`）。
#[must_use]
pub fn insufficient_issue_message(remain: i64, need: i64) -> String {
    format!("发放失败，券量不足（剩余 {remain} 张，需发 {need} 张），请调整发行量后重试")
}

/// 校验创建/更新优惠券入参（Java `@Valid` 注解）。
///
/// # Errors
/// `Validation`（HTTP 400），文案逐字对齐 `CouponConstants`。
pub fn validate_coupon_dto(dto: &CouponDTO, is_update: bool) -> crate::Result<()> {
    if is_update && dto.coupon_id.is_none() {
        return Err(crate::Error::Validation(MSG_ID_REQUIRED.into()));
    }
    if dto
        .coupon_name
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        return Err(crate::Error::Validation(MSG_NAME_REQUIRED.into()));
    }
    if dto
        .coupon_name
        .as_deref()
        .map(str::chars)
        .map(|c| c.count())
        .unwrap_or(0)
        > 50
    {
        return Err(crate::Error::Validation(MSG_NAME_TOO_LONG.into()));
    }
    Ok(())
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 优惠券创建/更新入参（Java `CouponDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponDTO {
    pub coupon_id: Option<i32>,
    pub coupon_name: Option<String>,
    pub coupon_money: Option<Decimal>,
    pub coupon_discount: Option<Decimal>,
    pub coupon_desc: Option<String>,
    pub coupon_type: Option<i32>,
    pub send_range: Option<i32>,
    pub send_range_data: Option<Vec<i32>>,
    pub min_order_amount: Option<Decimal>,
    #[serde(default, deserialize_with = "deserialize_opt_date")]
    pub send_start_date: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_date")]
    pub send_end_date: Option<String>,
    pub send_type: Option<i32>,
    pub use_day: Option<i32>,
    #[serde(default, deserialize_with = "deserialize_opt_date")]
    pub use_start_date: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_date")]
    pub use_end_date: Option<String>,
    pub is_show: Option<i32>,
    pub is_global: Option<i32>,
    pub is_new_user: Option<i32>,
    pub enabled_click_get: Option<i32>,
    pub limit_user_rank: Option<Vec<i32>>,
    pub is_delete: Option<i32>,
    pub limit_num: Option<i32>,
    pub delay_day: Option<i32>,
    pub send_num: Option<i32>,
    pub max_order_amount: Option<Decimal>,
    pub coupon_unit: Option<i32>,
    pub reduce_type: Option<i32>,
    #[serde(default, deserialize_with = "deserialize_opt_date")]
    pub add_time: Option<String>,
    pub member_range: Option<i32>,
    pub member_marks: Option<Vec<i32>>,
    /// 历史人群结构（未迁移 `MemberAudienceService` → 原样 JSON 存库）
    pub member_audience: Option<serde_json::Value>,
    /// 参与人群（优先生效）
    pub send_user_target: Option<serde_json::Value>,
}

fn deserialize_opt_date<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        None | Some(serde_json::Value::Null) => None,
        Some(serde_json::Value::String(s)) => Some(s),
        Some(serde_json::Value::Number(n)) => Some(n.to_string()),
        Some(serde_json::Value::Bool(b)) => Some((if b { "1" } else { "0" }).to_string()),
        Some(other) => Some(other.to_string()),
    })
}

/// 更新字段（Java `UpdateFieldDTO`，三字段均 `@NotNull`）。
///
/// 后台开关组件可能把 `val` 传成 boolean/number（如公开显示开关），
/// 这里统一接受并转成列值字符串，避免直接 422。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFieldDTO {
    pub id: i32,
    pub field: String,
    #[serde(deserialize_with = "deserialize_field_val")]
    pub val: String,
}

fn deserialize_field_val<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(match value {
        serde_json::Value::String(s) => s,
        serde_json::Value::Bool(b) => (if b { "1" } else { "0" }).to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Null => String::new(),
        other => other.to_string(),
    })
}

/// 批量操作（Java `BatchDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDTO {
    pub ids: Vec<i32>,
    pub r#type: String,
    #[serde(default)]
    pub value: i32,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// 通用操作入参（Java `OperateDTO`，`del` 只用 `id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
    pub admin_note: Option<String>,
}

/// 手动发放参数（Java `CouponManualIssueParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponManualIssueParam {
    /// 优惠券 id（@NotNull）
    #[serde(default)]
    pub coupon_id: i32,
    /// 发放模式 USER/TAG/RANK（@NotBlank）
    pub issue_type: String,
    pub user_ids: Option<Vec<i32>>,
    pub rank_ids: Option<Vec<i32>>,
    pub tag_ids: Option<Vec<i64>>,
    /// 标签匹配：0 满足任一（默认），1 满足全部
    pub tag_match_mode: Option<i32>,
}

/// 发放日志分页查询（Java `CouponIssueLogPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponIssueLogPageQuery {
    pub coupon_id: Option<i32>,
    pub batch_id: Option<i64>,
    pub user_id: Option<i32>,
    pub source_type: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// 发放批次分页查询（Java `CouponIssueBatchPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponIssueBatchPageQuery {
    pub coupon_id: Option<i32>,
    pub source_type: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 发放日志（Java `CouponIssueLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponIssueLogVO {
    pub id: i64,
    pub batch_id: i64,
    pub coupon_id: i32,
    pub coupon_name: Option<String>,
    pub user_coupon_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub mobile: Option<String>,
    pub avatar: Option<String>,
    pub issue_time: i64,
    pub source_type: i32,
    pub source_type_name: String,
    /// 是否已使用：0 未使用，1 已使用
    pub used: i32,
    pub used_time: Option<i64>,
}

/// 发放批次（Java `CouponIssueBatchVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponIssueBatchVO {
    pub id: i64,
    pub coupon_id: i32,
    pub coupon_name: Option<String>,
    pub user_count: i32,
    pub coupon_count: i32,
    pub issue_time: i64,
    pub source_type: i32,
    pub source_type_name: String,
}

/// 手动发放失败明细（Java `CouponManualIssueFailDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponManualIssueFailDetailVO {
    pub user_id: i32,
    pub member_name: String,
    pub mobile: String,
    pub reason: String,
}

/// 手动发放预览（Java `CouponManualIssuePreviewVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponManualIssuePreviewVO {
    pub coupon_id: i32,
    pub issue_type: String,
    pub member_count: i32,
    pub coupon_count: i32,
    pub fail_count: i32,
    pub fail_details: Vec<CouponManualIssueFailDetailVO>,
}

/// 会员等级（Java `UserRank` 实体 + 统计字段 `userCount`）。
///
/// Java 直接返回实体（含 `userCount` 统计值），本实现按 camelCase 输出常用字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponConfigRankVO {
    pub rank_id: i32,
    pub rank_name: String,
    pub min_growth_points: Decimal,
    pub max_growth_points: i32,
    pub discount: Decimal,
    pub show_price: i32,
    pub rank_type: i32,
    pub rank_logo: String,
    pub rank_ico: String,
    pub rank_bg: String,
    pub rank_point: String,
    pub free_shipping: i32,
    pub rank_card_type: i32,
    pub rights: Option<String>,
    pub rank_level: String,
    /// 该等级正式会员数（`user_type = 0`，含禁用）
    pub user_count: i64,
}

/// 手动发放目标用户摘要（`resolveManualIssue*` 的查询结果）。
#[derive(Debug, Clone, Default)]
pub struct TargetUser {
    pub user_id: i32,
    pub nickname: String,
    pub mobile: String,
    pub status: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn java_list_string_matches_java_tostring() {
        assert_eq!(java_list_string(&[]), "[]");
        assert_eq!(java_list_string(&[1]), "[1]");
        assert_eq!(java_list_string(&[1, 2, 3]), "[1, 2, 3]");
    }

    #[test]
    fn source_type_names_and_field_whitelist() {
        assert_eq!(source_type_name(0), "用户领取");
        assert_eq!(source_type_name(1), "抽奖中奖");
        assert_eq!(source_type_name(2), "手动发放");
        assert_eq!(source_type_name(9), "未知");
        assert_eq!(resolve_coupon_field("couponName"), Some("coupon_name"));
        assert_eq!(resolve_coupon_field("is_show"), Some("is_show"));
        assert_eq!(resolve_coupon_field("shop_id"), None);
        assert_eq!(resolve_coupon_field("coupon_name; DROP"), None);
    }

    #[test]
    fn issue_mode_and_limit_helpers() {
        assert_eq!(normalize_issue_type(" user "), Some(ISSUE_TYPE_USER));
        assert_eq!(normalize_issue_type("rank"), Some(ISSUE_TYPE_RANK));
        assert_eq!(normalize_issue_type("tag"), Some(ISSUE_TYPE_TAG));
        assert_eq!(normalize_issue_type("bad"), None);
        assert_eq!(remaining_issue_count(0, 100), i64::MAX);
        assert_eq!(remaining_issue_count(10, 3), 7);
        assert_eq!(remaining_issue_count(5, 9), 0);
        assert_eq!(
            insufficient_issue_message(2, 5),
            "发放失败，券量不足（剩余 2 张，需发 5 张），请调整发行量后重试"
        );
    }

    #[test]
    fn coupon_dto_validation_matches_java_annotations() {
        let mut dto = CouponDTO::default();
        assert!(validate_coupon_dto(&dto, false)
            .unwrap_err()
            .to_string()
            .contains(MSG_NAME_REQUIRED));
        dto.coupon_name = Some("券".repeat(51));
        assert!(validate_coupon_dto(&dto, false)
            .unwrap_err()
            .to_string()
            .contains(MSG_NAME_TOO_LONG));
        dto.coupon_name = Some("优惠券A".into());
        assert!(validate_coupon_dto(&dto, false).is_ok());
        assert!(validate_coupon_dto(&dto, true)
            .unwrap_err()
            .to_string()
            .contains(MSG_ID_REQUIRED));
        dto.coupon_id = Some(1);
        assert!(validate_coupon_dto(&dto, true).is_ok());
    }

    #[test]
    fn datetime_parse_and_paging() {
        assert_eq!(parse_datetime("0"), None);
        assert_eq!(parse_datetime("2026-10-18 00:00:00"), Some(1_792_252_800));
        assert_eq!(parse_datetime("2026-10-18"), Some(1_792_252_800));
        assert_eq!(page_params(None, None), (1, 15));
        assert_eq!(page_params(Some(2), Some(500)), (2, 100));
    }

    #[test]
    fn query_and_vo_camel_case() {
        let q: CouponIssueLogPageQuery = serde_json::from_str(
            r#"{"couponId":2,"batchId":3,"userId":4,"sourceType":2,"page":2,"size":10}"#,
        )
        .unwrap();
        assert_eq!(q.coupon_id, Some(2));
        assert_eq!(q.batch_id, Some(3));
        assert_eq!(q.size, Some(10));
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);
    }
}
