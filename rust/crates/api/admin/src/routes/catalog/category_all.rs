//! 管理端分类/品牌路由（**已被切片接管的端点不在此文件**）。
//!
//! 原 Java `com.tigshop.adminapi.controller.product.CategoryController`
//! （`/adminapi/product/category`）与 `BrandController`（`/adminapi/product/brand`）。
//!
//! ## 归属说明（避免 axum 重复注册 panic）
//!
//! 并行重构按业务域切片后，分类与品牌端点已迁到切片文件，
//! 本文件**只保留切片未覆盖的一个端点**，否则 `Router::merge` 会因同一
//! `(method, path)` 重复注册在**服务启动时 panic**（不是编译错误）。
//!
//! | 本文件保留 | 原 Java | 说明 |
//! |-----------|---------|------|
//! | `GET /adminapi/product/category/getAllCategory` | `CategoryController.getAllCategory` | catalog::category 未覆盖 |
//!
//! 已迁走、**不要在此重新添加**的端点：
//! - 分类 `list` / `getParentName` / `detail` / `create` / `update` / `del` /
//!   `batch` / `updateField` / `moveCat` → `routes/category.rs`
//! - 品牌**全部 12 个端点**（含 `list`）→ `routes/brand.rs`
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 校验；Rust 侧 `require_auth` 目前只校验登录态，**权限矩阵尚未实现**，
//! > 属已知缺口（与 seckill.rs / order_admin.rs 一致）。
//!
//! > **自查**：改动本文件后请运行
//! > `cd rust && python tools/check_route_conflicts.py --strict`。

use axum::{extract::State, routing::get, Router};
use tigshop_core::models::CategoryTreeNode;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 分类域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/product/category/getAllCategory", get(all_category))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [(
        "GET",
        "/adminapi/product/category/getAllCategory",
        "CategoryController.getAllCategory",
    )]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ————————————————— 分类 —————————————————

/// `GET /adminapi/product/category/getAllCategory`：全部分类树（管理端含隐藏）。
async fn all_category(State(state): State<AdminState>) -> ApiResult<Vec<CategoryTreeNode>> {
    ok(state.catalog.category_all.category_tree(true).await?)
}
