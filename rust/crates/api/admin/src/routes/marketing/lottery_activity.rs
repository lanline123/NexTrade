//! 管理端抽奖活动路由（marketing::lottery_activity）。
//!
//! 原 Java `com.tigshop.adminapi.controller.promotion.LotteryActivityController`
//! （`@RequestMapping("/adminapi/promotion/lotteryActivity")`，8 端点）。
//! 权限矩阵未迁移（只校验登录态）。
use axum::{
    extract::Query,
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::lottery_activity::{
    LotteryActivityIdParam, LotteryActivityListQuery, LotteryActivityListVO, LotteryActivityParam,
    LotteryActivityVO, LotteryUserManageQuery, LotteryUserManageVO, LotteryUserRecordQuery,
    LotteryUserRecordVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 8 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/promotion/lotteryActivity/list",
        "LotteryActivityController.list",
    ),
    (
        "GET",
        "/promotion/lotteryActivity/detail",
        "LotteryActivityController.detail",
    ),
    (
        "POST",
        "/promotion/lotteryActivity/create",
        "LotteryActivityController.create",
    ),
    (
        "POST",
        "/promotion/lotteryActivity/update",
        "LotteryActivityController.update",
    ),
    (
        "POST",
        "/promotion/lotteryActivity/delete",
        "LotteryActivityController.delete",
    ),
    (
        "POST",
        "/promotion/lotteryActivity/end",
        "LotteryActivityController.end",
    ),
    (
        "GET",
        "/promotion/lotteryActivity/userManage",
        "LotteryActivityController.userManage",
    ),
    (
        "GET",
        "/promotion/lotteryActivity/userRecord",
        "LotteryActivityController.userRecord",
    ),
];

/// 抽奖活动管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/lotteryActivity/list", get(list))
        .route("/promotion/lotteryActivity/detail", get(detail))
        .route("/promotion/lotteryActivity/create", post(create))
        .route("/promotion/lotteryActivity/update", post(update))
        .route("/promotion/lotteryActivity/delete", post(delete))
        .route("/promotion/lotteryActivity/end", post(end))
        .route("/promotion/lotteryActivity/userManage", get(user_manage))
        .route("/promotion/lotteryActivity/userRecord", get(user_record))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivityIdQuery {
    activity_id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<LotteryActivityListQuery>,
) -> ApiResult<PageResult<LotteryActivityListVO>> {
    ok(state.marketing.lottery_activity.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<ActivityIdQuery>,
) -> ApiResult<LotteryActivityVO> {
    ok(state
        .marketing
        .lottery_activity
        .detail(q.activity_id)
        .await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(param): Json<LotteryActivityParam>,
) -> ApiResult<i32> {
    ok(state.marketing.lottery_activity.create(&param).await?)
}

async fn update(
    State(state): State<AdminState>,
    Json(param): Json<LotteryActivityParam>,
) -> ApiResult<()> {
    state.marketing.lottery_activity.update(&param).await?;
    ok(())
}

async fn delete(
    State(state): State<AdminState>,
    Json(param): Json<LotteryActivityIdParam>,
) -> ApiResult<()> {
    state.marketing.lottery_activity.delete(&param).await?;
    ok(())
}

async fn end(
    State(state): State<AdminState>,
    Json(param): Json<LotteryActivityIdParam>,
) -> ApiResult<()> {
    state.marketing.lottery_activity.end(&param).await?;
    ok(())
}

async fn user_manage(
    State(state): State<AdminState>,
    Query(q): Query<LotteryUserManageQuery>,
) -> ApiResult<PageResult<LotteryUserManageVO>> {
    ok(state.marketing.lottery_activity.user_manage(&q).await?)
}

async fn user_record(
    State(state): State<AdminState>,
    Query(q): Query<LotteryUserRecordQuery>,
) -> ApiResult<PageResult<LotteryUserRecordVO>> {
    ok(state.marketing.lottery_activity.user_record(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        let expected = [
            ("GET", "/adminapi/promotion/lotteryActivity/list"),
            ("GET", "/adminapi/promotion/lotteryActivity/detail"),
            ("POST", "/adminapi/promotion/lotteryActivity/create"),
            ("POST", "/adminapi/promotion/lotteryActivity/update"),
            ("POST", "/adminapi/promotion/lotteryActivity/delete"),
            ("POST", "/adminapi/promotion/lotteryActivity/end"),
            ("GET", "/adminapi/promotion/lotteryActivity/userManage"),
            ("GET", "/adminapi/promotion/lotteryActivity/userRecord"),
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
    fn route_table_paths_stay_relative() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/adminapi"), "{path}");
            assert!(path.starts_with("/promotion/lotteryActivity/"), "{path}");
        }
    }
}
