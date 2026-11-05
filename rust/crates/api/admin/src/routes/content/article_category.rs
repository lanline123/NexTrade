//! 管理端文章分类路由（content::article_category）。
//!
//! 对应 Java `ArticleCategoryController`（`/adminapi/content/articleCategory`）：
//! `POST update`、`POST updateField`、`POST batch`。

use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::content::article_category::{
    ArticleCategoryDTO, BatchDTO, UpdateFieldDTO,
};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "POST",
        "/content/articleCategory/update",
        "ArticleCategoryController.update",
    ),
    (
        "POST",
        "/content/articleCategory/updateField",
        "ArticleCategoryController.updateField",
    ),
    (
        "POST",
        "/content/articleCategory/batch",
        "ArticleCategoryController.batch",
    ),
];

/// 文章分类路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/content/articleCategory/update", post(update))
        .route("/content/articleCategory/updateField", post(update_field))
        .route("/content/articleCategory/batch", post(batch))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ArticleCategoryDTO>,
) -> ApiResult<()> {
    state.content.article_category.update(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.content.article_category.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.content.article_category.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        assert_eq!(docs[0].path, "/adminapi/content/articleCategory/update");
        assert_eq!(
            docs[1].path,
            "/adminapi/content/articleCategory/updateField"
        );
        assert_eq!(docs[2].path, "/adminapi/content/articleCategory/batch");
        for d in &docs {
            assert_eq!(d.method, "POST");
        }
    }

    #[test]
    fn route_table_unique() {
        assert_eq!(ROUTE_TABLE.len(), 3);
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/content/articleCategory/"));
        }
    }
}
