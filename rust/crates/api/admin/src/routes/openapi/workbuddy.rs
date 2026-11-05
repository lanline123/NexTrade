//! WorkBuddy MCP 开放接口 + 消息推送演示端点路由（切片 openapi::workbuddy）。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.example.MessagePushController`
//!   （`@RequestMapping("/adminapi/messagepush/messagepush")`）
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductImportController`
//!   （`@RequestMapping("/adminapi/openapi/mcp/v1")`，`@IgnoreResponseAdvice`）
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductIntelligenceController`
//!   （`@RequestMapping("/adminapi/openapi/mcp/v1")`）
//! - `com.tigshop.adminapi.controller.openapi.workbuddy.WorkBuddyProductManageController`
//!   （`@RequestMapping("/adminapi/openapi/mcp/v1/products")`）
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |---------------------------------|---------|
//! | `GET  /messagepush/messagepush/push` | `MessagePushController.sendMessage` |
//! | `GET  /messagepush/messagepush/tigshopConfig` | `MessagePushController.tigshopConfig` |
//! | `GET  /openapi/mcp/v1/connection/status` | `WorkBuddyProductImportController.connectionStatus` |
//! | `GET  /openapi/mcp/v1/import/requirements` | `WorkBuddyProductImportController.requirements` |
//! | `GET  /openapi/mcp/v1/categories` | `WorkBuddyProductImportController.categories` |
//! | `POST /openapi/mcp/v1/products/validate` | `WorkBuddyProductImportController.validate` |
//! | `POST /openapi/mcp/v1/products/import` | `WorkBuddyProductImportController.importProducts` |
//! | `POST /openapi/mcp/v1/media/upload` | `WorkBuddyProductImportController.uploadMedia` |
//! | `POST /openapi/mcp/v1/media/upload-token` | `WorkBuddyProductImportController.uploadToken` |
//! | `GET  /openapi/mcp/v1/capabilities` | `WorkBuddyProductImportController.capabilities` |
//! | `GET  /openapi/mcp/v1/products/context` | `WorkBuddyProductImportController.productContext` |
//! | `GET  /openapi/mcp/v1/media` | `WorkBuddyProductIntelligenceController.media` |
//! | `POST /openapi/mcp/v1/media/prepare` | `WorkBuddyProductIntelligenceController.mediaPrepare` |
//! | `POST /openapi/mcp/v1/media/execute` | `WorkBuddyProductIntelligenceController.mediaExecute` |
//! | `POST /openapi/mcp/v1/categories/prepare` | `WorkBuddyProductIntelligenceController.categoryPrepare` |
//! | `POST /openapi/mcp/v1/categories/execute` | `WorkBuddyProductIntelligenceController.categoryExecute` |
//! | `GET  /openapi/mcp/v1/products/analysis` | `WorkBuddyProductIntelligenceController.analysis` |
//! | `GET  /openapi/mcp/v1/products` | `WorkBuddyProductManageController.list` |
//! | `GET  /openapi/mcp/v1/products/{id}` | `WorkBuddyProductManageController.detail` |
//! | `GET  /openapi/mcp/v1/products/{id}/promotion-links` | `WorkBuddyProductManageController.promotionLinks` |
//! | `POST /openapi/mcp/v1/products/{id}/field` | `WorkBuddyProductManageController.updateField` |
//! | `POST /openapi/mcp/v1/products/{id}/status` | `WorkBuddyProductManageController.setStatus` |
//! | `POST /openapi/mcp/v1/products/{id}/recycle` | `WorkBuddyProductManageController.recycle` |
//! | `POST /openapi/mcp/v1/products/{id}/restore` | `WorkBuddyProductManageController.restore` |
//! | `POST /openapi/mcp/v1/products/{id}/copy` | `WorkBuddyProductManageController.copy` |
//! | `POST /openapi/mcp/v1/products/{id}/delete` | `WorkBuddyProductManageController.deletePermanently` |
//! | `POST /openapi/mcp/v1/products/batch/preview` | `WorkBuddyProductManageController.batchPreview` |
//! | `POST /openapi/mcp/v1/products/batch/execute` | `WorkBuddyProductManageController.batchExecute` |
//!
//! 路径中控制器前缀重复一次（`/messagepush/messagepush/...`），与原 Java
//! `@RequestMapping` 组合结果逐字符一致。
//!
//! # 响应约定（⚠️ 与其它切片不同）
//!
//! 1. **`/messagepush/messagepush/*`**：不在 `workbuddy` 包下，
//!    走项目统一的 `AjaxResult` 包装（`ok(...)`）。
//! 2. **`/openapi/mcp/v1/*`**：Java 用 `@IgnoreResponseAdvice`
//!    + `WorkBuddyApiExceptionHandler`（`HIGHEST_PRECEDENCE`）返回
//!    **真实 HTTP 状态码 + 扁平错误体** `{errorCode, message, retryable}`，
//!    **不**经过 `AjaxResult`。
//!    本模块因此对成功路径也**直出原始 JSON**（`Json<T>`），
//!    对失败路径用 `(StatusCode, Json<WorkBuddyErrorBody>)`，
//!    以保持 MCP 连接器 `!response.ok` 分支可达
//!    （Java 注释：CR-20260827-164700 FIX-02 方案 A）。
//!    → 这是本切片的**有意偏离**，见 `uncertain_points`。
//!
//! # 鉴权
//!
//! `/openapi/mcp/v1/*` 用请求头 `X-MCP-Api-Key`（Java `KEY_HEADER`）
//! 做**密钥校验**；Java 侧这些接口**不要求** JWT
//! （契约 `auth: "jwt"` 与 Java `auth(r, scope)` 的实现不一致，
//! 见 `uncertain_points`）。本模块按 Java 实现走密钥校验。
//!
//! 幂等头为 `Idempotency-Key`（Java `IDEMPOTENCY_HEADER`）。

