//! 客服接入规则 —— 管理端路由（im::admin_shop_kefu_config）。
//!
//! 原 Java `AdminShopKefuConfigController`
//! （`java/tigshop-adminapi/.../controller/im/AdminShopKefuConfigController.java`，
//! `@RequestMapping("/adminapi/im/shopKefuConfig")`），2 个端点：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 契约 auth | 权限 |
//! |----------------------------------|-----------|------|
//! | `GET  /im/shopKefuConfig/accessConfig/detail` | jwt+perm | `kefuAccessSetting` |
//! | `POST /im/shopKefuConfig/accessConfig/save`   | jwt+perm | `kefuAccessSetting` |
//!
//! > 权限矩阵尚未在 Rust 侧实现（仅 `require_auth`），权限码记录在
//! > `ROUTE_TABLE` 的 Java 引用中，与其余已迁移 feature 口径一致。
//!
//! > **shopId 解析**：Java `resolveShopId` —— `x-admin-type=admin` 时用
//! > 请求里的 `shopId`（缺省 0）；否则取 `x-shop-id`，缺失/非法直接
//! > 「无法获取当前店铺信息」。与 `root/im/im_config.rs` 的请求头口径一致。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::im::admin_shop_kefu_config::{
    KefuAccessConfigQuery, KefuAccessConfigSaveDTO, KefuAccessConfigVO,
};
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::AdminState;

/// 本域 2 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/im/shopKefuConfig/accessConfig/detail",
        "AdminShopKefuConfigController.detail",
    ),
    (
        "POST",
        "/im/shopKefuConfig/accessConfig/save",
        "AdminShopKefuConfigController.save",
    ),
];

/// 客服接入规则路由（挂载于 `/adminapi` 下，外层已统一 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/im/shopKefuConfig/accessConfig/detail", get(detail))
        .route("/im/shopKefuConfig/accessConfig/save", post(save))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// 解析当前店铺 ID（多租户：**身份只信任认证中间件**）。
///
/// - 店铺账号：强制自己的 `shop_id`（请求值不同 → 403）；
/// - 平台账号：请求值优先，缺省落平台（`0`）。
///
/// 忽略客户端可伪造的 `x-admin-type` / `x-shop-id` 请求头。
fn resolve_shop_id(_headers: &HeaderMap, requested: Option<i32>) -> Result<i32, AppError> {
    Ok(TenantScope::current().write_shop_id(requested)?)
}

/// 读取请求头字符串。
fn header_str<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

/// `GET /adminapi/im/shopKefuConfig/accessConfig/detail?shopId=`：接入规则详情。
async fn detail(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<KefuAccessConfigQuery>,
) -> ApiResult<KefuAccessConfigVO> {
    let shop_id = resolve_shop_id(&headers, q.shop_id)?;
    ok(state
        .im
        .admin_shop_kefu_config
        .get_access_config(shop_id)
        .await?)
}

/// `POST /adminapi/im/shopKefuConfig/accessConfig/save`：保存接入规则。
async fn save(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<KefuAccessConfigSaveDTO>,
) -> ApiResult<()> {
    let shop_id = resolve_shop_id(&headers, dto.shop_id)?;
    state.im.admin_shop_kefu_config.save(&dto, shop_id).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;
    use tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope;

    #[test]
    fn route_table_matches_contract_literally() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        assert_eq!(ROUTE_TABLE[0].1, "/im/shopKefuConfig/accessConfig/detail");
        assert_eq!(ROUTE_TABLE[1].1, "/im/shopKefuConfig/accessConfig/save");
        let docs = implemented_routes();
        assert_eq!(
            docs[0].path,
            "/adminapi/im/shopKefuConfig/accessConfig/detail"
        );
        assert_eq!(docs[1].method, "POST");
    }

    #[tokio::test]
    async fn resolve_shop_id_trusts_identity_not_headers() {
        // 无 task-local = 平台语义：请求值优先，缺省 0
        assert_eq!(resolve_shop_id(&HeaderMap::new(), Some(7)).unwrap(), 7);
        assert_eq!(resolve_shop_id(&HeaderMap::new(), None).unwrap(), 0);
        // 店铺身份：强制本店；跨店写 → 403（请求头被忽略）
        let shop = TenantScope::for_shop(5);
        let (same, cross_forbidden, missing) = with_tenant_scope(shop, async {
            (
                resolve_shop_id(&HeaderMap::new(), Some(5)).unwrap(),
                resolve_shop_id(&HeaderMap::new(), Some(3)).is_err(),
                resolve_shop_id(&HeaderMap::new(), None).unwrap(),
            )
        })
        .await;
        assert_eq!(same, 5);
        assert!(cross_forbidden, "店铺账号跨店写必须 403");
        assert_eq!(missing, 5, "缺省 shopId 落本店");
    }
}
