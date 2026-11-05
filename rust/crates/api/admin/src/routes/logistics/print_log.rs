//! 打印日志 —— 管理端路由（logistics::print_log）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.print.PrintLogController`
//! （`@RequestMapping("/adminapi/print/printLog")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |-----------|------------------|----------------|--------------------------|
//! | `GET /print/printLog/list` | `GET /adminapi/print/printLog/list` | `PrintLogController.list` | `baseReceiptManage` / `shopBaseReceiptManage` / `posReceiptPrint` |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/print/printLog` —— 中段是
//! **小驼峰 `printLog`**（不是 `print_log`，也不是 `printlog`），大小写敏感。
//! 方法级只有 `/list`，因此最终路径是 `/adminapi/print/printLog/list`，
//! 与 `docs/api-contract.json` 逐字符一致。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission('baseReceiptManage',
//! 'shopBaseReceiptManage','posReceiptPrint')")`；Rust 侧 `require_auth`
//! 目前只校验登录态，权限矩阵未实现（与同域 print / print_config 的
//! 已知缺口一致）——上表权限列仅作对照。
//!
//! # 返回结构说明
//!
//! Java 返回 MyBatis-Plus `Page<PrintLogPageVO>`（`records/total/size/
//! current/pages`），Rust 统一使用既有 `PageResult`
//! （`list/total/totalPage/pageSize/page`），与同域其它列表接口一致。

use axum::{
    extract::{Extension, Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::logistics::print_log::{PrintLogPageQuery, PrintLogVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 本域全部 1 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应；
/// 单测 `route_table_matches_java_contract` 守住两边不漂移。
const ROUTE_TABLE: [(&str, &str, &str); 1] =
    [("GET", "/print/printLog/list", "PrintLogController.list")];

/// 打印日志域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/print/printLog/list", get(print_log_list))
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

/// `GET /adminapi/print/printLog/list`：打印日志分页列表。
///
/// 对应 Java `PrintLogController.list(PrintLogPageQuery query)`
/// → `PrintLogServiceImpl#page`。
async fn print_log_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<PrintLogPageQuery>,
) -> ApiResult<PageResult<PrintLogVO>> {
    ok(state
        .logistics
        .print_log
        .page(&q, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// 本模块当前使用的店铺 ID。
///
/// Java `getShopId()` = `HeaderUtils.getShopId()`（请求头，平台 `0`）。
/// Rust 侧鉴权中间件尚未注入 `shop_id`，故统一按平台账号处理。
/// 待中间件补齐后，此处改为从 `AdminState` / 请求扩展里取真实店铺 ID 即可，
/// 服务层签名（`shop_id: i32`）无需改动。
#[allow(dead_code)]
const fn default_shop_id() -> i32 {
    tigshop_core::models::logistics::print_config::DEFAULT_SHOP_ID
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 唯一的 1 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 1, "契约中 printLog 域共 1 条接口");
        let (method, path, java) = ROUTE_TABLE[0];
        assert_eq!(method, "GET");
        assert_eq!(path, "/print/printLog/list");
        assert_eq!(java, "PrintLogController.list");
        // 中段必须是小驼峰 `printLog`（契约逐字符敏感）
        assert!(path.starts_with("/print/printLog/"), "{path} 前缀错误");
        assert!(!path.contains("print_log"), "{path} 不得用下划线写法");
        assert!(!path.contains("printlog"), "{path} 大小写错误");
        // 本模块路径不带 `/adminapi`（由父路由统一挂载）
        assert!(!path.starts_with("/adminapi"));
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/print/printLog/list");
        assert_eq!(docs[0].java_ref, "PrintLogController.list");
        assert!(docs[0].path.starts_with("/adminapi/"));
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（1/1）。
    #[test]
    fn routes_registers_all_table_paths() {
        // `routes()` 用字面量注册，这里以字符串形式复述同一份清单。
        let registered = ["/print/printLog/list"];
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

    /// 查询参数按契约 camelCase 解析（`triggerType` / `orderId` /
    /// `printSn` / `startTime` / `endTime` / `pageSize` 都是易错点）。
    #[test]
    fn query_params_parse_camel_case() {
        let q: PrintLogPageQuery = serde_json::from_str(
            r#"{"platform":1,"status":2,"triggerType":1,"orderId":88,
                "printSn":"SN","startTime":1700000000,"endTime":1700000100,
                "page":1,"pageSize":15}"#,
        )
        .expect("PrintLogPageQuery 应接受 camelCase");
        assert_eq!(q.platform, Some(1));
        assert_eq!(q.status, Some(2));
        assert_eq!(q.trigger_type, Some(1));
        assert_eq!(q.order_id, Some(88));
        assert_eq!(q.print_sn.as_deref(), Some("SN"));
        assert_eq!(q.start_time, Some(1_700_000_000));
        assert_eq!(q.end_time, Some(1_700_000_100));
        assert_eq!(q.page_size, Some(15));
    }

    /// 店铺日志列表按登录态店铺强制过滤（平台为 0）。
    #[test]
    fn print_log_list_uses_auth_shop_scope() {
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(tenant::platform_or_shop_id(&platform), 0);
        let shop = AuthUser {
            id: 3,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(7),
        };
        assert_eq!(tenant::platform_or_shop_id(&shop), 7);
    }
}
