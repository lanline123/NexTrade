//! 管理端店铺保证金规则路由（merchant::deposit_rule，6 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.deposit.DepositRuleController`
//! （`@RequestMapping("/adminapi/deposit/rule")`，类级
//! `@PreAuthorize("@pms.hasPermission('depositRuleManage')")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET  /deposit/rule/list` | `DepositRuleController.list` |
//! | `GET  /deposit/rule/detail` | `DepositRuleController.detail` |
//! | `POST /deposit/rule/create` | `DepositRuleController.create` |
//! | `POST /deposit/rule/update` | `DepositRuleController.update` |
//! | `POST /deposit/rule/del` | `DepositRuleController.del` |
//! | `POST /deposit/rule/status` | `DepositRuleController.changeStatus` |
//!
//! > 全部注册在管理端需登录路由组（Java 类级权限矩阵未迁移，仅校验登录态）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::deposit_rule::{
    DepositRuleDTO, DepositRuleListQuery, DepositRuleStatusDTO, DepositRuleVO,
};
use tigshop_core::models::merchant::shop_manage::OperateDTO;
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

/// 本域 6 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    ("GET", "/deposit/rule/list", "DepositRuleController.list"),
    (
        "GET",
        "/deposit/rule/detail",
        "DepositRuleController.detail",
    ),
    (
        "POST",
        "/deposit/rule/create",
        "DepositRuleController.create",
    ),
    (
        "POST",
        "/deposit/rule/update",
        "DepositRuleController.update",
    ),
    ("POST", "/deposit/rule/del", "DepositRuleController.del"),
    (
        "POST",
        "/deposit/rule/status",
        "DepositRuleController.changeStatus",
    ),
];

/// 店铺保证金规则路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/rule/list", get(list))
        .route("/deposit/rule/detail", get(detail))
        .route("/deposit/rule/create", post(create))
        .route("/deposit/rule/update", post(update))
        .route("/deposit/rule/del", post(del))
        .route("/deposit/rule/status", post(change_status))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// 主键查询参数（`?id=`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    id: Option<i32>,
}

/// 保证金账户/流水/规则/设置/收款账户均为**平台级**数据：
/// 店铺/门店/POS/供应商账号一律 403（不信任任何请求头/查询参数里的店铺标识）。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问保证金管理".into()).into());
    }
    Ok(())
}

/// `GET /adminapi/deposit/rule/list`：规则分页。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositRuleListQuery>,
) -> ApiResult<PageResult<DepositRuleVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_rule.list(&q).await?)
}

/// `GET /adminapi/deposit/rule/detail?id=`：规则详情。
async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<IdQuery>,
) -> ApiResult<DepositRuleVO> {
    require_platform(&tenant)?;
    ok(state.merchant.deposit_rule.detail(q.id).await?)
}

/// `POST /adminapi/deposit/rule/create`：创建规则。
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRuleDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_rule.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/deposit/rule/update`：更新规则。
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRuleDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_rule.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/deposit/rule/del`：软删除规则。
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_rule.del(dto.id).await?;
    ok(())
}

/// `POST /adminapi/deposit/rule/status`：启用/停用规则。
async fn change_status(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<DepositRuleStatusDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.deposit_rule.change_status(&dto).await?;
    ok(())
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
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/deposit/rule/list"),
            ("GET", "/adminapi/deposit/rule/detail"),
            ("POST", "/adminapi/deposit/rule/create"),
            ("POST", "/adminapi/deposit/rule/update"),
            ("POST", "/adminapi/deposit/rule/del"),
            ("POST", "/adminapi/deposit/rule/status"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn route_table_matches_java_controller_methods() {
        let handlers: Vec<&str> = ROUTE_TABLE.iter().map(|(_, _, h)| *h).collect();
        assert!(handlers.contains(&"DepositRuleController.changeStatus"));
        assert!(!handlers.iter().any(|h| h.ends_with("getStatusList")));
        assert_eq!(ROUTE_TABLE.len(), 6);
    }
}
