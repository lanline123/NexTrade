//! 店铺端保证金聚合（`merchant::deposit_shop`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.deposit.DepositShopController`
//!   （`@RequestMapping("/adminapi/deposit/shop")`，5 个只读端点：
//!   `overview` / `logList` / `frozenDetailList` / `warning` / `protocol`）
//! - `com.tigshop.service.deposit.impl.DepositShopServiceImpl`
//! - `com.tigshop.service.deposit.support.DepositShopLogEnricher`
//! - VO：`DepositShopOverviewVO` / `DepositShopLogVO` /
//!   `DepositShopFrozenDetailVO` / `DepositShopWarningVO` / `DepositShopProtocolVO`
//!
//! 金额 `rust_decimal::Decimal`；秒级时间戳在 VO 中以 `i64` + `xxxText` 输出
//! （Java `Long` + `TigUtils.handelTime`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 持有者类型：店铺（Java `DepositOwnerType.SHOP`）。
pub const OWNER_SHOP: i32 = 1;
/// 保证金功能开关配置键（Java `DepositSettingVO` 的 `deposit_enable`）。
pub const CONFIG_DEPOSIT_ENABLE: &str = "deposit_enable";
/// 保证金协议开关配置键（Java `CONFIG_PROTOCOL_ENABLE`）。
pub const CONFIG_PROTOCOL_ENABLE: &str = "deposit_protocol_enable";
/// 保证金协议内容配置键（Java `CONFIG_PROTOCOL_CONTENT`）。
pub const CONFIG_PROTOCOL_CONTENT: &str = "deposit_protocol_content";

/// 保证金流水类型文案（Java `DepositLogType`）。
///
/// 注意 Java `getDescByCode(REFUND)` 返回 `WITHDRAW` 的描述（即 3 也显示「提现出账」）。
#[must_use]
pub fn log_type_text(log_type: i32) -> &'static str {
    match log_type {
        1 => "充值入账",
        2 => "提现出账",
        3 => "提现出账",
        4 => "平台扣除",
        5 => "平台调整",
        _ => "",
    }
}

/// 类型归一化（Java `DepositLogType.normalizeCode`：3 → 2）。
#[must_use]
pub fn normalize_log_type(log_type: i32) -> i32 {
    if log_type == 3 {
        2
    } else {
        log_type
    }
}

