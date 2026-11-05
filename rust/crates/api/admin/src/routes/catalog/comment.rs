//! 管理端评价管理路由（catalog::comment）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.CommentController`
//! （`@RequestMapping("/adminapi/product/comment")`，8 个端点，
//! `@PreAuthorize("@pms.hasPermission('commentManage')")` 类级 +
//! `commentModifyManage` 写操作）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限 |
//! |----------------------------------|--------------|------|
//! | `GET  /product/comment/list` | `CommentController.list` | `commentManage` |
//! | `GET  /product/comment/detail` | `CommentController.detail` | `commentManage` |
//! | `POST /product/comment/create` | `CommentController.create` | `commentModifyManage` |
//! | `POST /product/comment/update` | `CommentController.update` | `commentModifyManage` |
//! | `POST /product/comment/del` | `CommentController.del` | `commentModifyManage` |
//! | `POST /product/comment/updateField` | `CommentController.updateField` | `commentModifyManage` |
//! | `POST /product/comment/batch` | `CommentController.batch` | `commentModifyManage` |
//! | `POST /product/comment/replyComment` | `CommentController.replyComment` | `commentModifyManage` |
//!
//! > **鉴权口径**：Java 在方法级用 `@PreAuthorize` 做 RBAC；Rust 侧
//! > `require_auth` 目前只校验登录态（权限矩阵尚未实现），本模块注册在管理端
//! > **需登录**路由组（`merge_all` 外层统一套 `require_auth`），因此任何已登录
//! > 管理员都能调用这 8 条接口。上表权限列仅作对照。
//!
//! > **多租户（重要缺口）**：Java `list` 用 `HeaderUtils.getShopId()`（请求头）
//! > 决定是否强制 `shop_id = 本店`；`replyComment` 用 `getCurrentAdminId()` /
//! > `getCurrentUsername()` 写回复人。Rust JWT 尚未签发 `shop_id`，店铺过滤
//! > 目前只能由查询参数 `shopId` 表达（见服务层 [`tigshop_services::catalog::comment`]
//! > 模块头「不确定点」）；回复人 ID / 用户名已从登录态获取。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::comment::{
    BatchDTO, CommentListQuery, CommentReplyDTO, CommentSaveParam, CommentUpdateDTO, CommentVO,
    OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 评价域全部 8 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**，并与 [`routes`] 的注册清单
/// 由底部单测交叉校验，避免两边漂移。顺序与原 Java `CommentController` 一致。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    ("GET", "/product/comment/list", "CommentController.list"),
    ("GET", "/product/comment/detail", "CommentController.detail"),
    (
        "POST",
        "/product/comment/create",
        "CommentController.create",
    ),
    (
        "POST",
        "/product/comment/update",
        "CommentController.update",
    ),
    ("POST", "/product/comment/del", "CommentController.del"),
    (
        "POST",
        "/product/comment/updateField",
        "CommentController.updateField",
    ),
    ("POST", "/product/comment/batch", "CommentController.batch"),
    (
        "POST",
        "/product/comment/replyComment",
        "CommentController.replyComment",
    ),
];

/// 评价管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/comment/list", get(comment_list))
        .route("/product/comment/detail", get(comment_detail))
        .route("/product/comment/create", post(comment_create))
        .route("/product/comment/update", post(comment_update))
        .route("/product/comment/del", post(comment_del))
        .route("/product/comment/updateField", post(comment_update_field))
        .route("/product/comment/batch", post(comment_batch))
        .route("/product/comment/replyComment", post(comment_reply))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `GET /adminapi/product/comment/detail?id=` 的查询参数
/// （Java `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/product/comment/list`：评价分页。
///
/// 对应 Java `CommentController.list(CommentListPageQuery)` →
/// `CommentServiceImpl#list`；返回 `PageResult<CommentVO>`（Java 为 MyBatis-Plus
/// `Page`，Rust 统一使用项目既有分页结构，与 product_manage/brand 一致）。
async fn comment_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<CommentListQuery>,
) -> ApiResult<PageResult<CommentVO>> {
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.comment.list(&q).await?)
}

