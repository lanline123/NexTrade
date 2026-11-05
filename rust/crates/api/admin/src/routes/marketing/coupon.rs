//! 管理端优惠券路由。
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.CouponController`
//! （`/adminapi/promotion/coupon`）。
//!
//! | 路由 | 原 Java |
//! |------|---------|
//! | `GET  /adminapi/promotion/coupon/list`        | `list` |
//! | `GET  /adminapi/promotion/coupon/listByIds`   | `listByIds` |
//! | `GET  /adminapi/promotion/coupon/detail`      | `detail` |
//! | `GET  /adminapi/promotion/coupon/validList`   | `validList` |
//! | `GET  /adminapi/promotion/coupon/issue/users` | `issue/users` |
//! | `POST /adminapi/promotion/coupon/issue/send`  | `issue/send`（手动发放） |

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::{CouponListQuery, CouponVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 优惠券域路由（挂载于 `/adminapi` 下）。
///
/// 原 Java `CouponController` 无 `statusCount` 端点，故本域不注册该路由。
pub fn routes(_state: &AdminState) -> Router<AdminState> {
    Router::new()
        .route("/promotion/coupon/list", get(coupon_list))
        .route("/promotion/coupon/listByIds", get(coupon_list_by_ids))
        .route("/promotion/coupon/detail", get(coupon_detail))
        .route("/promotion/coupon/validList", get(valid_list))
        .route("/promotion/coupon/issue/users", get(issue_users))
        .route("/promotion/coupon/issue/send", post(issue_send))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/promotion/coupon/list",
            "CouponController.list",
        ),
        (
            "GET",
            "/adminapi/promotion/coupon/listByIds",
            "CouponController.listByIds",
        ),
        (
            "GET",
            "/adminapi/promotion/coupon/detail",
            "CouponController.detail",
        ),
        (
            "GET",
            "/adminapi/promotion/coupon/validList",
            "CouponController.validList",
        ),
        (
            "GET",
            "/adminapi/promotion/coupon/issue/users",
            "CouponController.issueUsers",
        ),
        (
            "POST",
            "/adminapi/promotion/coupon/issue/send",
            "CouponController.issueSend",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/promotion/coupon/list`：优惠券分页。
async fn coupon_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<CouponListQuery>,
) -> ApiResult<PageResult<CouponVO>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.marketing.coupon.list(&q).await?)
}

#[derive(Debug, Deserialize)]
struct IdsQuery {
    ids: String,
}

/// `GET /adminapi/promotion/coupon/listByIds`：按 ID 批量查询。
async fn coupon_list_by_ids(
    State(state): State<AdminState>,
    Query(q): Query<IdsQuery>,
) -> ApiResult<Vec<CouponVO>> {
    let ids: Vec<i32> = q
        .ids
        .split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .collect();
    // 管理端列表复用 VO：逐个取详情（券数量有限，避免额外的批量 VO 映射）
    let mut list = Vec::with_capacity(ids.len());
    for id in ids {
        if let Ok(vo) = state.marketing.coupon.detail_vo(id).await {
            list.push(vo);
        }
    }
    ok(list)
}

#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/promotion/coupon/detail?id=`：优惠券详情。
async fn coupon_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<CouponVO> {
    let vo = state.marketing.coupon.detail_vo(q.id).await?;
    if let Some(shop_id) = auth.scoped_shop_id() {
        if vo.shop_id != shop_id && vo.shop_id != 0 {
            return Err(AppError(tigshop_core::Error::biz(
                403,
                "无权查看其他店铺的优惠券",
            )));
        }
    }
    ok(vo)
}

/// `GET /adminapi/promotion/coupon/validList`：有效（进行中）优惠券列表，供选择器使用。
async fn valid_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<CouponListQuery>,
) -> ApiResult<PageResult<CouponVO>> {
    q.status = Some(1); // 进行中
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.marketing.coupon.list(&q).await?)
}

/// `GET /adminapi/promotion/coupon/issue/users`：可发放会员搜索。
///
/// 简化实现：返回分页会员列表（发放对象选择器）。
async fn issue_users(
    State(state): State<AdminState>,
    Query(q): Query<MemberSearchQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    let page = state
        .member
        .member_lists
        .paginate_users(
            q.keyword.as_deref(),
            q.page.unwrap_or(1),
            q.page_size.unwrap_or(20),
        )
        .await?;
    let list: Vec<serde_json::Value> = page
        .list
        .iter()
        .map(|u| {
            serde_json::json!({
                "userId": u.user_id,
                "username": u.username,
                "nickname": u.nickname,
                "mobile": u.mobile,
                "rankId": u.rank_id,
            })
        })
        .collect();
    let query = tigshop_core::types::PageQuery {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(20),
    };
    ok(PageResult::new(page.total, list, &query))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MemberSearchQuery {
    keyword: Option<String>,
    page: Option<u64>,
    page_size: Option<u64>,
}

/// 手动发放请求（对应 `CouponManualIssueParam`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManualIssueDTO {
    coupon_id: i32,
    /// 发放对象用户ID列表
    user_ids: Vec<i32>,
}

/// `POST /adminapi/promotion/coupon/issue/send`：手动发放优惠券。
///
/// 对应 Java `UserCouponServiceImpl#manualIssue`。逐用户发放，
/// 返回成功/失败计数（单个失败不中断其余用户）。
async fn issue_send(
    State(state): State<AdminState>,
    Json(dto): Json<ManualIssueDTO>,
) -> ApiResult<serde_json::Value> {
    let mut success = 0u32;
    let mut fail = 0u32;
    for user_id in dto.user_ids.iter().copied().filter(|id| *id > 0) {
        match state
            .marketing
            .coupon
            .issue_to_user(dto.coupon_id, user_id)
            .await
        {
            Ok(_) => success += 1,
            Err(e) => {
                tracing::warn!(
                    "手动发放优惠券失败 coupon_id={} user_id={}: {e}",
                    dto.coupon_id,
                    user_id
                );
                fail += 1;
            }
        }
    }
    ok(serde_json::json!({
        "couponId": dto.coupon_id,
        "successCount": success,
        "failCount": fail,
    }))
}
