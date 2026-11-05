//! 管理端线下收款审核（v5.8.61 `/adminapi/order/offlinePaymentClaim`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::trade::offline_claim::{
    OfflinePaymentClaimAuditDTO, OfflinePaymentClaimVO,
};
use tigshop_core::models::trade::order_admin::{pay_type, OrderListQuery, OrderVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/order/offlinePaymentClaim/list", get(list))
        .route("/order/offlinePaymentClaim/detail", get(detail))
        .route("/order/offlinePaymentClaim/audit", post(audit))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/api/order/offlinePaymentClaim/list",
            "OfflinePaymentClaimController.list",
        ),
        (
            "GET",
            "/api/order/offlinePaymentClaim/detail",
            "OfflinePaymentClaimController.detail",
        ),
        (
            "POST",
            "/api/order/offlinePaymentClaim/audit",
            "OfflinePaymentClaimController.audit",
        ),
    ]
    .iter()
    .map(|(m, p, h)| tigshop_openapi::RouteDoc::new(m, p, h))
    .collect()
}

/// 线下认款列表复用订单列表查询，仅限定为线下支付订单。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<OrderListQuery>,
) -> ApiResult<PageResult<OrderVO>> {
    q.pay_type_id = Some(pay_type::OFFLINE);
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.trade.order_admin.list(&q, true).await?)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaimQuery {
    claim_id: Option<i32>,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<ClaimQuery>,
) -> ApiResult<OfflinePaymentClaimVO> {
    let claim_id = q.claim_id.ok_or_else(|| {
        tigshop_security::web::AppError(tigshop_core::Error::biz(400, "认款单不存在"))
    })?;
    ok(state
        .trade
        .order
        .offline_claim_admin_detail(claim_id)
        .await?)
}

async fn audit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OfflinePaymentClaimAuditDTO>,
) -> ApiResult<()> {
    state.trade.order.offline_claim_audit(auth.id, dto).await?;
    ok(())
}
