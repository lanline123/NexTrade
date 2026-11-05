//! 商城端 catalog 路由。

pub mod category;
pub mod category_all;
pub mod comment;
pub mod exchange;
pub mod image_search;
pub mod product_manage;
pub mod product_manage_client;
pub mod product_raw_image;
pub mod product_search;
pub mod search_admin;

use axum::Router;

use super::super::PublicState;

/// 自带鉴权中间件的域路由（并入 merge_public，外层不再套 require_auth）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    let _ = state;
    Router::new()
        .merge(category::routes(state))
        .merge(comment::routes(state))
        .merge(exchange::routes(state))
        .merge(image_search::routes(state))
        .merge(product_manage::routes(state))
        .merge(product_manage_client::routes(state))
        .merge(product_search::routes(state))
        .merge(search_admin::routes(state))
}

/// 匿名可访问路由（无状态）。
pub fn public_routes() -> Router<PublicState> {
    Router::new()
        .merge(category_all::public_routes())
}

/// 匿名可访问路由（需要 state，外层不套 require_auth）。
pub fn anonymous_routes(state: &PublicState) -> Router<PublicState> {
    let _ = state;
    Router::new()
}

/// 需登录路由（外层统一套 require_auth）。
pub fn authorized_routes() -> Router<PublicState> {
    Router::new()
        .merge(category_all::authorized_routes())
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out = Vec::new();
    out.extend(category::implemented_routes());
    out.extend(category_all::implemented_routes());
    out.extend(comment::implemented_routes());
    out.extend(exchange::implemented_routes());
    out.extend(image_search::implemented_routes());
    out.extend(product_manage::implemented_routes());
    out.extend(product_manage_client::implemented_routes());
    out.extend(product_search::implemented_routes());
    out.extend(search_admin::implemented_routes());
    out
}
