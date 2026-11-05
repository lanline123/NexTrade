//! 管理端客服消息能力探测路由（content::wechat_kefu_capability）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.wechat.WechatKefuCapabilityController`
//! （类级 `@RequestMapping("/adminapi/wechat/keywordRule")` + `GET /capability`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET /wechat/keywordRule/capability` | `WechatKefuCapabilityController.capability` |
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`（与 `wechat_keyword_rule` 的
//! `/wechat/keywordRule/*` 子路径不冲突）。

use axum::{extract::State, routing::get, Router};
use tigshop_core::models::content::wechat_kefu_capability::WechatKefuCapabilityVO;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/wechat/keywordRule/capability",
    "WechatKefuCapabilityController.capability",
)];

/// 客服能力探测路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/wechat/keywordRule/capability", get(capability))
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

/// `GET /adminapi/wechat/keywordRule/capability`：探测客服消息接口是否可用。
async fn capability(State(state): State<AdminState>) -> ApiResult<WechatKefuCapabilityVO> {
    ok(state.content.wechat_kefu_capability.capability().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/wechat/keywordRule/capability");
    }

    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        let (_, path, _) = ROUTE_TABLE[0];
        assert!(
            path.starts_with("/wechat/keywordRule/"),
            "路径前缀错误: {path}"
        );
        assert_ne!(path, "/wechat/keywordRule/list", "不得与规则列表路由冲突");
    }
}
