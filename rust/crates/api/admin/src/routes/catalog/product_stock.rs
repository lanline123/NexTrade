//! 管理端商品库存管理路由（catalog::product_stock）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.ProductStockController`
//! （`@RequestMapping("/adminapi/product/stock")`，29 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/stock/page` | `ProductStockController.page` | 登录 |
//! | `GET  /adminapi/product/stock/stockDetail` | `ProductStockController.stockDetail` | 登录 |
//! | `GET  /adminapi/product/stock/record/page` | `ProductStockController.productStockRecordPage` | 登录 |
//! | `GET  /adminapi/product/stock/getRecordDetail` | `ProductStockController.getRecordDetail` | 登录 |
//! | `POST /adminapi/product/stock/stockIn` | `ProductStockController.productStockIn` | `productStockInUpdateManage` |
//! | `POST /adminapi/product/stock/stockOut` | `ProductStockController.productStockOut` | `productStockOutUpdateManage` |
//! | `POST /adminapi/product/stock/stockAdjust` | `ProductStockController.stockAdjust` | `productStockAdjustUpdateManage` |
//! | `GET  /adminapi/product/stock/adjustDetail` | `ProductStockController.adjustDetail` | 登录 |
//! | `GET  /adminapi/product/stock/getAllocateProductStockPage` | `ProductStockController.getAllocateProductStockPage` | 登录 |
//! | `GET  /adminapi/product/stock/productStockAllocateRecordPage` | `ProductStockController.productStockAllocateRecordPage` | 登录 |
//! | `GET  /adminapi/product/stock/productStockAllocateRecordDetail` | `ProductStockController.productStockAllocateRecordDetail` | 登录 |
//! | `POST /adminapi/product/stock/createAllocate` | `ProductStockController.createAllocate` | `productStockAllocateUpdateManage` |
//! | `GET  /adminapi/product/stock/getOrgList` | `ProductStockController.getOrgList` | 登录 |
//! | `GET  /adminapi/product/stock/getAddByList` | `ProductStockController.getAddBy` | 登录 |
//! | `POST /adminapi/product/stock/auditAllocate` | `ProductStockController.auditAllocate` | `productStockAllocateUpdateManage` |
//! | `POST /adminapi/product/stock/cancelAllocate` | `ProductStockController.cancelAllocate` | `productStockAllocateUpdateManage` |
//! | `POST /adminapi/product/stock/stockOutAllocate` | `ProductStockController.stockOutAllocate` | `productStockAllocateUpdateManage` |
//! | `POST /adminapi/product/stock/stockInAllocate` | `ProductStockController.stockInAllocate` | `productStockAllocateUpdateManage` |
//! | `GET  /adminapi/product/stock/productStockAllocateOperationDetail` | `ProductStockController.productStockAllocateOperationDetail` | 登录 |
//! | `GET  /adminapi/product/stock/downloadTemplate` 等 8 个 Excel 端点 | 同名 Java 方法 | 登录/匿名 |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级权限；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs 的已知缺口一致）。
//!
//! > **组织（shopId）说明**：Java 通过 `HeaderUtils.getShopId()` 读取请求头
//! > `x-admin-type`（`admin` / `shop` / `pos`）与 `x-shop-id` 来判定当前组织；
//! > Rust 的 JWT 尚未签发 shop_id，因此本模块按**同一规则解析请求头**
//! > （见 [`shop_id_from_headers`]），语义与原实现一致。
//! > 规则：`admin` → 0（平台）；`shop` / `pos` → `x-shop-id`；缺失 → 0。
//!
//! > **⚠️ 未迁移（返回明确业务错误，不伪造实现）**：
//! > `downloadTemplate` / `batchImport` / `getImportErrorData` /
//! > `exportAllocate` / `getAllocateTemplate` / `batchImportAllocate` /
//! > `getBatchImportErrorData` / `downloadAllocateTemplate` /
//! > `batchImportAllocateProduct` / `getAllocateProductErrorData`
//! > —— 这些端点在 Java 中依赖 `ExcelUtils` + `@ResponseExcel` 直接读写
//! > `HttpServletResponse` 的二进制 Excel 流；Rust 侧未迁移该能力
//! > （`calamine` 未加入本 crate 依赖，且模板列定义需与原文件逐列对齐）。
//! > 路由已注册，调用时统一返回可读业务错误。

