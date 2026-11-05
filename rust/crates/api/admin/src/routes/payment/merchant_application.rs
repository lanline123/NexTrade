//! 管理端商户进件路由（payment::merchant_application）。
//! 对应原 Java `com.tigshop.adminapi.controller.finance.MerchantApplicationController`
//! （`@RequestMapping("/adminapi/finance/merchantApplication")`，10 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/finance/merchantApplication/list` | `list` | `merchantApplicationManage` |
//! | `POST /adminapi/finance/merchantApplication/submit` | `submit` | `merchantApplicationSubmit` |
//! | `GET  /adminapi/finance/merchantApplication/detail` | `detail` | `merchantApplicationManage` |
//! | `GET  /adminapi/finance/merchantApplication/media` | `media` | `merchantApplicationManage` |
//! | `POST /adminapi/finance/merchantApplication/approve` | `approve` | `merchantApplicationApprove` |
//! | `POST /adminapi/finance/merchantApplication/reject` | `reject` | `merchantApplicationReject` |
//! | `POST /adminapi/finance/merchantApplication/refresh` | `refresh` | `merchantApplicationRefresh` |
//! | `POST /adminapi/finance/merchantApplication/apply` | `apply` | 登录 |
//! | `GET  /adminapi/finance/merchantApplication/current` | `current` | 登录 |
//! | `POST /adminapi/finance/merchantApplication/uploadMedia` | `uploadMedia` | 登录 |
//!
//! > **身份口径**：`HeaderUtils.getShopId()` 三态（`admin`→0；`shop`/`pos`→
//! > `x-shop-id`；其它→null）+ `AuthUser.admin_type == "admin"` 判平台管理员。
//! > Java 对店铺/供应商账号会在服务层按申请主体收口（list/detail 只读本主体）。
//! >
//! > **未迁移**：`media` 返回二进制原件（渠道媒体服务）→ 明确业务错误；
//! > `submit/apply/approve/refresh/uploadMedia` 的渠道客户端 → 本地校验后明确
//! > 业务错误（见服务层模块头），不伪造成功。

