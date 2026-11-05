//! 管理端商品分组路由。
//! 对应原 Java `com.tigshop.adminapi.controller.product.ProductGroupController`
//! （`@RequestMapping("/adminapi/product/productGroup")`，8 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/productGroup/list` | `list` | `productGroupManage` |
//! | `GET  /adminapi/product/productGroup/detail` | `detail` | `productGroupManage` |
//! | `POST /adminapi/product/productGroup/create` | `create` | `productGroupModifyManage` |
//! | `POST /adminapi/product/productGroup/update` | `update` | `productGroupModifyManage` |
//! | `POST /adminapi/product/productGroup/del` | `del` | `productGroupModifyManage` |
//! | `POST /adminapi/product/productGroup/updateField` | `updateField` | `productGroupModifyManage` |
//! | `POST /adminapi/product/productGroup/batch` | `batch` | `productGroupModifyManage` |
//! | `GET  /adminapi/product/productGroup/clientList` | `client` | `productGroupManage` |
//!
//! > **权限说明**：Java 类级 `@PreAuthorize("@pms.hasPermission('productGroupManage')")`
//! > + 方法级 `productGroupModifyManage`；Rust 侧 `require_auth` 目前只校验
//! > 登录态，权限矩阵尚未实现（与 catalog 域其它模块的已知缺口一致）。
//!
//! > **多租户说明**：`list` / `create` 用请求头复刻 Java
//! > `HeaderUtils.getShopId()`：
//! > - `x-admin-type: admin` ⇒ `0`（平台）
//! > - `x-admin-type: shop|pos` ⇒ `x-shop-id`（缺失/非法 ⇒ `0`）
//! > - 其它/缺失 ⇒ `0`
//! > Java 对「缺失 admin-type」返回 `null`，`eq(shopId, null)` 在 MyBatis-Plus
//! > 下等价于匹配不到行；Rust 按 `0` 处理（与 product_stock /
//! > attributes_tpl 等既有域一致，见 `uncertain_points`）。
//! > `update` 的 `shopId` **不取请求头**（Java 只 `copyProperties` DTO，
//! > 传了才覆盖）；`del` / `updateField` / `batch` / `clientList` 不使用店铺头
//! > （`clientList` 在 Java 里甚至**不做店铺过滤**）。
//!
//! > **返回结构**：`list` 返回项目统一 `PageResult`（Java 为 MyBatis
//! > `Page<ProductGroupVO>`）；`detail` 返回 `ProductGroupVO`；其余 Java 均为
//! > `void` ⇒ 本模块返回 `data: null`。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::product_group::{
    BatchDTO, OperateDTO, ProductGroupCreateDTO, ProductGroupListQuery, ProductGroupUpdateDTO,
    ProductGroupVO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::AuthUser;
use tigshop_security::web::{ok, ApiResult};

use super::tenant;
use crate::AdminState;

/// 商品分组域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `ProductGroupController` 一致；`implemented_routes()` 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/product/productGroup/list",
        "ProductGroupController.list",
    ),
    (
        "GET",
        "/product/productGroup/detail",
        "ProductGroupController.detail",
    ),
    (
        "POST",
        "/product/productGroup/create",
        "ProductGroupController.create",
    ),
    (
        "POST",
        "/product/productGroup/update",
        "ProductGroupController.update",
    ),
    (
        "POST",
        "/product/productGroup/del",
        "ProductGroupController.del",
    ),
    (
        "POST",
        "/product/productGroup/updateField",
        "ProductGroupController.updateField",
    ),
    (
        "POST",
        "/product/productGroup/batch",
        "ProductGroupController.batch",
    ),
    (
        "GET",
        "/product/productGroup/clientList",
        "ProductGroupController.client",
    ),
];

/// 商品分组域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/productGroup/list", get(product_group_list))
        .route("/product/productGroup/detail", get(product_group_detail))
        .route("/product/productGroup/create", post(product_group_create))
        .route("/product/productGroup/update", post(product_group_update))
        .route("/product/productGroup/del", post(product_group_del))
        .route(
            "/product/productGroup/updateField",
            post(product_group_update_field),
        )
        .route("/product/productGroup/batch", post(product_group_batch))
        .route(
            "/product/productGroup/clientList",
            get(product_group_client_list),
        )
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

/// `GET /adminapi/product/productGroup/list`：分组分页列表。
///
/// 对应 Java `list(ProductGroupListDTO)`；服务层恒定按请求头店铺过滤。
async fn product_group_list(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Query(q): Query<ProductGroupListQuery>,
) -> ApiResult<PageResult<ProductGroupVO>> {
    let shop_id = shop_id_from_headers(&headers);
    ok(state.catalog.product_group.list(&q, shop_id).await?)
}

/// `GET /adminapi/product/productGroup/detail?id=`：分组详情。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn product_group_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ProductGroupVO> {
    let detail = state.catalog.product_group.detail(q.id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    ok(detail)
}

/// `POST /adminapi/product/productGroup/create`：创建分组。
///
/// 对应 Java `create(ProductGroupCreateDTO)`：
/// `setShopId(getShopId())`（请求头覆盖 DTO 的 `shopId`），返回 `void`。
async fn product_group_create(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<ProductGroupCreateDTO>,
) -> ApiResult<()> {
    let shop_id = shop_id_from_headers(&headers);
    // 返回值（自增主键）仅用于日志，Java 控制器返回 void
    let _id = state.catalog.product_group.create(&dto, shop_id).await?;
    ok(())
}