use axum::{
    extract::{Multipart, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::product_stock::{
    AdjustDetailQuery, AllocateBatchImportRow, AllocateExcelExportDTO, AllocatePageQuery,
    AllocateProductImportRow, AllocateStockOutDTO, AuditAllocateQuery, CreateAllocateDTO,
    ProductImportSuccessVO, ProductStockAdjustRecordDetailVO,
    ProductStockAllocateOperationRecordVO, ProductStockAllocateRecordDetailVO,
    ProductStockAllocateRecordPageVO, ProductStockDetailVO, ProductStockImportRow,
    ProductStockPageVO, ProductStockRecordVO, StockAdjustDTO, StockDetailQuery, StockInDTO,
    StockPageQuery, StockRecordPageQuery, EXCEL_UNMIGRATED_MSG,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use tigshop_services::catalog::product_stock::StockOperator;

use crate::AdminState;

/// 商品库存管理域路由（挂载于 `/adminapi` 下，故路径不含 `/adminapi` 前缀）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/stock/page", get(stock_page))
        .route("/product/stock/stockDetail", get(stock_detail))
        .route("/product/stock/record/page", get(stock_record_page))
        .route("/product/stock/getRecordDetail", get(stock_record_detail))
        .route("/product/stock/stockIn", post(stock_in))
        .route("/product/stock/stockOut", post(stock_out))
        .route("/product/stock/downloadTemplate", get(download_template))
        .route("/product/stock/batchImport", post(batch_import))
        .route(
            "/product/stock/getImportErrorData",
            post(get_import_error_data),
        )
        .route("/product/stock/stockAdjust", post(stock_adjust))
        .route("/product/stock/adjustDetail", get(adjust_detail))
        .route(
            "/product/stock/getAllocateProductStockPage",
            get(get_allocate_product_stock_page),
        )
        .route(
            "/product/stock/productStockAllocateRecordPage",
            get(allocate_record_page),
        )
        .route(
            "/product/stock/productStockAllocateRecordDetail",
            get(allocate_record_detail),
        )
        .route("/product/stock/createAllocate", post(create_allocate))
        .route("/product/stock/getOrgList", get(get_org_list))
        .route("/product/stock/getAddByList", get(get_add_by_list))
        .route("/product/stock/auditAllocate", post(audit_allocate))
        .route("/product/stock/cancelAllocate", post(cancel_allocate))
        .route("/product/stock/stockOutAllocate", post(stock_out_allocate))
        .route("/product/stock/stockInAllocate", post(stock_in_allocate))
        .route("/product/stock/exportAllocate", post(export_allocate))
        .route(
            "/product/stock/getAllocateTemplate",
            get(get_allocate_template),
        )
        .route(
            "/product/stock/batchImportAllocate",
            post(batch_import_allocate),
        )
        .route(
            "/product/stock/getBatchImportErrorData",
            post(get_batch_import_error_data),
        )
        .route(
            "/product/stock/productStockAllocateOperationDetail",
            get(allocate_operation_detail),
        )
        .route(
            "/product/stock/downloadAllocateTemplate",
            get(download_allocate_template),
        )
        .route(
            "/product/stock/batchImportAllocateProduct",
            post(batch_import_allocate_product),
        )
        .route(
            "/product/stock/getAllocateProductErrorData",
            post(get_allocate_product_error_data),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/product/stock/page",
            "ProductStockController.page",
        ),
        (
            "GET",
            "/adminapi/product/stock/stockDetail",
            "ProductStockController.stockDetail",
        ),
        (
            "GET",
            "/adminapi/product/stock/record/page",
            "ProductStockController.productStockRecordPage",
        ),
        (
            "GET",
            "/adminapi/product/stock/getRecordDetail",
            "ProductStockController.getRecordDetail",
        ),
        (
            "POST",
            "/adminapi/product/stock/stockIn",
            "ProductStockController.productStockIn",
        ),
        (
            "POST",
            "/adminapi/product/stock/stockOut",
            "ProductStockController.productStockOut",
        ),
        (
            "GET",
            "/adminapi/product/stock/downloadTemplate",
            "ProductStockController.downloadTemplate",
        ),
        (
            "POST",
            "/adminapi/product/stock/batchImport",
            "ProductStockController.batchImport",
        ),
        (
            "POST",
            "/adminapi/product/stock/getImportErrorData",
            "ProductStockController.getImportErrorData",
        ),
        (
            "POST",
            "/adminapi/product/stock/stockAdjust",
            "ProductStockController.stockAdjust",
        ),
        (
            "GET",
            "/adminapi/product/stock/adjustDetail",
            "ProductStockController.adjustDetail",
        ),
        (
            "GET",
            "/adminapi/product/stock/getAllocateProductStockPage",
            "ProductStockController.getAllocateProductStockPage",
        ),
        (
            "GET",
            "/adminapi/product/stock/productStockAllocateRecordPage",
            "ProductStockController.productStockAllocateRecordPage",
        ),
        (
            "GET",
            "/adminapi/product/stock/productStockAllocateRecordDetail",
            "ProductStockController.productStockAllocateRecordDetail",
        ),
        (
            "POST",
            "/adminapi/product/stock/createAllocate",
            "ProductStockController.createAllocate",
        ),
        (
            "GET",
            "/adminapi/product/stock/getOrgList",
            "ProductStockController.getOrgList",
        ),
        (
            "GET",
            "/adminapi/product/stock/getAddByList",
            "ProductStockController.getAddBy",
        ),
        (
            "POST",
            "/adminapi/product/stock/auditAllocate",
            "ProductStockController.auditAllocate",
        ),
        (
            "POST",
            "/adminapi/product/stock/cancelAllocate",
            "ProductStockController.cancelAllocate",
        ),
        (
            "POST",
            "/adminapi/product/stock/stockOutAllocate",
            "ProductStockController.stockOutAllocate",
        ),
        (
            "POST",
            "/adminapi/product/stock/stockInAllocate",
            "ProductStockController.stockInAllocate",
        ),
        (
            "POST",
            "/adminapi/product/stock/exportAllocate",
            "ProductStockController.exportAllocate",
        ),
        (
            "GET",
            "/adminapi/product/stock/getAllocateTemplate",
            "ProductStockController.getAllocateTemplate",
        ),
        (
            "POST",
            "/adminapi/product/stock/batchImportAllocate",
            "ProductStockController.batchImportAllocate",
        ),
        (
            "POST",
            "/adminapi/product/stock/getBatchImportErrorData",
            "ProductStockController.getBatchImportErrorData",
        ),
        (
            "GET",
            "/adminapi/product/stock/productStockAllocateOperationDetail",
            "ProductStockController.productStockAllocateOperationDetail",
        ),
        (
            "GET",
            "/adminapi/product/stock/downloadAllocateTemplate",
            "ProductStockController.downloadAllocateTemplate",
        ),
        (
            "POST",
            "/adminapi/product/stock/batchImportAllocateProduct",
            "ProductStockController.batchImportAllocateProduct",
        ),
        (
            "POST",
            "/adminapi/product/stock/getAllocateProductErrorData",
            "ProductStockController.getAllocateProductErrorData",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 组织 ID / 操作人（替代 Java HeaderUtils + SecurityUtils）
// ——————————————————————————————————————————————

/// 解析当前组织 ID。
///
/// 等价 Java `HeaderUtils.getShopId()`：
/// - `x-admin-type: admin` → 0（平台）；
/// - `x-admin-type: shop|pos` → `x-shop-id`（缺失即 0，Java 为 `null` → 服务层兜底 0）；
/// - 其他/缺失 → 0（Java 返回 `null`，服务层 `== null ? 0 : getShopId()`）。
///
/// 注意：Java 服务层多处写的是 `HeaderUtils.getShopId() == null ? 0 : ...`，
/// 因此「缺失」与「0」在业务上等价。
#[must_use]
pub fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 由请求头 + JWT 身份构造服务层操作上下文。
#[must_use]
pub fn operator_from(headers: &axum::http::HeaderMap, auth: &AuthUser) -> StockOperator {
    StockOperator::new(shop_id_from_headers(headers), Some(auth.username.clone()))
}

// ——————————————————————————————————————————————
// 查询
// ——————————————————————————————————————————————

/// `GET /adminapi/product/stock/page`：获取库存列表。
///
/// 对应 Java `ProductStockController.page(ProductStockDTO)`：
/// `shopId` 为空时用请求头兜底。
async fn stock_page(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<StockPageQuery>,
) -> ApiResult<PageResult<ProductStockPageVO>> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.stock_page(&q, &op).await?)
}

/// `GET /adminapi/product/stock/stockDetail`：获取出入库明细。
///
/// 对应 Java `ProductStockController.stockDetail(ProductStockDetailDTO)`
/// → `ProductInventoryLogServiceImpl#getDetail`。
async fn stock_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<StockDetailQuery>,
) -> ApiResult<PageResult<ProductStockDetailVO>> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.stock_detail(&q, &op).await?)
}

