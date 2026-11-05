//! 店铺资金 —— 管理端路由（merchant::shop_funds）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.shop.ShopFundsController`
//! （`@RequestMapping("/adminapi/merchant/shopAccount")`，8 个端点；
//! 路径中段是 **`shopAccount`**，不是 `shop_funds`）。
//!
//! | method | path（本模块，挂载于 `/adminapi`） | 原 Java |
//! |--------|------------------------------------|---------|
//! | `GET`  | `/merchant/shopAccount/list` | `list` |
//! | `GET`  | `/merchant/shopAccount/detail?id=` | `detail` |
//! | `POST` | `/merchant/shopAccount/create` | `create` |
//! | `POST` | `/merchant/shopAccount/update` | `update` |
//! | `POST` | `/merchant/shopAccount/del` | `del` |
//! | `POST` | `/merchant/shopAccount/updateField` | `updateField` |
//! | `POST` | `/merchant/shopAccount/batch` | `batch` |
//! | `GET`  | `/merchant/shopAccount/applyShopAgreement` | `applyShopAgreement` |
//!
//! # 返回结构
//! - `list`：Java `Page<ShopFundsVO>` → Rust `PageResult<ShopFundsVO>`；
//! - `detail`：Java 可能返回 `null` → Rust `Option<ShopFundsVO>`（`data:null`）；
//! - `create`：Java 遗留不可用 → Rust 501 业务错误（见服务层模块头差异 1）；
//! - `applyShopAgreement`：返回协议原文 `String`。
//!
//! # 权限
//! Java 该控制器所有方法均仅需登录（无 `@PreAuthorize`）；Rust 由全局
//! `require_auth` 保护（只校验登录态，Rust 权限矩阵未实现）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::shop_funds::{
    BatchDTO, OperateDTO, ShopFundsCreateDTO, ShopFundsListQuery, ShopFundsUpdateDTO, ShopFundsVO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/merchant/shopAccount/list",
        "ShopFundsController.list",
    ),
    (
        "GET",
        "/merchant/shopAccount/detail",
        "ShopFundsController.detail",
    ),
    (
        "POST",
        "/merchant/shopAccount/create",
        "ShopFundsController.create",
    ),
    (
        "POST",
        "/merchant/shopAccount/update",
        "ShopFundsController.update",
    ),
    (
        "POST",
        "/merchant/shopAccount/del",
        "ShopFundsController.del",
    ),
    (
        "POST",
        "/merchant/shopAccount/updateField",
        "ShopFundsController.updateField",
    ),
    (
        "POST",
        "/merchant/shopAccount/batch",
        "ShopFundsController.batch",
    ),
    (
        "GET",
        "/merchant/shopAccount/applyShopAgreement",
        "ShopFundsController.applyShopAgreement",
    ),
];

/// 店铺资金路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/shopAccount/list", get(list))
        .route("/merchant/shopAccount/detail", get(detail))
        .route("/merchant/shopAccount/create", post(create))
        .route("/merchant/shopAccount/update", post(update))
        .route("/merchant/shopAccount/del", post(delete))
        .route("/merchant/shopAccount/updateField", post(update_field))
        .route("/merchant/shopAccount/batch", post(batch))
        .route(
            "/merchant/shopAccount/applyShopAgreement",
            get(apply_shop_agreement),
        )
        .layer(axum::middleware::from_fn(require_platform_mw))
}

/// 本域已实现路由（覆盖率统计）。
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
}

/// 平台级接口：店铺/供应商账号一律 403（顺序：认证中间件先注入 TenantContext）。
async fn require_platform_mw(
    Extension(tenant): Extension<TenantContext>,
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(next.run(req).await)
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ShopFundsListQuery>,
) -> ApiResult<PageResult<ShopFundsVO>> {
    ok(state.merchant.shop_funds.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<ShopFundsVO>> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.merchant.shop_funds.detail(id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<ShopFundsCreateDTO>,
) -> ApiResult<()> {
    state.merchant.shop_funds.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ShopFundsUpdateDTO>,
) -> ApiResult<()> {
    state.merchant.shop_funds.update(&dto).await?;
    ok(())
}

async fn delete(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.merchant.shop_funds.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.merchant.shop_funds.update_field(&dto).await?;
    ok(())
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.merchant.shop_funds.batch(&dto).await?;
    ok(())
}

async fn apply_shop_agreement(State(state): State<AdminState>) -> ApiResult<String> {
    ok(state.merchant.shop_funds.apply_shop_agreement().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/merchant/shopAccount/list",
                "/merchant/shopAccount/detail",
                "/merchant/shopAccount/create",
                "/merchant/shopAccount/update",
                "/merchant/shopAccount/del",
                "/merchant/shopAccount/updateField",
                "/merchant/shopAccount/batch",
                "/merchant/shopAccount/applyShopAgreement",
            ]
        );
        for p in &paths {
            // 契约中段是 `shopAccount`（camelCase），不是 `shop_funds`
            assert!(p.starts_with("/merchant/shopAccount/"), "{p}");
            assert!(!p.contains("shop_funds"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/merchant/shopAccount/"));
            assert!(d.java_ref.starts_with("ShopFundsController."));
        }
        let gets: Vec<&str> = docs
            .iter()
            .filter(|d| d.method == "GET")
            .map(|d| d.path.as_str())
            .collect();
        assert_eq!(
            gets,
            vec![
                "/adminapi/merchant/shopAccount/list",
                "/adminapi/merchant/shopAccount/detail",
                "/adminapi/merchant/shopAccount/applyShopAgreement",
            ]
        );
    }

    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/merchant/shopAccount/list",
            "/merchant/shopAccount/detail",
            "/merchant/shopAccount/create",
            "/merchant/shopAccount/update",
            "/merchant/shopAccount/del",
            "/merchant/shopAccount/updateField",
            "/merchant/shopAccount/batch",
            "/merchant/shopAccount/applyShopAgreement",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for p in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, q, _)| *q == p));
        }
    }

    #[test]
    fn query_and_body_parse_camel_case() {
        let q: ShopFundsListQuery =
            serde_json::from_str(r#"{"status":1,"shopType":2,"keyword":"旗舰","size":30}"#)
                .unwrap();
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.shop_type, Some(2));
        let d: ShopFundsUpdateDTO =
            serde_json::from_str(r#"{"shopId":5,"shopTitle":"新店名","shopMoney":"99.90"}"#)
                .unwrap();
        assert_eq!(d.shop_id, Some(5));
        assert_eq!(d.shop_title.as_deref(), Some("新店名"));
    }
}
