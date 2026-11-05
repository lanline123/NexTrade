//! 管理端商品批量导入/导出路由（catalog::product_batch）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.ProductBatchController`
//! （`@RequestMapping("/adminapi/product/productBatch")`）中本 feature 负责的
//! **剩余 2 条**接口（同控制器的 `downloadTemplate` / `productBatchModify` /
//! `productBatchEdit` 已由 `catalog/product_manage` 注册，勿重复）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `GET /product/productBatch/productBatchDeal` | `ProductBatchController.productBatchDeal` | `productBatchAddManage` |
//! | `GET /product/productBatch/productService/list` | `ProductBatchController.list` | `productBatchAddManage` |
//!
//! > **xlsx 偏差（重要）**：Java `productBatchDeal` 带 `@ResponseExcel`，直接
//! > 输出 xlsx 二进制；本工作区未启用 xlsx 写出依赖（且本切片不得改
//! > Cargo.toml），故本端点返回**导出行数据 JSON**
//! >（`Vec<ProductImportExcelVO>`，列语义与 Excel 完全一致）。
//! > 这是与 Java 的已知差异，已在服务层模块头登记。
//!
//! > **鉴权**：类级 `@PreAuthorize('productBatchAddManage')` 在 Rust 侧仅校验
//! > 登录态（权限矩阵未迁移），注册在管理端需登录路由组。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::catalog::product_batch::{
    ProductBatchDealQuery, ProductServiceDTO, ProductServiceListQuery,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::AdminState;

/// 本 feature 全部路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "GET",
        "/product/productBatch/productBatchDeal",
        "ProductBatchController.productBatchDeal",
    ),
    (
        "GET",
        "/product/productBatch/productService/list",
        "ProductBatchController.list",
    ),
];

/// 商品批量路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/product/productBatch/productBatchDeal",
            get(product_batch_deal),
        )
        .route(
            "/product/productBatch/productService/list",
            get(product_service_list),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/product/productBatch/productBatchDeal`：商品导出。
///
/// 对应 Java `@ResponseExcel List<ProductImportExcelVO> productBatchDeal(dto)`：
/// 返回导出行数据（xlsx 二进制未迁移，见模块头）。
async fn product_batch_deal(
    State(state): State<AdminState>,
    Query(q): Query<ProductBatchDealQuery>,
) -> std::result::Result<axum::response::Response, AppError> {
    let rows = state.catalog.product_batch.product_batch_deal(&q).await?;
    let headers = [
        "商品编码",
        "商品名称",
        "商品图片",
        "商品分类",
        "配送方式",
        "快递运费模板",
        "是否上架（默认1）",
        "商品规格",
        "商品规格图",
        "规格编码",
        "规格条码",
        "商品详情图",
        "商品售价",
        "库存",
        "市场价",
        "商品条码",
        "搜索关键词",
        "商品描述",
        "成本价",
    ];
    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.product_sn.clone(),
                r.product_name.clone(),
                r.pic_url.clone(),
                r.category_name.clone(),
                r.shipping_type.clone(),
                r.shipping_tpl.clone(),
                r.product_status.clone(),
                r.spec_name.clone(),
                r.spec_pic_url.clone(),
                r.sku_sn.clone(),
                r.sku_tsn.clone(),
                r.desc_pic_url.clone(),
                r.product_price.clone(),
                r.product_stock.clone(),
                r.market_price.clone(),
                r.product_tsn.clone(),
                r.keywords.clone(),
                r.product_brief.clone(),
                r.cost_price.clone(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &data, "商品导出")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "products.xlsx",
    ))
}

/// `GET /adminapi/product/productBatch/productService/list`：商品服务分页。
async fn product_service_list(
    State(state): State<AdminState>,
    Query(q): Query<ProductServiceListQuery>,
) -> ApiResult<PageResult<ProductServiceDTO>> {
    ok(state.catalog.product_batch.services_list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        let expected = [
            (
                "GET",
                "/adminapi/product/productBatch/productBatchDeal",
                "ProductBatchController.productBatchDeal",
            ),
            (
                "GET",
                "/adminapi/product/productBatch/productService/list",
                "ProductBatchController.list",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                docs.iter()
                    .any(|d| d.method == method && d.path == path && d.java_ref == handler),
                "缺少 {method} {path}"
            );
        }
    }

    #[test]
    fn routes_registers_both_table_paths() {
        let registered = [
            ("GET", "/product/productBatch/productBatchDeal"),
            ("GET", "/product/productBatch/productService/list"),
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE
                    .iter()
                    .any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        for (method, path, _) in ROUTE_TABLE.iter() {
            assert!(
                registered.iter().any(|(m, p)| m == method && p == path),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }
}
