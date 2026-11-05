//! 管理端会员标签组管理路由（member::member_tag_group）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.MemberTagGroupController`
//! （`@RequestMapping("/adminapi/user/memberTagGroup")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('memberTagManage')")`，
//! 类上有 `@Validated`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /user/memberTagGroup/detail`    | `MemberTagGroupController.detail`    | `memberTagManage` |
//! | `POST /user/memberTagGroup/create`    | `MemberTagGroupController.create`    | `memberTagUpdateManage` |
//! | `POST /user/memberTagGroup/update`    | `MemberTagGroupController.update`    | `memberTagUpdateManage` |
//! | `POST /user/memberTagGroup/del`       | `MemberTagGroupController.del`       | `memberTagUpdateManage` |
//! | `POST /user/memberTagGroup/setTop`    | `MemberTagGroupController.setTop`    | `memberTagUpdateManage` |
//! | `POST /user/memberTagGroup/cancelTop` | `MemberTagGroupController.cancelTop` | `memberTagUpdateManage` |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/user/memberTagGroup`
//! （`memberTagGroup` 是**小驼峰**，不是 `member_tag_group`），方法级只有
//! `/detail` 这类短路径，**没有**控制器前缀重复。因此最终路径是
//! `/adminapi/user/memberTagGroup/detail`（不是
//! `.../memberTagGroup/memberTagGroup/detail`，也不是
//! `.../member_tag_group/...`），与 `docs/api-contract.json` 逐字符一致。
//!
//! # ⚠️ `list` 不在本切片（避免路由冲突）
//!
//! 本域契约里还有 `GET /adminapi/user/memberTagGroup/list`，但它**已经**由
//! `crates/api/admin/src/routes/member.rs`（早期域占位实现）注册。
//! axum 的 `Router::merge` 遇到同一 `(method, path)` 会在**启动时 panic**，
//! 因此本切片**只**注册上表的 6 条，`list` 仍由 `member.rs` 提供。
//! 详见返回值 `uncertain_points`。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做类级 + 方法级校验；
//! Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! （与 seckill.rs / order_admin.rs / member_tag.rs / area_code.rs 的已知缺口一致）。
//! 上表权限列仅作对照记录，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! # 多租户说明（`shopId`）
//!
//! Java 服务层每个方法都先调 `currentShopId()`
//! = `HeaderUtils.getShopId() ?? 0`，它读的是**请求头**
//! （`x-admin-type` + `x-shop-id`），**不是**请求体/查询参数。
//! Rust 侧 JWT 尚未签发 `shop_id`，故本模块按**同一规则解析请求头**
//! （见 [`shop_id_from_headers`]），与 product_stock / stock_warning / aftersales / im_servant
//! 的做法一致。
//!
//! # 操作人（`create_by_*` / `update_by_*`）
//!
//! Java `MybatisPlusMetaObjectHandler` 用 `SecurityUtils` 填充操作人
//! （名称空白 → `"unknown"`）。本模块从 JWT 身份（[`AuthUser`]）构造
//! [`AdminOperator`] 传给服务层。
//!
//! # 返回结构说明
//!
//! Java 6 个端点里 5 个返回 `void`、`detail` 返回 VO。
//! Rust 侧统一包在 `ApiResponse` 里：`detail` 原样返回 VO；
//! 写操作回传可观测的计数/主键（便于前端跳转与运维排障）。
//! ⚠️ `detail` 的 `tags` 是数组（Java `List<MemberTagVO>`），**不是**分页对象。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::member_tag_group::{
    AdminOperator, MemberTagGroupCreateDTO, MemberTagGroupDetailVO, MemberTagGroupUpdateDTO,
    OperateDTO, DEFAULT_SHOP_ID, MSG_ID_REQUIRED,
};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域全部 6 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 6] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/user/memberTagGroup/detail",
        "MemberTagGroupController.detail",
    ),
    (
        "POST",
        "/user/memberTagGroup/create",
        "MemberTagGroupController.create",
    ),
    (
        "POST",
        "/user/memberTagGroup/update",
        "MemberTagGroupController.update",
    ),
    (
        "POST",
        "/user/memberTagGroup/del",
        "MemberTagGroupController.del",
    ),
    (
        "POST",
        "/user/memberTagGroup/setTop",
        "MemberTagGroupController.setTop",
    ),
    (
        "POST",
        "/user/memberTagGroup/cancelTop",
        "MemberTagGroupController.cancelTop",
    ),
];

