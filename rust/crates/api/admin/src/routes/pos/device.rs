//! 收银台设备路由（pos::device）。
//!
//! ⚠️ Java 来源：参考工程（overseas / b2b2b-pro）**无** `PosDeviceController`；
//! 路由与字段以线上管理端前端契约为准
//! （`java/view/admin/src/api/setting/cashier.ts`）+ 表 `pos_device`
//! （`java/database/pure.sql:3060`）：
//!
//! | 本模块路由 | 前端调用 |
//! |-----------|---------|
//! | `GET  /pos/device/list` | `getCashierDeviceList`（分页 + status/keyword） |
//! | `GET  /pos/device/all` | `getCashierDeviceAll`（下拉全量） |
//! | `GET  /pos/device/detail` | `getCashierDeviceDetail`（`?id=`） |
//! | `POST /pos/device/create` | `updateCashierDevice("create", …)` |
//! | `POST /pos/device/update` | `updateCashierDevice("update", …)` |
//! | `POST /pos/device/updateField` | `updateCashierDeviceStatus`（白名单单字段） |
//! | `POST /pos/device/del` | `deleteCashierDevice` |
//!
//! 租户口径：店铺 / 门店 / POS 账号只能看 / 写本店设备；平台账号需显式传 shopId。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::pos::device::{
    PosDeviceDelDTO, PosDeviceListQuery, PosDeviceUpdateFieldDTO, PosDeviceVO,
    PosDeviceWritePayload,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, TenantContext};

use crate::AdminState;

/// 本域全部 7 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    ("GET", "/pos/device/list", "PosDeviceController.list"),
    ("GET", "/pos/device/all", "PosDeviceController.all"),
    ("GET", "/pos/device/detail", "PosDeviceController.detail"),
    ("POST", "/pos/device/create", "PosDeviceController.create"),
    ("POST", "/pos/device/update", "PosDeviceController.update"),
    (
        "POST",
        "/pos/device/updateField",
        "PosDeviceController.updateField",
    ),
    ("POST", "/pos/device/del", "PosDeviceController.del"),
];

/// 域路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/pos/device/list", get(list))
        .route("/pos/device/all", get(list_all))
        .route("/pos/device/detail", get(detail))
        .route("/pos/device/create", post(create))
        .route("/pos/device/update", post(update))
        .route("/pos/device/updateField", post(update_field))
        .route("/pos/device/del", post(del))
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
#[derive(Debug, Default, Deserialize)]
pub struct DeviceIdQuery {
    pub id: Option<i32>,
}

/// `GET /adminapi/pos/device/list`：设备分页。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PosDeviceListQuery>,
) -> ApiResult<PageResult<PosDeviceVO>> {
    ok(state.pos.device.list(&q, tenant.shop_scope()).await?)
}

/// `GET /adminapi/pos/device/all`：设备全量（下拉）。
async fn list_all(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Vec<PosDeviceVO>> {
    ok(state.pos.device.list_all(tenant.shop_scope()).await?)
}

/// `GET /adminapi/pos/device/detail?id=`：设备详情。
async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DeviceIdQuery>,
) -> ApiResult<PosDeviceVO> {
    let id = q.id.unwrap_or(0);
    ok(state.pos.device.detail(id, tenant.shop_scope()).await?)
}

/// `POST /adminapi/pos/device/create`：创建设备。
async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<PosDeviceWritePayload>,
) -> ApiResult<i32> {
    ok(state.pos.device.create(&p, tenant.shop_scope()).await?)
}

/// `POST /adminapi/pos/device/update`：编辑设备。
async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<PosDeviceWritePayload>,
) -> ApiResult<&'static str> {
    state.pos.device.update(&p, tenant.shop_scope()).await?;
    ok("保存成功")
}

/// `POST /adminapi/pos/device/updateField`：白名单单字段更新。
async fn update_field(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosDeviceUpdateFieldDTO>,
) -> ApiResult<&'static str> {
    state
        .pos
        .device
        .update_field(&dto, tenant.shop_scope())
        .await?;
    ok("修改成功")
}

/// `POST /adminapi/pos/device/del`：删除设备。
async fn del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosDeviceDelDTO>,
) -> ApiResult<u64> {
    ok(state.pos.device.delete(&dto, tenant.shop_scope()).await?)
}
