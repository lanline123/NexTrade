//! 语言关联路由（lang::locales_relation）。
//!
//! Java 来源（overseas）：
//! `com.tigshop.adminapi.controller.lang.LocalesRelationController`
//! （`@RequestMapping("/adminapi/lang/localesRelation")`）：
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/lang/localesRelation/list` | `LocalesRelationController.list` |
//! | `GET`  | `/lang/localesRelation/detail` | `LocalesRelationController.detail` |
//! | `POST` | `/lang/localesRelation/updateField` | `LocalesRelationController.update`（5.8.57 前端改名，见注） |
//! | `POST` | `/lang/localesRelation/del` | `LocalesRelationController.del` |
//! | `POST` | `/lang/localesRelation/batch` | `LocalesRelationController.batch` |
//! | `GET`  | `/lang/localesRelation/config` | `LocalesRelationController.config`（`locales_lang` 全表） |
//!
//! > `updateField` 无 Java 对应（Java 只有 `update` 全量改）；5.8.57 前端
//! > 以 `updateField` 语义提交，按 `LocalesRelationDTO` 全量更新实现。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::lang::common::{BatchDTO, OperateDTO};
use tigshop_core::models::lang::locales_relation::{
    LocalesLangVO, LocalesRelationDTO, LocalesRelationVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由表（相对路径，不含 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/lang/localesRelation/list",
        "LocalesRelationController.list",
    ),
    (
        "GET",
        "/lang/localesRelation/detail",
        "LocalesRelationController.detail",
    ),
    (
        "POST",
        "/lang/localesRelation/create",
        "LocalesRelationController.create",
    ),
    (
        "POST",
        "/lang/localesRelation/updateField",
        "LocalesRelationController.update",
    ),
    (
        "POST",
        "/lang/localesRelation/del",
        "LocalesRelationController.del",
    ),
    (
        "POST",
        "/lang/localesRelation/batch",
        "LocalesRelationController.batch",
    ),
    (
        "GET",
        "/lang/localesRelation/config",
        "LocalesRelationController.config",
    ),
];

/// 语言关联路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/lang/localesRelation/list", get(list))
        .route("/lang/localesRelation/detail", get(detail))
        .route("/lang/localesRelation/create", post(create))
        .route("/lang/localesRelation/update", post(update_field))
        .route("/lang/localesRelation/updateField", post(update_field))
        .route("/lang/localesRelation/del", post(del))
        .route("/lang/localesRelation/batch", post(batch))
        .route("/lang/localesRelation/config", get(config))
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// `?id=` 查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/lang/localesRelation/list`：语言关联分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<PageQueryForm>,
) -> ApiResult<PageResult<LocalesRelationVO>> {
    ok(state.lang.locales_relation().list(q.page, q.size).await?)
}

/// `GET /adminapi/lang/localesRelation/detail?id=`：语言关联详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<LocalesRelationVO>> {
    ok(state.lang.locales_relation().detail(q.id).await?)
}

/// `POST /adminapi/lang/localesRelation/create`：新增语言关联。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<LocalesRelationDTO>,
) -> ApiResult<()> {
    state.lang.locales_relation().create(&dto).await?;
    ok(())
}

/// `POST /adminapi/lang/localesRelation/updateField`：修改（全量）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<LocalesRelationDTO>,
) -> ApiResult<bool> {
    ok(state.lang.locales_relation().update(&dto).await?)
}

/// `POST /adminapi/lang/localesRelation/del`：删除。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.lang.locales_relation().del(&dto).await?)
}

/// `POST /adminapi/lang/localesRelation/batch`：批量操作（`type=del`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.lang.locales_relation().batch(&dto).await?)
}

/// `GET /adminapi/lang/localesRelation/config`：语言关联配置
/// （Java：`locales_lang` 全表直出）。
async fn config(State(state): State<AdminState>) -> ApiResult<Vec<LocalesLangVO>> {
    ok(state.lang.locales_relation().config().await?)
}

/// 分页 query（Java `BasePage`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PageQueryForm {
    page: Option<u64>,
    size: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_frontend_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        assert_eq!(docs[0].path, "/adminapi/lang/localesRelation/list");
        assert!(docs
            .iter()
            .any(|d| d.path == "/adminapi/lang/localesRelation/config"));
    }
}
