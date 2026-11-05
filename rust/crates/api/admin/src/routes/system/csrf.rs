//! 管理端表单令牌路由：`GET /adminapi/common/csrf/create`。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.common.CSRFController#create`。
//!
//! ⚠️ 该路径在 Java `SecurityConfig#URL_WHITELIST` 中（`/adminapi/common/csrf/**`），
//! 即**免登录**。因此本模块注册在管理端「匿名路由聚合」(`public_routes`)，
//! 由 `router()` 以不带 `require_auth` 的方式 nest 到 `/adminapi` 下。

use axum::{extract::State, routing::get, Router};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 1] =
    [("GET", "/common/csrf/create", "CSRFController.create")];

/// 匿名路由（免登录）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/common/csrf/create", get(create))
}

/// 本模块已实现路由（覆盖率统计用，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/common/csrf/create`：生成表单令牌。
async fn create(State(state): State<AdminState>) -> ApiResult<String> {
    ok(state.system.csrf.create().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_implemented_routes() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), ROUTE_TABLE.len());
        for (idx, (method, path, handler)) in ROUTE_TABLE.iter().enumerate() {
            assert_eq!(docs[idx].method, *method);
            assert_eq!(docs[idx].path, format!("/adminapi{path}"));
            assert_eq!(docs[idx].java_ref, *handler);
        }
    }

    #[test]
    fn route_table_has_expected_path() {
        assert_eq!(implemented_routes()[0].path, "/adminapi/common/csrf/create");
    }
}
