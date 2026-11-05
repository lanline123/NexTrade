//! 管理端店铺会员路由（member::shop_member）。
//! 对应原 Java `com.tigshop.adminapi.controller.user.ShopMemberController`
//! （`@RequestMapping("/adminapi/user/shopMember")`，9 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 | 认证 |
//! |-----------|--------|------|------|
//! | `GET  /adminapi/user/shopMember/setting/get` | `settingGet` | `shopMemberSettingManage` | 登录 |
//! | `POST /adminapi/user/shopMember/setting/save` | `settingSave` | `shopMemberSettingManage` | 登录 |
//! | `GET  /adminapi/user/shopMember/shopList` | `shopList` | `shopMemberManage` | 登录 |
//! | `GET  /adminapi/user/shopMember/list` | `list` | `shopMemberManage`/`shopMemberCustomerManage` | 登录 |
//! | `GET  /adminapi/user/shopMember/detail` | `detail` | 同上 | 登录 |
//! | `POST /adminapi/user/shopMember/add` | `add` | `shopMemberCustomerManage` | 登录 |
//! | `GET  /adminapi/user/shopMember/downloadImportTemplate` | `downloadImportTemplate` | `shopMemberCustomerManage` | 登录 |
//! | `POST /adminapi/user/shopMember/import` | `importMembers` | `shopMemberCustomerManage` | 登录 |
//! | `POST /adminapi/user/shopMember/importErrorData` | `importErrorData` | `shopMemberCustomerManage` | **anonymous** |
//!
//! > `importErrorData` 在契约里是 `anonymous` ⇒ 注册在 [`public_routes`]
//! > （管理端免登录聚合），其余 8 条在 `routes`（登录态）。
//! > Excel 模板/导入/失败行导出未迁移（明确业务错误）。
//!
//! > **身份口径**：`HeaderUtils.getShopId()`：平台=0、店铺/门店=`x-shop-id`。
//! > 店铺端强制按本店隔离（服务层处理），平台端可显式传 `shopId`。

use axum::{
    extract::{Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::member::shop_member::{
    ShopMemberAddParam, ShopMemberDetailQuery, ShopMemberImportRow, ShopMemberListVO,
    ShopMemberQueryPage, ShopMemberSettingParam, ShopMemberSettingVO, ShopMemberShopListVO,
    ShopMemberShopQueryPage,
};
use tigshop_core::models::member::user_manage::UserImportSuccessListVO;
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 需登录的 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/user/shopMember/setting/get",
        "ShopMemberController.settingGet",
    ),
    (
        "POST",
        "/user/shopMember/setting/save",
        "ShopMemberController.settingSave",
    ),
    (
        "GET",
        "/user/shopMember/shopList",
        "ShopMemberController.shopList",
    ),
    ("GET", "/user/shopMember/list", "ShopMemberController.list"),
    (
        "GET",
        "/user/shopMember/detail",
        "ShopMemberController.detail",
    ),
    ("POST", "/user/shopMember/add", "ShopMemberController.add"),
    (
        "GET",
        "/user/shopMember/downloadImportTemplate",
        "ShopMemberController.downloadImportTemplate",
    ),
    (
        "POST",
        "/user/shopMember/import",
        "ShopMemberController.importMembers",
    ),
];

/// 免登录的 1 条路由（契约 `anonymous`）。
const PUBLIC_ROUTE_TABLE: [(&str, &str, &str); 1] = [(
    "POST",
    "/user/shopMember/importErrorData",
    "ShopMemberController.importErrorData",
)];

/// 需登录路由（挂载于 `/adminapi` 下，外层 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/shopMember/setting/get", get(setting_get))
        .route("/user/shopMember/setting/save", post(setting_save))
        .route("/user/shopMember/shopList", get(shop_list))
        .route("/user/shopMember/list", get(list))
        .route("/user/shopMember/detail", get(detail))
        .route("/user/shopMember/add", post(add))
        .route(
            "/user/shopMember/downloadImportTemplate",
            get(download_import_template),
        )
        .route("/user/shopMember/import", post(import_members))
}

