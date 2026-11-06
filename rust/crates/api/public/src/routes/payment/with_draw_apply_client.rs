//! 前台用户提现路由（payment::with_draw_apply_client）。
//!
//! 原 Java `WithDrawApplyClientController`
//! （`java/tigshop-api/.../controller/user/WithDrawApplyClientController.java`，
//! `@RequestMapping("/api/user/withdrawApply")`，7 个端点，契约 `auth=optional`）。
//!
//! ## 路径对照（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|--------------|-----------|
//! | `GET  /user/withdrawApply/list` | `GET /api/user/withdrawApply/list` | `list` | optional |
//! | `POST /user/withdrawApply/createAccount` | `POST /api/user/withdrawApply/createAccount` | `createAccount` | optional |
//! | `POST /user/withdrawApply/updateAccount` | `POST /api/user/withdrawApply/updateAccount` | `updateAccount` | optional |
//! | `GET  /user/withdrawApply/accountDetail` | `GET /api/user/withdrawApply/accountDetail` | `accountDetail` | optional |
//! | `POST /user/withdrawApply/delAccount` | `POST /api/user/withdrawApply/delAccount` | `delAccount` | optional |
//! | `POST /user/withdrawApply/apply` | `POST /api/user/withdrawApply/apply` | `apply` | optional |
//! | `POST /user/withdrawApply/applyCommission` | `POST /api/user/withdrawApply/applyCommission` | `applyCommission` | optional |
//!
//! ## auth=optional 落地口径
//!
//! 契约 7 条均为 `optional`（Java 在 `permitAll` 下仍挂 JWT 过滤器：带合法令牌
//! 则写入用户上下文；不带视为游客；**非法/过期令牌 → 401**）。本文件按
//! `content/seo.rs` 的既有约定自带 [`optional_auth`]，**必须并入 `merge_public`**，
//! 外层不得再套 `require_auth`。
//!
//! 业务上 7 个 handler 都按 `getCurrentUserId()` 取当前用户：无登录态时返回
//! 401「请先登录」（Java 由 `SecurityUtils.getCurrentUserId()` + 库内
//! `user_id > 0` 过滤兜底；这里显式拒绝，偏差已登记）。

use axum::{
    extract::{Query, Request, State},
    http::header,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;

use tigshop_core::models::payment::with_draw_apply_client::{
    WithdrawAccountCreateDTO, WithdrawAccountDeleteDTO, WithdrawAccountListQuery,
    WithdrawAccountUpdateDTO, WithdrawAccountVO, WithdrawApplyDTO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 7 条路由（去 `/api` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    ("GET", "/user/withdrawApply/list", "WithDrawApplyClientController.list"),
    ("POST", "/user/withdrawApply/createAccount", "WithDrawApplyClientController.createAccount"),
    ("POST", "/user/withdrawApply/updateAccount", "WithDrawApplyClientController.updateAccount"),
    ("GET", "/user/withdrawApply/accountDetail", "WithDrawApplyClientController.accountDetail"),
    ("POST", "/user/withdrawApply/delAccount", "WithDrawApplyClientController.delAccount"),
    ("POST", "/user/withdrawApply/apply", "WithDrawApplyClientController.apply"),
    ("POST", "/user/withdrawApply/applyCommission", "WithDrawApplyClientController.applyCommission"),
];

/// 前台用户提现路由（挂载于 `/api` 下，自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/user/withdrawApply/list", get(list))
        .route("/user/withdrawApply/createAccount", post(create_account))
        .route("/user/withdrawApply/updateAccount", post(update_account))
        .route("/user/withdrawApply/accountDetail", get(account_detail))
        .route("/user/withdrawApply/delAccount", post(del_account))
        .route("/user/withdrawApply/apply", post(apply))
        .route("/user/withdrawApply/applyCommission", post(apply_commission))
        .layer(middleware::from_fn_with_state(state.jwt.clone(), optional_auth))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), java_ref)
        })
        .collect()
}

