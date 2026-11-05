//! 供应商端保证金 域 DTO / VO / 纯逻辑（merchant::vendor_deposit_shop）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.param.deposit.DepositShopLogQueryParam`
//!   （`type` / `tradeNo` / `startTime` / `endTime` + `BasePage` 的
//!   `page` / `size` / `sortField` / `sortOrder` / `keyword`）
//! - `com.tigshop.bean.vo.deposit.DepositShopOverviewVO`
//! - `com.tigshop.bean.vo.deposit.DepositShopLogVO`
//! - `com.tigshop.bean.vo.deposit.DepositShopFrozenDetailVO`
//! - `com.tigshop.bean.vo.deposit.DepositShopWarningVO`
//! - `com.tigshop.bean.vo.deposit.DepositShopProtocolVO`
//! - `com.tigshop.bean.vo.deposit.DepositPayeeAccountVO`（仅流水富化时用于
//!   解析 `payee_snapshot`，此处只保留用到的三个字段）
//! - `com.tigshop.bean.enums.deposit.DepositLogType` /
//!   `DepositOwnerType` / `DepositPayeeAccountType`（枚举语义内联为常量与函数）
//! - `com.tigshop.service.deposit.impl.VendorDepositShopServiceImpl` 里的
//!   全部**纯函数**（金额派生、状态文案、缓冲天数、预警文案、账户展示名）
//!
//! ## 金额 / 精度
//!
//! 本域所有金额列（`shop_deposit.paid` / `shop_deposit_log.change_amount` /
//! `shop_deposit_refund.amount` / `shop_deposit_rule.deposit_amount`）都是
//! MySQL `decimal(10,2)`，因此一律用 `rust_decimal::Decimal`，
//! **禁止** `f64` / `f32`（浮点会丢精度且无法与 Java `BigDecimal` 逐位对齐）。
//!
//! ## JSON 字段名
//!
//! 全部保持 camelCase（`#[serde(rename_all = "camelCase")]`），与原接口
//! 逐字符一致。注意 `Decimal` 在本 workspace 下序列化为**字符串**
//! （`rust_decimal` 启用了 `serde-with-str`，见 tax_rate 的既有断言），
//! 而 Java `BigDecimal` 默认序列化为 JSON 数字 —— 这是项目级既有约定，
//! 本片沿用，详见 `uncertain_points`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java 枚举 / 常量类，逐字符照抄）
// ——————————————————————————————————————————————

/// 持有者类型：供应商（Java `DepositOwnerType.SUPPLIER.getCode()`）。
pub const OWNER_TYPE_SUPPLIER: i32 = 2;

/// 流水类型：充值入账（Java `DepositLogType.RECHARGE`）。
pub const LOG_TYPE_RECHARGE: i32 = 1;

/// 流水类型：提现出账（Java `DepositLogType.WITHDRAW`）。
pub const LOG_TYPE_WITHDRAW: i32 = 2;

/// 流水类型：退还出账（Java `DepositLogType.REFUND`，存量数据）。
pub const LOG_TYPE_REFUND: i32 = 3;

/// 流水类型：平台扣除（Java `DepositLogType.DEDUCT`）。
pub const LOG_TYPE_DEDUCT: i32 = 4;

/// 流水类型：平台调整（Java `DepositLogType.ADJUST`）。
pub const LOG_TYPE_ADJUST: i32 = 5;

/// 站内账户展示名（Java `DepositShopLogEnricher.ACCOUNT_DEPOSIT_BALANCE`）。
pub const ACCOUNT_DEPOSIT_BALANCE: &str = "保证金余额";

/// 平台侧账户展示名（Java `DepositShopLogEnricher.ACCOUNT_PLATFORM`）。
pub const ACCOUNT_PLATFORM: &str = "平台账户";

/// 协议开关配置键（Java `VendorDepositShopServiceImpl.CONFIG_PROTOCOL_ENABLE`）。
pub const CONFIG_PROTOCOL_ENABLE: &str = "deposit_protocol_enable";

/// 协议内容配置键（Java `VendorDepositShopServiceImpl.CONFIG_PROTOCOL_CONTENT`）。
pub const CONFIG_PROTOCOL_CONTENT: &str = "deposit_protocol_content";

/// 保证金功能总开关配置键（Java `DepositSettingServiceImpl.KEY_ENABLE`）。
pub const CONFIG_DEPOSIT_ENABLE: &str = "deposit_enable";

/// 无法解析当前供应商时的文案
/// （Java `VendorDepositShopController.currentVendorId`：
/// `throw new GlobalException("无法获取当前供应商信息", HttpStatus.UNAUTHORIZED)`）。
pub const MSG_VENDOR_REQUIRED: &str = "无法获取当前供应商信息";

/// Java `HttpStatus.UNAUTHORIZED`（401）。
pub const HTTP_UNAUTHORIZED: i32 = 401;

/// 派生状态文案：已处罚。
pub const STATUS_TEXT_PENALTY: &str = "已处罚";

/// 派生状态文案：待补缴。
pub const STATUS_TEXT_PENDING: &str = "待补缴";

/// 派生状态文案：正常。
pub const STATUS_TEXT_NORMAL: &str = "正常";

/// 预警文案里的主体名称（店铺端用「店铺」，供应商端用「供应商」）。
pub const ENTITY_VENDOR: &str = "供应商";

