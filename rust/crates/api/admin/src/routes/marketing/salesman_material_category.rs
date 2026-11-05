//! 管理端素材分类路由。
//! 对应原 Java `controller.salesman.SalesmanMaterialCategoryController`
//! （`@RequestMapping("/adminapi/salesman/category")`）。
//!
//! | 本模块路由 | 原 Java |
//! |-----------|--------|
//! | `GET  /salesman/category/list`        | `SalesmanMaterialCategoryController.list` |
//! | `GET  /salesman/category/detail`      | `SalesmanMaterialCategoryController.detail` |
//! | `POST /salesman/category/create`      | `SalesmanMaterialCategoryController.create` |
//! | `POST /salesman/category/update`      | `SalesmanMaterialCategoryController.update` |
//! | `POST /salesman/category/del`         | `SalesmanMaterialCategoryController.del` |
//! | `POST /salesman/category/updateField` | `SalesmanMaterialCategoryController.updateField` |
//! | `POST /salesman/category/batch`       | `SalesmanMaterialCategoryController.batch` |
//!
//! ## 权限
//! Java 侧 `create` / `update` / `del` 有
//! `@PreAuthorize("@pms.hasPermission('salesmanCategoryModifyManage')")`，
//! `list` / `detail` / `updateField` / `batch` 无方法级权限注解。
//! Rust 侧 `/adminapi` 子树只统一挂了 `require_auth`（登录态），
//! **权限点矩阵尚未实现**（与 product_manage/002/164 等同一已知缺口）：
//! 当前任何已登录管理员都能调用这三个写接口。
//!
//! ## 多租户
//! Java `BaseServiceImpl#getShopId()` 读请求头 `x-shop-id`
//! （经 `x-admin-type` 限定账号类型）。Rust 侧 JWT 未签发店铺上下文，
//! 因此这里沿用 product_stock / proxy_shopping_product / proxy_shopping_order_check 的既有口径，
//! 由 [`shop_id_from_headers`] 从请求头解析。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::salesman_material_category::{
    BatchDTO, OperateDTO, SalesmanMaterialCategoryEditParam, SalesmanMaterialCategoryPageQuery,
    SalesmanMaterialCategorySaveParam, SalesmanMaterialCategoryVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 素材分类域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/category/list", get(list))
        .route("/salesman/category/detail", get(detail))
        .route("/salesman/category/create", post(create))
        .route("/salesman/category/update", post(update))
        .route("/salesman/category/del", post(del))
        .route("/salesman/category/updateField", post(update_field))
        .route("/salesman/category/batch", post(batch))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/salesman/category/list",
            "SalesmanMaterialCategoryController.list",
        ),
        (
            "GET",
            "/adminapi/salesman/category/detail",
            "SalesmanMaterialCategoryController.detail",
        ),
        (
            "POST",
            "/adminapi/salesman/category/create",
            "SalesmanMaterialCategoryController.create",
        ),
        (
            "POST",
            "/adminapi/salesman/category/update",
            "SalesmanMaterialCategoryController.update",
        ),
        (
            "POST",
            "/adminapi/salesman/category/del",
            "SalesmanMaterialCategoryController.del",
        ),
        (
            "POST",
            "/adminapi/salesman/category/updateField",
            "SalesmanMaterialCategoryController.updateField",
        ),
        (
            "POST",
            "/adminapi/salesman/category/batch",
            "SalesmanMaterialCategoryController.batch",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/salesman/category/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/salesman/category/list`：素材分类分页。
///
/// 对应 Java `SalesmanMaterialCategoryController#list`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanMaterialCategoryPageQuery>,
) -> ApiResult<PageResult<SalesmanMaterialCategoryVO>> {
    ok(state.marketing.salesman_material_category.list(&q).await?)
}

/// `GET /adminapi/salesman/category/detail?id=`：素材分类详情。
///
/// 对应 Java `SalesmanMaterialCategoryController#detail`。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<SalesmanMaterialCategoryVO> {
    ok(state
        .marketing
        .salesman_material_category
        .detail(q.id)
        .await?)
}

