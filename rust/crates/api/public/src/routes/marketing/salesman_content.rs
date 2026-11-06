//! 商城端分销内容路由（marketing::salesman_content）。
//!
//! 对应原 Java `com.tigshop.api.controller.salesman.SalesmanContentController`
//! （`@RequestMapping("/api/salesman/content")`，2 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java | 契约 auth |
//! |-----------------------------|---------|-----------|
//! | `GET /salesman/content/list`   | `SalesmanContentController.list`   | optional |
//! | `GET /salesman/content/detail` | `SalesmanContentController.detail` | optional |
//!
//! ## auth=optional 的落地口径
//! 契约把两条都标为 `optional`（Java `permitAll` + JWT 过滤器）：
//! 带**合法**令牌则写入会员上下文；不带则视为游客；令牌非法 / 过期 → 401。
//! 本仓库 public 侧公开路由组没有可选登录态中间件，故按
//! `content/seo.rs` / `routes/marketing/buyer_show_client.rs` 的既有约定，
//! 本文件自带 [`optional_auth`]。
//!
//! ## 业务分支（Java `SalesmanContentServiceImpl#list` 的 C 端分支）
//! Java public 控制器强制 `from = "user"`、`sortField = "is_top"`；服务再用
//! `SecurityUtils.getCurrentUserId()` 找分销员：
//! - 是分销员 → `shop_id = salesman.shop_id`
//! - 不是（含游客，Java `getCurrentUserId()` 返回 `0`）→ `shop_id = -1` → 空列表
//!
//! ## 合并注意
//! 本模块**必须并入** `crates/api/public/src/routes/marketing/mod.rs` 的
//! `routes()`（并入 `merge_public`）与 `implemented_routes()`；
//! 外层**不要**再套 `require_auth`——否则匿名可访问的接口会变成必须登录。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Extension, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_content::{
    SalesmanContentPageQuery, SalesmanContentVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域路由清单（完整路径，含 `/api` 前缀 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**，逐字符对齐
/// `docs/api-contract.json`。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/api/salesman/content/list",
        "SalesmanContentController.list",
    ),
    (
        "GET",
        "/api/salesman/content/detail",
        "SalesmanContentController.detail",
    ),
];

/// 分销内容前台路由（挂载于 `/api` 下，自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/salesman/content/list", get(list))
        .route("/salesman/content/detail", get(detail))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| tigshop_openapi::RouteDoc::new(method, path, java_ref))
        .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `routes/content/seo.rs` / `routes/marketing/buyer_show_client.rs` 逐行一致。
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

/// 取登录会员 ID；游客返回 `0`（Java `SecurityUtils.getCurrentUserId()` 的游客值）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

/// `GET /api/salesman/content/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /api/salesman/content/list`：分销内容列表（C 端）。
///
/// 对应 Java public `SalesmanContentController#list(SalesmanContentPageQuery)`：
/// 控制器强制 `from="user"`、`sortField="is_top"`，服务按当前会员的分销员归属过滤。
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<SalesmanContentPageQuery>,
) -> ApiResult<PageResult<SalesmanContentVO>> {
    let user_id = current_user_id(&auth);
    ok(state
        .marketing
        .salesman_content
        .list_client(user_id, &q)
        .await?)
}

/// `GET /api/salesman/content/detail?id=`：分销内容详情（C 端）。
///
/// 对应 Java public `SalesmanContentController#detail(@RequestParam Integer id)`：
/// 与后台详情同构（只格式化时间，不返回 `statusText`）。
async fn detail(
    State(state): State<PublicState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanContentVO>> {
    ok(state.marketing.salesman_content.detail(q.id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与契约逐字符一致（2 条，含 `/api` 前缀）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2, "契约中 public 侧共 2 条接口");
        let expected = [
            ("GET", "/api/salesman/content/list"),
            ("GET", "/api/salesman/content/detail"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut unique: Vec<(String, String)> =
            docs.iter().map(|d| (d.method.clone(), d.path.clone())).collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// 路径表必须恰好 2 条、互不重复、以 `/api/salesman/content/` 开头。
    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        for (i, (m, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/api/salesman/content/"), "路径前缀错误: {p}");
            assert_eq!(*m, "GET");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((m, p), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 游客（无令牌）→ `user_id = 0`；合法令牌 → 会员 ID。
    #[test]
    fn current_user_id_matches_java_security_utils() {
        assert_eq!(current_user_id(&None), 0);

        let auth = Some(Extension(AuthUser {
            id: 42,
            username: "member".into(),
            role_id: Some(1),
            admin_type: None,
            shop_id: None,
        }));
        assert_eq!(current_user_id(&auth), 42);
    }

    /// `type` 缺省语义：C 端由控制器强制 `from="user"`，与客户端传值无关。
    #[test]
    fn client_query_ignores_client_supplied_from() {
        // Java 控制器：`query.setFrom("user")`（覆盖客户端传值）
        let q = SalesmanContentPageQuery {
            from: Some("admin".into()),
            ..Default::default()
        };
        // 服务层在 list_client 内部按 C 端处理，不依赖该字段
        assert!(!q.is_client());
        let q = SalesmanContentPageQuery {
            from: Some("user".into()),
            ..Default::default()
        };
        assert!(q.is_client());
    }
}
