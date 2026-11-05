//! 会员留言域 —— 管理端路由（member::feedback）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.user.FeedbackController`
//! （`@RequestMapping("/adminapi/user/feedback")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('feedbackManage')")`，
//! **没有**类级 `@Validated`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |----------------------------------|------------------|--------------|-----------|
//! | `GET  /user/feedback/list`   | `GET  /adminapi/user/feedback/list`   | `FeedbackController.list`（`:43`）   | `jwt+perm`（`feedbackManage`） |
//! | `GET  /user/feedback/detail` | `GET  /adminapi/user/feedback/detail` | `FeedbackController.detail`（`:49`） | `jwt+perm`（`feedbackManage`） |
//! | `POST /user/feedback/del`    | `POST /adminapi/user/feedback/del`    | `FeedbackController.del`（`:55`）    | `jwt+perm`（`feedbackModifyManage`） |
//! | `POST /user/feedback/update` | `POST /adminapi/user/feedback/update` | `FeedbackController.update`（`:62`） | `jwt+perm`（`feedbackModifyManage`） |
//! | `POST /user/feedback/batch`  | `POST /adminapi/user/feedback/batch`  | `FeedbackController.batch`（`:69`）  | `jwt+perm`（`feedbackModifyManage`） |
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式（由 `/adminapi` 父路由统一挂载），
//! [`implemented_routes`] 里写完整契约路径。路径逐字符照抄契约
//! （`feedback` 全小写，无驼峰 / 下划线歧义）。
//!
//! # 权限说明（已知缺口）
//!
//! Java 用类级 + 方法级 `@PreAuthorize("@pms.hasPermission(...)")` 做权限校验；
//! Rust 侧 `/adminapi` 子树目前只有登录态校验（`require_auth`），
//! 权限矩阵未实现（与 seckill / order_admin / member_tag / member_tag_group / area_code 等
//! 已知缺口一致）。上表权限列仅作对照记录，当前**任何已登录管理员**都能调用
//! 本域全部接口。详见返回值 `uncertain_points`。
//!
//! # 多租户作用域（**本域最容易出错的地方**）
//!
//! Java `FeedbackServiceImpl` 的 `list` / `detail` / `del` / `update` / `batch`
//! **每一条**链路都会先调 `currentAdminTenantScope()`：
//!
//! ```java
//! AdminTypeEnum adminType = HeaderUtils.getAdminType(); // 只读请求头
//! if (adminType == null) throw new GlobalException("缺少后台租户信息");
//! if (adminType == ADMIN)  return TenantScope.platform();
//! if (adminType == SHOP || adminType == STORE) {
//!     Integer shopId = HeaderUtils.getShopId();
//!     if (shopId == null || shopId <= 0) throw new GlobalException("缺少当前店铺信息");
//!     return TenantScope.shop(shopId);
//! }
//! throw new GlobalException("无权访问会员留言");
//! ```
//!
//! 因此五个接口都**必须**带合法租户头（`x-admin-type` + 店铺类的 `x-shop-id`），
//! 否则是 `1001` 业务错误（`SERVICE_DATA_ERROR`，与 Java `GlobalException(String)`
//! 同码）。本模块用 [`tenant_scope`] 复刻该判定：
//! - `admin_type` 优先取请求头 `x-admin-type`，缺失时回退 JWT 的 `admin_type`
//!   （Rust JWT 已含 `typ`，见 `AuthUser.admin_type`；与 aftersales / vendor_deposit_shop 同口径）；
//! - `shop` + `x-shop-type ∈ {2,3}` 细化成 `store` / `pickup`（`HeaderUtils` 语义）；
//! - `x-shop-id` 缺失 / 非数字 → `None`（店铺类账号 → `"缺少当前店铺信息"`）。
//!
//! 判定与错误文案全部落在
//! [`tigshop_core::models::member::feedback::TenantScope::resolve`]（已单测），本文件不重复实现。
//!
//! # 返回结构说明
//!
//! Java `list` 返回 MyBatis-Plus `Page<UserFeedbackVO>`
//! （`records`/`total`/`size`/`current`/`pages`），Rust 统一使用项目既有
//! [`PageResult`]（`list`/`total`/`totalPage`/`pageSize`/`page`），
//! 与 product_manage/002/005/010/014/017/039/044/075/163 一致。
//! `detail` 返回单个 VO；`del` / `update` / `batch` 原 Java 返回 `void`，
//! 本实现回传 `data: null`（与 proxy_shopping_order_check 等既有约定一致）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::member::feedback::{
    BatchDTO, FeedbackListQuery, FeedbackUpdateDTO, OperateDTO, TenantScope, UserFeedbackDetailVO,
    UserFeedbackVO, MSG_MISSING_TENANT, SERVICE_DATA_ERROR,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

