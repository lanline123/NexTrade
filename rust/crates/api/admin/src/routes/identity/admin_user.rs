//! 管理端管理员列表路由（identity::admin_user）。
//! 对应原 Java `com.tigshop.adminapi.controller.authority.AdminUserController`
//! （`@RequestMapping("/adminapi/authority/adminUser")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |---------------------------------|--------------|------------------------|
//! | `GET  /authority/adminUser/list` | `AdminUserController.list` | `adminUserManage` |
//! | `GET  /authority/adminUser/mineDetail` | `AdminUserController.mineDetail` | 登录 |
//! | `GET  /authority/adminUser/detail` | `AdminUserController.detail` | `adminUserManage`（或本人） |
//! | `POST /authority/adminUser/create` | `AdminUserController.create` | `adminUserUpdateManage` |
//! | `POST /authority/adminUser/update` | `AdminUserController.update` | `adminUserUpdateManage` |
//! | `POST /authority/adminUser/del` | `AdminUserController.del` | `adminUserDelManage` |
//! | `POST /authority/adminUser/batch` | `AdminUserController.batch` | `adminUserBatchManage` |
//! | `POST /authority/adminUser/modifyManageAccounts` | `AdminUserController.modifyManageAccounts` | 登录 |
//! | `GET  /authority/adminUser/config` | `AdminUserController.getConfig` | `adminUserManage` / `shopAdminUserManageConfig` / `EmployeeManagement` |
//! | `GET  /authority/adminUser/getCode` | `AdminUserController.getCode` | 登录 |
//! | `POST /authority/adminUser/apiToken/generate` | `AdminUserController.generateApiToken` | 登录 |
//! | `GET  /authority/adminUser/apiToken/list` | `AdminUserController.listApiTokens` | 登录 |
//! | `POST /authority/adminUser/apiToken/revoke` | `AdminUserController.revokeApiToken` | 登录 |
//!
//! > **路径说明**：控制器前缀 `/adminapi/authority/adminUser` 与类名同名段
//! > `adminUser`，故契约路径里 `authority/adminUser` 是**真实组合结果**，不是笔误。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 product_manage / order_admin / aftersales / authority 的已知缺口一致）。上表权限列仅作对照。
//!
//! > **多租户说明**：Java 通过 `HeaderUtils.getAdminType()` / `getShopId()` /
//! > `getVendorId()`（请求头 `x-admin-type` / `x-shop-id` / `x-vendor-id`）
//! > 区分平台、店铺、门店、供应商账号。Rust 侧 `AuthUser` 已含 `admin_type`
//! > （JWT `typ`）但**没有** `shop_id` / `vendor_id`，故 `config` 端点：
//! > `adminType` 优先取请求头、其次查询参数、最后回退 JWT 的 `admin_type`；
//! > `shopId` / `vendorId` 取请求头（缺失时取同名查询参数）。
//!
//! > **⚠️ 合并注意**：`/authority/adminUser/list` 与 `/authority/adminUser/mineDetail`
//! > 这两条路径在 `crates/api/admin/src/lib.rs` 中**已存在一份引导阶段的内联实现**
//! > （`admin_user_list` / `mine_detail` + `implemented_routes()` 的 2 条 base 记录）。
//! > 合并本模块时必须**同时删除**那 2 条内联路由与 2 条 base 记录，
//! > 否则 axum 的 `Router::merge` 会因同一路径重复注册在启动时 panic。
//! > 本模块的 `mineDetail` 返回完整 `AdminUserDTO`（含 `authList` / `roleName` /
//! > `userShop`），与内联实现返回的 4 字段 `json!({...})` **出参形状不同**，
//! > 切换时需确认前端兼容（见 `uncertain_points`）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::identity::admin_user::{
    AdminApiTokenGenerateDTO, AdminApiTokenGenerateVO, AdminApiTokenVO, AdminRoleVO,
    AdminUserConfigQuery, AdminUserDTO, AdminUserIdQuery, AdminUserListQuery,
    AdminUserModifyManageAccountsDTO, BatchDTO, GetCodeQuery, OperateDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 管理员列表域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/authority/adminUser/list", get(list))
        .route("/authority/adminUser/mineDetail", get(mine_detail))
        .route("/authority/adminUser/detail", get(detail))
        .route("/authority/adminUser/create", post(create))
        .route("/authority/adminUser/update", post(update))
        .route("/authority/adminUser/del", post(del))
        .route("/authority/adminUser/batch", post(batch))
        .route(
            "/authority/adminUser/modifyManageAccounts",
            post(modify_manage_accounts),
        )
        .route("/authority/adminUser/config", get(config))
        .route("/authority/adminUser/getCode", get(get_code))
        .route(
            "/authority/adminUser/apiToken/generate",
            post(api_token_generate),
        )
        .route("/authority/adminUser/apiToken/list", get(api_token_list))
        .route(
            "/authority/adminUser/apiToken/revoke",
            post(api_token_revoke),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/authority/adminUser/list",
            "AdminUserController.list",
        ),
        (
            "GET",
            "/adminapi/authority/adminUser/mineDetail",
            "AdminUserController.mineDetail",
        ),
        (
            "GET",
            "/adminapi/authority/adminUser/detail",
            "AdminUserController.detail",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/create",
            "AdminUserController.create",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/update",
            "AdminUserController.update",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/del",
            "AdminUserController.del",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/batch",
            "AdminUserController.batch",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/modifyManageAccounts",
            "AdminUserController.modifyManageAccounts",
        ),
        (
            "GET",
            "/adminapi/authority/adminUser/config",
            "AdminUserController.getConfig",
        ),
        (
            "GET",
            "/adminapi/authority/adminUser/getCode",
            "AdminUserController.getCode",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/apiToken/generate",
            "AdminUserController.generateApiToken",
        ),
        (
            "GET",
            "/adminapi/authority/adminUser/apiToken/list",
            "AdminUserController.listApiTokens",
        ),
        (
            "POST",
            "/adminapi/authority/adminUser/apiToken/revoke",
            "AdminUserController.revokeApiToken",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 账号视角（替代 Java HeaderUtils）
// ——————————————————————————————————————————————

/// 读取请求头文本值（缺失或非 UTF-8 时返回 `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 解析当前请求的账号视角。
///
/// Java `BaseServiceImpl#getAdminType/getShopId/getVendorId` **只读请求头**；
/// Rust 侧 JWT 已含 `admin_type`，故 `adminType` 缺失时回退 JWT；
/// `shopId` / `vendorId` 额外接受同名查询参数（JWT 尚未签发这两个字段）。
fn resolve_admin_type(
    headers: &HeaderMap,
    auth: &AuthUser,
    fallback: Option<&str>,
) -> Option<String> {
    header_str(headers, "x-admin-type")
        .or_else(|| auth.admin_type.clone())
        .or_else(|| fallback.map(ToString::to_string))
}

// ——————————————————————————————————————————————
// 列表 / 详情
// ——————————————————————————————————————————————

/// `GET /adminapi/authority/adminUser/list`：管理员分页。
///
/// 对应 Java `AdminUserController.list(AdminUserPageQuery)`：控制器把
/// `AdminUserPageQuery extends BasePage` 作为查询参数直接绑定，
/// 过滤字段为 `suppliersId` / `adminUserType` / `keyword`。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<AdminUserListQuery>,
) -> ApiResult<PageResult<AdminUserDTO>> {
    ok(state
        .identity
        .admin_user
        .list(
            q.admin_user_type.as_deref(),
            q.keyword.as_deref(),
            q.suppliers_id.as_deref(),
            q.page,
            q.size,
            auth.scoped_shop_id(),
        )
        .await?)
}

