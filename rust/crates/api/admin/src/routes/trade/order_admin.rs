//! 管理端订单管理路由（trade::order_admin）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.order.OrderController`
//! （`@RequestMapping("/adminapi/order/order")`，34 条接口：wave1 已实现 4 条 +
//! wave3 本次扩展 30 条）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET  /order/order/list` | `OrderController.list` |
//! | `GET  /order/order/statusCount` | `OrderController.statusCount` |
//! | `GET  /order/order/detail` | `OrderController.detail` |
//! | `POST /order/order/setAdminNote` | `OrderController.setAdminNote` |
//! | `GET  /order/order/parentDetail` | `OrderController.parentOrderDetail` |
//! | `POST /order/order/setConfirm` | `OrderController.setConfirm` |
//! | `POST /order/order/splitStoreOrder` | `OrderController.splitStoreOrder` |
//! | `POST /order/order/setPaid` | `OrderController.setPaid` |
//! | `POST /order/order/cancelOrder` | `OrderController.cancelOrder` |
//! | `POST /order/order/delOrder` | `OrderController.delOrder` |
//! | `POST /order/order/modifyMoney` | `OrderController.modifyMoney` |
//! | `POST /order/order/modifyConsignee` | `OrderController.modifyConsignee` |
//! | `POST /order/order/confirmReceipt` | `OrderController.confirmReceipt` |
//! | `POST /order/order/modifyShipping` | `OrderController.modifyShipping` |
//! | `POST /order/order/modifyProduct` | `OrderController.modifyProduct` |
//! | `POST /order/order/getAddProductInfo` | `OrderController.getAddProductInfo` |
//! | `POST /order/order/deliver` | `OrderController.deliver` |
//! | `GET  /order/order/orderPrint` | `OrderController.orderPrint` |
//! | `GET  /order/order/orderPrintBill` | `OrderController.orderPrintWaybill` |
//! | `GET  /order/order/severalDetail` | `OrderController.severalDetail` |
//! | `POST /order/order/batch` | `OrderController.batch` |
//! | `GET  /order/order/printSeveral` | `OrderController.printSeveral` |
//! | `GET  /order/order/getExportItemList` | `OrderController.getExportItemList` |
//! | `GET  /order/order/exportItemInfo` | `OrderController.exportItemInfo` |
//! | `POST /order/order/saveExportItem` | `OrderController.saveExportItem` |
//! | `GET  /order/order/orderExport` | `OrderController.exportItemInfo`（导出） |
//! | `GET  /order/order/shippingInfo` | `OrderController.shippingInfo` |
//! | `GET  /order/order/getOrderPageConfig` | `OrderController.getOrderPageConfig` |
//! | `POST /order/order/changeOrderStatus` | `OrderController.changeOrderStatus` |
//! | `POST /order/order/remindDeliver` | `OrderController.remindDeliver` |
//! | `POST /order/order/cancelOrderByAdmin` | `OrderController.cancelOrderByAdmin` |
//! | `POST /order/order/batchDeliverImport` | `OrderController.batchDeliverImport` |
//! | `POST /order/order/getBatchDeliverImportErrorData` | `OrderController.getBatchDeliverImportErrorData` |
//! | `GET  /order/order/downloadDeliverTemplate` | `OrderController.downloadDeliverTemplate` |
//!
//! > **权限**：Java 用 `@PreAuthorize` 做 RBAC；Rust 侧 `require_auth` 只校验登录态
//! > （权限矩阵未实现，与其它域一致）。本模块全部注册在管理端需登录路由组。
//!
//! > **多租户**：Java 用请求头 `x-shop-id` / `x-admin-type` 决定平台/店铺视角；
//! > Rust JWT 无 shop_id，列表按 `admin_type`（`admin`/缺失 → 平台视角），
//! > 其余接口按查询参数 / 请求体处理（见服务层注释）。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page`，Rust 统一 `PageResult`。
//!
//! > **xlsx 支持**：`orderExport`、`getBatchDeliverImportErrorData`、`downloadDeliverTemplate`
//! > 均回写真实 xlsx；`batchDeliverImport` 支持 `.xlsx`（PK 魔数 + `calamine`）及 JSON/CSV。

