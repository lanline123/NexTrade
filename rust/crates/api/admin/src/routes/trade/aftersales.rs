//! 管理端售后管理路由（trade::aftersales）。
//! 对应原 Java `com.tigshop.adminapi.controller.order.AftersalesController`
//! （`@RequestMapping("/adminapi/order/aftersales")`）。
//!
//! | 本模块路由 | 原 Java 方法 | 权限 |
//! |-----------|-------------|------|
//! | `GET  /adminapi/order/aftersales/applyType` | `AftersalesController.applyType` | 登录 |
//! | `GET  /adminapi/order/aftersales/returnGoodsStatus` | `AftersalesController.returnGoodsStatus` | 登录 |
//! | `GET  /adminapi/order/aftersales/list` | `AftersalesController.list` | 登录 |
//! | `GET  /adminapi/order/aftersales/detail` | `AftersalesController.detail` | 登录 |
//! | `POST /adminapi/order/aftersales/create` | `AftersalesController.create` | 登录 |
//! | `POST /adminapi/order/aftersales/update` | `AftersalesController.update` | `aftersalesModifyManage` |
//! | `POST /adminapi/order/aftersales/receive` | `AftersalesController.receive` | `aftersalesModifyManage` |
//! | `POST /adminapi/order/aftersales/rejectReceive` | `AftersalesController.rejectReceive` | `aftersalesModifyManage` |
//! | `POST /adminapi/order/aftersales/record` | `AftersalesController.record` | `aftersalesModifyManage` |
//! | `POST /adminapi/order/aftersales/complete` | `AftersalesController.complete` | `aftersalesModifyManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission('aftersalesModifyManage')")`
//! > 在方法级校验 `update` / `receive` / `rejectReceive` / `record` / `complete`；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / stock_warning.rs 的已知缺口一致）。
//!
//! > **多租户说明**：Java 通过 `HeaderUtils.getAdminType()` / `getShopId()` /
//! > `getVendorId()`（请求头 `x-admin-type` / `x-shop-id` / `x-vendor-id`）
//! > 区分平台、店铺、供应商账号。Rust 侧 JWT 尚未签发这些字段，故同样优先读请求头，
//! > 缺失时回退 JWT 的 `admin_type`（见 [`resolve_scope`]）。
//!
//! > **`create` 端点说明**：Java `create(@RequestBody AftersalesApplyParam)` 只是把
//! > DTO 逐字段拷进 `Aftersales` 后 `save()`，**不校验订单/售后数量、不写明细、
//! > 不写协商记录、不计算退款金额**（真正的完整申请流程在
//! > `AftersalesServiceImpl#afterSalesApply`，由前台 `/api/user/aftersales/create`
//! > 调用）。本实现忠实复刻该「裸插入」语义，因此不提供 `POST` 之外的业务校验；
//! > 详见 `uncertain_points`。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus 的 `Page<AftersalesVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`）——与 order_admin 同一约定。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::trade::aftersales::{
    admin_type, AfterSalesCompleteParam, AfterSalesRejectReceiveParam, AftersalesCreateParam,
    AftersalesEditParam, AftersalesListQuery, AftersalesReceiveParam, AftersalesRecordCreateParam,
    AftersalesVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 售后管理域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/order/aftersales/applyType", get(aftersales_apply_type))
        .route(
            "/order/aftersales/returnGoodsStatus",
            get(aftersales_return_goods_status),
        )
        .route("/order/aftersales/list", get(aftersales_list))
        .route("/order/aftersales/detail", get(aftersales_detail))
        .route("/order/aftersales/create", post(aftersales_create))
        .route("/order/aftersales/update", post(aftersales_update))
        .route("/order/aftersales/receive", post(aftersales_receive))
        .route(
            "/order/aftersales/rejectReceive",
            post(aftersales_reject_receive),
        )
        .route("/order/aftersales/record", post(aftersales_record))
        .route("/order/aftersales/complete", post(aftersales_complete))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/order/aftersales/applyType",
            "AftersalesController.applyType",
        ),
        (
            "GET",
            "/adminapi/order/aftersales/returnGoodsStatus",
            "AftersalesController.returnGoodsStatus",
        ),
        (
            "GET",
            "/adminapi/order/aftersales/list",
            "AftersalesController.list",
        ),
        (
            "GET",
            "/adminapi/order/aftersales/detail",
            "AftersalesController.detail",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/create",
            "AftersalesController.create",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/update",
            "AftersalesController.update",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/receive",
            "AftersalesController.receive",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/rejectReceive",
            "AftersalesController.rejectReceive",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/record",
            "AftersalesController.record",
        ),
        (
            "POST",
            "/adminapi/order/aftersales/complete",
            "AftersalesController.complete",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 主体（替代 Java HeaderUtils）
// ——————————————————————————————————————————————

/// 当前请求的账号视角（对应 Java `HeaderUtils.getAdminType/getShopId/getVendorId`）。
#[derive(Debug, Clone, Default)]
struct RequestScope {
    /// `x-admin-type`（缺失时回退 JWT 的 `admin_type`）
    admin_type: Option<String>,
    /// `x-shop-id`（仅 `shop` / `pos` 账号有意义，Java `HeaderUtils.getShopId`）
    shop_id: Option<i32>,
    /// `x-vendor-id`（仅 `vendor` 账号有意义，Java `HeaderUtils.getVendorId`）
    vendor_id: Option<i32>,
}

impl RequestScope {
    /// 是否供应商后台账号（Java `AdminTypeEnum.fromCode(getAdminType()) == VENDOR`）。
    fn is_vendor_admin(&self) -> bool {
        self.admin_type.as_deref() == Some(admin_type::VENDOR)
    }

    /// 列表过滤用的店铺ID（Java `shopFlag = HeaderUtils.getShopId() > 0`）。
    fn filter_shop_id(&self) -> Option<i32> {
        match self.admin_type.as_deref() {
            // 平台账号：HeaderUtils.getShopId() 返回 0 → 不过滤
            Some(admin_type::ADMIN) => None,
            Some(admin_type::SHOP) | Some(admin_type::POS) => self.shop_id,
            _ => None,
        }
    }

    /// 列表过滤用的供应商ID（Java `vendorFlag = getVendorId() > 0`）。
    ///
    /// 注意：Java `getVendorId()` 仅在 `adminType == "vendor"` 时读取请求头，
    /// 其余账号返回 null；此处保持同一口径，避免平台账号被 `x-vendor-id` 意外过滤。
    fn filter_vendor_id(&self) -> Option<i32> {
        if self.is_vendor_admin() {
            self.vendor_id
        } else {
            None
        }
    }
}

/// 解析当前请求的账号视角（**仅使用认证身份**，不信任请求头/查询参数）。
///
/// - `admin_type`：JWT 的 `admin_type`；
/// - `shop_id`：`AuthUser::scoped_shop_id()`（店铺/门店/POS 强制自身店铺，平台为 `None`）；
/// - `vendor_id`：JWT 未签发供应商 ID → `None`（供应商视角过滤未迁移，见报告）。
fn resolve_scope(auth: &AuthUser) -> RequestScope {
    RequestScope {
        admin_type: auth.admin_type.clone(),
        shop_id: auth.scoped_shop_id(),
        vendor_id: None,
    }
}

/// 读取当前登录管理员用户名（供协商记录 `admin_name` / `user_name` 使用）。
fn current_username(auth: &AuthUser) -> Option<&str> {
    let name = auth.username.trim();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

// ——————————————————————————————————————————————
// 下拉枚举
// ——————————————————————————————————————————————

/// `GET /adminapi/order/aftersales/applyType`：申请类型。
///
/// 对应 Java `AftersalesController.applyType()`，返回
/// `{"1":"退货/退款","2":"仅退款"}`。
async fn aftersales_apply_type(
    State(state): State<AdminState>,
) -> ApiResult<std::collections::BTreeMap<i32, String>> {
    ok(state.trade.aftersales.apply_type())
}

/// `GET /adminapi/order/aftersales/returnGoodsStatus`：退换货状态。
///
/// 对应 Java `AftersalesController.returnGoodsStatus()`。供应商后台账号返回
/// `{21,22,6}` 三元素表，其余返回 1..7（当前部署 `is-vendor: 0`，不含 21/22）。
async fn aftersales_return_goods_status(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<std::collections::BTreeMap<i32, String>> {
    let scope = resolve_scope(&auth);
    ok(state
        .trade
        .aftersales
        .return_goods_status(scope.admin_type.as_deref()))
}

// ——————————————————————————————————————————————
// 列表 / 详情
// ——————————————————————————————————————————————

/// `GET /adminapi/order/aftersales/list`：售后分页。
///
/// 对应 Java `AftersalesController.list(AftersalesListPageQuery)`，返回
/// MyBatis-Plus `Page<AftersalesVO>`；Rust 统一使用项目既有的
/// `PageResult`（`list/total/totalPage/pageSize/page`）。
async fn aftersales_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<AftersalesListQuery>,
) -> ApiResult<PageResult<AftersalesVO>> {
    let scope = resolve_scope(&auth);
    ok(state
        .trade
        .aftersales
        .list(
            &query,
            scope.filter_shop_id(),
            scope.filter_vendor_id(),
            scope.is_vendor_admin(),
        )
        .await?)
}

/// `GET /adminapi/order/aftersales/detail?id=`：售后详情。
///
/// 对应 Java `AftersalesController.detail(@RequestParam Integer id)`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
    /// 兼容前端传入 `aftersaleId`
    aftersale_id: Option<i32>,
}

impl IdQuery {
    /// 取售后ID（`id` 优先）。
    fn resolved_id(&self) -> Result<i32> {
        self.id
            .or(self.aftersale_id)
            .ok_or_else(|| Error::Validation("售后ID不能为空".into()))
    }
}

async fn aftersales_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(query): Query<IdQuery>,
) -> ApiResult<AftersalesVO> {
    let vo = state.trade.aftersales.detail(query.resolved_id()?).await?;
    // 多租户：店铺账号只能查看本店售后单。
    auth.ensure_shop_access(vo.shop_id)?;
    ok(vo)
}

