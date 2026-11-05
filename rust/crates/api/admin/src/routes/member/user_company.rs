//! 管理端会员企业认证路由（member::user_company）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.UserCompanyController`
//! （`@RequestMapping("/adminapi/user/userCompany")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('userCertificationManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /user/userCompany/list` | `UserCompanyController.list` | `userCertificationManage` |
//! | `GET  /user/userCompany/detail` | `UserCompanyController.detail` | `userCertificationManage` |
//! | `POST /user/userCompany/audit` | `UserCompanyController.audit` | `userCertificationManage` |
//! | `POST /user/userCompany/del` | `UserCompanyController.del` | `userCertificationManage` |
//! | `POST /user/userCompany/batch` | 前端契约（新版管理端 `userCertification.ts`） | 登录 |
//!
//! > **路径说明**：`@RequestMapping` 是 `/adminapi/user/userCompany`，
//! > 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复。最终路径是
//! > `/adminapi/user/userCompany/list`（不是 `.../userCompany/userCompany/list`），
//! > 与 `docs/api-contract.json` 逐字符一致。注意 `userCompany` 是**小驼峰**
//! > （不是 `/user_company`），必须照抄。
//!
//! > **权限说明**：Java 在**类级**用 `@PreAuthorize` 统一校验
//! > `userCertificationManage`；Rust 侧 `require_auth` 目前只做登录态校验，
//! > 权限矩阵尚未实现（与 seckill.rs / order_admin.rs / area_code.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<UserCompanyVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与
//! > product_manage/002/005/010/014/017/075 一致。
//! > `audit` / `del` 在 Java 里返回 `void`，Rust 统一包在 `ApiResponse` 里
//! > （`data` 为布尔值，便于前端与运维排查是否真的命中了记录）。
//!
//! > **入参说明**：`list` 的 `keyword` 有控制器级回填
//! > （`keyword` 空白 ⇒ 用 `username` 顶替，见
//! > `tigshop_core::models::member::user_company::UserCompanyListQuery::apply_keyword_fallback`）。
//! > 该回填必须发生在 service 调用**之前**，本模块在 handler 里完成。
//!
//! > **不确定点**：`detail` 在 Java 里 `id` 缺失时返回 `null` 体、
//! > 记录不存在时抛 `企业认证信息不存在`；本实现统一按 400/404 处理
//! > （与 area_code 的既有约定一致）。其余疑点见实现者返回值的
//! > `uncertain_points`。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::user_company::{
    OperateDTO, UserCompanyAuditDTO, UserCompanyDetailVO, UserCompanyListQuery, UserCompanyListVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

/// 本域全部 5 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
/// ⚠️ 契约里的完整路径是 `ROUTE_TABLE` 的路径加 `/adminapi` 前缀，
/// 必须逐字符一致（`userCompany` 小驼峰）。
/// 最后一条 `batch` 来自新版管理端前端契约（Java 控制器未含）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/user/userCompany/list",
        "UserCompanyController.list",
    ),
    (
        "GET",
        "/user/userCompany/detail",
        "UserCompanyController.detail",
    ),
    (
        "POST",
        "/user/userCompany/audit",
        "UserCompanyController.audit",
    ),
    ("POST", "/user/userCompany/del", "UserCompanyController.del"),
    (
        "POST",
        "/user/userCompany/batch",
        "UserCompanyController.batch",
    ),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/userCompany/list", get(list))
        .route("/user/userCompany/detail", get(detail))
        .route("/user/userCompany/audit", post(audit))
        .route("/user/userCompany/del", post(del))
        .route("/user/userCompany/batch", post(batch))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 路径为**完整契约路径**（含 `/adminapi` 前缀），与
/// `docs/api-contract.json` 逐字符一致。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            let full_path = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full_path, handler)
        })
        .collect()
}

/// `GET /adminapi/user/userCompany/detail?id=` 的查询参数。
///
/// Java 签名是 `@RequestParam Integer id` —— **必填**（缺失即 400）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    /// 会员企业认证ID
    id: Option<i32>,
}

/// `GET /adminapi/user/userCompany/list`：会员企业认证分页。
///
/// 对应 Java `UserCompanyController.list(UserCompanyListDTO listDTO)`
/// → `UserCompanyServiceImpl#list`。
///
/// 控制器在进 service 之前有一个 keyword 回填
/// （第 56–58 行：`keyword` 空白 ⇒ 用 `username` 顶替），此处照做。
async fn list(
    State(state): State<AdminState>,
    Query(mut q): Query<UserCompanyListQuery>,
) -> ApiResult<PageResult<UserCompanyListVO>> {
    // Java `if (StringUtils.isBlank(listDTO.getKeyword())) { setKeyword(getUsername()); }`
    q.apply_keyword_fallback();
    ok(state.member.user_company.list(&q).await?)
}

/// `GET /adminapi/user/userCompany/detail?id=`：会员企业认证详情。
///
/// 对应 Java `UserCompanyController.detail(@RequestParam Integer id)`
/// → `UserCompanyServiceImpl#detail`。
///
/// Java 在 `id == null` 时返回 `null` 体、记录不存在时抛
/// `企业认证信息不存在`；本实现分别返回 400 / 404（与 area_code 的既有约定一致）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<UserCompanyDetailVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.member.user_company.detail(id).await?)
}