// ——————————————————————————————————————————————
// 详情
// ——————————————————————————————————————————————

/// `GET /adminapi/authority/adminUser/mineDetail`：当前登录管理员详情。
///
/// 对应 Java `AdminUserController.mineDetail()` →
/// `adminUserService.detail(SecurityUtils.getCurrentAdminId())`。
async fn mine_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<AdminUserDTO> {
    ok(state.identity.admin_user.mine_detail(auth.id).await?)
}

/// 管理端租户校验：店铺账号只能操作本店管理员（`shop_id=0` 的平台管理员不可见）。
fn check_admin_scope(auth: &AuthUser, admin: &AdminUserDTO) -> Result<(), AppError> {
    auth.ensure_shop_access(admin.shop_id.unwrap_or(0))
        .map_err(AppError)
}

/// `GET /adminapi/authority/adminUser/detail?id=`：管理员详情。
///
/// 对应 Java `AdminUserController.detail(@RequestParam Integer id)`；
/// Java 显式 `detail.setPassword(null)`，本实现出参结构不含密码字段。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<AdminUserIdQuery>,
) -> ApiResult<AdminUserDTO> {
    let dto = state.identity.admin_user.detail(q.id).await?;
    check_admin_scope(&auth, &dto)?;
    ok(dto)
}

// ——————————————————————————————————————————————
// 增删改
// ——————————————————————————————————————————————

