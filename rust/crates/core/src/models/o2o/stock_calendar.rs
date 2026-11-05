//! 库存日历（`/adminapi/o2o/stockCalendar`）DTO。
//!
//! Java 来源（overseas）：
//! - `com.tigshop.bean.dto.o2o.stockcalendar.StockCalendarListDTO` / `StockCalendarQueryDTO`
//! - `com.tigshop.bean.vo.o2o.StockCalendarListVO` / `StockCalendarVO`
//! - `com.tigshop.service.product.util.StockCalendarUtil`（日期范围 / 排除日）
//! - 表：`product_reservation_stock`、`product_reservation_time`
//! - 前端契约：`java/view/admin/src/api/product/inventoryCalendar.ts` 与
//!   `views/product/inventoryCalendar/*.vue`（`updateDailyStock` 传
//!   `timeSlotStockChanges`，`stockChange` 为增量）

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

/// `GET /adminapi/o2o/stockCalendar/pageList` 查询参数（Java `StockCalendarListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockCalendarListQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_size", alias = "pageSize")]
    pub size: u64,
    /// 开始日期 `yyyy-MM-dd`（必填，缺省取今天）。
    pub start_date: Option<String>,
    /// 结束日期（缺省 = startDate，即单日）。
    pub end_date: Option<String>,
    /// 商品名称模糊。
    pub product_name: Option<String>,
    /// 规格值模糊。
    pub spec_value: Option<String>,
    /// 逗号分隔门店 ID（为空 = 全部门店 / 按 JWT 店铺范围）。
    pub shop_ids: Option<String>,
    /// 库存查看范围类型：0-全部门店，1-指定门店（配合 shopIds）。
    pub shop_scope_type: Option<i32>,
}

fn default_page() -> u64 {
    1
}

fn default_size() -> u64 {
    20
}

impl StockCalendarListQuery {
    /// 解析门店 ID 过滤（逗号分隔）。
    #[must_use]
    pub fn shop_id_list(&self) -> Vec<i32> {
        self.shop_ids
            .as_deref()
            .unwrap_or_default()
            .split(',')
            .filter_map(|x| x.trim().parse::<i32>().ok())
            .filter(|x| *x > 0)
            .collect()
    }

    /// 计算日期闭区间（`yyyy-MM-dd`；非法值回退今天；end < start 时交换）。
    #[must_use]
    pub fn date_range(&self) -> (NaiveDate, NaiveDate) {
        let today = chrono::Local::now().date_naive();
        let parse = |s: &Option<String>| -> Option<NaiveDate> {
            s.as_deref()
                .and_then(|v| NaiveDate::parse_from_str(v.trim(), "%Y-%m-%d").ok())
        };
        let mut start = parse(&self.start_date).unwrap_or(today);
        let mut end = parse(&self.end_date).unwrap_or(start);
        if end < start {
            std::mem::swap(&mut start, &mut end);
        }
        // 日历最多 31 天窗口（Java StockCalendarUtil 亦按月分页）
        if (end - start).num_days() > 30 {
            end = start + chrono::Duration::days(30);
        }
        (start, end)
    }

    /// 分页 LIMIT/OFFSET。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let size = self.size.clamp(1, 200);
        let page = self.page.max(1);
        (size, (page - 1) * size)
    }
}

/// 日期库存汇总（Java `StockCalendarListVO.DateStockSummary`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DateStockSummary {
    pub stock_date: String,
    pub total_stock: i32,
    pub used_stock: i32,
    pub available_stock: i32,
}

/// 商品信息（Java `StockCalendarListVO.ProductInfo`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockCalendarProductInfo {
    pub product_id: i32,
    pub product_name: Option<String>,
    pub product_image: Option<String>,
    pub sku_id: i32,
    pub spec_value: Option<String>,
}

/// 门店信息（Java `StockCalendarListVO.ShopInfo`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockCalendarShopInfo {
    pub shop_id: i32,
    pub shop_name: Option<String>,
}

/// pageList 行（Java `StockCalendarListVO`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockCalendarListVO {
    pub product_info: StockCalendarProductInfo,
    pub shop_info: StockCalendarShopInfo,
    pub date_stock_list: Vec<DateStockSummary>,
}

/// `GET /adminapi/o2o/stockCalendar/getDailyStock` 查询参数（Java `StockCalendarQueryDTO` + 日期）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStockQuery {
    pub product_id: i32,
    pub shop_id: i32,
    #[serde(default)]
    pub sku_id: Option<i32>,
    /// `yyyy-MM-dd`。
    pub stock_date: String,
}

/// 单个时间段库存（前端 `InventoryCalendarFilterDailyStockState`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSlotStockVO {
    pub product_reservation_time_id: i32,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub total_stock: i32,
    pub used_stock: i32,
    pub available_stock: i32,
    /// 前端编辑用的增量位，读接口固定 0。
    pub stock_change: i32,
}

/// `getDailyStock` 响应（前端 `InventoryCalendarFilterDailyStockResult`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStockVO {
    pub product_id: i32,
    pub shop_id: i32,
    pub sku_id: i32,
    pub stock_date: String,
    pub time_slot_stock_list: Vec<TimeSlotStockVO>,
}

