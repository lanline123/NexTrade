//! 保证金充值域（merchant::deposit_recharge）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.deposit.DepositRechargeController`
//!   （`@RequestMapping("/adminapi/deposit/recharge")`，10 个端点）
//! - `com.tigshop.service.deposit.impl.DepositRechargeServiceImpl`（595 行）
//! - `DepositRechargeApplyDTO` / `DepositRechargeAuditDTO` / `DepositRechargeListDTO` /
//!   `DepositPaymentAuditListDTO`
//! - `DepositPayeeAccountVO` / `DepositRechargeVO` / `DepositPaymentAuditVO`
//! - 枚举 `DepositOwnerType` / `DepositRechargeStatus` / `DepositRefundStatus` /
//!   `DepositRefundType` / `DepositPayeeAccountType` / `DepositLogType`
//!
//! # 与 Java 的口径说明
//!
//! - **金额出参为字符串**：Java VO 的 `BigDecimal` 由 Jackson 序列化为 JSON
//!   number；本域沿用同 ctx `deposit_account` 的既有约定，VO 金额用
//!   `String`（两位小数文本，`Decimal::to_string()`），见 `uncertain_points`。
//! - **时间**：Java `TigUtils.handelTime(Long)`（null/0 → 空串，否则
//!   `yyyy-MM-dd HH:mm:ss`，系统默认时区）；本文件 [`format_time`] 用
//!   `chrono::Local` 复刻同一口径。
//! - **收款账户快照**：Java `JSON.toJSONString(payeeVO)` 存
//!   `shop_deposit_recharge.payee_snapshot`；本文件
//!   [`payee_snapshot_json`] / [`DepositPayeeAccountSnapshot`] 用同形
//!   camelCase JSON 复刻（只保证本域读回的 5 个展示字段一致）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;
use crate::Error;

// ——————————————————————————————————————————————
// 常量（Java `HttpStatus` / 枚举 / 错误文案）
// ——————————————————————————————————————————————

/// Java `HttpStatus.SERVICE_DATA_ERROR`。
pub const SERVICE_DATA_ERROR: i32 = 1001;
/// Java `HttpStatus.DEPOSIT_AMOUNT_INVALID`。
pub const DEPOSIT_AMOUNT_INVALID: i32 = 5401;
/// Java `HttpStatus.DEPOSIT_BALANCE_NOT_ENOUGH`。
pub const DEPOSIT_BALANCE_NOT_ENOUGH: i32 = 5402;
/// Java `HttpStatus.DEPOSIT_RECHARGE_STATUS_INVALID`。
pub const DEPOSIT_RECHARGE_STATUS_INVALID: i32 = 5403;

/// 持有者类型：店铺（Java `DepositOwnerType.SHOP`）。
pub const OWNER_SHOP: i32 = 1;
/// 持有者类型：供应商（Java `DepositOwnerType.SUPPLIER`）。
pub const OWNER_SUPPLIER: i32 = 2;

/// 保证金流水类型：充值入账（Java `DepositLogType.RECHARGE`）。
pub const LOG_TYPE_RECHARGE: i32 = 1;
/// 保证金流水类型：提现出账（Java `DepositLogType.WITHDRAW`）。
pub const LOG_TYPE_WITHDRAW: i32 = 2;
/// 保证金流水类型：退还出账（Java `DepositLogType.REFUND`，存量值）。
pub const LOG_TYPE_REFUND: i32 = 3;
/// 保证金流水类型：平台调整（Java `DepositLogType.ADJUST`，带符号金额）。
pub const LOG_TYPE_ADJUST: i32 = 5;

/// 充值单状态：待审核（Java `DepositRechargeStatus.PENDING_REVIEW`）。
pub const RECHARGE_PENDING: i32 = 0;
/// 充值单状态：已入账（Java `DepositRechargeStatus.CREDITED`）。
pub const RECHARGE_CREDITED: i32 = 1;
/// 充值单状态：驳回（Java `DepositRechargeStatus.REJECTED`）。
pub const RECHARGE_REJECTED: i32 = 2;

