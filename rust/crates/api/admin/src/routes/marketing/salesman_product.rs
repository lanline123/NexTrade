//! 管理端分销商品路由（marketing::salesman_product）。
//!
//! 原 Java `com.tigshop.adminapi.controller.salesman.SalesmanProductController`
//! （`@RequestMapping("/adminapi/salesman/product")`，6 端点；另有 2 条 `/api`
//! 客户端端点见 `api/public/src/routes/marketing/salesman_product.rs`）。
//! 权限矩阵未迁移。
use axum::{
    extract::Query,
    extract::State,
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_product::{
    BatchDTO, SalesmanProductAnalysisQuery, SalesmanProductEditParam, SalesmanProductListVO,
    SalesmanProductPageQuery, SalesmanProductSaveParam, SalesmanProductVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 7 条 admin 路由。最后一条 `batch` 来自
/// 新版管理端前端契约（`view/admin/src/api/salesman/product.ts`）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/salesman/product/list",
        "SalesmanProductController.list",
    ),
    (
        "GET",
        "/salesman/product/detail",
        "SalesmanProductController.detail",
    ),
    (
        "POST",
        "/salesman/product/create",
        "SalesmanProductController.create",
    ),
    (
        "POST",
        "/salesman/product/update",
        "SalesmanProductController.update",
    ),
    (
        "GET",
        "/salesman/product/config",
        "SalesmanProductController.config",
    ),
    (
        "GET",
        "/salesman/product/analysis",
        "SalesmanProductController.analysis",
    ),
    (
        "POST",
        "/salesman/product/batch",
        "SalesmanProductController.batch",
    ),
];

/// 分销商品管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/product/list", get(list))
        .route("/salesman/product/detail", get(detail))
        .route("/salesman/product/create", post(create))
        .route("/salesman/product/update", post(update))
        .route("/salesman/product/config", get(config))
        .route("/salesman/product/analysis", get(analysis))
        .route("/salesman/product/batch", post(batch))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanProductPageQuery>,
) -> ApiResult<PageResult<SalesmanProductListVO>> {
    ok(state.marketing.salesman_product.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanProductVO>> {
    ok(state
        .marketing
        .salesman_product
        .detail_by_product_id(q.id)
        .await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(param): Json<SalesmanProductSaveParam>,
) -> ApiResult<()> {
    state.marketing.salesman_product.create(&param).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(param): Json<SalesmanProductEditParam>,
) -> ApiResult<()> {
    state.marketing.salesman_product.update(&param).await?;
    ok(())
}

/// `GET /adminapi/salesman/product/config`：分销商品类型映射（Java `Map<Integer,String>`）。
async fn config() -> ApiResult<serde_json::Value> {
    let mut map = serde_json::Map::new();
    for (code, name) in
        tigshop_services::marketing::salesman_product::SalesmanProductService::config()
    {
        map.insert(
            code.to_string(),
            serde_json::Value::String(name.to_string()),
        );
    }
    ok(serde_json::Value::Object(map))
}

async fn analysis(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanProductAnalysisQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    ok(state.marketing.salesman_product.analysis(&q).await?)
}

/// `POST /adminapi/salesman/product/batch`：批量操作。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/salesman/product.ts#batchSubmit`（`{ type, ids }`，
/// 分销商品/业绩结算列表批量删除；Java 控制器未含该端点）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state
        .marketing
        .salesman_product
        .batch(&dto.r#type, &dto.ids)
        .await?)
}

/// 解析 `HeaderUtils.getShopId()`（缺失 ⇒ 0 平台）。
#[must_use]
#[cfg(test)]
fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

#[cfg(test)]
fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("GET", "/adminapi/salesman/product/list"),
            ("GET", "/adminapi/salesman/product/detail"),
            ("POST", "/adminapi/salesman/product/create"),
            ("POST", "/adminapi/salesman/product/update"),
            ("GET", "/adminapi/salesman/product/config"),
            ("GET", "/adminapi/salesman/product/analysis"),
            ("POST", "/adminapi/salesman/product/batch"),
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
    fn route_table_paths_stay_relative() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/adminapi"), "{path}");
            assert!(path.starts_with("/salesman/product/"), "{path}");
        }
    }

    #[test]
    fn shop_header_branches() {
        use axum::http::HeaderValue;
        let mut h = HeaderMap::new();
        assert_eq!(shop_id_from_headers(&h), 0);
        h.insert("x-admin-type", HeaderValue::from_static("shop"));
        h.insert("x-shop-id", HeaderValue::from_static("9"));
        assert_eq!(shop_id_from_headers(&h), 9);
    }
}
