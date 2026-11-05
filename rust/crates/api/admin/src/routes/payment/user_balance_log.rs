//! 用户余额日志 —— 管理端路由（payment::user_balance_log）。
//!
//! 原 Java：`UserBalanceLogController`
//! （`java/tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/finance/UserBalanceLogController.java`，
//! `@RequestMapping("/adminapi/finance/userBalanceLog")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET /finance/userBalanceLog/list` | `GET /adminapi/finance/userBalanceLog/list` | `UserBalanceLogController.list` | jwt |
//!
//! > **路径说明**：`@RequestMapping("/adminapi/finance/userBalanceLog")` +
//! > `@GetMapping("/list")` 拼出 `/adminapi/finance/userBalanceLog/list`
//! > —— 控制器前缀里 `finance` 与 `userBalanceLog` 各出现一次，
//! > `userBalanceLog` 的大小写原样照抄，不是笔误；本文件挂在 `/adminapi`
//! > 之下，故 `routes()` 内只写 `/finance/userBalanceLog/list`。
//!
//! > **权限**：契约 `auth=jwt`，Java 该控制器**没有** `@PreAuthorize`，
//! > 与 Rust 侧 `require_auth`（`api/admin/src/lib.rs::router` 统一套在
//! > `/adminapi` 子树外层）语义一致，无需额外处理。
//!
//! > **响应结构说明**：Java 返回 MyBatis-Plus `Page<UserBalanceLogVO>`
//! > （`records/total/size/current/pages`），Rust 统一用 [`PageResult`]
//! > （`list/total/totalPage/pageSize/page`），与其余已迁移切片一致。
//!
//! > **查询参数是 GET 查询串绑定**（Java `UserBalanceLogListDTO listDTO`
//! > 没有 `@RequestBody`），因此 `page` / `size` / `sortField` / `sortOrder` /
//! > `keyword` / `userId` / `balance` / `username` / `excludeDistribution` /
//! > `walletType` 全部来自 query，字段名逐字符照 Java 属性名（camelCase）。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::payment::user_balance_log::{UserBalanceLogListQuery, UserBalanceLogVO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域 1 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/finance/userBalanceLog/list",
    "UserBalanceLogController.list",
)];

/// 用户余额日志路由（挂载于 `/adminapi` 下）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py` 静态扫描 `.route("...")` 字面量，
/// 循环拼接会让覆盖率统计看不见这条路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/userBalanceLog/list", get(user_balance_log_list))
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

/// `GET /adminapi/finance/userBalanceLog/list`：用户余额日志分页列表。
///
/// 对应 Java `UserBalanceLogController.list(UserBalanceLogListDTO listDTO)`
/// （`UserBalanceLogController.java:38`）：`userBalanceLogService.list(listDTO)`，
/// 无额外加工（`changeTime` 格式化与 `changeTypeName` 派生都在服务层）。
async fn user_balance_log_list(
    State(state): State<AdminState>,
    Query(q): Query<UserBalanceLogListQuery>,
) -> ApiResult<PageResult<UserBalanceLogVO>> {
    ok(state.payment.user_balance_log.list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registered_path_matches_java_controller_literally() {
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[0].1, "/finance/userBalanceLog/list");
        assert_eq!(ROUTE_TABLE[0].2, "UserBalanceLogController.list");

        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        // 覆盖率统计要的是完整契约路径（带 /adminapi）
        assert_eq!(docs[0].path, "/adminapi/finance/userBalanceLog/list");
        // 本模块路径不能带 /adminapi（否则会挂成 /adminapi/adminapi/...）
        assert!(!ROUTE_TABLE[0].1.contains("/adminapi"));
    }

    #[test]
    fn query_dto_is_deserialize_owned_with_defaults() {
        // `Query<T>` 需要 `T: DeserializeOwned`，且缺参不报错（Java 全部可选）
        let q: UserBalanceLogListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_params(), (1, 15));
        assert_eq!(q.keyword, None);
        assert_eq!(q.wallet_type, None);

        let q: UserBalanceLogListQuery = serde_json::from_value(serde_json::json!({
            "userId": 8,
            "balance": 1,
            "username": "bob",
            "excludeDistribution": 1,
            "walletType": 1,
            "sortField": "changeTime",
            "sortOrder": "asc"
        }))
        .unwrap();
        assert_eq!(q.user_id, Some(8));
        assert!(q.balance_positive_filter());
        assert!(q.exclude_distribution_on());
        assert_eq!(q.wallet_type, Some(1));
    }
}
