//! catalog::product_manage 商城端 14 条端点 —— 路由层（wave8 batch 2）。
//!
//! 原 Java `com.tigshop.api.controller.product.ProductController`
//! （`@RequestMapping("/api/product/product")`），14 条契约 `auth=optional`：
//!
//! | 本文件路由（挂载于 `/api`） | Java handler | 状态 |
//! |-----------------------------|--------------|------|
//! | `GET  /product/product/share` | sharePage | 已实现（最小 HTML，偏差见服务层） |
//! | `GET  /product/product/isCollect` | isCollectMethod | 已实现（未登录 false） |
//! | `GET  /product/product/getCoupon` | getCoupon | 已实现 |
//! | `GET  /product/product/getComment` | getComment | 已实现（统计子集） |
//! | `GET  /product/product/getCommentList` | getCommentList | 已实现（10/页） |
//! | `GET  /product/product/getFeedbackList` | getFeedbackList | 已实现 |
//! | `GET  /product/product/getProductAvailability` | getProductAvailability | 已实现（sku 子集） |
//! | `POST /product/product/promotion` | getProductsPromotion | 已实现（商品自身促销字段） |
//! | `POST /product/product/getProductAmount` | getProductAmount | 已实现（零售价×数量） |
//! | `POST /product/product/priceInquiry` | priceInquiry | 已实现（写 price_inquiry） |
//! | `GET  /product/product/getPresaleDepositAmount` | getPresaleDepositAmount | 已实现 |
//! | `GET  /product/product/getRelated` | getRelated | 已实现 |
//! | `GET  /product/product/getBatchProductAvailability` | getBatchProductAvailability | 已实现 |
//! | `GET  /product/product/getHistoryProduct` | getHistoryProduct | 已实现（未登录空页） |
//!
//! > `auth=optional` 落地：自带 [`optional_auth`]（逐行对齐 `content/seo.rs`），
//! > 必须并入 `merge_public`，外层不得再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::{Html, Response},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::catalog::product_manage_client::{
    BatchAvailabilityQuery, CommentListQuery, FeedbackListQuery, HistoryProductQuery,
    PresaleDepositQuery, ProductAmountDTO, ProductAvailabilityQuery, ProductIdParam,
    ProductPriceInquiryDTO, ProductsPromotionDTO, SharePageQuery,
};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 14 条路由（去 `/api` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 14] = [
    ("GET", "/product/product/share", "ProductController.sharePage"),
    ("GET", "/product/product/isCollect", "ProductController.isCollectMethod"),
    ("GET", "/product/product/getCoupon", "ProductController.getCoupon"),
    ("GET", "/product/product/getComment", "ProductController.getComment"),
    ("GET", "/product/product/getCommentList", "ProductController.getCommentList"),
    ("GET", "/product/product/getFeedbackList", "ProductController.getFeedbackList"),
    ("GET", "/product/product/getProductAvailability", "ProductController.getProductAvailability"),
    ("POST", "/product/product/promotion", "ProductController.getProductsPromotion"),
    ("POST", "/product/product/getProductAmount", "ProductController.getProductAmount"),
    ("POST", "/product/product/priceInquiry", "ProductController.priceInquiry"),
    ("GET", "/product/product/getPresaleDepositAmount", "ProductController.getPresaleDepositAmount"),
    ("GET", "/product/product/getRelated", "ProductController.getRelated"),
    ("GET", "/product/product/getBatchProductAvailability", "ProductController.getBatchProductAvailability"),
    ("GET", "/product/product/getHistoryProduct", "ProductController.getHistoryProduct"),
];

/// 商城端 batch 2 路由（挂载于 `/api` 下，自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/product/product/share", get(share))
        .route("/product/product/isCollect", get(is_collect))
        .route("/product/product/getCoupon", get(get_coupon))
        .route("/product/product/getComment", get(get_comment))
        .route("/product/product/getCommentList", get(get_comment_list))
        .route("/product/product/getFeedbackList", get(get_feedback_list))
        .route("/product/product/getProductAvailability", get(get_product_availability))
        .route("/product/product/promotion", post(promotion))
        .route("/product/product/getProductAmount", post(get_product_amount))
        .route("/product/product/priceInquiry", post(price_inquiry))
        .route("/product/product/getPresaleDepositAmount", get(get_presale_deposit_amount))
        .route("/product/product/getRelated", get(get_related))
        .route("/product/product/getBatchProductAvailability", get(get_batch_product_availability))
        .route("/product/product/getHistoryProduct", get(get_history_product))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), java_ref)
        })
        .collect()
}

