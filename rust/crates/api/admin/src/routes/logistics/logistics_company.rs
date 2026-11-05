//! 管理端配送方式配置信息路由（logistics::logistics_company）。
//!
//! 对应原 Java
//! `com.tigshop.adminapi.controller.setting.LogisticsCompanyController`
//! （`@RequestMapping("/adminapi/setting/logisticsCompany")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('logisticsCompanyManage','orderManage',
//! 'posOrder','vendorOrderManage','logisticsCompanyConfigManage',
//! 'shopLogisticsCompanyConfigManage','vendorLogisticsCompanyConfigManage',
//! 'posWorkbench')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 方法级权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------------|
//! | `GET  /setting/logisticsCompany/detail` | `LogisticsCompanyController.detail` | （继承类级） |
//! | `POST /setting/logisticsCompany/create` | `LogisticsCompanyController.create` | `logisticsCompanyUpdateManage` |
//! | `POST /setting/logisticsCompany/update` | `LogisticsCompanyController.update` | `logisticsCompanyUpdateManage` |
//! | `POST /setting/logisticsCompany/del` | `LogisticsCompanyController.del` | `logisticsCompanyDelManage` |
//! | `POST /setting/logisticsCompany/updateField` | `LogisticsCompanyController.updateField` | `logisticsCompanyUpdateManage` |
//! | `POST /setting/logisticsCompany/batch` | `LogisticsCompanyController.batch` | `logisticsCompanyBatchManage` |
//! | `POST /setting/logisticsCompany/syncKdn` | `LogisticsCompanyController.syncKdn` | `logisticsCompanyUpdateManage` |
//! | `POST /setting/logisticsCompany/syncKuaidi100` | `LogisticsCompanyController.syncKuaidi100` | `logisticsCompanyUpdateManage` |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/setting/logisticsCompany`，
//! > 方法级只有 `/detail` 这种短路径，**没有**控制器前缀重复。因此最终路径是
//! > `/adminapi/setting/logisticsCompany/detail`（不是
//! > `.../logisticsCompany/logisticsCompany/detail`），与
//! > `docs/api-contract.json` 逐字符一致。注意 `logisticsCompany` 是
//! > **小驼峰**（不是 `/logistics_company`），必须照抄。
//!
//! > ⚠️ **`list` 不在本切片**：Java `LogisticsCompanyController.list`
//! > （`GET /adminapi/setting/logisticsCompany/list`）虽然属于同一个控制器，
//! > 但**不在本切片的 8 条接口清单内**，因此本模块**不注册**它。
//! > 服务层的 [`tigshop_services::logistics::logistics_company::LogisticsCompanyService::list`] 已完整实现，
//! > 待对应的切片（负责 `list` 的那一片）注册路由时直接复用即可。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在类级 +
//! > 方法级校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 product_manage / order_admin / shop_manage / area_code 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! > **返回结构说明**：Java 这 8 条接口返回 `LogisticsCompanyVO` /
//! > `SyncLogisticsCompanyResultVO` / `void`。Rust 统一包在 `ApiResponse` 里
//! > （`data` 为 VO / 同步结果 / `true` / 新主键）。
//!
//! > **未迁移说明（重要）**：`syncKdn` / `syncKuaidi100` 两条链路依赖本构建
//! > **不具备**的 HTTP 客户端（`tigshop-services` 未声明 `reqwest`）与管理
//! > 日志域（`adminLogService`）。两条路由**仍然注册**（保证契约路径可达、
//! > 覆盖率统计正确），但调用时返回明确的「未迁移」业务错误，
//! > **不会**返回「新增 0 条」的假成功。详见
//! > `tigshop_services::logistics::logistics_company` 模块头。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::logistics::logistics_company::{
    BatchDTO, LogisticsCompanyCreateDTO, LogisticsCompanyUpdateDTO, LogisticsCompanyVO, OperateDTO,
    SyncLogisticsCompanyResultVO, SyncQuery, UpdateFieldDTO,
};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/setting/logisticsCompany/detail",
        "LogisticsCompanyController.detail",
    ),
    (
        "POST",
        "/setting/logisticsCompany/create",
        "LogisticsCompanyController.create",
    ),
    (
        "POST",
        "/setting/logisticsCompany/update",
        "LogisticsCompanyController.update",
    ),
    (
        "POST",
        "/setting/logisticsCompany/del",
        "LogisticsCompanyController.del",
    ),
    (
        "POST",
        "/setting/logisticsCompany/updateField",
        "LogisticsCompanyController.updateField",
    ),
    (
        "POST",
        "/setting/logisticsCompany/batch",
        "LogisticsCompanyController.batch",
    ),
    (
        "POST",
        "/setting/logisticsCompany/syncKdn",
        "LogisticsCompanyController.syncKdn",
    ),
    (
        "POST",
        "/setting/logisticsCompany/syncKuaidi100",
        "LogisticsCompanyController.syncKuaidi100",
    ),
];

