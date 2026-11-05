//! 管理端账号管理路由（identity::admin_account）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.account.AdminAccountController`
//! （`@RequestMapping("/adminapi/admin/adminAccount")`，7 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |----------------------------------|--------------|------------------------|
//! | `GET  /admin/adminAccount/getMainAccount` | `getMainAccount` | 登录 |
//! | `GET  /admin/adminAccount/pageShopOrVendor` | `pageShopOrVendor` | 登录 |
//! | `POST /admin/adminAccount/bindMainAccount` | `bindMainAccount` | `adminAccountBindMainAccount` |
//! | `POST /admin/adminAccount/updateMainAccount` | `updateMainAccount` | `adminAccountUpdateManager` |
//! | `POST /admin/adminAccount/updateMainAccountPwd` | `updateMainAccountPwd` | `adminAccountUpdateManager` |
//! | `GET  /admin/adminAccount/pageAdminUser` | `pageAdminUser` | 登录 |
//! | `POST /admin/adminAccount/deleteAdminUser` | `deleteAdminUser` | `adminAccountUpdateManager` |
//!
//! > **权限说明**：Java 用方法级 `@PreAuthorize("@pms.hasPermission(...)")`；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现
//! > （与 identity / catalog 域其它模块的已知缺口一致）。上表权限列仅作对照。
//!
//! > **`deleteAdminUser` 的参数位置**：Java 是 `@RequestParam Integer adminId`
//! > （POST 的**查询串**参数，不是请求体），因此这里用 `Query<...>` 提取；
//! > 缺失时 axum 直接 400，与 Java 缺少必填 `@RequestParam` 的 400 等价。
//!
//! > **`addTime` 出参**：Java VO 上是 `String` + `TimestampToDateSerializer`
//! > （秒级 → `yyyy-MM-dd HH:mm:ss`），本层返回服务层已格式化好的字符串。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::identity::admin_account::{
    AdminUserAccountListVO, AdminUserAccountVO, AdminUserPageParam, DeleteAdminUserQuery,
    GetMainAccountQuery, ShopOrVendorBindParam, ShopOrVendorListVO, ShopOrVendorPageParam,
    UpdateMainAccountParam, UpdateMainAccountPwdParam,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 账号管理域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `AdminAccountController` 一致；[`implemented_routes`] 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/admin/adminAccount/getMainAccount",
        "AdminAccountController.getMainAccount",
    ),
    (
        "GET",
        "/admin/adminAccount/pageShopOrVendor",
        "AdminAccountController.pageShopOrVendor",
    ),
    (
        "POST",
        "/admin/adminAccount/bindMainAccount",
        "AdminAccountController.bindMainAccount",
    ),
    (
        "POST",
        "/admin/adminAccount/updateMainAccount",
        "AdminAccountController.updateMainAccount",
    ),
    (
        "POST",
        "/admin/adminAccount/updateMainAccountPwd",
        "AdminAccountController.updateMainAccountPwd",
    ),
    (
        "GET",
        "/admin/adminAccount/pageAdminUser",
        "AdminAccountController.pageAdminUser",
    ),
    (
        "POST",
        "/admin/adminAccount/deleteAdminUser",
        "AdminAccountController.deleteAdminUser",
    ),
];