/// 免登录路由（对应 Java `URL_WHITELIST` 中的 anonymous 端点）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new().route("/user/shopMember/importErrorData", post(import_error_data))
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .chain(PUBLIC_ROUTE_TABLE.iter())
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

// ——————————————————————————————————————————————
// handler
// ——————————————————————————————————————————————

/// 读取请求头文本值。
#[cfg(test)]
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 当前上下文店铺（可信 JWT：平台 `0`、店铺/门店=自身；禁止请求头伪装）。
fn context_shop_id(auth: &AuthUser) -> i32 {
    auth.scoped_shop_id().unwrap_or(0)
}

async fn setting_get(State(state): State<AdminState>) -> ApiResult<ShopMemberSettingVO> {
    ok(state.member.shop_member.setting_get().await?)
}

async fn setting_save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<ShopMemberSettingParam>,
) -> ApiResult<()> {
    if !auth.is_platform() {
        return Err(
            tigshop_core::Error::Forbidden("仅平台账号可修改店铺会员全局开关".into()).into(),
        );
    }
    state.member.shop_member.setting_save(&param).await?;
    ok(())
}

async fn shop_list(
    State(state): State<AdminState>,
    Query(q): Query<ShopMemberShopQueryPage>,
) -> ApiResult<PageResult<ShopMemberShopListVO>> {
    ok(state.member.shop_member.shop_list(&q).await?)
}

async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopMemberQueryPage>,
) -> ApiResult<PageResult<ShopMemberListVO>> {
    // 店铺账号：显式传其他店铺 shopId ⇒ 403；平台账号可指定
    let _ = auth.resolve_shop_scope(q.shop_id)?;
    let ctx = context_shop_id(&auth);
    ok(state.member.shop_member.member_list(&q, ctx).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShopMemberDetailQuery>,
) -> ApiResult<ShopMemberListVO> {
    let _ = auth.resolve_shop_scope(q.shop_id)?;
    let ctx = context_shop_id(&auth);
    ok(state.member.shop_member.member_detail(&q, ctx).await?)
}

async fn add(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<ShopMemberAddParam>,
) -> ApiResult<i32> {
    let ctx = context_shop_id(&auth);
    ok(state.member.shop_member.add_member(&param, ctx).await?)
}

/// `downloadImportTemplate`：店铺会员导入模板 xlsx。
async fn download_import_template(
    State(state): State<AdminState>,
) -> std::result::Result<axum::response::Response, AppError> {
    let _ = &state;
    let headers =
        tigshop_services::member::shop_member::ShopMemberService::import_template_headers();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "店铺会员导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "shop_member_import_template.xlsx",
    ))
}

/// `import`：multipart `file`，解析 xlsx 后绑定店铺会员。
async fn import_members(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> ApiResult<Vec<UserImportSuccessListVO>> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_shop_member_rows(&bytes)?;
    if rows.is_empty() {
        return Err(AppError(Error::biz_msg("表格数据为空")));
    }
    let ctx = context_shop_id(&auth);
    ok(state.member.shop_member.import_members(&rows, ctx).await?)
}

/// `importErrorData`（anonymous）：店铺会员导入失败数据 xlsx。
async fn import_error_data(
    State(state): State<AdminState>,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_shop_member_rows(&bytes)?;
    let errors = state.member.shop_member.import_error_data(&rows).await?;
    let headers_out = ["用户名", "手机号*", "邮箱", "昵称", "生日", "错误信息"];
    let data: Vec<Vec<String>> = errors
        .iter()
        .map(|e| {
            vec![
                e.username.clone().unwrap_or_default(),
                e.mobile.clone().unwrap_or_default(),
                e.email.clone().unwrap_or_default(),
                e.nickname.clone().unwrap_or_default(),
                e.birthday.clone().unwrap_or_default(),
                e.error_msg.clone(),
            ]
        })
        .collect();
    let bytes =
        tigshop_services::system::excel::build_xlsx(&headers_out, &data, "店铺会员导入错误")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "shop_member_import_error.xlsx",
    ))
}