/// `POST /adminapi/product/productGroup/update`：更新分组。
///
/// 对应 Java `update(ProductGroupUpdateDTO)`；`shopId` 取 DTO（Java
/// `BeanUtils.copyProperties` 语义，不读请求头）。
async fn product_group_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<ProductGroupUpdateDTO>,
) -> ApiResult<()> {
    let id = dto
        .product_group_id
        .ok_or_else(|| tigshop_core::Error::Validation("分组ID不能为空".into()))?;
    let detail = state.catalog.product_group.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    // Java `BeanUtils.copyProperties` 会把 DTO.shopId 写进实体；这里用登录态收敛：
    // 店铺账号固定本店（传他店 → 403），平台账号保留请求值/不覆盖。
    dto.shop_id = auth.resolve_shop_scope(dto.shop_id)?;
    state.catalog.product_group.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productGroup/del`：删除分组。
///
/// 对应 Java `del(OperateDTO)` → `removeById(id)`；`id` 为 null 时静默成功。
async fn product_group_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    if let Some(id) = dto.id {
        let detail = state.catalog.product_group.detail(id).await?;
        tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    }
    state.catalog.product_group.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productGroup/updateField`：更新字段。
///
/// 对应 Java `updateField(UpdateFieldDTO, GENERAL_FIELDS)`。
/// ⚠️ 现网 Java 因 `product_group` 没有 `GENERAL_FIELDS` 列而**必定报错**
/// 「field 的值有误」——本实现如实复刻（见服务层模块注释）。
async fn product_group_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    if let Some(id) = dto.id {
        let detail = state.catalog.product_group.detail(id).await?;
        tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    }
    state.catalog.product_group.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/productGroup/batch`：批量操作（仅 `type = "del"`）。
async fn product_group_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    if dto.r#type.as_deref() == Some("del") {
        for id in dto.ids.as_deref().unwrap_or(&[]) {
            let detail = state.catalog.product_group.detail(*id).await?;
            tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
        }
    }
    state.catalog.product_group.batch(&dto).await?;
    ok(())
}

/// `GET /adminapi/product/productGroup/clientList`：前台选择器分组列表。
///
/// 对应 Java `client(ProductGroupListDTO)`：**无店铺过滤、无分页**，
/// 只按 `productGroupName` 做 `LIKE`。
async fn product_group_client_list(
    State(state): State<AdminState>,
    Query(q): Query<ProductGroupListQuery>,
) -> ApiResult<Vec<ProductGroupVO>> {
    ok(state.catalog.product_group.client_list(&q).await?)
}

// ——————————————————————————————————————————————
// 请求头 → 店铺 ID（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 解析当前店铺 ID，复刻 Java `HeaderUtils.getShopId()` 的**可用分支**：
///
/// - `x-admin-type: admin` ⇒ `0`（平台）
/// - `x-admin-type: shop|pos` ⇒ `x-shop-id`（缺失/非法 ⇒ `0`）
/// - 其它/缺失 ⇒ `0`
///
/// Java 在「缺失/未知 admin-type」时返回 `null`，随后
/// `queryWrapper.eq(shopId, null)` 在 MyBatis-Plus 下等价匹配不到行；
/// Rust 侧沿用既有域（product_stock / attributes_tpl）的 `0` 兜底，
/// 见模块头 `uncertain_points`。
#[must_use]
fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 8 条、`/adminapi` 前缀、`productGroup` 驼峰大小写敏感、
    /// `clientList` 不能写成 `client`。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8, "契约中 product_group 域共 8 条接口");

        let expected = [
            ("GET", "/adminapi/product/productGroup/list"),
            ("GET", "/adminapi/product/productGroup/detail"),
            ("POST", "/adminapi/product/productGroup/create"),
            ("POST", "/adminapi/product/productGroup/update"),
            ("POST", "/adminapi/product/productGroup/del"),
            ("POST", "/adminapi/product/productGroup/updateField"),
            ("POST", "/adminapi/product/productGroup/batch"),
            ("GET", "/adminapi/product/productGroup/clientList"),
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
            "/product/productGroup/list",
            "/product/productGroup/detail",
            "/product/productGroup/create",
            "/product/productGroup/update",
            "/product/productGroup/del",
            "/product/productGroup/updateField",
            "/product/productGroup/batch",
            "/product/productGroup/clientList",
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
                path.starts_with("/product/productGroup/"),
                "路径必须以控制器前缀开头: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(java_ref.starts_with("ProductGroupController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 请求头 → 店铺 ID（Java `HeaderUtils.getShopId()` 可用分支）。
    #[test]
    fn shop_id_matches_header_utils() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
        // 店铺账号缺 / 非法 x-shop-id ⇒ 0（Java 为 null，见模块头说明）
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            0
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            0
        );
        // 缺失 / 未知 admin-type ⇒ 0
        assert_eq!(shop_id_from_headers(&headers(&[])), 0);
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "vendor")])),
            0
        );
    }
    /// 多租户：分组详情/更新/删除必须校验归属（跨店 403；列表由请求头强制过滤）。
    #[test]
    fn tenant_scope_isolation() {
        let shop = AuthUser {
            id: 3,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(5),
        };
        assert_eq!(shop_id_from_headers_from_auth(&shop), Some(5));
        assert!(tenant::ensure_row_shop_opt(&shop, Some(5)).is_ok());
        assert!(tenant::ensure_row_shop_opt(&shop, Some(7)).is_err());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert!(tenant::ensure_row_shop_opt(&platform, Some(7)).is_ok());
    }

    fn shop_id_from_headers_from_auth(auth: &AuthUser) -> Option<i32> {
        auth.scoped_shop_id()
    }
}
