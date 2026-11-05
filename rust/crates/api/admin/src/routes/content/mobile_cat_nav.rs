//! 管理端首页分类栏（H5）路由（切片 content::mobile_cat_nav）。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.decorate.MobileCatNavController`
//!   （`@RequestMapping("/adminapi/decorate/mobileCatNav")`）
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /decorate/mobileCatNav/list` | `MobileCatNavController.list` | 无 |
//! | `GET  /decorate/mobileCatNav/detail` | `MobileCatNavController.detail` | 无 |
//! | `POST /decorate/mobileCatNav/create` | `MobileCatNavController.create` | `mobileCatNavModifyManage` |
//! | `POST /decorate/mobileCatNav/update` | `MobileCatNavController.update` | `mobileCatNavModifyManage` |
//! | `POST /decorate/mobileCatNav/del` | `MobileCatNavController.del` | `mobileCatNavModifyManage` |
//! | `POST /decorate/mobileCatNav/updateField` | `MobileCatNavController.updateField` | `mobileCatNavModifyManage` |
//! | `POST /decorate/mobileCatNav/batch` | `MobileCatNavController.batch` | `mobileCatNavModifyManage` |
//!
//! 控制器前缀与 Java `@RequestMapping("/adminapi/decorate/mobileCatNav")`
//! 逐字符一致（**没有**像 `/product/product`、`/order/order` 那样的重复段；
//! 这里 `decorate` 与 `mobileCatNav` 是两个不同的段）。
//! 本文件内的路径均已去掉 `/adminapi` 前缀（由 `AdminState.router()` 的
//! `.nest("/adminapi", ...)` 统一拼接）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 权限校验；Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! > （与本仓其它域一致的已知缺口）。上表权限列仅作对照记录。
//!
//! > **首页装修缓存说明**：Java 的五条写链路在事务提交后调用
//! > `homeDecorateCache.invalidateAndBroadcast()`（清本地快照 + Redis Pub/Sub
//! > 广播给 `tigshop-api`）。Rust 侧尚无该缓存的等价物，本切片没有可失效的
//! > 目标，详见 `tigshop_services::content::mobile_cat_nav` 模块头。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::mobile_cat_nav::{
    BatchDTO, MobileCatNavCreateDTO, MobileCatNavListQuery, MobileCatNavUpdateDTO, MobileCatNavVO,
    OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由表（相对路径，不含 `/adminapi` 前缀）。
///
/// 抽成常量是为了让单测能直接断言路径逐字符正确
/// （与 area_code 的 `ROUTE_TABLE` 同一做法）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/decorate/mobileCatNav/list",
        "MobileCatNavController.list",
    ),
    (
        "GET",
        "/decorate/mobileCatNav/detail",
        "MobileCatNavController.detail",
    ),
    (
        "POST",
        "/decorate/mobileCatNav/create",
        "MobileCatNavController.create",
    ),
    (
        "POST",
        "/decorate/mobileCatNav/update",
        "MobileCatNavController.update",
    ),
    (
        "POST",
        "/decorate/mobileCatNav/del",
        "MobileCatNavController.del",
    ),
    (
        "POST",
        "/decorate/mobileCatNav/updateField",
        "MobileCatNavController.updateField",
    ),
    (
        "POST",
        "/decorate/mobileCatNav/batch",
        "MobileCatNavController.batch",
    ),
];

/// 首页分类栏（H5）管理端路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/decorate/mobileCatNav/list", get(list))
        .route("/decorate/mobileCatNav/detail", get(detail))
        .route("/decorate/mobileCatNav/create", post(create))
        .route("/decorate/mobileCatNav/update", post(update))
        .route("/decorate/mobileCatNav/del", post(del))
        .route("/decorate/mobileCatNav/updateField", post(update_field))
        .route("/decorate/mobileCatNav/batch", post(batch))
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

/// `GET /adminapi/decorate/mobileCatNav/list`：首页分类栏分页。
///
/// 对应 Java `MobileCatNavController.list(MobileCatNavListDTO listDTO)`
/// → `MobileCatNavServiceImpl#list`。
/// 查询参数与 Java `BasePage` 一致：`page` / `size` / `sortField` /
/// `sortOrder` / `isShow` / `keyword`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<MobileCatNavListQuery>,
) -> ApiResult<PageResult<MobileCatNavVO>> {
    ok(state.content.mobile_cat_nav.list(&q).await?)
}

