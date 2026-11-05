//! 管理端会员管理路由（member::user_manage）。
//! 对应原 Java `com.tigshop.adminapi.controller.user.UserController`
//! （`@RequestMapping("/adminapi/user/user")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /user/user/list` | `UserController.list` | `userManage` |
//! | `GET  /user/user/detail` | `UserController.detail` | `userManage` |
//! | `POST /user/user/create` | `UserController.create` | `userCreateManage` |
//! | `POST /user/user/update` | `UserController.update` | `userModifyManage` |
//! | `POST /user/user/del` | `UserController.del` | `userDelManage` |
//! | `POST /user/user/updateField` | `UserController.updateField` | `userModifyFieldManage` |
//! | `POST /user/user/batch` | `UserController.batch` | `userBatchManage` |
//! | `POST /user/user/batchImport` | `UserController.batchImport` | `userManage` |
//! | `POST /user/user/getImportErrorData` | `UserController.getImportErrorData` | 契约标记 anonymous |
//! | `GET  /user/user/downloadUserImportTemplate` | `UserController.getImportErrorData`（重载） | `userManage` |
//! | `POST /user/user/search` | `UserController.searchByMobile` | `userManage` |
//! | `POST /user/user/fundManagement` | `UserController.fundManagement` | `fundManagementManage` |
//! | `GET  /user/user/userFundDetail` | `UserController.userFundDetail` | `userManage` |
//! | `POST /user/user/logout` | `UserController.logout` | 契约标记 anonymous |
//! | `POST /user/user/setAdminNote` | `UserController.setAdminNote` | `userModifyManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/user/user` 与包名同名，故出现
//! > `user/user` 重复一段，与 Java `@RequestMapping` 组合结果**逐字符一致**，
//! > 不是笔误。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 product_manage / order_admin / authority 的已知缺口一致）。上表权限列仅作对照记录。
//!
//! > **认证范围说明**：契约把 `logout` 与 `getImportErrorData` 标为 anonymous，
//! > 但本模块经 `routes::merge_all` 合并进 `protected` 子路由，会被
//! > `require_auth` 中间件拦截。这是项目既有的已知差异（主会话统一处理），
//! > 本文件不单独为这两条路径绕过认证。
//!
//! > **返回结构说明**：`list` / `userFundDetail` 原返回 MyBatis-Plus
//! > `Page<T>`（`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`）。
//!
//! > **未迁移端点**：`batchImport` / `getImportErrorData` /
//! > `downloadUserImportTemplate`（Excel）与 `logout`（Redis 令牌吊销）
//! > 返回明确业务错误，不伪造实现，详见 `crates/services/src/user_manage.rs`
//! > 顶部说明与返回 JSON 的 `uncertain_points`。

