//! 微信直播订单同步回调 —— 商城前台路由（content::wechat_live_sync_callback）。
//!
//! 原 Java：`WechatLiveSyncCallbackController`
//! （`java/tigshop-api/src/main/java/com/tigshop/api/controller/content/WechatLiveSyncCallbackController.java`，
//! `@RequestMapping("/api/content/wechatLiveSync")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `POST /content/wechatLiveSync/callback` | `POST /api/content/wechatLiveSync/callback` | `WechatLiveSyncCallbackController.callback` | optional |
//!
//! > **路径说明**：`@RequestMapping("/api/content/wechatLiveSync")` +
//! > `@PostMapping("/callback")` 拼出
//! > `/api/content/wechatLiveSync/callback`（`wechatLiveSync` 大小写原样照抄）；
//! > 挂在 `/api` 之下，故 `routes()` 内只写
//! > `/content/wechatLiveSync/callback`。
//!
//! > **返回体**：Java 方法是 `void`，经统一信封后 `data` 为 `null` →
//! > 本 handler 返回 `ApiResult<()>`（`ok(())`）。
//!
//! > **鉴权**：契约标 `auth=optional`，与 shop_client / wholesale_client / seo /
//! > sunmi_print_callback / web_socket 同口径，本文件自带 [`optional_auth`]
//! > （无令牌 → 游客可调用；带非法令牌 → 401）。Java 回调不读登录态。
//!
//! > **两处未迁移依赖（务必知悉）**：
//! > 1. Java `@Idempotent`（Redis `tryLock`，键
//! >    `idempotent:wechatLiveSyncCallback:{idempotentKey}`，冲突文案
//! >    「操作正在处理中，请勿重复提交」）**未迁移** —— 本片服务构造只拿到
//! >    `Arc<Repositories>`，`Repositories` 不含 Redis，且禁止改共享文件；
//! > 2. Java 的「回调自动建单」分支（`createOrderFromWechatCallback`）**未迁移**，
//! >    命中时返回明确业务错误而不是伪造半张订单。
//! > 两条的完整说明与判定表见 [`tigshop_services::content::wechat_live_sync_callback`] 模块头。

use axum::{
    extract::{Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::post,
    Router,
};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 微信直播同步回调路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/content/wechatLiveSync/callback", post(wechat_live_sync_callback))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [(
        "POST",
        "/api/content/wechatLiveSync/callback",
        "WechatLiveSyncCallbackController.callback",
    )]
    .iter()
    .map(|(method, path, java_ref)| tigshop_openapi::RouteDoc::new(method, path, java_ref))
    .collect()
}

/// 可选登录态中间件（与 shop_client / wholesale_client / seo / sunmi_print_callback 同一实现）。
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

/// `POST /api/content/wechatLiveSync/callback`：接收微信直播同步回调。
///
/// 对应 Java `WechatLiveSyncCallbackController.callback(@Valid @RequestBody
/// WechatLiveSyncCallbackDTO)`（`WechatLiveSyncCallbackController.java:34`）：
/// 校验 → `wechatLiveOrderSyncService.handleInboundCallback(dto)`，无返回值。
///
/// 请求体按原始字节接收后自行反序列化，以便把「JSON 不合法」对齐 Java 的
/// `HttpMessageNotReadableException` → 业务码 1001「参数错误」。
async fn wechat_live_sync_callback(
    State(state): State<PublicState>,
    raw: axum::body::Bytes,
) -> ApiResult<()> {
    let dto = tigshop_services::content::wechat_live_sync_callback::parse_callback_body(&raw)?;
    state.content.wechat_live_sync_callback.handle_inbound_callback(&dto).await?;
    // Java 返回 void → 信封 data = null
    ok(())
}