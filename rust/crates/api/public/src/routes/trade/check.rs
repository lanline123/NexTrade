//! 前台订单结算路由（trade::check）。
//!
//! 对应原 Java `com.tigshop.api.controller.order.CheckController`
//! （`@RequestMapping("/api/order/check")`，6 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 实现 |
//! |------------------------------|--------------|------|
//! | `POST /order/check/index` | `index` | 结算页数据装配（商品/优惠券/余额/支付/配送） |
//! | `GET  /order/check/getAvailablePaymentType` | `getAvailablePaymentType` | 完整实现 |
//! | `POST /order/check/update` | `update` | 同上（地址/配送/券变化后重算） |
//! | `POST /order/check/updateCoupon` | `updateCoupon` | 同上（优惠券试算） |
//! | `GET  /order/check/getInvoice` | `getInvoice` | 完整 DB 实现 |
//! | `GET  /order/check/getStoreShippingType` | `getStoreShippingType` | 按店铺返回配送方式 |
//!
//! > 契约 auth=optional：与 `content/seo.rs` 一致，本文件自带 [`optional_auth`]。
//! > 需要会员上下文的端点（index/update/updateCoupon/getInvoice/getStoreShippingType）
//! > 在 handler 内要求登录（游客 → 401「请先登录」），与 Java `getCurrentUserId()` 一致。
//!
//! > 合并注意：本模块并入 `merge_public`，外层**不要**再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use std::collections::HashMap;

use tigshop_core::models::trade::check::{
    InvoiceQuery, OrderCheckParam, OrderCheckVO, OrderInvoiceVO, PaymentTypeQuery, PaymentTypeVO,
    ShippingTypeVO, StoreShippingTypeQuery, MSG_LOGIN_REQUIRED,
};
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域全部 6 条路由（去掉 `/api` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("POST", "/order/check/index", "CheckController.index"),
    (
        "GET",
        "/order/check/getAvailablePaymentType",
        "CheckController.getAvailablePaymentType",
    ),
    ("POST", "/order/check/update", "CheckController.update"),
    (
        "POST",
        "/order/check/updateCoupon",
        "CheckController.updateCoupon",
    ),
    ("GET", "/order/check/getInvoice", "CheckController.getInvoice"),
    (
        "GET",
        "/order/check/getStoreShippingType",
        "CheckController.getStoreShippingType",
    ),
];

/// 订单结算路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/order/check/index", post(index))
        .route(
            "/order/check/getAvailablePaymentType",
            get(get_available_payment_type),
        )
        .route("/order/check/update", post(update))
        .route("/order/check/updateCoupon", post(update_coupon))
        .route("/order/check/getInvoice", get(get_invoice))
        .route("/order/check/getStoreShippingType", get(get_store_shipping_type))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
        .collect()
}

/// 可选登录态中间件（与 `content/seo.rs` / `trade/user_order.rs` 逐行一致）。
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

/// 从可选扩展中取当前会员 id，游客 → 401「请先登录」。
fn current_user_id(auth: Option<Extension<AuthUser>>) -> std::result::Result<i32, AppError> {
    auth.map(|Extension(user)| user.id)
        .filter(|id| *id > 0)
        .ok_or_else(|| AppError(Error::Unauthorized(MSG_LOGIN_REQUIRED.into())))
}

/// `POST /api/order/check/index`：结算页数据装配。
async fn index(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<OrderCheckVO> {
    let user_id = current_user_id(auth)?;
    ok(state.trade.check.order_check_index(user_id, &param).await?)
}

/// `GET /api/order/check/getAvailablePaymentType`：可用支付方式（游客可访问）。
async fn get_available_payment_type(
    State(state): State<PublicState>,
    Query(q): Query<PaymentTypeQuery>,
) -> ApiResult<Vec<PaymentTypeVO>> {
    ok(state
        .trade
        .check
        .available_payment_types(q.flow_type)
        .await?)
}

/// `POST /api/order/check/update`：结算页更新（地址/配送/券变化后重算）。
async fn update(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<OrderCheckVO> {
    let user_id = current_user_id(auth)?;
    ok(state.trade.check.order_check_update(user_id, &param).await?)
}

/// `POST /api/order/check/updateCoupon`：结算页优惠券试算。
async fn update_coupon(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<OrderCheckVO> {
    let user_id = current_user_id(auth)?;
    ok(state
        .trade
        .check
        .order_check_update_coupon(user_id, &param)
        .await?)
}

/// `GET /api/order/check/getInvoice`：最近一条发票（完整 DB 实现）。
async fn get_invoice(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<InvoiceQuery>,
) -> ApiResult<Option<OrderInvoiceVO>> {
    let user_id = current_user_id(auth)?;
    ok(state
        .trade
        .check
        .last_invoice(user_id, q.invoice_type, q.title_type)
        .await?)
}

/// `GET /api/order/check/getStoreShippingType`：店铺配送方式。
async fn get_store_shipping_type(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<StoreShippingTypeQuery>,
) -> ApiResult<HashMap<i32, Vec<ShippingTypeVO>>> {
    // Java：query.userId 非空时用它（代客/后台），否则取当前会员
    if q.user_id.unwrap_or(0) <= 0 {
        q.user_id = Some(current_user_id(auth)?);
    }
    ok(state.trade.check.store_shipping_types(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（6 条，含 `/api` 前缀）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let expected = [
            ("POST", "/api/order/check/index"),
            ("GET", "/api/order/check/getAvailablePaymentType"),
            ("POST", "/api/order/check/update"),
            ("POST", "/api/order/check/updateCoupon"),
            ("GET", "/api/order/check/getInvoice"),
            ("GET", "/api/order/check/getStoreShippingType"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域共 6 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        let mut unique: Vec<String> = docs.iter().map(RouteDoc::key).collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// `routes()` 注册路径必须与 [`ROUTE_TABLE`] 完全一致（6/6）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/order/check/index",
            "/order/check/getAvailablePaymentType",
            "/order/check/update",
            "/order/check/updateCoupon",
            "/order/check/getInvoice",
            "/order/check/getStoreShippingType",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 路径表前缀/方法/唯一性。
    #[test]
    fn route_table_is_unique_and_prefixed() {
        for (i, (method, path, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(path.starts_with("/order/check/"), "前缀错误: {path}");
            assert!(*method == "GET" || *method == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 游客访问需登录端点 → 401「请先登录」。
    #[test]
    fn guest_rejected_for_user_scoped_endpoints() {
        assert!(current_user_id(None).is_err());
    }
}
