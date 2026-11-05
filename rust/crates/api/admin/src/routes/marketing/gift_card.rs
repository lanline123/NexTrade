//! 管理端礼品卡路由（marketing::gift_card）。
//!
//! 原 Java：`com.tigshop.adminapi.controller.promotion.GiftCardController`
//! （`@RequestMapping("/adminapi/promotion/giftCards")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------|------------------|----------------|-----------|
//! | `GET /promotion/giftCards/list` | `GET /adminapi/promotion/giftCards/list` | `list` | jwt |
//! | `GET /promotion/giftCards/detail` | `…/detail` | `detail` | jwt |
//! | `GET /promotion/giftCards/importTemplate` | `…/importTemplate` | `importTemplate` | jwt |
//! | `GET /promotion/giftCards/exportList` | `…/exportList` | `exportList` | jwt |
//! | `POST /promotion/giftCards/importList` | `…/importList` | `importList` | jwt+perm |
//! | `POST /promotion/giftCards/delete` | `…/delete` | `deleteGiftCards` | jwt+perm |
//! | `GET /promotion/giftCards/giftCardExchangeDetail` | `…/giftCardExchangeDetail` | `giftCardExchangeDetail` | jwt |
//! | `POST /promotion/giftCards/updateCardStatus` | `…/updateCardStatus` | `updateGiftCardsAvailableStatus` | jwt |
//!
//! > **Excel 未迁移**：`importTemplate` / `exportList` 返回 JSON 行数据（Java
//! > 写 xlsx 二进制）；`importList` 完成 multipart「文件非空」校验后返回明确
//! > 业务错误「Excel 批量导入功能尚未迁移」。与 `catalog::e_card_group` 一致。
//!
//! > **`delete` 入参**：Java `GiftCardIdParam.cardGroupsId`（String）实际承载
//! > **礼品卡 ID**，字段名照抄。

use axum::{
    extract::{Multipart, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::gift_card::{
    GiftCardIdParam, GiftCardUpdateStatusDTO, GiftCardsExportVO, GiftCardsImportVO,
    GiftCardsListQuery, GiftCardsTemplateVO, GiftCardsVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::AdminState;

/// 本域 10 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
/// 最后两条来自新版管理端前端契约（`view/admin/src/api/promotion/giftCard.ts`）。
const ROUTE_TABLE: [(&str, &str, &str); 10] = [
    (
        "GET",
        "/promotion/giftCards/list",
        "GiftCardController.list",
    ),
    (
        "GET",
        "/promotion/giftCards/detail",
        "GiftCardController.detail",
    ),
    (
        "GET",
        "/promotion/giftCards/importTemplate",
        "GiftCardController.importTemplate",
    ),
    (
        "GET",
        "/promotion/giftCards/exportList",
        "GiftCardController.exportList",
    ),
    (
        "POST",
        "/promotion/giftCards/importList",
        "GiftCardController.importList",
    ),
    (
        "POST",
        "/promotion/giftCards/delete",
        "GiftCardController.deleteGiftCards",
    ),
    (
        "GET",
        "/promotion/giftCards/giftCardExchangeDetail",
        "GiftCardController.giftCardExchangeDetail",
    ),
    (
        "POST",
        "/promotion/giftCards/updateCardStatus",
        "GiftCardController.updateGiftCardsAvailableStatus",
    ),
    (
        "POST",
        "/promotion/giftCards/createBatch",
        "GiftCardController.createGiftCardsBatch",
    ),
    (
        "GET",
        "/promotion/giftCards/showCardPassword",
        "GiftCardController.showCardPassword",
    ),
];

/// 礼品卡管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/giftCards/list", get(list))
        .route("/promotion/giftCards/detail", get(detail))
        .route("/promotion/giftCards/importTemplate", get(import_template))
        .route("/promotion/giftCards/exportList", get(export_list))
        .route("/promotion/giftCards/importList", post(import_list))
        .route("/promotion/giftCards/delete", post(delete))
        .route(
            "/promotion/giftCards/giftCardExchangeDetail",
            get(gift_card_exchange_detail),
        )
        .route(
            "/promotion/giftCards/updateCardStatus",
            post(update_card_status),
        )
        .route("/promotion/giftCards/createBatch", post(create_batch))
        .route("/promotion/giftCards/create", post(create))
        .route("/promotion/giftCards/update", post(update))
        .route(
            "/promotion/giftCards/showCardPassword",
            get(show_card_password),
        )
}

/// 本模块已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

/// `giftCardsId` 查询参数（Java `@RequestParam Integer giftCardsId`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GiftCardsIdQuery {
    gift_cards_id: i32,
}

/// `cardGroupsId` 查询参数（exportList）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CardGroupsIdQuery {
    card_groups_id: Option<i32>,
}

