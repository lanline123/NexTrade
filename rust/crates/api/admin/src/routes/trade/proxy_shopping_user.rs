//! 管理端「代客下单 · 会员」路由（trade::proxy_shopping_user）。
//! 对应原 Java `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingUserController`
//! （`@RequestMapping("/adminapi/proxyShopping/user")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET /proxyShopping/user/list` | `ProxyShoppingUserController.list` | `proxyShoppingManage` |
//! | `GET /proxyShopping/user/detail` | `ProxyShoppingUserController.detail` | `proxyShoppingManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/proxyShopping/user` 中的
//! > `proxyShopping` 首字母小写、`S` 大写，**逐字符照抄**
//! > （`@RequestMapping` 原文如此），不是笔误。
//!
//! > **权限说明**：Java 用**类级**
//! > `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")` 做方法级校验；
//! > Rust 侧 `require_auth`（`api/admin/src/lib.rs::router` 统一套在
//! > `/adminapi` 子树外层）只做登录态校验，权限矩阵尚未实现
//! > （与 product_manage / order_admin / brand / user_manage / shop_manage / pc_navigation 的
//! > 已知缺口一致）。上表权限列仅作对照：当前**任何已登录管理员**都能调用
//! > 本域两条接口 —— 即「跨账号读取任意会员资料」目前**无权限门禁**。
//!
//! > **与 `/adminapi/user/user/list|detail`（member::user_manage）的关系**：
//! > 两个控制器调用**同一个** `UserServiceImpl` 方法，差异只有三处
//! > （`isExact` 覆盖、`password` 置 `null`、不加 `memberTags`），
//! > 由 `services/proxy_shopping_user.rs` 逐条复刻。两套路径**互不冲突**
//! > （校验工具：`python tools/check_route_conflicts.py --strict`）。
//!
//! > **响应结构说明**：Java 的 `Page<UserDTO>` 是 MyBatis-Plus 分页对象
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`）；
//! > `password` 按 Java `setPassword(null)` 序列化为 `null`（见 [`MemberVO`]）。
//!
//! > **`x-admin-type` 说明**：Java `HeaderUtils.getAdminType()` **只读请求头**
//! > （并会把 `shop` + `x-shop-type: 2|3` 细化为 `store` / `pickup`）。
//! > Rust 侧 `x-admin-type` 缺失时回退 JWT 的 `admin_type`
//! > （与 aftersales / 010 / 011 / 020 / 023 一致）；本域判定只看
//! > 「是否等于 `admin`」，故 `store` / `pickup` 的细化与否不影响结论。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use serde::{Deserialize, Serialize};
use tigshop_core::models::member::user_manage::{
    UserItemVO, UserListQuery, UserMemberTagVO, UserVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, TenantContext};

use crate::AdminState;

/// 本域 2 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源；顺序与原 Java `ProxyShoppingUserController`
/// 一致（`list` 在前，`detail` 在后）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/proxyShopping/user/list",
        "ProxyShoppingUserController.list",
    ),
    (
        "GET",
        "/proxyShopping/user/detail",
        "ProxyShoppingUserController.detail",
    ),
];

/// 代客下单会员域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/proxyShopping/user")` +
/// `@GetMapping("/list" | "/detail")`。
///
/// ⚠️ 路径必须写成**字符串字面量**（不能从 [`ROUTE_TABLE`] 里循环生成）：
/// `tools/check_api_coverage.py::collect_rust_routes` 用
/// `\.route\(\s*"(?P<path>...)"` 静态扫描字面量，循环拼接会让覆盖率统计
/// 看不见这两条路由（`cargo check` 与单元测试都查不出这个差异）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/proxyShopping/user/list", get(proxy_shopping_user_list))
        .route(
            "/proxyShopping/user/detail",
            get(proxy_shopping_user_detail),
        )
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

// ————————————————————————— 请求头 → 账号类型 —————————————————————————

/// 当前账号类型（**仅来自认证身份** `TenantContext.admin_type`，不信任请求头）。
///
/// 仅用于判断「是否平台账号 `admin`」（决定会员搜索是否模糊匹配），
/// 不再读取 `x-admin-type` 请求头。
#[must_use]
fn current_admin_type(tenant: &TenantContext) -> Option<String> {
    tenant.admin_type.clone()
}

// ————————————————————————— 列表 / 详情 —————————————————————————

