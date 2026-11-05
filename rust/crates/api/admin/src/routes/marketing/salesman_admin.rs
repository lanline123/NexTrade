//! 分销员管理 —— 管理端路由（marketing::salesman_admin）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanController`
//! （`@RequestMapping("/adminapi/salesman/salesman")`）。
//!
//! ⚠️ 该控制器的 `GET /adminapi/salesman/salesman/list` 已由基线
//! `routes/marketing/salesman.rs` 注册，**本模块不重复注册**（否则 axum
//! `Router::merge` 会 panic）；本模块覆盖其余 8 个端点。
//!
//! | method | path（本模块，挂载于 `/adminapi`） | 原 Java |
//! |--------|------------------------------------|---------|
//! | `GET`  | `/salesman/salesman/detail?id=` | `detail` |
//! | `POST` | `/salesman/salesman/create` | `create` |
//! | `POST` | `/salesman/salesman/update` | `update` |
//! | `GET`  | `/salesman/salesman/statisticalDetails` | `statisticalDetails` |
//! | `GET`  | `/salesman/salesman/commissionDetails?salesmanId=` | `commissionDetails` |
//! | `GET`  | `/salesman/salesman/ranking` | `ranking` |
//! | `GET`  | `/salesman/salesman/salesmanList?nickname=` | `salesmanList` |
//! | `GET`  | `/salesman/salesman/customerList` | `customerList` |
//!
//! # 权限
//! Java 仅 `create/update` 带 `salesmanModifyManage`，其余仅登录；Rust 全局
//! `require_auth` 只校验登录态（权限矩阵未实现）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_admin::{
    CommissionDetailsVO, CustomerListQuery, CustomerListVO, SalesmanDetailVO, SalesmanEditDTO,
    SalesmanRankingQuery, SalesmanRankingVO, SalesmanSaveDTO, SalesmanSelectVO,
    SalesmanStatisticalQuery, SalesmanStatisticalVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 8 条路由（去掉 `/adminapi` 前缀）。不含基线已注册的 `list`。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/salesman/salesman/detail",
        "SalesmanController.detail",
    ),
    (
        "POST",
        "/salesman/salesman/create",
        "SalesmanController.create",
    ),
    (
        "POST",
        "/salesman/salesman/update",
        "SalesmanController.update",
    ),
    (
        "GET",
        "/salesman/salesman/statisticalDetails",
        "SalesmanController.statisticalDetails",
    ),
    (
        "GET",
        "/salesman/salesman/commissionDetails",
        "SalesmanController.commissionDetails",
    ),
    (
        "GET",
        "/salesman/salesman/ranking",
        "SalesmanController.ranking",
    ),
    (
        "GET",
        "/salesman/salesman/salesmanList",
        "SalesmanController.salesmanList",
    ),
    (
        "GET",
        "/salesman/salesman/customerList",
        "SalesmanController.customerList",
    ),
];

/// 分销员管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/salesman/detail", get(detail))
        .route("/salesman/salesman/create", post(create))
        .route("/salesman/salesman/update", post(update))
        .route(
            "/salesman/salesman/statisticalDetails",
            get(statistical_details),
        )
        .route(
            "/salesman/salesman/commissionDetails",
            get(commission_details),
        )
        .route("/salesman/salesman/ranking", get(ranking))
        .route("/salesman/salesman/salesmanList", get(salesman_list))
        .route("/salesman/salesman/customerList", get(customer_list))
}

/// 本域已实现路由（覆盖率统计）。**不含**基线 `list`。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SalesmanIdQuery {
    salesman_id: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NicknameQuery {
    nickname: Option<String>,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<SalesmanDetailVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.marketing.salesman_admin.detail(id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanSaveDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_admin.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanEditDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_admin.update(&dto).await?;
    ok(())
}

async fn statistical_details(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanStatisticalQuery>,
) -> ApiResult<PageResult<SalesmanStatisticalVO>> {
    ok(state
        .marketing
        .salesman_admin
        .statistical_details(&q)
        .await?)
}

async fn commission_details(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanIdQuery>,
) -> ApiResult<CommissionDetailsVO> {
    let salesman_id = q
        .salesman_id
        .ok_or_else(|| tigshop_core::Error::Validation("salesmanId不能为空".into()))?;
    ok(state
        .marketing
        .salesman_admin
        .commission_details(salesman_id)
        .await?)
}

async fn ranking(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanRankingQuery>,
) -> ApiResult<PageResult<SalesmanRankingVO>> {
    ok(state.marketing.salesman_admin.ranking(&q).await?)
}

async fn salesman_list(
    State(state): State<AdminState>,
    Query(q): Query<NicknameQuery>,
) -> ApiResult<PageResult<SalesmanSelectVO>> {
    ok(state
        .marketing
        .salesman_admin
        .salesman_list(q.nickname.as_deref())
        .await?)
}

async fn customer_list(
    State(state): State<AdminState>,
    Query(q): Query<CustomerListQuery>,
) -> ApiResult<PageResult<CustomerListVO>> {
    ok(state.marketing.salesman_admin.customer_list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8, "基线 list 不在本模块");
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/salesman/detail",
                "/salesman/salesman/create",
                "/salesman/salesman/update",
                "/salesman/salesman/statisticalDetails",
                "/salesman/salesman/commissionDetails",
                "/salesman/salesman/ranking",
                "/salesman/salesman/salesmanList",
                "/salesman/salesman/customerList",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/salesman/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
        // 不重复注册基线路径
        assert!(!paths.contains(&"/salesman/salesman/list"));
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/salesman/salesman/"));
            assert!(d.java_ref.starts_with("SalesmanController."));
            assert_ne!(d.path, "/adminapi/salesman/salesman/list");
        }
        let gets: Vec<&str> = docs
            .iter()
            .filter(|d| d.method == "GET")
            .map(|d| d.path.as_str())
            .collect();
        assert_eq!(
            gets,
            vec![
                "/adminapi/salesman/salesman/detail",
                "/adminapi/salesman/salesman/statisticalDetails",
                "/adminapi/salesman/salesman/commissionDetails",
                "/adminapi/salesman/salesman/ranking",
                "/adminapi/salesman/salesman/salesmanList",
                "/adminapi/salesman/salesman/customerList",
            ]
        );
    }

    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/salesman/salesman/detail",
            "/salesman/salesman/create",
            "/salesman/salesman/update",
            "/salesman/salesman/statisticalDetails",
            "/salesman/salesman/commissionDetails",
            "/salesman/salesman/ranking",
            "/salesman/salesman/salesmanList",
            "/salesman/salesman/customerList",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for p in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, q, _)| *q == p));
        }
    }

    #[test]
    fn queries_parse_camel_case() {
        let q: SalesmanIdQuery = serde_json::from_str(r#"{"salesmanId":7}"#).unwrap();
        assert_eq!(q.salesman_id, Some(7));
        let c: CustomerListQuery = serde_json::from_str(r#"{"salesmanId":7,"size":20}"#).unwrap();
        assert_eq!(c.salesman_id, Some(7));
        assert_eq!(c.page_size, Some(20));
        let r: SalesmanRankingQuery = serde_json::from_str(
            r#"{"dateType":2,"searchStartTime":"2023-11-01","searchEndTime":"2023-11-30"}"#,
        )
        .unwrap();
        assert_eq!(r.date_type, Some(2));
        assert_eq!(r.search_start_time.as_deref(), Some("2023-11-01"));
    }
}
