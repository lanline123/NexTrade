//! 管理端分销概览路由（marketing::overview）。
//! Java `OverviewController`：`/adminapi/salesman/overview/{coreTrend,coreSummary}`。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::marketing::overview::{
    OverviewCoreSummaryVO, OverviewCoreTrendVO, OverviewSummaryQuery, OverviewTrendQuery,
};
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/salesman/overview/coreTrend",
        "OverviewController.coreTrend",
    ),
    (
        "GET",
        "/salesman/overview/coreSummary",
        "OverviewController.coreSummary",
    ),
];

/// 分销概览域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/overview/coreTrend", get(core_trend))
        .route("/salesman/overview/coreSummary", get(core_summary))
}

/// 覆盖率统计用路由清单。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// `HeaderUtils.getShopId()` 三态（admin→0、shop/pos→头值、其它→None）。
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

async fn core_trend(
    State(state): State<AdminState>,
    Query(q): Query<OverviewTrendQuery>,
) -> ApiResult<OverviewCoreTrendVO> {
    ok(state
        .marketing
        .overview
        .core_trend(&q, TenantScope::current_list_filter())
        .await?)
}

async fn core_summary(
    State(state): State<AdminState>,
    Query(q): Query<OverviewSummaryQuery>,
) -> ApiResult<OverviewCoreSummaryVO> {
    ok(state
        .marketing
        .overview
        .core_summary(&q, TenantScope::current_list_filter())
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        for (m, p) in [
            ("GET", "/adminapi/salesman/overview/coreTrend"),
            ("GET", "/adminapi/salesman/overview/coreSummary"),
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
        h.insert("x-shop-id", axum::http::HeaderValue::from_static("9"));
        assert_eq!(current_shop_id(&h), Some(9));
        assert_eq!(current_shop_id(&axum::http::HeaderMap::new()), None);
    }
}
