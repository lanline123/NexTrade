//! 管理端发票资质路由（payment::user_invoice）。
//!
//! 原 Java：`com.tigshop.adminapi.controller.finance.UserInvoiceController`
//! （`java/tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/finance/UserInvoiceController.java`，
//! `@RequestMapping("/adminapi/finance/userInvoice")`，7 个端点）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth / 权限 |
//! |-----------|------------------|----------------|------------------|
//! | `GET /finance/userInvoice/list` | `GET /adminapi/finance/userInvoice/list` | `UserInvoiceController.list` | jwt |
//! | `GET /finance/userInvoice/detail` | `GET /adminapi/finance/userInvoice/detail` | `UserInvoiceController.detail` | jwt |
//! | `POST /finance/userInvoice/create` | `POST /adminapi/finance/userInvoice/create` | `UserInvoiceController.create` | jwt |
//! | `POST /finance/userInvoice/update` | `POST /adminapi/finance/userInvoice/update` | `UserInvoiceController.update` | jwt+`userInvoiceUpdateManage` |
//! | `POST /finance/userInvoice/del` | `POST /adminapi/finance/userInvoice/del` | `UserInvoiceController.del` | jwt+`userInvoiceDelManage` |
//! | `POST /finance/userInvoice/updateField` | `POST /adminapi/finance/userInvoice/updateField` | `UserInvoiceController.updateField` | jwt |
//! | `POST /finance/userInvoice/batch` | `POST /adminapi/finance/userInvoice/batch` | `UserInvoiceController.batch` | jwt+`userInvoiceBatchManage` |
//!
//! > **路径说明**：`@RequestMapping("/adminapi/finance/userInvoice")` +
//! > `@GetMapping("/list")` 拼出 `/adminapi/finance/userInvoice/list` ——
//! > `finance` 与 `userInvoice` 各出现一次，`userInvoice` 大小写原样照抄；
//! > 本文件挂在 `/adminapi` 之下，故 `routes()` 内只写 `/finance/userInvoice/...`。
//!
//! > **权限**：Java `update/del/batch` 带 `@PreAuthorize`，但权限矩阵未迁移
//! > （Rust 只校验登录态，与既有 payment 切片一致）；上表权限列仅作对照。
//!
//! > **返回结构**：Java `list` 返回 MyBatis-Plus `Page<UserInvoiceVO>`
//! > （`records/total/size/current/pages`），Rust 统一用 [`PageResult`]
//! > （`list/total/totalPage/pageSize/page`）；其余写接口 Java 返回 `void`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::user_invoice::{
    BatchDTO, OperateDTO, UpdateFieldDTO, UserInvoiceCreateDTO, UserInvoiceListQuery,
    UserInvoiceUpdateDTO, UserInvoiceVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/finance/userInvoice/list",
        "UserInvoiceController.list",
    ),
    (
        "GET",
        "/finance/userInvoice/detail",
        "UserInvoiceController.detail",
    ),
    (
        "POST",
        "/finance/userInvoice/create",
        "UserInvoiceController.create",
    ),
    (
        "POST",
        "/finance/userInvoice/update",
        "UserInvoiceController.update",
    ),
    (
        "POST",
        "/finance/userInvoice/del",
        "UserInvoiceController.del",
    ),
    (
        "POST",
        "/finance/userInvoice/updateField",
        "UserInvoiceController.updateField",
    ),
    (
        "POST",
        "/finance/userInvoice/batch",
        "UserInvoiceController.batch",
    ),
];

/// 发票资质域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py` 静态扫描 `.route("...")` 字面量，
/// 循环拼接会让覆盖率统计看不见这些路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/userInvoice/list", get(list))
        .route("/finance/userInvoice/detail", get(detail))
        .route("/finance/userInvoice/create", post(create))
        .route("/finance/userInvoice/update", post(update))
        .route("/finance/userInvoice/del", post(del))
        .route("/finance/userInvoice/updateField", post(update_field))
        .route("/finance/userInvoice/batch", post(batch))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `detail?id=` 查询参数（Java `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/finance/userInvoice/list`：发票资质分页列表。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<UserInvoiceListQuery>,
) -> ApiResult<PageResult<UserInvoiceVO>> {
    ok(state.payment.user_invoice.list(&q).await?)
}

/// `GET /adminapi/finance/userInvoice/detail`：发票资质详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<UserInvoiceVO> {
    ok(state.payment.user_invoice.detail(q.id).await?)
}

/// `POST /adminapi/finance/userInvoice/create`：创建发票资质。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<UserInvoiceCreateDTO>,
) -> ApiResult<()> {
    let _id = state.payment.user_invoice.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/finance/userInvoice/update`：更新发票资质。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<UserInvoiceUpdateDTO>,
) -> ApiResult<()> {
    state.payment.user_invoice.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/finance/userInvoice/del`：删除发票资质。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.payment.user_invoice.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/finance/userInvoice/updateField`：更新单字段（白名单仅 `status`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.payment.user_invoice.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/finance/userInvoice/batch`：批量操作（仅 `del` 生效）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.payment.user_invoice.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("GET", "/adminapi/finance/userInvoice/list"),
            ("GET", "/adminapi/finance/userInvoice/detail"),
            ("POST", "/adminapi/finance/userInvoice/create"),
            ("POST", "/adminapi/finance/userInvoice/update"),
            ("POST", "/adminapi/finance/userInvoice/del"),
            ("POST", "/adminapi/finance/userInvoice/updateField"),
            ("POST", "/adminapi/finance/userInvoice/batch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        // 不允许重复注册（axum merge 重复路径会在启动时 panic）
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn route_table_matches_registrations() {
        let paths = [
            ("GET", "/finance/userInvoice/list"),
            ("GET", "/finance/userInvoice/detail"),
            ("POST", "/finance/userInvoice/create"),
            ("POST", "/finance/userInvoice/update"),
            ("POST", "/finance/userInvoice/del"),
            ("POST", "/finance/userInvoice/updateField"),
            ("POST", "/finance/userInvoice/batch"),
        ];
        assert_eq!(paths.len(), ROUTE_TABLE.len());
        for (m, p) in paths {
            assert!(
                ROUTE_TABLE.iter().any(|(mm, pp, _)| *mm == m && *pp == p),
                "ROUTE_TABLE 缺少 {m} {p}"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(paths.iter().any(|(_, pp)| pp == p));
        }
    }

    #[test]
    fn module_paths_are_relative_to_adminapi() {
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/adminapi"), "{path}");
            assert!(path.starts_with("/finance/userInvoice/"), "{path}");
        }
        assert_eq!(
            implemented_routes()[0].path,
            "/adminapi/finance/userInvoice/list"
        );
    }
}
