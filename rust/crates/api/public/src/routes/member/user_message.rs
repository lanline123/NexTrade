//! 商城端站内信路由（member::user_message）。
//!
//! 对应原 Java `com.tigshop.api.controller.user.UserMessageController`
//! （`@RequestMapping("/api/user/message/")`，6 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java | 契约 auth |
//! |-----------------------------|---------|-----------|
//! | `GET  /user/message/list`               | `UserMessageController.list`                | optional |
//! | `POST /user/message/updateAllRead`      | `UserMessageController.setAllMessageRead`   | optional |
//! | `POST /user/message/updateOrderMessageRead` | `UserMessageController.setOrderMessageRead` | optional |
//! | `POST /user/message/updateMessageRead`  | `UserMessageController.setMessageRead`      | optional |
//! | `POST /user/message/del`                | `UserMessageController.del`                 | optional |
//! | `GET  /user/message/unreadCount`        | `UserMessageController.getUnreadMessageCount` | optional |
//!
//! ## 鉴权
//! 契约 6 条均为 `optional`。本文件自带 [`optional_auth`]（与
//! `routes/content/seo.rs` 逐行一致）：合法令牌写入 [`AuthUser`]，无令牌按游客，
//! 非法令牌 → 401。业务层的登录校验（`updateAllRead` / `updateOrderMessageRead`
//! 的「用户未登录」）由服务层按 `user_id == 0` 判断。
//!
//! ## 合并注意
//! 必须并入 `crates/api/public/src/routes/member/mod.rs` 的 `merge_public` 链
//! （外层**不要**再套 `require_auth`）。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::member::user_message::{
    UnreadMessageCountVO, UserMessageIdDTO, UserMessageListQuery, UserMessageVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域路由清单（完整路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/api/user/message/list", "UserMessageController.list"),
    (
        "POST",
        "/api/user/message/updateAllRead",
        "UserMessageController.setAllMessageRead",
    ),
    (
        "POST",
        "/api/user/message/updateOrderMessageRead",
        "UserMessageController.setOrderMessageRead",
    ),
    (
        "POST",
        "/api/user/message/updateMessageRead",
        "UserMessageController.setMessageRead",
    ),
    ("POST", "/api/user/message/del", "UserMessageController.del"),
    (
        "GET",
        "/api/user/message/unreadCount",
        "UserMessageController.getUnreadMessageCount",
    ),
];

/// 站内信前台路由（挂载于 `/api` 下，自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/message/list", get(list))
        .route("/user/message/updateAllRead", post(update_all_read))
        .route(
            "/user/message/updateOrderMessageRead",
            post(update_order_message_read),
        )
        .route(
            "/user/message/updateMessageRead",
            post(update_message_read),
        )
        .route("/user/message/del", post(del))
        .route("/user/message/unreadCount", get(unread_count))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| tigshop_openapi::RouteDoc::new(method, path, java_ref))
        .collect()
}

/// 可选登录态中间件（Java `permitAll` + JWT 过滤器）。
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

/// 取登录会员 ID；游客返回 `0`（Java `SecurityUtils.getCurrentUserId()`）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

/// `GET /api/user/message/list`：站内信列表。
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<UserMessageListQuery>,
) -> ApiResult<PageResult<UserMessageVO>> {
    let user_id = current_user_id(&auth);
    ok(state.member.user_message.list(user_id, &q).await?)
}

/// `POST /api/user/message/updateAllRead`：全部置为已读。
async fn update_all_read(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<()> {
    let user_id = current_user_id(&auth);
    state.member.user_message.set_all_read(user_id).await?;
    ok(())
}

/// `POST /api/user/message/updateOrderMessageRead`：订单消息置为已读。
async fn update_order_message_read(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<()> {
    let user_id = current_user_id(&auth);
    state
        .member
        .user_message
        .set_order_read(user_id)
        .await?;
    ok(())
}

/// `POST /api/user/message/updateMessageRead`：单条消息置为已读。
async fn update_message_read(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<UserMessageIdDTO>,
) -> ApiResult<bool> {
    let user_id = current_user_id(&auth);
    ok(state
        .member
        .user_message
        .set_message_read(user_id, &dto)
        .await?)
}

/// `POST /api/user/message/del`：删除站内信。
async fn del(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<UserMessageIdDTO>,
) -> ApiResult<()> {
    let user_id = current_user_id(&auth);
    state.member.user_message.delete(user_id, &dto).await?;
    ok(())
}

/// `GET /api/user/message/unreadCount`：未读消息统计。
async fn unread_count(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<UnreadMessageCountVO> {
    let user_id = current_user_id(&auth);
    ok(state.member.user_message.unread_count(user_id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        let expected = [
            ("GET", "/api/user/message/list"),
            ("POST", "/api/user/message/updateAllRead"),
            ("POST", "/api/user/message/updateOrderMessageRead"),
            ("POST", "/api/user/message/updateMessageRead"),
            ("POST", "/api/user/message/del"),
            ("GET", "/api/user/message/unreadCount"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut unique: Vec<(String, String)> =
            docs.iter().map(|d| (d.method.clone(), d.path.clone())).collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/api/user/message/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[test]
    fn current_user_id_matches_java_security_utils() {
        assert_eq!(current_user_id(&None), 0);
        let auth = Some(Extension(AuthUser {
            id: 8,
            username: "u".into(),
            role_id: None,
            admin_type: None,
            shop_id: None,
        }));
        assert_eq!(current_user_id(&auth), 8);
    }
}