use axum::{
    extract::Extension,
    extract::{Multipart, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::user_manage::{
    CreateUserParam, FundDetailItem, FundManagementParam, SetAdminNoteParam, UpdateUserParam,
    UserBatchParam, UserCreateVO, UserFundDetailQuery, UserImportRow, UserImportSuccessVO,
    UserItemVO, UserListQuery, UserSearchVO, UserVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 仅平台账号可执行的会员写操作（会员表无 shop 列，写操作统一平台管理）。
fn require_platform(auth: &AuthUser) -> Result<(), AppError> {
    if !auth.is_platform() {
        return Err(AppError(tigshop_core::Error::Forbidden(
            "仅平台账号可执行会员写操作".into(),
        )));
    }
    Ok(())
}

/// 会员管理域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/user/list", get(user_list))
        .route("/user/user/detail", get(user_detail))
        .route("/user/user/create", post(user_create))
        .route("/user/user/update", post(user_update))
        .route("/user/user/del", post(user_del))
        .route("/user/user/updateField", post(user_update_field))
        .route("/user/user/batch", post(user_batch))
        .route("/user/user/batchImport", post(user_batch_import))
        .route(
            "/user/user/getImportErrorData",
            post(user_import_error_data),
        )
        .route(
            "/user/user/downloadUserImportTemplate",
            get(user_download_import_template),
        )
        .route("/user/user/search", post(user_search))
        .route("/user/user/fundManagement", post(user_fund_management))
        .route("/user/user/userFundDetail", get(user_fund_detail))
        .route("/user/user/logout", post(user_logout))
        .route("/user/user/setAdminNote", post(user_set_admin_note))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/adminapi/user/user/list", "UserController.list"),
        ("GET", "/adminapi/user/user/detail", "UserController.detail"),
        (
            "POST",
            "/adminapi/user/user/create",
            "UserController.create",
        ),
        (
            "POST",
            "/adminapi/user/user/update",
            "UserController.update",
        ),
        ("POST", "/adminapi/user/user/del", "UserController.del"),
        (
            "POST",
            "/adminapi/user/user/updateField",
            "UserController.updateField",
        ),
        ("POST", "/adminapi/user/user/batch", "UserController.batch"),
        (
            "POST",
            "/adminapi/user/user/batchImport",
            "UserController.batchImport",
        ),
        (
            "POST",
            "/adminapi/user/user/getImportErrorData",
            "UserController.getImportErrorData",
        ),
        (
            "GET",
            "/adminapi/user/user/downloadUserImportTemplate",
            "UserController.getImportErrorData",
        ),
        (
            "POST",
            "/adminapi/user/user/search",
            "UserController.searchByMobile",
        ),
        (
            "POST",
            "/adminapi/user/user/fundManagement",
            "UserController.fundManagement",
        ),
        (
            "GET",
            "/adminapi/user/user/userFundDetail",
            "UserController.userFundDetail",
        ),
        (
            "POST",
            "/adminapi/user/user/logout",
            "UserController.logout",
        ),
        (
            "POST",
            "/adminapi/user/user/setAdminNote",
            "UserController.setAdminNote",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ————————————————————————— 列表 / 详情 —————————————————————————

/// `GET /adminapi/user/user/list`：会员列表。
///
/// 对应 Java `UserController.list(UserListDTO)`（`GET` 查询参数绑定）。
/// Java 返回 `Page<UserDTO>`，Rust 侧统一为 `PageResult<UserVO>`。
async fn user_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<UserListQuery>,
) -> ApiResult<PageResult<UserVO>> {
    ok(state
        .member
        .user_manage
        .list_scoped(&q, auth.scoped_shop_id())
        .await?)
}

/// `GET /adminapi/user/user/detail?id=`：会员详情。
///
/// 对应 Java `UserController.detail(@RequestParam Integer id)`，
/// 返回 `UserItemVO`（会员信息 + 会员标签）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    /// 会员ID
    id: Option<i32>,
}

async fn user_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<UserItemVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("会员ID不能为空".into()))?;
    state
        .member
        .user_manage
        .ensure_shop_member(id, auth.scoped_shop_id())
        .await?;
    ok(state.member.user_manage.detail(id).await?)
}

// ————————————————————————— 新增 / 更新 / 删除 —————————————————————————

/// `POST /adminapi/user/user/create`：创建会员。
///
/// 对应 Java `UserController.create(@RequestBody UserDTO)`，
/// 返回 `UserCreateVO(userId, username, mobile)`。
async fn user_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<CreateUserParam>,
) -> ApiResult<UserCreateVO> {
    require_platform(&auth)?;
    ok(state.member.user_manage.create_user(&param).await?)
}

/// `POST /adminapi/user/user/update`：更新会员。
///
/// 对应 Java `UserController.update(@RequestBody @Valid UserParam)`（Java 返回 `void`）。
async fn user_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UpdateUserParam>,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    state.member.user_manage.update_user(&param).await?;
    ok("更新成功")
}

/// `POST /adminapi/user/user/del`：删除会员。
///
/// 对应 Java `UserController.del(@RequestBody OperateDTO)` →
/// `userService.del(operate.getId())`（Java 返回 `void`）。
async fn user_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    state.member.user_manage.delete_user(param.id).await?;
    ok("删除成功")
}

/// `POST /adminapi/user/user/updateField`：更新会员单个字段。
///
/// 对应 Java `UserController.updateField(@RequestBody UpdateFieldDTO)` →
/// `userService.updateField(updateField, USER_FIELDS)`，
/// 白名单为 `CheckFieldConstants.USER_FIELDS = {"username", "nickname", "status"}`。
async fn user_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    state
        .member
        .user_manage
        .update_field(param.id, param.field.as_deref(), param.val.as_deref())
        .await?;
    ok("更新成功")
}

