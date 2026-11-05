//! 代客下单 · 收货地址管理路由（trade::proxy_shopping_user_address）。
//!
//! 对应原 Java
//! `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingUserAddressController`
//! （`@RequestMapping("/adminapi/proxyShopping/address")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `POST /adminapi/proxyShopping/address/list` | `ProxyShoppingUserAddressController.list` | `proxyShoppingManage` |
//! | `POST /adminapi/proxyShopping/address/create` | `ProxyShoppingUserAddressController.create` | `proxyShoppingManage` |
//! | `POST /adminapi/proxyShopping/address/update` | `ProxyShoppingUserAddressController.update` | `proxyShoppingManage` |
//! | `POST /adminapi/proxyShopping/address/setSelected` | `ProxyShoppingUserAddressController.setSelected` | `proxyShoppingManage` |
//! | `GET  /adminapi/proxyShopping/address/getRegionPath` | `ProxyShoppingUserAddressController.getRegionPath` | `proxyShoppingManage` |
//! | `GET  /adminapi/proxyShopping/address/getAllRegionTree` | `ProxyShoppingUserAddressController.getAllRegionTree` | `proxyShoppingManage` |
//!
//! > **路径大小写**：`proxyShopping` 的 **S 大写**、`setSelected` 的 **S 大写**
//! > （`ProxyShoppingUserAddressController.java:25/66`），逐字符照抄，勿改。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")`
//! > 做类级方法校验；Rust 侧 `require_auth`（由 `api/admin/src/lib.rs::router`
//! > 统一套在 `/adminapi` 子树外层）只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / brand.rs / shop_manage.rs / pc_navigation.rs
//! > / paylog_batch.rs 的已知缺口一致）。上表「权限」列仅作对照。
//!
//! > **`getCurrentUserId()` 未迁移**：`list` / `create` 要求请求体显式给出
//! > `userId`（缺失 → `1001 请选择用户`）；`update` / `setSelected` 的归属
//! > 一律取自**库中该地址行的 `user_id`**。详见
//! > `tigshop_services::trade::proxy_shopping_user_address` 模块头第 1 条与返回值的 `uncertain_points`。
//!
//! > **列表分页结构**：Java 返回 MyBatis-Plus 的 `Page<UserAddressVO>`
//! > （`records/total/size/current/pages`），本实现返回项目统一的
//! > `PageResult`（`list/total/pageSize/page/totalPage`）。前端
//! > `api/proxyShopping/address.ts` 明确兼容 `records || list`，故可用；
//! > 详见 `uncertain_points`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::trade::proxy_shopping_user_address::{
    AddressCreateRequest, AddressListRequest, AddressUpdateRequest, AddressVO, RegionPathNode,
    RegionTreeNode,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 6 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源；顺序与原 Java 控制器一致。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "POST",
        "/proxyShopping/address/list",
        "ProxyShoppingUserAddressController.list",
    ),
    (
        "POST",
        "/proxyShopping/address/create",
        "ProxyShoppingUserAddressController.create",
    ),
    (
        "POST",
        "/proxyShopping/address/update",
        "ProxyShoppingUserAddressController.update",
    ),
    (
        "POST",
        "/proxyShopping/address/setSelected",
        "ProxyShoppingUserAddressController.setSelected",
    ),
    (
        "GET",
        "/proxyShopping/address/getRegionPath",
        "ProxyShoppingUserAddressController.getRegionPath",
    ),
    (
        "GET",
        "/proxyShopping/address/getAllRegionTree",
        "ProxyShoppingUserAddressController.getAllRegionTree",
    ),
];

