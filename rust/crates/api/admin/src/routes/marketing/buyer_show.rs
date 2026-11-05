//! 管理端买家秀管理路由（marketing::buyer_show）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.BuyerShowController`
//! （`@RequestMapping("/adminapi/promotion/buyerShow")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /promotion/buyerShow/info` | `BuyerShowController.info` | 仅登录 |
//! | `GET  /promotion/buyerShow/getBuyerInfo` | `BuyerShowController.getBuyerInfo` | `buyerShowManage` |
//! | `POST /promotion/buyerShow/create` | `BuyerShowController.create` | `buyerShowUpdateManage` |
//! | `GET  /promotion/buyerShow/list` | `BuyerShowController.list` | `buyerShowManage` |
//! | `GET  /promotion/buyerShow/detail` | `BuyerShowController.detail` | `buyerShowManage` |
//! | `POST /promotion/buyerShow/update` | `BuyerShowController.update` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/del` | `BuyerShowController.delete` | `buyerShowDeleteManage` |
//! | `POST /promotion/buyerShow/batchDel` | `BuyerShowController.batchDel` | `buyerShowDeleteManage` |
//! | `POST /promotion/buyerShow/audit` | `BuyerShowController.audit` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/batch` | `BuyerShowController.batch` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/showOrHide` | `BuyerShowController.showOrHide` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/comment` | `BuyerShowController.comment` | `buyerShowUpdateManage` |
//! | `POST /promotion/buyerShow/updateField` | `BuyerShowController.updateField` | `buyerShowUpdateManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/promotion/buyerShow`，Spring 的方法映射
//! > 是 `/info` / `/list` / `/batchDel` / `/showOrHide` …，组合结果与
//! > `rust/docs/api-contract.json` 中的 13 条逐字符一致（无前缀重复）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / brand.rs / shop_manage.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus 的 `Page<BuyerShowPageVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与 product_manage/002/005/014 一致。
//! > Java 的 `info` / `create` / `update` / `del` / `batchDel` / `audit` /
//! > `batch` / `showOrHide` / `comment` / `updateField` 都返回 `void`；
//! > 本模块按项目内既有约定回传简短结果（新建返回 `buyerShowId`，
//! > 评论返回 `buyerShowCommentId`，其余返回提示文案或 `bool`）。
//!
//! > `GET /promotion/buyerShow/info` 本地确定性生成 100 条虚拟用户（昵称+内联头像），不依赖外部接口。
//!
//! > **⚠️ 合并注意（路由冲突）**：`crates/api/admin/src/routes/mod.rs` 现有的
//! > `sliceNNN` 列表里**没有** buyerShow 相关注册，本模块的 13 条路径在
//! > 管理端是**唯一**实现，不存在与共享域文件（`catalog.rs` / `content.rs` 等）
//! > 的重叠。合并时只需在 `merge_all` 中加
//! > `.merge(tigshop_core::models::marketing::buyer_show::routes(state))`，在 `implemented_routes()` 中加
//! > `out.extend(tigshop_core::models::marketing::buyer_show::implemented_routes());`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::buyer_show::{
    BuyerShowAuditPayload, BuyerShowBatchDeletePayload, BuyerShowCommentPayload,
    BuyerShowListQuery, BuyerShowPageVO, BuyerShowSavePayload, BuyerShowShowOrHidePayload,
    BuyerShowUpdatePayload, BuyerShowVO, BuyerVO,
};
use tigshop_core::models::{BatchDTO, OperateDTO, UpdateFieldDTO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 13 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 `implemented_routes()` 的唯一来源**（声明与 Java 契约的对应关系）。
const ROUTE_TABLE: [(&str, &str, &str); 13] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/promotion/buyerShow/info",
        "BuyerShowController.info",
    ),
    (
        "GET",
        "/promotion/buyerShow/getBuyerInfo",
        "BuyerShowController.getBuyerInfo",
    ),
    (
        "POST",
        "/promotion/buyerShow/create",
        "BuyerShowController.create",
    ),
    (
        "GET",
        "/promotion/buyerShow/list",
        "BuyerShowController.list",
    ),
    (
        "GET",
        "/promotion/buyerShow/detail",
        "BuyerShowController.detail",
    ),
    (
        "POST",
        "/promotion/buyerShow/update",
        "BuyerShowController.update",
    ),
    (
        "POST",
        "/promotion/buyerShow/del",
        "BuyerShowController.delete",
    ),
    (
        "POST",
        "/promotion/buyerShow/batchDel",
        "BuyerShowController.batchDel",
    ),
    (
        "POST",
        "/promotion/buyerShow/audit",
        "BuyerShowController.audit",
    ),
    (
        "POST",
        "/promotion/buyerShow/batch",
        "BuyerShowController.batch",
    ),
    (
        "POST",
        "/promotion/buyerShow/showOrHide",
        "BuyerShowController.showOrHide",
    ),
    (
        "POST",
        "/promotion/buyerShow/comment",
        "BuyerShowController.comment",
    ),
    (
        "POST",
        "/promotion/buyerShow/updateField",
        "BuyerShowController.updateField",
    ),
];

