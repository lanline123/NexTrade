//! 管理端店铺商品分类信息路由（merchant::shop_product_category）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.shop.ShopProductCategoryController`
//! （`@RequestMapping("/adminapi/merchant/shopProductCategory")`，112 行，9 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） | HTTP |
//! |----------------------------------|---------|------------------------|------|
//! | `GET  /merchant/shopProductCategory/list` | `ShopProductCategoryController.list` | — | GET |
//! | `GET  /merchant/shopProductCategory/getCategoryName` | `...getCategoryName` | — | GET |
//! | `GET  /merchant/shopProductCategory/detail` | `...detail` | — | GET |
//! | `GET  /merchant/shopProductCategory/getAllCategory` | `...getAllCategory` | — | GET |
//! | `POST /merchant/shopProductCategory/create` | `...create` | `merchantShopProductCategoryModifyManage` | POST |
//! | `POST /merchant/shopProductCategory/update` | `...update` | `merchantShopProductCategoryModifyManage` | POST |
//! | `POST /merchant/shopProductCategory/del` | `...del` | `merchantShopProductCategoryModifyManage` | POST |
//! | `POST /merchant/shopProductCategory/batch` | `...batch` | `merchantShopProductCategoryModifyManage` | POST |
//! | `POST /merchant/shopProductCategory/updateField` | `...updateField` | `merchantShopProductCategoryModifyManage` | POST |
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/merchant/shopProductCategory`，
//! 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复。最终路径
//! `/adminapi/merchant/shopProductCategory/list` 与 `docs/api-contract.json`
//! 逐字符一致（注意 `shopProductCategory` 是**小驼峰**）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 权限校验（4 个读接口**没有**该注解、5 个写接口有
//! > `merchantShopProductCategoryModifyManage`）；Rust 侧 `require_auth`
//! > 目前只校验登录态，权限矩阵未实现（与本仓其它域一致的已知缺口）。
//! > 上表权限列仅作对照记录。
//!
//! > **多租户说明**：Java 在 6 个端点里调用 `HeaderUtils.getShopId()`
//! > （`x-admin-type` + `x-shop-id` 请求头）并把结果**覆盖**进 DTO，
//! > 且 `getAllCategory` 把它当必填（`null` ⇒ 「请选择店铺」）。
//! > Rust JWT 未签发 `shop_id`，故本模块按**同一规则解析请求头**
//! > （见 [`resolve_shop_id`]，与 product_stock / aftersales / im_config / im_servant
//! > 口径一致），语义与原实现一致。
//!
//! > **不确定点**（详见返回值 `uncertain_points`）：
//! > 1. `list` 的关键字过滤条件在 Java 里写反（`keyword != null && isEmpty(keyword)`），
//! >    导致关键字搜索完全失效 —— 本实现逐字复刻；
//! > 2. `updateField` 白名单 `SHOP_PRODUCT_CATEGORY_FIELDS` 含 2 个**不属于本表**的列
//! >    （`measure_unit` / `is_hot`），而本表真实的 `category_pic` 不在白名单 —— 照抄；
//! > 3. `delHandle` 对不存在的 id 在 Java 里 NPE（500），本实现改为 404。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_common::utils::now_seconds;
use tigshop_core::models::merchant::shop_product_category::{
    BatchDTO, OperateDTO, ShopProductCategoryCreateDTO, ShopProductCategoryListQuery,
    ShopProductCategoryTreeVO, ShopProductCategoryUpdateDTO, ShopProductCategoryVO, UpdateFieldDTO,
    MSG_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 9 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 9] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/merchant/shopProductCategory/list",
        "ShopProductCategoryController.list",
    ),
    (
        "GET",
        "/merchant/shopProductCategory/getCategoryName",
        "ShopProductCategoryController.getCategoryName",
    ),
    (
        "GET",
        "/merchant/shopProductCategory/detail",
        "ShopProductCategoryController.detail",
    ),
    (
        "GET",
        "/merchant/shopProductCategory/getAllCategory",
        "ShopProductCategoryController.getAllCategory",
    ),
    (
        "POST",
        "/merchant/shopProductCategory/create",
        "ShopProductCategoryController.create",
    ),
    (
        "POST",
        "/merchant/shopProductCategory/update",
        "ShopProductCategoryController.update",
    ),
    (
        "POST",
        "/merchant/shopProductCategory/del",
        "ShopProductCategoryController.del",
    ),
    (
        "POST",
        "/merchant/shopProductCategory/batch",
        "ShopProductCategoryController.batch",
    ),
    (
        "POST",
        "/merchant/shopProductCategory/updateField",
        "ShopProductCategoryController.updateField",
    ),
];

/// 店铺商品分类域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/shopProductCategory/list", get(list))
        .route(
            "/merchant/shopProductCategory/getCategoryName",
            get(get_category_name),
        )
        .route("/merchant/shopProductCategory/detail", get(detail))
        .route(
            "/merchant/shopProductCategory/getAllCategory",
            get(get_all_category),
        )
        .route("/merchant/shopProductCategory/create", post(create))
        .route("/merchant/shopProductCategory/update", post(update))
        .route("/merchant/shopProductCategory/del", post(del))
        .route("/merchant/shopProductCategory/batch", post(batch))
        .route(
            "/merchant/shopProductCategory/updateField",
            post(update_field),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 店铺 ID（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 当前账号的店铺范围（**仅来自认证身份**）：
/// - 店铺/门店/POS 账号 → `Some(自身店铺)`（列表/写入强制本店）；
/// - 平台账号 → `None`（可选按 `shopId` 过滤）。
#[must_use]
fn tenant_shop_scope(tenant: &TenantContext) -> Option<i32> {
    tenant.shop_scope()
}

/// `GET /adminapi/merchant/shopProductCategory/list`：分类分页。
///
/// 对应 Java `ShopProductCategoryController.list(ShopProductCategoryListDTO listDTO)`
/// → `ShopProductCategoryServiceImpl#list`。
///
/// 查询参数按 Java `BasePage` 契约：`parentId` / `keyword` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是项目通用的 `pageSize`）。
/// Java 会先 `listDTO.setShopId(getShopId())` 覆盖店铺，
/// 因此请求体/查询串里的 `shopId` **不生效**。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopProductCategoryListQuery>,
) -> ApiResult<PageResult<ShopProductCategoryVO>> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state
        .merchant
        .shop_product_category
        .list(&q, shop_id)
        .await?)
}

