//! 前台文章路由（content::article_batch）。
//!
//! 对应 Java 2 个端点：
//! `GET /api/article/article/issueInfo`、`GET /api/article/category/indexBzzxList`。
//! 契约 auth=optional：本文件自带 [`optional_auth`]；两个接口均为公开只读。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::content::article_batch::{
    ArticleIssueInfoVO, ArticleIssueQuery, CategoryWithArticlesVO,
};
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use serde::Deserialize;

use crate::PublicState;

/// 本域 2 条前台路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/article/article/issueInfo", "ArticleController.issueInfo"),
    (
        "GET",
        "/article/category/indexBzzxList",
        "ArticleCategoryController.childrenArticleListWithCategory",
    ),
];

/// 前台文章路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/article/article/issueInfo", get(issue_info))
        .route("/article/category/indexBzzxList", get(index_bzzx_list))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
        .collect()
}

/// 可选登录态中间件（与 content/seo.rs 一致）。
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

/// `GET /api/article/article/issueInfo`：文章信息。
async fn issue_info(
    State(state): State<PublicState>,
    Query(q): Query<ArticleIssueQuery>,
) -> ApiResult<Option<ArticleIssueInfoVO>> {
    ok(state.content.article_batch.issue_info_page(&q).await?)
}

/// `GET /api/article/category/indexBzzxList` 查询参数。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IndexBzzxQuery {
    /// 分类数量上限（原版 footer 传 5）
    category_size: Option<usize>,
    /// 每个分类的文章数量上限（当前仓储固定 5，保留参数兼容）
    article_size: Option<usize>,
}

/// `GET /api/article/category/indexBzzxList`：分类 + 文章列表。
async fn index_bzzx_list(
    State(state): State<PublicState>,
    Query(q): Query<IndexBzzxQuery>,
) -> ApiResult<Vec<CategoryWithArticlesVO>> {
    let _ = q.article_size;
    ok(state
        .content
        .article_batch
        .index_bzzx_list(q.category_size)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].path, "/api/article/article/issueInfo");
        assert_eq!(docs[1].path, "/api/article/category/indexBzzxList");
        for d in &docs {
            assert_eq!(d.method, "GET");
        }
    }

    #[test]
    fn route_table_prefixed() {
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/article/"));
        }
    }
}