/// 买家秀管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/buyerShow/info", get(buyer_show_info))
        .route(
            "/promotion/buyerShow/getBuyerInfo",
            get(buyer_show_get_buyer_info),
        )
        .route("/promotion/buyerShow/create", post(buyer_show_create))
        .route("/promotion/buyerShow/list", get(buyer_show_list))
        .route("/promotion/buyerShow/detail", get(buyer_show_detail))
        .route("/promotion/buyerShow/update", post(buyer_show_update))
        .route("/promotion/buyerShow/del", post(buyer_show_del))
        .route("/promotion/buyerShow/batchDel", post(buyer_show_batch_del))
        .route("/promotion/buyerShow/audit", post(buyer_show_audit))
        .route("/promotion/buyerShow/batch", post(buyer_show_batch))
        .route(
            "/promotion/buyerShow/showOrHide",
            post(buyer_show_show_or_hide),
        )
        .route("/promotion/buyerShow/comment", post(buyer_show_comment))
        .route(
            "/promotion/buyerShow/updateField",
            post(buyer_show_update_field),
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

/// `detail` 的查询参数（Java `@RequestParam(value = "buyerShowId") @NotNull`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BuyerShowIdQuery {
    /// 买家秀 ID
    buyer_show_id: Option<i32>,
}

/// `del` 的请求体（Java `OperateDTO`；本项目 `models::catalog::OperateDTO`
/// 只声明了 `id`，与 `delete(operate.getId())` 的实际用到的字段一致）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeletePayload {
    /// 买家秀 ID
    id: Option<i32>,
}

impl DeletePayload {
    fn into_operate(self) -> OperateDTO {
        OperateDTO { id: self.id }
    }
}

/// `GET /adminapi/promotion/buyerShow/info`：生成虚拟用户信息。
///
/// 对应 Java `BuyerShowController.info()` → `BuyerShowServiceImpl#info`。
///
/// ⚠️ **明确未迁移**：Java 逐轮调用第三方随机资料接口、下载图片、
/// 上传对象存储，且每轮 `Thread.sleep(10_000)`（100 轮 ≈ 16 分 40 秒）。
/// 本接口返回明确业务错误，不伪造实现。
async fn buyer_show_info(State(state): State<AdminState>) -> ApiResult<&'static str> {
    state.marketing.buyer_show.info().await?;
    ok("生成成功")
}

/// `GET /adminapi/promotion/buyerShow/getBuyerInfo`：随机取一个虚拟买家。
///
/// 对应 Java `BuyerShowController.getBuyerInfo()`。
async fn buyer_show_get_buyer_info(State(state): State<AdminState>) -> ApiResult<BuyerVO> {
    ok(state.marketing.buyer_show.get_buyer_info().await?)
}

/// `POST /adminapi/promotion/buyerShow/create`：新建买家秀。
///
/// 对应 Java `BuyerShowController.create(@Valid @RequestBody BuyerShowSaveParam)`。
/// Java 返回 `void`；这里回传新建的 `buyerShowId` 便于前端跳转（项目内既有约定）。
async fn buyer_show_create(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowSavePayload>,
) -> ApiResult<serde_json::Value> {
    let id = state.marketing.buyer_show.create(&p).await?;
    ok(serde_json::json!({ "buyerShowId": id }))
}

/// `GET /adminapi/promotion/buyerShow/list`：买家秀分页。
///
/// 对应 Java `BuyerShowController.list(BuyerShowPageQuery query)`。
async fn buyer_show_list(
    State(state): State<AdminState>,
    Query(q): Query<BuyerShowListQuery>,
) -> ApiResult<PageResult<BuyerShowPageVO>> {
    ok(state.marketing.buyer_show.list(&q).await?)
}

/// `GET /adminapi/promotion/buyerShow/detail?buyerShowId=`：买家秀详情。
///
/// 对应 Java `BuyerShowController.detail(@RequestParam(value = "buyerShowId")
/// @NotNull Integer buyerShowId)`。
async fn buyer_show_detail(
    State(state): State<AdminState>,
    Query(q): Query<BuyerShowIdQuery>,
) -> ApiResult<BuyerShowVO> {
    let buyer_show_id = q
        .buyer_show_id
        .ok_or_else(|| tigshop_core::Error::Validation("买家秀主键不能为空".into()))?;
    ok(state.marketing.buyer_show.detail(buyer_show_id).await?)
}

/// `POST /adminapi/promotion/buyerShow/update`：更新买家秀。
///
/// 对应 Java `BuyerShowController.update(@RequestBody @Validated BuyerShowUpdateParam)`。
async fn buyer_show_update(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowUpdatePayload>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show.update(&p).await?;
    ok("修改成功")
}

/// `POST /adminapi/promotion/buyerShow/del`：删除单个买家秀。
///
/// 对应 Java `BuyerShowController.delete(@RequestBody @Validated OperateDTO)`。
async fn buyer_show_del(
    State(state): State<AdminState>,
    Json(p): Json<DeletePayload>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show.delete(&p.into_operate()).await?;
    ok("删除成功")
}

