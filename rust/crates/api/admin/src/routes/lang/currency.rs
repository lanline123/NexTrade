//! 货币管理路由（lang::currency）。
//!
//! Java 来源（overseas）：
//! `com.tigshop.adminapi.controller.lang.CurrencyController`
//! （`@RequestMapping("/adminapi/lang/currency")`）—— CRUD 部分。
//!
//! b2b2b-pro 5.8.57 前端新增（**无 Java 控制器对应**，按任务约定实现）：
//!
//! | method | path | 口径 |
//! |--------|------|------|
//! | `GET`  | `/lang/currency/config` | 读 `config` 表 `exchangeRateConfig`，缺省 `{}` |
//! | `GET`  | `/lang/currency/exchangeRateConfig` | 同上 |
//! | `POST` | `/lang/currency/saveExchangeRateConfig` | 写回 `config` 表同 code（剔除 lastSyncTime） |
//! | `POST` | `/lang/currency/syncExchangeRateNow` | 经 Open Exchange Rates 同步汇率，返回 `ExchangeRateSyncResult` |
//! | `POST` | `/lang/currency/translation` | 机器翻译，无凭据原样返回 |

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::lang::common::{BatchDTO, OperateDTO, UpdateFieldDTO};
use tigshop_core::models::lang::currency::{CurrencyDTO, CurrencyListQuery, CurrencyVO};
use tigshop_core::models::lang::translations::TranslationTextDTO;
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};
use tigshop_services::lang::currency::ExchangeRateSyncResult;

use crate::AdminState;

/// 货币管理路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/lang/currency/list", get(list))
        .route("/lang/currency/detail", get(detail))
        .route("/lang/currency/create", post(create))
        .route("/lang/currency/update", post(update))
        .route("/lang/currency/updateField", post(update_field))
        .route("/lang/currency/dictionary", get(dictionary))
        .route("/lang/currency/del", post(del))
        .route("/lang/currency/batch", post(batch))
        .route("/lang/currency/config", get(config))
        .route(
            "/lang/currency/exchangeRateConfig",
            get(exchange_rate_config),
        )
        .route(
            "/lang/currency/saveExchangeRateConfig",
            post(save_exchange_rate_config),
        )
        .route(
            "/lang/currency/syncExchangeRateNow",
            post(sync_exchange_rate_now),
        )
        .route("/lang/currency/translation", post(translation))
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/lang/currency/list",
            "CurrencyController.list",
        ),
        (
            "GET",
            "/adminapi/lang/currency/detail",
            "CurrencyController.detail",
        ),
        (
            "POST",
            "/adminapi/lang/currency/create",
            "CurrencyController.create",
        ),
        (
            "POST",
            "/adminapi/lang/currency/updateField",
            "CurrencyController.updateField",
        ),
        (
            "POST",
            "/adminapi/lang/currency/del",
            "CurrencyController.del",
        ),
        (
            "POST",
            "/adminapi/lang/currency/batch",
            "CurrencyController.batch",
        ),
        (
            "GET",
            "/adminapi/lang/currency/config",
            "CurrencyController.config",
        ),
        (
            "GET",
            "/adminapi/lang/currency/exchangeRateConfig",
            "CurrencyController.exchangeRateConfig",
        ),
        (
            "POST",
            "/adminapi/lang/currency/saveExchangeRateConfig",
            "CurrencyController.saveExchangeRateConfig",
        ),
        (
            "POST",
            "/adminapi/lang/currency/syncExchangeRateNow",
            "CurrencyController.syncExchangeRateNow",
        ),
        (
            "POST",
            "/adminapi/lang/currency/translation",
            "CurrencyController.translation",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `?id=` 查询参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

/// 分页查询（GET，Spring DTO 绑定）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ListQueryForm {
    page: Option<u64>,
    size: Option<u64>,
    name: Option<String>,
}

impl From<ListQueryForm> for CurrencyListQuery {
    fn from(f: ListQueryForm) -> Self {
        Self {
            page: f.page,
            size: f.size,
            name: f.name,
            ..Default::default()
        }
    }
}

/// `GET /adminapi/lang/currency/list`：货币分页。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<CurrencyListQuery>,
) -> ApiResult<PageResult<CurrencyVO>> {
    ok(state.lang.currency().list(&q).await?)
}

