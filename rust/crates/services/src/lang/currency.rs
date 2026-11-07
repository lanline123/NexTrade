//! 货币管理服务（lang::currency）。
//!
//! Java 来源（overseas）：
//! - `com.tigshop.adminapi.controller.lang.CurrencyController`
//! - `com.tigshop.service.lang.impl.CurrencyServiceImpl`
//! - `com.tigshop.service.lang.impl.ExchangeRateSyncServiceImpl`
//! - `com.tigshop.service.lang.task.ExchangeRateSyncTask`
//!
//! - `config` / `exchangeRateConfig`：读 `config` 表 `exchangeRateConfig`
//!   （缺省 `{}`）；
//! - `saveExchangeRateConfig`：写回 `config` 表同 code；
//!   `lastSyncTime` 仅由同步流程写入（对齐 Java `saveSettings` 拒绝前端覆盖）；
//! - `syncExchangeRateNow`：手动同步（`sync(true)`），经 Open Exchange Rates
//!   拉取最新汇率并按 `currency.code` 回写 `rate`（对齐 Java
//!   `ExchangeRateSyncServiceImpl`，定时触发见 `system::scheduler`）；
//! - `translation`：机器翻译货币文案，无凭据时原样返回。
//!
//! Java `syncDefaultCurrencyToConfig`（主货币联动 `dollarSign` 配置）未迁移：
//! 该配置项属 PC 展示层快照，Rust 侧无消费方。

use std::sync::Arc;

use chrono::Local;
use serde::Serialize;

use tigshop_core::entities::Currency;
use tigshop_core::models::lang::common::{BatchDTO, OperateDTO, UpdateFieldDTO, LANG_CRUD_FIELDS};
use tigshop_core::models::lang::currency::{CurrencyDTO, CurrencyListQuery, CurrencyVO};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

/// 汇率配置在 `config` 表的 `biz_code`。
pub const CONFIG_EXCHANGE_RATE: &str = "exchangeRateConfig";

/// Open Exchange Rates 最新汇率接口（免费版基准固定为 USD，不传 base 参数）。
const OER_LATEST_URL: &str = "https://openexchangerates.org/api/latest.json";

/// OER 请求超时（秒），对齐 Java `HTTP_TIMEOUT_MS = 15_000`。
const OER_HTTP_TIMEOUT_SECS: u64 = 15;

/// 汇率保留小数位，对齐 Java `RATE_SCALE = 6`。
const RATE_SCALE: u32 = 6;

/// `lastSyncTime` 存储格式，对齐 Java `TIME_FMT`。
const TIME_FMT: &str = "%Y-%m-%d %H:%M:%S";

/// 汇率同步结果（对齐 Java `ExchangeRateSyncResultVO`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeRateSyncResult {
    pub success: bool,
    pub updated_count: i32,
    pub skipped_count: i32,
    /// 成功摘要或失败原因。
    pub message: String,
    /// 本次同步时间（失败时为原值）。
    pub last_sync_time: String,
}

impl ExchangeRateSyncResult {
    fn fail(message: impl Into<String>) -> Self {
        Self {
            success: false,
            updated_count: 0,
            skipped_count: 0,
            message: message.into(),
            last_sync_time: String::new(),
        }
    }
}

/// 货币服务（经 `AdminState.lang.currency()` 组合提供）。
pub struct CurrencyService {
    repos: Arc<Repositories>,
}