/// 配送方式配置信息域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/logisticsCompany/detail", get(detail))
        .route("/setting/logisticsCompany/create", post(create))
        .route("/setting/logisticsCompany/update", post(update))
        .route("/setting/logisticsCompany/del", post(del))
        .route("/setting/logisticsCompany/updateField", post(update_field))
        .route("/setting/logisticsCompany/batch", post(batch))
        .route("/setting/logisticsCompany/syncKdn", post(sync_kdn))
        .route(
            "/setting/logisticsCompany/syncKuaidi100",
            post(sync_kuaidi100),
        )
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
    /// 物流公司主键（`logistics_id`）
    id: Option<i32>,
}

/// `GET /adminapi/setting/logisticsCompany/detail?id=`：物流公司详情。
///
/// 对应 Java `LogisticsCompanyController.detail(@RequestParam Integer id)`
/// → `LogisticsCompanyServiceImpl#detail`。
///
/// Java 在 `id == null` 时返回 `null` 体、记录不存在时返回全 null 的 VO
/// （不抛异常）；本实现分别返回 400 / 404（项目内 order_admin/005/017/075
/// 的既有约定，见 `uncertain_points`）。
///
/// ⚠️ 返回的 VO 不含 `isBound`（Java 只在 `list` 里 set 它，
/// 因此 `detail` 的 JSON 里该字段恒为 `null`）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<LogisticsCompanyVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.logistics.logistics_company.detail(id).await?)
}

/// `POST /adminapi/setting/logisticsCompany/create`：创建物流公司。
///
/// 对应 Java `LogisticsCompanyController.create(@RequestBody
/// LogisticsCompanyCreateDTO createDTO)` → `LogisticsCompanyServiceImpl#create`。
///
/// Java 返回 `void`；此处回传 `{ "id": <新主键> }`，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<LogisticsCompanyCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state.logistics.logistics_company.create(&dto).await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/setting/logisticsCompany/update`：更新物流公司。
///
/// 对应 Java `LogisticsCompanyController.update(@RequestBody
/// LogisticsCompanyUpdateDTO updateDTO)` → `LogisticsCompanyServiceImpl#update`。
/// Java 返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<LogisticsCompanyUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.logistics.logistics_company.update(&dto).await?)
}

/// `POST /adminapi/setting/logisticsCompany/del`：删除物流公司（**硬删除**）。
///
/// 对应 Java `LogisticsCompanyController.del(@RequestBody OperateDTO operateDTO)`
/// → `LogisticsCompanyServiceImpl#del` → `BaseServiceImpl#del` → `removeById`
/// （`LogisticsCompany` 实体无 `@TableLogic`，因此是物理 DELETE）。
///
/// ⚠️ Java 删不存在的 id 也返回成功（`removeById` 返回 `false` 但不报错），
/// 本实现保持这一语义，回传删除是否命中。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.logistics.logistics_company.del(&dto).await?)
}

/// `POST /adminapi/setting/logisticsCompany/updateField`：更新单个字段。
///
/// 对应 Java `LogisticsCompanyController.updateField(@RequestBody
/// UpdateFieldDTO updateField)` → `updateField(updateField,
/// LOGISTICS_UPDATE_FIELDS)`，白名单为控制器常量
/// `{is_show, sort_order, status, logistics_code, is_enabled,
/// logistics_name, logistics_desc, kuaidi100_code}`。
///
/// ⚠️ 其中 `status` **不是** `logistics_company` 的真实列，
/// 传它一律得到「字段值不合法」（与 Java 的净结果一致，
/// 见 `models::tigshop_core::models::logistics::logistics_company::resolve_update_field`）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.logistics.logistics_company.update_field(&dto).await?)
}

/// `POST /adminapi/setting/logisticsCompany/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `LogisticsCompanyController.batch(@RequestBody BatchDTO batchDTO)`
/// → `BaseServiceImpl#batch`：`type != "del"` 时**静默返回 `false`**
/// （HTTP 200，不是报错）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.logistics.logistics_company.batch(&dto).await?)
}

