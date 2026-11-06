//! app 版本检查 —— 商城端路由（system::app_version_admin）—— wave9。
//!
//! 原 Java `com.tigshop.api.controller.app.AppVersionController`
//! （`@PostMapping("/api/appVersion/getAppUpdate")`，契约 `auth=optional`）。
//!
//! | 本模块路由（挂载于 `/api`） | Java handler | 状态 |
//! |-----------------------------|--------------|------|
//! | `POST /appVersion/getAppUpdate` | AppVersionController.getAppUpdate | 已实现（版本比较 + 下载链接） |
//!
//! > 本文件为 `system::app_version_admin` 的 public 侧补充（契约路径为 `/api/...`，
//! > 故不能放 admin 路由树）；自带 optional_auth，并入 `merge_public`。
//!
//! > **返回语义**：Java 返回 `AjaxResult<String>`；Rust 统一 `ApiResult<String>`
//! > 信封，`data` 为下载链接（无更新时为空串，与 Java 一致）。

use axum::{
    extract::{Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::post,
    Json, Router,
};
use tigshop_core::models::system::app_version_admin::AppVersionParam;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "POST",
    "/appVersion/getAppUpdate",
    "AppVersionController.getAppUpdate",
)];

/// 版本检查路由。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/appVersion/getAppUpdate", post(get_app_update))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/api{p}"), j))
        .collect()
}

/// `POST /api/appVersion/getAppUpdate`
async fn get_app_update(
    State(state): State<PublicState>,
    Json(param): Json<AppVersionParam>,
) -> ApiResult<String> {
    ok(state.system.app_version_admin.get_app_update(&param).await?)
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
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
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/api/appVersion/getAppUpdate");
        assert_eq!(docs[0].method, "POST");
        assert!(!ROUTE_TABLE[0].1.contains("/api"));
    }

    #[test]
    fn params_are_camel_case() {
        let p: AppVersionParam = serde_json::from_value(serde_json::json!({
            "type": "ios", "version": "1.0.0"
        }))
        .unwrap();
        assert_eq!(p.r#type.as_deref(), Some("ios"));
        assert_eq!(p.version.as_deref(), Some("1.0.0"));
    }
}
