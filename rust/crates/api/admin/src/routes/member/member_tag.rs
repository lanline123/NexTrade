//! 管理端会员标签管理路由（member::member_tag）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.MemberTagController`
//! （`@RequestMapping("/adminapi/user/memberTag")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('memberTagManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /user/memberTag/listByGroup` | `MemberTagController.listByGroup` | `memberTagManage` |
//! | `POST /user/memberTag/create` | `MemberTagController.create` | `memberTagUpdateManage` |
//! | `POST /user/memberTag/update` | `MemberTagController.update` | `memberTagUpdateManage` |
//! | `POST /user/memberTag/del` | `MemberTagController.del` | `memberTagUpdateManage` |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/user/memberTag`
//! （`memberTag` 是**小驼峰**，不是 `member_tag`），方法级只有
//! `/listByGroup` 这类短路径，**没有**控制器前缀重复。
//! 因此最终路径是 `/adminapi/user/memberTag/listByGroup`
//! （不是 `.../memberTag/memberTag/listByGroup`，也不是 `.../member_tag/...`），
//! 与 `docs/api-contract.json` 逐字符一致。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做类级 + 方法级校验；
//! Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! （与 seckill.rs / order_admin.rs / area_code.rs 的已知缺口一致）。
//! 上表权限列仅作对照记录，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! # 多租户说明（重要）
//!
//! Java 通过 `HeaderUtils.getShopId()` 读**请求头**区分平台与店铺账号
//! （`null` → `0` 平台），并把它作为所有 SQL 的店铺过滤条件。
//! 店铺作用域来自可信 JWT（`AuthUser::scoped_shop_id`）：平台账号固定 `0`，
//! 店铺账号强制本店；列表/写入均按该作用域过滤与归属校验，不信任请求参数。
//!
//! # 返回结构说明
//!
//! - `listByGroup`：Java 返回 `List<MemberTagVO>`，本实现原样返回数组
//!   （**不是** `PageResult`，本接口无分页）
//! - `create`：Java 返回 `void`，此处回传 `{"id": 新主键}` 便于前端跳转
//! - `update`：Java 返回 `void`，此处回传 `true`/`false`
//! - `del`：Java 返回 `void`，此处回传清理计数与删除结果

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::member_tag::{
    MemberTagCreateDTO, MemberTagDelDTO, MemberTagUpdateDTO, MemberTagVO, MSG_GROUP_ID_REQUIRED,
};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域全部 4 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 4] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/user/memberTag/listByGroup",
        "MemberTagController.listByGroup",
    ),
    (
        "POST",
        "/user/memberTag/create",
        "MemberTagController.create",
    ),
    (
        "POST",
        "/user/memberTag/update",
        "MemberTagController.update",
    ),
    ("POST", "/user/memberTag/del", "MemberTagController.del"),
];

/// 会员标签管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/memberTag/listByGroup", get(list_by_group))
        .route("/user/memberTag/create", post(create))
        .route("/user/memberTag/update", post(update))
        .route("/user/memberTag/del", post(del))
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

/// `listByGroup` 的查询参数
/// （Java `@RequestParam Long groupId`，**必填**）。
///
/// ⚠️ `groupId` 声明为 `Option<i64>` 而不是裸 `i64`：裸类型在参数缺失时
/// axum 会返回自己的 400 文案；这里显式判定以复刻 Java
/// `MissingServletRequestParameterException` 的「必填」语义，
/// 并给出可诊断的错误信息。
///
/// ⚠️ 必须带 `rename_all = "camelCase"`：前端按 Java 契约传 `groupId`
/// （Java 是 `@RequestParam Long groupId`），没有这个属性时
/// serde 只认 `group_id`，`?groupId=12` 会被静默解析成 `None`
/// → 接口永远报「groupId 不能为空」。单测
/// `list_by_group_requires_group_id` 专门盯这个回归。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListByGroupQuery {
    /// 标签组 ID（Java `@RequestParam Long groupId`）
    group_id: Option<i64>,
}

/// `GET /adminapi/user/memberTag/listByGroup?groupId=`：查询组下标签列表。
///
/// 对应 Java `MemberTagController.listByGroup(@RequestParam Long groupId)`
/// → `MemberTagServiceImpl#listByGroupId`。
///
/// ⚠️ 标签组不存在（或不属于当前店铺）时返回**空数组**，不是 404
/// —— 这是 Java 的真实行为（`selectList` 匹配不到行即返回空列表），
/// 已在服务层文档与 `uncertain_points` 中记录。
async fn list_by_group(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ListByGroupQuery>,
) -> ApiResult<Vec<MemberTagVO>> {
    let group_id = q
        .group_id
        .ok_or_else(|| tigshop_core::Error::Validation(MSG_GROUP_ID_REQUIRED.into()))?;
    ok(state
        .member
        .member_tag
        .list_by_group(group_id, shop_scope(&auth))
        .await?)
}