async fn list(
    State(state): State<AdminState>,
    Query(q): Query<GiftCardsListQuery>,
) -> ApiResult<PageResult<GiftCardsVO>> {
    ok(state.marketing.gift_card.list(&q).await?)
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<GiftCardsIdQuery>,
) -> ApiResult<GiftCardsVO> {
    ok(state
        .marketing
        .gift_card
        .admin_detail(q.gift_cards_id)
        .await?)
}

/// `GET /promotion/giftCards/importTemplate`：导入模板（xlsx）。
async fn import_template(
    State(state): State<AdminState>,
) -> Result<axum::response::Response, AppError> {
    let template = state.marketing.gift_card.import_template();
    let rows: Vec<Vec<String>> = template
        .into_iter()
        .map(|r| vec![r.card_number, r.card_password])
        .collect();
    let bytes =
        tigshop_services::system::excel::build_xlsx(&["卡号", "密码"], &rows, "礼品卡导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "gift_card_template.xlsx",
    ))
}

/// `GET /promotion/giftCards/exportList`：导出列表（xlsx）。
async fn export_list(
    State(state): State<AdminState>,
    Query(q): Query<CardGroupsIdQuery>,
) -> Result<axum::response::Response, AppError> {
    let card_groups_id = q
        .card_groups_id
        .ok_or_else(|| AppError(Error::Validation("cardGroupsId不能为空".into())))?;
    let list = state
        .marketing
        .gift_card
        .export_list(card_groups_id)
        .await?;
    let rows: Vec<Vec<String>> = list
        .into_iter()
        .map(|r| {
            vec![
                r.card_number,
                r.card_password,
                r.gift_card_sn.unwrap_or_default(),
                r.is_sold,
                r.is_exchange,
                r.add_time,
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(
        &[
            "卡号",
            "密码",
            "卡序列号",
            "是否售出",
            "是否兑换",
            "添加时间",
        ],
        &rows,
        "礼品卡列表",
    )?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "gift_cards.xlsx",
    ))
}

/// `POST /promotion/giftCards/importList`：Excel 批量导入（**未迁移**）。
async fn import_list(
    State(state): State<AdminState>,
    Query(q): Query<CardGroupsIdQuery>,
    mut multipart: Multipart,
) -> ApiResult<GiftCardsImportVO> {
    let (form_group_id, bytes) = read_import_file(&mut multipart).await?;
    let rows = tigshop_services::system::excel::read_xlsx(&bytes)?;
    let cards: Vec<(String, String)> = rows
        .into_iter()
        .skip(1)
        .filter_map(|row| {
            let number = row.first()?.trim().to_string();
            let password = row.get(1).map(|s| s.trim().to_string()).unwrap_or_default();
            if number.is_empty() && password.is_empty() {
                None
            } else {
                Some((number, password))
            }
        })
        .collect();
    ok(state
        .marketing
        .gift_card
        .import_list(q.card_groups_id.or(form_group_id), &cards)
        .await?)
}

/// 读取 multipart 表单：`cardGroupsId` 文本字段 + `file` 内容。
async fn read_import_file(multipart: &mut Multipart) -> Result<(Option<i32>, Vec<u8>), Error> {
    let mut group_id: Option<i32> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let bytes = field
                .bytes()
                .await
                .map_err(|e| Error::Validation(format!("读取文件失败: {e}")))?
                .to_vec();
            return Ok((group_id, bytes));
        }
        let text = field
            .text()
            .await
            .map_err(|e| Error::Validation(format!("读取表单字段失败: {e}")))?;
        if name == "cardGroupsId" {
            group_id = text.trim().parse::<i32>().ok();
        }
    }
    Err(Error::Validation("请上传文件".into()))
}

async fn delete(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardIdParam>,
) -> ApiResult<()> {
    state.marketing.gift_card.delete(&param).await?;
    ok(())
}

