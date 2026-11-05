//! 分销客户交易 —— 管理端路由（marketing::salesman_customer_transaction）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanCustomerTransactionController`
//! （`@RequestMapping("/adminapi/salesman/customerTransaction")`，1 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/salesman/customerTransaction/list` | `listCustomerTransaction` |
//!
//! # 权限
//! Java 仅登录（无 `@PreAuthorize`）；Rust 全局 `require_auth` 只校验登录态。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::marketing::salesman_customer_transaction::{
    CustomerTransactionQuery, CustomerTransactionVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 1 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/salesman/customerTransaction/list",
    "SalesmanCustomerTransactionController.listCustomerTransaction",
)];

/// 客户交易管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/salesman/customerTransaction/list", get(list))
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
    Query(q): Query<CustomerTransactionQuery>,
) -> ApiResult<PageResult<CustomerTransactionVO>> {
    ok(state
        .marketing
        .salesman_customer_transaction
        .list(&q)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[0].1, "/salesman/customerTransaction/list");
        assert_eq!(
            ROUTE_TABLE[0].2,
            "SalesmanCustomerTransactionController.listCustomerTransaction"
        );
        assert!(!ROUTE_TABLE[0].1.starts_with("/adminapi"));
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].path, "/adminapi/salesman/customerTransaction/list");
        assert_eq!(docs[0].method, "GET");
        assert!(docs[0]
            .java_ref
            .starts_with("SalesmanCustomerTransactionController."));
    }

    #[test]
    fn query_parses_camel_case() {
        let q: CustomerTransactionQuery =
            serde_json::from_str(r#"{"salesmanId":3,"startTime":"2023-11-01","size":20}"#).unwrap();
        assert_eq!(q.salesman_id, Some(3));
        assert_eq!(q.page_size, Some(20));
    }
}