/// `GET /adminapi/product/stock/record/page`：获取出入库列表。
///
/// 对应 Java `ProductStockController.productStockRecordPage(ProductStockDTO)`。
async fn stock_record_page(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<StockRecordPageQuery>,
) -> ApiResult<PageResult<ProductStockRecordVO>> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.record_page(&q, &op).await?)
}

/// `GET /adminapi/product/stock/getRecordDetail?id=`：获取出入库详情。
///
/// 对应 Java `ProductStockController.getRecordDetail(@RequestParam("id") Integer)`。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

async fn stock_record_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ProductStockRecordVO> {
    ok(state.catalog.product_stock.record_detail(q.id).await?)
}

/// `GET /adminapi/product/stock/adjustDetail?productId=&skuId=`：商品调整记录。
///
/// 对应 Java `ProductStockController.adjustDetail(@RequestParam productId,
/// @RequestParam(required=false) skuId)`。
async fn adjust_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<AdjustDetailQuery>,
) -> ApiResult<Vec<ProductStockAdjustRecordDetailVO>> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.adjust_detail(&q, &op).await?)
}

/// 调拨导入的出/入库组织查询参数（Java `@RequestParam shopId/targetShopId`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AllocateShopQuery {
    shop_id: Option<i32>,
    target_shop_id: Option<i32>,
}

