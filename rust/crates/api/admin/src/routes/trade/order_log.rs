//! 订单日志 —— 管理端路由（trade::order_log）—— wave9。
//!
//! 原 Java `OrderLogController`（`@RequestMapping("/adminapi/order/orderLog")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 契约 |
//! |-----------------------------------|------|
//! | `GET  /order/orderLog/list` | jwt |
//! | `POST /order/orderLog/create` | jwt+perm（orderLogModifyManage） |
//!
//! > 权限矩阵未实现（仅 `require_auth`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::trade::order_log::{OrderLogCreateDTO, OrderLogListQuery, OrderLogVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};

use crate::AdminState;

/// 本域 2 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/order/orderLog/list", "OrderLogController.list"),
    (
        "POST",
        "/order/orderLog/create",
        "OrderLogController.create",
    ),
];

/// 订单日志路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/order/orderLog/list", get(list))
        .route("/order/orderLog/create", post(create))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// `GET /adminapi/order/orderLog/list`
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<OrderLogListQuery>,
) -> ApiResult<PageResult<OrderLogVO>> {
    // 多租户：店铺账号强制过滤本店日志；平台可见全部。
    ok(state.trade.order_log.list(&q, tenant.shop_scope()).await?)
}

/// `POST /adminapi/order/orderLog/create`
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<OrderLogCreateDTO>,
) -> ApiResult<()> {
    // 多租户：店铺账号的日志只能落本店；平台账号沿用请求体 shopId。
    if let Some(scope) = tenant.shop_scope() {
        dto.shop_id = Some(scope);
    }
    dto.admin_id.get_or_insert(auth.id);
    state.trade.order_log.create(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/adminapi/order/orderLog/list");
        assert_eq!(docs[1].path, "/adminapi/order/orderLog/create");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/adminapi")));
    }

    #[test]
    fn methods_match_java() {
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[1].0, "POST");
    }

    /// 店铺账号的日志范围来自 JWT，请求体 shopId 被覆盖。
    #[test]
    fn log_scope_is_forced_for_shop_account() {
        let shop = TenantContext::new(Some("shop".into()), Some(9), None);
        assert_eq!(shop.shop_scope(), Some(9));
        let platform = TenantContext::new(Some("admin".into()), None, None);
        assert_eq!(platform.shop_scope(), None);
    }
}
