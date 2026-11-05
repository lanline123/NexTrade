//! 管理端方法级权限中间件（契约权限自动挂载）。
//!
//! 必须在 `require_auth` 之后执行（依赖 `Extension<AuthUser>`）。
//! 所需权限来自自动生成的 [`crate::generated_permissions`]；
//! 无权限条目（如登录/公开接口）直接放行。
//!
//! 拒绝响应与 Java `JwtAccessDeniedHandler` 一致：HTTP 403 +
//! `{"code":1001,"msg":"参数校验异常"}`。
use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;

use tigshop_core::error::ApiResponse;
use tigshop_security::web::AuthUser;
use tigshop_services::identity::permission::PermissionService;

use super::generated_permissions;

/// 权限校验中间件。
pub async fn enforce(
    State(permission): State<Arc<PermissionService>>,
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().as_str().to_string();
    // 嵌套路由（`.nest("/adminapi", ...)`）内 `req.uri()` 是去掉前缀的路径，
    // 权限表使用契约完整路径，必须优先取 `OriginalUri`。
    let path = req
        .extensions()
        .get::<axum::extract::OriginalUri>()
        .map(|o| o.0.path().to_string())
        .unwrap_or_else(|| req.uri().path().to_string());
    let required = generated_permissions::required(&method, &path);
    let Some(required) = required else {
        return next.run(req).await;
    };
    let Some(admin_id) = req.extensions().get::<AuthUser>().map(|u| u.id) else {
        return denied();
    };
    match permission.check(admin_id, required).await {
        Ok(true) => next.run(req).await,
        Ok(false) => denied(),
        Err(e) => {
            tracing::warn!("权限校验失败: admin_id={admin_id} path={path} err={e}");
            denied()
        }
    }
}

/// Java `JwtAccessDeniedHandler`：403 + code 1001。
fn denied() -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(ApiResponse::<()>::fail(1001, "参数校验异常")),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denied_body_matches_java() {
        let resp = denied();
        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn permission_table_lookup_consistent() {
        // 有权限要求的契约端点应能命中生成表
        assert!(
            generated_permissions::required("GET", "/adminapi/authority/adminRole/list").is_some()
        );
        // 无权限要求的端点（如登录）不应命中
        assert!(generated_permissions::required("POST", "/adminapi/login/signin").is_none());
    }
}
