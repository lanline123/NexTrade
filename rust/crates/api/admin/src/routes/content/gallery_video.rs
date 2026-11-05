//! 管理端视频相册路由（content::gallery_video）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.GalleryVideoController`
//! （`@RequestMapping("/adminapi/setting/galleryVideo")`，7 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET  /setting/galleryVideo/getAllCategory` | `GalleryVideoController.treeList` |
//! | `GET  /setting/galleryVideo/list`           | `GalleryVideoController.list` |
//! | `GET  /setting/galleryVideo/detail`         | `GalleryVideoController.detail` |
//! | `POST /setting/galleryVideo/del`            | `GalleryVideoController.del` |
//! | `POST /setting/galleryVideo/create`         | `GalleryVideoController.create` |
//! | `POST /setting/galleryVideo/update`         | `GalleryVideoController.update` |
//! | `POST /setting/galleryVideo/batch`          | `GalleryVideoController.batch` |
//!
//! ## 多租户（重要，Java 原样保留）
//! - `getAllCategory` / `create(下一步排序)`：`admin` → `shop_id=0 AND vendor_id=0`；
//!   `shop`/`store`/`pickup` → `shop_id = 当前店铺`；`vendor` → `vendor_id = 当前供应商`。
//! - `list`：**只识别** `admin` / `shop` / `vendor`；`store` / `pickup` / 未知账号
//!   走「无过滤」分支（Java `buildGalleryQueryWrapper` 原样行为）。
//! - `x-shop-id` / `x-vendor-id` 缺失或非法时，Java `eq(col, null)` 恒不命中；
//!   本实现映射为 `-1`（同样恒不命中，且避免整表泄漏）。
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::gallery_video::{
    BatchDTO, GalleryDelDTO, GalleryVideoCreateDTO, GalleryVideoListQuery, GalleryVideoListVO,
    GalleryVideoUpdateDTO, GalleryVideoVO, VideoScope,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/setting/galleryVideo/getAllCategory",
        "GalleryVideoController.treeList",
    ),
    (
        "GET",
        "/setting/galleryVideo/treeList",
        "GalleryVideoController.treeList",
    ),
    (
        "GET",
        "/setting/galleryVideo/list",
        "GalleryVideoController.list",
    ),
    (
        "GET",
        "/setting/galleryVideo/detail",
        "GalleryVideoController.detail",
    ),
    (
        "POST",
        "/setting/galleryVideo/del",
        "GalleryVideoController.del",
    ),
    (
        "POST",
        "/setting/galleryVideo/create",
        "GalleryVideoController.create",
    ),
    (
        "POST",
        "/setting/galleryVideo/update",
        "GalleryVideoController.update",
    ),
    (
        "POST",
        "/setting/galleryVideo/batch",
        "GalleryVideoController.batch",
    ),
];

/// 视频相册路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/setting/galleryVideo/getAllCategory",
            get(get_all_category),
        )
        .route("/setting/galleryVideo/treeList", get(get_all_category))
        .route("/setting/galleryVideo/list", get(list))
        .route("/setting/galleryVideo/detail", get(detail))
        .route("/setting/galleryVideo/del", post(del))
        .route("/setting/galleryVideo/create", post(create))
        .route("/setting/galleryVideo/update", post(update))
        .route("/setting/galleryVideo/batch", post(batch))
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

/// `GET /adminapi/setting/galleryVideo/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/setting/galleryVideo/getAllCategory`：视频相册树形列表。
async fn get_all_category(
    State(state): State<AdminState>,
    headers: HeaderMap,
) -> ApiResult<Vec<GalleryVideoListVO>> {
    let scope = resolve_scope(&headers, ScopeMode::Tree);
    ok(state.content.gallery_video.tree_list(scope).await?)
}

/// `GET /adminapi/setting/galleryVideo/list`：视频相册列表。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<GalleryVideoListQuery>,
) -> ApiResult<PageResult<GalleryVideoVO>> {
    let scope = resolve_scope(&headers, ScopeMode::List);
    ok(state.content.gallery_video.list(scope, &q).await?)
}

/// `GET /adminapi/setting/galleryVideo/detail?id=`：详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<GalleryVideoVO>> {
    ok(state.content.gallery_video.detail(q.id).await?)
}

/// `POST /adminapi/setting/galleryVideo/create`：添加视频相册。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<GalleryVideoCreateDTO>,
) -> ApiResult<i32> {
    let scope = resolve_scope(&headers, ScopeMode::Tree);
    ok(state
        .content
        .gallery_video
        .create(scope, auth.id, &dto)
        .await?)
}

