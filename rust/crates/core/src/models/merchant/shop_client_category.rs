//! 店铺分类 域 DTO / VO（merchant::shop_client_category）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。
//!
//! 本片两个端点的响应结构已在 [`crate::models::merchant::shop`] 中定义（管理端与前台
//! 共用同一 JAVA 业务对象），故此处不重复声明，仅做域内转发便于查找：
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | [`ShopCategoryTreeNode`] | `ShopProductCategoryService#tree` 的 hutool `Tree<Integer>` |
//! | [`ShopParentTreeVO`] | `vo.shop.ShopParentTreeVO` |
//!
//! 对应接口：
//! - `GET /api/shop/category/tree` → [`ShopCategoryTreeNode`]
//! - `GET /api/shop/category/parentTree` → [`ShopParentTreeVO`]

pub use crate::models::merchant::shop::{ShopCategoryTreeNode, ShopParentTreeVO};
