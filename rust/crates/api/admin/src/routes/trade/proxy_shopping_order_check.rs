//! 代客下单订单结算路由（trade::proxy_shopping_order_check）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingOrderCheckController`
//! （`@RequestMapping("/adminapi/proxyShopping/order/check")`，
//! `ProxyShoppingOrderCheckController.java`）。
//!
//! 原 Java 路径对照表（**逐字符**对齐，含控制器前缀本身）：
//!
//! | 本模块路由（`/adminapi` 前缀在 `lib.rs` 统一嵌套） | 原 Java handler | 权限 |
//! |-------------------------------------------------|-----------------|------|
//! | `GET  /proxyShopping/order/check/getAvailablePaymentType` | `ProxyShoppingOrderCheckController.getAvailablePaymentType`（`:63`） | `proxyShoppingManage` |
//! | `GET  /proxyShopping/order/check/pickupList` | `ProxyShoppingOrderCheckController.pickupList`（`:69`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/index` | `ProxyShoppingOrderCheckController.index`（`:75`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/update` | `ProxyShoppingOrderCheckController.update`（`:113`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/updateCoupon` | `ProxyShoppingOrderCheckController.updateCoupon`（`:130`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/changePrice` | `ProxyShoppingOrderCheckController.changePrice`（`:142`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/changePriceShow` | `ProxyShoppingOrderCheckController.changePriceShow`（`:156`） | `proxyShoppingManage` |
//! | `POST /proxyShopping/order/check/submit` | `ProxyShoppingOrderCheckController.submit`（`:175`） | `proxyShoppingManage` |
//!
//! ⚠️ 路径大小写：`proxyShopping` 的 **S 大写**、`getAvailablePaymentType` /
//! `updateCoupon` / `changePrice` / `changePriceShow` 的**驼峰必须保留**。
//! 全路径是 `/adminapi/proxyShopping/order/check/...`
//! （`order` 与 `check` 都是控制器 `@RequestMapping` 里的**字面段**，
//! 不是重复前缀）。
//!
//! > **权限说明**：Java 用**类级**
//! > `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")` 覆盖全部 8 条
//! > 接口；Rust 侧 `require_auth`（由 `api/admin/src/lib.rs::router` 统一套在
//! > `/adminapi` 子树外层）只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / brand.rs / shop_manage.rs / pc_navigation.rs /
//! > paylog_batch.rs 的已知缺口一致）。上表「权限」列仅作对照，当前**任何已登录
//! > 管理员**都能调用本域全部接口 —— 即「代客下单」（以他人身份结算与下单）
//! > 这一高危能力目前**无权限门禁**。
//!
//! > **迁移状态**：`getAvailablePaymentType` 与 `pickupList` 已完整迁移；
//! > 其余 6 条（`index` / `update` / `updateCoupon` / `changePrice` /
//! > `changePriceShow` / `submit`）在**完整执行完控制器自身的全部校验与赋值**
//! > 之后，返回明确的「未迁移」业务错误（依赖尚未迁移的
//! > `OrderCheckServiceImpl#getOrderCheckData` / `#submit`）。
//! > **不返回部分填充的结算数据**——理由见 `services/proxy_shopping_order_check.rs` 模块头第 3 条：
//! > 结算页的 30+ 个金额字段若用 0 填充，前端会把 0 元当成真实应付金额。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::trade::proxy_shopping_order_check::{
    AvailablePaymentTypeQuery, OrderCheckParam, PaymentTypeVO, PickupListVO, PickupPageQuery,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};
use tigshop_services::trade::proxy_shopping_order_check::RequestContext;

use crate::AdminState;

// ————————————————————— 请求头 → RequestContext（替代 Java HeaderUtils） ——————————

/// 认证身份 → 服务层 [`RequestContext`]。
///
/// **仅信任 JWT 身份**（认证中间件已写入 [`AuthUser`]）：
/// - 店铺/门店/POS 账号：`shop_id = Some(自身店铺)`，服务层按店铺过滤/落库；
/// - 平台账号：`shop_id = None`（服务层归一为 `0`，不按店铺过滤）；
/// - `admin_type` 直接来自 JWT。
///
/// 请求头 `x-shop-id` / `x-admin-type` 不再参与身份判定（客户端可伪造）。
#[must_use]
pub fn request_context_from_auth(auth: &AuthUser) -> RequestContext {
    RequestContext::new(auth.scoped_shop_id(), auth.admin_type.clone())
}

/// 本域 8 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源；顺序与原 Java `ProxyShoppingOrderCheckController`
/// 一致。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/proxyShopping/order/check/getAvailablePaymentType",
        "ProxyShoppingOrderCheckController.getAvailablePaymentType",
    ),
    (
        "GET",
        "/proxyShopping/order/check/pickupList",
        "ProxyShoppingOrderCheckController.pickupList",
    ),
    (
        "POST",
        "/proxyShopping/order/check/index",
        "ProxyShoppingOrderCheckController.index",
    ),
    (
        "POST",
        "/proxyShopping/order/check/update",
        "ProxyShoppingOrderCheckController.update",
    ),
    (
        "POST",
        "/proxyShopping/order/check/updateCoupon",
        "ProxyShoppingOrderCheckController.updateCoupon",
    ),
    (
        "POST",
        "/proxyShopping/order/check/changePrice",
        "ProxyShoppingOrderCheckController.changePrice",
    ),
    (
        "POST",
        "/proxyShopping/order/check/changePriceShow",
        "ProxyShoppingOrderCheckController.changePriceShow",
    ),
    (
        "POST",
        "/proxyShopping/order/check/submit",
        "ProxyShoppingOrderCheckController.submit",
    ),
];

