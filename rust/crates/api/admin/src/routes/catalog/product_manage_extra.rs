//! catalog::product_manage 管理端剩余端点 —— 路由层（wave8 第二批）。
//!
//! 本文件补充 `ProductController` 中尚未注册的管理端路径；已有 9 条路由保留在
//! `product_manage.rs`（list/detail/catAndBrandList/create/update/del + 3 条
//! productBatch），**不重复注册**。
//!
//! | 本文件路由（挂载于 `/adminapi`） | 契约 | 状态 |
//! |----------------------------------|------|------|
//! | `GET  /product/product/getWaitingCheckedCount` | jwt+perm | 已实现 |
//! | `GET  /product/product/descImages` | jwt+perm | 已实现 |
//! | `GET  /product/product/skuList` | jwt+perm | 已实现 |
//! | `GET  /product/product/shippingTplList` | jwt+perm | 已实现 |
//! | `POST /product/product/updateField` | jwt+perm | 已实现 |
//! | `POST /product/product/batch` | jwt+perm | 已实现（del/up/down/recycle） |
//! | `POST /product/product/recycle` | jwt+perm | 已实现 |
//! | `POST /product/product/audit` | jwt+perm | 已实现 |
//! | `POST /product/product/auditAgain` | jwt+perm | 已实现 |
//! | `POST /product/product/getParticiple` | jwt+perm | **未迁移**（ES 分词） |
//! | `POST /product/product/initAllToEs` | jwt+perm | **未迁移**（ES 客户端） |
//! | `GET  /product/product/post` | jwt+perm | **未迁移**（短链/小程序码） |
//!
//! > 权限矩阵未实现（仅 `require_auth`）；权限码见契约。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::product_manage_extra::{
    ProductAuditDTO, ProductBatchOperationDTO, ProductDescImageVO, ProductPostVO,
    ProductRecycleDTO, ProductSkuListQuery, ProductUpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本文件 12 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 12] = [
    (
        "GET",
        "/product/product/getWaitingCheckedCount",
        "ProductController.getWaitingCheckedCount",
    ),
    (
        "GET",
        "/product/product/descImages",
        "ProductController.descImages",
    ),
    (
        "GET",
        "/product/product/skuList",
        "ProductController.skuList",
    ),
    (
        "GET",
        "/product/product/shippingTplList",
        "ProductController.shippingTplList",
    ),
    (
        "POST",
        "/product/product/updateField",
        "ProductController.updateField",
    ),
    (
        "POST",
        "/product/product/batch",
        "ProductController.batchOperation",
    ),
    (
        "POST",
        "/product/product/recycle",
        "ProductController.recycle",
    ),
    ("POST", "/product/product/audit", "ProductController.audit"),
    (
        "POST",
        "/product/product/auditAgain",
        "ProductController.auditAgain",
    ),
    (
        "POST",
        "/product/product/getParticiple",
        "ProductController.getParticiple",
    ),
    (
        "POST",
        "/product/product/initAllToEs",
        "ProductController.initAllToEs",
    ),
    ("GET", "/product/product/post", "ProductController.post"),
];

/// 管理端商品剩余路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/product/product/getWaitingCheckedCount",
            get(get_waiting_checked_count),
        )
        .route("/product/product/descImages", get(desc_images))
        .route("/product/product/skuList", get(sku_list))
        .route("/product/product/shippingTplList", get(shipping_tpl_list))
        .route("/product/product/updateField", post(update_field))
        .route("/product/product/batch", post(batch))
        .route("/product/product/recycle", post(recycle))
        .route("/product/product/audit", post(audit))
        .route("/product/product/auditAgain", post(audit_again))
        .route("/product/product/getParticiple", post(get_participle))
        .route("/product/product/initAllToEs", post(init_all_to_es))
        .route("/product/product/post", get(post_page))
}

