//! 前台用户提现（payment::with_draw_apply_client）模型层。
//!
//! 对应 Java `WithDrawApplyClientController`
//! （`java/tigshop-api/.../controller/user/WithDrawApplyClientController.java`，
//! `@RequestMapping("/api/user/withdrawApply")`，7 个端点，契约 `auth=optional`）。
//!
//! 数据表：
//! - `user_withdraw_account`（提现账号，列表/新增/修改/详情/删除）
//! - `user_withdraw_apply`（提现申请，`apply` / `applyCommission`）
//! - `user`（余额 / 冻结余额 / 佣金余额 / 冻结佣金）
//! - `user_balance_log`（余额流水）
//!
//! 文案逐字取自 `java/tigshop-common/src/main/resources/i18n/messages.properties`：
//! - `error.withdraw.account.max.count` = 最多添加15个卡（L223）
//! - `error.withdraw.account.exist` = 当前账号已存在（L224）
//! - `error.withdraw.account.info.required` = 请填写提现账号信息（L225）
//! - `error.withdraw.amount.exceed.balance` = 提现金额大于账户的可用余额（L226）

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::{PageQuery, PageResult};

/// 提现账号数量上限（Java `Assert.isTrue(count <= 15, …)`，逐字保留其边界语义）。
pub const MAX_ACCOUNT_COUNT: u64 = 15;

/// 最多添加 15 个卡。
pub const MSG_ACCOUNT_MAX: &str = "最多添加15个卡";
/// 当前账号已存在。
pub const MSG_ACCOUNT_EXIST: &str = "当前账号已存在";
/// 请填写提现账号信息。
pub const MSG_ACCOUNT_REQUIRED: &str = "请填写提现账号信息";
/// 提现金额大于账户的可用余额。
pub const MSG_AMOUNT_EXCEED_BALANCE: &str = "提现金额大于账户的可用余额";
/// 提现金额大于账户的可用佣金（`applyCommission` 的文案，Java 直接中文字面量）。
pub const MSG_AMOUNT_EXCEED_COMMISSION: &str = "提现金额大于账户的可用佣金";
/// 请选择提现方式。
pub const MSG_ACCOUNT_TYPE_REQUIRED: &str = "请选择提现方式";
/// 会员不存在。
pub const MSG_USER_NOT_FOUND: &str = "会员不存在";
/// 提现账号不存在。
pub const MSG_ACCOUNT_NOT_FOUND: &str = "提现账号不存在";

/// 提现账号类型名称（Java `UserWithdrawAccountType`：1 银行卡 / 2 支付宝 / 3 微信）。
#[must_use]
pub fn account_type_name(code: i32) -> String {
    match code {
        1 => "银行卡".to_string(),
        2 => "支付宝".to_string(),
        3 => "微信".to_string(),
        other => format!("未知({other})"),
    }
}

/// 列表查询（Java `UserWithdrawApplyListQuery`：分页 + accountId/accountType 过滤）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountListQuery {
    /// 页码（Java `page`，默认 1）
    pub page: Option<i64>,
    /// 每页条数（Java `size`，默认 15）
    pub size: Option<i64>,
    /// 提现账号 ID（>0 生效）
    pub account_id: Option<i32>,
    /// 提现账号类型（>0 生效）
    pub account_type: Option<i32>,
}

impl WithdrawAccountListQuery {
    /// 统一分页信封（与其余已迁移 feature 一致：默认 1/15）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: u64::try_from(self.page.unwrap_or(1).max(1)).unwrap_or(1),
            page_size: u64::try_from(self.size.unwrap_or(15).max(1)).unwrap_or(15),
        }
    }

    /// LIMIT 参数。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let p = self.page_query();
        (
            u64::from(p.page_size),
            u64::from(p.page - 1) * u64::from(p.page_size),
        )
    }
}

/// 创建提现账号（Java `WithdrawApplyAccountCreateParam`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountCreateDTO {
    /// 提现方式：1 银行卡 / 2 支付宝 / 3 微信
    pub account_type: i32,
    /// 姓名
    pub account_name: String,
    /// 银行卡号或账号
    pub account_no: String,
    /// 身份证号
    pub identity: Option<String>,
    /// 银行名称
    pub bank_name: Option<String>,
}

/// 修改提现账号（Java `WithdrawApplyAccountUpdateDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountUpdateDTO {
    /// 提现账号 ID
    pub account_id: i32,
    /// 提现方式
    pub account_type: Option<i32>,
    /// 姓名
    pub account_name: Option<String>,
    /// 银行卡号或账号
    pub account_no: Option<String>,
    /// 身份证号
    pub identity: Option<String>,
    /// 银行名称
    pub bank_name: Option<String>,
}

