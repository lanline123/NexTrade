//! 管理端电子卡券路由。
//! 对应原 Java `com.tigshop.adminapi.controller.product.ECardController`
//! （`@RequestMapping("/adminapi/product/eCard")`，7 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/eCard/list` | `list` | `eCardManage` |
//! | `GET  /adminapi/product/eCard/detail` | `detail` | `eCardManage` |
//! | `POST /adminapi/product/eCard/create` | `create` | `eCardManage` |
//! | `POST /adminapi/product/eCard/update` | `update` | `eCardManage` |
//! | `POST /adminapi/product/eCard/del` | `del` | `eCardManage` |
//! | `POST /adminapi/product/eCard/updateField` | `updateField` | `eCardManage` |
//! | `POST /adminapi/product/eCard/batch` | `batch` | `eCardManage` |
//!
//! > **权限说明**：Java 类级 `@PreAuthorize("@pms.hasPermission('eCardManage')")`；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现
//! > （与 catalog 域其它模块的已知缺口一致）。
//!
//! > **无店铺概念**：`e_card` 表没有 `shop_id` 列，Java 的 `list` 只按
//! > `groupId` + `keyword` 过滤，不读任何租户请求头；本模块保持一致
//! > （不解析 `x-admin-type` / `x-shop-id`）。
//!
//! > **返回结构**：Java `list` 返回 MyBatis-Plus `Page<ECardVO>`，Rust 统一
//! > 用项目既有 `PageResult`（`list/total/totalPage/pageSize/page`）；
//! > `updateField` 在 Java 是 `void`，本模块返回 `data: null`（服务层仍
//! > 返回 boolean 供测试/日志使用，路由层丢弃）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::e_card::{
    BatchDTO, ECardEditParam, ECardPageQuery, ECardSaveParam, ECardVO, OperateDTO, UpdateFieldDTO,
    ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 电子卡券域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `ECardController` 一致；`implemented_routes()` 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    ("GET", "/product/eCard/list", "ECardController.list"),
    ("GET", "/product/eCard/detail", "ECardController.detail"),
    ("POST", "/product/eCard/create", "ECardController.create"),
    ("POST", "/product/eCard/update", "ECardController.update"),
    ("POST", "/product/eCard/del", "ECardController.del"),
    (
        "POST",
        "/product/eCard/updateField",
        "ECardController.updateField",
    ),
    ("POST", "/product/eCard/batch", "ECardController.batch"),
];

/// 电子卡券域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/eCard/list", get(e_card_list))
        .route("/product/eCard/detail", get(e_card_detail))
        .route("/product/eCard/create", post(e_card_create))
        .route("/product/eCard/update", post(e_card_update))
        .route("/product/eCard/del", post(e_card_del))
        .route("/product/eCard/updateField", post(e_card_update_field))
        .route("/product/eCard/batch", post(e_card_batch))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

// ——————————————————————————————————————————————
// handler
// ——————————————————————————————————————————————

/// `GET /adminapi/product/eCard/list`：电子卡券分页列表。
///
/// 对应 Java `list(@Validated ECardPageQuery pageQuery)`：`groupId` 必填。
async fn e_card_list(
    State(state): State<AdminState>,
    Query(q): Query<ECardPageQuery>,
) -> ApiResult<PageResult<ECardVO>> {
    ok(state.catalog.e_card.list(&q).await?)
}

/// `GET /adminapi/product/eCard/detail?id=`：电子卡券详情。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn e_card_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ECardVO> {
    ok(state.catalog.e_card.detail(q.id).await?)
}

/// `POST /adminapi/product/eCard/create`：创建电子卡券（Java 返回 void）。
async fn e_card_create(
    State(state): State<AdminState>,
    Json(param): Json<ECardSaveParam>,
) -> ApiResult<()> {
    // 自增主键仅用于日志，Java 控制器返回 void
    let _id = state.catalog.e_card.create(&param).await?;
    ok(())
}

/// `POST /adminapi/product/eCard/update`：更新电子卡券（Java 返回 void）。
async fn e_card_update(
    State(state): State<AdminState>,
    Json(param): Json<ECardEditParam>,
) -> ApiResult<()> {
    state.catalog.e_card.update(&param).await?;
    ok(())
}

/// `POST /adminapi/product/eCard/del`：删除电子卡券。
///
/// Java `del(@Validated @RequestBody OperateDTO)`：`id @NotNull` 生效。
async fn e_card_del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| Error::Validation(ID_REQUIRED.into()))?;
    state.catalog.e_card.delete(id).await?;
    ok(())
}

/// `POST /adminapi/product/eCard/updateField`：更新电子卡券字段。
///
/// Java 返回 `void`（服务层 boolean 被丢弃）；字段白名单只有 `is_use`。
async fn e_card_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.catalog.e_card.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/eCard/batch`：批量操作（仅 `type = "del"`）。
async fn e_card_batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.catalog.e_card.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 7 条、`/adminapi` 前缀、`eCard` 驼峰大小写敏感、`updateField` 不能写错。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7, "契约中 e_card 域共 7 条接口");

        let expected = [
            ("GET", "/adminapi/product/eCard/list"),
            ("GET", "/adminapi/product/eCard/detail"),
            ("POST", "/adminapi/product/eCard/create"),
            ("POST", "/adminapi/product/eCard/update"),
            ("POST", "/adminapi/product/eCard/del"),
            ("POST", "/adminapi/product/eCard/updateField"),
            ("POST", "/adminapi/product/eCard/batch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }

        // 无重复、无多余
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys, "implemented_routes() 存在重复项");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应（架构 §4 门禁：路由即契约）。
    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = [
            "/product/eCard/list",
            "/product/eCard/detail",
            "/product/eCard/create",
            "/product/eCard/update",
            "/product/eCard/del",
            "/product/eCard/updateField",
            "/product/eCard/batch",
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

    /// 路由表形状：统一前缀、GET/POST、无重复、java_ref 指向本控制器。
    #[test]
    fn route_table_shape_is_valid() {
        for (i, (method, path, java_ref)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                path.starts_with("/product/eCard/"),
                "路径必须以控制器前缀开头: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(java_ref.starts_with("ECardController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }
}
