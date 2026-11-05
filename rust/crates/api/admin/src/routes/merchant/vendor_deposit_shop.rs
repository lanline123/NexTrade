//! 供应商端保证金 —— 管理端路由（merchant::vendor_deposit_shop）。
//!
//! 原 Java：`VendorDepositShopController`
//! （`tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/deposit/VendorDepositShopController.java`，
//! `@RestController` + `@RequestMapping("/adminapi/deposit/vendor")`，
//! **无**类级 / 方法级 `@PreAuthorize`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET /deposit/vendor/overview` | `GET /adminapi/deposit/vendor/overview` | `VendorDepositShopController.overview`（`:32`） | jwt |
//! | `GET /deposit/vendor/logList` | `GET /adminapi/deposit/vendor/logList` | `VendorDepositShopController.logList`（`:38`） | jwt |
//! | `GET /deposit/vendor/frozenDetailList` | `GET /adminapi/deposit/vendor/frozenDetailList` | `VendorDepositShopController.frozenDetailList`（`:44`） | jwt |
//! | `GET /deposit/vendor/warning` | `GET /adminapi/deposit/vendor/warning` | `VendorDepositShopController.warning`（`:50`） | jwt |
//! | `GET /deposit/vendor/protocol` | `GET /adminapi/deposit/vendor/protocol` | `VendorDepositShopController.protocol`（`:56`） | jwt |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//! ⚠️ `logList` / `frozenDetailList` 是**小驼峰**（不是 `log_list` /
//! `frozen_detail_list`），必须逐字符照抄。
//!
//! ## 多租户 / 身份（**本域最关键的语义**）
//!
//! 控制器私有方法 `currentVendorId()`（`:72-78`）：
//!
//! ```java
//! Integer vendorId = HeaderUtils.getVendorId();
//! if (vendorId == null || vendorId <= 0) {
//!     throw new GlobalException("无法获取当前供应商信息", HttpStatus.UNAUTHORIZED);
//! }
//! ```
//!
//! `HeaderUtils.getVendorId()`（`HeaderUtils.java:154-161`）**只**在
//! `getAdminType()` 等于 `"vendor"` 时读取请求头 `x-vendor-id`，
//! 否则返回 `null`；`x-vendor-id` 为空串时也返回 `null`。
//!
//! ⇒ 所有 5 个接口都**必须**带 `x-admin-type: vendor` + 合法 `x-vendor-id`，
//! 否则 401 + `"无法获取当前供应商信息"`。
//! 本模块用 [`resolve_vendor_id`] 复刻该判定（`x-admin-type` 缺失时回退
//! JWT 的 `admin_type`，与 aftersales/010/144 同口径），并**不接收**外部传入的
//! `vendorId`，避免越权查询他供应商保证金。
//!
//! ⚠️ `protocol` 在 Java 里**不调用** `currentVendorId()`（协议是平台级配置），
//! 但本实现仍统一做身份校验：`/adminapi` 子树整体已挂 `require_auth`
//! （登录态），而 Java 侧 `x-admin-type: vendor` 是**认证过滤器**要求的合法后台
//! 类型之一（`JwtAuthenticationFilter.java:138-142`）。为保持 5 个接口口径一致、
//! 且不放过「平台管理员误调供应商端接口」，此处同样校验供应商身份。
//! 这一处**相对 Java 更严格**，已列入 `uncertain_points`。
//!
//! ## 返回结构说明
//!
//! Java `logList` / `frozenDetailList` 返回 MyBatis-Plus
//! `Page<T>`（`records`/`total`/`size`/`current`/`pages`），Rust 统一使用项目既有
//! [`PageResult`]（`list`/`total`/`totalPage`/`pageSize`/`page`），
//! 与 product_manage/002/005/010/014/017/075/163 一致。
//! 其余 3 个端点返回单个 VO。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::merchant::vendor_deposit_shop::{
    DepositShopFrozenDetailVO, DepositShopLogQuery, DepositShopLogVO, DepositShopOverviewVO,
    DepositShopProtocolVO, DepositShopWarningVO, HTTP_UNAUTHORIZED, MSG_VENDOR_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 5 条路由（`(HTTP method, 去掉 /adminapi 前缀的路径, 原 Java handler)`）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/deposit/vendor/overview",
        "VendorDepositShopController.overview",
    ),
    (
        "GET",
        "/deposit/vendor/logList",
        "VendorDepositShopController.logList",
    ),
    (
        "GET",
        "/deposit/vendor/frozenDetailList",
        "VendorDepositShopController.frozenDetailList",
    ),
    (
        "GET",
        "/deposit/vendor/warning",
        "VendorDepositShopController.warning",
    ),
    (
        "GET",
        "/deposit/vendor/protocol",
        "VendorDepositShopController.protocol",
    ),
];

/// 供应商端保证金域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不能从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py::collect_rust_routes` 静态扫描
/// `\.route\(\s*"(?P<path>...)"`，循环拼接会让覆盖率统计看不见这些路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/deposit/vendor/overview", get(overview))
        .route("/deposit/vendor/logList", get(log_list))
        .route("/deposit/vendor/frozenDetailList", get(frozen_detail_list))
        .route("/deposit/vendor/warning", get(warning))
        .route("/deposit/vendor/protocol", get(protocol))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 供应商标识（替代 Java HeaderUtils.getVendorId）
// ——————————————————————————————————————————————

