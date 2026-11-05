//! 管理端交易日志（支付日志）路由（payment::paylog_batch）。
//! 对应原 Java `com.tigshop.adminapi.controller.finance.PaylogController`
//! （`@RequestMapping("/adminapi/finance/payLog")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `POST /adminapi/finance/payLog/del` | `PaylogController.del` | `payLogBatchManage` |
//! | `POST /adminapi/finance/payLog/updateField` | `PaylogController.updateField` | 登录 |
//! | `POST /adminapi/finance/payLog/batch` | `PaylogController.batch` | `payLogBatchManage` |
//!
//! > **本片只负责这 3 条**。同一控制器的 `list` / `detail` / `create` / `update`
//! > （`PaylogController.java:52/58/64/70`）已由早期域
//! > `routes/paylog.rs` + `services/paylog.rs` 实现并注册在
//! > `routes/mod.rs::merge_all` 中，**本切片不得重复注册**，否则 axum 0.8 的
//! > `Router::merge` 会因「同路径 + 同 method」重复而在服务启动时 panic
//! > （校验工具：`python tools/check_route_conflicts.py --strict`）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission('payLogBatchManage')")`
//! > 在 `del` / `batch` 上做方法级校验；Rust 侧 `require_auth`
//! > （由 `api/admin/src/lib.rs::router` 统一套在 `/adminapi` 子树外层）
//! > 只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / brand.rs / shop_manage.rs / pc_navigation.rs
//! > 的已知缺口一致）。上表「权限」列仅作对照，当前**任何已登录管理员**
//! > 都能调用本域全部接口 —— 即「删除支付日志」这一高危操作目前**无权限门禁**。
//!
//! > **返回结构说明**：Java 三接口均返回 `void`（HTTP 200 + `data: null`）。
//! > 本实现回传布尔结果（`removeById` / `removeByIds` / `update` 的返回值），
//! > `data` 由 `null` 变为 `true`/`false`，便于前端与运维判断是否命中记录；
//! > 这是与 pc_navigation 等切片一致的既有约定。
//!
//! > **`updateField` 恒失败**：Java 白名单 `GENERAL_FIELDS`
//! > （`is_show`/`sort_order`/`status`）与 `paylog` 表零交集，故该接口在
//! > 原系统里**任何入参都返回业务错误码 1001「field 的值有误」**。
//! > 本实现照抄该行为（见 `services/paylog_batch.rs` 模块头第 3 条），
//! > 不伪造列、不放宽白名单。

use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::{BatchDTO, OperateDTO, UpdateFieldDTO};
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 3 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源；顺序与原 Java `PaylogController` 一致。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("POST", "/finance/payLog/del", "PaylogController.del"),
    (
        "POST",
        "/finance/payLog/updateField",
        "PaylogController.updateField",
    ),
    ("POST", "/finance/payLog/batch", "PaylogController.batch"),
];

/// 交易日志（支付日志）域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/finance/payLog")` +
/// `@PostMapping("/del" | "/updateField" | "/batch")`：
/// `payLog` 的 **L 大写**，`updateField` 的 **F 大写**。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/payLog/del", post(paylog_del))
        .route("/finance/payLog/updateField", post(paylog_update_field))
        .route("/finance/payLog/batch", post(paylog_batch))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `POST /adminapi/finance/payLog/del`：删除单条支付日志。
///
/// 对应 Java `PaylogController.del(@RequestBody OperateDTO operateDTO)`
/// （`PaylogController.java:76-81`）→ `paylogService.del(operateDTO.getId())`
/// → `BaseServiceImpl#del`（物理删除 `paylog` 行）。
/// Java 返回 `void`，此处回传删除是否生效。
async fn paylog_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.payment.paylog_batch.delete(&dto).await?)
}

/// `POST /adminapi/finance/payLog/updateField`：通用单字段更新。
///
/// 对应 Java `PaylogController.updateField(@RequestBody UpdateFieldDTO updateField)`
/// （`PaylogController.java:83-87`）→
/// `paylogService.updateField(updateField, GENERAL_FIELDS)`。
///
/// ⚠️ 与 Java 一致，**任何入参都返回业务错误 1001「field 的值有误」**：
/// `GENERAL_FIELDS` 的三个列在 `paylog` 表都不存在。详见服务层模块头。
async fn paylog_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.payment.paylog_batch.update_field(&dto).await?)
}

/// `POST /adminapi/finance/payLog/batch`：批量操作（仅 `type = "del"` 删除）。
///
/// 对应 Java `PaylogController.batch(@RequestBody BatchDTO batchDTO)`
/// （`PaylogController.java:89-94`）→ `paylogService.batch(batchDTO)`
/// → `BaseServiceImpl#batch`。
/// `type != "del"`（含缺省）时 Java 直接 `return false` 且无副作用，此处一致。
async fn paylog_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.payment.paylog_batch.batch(&dto).await?)
}
