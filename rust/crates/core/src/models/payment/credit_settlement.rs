//! 账期结算域（payment::credit_settlement）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.finance.CreditSettlementController`（6 端点）
//! - `com.tigshop.service.finance.impl.{CreditSettlementServiceImpl,
//!   CreditOrderServiceImpl, CreditUserServiceImpl}` 中本控制器用到的部分
//! - `com.tigshop.bean.dto.finance.{CreditSettlementUserListDTO,
//!   CreditSettlementListDTO, CreditSettlementSubmitDTO, CreditSettlementCancelDTO,
//!   CreditOrderListDTO}`
//! - `com.tigshop.bean.vo.finance.{CreditSettlementUserVO, CreditSettlementVO,
//!   CreditOrderVO}`
//! - `com.tigshop.bean.enums.finance.{CreditSettlementStatusEnum,
//!   CreditOrderSettlementStatusEnum, CreditUserStatusEnum, SettlementTypeEnum}`
//!
//! 实体：`tigshop_core::entities::{CreditSettlement, CreditOrder, CreditUser,
//! UserCompany, Order, OrderItem, Aftersales, AftersalesItem, RefundApply,
//! AdminUser, User}`（均由 schema 生成）。
//!
//! # 关键语义
//!
//! - 金额均为 `Decimal`（`credit_settlement.settlement_amount` / `credit_order.
//!   credit_amount` 为 `decimal(12,2)`）。
//! - 时间列全部是**秒级时间戳**（`bigint`）；VO 输出用 Java
//!   `TigUtils.handelTime` 口径格式化为 `yyyy-MM-dd HH:mm:ss`（UTC+8，
//!   `null`/`0` ⇒ `""`）。
//! - 账期窗口：`settlementDays` 月结 30 / 季结 90；周期起点 = `period_start_time`
//!   → `create_time`（毫秒自动 /1000）→ 当天 0 点；`remainingDays` = 剩余自然日，
//!   有上期未结算（`order_time < 周期起点` 且状态 ∈ {0,3}）⇒ 0。
//! - `@Sensitive(PHONE)` 脱敏仅在 `tigshop.is-demo=1` 时生效；非 demo 环境原样
//!   返回手机号，故此实现**不做脱敏**（见模块偏差）。
//!
//! # 偏差（如实标注）
//!
//! 1. 日期参数解析：Java `LocalDate.parse` / `DateUtil.parse` 抛异常（500）；
//!    Rust 返回 400 校验错误「日期格式错误，应为 yyyy-MM-dd」/
//!    「结算时间格式错误，应为 yyyy-MM-dd HH:mm:ss」。
//! 2. `@Sensitive` demo 脱敏未迁移（默认非 demo，输出原文）。
//! 3. 排序：Java 先 `buildSortOrder` 再追加 `orderByDesc(时间列)`，两层 ORDER BY；
//!    本实现固定「时间列 DESC」为主序，`sortField` 存在时作为次序。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（表结构 / 枚举 / 文案）
// ——————————————————————————————————————————————

/// `credit_settlement` 15 列（顺序与实体一致）。
pub const SETTLEMENT_COLUMNS: [&str; 15] = [
    "settlement_id",
    "settlement_sn",
    "user_id",
    "credit_user_id",
    "settlement_amount",
    "order_count",
    "remark",
    "settlement_time",
    "settlement_status",
    "cancel_time",
    "cancel_reason",
    "operator_id",
    "operator_name",
    "create_time",
    "update_time",
];

/// `credit_order` 13 列（顺序与实体一致）。
pub const ORDER_COLUMNS: [&str; 13] = [
    "credit_order_id",
    "order_id",
    "order_sn",
    "user_id",
    "credit_user_id",
    "credit_amount",
    "settlement_status",
    "settlement_id",
    "settlement_sn",
    "order_time",
    "settlement_time",
    "create_time",
    "update_time",
];

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

/// `credit_settlement` 主键列。
pub const SETTLEMENT_KEY_COLUMN: &str = "settlement_id";
/// `credit_settlement` 主键属性名。
pub const SETTLEMENT_KEY_PROPERTY: &str = "settlementId";
/// `credit_order` 主键列。
pub const ORDER_KEY_COLUMN: &str = "credit_order_id";