/// 账户状态文案（Java `resolveStatusText`）：
/// 惩罚状态 > 0 → 「已处罚」；待补缴 > 0 → 「待补缴」；否则「正常」。
#[must_use]
pub fn deposit_status_text(penalty_status: i32, pending: Decimal) -> &'static str {
    if penalty_status > 0 {
        "已处罚"
    } else if pending > Decimal::ZERO {
        "待补缴"
    } else {
        "正常"
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`；0/负值返回空串（Java `TigUtils.handelTime`）。
#[must_use]
pub fn format_ts(ts: i64) -> String {
    if ts <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(ts, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// 剩余天数：向上取整到整天；`due_time = 0`/已过期返回 0（Java `remainDays`）。
#[must_use]
pub fn remain_days(due_time: i64, now: i64) -> i32 {
    if due_time <= 0 {
        return 0;
    }
    let remain = due_time - now;
    if remain <= 0 {
        return 0;
    }
    // ceil(remain / 86400)
    ((remain + 86_399) / 86_400) as i32
}

/// 缓冲缴存期剩余天数（Java `resolveBufferDays`）：收取缓冲优先，否则补缴缓冲。
#[must_use]
pub fn resolve_buffer_days(collect_due_time: i64, supplement_due_time: i64, now: i64) -> i32 {
    let due = if collect_due_time > 0 {
        collect_due_time
    } else if supplement_due_time > 0 {
        supplement_due_time
    } else {
        0
    };
    remain_days(due, now)
}

/// 预警文案（Java `buildWarningMessages`，实体名固定「店铺」）。
///
/// 优先级：超期未缴足 > 补缴差额 > 收取规则；两缓冲均未启动时兜底提示。
#[must_use]
pub fn build_warning_messages(
    need_warning: bool,
    collect_due_time: i64,
    supplement_due_time: i64,
    entity: &str,
    now: i64,
) -> Vec<String> {
    if !need_warning {
        return Vec::new();
    }
    let collect_expired = collect_due_time > 0 && collect_due_time <= now;
    let supplement_expired = supplement_due_time > 0 && supplement_due_time <= now;
    let message = if collect_expired || supplement_expired {
        "超过限缴存周期仍未缴足保证金，当前无法发布全新商品(根据设置)，存量商品可正常成交，请立即补缴"
            .to_string()
    } else if supplement_due_time > now {
        format!(
            "{}新增主营类目，所需保证金额度提升，请在 {} 日内补齐差额，避免权限受限",
            entity,
            remain_days(supplement_due_time, now)
        )
    } else if collect_due_time > now {
        format!(
            "上架商品 / 产生首单触发保证金收取规则，您尚有 {} 天缓冲缴存期，逾期将限制{}经营",
            remain_days(collect_due_time, now),
            entity
        )
    } else {
        "超过限缴存周期仍未缴足保证金，当前无法发布全新商品(根据设置)，存量商品可正常成交，请立即补缴"
            .to_string()
    };
    vec![message]
}

/// 布尔配置解析（Java `parseBool`：trim 后 `1` / `true`（忽略大小写））。
#[must_use]
pub fn parse_bool(value: Option<&str>) -> bool {
    let Some(value) = value.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    value == "1" || value.eq_ignore_ascii_case("true")
}

/// 收款账户展示（Java `DepositShopLogEnricher#formatPayeeDisplay`）：
/// `{账户类型文案} {户名} {账号}`，空片段跳过。
#[must_use]
pub fn format_payee_display(
    account_type: Option<i32>,
    account_name: Option<&str>,
    account_no: Option<&str>,
) -> String {
    let type_text = match account_type {
        Some(1) => "银行卡",
        Some(2) => "支付宝",
        Some(3) => "微信",
        _ => "",
    };
    [
        type_text,
        account_name.unwrap_or(""),
        account_no.unwrap_or(""),
    ]
    .iter()
    .map(|s| s.trim())
    .filter(|s| !s.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
}

/// 店铺端流水/冻结明细查询（Java `DepositShopLogQueryParam` + BasePage）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopLogQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 店铺上下文（Java `X-Shop-Id` 请求头的替身，仅路由层解析，不入 SQL）
    pub shop_id: Option<i32>,
    /// 流水类型（2/3 视为提现类，合并查询）
    pub r#type: Option<i32>,
    /// 业务编号（纯数字时按 order_id / related_id 精确匹配）
    pub trade_no: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
}

impl DepositShopLogQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    /// `tradeNo` 为纯数字时返回整数（Java `matches("\\d+")`）。
    #[must_use]
    pub fn trade_no_int(&self) -> Option<i32> {
        let raw = self.trade_no.as_deref().map(str::trim).unwrap_or("");
        if raw.is_empty() || !raw.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
        raw.parse::<i32>().ok()
    }
}

/// 保证金总览（Java `DepositShopOverviewVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopOverviewVO {
    /// 应缴
    pub required: Decimal,
    /// 实缴
    pub paid: Decimal,
    /// 待补缴 = max(0, 应缴 - 实缴)
    pub pending: Decimal,
    /// 可提现/可退 = max(0, 实缴 - 应缴)
    pub withdrawable: Decimal,
    /// 待审核提现金额（退还/提现申请合计，仅展示）
    pub pending_withdraw: Decimal,
    /// 冻结 = min(实缴, 应缴)
    pub frozen: Decimal,
    pub status: i32,
    pub penalty_status: i32,
    pub status_text: String,
    pub supplement_due_time: i64,
    pub supplement_due_time_text: String,
    pub has_protocol: bool,
}

/// 保证金流水（Java `DepositShopLogVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopLogVO {
    pub shop_deposit_log_id: i32,
    pub r#type: i32,
    pub type_text: String,
    pub change_amount: Decimal,
    pub before_paid: Decimal,
    pub after_paid: Decimal,
    pub order_id: i32,
    pub related_id: i32,
    pub remark: Option<String>,
    pub add_time: i64,
    pub add_time_text: String,
    pub source_account: String,
    pub dest_account: String,
}

