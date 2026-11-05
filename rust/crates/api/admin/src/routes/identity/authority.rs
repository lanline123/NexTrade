//! 管理端权限管理路由（identity::authority）。
//! 对应原 Java `com.tigshop.adminapi.controller.authority.AuthorityController`
//! （`@RequestMapping("/adminapi/authority/authority")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /authority/authority/getAllAuthority` | `AuthorityController.getAllAuthority` | 登录 |
//! | `GET  /authority/authority/getAuthority` | `AuthorityController.getAuthority` | 登录 |
//! | `GET  /authority/authority/list` | `AuthorityController.list` | 登录 |
//! | `GET  /authority/authority/getAuthorityParentName` | `AuthorityController.getAuthorityParentName` | 登录 |
//! | `POST /authority/authority/batch` | `AuthorityController.batch` | `authorityBatchManage` |
//! | `POST /authority/authority/create` | `AuthorityController.create` | `authorityUpdateManage` |
//! | `POST /authority/authority/del` | `AuthorityController.del` | `authorityDelManage` |
//! | `GET  /authority/authority/detail` | `AuthorityController.detail` | 登录 |
//! | `POST /authority/authority/update` | `AuthorityController.update` | `authorityUpdateManage` |
//! | `POST /authority/authority/updateField` | `AuthorityController.updateField` | `authorityUpdateManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/authority/authority` 与类名同名，
//! > 故出现 `authority/authority` 重复一段，与 Java `@RequestMapping`
//! > 组合结果**逐字符一致**，不是笔误。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 product_manage / order_admin / seckill.rs 的已知缺口一致）。上表权限列仅作对照记录。
//!
//! > **多租户说明**：Java 通过请求头 `x-admin-type` / `x-shop-id` / `x-vendor-id`
//! > （`HeaderUtils`）区分平台、店铺、门店、供应商账号。Rust 侧 `AuthUser`
//! > 已含 `admin_type`（JWT `typ`）但**没有** `shop_id` / `vendor_id`。
//! > 因此本模块在 `getAllAuthority` / `getAuthority` 上接受可选的
//! > `shopId` / `vendorId` 查询参数**替代请求头**；缺省时按 JWT 的
//! > `admin_type` 走平台/账号视角。详见 `uncertain_points`。
//!
//! > **返回结构说明**：`getAllAuthority` 原返回 `List<Tree<Integer>>`，
//! > `getAuthority` 原返回 `List<Authority>`，`list` 原返回 MyBatis-Plus
//! > `Page<AuthorityDTO>`（`records/total/size/current/pages`）。
//! > Rust 侧 `list` 统一使用项目既有 `PageResult`
//! > （`list/total/totalPage/pageSize/page`），与其它切片一致。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::identity::authority::{
    AuthorityContext, AuthorityDTO, AuthorityListQuery, AuthorityTreeNode, AuthorityVO, BatchDTO,
    OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 权限管理域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/authority/authority/getAllAuthority",
            get(get_all_authority),
        )
        .route("/authority/authority/getAuthority", get(get_authority))
        .route("/authority/authority/list", get(list))
        .route(
            "/authority/authority/getAuthorityParentName",
            get(get_authority_parent_name),
        )
        .route("/authority/authority/batch", post(batch))
        .route("/authority/authority/create", post(create))
        .route("/authority/authority/del", post(del))
        .route("/authority/authority/detail", get(detail))
        .route("/authority/authority/update", post(update))
        .route("/authority/authority/updateField", post(update_field))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/authority/authority/getAllAuthority",
            "AuthorityController.getAllAuthority",
        ),
        (
            "GET",
            "/adminapi/authority/authority/getAuthority",
            "AuthorityController.getAuthority",
        ),
        (
            "GET",
            "/adminapi/authority/authority/list",
            "AuthorityController.list",
        ),
        (
            "GET",
            "/adminapi/authority/authority/getAuthorityParentName",
            "AuthorityController.getAuthorityParentName",
        ),
        (
            "POST",
            "/adminapi/authority/authority/batch",
            "AuthorityController.batch",
        ),
        (
            "POST",
            "/adminapi/authority/authority/create",
            "AuthorityController.create",
        ),
        (
            "POST",
            "/adminapi/authority/authority/del",
            "AuthorityController.del",
        ),
        (
            "GET",
            "/adminapi/authority/authority/detail",
            "AuthorityController.detail",
        ),
        (
            "POST",
            "/adminapi/authority/authority/update",
            "AuthorityController.update",
        ),
        (
            "POST",
            "/adminapi/authority/authority/updateField",
            "AuthorityController.updateField",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/authority/authority/getAllAuthority`：当前账号可见权限（树）。
///
/// 对应 Java `AuthorityController.getAllAuthority(@RequestParam(type),
/// @RequestParam(adminType))`。
///
/// `type` 在 Java 中的分支逻辑**已被注释掉**（`convertTreeList` 里 `type == 1`
/// 的整段是死代码），因此 Rust 侧同样接收但忽略。
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct AllAuthorityQuery {
    /// Java 参数 `type`（源码中已废弃，无副作用）
    #[serde(rename = "type")]
    _type: Option<i32>,
    /// Java 参数 `adminType`（仅平台账号生效，用于切换目标 admin_type）
    admin_type: Option<String>,
    /// Rust 侧替代请求头 `x-shop-id`（Java `HeaderUtils.getShopId()`）
    shop_id: Option<i32>,
    /// Rust 侧替代请求头 `x-vendor-id`（Java `HeaderUtils.getVendorId()`）
    vendor_id: Option<i32>,
}

async fn get_all_authority(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<AllAuthorityQuery>,
) -> ApiResult<Option<Vec<AuthorityTreeNode>>> {
    let ctx = context_from(&auth, q.shop_id, q.vendor_id);
    ok(state
        .identity
        .authority
        .get_all_authority(&ctx, q.admin_type.as_deref())
        .await?)
}

/// `GET /adminapi/authority/authority/getAuthority`：当前账号权限列表（扁平实体）。
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct GetAuthorityQuery {
    shop_id: Option<i32>,
    vendor_id: Option<i32>,
}

async fn get_authority(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<GetAuthorityQuery>,
) -> ApiResult<Vec<AuthorityVO>> {
    let ctx = context_from(&auth, q.shop_id, q.vendor_id);
    ok(state.identity.authority.get_authority(&ctx).await?)
}

/// `GET /adminapi/authority/authority/list`：权限分页。
///
/// 对应 Java `AuthorityController.list(AuthorityListDTO authority)`
/// （`AuthorityListDTO extends BasePage`，缺省 `page=1` / `size=15`，上限 100）。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<AuthorityListQuery>,
) -> ApiResult<PageResult<AuthorityDTO>> {
    ok(state.identity.authority.list(&q).await?)
}

/// `GET /adminapi/authority/authority/getAuthorityParentName?id=`：父级权限名称。
///
/// 对应 Java `getAuthorityParentName(@RequestParam("id") @NotNull Integer id)`。
/// Java 原实现因 `select` 漏掉 `parent_id` 而**恒返回 `null`**（详见服务层注释）；
/// Rust 侧按接口意图返回真实父级名称。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

async fn get_authority_parent_name(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<String>> {
    ok(state
        .identity
        .authority
        .get_authority_parent_name(q.id)
        .await?)
}

/// 权限目录是平台级元数据：只有平台账号可增删改，店铺账号只能读取自身菜单。
fn ensure_platform(auth: &AuthUser) -> Result<(), AppError> {
    if auth.is_platform() {
        Ok(())
    } else {
        Err(AppError(tigshop_core::Error::Forbidden(
            "店铺账号无权修改平台权限目录".into(),
        )))
    }
}

/// `POST /adminapi/authority/authority/batch`：批量操作。
///
/// 对应 Java `batch(@RequestBody BatchDTO batch)`：
/// `type == "del"` 走批量删除（`batchDel`），否则 `BaseServiceImpl#batch`
/// 对非 `del` 类型直接返回 `false`（无副作用）。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<&'static str> {
    ensure_platform(&auth)?;
    state.identity.authority.batch(&dto).await?;
    ok("操作成功")
}

/// `POST /adminapi/authority/authority/create`：创建权限。
///
/// 对应 Java `create(@RequestBody AuthorityDTO authority)`（原返回 `void`）。
/// 这里回传新建主键便于前端/运维使用（`data` 由 `null` 变为数字）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AuthorityDTO>,
) -> ApiResult<i32> {
    ensure_platform(&auth)?;
    ok(state.identity.authority.create(&dto).await?)
}

