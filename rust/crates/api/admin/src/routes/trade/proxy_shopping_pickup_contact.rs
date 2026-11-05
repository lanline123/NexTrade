//! 管理端代客下单自提联系人管理路由（trade::proxy_shopping_pickup_contact）。
//! 对应原 Java `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingPickupContactController`
//! （`@RequestMapping("/adminapi/proxyShopping/pickupContact")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi` 下） | 原 Java | 权限 |
//! |-----------------------------------|--------|------|
//! | `POST /proxyShopping/pickupContact/list`         | `ProxyShoppingPickupContactController.list`         | `proxyShoppingManage` |
//! | `GET  /proxyShopping/pickupContact/listByUserId` | `ProxyShoppingPickupContactController.listByUserId` | `proxyShoppingManage` |
//! | `GET  /proxyShopping/pickupContact/detail`       | `ProxyShoppingPickupContactController.detail`       | `proxyShoppingManage` |
//! | `POST /proxyShopping/pickupContact/create`       | `ProxyShoppingPickupContactController.create`       | `proxyShoppingManage` |
//! | `POST /proxyShopping/pickupContact/update`       | `ProxyShoppingPickupContactController.update`       | `proxyShoppingManage` |
//! | `POST /proxyShopping/pickupContact/del`          | `ProxyShoppingPickupContactController.del`          | `proxyShoppingManage` |
//!
//! 完整路径 = 控制器前缀 `/adminapi/proxyShopping/pickupContact` + 方法级
//! `/list` 等。注意 `proxyShopping`（**S 大写**）与 `pickupContact`
//! （**C 大写**）大小写必须逐字符照抄；URL 里 `proxyShopping` 只出现一次，
//! **不存在**「控制器前缀重复」的写法。
//!
//! > **参数位置说明**：`list` / `create` / `update` 用 `@RequestBody`
//! > → Rust 侧 `Json<T>`；`listByUserId` / `detail` / `del` 用
//! > `@RequestParam` → Rust 侧 `Query<T>`（**即使 `del` 是 POST**，
//! > Java 也只从 query / form 取 `id`，不从 JSON body 取；
//! > 与 product_stock 的 `POST /product/stock/auditAllocate` 同一约定）。
//!
//! > **权限说明**：Java 在控制器**类**上标
//! > `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")`，
//! > 对 6 条接口全部生效；Rust 侧 `require_auth`
//! > （由 `api/admin/src/lib.rs::router` 统一套在 `/adminapi` 子树外层）
//! > 只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / buyer_show_group.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! > **返回结构说明**：
//! > - `list` Java 返回 MyBatis-Plus `Page<PickupContactVO>`
//! >   （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! >   `PageResult`（`list/total/totalPage/pageSize/page`）；
//! > - `listByUserId` Java 返回 `List<PickupContactVO>`，此处保持数组；
//! > - `detail` Java 返回 `PickupContactVO`，此处保持一致；
//! > - `create` Java 返回新建主键 `Long`，此处回传 `i64`；
//! > - `update` / `del` Java 返回 `boolean`，此处保持一致。
//!
//! > **未迁移**：`tigshop.is-demo` 配置开关（`@Sensitive(PHONE)` 脱敏只在
//! > 演示站生效）由 `services::tigshop_core::models::trade::proxy_shopping_pickup_contact::IS_DEMO` 常量承载，详见该模块头。
//!
//! 服务层实现见 [`tigshop_services::trade::proxy_shopping_pickup_contact::ProxyShoppingPickupContactService`]。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::trade::proxy_shopping_pickup_contact::{
    PickupContactCreateDTO, PickupContactIdQuery, PickupContactListQuery, PickupContactUpdateDTO,
    PickupContactUserIdQuery, PickupContactVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};
use tigshop_services::trade::proxy_shopping_pickup_contact::{require_id, require_user_id};

use crate::AdminState;