/// 结算状态：已结算。
pub const SETTLEMENT_STATUS_SETTLED: i32 = 1;
/// 结算状态：已撤销。
pub const SETTLEMENT_STATUS_CANCELLED: i32 = 2;

/// 账期订单结算状态：待结算。
pub const ORDER_STATUS_UNSETTLED: i32 = 0;
/// 账期订单结算状态：已结算。
pub const ORDER_STATUS_SETTLED: i32 = 1;
/// 账期订单结算状态：已取消。
pub const ORDER_STATUS_CANCELLED: i32 = 2;
/// 账期订单结算状态：退款中。
pub const ORDER_STATUS_REFUNDING: i32 = 3;

/// 授信会员状态：禁用。
pub const CREDIT_USER_DISABLED: i32 = 0;
/// 授信会员状态：启用。
pub const CREDIT_USER_ENABLED: i32 = 1;

/// 账期类型：月结（30 天）。
pub const SETTLEMENT_TYPE_MONTHLY: i32 = 1;
/// 账期类型：季结（90 天）。
pub const SETTLEMENT_TYPE_QUARTERLY: i32 = 2;

/// 订单状态：已完成（`OrderStatusEnum.COMPLETED`）。
pub const ORDER_MAIN_STATUS_COMPLETED: i32 = 5;
/// 配送状态：待发货（`ShippingStatusEnum.PENDING`）。
pub const SHIPPING_STATUS_PENDING: i32 = 0;
/// 配送状态：已收货（`ShippingStatusEnum.SHIPPED`）。
pub const SHIPPING_STATUS_SHIPPED: i32 = 2;
/// 售后类型：退货/退款（`AftersalesTypeEnum.RETURN`）。
pub const AFTERSALES_TYPE_RETURN: i32 = 1;
/// 售后类型：仅退款（`AftersalesTypeEnum.PAYRETURN`）。
pub const AFTERSALES_TYPE_PAYRETURN: i32 = 2;
/// 售后状态：已完成（`AftersalesStatusEnum.COMPLETE`）。
pub const AFTERSALES_STATUS_COMPLETE: i32 = 6;
/// 退款申请状态：已处理/财务审核通过。
pub const REFUND_STATUS_APPROVED: i32 = 2;

/// 回款流水单号已存在。
pub const MSG_SETTLEMENT_SN_EXISTS: &str = "回款流水单号已存在";
/// 订单不存在或不是账期订单。
pub const MSG_ORDER_NOT_CREDIT: &str = "订单不存在或不是账期订单";
/// 订单不属于该会员。
pub const MSG_ORDER_NOT_BELONG: &str = "订单不属于该会员";
/// 订单状态不可结算（前缀，见 [`order_not_settleable_message`]）。
pub const MSG_ORDER_STATUS_PREFIX: &str = "订单";
/// 订单状态不可结算（后缀）。
pub const MSG_ORDER_STATUS_SUFFIX: &str = "，不可结算";
/// 结算记录不存在。
pub const MSG_SETTLEMENT_NOT_FOUND: &str = "结算记录不存在";
/// 结算记录已撤销。
pub const MSG_SETTLEMENT_ALREADY_CANCELLED: &str = "该结算记录已撤销，无法重复操作";
/// 授信会员不存在。
pub const MSG_CREDIT_USER_NOT_FOUND: &str = "授信会员不存在";
/// 仅支持撤销当前账期内的结算记录。
pub const MSG_CANCEL_NOT_CURRENT_PERIOD: &str = "仅支持撤销当前账期内的结算记录";
/// 结算记录 ID 不能为空（controller 显式校验）。
pub const MSG_SETTLEMENT_ID_REQUIRED: &str = "结算记录ID不能为空";
/// 请选择会员。
pub const MSG_SELECT_USER: &str = "请选择会员";
/// 请输入回款流水单号。
pub const MSG_SN_REQUIRED: &str = "请输入回款流水单号";
/// 请选择结算时间。
pub const MSG_SETTLEMENT_TIME_REQUIRED: &str = "请选择结算时间";
/// 请选择要结算的订单。
pub const MSG_ORDERS_REQUIRED: &str = "请选择要结算的订单";
/// 结算 ID 不能为空。
pub const MSG_CANCEL_ID_REQUIRED: &str = "结算ID不能为空";
/// 恢复额度失败。
pub const MSG_RESTORE_AMOUNT_FAILED: &str = "恢复额度失败，已用额度不足";
/// 账期可用额度不足。
pub const MSG_CREDIT_AMOUNT_INSUFFICIENT: &str = "账期可用额度不足";
/// 操作人兜底名称（Java `adminUser != null ? username : "管理员"`）。
pub const FALLBACK_OPERATOR_NAME: &str = "管理员";
/// 日期格式错误（本实现补充的校验文案，见模块偏差 1）。
pub const MSG_DATE_INVALID: &str = "日期格式错误，应为 yyyy-MM-dd";
/// 结算时间格式错误（本实现补充的校验文案）。
pub const MSG_SETTLEMENT_TIME_INVALID: &str = "结算时间格式错误，应为 yyyy-MM-dd HH:mm:ss";