/// `POST /adminapi/o2o/stockCalendar/updateDailyStock` 入参。
///
/// 前端 `SetInventory.vue`：`{productId, skuId?, shopId, stockDate,
/// timeSlotStockChanges: [{productReservationTimeId, stockChange, ...}]}`，
/// `stockChange` 为**增量**（可负），新可预约 = 旧可预约 + 增量。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDailyStockDTO {
    pub product_id: i32,
    #[serde(default)]
    pub sku_id: Option<i32>,
    pub shop_id: i32,
    pub stock_date: String,
    #[serde(default)]
    pub time_slot_stock_changes: Vec<TimeSlotStockChange>,
}

/// 单条时间段的库存增量。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSlotStockChange {
    pub product_reservation_time_id: i32,
    #[serde(default)]
    pub stock_change: Option<i32>,
}

/// 门店选择（前端 `ShopSelectionDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopSelectionDTO {
    /// 1-全部门店，2-指定门店，3-当前门店。
    pub selection_type: i32,
    #[serde(default)]
    pub shop_ids: Option<Vec<i32>>,
}

/// 日期排除（前端 `DateExclusionDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DateExclusionDTO {
    #[serde(default)]
    pub exclude_weekdays: Option<Vec<i32>>,
    #[serde(default)]
    pub exclude_month_days: Option<Vec<i32>>,
    #[serde(default)]
    pub exclude_specific_dates: Option<Vec<String>>,
}

/// `POST /adminapi/o2o/stockCalendar/setUnifiedStock` 入参（前端 `SetUnifiedStockRequest`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetUnifiedStockDTO {
    pub product_id: i32,
    #[serde(default)]
    pub sku_id: Option<i32>,
    #[serde(default)]
    pub shop_selection: Option<ShopSelectionDTO>,
    pub start_date: String,
    pub end_date: String,
    #[serde(default)]
    pub date_exclusion: Option<DateExclusionDTO>,
    pub quantity: i32,
}

/// `POST /adminapi/o2o/stockCalendar/setTimeSlotStock` 入参（前端 `SetTimeSlotStockRequest`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTimeSlotStockDTO {
    pub product_id: i32,
    #[serde(default)]
    pub sku_id: Option<i32>,
    #[serde(default)]
    pub shop_selection: Option<ShopSelectionDTO>,
    pub start_date: String,
    pub end_date: String,
    #[serde(default)]
    pub date_exclusion: Option<DateExclusionDTO>,
    #[serde(default)]
    pub time_slot_stock_items: Vec<TimeSlotStockItem>,
}

/// 单条时间段的目标库存。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSlotStockItem {
    pub product_reservation_time_id: i32,
    pub quantity: i32,
}

/// `GET /adminapi/o2o/stockCalendar/getProductTimeList` 响应
/// （前端 `ProductInventoryCalendarDetail`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductTimeListVO {
    pub product_id: i32,
    pub product_name: Option<String>,
    pub pic_url: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_original: Option<String>,
    pub time_slot_stock_list: Vec<TimeSlotStockVO>,
}

/// 过滤日期集合（对齐 Java `StockCalendarUtil#getFilteredDates`）：
/// - `excludeWeekdays`：1-7（周一~周日）
/// - `excludeMonthDays`：1-31
/// - `excludeSpecificDates`：`yyyy-MM-dd` 精确排除
#[must_use]
pub fn filter_dates(dates: &[NaiveDate], exclusion: Option<&DateExclusionDTO>) -> Vec<NaiveDate> {
    let Some(ex) = exclusion else {
        return dates.to_vec();
    };
    let weekdays: &[i32] = ex.exclude_weekdays.as_deref().unwrap_or(&[]);
    let month_days: &[i32] = ex.exclude_month_days.as_deref().unwrap_or(&[]);
    let specific: &[String] = ex.exclude_specific_dates.as_deref().unwrap_or(&[]);
    dates
        .iter()
        .copied()
        .filter(|d| {
            // Java LocalDate.getDayOfWeek 一~日 = 1~7；chrono 一~日 = 1~7（Mon=1）
            let weekday = d.weekday().number_from_monday() as i32;
            !weekdays.contains(&weekday)
                && !month_days.contains(&(d.day() as i32))
                && !specific
                    .iter()
                    .any(|s| NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d") == Ok(*d))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn date_range_clamps_to_31_days() {
        let q: StockCalendarListQuery =
            serde_json::from_str(r#"{"startDate":"2026-01-01","endDate":"2026-03-01"}"#).unwrap();
        let (s, e) = q.date_range();
        assert_eq!(s.to_string(), "2026-01-01");
        assert_eq!((e - s).num_days(), 30);
    }

    #[test]
    fn filter_dates_weekdays_and_specific() {
        // 2026-10-19 是周一
        let dates = vec![
            NaiveDate::from_ymd_opt(2026, 10, 19).unwrap(),
            NaiveDate::from_ymd_opt(2026, 10, 20).unwrap(),
        ];
        let ex = DateExclusionDTO {
            exclude_weekdays: Some(vec![1]),
            exclude_month_days: None,
            exclude_specific_dates: Some(vec!["2026-10-20".into()]),
        };
        let out = filter_dates(&dates, Some(&ex));
        assert!(out.is_empty());
    }
}
