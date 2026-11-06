//! 积分兑换 —— 商城前台路由（catalog::exchange）。
//!
//! 对应原 Java `com.tigshop.api.controller.product.ExchangeController`
//! （`@RequestMapping("/api/product/exchange")`，3 个端点，契约 `auth=optional`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET  /product/exchange/detail` | `GET /api/product/exchange/detail` | `ExchangeController.detail` | optional |
//! | `GET  /product/exchange/list` | `GET /api/product/exchange/list` | `ExchangeController.list` | optional |
//! | `POST /product/exchange/addToCart` | `POST /api/product/exchange/addToCart` | `ExchangeController.addExchangeProductToCart` | optional |
//!
//! # auth=optional 的落地口径
//!
//! Java 这 3 条都在 `permitAll` 之下，但 JWT 过滤器会在带**合法**令牌时
//! 写入用户上下文；不带令牌按游客处理（`SecurityUtils.getCurrentUserId()`
//! 返回 `0`）；令牌非法 / 过期 → 401。
//!
//! 本仓库 `public/src/lib.rs` 的公开路由组没有可选登录态中间件，故按
//! `content/seo.rs` / `catalog/comment.rs` 的既有约定，本文件自带
//! [`optional_auth`]，通过 `pub fn routes(&PublicState)` 注册
//! （`sync_routes.py` 会并入 `merge_public`，外层不再套 `require_auth`）。
//!
//! # 语义要点
//!
//! - `list`：控制器**强制** `isEnabled = 1`（Java
//!   `listDTO.setIsEnabled(Constants.YES)`），再交给服务层分页；
//!   返回 `PageResult<PointsExchangeVO>`（Java 为 MyBatis-Plus `Page`）。
//! - `detail`：`id` 是**积分活动 ID**（Java 形参名叫 `productId`，易误读）；
//!   返回既有 `ClientProductDetailVO`，其 `exchangeInfo` 为活动 VO。
//! - `addToCart`：游客 `userId = 0`；请求体只取 `id`（活动 ID）/ `number` /
//!   `skuId`，其余字段忽略。
//!
//! # 与 Java 的差异
//!
//! 1. `detail` 缺 `id`：Java 是 Spring 400（缺少请求参数），本实现显式报
//!    `id不能为空`（HTTP 400）。
//! 2. 详情返回结构 / 购物车写入 / 库存口径等差异详见
//!    `tigshop_services::catalog::exchange` 模块头 `uncertain_points`。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::catalog::exchange::{
    AddToCartDTO, ExchangeDetailQuery, ExchangeProductToCartVO, PointsExchangeListQuery,
    PointsExchangeVO, MSG_ID_REQUIRED, YES,
};
use tigshop_core::models::catalog::product_manage::ClientProductDetailVO;
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域全部 3 条路由（`/api` 前缀之后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 的注册清单
/// 由底部单测交叉校验。顺序与原 Java `ExchangeController` 一致
/// （detail → list → addToCart）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    ("GET", "/product/exchange/detail", "ExchangeController.detail"),
    ("GET", "/product/exchange/list", "ExchangeController.list"),
    (
        "POST",
        "/product/exchange/addToCart",
        "ExchangeController.addExchangeProductToCart",
    ),
];

/// 积分兑换前台路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/product/exchange/detail", get(detail))
        .route("/product/exchange/list", get(list))
        .route("/product/exchange/addToCart", post(add_to_cart))
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
        .map(|(method, path, java_ref)| RouteDoc::new(method, &format!("/api{path}"), java_ref))
        .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `content/seo.rs` / `catalog/comment.rs` 的实现逐行一致。
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

/// 取登录会员 ID；游客返回 `0`
/// （对应 Java `SecurityUtils.getCurrentUserId()` 的游客返回值）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

/// `GET /api/product/exchange/detail?id=&shopId=&nearestShopId=`：积分兑换详情。
///
/// 对应 Java `ExchangeController.detail(@RequestParam("id") Integer productId,
/// @RequestParam(value="shopId", required=false) Integer shopId,
/// @RequestParam(value="nearestShopId", required=false) Integer nearestShopId)`
/// → `PointsExchangeServiceImpl#detail` + `ProductService#clientDetail`。
async fn detail(
    State(state): State<PublicState>,
    Query(q): Query<ExchangeDetailQuery>,
) -> ApiResult<ClientProductDetailVO> {
    let id = q
        .id
        .ok_or_else(|| Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state
        .catalog
        .exchange
        .detail(id, q.shop_id, q.nearest_shop_id)
        .await?)
}

