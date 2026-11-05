//! 授信会员域（payment::credit_user）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.finance.CreditUserController`（6 端点）
//! - `com.tigshop.service.finance.impl.CreditUserServiceImpl`（list / detail /
//!   create / update / delete / updateField）
//! - `com.tigshop.bean.dto.finance.{CreditUserListDTO, CreditUserCreateDTO,
//!   CreditUserUpdateDTO}`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO}`
//! - `com.tigshop.bean.vo.finance.{CreditUserListVO, CreditUserVO}`
//! - `com.tigshop.bean.enums.finance.{CreditUserStatusEnum, SettlementTypeEnum}`
//! - `com.tigshop.common.constant.CheckFieldConstants#CREDIT_USER_FIELDS`
//!
//! 表 `credit_user`（10 列，主键 `credit_user_id`，`uk_user_id` 唯一）。
//!
//! # 复用（同域模板）
//!
//! 枚举文案 / 时间格式化 / 日期起点 / 账期天数等纯函数复用
//! [`tigshop_core::models::payment::credit_settlement`]（同一 `credit_user`
//! 表与同一套 Java 枚举），保证两个切片口径完全一致。
//!
//! # 关键语义
//!
//! - `credit_user.status`：0 禁用 / 1 启用（库默认 1）。
//! - `updateField` 白名单 `CREDIT_USER_FIELDS = {"status"}`：只有 `status` 可改，
//!   其它字段（含未知字段，Java `getColumnByPropertyName` 回退主键）报
//!   「field 的值有误」。
//! - 额度调整：`newAvailable = creditLimit - usedAmount`，为负时报
//!   「信用额度不能小于已使用额度（{已用}{货币}）」，货币取配置
//!   `dollarSignCn`（缺失/空白回退「元」）。
//! - `creditLimit` 下限 0.01（`@DecimalMin`，文案「信用额度必须大于0」）。
//! - 企业认证（`user_company`）只取 `status = 2` 的记录；`limit 1` 无 ORDER BY，
//!   Rust 固定取 `id` 最小行（与 credit_settlement 同步口径）。
//!
//! # 偏差（如实标注）
//!
//! 1. `@Sensitive(PHONE)` 仅 demo 模式脱敏；Rust 无 demo 开关 ⇒ 手机号原样返回。
//! 2. 排序：Java `buildSortOrder` 默认主键 DESC 后再追加 `create_time DESC`；
//!    本实现固定 `create_time DESC` 为主序、`sortField` 为次序。
//! 3. `delete` 后 Java 物理删除（`removeById`）——本实现一致（`credit_user`
//!    无逻辑删除列）。
//! 4. 唯一键冲突（并发创建同一会员）由库 `uk_user_id` 兜底，返回数据库错误。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::CreditUser;

// 本域自带枚举文案 / 日期纯函数（核心 crate 内不允许跨 feature 自引用，
// 故不 `pub use` credit_settlement 的实现；两边口径由单测锁定一致）。

// ——————————————————————————————————————————————
// 常量（表结构 / 枚举 / 白名单 / 文案）
// ——————————————————————————————————————————————

/// `credit_user` 10 列（顺序与实体一致）。
pub const CREDIT_USER_COLUMNS: [&str; 10] = [
    "credit_user_id",
    "user_id",
    "credit_limit",
    "used_amount",
    "available_amount",
    "settlement_type",
    "status",
    "period_start_time",
    "create_time",
    "update_time",
];

/// 主键列。
pub const KEY_COLUMN: &str = "credit_user_id";
/// 主键属性名。
pub const KEY_PROPERTY: &str = "creditUserId";

/// 状态：禁用。
pub const STATUS_DISABLED: i32 = 0;
/// 状态：启用。
pub const STATUS_ENABLED: i32 = 1;

/// 账期类型：月结（30 天）。
pub const SETTLEMENT_TYPE_MONTHLY: i32 = 1;
/// 账期类型：季结（90 天）。
pub const SETTLEMENT_TYPE_QUARTERLY: i32 = 2;

/// 账期订单结算状态：待结算（删除前置校验用）。
pub const ORDER_SETTLEMENT_UNSETTLED: i32 = 0;

/// `updateField` 白名单（Java `CheckFieldConstants.CREDIT_USER_FIELDS`）。
pub const CREDIT_USER_FIELDS: [&str; 1] = ["status"];

