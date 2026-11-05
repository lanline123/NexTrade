//! 分销业绩订单（marketing::salesman_order）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - admin `com.tigshop.adminapi.controller.salesman.SalesmanOrderController`
//!   （`@RequestMapping("/adminapi/salesman/order")`，3 个端点）
//! - public `com.tigshop.api.controller.salesman.SalesmanOrderController`
//!   （`@RequestMapping("/api/salesman/order")`，1 个端点 `list`）
//! - `SalesmanOrderServiceImpl` + `SalesmanOrderPageQuery` /
//!   `SalesmanOrderSettlementDTO` / `SalesmanOrderVO` / `SalesmanOrderStatus`
//!
//! 表：`salesman_order`（12 列，实体 `entities::SalesmanOrder`）；只读关联
//! `order`（取 `order_sn`、按 `order.add_time` 过滤时间类型）。
//!
//! # 端点（4）
//! admin：`GET /adminapi/salesman/order/list`、`POST batch`、`POST settlement`；
//! public：`GET /api/salesman/order/list`（当前分销员业绩订单）。
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. `settlement`：Java `manualSettle` 仅对 `status=0` 记录按订单去重后调用
//!    订单域 `settlement(orderId, 1)`（标记已结算 + 累加业绩额 + 发放佣金 +
//!    触发升级）。Rust 简化为「`status: 0 → 1` 且写 `settlement_time=now`」，
//!    佣金账户 / 等级升级等跨域副作用未迁移（订单域结算服务当前无对应入口）。
//! 2. `batch`：Java 继承 `BaseServiceImpl#batch`（仅 `del`）；本实现仍支持
//!    `type=del` 物理删除（`salesman_order` 无逻辑删除列）。
//! 3. `list`：Java 先查店铺全部订单再 `IN (shopOrderIds)`（大表风险），并按
//!    `timeType` 分别过滤下单/支付/收货时间；Rust 改为 join 过滤（见服务层），
//!    `isExport` 忽略（无 Excel 依赖）。
//! 4. `VO` 为精简子集：Java 内嵌 `salesman` / `userOrder` / `userOrderItem` /
//!    `salesmanProductData` 解析等；Rust 只返回订单主字段 + `order_sn`。
//!
//! # 金额：`amount` / `order_amount` 为 `Decimal`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 分销业绩订单状态（Java `SalesmanOrderStatus`，数值与文案逐字）。
pub const STATUS_UNSETTLED: i32 = 0;
pub const STATUS_SETTLED: i32 = 1;
pub const STATUS_INVALID: i32 = 2;
pub const MSG_STATUS_UNSETTLED: &str = "待结算";
pub const MSG_STATUS_SETTLED: &str = "已结算";
pub const MSG_STATUS_INVALID: &str = "已失效";

pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_IDS_REQUIRED: &str = "请选择要结算的记录";
pub const MSG_ORDER_NOT_FOUND: &str = "分销业绩订单不存在";
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 状态文案（Java `SalesmanOrderStatus#getDescription`）。
#[must_use]
pub fn status_text(status: Option<i32>) -> String {
    match status {
        Some(STATUS_UNSETTLED) => MSG_STATUS_UNSETTLED.into(),
        Some(STATUS_SETTLED) => MSG_STATUS_SETTLED.into(),
        Some(STATUS_INVALID) => MSG_STATUS_INVALID.into(),
        _ => String::new(),
    }
}

/// 业绩订单列表查询（Java `SalesmanOrderPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanOrderListQuery {
    pub order_sn: Option<String>,
    /// `-1` 表示全部（Java `status != -1` 才过滤）
    pub status: Option<i32>,
    /// 时间类型：1 下单 / 2 支付 / 3 收货（Java `timeType`）
    pub time_type: Option<i32>,
    pub order_time_start: Option<String>,
    pub order_time_end: Option<String>,
    pub is_export: Option<i32>,
    pub range: Option<String>,
    pub salesman_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 人工结算入参（Java `SalesmanOrderSettlementDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanOrderSettlementDTO {
    pub ids: Option<Vec<i32>>,
}

/// 单 ID / 批量通用入参（Java `OperateDTO` / `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
}

/// 业绩订单 VO（Java `SalesmanOrderVO` 精简子集，见差异 4）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanOrderVO {
    pub salesman_order_id: i32,
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub salesman_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub status: Option<i32>,
    pub status_text: String,
    pub add_time: String,
    pub item_id: Option<i32>,
    pub order_amount: Option<Decimal>,
    pub settlement_time: Option<i32>,
    pub product_id: Option<i32>,
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；0/None → 空串）。
#[must_use]
pub fn format_time(secs: Option<i32>) -> String {
    use chrono::TimeZone;
    let Some(secs) = secs else {
        return String::new();
    };
    if secs == 0 {
        return String::new();
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// `yyyy-MM-dd` / `yyyy-MM-dd HH:mm:ss` → Unix 秒（东八区；非法 → None）。
#[must_use]
pub fn parse_time(raw: Option<&str>) -> Option<i64> {
    use chrono::TimeZone;
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let tz = chrono::FixedOffset::east_opt(8 * 3600)?;
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S") {
        return tz.from_local_datetime(&dt).single().map(|v| v.timestamp());
    }
    let date = chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d").ok()?;
    tz.from_local_datetime(&date.and_hms_opt(0, 0, 0)?)
        .single()
        .map(|v| v.timestamp())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_texts_match_java_enum() {
        assert_eq!(status_text(Some(0)), "待结算");
        assert_eq!(status_text(Some(1)), "已结算");
        assert_eq!(status_text(Some(2)), "已失效");
        assert_eq!(status_text(None), "");
    }

    #[test]
    fn time_helpers_match_java() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(parse_time(Some("2023-11-15")), Some(1_699_977_600));
        assert_eq!(parse_time(Some("bad")), None);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = SalesmanOrderVO {
            salesman_order_id: 3,
            order_sn: Some("SN1".into()),
            amount: Some("10.00".parse().unwrap()),
            status_text: status_text(Some(1)),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["salesmanOrderId"], 3);
        assert_eq!(json["orderSn"], "SN1");
        assert_eq!(json["amount"], "10.00");
        assert_eq!(json["statusText"], "已结算");
    }

    #[test]
    fn settlement_dto_requires_ids() {
        let d: SalesmanOrderSettlementDTO = serde_json::from_str(r#"{"ids":[1,2]}"#).unwrap();
        assert_eq!(d.ids, Some(vec![1, 2]));
        assert_eq!(MSG_IDS_REQUIRED, "请选择要结算的记录");
    }
}