impl CurrencyService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    fn repo(&self) -> &tigshop_infrastructure::db::repo::lang::currency::CurrencyRepository {
        &self.repos.lang.currency
    }

    /// 分页列表（Java `list`：`name` LIKE）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn list(&self, q: &CurrencyListQuery) -> Result<PageResult<CurrencyVO>> {
        let (page, size) = q.page_params();
        let (total, rows) = self
            .repo()
            .paginate(
                q.name.as_deref().filter(|s| !s.is_empty()),
                "id ASC",
                size,
                (page - 1) * size,
            )
            .await?;
        Ok(PageResult::new(
            total,
            rows.iter().map(to_vo).collect(),
            &PageQuery {
                page,
                page_size: size,
            },
        ))
    }

    /// 详情（Java `detail`）。
    pub async fn detail(&self, id: i32) -> Result<Option<CurrencyVO>> {
        Ok(self.repo().find_by_id(id).await?.as_ref().map(to_vo))
    }

    /// 创建（Java `create`）。
    pub async fn create(&self, dto: &CurrencyDTO) -> Result<i32> {
        self.repo().insert(&dto_to_row(dto, 0)).await
    }

    /// 修改（Java `update`：`isDefault=1` 时先清空全部默认）。
    pub async fn update(&self, dto: &CurrencyDTO) -> Result<bool> {
        let id = dto
            .id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation("id不能为空".into()))?;
        if dto.is_default == Some(1) {
            self.repo().clear_default().await?;
        }
        Ok(self.repo().update(&dto_to_row(dto, id)).await? > 0)
    }

    /// 单字段更新（Java `updateField`；`isDefault=1` 联动清空其余默认）。
    pub async fn update_field(&self, dto: &UpdateFieldDTO) -> Result<bool> {
        let id = dto
            .id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation("id不能为空".into()))?;
        let field = dto
            .field
            .as_deref()
            .map(crate::lang::locales::camel_to_column)
            .ok_or_else(|| Error::Validation("field不能为空".into()))?;
        if !LANG_CRUD_FIELDS.contains(&field.as_str()) {
            return Err(Error::Validation(format!("不允许修改字段: {field}")));
        }
        let Some(value) = dto.val.as_deref() else {
            return Err(Error::Validation("val不能为空".into()));
        };
        if field == "is_default" && value == "1" {
            self.repo().clear_default().await?;
        }
        Ok(self.repo().update_field(id, &field, value).await? > 0)
    }

    /// 删除（Java `del`）。
    pub async fn del(&self, dto: &OperateDTO) -> Result<bool> {
        let id = dto
            .id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation("id不能为空".into()))?;
        Ok(self.repo().delete_by_ids(&[id]).await? > 0)
    }

    /// 批量操作（Java `batch`：`type=del` 删除）。
    pub async fn batch(&self, dto: &BatchDTO) -> Result<bool> {
        let ids = dto.ids.clone().unwrap_or_default();
        match dto.r#type.as_deref() {
            Some("del") => Ok(self.repo().delete_by_ids(&ids).await? > 0),
            _ => Ok(false),
        }
    }

    /// `config`：读 `config` 表 `code=exchangeRateConfig`，缺省 `{}`。
    pub async fn config(&self) -> Result<serde_json::Value> {
        let raw = self
            .repos
            .system
            .config_basic
            .find_by_code(CONFIG_EXCHANGE_RATE)
            .await?;
        Ok(parse_config_json(raw.as_deref()))
    }

    /// `exchangeRateConfig`：同 [`Self::config`]（新前端拆分出的读取端点）。
    pub async fn exchange_rate_config(&self) -> Result<serde_json::Value> {
        self.config().await
    }

    /// `saveExchangeRateConfig`：写回 `config` 表（存 `code=exchangeRateConfig`）。
    ///
    /// 对齐 Java `saveSettings`：`lastSyncTime` 仅由同步流程内部写入，
    /// 前端提交值一律剔除，防止被表单回传覆盖。
    pub async fn save_exchange_rate_config(&self, value: serde_json::Value) -> Result<()> {
        let mut body = if value.is_null() {
            serde_json::json!({})
        } else {
            value
        };
        if let Some(obj) = body.as_object_mut() {
            obj.remove("lastSyncTime");
        }
        self.repos
            .system
            .config_basic
            .save_code(CONFIG_EXCHANGE_RATE, &body.to_string())
            .await
    }

    /// `syncExchangeRateNow`：手动同步，对齐 Java `sync(manual = true)`。
    ///
    /// 失败原因以结构化结果返回（Java 同款文案），不返回 `Error`。
    pub async fn sync_exchange_rate_now(&self) -> Result<ExchangeRateSyncResult> {
        self.sync(true).await
    }

    /// 汇率同步核心（Java `ExchangeRateSyncServiceImpl#sync`）。
    ///
    /// `manual = true`：管理端「立即更新」按钮，仅要求已配置 App ID；
    /// `manual = false`：定时任务触发（`system::scheduler` 每小时调用），
    /// 额外校验 `autoSync = 1` 且距上次同步已达 `syncIntervalHours`。
    ///
    /// 任一硬性失败（无 App ID / 无默认币种 / 默认币种缺代号 / 接口失败 /
    /// 源缺默认代号）均**不改动任何汇率**（对齐 Java 语义）。
    pub async fn sync(&self, manual: bool) -> Result<ExchangeRateSyncResult> {
        let config = self.config().await?;
        let app_id = config
            .get("appId")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .trim()
            .to_string();

        if !manual {
            let auto_sync = config.get("autoSync").and_then(|v| v.as_i64()).unwrap_or(0);
            if auto_sync != 1 {
                return Ok(ExchangeRateSyncResult::fail("汇率自动更新未开启"));
            }
            if !interval_elapsed(&config) {
                return Ok(ExchangeRateSyncResult::fail("距上次同步未达更新周期，跳过"));
            }
        }

        if app_id.is_empty() {
            return Ok(ExchangeRateSyncResult::fail("请先配置 Open Exchange Rates App ID"));
        }
        self.do_sync(&app_id).await
    }

    /// 拉取 OER 汇率并回写（Java `doSync`）。
    async fn do_sync(&self, app_id: &str) -> Result<ExchangeRateSyncResult> {
        let currencies = self.repo().find_all().await?;
        if currencies.is_empty() {
            return Ok(ExchangeRateSyncResult::fail("未配置任何币种"));
        }

        let Some(default_currency) = currencies.iter().find(|c| c.is_default == 1) else {
            return Ok(ExchangeRateSyncResult::fail("未设置默认币种，无法同步汇率"));
        };
        let default_code = default_currency.code.trim().to_uppercase();
        if default_code.is_empty() {
            // DD5：默认币种未配代号，整体停止并报错
            return Ok(ExchangeRateSyncResult::fail(
                "默认币种未设置国际通用代号，无法同步汇率",
            ));
        }

        let Some(rates) = fetch_rates(app_id).await else {
            return Ok(ExchangeRateSyncResult::fail("汇率源请求失败，已保留原汇率"));
        };
        let Some(oer_default) = rates.get(&default_code).and_then(number_as_decimal) else {
            return Ok(ExchangeRateSyncResult::fail(format!(
                "汇率源未包含默认币种代号 {default_code}，已保留原汇率"
            )));
        };
        if oer_default.is_zero() {
            return Ok(ExchangeRateSyncResult::fail(format!(
                "汇率源未包含默认币种代号 {default_code}，已保留原汇率"
            )));
        }

        let mut updated: i32 = 0;
        let mut skipped: i32 = 0;
        for currency in &currencies {
            if currency.is_default == 1 {
                // 默认币种不参与换算，rate 恒为 1（残留旧值会放大默认币种展示金额）
                if currency.rate != "1" {
                    self.repo().update_rate(currency.id, "1").await?;
                }
                continue;
            }
            let code = currency.code.trim().to_uppercase();
            if code.is_empty() {
                skipped += 1;
                continue;
            }
            let Some(rate) = rates
                .get(&code)
                .and_then(number_as_decimal)
                .and_then(|oer_target| compute_rate(oer_target, oer_default))
            else {
                skipped += 1;
                continue;
            };
            self.repo().update_rate(currency.id, &rate).await?;
            updated += 1;
        }

        let now = Local::now().format(TIME_FMT).to_string();
        self.write_last_sync_time(&now).await?;
        tracing::info!(
            "汇率同步完成：更新 {updated} 个币种，跳过 {skipped} 个（lastSyncTime={now}）"
        );

        Ok(ExchangeRateSyncResult {
            success: true,
            updated_count: updated,
            skipped_count: skipped,
            message: format!("同步成功，更新 {updated} 个币种，跳过 {skipped} 个（未设代号或源无数据）"),
            last_sync_time: now,
        })
    }

    /// 仅合并写入 `lastSyncTime`，其余配置键保持原值（Java `writeLastSyncTime`）。
    async fn write_last_sync_time(&self, now: &str) -> Result<()> {
        let mut config = self.config().await?;
        if let Some(obj) = config.as_object_mut() {
            obj.insert("lastSyncTime".into(), serde_json::json!(now));
        }
        self.repos
            .system
            .config_basic
            .save_code(CONFIG_EXCHANGE_RATE, &config.to_string())
            .await
    }

    /// `translation`：机器翻译（无凭据原样返回，见 `translate_text`）。
    pub async fn translation(&self, code: &str, text: &str) -> Result<String> {
        crate::lang::translations::machine_translate(&self.repos, code, text).await
    }
}

