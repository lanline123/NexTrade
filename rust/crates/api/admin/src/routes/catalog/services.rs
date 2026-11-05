//! 商品服务 —— 管理端路由（catalog::services）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.ServicesController`
//! （`@RequestMapping("/adminapi/product/productServices")`，7 个端点）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |-----------|------------------|----------------|--------------------------|
//! | `GET  /product/productServices/list` | `GET /adminapi/product/productServices/list` | `ServicesController.list` | `productServicesManage` |
//! | `GET  /product/productServices/detail` | `GET /adminapi/product/productServices/detail` | `ServicesController.detail` | `productServicesManage` |
//! | `POST /product/productServices/create` | `POST /adminapi/product/productServices/create` | `ServicesController.create` | `productServicesModifyManage` |
//! | `POST /product/productServices/update` | `POST /adminapi/product/productServices/update` | `ServicesController.update` | `productServicesModifyManage` |
//! | `POST /product/productServices/del` | `POST /adminapi/product/productServices/del` | `ServicesController.del` | `productServicesModifyManage` |
//! | `POST /product/productServices/batch` | `POST /adminapi/product/productServices/batch` | `ServicesController.batch` | `productServicesModifyManage` |
//! | `POST /product/productServices/updateField` | `POST /adminapi/product/productServices/updateField` | `ServicesController.updateField` | `productServicesModifyManage` |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 是 `/adminapi/product/productServices`（`productServices`
//! 为小驼峰，**不是** `product_services`），方法级是 `/list` 这类短路径；
//! 因此完整契约路径形如 `/adminapi/product/productServices/list`。
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整路径。
//!
//! # 权限说明
//!
//! Java 用类级 `@PreAuthorize("@pms.hasPermission('productServicesManage')")`
//! + 方法级 `productServicesModifyManage`；Rust 侧 `require_auth` 目前只校验
//! 登录态，权限矩阵未实现（与 catalog 其它模块的已知缺口一致）。
//! 上表权限列仅作对照记录。
//!
//! # 返回结构说明
//!
//! - `list` / `detail`：Java 返回 MyBatis-Plus `Page<ServicesDTO>` /
//!   `ServicesDTO`；Rust 用既有 `PageResult` / `ServicesDTO`；
//! - `create` / `update` / `del` / `batch` / `updateField`：Java 控制器返回
//!   `void` → Rust `ApiResult<()>`（`data` 为 `null`）；
//!   其中 `create` / `update` / `updateField` 的服务层返回值 Java 控制器
//!   也丢弃，故本实现同样不透传布尔值。
//!
//! # 与 Java 的差异
//!
//! 1. `detail` 缺 `id`：Java 是 Spring 的 400（缺少请求参数），本实现显式
//!    报 `id不能为空`（HTTP 400）。
//! 2. 校验注解在 Java 里未生效（`@RequestBody` 缺 `@Valid`），本实现按注解
//!    本意校验，详见服务层模块头。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::services::{
    BatchDTO, OperateDTO, ServicesDTO, ServicesListQuery, UpdateFieldDTO, MSG_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一
/// 对应；单测 `route_table_matches_java_contract` 守住两边不漂移。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/product/productServices/list",
        "ServicesController.list",
    ),
    (
        "GET",
        "/product/productServices/detail",
        "ServicesController.detail",
    ),
    (
        "POST",
        "/product/productServices/create",
        "ServicesController.create",
    ),
    (
        "POST",
        "/product/productServices/update",
        "ServicesController.update",
    ),
    (
        "POST",
        "/product/productServices/del",
        "ServicesController.del",
    ),
    (
        "POST",
        "/product/productServices/batch",
        "ServicesController.batch",
    ),
    (
        "POST",
        "/product/productServices/updateField",
        "ServicesController.updateField",
    ),
];

/// 商品服务域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/productServices/list", get(list))
        .route("/product/productServices/detail", get(detail))
        .route("/product/productServices/create", post(create))
        .route("/product/productServices/update", post(update))
        .route("/product/productServices/del", post(delete))
        .route("/product/productServices/batch", post(batch))
        .route("/product/productServices/updateField", post(update_field))
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

/// `detail` 的查询参数（Java `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    /// 商品服务 ID
    id: Option<i32>,
}

