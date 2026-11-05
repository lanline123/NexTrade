//! 管理端店铺订单配置路由（trade::shop_order_config）。
//!
//! 对应 Java `ShopOrderConfigController`（`/adminapi/order/config`）：
//! `GET /adminapi/order/config/detail`、`POST /adminapi/order/config/save`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::trade::shop_order_config::{OrderConfigDTO, OrderConfigDetailQuery};
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域 2 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/order/config/detail",
        "ShopOrderConfigController.detail",
    ),
    (
        "POST",
        "/order/config/save",
        "ShopOrderConfigController.save",
    ),
];

/// 店铺订单配置路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/order/config/detail", get(detail))
        .route("/order/config/save", post(save))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/order/config/detail`：配置详情。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<OrderConfigDetailQuery>,
) -> ApiResult<Option<serde_json::Value>> {
    // 多租户：店铺账号只能读本店配置；平台账号可用可选 shopId 过滤。
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    ok(state
        .trade
        .shop_order_config
        .detail(scope, q.code.as_deref())
        .await?)
}

/// `POST /adminapi/order/config/save`：保存配置。
async fn save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<OrderConfigDTO>,
) -> ApiResult<()> {
    // 写操作必须落到具体店铺：店铺账号强制自身店铺，平台账号必须显式 shopId。
    let scope = auth.require_shop_scope(dto.shop_id)?;
    dto.shop_id = Some(scope);
    state.trade.shop_order_config.save(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// 店铺账号的读/写范围被强制收敛到自身店铺；平台必须显式指定店铺写入。
    #[test]
    fn tenant_scope_is_enforced() {
        let auth = shop_account(9);
        assert_eq!(auth.resolve_shop_scope(None).unwrap(), Some(9));
        assert!(auth.resolve_shop_scope(Some(8)).is_err());
        assert_eq!(auth.require_shop_scope(None).unwrap(), 9);
        assert!(auth.require_shop_scope(Some(8)).is_err());
        let admin = platform();
        assert_eq!(admin.resolve_shop_scope(None).unwrap(), None);
        assert!(admin.require_shop_scope(None).is_err());
        assert_eq!(admin.require_shop_scope(Some(3)).unwrap(), 3);
    }

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/order/config/detail");
        assert_eq!(docs[1].method, "POST");
        assert_eq!(docs[1].path, "/adminapi/order/config/save");
        assert_eq!(ROUTE_TABLE[0].1, "/order/config/detail");
        assert_eq!(ROUTE_TABLE[1].1, "/order/config/save");
    }

    #[test]
    fn dto_parsing_and_route_table() {
        let dto: OrderConfigDTO = serde_json::from_str(r#"{"shopId":1,"code":"order"}"#).unwrap();
        assert_eq!(dto.shop_id, Some(1));
        assert_eq!(ROUTE_TABLE.len(), 2);
    }
}
