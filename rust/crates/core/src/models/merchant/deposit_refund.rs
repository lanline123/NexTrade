//! 保证金退还域（merchant::deposit_refund）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.deposit.DepositRefundController`
//!   （`@RequestMapping("/adminapi/deposit/refund")`，7 个端点）
//! - `com.tigshop.service.deposit.impl.DepositRefundServiceImpl`（750 行）
//! - `DepositRefundApplyDTO` / `DepositRefundAuditDTO` / `DepositRefundListDTO`
//! - `DepositRefundVO` / `DepositFullRefundCheckVO`
//! - 枚举 `DepositOwnerType` / `DepositRefundStatus` / `DepositRefundType` / `DepositLogType`
//!
//! # 与 Java 的口径说明
//!
//! - 金额出参为两位小数文本（Java 为 JSON number），与同 ctx `deposit_account` /
//!   `deposit_recharge` 的既有约定一致，见 `uncertain_points`。
//! - 时间文本复用 `TigUtils.handelTime` 口径（null/0 → 空串），见 [`format_time`]。
//! - 「有效可退」= `max(0, 可提现 - 待审核退还总额)`，其中
//!   `可提现 = max(0, 实缴 - 应缴)`；应缴的「按类目规则取最高」未迁移，
//!   沿用同域 `deposit_account` 的 `required_manual` 优先、否则
//!   `required_snapshot` 口径（见 [`required_of`]）。
//! - 全额退还 5 个前置条件（停业/进行中订单/未完结售后/收货冷静期/进行中退还单）
//!   的文案与业务码逐字对齐 Java `HttpStatus` 5407~5411。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;
use crate::Error;

// ——————————————————————————————————————————————
// 常量（Java `HttpStatus` / 枚举 / 配置键 / 错误文案）
// ——————————————————————————————————————————————

/// Java `HttpStatus.SERVICE_DATA_ERROR`。
pub const SERVICE_DATA_ERROR: i32 = 1001;
/// Java `HttpStatus.DEPOSIT_AMOUNT_INVALID`。
pub const DEPOSIT_AMOUNT_INVALID: i32 = 5401;
/// Java `HttpStatus.DEPOSIT_BALANCE_NOT_ENOUGH`。
pub const DEPOSIT_BALANCE_NOT_ENOUGH: i32 = 5402;
/// Java `HttpStatus.DEPOSIT_REFUND_STATUS_INVALID`。
pub const DEPOSIT_REFUND_STATUS_INVALID: i32 = 5404;
/// Java `HttpStatus.DEPOSIT_REFUND_SHOP_NOT_CLOSED`。
pub const DEPOSIT_REFUND_SHOP_NOT_CLOSED: i32 = 5407;
/// Java `HttpStatus.DEPOSIT_REFUND_HAS_ONGOING_ORDER`。
pub const DEPOSIT_REFUND_HAS_ONGOING_ORDER: i32 = 5408;
/// Java `HttpStatus.DEPOSIT_REFUND_HAS_ONGOING_AFTERSALE`。
pub const DEPOSIT_REFUND_HAS_ONGOING_AFTERSALE: i32 = 5409;
/// Java `HttpStatus.DEPOSIT_REFUND_COOLDOWN_NOT_REACHED`。
pub const DEPOSIT_REFUND_COOLDOWN_NOT_REACHED: i32 = 5410;
/// Java `HttpStatus.DEPOSIT_REFUND_HAS_ONGOING_REFUND`。
pub const DEPOSIT_REFUND_HAS_ONGOING_REFUND: i32 = 5411;
/// Java `HttpStatus.DEPOSIT_WITHDRAW_EXCEED_LIMIT`。
pub const DEPOSIT_WITHDRAW_EXCEED_LIMIT: i32 = 5412;

/// 持有者类型：店铺（Java `DepositOwnerType.SHOP`）。
pub const OWNER_SHOP: i32 = 1;
/// 持有者类型：供应商（Java `DepositOwnerType.SUPPLIER`）。
pub const OWNER_SUPPLIER: i32 = 2;

/// 退还类型：部分退还/提现（Java `DepositRefundType.WITHDRAW`）。
pub const REFUND_TYPE_WITHDRAW: i32 = 1;
/// 退还类型：全额退还（Java `DepositRefundType.FULL_REFUND`）。
pub const REFUND_TYPE_FULL: i32 = 2;

