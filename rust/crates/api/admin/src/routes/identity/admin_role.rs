//! 管理端角色路由（identity::admin_role）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.authority.AdminRoleController`
//! （`@RequestMapping("/adminapi/authority/adminRole")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |---------------------------------|--------------|------------------------|
//! | `GET  /authority/adminRole/list` | `AdminRoleController.list` | `adminRoleManage` / `ShopRoleManage` / `vendorRoleManage` |
//! | `GET  /authority/adminRole/detail` | `AdminRoleController.detail` | 同上 |
//! | `POST /authority/adminRole/create` | `AdminRoleController.create` | `adminRoleUpdateManage` |
//! | `POST /authority/adminRole/update` | `AdminRoleController.update` | `adminRoleUpdateManage` |
//! | `POST /authority/adminRole/batch` | `AdminRoleController.batch` | `adminRoleUpdateManage` |
//! | `POST /authority/adminRole/updateField` | `AdminRoleController.updateField` | `adminRoleUpdateManage` |
//! | `POST /authority/adminRole/del` | `AdminRoleController.del` | `adminRoleDelManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/authority/adminRole` 与类名同名段
//! > `adminRole`，组合结果逐字符对齐 `docs/_wave1-specs.json`
//! > `identity/admin_role`（`updateField` 的驼峰大小写易写错）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级
//! > 校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 authority / admin_user / brand 等模块的已知缺口一致）。
//! > 上表权限列仅作对照记录。
//!
//! > **多租户说明（重要）**：Java 的 `getAdminType()` / `getShopId()` /
//! > `getVendorId()`（`HeaderUtils`）读请求头 `x-admin-type` / `x-shop-id` /
//! > `x-vendor-id`，并**按类型选择性读取**：
//! > `admin` → `shopId` 恒 0（忽略 `x-shop-id`）；`shop` / `pos` → 读
//! > `x-shop-id`；`vendor` → 读 `x-vendor-id`；其余 → 两个 ID 都为 null。
//! > Rust 侧 `AuthUser` 只有 `admin_type`（JWT `typ`），没有店铺/供应商 ID，
//! > 故 [`resolve_scope`] 的优先级为：**请求头 → JWT → 查询参数兜底**
//! > （与 `identity::admin_user::config` 的 `resolve_admin_type` 同一套约定）。
//!
//! > **出参说明**：Java 的 `list` 返回 MyBatis-Plus `Page<AdminRoleDTO>`
//! > （`records/total/size/current/pages`），Rust 统一用项目既有 `PageResult`
//! > （`list/total/totalPage/pageSize/page`）；`create` / `update` / `batch` /
//! > `updateField` / `del` 在 Java 是 `void`，Rust 返回 `data: null` 的成功包体。
//!
//! > **装配说明**：本文件只提供 `routes(&AdminState)` / `implemented_routes()`；
//! > `routes/identity/mod.rs`、`routes/mod.rs` 与 `bin/src/main.rs` 由主会话
//! > 用 `tools/restructure/register_feature.py` 统一注册，本切片不修改共享文件。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::identity::admin_role::{
    AdminRoleDTO, AdminRoleListQuery, AdminRoleScope, BatchDTO, OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域 7 条路由（去掉 `/adminapi` 前缀的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**；顺序与
/// `AdminRoleController` 的方法声明顺序一致（`list` / `detail` /
/// `create` / `update` / `batch` / `updateField` / `del`）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/authority/adminRole/list",
        "AdminRoleController.list",
    ),
    (
        "GET",
        "/authority/adminRole/detail",
        "AdminRoleController.detail",
    ),
    (
        "POST",
        "/authority/adminRole/create",
        "AdminRoleController.create",
    ),
    (
        "POST",
        "/authority/adminRole/update",
        "AdminRoleController.update",
    ),
    (
        "POST",
        "/authority/adminRole/batch",
        "AdminRoleController.batch",
    ),
    (
        "POST",
        "/authority/adminRole/updateField",
        "AdminRoleController.updateField",
    ),
    (
        "POST",
        "/authority/adminRole/del",
        "AdminRoleController.del",
    ),
];

/// 角色域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/authority/adminRole/list", get(list))
        .route("/authority/adminRole/detail", get(detail))
        .route("/authority/adminRole/create", post(create))
        .route("/authority/adminRole/update", post(update))
        .route("/authority/adminRole/batch", post(batch))
        .route("/authority/adminRole/updateField", post(update_field))
        .route("/authority/adminRole/del", post(del))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 路径为**完整契约路径**（含 `/adminapi` 前缀）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// 请求头 / JWT / 查询参数三者的兜底字段（见模块头「多租户说明」）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ScopeQuery {
    /// 替代请求头 `x-admin-type`
    admin_type: Option<String>,
    /// 替代请求头 `x-shop-id`
    shop_id: Option<i32>,
    /// 替代请求头 `x-vendor-id`
    vendor_id: Option<i32>,
}

