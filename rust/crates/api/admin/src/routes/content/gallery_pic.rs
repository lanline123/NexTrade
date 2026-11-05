//! 管理端相册图片路由（content::gallery_pic）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.GalleryPicController`
//! （`@RequestMapping("/adminapi/setting/galleryPic")`，10 个端点）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `GET  /setting/galleryPic/list` | `list` | `decorate` / `galleryPicManage` |
//! | `POST /setting/galleryPic/del` | `del` | `galleryPicModifyManage` |
//! | `POST /setting/galleryPic/uploadImg` | `uploadImg` | `galleryPicManage` |
//! | `POST /setting/galleryPic/updateField` | `updateField` | `galleryPicModifyManage` |
//! | `GET  /setting/galleryPic/detail` | `detail` | `galleryPicManage` |
//! | `POST /setting/galleryPic/sort` | `sort` | `galleryPicModifyManage` |
//! | `POST /setting/galleryPic/transfer` | `transfer` | `galleryPicModifyManage` |
//! | `POST /setting/galleryPic/batchDel` | `batchDel` | `galleryPicModifyManage` |
//! | `POST /setting/galleryPic/batchDownload` | `batchDownload` | `galleryPicManage` |
//! | `POST /setting/galleryPic/createFromExternal` | `createFromExternal` | `galleryPicManage` |
//!
//! > 多租户 scope 取自 Java `HeaderUtils.getShopId()/getVendorId()`
//! > （`x-admin-type` / `x-shop-id` / `x-vendor-id`），见 [`resolve_scope`]。
//!
//! > `uploadImg` 写本地存储并落库；`batchDownload` 将素材打包为 zip 下载。