/// 超期未缴足文案
/// （Java `VendorDepositShopServiceImpl#buildWarningMessages` 场景 3 与兜底分支，
/// 两处字面量完全相同）。
pub const MSG_WARNING_EXPIRED: &str =
    "超过限缴存周期仍未缴足保证金，当前无法发布全新商品(根据设置)，存量商品可正常成交，请立即补缴";

/// 未建账户时的默认账户状态（Java `account != null ? account.getStatus() : 1`）。
pub const DEFAULT_ACCOUNT_STATUS: i32 = 1;

/// 一天的秒数（Java `remainDays` 用 `86400.0`）。
pub const SECS_PER_DAY: i64 = 86_400;

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 供应商端保证金总览（Java `DepositShopOverviewVO`）。
///
/// 金额三数与应缴/已缴均来自只读实时口径，本模块不落库。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopOverviewVO {
    /// 应缴保证金（Java `computeRequired`）
    pub required: Decimal,
    /// 已缴保证金（`shop_deposit.paid`）
    pub paid: Decimal,
    /// 待补缴 = `max(0, 应缴 - 已缴)`
    pub pending: Decimal,
    /// 可提现 = `max(0, 已缴 - 应缴)`
    pub withdrawable: Decimal,
    /// 待审核提现金额（`shop_deposit_refund` 中 `status=0` 的金额合计）
    pub pending_withdraw: Decimal,
    /// 冻结金额 = `min(已缴, 应缴)`
    pub frozen: Decimal,
    /// 账户状态（`shop_deposit.status`，无账户时 [`DEFAULT_ACCOUNT_STATUS`]）
    pub status: i32,
    /// 扣罚状态（`shop_deposit.penalty_status`，0 正常）
    pub penalty_status: i32,
    /// 派生状态文案：正常 / 待补缴 / 已处罚
    pub status_text: String,
    /// 补缴到期时间戳（秒，`supplement_due_time`，0 未触发）
    pub supplement_due_time: i64,
    /// 补缴到期时间（格式化，空 = 未触发）
    pub supplement_due_time_text: String,
    /// 是否存在保证金协议（开关开启且内容非空）
    pub has_protocol: bool,
}

/// 供应商端保证金交易流水（Java `DepositShopLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopLogVO {
    /// 流水ID
    pub shop_deposit_log_id: i32,
    /// 交易类型（已归一：存量 3 归并到 2）
    pub r#type: i32,
    /// 交易类型文案
    pub type_text: String,
    /// 变动金额（带符号）
    pub change_amount: Decimal,
    /// 变动前实缴
    pub before_paid: Decimal,
    /// 变动后实缴
    pub after_paid: Decimal,
    /// 关联订单ID（平台扣除/赔付时）
    pub order_id: i32,
    /// 关联单ID（充值/退还单等）
    pub related_id: i32,
    /// 备注
    pub remark: Option<String>,
    /// 发生时间戳（秒）
    pub add_time: i64,
    /// 发生时间（格式化）
    pub add_time_text: String,
    /// 来源账户（如充值打款账户、扣款时的保证金余额）
    pub source_account: Option<String>,
    /// 去向账户（如充值入账的保证金余额、扣款至平台账户）
    pub dest_account: Option<String>,
}

/// 供应商端保证金资金明细（Java `DepositShopFrozenDetailVO`）。
///
/// ⚠️ Java 侧类名与注释描述的是「冻结明细 = 平台扣款记录（`type=4`）」，
/// 但 `VendorDepositShopServiceImpl#frozenDetailList` 的实际实现**只**查
/// `DEDUCT`，VO 上的 `type` / `typeText` 恒为 4 / "平台扣除"
/// （CR-20260616-135500 的「扩展为全部资金类型」只改了店铺端的注释，
/// 供应商端实现未跟进）。本实现按**实际行为**复刻，只查 `type=4`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopFrozenDetailVO {
    /// 流水ID
    pub shop_deposit_log_id: i32,
    /// 资金类型（本接口恒为 4 平台扣除）
    pub r#type: i32,
    /// 资金类型文案
    pub type_text: String,
    /// 扣款金额（正数，展示用）
    pub deduct_amount: Decimal,
    /// 原始变动金额（带符号，通常为负）
    pub change_amount: Decimal,
    /// 原因 / 备注（流水备注）
    pub reason: Option<String>,
    /// 关联订单ID
    pub order_id: i32,
    /// 关联单ID
    pub related_id: i32,
    /// 扣款时间戳（秒）
    pub add_time: i64,
    /// 扣款时间（格式化）
    pub add_time_text: String,
}

/// 供应商端首页保证金预警横幅（Java `DepositShopWarningVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopWarningVO {
    /// 是否需要预警（待补缴 > 0）
    pub need_warning: bool,
    /// 待补缴金额
    pub pending_amount: Decimal,
    /// 补缴截止时间戳（秒，0 未触发）
    pub supplement_due_time: i64,
    /// 补缴截止时间（格式化，空 = 未触发）
    pub supplement_due_time_text: String,
    /// 缓冲缴存期剩余天数（向上取整；收取缓冲优先，否则补缴缓冲；无/已过期 = 0）
    pub buffer_days: i32,
    /// 预警文案（不需预警时为空串；按当前状态匹配的**单条**文案）
    pub message: String,
    /// 预警文案列表（不需预警时为空列表；当前按单条匹配返回，保留列表结构兼容）
    pub messages: Vec<String>,
}