/// `POST /adminapi/authority/adminUser/create`：创建管理员。
///
/// 对应 Java `create(@RequestBody @Valid AdminUserDTO)`（原返回 `void`）。
/// 这里回传新建/复用的 `adminId`（`data` 由 `null` 变为数字），便于前端刷新。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<AdminUserDTO>,
) -> ApiResult<i32> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        dto.shop_id = Some(shop_id);
    }
    ok(state.identity.admin_user.create(&dto).await?)
}

/// `POST /adminapi/authority/adminUser/update`：更新管理员。
///
/// 对应 Java `update(@RequestBody @Valid AdminUserDTO)`（原返回 `void`）。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<AdminUserDTO>,
) -> ApiResult<&'static str> {
    if let Some(admin_id) = dto.admin_id {
        let current = state.identity.admin_user.detail(admin_id).await?;
        check_admin_scope(&auth, &current)?;
    }
    if let Some(shop_id) = auth.scoped_shop_id() {
        dto.shop_id = Some(shop_id);
    }
    state.identity.admin_user.update(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/authority/adminUser/del`：删除管理员。
///
/// 对应 Java `del(@RequestBody @Valid OperateDTO)`：拒绝删除当前登录账号与主账号。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    let current = state.identity.admin_user.detail(dto.id).await?;
    check_admin_scope(&auth, &current)?;
    state.identity.admin_user.del(dto.id, auth.id).await?;
    ok("删除成功")
}

/// `POST /adminapi/authority/adminUser/batch`：批量操作。
///
/// 对应 Java `batch(@RequestBody @Valid BatchDTO)`：仅 `type == "del"` 有副作用，
/// 逐个走 `adminUserDel`。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<&'static str> {
    for id in &dto.ids {
        let current = state.identity.admin_user.detail(*id).await?;
        check_admin_scope(&auth, &current)?;
    }
    state.identity.admin_user.batch(&dto, auth.id).await?;
    ok("操作成功")
}

/// `POST /adminapi/authority/adminUser/modifyManageAccounts`：修改当前管理员账号。
///
/// 对应 Java `modifyManageAccounts(@RequestBody AdminUserModifyManageAccountsDTO)`：
/// `modifyType` 为空时置 1。注意 `modifyType = 3/4`（换绑/验证手机号）
/// 依赖未迁移的 Redis 短信校验，会返回明确业务错误（见服务层注释）。
async fn modify_manage_accounts(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AdminUserModifyManageAccountsDTO>,
) -> ApiResult<&'static str> {
    state
        .identity
        .admin_user
        .modify_manage_accounts(&dto, auth.id)
        .await?;
    ok("操作成功")
}

// ——————————————————————————————————————————————
// 配置 / 验证码
// ——————————————————————————————————————————————

/// `GET /adminapi/authority/adminUser/config`：角色下拉配置。
///
/// 对应 Java `getConfig(@RequestParam(required = false) String adminType)`。
/// 注意：Java 的 `adminType` 参数**在方法体内未被使用**，实际分支由请求头
/// `x-admin-type`（`BaseServiceImpl#getAdminType()`）决定；本实现同样以
/// 请求头/JWT 为准，仅把查询参数作为最后兜底。
async fn config(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<AdminUserConfigQuery>,
) -> ApiResult<Vec<AdminRoleVO>> {
    let admin_type = resolve_admin_type(&headers, &auth, q.admin_type.as_deref());
    let effective = AdminUserConfigQuery {
        admin_type: admin_type.clone(),
        shop_id: header_str(&headers, "x-shop-id")
            .and_then(|v| v.parse::<i32>().ok())
            .or(q.shop_id),
        vendor_id: header_str(&headers, "x-vendor-id")
            .and_then(|v| v.parse::<i32>().ok())
            .or(q.vendor_id),
    };
    ok(state
        .identity
        .admin_user
        .get_config(&effective, admin_type.as_deref())
        .await?)
}

/// `GET /adminapi/authority/adminUser/getCode`：获取短信验证码。
///
/// 对应 Java `getCode(type, mobile, verifyToken)`。Java 返回 `void`；
/// 这里同样只回固定提示（不泄露验证码）。**短信服务未迁移**，
/// 通过前置校验后返回明确业务错误。
async fn get_code(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<GetCodeQuery>,
) -> ApiResult<&'static str> {
    state.identity.admin_user.get_code(&q, auth.id).await?;
    ok("验证码已发送")
}

// ——————————————————————————————————————————————
// API Token
// ——————————————————————————————————————————————

