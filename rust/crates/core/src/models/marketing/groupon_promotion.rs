//! 拼团活动域（marketing::groupon_promotion）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.promotion.GrouponPromotionController`（8 admin）
//! - `com.tigshop.api.controller.promotion.GrouponPromotionController`（4 public）
//! - `com.tigshop.service.promotion.impl.GrouponPromotionServiceImpl`（912 行）
//! - 入参 `PromotionPromotionCreateParam` / `PromotionPromotionUpdateParam`
//! - 查询 `GrouponPromotionPageQuery` / `GrouponPromotionClientPageQuery` / `GrouponItemPageQuery`
//! - 出参 `GrouponPromotionPageVO` / `GrouponPromotionDetailVO` / `GrouponPromotionClientPageVO` /
//!   `GrouponPromotionClientDetailVO` / `GrouponPromotionImageVO` / `GrouponPostVO` /
//!   `GrouponItemVO` / `GrouponItemInfoVO`
//!
//! # 与 Java 的口径说明
//!
//! - 金额字段沿用 marketing 域既有约定直接用 `rust_decimal::Decimal`
//!   （Java `BigDecimal` → JSON number；rust_decimal 默认序列化为十进制字符串，
//!   与同域 `seckill` / `time_discount` 一致，见 `uncertain_points`）。
//! - 时间：Java 入参为 `"yyyy-MM-dd HH:mm:ss"` 字符串（`TigUtils.toTimestampYmdHms`），
//!   出参 `TimestampToDateSerializer` 再格式化；本文件 [`parse_datetime`] /
//!   [`format_time`] 复刻同名口径（`chrono::Local`）。
//! - 会员人群：Java 依赖 `MemberAudienceService`（member_scope 编解码 / 匹配）。
//!   Rust 侧该服务未迁移，`sendUserTarget` 以原始 JSON 存 `promotion.member_scope`、
//!   读回时原样返回；`memberAudience` 旧结构返回 `null`（见 `uncertain_points`）。
//! - 活动状态（`PromotionTimeStatusEnum`）：1 进行中 / 2 已结束 / 3 未开始。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（枚举码 / 错误文案 / 配置键）
// ——————————————————————————————————————————————

/// Java `PromotionType.TYPE_GROUPON`。
pub const PROMOTION_TYPE_GROUPON: i32 = 7;
/// Java `PromotionType.TYPE_GROUPON.getDescription()`。
pub const PROMOTION_TYPE_GROUPON_DESC: &str = "拼团";
/// Java `PromotionRangeEnum.PROMOTION_RANGE_PRODUCT`。
pub const PROMOTION_RANGE_PRODUCT: i32 = 3;

/// 活动状态：进行中（Java `PROMOTION_STATUS_ON`）。
pub const STATUS_ON: i32 = 1;
/// 活动状态：已结束（Java `PROMOTION_STATUS_OFF`）。
pub const STATUS_OFF: i32 = 2;
/// 活动状态：未开始（Java `PROMOTION_STATUS_FORTHCOMING`）。
pub const STATUS_FORTHCOMING: i32 = 3;

/// 参团类型：开团（Java `JoinTypeEnum.OPEN_GROUP`）。
pub const JOIN_TYPE_OPEN: i32 = 1;
/// 拼团状态：待成团（Java `JoinStatusEnum.WAIT_GROUP`）。
pub const JOIN_STATUS_WAIT: i32 = 1;
/// 拼团状态：拼团成功（Java `JoinStatusEnum.SUCCESS`）。
pub const JOIN_STATUS_SUCCESS: i32 = 2;

/// 商品状态：上架（Java `ProductStatus.ON_SALE`）。
pub const PRODUCT_ON_SALE: i32 = 1;
/// 商品删除标记：未删除（Java `DeleteType.NOT_DELETE`）。
pub const PRODUCT_NOT_DELETE: i32 = 0;
/// 启用（Java `Constants.YES`）。
pub const ENABLED_YES: i32 = 1;

/// 配置键：H5 端域名（Java `SettingsEnum.H5_DOMAIN`）。
pub const CONFIG_H5_DOMAIN: &str = "h5Domain";

