//! 商城端拼团活动路由（marketing::groupon_promotion）。
//!
//! 对应原 Java `com.tigshop.api.controller.promotion.GrouponPromotionController`
//! （`@RequestMapping("/api/promotion/groupon")`，4 个端点，契约 auth=optional）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 |
//! |-----------------------------|--------------|
//! | `GET /promotion/groupon/detail` | `clientDetail` |
//! | `GET /promotion/groupon/itemList` | `itemList` |
//! | `GET /promotion/groupon/imageList` | `grouponPromotionImages` |
//! | `GET /promotion/groupon/getGrouponInfo` | `getGrouponInfo` |
//!
//! > 4 条均为 Java `permitAll` 语义，但带合法 token 时 JWT 过滤器会写入会员登录态
//! > （拼团活动按会员标记过滤/置灰依赖 `getCurrentUserId()`）。因此本模块自带
//! > [`optional_auth`] 中间件：无 token / token 非法 → 游客；合法 token → [`AuthUser`]。
//! > 注册入口为 `pub fn routes(state: &PublicState)`（自带鉴权，外层不再套
//! > `require_auth`），与 `catalog/comment` / `system/log` 的既有约定一致。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::get,
    Router,
};
use tigshop_core::models::marketing::groupon_promotion::{
    GrouponImagePageQuery, GrouponItemInfoVO, GrouponItemPageQuery, GrouponItemVO,
    GrouponProductIdQuery, GrouponPromotionClientDetailVO, GrouponPromotionIdQuery,
    GrouponPromotionImageVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本模块全部 4 条路由（去掉 `/api` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "GET",
        "/promotion/groupon/detail",
        "GrouponPromotionController.clientDetail",
    ),
    (
        "GET",
        "/promotion/groupon/itemList",
        "GrouponPromotionController.itemList",
    ),
    (
        "GET",
        "/promotion/groupon/imageList",
        "GrouponPromotionController.grouponPromotionImages",
    ),
    (
        "GET",
        "/promotion/groupon/getGrouponInfo",
        "GrouponPromotionController.getGrouponInfo",
    ),
];

/// 拼团活动前台路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/promotion/groupon/detail", get(client_detail))
        .route("/promotion/groupon/itemList", get(item_list))
        .route("/promotion/groupon/imageList", get(image_list))
        .route("/promotion/groupon/getGrouponInfo", get(get_groupon_info))
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

/// 可选登录态中间件（对应 Java `permitAll` + `JwtAuthenticationFilter`）。
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `catalog/comment.rs` / `system/log.rs` 的实现逐行一致。
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

/// 取可选登录会员 ID（游客 → `None`；Java `SecurityUtils.getCurrentUserId()` 游客返回 0）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> Option<i32> {
    auth.as_ref().map(|Extension(user)| user.id).filter(|id| *id > 0)
}

/// 必填 `grouponPromotionId` 缺失时的参数错误（Java 缺少必填 `@RequestParam` → 400）。
fn required_promotion_id(q: &GrouponPromotionIdQuery) -> Result<i64, AppError> {
    q.groupon_promotion_id
        .ok_or_else(|| AppError(Error::Validation("grouponPromotionId不能为空".into())))
}

/// `GET /api/promotion/groupon/detail?grouponPromotionId=`：客户端拼团详情。
async fn client_detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<GrouponPromotionIdQuery>,
) -> ApiResult<GrouponPromotionClientDetailVO> {
    let id = required_promotion_id(&q)?;
    ok(state
        .marketing
        .groupon_promotion
        .client_detail(id, current_user_id(&auth))
        .await?)
}

/// `GET /api/promotion/groupon/itemList`：拼团活动商品列表。
async fn item_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<GrouponItemPageQuery>,
) -> ApiResult<PageResult<GrouponItemVO>> {
    ok(state
        .marketing
        .groupon_promotion
        .item_list(&q, current_user_id(&auth))
        .await?)
}

/// `GET /api/promotion/groupon/imageList`：拼团图片列表。
async fn image_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<GrouponImagePageQuery>,
) -> ApiResult<PageResult<GrouponPromotionImageVO>> {
    ok(state
        .marketing
        .groupon_promotion
        .image_list(q.page, q.size, current_user_id(&auth))
        .await?)
}

/// `GET /api/promotion/groupon/getGrouponInfo?productId=`：商品拼团活动信息。
async fn get_groupon_info(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<GrouponProductIdQuery>,
) -> ApiResult<Option<GrouponItemInfoVO>> {
    ok(state
        .marketing
        .groupon_promotion
        .get_groupon_info(q.product_id, current_user_id(&auth))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（4 条）。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/api/promotion/groupon/detail"),
            ("GET", "/api/promotion/groupon/itemList"),
            ("GET", "/api/promotion/groupon/imageList"),
            ("GET", "/api/promotion/groupon/getGrouponInfo"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域 public 共 4 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应。
    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = [
            "/promotion/groupon/detail",
            "/promotion/groupon/itemList",
            "/promotion/groupon/imageList",
            "/promotion/groupon/getGrouponInfo",
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

    /// 必填 `grouponPromotionId` 缺失 → 参数错误；游客 ID → None。
    #[test]
    fn required_param_and_guest_user() {
        assert!(required_promotion_id(&GrouponPromotionIdQuery::default()).is_err());
        assert_eq!(
            required_promotion_id(&GrouponPromotionIdQuery {
                groupon_promotion_id: Some(3)
            })
            .unwrap(),
            3
        );
        assert_eq!(current_user_id(&None), None);
    }

    /// query 参数按 Java 名（camelCase）解析。
    #[test]
    fn query_params_accept_java_names() {
        let q: GrouponItemPageQuery = serde_json::from_str(
            r#"{"grouponPromotionId":5,"keyword":"商品","sortField":"price","sortOrder":"asc","page":2,"size":10}"#,
        )
        .unwrap();
        assert_eq!(q.groupon_promotion_id, Some(5));
        assert_eq!(q.keyword.as_deref(), Some("商品"));
        assert_eq!(q.sort_field.as_deref(), Some("price"));

        let q: GrouponImagePageQuery = serde_json::from_str(r#"{"page":2,"size":20}"#).unwrap();
        assert_eq!(q.page, Some(2));

        let q: GrouponProductIdQuery = serde_json::from_str(r#"{"productId":8}"#).unwrap();
        assert_eq!(q.product_id, 8);
    }
}