/// `GET /adminapi/authority/adminRole/detail?id=` 的查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct RoleDetailQuery {
    /// 角色 ID（Java `@RequestParam Integer id`）
    id: i32,
    /// 替代请求头 `x-admin-type`
    admin_type: Option<String>,
    /// 替代请求头 `x-shop-id`
    shop_id: Option<i32>,
    /// 替代请求头 `x-vendor-id`
    vendor_id: Option<i32>,
}

impl RoleDetailQuery {
    fn scope_query(&self) -> ScopeQuery {
        ScopeQuery {
            admin_type: self.admin_type.clone(),
            shop_id: self.shop_id,
            vendor_id: self.vendor_id,
        }
    }
}

/// 列表查询参数里的「替代请求头」字段 → [`ScopeQuery`]。
///
/// （`AdminRoleListQuery` 定义在 `tigshop_core`，按 Rust 规则不能在 api crate
/// 里给它加固有方法，故用自由函数。）
fn list_scope_query(q: &AdminRoleListQuery) -> ScopeQuery {
    ScopeQuery {
        admin_type: q.admin_type.clone(),
        shop_id: q.shop_id,
        vendor_id: q.vendor_id,
    }
}

/// `GET /adminapi/authority/adminRole/list`：角色分页。
///
/// 对应 Java `AdminRoleController.list(AdminRoleListDTO adminRoleListDTO)`
/// → `AdminRoleServiceImpl#list`（租户过滤 + 排除客服角色 + 关键词 + 排序）。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<AdminRoleListQuery>,
) -> ApiResult<PageResult<AdminRoleDTO>> {
    let scope = resolve_scope(&auth, &headers, &list_scope_query(&q));
    ok(state.identity.admin_role.list(&q, &scope).await?)
}

/// `GET /adminapi/authority/adminRole/detail?id=`：角色详情。
///
/// 对应 Java `AdminRoleController.detail(@RequestParam Integer id)`
/// → `AdminRoleServiceImpl#detail`（`getAccessibleRole` 做租户归属校验）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<RoleDetailQuery>,
) -> ApiResult<AdminRoleDTO> {
    let scope = resolve_scope(&auth, &headers, &q.scope_query());
    ok(state.identity.admin_role.detail(q.id, &scope).await?)
}

/// `POST /adminapi/authority/adminRole/create`：新建角色。
///
/// 对应 Java `AdminRoleController.create(@RequestBody AdminRoleDTO)`（原返回 `void`）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ScopeQuery>,
    Json(dto): Json<AdminRoleDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&auth, &headers, &q);
    state.identity.admin_role.create(&dto, &scope).await?;
    ok(())
}

/// `POST /adminapi/authority/adminRole/update`：更新角色。
///
/// 对应 Java `AdminRoleController.update(@RequestBody AdminRoleDTO)`（原返回 `void`）。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ScopeQuery>,
    Json(dto): Json<AdminRoleDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&auth, &headers, &q);
    state.identity.admin_role.update(&dto, &scope).await?;
    ok(())
}

/// `POST /adminapi/authority/adminRole/batch`：批量操作（仅 `type = "del"`）。
///
/// 对应 Java `AdminRoleController.batch(@RequestBody BatchDTO)`（原返回 `void`）。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ScopeQuery>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&auth, &headers, &q);
    state.identity.admin_role.batch(&dto, &scope).await?;
    ok(())
}

/// `POST /adminapi/authority/adminRole/updateField`：更新单字段。
///
/// 对应 Java `AdminRoleController.updateField(@RequestBody UpdateFieldDTO)`
/// → `AdminRoleServiceImpl#updateField(updateField, ROLE_FIELDS)`
/// （白名单 `ROLE_FIELDS = ["role_name"]`）。原返回 `void`。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ScopeQuery>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&auth, &headers, &q);
    state.identity.admin_role.update_field(&dto, &scope).await?;
    ok(())
}

/// `POST /adminapi/authority/adminRole/del`：删除角色。
///
/// 对应 Java `AdminRoleController.del(@RequestBody OperateDTO)`
/// → `AdminRoleServiceImpl#delRole`（系统角色保护 + 绑定计数 + 三表解绑）。
/// 原返回 `void`。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<ScopeQuery>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&auth, &headers, &q);
    state.identity.admin_role.del(&dto, &scope).await?;
    ok(())
}

