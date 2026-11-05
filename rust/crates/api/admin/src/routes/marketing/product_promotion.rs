//! 管理端商品促销路由（marketing::product_promotion，9 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.ProductPromotionController`
//! （`@RequestMapping("/adminapi/promotion/productPromotion")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET  /promotion/productPromotion/list` | `list` |
//! | `GET  /promotion/productPromotion/detail` | `detail` |
//! | `POST /promotion/productPromotion/create` | `create` |
//! | `POST /promotion/productPromotion/update` | `update` |
//! | `POST /promotion/productPromotion/del` | `del` |
//! | `POST /promotion/productPromotion/updateField` | `updateField` |
//! | `POST /promotion/productPromotion/batch` | `batch` |
//! | `GET  /promotion/productPromotion/config` | `config` |
//! | `GET  /promotion/productPromotion/conflict` | `conflictPage` |
//!
//! > 店铺上下文：Java `HeaderUtils.getShopId()`；Rust JWT 无 shop_id，列表/冲突
//! > 支持 `?shopId=`（缺省 0 = 平台），创建取 DTO `shopId`（见服务层模块头偏差 1）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::groupon_promotion::OperateDTO;
use tigshop_core::models::marketing::product_promotion::{
    ConflictPageQuery, ConflictPageVO, ProductPromotionConfigVO, ProductPromotionDTO,
    ProductPromotionListQuery, ProductPromotionVO,
};
use tigshop_core::models::merchant::shop_manage::{BatchDTO, UpdateFieldDTO};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 9 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 9] = [
    (
        "GET",
        "/promotion/productPromotion/list",
        "ProductPromotionController.list",
    ),
    (
        "GET",
        "/promotion/productPromotion/detail",
        "ProductPromotionController.detail",
    ),
    (
        "POST",
        "/promotion/productPromotion/create",
        "ProductPromotionController.create",
    ),
    (
        "POST",
        "/promotion/productPromotion/update",
        "ProductPromotionController.update",
    ),
    (
        "POST",
        "/promotion/productPromotion/del",
        "ProductPromotionController.del",
    ),
    (
        "POST",
        "/promotion/productPromotion/updateField",
        "ProductPromotionController.updateField",
    ),
    (
        "POST",
        "/promotion/productPromotion/batch",
        "ProductPromotionController.batch",
    ),
    (
        "GET",
        "/promotion/productPromotion/config",
        "ProductPromotionController.config",
    ),
    (
        "GET",
        "/promotion/productPromotion/conflict",
        "ProductPromotionController.conflictPage",
    ),
];

/// 商品促销路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/productPromotion/list", get(list))
        .route("/promotion/productPromotion/detail", get(detail))
        .route("/promotion/productPromotion/create", post(create))
        .route("/promotion/productPromotion/update", post(update))
        .route("/promotion/productPromotion/del", post(del))
        .route(
            "/promotion/productPromotion/updateField",
            post(update_field),
        )
        .route("/promotion/productPromotion/batch", post(batch))
        .route("/promotion/productPromotion/config", get(config))
        .route("/promotion/productPromotion/conflict", get(conflict))
}

/// 本域已实现路由（完整契约路径，用于覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// 主键查询参数（`?id=`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/promotion/productPromotion/list`：活动分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ProductPromotionListQuery>,
) -> ApiResult<PageResult<ProductPromotionVO>> {
    ok(state.marketing.product_promotion.list(&q).await?)
}

/// `GET /adminapi/promotion/productPromotion/detail?id=`：活动详情（不存在返回 null）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<ProductPromotionVO>> {
    ok(state.marketing.product_promotion.detail(q.id).await?)
}

/// `POST /adminapi/promotion/productPromotion/create`：创建活动。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<ProductPromotionDTO>,
) -> ApiResult<()> {
    state.marketing.product_promotion.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/promotion/productPromotion/update`：更新活动。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ProductPromotionDTO>,
) -> ApiResult<()> {
    state.marketing.product_promotion.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/promotion/productPromotion/del`：删除活动。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.product_promotion.del(dto.id).await?;
    ok(())
}

/// `POST /adminapi/promotion/productPromotion/updateField`：白名单字段更新。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.product_promotion.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/promotion/productPromotion/batch`：批量操作（仅 `del`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.product_promotion.batch(&dto).await?;
    ok(())
}

/// `GET /adminapi/promotion/productPromotion/config`：配置字典 + 会员等级。
async fn config(State(state): State<AdminState>) -> ApiResult<ProductPromotionConfigVO> {
    ok(state.marketing.product_promotion.config().await?)
}

/// `GET /adminapi/promotion/productPromotion/conflict`：冲突活动列表。
async fn conflict(
    State(state): State<AdminState>,
    Query(q): Query<ConflictPageQuery>,
) -> ApiResult<PageResult<ConflictPageVO>> {
    ok(state.marketing.product_promotion.conflict(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("GET", "/adminapi/promotion/productPromotion/list"),
            ("GET", "/adminapi/promotion/productPromotion/detail"),
            ("POST", "/adminapi/promotion/productPromotion/create"),
            ("POST", "/adminapi/promotion/productPromotion/update"),
            ("POST", "/adminapi/promotion/productPromotion/del"),
            ("POST", "/adminapi/promotion/productPromotion/updateField"),
            ("POST", "/adminapi/promotion/productPromotion/batch"),
            ("GET", "/adminapi/promotion/productPromotion/config"),
            ("GET", "/adminapi/promotion/productPromotion/conflict"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 9);
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, *path);
        }
    }

    #[test]
    fn route_table_matches_java_method_names() {
        let handlers: Vec<&str> = ROUTE_TABLE.iter().map(|(_, _, h)| *h).collect();
        assert!(handlers.contains(&"ProductPromotionController.conflictPage"));
        assert!(!handlers.iter().any(|h| h.ends_with(".getConfig")));
        assert_eq!(ROUTE_TABLE.len(), 9);
    }
}
