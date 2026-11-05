//! 管理端装修推广短链路由（content::decorate_promote）。
//!
//! 对应 Java `POST /adminapi/decorate/promote/generateShortLink`。

use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::content::decorate_promote::GenerateShortLinkDTO;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 1 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "POST",
    "/decorate/promote/generateShortLink",
    "DecorateController.generateShortLink",
)];

/// 推广短链路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route(
        "/decorate/promote/generateShortLink",
        post(generate_short_link),
    )
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `POST /adminapi/decorate/promote/generateShortLink`：生成短链。
async fn generate_short_link(
    State(state): State<AdminState>,
    Json(dto): Json<GenerateShortLinkDTO>,
) -> ApiResult<String> {
    ok(state
        .content
        .decorate_promote
        .generate_short_link(&dto)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[0].path, "/adminapi/decorate/promote/generateShortLink");
    }

    #[test]
    fn route_table_prefixed() {
        assert!(ROUTE_TABLE[0].1.starts_with("/decorate/promote/"));
    }
}
