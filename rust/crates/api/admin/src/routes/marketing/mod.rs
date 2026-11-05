//! 管理端 marketing 路由。

pub mod buyer_show;
pub mod buyer_show_comment;
pub mod buyer_show_group;
pub mod coupon;
pub mod coupon_manage;
pub mod gift_card;
pub mod gift_card_groups;
pub mod groupon_promotion;
pub mod groupon_promotion_item;
pub mod groupon_promotion_record;
pub mod lottery_activity;
pub mod overview;
pub mod points_exchange;
pub mod product_gift;
pub mod product_promotion;
pub mod product_style_admin;
pub mod promotion;
pub mod recharge_setting;
pub mod salesman;
pub mod salesman_admin;
pub mod salesman_config;
pub mod salesman_content;
pub mod salesman_customer_transaction;
pub mod salesman_group;
pub mod salesman_material;
pub mod salesman_material_category;
pub mod salesman_order;
pub mod salesman_product;
pub mod seckill;
pub mod seckill_batch;
pub mod sign_in_setting;
pub mod tenant_layer;
pub mod time_discount;
pub mod time_discount_batch;

use axum::Router;

use super::super::AdminState;

/// 需登录的域路由（外层统一套 require_auth）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .merge(buyer_show::routes(state))
        .merge(buyer_show_comment::routes(state))
        .merge(buyer_show_group::routes(state))
        .merge(coupon::routes(state))
        .merge(coupon_manage::routes(state))
        .merge(gift_card::routes(state))
        .merge(gift_card_groups::routes(state))
        .merge(groupon_promotion::routes(state))
        .merge(groupon_promotion_item::routes(state))
        .merge(groupon_promotion_record::routes(state))
        .merge(lottery_activity::routes(state))
        .merge(overview::routes(state))
        .merge(points_exchange::routes(state))
        .merge(product_gift::routes(state))
        .merge(product_promotion::routes(state))
        .merge(product_style_admin::routes(state))
        .merge(promotion::routes(state))
        .merge(recharge_setting::routes(state))
        .merge(salesman::routes(state))
        .merge(salesman_admin::routes(state))
        .merge(salesman_config::routes(state))
        .merge(salesman_content::routes(state))
        .merge(salesman_customer_transaction::routes(state))
        .merge(salesman_group::routes(state))
        .merge(salesman_material::routes(state))
        .merge(salesman_material_category::routes(state))
        .merge(salesman_order::routes(state))
        .merge(salesman_product::routes(state))
        .merge(seckill::routes(state))
        .merge(seckill_batch::routes(state))
        .merge(sign_in_setting::routes(state))
        .merge(time_discount::routes(state))
        .merge(time_discount_batch::routes(state))
        .layer(axum::middleware::from_fn(tenant_layer::tenant_scope_layer))
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
    out.extend(buyer_show::implemented_routes());
    out.extend(buyer_show_comment::implemented_routes());
    out.extend(buyer_show_group::implemented_routes());
    out.extend(coupon::implemented_routes());
    out.extend(coupon_manage::implemented_routes());
    out.extend(gift_card::implemented_routes());
    out.extend(gift_card_groups::implemented_routes());
    out.extend(groupon_promotion::implemented_routes());
    out.extend(groupon_promotion_item::implemented_routes());
    out.extend(groupon_promotion_record::implemented_routes());
    out.extend(lottery_activity::implemented_routes());
    out.extend(overview::implemented_routes());
    out.extend(points_exchange::implemented_routes());
    out.extend(product_gift::implemented_routes());
    out.extend(product_promotion::implemented_routes());
    out.extend(product_style_admin::implemented_routes());
    out.extend(promotion::implemented_routes());
    out.extend(recharge_setting::implemented_routes());
    out.extend(salesman::implemented_routes());
    out.extend(salesman_admin::implemented_routes());
    out.extend(salesman_config::implemented_routes());
    out.extend(salesman_content::implemented_routes());
    out.extend(salesman_customer_transaction::implemented_routes());
    out.extend(salesman_group::implemented_routes());
    out.extend(salesman_material::implemented_routes());
    out.extend(salesman_material_category::implemented_routes());
    out.extend(salesman_order::implemented_routes());
    out.extend(salesman_product::implemented_routes());
    out.extend(seckill::implemented_routes());
    out.extend(seckill_batch::implemented_routes());
    out.extend(sign_in_setting::implemented_routes());
    out.extend(time_discount::implemented_routes());
    out.extend(time_discount_batch::implemented_routes());
    out
}
