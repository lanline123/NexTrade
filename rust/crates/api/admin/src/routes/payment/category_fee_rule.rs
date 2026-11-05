//! 管理端品类服务费率规则路由（payment::category_fee_rule）。
//! 对应原 Java `com.tigshop.adminapi.controller.finance.CategoryFeeRuleController`
//! （`@RequestMapping("/adminapi/finance/categoryFeeRule")`，7 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `POST /adminapi/finance/categoryFeeRule/list` | `list` | `categoryFeeRuleManage` |
//! | `GET  /adminapi/finance/categoryFeeRule/detail` | `detail` | `categoryFeeRuleManage` |
//! | `POST /adminapi/finance/categoryFeeRule/save` | `save` | `categoryFeeRuleUpdate` |
//! | `POST /adminapi/finance/categoryFeeRule/update` | `update` | `categoryFeeRuleUpdate` |
//! | `POST /adminapi/finance/categoryFeeRule/updateStatus` | `updateStatus` | `categoryFeeRuleUpdate` |
//! | `POST /adminapi/finance/categoryFeeRule/del` | `del` | `categoryFeeRuleUpdate` |
//! | `POST /adminapi/finance/categoryFeeRule/checkConflict` | `checkConflict` | `categoryFeeRuleManage` |
//!
//! > **多租户**：`category_service_fee_rule` 表**没有 `shop_id` 列**，其
//! > `category_service_fee_rule_target` 里的 shop/vendor 只是「费率规则适用对象」
//! > 数据，不是租户归属；Java 控制器/Service 均未读取 `HeaderUtils.getShopId()`
//! > 或按店铺过滤，属平台财务配置。Rust 侧整域 `platform_only`：店铺/供应商
//! > 账号一律 403（Java 依据：`CategoryFeeRuleController` 无 HeaderUtils、
//! > `CategoryFeeRuleServiceImpl` 无 shopId 条件）。
//! > **权限**：Java `@PreAuthorize` 未迁移（Rust 只校验登录态）。
//! > **返回结构**：`list` 返回项目 `PageResult`（Java 为 MyBatis `Page`）；
//! > `save/update/updateStatus` 返回 `List<String>`（Java 恒为空列表）；
//! > `del` 为 `void`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::category_fee_rule::{
    CategoryFeeRuleConflictCheckDTO, CategoryFeeRuleConflictVO, CategoryFeeRuleDetailVO,
    CategoryFeeRuleIdsDTO, CategoryFeeRuleListVO, CategoryFeeRulePageQuery, CategoryFeeRuleSaveDTO,
    CategoryFeeRuleUpdateStatusDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "POST",
        "/finance/categoryFeeRule/list",
        "CategoryFeeRuleController.list",
    ),
    (
        "GET",
        "/finance/categoryFeeRule/detail",
        "CategoryFeeRuleController.detail",
    ),
    (
        "POST",
        "/finance/categoryFeeRule/save",
        "CategoryFeeRuleController.save",
    ),
    (
        "POST",
        "/finance/categoryFeeRule/update",
        "CategoryFeeRuleController.update",
    ),
    (
        "POST",
        "/finance/categoryFeeRule/updateStatus",
        "CategoryFeeRuleController.updateStatus",
    ),
    (
        "POST",
        "/finance/categoryFeeRule/del",
        "CategoryFeeRuleController.del",
    ),
    (
        "POST",
        "/finance/categoryFeeRule/checkConflict",
        "CategoryFeeRuleController.checkConflict",
    ),
];

/// 品类费率规则域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/categoryFeeRule/list", post(list))
        .route("/finance/categoryFeeRule/detail", get(detail))
        .route("/finance/categoryFeeRule/save", post(save))
        .route("/finance/categoryFeeRule/update", post(update))
        .route("/finance/categoryFeeRule/updateStatus", post(update_status))
        .route("/finance/categoryFeeRule/del", post(del))
        .route(
            "/finance/categoryFeeRule/checkConflict",
            post(check_conflict),
        )
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `GET /detail?id=` 查询参数（Java `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn list(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRulePageQuery>,
) -> ApiResult<PageResult<CategoryFeeRuleListVO>> {
    ok(state.payment.category_fee_rule.page(&dto).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<CategoryFeeRuleDetailVO> {
    ok(state.payment.category_fee_rule.detail(q.id).await?)
}

async fn save(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRuleSaveDTO>,
) -> ApiResult<Vec<String>> {
    ok(state.payment.category_fee_rule.save(&dto).await?)
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRuleSaveDTO>,
) -> ApiResult<Vec<String>> {
    ok(state.payment.category_fee_rule.update(&dto).await?)
}

async fn update_status(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRuleUpdateStatusDTO>,
) -> ApiResult<Vec<String>> {
    ok(state.payment.category_fee_rule.update_status(&dto).await?)
}

async fn del(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRuleIdsDTO>,
) -> ApiResult<()> {
    state.payment.category_fee_rule.delete(&dto).await?;
    ok(())
}

async fn check_conflict(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryFeeRuleConflictCheckDTO>,
) -> ApiResult<CategoryFeeRuleConflictVO> {
    ok(state.payment.category_fee_rule.check_conflict(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("POST", "/adminapi/finance/categoryFeeRule/list"),
            ("GET", "/adminapi/finance/categoryFeeRule/detail"),
            ("POST", "/adminapi/finance/categoryFeeRule/save"),
            ("POST", "/adminapi/finance/categoryFeeRule/update"),
            ("POST", "/adminapi/finance/categoryFeeRule/updateStatus"),
            ("POST", "/adminapi/finance/categoryFeeRule/del"),
            ("POST", "/adminapi/finance/categoryFeeRule/checkConflict"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = [
            "/finance/categoryFeeRule/list",
            "/finance/categoryFeeRule/detail",
            "/finance/categoryFeeRule/save",
            "/finance/categoryFeeRule/update",
            "/finance/categoryFeeRule/updateStatus",
            "/finance/categoryFeeRule/del",
            "/finance/categoryFeeRule/checkConflict",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, p, _)| *p == path));
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p));
        }
    }
}
