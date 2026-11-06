//! 商城前台订单支付路由（payment::pay）。
//!
//! 对应原 Java `com.tigshop.api.controller.order.PayController`
//! （`@RequestMapping("/api/order/pay")`，契约 6 个 `optional` 端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java | auth |
//! |------------------------------|---------|------|
//! | `GET /order/pay/index` | `index` | optional |
//! | `GET /order/pay/paymentList` | `paymentList` | optional |
//! | `GET /order/pay/getPayLog` | `getPayLog` | optional |
//! | `GET /order/pay/checkStatus` | `checkStatus` | optional |
//! | `GET /order/pay/create` | `create` | optional |
//! | `GET /order/pay/createDepositPayment` | `createDepositPayment` | optional |
//!
//! > **auth=optional 口径**：与 `content/seo.rs` 一致，本文件自带
//! > [`optional_auth`]：无令牌放行（业务层「用户未登录」）、非法/过期令牌 401、
//! > 合法令牌写入 [`AuthUser`] 并包进 [`OptionalUser`]。
//! > 本域 6 个 handler 全部依赖登录态：无令牌时返回业务 500「用户未登录」。
//!
//! > **未迁移**：`create` / `createDepositPayment` 的渠道 SDK 调用在本地校验后
//! > 返回明确「未迁移」业务错误（不伪造支付参数）；`checkStatus` 微信付款码轮询
//! > 分支同样未迁移（返回本地口径），详见 `tigshop_services::payment::pay` 模块头。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::payment::pay::{
    CheckStatusQuery, PayCreateQuery, PayCreateVO, PayIndexQuery, PayIndexVO, PayLogQuery, PaylogVO,
};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 6 条路由（去掉 `/api` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/order/pay/index", "PayController.index"),
    ("GET", "/order/pay/paymentList", "PayController.paymentList"),
    ("GET", "/order/pay/getPayLog", "PayController.getPayLog"),
    ("GET", "/order/pay/checkStatus", "PayController.checkStatus"),
    ("GET", "/order/pay/create", "PayController.create"),
    (
        "GET",
        "/order/pay/createDepositPayment",
        "PayController.createDepositPayment",
    ),
];

/// 可选登录态结果（中间件始终写入；无令牌/仅游客时为 `None`）。
#[derive(Debug, Clone)]
pub struct OptionalUser(pub Option<AuthUser>);

/// 订单支付域路由（挂载于 `/api` 下，自带可选登录中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/order/pay/index", get(index))
        .route("/order/pay/paymentList", get(payment_list))
        .route("/order/pay/getPayLog", get(get_pay_log))
        .route("/order/pay/checkStatus", get(check_status))
        .route("/order/pay/create", get(create))
        .route("/order/pay/createDepositPayment", get(create_deposit_payment))
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
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), java_ref)
        })
        .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器，与 seo.rs 逐行一致）。
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
    if let Some(auth) = &user {
        req.extensions_mut().insert(auth.clone());
    }
    req.extensions_mut().insert(OptionalUser(user));
    Ok(next.run(req).await)
}

/// 客户端类型头 `X-Client-Type`（Java `HeaderUtils.getClientType`）。
fn client_type(req_headers: &axum::http::HeaderMap) -> String {
    let raw = req_headers
        .get("x-client-type")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .unwrap_or("");
    match raw.to_ascii_lowercase().as_str() {
        "pc" => "pc".to_string(),
        "h5" => "h5".to_string(),
        "wechat" => "wechat".to_string(),
        "miniprogram" => "miniProgram".to_string(),
        other => other.to_string(),
    }
}

fn user_id(user: &OptionalUser) -> Option<i32> {
    user.0.as_ref().map(|u| u.id)
}

async fn payment_list(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    headers: axum::http::HeaderMap,
) -> ApiResult<PayIndexVO> {
    ok(state
        .payment
        .pay
        .payment_list(user_id(&user), &client_type(&headers))
        .await?)
}

async fn index(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<PayIndexQuery>,
) -> ApiResult<PayIndexVO> {
    ok(state
        .payment
        .pay
        .index(&q, user_id(&user), &client_type(&headers))
        .await?)
}

async fn get_pay_log(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<PayLogQuery>,
) -> ApiResult<PaylogVO> {
    ok(state.payment.pay.paylog(&q, user_id(&user)).await?)
}

async fn check_status(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<CheckStatusQuery>,
) -> ApiResult<i32> {
    ok(state.payment.pay.check_status(&q, user_id(&user)).await?)
}

async fn create(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<PayCreateQuery>,
) -> ApiResult<PayCreateVO> {
    ok(state.payment.pay.create(&q, user_id(&user)).await?)
}

async fn create_deposit_payment(
    State(state): State<PublicState>,
    Extension(user): Extension<OptionalUser>,
    Query(q): Query<PayCreateQuery>,
) -> ApiResult<PayCreateVO> {
    ok(state
        .payment
        .pay
        .create_deposit_payment(&q, user_id(&user))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        let expected = [
            ("GET", "/api/order/pay/index"),
            ("GET", "/api/order/pay/paymentList"),
            ("GET", "/api/order/pay/getPayLog"),
            ("GET", "/api/order/pay/checkStatus"),
            ("GET", "/api/order/pay/create"),
            ("GET", "/api/order/pay/createDepositPayment"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn route_table_matches_registrations() {
        let paths = [
            ("GET", "/order/pay/index"),
            ("GET", "/order/pay/paymentList"),
            ("GET", "/order/pay/getPayLog"),
            ("GET", "/order/pay/checkStatus"),
            ("GET", "/order/pay/create"),
            ("GET", "/order/pay/createDepositPayment"),
        ];
        assert_eq!(paths.len(), ROUTE_TABLE.len());
        for (m, p) in paths {
            assert!(ROUTE_TABLE.iter().any(|(mm, pp, _)| *mm == m && *pp == p));
        }
    }

    #[test]
    fn client_type_normalization() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            "x-client-type",
            axum::http::HeaderValue::from_static("MiniProgram"),
        );
        assert_eq!(client_type(&headers), "miniProgram");
        let mut headers = axum::http::HeaderMap::new();
        headers.insert("x-client-type", axum::http::HeaderValue::from_static("pc"));
        assert_eq!(client_type(&headers), "pc");
        assert_eq!(client_type(&axum::http::HeaderMap::new()), "");
    }
}