/// `GET /adminapi/merchant/shopProductCategory/getCategoryName?parentId=`：按父级取名称。
///
/// 对应 Java `ShopProductCategoryController.getCategoryName(Integer parentId)`：
/// `getById(parentId)`，为 null 时返回**空串**（HTTP 200，`data: ""`）。
///
/// ⚠️ Java 的 `parentId` 是**可选**参数（无 `@RequestParam(required = true)`），
/// 缺失时 `getById(null)` 返回 null ⇒ 空串。本实现要求必须传：
/// 缺失时返回 400 `id不能为空`（`parentId` 与主键同义），见 `uncertain_points`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParentIdQuery {
    /// 父级分类 id（= 主键）
    parent_id: Option<i32>,
}

async fn get_category_name(
    State(state): State<AdminState>,
    Query(q): Query<ParentIdQuery>,
) -> ApiResult<String> {
    let parent_id = q
        .parent_id
        .filter(|v| *v > 0)
        .ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state
        .merchant
        .shop_product_category
        .get_category_name(parent_id)
        .await?)
}

/// `GET /adminapi/merchant/shopProductCategory/detail?id=`：分类详情。
///
/// 对应 Java `ShopProductCategoryController.detail(@RequestParam Integer id)`：
/// 记录不存在时抛 `error.category.not.exist`（「分类不存在」）。
///
/// Java 的 `id` 是 `@RequestParam`（required 默认 true）⇒ 缺失即 400；
/// 本实现同样要求必填。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    /// 分类主键
    id: Option<i32>,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ShopProductCategoryVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state.merchant.shop_product_category.detail(id).await?)
}

/// `GET /adminapi/merchant/shopProductCategory/getAllCategory`：全部可见分类树。
///
/// 对应 Java `ShopProductCategoryController.getAllCategory()` →
/// `ShopProductCategoryServiceImpl#tree(getShopId())`。
///
/// - `getShopId()` 为 `null` ⇒ 抛「请选择店铺」（本实现同样报错）；
/// - 无数据时 Java `convertTreeList` 返回 **`null`**（不是 `[]`）
///   ⇒ 本实现 `data: null`。
async fn get_all_category(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Option<Vec<ShopProductCategoryTreeVO>>> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state.merchant.shop_product_category.tree(shop_id).await?)
}

// ——————————————————————————————————————————————
// 写入
// ——————————————————————————————————————————————

