//! 管理端 API Token 认证中间件（对应 Java `ApiTokenAuthenticationFilter`）。
//!
//! Java 语义：请求携带 `X-Api-Token` 头时优先按 Token 认证
//! （`AdminApiTokenService.validateToken`：SHA-256 哈希查表 + 激活 + 未过期
//! + 回写 `last_used_at`），命中后以该管理员身份短路 JWT 过滤链；
//! 无头时透传，由外层 `require_auth` 走 JWT。
//!
//! Token 的生成/列出/吊销在 [`crate::routes::identity::admin_user`] 的
//! `apiToken/*` 端点（2026-10-25 起生成即可用）。

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use tigshop_common::utils;
use tigshop_core::Error;
use tigshop_security::web::{AppError, AuthUser};

use crate::AdminState;

/// 内部 API Token 请求头（Java `Constants.X_API_TOKEN_HEADER`）。
pub const X_API_TOKEN_HEADER: &str = "X-Api-Token";

/// API Token 认证中间件（需在 `require_auth` 之外层执行）。
pub async fn api_token_auth(
    State(state): State<AdminState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(X_API_TOKEN_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let Some(token) = token else {
        return Ok(next.run(req).await);
    };

    let hash = utils::sha256_hex(token);
    let now = utils::now_seconds();
    let admin_user = &state.repos.identity.admin_user;
    let record = admin_user
        .find_active_api_token_by_hash(&hash, now)
        .await
        .map_err(AppError)?;
    let Some(record) = record else {
        // Java：throw new GlobalException("API Token无效或过期")
        return Err(AppError(Error::Unauthorized("API Token无效或过期".into())));
    };
    let Some(user) = admin_user
        .find_user(record.admin_id)
        .await
        .map_err(AppError)?
    else {
        return Err(AppError(Error::Unauthorized("API Token无效或过期".into())));
    };
    let _ = admin_user.touch_api_token(record.id, now).await;

    req.extensions_mut().insert(AuthUser {
        id: user.admin_id,
        username: user.username,
        role_id: Some(user.role_id),
        admin_type: Some(user.admin_type),
        shop_id: Some(user.shop_id),
    });
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    #[test]
    fn header_name_matches_java_constant() {
        assert_eq!(super::X_API_TOKEN_HEADER, "X-Api-Token");
    }
}
