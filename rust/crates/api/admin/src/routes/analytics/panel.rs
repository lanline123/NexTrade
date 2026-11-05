//! 管理端首页面板路由（analytics::panel）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.panel.PanelController`
//! （`@RequestMapping("/adminapi/panel/panel")`，7 个端点，全部需登录）。
//! `searchMenu`/`shortcutMenu` 在 Java 也是登录即可（无方法级权限）；
//! 权限矩阵在 Rust 侧尚未实现。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde_json::Value;
use tigshop_core::models::analytics::panel::{DaysQuery, SearchMenuQuery, ShortcutMenuSaveDTO};
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};

use crate::AdminState;

/// 本域 7 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    ("GET", "/panel/panel/index", "PanelController.index"),
    (
        "GET",
        "/panel/panel/vendorIndex",
        "PanelController.vendorIndex",
    ),
    (
        "GET",
        "/panel/panel/statisticalData",
        "PanelController.statisticalData",
    ),
    (
        "GET",
        "/panel/panel/vendorStatisticalData",
        "PanelController.vendorStatisticalData",
    ),
    (
        "GET",
        "/panel/panel/searchMenu",
        "PanelController.searchMenu",
    ),
    (
        "GET",
        "/panel/panel/shortcutMenu",
        "PanelController.shortcutMenu",
    ),
    (
        "POST",
        "/panel/panel/saveShortcutMenu",
        "PanelController.saveShortcutMenu",
    ),
];

/// 首页面板域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/panel/panel/index", get(index))
        .route("/panel/panel/vendorIndex", get(vendor_index))
        .route("/panel/panel/statisticalData", get(statistical_data))
        .route(
            "/panel/panel/vendorStatisticalData",
            get(vendor_statistical_data),
        )
        .route("/panel/panel/searchMenu", get(search_menu))
        .route("/panel/panel/shortcutMenu", get(shortcut_menu))
        .route("/panel/panel/saveShortcutMenu", post(save_shortcut_menu))
}

/// 本域已实现路由（完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// 快捷菜单的身份维度（Java `SecurityUtils.getCurrentAdminId()` + `getShopId()`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShopQuery {
    shop_id: Option<i32>,
}

async fn index(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<Value> {
    ok(state.analytics.panel.index(auth.scoped_shop_id()).await?)
}

async fn vendor_index(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Value> {
    ok(state
        .analytics
        .panel
        .vendor_index(tenant.vendor_scope())
        .await?)
}

async fn statistical_data(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<DaysQuery>,
) -> ApiResult<Value> {
    ok(state
        .analytics
        .panel
        .statistical_data(q.resolved_days(), auth.scoped_shop_id())
        .await?)
}

async fn vendor_statistical_data(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DaysQuery>,
) -> ApiResult<Value> {
    ok(state
        .analytics
        .panel
        .vendor_statistical_data(q.resolved_days(), tenant.vendor_scope())
        .await?)
}

async fn search_menu(
    State(state): State<AdminState>,
    Query(q): Query<SearchMenuQuery>,
) -> ApiResult<Value> {
    ok(state
        .analytics
        .panel
        .search_menu(q.keyword.as_deref())
        .await?)
}

async fn shortcut_menu(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
) -> ApiResult<tigshop_core::models::analytics::panel::ShortcutMenuVO> {
    let shop_id = auth.resolve_shop_scope(q.shop_id)?.unwrap_or(0);
    ok(state
        .analytics
        .panel
        .shortcut_menu(auth.id, shop_id)
        .await?)
}

async fn save_shortcut_menu(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<ShortcutMenuSaveDTO>,
) -> ApiResult<bool> {
    let shop_id = auth.resolve_shop_scope(q.shop_id)?.unwrap_or(0);
    ok(state
        .analytics
        .panel
        .save_shortcut_menu(dto.list.as_deref(), auth.id, shop_id)
        .await?)
}

#[cfg(test)]
mod tests {
    #[test]
    fn vendor_scope_comes_from_tenant_context() {
        let vendor = TenantContext::new(Some("vendor".into()), None, Some(3));
        assert_eq!(vendor.vendor_scope(), Some(3));
        assert!(!vendor.is_platform());
        let platform = TenantContext::new(Some("admin".into()), None, None);
        assert_eq!(platform.vendor_scope(), None);
        assert!(platform.is_platform());
    }

    #[test]
    fn shop_account_cannot_use_other_shop_scope() {
        use tigshop_core::Error;
        let auth = AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(5));
        assert_eq!(auth.resolve_shop_scope(Some(5)).unwrap(), Some(5));
        assert!(matches!(
            auth.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
        // 未传 shopId 时强制本店
        assert_eq!(auth.resolve_shop_scope(None).unwrap(), Some(5));
        assert_eq!(auth.require_shop_scope(None).unwrap(), 5);
    }

    #[test]
    fn platform_account_may_filter_any_shop() {
        let auth = AuthUser::new(1, "admin".into(), None, Some("admin".into()), Some(0));
        assert_eq!(auth.resolve_shop_scope(Some(9)).unwrap(), Some(9));
        assert_eq!(auth.resolve_shop_scope(None).unwrap(), None);
        assert_eq!(auth.scoped_shop_id(), None);
    }

    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/panel/panel/index"),
            ("GET", "/adminapi/panel/panel/vendorIndex"),
            ("GET", "/adminapi/panel/panel/statisticalData"),
            ("GET", "/adminapi/panel/panel/vendorStatisticalData"),
            ("GET", "/adminapi/panel/panel/searchMenu"),
            ("GET", "/adminapi/panel/panel/shortcutMenu"),
            ("POST", "/adminapi/panel/panel/saveShortcutMenu"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
    }
}
