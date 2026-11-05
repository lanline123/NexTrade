//! 管理端充值记录路由（payment::user_recharge_order）。
//! 对应原 Java `com.tigshop.adminapi.controller.finance.UserRechargeOrderController`
//! （`@RequestMapping("/adminapi/finance/userRechargeOrder")`，7 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |----------------------------------|---------|------|
//! | `GET  /finance/userRechargeOrder/list` | `list` | jwt |
//! | `GET  /finance/userRechargeOrder/detail` | `detail` | jwt |
//! | `POST /finance/userRechargeOrder/create` | `create` | `userRechargeOrderUpdateManage` |
//! | `POST /finance/userRechargeOrder/update` | `update` | `userRechargeOrderUpdateManage` |
//! | `POST /finance/userRechargeOrder/del` | `del` | `userRechargeOrderDelManage` |
//! | `POST /finance/userRechargeOrder/updateField` | `updateField` | jwt |
//! | `POST /finance/userRechargeOrder/batch` | `batch` | `userRechargeOrderBatchManage` |
//!
//! > 权限矩阵未迁移（Rust 只校验登录态）；`list` 返回项目 `PageResult`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::user_recharge_order::{
    BatchDTO, OperateDTO, UpdateFieldDTO, UserRechargeOrderCreateDTO, UserRechargeOrderListQuery,
    UserRechargeOrderUpdateDTO, UserRechargeOrderVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/finance/userRechargeOrder/list",
        "UserRechargeOrderController.list",
    ),
    (
        "GET",
        "/finance/userRechargeOrder/detail",
        "UserRechargeOrderController.detail",
    ),
    (
        "POST",
        "/finance/userRechargeOrder/create",
        "UserRechargeOrderController.create",
    ),
    (
        "POST",
        "/finance/userRechargeOrder/update",
        "UserRechargeOrderController.update",
    ),
    (
        "POST",
        "/finance/userRechargeOrder/del",
        "UserRechargeOrderController.del",
    ),
    (
        "POST",
        "/finance/userRechargeOrder/updateField",
        "UserRechargeOrderController.updateField",
    ),
    (
        "POST",
        "/finance/userRechargeOrder/batch",
        "UserRechargeOrderController.batch",
    ),
];

/// 充值记录域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/userRechargeOrder/list", get(list))
        .route("/finance/userRechargeOrder/detail", get(detail))
        .route("/finance/userRechargeOrder/create", post(create))
        .route("/finance/userRechargeOrder/update", post(update))
        .route("/finance/userRechargeOrder/del", post(del))
        .route("/finance/userRechargeOrder/updateField", post(update_field))
        .route("/finance/userRechargeOrder/batch", post(batch))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `detail?id=` 查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<UserRechargeOrderListQuery>,
) -> ApiResult<PageResult<UserRechargeOrderVO>> {
    ok(state.payment.user_recharge_order.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<UserRechargeOrderVO> {
    ok(state.payment.user_recharge_order.detail(q.id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<UserRechargeOrderCreateDTO>,
) -> ApiResult<()> {
    let _id = state.payment.user_recharge_order.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<UserRechargeOrderUpdateDTO>,
) -> ApiResult<()> {
    state.payment.user_recharge_order.update(&dto).await?;
    ok(())
}

async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.payment.user_recharge_order.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.payment.user_recharge_order.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.payment.user_recharge_order.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("GET", "/adminapi/finance/userRechargeOrder/list"),
            ("GET", "/adminapi/finance/userRechargeOrder/detail"),
            ("POST", "/adminapi/finance/userRechargeOrder/create"),
            ("POST", "/adminapi/finance/userRechargeOrder/update"),
            ("POST", "/adminapi/finance/userRechargeOrder/del"),
            ("POST", "/adminapi/finance/userRechargeOrder/updateField"),
            ("POST", "/adminapi/finance/userRechargeOrder/batch"),
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
    fn route_table_matches_registrations() {
        let paths = [
            ("GET", "/finance/userRechargeOrder/list"),
            ("GET", "/finance/userRechargeOrder/detail"),
            ("POST", "/finance/userRechargeOrder/create"),
            ("POST", "/finance/userRechargeOrder/update"),
            ("POST", "/finance/userRechargeOrder/del"),
            ("POST", "/finance/userRechargeOrder/updateField"),
            ("POST", "/finance/userRechargeOrder/batch"),
        ];
        assert_eq!(paths.len(), ROUTE_TABLE.len());
        for (m, p) in paths {
            assert!(ROUTE_TABLE.iter().any(|(mm, pp, _)| *mm == m && *pp == p));
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(paths.iter().any(|(_, pp)| pp == p));
        }
    }
}