use axum::{
    extract::{Multipart, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use tigshop_core::models::openapi::workbuddy::{
    CategoryImportDTO, MediaOperationDTO, MediaQueryDTO, MediaUploadRequestDTO, WorkBuddyErrorBody,
    IDEMPOTENCY_HEADER, KEY_HEADER,
};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;
use tigshop_services::openapi::workbuddy::{
    AnalysisQuery, BatchBody, BatchExecuteBody, CategoryQuery, ContextQuery, FieldBody, ImportBody,
    ProductListBody, ProductListQuery, StatusBody, UploadTokenBody, WorkBuddyError,
};

/// WorkBuddy 开放接口路由（挂载于 `/adminapi` 下）。
///
/// ⚠️ 注意 `/openapi/mcp/v1/products` 与 `/openapi/mcp/v1/products/{id}`
/// 的声明顺序：axum 0.8 的 `Router` 按**路径段**匹配，静态段优先于
/// 参数段，故 `/products/batch/preview` 不会被 `/products/{id}` 抢走。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // —— MessagePushController @ /adminapi/messagepush/messagepush ——
        .route("/messagepush/messagepush/push", get(message_push))
        .route(
            "/messagepush/messagepush/tigshopConfig",
            get(tigshop_config),
        )
        // —— WorkBuddyProductImportController @ /adminapi/openapi/mcp/v1 ——
        .route("/openapi/mcp/v1/connection/status", get(connection_status))
        .route("/openapi/mcp/v1/import/requirements", get(requirements))
        .route("/openapi/mcp/v1/categories", get(categories))
        .route("/openapi/mcp/v1/products/validate", post(validate_products))
        .route("/openapi/mcp/v1/products/import", post(import_products))
        .route("/openapi/mcp/v1/media/upload", post(upload_media))
        .route("/openapi/mcp/v1/media/upload-token", post(upload_token))
        .route("/openapi/mcp/v1/capabilities", get(capabilities))
        .route("/openapi/mcp/v1/products/context", get(product_context))
        // —— WorkBuddyProductIntelligenceController @ /adminapi/openapi/mcp/v1 ——
        .route("/openapi/mcp/v1/media", get(media))
        .route("/openapi/mcp/v1/media/prepare", post(media_prepare))
        .route("/openapi/mcp/v1/media/execute", post(media_execute))
        .route("/openapi/mcp/v1/categories/prepare", post(category_prepare))
        .route("/openapi/mcp/v1/categories/execute", post(category_execute))
        .route("/openapi/mcp/v1/products/analysis", get(analysis))
        // —— WorkBuddyProductManageController @ /adminapi/openapi/mcp/v1/products ——
        // 批量路由必须先注册，避免被 `/{id}` 参数段吞掉。
        .route(
            "/openapi/mcp/v1/products/batch/preview",
            post(batch_preview),
        )
        .route(
            "/openapi/mcp/v1/products/batch/execute",
            post(batch_execute),
        )
        .route("/openapi/mcp/v1/products", get(product_list))
        .route("/openapi/mcp/v1/products/{id}", get(product_detail))
        .route(
            "/openapi/mcp/v1/products/{id}/promotion-links",
            get(promotion_links),
        )
        .route("/openapi/mcp/v1/products/{id}/field", post(update_field))
        .route("/openapi/mcp/v1/products/{id}/status", post(set_status))
        .route("/openapi/mcp/v1/products/{id}/recycle", post(recycle))
        .route("/openapi/mcp/v1/products/{id}/restore", post(restore))
        .route("/openapi/mcp/v1/products/{id}/copy", post(copy_product))
        .route(
            "/openapi/mcp/v1/products/{id}/delete",
            post(delete_permanently),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// ⚠️ 路径必须是**含 `/adminapi` 前缀的完整契约路径**。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/messagepush/messagepush/push",
            "MessagePushController.sendMessage",
        ),
        (
            "GET",
            "/adminapi/messagepush/messagepush/tigshopConfig",
            "MessagePushController.tigshopConfig",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/connection/status",
            "WorkBuddyProductImportController.connectionStatus",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/import/requirements",
            "WorkBuddyProductImportController.requirements",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/categories",
            "WorkBuddyProductImportController.categories",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/validate",
            "WorkBuddyProductImportController.validate",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/import",
            "WorkBuddyProductImportController.importProducts",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/media/upload",
            "WorkBuddyProductImportController.uploadMedia",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/media/upload-token",
            "WorkBuddyProductImportController.uploadToken",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/capabilities",
            "WorkBuddyProductImportController.capabilities",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/products/context",
            "WorkBuddyProductImportController.productContext",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/media",
            "WorkBuddyProductIntelligenceController.media",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/media/prepare",
            "WorkBuddyProductIntelligenceController.mediaPrepare",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/media/execute",
            "WorkBuddyProductIntelligenceController.mediaExecute",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/categories/prepare",
            "WorkBuddyProductIntelligenceController.categoryPrepare",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/categories/execute",
            "WorkBuddyProductIntelligenceController.categoryExecute",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/products/analysis",
            "WorkBuddyProductIntelligenceController.analysis",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/products",
            "WorkBuddyProductManageController.list",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/products/{id}",
            "WorkBuddyProductManageController.detail",
        ),
        (
            "GET",
            "/adminapi/openapi/mcp/v1/products/{id}/promotion-links",
            "WorkBuddyProductManageController.promotionLinks",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/field",
            "WorkBuddyProductManageController.updateField",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/status",
            "WorkBuddyProductManageController.setStatus",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/recycle",
            "WorkBuddyProductManageController.recycle",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/restore",
            "WorkBuddyProductManageController.restore",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/copy",
            "WorkBuddyProductManageController.copy",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/{id}/delete",
            "WorkBuddyProductManageController.deletePermanently",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/batch/preview",
            "WorkBuddyProductManageController.batchPreview",
        ),
        (
            "POST",
            "/adminapi/openapi/mcp/v1/products/batch/execute",
            "WorkBuddyProductManageController.batchExecute",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// WorkBuddy 响应辅助
// ——————————————————————————————————————————————

/// WorkBuddy 接口的成功响应：**直出原始 JSON**（不经 `AjaxResult`）。
///
/// 对应 Java `@IgnoreResponseAdvice` 的语义。
type WbResponse = Response;

/// 成功：`200 OK` + 原始 JSON。
fn wb_ok<T: serde::Serialize>(data: T) -> WbResponse {
    (
        StatusCode::OK,
        Json(serde_json::to_value(data).unwrap_or(serde_json::Value::Null)),
    )
        .into_response()
}

/// 成功（已是 `serde_json::Value`）。
fn wb_json(data: serde_json::Value) -> WbResponse {
    (StatusCode::OK, Json(data)).into_response()
}

/// 失败：真实 HTTP 状态码 + `{errorCode, message, retryable}`。
///
/// 对应 Java `WorkBuddyApiExceptionHandler.handleWorkBuddyApiException`。
fn wb_err(e: WorkBuddyError) -> Response {
    let status = StatusCode::from_u16(u16::try_from(e.status()).unwrap_or(422))
        .unwrap_or(StatusCode::UNPROCESSABLE_ENTITY);
    (status, Json(e.body())).into_response()
}

/// Service 调用结果的统一收口。
fn finish<T: serde::Serialize>(r: Result<T, WorkBuddyError>) -> WbResponse {
    match r {
        Ok(v) => wb_ok(v),
        Err(e) => wb_err(e),
    }
}

/// Service 调用结果的统一收口（`serde_json::Value` 直出）。
fn finish_json(r: Result<serde_json::Value, WorkBuddyError>) -> WbResponse {
    match r {
        Ok(v) => wb_json(v),
        Err(e) => wb_err(e),
    }
}

/// 取 `X-MCP-Api-Key` 请求头（Java `r.getHeader(KEY_HEADER)`）。
fn key_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get(KEY_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
}

/// 取 `Idempotency-Key` 请求头。
fn idempotency_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get(IDEMPOTENCY_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
}

/// 400 兜底（body 反序列化失败等由 axum 自己处理，
/// 这里用于 workbuddy 内部显式报错）。
fn bad_request(code: &str, msg: &str) -> Response {
    wb_err(WorkBuddyError::bad_request(code, msg))
}

/// 500 兜底（对应 Java `handleException`）。
///
/// ⚠️ Java 的原样状态码是 500，但 `WorkBuddyApiExceptionHandler.resolveStatus`
/// **只**处理 `WorkBuddyApiException` 与 `GlobalException`；`handleException`
/// 分支直接用 `HttpStatus.ERROR`(500)。为忠实复刻，这里显式构造 500。
fn internal_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(WorkBuddyErrorBody::new(
            tigshop_core::models::openapi::workbuddy::CODE_INTERNAL_ERROR,
            tigshop_core::models::openapi::workbuddy::MSG_INTERNAL_ERROR,
            true,
        )),
    )
        .into_response()
}

// ——————————————————————————————————————————————
// MessagePushController（走常规 AjaxResult 包装）
// ——————————————————————————————————————————————

/// `GET /adminapi/messagepush/messagepush/push`：给用户发一条新订单站内消息。
///
/// 对应 Java `MessagePushController.sendMessage`（`@RequestParam userId`,
/// `@RequestParam orderId`，返回 `void`）。
///
/// ⚠️ Java 方法返回 `void`，经 `AjaxResult` 包装后 `data` 为 `null`。
/// 本实现返回 `data: null` 以保持一致。
async fn message_push(
    State(state): State<AdminState>,
    Query(q): Query<PushQuery>,
) -> ApiResult<serde_json::Value> {
    state
        .openapi
        .workbuddy
        .message_push(q.user_id, q.order_id)
        .await
        .map_err(|e| tigshop_security::web::AppError::from(tigshop_core::Error::from(e)))?;
    ok(serde_json::Value::Null)
}

/// `GET /adminapi/messagepush/messagepush/push` 的查询参数。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushQuery {
    user_id: i32,
    order_id: i32,
}

