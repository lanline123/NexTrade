//! 保证金收款账户（merchant::deposit_payee_account）模型层 —— wave9。
//!
//! 对应 Java `DepositPayeeAccountController`
//! （`@RequestMapping("/adminapi/deposit/payeeAccount")`），4 个端点。
//! 表 `shop_deposit_payee_account`：`shop_deposit_payee_account_id` /
//! `account_type` / `account_name` / `account_no` / `bank_name` / `bank_branch` /
//! `status` / `sort_order` / `add_time` / `update_time`。
//!
//! 文案逐字取自 Java `DepositPayeeAccountServiceImpl`：
//! - 账户ID不能为空 / 收款账户不存在 / 账户类型不能为空 / 账户名称不能为空 / 账户号不能为空

use serde::{Deserialize, Serialize};

/// 账户ID不能为空。
pub const MSG_ID_REQUIRED: &str = "账户ID不能为空";
/// 收款账户不存在。
pub const MSG_ACCOUNT_NOT_FOUND: &str = "收款账户不存在";
/// 账户类型不能为空。
pub const MSG_TYPE_REQUIRED: &str = "账户类型不能为空";
/// 账户名称不能为空。
pub const MSG_NAME_REQUIRED: &str = "账户名称不能为空";
/// 账户号不能为空。
pub const MSG_NO_REQUIRED: &str = "账户号不能为空";

/// 账户类型名称（1 银行卡 / 2 支付宝 / 3 微信，与提现账户一致）。
#[must_use]
pub fn account_type_text(code: i32) -> String {
    match code {
        1 => "银行卡".to_string(),
        2 => "支付宝".to_string(),
        3 => "微信".to_string(),
        other => format!("未知({other})"),
    }
}

/// 列表查询（Java `DepositPayeeAccountListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositPayeeAccountListQuery {
    /// 账户类型
    pub account_type: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    /// 关键字（账户名/账户号）
    pub keyword: Option<String>,
    /// 页码
    pub page: Option<u32>,
    /// 每页条数
    pub size: Option<u32>,
}

impl DepositPayeeAccountListQuery {
    /// 分页（默认 1/15）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1) as u64,
            page_size: self.size.unwrap_or(15).max(1) as u64,
        }
    }
}

/// 创建/更新账户（Java `DepositPayeeAccountDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositPayeeAccountDTO {
    /// 账户 ID（创建为空）
    pub id: Option<i32>,
    /// 账户类型
    pub account_type: Option<i32>,
    /// 账户名称
    pub account_name: Option<String>,
    /// 账户号
    pub account_no: Option<String>,
    /// 银行名称
    pub bank_name: Option<String>,
    /// 银行支行
    pub bank_branch: Option<String>,
    /// 状态
    pub status: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
}

/// 删除（Java `OperateDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositPayeeAccountDeleteDTO {
    /// 账户 ID
    pub id: i32,
}

/// 账户 VO（Java `DepositPayeeAccountVO`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositPayeeAccountVO {
    /// 账户 ID
    pub id: i32,
    /// 账户类型
    pub account_type: i32,
    /// 账户类型名称
    pub account_type_text: String,
    /// 账户名称
    pub account_name: String,
    /// 账户号
    pub account_no: String,
    /// 银行名称
    pub bank_name: String,
    /// 银行支行
    pub bank_branch: String,
    /// 状态
    pub status: i32,
    /// 排序
    pub sort_order: i32,
    /// 创建时间（秒）
    pub add_time: i64,
    /// 更新时间（秒）
    pub update_time: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_type_text_matches_enum() {
        assert_eq!(account_type_text(1), "银行卡");
        assert_eq!(account_type_text(2), "支付宝");
        assert_eq!(account_type_text(3), "微信");
        assert_eq!(account_type_text(9), "未知(9)");
    }

    #[test]
    fn list_query_defaults() {
        let q: DepositPayeeAccountListQuery =
            serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.account_type, None);
    }

    #[test]
    fn dto_is_camel_case() {
        let d: DepositPayeeAccountDTO = serde_json::from_value(serde_json::json!({
            "accountType":1,"accountName":"张三","accountNo":"6222","sortOrder":3
        }))
        .unwrap();
        assert_eq!(d.account_type, Some(1));
        assert_eq!(d.account_name.as_deref(), Some("张三"));
        assert_eq!(d.sort_order, Some(3));
    }
}
