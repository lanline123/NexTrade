//! 秒杀批处理 / 装修预览 —— 管理端路由（marketing::seckill_batch）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.SeckillController`
//! （`@RequestMapping("/adminapi/promotion/seckill")`）的 3 个端点。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `POST` | `/promotion/seckill/batch` | `batch` |
//! | `GET`  | `/promotion/seckill/listForDecorate` | `listForDecorate` |
//! | `GET`  | `/promotion/seckill/listForHomePreview?page=&size=` | `listForHomePreview` |
//!
//! # 权限
//! 控制器类级 `@PreAuthorize("@pms.hasPermission('seckillManage')")`，`batch`
//! 额外 `seckillModifyManage`；Rust 全局 `require_auth` 只校验登录态。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::marketing::seckill_batch::{
    BatchDTO, HomePreviewQuery, SeckillListVO, SeckillPromotionVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "POST",
        "/promotion/seckill/batch",
        "SeckillController.batch",
    ),
    (
        "GET",
        "/promotion/seckill/listForDecorate",
        "SeckillController.listForDecorate",
    ),
    (
        "GET",
        "/promotion/seckill/listForHomePreview",
        "SeckillController.listForHomePreview",
    ),
];

/// 秒杀批处理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/seckill/batch", post(batch))
        .route("/promotion/seckill/listForDecorate", get(list_for_decorate))
        .route(
            "/promotion/seckill/listForHomePreview",
            get(list_for_home_preview),
        )
}

/// 本域已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.seckill_batch.batch(&dto).await?;
    ok(())
}

async fn list_for_decorate(State(state): State<AdminState>) -> ApiResult<Vec<SeckillPromotionVO>> {
    ok(state.marketing.seckill_batch.list_for_decorate().await?)
}

async fn list_for_home_preview(
    State(state): State<AdminState>,
    Query(q): Query<HomePreviewQuery>,
) -> ApiResult<PageResult<SeckillListVO>> {
    ok(state
        .marketing
        .seckill_batch
        .list_for_home_preview(&q)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 3);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/promotion/seckill/batch",
                "/promotion/seckill/listForDecorate",
                "/promotion/seckill/listForHomePreview",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/promotion/seckill/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[0].path, "/adminapi/promotion/seckill/batch");
        assert_eq!(docs[1].path, "/adminapi/promotion/seckill/listForDecorate");
        assert_eq!(
            docs[2].path,
            "/adminapi/promotion/seckill/listForHomePreview"
        );
        for d in &docs {
            assert!(d.java_ref.starts_with("SeckillController."));
        }
    }

    #[test]
    fn home_preview_query_parses() {
        let q: HomePreviewQuery = serde_json::from_str(r#"{"page":2,"size":20}"#).unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(20));
    }

    #[test]
    fn batch_dto_accepts_camel_case_payload() {
        let dto: BatchDTO =
            serde_json::from_value(serde_json::json!({"ids":[1,2],"type":"del"})).unwrap();
        assert_eq!(dto.ids, Some(vec![1, 2]));
        assert_eq!(dto.r#type.as_deref(), Some("del"));
    }
}
