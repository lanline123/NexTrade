//! 买家秀前台路由（marketing::buyer_show_client）。
//!
//! 对应原 Java `com.tigshop.api.controller.buyershow.BuyerShowController`
//! （`@RequestMapping("/api/buyerShow/buyerShow")`，本切片 12 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |------------------------------|--------------|-----------|
//! | `GET  /buyerShow/buyerShow/list` | `BuyerShowController.clientList` | optional |
//! | `GET  /buyerShow/buyerShow/videoFeed` | `BuyerShowController.videoFeed` | optional |
//! | `POST /buyerShow/buyerShow/like` | `BuyerShowController.like` | optional |
//! | `POST /buyerShow/buyerShow/favorite` | `BuyerShowController.favorite` | optional |
//! | `POST /buyerShow/buyerShow/followAuthor` | `BuyerShowController.followAuthor` | optional |
//! | `POST /buyerShow/buyerShow/add` | `BuyerShowController.clientAdd` | optional |
//! | `GET  /buyerShow/buyerShow/groupList` | `BuyerShowController.groupList` | optional |
//! | `GET  /buyerShow/buyerShow/detail` | `BuyerShowController.clientDetail` | optional |
//! | `GET  /buyerShow/buyerShow/share` | `BuyerShowController.sharePage` | optional |
//! | `POST /buyerShow/buyerShow/comment` | `BuyerShowController.clientComment` | optional |
//! | `GET  /buyerShow/buyerShow/comment/pageList` | `BuyerShowController.clientCommentPageList` | optional |
//! | `POST /buyerShow/buyerShow/comment/like` | `BuyerShowController.commentLike` | optional |
//!
//! > **路径说明**：控制器前缀**重复一次**（`/api/buyerShow/buyerShow/...`），
//! > 这不是笔误，必须逐字符照抄；本文件挂在 `/api` 之下，
//! > 故 `routes()` 内只写 `/buyerShow/buyerShow/...`。
//!
//! > **auth=optional 的落地口径**：契约把本域 12 条都标为 `optional`，
//! > Java 侧全部在 `permitAll` 之下，但 JWT 过滤器会在**带合法令牌**时
//! > 写入用户上下文；`SecurityUtils.getCurrentUserId()` 在未登录时返回 `0`。
//! > 本仓库 `public/src/lib.rs` 的公开组**没有**可选登录态中间件
//! > （现有 slice 的 `Option<Extension<AuthUser>>` 在公开组恒为 `None`），
//! > 故本文件自带 [`optional_auth`]：
//! > - 无 `Authorization` 头 → 游客（`current_user_id = 0`）；
//! > - 带头但令牌非法/过期 → 401（与 Java 过滤器一致）；
//! > - 令牌合法 → 写入 `AuthUser`。
//! >
//! > 写接口（`like` / `favorite` / `followAuthor` / `add` / `comment` /
//! > `comment/like`）在服务层对游客返回业务码 `401`「用户未登录」。
//! > 其中 `like` / `comment/like` / `add` / `comment` 在 Java 侧**没有**
//! > 登录校验（会写 `user_id = 0` 的脏数据），本实现主动收紧，
//! > 详见 `crates/services/src/buyer_show_client.rs` 的模块注释与 `uncertain_points`。
//!
//! > **`/share` 的响应体**：Java 用 `@IgnoreResponseAdvice` +
//! > `response.getWriter().write(html)` 直接输出 `text/html;charset=UTF-8`，
//! > 不套统一响应包装。本实现返回 axum `Html<String>`（同样不套
//! > `ApiResponse`），语义一致。

