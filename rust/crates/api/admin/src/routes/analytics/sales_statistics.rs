//! 销售统计 —— 管理端路由（analytics::sales_statistics）—— wave9。
//!
//! 原 Java `SalesStatisticsController`
//! （`@RequestMapping("/adminapi/panel/salesStatistics")`），5 个 GET：
//!
//! | 本模块路由（挂载于 `/adminapi`） | Java handler |
//! |-----------------------------------|--------------|
//! | `GET /panel/salesStatistics/list` | list |
//! | `GET /panel/salesStatistics/salesDetail` | salesDetail |
//! | `GET /panel/salesStatistics/salesProductDetail` | salesProductDetail |
//! | `GET /panel/salesStatistics/salesIndicators` | salesIndicators |
//! | `GET /panel/salesStatistics/salesRanking` | salesRanking |

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::analytics::sales_statistics::SalesStatisticsQuery;
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/panel/salesStatistics/list",
        "SalesStatisticsController.list",
    ),
    (
        "GET",
        "/panel/salesStatistics/salesDetail",
        "SalesStatisticsController.salesDetail",
    ),
    (
        "GET",
        "/panel/salesStatistics/salesProductDetail",
        "SalesStatisticsController.salesProductDetail",
    ),
    (
        "GET",
        "/panel/salesStatistics/salesIndicators",
        "SalesStatisticsController.salesIndicators",
    ),
    (
        "GET",
        "/panel/salesStatistics/salesRanking",
        "SalesStatisticsController.salesRanking",
    ),
];

/// 销售统计路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/panel/salesStatistics/list", get(list))
        .route("/panel/salesStatistics/salesDetail", get(sales_detail))
        .route(
            "/panel/salesStatistics/salesProductDetail",
            get(sales_product_detail),
        )
        .route(
            "/panel/salesStatistics/salesIndicators",
            get(sales_indicators),
        )
        .route("/panel/salesStatistics/salesRanking", get(sales_ranking))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<SalesStatisticsQuery>,
) -> ApiResult<serde_json::Value> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.sales_statistics.list(&q).await?)
}

async fn sales_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<SalesStatisticsQuery>,
) -> ApiResult<serde_json::Value> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.sales_statistics.sales_detail(&q).await?)
}

async fn sales_product_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<SalesStatisticsQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state
        .analytics
        .sales_statistics
        .sales_product_detail(&q)
        .await?)
}

async fn sales_indicators(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .analytics
        .sales_statistics
        .sales_indicators(auth.scoped_shop_id())
        .await?)
}

async fn sales_ranking(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<SalesStatisticsQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.sales_statistics.sales_ranking(&q).await?)
}

#[cfg(test)]
mod tests {
    #[test]
    fn shop_scope_rejects_cross_shop_and_forces_own() {
        use tigshop_core::Error;
        let shop = AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(5));
        assert_eq!(shop.resolve_shop_scope(None).unwrap(), Some(5));
        assert_eq!(shop.resolve_shop_scope(Some(5)).unwrap(), Some(5));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
        let platform = AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0));
        assert_eq!(platform.resolve_shop_scope(Some(9)).unwrap(), Some(9));
        assert_eq!(platform.resolve_shop_scope(None).unwrap(), None);
    }

    use super::*;

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/adminapi/panel/salesStatistics/list");
        assert_eq!(docs[4].path, "/adminapi/panel/salesStatistics/salesRanking");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/adminapi")));
    }

    #[test]
    fn all_are_get() {
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET"));
    }
}