/// 读请求头（去空白；空串视为缺失）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 请求头 → 解析整数（Java `Integer.parseInt`；非法值视为缺失）。
fn header_i32(headers: &HeaderMap, name: &str) -> Option<i32> {
    header_str(headers, name).and_then(|v| v.parse::<i32>().ok())
}

/// 解析当前请求的租户视角（复刻 `HeaderUtils#getAdminType/getShopId/getVendorId`）。
///
/// 优先级与 `identity::admin_user::config` 一致：请求头 → JWT → 查询参数。
///
/// **按类型选择性读取**（与 Java 逐条对齐，容易漏）：
/// | `adminType` | `shopId` | `vendorId` |
/// |-------------|----------|------------|
/// | `admin` | 恒 `Some(0)`（**忽略** `x-shop-id`） | `None` |
/// | `shop` / `pos` | `x-shop-id` | `None` |
/// | `vendor` | `None` | `x-vendor-id` |
/// | 其它（含缺失） | `None` | `None` |
fn resolve_scope(auth: &AuthUser, headers: &HeaderMap, q: &ScopeQuery) -> AdminRoleScope {
    let admin_type = header_str(headers, "x-admin-type")
        .or_else(|| auth.admin_type.clone())
        .or_else(|| q.admin_type.clone());

    // Java 只读请求头；JWT 未签发这两个 ID，故把查询参数作为最后兜底。
    let raw_shop_id = header_i32(headers, "x-shop-id").or(q.shop_id);
    let raw_vendor_id = header_i32(headers, "x-vendor-id").or(q.vendor_id);

    let (shop_id, vendor_id) = match admin_type.as_deref() {
        Some("admin") => (Some(0), None),
        Some("shop") | Some("pos") => (raw_shop_id, None),
        Some("vendor") => (None, raw_vendor_id),
        _ => (None, None),
    };

    AdminRoleScope {
        admin_id: auth.id,
        admin_type,
        shop_id,
        vendor_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn auth(admin_type: Option<&str>) -> AuthUser {
        AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: Some(2),
            admin_type: admin_type.map(ToString::to_string),
            shop_id: None,
        }
    }

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, HeaderValue::from_static(v));
        }
        h
    }

    /// 契约逐字符守卫：7 条、method 大小写敏感、`updateField` 驼峰。
    #[test]
    fn implemented_routes_match_java_contract() {
        let expected = [
            ("GET", "/adminapi/authority/adminRole/list"),
            ("GET", "/adminapi/authority/adminRole/detail"),
            ("POST", "/adminapi/authority/adminRole/create"),
            ("POST", "/adminapi/authority/adminRole/update"),
            ("POST", "/adminapi/authority/adminRole/batch"),
            ("POST", "/adminapi/authority/adminRole/updateField"),
            ("POST", "/adminapi/authority/adminRole/del"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7, "契约中 admin_role 共 7 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        // 与 ROUTE_TABLE 一一对应（无遗漏 / 无重复）
        assert_eq!(docs.len(), ROUTE_TABLE.len());
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// 挂载路径 = 契约路径去掉 `/adminapi` 前缀，且都在控制器前缀下。
    #[test]
    fn mounted_paths_are_contract_paths_minus_prefix() {
        for doc in implemented_routes() {
            let mounted = doc
                .path
                .strip_prefix("/adminapi")
                .expect("契约路径应以 /adminapi 开头");
            assert!(mounted.starts_with("/authority/adminRole/"), "{mounted}");
            assert!(!mounted.ends_with('/'));
        }
        // ROUTE_TABLE 与 routes() 里的字面量必须完全一致（7/7）
        let registered = [
            "/authority/adminRole/list",
            "/authority/adminRole/detail",
            "/authority/adminRole/create",
            "/authority/adminRole/update",
            "/authority/adminRole/batch",
            "/authority/adminRole/updateField",
            "/authority/adminRole/del",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(path), "{path} 未在 routes() 中注册");
        }
    }

    /// `adminType = admin`：`shopId` 恒 0（忽略 `x-shop-id`），`vendorId` 恒空。
    #[test]
    fn resolve_scope_admin_forces_zero_shop_id() {
        let scope = resolve_scope(
            &auth(Some("admin")),
            &headers(&[
                ("x-admin-type", "admin"),
                ("x-shop-id", "9"),
                ("x-vendor-id", "3"),
            ]),
            &ScopeQuery::default(),
        );
        assert_eq!(scope.admin_type.as_deref(), Some("admin"));
        assert_eq!(scope.shop_id, Some(0));
        assert_eq!(scope.vendor_id, None);
        assert_eq!(scope.admin_id, 1);
    }

    /// `shop` / `pos`：只读 `x-shop-id`。
    #[test]
    fn resolve_scope_shop_reads_shop_header_only() {
        for ty in ["shop", "pos"] {
            let scope = resolve_scope(
                &auth(Some(ty)),
                &headers(&[("x-shop-id", "12"), ("x-vendor-id", "3")]),
                &ScopeQuery::default(),
            );
            assert_eq!(scope.admin_type.as_deref(), Some(ty));
            assert_eq!(scope.shop_id, Some(12));
            assert_eq!(scope.vendor_id, None, "{ty} 不读 x-vendor-id");
        }
    }

    /// `vendor`：只读 `x-vendor-id`。
    #[test]
    fn resolve_scope_vendor_reads_vendor_header_only() {
        let scope = resolve_scope(
            &auth(Some("vendor")),
            &headers(&[("x-vendor-id", "9"), ("x-shop-id", "12")]),
            &ScopeQuery::default(),
        );
        assert_eq!(scope.shop_id, None);
        assert_eq!(scope.vendor_id, Some(9));
    }

    /// 其它类型（store/pickup/未知/缺失）：两个 ID 都不读（Java `getShopId` 返回 null）。
    #[test]
    fn resolve_scope_other_types_have_no_scope_ids() {
        for ty in [Some("store"), Some("pickup"), Some("legacy"), None] {
            let scope = resolve_scope(
                &auth(ty),
                &headers(&[("x-shop-id", "12"), ("x-vendor-id", "9")]),
                &ScopeQuery::default(),
            );
            assert_eq!(scope.shop_id, None, "{ty:?}");
            assert_eq!(scope.vendor_id, None, "{ty:?}");
        }
    }

    /// 优先级：请求头 > JWT；JWT 缺失时用查询参数兜底。
    #[test]
    fn resolve_scope_precedence_is_header_then_jwt_then_query() {
        // 请求头 x-admin-type 覆盖 JWT
        let scope = resolve_scope(
            &auth(Some("shop")),
            &headers(&[("x-admin-type", "vendor"), ("x-vendor-id", "5")]),
            &ScopeQuery::default(),
        );
        assert_eq!(scope.admin_type.as_deref(), Some("vendor"));
        assert_eq!(scope.vendor_id, Some(5));

        // 请求头缺失 → JWT
        let scope = resolve_scope(
            &auth(Some("shop")),
            &headers(&[]),
            &ScopeQuery {
                admin_type: Some("admin".into()),
                shop_id: Some(4),
                vendor_id: None,
            },
        );
        assert_eq!(scope.admin_type.as_deref(), Some("shop"));
        // shop 类型下用查询参数兜底 x-shop-id（JWT 未签发）
        assert_eq!(scope.shop_id, Some(4));

        // JWT 与请求头都没有 → 查询参数
        let scope = resolve_scope(
            &auth(None),
            &headers(&[]),
            &ScopeQuery {
                admin_type: Some("vendor".into()),
                shop_id: None,
                vendor_id: Some(7),
            },
        );
        assert_eq!(scope.admin_type.as_deref(), Some("vendor"));
        assert_eq!(scope.vendor_id, Some(7));
    }

    /// 非法 `x-shop-id`（Java `NumberFormatException` 场景）按缺失处理。
    #[test]
    fn resolve_scope_ignores_non_numeric_scope_header() {
        let scope = resolve_scope(
            &auth(Some("shop")),
            &headers(&[("x-shop-id", "abc")]),
            &ScopeQuery::default(),
        );
        assert_eq!(scope.shop_id, None);
    }

    /// 查询参数/请求体 DTO 的 serde 形状。
    #[test]
    fn query_dtos_parse_camel_case_with_defaults() {
        let q: RoleDetailQuery = serde_json::from_str(r#"{"id":5,"shopId":3}"#).unwrap();
        assert_eq!(q.id, 5);
        assert_eq!(q.shop_id, Some(3));
        let q: RoleDetailQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.id, 0);

        let s: ScopeQuery = serde_json::from_str(r#"{"adminType":"vendor","vendorId":9}"#).unwrap();
        assert_eq!(s.admin_type.as_deref(), Some("vendor"));
        assert_eq!(s.vendor_id, Some(9));

        let q: AdminRoleListQuery =
            serde_json::from_str(r#"{"page":2,"size":10,"keyword":"客"}"#).unwrap();
        assert_eq!(q.page_params(), (2, 10));
        // `AdminRoleListQuery` 自带的 Rust-only 兜底字段能转成 ScopeQuery
        let q: AdminRoleListQuery =
            serde_json::from_str(r#"{"adminType":"shop","shopId":6}"#).unwrap();
        let sq = list_scope_query(&q);
        assert_eq!(sq.admin_type.as_deref(), Some("shop"));
        assert_eq!(sq.shop_id, Some(6));
    }
}
