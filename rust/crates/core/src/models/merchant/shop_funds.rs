//! 店铺资金域（merchant::shop_funds）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.shop.ShopFundsController`
//!   （`@RequestMapping("/adminapi/merchant/shopAccount")`，8 个端点）
//! - `com.tigshop.service.shop.impl.ShopFundsServiceImpl`
//! - `ShopFunds` 模型的 `@TableName("shop")` —— **本域操作的是 `shop` 表**
//!   （`ShopFundsVO` 只暴露资金相关列）
//! - `ShopFundsListDTO` / `ShopFundsCreateDTO` / `ShopFundsUpdateDTO`
//! - `ShopType`（1 开业 / 4 停业 / 10 打烊）用于 `statusText`
//! - `SettingsEnum.SHOP_AGREEMENT`（`applyShopAgreement` 读取入驻协议）
//!
//! # 端点（8）
//! `GET list/detail/applyShopAgreement`、`POST create/update/del/updateField/batch`。
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. **`create` 未迁移**：Java `ShopFundsCreateDTO` 的字段（`shopFundsName` 等）
//!    与 `shop` 表列完全不对应（BeanUtils 拷贝为空），实际无法创建店铺；
//!    店铺由入驻流程创建。本实现返回 501 业务错误，文案说明原因。
//! 2. **`update` 语义**：Java `updateById` 因 `shopFundsId` 与表主键 `shop_id`
//!    不匹配同样不可用；本实现按真实列名 `shopId + shopTitle/shopMoney/...`
//!    做局部更新（`None` 列保留原值），使后台可编辑资金字段，属**增强**。
//! 3. **`unSettlementOrder` 排序**：Java 逐店铺调用订单服务计算未结算金额并在
//!    内存排序；Rust 订单域未提供等价聚合，`sortField=unSettlementOrder` 时
//!    回退 `shop_id DESC`（其它列走 SQL 白名单）。
//! 4. `statusText` 沿用 Java `ShopType.getTypeName(status)`（1/4/10）。
//! 5. 金额一律 `rust_decimal::Decimal`（`shop_money` / `frozen_money`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 店铺状态文案（Java `ShopType`）。
pub const MSG_STATUS_OPEN: &str = "开业";
pub const MSG_STATUS_PAUSE: &str = "停业";
pub const MSG_STATUS_CLOSE: &str = "打烊";
/// 错误文案。
pub const MSG_SHOP_NOT_FOUND: &str = "店铺不存在";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
pub const MSG_CREATE_NOT_MIGRATED: &str =
    "店铺资金账户创建未迁移：店铺由入驻流程创建，请使用 /update 维护资金字段";
/// `applyShopAgreement` 的配置 biz_code（Java `SettingsEnum.SHOP_AGREEMENT`）。
pub const BIZ_SHOP_AGREEMENT: &str = "shopAgreement";
/// 自提点 `shop_type`（Java `ShopTypeEnum.PICKUP`），列表排除。
pub const SHOP_TYPE_PICKUP: i32 = 3;
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 状态文案（Java `ShopType.getTypeName`）。
#[must_use]
pub fn status_text(status: Option<i32>) -> String {
    match status {
        Some(1) => MSG_STATUS_OPEN.into(),
        Some(4) => MSG_STATUS_PAUSE.into(),
        Some(10) => MSG_STATUS_CLOSE.into(),
        _ => String::new(),
    }
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

/// 列表查询（Java `ShopFundsListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopFundsListQuery {
    pub status: Option<i32>,
    pub shop_type: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 新增入参（兼容 Java 旧字段名；见模块头差异第 1 条）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopFundsCreateDTO {
    pub shop_id: Option<i32>,
    #[serde(alias = "shopFundsName")]
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub status: Option<i32>,
    pub merchant_id: Option<i32>,
    pub description: Option<String>,
    pub contact_mobile: Option<String>,
}

/// 编辑入参（`shopId` 必填；`None` 列保留原值）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopFundsUpdateDTO {
    #[serde(alias = "shopFundsId")]
    pub shop_id: Option<i32>,
    #[serde(alias = "shopFundsName")]
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub status: Option<i32>,
    pub merchant_id: Option<i32>,
    pub description: Option<String>,
    pub contact_mobile: Option<String>,
}

/// 单 ID / 字段 / 批量通用入参。
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

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 店铺资金 VO（Java `ShopFundsVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopFundsVO {
    pub shop_id: i32,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub add_time: String,
    pub click_count: Option<i32>,
    pub status: Option<i32>,
    pub status_text: String,
    pub merchant_id: Option<i32>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub contact_mobile: Option<String>,
    pub description: Option<String>,
    pub kefu_phone: Option<String>,
    pub kefu_weixin: Option<String>,
    pub kefu_link: Option<String>,
    pub is_contact_kefu: Option<i32>,
    pub kefu_inlet: Option<i32>,
}

/// `updateField` 白名单归一（Java `GENERAL_FIELDS` → `shop` 实存 `status`）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    match field {
        "status" => Some("status"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_texts_match_shop_type() {
        assert_eq!(status_text(Some(1)), "开业");
        assert_eq!(status_text(Some(4)), "停业");
        assert_eq!(status_text(Some(10)), "打烊");
        assert_eq!(status_text(None), "");
    }

    #[test]
    fn time_format_and_whitelist() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(normalize_field("status"), Some("status"));
        assert_eq!(normalize_field("sortOrder"), None);
    }

    #[test]
    fn dto_accepts_legacy_aliases() {
        let d: ShopFundsUpdateDTO =
            serde_json::from_str(r#"{"shopFundsId":9,"shopFundsName":"店铺","shopMoney":"12.50"}"#)
                .unwrap();
        assert_eq!(d.shop_id, Some(9));
        assert_eq!(d.shop_title.as_deref(), Some("店铺"));
        assert_eq!(d.shop_money, Some("12.50".parse().unwrap()));
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = ShopFundsVO {
            shop_id: 3,
            status_text: status_text(Some(1)),
            shop_money: Some("10.00".parse().unwrap()),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["shopId"], 3);
        assert_eq!(json["statusText"], "开业");
        assert_eq!(json["shopMoney"], "10.00");
    }
}