/// `POST /adminapi/setting/galleryVideo/update`：修改视频相册。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryVideoUpdateDTO>,
) -> ApiResult<i32> {
    ok(state.content.gallery_video.update(&dto).await?)
}

/// `POST /adminapi/setting/galleryVideo/del`：删除视频相册。
async fn del(State(state): State<AdminState>, Json(dto): Json<GalleryDelDTO>) -> ApiResult<()> {
    state.content.gallery_video.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/galleryVideo/batch`：批量操作。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.content.gallery_video.batch(&dto).await?)
}

/// 租户过滤模式：`Tree`（getAllCategory/create）与 `List`（list）规则不同。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScopeMode {
    Tree,
    List,
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// Java `HeaderUtils.getAdminType()`：`shop` 且 `x-shop-type` 为 2/3 时归一为
/// `store` / `pickup`；其余原样。
fn admin_type(headers: &HeaderMap) -> Option<String> {
    let raw = header_str(headers, "x-admin-type");
    match raw.as_deref() {
        Some("shop") => match header_str(headers, "x-shop-type").as_deref() {
            Some("2") => Some("store".to_string()),
            Some("3") => Some("pickup".to_string()),
            _ => raw,
        },
        _ => raw,
    }
}

/// 解析租户范围（content 素材：**店铺身份只信任认证中间件**）。
///
/// - 平台账号 → [`VideoScope::unscoped`]（不加店铺条件）；
/// - 店铺账号 → [`VideoScope::shop`]（列表条件 `(shop_id = 0 OR shop_id = ?)`，
///   见仓储 `push_filters`），忽略可伪造的 `x-admin-type` / `x-shop-id`；
/// - 供应商账号仍按既有 `x-vendor-id` 请求头（不在本次店铺隔离范围）。
#[must_use]
pub fn resolve_scope(headers: &HeaderMap, _mode: ScopeMode) -> VideoScope {
    if admin_type(headers).as_deref() == Some("vendor") {
        let vendor_id = header_str(headers, "x-vendor-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(-1);
        return VideoScope::vendor(vendor_id);
    }
    match TenantScope::current_list_filter() {
        Some(shop_id) => VideoScope::shop(shop_id),
        None => VideoScope::unscoped(),
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
        assert_eq!(docs.len(), 8);
        let expected = [
            ("GET", "/adminapi/setting/galleryVideo/getAllCategory"),
            ("GET", "/adminapi/setting/galleryVideo/list"),
            ("GET", "/adminapi/setting/galleryVideo/detail"),
            ("POST", "/adminapi/setting/galleryVideo/del"),
            ("POST", "/adminapi/setting/galleryVideo/create"),
            ("POST", "/adminapi/setting/galleryVideo/update"),
            ("POST", "/adminapi/setting/galleryVideo/batch"),
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
        assert_eq!(ROUTE_TABLE.len(), 8);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/setting/galleryVideo/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[tokio::test]
    async fn tree_scope_uses_trusted_identity() {
        // 无 task-local = 平台语义 → 不过滤；伪造 shop 头无效
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "admin")]), ScopeMode::Tree),
            VideoScope::unscoped()
        );
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
                ScopeMode::Tree
            ),
            VideoScope::unscoped()
        );
        // 店铺身份（task-local）→ 本店过滤
        let scope = tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope(
            TenantScope::for_shop(9),
            async { resolve_scope(&headers(&[("x-admin-type", "shop")]), ScopeMode::Tree) },
        )
        .await;
        assert_eq!(scope, VideoScope::shop(9));
        // 供应商上下文仍按 x-vendor-id
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "vendor"), ("x-vendor-id", "7")]),
                ScopeMode::Tree
            ),
            VideoScope::vendor(7)
        );
        assert_eq!(
            resolve_scope(&HeaderMap::new(), ScopeMode::Tree),
            VideoScope::unscoped()
        );
    }

    #[tokio::test]
    async fn list_scope_uses_trusted_identity() {
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "admin")]), ScopeMode::List),
            VideoScope::unscoped()
        );
        let scope = tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope(
            TenantScope::for_shop(9),
            async { resolve_scope(&headers(&[("x-admin-type", "shop")]), ScopeMode::List) },
        )
        .await;
        assert_eq!(scope, VideoScope::shop(9));
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "vendor"), ("x-vendor-id", "7")]),
                ScopeMode::List
            ),
            VideoScope::vendor(7)
        );
    }
}