/// 退还单类型：部分退还/提现（Java `DepositRefundType.WITHDRAW`）。
pub const REFUND_TYPE_WITHDRAW: i32 = 1;
/// 退还单类型：全额退还（Java `DepositRefundType.FULL_REFUND`）。
pub const REFUND_TYPE_FULL: i32 = 2;

/// 审核类型：充值（Java `DepositPaymentAuditVO.auditType = 1`）。
pub const AUDIT_TYPE_RECHARGE: i32 = 1;
/// 审核类型：退还（Java `DepositPaymentAuditVO.auditType = 2`）。
pub const AUDIT_TYPE_REFUND: i32 = 2;

/// `持有者不存在`
pub const MSG_OWNER_NOT_EXIST: &str = "持有者不存在";
/// `保证金金额非法`
pub const MSG_AMOUNT_INVALID: &str = "保证金金额非法";
/// `保证金余额不足`
pub const MSG_BALANCE_NOT_ENOUGH: &str = "保证金余额不足";
/// `请选择收款账户`
pub const MSG_PAYEE_REQUIRED: &str = "请选择收款账户";
/// `收款账户不存在`
pub const MSG_PAYEE_NOT_EXIST: &str = "收款账户不存在";
/// `收款账户已停用`
pub const MSG_PAYEE_DISABLED: &str = "收款账户已停用";
/// `充值单不存在`
pub const MSG_RECHARGE_NOT_EXIST: &str = "充值单不存在";
/// `充值单状态非法`
pub const MSG_RECHARGE_STATUS_INVALID: &str = "充值单状态非法";
/// `退还单不存在`
pub const MSG_REFUND_NOT_EXIST: &str = "退还单不存在";
/// `单据不存在`
pub const MSG_BILL_NOT_EXIST: &str = "单据不存在";
/// `审核类型非法`
pub const MSG_AUDIT_TYPE_INVALID: &str = "审核类型非法";

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`）。
///
/// Java `null` 或 `0` → 空串；本实现 `<= 0` → 空串（与既有 `handel_time` 一致）。
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

/// 充值单状态文案（Java `DepositRechargeStatus.getDescByCode`）。
#[must_use]
pub fn recharge_status_text(code: i32) -> &'static str {
    match code {
        RECHARGE_PENDING => "待审核",
        RECHARGE_CREDITED => "已通过",
        RECHARGE_REJECTED => "未通过",
        _ => "",
    }
}

/// 退还单状态文案（Java `DepositRefundStatus.getDescByCode`）。
#[must_use]
pub fn refund_status_text(code: i32) -> &'static str {
    match code {
        0 => "待审核",
        1 => "已通过",
        2 => "未通过",
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

/// 收款账户类型文案（Java `DepositPayeeAccountType.getDescByCode`）。
#[must_use]
pub fn payee_account_type_text(code: i32) -> &'static str {
    match code {
        1 => "银行卡",
        2 => "支付宝",
        3 => "微信",
        _ => "",
    }
}

/// 主体类型文案（商户性质：1 个人 2 企业）。
#[must_use]
pub fn subject_type_text(code: i32) -> &'static str {
    match code {
        1 => "个人",
        2 => "企业",
        _ => "",
    }
}

/// 审核类型文案（Java `toAuditVO` 里硬编码）。
#[must_use]
pub fn audit_type_text(audit_type: i32) -> &'static str {
    match audit_type {
        AUDIT_TYPE_RECHARGE => "保证金充值",
        AUDIT_TYPE_REFUND => "保证金退还",
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

/// 合并列表的内存分页切片（Java `paymentAuditList` 的
/// `Math.min((pageNo-1)*pageSize, size)`）。
#[must_use]
pub fn slice_page(total: usize, page: u64, size: u64) -> (usize, usize) {
    let page_size = usize::try_from(size.max(1)).unwrap_or(usize::MAX);
    let from = usize::try_from((page.max(1) - 1).saturating_mul(size.max(1)))
        .unwrap_or(usize::MAX)
        .min(total);
    let to = from.saturating_add(page_size).min(total);
    (from, to)
}

/// 充值单列表允许的排序字段（Java `getColumnByPropertyName` 白名单：属性名或列名，
/// 非法值回退主键，防 SQL 注入）。
#[must_use]
pub fn recharge_sort_column(field: Option<&str>) -> &'static str {
    match field.map(str::trim).filter(|f| !f.is_empty()) {
        Some("shopDepositRechargeId") | Some("shop_deposit_recharge_id") => {
            "shop_deposit_recharge_id"
        }
        Some("ownerType") | Some("owner_type") => "owner_type",
        Some("ownerId") | Some("owner_id") => "owner_id",
        Some("amount") => "amount",
        Some("payeeAccountId") | Some("payee_account_id") => "payee_account_id",
        Some("payeeAccountType") | Some("payee_account_type") => "payee_account_type",
        Some("remark") => "remark",
        Some("status") => "status",
        Some("auditAdminId") | Some("audit_admin_id") => "audit_admin_id",
        Some("auditTime") | Some("audit_time") => "audit_time",
        Some("auditRemark") | Some("audit_remark") => "audit_remark",
        Some("addTime") | Some("add_time") => "add_time",
        Some("updateTime") | Some("update_time") => "update_time",
        _ => "shop_deposit_recharge_id",
    }
}

/// 排序方向：`asc` → true（其余含空 → 降序，Java `buildSortOrder`）。
#[must_use]
pub fn sort_is_asc(order: Option<&str>) -> bool {
    matches!(order.map(str::trim), Some(v) if v.eq_ignore_ascii_case("asc"))
}

/// 保证金账户变动（Java `DepositAccountServiceImpl#changeDeposit` 的核心分支）。
///
/// 入参：当前实缴 `paid`、正数 `amount`、流水类型。
/// 返回 `(change_amount, after_paid)`：
/// - `RECHARGE`：`(+amount, paid + amount)`（amount 必须 > 0）
/// - `ADJUST`：`amount` 为**带符号**金额，`(amount, paid + amount)`，结果不可为负
/// - 其它（WITHDRAW / REFUND / DEDUCT）：`(-amount, paid - amount)`，余额不足报错
///
/// 错误码与文案逐字对齐 Java：`5401 保证金金额非法` / `5402 保证金余额不足`。
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
    if log_type == LOG_TYPE_RECHARGE {
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

/// 收款账户快照 JSON（Java `JSON.toJSONString(payeeVO)` 的本域等价形态）。
#[must_use]
pub fn payee_snapshot_json(vo: &DepositPayeeAccountVO) -> String {
    serde_json::json!({
        "id": vo.id,
        "accountType": vo.account_type,
        "accountTypeText": vo.account_type_text,
        "accountName": vo.account_name,
        "accountNo": vo.account_no,
        "bankName": vo.bank_name,
        "bankBranch": vo.bank_branch,
        "status": vo.status,
        "sortOrder": vo.sort_order,
        "addTime": vo.add_time,
        "updateTime": vo.update_time,
    })
    .to_string()
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// `payeeAccountOptions` 查询参数（Java 两个 `@RequestParam(required=false)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PayeeAccountOptionsQuery {
    /// 账户类型 1银行卡 2支付宝 3微信
    pub account_type: Option<i32>,
    /// 关键词（账户名称/账号模糊匹配）
    pub keyword: Option<String>,
}

/// 充值申请（Java `DepositRechargeApplyDTO`；shopId/vendorId 取自请求头）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRechargeApplyDTO {
    /// 充值金额
    pub amount: Option<Decimal>,
    /// 充值到的收款账户 id（必填）
    pub payee_account_id: Option<i32>,
    /// 转账/支付凭证
    pub pay_voucher: Option<String>,
    /// 申请备注
    pub remark: Option<String>,
}

