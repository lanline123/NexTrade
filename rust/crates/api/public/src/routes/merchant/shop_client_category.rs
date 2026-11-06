//! 店铺分类 —— 商城前台路由（merchant::shop_client_category）。
//!
//! 原 Java：`com.tigshop.api.controller.shop.ShopClientCategoryController`
//! （`java/tigshop-api/src/main/java/com/tigshop/api/controller/shop/ShopClientCategoryController.java`，
//! `@RequestMapping("/api/shop/category")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由（`routes()` 内） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |----------------------------|------------------|--------------|-----------|
//! | `GET /shop/category/tree` | `GET /api/shop/category/tree` | `ShopClientCategoryController.tree` | optional |
//! | `GET /shop/category/parentTree` | `GET /api/shop/category/parentTree` | `ShopClientCategoryController.parentTree` | optional |
//!
//! > **路径说明**：`@RequestMapping("/api/shop/category")` 与
//! > `@GetMapping("/tree")` / `@GetMapping("/parentTree")` 拼出上表完整路径，
//! > 本域**没有**「控制器名重复一次」的形式。本模块挂在 `/api` 之下，
//! > 故 `routes()` 内只写 `/shop/category/tree`、`/shop/category/parentTree`；
//! > `implemented_routes()` 写**完整**契约路径（含 `/api` 前缀）。
//!
//! > **auth=optional 的落地口径**：契约两条均为 `optional`（Java `permitAll`）。
//! > Java 在 `permitAll` 之下仍挂着 JWT 过滤器（带合法令牌则写入上下文，
//! > 不带则游客，**非法令牌 → 401**）。本仓库 `public/src/lib.rs` 的公开
//! > 路由组没有可选登录态中间件，故沿用 shop_client / wholesale_client / seo 的
//! > 既有约定，本文件自带 [`optional_auth`]。两个 handler 都**不读登录态**
//! > （Java 方法体同样不读），鉴权只影响「非法令牌是否 401」。
//!
//! > **⚠️ 重复注册提示（主会话合并时必须处理）**：
//! > `crates/api/public/src/routes/shop.rs` 的 `public_routes()` 已注册
//! > `GET /shop/category/tree`，其 `implemented_routes()` 也已声明同一条
//! > 契约路径。本模块按切片清单**完整实现**该端点，因此合并前必须先删掉
//! > `routes/shop.rs` 中那条（否则 axum `Router::merge` 会在启动时 panic）。
//! > 自查：`cd rust && python tools/check_route_conflicts.py --strict`。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::shop::{ShopCategoryTreeNode, ShopParentTreeVO};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 店铺分类前台路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/shop/category/tree", get(tree))
        .route("/shop/category/parentTree", get(parent_tree))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/api/shop/category/tree",
            "ShopClientCategoryController.tree",
        ),
        (
            "GET",
            "/api/shop/category/parentTree",
            "ShopClientCategoryController.parentTree",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `routes/shop_client.rs` / `routes/wholesale_client.rs` / `routes/seo.rs`
/// 的实现逐行一致。
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

/// 分类树入参（原 Java `@RequestParam("shopId")`，必填）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryTreeQuery {
    shop_id: i32,
}

/// `GET /api/shop/category/tree?shopId=`：店铺经营类目树。
///
/// 对应 Java `ShopClientCategoryController.tree(@RequestParam("shopId")
/// Integer shopId)`（`ShopClientCategoryController.java:31`）→
/// `ShopProductCategoryServiceImpl#tree(shopId)`。
/// 仅取 `is_show = 1`，以 `parent_id = 0` 为根递归建树（节点带 `isStore=1`）。
async fn tree(
    State(state): State<PublicState>,
    Query(q): Query<CategoryTreeQuery>,
) -> ApiResult<Vec<ShopCategoryTreeNode>> {
    ok(state.merchant.shop_client_category.category_tree(q.shop_id).await?)
}

/// 父级树入参（原 Java `@RequestParam("id")`，必填）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParentTreeQuery {
    id: i32,
}

/// `GET /api/shop/category/parentTree?id=`：某分类的父级链（含同级分类）。
///
/// 对应 Java `ShopClientCategoryController.parentTree(@RequestParam("id")
/// Integer id)`（`ShopClientCategoryController.java:37`）→
/// `ShopProductCategoryServiceImpl#parentTree(id)`。
/// 自底向上取父链（最多 6 级）后反转为**根在前**，每级带同层 `catList`。
async fn parent_tree(
    State(state): State<PublicState>,
    Query(q): Query<ParentTreeQuery>,
) -> ApiResult<Vec<ShopParentTreeVO>> {
    ok(state.merchant.shop_client_category.parent_tree(q.id).await?)
}