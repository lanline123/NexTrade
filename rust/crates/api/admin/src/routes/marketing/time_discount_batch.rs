//! 管理端限时折扣批处理路由（marketing::time_discount_batch）。
//!
//! 原 Java `com.tigshop.adminapi.controller.promotion.TimeDiscountController#batch`
//! （`POST /adminapi/promotion/timeDiscount/batch`）。
//! 权限矩阵未迁移（只校验登录态）。
use axum::{extract::State, routing::post, Json, Router};
use tigshop_core::models::marketing::time_discount_batch::BatchDTO;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 1 条路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "POST",
    "/promotion/timeDiscount/batch",
    "TimeDiscountController.batch",
)];

/// 限时折扣批处理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/promotion/timeDiscount/batch", post(batch))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

/// `POST /adminapi/promotion/timeDiscount/batch`：批量删除限时折扣。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<()> {
    state.marketing.time_discount_batch.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[0].path, "/adminapi/promotion/timeDiscount/batch");
        assert_eq!(docs[0].java_ref, "TimeDiscountController.batch");
    }

    #[test]
    fn route_table_paths_stay_relative() {
        assert!(!ROUTE_TABLE[0].1.contains("/adminapi"));
        assert_eq!(ROUTE_TABLE[0].1, "/promotion/timeDiscount/batch");
    }

    #[test]
    fn batch_dto_accepts_camel_case_payload() {
        let dto: BatchDTO = serde_json::from_value(serde_json::json!({
            "ids": [1, 2], "type": "del"
        }))
        .unwrap();
        assert_eq!(dto.ids, Some(vec![1, 2]));
        assert_eq!(dto.r#type.as_deref(), Some("del"));
    }
}
