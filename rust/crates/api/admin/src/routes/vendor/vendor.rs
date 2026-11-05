//! 供应商管理路由（vendor::vendor）。
//!
//! Java 来源（overseas）`VendorController`
//! （`tigshop-adminapi/.../controller/vendor/VendorController.java`，
//! `@RequestMapping("/adminapi/vendor/vendor")`）：
//!
//! | 本模块路由 | 原 Java | 说明 |
//! |-----------|---------|------|
//! | `GET  /vendor/vendor/list` | `VendorController.list`（`VendorServiceImpl#list`） | 分页 + keyword/status/account/vendorIds |
//! | `POST /vendor/vendor/create` | `VendorController.create`（`#create`） | 最小实现（见 service 模块头） |
//! | `GET  /vendor/vendor/detail` | `VendorController.detail`（`#detail`） | 编辑表单用 |
//! | `GET  /vendor/vendor/currentDetail` | `VendorController.currentDetail`（`#currentDetail`） | 无绑定返回 data:null |
//! | `POST /vendor/vendor/setting` | `VendorController.setting`（`#setting`） | 不级联下架商品 |
//!
//! 身份口径：供应商账号（`TenantContext::vendor_scope()`）访问 `list` /
//! `currentDetail` / `setting` 时固定自身 vendor；平台账号按参数 / 全量。
//! `currentDetail` 对**无绑定管理员**按任务口径返回 `code:0 + data:null`
//! （Java 抛 `VENDOR_NOT_EXIST`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::vendor::vendor::VendorListVO;
use tigshop_core::models::vendor::vendor::{VendorConfigParam, VendorCreateParam, VendorListQuery};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 5 条路由（`(method, 去掉 /adminapi 的路径, 原 Java handler)`）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    ("GET", "/vendor/vendor/list", "VendorController.list"),
    ("POST", "/vendor/vendor/create", "VendorController.create"),
    ("GET", "/vendor/vendor/detail", "VendorController.detail"),
    (
        "GET",
        "/vendor/vendor/currentDetail",
        "VendorController.currentDetail",
    ),
    ("POST", "/vendor/vendor/setting", "VendorController.setting"),
];

/// 域路由（挂载于 `/adminapi` 下，全局 require_auth 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/vendor/vendor/list", get(list))
        .route("/vendor/vendor/create", post(create))
        .route("/vendor/vendor/detail", get(detail))
        .route("/vendor/vendor/currentDetail", get(current_detail))
        .route("/vendor/vendor/setting", post(setting))
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

/// detail / currentDetail 的查询参数（`?id=`）。
#[derive(Debug, Default, Deserialize)]
pub struct VendorIdQuery {
    pub id: Option<i32>,
}

/// `GET /adminapi/vendor/vendor/list`：供应商分页。
async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<VendorListQuery>,
) -> ApiResult<PageResult<VendorListVO>> {
    ok(state.vendor.vendor.list(&q, tenant.vendor_scope()).await?)
}

/// `POST /adminapi/vendor/vendor/create`：创建供应商。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(p): Json<VendorCreateParam>,
) -> ApiResult<i32> {
    ok(state
        .vendor
        .vendor
        .create(&p, auth.id, &auth.username)
        .await?)
}

/// `GET /adminapi/vendor/vendor/detail?id=`：供应商详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<VendorIdQuery>,
) -> ApiResult<tigshop_core::models::vendor::vendor::VendorDetailVO> {
    let id = q.id.unwrap_or(0);
    ok(state.vendor.vendor.detail(id).await?)
}

/// `GET /adminapi/vendor/vendor/currentDetail`：当前管理员绑定供应商的配置详情。
///
/// 无绑定时返回 `data: null`（任务口径；Java 抛业务异常）。
async fn current_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Option<tigshop_core::models::vendor::vendor::VendorDetailVO>> {
    ok(state
        .vendor
        .vendor
        .current_detail(auth.id, tenant.vendor_scope())
        .await?)
}

/// `POST /adminapi/vendor/vendor/setting`：供应商设置保存。
async fn setting(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<VendorConfigParam>,
) -> ApiResult<&'static str> {
    let vendor_id = tenant
        .vendor_scope()
        .ok_or_else(|| tigshop_core::Error::biz(401, "无法获取当前供应商信息"))?;
    state.vendor.vendor.setting(vendor_id, &p).await?;
    ok("保存成功")
}