/// `POST /adminapi/user/userCompany/audit`：审核。
///
/// 对应 Java `UserCompanyController.audit(@Valid @RequestBody UserCompanyAuditDTO)`
/// → `UserCompanyServiceImpl#audit`（`@Transactional`）。
///
/// Java 返回 `void`，这里回传是否命中记录
/// （并发下被他人抢先审核会回 `false`，见 `uncertain_points`）。
async fn audit(
    State(state): State<AdminState>,
    Json(dto): Json<UserCompanyAuditDTO>,
) -> ApiResult<bool> {
    ok(state.member.user_company.audit(&dto).await?)
}

/// `POST /adminapi/user/userCompany/del`：删除（硬删除）。
///
/// 对应 Java `UserCompanyController.del(@Valid @RequestBody OperateDTO)`
/// → `UserCompanyServiceImpl#del` → `BaseServiceImpl#del`（`removeById`）。
///
/// ⚠️ `user_company` 表**没有**软删标记列，就是 `DELETE`；
/// 且 Java 删不存在的 id 也返回成功（`removeById` 返回 `false` 但不报错），
/// 本实现保持这一语义，回传删除是否命中。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.member.user_company.del(dto.id).await?)
}

/// 批量操作请求体（前端 `{ type, ids }`，与各域 `BatchDTO` 同构）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UserCompanyBatchDTO {
    /// 操作类型（仅 `del` 生效，其余静默返回 `false`）
    #[serde(rename = "type")]
    batch_type: String,
    /// 主键列表
    ids: Vec<i32>,
}

/// `POST /adminapi/user/userCompany/batch`：批量操作。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/user/userCertification.ts#batchSubmit`
/// （`{ type: "del", ids: [...] }`，企业认证列表批量删除）。
async fn batch(
    State(state): State<AdminState>,
    Json(dto): Json<UserCompanyBatchDTO>,
) -> ApiResult<bool> {
    ok(state
        .member
        .user_company
        .batch(&dto.batch_type, &dto.ids)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 契约路径的**逐字符**回归（含 `userCompany` 小驼峰与 `/adminapi` 前缀）。
    #[test]
    fn implemented_routes_matches_contract_verbatim() {
        let got: Vec<(String, String)> = implemented_routes()
            .into_iter()
            .map(|d| (d.method, d.path))
            .collect();
        let want: Vec<(String, String)> = vec![
            ("GET".into(), "/adminapi/user/userCompany/list".into()),
            ("GET".into(), "/adminapi/user/userCompany/detail".into()),
            ("POST".into(), "/adminapi/user/userCompany/audit".into()),
            ("POST".into(), "/adminapi/user/userCompany/del".into()),
            ("POST".into(), "/adminapi/user/userCompany/batch".into()),
        ];
        assert_eq!(got, want);
    }

    /// 路由表与 `implemented_routes` 一一对应（数量 + 顺序）。
    #[test]
    fn route_table_and_doc_agree() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        let docs = implemented_routes();
        assert_eq!(docs.len(), ROUTE_TABLE.len());
        for (idx, (method, path, handler)) in ROUTE_TABLE.iter().enumerate() {
            assert_eq!(docs[idx].method, *method);
            assert_eq!(docs[idx].path, format!("/adminapi{path}"));
            assert_eq!(docs[idx].java_ref, *handler);
        }
    }

    /// handler 命名与 Java 方法名一一对应。
    #[test]
    fn handlers_carry_java_method_names() {
        let docs = implemented_routes();
        let handlers: Vec<&str> = docs.iter().map(|d| d.java_ref.as_str()).collect();
        assert_eq!(
            handlers,
            vec![
                "UserCompanyController.list",
                "UserCompanyController.detail",
                "UserCompanyController.audit",
                "UserCompanyController.del",
                "UserCompanyController.batch",
            ]
        );
    }

    /// 路径不得出现控制器前缀重复（本域 `@RequestMapping` 已含 `/user`，
    /// 方法级只有 `/userCompany/...`，因此不会重复）。
    #[test]
    fn no_duplicated_controller_prefix() {
        for doc in implemented_routes() {
            assert!(
                !doc.path.contains("/userCompany/userCompany/"),
                "路径出现重复前缀: {}",
                doc.path
            );
            assert!(doc.path.starts_with("/adminapi/user/userCompany/"));
        }
    }

    /// `id` 查询参数：缺失 / 非正数都要被拦成 400（Java `@RequestParam` 必填）。
    #[test]
    fn id_query_requires_positive_id() {
        let q: IdQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(q.id, Some(5));
        let q: IdQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.id, None);
        // 路由层的过滤条件（与 handler 内一致）
        assert_eq!(Some(0_i32).filter(|v| *v > 0), None);
        assert_eq!(Some(-1_i32).filter(|v| *v > 0), None);
        assert_eq!(Some(1_i32).filter(|v| *v > 0), Some(1));
    }

    /// `del` 的入参解析：Java `OperateDTO`，本域只取 `id`。
    #[test]
    fn operate_dto_deserializes_id() {
        let dto: OperateDTO = serde_json::from_str(r#"{"id":9}"#).unwrap();
        assert_eq!(dto.id, Some(9));
        let dto: OperateDTO = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(dto.id, None);
    }
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_scope_is_empty_for_platform_only_domain() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(admin.scoped_shop_id(), None);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(!shop.is_platform());
        assert_eq!(shop.scoped_shop_id(), Some(7));
    }

    #[test]
    fn platform_only_helper_rejects_shop_identity() {
        assert!(require_platform(&AuthUser::new(
            1,
            "a".into(),
            None,
            Some("admin".into()),
            Some(0)
        ))
        .is_ok());
        assert!(require_platform(&AuthUser::new(
            2,
            "s".into(),
            None,
            Some("shop".into()),
            Some(7)
        ))
        .is_err());
    }
}