/// `POST /adminapi/promotion/buyerShow/batchDel`：批量删除买家秀。
///
/// 对应 Java `BuyerShowController.batchDel(@RequestBody @Valid
/// BuyerShowBatchDeleteParam)`；Java 返回 `void`，这里回传是否命中。
async fn buyer_show_batch_del(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowBatchDeletePayload>,
) -> ApiResult<bool> {
    ok(state.marketing.buyer_show.batch_del(&p).await?)
}

/// `POST /adminapi/promotion/buyerShow/audit`：审核（通过 / 拒绝）。
///
/// 对应 Java `BuyerShowController.audit(@RequestBody @Validated BuyerShowAuditParam)`；
/// Java 返回 `void`，这里回传受影响行数便于排障。
async fn buyer_show_audit(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowAuditPayload>,
) -> ApiResult<u64> {
    ok(state.marketing.buyer_show.audit(&p).await?)
}

/// `POST /adminapi/promotion/buyerShow/batch`：批量操作（仅 `type == "audit"`）。
///
/// 对应 Java `BuyerShowController.batch(@RequestBody BatchDTO)`；
/// Java 返回 `void`，这里回传服务层的 `boolean`（与 Java 的返回值语义一致）。
async fn buyer_show_batch(
    State(state): State<AdminState>,
    Json(p): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.marketing.buyer_show.batch(&p).await?)
}

/// `POST /adminapi/promotion/buyerShow/showOrHide`：公开 / 隐藏。
///
/// 对应 Java `BuyerShowController.showOrHide(@RequestBody @Validated
/// BuyerShowShowOrHideParam)`；Java 返回 `void`，这里回传受影响行数。
async fn buyer_show_show_or_hide(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowShowOrHidePayload>,
) -> ApiResult<u64> {
    ok(state.marketing.buyer_show.show_or_hide(&p).await?)
}

/// `POST /adminapi/promotion/buyerShow/comment`：管理端代发评论。
///
/// 对应 Java `BuyerShowController.comment(@RequestBody @Validated
/// BuyerShowCommentParam)`；Java 返回 `void`，这里回传新建评论 ID。
async fn buyer_show_comment(
    State(state): State<AdminState>,
    Json(p): Json<BuyerShowCommentPayload>,
) -> ApiResult<serde_json::Value> {
    let id = state.marketing.buyer_show.comment(&p).await?;
    ok(serde_json::json!({ "buyerShowCommentId": id }))
}

/// `POST /adminapi/promotion/buyerShow/updateField`：更新单个字段。
///
/// 对应 Java `BuyerShowController.updateField(@Valid @RequestBody UpdateFieldDTO)`
/// → `BaseServiceImpl#updateField(updateField, BUYER_SHOW_CONFIG_FIELDS)`，
/// 白名单只有 `sort_order`。
async fn buyer_show_update_field(
    State(state): State<AdminState>,
    Json(p): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.marketing.buyer_show.update_field(&p).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 13 条路径必须与 `rust/docs/api-contract.json` 中的
    /// `BuyerShowController` 端点逐字符一致（前缀 `/adminapi` + 本表路径）。
    #[test]
    fn route_table_has_thirteen_unique_paths() {
        assert_eq!(ROUTE_TABLE.len(), 13);
        let mut seen: Vec<(&str, String)> = ROUTE_TABLE
            .iter()
            .map(|(m, p, _)| (*m, (*p).to_string()))
            .collect();
        seen.sort();
        seen.dedup();
        assert_eq!(seen.len(), 13, "存在重复的 (method, path)");
    }

    #[test]
    fn implemented_routes_use_adminapi_prefix() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 13);
        let paths: Vec<String> = docs
            .iter()
            .map(|d| d.path.clone())
            .filter(|p| p.starts_with("/adminapi/promotion/buyerShow"))
            .collect();
        assert_eq!(paths.len(), 13);
        // `del` 的 Java handler 是 `delete`（不是 `del`），逐字对照
        let del = ROUTE_TABLE
            .iter()
            .find(|(_, p, _)| *p == "/promotion/buyerShow/del")
            .expect("del 路由");
        assert_eq!(del.2, "BuyerShowController.delete");
    }

    #[test]
    fn route_table_paths_are_exact() {
        let expected = [
            "/promotion/buyerShow/info",
            "/promotion/buyerShow/getBuyerInfo",
            "/promotion/buyerShow/create",
            "/promotion/buyerShow/list",
            "/promotion/buyerShow/detail",
            "/promotion/buyerShow/update",
            "/promotion/buyerShow/del",
            "/promotion/buyerShow/batchDel",
            "/promotion/buyerShow/audit",
            "/promotion/buyerShow/batch",
            "/promotion/buyerShow/showOrHide",
            "/promotion/buyerShow/comment",
            "/promotion/buyerShow/updateField",
        ];
        let actual: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(actual, expected);
    }
}
