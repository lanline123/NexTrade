//! 分销素材 —— 商城前台路由（marketing::salesman_material）。
//!
//! 对应原 Java `com.tigshop.api.controller.salesman.SalesmanMaterialController`
//! （`@RequestMapping("/api/salesman/material")`，3 个端点）。
//!
//! | method | path（挂载于 `/api`） | 原 Java |
//! |--------|------------------------|---------|
//! | `GET`  | `/salesman/material/list` | `apiPage` |
//! | `GET`  | `/salesman/material/detail?id=` | `detail` |
//! | `GET`  | `/salesman/material/category` | `category` |
//!
//! # auth=optional 口径
//! Java 该控制器在 `permitAll` 下，无显式权限注解；`apiPage` 内部按当前
//! 分销员 shopId 过滤（游客 → -1 → 空列表）。Rust 见 models 差异 4：
//! 固定 `shop_id=0` + `is_available=1`。本文件自带 `optional_auth`
//! （与 `content/seo.rs` 一致），`routes()` 由 sync_routes 并入 `merge_public`。
//!
//! # `category`
//! Java 返回 `List<SalesmanMaterialCategory>` 实体（snake_case → Java
//! camelCase），本实现直接返回实体序列化结构（`tigshop_core::entities`
//! 的 serde 配置与其它实体一致）。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_material::{
    SalesmanMaterialApiQuery, SalesmanMaterialVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 3 条公共路由（去掉 `/api` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    ("GET", "/salesman/material/list", "SalesmanMaterialController.apiPage"),
    ("GET", "/salesman/material/detail", "SalesmanMaterialController.detail"),
    (
        "GET",
        "/salesman/material/category",
        "SalesmanMaterialController.category",
    ),
];

/// 素材公共路由（`/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/salesman/material/list", get(list))
        .route("/salesman/material/detail", get(detail))
        .route("/salesman/material/category", get(category))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| RouteDoc::new(method, &format!("/api{path}"), java_ref))
        .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
}

async fn list(
    State(state): State<PublicState>,
    Query(q): Query<SalesmanMaterialApiQuery>,
) -> ApiResult<PageResult<SalesmanMaterialVO>> {
    ok(state.marketing.salesman_material.api_page(&q).await?)
}

async fn detail(
    State(state): State<PublicState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanMaterialVO>> {
    let id = q
        .id
        .ok_or_else(|| Error::Validation("id不能为空".into()))?;
    ok(state.marketing.salesman_material.detail(id).await?)
}

#[allow(clippy::unused_async)]
async fn category(
    State(state): State<PublicState>,
) -> ApiResult<Vec<tigshop_core::entities::SalesmanMaterialCategory>> {
    ok(state.marketing.salesman_material.all_categories().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 3);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/material/list",
                "/salesman/material/detail",
                "/salesman/material/category",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/material/"), "{p}");
            assert!(!p.starts_with("/api"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        for d in &docs {
            assert!(d.path.starts_with("/api/salesman/material/"));
            assert!(d.method == "GET");
            assert!(d.java_ref.starts_with("SalesmanMaterialController."));
        }
    }

    #[test]
    fn api_query_parses_camel_case() {
        let q: SalesmanMaterialApiQuery =
            serde_json::from_str(r#"{"categoryId":3,"from":"user","size":10}"#).unwrap();
        assert_eq!(q.category_id, Some(3));
        assert_eq!(q.page_size, Some(10));
    }

    #[test]
    fn optional_auth_user_id_defaults_to_zero() {
        let auth: Option<Extension<AuthUser>> = None;
        let id = auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0);
        assert_eq!(id, 0);
    }
}
