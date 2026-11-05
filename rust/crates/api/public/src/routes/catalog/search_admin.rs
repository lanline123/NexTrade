//! 商城前台商品搜索路由（catalog::search_admin，3 条）。
//!
//! 对应原 Java `com.tigshop.api.controller.search.SearchController`
//! （`@RequestMapping("/api/search/search")`）：
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |-----------------------------|--------------|-----------|
//! | `POST /search/search/getProduct` | `SearchController.list` | optional |
//! | `POST /search/search/getFilter` | `SearchController.getFilter` | optional |
//! | `GET  /search/search/getAttributeSuggestions` | `SearchController.getAttributeSuggestions` | optional |
//! | `POST /search/search/getEsFilter` | PC 搜索页属性筛选项（5.8.61 前端调用，Java 后端快照未含此路由） | optional |
//!
//! 同 feature 的管理端 2 条在
//! `crates/api/admin/src/routes/catalog/search_admin.rs`。
//!
//! > **auth=optional 口径**：3 条在 Java 均为 `permitAll`（带合法 JWT 时写入
//! > 用户上下文），本文件自带 [`optional_auth`]（同 `content/seo.rs` /
//! > `catalog/comment.rs` 的既有实现），由 `sync_routes.py` 并入
//! > `merge_public`，外层不再套 `require_auth`。
//!
//! > **未迁移**：ES 搜索分支（无 ES 依赖，恒走 MySQL，等价 Java 回退路径）；
//! > 店铺分类筛选项（跨店铺域）恒为 `null`；营销/批发/周期购等扩展过滤仅解析
//! > 不使用。详见 `tigshop_services::catalog::search_admin` 模块头。

use axum::{
    extract::{Json, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
// GET 查询参数含数组字段（`posProductSource` / `attrs`），axum 内置的
// serde_urlencoded 不支持序列类型；沿用 product_manage 的 axum-extra Query。
use axum_extra::extract::Query;
use tigshop_core::models::catalog::search_admin::{
    AttributeSuggestionVO, ProductSearchClientQuery, SearchFilterVO,
};
use tigshop_core::models::catalog::product::ProductVO;
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本模块负责的 3 条前台路由（`/api` 前缀之后的路径）。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "POST",
        "/search/search/getProduct",
        "SearchController.list",
    ),
    (
        "POST",
        "/search/search/getFilter",
        "SearchController.getFilter",
    ),
    (
        "GET",
        "/search/search/getAttributeSuggestions",
        "SearchController.getAttributeSuggestions",
    ),
    (
        "POST",
        "/search/search/getEsFilter",
        "SearchController.getEsFilter",
    ),
];

/// 前台商品搜索路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/search/search/getProduct", post(get_product))
        .route("/search/search/getFilter", post(get_filter))
        .route(
            "/search/search/getAttributeSuggestions",
            get(get_attribute_suggestions),
        )
        .route("/search/search/getEsFilter", post(get_es_filter))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
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

/// `POST /api/search/search/getProduct`：商品搜索分页。
///
/// 对应 Java `SearchController#list(@RequestBody ProductSearchClientDTO)`。
async fn get_product(
    State(state): State<PublicState>,
    Json(dto): Json<ProductSearchClientQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    let page = state.catalog.search_admin.search_products(&dto).await?;
    let total = page.total;
    let list = page
        .list
        .into_iter()
        .map(|p| {
            // 原版 ProductListResDTO 同时返回 productPrice 和 price；
            // 商品卡读 `price`，销量读 `virtualSales`。
            let price = serde_json::to_value(p.product_price).unwrap_or_default();
            let mut value = serde_json::to_value(&p).unwrap_or_else(|_| serde_json::json!({}));
            if let Some(obj) = value.as_object_mut() {
                obj.insert("price".into(), price.clone());
                obj.insert("orgProductPrice".into(), price);
                obj.insert("virtualSales".into(), serde_json::json!(p.sales));
                obj.entry("productSku").or_insert_with(|| serde_json::json!([]));
                obj.entry("deliveryMode").or_insert_with(|| serde_json::json!(1));
            }
            value
        })
        .collect();
    ok(PageResult::new(total, list, &dto.page_query()))
}

/// `POST /api/search/search/getFilter`：商品筛选（分类 / 品牌 / 最高价 + 已选）。
async fn get_filter(
    State(state): State<PublicState>,
    Json(dto): Json<ProductSearchClientQuery>,
) -> ApiResult<SearchFilterVO> {
    ok(state.catalog.search_admin.get_filter(&dto).await?)
}

/// `GET /api/search/search/getAttributeSuggestions`：属性搜索建议。
///
/// Java 组装为 `Map{"attributes": [...]}`；本实现返回同构 JSON。
async fn get_attribute_suggestions(
    State(state): State<PublicState>,
    Query(q): Query<ProductSearchClientQuery>,
) -> ApiResult<serde_json::Value> {
    let attributes: Vec<AttributeSuggestionVO> =
        state.catalog.search_admin.attribute_suggestions(&q).await?;
    ok(serde_json::json!({ "attributes": attributes }))
}

/// `POST /api/search/search/getEsFilter`：PC 搜索页「ES 属性筛选项」。
///
/// 原版 PC 前端（`view/pc/pages/search/components/api.ts#getSearchEsFilter`）
/// 调用该路径获取 `{ attributes: [{ name, values: [{ value }] }] }`；5.8.61 的
/// Java 后端快照（`SearchController`）只有 getProduct/getFilter/
/// getAttributeSuggestions，新 PC 搜索页已按旧前端保留该调用 —— 缺失会让属性
/// 筛选面板永远为空，属 PC 阻塞缺口。
///
/// 本实现无 Elasticsearch 依赖（与 `getAttributeSuggestions` 一致，恒走 MySQL
/// 回退）：复用 `product_attributes`（`attr_type = 0`）聚合，响应结构与
/// `attributeSuggestions` 相同（`values[].count` 为附加字段，PC 端忽略）。
async fn get_es_filter(
    State(state): State<PublicState>,
    Json(dto): Json<ProductSearchClientQuery>,
) -> ApiResult<serde_json::Value> {
    let attributes: Vec<AttributeSuggestionVO> =
        state.catalog.search_admin.attribute_suggestions(&dto).await?;
    ok(serde_json::json!({ "attributes": attributes }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4);
        let expected = [
            (
                "POST",
                "/api/search/search/getProduct",
                "SearchController.list",
            ),
            (
                "POST",
                "/api/search/search/getFilter",
                "SearchController.getFilter",
            ),
            (
                "GET",
                "/api/search/search/getAttributeSuggestions",
                "SearchController.getAttributeSuggestions",
            ),
            (
                "POST",
                "/api/search/search/getEsFilter",
                "SearchController.getEsFilter",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                docs.iter()
                    .any(|d| d.method == method && d.path == path && d.java_ref == handler),
                "缺少 {method} {path}"
            );
        }
    }

    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            ("POST", "/search/search/getProduct"),
            ("POST", "/search/search/getFilter"),
            ("GET", "/search/search/getAttributeSuggestions"),
            ("POST", "/search/search/getEsFilter"),
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        for (method, path, _) in ROUTE_TABLE.iter() {
            assert!(
                registered.iter().any(|(m, p)| m == method && p == path),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }
}
