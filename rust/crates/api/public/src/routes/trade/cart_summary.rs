//! 前台购物车数量/优惠券试算路由（trade::cart_summary）。
//!
//! 对应 Java `CartController` 的 2 个端点：
//! `GET /api/cart/cart/getCount`、`GET /api/cart/cart/getCouponDiscount`。
//!
//! 契约 auth=optional：本文件自带 [`optional_auth`]（同 content/seo.rs 模式）；
//! 两个接口都需要会员上下文，游客 → 401「请先登录」。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::trade::cart_summary::{
    CartCountQuery, CartCouponDiscountVO, CouponDiscountQuery, MSG_LOGIN_REQUIRED,
};
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 2 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/cart/cart/getCount", "CartController.getCount"),
    (
        "GET",
        "/cart/cart/getCouponDiscount",
        "CartController.getCouponDiscount",
    ),
];

/// 购物车汇总路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/cart/cart/getCount", get(get_count))
        .route("/cart/cart/getCouponDiscount", get(get_coupon_discount))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
        .collect()
}

/// 可选登录态中间件（与 content/seo.rs 一致）。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .filter(|t| !t.trim().eq_ignore_ascii_case("bearer null") && !t.trim().is_empty())
        .map(str::to_string)
        .or_else(|| {
            req.headers()
                .get(header::COOKIE)
                .and_then(|v| v.to_str().ok())
                .and_then(|raw| {
                    raw.split(';').find_map(|pair| {
                        let (name, value) = pair.split_once('=')?;
                        matches!(name.trim(), "accessToken" | "token")
                            .then(|| value.trim().trim_matches('"').to_string())
                            .filter(|v| !v.is_empty() && v != "null")
                            .map(|v| format!("Bearer {v}"))
                    })
                })
        });
    if let Some(token) = token.as_deref() {
        let Ok(claims) = jwt.from_authorization(Some(token)) else { return Ok(next.run(req).await); };
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

/// 当前会员 id，游客 → 401。
fn current_user_id(auth: Option<Extension<AuthUser>>) -> std::result::Result<i32, AppError> {
    auth.map(|Extension(user)| user.id)
        .filter(|id| *id > 0)
        .ok_or_else(|| AppError(Error::Unauthorized(MSG_LOGIN_REQUIRED.into())))
}

/// `GET /api/cart/cart/getCount`：购物车商品数量。
async fn get_count(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<CartCountQuery>,
) -> ApiResult<i32> {
    let user_id = current_user_id(auth)?;
    ok(state.trade.cart_summary.get_count(user_id, q.shop_id).await?)
}

/// `GET /api/cart/cart/getCouponDiscount`：优惠券试算（未迁移，明确报错）。
async fn get_coupon_discount(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<CouponDiscountQuery>,
) -> ApiResult<CartCouponDiscountVO> {
    let user_id = current_user_id(auth)?;
    ok(state
        .trade
        .cart_summary
        .get_coupon_discount(user_id, q.coupon_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/api/cart/cart/getCount");
        assert_eq!(docs[1].path, "/api/cart/cart/getCouponDiscount");
    }

    #[test]
    fn routes_registers_all_table_paths() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        for (m, p, _) in ROUTE_TABLE.iter() {
            assert_eq!(*m, "GET");
            assert!(p.starts_with("/cart/cart/"));
        }
    }

    #[test]
    fn guest_rejected() {
        assert!(current_user_id(None).is_err());
    }
}
