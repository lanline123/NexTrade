//! 配置管理 —— 管理端路由（system::cache_manage）。
//!
//! 原 Java：`CacheManageController`
//! （`tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/common/CacheManageController.java`，
//! `@RequestMapping("/adminapi/common/cacheManage")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `POST /common/cacheManage/cleanup` | `POST /adminapi/common/cacheManage/cleanup` | `CacheManageController.cleanup` | jwt |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//!
//! 入参 `tag` 在原 Java 中被完全忽略（`CacheManageServiceImpl#cleanup` 未使用），
//! 本实现如实忽略；清理逻辑见 `tigshop_services::system::cache_manage`，Redis 扫描/删除
//! 见 `tigshop_infrastructure::db::repo::system::cache_manage`。

use axum::{
    extract::{Query, State},
    routing::post,
    Router,
};
use tigshop_core::models::system::cache_manage::{CacheCleanupQuery, CacheCleanupVO};
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/common/cacheManage/cleanup", post(cleanup))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 已实现路由清单（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [(
        "POST",
        "/adminapi/common/cacheManage/cleanup",
        "CacheManageController.cleanup",
    )]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `POST /adminapi/common/cacheManage/cleanup?tag=`：清除缓存。
///
/// 对应 Java `CacheManageController.cleanup`
/// （`@RequestParam(value = "tag", required = false) String tag`，返回 `void`）。
/// 删除 Redis 中除保留前缀（`admin_token::` / `admin_user::`）外的全部 key。
async fn cleanup(
    State(state): State<AdminState>,
    Query(q): Query<CacheCleanupQuery>,
) -> ApiResult<CacheCleanupVO> {
    ok(state.system.cache_manage.cleanup(&q).await?)
}