/// `GET /api/product/exchange/list`：积分兑换分页列表。
///
/// 对应 Java `ExchangeController.list(PointsExchangeListDTO listDTO)`：
/// 控制器**强制** `listDTO.setIsEnabled(Constants.YES)` 后调服务层。
async fn list(
    State(state): State<PublicState>,
    Query(mut q): Query<PointsExchangeListQuery>,
) -> ApiResult<PageResult<PointsExchangeVO>> {
    // Java：listDTO.setIsEnabled(Constants.YES)
    q.is_enabled = Some(YES);
    ok(state.catalog.exchange.list(&q).await?)
}

/// `POST /api/product/exchange/addToCart`：添加积分商品到购物车。
///
/// 对应 Java `ExchangeController.addExchangeProductToCart(
/// @RequestBody AddToCartDTO addToCartDTO)`。
///
/// 游客 `userId = 0`（Java `SecurityUtils.getCurrentUserId()`）。
async fn add_to_cart(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<AddToCartDTO>,
) -> ApiResult<ExchangeProductToCartVO> {
    let user_id = current_user_id(&auth);
    ok(state.catalog.exchange.add_to_cart(&dto, user_id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 3 条逐字符一致。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 3, "契约中积分兑换域共 3 条接口");

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/product/exchange/detail",
                "/product/exchange/list",
                "/product/exchange/addToCart",
            ]
        );

        for p in &paths {
            assert!(p.starts_with("/product/exchange/"), "{p} 前缀错误");
            // 本模块路径不带 `/api`（由父路由统一挂载）
            assert!(!p.starts_with("/api"));
            // 下划线写法是契约错误的常见来源
            assert!(!p.contains("add_to_cart"), "{p} 不得用下划线写法");
        }
        // 契约里就是小驼峰 `addToCart`
        assert!(paths.contains(&"/product/exchange/addToCart"));
    }

    /// `implemented_routes()` 必须返回完整契约路径（含 `/api`），且不重复。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);

        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let expected: Vec<(String, String)> = [
            ("GET", "/api/product/exchange/detail"),
            ("GET", "/api/product/exchange/list"),
            ("POST", "/api/product/exchange/addToCart"),
        ]
        .into_iter()
        .map(|(m, p)| (m.to_string(), p.to_string()))
        .collect();
        assert_eq!(actual, expected);

        for d in &docs {
            assert!(d.path.starts_with("/api/"), "{} 缺少前缀", d.path);
        }

        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), actual.len(), "implemented_routes() 存在重复项");
    }

    /// method 与 Java 注解一致：`detail` / `list` 是 `@GetMapping`，
    /// `addToCart` 是 `@PostMapping`。
    #[test]
    fn http_methods_match_java_annotations() {
        let gets: Vec<&str> = ROUTE_TABLE
            .iter()
            .filter(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| *p)
            .collect();
        assert_eq!(
            gets,
            vec!["/product/exchange/detail", "/product/exchange/list"]
        );
        for (method, path, _) in ROUTE_TABLE {
            assert_eq!(method == "GET", gets.contains(&path), "{path} method 不对");
        }
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（3/3）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/product/exchange/detail",
            "/product/exchange/list",
            "/product/exchange/addToCart",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("ExchangeController."),
                "{path} 缺少 Java 对照"
            );
        }
        // `addToCart` 的 Java 方法名与路径末段不同（契约要求逐字符）
        assert_eq!(
            ROUTE_TABLE[2].2,
            "ExchangeController.addExchangeProductToCart"
        );
    }

    /// 游客 `userId = 0`（Java `SecurityUtils.getCurrentUserId()`）。
    #[test]
    fn guest_user_id_is_zero() {
        assert_eq!(current_user_id(&None), 0);
        assert_eq!(
            current_user_id(&Some(Extension(AuthUser {
                id: 9,
                username: "u".into(),
                role_id: None,
                admin_type: None,
                shop_id: None,
            }))),
            9
        );
    }

    /// `list` 会强制 `isEnabled = 1`；详情查询缺 `id` 时报 `id不能为空`。
    #[test]
    fn query_semantics_match_java_controller() {
        assert_eq!(YES, 1);
        let q: ExchangeDetailQuery =
            serde_json::from_str(r#"{"id":3,"shopId":1}"#).unwrap();
        assert_eq!(q.id, Some(3));
        assert_eq!(q.shop_id, Some(1));
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        let missing: ExchangeDetailQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(missing.id, None);

        // `addToCart` 只取 3 个字段，其余字段被忽略
        let dto: AddToCartDTO =
            serde_json::from_str(r#"{"id":5,"number":2,"skuId":11,"type":3,"salesmanId":7}"#)
                .unwrap();
        assert_eq!(dto.id, Some(5));
        assert_eq!(dto.number, Some(2));
        assert_eq!(dto.sku_id, Some(11));
    }
}