/// 代客下单收货地址域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/proxyShopping/address")` +
/// `@PostMapping("/list" | "/create" | "/update" | "/setSelected")` /
/// `@GetMapping("/getRegionPath" | "/getAllRegionTree")`。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/proxyShopping/address/list", post(address_list))
        .route("/proxyShopping/address/create", post(address_create))
        .route("/proxyShopping/address/update", post(address_update))
        .route(
            "/proxyShopping/address/setSelected",
            post(address_set_selected),
        )
        .route(
            "/proxyShopping/address/getRegionPath",
            get(address_get_region_path),
        )
        .route(
            "/proxyShopping/address/getAllRegionTree",
            get(address_get_all_region_tree),
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

/// `POST /adminapi/proxyShopping/address/list`：代客下单的会员收货地址列表。
///
/// 对应 Java `ProxyShoppingUserAddressController.list(@RequestBody UserAddressListDTO)`
/// （`ProxyShoppingUserAddressController.java:36-43`）。
/// 控制器强制 `sortField = "is_selected"`、`isSystem = 2`（查全部），
/// 逻辑在服务层 `ProxyShoppingUserAddressService::list` 复刻。
async fn address_list(
    State(state): State<AdminState>,
    Json(dto): Json<AddressListRequest>,
) -> ApiResult<PageResult<AddressVO>> {
    ok(state.trade.proxy_shopping_user_address.list(&dto).await?)
}

/// `POST /adminapi/proxyShopping/address/create`：为指定会员新增收货地址。
///
/// 对应 Java `ProxyShoppingUserAddressController.create(@RequestBody UserAddressCreateDTO)`
/// （`ProxyShoppingUserAddressController.java:45-50`）。
/// 控制器强制 `isSystem = 1`（系统地址）；返回自增 `addressId`。
async fn address_create(
    State(state): State<AdminState>,
    Json(dto): Json<AddressCreateRequest>,
) -> ApiResult<i32> {
    ok(state.trade.proxy_shopping_user_address.create(&dto).await?)
}

/// `POST /adminapi/proxyShopping/address/update`：修改收货地址。
///
/// 对应 Java `ProxyShoppingUserAddressController.update(@RequestBody UserAddressUpdateDTO)`
/// （`ProxyShoppingUserAddressController.java:53-63`）。
/// 控制器会用库中记录覆盖 `isSystem` / `userId`（防止越权改归属），
/// 本实现同样只按 `addressId` 定位；Java 返回 `void`，这里回传 `true`。
async fn address_update(
    State(state): State<AdminState>,
    Json(dto): Json<AddressUpdateRequest>,
) -> ApiResult<bool> {
    state.trade.proxy_shopping_user_address.update(&dto).await?;
    ok(true)
}

/// `POST /adminapi/proxyShopping/address/setSelected`：设置选中状态。
///
/// 对应 Java `ProxyShoppingUserAddressController.setSelected(@RequestBody UserAddressUpdateDTO)`
/// （`ProxyShoppingUserAddressController.java:66-70`）。
/// ⚠️ 该接口用 DTO 的 **`id`**（不是 `addressId`）定位记录；
/// Java 返回 `void`，这里回传 `true`。
async fn address_set_selected(
    State(state): State<AdminState>,
    Json(dto): Json<AddressUpdateRequest>,
) -> ApiResult<bool> {
    state
        .trade
        .proxy_shopping_user_address
        .set_selected(&dto)
        .await?;
    ok(true)
}

/// `GET /adminapi/proxyShopping/address/getRegionPath`：按 regionId 取完整地区路径。
///
/// 对应 Java `ProxyShoppingUserAddressController.getRegionPath(@RequestParam regionId)`
/// （`ProxyShoppingUserAddressController.java:72-76`）。
/// 返回由根（默认国家，种子数据里是「中国」）到叶的 `List<Region>`。
async fn address_get_region_path(
    State(state): State<AdminState>,
    Query(q): Query<tigshop_core::models::trade::proxy_shopping_user_address::RegionPathQuery>,
) -> ApiResult<Vec<RegionPathNode>> {
    ok(state
        .trade
        .proxy_shopping_user_address
        .get_region_path(q.region_id)
        .await?)
}

/// `GET /adminapi/proxyShopping/address/getAllRegionTree`：获取所有地区（树形）。
///
/// 对应 Java `ProxyShoppingUserAddressController.getAllRegionTree()`
/// （`ProxyShoppingUserAddressController.java:78-82`）。
/// 返回 Hutool `Tree<Integer>` 的平铺 JSON 形态（`regionId`/`parentId`/`regionName`/`children`）。
async fn address_get_all_region_tree(
    State(state): State<AdminState>,
) -> ApiResult<Vec<RegionTreeNode>> {
    ok(state
        .trade
        .proxy_shopping_user_address
        .get_all_region_tree()
        .await?)
}
