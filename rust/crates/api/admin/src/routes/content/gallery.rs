//! 管理端相册路由（content::gallery）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.GalleryController`
//! （`@RequestMapping("/adminapi/setting/gallery")`，9 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 类级/方法级权限 |
//! |----------------------------------|---------|-----------------|
//! | `GET  /setting/gallery/list`   | `GalleryController.list`   | `decorate`/`galleryManage` |
//! | `GET  /setting/gallery/detail` | `GalleryController.detail` | `galleryManage` |
//! | `POST /setting/gallery/del`    | `GalleryController.del`    | `galleryModifyManage` |
//! | `POST /setting/gallery/create` | `GalleryController.create` | `galleryModifyManage`/`decorateModifyManage` |
//! | `POST /setting/gallery/update` | `GalleryController.update` | `galleryModifyManage` |
//! | `POST /setting/gallery/batch`  | `GalleryController.batch`  | `galleryModifyManage` |
//! | `GET  /setting/gallery/tree`   | `GalleryController.tree`   | `decorate`/`galleryManage` |
//! | `POST /setting/gallery/sort`   | `GalleryController.sort`   | `galleryModifyManage` |
//! | `POST /setting/gallery/move`   | `GalleryController.move`   | `galleryModifyManage` |
//!
//! ## 权限
//! Java 在类上标 `@PreAuthorize("@pms.hasPermission('galleryManage')")`，方法上再叠加
//! 具体权限点。Rust 侧 `/adminapi` 子树当前只统一挂 `require_auth`（登录态），
//! **权限点矩阵尚未实现**（与 product_manage / salesman_material_category 等同一
//! 已知缺口）：任何已登录管理员都能调用本域全部 9 条接口。
//!
//! ## 多租户（重要）
//! Java 用 `HeaderUtils.getShopId()` / `getVendorId()` 由请求头解析账号归属，
//! 并据此过滤 `gallery.shop_id` / `gallery.vendor_id`（`null` 表示**不过滤**）。
//! Rust JWT 尚未签发店铺/供应商上下文，因此沿用 `product_stock` /
//! `salesman_material_category` / `im_servant` 的既有口径，由
//! [`resolve_scope`] 从请求头解析三态（见该函数文档）。
//!
//! ## 未迁移
//! `tree` / `sort` / `move` 的 `type = "video"` 分支在 Java 走
//! `GalleryVideoService`（`content/gallery_video` 特性，不在本批次），
//! 服务层返回明确业务错误，**不伪造**成功。
//!
//! ## 合并注意
//! 本模块**必须**并入 `crates/api/admin/src/routes/content/mod.rs` 的
//! `routes()` 与 `implemented_routes()`（外层已套 `require_auth`，不要重复包裹）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::gallery::{
    BatchDTO, GalleryDTO, GalleryDelDTO, GalleryListQuery, GalleryMoveDTO, GalleryScope,
    GallerySortDTO, GalleryTreeVO, GalleryUpdateDTO,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 相册域路由清单（去掉 `/adminapi` 前缀的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**；顺序与原 Java `GalleryController`
/// 一致，供逐字符对照 `rust/docs/api-contract.json`。
const ROUTE_TABLE: [(&str, &str, &str); 9] = [
    ("GET", "/setting/gallery/list", "GalleryController.list"),
    ("GET", "/setting/gallery/detail", "GalleryController.detail"),
    ("POST", "/setting/gallery/del", "GalleryController.del"),
    (
        "POST",
        "/setting/gallery/create",
        "GalleryController.create",
    ),
    (
        "POST",
        "/setting/gallery/update",
        "GalleryController.update",
    ),
    ("POST", "/setting/gallery/batch", "GalleryController.batch"),
    ("GET", "/setting/gallery/tree", "GalleryController.tree"),
    ("POST", "/setting/gallery/sort", "GalleryController.sort"),
    ("POST", "/setting/gallery/move", "GalleryController.move"),
];

/// 相册域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/gallery/list", get(list))
        .route("/setting/gallery/detail", get(detail))
        .route("/setting/gallery/del", post(del))
        .route("/setting/gallery/create", post(create))
        .route("/setting/gallery/update", post(update))
        .route("/setting/gallery/batch", post(batch))
        .route("/setting/gallery/tree", get(tree))
        .route("/setting/gallery/sort", post(sort))
        .route("/setting/gallery/move", post(move_group))
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

/// `GET /adminapi/setting/gallery/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/setting/gallery/tree?type=` 的查询参数。
#[derive(Debug, Deserialize)]
struct TreeQuery {
    /// 素材类型：`image`（默认）/ `video`（未迁移）。
    #[serde(default = "default_tree_type")]
    r#type: String,
}

