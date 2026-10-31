//! IM 客服会话（ImConversationController） —— 根级路由（im::im_conversation，public 端）。
//!
//! **路径约定**：原 Java `tigshop-api` 的 `ImConversationController`
//! `@RequestMapping("/im/conversation/conversation")` **不含** `/api` 前缀，
//! 真实 URL 挂在应用根路径（见 `crate::root` 模块文档）。故本文件路由串写
//! **完整契约路径**（以 `/im` 开头），`implemented_routes()` 亦写完整路径。
//!
//! | 本模块路由 | 原 Java | 登录 |
//! |-----------|--------|------|
//! | `GET  /im/conversation/conversation/list` | `list` | 是 |
//! | `GET  /im/conversation/conversation/search` | `search` | 是 |
//! | `GET  /im/conversation/conversation/frontSearch` | `frontSearch` | 是 |
//! | `POST /im/conversation/conversation/transfer` | `transfer` | 是 |
//! | `GET  /im/conversation/conversation/detail` | `detail` | 是 |
//! | `POST /im/conversation/conversation/create` | `create` | 是 |
//! | `GET  /im/conversation/conversation/waitServantList` | `waitServantList` | 是 |
//! | `POST /im/conversation/conversation/del` | `del` | 是 |
//! | `POST /im/conversation/conversation/saveRemark` | `saveRemark` | 是 |
//! | `GET  /im/conversation/conversation/consultHistory` | `consultHistory` | 是 |
//! | `POST /im/conversation/conversation/updateField` | `updateField` | 是 |
//! | `POST /im/conversation/conversation/batch` | `batch` | 是 |
//!
//! > **认证**：`/im/**` 不在 Java `WhiteListConfig.URL_WHITELIST` 内 ⇒ 需登录；
//! > 由 `crate::router()` 在根级 `merge_protected` 通道统一附加 `require_auth`
//! > （与 public 端 `im::im_message` 同口径），本文件不自加中间件。契约里
//! > 标注的 `optional` 指「控制器内部按 token 类型分支」，不是免登录。
//! >
//! > **身份口径**（前台分支 `getClientTypeByToken() == false`）：
//! > `list` 强制 `userId = 当前用户`；`frontSearch` 用当前用户 ID；
//! > `search` / `transfer` / `create` 里的 `getCurrentAdminId()` 对普通用户
//! > token 为 `null`（本实现按 `AuthUser.admin_type` 是否为空判断）。
//! >
//! > **未迁移**：`transfer` 的 RabbitMQ autoTransfer 消息（见服务层说明）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::im::im_conversation::{
    AdminSearchResult, BatchDTO, ConsultHistoryListVO, DelDTO, FrontSearchResult,
    ImConversationCreateDTO, ImConversationEntityVO, ImConversationPageQuery, ImConversationVO,
    SaveRemarkDTO, TransferDTO, UpdateFieldDTO, WaitServantListQuery, WaitServantListVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};
use tigshop_services::im::im_conversation::ConversationViewer;

use crate::PublicState;

/// 本域根级路由（挂在应用**根路径**，不在 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    let _ = state;
    Router::new()
        .route("/im/conversation/conversation/list", get(list))
        .route("/im/conversation/conversation/search", get(search))
        .route("/im/conversation/conversation/frontSearch", get(front_search))
        .route("/im/conversation/conversation/transfer", post(transfer))
        .route("/im/conversation/conversation/detail", get(detail))
        .route("/im/conversation/conversation/create", post(create))
        .route("/im/conversation/conversation/waitServantList", get(wait_servant_list))
        .route("/im/conversation/conversation/del", post(del))
        .route("/im/conversation/conversation/saveRemark", post(save_remark))
        .route("/im/conversation/conversation/consultHistory", get(consult_history))
        .route("/im/conversation/conversation/updateField", post(update_field))
        .route("/im/conversation/conversation/batch", post(batch))
}

