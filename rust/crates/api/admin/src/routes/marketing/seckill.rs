//! 管理端秒杀路由。
//! 对应原 Java `controller.promotion.SeckillController`
//! （`@RequestMapping("/adminapi/promotion/seckill")`）。
//!
//! | 本模块路由 | 原 Java |
//! |-----------|--------|
//! | `GET  /promotion/seckill/list` | `SeckillController.list` |
//! | `GET  /promotion/seckill/detail` | `SeckillController.detail` |
//! | `POST /promotion/seckill/create` | `SeckillController.create` |
//! | `POST /promotion/seckill/update` | `SeckillController.update` |
//! | `POST /promotion/seckill/del` | `SeckillController.del` |
//!
//! 未迁移：`batch`（批量上下架，依赖活动状态字段扩展）、
//! `listForDecorate` / `listForHomePreview`（装修域组件，依赖 `decorate` 域）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::seckill::{
    SeckillCreateDTO, SeckillListQuery, SeckillUpdateDTO, SeckillVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 秒杀域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/seckill/list", get(list))
        .route("/promotion/seckill/detail", get(detail))
        .route("/promotion/seckill/create", post(create))
        .route("/promotion/seckill/update", post(update))
        .route("/promotion/seckill/del", post(del))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/promotion/seckill/list",
            "SeckillController.list",
        ),
        (
            "GET",
            "/adminapi/promotion/seckill/detail",
            "SeckillController.detail",
        ),
        (
            "POST",
            "/adminapi/promotion/seckill/create",
            "SeckillController.create",
        ),
        (
            "POST",
            "/adminapi/promotion/seckill/update",
            "SeckillController.update",
        ),
        (
            "POST",
            "/adminapi/promotion/seckill/del",
            "SeckillController.del",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/promotion/seckill/list`：秒杀活动分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SeckillListQuery>,
) -> ApiResult<PageResult<SeckillVO>> {
    ok(state.marketing.seckill.list(&q).await?)
}

/// `GET /adminapi/promotion/seckill/detail?id=`：秒杀活动详情。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

async fn detail(State(state): State<AdminState>, Query(q): Query<IdQuery>) -> ApiResult<SeckillVO> {
    ok(state.marketing.seckill.detail(q.id).await?)
}

/// `POST /adminapi/promotion/seckill/create`：创建秒杀活动。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SeckillCreateDTO>,
) -> ApiResult<i32> {
    ok(state.marketing.seckill.create(&dto).await?)
}

/// `POST /adminapi/promotion/seckill/update`：更新秒杀活动。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SeckillUpdateDTO>,
) -> ApiResult<&'static str> {
    state.marketing.seckill.update(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/promotion/seckill/del`：删除秒杀活动。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DelDTO {
    #[serde(alias = "id")]
    seckill_id: i32,
}

async fn del(State(state): State<AdminState>, Json(dto): Json<DelDTO>) -> ApiResult<&'static str> {
    state.marketing.seckill.delete(dto.seckill_id).await?;
    ok("删除成功")
}