/// `POST /adminapi/user/memberTag/create`：新增标签。
///
/// 对应 Java `MemberTagController.create(@Valid @RequestBody MemberTagCreateParam)`
/// → `MemberTagServiceImpl#create`。
///
/// Java 返回 `void`；此处回传 `{"id": 新主键}`，便于前端跳转/刷新
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<MemberTagCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state
        .member
        .member_tag
        .create(&dto, shop_scope(&auth))
        .await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/user/memberTag/update`：更新标签。
///
/// 对应 Java `MemberTagController.update(@Valid @RequestBody MemberTagUpdateParam)`
/// → `MemberTagServiceImpl#update`。
///
/// ⚠️ `MemberTagUpdateParam` **没有** `groupId` 字段：标签不可跨组移动。
/// Java 返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<MemberTagUpdateDTO>,
) -> ApiResult<bool> {
    ok(state
        .member
        .member_tag
        .update(&dto, shop_scope(&auth))
        .await?)
}

/// `POST /adminapi/user/memberTag/del`：删除标签。
///
/// 对应 Java `MemberTagController.del(@RequestBody OperateDTO operateDTO)`
/// → `MemberTagServiceImpl#delTag(operateDTO.getId().longValue())`。
///
/// 语义：先物理删除 `user_member_tag` 关联，再逻辑删除 `member_tag`
/// （`@TableLogic` → `SET is_del = 1`）。Java 返回 `void`；
/// 这里回传 `{"removedLinks": n, "deleted": bool}` 便于运维排查。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<MemberTagDelDTO>,
) -> ApiResult<serde_json::Value> {
    let outcome = state.member.member_tag.del(&dto, shop_scope(&auth)).await?;
    ok(serde_json::json!({
        "removedLinks": outcome.removed_links,
        "deleted": outcome.deleted,
    }))
}

/// 本模块当前使用的店铺 ID。
///
/// Java `currentShopId()` = `HeaderUtils.getShopId() ?? 0`（请求头，平台 0）。
/// 可信租户店铺作用域：平台账号 `0`，店铺账号强制本店（来自 JWT）。
///
/// 禁止使用 query/header 的 `shopId` 作为身份；标签读写均落到该作用域。
fn shop_scope(auth: &AuthUser) -> i32 {
    auth.scoped_shop_id().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 4 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 4);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/user/memberTag/listByGroup",
                "/user/memberTag/create",
                "/user/memberTag/update",
                "/user/memberTag/del",
            ]
        );

        // `memberTag` 是小驼峰，绝不能写成 `/member_tag`
        for p in &paths {
            assert!(p.starts_with("/user/memberTag/"), "{p} 前缀错误");
            assert!(!p.contains("member_tag"), "{p} 不得用下划线写法");
            // 控制器前缀**不重复**
            assert!(
                !p.starts_with("/user/memberTag/memberTag"),
                "{p} 不得重复控制器前缀"
            );
        }

        // 本模块路径不带 `/adminapi`（由父路由统一挂载）
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`），
    /// 与 `docs/api-contract.json` 逐字符一致。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 4);

        let got: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let want: Vec<(String, String)> = vec![
            (
                "GET".to_string(),
                "/adminapi/user/memberTag/listByGroup".to_string(),
            ),
            (
                "POST".to_string(),
                "/adminapi/user/memberTag/create".to_string(),
            ),
            (
                "POST".to_string(),
                "/adminapi/user/memberTag/update".to_string(),
            ),
            (
                "POST".to_string(),
                "/adminapi/user/memberTag/del".to_string(),
            ),
        ];
        assert_eq!(got, want);

        // 每条都必须带 `/adminapi` 前缀
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
    }

    /// method 与 Java 注解一致：只有 `listByGroup` 是 `@GetMapping`。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = path.ends_with("/listByGroup");
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
        // 恰好 1 个 GET、3 个 POST
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 1);
        assert_eq!(ROUTE_TABLE.len() - gets, 3);
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("MemberTagController."),
                "{path} 缺少 Java 对照"
            );
        }
        // handler 名与路径末段一致（Java 方法名 = 路径末段）
        for (_, path, java) in ROUTE_TABLE {
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("MemberTagController.{last}"));
        }
    }

    /// 默认店铺 ID 是平台 0（Java `HeaderUtils.getShopId() ?? 0`）。
    #[test]
    fn shop_scope_uses_trusted_identity() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(shop_scope(&admin), 0);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop_scope(&shop), 7);
        // 店铺账号缺 shop_id → 平台 0（无法越权）
        let broken = AuthUser::new(3, "s".into(), None, Some("shop".into()), None);
        assert_eq!(shop_scope(&broken), 0);
    }
}
