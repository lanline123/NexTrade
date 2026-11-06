//! 首页面板域服务（analytics::panel）。
//!
//! 构造 `pub fn new(repos: Arc<Repositories>) -> Self`；仓储访问**嵌套**：
//! `self.repos.analytics.panel.<method>()`。对应 Java `SalesStatisticsServiceImpl`
//! 的面板部分 + `PanelShortcutMenuServiceImpl`。
//!
//! 返回动态 JSON（键名对齐 Java `PanelIndexVO` / `PanelVendorIndexVO`）；未迁移指标见
//! models 模块文档（访问量/浏览量/供应商结算/深度聚合恒 0 或空）。

use std::sync::Arc;

use serde_json::{json, Value};
use tigshop_common::utils::now_seconds;
use tigshop_core::models::analytics::panel::{
    day_key, day_windows, growth_rate, normalize_menu_keys, ShortcutMenuVO, DEFAULT_DAYS,
    SERVICE_DATA_ERROR,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::analytics::panel::PanelRepository;
use tigshop_infrastructure::db::Repositories;

/// 首页面板域服务。
pub struct PanelService {
    repos: Arc<Repositories>,
}

impl PanelService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    #[must_use]
    pub fn repo(&self) -> &PanelRepository {
        &self.repos.analytics.panel
    }

    /// `GET /adminapi/panel/panel/index`：首页面板。
    ///
    /// `shop_scope`：店铺账号仅统计本店订单/商品/店铺会员；平台 `None`（全平台）。
    pub async fn index(&self, shop_scope: Option<i32>) -> Result<Value> {
        let now = now_seconds();
        let (t0, tn, y0, _y1) = day_windows(now);
        let (today_num, today_amount) = self.repo().order_window(t0, tn, shop_scope, None).await?;
        let (yesterday_num, yesterday_amount) = self.repo().order_window(y0, t0, shop_scope, None).await?;
        let today_buyer = self.repo().user_window(t0, tn, shop_scope).await?;
        let yesterday_buyer = self.repo().user_window(y0, t0, shop_scope).await?;
        let (product_total, product_on_sale) = self.repo().product_counts(shop_scope, None).await?;
        let await_pay = self.repo().order_count_by_status(0, shop_scope, None).await?;
        let await_ship = self.repo().order_count_by_status(1, shop_scope, None).await?;
        let today_amount_f = today_amount.parse::<f64>().unwrap_or(0.0);
        let yesterday_amount_f = yesterday_amount.parse::<f64>().unwrap_or(0.0);
        Ok(json!({
            "consoleData": {
                "awaitPay": await_pay,
                "awaitShip": await_ship,
                "awaitAfterSale": 0,
                "awaitComment": 0,
                "todayOrderNum": today_num,
                "todayOrderAmount": today_amount_f,
                "todayBuyerNum": today_buyer,
                "productTotalNum": product_total,
                "productOnSaleNum": product_on_sale,
                "todayViewNum": 0,
                "todayVisitNum": 0,
            },
            "realTimeData": {
                "todayOrderAmount": today_amount_f,
                "yesterdayOrderAmount": yesterday_amount_f,
                "orderAmountGrowthRate": growth_rate(today_amount_f, yesterday_amount_f),
                "todayVisitNum": 0,
                "yesterdayVisitNum": 0,
                "visitGrowthRate": 0.0,
                "todayBuyerNum": today_buyer,
                "yesterdayBuyerNum": yesterday_buyer,
                "buyerGrowthRate": growth_rate(today_buyer as f64, yesterday_buyer as f64),
                "todayViewNum": 0,
                "yesterdayViewNum": 0,
                "viewGrowthRate": 0.0,
                "todayOrderNum": today_num,
                "yesterdayOrderNum": yesterday_num,
                "orderGrowthRate": growth_rate(today_num as f64, yesterday_num as f64),
            },
            "panelStatisticalData": {
                "todayOrderAmount": today_amount_f,
                "yesterdayOrderAmount": yesterday_amount_f,
                "orderAmountGrowthRate": growth_rate(today_amount_f, yesterday_amount_f),
                "todayOrderNum": today_num,
                "yesterdayOrderNum": yesterday_num,
                "orderGrowthRate": growth_rate(today_num as f64, yesterday_num as f64),
                "todayBuyerNum": today_buyer,
                "yesterdayBuyerNum": yesterday_buyer,
                "buyerGrowthRate": growth_rate(today_buyer as f64, yesterday_buyer as f64),
                "todayVisitNum": 0,
                "yesterdayVisitNum": 0,
                "visitGrowthRate": 0.0,
                "todayViewNum": 0,
                "yesterdayViewNum": 0,
                "viewGrowthRate": 0.0,
            },
            "awaitPay": await_pay,
            "awaitShip": await_ship,
            "awaitAfterSale": 0,
            "awaitComment": 0,
            "todayOrderAmount": today_amount_f,
            "yesterdayOrderAmount": yesterday_amount_f,
            "orderAmountGrowthRate": growth_rate(today_amount_f, yesterday_amount_f),
            "todayVisitNum": 0,
            "yesterdayVisitNum": 0,
            "visitGrowthRate": 0.0,
            "todayBuyerNum": today_buyer,
            "yesterdayBuyerNum": yesterday_buyer,
            "buyerGrowthRate": growth_rate(today_buyer as f64, yesterday_buyer as f64),
            "todayViewNum": 0,
            "yesterdayViewNum": 0,
            "viewGrowthRate": 0.0,
            "todayOrderNum": today_num,
            "yesterdayOrderNum": yesterday_num,
            "orderGrowthRate": growth_rate(today_num as f64, yesterday_num as f64),
        }))
    }

    /// `GET /adminapi/panel/panel/vendorIndex`：供应商面板（供应商结算域未迁移）。
    ///
    /// `vendor_scope`：供应商账号仅统计本供应商订单/商品；平台 `None`（全局）。
    pub async fn vendor_index(&self, vendor_scope: Option<i32>) -> Result<Value> {
        let now = now_seconds();
        let (t0, tn, _y0, _y1) = day_windows(now);
        let (today_num, today_amount) = self
            .repo()
            .order_window(t0, tn, None, vendor_scope)
            .await?;
        let (product_total, product_on_sale) =
            self.repo().product_counts(None, vendor_scope).await?;
        let await_ship = self.repo().order_count_by_status(1, None, vendor_scope).await?;
        Ok(json!({
            "awaitShip": await_ship,
            "awaitSettlement": 0,
            "awaitAfterSale": 0,
            "saleOutProductNum": 0,
            "todaySettlementAmount": 0.0,
            "todaySettlementNum": today_num,
            "saleProductNum": product_on_sale,
            "outageProductNum": product_total - product_on_sale,
            "accountBalance": 0.0,
            "awaitSettlementAmount": 0.0,
            "bindShopNum": 0,
            "todayOrderAmount": today_amount.parse::<f64>().unwrap_or(0.0),
            "todayOrderNum": today_num,
        }))
    }

    /// `GET /adminapi/panel/panel/statisticalData?days=`：趋势（订单数/金额）。
    ///
    /// `shop_scope`：店铺账号仅统计本店订单；平台 `None`。
    pub async fn statistical_data(&self, days: i64, shop_scope: Option<i32>) -> Result<Value> {
        let now = now_seconds();
        let days = days.clamp(1, 365);
        let (t0, _tn, _y0, _y1) = day_windows(now);
        let from = t0 - (days - 1) * 86_400;
        let rows = self.repo().order_trend(from, now, shop_scope, None).await?;
        // 数据库只返回有订单的日期；前端趋势图需要完整日期轴，缺失日期补 0。
        let mut by_day = std::collections::HashMap::new();
        for (day, n, amt) in rows {
            by_day.insert(day, (n, amt));
        }
        let mut horizontal: Vec<String> = Vec::new();
        let mut order_num: Vec<i64> = Vec::new();
        let mut order_amount: Vec<f64> = Vec::new();
        let start_day = from.div_euclid(86_400);
        let end_day = now.div_euclid(86_400);
        for day in start_day..=end_day {
            horizontal.push(day_key(day * 86_400));
            let (n, amt) = by_day
                .get(&day)
                .cloned()
                .unwrap_or((0, "0".to_string()));
            order_num.push(n);
            order_amount.push(amt.parse::<f64>().unwrap_or(0.0));
        }
        let from_date = day_key(from);
        let to_date = day_key(now);
        let daily_visits = self
            .repos
            .analytics
            .statistics
            .fetch_daily_click_counts(&from_date, &to_date)
            .await
            .unwrap_or_default();
        let mut visit_by_day = std::collections::HashMap::new();
        for row in &daily_visits {
            visit_by_day.insert(row.period.clone(), row.click_count);
        }
        let access: Vec<i64> = horizontal
            .iter()
            .map(|day| *visit_by_day.get(day.as_str()).unwrap_or(&0))
            .collect();
        Ok(json!({
            "horizontalAxis": horizontal,
            "longitudinalAxisAccess": access,
            "longitudinalAxisOrderNum": order_num,
            "longitudinalAxisOrderAmount": order_amount,
        }))
    }

    /// `GET /adminapi/panel/panel/vendorStatisticalData?days=`：供应商收益趋势
    /// （收入/访问指标未迁移，复用订单数曲线）。
    ///
    /// `vendor_scope`：供应商账号仅统计本供应商订单；平台 `None`。
    pub async fn vendor_statistical_data(
        &self,
        days: i64,
        vendor_scope: Option<i32>,
    ) -> Result<Value> {
        let now = now_seconds();
        let days = days.clamp(1, 365);
        let (t0, _tn, _y0, _y1) = day_windows(now);
        let from = t0 - (days - 1) * 86_400;
        let rows = self
            .repo()
            .order_trend(from, now, None, vendor_scope)
            .await?;
        let mut by_day = std::collections::HashMap::new();
        for (day, n, amt) in rows {
            by_day.insert(day, (n, amt));
        }
        let mut horizontal: Vec<String> = Vec::new();
        let mut income: Vec<f64> = Vec::new();
        let mut order_num: Vec<i64> = Vec::new();
        let start_day = from.div_euclid(86_400);
        let end_day = now.div_euclid(86_400);
        for day in start_day..=end_day {
            horizontal.push(day_key(day * 86_400));
            let (n, amt) = by_day
                .get(&day)
                .cloned()
                .unwrap_or((0, "0".to_string()));
            income.push(amt.parse::<f64>().unwrap_or(0.0));
            order_num.push(n);
        }
        Ok(json!({
            "horizontalAxis": horizontal,
            "longitudinalAxisIncome": income,
            "longitudinalAxisOrderNum": order_num,
        }))
    }

    /// `GET /adminapi/panel/panel/searchMenu?keyword=`：一键直达。
    pub async fn search_menu(&self, keyword: Option<&str>) -> Result<Value> {
        let rows = self.repo().search_authority(keyword).await?;
        Ok(Value::Array(
            rows.into_iter()
                .map(|(id, sn, name, route)| {
                    // 原版前端读取 authorityNames（数组）并 .join(" / ")；
                    // authoritySn 用于点击后按路由 name 跳转。
                    json!({
                        "authorityId": id,
                        "authoritySn": sn,
                        "authorityName": name,
                        "authorityNames": [name],
                        "routeLink": route
                    })
                })
                .collect(),
        ))
    }

    /// `GET /adminapi/panel/panel/shortcutMenu`：快捷功能配置。
    pub async fn shortcut_menu(&self, admin_id: i32, shop_id: i32) -> Result<ShortcutMenuVO> {
        let raw = self.repo().shortcut_menu_keys(admin_id, shop_id).await?;
        let list: Vec<String> = raw
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default();
        Ok(ShortcutMenuVO { list })
    }

    /// `POST /adminapi/panel/panel/saveShortcutMenu`：保存快捷功能配置。
    pub async fn save_shortcut_menu(
        &self,
        list: Option<&[String]>,
        admin_id: i32,
        shop_id: i32,
    ) -> Result<bool> {
        let normalized = normalize_menu_keys(list);
        let menu_keys = serde_json::to_string(&normalized)
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("快捷菜单序列化失败: {e}")))?;
        self.repo()
            .save_shortcut_menu_keys(admin_id, shop_id, &menu_keys, now_seconds())
            .await?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_and_growth_helpers() {
        assert_eq!(DEFAULT_DAYS, 7);
        assert_eq!(growth_rate(0.0, 0.0), 0.0);
    }
}