async fn gift_card_exchange_detail(
    State(state): State<AdminState>,
    Query(q): Query<GiftCardsIdQuery>,
) -> ApiResult<tigshop_core::models::marketing::gift_card::GiftCardDetailVO> {
    ok(state
        .marketing
        .gift_card
        .gift_card_exchange_detail(q.gift_cards_id)
        .await?)
}

async fn update_card_status(
    State(state): State<AdminState>,
    Json(dto): Json<GiftCardUpdateStatusDTO>,
) -> ApiResult<()> {
    state.marketing.gift_card.update_card_status(&dto).await?;
    ok(())
}

/// `showCardPassword` 的查询参数（前端 `getGiftCardPasswrod({ cardId })`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CardIdQuery {
    card_id: Option<i32>,
}

/// `POST /adminapi/promotion/giftCards/create`：生成礼品卡。
async fn create(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let card_groups_id = body
        .get("cardGroupsId")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0) as i32;
    let count = body
        .get("count")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(1) as i32;
    state
        .marketing
        .gift_card
        .create_batch(card_groups_id, count)
        .await?;
    ok(())
}

/// `POST /adminapi/promotion/giftCards/update`：更新礼品卡可用状态。
async fn update(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<()> {
    let dto = GiftCardUpdateStatusDTO {
        gift_cards_id: body
            .get("giftCardsId")
            .and_then(serde_json::Value::as_i64)
            .map(|v| v as i32),
        is_available: body
            .get("isAvailable")
            .and_then(serde_json::Value::as_i64)
            .map(|v| v as i32),
    };
    state.marketing.gift_card.update_card_status(&dto).await?;
    ok(())
}

/// `POST /adminapi/promotion/giftCards/createBatch`：批量生成礼品卡。
///
/// Java 来源：`GiftCardController.createGiftCardsBatch`
/// （`GiftCardIdParam { cardGroupsId, count }` →
/// `giftCardsService.createGiftCardsBatch`）。
async fn create_batch(
    State(state): State<AdminState>,
    Json(param): Json<GiftCardIdParam>,
) -> ApiResult<()> {
    let card_groups_id = param.gift_cards_id().map_err(Error::Validation)?;
    let count = param.count.unwrap_or(0);
    state
        .marketing
        .gift_card
        .create_batch(card_groups_id, count)
        .await?;
    ok(())
}

/// `GET /adminapi/promotion/giftCards/showCardPassword?cardId=`：查看卡密。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/promotion/giftCard.ts#getGiftCardPasswrod`
/// （返回 `string`；旧版 Java 控制器未含该端点）。
async fn show_card_password(
    State(state): State<AdminState>,
    Query(q): Query<CardIdQuery>,
) -> ApiResult<String> {
    let card_id = q
        .card_id
        .filter(|v| *v > 0)
        .ok_or_else(|| AppError(Error::Validation("cardId不能为空".into())))?;
    ok(state
        .marketing
        .gift_card
        .show_card_password(card_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 10);
        let expected = [
            ("GET", "/adminapi/promotion/giftCards/list"),
            ("GET", "/adminapi/promotion/giftCards/detail"),
            ("GET", "/adminapi/promotion/giftCards/importTemplate"),
            ("GET", "/adminapi/promotion/giftCards/exportList"),
            ("POST", "/adminapi/promotion/giftCards/importList"),
            ("POST", "/adminapi/promotion/giftCards/delete"),
            (
                "GET",
                "/adminapi/promotion/giftCards/giftCardExchangeDetail",
            ),
            ("POST", "/adminapi/promotion/giftCards/updateCardStatus"),
            ("POST", "/adminapi/promotion/giftCards/createBatch"),
            ("GET", "/adminapi/promotion/giftCards/showCardPassword"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys);
    }

    #[test]
    fn route_table_matches_registrations() {
        assert_eq!(ROUTE_TABLE.len(), 10);
        for (_, path, _) in ROUTE_TABLE.iter() {
            assert!(!path.contains("/adminapi"), "{path}");
            assert!(path.starts_with("/promotion/giftCards/"), "{path}");
        }
        assert_eq!(
            implemented_routes()[0].path,
            "/adminapi/promotion/giftCards/list"
        );
    }

    #[test]
    fn delete_param_uses_java_field_name() {
        // Java `GiftCardIdParam.cardGroupsId`（String）实际承载卡 ID
        let p: GiftCardIdParam =
            serde_json::from_value(serde_json::json!({"cardGroupsId": "42"})).unwrap();
        assert_eq!(p.gift_cards_id().unwrap(), 42);
    }
}