/// 货币中文配置键（Java `SettingsEnum.DOLLAR_SIGN_CN`）。
pub const CONFIG_DOLLAR_SIGN_CN: &str = "dollarSignCn";
/// 货币兜底文案（Java `StrUtil.isBlank(val) ? "元" : val`）。
pub const CURRENCY_FALLBACK: &str = "元";

/// 授信会员不存在（与 credit_settlement 同文案）。
pub const MSG_CREDIT_USER_NOT_FOUND: &str = "授信会员不存在";

/// 会员不存在。
pub const MSG_MEMBER_NOT_EXISTS: &str = "会员不存在";
/// 会员未完成认证。
pub const MSG_COMPANY_NOT_VERIFIED: &str = "该会员未完成认证，无法添加为授信会员";
/// 已是授信会员。
pub const MSG_ALREADY_CREDIT_USER: &str = "该会员已是授信会员";
/// 结算账期类型不合法。
pub const MSG_SETTLEMENT_TYPE_INVALID: &str = "请选择有效的结算账期类型";
/// 存在待结算订单无法删除。
pub const MSG_HAS_UNSETTLED_ORDERS: &str = "存在待结算的账期订单，无法删除";
/// 无效状态值。
pub const MSG_INVALID_STATUS: &str = "无效的状态值";
/// 请选择会员（`@NotNull`）。
pub const MSG_SELECT_MEMBER: &str = "请选择会员";
/// 请输入信用额度（`@NotNull`）。
pub const MSG_CREDIT_LIMIT_REQUIRED: &str = "请输入信用额度";
/// 信用额度下限（`@DecimalMin("0.01")`）。
pub const MSG_CREDIT_LIMIT_MIN: &str = "信用额度必须大于0";
/// 请选择结算账期类型（`@NotNull`）。
pub const MSG_SETTLEMENT_TYPE_REQUIRED: &str = "请选择结算账期类型";
/// 授信会员 ID 不能为空（`@NotNull`）。
pub const MSG_CREDIT_USER_ID_REQUIRED: &str = "授信会员ID不能为空";
/// id 不能为空（`ResultTextConstants.ID_CANNOT_IS_NULL`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 字段名不能为空。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// 值不能为空。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// 字段值有误。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// 额度下限（`@DecimalMin("0.01")`）。
#[must_use]
pub fn credit_limit_min() -> Decimal {
    Decimal::new(1, 2)
}

// ——————————————————————————————————————————————
// 枚举文案 / 时间纯函数（与 credit_settlement 同口径）
// ——————————————————————————————————————————————

/// UTC+8 时区偏移秒数（Java 服务器 `ZoneId.systemDefault()`）。
pub const TZ_OFFSET_SECONDS: i32 = 8 * 3600;

/// 授信会员状态文案（Java `CreditUserStatusEnum.getDescByCode`，未知 `""`）。
#[must_use]
pub fn credit_user_status_text(status: i32) -> &'static str {
    match status {
        STATUS_DISABLED => "禁用",
        STATUS_ENABLED => "启用",
        _ => "",
    }
}

/// 账期类型文案（Java `SettlementTypeEnum.getDescByCode`）。
#[must_use]
pub fn settlement_type_text(settlement_type: i32) -> &'static str {
    match settlement_type {
        SETTLEMENT_TYPE_MONTHLY => "月结",
        SETTLEMENT_TYPE_QUARTERLY => "季结",
        _ => "",
    }
}

/// 账期天数（Java `SettlementTypeEnum.getDaysByCode`：未知回退 30）。
#[must_use]
pub fn settlement_type_days(settlement_type: i32) -> i32 {
    match settlement_type {
        SETTLEMENT_TYPE_QUARTERLY => 90,
        _ => 30,
    }
}

