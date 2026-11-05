//! 管理端保证金账户路由（merchant::deposit_account）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.deposit.DepositAccountController`
//! （`@RequestMapping("/adminapi/deposit/account")`，8 个端点，全部需登录）。
//! `runDueCheck` 在 Java 为 `permitAll()`，本模块仍挂在需登录路由（Rust 侧匿名口径未单列，
//! 见报告「deviations」）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::deposit_account::{
    DepositAccountDetailVO, DepositAccountListQuery, DepositAccountVO, DepositAdjustDTO,
    DepositAdjustLogVO, DepositDeductDTO, DepositLogVO, DepositSendWarningDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域 8 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/deposit/account/list",
        "DepositAccountController.list",
    ),
    (
        "GET",
        "/deposit/account/detail",
        "DepositAccountController.detail",
    ),
    (
        "GET",
        "/deposit/account/logList",
        "DepositAccountController.logList",
    ),
    (
        "GET",
        "/deposit/account/adjustLogList",
        "DepositAccountController.adjustLogList",
    ),
    (
        "POST",
        "/deposit/account/adjust",
        "DepositAccountController.adjust",
    ),
    (
        "POST",
        "/deposit/account/deduct",
        "DepositAccountController.deduct",
    ),
    (
        "POST",
        "/deposit/account/sendWarning",
        "DepositAccountController.sendWarning",
    ),
    (
        "GET",
        "/deposit/account/runDueCheck",
        "DepositAccountController.runDueCheck",
    ),
];

/// 保证金账户域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/account/list", get(list))
        .route("/deposit/account/detail", get(detail))
        .route("/deposit/account/logList", get(log_list))
        .route("/deposit/account/adjustLogList", get(adjust_log_list))
        .route("/deposit/account/adjust", post(adjust))
        .route("/deposit/account/deduct", post(deduct))
        .route("/deposit/account/sendWarning", post(send_warning))
        .route("/deposit/account/runDueCheck", get(run_due_check))
}

/// 本域已实现路由（完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// owner 兼容解析：`ownerId` 优先，回退 `shopId`（Java `resolveOwnerId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct OwnerQuery {
    owner_type: Option<i32>,
    owner_id: Option<i32>,
    shop_id: Option<i32>,
    page: Option<u64>,
    size: Option<u64>,
}

impl OwnerQuery {
    fn owner_id(&self) -> Option<i32> {
        self.owner_id.or(self.shop_id)
    }
}

/// 保证金账户/流水/规则/设置/收款账户均为**平台级**数据：
/// 店铺/门店/POS/供应商账号一律 403（不信任任何请求头/查询参数里的店铺标识）。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问保证金管理".into()).into());
    }
    Ok(())
}

async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositAccountListQuery>,
) -> ApiResult<PageResult<DepositAccountVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_account.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<OwnerQuery>,
) -> ApiResult<DepositAccountDetailVO> {
    require_platform(&tenant)?;
    ok(state
        .merchant
        .deposit_account
        .detail(q.owner_type, q.owner_id())
        .await?)
}

async fn log_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<OwnerQuery>,
) -> ApiResult<PageResult<DepositLogVO>> {
    require_platform(&tenant)?;
    ok(state
        .merchant
        .deposit_account
        .log_list(q.owner_type, q.owner_id(), q.page, q.size)
        .await?)
}

async fn adjust_log_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<OwnerQuery>,
) -> ApiResult<PageResult<DepositAdjustLogVO>> {
    require_platform(&tenant)?;
    ok(state
        .merchant
        .deposit_account
        .adjust_log_list(q.owner_type, q.owner_id(), q.page, q.size)
        .await?)
}

async fn adjust(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositAdjustDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_account.adjust(&dto, auth.id).await?;
    ok(())
}

async fn deduct(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositDeductDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_account.deduct(&dto, auth.id).await?;
    ok(())
}

async fn send_warning(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositSendWarningDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_account.send_warning(&dto).await?;
    ok(())
}

async fn run_due_check(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_account.run_due_check().await?;
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
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/deposit/account/list"),
            ("GET", "/adminapi/deposit/account/detail"),
            ("GET", "/adminapi/deposit/account/logList"),
            ("GET", "/adminapi/deposit/account/adjustLogList"),
            ("POST", "/adminapi/deposit/account/adjust"),
            ("POST", "/adminapi/deposit/account/deduct"),
            ("POST", "/adminapi/deposit/account/sendWarning"),
            ("GET", "/adminapi/deposit/account/runDueCheck"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
    }
}
