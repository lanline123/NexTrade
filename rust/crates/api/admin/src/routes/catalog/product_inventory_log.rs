//! 管理端库存日志路由（catalog::product_inventory_log）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.ProductInventoryLogController`
//! （`@RequestMapping("/adminapi/product/productInventoryLog")`，1 个端点，
//! 类级 `@PreAuthorize("@pms.hasPermission('productInventoryLogManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET /product/productInventoryLog/list` | `ProductInventoryLogController.list` |
//!
//! > **鉴权口径**：Java 类级 `@PreAuthorize` 是 RBAC；Rust 侧 `require_auth`
//! > 只校验登录态（权限矩阵未实现），本模块注册在管理端需登录路由组。
//!
//! > **多租户**：Java 用请求头 `HeaderUtils.getShopId()` 强制店铺过滤；
//! > Rust JWT 无 `shop_id`，改由查询参数 `shopId` 表达（见服务层不确定点）。

use axum::{
    extract::{Extension, Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::catalog::product_inventory_log::{
    ProductInventoryLogQuery, ProductInventoryLogVO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::AuthUser;
use tigshop_security::web::{ok, ApiResult};

use super::tenant;
use crate::AdminState;

/// 本域全部路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "GET",
    "/product/productInventoryLog/list",
    "ProductInventoryLogController.list",
)];

/// 库存日志路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/product/productInventoryLog/list", get(list))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/product/productInventoryLog/list`：库存日志分页。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<ProductInventoryLogQuery>,
) -> ApiResult<PageResult<ProductInventoryLogVO>> {
    // 店铺账号强制本店；平台账号可用 shopId 筛选（留空不过滤）
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.product_inventory_log.list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/product/productInventoryLog/list");
        assert_eq!(docs[0].java_ref, "ProductInventoryLogController.list");
    }

    #[test]
    fn route_table_and_registration_agree() {
        // `routes()` 用字面量注册，这里复述同一份清单并交叉校验
        let registered = [("GET", "/product/productInventoryLog/list")];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE
                    .iter()
                    .any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        let mut unique = ROUTE_TABLE;
        unique.sort();
        for i in 1..unique.len() {
            assert_ne!(
                (unique[i - 1].0, unique[i - 1].1),
                (unique[i].0, unique[i].1)
            );
        }
    }
    /// 多租户：库存日志列表按登录态店铺强制过滤（跨店 shopId 403）。
    #[test]
    fn tenant_scope_forces_shop_filter() {
        let shop = AuthUser {
            id: 3,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(5),
        };
        assert_eq!(tenant::list_scope(&shop, None).unwrap(), Some(5));
        assert!(tenant::list_scope(&shop, Some(7)).is_err());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(tenant::list_scope(&platform, Some(7)).unwrap(), Some(7));
    }
}
