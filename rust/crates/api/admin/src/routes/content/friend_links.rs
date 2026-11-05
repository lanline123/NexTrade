//! 管理端友情链接路由（content::friend_links）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.FriendLinksController`
//! （`@RequestMapping("/adminapi/setting/friendLinks")`，7 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |----------------------------------|---------|------|
//! | `GET  /setting/friendLinks/list`        | `FriendLinksController.list`        | `friendLinksManage` |
//! | `GET  /setting/friendLinks/detail`      | `FriendLinksController.detail`      | `friendLinksManage` |
//! | `POST /setting/friendLinks/create`      | `FriendLinksController.create`      | `friendLinksUpdateManage` |
//! | `POST /setting/friendLinks/update`      | `FriendLinksController.update`      | `friendLinksUpdateManage` |
//! | `POST /setting/friendLinks/del`         | `FriendLinksController.del`         | `friendLinksDelManage` |
//! | `POST /setting/friendLinks/updateField` | `FriendLinksController.updateField` | `friendLinksUpdateManage` |
//! | `POST /setting/friendLinks/batch`       | `FriendLinksController.batch`       | `friendLinksBatchManage` |
//!
//! 权限说明：Rust `/adminapi` 只统一挂 `require_auth`，权限矩阵未实现（已知缺口）。
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::friend_links::{
    BatchDTO, FriendLinksCreateDTO, FriendLinksIdDTO, FriendLinksListQuery, FriendLinksUpdateDTO,
    FriendLinksVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/setting/friendLinks/list",
        "FriendLinksController.list",
    ),
    (
        "GET",
        "/setting/friendLinks/detail",
        "FriendLinksController.detail",
    ),
    (
        "POST",
        "/setting/friendLinks/create",
        "FriendLinksController.create",
    ),
    (
        "POST",
        "/setting/friendLinks/update",
        "FriendLinksController.update",
    ),
    (
        "POST",
        "/setting/friendLinks/del",
        "FriendLinksController.del",
    ),
    (
        "POST",
        "/setting/friendLinks/updateField",
        "FriendLinksController.updateField",
    ),
    (
        "POST",
        "/setting/friendLinks/batch",
        "FriendLinksController.batch",
    ),
];

/// 友情链接路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/friendLinks/list", get(list))
        .route("/setting/friendLinks/detail", get(detail))
        .route("/setting/friendLinks/create", post(create))
        .route("/setting/friendLinks/update", post(update))
        .route("/setting/friendLinks/del", post(del))
        .route("/setting/friendLinks/updateField", post(update_field))
        .route("/setting/friendLinks/batch", post(batch))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

/// `GET /adminapi/setting/friendLinks/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/setting/friendLinks/list`：友情链接分页列表。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<FriendLinksListQuery>,
) -> ApiResult<PageResult<FriendLinksVO>> {
    ok(state.content.friend_links.list(&q).await?)
}

/// `GET /adminapi/setting/friendLinks/detail?id=`：详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<FriendLinksVO> {
    ok(state.content.friend_links.detail(q.id).await?)
}

/// `POST /adminapi/setting/friendLinks/create`：创建友情链接。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<FriendLinksCreateDTO>,
) -> ApiResult<i32> {
    ok(state.content.friend_links.create(&dto).await?)
}

/// `POST /adminapi/setting/friendLinks/update`：更新友情链接。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<FriendLinksUpdateDTO>,
) -> ApiResult<()> {
    state.content.friend_links.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/friendLinks/del`：删除友情链接。
async fn del(State(state): State<AdminState>, Json(dto): Json<FriendLinksIdDTO>) -> ApiResult<()> {
    state.content.friend_links.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/friendLinks/updateField`：更新单字段。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.content.friend_links.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/friendLinks/batch`：批量操作。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.content.friend_links.batch(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("GET", "/adminapi/setting/friendLinks/list"),
            ("GET", "/adminapi/setting/friendLinks/detail"),
            ("POST", "/adminapi/setting/friendLinks/create"),
            ("POST", "/adminapi/setting/friendLinks/update"),
            ("POST", "/adminapi/setting/friendLinks/del"),
            ("POST", "/adminapi/setting/friendLinks/updateField"),
            ("POST", "/adminapi/setting/friendLinks/batch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/setting/friendLinks/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }
}