use axum::{
    extract::{Multipart, Query, State},
    http::{header, HeaderMap},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::trade::order_admin::{
    AftersalesApplyAdminParam, DeliverOrderParam, ExportItemSaveParam, LogisticsApiLogVO,
    OrderAdminNoteParam, OrderBatchParam, OrderChangeStatusParam, OrderDeliverImportErrorVO,
    OrderDeliverImportResultVO, OrderDeliverTemplateVO, OrderExportItemVO, OrderExportVO,
    OrderIdParam, OrderListQuery, OrderModifyConsigneeParam, OrderModifyMoneyParam,
    OrderModifyProductParam, OrderModifyShippingParam, OrderPageConfigVO, OrderStatusCountVO,
    OrderVO, ParentOrderDetailVO, ProductAddInfoVO, ProductIdsParam, ShippingInfoVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 订单管理域全部 35 条路由（`/adminapi` 前缀之后 + 原 Java 方法名）。
/// 最后一条 `writeOff` 来自新版管理端前端契约（Java `OrderController`
/// 未含该端点，见 `view/admin/src/api/order/order.ts#writeOffOrder`）。
const ROUTE_TABLE: [(&str, &str, &str); 35] = [
    ("GET", "/order/order/list", "OrderController.list"),
    (
        "GET",
        "/order/order/statusCount",
        "OrderController.statusCount",
    ),
    ("GET", "/order/order/detail", "OrderController.detail"),
    (
        "POST",
        "/order/order/setAdminNote",
        "OrderController.setAdminNote",
    ),
    (
        "GET",
        "/order/order/parentDetail",
        "OrderController.parentOrderDetail",
    ),
    (
        "POST",
        "/order/order/setConfirm",
        "OrderController.setConfirm",
    ),
    (
        "POST",
        "/order/order/splitStoreOrder",
        "OrderController.splitStoreOrder",
    ),
    ("POST", "/order/order/setPaid", "OrderController.setPaid"),
    (
        "POST",
        "/order/order/cancelOrder",
        "OrderController.cancelOrder",
    ),
    ("POST", "/order/order/delOrder", "OrderController.delOrder"),
    (
        "POST",
        "/order/order/modifyMoney",
        "OrderController.modifyMoney",
    ),
    (
        "POST",
        "/order/order/modifyConsignee",
        "OrderController.modifyConsignee",
    ),
    (
        "POST",
        "/order/order/confirmReceipt",
        "OrderController.confirmReceipt",
    ),
    (
        "POST",
        "/order/order/modifyShipping",
        "OrderController.modifyShipping",
    ),
    (
        "POST",
        "/order/order/modifyProduct",
        "OrderController.modifyProduct",
    ),
    (
        "POST",
        "/order/order/getAddProductInfo",
        "OrderController.getAddProductInfo",
    ),
    ("POST", "/order/order/deliver", "OrderController.deliver"),
    (
        "GET",
        "/order/order/orderPrint",
        "OrderController.orderPrint",
    ),
    (
        "GET",
        "/order/order/orderPrintBill",
        "OrderController.orderPrintWaybill",
    ),
    (
        "GET",
        "/order/order/severalDetail",
        "OrderController.severalDetail",
    ),
    ("POST", "/order/order/batch", "OrderController.batch"),
    (
        "GET",
        "/order/order/printSeveral",
        "OrderController.printSeveral",
    ),
    (
        "GET",
        "/order/order/getExportItemList",
        "OrderController.getExportItemList",
    ),
    (
        "GET",
        "/order/order/exportItemInfo",
        "OrderController.exportItemInfo",
    ),
    (
        "POST",
        "/order/order/saveExportItem",
        "OrderController.saveExportItem",
    ),
    (
        "GET",
        "/order/order/orderExport",
        "OrderController.exportItemInfo",
    ),
    (
        "GET",
        "/order/order/shippingInfo",
        "OrderController.shippingInfo",
    ),
    (
        "GET",
        "/order/order/getOrderPageConfig",
        "OrderController.getOrderPageConfig",
    ),
    (
        "POST",
        "/order/order/changeOrderStatus",
        "OrderController.changeOrderStatus",
    ),
    (
        "POST",
        "/order/order/remindDeliver",
        "OrderController.remindDeliver",
    ),
    (
        "POST",
        "/order/order/cancelOrderByAdmin",
        "OrderController.cancelOrderByAdmin",
    ),
    (
        "POST",
        "/order/order/batchDeliverImport",
        "OrderController.batchDeliverImport",
    ),
    (
        "POST",
        "/order/order/getBatchDeliverImportErrorData",
        "OrderController.getBatchDeliverImportErrorData",
    ),
    (
        "GET",
        "/order/order/downloadDeliverTemplate",
        "OrderController.downloadDeliverTemplate",
    ),
    ("POST", "/order/order/writeOff", "OrderController.writeOff"),
];

/// 订单管理域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/order/order/list", get(order_list))
        .route("/order/order/statusCount", get(status_count))
        .route("/order/order/detail", get(order_detail))
        .route("/order/order/setAdminNote", post(set_admin_note))
        .route("/order/order/parentDetail", get(parent_detail))
        .route("/order/order/setConfirm", post(set_confirm))
        .route("/order/order/splitStoreOrder", post(split_store_order))
        .route("/order/order/setPaid", post(set_paid))
        .route("/order/order/cancelOrder", post(cancel_order))
        .route("/order/order/delOrder", post(del_order))
        .route("/order/order/modifyMoney", post(modify_money))
        .route("/order/order/modifyConsignee", post(modify_consignee))
        .route("/order/order/confirmReceipt", post(confirm_receipt))
        .route("/order/order/modifyShipping", post(modify_shipping))
        .route("/order/order/modifyProduct", post(modify_product))
        .route("/order/order/getAddProductInfo", post(get_add_product_info))
        .route("/order/order/deliver", post(order_deliver))
        .route("/order/order/orderPrint", get(order_print))
        .route("/order/order/orderPrintBill", get(order_print_bill))
        .route("/order/order/severalDetail", get(several_detail))
        .route("/order/order/batch", post(batch_operation))
        .route("/order/order/printSeveral", get(print_several))
        .route("/order/order/getExportItemList", get(get_export_item_list))
        .route("/order/order/exportItemInfo", get(export_item_info))
        .route("/order/order/saveExportItem", post(save_export_item))
        .route("/order/order/orderExport", get(order_export))
        .route("/order/order/shippingInfo", get(shipping_info))
        .route(
            "/order/order/getOrderPageConfig",
            get(get_order_page_config),
        )
        .route("/order/order/changeOrderStatus", post(change_order_status))
        .route("/order/order/remindDeliver", post(remind_deliver))
        .route(
            "/order/order/cancelOrderByAdmin",
            post(order_cancel_by_admin),
        )
        .route(
            "/order/order/batchDeliverImport",
            post(batch_deliver_import),
        )
        .route("/order/order/writeOff", post(write_off))
        .route(
            "/order/order/getBatchDeliverImportErrorData",
            post(get_batch_deliver_import_error_data),
        )
        .route(
            "/order/order/downloadDeliverTemplate",
            get(download_deliver_template),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

use tigshop_openapi::RouteDoc;

// ————————————————————— 参数辅助 —————————————————————

/// `?id=` 查询参数（Java `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

/// `?pickupSn=` 查询参数（前端 `writeOffOrder({ pickupSn })` 以 query 传递）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteOffQuery {
    pickup_sn: Option<String>,
}

/// `?ids=1,2` 查询参数（Java `@RequestParam List<Integer> ids` / `String ids`）。
#[derive(Debug, Deserialize)]
struct IdsQuery {
    ids: Option<String>,
}

impl IdsQuery {
    fn parse(&self) -> Result<Vec<i32>, AppError> {
        self.ids
            .as_deref()
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| {
                s.parse::<i32>().map_err(|_| {
                    AppError(tigshop_core::Error::Validation(format!("#ids 错误: {s}")))
                })
            })
            .collect()
    }
}

/// 平台视角判定（Java `HeaderUtils.getShopId() <= 0 && getVendorId() <= 0`）。
fn platform_view(auth: &AuthUser) -> bool {
    auth.is_platform()
}

/// 站点根地址（Java 从 `HttpServletRequest` 取 scheme/serverName/serverPort）。
fn request_host(headers: &HeaderMap) -> String {
    let scheme = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("http");
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("localhost");
    format!("{scheme}://{host}")
}

/// 读取 multipart 上传文件（字段名 `file`，Java `@RequestParam("file")`）。
async fn read_upload(multipart: &mut Multipart) -> Result<(Option<String>, Vec<u8>), AppError> {
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "上传解析失败: {e}"
        )))
    })? {
        let name = field.name().map(str::to_string);
        let file_name = field.file_name().map(str::to_string);
        if name.as_deref() != Some("file") && file_name.is_none() {
            continue;
        }
        let bytes = field
            .bytes()
            .await
            .map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "读取文件失败: {e}"
                )))
            })?
            .to_vec();
        return Ok((file_name, bytes));
    }
    Err(AppError(tigshop_core::Error::Validation(
        "请上传文件".into(),
    )))
}

