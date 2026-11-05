//! 访问统计域（analytics::statistics）—— 管理端路由。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.panel.StatisticsAccessController`
//!   （`@RequestMapping("/adminapi/panel/statisticsAccess")`）
//!   → [`access_statistics`]
//! - `com.tigshop.adminapi.controller.panel.StatisticsUserController`
//!   （`@RequestMapping("/adminapi/panel/statisticsUser")`）
//!   → [`add_user_trends`] / [`user_consumption_ranking`] / [`user_statistics_panel`]
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |----------------------------------|------------------|--------------|-----------|
//! | `GET /panel/statisticsAccess/accessStatistics`    | `GET /adminapi/panel/statisticsAccess/accessStatistics`    | `StatisticsAccessController.accessStatistics`    | `jwt+perm` |
//! | `GET /panel/statisticsUser/addUserTrends`         | `GET /adminapi/panel/statisticsUser/addUserTrends`         | `StatisticsUserController.addUserTrends`         | `jwt` |
//! | `GET /panel/statisticsUser/userConsumptionRanking`| `GET /adminapi/panel/statisticsUser/userConsumptionRanking`| `StatisticsUserController.userConsumptionRanking`| `jwt` |
//! | `GET /panel/statisticsUser/userStatisticsPanel`   | `GET /adminapi/panel/statisticsUser/userStatisticsPanel`   | `StatisticsUserController.userStatisticsPanel`   | `jwt` |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式（由 `/adminapi` 父路由统一挂载），
//! [`implemented_routes`] 里写完整契约路径。路径逐字符照抄契约。
//!
//! # 权限说明（已知缺口）
//!
//! Java 的 `StatisticsAccessController.accessStatistics` 带类级/方法级
//! `@PreAuthorize("@pms.hasPermission(...)")`（即契约里的 `jwt+perm`）；
//! `StatisticsUserController` 的四条是 `jwt`（无显式权限矩阵）。
//! Rust 侧 `/adminapi` 子树目前只有登录态校验（`require_auth`），
//! **权限矩阵（perm / hasPermission）未实现**（与 order_admin / member_tag /
//! member_tag_group / feedback / area_code 等已知缺口一致）。本模块对四条接口一律只取
//! `Extension<AuthUser>` 确认已登录，**不编造任何 `@PreAuthorize` 权限字符串**。
//! 上表 `jwt+perm` 仅作对照记录，当前**任何已登录管理员**都能调用全部四条。
//!
//! # 多租户 / 店铺作用域（本域已知缺口）
//!
//! Java 控制器用 `HeaderUtils.getShopId()` 把入参里的 `shopId` **覆盖**为请求头
//! 的店铺 id（`statistics` 全部四条 DTO 都带 `shopId` 字段，但真正生效的是头里的
//! 值）；`accessStatistics` 还会无条件 `eq(shop_id, shopId)`（平台管理员拿到
//! `shopId = 0` ⇒ 只命中 `shop_id = 0` 的行，与写入链路的 `NULL` 口径冲突，见
//! `services/src/statistics.rs` 模块头「怪行为 #2」）。
//!
//! Rust 侧本模块**未**实现店铺头覆盖（既未读 `x-shop-id`、也未从 `AuthUser`
//! 取店铺；`AuthUser` 当前也没有 `shop_id` 字段）。因此传给 service 的 `shop_id`
//! 直接来自前端查询参数（`Option`，缺失即 `None`，service 内部对此退化为「空轴」
//! 或「不过滤店铺」两种口径）。这与 Java 行为不完全一致，列于 `uncertain_points`。
//!
//! # 返回结构说明
//!
//! - `accessStatistics` / `addUserTrends` 返回 [`AxisVO`]
//!   （`horizontalAxis` / `longitudinalAxis` 两数组，Java 永远非 null，初始空列表）；
//! - `userConsumptionRanking` 返回 `PageResult<UserConsumptionRankingVO>`
//!   （与项目其他分页一致：`list`/`total`/`totalPage`/`pageSize`/`page`）；
//! - `userStatisticsPanel` 返回 [`UserStatisticsPanelVO`]
//!   （访问量/浏览量/新增/成交/充值/转化率及各自环比，金额与比率一律 `Decimal`）。
//!
//! 所有 Java 的「怪」行为（成交/充值用户增长率实参顺序相反、按日横轴错位、两套
//! 店铺口径、无 Excel 导出等）已在 `services/src/statistics.rs` 逐字复刻，本文件不重复。

use axum::{
    extract::{Query, State},
    routing::get,
    Extension, Router,
};
use tigshop_core::models::analytics::statistics::{
    AccessStatisticsQuery, AxisVO, UserConsumptionRankingDTO, UserConsumptionRankingVO,
    UserStatisticsPanelDTO, UserStatisticsPanelVO, UserTrendsQuery,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 本域全部 4 条路由（`(HTTP method, 去掉 /adminapi 前缀的路径, 原 Java handler)`）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "GET",
        "/panel/statisticsAccess/accessStatistics",
        "StatisticsAccessController.accessStatistics",
    ),
    (
        "GET",
        "/panel/statisticsUser/addUserTrends",
        "StatisticsUserController.addUserTrends",
    ),
    (
        "GET",
        "/panel/statisticsUser/userConsumptionRanking",
        "StatisticsUserController.userConsumptionRanking",
    ),
    (
        "GET",
        "/panel/statisticsUser/userStatisticsPanel",
        "StatisticsUserController.userStatisticsPanel",
    ),
];

