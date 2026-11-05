//! 会员积分日志 —— 管理端路由（member::user_points_log）。
//!
//! 原 Java：`UserPointsLogController`（`tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/user/UserPointsLogController.java`）
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET /user/userPointsLog/getPoints` | `GET /adminapi/user/userPointsLog/getPoints` | `UserPointsLogController.getPoints` | jwt+perm |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//!
//! ## 契约说明
//!
//! - 无查询入参、无请求体：身份取 Java `SecurityUtils.getCurrentAdminId()`，
//!   Rust 侧即 `Extension<AuthUser>`（由 `lib.rs::router` 在 `/adminapi` 子树
//!   外层统一套的 `require_auth` 中间件写入）。
//! - 响应 `data` 是**裸整数**（Java 返回 `Integer`），不是对象：
//!   `{"code":0,"msg":"success","data":120,"timestamp":1700000000000}`。
//!
//! ## 权限说明（与 Java 的差异）
//!
//! Java 控制器带**类级** `@PreAuthorize("@pms.hasPermission('integralLogManage')")`；
//! Rust 侧权限矩阵尚未实现（`require_auth` 只校验登录态），与
//! product_manage/002/005/012/027 等片的既有缺口一致：**任何已登录管理员**都能调本接口。
//! 好在本接口只返回调用者自己（同 ID 会员行）的积分，不构成越权读取他人数据。
//!
//! ## 同域另一接口
//!
//! `GET /adminapi/user/userPointsLog/list`（会员积分流水分页）**不在本片范围**，
//! 已由 member::user_manage（会员管理域）实现，本模块**不得**重复注册，
//! 否则 `Router::merge` 会在启动时 panic。
//! 自查：`cd rust && python tools/check_route_conflicts.py --strict`。

use axum::{extract::State, routing::get, Extension, Router};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源，顺序与原 Java 控制器一致。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/user/userPointsLog/getPoints",
    "UserPointsLogController.getPoints",
)];

/// 会员积分日志 域路由（挂载于 `/adminapi` 下）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不能从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py::collect_rust_routes` 静态扫描
/// `\.route\(\s*"(?P<path>...)"`，循环拼接会让覆盖率统计看不见这条路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/user/userPointsLog/getPoints", get(get_points))
}

/// 已实现路由清单（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `GET /adminapi/user/userPointsLog/getPoints`：获取「当前后台账号所绑定会员」的积分。
///
/// 对应 Java `UserPointsLogController.getPoints()`（`:39`）→
/// `UserPointsLogServiceImpl#getPoints`（`:59-66`）：
/// `SELECT points FROM user WHERE user_id = <当前管理员ID>`，取单行取 `points`。
///
/// 该接口返回的是**当前登录管理员自身绑定的会员积分**（`AuthUser.id`），
/// 不接收任何 user/shop 参数，因此不存在跨店读取面；店铺账号调用时同样只读取
/// 自己绑定的会员，无需再叠加店铺过滤（本域无 `shop_id` 列，按平台只读处理）。
///
/// 查不到行时返回业务错误（Java 在该处 NPE，见
/// `crates/services/src/user_points_log.rs` 模块头差异 2）。
async fn get_points(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<i32> {
    ok(state.member.user_points_log.get_points(auth.id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::error::ApiResponse;

    #[test]
    fn registered_path_matches_java_controller_literally() {
        // Java：`@RequestMapping("/adminapi/user/userPointsLog")`
        //       + `@GetMapping("/getPoints")`
        assert_eq!(ROUTE_TABLE.len(), 1);
        assert_eq!(ROUTE_TABLE[0].0, "GET");
        assert_eq!(ROUTE_TABLE[0].1, "/user/userPointsLog/getPoints");
        assert_eq!(ROUTE_TABLE[0].2, "UserPointsLogController.getPoints");

        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].path, "/adminapi/user/userPointsLog/getPoints");
        assert_eq!(docs[0].method, "GET");
    }

    #[test]
    fn local_path_has_no_adminapi_prefix() {
        // 挂载点已经是 `/adminapi`，本地路径再带前缀会变成双重前缀
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| !p.contains("/adminapi")));
        assert!(ROUTE_TABLE.iter().all(|(_, p, _)| p.starts_with('/')));
    }

    #[test]
    fn handler_returns_bare_integer_data() {
        // Java 返回 `Integer`，`data` 必须是数字而不是对象
        let v = serde_json::to_value(ApiResponse::success(120_i32)).unwrap();
        assert_eq!(v["data"], 120);
        assert!(v["data"].is_number());
    }
}
