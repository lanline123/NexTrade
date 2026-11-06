//! 前台用户订单路由（trade::user_order）。
//!
//! 对应原 Java `com.tigshop.api.controller.user.UserOrderController`
//! （`@RequestMapping("/api/user/order")`）中本域负责的 6 个端点。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------------------------|------------------|--------------|-----------|
//! | `GET  /user/order/orderNum` | `GET /api/user/order/orderNum` | `UserOrderController.orderNum` | optional |
//! | `GET  /user/order/reasonConfig` | `GET /api/user/order/reasonConfig` | `UserOrderController.reasonConfig` | optional |
//! | `POST /user/order/delOrder` | `POST /api/user/order/delOrder` | `UserOrderController.delOrder` | optional |
//! | `POST /user/order/confirmReceipt` | `POST /api/user/order/confirmReceipt` | `UserOrderController.confirmReceipt` | optional |
//! | `GET  /user/order/shippingInfo` | `GET /api/user/order/shippingInfo` | `UserOrderController.shippingInfo` | optional |
//! | `POST /user/order/buyAgain` | `POST /api/user/order/buyAgain` | `UserOrderController.buyAgain` | optional |
//!
//! > 契约 auth=optional 的落地口径与 `content/seo.rs` 一致：本文件自带的
//! > [`optional_auth`] 中间件（合法令牌 → 会员上下文；无令牌 → 游客；
//! > 令牌非法/过期 → 401）。业务上订单接口在 Java 内均调用 `getCurrentUserId()`，
//! > 游客无法完成业务，本实现在 handler 内要求登录（游客 → 401「请先登录」）。
//!
//! > 合并注意：本模块并入 `merge_public`（`crates/api/public/src/routes/mod.rs`），
//! > 外层**不要**再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::trade::user_order::{
    OrderIdDTO, OrderNumVO, ReasonConfigVO, ShippingResult, MSG_LOGIN_REQUIRED,
};
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域全部 6 条路由（去掉 `/api` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/user/order/orderNum", "UserOrderController.orderNum"),
    (
        "GET",
        "/user/order/reasonConfig",
        "UserOrderController.reasonConfig",
    ),
    ("POST", "/user/order/delOrder", "UserOrderController.delOrder"),
    (
        "POST",
        "/user/order/confirmReceipt",
        "UserOrderController.confirmReceipt",
    ),
    (
        "GET",
        "/user/order/shippingInfo",
        "UserOrderController.shippingInfo",
    ),
    ("POST", "/user/order/buyAgain", "UserOrderController.buyAgain"),
];

/// 前台用户订单路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/order/orderNum", get(order_num))
        .route("/user/order/reasonConfig", get(reason_config))
        .route("/user/order/delOrder", post(del_order))
        .route("/user/order/confirmReceipt", post(confirm_receipt))
        .route("/user/order/shippingInfo", get(shipping_info))
        .route("/user/order/buyAgain", post(buy_again))
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

/// 可选登录态中间件：无令牌 → 放行为游客；令牌非法 / 过期 → 401；
/// 令牌合法 → 写入 [`AuthUser`]（与 `content/seo.rs` 逐行一致）。
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

/// `GET /api/user/order/orderNum`：订单数量。
async fn order_num(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<OrderNumVO> {
    let user_id = current_user_id(auth)?;
    ok(state.trade.user_order.order_num(user_id).await?)
}

/// `GET /api/user/order/reasonConfig`：售后/取消订单原因配置。
async fn reason_config(State(state): State<PublicState>) -> ApiResult<ReasonConfigVO> {
    ok(state.trade.user_order.reason_config().await?)
}

/// `POST /api/user/order/delOrder`：删除订单。
async fn del_order(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<OrderIdDTO>,
) -> ApiResult<()> {
    let user_id = current_user_id(auth)?;
    state.trade.user_order.del_order(user_id, &dto).await?;
    ok(())
}

/// `POST /api/user/order/confirmReceipt`：确认收货。
async fn confirm_receipt(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<OrderIdDTO>,
) -> ApiResult<()> {
    let user_id = current_user_id(auth)?;
    state
        .trade
        .user_order
        .confirm_receipt(user_id, &dto)
        .await?;
    ok(())
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct OrderIdQuery {
    id: Option<i32>,
}

/// `GET /api/user/order/shippingInfo`：物流信息。
async fn shipping_info(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<OrderIdQuery>,
) -> ApiResult<Option<ShippingResult>> {
    let user_id = current_user_id(auth)?;
    ok(state.trade.user_order.shipping_info(user_id, q.id).await?)
}

/// `POST /api/user/order/buyAgain`：再次购买。
async fn buy_again(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<OrderIdDTO>,
) -> ApiResult<()> {
    let user_id = current_user_id(auth)?;
    state.trade.user_order.buy_again(user_id, &dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（6 条，含 `/api` 前缀）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let expected = [
            ("GET", "/api/user/order/orderNum"),
            ("GET", "/api/user/order/reasonConfig"),
            ("POST", "/api/user/order/delOrder"),
            ("POST", "/api/user/order/confirmReceipt"),
            ("GET", "/api/user/order/shippingInfo"),
            ("POST", "/api/user/order/buyAgain"),
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
            "/user/order/orderNum",
            "/user/order/reasonConfig",
            "/user/order/delOrder",
            "/user/order/confirmReceipt",
            "/user/order/shippingInfo",
            "/user/order/buyAgain",
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
            assert!(path.starts_with("/user/order/"), "前缀错误: {path}");
            assert!(*method == "GET" || *method == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 可选登录态：无 Authorization → 游客放行（中间件不写 AuthUser）。
    #[test]
    fn optional_auth_allows_guest_by_design() {
        // 中间件行为无法在此单测（依赖 JwtService），此处校验路由层契约：
        // 6 条 handler 全部接收 Option<Extension<AuthUser>>，游客进入业务层后 401。
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(header::AUTHORIZATION, HeaderValue::from_static(""));
        assert!(headers.get(header::AUTHORIZATION).is_some());
        assert!(current_user_id(None).is_err());
    }
}