/// 当前登录用户 ID；未登录 → 401「请先登录」。
fn current_user(auth: Option<Extension<AuthUser>>) -> Result<i32, AppError> {
    match auth {
        Some(Extension(user)) if user.id > 0 => Ok(user.id),
        _ => Err(AppError(Error::Unauthorized("请先登录".into()))),
    }
}

/// `GET /api/user/withdrawApply/list`：提现账号分页列表。
async fn list(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<WithdrawAccountListQuery>,
) -> ApiResult<PageResult<WithdrawAccountVO>> {
    let user_id = current_user(auth)?;
    ok(state.payment.with_draw_apply_client.list(user_id, &q).await?)
}

/// `POST /api/user/withdrawApply/createAccount`：创建提现账号。
async fn create_account(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WithdrawAccountCreateDTO>,
) -> ApiResult<()> {
    let user_id = current_user(auth)?;
    state.payment.with_draw_apply_client.create(user_id, &dto).await?;
    ok(())
}

/// `POST /api/user/withdrawApply/updateAccount`：修改提现账号。
async fn update_account(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WithdrawAccountUpdateDTO>,
) -> ApiResult<()> {
    let user_id = current_user(auth)?;
    state.payment.with_draw_apply_client.update(user_id, &dto).await?;
    ok(())
}

/// 账号详情查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountIdQuery {
    /// 提现账号 ID
    account_id: i32,
}

/// `GET /api/user/withdrawApply/accountDetail?accountId=`：提现账号详情。
async fn account_detail(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Query(q): Query<AccountIdQuery>,
) -> ApiResult<WithdrawAccountVO> {
    let user_id = current_user(auth)?;
    ok(state.payment.with_draw_apply_client.detail(user_id, q.account_id).await?)
}

/// `POST /api/user/withdrawApply/delAccount`：删除提现账号。
async fn del_account(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WithdrawAccountDeleteDTO>,
) -> ApiResult<()> {
    let user_id = current_user(auth)?;
    state.payment.with_draw_apply_client.del_account(user_id, dto.account_id).await?;
    ok(())
}

/// `POST /api/user/withdrawApply/apply`：余额提现申请。
async fn apply(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WithdrawApplyDTO>,
) -> ApiResult<()> {
    let user_id = current_user(auth)?;
    state.payment.with_draw_apply_client.apply(user_id, &dto).await?;
    ok(())
}

/// `POST /api/user/withdrawApply/applyCommission`：佣金提现申请（D1107）。
async fn apply_commission(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(dto): Json<WithdrawApplyDTO>,
) -> ApiResult<()> {
    let user_id = current_user(auth)?;
    state.payment.with_draw_apply_client.apply_commission(user_id, &dto).await?;
    ok(())
}

/// 可选登录态中间件（对应 Java `permitAll` + JWT 过滤器）。
///
/// 无令牌 → 游客；非法/过期令牌 → 401；合法令牌 → 写入 [`AuthUser`]。
/// 与 `content/seo.rs` / `shop_client.rs` / `wholesale_client.rs` 的实现一致。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    if token.is_some() {
        let Ok(claims) = jwt.from_authorization(token) else { return Ok(next.run(req).await); };
        let Ok(id) = claims.sub.parse::<i32>() else { return Ok(next.run(req).await); };
        req.extensions_mut().insert(AuthUser {
            id,
            username: claims.usr,
            role_id: claims.role,
            admin_type: claims.typ,
            shop_id: claims.shop_id,
        });
    }
    Ok(next.run(req).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_contract_literally() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        assert_eq!(docs[0].path, "/api/user/withdrawApply/list");
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/api/")));
        let expected = [
            "/user/withdrawApply/list",
            "/user/withdrawApply/createAccount",
            "/user/withdrawApply/updateAccount",
            "/user/withdrawApply/accountDetail",
            "/user/withdrawApply/delAccount",
            "/user/withdrawApply/apply",
            "/user/withdrawApply/applyCommission",
        ];
        let actual: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(actual, expected);
    }

    #[test]
    fn list_endpoint_uses_get_and_writes_use_post() {
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 2);
        assert_eq!(ROUTE_TABLE.len() - gets, 5);
    }
}
