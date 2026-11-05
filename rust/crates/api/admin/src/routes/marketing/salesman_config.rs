//! 分销模式设置 —— 管理端路由（marketing::salesman_config）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanConfigController`
//! （`@RequestMapping("/adminapi/salesman/config")`，2 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/salesman/config/detail?code=` | `detail` |
//! | `POST` | `/salesman/config/save?code=` | `save` |
//!
//! # 请求/响应
//! - `detail`：返回配置 JSON（Java `SalesmanConfigVO`），已补默认值；
//! - `save`：`code` 在 query string，配置体为 JSON（Java
//!   `@RequestParam("code") + @RequestBody SalesmanConfigSaveParam`）。
//!
//! # 权限
//! `detail` 仅登录；`save` 需 `salesmanConfigModifyManage`（Rust 全局只校验登录态）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use tigshop_core::models::marketing::salesman_config::SalesmanConfigSaveDTO;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 2 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/salesman/config/detail",
        "SalesmanConfigController.detail",
    ),
    (
        "POST",
        "/salesman/config/save",
        "SalesmanConfigController.save",
    ),
];

/// 配置管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/config/detail", get(detail))
        .route("/salesman/config/save", post(save))
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `?code=` 查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodeQuery {
    code: Option<String>,
}

async fn detail(State(state): State<AdminState>, Query(q): Query<CodeQuery>) -> ApiResult<Value> {
    let code = q
        .code
        .ok_or_else(|| tigshop_core::Error::Validation("code不能为空".into()))?;
    ok(state.marketing.salesman_config.detail(&code).await?)
}

async fn save(
    State(state): State<AdminState>,
    Query(q): Query<CodeQuery>,
    Json(dto): Json<SalesmanConfigSaveDTO>,
) -> ApiResult<()> {
    let code = q
        .code
        .ok_or_else(|| tigshop_core::Error::Validation("code不能为空".into()))?;
    state.marketing.salesman_config.save(&code, &dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec!["/salesman/config/detail", "/salesman/config/save"]
        );
        for p in &paths {
            assert!(p.starts_with("/salesman/config/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].path, "/adminapi/salesman/config/detail");
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[1].path, "/adminapi/salesman/config/save");
        assert_eq!(docs[1].method, "POST");
        for d in &docs {
            assert!(d.java_ref.starts_with("SalesmanConfigController."));
        }
    }

    #[test]
    fn code_query_parses() {
        let q: CodeQuery = serde_json::from_str(r#"{"code":"salesmanConfig"}"#).unwrap();
        assert_eq!(q.code.as_deref(), Some("salesmanConfig"));
    }

    #[test]
    fn save_body_parses_camel_case() {
        let dto: SalesmanConfigSaveDTO =
            serde_json::from_str(r#"{"distributionMode":2,"recruitMethods":[1,2]}"#).unwrap();
        assert_eq!(dto.distribution_mode, Some(2));
        assert_eq!(dto.recruit_methods, Some(vec![1, 2]));
    }
}