/// `GET /adminapi/product/stock/getAllocateProductStockPage`：获取可调拨商品列表。
///
/// 对应 Java `ProductStockController.getAllocateProductStockPage(ProductStockDTO)`。
async fn get_allocate_product_stock_page(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<StockPageQuery>,
) -> ApiResult<PageResult<ProductStockPageVO>> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .allocate_product_stock_page(&q, &op)
        .await?)
}

/// `GET /adminapi/product/stock/productStockAllocateRecordPage`：库存调拨记录。
///
/// 对应 Java `ProductStockController.productStockAllocateRecordPage(
/// ProductStockAllocateRecordDTO)`。
async fn allocate_record_page(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<AllocatePageQuery>,
) -> ApiResult<PageResult<ProductStockAllocateRecordPageVO>> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .allocate_record_page(&q, &op)
        .await?)
}

/// `GET /adminapi/product/stock/productStockAllocateRecordDetail?id=`：库存调拨记录详情。
///
/// 对应 Java `ProductStockController.productStockAllocateRecordDetail(
/// @RequestParam("id") Integer)`。
async fn allocate_record_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ProductStockAllocateRecordDetailVO> {
    ok(state
        .catalog
        .product_stock
        .allocate_record_detail(q.id)
        .await?)
}

/// `GET /adminapi/product/stock/getOrgList`：组织集合。
///
/// 对应 Java `ProductStockController.getOrgList()`。
async fn get_org_list(
    State(state): State<AdminState>,
) -> ApiResult<Vec<tigshop_core::models::catalog::product_stock::AllocateOrgVO>> {
    ok(state.catalog.product_stock.get_org_list().await?)
}

/// `GET /adminapi/product/stock/getAddByList`：获取经办人集合。
///
/// 对应 Java `ProductStockController.getAddBy()`。
async fn get_add_by_list(State(state): State<AdminState>) -> ApiResult<Vec<String>> {
    ok(state.catalog.product_stock.get_add_by_list().await?)
}

