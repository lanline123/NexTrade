//! 管理端活动赠品路由（marketing::product_gift）。
//! Java `ProductGiftController`：`/adminapi/promotion/productGift/*`（7 端点）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::product_gift::{
    BatchDTO, OperateDTO, ProductGiftCreateDTO, ProductGiftListQuery, ProductGiftUpdateDTO,
    ProductGiftVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/promotion/productGift/list",
        "ProductGiftController.list",
    ),
    (
        "GET",
        "/promotion/productGift/detail",
        "ProductGiftController.detail",
    ),
    (
        "POST",
        "/promotion/productGift/create",
        "ProductGiftController.create",
    ),
    (
        "POST",
        "/promotion/productGift/update",
        "ProductGiftController.update",
    ),
    (
        "POST",
        "/promotion/productGift/del",
        "ProductGiftController.del",
    ),
    (
        "POST",
        "/promotion/productGift/updateField",
        "ProductGiftController.updateField",
    ),
    (
        "POST",
        "/promotion/productGift/batch",
        "ProductGiftController.batch",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/productGift/list", get(list))
        .route("/promotion/productGift/detail", get(detail))
        .route("/promotion/productGift/create", post(create))
        .route("/promotion/productGift/update", post(update))
        .route("/promotion/productGift/del", post(del))
        .route("/promotion/productGift/updateField", post(update_field))
        .route("/promotion/productGift/batch", post(batch))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// Java `HeaderUtils.getShopId()`：admin→0、shop/pos→`X-Shop-Id`、其它→None。
#[cfg(test)]
fn current_shop_id(headers: &axum::http::HeaderMap) -> Option<i32> {
    let admin_type = headers
        .get("x-admin-type")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .unwrap_or("");
    match admin_type {
        "admin" => Some(0),
        "shop" | "pos" => headers
            .get("x-shop-id")
            .and_then(|v| v.to_str().ok())
            .map(str::trim)
            .and_then(|v| v.parse::<i32>().ok()),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GiftIdQuery {
    gift_id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ProductGiftListQuery>,
) -> ApiResult<PageResult<ProductGiftVO>> {
    ok(state.marketing.product_gift.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<GiftIdQuery>,
) -> ApiResult<ProductGiftVO> {
    ok(state.marketing.product_gift.detail(q.gift_id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<ProductGiftCreateDTO>,
) -> ApiResult<()> {
    let _id = state.marketing.product_gift.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ProductGiftUpdateDTO>,
) -> ApiResult<()> {
    state.marketing.product_gift.update(&dto).await?;
    ok(())
}

async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.product_gift.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.product_gift.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.product_gift.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for (m, p) in [
            ("GET", "/adminapi/promotion/productGift/list"),
            ("GET", "/adminapi/promotion/productGift/detail"),
            ("POST", "/adminapi/promotion/productGift/create"),
            ("POST", "/adminapi/promotion/productGift/update"),
            ("POST", "/adminapi/promotion/productGift/del"),
            ("POST", "/adminapi/promotion/productGift/updateField"),
            ("POST", "/adminapi/promotion/productGift/batch"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn shop_id_three_states() {
        let mut h = axum::http::HeaderMap::new();
        h.insert(
            "x-admin-type",
            axum::http::HeaderValue::from_static("admin"),
        );
        assert_eq!(current_shop_id(&h), Some(0));
        let mut h = axum::http::HeaderMap::new();
        h.insert("x-admin-type", axum::http::HeaderValue::from_static("shop"));
        h.insert("x-shop-id", axum::http::HeaderValue::from_static("7"));
        assert_eq!(current_shop_id(&h), Some(7));
        assert_eq!(current_shop_id(&axum::http::HeaderMap::new()), None);
    }
}
