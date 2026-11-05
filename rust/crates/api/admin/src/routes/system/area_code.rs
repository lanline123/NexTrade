//! 管理端区号管理路由（system::area_code）。
//! 对应原 Java `com.tigshop.adminapi.controller.setting.AreaCodeController`
//! （`@RequestMapping("/adminapi/setting/areaCode")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('areaCodeManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /setting/areaCode/list` | `AreaCodeController.list` | `areaCodeManage` |
//! | `GET  /setting/areaCode/detail` | `AreaCodeController.detail` | `areaCodeManage` |
//! | `POST /setting/areaCode/create` | `AreaCodeController.create` | `areaCodeModifyManage` |
//! | `POST /setting/areaCode/update` | `AreaCodeController.update` | `areaCodeModifyManage` |
//! | `POST /setting/areaCode/del` | `AreaCodeController.del` | `areaCodeModifyManage` |
//! | `POST /setting/areaCode/updateField` | `AreaCodeController.updateField` | `areaCodeModifyManage` |
//! | `POST /setting/areaCode/batch` | `AreaCodeController.batch` | `areaCodeModifyManage` |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/setting/areaCode`，
//! > 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复。因此最终路径是
//! > `/adminapi/setting/areaCode/list`（不是 `.../areaCode/areaCode/list`），
//! > 与 `docs/api-contract.json` 逐字符一致。注意 `areaCode` 是**小驼峰**
//! > （不是 `/area_code`），必须照抄。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在类级 +
//! > 方法级校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / shop_manage.rs / pc_cat_floor.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//! > `areaCodeManage`（读）与 `areaCodeModifyManage`（写）的区分同样未落地。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<AreaCodeVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与
//! > product_manage/002/005/010/014/017 一致。
//! > 其余 6 个端点 Java 返回 `void` / `boolean`，Rust 统一包在 `ApiResponse`
//! > 里（`data` 为 `true` / 文案 / 新主键）。
//!
//! > **Java 缺陷复刻说明（重要，勿“顺手修复”）**：
//! > `AreaCodeServiceImpl#checkAreaCode` 的第二次查重拿 `name` 列去比 `code`
//! > 值，且被前一段短路，因此「区号名称已存在」在 Java 里**从未触发**。
//! > 本实现默认复刻这一可观测行为（名称允许重复），
//! > 详见 `tigshop_services::system::area_code` 模块头与 `uncertain_points`。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::system::area_code::{
    AreaCodeEditDTO, AreaCodeListQuery, AreaCodeSaveDTO, AreaCodeVO, BatchDTO, OperateDTO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/setting/areaCode/list", "AreaCodeController.list"),
    (
        "GET",
        "/setting/areaCode/detail",
        "AreaCodeController.detail",
    ),
    (
        "POST",
        "/setting/areaCode/create",
        "AreaCodeController.create",
    ),
    (
        "POST",
        "/setting/areaCode/update",
        "AreaCodeController.update",
    ),
    ("POST", "/setting/areaCode/del", "AreaCodeController.del"),
    (
        "POST",
        "/setting/areaCode/updateField",
        "AreaCodeController.updateField",
    ),
    (
        "POST",
        "/setting/areaCode/batch",
        "AreaCodeController.batch",
    ),
];

/// 区号管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
/// 区号写操作仅平台账号可执行（读接口保持所有后台账号可用）。
fn require_platform(auth: &AuthUser) -> Result<(), AppError> {
    if !auth.is_platform() {
        return Err(AppError(tigshop_core::Error::Forbidden(
            "仅平台账号可修改区号配置".into(),
        )));
    }
    Ok(())
}

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/areaCode/list", get(list))
        .route("/setting/areaCode/detail", get(detail))
        .route("/setting/areaCode/create", post(create))
        .route("/setting/areaCode/update", post(update))
        .route("/setting/areaCode/del", post(del))
        .route("/setting/areaCode/updateField", post(update_field))
        .route("/setting/areaCode/batch", post(batch))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
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

