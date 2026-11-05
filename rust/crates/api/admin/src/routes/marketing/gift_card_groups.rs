//! 管理端礼品卡分组路由（marketing::gift_card_groups）。
//!
//! 原 Java：`com.tigshop.adminapi.controller.promotion.GiftCardGroupsController`
//! （`@RequestMapping("/adminapi/promotion/giftCardGroups")`）。
//!
//! | 本模块路由 | 原 Java 方法 | 契约 auth |
//! |-----------|--------------|-----------|
//! | `GET /promotion/giftCardGroups/list` | `list` | jwt |
//! | `POST /promotion/giftCardGroups/updateStatus` | `updateStatus` | jwt+perm |
//! | `POST /promotion/giftCardGroups/create` | `createGiftCardGroups` | jwt+perm |
//! | `POST /promotion/giftCardGroups/update` | `updateGiftCardGroups` | jwt+perm |
//! | `GET /promotion/giftCardGroups/detail` | `detail` | jwt |
//! | `GET /promotion/giftCardGroups/getGiftCardGroups` | `getGiftCardGroupsByCardType` | jwt |
//! | `POST /promotion/giftCardGroups/delete` | `deleteGiftCardGroups` | jwt+perm |
//! | `POST /promotion/giftCardGroups/giftCardGroupProductsUpdate` | `giftCardGroupProductsUpdate` | jwt+perm |
//!
//! > **多租户**：`list/create/delete` 的店铺范围由 `marketing::tenant_layer` 注入的
//! > `TenantScope` 在 Service 层读取（不再解析请求头）。
//! > 权限矩阵未迁移（只校验登录态）。

use axum::{
    extract::Query,
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::gift_card_groups::{
    GiftCardGroupIdParam, GiftCardGroupsCreateParam, GiftCardGroupsListQuery,
    GiftCardGroupsUpdateParam, GiftCardGroupsVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/promotion/giftCardGroups/list",
        "GiftCardGroupsController.list",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/updateStatus",
        "GiftCardGroupsController.updateStatus",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/create",
        "GiftCardGroupsController.createGiftCardGroups",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/update",
        "GiftCardGroupsController.updateGiftCardGroups",
    ),
    (
        "GET",
        "/promotion/giftCardGroups/detail",
        "GiftCardGroupsController.detail",
    ),
    (
        "GET",
        "/promotion/giftCardGroups/getGiftCardGroups",
        "GiftCardGroupsController.getGiftCardGroupsByCardType",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/delete",
        "GiftCardGroupsController.deleteGiftCardGroups",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/giftCardGroupProductsUpdate",
        "GiftCardGroupsController.giftCardGroupProductsUpdate",
    ),
];

/// 卡组管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/giftCardGroups/list", get(list))
        .route(
            "/promotion/giftCardGroups/updateStatus",
            post(update_status),
        )
        .route("/promotion/giftCardGroups/create", post(create))
        .route("/promotion/giftCardGroups/update", post(update))
        .route("/promotion/giftCardGroups/detail", get(detail))
        .route(
            "/promotion/giftCardGroups/getGiftCardGroups",
            get(get_gift_card_groups),
        )
        .route("/promotion/giftCardGroups/delete", post(delete))
        .route(
            "/promotion/giftCardGroups/giftCardGroupProductsUpdate",
            post(products_update),
        )
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

/// `cardGroupsId` 查询参数（detail）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CardGroupsIdQuery {
    card_groups_id: i32,
}

/// `getGiftCardGroups` 查询参数。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct GroupsByTypeQuery {
    card_type: Option<i32>,
    gift_card_groups_id: Option<i32>,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<GiftCardGroupsListQuery>,
) -> ApiResult<PageResult<GiftCardGroupsVO>> {
    ok(state.marketing.gift_card_groups.list(&q).await?)
}

async fn update_status(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardGroupsUpdateParam>,
) -> ApiResult<()> {
    state
        .marketing
        .gift_card_groups
        .update_status(&param)
        .await?;
    ok(())
}

async fn create(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardGroupsCreateParam>,
) -> ApiResult<()> {
    state.marketing.gift_card_groups.create(&param).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardGroupsUpdateParam>,
) -> ApiResult<()> {
    state.marketing.gift_card_groups.update(&param).await?;
    ok(())
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<CardGroupsIdQuery>,
) -> ApiResult<GiftCardGroupsVO> {
    ok(state
        .marketing
        .gift_card_groups
        .detail(q.card_groups_id)
        .await?)
}

async fn get_gift_card_groups(
    State(state): State<AdminState>,
    Query(q): Query<GroupsByTypeQuery>,
) -> ApiResult<Vec<GiftCardGroupsVO>> {
    ok(state
        .marketing
        .gift_card_groups
        .get_gift_card_groups(q.card_type, q.gift_card_groups_id)
        .await?)
}

async fn delete(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardGroupIdParam>,
) -> ApiResult<()> {
    state.marketing.gift_card_groups.delete(&param).await?;
    ok(())
}

async fn products_update(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardGroupsUpdateParam>,
) -> ApiResult<()> {
    state
        .marketing
        .gift_card_groups
        .products_update(&param)
        .await?;
    ok(())
}

/// 解析 Java `HeaderUtils.getShopId()` 的可用分支（缺失 ⇒ `0` 平台）。
#[must_use]
#[cfg(test)]
fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

#[cfg(test)]
fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        let expected = [
            ("GET", "/adminapi/promotion/giftCardGroups/list"),
            ("POST", "/adminapi/promotion/giftCardGroups/updateStatus"),
            ("POST", "/adminapi/promotion/giftCardGroups/create"),
            ("POST", "/adminapi/promotion/giftCardGroups/update"),
            ("GET", "/adminapi/promotion/giftCardGroups/detail"),
            (
                "GET",
                "/adminapi/promotion/giftCardGroups/getGiftCardGroups",
            ),
            ("POST", "/adminapi/promotion/giftCardGroups/delete"),
            (
                "POST",
                "/adminapi/promotion/giftCardGroups/giftCardGroupProductsUpdate",
            ),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn route_table_paths_stay_relative() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/adminapi"), "{path}");
            assert!(path.starts_with("/promotion/giftCardGroups/"), "{path}");
        }
    }

    #[test]
    fn shop_id_header_branches() {
        use axum::http::{HeaderMap, HeaderValue};
        let mut h = HeaderMap::new();
        assert_eq!(shop_id_from_headers(&h), 0);
        h.insert("x-admin-type", HeaderValue::from_static("shop"));
        h.insert("x-shop-id", HeaderValue::from_static("12"));
        assert_eq!(shop_id_from_headers(&h), 12);
        h.insert("x-admin-type", HeaderValue::from_static("admin"));
        assert_eq!(shop_id_from_headers(&h), 0);
    }
}
