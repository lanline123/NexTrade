//! 语言地区维护路由（lang::locales）。
//!
//! Java 来源（overseas）：
//! `com.tigshop.adminapi.controller.lang.LocalesController`
//! （`@RequestMapping("/adminapi/lang/locales")`）：
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/lang/locales/list` | `LocalesController.list` |
//! | `GET`  | `/lang/locales/detail` | `LocalesController.detail` |
//! | `POST` | `/lang/locales/updateField` | `LocalesController.updateField` |
//! | `POST` | `/lang/locales/del` | `LocalesController.del` |
//! | `POST` | `/lang/locales/batch` | `LocalesController.batch` |
//!
//! > `create` / `update` 前端清单未要求（Java 有），暂不注册；
//! > 服务层已备好（`create` / `update`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::lang::common::{BatchDTO, OperateDTO, UpdateFieldDTO};
use tigshop_core::models::lang::locales::{LocalesDTO, LocalesListQuery, LocalesVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由表（相对路径，不含 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/lang/locales/list", "LocalesController.list"),
    ("GET", "/lang/locales/detail", "LocalesController.detail"),
    ("POST", "/lang/locales/create", "LocalesController.create"),
    (
        "POST",
        "/lang/locales/updateField",
        "LocalesController.updateField",
    ),
    ("POST", "/lang/locales/del", "LocalesController.del"),
    ("POST", "/lang/locales/batch", "LocalesController.batch"),
];

/// 语言地区路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/lang/locales/list", get(list))
        .route("/lang/locales/detail", get(detail))
        .route("/lang/locales/create", post(create))
        .route("/lang/locales/update", post(update))
        .route("/lang/locales/updateField", post(update_field))
        .route("/lang/locales/del", post(del))
        .route("/lang/locales/batch", post(batch))
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

/// `GET /adminapi/lang/locales/list`：语言地区分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<LocalesListQuery>,
) -> ApiResult<PageResult<LocalesVO>> {
    ok(state.lang.locales().list(&q).await?)
}

/// `GET /adminapi/lang/locales/detail?id=`：语言详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<LocalesVO>> {
    ok(state.lang.locales().detail(q.id).await?)
}

/// `POST /adminapi/lang/locales/create`：新增语言。
async fn create(State(state): State<AdminState>, Json(dto): Json<LocalesDTO>) -> ApiResult<()> {
    state.lang.locales().create(&dto).await?;
    ok(())
}

/// `POST /adminapi/lang/locales/updateField`：修改字段（`isDefault` 联动）。
async fn update(State(state): State<AdminState>, Json(dto): Json<LocalesDTO>) -> ApiResult<bool> {
    ok(state.lang.locales().update(&dto).await?)
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.lang.locales().update_field(&dto).await?)
}

/// `POST /adminapi/lang/locales/del`：删除语言。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.lang.locales().del(&dto).await?)
}

/// `POST /adminapi/lang/locales/batch`：批量操作（`type=del`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.lang.locales().batch(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_frontend_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        assert_eq!(docs[0].path, "/adminapi/lang/locales/list");
        assert_eq!(docs[0].method, "GET");
        assert!(docs
            .iter()
            .any(|d| d.path == "/adminapi/lang/locales/updateField"));
    }
}
