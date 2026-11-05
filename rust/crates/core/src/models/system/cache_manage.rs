//! 配置管理 域 DTO / VO（system::cache_manage）。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.common.CacheManageController`
//! - `com.tigshop.service.common.CacheManageService` /
//!   `com.tigshop.service.common.impl.CacheManageServiceImpl`
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 可选数值用 `Option<...>`，与 Java 的 `null` 语义一致。
//!
//! ⚠️ 本切片（清理缓存）**不涉及任何数据库列 / 金额**，因此这里只有
//! 入参与出参两个纯传输结构体；过滤逻辑（哪些 key 保留）放在服务层
//! [`tigshop_services::system::cache_manage`]，便于单测。

use serde::{Deserialize, Serialize};

/// 清理缓存入参。
///
/// 对应 Java `CacheManageController#cleanup`
/// 的 `@RequestParam(value = "tag", required = false) String tag`。
///
/// ⚠️ 原 Java 实现**完全忽略** `tag`（见
/// `CacheManageServiceImpl#cleanup`：方法体里没有任何对 `tag` 的引用），
/// 因此本结构体同样只是接收后原样回显 / 记日志，不参与过滤。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CacheCleanupQuery {
    /// 缓存 tag（可选）。原 Java 未使用。
    pub tag: Option<String>,
}

/// 清理缓存出参。
///
/// ⚠️ 原 Java `CacheManageController#cleanup` 返回 `void`（无响应体），
/// 仅把删除的 key 打到 `System.out`。Rust 版本把等价信息作为结构化
/// `data` 回传，便于运维核对（前端只需判断 `code`，多余字段无副作用）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheCleanupVO {
    /// SCAN 扫描到的 key 总数。
    pub scanned: u64,
    /// 实际删除的 key 数量（`DEL` 返回值累加）。
    pub deleted: u64,
    /// 因命中保留前缀而未删除的 key 数量。
    pub kept: u64,
    /// 回显入参 `tag`（原 Java 未使用，仅为可观测性）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
}