/// 会员类型文案（Java `UserCompanyType.getTypeName`：1 个人 / 2 企业）。
#[must_use]
pub fn user_company_type_text(company_type: i32) -> &'static str {
    match company_type {
        1 => "个人",
        2 => "企业",
        _ => "",
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`0`/`None` ⇒ `""`
/// （Java `TigUtils.handelTime`；本域仅在测试/装配复用）。
#[must_use]
pub fn format_time(secs: Option<i64>) -> String {
    let Some(secs) = secs.filter(|s| *s != 0) else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(secs, 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::seconds(i64::from(TZ_OFFSET_SECONDS)))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 当前 UTC+8 日期。
#[must_use]
pub fn today_local() -> chrono::NaiveDate {
    (chrono::Utc::now().naive_utc() + chrono::Duration::seconds(i64::from(TZ_OFFSET_SECONDS)))
        .date()
}

/// UTC+8 日期 0 点 → 秒级时间戳。
#[must_use]
pub fn date_start_epoch(date: chrono::NaiveDate) -> i64 {
    date.and_hms_opt(0, 0, 0)
        .map(|d| d.and_utc().timestamp() - i64::from(TZ_OFFSET_SECONDS))
        .unwrap_or(0)
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 排序字段 → 列名（Java `getColumnByPropertyName`，未知回退主键）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "creditUserId" | "credit_user_id" => "credit_user_id",
        "userId" | "user_id" => "user_id",
        "creditLimit" | "credit_limit" => "credit_limit",
        "usedAmount" | "used_amount" => "used_amount",
        "availableAmount" | "available_amount" => "available_amount",
        "settlementType" | "settlement_type" => "settlement_type",
        "status" => "status",
        "periodStartTime" | "period_start_time" => "period_start_time",
        "createTime" | "create_time" => "create_time",
        "updateTime" | "update_time" => "update_time",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段归一 + 白名单判定：仅 `status`。
#[must_use]
pub fn resolve_update_column(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    if CREDIT_USER_FIELDS.contains(&column) {
        Some(column)
    } else {
        None
    }
}

/// 金额文本（Java `BigDecimal.toString()`，库列 `decimal(12,2)` 固定两位）。
#[must_use]
pub fn format_money(value: Decimal) -> String {
    format!("{value:.2}")
}

/// 「信用额度不能小于已使用额度（{已用}{货币}）」（Java 字符串拼接原文）。
#[must_use]
pub fn credit_limit_too_low_message(used_amount: Decimal, currency: &str) -> String {
    format!(
        "信用额度不能小于已使用额度（{}{currency}）",
        format_money(used_amount)
    )
}

/// 货币名称（Java `getCurrencyName`：配置空白回退「元」）。
#[must_use]
pub fn currency_name(raw: Option<&str>) -> String {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some(value) => value.to_string(),
        None => CURRENCY_FALLBACK.to_string(),
    }
}

/// `(LIMIT, OFFSET)`（Java `BasePage` 口径：默认 15、上限 100）。
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

/// 主序 `create_time DESC` + 可选次序（Java 两层 ORDER BY 的等价落地）。
#[must_use]
pub fn order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let mut out = " ORDER BY create_time DESC".to_string();
    let field = sort_field.map(str::trim).unwrap_or("");
    if !field.is_empty() {
        let column = map_order_column(field);
        if column != "create_time" {
            let dir = if sort_order
                .map(|s| s.trim().eq_ignore_ascii_case("asc"))
                .unwrap_or(false)
            {
                "ASC"
            } else {
                "DESC"
            };
            out.push_str(&format!(", {column} {dir}"));
        }
    }
    out
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 授信会员列表查询（Java `CreditUserListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditUserListQuery {
    /// 会员类型：1 个人 / 2 企业（来自 `user_company.type`）
    pub r#type: Option<i32>,
    /// 会员用户名（模糊）
    pub username: Option<String>,
    /// 状态：0 禁用 / 1 启用
    pub status: Option<i32>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl CreditUserListQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }

    /// 有效用户名（Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_username(&self) -> Option<&str> {
        self.username.as_deref().filter(|s| !s.is_empty())
    }

    /// ORDER BY（`create_time DESC` 主序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
}

/// 创建授信会员入参（Java `CreditUserCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditUserCreateDTO {
    /// 会员 ID（`@NotNull(message = "请选择会员")`）
    pub user_id: Option<i32>,
    /// 信用额度（`@NotNull` + `@DecimalMin("0.01")`）
    pub credit_limit: Option<Decimal>,
    /// 结算账期类型：1 月结 / 2 季结（`@NotNull`）
    pub settlement_type: Option<i32>,
    /// 状态：0 禁用 / 1 启用（可空，库默认 1）
    pub status: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreditUserCreate {
    pub user_id: i32,
    pub credit_limit: Decimal,
    pub settlement_type: i32,
    pub status: Option<i32>,
}

impl CreditUserCreateDTO {
    /// 注解校验（顺序与字段声明一致）。
    pub fn validate(&self) -> Result<CreditUserCreate, String> {
        let user_id = self.user_id.ok_or_else(|| MSG_SELECT_MEMBER.to_string())?;
        let credit_limit = self
            .credit_limit
            .ok_or_else(|| MSG_CREDIT_LIMIT_REQUIRED.to_string())?;
        if credit_limit < credit_limit_min() {
            return Err(MSG_CREDIT_LIMIT_MIN.to_string());
        }
        let settlement_type = self
            .settlement_type
            .ok_or_else(|| MSG_SETTLEMENT_TYPE_REQUIRED.to_string())?;
        Ok(CreditUserCreate {
            user_id,
            credit_limit,
            settlement_type,
            status: self.status,
        })
    }
}

/// 修改授信会员入参（Java `CreditUserUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditUserUpdateDTO {
    /// 授信会员 ID（`@NotNull(message = "授信会员ID不能为空")`）
    pub credit_user_id: Option<i32>,
    /// 信用额度（可空；`@DecimalMin("0.01")`）
    pub credit_limit: Option<Decimal>,
    /// 结算账期类型：1 月结 / 2 季结
    pub settlement_type: Option<i32>,
    /// 状态：0 禁用 / 1 启用
    pub status: Option<i32>,
}

/// 校验后的修改参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreditUserUpdate {
    pub credit_user_id: i32,
    pub credit_limit: Option<Decimal>,
    pub settlement_type: Option<i32>,
    pub status: Option<i32>,
}

impl CreditUserUpdateDTO {
    /// 注解校验（`creditUserId` 必填；`creditLimit` 传值时 ≥ 0.01）。
    pub fn validate(&self) -> Result<CreditUserUpdate, String> {
        let credit_user_id = self
            .credit_user_id
            .ok_or_else(|| MSG_CREDIT_USER_ID_REQUIRED.to_string())?;
        if let Some(limit) = self.credit_limit {
            if limit < credit_limit_min() {
                return Err(MSG_CREDIT_LIMIT_MIN.to_string());
            }
        }
        Ok(CreditUserUpdate {
            credit_user_id,
            credit_limit: self.credit_limit,
            settlement_type: self.settlement_type,
            status: self.status,
        })
    }
}

/// 删除入参（Java `OperateDTO` 的 id；`@Valid` 保证非空）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
    pub admin_note: Option<String>,
    pub page_type: Option<i32>,
}

