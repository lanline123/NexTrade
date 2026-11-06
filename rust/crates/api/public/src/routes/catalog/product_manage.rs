//! 商城前台商品路由（切片 catalog::product_manage）。
//!
//! 对应原 Java `com.tigshop.api.controller.product.ProductController`
//! （`@RequestMapping("/api/product/product")`）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java |
//! |----------------------------|---------|
//! | `GET /product/product/detail` | `ProductController.detail`（`sn` 必填） |
//! | `GET /product/product/detail` | `ProductController.detailById`（`id` 必填、`sn` 不允许出现） |
//!
//! 注意：原 Java 用 `@GetMapping(value = "/detail", params = {"id", "!sn"})`
//! 让**同一个路径**按参数名分流到两个方法，HTTP 路由层无法区分，
//! 因此本模块用一个 handler 同时兼容 `?sn=` 与 `?id=`（与 Java 行为等价）。
//!
//! 权限：原契约 `auth = optional`（游客可访问，登录后返回会员相关字段），
//! 因此挂在**公开**路由组（与 `crates/api/public/src/lib.rs` 中同样公开的
//! `/product/product/list` 一致）。
//!
//! **未迁移**：评论/咨询总数、秒杀、拼团、积分兑换、批发阶梯价、
//! 收藏状态、门店（O2O）图片与库存覆盖等字段，见
//! [`tigshop_services::catalog::product_manage::ProductManageService::client_detail`]。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::product_manage::ClientProductDetailVO;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 商品域前台路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/product/product/detail", get(product_detail))
        .route(
            "/product/product/downloadRawImages",
            get(super::product_raw_image::download_raw_images),
        )
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req.headers().get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
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

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 原契约中 `ProductController.detail`（`sn`）与 `detailById`（`id`）
/// 是同一路径的两个条目，这里按一个实现上报两次，避免覆盖率漏记。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/api/product/product/detail", "ProductController.detail"),
        ("GET", "/api/product/product/detail", "ProductController.detailById"),
        ("GET", "/api/product/product/downloadRawImages", "ProductController.downloadRawImages"),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 商品详情查询参数。
///
/// - `sn`：商品货号或条形码（原 `detail` 方法）
/// - `id`：商品 ID（原 `detailById` 方法，Java 侧先查货号再走同一逻辑）
/// - `shopId` / `nearestShopId`：O2O 门店上下文（本切片未迁移门店覆盖逻辑）
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct DetailQuery {
    sn: Option<String>,
    id: Option<i32>,
    shop_id: Option<i32>,
    nearest_shop_id: Option<i32>,
}

async fn product_detail(
    State(state): State<PublicState>,
    Query(q): Query<DetailQuery>,
) -> ApiResult<ClientProductDetailVO> {
    let sn = match q.sn.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(sn) => sn.to_string(),
        // 对应 Java `getProductSnById`：按 ID 反查货号后走同一逻辑
        None => match q.id {
            Some(id) => state.catalog.product_manage
                .product_sn_by_id(id)
                .await?
                .ok_or_else(|| AppError(Error::biz(400, "商品不存在")))?,
            None => return Err(AppError(Error::biz(400, "商品不存在"))),
        },
    };
    ok(state.catalog.product_manage
        .client_detail(&sn, q.shop_id, q.nearest_shop_id)
        .await?)
}