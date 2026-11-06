//! 商城端统计日志路由（system::log）。
//!
//! 对应原 Java `com.tigshop.api.controller.common.LogController`
//! （`@RequestMapping("/api/common/log")` + `@GetMapping("")`，1 个端点）：
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |-----------------------------|--------------|-----------|
//! | `GET /common/log` | `LogController.create` | optional |
//!
//! > **为什么注册在 `anonymous_routes`**：该路径在 Java
//! > `WhiteListConfig.URL_WHITELIST`（`/api/common/log`）里，即**免登录**；
//! > 但 `JwtAuthenticationFilter` 对白名单路径仍是「带了合法 token 就写入登录态」，
//! > 因此契约 auth 是 `optional`。本模块仿照 `catalog/comment` 的既有约定，
//! > 在匿名路由内部自带 [`optional_auth`] 中间件：
//! > 无 token / token 非法 ⇒ 游客（会员 ID = 0）；合法 token ⇒ 写入 [`AuthUser`]。
//!
//! > **`shop_id` 来源**：Java `StatisticsBaseServiceImpl` 里的 `getShopId()` 是
//! > `HeaderUtils.getShopId()`（**只读请求头**，与登录态无关）：
//! > `x-admin-type: admin` ⇒ 0；`shop|pos` ⇒ `x-shop-id`；其它/缺失 ⇒ null。
//! > 本模块用 [`shop_filter_from_headers`] 逐分支复刻。

use axum::{
    extract::{Extension, Query, Request, State},
    http::{header, HeaderMap},
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::system::log::StatisticsBaseCreateDTO;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本模块全部路由（去掉 `/api` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [("GET", "/common/log", "LogController.create")];

/// 匿名路由（需要 state；模块内自带可选登录态中间件）。
///
/// `sync_routes.py` 会把它并入 `routes/system/mod.rs` 的 `anonymous_routes`，
/// 外层不再套 `require_auth`。
pub fn anonymous_routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/common/log", get(create))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/api{path}"), handler))
        .collect()
}

/// 可选登录态中间件（对应 Java 白名单 + `JwtAuthenticationFilter`）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `catalog/comment.rs` / `content/seo.rs` 的实现逐行一致。
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

/// `GET /api/common/log`：创建日志 / 统计记录。
///
/// 对应 Java `LogController#create(StatisticsBaseCreateDTO createDTO)`
/// （GET 查询参数绑定，原返回 void）。当前会员 ID 来自可选 JWT；
/// `shop_id` 按 `HeaderUtils.getShopId()` 语义取请求头。
async fn create(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    headers: HeaderMap,
    Query(dto): Query<StatisticsBaseCreateDTO>,
) -> ApiResult<()> {
    let user_id = auth
        .as_ref()
        .map(|Extension(auth)| auth.id)
        .unwrap_or(0);
    let shop_id = shop_filter_from_headers(&headers);
    state.system.log.create(&dto, user_id, shop_id).await?;
    ok(())
}

// ——————————————————————————————————————————————
// 请求头 → 店铺过滤值（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 解析 Java `HeaderUtils.getShopId()` 的语义：
///
/// - `x-admin-type: admin` ⇒ `Some(0)`（平台账号）
/// - `x-admin-type: shop|pos` ⇒ `Some(x-shop-id)`；缺失/非法 ⇒ `None`
///   （Java 对空 `x-shop-id` 返回 `null`，对非数字会 `NumberFormatException`
///   → 500；这里按 `None` 处理，见 `uncertain_points`）
/// - 其它/缺失 ⇒ `None`（Java 返回 `null`）
#[must_use]
fn shop_filter_from_headers(headers: &HeaderMap) -> Option<i32> {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => {
            header_str(headers, "x-shop-id").and_then(|v| v.trim().parse::<i32>().ok())
        }
        _ => None,
    }
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    /// `implemented_routes()` 必须与 Java 契约逐字符一致。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/api/common/log");
        assert_eq!(docs[0].java_ref, "LogController.create");
    }

    /// `ROUTE_TABLE` 与 `anonymous_routes()` 一一对应。
    #[test]
    fn anonymous_routes_registers_every_route_table_entry() {
        let registered = ["/common/log"];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 anonymous_routes() 中注册");
        }
    }

    /// 请求头 → 店铺过滤值，逐分支对齐 Java `HeaderUtils.getShopId()`。
    #[test]
    fn shop_filter_matches_header_utils() {
        // 平台账号 ⇒ 0（不是 None）
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            Some(0)
        );
        // 店铺 / 门店 ⇒ x-shop-id
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            Some(9)
        );
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            Some(3)
        );
        // 店铺账号缺 / 非法 x-shop-id ⇒ null ⇒ 不累加店铺维度
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop")])),
            None
        );
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            None
        );
        // 缺失 / 未知 admin-type ⇒ null
        assert_eq!(shop_filter_from_headers(&headers(&[])), None);
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "vendor")])),
            None
        );
    }

    /// GET 查询参数按 Java 名（camelCase）绑定；全缺省也合法。
    #[test]
    fn query_dto_binds_optional_camel_case_params() {
        let dto: StatisticsBaseCreateDTO =
            serde_json::from_str(r#"{"isNew":1,"productId":7,"shopCategoryId":3}"#).unwrap();
        assert_eq!(dto.is_new, Some(1));
        let dto: StatisticsBaseCreateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.is_new, None);
        assert!(!dto.needs_detail_log());
    }
}