/// `detail` 的查询参数（Java `@RequestParam Integer id`，必填）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 区号主键
    id: Option<i32>,
}

/// `GET /adminapi/setting/areaCode/list`：区号分页。
///
/// 对应 Java `AreaCodeController.list(AreaCodeListDTO dto)`
/// → `AreaCodeServiceImpl#list`。
///
/// 查询参数按 Java `BasePage` 契约：`name` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是项目通用的 `pageSize`）。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<AreaCodeListQuery>,
) -> ApiResult<PageResult<AreaCodeVO>> {
    ok(state.system.area_code.list(&q).await?)
}

/// `GET /adminapi/setting/areaCode/detail?id=`：区号详情。
///
/// 对应 Java `AreaCodeController.detail(@RequestParam Integer id)`
/// → `AreaCodeServiceImpl#detail`。
///
/// Java 在 `id == null` 时返回 `null` 体、记录不存在时抛 NPE；
/// 本实现分别返回 400 / 404（项目内 order_admin/005/017 的既有约定）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<AreaCodeVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.system.area_code.detail(id).await?)
}

/// `POST /adminapi/setting/areaCode/create`：创建区号。
///
/// 对应 Java `AreaCodeController.create(@Valid @RequestBody AreaCodeSaveParam param)`
/// → `AreaCodeServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AreaCodeSaveDTO>,
) -> ApiResult<serde_json::Value> {
    require_platform(&auth)?;
    let id = state.system.area_code.create(&dto).await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/setting/areaCode/update`：更新区号。
///
/// 对应 Java `AreaCodeController.update(@Valid @RequestBody AreaCodeEditParam param)`
/// → `AreaCodeServiceImpl#update`。
/// Java 返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<AreaCodeEditDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.area_code.update(&dto).await?)
}

/// `POST /adminapi/setting/areaCode/del`：删除区号（硬删除）。
///
/// 对应 Java `AreaCodeController.del(@RequestBody OperateDTO operate)`
/// → `AreaCodeServiceImpl#del`（`area_code` 表无软删标记列，就是 `removeById`）。
///
/// ⚠️ Java 删不存在的 id 也返回成功（`removeById` 返回 `false` 但不报错），
/// 本实现保持这一语义，回传删除是否命中。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.area_code.del(&dto).await?)
}

/// `POST /adminapi/setting/areaCode/updateField`：更新单个字段。
///
/// 对应 Java `AreaCodeController.updateField(@RequestBody @Validated
/// UpdateFieldDTO dto)` → `updateField(dto, AREA_CODE_FIELDS)`，
/// 白名单为 `CheckFieldConstants.AREA_CODE_FIELDS`
/// （`{code, name, is_available, is_default}`）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.area_code.update_field(&dto).await?)
}

/// `POST /adminapi/setting/areaCode/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `AreaCodeController.batch(@RequestBody @Validated BatchDTO dto)`
/// → `BaseServiceImpl#batch`：`type != "del"` 时**静默返回 `false`**
/// （HTTP 200，不是报错）。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.area_code.batch(&dto).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 7 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 7);

        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/setting/areaCode/list",
                "/setting/areaCode/detail",
                "/setting/areaCode/create",
                "/setting/areaCode/update",
                "/setting/areaCode/del",
                "/setting/areaCode/updateField",
                "/setting/areaCode/batch",
            ]
        );

        // `areaCode` 是小驼峰，绝不能写成 `/area_code`
        for p in &paths {
            assert!(p.starts_with("/setting/areaCode/"), "{p} 前缀错误");
            assert!(!p.contains("/area_code"), "{p} 不得用下划线写法");
        }

        // 拼上 `/adminapi` 前缀后与 Java `@RequestMapping` 一致
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// method 与 Java 注解一致：只有 `list` / `detail` 是 GET，其余全是 POST。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = path.ends_with("/list") || path.ends_with("/detail");
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("AreaCodeController."),
                "{path} 缺少 Java 对照"
            );
        }
    }
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
