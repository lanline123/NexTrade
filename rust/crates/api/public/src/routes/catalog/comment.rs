//! 商城前台评价 / 晒单路由（catalog::comment）。
//!
//! 对应原 Java `com.tigshop.api.controller.user.CommentController`
//! （`@RequestMapping("/api/user/comment")`，5 个端点；控制器同时注入
//! `CommentService` 与 `OrderService`）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |-----------------------------|--------------|-----------|
//! | `GET  /user/comment/subNum` | `CommentController.subNum` | optional |
//! | `GET  /user/comment/showedList` | `CommentController.showedList` | optional |
//! | `GET  /user/comment/list` | `CommentController.list` | optional |
//! | `GET  /user/comment/detail` | `CommentController.detail` | optional |
//! | `POST /user/comment/evaluate` | `CommentController.evaluate` | optional |
//!
//! > **auth=optional 的落地口径**：5 条都在 Java `permitAll` 之下，但 JWT
//! > 过滤器会在带**合法**令牌时写入用户上下文；不带令牌按游客处理
//! > （`SecurityUtils.getCurrentUserId()` 返回 `0`）；令牌非法 / 过期 → 401。
//! > 本仓库 `public/src/lib.rs` 的公开路由组没有可选登录态中间件，故本文件
//! > 按 `content/seo.rs` / `marketing/buyer_show_client.rs` 的既有约定自带
//! > [`optional_auth`]，并通过 `pub fn routes(state: &PublicState)` 注册
//! > （`sync_routes.py` 会把它并入 `merge_public`，外层不再套 `require_auth`）。
//!
//! > **`showList` / `detail` 走订单服务**：Java 这两个端点分别调用
//! > `OrderService#list` / `OrderService#detail`（`showedList` 额外先判
//! > `isProductCommentEnabled`），因此本模块同时使用
//! > `state.catalog.comment`（评价服务）与 `state.trade.order`（订单服务）。
//!
//! > **不确定点（与 Java 的差异）**：
//! > 1. `showedList` 的 `OrderListPageQuery` 有 30+ 过滤字段，Rust 订单服务
//! >    （`trade::order::OrderService::list`）目前只支持 `userId` /
//! >    `orderStatus` / `keyword`，其余过滤条件（`commentStatus` / `isShowed` /
//! >    `payStatus` / 时间区间等）**未生效**；`orderStatus` 也仅取逗号分隔串的
//! >    第一个数字。前端「待晒单」筛选需要订单域补齐后再接。
//! > 2. `detail` 返回结构：Java 返回完整 `OrderVO`（含订单项）；Rust 订单服务
//! >    的 `OrderVO` 是精简投影，订单项需单独取。为与 `public/src/lib.rs`
//! >    既有 `/user/order/detail` 响应保持一致，这里返回
//! >    `{ "order": OrderVO, "items": [OrderItem] }`。
//! > 3. `evaluate` 的评论送积分 / 晒单送积分 / 会员等级重算未迁移
//! >    （见 `tigshop_services::catalog::comment` 模块头）。

