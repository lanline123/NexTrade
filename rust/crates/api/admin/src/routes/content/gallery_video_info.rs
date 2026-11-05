//! 管理端视频相册信息路由（content::gallery_video_info）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.GalleryVideoInfoController`
//! （`@RequestMapping("/adminapi/setting/galleryVideoInfo")`，6 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java |
//! |----------------------------------|---------|
//! | `GET  /setting/galleryVideoInfo/list`        | `list` |
//! | `POST /setting/galleryVideoInfo/del`         | `del` |
//! | `POST /setting/galleryVideoInfo/uploadVideo` | `uploadVideo`（本地存储） |
//! | `POST /setting/galleryVideoInfo/create`      | `save` |
//! | `POST /setting/galleryVideoInfo/update`      | `update` |
//! | `GET  /setting/galleryVideoInfo/detail`      | `detail` |
//!
//! ## 多租户
//! Java `buildGalleryVideoQueryWrapper`：`admin` → `shop_id=0 AND vendor_id=0`；
//! `shop` → `shop_id = 当前店铺`；`vendor` → `vendor_id = 当前供应商`；其它账号
//! 无过滤。缺失/非法 `x-shop-id` / `x-vendor-id` 映射 `-1`（恒不命中，等价 Java
//! `eq(col, null)`，避免整表泄漏）。
//!
//! 合并注意：并入 `crates/api/admin/src/routes/content/mod.rs` 的 `routes()` 与
//! `implemented_routes()`。

use axum::{
    extract::{Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::gallery_video::VideoScope;
use tigshop_core::models::content::gallery_video_info::{
    GalleryVideoInfoDTO, GalleryVideoInfoListQuery, GalleryVideoInfoVO, OperateDTO,
    UploadVideoInfoVO,
};
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 本域路由清单（去掉 `/adminapi` 前缀 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    (
        "GET",
        "/setting/galleryVideoInfo/list",
        "GalleryVideoInfoController.list",
    ),
    (
        "POST",
        "/setting/galleryVideoInfo/del",
        "GalleryVideoInfoController.del",
    ),
    (
        "POST",
        "/setting/galleryVideoInfo/uploadVideo",
        "GalleryVideoInfoController.uploadVideo",
    ),
    (
        "POST",
        "/setting/galleryVideoInfo/create",
        "GalleryVideoInfoController.save",
    ),
    (
        "POST",
        "/setting/galleryVideoInfo/update",
        "GalleryVideoInfoController.update",
    ),
    (
        "GET",
        "/setting/galleryVideoInfo/detail",
        "GalleryVideoInfoController.detail",
    ),
];

/// 视频相册信息路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/galleryVideoInfo/list", get(list))
        .route("/setting/galleryVideoInfo/del", post(del))
        .route("/setting/galleryVideoInfo/uploadVideo", post(upload_video))
        .route("/setting/galleryVideoInfo/create", post(create))
        .route("/setting/galleryVideoInfo/update", post(update))
        .route("/setting/galleryVideoInfo/detail", get(detail))
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

/// `GET /adminapi/setting/galleryVideoInfo/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/setting/galleryVideoInfo/list`：相册视频列表。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<GalleryVideoInfoListQuery>,
) -> ApiResult<GalleryVideoInfoVO> {
    let scope = resolve_scope(&headers);
    ok(state.content.gallery_video_info.list(scope, &q).await?)
}

/// `GET /adminapi/setting/galleryVideoInfo/detail?id=`：视频信息详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<tigshop_core::models::content::gallery_video_info::GalleryVideoInfoDetailVO> {
    ok(state.content.gallery_video_info.detail(q.id).await?)
}

