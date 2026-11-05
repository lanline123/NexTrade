//! 批发商管理 —— 管理端路由（wholesale::wholesaler）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.wholesale.WholesalerController`
//! （`@RequestMapping("/adminapi/wholesale/wholesaler")`，8 个端点）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 参数来源 |
//! |-----------|------------------|----------------|----------|
//! | `GET  /wholesale/wholesaler/page` | `GET /adminapi/wholesale/wholesaler/page` | `WholesalerController.page` | query `WholesalerPageQuery` |
//! | `GET  /wholesale/wholesaler/selectableUserPage` | `GET /adminapi/wholesale/wholesaler/selectableUserPage` | `WholesalerController.selectableUserPage` | query（`UserListDTO` 子集） |
//! | `POST /wholesale/wholesaler/add` | `POST /adminapi/wholesale/wholesaler/add` | `WholesalerController.add` | JSON `WholesalerAddDTO` → `{"wholesalerId": id}` |
//! | `POST /wholesale/wholesaler/import` | `POST /adminapi/wholesale/wholesaler/import` | `WholesalerController.importBatch` | JSON `WholesalerImportDTO` → `WholesalerImportResultVO` |
//! | `POST /wholesale/wholesaler/setStatus` | `POST /adminapi/wholesale/wholesaler/setStatus` | `WholesalerController.setStatus` | **query** `wholesalerId` / `status` |
//! | `POST /wholesale/wholesaler/changeGrade` | `POST /adminapi/wholesale/wholesaler/changeGrade` | `WholesalerController.changeGrade` | **query** `wholesalerId` / `gradeId` |
//! | `POST /wholesale/wholesaler/removeByGrade` | `POST /adminapi/wholesale/wholesaler/removeByGrade` | `WholesalerController.removeByGrade` | JSON → `{"removedCount": n}` |
//! | `POST /wholesale/wholesaler/remove` | `POST /adminapi/wholesale/wholesaler/remove` | `WholesalerController.remove` | JSON → `{"removedCount": n}` |
//!
//! # 说明
//!
//! - `setStatus` / `changeGrade` 的 Java 参数是 `@RequestParam`（query），
//!   不是 JSON body —— 本模块保持一致，缺失参数显式转
//!   `Error::Validation`（Java 为 Spring 400）。
//! - 本域 8 条在 Java 均无 `@PreAuthorize`（注释写明「批发商管理/等级/设置
//!   仍为平台独有」但控制器未加注解），故仅需登录态。
//! - `list` 类接口返回 `PageResult`（Java 为 MyBatis-Plus `IPage`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::wholesale::wholesaler::{
    WholesalerAddDTO, WholesalerImportDTO, WholesalerImportResultVO, WholesalerPageQuery,
    WholesalerRemoveByGradeDTO, WholesalerRemoveDTO, WholesalerSelectableUserQuery,
    WholesalerSelectableUserVO, WholesalerVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/wholesale/wholesaler/page",
        "WholesalerController.page",
    ),
    (
        "GET",
        "/wholesale/wholesaler/selectableUserPage",
        "WholesalerController.selectableUserPage",
    ),
    (
        "POST",
        "/wholesale/wholesaler/add",
        "WholesalerController.add",
    ),
    (
        "POST",
        "/wholesale/wholesaler/import",
        "WholesalerController.importBatch",
    ),
    (
        "POST",
        "/wholesale/wholesaler/setStatus",
        "WholesalerController.setStatus",
    ),
    (
        "POST",
        "/wholesale/wholesaler/changeGrade",
        "WholesalerController.changeGrade",
    ),
    (
        "POST",
        "/wholesale/wholesaler/removeByGrade",
        "WholesalerController.removeByGrade",
    ),
    (
        "POST",
        "/wholesale/wholesaler/remove",
        "WholesalerController.remove",
    ),
];

/// 批发商管理路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wholesale/wholesaler/page", get(page))
        .route(
            "/wholesale/wholesaler/selectableUserPage",
            get(selectable_user_page),
        )
        .route("/wholesale/wholesaler/add", post(add))
        .route("/wholesale/wholesaler/import", post(import_batch))
        .route("/wholesale/wholesaler/setStatus", post(set_status))
        .route("/wholesale/wholesaler/changeGrade", post(change_grade))
        .route("/wholesale/wholesaler/removeByGrade", post(remove_by_grade))
        .route("/wholesale/wholesaler/remove", post(remove))
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

/// `setStatus` 的查询参数（Java `@RequestParam Integer wholesalerId` +
/// `@RequestParam Integer status`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetStatusQuery {
    wholesaler_id: Option<i32>,
    status: Option<i32>,
}

/// `changeGrade` 的查询参数（Java `@RequestParam Integer wholesalerId` +
/// `@RequestParam Integer gradeId`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeGradeQuery {
    wholesaler_id: Option<i32>,
    grade_id: Option<i32>,
}

/// `GET /adminapi/wholesale/wholesaler/page`：批发商分页。
async fn page(
    State(state): State<AdminState>,
    Query(q): Query<WholesalerPageQuery>,
) -> ApiResult<PageResult<WholesalerVO>> {
    ok(state.wholesale.wholesaler.page(&q).await?)
}