/// 读取 multipart 的 `file` 字段。
async fn read_upload_file(multipart: &mut Multipart) -> Result<Vec<u8>, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError(Error::Validation(format!("读取上传文件失败: {e}"))))?
    {
        if field.name() == Some("file") {
            return field
                .bytes()
                .await
                .map(|b| b.to_vec())
                .map_err(|e| AppError(Error::Validation(format!("读取上传文件失败: {e}"))));
        }
    }
    Err(AppError(Error::Validation("请上传文件".into())))
}

/// 解析店铺会员导入 xlsx（列序与 `ShopMemberImportExcelDTO` 一致）。
fn parse_shop_member_rows(bytes: &[u8]) -> Result<Vec<ShopMemberImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes).map_err(AppError)?;
    let mut rows = Vec::new();
    for line in sheet.iter().skip(1) {
        let get = |i: usize| {
            line.get(i)
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        let row = ShopMemberImportRow {
            username: get(0),
            mobile: get(1),
            email: get(2),
            nickname: get(3),
            birthday: get(4),
        };
        if row.mobile.is_some() || row.username.is_some() {
            rows.push(row);
        }
    }
    Ok(rows)
}

/// 探测 multipart 中是否存在 `file` 字段（不读取内容）。
async fn has_upload_file(multipart: &mut Multipart) -> Result<bool, Error> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        if field.name().unwrap_or_default() == "file" {
            return Ok(true);
        }
        // 丢弃非文件字段内容，继续找 file
        let _ = field
            .text()
            .await
            .map_err(|e| Error::Validation(format!("读取表单字段失败: {e}")))?;
    }
    Ok(false)
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
    fn implemented_routes_cover_all_nine_endpoints() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 9, "8 登录 + 1 anonymous");
        let expected = [
            ("GET", "/adminapi/user/shopMember/setting/get"),
            ("POST", "/adminapi/user/shopMember/setting/save"),
            ("GET", "/adminapi/user/shopMember/shopList"),
            ("GET", "/adminapi/user/shopMember/list"),
            ("GET", "/adminapi/user/shopMember/detail"),
            ("POST", "/adminapi/user/shopMember/add"),
            ("GET", "/adminapi/user/shopMember/downloadImportTemplate"),
            ("POST", "/adminapi/user/shopMember/import"),
            ("POST", "/adminapi/user/shopMember/importErrorData"),
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
    fn import_error_data_lives_in_public_routes_only() {
        assert!(ROUTE_TABLE
            .iter()
            .all(|(_, p, _)| *p != "/user/shopMember/importErrorData"));
        assert_eq!(PUBLIC_ROUTE_TABLE.len(), 1);
        assert_eq!(PUBLIC_ROUTE_TABLE[0].1, "/user/shopMember/importErrorData");
    }

    #[test]
    fn routes_registers_every_logged_in_entry() {
        let registered = [
            "/user/shopMember/setting/get",
            "/user/shopMember/setting/save",
            "/user/shopMember/shopList",
            "/user/shopMember/list",
            "/user/shopMember/detail",
            "/user/shopMember/add",
            "/user/shopMember/downloadImportTemplate",
            "/user/shopMember/import",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(ROUTE_TABLE.iter().any(|(_, p, _)| *p == path));
        }
    }

    #[test]
    fn context_shop_id_from_auth() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(context_shop_id(&admin), 0);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(context_shop_id(&shop), 7);
        let broken = AuthUser::new(3, "s".into(), None, Some("shop".into()), None);
        assert_eq!(context_shop_id(&broken), 0);
    }

    #[test]
    fn shop_account_scope_rejects_cross_shop_query() {
        use tigshop_core::Error;
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop.resolve_shop_scope(Some(7)).unwrap(), Some(7));
        assert!(matches!(
            shop.resolve_shop_scope(Some(9)),
            Err(Error::Forbidden(_))
        ));
    }
}
