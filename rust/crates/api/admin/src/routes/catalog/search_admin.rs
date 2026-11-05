//! 管理端全局搜索路由（catalog::search_admin，2 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.search.SearchController`
//! （`@RequestMapping("/adminapi/search")`，类级
//! `@PreAuthorize("@pms.hasPermission('productManage')")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET /search/aggregate` | `SearchController.aggregate` |
//! | `GET /search/product` | `SearchController.product` |
//!
//! 其余 3 条 `/api/search/search/**` 属于商城端，位于
//! `crates/api/public/src/routes/catalog/search_admin.rs`（同一 feature 的
//! public_route 层）。
//!
//! > **语义**：Java 两个端点都委托 `ProductService#list(ProductListDTO)`，
//! > 并统一收口：
//! > 1. `shopId > 0`（请求头）时强制本店 → Rust 只认查询参数 `shopId`（JWT 无店铺）；
//! > 2. `isDelete = 0`（只搜非回收站，全状态可搜）；
//! > 3. `aggregate` 固定取前 `AGGREGATE_PRODUCT_PREVIEW_SIZE = 5` 条，忽略分页。
//! >
//! > 这里直接复用 `catalog/product_manage` 的 `admin_list`
//! > （`ProductListDTO` / `ProductListResDTO` 的迁移对应物），不重复实现列表 SQL。

use axum::{extract::State, routing::get, Router};
// `AdminProductListQuery` 含数组字段（`productTypes` / `idList` / `brandIds` …），
// axum 内置 serde_urlencoded 不支持序列类型；与 product_manage 一致改用
// axum-extra 的 serde_html_form Query。
use axum::extract::Extension;
use axum_extra::extract::Query;
use tigshop_core::models::catalog::product_manage::{AdminProductListQuery, ProductListItemVO};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::AuthUser;
use tigshop_security::web::{ok, ApiResult};

use super::tenant;
use crate::AdminState;

/// 综合搜索商品预览默认条数（Java `AGGREGATE_PRODUCT_PREVIEW_SIZE`）。
pub const AGGREGATE_PRODUCT_PREVIEW_SIZE: u64 = 5;

/// 本模块负责的 2 条管理端路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/search/aggregate", "SearchController.aggregate"),
    ("GET", "/search/product", "SearchController.product"),
];

/// 管理端全局搜索路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/search/aggregate", get(aggregate))
        .route("/search/product", get(product))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/search/aggregate`：综合搜索（固定前 5 条预览）。
///
/// 对应 Java `SearchController#aggregate`：
/// `page=1, size=5, isDelete=0`，其余过滤条件透传 `ProductListDTO`。
async fn aggregate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<AdminProductListQuery>,
) -> ApiResult<PageResult<ProductListItemVO>> {
    q.page = Some(1);
    q.page_size = Some(AGGREGATE_PRODUCT_PREVIEW_SIZE);
    q.is_delete = Some(0);
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.product_manage.admin_list(&q).await?)
}

/// `GET /adminapi/search/product`：商品搜索（分页透传）。
async fn product(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<AdminProductListQuery>,
) -> ApiResult<PageResult<ProductListItemVO>> {
    // Java `applySearchScope`：搜索范围仅排除回收站
    q.is_delete = Some(0);
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.product_manage.admin_list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        let expected = [
            (
                "GET",
                "/adminapi/search/aggregate",
                "SearchController.aggregate",
            ),
            (
                "GET",
                "/adminapi/search/product",
                "SearchController.product",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                docs.iter()
                    .any(|d| d.method == method && d.path == path && d.java_ref == handler),
                "缺少 {method} {path}"
            );
        }
    }

    #[test]
    fn routes_registers_both_table_paths() {
        let registered = [("GET", "/search/aggregate"), ("GET", "/search/product")];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE
                    .iter()
                    .any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        for (method, path, _) in ROUTE_TABLE.iter() {
            assert!(
                registered.iter().any(|(m, p)| m == method && p == path),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }

    #[test]
    fn aggregate_preview_size_matches_java_constant() {
        assert_eq!(AGGREGATE_PRODUCT_PREVIEW_SIZE, 5);
    }
    /// 多租户：店铺账号搜索必须强制本店过滤。
    #[test]
    fn tenant_scope_forces_shop_filter() {
        let shop = AuthUser {
            id: 3,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(5),
        };
        assert_eq!(tenant::list_scope(&shop, None).unwrap(), Some(5));
        assert!(tenant::list_scope(&shop, Some(7)).is_err());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(tenant::list_scope(&platform, None).unwrap(), None);
    }
}