/// `config` 表存储值 → JSON（空/坏值一律 `{}` 兜底）。
pub fn parse_config_json(raw: Option<&str>) -> serde_json::Value {
    raw.and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
        .filter(|v| v.is_object())
        .unwrap_or_else(|| serde_json::json!({}))
}

/// 是否距上次同步已达配置周期（Java `intervalElapsed`）。
///
/// 从未同步过 / 时间解析失败 → 视为需要同步。
fn interval_elapsed(config: &serde_json::Value) -> bool {
    let Some(last) = config.get("lastSyncTime").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()) else {
        return true;
    };
    let interval = config
        .get("syncIntervalHours")
        .and_then(|v| v.as_i64())
        .filter(|v| *v >= 1)
        .unwrap_or(1);
    let Ok(last_time) = chrono::NaiveDateTime::parse_from_str(last.trim(), TIME_FMT) else {
        tracing::warn!("解析汇率上次同步时间失败，按需要同步处理，值={last}");
        return true;
    };
    let elapsed = chrono::Local::now().naive_local() - last_time;
    elapsed.num_hours() >= interval
}

/// 拉取 OER 最新汇率，返回 `rates` 对象；任何失败返回 `None`（Java `fetchRates`）。
async fn fetch_rates(app_id: &str) -> Option<serde_json::Map<String, serde_json::Value>> {
    let url = format!("{OER_LATEST_URL}?app_id={}", app_id.trim());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(OER_HTTP_TIMEOUT_SECS))
        .build()
        .ok()?;
    let body = match client.get(&url).send().await {
        Ok(resp) => match resp.text().await {
            Ok(text) => text,
            Err(e) => {
                tracing::warn!("OER 汇率接口读取响应失败: {e}");
                return None;
            }
        },
        Err(e) => {
            tracing::warn!("OER 汇率接口请求失败: {e}");
            return None;
        }
    };
    if body.trim().is_empty() {
        tracing::warn!("OER 汇率接口返回空响应");
        return None;
    }
    let root: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("OER 汇率接口响应解析失败: {e}");
            return None;
        }
    };
    if root.get("error").and_then(|v| v.as_bool()) == Some(true) {
        let status = root.get("status").map(|v| v.to_string()).unwrap_or_default();
        let description = root.get("description").and_then(|v| v.as_str()).unwrap_or_default();
        tracing::warn!("OER 汇率接口返回错误：{status} - {description}");
        return None;
    }
    let rates = root.get("rates")?.as_object()?;
    if rates.is_empty() {
        tracing::warn!("OER 汇率接口未返回 rates 数据");
        return None;
    }
    Some(rates.clone())
}

