//! 管理端微信直播商品库路由（content::wechat_live_goods）。
//!
//! Java 来源：`WechatLiveGoodsController`（`/adminapi/content/wechatLiveGoods`）
//! 的 `POST import`、`GET list`、`GET query`；以及新版管理端前端契约
//! （`view/admin/src/api/content/wechatLive.ts`）的
//! `POST addToRoom` / `POST removeFromRoom`（旧版 Java 这两个操作挂在
//! `WechatLiveController` 下，前端新版本把它们移到 `wechatLiveGoods`
//! 前缀，本模块按前端实际路径挂载，复用 `content::wechat_live` 服务）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use tigshop_core::models::content::wechat_live::{
    WechatLiveGoodsAddDTO, WechatLiveRemoveGoodsQuery,
};
use tigshop_core::models::content::wechat_live_goods::{
    WechatLiveGoodsImportParam, WechatLiveGoodsPageQuery, WechatLiveGoodsQuery, WechatLiveGoodsVO,
};
use tigshop_core::types::PageResult;
use tigshop_openapi::RouteDoc;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 5 条路由。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "POST",
        "/content/wechatLiveGoods/import",
        "WechatLiveGoodsController.importGoods",
    ),
    (
        "GET",
        "/content/wechatLiveGoods/list",
        "WechatLiveGoodsController.getGoodsLibrary",
    ),
    (
        "GET",
        "/content/wechatLiveGoods/query",
        "WechatLiveGoodsController.queryGoods",
    ),
    (
        "POST",
        "/content/wechatLiveGoods/addToRoom",
        "WechatLiveGoodsController.addToRoom",
    ),
    (
        "POST",
        "/content/wechatLiveGoods/removeFromRoom",
        "WechatLiveGoodsController.removeFromRoom",
    ),
];

/// 微信直播商品库路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/content/wechatLiveGoods/import", post(import_goods))
        .route("/content/wechatLiveGoods/list", get(list))
        .route("/content/wechatLiveGoods/query", get(query))
        .route("/content/wechatLiveGoods/addToRoom", post(add_to_room))
        .route(
            "/content/wechatLiveGoods/removeFromRoom",
            post(remove_from_room),
        )
}

/// 已实现路由（契约完整路径）。
#[must_use]
pub fn implemented_routes() -> Vec<RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| RouteDoc::new(method, &format!("/adminapi{path}"), handler))
        .collect()
}

async fn import_goods(
    State(state): State<AdminState>,
    Json(param): Json<WechatLiveGoodsImportParam>,
) -> ApiResult<()> {
    state.content.wechat_live_goods.import(&param).await?;
    ok(())
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<WechatLiveGoodsPageQuery>,
) -> ApiResult<PageResult<WechatLiveGoodsVO>> {
    ok(state.content.wechat_live_goods.list(&q).await?)
}

async fn query(
    State(state): State<AdminState>,
    Query(q): Query<WechatLiveGoodsQuery>,
) -> ApiResult<Option<WechatLiveGoodsVO>> {
    ok(state.content.wechat_live_goods.query(&q).await?)
}

/// `POST /adminapi/content/wechatLiveGoods/addToRoom`：把已导入商品加入直播间。
///
/// Java 来源：`WechatLiveController.addGoods`
/// （`WechatLiveGoodsAddDTO { roomId, goodsIds }`；新版前端把路径改挂到
/// `content/wechatLiveGoods` 前缀），复用 `content::wechat_live` 服务。
async fn add_to_room(
    State(state): State<AdminState>,
    Json(dto): Json<WechatLiveGoodsAddDTO>,
) -> ApiResult<()> {
    state.content.wechat_live.add_goods(&dto).await?;
    ok(())
}

/// `POST /adminapi/content/wechatLiveGoods/removeFromRoom?roomId=&goodsId=`：
/// 从直播间移除商品。
///
/// Java 来源：`WechatLiveController.removeGoods`
/// （`@RequestParam Long goodsId, Integer roomId`，前端以 query 传递），
/// 复用 `content::wechat_live` 服务。
async fn remove_from_room(
    State(state): State<AdminState>,
    Query(q): Query<WechatLiveRemoveGoodsQuery>,
) -> ApiResult<()> {
    let room_id = q
        .room_id
        .ok_or_else(|| tigshop_core::Error::Validation("roomId不能为空".into()))?;
    let goods_id = q
        .goods_id
        .ok_or_else(|| tigshop_core::Error::Validation("goodsId不能为空".into()))?;
    state
        .content
        .wechat_live
        .remove_goods(room_id, goods_id)
        .await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        assert_eq!(docs[0].path, "/adminapi/content/wechatLiveGoods/import");
        assert_eq!(docs[1].path, "/adminapi/content/wechatLiveGoods/list");
        assert_eq!(docs[2].path, "/adminapi/content/wechatLiveGoods/query");
        assert_eq!(docs[3].path, "/adminapi/content/wechatLiveGoods/addToRoom");
        assert_eq!(
            docs[4].path,
            "/adminapi/content/wechatLiveGoods/removeFromRoom"
        );
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[1].method, "GET");
        assert_eq!(docs[2].method, "GET");
        assert_eq!(docs[3].method, "POST");
        assert_eq!(docs[4].method, "POST");
    }

    #[test]
    fn route_table_unique() {
        assert_eq!(ROUTE_TABLE.len(), 5);
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(p.starts_with("/content/wechatLiveGoods/"));
        }
    }
}