// ————————————————————————— 批量操作 —————————————————————————

/// `POST /adminapi/user/user/batch`：批量操作。
///
/// 对应 Java `UserController.batch(@RequestBody UserBatchParam)`，
/// 支持 `setRank` / `del` / `incrPoints` / `incrBalance`；
/// 未识别的类型返回 `false`（与 Java 一致）。
async fn user_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<UserBatchParam>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.member.user_manage.batch(&param).await?)
}

// ————————————————————————— Excel（未迁移） —————————————————————————

/// `POST /adminapi/user/user/batchImport`：批量导入会员。
///
/// 对应 Java `UserController.batchImport(@RequestParam("file") MultipartFile)`。
/// **未迁移**（Excel 解析）：始终返回明确业务错误，不读取上传内容。
async fn user_batch_import(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> ApiResult<Vec<UserImportSuccessVO>> {
    require_platform(&auth)?;
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_user_import_rows(&bytes)?;
    if rows.is_empty() {
        return Err(AppError(Error::biz_msg("表格数据为空")));
    }
    ok(state.member.user_manage.batch_import_users(&rows).await?)
}

/// `POST /adminapi/user/user/getImportErrorData`：获取导入失败的数据。
///
/// 对应 Java `UserController.getImportErrorData(MultipartFile, HttpServletResponse)`。
/// **未迁移**（Excel 解析 + 导出）。
async fn user_import_error_data(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    require_platform(&auth)?;
    let bytes = read_upload_file(&mut multipart).await?;
    let rows = parse_user_import_rows(&bytes)?;
    let errors = state
        .member
        .user_manage
        .get_user_import_error_data(&rows)
        .await?;
    let headers = ["用户名*", "手机号*", "邮箱", "昵称", "错误信息"];
    let data: Vec<Vec<String>> = errors
        .iter()
        .map(|e| {
            vec![
                e.username.clone().unwrap_or_default(),
                e.mobile.clone().unwrap_or_default(),
                e.email.clone().unwrap_or_default(),
                e.nickname.clone().unwrap_or_default(),
                e.error_msg.clone(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &data, "会员导入错误")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "user_import_error.xlsx",
    ))
}

/// `GET /adminapi/user/user/downloadUserImportTemplate`：下载会员导入模板。
///
/// 对应 Java 控制器中与上一条同名的 `getImportErrorData(HttpServletResponse)`
/// 重载（方法名重复是原 Java 代码的既有情况）。
/// **未迁移**（Excel 导出）。
async fn user_download_import_template(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> std::result::Result<axum::response::Response, AppError> {
    require_platform(&auth)?;
    let _ = &state;
    let headers =
        tigshop_services::member::user_manage::UserManageService::import_template_headers();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "会员导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "user_import_template.xlsx",
    ))
}

/// 读取 multipart 中的 `file` 字段。
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

/// 解析会员导入 xlsx（列序与 `UserImportExcelDTO` 一致）。
fn parse_user_import_rows(bytes: &[u8]) -> Result<Vec<UserImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes).map_err(AppError)?;
    let mut rows = Vec::new();
    for line in sheet.iter().skip(1) {
        let get = |i: usize| {
            line.get(i)
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        let row = UserImportRow {
            username: get(0),
            mobile: get(1),
            email: get(2),
            nickname: get(3),
            password: get(4),
            birthday: get(5),
            rank_id: get(6),
            balance: get(7),
            points: get(8),
            growth_points: get(9),
            remark: get(10),
        };
        if row.username.is_some() || row.mobile.is_some() {
            rows.push(row);
        }
    }
    Ok(rows)
}

// ————————————————————————— 搜索 / 资金 / 退出 / 备注 —————————————————————————

/// `POST /adminapi/user/user/search?search=`：会员搜索。
///
/// 对应 Java `UserController.searchByMobile(@RequestParam String search)` →
/// `salesmanService.getUserByMobileOrUsername(search)`（手机号或用户名精确匹配）。
/// Java 声明返回 `void`（响应体恒为 `null`）；此处回传命中结果
/// （`null` 表示未命中），见 `uncertain_points`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SearchQuery {
    /// 手机号或用户名
    search: Option<String>,
}

