//! 管理端 content 路由。

pub mod article;
pub mod article_batch;
pub mod article_category;
pub mod decorate;
pub mod decorate_promote;
pub mod decorate_template;
pub mod friend_links;
pub mod gallery;
pub mod gallery_pic;
pub mod gallery_video;
pub mod gallery_video_info;
pub mod mobile_cat_nav;
pub mod seo;
pub mod wechat_auto_reply;
pub mod wechat_kefu_capability;
pub mod wechat_keyword_rule;
pub mod wechat_live;
pub mod wechat_live_goods;
pub mod wechat_live_order_sync;
pub mod wechat_menu;
pub mod wechat_video_account;

use axum::Router;

use super::super::AdminState;
use crate::routes::marketing::tenant_layer::tenant_scope_layer;

/// 需登录的域路由（外层统一套 require_auth）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .merge(article::routes(state))
        .merge(article_batch::routes(state))
        .merge(article_category::routes(state))
        .merge(decorate::routes(state))
        .merge(decorate_promote::routes(state))
        .merge(decorate_template::routes(state))
        .merge(friend_links::routes(state))
        .merge(gallery::routes(state))
        .merge(gallery_pic::routes(state))
        .merge(gallery_video::routes(state))
        .merge(gallery_video_info::routes(state))
        .merge(mobile_cat_nav::routes(state))
        .merge(seo::routes(state))
        .merge(wechat_auto_reply::routes(state))
        .merge(wechat_kefu_capability::routes(state))
        .merge(wechat_keyword_rule::routes(state))
        .merge(wechat_live::routes(state))
        .merge(wechat_live_goods::routes(state))
        .merge(wechat_live_order_sync::routes(state))
        .merge(wechat_menu::routes(state))
        .merge(wechat_video_account::routes(state))
        .layer(axum::middleware::from_fn(tenant_scope_layer))
}

/// 免登录的域路由（对应 Java `URL_WHITELIST`，外层不套 require_auth）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().merge(wechat_auto_reply::public_routes(state))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out = Vec::new();
    out.extend(article::implemented_routes());
    out.extend(article_batch::implemented_routes());
    out.extend(article_category::implemented_routes());
    out.extend(decorate::implemented_routes());
    out.extend(decorate_promote::implemented_routes());
    out.extend(decorate_template::implemented_routes());
    out.extend(friend_links::implemented_routes());
    out.extend(gallery::implemented_routes());
    out.extend(gallery_pic::implemented_routes());
    out.extend(gallery_video::implemented_routes());
    out.extend(gallery_video_info::implemented_routes());
    out.extend(mobile_cat_nav::implemented_routes());
    out.extend(seo::implemented_routes());
    out.extend(wechat_auto_reply::implemented_routes());
    out.extend(wechat_kefu_capability::implemented_routes());
    out.extend(wechat_keyword_rule::implemented_routes());
    out.extend(wechat_live::implemented_routes());
    out.extend(wechat_live_goods::implemented_routes());
    out.extend(wechat_live_order_sync::implemented_routes());
    out.extend(wechat_menu::implemented_routes());
    out.extend(wechat_video_account::implemented_routes());
    out
}
