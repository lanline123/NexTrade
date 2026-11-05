//! 管理端 Apple Pay 设置路由（payment::apple_pay_config，2 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.ApplePayConfigController`
//! （`@RequestMapping("/adminapi/setting/config")`）：
//! `GET /applePaySettings`、`POST /saveApplePay`。

use axum::{
    extract::Extension,
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde_json::Value;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 2 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/setting/config/applePaySettings",
        "ApplePayConfigController.getApplePaySettings",
    ),
    (
        "POST",
        "/setting/config/saveApplePay",
        "ApplePayConfigController.saveApplePaySettings",
    ),
];

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_account_is_not_platform() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert!(admin.is_platform());
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(!shop.is_platform());
        assert_eq!(shop.scoped_shop_id(), Some(7));
    }
}

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/config/applePaySettings", get(get_settings))
        .route("/setting/config/saveApplePay", post(save_settings))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/setting/config/applePaySettings`：读取设置。
async fn get_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(state.payment.apple_pay_config.get_settings().await?)
}

/// `POST /adminapi/setting/config/saveApplePay`：保存设置（部分更新 + 掩码保护）。
async fn save_settings(
    State(state): State<AdminState>,
    Json(payload): Json<Value>,
) -> ApiResult<()> {
    state
        .payment
        .apple_pay_config
        .save_settings(&payload)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/setting/config/applePaySettings"),
            ("POST", "/adminapi/setting/config/saveApplePay"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn route_table_slice_is_exact() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        assert!(ROUTE_TABLE
            .iter()
            .all(|(_, p, _)| p.starts_with("/setting/config/")));
    }
}