/// `POST /adminapi/setting/galleryVideoInfo/del`：删除相册视频。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.content.gallery_video_info.delete(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/galleryVideoInfo/uploadVideo`：上传视频（本地校验 → 未迁移）。
async fn upload_video(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> ApiResult<UploadVideoInfoVO> {
    let mut payload: Option<(Option<String>, Option<String>, Vec<u8>)> = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "文件不能为空: {e}"
        )))
    })? {
        if field.name() != Some("file") {
            continue;
        }
        let file_name = field.file_name().map(ToString::to_string);
        let content_type = field.content_type().map(ToString::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "文件不能为空: {e}"
                )))
            })?
            .to_vec();
        payload = Some((file_name, content_type, bytes));
        break;
    }
    let Some((file_name, content_type, bytes)) = payload else {
        return Err(AppError(tigshop_core::Error::Validation(
            tigshop_core::models::content::gallery_video_info::MSG_FILE_EMPTY.into(),
        )));
    };
    ok(state
        .content
        .gallery_video_info
        .upload_video(file_name.as_deref(), content_type.as_deref(), &bytes)
        .await?)
}

/// `POST /adminapi/setting/galleryVideoInfo/create`：保存视频信息。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<GalleryVideoInfoDTO>,
) -> ApiResult<i32> {
    let scope = resolve_scope(&headers);
    ok(state
        .content
        .gallery_video_info
        .create(scope, auth.id, &dto)
        .await?)
}

/// `POST /adminapi/setting/galleryVideoInfo/update`：修改视频信息。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryVideoInfoDTO>,
) -> ApiResult<()> {
    state.content.gallery_video_info.update(&dto).await?;
    ok(())
}

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 解析租户范围（content 素材：**店铺身份只信任认证中间件**）。
///
/// 平台账号 → [`VideoScope::unscoped`]（不加店铺条件）；店铺账号 →
/// [`VideoScope::shop`]（列表 `(shop_id = 0 OR shop_id = ?)`）；供应商账号
/// 仍按既有 `x-vendor-id` 请求头（不在本次店铺隔离范围）。
#[must_use]
pub fn resolve_scope(headers: &HeaderMap) -> VideoScope {
    if header_str(headers, "x-admin-type").as_deref() == Some("vendor") {
        let vendor_id = header_str(headers, "x-vendor-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(-1);
        return VideoScope::vendor(vendor_id);
    }
    match TenantScope::current_list_filter() {
        Some(shop_id) => VideoScope::shop(shop_id),
        None => VideoScope::unscoped(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

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
        assert_eq!(docs.len(), 6);
        let expected = [
            ("GET", "/adminapi/setting/galleryVideoInfo/list"),
            ("POST", "/adminapi/setting/galleryVideoInfo/del"),
            ("POST", "/adminapi/setting/galleryVideoInfo/uploadVideo"),
            ("POST", "/adminapi/setting/galleryVideoInfo/create"),
            ("POST", "/adminapi/setting/galleryVideoInfo/update"),
            ("GET", "/adminapi/setting/galleryVideoInfo/detail"),
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
        assert_eq!(ROUTE_TABLE.len(), 6);
        for (i, (_, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                p.starts_with("/setting/galleryVideoInfo/"),
                "路径前缀错误: {p}"
            );
            for (_, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!(p, p2, "重复路由声明会导致 merge panic");
            }
        }
    }

    #[tokio::test]
    async fn scope_uses_trusted_identity() {
        // 无 task-local = 平台语义 → 不过滤；伪造 shop 头无效
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "admin")])),
            VideoScope::unscoped()
        );
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            VideoScope::unscoped()
        );
        // 店铺身份（task-local）→ 本店过滤
        let scope = tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope(
            TenantScope::for_shop(9),
            async { resolve_scope(&headers(&[("x-admin-type", "shop")])) },
        )
        .await;
        assert_eq!(scope, VideoScope::shop(9));
        // 供应商仍按 x-vendor-id
        assert_eq!(
            resolve_scope(&headers(&[
                ("x-admin-type", "vendor"),
                ("x-vendor-id", "7")
            ])),
            VideoScope::vendor(7)
        );
        assert_eq!(resolve_scope(&HeaderMap::new()), VideoScope::unscoped());
    }
}
