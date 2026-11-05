//! 对账单管理（payment::statement）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.finance.StatementController`
//!   （`/adminapi/finance/statement`，本切片 6 个端点：
//!   `getStatementList` / `saveStatementDownload` / `exportStatement` /
//!   `exportStatementStatistics` / `getStatementStatisticsList` / `getStatementQueryConfig`）
//! - `StatementServiceImpl`（列表/统计/导出） + `StatementDownloadServiceImpl`
//! - 表：`statement` / `statement_download` / `shop` / `vendor`
//!
//! 金额 `rust_decimal::Decimal`；时间为秒级时间戳（实体），VO 输出
//! `yyyy-MM-dd HH:mm:ss`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 账户类型文案（Java `AccountType`）。
#[must_use]
pub fn account_type_name(code: Option<i32>) -> &'static str {
    match code {
        Some(1) => "账户余额",
        _ => "",
    }
}

/// 对账单类型码（Java `StatementType` 枚举，5.8.57 权威值）。
pub mod statement_type {
    /// 手续费（`HANDLING_FEE`）。
    pub const HANDLING_FEE: i32 = 1;
    /// 服务费（`SERVICE_FEE`）。
    pub const SERVICE_FEE: i32 = 2;
    /// 订单收支（`ORDER`）。
    pub const ORDER: i32 = 3;
    /// 店铺提现收支（`SHOP_WITHDRAWAL`）。
    pub const SHOP_WITHDRAWAL: i32 = 4;
    /// 门店提现收支（`STORE_WITHDRAWAL`）。
    pub const STORE_WITHDRAWAL: i32 = 5;
    /// 供应商提现收支（`SUPPLIER_WITHDRAWAL`）。
    pub const SUPPLIER_WITHDRAWAL: i32 = 6;
    /// 订单退款（`ORDER_REFUND`）。
    pub const ORDER_REFUND: i32 = 7;
    /// 分销佣金（`DISTRIBUTION_COMMISSION`）。
    pub const DISTRIBUTION_COMMISSION: i32 = 8;
}

/// 对账单类型文案（Java `StatementType`）。
#[must_use]
pub fn statement_type_name(code: Option<i32>) -> &'static str {
    match code {
        Some(1) => "手续费",
        Some(2) => "服务费",
        Some(3) => "订单收支",
        Some(4) => "店铺提现收支",
        Some(5) => "门店提现收支",
        Some(6) => "供应商提现收支",
        Some(7) => "订单退款",
        Some(8) => "分销佣金",
        _ => "",
    }
}

/// 入账方式文案（Java `EntryType`：1 自动 2 手动）。
#[must_use]
pub fn entry_type_name(raw: &str) -> &'static str {
    match raw {
        "1" | "auto" => "自动",
        "2" | "manual" => "手动",
        _ => "",
    }
}

/// 时间类型文案（Java `StatementTimeType`：1 结算时间 2 下单时间）。
#[must_use]
pub fn time_type_name(code: Option<i32>) -> &'static str {
    match code {
        Some(1) => "入账（结算）时间",
        Some(2) => "下单时间",
        _ => "",
    }
}

/// 统计日期粒度（Java `DateComponentType`：DAY/MONTH/YEAR）。
#[must_use]
pub fn date_component_valid(raw: Option<&str>) -> Option<&'static str> {
    match raw.map(str::trim).map(str::to_ascii_uppercase).as_deref() {
        Some("DAY") => Some("DAY"),
        Some("MONTH") => Some("MONTH"),
        Some("YEAR") => Some("YEAR"),
        _ => None,
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8）；0 → `""`。
#[must_use]
pub fn format_ts(secs: Option<i64>) -> String {
    let Some(secs) = secs.filter(|v| *v > 0) else {
        return String::new();
    };
    match chrono::DateTime::from_timestamp(secs, 0) {
        Some(utc) => (utc.naive_utc() + chrono::Duration::seconds(8 * 3600))
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
        None => String::new(),
    }
}

/// 对账单列表查询（Java `StatementListPageQuery` + BasePage）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementListQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
    pub account_type: Option<i32>,
    pub r#type: Option<i32>,
    pub payment_type: Option<String>,
    pub record_sn: Option<String>,
    /// 1 入账（结算）时间 / 2 下单时间
    pub time_type: Option<i32>,
    pub shop_id: Option<i32>,
    pub vendor_id: Option<i32>,
    /// `shop` / `vendor` / 空
    pub source: Option<String>,
}

impl StatementListQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }
}

/// 对账单列表 VO（Java `StatementListVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementListVO {
    pub statement_id: i64,
    pub shop_id: Option<i32>,
    pub shop_name: String,
    pub record_sn: Option<String>,
    pub settlement_time: String,
    pub vendor_id: Option<i32>,
    pub vendor_name: String,
    pub account_type: Option<i32>,
    pub r#type: Option<i32>,
    pub entry_type: String,
    pub payment_type: String,
    pub account_balance: Decimal,
    pub amount: Decimal,
    pub settlement_status: Option<i32>,
    pub account_type_name: String,
    pub type_name: String,
    pub entry_type_name: String,
    pub payment_type_name: String,
    pub record_time: String,
}

/// 对账单导出 VO（Java `StatementExportVO`，字段与列表一致 + 兜底文案）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementExportVO {
    pub statement_id: i64,
    pub shop_name: String,
    pub record_sn: Option<String>,
    pub settlement_time: String,
    pub vendor_name: String,
    pub account_type_name: String,
    pub type_name: String,
    pub entry_type_name: String,
    pub payment_type_name: String,
    pub account_balance: Decimal,
    pub amount: Decimal,
    pub record_time: String,
}