/// 会员标签组管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// ⚠️ **不注册** `/user/memberTagGroup/list`：该路径已由
/// `routes/member.rs` 提供，重复注册会让 axum 启动时 panic。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/memberTagGroup/detail", get(detail))
        .route("/user/memberTagGroup/create", post(create))
        .route("/user/memberTagGroup/update", post(update))
        .route("/user/memberTagGroup/del", post(del))
        .route("/user/memberTagGroup/setTop", post(set_top))
        .route("/user/memberTagGroup/cancelTop", post(cancel_top))
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
// 请求头 → 店铺 ID / 操作人（替代 Java HeaderUtils + SecurityUtils）
// ——————————————————————————————————————————————

/// `detail` 的查询参数。
///
/// Java 是 `@RequestParam Long id`（**必填**、参数名就是 `id`），
/// 缺失时 Spring 抛 `MissingServletRequestParameterException`（HTTP 400）。
/// 本实现同样返回 400。
#[derive(Debug, Deserialize)]
struct GroupIdQuery {
    /// 标签组主键（Java `@RequestParam Long id`）
    id: Option<i64>,
}

/// 解析当前请求的店铺 ID（对应 Java `HeaderUtils.getShopId() ?? 0`）。
///
/// 逐条复刻 Java `HeaderUtils.getShopId()`：
/// - `x-admin-type: admin` → `0`（平台）
/// - `x-admin-type: shop|pos` → `x-shop-id`（缺失/非法 → `null`，服务层归一 `0`）
/// - 其它/缺失 → `null` → `0`
///
/// ⚠️ 与 product_stock / im_servant 的 `shop_id_from_headers` **语义相同但各自独立
/// 实现**：本切片不修改共享文件，因此不复用它们的私有函数。
/// 可信租户店铺作用域：平台账号 `0`，店铺账号强制本店（来自 JWT）。
fn shop_scope(auth: &AuthUser) -> i32 {
    auth.scoped_shop_id().unwrap_or(0)
}

#[cfg(test)]
#[must_use]
pub fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(DEFAULT_SHOP_ID),
        _ => DEFAULT_SHOP_ID,
    }
}

/// 由 JWT 身份构造服务层操作人
/// （对应 Java `SecurityUtils.getCurrentAdminId/getCurrentUsername` +
/// `MybatisPlusMetaObjectHandler` 的 `"unknown"` 兜底）。
#[must_use]
pub fn operator_from(auth: &AuthUser) -> AdminOperator {
    AdminOperator::from_auth(i64::from(auth.id), Some(auth.username.as_str()))
}

fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 校验并归一请求体里的标签组主键（`del` / `setTop` / `cancelTop` 共用）。
///
/// ⚠️ Java 这三个端点的参数是 `@RequestBody OperateDTO`，**没有** `@Valid`，
/// 因此 `@NotNull` 不生效，`id == null` 时会在
/// `operateDTO.getId().longValue()` 处抛 NPE（HTTP 500）。
/// 本实现按项目统一口径要求 `id` 必填并返回 400
/// （与 member_tag / area_code 的处理一致，已列入 `uncertain_points`）。
fn require_group_id(id: Option<i64>) -> Result<i64, tigshop_core::Error> {
    id.ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.to_string()))
}

// ——————————————————————————————————————————————
// 详情
// ——————————————————————————————————————————————

