//! 管理端拼团活动路由（marketing::groupon_promotion）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.GrouponPromotionController`
//! （`@RequestMapping("/adminapi/promotion/groupon")`，8 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `POST /promotion/groupon/create` | `create` | `grouponPromotionModifyManage` |
//! | `POST /promotion/groupon/update` | `update` | `grouponPromotionModifyManage` |
//! | `POST /promotion/groupon/finish` | `finish` | `grouponPromotionModifyManage` |
//! | `POST /promotion/groupon/del` | `del` | `grouponPromotionModifyManage` |
//! | `GET  /promotion/groupon/detail` | `detail` | `grouponPromotionManage` |
//! | `GET  /promotion/groupon/list` | `list` | `grouponPromotionManage` |
//! | `GET  /promotion/groupon/promotionPromote` | `post` | `grouponPromotionManage` |
//! | `GET  /promotion/groupon/clientList` | `clientList` | `grouponPromotionManage` |
//!
//! > `create` 的所属店铺/`list` 的 `shopId` 缺省值取自 Java `HeaderUtils.getShopId()`
//! > （`x-admin-type` / `x-shop-id`），本模块用 [`shop_id_from_headers`] 逐分支复刻。
//!
//! > 类级 `@PreAuthorize('grouponPromotionManage')` + 方法级
//! > `grouponPromotionModifyManage`；Rust 侧 `require_auth` 目前只校验登录态，
//! > 权限矩阵尚未实现（与其它域已知缺口一致）。

use axum::{
    extract::Query,
    extract::State,
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::marketing::groupon_promotion::{
    GrouponPromotionClientPageQuery, GrouponPromotionClientPageVO, GrouponPromotionIdQuery,
    GrouponPromotionPageQuery, GrouponPromotionPageVO, OperateDTO, PromotionPromotionCreateParam,
    PromotionPromotionUpdateParam,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "POST",
        "/promotion/groupon/create",
        "GrouponPromotionController.create",
    ),
    (
        "POST",
        "/promotion/groupon/update",
        "GrouponPromotionController.update",
    ),
    (
        "POST",
        "/promotion/groupon/finish",
        "GrouponPromotionController.finish",
    ),
    (
        "POST",
        "/promotion/groupon/del",
        "GrouponPromotionController.del",
    ),
    (
        "GET",
        "/promotion/groupon/detail",
        "GrouponPromotionController.detail",
    ),
    (
        "GET",
        "/promotion/groupon/list",
        "GrouponPromotionController.list",
    ),
    (
        "GET",
        "/promotion/groupon/promotionPromote",
        "GrouponPromotionController.post",
    ),
    (
        "GET",
        "/promotion/groupon/clientList",
        "GrouponPromotionController.clientList",
    ),
];

/// 拼团活动路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/groupon/create", post(create))
        .route("/promotion/groupon/update", post(update))
        .route("/promotion/groupon/finish", post(finish))
        .route("/promotion/groupon/del", post(del))
        .route("/promotion/groupon/detail", get(detail))
        .route("/promotion/groupon/list", get(list))
        .route(
            "/promotion/groupon/promotionPromote",
            get(promotion_promote),
        )
        .route("/promotion/groupon/clientList", get(client_list))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// 解析 Java `HeaderUtils.getShopId()`：`admin` ⇒ `Some(0)`；
/// `shop|pos` ⇒ `x-shop-id`；其它/缺失 ⇒ `None`。
#[must_use]
fn shop_id_from_headers(headers: &HeaderMap) -> Option<i32> {
    let header_str = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(ToString::to_string)
    };
    match header_str("x-admin-type").as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => header_str("x-shop-id").and_then(|v| v.trim().parse::<i32>().ok()),
        _ => None,
    }
}

/// `POST /adminapi/promotion/groupon/create`：创建拼团活动。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Extension(_auth): Extension<AuthUser>,
    Json(param): Json<PromotionPromotionCreateParam>,
) -> ApiResult<()> {
    let shop_id = shop_id_from_headers(&headers);
    state
        .marketing
        .groupon_promotion
        .create(&param, shop_id)
        .await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/update`：更新拼团活动。
async fn update(
    State(state): State<AdminState>,
    Json(param): Json<PromotionPromotionUpdateParam>,
) -> ApiResult<()> {
    state.marketing.groupon_promotion.update(&param).await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/finish`：立即结束。
async fn finish(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.groupon_promotion.finish(&dto).await?;
    ok(())
}

/// `POST /adminapi/promotion/groupon/del`：删除（仅已结束活动）。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.marketing.groupon_promotion.del(dto.id).await?;
    ok(())
}

