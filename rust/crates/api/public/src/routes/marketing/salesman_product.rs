//! 商城端分销商品路由（marketing::salesman_product）。
//!
//! 原 Java `com.tigshop.api.controller.salesman.SalesmanProductController`
//! （`@RequestMapping("/api/salesman/product")`，2 端点）：
//! - `GET /api/salesman/product/list`（Java 强制 `status=1` / `salesmanProductType=JOIN` /
//!   当前用户）
//! - `GET /api/salesman/product/detail?productId=`（含当前分销员等级佣金）
//!
//! `optional_auth`（同 `marketing::groupon_promotion`）：游客放行，合法 token 写入
//! [`AuthUser`]；游客 `currentUserId = 0`（Java `SecurityUtils.getCurrentUserId()`）。
use axum::{
    extract::{Extension, Query, Request, State},
    http::{header, Response},
    middleware::{self, Next},
    routing::get,
    Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_product::{
    SalesmanProductDetailVO, SalesmanProductListVO, SalesmanProductPageQuery, TYPE_JOIN,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 2 条 client 路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/salesman/product/list",
        "SalesmanProductController.list",
    ),
    (
        "GET",
        "/salesman/product/detail",
        "SalesmanProductController.detail",
    ),
];

/// 前台分销商品路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/salesman/product/list", get(list))
        .route("/salesman/product/detail", get(detail))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), handler)
        })
        .collect()
}

/// 可选登录态中间件。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response<axum::body::Body>, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    if token.is_some() {
        let Ok(claims) = jwt.from_authorization(token) else { return Ok(next.run(req).await); };
        let Ok(id) = claims.sub.parse::<i32>() else { return Ok(next.run(req).await); };
        req.extensions_mut().insert(AuthUser {
            id,
            username: claims.usr,
            role_id: claims.role,
            admin_type: claims.typ,
            shop_id: claims.shop_id,
        });
    }
    Ok(next.run(req).await)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ProductIdQuery {
    product_id: Option<i32>,
}

fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(user)| user.id).unwrap_or(0)
}

async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<SalesmanProductPageQuery>,
) -> ApiResult<PageResult<SalesmanProductListVO>> {
    // Java：`status=1`、`salesmanProductType=JOIN(3)`、当前用户
    q.status = Some(1);
    q.salesman_product_type = Some(TYPE_JOIN);
    q.user_id = Some(current_user_id(&auth));
    ok(state.marketing.salesman_product.list(&q).await?)
}

async fn detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<Option<SalesmanProductDetailVO>> {
    let product_id = q.product_id.unwrap_or(0);
    ok(state
        .marketing
        .salesman_product
        .detail_client(product_id, current_user_id(&auth))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        let expected = [
            ("GET", "/api/salesman/product/list"),
            ("GET", "/api/salesman/product/detail"),
        ];
        for (method, path) in expected {
            assert!(docs.iter().any(|d| d.method == method && d.path == path), "缺少 {method} {path}");
        }
    }

    #[test]
    fn route_table_paths_stay_relative() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/api/"), "{path}");
            assert!(path.starts_with("/salesman/product/"), "{path}");
        }
    }

    #[test]
    fn query_params_accept_product_id() {
        let q: ProductIdQuery =
            serde_json::from_value(serde_json::json!({"productId": 7})).unwrap();
        assert_eq!(q.product_id, Some(7));
        assert_eq!(current_user_id(&None), 0);
    }
}