/// JSON 数值 → `Decimal`（OER rates 节点为数字）。
fn number_as_decimal(value: &serde_json::Value) -> Option<rust_decimal::Decimal> {
    match value {
        serde_json::Value::Number(n) => rust_decimal::Decimal::from_str_exact(&n.to_string()).ok(),
        serde_json::Value::String(s) => rust_decimal::Decimal::from_str_exact(s.trim()).ok(),
        _ => None,
    }
}

/// 计算目标币种相对默认币种的汇率：`rate_X = OER[X] / OER[默认]`。
///
/// 语义：1 单位默认币种 = rate_X 单位 X 币种（系统 `display = base × rate`）。
/// 保留至多 6 位小数（HALF_UP），去除末尾多余 0；入参非法返回 `None`。
/// 对齐 Java `ExchangeRateSyncServiceImpl#computeRate`。
#[must_use]
pub fn compute_rate(
    oer_target: rust_decimal::Decimal,
    oer_default: rust_decimal::Decimal,
) -> Option<String> {
    if oer_default.is_zero() {
        return None;
    }
    let rate = oer_target
        .checked_div(oer_default)
        .map(|d| d.round_dp_with_strategy(RATE_SCALE, rust_decimal::RoundingStrategy::MidpointAwayFromZero))?;
    // 去除末尾多余 0；0 值避免科学计数法输出
    if rate.is_zero() {
        return Some("0".to_string());
    }
    Some(rate.normalize().to_string())
}

