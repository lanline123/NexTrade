//! 管理端 app 版本管理路由（system::app_version_admin）。
//! 对应原 Java `com.tigshop.adminapi.controller.setting.AppVersionController`
//! （`@RequestMapping("/adminapi/setting/appVersion")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('appVersionManage')")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/setting/appVersion/detail` | `AppVersionController.getDetail` | `appVersionManage` |
//! | `POST /adminapi/setting/appVersion/update` | `AppVersionController.update` | `appVersionUpdateManage` |
//! | `POST /adminapi/setting/appVersion/uploadFile` | `AppVersionController.uploadFile` | `appVersionUpdateManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在类级 / 方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs 的已知缺口一致）。
//!
//! > **返回结构说明**：Java `getDetail` 直接返回 `AppVersionDetailVO`、`update` 返回
//! > `void`、`uploadFile` 返回 `AjaxResult<String>`；Rust 统一 `ok(...)` 包装
//! > （`update` 按项目既有约定回传提示文案），`config` 中缺失的配置项为 `null`。
//!
//! > **未迁移**：`uploadFile` 依赖本地存储 / OSS / COS / 七牛 / S3 五套对象存储服务，
//! > 本移植版未接通，接口返回明确的业务错误（HTTP 200 + `code=500` 业务码，文案说明
//! > 对象存储未迁移），**不伪造**上传结果。
//!
//! 服务层实现见 [`tigshop_services::system::app_version_admin::AppVersionAdminService`]。

use axum::{
    extract::{Multipart, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::system::app_version_admin::{AppVersionDetailVO, AppVersionEditParam};
use tigshop_core::{Error, Result};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/appVersion/detail", get(app_version_detail))
        .route("/setting/appVersion/update", post(app_version_update))
        .route(
            "/setting/appVersion/uploadFile",
            post(app_version_upload_file),
        )
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/appVersion/detail",
            "AppVersionController.getDetail",
        ),
        (
            "POST",
            "/adminapi/setting/appVersion/update",
            "AppVersionController.update",
        ),
        (
            "POST",
            "/adminapi/setting/appVersion/uploadFile",
            "AppVersionController.uploadFile",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/setting/appVersion/detail`：APP 版本详情。
///
/// 对应 Java `AppVersionController.getDetail()`（无参数）→
/// `AppVersionServiceImpl#getDetail`：读 `config` 表 `androidVersion` /
/// `iosVersion` / `iosLink` / `androidLink` 四项，缺失项为 `null`。
async fn app_version_detail(State(state): State<AdminState>) -> ApiResult<AppVersionDetailVO> {
    ok(state.system.app_version_admin.detail().await?)
}

/// `POST /adminapi/setting/appVersion/update`：更新 APP 版本配置。
///
/// 对应 Java `AppVersionController.update(@RequestBody @Validated AppVersionEditParam)`。
/// Java 返回 `void`（原实现同时写 `admin_log`，本移植版不写），
/// 此处按项目既有约定返回提示文案。
async fn app_version_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<AppVersionEditParam>,
) -> ApiResult<&'static str> {
    state
        .system
        .app_version_admin
        .update(&param, Some(i64::from(auth.id)), &auth.username)
        .await?;
    ok("更新成功")
}

/// `POST /adminapi/setting/appVersion/uploadFile`：上传 APP 更新包（`multipart/form-data`）。
///
/// 对应 Java `AppVersionController.uploadFile(@RequestParam("file") MultipartFile file)`
/// → `AppVersionServiceImpl#upload`。**未迁移**：对象存储服务（本地 / OSS / COS /
/// 七牛 / S3）本移植版均未接通，返回明确业务错误而不返回伪造 URL。
async fn app_version_upload_file(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> ApiResult<String> {
    let form = read_upload_file(&mut multipart).await?;
    ok(state
        .system
        .app_version_admin
        .upload_file(form.file_name.as_deref(), &form.bytes)?)
}

/// 上传表单中 `file` 字段的解析结果（对应 Java `MultipartFile` 在本切片用到的部分）。
struct UploadForm {
    file_name: Option<String>,
    bytes: Vec<u8>,
}

/// 读取 `multipart/form-data` 的 `file` 字段
/// （对应 Java `@RequestParam("file") MultipartFile`）。
async fn read_upload_file(multipart: &mut Multipart) -> Result<UploadForm> {
    let mut form = UploadForm {
        file_name: None,
        bytes: Vec::new(),
    };
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            form.file_name = field.file_name().map(str::to_string);
            form.bytes = field
                .bytes()
                .await
                .map_err(|e| Error::Validation(format!("读取上传文件失败: {e}")))?
                .to_vec();
        }
    }
    Ok(form)
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_account_is_rejected_by_platform_guard() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert!(require_platform(&admin).is_ok());
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(require_platform(&shop).is_err());
        assert_eq!(shop.scoped_shop_id(), Some(7));
        assert_eq!(admin.scoped_shop_id(), None);
    }
}