impl OperateDTO {
    /// `@Valid` 校验：`id` 必填。
    pub fn validate_id(&self) -> Result<i32, String> {
        self.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())
    }
}

/// 字段更新入参（Java `UpdateFieldDTO`；`@Valid` 保证三字段非空）。
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
pub struct CreditUserFieldUpdate {
    pub credit_user_id: i32,
    pub status: i32,
}

impl UpdateFieldDTO {
    /// 注解校验 + 白名单/状态值解析（Java `CreditUserServiceImpl#updateField`）。
    pub fn validate(&self) -> Result<CreditUserFieldUpdate, String> {
        let id = self.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        let field = self
            .field
            .as_deref()
            .ok_or_else(|| MSG_FIELD_NAME_REQUIRED.to_string())?;
        let val = self
            .val
            .as_deref()
            .ok_or_else(|| MSG_FIELD_VALUE_REQUIRED.to_string())?;
        let column =
            resolve_update_column(field).ok_or_else(|| MSG_INVALID_FIELD_VALUE.to_string())?;
        debug_assert_eq!(column, "status");
        let status: i32 = val.parse().map_err(|_| MSG_INVALID_STATUS.to_string())?;
        Ok(CreditUserFieldUpdate {
            credit_user_id: id,
            status,
        })
    }
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 授信会员列表行（Java `CreditUserListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditUserListVO {
    pub credit_user_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    /// 手机号（Java `@Sensitive(PHONE)`，仅 demo 模式脱敏；本实现原样返回）
    pub mobile: Option<String>,
    pub r#type: Option<i32>,
    pub type_text: Option<String>,
    pub credit_limit: Decimal,
    pub used_amount: Decimal,
    pub available_amount: Decimal,
    pub settlement_type: i32,
    pub settlement_type_text: String,
    pub contact_name: Option<String>,
    pub company_name: Option<String>,
    pub status: i32,
    pub status_text: String,
    /// `handelTime`
    pub create_time: String,
}

/// 授信会员详情（Java `CreditUserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditUserVO {
    pub credit_user_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    /// 手机号（Java `@Sensitive(PHONE)`，仅 demo 模式脱敏；本实现原样返回）
    pub mobile: Option<String>,
    pub r#type: Option<i32>,
    pub type_text: Option<String>,
    pub credit_limit: Decimal,
    pub used_amount: Decimal,
    pub available_amount: Decimal,
    pub settlement_type: i32,
    pub settlement_type_text: String,
    pub settlement_days: i32,
    pub contact_name: Option<String>,
    pub company_name: Option<String>,
    pub status: i32,
    pub status_text: String,
    /// `handelTime`
    pub create_time: String,
    /// `handelTime`
    pub update_time: String,
}

/// 供服务层复用的枚举文案入口（避免调用方到处 import settlement 模块）。
#[must_use]
pub fn status_text(status: i32) -> String {
    credit_user_status_text(status).to_string()
}

/// 账期类型文案。
#[must_use]
pub fn settlement_type_name(settlement_type: i32) -> String {
    settlement_type_text(settlement_type).to_string()
}

/// 会员类型文案。
#[must_use]
pub fn company_type_name(company_type: i32) -> String {
    user_company_type_text(company_type).to_string()
}

/// 创建实体字段（Java `create` 的赋值口径，供服务层事务外构造 + 单测）。
#[must_use]
pub fn build_credit_user_for_create(
    input: &CreditUserCreate,
    now: i64,
    today_start_epoch: i64,
) -> CreditUser {
    CreditUser {
        credit_user_id: 0,
        user_id: input.user_id,
        credit_limit: input.credit_limit,
        used_amount: Decimal::ZERO,
        available_amount: input.credit_limit,
        settlement_type: input.settlement_type,
        // Java `BeanUtils.copyProperties` 允许 null → MP 省略该列 → 库默认 1
        status: input.status.unwrap_or(STATUS_ENABLED),
        period_start_time: Some(today_start_epoch),
        create_time: Some(now),
        update_time: Some(now),
    }
}

/// 合并更新字段（Java `updateById` 的 NOT_NULL 语义）并做额度校验。
///
/// 返回合并后的实体；额度不足时返回「信用额度不能小于已使用额度（{已用}{货币}）」。
pub fn merge_credit_user_update(
    existing: &CreditUser,
    input: &CreditUserUpdate,
    now: i64,
    currency: &str,
) -> Result<CreditUser, String> {
    let mut entity = existing.clone();
    if let Some(limit) = input.credit_limit {
        let new_available = limit - existing.used_amount;
        if new_available < Decimal::ZERO {
            return Err(credit_limit_too_low_message(existing.used_amount, currency));
        }
        entity.credit_limit = limit;
        entity.available_amount = new_available;
    }
    if let Some(settlement_type) = input.settlement_type {
        entity.settlement_type = settlement_type;
    }
    if let Some(status) = input.status {
        entity.status = status;
    }
    entity.update_time = Some(now);
    Ok(entity)
}

/// 账期或状态校验（`create` / `update` 共用）：只允许 1/2。
pub fn validate_settlement_type(value: i32) -> Result<i32, String> {
    if matches!(value, SETTLEMENT_TYPE_MONTHLY | SETTLEMENT_TYPE_QUARTERLY) {
        Ok(value)
    } else {
        Err(MSG_SETTLEMENT_TYPE_INVALID.to_string())
    }
}

/// 状态校验（`setStatus`）：只允许 0/1。
pub fn validate_status(value: i32) -> Result<i32, String> {
    if matches!(value, STATUS_DISABLED | STATUS_ENABLED) {
        Ok(value)
    } else {
        Err(MSG_INVALID_STATUS.to_string())
    }
}

/// 今天 0 点（UTC+8）秒级时间戳（Java `LocalDate.now().atStartOfDay()`）。
#[must_use]
pub fn today_start_epoch() -> i64 {
    date_start_epoch(today_local())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn existing() -> CreditUser {
        CreditUser {
            credit_user_id: 5,
            user_id: 7,
            credit_limit: Decimal::new(100000, 2),
            used_amount: Decimal::new(30000, 2),
            available_amount: Decimal::new(70000, 2),
            settlement_type: SETTLEMENT_TYPE_MONTHLY,
            status: STATUS_ENABLED,
            period_start_time: Some(1_768_406_400),
            create_time: Some(1_768_406_400),
            update_time: Some(1_768_406_400),
        }
    }

    #[test]
    fn enum_texts_and_money_formatting() {
        assert_eq!(status_text(0), "禁用");
        assert_eq!(status_text(1), "启用");
        assert_eq!(status_text(9), "");
        assert_eq!(settlement_type_name(1), "月结");
        assert_eq!(settlement_type_name(2), "季结");
        assert_eq!(company_type_name(1), "个人");
        assert_eq!(company_type_name(2), "企业");
        assert_eq!(settlement_type_days(1), 30);
        assert_eq!(settlement_type_days(2), 90);
        assert_eq!(format_money(Decimal::new(10000, 2)), "100.00");
        assert_eq!(format_money(Decimal::ZERO), "0.00");
        assert_eq!(
            credit_limit_too_low_message(Decimal::new(10000, 2), "元"),
            "信用额度不能小于已使用额度（100.00元）"
        );
        assert_eq!(currency_name(None), "元");
        assert_eq!(currency_name(Some("  ")), "元");
        assert_eq!(currency_name(Some(" USD ")), "USD");
        assert_eq!(MSG_CREDIT_USER_NOT_FOUND, "授信会员不存在");
    }

    #[test]
    fn create_validation_messages() {
        let mut dto = CreditUserCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_SELECT_MEMBER);
        dto.user_id = Some(3);
        assert_eq!(dto.validate().unwrap_err(), MSG_CREDIT_LIMIT_REQUIRED);
        dto.credit_limit = Some(Decimal::ZERO);
        assert_eq!(dto.validate().unwrap_err(), MSG_CREDIT_LIMIT_MIN);
        dto.credit_limit = Some(Decimal::new(1, 2)); // 0.01
        assert_eq!(dto.validate().unwrap_err(), MSG_SETTLEMENT_TYPE_REQUIRED);
        dto.settlement_type = Some(2);
        let input = dto.validate().unwrap();
        assert_eq!(input.user_id, 3);
        assert_eq!(input.credit_limit, Decimal::new(1, 2));
        assert_eq!(input.settlement_type, 2);
        assert_eq!(input.status, None);
    }

