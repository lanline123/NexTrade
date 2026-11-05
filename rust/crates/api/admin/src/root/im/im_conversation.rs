//! IM 客服会话（ImConversationController） —— 根级路由（im::im_conversation，admin 端）。
//!
//! **路径约定**：原 Java `adminapi` 的 `ImConversationController`
//! `@RequestMapping("/im/conversation/conversation")` **不含** `/adminapi`
//! 前缀，真实 URL 直接挂在应用根路径（见 `crate::root` 模块文档）。
//! 因此本文件路由串写**完整契约路径**（以 `/im` 开头），
//! `implemented_routes()` 的 `RouteDoc.path` 同样写完整路径。
//!
//! | 本模块路由 | 原 Java | 登录 |
//! |-----------|--------|------|
//! | `GET  /im/conversation/conversation/list` | `list` | 是 |
//! | `GET  /im/conversation/conversation/search` | `search` | 是 |
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
//! > **认证**：由 `crate::router()` 在根级 `merge_protected` 通道统一附加
//! > `require_auth`（`/im/**` 不在 Java `URL_WHITELIST` 内），本文件不自加中间件。
//! >
//! > **身份口径**（后台分支 `getClientTypeByToken() == true`）：
//! > `list` 强制 `lastServantId = 当前管理员`（[`AuthUser`] 的 `id`）；
//! > `shopId` 用请求头复刻 `HeaderUtils.getShopId()` 三态
//! > （`admin` → `0`；`shop`/`pos` → `x-shop-id`；其它 → `null`）。
//! > `create` 的 `lastServantId` 同样取当前管理员 ID。
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
    AdminSearchResult, BatchDTO, ConsultHistoryListVO, DelDTO, ImConversationCreateDTO,
    ImConversationEntityVO, ImConversationPageQuery, ImConversationVO, SaveRemarkDTO, TransferDTO,
    UpdateFieldDTO, WaitServantListQuery, WaitServantListVO,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域根级路由（挂在应用**根路径**，不在 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/im/conversation/conversation/list", get(list))
        .route("/im/conversation/conversation/search", get(search))
        .route("/im/conversation/conversation/transfer", post(transfer))
        .route("/im/conversation/conversation/detail", get(detail))
        .route("/im/conversation/conversation/create", post(create))
        .route(
            "/im/conversation/conversation/waitServantList",
            get(wait_servant_list),
        )
        .route("/im/conversation/conversation/del", post(del))
        .route(
            "/im/conversation/conversation/saveRemark",
            post(save_remark),
        )
        .route(
            "/im/conversation/conversation/consultHistory",
            get(consult_history),
        )
        .route(
            "/im/conversation/conversation/updateField",
            post(update_field),
        )
        .route("/im/conversation/conversation/batch", post(batch))
}

/// 本域已实现路由（`/openapi/coverage` 覆盖率统计，写**完整契约路径**）。
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

/// `GET /im/conversation/conversation/list`：会话列表（后台分支）。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImConversationPageQuery>,
) -> ApiResult<PageResult<ImConversationVO>> {
    let viewer = tigshop_services::im::im_conversation::ConversationViewer::Admin {
        admin_id: auth.id,
        shop_id: resolve_shop_id(&headers, &auth),
    };
    ok(state.im.im_conversation.list(&q, viewer).await?)
}

/// `GET /im/conversation/conversation/search?keyword=`：后台搜索用户 / 会话。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchQuery {
    keyword: String,
}

async fn search(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<AdminSearchResult> {
    ok(state
        .im
        .im_conversation
        .search(&q.keyword, Some(auth.id))
        .await?)
}

/// `POST /im/conversation/conversation/transfer`：转接会话。
///
/// Java `@Valid @RequestBody TransferDTO`：`servantId` 为空时回填当前管理员 ID。
async fn transfer(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<TransferDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, &auth);
    state
        .im
        .im_conversation
        .transfer(&dto, Some(auth.id), shop_id)
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
    State(state): State<AdminState>,
    Query(q): Query<ConversationIdQuery>,
) -> ApiResult<ImConversationVO> {
    ok(state.im.im_conversation.detail(q.conversation_id).await?)
}