/// `GET /adminapi/product/stock/productStockAllocateOperationDetail?allocateId=`：
/// 库存调拨操作记录详情。
///
/// 对应 Java `ProductStockController.productStockAllocateOperationDetail(
/// @RequestParam("allocateId") Integer)`。
///
/// ⚠️ 必须带 `rename_all = "camelCase"`：Java 参数名是 **`allocateId`**，
/// 缺这个属性时 serde 只认 `allocate_id`，前端传 `?allocateId=1` 会 400。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AllocateIdQuery {
    allocate_id: i32,
}

async fn allocate_operation_detail(
    State(state): State<AdminState>,
    Query(q): Query<AllocateIdQuery>,
) -> ApiResult<Vec<ProductStockAllocateOperationRecordVO>> {
    ok(state
        .catalog
        .product_stock
        .allocate_operation_detail(q.allocate_id)
        .await?)
}

// ——————————————————————————————————————————————
// 入库 / 出库 / 调整
// ——————————————————————————————————————————————

/// `POST /adminapi/product/stock/stockIn`：商品入库。
///
/// 对应 Java `ProductStockController.productStockIn(@RequestBody ProductStockInDTO)`。
/// Java 返回 `boolean`；Rust 返回创建的出入库记录 ID（`data` 由 `true` 变为对象结构，
/// 便于运维定位；成功语义一致）。
async fn stock_in(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<StockInDTO>,
) -> ApiResult<serde_json::Value> {
    let op = operator_from(&headers, &auth);
    let record_id = state.catalog.product_stock.stock_in(&dto, &op).await?;
    ok(serde_json::json!({ "productStockId": record_id }))
}

/// `POST /adminapi/product/stock/stockOut`：商品出库。
///
/// 对应 Java `ProductStockController.productStockOut(@RequestBody ProductStockInDTO)`。
async fn stock_out(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<StockInDTO>,
) -> ApiResult<serde_json::Value> {
    let op = operator_from(&headers, &auth);
    let record_id = state.catalog.product_stock.stock_out(&dto, &op).await?;
    ok(serde_json::json!({ "productStockId": record_id }))
}

/// `POST /adminapi/product/stock/stockAdjust`：商品库存调整。
///
/// 对应 Java `ProductStockController.stockAdjust(@RequestBody ProductStockAdjustDTO)`。
async fn stock_adjust(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<StockAdjustDTO>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.stock_adjust(&dto, &op).await?)
}

// ——————————————————————————————————————————————
// 调拨写操作
// ——————————————————————————————————————————————

/// `POST /adminapi/product/stock/createAllocate`：新建调拨单。
///
/// 对应 Java `ProductStockController.createAllocate(
/// @RequestBody ProductStockAllocateRecordCreateDTO)`。
async fn create_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<CreateAllocateDTO>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .create_allocate(&dto, &op)
        .await?)
}

/// `POST /adminapi/product/stock/auditAllocate?id=&auditType=&remark=`：调拨审核。
///
/// 对应 Java `ProductStockController.auditAllocate(@RequestParam id,
/// @RequestParam auditType, @RequestParam(required=false) remark)` —— 参数在 query 上。
async fn audit_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Query(q): Query<AuditAllocateQuery>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state.catalog.product_stock.audit_allocate(&q, &op).await?)
}

/// `POST /adminapi/product/stock/cancelAllocate`：调拨作废。
///
/// 对应 Java `ProductStockController.cancelAllocate(@RequestBody List<Integer>)`。
async fn cancel_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(ids): Json<Vec<i32>>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .cancel_allocate(&ids, &op)
        .await?)
}

/// `POST /adminapi/product/stock/stockOutAllocate`：调拨出库。
///
/// 对应 Java `ProductStockController.stockOutAllocate(@RequestBody AllocateStockOutDTO)`。
async fn stock_out_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<AllocateStockOutDTO>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .stock_out_allocate(&dto, &op)
        .await?)
}

/// `POST /adminapi/product/stock/stockInAllocate`：调拨入库。
///
/// 对应 Java `ProductStockController.stockInAllocate(@RequestBody AllocateStockOutDTO)`。
async fn stock_in_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<AllocateStockOutDTO>,
) -> ApiResult<bool> {
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .stock_in_allocate(&dto, &op)
        .await?)
}

