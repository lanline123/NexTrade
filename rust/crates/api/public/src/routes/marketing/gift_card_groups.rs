//! 商城端礼品卡路由（marketing::gift_card_groups）。
//!
//! 原 Java：`com.tigshop.api.controller.promotion.GiftCardGroupsController`
//! （`@RequestMapping("/api/promotion/giftCardGroups")`，6 个端点）。
//!
//! | 本模块路由（挂载于 `/api`） | 原 Java 方法 | 契约 auth |
//! |------------------------------|--------------|-----------|
//! | `GET  /promotion/giftCardGroups/detail` | `detail` | optional |
//! | `POST /promotion/giftCardGroups/claim` | `claim` | optional |
//! | `POST /promotion/giftCardGroups/transfer` | `transfer` | optional |
//! | `GET  /promotion/giftCardGroups/isGiftCardExpired` | `isGiftCardExpired` | optional |
//! | `POST /promotion/giftCardGroups/exchange` | `exchange` | optional |
//! | `GET  /promotion/giftCardGroups/getTransferLink` | `getTransferLink` | optional |
//!
//! > **可选登录态**：与 `marketing::groupon_promotion` 一致，
//! > `optional_auth` 中间件把合法 token 解析为 [`AuthUser`]，游客放行；
//! > 需要会员 ID 的接口游客按 `currentUserId = 0` 处理
//! > （Java `SecurityUtils.getCurrentUserId()` 游客返回 0）。
//!
//! > **组合两个域服务**：卡数据来自 `marketing::gift_card`，
//! > 卡组数据来自 `marketing::gift_card_groups`（与 Java controller 一致）。

use axum::{
    extract::{Extension, Query, Request, State},
    http::{header, Response},
    middleware::{self, Next},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::gift_card::{
    ExchangeCardParam, GiftCardClaimParam, GiftCardsVO,
};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_security::JwtService;

use crate::PublicState;

/// 本域 6 条路由（去掉 `/api` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/promotion/giftCardGroups/detail",
        "GiftCardGroupsController.detail",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/claim",
        "GiftCardGroupsController.claim",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/transfer",
        "GiftCardGroupsController.transfer",
    ),
    (
        "GET",
        "/promotion/giftCardGroups/isGiftCardExpired",
        "GiftCardGroupsController.isGiftCardExpired",
    ),
    (
        "POST",
        "/promotion/giftCardGroups/exchange",
        "GiftCardGroupsController.exchange",
    ),
    (
        "GET",
        "/promotion/giftCardGroups/getTransferLink",
        "GiftCardGroupsController.getTransferLink",
    ),
    (
        "GET",
        "/promotion/giftCardGroups/showCardPassword",
        "GiftCardGroupsController.showCardPassword",
    ),
];

/// 礼品卡前台路由（挂载于 `/api` 下，模块自带可选登录态中间件）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    Router::new()
        .route("/promotion/giftCardGroups/detail", get(detail))
        .route("/promotion/giftCardGroups/claim", post(claim))
        .route("/promotion/giftCardGroups/transfer", post(transfer))
        .route(
            "/promotion/giftCardGroups/isGiftCardExpired",
            get(is_gift_card_expired),
        )
        .route("/promotion/giftCardGroups/exchange", post(exchange))
        .route(
            "/promotion/giftCardGroups/getTransferLink",
            get(get_transfer_link),
        )
        .route(
            "/promotion/giftCardGroups/showCardPassword",
            get(show_card_password),
        )
        .layer(middleware::from_fn_with_state(
            state.jwt.clone(),
            optional_auth,
        ))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/api{path}"), handler)
        })
        .collect()
}

/// 可选登录态中间件（无令牌 ⇒ 游客；非法令牌 ⇒ 401；合法 ⇒ [`AuthUser`]）。
async fn optional_auth(
    State(jwt): State<JwtService>,
    mut req: Request,
    next: Next,
) -> Result<Response<axum::body::Body>, AppError> {
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

/// `giftCardSn` 查询参数（detail / getTransferLink）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SnQuery {
    gift_card_sn: Option<String>,
}

/// `cardId` 查询参数（isGiftCardExpired）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CardIdQuery {
    card_id: Option<i32>,
}

