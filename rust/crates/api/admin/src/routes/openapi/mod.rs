//! 管理端 openapi 路由。

pub mod workbuddy;

use axum::Router;

use super::super::AdminState;

/// 需登录的域路由（外层统一套 require_auth）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().merge(workbuddy::routes(state))
}

/// 免登录的域路由（对应 Java `URL_WHITELIST`，外层不套 require_auth）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out = Vec::new();
    out.extend(workbuddy::implemented_routes());
    out
}
