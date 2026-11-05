//! 管理端充值余额配置路由（marketing::recharge_setting）。
//! Java `RechargeSettingController`：`/adminapi/promotion/rechargeSetting/*`（7 端点）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::recharge_setting::{
    BatchDTO, OperateDTO, RechargeSettingCreateDTO, RechargeSettingListQuery,
    RechargeSettingUpdateDTO, RechargeSettingVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/promotion/rechargeSetting/list",
        "RechargeSettingController.list",
    ),
    (
        "GET",
        "/promotion/rechargeSetting/detail",
        "RechargeSettingController.detail",
    ),
    (
        "POST",
        "/promotion/rechargeSetting/create",
        "RechargeSettingController.create",
    ),
    (
        "POST",
        "/promotion/rechargeSetting/update",
        "RechargeSettingController.update",
    ),
    (
        "POST",
        "/promotion/rechargeSetting/del",
        "RechargeSettingController.del",
    ),
    (
        "POST",
        "/promotion/rechargeSetting/updateField",
        "RechargeSettingController.updateField",
    ),
    (
        "POST",
        "/promotion/rechargeSetting/batch",
        "RechargeSettingController.batch",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/rechargeSetting/list", get(list))
        .route("/promotion/rechargeSetting/detail", get(detail))
        .route("/promotion/rechargeSetting/create", post(create))
        .route("/promotion/rechargeSetting/update", post(update))
        .route("/promotion/rechargeSetting/del", post(del))
        .route("/promotion/rechargeSetting/updateField", post(update_field))
        .route("/promotion/rechargeSetting/batch", post(batch))
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
    Query(q): Query<RechargeSettingListQuery>,
) -> ApiResult<PageResult<RechargeSettingVO>> {
    ok(state.marketing.recharge_setting.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<RechargeSettingVO> {
    ok(state.marketing.recharge_setting.detail(q.id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<RechargeSettingCreateDTO>,
) -> ApiResult<()> {
    let _id = state.marketing.recharge_setting.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<RechargeSettingUpdateDTO>,
) -> ApiResult<()> {
    state.marketing.recharge_setting.update(&dto).await?;
    ok(())
}

async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.recharge_setting.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.recharge_setting.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.recharge_setting.batch(&dto).await?;
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
            ("GET", "/adminapi/promotion/rechargeSetting/list"),
            ("GET", "/adminapi/promotion/rechargeSetting/detail"),
            ("POST", "/adminapi/promotion/rechargeSetting/create"),
            ("POST", "/adminapi/promotion/rechargeSetting/update"),
            ("POST", "/adminapi/promotion/rechargeSetting/del"),
            ("POST", "/adminapi/promotion/rechargeSetting/updateField"),
            ("POST", "/adminapi/promotion/rechargeSetting/batch"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 7);
    }
}
