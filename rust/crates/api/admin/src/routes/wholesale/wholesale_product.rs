//! 批发商品 —— 管理端路由（wholesale::wholesale_product）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.wholesale.WholesaleProductController`
//! （`@RequestMapping("/adminapi/wholesale/product")`，13 个端点）。
//!
//! | method | path（本模块，挂载于 `/adminapi`） | 返回 |
//! |--------|------------------------------------|------|
//! | `GET`  | `/wholesale/product/page` | `PageResult<WholesaleProductVO>` |
//! | `GET`  | `/wholesale/product/selectable/page` | `PageResult<WholesaleSelectableProductVO>` |
//! | `POST` | `/wholesale/product/add` | `{"productId": id}` |
//! | `POST` | `/wholesale/product/batchAdd` | `WholesaleProductBatchAddVO` |
//! | `POST` | `/wholesale/product/batchDelete` | `{"deletedCount": n}` |
//! | `GET`  | `/wholesale/product/price/detail?productId=` | `WholesalePriceDetailVO` |
//! | `POST` | `/wholesale/product/price/save` | `void` |
//! | `POST` | `/wholesale/product/price/batchSetCommon` | `{"affectedRows": n}` |
//! | `POST` | `/wholesale/product/price/batchSetByGrade` | `{"affectedRows": n}` |
//! | `GET`  | `/wholesale/product/buyRule/detail?productId=` | `WholesaleProductBuyRuleVO` |
//! | `POST` | `/wholesale/product/buyRule/save` | `void` |
//! | `POST` | `/wholesale/product/buyRule/batchSave` | `{"updatedCount": n}` |
//! | `POST` | `/wholesale/product/multiple/save` | `void` |
//!
//! # 多租户
//!
//! Java 用 `HeaderUtils.getShopId()`（平台 admin=0 / 商家=自己 shopId）；
//! Rust 鉴权中间件尚未签发 `shop_id`，本模块统一传 `0`（平台），
//! 待中间件补齐后改为从请求扩展取真实店铺 ID 即可。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::wholesale::wholesale_product::{
    WholesaleBatchCommonDTO, WholesaleBatchDeleteDTO, WholesaleBatchGradeDTO,
    WholesaleBuyRuleBatchSaveDTO, WholesaleBuyRuleSaveDTO, WholesaleMultipleSaveDTO,
    WholesalePriceDetailVO, WholesalePriceSaveDTO, WholesaleProductAddDTO,
    WholesaleProductBatchAddDTO, WholesaleProductBatchAddVO, WholesaleProductBuyRuleVO,
    WholesaleProductPageQuery, WholesaleProductVO, WholesaleSelectableProductPageQuery,
    WholesaleSelectableProductVO, MSG_PRODUCT_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 13 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 13] = [
    (
        "GET",
        "/wholesale/product/page",
        "WholesaleProductController.page",
    ),
    (
        "GET",
        "/wholesale/product/selectable/page",
        "WholesaleProductController.selectablePage",
    ),
    (
        "POST",
        "/wholesale/product/add",
        "WholesaleProductController.add",
    ),
    (
        "POST",
        "/wholesale/product/batchAdd",
        "WholesaleProductController.batchAdd",
    ),
    (
        "POST",
        "/wholesale/product/batchDelete",
        "WholesaleProductController.batchDelete",
    ),
    (
        "GET",
        "/wholesale/product/price/detail",
        "WholesaleProductController.priceDetail",
    ),
    (
        "POST",
        "/wholesale/product/price/save",
        "WholesaleProductController.priceSave",
    ),
    (
        "POST",
        "/wholesale/product/price/batchSetCommon",
        "WholesaleProductController.batchSetCommon",
    ),
    (
        "POST",
        "/wholesale/product/price/batchSetByGrade",
        "WholesaleProductController.batchSetByGrade",
    ),
    (
        "GET",
        "/wholesale/product/buyRule/detail",
        "WholesaleProductController.buyRuleDetail",
    ),
    (
        "POST",
        "/wholesale/product/buyRule/save",
        "WholesaleProductController.buyRuleSave",
    ),
    (
        "POST",
        "/wholesale/product/buyRule/batchSave",
        "WholesaleProductController.buyRuleBatchSave",
    ),
    (
        "POST",
        "/wholesale/product/multiple/save",
        "WholesaleProductController.multipleSave",
    ),
];

