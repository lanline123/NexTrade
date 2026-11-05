//! 分销素材 —— 管理端路由（marketing::salesman_material）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanMaterialController`
//! （`@RequestMapping("/adminapi/salesman/material")`，7 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/salesman/material/list` | `list` |
//! | `GET`  | `/salesman/material/detail?id=` | `detail` |
//! | `POST` | `/salesman/material/create` | `create` |
//! | `POST` | `/salesman/material/update` | `update` |
//! | `POST` | `/salesman/material/del` | `del` |
//! | `POST` | `/salesman/material/updateField` | `updateField` |
//! | `POST` | `/salesman/material/batch` | `batch` |
//!
//! # 权限
//! Java `list/detail` 仅登录；写操作需 `salesmanMaterialModifyManage`
//! （Rust 全局 `require_auth` 只校验登录态）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_material::{
    BatchDTO, OperateDTO, SalesmanMaterialEditDTO, SalesmanMaterialListQuery,
    SalesmanMaterialSaveDTO, SalesmanMaterialVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 7 条管理端路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/salesman/material/list",
        "SalesmanMaterialController.list",
    ),
    (
        "GET",
        "/salesman/material/detail",
        "SalesmanMaterialController.detail",
    ),
    (
        "POST",
        "/salesman/material/create",
        "SalesmanMaterialController.create",
    ),
    (
        "POST",
        "/salesman/material/update",
        "SalesmanMaterialController.update",
    ),
    (
        "POST",
        "/salesman/material/del",
        "SalesmanMaterialController.del",
    ),
    (
        "POST",
        "/salesman/material/updateField",
        "SalesmanMaterialController.updateField",
    ),
    (
        "POST",
        "/salesman/material/batch",
        "SalesmanMaterialController.batch",
    ),
];

/// 素材管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/material/list", get(list))
        .route("/salesman/material/detail", get(detail))
        .route("/salesman/material/create", post(create))
        .route("/salesman/material/update", post(update))
        .route("/salesman/material/del", post(delete))
        .route("/salesman/material/updateField", post(update_field))
        .route("/salesman/material/batch", post(batch))
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanMaterialListQuery>,
) -> ApiResult<PageResult<SalesmanMaterialVO>> {
    ok(state.marketing.salesman_material.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanMaterialVO>> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.marketing.salesman_material.detail(id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanMaterialSaveDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_material.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanMaterialEditDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_material.update(&dto).await?;
    ok(())
}

async fn delete(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.salesman_material.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_material.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.salesman_material.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/material/list",
                "/salesman/material/detail",
                "/salesman/material/create",
                "/salesman/material/update",
                "/salesman/material/del",
                "/salesman/material/updateField",
                "/salesman/material/batch",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/material/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/salesman/material/"));
            assert!(d.java_ref.starts_with("SalesmanMaterialController."));
        }
        assert!(docs
            .iter()
            .any(|d| d.path == "/adminapi/salesman/material/updateField"));
    }

    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/salesman/material/list",
            "/salesman/material/detail",
            "/salesman/material/create",
            "/salesman/material/update",
            "/salesman/material/del",
            "/salesman/material/updateField",
            "/salesman/material/batch",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for p in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, q, _)| *q == p));
        }
    }

    #[test]
    fn queries_parse_camel_case() {
        let q: SalesmanMaterialListQuery =
            serde_json::from_str(r#"{"categoryId":2,"isShow":1,"from":"user","size":20}"#).unwrap();
        assert_eq!(q.category_id, Some(2));
        assert_eq!(q.page_size, Some(20));
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.ids, Some(vec![1, 2]));
    }
}
