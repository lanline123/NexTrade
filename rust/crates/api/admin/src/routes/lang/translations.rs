//! 管理端业务翻译路由（lang::translations）。
//!
//! Java 来源：`com.tigshop.adminapi.controller.lang.TranslationsController`
//! （`@RequestMapping("/adminapi/lang/translations")`）：
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `POST` | `/lang/translations/getTranslations` | `getTranslations`（body `TranslationsDataDTO`） |
//! | `POST` | `/lang/translations/createTranslations` | `createTranslations`（body `TranslationsCreateParam`） |
//!
//! > 前端 `translationContent.ts` 里另有 `GET getTranslations`（query 形态）
//! > 的调用方，故 `getTranslations` 同时注册 GET（query）与 POST（JSON body）。
//!
//! > 出参：`TranslationsDetailVO`（`id` / `dataType` / `translationName` /
//! > `items[]`）；无命中时 `items` 为空数组。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::lang::locales::LocalesVO;
use tigshop_core::models::lang::translations::{
    MultipleTranslationDTO, TranslationTextDTO, TranslationTextVO, TranslationsBatchParam,
    TranslationsCreateParam, TranslationsDetailVO, TranslationsGetDTO, TranslationsListQuery,
    TranslationsVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由表（getTranslations 注册 POST + GET 双形态，另有 9 条 CRUD/翻译）。
const ROUTE_TABLE: [(&str, &str, &str); 12] = [
    (
        "POST",
        "/lang/translations/getTranslations",
        "TranslationsController.getTranslations",
    ),
    (
        "POST",
        "/lang/translations/update",
        "TranslationsController.update",
    ),
    (
        "POST",
        "/lang/translations/createTranslations",
        "TranslationsController.createTranslations",
    ),
    (
        "GET",
        "/lang/translations/list",
        "TranslationsController.list",
    ),
    (
        "GET",
        "/lang/translations/detail",
        "TranslationsController.detail",
    ),
    (
        "POST",
        "/lang/translations/batch",
        "TranslationsController.batch",
    ),
    (
        "POST",
        "/lang/translations/del",
        "TranslationsController.del",
    ),
    (
        "GET",
        "/lang/translations/getLocalesLimit3",
        "TranslationsController.getLocalesLimit3",
    ),
    (
        "POST",
        "/lang/translations/multiple",
        "TranslationsController.multiple",
    ),
    (
        "POST",
        "/lang/translations/translation",
        "TranslationsController.translation",
    ),
    (
        "GET",
        "/lang/translations/config",
        "TranslationsController.config",
    ),
    (
        "POST",
        "/lang/translations/batchCreateTranslations",
        "TranslationsController.batchCreateTranslations",
    ),
];

/// 业务翻译路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/lang/translations/getTranslations",
            post(get_translations).get(get_translations_query),
        )
        .route(
            "/lang/translations/createTranslations",
            post(create_translations),
        )
        .route("/lang/translations/create", post(create_translations))
        .route("/lang/translations/update", post(create_translations))
        .route("/lang/translations/batchCreate", post(batch_create))
        .route("/lang/translations/batchTranslate", post(batch_translate))
        .route("/lang/translations/list", get(list))
        .route("/lang/translations/detail", get(detail))
        .route("/lang/translations/batch", post(batch))
        .route("/lang/translations/del", post(del))
        .route(
            "/lang/translations/getLocalesLimit3",
            get(get_locales_limit3),
        )
        .route("/lang/translations/multiple", post(multiple))
        .route("/lang/translations/translation", post(translation))
        .route("/lang/translations/config", get(config))
        .route(
            "/lang/translations/batchCreateTranslations",
            post(batch_create_translations),
        )
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

/// GET 形态的 query 参数（前端 `translationContent.ts#getCreateTranslation`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct TranslationsGetQuery {
    data_type: Option<i32>,
    data_id: Option<i32>,
    translation_name: Option<String>,
}

impl From<TranslationsGetQuery> for TranslationsGetDTO {
    fn from(q: TranslationsGetQuery) -> Self {
        Self {
            id: None,
            data_id: q.data_id,
            data_type: q.data_type,
            locale_id: None,
            translation_key: None,
            translation_name: q.translation_name,
        }
    }
}

/// `POST /adminapi/lang/translations/getTranslations`：查业务翻译。
async fn get_translations(
    State(state): State<AdminState>,
    Json(dto): Json<TranslationsGetDTO>,
) -> ApiResult<TranslationsDetailVO> {
    ok(state.lang.translations.get_translations(&dto).await?)
}

/// `GET /adminapi/lang/translations/getTranslations`：同上的 query 形态。
async fn get_translations_query(
    State(state): State<AdminState>,
    Query(q): Query<TranslationsGetQuery>,
) -> ApiResult<TranslationsDetailVO> {
    ok(state.lang.translations.get_translations(&q.into()).await?)
}

