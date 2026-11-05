//! 管理端文章批处理路由（content::article_batch）。
//!
//! 对应 Java `POST /adminapi/content/article/batch`。

use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::content::article_batch::BatchDTO;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 1 条管理端路由。
const ROUTE_TABLE: [(&str, &str, &str); 1] =
    [("POST", "/content/article/batch", "ArticleController.batch")];

/// 文章批处理路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/content/article/batch", post(batch))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.content.article_batch.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[0].path, "/adminapi/content/article/batch");
        assert_eq!(ROUTE_TABLE[0].1, "/content/article/batch");
    }
}