/// `POST /adminapi/setting/logisticsCompany/syncKdn`：同步快递鸟物流公司。
///
/// 对应 Java `LogisticsCompanyController.syncKdn(
/// @RequestParam(defaultValue = "true") boolean overwriteName,
/// @RequestParam(defaultValue = "1") int defaultIsEnabled)`
/// → `LogisticsCompanyServiceImpl#syncKdnLogisticsCompanies`。
///
/// ⚠️ 入参是 **query 参数**（不是 body），与 Java 的 `@RequestParam` 一致；
/// 默认值 `true` / `1` 由
/// [`tigshop_core::models::logistics::logistics_company::SyncQuery`] 表达。
///
/// **未迁移**：Java 通过 `HttpClient` 拉取语雀文档接口；本构建的
/// `tigshop-services` 未声明 HTTP 客户端依赖，故返回明确的业务错误
/// （见 `tigshop_services::logistics::logistics_company` 模块头），不会伪造同步结果。
async fn sync_kdn(
    State(state): State<AdminState>,
    Query(q): Query<SyncQuery>,
) -> ApiResult<SyncLogisticsCompanyResultVO> {
    ok(state.logistics.logistics_company.sync_kdn(&q).await?)
}

/// `POST /adminapi/setting/logisticsCompany/syncKuaidi100`：同步快递100物流公司。
///
/// 对应 Java `LogisticsCompanyController.syncKuaidi100(
/// @RequestParam(defaultValue = "true") boolean overwriteName,
/// @RequestParam(defaultValue = "1") int defaultIsEnabled)`
/// → `LogisticsCompanyServiceImpl#syncKuaidi100LogisticsCompanies`。
///
/// **未迁移**：种子（内置常见承运商）已就绪且决策逻辑已单测覆盖，
/// 但链路末尾依赖未迁移的管理日志域，故返回明确的业务错误。
async fn sync_kuaidi100(
    State(state): State<AdminState>,
    Query(q): Query<SyncQuery>,
) -> ApiResult<SyncLogisticsCompanyResultVO> {
    ok(state.logistics.logistics_company.sync_kuaidi100(&q).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 8 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8);

        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/setting/logisticsCompany/detail",
                "/setting/logisticsCompany/create",
                "/setting/logisticsCompany/update",
                "/setting/logisticsCompany/del",
                "/setting/logisticsCompany/updateField",
                "/setting/logisticsCompany/batch",
                "/setting/logisticsCompany/syncKdn",
                "/setting/logisticsCompany/syncKuaidi100",
            ]
        );

        // `logisticsCompany` 是小驼峰，绝不能写成 `/logistics_company`
        for p in &paths {
            assert!(p.starts_with("/setting/logisticsCompany/"), "{p} 前缀错误");
            assert!(!p.contains("/logistics_company"), "{p} 不得用下划线写法");
        }

        // 拼上 `/adminapi` 前缀后与 Java `@RequestMapping` 一致
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }

        // 控制器前缀**没有**重复（对照 product_manage 的 `/product/product/...`）
        for p in &paths {
            assert!(
                !p.starts_with("/setting/logisticsCompany/logisticsCompany"),
                "{p} 不应出现控制器前缀重复"
            );
        }
    }

    /// `list` 属于同一 Java 控制器但**不在本切片**的 8 条清单内，不得注册。
    #[test]
    fn list_is_not_registered_in_this_slice() {
        for (_, path, _) in ROUTE_TABLE {
            assert_ne!(path, "/setting/logisticsCompany/list");
            assert!(!path.ends_with("/list"), "{path} 不该出现在本切片");
        }
    }

    /// method 与 Java 注解一致：只有 `detail` 是 GET，其余全是 POST。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = path.ends_with("/detail");
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("LogisticsCompanyController."),
                "{path} 缺少 Java 对照"
            );
        }
    }

    /// 契约里 `detail` 是唯一带 query 的 GET；同步两条带 query 的 POST
    /// 参数名与 Java `@RequestParam` 一致（默认值在模型层表达）。
    #[test]
    fn sync_query_param_names_match_java_request_params() {
        let q: SyncQuery =
            serde_json::from_str(r#"{"overwriteName":"false","defaultIsEnabled":"0"}"#).unwrap();
        assert!(!q.overwrite_name());
        assert_eq!(q.default_is_enabled(), 0);

        // 缺省时与 Java defaultValue 一致
        let q: SyncQuery = serde_json::from_str("{}").unwrap();
        assert!(q.overwrite_name());
        assert_eq!(q.default_is_enabled(), 1);
    }
}
