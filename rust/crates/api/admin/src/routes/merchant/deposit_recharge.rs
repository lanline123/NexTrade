//! 管理端保证金充值路由（merchant::deposit_recharge）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.deposit.DepositRechargeController`
//! （`@RequestMapping("/adminapi/deposit/recharge")`，10 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `GET  /deposit/recharge/payeeAccountOptions` | `payeeAccountOptions` | 登录 |
//! | `POST /deposit/recharge/apply` | `apply` | 登录 |
//! | `POST /deposit/recharge/vendorApply` | `vendorApply` | 登录 |
//! | `GET  /deposit/recharge/shopPaymentAuditList` | `shopPaymentAuditList` | 登录 |
//! | `GET  /deposit/recharge/vendorPaymentAuditList` | `vendorPaymentAuditList` | 登录 |
//! | `GET  /deposit/recharge/shopPaymentAuditDetail` | `shopPaymentAuditDetail` | 登录 |
//! | `GET  /deposit/recharge/vendorPaymentAuditDetail` | `vendorPaymentAuditDetail` | 登录 |
//! | `GET  /deposit/recharge/list` | `list` | `depositPaymentAuditManage` |
//! | `GET  /deposit/recharge/detail` | `detail` | `depositPaymentAuditManage` |
//! | `POST /deposit/recharge/audit` | `audit` | `depositRechargeAudit` |
//!
//! > **权限说明**：Java 方法级 `@PreAuthorize("@pms.hasPermission(...)")`；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现（与其它域已知缺口一致）。
//!
//! > **请求头口径**：Java 用 `HeaderUtils.getShopId()` / `getVendorId()`
//! > （`x-admin-type` / `x-shop-id` / `x-vendor-id`）识别店铺/供应商端身份；
//! > 本模块用 [`shop_id_from_headers`] / [`vendor_id_from_headers`] 逐分支复刻。

use axum::{
    extract::Query,
    extract::State,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::merchant::deposit_recharge::{
    DepositPayeeAccountVO, DepositPaymentAuditListQuery, DepositPaymentAuditVO,
    DepositRechargeApplyDTO, DepositRechargeAuditDTO, DepositRechargeListQuery, DepositRechargeVO,
    PayeeAccountOptionsQuery, PaymentAuditDetailQuery, RechargeIdQuery,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 10 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `DepositRechargeController` 一致；[`implemented_routes`] 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 10] = [
    (
        "GET",
        "/deposit/recharge/payeeAccountOptions",
        "DepositRechargeController.payeeAccountOptions",
    ),
    (
        "POST",
        "/deposit/recharge/apply",
        "DepositRechargeController.apply",
    ),
    (
        "POST",
        "/deposit/recharge/vendorApply",
        "DepositRechargeController.vendorApply",
    ),
    (
        "GET",
        "/deposit/recharge/shopPaymentAuditList",
        "DepositRechargeController.shopPaymentAuditList",
    ),
    (
        "GET",
        "/deposit/recharge/vendorPaymentAuditList",
        "DepositRechargeController.vendorPaymentAuditList",
    ),
    (
        "GET",
        "/deposit/recharge/shopPaymentAuditDetail",
        "DepositRechargeController.shopPaymentAuditDetail",
    ),
    (
        "GET",
        "/deposit/recharge/vendorPaymentAuditDetail",
        "DepositRechargeController.vendorPaymentAuditDetail",
    ),
    (
        "GET",
        "/deposit/recharge/list",
        "DepositRechargeController.list",
    ),
    (
        "GET",
        "/deposit/recharge/detail",
        "DepositRechargeController.detail",
    ),
    (
        "POST",
        "/deposit/recharge/audit",
        "DepositRechargeController.audit",
    ),
];

/// 保证金充值域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/deposit/recharge/payeeAccountOptions",
            get(payee_account_options),
        )
        .route("/deposit/recharge/apply", post(apply))
        .route("/deposit/recharge/vendorApply", post(vendor_apply))
        .route(
            "/deposit/recharge/shopPaymentAuditList",
            get(shop_payment_audit_list),
        )
        .route(
            "/deposit/recharge/vendorPaymentAuditList",
            get(vendor_payment_audit_list),
        )
        .route(
            "/deposit/recharge/shopPaymentAuditDetail",
            get(shop_payment_audit_detail),
        )
        .route(
            "/deposit/recharge/vendorPaymentAuditDetail",
            get(vendor_payment_audit_detail),
        )
        .route("/deposit/recharge/list", get(list))
        .route("/deposit/recharge/detail", get(detail))
        .route("/deposit/recharge/audit", post(audit))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 店铺/供应商 ID（替代 Java `HeaderUtils`）
// ——————————————————————————————————————————————

/// 店铺端接口：只有店铺账号（JWT `shop_id`）可调用；否则 403。
fn require_shop(tenant: &TenantContext) -> Result<i32, AppError> {
    tenant
        .shop_scope()
        .ok_or_else(|| tigshop_core::Error::Forbidden("仅店铺账号可访问该接口".into()).into())
}

/// 供应商端接口：只有供应商账号（JWT `vendor_id`）可调用；否则 403。
fn require_vendor(tenant: &TenantContext) -> Result<i32, AppError> {
    tenant
        .vendor_scope()
        .ok_or_else(|| tigshop_core::Error::Forbidden("仅供应商账号可访问该接口".into()).into())
}

