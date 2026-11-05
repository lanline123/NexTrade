//! 管理端会员域路由（等级/标签/积分流水）。
//! 对应原 Java `controller.user.UserRankController` /
//! `MemberTagController` / `MemberTagGroupController` /
//! `UserPointsLogController`。
//!
//! TODO(域实现者)：对照 Java 控制器补全等级增删改、标签组管理、
//! 积分手动调整等接口。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::{UserPointsLogQuery, UserRankVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 会员域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/userRank/list", get(rank_list))
        .route("/user/memberTagGroup/list", get(tag_group_list))
        .route("/user/userPointsLog/list", get(points_log_list))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/user/userRank/list",
            "UserRankController.list",
        ),
        (
            "GET",
            "/adminapi/user/memberTagGroup/list",
            "MemberTagGroupController.list",
        ),
        (
            "GET",
            "/adminapi/user/userPointsLog/list",
            "UserPointsLogController.list",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/user/userRank/list`：会员等级列表。
async fn rank_list(State(state): State<AdminState>) -> ApiResult<Vec<UserRankVO>> {
    ok(state.member.member_lists.ranks().await?)
}

/// `GET /adminapi/user/memberTagGroup/list`：标签组列表。
async fn tag_group_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<Vec<serde_json::Value>> {
    let groups = state
        .member
        .member_lists
        .tag_groups(auth.scoped_shop_id().unwrap_or(0))
        .await?;
    let list: Vec<serde_json::Value> = groups
        .iter()
        .map(|g| {
            // 库列：主键为 `id`（非 group_id），排序字段为 `is_top`（非 sort）。
            serde_json::json!({
                "groupId": g.id,
                "groupName": g.group_name,
                "shopId": g.shop_id,
                "isTop": g.is_top,
            })
        })
        .collect();
    ok(list)
}

/// `GET /adminapi/user/userPointsLog/list`：积分流水分页。
async fn points_log_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<UserPointsLogQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    let page = state
        .member
        .member_lists
        .points_logs(&q, auth.scoped_shop_id())
        .await?;
    let list: Vec<serde_json::Value> = page
        .list
        .iter()
        .map(|l| {
            // 库列：时间字段为 `change_time`（非 add_time），无 balance 列；
            // 补充 change_desc / change_type 以还原原接口语义。
            serde_json::json!({
                "logId": l.log_id,
                "userId": l.user_id,
                "points": l.points,
                "changeTime": l.change_time,
                "changeDesc": l.change_desc,
                "changeType": l.change_type,
                "relationType": l.relation_type,
                "relationId": l.relation_id,
            })
        })
        .collect();
    let pq = tigshop_core::types::PageQuery {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(20),
    };
    ok(PageResult::new(page.total, list, &pq))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shop_account_scope_is_trusted() {
        use tigshop_core::Error;
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(admin.scoped_shop_id(), None);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop.scoped_shop_id(), Some(7));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
    }
}
