//! Apple Pay 前台路由（payment::apple_pay，4 条，`optional` 鉴权）。
//!
//! 对应原 Java `com.tigshop.api.controller.order.ApplePayController`
//! （`/api/order/pay` 下）：
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 |
//! |-----------------------------|--------------|
//! | `POST /order/pay/applepay/validateMerchant` | `validateMerchant` |
//! | `POST /order/pay/applepay/confirm` | `confirm` |
//! | `POST /order/pay/applepay/confirmByPaymentMethod` | `confirmByPaymentMethod` |
//! | `POST /order/pay/notify/ums` | `notifyUms` |
//!
//! 请求体为 Apple Pay 原始 payload（JSON 原样透传）；本地完成 paylog 归属校验后，
//! 渠道 SDK 相关处理返回明确「未迁移」错误（详见服务层模块头）。

use axum::{
    extract::{Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::post,
    Extension, Json, Router,
};
use serde_json::Value;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 4 条路由（`/api` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "POST",
        "/order/pay/applepay/validateMerchant",
        "ApplePayController.validateMerchant",
    ),
    (
        "POST",
        "/order/pay/applepay/confirm",
        "ApplePayController.confirm",
    ),
    (
        "POST",
        "/order/pay/applepay/confirmByPaymentMethod",
        "ApplePayController.confirmByPaymentMethod",
    ),
    (
        "POST",
        "/order/pay/notify/ums",
        "ApplePayController.notifyUms",
    ),
];

/// Apple Pay 路由（挂载于 `/api`，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/order/pay/applepay/validateMerchant", post(validate_merchant))
        .route("/order/pay/applepay/confirm", post(confirm))
        .route(
            "/order/pay/applepay/confirmByPaymentMethod",
            post(confirm_by_payment_method),
        )
        .route("/order/pay/notify/ums", post(notify_ums))
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

/// 可选登录态中间件（Java `permitAll` + JWT 过滤器）。
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

fn user_id(auth: Option<Extension<AuthUser>>) -> Option<i32> {
    auth.map(|Extension(a)| a.id)
}

/// `POST /api/order/pay/applepay/validateMerchant`：商户校验。
async fn validate_merchant(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    state
        .payment
        .apple_pay
        .validate_merchant(user_id(auth), &body)
        .await?;
    ok(())
}

/// `POST /api/order/pay/applepay/confirm`：支付确认。
async fn confirm(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    state.payment.apple_pay.confirm(user_id(auth), &body).await?;
    ok(())
}

/// `POST /api/order/pay/applepay/confirmByPaymentMethod`：按支付方式确认。
async fn confirm_by_payment_method(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    state
        .payment
        .apple_pay
        .confirm_by_payment_method(user_id(auth), &body)
        .await?;
    ok(())
}

/// `POST /api/order/pay/notify/ums`：银联商务异步通知。
async fn notify_ums(
    State(state): State<PublicState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    state.payment.apple_pay.notify_ums(&body).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("POST", "/api/order/pay/applepay/validateMerchant"),
            ("POST", "/api/order/pay/applepay/confirm"),
            ("POST", "/api/order/pay/applepay/confirmByPaymentMethod"),
            ("POST", "/api/order/pay/notify/ums"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn route_table_slice_is_exact() {
        assert_eq!(ROUTE_TABLE.len(), 4);
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| p.starts_with("/order/pay/")));
    }
}
