//! 管理端微信直播路由（content::wechat_live，14 条）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.content.WechatLiveController`
//! （`@RequestMapping("/adminapi/content/wechatLive")`，类级
//! `@PreAuthorize("@pms.hasPermission('wechatLive')")`）：
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 |
//! |----------------------------------|--------------|
//! | `GET  /content/wechatLive/list` | `WechatLiveController.list` |
//! | `GET  /content/wechatLive/detail` | `WechatLiveController.detail` |
//! | `POST /content/wechatLive/update` | `WechatLiveController.update` |
//! | `GET  /content/wechatLive/refresh` | `WechatLiveController.refresh` |
//! | `POST /content/wechatLive/create` | `WechatLiveController.create` |
//! | `POST /content/wechatLive/delete` | `WechatLiveController.delete` |
//! | `GET  /content/wechatLive/pushUrl/{roomId}` | `WechatLiveController.getPushUrl` |
//! | `GET  /content/wechatLive/promote/{roomId}` | `WechatLiveController.getPromoteData` |
//! | `GET  /content/wechatLive/syncFromWechat` | `WechatLiveController.syncFromWechat` |
//! | `POST /content/wechatLive/syncToWechat` | `WechatLiveController.syncToWechat` |
//! | `POST /content/wechatLive/addToRoom` | `WechatLiveController.addGoods` |
//! | `POST /content/wechatLive/removeFromRoom` | `WechatLiveController.removeGoods` |
//! | `GET  /content/wechatLive/room/{roomId}` | `WechatLiveController.getGoods` |
//! | `GET  /content/wechatLive/finderLiveRecord` | `WechatLiveController.getFinderLiveRecord` |
//!
//! > **鉴权**：Java 类级 `@PreAuthorize('wechatLive')`；Rust 只校验登录态
//! > （权限矩阵未实现），全部注册在管理端需登录路由组。
//!
//! > **外部微信接口（未迁移）**：`refresh` / `syncFromWechat` / `syncToWechat` /
//! > `pushUrl` / `finderLiveRecord` 依赖小程序 access_token 与微信开放平台
//! > HTTP 客户端，当前返回明确业务错误（详见服务层模块头）。

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::content::wechat_live::{
    WechatLiveDeleteParam, WechatLiveGoodsAddDTO, WechatLiveGoodsVO, WechatLiveListQuery,
    WechatLivePromoteVO, WechatLivePushUrlVO, WechatLiveRemoveGoodsQuery, WechatLiveRoomCreateDTO,
    WechatLiveUpdateDTO, WechatLiveVO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 17 条路由（`/adminapi` 前缀之后的路径 + 原 Java 方法名）。
/// 路径参数使用契约写法 `{roomId}`（axum 注册时为 `{roomId}`）。
/// 最后 3 条是新版管理端前端契约的 `promotion/wechatLive/*` 路径
/// （`view/admin/src/api/promotion/live.ts`；Java 控制器只挂
/// `content/wechatLive`，前端新版本改用 promotion 前缀）。
const ROUTE_TABLE: [(&str, &str, &str); 17] = [
    (
        "GET",
        "/content/wechatLive/list",
        "WechatLiveController.list",
    ),
    (
        "GET",
        "/content/wechatLive/detail",
        "WechatLiveController.detail",
    ),
    (
        "POST",
        "/content/wechatLive/update",
        "WechatLiveController.update",
    ),
    (
        "GET",
        "/content/wechatLive/refresh",
        "WechatLiveController.refresh",
    ),
    (
        "POST",
        "/content/wechatLive/create",
        "WechatLiveController.create",
    ),
    (
        "POST",
        "/content/wechatLive/delete",
        "WechatLiveController.delete",
    ),
    (
        "GET",
        "/content/wechatLive/pushUrl/{roomId}",
        "WechatLiveController.getPushUrl",
    ),
    (
        "GET",
        "/content/wechatLive/promote/{roomId}",
        "WechatLiveController.getPromoteData",
    ),
    (
        "GET",
        "/content/wechatLive/syncFromWechat",
        "WechatLiveController.syncFromWechat",
    ),
    (
        "POST",
        "/content/wechatLive/syncToWechat",
        "WechatLiveController.syncToWechat",
    ),
    (
        "POST",
        "/content/wechatLive/addToRoom",
        "WechatLiveController.addGoods",
    ),
    (
        "POST",
        "/content/wechatLive/removeFromRoom",
        "WechatLiveController.removeGoods",
    ),
    (
        "GET",
        "/content/wechatLive/room/{roomId}",
        "WechatLiveController.getGoods",
    ),
    (
        "GET",
        "/content/wechatLive/finderLiveRecord",
        "WechatLiveController.getFinderLiveRecord",
    ),
    (
        "GET",
        "/promotion/wechatLive/list",
        "WechatLiveController.list",
    ),
    (
        "GET",
        "/promotion/wechatLive/refresh",
        "WechatLiveController.refresh",
    ),
    (
        "POST",
        "/promotion/wechatLive/refresh",
        "WechatLiveController.refresh",
    ),
];

/// 微信直播路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/content/wechatLive/list", get(list))
        .route("/content/wechatLive/detail", get(detail))
        .route("/content/wechatLive/update", post(update))
        .route("/promotion/wechatLive/detail", get(detail))
        .route("/promotion/wechatLive/update", post(update))
        .route("/content/wechatLive/refresh", get(refresh))
        .route("/content/wechatLive/create", post(create))
        .route("/content/wechatLive/delete", post(delete))
        .route("/content/wechatLive/pushUrl/{roomId}", get(push_url))
        .route("/content/wechatLive/promote/{roomId}", get(promote))
        .route("/content/wechatLive/syncFromWechat", get(sync_from_wechat))
        .route("/content/wechatLive/syncToWechat", post(sync_to_wechat))
        .route("/content/wechatLive/addToRoom", post(add_to_room))
        .route("/content/wechatLive/removeFromRoom", post(remove_from_room))
        .route("/content/wechatLive/room/{roomId}", get(room_goods))
        .route(
            "/content/wechatLive/finderLiveRecord",
            get(finder_live_record),
        )
        // —— 新版前端 promotion 前缀（同一服务，路径别名） ——
        .route("/promotion/wechatLive/list", get(list))
        .route(
            "/promotion/wechatLive/refresh",
            get(refresh_noop).post(refresh_noop_post),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

/// `?id=` 查询参数。
#[derive(Debug, serde::Deserialize)]
struct IdQuery {
    id: i32,
}

/// `?id=`（字符串，视频号 ID）查询参数。
#[derive(Debug, serde::Deserialize)]
struct StrIdQuery {
    id: String,
}

/// `GET /adminapi/content/wechatLive/list`：直播间分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<WechatLiveListQuery>,
) -> ApiResult<PageResult<WechatLiveVO>> {
    ok(state.content.wechat_live.list(&q).await?)
}

/// `GET /adminapi/content/wechatLive/detail?id=`：直播间详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<WechatLiveVO>> {
    ok(state.content.wechat_live.detail(q.id).await?)
}

