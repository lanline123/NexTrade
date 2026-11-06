//! 管理端代客下单配送方式路由（trade::proxy_shopping_delivery）。
//!
//! 对应 Java `ProxyShoppingDeliveryController`（`/adminapi/proxyShopping/delivery`）：
//! `GET /adminapi/proxyShopping/delivery/getDeliveryOptions`、
//! `GET /adminapi/proxyShopping/delivery/getStoreShippingType`。
//!
//! 两个接口均先校验用户，再返回明确「未迁移」业务错误（配送/运费引擎未迁移）。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::trade::proxy_shopping_delivery::{
    DeliveryOptionVO, DeliveryOptionsQuery, ProxyStoreShippingTypeQuery, ShippingTypeVO,
};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域 2 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/proxyShopping/delivery/getDeliveryOptions",
        "ProxyShoppingDeliveryController.getDeliveryOptions",
    ),
    (
        "GET",
        "/proxyShopping/delivery/getStoreShippingType",
        "ProxyShoppingDeliveryController.getStoreShippingType",
    ),
];

/// 代客下单配送方式路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/proxyShopping/delivery/getDeliveryOptions",
            get(get_delivery_options),
        )
        .route(
            "/proxyShopping/delivery/getStoreShippingType",
            get(get_store_shipping_type),
        )
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// 当前账号的店铺范围（**仅来自认证身份**，不信任请求头/查询参数）。
///
/// - 店铺/门店/POS 账号 → `Some(自身店铺)`；
/// - 平台账号 → `None`（不按店铺过滤）。
#[must_use]
fn shop_scope(auth: &AuthUser) -> Option<i32> {
    auth.scoped_shop_id()
}

/// `GET /adminapi/proxyShopping/delivery/getDeliveryOptions`：配送选项（未迁移）。
async fn get_delivery_options(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<DeliveryOptionsQuery>,
) -> ApiResult<DeliveryOptionVO> {
    let shop_id = shop_scope(&auth);
    ok(state
        .trade
        .proxy_shopping_delivery
        .get_delivery_options(&q, shop_id)
        .await?)
}

/// `GET /adminapi/proxyShopping/delivery/getStoreShippingType`：店铺配送方式（未迁移）。
async fn get_store_shipping_type(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ProxyStoreShippingTypeQuery>,
) -> ApiResult<Vec<(i32, Vec<ShippingTypeVO>)>> {
    let shop_id = shop_scope(&auth);
    ok(state
        .trade
        .proxy_shopping_delivery
        .get_store_shipping_type(&q, shop_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(
            docs[0].path,
            "/adminapi/proxyShopping/delivery/getDeliveryOptions"
        );
        assert_eq!(
            docs[1].path,
            "/adminapi/proxyShopping/delivery/getStoreShippingType"
        );
    }

    #[test]
    fn routes_registers_all_table_paths() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/proxyShopping/delivery/"));
        }
    }

    #[test]
    fn shop_scope_is_derived_from_auth_only() {
        // 店铺账号 → 强制自身店铺
        assert_eq!(shop_scope(&shop_account(9)), Some(9));
        // 平台账号 → 不过滤
        assert_eq!(shop_scope(&platform()), None);
        // 缺 shop_id 的非平台账号 → None（不会退化为“全平台可见”以外的越权）
        let broken = AuthUser::new(3, "shop2".into(), None, Some("shop".into()), None);
        assert_eq!(shop_scope(&broken), None);
    }
}