use axum::{
    extract::{Query, Request, State},
    http::header,
    response::Response,
    middleware::{self, Next},
    response::Html,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::marketing::buyer_show_client::{
    BuyerShowClientVO, BuyerShowCommentClientParam, BuyerShowCommentLikeClientParam,
    BuyerShowCommentPageClientQuery, BuyerShowCommentPageClientVO, BuyerShowFavoriteClientParam,
    BuyerShowFollowAuthorClientParam, BuyerShowIdQuery, BuyerShowLikeClientParam,
    BuyerShowPageClientQuery, BuyerShowPageClientVO, BuyerShowSaveClientParam,
    BuyerShowVideoFeedClientQuery, BuyerShowVideoFeedPageClientVO, CreatedIdVO, ToggleResultVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;
use tigshop_services::marketing::buyer_show_client::BuyerShowGroupVO;

use crate::PublicState;

/// 买家秀前台路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/buyerShow/buyerShow/list", get(client_list))
        .route("/buyerShow/buyerShow/videoFeed", get(video_feed))
        .route("/buyerShow/buyerShow/like", post(like_buyer_show))
        .route("/buyerShow/buyerShow/favorite", post(favorite_buyer_show))
        .route("/buyerShow/buyerShow/followAuthor", post(follow_author))
        .route("/buyerShow/buyerShow/add", post(client_add))
        .route("/buyerShow/buyerShow/groupList", get(group_list))
        .route("/buyerShow/buyerShow/detail", get(client_detail))
        .route("/buyerShow/buyerShow/share", get(share_page))
        .route("/buyerShow/buyerShow/comment", post(client_comment))
        .route(
            "/buyerShow/buyerShow/comment/pageList",
            get(client_comment_page_list),
        )
        .route("/buyerShow/buyerShow/comment/like", post(comment_like))
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
            "/api/buyerShow/buyerShow/list",
            "BuyerShowController.clientList",
        ),
        (
            "GET",
            "/api/buyerShow/buyerShow/videoFeed",
            "BuyerShowController.videoFeed",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/like",
            "BuyerShowController.like",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/favorite",
            "BuyerShowController.favorite",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/followAuthor",
            "BuyerShowController.followAuthor",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/add",
            "BuyerShowController.clientAdd",
        ),
        (
            "GET",
            "/api/buyerShow/buyerShow/groupList",
            "BuyerShowController.groupList",
        ),
        (
            "GET",
            "/api/buyerShow/buyerShow/detail",
            "BuyerShowController.clientDetail",
        ),
        (
            "GET",
            "/api/buyerShow/buyerShow/share",
            "BuyerShowController.sharePage",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/comment",
            "BuyerShowController.clientComment",
        ),
        (
            "GET",
            "/api/buyerShow/buyerShow/comment/pageList",
            "BuyerShowController.clientCommentPageList",
        ),
        (
            "POST",
            "/api/buyerShow/buyerShow/comment/like",
            "BuyerShowController.commentLike",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 放行为游客；令牌非法 → 401；令牌合法 → 写入 [`AuthUser`]。
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

/// `GET /api/buyerShow/buyerShow/list`：获取买家秀列表。
///
/// 对应 Java `BuyerShowController.clientList(BuyerShowPageClientQuery)`。
async fn client_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<BuyerShowPageClientQuery>,
) -> ApiResult<PageResult<BuyerShowPageClientVO>> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.client_list(&q, user_id).await?)
}

/// `GET /api/buyerShow/buyerShow/videoFeed`：买家秀视频流（游标翻页）。
///
/// 对应 Java `BuyerShowController.videoFeed(@Valid BuyerShowVideoFeedClientQuery)`。
async fn video_feed(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<BuyerShowVideoFeedClientQuery>,
) -> ApiResult<BuyerShowVideoFeedPageClientVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.video_feed(&q, user_id).await?)
}

/// `POST /api/buyerShow/buyerShow/like`：买家秀点赞 / 取消点赞。
///
/// 对应 Java `BuyerShowController.like(@Valid @RequestBody BuyerShowLikeClientParam)`
/// （原返回 `void`，此处回传切换后状态便于前端联动）。
async fn like_buyer_show(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowLikeClientParam>,
) -> ApiResult<ToggleResultVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.like(&param, user_id).await?)
}

/// `POST /api/buyerShow/buyerShow/favorite`：买家秀收藏 / 取消收藏。
///
/// 对应 Java `BuyerShowController.favorite(@Valid @RequestBody BuyerShowFavoriteClientParam)`。
async fn favorite_buyer_show(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowFavoriteClientParam>,
) -> ApiResult<ToggleResultVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.favorite(&param, user_id).await?)
}