use axum::{
    extract::{Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::gallery::GalleryScope;
use tigshop_core::models::content::gallery_pic::{
    GalleryListResVO, GalleryPicBatchDTO, GalleryPicDTO, GalleryPicExternalDTO,
    GalleryPicListQuery, GalleryPicSortDTO, GalleryPicTransferDTO, GalleryPicUploadVO, OperateDTO,
    UpdateFieldDTO, ERR_ID_REQUIRED, ERR_UPLOAD_FILE_EMPTY,
};
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::download_response::zip_response;
use crate::AdminState;

/// 本域全部 10 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
const ROUTE_TABLE: [(&str, &str, &str); 10] = [
    (
        "GET",
        "/setting/galleryPic/list",
        "GalleryPicController.list",
    ),
    (
        "POST",
        "/setting/galleryPic/del",
        "GalleryPicController.del",
    ),
    (
        "POST",
        "/setting/galleryPic/uploadImg",
        "GalleryPicController.uploadImg",
    ),
    (
        "POST",
        "/setting/galleryPic/updateField",
        "GalleryPicController.updateField",
    ),
    (
        "GET",
        "/setting/galleryPic/detail",
        "GalleryPicController.detail",
    ),
    (
        "POST",
        "/setting/galleryPic/sort",
        "GalleryPicController.sort",
    ),
    (
        "POST",
        "/setting/galleryPic/transfer",
        "GalleryPicController.transfer",
    ),
    (
        "POST",
        "/setting/galleryPic/batchDel",
        "GalleryPicController.batchDel",
    ),
    (
        "POST",
        "/setting/galleryPic/batchDownload",
        "GalleryPicController.batchDownload",
    ),
    (
        "POST",
        "/setting/galleryPic/createFromExternal",
        "GalleryPicController.createFromExternal",
    ),
];

/// 相册图片路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/galleryPic/list", get(list))
        .route("/setting/galleryPic/del", post(del))
        .route("/setting/galleryPic/uploadImg", post(upload_img))
        .route("/setting/galleryPic/updateField", post(update_field))
        .route("/setting/galleryPic/detail", get(detail))
        .route("/setting/galleryPic/sort", post(sort))
        .route("/setting/galleryPic/transfer", post(transfer))
        .route("/setting/galleryPic/batchDel", post(batch_del))
        .route("/setting/galleryPic/batchDownload", post(batch_download))
        .route(
            "/setting/galleryPic/createFromExternal",
            post(create_from_external),
        )
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

// ——————————————————————————————————————————————
// 多租户 scope（复刻 Java `HeaderUtils`）
// ——————————————————————————————————————————————

fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 复刻 Java `HeaderUtils.getAdminType()`：`x-admin-type`；`shop` + `x-shop-type`
/// `2`/`3` 分别归一为 `store`/`pickup`（不影响 `getShopId()` 判定）。
fn admin_type(headers: &HeaderMap) -> Option<String> {
    let raw = header_str(headers, "x-admin-type");
    match raw.as_deref() {
        Some("shop") => match header_str(headers, "x-shop-type").as_deref() {
            Some("2") => Some("store".to_string()),
            Some("3") => Some("pickup".to_string()),
            _ => raw,
        },
        _ => raw,
    }
}

/// 解析当前请求多租户范围（content 素材：**身份只信任认证中间件**）。
///
/// `shop_id` 取域路由中间件写入的 [`TenantScope`]（平台 → `None` 不过滤；
/// 店铺 → `Some(本店)`，列表条件 `(shop_id = 0 OR shop_id = ?)`），
/// 忽略客户端可伪造的 `x-admin-type` / `x-shop-id`。
/// `vendor_id` 供应商上下文仍按既有 `x-vendor-id`（不在本次店铺隔离范围）。
#[must_use]
pub fn resolve_scope(headers: &HeaderMap) -> GalleryScope {
    let shop_id = TenantScope::current_list_filter();
    let vendor_id = if admin_type(headers).as_deref() == Some("vendor") {
        header_str(headers, "x-vendor-id").and_then(|v| v.trim().parse::<i32>().ok())
    } else {
        None
    };
    GalleryScope { shop_id, vendor_id }
}

// ——————————————————————————————————————————————
// handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/setting/galleryPic/list`：相册图片列表。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<GalleryPicListQuery>,
) -> ApiResult<GalleryListResVO> {
    let scope = resolve_scope(&headers);
    ok(state.content.gallery_pic.list(scope, &q).await?)
}

/// `POST /adminapi/setting/galleryPic/del`：删除图片。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<()> {
    state.content.gallery_pic.del(&dto).await?;
    ok(())
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UploadQuery {
    /// Java `@RequestParam(defaultValue = "0") galleryId`
    gallery_id: Option<i32>,
}

/// `POST /adminapi/setting/galleryPic/uploadImg`：上传图片（multipart `file`）。
///
/// 完成本地校验后写入全局存储（OSS/本地）并落库。
async fn upload_img(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<UploadQuery>,
    mut multipart: Multipart,
) -> ApiResult<GalleryPicUploadVO> {
    let mut payload: Option<(Option<String>, Option<String>, Vec<u8>)> = None;
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "文件不能为空: {e}"
        )))
    })? {
        if field.name() != Some("file") {
            continue;
        }
        let content_type = field.content_type().map(ToString::to_string);
        let file_name = field.file_name().map(ToString::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "文件不能为空: {e}"
                )))
            })?
            .to_vec();
        payload = Some((content_type, file_name, bytes));
        break;
    }
    let Some((content_type, file_name, bytes)) = payload else {
        return Err(AppError(tigshop_core::Error::Validation(
            ERR_UPLOAD_FILE_EMPTY.into(),
        )));
    };
    let size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    // 多租户：上传播落店铺取认证身份（店铺→本店；平台→请求缺省 0），
    // 不再信任客户端可伪造的 `x-shop-id`。
    let shop_id = TenantScope::current().write_shop_id(None)?;
    ok(state
        .content
        .gallery_pic
        .upload_img(
            q.gallery_id,
            content_type.as_deref(),
            size,
            file_name.as_deref(),
            &bytes,
            shop_id,
            auth.id,
        )
        .await?)
}

/// `POST /adminapi/setting/galleryPic/updateField`：更新字段（白名单 pic_name）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    state.content.gallery_pic.update_field(&dto).await?;
    ok(())
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PicIdQuery {
    id: Option<i32>,
}

/// `GET /adminapi/setting/galleryPic/detail`：图片详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<PicIdQuery>,
) -> ApiResult<Option<GalleryPicDTO>> {
    if q.id.is_none() {
        return Err(AppError(tigshop_core::Error::Validation(
            ERR_ID_REQUIRED.into(),
        )));
    }
    ok(state.content.gallery_pic.detail(q.id).await?)
}

