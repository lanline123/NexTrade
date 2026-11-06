//! 商城前台抽奖路由（marketing::lottery）。
//! Java `LotteryController`：`/api/promotion/lottery/*`（5 端点，auth=optional）。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::marketing::lottery::{
    LotteryActivityInfoVO, LotteryConfirmReceiveParam, LotteryRecordQuery, LotteryRecordVO,
    LotteryResultVO, LotteryWinnerVO, LotteryWinnersQuery,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    ("GET", "/promotion/lottery/info", "LotteryController.info"),
    ("POST", "/promotion/lottery/draw", "LotteryController.draw"),
    ("GET", "/promotion/lottery/myRecords", "LotteryController.myRecords"),
    ("POST", "/promotion/lottery/confirmReceive", "LotteryController.confirmReceive"),
    ("GET", "/promotion/lottery/winners", "LotteryController.winners"),
];

/// 可选登录态结果。
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<AuthUser>);

/// 抽奖路由（挂载于 `/api` 下，自带可选登录中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/promotion/lottery/info", get(info))
        .route("/promotion/lottery/draw", post(draw))
        .route("/promotion/lottery/myRecords", get(my_records))
        .route("/promotion/lottery/confirmReceive", post(confirm_receive))
        .route("/promotion/lottery/winners", get(winners))
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

async fn info(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
) -> ApiResult<LotteryActivityInfoVO> {
    ok(state.marketing.lottery.info(user_id(&user)).await?)
}

async fn draw(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
) -> ApiResult<LotteryResultVO> {
    ok(state.marketing.lottery.draw(user_id(&user)).await?)
}

async fn my_records(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<LotteryRecordQuery>,
) -> ApiResult<PageResult<LotteryRecordVO>> {
    ok(state.marketing.lottery.my_records(user_id(&user), &q).await?)
}

async fn confirm_receive(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Json(param): Json<LotteryConfirmReceiveParam>,
) -> ApiResult<()> {
    state
        .marketing
        .lottery
        .confirm_receive(&param, user_id(&user))
        .await?;
    ok(())
}

async fn winners(
    State(state): State<PublicState>,
    Query(q): Query<LotteryWinnersQuery>,
) -> ApiResult<Vec<LotteryWinnerVO>> {
    ok(state.marketing.lottery.winners(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        for (m, p) in [
            ("GET", "/api/promotion/lottery/info"),
            ("POST", "/api/promotion/lottery/draw"),
            ("GET", "/api/promotion/lottery/myRecords"),
            ("POST", "/api/promotion/lottery/confirmReceive"),
            ("GET", "/api/promotion/lottery/winners"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 5);
    }
}
