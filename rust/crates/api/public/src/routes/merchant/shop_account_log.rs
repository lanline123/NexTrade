//! 店铺账户 —— 商城端路由（merchant::shop_account_log）—— wave9。
//!
//! 原 Java `com.tigshop.api.controller.user.AccountController`
//! （`@RequestMapping("/api/user/account")`），2 个 public GET（契约 `auth=optional`）：
//!
//! | 本模块路由（挂载于 `/api`） | Java handler | 说明 |
//! |-----------------------------|--------------|------|
//! | `GET /user/account/list` | list | 用户余额流水（wallet_type=0） |
//! | `GET /user/account/commissionList` | commissionList | 用户佣金流水（wallet_type=1） |
//!
//! > 自带 optional_auth；并入 `merge_public`，外层勿再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::merchant::shop_account_log::{
    UserAccountLogQuery, UserAccountLogVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/user/account/list", "AccountController.list"),
    ("GET", "/user/account/commissionList", "AccountController.commissionList"),
];

/// 用户账户流水路由。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/account/list", get(list))
        .route("/user/account/commissionList", get(commission_list))
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

fn user_id(auth: Option<Extension<AuthUser>>) -> Option<i32> {
    auth.map(|Extension(u)| u.id).filter(|v| *v > 0)
}

/// `GET /api/user/account/list`
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<UserAccountLogQuery>,
) -> ApiResult<PageResult<UserAccountLogVO>> {
    ok(state.merchant.shop_account_log.balance_logs(user_id(auth), &q).await?)
}

/// `GET /api/user/account/commissionList`
async fn commission_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<UserAccountLogQuery>,
) -> ApiResult<PageResult<UserAccountLogVO>> {
    ok(state
        .merchant
        .shop_account_log
        .commission_logs(user_id(auth), &q)
        .await?)
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
        assert_eq!(docs[0].path, "/api/user/account/list");
        assert_eq!(docs[1].path, "/api/user/account/commissionList");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/api")));
    }

    #[test]
    fn both_are_get() {
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET"));
    }
}