/// `未知的拼团活动`
pub const MSG_UNKNOWN_PROMOTION: &str = "未知的拼团活动";
/// `活动未结束，不能删除`
pub const MSG_NOT_ENDED_CANNOT_DELETE: &str = "活动未结束，不能删除";
/// `拼团不存在`
pub const MSG_GROUPON_NOT_EXIST: &str = "拼团不存在";
/// `该拼团活动仅限指定会员参与`
pub const MSG_MEMBER_ONLY: &str = "该拼团活动仅限指定会员参与";
/// `仅限指定会员参与`（前台置灰提示）
pub const MSG_MEMBER_ONLY_TIP: &str = "仅限指定会员参与";
/// `您不在该拼团活动的参与范围内`
pub const MSG_NOT_IN_SCOPE_TIP: &str = "您不在该拼团活动的参与范围内";
/// 表单校验文案（Java `@NotBlank` / `@NotNull`，`@Valid` 生效）
pub const MSG_NAME_REQUIRED: &str = "活动名称不能为空";
pub const MSG_START_REQUIRED: &str = "开始时间不能为空";
pub const MSG_END_REQUIRED: &str = "结束时间不能为空";
pub const MSG_GROUP_TYPE_REQUIRED: &str = "拼团类型不能为空";
pub const MSG_EXPIRATION_REQUIRED: &str = "成团有效时间不能为空";

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`，`<=0` → 空串）。
#[must_use]
pub fn format_time(secs: i64) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(secs, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// 秒级时间戳 → `yyyy-MM-dd`（Java `handelTime(secs, "yyyy-MM-dd")`）。
#[must_use]
pub fn format_date(secs: i64) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(secs, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d").to_string(),
        _ => String::new(),
    }
}

/// 日期/时间字符串 → 秒级时间戳（Java `TigUtils.toTimestampYmdHms` /
/// `StringUtils.dateToTimestampExample`）。
///
/// 支持 `yyyy-MM-dd`、`yyyy-MM-dd HH:mm:ss`、`yyyy-MM-ddTHH:mm:ss`
/// 与纯数字秒级时间戳；无法解析 → `None`。
#[must_use]
pub fn parse_datetime(raw: &str) -> Option<i64> {
    let raw = raw.trim();
    if raw.is_empty() {
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
    if let Ok(date) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        let dt = date.and_hms_opt(0, 0, 0)?;
        return Some(dt.and_utc().timestamp() - 8 * 3600);
    }
    None
}

/// 活动状态文案（Java `PromotionTimeStatusEnum.handleStatusName`）。
#[must_use]
pub fn status_name(start_time: i64, end_time: i64, now: i64) -> &'static str {
    if now >= start_time && now < end_time {
        "活动进行中"
    } else if now < start_time {
        "活动未开始"
    } else {
        "活动已结束"
    }
}

/// 活动状态码。
///
/// - 管理端列表：`now >= start && now < end` → 1；`now < start` → 3；否则 2。
/// - 客户端列表 `assemble`：进行中判断用 `now <= end`（含边界，Java 两处不一致，
///   本函数用 [`client_status`] 复刻）。
#[must_use]
pub fn admin_status(start_time: i64, end_time: i64, now: i64) -> i32 {
    if now >= start_time && now < end_time {
        STATUS_ON
    } else if now < start_time {
        STATUS_FORTHCOMING
    } else {
        STATUS_OFF
    }
}

/// 客户端列表状态码（Java `GrouponPromotionClientPageVO#assemble`：
/// `now >= start && now <= end` 为进行中）。
#[must_use]
pub fn client_status(start_time: i64, end_time: i64, now: i64) -> i32 {
    if now >= start_time && now <= end_time {
        STATUS_ON
    } else if now < start_time {
        STATUS_FORTHCOMING
    } else {
        STATUS_OFF
    }
}

/// 管理端列表允许的排序字段（Java `getColumnByPropertyName`：属性名或列名，
/// 非法回退主键，防 SQL 注入）。
#[must_use]
pub fn promotion_sort_column(field: Option<&str>) -> &'static str {
    match field.map(str::trim).filter(|f| !f.is_empty()) {
        Some("grouponPromotionId") | Some("groupon_promotion_id") => "groupon_promotion_id",
        Some("name") => "name",
        Some("startTime") | Some("start_time") => "start_time",
        Some("endTime") | Some("end_time") => "end_time",
        Some("groupType") | Some("group_type") => "group_type",
        Some("shopId") | Some("shop_id") => "shop_id",
        Some("addTime") | Some("add_time") => "add_time",
        _ => "groupon_promotion_id",
    }
}

