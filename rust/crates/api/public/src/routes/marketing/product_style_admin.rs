//! 商品样式 —— 商城前台路由（marketing::product_style_admin，公共端）。
//!
//! 对应原 Java `com.tigshop.api.controller.product.ProductStyleController`
//! （`@RequestMapping("/api/product/productStyle")`，3 个端点；admin 4 层
//! 已在 `marketing/product_style_admin` 迁移完成，本文件只补公共端）。
//!
//! | method | path（挂载于 `/api`） | 原 Java | 契约 auth |
//! |--------|------------------------|---------|-----------|
//! | `GET`  | `/product/productStyle/activeStyle?productId=` | `getActiveStyle` | optional |
//! | `GET`  | `/product/productStyle/batchActiveStyle?productIds=1,2` | `batchGetActiveStyles` | optional |
//! | `GET`  | `/product/productStyle/batchActiveStyleBySn?productSns=A,B` | `batchGetActiveStylesBySns` | optional |
//!
//! # 参数绑定
//! Java `@RequestParam("productIds") List<Integer>` 同时接受 `1,2` 与重复参数；
//! Rust 用逗号分隔字符串（`productIds` / `productSns`），空段忽略。
//!
//! # auth=optional 口径
//! Java 该控制器无 `@PreAuthorize`（公开读），但仍经 JWT 过滤器；本文件自带
//! `optional_auth`（与 `content/seo.rs` 一致），`routes()` 由 sync_routes
//! 并入 `merge_public`。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use serde::Deserialize;
use std::collections::BTreeMap;
use tigshop_core::models::marketing::product_style_admin::ProductActiveStyleVO;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 3 条公共路由（去掉 `/api` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "GET",
        "/product/productStyle/activeStyle",
        "ProductStyleController.getActiveStyle",
    ),
    (
        "GET",
        "/product/productStyle/batchActiveStyle",
        "ProductStyleController.batchGetActiveStyles",
    ),
    (
        "GET",
        "/product/productStyle/batchActiveStyleBySn",
        "ProductStyleController.batchGetActiveStylesBySns",
    ),
];

/// 样式公共路由（`/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/product/productStyle/activeStyle", get(active_style))
        .route("/product/productStyle/batchActiveStyle", get(batch_active_style))
        .route(
            "/product/productStyle/batchActiveStyleBySn",
            get(batch_active_style_by_sn),
        )
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

/// `activeStyle` 参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActiveStyleQuery {
    product_id: Option<i32>,
    /// 兼容 Java 的 `productId` 复数写法（本端点取首个）。
    product_ids: Option<String>,
}

/// `batchActiveStyle` 参数（csv）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchActiveStyleQuery {
    product_ids: Option<String>,
}

/// `batchActiveStyleBySn` 参数（csv）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchActiveStyleBySnQuery {
    product_sns: Option<String>,
}

/// 解析逗号分隔 i32 列表（忽略空段/非法值，去重保序）。
#[must_use]
fn parse_i32_csv(raw: Option<&str>) -> Vec<i32> {
    let mut out: Vec<i32> = Vec::new();
    for part in raw.unwrap_or_default().split(',') {
        if let Ok(v) = part.trim().parse::<i32>() {
            if !out.contains(&v) {
                out.push(v);
            }
        }
    }
    out
}

/// 解析逗号分隔字符串列表（忽略空段，去重保序）。
#[must_use]
fn parse_str_csv(raw: Option<&str>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for part in raw.unwrap_or_default().split(',') {
        let v = part.trim();
        if !v.is_empty() && !out.iter().any(|x| x == v) {
            out.push(v.to_string());
        }
    }
    out
}

async fn active_style(
    State(state): State<PublicState>,
    _auth: Option<Extension<AuthUser>>,
    Query(q): Query<ActiveStyleQuery>,
) -> ApiResult<ProductActiveStyleVO> {
    let product_id = q
        .product_id
        .or_else(|| parse_i32_csv(q.product_ids.as_deref()).first().copied())
        .ok_or_else(|| Error::Validation("productId不能为空".into()))?;
    ok(state
        .marketing
        .product_style_admin
        .get_active_style(product_id)
        .await?)
}

async fn batch_active_style(
    State(state): State<PublicState>,
    _auth: Option<Extension<AuthUser>>,
    Query(q): Query<BatchActiveStyleQuery>,
) -> ApiResult<BTreeMap<i32, ProductActiveStyleVO>> {
    let ids = parse_i32_csv(q.product_ids.as_deref());
    ok(state
        .marketing
        .product_style_admin
        .batch_get_active_styles(&ids)
        .await?)
}

async fn batch_active_style_by_sn(
    State(state): State<PublicState>,
    _auth: Option<Extension<AuthUser>>,
    Query(q): Query<BatchActiveStyleBySnQuery>,
) -> ApiResult<BTreeMap<String, ProductActiveStyleVO>> {
    let sns = parse_str_csv(q.product_sns.as_deref());
    ok(state
        .marketing
        .product_style_admin
        .batch_get_active_styles_by_sns(&sns)
        .await?)
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
                "/product/productStyle/activeStyle",
                "/product/productStyle/batchActiveStyle",
                "/product/productStyle/batchActiveStyleBySn",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/product/productStyle/"), "{p}");
            assert!(!p.starts_with("/api"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        for d in &docs {
            assert!(d.path.starts_with("/api/product/productStyle/"));
            assert_eq!(d.method, "GET");
            assert!(d.java_ref.starts_with("ProductStyleController."));
        }
    }

    #[test]
    fn csv_parsing_dedupes_and_ignores_invalid() {
        assert_eq!(parse_i32_csv(Some("1, 2,2, x ,3")), vec![1, 2, 3]);
        assert!(parse_i32_csv(None).is_empty());
        assert_eq!(
            parse_str_csv(Some("SN1, SN2 ,,SN1")),
            vec!["SN1".to_string(), "SN2".to_string()]
        );
        assert!(parse_str_csv(Some("")).is_empty());
    }

    #[test]
    fn queries_parse_camel_case() {
        let q: ActiveStyleQuery =
            serde_json::from_str(r#"{"productId":9,"productIds":"1,2"}"#).unwrap();
        assert_eq!(q.product_id, Some(9));
        let b: BatchActiveStyleQuery =
            serde_json::from_str(r#"{"productIds":"3,4"}"#).unwrap();
        assert_eq!(parse_i32_csv(b.product_ids.as_deref()), vec![3, 4]);
        let s: BatchActiveStyleBySnQuery =
            serde_json::from_str(r#"{"productSns":"A,B"}"#).unwrap();
        assert_eq!(parse_str_csv(s.product_sns.as_deref()), vec!["A", "B"]);
    }
}