// ————————————————————— 列表 / 统计 / 详情 —————————————————————

/// `GET /adminapi/order/order/list`：订单分页。
async fn order_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<OrderListQuery>,
) -> ApiResult<PageResult<OrderVO>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state
        .trade
        .order_admin
        .list(&q, platform_view(&auth))
        .await?)
}

/// `GET /adminapi/order/order/statusCount`：各状态订单数量。
async fn status_count(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<OrderListQuery>,
) -> ApiResult<OrderStatusCountVO> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state
        .trade
        .order_admin
        .status_count(&q, platform_view(&auth))
        .await?)
}

/// `GET /adminapi/order/order/detail?id=`：订单详情。
async fn order_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<OrderVO> {
    let order = state.trade.order_admin.detail(q.id).await?;
    if let Some(shop_id) = auth.scoped_shop_id() {
        if order.shop_id != shop_id {
            return Err(AppError(tigshop_core::Error::biz(
                403,
                "无权查看其他商户订单",
            )));
        }
    }
    ok(order)
}

/// `POST /adminapi/order/order/setAdminNote`：设置商家备注 / 标记。
async fn set_admin_note(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderAdminNoteParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .set_admin_note(&param, auth.id)
        .await?;
    ok(())
}

/// `GET /adminapi/order/order/parentDetail?id=`：父订单详情。
async fn parent_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<ParentOrderDetailVO>> {
    ensure_order_access(&state, &auth, q.id).await?;
    ok(state.trade.order_admin.parent_detail(q.id).await?)
}

