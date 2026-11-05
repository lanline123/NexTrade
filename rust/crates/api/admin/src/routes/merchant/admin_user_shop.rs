//! 管理端店铺员工路由（merchant::admin_user_shop）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.shop.AdminUserShopController`
//! （`@RequestMapping("/adminapi/merchant/adminUserShop")`，9 个端点，全部需登录）。
//!
//! > **多租户说明**：Java 用请求头 `x-shop-id`（`HeaderUtils.getShopId()`）确定当前店铺；
//! > Rust JWT 未签发 `shop_id`，故各接口接受查询参数 `shopId` 兜底（与 wave1 约定一致）。
//! > 缺省时：`list` 返回空页，其它接口按 Java 语义返回「店铺员工信息不存在」。
//!
//! 权限矩阵（`adminUserShopModifyManage`）在 Rust 侧尚未实现，本模块只做登录态校验。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use tigshop_core::models::merchant::admin_user_shop::{
    AdminUserShopCreateDTO, AdminUserShopModifyDTO, AdminUserShopPageQuery, AdminUserShopUpdateDTO,
    AdminUserShopVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域 9 条路由（挂载路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 9] = [
    (
        "GET",
        "/merchant/adminUserShop/list",
        "AdminUserShopController.list",
    ),
    (
        "GET",
        "/merchant/adminUserShop/detail",
        "AdminUserShopController.detail",
    ),
    (
        "GET",
        "/merchant/adminUserShop/info",
        "AdminUserShopController.info",
    ),
    (
        "GET",
        "/merchant/adminUserShop/checkIsAdmin",
        "AdminUserShopController.checkIsAdmin",
    ),
    (
        "POST",
        "/merchant/adminUserShop/create",
        "AdminUserShopController.create",
    ),
    (
        "POST",
        "/merchant/adminUserShop/update",
        "AdminUserShopController.update",
    ),
    (
        "POST",
        "/merchant/adminUserShop/del",
        "AdminUserShopController.del",
    ),
    (
        "POST",
        "/merchant/adminUserShop/batch",
        "AdminUserShopController.batch",
    ),
    (
        "POST",
        "/merchant/adminUserShop/modifyUser",
        "AdminUserShopController.modifyUser",
    ),
];

/// 店铺员工域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/adminUserShop/list", get(list))
        .route("/merchant/adminUserShop/detail", get(detail))
        .route("/merchant/adminUserShop/info", get(info))
        .route("/merchant/adminUserShop/checkIsAdmin", get(check_is_admin))
        .route("/merchant/adminUserShop/create", post(create))
        .route("/merchant/adminUserShop/update", post(update))
        .route("/merchant/adminUserShop/del", post(del))
        .route("/merchant/adminUserShop/batch", post(batch))
        .route("/merchant/adminUserShop/modifyUser", post(modify_user))
}

/// 本域已实现路由（完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// 店铺 + id 查询参数（`shopId` 兜底 `x-shop-id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShopQuery {
    shop_id: Option<i32>,
}

/// `detail` / `info` 的 `id` 参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdShopQuery {
    id: Option<i32>,
    shop_id: Option<i32>,
}

async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<AdminUserShopPageQuery>,
) -> ApiResult<PageResult<AdminUserShopVO>> {
    // 多租户：店铺账号只能列自己店铺的员工；平台账号可用可选 shopId 过滤。
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.merchant.admin_user_shop.list(&q, scope).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdShopQuery>,
) -> ApiResult<AdminUserShopVO> {
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.merchant.admin_user_shop.detail(q.id, scope).await?)
}

async fn info(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdShopQuery>,
) -> ApiResult<AdminUserShopVO> {
    let scope = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.merchant.admin_user_shop.info(q.id, scope).await?)
}

