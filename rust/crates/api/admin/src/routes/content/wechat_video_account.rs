//! 管理端视频号账号路由（content::wechat_video_account）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.content.WechatVideoAccountController`
//! （`@RequestMapping("/adminapi/content/wechatVideoAccount")`，5 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET  /content/wechatVideoAccount/list`   | `list` |
//! | `GET  /content/wechatVideoAccount/detail` | `detail` |
//! | `POST /content/wechatVideoAccount/create` | `create` |
//! | `POST /content/wechatVideoAccount/update` | `update` |
//! | `POST /content/wechatVideoAccount/delete` | `delete` |
//!
//! 店铺范围：Java `getShopId()`；`admin` 无过滤，店铺/门店账号按 `x-shop-id`
//! 过滤（仅 `> 0` 生效）。合并注意：并入 `crates/api/admin/src/routes/content/mod.rs`
//! 的 `routes()` 与 `implemented_routes()`。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::wechat_video_account::{
    OperateDTO, WechatVideoAccountCreateDTO, WechatVideoAccountListQuery,
    WechatVideoAccountUpdateDTO, WechatVideoAccountVO,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/content/wechatVideoAccount/list",
        "WechatVideoAccountController.list",
    ),
    (
        "GET",
        "/content/wechatVideoAccount/detail",
        "WechatVideoAccountController.detail",
    ),
    (
        "POST",
        "/content/wechatVideoAccount/create",
        "WechatVideoAccountController.create",
    ),
    (
        "POST",
        "/content/wechatVideoAccount/update",
        "WechatVideoAccountController.update",
    ),
    (
        "POST",
        "/content/wechatVideoAccount/delete",
        "WechatVideoAccountController.delete",
    ),
];

/// 视频号账号路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/content/wechatVideoAccount/list", get(list))
        .route("/content/wechatVideoAccount/detail", get(detail))
        .route("/content/wechatVideoAccount/create", post(create))
        .route("/content/wechatVideoAccount/update", post(update))
        .route("/content/wechatVideoAccount/delete", post(delete))
}

/// 本域已实现路由（覆盖率统计用）。
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

/// `GET .../detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/content/wechatVideoAccount/list`：视频号账号列表。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<WechatVideoAccountListQuery>,
) -> ApiResult<PageResult<WechatVideoAccountVO>> {
    let shop = current_shop_id(&headers);
    ok(state.content.wechat_video_account.list(shop, &q).await?)
}

/// `GET /adminapi/content/wechatVideoAccount/detail?id=`：视频号账号详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<WechatVideoAccountVO> {
    ok(state.content.wechat_video_account.detail(q.id).await?)
}

/// `POST /adminapi/content/wechatVideoAccount/create`：新增视频号账号。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<WechatVideoAccountCreateDTO>,
) -> ApiResult<i32> {
    let shop = current_shop_id(&headers);
    ok(state
        .content
        .wechat_video_account
        .create(shop, &dto)
        .await?)
}

/// `POST /adminapi/content/wechatVideoAccount/update`：更新视频号账号。
async fn update(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<WechatVideoAccountUpdateDTO>,
) -> ApiResult<()> {
    let shop = current_shop_id(&headers);
    state
        .content
        .wechat_video_account
        .update(shop, &dto)
        .await?;
    ok(())
}

/// `POST /adminapi/content/wechatVideoAccount/delete`：删除视频号账号。
async fn delete(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.content.wechat_video_account.delete(&dto).await?;
    ok(())
}

/// 当前店铺 ID（多租户：**身份只信任认证中间件**，忽略可伪造的 `x-shop-id`）。
///
/// 平台账号 → `None`（列表不过滤）；店铺账号 → `Some(本店)`（列表只查本店）。
#[must_use]
pub fn current_shop_id(_headers: &HeaderMap) -> Option<i32> {
    TenantScope::current_list_filter()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            ("GET", "/adminapi/content/wechatVideoAccount/list"),
            ("GET", "/adminapi/content/wechatVideoAccount/detail"),
            ("POST", "/adminapi/content/wechatVideoAccount/create"),
            ("POST", "/adminapi/content/wechatVideoAccount/update"),
            ("POST", "/adminapi/content/wechatVideoAccount/delete"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                p.starts_with("/content/wechatVideoAccount/"),
                "路径前缀错误: {p}"
            );
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[tokio::test]
    async fn shop_scope_uses_trusted_identity() {
        use tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope;
        // 无 task-local = 平台语义 → None（不过滤）；伪造 shop 头无效
        assert_eq!(current_shop_id(&HeaderMap::new()), None);
        assert_eq!(
            current_shop_id(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            None
        );
        // 店铺身份 → Some(本店)
        let shop = TenantScope::for_shop(9);
        let seen = with_tenant_scope(shop, async {
            current_shop_id(&headers(&[("x-shop-id", "3")]))
        })
        .await;
        assert_eq!(seen, Some(9));
    }
}