/// `POST /adminapi/lang/translations/createTranslations`：创建/更新业务翻译。
async fn create_translations(
    State(state): State<AdminState>,
    Json(param): Json<TranslationsCreateParam>,
) -> ApiResult<()> {
    state.lang.translations.create_translations(&param).await?;
    ok(())
}

// ——————————————————————————————————————————————
// 管理端 CRUD（Java `TranslationsController` 5.8.57 前端清单部分）
// ——————————————————————————————————————————————

/// `?id=` 查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/lang/translations/list`：翻译词条分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<TranslationsListQuery>,
) -> ApiResult<PageResult<TranslationsVO>> {
    ok(state.lang.translations.list(&q).await?)
}

/// `GET /adminapi/lang/translations/detail?id=`：词条详情（含全量译文）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<TranslationsDetailVO>> {
    ok(state.lang.translations.detail(q.id).await?)
}

/// `POST /adminapi/lang/translations/batch`：批量操作（`type=del`）。
async fn batch(
    State(state): State<AdminState>,
    Json(param): Json<TranslationsBatchParam>,
) -> ApiResult<()> {
    state.lang.translations.batch(&param).await?;
    ok(())
}

/// `POST /adminapi/lang/translations/del`：单条删除。
async fn del(State(state): State<AdminState>, Json(dto): Json<IdBody>) -> ApiResult<()> {
    state.lang.translations.del(dto.id).await?;
    ok(())
}

/// `del` 请求体（Java `TranslationsDelParam {id}`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct IdBody {
    id: i32,
}

/// `GET /adminapi/lang/translations/getLocalesLimit3`：
/// 非中文启用语言前 3 条。
async fn get_locales_limit3(State(state): State<AdminState>) -> ApiResult<Vec<LocalesVO>> {
    ok(state.lang.translations.get_locales_limit3().await?)
}

/// `POST /adminapi/lang/translations/multiple`：一键翻译。
///
/// 无火山凭据时 no-op（返回 `false`，HTTP code:0）。
async fn multiple(
    State(state): State<AdminState>,
    Json(dto): Json<MultipleTranslationDTO>,
) -> ApiResult<bool> {
    ok(state.lang.translations.multiple(&dto).await?)
}

/// `POST /adminapi/lang/translations/translation`：单条机器翻译。
///
/// 无火山凭据时原样返回原文。
async fn translation(
    State(state): State<AdminState>,
    Json(dto): Json<TranslationTextDTO>,
) -> ApiResult<TranslationTextVO> {
    ok(state.lang.translations.translation(&dto).await?)
}

/// `GET /adminapi/lang/translations/config`：翻译服务配置
/// （5.8.57 前端新增，Java 无对应；返回凭据配置情况）。
async fn config(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.lang.translations.config().await?)
}

/// `POST /adminapi/lang/translations/batchCreateTranslations`：
/// 批量保存业务翻译（逐条 upsert，汇总成败）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct TranslationsCreateDTO {
    data_type: Vec<i32>,
    translation_name: String,
}

/// `POST /adminapi/lang/translations/batchCreate`：按换行批量建词条。
async fn batch_create(
    State(state): State<AdminState>,
    Json(dto): Json<TranslationsCreateDTO>,
) -> ApiResult<()> {
    let data_type = dto.data_type.first().copied();
    let list: Vec<TranslationsCreateParam> = dto
        .translation_name
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| TranslationsCreateParam {
            data_id: None,
            data_type,
            translation_name: Some(line.to_string()),
            items: Vec::new(),
            translation_source: None,
        })
        .collect();
    state
        .lang
        .translations
        .batch_create_translations(&list)
        .await?;
    ok(())
}

/// `POST /adminapi/lang/translations/batchTranslate`：批量机器翻译。
/// 当前未接翻译凭据，返回空映射（不伪造译文）。
async fn batch_translate(Json(_dto): Json<serde_json::Value>) -> ApiResult<serde_json::Value> {
    ok(serde_json::json!({}))
}

async fn batch_create_translations(
    State(state): State<AdminState>,
    Json(list): Json<Vec<TranslationsCreateParam>>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .lang
        .translations
        .batch_create_translations(&list)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_route_table() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), ROUTE_TABLE.len());
        for (doc, (method, path, _)) in docs.iter().zip(ROUTE_TABLE.iter()) {
            assert_eq!(doc.method, *method);
            assert_eq!(doc.path, format!("/adminapi{path}"));
        }
    }

    #[test]
    fn get_query_maps_to_dto() {
        let q: TranslationsGetQuery =
            serde_json::from_str(r#"{"dataType":1,"dataId":5,"translationName":"Red"}"#).unwrap();
        let dto: TranslationsGetDTO = q.into();
        assert_eq!(dto.data_type, Some(1));
        assert_eq!(dto.data_id, Some(5));
        assert_eq!(dto.translation_name.as_deref(), Some("Red"));
    }
}
