//! catalog::product_manage 管理端剩余 6 条端点 —— 路由层（wave8 batch 2）。
//!
//! 原 Java `com.tigshop.adminapi.controller.product.ProductController` 中尚未注册的：
//!
//! | 本文件路由（挂载于 `/adminapi`） | 契约 | 状态 |
//! |----------------------------------|------|------|
//! | `GET  /product/product/config` | jwt+perm | 已实现（配置聚合） |
//! | `POST /product/product/copy` | jwt+perm | 已实现（仅商品主表，偏差见服务层） |
//! | `GET  /product/product/getPromoteData` | jwt+perm | 已实现（短链以站内路径兜底） |
//! | `GET  /product/product/selectProductList` | jwt+perm | 已实现（跨表 SKU 列表） |
//! | `POST /product/product/saveShareInfo` | jwt+perm | 已实现 |
//! | `GET  /product/product/shareInfo` | jwt+perm | 已实现 |
//!
//! > 与 batch 1 文件（`product_manage_extra.rs`）零路径重叠。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::product_manage_client::{
    ProductConfigQuery, ProductCopyDTO, ProductShareInfoDTO, ProductShareInfoVO,
    SelectProductListQuery,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

use super::tenant;

/// 本文件 6 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/product/product/config", "ProductController.config"),
    ("POST", "/product/product/copy", "ProductController.copy"),
    (
        "GET",
        "/product/product/getPromoteData",
        "ProductController.getPromoteData",
    ),
    (
        "GET",
        "/product/product/selectProductList",
        "ProductController.selectProductList",
    ),
    (
        "POST",
        "/product/product/saveShareInfo",
        "ProductController.saveShareInfo",
    ),
    (
        "GET",
        "/product/product/shareInfo",
        "ProductController.shareInfo",
    ),
];

/// 管理端 batch 2 路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/product/config", get(config))
        .route("/product/product/copy", post(copy))
        .route("/product/product/getPromoteData", get(get_promote_data))
        .route(
            "/product/product/selectProductList",
            get(select_product_list),
        )
        .route("/product/product/saveShareInfo", post(save_share_info))
        .route("/product/product/shareInfo", get(share_info))
}

/// 本文件已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

async fn ensure_product_access(
    state: &AdminState,
    auth: &AuthUser,
    product_id: i32,
) -> Result<(), tigshop_core::Error> {
    let product = state
        .catalog
        .product_manage_client
        .repo()
        .find_product(product_id)
        .await?
        .ok_or_else(|| tigshop_core::Error::biz_msg("商品不存在"))?;
    tenant::ensure_row_shop(auth, product.shop_id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductIdQuery {
    product_id: i32,
}

/// `GET /adminapi/product/product/config?shopId=`
async fn config(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<ProductConfigQuery>,
) -> ApiResult<serde_json::Value> {
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.product_manage_client.admin_config(&q).await?)
}

/// `POST /adminapi/product/product/copy`
async fn copy(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProductCopyDTO>,
) -> ApiResult<String> {
    ensure_product_access(&state, &auth, dto.product_id).await?;
    ok(state.catalog.product_manage_client.admin_copy(&dto).await?)
}

/// `GET /adminapi/product/product/getPromoteData?productId=`
async fn get_promote_data(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<serde_json::Value> {
    ensure_product_access(&state, &auth, q.product_id).await?;
    ok(state
        .catalog
        .product_manage_client
        .admin_promote_data(q.product_id)
        .await?)
}

/// `GET /adminapi/product/product/selectProductList`
async fn select_product_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<SelectProductListQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state
        .catalog
        .product_manage_client
        .admin_select_product_list(&q)
        .await?)
}

/// `POST /adminapi/product/product/saveShareInfo`
async fn save_share_info(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProductShareInfoDTO>,
) -> ApiResult<bool> {
    ensure_product_access(&state, &auth, dto.product_id).await?;
    ok(state
        .catalog
        .product_manage_client
        .admin_save_share_info(&dto)
        .await?)
}

/// `GET /adminapi/product/product/shareInfo?productId=`
async fn share_info(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<ProductShareInfoVO> {
    ensure_product_access(&state, &auth, q.product_id).await?;
    ok(state
        .catalog
        .product_manage_client
        .admin_share_info(q.product_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_has_six_batch2_admin_paths() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        assert_eq!(docs[0].path, "/adminapi/product/product/config");
        assert_eq!(docs[5].path, "/adminapi/product/product/shareInfo");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/adminapi")));
    }

    #[test]
    fn methods_match_java_controller() {
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 4);
        assert_eq!(ROUTE_TABLE.len() - gets, 2);
    }

    #[test]
    fn no_overlap_with_batch1_paths() {
        const BATCH1: [&str; 6] = [
            "/product/product/getWaitingCheckedCount",
            "/product/product/descImages",
            "/product/product/skuList",
            "/product/product/shippingTplList",
            "/product/product/getParticiple",
            "/product/product/initAllToEs",
        ];
        for (_, p, _) in ROUTE_TABLE {
            assert!(!BATCH1.contains(&p));
        }
    }
}
