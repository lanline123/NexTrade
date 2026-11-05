//! 管理端后台消息路由（system::admin_msg）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.msg.AdminMsgController`
//! （`@RequestMapping("/adminapi/msg/adminMsg")`，7 个端点，全部需登录）。
//!
//! **身份/可见范围**：使用认证中间件写入的 `TenantContext`（JWT 的
//! `admin_type` / `shop_id` / `vendor_id`）：供应商取 vendor scope，店铺账号
//! 强制本店，平台账号可显式 `shopId` 过滤、缺省只看广播。
//!
//! **msgCount**：已实现 SSE 长连接，周期性推送未读数与业务指标。

use std::time::Duration;

use async_stream::stream;
use axum::{
    extract::{Query, State},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Extension, Json, Router,
};
use futures::Stream;
use serde::Deserialize;
use tigshop_core::models::system::admin_msg::{
    AdminMsgBroadcastVO, AdminMsgListQuery, AdminMsgTypeListVO, AdminMsgVO, HomeMsgSummaryVO,
    MsgScope,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};

use crate::AdminState;

/// 本域 7 条路由（挂载路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/msg/adminMsg/msgCount",
        "AdminMsgController.getMsgCount",
    ),
    (
        "GET",
        "/msg/adminMsg/msgTypeArr",
        "AdminMsgController.msgTypeArr",
    ),
    ("GET", "/msg/adminMsg/list", "AdminMsgController.list"),
    (
        "GET",
        "/msg/adminMsg/broadcastList",
        "AdminMsgController.broadcastList",
    ),
    (
        "GET",
        "/msg/adminMsg/homeSummary",
        "AdminMsgController.homeSummary",
    ),
    (
        "POST",
        "/msg/adminMsg/setReaded",
        "AdminMsgController.setReaded",
    ),
    (
        "POST",
        "/msg/adminMsg/setAllReaded",
        "AdminMsgController.setAllReaded",
    ),
];

/// 后台消息域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/msg/adminMsg/msgCount", get(msg_count))
        .route("/msg/adminMsg/msgTypeArr", get(msg_type_arr))
        .route("/msg/adminMsg/list", get(list))
        .route("/msg/adminMsg/broadcastList", get(broadcast_list))
        .route("/msg/adminMsg/homeSummary", get(home_summary))
        .route("/msg/adminMsg/setReaded", post(set_readed))
        .route("/msg/adminMsg/setAllReaded", post(set_all_readed))
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

/// 已读入参（Java `AdminMsgUpdateDTO.msgId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ReadedBody {
    msg_id: Option<i32>,
}

/// 解析可见范围（Java `getAdminType` + `getShopId`/`getVendorId`）。
///
/// 供应商维度改取认证中间件写入的 [`TenantContext::vendor_scope`]（JWT
/// `vendor_id` 声明），不再信任查询参数 `vendorId`；店铺/平台维度同理。
fn scope_of(tenant: &TenantContext, q: &AdminMsgListQuery) -> MsgScope {
    scope_from_tenant(tenant, q.shop_id)
}

/// 从可信租户上下文构造消息作用域。
///
/// - 供应商：`TenantContext.vendor_scope()`；
/// - 店铺账号：强制本店；
/// - 平台账号：可显式传 `requested_shop` 过滤，缺省 0（仅广播）。
fn scope_from_tenant(tenant: &TenantContext, requested_shop: Option<i32>) -> MsgScope {
    if tenant.is_vendor_account() {
        return MsgScope::Vendor {
            vendor_id: tenant.vendor_scope().unwrap_or(0),
        };
    }
    let platform = tenant.is_platform();
    let shop_id = if platform {
        requested_shop.unwrap_or(0)
    } else {
        tenant.shop_scope().unwrap_or(0)
    };
    MsgScope::Shop { shop_id, platform }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct MsgCountQuery {
    #[serde(default, deserialize_with = "empty_string_as_none")]
    start_time: Option<i64>,
}

/// 原版 `MsgCount.vue` 首次连接时 `startTime=` 为空字符串；
/// 标准 `Option<i64>` 会报 `cannot parse integer from empty string`，这里把空串当 None。
fn empty_string_as_none<'de, D>(deserializer: D) -> std::result::Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<String>::deserialize(deserializer)?;
    match value.as_deref().map(str::trim) {
        None | Some("") => Ok(None),
        Some(raw) => raw
            .parse::<i64>()
            .map(Some)
            .map_err(serde::de::Error::custom),
    }
}