/// 本域全部 5 条路由（`(HTTP method, 去掉 /adminapi 前缀的路径, 原 Java handler)`）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    ("GET", "/user/feedback/list", "FeedbackController.list"),
    ("GET", "/user/feedback/detail", "FeedbackController.detail"),
    ("POST", "/user/feedback/del", "FeedbackController.del"),
    ("POST", "/user/feedback/update", "FeedbackController.update"),
    ("POST", "/user/feedback/batch", "FeedbackController.batch"),
];

/// 会员留言域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// ⚠️ 路径必须写成**字符串字面量**（不能从 [`ROUTE_TABLE`] 循环生成）：
/// `tools/check_api_coverage.py::collect_rust_routes` 静态扫描
/// `\.route\(\s*"(?P<path>...)"`，循环拼接会让覆盖率统计看不见这些路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/user/feedback/list", get(list))
        .route("/user/feedback/detail", get(detail))
        .route("/user/feedback/del", post(del))
        .route("/user/feedback/update", post(update))
        .route("/user/feedback/batch", post(batch))
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
// 请求头 → 租户作用域（替代 Java HeaderUtils + currentAdminTenantScope）
// ——————————————————————————————————————————————

/// 读取请求头文本值（仅测试保留；生产链路已改用 JWT 可信身份）。
///
/// Java `HeaderUtils.getHeaderValue` 用 `StrUtil.isEmpty`（只判空串），
/// 本实现按 `trim` 后判空，与 aftersales / member_tag_group / vendor_deposit_shop / logistics_company_config 的
/// 既有口径一致（`"   "` 视为缺失，见 `uncertain_points`）。
#[cfg(test)]
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 解析当前请求的租户作用域
/// （对应 Java `FeedbackServiceImpl#currentAdminTenantScope`）。
///
/// 判定与错误文案全部委托
/// [`TenantScope::resolve`]（其单测已覆盖 `admin` / `shop` / `store` /
/// `pickup` / 缺失各分支），本函数只负责把「请求头 + JWT」翻译成
/// `resolve` 的三个入参：
/// - `admin_type`：`x-admin-type` 缺失时回退 JWT `admin_type`；
/// - `shop_type`：`x-shop-type`（Java 侧是登录上下文写的请求属性，
///   Rust 用同名请求头近似，见 `uncertain_points`）；
/// - `shop_id`：`x-shop-id`（缺失 / 非数字 → `None`）。
///
/// `resolve` 报错 → [`Error::biz`]`(1001, 原文案)`，与 Java
/// `GlobalException(String)` 的可观测口径一致。
#[cfg(test)]
fn tenant_scope(headers: &HeaderMap, auth: &AuthUser) -> Result<TenantScope, AppError> {
    let admin_type = header_str(headers, "x-admin-type").or_else(|| auth.admin_type.clone());
    let shop_type = header_str(headers, "x-shop-type").and_then(|v| v.parse::<i32>().ok());
    let shop_id = header_str(headers, "x-shop-id").and_then(|v| v.parse::<i32>().ok());
    TenantScope::resolve(admin_type.as_deref(), shop_type, shop_id)
        .map_err(|msg| AppError(tigshop_core::Error::biz(SERVICE_DATA_ERROR, msg)))
}

/// 从可信 JWT 身份解析租户作用域（禁止请求头作为身份）。
///
/// - `admin` → 平台（不受店铺过滤）；
/// - `shop` / `store` → 店铺作用域，`shop_id` 必须来自 JWT 且 > 0；
/// - 其它（`pickup` / `vendor` / 缺失）→「无权访问会员留言」。
fn trusted_tenant_scope(auth: &AuthUser) -> Result<TenantScope, AppError> {
    let admin_type = auth.admin_type.as_deref().ok_or_else(|| {
        AppError(tigshop_core::Error::biz(
            SERVICE_DATA_ERROR,
            MSG_MISSING_TENANT,
        ))
    })?;
    let shop_id = if auth.is_platform() {
        None
    } else {
        auth.scoped_shop_id()
    };
    TenantScope::resolve(Some(admin_type), None, shop_id)
        .map_err(|msg| AppError(tigshop_core::Error::biz(SERVICE_DATA_ERROR, msg)))
}