    #[test]
    fn update_validation_and_merge() {
        let mut dto = CreditUserUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_CREDIT_USER_ID_REQUIRED);
        dto.credit_user_id = Some(5);
        dto.credit_limit = Some(Decimal::ZERO);
        assert_eq!(dto.validate().unwrap_err(), MSG_CREDIT_LIMIT_MIN);
        dto.credit_limit = Some(Decimal::new(50000, 2));
        dto.settlement_type = Some(SETTLEMENT_TYPE_QUARTERLY);
        dto.status = Some(STATUS_DISABLED);
        let input = dto.validate().unwrap();
        let merged = merge_credit_user_update(&existing(), &input, 1_800_000_000, "元").unwrap();
        assert_eq!(merged.credit_limit, Decimal::new(50000, 2));
        assert_eq!(merged.available_amount, Decimal::new(20000, 2));
        assert_eq!(merged.used_amount, Decimal::new(30000, 2));
        assert_eq!(merged.settlement_type, SETTLEMENT_TYPE_QUARTERLY);
        assert_eq!(merged.status, STATUS_DISABLED);
        assert_eq!(merged.create_time, Some(1_768_406_400));
        assert_eq!(merged.update_time, Some(1_800_000_000));
        // 额度低于已用
        let bad = CreditUserUpdate {
            credit_user_id: 5,
            credit_limit: Some(Decimal::new(10000, 2)),
            settlement_type: None,
            status: None,
        };
        assert_eq!(
            merge_credit_user_update(&existing(), &bad, 1_800_000_000, "元").unwrap_err(),
            "信用额度不能小于已使用额度（300.00元）"
        );
        // 未传的字段保持原值
        let empty = CreditUserUpdate {
            credit_user_id: 5,
            credit_limit: None,
            settlement_type: None,
            status: None,
        };
        let merged = merge_credit_user_update(&existing(), &empty, 1_800_000_000, "元").unwrap();
        assert_eq!(merged.credit_limit, Decimal::new(100000, 2));
        assert_eq!(merged.status, STATUS_ENABLED);
        assert_eq!(merged.settlement_type, SETTLEMENT_TYPE_MONTHLY);
    }

    #[test]
    fn create_entity_defaults() {
        let input = CreditUserCreate {
            user_id: 9,
            credit_limit: Decimal::new(5000, 2),
            settlement_type: SETTLEMENT_TYPE_QUARTERLY,
            status: None,
        };
        let entity = build_credit_user_for_create(&input, 1_800_000_000, 1_799_996_400);
        assert_eq!(entity.credit_user_id, 0);
        assert_eq!(entity.user_id, 9);
        assert_eq!(entity.credit_limit, Decimal::new(5000, 2));
        assert_eq!(entity.used_amount, Decimal::ZERO);
        assert_eq!(entity.available_amount, Decimal::new(5000, 2));
        assert_eq!(entity.settlement_type, SETTLEMENT_TYPE_QUARTERLY);
        assert_eq!(entity.status, STATUS_ENABLED, "null 状态回退库默认 1");
        assert_eq!(entity.period_start_time, Some(1_799_996_400));
        assert_eq!(entity.create_time, Some(1_800_000_000));
        assert_eq!(entity.update_time, Some(1_800_000_000));
    }

    #[test]
    fn update_field_validation() {
        let mut dto = UpdateFieldDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        dto.id = Some(5);
        assert_eq!(dto.validate().unwrap_err(), MSG_FIELD_NAME_REQUIRED);
        dto.field = Some("status".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_FIELD_VALUE_REQUIRED);
        dto.val = Some("abc".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_INVALID_STATUS);
        dto.val = Some("0".into());
        assert_eq!(
            dto.validate().unwrap(),
            CreditUserFieldUpdate {
                credit_user_id: 5,
                status: 0
            }
        );
        // 非白名单字段（含主键属性）报 field 的值有误
        for field in ["userId", "creditUserId", "create_time", "nope"] {
            let dto = UpdateFieldDTO {
                id: Some(5),
                field: Some(field.into()),
                val: Some("1".into()),
            };
            assert_eq!(
                dto.validate().unwrap_err(),
                MSG_INVALID_FIELD_VALUE,
                "{field}"
            );
        }
        assert_eq!(resolve_update_column("status"), Some("status"));
        assert_eq!(resolve_update_column("status "), None);
    }

    #[test]
    fn delete_and_status_validators() {
        let dto = OperateDTO {
            id: Some(11),
            admin_note: None,
            page_type: None,
        };
        assert_eq!(dto.validate_id().unwrap(), 11);
        assert_eq!(
            OperateDTO::default().validate_id().unwrap_err(),
            MSG_ID_REQUIRED
        );
        assert_eq!(validate_settlement_type(1).unwrap(), 1);
        assert_eq!(validate_settlement_type(2).unwrap(), 2);
        assert_eq!(
            validate_settlement_type(3).unwrap_err(),
            MSG_SETTLEMENT_TYPE_INVALID
        );
        assert_eq!(validate_status(0).unwrap(), 0);
        assert_eq!(validate_status(1).unwrap(), 1);
        assert_eq!(validate_status(2).unwrap_err(), MSG_INVALID_STATUS);
        assert!(today_start_epoch() > 0);
    }

    #[test]
    fn list_query_paging_and_order() {
        let q = CreditUserListQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.effective_username(), None);
        assert_eq!(q.order_clause(), " ORDER BY create_time DESC");
        let q = CreditUserListQuery {
            username: Some("".into()),
            page: Some(2),
            size: Some(10),
            sort_field: Some("creditLimit".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (10, 10));
        assert_eq!(q.effective_username(), None);
        assert_eq!(
            q.order_clause(),
            " ORDER BY create_time DESC, credit_limit ASC"
        );
        // 同主列不重复 / 未知字段回退主键（防注入）
        assert_eq!(
            order_clause(Some("createTime"), Some("asc")),
            " ORDER BY create_time DESC"
        );
        assert_eq!(
            order_clause(Some("x; DROP TABLE credit_user"), None),
            " ORDER BY create_time DESC, credit_user_id DESC"
        );
    }
}
