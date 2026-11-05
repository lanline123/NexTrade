//! 供应商商品路由（vendor::vendor_product）。
//!
//! Java 来源（overseas）：
//! - `VendorProductController`（`@RequestMapping("/adminapi/vendor/product")`）：
//!   `pageList` / `clientPage`
//! - `VendorProductBatchController`（`@RequestMapping("/adminapi/vendor/productBatch")`）：
//!   `downloadTemplate` / `vendorProductBatchDeal` / `vendorProductBatchModify` /
//!   `vendorProductBatchEdit`
//! - `ProductController`（`@RequestMapping("/adminapi/product/product")`）：
//!   `getVendorMaxPrice`（**GET**，`:248`）/ `vendorProductImport`（POST，`:236`）/
//!   `vendorProductReImport`（POST，`:242`）
//!
//! ⚠️ `vendorProductBatchDeal` 在 Java 里是 `@ResponseExcel` **GET 导出**；
//! 前端 `vendorProductBatchExportSubmit` 也用 GET（arraybuffer）。
//! 本模块同时注册 GET 与 POST（任务口径按 POST 记录），两者都返回 xlsx 流。
//!
//! Excel 下载响应：与 `catalog/product_manage.rs::download_template` 同口径
//! （`Content-Type: xlsx` + `Content-Disposition`）。

use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::vendor::vendor_product::{
    VendorProductBatchDealDTO, VendorProductBatchEditDTO, VendorProductClientPageQuery,
    VendorProductImportParam, VendorProductPageQuery, VendorProductPageVO,
    VendorProductReImportParam,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 8 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/vendor/product/pageList",
        "VendorProductController.pageList",
    ),
    (
        "GET",
        "/vendor/product/clientPage",
        "VendorProductController.clientPage",
    ),
    (
        "GET",
        "/vendor/productBatch/downloadTemplate",
        "VendorProductBatchController.downloadTemplate",
    ),
    (
        "GET",
        "/vendor/productBatch/vendorProductBatchDeal",
        "VendorProductBatchController.vendorProductBatchDeal",
    ),
    (
        "POST",
        "/vendor/productBatch/vendorProductBatchDeal",
        "VendorProductBatchController.vendorProductBatchDeal",
    ),
    (
        "POST",
        "/vendor/productBatch/vendorProductBatchModify",
        "VendorProductBatchController.vendorProductBatchModify",
    ),
    (
        "POST",
        "/vendor/productBatch/vendorProductBatchEdit",
        "VendorProductBatchController.vendorProductBatchEdit",
    ),
    (
        "GET",
        "/product/product/getVendorMaxPrice",
        "ProductController.getVendorMaxPrice",
    ),
];

/// 域路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/vendor/product/pageList", get(page_list))
        .route("/vendor/product/clientPage", get(client_page))
        .route(
            "/vendor/productBatch/downloadTemplate",
            get(download_template),
        )
        .route(
            "/vendor/productBatch/vendorProductBatchDeal",
            get(batch_deal).post(batch_deal),
        )
        .route(
            "/vendor/productBatch/vendorProductBatchModify",
            post(batch_modify),
        )
        .route(
            "/vendor/productBatch/vendorProductBatchEdit",
            post(batch_edit),
        )
        .route("/product/product/getVendorMaxPrice", get(vendor_max_price))
        .route("/product/product/vendorProductImport", post(vendor_import))
        .route(
            "/product/product/vendorProductReImport",
            post(vendor_re_import),
        )
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let mut out: Vec<tigshop_openapi::RouteDoc> = ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect();
    // ROUTE_TABLE 静态可查，POST 两条导入接口单独补录
    out.push(tigshop_openapi::RouteDoc::new(
        "POST",
        "/adminapi/product/product/vendorProductImport",
        "ProductController.vendorProductImport",
    ));
    out.push(tigshop_openapi::RouteDoc::new(
        "POST",
        "/adminapi/product/product/vendorProductReImport",
        "ProductController.vendorProductReImport",
    ));
    out
}

/// xlsx 下载响应（与 product_manage 的 download_template 同口径）。
fn xlsx_response(bytes: Vec<u8>) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    );
    let disposition =
        "attachment; filename=\"vendor_product.xlsx\"; filename*=UTF-8''vendor_product.xlsx";
    if let Ok(value) = HeaderValue::from_str(disposition) {
        headers.insert(header::CONTENT_DISPOSITION, value);
    }
    (headers, bytes).into_response()
}