/// 校验某售后单是否属于当前账号可访问的店铺（写操作前置校验）。
async fn ensure_aftersales_access(
    state: &AdminState,
    auth: &AuthUser,
    id: Option<i32>,
) -> std::result::Result<(), tigshop_security::web::AppError> {
    let id = id.ok_or_else(|| tigshop_core::Error::Validation("售后ID不能为空".into()))?;
    let vo = state.trade.aftersales.detail(id).await?;
    auth.ensure_shop_access(vo.shop_id)?;
    Ok(())
}

// ——————————————————————————————————————————————
// 创建
// ——————————————————————————————————————————————

/// `POST /adminapi/order/aftersales/create`：创建售后单（裸插入）。
///
/// 对应 Java `AftersalesController.create(@RequestBody AftersalesApplyParam)`。
/// Java 仅把 DTO 字段拷进 `Aftersales` 后 `save()`，**不做订单校验、不写明细、
/// 不写协商记录、不计算退款金额**（完整申请流程在 `afterSalesApply`，
/// 由前台 `/api/user/aftersales/create` 触发）。
///
/// 原接口返回 `void`；这里回传新建的 `aftersaleId` 便于运维排查。
///
/// **未迁移依赖**：微信直播订单同步（`wechatLiveOrderSyncService.onAftersaleChanged`）。
async fn aftersales_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AftersalesCreateParam>,
) -> ApiResult<serde_json::Value> {
    // 多租户：店铺账号只能为**本店订单**创建售后单；平台账号不限。
    if let Some(scope) = auth.scoped_shop_id() {
        let order_id = param.order_id.filter(|id| *id > 0).ok_or_else(|| {
            tigshop_core::Error::Forbidden("店铺账号创建售后必须指定本店订单".into())
        })?;
        let order = state.trade.order_admin.detail(order_id).await?;
        if order.shop_id != scope {
            return Err(tigshop_core::Error::Forbidden(format!(
                "无权访问店铺 {} 的数据",
                order.shop_id
            ))
            .into());
        }
    }
    let aftersale_id = state.trade.aftersales.create(&param).await?;
    ok(serde_json::json!({ "aftersaleId": aftersale_id }))
}