/// 校验订单归属：店铺账号只能读写本店订单；平台账号放行。
///
/// 所有订单写操作（改价/改收货人/发货/确认/取消/删除/状态流转/打印/催发货/售后关单）
/// 都必须先经过这里，避免仅靠列表过滤造成越权写。
async fn ensure_order_access(state: &AdminState, auth: &AuthUser, id: i32) -> Result<(), AppError> {
    let order = state.trade.order_admin.detail(id).await?;
    auth.ensure_shop_access(order.shop_id)?;
    Ok(())
}

// ————————————————————— 状态流转 —————————————————————

/// `POST /adminapi/order/order/setConfirm`：设置订单确认。
async fn set_confirm(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<bool> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    ok(state.trade.order_admin.set_confirm(id).await?)
}

/// `POST /adminapi/order/order/splitStoreOrder`：订单拆分。
async fn split_store_order(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<serde_json::Value> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    let split = state.trade.order_admin.split_store_order(id).await?;
    ok(serde_json::json!({ "split": split }))
}

/// `POST /adminapi/order/order/setPaid`：设置已付款。
///
/// 返回值与 Java 一致：`true` 表示订单已拆单（父单被删除），`false` 表示未拆单。
async fn set_paid(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<bool> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    ok(state
        .trade
        .order_admin
        .set_paid(id, param.description.as_deref())
        .await?)
}