/// UTC+8 时区偏移秒数（Java 服务器 `ZoneId.systemDefault()`，本项目为 +08:00）。
pub const TZ_OFFSET_SECONDS: i32 = 8 * 3600;

// ——————————————————————————————————————————————
// 枚举名
// ——————————————————————————————————————————————

/// 结算状态文本（Java `CreditSettlementStatusEnum.getDescByCode`，未知 `""`）。
#[must_use]
pub fn settlement_status_text(status: i32) -> &'static str {
    match status {
        SETTLEMENT_STATUS_SETTLED => "已结算",
        SETTLEMENT_STATUS_CANCELLED => "已撤销",
        _ => "",
    }
}

/// 账期订单结算状态文本（Java `CreditOrderSettlementStatusEnum.getDescByCode`）。
#[must_use]
pub fn order_settlement_status_text(status: i32) -> &'static str {
    match status {
        ORDER_STATUS_UNSETTLED => "待结算",
        ORDER_STATUS_SETTLED => "已结算",
        ORDER_STATUS_CANCELLED => "已取消",
        ORDER_STATUS_REFUNDING => "退款中",
        _ => "",
    }
}

/// 授信会员状态文本（Java `CreditUserStatusEnum.getDescByCode`）。
#[must_use]
pub fn credit_user_status_text(status: i32) -> &'static str {
    match status {
        CREDIT_USER_DISABLED => "禁用",
        CREDIT_USER_ENABLED => "启用",
        _ => "",
    }
}

/// 账期类型文本（Java `SettlementTypeEnum.getDescByCode`）。
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

/// 会员类型文本（Java `UserCompanyType.getTypeName`：1 个人 / 2 企业）。
#[must_use]
pub fn user_company_type_text(company_type: i32) -> &'static str {
    match company_type {
        1 => "个人",
        2 => "企业",
        _ => "",
    }
}

/// 订单主状态文本（Java `OrderStatusEnum.getStatusName`）。
#[must_use]
pub fn order_status_text(status: i32) -> &'static str {
    match status {
        0 => "待支付",
        1 => "已确认，待发货",
        2 => "处理中，已发货",
        3 => "已取消",
        4 => "无效",
        ORDER_MAIN_STATUS_COMPLETED => "已完成",
        _ => "",
    }
}

/// 「订单{sn}当前状态为{desc}，不可结算」（Java 字符串拼接原文）。
#[must_use]
pub fn order_not_settleable_message(order_sn: &str, status: i32) -> String {
    format!(
        "{MSG_ORDER_STATUS_PREFIX}{order_sn}当前状态为{}，不可结算",
        order_settlement_status_text(status)
    )
}

// ——————————————————————————————————————————————
// 时间 / 账期纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`0`/`None` ⇒ `""`
/// （Java `TigUtils.handelTime`）。
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

/// UTC+8 日期 23:59:59 → 秒级时间戳（Java `LocalTime.MAX` 的秒口径）。
#[must_use]
pub fn date_end_epoch(date: chrono::NaiveDate) -> i64 {
    date.and_hms_opt(23, 59, 59)
        .map(|d| d.and_utc().timestamp() - i64::from(TZ_OFFSET_SECONDS))
        .unwrap_or(0)
}