/// 充值审核（Java `DepositRechargeAuditDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRechargeAuditDTO {
    /// 充值单 id
    pub id: Option<i32>,
    /// 是否通过：true 通过入账，false 驳回
    pub pass: Option<bool>,
    /// 审核备注/驳回原因
    pub audit_remark: Option<String>,
}

/// 平台端充值单列表查询（Java `DepositRechargeListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRechargeListQuery {
    /// 持有者类型 1店铺 2供应商；不传=全部
    pub owner_type: Option<i32>,
    /// 持有者 id（店铺为 shopId，供应商为 vendorId）
    pub owner_id: Option<i32>,
    /// 兼容旧入参：等价于 ownerId
    pub shop_id: Option<i32>,
    /// 组织名称（店铺名/供应商名模糊匹配）
    pub owner_name: Option<String>,
    /// 主体类型（商户性质：1个人 2企业）
    pub subject_type: Option<i32>,
    /// 收款账户类型筛选
    pub payee_account_type: Option<i32>,
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

impl DepositRechargeListQuery {
    /// 有效 ownerId（Java：优先 ownerId，兼容旧入参 shopId）。
    #[must_use]
    pub fn effective_owner_id(&self) -> Option<i32> {
        self.owner_id.or(self.shop_id).filter(|v| *v > 0)
    }
}