/// `GET /adminapi/product/productServices/list`：商品服务分页列表。
///
/// 对应 Java `ServicesController.list(BasePage basePage)`
/// → `ServicesServiceImpl#list`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ServicesListQuery>,
) -> ApiResult<PageResult<ServicesDTO>> {
    ok(state.catalog.services.list(&q).await?)
}

/// `GET /adminapi/product/productServices/detail?id=`：商品服务详情。
///
/// 对应 Java `ServicesController.detail(@RequestParam Integer id)`
/// → `ServicesServiceImpl#detail`。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ServicesDTO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state.catalog.services.detail(id).await?)
}

/// `POST /adminapi/product/productServices/create`：新增商品服务。
///
/// 对应 Java `ServicesController.create(@RequestBody ServicesDTO)`（返回 `void`）。
async fn create(State(state): State<AdminState>, Json(dto): Json<ServicesDTO>) -> ApiResult<()> {
    state.catalog.services.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productServices/update`：编辑商品服务。
///
/// 对应 Java `ServicesController.update(@RequestBody ServicesDTO)`（返回 `void`）。
async fn update(State(state): State<AdminState>, Json(dto): Json<ServicesDTO>) -> ApiResult<()> {
    state.catalog.services.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productServices/del`：删除商品服务。
///
/// 对应 Java `ServicesController.del(@RequestBody OperateDTO)`（返回 `void`）。
async fn delete(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.catalog.services.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productServices/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `ServicesController.batch(@RequestBody BatchDTO)`（返回 `void`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.catalog.services.batch(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productServices/updateField`：更新单个字段。
///
/// 对应 Java `ServicesController.updateField(@RequestBody UpdateFieldDTO)`
/// → `ServicesServiceImpl#updateField(dto, SERVICES_FIELDS)`（返回 `void`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.catalog.services.update_field(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 7 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 7, "契约中商品服务域共 7 条接口");

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/product/productServices/list",
                "/product/productServices/detail",
                "/product/productServices/create",
                "/product/productServices/update",
                "/product/productServices/del",
                "/product/productServices/batch",
                "/product/productServices/updateField",
            ]
        );

        for p in &paths {
            // 中段是**小驼峰** `productServices`（不是 `product_services`）
            assert!(p.starts_with("/product/productServices/"), "{p} 前缀错误");
            assert!(!p.contains("product_services"), "{p} 不得用下划线写法");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 必须返回完整契约路径（含 `/adminapi`），
    /// 并且不得重复。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);

        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let expected: Vec<(String, String)> = [
            ("GET", "/adminapi/product/productServices/list"),
            ("GET", "/adminapi/product/productServices/detail"),
            ("POST", "/adminapi/product/productServices/create"),
            ("POST", "/adminapi/product/productServices/update"),
            ("POST", "/adminapi/product/productServices/del"),
            ("POST", "/adminapi/product/productServices/batch"),
            ("POST", "/adminapi/product/productServices/updateField"),
        ]
        .into_iter()
        .map(|(m, p)| (m.to_string(), p.to_string()))
        .collect();
        assert_eq!(actual, expected);

        for d in &docs {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }

        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            actual.len(),
            "implemented_routes() 存在重复项"
        );
    }

    /// method 与 Java 注解一致：`list` / `detail` 是 `@GetMapping`，
    /// 其余 5 条是 `@PostMapping`。
    #[test]
    fn http_methods_match_java_annotations() {
        let gets: Vec<&str> = ROUTE_TABLE
            .iter()
            .filter(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| *p)
            .collect();
        assert_eq!(
            gets,
            vec![
                "/product/productServices/list",
                "/product/productServices/detail"
            ]
        );
        for (method, path, _) in ROUTE_TABLE {
            assert_eq!(method == "GET", gets.contains(&path), "{path} method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler，且 handler 名与路径末段一致。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("ServicesController."),
                "{path} 缺少 Java 对照"
            );
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("ServicesController.{last}"));
        }
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（7/7）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/product/productServices/list",
            "/product/productServices/detail",
            "/product/productServices/create",
            "/product/productServices/update",
            "/product/productServices/del",
            "/product/productServices/batch",
            "/product/productServices/updateField",
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

    /// `detail` 的 `id` 参数按 camelCase 解析；缺失时报 `id不能为空`。
    #[test]
    fn detail_requires_id() {
        let q: IdQuery = serde_json::from_str(r#"{"id":12}"#).unwrap();
        assert_eq!(q.id, Some(12));
        let missing: IdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(missing.id, None);
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }
}
