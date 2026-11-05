//! 邮箱模板管理 —— 管理端路由（system::mail_templates）。
//!
//! 原 Java：`MailTemplatesController`
//! （`tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/setting/MailTemplatesController.java`）
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth | 契约 perm |
//! |-----------|------------------|----------------|-----------|-----------|
//! | `GET /setting/mailTemplates/list` | `GET /adminapi/setting/mailTemplates/list` | `MailTemplatesController.list` | jwt+perm | `mailTemplateManage` |
//! | `POST /setting/mailTemplates/update` | `POST /adminapi/setting/mailTemplates/update` | `MailTemplatesController.update` | jwt+perm | `mailTemplatesUpdateManage` |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//!
//! 注：`list` 在原 Java 控制器上是**类级** `@PreAuthorize("...mailTemplateManage")`，
//! `update` 方法上另有更细的 `mailTemplatesUpdateManage`。
//! Rust 侧权限矩阵尚未实现（认证由 `/adminapi` 全局中间件承担），
//! 因此两个 handler 只做业务处理，不做权限判断。

use axum::{
    extract::{Extension, Request, State},
    http::HeaderMap,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::system::mail_templates::{MailTemplatesDTO, MailTemplatesVO};
use tigshop_security::web::{client_ip, ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::platform_only;

use crate::AdminState;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/mailTemplates/list", get(list))
        .route("/setting/mailTemplates/update", post(update))
        .layer(middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/mailTemplates/list",
            "MailTemplatesController.list",
        ),
        (
            "POST",
            "/adminapi/setting/mailTemplates/update",
            "MailTemplatesController.update",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/setting/mailTemplates/list`：邮箱模板列表。
///
/// 对应原 Java `MailTemplatesController.list` → `MailTemplatesServiceImpl.mailTemplatesList`。
/// 返回**裸数组**（Java 方法直接返回 `List<MailTemplatesVO>`，非分页）。
async fn list(State(state): State<AdminState>) -> ApiResult<Vec<MailTemplatesVO>> {
    ok(state.system.mail_templates.list().await?)
}

/// `POST /adminapi/setting/mailTemplates/update`：更新邮件模板。
///
/// 对应原 Java `MailTemplatesController.update` → `MailTemplatesServiceImpl.updateMailTemplates`。
/// 原 Java 方法返回 `void`，本实现沿用本仓库其它切片的约定返回提示文案。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<MailTemplatesDTO>,
) -> ApiResult<&'static str> {
    state
        .system
        .mail_templates
        .update(&dto, auth.id, &client_ip(&headers))
        .await?;
    ok("更新成功")
}