/// 本域 6 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源；顺序与原 Java
/// `ProxyShoppingPickupContactController` 的声明顺序一致。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "POST",
        "/proxyShopping/pickupContact/list",
        "ProxyShoppingPickupContactController.list",
    ),
    (
        "GET",
        "/proxyShopping/pickupContact/listByUserId",
        "ProxyShoppingPickupContactController.listByUserId",
    ),
    (
        "GET",
        "/proxyShopping/pickupContact/detail",
        "ProxyShoppingPickupContactController.detail",
    ),
    (
        "POST",
        "/proxyShopping/pickupContact/create",
        "ProxyShoppingPickupContactController.create",
    ),
    (
        "POST",
        "/proxyShopping/pickupContact/update",
        "ProxyShoppingPickupContactController.update",
    ),
    (
        "POST",
        "/proxyShopping/pickupContact/del",
        "ProxyShoppingPickupContactController.del",
    ),
];

/// 代客下单自提联系人域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/proxyShopping/pickupContact")` +
/// `@PostMapping` / `@GetMapping` 的方法级路径。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/proxyShopping/pickupContact/list",
            post(pickup_contact_list),
        )
        .route(
            "/proxyShopping/pickupContact/listByUserId",
            get(pickup_contact_list_by_user_id),
        )
        .route(
            "/proxyShopping/pickupContact/detail",
            get(pickup_contact_detail),
        )
        .route(
            "/proxyShopping/pickupContact/create",
            post(pickup_contact_create),
        )
        .route(
            "/proxyShopping/pickupContact/update",
            post(pickup_contact_update),
        )
        .route("/proxyShopping/pickupContact/del", post(pickup_contact_del))
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

/// `POST /adminapi/proxyShopping/pickupContact/list`：自提联系人分页列表。
///
/// 对应 Java `ProxyShoppingPickupContactController.list(@RequestBody
/// PickupContactListDTO listDTO)`（`ProxyShoppingPickupContactController.java:28-32`）
/// → `PickupContactServiceImpl#list`。
/// `userId` 精确过滤；`keyword` 同时模糊匹配 `contact_name` 与 `contact_phone`。
async fn pickup_contact_list(
    State(state): State<AdminState>,
    Json(dto): Json<PickupContactListQuery>,
) -> ApiResult<PageResult<PickupContactVO>> {
    ok(state.trade.proxy_shopping_pickup_contact.list(&dto).await?)
}

/// `GET /adminapi/proxyShopping/pickupContact/listByUserId?userId=`：
/// 根据用户ID获取自提联系人列表。
///
/// 对应 Java `ProxyShoppingPickupContactController.listByUserId(@RequestParam("userId")
/// Integer userId)`（`ProxyShoppingPickupContactController.java:34-38`）→
/// `PickupContactServiceImpl#listByUserId`（`eq(userId)` + `ORDER BY id DESC`）。
/// `userId` 是**必填** `@RequestParam`，缺失时 Java 回 1001「接口参数缺失」。
async fn pickup_contact_list_by_user_id(
    State(state): State<AdminState>,
    Query(q): Query<PickupContactUserIdQuery>,
) -> ApiResult<Vec<PickupContactVO>> {
    let user_id = require_user_id(q.user_id)?;
    ok(state
        .trade
        .proxy_shopping_pickup_contact
        .list_by_user_id(user_id)
        .await?)
}

/// `GET /adminapi/proxyShopping/pickupContact/detail?id=`：自提联系人详情。
///
/// 对应 Java `ProxyShoppingPickupContactController.detail(@RequestParam("id")
/// Long id)`（`ProxyShoppingPickupContactController.java:40-44`）→
/// `PickupContactServiceImpl#detail`（`getById`，带 `@TableLogic` 的
/// `is_del = 0`；查不到抛 `GlobalException("自提联系人不存在")` → 1001）。
async fn pickup_contact_detail(
    State(state): State<AdminState>,
    Query(q): Query<PickupContactIdQuery>,
) -> ApiResult<PickupContactVO> {
    let id = require_id(q.id)?;
    ok(state.trade.proxy_shopping_pickup_contact.detail(id).await?)
}

