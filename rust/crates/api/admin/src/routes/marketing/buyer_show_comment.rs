//! 管理端买家秀评论管理路由（marketing::buyer_show_comment）。
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.BuyerShowCommentController`
//! （`@RequestMapping("/adminapi/promotion/buyerShow/commentInfo")`）。
//!
//! | 本模块路由（挂载于 `/adminapi` 下） | 原 Java | 权限 |
//! |-----------------------------------|--------|------|
//! | `GET  /promotion/buyerShow/commentInfo/list` | `BuyerShowCommentController.list` | `buyerShowManage` |
//! | `POST /promotion/buyerShow/commentInfo/audit` | `BuyerShowCommentController.audit` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/commentInfo/batch` | `BuyerShowCommentController.batch` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/commentInfo/showOrHide` | `BuyerShowCommentController.showOrHide` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/commentInfo/isTop` | `BuyerShowCommentController.isTop` | `buyerShowUpdateManage` |
//!
//! 完整路径（含前缀）即契约中的
//! `/adminapi/promotion/buyerShow/commentInfo/{list,audit,batch,showOrHide,isTop}`
//! —— 注意控制器前缀 `buyerShow` 与子路径 `commentInfo` 是**两段**，
//! 不存在「前缀重复」的缩写形式。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级校验；
//! > Rust 侧 `require_auth`（在 `crates/api/admin/src/lib.rs` 的受保护子路由上统一
//! > 套用）目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs 的已知缺口一致）。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<BuyerShowCommentPageVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的 `PageResult`
//! > （`list/total/totalPage/pageSize/page`），与 order_admin / stock_warning 同一约定。
//! > `audit` / `showOrHide` / `isTop` 在 Java 中返回 `void`，此处按项目既有约定
//! > 回传提示文案；`batch` 在 Java 中返回 `boolean`（非 `audit` 类型为 `false`
//! > 且无副作用），此处保持一致。
//!
//! > **入参校验**：Java 用 `@Validated` + `@NotNull` / `@NotEmpty` 在进入服务前拦截，
//! > Rust 侧改为服务层显式校验，错误文案逐字对齐
//! > （见 `services::buyer_show_comment` 的错误常量）。
//!
//! 服务层实现见 [`tigshop_services::marketing::buyer_show_comment::BuyerShowCommentService`]。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use tigshop_core::models::marketing::buyer_show_comment::{
    BatchDTO, BuyerShowCommentAuditParam, BuyerShowCommentIsTopParam, BuyerShowCommentListQuery,
    BuyerShowCommentPageVO, BuyerShowCommentShowOrHideParam,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 买家秀评论管理域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/buyerShow/commentInfo/list", get(comment_list))
        .route(
            "/promotion/buyerShow/commentInfo/audit",
            post(comment_audit),
        )
        .route(
            "/promotion/buyerShow/commentInfo/batch",
            post(comment_batch),
        )
        .route(
            "/promotion/buyerShow/commentInfo/showOrHide",
            post(comment_show_or_hide),
        )
        .route(
            "/promotion/buyerShow/commentInfo/isTop",
            post(comment_is_top),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/promotion/buyerShow/commentInfo/list",
            "BuyerShowCommentController.list",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/commentInfo/audit",
            "BuyerShowCommentController.audit",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/commentInfo/batch",
            "BuyerShowCommentController.batch",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/commentInfo/showOrHide",
            "BuyerShowCommentController.showOrHide",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/commentInfo/isTop",
            "BuyerShowCommentController.isTop",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/promotion/buyerShow/commentInfo/list`：买家秀评论分页。
///
/// 对应 Java `BuyerShowCommentController.list(BuyerShowCommentPageQuery query)`
/// → `BuyerShowCommentServiceImpl#list`。
async fn comment_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<BuyerShowCommentListQuery>,
) -> ApiResult<PageResult<BuyerShowCommentPageVO>> {
    // Java 侧无租户维度过滤（评论表本身不区分店铺/供应商），登录态即数据边界。
    // 记录操作者便于与 Java 的 `SecurityUtils` 审计口径对照。
    tracing::debug!(
        "买家秀评论列表: operator={}, buyer_show_id={:?}, status={:?}",
        auth.username,
        q.buyer_show_id,
        q.status
    );
    ok(state.marketing.buyer_show_comment.list(&q).await?)
}

/// `POST /adminapi/promotion/buyerShow/commentInfo/audit`：审核（通过、拒绝）。
///
/// 对应 Java `BuyerShowCommentController.audit(@RequestBody @Validated
/// BuyerShowCommentAuditParam param)` → `BuyerShowCommentServiceImpl#audit`。
/// Java 返回 `void`，此处回传提示文案。
async fn comment_audit(
    State(state): State<AdminState>,
    Json(param): Json<BuyerShowCommentAuditParam>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show_comment.audit(&param).await?;
    ok("审核成功")
}

/// `POST /adminapi/promotion/buyerShow/commentInfo/batch`：批量操作
/// （审核操作类型为 `audit`）。
///
/// 对应 Java `BuyerShowCommentController.batch(@RequestBody BatchDTO batch)`
/// → `BuyerShowCommentServiceImpl#batch`：`type != "audit"` 时返回 `false`
/// 且**无任何副作用**（与 Java 一致，不报错）。
async fn comment_batch(
    State(state): State<AdminState>,
    Json(batch): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.marketing.buyer_show_comment.batch(&batch).await?)
}

/// `POST /adminapi/promotion/buyerShow/commentInfo/showOrHide`：是否公开（公开、隐藏）。
///
/// 对应 Java `BuyerShowCommentController.showOrHide(@RequestBody @Validated
/// BuyerShowCommentShowOrHideParam param)` → `BuyerShowCommentServiceImpl#showOrHide`。
/// Java 返回 `void`，此处回传提示文案。
async fn comment_show_or_hide(
    State(state): State<AdminState>,
    Json(param): Json<BuyerShowCommentShowOrHideParam>,
) -> ApiResult<&'static str> {
    state
        .marketing
        .buyer_show_comment
        .show_or_hide(&param)
        .await?;
    ok("操作成功")
}

/// `POST /adminapi/promotion/buyerShow/commentInfo/isTop`：是否置顶（置顶、取消置顶）。
///
/// 对应 Java `BuyerShowCommentController.isTop(@RequestBody @Validated
/// BuyerShowCommentIsTopParam param)` → `BuyerShowCommentServiceImpl#isTop`。
/// Java 返回 `void`，此处回传提示文案。
async fn comment_is_top(
    State(state): State<AdminState>,
    Json(param): Json<BuyerShowCommentIsTopParam>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show_comment.is_top(&param).await?;
    ok("操作成功")
}
