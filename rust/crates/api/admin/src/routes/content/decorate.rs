//! 管理端页面装修域路由。
//! 对应原 Java `controller.decorate.DecorateController` /
//! `DecorateDiscreteController` / `DecoratePromoteController` /
//! `DecorateShareController` / `PcNavigationController` /
//! `PcCatFloorController` / `MobileCatNavController`。
//!
//! | 控制器 | 前缀 |
//! |--------|------|
//! | `DecorateController` | `/adminapi/decorate/decorate` |
//! | `PcNavigationController` | `/adminapi/decorate/pcNavigation` |
//! | `PcCatFloorController` | `/adminapi/decorate/pcCatFloor` |
//! | `MobileCatNavController` | `/adminapi/decorate/mobileCatNav` |
//! | `DecorateDiscreteController` | `/adminapi/decorate/decorateDiscrete` |
//! | `DecorateShareController` | `/adminapi/decorate/decorateShare` |
//! | `DecoratePromoteController` | `/adminapi/decorate/promote` |
//!
//! 跳过：`DecorateTemplateController`（模板库走外部 HTTP 转发）、
//! `promote/generateShortLink`（依赖 `ShortUrlService` 短链服务）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::content::decorate::{
    DecorateCreateDTO, DecorateDiscreteUpdateParam, DecorateDiscreteVO, DecorateListQuery,
    DecorateMemberDataVO, DecorateSaveDTO, DecorateShareInfoDTO, DecorateShareInfoVO,
    DecorateShareListQuery, DecorateShareVO, DecorateUpdateDTO, DecorateVO, PcCatFloorCreateDTO,
    PcCatFloorListQuery, PcCatFloorUpdateDTO, PcCatFloorVO, PcNavTreeVO, PcNavigationCreateDTO,
    PcNavigationListQuery, PcNavigationUpdateDTO, PcNavigationVO,
};
use tigshop_core::models::{BatchDTO, OperateDTO, UpdateFieldDTO};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 页面装修域路由（挂载于 `/adminapi` 下）。
pub fn routes(_state: &AdminState) -> Router<AdminState> {
    Router::new()
        // 装修页 DecorateController
        .route("/decorate/decorate/list", get(decorate_list))
        .route("/decorate/decorate/detail", get(decorate_detail))
        .route("/decorate/decorate/create", post(decorate_create))
        .route("/decorate/decorate/update", post(decorate_update))
        .route(
            "/decorate/decorate/updateCustomDecorate",
            post(decorate_update_custom),
        )
        .route("/decorate/decorate/del", post(decorate_del))
        .route(
            "/decorate/decorate/updateField",
            post(decorate_update_field),
        )
        .route("/decorate/decorate/batch", post(decorate_batch))
        .route("/decorate/decorate/copy", post(decorate_copy))
        .route("/decorate/decorate/setHome", post(decorate_set_home))
        .route("/decorate/decorate/saveDraft", post(decorate_save_draft))
        .route("/decorate/decorate/publish", post(decorate_publish))
        .route(
            "/decorate/decorate/loadDraftData",
            get(decorate_load_draft_data),
        )
        .route(
            "/decorate/decorate/getH5DecorateList",
            get(decorate_h5_list),
        )
        .route(
            "/decorate/decorate/getCustomDecorateList",
            get(decorate_custom_list),
        )
        .route(
            "/decorate/decorate/bindingH5Decorate",
            post(decorate_binding_h5),
        )
        .route(
            "/decorate/decorate/bindingCustomDecorate",
            post(decorate_binding_custom),
        )
        .route(
            "/decorate/decorate/cancelBinding",
            post(decorate_cancel_binding),
        )
        // PC 导航 PcNavigationController
        .route("/decorate/pcNavigation/list", get(nav_list))
        .route("/decorate/pcNavigation/detail", get(nav_detail))
        .route("/decorate/pcNavigation/create", post(nav_create))
        .route("/decorate/pcNavigation/update", post(nav_update))
        .route("/decorate/pcNavigation/del", post(nav_del))
        .route("/decorate/pcNavigation/updateField", post(nav_update_field))
        .route("/decorate/pcNavigation/batch", post(nav_batch))
        .route("/decorate/pcNavigation/selectLink", get(nav_select_link))
        .route("/decorate/pcNavigation/getParentNav", get(nav_parent_tree))
        // PC 分类楼层 PcCatFloorController
        .route("/decorate/pcCatFloor/list", get(floor_list))
        .route("/decorate/pcCatFloor/detail", get(floor_detail))
        .route("/decorate/pcCatFloor/create", post(floor_create))
        .route("/decorate/pcCatFloor/update", post(floor_update))
        .route("/decorate/pcCatFloor/del", post(floor_del))
        .route("/decorate/pcCatFloor/updateField", post(floor_update_field))
        .route("/decorate/pcCatFloor/batch", post(floor_batch))
        .route("/decorate/pcCatFloor/clearCache", post(floor_clear_cache))
        // 手机分类导航 MobileCatNavController 的 7 条路由已移交 content::mobile_cat_nav 正式实现
        // （crates/api/admin/src/routes/mobile_cat_nav.rs），此处不得再注册，
        // 否则 axum `Router::merge` 会因同一 (method, path) 重复而启动 panic。
        // 装修组件 DecorateDiscreteController
        .route("/decorate/decorateDiscrete/detail", get(discrete_detail))
        .route("/decorate/decorateDiscrete/update", post(discrete_update))
        .route(
            "/decorate/decorateDiscrete/memberDecorateData",
            get(discrete_member_data),
        )
        // 装修分享 DecorateShareController
        .route("/decorate/decorateShare/list", get(share_list))
        .route("/decorate/decorateShare/detail", get(share_detail))
        .route("/decorate/decorateShare/create", post(share_create))
        .route("/decorate/decorateShare/update", post(share_update))
        .route("/decorate/decorateShare/del", post(share_del))
        .route(
            "/decorate/decorateShare/updateField",
            post(share_update_field),
        )
        .route("/decorate/decorateShare/batch", post(share_batch))
        .route("/decorate/decorateShare/share", get(share_generate))
        .route("/decorate/decorateShare/import", get(share_import))
        // 推广 DecoratePromoteController
        .route(
            "/decorate/promote/saveShareInfo",
            post(promote_save_share_info),
        )
        .route("/decorate/promote/shareInfo", get(promote_share_info))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/decorate/decorate/list",
            "DecorateController.list",
        ),
        (
            "GET",
            "/adminapi/decorate/decorate/detail",
            "DecorateController.detail",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/create",
            "DecorateController.create",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/update",
            "DecorateController.update",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/updateCustomDecorate",
            "DecorateController.updateCustomDecorate",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/del",
            "DecorateController.del",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/updateField",
            "DecorateController.updateField",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/batch",
            "DecorateController.batch",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/copy",
            "DecorateController.copy",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/setHome",
            "DecorateController.setHome",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/saveDraft",
            "DecorateController.saveDraft",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/publish",
            "DecorateController.publish",
        ),
        (
            "GET",
            "/adminapi/decorate/decorate/loadDraftData",
            "DecorateController.loadDraftData",
        ),
        (
            "GET",
            "/adminapi/decorate/decorate/getH5DecorateList",
            "DecorateController.getH5DecorateList",
        ),
        (
            "GET",
            "/adminapi/decorate/decorate/getCustomDecorateList",
            "DecorateController.getCustomDecorateList",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/bindingH5Decorate",
            "DecorateController.bindingH5Decorate",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/bindingCustomDecorate",
            "DecorateController.bindingCustomDecorate",
        ),
        (
            "POST",
            "/adminapi/decorate/decorate/cancelBinding",
            "DecorateController.cancelBinding",
        ),
        (
            "GET",
            "/adminapi/decorate/pcNavigation/list",
            "PcNavigationController.list",
        ),
        (
            "GET",
            "/adminapi/decorate/pcNavigation/detail",
            "PcNavigationController.detail",
        ),
        (
            "POST",
            "/adminapi/decorate/pcNavigation/create",
            "PcNavigationController.create",
        ),
        (
            "POST",
            "/adminapi/decorate/pcNavigation/update",
            "PcNavigationController.update",
        ),
        (
            "POST",
            "/adminapi/decorate/pcNavigation/del",
            "PcNavigationController.del",
        ),
        (
            "POST",
            "/adminapi/decorate/pcNavigation/updateField",
            "PcNavigationController.updateField",
        ),
        (
            "POST",
            "/adminapi/decorate/pcNavigation/batch",
            "PcNavigationController.batch",
        ),
        (
            "GET",
            "/adminapi/decorate/pcNavigation/selectLink",
            "PcNavigationController.selectLink",
        ),
        (
            "GET",
            "/adminapi/decorate/pcNavigation/getParentNav",
            "PcNavigationController.getParentNav",
        ),
        (
            "GET",
            "/adminapi/decorate/pcCatFloor/list",
            "PcCatFloorController.list",
        ),
        (
            "GET",
            "/adminapi/decorate/pcCatFloor/detail",
            "PcCatFloorController.detail",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/create",
            "PcCatFloorController.create",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/update",
            "PcCatFloorController.update",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/del",
            "PcCatFloorController.del",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/updateField",
            "PcCatFloorController.updateField",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/batch",
            "PcCatFloorController.batch",
        ),
        (
            "POST",
            "/adminapi/decorate/pcCatFloor/clearCache",
            "PcCatFloorController.clearCache",
        ),
        // mobileCatNav 的 7 条 RouteDoc 已移交 content::mobile_cat_nav（见其 implemented_routes()）
        (
            "GET",
            "/adminapi/decorate/decorateDiscrete/detail",
            "DecorateDiscreteController.detail",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateDiscrete/update",
            "DecorateDiscreteController.update",
        ),
        (
            "GET",
            "/adminapi/decorate/decorateDiscrete/memberDecorateData",
            "DecorateDiscreteController.memberDecorateData",
        ),
        (
            "GET",
            "/adminapi/decorate/decorateShare/list",
            "DecorateShareController.list",
        ),
        (
            "GET",
            "/adminapi/decorate/decorateShare/detail",
            "DecorateShareController.detail",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateShare/create",
            "DecorateShareController.create",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateShare/update",
            "DecorateShareController.update",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateShare/del",
            "DecorateShareController.del",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateShare/updateField",
            "DecorateShareController.updateField",
        ),
        (
            "POST",
            "/adminapi/decorate/decorateShare/batch",
            "DecorateShareController.batch",
        ),
        (
            "GET",
            "/adminapi/decorate/decorateShare/share",
            "DecorateShareController.share",
        ),
        (
            "GET",
            "/adminapi/decorate/decorateShare/import",
            "DecorateShareController.import",
        ),
        (
            "POST",
            "/adminapi/decorate/promote/saveShareInfo",
            "DecoratePromoteController.saveShareInfo",
        ),
        (
            "GET",
            "/adminapi/decorate/promote/shareInfo",
            "DecoratePromoteController.shareInfo",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ————————————————————— 通用查询参数 —————————————————————

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdQuery {
    id: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct DetailQuery {
    id: Option<i32>,
    locale_id: Option<i32>,
    parent_id: Option<i32>,
    decorate_type: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SetHomeBody {
    id: Option<i32>,
    page_type: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShareIdQuery {
    decorate_id: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct SnQuery {
    decorate_sn: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct TypeQuery {
    r#type: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UrlQuery {
    url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShareCreateBody {
    decorate_id: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ShareUpdateBody {
    share_id: Option<i32>,
    decorate_id: Option<i32>,
}

// ————————————————————— 装修页 —————————————————————

/// `GET /adminapi/decorate/decorate/list`：装修页分页。
async fn decorate_list(
    State(state): State<AdminState>,
    Query(q): Query<DecorateListQuery>,
) -> ApiResult<PageResult<DecorateVO>> {
    ok(state.content.decorate.list(&q).await?)
}

/// `GET /adminapi/decorate/decorate/detail`：装修页详情。
async fn decorate_detail(
    State(state): State<AdminState>,
    Query(q): Query<DetailQuery>,
) -> ApiResult<DecorateVO> {
    ok(state
        .content
        .decorate
        .detail(q.id, q.locale_id, q.parent_id, q.decorate_type)
        .await?)
}

/// `POST /adminapi/decorate/decorate/create`：新建装修页，返回 `{decorateId}`。
async fn decorate_create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(mut dto): Json<DecorateCreateDTO>,
) -> ApiResult<serde_json::Value> {
    // 原版前端“添加页面”不提交 decorateType；根据来源页补默认类型，
    // 避免在 PC 装修页新建的页面落成 H5（type=1）后从列表消失。
    if dto.decorate_type.is_none() {
        let referer = headers
            .get(axum::http::header::REFERER)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();
        dto.decorate_type = if referer.contains("mobile-decorate") {
            Some(1)
        } else if referer.contains("pc-decorate") {
            Some(2)
        } else {
            None
        };
    }
    let id = state.content.decorate.create(&dto).await?;
    ok(serde_json::json!({ "decorateId": id }))
}

/// `POST /adminapi/decorate/decorate/update`：更新装修页。
async fn decorate_update(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.update(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/updateCustomDecorate`：自定义页快速编辑。
async fn decorate_update_custom(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.update_custom(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/del`：删除装修页。
async fn decorate_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.del(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/updateField`：通用字段更新。
async fn decorate_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.update_field(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/batch`：批量操作。
async fn decorate_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.batch(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/copy`：复制装修页。
async fn decorate_copy(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.copy(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/setHome`：设为首页。
async fn decorate_set_home(
    State(state): State<AdminState>,
    Json(body): Json<SetHomeBody>,
) -> ApiResult<bool> {
    let operate = OperateDTO { id: body.id };
    ok(state
        .content
        .decorate
        .set_home(&operate, body.page_type)
        .await?)
}

/// `POST /adminapi/decorate/decorate/saveDraft`：保存草稿。
async fn decorate_save_draft(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateSaveDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.save_draft(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/publish`：发布装修。
async fn decorate_publish(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateSaveDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.publish(&dto).await?)
}

/// `GET /adminapi/decorate/decorate/loadDraftData?id=`：加载草稿数据。
async fn decorate_load_draft_data(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .content
        .decorate
        .load_draft_data(q.id.unwrap_or_default())
        .await?)
}

/// `GET /adminapi/decorate/decorate/getH5DecorateList`：H5 装修页列表（type=1、已发布）。
async fn decorate_h5_list(
    State(state): State<AdminState>,
    Query(mut q): Query<DecorateListQuery>,
) -> ApiResult<PageResult<DecorateVO>> {
    q.decorate_type = Some("1".into());
    q.status = Some(1);
    ok(state.content.decorate.list(&q).await?)
}

/// `GET /adminapi/decorate/decorate/getCustomDecorateList`：自定义页列表（type=3、已发布）。
async fn decorate_custom_list(
    State(state): State<AdminState>,
    Query(mut q): Query<DecorateListQuery>,
) -> ApiResult<PageResult<DecorateVO>> {
    q.decorate_type = Some("3".into());
    q.status = Some(1);
    ok(state.content.decorate.list(&q).await?)
}

/// `POST /adminapi/decorate/decorate/bindingH5Decorate`：绑定 H5 页面。
async fn decorate_binding_h5(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.binding(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/bindingCustomDecorate`：绑定自定义页。
async fn decorate_binding_custom(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.binding(&dto).await?)
}

/// `POST /adminapi/decorate/decorate/cancelBinding`：解除绑定。
async fn decorate_cancel_binding(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.cancel_binding(&dto).await?)
}

// ————————————————————— PC 导航 —————————————————————

/// `GET /adminapi/decorate/pcNavigation/list`：PC 导航分页。
async fn nav_list(
    State(state): State<AdminState>,
    Query(q): Query<PcNavigationListQuery>,
) -> ApiResult<PageResult<PcNavigationVO>> {
    ok(state.content.decorate.pc_navigation_list(&q).await?)
}

/// `GET /adminapi/decorate/pcNavigation/detail?id=`：PC 导航详情。
async fn nav_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<PcNavigationVO> {
    ok(state
        .content
        .decorate
        .pc_navigation_detail(q.id.unwrap_or_default())
        .await?)
}

/// `POST /adminapi/decorate/pcNavigation/create`：新建 PC 导航。
async fn nav_create(
    State(state): State<AdminState>,
    Json(dto): Json<PcNavigationCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state.content.decorate.pc_navigation_create(&dto).await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/decorate/pcNavigation/update`：更新 PC 导航。
async fn nav_update(
    State(state): State<AdminState>,
    Json(dto): Json<PcNavigationUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.pc_navigation_update(&dto).await?)
}

/// `POST /adminapi/decorate/pcNavigation/del`：删除 PC 导航。
async fn nav_del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.content.decorate.pc_navigation_del(&dto).await?)
}

/// `POST /adminapi/decorate/pcNavigation/updateField`：通用字段更新。
async fn nav_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .content
        .decorate
        .pc_navigation_update_field(&dto)
        .await?)
}

/// `POST /adminapi/decorate/pcNavigation/batch`：批量操作。
async fn nav_batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.content.decorate.pc_navigation_batch(&dto).await?)
}

/// `GET /adminapi/decorate/pcNavigation/selectLink`：可选链接地址。
async fn nav_select_link(State(state): State<AdminState>) -> ApiResult<Vec<serde_json::Value>> {
    ok(state.content.decorate.pc_navigation_select_link())
}

/// `GET /adminapi/decorate/pcNavigation/getParentNav?type=`：上级导航树。
async fn nav_parent_tree(
    State(state): State<AdminState>,
    Query(q): Query<TypeQuery>,
) -> ApiResult<Vec<PcNavTreeVO>> {
    ok(state
        .content
        .decorate
        .pc_navigation_parent_nav(q.r#type.unwrap_or(0))
        .await?)
}

// ————————————————————— PC 分类楼层 —————————————————————

/// `GET /adminapi/decorate/pcCatFloor/list`：分类楼层分页。
async fn floor_list(
    State(state): State<AdminState>,
    Query(q): Query<PcCatFloorListQuery>,
) -> ApiResult<PageResult<PcCatFloorVO>> {
    ok(state.content.decorate.pc_cat_floor_list(&q).await?)
}

/// `GET /adminapi/decorate/pcCatFloor/detail?id=`：分类楼层详情。
async fn floor_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<PcCatFloorVO> {
    ok(state
        .content
        .decorate
        .pc_cat_floor_detail(q.id.unwrap_or_default())
        .await?)
}

/// `POST /adminapi/decorate/pcCatFloor/create`：新建分类楼层。
async fn floor_create(
    State(state): State<AdminState>,
    Json(dto): Json<PcCatFloorCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state.content.decorate.pc_cat_floor_create(&dto).await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/decorate/pcCatFloor/update`：更新分类楼层。
async fn floor_update(
    State(state): State<AdminState>,
    Json(dto): Json<PcCatFloorUpdateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.pc_cat_floor_update(&dto).await?)
}

/// `POST /adminapi/decorate/pcCatFloor/del`：删除分类楼层。
async fn floor_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.pc_cat_floor_del(&dto).await?)
}

/// `POST /adminapi/decorate/pcCatFloor/updateField`：通用字段更新。
async fn floor_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .content
        .decorate
        .pc_cat_floor_update_field(&dto)
        .await?)
}

/// `POST /adminapi/decorate/pcCatFloor/batch`：批量操作。
async fn floor_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.pc_cat_floor_batch(&dto).await?)
}

/// `POST /adminapi/decorate/pcCatFloor/clearCache`：清理楼层缓存（空实现）。
async fn floor_clear_cache(State(state): State<AdminState>) -> ApiResult<bool> {
    state.content.decorate.pc_cat_floor_clear_cache();
    ok(true)
}

// ————————————————————— 手机分类导航 → 已移交 content::mobile_cat_nav —————————————————————
//
// 原先此处内联实现了 7 个 `mobileCatNav/*` handler（引导期占位）。content::mobile_cat_nav 已
// 按契约正式实现该控制器（含 DTO 校验与单测），故本文件删除这批 handler，
// 避免同一路径被 `Router::merge` 注册两次而在服务启动时 panic。

// ————————————————————— 装修组件 —————————————————————

/// `GET /adminapi/decorate/decorateDiscrete/detail?decorateSn=`：装修组件详情。
async fn discrete_detail(
    State(state): State<AdminState>,
    Query(q): Query<SnQuery>,
) -> ApiResult<Option<DecorateDiscreteVO>> {
    let sn = q.decorate_sn.unwrap_or_default();
    ok(state.content.decorate.discrete_detail(&sn).await?)
}

/// `POST /adminapi/decorate/decorateDiscrete/update`：装修组件保存（upsert）。
async fn discrete_update(
    State(state): State<AdminState>,
    Json(param): Json<DecorateDiscreteUpdateParam>,
) -> ApiResult<bool> {
    ok(state.content.decorate.discrete_update(&param).await?)
}

/// `GET /adminapi/decorate/decorateDiscrete/memberDecorateData`：个人中心基础数据。
async fn discrete_member_data(State(state): State<AdminState>) -> ApiResult<DecorateMemberDataVO> {
    ok(state.content.decorate.member_decorate_data())
}

// ————————————————————— 装修分享 —————————————————————

/// `GET /adminapi/decorate/decorateShare/list`：分享记录分页。
async fn share_list(
    State(state): State<AdminState>,
    Query(q): Query<DecorateShareListQuery>,
) -> ApiResult<PageResult<DecorateShareVO>> {
    ok(state.content.decorate.decorate_share_list(&q).await?)
}

/// `GET /adminapi/decorate/decorateShare/detail?id=`：分享记录详情。
async fn share_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<DecorateShareVO> {
    ok(state
        .content
        .decorate
        .decorate_share_detail(q.id.unwrap_or_default())
        .await?)
}

/// `POST /adminapi/decorate/decorateShare/create`：新建分享记录。
async fn share_create(
    State(state): State<AdminState>,
    Json(body): Json<ShareCreateBody>,
) -> ApiResult<DecorateShareVO> {
    ok(state
        .content
        .decorate
        .decorate_share_create(body.decorate_id.unwrap_or_default())
        .await?)
}

/// `POST /adminapi/decorate/decorateShare/update`：更新分享记录（重新签发）。
async fn share_update(
    State(state): State<AdminState>,
    Json(body): Json<ShareUpdateBody>,
) -> ApiResult<bool> {
    ok(state
        .content
        .decorate
        .decorate_share_update(
            body.share_id.unwrap_or_default(),
            body.decorate_id.unwrap_or_default(),
        )
        .await?)
}

/// `POST /adminapi/decorate/decorateShare/del`：删除分享记录。
async fn share_del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.decorate_share_del(&dto).await?)
}

/// `POST /adminapi/decorate/decorateShare/updateField`：通用字段更新。
async fn share_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .content
        .decorate
        .decorate_share_update_field(&dto)
        .await?)
}

/// `POST /adminapi/decorate/decorateShare/batch`：批量操作。
async fn share_batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.decorate_share_batch(&dto).await?)
}