/// 代客下单订单结算域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/proxyShopping/order/check")`
/// 与各 `@GetMapping` / `@PostMapping`。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/proxyShopping/order/check/getAvailablePaymentType",
            get(get_available_payment_type),
        )
        .route("/proxyShopping/order/check/pickupList", get(pickup_list))
        .route("/proxyShopping/order/check/index", post(check_index))
        .route("/proxyShopping/order/check/update", post(check_update))
        .route(
            "/proxyShopping/order/check/updateCoupon",
            post(check_update_coupon),
        )
        .route(
            "/proxyShopping/order/check/changePrice",
            post(check_change_price),
        )
        .route(
            "/proxyShopping/order/check/changePriceShow",
            post(check_change_price_show),
        )
        .route("/proxyShopping/order/check/submit", post(check_submit))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `GET /adminapi/proxyShopping/order/check/getAvailablePaymentType`：获取可用支付方式。
///
/// 对应 Java `ProxyShoppingOrderCheckController.getAvailablePaymentType`
/// （`:61-65`）→ `OrderCheckServiceImpl#getAvailablePaymentType(flowType)`
/// （`:2990-3036`）。`flowType` 为可选查询参数。
async fn get_available_payment_type(
    State(state): State<AdminState>,
    Query(q): Query<AvailablePaymentTypeQuery>,
) -> ApiResult<Vec<PaymentTypeVO>> {
    ok(state
        .trade
        .proxy_shopping_order_check
        .available_payment_types(&q)
        .await?)
}

/// `GET /adminapi/proxyShopping/order/check/pickupList`：获取自提点列表。
///
/// 对应 Java `ProxyShoppingOrderCheckController.pickupList`
/// （`:67-71`）→ `ShopServiceImpl#pickupList(query)`（`:1620-1641`）。
/// 查询参数绑定到 `PickupPageQuery`（`page` / `size` / `regionId` / `shopId` /
/// `longitude` / `latitude` / `keyword`）。
async fn pickup_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(mut q): Query<PickupPageQuery>,
) -> ApiResult<PageResult<PickupListVO>> {
    // 多租户：店铺/门店/POS 账号只能查询自己门店的自提点；平台可传 shopId 过滤。
    if let Some(scope) = tenant.shop_scope() {
        q.shop_id = Some(scope);
    }
    ok(state
        .trade
        .proxy_shopping_order_check
        .pickup_list(&q)
        .await?)
}

/// `POST /adminapi/proxyShopping/order/check/index`：获取结算页信息。
///
/// 对应 Java `ProxyShoppingOrderCheckController.index`（`:73-88`）。
/// `shopId` 取自认证身份（Java 用请求头，Rust 改为 `AuthUser::scoped_shop_id()`）。
///
/// ⚠️ 依赖 `getOrderCheckData`（未迁移）→ 当前返回明确业务错误。
async fn check_index(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::trade::check::OrderCheckVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .check_index(&param, &ctx)
        .await?;
    ok(vo)
}

/// `POST /adminapi/proxyShopping/order/check/update`：更新结算信息。
///
/// 对应 Java `ProxyShoppingOrderCheckController.update`（`:111-126`）。
async fn check_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::trade::check::OrderCheckVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .check_update(&param, &ctx)
        .await?;
    ok(vo)
}

/// `POST /adminapi/proxyShopping/order/check/updateCoupon`：更新优惠券。
///
/// 对应 Java `ProxyShoppingOrderCheckController.updateCoupon`（`:128-138`）。
async fn check_update_coupon(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::trade::check::OrderCheckVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .check_update_coupon(&param, &ctx)
        .await?;
    ok(vo)
}

/// `POST /adminapi/proxyShopping/order/check/changePrice`：改价。
///
/// 对应 Java `ProxyShoppingOrderCheckController.changePrice`（`:140-152`）。
async fn check_change_price(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::trade::check::OrderCheckVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .change_price(&param, &ctx)
        .await?;
    ok(vo)
}

/// `POST /adminapi/proxyShopping/order/check/changePriceShow`：改价展示。
///
/// 对应 Java `ProxyShoppingOrderCheckController.changePriceShow`（`:154-171`）。
async fn check_change_price_show(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::trade::check::OrderCheckVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .change_price_show(&param, &ctx)
        .await?;
    ok(vo)
}

/// `POST /adminapi/proxyShopping/order/check/submit`：提交订单。
///
/// 对应 Java `ProxyShoppingOrderCheckController.submit`（`:173-195`）。
/// `posUserId` 取 JWT 身份（Java `SecurityUtils.getCurrentAdminId()`）。
///
/// ⚠️ 依赖 `OrderCheckServiceImpl#submit`（未迁移）→ 当前返回明确业务错误。
async fn check_submit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderCheckParam>,
) -> ApiResult<tigshop_core::models::OrderCreateVO> {
    let ctx = request_context_from_auth(&auth);
    let vo = state
        .trade
        .proxy_shopping_order_check
        .submit(&param, &ctx, auth.id)
        .await?;
    ok(vo)
}

#[cfg(test)]
mod tenant_tests {
    use super::*;
    use tigshop_security::web::AuthUser;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// 请求上下文只来自认证身份：店铺账号被强制到自身店铺。
    #[test]
    fn context_shop_scope_is_forced_for_shop_account() {
        let ctx = request_context_from_auth(&shop_account(9));
        assert_eq!(ctx.shop_id, Some(9));
        assert_eq!(ctx.admin_type.as_deref(), Some("shop"));
    }

    /// 平台账号上下文不带店铺过滤（服务层按平台处理）。
    #[test]
    fn context_is_unfiltered_for_platform() {
        let ctx = request_context_from_auth(&platform());
        assert_eq!(ctx.shop_id, None);
        assert_eq!(ctx.admin_type.as_deref(), Some("admin"));
    }
}