/// `GET /adminapi/vendor/product/pageList`：供应商商品分页。
async fn page_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<VendorProductPageQuery>,
) -> ApiResult<PageResult<VendorProductPageVO>> {
    ok(state
        .vendor
        .vendor_product
        .page_list(&q, tenant.vendor_scope())
        .await?)
}

/// `GET /adminapi/vendor/product/clientPage`：供应商商品客户端分页。
async fn client_page(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<VendorProductClientPageQuery>,
) -> ApiResult<PageResult<VendorProductPageVO>> {
    ok(state
        .vendor
        .vendor_product
        .client_page(&q, tenant.vendor_scope())
        .await?)
}

/// `GET /adminapi/vendor/productBatch/downloadTemplate`：导入模板 xlsx。
async fn download_template(State(state): State<AdminState>) -> Response {
    match state.vendor.vendor_product.download_template() {
        Ok(bytes) => xlsx_response(bytes),
        Err(e) => AppError(e).into_response(),
    }
}

/// `GET|POST /adminapi/vendor/productBatch/vendorProductBatchDeal`：导出 xlsx。
async fn batch_deal(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(dto): Query<VendorProductBatchDealDTO>,
) -> Response {
    match state
        .vendor
        .vendor_product
        .batch_deal_export(&dto, tenant.vendor_scope())
        .await
    {
        Ok(bytes) => xlsx_response(bytes),
        Err(e) => AppError(e).into_response(),
    }
}

/// `POST /adminapi/vendor/productBatch/vendorProductBatchModify`：Excel 导入改价改库存。
async fn batch_modify(
    State(state): State<AdminState>,
    mut multipart: axum::extract::Multipart,
) -> ApiResult<serde_json::Value> {
    let mut bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "解析上传表单失败: {e}"
        )))
    })? {
        if field.name() == Some("file") {
            let data = field
                .bytes()
                .await
                .map_err(|e| {
                    AppError(tigshop_core::Error::Validation(format!(
                        "读取上传文件失败: {e}"
                    )))
                })?
                .to_vec();
            bytes = Some(data);
        }
    }
    let bytes = bytes
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("缺少上传文件 file".into())))?;
    let (success, errors) = state
        .vendor
        .vendor_product
        .batch_modify_excel(&bytes)
        .await?;
    ok(serde_json::json!({
        "successCount": success,
        "failCount": errors.len(),
        "errorList": errors,
    }))
}

/// `POST /adminapi/vendor/productBatch/vendorProductBatchEdit`：批量编辑。
async fn batch_edit(
    State(state): State<AdminState>,
    Json(dto): Json<VendorProductBatchEditDTO>,
) -> ApiResult<&'static str> {
    state.vendor.vendor_product.batch_edit(&dto).await?;
    ok("修改成功")
}

/// `GET /adminapi/product/product/getVendorMaxPrice?vendorProductSkuId=`。
async fn vendor_max_price(
    State(state): State<AdminState>,
    Query(q): Query<SkuIdQuery>,
) -> ApiResult<rust_decimal::Decimal> {
    let sku_id = q.vendor_product_sku_id.filter(|x| *x > 0).ok_or_else(|| {
        AppError(tigshop_core::Error::Validation(
            "vendorProductSkuId 不能为空".into(),
        ))
    })?;
    ok(state.vendor.vendor_product.vendor_max_price(sku_id).await?)
}

/// `POST /adminapi/product/product/vendorProductImport`：vendor_product → product。
async fn vendor_import(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(p): Json<VendorProductImportParam>,
) -> ApiResult<&'static str> {
    // Java 用 HeaderUtils.getShopId()；店铺账号固定自己的 shop_id，平台缺省 0
    let shop_id = auth.scoped_shop_id().unwrap_or(0);
    state
        .vendor
        .vendor_product
        .vendor_product_import(&p, shop_id)
        .await?;
    ok("导入成功")
}

/// `POST /adminapi/product/product/vendorProductReImport`：重导。
async fn vendor_re_import(
    State(state): State<AdminState>,
    Json(p): Json<VendorProductReImportParam>,
) -> ApiResult<&'static str> {
    state
        .vendor
        .vendor_product
        .vendor_product_re_import(&p)
        .await?;
    ok("重新导入成功")
}

/// `?vendorProductSkuId=` 查询参数。
#[derive(Debug, Default, Deserialize)]
struct SkuIdQuery {
    vendor_product_sku_id: Option<i64>,
}