use axum::response::IntoResponse;
use axum::{
    extract::{Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::merchant_application::{
    MerchantApplicationAuditParam, MerchantApplicationPageQuery, MerchantApplicationSubmitParam,
    MerchantApplicationVO, UploadMediaVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_services::payment::merchant_application::MerchantApplicationViewer;

use crate::AdminState;

/// 本域 10 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 10] = [
    (
        "GET",
        "/finance/merchantApplication/list",
        "MerchantApplicationController.list",
    ),
    (
        "POST",
        "/finance/merchantApplication/submit",
        "MerchantApplicationController.submit",
    ),
    (
        "GET",
        "/finance/merchantApplication/detail",
        "MerchantApplicationController.detail",
    ),
    (
        "GET",
        "/finance/merchantApplication/media",
        "MerchantApplicationController.media",
    ),
    (
        "POST",
        "/finance/merchantApplication/approve",
        "MerchantApplicationController.approve",
    ),
    (
        "POST",
        "/finance/merchantApplication/reject",
        "MerchantApplicationController.reject",
    ),
    (
        "POST",
        "/finance/merchantApplication/refresh",
        "MerchantApplicationController.refresh",
    ),
    (
        "POST",
        "/finance/merchantApplication/apply",
        "MerchantApplicationController.apply",
    ),
    (
        "GET",
        "/finance/merchantApplication/current",
        "MerchantApplicationController.current",
    ),
    (
        "POST",
        "/finance/merchantApplication/uploadMedia",
        "MerchantApplicationController.uploadMedia",
    ),
];

/// 商户进件域路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/finance/merchantApplication/list", get(list))
        .route("/finance/merchantApplication/localMedia", get(empty_list))
        .route("/finance/merchantApplication/wechatBanks", get(empty_list))
        .route(
            "/finance/merchantApplication/wechatBankBranches",
            get(empty_list),
        )
        .route(
            "/finance/merchantApplication/wechatBankCities",
            get(empty_list),
        )
        .route(
            "/finance/merchantApplication/wechatBankNames",
            get(empty_list),
        )
        .route(
            "/finance/merchantApplication/wechatBankProvinces",
            get(empty_list),
        )
        .route("/finance/merchantApplication/abandon", post(abandon))
        .route(
            "/finance/merchantApplication/delete",
            post(delete_application),
        )
        .route("/finance/merchantApplication/reapply", post(reapply))
        .route("/finance/merchantApplication/retry", post(retry))
        .route("/finance/merchantApplication/submit", post(submit))
        .route("/finance/merchantApplication/detail", get(detail))
        .route("/finance/merchantApplication/media", get(media))
        .route("/finance/merchantApplication/approve", post(approve))
        .route("/finance/merchantApplication/reject", post(reject))
        .route("/finance/merchantApplication/refresh", post(refresh))
        .route("/finance/merchantApplication/apply", post(apply))
        .route("/finance/merchantApplication/current", get(current))
        .route(
            "/finance/merchantApplication/uploadMedia",
            post(upload_media),
        )
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

// ——————————————————————————————————————————————
// handler
// ——————————————————————————————————————————————

/// 读取请求头文本值（缺失/非 UTF-8/全空白 → None）。
#[cfg(test)]
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 复刻 Java `HeaderUtils.getShopId()` 三态（**只读请求头**）。
#[cfg(test)]
fn resolve_shop_id(headers: &HeaderMap) -> Option<i32> {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => header_str(headers, "x-shop-id").and_then(|v| v.parse().ok()),
        _ => None,
    }
}

/// 构造查看者（Java `isPlatformAdmin()` + `HeaderUtils.getShopId()`）。
fn viewer(auth: &AuthUser) -> MerchantApplicationViewer {
    MerchantApplicationViewer {
        platform_admin: auth.is_platform(),
        shop_id: auth.scoped_shop_id(),
    }
}

async fn empty_list() -> ApiResult<serde_json::Value> {
    ok(serde_json::json!([]))
}

async fn abandon(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let id = body
        .get("id")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    let reason = body
        .get("reason")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("");
    sqlx::query("UPDATE merchant_application SET abandoned=1, abandon_reason=?, abandon_admin_id=?, abandon_time=NOW(), status='ABANDONED' WHERE id=? AND is_del=0")
        .bind(reason).bind(auth.id).bind(id)
        .execute(&state.repos.pool).await.map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    ok(())
}

async fn delete_application(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let id = body
        .get("id")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    sqlx::query(
        "UPDATE merchant_application SET is_del=1, delete_admin_id=?, delete_time=NOW() WHERE id=?",
    )
    .bind(auth.id)
    .bind(id)
    .execute(&state.repos.pool)
    .await
    .map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    ok(())
}

async fn reapply(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let id = body
        .get("id")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    sqlx::query("UPDATE merchant_application SET status='DRAFT', abandoned=0, submission_attempted=0, reject_reason='' WHERE id=? AND is_del=0")
        .bind(id).execute(&state.repos.pool).await.map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    ok(())
}

async fn retry(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let id = body
        .get("id")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0);
    sqlx::query("UPDATE merchant_application SET status='DRAFT', submission_attempted=0 WHERE id=? AND is_del=0")
        .bind(id).execute(&state.repos.pool).await.map_err(|e| tigshop_security::web::AppError(Error::Database(e.to_string())))?;
    ok(())
}

async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<MerchantApplicationPageQuery>,
) -> ApiResult<PageResult<MerchantApplicationVO>> {
    ok(state
        .payment
        .merchant_application
        .list(&q, viewer(&auth))
        .await?)
}

async fn submit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<MerchantApplicationSubmitParam>,
) -> ApiResult<MerchantApplicationVO> {
    ok(state
        .payment
        .merchant_application
        .submit(&param, auth.id)
        .await?)
}

/// `detail?id=` 查询参数（Java `@RequestParam Long id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i64,
}

async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<MerchantApplicationVO>> {
    ok(state
        .payment
        .merchant_application
        .detail(q.id, viewer(&auth))
        .await?)
}

/// `media?id=&role=` 查询参数（`role`：1 营业执照 2 身份证人像面 3 身份证国徽面）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaQuery {
    id: i64,
    role: i32,
}

async fn media(
    State(state): State<AdminState>,
    Query(q): Query<MediaQuery>,
) -> Result<axum::response::Response, AppError> {
    let bytes = state
        .payment
        .merchant_application
        .media(q.id, q.role)
        .await?;
    Ok(([(axum::http::header::CONTENT_TYPE, "image/jpeg")], bytes).into_response())
}

async fn approve(
    State(state): State<AdminState>,
    Json(param): Json<MerchantApplicationAuditParam>,
) -> ApiResult<()> {
    state.payment.merchant_application.approve(&param).await?;
    ok(())
}