/// `POST /adminapi/product/stock/exportAllocate`：调拨单导出。
///
/// 对应 Java `ProductStockController.exportAllocate(
/// @RequestBody ProductStockAllocateExcelExportDTO)`（`@ResponseExcel` 二进制流）。
/// **未迁移**：返回明确业务错误。
async fn export_allocate(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<AllocateExcelExportDTO>,
) -> std::result::Result<axum::response::Response, AppError> {
    let shop_id = shop_id_from_headers(&headers);
    let (file_name, bytes) = state
        .catalog
        .product_stock
        .export_allocate_xlsx(&dto, shop_id)
        .await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes, &file_name,
    ))
}

// ——————————————————————————————————————————————
// Excel 端点（全部未迁移：路由已注册，调用即返回明确业务错误）
// ——————————————————————————————————————————————

/// 统一的「Excel 能力未迁移」响应。
///
/// `ApiResult<T>` 即 `Result<Json<ApiResponse<T>>, AppError>`，而核心 crate 的
/// `ApiResponse<T: Serialize>` 在类型参数上带 `Serialize` 约束，故这里必须带上
/// 同一约束；错误侧按 product_manage 的既有写法用 `AppError` 包装业务错误
/// （`tigshop_security::web::AppError`）。
fn excel_unmigrated<T: serde::Serialize>() -> ApiResult<T> {
    Err(AppError(Error::biz_msg(EXCEL_UNMIGRATED_MSG)))
}

/// `GET /adminapi/product/stock/downloadTemplate`：下载商品导入模版。
///
/// 对应 Java `ProductStockController.downloadTemplate(HttpServletResponse)`。
/// **未迁移**（`@ResponseExcel` 二进制流）。
async fn download_template() -> std::result::Result<axum::response::Response, AppError> {
    // 对应 Java `ProductStockOutExcelDTO` 的列：商品名称 / 商品编码 / 商品规格名称 / 商品出入库数量 / 备注
    let headers = [
        "商品名称",
        "商品编码",
        "商品规格名称",
        "商品出入库数量",
        "备注",
    ];
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "商品出入库模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "product_stock_template.xlsx",
    ))
}

/// `POST /adminapi/product/stock/batchImport`：批量导入商品（校验预览）。
///
/// 对应 Java `ProductStockController.batchImport(@RequestParam("file") MultipartFile)`。
async fn batch_import(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> ApiResult<Vec<ProductImportSuccessVO>> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_stock_import_rows(&bytes)?;
    if rows.is_empty() {
        return Err(AppError(Error::biz_msg("表格数据为空")));
    }
    let shop_id = shop_id_from_headers(&headers);
    let (success, errors) = state
        .catalog
        .product_stock
        .import_preview(&rows, shop_id)
        .await?;
    if !errors.is_empty() {
        return Err(AppError(Error::biz_msg(format!(
            "导入失败:共导入{}个,失败{}个",
            rows.len(),
            errors.len()
        ))));
    }
    ok(success)
}

/// `POST /adminapi/product/stock/getImportErrorData`：获取导入失败的数据（xlsx）。
async fn get_import_error_data(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_stock_import_rows(&bytes)?;
    let shop_id = shop_id_from_headers(&headers);
    let (_, errors) = state
        .catalog
        .product_stock
        .import_preview(&rows, shop_id)
        .await?;
    let headers_out = [
        "商品名称",
        "商品编码",
        "商品规格名称",
        "商品出入库数量",
        "备注",
        "错误信息",
    ];
    let data: Vec<Vec<String>> = errors
        .iter()
        .map(|e| {
            vec![
                e.product_name.clone().unwrap_or_default(),
                e.product_sn.clone().unwrap_or_default(),
                e.product_sku_name.clone().unwrap_or_default(),
                e.quantity.clone().unwrap_or_default(),
                e.comment.clone().unwrap_or_default(),
                e.error_msg.clone(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers_out, &data, "导入错误数据")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "product_stock_import_error.xlsx",
    ))
}

/// 读取 multipart 中的 `file` 字段。
async fn read_upload_file(multipart: &mut Multipart) -> Result<Vec<u8>, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError(Error::Validation(format!("读取上传文件失败: {e}"))))?
    {
        if field.name() == Some("file") {
            return field
                .bytes()
                .await
                .map(|b| b.to_vec())
                .map_err(|e| AppError(Error::Validation(format!("读取上传文件失败: {e}"))));
        }
    }
    Err(AppError(Error::Validation("请上传文件".into())))
}