/// `POST /adminapi/proxyShopping/pickupContact/create`：创建自提联系人。
///
/// 对应 Java `ProxyShoppingPickupContactController.create(@RequestBody
/// PickupContactCreateDTO createDTO)`（`ProxyShoppingPickupContactController.java:46-50`）
/// → `PickupContactServiceImpl#create`。
/// Java 返回新建主键（`Long`），此处回传同一语义的 `i64`。
async fn pickup_contact_create(
    State(state): State<AdminState>,
    Json(dto): Json<PickupContactCreateDTO>,
) -> ApiResult<i64> {
    ok(state
        .trade
        .proxy_shopping_pickup_contact
        .create(&dto)
        .await?)
}

/// `POST /adminapi/proxyShopping/pickupContact/update`：修改自提联系人。
///
/// 对应 Java `ProxyShoppingPickupContactController.update(@RequestBody
/// PickupContactUpdateDTO updateDTO)`（`ProxyShoppingPickupContactController.java:52-56`）
/// → `PickupContactServiceImpl#update`。
/// 记录不存在（含已逻辑删除）→ 1001「自提联系人不存在」；
/// 返回 `updateById` 的布尔结果。
async fn pickup_contact_update(
    State(state): State<AdminState>,
    Json(dto): Json<PickupContactUpdateDTO>,
) -> ApiResult<bool> {
    ok(state
        .trade
        .proxy_shopping_pickup_contact
        .update(&dto)
        .await?)
}

/// `POST /adminapi/proxyShopping/pickupContact/del?id=`：删除自提联系人。
///
/// 对应 Java `ProxyShoppingPickupContactController.del(@RequestParam("id")
/// Long id)`（`ProxyShoppingPickupContactController.java:58-62`）→
/// `PickupContactServiceImpl#del`：`removeById` 是**逻辑删除**
/// （`@TableLogic` → `UPDATE ... SET is_del = 1`），返回是否删掉了一行。
/// ⚠️ `id` 从 **query** 取（Java `@RequestParam`），不是 JSON body。
async fn pickup_contact_del(
    State(state): State<AdminState>,
    Query(q): Query<PickupContactIdQuery>,
) -> ApiResult<bool> {
    let id = require_id(q.id)?;
    ok(state
        .trade
        .proxy_shopping_pickup_contact
        .delete(Some(id))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 6 条路由必须逐字符覆盖契约里的路径（含 `proxyShopping` 的 S 与
    /// `pickupContact` 的 C 大小写）。
    #[test]
    fn implemented_routes_match_contract_paths_verbatim() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6);

        let expected = [
            ("POST", "/adminapi/proxyShopping/pickupContact/list"),
            ("GET", "/adminapi/proxyShopping/pickupContact/listByUserId"),
            ("GET", "/adminapi/proxyShopping/pickupContact/detail"),
            ("POST", "/adminapi/proxyShopping/pickupContact/create"),
            ("POST", "/adminapi/proxyShopping/pickupContact/update"),
            ("POST", "/adminapi/proxyShopping/pickupContact/del"),
        ];
        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        for (method, path) in expected {
            assert!(
                actual.contains(&(method.to_string(), path.to_string())),
                "缺少路由 {method} {path}，实际: {actual:?}"
            );
        }
    }

    /// 路由表内的路径必须与 `routes()` 注册的路径一致（防「改了 route 忘了
    /// 改 ROUTE_TABLE」导致覆盖率统计虚高）。
    #[test]
    fn route_table_paths_are_prefixed_with_proxy_shopping() {
        for (_, path, java_ref) in ROUTE_TABLE {
            assert!(
                path.starts_with("/proxyShopping/pickupContact/"),
                "路径前缀不符: {path}"
            );
            assert!(
                java_ref.starts_with("ProxyShoppingPickupContactController."),
                "Java 参照不符: {java_ref}"
            );
        }
    }

    /// `del` 是 POST 但参数在 query 上 —— 契约里 method 必须是 POST。
    #[test]
    fn del_is_post_with_query_param() {
        let doc = ROUTE_TABLE
            .iter()
            .find(|(_, path, _)| *path == "/proxyShopping/pickupContact/del")
            .expect("del 路由必须存在");
        assert_eq!(doc.0, "POST");
    }
}