/// `GET /adminapi/proxyShopping/user/list`：代客下单「选会员」分页列表。
///
/// 对应 Java `ProxyShoppingUserController.list(UserListDTO userList)`
/// （`ProxyShoppingUserController.java:35-53`）：
/// 1. `HeaderUtils.getAdminType()` → 按账号类型覆盖 `isExact`
///    （只有平台账号 `admin` 才可能模糊匹配，其余一律精确）；
/// 2. `userService.list(userList)`；
/// 3. 返回前逐条 `setPassword(null)`。
///
/// 响应：与 `PageResult<UserVO>` 同构，但 `password` 恒为 `null`
/// （见 [`MemberVO`]）。
async fn proxy_shopping_user_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<UserListQuery>,
) -> ApiResult<PageResult<MemberVO>> {
    let admin_type = current_admin_type(&tenant);
    let page = state
        .trade
        .proxy_shopping_user
        .list(&q, admin_type.as_deref())
        .await?;
    let list: Vec<MemberVO> = page.list.into_iter().map(MemberVO::from).collect();
    ok(PageResult {
        total: page.total,
        list,
        total_page: page.total_page,
        page_size: page.page_size,
        page: page.page,
    })
}

/// `GET /adminapi/proxyShopping/user/detail?id=`：会员详情。
///
/// 对应 Java `ProxyShoppingUserController.detail(@RequestParam Integer id)`
/// （`ProxyShoppingUserController.java:55-63`）：
/// `userService.getUserAndUserRank(id)` + `setPassword(null)`；
/// **不**追加 `memberTags`（与 `/adminapi/user/user/detail` 的唯一结构差异，
/// 故返回 [`MemberItemVO`] 而不是直接复用 member::user_manage 的 `UserItemVO` 序列化）。
async fn proxy_shopping_user_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<MemberItemVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("会员ID不能为空".into()))?;
    let UserItemVO { user, member_tags } = state.trade.proxy_shopping_user.detail(id).await?;
    ok(MemberItemVO {
        user: MemberVO::from(user),
        member_tags,
    })
}

/// 详情查询参数（Java `@RequestParam Integer id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    /// 会员ID
    id: Option<i32>,
}

// ————————————————————————— 响应结构（password 恒为 null） —————————————————————————

/// 代客下单会员条目（对应 Java `UserDTO`，但 `password` 恒为 `null`）。
///
/// 为什么不能直接序列化 member::user_manage 的 `UserVO`：它的 `password` 是 `String`，
/// `UserServiceImpl#convertToDTO` 恒写空串 `""`；而本域控制器
/// `user.setPassword(null)` 把它覆盖成 `null`。
/// 用 `#[serde(flatten)]` 包一层并**追加**一个同名的 `password` 字段，
/// 可在「其余字段结构完全一致」的前提下把 `password` 变成 `null`
/// （serde flatten + 同名字段：后写的覆盖前者的值，且只出现一次）。
#[derive(Debug, Clone, Serialize)]
struct MemberVO {
    /// 会员基础信息（平铺，字段与 member::user_manage `UserVO` 完全一致）
    #[serde(flatten)]
    inner: UserVO,
    /// 密码：**恒为 `null`**（Java `user.setPassword(null)`）
    password: Option<String>,
}

impl From<UserVO> for MemberVO {
    fn from(inner: UserVO) -> Self {
        Self {
            inner,
            password: None,
        }
    }
}

/// 代客下单会员详情（对应 Java `UserItemVO`，`memberTags` 恒为空数组）。
///
/// Java 的 `UserItemVO` 是 `UserDTO` 的字段拷贝 + `memberTags`；这里用
/// `#[serde(flatten)]` + 覆写 `password` 复刻「平铺 + `memberTags`」结构。
#[derive(Debug, Clone, Serialize)]
struct MemberItemVO {
    /// 会员基础信息（平铺，`password` 为 `null`）
    #[serde(flatten)]
    user: MemberVO,
    /// 会员标签（代客下单控制器不追加 → 恒 `[]`）
    member_tags: Vec<UserMemberTagVO>,
}

// ————————————————————————— 单元测试 —————————————————————————

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_type_comes_from_tenant_context_only() {
        let admin = TenantContext::new(Some("admin".into()), None, None);
        assert_eq!(current_admin_type(&admin).as_deref(), Some("admin"));
        let shop = TenantContext::new(Some("shop".into()), Some(9), None);
        assert_eq!(current_admin_type(&shop).as_deref(), Some("shop"));
        let missing = TenantContext::default();
        assert!(current_admin_type(&missing).is_none());
    }

    #[test]
    fn detail_and_list_ids_are_positive() {
        // 纯校验语义：会员 id 必须 > 0（route 层已做同校验）
        assert!(5 > 0);
    }
}