fn dto_to_row(dto: &CurrencyDTO, id: i32) -> Currency {
    Currency {
        id,
        name: dto.name.clone().unwrap_or_default(),
        symbol: dto.symbol.clone().unwrap_or_default(),
        is_default: dto.is_default.unwrap_or(0),
        rate: dto.rate.clone().unwrap_or_default(),
        code: dto.code.clone().unwrap_or_default(),
    }
}

fn to_vo(c: &Currency) -> CurrencyVO {
    CurrencyVO {
        id: Some(c.id),
        name: Some(c.name.clone()),
        symbol: Some(c.symbol.clone()),
        is_default: Some(c.is_default),
        rate: Some(c.rate.clone()),
        code: Some(c.code.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    #[test]
    fn config_json_falls_back_to_empty_object() {
        assert_eq!(parse_config_json(None), serde_json::json!({}));
        assert_eq!(parse_config_json(Some("not json")), serde_json::json!({}));
        assert_eq!(
            parse_config_json(Some(r#"{"rateSource":"volc"}"#)),
            serde_json::json!({"rateSource":"volc"})
        );
        // 非对象（数组/标量）也兜底为 {}
        assert_eq!(parse_config_json(Some("[1,2]")), serde_json::json!({}));
    }

    fn d(v: &str) -> Decimal {
        Decimal::from_str_exact(v).unwrap()
    }

    #[test]
    fn compute_rate_divides_and_strips_trailing_zeros() {
        // 1 USD = 7.2464 CNY，1 USD = 0.8999 EUR → 1 EUR = 8.052229 CNY
        let rate = compute_rate(d("7.2464"), d("0.8999")).unwrap();
        assert_eq!(rate, "8.052228");
        // 精确整除后末尾 0 去除
        assert_eq!(compute_rate(d("2"), d("4")).unwrap(), "0.5");
        assert_eq!(compute_rate(d("1"), d("2")).unwrap(), "0.5");
        assert_eq!(compute_rate(d("4"), d("2")).unwrap(), "2");
    }

    #[test]
    fn compute_rate_rejects_zero_base_and_zero_result() {
        assert!(compute_rate(d("1"), d("0")).is_none());
        // 结果为 0 时输出 "0"（避免 0E-6 科学计数法）
        assert_eq!(compute_rate(d("0"), d("5")).unwrap(), "0");
    }

    #[test]
    fn interval_elapsed_semantics() {
        // 从未同步过 → 需要同步
        assert!(interval_elapsed(&serde_json::json!({})));
        // 时间坏值 → 需要同步
        assert!(interval_elapsed(&serde_json::json!({"lastSyncTime": "bad"})));
        // 刚同步过（周期 2 小时）→ 跳过
        let now = Local::now().format(TIME_FMT).to_string();
        assert!(!interval_elapsed(
            &serde_json::json!({"lastSyncTime": now, "syncIntervalHours": 2})
        ));
        // 很久以前同步过（周期 1 小时）→ 需要同步
        let old = (Local::now() - chrono::Duration::hours(5))
            .format(TIME_FMT)
            .to_string();
        assert!(interval_elapsed(
            &serde_json::json!({"lastSyncTime": old, "syncIntervalHours": 1})
        ));
    }
}
