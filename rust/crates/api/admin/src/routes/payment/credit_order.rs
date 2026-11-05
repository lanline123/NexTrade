//! 管理端账期订单路由（payment::credit_order，1 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.finance.CreditOrderController`
//! （`@RequestMapping("/adminapi/credit/order")`）：`GET /list`。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};
use tigshop_services::payment::credit_order::{CreditOrderListQuery, CreditOrderVO};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 1] =
    [("GET", "/credit/order/list", "CreditOrderController.list")];

/// 账期订单路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/credit/order/list", get(list))
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
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<CreditOrderListQuery>,
) -> ApiResult<PageResult<CreditOrderVO>> {
    ok(state
        .payment
        .credit_order
        .list(&q, auth.scoped_shop_id())
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/credit/order/list");
        assert_eq!(docs[0].java_ref, "CreditOrderController.list");
    }

    #[test]
    fn route_table_slice_is_exact() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].1, "/credit/order/list");
    }
}
#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_scope_is_trusted() {
        use tigshop_core::Error;
        let shop = AuthUser::new(1, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop.scoped_shop_id(), Some(7));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
        let admin = AuthUser::new(2, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(admin.scoped_shop_id(), None);
    }
}