/// `GET /adminapi/user/memberTagGroup/detail?id=`：标签组详情。
///
/// 对应 Java `MemberTagGroupController.detail(@RequestParam Long id)`
/// → `MemberTagGroupServiceImpl#detail`。
///
/// Java 记录不存在（或不属于当前店铺）时抛 `GlobalException("标签组不存在")`；
/// 本实现返回 404 + 同文案（项目内 order_admin/005/017/075/163 的既有约定）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<GroupIdQuery>,
) -> ApiResult<MemberTagGroupDetailVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.to_string()))?;
    let shop_id = shop_scope(&auth);
    ok(state.member.member_tag_group.detail(id, shop_id).await?)
}

// ——————————————————————————————————————————————
// 写入
// ——————————————————————————————————————————————

/// `POST /adminapi/user/memberTagGroup/create`：新增标签组（含标签）。
///
/// 对应 Java `MemberTagGroupController.create(@Valid @RequestBody
/// MemberTagGroupCreateParam param)` → `MemberTagGroupServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建的**标签组主键**，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / member_tag / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<MemberTagGroupCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let shop_id = shop_scope(&auth);
    let operator = operator_from(&auth);
    let id = state
        .member
        .member_tag_group
        .create(&dto, shop_id, &operator)
        .await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/user/memberTagGroup/update`：更新标签组 + 全量同步标签。
///
/// 对应 Java `MemberTagGroupController.update(@Valid @RequestBody
/// MemberTagGroupUpdateParam param)` → `MemberTagGroupServiceImpl#update`。
///
/// Java 返回 `void`；此处回传删除/改名/新增的计数，便于排障。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<MemberTagGroupUpdateDTO>,
) -> ApiResult<serde_json::Value> {
    let shop_id = shop_scope(&auth);
    let operator = operator_from(&auth);
    let outcome = state
        .member
        .member_tag_group
        .update(&dto, shop_id, &operator)
        .await?;
    ok(serde_json::json!({
        "groupId": outcome.group_id,
        "deleted": outcome.deleted,
        "renamed": outcome.renamed,
        "inserted": outcome.inserted,
    }))
}

/// `POST /adminapi/user/memberTagGroup/del`：删除标签组（连带标签与用户关联）。
///
/// 对应 Java `MemberTagGroupController.del(@RequestBody OperateDTO operateDTO)`
/// → `MemberTagGroupServiceImpl#delGroup(operateDTO.getId().longValue())`。
///
/// 语义：先**物理删除** `user_member_tag` 关联，再**逻辑删除**
/// `member_tag`，最后**逻辑删除** `member_tag_group`（`@TableLogic`）。
/// Java 返回 `void`；这里回传计数便于运维排查。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    require_group_id(dto.group_id())?;
    let shop_id = shop_scope(&auth);
    let outcome = state
        .member
        .member_tag_group
        .del_group(&dto, shop_id)
        .await?;
    ok(serde_json::json!({
        "groupId": outcome.group_id,
        "removedLinks": outcome.removed_links,
        "deletedTags": outcome.deleted_tags,
        "deletedGroup": outcome.deleted_group,
    }))
}

/// `POST /adminapi/user/memberTagGroup/setTop`：置顶标签组。
///
/// 对应 Java `MemberTagGroupController.setTop(@RequestBody OperateDTO operateDTO)`
/// → `MemberTagGroupServiceImpl#setTop(operateDTO.getId().longValue())`。
///
/// ⚠️ 权重**不是**固定 1，而是「当前店铺 `MAX(is_top)` + 1」，
/// 因此重复置顶同一组会让权重持续增大（Java 真实行为）。
/// Java 返回 `void`；这里回传写入的权重便于排障。
async fn set_top(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    require_group_id(dto.group_id())?;
    let shop_id = shop_scope(&auth);
    let operator = operator_from(&auth);
    let top = state
        .member
        .member_tag_group
        .set_top(&dto, shop_id, &operator)
        .await?;
    ok(serde_json::json!({ "isTop": top }))
}

