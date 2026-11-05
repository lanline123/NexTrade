//! 管理端商家提现路由（merchant::shop_withdraw，8 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.shop.ShopWithdrawController`
//! （`@RequestMapping("/adminapi/merchant/shopWithdraw")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `POST /merchant/shopWithdraw/create` | `ShopWithdrawController.create` |
//! | `POST /merchant/shopWithdraw/update` | `ShopWithdrawController.update` |
//! | `POST /merchant/shopWithdraw/del` | `ShopWithdrawController.del` |
//! | `POST /merchant/shopWithdraw/updateField` | `ShopWithdrawController.updateField` |
//! | `POST /merchant/shopWithdraw/batch` | `ShopWithdrawController.batch` |
//! | `POST /merchant/shopWithdraw/uploadPayVoucher` | `ShopWithdrawController.uploadPayVoucher` |
//! | `GET  /merchant/shopWithdraw/summaryList` | `ShopWithdrawController.summaryList` |
//! | `GET  /merchant/shopWithdraw/dualBalance` | `ShopWithdrawController.dualBalance` |
//!
//! `list` / `detail` / `config` / `audit` 已由 `merchant::shop` 注册，本模块不重复注册。
//!
//! > **多租户偏差**：`create` / `dualBalance` 需要店铺上下文；Java 取请求头
//! > `X-Shop-Id`，Rust JWT 无 shop_id，改用可选查询参数 `?shopId=`（缺省 0），
//! > 详见服务层模块头偏差 1。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::shop_manage::{BatchDTO, UpdateFieldDTO};
use tigshop_core::models::merchant::shop_withdraw::{
    DualBalanceVO, ShopWithdrawCreateDTO, ShopWithdrawPayVoucherDTO, ShopWithdrawSummaryQuery,
    ShopWithdrawSummaryVO, ShopWithdrawUpdateDTO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

/// 本域 8 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "POST",
        "/merchant/shopWithdraw/create",
        "ShopWithdrawController.create",
    ),
    (
        "POST",
        "/merchant/shopWithdraw/update",
        "ShopWithdrawController.update",
    ),
    (
        "POST",
        "/merchant/shopWithdraw/del",
        "ShopWithdrawController.del",
    ),
    (
        "POST",
        "/merchant/shopWithdraw/updateField",
        "ShopWithdrawController.updateField",
    ),
    (
        "POST",
        "/merchant/shopWithdraw/batch",
        "ShopWithdrawController.batch",
    ),
    (
        "POST",
        "/merchant/shopWithdraw/uploadPayVoucher",
        "ShopWithdrawController.uploadPayVoucher",
    ),
    (
        "GET",
        "/merchant/shopWithdraw/summaryList",
        "ShopWithdrawController.summaryList",
    ),
    (
        "GET",
        "/merchant/shopWithdraw/dualBalance",
        "ShopWithdrawController.dualBalance",
    ),
];

/// 商家提现路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/shopWithdraw/create", post(create))
        .route("/merchant/shopWithdraw/update", post(update))
        .route("/merchant/shopWithdraw/del", post(del))
        .route("/merchant/shopWithdraw/updateField", post(update_field))
        .route("/merchant/shopWithdraw/batch", post(batch))
        .route(
            "/merchant/shopWithdraw/uploadPayVoucher",
            post(upload_pay_voucher),
        )
        .route("/merchant/shopWithdraw/summaryList", get(summary_list))
        .route("/merchant/shopWithdraw/dualBalance", get(dual_balance))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// 店铺端接口：只有店铺账号（JWT `shop_id`）可调用；否则 403。
fn require_shop(tenant: &TenantContext) -> Result<i32, AppError> {
    tenant
        .shop_scope()
        .ok_or_else(|| tigshop_core::Error::Forbidden("仅店铺账号可访问该接口".into()).into())
}

/// 平台端接口：店铺/供应商账号一律 403。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(())
}

/// 店铺上下文查询参数（Java `X-Shop-Id` 请求头的替身，见模块头偏差；**不再可信**）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShopContextQuery {
    shop_id: Option<i32>,
}

/// 主键查询参数（`?id=`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    id: Option<i32>,
}

/// `POST /adminapi/merchant/shopWithdraw/create`：创建提现申请。
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ShopWithdrawCreateDTO>,
) -> ApiResult<()> {
    let shop_id = require_shop(&tenant)?;
    state.merchant.shop_withdraw.create(shop_id, &dto).await?;
    ok(())
}

/// `POST /adminapi/merchant/shopWithdraw/update`：更新提现记录。
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ShopWithdrawUpdateDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.shop_withdraw.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/merchant/shopWithdraw/del`：删除提现记录。
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<IdQuery>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.shop_withdraw.del(dto.id).await?;
    ok(())
}

/// `POST /adminapi/merchant/shopWithdraw/updateField`：白名单字段更新。
async fn update_field(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.shop_withdraw.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/merchant/shopWithdraw/batch`：批量操作（仅 `del`）。
async fn batch(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.shop_withdraw.batch(&dto).await?;
    ok(())
}

/// `POST /adminapi/merchant/shopWithdraw/uploadPayVoucher`：上传打款凭证。
async fn upload_pay_voucher(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ShopWithdrawPayVoucherDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state
        .merchant
        .shop_withdraw
        .upload_pay_voucher(&dto)
        .await?;
    ok(())
}

/// `GET /adminapi/merchant/shopWithdraw/summaryList`：店铺提现汇总列表。
async fn summary_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopWithdrawSummaryQuery>,
) -> ApiResult<PageResult<ShopWithdrawSummaryVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.shop_withdraw.summary_list(&q).await?)
}

/// `GET /adminapi/merchant/shopWithdraw/dualBalance`：双余额查询。
async fn dual_balance(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DualBalanceVO> {
    let shop_id = require_shop(&tenant)?;
    ok(state.merchant.shop_withdraw.dual_balance(shop_id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop() -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(9), None)
    }

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn vendor() -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(3))
    }

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("POST", "/adminapi/merchant/shopWithdraw/create"),
            ("POST", "/adminapi/merchant/shopWithdraw/update"),
            ("POST", "/adminapi/merchant/shopWithdraw/del"),
            ("POST", "/adminapi/merchant/shopWithdraw/updateField"),
            ("POST", "/adminapi/merchant/shopWithdraw/batch"),
            ("POST", "/adminapi/merchant/shopWithdraw/uploadPayVoucher"),
            ("GET", "/adminapi/merchant/shopWithdraw/summaryList"),
            ("GET", "/adminapi/merchant/shopWithdraw/dualBalance"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len());
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
        let owned: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        for path in [
            "/merchant/shopWithdraw/list",
            "/merchant/shopWithdraw/detail",
            "/merchant/shopWithdraw/config",
            "/merchant/shopWithdraw/audit",
        ] {
            assert!(
                !owned.contains(&path),
                "{path} 属于 merchant::shop，不应重复"
            );
        }
    }

    /// 店铺接口强制自身店铺；平台接口拒绝店铺/供应商账号。
    #[test]
    fn tenant_boundaries_are_enforced() {
        assert_eq!(require_shop(&shop()).unwrap(), 9);
        assert!(require_shop(&platform()).is_err());
        assert!(require_platform(&platform()).is_ok());
        assert!(require_platform(&shop()).is_err());
        assert!(require_platform(&vendor()).is_err());
    }
}