/// `POST /adminapi/content/wechatLive/update`：更新直播间（本地字段）。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<WechatLiveUpdateDTO>,
) -> ApiResult<()> {
    state.content.wechat_live.update(&dto).await?;
    ok(())
}

/// `GET /adminapi/content/wechatLive/refresh`：刷新直播间信息。
async fn refresh(State(state): State<AdminState>) -> ApiResult<()> {
    state.content.wechat_live.refresh().await?;
    ok(())
}

/// `GET|POST /adminapi/promotion/wechatLive/refresh`：刷新直播间（兼容桩）。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/promotion/live.ts#getLiveRefresh`。无微信凭据时
/// 返回 code:0 no-op（见 `services::content::wechat_live::refresh_noop`）。
async fn refresh_noop(State(state): State<AdminState>) -> ApiResult<()> {
    state.content.wechat_live.refresh_noop().await?;
    ok(())
}

/// POST 形态的 [`refresh_noop`]（前端另有 POST 调用方）。
async fn refresh_noop_post(State(state): State<AdminState>) -> ApiResult<()> {
    refresh_noop(State(state)).await
}

/// `POST /adminapi/content/wechatLive/create`：创建直播间（本地记录）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<WechatLiveRoomCreateDTO>,
) -> ApiResult<i32> {
    ok(state.content.wechat_live.create(&dto).await?)
}

/// `POST /adminapi/content/wechatLive/delete`：删除直播间（本地）。
async fn delete(
    State(state): State<AdminState>,
    Json(dto): Json<WechatLiveDeleteParam>,
) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("微信直播id不能为空".into()))?;
    state.content.wechat_live.delete(id).await?;
    ok(())
}

/// `GET /adminapi/content/wechatLive/pushUrl/{roomId}`：推流地址。
async fn push_url(
    State(state): State<AdminState>,
    Path(room_id): Path<i32>,
) -> ApiResult<WechatLivePushUrlVO> {
    ok(state.content.wechat_live.push_url(room_id).await?)
}

/// `GET /adminapi/content/wechatLive/promote/{roomId}`：推广信息（本地降级）。
async fn promote(
    State(state): State<AdminState>,
    Path(room_id): Path<i32>,
) -> ApiResult<WechatLivePromoteVO> {
    ok(state.content.wechat_live.promote(room_id).await?)
}

/// `GET /adminapi/content/wechatLive/syncFromWechat`：从微信同步。
async fn sync_from_wechat(State(state): State<AdminState>) -> ApiResult<()> {
    state.content.wechat_live.sync_from_wechat().await?;
    ok(())
}