fn default_tree_type() -> String {
    // Java `@RequestParam(defaultValue = "image")`
    "image".to_string()
}

/// `GET /adminapi/setting/gallery/list`：相册分页列表。
///
/// 对应 Java `GalleryController#list(GalleryListDTO)`：
/// 多租户过滤 + `parentId` 过滤 + 动态排序，页大小固定 99。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<GalleryListQuery>,
) -> ApiResult<PageResult<GalleryDTO>> {
    let scope = resolve_scope(&headers);
    ok(state.content.gallery.list(scope, &q).await?)
}

/// `GET /adminapi/setting/gallery/detail?id=`：相册详情。
///
/// 对应 Java `GalleryController#detail(@RequestParam Integer id)`：
/// `id < 1` 时 Java 返回 `null`（本实现返回 JSON `null`）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<GalleryDTO>> {
    ok(state.content.gallery.detail(q.id).await?)
}

/// `POST /adminapi/setting/gallery/create`：添加相册。
///
/// 对应 Java `GalleryController#create(@RequestBody GalleryDTO)`（Java 返回 `void`，
/// 本实现回传新相册 ID 便于前端/排查，不影响既有字段结构）。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<GalleryDTO>,
) -> ApiResult<i32> {
    let scope = resolve_scope(&headers);
    ok(state.content.gallery.create(scope, &dto).await?)
}

/// `POST /adminapi/setting/gallery/update`：修改相册。
///
/// 对应 Java `GalleryController#update(@RequestBody GalleryUpdateDTO)`（返回 `void`）。
async fn update(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<GalleryUpdateDTO>,
) -> ApiResult<()> {
    let scope = resolve_scope(&headers);
    state.content.gallery.update(scope, &dto).await?;
    ok(())
}

/// `POST /adminapi/setting/gallery/del`：删除相册。
///
/// 对应 Java `GalleryController#del(@RequestBody @Valid GalleryDelDTO)`：
/// 带 `deleteMode` → 连子分组一起处理；不带 → 只删单行。
async fn del(State(state): State<AdminState>, Json(dto): Json<GalleryDelDTO>) -> ApiResult<()> {
    state.content.gallery.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/gallery/batch`：批量操作相册。
///
/// 对应 Java `GalleryController#batch(@RequestBody BatchDTO)`：
/// 仅 `type = "del"` 生效（Java `BaseServiceImpl#batch`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.content.gallery.batch(&dto).await?)
}

