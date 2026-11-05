//! 管理端 IM 配置路由（im::im_config）。
//! 对应原 Java `com.tigshop.adminapi.controller.im.IMConfigController`
//! （`@RequestMapping("im/config/config")`，**不带** `/adminapi` 前缀，
//! 故真实 URL 为 `<adminapi 应用根>/im/config/config/detail`，本文件挂在根级路由）。
//!
//! 「控制器前缀重复一次」说明：Java 类注解为 `im/config/config`，
//! 组合后完整路径是 `/im/config/config/detail`
//! （第 2 个 `config` 是方法级资源名，**不是笔误**）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /im/config/config/detail` | `IMConfigController.detail` | 登录 |
//! | `POST /im/config/config/save`   | `IMConfigController.save` | 登录 |
//!
//! > **权限说明**：Java 该控制器**没有** `@PreAuthorize`（仅由 Spring Security
//! > 的登录过滤器拦截），Java 的 `URL_WHITELIST` 未包含 `/im/**`，故仍需登录；
//! > Rust 侧由 [`crate::root::merge_protected`] 上统一的
//! > `require_auth` 兜住，不追加额外权限校验。
//! >
//! > **多租户说明**：Java 在两个方法内都调用 `HeaderUtils.getShopId()`
//! > （`x-admin-type` + `x-shop-id` 请求头）：
//! > `admin` → `0`；`shop` / `pos` → `x-shop-id`（缺省 `null`）；其它 → `null`。
//! > 该值随后被写入 `ConfigCreateDTO.shopId`（覆盖请求体），
//! > 并作为 `shop_id` 过滤条件（`null` 时不加该条件）。
//! > Rust 的 JWT **未签发** `shop_id`，故此处按
//! > [`resolve_scope`](fn@resolve_scope) 复刻请求头口径，
//! > `x-admin-type` 缺失时回退 JWT 的 `admin_type`（与 aftersales/010/011 一致）。
//! >
//! > **返回结构说明**：
//! > - `detail` 原样返回 `ConfigDataDTO`；Java 未命中时返回 `null`，
//! >   故 Rust 侧返回 `Option<ConfigDataDTO>`（序列化后 `data` 字段同样为
//! >   `null`/缺失）。
//! > - `save` 原接口返回 `void`，此处回传落库主键便于排查。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::im::im_config::{ConfigCreateDTO, ConfigDataDTO, ImConfigScope};
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// IM 配置域路由（挂载于应用**根路径**，不在 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/im/config/config/detail", get(config_detail))
        .route("/im/config/config/save", post(config_save))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/im/config/config/detail",
            "IMConfigController.detail",
        ),
        ("POST", "/im/config/config/save", "IMConfigController.save"),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /im/config/config/detail?code=`：IM 配置详情。
///
/// 对应 Java `IMConfigController.detail(@RequestParam String code)` →
/// `ImConfigServiceImpl#detail(code, HeaderUtils.getShopId())`。
/// Java 未命中 / `data` 为空或非法 JSON 时返回 `null`（非 404）。
async fn config_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImConfigDetailQuery>,
) -> ApiResult<Option<ConfigDataDTO>> {
    let scope = resolve_scope(&headers, &auth);
    ok(state.im.im_config.detail(q.code.as_deref(), scope).await?)
}

/// `POST /im/config/config/save`：保存 IM 配置。
///
/// 对应 Java `IMConfigController.save(@Valid @RequestBody ConfigCreateDTO)` →
/// `ImConfigServiceImpl#create(createDTO)`。请求体里的 `shopId` 与 Java 一致
/// **被请求头覆盖**（见 `resolve_scope`）。原接口返回 `void`，
/// 这里回传落库主键 `imConfigId` 便于排查。
async fn config_save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ConfigCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let scope = resolve_scope(&headers, &auth);
    let id = state.im.im_config.save(&dto, scope).await?;
    ok(serde_json::json!({ "imConfigId": id }))
}

/// `GET .../detail` 的查询参数（Java `@RequestParam String code`，可缺省）。
#[derive(Debug, Deserialize)]
struct ImConfigDetailQuery {
    code: Option<String>,
}

/// 当前请求的店铺范围（多租户：**身份只信任认证中间件**）。
///
/// Java 口径：
/// - `x-admin-type == "admin"` → `0`（平台，**先于** `x-shop-id` 判定，
///   即平台账号带 `x-shop-id` 也会被强制归零）；
/// - `x-admin-type == "shop"` / `"pos"` → `x-shop-id`（缺省 / 非法 → `null`）；
/// - 其它（含缺失）→ `null` → 查询不加 `shop_id` 条件。
///
/// `x-admin-type` 缺失时回退 JWT 的 `admin_type`（Rust 侧 JWT 不签发
/// `x-shop-id`，见模块头多租户说明；与 aftersales/010/011 口径一致）。
fn resolve_scope(_headers: &HeaderMap, _auth: &AuthUser) -> ImConfigScope {
    let scope = TenantScope::current();
    if scope.is_platform() {
        // 平台账号：保留既有平台语义（shop_id = 0）
        ImConfigScope::Shop(0)
    } else {
        // 店铺账号：强制本店（忽略可伪造的 x-shop-id）
        ImConfigScope::from_optional(scope.shop_id())
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

    /// 仅带请求头、JWT 无 `admin_type` 的身份（模拟 Rust 侧不签发该字段）。
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
                &headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")]),
                &auth_without_type()
            ),
            ImConfigScope::Shop(0)
        );
        // 店铺身份 → 本店（请求头被忽略）
        let shop = TenantScope::for_shop(9);
        let scope = with_tenant_scope(shop, async {
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "3")]),
                &auth_without_type(),
            )
        })
        .await;
        assert_eq!(scope, ImConfigScope::Shop(9));
    }
}
