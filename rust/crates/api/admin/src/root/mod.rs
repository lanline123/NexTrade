//! 根级路由（不带模块前缀），按限界上下文分组。

pub mod im;
pub mod system;

use axum::Router;

use super::AdminState;

/// 需登录的根级路由。
pub fn merge_protected(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .merge(system::merge_protected(state))
        .merge(im::merge_protected(state))
}

/// 免登录的根级路由。
pub fn merge_public(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .merge(system::merge_public(state))
        .merge(im::merge_public(state))
}

/// 汇总所有根级已实现路由。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out = Vec::new();
    out.extend(system::implemented_routes());
    out.extend(im::implemented_routes());
    out
}
