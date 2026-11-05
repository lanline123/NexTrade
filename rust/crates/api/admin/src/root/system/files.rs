//! 静态资源文件 —— 根级路由（system::files，adminapi 端）。
//!
//! **路径约定**：原 Java `FilesController` 的三个 `@GetMapping` 都是**完整路径**、
//! **不含** `/adminapi` 前缀，真实 URL 为 `<adminapi 应用根>/img/...`。
//! 它们又在 Java `SecurityConfig.URL_WHITELIST` 的 `/img/**`、`/video/**`、
//! `/app/**` 之内，因此**免登录**，由 `crate::root::merge_public` 挂载。
//!
//! | 本模块路由 | 原 Java | 登录 |
//! |-----------|--------|------|
//! | `GET /img/gallery/{timestamp}/{filename}`  | `FilesController.findImage` → `selectFile(.., "img")`   | 免 |
//! | `GET /video/gallery/{timestamp}/{filename}` | `FilesController.findVideo` → `selectFile(.., "video")` | 免 |
//! | `GET /app/update/{timestamp}/{filename}`   | `FilesController.findAoo` → `selectFile(.., "app")`     | 免 |
//!
//! 响应语义与 Java `ResponseEntity<Resource>` 一致：**裸文件流**
//! + `Content-Type`（按文件名猜 MIME，猜不到用 `application/octet-stream`）
//! + `Content-Disposition: inline; filename="..."`；不走 JSON 包装。
//!
//! 差异（详见 `crates/services/src/files.rs` 模块头）：
//! 1. 未实现 Java 的 HTTP 断点续传（`Range` 头），只支持整文件流式返回；
//! 2. 路径变量做了目录穿越校验（Java 未做），非法入参返回「文件不存在」。

use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};

use crate::AdminState;
use tigshop_services::system::files::GalleryFileKind;

/// 根级路由（挂在应用根路径，不在 `/adminapi` 之下；免登录）。
pub fn routes(_state: &AdminState) -> Router<AdminState> {
    Router::new()
        .route("/img/gallery/{timestamp}/{filename}", get(find_image))
        .route("/video/gallery/{timestamp}/{filename}", get(find_video))
        .route("/app/update/{timestamp}/{filename}", get(find_app))
}

/// 已实现路由清单（覆盖率统计用）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/img/gallery/{timestamp}/{filename}",
            "FilesController.findImage",
        ),
        (
            "GET",
            "/video/gallery/{timestamp}/{filename}",
            "FilesController.findVideo",
        ),
        (
            "GET",
            "/app/update/{timestamp}/{filename}",
            "FilesController.findAoo",
        ),
    ]
    .into_iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /img/gallery/{timestamp}/{filename}`
async fn find_image(
    State(state): State<AdminState>,
    Path((timestamp, filename)): Path<(String, String)>,
) -> Response {
    serve(&state, GalleryFileKind::Img, timestamp, filename).await
}

/// `GET /video/gallery/{timestamp}/{filename}`
async fn find_video(
    State(state): State<AdminState>,
    Path((timestamp, filename)): Path<(String, String)>,
) -> Response {
    serve(&state, GalleryFileKind::Video, timestamp, filename).await
}

/// `GET /app/update/{timestamp}/{filename}`
async fn find_app(
    State(state): State<AdminState>,
    Path((timestamp, filename)): Path<(String, String)>,
) -> Response {
    serve(&state, GalleryFileKind::App, timestamp, filename).await
}

/// 三个端点共用：打开文件并流式返回（Java `selectFile` 的响应口径）。
async fn serve(
    state: &AdminState,
    kind: GalleryFileKind,
    timestamp: String,
    filename: String,
) -> Response {
    match state.system.files.open(kind, &timestamp, &filename).await {
        Ok(opened) => {
            // Java: URLConnection.guessContentTypeFromName(filename)，猜不到 → octet-stream
            let content_type = mime_guess::from_path(&opened.filename)
                .first()
                .map(|m| m.essence_str().to_string())
                .unwrap_or_else(|| "application/octet-stream".to_string());
            let disposition = format!("inline; filename=\"{}\"", opened.filename);
            let content_length = opened.size.to_string();
            let body = Body::from_stream(tokio_util::io::ReaderStream::new(opened.file));
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, content_type),
                    (header::CONTENT_DISPOSITION, disposition),
                    (header::CONTENT_LENGTH, content_length),
                ],
                body,
            )
                .into_response()
        }
        Err(e) => tigshop_security::web::AppError(e).into_response(),
    }
}