/// 访问统计域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不能从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py::collect_rust_routes` 静态扫描
/// `\.route\(\s*"(?P<path>...)"`，循环拼接会让覆盖率统计看不见这些路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/panel/statisticsAccess/accessStatistics",
            get(access_statistics),
        )
        .route("/panel/statisticsUser/addUserTrends", get(add_user_trends))
        .route(
            "/panel/statisticsUser/userConsumptionRanking",
            get(user_consumption_ranking),
        )
        .route(
            "/panel/statisticsUser/userStatisticsPanel",
            get(user_statistics_panel),
        )
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
// Handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/panel/statisticsAccess/accessStatistics`：访问统计趋势。
///
/// 对应 Java `StatisticsAccessController.accessStatistics`
/// （`@RequestMapping("/adminapi/panel/statisticsAccess")`）
/// → `StatisticsAccessServiceImpl#getAccessStatistics`。
///
/// 入参（`AccessStatisticsQuery`，camelCase）：`startTime` / `endTime`
/// （二选一为空 ⇒ 业务错误「请选择日期」）、`isHits`（`> 0` ⇒ 取浏览量否则访客数）、
/// `shopId`（见文件头「多租户」缺口，当前透传前端值）。
async fn access_statistics(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<AccessStatisticsQuery>,
) -> ApiResult<AxisVO> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.statistics.access_statistics(&q).await?)
}

/// `GET /adminapi/panel/statisticsUser/addUserTrends`：新增会员趋势。
///
/// 对应 Java `StatisticsUserController.addUserTrends`
/// → `StatisticsUserServiceImpl#getAddUserTrends`。
///
/// 入参（`UserTrendsQuery`，camelCase）：`startEndTime`（单个日期串，必填）、
/// `dateType`（`1`=年 / `2`=月 / `3`=日，必填）、`isExport` / `shopId`
/// （前者 Rust 侧忽略，后者 Java 实际未使用）。
async fn add_user_trends(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<UserTrendsQuery>,
) -> ApiResult<AxisVO> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.statistics.add_user_trends(&q).await?)
}

/// `GET /adminapi/panel/statisticsUser/userConsumptionRanking`：会员消费排行。
///
/// 对应 Java `StatisticsUserController.userConsumptionRanking`
/// → `StatisticsUserServiceImpl#getUserConsumptionRanking`。
///
/// 入参（`UserConsumptionRankingDTO`，camelCase，分页字段平铺）：
/// `startTime` / `endTime` / `shopId` / `keyword` / `page` / `size` /
/// `sortField` / `sortOrder` / `isExport`（导出 Rust 侧忽略）。
/// `sortField` 仅 `orderNum` / `orderAmount` 进白名单，其余忽略排序。
async fn user_consumption_ranking(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<UserConsumptionRankingDTO>,
) -> std::result::Result<axum::response::Response, AppError> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    if q.is_export.unwrap_or(0) == 1 {
        q.page = Some(1);
        q.size = Some(10_000);
        let page = state
            .analytics
            .statistics
            .user_consumption_ranking(&q)
            .await?;
        let rows: Vec<Vec<String>> = page
            .list
            .iter()
            .map(|r| {
                vec![
                    r.username.clone().unwrap_or_default(),
                    r.mobile.clone().unwrap_or_default(),
                    r.order_num.to_string(),
                    r.order_amount.to_string(),
                ]
            })
            .collect();
        let bytes = tigshop_services::system::excel::build_xlsx(
            &["会员名称", "手机号", "订单数", "消费总额"],
            &rows,
            "会员消费排行",
        )?;
        return Ok(crate::support::excel_response::xlsx_response(
            bytes,
            "user_consumption_ranking.xlsx",
        ));
    }
    let page = state
        .analytics
        .statistics
        .user_consumption_ranking(&q)
        .await?;
    Ok(axum::response::IntoResponse::into_response(ok(page)?))
}

/// `GET /adminapi/panel/statisticsUser/userStatisticsPanel`：用户统计面板。
///
/// 对应 Java `StatisticsUserController.userStatisticsPanel`
/// → `StatisticsUserServiceImpl#getUserStatisticsPanel`。
///
/// 入参（`UserStatisticsPanelDTO`，camelCase）：`startTime` / `endTime`（必填）、
/// `isExport`（忽略）、`shopId`（仅成交用户数按 `shopId > 0` 过滤）。
/// 含五项的环比增长率，其中成交/充值用户项 Java 实参顺序相反（净效果正负号相反），
/// service 已逐字复刻。
async fn user_statistics_panel(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<UserStatisticsPanelDTO>,
) -> ApiResult<UserStatisticsPanelVO> {
    q.shop_id = auth.resolve_shop_scope(q.shop_id)?;
    ok(state.analytics.statistics.user_statistics_panel(&q).await?)
}