async fn msg_count(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<MsgCountQuery>,
) -> Sse<impl Stream<Item = std::result::Result<Event, std::convert::Infallible>>> {
    let admin_id = auth.id;
    let scope = scope_from_tenant(&tenant, None);
    let raw_start = q.start_time.unwrap_or(0);
    let start_time = if raw_start > 10_000_000_000 {
        raw_start / 1000
    } else {
        raw_start
    };

    let stream = stream! {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            match state.system.admin_msg.get_msg_count(admin_id, scope, start_time).await {
                Ok(vo) => {
                    let api_resp = tigshop_core::error::ApiResponse::success(vo);
                    if let Ok(json_str) = serde_json::to_string(&api_resp) {
                        yield Ok(Event::default().event("msg").data(json_str));
                    }
                }
                Err(err) => {
                    tracing::warn!("Failed to fetch admin msg count for SSE: {err}");
                }
            }
        }
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    )
}

async fn msg_type_arr(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<AdminMsgListQuery>,
) -> ApiResult<Vec<AdminMsgTypeListVO>> {
    ok(state
        .system
        .admin_msg
        .msg_type_arr(scope_of(&tenant, &q))
        .await?)
}

async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<AdminMsgListQuery>,
) -> ApiResult<PageResult<AdminMsgVO>> {
    let scope = scope_of(&tenant, &q);
    ok(state.system.admin_msg.list(scope, &q).await?)
}

async fn broadcast_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<AdminMsgListQuery>,
) -> ApiResult<PageResult<AdminMsgBroadcastVO>> {
    let scope = scope_of(&tenant, &q);
    ok(state.system.admin_msg.broadcast_list(scope, &q).await?)
}

async fn home_summary(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<AdminMsgListQuery>,
) -> ApiResult<HomeMsgSummaryVO> {
    let scope = scope_of(&tenant, &q);
    ok(state.system.admin_msg.home_summary(scope).await?)
}

async fn set_readed(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(body): Json<ReadedBody>,
) -> ApiResult<bool> {
    let scope = scope_from_tenant(&tenant, None);
    ok(state
        .system
        .admin_msg
        .set_readed(body.msg_id, scope)
        .await?)
}

async fn set_all_readed(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<AdminMsgListQuery>,
) -> ApiResult<u64> {
    let scope = scope_of(&tenant, &q);
    ok(state.system.admin_msg.set_all_readed(scope).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/msg/adminMsg/msgCount"),
            ("GET", "/adminapi/msg/adminMsg/msgTypeArr"),
            ("GET", "/adminapi/msg/adminMsg/list"),
            ("GET", "/adminapi/msg/adminMsg/broadcastList"),
            ("GET", "/adminapi/msg/adminMsg/homeSummary"),
            ("POST", "/adminapi/msg/adminMsg/setReaded"),
            ("POST", "/adminapi/msg/adminMsg/setAllReaded"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
    }

    #[test]
    fn set_readed_scope_from_tenant_has_no_query_fallback() {
        let shop = TenantContext::new(Some("shop".into()), Some(5), None);
        assert_eq!(
            scope_from_tenant(&shop, Some(9)),
            MsgScope::Shop {
                shop_id: 5,
                platform: false
            }
        );
        let vendor = TenantContext::new(Some("vendor".into()), None, Some(3));
        assert_eq!(
            scope_from_tenant(&vendor, None),
            MsgScope::Vendor { vendor_id: 3 }
        );
        let platform = TenantContext::new(Some("admin".into()), None, None);
        assert_eq!(
            scope_from_tenant(&platform, Some(7)),
            MsgScope::Shop {
                shop_id: 7,
                platform: true
            }
        );
    }

    #[test]
    fn vendor_scope_comes_from_trusted_tenant_context() {
        let vendor = TenantContext::new(Some("vendor".into()), None, Some(9));
        let q = AdminMsgListQuery {
            vendor_id: Some(999),
            ..Default::default()
        };
        // 查询参数 vendorId 被忽略，可信 vendor_scope 生效
        assert_eq!(scope_of(&vendor, &q), MsgScope::Vendor { vendor_id: 9 });
    }

    #[test]
    fn shop_and_platform_scopes_use_trusted_tenant() {
        let admin = TenantContext::new(Some("admin".into()), None, None);
        let q = AdminMsgListQuery {
            shop_id: Some(9),
            ..Default::default()
        };
        match scope_of(&admin, &q) {
            MsgScope::Shop { shop_id, platform } => {
                assert_eq!(shop_id, 9);
                assert!(platform);
            }
            _ => panic!("平台账号应为 Shop 作用域"),
        }
        let shop = TenantContext::new(Some("shop".into()), Some(5), None);
        let q = AdminMsgListQuery {
            shop_id: Some(3),
            ..Default::default()
        };
        match scope_of(&shop, &q) {
            MsgScope::Shop { shop_id, platform } => {
                assert_eq!(shop_id, 5);
                assert!(!platform);
            }
            _ => panic!("店铺账号应为 Shop 作用域"),
        }
    }
}