/// `POST /adminapi/merchant/shopProductCategory/create`：创建分类。
///
/// 对应 Java `ShopProductCategoryController.create(@RequestBody
/// ShopProductCategoryCreateDTO createDTO)` → `ShopProductCategoryServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端刷新
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
///
/// ⚠️ Java 用 `BeanUtils.copyProperties` + `setAddTime(getCurrentTime())`，
/// 因此请求体里的 `addTime` 无论传什么都会被**当前时间覆盖**（本实现照抄）。
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ShopProductCategoryCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let shop_id = tenant_shop_scope(&tenant);
    let id = state
        .merchant
        .shop_product_category
        .create(&dto, shop_id, i32::try_from(now_seconds()).unwrap_or(0))
        .await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/merchant/shopProductCategory/update`：更新分类。
///
/// 对应 Java `ShopProductCategoryController.update(@RequestBody
/// ShopProductCategoryUpdateDTO updateDTO)` → `ShopProductCategoryServiceImpl#update`。
///
/// Java 返回 `void`，这里回传是否命中记录。
///
/// ⚠️ Java 会把 `getShopId()` 覆盖进 DTO 并由 `updateById` 写库，
/// 因此平台账号（`shopId = 0`）调用本接口会把分类的 `shop_id` 改成 0
/// —— 本实现忠实保留（见 `uncertain_points`）。
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ShopProductCategoryUpdateDTO>,
) -> ApiResult<bool> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state
        .merchant
        .shop_product_category
        .update(&dto, shop_id)
        .await?)
}

/// `POST /adminapi/merchant/shopProductCategory/del`：删除分类。
///
/// 对应 Java `ShopProductCategoryController.del(@RequestBody OperateDTO operateDTO)`
/// → `ShopProductCategoryServiceImpl#del` → `delHandle`：
/// 删除后把引用该分类的 `product.shop_category_id` 置 0。
///
/// ⚠️ Java 的 `del` 恒返回 `false` 且控制器返回 `void`；
/// 本实现回传「是否真的删除了一行」，HTTP 层行为一致。
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state
        .merchant
        .shop_product_category
        .del(&dto, shop_id)
        .await?)
}

/// `POST /adminapi/merchant/shopProductCategory/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `ShopProductCategoryController.batch(@RequestBody BatchDTO batchDTO)`
/// → `ShopProductCategoryServiceImpl#batch`：`type != "del"` 时**静默返回 `false`**
/// （HTTP 200，不是报错）；`type == "del"` 时逐个 `delHandle`。
async fn batch(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state
        .merchant
        .shop_product_category
        .batch(&dto, shop_id)
        .await?)
}

/// `POST /adminapi/merchant/shopProductCategory/updateField`：更新单个字段。
///
/// 对应 Java `ShopProductCategoryController.updateField(@RequestBody
/// UpdateFieldDTO updateField)`：
/// `updateField(updateField, "category_id", SHOP_PRODUCT_CATEGORY_FIELDS, shopId)`。
///
/// ⚠️ `fieldId` 形参 `"category_id"` 在 Java 的 `updateField` 实现里
/// **仅**用于 `updateWrapper.eq(fieldId, updateField.getId())`，本实现等价于
/// `WHERE category_id = ?`（硬编码，无法注入）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    let shop_id = tenant_shop_scope(&tenant);
    ok(state
        .merchant
        .shop_product_category
        .update_field(&dto, shop_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn shop(shop_id: i32) -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(shop_id), None)
    }

    #[test]
    fn implemented_routes_or_paths_exist() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 9);
        let paths: Vec<&str> = docs.iter().map(|d| d.path.as_str()).collect();
        for p in [
            "/adminapi/merchant/shopProductCategory/list",
            "/adminapi/merchant/shopProductCategory/getCategoryName",
            "/adminapi/merchant/shopProductCategory/detail",
            "/adminapi/merchant/shopProductCategory/getAllCategory",
            "/adminapi/merchant/shopProductCategory/create",
            "/adminapi/merchant/shopProductCategory/update",
            "/adminapi/merchant/shopProductCategory/del",
            "/adminapi/merchant/shopProductCategory/batch",
            "/adminapi/merchant/shopProductCategory/updateField",
        ] {
            assert!(paths.contains(&p), "缺少 {p}");
        }
    }

    /// 店铺账号强制自身店铺；平台账号不过滤。
    #[test]
    fn shop_scope_comes_from_tenant_context() {
        assert_eq!(tenant_shop_scope(&shop(9)), Some(9));
        assert_eq!(tenant_shop_scope(&platform()), None);
        // 缺失 shop_id 的店铺账号不会被当作平台
        let broken = TenantContext::new(Some("shop".into()), None, None);
        assert_eq!(tenant_shop_scope(&broken), None);
    }
}