/// 本域已实现路由（覆盖率统计，写**完整契约路径**）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/im/conversation/conversation/list",
            "ImConversationController.list",
        ),
        (
            "GET",
            "/im/conversation/conversation/search",
            "ImConversationController.search",
        ),
        (
            "GET",
            "/im/conversation/conversation/frontSearch",
            "ImConversationController.frontSearch",
        ),
        (
            "POST",
            "/im/conversation/conversation/transfer",
            "ImConversationController.transfer",
        ),
        (
            "GET",
            "/im/conversation/conversation/detail",
            "ImConversationController.detail",
        ),
        (
            "POST",
            "/im/conversation/conversation/create",
            "ImConversationController.create",
        ),
        (
            "GET",
            "/im/conversation/conversation/waitServantList",
            "ImConversationController.waitServantList",
        ),
        (
            "POST",
            "/im/conversation/conversation/del",
            "ImConversationController.del",
        ),
        (
            "POST",
            "/im/conversation/conversation/saveRemark",
            "ImConversationController.saveRemark",
        ),
        (
            "GET",
            "/im/conversation/conversation/consultHistory",
            "ImConversationController.consultHistory",
        ),
        (
            "POST",
            "/im/conversation/conversation/updateField",
            "ImConversationController.updateField",
        ),
        (
            "POST",
            "/im/conversation/conversation/batch",
            "ImConversationController.batch",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// handler
// ——————————————————————————————————————————————

/// 是否后台身份（Java `TigUtils.getClientTypeByToken()`）：
/// `AuthUser.admin_type` 有值且不是会员 token ⇒ 管理员/店铺/门店 token。
fn is_admin_token(auth: &AuthUser) -> bool {
    matches!(auth.admin_type.as_deref(), Some(kind) if kind != "member")
}

/// 当前管理员 ID（Java `SecurityUtils.getCurrentAdminId()`：前台 token 为 null）。
fn current_admin_id(auth: &AuthUser) -> Option<i32> {
    if is_admin_token(auth) {
        Some(auth.id)
    } else {
        None
    }
}

/// `GET /im/conversation/conversation/list`：会话列表（前台分支）。
async fn list(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImConversationPageQuery>,
) -> ApiResult<PageResult<ImConversationVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    let viewer = if is_admin_token(&auth) {
        ConversationViewer::Admin {
            admin_id: auth.id,
            shop_id,
        }
    } else {
        ConversationViewer::User { user_id: auth.id }
    };
    ok(state.im.im_conversation.list(&q, viewer).await?)
}

/// `GET /im/conversation/conversation/search?keyword=`：搜索（前台分支）。
///
/// 前台 `getCurrentAdminId()` 为 null ⇒ 服务层按 NULL 过滤，返回空列表
/// （与 Java 一致）；若携带后台 token 则按客服搜索。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchQuery {
    keyword: String,
}

async fn search(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<AdminSearchResult> {
    ok(state
        .im
        .im_conversation
        .search(&q.keyword, current_admin_id(&auth))
        .await?)
}

/// `GET /im/conversation/conversation/frontSearch?keyword=`：前台搜索。
///
/// Java `SecurityUtils.getCurrentUserId()`；管理员 token 下为 null ⇒ 用 `0`
/// 参与查询（`user` 表主键从 1 起，等价于查不到）。
async fn front_search(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<FrontSearchResult> {
    let user_id = if is_admin_token(&auth) { 0 } else { auth.id };
    ok(state
        .im
        .im_conversation
        .front_search(&q.keyword, user_id)
        .await?)
}

/// `POST /im/conversation/conversation/transfer`：转接会话。
async fn transfer(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<TransferDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, &auth);
    state
        .im
        .im_conversation
        .transfer(&dto, current_admin_id(&auth), shop_id)
        .await?;
    ok(())
}

/// `GET /im/conversation/conversation/detail?conversationId=`：会话详情。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConversationIdQuery {
    conversation_id: i32,
}

async fn detail(
    State(state): State<PublicState>,
    Query(q): Query<ConversationIdQuery>,
) -> ApiResult<ImConversationVO> {
    ok(state.im.im_conversation.detail(q.conversation_id).await?)
}

/// `POST /im/conversation/conversation/create`：创建/复用会话（前台分支）。
async fn create(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ImConversationCreateDTO>,
) -> ApiResult<Option<ImConversationEntityVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    ok(state
        .im
        .im_conversation
        .create(&dto, shop_id, current_admin_id(&auth))
        .await?)
}

/// `GET /im/conversation/conversation/waitServantList`：待接入客户列表。
async fn wait_servant_list(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<WaitServantListQuery>,
) -> ApiResult<PageResult<WaitServantListVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    ok(state
        .im
        .im_conversation
        .wait_servant_list(&q, shop_id)
        .await?)
}

/// `POST /im/conversation/conversation/del`：删除会话。
async fn del(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<DelDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, &auth);
    state.im.im_conversation.delete(&dto, shop_id).await?;
    ok(())
}