/// getTransferLink 查询参数。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct TransferLinkQuery {
    gift_card_sn: Option<String>,
    is_from: Option<i32>,
}

fn current_user_id(auth: &Option<Extension<AuthUser>>) -> i32 {
    auth.as_ref().map(|Extension(user)| user.id).unwrap_or(0)
}

async fn detail(
    State(state): State<PublicState>,
    Query(q): Query<SnQuery>,
) -> ApiResult<GiftCardsVO> {
    let sn = q.gift_card_sn.unwrap_or_default();
    let mut vo = state.marketing.gift_card.client_detail(&sn).await?;
    if let Some(card_groups_id) = vo.card_groups_id {
        let group = state
            .marketing
            .gift_card_groups
            .detail(card_groups_id)
            .await?;
        vo.card_group_name = group.card_group_name;
        vo.image_url = group.image_url;
        vo.gift_card_products = Some(group.gift_card_products);
    }
    ok(vo)
}

async fn claim(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<GiftCardClaimParam>,
) -> ApiResult<()> {
    let _ = current_user_id(&auth); // Java 领取接口未使用当前用户
    state.marketing.gift_card.claim_card(&param).await?;
    ok(())
}

async fn transfer(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<GiftCardClaimParam>,
) -> ApiResult<String> {
    let _ = current_user_id(&auth);
    ok(state.marketing.gift_card.transfer_card(&param).await?)
}

async fn is_gift_card_expired(
    State(state): State<PublicState>,
    Query(q): Query<CardIdQuery>,
) -> ApiResult<bool> {
    let card_id = q
        .card_id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("cardId不能为空".into())))?;
    ok(state.marketing.gift_card.is_gift_card_expired(card_id).await?)
}

async fn exchange(
    State(state): State<PublicState>,
    auth: Option<Extension<AuthUser>>,
    Json(param): Json<ExchangeCardParam>,
) -> ApiResult<GiftCardsVO> {
    let user_id = current_user_id(&auth);
    ok(state.marketing.gift_card.exchange_card(&param, user_id).await?)
}

async fn get_transfer_link(
    State(state): State<PublicState>,
    Query(q): Query<TransferLinkQuery>,
) -> ApiResult<String> {
    let sn = q.gift_card_sn.unwrap_or_default();
    ok(state
        .marketing
        .gift_card
        .get_transfer_link(&sn, q.is_from)
        .await?)
}

async fn show_card_password(
    State(state): State<PublicState>,
    Query(q): Query<TransferLinkQuery>,
) -> ApiResult<String> {
    ok(state
        .marketing
        .gift_card
        .show_card_password_by_sn(q.gift_card_sn.as_deref().unwrap_or_default())
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let expected = [
            ("GET", "/api/promotion/giftCardGroups/detail"),
            ("POST", "/api/promotion/giftCardGroups/claim"),
            ("POST", "/api/promotion/giftCardGroups/transfer"),
            ("GET", "/api/promotion/giftCardGroups/isGiftCardExpired"),
            ("POST", "/api/promotion/giftCardGroups/exchange"),
            ("GET", "/api/promotion/giftCardGroups/getTransferLink"),
            ("GET", "/api/promotion/giftCardGroups/showCardPassword"),
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
        assert_eq!(ROUTE_TABLE.len(), 7);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/api/"), "{path}");
            assert!(path.starts_with("/promotion/giftCardGroups/"), "{path}");
        }
        assert!(implemented_routes()[0].path.starts_with("/api/"));
    }

    #[test]
    fn guest_user_id_is_zero_like_java() {
        assert_eq!(current_user_id(&None), 0);
        let auth = Some(Extension(AuthUser {
            id: 5,
            username: "u".into(),
            role_id: Some(1),
            admin_type: Some("user".into()),
            shop_id: None,
        }));
        assert_eq!(current_user_id(&auth), 5);
    }

    #[test]
    fn query_params_accept_java_names() {
        let q: SnQuery =
            serde_json::from_value(serde_json::json!({"giftCardSn": "sn"})).unwrap();
        assert_eq!(q.gift_card_sn.as_deref(), Some("sn"));
        let q: TransferLinkQuery =
            serde_json::from_value(serde_json::json!({"giftCardSn": "s", "isFrom": 2}))
                .unwrap();
        assert_eq!(q.is_from, Some(2));
    }
}