/// 批发商品路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wholesale/product/page", get(page))
        .route("/wholesale/product/selectable/page", get(selectable_page))
        .route("/wholesale/product/add", post(add))
        .route("/wholesale/product/batchAdd", post(batch_add))
        .route("/wholesale/product/batchDelete", post(batch_delete))
        .route("/wholesale/product/price/detail", get(price_detail))
        .route("/wholesale/product/price/save", post(price_save))
        .route(
            "/wholesale/product/price/batchSetCommon",
            post(batch_set_common),
        )
        .route(
            "/wholesale/product/price/batchSetByGrade",
            post(batch_set_grade),
        )
        .route("/wholesale/product/buyRule/detail", get(buy_rule_detail))
        .route("/wholesale/product/buyRule/save", post(buy_rule_save))
        .route(
            "/wholesale/product/buyRule/batchSave",
            post(buy_rule_batch_save),
        )
        .route("/wholesale/product/multiple/save", post(multiple_save))
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

/// 本模块当前操作的店铺 ID（平台 0，见模块头多租户说明）。
const fn shop_id() -> i32 {
    0
}

/// `productId` 查询参数（price/detail、buyRule/detail 共用）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductIdQuery {
    product_id: Option<i32>,
}

fn require_product_id(q: &ProductIdQuery) -> Result<i32, tigshop_core::Error> {
    q.product_id
        .ok_or_else(|| tigshop_core::Error::Validation(MSG_PRODUCT_ID_REQUIRED.into()))
}

/// `GET /adminapi/wholesale/product/page`
async fn page(
    State(state): State<AdminState>,
    Query(q): Query<WholesaleProductPageQuery>,
) -> ApiResult<PageResult<WholesaleProductVO>> {
    ok(state
        .wholesale
        .wholesale_product
        .page(&q, shop_id())
        .await?)
}

/// `GET /adminapi/wholesale/product/selectable/page`
async fn selectable_page(
    State(state): State<AdminState>,
    Query(q): Query<WholesaleSelectableProductPageQuery>,
) -> ApiResult<PageResult<WholesaleSelectableProductVO>> {
    ok(state
        .wholesale
        .wholesale_product
        .selectable_page(&q, shop_id())
        .await?)
}

/// `POST /adminapi/wholesale/product/add` → `{"productId": id}`
async fn add(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleProductAddDTO>,
) -> ApiResult<serde_json::Value> {
    let product_id = state
        .wholesale
        .wholesale_product
        .add(&dto, shop_id())
        .await?;
    ok(serde_json::json!({ "productId": product_id }))
}

/// `POST /adminapi/wholesale/product/batchAdd`
async fn batch_add(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleProductBatchAddDTO>,
) -> ApiResult<WholesaleProductBatchAddVO> {
    ok(state
        .wholesale
        .wholesale_product
        .batch_add(&dto, shop_id())
        .await?)
}

/// `POST /adminapi/wholesale/product/batchDelete` → `{"deletedCount": n}`
async fn batch_delete(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleBatchDeleteDTO>,
) -> ApiResult<serde_json::Value> {
    let deleted = state
        .wholesale
        .wholesale_product
        .batch_delete(&dto, shop_id())
        .await?;
    ok(serde_json::json!({ "deletedCount": deleted }))
}