/// 退还单状态：待审核（Java `DepositRefundStatus.PENDING_REVIEW`）。
pub const REFUND_PENDING: i32 = 0;
/// 退还单状态：已通过/已完成（Java `DepositRefundStatus.COMPLETED`）。
pub const REFUND_COMPLETED: i32 = 1;
/// 退还单状态：未通过（Java `DepositRefundStatus.REJECTED`）。
pub const REFUND_REJECTED: i32 = 2;

/// 保证金流水类型：提现出账（Java `DepositLogType.WITHDRAW`；退还审计统一写该类）。
pub const LOG_TYPE_WITHDRAW: i32 = 2;
/// 保证金流水类型：退还出账（Java `DepositLogType.REFUND`，存量值）。
pub const LOG_TYPE_REFUND: i32 = 3;
/// 保证金流水类型：平台调整（Java `DepositLogType.ADJUST`，带符号金额）。
pub const LOG_TYPE_ADJUST: i32 = 5;

/// 配置键：保证金功能开关（Java `DepositSettingServiceImpl.KEY_ENABLE`）。
pub const CONFIG_DEPOSIT_ENABLE: &str = "deposit_enable";
/// 配置键：售后限制天数（Java `SettingsEnum.AFTER_SALES_LIMIT_DAYS`）。
pub const CONFIG_AFTER_SALES_LIMIT_DAYS: &str = "afterSalesLimitDays";
/// 配置键：末单收货冷静期天数（Java `CONFIG_REFUND_COOLING_DAYS`）。
pub const CONFIG_REFUND_COOLING_DAYS: &str = "deposit_refund_cooling_days";
/// 冷静期默认天数（Java `DEFAULT_REFUND_COOLING_DAYS = 7`）。
pub const DEFAULT_REFUND_COOLING_DAYS: i64 = 7;
/// 一天的秒数（Java `SECONDS_PER_DAY`）。
pub const SECONDS_PER_DAY: i64 = 86_400;

/// 「进行中订单」口径：待支付 0 / 待发货 1 / 已发货 2（Java `ONGOING_ORDER_STATUS`）。
pub const ONGOING_ORDER_STATUS: [i32; 3] = [0, 1, 2];
/// 售后状态：已完成（Java `AftersalesStatusEnum.COMPLETE`，未完结口径排除）。
pub const AFTERSALES_COMPLETE: i32 = 6;
/// 售后状态：已取消（Java `AftersalesStatusEnum.CANCEL`，未完结口径排除）。
pub const AFTERSALES_CANCEL: i32 = 7;
/// 店铺状态：暂停运营（可全额退还）。
pub const SHOP_STATUS_PAUSED: i32 = 4;
/// 店铺状态：关店（可全额退还）。
pub const SHOP_STATUS_CLOSED: i32 = 10;
/// 供应商状态：关闭（可全额退还）。
pub const VENDOR_STATUS_CLOSED: i32 = 2;

/// `持有者不存在`
pub const MSG_OWNER_NOT_EXIST: &str = "持有者不存在";
/// `保证金金额非法`
pub const MSG_AMOUNT_INVALID: &str = "保证金金额非法";
/// `保证金余额不足`
pub const MSG_BALANCE_NOT_ENOUGH: &str = "保证金余额不足";
/// `退还类型非法`
pub const MSG_REFUND_TYPE_INVALID: &str = "退还类型非法";
/// `退还金额超过可退上限`
pub const MSG_EXCEED_LIMIT: &str = "退还金额超过可退上限";
/// `退还单不存在`
pub const MSG_REFUND_NOT_EXIST: &str = "退还单不存在";
/// `退还单状态非法`
pub const MSG_REFUND_STATUS_INVALID: &str = "退还单状态非法";
/// `打款凭证不能为空`
pub const MSG_PAY_VOUCHER_REQUIRED: &str = "打款凭证不能为空";
/// `全额退还需店铺停业`
pub const MSG_SHOP_NOT_CLOSED: &str = "全额退还需店铺停业";
/// `全额退还需供应商已停业关闭`
pub const MSG_VENDOR_NOT_CLOSED: &str = "全额退还需供应商已停业关闭";
/// `存在进行中订单`
pub const MSG_HAS_ONGOING_ORDER: &str = "存在进行中订单";
/// `存在进行中售后`
pub const MSG_HAS_ONGOING_AFTERSALE: &str = "存在进行中售后";
/// `未过末单收货冷静期`
pub const MSG_COOLDOWN_NOT_REACHED: &str = "未过末单收货冷静期";
/// `存在进行中退还单`
pub const MSG_HAS_ONGOING_REFUND: &str = "存在进行中退还单";

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`，`<= 0` → 空串）。
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

/// 持有者类型文案（Java `DepositOwnerType.getDescByCode`）。
#[must_use]
pub fn owner_type_text(code: i32) -> &'static str {
    match code {
        OWNER_SHOP => "店铺",
        OWNER_SUPPLIER => "供应商",
        _ => "",
    }
}

/// 退还单状态文案（Java `DepositRefundStatus.getDescByCode`）。
#[must_use]
pub fn refund_status_text(code: i32) -> &'static str {
    match code {
        REFUND_PENDING => "待审核",
        REFUND_COMPLETED => "已通过",
        REFUND_REJECTED => "未通过",
        _ => "",
    }
}

/// 退还类型文案（Java `DepositRefundType.getDescByCode`）。
#[must_use]
pub fn refund_type_text(code: i32) -> &'static str {
    match code {
        REFUND_TYPE_WITHDRAW => "部分退还",
        REFUND_TYPE_FULL => "全部退还",
        _ => "",
    }
}

/// 主体类型文案（1 个人 2 企业）。
#[must_use]
pub fn subject_type_text(code: i32) -> &'static str {
    match code {
        1 => "个人",
        2 => "企业",
        _ => "",
    }
}

/// Java `BasePage#getPage/getSize`：page 缺省 1；size 缺省 15、上限 100。
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

