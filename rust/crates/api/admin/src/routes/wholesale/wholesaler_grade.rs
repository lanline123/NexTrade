//! 批发商等级 —— 管理端路由（wholesale::wholesaler_grade）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.wholesale.WholesalerGradeController`
//! （`@RequestMapping("/adminapi/wholesale/grade")`，4 个端点）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |-----------|------------------|----------------|--------------------------|
//! | `GET  /wholesale/grade/list` | `GET /adminapi/wholesale/grade/list` | `WholesalerGradeController.list` | 仅需登录 |
//! | `POST /wholesale/grade/save` | `POST /adminapi/wholesale/grade/save` | `WholesalerGradeController.save` | `wholesalerGradeSaveManage` |
//! | `POST /wholesale/grade/setStatus` | `POST /adminapi/wholesale/grade/setStatus` | `WholesalerGradeController.setStatus` | `wholesalerGradeSetStatusManage` |
//! | `POST /wholesale/grade/delete` | `POST /adminapi/wholesale/grade/delete` | `WholesalerGradeController.delete` | `wholesalerGradeDeleteManage` |
//!
//! # 参数来源（逐字符对齐 Java 注解）
//!
//! - `list`：query `status`（可选）+ `withUserCount`（`defaultValue="true"`）
//! - `save`：JSON body `WholesalerGradeSaveDTO`，返回 `{"gradeId": id}`
//! - `setStatus`：**query** 参数 `gradeId` / `status`（Java `@RequestParam`）
//! - `delete`：**query** 参数 `gradeId`（Java `@RequestParam`）
//!
//! `setStatus` / `delete` 的缺失参数由本模块显式转成
//! `Error::Validation`（Java 为 Spring 400）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::wholesale::wholesaler_grade::{
    WholesalerGradeListQuery, WholesalerGradeSaveDTO, WholesalerGradeVO,
};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 4 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "GET",
        "/wholesale/grade/list",
        "WholesalerGradeController.list",
    ),
    (
        "POST",
        "/wholesale/grade/save",
        "WholesalerGradeController.save",
    ),
    (
        "POST",
        "/wholesale/grade/setStatus",
        "WholesalerGradeController.setStatus",
    ),
    (
        "POST",
        "/wholesale/grade/delete",
        "WholesalerGradeController.delete",
    ),
];

/// 批发商等级路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wholesale/grade/list", get(list))
        .route("/wholesale/grade/save", post(save))
        .route("/wholesale/grade/setStatus", post(set_status))
        .route("/wholesale/grade/delete", post(delete))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

/// `setStatus` 的查询参数（Java `@RequestParam Integer gradeId` +
/// `@RequestParam Integer status`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetStatusQuery {
    /// 等级 ID
    grade_id: Option<i32>,
    /// 状态 0=禁用 1=启用
    status: Option<i32>,
}

/// `delete` 的查询参数（Java `@RequestParam Integer gradeId`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteQuery {
    /// 等级 ID
    grade_id: Option<i32>,
}

/// `GET /adminapi/wholesale/grade/list`：等级列表。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<WholesalerGradeListQuery>,
) -> ApiResult<Vec<WholesalerGradeVO>> {
    ok(state.wholesale.wholesaler_grade.list(&q).await?)
}

/// `POST /adminapi/wholesale/grade/save`：等级新增/编辑，返回 `{"gradeId": id}`。
async fn save(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalerGradeSaveDTO>,
) -> ApiResult<serde_json::Value> {
    let grade_id = state.wholesale.wholesaler_grade.save(&dto).await?;
    ok(serde_json::json!({ "gradeId": grade_id }))
}

/// `POST /adminapi/wholesale/grade/setStatus`：等级启停。
async fn set_status(
    State(state): State<AdminState>,
    Query(q): Query<SetStatusQuery>,
) -> ApiResult<()> {
    let grade_id = q
        .grade_id
        .ok_or_else(|| tigshop_core::Error::Validation("gradeId 不能为空".into()))?;
    state
        .wholesale
        .wholesaler_grade
        .set_status(grade_id, q.status)
        .await?;
    ok(())
}

/// `POST /adminapi/wholesale/grade/delete`：删除等级（软删）。
async fn delete(State(state): State<AdminState>, Query(q): Query<DeleteQuery>) -> ApiResult<()> {
    let grade_id = q
        .grade_id
        .ok_or_else(|| tigshop_core::Error::Validation("gradeId 不能为空".into()))?;
    state.wholesale.wholesaler_grade.delete(grade_id).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表与契约 4 条逐字符一致。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 4);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/wholesale/grade/list",
                "/wholesale/grade/save",
                "/wholesale/grade/setStatus",
                "/wholesale/grade/delete",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/wholesale/grade/"), "{p} 前缀错误");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 返回完整契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4);
        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        assert_eq!(
            actual,
            vec![
                (
                    "GET".to_string(),
                    "/adminapi/wholesale/grade/list".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/grade/save".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/grade/setStatus".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/grade/delete".to_string()
                ),
            ]
        );
    }

    /// method 与 Java 注解一致（list GET，其余 POST）。
    #[test]
    fn http_methods_match_java_annotations() {
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[1].0, "POST");
        assert_eq!(ROUTE_TABLE[2].0, "POST");
        assert_eq!(ROUTE_TABLE[3].0, "POST");
    }

    /// `routes()` 注册路径与 ROUTE_TABLE 一一对应。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/wholesale/grade/list",
            "/wholesale/grade/save",
            "/wholesale/grade/setStatus",
            "/wholesale/grade/delete",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, p, _)| *p == path));
        }
    }

    /// query 参数 camelCase：`gradeId` / `status` / `withUserCount`。
    #[test]
    fn query_params_parse_camel_case() {
        let q: SetStatusQuery = serde_json::from_str(r#"{"gradeId":3,"status":1}"#).unwrap();
        assert_eq!(q.grade_id, Some(3));
        assert_eq!(q.status, Some(1));
        let d: DeleteQuery = serde_json::from_str(r#"{"gradeId":3}"#).unwrap();
        assert_eq!(d.grade_id, Some(3));
        let l: WholesalerGradeListQuery =
            serde_json::from_str(r#"{"status":1,"withUserCount":false}"#).unwrap();
        assert_eq!(l.status, Some(1));
        assert!(!l.with_user_count());
    }
}
