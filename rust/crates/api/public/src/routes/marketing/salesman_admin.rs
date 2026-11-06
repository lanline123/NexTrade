//! 分销员 —— 商城前台路由（marketing::salesman_admin，公共端）。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.salesman.SalesmanController`
//!   （`@RequestMapping("/api/salesman/salesman")`，5 个端点）
//! - `com.tigshop.api.controller.salesman.SalesmanCardInviteController#acceptCardInvite`
//!   （同一 URL 前缀下的 `POST /acceptCardInvite`）
//!
//! | method | path（挂载于 `/api`） | 原 Java | 契约 auth |
//! |--------|------------------------|---------|-----------|
//! | `GET`  | `/salesman/salesman/detail` | `SalesmanController.detail` | optional |
//! | `GET`  | `/salesman/salesman/customerList` | `SalesmanController.customerList` | optional |
//! | `GET`  | `/salesman/salesman/customerDetail?userId=&startTime=&endTime=` | `SalesmanController.customerDetail` | optional |
//! | `POST` | `/salesman/salesman/customerRemark` | `SalesmanController.customerRemark` | optional |
//! | `GET`  | `/salesman/salesman/userInfo?salesmanId=` | `SalesmanController.getUserInfo` | optional |
//! | `POST` | `/salesman/salesman/acceptCardInvite?salesmanId=` | `SalesmanCardInviteController.acceptCardInvite` | optional |
//!
//! # auth=optional 落地口径
//!
//! Java 这些端点在 `permitAll` 之下，但 JWT 过滤器在带合法令牌时写入用户
//! 上下文；游客 `getCurrentUserId() = 0`，业务层再抛
//! `当前用户不是分销员` / `未登录`。本文件自带 [`optional_auth`]
//! （与 `content/seo.rs` / `catalog/comment.rs` 逐行一致），`routes()` 由
//! sync_routes 并入 `merge_public`，外层不再套 `require_auth`。
//!
//! # 权限门槛
//! `customerList/customerDetail/customerRemark` 复刻 Java
//! `assertCustomerInfoViewAllowed`：`salesman_config.viewCustomerInfo == 1`
//! 才允许，否则 `暂无权限查看客户信息`（服务层实现）。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_admin::{
    CustomerApiQuery, CustomerDetailVO, CustomerListVO, CustomerRemarkDTO, SalesmanUserDetailVO,
    SalesmanUserInfoVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 6 条公共路由（去掉 `/api` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/salesman/salesman/detail", "SalesmanController.detail"),
    (
        "GET",
        "/salesman/salesman/customerList",
        "SalesmanController.customerList",
    ),
    (
        "GET",
        "/salesman/salesman/customerDetail",
        "SalesmanController.customerDetail",
    ),
    (
        "POST",
        "/salesman/salesman/customerRemark",
        "SalesmanController.customerRemark",
    ),
    (
        "GET",
        "/salesman/salesman/userInfo",
        "SalesmanController.getUserInfo",
    ),
    (
        "POST",
        "/salesman/salesman/acceptCardInvite",
        "SalesmanCardInviteController.acceptCardInvite",
    ),
];

/// 分销员公共路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/salesman/salesman/detail", get(detail))
        .route("/salesman/salesman/customerList", get(customer_list))
        .route("/salesman/salesman/customerDetail", get(customer_detail))
        .route("/salesman/salesman/customerRemark", post(customer_remark))
        .route("/salesman/salesman/userInfo", get(user_info))
        .route(
            "/salesman/salesman/acceptCardInvite",
            post(accept_card_invite),
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

/// 取登录会员 ID；游客返回 `0`（Java `getCurrentUserId` 游客语义）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

/// `GET /api/salesman/salesman/customerDetail` 的参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomerDetailQuery {
    user_id: Option<i32>,
    start_time: Option<String>,
    end_time: Option<String>,
}

/// `GET /api/salesman/salesman/userInfo` / `POST acceptCardInvite` 的参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SalesmanIdQuery {
    salesman_id: Option<i32>,
}

/// `GET /api/salesman/salesman/detail`：当前登录分销员详情。
async fn detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<SalesmanUserDetailVO> {
    ok(state
        .marketing
        .salesman_admin
        .detail_for_api(current_user_id(&auth))
        .await?)
}

/// `GET /api/salesman/salesman/customerList`：我的客户列表。
async fn customer_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<CustomerApiQuery>,
) -> ApiResult<PageResult<CustomerListVO>> {
    ok(state
        .marketing
        .salesman_admin
        .customer_api_list(current_user_id(&auth), &q)
        .await?)
}