#[cfg(test)]
mod tests {
    #[test]
    fn shop_scope_rejects_cross_shop_and_forces_own() {
        use tigshop_core::Error;
        let shop = AuthUser::new(1, "shop".into(), None, Some("shop".into()), Some(5));
        assert_eq!(shop.resolve_shop_scope(None).unwrap(), Some(5));
        assert_eq!(shop.resolve_shop_scope(Some(5)).unwrap(), Some(5));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
        let platform = AuthUser::new(2, "admin".into(), None, Some("admin".into()), Some(0));
        assert_eq!(platform.resolve_shop_scope(Some(9)).unwrap(), Some(9));
        assert_eq!(platform.resolve_shop_scope(None).unwrap(), None);
    }

    use super::*;

    /// 4 条路由必须与契约逐字符一致（含 `/adminapi` 前缀）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4, "本域应有 4 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/panel/statisticsAccess/accessStatistics",
            "GET /adminapi/panel/statisticsUser/addUserTrends",
            "GET /adminapi/panel/statisticsUser/userConsumptionRanking",
            "GET /adminapi/panel/statisticsUser/userStatisticsPanel",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// `implemented_routes` 里的 Java 引用必须落在已知清单内
    /// （`StatisticsAccessController` / `StatisticsUserController`）。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        let known = [
            "StatisticsAccessController.accessStatistics",
            "StatisticsUserController.addUserTrends",
            "StatisticsUserController.userConsumptionRanking",
            "StatisticsUserController.userStatisticsPanel",
        ];
        let docs = implemented_routes();
        let refs: Vec<&str> = docs.iter().map(|d| d.java_ref.as_str()).collect();
        for k in known {
            assert!(refs.contains(&k), "缺少 java_ref 引用 {k}；实际={refs:?}");
        }
        // 且全部以面板控制器前缀开头
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("StatisticsAccessController.")
                    || d.java_ref.starts_with("StatisticsUserController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
    }

    /// 路由表长度 / 方法分布与契约一致（4 个全 GET），
    /// 且本地路径不带 `/adminapi` 前缀、且落在对应面板前缀下。
    #[test]
    fn route_table_covers_all_and_uses_relative_paths() {
        assert_eq!(ROUTE_TABLE.len(), 4);
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 4, "本域 4 条全部为 GET");
        assert_eq!(ROUTE_TABLE.len() - gets, 0);

        for (_, path, _) in ROUTE_TABLE {
            assert!(path.starts_with('/'), "{path} 应以 / 开头");
            assert!(
                !path.starts_with("/adminapi"),
                "{path} 不得自带 /adminapi 前缀"
            );
            assert!(
                path.starts_with("/panel/statisticsAccess/")
                    || path.starts_with("/panel/statisticsUser/"),
                "{path} 前缀错误"
            );
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        for d in implemented_routes() {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
    }
}

// ——————————————————————————————————————————————
// uncertain_points
// ——————————————————————————————————————————————
//
// 1. 【须主会话处理】本文件引用 `state.analytics.statistics`，但 `AdminState`
//    （api/admin/src/lib.rs，共享文件，禁止本任务修改）当前**未声明**
//    `statistics: Arc<StatisticsService>` 字段；`routes/mod.rs` 也未 `pub mod statistics;`。
//    主会话需：
//      (a) 在 `services/src/lib.rs` 增加 `pub mod statistics;`（当前亦缺失）；
//      (b) 在 `AdminState` 增加 `pub statistics: Arc<StatisticsService>`；
//      (c) 在 `main.rs` 构造 `StatisticsService::new(Arc::clone(&repos))` 注入；
//      (d) 在 `routes/mod.rs` 增加 `pub mod statistics;` 并由 `merge_all` 挂载其 `routes()`。
//    否则本文件无法通过编译（字段不存在）。
//
// 2. 【店铺作用域缺口】Java 用 `HeaderUtils.getShopId()` 覆盖入参 `shopId`；
//    本模块未读 `x-shop-id` 头、也未从 `AuthUser`（当前无 `shop_id` 字段）取值，
//    直接把前端查询参数里的 `shopId` 透传给 service。对 `accessStatistics`
//    （缺失即 `None`，service 退化为空轴）与 `userStatisticsPanel`
//    （成交用户数按 `shopId > 0` 过滤）会与 Java 平台/店铺视图有差异。
//    建议主会话统一在 admin 侧引入「店铺头 → 覆盖 DTO.shop_id」的中间件后再补。
//
// 3. 【权限缺口】`accessStatistics` 契约为 `jwt+perm`，本模块未实现 perm 校验，
//    仅依赖全局 `require_auth`。与项目其余已知缺口一致，待权限矩阵落地后补齐。
//
// 4. 【导出未实现】Java 侧 `isExport == 1` 会额外导出 Excel；Rust 侧无
//    `ExcelUtils` 等价设施，`isExport` 字段已在 DTO 中存在但被忽略（仍返回 JSON），
//    与 service 层口径一致。
