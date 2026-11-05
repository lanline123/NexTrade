//! 管理端保证金退还路由（merchant::deposit_refund）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.deposit.DepositRefundController`
//! （`@RequestMapping("/adminapi/deposit/refund")`，7 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `POST /deposit/refund/apply` | `apply` | 登录 |
//! | `POST /deposit/refund/vendorApply` | `vendorApply` | 登录 |
//! | `GET  /deposit/refund/fullRefundCheck` | `fullRefundCheck` | 登录 |
//! | `GET  /deposit/refund/vendorFullRefundCheck` | `vendorFullRefundCheck` | 登录 |
//! | `GET  /deposit/refund/list` | `list` | `depositPaymentAuditManage` |
//! | `GET  /deposit/refund/detail` | `detail` | `depositPaymentAuditManage` |
//! | `POST /deposit/refund/audit` | `audit` | `depositRefundAudit` |
//!
//! > **权限说明**：Java 方法级 `@PreAuthorize("@pms.hasPermission(...)")`；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现（与其它域已知缺口一致）。
//!
//! > **请求头口径**：`fullRefundCheck` / `vendorFullRefundCheck` 无查询参数，
//! > owner 完全取自请求头（Java `HeaderUtils.getShopId/getVendorId`），
//! > 本模块用 [`shop_id_from_headers`] / [`vendor_id_from_headers`] 逐分支复刻。

use axum::{
    extract::Query,
    extract::State,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::merchant::deposit_refund::{
    DepositFullRefundCheckVO, DepositRefundApplyDTO, DepositRefundAuditDTO, DepositRefundListQuery,
    DepositRefundVO, RefundIdQuery,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `DepositRefundController` 一致；[`implemented_routes`] 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "POST",
        "/deposit/refund/apply",
        "DepositRefundController.apply",
    ),
    (
        "POST",
        "/deposit/refund/vendorApply",
        "DepositRefundController.vendorApply",
    ),
    (
        "GET",
        "/deposit/refund/fullRefundCheck",
        "DepositRefundController.fullRefundCheck",
    ),
    (
        "GET",
        "/deposit/refund/vendorFullRefundCheck",
        "DepositRefundController.vendorFullRefundCheck",
    ),
    (
        "GET",
        "/deposit/refund/list",
        "DepositRefundController.list",
    ),
    (
        "GET",
        "/deposit/refund/detail",
        "DepositRefundController.detail",
    ),
    (
        "POST",
        "/deposit/refund/audit",
        "DepositRefundController.audit",
    ),
];

/// 保证金退还域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/refund/apply", post(apply))
        .route("/deposit/refund/vendorApply", post(vendor_apply))
        .route("/deposit/refund/fullRefundCheck", get(full_refund_check))
        .route(
            "/deposit/refund/vendorFullRefundCheck",
            get(vendor_full_refund_check),
        )
        .route("/deposit/refund/list", get(list))
        .route("/deposit/refund/detail", get(detail))
        .route("/deposit/refund/audit", post(audit))
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

/// `POST /adminapi/deposit/refund/apply`：店铺端发起退还/提现申请。
async fn apply(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRefundApplyDTO>,
) -> ApiResult<i32> {
    let shop_id = require_shop(&tenant)?;
    ok(state
        .merchant
        .deposit_refund
        .apply(Some(shop_id), &dto)
        .await?)
}

/// `POST /adminapi/deposit/refund/vendorApply`：供应商端发起退还/提现申请。
async fn vendor_apply(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRefundApplyDTO>,
) -> ApiResult<i32> {
    let vendor_id = require_vendor(&tenant)?;
    ok(state
        .merchant
        .deposit_refund
        .vendor_apply(Some(vendor_id), &dto)
        .await?)
}

/// `GET /adminapi/deposit/refund/fullRefundCheck`：店铺端全额退还预检。
async fn full_refund_check(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DepositFullRefundCheckVO> {
    let shop_id = require_shop(&tenant)?;
    ok(state
        .merchant
        .deposit_refund
        .full_refund_check(Some(shop_id))
        .await?)
}

/// `GET /adminapi/deposit/refund/vendorFullRefundCheck`：供应商端全额退还预检。
async fn vendor_full_refund_check(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DepositFullRefundCheckVO> {
    let vendor_id = require_vendor(&tenant)?;
    ok(state
        .merchant
        .deposit_refund
        .vendor_full_refund_check(Some(vendor_id))
        .await?)
}

/// `GET /adminapi/deposit/refund/list`：平台端退还单列表。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositRefundListQuery>,
) -> ApiResult<PageResult<DepositRefundVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_refund.list(&q).await?)
}

/// `GET /adminapi/deposit/refund/detail`：平台端退还单详情。
async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<RefundIdQuery>,
) -> ApiResult<Option<DepositRefundVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_refund.detail(q.id).await?)
}

/// `POST /adminapi/deposit/refund/audit`：平台端一步式审核退还单。
async fn audit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRefundAuditDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state
        .merchant
        .deposit_refund
        .audit(Some(auth.id), &dto)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::merchant::deposit_refund::{DepositRefundListQuery, RefundIdQuery};

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
            ("POST", "/adminapi/deposit/refund/apply"),
            ("POST", "/adminapi/deposit/refund/vendorApply"),
            ("GET", "/adminapi/deposit/refund/fullRefundCheck"),
            ("GET", "/adminapi/deposit/refund/vendorFullRefundCheck"),
            ("GET", "/adminapi/deposit/refund/list"),
            ("GET", "/adminapi/deposit/refund/detail"),
            ("POST", "/adminapi/deposit/refund/audit"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len());
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
    }

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
        let _: DepositRefundListQuery = serde_json::from_str("{}").unwrap();
        let q: RefundIdQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(q.id, Some(5));
    }
}