/// 供应商端保证金协议（Java `DepositShopProtocolVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopProtocolVO {
    /// 协议是否开启（配置键 `deposit_protocol_enable`）
    pub enable: bool,
    /// 协议富文本内容（配置键 `deposit_protocol_content`；配置缺失时为 `null`）
    pub content: Option<String>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 流水 / 冻结明细分页查询参数（Java `DepositShopLogQueryParam`，继承 `BasePage`）。
///
/// ⚠️ `vendorId` **不在**本参数中：身份由控制器从供应商端鉴权头解析
/// （Java `HeaderUtils.getVendorId()`），避免越权查询他供应商保证金。
///
/// `sortField` / `sortOrder` / `keyword` / `sortItems` 在 Java 里被
/// `BasePage` 继承但本域**完全未使用**（两处查询都固定
/// `ORDER BY shop_deposit_log_id DESC`），因此本结构体不声明这些字段；
/// serde 默认忽略未知字段，前端多传不会报错。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositShopLogQuery {
    /// 资金类型筛选（Java `type`，可空）
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    /// 业务编号（按 `order_id` 或 `related_id` 精确匹配，可空）
    pub trade_no: Option<String>,
    /// 时间起（秒级时间戳，按 `add_time` 过滤，可空）
    pub start_time: Option<i64>,
    /// 时间止（秒级时间戳，可空）
    pub end_time: Option<i64>,
    /// 页码，默认 1（Java `BasePage.getPage()`）
    pub page: Option<u64>,
    /// 每页条数，默认 15、上限 100（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl DepositShopLogQuery {
    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 **1**，`size` 默认 **15**、`> 100` 时截断为
    /// **100**。本方法按同一口径归一，并额外兜住下界（`clamp(1, 100)`）——
    /// Java 对 `size <= 0` 不做保护，会生成 `LIMIT 0` 这类退化 SQL，
    /// 本实现按项目统一口径收敛（见 `uncertain_points`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// `type` 筛选映射为 SQL 的类型集合（Java `logList` 的 `wrapper` 分支）：
    ///
    /// - `type == null` → 空集合（不加 `type` 条件）
    /// - `type` 属于提现类（2 提现 / 3 退还）→ `[2, 3]`（`IN` 查询）
    /// - 其它 → `[type]`（等值查询）
    #[must_use]
    pub fn type_filter(&self) -> Vec<i32> {
        match self.r#type {
            None => Vec::new(),
            Some(t) if is_withdraw_category(t) => vec![LOG_TYPE_WITHDRAW, LOG_TYPE_REFUND],
            Some(t) => vec![t],
        }
    }

    /// `tradeNo` 的有效业务编号（Java `logList` / `frozenDetailList` 的公共分支）：
    ///
    /// Java 逻辑是
    /// `String tradeNoStr = param.getTradeNo() == null ? "" : param.getTradeNo().trim();`
    /// 然后 `if (!tradeNoStr.isEmpty() && tradeNoStr.matches("\\d+"))` 才加过滤。
    /// 因此**非纯数字的业务编号会被静默忽略**（不报错、不过滤），
    /// 本方法复刻该行为。
    ///
    /// ⚠️ Java 用 `Integer.valueOf` 解析：超 `int` 范围的纯数字串会抛
    /// `NumberFormatException`（HTTP 500）；本实现解析为 `i64`，超出 `i64`
    /// 时按「忽略过滤」处理（见 `uncertain_points`）。
    #[must_use]
    pub fn trade_no_filter(&self) -> Option<i64> {
        let raw = self.trade_no.as_deref().unwrap_or("").trim();
        if raw.is_empty() || !raw.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        raw.parse::<i64>().ok()
    }
}

// ——————————————————————————————————————————————
// 纯逻辑（逐条对照 Java，便于单测）
// ——————————————————————————————————————————————

/// 去空白后判空（Java `StrUtil.isBlank`）。
///
/// ⚠️ 与 `isNotEmpty` 不同：`"   "` 视为空。
#[must_use]
pub fn is_blank(value: Option<&str>) -> bool {
    value.is_none_or(|v| v.trim().is_empty())
}

/// `max(0, value)`（Java `VendorDepositShopServiceImpl#max0`）。
#[must_use]
pub fn max0(value: Decimal) -> Decimal {
    if value < Decimal::ZERO {
        Decimal::ZERO
    } else {
        value
    }
}

/// 冻结金额 = `min(已缴, 应缴)`。
#[must_use]
pub fn frozen_of(paid: Decimal, required: Decimal) -> Decimal {
    paid.min(required)
}

/// 可提现 = `max(0, 已缴 - 应缴)`。
#[must_use]
pub fn withdrawable_of(paid: Decimal, required: Decimal) -> Decimal {
    max0(paid - required)
}

/// 待补缴 = `max(0, 应缴 - 已缴)`。
#[must_use]
pub fn pending_of(required: Decimal, paid: Decimal) -> Decimal {
    max0(required - paid)
}

/// 派生状态文案（Java `VendorDepositShopServiceImpl#resolveStatusText`）。
///
/// 优先级：`penaltyStatus > 0` → 已处罚；否则 `pending > 0` → 待补缴；否则正常。
#[must_use]
pub fn resolve_status_text(penalty_status: i32, pending: Decimal) -> &'static str {
    if penalty_status > 0 {
        STATUS_TEXT_PENALTY
    } else if pending > Decimal::ZERO {
        STATUS_TEXT_PENDING
    } else {
        STATUS_TEXT_NORMAL
    }
}