/// 排序方向：`asc` → true（其余含空 → 降序）。
#[must_use]
pub fn sort_is_asc(order: Option<&str>) -> bool {
    matches!(order.map(str::trim), Some(v) if v.eq_ignore_ascii_case("asc"))
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

// —— JSON 结构（group_num / group_price / shop_ids / 人群 scope）——

/// 成团人数项（Java `PromotionPromotionItemCreateParam.GrouponNumParam`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GroupNumItem {
    pub group_num_key: Option<i32>,
    pub group_num: Option<i32>,
}

/// 拼团价格项（Java `...GrouponPromotionDetailPriceParam`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GroupPriceItem {
    pub group_num_key: Option<i32>,
    pub price: Option<Decimal>,
}

/// 解析 `group_num` JSON（非法/空 → 空表，与 fastjson 宽松解析一致）。
#[must_use]
pub fn parse_group_nums(raw: &str) -> Vec<GroupNumItem> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// 解析 `group_price` JSON。
#[must_use]
pub fn parse_group_prices(raw: &str) -> Vec<GroupPriceItem> {
    serde_json::from_str(raw).unwrap_or_default()
}

/// 解析 `groupon_promotion_shops.shop_ids`（JSON 数组文本）。
#[must_use]
pub fn parse_shop_ids(raw: Option<&str>) -> Vec<i32> {
    raw.and_then(|value| serde_json::from_str::<Vec<i32>>(value).ok())
        .unwrap_or_default()
}

/// 序列化适用店铺 id（Java `JsonUtil.toJson(new HashSet<>(shopIds))`；
/// 本实现按升序去重，保证结果稳定）。
#[must_use]
pub fn serialize_shop_ids(ids: &[i32]) -> String {
    let mut unique: Vec<i32> = ids.to_vec();
    unique.sort_unstable();
    unique.dedup();
    serde_json::to_string(&unique).unwrap_or_else(|_| "[]".to_string())
}

/// 校验创建/更新参数（Java `@Valid` 必填项，`Validation` → HTTP 400）。
///
/// # Errors
/// 返回第一条不满足的 `tigshop_core::Error::Validation`（文案逐字对齐 Java 注解）。
pub fn validate_create_param(p: &PromotionPromotionCreateParam) -> crate::Result<()> {
    if p.name.as_deref().map(str::trim).unwrap_or("").is_empty() {
        return Err(crate::Error::Validation(MSG_NAME_REQUIRED.into()));
    }
    if p.start_time
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        return Err(crate::Error::Validation(MSG_START_REQUIRED.into()));
    }
    if p.end_time
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        return Err(crate::Error::Validation(MSG_END_REQUIRED.into()));
    }
    if p.group_type.is_none() {
        return Err(crate::Error::Validation(MSG_GROUP_TYPE_REQUIRED.into()));
    }
    if p.expiration_time.is_none() {
        return Err(crate::Error::Validation(MSG_EXPIRATION_REQUIRED.into()));
    }
    Ok(())
}

/// 更新时「活动重开与其它拼团商品冲突」的错误文案
/// （Java `商品:{productName} 正在参与其他拼团活动:{name}`，多商品直接拼接）。
#[must_use]
pub fn other_groupon_conflict_message(product_name: &str, groupon_name: &str) -> String {
    format!("商品:{product_name} 正在参与其他拼团活动:{groupon_name}")
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 创建拼团活动（Java `PromotionPromotionCreateParam`，`@Valid` 必填）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionPromotionCreateParam {
    /// 活动名称
    pub name: Option<String>,
    /// 开始时间（`yyyy-MM-dd HH:mm:ss`）
    pub start_time: Option<String>,
    /// 结束时间（`yyyy-MM-dd HH:mm:ss`）
    pub end_time: Option<String>,
    /// 拼团类型：1 普通团，2 阶梯团
    pub group_type: Option<i32>,
    /// 成团有效时间
    pub expiration_time: Option<i64>,
    /// h5 活动图片
    pub groupon_image: Option<String>,
    /// pc 活动图片
    pub pc_groupon_image: Option<String>,
    /// 分享图
    pub share_image: Option<String>,
    /// 活动说明
    pub groupon_explain: Option<String>,
    /// 分配组织（店铺 id；含 0 表示商城自营）
    pub shop_ids: Option<Vec<i32>>,
    /// 适用会员范围：0 全部会员，1 指定标记会员
    pub member_range: Option<i32>,
    /// 选择的会员标记列表
    pub member_marks: Option<Vec<i32>>,
    /// 会员人群圈选（历史结构，未迁移 `MemberAudienceService` 时原样存库）
    pub member_audience: Option<serde_json::Value>,
    /// 参与人群（指定会员/等级+标签三组并集，优先生效）
    pub send_user_target: Option<serde_json::Value>,
}

/// 更新拼团活动（Java `PromotionPromotionUpdateParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PromotionPromotionUpdateParam {
    /// 拼团 ID
    pub groupon_promotion_id: Option<i64>,
    /// 其余字段同创建
    #[serde(flatten)]
    pub base: PromotionPromotionCreateParam,
}