/// `POST /adminapi/salesman/category/create`：创建素材分类。
///
/// 对应 Java `SalesmanMaterialCategoryController#create`
/// （`@PreAuthorize("@pms.hasPermission('salesmanCategoryModifyManage')")`；
/// 权限矩阵未实现，见模块头说明）。
async fn create(
    State(state): State<AdminState>,
    Json(param): Json<SalesmanMaterialCategorySaveParam>,
) -> ApiResult<i32> {
    ok(state
        .marketing
        .salesman_material_category
        .create(&param)
        .await?)
}

/// `POST /adminapi/salesman/category/update`：更新素材分类。
///
/// 对应 Java `SalesmanMaterialCategoryController#update`
/// （`@PreAuthorize('salesmanCategoryModifyManage')`）。
async fn update(
    State(state): State<AdminState>,
    Json(param): Json<SalesmanMaterialCategoryEditParam>,
) -> ApiResult<&'static str> {
    state
        .marketing
        .salesman_material_category
        .update(&param)
        .await?;
    ok("更新成功")
}

/// `POST /adminapi/salesman/category/del`：删除素材分类。
///
/// 对应 Java `SalesmanMaterialCategoryController#del`
/// （`@PreAuthorize('salesmanCategoryModifyManage')`）。
/// 分类下仍有素材时服务层会拒绝。
async fn del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    state
        .marketing
        .salesman_material_category
        .delete(&dto)
        .await?;
    ok("删除成功")
}

/// `POST /adminapi/salesman/category/updateField`：更新单个字段。
///
/// 对应 Java `SalesmanMaterialCategoryController#updateField`
/// （服务层白名单为 `CheckFieldConstants.GENERAL_FIELDS`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    state
        .marketing
        .salesman_material_category
        .update_field(&dto)
        .await?;
    ok(true)
}

/// `POST /adminapi/salesman/category/batch`：批量操作。
///
/// 对应 Java `SalesmanMaterialCategoryController#batch`
/// （仅 `type == "del"` 生效，其余返回 `false`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state
        .marketing
        .salesman_material_category
        .batch(&dto)
        .await?)
}

#[cfg(test)]
fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 解析当前店铺 ID（Java `BaseServiceImpl#getShopId()` → `HeaderUtils.getShopId()`）。
///
/// 沿用 product_stock / proxy_shopping_product / proxy_shopping_order_check 的既有口径：
/// - `x-admin-type: admin` → 0（平台）；
/// - `x-admin-type: shop|pos` → `x-shop-id`（缺失 / 非法 → 0）；
/// - 其他 / 缺失 → 0。
///
/// ⚠️ Rust JWT 尚未签发店铺上下文，故以请求头替代；这条口径与 Java 的
/// `HeaderUtils.getShopId()` 并不完全等价（Java 对脏 `x-shop-id` 会抛
/// `NumberFormatException`，这里回落到 0）。
#[must_use]
#[cfg(test)]
pub fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    #[test]
    fn platform_account_is_zero_regardless_of_shop_header() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
    }

    #[test]
    fn shop_and_pos_take_the_shop_header() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
    }

    #[test]
    fn missing_or_dirty_shop_header_falls_back_to_zero() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            0
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            0
        );
        assert_eq!(shop_id_from_headers(&HeaderMap::new()), 0);
    }

    #[test]
    fn implemented_routes_cover_the_seven_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        let paths: Vec<&str> = docs.iter().map(|d| d.path.as_str()).collect();
        for p in [
            "/adminapi/salesman/category/list",
            "/adminapi/salesman/category/detail",
            "/adminapi/salesman/category/create",
            "/adminapi/salesman/category/update",
            "/adminapi/salesman/category/del",
            "/adminapi/salesman/category/updateField",
            "/adminapi/salesman/category/batch",
        ] {
            assert!(paths.contains(&p), "缺少路由 {p}");
        }
    }
}