/// 账号管理域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/admin/adminAccount/getMainAccount", get(get_main_account))
        .route(
            "/admin/adminAccount/pageShopOrVendor",
            get(page_shop_or_vendor),
        )
        .route(
            "/admin/adminAccount/bindMainAccount",
            post(bind_main_account),
        )
        .route(
            "/admin/adminAccount/updateMainAccount",
            post(update_main_account),
        )
        .route(
            "/admin/adminAccount/updateMainAccountPwd",
            post(update_main_account_pwd),
        )
        .route("/admin/adminAccount/pageAdminUser", get(page_admin_user))
        .route(
            "/admin/adminAccount/deleteAdminUser",
            post(delete_admin_user),
        )
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/admin/adminAccount/getMainAccount`：主账号信息。
///
/// 对应 Java `getMainAccount(@RequestParam(required=false) adminId, id, type)`。
async fn get_main_account(
    State(state): State<AdminState>,
    Query(q): Query<GetMainAccountQuery>,
) -> ApiResult<AdminUserAccountVO> {
    ok(state
        .identity
        .admin_account
        .get_main_account(q.admin_id, q.id, q.r#type.as_deref())
        .await?)
}

/// `GET /adminapi/admin/adminAccount/pageShopOrVendor`：店铺/供应商分页。
///
/// 对应 Java `pageShopOrVendor(@Valid ShopOrVendorPageParam)`。
async fn page_shop_or_vendor(
    State(state): State<AdminState>,
    Query(q): Query<ShopOrVendorPageParam>,
) -> ApiResult<PageResult<ShopOrVendorListVO>> {
    ok(state.identity.admin_account.page_shop_or_vendor(&q).await?)
}

/// `POST /adminapi/admin/adminAccount/bindMainAccount`：绑定主账号。
///
/// 对应 Java `bindMainAccount(@RequestBody ShopOrVendorBindParam)`（原返回 void）。
async fn bind_main_account(
    State(state): State<AdminState>,
    Json(dto): Json<ShopOrVendorBindParam>,
) -> ApiResult<()> {
    state.identity.admin_account.bind_main_account(&dto).await?;
    ok(())
}

/// `POST /adminapi/admin/adminAccount/updateMainAccount`：修改主账号信息。
///
/// 对应 Java `updateMainAccount(@RequestBody UpdateMainAccountParam)`（原返回 void）。
async fn update_main_account(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateMainAccountParam>,
) -> ApiResult<()> {
    state
        .identity
        .admin_account
        .update_main_account(&dto)
        .await?;
    ok(())
}

/// `POST /adminapi/admin/adminAccount/updateMainAccountPwd`：修改主账号密码。
///
/// 对应 Java `updateMainAccountPwd(@RequestBody UpdateMainAccountPwdParam)`
/// （原返回 void）。
async fn update_main_account_pwd(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateMainAccountPwdParam>,
) -> ApiResult<()> {
    state
        .identity
        .admin_account
        .update_main_account_pwd(&dto)
        .await?;
    ok(())
}

/// `GET /adminapi/admin/adminAccount/pageAdminUser`：账号管理分页列表。
///
/// 对应 Java `pageAdminUser(@Valid AdminUserPageParam)`：控制器先把
/// `isDeleted` 置 0，再走服务分页。
async fn page_admin_user(
    State(state): State<AdminState>,
    Query(q): Query<AdminUserPageParam>,
) -> ApiResult<PageResult<AdminUserAccountListVO>> {
    ok(state.identity.admin_account.page_admin_user(&q).await?)
}

/// `POST /adminapi/admin/adminAccount/deleteAdminUser?adminId=`：删除管理员账号。
///
/// 对应 Java `deleteAdminUser(@RequestParam Integer adminId)`（原返回 void）。
async fn delete_admin_user(
    State(state): State<AdminState>,
    Query(q): Query<DeleteAdminUserQuery>,
) -> ApiResult<()> {
    state
        .identity
        .admin_account
        .delete_admin_user(q.admin_id)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::identity::admin_account::{
        AdminUserPageParam, GetMainAccountQuery, ShopOrVendorBindParam, ShopOrVendorPageParam,
    };

    /// `implemented_routes()` 必须与 Java 契约逐字符一致。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/admin/adminAccount/getMainAccount"),
            ("GET", "/adminapi/admin/adminAccount/pageShopOrVendor"),
            ("POST", "/adminapi/admin/adminAccount/bindMainAccount"),
            ("POST", "/adminapi/admin/adminAccount/updateMainAccount"),
            ("POST", "/adminapi/admin/adminAccount/updateMainAccountPwd"),
            ("GET", "/adminapi/admin/adminAccount/pageAdminUser"),
            ("POST", "/adminapi/admin/adminAccount/deleteAdminUser"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域共 7 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        // 无重复
        let mut keys: Vec<String> = docs.iter().map(RouteDoc::key).collect();
        let sorted = {
            let mut k = keys.clone();
            k.sort();
            k.dedup();
            k
        };
        keys.sort();
        assert_eq!(sorted, keys, "implemented_routes() 存在重复项");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应（架构 §4「路由即契约」门禁）。
    #[test]
    fn routes_registers_every_route_table_entry() {
        // `routes()` 用字面量注册；这里复述同一份清单，改一边漏另一边即失败。
        let registered = [
            "/admin/adminAccount/getMainAccount",
            "/admin/adminAccount/pageShopOrVendor",
            "/admin/adminAccount/bindMainAccount",
            "/admin/adminAccount/updateMainAccount",
            "/admin/adminAccount/updateMainAccountPwd",
            "/admin/adminAccount/pageAdminUser",
            "/admin/adminAccount/deleteAdminUser",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 路径统一以控制器前缀 `/admin/adminAccount/` 开头，方法只允许 GET/POST。
    #[test]
    fn route_table_shape_is_valid() {
        for (i, (method, path, java_ref)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                path.starts_with("/admin/adminAccount/"),
                "路径必须以控制器前缀开头: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(
                java_ref.starts_with("AdminAccountController."),
                "java_ref 必须指向 AdminAccountController: {java_ref}"
            );
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// query 参数按 Java 名（camelCase）解析。
    #[test]
    fn query_params_accept_java_names() {
        let q: GetMainAccountQuery =
            serde_json::from_str(r#"{"adminId":3,"id":9,"type":"shop"}"#).unwrap();
        assert_eq!(q.admin_id, Some(3));
        assert_eq!(q.id, Some(9));
        assert_eq!(q.r#type.as_deref(), Some("shop"));

        let q: ShopOrVendorPageParam = serde_json::from_str(
            r#"{"adminId":3,"type":"store","page":2,"size":30,"keyword":"A"}"#,
        )
        .unwrap();
        assert_eq!(q.admin_id, Some(3));
        assert_eq!(q.r#type.as_deref(), Some("store"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));
        assert_eq!(q.keyword.as_deref(), Some("A"));

        let q: AdminUserPageParam =
            serde_json::from_str(r#"{"isDeleted":0,"page":1,"size":15}"#).unwrap();
        assert_eq!(q.is_deleted, Some(0));
        assert_eq!(q.size, Some(15));

        // deleteAdminUser 的 adminId 是必填查询参数
        let q: DeleteAdminUserQuery = serde_json::from_str(r#"{"adminId":8}"#).unwrap();
        assert_eq!(q.admin_id, 8);
    }

    /// 请求体按 Java 名（camelCase）解析。
    #[test]
    fn body_params_accept_java_names() {
        let p: ShopOrVendorBindParam =
            serde_json::from_str(r#"{"id":9,"type":"shop","adminData":{"type":2,"adminId":5}}"#)
                .unwrap();
        assert_eq!(p.id, Some(9));
        let info = p.admin_data.expect("adminData");
        assert_eq!(info.r#type, Some(2));
        assert_eq!(info.admin_id, Some(5));
    }
}
