//! 管理端对账单路由（payment::statement，6 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.finance.StatementController`
//! （`@RequestMapping("/adminapi/finance/statement")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET  /finance/statement/getStatementList` | `getStatementList` |
//! | `POST /finance/statement/saveStatementDownload` | `saveStatementDownload` |
//! | `GET  /finance/statement/exportStatement` | `exportStatement` |
//! | `GET  /finance/statement/exportStatementStatistics` | `exportStatementStatistics` |
//! | `GET  /finance/statement/getStatementStatisticsList` | `getStatementStatisticsList` |
//! | `GET  /finance/statement/getStatementQueryConfig` | `getStatementQueryConfig` |
//!
//! > 导出端点 Java 为 `@ResponseExcel`；Rust 无 Excel writer，契约降级为 JSON 数组。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::payment::statement::{
    StatementDownloadSaveParam, StatementExportVO, StatementListQuery, StatementListVO,
    StatementQueryContentVO, StatementStatisticsExportVO, StatementStatisticsQuery,
    StatementStatisticsVO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 本域 6 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/finance/statement/getStatementList",
        "StatementController.getStatementList",
    ),
    (
        "POST",
        "/finance/statement/saveStatementDownload",
        "StatementController.saveStatementDownload",
    ),
    (
        "GET",
        "/finance/statement/exportStatement",
        "StatementController.exportStatement",
    ),
    (
        "GET",
        "/finance/statement/exportStatementStatistics",
        "StatementController.exportStatementStatistics",
    ),
    (
        "GET",
        "/finance/statement/getStatementStatisticsList",
        "StatementController.getStatementStatisticsList",
    ),
    (
        "GET",
        "/finance/statement/getStatementQueryConfig",
        "StatementController.getStatementQueryConfig",
    ),
];

/// 对账单路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/statement/getStatementList", get(list))
        .route(
            "/finance/statement/saveStatementDownload",
            post(save_download),
        )
        .route("/finance/statement/exportStatement", get(export_statement))
        .route(
            "/finance/statement/exportStatementStatistics",
            get(export_statistics),
        )
        .route(
            "/finance/statement/getStatementStatisticsList",
            get(statistics_list),
        )
        .route(
            "/finance/statement/getStatementQueryConfig",
            get(query_config),
        )
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/finance/statement/getStatementList`：对账单列表。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<StatementListQuery>,
) -> ApiResult<PageResult<StatementListVO>> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.payment.statement.list(&q).await?)
}

/// `POST /adminapi/finance/statement/saveStatementDownload`：保存下载信息。
async fn save_download(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut param): Json<StatementDownloadSaveParam>,
) -> ApiResult<()> {
    let shop = auth.require_shop_scope(param.shop_id.and_then(|v| i32::try_from(v).ok()))?;
    param.shop_id = Some(i64::from(shop));
    state.payment.statement.save_download(&param).await?;
    ok(())
}

/// `GET /adminapi/finance/statement/exportStatement`：导出对账单（JSON 降级）。
async fn export_statement(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<StatementListQuery>,
) -> Result<axum::response::Response, AppError> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    let (file_name, bytes) = state.payment.statement.export_statement_xlsx(&q).await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes, &file_name,
    ))
}

/// `GET /adminapi/finance/statement/exportStatementStatistics`：导出统计
/// （Java `@ResponseExcel`，返回 xlsx 文件流）。
async fn export_statistics(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<StatementStatisticsQuery>,
) -> Result<axum::response::Response, AppError> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    let (file_name, bytes) = state.payment.statement.export_statistics_xlsx(&q).await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes, &file_name,
    ))
}

/// `GET /adminapi/finance/statement/getStatementStatisticsList`：对账单统计。
async fn statistics_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<StatementStatisticsQuery>,
) -> ApiResult<Vec<StatementStatisticsVO>> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.payment.statement.statistics_list(&q).await?)
}

/// `GET /adminapi/finance/statement/getStatementQueryConfig`：查询字段配置。
async fn query_config(State(state): State<AdminState>) -> ApiResult<StatementQueryContentVO> {
    ok(state.payment.statement.query_config())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/finance/statement/getStatementList"),
            ("POST", "/adminapi/finance/statement/saveStatementDownload"),
            ("GET", "/adminapi/finance/statement/exportStatement"),
            (
                "GET",
                "/adminapi/finance/statement/exportStatementStatistics",
            ),
            (
                "GET",
                "/adminapi/finance/statement/getStatementStatisticsList",
            ),
            ("GET", "/adminapi/finance/statement/getStatementQueryConfig"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn route_table_is_exact_spec_slice() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        assert!(ROUTE_TABLE
            .iter()
            .all(|(_, p, _)| p.starts_with("/finance/statement/")));
    }
}
#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn export_scope_is_forced_for_shop_account() {
        use tigshop_core::Error;
        let shop = AuthUser::new(1, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop.resolve_shop_scope(None).unwrap(), Some(7));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
    }
}