/// 时间戳 → UTC+8 日期。
#[must_use]
pub fn epoch_to_date(secs: i64) -> chrono::NaiveDate {
    chrono::DateTime::from_timestamp(secs, 0)
        .map(|utc| {
            (utc.naive_utc() + chrono::Duration::seconds(i64::from(TZ_OFFSET_SECONDS))).date()
        })
        .unwrap_or_else(today_local)
}

/// 结算周期基点（Java `getBaseStartDate`）：
/// `period_start_time` → `create_time`（> 10^12 视为毫秒）→ 当天 0 点。
#[must_use]
pub fn base_start_date(
    period_start_time: Option<i64>,
    create_time: Option<i64>,
) -> chrono::NaiveDate {
    if let Some(secs) = period_start_time.filter(|v| *v > 0) {
        return epoch_to_date(secs);
    }
    if let Some(raw) = create_time.filter(|v| *v > 0) {
        let secs = if raw > 1_000_000_000_000 {
            raw / 1000
        } else {
            raw
        };
        return epoch_to_date(secs);
    }
    today_local()
}

/// 当前账期窗口起点（Java `getCurrentPeriodWindow`）。
#[must_use]
pub fn period_start_date(
    base_start: chrono::NaiveDate,
    today: chrono::NaiveDate,
    settlement_days: i32,
) -> chrono::NaiveDate {
    let days = settlement_days.max(1);
    let passed = (today - base_start).num_days().max(0);
    let index = passed / i64::from(days);
    base_start + chrono::Duration::days(index * i64::from(days))
}

/// 剩余账期天数（Java `calculateRemainingDays`）：
/// 逾期（上期仍有待结算/退款中订单）⇒ 0；否则 `总天数 - 周期内已过天数`。
#[must_use]
pub fn remaining_days(
    base_start: chrono::NaiveDate,
    today: chrono::NaiveDate,
    settlement_days: i32,
    has_pending_before_period: bool,
) -> i32 {
    if has_pending_before_period {
        return 0;
    }
    let days = i64::from(settlement_days.max(1));
    let start = period_start_date(base_start, today, settlement_days);
    let elapsed = (today - start).num_days().max(0);
    i32::try_from((days - elapsed).max(0)).unwrap_or(0)
}

/// 解析 `yyyy-MM-dd`（查询参数）。
pub fn parse_date(raw: &str) -> Result<chrono::NaiveDate, String> {
    chrono::NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .map_err(|_| MSG_DATE_INVALID.to_string())
}

/// 解析 `yyyy-MM-dd HH:mm:ss` → 秒级时间戳（Java `TigUtils.toTimestampYmdHms`）。
pub fn parse_datetime(raw: &str) -> Result<i64, String> {
    chrono::NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S")
        .map(|dt| dt.and_utc().timestamp() - i64::from(TZ_OFFSET_SECONDS))
        .map_err(|_| MSG_SETTLEMENT_TIME_INVALID.to_string())
}

// ——————————————————————————————————————————————
// 排序
// ——————————————————————————————————————————————

/// 结算历史排序字段 → 列名（未知回退主键）。
#[must_use]
pub fn settlement_order_column(field: &str) -> &'static str {
    match field {
        "settlementId" | "settlement_id" => "settlement_id",
        "settlementSn" | "settlement_sn" => "settlement_sn",
        "userId" | "user_id" => "user_id",
        "settlementAmount" | "settlement_amount" => "settlement_amount",
        "orderCount" | "order_count" => "order_count",
        "settlementTime" | "settlement_time" => "settlement_time",
        "settlementStatus" | "settlement_status" => "settlement_status",
        "createTime" | "create_time" => "create_time",
        _ => SETTLEMENT_KEY_COLUMN,
    }
}

/// 账期订单排序字段 → 列名（未知回退主键）。
#[must_use]
pub fn credit_order_order_column(field: &str) -> &'static str {
    match field {
        "creditOrderId" | "credit_order_id" => "credit_order_id",
        "orderId" | "order_id" => "order_id",
        "orderSn" | "order_sn" => "order_sn",
        "userId" | "user_id" => "user_id",
        "creditAmount" | "credit_amount" => "credit_amount",
        "settlementStatus" | "settlement_status" => "settlement_status",
        "orderTime" | "order_time" => "order_time",
        "settlementTime" | "settlement_time" => "settlement_time",
        _ => ORDER_KEY_COLUMN,
    }
}