/// 解析商品出入库导入 xlsx（首行表头；列序与 Java DTO 一致）。
fn parse_stock_import_rows(bytes: &[u8]) -> Result<Vec<ProductStockImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes).map_err(AppError)?;
    let mut rows = Vec::new();
    for line in sheet.iter().skip(1) {
        let get = |i: usize| {
            line.get(i)
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        let row = ProductStockImportRow {
            product_name: get(0),
            product_sn: get(1),
            product_sku_name: get(2),
            quantity: get(3),
            comment: get(4),
        };
        if row.product_sn.is_some() || row.product_name.is_some() {
            rows.push(row);
        }
    }
    Ok(rows)
}

/// `GET /adminapi/product/stock/getAllocateTemplate`：下载导入调拨单 Excel。
async fn get_allocate_template() -> std::result::Result<axum::response::Response, AppError> {
    let headers = [
        "出库门店",
        "入库门店",
        "备注",
        "商品名称",
        "商品编码",
        "商品规格名称",
        "数量",
    ];
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "调拨单导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "allocate_template.xlsx",
    ))
}

/// `POST /adminapi/product/stock/batchImportAllocate`：批量导入并创建调拨单。
async fn batch_import_allocate(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
    mut multipart: Multipart,
) -> ApiResult<bool> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_allocate_batch_rows(&bytes)?;
    if rows.is_empty() {
        return Err(AppError(Error::biz_msg("表格数据为空")));
    }
    let op = operator_from(&headers, &auth);
    ok(state
        .catalog
        .product_stock
        .batch_import_allocate(&rows, &op)
        .await?)
}

/// `POST /adminapi/product/stock/getBatchImportErrorData`：调拨单导入失败数据 xlsx。
async fn get_batch_import_error_data(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_allocate_batch_rows(&bytes)?;
    let (_, _, errors) = state
        .catalog
        .product_stock
        .allocate_import_validate(&rows)
        .await?;
    let headers_out = [
        "出库门店",
        "入库门店",
        "备注",
        "商品名称",
        "商品编码",
        "商品规格名称",
        "数量",
        "错误信息",
    ];
    let data: Vec<Vec<String>> = errors
        .iter()
        .map(|e| {
            vec![
                e.stock_out_org.clone().unwrap_or_default(),
                e.stock_in_org.clone().unwrap_or_default(),
                e.comment.clone().unwrap_or_default(),
                e.product_name.clone().unwrap_or_default(),
                e.product_sn.clone().unwrap_or_default(),
                e.sku_name.clone().unwrap_or_default(),
                e.quantity.clone().unwrap_or_default(),
                e.error_msg.clone(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers_out, &data, "调拨错误数据")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "allocate_import_error.xlsx",
    ))
}

/// 解析调拨单导入 xlsx（列序与 `AllocateBatchImportVO` 一致）。
fn parse_allocate_batch_rows(bytes: &[u8]) -> Result<Vec<AllocateBatchImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes).map_err(AppError)?;
    let mut rows = Vec::new();
    for line in sheet.iter().skip(1) {
        let get = |i: usize| {
            line.get(i)
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        let row = AllocateBatchImportRow {
            stock_out_org: get(0),
            stock_in_org: get(1),
            comment: get(2),
            product_name: get(3),
            product_sn: get(4),
            sku_name: get(5),
            quantity: get(6),
        };
        if row.product_sn.is_some() || row.stock_out_org.is_some() {
            rows.push(row);
        }
    }
    Ok(rows)
}

/// `GET /adminapi/product/stock/downloadAllocateTemplate`：下载调拨商品导入模版。
async fn download_allocate_template() -> std::result::Result<axum::response::Response, AppError> {
    let headers = ["商品名称", "商品编码", "商品规格名称", "商品调拨库数量"];
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "调拨商品导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "allocate_product_template.xlsx",
    ))
}