/// 删除提现账号（Java `UserWithdrawApplyDelDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountDeleteDTO {
    /// 提现账号 ID
    pub account_id: i32,
}

/// 提现账号快照（`user_withdraw_apply.account_data` 的 JSON 形态，
/// 对应 Java `UserWithdrawApplyCreateAccountDataDTO`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountData {
    /// 姓名
    pub account_name: Option<String>,
    /// 银行卡号或账号
    pub account_no: Option<String>,
    /// 提现方式：1 银行卡 / 2 支付宝 / 3 微信
    pub account_type: Option<i32>,
    /// 银行名称
    pub bank_name: Option<String>,
    /// 身份证号
    pub identity: Option<String>,
}

/// 提现申请（Java `UserWithDrawApplyDTO`）。
///
/// Java DTO 同时接受嵌套 `accountData` 与扁平 `accountType/accountName/...`
/// 两种入参；这里两者都接收，服务层优先使用 `accountData`、缺失时回落扁平字段。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawApplyDTO {
    /// 提现金额
    pub amount: Decimal,
    /// 提现账号快照
    pub account_data: Option<WithdrawAccountData>,
    /// 扁平提现方式（兼容字段）
    pub account_type: Option<i32>,
    /// 扁平姓名（兼容字段）
    pub account_name: Option<String>,
    /// 扁平账号（兼容字段）
    pub account_no: Option<String>,
    /// 扁平银行名称（兼容字段）
    pub bank_name: Option<String>,
}

impl WithdrawApplyDTO {
    /// 归一化出提现账号快照（优先 `accountData`，否则用扁平字段拼）。
    #[must_use]
    pub fn normalize_account(&self) -> WithdrawAccountData {
        if let Some(a) = &self.account_data {
            return a.clone();
        }
        WithdrawAccountData {
            account_name: self.account_name.clone(),
            account_no: self.account_no.clone(),
            account_type: self.account_type,
            bank_name: self.bank_name.clone(),
            identity: None,
        }
    }
}

/// 提现账号 VO（Java `WithdrawApplyAccountVO`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawAccountVO {
    /// 提现账号 ID
    pub account_id: i32,
    /// 姓名
    pub account_name: String,
    /// 银行卡号或账号
    pub account_no: String,
    /// 提现方式
    pub account_type: i32,
    /// 提现方式名称
    pub account_type_name: String,
    /// 银行名称
    pub bank_name: String,
    /// 身份证号
    pub identity: String,
    /// 用户 ID
    pub user_id: i32,
}

/// 列表分页信封（与其余 feature 一致使用 `PageResult`）。
pub type WithdrawAccountPage = PageResult<WithdrawAccountVO>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_type_names_match_java_enum() {
        assert_eq!(account_type_name(1), "银行卡");
        assert_eq!(account_type_name(2), "支付宝");
        assert_eq!(account_type_name(3), "微信");
        assert_eq!(account_type_name(9), "未知(9)");
    }

    #[test]
    fn query_defaults_and_limit_offset() {
        let q: WithdrawAccountListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.limit_offset(), (15, 0));

        let q: WithdrawAccountListQuery =
            serde_json::from_value(serde_json::json!({"page":3,"size":10,"accountId":7})).unwrap();
        assert_eq!(q.limit_offset(), (10, 20));
        assert_eq!(q.account_id, Some(7));
    }

    #[test]
    fn apply_dto_normalizes_flat_fields() {
        let d: WithdrawApplyDTO = serde_json::from_value(serde_json::json!({
            "amount": "12.34",
            "accountType": 2,
            "accountName": "张三",
            "accountNo": "a@b.com",
            "bankName": "支付宝"
        }))
        .unwrap();
        let a = d.normalize_account();
        assert_eq!(a.account_type, Some(2));
        assert_eq!(a.account_name.as_deref(), Some("张三"));
        assert_eq!(d.amount, Decimal::new(1234, 2));
    }

    #[test]
    fn apply_dto_prefers_nested_account_data() {
        let d: WithdrawApplyDTO = serde_json::from_value(serde_json::json!({
            "amount": 1,
            "accountData": {"accountType": 1, "accountName": "李四"}
        }))
        .unwrap();
        let a = d.normalize_account();
        assert_eq!(a.account_type, Some(1));
        assert_eq!(a.account_name.as_deref(), Some("李四"));
    }
}
