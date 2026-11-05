//! 管理端限时折扣路由。
//! 对应原 Java `controller.promotion.TimeDiscountController`
//! （`@RequestMapping("/adminapi/promotion/timeDiscount")`）。
//!
//! | 本模块路由 | 原 Java |
//! |-----------|--------|
//! | `GET  /promotion/timeDiscount/list` | `TimeDiscountController.list` |
//! | `GET  /promotion/timeDiscount/detail` | `TimeDiscountController.detail` |
//! | `POST /promotion/timeDiscount/create` | `TimeDiscountController.create` |
//! | `POST /promotion/timeDiscount/update` | `TimeDiscountController.update` |
//! | `POST /promotion/timeDiscount/del` | `TimeDiscountController.del` |
//!
//! 未迁移：`batch`（批量操作，依赖活动上下架状态字段扩展）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::time_discount::{
    TimeDiscountCreateDTO, TimeDiscountDetailVO, TimeDiscountListQuery, TimeDiscountUpdateDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 限时折扣域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/timeDiscount/list", get(list))
        .route("/promotion/timeDiscount/detail", get(detail))
        .route("/promotion/timeDiscount/create", post(create))
        .route("/promotion/timeDiscount/update", post(update))
        .route("/promotion/timeDiscount/del", post(del))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/promotion/timeDiscount/list",
            "TimeDiscountController.list",
        ),
        (
            "GET",
            "/adminapi/promotion/timeDiscount/detail",
            "TimeDiscountController.detail",
        ),
        (
            "POST",
            "/adminapi/promotion/timeDiscount/create",
            "TimeDiscountController.create",
        ),
        (
            "POST",
            "/adminapi/promotion/timeDiscount/update",
            "TimeDiscountController.update",
        ),
        (
            "POST",
            "/adminapi/promotion/timeDiscount/del",
            "TimeDiscountController.del",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/promotion/timeDiscount/list`：活动分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<TimeDiscountListQuery>,
) -> ApiResult<PageResult<TimeDiscountDetailVO>> {
    ok(state.marketing.time_discount.list(&q).await?)
}

/// `GET /adminapi/promotion/timeDiscount/detail?id=`：活动详情。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<TimeDiscountDetailVO> {
    ok(state.marketing.time_discount.detail(q.id).await?)
}

/// `POST /adminapi/promotion/timeDiscount/create`：创建活动。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<TimeDiscountCreateDTO>,
) -> ApiResult<i32> {
    ok(state.marketing.time_discount.create(&dto).await?)
}

/// `POST /adminapi/promotion/timeDiscount/update`：更新活动。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<TimeDiscountUpdateDTO>,
) -> ApiResult<&'static str> {
    state.marketing.time_discount.update(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/promotion/timeDiscount/del`：删除活动。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DelDTO {
    #[serde(alias = "id")]
    discount_id: i32,
}

async fn del(State(state): State<AdminState>, Json(dto): Json<DelDTO>) -> ApiResult<&'static str> {
    state
        .marketing
        .time_discount
        .delete(dto.discount_id)
        .await?;
    ok("删除成功")
}
