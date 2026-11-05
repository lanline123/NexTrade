//! 保证金收款账户 —— 管理端路由（merchant::deposit_payee_account）—— wave9。
//!
//! 原 Java `DepositPayeeAccountController`（`@RequestMapping("/adminapi/deposit/payeeAccount")`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::merchant::deposit_payee_account::{
    DepositPayeeAccountDTO, DepositPayeeAccountDeleteDTO, DepositPayeeAccountListQuery,
    DepositPayeeAccountVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "GET",
        "/deposit/payeeAccount/list",
        "DepositPayeeAccountController.list",
    ),
    (
        "POST",
        "/deposit/payeeAccount/create",
        "DepositPayeeAccountController.create",
    ),
    (
        "POST",
        "/deposit/payeeAccount/update",
        "DepositPayeeAccountController.update",
    ),
    (
        "POST",
        "/deposit/payeeAccount/del",
        "DepositPayeeAccountController.del",
    ),
];

/// 收款账户路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/payeeAccount/list", get(list))
        .route("/deposit/payeeAccount/create", post(create))
        .route("/deposit/payeeAccount/update", post(update))
        .route("/deposit/payeeAccount/del", post(del))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// 保证金账户/流水/规则/设置/收款账户均为**平台级**数据：
/// 店铺/门店/POS/供应商账号一律 403（不信任任何请求头/查询参数里的店铺标识）。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问保证金管理".into()).into());
    }
    Ok(())
}

/// `GET /adminapi/deposit/payeeAccount/list`
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositPayeeAccountListQuery>,
) -> ApiResult<PageResult<DepositPayeeAccountVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_payee_account.list(&q).await?)
}

/// `POST /adminapi/deposit/payeeAccount/create`
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositPayeeAccountDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_payee_account.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/deposit/payeeAccount/update`
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositPayeeAccountDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_payee_account.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/deposit/payeeAccount/del`
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositPayeeAccountDeleteDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_payee_account.delete(dto.id).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tenant_platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn tenant_shop(shop_id: i32) -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(shop_id), None)
    }

    fn tenant_vendor(vendor_id: i32) -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(vendor_id))
    }

    /// 平台账号放行；店铺/供应商账号被 403 拒绝。
    #[test]
    fn platform_only_guard() {
        assert!(require_platform(&tenant_platform()).is_ok());
        for t in [tenant_shop(9), tenant_vendor(3)] {
            let err = require_platform(&t).expect_err("非平台账号应被拒绝");
            assert_eq!(err.0.business_code(), 403);
        }
    }

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 4);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/adminapi/deposit/payeeAccount/list");
        assert_eq!(docs[3].path, "/adminapi/deposit/payeeAccount/del");
    }

    #[test]
    fn methods_match_java_controller() {
        assert_eq!(
            ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count(),
            1
        );
        assert_eq!(
            ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "POST").count(),
            3
        );
    }
}