/// 退还单列表允许的排序字段（属性名/列名白名单，非法回退主键）。
#[must_use]
pub fn refund_sort_column(field: Option<&str>) -> &'static str {
    match field.map(str::trim).filter(|f| !f.is_empty()) {
        Some("shopDepositRefundId") | Some("shop_deposit_refund_id") => "shop_deposit_refund_id",
        Some("ownerType") | Some("owner_type") => "owner_type",
        Some("ownerId") | Some("owner_id") => "owner_id",
        Some("type") | Some("r#type") => "type",
        Some("amount") => "amount",
        Some("payeeInfo") | Some("payee_info") => "payee_info",
        Some("reason") => "reason",
        Some("status") => "status",
        Some("payVoucher") | Some("pay_voucher") => "pay_voucher",
        Some("auditAdminId") | Some("audit_admin_id") => "audit_admin_id",
        Some("auditTime") | Some("audit_time") => "audit_time",
        Some("auditRemark") | Some("audit_remark") => "audit_remark",
        Some("addTime") | Some("add_time") => "add_time",
        Some("updateTime") | Some("update_time") => "update_time",
        _ => "shop_deposit_refund_id",
    }
}

/// 排序方向：`asc` → true（其余含空 → 降序）。
#[must_use]
pub fn sort_is_asc(order: Option<&str>) -> bool {
    matches!(order.map(str::trim), Some(v) if v.eq_ignore_ascii_case("asc"))
}

/// 保证金账户变动（Java `DepositAccountServiceImpl#changeDeposit` 核心分支）。
///
/// 返回 `(change_amount, after_paid)`；本域审计固定写 `WITHDRAW`（扣减），
/// 但保留与 Java 一致的三个分支（ADJUST 带符号 / RECHARGE 加 / 其它减）。
pub fn deposit_change(
    paid: Decimal,
    amount: Decimal,
    log_type: i32,
) -> Result<(Decimal, Decimal), Error> {
    if log_type == LOG_TYPE_ADJUST {
        if amount == Decimal::ZERO {
            return Err(Error::biz(DEPOSIT_AMOUNT_INVALID, MSG_AMOUNT_INVALID));
        }
        let after = paid + amount;
        if after < Decimal::ZERO {
            return Err(Error::biz(
                DEPOSIT_BALANCE_NOT_ENOUGH,
                MSG_BALANCE_NOT_ENOUGH,
            ));
        }
        return Ok((amount, after));
    }
    if amount <= Decimal::ZERO {
        return Err(Error::biz(DEPOSIT_AMOUNT_INVALID, MSG_AMOUNT_INVALID));
    }
    if log_type == 1 {
        return Ok((amount, paid + amount));
    }
    if paid < amount {
        return Err(Error::biz(
            DEPOSIT_BALANCE_NOT_ENOUGH,
            MSG_BALANCE_NOT_ENOUGH,
        ));
    }
    Ok((-amount, paid - amount))
}

/// 保证金功能是否开启（Java `isDepositEnabled`：`deposit_enable` 解析为 1）。
#[must_use]
pub fn is_deposit_enabled(raw: Option<&str>) -> bool {
    raw.and_then(|v| v.trim().parse::<i32>().ok()) == Some(1)
}

