//! 管理端用户标签关联路由（member::user_member_tag）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.UserMemberTagController`
//! （`@RequestMapping("/adminapi/user/userMemberTag")`，5 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |----------------------------------|---------|------|
//! | `GET  /user/userMemberTag/listByUser`      | `UserMemberTagController.listByUser`      | `memberTagManage` |
//! | `POST /user/userMemberTag/bindTags`        | `UserMemberTagController.bindTags`        | `memberTagUpdateManage` |
//! | `POST /user/userMemberTag/unbindTags`      | `UserMemberTagController.unbindTags`      | `memberTagUpdateManage` |
//! | `POST /user/userMemberTag/batchBindTags`   | `UserMemberTagController.batchBindTags`   | `memberTagUpdateManage` |
//! | `POST /user/userMemberTag/batchUnbindTags` | `UserMemberTagController.batchUnbindTags` | `memberTagUpdateManage` |
//!
//! ## 权限
//! Java 类级 `@PreAuthorize("@pms.hasPermission('memberTagManage')")` + 方法级
//! `memberTagUpdateManage`；Rust 侧 `/adminapi` 只统一挂 `require_auth`，
//! **权限矩阵尚未实现**（与 member_tag / seller 等同一已知缺口）。
//!
//! ## 多租户
//! Java `HeaderUtils.getShopId()`（`null` → `0`）作为店铺隔离键，由
//! [`current_shop_id`] 从请求头解析：`admin` → 0；`shop`/`pos` → `x-shop-id`；
//! 其它 → 0。
//!
//! ## 合并注意
//! 必须并入 `crates/api/admin/src/routes/member/mod.rs` 的 `routes()` 与
//! `implemented_routes()`（外层已套 `require_auth`）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::user_member_tag::{
    UserMemberTagBatchParam, UserMemberTagParam, UserMemberTagVO,
};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/user/userMemberTag/listByUser",
        "UserMemberTagController.listByUser",
    ),
    (
        "POST",
        "/user/userMemberTag/bindTags",
        "UserMemberTagController.bindTags",
    ),
    (
        "POST",
        "/user/userMemberTag/unbindTags",
        "UserMemberTagController.unbindTags",
    ),
    (
        "POST",
        "/user/userMemberTag/batchBindTags",
        "UserMemberTagController.batchBindTags",
    ),
    (
        "POST",
        "/user/userMemberTag/batchUnbindTags",
        "UserMemberTagController.batchUnbindTags",
    ),
];

/// 用户标签关联路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/userMemberTag/listByUser", get(list_by_user))
        .route("/user/userMemberTag/bindTags", post(bind_tags))
        .route("/user/userMemberTag/unbindTags", post(unbind_tags))
        .route("/user/userMemberTag/batchBindTags", post(batch_bind_tags))
        .route(
            "/user/userMemberTag/batchUnbindTags",
            post(batch_unbind_tags),
        )
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

/// `GET /adminapi/user/userMemberTag/listByUser?userId=` 的查询参数。
#[derive(Debug, Deserialize)]
struct ListByUserQuery {
    #[serde(rename = "userId")]
    user_id: Option<i64>,
}

/// `GET /adminapi/user/userMemberTag/listByUser`：查询用户的所有标签。
async fn list_by_user(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ListByUserQuery>,
) -> ApiResult<Vec<UserMemberTagVO>> {
    let shop_id = shop_scope(&auth);
    ok(state
        .member
        .user_member_tag
        .list_by_user(shop_id, q.user_id.unwrap_or(0))
        .await?)
}

/// `POST /adminapi/user/userMemberTag/bindTags`：给用户打标签。
async fn bind_tags(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UserMemberTagParam>,
) -> ApiResult<()> {
    let shop_id = shop_scope(&auth);
    state
        .member
        .user_member_tag
        .bind_tags(shop_id, &param)
        .await?;
    ok(())
}

/// `POST /adminapi/user/userMemberTag/unbindTags`：取消用户标签。
async fn unbind_tags(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UserMemberTagParam>,
) -> ApiResult<()> {
    let shop_id = shop_scope(&auth);
    state
        .member
        .user_member_tag
        .unbind_tags(shop_id, &param)
        .await?;
    ok(())
}

/// `POST /adminapi/user/userMemberTag/batchBindTags`：批量给用户打标签。
async fn batch_bind_tags(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UserMemberTagBatchParam>,
) -> ApiResult<()> {
    let shop_id = shop_scope(&auth);
    state
        .member
        .user_member_tag
        .batch_bind_tags(shop_id, &param)
        .await?;
    ok(())
}

/// `POST /adminapi/user/userMemberTag/batchUnbindTags`：批量取消用户标签。
async fn batch_unbind_tags(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UserMemberTagBatchParam>,
) -> ApiResult<()> {
    let shop_id = shop_scope(&auth);
    state
        .member
        .user_member_tag
        .batch_unbind_tags(shop_id, &param)
        .await?;
    ok(())
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 当前店铺 ID（Java `HeaderUtils.getShopId()`，null → 0）。
///
/// `admin` → 0；`shop` / `pos` → `x-shop-id`（缺失/非法 → 0）；其它 → 0。
#[must_use]
/// 可信租户店铺作用域：平台账号 `0`，店铺账号强制本店（来自 JWT）。
fn shop_scope(auth: &AuthUser) -> i32 {
    auth.scoped_shop_id().unwrap_or(0)
}

#[cfg(test)]
pub fn current_shop_id(headers: &HeaderMap) -> i32 {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            ("GET", "/adminapi/user/userMemberTag/listByUser"),
            ("POST", "/adminapi/user/userMemberTag/bindTags"),
            ("POST", "/adminapi/user/userMemberTag/unbindTags"),
            ("POST", "/adminapi/user/userMemberTag/batchBindTags"),
            ("POST", "/adminapi/user/userMemberTag/batchUnbindTags"),
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
            assert!(p.starts_with("/user/userMemberTag/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[test]
    fn shop_scope_matches_java_header_utils() {
        assert_eq!(current_shop_id(&HeaderMap::new()), 0);
        assert_eq!(
            current_shop_id(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
        assert_eq!(
            current_shop_id(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        assert_eq!(
            current_shop_id(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
        // 缺失/非法 → 0（Java null → 0）
        assert_eq!(current_shop_id(&headers(&[("x-admin-type", "shop")])), 0);
        assert_eq!(
            current_shop_id(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            0
        );
    }

    #[test]
    fn trusted_shop_scope_from_auth() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(shop_scope(&admin), 0);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop_scope(&shop), 7);
    }
}
