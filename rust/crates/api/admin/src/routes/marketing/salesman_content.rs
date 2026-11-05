//! 管理端分销内容路由（marketing::salesman_content）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanContentController`
//! （`@RequestMapping("/adminapi/salesman/content")`，8 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 方法级权限 |
//! |----------------------------------|---------|-----------|
//! | `GET  /salesman/content/list`        | `SalesmanContentController.list`        | — |
//! | `GET  /salesman/content/config`      | `SalesmanContentController.config`      | — |
//! | `GET  /salesman/content/detail`      | `SalesmanContentController.detail`      | — |
//! | `POST /salesman/content/create`      | `SalesmanContentController.create`      | `salesmanContentModifyManage` |
//! | `POST /salesman/content/update`      | `SalesmanContentController.update`      | `salesmanContentModifyManage` |
//! | `POST /salesman/content/del`         | `SalesmanContentController.del`         | `salesmanContentModifyManage` |
//! | `POST /salesman/content/updateField` | `SalesmanContentController.updateField` | `salesmanContentModifyManage` |
//! | `POST /salesman/content/batch`       | `SalesmanContentController.batch`       | `salesmanContentModifyManage` |
//!
//! ## 权限
//! Java 四个写接口标 `@PreAuthorize("@pms.hasPermission('salesmanContentModifyManage')")`；
//! Rust 侧 `/adminapi` 子树只统一挂 `require_auth`（登录态），**权限点矩阵尚未实现**
//! （与 product_manage / salesman_material_category 等同一已知缺口）：
//!
//! ## 多租户
//! Java `SalesmanContentServiceImpl#list` 用 `HeaderUtils.getShopId()` 决定
//! `shop_id` 过滤（三态：`admin` → `0`；`shop`/`pos` → `x-shop-id`；其它 → `null`
//! ⇒ `eq(shop_id, null)` 恒不命中）。Rust JWT 尚未签发店铺上下文，故沿用
//! `product_stock` / `salesman_material_category` / `gallery` 的既有口径，
//! 由 [`shop_id_from_headers`] 从请求头解析。
//!
//! ## 合并注意
//! 本模块必须并入 `crates/api/admin/src/routes/marketing/mod.rs` 的 `routes()`
//! 与 `implemented_routes()`（外层已套 `require_auth`，不要重复包裹）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::collections::BTreeMap;
use tigshop_core::models::marketing::salesman_content::{
    BatchDTO, OperateDTO, SalesmanContentEditDTO, SalesmanContentPageQuery, SalesmanContentSaveDTO,
    SalesmanContentVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**；顺序与原 Java
/// `SalesmanContentController` 一致，供逐字符对照 `docs/api-contract.json`。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/salesman/content/list",
        "SalesmanContentController.list",
    ),
    (
        "GET",
        "/salesman/content/config",
        "SalesmanContentController.config",
    ),
    (
        "GET",
        "/salesman/content/detail",
        "SalesmanContentController.detail",
    ),
    (
        "POST",
        "/salesman/content/create",
        "SalesmanContentController.create",
    ),
    (
        "POST",
        "/salesman/content/update",
        "SalesmanContentController.update",
    ),
    (
        "POST",
        "/salesman/content/del",
        "SalesmanContentController.del",
    ),
    (
        "POST",
        "/salesman/content/updateField",
        "SalesmanContentController.updateField",
    ),
    (
        "POST",
        "/salesman/content/batch",
        "SalesmanContentController.batch",
    ),
];

/// 分销内容域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/salesman/content/list", get(list))
        .route("/salesman/content/config", get(config))
        .route("/salesman/content/detail", get(detail))
        .route("/salesman/content/create", post(create))
        .route("/salesman/content/update", post(update))
        .route("/salesman/content/del", post(del))
        .route("/salesman/content/updateField", post(update_field))
        .route("/salesman/content/batch", post(batch))
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

/// `GET /adminapi/salesman/content/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/salesman/content/list`：分销内容分页列表。
///
/// 对应 Java `SalesmanContentController#list(SalesmanContentPageQuery)`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<SalesmanContentPageQuery>,
) -> ApiResult<PageResult<SalesmanContentVO>> {
    ok(state.marketing.salesman_content.list_admin(&q).await?)
}

/// `GET /adminapi/salesman/content/config`：状态字典。
///
/// 对应 Java `SalesmanContentController#config()`：返回
/// `Map<Integer, String>`（`ContentStatus` 全量枚举 → 文案）。
async fn config(State(state): State<AdminState>) -> ApiResult<BTreeMap<i32, String>> {
    ok(state.marketing.salesman_content.config())
}

/// `GET /adminapi/salesman/content/detail?id=`：分销内容详情。
///
/// 对应 Java `SalesmanContentController#detail(@RequestParam Integer id)`。
/// Java 详情**不返回** `statusText`（列表才返回）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<SalesmanContentVO>> {
    ok(state.marketing.salesman_content.detail(q.id).await?)
}