/// 应缴金额（Java `computeRequired` 的降级口径）：
/// 功能关闭 → 0；手动应缴优先，否则取应缴快照。
///
/// ⚠️ Java 还有「未激活收取（`collect_activated != 1`）→ 0」与
/// 「按类目规则取最高（`DepositRuleMatcher`）」两个分支，均未迁移，
/// 沿用同域 `deposit_account` 的既有口径（见 `uncertain_points`）。
#[must_use]
pub fn required_of(
    enabled: bool,
    required_manual: Option<Decimal>,
    required_snapshot: Decimal,
) -> Decimal {
    if !enabled {
        return Decimal::ZERO;
    }
    required_manual.unwrap_or(required_snapshot)
}

/// 可提现金额 = `max(0, 实缴 - 应缴)`（Java `available`/`withdrawable`）。
#[must_use]
pub fn withdrawable(paid: Decimal, required: Decimal) -> Decimal {
    let value = paid - required;
    if value < Decimal::ZERO {
        Decimal::ZERO
    } else {
        value
    }
}

/// 有效可退 = `max(0, 可提现 - 待审核退还总额)`（Java `effectiveRefundable`）。
#[must_use]
pub fn effective_refundable(withdrawable: Decimal, pending_refund: Decimal) -> Decimal {
    let value = withdrawable - pending_refund;
    if value < Decimal::ZERO {
        Decimal::ZERO
    } else {
        value
    }
}

/// 售后限制天数（Java `resolveAfterSalesLimitDays`）：
/// 配置缺失/非法/非正 → 0（条件 4 自动满足）。
#[must_use]
pub fn after_sales_limit_days(raw: Option<&str>) -> i64 {
    raw.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return None;
        }
        trimmed
            .parse::<f64>()
            .ok()
            .map(|f| f as i64)
            .filter(|days| *days > 0)
    })
    .unwrap_or(0)
}

/// 末单收货冷静期天数（Java `resolveCoolingDays`）：
/// 配置缺失/非法/为负 → 默认 7 天。
#[must_use]
pub fn cooling_days(raw: Option<&str>) -> i64 {
    match raw.map(str::trim).filter(|v| !v.is_empty()) {
        Some(value) => match value.parse::<i64>() {
            Ok(days) if days >= 0 => days,
            _ => DEFAULT_REFUND_COOLING_DAYS,
        },
        None => DEFAULT_REFUND_COOLING_DAYS,
    }
}

/// 店铺是否处于「停业/关店」状态（Java 全额退还条件 1：status 4 或 10）。
#[must_use]
pub fn shop_is_closed(status: Option<i32>) -> bool {
    matches!(status, Some(SHOP_STATUS_PAUSED) | Some(SHOP_STATUS_CLOSED))
}

/// 供应商是否关闭（Java 全额退还条件 1：status = 2）。
#[must_use]
pub fn vendor_is_closed(status: Option<i32>) -> bool {
    status == Some(VENDOR_STATUS_CLOSED)
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 退还/提现申请（Java `DepositRefundApplyDTO`；shopId/vendorId 取自请求头）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRefundApplyDTO {
    /// 退还类型 1提现/部分退还 2全额退还
    pub r#type: Option<i32>,
    /// 退还金额
    pub amount: Option<Decimal>,
    /// 收款信息
    pub payee_info: Option<String>,
    /// 退还原因
    pub reason: Option<String>,
}

/// 退还审核（Java `DepositRefundAuditDTO`，一步式：通过即出账完成）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRefundAuditDTO {
    /// 退还单 id
    pub id: Option<i32>,
    /// 是否通过：true 通过（出账并完成），false 驳回
    pub pass: Option<bool>,
    /// 打款凭证（通过时必填）
    pub pay_voucher: Option<String>,
    /// 审核备注/驳回原因
    pub audit_remark: Option<String>,
}