async fn check_is_admin(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
) -> ApiResult<Value> {
    let _ = &q;
    // 只可信身份：店铺账号固定自身店铺；平台账号不指定店铺（返回 false）。
    let is_admin = state
        .merchant
        .admin_user_shop
        .check_is_admin(auth.id, auth.scoped_shop_id())
        .await?;
    let body: Value = serde_json::json!({ "isAdmin": is_admin });
    ok(body)
}

async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<AdminUserShopCreateDTO>,
) -> ApiResult<()> {
    // 写操作必须落到具体店铺：店铺账号固定自身，平台账号必须显式 shopId。
    let scope = auth.require_shop_scope(q.shop_id)?;
    state
        .merchant
        .admin_user_shop
        .create(&dto, Some(scope))
        .await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<AdminUserShopUpdateDTO>,
) -> ApiResult<()> {
    let scope = auth.require_shop_scope(q.shop_id)?;
    state
        .merchant
        .admin_user_shop
        .update(&dto, Some(scope))
        .await?;
    ok(())
}

async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<Value>,
) -> ApiResult<()> {
    let id = dto.get("id").and_then(Value::as_i64).map(|v| v as i32);
    let scope = auth.require_shop_scope(q.shop_id)?;
    state
        .merchant
        .admin_user_shop
        .del(id, auth.id, Some(scope))
        .await?;
    ok(())
}

async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<Value>,
) -> ApiResult<()> {
    let ids: Option<Vec<i32>> = dto.get("ids").and_then(Value::as_array).map(|arr| {
        arr.iter()
            .filter_map(Value::as_i64)
            .map(|v| v as i32)
            .collect()
    });
    let op_type = dto.get("type").and_then(Value::as_str);
    let scope = auth.require_shop_scope(q.shop_id)?;
    state
        .merchant
        .admin_user_shop
        .batch(ids.as_deref(), op_type, auth.id, Some(scope))
        .await?;
    ok(())
}

async fn modify_user(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopQuery>,
    Json(dto): Json<AdminUserShopModifyDTO>,
) -> ApiResult<()> {
    let scope = auth.require_shop_scope(q.shop_id)?;
    state
        .merchant
        .admin_user_shop
        .modify_user(&dto, Some(scope))
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// 店铺账号列表被强制收敛到自身店铺；平台账号可显式过滤。
    #[test]
    fn list_scope_is_forced_for_shop_account() {
        let auth = shop_account(9);
        assert_eq!(auth.resolve_shop_scope(None).unwrap(), Some(9));
        assert!(auth.resolve_shop_scope(Some(8)).is_err());
        let admin = platform();
        assert_eq!(admin.resolve_shop_scope(None).unwrap(), None);
        assert_eq!(admin.resolve_shop_scope(Some(8)).unwrap(), Some(8));
    }

    /// 写操作（create/update/del/batch/modifyUser）必须落到当前店铺。
    #[test]
    fn writes_require_shop_scope() {
        let auth = shop_account(9);
        assert_eq!(auth.require_shop_scope(None).unwrap(), 9);
        assert!(auth.require_shop_scope(Some(8)).is_err());
        // 平台账号未指定 shopId → 拒绝写操作（不再静默落到 0 号店铺）
        assert!(platform().require_shop_scope(None).is_err());
        assert_eq!(platform().require_shop_scope(Some(3)).unwrap(), 3);
    }

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/merchant/adminUserShop/list"),
            ("GET", "/adminapi/merchant/adminUserShop/detail"),
            ("GET", "/adminapi/merchant/adminUserShop/info"),
            ("GET", "/adminapi/merchant/adminUserShop/checkIsAdmin"),
            ("POST", "/adminapi/merchant/adminUserShop/create"),
            ("POST", "/adminapi/merchant/adminUserShop/update"),
            ("POST", "/adminapi/merchant/adminUserShop/del"),
            ("POST", "/adminapi/merchant/adminUserShop/batch"),
            ("POST", "/adminapi/merchant/adminUserShop/modifyUser"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 9);
        for (doc, (m, p)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *m);
            assert_eq!(doc.path, *p);
        }
        let mut keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), 9);
    }
}
