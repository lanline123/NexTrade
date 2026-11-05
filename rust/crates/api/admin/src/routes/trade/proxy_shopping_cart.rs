//! 管理端代客下单购物车路由（trade::proxy_shopping_cart）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingCartController`
//! （`@RequestMapping("/adminapi/proxyShopping/cart")`，7 个端点，类级
//! `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `POST /proxyShopping/cart/list` | `list` |
//! | `POST /proxyShopping/cart/addToCart` | `addProductToCart` |
//! | `POST /proxyShopping/cart/clearCart` | `clearCart` |
//! | `POST /proxyShopping/cart/removeItem` | `removeItem` |
//! | `POST /proxyShopping/cart/updateItem` | `updateItem` |
//! | `POST /proxyShopping/cart/updateCheck` | `updateCheck` |
//! | `GET  /proxyShopping/cart/getCount` | `getCount` |
//!
//! # 多租户（重要）
//! Java 用请求头 `x-admin-type` / `x-shop-id`（`HeaderUtils.getShopId()`）判断当前组织。
//! Rust 侧**不再信任请求头/查询参数**：认证中间件已把 JWT 声明写入 [`AuthUser`]，
//! 本模块统一通过 [`AuthUser::resolve_shop_scope`] / [`AuthUser::scoped_shop_id`] 解析：
//!
//! - 店铺/门店/POS 账号：读/写都强制自己的 `shop_id`，请求里出现其它店铺 → 403；
//! - 平台账号：读操作可用可选 `shopId` 过滤（不传 = 全部店铺），写操作以 DTO 中的
//!   `shopId` 为店铺归属，服务层仍需校验商品属于目标店铺。
//!
//! 代客下单购物车的 `cart.shop_id` 来自商品所属店铺，因此“店铺账号跨店加购”会在服务层
//! 以 403 拒绝；批量删除/更新/清空按当前店铺过滤，避免越权操作其它店铺的购物车行。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::trade::proxy_shopping_cart::{
    CartListByStoreVO, ExchangeProductToCartVO, ProxyAddToCartDTO, ProxyCartCountQuery,
    ProxyCartListDTO, ProxyClearCartDTO, ProxyRemoveItemDTO, ProxyUpdateCheckDTO,
    ProxyUpdateItemDTO,
};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "POST",
        "/proxyShopping/cart/list",
        "ProxyShoppingCartController.list",
    ),
    (
        "POST",
        "/proxyShopping/cart/addToCart",
        "ProxyShoppingCartController.addProductToCart",
    ),
    (
        "POST",
        "/proxyShopping/cart/clearCart",
        "ProxyShoppingCartController.clearCart",
    ),
    (
        "POST",
        "/proxyShopping/cart/removeItem",
        "ProxyShoppingCartController.removeItem",
    ),
    (
        "POST",
        "/proxyShopping/cart/updateItem",
        "ProxyShoppingCartController.updateItem",
    ),
    (
        "POST",
        "/proxyShopping/cart/updateCheck",
        "ProxyShoppingCartController.updateCheck",
    ),
    (
        "GET",
        "/proxyShopping/cart/getCount",
        "ProxyShoppingCartController.getCount",
    ),
];

/// 代客下单购物车路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/proxyShopping/cart/list", post(list))
        .route("/proxyShopping/cart/addToCart", post(add_to_cart))
        .route("/proxyShopping/cart/clearCart", post(clear_cart))
        .route("/proxyShopping/cart/removeItem", post(remove_item))
        .route("/proxyShopping/cart/updateItem", post(update_item))
        .route("/proxyShopping/cart/updateCheck", post(update_check))
        .route("/proxyShopping/cart/getCount", get(get_count))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `POST /adminapi/proxyShopping/cart/list`：购物车列表。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyCartListDTO>,
) -> ApiResult<CartListByStoreVO> {
    // 店铺账号强制自身店铺；平台账号可用 dto.shopId 过滤（None = 全部）。
    let scope = auth.resolve_shop_scope(dto.shop_id)?;
    ok(state.trade.proxy_shopping_cart.list(&dto, scope).await?)
}

/// `POST /adminapi/proxyShopping/cart/addToCart`：加入购物车。
async fn add_to_cart(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyAddToCartDTO>,
) -> ApiResult<ExchangeProductToCartVO> {
    // 购物车行的 shop_id 来自商品所属店铺：店铺账号强制自身店铺（跨店商品服务层 403），
    // 平台账号由商品决定归属。
    let scope = auth.scoped_shop_id();
    ok(state
        .trade
        .proxy_shopping_cart
        .add_to_cart(&dto, scope)
        .await?)
}

