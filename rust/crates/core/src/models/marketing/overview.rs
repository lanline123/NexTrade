//! 分销概览域（marketing::overview）DTO / VO / 纯函数。
//! Java `com.tigshop.adminapi.controller.salesman.OverviewController`（2 端点）+ `OverviewServiceImpl`。

use serde::{Deserialize, Serialize};

/// 趋势查询（Java `coreTrend(Integer dateType, String startEndTime)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OverviewTrendQuery {
    pub date_type: Option<i32>,
    pub start_end_time: Option<String>,
}

/// 汇总查询（Java `coreSummary(Integer summaryType)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OverviewSummaryQuery {
    pub summary_type: Option<i32>,
}

/// 趋势 VO（Java `OverviewCoreTrendVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewCoreTrendVO {
    pub horizontal_axis: Vec<String>,
    pub longitudinal_axis: Vec<rust_decimal::Decimal>,
}

/// 汇总 VO（Java `OverviewCoreSummaryVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewCoreSummaryVO {
    pub new_salesman_count: i64,
    pub salesman_amount: rust_decimal::Decimal,
    pub custom_num: i64,
    pub salesman_commission: rust_decimal::Decimal,
}

/// 今日：`summaryType == 0`。
#[must_use]
pub fn is_today(summary_type: Option<i32>) -> bool {
    summary_type.unwrap_or(0) == 0
}

/// 横轴（Java `getHorizontalAxis`）：1→12 月；2→当月天数；3→24 小时；其它→逐日。
#[must_use]
pub fn horizontal_axis(
    date_type: i32,
    start: chrono::NaiveDate,
    end: chrono::NaiveDate,
) -> Vec<String> {
    use chrono::Datelike;
    match date_type {
        1 => (1..=12).map(|m| format!("{m:02}")).collect(),
        2 => {
            let days = days_in_month(start.year(), start.month());
            (1..=days).map(|d| format!("{d:02}")).collect()
        }
        3 => (1..=24).map(|h| format!("{h:02}")).collect(),
        _ => {
            let mut out = Vec::new();
            let mut current = start;
            while current <= end && out.len() < 400 {
                out.push(current.format("%Y-%m-%d").to_string());
                current += chrono::Duration::days(1);
            }
            out
        }
    }
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let first_next = chrono::NaiveDate::from_ymd_opt(ny, nm, 1)
        .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap());
    let first_this = chrono::NaiveDate::from_ymd_opt(year, month, 1)
        .unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(1970, 1, 1).unwrap());
    (first_next - first_this).num_days() as u32
}

/// 时间戳 → 横轴桶标签（dateType 决定粒度）。
#[must_use]
pub fn bucket_label(date_type: i32, secs: i64) -> String {
    use chrono::{Datelike, Timelike};
    let Some(utc) = chrono::DateTime::from_timestamp(secs, 0) else {
        return String::new();
    };
    let local = utc.naive_utc() + chrono::Duration::hours(8);
    match date_type {
        1 => format!("{:02}", local.month()),
        2 => format!("{:02}", local.day()),
        3 => format!("{:02}", local.hour() + 1),
        _ => local.format("%Y-%m-%d").to_string(),
    }
}

/// 时间范围（简化 Java `TigUtils.getRangeDate`）。
///
/// - `date_type=1`：起止日期所在年份的 1/1 ~ 12/31
/// - `date_type=2`：起始日期所在月 1 日 ~ 月末
/// - `date_type=3`：起止日期的当日 0 点 ~ 23:59:59
/// - 其它：原样解析起止日期
#[must_use]
pub fn range_date(
    date_type: i32,
    start: chrono::NaiveDate,
    end: chrono::NaiveDate,
) -> (chrono::NaiveDate, chrono::NaiveDate) {
    use chrono::Datelike;
    match date_type {
        1 => (
            chrono::NaiveDate::from_ymd_opt(start.year(), 1, 1).unwrap_or(start),
            chrono::NaiveDate::from_ymd_opt(start.year(), 12, 31).unwrap_or(end),
        ),
        2 => (
            chrono::NaiveDate::from_ymd_opt(start.year(), start.month(), 1).unwrap_or(start),
            chrono::NaiveDate::from_ymd_opt(
                start.year(),
                start.month(),
                days_in_month(start.year(), start.month()),
            )
            .unwrap_or(end),
        ),
        3 => (start, start),
        _ => (start, end),
    }
}

/// `yyyy-MM-dd` 解析（失败回退今天）。
#[must_use]
pub fn parse_date(raw: &str) -> chrono::NaiveDate {
    chrono::NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().date_naive())
}

/// 解析 `startEndTime`（逗号分隔）：返回 `(start, end)`。
#[must_use]
pub fn parse_start_end(raw: Option<&str>) -> (chrono::NaiveDate, chrono::NaiveDate) {
    let parts: Vec<&str> = raw.unwrap_or("").split(',').collect();
    match parts.len() {
        0 | 1 => {
            let single = parts.first().copied().unwrap_or("").trim();
            let date = if single.is_empty() {
                chrono::Utc::now().date_naive()
            } else {
                parse_date(single)
            };
            (date, date)
        }
        _ => {
            let first = parts[0].trim();
            let last = parts[1].trim();
            let start = if first.is_empty() { last } else { first };
            let end = if last.is_empty() { first } else { last };
            (parse_date(start), parse_date(end))
        }
    }
}

/// 日期 0 点 / 23:59:59 的秒级时间戳（UTC+8）。
#[must_use]
pub fn day_range_secs(start: chrono::NaiveDate, end: chrono::NaiveDate) -> (i64, i64) {
    let start_ts = start
        .and_hms_opt(0, 0, 0)
        .map(|d| d.and_utc().timestamp() - 8 * 3600)
        .unwrap_or(0);
    let end_ts = end
        .and_hms_opt(23, 59, 59)
        .map(|d| d.and_utc().timestamp() - 8 * 3600)
        .unwrap_or(0);
    (start_ts, end_ts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn axes_per_date_type() {
        let start = chrono::NaiveDate::from_ymd_opt(2026, 2, 10).unwrap();
        assert_eq!(horizontal_axis(1, start, start).len(), 12);
        assert_eq!(horizontal_axis(2, start, start).len(), 28);
        assert_eq!(horizontal_axis(3, start, start).len(), 24);
        let custom = horizontal_axis(4, start, start + chrono::Duration::days(2));
        assert_eq!(custom, vec!["2026-02-10", "2026-02-11", "2026-02-12"]);
    }

    #[test]
    fn bucket_and_range() {
        let secs = 1_700_000_000; // UTC+8 2023-11-15 06:13:20
        assert_eq!(bucket_label(1, secs), "11");
        assert_eq!(bucket_label(2, secs), "15");
        assert_eq!(bucket_label(3, secs), "07");
        assert_eq!(bucket_label(4, secs), "2023-11-15");
        let start = chrono::NaiveDate::from_ymd_opt(2026, 2, 10).unwrap();
        assert_eq!(
            range_date(2, start, start).1,
            chrono::NaiveDate::from_ymd_opt(2026, 2, 28).unwrap()
        );
        assert_eq!(
            parse_start_end(Some("2026-01-01,2026-01-31")).1,
            chrono::NaiveDate::from_ymd_opt(2026, 1, 31).unwrap()
        );
        assert_eq!(parse_start_end(None).0, parse_start_end(None).1);
    }

    #[test]
    fn summary_type() {
        assert!(is_today(Some(0)));
        assert!(is_today(None));
        assert!(!is_today(Some(1)));
    }
}
