//! 管理端拼团活动商品路由（marketing::groupon_promotion_item，8 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.GrouponPromotionItemController`
//! （`@RequestMapping("/adminapi/promotion/groupon/item")`，
//! 类级 `@PreAuthorize('grouponPromotionManage')`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `POST /promotion/groupon/item/create` | `create` |
//! | `POST /promotion/groupon/item/update` | `update` |
//! | `POST /promotion/groupon/item/del` | `del` |
//! | `POST /promotion/groupon/item/batch` | `batch` |
//! | `GET  /promotion/groupon/item/detail` | `detail` |
//! | `GET  /promotion/groupon/item/list` | `list` |
//! | `GET  /promotion/groupon/item/post` | `post` |
//! | `GET  /promotion/groupon/item/productList` | `productList` |
//!
//! > 与既有 `marketing::groupon_promotion`（`/promotion/groupon/*` 活动 CRUD）路径
//! > 不重叠：本 feature 统一在 `/promotion/groupon/item/*` 下。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::groupon_promotion_item::{
    CreateParam, GrouponPostVO, GrouponProductVO, ItemBatchParam, ItemDetailVO, ItemPageQuery,
    ItemPageVO, ProductPageQuery, UpdateParam,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 8 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "POST",
        "/promotion/groupon/item/create",
        "GrouponPromotionItemController.create",
    ),
    (
        "POST",
        "/promotion/groupon/item/update",
        "GrouponPromotionItemController.update",
    ),
    (
        "POST",
        "/promotion/groupon/item/del",
        "GrouponPromotionItemController.del",
    ),
    (
        "POST",
        "/promotion/groupon/item/batch",
        "GrouponPromotionItemController.batch",
    ),
    (
        "GET",
        "/promotion/groupon/item/detail",
        "GrouponPromotionItemController.detail",
    ),
    (
        "GET",
        "/promotion/groupon/item/list",
        "GrouponPromotionItemController.list",
    ),
    (
        "GET",
        "/promotion/groupon/item/post",
        "GrouponPromotionItemController.post",
    ),
    (
        "GET",
        "/promotion/groupon/item/productList",
        "GrouponPromotionItemController.productList",
    ),
];

/// 拼团活动商品路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/groupon/item/create", post(create))
        .route("/promotion/groupon/item/update", post(update))
        .route("/promotion/groupon/item/del", post(del))
        .route("/promotion/groupon/item/batch", post(batch))
        .route("/promotion/groupon/item/detail", get(detail))
        .route("/promotion/groupon/item/list", get(list))
        .route("/promotion/groupon/item/post", get(post_info))
        .route("/promotion/groupon/item/productList", get(product_list))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `?grouponPromotionItemId=` 查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ItemIdQuery {
    groupon_promotion_item_id: Option<i64>,
}

/// 主键查询参数（`?id=`，Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    id: Option<i64>,
}

/// `POST /adminapi/promotion/groupon/item/create`：创建拼团商品。
async fn create(State(state): State<AdminState>, Json(param): Json<CreateParam>) -> ApiResult<()> {
    state
        .marketing
        .groupon_promotion_item
        .create(&param)
        .await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/item/update`：更新拼团商品。
async fn update(State(state): State<AdminState>, Json(param): Json<UpdateParam>) -> ApiResult<()> {
    state
        .marketing
        .groupon_promotion_item
        .update(&param)
        .await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/item/del`：删除拼团商品。
async fn del(State(state): State<AdminState>, Json(dto): Json<IdQuery>) -> ApiResult<()> {
    state.marketing.groupon_promotion_item.del(dto.id).await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/item/batch`：批量操作（仅 `del`）。
async fn batch(
    State(state): State<AdminState>,
    Json(param): Json<ItemBatchParam>,
) -> ApiResult<()> {
    state.marketing.groupon_promotion_item.batch(&param).await?;
    ok(())
}

/// `GET /adminapi/promotion/groupon/item/detail`：拼团商品详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<ItemIdQuery>,
) -> ApiResult<ItemDetailVO> {
    let id = q
        .groupon_promotion_item_id
        .ok_or_else(|| tigshop_core::Error::biz_msg("未知的拼团活动商品"))?;
    ok(state.marketing.groupon_promotion_item.detail(id).await?)
}

/// `GET /adminapi/promotion/groupon/item/list`：拼团商品分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ItemPageQuery>,
) -> ApiResult<PageResult<ItemPageVO>> {
    ok(state.marketing.groupon_promotion_item.list(&q).await?)
}

/// `GET /adminapi/promotion/groupon/item/post`：推广信息（Java 恒 null）。
async fn post_info(
    State(state): State<AdminState>,
    Query(q): Query<ItemIdQuery>,
) -> ApiResult<Option<GrouponPostVO>> {
    let id = q.groupon_promotion_item_id.unwrap_or(0);
    ok(state.marketing.groupon_promotion_item.post(id).await?)
}

/// `GET /adminapi/promotion/groupon/item/productList`：可选商品分页。
async fn product_list(
    State(state): State<AdminState>,
    Query(q): Query<ProductPageQuery>,
) -> ApiResult<PageResult<GrouponProductVO>> {
    ok(state
        .marketing
        .groupon_promotion_item
        .product_list(&q)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("POST", "/adminapi/promotion/groupon/item/create"),
            ("POST", "/adminapi/promotion/groupon/item/update"),
            ("POST", "/adminapi/promotion/groupon/item/del"),
            ("POST", "/adminapi/promotion/groupon/item/batch"),
            ("GET", "/adminapi/promotion/groupon/item/detail"),
            ("GET", "/adminapi/promotion/groupon/item/list"),
            ("GET", "/adminapi/promotion/groupon/item/post"),
            ("GET", "/adminapi/promotion/groupon/item/productList"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn item_paths_do_not_collide_with_groupon_activity_routes() {
        // 既有 groupon_promotion 使用 /promotion/groupon/{create,update,finish,del,detail,list,...}
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(path.starts_with("/promotion/groupon/item/"), "{path}");
        }
        assert_eq!(ROUTE_TABLE.len(), 8);
    }
}
