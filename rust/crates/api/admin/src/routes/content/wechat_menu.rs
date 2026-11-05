//! 管理端微信菜单路由（content::wechat_menu）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.wechat.WechatMenuController`
//! （`@RequestMapping("/adminapi/wechat/menu")`，2 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET  /wechat/menu`               | `get` |
//! | `POST /wechat/menu/saveAndPublish` | `saveAndPublish`（本地校验 → 未迁移） |
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`（`/wechat/menu` 与 keywordRule 的 `capability` 不冲突）。

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::content::wechat_menu::{SaveAndPublishVO, WxMenuSaveDTO, WxMenuVO};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/wechat/menu", "WechatMenuController.get"),
    (
        "POST",
        "/wechat/menu/saveAndPublish",
        "WechatMenuController.saveAndPublish",
    ),
];

/// 微信菜单路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wechat/menu", get(get_menu))
        .route("/wechat/menu/saveAndPublish", post(save_and_publish))
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

/// `GET /adminapi/wechat/menu`：获取微信菜单详情。
async fn get_menu(State(state): State<AdminState>) -> ApiResult<WxMenuVO> {
    ok(state.content.wechat_menu.get().await?)
}

/// `POST /adminapi/wechat/menu/saveAndPublish`：保存并发布（本地校验 → 未迁移）。
async fn save_and_publish(
    State(state): State<AdminState>,
    Json(dto): Json<WxMenuSaveDTO>,
) -> ApiResult<SaveAndPublishVO> {
    ok(state.content.wechat_menu.save_and_publish(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        let expected = [
            ("GET", "/adminapi/wechat/menu"),
            ("POST", "/adminapi/wechat/menu/saveAndPublish"),
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
        assert_eq!(ROUTE_TABLE.len(), 2);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/wechat/menu"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }
}
