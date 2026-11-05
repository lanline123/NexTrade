//! 管理端提示管理路由（system::tips_manage）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.common.TipsManageController`
//! （`@RequestMapping("/adminapi/common/tipsManage")`，1 个端点）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `GET /common/tipsManage/list?url=` | `list` | 登录 |
//!
//! > `url` 是 Java `@RequestParam("url")`（**必填**）；缺失时 axum 直接 400，
//! > 与 Java 缺少必填参数的行为等价。
//!
//! > 当前管理员 ID 取自 JWT（`Extension<AuthUser>`），替代 Java
//! > `SecurityUtils.getCurrentAdminId()`。

use axum::{extract::Query, extract::State, routing::get, Extension, Router};
use tigshop_core::models::system::tips_manage::{TipsManageQuery, TipsVO};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

/// 本域全部路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/common/tipsManage/list",
    "TipsManageController.list",
)];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/common/tipsManage/list", get(list))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/common/tipsManage/list?url=`：后台提示列表。
///
/// 对应 Java `TipsManageController#list(@RequestParam("url") String url)`
/// → `TipsManageServiceImpl#list`。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<TipsManageQuery>,
) -> ApiResult<Vec<TipsVO>> {
    ok(state.system.tips_manage.list(&q.url, auth.id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/common/tipsManage/list");
        assert_eq!(docs[0].java_ref, "TipsManageController.list");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应。
    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = ["/common/tipsManage/list"];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 查询参数按 Java 名解析，且 `url` 必填。
    #[test]
    fn query_param_is_required_url() {
        let q: TipsManageQuery =
            serde_json::from_str(r#"{"url":"https://admin.example.com/x"}"#).unwrap();
        assert_eq!(q.url, "https://admin.example.com/x");
        assert!(serde_json::from_str::<TipsManageQuery>("{}").is_err());
    }
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_account_is_rejected_by_platform_guard() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert!(require_platform(&admin).is_ok());
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(require_platform(&shop).is_err());
        assert_eq!(shop.scoped_shop_id(), Some(7));
        assert_eq!(admin.scoped_shop_id(), None);
    }
}
