//! 管理端微信直播订单同步路由（content::wechat_live_order_sync）。
//!
//! 对应 Java `WechatLiveOrderSyncController`（`/adminapi/content/wechatLiveOrderSync`）：
//! `GET logs`、`POST retry/{logId}`、`POST reconcile`。三个接口均返回明确「未迁移」业务错误。

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::content::wechat_live_order_sync::{
    ReconcileParam, SyncLogQuery, SyncLogVO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "GET",
        "/content/wechatLiveOrderSync/logs",
        "WechatLiveOrderSyncController.logs",
    ),
    (
        "POST",
        "/content/wechatLiveOrderSync/retry/{logId}",
        "WechatLiveOrderSyncController.retry",
    ),
    (
        "POST",
        "/content/wechatLiveOrderSync/reconcile",
        "WechatLiveOrderSyncController.reconcile",
    ),
];

/// 微信直播订单同步路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/content/wechatLiveOrderSync/logs", get(logs))
        .route("/content/wechatLiveOrderSync/retry/{logId}", post(retry))
        .route("/content/wechatLiveOrderSync/reconcile", post(reconcile))
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn logs(
    State(state): State<AdminState>,
    Query(q): Query<SyncLogQuery>,
) -> ApiResult<PageResult<SyncLogVO>> {
    ok(state.content.wechat_live_order_sync.logs(&q).await?)
}

async fn retry(State(state): State<AdminState>, Path(log_id): Path<i64>) -> ApiResult<()> {
    state.content.wechat_live_order_sync.retry(log_id).await?;
    ok(())
}

async fn reconcile(
    State(state): State<AdminState>,
    Json(param): Json<ReconcileParam>,
) -> ApiResult<()> {
    state
        .content
        .wechat_live_order_sync
        .reconcile(&param)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        assert_eq!(docs[0].path, "/adminapi/content/wechatLiveOrderSync/logs");
        assert_eq!(
            docs[1].path,
            "/adminapi/content/wechatLiveOrderSync/retry/{logId}"
        );
        assert_eq!(
            docs[2].path,
            "/adminapi/content/wechatLiveOrderSync/reconcile"
        );
        assert_eq!(docs[1].method, "POST");
    }

    #[test]
    fn route_table_prefixed() {
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/content/wechatLiveOrderSync/"));
        }
    }
}
