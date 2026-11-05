//! 管理端 member 路由。

pub mod feedback;
pub mod member_audience;
pub mod member_lists;
pub mod member_tag;
pub mod member_tag_group;
pub mod shop_member;
pub mod user_company;
pub mod user_manage;
pub mod user_member_tag;
pub mod user_message_log;
pub mod user_points_log;
pub mod user_rank;

use axum::Router;

use super::super::AdminState;

/// 需登录的域路由（外层统一套 require_auth）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .merge(feedback::routes(state))
        .merge(member_audience::routes(state))
        .merge(member_lists::routes(state))
        .merge(member_tag::routes(state))
        .merge(member_tag_group::routes(state))
        .merge(shop_member::routes(state))
        .merge(user_company::routes(state))
        .merge(user_manage::routes(state))
        .merge(user_member_tag::routes(state))
        .merge(user_message_log::routes(state))
        .merge(user_points_log::routes(state))
        .merge(user_rank::routes(state))
}

/// 免登录的域路由（对应 Java `URL_WHITELIST`，外层不套 require_auth）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().merge(shop_member::public_routes(state))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out = Vec::new();
    out.extend(feedback::implemented_routes());
    out.extend(member_audience::implemented_routes());
    out.extend(member_lists::implemented_routes());
    out.extend(member_tag::implemented_routes());
    out.extend(member_tag_group::implemented_routes());
    out.extend(shop_member::implemented_routes());
    out.extend(user_company::implemented_routes());
    out.extend(user_manage::implemented_routes());
    out.extend(user_member_tag::implemented_routes());
    out.extend(user_message_log::implemented_routes());
    out.extend(user_points_log::implemented_routes());
    out.extend(user_rank::implemented_routes());
    out
}