/// `POST /adminapi/content/wechatLive/syncToWechat?id=`：同步到微信。
async fn sync_to_wechat(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<()> {
    state.content.wechat_live.sync_to_wechat(q.id).await?;
    ok(())
}

/// `POST /adminapi/content/wechatLive/addToRoom`：添加商品到直播间。
async fn add_to_room(
    State(state): State<AdminState>,
    Json(dto): Json<WechatLiveGoodsAddDTO>,
) -> ApiResult<()> {
    state.content.wechat_live.add_goods(&dto).await?;
    ok(())
}

/// `POST /adminapi/content/wechatLive/removeFromRoom`：从直播间移除商品。
async fn remove_from_room(
    State(state): State<AdminState>,
    Query(q): Query<WechatLiveRemoveGoodsQuery>,
) -> ApiResult<()> {
    let room_id = q
        .room_id
        .ok_or_else(|| tigshop_core::Error::Validation("直播间ID不能为空".into()))?;
    let goods_id = q
        .goods_id
        .ok_or_else(|| tigshop_core::Error::Validation("直播商品ID不能为空".into()))?;
    state
        .content
        .wechat_live
        .remove_goods(room_id, goods_id)
        .await?;
    ok(())
}

/// `GET /adminapi/content/wechatLive/room/{roomId}`：直播间商品列表。
async fn room_goods(
    State(state): State<AdminState>,
    Path(room_id): Path<i32>,
) -> ApiResult<Vec<WechatLiveGoodsVO>> {
    ok(state.content.wechat_live.room_goods(room_id).await?)
}

/// `GET /adminapi/content/wechatLive/finderLiveRecord?id=`：视频号直播记录。
async fn finder_live_record(
    State(state): State<AdminState>,
    Query(q): Query<StrIdQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.content.wechat_live.finder_live_record(&q.id).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 17, "契约 14 条 + 前端契约 promotion 别名 3 条");
        assert_eq!(docs.len(), ROUTE_TABLE.len());
        for (method, path, handler) in ROUTE_TABLE.iter() {
            let full = if path.contains("{roomId}") {
                path.replace("{roomId}", "{roomId}")
            } else {
                (*path).to_string()
            };
            let full = format!("/adminapi{full}");
            assert!(
                docs.iter()
                    .any(|d| d.method == *method && d.path == full && d.java_ref == *handler),
                "缺少 {method} {full} ({handler})"
            );
        }
    }

    #[test]
    fn routes_registers_all_paths_with_axum_param_syntax() {
        // axum 0.8 路由参数写法为 `{roomId}`（与契约一致）
        let registered = [
            ("GET", "/content/wechatLive/list"),
            ("GET", "/content/wechatLive/detail"),
            ("POST", "/content/wechatLive/update"),
            ("GET", "/content/wechatLive/refresh"),
            ("POST", "/content/wechatLive/create"),
            ("POST", "/content/wechatLive/delete"),
            ("GET", "/content/wechatLive/pushUrl/{roomId}"),
            ("GET", "/content/wechatLive/promote/{roomId}"),
            ("GET", "/content/wechatLive/syncFromWechat"),
            ("POST", "/content/wechatLive/syncToWechat"),
            ("POST", "/content/wechatLive/addToRoom"),
            ("POST", "/content/wechatLive/removeFromRoom"),
            ("GET", "/content/wechatLive/room/{roomId}"),
            ("GET", "/content/wechatLive/finderLiveRecord"),
            ("GET", "/promotion/wechatLive/list"),
            ("GET", "/promotion/wechatLive/refresh"),
            ("POST", "/promotion/wechatLive/refresh"),
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for (method, path) in registered {
            let contract_path = path.replace("{roomId}", "{roomId}");
            assert!(
                ROUTE_TABLE
                    .iter()
                    .any(|(m, p, _)| *m == method && *p == contract_path),
                "{method} {path} 不在 ROUTE_TABLE（契约写法 {contract_path}）"
            );
        }
        for (method, path, _) in ROUTE_TABLE.iter() {
            let registered_path = path.replace("{roomId}", "{roomId}");
            assert!(
                registered
                    .iter()
                    .any(|(m, p)| *m == *method && *p == registered_path.as_str()),
                "{method} {path} 未在 routes() 中注册"
            );
        }
    }

    #[test]
    fn path_param_routes_are_exactly_three() {
        let with_param = ROUTE_TABLE
            .iter()
            .filter(|(_, p, _)| p.contains("{roomId}"))
            .count();
        // `assert_eq!` 的消息串同样是 format 串：字面量花括号必须写成 {{ }}，
        // 否则会被当作变量捕获（曾导致 E0425: cannot find value `roomId`）。
        assert_eq!(
            with_param, 3,
            "pushUrl / promote / room 三条带 {{roomId}} 参数"
        );
        let room = ROUTE_TABLE
            .iter()
            .filter(|(_, p, _)| p.contains("/room/"))
            .count();
        assert_eq!(room, 1);
    }
}