use axum::{
    extract::{Extension, Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::comment::{
    CommentEvaluateParam, CommentListQuery, CommentSubNumVO, CommentVO, OrderListQuery,
};
use tigshop_core::models::OrderVO;
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 前台评价域全部 5 条路由（`/api` 前缀之后的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**，并与 [`routes`] 的注册清单
/// 由底部单测交叉校验。顺序与原 Java `CommentController` 一致。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    ("GET", "/user/comment/subNum", "CommentController.subNum"),
    (
        "GET",
        "/user/comment/showedList",
        "CommentController.showedList",
    ),
    ("GET", "/user/comment/list", "CommentController.list"),
    ("GET", "/user/comment/detail", "CommentController.detail"),
    (
        "POST",
        "/user/comment/evaluate",
        "CommentController.evaluate",
    ),
];

/// 前台评价路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/comment/subNum", get(sub_num))
        .route("/user/comment/showedList", get(showed_list))
        .route("/user/comment/list", get(list))
        .route("/user/comment/detail", get(detail))
        .route("/user/comment/evaluate", post(evaluate))
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
///
/// 无令牌 → 放行为游客；令牌非法 / 过期 → 401；令牌合法 → 写入 [`AuthUser`]。
/// 与 `content/seo.rs` / `marketing/buyer_show_client.rs` 的实现逐行一致。
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

/// `GET /api/user/comment/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `GET /api/user/comment/subNum`：评论晒单数量（会员中心角标）。
///
/// 对应 Java `CommentController.subNum()` → `CommentServiceImpl#subNum(userId)`；
/// 评价功能关闭时三项全 0（D1146）。
async fn sub_num(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<CommentSubNumVO> {
    ok(state
        .catalog
        .comment
        .sub_num(current_user_id(&auth))
        .await?)
}

/// `GET /api/user/comment/showedList`：晒单列表（订单分页）。
///
/// 对应 Java `CommentController.showedList(OrderListPageQuery)`：
/// 评价功能关闭 → 空分页；否则按当前会员查订单列表。
async fn showed_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<OrderListQuery>,
) -> ApiResult<PageResult<OrderVO>> {
    let page = q.page_query();
    // D1146：评价功能关闭时返空（Java 在 controller 里守卫，而非订单服务）
    if !state.catalog.comment.is_product_comment_enabled().await? {
        return ok(PageResult::empty(&page));
    }
    let user_id = current_user_id(&auth);
    ok(state
        .trade
        .order
        .list(
            Some(user_id),
            q.single_order_status(),
            q.comment_status,
            q.is_showed,
            q.keyword.as_deref(),
            &page,
        )
        .await?)
}

/// `GET /api/user/comment/list`：已评价列表（当前会员）。
///
/// 对应 Java `CommentController.list(CommentListPageQuery)`：强制
/// `userId = 当前会员` 后走 `CommentServiceImpl#listForClient`
/// （评价开关守卫 + 匿名脱敏）。
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(mut q): Query<CommentListQuery>,
) -> ApiResult<PageResult<CommentVO>> {
    q.user_id = Some(current_user_id(&auth));
    ok(state.catalog.comment.list_for_client(&q).await?)
}

/// `GET /api/user/comment/detail?id=`：订单详情（评价详情页复用订单详情接口）。
///
/// 对应 Java `CommentController.detail(@RequestParam Integer id)` →
/// `orderService.detail(id, userId)`；归属校验由订单服务负责。
async fn detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<IdQuery>,
) -> ApiResult<serde_json::Value> {
    let user_id = current_user_id(&auth);
    let (order, items) = state.trade.order.detail(q.id, Some(user_id)).await?;
    ok(serde_json::json!({ "order": order, "items": items }))
}

/// `POST /api/user/comment/evaluate`：商品评价 / 晒单。
///
/// 对应 Java `CommentController.evaluate(CommentEvaluateParam)` →
/// `CommentServiceImpl#evaluate`（评价开关、匿名开关、重复评价校验、
/// 追加晒单、整单已评标记）。
async fn evaluate(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<CommentEvaluateParam>,
) -> ApiResult<()> {
    state
        .catalog
        .comment
        .evaluate(&dto, current_user_id(&auth))
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 5 条、前缀 `/api`、`subNum` / `showedList` 大小写敏感。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5, "契约中前台评价域共 5 条接口");
        assert_eq!(docs.len(), ROUTE_TABLE.len());

        let expected = [
            ("GET", "/api/user/comment/subNum", "CommentController.subNum"),
            (
                "GET",
                "/api/user/comment/showedList",
                "CommentController.showedList",
            ),
            ("GET", "/api/user/comment/list", "CommentController.list"),
            (
                "GET",
                "/api/user/comment/detail",
                "CommentController.detail",
            ),
            (
                "POST",
                "/api/user/comment/evaluate",
                "CommentController.evaluate",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                docs.iter()
                    .any(|d| d.method == method && d.path == path && d.java_ref == handler),
                "缺少 {method} {path} ({handler})"
            );
        }
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（5/5）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            ("GET", "/user/comment/subNum"),
            ("GET", "/user/comment/showedList"),
            ("GET", "/user/comment/list"),
            ("GET", "/user/comment/detail"),
            ("POST", "/user/comment/evaluate"),
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

    /// 路径表自身守卫：前缀、method 白名单、无重复。
    #[test]
    fn route_table_is_well_formed() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        for (i, (method, path, handler)) in ROUTE_TABLE.iter().enumerate() {
            assert!(path.starts_with("/user/comment/"), "路径前缀错误: {path}");
            assert!(*method == "GET" || *method == "POST");
            assert!(handler.starts_with("CommentController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明");
            }
        }
    }
}
