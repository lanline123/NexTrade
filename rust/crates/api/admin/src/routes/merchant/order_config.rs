//! 订单配置 —— 管理端路由（merchant::order_config）。
//!
//! 原 Java：`com.tigshop.adminapi.controller.shop.OrderConfigController`
//! （`@RequestMapping("/adminapi/shop/orderConfig")`，
//! `tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/shop/OrderConfigController.java`）
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth / perm |
//! |-----------|------------------|----------------|------------------|
//! | `GET  /shop/orderConfig/list` | `GET /adminapi/shop/orderConfig/list` | `OrderConfigController.list` | jwt / — |
//! | `GET  /shop/orderConfig/detail` | `GET /adminapi/shop/orderConfig/detail` | `OrderConfigController.detail` | jwt / — |
//! | `POST /shop/orderConfig/create` | `POST /adminapi/shop/orderConfig/create` | `OrderConfigController.create` | jwt / — |
//! | `POST /shop/orderConfig/update` | `POST /adminapi/shop/orderConfig/update` | `OrderConfigController.update` | jwt / — |
//! | `POST /shop/orderConfig/del` | `POST /adminapi/shop/orderConfig/del` | `OrderConfigController.del` | jwt / — |
//! | `POST /shop/orderConfig/updateField` | `POST /adminapi/shop/orderConfig/updateField` | `OrderConfigController.updateField` | jwt / — |
//! | `POST /shop/orderConfig/batch` | `POST /adminapi/shop/orderConfig/batch` | `OrderConfigController.batch` | jwt / — |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//! 注意路径中控制器前缀只出现一次（`/shop/orderConfig/...`），
//! 与原 Java `@RequestMapping` 组合结果逐字符一致。
//!
//! > **权限说明**：`OrderConfigController` 上**没有**任何
//! > `@PreAuthorize("@pms.hasPermission(...)")`，契约里 `permissions` 也是空数组，
//! > 因此本域只需登录态（`require_auth`），无需额外权限位校验。
//!
//! > **⚠️ 本域是脚手架复制粘贴后没有改字段的控制器**（详见
//! > `crates/services/src/order_config.rs` 模块头）：表 `order_config` 只有
//! > 4 列 `id` / `shop_id` / `code` / `data`，而 Java 的 DTO / VO 声明的
//! > 却是另一张表的 7 个字段，两边无一重名。因此 Java 的
//! > `list` / `detail` 实际返回全 null 的 VO，`create` / `update` 必然触发
//! > SQL 异常，`updateField` 因白名单为空而**恒定报错**。
//! > 本模块逐条复刻了这些可观测行为，并对「必然失败」的两条给出可诊断的
//! > 业务错误而不是伪造非法 SQL；差异点全部列在 `uncertain_points`。
//!
//! > **多租户说明**：Java 通过 `HeaderUtils.getShopId()`（请求头）取得店铺 id，
//! > 但本域 `create` 里**并没有**调用它（只有 `saveOrderConfig` 用了）。
//! > Rust 侧 JWT 尚未签发 `shop_id`，故 `shopId` 作为**入参**接收
//! > （表列 `shop_id` 为 `NOT NULL`，没有它无从落库）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::order_config::{
    BatchDTO, OperateDTO, OrderConfigCreateDTO, OrderConfigListQuery, OrderConfigUpdateDTO,
    OrderConfigVO, UpdateFieldDTO, MSG_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