/// Java `OperateDTO`（本域自持副本：`finish` / `del` 只用 `id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i64>,
    pub admin_note: Option<String>,
    pub page_type: Option<i32>,
}

/// 管理端拼团分页查询（Java `GrouponPromotionPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionPageQuery {
    pub groupon_name: Option<String>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    /// 所属店铺（缺省取请求头 `HeaderUtils.getShopId()`）
    pub shop_id: Option<i32>,
    /// 活动状态 1进行中 2已结束 3未开始
    pub status: Option<i32>,
    /// 开始时间（日期/时间字符串）
    pub start_time: Option<String>,
    /// 结束时间（日期/时间字符串）
    pub end_time: Option<String>,
    /// 拼团类型
    pub group_type: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 客户端拼团分页查询（Java `GrouponPromotionClientPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionClientPageQuery {
    pub groupon_name: Option<String>,
    pub group_type: Option<i32>,
    /// 活动状态 1进行中 2已结束 3未开始
    pub status: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 客户端拼团商品分页查询（Java `GrouponItemPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponItemPageQuery {
    /// 拼团活动 ID（指定后只查该活动）
    pub groupon_promotion_id: Option<i64>,
    /// 商品名称关键词
    pub keyword: Option<String>,
    /// 排序字段：`sale`（销量）/ `price`（拼团价）
    pub sort_field: Option<String>,
    /// asc|desc
    pub sort_order: Option<String>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// 管理端详情/推广查询（Java `@RequestParam grouponPromotionId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionIdQuery {
    pub groupon_promotion_id: Option<i64>,
}

/// 客户端 `getGrouponInfo` 查询（Java `@RequestParam int productId`，必填）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponProductIdQuery {
    pub product_id: i32,
}

/// 客户端拼团图片分页查询（Java `BasePage`，仅 page/size）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponImagePageQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 管理端拼团分页行（Java `GrouponPromotionPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionPageVO {
    pub groupon_promotion_id: i64,
    pub name: String,
    /// 开始时间（`yyyy-MM-dd HH:mm:ss`）
    pub start_time: String,
    /// 结束时间
    pub end_time: String,
    pub group_type: Option<i32>,
    pub shop_id: Option<i32>,
    /// 活动状态 1进行中 2已结束 3未开始
    pub status: Option<i32>,
    pub status_name: Option<String>,
    pub shop_name: Option<String>,
    /// 应收金额（拼团成功记录的实付合计）
    pub receive_amount: Decimal,
    /// 成团数量（成功记录中开团类型数量）
    pub group_success_count: i64,
    /// 支付单数（全部拼团记录数）
    pub pay_order_count: i64,
}

/// 适用组织（Java 返回 `Shop` 实体；本实现收敛为前端所需字段，见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponShopVO {
    pub shop_id: i32,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub status: Option<i32>,
    pub merchant_id: Option<i32>,
}

/// 管理端拼团详情（Java `GrouponPromotionDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionDetailVO {
    pub groupon_promotion_id: i64,
    pub name: String,
    pub group_type: Option<i32>,
    pub start_time: String,
    pub end_time: String,
    pub expiration_time: Option<i64>,
    pub groupon_image: Option<String>,
    pub pc_groupon_image: Option<String>,
    pub share_image: Option<String>,
    pub groupon_explain: Option<String>,
    pub shops: Option<Vec<GrouponShopVO>>,
    pub member_range: Option<i32>,
    pub member_marks: Option<Vec<i32>>,
    /// 历史人群结构（未迁移 `memberAudienceService` → null）
    pub member_audience: Option<serde_json::Value>,
    /// 参与人群（member_scope 原样 JSON）
    pub send_user_target: Option<serde_json::Value>,
    pub can_join: Option<bool>,
    pub restrict_tip: Option<String>,
}

