//! 分销业绩订单 —— 管理端路由（marketing::salesman_order）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanOrderController`
//! （`@RequestMapping("/adminapi/salesman/order")`，3 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/salesman/order/list` | `list` |
//! | `POST` | `/salesman/order/batch` | `batch` |
//! | `POST` | `/salesman/order/settlement` | `settlement` |
//!
//! # 权限
//! `list` 仅登录；`batch` 需 `salesmanOrderBatch`、`settlement` 需
//! `salesmanSettlementManage`（Rust 全局只校验登录态）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::marketing::salesman_order::{
    BatchDTO, SalesmanOrderListQuery, SalesmanOrderSettlementDTO, SalesmanOrderVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条管理端路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "GET",
        "/salesman/order/list",
        "SalesmanOrderController.list",
    ),
    (
        "POST",
        "/salesman/order/batch",
        "SalesmanOrderController.batch",
    ),
    (
        "POST",
        "/salesman/order/settlement",
        "SalesmanOrderController.settlement",
    ),
];

/// 业绩订单管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/order/list", get(list))
        .route("/salesman/order/batch", post(batch))
        .route("/salesman/order/settlement", post(settlement))
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

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanOrderListQuery>,
) -> ApiResult<PageResult<SalesmanOrderVO>> {
    ok(state.marketing.salesman_order.list(&q).await?)
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.salesman_order.batch(&dto).await?;
    ok(())
}

async fn settlement(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanOrderSettlementDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_order.settlement(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 3);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/order/list",
                "/salesman/order/batch",
                "/salesman/order/settlement",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/order/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
        // settlement 必须是 POST（Java `@PostMapping`）
        assert_eq!(
            ROUTE_TABLE
                .iter()
                .find(|(_, p, _)| *p == "/salesman/order/settlement")
                .map(|(m, _, _)| *m),
            Some("POST")
        );
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/salesman/order/"));
            assert!(d.java_ref.starts_with("SalesmanOrderController."));
        }
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[1].method, "POST");
    }

    #[test]
    fn queries_and_bodies_parse_camel_case() {
        let q: SalesmanOrderListQuery = serde_json::from_str(
            r#"{"orderSn":"SN1","status":0,"timeType":1,"orderTimeStart":"2023-11-01","size":20}"#,
        )
        .unwrap();
        assert_eq!(q.status, Some(0));
        assert_eq!(q.time_type, Some(1));
        assert_eq!(q.page_size, Some(20));
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1],"type":"del"}"#).unwrap();
        assert_eq!(b.r#type.as_deref(), Some("del"));
    }
}