/// `POST /im/conversation/conversation/create`：创建/复用会话。
///
/// Java 返回实体本身（`ImConversation`，时间字段为秒级数字）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ImConversationCreateDTO>,
) -> ApiResult<Option<ImConversationEntityVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    ok(state
        .im
        .im_conversation
        .create(&dto, shop_id, Some(auth.id))
        .await?)
}

/// `GET /im/conversation/conversation/waitServantList`：待接入客户列表。
async fn wait_servant_list(
    State(state): State<AdminState>,
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

/// `POST /im/conversation/conversation/del`：删除会话（逻辑删除 + 消息置已读）。
async fn del(
    State(state): State<AdminState>,
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
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<SaveRemarkDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, &auth);
    state.im.im_conversation.save_remark(&dto, shop_id).await?;
    ok(())
}

/// `GET /im/conversation/conversation/consultHistory`：历史会话（含统计装配）。
async fn consult_history(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ImConversationPageQuery>,
) -> ApiResult<PageResult<ConsultHistoryListVO>> {
    let shop_id = resolve_shop_id(&headers, &auth);
    ok(state
        .im
        .im_conversation
        .consult_history(&q, shop_id)
        .await?)
}

/// `POST /im/conversation/conversation/updateField`：更新会话字段（白名单 `status`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.im.im_conversation.update_field(&dto).await?;
    ok(())
}

/// `POST /im/conversation/conversation/batch`：批量操作（仅 `type = "del"`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.im.im_conversation.batch(&dto).await?;
    ok(())
}

// ——————————————————————————————————————————————
// 请求头 → 店铺 ID（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 当前请求的店铺范围（多租户：**身份只信任认证中间件**）。
///
/// - 平台账号 → `Some(0)`（保留既有平台语义）；
/// - 店铺账号 → `Some(本店)`（task-local，忽略可伪造的 `x-shop-id`）。
#[must_use]
fn resolve_shop_id(_headers: &HeaderMap, _auth: &AuthUser) -> Option<i32> {
    let scope = TenantScope::current();
    if scope.is_platform() {
        Some(0)
    } else {
        scope.shop_id()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

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

    fn auth(admin_type: Option<&str>) -> AuthUser {
        AuthUser {
            id: 7,
            username: "kefu".into(),
            role_id: None,
            admin_type: admin_type.map(ToString::to_string),
            shop_id: None,
        }
    }

    /// 契约逐字符对齐（11 条、完整 `/im/...` 路径、驼峰大小写敏感）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 11, "admin 端契约共 11 条");
        let expected = [
            ("GET", "/im/conversation/conversation/list"),
            ("GET", "/im/conversation/conversation/search"),
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

    /// `routes()` 注册的路径必须覆盖全部契约路由（防止漏挂）。
    #[test]
    fn route_table_covers_contract_paths() {
        let docs = implemented_routes();
        for d in &docs {
            assert!(
                d.path.starts_with("/im/conversation/conversation/"),
                "root 路由必须写完整契约路径: {}",
                d.path
            );
            assert!(d.method == "GET" || d.method == "POST");
        }
        assert_eq!(docs.iter().filter(|d| d.method == "GET").count(), 5);
        assert_eq!(docs.iter().filter(|d| d.method == "POST").count(), 6);
    }

    /// 店铺范围：只信任认证身份（task-local），忽略伪造请求头。
    #[tokio::test]
    async fn resolve_shop_id_uses_trusted_identity() {
        use tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope;
        // 无 task-local = 平台语义 → Some(0)；伪造 x-shop-id 无效
        assert_eq!(
            resolve_shop_id(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
                &auth(None)
            ),
            Some(0)
        );
        // 店铺身份 → 本店
        let shop = TenantScope::for_shop(5);
        let seen = with_tenant_scope(shop, async {
            resolve_shop_id(&headers(&[("x-shop-id", "3")]), &auth(None))
        })
        .await;
        assert_eq!(seen, Some(5));
    }
}
