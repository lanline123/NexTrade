//! 撤回类杂项路由（system::recall_extra）。
//!
//! b2b2b 5.8.57 新版管理端的「撤回」操作：把已提交/已审核记录的
//! status 置回待处理（0）。最小实现（无 Java 参考可迁移），逐条注释表名。
//! 经 `ConfigBasicRepository::pool_clone` 直连执行（轻量 UPDATE）。

use axum::{extract::State, routing::post, Json, Router};
use serde::Deserialize;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct RecallDTO {
    id: Option<i32>,
    ids: Option<Vec<i32>>,
}

fn ids_of(dto: &RecallDTO) -> Vec<i32> {
    dto.ids
        .clone()
        .or_else(|| dto.id.map(|v| vec![v]))
        .unwrap_or_default()
        .into_iter()
        .filter(|v| *v > 0)
        .collect()
}

async fn recall_rows(state: &AdminState, table: &str, ids: &[i32]) -> Result<(), Error> {
    if ids.is_empty() {
        return Err(Error::Validation("缺少 id".into()));
    }
    let list = ids
        .iter()
        .map(std::string::ToString::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let pool = state.system.config_basic.repo().pool_clone();
    sqlx::query(&format!(
        "UPDATE `{table}` SET status = 0 WHERE id IN ({list})"
    ))
    .execute(&pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

macro_rules! recall_route {
    ($fn_name:ident, $path:literal, $table:literal) => {
        async fn $fn_name(
            State(state): State<AdminState>,
            Json(dto): Json<RecallDTO>,
        ) -> ApiResult<()> {
            recall_rows(&state, $table, &ids_of(&dto)).await?;
            ok(())
        }
    };
}

// 表主键列名差异：order_invoice/user_invoice/user_recharge_order/user_withdraw_apply
// 的主键不是 `id`（见各实体），逐条用列名宏展开。
async fn recall_invoice(
    state: &AdminState,
    table: &str,
    key: &str,
    ids: &[i32],
) -> Result<(), Error> {
    if ids.is_empty() {
        return Err(Error::Validation("缺少 id".into()));
    }
    let list = ids
        .iter()
        .map(std::string::ToString::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let pool = state.system.config_basic.repo().pool_clone();
    sqlx::query(&format!(
        "UPDATE `{table}` SET status = 0 WHERE `{key}` IN ({list})"
    ))
    .execute(&pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

async fn order_invoice_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "order_invoice", "id", &ids_of(&dto)).await?;
    ok(())
}

async fn user_invoice_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "user_invoice", "invoice_id", &ids_of(&dto)).await?;
    ok(())
}

async fn recharge_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "user_recharge_order", "order_id", &ids_of(&dto)).await?;
    ok(())
}

async fn withdraw_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "user_withdraw_apply", "id", &ids_of(&dto)).await?;
    ok(())
}

// 主键列名与表名不同的三条不走宏(paylog=paylog_id、user=user_id、
// unipush_log=unipush_log_id,线上 1054 实测修正):
async fn paylog_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "paylog", "paylog_id", &ids_of(&dto)).await?;
    ok(())
}
recall_route!(feedback_recall, "user/feedback/recall", "feedback");
async fn user_recall(State(state): State<AdminState>, Json(dto): Json<RecallDTO>) -> ApiResult<()> {
    recall_invoice(&state, "user", "user_id", &ids_of(&dto)).await?;
    ok(())
}
async fn user_rank_recall_inner(state: &AdminState, ids: &[i32]) -> Result<(), Error> {
    if ids.is_empty() {
        return Err(Error::Validation("缺少 id".into()));
    }
    let list = ids
        .iter()
        .map(std::string::ToString::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let pool = state.system.config_basic.repo().pool_clone();
    sqlx::query(&format!(
        "UPDATE `user_rank` SET status = 0 WHERE `rank_id` IN ({list})"
    ))
    .execute(&pool)
    .await
    .map_err(|e| Error::Database(e.to_string()))?;
    Ok(())
}

async fn user_rank_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    user_rank_recall_inner(&state, &ids_of(&dto)).await?;
    ok(())
}
async fn push_log_recall(
    State(state): State<AdminState>,
    Json(dto): Json<RecallDTO>,
) -> ApiResult<()> {
    recall_invoice(&state, "unipush_log", "unipush_log_id", &ids_of(&dto)).await?;
    ok(())
}

/// 撤回杂项路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/orderInvoice/recall", post(order_invoice_recall))
        .route("/finance/payLog/recall", post(paylog_recall))
        .route("/finance/userInvoice/recall", post(user_invoice_recall))
        .route("/finance/userRechargeOrder/recall", post(recharge_recall))
        .route("/finance/userWithdrawApply/recall", post(withdraw_recall))
        .route("/user/feedback/recall", post(feedback_recall))
        .route("/user/user/recall", post(user_recall))
        .route("/user/userRank/recall", post(user_rank_recall))
        .route("/user/pushLog/recall", post(push_log_recall))
}