/// `GET /adminapi/lang/currency/detail?id=`：货币详情。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<CurrencyVO>> {
    ok(state.lang.currency().detail(q.id).await?)
}

/// `POST /adminapi/lang/currency/create`：新增货币。
async fn create(State(state): State<AdminState>, Json(dto): Json<CurrencyDTO>) -> ApiResult<()> {
    state.lang.currency().create(&dto).await?;
    ok(())
}

/// `POST /adminapi/lang/currency/updateField`：修改字段（`isDefault` 联动）。
async fn update(State(state): State<AdminState>, Json(dto): Json<CurrencyDTO>) -> ApiResult<bool> {
    ok(state.lang.currency().update(&dto).await?)
}

/// `GET /adminapi/lang/currency/dictionary`：币种代码字典。
async fn dictionary(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    let rows: Vec<(i32, String, String, String)> = sqlx::query_as(
        "SELECT id, name, code, numeric_code FROM currency_dictionary ORDER BY code",
    )
    .fetch_all(&state.repos.pool)
    .await
    .map_err(|e| tigshop_security::web::AppError(tigshop_core::Error::Database(e.to_string())))?;
    ok(serde_json::json!(rows
        .into_iter()
        .map(|(id, name, code, numeric_code)| serde_json::json!({
            "id": id, "name": name, "code": code, "numericCode": numeric_code
        }))
        .collect::<Vec<_>>()))
}

async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state.lang.currency().update_field(&dto).await?)
}

/// `POST /adminapi/lang/currency/del`：删除货币。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.lang.currency().del(&dto).await?)
}

/// `POST /adminapi/lang/currency/batch`：批量操作（`type=del`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.lang.currency().batch(&dto).await?)
}

/// `GET /adminapi/lang/currency/config`：汇率/货币配置（`config` 表）。
async fn config(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.lang.currency().config().await?)
}

/// `GET /adminapi/lang/currency/exchangeRateConfig`：汇率配置读取。
async fn exchange_rate_config(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.lang.currency().exchange_rate_config().await?)
}

/// `POST /adminapi/lang/currency/saveExchangeRateConfig`：汇率配置保存。
async fn save_exchange_rate_config(
    State(state): State<AdminState>,
    Json(value): Json<serde_json::Value>,
) -> ApiResult<()> {
    state
        .lang
        .currency()
        .save_exchange_rate_config(value)
        .await?;
    ok(())
}

/// `POST /adminapi/lang/currency/syncExchangeRateNow`：立即同步汇率。
///
/// 经 Open Exchange Rates 拉取最新汇率回写 `currency.rate`
/// （对齐 Java `ExchangeRateSyncServiceImpl`），返回结构化结果
/// `ExchangeRateSyncResultVO`（camelCase：success/updatedCount/skippedCount/
/// message/lastSyncTime）；失败原因在 `message` 中。
async fn sync_exchange_rate_now(State(state): State<AdminState>) -> ApiResult<ExchangeRateSyncResult> {
    ok(state.lang.currency().sync_exchange_rate_now().await?)
}

/// `POST /adminapi/lang/currency/translation`：机器翻译货币文案。
///
/// 无火山凭据时原样返回原文。
async fn translation(
    State(state): State<AdminState>,
    Json(dto): Json<TranslationTextDTO>,
) -> ApiResult<String> {
    let code = dto.code.as_deref().unwrap_or("en");
    let text = dto.text.as_deref().unwrap_or_default();
    ok(state.lang.currency().translation(code, text).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_frontend_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 11);
        assert_eq!(docs[0].path, "/adminapi/lang/currency/list");
        assert!(docs
            .iter()
            .any(|d| d.path == "/adminapi/lang/currency/translation"));
    }

    #[test]
    fn list_query_form_maps_to_model() {
        let f: ListQueryForm =
            serde_json::from_str(r#"{"page":1,"size":20,"name":"美元"}"#).unwrap();
        let q: CurrencyListQuery = f.into();
        assert_eq!(q.name.as_deref(), Some("美元"));
        assert_eq!(q.page_params(), (1, 20));
    }
}