/// `GET /api/salesman/salesman/customerDetail`：我的客户详情。
async fn customer_detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<CustomerDetailQuery>,
) -> ApiResult<CustomerDetailVO> {
    let target = q
        .user_id
        .ok_or_else(|| Error::Validation("userId不能为空".into()))?;
    ok(state
        .marketing
        .salesman_admin
        .customer_api_detail(current_user_id(&auth), target)
        .await?)
}

/// `POST /api/salesman/salesman/customerRemark`：更新客户备注。
async fn customer_remark(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<CustomerRemarkDTO>,
) -> ApiResult<()> {
    state
        .marketing
        .salesman_admin
        .update_customer_remark(current_user_id(&auth), &dto)
        .await?;
    ok(())
}

/// `GET /api/salesman/salesman/userInfo?salesmanId=`：分销员用户基础信息。
async fn user_info(
    State(state): State<PublicState>,
    Query(q): Query<SalesmanIdQuery>,
) -> ApiResult<Option<SalesmanUserInfoVO>> {
    let salesman_id = q
        .salesman_id
        .ok_or_else(|| Error::Validation("salesmanId不能为空".into()))?;
    ok(state
        .marketing
        .salesman_admin
        .user_info(salesman_id)
        .await?)
}

/// `POST /api/salesman/salesman/acceptCardInvite?salesmanId=`：接受名片邀请。
async fn accept_card_invite(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<SalesmanIdQuery>,
) -> ApiResult<()> {
    let salesman_id = q
        .salesman_id
        .ok_or_else(|| Error::Validation("salesmanId不能为空".into()))?;
    state
        .marketing
        .salesman_admin
        .accept_card_invite(current_user_id(&auth), salesman_id)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/salesman/salesman/detail",
                "/salesman/salesman/customerList",
                "/salesman/salesman/customerDetail",
                "/salesman/salesman/customerRemark",
                "/salesman/salesman/userInfo",
                "/salesman/salesman/acceptCardInvite",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/salesman/"), "{p}");
            assert!(!p.starts_with("/api"));
        }
        // acceptCardInvite 在 Java 是 POST（SalesmanCardInviteController）
        assert_eq!(
            ROUTE_TABLE
                .iter()
                .find(|(_, p, _)| *p == "/salesman/salesman/acceptCardInvite")
                .map(|(m, _, _)| *m),
            Some("POST")
        );
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        for d in &docs {
            assert!(d.path.starts_with("/api/salesman/salesman/"));
        }
        let gets: Vec<&str> = docs
            .iter()
            .filter(|d| d.method == "GET")
            .map(|d| d.path.as_str())
            .collect();
        assert_eq!(
            gets,
            vec![
                "/api/salesman/salesman/detail",
                "/api/salesman/salesman/customerList",
                "/api/salesman/salesman/customerDetail",
                "/api/salesman/salesman/userInfo",
            ]
        );
        // 两个 POST：customerRemark + acceptCardInvite
        let posts: Vec<&str> = docs
            .iter()
            .filter(|d| d.method == "POST")
            .map(|d| d.path.as_str())
            .collect();
        assert_eq!(
            posts,
            vec![
                "/api/salesman/salesman/customerRemark",
                "/api/salesman/salesman/acceptCardInvite",
            ]
        );
        assert!(docs
            .iter()
            .any(|d| d.java_ref == "SalesmanCardInviteController.acceptCardInvite"));
    }

    #[test]
    fn guest_user_id_is_zero() {
        assert_eq!(current_user_id(&None), 0);
        assert_eq!(
            current_user_id(&Some(Extension(AuthUser {
                id: 12,
                username: "u".into(),
                role_id: None,
                admin_type: None,
                shop_id: None,
            }))),
            12
        );
    }

    #[test]
    fn queries_parse_camel_case() {
        let q: CustomerApiQuery = serde_json::from_str(
            r#"{"page":2,"size":20,"customerType":"ordered","startTime":"2023-11-01","endTime":"2023-11-30"}"#,
        )
        .unwrap();
        assert_eq!(q.page_size, Some(20));
        assert_eq!(q.normalized_customer_type(), "ordered");
        assert_eq!(q.start_time.as_deref(), Some("2023-11-01"));
        let d: CustomerDetailQuery =
            serde_json::from_str(r#"{"userId":9,"startTime":"2023-11-01"}"#).unwrap();
        assert_eq!(d.user_id, Some(9));
        let s: SalesmanIdQuery = serde_json::from_str(r#"{"salesmanId":3}"#).unwrap();
        assert_eq!(s.salesman_id, Some(3));
        let r: CustomerRemarkDTO =
            serde_json::from_str(r#"{"userId":9,"remark":"重点客户"}"#).unwrap();
        assert_eq!(r.user_id, Some(9));
        assert_eq!(r.remark.as_deref(), Some("重点客户"));
    }
}