/// `GET /adminapi/messagepush/messagepush/tigshopConfig`：站点产品形态开关。
///
/// 对应 Java `MessagePushController.tigshopConfig`。
///
/// ⚠️ Java 直接返回 `String`（纯文本），本实现返回
/// `{ "text": "isMerchant: 1isB2b: 1..." }`，见 `uncertain_points`。
async fn tigshop_config(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    let vo = state.openapi.workbuddy.tigshop_config();
    ok(json!({ "text": vo.text }))
}

// ——————————————————————————————————————————————
// WorkBuddyProductImportController
// ——————————————————————————————————————————————

/// `GET /adminapi/openapi/mcp/v1/connection/status`：MCP 连接状态。
///
/// 对应 Java `WorkBuddyProductImportController.connectionStatus`。
///
/// Java 在鉴权失败时抛 401；但连接状态查询本身要能报告「未连接」，
/// 故此处**始终 200** 并回出 `valid=false` + 具体原因。
async fn connection_status(State(state): State<AdminState>, headers: HeaderMap) -> WbResponse {
    let vo = state
        .openapi
        .workbuddy
        .connection_status(key_header(&headers).as_deref())
        .await;
    wb_ok(vo)
}

/// `GET /adminapi/openapi/mcp/v1/import/requirements`：导入字段清单。
///
/// 对应 Java `WorkBuddyProductImportController.requirements`。
async fn requirements(State(state): State<AdminState>) -> WbResponse {
    wb_ok(state.openapi.workbuddy.requirements())
}