/// `POST /im/conversation/conversation/saveRemark`：保存备注 / 总结。
async fn save_remark(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<SaveRemarkDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, &auth);
    state.im.im_conversation.save_remark(&dto, shop_id).await?;
    ok(())
}

/// `GET /im/conversation/conversation/consultHistory`：历史会话。
async fn consult_history(
    State(state): State<PublicState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImConversationPageQuery>,
) -> ApiResult<PageResult<ConsultHistoryListVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    ok(state.im.im_conversation.consult_history(&q, shop_id).await?)
}

/// `POST /im/conversation/conversation/updateField`：更新会话字段。
async fn update_field(
    State(state): State<PublicState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.im.im_conversation.update_field(&dto).await?;
    ok(())
}

/// `POST /im/conversation/conversation/batch`：批量操作。
async fn batch(State(state): State<PublicState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.im.im_conversation.batch(&dto).await?;
    ok(())
}

// ——————————————————————————————————————————————
// 请求头 → 店铺 ID（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 读取请求头文本值（缺失 / 非 UTF-8 / 全空白 → `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 复刻 Java `HeaderUtils.getShopId()` 三态：
/// `admin` → `Some(0)`；`shop`/`pos` → `x-shop-id`；其它 → `None`。
#[must_use]
fn resolve_shop_id(headers: &HeaderMap, auth: &AuthUser) -> Option<i32> {
    let admin_type = header_str(headers, "x-admin-type").or_else(|| auth.admin_type.clone());
    let shop_id = header_str(headers, "x-shop-id").and_then(|v| v.parse::<i32>().ok());
    match admin_type.as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => shop_id,
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    fn auth(admin_type: Option<&str>, id: i32) -> AuthUser {
        AuthUser {
            id,
            username: "u".into(),
            role_id: None,
            admin_type: admin_type.map(ToString::to_string),
            shop_id: None,
        }
    }

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

    /// 契约逐字符对齐（12 条，含 `frontSearch`；路径写完整 `/im/...`）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 12, "public 端契约共 12 条");
        let expected = [
            ("GET", "/im/conversation/conversation/list"),
            ("GET", "/im/conversation/conversation/search"),
            ("GET", "/im/conversation/conversation/frontSearch"),
            ("POST", "/im/conversation/conversation/transfer"),
            ("GET", "/im/conversation/conversation/detail"),
            ("POST", "/im/conversation/conversation/create"),
            ("GET", "/im/conversation/conversation/waitServantList"),
            ("POST", "/im/conversation/conversation/del"),
            ("POST", "/im/conversation/conversation/saveRemark"),
            ("GET", "/im/conversation/conversation/consultHistory"),
            ("POST", "/im/conversation/conversation/updateField"),
            ("POST", "/im/conversation/conversation/batch"),
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
        assert_eq!(unique, keys, "implemented_routes() 存在重复项");
    }

    /// 与 admin 端相比只多 `frontSearch` 一条，其余路径完全一致。
    #[test]
    fn public_contract_is_admin_plus_front_search() {
        let docs = implemented_routes();
        assert_eq!(docs.iter().filter(|d| d.method == "GET").count(), 6);
        assert_eq!(docs.iter().filter(|d| d.method == "POST").count(), 6);
        assert!(docs
            .iter()
            .any(|d| d.path == "/im/conversation/conversation/frontSearch"));
    }

    /// 前后台身份判定（Java `TigUtils.getClientTypeByToken()`）。
    #[test]
    fn admin_token_detection_and_current_admin_id() {
        assert!(!is_admin_token(&auth(None, 9)));
        assert_eq!(current_admin_id(&auth(None, 9)), None, "前台 token 无 adminId");
        assert!(is_admin_token(&auth(Some("admin"), 7)));
        assert_eq!(current_admin_id(&auth(Some("admin"), 7)), Some(7));
        assert_eq!(current_admin_id(&auth(Some("shop"), 7)), Some(7));
    }

    /// 店铺头三态。
    #[test]
    fn resolve_shop_id_three_states() {
        assert_eq!(
            resolve_shop_id(
                &headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")]),
                &auth(None, 1)
            ),
            Some(0)
        );
        assert_eq!(
            resolve_shop_id(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
                &auth(None, 1)
            ),
            Some(9)
        );
        assert_eq!(resolve_shop_id(&headers(&[]), &auth(None, 1)), None);
    }
}