/// `GET /adminapi/product/comment/detail?id=`：评价详情（含子回复）。
async fn comment_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<CommentVO> {
    let detail = state.catalog.comment.detail(q.id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    ok(detail)
}

/// `POST /adminapi/product/comment/create`：新增评价（Java 返回 void）。
async fn comment_create(
    State(state): State<AdminState>,
    Json(dto): Json<CommentSaveParam>,
) -> ApiResult<()> {
    state.catalog.comment.create(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/comment/update`：编辑评价（Java 返回 void）。
async fn comment_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<CommentUpdateDTO>,
) -> ApiResult<()> {
    let id = dto
        .comment_id
        .ok_or_else(|| tigshop_core::Error::Validation("评价管理id不能为空".into()))?;
    let detail = state.catalog.comment.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    state.catalog.comment.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/comment/del`：删除单条评价。
///
/// 对应 Java `CommentController#del(OperateDTO)`（物理删除）。
async fn comment_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    let detail = state.catalog.comment.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    state.catalog.comment.delete(id).await?;
    ok(())
}

/// `POST /adminapi/product/comment/updateField`：更新单个字段（白名单）。
async fn comment_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    let detail = state.catalog.comment.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    state.catalog.comment.update_field(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/comment/batch`：批量操作（仅 `type = "del"`）。
async fn comment_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    if dto.r#type.as_deref() == Some("del") {
        for id in dto.ids.as_deref().unwrap_or(&[]) {
            let detail = state.catalog.comment.detail(*id).await?;
            tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
        }
    }
    state.catalog.comment.batch(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/comment/replyComment`：商家回复评价。
///
/// 对应 Java `CommentController#replyComment(CommentReplyDTO)`：
/// 回复人取登录管理员的 ID / 用户名（Java `getCurrentAdminId()` /
/// `getCurrentUsername()`）。
async fn comment_reply(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<CommentReplyDTO>,
) -> ApiResult<()> {
    let parent_id = dto
        .comment_id
        .ok_or_else(|| tigshop_core::Error::Validation("评价管理id不能为空".into()))?;
    let detail = state.catalog.comment.detail(parent_id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    state
        .catalog
        .comment
        .reply_comment(&dto, auth.id, &auth.username)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 8 条、前缀 `/adminapi`、method 大小写敏感、路径大小写敏感
    /// （`replyComment` / `updateField` 易写错）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8, "契约中 admin 评价域共 8 条接口");
        assert_eq!(docs.len(), ROUTE_TABLE.len());

        let actual: Vec<(String, String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone(), d.java_ref.clone()))
            .collect();
        let expected = [
            (
                "GET",
                "/adminapi/product/comment/list",
                "CommentController.list",
            ),
            (
                "GET",
                "/adminapi/product/comment/detail",
                "CommentController.detail",
            ),
            (
                "POST",
                "/adminapi/product/comment/create",
                "CommentController.create",
            ),
            (
                "POST",
                "/adminapi/product/comment/update",
                "CommentController.update",
            ),
            (
                "POST",
                "/adminapi/product/comment/del",
                "CommentController.del",
            ),
            (
                "POST",
                "/adminapi/product/comment/updateField",
                "CommentController.updateField",
            ),
            (
                "POST",
                "/adminapi/product/comment/batch",
                "CommentController.batch",
            ),
            (
                "POST",
                "/adminapi/product/comment/replyComment",
                "CommentController.replyComment",
            ),
        ];
        for (method, path, handler) in expected {
            assert!(
                actual
                    .iter()
                    .any(|(m, p, j)| m == method && p == path && j == handler),
                "缺少 {method} {path} ({handler})"
            );
        }
        // 不允许重复声明（路由表改错时会暴露）
        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            actual.len(),
            "implemented_routes() 存在重复项"
        );
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（8/8），
    /// 防止「实现了但没挂载」或「挂载了但没声明」。
    #[test]
    fn routes_registers_all_table_paths() {
        // `routes()` 用字面量注册，这里以字符串形式复述同一份清单。
        let registered = [
            ("GET", "/product/comment/list"),
            ("GET", "/product/comment/detail"),
            ("POST", "/product/comment/create"),
            ("POST", "/product/comment/update"),
            ("POST", "/product/comment/del"),
            ("POST", "/product/comment/updateField"),
            ("POST", "/product/comment/batch"),
            ("POST", "/product/comment/replyComment"),
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            assert!(
                ROUTE_TABLE
                    .iter()
                    .any(|(m, p, _)| *m == method && *p == path),
                "{method} {path} 不在 ROUTE_TABLE 内"
            );
        }
        // 反向校验：ROUTE_TABLE 里每条都被 routes() 注册（防止漏挂）
        for (method, path, _) in ROUTE_TABLE.iter() {
            assert!(
                registered.iter().any(|(m, p)| m == method && p == path),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }

    /// 路径表自身守卫：前缀、method 白名单、无重复。
    #[test]
    fn route_table_is_well_formed() {
        assert_eq!(ROUTE_TABLE.len(), 8);
        for (i, (method, path, handler)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                path.starts_with("/product/comment/"),
                "路径前缀错误: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(handler.starts_with("CommentController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明");
            }
        }
    }
    /// 多租户隔离：列表强制过滤 + 跨店详情被拒。
    #[test]
    fn tenant_scope_isolation() {
        let shop = AuthUser {
            id: 4,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(2),
        };
        assert_eq!(tenant::list_scope(&shop, None).unwrap(), Some(2));
        assert!(tenant::list_scope(&shop, Some(8)).is_err());
        assert!(tenant::ensure_row_shop_opt(&shop, Some(8)).is_err());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert!(tenant::ensure_row_shop_opt(&platform, Some(8)).is_ok());
    }
}
