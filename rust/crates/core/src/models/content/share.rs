//! 装修分享模板域 DTO / VO（content::share）。
//!
//! 对应原 Java `ShareController` → `DecorateShareServiceImpl#getInfoBySn`
//! 的请求参数与响应体。响应体本身复用既有
//! [`tigshop_core::models::content::decorate::DecorateVO`]（与 `DecorateService#detail`
//! 的输出一致），本模块只定义该接口的查询参数 VO。
//!
//! > **⚠️ 注册说明（由主会话处理）**：本文件需要在
//! > `crates/core/src/models/mod.rs` 增加一行 `pub mod share;`。
//! > 该文件为本切片新独占创建，未修改任何共享文件。

use serde::{Deserialize, Serialize};

/// `GET /api/home/share/import?sn=&token=` 的查询参数。
///
/// 对应 Java `ShareController#getImport` 的两个 `@RequestParam`：
/// ```java
/// public Object getImport(@RequestParam("sn") String sn,
///                         @RequestParam("token") String token)
/// ```
///
/// 字段用 `Option` 承接：Java 侧两个参数均为 `required = true` 的必填项，
/// 缺失时由 Spring 抛参数异常；Rust 侧无该层校验，故在此接收 `Option`
/// 并在服务层还原 `DecorateShareServiceImpl#getInfoBySn` 的
///「参数缺失！」校验分支（保证错误文案与原实现一致）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateShareImportQuery {
    /// 分享 sn 码（`decorate_share.share_sn`，char(6)）。
    pub sn: Option<String>,
    /// 分享验证 token（`decorate_share.share_token`，char(5)）。
    pub token: Option<String>,
}

/// 装修分享导入结果（与原 Java 返回结构对齐）。
///
/// Java 侧该接口直接 `return decorateService.detail(...)`，即一个
/// `DecorateVO`；本结构仅用于文档化响应形状，实际 handler 直接返回
/// [`tigshop_core::models::content::decorate::DecorateVO`]。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateShareImportVO {
    /// 装修页 id（`decorate_share.decorate_id`）。
    pub decorate_id: i32,
    /// 装修页标题。
    pub decorate_title: Option<String>,
    /// 已发布的页面模块数据。
    pub data: Option<serde_json::Value>,
    /// 草稿页面模块数据。
    pub draft_data: Option<serde_json::Value>,
    /// 页面类型 1:h5 2:PC 3:自定义。
    pub decorate_type: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_deserializes_both_params() {
        let q: DecorateShareImportQuery =
            serde_json::from_str(r#"{"sn":"TeD4WS","token":"EZQNZ"}"#).unwrap();
        assert_eq!(q.sn.as_deref(), Some("TeD4WS"));
        assert_eq!(q.token.as_deref(), Some("EZQNZ"));
    }

    #[test]
    fn query_tolerates_missing_params() {
        // Java 必填参数缺失时抛异常；Rust 侧接收为 None，由服务层报「参数缺失」
        let q: DecorateShareImportQuery = serde_json::from_str("{}").unwrap();
        assert!(q.sn.is_none());
        assert!(q.token.is_none());
    }
}