/// 主时间列降序 + 可选次序（Java 两层 ORDER BY 的等价落地）。
#[must_use]
pub fn order_clause(primary: &str, sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let mut out = format!(" ORDER BY {primary} DESC");
    let field = sort_field.map(str::trim).unwrap_or("");
    if !field.is_empty() {
        let column = if primary == "settlement_time" {
            settlement_order_column(field)
        } else {
            credit_order_order_column(field)
        };
        if column != primary {
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

/// `(LIMIT, OFFSET)`（Java `BasePage` 口径：size 默认 15、上限 100）。
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

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 结算会员列表查询（Java `CreditSettlementUserListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditSettlementUserListQuery {
    /// 搜索关键字（Java 代码只匹配 `user.username LIKE`）
    pub keyword: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
}

impl CreditSettlementUserListQuery {
    /// 有效关键字（Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.trim().is_empty())
    }

    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }
}

/// 历史结算列表查询（Java `CreditSettlementListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditSettlementHistoryQuery {
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 回款流水单号（模糊）
    pub settlement_sn: Option<String>,
    /// 结算状态
    pub settlement_status: Option<i32>,
    /// 结算开始时间 `yyyy-MM-dd`
    pub settlement_time_start: Option<String>,
    /// 结算结束时间 `yyyy-MM-dd`
    pub settlement_time_end: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl CreditSettlementHistoryQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }

    /// 有效流水号（模糊）。
    #[must_use]
    pub fn effective_settlement_sn(&self) -> Option<&str> {
        self.settlement_sn
            .as_deref()
            .filter(|s| !s.trim().is_empty())
    }

    /// 结算时间下界（秒）。
    pub fn time_start_epoch(&self) -> Result<Option<i64>, String> {
        match self
            .settlement_time_start
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            Some(raw) => Ok(Some(date_start_epoch(parse_date(raw)?))),
            None => Ok(None),
        }
    }

    /// 结算时间上界（秒）。
    pub fn time_end_epoch(&self) -> Result<Option<i64>, String> {
        match self
            .settlement_time_end
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            Some(raw) => Ok(Some(date_end_epoch(parse_date(raw)?))),
            None => Ok(None),
        }
    }

    /// ORDER BY（`settlement_time DESC` 主序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(
            "settlement_time",
            self.sort_field.as_deref(),
            self.sort_order.as_deref(),
        )
    }
}

/// 账期订单列表查询（Java `CreditOrderListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditOrderListQuery {
    /// 订单号（模糊）
    pub order_sn: Option<String>,
    /// 会员 ID
    pub user_id: Option<i32>,
    /// 会员用户名（模糊）
    pub username: Option<String>,
    /// 联系方式手机号（模糊）
    pub mobile: Option<String>,
    /// 订单状态
    pub order_status: Option<i32>,
    /// 结算状态
    pub settlement_status: Option<i32>,
    /// 结算状态集合（pendingOrders 强制 [0,3]）
    pub settlement_status_list: Option<Vec<i32>>,
    /// 回款流水单号（模糊）
    pub settlement_sn: Option<String>,
    /// 结算记录 ID
    pub settlement_id: Option<i32>,
    /// 下单开始时间 `yyyy-MM-dd`
    pub order_time_start: Option<String>,
    /// 下单结束时间 `yyyy-MM-dd`
    pub order_time_end: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl CreditOrderListQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }

    /// 有效字符串过滤（`StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective<'a>(&self, value: &'a Option<String>) -> Option<&'a str> {
        value.as_deref().filter(|s| !s.trim().is_empty())
    }

    /// `pendingOrders` 入口：Java 强制 `settlementStatusList = [0, 3]`。
    #[must_use]
    pub fn for_pending_orders(mut self) -> Self {
        self.settlement_status_list = Some(vec![ORDER_STATUS_UNSETTLED, ORDER_STATUS_REFUNDING]);
        self
    }

    /// 下单时间下界（秒）。
    pub fn time_start_epoch(&self) -> Result<Option<i64>, String> {
        match self
            .order_time_start
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            Some(raw) => Ok(Some(date_start_epoch(parse_date(raw)?))),
            None => Ok(None),
        }
    }

    /// 下单时间上界（秒）。
    pub fn time_end_epoch(&self) -> Result<Option<i64>, String> {
        match self
            .order_time_end
            .as_deref()
            .filter(|s| !s.trim().is_empty())
        {
            Some(raw) => Ok(Some(date_end_epoch(parse_date(raw)?))),
            None => Ok(None),
        }
    }

    /// ORDER BY（`order_time DESC` 主序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(
            "order_time",
            self.sort_field.as_deref(),
            self.sort_order.as_deref(),
        )
    }
}

