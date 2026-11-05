//! 管理端会员人群圈选路由（member::member_audience）。2 端点，需登录。

use axum::{extract::State, routing::post, Json, Router};
use serde_json::Value;
use tigshop_core::models::member::member_audience::MemberAudienceDTO;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    (
        "POST",
        "/user/memberAudience/estimate",
        "MemberAudienceController.estimate",
    ),
    (
        "POST",
        "/user/memberAudience/describe",
        "MemberAudienceController.describe",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/memberAudience/estimate", post(estimate))
        .route("/user/memberAudience/describe", post(describe))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

async fn estimate(
    State(state): State<AdminState>,
    Json(dto): Json<MemberAudienceDTO>,
) -> ApiResult<Value> {
    let count = state.member.member_audience.estimate(&dto).await?;
    let body: Value = serde_json::json!({ "count": count });
    ok(body)
}

async fn describe(
    State(state): State<AdminState>,
    Json(dto): Json<MemberAudienceDTO>,
) -> ApiResult<Value> {
    let text = state.member.member_audience.describe(&dto).await?;
    let body: Value = serde_json::json!({ "text": text });
    ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].path, "/adminapi/user/memberAudience/estimate");
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[1].path, "/adminapi/user/memberAudience/describe");
    }
}
