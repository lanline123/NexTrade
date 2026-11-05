//! 营销活动 —— 管理端路由（marketing::promotion）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.PromotionController`
//! （`@RequestMapping("/adminapi/promotion/promotion")`，4 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/promotion/promotion/list` | `list` |
//! | `GET`  | `/promotion/promotion/getPromotionCount` | `getPromotionCount` |
//! | `POST` | `/promotion/promotion/create` | `create` |
//! | `POST` | `/promotion/promotion/update` | `update` |
//!
//! # 权限
//! 控制器类级 `@PreAuthorize("@pms.hasPermission('promotionManage')")`；
//! Rust 全局 `require_auth` 只校验登录态。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::marketing::promotion::{
    PromotionCountVO, PromotionCreateDTO, PromotionListQuery, PromotionUpdateDTO, PromotionVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 4 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    (
        "GET",
        "/promotion/promotion/list",
        "PromotionController.list",
    ),
    (
        "GET",
        "/promotion/promotion/getPromotionCount",
        "PromotionController.getPromotionCount",
    ),
    (
        "POST",
        "/promotion/promotion/create",
        "PromotionController.create",
    ),
    (
        "POST",
        "/promotion/promotion/update",
        "PromotionController.update",
    ),
];

/// 营销活动路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/promotion/list", get(list))
        .route("/promotion/promotion/getPromotionCount", get(count))
        .route("/promotion/promotion/create", post(create))
        .route("/promotion/promotion/update", post(update))
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

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<PromotionListQuery>,
) -> ApiResult<PageResult<PromotionVO>> {
    ok(state.marketing.promotion.list(&q).await?)
}

async fn count(State(state): State<AdminState>) -> ApiResult<PromotionCountVO> {
    ok(state.marketing.promotion.count().await?)
}

async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<PromotionCreateDTO>,
) -> ApiResult<()> {
    state.marketing.promotion.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<PromotionUpdateDTO>,
) -> ApiResult<()> {
    state.marketing.promotion.update(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 4);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/promotion/promotion/list",
                "/promotion/promotion/getPromotionCount",
                "/promotion/promotion/create",
                "/promotion/promotion/update",
            ]
        );
        for p in &paths {
            assert!(p.starts_with("/promotion/promotion/"), "{p}");
            assert!(!p.starts_with("/adminapi"));
        }
    }

    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4);
        assert_eq!(docs[0].path, "/adminapi/promotion/promotion/list");
        assert_eq!(
            docs[1].path,
            "/adminapi/promotion/promotion/getPromotionCount"
        );
        assert_eq!(docs[2].method, "POST");
        assert_eq!(docs[3].method, "POST");
        for d in &docs {
            assert!(d.java_ref.starts_with("PromotionController."));
        }
    }

    #[test]
    fn list_query_parses_types_csv_and_camel_case() {
        let q: PromotionListQuery =
            serde_json::from_str(r#"{"keyword":"国庆","type":"1,2","timeType":1,"size":20}"#)
                .unwrap();
        assert_eq!(q.r#type.as_deref(), Some("1,2"));
        assert_eq!(q.time_type, Some(1));
        assert_eq!(q.page_size, Some(20));
    }

    #[test]
    fn bodies_parse_camel_case() {
        let c: PromotionCreateDTO = serde_json::from_str(
            r#"{"promotionName":"活动","type":1,"rangeData":[1,2],"skuIds":[3]}"#,
        )
        .unwrap();
        assert_eq!(c.promotion_name.as_deref(), Some("活动"));
        assert_eq!(c.range_data.as_ref().unwrap(), &serde_json::json!([1, 2]));
        let u: PromotionUpdateDTO =
            serde_json::from_str(r#"{"promotionId":5,"endTime":1700000000}"#).unwrap();
        assert_eq!(u.promotion_id, Some(5));
        assert_eq!(u.end_time, Some(1_700_000_000));
    }
}