/// 冻结明细（Java `DepositShopFrozenDetailVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopFrozenDetailVO {
    pub shop_deposit_log_id: i32,
    pub r#type: i32,
    pub type_text: String,
    pub deduct_amount: Decimal,
    pub change_amount: Decimal,
    pub reason: Option<String>,
    pub order_id: i32,
    pub related_id: i32,
    pub add_time: i64,
    pub add_time_text: String,
}

/// 保证金预警（Java `DepositShopWarningVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopWarningVO {
    pub need_warning: bool,
    pub pending_amount: Decimal,
    pub supplement_due_time: i64,
    pub supplement_due_time_text: String,
    pub buffer_days: i32,
    pub message: String,
    pub messages: Vec<String>,
}

/// 保证金协议（Java `DepositShopProtocolVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopProtocolVO {
    pub enable: bool,
    pub content: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_type_texts_and_normalization_match_java() {
        assert_eq!(log_type_text(1), "充值入账");
        assert_eq!(log_type_text(2), "提现出账");
        // Java `getDescByCode(REFUND)` 返回 WITHDRAW 描述
        assert_eq!(log_type_text(3), "提现出账");
        assert_eq!(log_type_text(4), "平台扣除");
        assert_eq!(log_type_text(5), "平台调整");
        assert_eq!(normalize_log_type(3), 2);
        assert_eq!(normalize_log_type(4), 4);
        assert_eq!(deposit_status_text(1, Decimal::ZERO), "已处罚");
        assert_eq!(deposit_status_text(0, Decimal::ONE), "待补缴");
        assert_eq!(deposit_status_text(0, Decimal::ZERO), "正常");
    }

    #[test]
    fn remain_and_buffer_days_round_up() {
        let now = 1_000_000;
        assert_eq!(remain_days(0, now), 0);
        assert_eq!(remain_days(now - 1, now), 0);
        assert_eq!(remain_days(now + 1, now), 1);
        assert_eq!(remain_days(now + 86_400, now), 1);
        assert_eq!(remain_days(now + 86_401, now), 2);
        assert_eq!(resolve_buffer_days(0, now + 86_401, now), 2);
        assert_eq!(resolve_buffer_days(now + 1, now + 86_401, now), 1);
        assert_eq!(resolve_buffer_days(0, 0, now), 0);
    }

    #[test]
    fn warning_messages_match_java_priority() {
        let now = 1_000_000;
        assert!(build_warning_messages(false, 0, 0, "店铺", now).is_empty());
        // 超期未缴足
        let expired = build_warning_messages(true, now - 1, 0, "店铺", now);
        assert_eq!(expired.len(), 1);
        assert!(expired[0].starts_with("超过限缴存周期仍未缴足保证金"));
        // 补缴差额
        let supplement = build_warning_messages(true, 0, now + 86_400, "店铺", now);
        assert!(supplement[0].contains("新增主营类目"));
        assert!(supplement[0].contains("1 日内补齐差额"));
        // 收取规则
        let collect = build_warning_messages(true, now + 86_400, 0, "店铺", now);
        assert!(collect[0].contains("缓冲缴存期"));
        // 兜底
        let fallback = build_warning_messages(true, 0, 0, "店铺", now);
        assert!(fallback[0].starts_with("超过限缴存周期仍未缴足保证金"));
    }

    #[test]
    fn bool_and_payee_helpers() {
        assert!(parse_bool(Some("1")));
        assert!(parse_bool(Some(" true ")));
        assert!(!parse_bool(Some("0")));
        assert!(!parse_bool(Some("yes")));
        assert!(!parse_bool(None));
        assert_eq!(
            format_payee_display(Some(1), Some("张三"), Some("6222")),
            "银行卡 张三 6222"
        );
        assert_eq!(format_payee_display(Some(2), None, None), "支付宝");
        assert_eq!(format_payee_display(None, None, None), "");
        let q = DepositShopLogQuery {
            trade_no: Some(" 123 ".into()),
            ..Default::default()
        };
        assert_eq!(q.trade_no_int(), Some(123));
        let q = DepositShopLogQuery {
            trade_no: Some("A123".into()),
            ..Default::default()
        };
        assert_eq!(q.trade_no_int(), None);
    }
}