/// 店铺/供应商端款项审核合并列表查询（Java `DepositPaymentAuditListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositPaymentAuditListQuery {
    /// 审核类型 1充值 2退还；不传=全部混合
    pub audit_type: Option<i32>,
    /// 审核状态 0待审核 1已通过 2未通过
    pub status: Option<i32>,
    /// 提交开始时间（秒级）
    pub start_time: Option<i64>,
    /// 提交结束时间（秒级）
    pub end_time: Option<i64>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// 款项审核详情查询（Java 两个必填 `@RequestParam`）。
///
/// 不添加结构级 `default`：缺参时反序列化失败 → axum 400，与 Java
/// `MissingServletRequestParameterException` 一致。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentAuditDetailQuery {
    /// 审核类型 1充值 2退还（必填）
    pub audit_type: i32,
    /// 业务单 id（必填）
    pub biz_id: i32,
}

/// 平台端充值单详情查询（Java `detail(Integer id)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RechargeIdQuery {
    /// 充值单 id（Java 可为 null → 返回 null）
    pub id: Option<i32>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 平台保证金收款账户（Java `DepositPayeeAccountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositPayeeAccountVO {
    /// 账户 ID
    pub id: i32,
    /// 账户类型 1银行卡 2支付宝 3微信
    pub account_type: i32,
    /// 账户类型文本
    pub account_type_text: String,
    /// 账户名称（户名）
    pub account_name: String,
    /// 账户号
    pub account_no: String,
    /// 银行名称
    pub bank_name: Option<String>,
    /// 银行支行
    pub bank_branch: Option<String>,
    /// 状态 1启用 0停用
    pub status: i32,
    /// 排序
    pub sort_order: i32,
    /// 添加时间（秒级时间戳）
    pub add_time: i64,
    /// 更新时间（秒级时间戳）
    pub update_time: i64,
}

/// 收款账户快照（Java `payee_snapshot` JSON 的非空字段子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositPayeeAccountSnapshot {
    pub account_type: Option<i32>,
    pub account_name: Option<String>,
    pub account_no: Option<String>,
    pub bank_name: Option<String>,
    pub bank_branch: Option<String>,
}

impl DepositPayeeAccountSnapshot {
    /// 从 JSON 文本解析；空白或非法 JSON → `None`（Java `JSON.parseObject` 同理）。
    #[must_use]
    pub fn parse(raw: Option<&str>) -> Option<Self> {
        let raw = raw?.trim();
        if raw.is_empty() {
            return None;
        }
        serde_json::from_str(raw).ok()
    }
}

/// 充值单（Java `DepositRechargeVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRechargeVO {
    pub shop_deposit_recharge_id: i32,
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
    /// 充值金额（两位小数文本，见模块注释）
    pub amount: String,
    pub pay_voucher: Option<String>,
    pub remark: Option<String>,
    pub payee_account_id: i32,
    pub payee_account_type: i32,
    pub payee_account_type_text: Option<String>,
    pub payee_account_name: Option<String>,
    pub payee_account_no: Option<String>,
    pub payee_bank_name: Option<String>,
    pub payee_bank_branch: Option<String>,
    pub status: i32,
    pub status_text: String,
    pub audit_admin_id: i32,
    pub audit_time: i64,
    pub audit_time_text: String,
    pub audit_remark: Option<String>,
    pub add_time: i64,
    pub add_time_text: String,
}