/// 平台端接口：店铺/供应商账号一律 403。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(())
}

// ——————————————————————————————————————————————
// handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/deposit/recharge/payeeAccountOptions`：启用收款账户列表。
async fn payee_account_options(
    State(state): State<AdminState>,
    Query(q): Query<PayeeAccountOptionsQuery>,
) -> ApiResult<Vec<DepositPayeeAccountVO>> {
    ok(state
        .merchant
        .deposit_recharge
        .payee_account_options(q.account_type, q.keyword.as_deref())
        .await?)
}

/// `POST /adminapi/deposit/recharge/apply`：店铺端发起充值申请。
async fn apply(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRechargeApplyDTO>,
) -> ApiResult<i32> {
    let shop_id = require_shop(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .apply(Some(shop_id), &dto)
        .await?)
}

/// `POST /adminapi/deposit/recharge/vendorApply`：供应商端发起充值申请。
async fn vendor_apply(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRechargeApplyDTO>,
) -> ApiResult<i32> {
    let vendor_id = require_vendor(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .vendor_apply(Some(vendor_id), &dto)
        .await?)
}

/// `GET /adminapi/deposit/recharge/shopPaymentAuditList`：店铺端款项审核列表。
async fn shop_payment_audit_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositPaymentAuditListQuery>,
) -> ApiResult<PageResult<DepositPaymentAuditVO>> {
    let shop_id = require_shop(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .shop_payment_audit_list(Some(shop_id), &q)
        .await?)
}

/// `GET /adminapi/deposit/recharge/vendorPaymentAuditList`：供应商端款项审核列表。
async fn vendor_payment_audit_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositPaymentAuditListQuery>,
) -> ApiResult<PageResult<DepositPaymentAuditVO>> {
    let vendor_id = require_vendor(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .vendor_payment_audit_list(Some(vendor_id), &q)
        .await?)
}

/// `GET /adminapi/deposit/recharge/shopPaymentAuditDetail`：店铺端款项审核详情。
async fn shop_payment_audit_detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PaymentAuditDetailQuery>,
) -> ApiResult<DepositPaymentAuditVO> {
    let shop_id = require_shop(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .shop_payment_audit_detail(Some(shop_id), q.audit_type, q.biz_id)
        .await?)
}

/// `GET /adminapi/deposit/recharge/vendorPaymentAuditDetail`：供应商端款项审核详情。
async fn vendor_payment_audit_detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PaymentAuditDetailQuery>,
) -> ApiResult<DepositPaymentAuditVO> {
    let vendor_id = require_vendor(&tenant)?;
    ok(state
        .merchant
        .deposit_recharge
        .vendor_payment_audit_detail(Some(vendor_id), q.audit_type, q.biz_id)
        .await?)
}

/// `GET /adminapi/deposit/recharge/list`：平台端充值单列表。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositRechargeListQuery>,
) -> ApiResult<PageResult<DepositRechargeVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_recharge.list(&q).await?)
}

/// `GET /adminapi/deposit/recharge/detail`：平台端充值单详情。
async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<RechargeIdQuery>,
) -> ApiResult<Option<DepositRechargeVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_recharge.detail(q.id).await?)
}

/// `POST /adminapi/deposit/recharge/audit`：平台端审核充值单。
async fn audit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRechargeAuditDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state
        .merchant
        .deposit_recharge
        .audit(Some(auth.id), &dto)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::merchant::deposit_recharge::{
        DepositPaymentAuditListQuery, DepositRechargeListQuery, PayeeAccountOptionsQuery,
    };

    fn shop() -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(9), None)
    }

    fn vendor() -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(3))
    }

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/deposit/recharge/payeeAccountOptions"),
            ("POST", "/adminapi/deposit/recharge/apply"),
            ("POST", "/adminapi/deposit/recharge/vendorApply"),
            ("GET", "/adminapi/deposit/recharge/shopPaymentAuditList"),
            ("GET", "/adminapi/deposit/recharge/vendorPaymentAuditList"),
            ("GET", "/adminapi/deposit/recharge/shopPaymentAuditDetail"),
            ("GET", "/adminapi/deposit/recharge/vendorPaymentAuditDetail"),
            ("GET", "/adminapi/deposit/recharge/list"),
            ("GET", "/adminapi/deposit/recharge/detail"),
            ("POST", "/adminapi/deposit/recharge/audit"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len());
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
    }

    /// 店铺/供应商/平台接口各自的租户边界。
    #[test]
    fn tenant_boundaries_are_enforced() {
        assert_eq!(require_shop(&shop()).unwrap(), 9);
        assert!(require_shop(&vendor()).is_err());
        assert!(require_shop(&platform()).is_err());
        assert_eq!(require_vendor(&vendor()).unwrap(), 3);
        assert!(require_vendor(&shop()).is_err());
        assert!(require_platform(&platform()).is_ok());
        assert!(require_platform(&shop()).is_err());
        assert!(require_platform(&vendor()).is_err());
    }

    #[test]
    fn queries_accept_java_names() {
        let q: DepositRechargeListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.page, None);
        let q: DepositPaymentAuditListQuery =
            serde_json::from_str(r#"{"auditType":1,"status":0}"#).unwrap();
        let _ = q;
        let q: PayeeAccountOptionsQuery = serde_json::from_str(r#"{"accountType":1}"#).unwrap();
        assert_eq!(q.account_type, Some(1));
    }
}
