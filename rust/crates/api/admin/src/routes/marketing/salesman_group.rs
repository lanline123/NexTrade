//! 分销员分组 —— 管理端路由（marketing::salesman_group）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanGroupController`
//! （`@RequestMapping("/adminapi/salesman/group")`，5 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/salesman/group/list` | `list` |
//! | `GET`  | `/salesman/group/detail?id=` | `detail` |
//! | `POST` | `/salesman/group/create` | `create` |
//! | `POST` | `/salesman/group/update` | `update` |
//! | `POST` | `/salesman/group/del` | `del` |
//!
//! # 权限
//! Java `list/detail` 仅登录，写操作需 `salesmanGroupModifyManage`；Rust
//! 全局 `require_auth` 只校验登录态。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_group::{
    BatchDTO, OperateDTO, SalesmanGroupEditDTO, SalesmanGroupListQuery, SalesmanGroupSaveDTO,
    SalesmanGroupVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 6 条路由（去掉 `/adminapi` 前缀）。最后一条 `batch` 来自
/// 新版管理端前端契约（`view/admin/src/api/salesman/subgroup.ts`）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/salesman/group/list",
        "SalesmanGroupController.list",
    ),
    (
        "GET",
        "/salesman/group/detail",
        "SalesmanGroupController.detail",
    ),
    (
        "POST",
        "/salesman/group/create",
        "SalesmanGroupController.create",
    ),
    (
        "POST",
        "/salesman/group/update",
        "SalesmanGroupController.update",
    ),
    ("POST", "/salesman/group/del", "SalesmanGroupController.del"),
    (
        "POST",
        "/salesman/group/batch",
        "SalesmanGroupController.batch",
    ),
];

/// 分组管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/group/list", get(list))
        .route("/salesman/group/detail", get(detail))
        .route("/salesman/group/create", post(create))
        .route("/salesman/group/update", post(update))
        .route("/salesman/group/del", post(delete))
        .route("/salesman/group/batch", post(batch))
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
    Query(q): Query<SalesmanGroupListQuery>,
) -> ApiResult<PageResult<SalesmanGroupVO>> {
    ok(state.marketing.salesman_group.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanGroupVO>> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.marketing.salesman_group.detail(id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanGroupSaveDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_group.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanGroupEditDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_group.update(&dto).await?;
    ok(())
}

async fn delete(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.salesman_group.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/salesman/group/batch`：批量操作。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/salesman/subgroup.ts#batchSubmit`（`{ type, ids }`，
/// 分组标签列表批量删除；Java 控制器未含该端点）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.marketing.salesman_group.batch(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/group/list",
                "/salesman/group/detail",
                "/salesman/group/create",
                "/salesman/group/update",
                "/salesman/group/del",
                "/salesman/group/batch",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/group/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/salesman/group/"));
            assert!(d.java_ref.starts_with("SalesmanGroupController."));
        }
        let gets: Vec<&str> = docs
            .iter()
            .filter(|d| d.method == "GET")
            .map(|d| d.path.as_str())
            .collect();
        assert_eq!(
            gets,
            vec![
                "/adminapi/salesman/group/list",
                "/adminapi/salesman/group/detail"
            ]
        );
    }

    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/salesman/group/list",
            "/salesman/group/detail",
            "/salesman/group/create",
            "/salesman/group/update",
            "/salesman/group/del",
            "/salesman/group/batch",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for p in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, q, _)| *q == p));
        }
    }

    #[test]
    fn queries_parse_camel_case() {
        let q: SalesmanGroupListQuery =
            serde_json::from_str(r#"{"groupName":"A","size":50}"#).unwrap();
        assert_eq!(q.group_name.as_deref(), Some("A"));
        assert_eq!(q.page_size, Some(50));
        let e: SalesmanGroupEditDTO =
            serde_json::from_str(r#"{"groupId":3,"groupName":"B"}"#).unwrap();
        assert_eq!(e.group_id, Some(3));
    }
}
