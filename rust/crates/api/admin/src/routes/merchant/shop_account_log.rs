//! 店铺账户 —— 管理端路由（merchant::shop_account_log）—— wave9。
//!
//! 原 Java `com.tigshop.adminapi.controller.shop.AccountController`
//! （`@RequestMapping("/adminapi/merchant/shopAccount")`）：
//! `GET /adminapi/merchant/shopAccount/index`（店铺余额汇总）。
//!
//! > 契约中其余 2 条为 public（`/api/user/account/*`），见
//! > `api/public/src/routes/merchant/shop_account_log.rs`。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::merchant::shop_account_log::{ShopAccountQuery, ShopAccountVO};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/merchant/shopAccount/index",
    "AccountController.index",
)];

/// 店铺账户路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/merchant/shopAccount/index", get(index))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

/// `GET /adminapi/merchant/shopAccount/index?shopId=`
///
/// 多租户：`shopId` 只作为**平台账号**的筛选参数；店铺/门店/POS 账号由
/// `AuthUser::resolve_shop_scope` 强制到自身店铺（越权 shopId → 403）。
async fn index(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<ShopAccountQuery>,
) -> ApiResult<ShopAccountVO> {
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    if auth.scoped_shop_id().is_some() {
        q.shop_id = scope;
    }
    ok(state.merchant.shop_account_log.index(&q, scope).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// 店铺账号列表强制过滤自身店铺；平台账号可见全部。
    #[test]
    fn shop_scope_is_forced_for_shop_account() {
        assert_eq!(shop_account(9).resolve_shop_scope(None).unwrap(), Some(9));
        assert!(shop_account(9).resolve_shop_scope(Some(8)).is_err());
        assert_eq!(platform().resolve_shop_scope(None).unwrap(), None);
        assert_eq!(platform().resolve_shop_scope(Some(8)).unwrap(), Some(8));
    }

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/adminapi/merchant/shopAccount/index");
        assert_eq!(ROUTE_TABLE[0].0, "GET");
    }

    #[test]
    fn path_has_no_adminapi_prefix() {
        assert!(!ROUTE_TABLE[0].1.contains("/adminapi"));
    }
}