/// 平台端退还单列表查询（Java `DepositRefundListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRefundListQuery {
    /// 持有者类型 1店铺 2供应商；不传=全部
    pub owner_type: Option<i32>,
    /// 持有者 id
    pub owner_id: Option<i32>,
    /// 兼容旧入参：等价于 ownerId
    pub shop_id: Option<i32>,
    /// 组织名称（店铺名/供应商名模糊匹配）
    pub owner_name: Option<String>,
    /// 主体类型（商户性质：1个人 2企业）
    pub subject_type: Option<i32>,
    /// 退还类型 1部分退还 2全部退还
    pub r#type: Option<i32>,
    /// 状态 0待审核 1已通过 2未通过
    pub status: Option<i32>,
    /// 申请开始时间（秒级）
    pub start_time: Option<i64>,
    /// 申请结束时间（秒级）
    pub end_time: Option<i64>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    /// 排序字段（属性名或列名，非法回退主键）
    pub sort_field: Option<String>,
    /// asc|desc
    pub sort_order: Option<String>,
}

impl DepositRefundListQuery {
    /// 有效 ownerId（Java：优先 ownerId，兼容旧入参 shopId）。
    #[must_use]
    pub fn effective_owner_id(&self) -> Option<i32> {
        self.owner_id.or(self.shop_id).filter(|v| *v > 0)
    }
}

