//! 商户管理 —— 管理端路由（merchant::merchant）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.merchant.MerchantController`
//! （`@RequestMapping("/adminapi/merchant/merchant")`，8 个端点）。
//!
//! | method | path（本模块，挂载于 `/adminapi`） | 原 Java |
//! |--------|------------------------------------|---------|
//! | `POST` | `/merchant/merchant/uploadLicense` | `uploadLicense`（multipart） |
//! | `GET`  | `/merchant/merchant/list` | `list` |
//! | `GET`  | `/merchant/merchant/detail?id=` | `detail` |
//! | `POST` | `/merchant/merchant/create` | `create` |
//! | `POST` | `/merchant/merchant/update` | `update` |
//! | `POST` | `/merchant/merchant/del` | `del` |
//! | `POST` | `/merchant/merchant/updateField` | `updateField` |
//! | `POST` | `/merchant/merchant/batch` | `batch` |
//!
//! # uploadLicense 说明
//!
//! Java 该方法做「营业执照水印 + 不入相册 + 对象存储」，Rust 侧水印 / 资源
//! 依赖未迁移，handler 原样调用服务并返回业务错误（501，文案见
//! `MSG_LICENSE_UNAVAILABLE`）；客户端应改用既有文件上传能力后回填
//! `merchantData.businessLicenseImg`。
//!
//! # 权限
//! Java：`list/detail` 仅登录；其余 `merchantModifyManage`。Rust `require_auth`
//! 目前只校验登录态（全局已知缺口）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::merchant::{
    BatchDTO, MerchantCreateDTO, MerchantListQuery, MerchantUpdateDTO, MerchantVO, OperateDTO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, TenantContext};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "POST",
        "/merchant/merchant/uploadLicense",
        "MerchantController.uploadLicense",
    ),
    ("GET", "/merchant/merchant/list", "MerchantController.list"),
    (
        "GET",
        "/merchant/merchant/detail",
        "MerchantController.detail",
    ),
    (
        "POST",
        "/merchant/merchant/create",
        "MerchantController.create",
    ),
    (
        "POST",
        "/merchant/merchant/update",
        "MerchantController.update",
    ),
    ("POST", "/merchant/merchant/del", "MerchantController.del"),
    (
        "POST",
        "/merchant/merchant/updateField",
        "MerchantController.updateField",
    ),
    (
        "POST",
        "/merchant/merchant/batch",
        "MerchantController.batch",
    ),
];

/// 商户管理路由（`/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/merchant/uploadLicense", post(upload_license))
        .route("/merchant/merchant/list", get(list))
        .route("/merchant/merchant/detail", get(detail))
        .route("/merchant/merchant/create", post(create))
        .route("/merchant/merchant/update", post(update))
        .route("/merchant/merchant/del", post(delete))
        .route("/merchant/merchant/updateField", post(update_field))
        .route("/merchant/merchant/batch", post(batch))
}

/// 本域已实现路由（覆盖率统计）。
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: Option<i32>,
}

/// 平台级接口：店铺/供应商账号一律 403（这些数据只允许平台运营管理）。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(())
}

async fn upload_license(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<String> {
    require_platform(&tenant)?;
    ok(state.merchant.merchant.upload_license()?)
}

async fn list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<MerchantListQuery>,
) -> ApiResult<PageResult<MerchantVO>> {
    require_platform(&tenant)?;
    ok(state.merchant.merchant.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<IdQuery>,
) -> ApiResult<MerchantVO> {
    require_platform(&tenant)?;
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.merchant.merchant.detail(id).await?)
}

async fn create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<MerchantCreateDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.merchant.create(&dto).await?;
    ok(())
}

async fn update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<MerchantUpdateDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.merchant.update(&dto).await?;
    ok(())
}

async fn delete(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.merchant.delete(&dto).await?;
    ok(())
}

async fn update_field(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.merchant.update_field(&dto).await?;
    ok(())
}

async fn batch(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    require_platform(&tenant)?;
    state.merchant.merchant.batch(&dto).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn shop() -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(9), None)
    }

    fn vendor() -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(3))
    }

    /// 平台专属接口：店铺/供应商账号被 403 拒绝。
    #[test]
    fn platform_only_guard() {
        assert!(require_platform(&platform()).is_ok());
        assert!(require_platform(&shop()).is_err());
        assert!(require_platform(&vendor()).is_err());
    }

    #[test]
    fn implemented_routes_prefix_adminapi() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);
        for d in &docs {
            assert!(
                d.path.starts_with("/adminapi/merchant/merchant/"),
                "{}",
                d.path
            );
        }
    }
}