/// 确认结算入参（Java `CreditSettlementSubmitDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditSettlementSubmitDTO {
    /// 会员 ID（`@NotNull(message = "请选择会员")`）
    pub user_id: Option<i32>,
    /// 回款流水单号（`@NotBlank`）
    pub settlement_sn: Option<String>,
    /// 结算时间 `yyyy-MM-dd HH:mm:ss`（`@NotBlank`）
    pub settlement_time: Option<String>,
    /// 备注
    pub remark: Option<String>,
    /// 要结算的订单 ID 列表（`@NotEmpty`）
    pub order_ids: Option<Vec<i32>>,
}

/// 校验后的提交参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreditSettlementSubmit {
    /// 会员 ID
    pub user_id: i32,
    /// 回款流水单号（trim 后）
    pub settlement_sn: String,
    /// 结算时间（秒级时间戳）
    pub settlement_time: i64,
    /// 备注
    pub remark: Option<String>,
    /// 订单 ID 列表
    pub order_ids: Vec<i32>,
}

impl CreditSettlementSubmitDTO {
    /// 注解校验（顺序与 Bean Validation 字段声明一致）。
    pub fn validate(&self) -> Result<CreditSettlementSubmit, String> {
        let user_id = self.user_id.ok_or_else(|| MSG_SELECT_USER.to_string())?;
        let sn = self
            .settlement_sn
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| MSG_SN_REQUIRED.to_string())?;
        let time = self
            .settlement_time
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| MSG_SETTLEMENT_TIME_REQUIRED.to_string())?;
        let order_ids = self
            .order_ids
            .as_deref()
            .filter(|v| !v.is_empty())
            .ok_or_else(|| MSG_ORDERS_REQUIRED.to_string())?;
        let settlement_time = parse_datetime(time)?;
        Ok(CreditSettlementSubmit {
            user_id,
            settlement_sn: sn.to_string(),
            settlement_time,
            remark: self.remark.clone(),
            order_ids: order_ids.to_vec(),
        })
    }
}

/// 撤销结算入参（Java `CreditSettlementCancelDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditSettlementCancelDTO {
    /// 结算 ID（`@NotNull(message = "结算ID不能为空")`）
    pub settlement_id: Option<i32>,
    /// 撤销原因
    pub cancel_reason: Option<String>,
}