/// 平台端退还单详情查询（Java `detail(Integer id)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RefundIdQuery {
    /// 退还单 id（Java 可为 null → 返回 null）
    pub id: Option<i32>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 退还/提现单（Java `DepositRefundVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRefundVO {
    pub shop_deposit_refund_id: i32,
    pub owner_type: i32,
    pub owner_type_text: String,
    pub subject_type: Option<i32>,
    pub subject_type_text: Option<String>,
    pub owner_id: i32,
    pub owner_name: Option<String>,
    /// 兼容字段：值同 ownerId（Java 无条件赋值）
    pub shop_id: i32,
    /// 兼容字段：仅店铺维度回填
    pub shop_name: Option<String>,
    pub r#type: i32,
    pub type_text: String,
    /// 退还金额（两位小数文本，见模块注释）
    pub amount: String,
    pub payee_info: Option<String>,
    pub reason: Option<String>,
    pub status: i32,
    pub status_text: String,
    pub pay_voucher: Option<String>,
    pub audit_admin_id: i32,
    pub audit_time: i64,
    pub audit_time_text: String,
    pub audit_remark: Option<String>,
    pub add_time: i64,
    pub add_time_text: String,
}

/// 「能否全额退还」预检结果（Java `DepositFullRefundCheckVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositFullRefundCheckVO {
    /// 是否可全额退还
    pub can_refund: bool,
    /// 可退金额（可退时 = 有效可退；不可退时 0）
    pub refundable_amount: String,
    /// 售后限制天数（末单确认收货满 xxx 天，前端文案用）
    pub after_sales_limit_days: i32,
    /// 不满足全额退还的原因（可退时为空）
    pub unmet_reasons: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Decimal {
        s.parse().expect("decimal")
    }

    #[test]
    fn texts_match_java_enums() {
        assert_eq!(owner_type_text(1), "店铺");
        assert_eq!(owner_type_text(2), "供应商");
        assert_eq!(refund_status_text(0), "待审核");
        assert_eq!(refund_status_text(1), "已通过");
        assert_eq!(refund_status_text(2), "未通过");
        assert_eq!(refund_type_text(1), "部分退还");
        assert_eq!(refund_type_text(2), "全部退还");
        assert_eq!(subject_type_text(1), "个人");
        assert_eq!(subject_type_text(2), "企业");
    }

    #[test]
    fn amount_helpers_match_java_effective_refundable() {
        assert_eq!(withdrawable(d("120"), d("100")), d("20"));
        assert_eq!(withdrawable(d("80"), d("100")), Decimal::ZERO);
        assert_eq!(effective_refundable(d("20"), d("5")), d("15"));
        assert_eq!(effective_refundable(d("20"), d("50")), Decimal::ZERO);
        // 功能关闭 → 应缴 0
        assert_eq!(required_of(false, Some(d("500")), d("100")), Decimal::ZERO);
        assert_eq!(required_of(true, Some(d("500")), d("100")), d("500"));
        assert_eq!(required_of(true, None, d("100")), d("100"));
    }

    #[test]
    fn config_parsers_match_java_fallbacks() {
        // deposit_enable
        assert!(is_deposit_enabled(Some("1")));
        assert!(is_deposit_enabled(Some(" 1 ")));
        assert!(!is_deposit_enabled(Some("0")));
        assert!(!is_deposit_enabled(Some("x")));
        assert!(!is_deposit_enabled(None));
        // 售后限制天数：缺失/非法/非正 → 0
        assert_eq!(after_sales_limit_days(Some("15")), 15);
        assert_eq!(after_sales_limit_days(Some("15.0")), 15);
        assert_eq!(after_sales_limit_days(Some("0")), 0);
        assert_eq!(after_sales_limit_days(Some("-3")), 0);
        assert_eq!(after_sales_limit_days(Some("x")), 0);
        assert_eq!(after_sales_limit_days(None), 0);
        // 冷静期：缺失/非法/负 → 默认 7
        assert_eq!(cooling_days(Some("0")), 0);
        assert_eq!(cooling_days(Some("10")), 10);
        assert_eq!(cooling_days(Some("-1")), DEFAULT_REFUND_COOLING_DAYS);
        assert_eq!(cooling_days(Some("x")), DEFAULT_REFUND_COOLING_DAYS);
        assert_eq!(cooling_days(None), DEFAULT_REFUND_COOLING_DAYS);
    }

    #[test]
    fn closed_status_checks_match_java() {
        assert!(shop_is_closed(Some(SHOP_STATUS_PAUSED)));
        assert!(shop_is_closed(Some(SHOP_STATUS_CLOSED)));
        assert!(!shop_is_closed(Some(1)));
        assert!(!shop_is_closed(None));
        assert!(vendor_is_closed(Some(VENDOR_STATUS_CLOSED)));
        assert!(!vendor_is_closed(Some(1)));
        assert!(!vendor_is_closed(None));
    }

    #[test]
    fn deposit_change_matches_change_deposit() {
        // 退还审计固定走 WITHDRAW：扣减
        assert_eq!(
            deposit_change(d("100"), d("40"), LOG_TYPE_WITHDRAW).unwrap(),
            (d("-40"), d("60"))
        );
        // 余额不足 → 5402
        let err = deposit_change(d("10"), d("40"), LOG_TYPE_WITHDRAW).unwrap_err();
        assert_eq!(err.business_code(), DEPOSIT_BALANCE_NOT_ENOUGH);
        // 金额非法 → 5401
        let err = deposit_change(d("10"), d("0"), LOG_TYPE_REFUND).unwrap_err();
        assert_eq!(err.business_code(), DEPOSIT_AMOUNT_INVALID);
        // 平台调整带符号
        assert_eq!(
            deposit_change(d("100"), d("-30"), LOG_TYPE_ADJUST).unwrap(),
            (d("-30"), d("70"))
        );
    }

    #[test]
    fn sort_whitelist_and_direction() {
        assert_eq!(refund_sort_column(None), "shop_deposit_refund_id");
        assert_eq!(refund_sort_column(Some("addTime")), "add_time");
        assert_eq!(refund_sort_column(Some("type")), "type");
        assert_eq!(
            refund_sort_column(Some("amount; DROP TABLE x")),
            "shop_deposit_refund_id"
        );
        assert!(sort_is_asc(Some("asc")));
        assert!(!sort_is_asc(Some("desc")));
        assert!(!sort_is_asc(None));
    }

    #[test]
    fn queries_accept_java_camel_case() {
        let q: DepositRefundListQuery = serde_json::from_str(
            r#"{"ownerType":2,"ownerId":9,"shopId":8,"ownerName":"A","subjectType":1,
                "type":2,"status":0,"startTime":1,"endTime":2,"page":2,"size":30,
                "sortField":"addTime","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.owner_type, Some(2));
        assert_eq!(q.effective_owner_id(), Some(9));
        assert_eq!(q.r#type, Some(2));

        let dto: DepositRefundApplyDTO = serde_json::from_str(
            r#"{"type":1,"amount":50.00,"payeeInfo":"银行卡 张三","reason":"退保证金"}"#,
        )
        .unwrap();
        assert_eq!(dto.r#type, Some(1));
        assert_eq!(dto.amount, Some(d("50.00")));

        let dto: DepositRefundAuditDTO =
            serde_json::from_str(r#"{"id":3,"pass":true,"payVoucher":"v"}"#).unwrap();
        assert_eq!(dto.pass, Some(true));
        assert_eq!(dto.pay_voucher.as_deref(), Some("v"));
    }

    #[test]
    fn full_refund_check_vo_serializes_camel_case() {
        let vo = DepositFullRefundCheckVO {
            can_refund: false,
            refundable_amount: "0".into(),
            after_sales_limit_days: 15,
            unmet_reasons: vec!["存在进行中退还单".into()],
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["canRefund"], false);
        assert_eq!(v["refundableAmount"], "0");
        assert_eq!(v["afterSalesLimitDays"], 15);
        assert_eq!(v["unmetReasons"][0], "存在进行中退还单");
    }
}