/// 客户端拼团分页行（Java `GrouponPromotionClientPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionClientPageVO {
    pub groupon_promotion_id: i64,
    pub name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub group_type: Option<i32>,
    pub shop_id: Option<i32>,
    pub start_time_str: String,
    pub end_time_str: String,
    pub status: Option<i32>,
    pub status_name: Option<String>,
    pub shop_name: Option<String>,
}

/// 客户端拼团详情（Java `GrouponPromotionClientDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionClientDetailVO {
    pub groupon_promotion_id: i64,
    pub groupon_image: Option<String>,
    pub pc_groupon_image: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub groupon_explain: Option<String>,
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    pub can_join: Option<bool>,
    pub restrict_tip: Option<String>,
}

/// 拼团活动图片（Java `GrouponPromotionImageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionImageVO {
    pub groupon_promotion_id: i64,
    pub name: String,
    pub group_type: Option<i32>,
    pub groupon_image: Option<String>,
    pub pc_groupon_image: Option<String>,
    pub share_image: Option<String>,
    pub shop_id: Option<i32>,
    pub add_time: i64,
}

/// 活动推广（Java `GrouponPostVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPostVO {
    pub promotion_name: String,
    pub promotion_type: String,
    pub promotion_pic_url: Option<String>,
    pub wechat_short_link: Option<String>,
    pub short_link: Option<String>,
    pub original_link: Option<String>,
    pub promotion_brief: Option<String>,
    pub promotion_date_time: String,
    pub mini_code: Option<String>,
}

/// 拼团活动商品行（Java `GrouponItemVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponItemVO {
    pub groupon_promotion_item_id: i64,
    pub product_id: i64,
    pub min_groupon_price: Option<Decimal>,
    pub min_group_num: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_brief: Option<String>,
    pub product_price: Option<Decimal>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub join_num_count: i64,
    pub group_num: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub can_join: Option<bool>,
    pub restrict_tip: Option<String>,
}

/// 成团明细行（Java 直接返回 `GrouponPromotionDetail` 实体，JSON 为 camelCase）。
///
/// 注意：与 [`GrouponPromotionDetailVO`]（管理端活动详情头）不是同一个 Java 类型，
/// 这里命名为 `GrouponPromotionMemberDetailVO` 以免重名。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponPromotionMemberDetailVO {
    pub groupon_detail_id: i64,
    pub groupon_promotion_id: i64,
    pub groupon_promotion_item_id: i64,
    pub product_id: i64,
    pub sku_id: i64,
    /// 拼团价 JSON 文本（`[{groupNumKey, price}]`）
    pub group_price: String,
    pub limit_num: i32,
    pub is_join: i32,
    pub add_time: i64,
}