/// `POST /adminapi/authority/authority/del`：删除权限。
///
/// 对应 Java `del(@RequestBody OperateDTO operate)`：
/// 先校验「不能有子级」（`error.authority.has.children`），再删除。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    ensure_platform(&auth)?;
    state.identity.authority.del(dto.id).await?;
    ok("删除成功")
}

/// `GET /adminapi/authority/authority/detail?id=`：权限详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<AuthorityDTO> {
    ok(state.identity.authority.detail(q.id).await?)
}

/// `POST /adminapi/authority/authority/update`：更新权限。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AuthorityDTO>,
) -> ApiResult<&'static str> {
    ensure_platform(&auth)?;
    state.identity.authority.update(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/authority/authority/updateField`：更新权限单字段。
///
/// 对应 Java `updateField(@RequestBody @Valid UpdateFieldDTO updateField)`，
/// 白名单为 `CheckFieldConstants.AUTHORITY_FIELDS`
/// （`authority_name` / `authority_sn` / `route_link` / `is_show` / `sort_order`）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    ensure_platform(&auth)?;
    state.identity.authority.update_field(&dto).await?;
    ok("更新成功")
}

/// 由 JWT 身份 + 可选查询参数构造权限上下文。
///
/// Java 的 `x-shop-id` / `x-vendor-id` 请求头在 Rust 侧尚未签发，
/// 故用查询参数替代（见模块头「多租户说明」）。
fn context_from(auth: &AuthUser, shop_id: Option<i32>, vendor_id: Option<i32>) -> AuthorityContext {
    let (shop_id, vendor_id) = match auth.scoped_shop_id() {
        Some(scope) => (Some(scope), None),
        None => (shop_id.filter(|v| *v != 0), vendor_id.filter(|v| *v != 0)),
    };
    AuthorityContext {
        admin_id: auth.id,
        admin_type: auth.admin_type.clone(),
        shop_id,
        vendor_id,
        // Rust JWT 未携带权限编号集合；服务层会回退读取
        // `admin_user.auth_list`（Java 登录时装载的同一份数据）。
        granted: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由清单必须与任务书逐字符一致（含 `authority/authority` 重复段）。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/authority/authority/getAllAuthority"),
            ("GET", "/adminapi/authority/authority/getAuthority"),
            ("GET", "/adminapi/authority/authority/list"),
            (
                "GET",
                "/adminapi/authority/authority/getAuthorityParentName",
            ),
            ("POST", "/adminapi/authority/authority/batch"),
            ("POST", "/adminapi/authority/authority/create"),
            ("POST", "/adminapi/authority/authority/del"),
            ("GET", "/adminapi/authority/authority/detail"),
            ("POST", "/adminapi/authority/authority/update"),
            ("POST", "/adminapi/authority/authority/updateField"),
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
            assert!(mounted.starts_with("/authority/authority/"));
            assert!(!mounted.ends_with('/'));
        }
    }

    #[test]
    fn context_from_ignores_zero_scope_ids() {
        let auth = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: Some(2),
            admin_type: Some("admin".into()),
            shop_id: None,
        };
        let ctx = context_from(&auth, Some(0), None);
        assert_eq!(ctx.admin_id, 1);
        assert_eq!(ctx.shop_id, None);
        assert_eq!(ctx.vendor_id, None);
        assert_eq!(ctx.admin_type.as_deref(), Some("admin"));
        assert!(ctx.granted.is_empty());

        let ctx = context_from(&auth, Some(3), Some(9));
        assert_eq!(ctx.shop_id, Some(3));
        assert_eq!(ctx.vendor_id, Some(9));
    }

    #[test]
    fn all_authority_query_accepts_java_param_names() {
        let q: AllAuthorityQuery =
            serde_json::from_str(r#"{"type":1,"adminType":"shop","shopId":4}"#).unwrap();
        assert_eq!(q._type, Some(1));
        assert_eq!(q.admin_type.as_deref(), Some("shop"));
        assert_eq!(q.shop_id, Some(4));
        // 全缺省
        let q: AllAuthorityQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q._type, None);
        assert_eq!(q.admin_type, None);
    }
}