impl CreditSettlementCancelDTO {
    /// 校验并返回 `(settlement_id, cancel_reason)`。
    pub fn validate(&self) -> Result<(i32, Option<String>), String> {
        let id = self
            .settlement_id
            .ok_or_else(|| MSG_CANCEL_ID_REQUIRED.to_string())?;
        Ok((id, self.cancel_reason.clone()))
    }
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 结算会员列表行（Java `CreditSettlementUserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditSettlementUserVO {
    pub credit_user_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    /// 手机号（Java `@Sensitive(PHONE)`，仅 demo 模式脱敏；本实现原样返回）
    pub mobile: Option<String>,
    /// 会员类型：1 个人 / 2 企业
    pub r#type: Option<i32>,
    pub type_text: Option<String>,
    pub contact_name: Option<String>,
    pub company_name: Option<String>,
    pub credit_limit: Decimal,
    pub used_amount: Decimal,
    pub available_amount: Decimal,
    pub status: i32,
    pub status_text: String,
    pub settlement_type: i32,
    pub settlement_type_text: String,
    pub settlement_days: i32,
    pub remaining_days: i32,
    pub pending_order_count: i32,
    pub pending_amount: Decimal,
}

/// 历史结算行（Java `CreditSettlementVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditSettlementVO {
    pub settlement_id: i32,
    pub settlement_sn: String,
    pub user_id: i32,
    pub username: Option<String>,
    pub settlement_amount: Decimal,
    pub order_count: i32,
    pub remark: Option<String>,
    /// Java `handelTime`（null/0 ⇒ ""）
    pub settlement_time: String,
    pub settlement_status: i32,
    pub settlement_status_text: String,
    /// 仅当实体非 null 时赋值（否则 null）
    pub cancel_time: Option<String>,
    pub cancel_reason: Option<String>,
    pub operator_name: Option<String>,
    /// Java `handelTime`
    pub create_time: String,
}

/// 账期订单行（Java `CreditOrderVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditOrderVO {
    pub credit_order_id: i32,
    pub order_id: i32,
    pub order_sn: String,
    pub user_id: i32,
    pub username: Option<String>,
    /// 手机号（Java `@Sensitive(PHONE)`，仅 demo 模式脱敏；本实现原样返回）
    pub mobile: Option<String>,
    pub company_name: Option<String>,
    pub order_amount: Option<Decimal>,
    pub credit_amount: Decimal,
    pub refunded_amount: Decimal,
    pub order_status: Option<i32>,
    pub order_status_text: Option<String>,
    pub settlement_status: i32,
    pub settlement_status_text: String,
    pub settlement_sn: Option<String>,
    /// Java `handelTime`
    pub order_time: String,
    /// Java `handelTime`（原值为 null 时不赋值 ⇒ null）
    pub settlement_time: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_texts_match_java() {
        assert_eq!(settlement_status_text(1), "已结算");
        assert_eq!(settlement_status_text(2), "已撤销");
        assert_eq!(settlement_status_text(9), "");
        assert_eq!(order_settlement_status_text(0), "待结算");
        assert_eq!(order_settlement_status_text(1), "已结算");
        assert_eq!(order_settlement_status_text(2), "已取消");
        assert_eq!(order_settlement_status_text(3), "退款中");
        assert_eq!(credit_user_status_text(0), "禁用");
        assert_eq!(credit_user_status_text(1), "启用");
        assert_eq!(settlement_type_text(1), "月结");
        assert_eq!(settlement_type_text(2), "季结");
        assert_eq!(settlement_type_days(1), 30);
        assert_eq!(settlement_type_days(2), 90);
        assert_eq!(settlement_type_days(99), 30);
        assert_eq!(user_company_type_text(1), "个人");
        assert_eq!(user_company_type_text(2), "企业");
        assert_eq!(order_status_text(0), "待支付");
        assert_eq!(order_status_text(5), "已完成");
        assert_eq!(
            order_not_settleable_message("SN1", 3),
            "订单SN1当前状态为退款中，不可结算"
        );
    }

    #[test]
    fn time_formatting_and_parsing() {
        assert_eq!(format_time(None), "");
        assert_eq!(format_time(Some(0)), "");
        // 2023-11-14T22:13:20Z + 8h
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        let date = parse_date("2026-01-15").unwrap();
        assert_eq!(date_start_epoch(date), 1_768_406_400);
        assert_eq!(date_end_epoch(date), 1_768_406_400 + 86_399);
        assert_eq!(epoch_to_date(1_768_406_400), date);
        let secs = parse_datetime("2026-01-15 10:30:00").unwrap();
        assert_eq!(format_time(Some(secs)), "2026-01-15 10:30:00");
        assert_eq!(parse_date("2026/01/15").unwrap_err(), MSG_DATE_INVALID);
        assert_eq!(
            parse_datetime("2026-01-15").unwrap_err(),
            MSG_SETTLEMENT_TIME_INVALID
        );
    }