// ——————————————————————————————————————————————
// 审核 / 收货 / 拒收 / 反馈 / 完结
// ——————————————————————————————————————————————

/// `POST /adminapi/order/aftersales/update`：售后审核（同意/驳回）。
///
/// 对应 Java `AftersalesController.update(@RequestBody @Validated
/// AftersalesEditParam)`（权限 `aftersalesModifyManage`）。Java 返回 `void`，
/// 此处返回提示文案（项目内既有约定）。
async fn aftersales_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AftersalesEditParam>,
) -> ApiResult<&'static str> {
    ensure_aftersales_access(&state, &auth, param.id).await?;
    state.trade.aftersales.update(&param).await?;
    ok("操作成功")
}

/// `POST /adminapi/order/aftersales/receive`：售后确认收货。
///
/// 对应 Java `AftersalesController.receive(@RequestBody Map<String, Integer> data)`
/// ——Java 直接读 `data.get("id")`，此处用同构的 `{ "id": n }` 结构体承接。
async fn aftersales_receive(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AftersalesReceiveParam>,
) -> ApiResult<&'static str> {
    ensure_aftersales_access(&state, &auth, param.id).await?;
    state.trade.aftersales.receive(&param).await?;
    ok("确认收货成功")
}

/// `POST /adminapi/order/aftersales/rejectReceive`：售后拒收。
///
/// 对应 Java `AftersalesController.rejectReceive(@RequestBody @Validated
/// AfterSalesRejectReceiveDTO dto)`（权限 `aftersalesModifyManage`）。
async fn aftersales_reject_receive(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AfterSalesRejectReceiveParam>,
) -> ApiResult<&'static str> {
    ensure_aftersales_access(&state, &auth, param.id).await?;
    state.trade.aftersales.reject_receive(&param).await?;
    ok("拒收成功")
}

/// `POST /adminapi/order/aftersales/record`：提交售后反馈记录。
///
/// 对应 Java `AftersalesController.record(@RequestBody AftersalesRecordCreateDTO)`：
/// 记录人取当前登录管理员（`SecurityUtils.getCurrentAdminId()` /
/// `getCurrentUsername()`）。
async fn aftersales_record(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AftersalesRecordCreateParam>,
) -> ApiResult<&'static str> {
    ensure_aftersales_access(&state, &auth, param.aftersale_id).await?;
    state
        .trade
        .aftersales
        .submit_record(&param, Some(auth.id), current_username(&auth))
        .await?;
    ok("提交成功")
}

/// `POST /adminapi/order/aftersales/complete`：售后完结（驳回后关单）。
///
/// 对应 Java `AftersalesController.complete(@RequestBody AfterSalesCompleteDTO)`。
async fn aftersales_complete(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AfterSalesCompleteParam>,
) -> ApiResult<&'static str> {
    ensure_aftersales_access(&state, &auth, param.resolved_id()).await?;
    state.trade.aftersales.complete(&param).await?;
    ok("售后已关闭")
}