/// `GET .../detail?id=` 的查询参数。
///
/// Java 是 `@RequestParam @NotNull Integer id`（**必填**）。
/// 类上**没有** `@Validated` ⇒ `@NotNull` 不参与方法校验，但 `@RequestParam`
/// 默认 `required=true` ⇒ 真正缺失时 Spring 抛
/// `MissingServletRequestParameterException`（HTTP 400）。
/// 本实现把缺失归一为 `None` 交给服务层，最终得到「留言不存在」业务错误
/// （与 `del` 的 `id == null` 口径统一，差异见 `uncertain_points`）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 留言主键（Java `@RequestParam Integer id`）
    id: Option<i32>,
}

// ——————————————————————————————————————————————
// Handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/user/feedback/list`：会员留言分页。
///
/// 对应 Java `FeedbackController.list(FeedBackListPageQuery pageQuery)`（`:43`）
/// → `FeedbackServiceImpl#listForAdmin(pageQuery)`。
///
/// 查询参数按 Java `FeedBackListPageQuery`（继承 `BasePage`）契约：
/// `type` / `isOrder` / `productId` / `status` / `userId` / `shopId` /
/// `excludeReply` / `keyword` / `sortField` / `sortOrder` / `sortItems` /
/// `page` / `size`（注意是 `size`，不是 `pageSize`）。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<FeedbackListQuery>,
) -> ApiResult<PageResult<UserFeedbackVO>> {
    let scope = trusted_tenant_scope(&auth)?;
    ok(state.member.feedback.list(&q, scope).await?)
}

/// `GET /adminapi/user/feedback/detail?id=`：会员留言详情。
///
/// 对应 Java `FeedbackController.detail(@RequestParam Integer id)`（`:49`）
/// → `FeedbackServiceImpl#detail(id)`。
///
/// 记录不存在 / 越权 / `id` 缺失 → 「留言不存在」（`1001`，同 Java）；
/// `feedbackPics` 仅在「非空白且长度 > 3」时解析（Java `isNotBlank && length() > 3`）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<UserFeedbackDetailVO> {
    let scope = trusted_tenant_scope(&auth)?;
    ok(state.member.feedback.detail(q.id, scope).await?)
}

/// `POST /adminapi/user/feedback/del`：删除一条会员留言。
///
/// 对应 Java `FeedbackController.del(@RequestBody OperateDTO operate)`（`:55`）
/// → `FeedbackServiceImpl#del(operate.getId())`。
///
/// ⚠️ 控制器**没有** `@Valid` ⇒ `OperateDTO.id` 的 `@NotNull` 不生效：
/// `id` 为 `null` 时会一路传到 `requireAdminAccessibleFeedback(null)`
/// → 「留言不存在」（本实现同样不做路由层必填校验）。
/// 表 `feedback` **没有**软删列，故为**物理删除**（schema 已核对）。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    let scope = trusted_tenant_scope(&auth)?;
    state.member.feedback.del(dto.id, scope).await?;
    ok(())
}

/// `POST /adminapi/user/feedback/update`：新增或编辑一条回复。
///
/// 对应 Java `FeedbackController.update(@RequestBody FeedbackUpdateDTO updateDTO)`
/// （`:62`）→ `FeedbackServiceImpl#update(updateDTO)`。
///
/// 两条分支由 `parentId` 决定：`parentId == 0` → 新增回复（并把父留言置为
/// 已回复）；`parentId` 为 `null` / 非 0 → 编辑已有回复。回复人取当前 JWT
/// 身份（Java `SecurityUtils.getCurrentAdminId()`）。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<FeedbackUpdateDTO>,
) -> ApiResult<()> {
    let scope = trusted_tenant_scope(&auth)?;
    state.member.feedback.update(&dto, auth.id, scope).await?;
    ok(())
}

