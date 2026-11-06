//! 商城前台关键词联想路由（catalog::product_search，1 条）。
//!
//! 对应原 Java `com.tigshop.api.controller.search.SearchGuessController`
//! （`@RequestMapping("/api/search/searchGuess")`，`GET /index`）：
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |-----------------------------|--------------|-----------|
//! | `GET /search/searchGuess/index` | `SearchGuessController.getSearchGuessList` | optional |
//!
//! > **auth=optional 口径**：Java 该接口在 `permitAll` 下（带合法 JWT 时仍写入
//! > 用户上下文），本文件自带 [`optional_auth`]（同 `content/seo.rs` /
//! > `catalog/comment.rs` 既有实现），由 `sync_routes.py` 并入
//! > `merge_public`，外层不再套 `require_auth`。
//!
//! > **契约归属说明**：spec 中 `catalog/product_search` 的唯一端点路径是
//! > `/api/search/searchGuess/index`，因此本 feature **没有 admin_route 层**，
//! > 路由文件放在 public crate（任务书允许按路径归属创建 public 文件）。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::catalog::product_search::{KeywordSearchListVO, KeywordSearchQuery};
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本 feature 全部路由（`/api` 前缀之后）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/search/searchGuess/index",
    "SearchGuessController.getSearchGuessList",
)];

/// 关键词联想路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/search/searchGuess/index", get(index))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
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

/// `GET /api/search/searchGuess/index?keyword=`：搜索关键词联想。
///
/// 对应 Java `SearchGuessController#getSearchGuessList`：
/// `keyword` 可空（空/单数字返回空数组），返回 `List<KeywordSearchListVO>`。
async fn index(
    State(state): State<PublicState>,
    Query(q): Query<KeywordSearchQuery>,
) -> ApiResult<Vec<KeywordSearchListVO>> {
    ok(state
        .catalog
        .product_search
        .search_guess(q.keyword.as_deref())
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/api/search/searchGuess/index");
        assert_eq!(docs[0].java_ref, "SearchGuessController.getSearchGuessList");
    }

    #[test]
    fn route_table_and_registration_agree() {
        let registered = [("GET", "/search/searchGuess/index")];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        for (method, path, _) in ROUTE_TABLE.iter() {
            assert!(
                registered.iter().any(|(m, p)| m == method && p == path),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }
}