/// `POST /adminapi/order/order/cancelOrder`：取消订单。
async fn cancel_order(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<()> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    state
        .trade
        .order_admin
        .cancel_order(id, param.description.as_deref(), auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/delOrder`：删除订单（软删除）。
async fn del_order(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<()> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    state.trade.order_admin.del_order(id, auth.id).await?;
    ok(())
}

/// `POST /adminapi/order/order/modifyMoney`：修改订单金额。
async fn modify_money(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderModifyMoneyParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .modify_money(&param, auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/modifyConsignee`：修改收货人信息。
async fn modify_consignee(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderModifyConsigneeParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .modify_consignee(&param, auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/confirmReceipt`：确认收货。
async fn confirm_receipt(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderIdParam>,
) -> ApiResult<()> {
    let id = param
        .id
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("订单 ID不能为空".into())))?;
    ensure_order_access(&state, &auth, id).await?;
    state.trade.order_admin.confirm_receipt(id, auth.id).await?;
    ok(())
}

/// `POST /adminapi/order/order/writeOff?pickupSn=`：门店核销。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/order/order.ts#writeOffOrder`（ScanCode 扫码核销，
/// `pickupSn` 经 query 传递），返回核销后的订单（前端 unshift 进列表）。
async fn write_off(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<WriteOffQuery>,
) -> ApiResult<OrderVO> {
    let pickup_sn = q
        .pickup_sn
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError(tigshop_core::Error::Validation("核销码不能为空".into())))?;
    ok(state
        .trade
        .order_admin
        .write_off(&pickup_sn, auth.id)
        .await?)
}

/// `POST /adminapi/order/order/modifyShipping`：修改配送信息。
async fn modify_shipping(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderModifyShippingParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .modify_shipping(&param, auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/modifyProduct`：修改商品信息。
async fn modify_product(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderModifyProductParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .modify_product(&param, auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/getAddProductInfo`：添加商品时获取商品信息。
async fn get_add_product_info(
    State(state): State<AdminState>,
    Json(param): Json<ProductIdsParam>,
) -> ApiResult<Vec<ProductAddInfoVO>> {
    let ids = param.ids.unwrap_or_default();
    ok(state.trade.order_admin.add_product_info(&ids).await?)
}

/// `POST /adminapi/order/order/deliver`：发货（wave1 已实现，保留字节级路径）。
async fn order_deliver(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<DeliverOrderParam>,
) -> ApiResult<&'static str> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state.trade.order_admin.deliver(&param).await?;
    ok("发货成功")
}

// ————————————————————— 打印 / 批量详情 —————————————————————

/// `GET /adminapi/order/order/orderPrint?id=`：打印订单信息。
async fn order_print(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<IdQuery>,
) -> ApiResult<OrderVO> {
    ensure_order_access(&state, &auth, q.id).await?;
    ok(state
        .trade
        .order_admin
        .order_print(q.id, &request_host(&headers))
        .await?)
}

/// `GET /adminapi/order/order/orderPrintBill?id=`：打印电子面单。
async fn order_print_bill(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<LogisticsApiLogVO>> {
    ensure_order_access(&state, &auth, q.id).await?;
    ok(state.trade.order_admin.order_print_bill(q.id).await?)
}

/// `GET /adminapi/order/order/severalDetail?ids=1,2`：批量详情。
async fn several_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdsQuery>,
) -> ApiResult<Vec<OrderVO>> {
    let ids = q.parse()?;
    for id in &ids {
        ensure_order_access(&state, &auth, *id).await?;
    }
    ok(state.trade.order_admin.several_detail(&ids).await?)
}

/// `POST /adminapi/order/order/batch`：批量操作（仅 `deliver`）。
async fn batch_operation(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderBatchParam>,
) -> ApiResult<()> {
    if let Some(ids) = param.ids.as_deref() {
        for id in ids {
            ensure_order_access(&state, &auth, *id).await?;
        }
    }
    state
        .trade
        .order_admin
        .batch_operation(&param, auth.id)
        .await?;
    ok(())
}

/// `GET /adminapi/order/order/printSeveral?ids=1,2`：批量打印。
async fn print_several(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<IdsQuery>,
) -> ApiResult<Vec<OrderVO>> {
    let ids = q.parse()?;
    for id in &ids {
        ensure_order_access(&state, &auth, *id).await?;
    }
    ok(state
        .trade
        .order_admin
        .print_several(&ids, &request_host(&headers))
        .await?)
}

// ————————————————————— 导出 / 物流 / 配置 —————————————————————

/// `GET /adminapi/order/order/getExportItemList`：订单导出标签列表。
async fn get_export_item_list(
    State(state): State<AdminState>,
) -> ApiResult<Vec<OrderExportItemVO>> {
    ok(state.trade.order_admin.export_item_list())
}

/// `GET /adminapi/order/order/exportItemInfo`：当前管理员已选导出标签。
async fn export_item_info(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<Vec<OrderExportItemVO>> {
    ok(state.trade.order_admin.export_item_info(auth.id).await?)
}

/// `POST /adminapi/order/order/saveExportItem`：保存导出标签。
async fn save_export_item(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<ExportItemSaveParam>,
) -> ApiResult<()> {
    state
        .trade
        .order_admin
        .save_export_item(&param, auth.id)
        .await?;
    ok(())
}

/// `GET /adminapi/order/order/orderExport`：订单导出（xlsx 二进制下载）。
async fn order_export(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<OrderListQuery>,
) -> Result<axum::response::Response, AppError> {
    let (file_name, bytes) = state
        .trade
        .order_admin
        .order_export_xlsx(&q, platform_view(&auth))
        .await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes, &file_name,
    ))
}

/// `GET /adminapi/order/order/shippingInfo?id=`：物流信息。
async fn shipping_info(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<ShippingInfoVO>> {
    ensure_order_access(&state, &auth, q.id).await?;
    ok(state.trade.order_admin.shipping_info(q.id, auth.id).await?)
}

/// `GET /adminapi/order/order/getOrderPageConfig`：订单列表页配置。
async fn get_order_page_config(State(state): State<AdminState>) -> ApiResult<OrderPageConfigVO> {
    ok(state.trade.order_admin.order_page_config().await?)
}

/// `POST /adminapi/order/order/changeOrderStatus`：修改订单状态。
async fn change_order_status(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OrderChangeStatusParam>,
) -> ApiResult<()> {
    if let Some(id) = param.id {
        ensure_order_access(&state, &auth, id).await?;
    }
    state
        .trade
        .order_admin
        .change_order_status(&param, auth.id, Some(auth.username.as_str()))
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/remindDeliver?id=`：催发货。
async fn remind_deliver(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<()> {
    ensure_order_access(&state, &auth, q.id).await?;
    state
        .trade
        .order_admin
        .remind_deliver(q.id, auth.id)
        .await?;
    ok(())
}

/// `POST /adminapi/order/order/cancelOrderByAdmin`：后台取消订单（wave1 已实现）。
async fn order_cancel_by_admin(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AftersalesApplyAdminParam>,
) -> ApiResult<serde_json::Value> {
    if let Some(id) = param.order_id {
        ensure_order_access(&state, &auth, id).await?;
    }
    let aftersale_id = state
        .trade
        .order_admin
        .cancel_order_by_admin(&param, Some(auth.username.as_str()))
        .await?;
    ok(serde_json::json!({ "aftersaleId": aftersale_id }))
}

// ————————————————————— 批量发货导入 / 模板 —————————————————————

/// `POST /adminapi/order/order/batchDeliverImport`：批量发货导入（xlsx / JSON / CSV）。
async fn batch_deliver_import(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> ApiResult<OrderDeliverImportResultVO> {
    let (file_name, bytes) = read_upload(&mut multipart).await?;
    ok(state
        .trade
        .order_admin
        .batch_deliver_import(&bytes, file_name.as_deref())
        .await?)
}

/// `POST /adminapi/order/order/getBatchDeliverImportErrorData`：导入失败数据（xlsx 下载）。
async fn get_batch_deliver_import_error_data(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> Result<axum::response::Response, AppError> {
    let (_, bytes) = read_upload(&mut multipart).await?;
    let (file_name, data) = state
        .trade
        .order_admin
        .batch_deliver_import_error_xlsx(&bytes)
        .await?;
    Ok(crate::support::excel_response::xlsx_response(
        data, &file_name,
    ))
}

/// `GET /adminapi/order/order/downloadDeliverTemplate?ids=1,2`：批量发货模板（xlsx 下载）。
async fn download_deliver_template(
    State(state): State<AdminState>,
    Query(q): Query<IdsQuery>,
) -> Result<axum::response::Response, AppError> {
    let ids = q.parse()?;
    let (file_name, bytes) = state
        .trade
        .order_admin
        .download_deliver_template_xlsx(&ids)
        .await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes, &file_name,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（34 条）
    /// + 前端契约 1 条（writeOff）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 35, "订单管理域共 35 条接口");
        assert_eq!(docs.len(), ROUTE_TABLE.len());

        let expected = [
            ("GET", "/adminapi/order/order/list", "OrderController.list"),
            (
                "GET",
                "/adminapi/order/order/statusCount",
                "OrderController.statusCount",
            ),
            (
                "GET",
                "/adminapi/order/order/detail",
                "OrderController.detail",
            ),
            (
                "POST",
                "/adminapi/order/order/setAdminNote",
                "OrderController.setAdminNote",
            ),
            (
                "GET",
                "/adminapi/order/order/parentDetail",
                "OrderController.parentOrderDetail",
            ),
            (
                "POST",
                "/adminapi/order/order/setConfirm",
                "OrderController.setConfirm",
            ),
            (
                "POST",
                "/adminapi/order/order/splitStoreOrder",
                "OrderController.splitStoreOrder",
            ),
            (
                "POST",
                "/adminapi/order/order/setPaid",
                "OrderController.setPaid",
            ),
            (
                "POST",
                "/adminapi/order/order/cancelOrder",
                "OrderController.cancelOrder",
            ),
            (
                "POST",
                "/adminapi/order/order/delOrder",
                "OrderController.delOrder",
            ),
            (
                "POST",
                "/adminapi/order/order/modifyMoney",
                "OrderController.modifyMoney",
            ),
            (
                "POST",
                "/adminapi/order/order/modifyConsignee",
                "OrderController.modifyConsignee",
            ),
            (
                "POST",
                "/adminapi/order/order/confirmReceipt",
                "OrderController.confirmReceipt",
            ),
            (
                "POST",
                "/adminapi/order/order/modifyShipping",
                "OrderController.modifyShipping",
            ),
            (
                "POST",
                "/adminapi/order/order/modifyProduct",
                "OrderController.modifyProduct",
            ),
            (
                "POST",
                "/adminapi/order/order/getAddProductInfo",
                "OrderController.getAddProductInfo",
            ),
            (
                "POST",
                "/adminapi/order/order/deliver",
                "OrderController.deliver",
            ),
            (
                "GET",
                "/adminapi/order/order/orderPrint",
                "OrderController.orderPrint",
            ),
            (
                "GET",
                "/adminapi/order/order/orderPrintBill",
                "OrderController.orderPrintWaybill",
            ),
            (
                "GET",
                "/adminapi/order/order/severalDetail",
                "OrderController.severalDetail",
            ),
            (
                "POST",
                "/adminapi/order/order/batch",
                "OrderController.batch",
            ),
            (
                "GET",
                "/adminapi/order/order/printSeveral",
                "OrderController.printSeveral",
            ),
            (
                "GET",
                "/adminapi/order/order/getExportItemList",
                "OrderController.getExportItemList",
            ),
            (
                "GET",
                "/adminapi/order/order/exportItemInfo",
                "OrderController.exportItemInfo",
            ),
            (
                "POST",
                "/adminapi/order/order/saveExportItem",
                "OrderController.saveExportItem",
            ),
            (
                "GET",
                "/adminapi/order/order/orderExport",
                "OrderController.exportItemInfo",
            ),
            (
                "GET",
                "/adminapi/order/order/shippingInfo",
                "OrderController.shippingInfo",
            ),
            (
                "GET",
                "/adminapi/order/order/getOrderPageConfig",
                "OrderController.getOrderPageConfig",
            ),
            (
                "POST",
                "/adminapi/order/order/changeOrderStatus",
                "OrderController.changeOrderStatus",
            ),
            (
                "POST",
                "/adminapi/order/order/remindDeliver",
                "OrderController.remindDeliver",
            ),
            (
                "POST",
                "/adminapi/order/order/cancelOrderByAdmin",
                "OrderController.cancelOrderByAdmin",
            ),
            (
                "POST",
                "/adminapi/order/order/batchDeliverImport",
                "OrderController.batchDeliverImport",
            ),
            (
                "POST",
                "/adminapi/order/order/getBatchDeliverImportErrorData",
                "OrderController.getBatchDeliverImportErrorData",
            ),
            (
                "GET",
                "/adminapi/order/order/downloadDeliverTemplate",
                "OrderController.downloadDeliverTemplate",
            ),
            (
                "POST",
                "/adminapi/order/order/writeOff",
                "OrderController.writeOff",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                docs.iter()
                    .any(|d| d.method == method && d.path == path && d.java_ref == handler),
                "缺少 {method} {path} ({handler})"
            );
        }
        // 不允许重复声明
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（35/35）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            ("GET", "/order/order/list"),
            ("GET", "/order/order/statusCount"),
            ("GET", "/order/order/detail"),
            ("POST", "/order/order/setAdminNote"),
            ("GET", "/order/order/parentDetail"),
            ("POST", "/order/order/setConfirm"),
            ("POST", "/order/order/splitStoreOrder"),
            ("POST", "/order/order/setPaid"),
            ("POST", "/order/order/cancelOrder"),
            ("POST", "/order/order/delOrder"),
            ("POST", "/order/order/modifyMoney"),
            ("POST", "/order/order/modifyConsignee"),
            ("POST", "/order/order/confirmReceipt"),
            ("POST", "/order/order/modifyShipping"),
            ("POST", "/order/order/modifyProduct"),
            ("POST", "/order/order/getAddProductInfo"),
            ("POST", "/order/order/deliver"),
            ("GET", "/order/order/orderPrint"),
            ("GET", "/order/order/orderPrintBill"),
            ("GET", "/order/order/severalDetail"),
            ("POST", "/order/order/batch"),
            ("GET", "/order/order/printSeveral"),
            ("GET", "/order/order/getExportItemList"),
            ("GET", "/order/order/exportItemInfo"),
            ("POST", "/order/order/saveExportItem"),
            ("GET", "/order/order/orderExport"),
            ("GET", "/order/order/shippingInfo"),
            ("GET", "/order/order/getOrderPageConfig"),
            ("POST", "/order/order/changeOrderStatus"),
            ("POST", "/order/order/remindDeliver"),
            ("POST", "/order/order/cancelOrderByAdmin"),
            ("POST", "/order/order/batchDeliverImport"),
            ("POST", "/order/order/getBatchDeliverImportErrorData"),
            ("GET", "/order/order/downloadDeliverTemplate"),
            ("POST", "/order/order/writeOff"),
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

    /// 已实现的 4 条 wave1 路径必须保持字节级不变。
    #[test]
    fn wave1_paths_kept_intact() {
        for (m, p) in [
            ("GET", "/adminapi/order/order/list"),
            ("GET", "/adminapi/order/order/detail"),
            ("POST", "/adminapi/order/order/deliver"),
            ("POST", "/adminapi/order/order/cancelOrderByAdmin"),
        ] {
            assert!(
                implemented_routes()
                    .iter()
                    .any(|d| d.method == m && d.path == p),
                "wave1 路径被破坏: {m} {p}"
            );
        }
    }
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    fn shop_account(shop_id: i32) -> AuthUser {
        AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(shop_id))
    }

    fn platform() -> AuthUser {
        AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0))
    }

    /// 列表/计数被强制过滤到自身店铺（路由层覆盖 `q.shop_id`）。
    #[test]
    fn list_scope_is_forced_for_shop_account() {
        let auth = shop_account(9);
        assert_eq!(auth.scoped_shop_id(), Some(9));
        assert!(!platform_view(&auth));
        // 平台账号不过滤
        assert!(platform_view(&platform()));
        assert_eq!(platform().scoped_shop_id(), None);
    }

    /// 订单写操作归属校验：跨店被拒、本店/平台放行。
    #[test]
    fn cross_shop_order_is_forbidden() {
        let auth = shop_account(9);
        assert!(auth.ensure_shop_access(9).is_ok());
        let err = auth.ensure_shop_access(8).unwrap_err();
        assert!(err.to_string().contains("无权访问店铺 8"));
        assert!(platform().ensure_shop_access(8).is_ok());
    }
}