/// `GET /adminapi/decorate/decorateShare/share?decorateId=`：生成页面分享。
async fn share_generate(
    State(state): State<AdminState>,
    Query(q): Query<ShareIdQuery>,
) -> ApiResult<DecorateShareVO> {
    ok(state
        .content
        .decorate
        .share(q.decorate_id.unwrap_or_default())
        .await?)
}

/// `GET /adminapi/decorate/decorateShare/import?url=`：分享链接导入。
async fn share_import(
    State(state): State<AdminState>,
    Query(q): Query<UrlQuery>,
) -> ApiResult<bool> {
    let url = q.url.unwrap_or_default();
    ok(state.content.decorate.decorate_share_import(&url).await?)
}

// ————————————————————— 推广 —————————————————————

/// `POST /adminapi/decorate/promote/saveShareInfo`：保存装修页分享信息。
async fn promote_save_share_info(
    State(state): State<AdminState>,
    Json(dto): Json<DecorateShareInfoDTO>,
) -> ApiResult<bool> {
    ok(state.content.decorate.save_share_info(&dto).await?)
}

/// `GET /adminapi/decorate/promote/shareInfo?decorateId=`：读取装修页分享信息。
async fn promote_share_info(
    State(state): State<AdminState>,
    Query(q): Query<ShareIdQuery>,
) -> ApiResult<DecorateShareInfoVO> {
    ok(state
        .content
        .decorate
        .share_info(q.decorate_id.unwrap_or_default())
        .await?)
}
