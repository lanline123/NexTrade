//! 推荐 —— 商城端路由（system::recommend）—— wave9。
//!
//! 原 Java `RecommendController`（`@RequestMapping("/api/common/recommend")`），
//! 2 个 public GET（契约 `auth=optional`）：
//!
//! | 本模块路由（挂载于 `/api`） | Java handler |
//! |-----------------------------|--------------|
//! | `GET /common/recommend/guessLike` | getProductList |
//! | `GET /common/recommend/getProductIds` | getProductIds |
//!
//! > 自带 optional_auth；必须并入 `merge_public`，外层不得再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::system::recommend::{GuessLikeQuery, RecommendProductVO};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/common/recommend/guessLike", "RecommendController.getProductList"),
    ("GET", "/common/recommend/getProductIds", "RecommendController.getProductIds"),
];

/// 推荐路由。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/common/recommend/guessLike", get(guess_like))
        .route("/common/recommend/getProductIds", get(get_product_ids))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/api{p}"), j))
        .collect()
}

/// `GET /api/common/recommend/guessLike`
async fn guess_like(
    State(state): State<PublicState>,
    Query(q): Query<GuessLikeQuery>,
) -> ApiResult<Vec<RecommendProductVO>> {
    ok(state.system.recommend.guess_like(&q).await?)
}

/// `GET /api/common/recommend/getProductIds`
///
/// 原版 `getProductIds` 内部取 `SecurityUtils.getCurrentUserId()`，登录会员会额外掺入
/// 浏览记录段；游客按 0 处理。
async fn get_product_ids(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<String> {
    let user_id = auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0);
    ok(state.system.recommend.product_ids(user_id).await?)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/api/common/recommend/guessLike");
        assert_eq!(docs[1].path, "/api/common/recommend/getProductIds");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/api")));
    }

    #[test]
    fn both_routes_are_get() {
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET"));
    }
}