/// `POST /adminapi/setting/galleryPic/sort`：图片手动排序。
async fn sort(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryPicSortDTO>,
) -> ApiResult<()> {
    state.content.gallery_pic.sort(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/galleryPic/transfer`：批量移动素材。
async fn transfer(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryPicTransferDTO>,
) -> ApiResult<()> {
    state.content.gallery_pic.transfer(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/galleryPic/batchDel`：批量删除素材。
async fn batch_del(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryPicBatchDTO>,
) -> ApiResult<()> {
    state.content.gallery_pic.batch_del(&dto).await?;
    ok(())
}

/// `POST /adminapi/setting/galleryPic/batchDownload`：批量下载素材（未迁移，明确报错）。
async fn batch_download(
    State(state): State<AdminState>,
    Json(dto): Json<GalleryPicBatchDTO>,
) -> Result<axum::response::Response, AppError> {
    let (file_name, bytes) = state.content.gallery_pic.batch_download(&dto).await?;
    Ok(zip_response(bytes, &file_name))
}

/// `POST /adminapi/setting/galleryPic/createFromExternal`：外部直链创建图片。
async fn create_from_external(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<GalleryPicExternalDTO>,
) -> ApiResult<GalleryPicUploadVO> {
    let scope = resolve_scope(&headers);
    ok(state
        .content
        .gallery_pic
        .create_from_external(&dto, scope, Some(auth.id))
        .await?)
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

    /// `implemented_routes()` 必须与 Java 契约逐字符一致（10 条）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let expected = [
            ("GET", "/adminapi/setting/galleryPic/list"),
            ("POST", "/adminapi/setting/galleryPic/del"),
            ("POST", "/adminapi/setting/galleryPic/uploadImg"),
            ("POST", "/adminapi/setting/galleryPic/updateField"),
            ("GET", "/adminapi/setting/galleryPic/detail"),
            ("POST", "/adminapi/setting/galleryPic/sort"),
            ("POST", "/adminapi/setting/galleryPic/transfer"),
            ("POST", "/adminapi/setting/galleryPic/batchDel"),
            ("POST", "/adminapi/setting/galleryPic/batchDownload"),
            ("POST", "/adminapi/setting/galleryPic/createFromExternal"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), expected.len(), "契约中本域共 10 条接口");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
            assert_eq!(doc.key(), format!("{method} {path}"));
        }
        let mut unique: Vec<String> = docs.iter().map(RouteDoc::key).collect();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), docs.len(), "implemented_routes() 存在重复项");
    }

    /// `routes()` 注册路径必须与 [`ROUTE_TABLE`] 完全一致（10/10）。
    #[test]
    fn routes_registers_all_table_paths() {
        let registered = [
            "/setting/galleryPic/list",
            "/setting/galleryPic/del",
            "/setting/galleryPic/uploadImg",
            "/setting/galleryPic/updateField",
            "/setting/galleryPic/detail",
            "/setting/galleryPic/sort",
            "/setting/galleryPic/transfer",
            "/setting/galleryPic/batchDel",
            "/setting/galleryPic/batchDownload",
            "/setting/galleryPic/createFromExternal",
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

    /// 路径表前缀/方法/唯一性。
    #[test]
    fn route_table_is_unique_and_prefixed() {
        for (i, (method, path, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(path.starts_with("/setting/galleryPic/"), "前缀错误: {path}");
            assert!(*method == "GET" || *method == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 多租户 scope 解析：店铺维度只信任认证身份（task-local），忽略伪造头。
    #[tokio::test]
    async fn scope_resolution_uses_trusted_identity() {
        // 无 task-local = 平台语义 → 不过滤
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            GalleryScope {
                shop_id: None,
                vendor_id: None
            }
        );
        // 伪造 shop 头不生效（无 task-local）
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])).shop_id,
            None
        );
        // 店铺身份（task-local）→ 本店过滤
        let scope = tigshop_infrastructure::db::repo::marketing::tenant::with_tenant_scope(
            TenantScope::for_shop(9),
            async { resolve_scope(&headers(&[("x-admin-type", "shop")])) },
        )
        .await;
        assert_eq!(scope.shop_id, Some(9));
        // 供应商上下文仍取 x-vendor-id
        assert_eq!(
            resolve_scope(&headers(&[
                ("x-admin-type", "vendor"),
                ("x-vendor-id", "7"),
            ]))
            .vendor_id,
            Some(7)
        );
        assert_eq!(
            resolve_scope(&headers(&[])),
            GalleryScope {
                shop_id: None,
                vendor_id: None
            }
        );
    }

    /// 查询参数按 Java 名（camelCase）解析。
    #[test]
    fn query_params_accept_java_names() {
        let q: GalleryPicListQuery = serde_json::from_str(
            r#"{"galleryId":3,"format":"jpg","source":"external","keyword":"图","page":2,"size":20,"sortField":"picName","sortOrder":"manual"}"#,
        )
        .unwrap();
        assert_eq!(q.gallery_id, Some(3));
        assert_eq!(q.format.as_deref(), Some("jpg"));
        assert_eq!(q.source.as_deref(), Some("external"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.sort_order.as_deref(), Some("manual"));

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"pic_name","val":"新名字"}"#).unwrap();
        assert_eq!(dto.field, "pic_name");

        let dto: GalleryPicExternalDTO = serde_json::from_str(
            r#"{"picUrl":"https://x/a.png","galleryId":2,"source":"external"}"#,
        )
        .unwrap();
        assert_eq!(dto.gallery_id, Some(2));
    }
}