/// 剩余天数：向上取整到整天；`dueTime <= 0` 或已过期返回 0
/// （Java `VendorDepositShopServiceImpl#remainDays`）。
///
/// Java 是 `(int) Math.ceil(remain / 86400.0)`；本实现用整数运算
/// `(remain + 86399) / 86400` 得到同一结果，且**不经过浮点**。
#[must_use]
pub fn remain_days(due_time: i64, now: i64) -> i32 {
    if due_time <= 0 {
        return 0;
    }
    let remain = due_time.saturating_sub(now);
    if remain <= 0 {
        return 0;
    }
    let days = (remain + SECS_PER_DAY - 1) / SECS_PER_DAY;
    i32::try_from(days).unwrap_or(i32::MAX)
}

/// 缓冲缴存期剩余天数：收取缓冲（`collectDueTime`）优先，否则补缴缓冲
/// （Java `VendorDepositShopServiceImpl#resolveBufferDays`）。
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

/// 构造预警文案列表（Java `VendorDepositShopServiceImpl#buildWarningMessages`）。
///
/// 待补缴 > 0 时按账户当前状态匹配**单条**场景文案，优先级：
/// 超期未缴足 > 补缴差额 > 收取规则；两缓冲均未启动时走「立即补缴」兜底。
/// 不需预警时返回空列表。
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
    if collect_expired || supplement_expired {
        vec![MSG_WARNING_EXPIRED.to_string()]
    } else if supplement_due_time > now {
        vec![format!(
            "{entity}新增主营类目，所需保证金额度提升，请在 {} 日内补齐差额，避免权限受限",
            remain_days(supplement_due_time, now)
        )]
    } else if collect_due_time > now {
        vec![format!(
            "上架商品 / 产生首单触发保证金收取规则，您尚有 {} 天缓冲缴存期，逾期将限制{entity}经营",
            remain_days(collect_due_time, now)
        )]
    } else {
        vec![MSG_WARNING_EXPIRED.to_string()]
    }
}

/// 解析布尔配置值（Java `VendorDepositShopServiceImpl#parseBool`）。
///
/// `null` / blank → `false`；`"1"` 或忽略大小写的 `"true"` → `true`；其余 `false`。
#[must_use]
pub fn parse_bool(value: Option<&str>) -> bool {
    let Some(raw) = value else {
        return false;
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return false;
    }
    trimmed == "1" || trimmed.eq_ignore_ascii_case("true")
}

/// 是否属于「提现/退还」筛选类（Java `DepositLogType.isWithdrawCategory`）。
#[must_use]
pub fn is_withdraw_category(code: i32) -> bool {
    code == LOG_TYPE_WITHDRAW || code == LOG_TYPE_REFUND
}

/// 对外展示类型统一为 2：存量 `type=3`（退还出账）归并到 2
/// （Java `DepositLogType.normalizeCode`）。
#[must_use]
pub fn normalize_log_type(code: i32) -> i32 {
    if code == LOG_TYPE_REFUND {
        LOG_TYPE_WITHDRAW
    } else {
        code
    }
}

/// 流水类型文案（Java `DepositLogType.getDescByCode`）。
///
/// 注意 `REFUND(3)` 的文案**不是** "退还出账"，而是复用 `WITHDRAW` 的
/// "提现出账"（枚举注释：暂不使用，与 `WITHDRAW` 合并）。
#[must_use]
pub fn log_type_text(code: i32) -> &'static str {
    match code {
        LOG_TYPE_RECHARGE => "充值入账",
        LOG_TYPE_WITHDRAW | LOG_TYPE_REFUND => "提现出账",
        LOG_TYPE_DEDUCT => "平台扣除",
        LOG_TYPE_ADJUST => "平台调整",
        _ => "",
    }
}