/// 对账单统计查询（Java `StatementStatisticsQuery`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementStatisticsQuery {
    pub statement_date: Option<String>,
    /// DAY / MONTH / YEAR
    pub statement_date_type: Option<String>,
    pub account_type: Option<i32>,
    pub source: Option<String>,
    pub shop_id: Option<i32>,
    pub vendor_id: Option<i32>,
}

/// 对账单统计 VO（Java `StatementStatisticsVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementStatisticsVO {
    pub statement_date: String,
    pub income: Decimal,
    pub expenditure: Decimal,
    pub income_count: i64,
    pub expenditure_count: i64,
    pub account_type: i32,
    pub account_type_text: String,
}

/// 对账单统计导出 VO（字段同统计 VO）。
pub type StatementStatisticsExportVO = StatementStatisticsVO;

/// 查询字段配置 VO（Java `StatementQueryContentVO`，元素 `{code,description}`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementQueryContentVO {
    pub statement_type: Vec<serde_json::Value>,
    pub statement_time_type: Vec<serde_json::Value>,
    pub account_type: Vec<serde_json::Value>,
    pub entry_type: Vec<serde_json::Value>,
    pub pay_method_type: Vec<serde_json::Value>,
    pub date_component_type: Vec<serde_json::Value>,
}

/// 保存对账单下载信息入参（Java `StatementDownloadSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StatementDownloadSaveParam {
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub shop_id: Option<i64>,
    pub vendor_id: Option<i32>,
    pub remark: Option<String>,
}

/// 日期字符串 → 秒级时间戳（`yyyy-MM-dd HH:mm:ss` / `yyyy-MM-dd`，非法 0）。
#[must_use]
pub fn parse_datetime(raw: &str) -> i64 {
    let raw = raw.trim();
    if raw.is_empty() {
        return 0;
    }
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"] {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(raw, fmt) {
            return dt.and_utc().timestamp() - 8 * 3600;
        }
    }
    if let Ok(date) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        if let Some(dt) = date.and_hms_opt(0, 0, 0) {
            return dt.and_utc().timestamp() - 8 * 3600;
        }
    }
    0
}

/// 日期区间两端相等（Java `startTime.equals(endTime)`）时展开为当天 00:00:00~23:59:59。
#[must_use]
pub fn normalize_range(start: i64, end: i64) -> (i64, i64) {
    if start > 0 && start == end {
        (start, start + 86_399)
    } else {
        (start, end)
    }
}

/// 统计日期区间（DAY: yyyy-MM-dd → 单日；MONTH: yyyy-MM → 当月；YEAR: yyyy）。
#[must_use]
pub fn statistics_periods(date_type: &str, statement_date: &str) -> Vec<(i32, i32, i32)> {
    match date_type {
        "DAY" => {
            let parts: Vec<&str> = statement_date.split('-').collect();
            if parts.len() != 3 {
                return Vec::new();
            }
            let (Ok(y), Ok(m), Ok(d)) = (
                parts[0].parse::<i32>(),
                parts[1].parse::<i32>(),
                parts[2].parse::<i32>(),
            ) else {
                return Vec::new();
            };
            vec![(y, m, d)]
        }
        "MONTH" => {
            let parts: Vec<&str> = statement_date.split('-').collect();
            if parts.len() != 2 {
                return Vec::new();
            }
            let (Ok(y), Ok(m)) = (parts[0].parse::<i32>(), parts[1].parse::<i32>()) else {
                return Vec::new();
            };
            vec![(y, m, 0)]
        }
        "YEAR" => match statement_date.parse::<i32>() {
            Ok(y) => vec![(y, 0, 0)],
            Err(_) => Vec::new(),
        },
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn texts_match_java_enums() {
        assert_eq!(account_type_name(Some(1)), "账户余额");
        assert_eq!(statement_type_name(Some(1)), "手续费");
        assert_eq!(statement_type_name(Some(2)), "服务费");
        assert_eq!(statement_type_name(Some(3)), "订单收支");
        assert_eq!(statement_type_name(Some(7)), "订单退款");
        assert_eq!(statement_type_name(Some(8)), "分销佣金");
        assert_eq!(entry_type_name("1"), "自动");
        assert_eq!(entry_type_name("2"), "手动");
        assert_eq!(time_type_name(Some(1)), "入账（结算）时间");
        assert_eq!(date_component_valid(Some("day")), Some("DAY"));
        assert_eq!(date_component_valid(Some("WEEK")), None);
    }

    #[test]
    fn date_parsing_and_range_normalization() {
        assert_eq!(parse_datetime(""), 0);
        assert_eq!(parse_datetime("bad"), 0);
        let ts = parse_datetime("2026-10-18 00:00:00");
        assert!(ts > 0);
        let (s, e) = normalize_range(ts, ts);
        assert_eq!(e - s, 86_399);
        let (s2, e2) = normalize_range(ts, ts + 3600);
        assert_eq!((s2, e2), (ts, ts + 3600));
        assert_eq!(format_ts(Some(0)), "");
        assert_eq!(format_ts(None), "");
    }

    #[test]
    fn statistics_periods_for_day_month_year() {
        assert_eq!(
            statistics_periods("DAY", "2026-10-18"),
            vec![(2026, 10, 18)]
        );
        assert_eq!(statistics_periods("MONTH", "2026-10"), vec![(2026, 10, 0)]);
        assert_eq!(statistics_periods("YEAR", "2026"), vec![(2026, 0, 0)]);
        assert!(statistics_periods("DAY", "2026-10").is_empty());
        assert!(statistics_periods("X", "2026").is_empty());
    }
}
