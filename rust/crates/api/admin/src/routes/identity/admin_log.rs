//! 管理员日志 —— 管理端路由（identity::admin_log）。
//!
//! 原 Java：`AdminLogController`
//! （`java/tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/authority/AdminLogController.java`，
//! `@RequestMapping("/adminapi/authority/adminLog")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET /authority/adminLog/list` | `GET /adminapi/authority/adminLog/list` | `AdminLogController.page` | jwt+perm |
//!
//! > **路径说明**：`@RequestMapping("/adminapi/authority/adminLog")` +
//! > `@GetMapping("/list")` 拼出 `/adminapi/authority/adminLog/list`
//! > （`adminLog` 大小写原样照抄，不是笔误）；本文件挂在 `/adminapi` 之下，
//! > 故 `routes()` 内只写 `/authority/adminLog/list`。
//!
//! > **权限（契约 `jwt+perm`）当前只落到 `jwt`**：Java 的
//! > `@PreAuthorize("@pms.hasPermission('adminLogManage','EmployeeLogManagement')")`
//! > 所依赖的权限矩阵在本仓库尚未实现（与 product_manage/002/005/012/014/018/027
//! > 同一已知缺口）——任何已登录管理员都能调用本接口。
//! > 数据范围仍受下面已迁移的作用域过滤约束，但**平台账号可看全量**。
//!
//! > **作用域过滤（本域核心语义）**：Java `applyScopeFilter` 依据
//! > `x-admin-type`（+ `x-shop-id` / `x-vendor-id`）决定可见日志范围，
//! > 且**拿不到合法作用域 ID 时返回空页**（不是返回全量）：
//! > `admin` → 全量；`shop`/`store`/`pickup`/`pos` →
//! > `scope_type='shop' AND scope_id=x-shop-id`；`vendor` →
//! > `scope_type='vendor' AND scope_id=x-vendor-id`；其它/缺失/ID 非正/
//! > ID 非数字 → 空页。
//! >
//! > ⚠️ 与 Java 一样，作用域 ID 直接来自**客户端请求头**，因此这只是
//! > 「视图隔离」而**不是**安全边界（Java 原文即如此，未做加固）。
//!
//! > **`x-admin-type` 说明**：Java `HeaderUtils.getAdminType()` **只读请求头**
//! > （并把 `shop` + `x-shop-type: 2|3` 细化为 `store`/`pickup`）；Rust 侧
//! > 请求头缺失时回退 JWT 的 `admin_type`（brand/008/010/011/020/023/027
//! > 的统一约定）。本域只看「属于 admin / 店铺族 / vendor / 其它」，
//! > `store`/`pickup` 的细化结果同样落在店铺族分支里，不影响结论。
//!
//! > **响应结构说明**：Java 返回 MyBatis-Plus `Page<AdminLogDTO>`
//! > （`records/total/size/current/pages`），Rust 统一用
//! > [`PageResult`]（`list/total/totalPage/pageSize/page`）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::get,
    Extension, Router,
};
use tigshop_core::models::identity::admin_log::{AdminLogDTO, AdminLogPageQuery, Scope};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域 1 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 1] =
    [("GET", "/authority/adminLog/list", "AdminLogController.page")];

/// 管理员日志路由（挂载于 `/adminapi` 下）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py` 静态扫描 `.route("...")` 字面量，
/// 循环拼接会让覆盖率统计看不见这条路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/authority/adminLog/list", get(admin_log_list))
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

/// 读取请求头文本值（缺失 / 非 UTF-8 / 纯空白 → `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 解析作用域 ID 请求头（对应 Java `Integer.parseInt(header)`：
/// 缺失 → `null`；非数字 → `NumberFormatException`）。
/// Java 的这两种情况在 `applyScopeFilter` 里都落到「空页」，故统一成 `None`。
fn parse_scope_id(raw: Option<String>) -> Option<i32> {
    raw?.trim().parse::<i32>().ok()
}

/// 由请求头 + JWT 身份推导日志作用域（对应 Java `applyScopeFilter`）。
///
/// 账号类型取 `x-admin-type`，缺失时回退 JWT `admin_type`；
/// 店铺 ID 取 `x-shop-id`，供应商 ID 取 `x-vendor-id`。
#[must_use]
pub fn resolve_scope(headers: &HeaderMap, auth: &AuthUser) -> Scope {
    let admin_type = header_str(headers, "x-admin-type").or_else(|| auth.admin_type.clone());
    let shop_id = parse_scope_id(header_str(headers, "x-shop-id"));
    let vendor_id = parse_scope_id(header_str(headers, "x-vendor-id"));
    Scope::resolve(admin_type.as_deref(), shop_id, vendor_id)
}

