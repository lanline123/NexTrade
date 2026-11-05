//! 管理端装修模板路由（content::decorate_template）。
//!
//! 对应 Java `DecorateTemplateController`（`/adminapi/decorate/template`）：
//! `GET category`、`GET list`、`GET detail`。转发官网 OpenTemplate API，业务字段原样透传。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use serde_json::Value;
use tigshop_core::models::content::decorate_template::{
    DecorateTemplateDetailQuery, DecorateTemplateListQuery,
};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "GET",
        "/decorate/template/category",
        "DecorateTemplateController.category",
    ),
    (
        "GET",
        "/decorate/template/list",
        "DecorateTemplateController.list",
    ),
    (
        "GET",
        "/decorate/template/detail",
        "DecorateTemplateController.detail",
    ),
];

/// 装修模板路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/decorate/template/category", get(category))
        .route("/decorate/template/list", get(list))
        .route("/decorate/template/detail", get(detail))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn category(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(state.content.decorate_template.category().await?)
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<DecorateTemplateListQuery>,
) -> ApiResult<Value> {
    ok(state.content.decorate_template.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<DecorateTemplateDetailQuery>,
) -> ApiResult<Value> {
    ok(state.content.decorate_template.detail(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        assert_eq!(docs[0].path, "/adminapi/decorate/template/category");
        assert_eq!(docs[1].path, "/adminapi/decorate/template/list");
        assert_eq!(docs[2].path, "/adminapi/decorate/template/detail");
        for d in &docs {
            assert_eq!(d.method, "GET");
        }
    }

    #[test]
    fn route_table_prefixed() {
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/decorate/template/"));
        }
    }
}