/// `GET /adminapi/setting/gallery/tree?type=`：统一分组树。
///
/// 对应 Java `GalleryController#tree(@RequestParam(defaultValue = "image") String type)`：
/// `type = "video"` 时 Java 走 `GalleryVideoService`（未迁移 → 明确业务错误）。
async fn tree(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<TreeQuery>,
) -> ApiResult<GalleryTreeVO> {
    let scope = resolve_scope(&headers);
    ok(state.content.gallery.tree(scope, &q.r#type).await?)
}

/// `POST /adminapi/setting/gallery/sort`：分组排序。
///
/// 对应 Java `GalleryController#sort(@RequestBody @Valid GallerySortDTO)`（事务）。
async fn sort(State(state): State<AdminState>, Json(dto): Json<GallerySortDTO>) -> ApiResult<()> {
    state.content.gallery.sort(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/gallery/move`：分组转移 / 素材移动。
///
/// 对应 Java `GalleryController#move(@RequestBody @Valid GalleryMoveDTO)`（事务）。
async fn move_group(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryMoveDTO>,
) -> ApiResult<()> {
    state.content.gallery.move_group(&dto).await?;
    ok(())
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 复刻 Java `HeaderUtils.getAdminType()`：
/// 原始 `x-admin-type`；`shop` 且 `x-shop-type` 为 `2`/`3` 时分别归一为
/// `store` / `pickup`（该归一**不影响** `getShopId()` 的判定，见 [`resolve_scope`]）。
fn admin_type(headers: &HeaderMap) -> Option<String> {
    let raw = header_str(headers, "x-admin-type");
    match raw.as_deref() {
        Some("shop") => match header_str(headers, "x-shop-type").as_deref() {
            Some("2") => Some("store".to_string()),
            Some("3") => Some("pickup".to_string()),
            _ => raw,
        },
        _ => raw,
    }
}

/// 解析当前请求的多租户范围（content 素材：**身份只信任认证中间件**）。
///
/// - `shop_id`：取域路由中间件写入的 [`TenantScope`]（优先级：
///   `TenantContext` → `AuthUser` → 平台），**忽略客户端可伪造的**
///   `x-admin-type` / `x-shop-id`；平台账号 → `None`（不过滤），
///   店铺账号 → `Some(本店)`（列表条件为 `(shop_id = 0 OR shop_id = ?)`）。
/// - `vendor_id`：供应商上下文仍按既有 `x-vendor-id`（不在本次店铺隔离范围）。
///
/// ⚠️ 与旧实现的差异：旧实现直接读 `x-admin-type` / `x-shop-id` 请求头，
/// 客户端可伪造跨店数据；现改为信任 JWT 身份（伪造 query `shopId` 由
/// `tenant_scope_layer` 提前 403）。
#[must_use]
pub fn resolve_scope(headers: &HeaderMap) -> GalleryScope {
    let shop_id = TenantScope::current_list_filter();
    let vendor_id = if admin_type(headers).as_deref() == Some("vendor") {
        header_str(headers, "x-vendor-id").and_then(|v| v.trim().parse::<i32>().ok())
    } else {
        None
    };
    GalleryScope { shop_id, vendor_id }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

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

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（9 条，含 `/adminapi` 前缀）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 9, "契约中 gallery 域共 9 条接口");

        let expected = [
            ("GET", "/adminapi/setting/gallery/list"),
            ("GET", "/adminapi/setting/gallery/detail"),
            ("POST", "/adminapi/setting/gallery/del"),
            ("POST", "/adminapi/setting/gallery/create"),
            ("POST", "/adminapi/setting/gallery/update"),
            ("POST", "/adminapi/setting/gallery/batch"),
            ("GET", "/adminapi/setting/gallery/tree"),
            ("POST", "/adminapi/setting/gallery/sort"),
            ("POST", "/adminapi/setting/gallery/move"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        // 不允许重复声明（路由表改错时会暴露）
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// 路径表必须恰好 9 条、互不重复、以控制器前缀开头。
    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 9);
        for (i, (m, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/setting/gallery/"), "路径前缀错误: {p}");
            assert!(*m == "GET" || *m == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((m, p), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（9/9，防漏挂/多挂）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/setting/gallery/list",
            "/setting/gallery/detail",
            "/setting/gallery/del",
            "/setting/gallery/create",
            "/setting/gallery/update",
            "/setting/gallery/batch",
            "/setting/gallery/tree",
            "/setting/gallery/sort",
            "/setting/gallery/move",
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

    /// 平台上下文（无 task-local / 平台账号）：`shop_id = None`（列表不过滤）。
    #[test]
    fn platform_scope_has_no_shop_filter() {
        let scope = resolve_scope(&headers(&[
            ("x-admin-type", "admin"),
            ("x-shop-id", "9"),
            ("x-vendor-id", "3"),
        ]));
        assert_eq!(scope.shop_id, None);
        assert_eq!(scope.vendor_id, None);
    }

    /// 店铺上下文：`shop_id` 取认证身份（task-local），**忽略可伪造请求头**。
    #[tokio::test]
    async fn shop_scope_comes_from_trusted_identity_not_headers() {
        // 请求头伪造 x-shop-id 无效：无 task-local 时为平台语义
        let spoofed = resolve_scope(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]));
        assert_eq!(spoofed.shop_id, None);

        // 店铺身份（task-local）→ 过滤本店
        let scope = tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope(
            TenantScope::for_shop(9),
            async {
                resolve_scope(&headers(&[
                    ("x-admin-type", "shop"),
                    ("x-shop-id", "9"),
                    ("x-shop-type", "2"),
                ]))
            },
        )
        .await;
        assert_eq!(scope.shop_id, Some(9));
        assert_eq!(scope.vendor_id, None);
    }

    /// 供应商账号：`vendor_id` 取 `x-vendor-id`；未知账号类型 → 两者都不过滤。
    #[test]
    fn vendor_scope_and_unknown_scope() {
        let scope = resolve_scope(&headers(&[
            ("x-admin-type", "vendor"),
            ("x-vendor-id", "7"),
            ("x-shop-id", "9"),
        ]));
        // Java getShopId()：vendor 不是 admin/shop/pos → null（不过滤）
        assert_eq!(scope.shop_id, None);
        assert_eq!(scope.vendor_id, Some(7));

        // 脏 vendor 头 → None
        let dirty = resolve_scope(&headers(&[
            ("x-admin-type", "vendor"),
            ("x-vendor-id", "x"),
        ]));
        assert_eq!(dirty.vendor_id, None);

        // 无任何头 → 不过滤（Java 两个方法都返回 null）
        assert_eq!(resolve_scope(&HeaderMap::new()), GalleryScope::unscoped());
    }

    /// `tree` 的 `type` 缺省为 `image`（Java `@RequestParam(defaultValue="image")`）。
    #[test]
    fn tree_type_defaults_to_image() {
        let q: TreeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.r#type, "image");
        let q: TreeQuery = serde_json::from_value(serde_json::json!({"type": "video"})).unwrap();
        assert_eq!(q.r#type, "video");
    }
}