/// `GET /adminapi/promotion/groupon/detail?grouponPromotionId=`：活动详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<GrouponPromotionIdQuery>,
) -> ApiResult<tigshop_core::models::marketing::groupon_promotion::GrouponPromotionDetailVO> {
    let id = q.groupon_promotion_id.ok_or_else(|| {
        tigshop_security::web::AppError(tigshop_core::Error::Validation(
            "grouponPromotionId不能为空".into(),
        ))
    })?;
    ok(state.marketing.groupon_promotion.detail(id).await?)
}

/// `GET /adminapi/promotion/groupon/list`：管理端拼团分页。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<GrouponPromotionPageQuery>,
) -> ApiResult<PageResult<GrouponPromotionPageVO>> {
    let shop_id = shop_id_from_headers(&headers);
    ok(state.marketing.groupon_promotion.list(&q, shop_id).await?)
}

/// `GET /adminapi/promotion/groupon/promotionPromote?grouponPromotionId=`：活动推广。
async fn promotion_promote(
    State(state): State<AdminState>,
    Query(q): Query<GrouponPromotionIdQuery>,
) -> ApiResult<tigshop_core::models::marketing::groupon_promotion::GrouponPostVO> {
    let id = q.groupon_promotion_id.ok_or_else(|| {
        tigshop_security::web::AppError(tigshop_core::Error::Validation(
            "grouponPromotionId不能为空".into(),
        ))
    })?;
    ok(state.marketing.groupon_promotion.post(id).await?)
}

/// `GET /adminapi/promotion/groupon/clientList`：客户端视角拼团分页。
async fn client_list(
    State(state): State<AdminState>,
    Query(q): Query<GrouponPromotionClientPageQuery>,
) -> ApiResult<PageResult<GrouponPromotionClientPageVO>> {
    ok(state.marketing.groupon_promotion.client_list(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（8 条）。
    #[test]
    fn implemented_routes_match_contract_exactly() {
        let expected = [
            ("POST", "/adminapi/promotion/groupon/create"),
            ("POST", "/adminapi/promotion/groupon/update"),
            ("POST", "/adminapi/promotion/groupon/finish"),
            ("POST", "/adminapi/promotion/groupon/del"),
            ("GET", "/adminapi/promotion/groupon/detail"),
            ("GET", "/adminapi/promotion/groupon/list"),
            ("GET", "/adminapi/promotion/groupon/promotionPromote"),
            ("GET", "/adminapi/promotion/groupon/clientList"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域 admin 共 8 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        let mut keys: Vec<String> = docs.iter().map(RouteDoc::key).collect();
        let sorted = {
            let mut k = keys.clone();
            k.sort();
            k.dedup();
            k
        };
        keys.sort();
        assert_eq!(sorted, keys, "implemented_routes() 存在重复项");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应。
    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = [
            "/promotion/groupon/create",
            "/promotion/groupon/update",
            "/promotion/groupon/finish",
            "/promotion/groupon/del",
            "/promotion/groupon/detail",
            "/promotion/groupon/list",
            "/promotion/groupon/promotionPromote",
            "/promotion/groupon/clientList",
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

    /// 请求头 → 店铺 ID，逐分支对齐 Java `HeaderUtils.getShopId()`。
    #[test]
    fn header_resolution_matches_header_utils() {
        use axum::http::{HeaderMap, HeaderValue};
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
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin")])),
            Some(0)
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            Some(9)
        );
        assert_eq!(shop_id_from_headers(&headers(&[])), None);
    }

    /// query 参数按 Java 名（camelCase）解析。
    #[test]
    fn query_params_accept_java_names() {
        let q: GrouponPromotionPageQuery = serde_json::from_str(
            r#"{"grouponName":"拼团","productName":"商品","shopId":1,"status":1,
                "groupType":2,"startTime":"2026-10-18","endTime":"2026-10-19",
                "page":2,"size":30,"sortField":"startTime","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.groupon_name.as_deref(), Some("拼团"));
        assert_eq!(q.shop_id, Some(1));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.page, Some(2));

        let q: GrouponPromotionIdQuery =
            serde_json::from_str(r#"{"grouponPromotionId":7}"#).unwrap();
        assert_eq!(q.groupon_promotion_id, Some(7));
    }
}