/// `GET /adminapi/openapi/mcp/v1/categories`：分类检索。
///
/// 对应 Java `WorkBuddyProductImportController.categories`。
async fn categories(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<CategoryQuery>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .categories(key_header(&headers).as_deref(), &q)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/validate`：批量校验商品草稿。
///
/// 对应 Java `WorkBuddyProductImportController.validate`（`@RequestBody ProductList`）。
async fn validate_products(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<ProductListBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .validate_products(key_header(&headers).as_deref(), &body)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/import`：确认后落库。
///
/// 对应 Java `WorkBuddyProductImportController.importProducts`（`@RequestBody ImportBody`）。
async fn import_products(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<ImportBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .import_products(
                key_header(&headers).as_deref(),
                idempotency_header(&headers).as_deref(),
                &body,
            )
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/media/upload`：媒体上传。
///
/// 对应 Java `WorkBuddyProductImportController.uploadMedia`。
///
/// Java 支持两种模式：
/// 1. `multipart/form-data`（`files` 文件字段，最多 20 个、单批 40MiB）
/// 2. JSON body（`files[].contentBase64`）
///
/// ⚠️ axum 的 `Multipart` 与 `Json` 提取器**不能同时**作为参数
/// （两者都消费请求体，会导致 body 只能读一次）。
/// 本实现按 `Content-Type` 分派：`multipart/form-data` 走 [`upload_multipart`]，
/// 其余走 JSON。**base64 的 multipart 分支未实现**（Java 用它做兜底），
/// 见 `uncertain_points`。
async fn upload_media(
    State(state): State<AdminState>,
    headers: HeaderMap,
    multipart: Option<Multipart>,
) -> WbResponse {
    let Some(mut mp) = multipart else {
        return bad_request(
            tigshop_core::models::openapi::workbuddy::CODE_UPLOAD_CONTENT_TYPE_REQUIRED,
            tigshop_core::models::openapi::workbuddy::MSG_UPLOAD_CONTENT_TYPE_REQUIRED,
        );
    };
    upload_multipart(&state, &headers, &mut mp).await
}

/// multipart 分支：把 `files` 字段读成 base64 字符串后交给服务层。
///
/// ⚠️ 这里**不做**对象存储上传（见服务层 `upload_media` 的说明）。
async fn upload_multipart(
    state: &AdminState,
    headers: &HeaderMap,
    mp: &mut Multipart,
) -> WbResponse {
    let mut files = Vec::new();
    let mut confirmation = false;
    let mut group_id: Option<i32> = None;

    loop {
        let field = match mp.next_field().await {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(e) => {
                return bad_request(
                    tigshop_core::models::openapi::workbuddy::CODE_INVALID_FILE,
                    &format!("multipart 解析失败: {e}"),
                )
            }
        };
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "confirmation" => {
                if let Ok(v) = field.text().await {
                    confirmation = v.trim().eq_ignore_ascii_case("true") || v.trim() == "1";
                }
            }
            "groupId" => {
                if let Ok(v) = field.text().await {
                    group_id = v.trim().parse::<i32>().ok();
                }
            }
            "files" => {
                let file_name = field.file_name().unwrap_or_default().to_string();
                let mime = field.content_type().unwrap_or("").to_string();
                match field.bytes().await {
                    Ok(bytes) => files.push(Base64ishFile {
                        name: file_name,
                        mime,
                        bytes: bytes.to_vec(),
                    }),
                    Err(e) => {
                        return bad_request(
                            tigshop_core::models::openapi::workbuddy::CODE_INVALID_FILE,
                            &format!("读取文件失败: {e}"),
                        )
                    }
                }
            }
            _ => {
                // 未知字段：读掉以免阻塞后续解析。
                let _ = field.bytes().await;
            }
        }
    }

    if files.is_empty() {
        return bad_request(
            tigshop_core::models::openapi::workbuddy::CODE_UPLOAD_FILE_PART_REQUIRED,
            tigshop_core::models::openapi::workbuddy::MSG_UPLOAD_FILE_PART_REQUIRED,
        );
    }

    // multipart 的二进制直接做魔数校验后再交给服务层（避免再编码成 base64）。
    let mut dto_files = Vec::new();
    for f in &files {
        let b64 = encode_base64(&f.bytes);
        dto_files.push(
            tigshop_core::models::openapi::workbuddy::MediaUploadFileDTO {
                id: None,
                client_file_id: Some(f.name.clone()),
                file_token: None,
                name: Some(f.name.clone()),
                mime_type: Some(f.mime.clone()),
                content_base64: Some(b64),
                group_id,
                role: None,
            },
        );
    }

    let req = MediaUploadRequestDTO {
        confirmation,
        group_id,
        files: dto_files,
    };
    finish(
        state
            .openapi
            .workbuddy
            .upload_media(key_header(headers).as_deref(), &req)
            .await,
    )
}

/// multipart 读到的文件。
struct Base64ishFile {
    name: String,
    mime: String,
    bytes: Vec<u8>,
}

/// 标准 Base64 编码（本域只用于把 multipart 字节转成服务层入参）。
fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        if chunk.len() > 1 {
            out.push(TABLE[((n >> 6) & 63) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(TABLE[(n & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// `POST /adminapi/openapi/mcp/v1/media/upload-token`：申请文件令牌。
///
/// 对应 Java `WorkBuddyProductImportController.uploadToken`。
async fn upload_token(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<UploadTokenBody>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .upload_token(key_header(&headers).as_deref(), &body)
            .await,
    )
}

/// `GET /adminapi/openapi/mcp/v1/capabilities`：MCP 能力声明。
///
/// 对应 Java `WorkBuddyProductImportController.capabilities`。
async fn capabilities(State(state): State<AdminState>, headers: HeaderMap) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .capabilities(key_header(&headers).as_deref())
            .await,
    )
}

/// `GET /adminapi/openapi/mcp/v1/products/context`：同类商品上下文。
///
/// 对应 Java `WorkBuddyProductImportController.productContext`。
async fn product_context(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<ContextQuery>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .product_context(key_header(&headers).as_deref(), &q)
            .await,
    )
}

// ——————————————————————————————————————————————
// WorkBuddyProductIntelligenceController
// ——————————————————————————————————————————————

/// `GET /adminapi/openapi/mcp/v1/media`：素材查询。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.media`
/// （`@ModelAttribute MediaQueryDTO`，返回 `Map<String,Object>`）。
async fn media(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<MediaQueryDTO>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .media(key_header(&headers).as_deref(), &q)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/media/prepare`：素材写入预览。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.mediaPrepare`。
async fn media_prepare(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(op): Json<MediaOperationDTO>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .media_prepare(key_header(&headers).as_deref(), &op)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/media/execute`：素材写入执行。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.mediaExecute`。
async fn media_execute(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(op): Json<MediaOperationDTO>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .media_execute(key_header(&headers).as_deref(), &op)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/categories/prepare`：分类导入预览。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.categoryPrepare`。
async fn category_prepare(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<CategoryImportDTO>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .category_prepare(key_header(&headers).as_deref(), &dto)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/categories/execute`：分类导入执行。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.categoryExecute`。
async fn category_execute(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<CategoryImportDTO>,
) -> WbResponse {
    finish_json(
        state
            .openapi
            .workbuddy
            .category_execute(key_header(&headers).as_deref(), &dto)
            .await,
    )
}

/// `GET /adminapi/openapi/mcp/v1/products/analysis`：商品分析。
///
/// 对应 Java `WorkBuddyProductIntelligenceController.analysis`。
async fn analysis(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<AnalysisQuery>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .analysis(key_header(&headers).as_deref(), &q)
            .await,
    )
}

// ——————————————————————————————————————————————
// WorkBuddyProductManageController
// ——————————————————————————————————————————————

/// `GET /adminapi/openapi/mcp/v1/products`：商品列表。
///
/// 对应 Java `WorkBuddyProductManageController.list`。
async fn product_list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<ProductListQuery>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .product_list(key_header(&headers).as_deref(), &q)
            .await,
    )
}

/// `GET /adminapi/openapi/mcp/v1/products/{id}`：商品详情。
///
/// 对应 Java `WorkBuddyProductManageController.detail`（`@PathVariable Integer id`）。
async fn product_detail(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .product_detail(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `GET /adminapi/openapi/mcp/v1/products/{id}/promotion-links`：推广链接。
///
/// 对应 Java `WorkBuddyProductManageController.promotionLinks`。
async fn promotion_links(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .promotion_links(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/field`：改单个白名单字段。
///
/// 对应 Java `WorkBuddyProductManageController.updateField`（`@RequestBody FieldBody`）。
async fn update_field(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
    Json(body): Json<FieldBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .update_field(key_header(&headers).as_deref(), Some(id), &body)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/status`：上下架。
///
/// 对应 Java `WorkBuddyProductManageController.setStatus`（`@RequestBody StatusBody`）。
async fn set_status(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
    Json(body): Json<StatusBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .set_status(key_header(&headers).as_deref(), Some(id), &body)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/recycle`：移入回收站。
///
/// 对应 Java `WorkBuddyProductManageController.recycle`。
async fn recycle(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .recycle(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/restore`：从回收站还原。
///
/// 对应 Java `WorkBuddyProductManageController.restore`。
async fn restore(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .restore(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/copy`：复制商品。
///
/// 对应 Java `WorkBuddyProductManageController.copy`。
async fn copy_product(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .copy(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/{id}/delete`：彻底删除。
///
/// 对应 Java `WorkBuddyProductManageController.deletePermanently`。
async fn delete_permanently(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Path(id): Path<i32>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .delete_permanently(key_header(&headers).as_deref(), Some(id))
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/batch/preview`：批量操作预览。
///
/// 对应 Java `WorkBuddyProductManageController.batchPreview`（`@RequestBody BatchBody`）。
async fn batch_preview(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<BatchBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .batch_preview(key_header(&headers).as_deref(), &body)
            .await,
    )
}

/// `POST /adminapi/openapi/mcp/v1/products/batch/execute`：批量操作执行。
///
/// 对应 Java `WorkBuddyProductManageController.batchExecute`
/// （`@RequestBody BatchExecuteBody`）。
async fn batch_execute(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(body): Json<BatchExecuteBody>,
) -> WbResponse {
    finish(
        state
            .openapi
            .workbuddy
            .batch_execute(key_header(&headers).as_deref(), &body)
            .await,
    )
}