/// `POST /adminapi/user/feedback/batch`：批量删除会员留言。
///
/// 对应 Java `FeedbackController.batch(@RequestBody BatchDTO batchDTO)`（`:69`）
/// → `FeedbackServiceImpl#batch(batchDTO)`。
///
/// `ids` 为空 / `type != "del"` → 直接成功返回（Java 返回 `false`，控制器忽略，
/// 对外仍 HTTP 200）；否则逐条按租户作用域校验后**物理删除**（整批同事务）。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    let scope = trusted_tenant_scope(&auth)?;
    state.member.feedback.batch(&dto, scope).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn trusted_identity_rejects_cross_shop_scope() {
        use tigshop_security::web::AuthUser;
        // 店铺账号：强制本店
        let shop = AuthUser::new(1, "s".into(), None, Some("shop".into()), Some(5));
        assert_eq!(
            trusted_tenant_scope(&shop).expect("店铺账号应通过"),
            TenantScope::Shop { shop_id: 5 }
        );
        // 平台账号：Platform
        let admin = AuthUser::new(2, "a".into(), None, Some("admin".into()), Some(0));
        assert_eq!(
            trusted_tenant_scope(&admin).expect("平台应通过"),
            TenantScope::Platform
        );
        // 非店铺家族（pickup/vendor）：无权
        for t in ["pickup", "vendor"] {
            let auth = AuthUser::new(3, "x".into(), None, Some(t.into()), Some(5));
            assert!(trusted_tenant_scope(&auth).is_err(), "t={t}");
        }
        // 店铺账号缺 shop_id：缺少当前店铺信息
        let broken = AuthUser::new(4, "x".into(), None, Some("shop".into()), None);
        assert!(trusted_tenant_scope(&broken).is_err());
    }

    use super::*;
    use axum::http::{HeaderName, HeaderValue};
    use tigshop_core::models::member::feedback::{
        MSG_MISSING_SHOP, MSG_MISSING_TENANT, MSG_NO_ACCESS_FEEDBACK,
    };

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                HeaderName::from_bytes(k.as_bytes()).expect("合法 header 名"),
                HeaderValue::from_str(v).expect("合法 header 值"),
            );
        }
        h
    }

    fn auth_with_type(t: Option<&str>) -> AuthUser {
        AuthUser {
            id: 1,
            username: "tester".into(),
            role_id: Some(1),
            admin_type: t.map(ToString::to_string),
            shop_id: None,
        }
    }

    // ————————————— 路由契约（逐字符） —————————————

    /// 5 条路由必须与 `docs/api-contract.json` 逐字符一致（含 `/adminapi` 前缀）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5, "本域应有 5 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/user/feedback/list",
            "GET /adminapi/user/feedback/detail",
            "POST /adminapi/user/feedback/del",
            "POST /adminapi/user/feedback/update",
            "POST /adminapi/user/feedback/batch",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// `implemented_routes` 里的 Java 引用必须指向 `FeedbackController.*`，
    /// 且 handler 名与路径末段一致。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("FeedbackController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
        for (_, path, java) in ROUTE_TABLE {
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("FeedbackController.{last}"));
        }
    }

    /// 路由表长度 / 方法分布与 Java 注解一致（2 个 GET、3 个 POST），
    /// 且本地路径不带 `/adminapi` 前缀。
    #[test]
    fn route_table_covers_all_and_uses_relative_paths() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 2);
        assert_eq!(ROUTE_TABLE.len() - gets, 3);

        for (_, path, _) in ROUTE_TABLE {
            assert!(path.starts_with('/'), "{path} 应以 / 开头");
            assert!(
                !path.starts_with("/adminapi"),
                "{path} 不得自带 /adminapi 前缀"
            );
            assert!(path.starts_with("/user/feedback/"), "{path} 前缀错误");
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`）。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        for d in implemented_routes() {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
    }

    /// `detail` 的查询参数名是 `id`（Java `@RequestParam Integer id`）。
    #[test]
    fn detail_query_uses_id_param_name() {
        let q: IdQuery = serde_json::from_str(r#"{"id":12}"#).expect("应能解析 id");
        assert_eq!(q.id, Some(12));

        let q: IdQuery = serde_json::from_str("{}").expect("空对象应可解析");
        assert_eq!(q.id, None);
    }

    // ————————————— 租户作用域解析 —————————————

    /// `admin` → 平台作用域（不看 `x-shop-id`）。
    #[test]
    fn admin_header_is_platform() {
        let scope = tenant_scope(
            &headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")]),
            &auth_with_type(None),
        )
        .expect("平台账号应通过");
        assert_eq!(scope, TenantScope::Platform);
    }

    /// `shop` → 店铺作用域，`shop_id` 取 `x-shop-id`。
    #[test]
    fn shop_header_is_shop_scope() {
        let scope = tenant_scope(
            &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
            &auth_with_type(None),
        )
        .expect("店铺账号应通过");
        assert_eq!(scope, TenantScope::Shop { shop_id: 9 });
    }

    /// `shop` + `x-shop-type = 2` 细化为 `store`（仍属店铺族 → 有权）。
    #[test]
    fn shop_with_shop_type_two_refines_to_store() {
        let scope = tenant_scope(
            &headers(&[
                ("x-admin-type", "shop"),
                ("x-shop-type", "2"),
                ("x-shop-id", "5"),
            ]),
            &auth_with_type(None),
        )
        .expect("门店账号应通过");
        assert_eq!(scope, TenantScope::Shop { shop_id: 5 });
    }

    /// `shop` + `x-shop-type = 3` 细化为 `pickup` → 落「其余」分支 → 无权。
    #[test]
    fn shop_with_shop_type_three_refines_to_pickup_no_access() {
        let err = tenant_scope(
            &headers(&[
                ("x-admin-type", "shop"),
                ("x-shop-type", "3"),
                ("x-shop-id", "5"),
            ]),
            &auth_with_type(None),
        )
        .expect_err("自提点账号应无权");
        assert_eq!(err.0.business_code(), SERVICE_DATA_ERROR);
        assert!(err.0.to_string().contains(MSG_NO_ACCESS_FEEDBACK));
    }

    /// `admin_type` 缺失：请求头缺失时回退 JWT；两者都缺 → 「缺少后台租户信息」。
    #[test]
    fn admin_type_falls_back_to_jwt_then_errors() {
        // JWT 提供 admin → 平台
        let scope =
            tenant_scope(&headers(&[]), &auth_with_type(Some("admin"))).expect("JWT admin 应通过");
        assert_eq!(scope, TenantScope::Platform);

        // 请求头优先于 JWT
        let scope = tenant_scope(
            &headers(&[("x-admin-type", "admin")]),
            &auth_with_type(Some("shop")),
        )
        .expect("请求头 admin 应通过");
        assert_eq!(scope, TenantScope::Platform);

        // 两者都缺 → 缺少后台租户信息
        let err = tenant_scope(&headers(&[]), &auth_with_type(None)).expect_err("缺租户应报错");
        assert_eq!(err.0.business_code(), SERVICE_DATA_ERROR);
        assert!(err.0.to_string().contains(MSG_MISSING_TENANT));
    }

    /// 店铺账号缺 / 非法 `x-shop-id` → 「缺少当前店铺信息」。
    #[test]
    fn shop_scope_requires_positive_shop_id() {
        for raw in ["", "abc", "0", "-1"] {
            let err = tenant_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", raw)]),
                &auth_with_type(None),
            )
            .expect_err("非法 shop_id 应报错");
            assert!(err.0.to_string().contains(MSG_MISSING_SHOP), "raw={raw:?}");
        }

        // 头完全缺失同样报「缺少当前店铺信息」
        let err = tenant_scope(&headers(&[("x-admin-type", "shop")]), &auth_with_type(None))
            .expect_err("缺 shop_id 应报错");
        assert!(err.0.to_string().contains(MSG_MISSING_SHOP));
    }

    /// 其它 / 未知账号类型 → 「无权访问会员留言」。
    #[test]
    fn unknown_admin_type_is_rejected() {
        for t in ["vendor", "pos", "store2", "ADMIN", "shop2"] {
            let err = tenant_scope(&headers(&[("x-admin-type", t)]), &auth_with_type(None))
                .expect_err("未知账号类型应无权");
            assert!(err.0.to_string().contains(MSG_NO_ACCESS_FEEDBACK), "t={t}");
        }
    }
}
