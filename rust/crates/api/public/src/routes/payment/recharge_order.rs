//! 前台充值路由（payment::recharge_order，7 条，`optional` 鉴权）。
//!
//! 对应原 Java `com.tigshop.api.controller.user.RechargeOrderController`
//! （`@RequestMapping("/api/user/rechargeOrder")`）：
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 |
//! |-----------------------------|--------------|
//! | `GET  /user/rechargeOrder/list` | `list` |
//! | `GET  /user/rechargeOrder/setting` | `setting` |
//! | `GET  /user/rechargeOrder/paymentList` | `paymentList` |
//! | `POST /user/rechargeOrder/update` | `update` |
//! | `POST /user/rechargeOrder/pay` | `pay` |
//! | `GET  /user/rechargeOrder/checkStatus` | `checkStatus` |
//! | `POST /user/rechargeOrder/create` | `create` |
//!
//! 7 条均 `optional`（登录态可选，无令牌放行；业务内按用户 id 归属校验）。

use axum::{
    extract::{Query, State},
    http::header,
    http::HeaderMap,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::payment::recharge_order::{
    ClientRechargeListQuery, ClientRechargePayQuery, ClientRechargeUpdateDTO, RechargeCreatePayDTO,
    RechargeSettingPageQuery, RechargeSettingVO, RechargeUpdateOrderVO, RechargePayVO,
    ClientUserRechargeOrderVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 7 条路由（`/api` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    ("GET", "/user/rechargeOrder/list", "RechargeOrderController.list"),
    (
        "GET",
        "/user/rechargeOrder/setting",
        "RechargeOrderController.setting",
    ),
    (
        "GET",
        "/user/rechargeOrder/paymentList",
        "RechargeOrderController.paymentList",
    ),
    (
        "POST",
        "/user/rechargeOrder/update",
        "RechargeOrderController.update",
    ),
    ("POST", "/user/rechargeOrder/pay", "RechargeOrderController.pay"),
    (
        "GET",
        "/user/rechargeOrder/checkStatus",
        "RechargeOrderController.checkStatus",
    ),
    (
        "POST",
        "/user/rechargeOrder/create",
        "RechargeOrderController.create",
    ),
];

/// 前台充值路由（挂载于 `/api`，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/rechargeOrder/list", get(list))
        .route("/user/rechargeOrder/setting", get(setting))
        .route("/user/rechargeOrder/paymentList", get(payment_list))
        .route("/user/rechargeOrder/update", post(update))
        .route("/user/rechargeOrder/pay", post(pay))
        .route("/user/rechargeOrder/checkStatus", get(check_status))
        .route("/user/rechargeOrder/create", post(create))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
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
    mut req: axum::extract::Request,
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

fn user_id(auth: Option<Extension<AuthUser>>) -> Option<i32> {
    auth.map(|Extension(a)| a.id)
}

/// `GET /api/user/rechargeOrder/list`：充值/提现记录。
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<ClientRechargeListQuery>,
) -> ApiResult<PageResult<ClientUserRechargeOrderVO>> {
    q.user_id = user_id(auth);
    ok(state.payment.recharge_order.list(&q).await?)
}

/// `GET /api/user/rechargeOrder/setting`：充值配置分页。
async fn setting(
    State(state): State<PublicState>,
    Query(q): Query<RechargeSettingPageQuery>,
) -> ApiResult<PageResult<RechargeSettingVO>> {
    ok(state.payment.recharge_order.setting(&q).await?)
}

/// `GET /api/user/rechargeOrder/paymentList`：可用支付方式。
async fn payment_list(
    State(state): State<PublicState>,
    headers: HeaderMap,
) -> ApiResult<Vec<String>> {
    let client_type = headers
        .get("x-client-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("h5");
    ok(state.payment.recharge_order.payment_list(client_type).await?)
}

/// `POST /api/user/rechargeOrder/update`：创建/获取充值单。
async fn update(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(mut dto): Json<ClientRechargeUpdateDTO>,
) -> ApiResult<RechargeUpdateOrderVO> {
    if dto.user_id.is_none() {
        dto.user_id = user_id(auth);
    }
    ok(state.payment.recharge_order.update(&dto).await?)
}

/// `POST /api/user/rechargeOrder/pay`：充值支付信息。
async fn pay(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<ClientRechargePayQuery>,
) -> ApiResult<RechargePayVO> {
    if q.user_id.is_none() {
        q.user_id = user_id(auth);
    }
    ok(state.payment.recharge_order.pay(&q).await?)
}

/// `GET /api/user/rechargeOrder/checkStatus`：充值单状态。
async fn check_status(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<ClientRechargePayQuery>,
) -> ApiResult<i32> {
    if q.user_id.is_none() {
        q.user_id = user_id(auth);
    }
    ok(state.payment.recharge_order.check_status(&q).await?)
}

/// `POST /api/user/rechargeOrder/create`：创建渠道支付单（渠道 SDK 未迁移）。
async fn create(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(mut dto): Json<RechargeCreatePayDTO>,
) -> ApiResult<()> {
    if dto.user_id.is_none() {
        dto.user_id = user_id(auth);
    }
    state.payment.recharge_order.create(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/api/user/rechargeOrder/list"),
            ("GET", "/api/user/rechargeOrder/setting"),
            ("GET", "/api/user/rechargeOrder/paymentList"),
            ("POST", "/api/user/rechargeOrder/update"),
            ("POST", "/api/user/rechargeOrder/pay"),
            ("GET", "/api/user/rechargeOrder/checkStatus"),
            ("POST", "/api/user/rechargeOrder/create"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn all_routes_are_optional_auth_group() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET" || *m == "POST"));
    }
}