/// `POST /adminapi/user/memberTagGroup/cancelTop`：取消置顶标签组。
///
/// 对应 Java `MemberTagGroupController.cancelTop(@RequestBody OperateDTO operateDTO)`
/// → `MemberTagGroupServiceImpl#cancelTop(operateDTO.getId().longValue())`。
///
/// ⚠️ 直接 `setIsTop(0)`，**不重排**其余组的权重（Java 真实行为）。
/// Java 返回 `void`；这里回传受影响行数便于排障。
async fn cancel_top(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    require_group_id(dto.group_id())?;
    let shop_id = shop_scope(&auth);
    let operator = operator_from(&auth);
    let affected = state
        .member
        .member_tag_group
        .cancel_top(&dto, shop_id, &operator)
        .await?;
    ok(serde_json::json!({ "affected": affected }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 6 条路由必须与 `docs/api-contract.json` 逐字符一致
    /// （含 `/adminapi` 前缀与小驼峰 `memberTagGroup`）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 6, "本域应有 6 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/user/memberTagGroup/detail",
            "POST /adminapi/user/memberTagGroup/create",
            "POST /adminapi/user/memberTagGroup/update",
            "POST /adminapi/user/memberTagGroup/del",
            "POST /adminapi/user/memberTagGroup/setTop",
            "POST /adminapi/user/memberTagGroup/cancelTop",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// 路由表里**没有** `list`：它由 `routes/member.rs` 提供，
    /// 本切片重复注册会让 axum 启动时 panic。
    #[test]
    fn route_table_does_not_register_list() {
        for (_, path, _) in ROUTE_TABLE {
            assert_ne!(
                path, "/user/memberTagGroup/list",
                "list 已由 routes/member.rs 注册，本切片不得重复"
            );
        }
        let keys: Vec<String> = implemented_routes().iter().map(|d| d.key()).collect();
        assert!(
            !keys.contains(&"GET /adminapi/user/memberTagGroup/list".to_string()),
            "本切片不得声明 list：{keys:?}"
        );
    }

    /// `implemented_routes` 里的 Java 引用必须指向 `MemberTagGroupController.*`。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("MemberTagGroupController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
        // handler 名与路径末段一致（Java 方法名 = 路径末段）
        for (_, path, java) in ROUTE_TABLE {
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("MemberTagGroupController.{last}"));
        }
    }

    /// 路由表与 `routes()` 注册的条目数必须一致（防漏挂载）。
    #[test]
    fn route_table_covers_all() {
        assert_eq!(ROUTE_TABLE.len(), 6);
        // 恰好 1 个 GET、5 个 POST（与 Java 注解一致）
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 1);
        assert_eq!(ROUTE_TABLE.len() - gets, 5);
        assert!(ROUTE_TABLE
            .iter()
            .find(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| p.ends_with("/detail"))
            .unwrap_or(false));
    }

    /// 本模块路径**不带** `/adminapi`（由父路由统一挂载），
    /// 且不得写成下划线形式或重复控制器前缀。
    #[test]
    fn route_paths_are_relative_and_camel_case() {
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'), "{p} 应以 / 开头");
            assert!(!p.starts_with("/adminapi"), "{p} 不得自带 /adminapi 前缀");
            assert!(
                p.starts_with("/user/memberTagGroup/"),
                "{p} 前缀错误（应是小驼峰 memberTagGroup）"
            );
            assert!(!p.contains("member_tag_group"), "{p} 不得用下划线写法");
            assert!(
                !p.starts_with("/user/memberTagGroup/memberTagGroup"),
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

    /// `detail` 的查询参数按 Java `@RequestParam Long id` 命名（`id`，非 `groupId`）。
    #[test]
    fn detail_query_uses_id_param_name() {
        let q: GroupIdQuery = serde_json::from_str(r#"{"id":12}"#).expect("应能解析 id");
        assert_eq!(q.id, Some(12));

        // 缺失 → None（由 handler 转 400）
        let q: GroupIdQuery = serde_json::from_str("{}").expect("空对象应可解析");
        assert_eq!(q.id, None);

        // 前端若传 groupId，不是本接口的参数名 → 忽略
        let q: GroupIdQuery = serde_json::from_str(r#"{"groupId":13}"#).unwrap();
        assert_eq!(q.id, None);
    }

    /// 三个 `OperateDTO` 端点的 `id` 必填：缺失 → 400（文案照抄 Java `OperateDTO`）。
    #[test]
    fn operate_dto_requires_id() {
        assert!(require_group_id(None).is_err());
        assert_eq!(require_group_id(Some(0)).expect("0 应通过"), 0);
        assert_eq!(require_group_id(Some(-3)).expect("负数应通过"), -3);

        let dto: OperateDTO = serde_json::from_str("{}").unwrap();
        assert!(require_group_id(dto.group_id()).is_err());
        let dto: OperateDTO = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(require_group_id(dto.group_id()).expect("应通过"), 5);
    }

    /// `shop_id_from_headers` 必须复刻 Java `HeaderUtils.getShopId() ?? 0`。
    #[test]
    fn shop_id_follows_java_header_utils() {
        let headers = |pairs: &[(&str, &str)]| {
            let mut h = axum::http::HeaderMap::new();
            for (k, v) in pairs {
                h.insert(
                    axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                    axum::http::HeaderValue::from_str(v).unwrap(),
                );
            }
            h
        };

        // 平台账号：无论 x-shop-id 是什么都是 0
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
        // 店铺 / 门店账号：取 x-shop-id
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
        // 店铺账号但缺 x-shop-id → Java null → 服务层归一 0
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            DEFAULT_SHOP_ID
        );
        // 非法 x-shop-id → 0（Java 的 Integer.parseInt 会抛异常 → 500；
        // 本实现按「解析失败即平台」兜底，见 uncertain_points）
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            DEFAULT_SHOP_ID
        );
        // 缺失 / 未知 admin-type → 0
        assert_eq!(shop_id_from_headers(&headers(&[])), DEFAULT_SHOP_ID);
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "vendor")])),
            DEFAULT_SHOP_ID
        );
    }

    /// 操作人来自 JWT；用户名为空/空白时按 Java 规则兜底 `"unknown"`。
    #[test]
    fn operator_from_auth_matches_java_fill() {
        let auth = AuthUser {
            id: 42,
            username: "admin".to_string(),
            role_id: Some(1),
            admin_type: Some("admin".to_string()),
            shop_id: None,
        };
        let op = operator_from(&auth);
        assert_eq!(op.id, Some(42));
        assert_eq!(op.name_ref(), Some("admin"));

        let blank = AuthUser {
            id: 7,
            username: "   ".to_string(),
            role_id: None,
            admin_type: None,
            shop_id: None,
        };
        assert_eq!(operator_from(&blank).name_ref(), Some("unknown"));
    }

    /// 默认店铺 ID 是平台 0（Java `currentShopId()` 的归一值）。
    #[test]
    fn default_shop_id_is_platform_zero() {
        assert_eq!(DEFAULT_SHOP_ID, 0);
        // 与「缺失 x-admin-type 时的解析结果」一致
        assert_eq!(shop_id_from_headers(&axum::http::HeaderMap::new()), 0);
    }

    #[test]
    fn trusted_shop_scope_from_auth() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(shop_scope(&admin), 0);
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert_eq!(shop_scope(&shop), 7);
        // 店铺账号缺 shop_id → 0，无法通过 query 伪造
        let broken = AuthUser::new(3, "s".into(), None, Some("shop".into()), None);
        assert_eq!(shop_scope(&broken), 0);
    }
}
