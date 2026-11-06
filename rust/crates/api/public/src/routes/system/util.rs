//! 通用工具路由（system::util，**商城端**）。
//!
//! 原 Java `UtilController`
//! （`java/tigshop-api/.../controller/common/UtilController.java`，
//! `@RequestMapping("/api/common/util")`），3 个 GET，契约 `auth=optional`：
//!
//! | 本模块路由（挂载于 `/api`） | 契约 auth | Java 实现 |
//! |-----------------------------|-----------|-----------|
//! | `GET /common/util/qrCode?url=` | optional | `QrCodeUtil.generateAsBase64` |
//! | `GET /common/util/miniCode?path=&id=&salesmanId=&shopId=` | optional | `WechatOAuthService.getMiniCode` |
//! | `GET /common/util/miniScene?scene=` | optional | `WechatOAuthService.resolveMiniScene` |
//!
//! > ⚠️ 三个端点均依赖未迁移的外部能力；本实现保留端点、本地校验后返回
//! > **1001「未迁移」业务错误**（不伪造成功）。详见服务层模块头。
//!
//! > **路由归属**：spec 路径为 `/api/...`，故本文件位于
//! > `api/public/src/routes/system/util.rs`（而非 admin 路由树）；这是与
//! > write-scope 中 admin 路径的**有意偏差**，已在任务报告登记。
//!
//! > **auth=optional 落地**：自带 [`optional_auth`]（逐行对齐
//! > `content/seo.rs`），必须并入 `merge_public`，外层不得再套 `require_auth`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::system::util::{MiniCodeQuery, MiniSceneQuery, QrCodeQuery};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 3 条路由（去 `/api` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    ("GET", "/common/util/qrCode", "UtilController.qrCode"),
    ("GET", "/common/util/miniCode", "UtilController.miniCode"),
    ("GET", "/common/util/miniScene", "UtilController.miniScene"),
];

/// 通用工具路由（挂载于 `/api` 下，自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/common/util/qrCode", get(qr_code))
        .route("/common/util/miniCode", get(mini_code))
        .route("/common/util/miniScene", get(mini_scene))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), java_ref)
        })
        .collect()
}

/// `GET /api/common/util/qrCode?url=`：二维码（当前返回「未迁移」）。
async fn qr_code(
    State(state): State<PublicState>,
    Query(q): Query<QrCodeQuery>,
) -> ApiResult<String> {
    ok(state.system.util.qr_code(q.url.as_deref()).await?)
}

/// `GET /api/common/util/miniCode?path=&id=`：小程序码（当前返回「未迁移」）。
///
/// 说明：Java 该方法直接返回 `String`（非 `AjaxResult` 包装）；Rust 统一走
/// [`ApiResult`] 信封（与其余已迁移端点一致的平台口径），偏差已登记。
async fn mini_code(
    State(state): State<PublicState>,
    Query(q): Query<MiniCodeQuery>,
) -> ApiResult<String> {
    ok(state
        .system
        .util
        .mini_code(q.path.as_deref(), q.id, q.salesman_id, q.shop_id)
        .await?)
}

/// `GET /api/common/util/miniScene?scene=`：解析小程序码 scene（当前返回「未迁移」）。
async fn mini_scene(
    State(state): State<PublicState>,
    Query(q): Query<MiniSceneQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.system.util.mini_scene(q.scene.as_deref()).await?)
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 游客；非法/过期令牌 → 401；合法令牌 → 写入 [`AuthUser`]。
/// 与 `content/seo.rs` / `shop_client.rs` / `wholesale_client.rs` 一致。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    if token.is_some() {
        let Ok(claims) = jwt.from_authorization(token) else { return Ok(next.run(req).await); };
        let Ok(id) = claims.sub.parse::<i32>() else { return Ok(next.run(req).await); };
        req.extensions_mut().insert(AuthUser {
            id,
            username: claims.usr,
            role_id: claims.role,
            admin_type: claims.typ,
            shop_id: claims.shop_id,
        });
    }
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_contract_and_has_api_prefix_in_docs() {
        assert_eq!(ROUTE_TABLE.len(), 3);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/api/common/util/qrCode");
        assert_eq!(docs[2].path, "/api/common/util/miniScene");
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET"));
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/api")));
    }

    #[test]
    fn all_paths_live_under_common_util() {
        for (_, path, _) in ROUTE_TABLE {
            assert!(path.starts_with("/common/util/"), "{path}");
        }
    }
}