fn user_id(auth: Option<Extension<AuthUser>>) -> Option<i32> {
    auth.map(|Extension(u)| u.id).filter(|v| *v > 0)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelatedQuery {
    product_id: i32,
}

/// `GET /api/product/product/share?id=&salesmanId=`：分享页（最小 HTML）。
async fn share(
    State(state): State<PublicState>,
    Query(q): Query<SharePageQuery>,
) -> Result<Html<String>, AppError> {
    let html = state
        .catalog
        .product_manage_client
        .share_html(q.id, q.salesman_id)
        .await?;
    Ok(Html(html))
}

/// `GET /api/product/product/isCollect?id=&shopId=`
async fn is_collect(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<ProductIdParam>,
) -> ApiResult<bool> {
    ok(state.catalog.product_manage_client.is_collect(user_id(auth), &q).await?)
}

/// `GET /api/product/product/getCoupon?id=&shopId=`
async fn get_coupon(
    State(state): State<PublicState>,
    Query(q): Query<ProductIdParam>,
) -> ApiResult<Vec<serde_json::Value>> {
    ok(state.catalog.product_manage_client.coupon_list(&q).await?)
}

/// `GET /api/product/product/getComment?id=&shopId=`
async fn get_comment(
    State(state): State<PublicState>,
    Query(q): Query<ProductIdParam>,
) -> ApiResult<serde_json::Value> {
    ok(state.catalog.product_manage_client.comment_statistic(&q).await?)
}

/// `GET /api/product/product/getCommentList?id=&page=&type=&shopId=`
async fn get_comment_list(
    State(state): State<PublicState>,
    Query(q): Query<CommentListQuery>,
) -> ApiResult<tigshop_core::types::PageResult<serde_json::Value>> {
    ok(state.catalog.product_manage_client.comment_list(&q).await?)
}

/// `GET /api/product/product/getFeedbackList?productId=&page=&size=`
async fn get_feedback_list(
    State(state): State<PublicState>,
    Query(q): Query<FeedbackListQuery>,
) -> ApiResult<tigshop_core::types::PageResult<serde_json::Value>> {
    ok(state.catalog.product_manage_client.feedback_list(&q).await?)
}

/// `GET /api/product/product/getProductAvailability?id=&skuId=`
async fn get_product_availability(
    State(state): State<PublicState>,
    Query(q): Query<ProductAvailabilityQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.catalog.product_manage_client.availability(&q).await?)
}

/// `POST /api/product/product/promotion`
async fn promotion(
    State(state): State<PublicState>,
    Json(dto): Json<ProductsPromotionDTO>,
) -> ApiResult<serde_json::Value> {
    ok(state.catalog.product_manage_client.products_promotion(&dto).await?)
}

/// `POST /api/product/product/getProductAmount`
async fn get_product_amount(
    State(state): State<PublicState>,
    Json(dto): Json<ProductAmountDTO>,
) -> ApiResult<serde_json::Value> {
    ok(state.catalog.product_manage_client.product_amount(&dto).await?)
}

/// `POST /api/product/product/priceInquiry`
async fn price_inquiry(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<ProductPriceInquiryDTO>,
) -> ApiResult<()> {
    state
        .catalog
        .product_manage_client
        .price_inquiry(&dto, user_id(auth))
        .await?;
    ok(())
}

/// `GET /api/product/product/getPresaleDepositAmount?productId=&skuId=`
async fn get_presale_deposit_amount(
    State(state): State<PublicState>,
    Query(q): Query<PresaleDepositQuery>,
) -> ApiResult<rust_decimal::Decimal> {
    ok(state.catalog.product_manage_client.presale_deposit(&q).await?)
}

/// `GET /api/product/product/getRelated?productId=`
async fn get_related(
    State(state): State<PublicState>,
    Query(q): Query<RelatedQuery>,
) -> ApiResult<Vec<serde_json::Value>> {
    ok(state.catalog.product_manage_client.related(q.product_id).await?)
}

/// `GET /api/product/product/getBatchProductAvailability?skuIds=1,2,3`
async fn get_batch_product_availability(
    State(state): State<PublicState>,
    Query(q): Query<BatchAvailabilityQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.catalog.product_manage_client.batch_availability(&q).await?)
}

/// `GET /api/product/product/getHistoryProduct?page=&size=`
async fn get_history_product(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<HistoryProductQuery>,
) -> ApiResult<tigshop_core::types::PageResult<serde_json::Value>> {
    ok(state
        .catalog
        .product_manage_client
        .history_products(&q, user_id(auth))
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
    fn route_table_covers_all_fourteen_public_paths() {
        assert_eq!(ROUTE_TABLE.len(), 14);
        let docs = implemented_routes();
        assert_eq!(docs.len(), 14);
        assert_eq!(docs[0].path, "/api/product/product/share");
        assert_eq!(docs[13].path, "/api/product/product/getHistoryProduct");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/api/")));
    }

    #[test]
    fn methods_match_java_controller() {
        assert_eq!(ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count(), 11);
        assert_eq!(ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "POST").count(), 3);
    }

    #[test]
    fn no_overlap_with_public_baseline() {
        const BASELINE: [&str; 1] = ["/product/product/detail"];
        for (_, p, _) in ROUTE_TABLE {
            assert!(!BASELINE.contains(&p));
        }
    }
}
