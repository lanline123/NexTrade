//! 管理端商户/店铺域路由。
//! 对应原 Java `controller.shop.ShopController` / `AccountController` /
//! `ShopWithdrawController`。
//!
//! > `ShopProductCategoryController` 的 `list` / `detail` 已由 shop_product_category 接管
//! > （见 `routes/shop_product_category.rs`），本文件不再注册，避免重复路由导致启动 panic。
//!
//! | 路由 | 原 Java |
//! |------|---------|
//! | `GET /adminapi/merchant/shop/list` | `ShopController.list` |
//! | `GET /adminapi/merchant/shop/detail` | `ShopController.detail` |
//! | `POST /adminapi/merchant/shop/update` | `ShopController.update` |
//! | `GET /adminapi/merchant/shopAccount/logList` | `AccountController.logList` |
//! | `GET /adminapi/merchant/shopWithdraw/list` | `ShopWithdrawController.list` |
//! | `GET /adminapi/merchant/shopWithdraw/detail` | `ShopWithdrawController.detail` |
//! | `GET /adminapi/merchant/shopWithdraw/config` | `ShopWithdrawController.config` |
//! | `POST /adminapi/merchant/shopWithdraw/audit` | `ShopWithdrawController.audit` |

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::shop::{
    ShopAccountLogListQuery, ShopAccountLogVO, ShopListQuery, ShopUpdateDTO, ShopVO,
    ShopWithdrawAuditDTO, ShopWithdrawListQuery, ShopWithdrawVO,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 商户/店铺域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(_state: &AdminState) -> Router<AdminState> {
    Router::new()
        .route("/merchant/shop/list", get(shop_list))
        .route("/merchant/shop/detail", get(shop_detail))
        .route("/merchant/shop/update", post(shop_update))
        .route("/merchant/shopAccount/logList", get(account_log_list))
        .route("/merchant/shopWithdraw/list", get(withdraw_list))
        .route("/merchant/shopWithdraw/detail", get(withdraw_detail))
        .route("/merchant/shopWithdraw/config", get(withdraw_config))
        .route("/merchant/shopWithdraw/audit", post(withdraw_audit))
    // `shopProductCategory/*` 已由 shop_product_category 接管（见 routes/shop_product_category.rs），
    // 此处不再注册，否则同一 (method, path) 重复注册会让 axum 启动时 panic。
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/adminapi/merchant/shop/list", "ShopController.list"),
        (
            "GET",
            "/adminapi/merchant/shop/detail",
            "ShopController.detail",
        ),
        (
            "POST",
            "/adminapi/merchant/shop/update",
            "ShopController.update",
        ),
        (
            "GET",
            "/adminapi/merchant/shopAccount/logList",
            "AccountController.logList",
        ),
        (
            "GET",
            "/adminapi/merchant/shopWithdraw/list",
            "ShopWithdrawController.list",
        ),
        (
            "GET",
            "/adminapi/merchant/shopWithdraw/detail",
            "ShopWithdrawController.detail",
        ),
        (
            "GET",
            "/adminapi/merchant/shopWithdraw/config",
            "ShopWithdrawController.config",
        ),
        (
            "POST",
            "/adminapi/merchant/shopWithdraw/audit",
            "ShopWithdrawController.audit",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/merchant/shop/list`：店铺分页。
async fn shop_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopListQuery>,
) -> ApiResult<PageResult<ShopVO>> {
    // 多租户：店铺账号只能看到自己店铺（返回单条分页）；平台可见全部。
    if let Some(shop_id) = auth.scoped_shop_id() {
        let vo = state.merchant.shop.detail(shop_id).await?;
        let page = PageQuery {
            page: 1,
            page_size: 1,
        };
        return ok(PageResult::new(1, vec![vo], &page));
    }
    ok(state.merchant.shop.list(&q).await?)
}

/// 店铺详情入参（原 Java `@RequestParam("shopId")`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShopIdQuery {
    #[serde(alias = "id")]
    shop_id: i32,
}

/// `GET /adminapi/merchant/shop/detail?shopId=`：店铺详情（含评星/商户）。
async fn shop_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopIdQuery>,
) -> ApiResult<ShopVO> {
    let target_shop_id = auth.scoped_shop_id().unwrap_or(q.shop_id);
    ok(state.merchant.shop.detail(target_shop_id).await?)
}

/// `POST /adminapi/merchant/shop/update`：更新店铺。
async fn shop_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<ShopUpdateDTO>,
) -> ApiResult<&'static str> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        dto.shop_id = shop_id;
    }
    state.merchant.shop.update(&dto).await?;
    ok("更新成功")
}

/// `GET /adminapi/merchant/shopAccount/logList`：资金流水分页。
async fn account_log_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<ShopAccountLogListQuery>,
) -> ApiResult<PageResult<ShopAccountLogVO>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.merchant.shop.account_logs(&q).await?)
}

/// `GET /adminapi/merchant/shopWithdraw/list`：提现记录分页。
async fn withdraw_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<ShopWithdrawListQuery>,
) -> ApiResult<PageResult<ShopWithdrawVO>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.merchant.shop.withdraw_list(&q).await?)
}

/// 提现详情入参（原 Java `@RequestParam("id")`）。
#[derive(Debug, Deserialize)]
struct WithdrawIdQuery {
    id: i32,
}

/// `GET /adminapi/merchant/shopWithdraw/detail?id=`：提现详情。
async fn withdraw_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<WithdrawIdQuery>,
) -> ApiResult<ShopWithdrawVO> {
    let detail = state.merchant.shop.withdraw_detail(q.id).await?;
    if let Some(shop_id) = auth.scoped_shop_id() {
        if detail.shop_id != shop_id {
            return Err(AppError(tigshop_core::Error::biz(
                403,
                "无权查看其他店铺提现记录",
            )));
        }
    }
    ok(detail)
}

/// `GET /adminapi/merchant/shopWithdraw/config`：提现状态配置
/// （`{"statusList": {...}}`，隐藏 code=1）。
async fn withdraw_config(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.merchant.shop.withdraw_status_config())
}

/// `POST /adminapi/merchant/shopWithdraw/audit`：审核提现。
/// 平台管理员（`admin_type = "admin"`）才有权，对应原 Java 的角色校验。
async fn withdraw_audit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ShopWithdrawAuditDTO>,
) -> ApiResult<&'static str> {
    if !auth.is_platform() {
        return Err(AppError(tigshop_core::Error::biz(
            403,
            "仅平台管理员可审核商户提现",
        )));
    }
    state
        .merchant
        .shop
        .withdraw_audit(&dto, auth.admin_type.as_deref())
        .await?;
    ok("操作成功")
}
