//! 管理端账户总览路由（payment::account_panel，1 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.finance.AccountPanelController`
//! （`@RequestMapping("/adminapi/finance/accountPanel")`）：
//! `GET /list`。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;
use tigshop_services::payment::account_panel::{AccountPanelQuery, AccountPanelVO};

const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/finance/accountPanel/list",
    "AccountPanelController.list",
)];

/// 账户总览路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/accountPanel/list", get(list))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<AccountPanelQuery>,
) -> ApiResult<AccountPanelVO> {
    ok(state.payment.account_panel.list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/finance/accountPanel/list");
        assert_eq!(docs[0].java_ref, "AccountPanelController.list");
    }

    #[test]
    fn route_table_slice_is_exact() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].1, "/finance/accountPanel/list");
    }
}
