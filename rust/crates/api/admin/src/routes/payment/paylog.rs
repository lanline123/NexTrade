//! 管理端支付日志路由。
//! 对应原 Java `controller.finance.PaylogController`
//! （`@RequestMapping("/adminapi/finance/payLog")`）。
//!
//! | 本模块路由 | 原 Java |
//! |-----------|--------|
//! | `GET  /finance/payLog/list` | `PaylogController.list` |
//! | `GET  /finance/payLog/detail` | `PaylogController.detail` |
//! | `POST /finance/payLog/create` | `PaylogController.create` |
//! | `POST /finance/payLog/update` | `PaylogController.update` |
//!
//! 未迁移：`del` / `batch` / `updateField`（支付日志为审计数据，
//! 原系统亦仅允许受限修改；删除能力待确认业务需求后再补）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::paylog::{
    PaylogCreateDTO, PaylogListQuery, PaylogUpdateDTO, PaylogVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 支付日志域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/payLog/list", get(list))
        .route("/finance/payLog/detail", get(detail))
        .route("/finance/payLog/create", post(create))
        .route("/finance/payLog/update", post(update))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/finance/payLog/list",
            "PaylogController.list",
        ),
        (
            "GET",
            "/adminapi/finance/payLog/detail",
            "PaylogController.detail",
        ),
        (
            "POST",
            "/adminapi/finance/payLog/create",
            "PaylogController.create",
        ),
        (
            "POST",
            "/adminapi/finance/payLog/update",
            "PaylogController.update",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/finance/payLog/list`：支付日志分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<PaylogListQuery>,
) -> ApiResult<PageResult<PaylogVO>> {
    ok(state.payment.paylog.list(&q).await?)
}

/// `GET /adminapi/finance/payLog/detail?id=`：支付日志详情。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

async fn detail(State(state): State<AdminState>, Query(q): Query<IdQuery>) -> ApiResult<PaylogVO> {
    ok(state.payment.paylog.detail(q.id).await?)
}

/// `POST /adminapi/finance/payLog/create`：手工补录支付日志。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<PaylogCreateDTO>,
) -> ApiResult<i32> {
    ok(state.payment.paylog.create(&dto).await?)
}

/// `POST /adminapi/finance/payLog/update`：更新支付日志状态。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<PaylogUpdateDTO>,
) -> ApiResult<&'static str> {
    state.payment.paylog.update(&dto).await?;
    ok("更新成功")
}