/// `POST /adminapi/proxyShopping/cart/clearCart`：清空购物车。
async fn clear_cart(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyClearCartDTO>,
) -> ApiResult<()> {
    let scope = auth.scoped_shop_id();
    state
        .trade
        .proxy_shopping_cart
        .clear_cart(&dto, scope)
        .await?;
    ok(())
}

/// `POST /adminapi/proxyShopping/cart/removeItem`：删除购物车商品。
async fn remove_item(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyRemoveItemDTO>,
) -> ApiResult<()> {
    let scope = auth.scoped_shop_id();
    state
        .trade
        .proxy_shopping_cart
        .remove_item(&dto, scope)
        .await?;
    ok(())
}

/// `POST /adminapi/proxyShopping/cart/updateItem`：更新购物车数量。
async fn update_item(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyUpdateItemDTO>,
) -> ApiResult<()> {
    let scope = auth.scoped_shop_id();
    state
        .trade
        .proxy_shopping_cart
        .update_item(&dto, scope)
        .await?;
    ok(())
}

/// `POST /adminapi/proxyShopping/cart/updateCheck`：更新选中状态。
async fn update_check(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProxyUpdateCheckDTO>,
) -> ApiResult<()> {
    let scope = auth.scoped_shop_id();
    state
        .trade
        .proxy_shopping_cart
        .update_check(&dto, scope)
        .await?;
    ok(())
}

/// `GET /adminapi/proxyShopping/cart/getCount`：购物车商品数量。
async fn get_count(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ProxyCartCountQuery>,
) -> ApiResult<i32> {
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.trade.proxy_shopping_cart.get_count(&q, scope).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_openapi::RouteDoc;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(
            1,
            "shop-user".into(),
            None,
            Some("shop".into()),
            Some(shop_id),
        )
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（7 条）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let expected = [
            ("POST", "/adminapi/proxyShopping/cart/list"),
            ("POST", "/adminapi/proxyShopping/cart/addToCart"),
            ("POST", "/adminapi/proxyShopping/cart/clearCart"),
            ("POST", "/adminapi/proxyShopping/cart/removeItem"),
            ("POST", "/adminapi/proxyShopping/cart/updateItem"),
            ("POST", "/adminapi/proxyShopping/cart/updateCheck"),
            ("GET", "/adminapi/proxyShopping/cart/getCount"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域共 7 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        let mut unique: Vec<String> = docs.iter().map(RouteDoc::key).collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// 店铺账号的读写范围被强制收敛到自身店铺。
    #[test]
    fn shop_account_scope_is_forced() {
        let auth = shop_account(9);
        assert_eq!(auth.scoped_shop_id(), Some(9));
        // 未传 shopId → 仍强制自身店铺
        assert_eq!(auth.resolve_shop_scope(None).unwrap(), Some(9));
        // 传自己的店铺 → 允许
        assert_eq!(auth.resolve_shop_scope(Some(9)).unwrap(), Some(9));
        // 越权店铺 → 403（Forbidden）
        let err = auth.resolve_shop_scope(Some(8)).unwrap_err();
        assert!(err.to_string().contains("无权访问店铺 8"));
        // 平台账号才能指定其它店铺
        let admin = platform();
        assert_eq!(admin.scoped_shop_id(), None);
        assert_eq!(admin.resolve_shop_scope(Some(8)).unwrap(), Some(8));
        assert_eq!(admin.resolve_shop_scope(None).unwrap(), None);
    }

    /// 平台账号的列表默认可见全部店铺（不附加 shop_id 过滤）。
    #[test]
    fn platform_list_scope_is_unfiltered() {
        let admin = platform();
        let scope = admin.resolve_shop_scope(None).unwrap();
        assert!(scope.is_none(), "平台账号未指定 shopId 时不得强制过滤");
    }

    /// 写操作（清空/删除/更新/勾选）使用 `scoped_shop_id()`，店铺账号不可绕过。
    #[test]
    fn write_scope_uses_scoped_shop_id() {
        assert_eq!(shop_account(9).scoped_shop_id(), Some(9));
        assert_eq!(platform().scoped_shop_id(), None);
    }
}
