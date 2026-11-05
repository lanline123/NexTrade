//! 销售统计（analytics::sales_statistics）模型层 —— wave9。
//!
//! 对应 Java `SalesStatisticsController`
//! （`@RequestMapping("/adminapi/panel/salesStatistics")`），5 个 GET：
//! list / salesDetail / salesProductDetail / salesIndicators / salesRanking。
//!
//! ## 口径说明（与 Java 的差异）
//! Java `SalesStatisticsServiceImpl` 的统计口径包含退款/优惠/店铺拆分等复杂逻辑；
//! 本实现按「已支付订单（`pay_status > 0`）+ 时间范围」聚合：
//! - list：按天聚合订单数与金额；
//! - salesDetail：区间总计；
//! - salesProductDetail：订单商品维度分页（按商品聚合数量/金额）；
//! - salesIndicators：今日/昨日/近 7 天/近 30 天四个指标卡；
//! - salesRanking：商品排行（按金额降序，支持时间范围）。
//! 返回结构为 JSON（字段语义对齐 Java VO 子集，未逐字段裁剪）。

use serde::{Deserialize, Serialize};

/// 统计区间查询（5 个端点共用）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesStatisticsQuery {
    /// 开始时间（秒级时间戳；也接受 `YYYY-MM-DD` / `YYYY-MM-DD HH:MM:SS`）
    #[serde(default, deserialize_with = "de_opt_i64_flexible")]
    pub start_time: Option<i64>,
    /// 结束时间（秒级时间戳；也接受 `YYYY-MM-DD` / `YYYY-MM-DD HH:MM:SS`）
    #[serde(default, deserialize_with = "de_opt_i64_flexible")]
    pub end_time: Option<i64>,
    /// 原版前端筛选值：按年 `YYYY` 或按月 `YYYY-MM`
    pub start_end_time: Option<String>,
    /// 时间维度（1=年，2=月）
    pub date_type: Option<String>,
    /// 统计类型（1=金额，0=订单数）
    pub statistic_type: Option<String>,
    /// 店铺 ID（平台为空）
    pub shop_id: Option<i32>,
    /// 页码
    pub page: Option<u32>,
    /// 每页条数
    pub size: Option<u32>,
    /// 排序字段（amount/quantity）
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl SalesStatisticsQuery {
    /// 分页（默认 1/20）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1) as u64,
            page_size: self.size.unwrap_or(20).max(1) as u64,
        }
    }

    /// 排序方向：仅 asc 升序。
    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("asc"))
            .unwrap_or(false)
    }

    /// 时间范围（缺省：近 30 天）。
    #[must_use]
    pub fn range(&self, now: i64) -> (i64, i64) {
        let end = self.end_time.unwrap_or(now);
        let start = self.start_time.unwrap_or_else(|| end - 30 * 24 * 3600);
        (start.min(end), end)
    }
}

/// 按天聚合行。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailySalesRow {
    /// 日期（yyyy-MM-dd）
    pub date: String,
    /// 订单数
    pub order_count: i64,
    /// 销售额
    pub total_amount: rust_decimal::Decimal,
}

/// 商品维度聚合行。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductSalesRow {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品货号
    pub product_sn: String,
    /// 销量
    pub quantity: i64,
    /// 销售额
    pub amount: rust_decimal::Decimal,
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（0 → ""）。
#[must_use]
pub fn format_time(ts: i64) -> String {
    if ts <= 0 {
        return String::new();
    }
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// 兼容前端把 `startTime`/`endTime` 传成日期字符串；数字仍按秒。
fn de_opt_i64_flexible<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use chrono::NaiveDate;
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.as_i64(),
        Some(serde_json::Value::String(s)) => {
            let raw = s.trim();
            if let Ok(secs) = raw.parse::<i64>() {
                Some(secs)
            } else if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S") {
                Some(dt.and_utc().timestamp())
            } else {
                NaiveDate::parse_from_str(raw, "%Y-%m-%d")
                    .ok()
                    .and_then(|d| d.and_hms_opt(0, 0, 0))
                    .map(|dt| dt.and_utc().timestamp())
            }
        }
        _ => None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_original_date_strings_for_sales_detail() {
        let q: SalesStatisticsQuery = serde_json::from_value(serde_json::json!({
            "startTime": "2026-10-01", "endTime": "2026-10-21 23:59:59"
        }))
        .expect("原版日期字符串必须可解析");
        let start = q.start_time.expect("start");
        let end = q.end_time.expect("end");
        assert!(start > 1_700_000_000);
        assert!(end > start);
    }

    #[test]
    fn accepts_original_string_statistic_and_date_type() {
        let q: SalesStatisticsQuery = serde_json::from_value(serde_json::json!({
            "dateType": "1", "statisticType": "0", "startEndTime": "2026"
        }))
        .expect("原版字符串枚举必须可解析");
        assert_eq!(q.date_type.as_deref(), Some("1"));
        assert_eq!(q.statistic_type.as_deref(), Some("0"));
    }

    #[test]
    fn range_defaults_to_last_30_days() {
        let q = SalesStatisticsQuery::default();
        let (start, end) = q.range(1_700_000_000);
        assert_eq!(end, 1_700_000_000);
        assert_eq!(start, end - 30 * 24 * 3600);
    }

    #[test]
    fn range_clamps_reversed_input() {
        let q: SalesStatisticsQuery = serde_json::from_value(serde_json::json!({
            "startTime": 200, "endTime": 100
        }))
        .unwrap();
        assert_eq!(q.range(0), (100, 100));
    }

    #[test]
    fn page_defaults_and_ascending() {
        let q: SalesStatisticsQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page_size, 20);
        assert!(!q.ascending());
        let q: SalesStatisticsQuery =
            serde_json::from_value(serde_json::json!({"sortOrder":"asc"})).unwrap();
        assert!(q.ascending());
    }
}