/// 订单配置域管理端路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // —— OrderConfigController @ /adminapi/shop/orderConfig ——
        .route("/shop/orderConfig/list", get(order_config_list))
        .route("/shop/orderConfig/detail", get(order_config_detail))
        .route("/shop/orderConfig/create", post(order_config_create))
        .route("/shop/orderConfig/update", post(order_config_update))
        .route("/shop/orderConfig/del", post(order_config_del))
        .route(
            "/shop/orderConfig/updateField",
            post(order_config_update_field),
        )
        .route("/shop/orderConfig/batch", post(order_config_batch))
        .layer(axum::middleware::from_fn(require_platform_mw))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/shop/orderConfig/list",
            "OrderConfigController.list",
        ),
        (
            "GET",
            "/adminapi/shop/orderConfig/detail",
            "OrderConfigController.detail",
        ),
        (
            "POST",
            "/adminapi/shop/orderConfig/create",
            "OrderConfigController.create",
        ),
        (
            "POST",
            "/adminapi/shop/orderConfig/update",
            "OrderConfigController.update",
        ),
        (
            "POST",
            "/adminapi/shop/orderConfig/del",
            "OrderConfigController.del",
        ),
        (
            "POST",
            "/adminapi/shop/orderConfig/updateField",
            "OrderConfigController.updateField",
        ),
        (
            "POST",
            "/adminapi/shop/orderConfig/batch",
            "OrderConfigController.batch",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 平台级接口：店铺/供应商账号一律 403（顺序：认证中间件先注入 TenantContext）。
async fn require_platform_mw(
    Extension(tenant): Extension<TenantContext>,
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(next.run(req).await)
}

/// `GET /adminapi/shop/orderConfig/list`：订单配置分页。
///
/// 对应 Java `OrderConfigController.list`（`OrderConfigListDTO` 查询参数）。
///
/// ⚠️ `isShow` 与 `keyword` 在 Java 服务实现里**被整段注释掉了**
/// （`OrderConfigServiceImpl` 第 61–70 行），因此传了也不生效；
/// 本实现保留字段但不参与过滤，与 Java 一致。
async fn order_config_list(
    State(state): State<AdminState>,
    Query(q): Query<OrderConfigListQuery>,
) -> ApiResult<PageResult<OrderConfigVO>> {
    ok(state.merchant.order_config.list(&q).await?)
}

/// `GET /adminapi/shop/orderConfig/detail?id=`：订单配置详情。
///
/// 对应 Java `OrderConfigController.detail`（`@RequestParam Integer id`，
/// 缺失时 Spring 抛 `MissingServletRequestParameterException` ⇒ 400）。
/// Java 在记录不存在时返回一个全 null 的 VO（`copyProperties(null, vo)`）；
/// 本实现返回可诊断的 404（项目内 order_admin/005/017/075 的既有约定）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 订单配置主键（Java `@RequestParam Integer id`，必填）
    id: Option<i32>,
}

async fn order_config_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<OrderConfigVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state.merchant.order_config.detail(id).await?)
}

/// `POST /adminapi/shop/orderConfig/create`：创建订单配置。
///
/// 对应 Java `OrderConfigController.create`（`@Valid @RequestBody
/// OrderConfigCreateDTO`）。
///
/// ⚠️ Java 的 DTO 字段全都不是表的列，`save` 必然因 `shop_id` / `code`
/// 的 `NOT NULL` 抛 SQL 异常；本实现保留 Java 的 `orderConfigName` 校验文案，
/// 并额外要求 `shopId` / `code` 入参（表的两列 `NOT NULL`），
/// 缺失时返回可诊断的业务错误。
/// 返回新建主键（Java 返回 `void`，不便前端跳转编辑）。
async fn order_config_create(
    State(state): State<AdminState>,
    Json(dto): Json<OrderConfigCreateDTO>,
) -> ApiResult<i32> {
    ok(state.merchant.order_config.create(&dto).await?)
}

/// `POST /adminapi/shop/orderConfig/update`：更新订单配置。
///
/// 对应 Java `OrderConfigController.update`（`@Valid @RequestBody
/// OrderConfigUpdateDTO`，只有 `orderConfigId` 带 `@NotNull`）。
///
/// ⚠️ Java 在「除主键外全 null」时会生成
/// `UPDATE order_config SET WHERE id = ?`（无 SET 项）并抛语法错误；
/// 本实现返回「无可更新字段」的可诊断业务错误。
/// 返回是否命中记录（Java 返回 `void`）。
async fn order_config_update(
    State(state): State<AdminState>,
    Json(dto): Json<OrderConfigUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.merchant.order_config.update(&dto).await?)
}

/// `POST /adminapi/shop/orderConfig/del`：删除订单配置（硬删除）。
///
/// 对应 Java `OrderConfigController.del`（`@Valid @RequestBody OperateDTO`）
/// → `BaseServiceImpl#del` → `removeById`。
/// 与 Java 一致：**不校验记录是否存在**（删不存在的 id 也返回成功）。
async fn order_config_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.merchant.order_config.del(&dto).await?)
}

/// `POST /adminapi/shop/orderConfig/updateField`：单字段更新。
///
/// 对应 Java `OrderConfigController.updateField`（`@Valid @RequestBody
/// UpdateFieldDTO`，白名单 `CheckFieldConstants.ORDER_CONFIG_FIELDS`）。
///
/// ⚠️ **该白名单在 Java 里是空数组 `{}`**，因此 Java 侧对任何字段都抛
/// `字段值不合法` —— 这是一个**恒定失败**的接口。本实现逐字符复刻该行为，
/// 不「顺手修好」（见 `crates/services/src/order_config.rs` 的说明
/// 与 `uncertain_points`）。
async fn order_config_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.merchant.order_config.update_field(&dto).await?)
}

/// `POST /adminapi/shop/orderConfig/batch`：批量操作。
///
/// 对应 Java `OrderConfigController.batch`（`@Valid @RequestBody BatchDTO`）
/// → `BaseServiceImpl#batch`：仅 `type == "del"` 生效，
/// 其余类型**静默返回 `false`**（Java 行为，不是报错）。
async fn order_config_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.merchant.order_config.batch(&dto).await?)
}
