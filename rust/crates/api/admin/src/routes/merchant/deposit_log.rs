//! 店铺保证金交易明细 —— 管理端路由（merchant::deposit_log）—— wave9。
//!
//! 原 Java `DepositLogController`（`@RequestMapping("/adminapi/deposit/log")`）：
//! `GET /adminapi/deposit/log/list`、`GET /adminapi/deposit/log/detail`。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::deposit_log::{DepositLogListQuery, DepositLogVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    ("GET", "/deposit/log/list", "DepositLogController.list"),
    ("GET", "/deposit/log/detail", "DepositLogController.detail"),
];

/// 保证金明细路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/log/list", get(list))
        .route("/deposit/log/detail", get(detail))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// 保证金账户/流水/规则/设置/收款账户均为**平台级**数据：
/// 店铺/门店/POS/供应商账号一律 403（不信任任何请求头/查询参数里的店铺标识）。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问保证金管理".into()).into());
    }
    Ok(())
}

/// `GET /adminapi/deposit/log/list`
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositLogListQuery>,
) -> ApiResult<PageResult<DepositLogVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_log.list(&q).await?)
}

/// `GET /adminapi/deposit/log/detail?id=`
async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<IdQuery>,
) -> ApiResult<DepositLogVO> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_log.detail(q.id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tenant_platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn tenant_shop(shop_id: i32) -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(shop_id), None)
    }

    fn tenant_vendor(vendor_id: i32) -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(vendor_id))
    }

    /// 平台账号放行；店铺/供应商账号被 403 拒绝。
    #[test]
    fn platform_only_guard() {
        assert!(require_platform(&tenant_platform()).is_ok());
        for t in [tenant_shop(9), tenant_vendor(3)] {
            let err = require_platform(&t).expect_err("非平台账号应被拒绝");
            assert_eq!(err.0.business_code(), 403);
        }
    }

    #[test]
    fn route_table_matches_contract() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        let docs = implemented_routes();
        assert_eq!(docs[0].path, "/adminapi/deposit/log/list");
        assert_eq!(docs[1].path, "/adminapi/deposit/log/detail");
    }

    #[test]
    fn both_are_get() {
        assert!(ROUTE_TABLE.iter().all(|(m, _, _)| *m == "GET"));
    }
}