    #[test]
    fn base_start_and_period_window() {
        let today = chrono::NaiveDate::from_ymd_opt(2026, 3, 15).unwrap();
        let base = chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        // 月结 30 天：1/1 起第 3 个周期（1/1+60=3/2 ~ 3/31）
        assert_eq!(
            period_start_date(base, today, 30),
            chrono::NaiveDate::from_ymd_opt(2026, 3, 2).unwrap()
        );
        // 未逾期：30 - 13 = 17
        assert_eq!(remaining_days(base, today, 30, false), 17);
        // 逾期 ⇒ 0
        assert_eq!(remaining_days(base, today, 30, true), 0);
        // 季结 90 天：1/1 起仍在第一周期，剩 90-73=17
        assert_eq!(remaining_days(base, today, 90, false), 17);
        // base 用 period_start_time / create_time（毫秒自动折算）
        assert_eq!(
            base_start_date(Some(1_768_406_400), None),
            chrono::NaiveDate::from_ymd_opt(2026, 1, 15).unwrap()
        );
        let ms = 1_768_406_400_000;
        assert_eq!(
            base_start_date(None, Some(ms)),
            chrono::NaiveDate::from_ymd_opt(2026, 1, 15).unwrap()
        );
    }

    #[test]
    fn submit_validation_messages() {
        let mut dto = CreditSettlementSubmitDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_SELECT_USER);
        dto.user_id = Some(3);
        assert_eq!(dto.validate().unwrap_err(), MSG_SN_REQUIRED);
        dto.settlement_sn = Some("  ".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_SN_REQUIRED);
        dto.settlement_sn = Some(" SN2026 ".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_SETTLEMENT_TIME_REQUIRED);
        dto.settlement_time = Some("2026-01-15 10:30:00".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_ORDERS_REQUIRED);
        dto.order_ids = Some(vec![]);
        assert_eq!(dto.validate().unwrap_err(), MSG_ORDERS_REQUIRED);
        dto.order_ids = Some(vec![1, 2]);
        let out = dto.validate().unwrap();
        assert_eq!(out.user_id, 3);
        assert_eq!(out.settlement_sn, "SN2026");
        assert_eq!(out.order_ids, vec![1, 2]);
        assert_eq!(
            format_time(Some(out.settlement_time)),
            "2026-01-15 10:30:00"
        );
    }

    #[test]
    fn cancel_validation() {
        let mut dto = CreditSettlementCancelDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_CANCEL_ID_REQUIRED);
        dto.settlement_id = Some(7);
        assert_eq!(dto.validate().unwrap(), (7, None));
        dto.cancel_reason = Some("金额有误".into());
        assert_eq!(dto.validate().unwrap(), (7, Some("金额有误".into())));
    }

    #[test]
    fn pagination_and_sort_clause() {
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(2), Some(10)), (10, 10));
        assert_eq!(limit_offset(Some(1), Some(500)), (100, 0));
        assert_eq!(
            order_clause("settlement_time", None, None),
            " ORDER BY settlement_time DESC"
        );
        assert_eq!(
            order_clause("settlement_time", Some("settlementAmount"), Some("asc")),
            " ORDER BY settlement_time DESC, settlement_amount ASC"
        );
        // 同主列不重复
        assert_eq!(
            order_clause("order_time", Some("orderTime"), Some("asc")),
            " ORDER BY order_time DESC"
        );
        // 未知字段回退主键作为次序（防注入）
        assert_eq!(
            order_clause("order_time", Some("x; DROP TABLE credit_order"), None),
            " ORDER BY order_time DESC, credit_order_id DESC"
        );
    }

    #[test]
    fn pending_orders_forces_status_list() {
        let q = CreditOrderListQuery {
            settlement_status: Some(1),
            settlement_status_list: Some(vec![2]),
            ..Default::default()
        }
        .for_pending_orders();
        assert_eq!(q.settlement_status_list, Some(vec![0, 3]));
        assert_eq!(q.settlement_status, Some(1));
    }

    #[test]
    fn history_query_time_bounds() {
        let q = CreditSettlementHistoryQuery {
            settlement_time_start: Some("2026-01-15".into()),
            settlement_time_end: Some("  ".into()),
            ..Default::default()
        };
        assert_eq!(
            q.time_start_epoch().unwrap(),
            Some(date_start_epoch(parse_date("2026-01-15").unwrap()))
        );
        assert_eq!(q.time_end_epoch().unwrap(), None);
        let bad = CreditSettlementHistoryQuery {
            settlement_time_start: Some("bad".into()),
            ..Default::default()
        };
        assert_eq!(bad.time_start_epoch().unwrap_err(), MSG_DATE_INVALID);
    }
}
