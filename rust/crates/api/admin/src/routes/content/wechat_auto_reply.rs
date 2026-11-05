//! 管理端公众号自动回复路由（content::wechat_auto_reply）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.wechat.WechatAutoReplyController`
//! （`@RequestMapping("/adminapi/wechat/autoReply")`，6 个端点）。
//!
//! | 本模块路径（挂载于 `/adminapi`） | 原 Java | 契约 auth |
//! |----------------------------------|---------|-----------|
//! | `GET  /wechat/autoReply/subscribe`         | `getSubscribe`      | jwt+perm |
//! | `POST /wechat/autoReply/subscribe/save`    | `saveSubscribe`     | jwt+perm |
//! | `GET  /wechat/autoReply/default`           | `getDefault`        | jwt+perm |
//! | `POST /wechat/autoReply/default/save`      | `saveDefault`       | jwt+perm |
//! | `GET  /wechat/autoReply/loginSuccess`      | `getLoginSuccess`   | **anonymous** |
//! | `POST /wechat/autoReply/loginSuccess/save` | `saveLoginSuccess`  | **anonymous** |
//!
//! 因此本文件提供两个入口：`routes()`（需登录 4 条，并入 admin 受保护路由）与
//! `public_routes()`（匿名 2 条，并入 admin 的免登录路由）。
//!
//! 合并注意：`crates/api/admin/src/routes/content/mod.rs`（或对应的 admin 路由
//! 聚合处）需分别 merge 两个入口，并在 `implemented_routes()` 中调用本模块的
//! `implemented_routes()`（6 条全量）。

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::content::wechat_auto_reply::{ReplyPayloadDTO, ReplyPayloadVO};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 6 条路由（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/wechat/autoReply/subscribe",
        "WechatAutoReplyController.getSubscribe",
    ),
    (
        "POST",
        "/wechat/autoReply/subscribe/save",
        "WechatAutoReplyController.saveSubscribe",
    ),
    (
        "GET",
        "/wechat/autoReply/default",
        "WechatAutoReplyController.getDefault",
    ),
    (
        "POST",
        "/wechat/autoReply/default/save",
        "WechatAutoReplyController.saveDefault",
    ),
    (
        "GET",
        "/wechat/autoReply/loginSuccess",
        "WechatAutoReplyController.getLoginSuccess",
    ),
    (
        "POST",
        "/wechat/autoReply/loginSuccess/save",
        "WechatAutoReplyController.saveLoginSuccess",
    ),
];

/// 需登录的自动回复路由（4 条，挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wechat/autoReply/subscribe", get(get_subscribe))
        .route("/wechat/autoReply/subscribe/save", post(save_subscribe))
        .route("/wechat/autoReply/default", get(get_default))
        .route("/wechat/autoReply/default/save", post(save_default))
}

/// 匿名可访问的自动回复路由（2 条，契约 auth=anonymous；不套 `require_auth`）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wechat/autoReply/loginSuccess", get(get_login_success))
        .route(
            "/wechat/autoReply/loginSuccess/save",
            post(save_login_success),
        )
}

/// 本域已实现路由（覆盖率统计用，6 条全量）。
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

/// `GET /adminapi/wechat/autoReply/subscribe`：获取关注后自动回复。
async fn get_subscribe(State(state): State<AdminState>) -> ApiResult<ReplyPayloadVO> {
    ok(state.content.wechat_auto_reply.get_subscribe().await?)
}

/// `POST /adminapi/wechat/autoReply/subscribe/save`：保存关注后自动回复。
async fn save_subscribe(
    State(state): State<AdminState>,
    Json(dto): Json<ReplyPayloadDTO>,
) -> ApiResult<()> {
    state.content.wechat_auto_reply.save_subscribe(&dto).await?;
    ok(())
}

/// `GET /adminapi/wechat/autoReply/default`：获取默认自动回复。
async fn get_default(State(state): State<AdminState>) -> ApiResult<ReplyPayloadVO> {
    ok(state.content.wechat_auto_reply.get_default().await?)
}

/// `POST /adminapi/wechat/autoReply/default/save`：保存默认自动回复。
async fn save_default(
    State(state): State<AdminState>,
    Json(dto): Json<ReplyPayloadDTO>,
) -> ApiResult<()> {
    state.content.wechat_auto_reply.save_default(&dto).await?;
    ok(())
}

/// `GET /adminapi/wechat/autoReply/loginSuccess`：获取扫码登录成功回复（匿名）。
async fn get_login_success(State(state): State<AdminState>) -> ApiResult<ReplyPayloadVO> {
    ok(state.content.wechat_auto_reply.get_login_success().await?)
}

/// `POST /adminapi/wechat/autoReply/loginSuccess/save`：保存扫码登录成功回复（匿名）。
async fn save_login_success(
    State(state): State<AdminState>,
    Json(dto): Json<ReplyPayloadDTO>,
) -> ApiResult<()> {
    state
        .content
        .wechat_auto_reply
        .save_login_success(&dto)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        let expected = [
            ("GET", "/adminapi/wechat/autoReply/subscribe"),
            ("POST", "/adminapi/wechat/autoReply/subscribe/save"),
            ("GET", "/adminapi/wechat/autoReply/default"),
            ("POST", "/adminapi/wechat/autoReply/default/save"),
            ("GET", "/adminapi/wechat/autoReply/loginSuccess"),
            ("POST", "/adminapi/wechat/autoReply/loginSuccess/save"),
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
        assert_eq!(ROUTE_TABLE.len(), 6);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/wechat/autoReply/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[test]
    fn protected_and_anonymous_split_matches_contract() {
        // 4 条需登录 + 2 条匿名 = 6 条全量
        let protected = [
            "/wechat/autoReply/subscribe",
            "/wechat/autoReply/subscribe/save",
            "/wechat/autoReply/default",
            "/wechat/autoReply/default/save",
        ];
        let anonymous = [
            "/wechat/autoReply/loginSuccess",
            "/wechat/autoReply/loginSuccess/save",
        ];
        assert_eq!(protected.len() + anonymous.len(), ROUTE_TABLE.len());
        for path in protected.iter().chain(anonymous.iter()) {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
    }
}