/// `POST /adminapi/product/stock/batchImportAllocateProduct`：批量导入调拨商品（校验预览）。
async fn batch_import_allocate_product(
    State(state): State<AdminState>,
    Query(q): Query<AllocateShopQuery>,
    mut multipart: Multipart,
) -> ApiResult<Vec<ProductImportSuccessVO>> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_allocate_product_rows(&bytes)?;
    if rows.is_empty() {
        return Err(AppError(Error::biz_msg("表格数据为空")));
    }
    let shop_id = q
        .shop_id
        .ok_or_else(|| AppError(Error::biz_msg("请选择出库组织")))?;
    let target_shop_id = q
        .target_shop_id
        .ok_or_else(|| AppError(Error::biz_msg("请选择入库组织")))?;
    let (success, errors) = state
        .catalog
        .product_stock
        .allocate_product_preview(&rows, shop_id, target_shop_id)
        .await?;
    if !errors.is_empty() {
        return Err(AppError(Error::biz_msg(format!(
            "导入失败:共导入{}个,失败{}个",
            rows.len(),
            errors.len()
        ))));
    }
    ok(success)
}

/// `POST /adminapi/product/stock/getAllocateProductErrorData`：调拨商品导入失败数据 xlsx。
async fn get_allocate_product_error_data(
    State(state): State<AdminState>,
    Query(q): Query<AllocateShopQuery>,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_allocate_product_rows(&bytes)?;
    let shop_id = q
        .shop_id
        .ok_or_else(|| AppError(Error::biz_msg("请选择出库组织")))?;
    let target_shop_id = q
        .target_shop_id
        .ok_or_else(|| AppError(Error::biz_msg("请选择入库组织")))?;
    let (_, errors) = state
        .catalog
        .product_stock
        .allocate_product_preview(&rows, shop_id, target_shop_id)
        .await?;
    let headers_out = [
        "商品名称",
        "商品编码",
        "商品规格名称",
        "商品调拨库数量",
        "错误信息",
    ];
    let data: Vec<Vec<String>> = errors
        .iter()
        .map(|e| {
            vec![
                e.product_name.clone().unwrap_or_default(),
                e.product_sn.clone().unwrap_or_default(),
                e.product_sku_name.clone().unwrap_or_default(),
                e.quantity.clone().unwrap_or_default(),
                e.error_msg.clone(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers_out, &data, "调拨导入错误")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "allocate_product_import_error.xlsx",
    ))
}

/// 解析调拨商品导入 xlsx（列序与 `AllocateProductImportExcelDTO` 一致）。
fn parse_allocate_product_rows(bytes: &[u8]) -> Result<Vec<AllocateProductImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes).map_err(AppError)?;
    let mut rows = Vec::new();
    for line in sheet.iter().skip(1) {
        let get = |i: usize| {
            line.get(i)
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        let row = AllocateProductImportRow {
            product_name: get(0),
            product_sn: get(1),
            product_sku_name: get(2),
            quantity: get(3),
        };
        if row.product_sn.is_some() || row.product_name.is_some() {
            rows.push(row);
        }
    }
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};
    use std::str::FromStr;

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
    fn shop_id_follows_java_header_utils() {
        // admin → 平台 0（忽略 x-shop-id）
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
        // shop → 取 x-shop-id
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        // pos → 取 x-shop-id
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
        // shop 但缺 x-shop-id → 0（Java 返回 null，服务层兜底 0）
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            0
        );
        // 未带 admin-type → 0
        assert_eq!(shop_id_from_headers(&headers(&[])), 0);
        // 非法 shop-id → 0
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            0
        );
    }

    #[test]
    fn implemented_routes_cover_all_29_endpoints() {
        let routes = implemented_routes();
        assert_eq!(routes.len(), 29);
        // 路径必须在 /adminapi 前缀下，且不出现重复
        let mut paths: Vec<String> = routes.iter().map(|r| r.path.clone()).collect();
        let before = paths.len();
        paths.sort();
        paths.dedup();
        assert_eq!(paths.len(), before, "路由路径不能重复");
        assert!(paths
            .iter()
            .all(|p| p.starts_with("/adminapi/product/stock/")));
        // 抽查控制器前缀重复的写法（本控制器前缀为 /adminapi/product/stock）
        assert!(paths.contains(&"/adminapi/product/stock/page".to_string()));
    }
}
