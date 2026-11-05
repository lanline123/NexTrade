//! IM 客服（ImServantController） —— 根级路由（im::im_servant，admin 端）。
//!
//! **路径约定**：原 Java `@RequestMapping("/im/servant/servant")` **不含**
//! `/adminapi` 前缀，真实 URL 直接挂在应用根路径（见 `crate::root` 模块文档）。
//! 因此本文件的路由串写**完整契约路径** `/im/servant/servant/...`，
//! **不要**再写 `/adminapi`；`implemented_routes()` 的 `RouteDoc.path` 同为完整路径。
//!
//! 「控制器前缀重复一次」说明：类注解 `/im/servant/servant`，方法级资源名
//! `transferList` / `modifyStatus` / `getStatus` 拼在其后，
//! 完整路径如 `/im/servant/servant/getStatus`（第 2 个 `servant` **不是笔误**）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /im/servant/servant/transferList` | `ImServantController.list` | 登录 |
//! | `POST /im/servant/servant/modifyStatus` | `ImServantController.modifyStatus` | 登录 |
//! | `GET  /im/servant/servant/getStatus` | `ImServantController.getStatus` | 登录 |
//!
//! > **权限说明**：Java 该控制器**没有** `@PreAuthorize`（仅由 Spring Security
//! > 登录过滤器拦截；`URL_WHITELIST` 不含 `/im/**`，故仍需登录）。Rust 侧由
//! > [`crate::root::merge_protected`] 上统一的 `require_auth` 兜住，本文件不再加认证中间件。
//! >
//! > **登录态 / 多租户说明**（对应 Java）：
//! > - `SecurityUtils.getCurrentAdminId()` → Rust JWT `AuthUser.id`（`servant_id`）；
//! > - `HeaderUtils.getShopId()`（`x-admin-type` + `x-shop-id`）三态：
//! >   `admin`→`0`；`shop`/`pos`→`x-shop-id`（缺省 `None`）；其它→`None`。
//! >   Rust JWT 未签发 `shop_id`，故按请求头复刻，`x-admin-type` 缺失时回退
//! >   JWT 的 `admin_type`（与 im_config 口径一致）。
//! >   该值覆盖请求体里的 `shopId`（`transferList` 的 DTO、`modifyStatus` 的 DTO）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::im::im_servant::{
    ImServantListQuery, ImServantScope, ImServantVO, ServantModifyStatusDTO,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 客服域路由（挂载于应用**根路径**，不在 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/im/servant/servant/transferList", get(transfer_list))
        .route("/im/servant/servant/modifyStatus", post(modify_status))
        .route("/im/servant/servant/getStatus", get(get_status))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/im/servant/servant/transferList",
            "ImServantController.list",
        ),
        (
            "POST",
            "/im/servant/servant/modifyStatus",
            "ImServantController.modifyStatus",
        ),
        (
            "GET",
            "/im/servant/servant/getStatus",
            "ImServantController.getStatus",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /im/servant/servant/transferList`：客服分页列表。
///
/// 对应 Java `ImServantController.list(ImServantListDTO)` →
/// `imServantService.list(...)`（`shopId` 由请求头覆盖）。
async fn transfer_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImServantListQuery>,
) -> ApiResult<PageResult<ImServantVO>> {
    let scope = resolve_scope(&headers, &auth);
    ok(state.im.im_servant.list(&q, scope).await?)
}

/// `POST /im/servant/servant/modifyStatus`：修改当前客服状态。
///
/// 对应 Java `ImServantController.modifyStatus(@Valid @RequestBody ServantModifyStatusDTO)`：
/// `servantId` 被登录态覆盖、`shopId` 被请求头覆盖（仅 `status` 取请求体）。
/// Java 原接口返回 `void`，此处回传落库主键便于排查。
async fn modify_status(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ServantModifyStatusDTO>,
) -> ApiResult<serde_json::Value> {
    let scope = resolve_scope(&headers, &auth);
    // Java：dto.setServantId(SecurityUtils.getCurrentAdminId()) → 用登录态，忽略请求体
    let id = state
        .im
        .im_servant
        .modify_status(dto.status, auth.id, scope)
        .await?;
    ok(serde_json::json!({ "id": id }))
}

/// `GET /im/servant/servant/getStatus`：读取当前客服状态（不存在则初始化离线）。
///
/// 对应 Java `ImServantController.getStatus()` →
/// `imServantService.getStatus(currentAdminId, HeaderUtils.getShopId())`。
async fn get_status(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
) -> ApiResult<ImServantVO> {
    let scope = resolve_scope(&headers, &auth);
    ok(state.im.im_servant.get_status(auth.id, scope).await?)
}

/// 当前请求的店铺范围（多租户：**身份只信任认证中间件**）。
///
/// - 平台账号 → `Shop(0)`（保留既有平台语义）；
/// - 店铺账号 → `Shop(本店)`（task-local，忽略可伪造的 `x-shop-id`）；
/// - 其它 → `Unscoped`。
fn resolve_scope(_headers: &HeaderMap, _auth: &AuthUser) -> ImServantScope {
    let scope = TenantScope::current();
    if scope.is_platform() {
        ImServantScope::Shop(0)
    } else {
        ImServantScope::from_optional(scope.shop_id())
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

    fn auth_without_type() -> AuthUser {
        AuthUser {
            id: 1,
            username: "tester".into(),
            role_id: None,
            admin_type: None,
            shop_id: None,
        }
    }

    #[tokio::test]
    async fn scope_uses_trusted_identity_not_headers() {
        use tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope;
        // 无 task-local = 平台语义 → Shop(0)（伪造 x-shop-id 无效）
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
                &auth_without_type()
            ),
            ImServantScope::Shop(0)
        );
        // 店铺身份 → Shop(本店)，请求头被忽略
        let shop = TenantScope::for_shop(9);
        let scope = with_tenant_scope(shop, async {
            resolve_scope(
                &headers(&[("x-admin-type", "admin"), ("x-shop-id", "3")]),
                &auth_without_type(),
            )
        })
        .await;
        assert_eq!(scope, ImServantScope::Shop(9));
    }

    #[test]
    fn routes_and_docs_agree_on_three_paths() {
        // 注册的路由数与 RouteDoc 数一致（覆盖率统计依赖后者）
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        let mut paths: Vec<String> = docs.iter().map(|d| d.path.clone()).collect();
        paths.sort();
        assert_eq!(
            paths,
            vec![
                "/im/servant/servant/getStatus".to_string(),
                "/im/servant/servant/modifyStatus".to_string(),
                "/im/servant/servant/transferList".to_string(),
            ]
        );
    }
}
