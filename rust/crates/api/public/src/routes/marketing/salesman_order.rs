//! 分销业绩订单 —— 商城前台路由（marketing::salesman_order）。
//!
//! 对应原 Java `com.tigshop.api.controller.salesman.SalesmanOrderController`
//! （`@RequestMapping("/api/salesman/order")`，1 个端点）。
//!
//! | method | path（挂载于 `/api`） | 原 Java |
//! |--------|------------------------|---------|
//! | `GET`  | `/salesman/order/list` | `clientList` |
//!
//! # auth=optional 口径
//! Java `clientList` 取 `SecurityUtils.getCurrentUserId()` 对应分销员后覆盖
//! `salesmanId`；游客会 NPE。Rust 做防御：游客 / 非分销员返回空页
//! （服务层 `client_list`），本文件自带 `optional_auth`，
//! `routes()` 由 sync_routes 并入 `merge_public`。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::marketing::salesman_order::{SalesmanOrderListQuery, SalesmanOrderVO};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 1 条公共路由（去掉 `/api` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/salesman/order/list",
    "SalesmanOrderController.clientList",
)];

/// 业绩订单公共路由（`/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/salesman/order/list", get(list))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| RouteDoc::new(method, &format!("/api{path}"), java_ref))
        .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
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

/// 取登录会员 ID；游客返回 `0`。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<SalesmanOrderListQuery>,
) -> ApiResult<PageResult<SalesmanOrderVO>> {
    ok(state
        .marketing
        .salesman_order
        .client_list(current_user_id(&auth), &q)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[0].1, "/salesman/order/list");
        assert_eq!(ROUTE_TABLE[0].2, "SalesmanOrderController.clientList");
        assert!(!ROUTE_TABLE[0].1.starts_with("/api"));
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].path, "/api/salesman/order/list");
        assert_eq!(docs[0].method, "GET");
    }

    #[test]
    fn guest_user_id_is_zero() {
        assert_eq!(current_user_id(&None), 0);
    }

    #[test]
    fn query_parses_camel_case() {
        let q: SalesmanOrderListQuery =
            serde_json::from_str(r#"{"status":1,"timeType":2,"size":5}"#).unwrap();
        assert_eq!(q.status, Some(1));
        assert_eq!(q.time_type, Some(2));
        assert_eq!(q.page_size, Some(5));
    }
}