/// 拼团商品详情（Java `GrouponItemInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrouponItemInfoVO {
    pub groupon_promotion_item_id: i64,
    pub groupon_promotion_id: i64,
    pub product_id: i64,
    pub product_sn: Option<String>,
    pub group_type: Option<i32>,
    pub group_nums: Option<Vec<GroupNumItem>>,
    pub order_limit_num: Option<i32>,
    pub is_auto_group: Option<i32>,
    pub min_group_num: Option<i32>,
    pub name: String,
    pub start_time: String,
    pub end_time: String,
    pub expiration_time: Option<i64>,
    pub groupon_image: Option<String>,
    pub pc_groupon_image: Option<String>,
    pub share_image: Option<String>,
    pub groupon_explain: Option<String>,
    pub shop_id: Option<i32>,
    pub min_groupon_price: Option<Decimal>,
    pub group_success_count: i64,
    pub join_num_count: i64,
    pub groupon_promotion_details: Option<Vec<GrouponPromotionMemberDetailVO>>,
    pub can_join: Option<bool>,
    pub restrict_tip: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn datetime_parse_and_format_roundtrip() {
        assert_eq!(parse_datetime("2026-10-18 09:00:00"), Some(1_792_285_200));
        assert_eq!(parse_datetime("2026-10-18"), Some(1_792_252_800));
        assert_eq!(parse_datetime("1792285200"), Some(1_792_285_200));
        assert_eq!(parse_datetime(""), None);
        assert_eq!(parse_datetime("bad"), None);
        assert_eq!(format_date(1_792_285_200), "2026-10-18");
        assert_eq!(format_time(0), "");
        assert_eq!(format_time(1_792_285_200).len(), 19);
    }

    #[test]
    fn status_semantics_match_two_java_paths() {
        // 区间 [100, 200)
        assert_eq!(admin_status(100, 200, 50), STATUS_FORTHCOMING);
        assert_eq!(admin_status(100, 200, 100), STATUS_ON);
        assert_eq!(admin_status(100, 200, 199), STATUS_ON);
        assert_eq!(admin_status(100, 200, 200), STATUS_OFF);
        // 客户端 assemble：end 含边界
        assert_eq!(client_status(100, 200, 200), STATUS_ON);
        assert_eq!(client_status(100, 200, 201), STATUS_OFF);
        assert_eq!(status_name(100, 200, 120), "活动进行中");
        assert_eq!(status_name(100, 200, 20), "活动未开始");
        assert_eq!(status_name(100, 200, 300), "活动已结束");
    }

    #[test]
    fn json_helpers_parse_java_shapes() {
        let nums =
            parse_group_nums(r#"[{"groupNumKey":1,"groupNum":2},{"groupNumKey":2,"groupNum":3}]"#);
        assert_eq!(nums.len(), 2);
        assert_eq!(nums[0].group_num, Some(2));
        let prices = parse_group_prices(r#"[{"groupNumKey":1,"price":9.90}]"#);
        assert_eq!(prices[0].price, Some(Decimal::new(990, 2)));
        // 非法 JSON → 空表（fastjson 宽松解析失败时 Java 会抛异常，本实现降级为空）
        assert!(parse_group_nums("not-json").is_empty());
        assert!(parse_shop_ids(Some("[1,2,0]")).eq(&vec![1, 2, 0]));
        assert!(parse_shop_ids(None).is_empty());
        assert_eq!(serialize_shop_ids(&[2, 1, 2, 0]), "[0,1,2]");
    }

    #[test]
    fn validation_messages_match_java_annotations() {
        let mut p = PromotionPromotionCreateParam::default();
        assert_eq!(
            validate_create_param(&p)
                .unwrap_err()
                .to_string()
                .contains(MSG_NAME_REQUIRED),
            true
        );
        p.name = Some("活动".into());
        assert!(validate_create_param(&p)
            .unwrap_err()
            .to_string()
            .contains(MSG_START_REQUIRED));
        p.start_time = Some("2026-10-18 00:00:00".into());
        assert!(validate_create_param(&p)
            .unwrap_err()
            .to_string()
            .contains(MSG_END_REQUIRED));
        p.end_time = Some("2026-10-19 00:00:00".into());
        assert!(validate_create_param(&p)
            .unwrap_err()
            .to_string()
            .contains(MSG_GROUP_TYPE_REQUIRED));
        p.group_type = Some(1);
        assert!(validate_create_param(&p)
            .unwrap_err()
            .to_string()
            .contains(MSG_EXPIRATION_REQUIRED));
        p.expiration_time = Some(3600);
        assert!(validate_create_param(&p).is_ok());
    }

    #[test]
    fn sort_whitelist_and_paging() {
        assert_eq!(promotion_sort_column(None), "groupon_promotion_id");
        assert_eq!(promotion_sort_column(Some("startTime")), "start_time");
        assert_eq!(
            promotion_sort_column(Some("name; DROP TABLE x")),
            "groupon_promotion_id"
        );
        assert!(sort_is_asc(Some("asc")));
        assert!(!sort_is_asc(Some("desc")));
        assert_eq!(page_params(None, None), (1, 15));
        assert_eq!(page_params(Some(2), Some(500)), (2, 100));
    }

    #[test]
    fn update_param_flattens_create_fields() {
        let p: PromotionPromotionUpdateParam = serde_json::from_str(
            r#"{"grouponPromotionId":9,"name":"A","startTime":"2026-10-18 00:00:00",
                "endTime":"2026-10-19 00:00:00","groupType":1,"expirationTime":3600,
                "shopIds":[1,2],"memberRange":1,"memberMarks":[3]}"#,
        )
        .unwrap();
        assert_eq!(p.groupon_promotion_id, Some(9));
        assert_eq!(p.base.name.as_deref(), Some("A"));
        assert_eq!(p.base.shop_ids, Some(vec![1, 2]));
        assert_eq!(p.base.member_range, Some(1));
    }

    #[test]
    fn conflict_message_matches_java_concat() {
        assert_eq!(
            other_groupon_conflict_message("商品A", "拼团B"),
            "商品:商品A 正在参与其他拼团活动:拼团B"
        );
    }
}