/// `GET /adminapi/wholesale/wholesaler/selectableUserPage`：可选会员分页。
async fn selectable_user_page(
    State(state): State<AdminState>,
    Query(q): Query<WholesalerSelectableUserQuery>,
) -> ApiResult<PageResult<WholesalerSelectableUserVO>> {
    ok(state.wholesale.wholesaler.selectable_user_page(&q).await?)
}

/// `POST /adminapi/wholesale/wholesaler/add`：添加批发商 → `{"wholesalerId": id}`。
async fn add(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalerAddDTO>,
) -> ApiResult<serde_json::Value> {
    let wholesaler_id = state.wholesale.wholesaler.add(&dto).await?;
    ok(serde_json::json!({ "wholesalerId": wholesaler_id }))
}

/// `POST /adminapi/wholesale/wholesaler/import`：批量导入批发商。
async fn import_batch(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalerImportDTO>,
) -> ApiResult<WholesalerImportResultVO> {
    ok(state.wholesale.wholesaler.import_batch(&dto).await?)
}

/// `POST /adminapi/wholesale/wholesaler/setStatus`：批发商启停。
async fn set_status(
    State(state): State<AdminState>,
    Query(q): Query<SetStatusQuery>,
) -> ApiResult<()> {
    let id = q
        .wholesaler_id
        .ok_or_else(|| tigshop_core::Error::Validation("wholesalerId 不能为空".into()))?;
    state.wholesale.wholesaler.set_status(id, q.status).await?;
    ok(())
}

/// `POST /adminapi/wholesale/wholesaler/changeGrade`：批发商改等级。
async fn change_grade(
    State(state): State<AdminState>,
    Query(q): Query<ChangeGradeQuery>,
) -> ApiResult<()> {
    let id = q
        .wholesaler_id
        .ok_or_else(|| tigshop_core::Error::Validation("wholesalerId 不能为空".into()))?;
    let grade_id = q
        .grade_id
        .ok_or_else(|| tigshop_core::Error::Validation("gradeId 不能为空".into()))?;
    state
        .wholesale
        .wholesaler
        .change_grade(id, grade_id)
        .await?;
    ok(())
}

/// `POST /adminapi/wholesale/wholesaler/removeByGrade`：按等级移除批发商。
async fn remove_by_grade(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalerRemoveByGradeDTO>,
) -> ApiResult<serde_json::Value> {
    let removed = state.wholesale.wholesaler.remove_by_grade(&dto).await?;
    ok(serde_json::json!({ "removedCount": removed }))
}

/// `POST /adminapi/wholesale/wholesaler/remove`：按 ID 移除批发商身份。
async fn remove(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalerRemoveDTO>,
) -> ApiResult<serde_json::Value> {
    let removed = state.wholesale.wholesaler.remove(&dto).await?;
    ok(serde_json::json!({ "removedCount": removed }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表与契约 8 条逐字符一致。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/wholesale/wholesaler/page",
                "/wholesale/wholesaler/selectableUserPage",
                "/wholesale/wholesaler/add",
                "/wholesale/wholesaler/import",
                "/wholesale/wholesaler/setStatus",
                "/wholesale/wholesaler/changeGrade",
                "/wholesale/wholesaler/removeByGrade",
                "/wholesale/wholesaler/remove",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/wholesale/wholesaler/"), "{p} 前缀错误");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 返回完整契约路径（含 `/adminapi`），无重复。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        let mut actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), actual.len());
        actual.sort();
        assert_eq!(
            actual,
            vec![
                (
                    "GET".to_string(),
                    "/adminapi/wholesale/wholesaler/page".to_string()
                ),
                (
                    "GET".to_string(),
                    "/adminapi/wholesale/wholesaler/selectableUserPage".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/add".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/changeGrade".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/import".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/remove".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/removeByGrade".to_string()
                ),
                (
                    "POST".to_string(),
                    "/adminapi/wholesale/wholesaler/setStatus".to_string()
                ),
            ]
        );
    }

    /// method 与 Java 注解一致：只有 page / selectableUserPage 是 GET。
    #[test]
    fn http_methods_match_java_annotations() {
        let gets: Vec<&str> = ROUTE_TABLE
            .iter()
            .filter(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| *p)
            .collect();
        assert_eq!(
            gets,
            vec![
                "/wholesale/wholesaler/page",
                "/wholesale/wholesaler/selectableUserPage"
            ]
        );
    }

    /// query 参数 camelCase（`wholesalerId` / `gradeId` / `pageSize`）。
    #[test]
    fn query_params_parse_camel_case() {
        let s: SetStatusQuery = serde_json::from_str(r#"{"wholesalerId":5,"status":1}"#).unwrap();
        assert_eq!(s.wholesaler_id, Some(5));
        assert_eq!(s.status, Some(1));
        let g: ChangeGradeQuery =
            serde_json::from_str(r#"{"wholesalerId":5,"gradeId":2}"#).unwrap();
        assert_eq!(g.grade_id, Some(2));
        let p: WholesalerPageQuery =
            serde_json::from_str(r#"{"page":1,"size":20,"keyword":"王"}"#).unwrap();
        assert_eq!(p.page_size, Some(20));
        assert_eq!(p.keyword.as_deref(), Some("王"));
    }
}
