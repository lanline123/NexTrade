//! 商城前台 C 端批发域路由（wholesale::wholesale_client）。
//!
//! 对应原 Java `com.tigshop.api.controller.wholesale.WholesaleClientController`
//! （`@RequestMapping("/api/wholesale")`，本切片 3 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |------------------------------|--------------|-----------|
//! | `GET  /wholesale/me` | `WholesaleClientController.me` | optional |
//! | `GET  /wholesale/product/buyRule` | `WholesaleClientController.productBuyRule` | optional |
//! | `POST /wholesale/cart/addBatch` | `WholesaleClientController.addBatch` | optional |
//!
//! > **路径说明**：契约路径为 `/api/wholesale/me`、
//! > `/api/wholesale/product/buyRule`、`/api/wholesale/cart/addBatch`
//! > （`WholesaleClientController` 的 `@RequestMapping("/api/wholesale")` +
//! > 方法级 `@GetMapping("/me")` 等拼接结果，本域**没有**「控制器名重复一次」
//! > 的形式）。本文件挂载在 `/api` 之下，故 `routes()` 内只写
//! > `/wholesale/...`。
//!
//! > **auth=optional 的落地口径**：契约把本域 3 条都标为 `optional`
//! > （`permitAll`），但 Java 在 `permitAll` 之下仍有一个 JWT 过滤器：
//! > **带合法令牌就写入用户上下文，不带令牌则
//! > `SecurityUtils.getCurrentUserId()` 返回 0（游客）**。
//! > 本仓库 `public/src/lib.rs` 的公开路由组没有可选登录态中间件
//! > （现有 slice 的 `Option<Extension<AuthUser>>` 在公开组恒为 `None`），
//! > 故本文件自带 [`optional_auth`]：
//! > - 无 `Authorization` 头 → 游客（`user_id = 0`）；`/me` 返回
//! >   `isWholesaler = false`，`/cart/addBatch` 返回业务码 401「用户未登录」；
//! > - 带头但令牌非法 / 过期 → 401（与 Java 过滤器一致）；
//! > - 令牌合法 → 写入 `AuthUser`，`/me` 可回填批发身份。
//!
//! > **`/product/buyRule` 不做身份判定**（契约：「非批发商也可查，前端预览用」），
//! > 与 Java 一致。
//!
//! > **未迁移依赖**：批发域的 Redis 身份缓存、`CartServiceImpl#addProductToCart`
//! > 的批发外链路（限购 / 秒杀人群 / 拼团 / 赠品卡 / 预约库存等）均未迁移，
//! > 详见 [`tigshop_services::wholesale::wholesale_client`] 模块头的「与 Java 的行为差异」。

use axum::{
    extract::{Query, Request, State},
    http::header,
    response::Response,
    middleware::{self, Next},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::wholesale::wholesale_client::{
    WholesaleBuyRuleQuery, WholesaleCartBatchAddDTO, WholesaleCartBatchResultVO, WholesaleMeVO,
    WholesaleProductBuyRuleVO,
};
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;
use tigshop_services::wholesale::wholesale_client::SERVICE_DATA_ERROR;

use crate::PublicState;

/// C 端批发域路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/wholesale/me", get(wholesale_me))
        .route("/wholesale/product/buyRule", get(wholesale_product_buy_rule))
        .route("/wholesale/cart/addBatch", post(wholesale_cart_add_batch))
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/api/wholesale/me", "WholesaleClientController.me"),
        (
            "GET",
            "/api/wholesale/product/buyRule",
            "WholesaleClientController.productBuyRule",
        ),
        (
            "POST",
            "/api/wholesale/cart/addBatch",
            "WholesaleClientController.addBatch",
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

/// 取登录会员 ID；游客返回 0（对应 Java `SecurityUtils.getCurrentUserId()`）。
fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(a)| a.id).unwrap_or(0)
}

/// `GET /api/wholesale/me`：我是否批发商。
///
/// 对应 Java `WholesaleClientController.me` →
/// `WholesaleSettingServiceImpl#isEnabled` +
/// `WholesalerServiceImpl#isWholesaleBuyer / getByUserId` +
/// `WholesalerGradeService#getById`。
///
/// 未登录 / 总开关关闭 / 非批发商一律返回 `isWholesaler = false`（不报错）。
async fn wholesale_me(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
) -> ApiResult<WholesaleMeVO> {
    ok(state.wholesale.wholesale_client.me(current_user_id(&auth)).await?)
}

/// `GET /api/wholesale/product/buyRule?productId=`：商品起批规则。
///
/// 对应 Java `WholesaleClientController.productBuyRule` →
/// `WholesaleProductQueryServiceImpl#buildBuyRule`。
///
/// 参数缺失 / 非正数走 `SERVICE_DATA_ERROR(1001)`：Java 侧
/// `MissingServletRequestParameterException` 与 `@Positive` 违例都由
/// `GlobalExceptionHandler` 兜底为 1001（参数校验异常不是控制器 javadoc
/// 里写的 400）。
async fn wholesale_product_buy_rule(
    State(state): State<PublicState>,
    Query(q): Query<WholesaleBuyRuleQuery>,
) -> ApiResult<WholesaleProductBuyRuleVO> {
    let product_id = q
        .product_id
        .ok_or_else(|| AppError(Error::biz(SERVICE_DATA_ERROR, "接口参数缺失")))?;
    if product_id <= 0 {
        return Err(AppError(Error::biz(
            SERVICE_DATA_ERROR,
            "productId 必须为正整数",
        )));
    }
    ok(state.wholesale.wholesale_client.buy_rule(product_id).await?)
}

/// `POST /api/wholesale/cart/addBatch`：批量加车（仅批发商）。
///
/// 对应 Java `WholesaleClientController.addBatch` →
/// `WholesaleCartBatchServiceImpl#addBatch`（逐项
/// `CartServiceImpl#addProductToCart`，部分失败不回滚成功行）。
///
/// 整批级校验（未登录 401 / 5300 / 403 / 入参 1001）在服务层完成，
/// 行级失败收集进 `failedItems`。
async fn wholesale_cart_add_batch(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WholesaleCartBatchAddDTO>,
) -> ApiResult<WholesaleCartBatchResultVO> {
    ok(state.wholesale.wholesale_client
        .add_batch(current_user_id(&auth), &dto)
        .await?)
}