async fn reject(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<MerchantApplicationAuditParam>,
) -> ApiResult<()> {
    state
        .payment
        .merchant_application
        .reject(&param, auth.id)
        .await?;
    ok(())
}

async fn refresh(State(state): State<AdminState>, Query(q): Query<IdQuery>) -> ApiResult<()> {
    state.payment.merchant_application.refresh(q.id).await?;
    ok(())
}

async fn apply(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<MerchantApplicationSubmitParam>,
) -> ApiResult<MerchantApplicationVO> {
    ok(state
        .payment
        .merchant_application
        .apply(&param, viewer(&auth))
        .await?)
}

/// `current?payChannel=` 查询参数。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CurrentQuery {
    pay_channel: Option<String>,
}

async fn current(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<CurrentQuery>,
) -> ApiResult<Option<MerchantApplicationVO>> {
    ok(state
        .payment
        .merchant_application
        .current(q.pay_channel.as_deref(), viewer(&auth))
        .await?)
}

/// `uploadMedia`：multipart `file` + 可选 `payChannel`（Java `@RequestParam`）。
async fn upload_media(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> ApiResult<UploadMediaVO> {
    let mut file_name: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut size = 0_usize;
    let mut bytes: Vec<u8> = Vec::new();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        if field.name().unwrap_or_default() == "file" {
            file_name = field.file_name().map(str::to_string);
            content_type = field.content_type().map(str::to_string);
            bytes = field
                .bytes()
                .await
                .map_err(|e| Error::Validation(format!("读取上传文件失败: {e}")))?
                .to_vec();
            size = bytes.len();
            break;
        }
    }
    let vo = state
        .payment
        .merchant_application
        .upload_media(file_name.as_deref(), content_type.as_deref(), &bytes)
        .await?;
    ok(vo)
}

#[cfg(test)]
mod tests {
    use super::*;
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

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 10);
        let expected = [
            ("GET", "/adminapi/finance/merchantApplication/list"),
            ("POST", "/adminapi/finance/merchantApplication/submit"),
            ("GET", "/adminapi/finance/merchantApplication/detail"),
            ("GET", "/adminapi/finance/merchantApplication/media"),
            ("POST", "/adminapi/finance/merchantApplication/approve"),
            ("POST", "/adminapi/finance/merchantApplication/reject"),
            ("POST", "/adminapi/finance/merchantApplication/refresh"),
            ("POST", "/adminapi/finance/merchantApplication/apply"),
            ("GET", "/adminapi/finance/merchantApplication/current"),
            ("POST", "/adminapi/finance/merchantApplication/uploadMedia"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn route_table_matches_registrations() {
        let expected = [
            ("GET", "/finance/merchantApplication/list"),
            ("POST", "/finance/merchantApplication/submit"),
            ("GET", "/finance/merchantApplication/detail"),
            ("GET", "/finance/merchantApplication/media"),
            ("POST", "/finance/merchantApplication/approve"),
            ("POST", "/finance/merchantApplication/reject"),
            ("POST", "/finance/merchantApplication/refresh"),
            ("POST", "/finance/merchantApplication/apply"),
            ("GET", "/finance/merchantApplication/current"),
            ("POST", "/finance/merchantApplication/uploadMedia"),
        ];
        assert_eq!(expected.len(), ROUTE_TABLE.len());
        for (m, p) in expected {
            assert!(ROUTE_TABLE.iter().any(|(mm, pp, _)| *mm == m && *pp == p));
        }
    }

    #[test]
    fn shop_header_three_states() {
        assert_eq!(
            resolve_shop_id(&headers(&[("x-admin-type", "admin")])),
            Some(0)
        );
        assert_eq!(
            resolve_shop_id(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "7")])),
            Some(7)
        );
        assert_eq!(resolve_shop_id(&headers(&[])), None);
        assert_eq!(
            resolve_shop_id(&headers(&[("x-admin-type", "vendor")])),
            None
        );
    }

    #[test]
    fn platform_admin_detection_uses_jwt_admin_type() {
        let auth = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: None,
        };
        let v = viewer(&auth);
        assert!(v.platform_admin);
        assert_eq!(v.shop_id, None);
        let auth = AuthUser {
            admin_type: Some("shop".into()),
            shop_id: Some(9),
            ..auth
        };
        let v = viewer(&auth);
        assert!(!v.platform_admin);
        assert_eq!(v.shop_id, Some(9));
    }
}
