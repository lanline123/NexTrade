//! 管理端积分商品路由（marketing::points_exchange）。
//! Java `PointsExchangeController`：`/adminapi/promotion/pointsExchange/{list,detail,create,update,del,updateField,batch}`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::points_exchange::{
    BatchDTO, OperateDTO, PointsExchangeCreateDTO, PointsExchangeListQuery,
    PointsExchangeUpdateDTO, PointsExchangeVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/promotion/pointsExchange/list",
        "PointsExchangeController.list",
    ),
    (
        "GET",
        "/promotion/pointsExchange/detail",
        "PointsExchangeController.detail",
    ),
    (
        "POST",
        "/promotion/pointsExchange/create",
        "PointsExchangeController.create",
    ),
    (
        "POST",
        "/promotion/pointsExchange/update",
        "PointsExchangeController.update",
    ),
    (
        "POST",
        "/promotion/pointsExchange/del",
        "PointsExchangeController.del",
    ),
    (
        "POST",
        "/promotion/pointsExchange/updateField",
        "PointsExchangeController.updateField",
    ),
    (
        "POST",
        "/promotion/pointsExchange/batch",
        "PointsExchangeController.batch",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/pointsExchange/list", get(list))
        .route("/promotion/pointsExchange/detail", get(detail))
        .route("/promotion/pointsExchange/create", post(create))
        .route("/promotion/pointsExchange/update", post(update))
        .route("/promotion/pointsExchange/del", post(del))
        .route("/promotion/pointsExchange/updateField", post(update_field))
        .route("/promotion/pointsExchange/batch", post(batch))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<PointsExchangeListQuery>,
) -> ApiResult<PageResult<PointsExchangeVO>> {
    ok(state.marketing.points_exchange.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<PointsExchangeVO> {
    ok(state.marketing.points_exchange.detail(q.id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<PointsExchangeCreateDTO>,
) -> ApiResult<()> {
    let _id = state.marketing.points_exchange.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<PointsExchangeUpdateDTO>,
) -> ApiResult<()> {
    state.marketing.points_exchange.update(&dto).await?;
    ok(())
}

async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.points_exchange.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.points_exchange.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.points_exchange.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for (m, p) in [
            ("GET", "/adminapi/promotion/pointsExchange/list"),
            ("GET", "/adminapi/promotion/pointsExchange/detail"),
            ("POST", "/adminapi/promotion/pointsExchange/create"),
            ("POST", "/adminapi/promotion/pointsExchange/update"),
            ("POST", "/adminapi/promotion/pointsExchange/del"),
            ("POST", "/adminapi/promotion/pointsExchange/updateField"),
            ("POST", "/adminapi/promotion/pointsExchange/batch"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        assert!(ROUTE_TABLE
            .iter()
            .all(|(_, p, _)| p.starts_with("/promotion/pointsExchange/")));
    }
}
