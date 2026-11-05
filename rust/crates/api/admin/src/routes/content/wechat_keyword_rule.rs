//! 管理端公众号关键字回复规则路由（content::wechat_keyword_rule）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.wechat.WechatKeywordRuleController`
//! （`@RequestMapping("/adminapi/wechat/keywordRule")`，5 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET  /wechat/keywordRule/list`        | `list` |
//! | `GET  /wechat/keywordRule/detail`      | `detail` |
//! | `POST /wechat/keywordRule/save`        | `save` |
//! | `POST /wechat/keywordRule/del`         | `del` |
//! | `POST /wechat/keywordRule/setEnabled`  | `setEnabled` |
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::wechat_keyword_rule::{
    KeywordRuleDelDTO, KeywordRuleDetailVO, KeywordRuleListQuery, KeywordRuleSaveDTO,
    KeywordRuleSaveVO, KeywordRuleVO, SetEnabledDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/wechat/keywordRule/list",
        "WechatKeywordRuleController.list",
    ),
    (
        "GET",
        "/wechat/keywordRule/detail",
        "WechatKeywordRuleController.detail",
    ),
    (
        "POST",
        "/wechat/keywordRule/save",
        "WechatKeywordRuleController.save",
    ),
    (
        "POST",
        "/wechat/keywordRule/del",
        "WechatKeywordRuleController.del",
    ),
    (
        "POST",
        "/wechat/keywordRule/setEnabled",
        "WechatKeywordRuleController.setEnabled",
    ),
];

/// 关键字规则路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/wechat/keywordRule/list", get(list))
        .route("/wechat/keywordRule/detail", get(detail))
        .route("/wechat/keywordRule/save", post(save))
        .route("/wechat/keywordRule/del", post(del))
        .route("/wechat/keywordRule/setEnabled", post(set_enabled))
}

/// 本域已实现路由（覆盖率统计用）。
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

/// `GET /adminapi/wechat/keywordRule/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i64>,
}

/// `GET /adminapi/wechat/keywordRule/list`：规则列表。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<KeywordRuleListQuery>,
) -> ApiResult<PageResult<KeywordRuleVO>> {
    ok(state.content.wechat_keyword_rule.list(&q).await?)
}

/// `GET /adminapi/wechat/keywordRule/detail?id=`：规则详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<KeywordRuleDetailVO> {
    ok(state.content.wechat_keyword_rule.detail(q.id).await?)
}

/// `POST /adminapi/wechat/keywordRule/save`：新增或编辑规则。
async fn save(
    State(state): State<AdminState>,
    Json(dto): Json<KeywordRuleSaveDTO>,
) -> ApiResult<KeywordRuleSaveVO> {
    ok(state.content.wechat_keyword_rule.save(&dto).await?)
}

/// `POST /adminapi/wechat/keywordRule/del`：批量删除规则。
async fn del(State(state): State<AdminState>, Json(dto): Json<KeywordRuleDelDTO>) -> ApiResult<()> {
    state.content.wechat_keyword_rule.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/wechat/keywordRule/setEnabled`：批量启停规则。
async fn set_enabled(
    State(state): State<AdminState>,
    Json(dto): Json<SetEnabledDTO>,
) -> ApiResult<()> {
    state.content.wechat_keyword_rule.set_enabled(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            ("GET", "/adminapi/wechat/keywordRule/list"),
            ("GET", "/adminapi/wechat/keywordRule/detail"),
            ("POST", "/adminapi/wechat/keywordRule/save"),
            ("POST", "/adminapi/wechat/keywordRule/del"),
            ("POST", "/adminapi/wechat/keywordRule/setEnabled"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut unique: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    #[test]
    fn route_table_is_unique_and_prefixed() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/wechat/keywordRule/"), "路径前缀错误: {p}");
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }
}