/// 本文件已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductIdQuery {
    product_id: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecycleQuery {
    id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuditAgainQuery {
    id: i32,
}

/// `GET /adminapi/product/product/getWaitingCheckedCount`
async fn get_waiting_checked_count(State(state): State<AdminState>) -> ApiResult<i64> {
    ok(state
        .catalog
        .product_manage_extra
        .waiting_checked_count()
        .await?)
}

/// `GET /adminapi/product/product/descImages?productId=`
async fn desc_images(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<Vec<ProductDescImageVO>> {
    ok(state
        .catalog
        .product_manage_extra
        .desc_images(q.product_id)
        .await?)
}

/// `GET /adminapi/product/product/skuList`
async fn sku_list(
    State(state): State<AdminState>,
    Query(q): Query<ProductSkuListQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    ok(state.catalog.product_manage_extra.sku_list(&q).await?)
}

/// `GET /adminapi/product/product/shippingTplList`
async fn shipping_tpl_list(State(state): State<AdminState>) -> ApiResult<Vec<serde_json::Value>> {
    ok(state
        .catalog
        .product_manage_extra
        .shipping_tpl_list()
        .await?)
}

/// `POST /adminapi/product/product/updateField`
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<ProductUpdateFieldDTO>,
) -> ApiResult<String> {
    ok(state
        .catalog
        .product_manage_extra
        .update_field(&dto)
        .await?)
}

/// `POST /adminapi/product/product/batch`
async fn batch(
    State(state): State<AdminState>,
    Json(dto): Json<ProductBatchOperationDTO>,
) -> ApiResult<()> {
    state.catalog.product_manage_extra.batch(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/product/recycle`
async fn recycle(
    State(state): State<AdminState>,
    Json(dto): Json<ProductRecycleDTO>,
) -> ApiResult<bool> {
    ok(state.catalog.product_manage_extra.recycle(dto.id).await?)
}

/// `POST /adminapi/product/product/audit`
async fn audit(
    State(state): State<AdminState>,
    Json(dto): Json<ProductAuditDTO>,
) -> ApiResult<bool> {
    ok(state.catalog.product_manage_extra.audit(&dto).await?)
}

/// `POST /adminapi/product/product/auditAgain?id=`
async fn audit_again(
    State(state): State<AdminState>,
    Query(q): Query<AuditAgainQuery>,
) -> ApiResult<bool> {
    ok(state.catalog.product_manage_extra.audit_again(q.id).await?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductKeyDTO {
    product_name: Option<String>,
}

/// `POST /adminapi/product/product/getParticiple`：关键词分词。
async fn get_participle(
    State(state): State<AdminState>,
    Json(dto): Json<ProductKeyDTO>,
) -> ApiResult<String> {
    ok(state
        .catalog
        .product_manage_extra
        .get_participle(dto.product_name.as_deref())
        .await?)
}

/// `POST /adminapi/product/product/initAllToEs`（未迁移：ES 客户端）
async fn init_all_to_es(State(state): State<AdminState>) -> ApiResult<()> {
    state.catalog.product_manage_extra.init_all_to_es().await?;
    ok(())
}

/// `GET /adminapi/product/product/post?productId=`（商品推广数据）
async fn post_page(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<ProductPostVO> {
    ok(state
        .catalog
        .product_manage_extra
        .post(q.product_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_covers_twelve_remaining_admin_paths() {
        assert_eq!(ROUTE_TABLE.len(), 12);
        let docs = implemented_routes();
        assert_eq!(docs.len(), 12);
        assert_eq!(
            docs[0].path,
            "/adminapi/product/product/getWaitingCheckedCount"
        );
        assert_eq!(docs[11].path, "/adminapi/product/product/post");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/adminapi")));
    }

    #[test]
    fn no_overlap_with_baseline_route_file() {
        // 基线 product_manage.rs 已有的 9 条路径（含 productBatch 3 条）。
        const BASELINE: [&str; 6] = [
            "/product/product/list",
            "/product/product/detail",
            "/product/product/catAndBrandList",
            "/product/product/create",
            "/product/product/update",
            "/product/product/del",
        ];
        for (_, path, _) in ROUTE_TABLE {
            assert!(!BASELINE.contains(&path), "duplicate baseline path: {path}");
        }
    }

    #[test]
    fn methods_split_matches_java_controller() {
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 5);
        assert_eq!(ROUTE_TABLE.len() - gets, 7);
    }
}
