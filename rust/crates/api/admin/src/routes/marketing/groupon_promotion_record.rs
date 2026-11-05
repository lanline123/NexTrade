//! 管理端拼团活动记录路由（marketing::groupon_promotion_record）。
//! Java `GrouponPromotionRecordController`：`/adminapi/promotion/groupon/record/*`（5 端点）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::marketing::groupon_promotion_record::{
    GroupMemberQuery, GrouponRecordOpenJoinMemberVO, GrouponRecordOpenJonPageVO,
    GrouponRecordOrderPageVO, ManualGroupQuery, OpenJoinListQuery, OrderListQuery,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/promotion/groupon/record/openJoinList",
        "GrouponPromotionRecordController.openJoinList",
    ),
    (
        "GET",
        "/promotion/groupon/record/orderList",
        "GrouponPromotionRecordController.orderList",
    ),
    (
        "GET",
        "/promotion/groupon/record/groupMemberList",
        "GrouponPromotionRecordController.groupMemberList",
    ),
    (
        "POST",
        "/promotion/groupon/record/manualGroup",
        "GrouponPromotionRecordController.manualGroup",
    ),
    (
        "POST",
        "/promotion/groupon/record/batchGroup",
        "GrouponPromotionRecordController.batchManualGroup",
    ),
];

/// 拼团活动记录域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/promotion/groupon/record/openJoinList",
            get(open_join_list),
        )
        .route("/promotion/groupon/record/orderList", get(order_list))
        .route(
            "/promotion/groupon/record/groupMemberList",
            get(group_member_list),
        )
        .route("/promotion/groupon/record/manualGroup", post(manual_group))
        .route("/promotion/groupon/record/batchGroup", post(batch_group))
}

/// 覆盖率统计用路由清单。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

async fn open_join_list(
    State(state): State<AdminState>,
    Query(q): Query<OpenJoinListQuery>,
) -> ApiResult<PageResult<GrouponRecordOpenJonPageVO>> {
    ok(state
        .marketing
        .groupon_promotion_record
        .open_join_list(&q)
        .await?)
}

async fn order_list(
    State(state): State<AdminState>,
    Query(q): Query<OrderListQuery>,
) -> ApiResult<PageResult<GrouponRecordOrderPageVO>> {
    ok(state
        .marketing
        .groupon_promotion_record
        .order_list(&q)
        .await?)
}

async fn group_member_list(
    State(state): State<AdminState>,
    Query(q): Query<GroupMemberQuery>,
) -> ApiResult<Vec<GrouponRecordOpenJoinMemberVO>> {
    ok(state
        .marketing
        .groupon_promotion_record
        .group_member_list(&q)
        .await?)
}

async fn manual_group(
    State(state): State<AdminState>,
    Query(q): Query<ManualGroupQuery>,
) -> ApiResult<()> {
    state
        .marketing
        .groupon_promotion_record
        .manual_group(&q)
        .await?;
    ok(())
}

async fn batch_group(State(state): State<AdminState>, Json(ids): Json<Vec<i64>>) -> ApiResult<()> {
    state
        .marketing
        .groupon_promotion_record
        .batch_group(&ids)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        for (m, p) in [
            ("GET", "/adminapi/promotion/groupon/record/openJoinList"),
            ("GET", "/adminapi/promotion/groupon/record/orderList"),
            ("GET", "/adminapi/promotion/groupon/record/groupMemberList"),
            ("POST", "/adminapi/promotion/groupon/record/manualGroup"),
            ("POST", "/adminapi/promotion/groupon/record/batchGroup"),
        ] {
            assert!(docs.iter().any(|d| d.method == m && d.path == p), "{m} {p}");
        }
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 5);
    }
}