/// 收款账户类型文案（Java `DepositPayeeAccountType.getDescByCode`）。
#[must_use]
pub fn payee_account_type_text(code: Option<i32>) -> &'static str {
    match code {
        Some(1) => "银行卡",
        Some(2) => "支付宝",
        Some(3) => "微信",
        _ => "",
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`
/// （Java `TigUtils.handelTime(Long)`：`null` 或 `0` → 空串）。
///
/// Java 用 `new Date(secs * 1000L)` + `SimpleDateFormat`，即**系统默认时区**；
/// 本实现用 `chrono::Local` 复刻同一口径（与 im_servant 的 `handel_time` 一致），
/// 未硬编码东八区。
#[must_use]
pub fn handel_time(secs: Option<i64>) -> String {
    match secs {
        None | Some(0) => String::new(),
        Some(v) => {
            use chrono::{LocalResult, TimeZone};
            match chrono::Local.timestamp_opt(v, 0) {
                LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
                _ => String::new(),
            }
        }
    }
}

// ——————————————————————————————————————————————
// 流水来源/去向账户富化（Java `DepositShopLogEnricher`）
// ——————————————————————————————————————————————

/// 充值单的收款账户快照（Java `DepositPayeeAccountVO` 的子集，
/// 由 `shop_deposit_recharge.payee_snapshot` 的 JSON 反序列化而来）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositPayeeAccountSnapshot {
    /// 账户类型 1银行卡 2支付宝 3微信
    pub account_type: Option<i32>,
    /// 户名
    pub account_name: Option<String>,
    /// 账号
    pub account_no: Option<String>,
}

/// 账户展示名拼接（Java `DepositShopLogEnricher#formatPayeeDisplay`）：
/// `类型文案 / 户名 / 账号`，空白段跳过，以 `/` 连接。
#[must_use]
pub fn format_payee_display(
    account_type: Option<i32>,
    account_name: Option<&str>,
    account_no: Option<&str>,
) -> String {
    let mut parts: Vec<String> = Vec::with_capacity(3);
    let type_text = payee_account_type_text(account_type);
    if !type_text.is_empty() {
        parts.push(type_text.to_string());
    }
    if let Some(name) = account_name.filter(|v| !v.trim().is_empty()) {
        parts.push(name.to_string());
    }
    if let Some(no) = account_no.filter(|v| !v.trim().is_empty()) {
        parts.push(no.to_string());
    }
    parts.join("/")
}

/// 充值流水的来源账户（Java `DepositShopLogEnricher#formatRechargePayAccount`）。
///
/// 快照非空且能解析出对象时用快照；否则回退到充值单的
/// `payee_account_type` 快照列（此时只有类型文案）。
///
/// ⚠️ Java 在快照非空但 JSON 非法时会让 `JSON.parseObject` 抛异常（HTTP 500）；
/// 本实现解析失败即回退到类型文案（更健壮），见 `uncertain_points`。
#[must_use]
pub fn format_recharge_pay_account(
    payee_account_type: i32,
    payee_snapshot: Option<&str>,
) -> String {
    if let Some(raw) = payee_snapshot.filter(|v| !v.trim().is_empty()) {
        if let Ok(payee) = serde_json::from_str::<DepositPayeeAccountSnapshot>(raw) {
            return format_payee_display(
                payee.account_type,
                payee.account_name.as_deref(),
                payee.account_no.as_deref(),
            );
        }
    }
    format_payee_display(Some(payee_account_type), None, None)
}

/// 提现/退还流水的去向账户（Java `DepositShopLogEnricher#formatRefundPayeeAccount`）：
/// 直接取申请时填写的收款信息（trim 后），空白 → 空串。
#[must_use]
pub fn format_refund_payee_account(payee_info: Option<&str>) -> String {
    match payee_info {
        Some(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => String::new(),
    }
}

/// 解析一条流水的「来源账户 / 去向账户」
/// （Java `DepositShopLogEnricher#applySourceDest`）。
///
/// - 充值（1）：来源 = 充值单收款账户，去向 = [`ACCOUNT_DEPOSIT_BALANCE`]
/// - 平台扣除（4）：来源 = [`ACCOUNT_DEPOSIT_BALANCE`]，去向 = [`ACCOUNT_PLATFORM`]
/// - 提现（2）/ 退还（3）：来源 = [`ACCOUNT_DEPOSIT_BALANCE`]，
///   去向 = 退还单的收款信息
/// - 平台调整（5）：两边都是 [`ACCOUNT_DEPOSIT_BALANCE`]
/// - 其它类型：两边都**不设置**（JSON `null`）
///
/// ⚠️ 判断用的是**原始** `type`（不是归一后的值），因此存量 `type=3`
/// 走的是「退还」分支而非「提现」分支 —— 与 Java 一致。
#[must_use]
pub fn resolve_source_dest(
    log_type: i32,
    recharge: Option<(i32, Option<&str>)>,
    refund_payee_info: Option<&str>,
) -> (Option<String>, Option<String>) {
    match log_type {
        LOG_TYPE_RECHARGE => {
            let source = match recharge {
                Some((payee_type, snapshot)) => format_recharge_pay_account(payee_type, snapshot),
                None => String::new(),
            };
            (Some(source), Some(ACCOUNT_DEPOSIT_BALANCE.to_string()))
        }
        LOG_TYPE_DEDUCT => (
            Some(ACCOUNT_DEPOSIT_BALANCE.to_string()),
            Some(ACCOUNT_PLATFORM.to_string()),
        ),
        LOG_TYPE_WITHDRAW | LOG_TYPE_REFUND => (
            Some(ACCOUNT_DEPOSIT_BALANCE.to_string()),
            Some(format_refund_payee_account(refund_payee_info)),
        ),
        LOG_TYPE_ADJUST => (
            Some(ACCOUNT_DEPOSIT_BALANCE.to_string()),
            Some(ACCOUNT_DEPOSIT_BALANCE.to_string()),
        ),
        _ => (None, None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("测试常量必须是合法 Decimal")
    }

    // ————————————— 金额派生（对照 VendorDepositShopServiceImpl#getOverview） —————————————

    /// 已缴 > 应缴：可提现为正、冻结 = 应缴、待补缴 = 0。
    #[test]
    fn amounts_when_paid_exceeds_required() {
        let required = dec("100.00");
        let paid = dec("250.50");
        assert_eq!(frozen_of(paid, required), dec("100.00"));
        assert_eq!(withdrawable_of(paid, required), dec("150.50"));
        assert_eq!(pending_of(required, paid), Decimal::ZERO);
    }

    /// 已缴 < 应缴：待补缴为正、可提现 = 0、冻结 = 已缴。
    #[test]
    fn amounts_when_required_exceeds_paid() {
        let required = dec("300.00");
        let paid = dec("120.25");
        assert_eq!(frozen_of(paid, required), dec("120.25"));
        assert_eq!(withdrawable_of(paid, required), Decimal::ZERO);
        assert_eq!(pending_of(required, paid), dec("179.75"));
    }

    /// 相等与全零边界。
    #[test]
    fn amounts_on_equal_and_zero() {
        assert_eq!(frozen_of(dec("9.99"), dec("9.99")), dec("9.99"));
        assert_eq!(withdrawable_of(dec("9.99"), dec("9.99")), Decimal::ZERO);
        assert_eq!(pending_of(dec("9.99"), dec("9.99")), Decimal::ZERO);
        assert_eq!(max0(dec("-0.01")), Decimal::ZERO);
        assert_eq!(max0(dec("0.01")), dec("0.01"));
    }

    /// 金额运算不得经过浮点：0.1 + 0.2 类精度问题必须不存在。
    #[test]
    fn amounts_keep_decimal_precision() {
        let paid = dec("0.30");
        let required = dec("0.10");
        assert_eq!(withdrawable_of(paid, required), dec("0.20"));
        assert_eq!(pending_of(dec("0.3"), dec("0.1")), dec("0.2"));
    }

    // ————————————— 状态文案 —————————————

    #[test]
    fn status_text_priority_penalty_then_pending() {
        assert_eq!(resolve_status_text(1, dec("10")), STATUS_TEXT_PENALTY);
        assert_eq!(resolve_status_text(2, Decimal::ZERO), STATUS_TEXT_PENALTY);
        assert_eq!(resolve_status_text(0, dec("0.01")), STATUS_TEXT_PENDING);
        assert_eq!(resolve_status_text(0, Decimal::ZERO), STATUS_TEXT_NORMAL);
    }

    // ————————————— 缓冲天数 —————————————

    #[test]
    fn remain_days_rounds_up_and_expires_to_zero() {
        let now = 1_000_000_i64;
        assert_eq!(remain_days(0, now), 0);
        assert_eq!(remain_days(now, now), 0);
        assert_eq!(remain_days(now - 1, now), 0);
        // 1 秒 → 向上取整为 1 天
        assert_eq!(remain_days(now + 1, now), 1);
        // 正好 1 天 → 1
        assert_eq!(remain_days(now + SECS_PER_DAY, now), 1);
        // 1 天 + 1 秒 → 2
        assert_eq!(remain_days(now + SECS_PER_DAY + 1, now), 2);
        assert_eq!(remain_days(now + 3 * SECS_PER_DAY, now), 3);
    }

    #[test]
    fn buffer_days_prefers_collect_then_supplement() {
        let now = 1_000_000_i64;
        // 收取缓冲优先
        assert_eq!(
            resolve_buffer_days(now + 2 * SECS_PER_DAY, now + 5 * SECS_PER_DAY, now),
            2
        );
        // 收取为 0 → 用补缴
        assert_eq!(resolve_buffer_days(0, now + 3 * SECS_PER_DAY, now), 3);
        // 两者都为 0 → 0
        assert_eq!(resolve_buffer_days(0, 0, now), 0);
        // 都过期 → 0
        assert_eq!(resolve_buffer_days(now - 1, now - 2, now), 0);
    }

    // ————————————— 预警文案 —————————————

    #[test]
    fn warning_messages_empty_when_not_needed() {
        let now = 1_000_000_i64;
        assert!(build_warning_messages(false, now + 100, now + 200, ENTITY_VENDOR, now).is_empty());
    }

    #[test]
    fn warning_message_expired_wins_over_others() {
        let now = 1_000_000_i64;
        // 收取缓冲已过期 + 补缴缓冲未过期 → 仍是「超期未缴足」
        let msgs =
            build_warning_messages(true, now - 10, now + 5 * SECS_PER_DAY, ENTITY_VENDOR, now);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0], MSG_WARNING_EXPIRED);
    }

    #[test]
    fn warning_message_supplement_branch_uses_days() {
        let now = 1_000_000_i64;
        let msgs = build_warning_messages(true, 0, now + 2 * SECS_PER_DAY, ENTITY_VENDOR, now);
        assert_eq!(msgs.len(), 1);
        assert!(msgs[0].starts_with("供应商新增主营类目"));
        assert!(msgs[0].contains("2 日"), "msg={}", msgs[0]);
    }

    #[test]
    fn warning_message_collect_branch_uses_days_and_entity() {
        let now = 1_000_000_i64;
        let msgs = build_warning_messages(true, now + 7 * SECS_PER_DAY, 0, ENTITY_VENDOR, now);
        assert_eq!(msgs.len(), 1);
        assert!(msgs[0].starts_with("上架商品 / 产生首单触发保证金收取规则"));
        assert!(msgs[0].contains("7 天"), "msg={}", msgs[0]);
        assert!(msgs[0].ends_with("逾期将限制供应商经营"), "msg={}", msgs[0]);
    }

    #[test]
    fn warning_message_falls_back_when_no_buffer_started() {
        let now = 1_000_000_i64;
        let msgs = build_warning_messages(true, 0, 0, ENTITY_VENDOR, now);
        assert_eq!(msgs, vec![MSG_WARNING_EXPIRED.to_string()]);
    }

    // ————————————— 协议开关解析 —————————————

    #[test]
    fn parse_bool_matches_java_parse_bool() {
        assert!(!parse_bool(None));
        assert!(!parse_bool(Some("")));
        assert!(!parse_bool(Some("   ")));
        assert!(parse_bool(Some("1")));
        assert!(parse_bool(Some(" 1 ")));
        assert!(parse_bool(Some("true")));
        assert!(parse_bool(Some("TRUE")));
        assert!(parse_bool(Some(" True ")));
        assert!(!parse_bool(Some("0")));
        assert!(!parse_bool(Some("yes")));
    }

    // ————————————— 流水类型 —————————————

    #[test]
    fn log_type_normalization_and_text() {
        assert!(is_withdraw_category(LOG_TYPE_WITHDRAW));
        assert!(is_withdraw_category(LOG_TYPE_REFUND));
        assert!(!is_withdraw_category(LOG_TYPE_RECHARGE));
        assert!(!is_withdraw_category(LOG_TYPE_DEDUCT));

        assert_eq!(normalize_log_type(LOG_TYPE_REFUND), LOG_TYPE_WITHDRAW);
        assert_eq!(normalize_log_type(LOG_TYPE_RECHARGE), LOG_TYPE_RECHARGE);

        // 存量 3 的文案复用「提现出账」（Java getDescByCode 的特例）
        assert_eq!(log_type_text(LOG_TYPE_REFUND), "提现出账");
        assert_eq!(log_type_text(LOG_TYPE_WITHDRAW), "提现出账");
        assert_eq!(log_type_text(LOG_TYPE_RECHARGE), "充值入账");
        assert_eq!(log_type_text(LOG_TYPE_DEDUCT), "平台扣除");
        assert_eq!(log_type_text(LOG_TYPE_ADJUST), "平台调整");
        assert_eq!(log_type_text(99), "");
    }

    // ————————————— 查询参数归一 —————————————

    #[test]
    fn page_query_defaults_and_caps_match_base_page() {
        let q = DepositShopLogQuery::default();
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 15);

        let q = DepositShopLogQuery {
            page: Some(3),
            size: Some(1000),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 3);
        assert_eq!(p.page_size, 100);

        // 下界收敛（Java 未保护，本实现 clamp）
        let q = DepositShopLogQuery {
            page: Some(0),
            size: Some(0),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 1);
    }

    #[test]
    fn type_filter_merges_withdraw_and_refund() {
        let q = DepositShopLogQuery::default();
        assert!(q.type_filter().is_empty());

        let q = DepositShopLogQuery {
            r#type: Some(LOG_TYPE_WITHDRAW),
            ..Default::default()
        };
        assert_eq!(q.type_filter(), vec![2, 3]);

        let q = DepositShopLogQuery {
            r#type: Some(LOG_TYPE_REFUND),
            ..Default::default()
        };
        assert_eq!(q.type_filter(), vec![2, 3]);

        let q = DepositShopLogQuery {
            r#type: Some(LOG_TYPE_DEDUCT),
            ..Default::default()
        };
        assert_eq!(q.type_filter(), vec![4]);
    }

    #[test]
    fn trade_no_filter_requires_pure_digits() {
        let mk = |v: &str| DepositShopLogQuery {
            trade_no: Some(v.to_string()),
            ..Default::default()
        };
        assert_eq!(mk("").trade_no_filter(), None);
        assert_eq!(mk("   ").trade_no_filter(), None);
        assert_eq!(mk(" 123 ").trade_no_filter(), Some(123));
        assert_eq!(mk("T20260101").trade_no_filter(), None);
        assert_eq!(mk("12a").trade_no_filter(), None);
        assert_eq!(mk("12.5").trade_no_filter(), None);
        assert_eq!(mk("0").trade_no_filter(), Some(0));
        // 超 i64：Java 会抛 NumberFormatException，本实现忽略过滤
        assert_eq!(mk("99999999999999999999999").trade_no_filter(), None);
        assert_eq!(DepositShopLogQuery::default().trade_no_filter(), None);
    }

    #[test]
    fn query_deserializes_camel_case_fields() {
        let q: DepositShopLogQuery = serde_json::from_str(
            r#"{"type":4,"tradeNo":"88","startTime":100,"endTime":200,"page":2,"size":30}"#,
        )
        .expect("应能反序列化");
        assert_eq!(q.r#type, Some(4));
        assert_eq!(q.trade_no.as_deref(), Some("88"));
        assert_eq!(q.start_time, Some(100));
        assert_eq!(q.end_time, Some(200));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));

        // 空对象 / 无关字段都不应报错
        let q: DepositShopLogQuery = serde_json::from_str("{}").expect("空对象应可解析");
        assert_eq!(q.r#type, None);
        let q: DepositShopLogQuery =
            serde_json::from_str(r#"{"sortField":"addTime","keyword":"x"}"#)
                .expect("未使用字段应被忽略");
        assert_eq!(q.r#type, None);
    }

    // ————————————— 时间格式化 —————————————

    #[test]
    fn handel_time_zero_and_none_are_empty() {
        assert_eq!(handel_time(None), "");
        assert_eq!(handel_time(Some(0)), "");
        let s = handel_time(Some(1_700_000_000));
        assert_eq!(s.len(), 19, "s={s}");
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[13..14], ":");
    }

    // ————————————— 账户展示名富化 —————————————

    #[test]
    fn payee_display_joins_non_blank_parts_with_slash() {
        assert_eq!(
            format_payee_display(Some(1), Some("某某公司"), Some("6222***1234")),
            "银行卡/某某公司/6222***1234"
        );
        // 缺户名/账号 → 只剩类型文案
        assert_eq!(format_payee_display(Some(2), None, None), "支付宝");
        // 空白段跳过
        assert_eq!(
            format_payee_display(Some(3), Some("  "), Some("wx1")),
            "微信/wx1"
        );
        // 未知类型 → 无类型文案
        assert_eq!(format_payee_display(None, Some("甲"), None), "甲");
        assert_eq!(format_payee_display(Some(9), None, None), "");
    }

    #[test]
    fn recharge_source_prefers_snapshot_then_falls_back_to_type() {
        let snapshot =
            r#"{"id":3,"accountType":1,"accountName":"某某公司","accountNo":"6222***1234"}"#;
        assert_eq!(
            format_recharge_pay_account(2, Some(snapshot)),
            "银行卡/某某公司/6222***1234"
        );
        // 快照缺失 / 空白 → 回退到类型列
        assert_eq!(format_recharge_pay_account(3, None), "微信");
        assert_eq!(format_recharge_pay_account(3, Some("   ")), "微信");
        // 快照非法 JSON → 回退（Java 此处会抛 500，见 uncertain_points）
        assert_eq!(format_recharge_pay_account(1, Some("{not json")), "银行卡");
    }

    #[test]
    fn refund_dest_trims_payee_info() {
        assert_eq!(
            format_refund_payee_account(Some("  张三 6222  ")),
            "张三 6222"
        );
        assert_eq!(format_refund_payee_account(Some("   ")), "");
        assert_eq!(format_refund_payee_account(None), "");
    }

    #[test]
    fn source_dest_matches_java_enricher_branches() {
        // 充值：来源=收款账户快照，去向=保证金余额
        let (src, dst) = resolve_source_dest(LOG_TYPE_RECHARGE, Some((3, None)), None);
        assert_eq!(src.as_deref(), Some("微信"));
        assert_eq!(dst.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));

        // 充值但关联单缺失 → 来源为空串（不是 null）
        let (src, dst) = resolve_source_dest(LOG_TYPE_RECHARGE, None, None);
        assert_eq!(src.as_deref(), Some(""));
        assert_eq!(dst.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));

        // 平台扣除
        let (src, dst) = resolve_source_dest(LOG_TYPE_DEDUCT, None, None);
        assert_eq!(src.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));
        assert_eq!(dst.as_deref(), Some(ACCOUNT_PLATFORM));

        // 提现 / 退还：去向 = 收款信息
        let (src, dst) = resolve_source_dest(LOG_TYPE_WITHDRAW, None, Some(" 张三 "));
        assert_eq!(src.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));
        assert_eq!(dst.as_deref(), Some("张三"));
        let (_, dst) = resolve_source_dest(LOG_TYPE_REFUND, None, None);
        assert_eq!(dst.as_deref(), Some(""));

        // 平台调整：两边都是保证金余额
        let (src, dst) = resolve_source_dest(LOG_TYPE_ADJUST, None, None);
        assert_eq!(src.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));
        assert_eq!(dst.as_deref(), Some(ACCOUNT_DEPOSIT_BALANCE));

        // 未知类型：都不设置
        let (src, dst) = resolve_source_dest(99, None, None);
        assert!(src.is_none());
        assert!(dst.is_none());
    }

    // ————————————— VO 序列化契约 —————————————

    #[test]
    fn overview_vo_serializes_camel_case() {
        let vo = DepositShopOverviewVO {
            required: dec("100.00"),
            paid: dec("80.00"),
            pending: dec("20.00"),
            withdrawable: Decimal::ZERO,
            pending_withdraw: dec("5.00"),
            frozen: dec("80.00"),
            status: 1,
            penalty_status: 0,
            status_text: STATUS_TEXT_PENDING.to_string(),
            supplement_due_time: 1_700_000_000,
            supplement_due_time_text: handel_time(Some(1_700_000_000)),
            has_protocol: true,
        };
        let json = serde_json::to_value(&vo).expect("应能序列化");
        assert_eq!(json["status"], 1);
        assert_eq!(json["penaltyStatus"], 0);
        assert_eq!(json["statusText"], "待补缴");
        assert_eq!(json["supplementDueTime"], 1_700_000_000_i64);
        assert_eq!(json["hasProtocol"], true);
        assert!(json.get("status_text").is_none(), "不得出现 snake_case 键");
        assert!(json.get("penalty_status").is_none());
    }

    #[test]
    fn log_vo_serializes_nullable_source_dest() {
        let vo = DepositShopLogVO {
            shop_deposit_log_id: 9,
            r#type: LOG_TYPE_DEDUCT,
            type_text: log_type_text(LOG_TYPE_DEDUCT).to_string(),
            change_amount: dec("-30.00"),
            before_paid: dec("100.00"),
            after_paid: dec("70.00"),
            order_id: 5,
            related_id: 0,
            remark: None,
            add_time: 1_700_000_000,
            add_time_text: handel_time(Some(1_700_000_000)),
            source_account: Some(ACCOUNT_DEPOSIT_BALANCE.to_string()),
            dest_account: Some(ACCOUNT_PLATFORM.to_string()),
        };
        let json = serde_json::to_value(&vo).expect("应能序列化");
        assert_eq!(json["shopDepositLogId"], 9);
        assert_eq!(json["type"], 4);
        assert_eq!(json["typeText"], "平台扣除");
        assert_eq!(json["sourceAccount"], ACCOUNT_DEPOSIT_BALANCE);
        assert_eq!(json["destAccount"], ACCOUNT_PLATFORM);
        assert!(json["remark"].is_null());
    }

    #[test]
    fn protocol_vo_content_null_when_config_missing() {
        let vo = DepositShopProtocolVO {
            enable: false,
            content: None,
        };
        let json = serde_json::to_value(&vo).expect("应能序列化");
        assert_eq!(json["enable"], false);
        assert!(json["content"].is_null());
    }
}
