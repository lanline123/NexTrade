//! 管理端会员等级路由（member::user_rank）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.UserRankController`
//! （`@RequestMapping("/adminapi/user/userRank")`，类级 `@Validated`
//! 与 `@PreAuthorize("@pms.hasPermission('userLevelProManage','levelManageManage','userRankManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 额外权限 |
//! |----------------------------------|---------|----------|
//! | `GET  /user/userRank/listByPro`   | `UserRankController.listByPro`   | 类级 |
//! | `POST /user/userRank/create`      | `UserRankController.create`      | `userRankModifyManage` |
//! | `GET  /user/userRank/detail`      | `UserRankController.detail`      | 类级 |
//! | `POST /user/userRank/update`      | `UserRankController.update`      | `userRankModifyManage` |
//! | `POST /user/userRank/updateField` | `UserRankController.updateField` | `userRankModifyManage` |
//! | `POST /user/userRank/del`         | `UserRankController.del`         | `userRankModifyManage` |
//! | `POST /user/userRank/batch`       | `UserRankController.batch`       | `userRankModifyManage` |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/user/userRank`
//! （`userRank` 是**小驼峰**，不是 `user_rank`），方法级只有 `/listByPro`
//! 这类短路径，**没有**控制器前缀重复。因此最终路径就是
//! `/adminapi/user/userRank/listByPro`（不是
//! `.../userRank/userRank/listByPro`），与 `docs/api-contract.json` 逐字符一致。
//!
//! # ⚠️ `list` 不在本切片
//!
//! 本域契约里还有 `GET /adminapi/user/userRank/list`（非 Pro 列表），
//! 但它**不在** member::user_rank 的 7 个接口清单内，本文件**不**注册它。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做类级 + 方法级校验；
//! Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! （与 seckill.rs / member_tag_group.rs / area_code.rs 的已知缺口一致）。
//! 上表权限列仅作对照记录，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! # 返回结构说明
//!
//! Java 7 个端点中 5 个返回 `void`、`listByPro` 返回 `Map`、`detail` 返回 VO。
//! Rust 侧统一包在 `ApiResponse` 里：`listByPro` / `detail` 原样返回；
//! 写操作回传可观测的计数/主键（便于前端跳转与运维排障）。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::member::user_rank::{
    BatchDTO, OperateDTO, RankListByProVO, UpdateFieldDTO, UserRankDTO, UserRankDetailVO,
    UserRankEditParam, UserRankListQuery, UserRankListVO,
};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/user/userRank/listByPro",
        "UserRankController.listByPro",
    ),
    ("POST", "/user/userRank/create", "UserRankController.create"),
    ("GET", "/user/userRank/detail", "UserRankController.detail"),
    ("POST", "/user/userRank/update", "UserRankController.update"),
    (
        "POST",
        "/user/userRank/updateField",
        "UserRankController.updateField",
    ),
    ("POST", "/user/userRank/del", "UserRankController.del"),
    ("POST", "/user/userRank/batch", "UserRankController.batch"),
];

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/userRank/listByPro", get(list_by_pro))
        .route("/user/userRank/create", post(create))
        .route("/user/userRank/detail", get(detail))
        .route("/user/userRank/update", post(update))
        .route("/user/userRank/updateField", post(update_field))
        .route("/user/userRank/del", post(del))
        .route("/user/userRank/batch", post(batch))
        .layer(axum::middleware::from_fn(platform_only))
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

// ——————————————————————————————————————————————
// 读取
// ——————————————————————————————————————————————

/// `GET /adminapi/user/userRank/listByPro`：会员等级列表（Pro）。
///
/// 对应 Java `UserRankController.listByPro(UserRankListDTO userRankDto)`。
/// 查询参数是 `UserRankListDTO extends BasePage`
/// （`keyword` / `rankType` / `sortField` / `sortOrder` / `page` / `size`）。
async fn list_by_pro(
    State(state): State<AdminState>,
    Query(q): Query<UserRankListQuery>,
) -> ApiResult<RankListByProVO> {
    ok(state.member.user_rank.list_by_pro(&q).await?)
}

/// `GET /adminapi/user/userRank/detail`：会员等级详情。
///
/// 对应 Java `UserRankController.detail()`（**无**查询参数）。
async fn detail(State(state): State<AdminState>) -> ApiResult<UserRankDetailVO<UserRankListVO>> {
    ok(state.member.user_rank.detail().await?)
}

// ——————————————————————————————————————————————
// 写入
// ——————————————————————————————————————————————

