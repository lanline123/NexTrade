//! 管理端商品分类路由（catalog::category）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.CategoryController`
//! （`@RequestMapping("/adminapi/product/category")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |--------------------------------|---------|------|
//! | `GET  /product/category/list` | `CategoryController.list` | `categoryManage`/`productManage`/`vendorProductManage` |
//! | `GET  /product/category/getParentName` | `CategoryController.getParentName` | 同上 |
//! | `GET  /product/category/detail` | `CategoryController.detail` | 同上 |
//! | `POST /product/category/create` | `CategoryController.create` | `productCategoryModifyManage` |
//! | `POST /product/category/update` | `CategoryController.update` | `productCategoryModifyManage` |
//! | `POST /product/category/del` | `CategoryController.del` | `productCategoryModifyManage` |
//! | `POST /product/category/batch` | `CategoryController.batch` | `productCategoryModifyManage` |
//! | `POST /product/category/updateField` | `CategoryController.updateField` | `productCategoryModifyManage` |
//! | `POST /product/category/moveCat` | `CategoryController.moveCat` | `categoryManage`/`productManage`/`vendorProductManage` |
//!
//! > **权限说明**：Java 用类级 `@PreAuthorize("@pms.hasPermission(
//! > 'categoryManage','productManage','vendorProductManage')")` +
//! > 方法级 `@PreAuthorize("@pms.hasPermission('productCategoryModifyManage')")`
//! > 做校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 `brand.rs` / `catalog.rs` 的已知缺口一致）。
//! >
//! > **响应结构说明**：Java `list` 返回 MyBatis-Plus 的 `Page<CategoryDTO>`
//! > （`records/total/size/current/pages`）；Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与其余切片一致。
//! >
//! > **`detail` 的空值语义**：Java `CategoryServiceImpl.detail` 对不存在的 ID
//! > 返回**全空 DTO**（不抛异常），因此这里回 `data: null` 而不是 404。
//! >
//! > **原控制器中未列入本切片的端点**：`GET /product/category/getAllCategory`
//! > （契约中不属 catalog::category，留在 `routes/catalog.rs`）。
//! >
//! > **⚠️ 合并前必须先去重**：`crates/api/admin/src/routes/catalog.rs` 目前
//! > **已经注册了本模块全部 9 条路径**（`/product/category/list` …
//! > `/product/category/moveCat`）。二者同时 merge 会导致 axum
//! > `Router::merge` 因同一路径重复注册在**启动时 panic**。
//! > 合并步骤：
//! > 1. `routes/mod.rs` 加 `pub mod category;`，`merge_all()` 末尾加
//! >    `.merge(tigshop_core::models::catalog::category::routes(state))`，`implemented_routes()` 加
//! >    `out.extend(tigshop_core::models::catalog::category::implemented_routes());`
//! > 2. **删除** `catalog.rs` 中那 9 条分类路由的 `.route(...)` 注册
//! >    与 `implemented_routes()` 中对应的 9 条记录；
//! >    仅保留 `GET /product/category/getAllCategory` 与 `/product/brand/*`，
//! >    以及只被它们使用的 handler（`category_list` / `parent_name` /
//! >    `category_detail` / `category_create` / `category_update` /
//! >    `category_del` / `category_batch` / `category_update_field` /
//! >    `move_cat` 及其私有 Query 结构可一并删除，避免 `dead_code` 警告）。
//! > 3. 重跑 `python tools/check_api_coverage.py` 确认无重复、无缺失。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::category::{
    BatchDTO, CategoryDTO, CategoryListQuery, MoveCatDTO, OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 商品分类域管理端路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/category/list", get(category_list))
        .route("/product/category/getParentName", get(get_parent_name))
        .route("/product/category/detail", get(category_detail))
        .route("/product/category/create", post(category_create))
        .route("/product/category/update", post(category_update))
        .route("/product/category/del", post(category_del))
        .route("/product/category/batch", post(category_batch))
        .route("/product/category/updateField", post(category_update_field))
        .route("/product/category/moveCat", post(category_move_cat))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/product/category/list",
            "CategoryController.list",
        ),
        (
            "GET",
            "/adminapi/product/category/getParentName",
            "CategoryController.getParentName",
        ),
        (
            "GET",
            "/adminapi/product/category/detail",
            "CategoryController.detail",
        ),
        (
            "POST",
            "/adminapi/product/category/create",
            "CategoryController.create",
        ),
        (
            "POST",
            "/adminapi/product/category/update",
            "CategoryController.update",
        ),
        (
            "POST",
            "/adminapi/product/category/del",
            "CategoryController.del",
        ),
        (
            "POST",
            "/adminapi/product/category/batch",
            "CategoryController.batch",
        ),
        (
            "POST",
            "/adminapi/product/category/updateField",
            "CategoryController.updateField",
        ),
        (
            "POST",
            "/adminapi/product/category/moveCat",
            "CategoryController.moveCat",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/product/category/list`：商品分类分页列表。
///
/// 对应 Java `CategoryController.list(CategoryListDTO dto)`。
async fn category_list(
    State(state): State<AdminState>,
    Query(q): Query<CategoryListQuery>,
) -> ApiResult<PageResult<CategoryDTO>> {
    ok(state.catalog.category.list(&q).await?)
}

/// `GET /adminapi/product/category/getParentName?parentId=`：父分类名称。
///
/// 对应 Java `CategoryController.getParentName(Integer parentId)`；
/// Java 直接返回 `String`（可为 `null`）。
async fn get_parent_name(
    State(state): State<AdminState>,
    Query(q): Query<ParentIdQuery>,
) -> ApiResult<Option<String>> {
    ok(state.catalog.category.parent_name(q.parent_id).await?)
}

/// `getParentName` 查询参数。
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct ParentIdQuery {
    parent_id: Option<i32>,
}

/// `GET /adminapi/product/category/detail?id=`：商品分类详情。
///
/// 对应 Java `CategoryController.detail(@RequestParam @NotNull Integer id)`。
/// Java 对不存在的 ID 返回全空 DTO，故此处 `data` 可能是 `null`。
async fn category_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<CategoryDTO>> {
    ok(state.catalog.category.detail(q.id).await?)
}

/// 单 ID 查询参数（Java `@RequestParam @NotNull Integer id`，缺失即参数错误）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `POST /adminapi/product/category/create`：创建商品分类。
///
/// 对应 Java `CategoryController.create(@RequestBody CategoryDTO dto)`，
/// Java 返回 `void`；这里回传新建主键便于前端跳转/排查。
async fn category_create(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryDTO>,
) -> ApiResult<i32> {
    ok(state.catalog.category.create(&dto).await?)
}

/// `POST /adminapi/product/category/update`：更新商品分类。
///
/// 对应 Java `CategoryController.update(@RequestBody CategoryDTO dto)`（返回 `void`）。
async fn category_update(
    State(state): State<AdminState>,
    Json(dto): Json<CategoryDTO>,
) -> ApiResult<&'static str> {
    state.catalog.category.update(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/product/category/del`：删除商品分类。
///
/// 对应 Java `CategoryController.del(@RequestBody OperateDTO operateDTO)`。
/// 守卫（有子分类 / 有商品）在 Controller 中，本实现落在服务层 `del`。
async fn category_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    state.catalog.category.del(&dto).await?;
    ok("删除成功")
}

/// `POST /adminapi/product/category/batch`：批量操作商品分类。
///
/// 对应 Java `CategoryController.batch(@RequestBody BatchDTO batch)`：
/// 仅 `type = "del"` 有实现，其余类型静默无操作（基类返回 `false`）。
async fn category_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<&'static str> {
    state.catalog.category.batch(&dto).await?;
    ok("操作成功")
}

/// `POST /adminapi/product/category/updateField`：商品分类字段更新。
///
/// 对应 Java `CategoryController.updateField(@RequestBody UpdateFieldDTO
/// updateField)`（白名单 `CheckFieldConstants.CATEGORY_FIELDS`）。
async fn category_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    state.catalog.category.update_field(&dto).await?;
    ok("更新成功")
}

/// `POST /adminapi/product/category/moveCat`：移动商品分类下的商品。
///
/// 对应 Java `CategoryController.moveCat(@RequestBody MoveCatDTO dto)`：
/// 把 `id` 分类下的商品改挂到 `targetCatId`（不动分类节点本身）。
async fn category_move_cat(
    State(state): State<AdminState>,
    Json(dto): Json<MoveCatDTO>,
) -> ApiResult<&'static str> {
    state.catalog.category.move_cat(&dto).await?;
    ok("移动成功")
}
