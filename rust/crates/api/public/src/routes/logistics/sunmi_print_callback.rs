//! 商米云打印回调 —— 商城前台路由（logistics::sunmi_print_callback）。
//!
//! 原 Java：`SunmiPrintCallbackController`
//! （`java/tigshop-api/src/main/java/com/tigshop/api/controller/print/SunmiPrintCallbackController.java`，
//! `@RequestMapping("/api/print/sunmi")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `POST /print/sunmi/callback` | `POST /api/print/sunmi/callback` | `SunmiPrintCallbackController.callback` | optional |
//!
//! > **路径说明**：`@RequestMapping("/api/print/sunmi")` + `@PostMapping("/callback")`
//! > 拼出 `/api/print/sunmi/callback`，本域**没有**「控制器名重复一次」的形式；
//! > 挂在 `/api` 之下，故 `routes()` 内只写 `/print/sunmi/callback`。
//!
//! > **这是上游自带的占位实现，不是迁移偷懒**：Java 源码注释原文为
//! > 「商米云打印回调控制器（DR-01=α 占位实现）…… MVP 阶段商米回调仅做
//! > "接收 + 返回 200" 占位，**不触发** `PrintLog` 状态机从 PUSHED(1) 到
//! > PRINTED(2) 的迁移」，方法体里只有一行 `log.info` 与
//! > `return Map.of("code", 1, "msg", "ok")`，`Sunmi-Sign` 验签与
//! > `PrintLogService.markCallback` 都还是 Java 自己的 `TODO`。
//! > 因此本 handler 同样**不写任何表**、不做验签 —— 与 Java 行为一致。
//! > 详见 [`tigshop_services::logistics::sunmi_print_callback`] 模块头。
//!
//! > **auth=optional 的落地口径**：Java 在 `permitAll` 之下仍挂着 JWT 过滤器
//! > （带合法令牌则写入上下文，不带则游客，**令牌非法 → 401**）。本仓库
//! > `public/src/lib.rs` 的公开路由组没有可选登录态中间件，故沿用
//! > shop_client / wholesale_client / seo 的既有约定，本文件自带 [`optional_auth`]。
//! > 本接口不读登录态（Java 方法体同样不读），鉴权只影响「非法令牌是否 401」。
//!
//! > **响应体说明**：Java 返回 `Map.of("code", 1, "msg", "ok")`，经项目统一
//! > 信封后为 `{"code":…,"msg":…,"data":{"code":1,"msg":"ok"}}`；
//! > `data.code = 1` 是**商米侧**的成功约定（非 1 会触发商米重试），
//! > 与信封的 `code` 无关，见 [`SunmiCallbackAck`]。
//!
//! > **body 必填性**：Java 是 `@RequestBody(required = false) String`，
//! > 空 body / 非 JSON body 都必须成功返回，见 [`sunmi_callback`]。

use axum::{
    extract::{Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::post,
    Router,
};
use tigshop_core::models::logistics::sunmi_print_callback::SunmiCallbackAck;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 商米云打印回调路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route(
            "/print/sunmi/callback",
            post(sunmi_callback),
        )
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
        "/api/print/sunmi/callback",
        "SunmiPrintCallbackController.callback",
    )]
    .iter()
    .map(|(method, path, java_ref)| tigshop_openapi::RouteDoc::new(method, path, java_ref))
    .collect()
}

/// 可选登录态中间件（与 shop_client / wholesale_client / seo 同一实现）。
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

/// `POST /api/print/sunmi/callback`：接收商米云打印回调（占位）。
///
/// 对应 Java `SunmiPrintCallbackController.callback(@RequestBody(required =
/// false) String body)`（`SunmiPrintCallbackController.java:52`）：
/// 打印回调原文 + 恒返回 `{"code":1,"msg":"ok"}`。
///
/// 请求体按**原始字节**接收（Java 侧是 `String`，不做 JSON 反序列化），
/// 因此商米传什么都不会在这里变成 4xx；返回 HTTP 200 才能终止商米重试。
async fn sunmi_callback(
    State(state): State<PublicState>,
    raw: axum::body::Bytes,
) -> ApiResult<SunmiCallbackAck> {
    let body = tigshop_services::logistics::sunmi_print_callback::decode_body(&raw);
    let ack = state.logistics.sunmi_print_callback.handle_callback(&body);
    // Java 直接返回 Map（无异常路径）→ 恒 HTTP 200，只有成功应答
    ok(ack)
}