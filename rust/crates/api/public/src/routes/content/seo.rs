//! 商城前台 SEO 路由（content::seo）。
//!
//! 对应原 Java `com.tigshop.api.controller.sys.SeoController`
//! （`@RequestMapping("/api/sys/seo")`，5 个端点）。
//!
//! ## 原 Java 路径对照表
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |------------------------------|------------------|--------------|-----------|
//! | `GET /sys/seo/getCategoryIdBySeoLink` | `GET /api/sys/seo/getCategoryIdBySeoLink` | `SeoController.getCategoryIdBySeoLink` | optional |
//! | `GET /sys/seo/products` | `GET /api/sys/seo/products` | `SeoController.getSitemapProducts` | optional |
//! | `GET /sys/seo/categories` | `GET /api/sys/seo/categories` | `SeoController.getSitemapCategories` | optional |
//! | `GET /sys/seo/articles` | `GET /api/sys/seo/articles` | `SeoController.getSitemapArticles` | optional |
//! | `GET /sys/seo/brands` | `GET /api/sys/seo/brands` | `SeoController.getSitemapBrands` | optional |
//!
//! > **路径说明**：`@RequestMapping("/api/sys/seo")` + 方法级
//! > `@GetMapping("products")` 等拼出的就是上表完整路径，本域**没有**
//! > 「控制器名重复一次」的形式；本文件挂在 `/api` 之下，故 `routes()` 内只写
//! > `/sys/seo/...`（逐字符对齐 `rust/docs/api-contract.json`）。
//!
//! > **auth=optional 的落地口径**：契约把本域 5 条都标为 `optional`
//! > （Java `permitAll`）。Java 在 `permitAll` 之下仍挂着 JWT 过滤器：
//! > 带**合法**令牌则写入用户上下文，不带则视为游客；**令牌非法 / 过期 → 401**。
//! > 本仓库 `public/src/lib.rs` 的公开路由组没有可选登录态中间件，
//! > 故按 shop_client / wholesale_client 的既有约定，本文件自带 [`optional_auth`]。
//! >
//! > 本域 5 个 handler **都不读取登录态**（SEO 站点地图与链接反查对游客、
//! > 会员响应一致，`SeoServiceImpl` 也从不调用 `SecurityUtils.getCurrentUserId()`），
//! > 因此鉴权只影响「令牌非法时是否 401」，不影响业务分支。
//!
//! > **合并注意**：本模块**必须并入 `merge_public`**（`crates/api/public/src/routes/mod.rs`），
//! > 外层**不要**再套 `require_auth`——否则会把匿名可访问的接口变成必须登录。
//!
//! > **未迁移依赖**：`getCategoryIdBySeoLink` 在库内查不到分类时的 Redis 兜底查询
//! > 未迁移（该缓存键在全仓库无写入点，见
//! > [`tigshop_services::content::seo`] 模块头「未迁移依赖」第 2 条）；
//! > 其余 4 条站点地图接口均为纯 DB 查询，已完整迁移。

use axum::{
    extract::{Query, Request, State},
    http::header,
    response::Response,
    middleware::{self, Next},
    routing::get,
    Router,
};
use tigshop_core::models::content::seo::{
    SeoArticleVO, SeoBrandVO, SeoCategoryVO, SeoLinkQuery, SeoProductVO,
};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// SEO 前台路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/sys/seo/getCategoryIdBySeoLink", get(get_category_id_by_seo_link))
        .route("/sys/seo/products", get(get_sitemap_products))
        .route("/sys/seo/categories", get(get_sitemap_categories))
        .route("/sys/seo/articles", get(get_sitemap_articles))
        .route("/sys/seo/brands", get(get_sitemap_brands))
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
            "/api/sys/seo/getCategoryIdBySeoLink",
            "SeoController.getCategoryIdBySeoLink",
        ),
        (
            "GET",
            "/api/sys/seo/products",
            "SeoController.getSitemapProducts",
        ),
        (
            "GET",
            "/api/sys/seo/categories",
            "SeoController.getSitemapCategories",
        ),
        (
            "GET",
            "/api/sys/seo/articles",
            "SeoController.getSitemapArticles",
        ),
        ("GET", "/api/sys/seo/brands", "SeoController.getSitemapBrands"),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `routes/shop_client.rs` / `routes/wholesale_client.rs` 的实现逐行一致。
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

/// `GET /api/sys/seo/getCategoryIdBySeoLink?seoLink=`：商品分类 seoLink 转分类 ID。
///
/// 对应 Java `SeoController.getCategoryIdBySeoLink(@RequestParam("seoLink"))` →
/// `SeoServiceImpl#getCategoryIdBySeoLink`：解析出 `seoIdentification` 后按
/// `category.seo_identification` 查一行（`LIMIT 1`），未命中抛 1001
/// 「未找到对应的商品分类」。Java 返回 `Integer`，Rust 返回 `i32`。
async fn get_category_id_by_seo_link(
    State(state): State<PublicState>,
    Query(q): Query<SeoLinkQuery>,
) -> ApiResult<i32> {
    ok(state.content.seo
        .get_category_id_by_seo_link(q.seo_link.as_deref())
        .await?)
}

/// `GET /api/sys/seo/products`：站点地图-商品列表。
///
/// 对应 Java `SeoController.getSitemapProducts()` →
/// `SeoServiceImpl#getSitemapProducts`（`product_status = 1 AND is_delete = 0`）。
/// ⚠️ 返回的 `lastUpdate` 与 Java 一致为**秒级**原始 `last_update`（未换算）。
async fn get_sitemap_products(State(state): State<PublicState>) -> ApiResult<Vec<SeoProductVO>> {
    ok(state.content.seo.sitemap_products().await?)
}

/// `GET /api/sys/seo/categories`：站点地图-分类列表。
///
/// 对应 Java `SeoController.getSitemapCategories()` →
/// `SeoServiceImpl#getSitemapCategories`（`is_show = 1`，扁平列表）。
async fn get_sitemap_categories(State(state): State<PublicState>) -> ApiResult<Vec<SeoCategoryVO>> {
    ok(state.content.seo.sitemap_categories().await?)
}

/// `GET /api/sys/seo/articles`：站点地图-文章列表。
///
/// 对应 Java `SeoController.getSitemapArticles()` →
/// `SeoServiceImpl#getSitemapArticles`（`is_show = 1`，`add_time` 秒→毫秒）。
async fn get_sitemap_articles(State(state): State<PublicState>) -> ApiResult<Vec<SeoArticleVO>> {
    ok(state.content.seo.sitemap_articles().await?)
}

/// `GET /api/sys/seo/brands`：站点地图-品牌列表。
///
/// 对应 Java `SeoController.getSitemapBrands()` →
/// `SeoServiceImpl#getSitemapBrands`（先取有上架未删除商品的品牌 ID，
/// 再按 `is_show = 1` 取品牌；无候选品牌时直接返回空列表）。
async fn get_sitemap_brands(State(state): State<PublicState>) -> ApiResult<Vec<SeoBrandVO>> {
    ok(state.content.seo.sitemap_brands().await?)
}