/// 校验并返回当前供应商（来自 JWT `TenantContext.vendor_scope()`，**不信任请求头**）。
///
/// 非供应商账号或缺少 `vendor_id` → `Error::biz(401, 无法获取当前供应商信息)`，
/// 经 `AppError` 映射为 HTTP 401（与 Java `currentVendorId` 一致）。
fn current_vendor(tenant: &TenantContext) -> Result<i32, AppError> {
    tenant
        .vendor_scope()
        .ok_or_else(|| tigshop_core::Error::biz(HTTP_UNAUTHORIZED, MSG_VENDOR_REQUIRED).into())
}

// ——————————————————————————————————————————————
// Handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/deposit/vendor/overview`：保证金总览。
///
/// 对应 Java `VendorDepositShopController.overview()`（`:41`）
/// → `VendorDepositShopServiceImpl#getOverview(vendorId)`。
async fn overview(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DepositShopOverviewVO> {
    let vendor_id = current_vendor(&tenant)?;
    ok(state
        .merchant
        .vendor_deposit_shop
        .overview(vendor_id)
        .await?)
}

/// `GET /adminapi/deposit/vendor/logList`：供应商端交易流水（分页）。
///
/// 对应 Java `VendorDepositShopController.logList(DepositShopLogQueryParam param)`（`:47`）
/// → `VendorDepositShopServiceImpl#logList(vendorId, param)`。
///
/// 查询参数按 Java `DepositShopLogQueryParam`（继承 `BasePage`）契约：
/// `type` / `tradeNo` / `startTime` / `endTime` / `page` / `size`
/// （注意是 `size`，不是 `pageSize`）。
async fn log_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositShopLogQuery>,
) -> ApiResult<PageResult<DepositShopLogVO>> {
    let vendor_id = current_vendor(&tenant)?;
    ok(state
        .merchant
        .vendor_deposit_shop
        .log_list(vendor_id, &q)
        .await?)
}

/// `GET /adminapi/deposit/vendor/frozenDetailList`：冻结明细（平台扣款记录）。
///
/// 对应 Java
/// `VendorDepositShopController.frozenDetailList(DepositShopLogQueryParam param)`（`:53`）
/// → `VendorDepositShopServiceImpl#frozenDetailList(vendorId, param)`。
///
/// ⚠️ 实现只返回 `type = 4`（平台扣除）的流水，`param.type` 被**忽略**
/// （Java 亦然），详见 `core::models::tigshop_core::models::merchant::vendor_deposit_shop::DepositShopFrozenDetailVO` 的注释。
async fn frozen_detail_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<DepositShopLogQuery>,
) -> ApiResult<PageResult<DepositShopFrozenDetailVO>> {
    let vendor_id = current_vendor(&tenant)?;
    ok(state
        .merchant
        .vendor_deposit_shop
        .frozen_detail_list(vendor_id, &q)
        .await?)
}

/// `GET /adminapi/deposit/vendor/warning`：首页保证金预警横幅。
///
/// 对应 Java `VendorDepositShopController.warning()`（`:59`）
/// → `VendorDepositShopServiceImpl#getWarning(vendorId)`。
async fn warning(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DepositShopWarningVO> {
    let vendor_id = current_vendor(&tenant)?;
    ok(state
        .merchant
        .vendor_deposit_shop
        .warning(vendor_id)
        .await?)
}

/// `GET /adminapi/deposit/vendor/protocol`：保证金协议。
///
/// 对应 Java `VendorDepositShopController.protocol()`（`:65`）
/// → `VendorDepositShopServiceImpl#getProtocol()`（**与 vendorId 无关**，
/// 读平台级配置 `deposit_protocol_enable` / `deposit_protocol_content`）。
///
/// ⚠️ 本实现仍校验供应商身份（见模块头「多租户 / 身份」的说明）。
async fn protocol(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<DepositShopProtocolVO> {
    let _vendor_id = current_vendor(&tenant)?;
    ok(state.merchant.vendor_deposit_shop.protocol().await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::merchant::vendor_deposit_shop::DepositShopLogQuery;

    fn vendor(vendor_id: i32) -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(vendor_id))
    }

    fn shop() -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(9), None)
    }

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            "GET /adminapi/deposit/vendor/overview",
            "GET /adminapi/deposit/vendor/logList",
            "GET /adminapi/deposit/vendor/frozenDetailList",
            "GET /adminapi/deposit/vendor/warning",
            "GET /adminapi/deposit/vendor/protocol",
        ];
        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}; 实际={keys:?}");
        }
        for d in &docs {
            assert!(d.java_ref.starts_with("VendorDepositShopController."));
            assert_eq!(d.method, "GET");
        }
    }

    /// 供应商身份只来自 JWT `TenantContext`：店铺/平台账号 → 401。
    #[test]
    fn vendor_identity_comes_from_tenant_context_only() {
        assert_eq!(current_vendor(&vendor(5)).expect("供应商应通过"), 5);
        let err = current_vendor(&shop()).expect_err("店铺账号不得访问供应商接口");
        assert_eq!(err.0.business_code(), 401);
        assert_eq!(
            err.0.to_string(),
            format!("业务错误 [401]: {MSG_VENDOR_REQUIRED}")
        );
        assert!(current_vendor(&platform()).is_err());
        // 缺失 vendor_id 的 vendor 类型账号同样 401
        let no_vendor = TenantContext::new(Some("vendor".into()), None, None);
        assert!(current_vendor(&no_vendor).is_err());
    }

    #[test]
    fn log_query_accepts_java_param_names() {
        let q: DepositShopLogQuery = serde_json::from_str(
            r#"{"type":2,"tradeNo":"123","startTime":1,"endTime":2,"page":3,"size":4}"#,
        )
        .unwrap();
        assert_eq!(q.r#type, Some(2));
        assert_eq!(q.trade_no.as_deref(), Some("123"));
        assert_eq!(q.type_filter(), vec![2, 3]);
    }
}