/// `GET /adminapi/decorate/mobileCatNav/detail?id=`：首页分类栏详情。
///
/// 对应 Java `MobileCatNavController.detail(@RequestParam Integer id)`
/// → `MobileCatNavServiceImpl#detail`。
/// `id` 必填（缺失即 400，与 Java `@RequestParam` 一致）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<MobileCatNavVO> {
    ok(state.content.mobile_cat_nav.detail(q.id).await?)
}

/// `POST /adminapi/decorate/mobileCatNav/create`：创建首页分类栏。
///
/// 对应 Java `MobileCatNavController.create(@RequestBody MobileCatNavCreateDTO)`
/// → `MobileCatNavServiceImpl#create`。
/// Java 原方法返回 `void`，这里回传新建主键便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<MobileCatNavCreateDTO>,
) -> ApiResult<i32> {
    ok(state.content.mobile_cat_nav.create(&dto).await?)
}

/// `POST /adminapi/decorate/mobileCatNav/update`：更新首页分类栏。
///
/// 对应 Java `MobileCatNavController.update(@RequestBody MobileCatNavUpdateDTO)`
/// → `MobileCatNavServiceImpl#update`。
/// Java 返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<MobileCatNavUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.mobile_cat_nav.update(&dto).await?)
}

/// `POST /adminapi/decorate/mobileCatNav/del`：删除首页分类栏（硬删除）。
///
/// 对应 Java `MobileCatNavController.del(@RequestBody OperateDTO operateDTO)`
/// → `MobileCatNavServiceImpl#del`（`mobile_cat_nav` 表无软删标记列，
/// 就是 `removeById`）。
///
/// ⚠️ Java 删不存在的 id 也返回成功（`removeById` 返回 `false` 但不报错），
/// 本实现保持这一语义，回传删除是否命中。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.content.mobile_cat_nav.del(&dto).await?)
}

/// `POST /adminapi/decorate/mobileCatNav/updateField`：更新单个字段。
///
/// 对应 Java `MobileCatNavController.updateField(@RequestBody UpdateFieldDTO
/// updateField)` → `updateField(dto, new String[]{"is_show", "sort_order"})`，
/// 白名单是**控制器内联的数组字面量**（不是 `CheckFieldConstants` 常量）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.content.mobile_cat_nav.update_field(&dto).await?)
}

/// `POST /adminapi/decorate/mobileCatNav/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `MobileCatNavController.batch(@RequestBody BatchDTO batchDTO)`
/// → `BaseServiceImpl#batch`：`type != "del"` 时**静默返回 `false`**
/// （HTTP 200，不是报错）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.content.mobile_cat_nav.batch(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 7 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 7);

        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/decorate/mobileCatNav/list",
                "/decorate/mobileCatNav/detail",
                "/decorate/mobileCatNav/create",
                "/decorate/mobileCatNav/update",
                "/decorate/mobileCatNav/del",
                "/decorate/mobileCatNav/updateField",
                "/decorate/mobileCatNav/batch",
            ]
        );

        // 挂载前缀必须是 `/adminapi`，且相对路径不带该前缀（避免双前缀）
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with("/decorate/mobileCatNav/"), "{p} 前缀不对");
            assert!(!p.starts_with("/adminapi"), "{p} 不应自带 /adminapi 前缀");
        }

        // 控制器前缀**没有**重复段（对比 /product/product、/order/order）
        assert!(paths
            .iter()
            .all(|p| p.starts_with("/decorate/mobileCatNav/")));
        assert!(!paths.iter().any(|p| p.starts_with("/decorate/decorate")));
    }

    /// HTTP 方法与 Java 注解逐条对照。
    #[test]
    fn route_methods_match_java_annotations() {
        let methods: Vec<&str> = ROUTE_TABLE.iter().map(|(m, _, _)| *m).collect();
        assert_eq!(
            methods,
            vec!["GET", "GET", "POST", "POST", "POST", "POST", "POST"]
        );
        // 只有 list / detail 是 @GetMapping，其余 5 条都是 @PostMapping
        assert_eq!(methods.iter().filter(|m| **m == "GET").count(), 2);
        assert_eq!(methods.iter().filter(|m| **m == "POST").count(), 5);
    }

    /// 每条路由的 Java 方法名必须与契约一致。
    #[test]
    fn route_java_handlers_match_contract() {
        let handlers: Vec<&str> = ROUTE_TABLE.iter().map(|(_, _, j)| *j).collect();
        assert_eq!(
            handlers,
            vec![
                "MobileCatNavController.list",
                "MobileCatNavController.detail",
                "MobileCatNavController.create",
                "MobileCatNavController.update",
                "MobileCatNavController.del",
                "MobileCatNavController.updateField",
                "MobileCatNavController.batch",
            ]
        );
    }
}