/// `GET /adminapi/wholesale/product/price/detail?productId=`
async fn price_detail(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<WholesalePriceDetailVO> {
    let product_id = require_product_id(&q)?;
    ok(state
        .wholesale
        .wholesale_product
        .price_detail(product_id, shop_id())
        .await?)
}

/// `POST /adminapi/wholesale/product/price/save`
async fn price_save(
    State(state): State<AdminState>,
    Json(dto): Json<WholesalePriceSaveDTO>,
) -> ApiResult<()> {
    state
        .wholesale
        .wholesale_product
        .price_save(&dto, shop_id())
        .await?;
    ok(())
}

/// `POST /adminapi/wholesale/product/price/batchSetCommon` → `{"affectedRows": n}`
async fn batch_set_common(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleBatchCommonDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state
        .wholesale
        .wholesale_product
        .batch_set_common(&dto, shop_id())
        .await?;
    ok(serde_json::json!({ "affectedRows": affected }))
}

/// `POST /adminapi/wholesale/product/price/batchSetByGrade` → `{"affectedRows": n}`
async fn batch_set_grade(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleBatchGradeDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state
        .wholesale
        .wholesale_product
        .batch_set_grade(&dto, shop_id())
        .await?;
    ok(serde_json::json!({ "affectedRows": affected }))
}

/// `GET /adminapi/wholesale/product/buyRule/detail?productId=`
async fn buy_rule_detail(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<WholesaleProductBuyRuleVO> {
    let product_id = require_product_id(&q)?;
    ok(state
        .wholesale
        .wholesale_product
        .buy_rule_detail(product_id, shop_id())
        .await?)
}

/// `POST /adminapi/wholesale/product/buyRule/save`
async fn buy_rule_save(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleBuyRuleSaveDTO>,
) -> ApiResult<()> {
    state
        .wholesale
        .wholesale_product
        .buy_rule_save(&dto)
        .await?;
    ok(())
}

/// `POST /adminapi/wholesale/product/buyRule/batchSave` → `{"updatedCount": n}`
async fn buy_rule_batch_save(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleBuyRuleBatchSaveDTO>,
) -> ApiResult<serde_json::Value> {
    let updated = state
        .wholesale
        .wholesale_product
        .buy_rule_batch_save(&dto)
        .await?;
    ok(serde_json::json!({ "updatedCount": updated }))
}

/// `POST /adminapi/wholesale/product/multiple/save`
async fn multiple_save(
    State(state): State<AdminState>,
    Json(dto): Json<WholesaleMultipleSaveDTO>,
) -> ApiResult<()> {
    state
        .wholesale
        .wholesale_product
        .multiple_save(&dto, shop_id())
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表与契约 13 条逐字符一致，且无重复。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 13);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/wholesale/product/page",
                "/wholesale/product/selectable/page",
                "/wholesale/product/add",
                "/wholesale/product/batchAdd",
                "/wholesale/product/batchDelete",
                "/wholesale/product/price/detail",
                "/wholesale/product/price/save",
                "/wholesale/product/price/batchSetCommon",
                "/wholesale/product/price/batchSetByGrade",
                "/wholesale/product/buyRule/detail",
                "/wholesale/product/buyRule/save",
                "/wholesale/product/buyRule/batchSave",
                "/wholesale/product/multiple/save",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/wholesale/product/"), "{p} 前缀错误");
            assert!(!p.starts_with("/adminapi"));
        }
        let mut unique = paths.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), paths.len());
    }

    /// `implemented_routes()` 返回完整契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 13);
        for d in &docs {
            assert!(
                d.path.starts_with("/adminapi/wholesale/product/"),
                "{} 缺少前缀",
                d.path
            );
            assert!(d.java_ref.starts_with("WholesaleProductController."));
        }
    }

    /// method 与 Java 注解一致：page/selectable/page、price/detail、buyRule/detail 为 GET。
    #[test]
    fn http_methods_match_java_annotations() {
        let gets: Vec<&str> = ROUTE_TABLE
            .iter()
            .filter(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| *p)
            .collect();
        assert_eq!(
            gets,
            vec![
                "/wholesale/product/page",
                "/wholesale/product/selectable/page",
                "/wholesale/product/price/detail",
                "/wholesale/product/buyRule/detail",
            ]
        );
    }

    /// query 参数 camelCase（productId）。
    #[test]
    fn product_id_query_parses_camel_case() {
        let q: ProductIdQuery = serde_json::from_str(r#"{"productId":30140}"#).unwrap();
        assert_eq!(require_product_id(&q).unwrap(), 30140);
        let missing: ProductIdQuery = serde_json::from_str("{}").unwrap();
        assert!(require_product_id(&missing).is_err());
    }
}
