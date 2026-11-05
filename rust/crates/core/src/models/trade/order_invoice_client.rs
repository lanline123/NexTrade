//! 前台用户订单发票域（trade::order_invoice_client）DTO / VO / 纯函数。
//!
//! 对应原 Java `com.tigshop.api.controller.user.OrderInvoiceClientController`
//! （`/api/user/orderInvoice`，3 个端点：detail / create / update）。
//!
//! - `detail`：按发票 id + 当前会员查询 `order_invoice`，并回填订单快照（订单号/地址/金额）。
//! - `create`：校验「单位/个人名称不能为空」+ 订单归属 + 重复申请，落库 `status = 0`。
//! - `update`：仅 `status = 0`（待审核）可修改申请数据。
//! - 发票开具/状态流转（微信/百望等电子发票平台）未迁移 → 本域不实现开票动作。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// `请先登录`
pub const MSG_LOGIN_REQUIRED: &str = "请先登录";
/// `id不能为空`
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// `单位/个人名称不能为空`（Java `OrderInvoiceSaveParam.companyName @NotNull`）
pub const MSG_COMPANY_NAME_REQUIRED: &str = "单位/个人名称不能为空";
/// `订单不存在`
pub const MSG_ORDER_NOT_EXIST: &str = "订单不存在";
/// `发票不存在`
pub const MSG_INVOICE_NOT_EXIST: &str = "发票不存在";
/// `发票状态不允许修改`
pub const MSG_INVOICE_STATUS_INVALID: &str = "发票状态不允许修改";
/// `该订单已申请发票`
pub const MSG_INVOICE_ALREADY_APPLIED: &str = "该订单已申请发票";
/// 发票状态：待审核（Java `status = 0`）
pub const INVOICE_STATUS_PENDING: i32 = 0;

/// 发票申请入参（Java `OrderInvoiceSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceSaveParam {
    pub id: Option<i32>,
    pub user_id: Option<i32>,
    pub order_id: Option<i32>,
    pub invoice_type: Option<i32>,
    pub status: Option<i32>,
    pub apply_reply: Option<String>,
    pub title_type: Option<i32>,
    pub company_code: Option<String>,
    /// @NotNull：单位/个人名称不能为空
    pub company_name: Option<String>,
    pub company_address: Option<String>,
    pub company_phone: Option<String>,
    pub company_bank: Option<String>,
    pub company_account: Option<String>,
    pub invoice_content: Option<String>,
    pub invoice_no: Option<String>,
    pub amount: Option<Decimal>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub add_time: Option<i64>,
}

/// 发票修改入参（Java `OrderInvoiceEditParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceEditParam {
    pub id: Option<i32>,
    pub user_id: Option<i32>,
    pub order_id: Option<i32>,
    pub invoice_type: Option<i32>,
    pub status: Option<i32>,
    pub apply_reply: Option<String>,
    pub title_type: Option<i32>,
    pub company_code: Option<String>,
    pub company_name: Option<String>,
    pub company_address: Option<String>,
    pub company_phone: Option<String>,
    pub company_bank: Option<String>,
    pub company_account: Option<String>,
    pub invoice_content: Option<String>,
    pub invoice_no: Option<String>,
    pub amount: Option<Decimal>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub add_time: Option<i32>,
    pub invoice_attachment: Option<Vec<serde_json::Value>>,
}

/// 发票详情（Java `OrderInvoiceDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInvoiceDetailVO {
    pub id: i32,
    pub user_id: i32,
    pub order_id: i32,
    pub address: Option<String>,
    pub amount: Option<Decimal>,
    pub apply_reply: Option<String>,
    pub company_account: Option<String>,
    pub company_address: Option<String>,
    pub company_bank: Option<String>,
    pub company_code: Option<String>,
    pub company_name: Option<String>,
    pub company_phone: Option<String>,
    pub email: Option<String>,
    pub invoice_content: Option<String>,
    pub invoice_no: Option<String>,
    pub invoice_type: i32,
    pub invoice_type_name: Option<String>,
    pub mobile: Option<String>,
    pub order_sn: Option<String>,
    pub region_names: Vec<String>,
    pub status: i32,
    pub status_name: Option<String>,
    pub title_type: i32,
    pub title_type_name: Option<String>,
    pub total_amount: Option<Decimal>,
    pub user_address: Option<String>,
    pub invoice_attachment: Vec<serde_json::Value>,
}

/// 校验创建入参（Java `@Valid`：companyName @NotNull）。
#[must_use]
pub fn validate_create(param: &OrderInvoiceSaveParam) -> Result<(), String> {
    if param
        .company_name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .is_none()
    {
        return Err(MSG_COMPANY_NAME_REQUIRED.to_string());
    }
    Ok(())
}

/// 校验修改入参（id 必填）。
#[must_use]
pub fn validate_edit(param: &OrderInvoiceEditParam) -> Result<i32, String> {
    param
        .id
        .filter(|id| *id > 0)
        .ok_or_else(|| MSG_ID_REQUIRED.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_requires_company_name() {
        let mut param = OrderInvoiceSaveParam::default();
        assert_eq!(
            validate_create(&param).unwrap_err(),
            MSG_COMPANY_NAME_REQUIRED
        );
        param.company_name = Some("  ".into());
        assert_eq!(
            validate_create(&param).unwrap_err(),
            MSG_COMPANY_NAME_REQUIRED
        );
        param.company_name = Some("某某公司".into());
        assert!(validate_create(&param).is_ok());
    }

    #[test]
    fn edit_requires_id() {
        let mut param = OrderInvoiceEditParam::default();
        assert_eq!(validate_edit(&param).unwrap_err(), MSG_ID_REQUIRED);
        param.id = Some(3);
        assert_eq!(validate_edit(&param).unwrap(), 3);
    }

    #[test]
    fn params_accept_java_names() {
        let param: OrderInvoiceSaveParam = serde_json::from_str(
            r#"{"orderId":5,"invoiceType":1,"titleType":2,"companyName":"公司","amount":10.5}"#,
        )
        .unwrap();
        assert_eq!(param.order_id, Some(5));
        assert_eq!(param.company_name.as_deref(), Some("公司"));
        let vo = OrderInvoiceDetailVO {
            id: 1,
            status: INVOICE_STATUS_PENDING,
            ..Default::default()
        };
        let value = serde_json::to_value(&vo).unwrap();
        assert_eq!(value["invoiceType"], 0);
        assert_eq!(value["status"], 0);
    }
}
