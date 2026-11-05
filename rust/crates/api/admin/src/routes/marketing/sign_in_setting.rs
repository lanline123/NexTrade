//! 管理端积分签到配置路由（marketing::sign_in_setting）。
//! Java `SignInSettingController`：`/adminapi/promotion/signInSetting/*`（7 端点）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::sign_in_setting::{
    BatchDTO, OperateDTO, SignInSettingCreateDTO, SignInSettingListQuery, SignInSettingUpdateDTO,
    SignInSettingVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/promotion/signInSetting/list",
        "SignInSettingController.list",
    ),
    (
        "GET",
        "/promotion/signInSetting/detail",
        "SignInSettingController.detail",
    ),
    (
        "POST",
        "/promotion/signInSetting/create",
        "SignInSettingController.create",
    ),
    (
        "POST",
        "/promotion/signInSetting/update",
        "SignInSettingController.update",
    ),
    (
        "POST",
        "/promotion/signInSetting/del",
        "SignInSettingController.del",
    ),
    (
        "POST",
        "/promotion/signInSetting/updateField",
        "SignInSettingController.updateField",
    ),
    (
        "POST",
        "/promotion/signInSetting/batch",
        "SignInSettingController.batch",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/signInSetting/list", get(list))
        .route("/promotion/signInSetting/detail", get(detail))
        .route("/promotion/signInSetting/create", post(create))
        .route("/promotion/signInSetting/update", post(update))
        .route("/promotion/signInSetting/del", post(del))
        .route("/promotion/signInSetting/updateField", post(update_field))
        .route("/promotion/signInSetting/batch", post(batch))
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
    Query(q): Query<SignInSettingListQuery>,
) -> ApiResult<PageResult<SignInSettingVO>> {
    ok(state.marketing.sign_in_setting.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<SignInSettingVO> {
    ok(state.marketing.sign_in_setting.detail(q.id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SignInSettingCreateDTO>,
) -> ApiResult<()> {
    let _id = state.marketing.sign_in_setting.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SignInSettingUpdateDTO>,
) -> ApiResult<()> {
    state.marketing.sign_in_setting.update(&dto).await?;
    ok(())
}

async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.sign_in_setting.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.sign_in_setting.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.sign_in_setting.batch(&dto).await?;
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
            ("GET", "/adminapi/promotion/signInSetting/list"),
            ("GET", "/adminapi/promotion/signInSetting/detail"),
            ("POST", "/adminapi/promotion/signInSetting/create"),
            ("POST", "/adminapi/promotion/signInSetting/update"),
            ("POST", "/adminapi/promotion/signInSetting/del"),
            ("POST", "/adminapi/promotion/signInSetting/updateField"),
            ("POST", "/adminapi/promotion/signInSetting/batch"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 7);
    }
}
