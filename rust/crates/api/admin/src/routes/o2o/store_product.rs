//! 门店商品分配路由（o2o::store_product）。
//!
//! Java 来源（overseas）：`bean/model/o2o/StoreProduct.java`
//! （`@TableName store_product`）；overseas 无 `StoreProductController`，
//! 路由与入参以线上前端契约为准
//! （`java/view/admin/src/views/product/product/store/BatchAllocationPop.vue`：
//! `POST o2o/storeProduct/allocationProduct`，body
//! `{type: "SHOPS"|"ALL"|"AREA", productIds, shopIds?}`）。

use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::o2o::store_product::{AllocationProductDTO, AllocationResultVO};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "POST",
    "/o2o/storeProduct/allocationProduct",
    "StoreProductController.allocationProduct",
)];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route(
        "/o2o/storeProduct/allocationProduct",
        post(allocation_product),
    )
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `POST /adminapi/o2o/storeProduct/allocationProduct`。
async fn allocation_product(
    State(state): State<AdminState>,
    Json(dto): Json<AllocationProductDTO>,
) -> ApiResult<AllocationResultVO> {
    ok(state.o2o.store_product.allocate(&dto).await?)
}