/// `POST /adminapi/user/userRank/create`：新增会员等级。
///
/// 对应 Java `UserRankController.create(@RequestBody UserRankDTO userRank)`。
/// Java 返回 `void`；此处回传新建的**等级主键** `rankId`，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / member_tag / member_tag_group 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<UserRankDTO>,
) -> ApiResult<serde_json::Value> {
    let rank_id = state.member.user_rank.create(&dto).await?;
    ok(serde_json::json!({ "rankId": rank_id }))
}

/// `POST /adminapi/user/userRank/update`：整体更新会员等级。
///
/// 对应 Java `UserRankController.update(@RequestBody @Validated
/// UserRankEditParam param)`。
/// Java 返回 `void`；此处回传固定成功文案。
async fn update(
    State(state): State<AdminState>,
    Json(param): Json<UserRankEditParam>,
) -> ApiResult<&'static str> {
    state.member.user_rank.update(&param).await?;
    ok("更新成功")
}

/// `POST /adminapi/user/userRank/updateField`：更新会员等级单个字段。
///
/// 对应 Java `UserRankController.updateField(@RequestBody UpdateFieldDTO updateField)`
/// → `BaseServiceImpl#updateField(updateField, USER_RANK_FIELDS)`。
/// Java 返回 `void`；此处回传受影响行数。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.member.user_rank.update_field(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/user/userRank/del`：删除会员等级。
///
/// 对应 Java `UserRankController.del(@RequestBody OperateDTO operate)`
/// → `BaseServiceImpl#del(operate.getId())`。
/// Java 返回 `void`；此处回传是否删除成功。
async fn del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    let deleted = state.member.user_rank.del(&dto).await?;
    ok(serde_json::json!({ "deleted": deleted }))
}

/// `POST /adminapi/user/userRank/batch`：批量操作。
///
/// 对应 Java `UserRankController.batch(@RequestBody BatchDTO batch)`
/// → `BaseServiceImpl#batch(batch)`（仅 `type == "del"` 生效）。
/// Java 返回 `void`；此处回传受影响行数。
async fn batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.member.user_rank.batch(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 7 条路由必须与 `docs/api-contract.json` 逐字符一致
    /// （含 `/adminapi` 前缀与小驼峰 `userRank`）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7, "本域应有 7 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/user/userRank/listByPro",
            "POST /adminapi/user/userRank/create",
            "GET /adminapi/user/userRank/detail",
            "POST /adminapi/user/userRank/update",
            "POST /adminapi/user/userRank/updateField",
            "POST /adminapi/user/userRank/del",
            "POST /adminapi/user/userRank/batch",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// `implemented_routes` 里的 Java 引用必须指向 `UserRankController.*`，
    /// 且 handler 名与路径末段一致。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("UserRankController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
        for (_, path, java) in ROUTE_TABLE {
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("UserRankController.{last}"));
        }
    }

    /// 恰好 2 个 GET（`listByPro` / `detail`）、5 个 POST（与 Java 注解一致）。
    #[test]
    fn route_table_http_methods() {
        assert_eq!(ROUTE_TABLE.len(), 7);
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 2, "GET 应为 listByPro 与 detail");
        assert_eq!(ROUTE_TABLE.len() - gets, 5);
    }

    /// 本模块路径**不带** `/adminapi`（由父路由统一挂载），
    /// 且不得写成下划线形式或重复控制器前缀。
    #[test]
    fn route_paths_are_relative_and_camel_case() {
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'), "{p} 应以 / 开头");
            assert!(!p.starts_with("/adminapi"), "{p} 不得自带 /adminapi 前缀");
            assert!(
                p.starts_with("/user/userRank/"),
                "{p} 前缀错误（应是小驼峰 userRank）"
            );
            assert!(!p.contains("user_rank"), "{p} 不得用下划线写法");
            assert!(
                !p.starts_with("/user/userRank/userRank"),
                "{p} 不得重复控制器前缀"
            );
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        for d in implemented_routes() {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
    }

    /// 本切片**不**注册 `list`（非 Pro 列表不在 7 个接口清单内）。
    #[test]
    fn route_table_does_not_register_list() {
        for (_, path, _) in ROUTE_TABLE {
            assert_ne!(path, "/user/userRank/list", "list 不属于本切片");
        }
        let keys: Vec<String> = implemented_routes().iter().map(|d| d.key()).collect();
        assert!(
            !keys.contains(&"GET /adminapi/user/userRank/list".to_string()),
            "本切片不得声明 list：{keys:?}"
        );
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