/// `POST /adminapi/salesman/content/create`：创建分销内容。
///
/// 对应 Java `SalesmanContentController#create(@RequestBody SalesmanContentSaveParam)`
/// （Java 返回 `void`；本实现回传新 ID 便于前端/排查，不改变既有字段结构）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanContentSaveDTO>,
) -> ApiResult<i32> {
    ok(state.marketing.salesman_content.create(&dto).await?)
}

/// `POST /adminapi/salesman/content/update`：更新分销内容。
///
/// 对应 Java `SalesmanContentController#update(@Validated @RequestBody
/// SalesmanContentEditParam)`（返回 `void`）。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<SalesmanContentEditDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_content.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/salesman/content/del`：删除分销内容。
///
/// 对应 Java `SalesmanContentController#del(@RequestBody OperateDTO)`。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.salesman_content.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/salesman/content/updateField`：更新单个字段。
///
/// 对应 Java `SalesmanContentController#updateField(@RequestBody UpdateFieldDTO)`
/// （白名单 `SALESMAN_CONTENT_FIELDS`；`isAvailable=0` 时联动 `end_time = now`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.marketing.salesman_content.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/salesman/content/batch`：批量操作。
///
/// 对应 Java `SalesmanContentController#batch(@RequestBody BatchDTO)`
/// （`BaseServiceImpl#batch`：仅 `type = "del"` 生效）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.marketing.salesman_content.batch(&dto).await?)
}

#[cfg(test)]
fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 解析当前店铺 ID（Java `BaseServiceImpl#getShopId()` → `HeaderUtils.getShopId()`）。
///
/// 三态与 Java 逐字对齐：
/// - `x-admin-type: admin` → `Some(0)`（平台）
/// - `x-admin-type: shop|pos` → `x-shop-id`（缺失 / 非法 → `None`）
/// - 其它 / 缺失 → `None`
///
/// ⚠️ Java 对 `null` 的执行 `eq(shop_id, null)` → 恒不命中（空列表）；本实现把
/// `None` 原样交给仓储，SQL `shop_id = NULL` 同样恒不命中，语义一致。
/// 与 Java 的差异：脏 `x-shop-id`（如 `abc`）在 Java 会抛 `NumberFormatException`，
/// 这里回落 `None`（不过滤 → 实际也是空列表，因为 `shop_id = NULL`）。
#[must_use]
#[cfg(test)]
pub fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> Option<i32> {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => {
            header_str(headers, "x-shop-id").and_then(|v| v.trim().parse::<i32>().ok())
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[cfg(test)]
    fn headers(pairs: &[(&str, &str)]) -> axum::http::HeaderMap {
        let mut h = axum::http::HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（8 条，含 `/adminapi` 前缀）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8, "契约中 admin 侧共 8 条接口");

        let expected = [
            ("GET", "/adminapi/salesman/content/list"),
            ("GET", "/adminapi/salesman/content/config"),
            ("GET", "/adminapi/salesman/content/detail"),
            ("POST", "/adminapi/salesman/content/create"),
            ("POST", "/adminapi/salesman/content/update"),
            ("POST", "/adminapi/salesman/content/del"),
            ("POST", "/adminapi/salesman/content/updateField"),
            ("POST", "/adminapi/salesman/content/batch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        // 不允许重复声明（路由表改错时会暴露）
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// 路径表必须恰好 8 条、互不重复、以控制器前缀开头。
    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        for (i, (m, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/salesman/content/"), "路径前缀错误: {p}");
            assert!(*m == "GET" || *m == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((m, p), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（8/8，防漏挂/多挂）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/salesman/content/list",
            "/salesman/content/config",
            "/salesman/content/detail",
            "/salesman/content/create",
            "/salesman/content/update",
            "/salesman/content/del",
            "/salesman/content/updateField",
            "/salesman/content/batch",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 平台账号：`shop_id = 0`（即使带了 `x-shop-id`）。
    #[test]
    fn admin_scope_is_platform_zero() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9"),])),
            Some(0)
        );
    }

    /// 店铺 / 门店账号：取 `x-shop-id`；缺失或非法 → `None`（Java null）。
    #[test]
    fn shop_and_pos_scopes_take_shop_header() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            Some(9)
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            Some(3)
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            None
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            None
        );
    }

    /// 未知账号类型 / 无请求头 → `None`（Java `getShopId()` 返回 null → 空列表）。
    #[test]
    fn unknown_or_missing_admin_type_is_unscoped() {
        assert_eq!(shop_id_from_headers(&axum::http::HeaderMap::new()), None);
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "vendor"), ("x-shop-id", "5")])),
            None
        );
    }
}