/// `POST /api/buyerShow/buyerShow/followAuthor`：关注 / 取关买家秀作者。
///
/// 对应 Java `BuyerShowController.followAuthor(@Valid @RequestBody
/// BuyerShowFollowAuthorClientParam)`。
async fn follow_author(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowFollowAuthorClientParam>,
) -> ApiResult<ToggleResultVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.follow_author(&param, user_id).await?)
}

/// `POST /api/buyerShow/buyerShow/add`：添加买家秀信息。
///
/// 对应 Java `BuyerShowController.clientAdd(@Valid @RequestBody
/// BuyerShowSaveClientParam)`（原返回 `void`）。
async fn client_add(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowSaveClientParam>,
) -> ApiResult<CreatedIdVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.client_add(&param, user_id).await?)
}

/// `GET /api/buyerShow/buyerShow/groupList`：分组列表。
///
/// 对应 Java `BuyerShowController.groupList()` → `BuyerShowGroupServiceImpl#list()`。
async fn group_list(State(state): State<PublicState>) -> ApiResult<Vec<BuyerShowGroupVO>> {
    ok(state.marketing.buyer_show_client.group_list().await?)
}

/// `GET /api/buyerShow/buyerShow/detail?buyerShowId=`：获取买家秀详情。
///
/// 对应 Java `BuyerShowController.clientDetail(@RequestParam("buyerShowId")
/// @NotNull Integer buyerShowId)`。
async fn client_detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<BuyerShowIdQuery>,
) -> ApiResult<BuyerShowClientVO> {
    let buyer_show_id = q
        .buyer_show_id
        .ok_or_else(|| AppError(Error::biz(1001, "买家秀主键不能为空")))?;
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.client_detail(buyer_show_id, user_id).await?)
}

/// `GET /api/buyerShow/buyerShow/share?buyerShowId=`：买家秀分享落地页。
///
/// 对应 Java `BuyerShowController.sharePage(@RequestParam("buyerShowId")
/// @NotNull Integer buyerShowId, HttpServletResponse response)`
/// （`@IgnoreResponseAdvice`，直接输出 `text/html;charset=UTF-8`）。
async fn share_page(
    State(state): State<PublicState>,
    Query(q): Query<BuyerShowIdQuery>,
) -> Result<Html<String>, AppError> {
    let buyer_show_id = q
        .buyer_show_id
        .ok_or_else(|| AppError(Error::biz(1001, "买家秀主键不能为空")))?;
    let html = state.marketing.buyer_show_client.get_share_page_html(buyer_show_id).await;
    Ok(Html(html))
}

/// `POST /api/buyerShow/buyerShow/comment`：评论买家秀信息。
///
/// 对应 Java `BuyerShowController.clientComment(@Valid @RequestBody
/// BuyerShowCommentClientParam)`（原返回 `void`）。
async fn client_comment(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowCommentClientParam>,
) -> ApiResult<CreatedIdVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.client_comment(&param, user_id).await?)
}

/// `GET /api/buyerShow/buyerShow/comment/pageList`：评论分页列表。
///
/// 对应 Java `BuyerShowController.clientCommentPageList(
/// BuyerShowCommentPageClientQuery query)`。
async fn client_comment_page_list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<BuyerShowCommentPageClientQuery>,
) -> ApiResult<PageResult<BuyerShowCommentPageClientVO>> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.client_comment_page_list(&q, user_id).await?)
}

/// `POST /api/buyerShow/buyerShow/comment/like`：买家秀评论点赞 / 取消点赞。
///
/// 对应 Java `BuyerShowController.commentLike(@Valid @RequestBody
/// BuyerShowCommentLikeClientParam)`（原返回 `void`）。
async fn comment_like(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<BuyerShowCommentLikeClientParam>,
) -> ApiResult<ToggleResultVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.buyer_show_client.comment_like(&param, user_id).await?)
}