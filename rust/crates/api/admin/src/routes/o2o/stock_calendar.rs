//! 库存日历路由（o2o::stock_calendar）。
//!
//! Java 来源（overseas）：`bean/vo/o2o/StockCalendarListVO` / `StockCalendarVO` +
//! `service/product/util/StockCalendarUtil.java` + `product_reservation_stock` /
//! `product_reservation_time` 表；overseas 无控制器，路由以线上前端契约为准
//! （`java/view/admin/src/api/product/inventoryCalendar.ts`）：
//!
//! | 本模块路由 | 前端调用 |
//! |-----------|---------|
//! | `GET  /o2o/stockCalendar/pageList` | `getInventoryCalendarList` |
//! | `GET  /o2o/stockCalendar/getDailyStock` | `getInventoryCalendarDailyStock` |
//! | `POST /o2o/stockCalendar/updateDailyStock` | `updateInventoryCalendarDailyStock` |
//! | `POST /o2o/stockCalendar/setUnifiedStock` | `setInventoryCalendarUnifiedStock` |
//! | `POST /o2o/stockCalendar/setTimeSlotStock` | `setInventoryCalendarTimeSlotStock` |
//! | `GET  /o2o/stockCalendar/getProductTimeList` | `getInventoryCalendarProductTimeList` |

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::o2o::stock_calendar::{
    DailyStockQuery, DailyStockVO, ProductTimeListVO, SetTimeSlotStockDTO, SetUnifiedStockDTO,
    StockCalendarListQuery, StockCalendarListVO, UpdateDailyStockDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, TenantContext};

use crate::AdminState;

/// 本域全部 6 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/o2o/stockCalendar/pageList",
        "StockCalendarController.pageList",
    ),
    (
        "GET",
        "/o2o/stockCalendar/getDailyStock",
        "StockCalendarController.getDailyStock",
    ),
    (
        "POST",
        "/o2o/stockCalendar/updateDailyStock",
        "StockCalendarController.updateDailyStock",
    ),
    (
        "POST",
        "/o2o/stockCalendar/setUnifiedStock",
        "StockCalendarController.setUnifiedStock",
    ),
    (
        "POST",
        "/o2o/stockCalendar/setTimeSlotStock",
        "StockCalendarController.setTimeSlotStock",
    ),
    (
        "GET",
        "/o2o/stockCalendar/getProductTimeList",
        "StockCalendarController.getProductTimeList",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/o2o/stockCalendar/pageList", get(page_list))
        .route("/o2o/stockCalendar/getDailyStock", get(daily_stock))
        .route(
            "/o2o/stockCalendar/updateDailyStock",
            post(update_daily_stock),
        )
        .route(
            "/o2o/stockCalendar/setUnifiedStock",
            post(set_unified_stock),
        )
        .route(
            "/o2o/stockCalendar/setTimeSlotStock",
            post(set_time_slot_stock),
        )
        .route(
            "/o2o/stockCalendar/getProductTimeList",
            get(product_time_list),
        )
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `GET /adminapi/o2o/stockCalendar/pageList`。
async fn page_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<StockCalendarListQuery>,
) -> ApiResult<PageResult<StockCalendarListVO>> {
    ok(state
        .o2o
        .stock_calendar
        .page_list(&q, tenant.shop_scope())
        .await?)
}

/// `GET /adminapi/o2o/stockCalendar/getDailyStock`。
async fn daily_stock(
    State(state): State<AdminState>,
    Query(q): Query<DailyStockQuery>,
) -> ApiResult<DailyStockVO> {
    ok(state.o2o.stock_calendar.daily_stock(&q).await?)
}

/// `POST /adminapi/o2o/stockCalendar/updateDailyStock`。
async fn update_daily_stock(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateDailyStockDTO>,
) -> ApiResult<&'static str> {
    state.o2o.stock_calendar.update_daily_stock(&dto).await?;
    ok("保存成功")
}

/// `POST /adminapi/o2o/stockCalendar/setUnifiedStock`。
async fn set_unified_stock(
    State(state): State<AdminState>,
    Json(dto): Json<SetUnifiedStockDTO>,
) -> ApiResult<u64> {
    ok(state.o2o.stock_calendar.set_unified_stock(&dto).await?)
}

/// `POST /adminapi/o2o/stockCalendar/setTimeSlotStock`。
async fn set_time_slot_stock(
    State(state): State<AdminState>,
    Json(dto): Json<SetTimeSlotStockDTO>,
) -> ApiResult<u64> {
    ok(state.o2o.stock_calendar.set_time_slot_stock(&dto).await?)
}

/// `GET /adminapi/o2o/stockCalendar/getProductTimeList?productId=`。
async fn product_time_list(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<ProductTimeListVO> {
    ok(state
        .o2o
        .stock_calendar
        .product_time_list(q.product_id.unwrap_or(0))
        .await?)
}

/// `?productId=` 查询参数。
#[derive(Debug, Default, serde::Deserialize)]
pub struct ProductIdQuery {
    pub product_id: Option<i32>,
}