/// `POST /adminapi/authority/adminUser/apiToken/generate`：生成 API Token。
///
/// 对应 Java `generateApiToken(@RequestBody AdminApiTokenGenerateDTO)`：
/// 明文仅此一次返回。已存在 10 个有效 Token 时拒绝。
async fn api_token_generate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AdminApiTokenGenerateDTO>,
) -> ApiResult<AdminApiTokenGenerateVO> {
    ok(state
        .identity
        .admin_user
        .generate_api_token(auth.id, &dto)
        .await?)
}

/// `GET /adminapi/authority/adminUser/apiToken/list`：查询当前管理员的 Token 列表。
///
/// 对应 Java `listApiTokens()`（无参数，按当前登录管理员过滤）。
async fn api_token_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<Vec<AdminApiTokenVO>> {
    ok(state.identity.admin_user.list_api_tokens(auth.id).await?)
}

/// `POST /adminapi/authority/adminUser/apiToken/revoke`：吊销 API Token。
///
/// 对应 Java `revokeApiToken(@RequestBody @Valid OperateDTO)`：
/// 归属校验失败统一报 `Token不存在或无权操作`。
async fn api_token_revoke(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    state
        .identity
        .admin_user
        .revoke_api_token(dto.id, auth.id)
        .await?;
    ok("吊销成功")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由清单必须与契约逐字符一致。
    ///
    /// 注意契约里是 `authority/adminUser`（控制器前缀与类名重复段），
    /// 不是 `authority/user`。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/authority/adminUser/list"),
            ("GET", "/adminapi/authority/adminUser/mineDetail"),
            ("GET", "/adminapi/authority/adminUser/detail"),
            ("POST", "/adminapi/authority/adminUser/create"),
            ("POST", "/adminapi/authority/adminUser/update"),
            ("POST", "/adminapi/authority/adminUser/del"),
            ("POST", "/adminapi/authority/adminUser/batch"),
            ("POST", "/adminapi/authority/adminUser/modifyManageAccounts"),
            ("GET", "/adminapi/authority/adminUser/config"),
            ("GET", "/adminapi/authority/adminUser/getCode"),
            ("POST", "/adminapi/authority/adminUser/apiToken/generate"),
            ("GET", "/adminapi/authority/adminUser/apiToken/list"),
            ("POST", "/adminapi/authority/adminUser/apiToken/revoke"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len());
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
    }

    /// 挂载路径 = 契约路径去掉 `/adminapi` 前缀。
    #[test]
    fn mounted_paths_are_contract_paths_minus_prefix() {
        for doc in implemented_routes() {
            let mounted = doc
                .path
                .strip_prefix("/adminapi")
                .expect("契约路径应以 /adminapi 开头");
            assert!(mounted.starts_with("/authority/adminUser/"));
            assert!(!mounted.ends_with('/'));
        }
    }

    #[test]
    fn list_query_accepts_java_param_names() {
        let q: AdminUserListQuery = serde_json::from_str(
            r#"{"adminUserType":"shop","suppliersId":"7","keyword":"root","page":2,"size":30}"#,
        )
        .unwrap();
        assert_eq!(q.admin_user_type.as_deref(), Some("shop"));
        assert_eq!(q.suppliers_id.as_deref(), Some("7"));
        assert_eq!(q.keyword.as_deref(), Some("root"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));

        // 全缺省
        let q: AdminUserListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.admin_user_type, None);
        assert_eq!(q.page, None);
    }

    #[test]
    fn resolve_admin_type_prefers_header_then_jwt_then_query() {
        let auth = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: Some(1),
            admin_type: Some("shop".into()),
            shop_id: None,
        };
        // 无请求头 → 回退 JWT
        let headers = HeaderMap::new();
        assert_eq!(
            resolve_admin_type(&headers, &auth, Some("vendor")).as_deref(),
            Some("shop")
        );
        // 无请求头且 JWT 无类型 → 回退查询参数
        let anon = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: None,
            shop_id: None,
        };
        assert_eq!(
            resolve_admin_type(&headers, &anon, Some("vendor")).as_deref(),
            Some("vendor")
        );
        assert_eq!(resolve_admin_type(&headers, &anon, None), None);
    }

    #[test]
    fn header_str_ignores_blank_and_non_utf8() {
        let mut headers = HeaderMap::new();
        assert_eq!(header_str(&headers, "x-admin-type"), None);
        headers.insert("x-admin-type", "  admin  ".parse().unwrap());
        assert_eq!(
            header_str(&headers, "x-admin-type").as_deref(),
            Some("admin")
        );
        headers.insert("x-admin-type", "   ".parse().unwrap());
        assert_eq!(header_str(&headers, "x-admin-type"), None);
    }
}
