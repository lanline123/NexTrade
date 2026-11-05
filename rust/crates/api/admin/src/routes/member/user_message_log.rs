//! 管理端会员消息管理路由（member::user_message_log）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.UserMessageLogController`
//! （`@RequestMapping("/adminapi/user/userMessageLog")`，5 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |----------------------------------|---------|------|
//! | `GET  /user/userMessageLog/list`   | `UserMessageLogController.list`   | `messageLogManage` |
//! | `POST /user/userMessageLog/create` | `UserMessageLogController.create` | `userMessageLogModifyManage` |
//! | `POST /user/userMessageLog/del`    | `UserMessageLogController.del`    | `userMessageLogModifyManage` |
//! | `POST /user/userMessageLog/batch`  | `UserMessageLogController.batch`  | `userMessageLogModifyManage` |
//! | `POST /user/userMessageLog/recall` | `UserMessageLogController.recall` | `userMessageLogModifyManage` |
//!
//! ## 权限
//! Java 类级 `@PreAuthorize("@pms.hasPermission('messageLogManage')")`；Rust 侧
//! `/adminapi` 只统一挂 `require_auth`，权限矩阵未实现（已知缺口）。
//!
//! ## 合并注意
//! 必须并入 `crates/api/admin/src/routes/member/mod.rs` 的 `routes()` 与
//! `implemented_routes()`（外层已套 `require_auth`）。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::member::user_message_log::{
    BatchDTO, UserMessageLogCreateDTO, UserMessageLogListQuery, UserMessageLogPageVO,
    UserMessageLogRecallParam,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/user/userMessageLog/list",
        "UserMessageLogController.list",
    ),
    (
        "POST",
        "/user/userMessageLog/create",
        "UserMessageLogController.create",
    ),
    (
        "POST",
        "/user/userMessageLog/del",
        "UserMessageLogController.del",
    ),
    (
        "POST",
        "/user/userMessageLog/batch",
        "UserMessageLogController.batch",
    ),
    (
        "POST",
        "/user/userMessageLog/recall",
        "UserMessageLogController.recall",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/userMessageLog/list", get(list))
        .route("/user/userMessageLog/create", post(create))
        .route("/user/userMessageLog/del", post(del))
        .route("/user/userMessageLog/batch", post(batch))
        .route("/user/userMessageLog/recall", post(recall))
        .layer(axum::middleware::from_fn(platform_only))
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

/// `GET /adminapi/user/userMessageLog/list`：会员消息列表。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<UserMessageLogListQuery>,
) -> ApiResult<PageResult<UserMessageLogPageVO>> {
    ok(state.member.user_message_log.list(&q).await?)
}

/// `POST /adminapi/user/userMessageLog/create`：创建会员消息。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<UserMessageLogCreateDTO>,
) -> ApiResult<i32> {
    ok(state.member.user_message_log.create(&dto).await?)
}

/// `POST /adminapi/user/userMessageLog/del`：删除会员消息。
async fn del(
    State(state): State<AdminState>,
    Json(param): Json<UserMessageLogRecallParam>,
) -> ApiResult<()> {
    state.member.user_message_log.delete(&param).await?;
    ok(())
}

/// `POST /adminapi/user/userMessageLog/batch`：批量操作。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.member.user_message_log.batch(&dto).await?)
}

/// `POST /adminapi/user/userMessageLog/recall`：撤回。
async fn recall(
    State(state): State<AdminState>,
    Json(param): Json<UserMessageLogRecallParam>,
) -> ApiResult<()> {
    state.member.user_message_log.recall(&param).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            ("GET", "/adminapi/user/userMessageLog/list"),
            ("POST", "/adminapi/user/userMessageLog/create"),
            ("POST", "/adminapi/user/userMessageLog/del"),
            ("POST", "/adminapi/user/userMessageLog/batch"),
            ("POST", "/adminapi/user/userMessageLog/recall"),
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
        assert_eq!(ROUTE_TABLE.len(), 5);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/user/userMessageLog/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_scope_is_empty_for_platform_only_domain() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(admin.scoped_shop_id(), None);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(!shop.is_platform());
        assert_eq!(shop.scoped_shop_id(), Some(7));
    }

    #[test]
    fn platform_only_helper_rejects_shop_identity() {
        assert!(require_platform(&AuthUser::new(
            1,
            "a".into(),
            None,
            Some("admin".into()),
            Some(0)
        ))
        .is_ok());
        assert!(require_platform(&AuthUser::new(
            2,
            "s".into(),
            None,
            Some("shop".into()),
            Some(7)
        ))
        .is_err());
    }
}