/// 款项审核合并行（Java `DepositPaymentAuditVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositPaymentAuditVO {
    pub audit_type: i32,
    pub audit_type_text: String,
    /// 业务单 id（充值=充值单 id，退还=退还单 id）
    pub biz_id: i32,
    /// 交易金额（两位小数文本）
    pub amount: String,
    pub status: i32,
    pub status_text: String,
    /// 退还类型（仅退还行有值）
    pub refund_type: Option<i32>,
    pub refund_type_text: Option<String>,
    pub remark: Option<String>,
    pub pay_voucher: Option<String>,
    pub audit_remark: Option<String>,
    pub audit_time: i64,
    pub audit_time_text: String,
    pub add_time: i64,
    pub add_time_text: String,
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
        assert_eq!(recharge_status_text(0), "待审核");
        assert_eq!(recharge_status_text(1), "已通过");
        assert_eq!(recharge_status_text(2), "未通过");
        assert_eq!(refund_status_text(1), "已通过");
        assert_eq!(refund_type_text(1), "部分退还");
        assert_eq!(refund_type_text(2), "全部退还");
        assert_eq!(payee_account_type_text(1), "银行卡");
        assert_eq!(payee_account_type_text(2), "支付宝");
        assert_eq!(payee_account_type_text(3), "微信");
        assert_eq!(subject_type_text(1), "个人");
        assert_eq!(subject_type_text(2), "企业");
        assert_eq!(audit_type_text(1), "保证金充值");
        assert_eq!(audit_type_text(2), "保证金退还");
    }

    #[test]
    fn deposit_change_matches_java_change_deposit() {
        // 充值：+amount
        assert_eq!(
            deposit_change(d("100"), d("50"), LOG_TYPE_RECHARGE).unwrap(),
            (d("50"), d("150"))
        );
        // 提现/退还：-amount
        assert_eq!(
            deposit_change(d("100"), d("40"), LOG_TYPE_WITHDRAW).unwrap(),
            (d("-40"), d("60"))
        );
        // 提现出账比存量 type=3 同样按扣减处理
        assert_eq!(
            deposit_change(d("100"), d("40"), LOG_TYPE_REFUND).unwrap(),
            (d("-40"), d("60"))
        );
        // 平台调整：带符号
        assert_eq!(
            deposit_change(d("100"), d("-30"), LOG_TYPE_ADJUST).unwrap(),
            (d("-30"), d("70"))
        );
        // 余额不足 → 5402
        let err = deposit_change(d("10"), d("40"), LOG_TYPE_WITHDRAW).unwrap_err();
        assert_eq!(err.business_code(), DEPOSIT_BALANCE_NOT_ENOUGH);
        assert!(err.to_string().contains(MSG_BALANCE_NOT_ENOUGH));
        // 金额非法 → 5401
        let err = deposit_change(d("10"), d("0"), LOG_TYPE_RECHARGE).unwrap_err();
        assert_eq!(err.business_code(), DEPOSIT_AMOUNT_INVALID);
        assert!(err.to_string().contains(MSG_AMOUNT_INVALID));
        // 平台调整后为负 → 5402
        let err = deposit_change(d("10"), d("-30"), LOG_TYPE_ADJUST).unwrap_err();
        assert_eq!(err.business_code(), DEPOSIT_BALANCE_NOT_ENOUGH);
    }

    #[test]
    fn page_and_slice_match_base_page() {
        assert_eq!(page_params(None, None), (1, 15));
        assert_eq!(page_params(Some(0), Some(0)), (1, 1));
        assert_eq!(page_params(Some(2), Some(500)), (2, 100));
        assert_eq!(page_query(Some(3), Some(10)).page, 3);
        assert_eq!(page_query(Some(3), Some(10)).page_size, 10);

        // paymentAuditList 内存分页：越界页 from == total
        assert_eq!(slice_page(0, 1, 15), (0, 0));
        assert_eq!(slice_page(5, 1, 2), (0, 2));
        assert_eq!(slice_page(5, 2, 2), (2, 4));
        assert_eq!(slice_page(5, 3, 2), (4, 5));
        assert_eq!(slice_page(5, 9, 2), (5, 5));
    }

    #[test]
    fn sort_whitelist_and_direction() {
        assert_eq!(recharge_sort_column(None), "shop_deposit_recharge_id");
        assert_eq!(recharge_sort_column(Some("addTime")), "add_time");
        assert_eq!(recharge_sort_column(Some("amount")), "amount");
        // 非法字段回退主键（防注入）
        assert_eq!(
            recharge_sort_column(Some("amount; DROP TABLE x")),
            "shop_deposit_recharge_id"
        );
        assert!(sort_is_asc(Some("asc")));
        assert!(sort_is_asc(Some("ASC")));
        assert!(!sort_is_asc(Some("desc")));
        assert!(!sort_is_asc(None));
    }

    #[test]
    fn payee_snapshot_roundtrip() {
        let vo = DepositPayeeAccountVO {
            id: 3,
            account_type: 1,
            account_type_text: "银行卡".into(),
            account_name: "张三".into(),
            account_no: "6222".into(),
            bank_name: Some("工行".into()),
            bank_branch: Some("南昌分行".into()),
            status: 1,
            sort_order: 2,
            add_time: 1_700_000_000,
            update_time: 1_700_000_100,
        };
        let raw = payee_snapshot_json(&vo);
        let snapshot = DepositPayeeAccountSnapshot::parse(Some(&raw)).expect("快照可解析");
        assert_eq!(snapshot.account_type, Some(1));
        assert_eq!(snapshot.account_name.as_deref(), Some("张三"));
        assert_eq!(snapshot.account_no.as_deref(), Some("6222"));
        assert_eq!(snapshot.bank_name.as_deref(), Some("工行"));
        assert_eq!(snapshot.bank_branch.as_deref(), Some("南昌分行"));
        // 空白 / 非法 JSON → None（Java JSON.parseObject 亦返回 null）
        assert!(DepositPayeeAccountSnapshot::parse(None).is_none());
        assert!(DepositPayeeAccountSnapshot::parse(Some("  ")).is_none());
        assert!(DepositPayeeAccountSnapshot::parse(Some("not-json")).is_none());
    }

    #[test]
    fn format_time_matches_handel_time() {
        assert_eq!(format_time(0), "");
        assert_eq!(format_time(-1), "");
        let s = format_time(1_700_000_000);
        assert_eq!(s.len(), 19, "yyyy-MM-dd HH:mm:ss: {s}");
    }

    #[test]
    fn queries_accept_java_camel_case() {
        let q: DepositRechargeListQuery = serde_json::from_str(
            r#"{"ownerType":1,"ownerId":9,"shopId":8,"ownerName":"A","subjectType":2,
                "payeeAccountType":1,"status":0,"startTime":100,"endTime":200,
                "page":2,"size":30,"sortField":"addTime","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.owner_type, Some(1));
        assert_eq!(q.effective_owner_id(), Some(9));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));

        // shopId 兼容入参
        let q: DepositRechargeListQuery = serde_json::from_str(r#"{"shopId":8}"#).unwrap();
        assert_eq!(q.effective_owner_id(), Some(8));

        let dto: DepositRechargeApplyDTO =
            serde_json::from_str(r#"{"amount":100.50,"payeeAccountId":3,"payVoucher":"v"}"#)
                .unwrap();
        assert_eq!(dto.amount, Some(d("100.50")));
        assert_eq!(dto.payee_account_id, Some(3));

        let dto: DepositRechargeAuditDTO =
            serde_json::from_str(r#"{"id":5,"pass":true,"auditRemark":"ok"}"#).unwrap();
        assert_eq!(dto.id, Some(5));
        assert_eq!(dto.pass, Some(true));
    }
}