async fn user_search(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<SearchQuery>,
) -> ApiResult<Option<UserSearchVO>> {
    let found = state
        .member
        .user_manage
        .search_user(q.search.as_deref().unwrap_or_default())
        .await?;
    if let (Some(vo), Some(shop_id)) = (found.as_ref(), auth.scoped_shop_id()) {
        let svc = &state.member.user_manage;
        if svc
            .ensure_shop_member(vo.user_id, Some(shop_id))
            .await
            .is_err()
        {
            return ok(None);
        }
    }
    ok(found)
}

/// `POST /adminapi/user/user/fundManagement`：会员资金管理。
///
/// 对应 Java `UserController.fundManagement(@RequestBody UserFundManagementDTO)`
/// （Java 返回 `void`）。
async fn user_fund_management(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<FundManagementParam>,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    state.member.user_manage.fund_management(&param).await?;
    ok("操作成功")
}

/// `GET /adminapi/user/user/userFundDetail`：资金明细。
///
/// 对应 Java `UserController.userFundDetail(@Validated UserFundDetailPageQuery)`。
/// 按 `fromTag` 分支返回成长值（3）/ 消费积分（4）/ 余额（其他）三类流水，
/// 故元素类型为 [`FundDetailItem`] 联合体。
async fn user_fund_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<UserFundDetailQuery>,
) -> ApiResult<PageResult<FundDetailItem>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        let user_id = q.user_id.ok_or_else(|| {
            AppError(tigshop_core::Error::Forbidden(
                "店铺账号查询资金明细必须指定本店会员".into(),
            ))
        })?;
        state
            .member
            .user_manage
            .ensure_shop_member(user_id, Some(shop_id))
            .await?;
    }
    ok(state.member.user_manage.user_fund_detail(&q).await?)
}

/// `POST /adminapi/user/user/logout`：管理员退出登录。
///
/// 对应 Java `UserController.logout()` → `userService.adminLogout()`
/// （删除 Redis 中的登录令牌）。**未迁移**：Rust 侧无可用的缓存句柄，
/// 服务层返回明确业务错误，不会假装成功。
#[allow(clippy::unused_async)]
async fn user_logout(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: axum::http::HeaderMap,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    if let Some(raw) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    {
        let bare = raw.trim().strip_prefix("Bearer ").unwrap_or(raw.trim());
        if let Ok(claims) = state.jwt.decode(bare) {
            tigshop_security::token_revocation::revoke(bare, claims.exp);
        }
    }
    state.member.user_manage.admin_logout().await?;
    ok("退出成功")
}

/// `POST /adminapi/user/user/setAdminNote`：设置会员备注和标记。
///
/// 对应 Java `UserController.setAdminNote(@RequestBody SetAdminNoteParam)`
/// （Java 返回 `void`）。
async fn user_set_admin_note(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(param): Json<SetAdminNoteParam>,
) -> ApiResult<&'static str> {
    require_platform(&auth)?;
    state.member.user_manage.set_admin_note(&param).await?;
    ok("设置成功")
}

// ————————————————————————— 请求体 DTO（Java common） —————————————————————————

/// 操作参数（对应 Java `com.tigshop.bean.dto.common.OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct OperateDTO {
    /// id
    id: Option<i32>,
}

/// 更新字段信息（对应 Java `com.tigshop.bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UpdateFieldDTO {
    /// id
    id: Option<i32>,
    /// 字段名
    field: Option<String>,
    /// 值
    val: Option<String>,
}
#[cfg(test)]
mod tenant_tests {
    use super::*;

    fn shop_auth() -> AuthUser {
        AuthUser::new(1, "s".into(), None, Some("shop".into()), Some(7))
    }

    fn admin_auth() -> AuthUser {
        AuthUser::new(2, "a".into(), None, Some("admin".into()), Some(0))
    }

    #[test]
    fn platform_only_guard_rejects_shop_account() {
        assert!(require_platform(&shop_auth()).is_err());
        assert!(require_platform(&admin_auth()).is_ok());
    }

    #[test]
    fn shop_scope_forces_own_shop() {
        assert_eq!(shop_auth().scoped_shop_id(), Some(7));
        assert_eq!(admin_auth().scoped_shop_id(), None);
        assert!(shop_auth().resolve_shop_scope(Some(9)).is_err());
    }
}
