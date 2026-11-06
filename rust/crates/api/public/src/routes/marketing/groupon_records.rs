//! 商城前台拼团记录路由（marketing::groupon_records）。
//! Java `GrouponRecordsController`：`/api/promotion/groupon/record/{list,details}`（optional）。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::marketing::groupon_records::{
    GrouponRecordDetailQuery, GrouponRecordDetailVO, GrouponRecordPageQuery, GrouponRecordVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/promotion/groupon/record/list", "GrouponRecordsController.clientList"),
    ("GET", "/promotion/groupon/record/details", "GrouponRecordsController.clientDetails"),
];

/// 可选登录态结果。
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<AuthUser>);

/// 拼团记录路由（挂载于 `/api` 下，自带可选登录中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/promotion/groupon/record/list", get(list))
        .route("/promotion/groupon/record/details", get(details))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 覆盖率统计用路由清单。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/api{p}"), j))
        .collect()
}

async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    let mut user: Option<AuthUser> = None;
    if token.is_some() {
        let Ok(claims) = jwt.from_authorization(token) else { return Ok(next.run(req).await); };
        let Ok(id) = claims.sub.parse::<i32>() else { return Ok(next.run(req).await); };
        user = Some(AuthUser {
            id,
            username: claims.usr,
            role_id: claims.role,
            admin_type: claims.typ,
            shop_id: claims.shop_id,
        });
    }
    req.extensions_mut().insert(OptionalUser(user));
    Ok(next.run(req).await)
}

fn user_id(user: &OptionalUser) -> Option<i32> {
    user.0.as_ref().map(|u| u.id)
}

async fn list(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<GrouponRecordPageQuery>,
) -> ApiResult<PageResult<GrouponRecordVO>> {
    ok(state
        .marketing
        .groupon_records
        .client_list(&q, user_id(&user))
        .await?)
}

async fn details(
    State(state): State<PublicState>,
    Query(q): Query<GrouponRecordDetailQuery>,
) -> ApiResult<GrouponRecordDetailVO> {
    ok(state.marketing.groupon_records.client_details(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        for (m, p) in [
            ("GET", "/api/promotion/groupon/record/list"),
            ("GET", "/api/promotion/groupon/record/details"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 2);
    }
}
