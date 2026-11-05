//! 预约模板路由（o2o::reservation_tpl）。
//!
//! Java 来源（overseas）：`bean/model/o2o/ReservationTpl.java`
//! （`@TableName reservation_tpl`）+ `ReservationTplMapper`；overseas 无控制器，
//! 路由以线上前端契约为准（`java/view/admin/src/api/setting/appointmentTpl.ts`）：
//!
//! | 本模块路由 | 前端调用 |
//! |-----------|---------|
//! | `GET  /o2o/reservationTpl/pageList` | `getReservationTplList` |
//! | `GET  /o2o/reservationTpl/list` | `getReservationTplAll` |
//! | `GET  /o2o/reservationTpl/detail` | `getReservationTpl("detail")` |
//! | `POST /o2o/reservationTpl/create` | `updateReservationTpl("create")` |
//! | `POST /o2o/reservationTpl/update` | `updateReservationTpl("update")` |
//! | `POST /o2o/reservationTpl/del` | `delReservationTpl` |

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::o2o::reservation_tpl::{
    ReservationTplDelDTO, ReservationTplListQuery, ReservationTplVO, ReservationTplWritePayload,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, TenantContext};

use crate::AdminState;

/// 本域全部 6 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/o2o/reservationTpl/pageList",
        "ReservationTplController.pageList",
    ),
    (
        "GET",
        "/o2o/reservationTpl/list",
        "ReservationTplController.list",
    ),
    (
        "GET",
        "/o2o/reservationTpl/detail",
        "ReservationTplController.detail",
    ),
    (
        "POST",
        "/o2o/reservationTpl/create",
        "ReservationTplController.create",
    ),
    (
        "POST",
        "/o2o/reservationTpl/update",
        "ReservationTplController.update",
    ),
    (
        "POST",
        "/o2o/reservationTpl/del",
        "ReservationTplController.del",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/o2o/reservationTpl/pageList", get(page_list))
        .route("/o2o/reservationTpl/list", get(list_all))
        .route("/o2o/reservationTpl/detail", get(detail))
        .route("/o2o/reservationTpl/create", post(create))
        .route("/o2o/reservationTpl/update", post(update))
        .route("/o2o/reservationTpl/del", post(del))
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

/// `?id=` 查询参数。
#[derive(Debug, Default, serde::Deserialize)]
pub struct TplIdQuery {
    pub id: Option<i32>,
}

/// `GET /adminapi/o2o/reservationTpl/pageList`。
async fn page_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ReservationTplListQuery>,
) -> ApiResult<PageResult<ReservationTplVO>> {
    ok(state
        .o2o
        .reservation_tpl
        .page_list(&q, tenant.shop_scope())
        .await?)
}

/// `GET /adminapi/o2o/reservationTpl/list`：全量（下拉）。
async fn list_all(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Vec<ReservationTplVO>> {
    ok(state
        .o2o
        .reservation_tpl
        .list_all(tenant.shop_scope())
        .await?)
}

/// `GET /adminapi/o2o/reservationTpl/detail?id=`。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<TplIdQuery>,
) -> ApiResult<ReservationTplVO> {
    ok(state.o2o.reservation_tpl.detail(q.id.unwrap_or(0)).await?)
}

/// `POST /adminapi/o2o/reservationTpl/create`。
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<ReservationTplWritePayload>,
) -> ApiResult<i32> {
    ok(state
        .o2o
        .reservation_tpl
        .create(&p, tenant.shop_scope())
        .await?)
}

/// `POST /adminapi/o2o/reservationTpl/update`。
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<ReservationTplWritePayload>,
) -> ApiResult<&'static str> {
    state
        .o2o
        .reservation_tpl
        .update(&p, tenant.shop_scope())
        .await?;
    ok("保存成功")
}

/// `POST /adminapi/o2o/reservationTpl/del`。
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<ReservationTplDelDTO>,
) -> ApiResult<&'static str> {
    state
        .o2o
        .reservation_tpl
        .delete(&dto, tenant.shop_scope())
        .await?;
    ok("删除成功")
}