/// `GET /adminapi/authority/adminLog/list`：管理员日志分页列表。
///
/// 对应 Java `AdminLogController.page(AdminLogPageQuery query)`（`:51`）：
/// `adminLogService.adminLogPage(query)`。
async fn admin_log_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<AdminLogPageQuery>,
) -> ApiResult<PageResult<AdminLogDTO>> {
    let scope = resolve_scope(&headers, &auth);
    ok(state.identity.admin_log.list(&q, scope).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderName, HeaderValue};

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    fn auth_with_type(t: Option<&str>) -> AuthUser {
        AuthUser {
            id: 1,
            username: "tester".into(),
            role_id: None,
            admin_type: t.map(ToString::to_string),
            shop_id: None,
        }
    }

    #[test]
    fn registered_path_matches_java_controller_literally() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[0].1, "/authority/adminLog/list");
        assert_eq!(ROUTE_TABLE[0].2, "AdminLogController.page");

        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        // 覆盖率统计要的是完整契约路径（带 /adminapi）
        assert_eq!(docs[0].path, "/adminapi/authority/adminLog/list");
        assert!(!ROUTE_TABLE[0].1.contains("/adminapi"));
    }

    #[test]
    fn admin_header_sees_all() {
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "admin")]),
                &auth_with_type(None)
            ),
            Scope::All
        );
    }

    #[test]
    fn shop_family_filters_by_shop_id() {
        for t in ["shop", "store", "pickup", "pos"] {
            assert_eq!(
                resolve_scope(
                    &headers(&[("x-admin-type", t), ("x-shop-id", "7")]),
                    &auth_with_type(None)
                ),
                Scope::Shop { shop_id: 7 },
                "{t}"
            );
        }
    }

    #[test]
    fn missing_or_invalid_scope_id_yields_empty_page() {
        // 有类型没 ID
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "shop")]), &auth_with_type(None)),
            Scope::Nothing
        );
        // ID 非数字（Java NumberFormatException 分支）
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")]),
                &auth_with_type(None)
            ),
            Scope::Nothing
        );
        // ID 为 0 / 负数
        for v in ["0", "-4"] {
            assert_eq!(
                resolve_scope(
                    &headers(&[("x-admin-type", "pos"), ("x-shop-id", v)]),
                    &auth_with_type(None)
                ),
                Scope::Nothing,
                "{v}"
            );
        }
        // vendor 缺 vendor_id
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "vendor")]),
                &auth_with_type(None)
            ),
            Scope::Nothing
        );
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "vendor"), ("x-vendor-id", "5")]),
                &auth_with_type(None)
            ),
            Scope::Vendor { vendor_id: 5 }
        );
    }

    #[test]
    fn unknown_type_or_no_type_yields_empty_page() {
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "legacy")]),
                &auth_with_type(Some("admin"))
            ),
            // 请求头优先，legacy 不属于任何可见分支 → 空页
            Scope::Nothing
        );
        assert_eq!(
            resolve_scope(&headers(&[]), &auth_with_type(None)),
            Scope::Nothing
        );
        // 大小写敏感（Java equals）
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "Admin")]),
                &auth_with_type(None)
            ),
            Scope::Nothing
        );
    }

    #[test]
    fn jwt_admin_type_used_when_header_absent() {
        // 项目约定：x-admin-type 缺失时回退 JWT
        assert_eq!(
            resolve_scope(&headers(&[]), &auth_with_type(Some("admin"))),
            Scope::All
        );
        assert_eq!(
            resolve_scope(
                &headers(&[("x-shop-id", "3")]),
                &auth_with_type(Some("shop"))
            ),
            Scope::Shop { shop_id: 3 }
        );
    }

    #[test]
    fn blank_header_values_count_as_absent() {
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "   ")]),
                &auth_with_type(None)
            ),
            Scope::Nothing
        );
    }

    #[test]
    fn query_binds_camel_case_and_defaults() {
        let q: AdminLogPageQuery =
            serde_json::from_value(serde_json::json!({"keyword": "登录", "page": 2, "size": 25}))
                .unwrap();
        assert_eq!(q.keyword.as_deref(), Some("登录"));
        assert_eq!(q.limit_offset(), (25, 25));
        // 空查询也能反序列化（`#[serde(default)]`）
        let q: AdminLogPageQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_params(), (1, 15));
    }
}
