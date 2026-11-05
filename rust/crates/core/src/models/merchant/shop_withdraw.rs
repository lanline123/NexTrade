//! 商家提现（`merchant::shop_withdraw`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.shop.ShopWithdrawController`
//!   （`/adminapi/merchant/shopWithdraw`，本切片 8 个端点：
//!   `create` / `update` / `del` / `updateField` / `batch` / `uploadPayVoucher` /
//!   `summaryList` / `dualBalance`；`list` / `detail` / `config` / `audit`
//!   已由 `merchant::shop` 实现，不重复注册）
//! - `com.tigshop.service.shop.impl.ShopWithdrawServiceImpl`
//! - DTO：`ShopWithdrawCreateDTO` / `ShopWithdrawUpdateDTO` /
//!   `ShopWithdrawPayVoucherDTO` / `ShopWithdrawSummaryListDTO`
//! - VO：`ShopWithdrawSummaryVO`；枚举 `ShopWithdrawStatus`
//!
//! 金额 `rust_decimal::Decimal`；秒级时间戳 `i32`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 提现状态文案（Java `ShopWithdrawStatus`：0待审核 1正在处理 2审核不通过 3完成 4待打款）。
#[must_use]
pub fn withdraw_status_text(status: i32) -> &'static str {
    match status {
        0 => "待审核",
        1 => "正在处理",
        2 => "审核不通过",
        3 => "完成",
        4 => "待打款",
        _ => "",
    }
}

/// 店铺状态文案（Java `ShopType`，用于汇总列表 `statusText`）。
#[must_use]
pub fn shop_status_text(status: Option<i32>) -> String {
    match status {
        Some(1) => "开业",
        Some(4) => "停业",
        Some(10) => "打烊",
        _ => "",
    }
    .to_string()
}

/// 提现金额校验（Java `shopWithdrawCheck` 第一段）：
/// `amount > 0` 且最多两位小数，否则逐字报错。
pub fn validate_amount(amount: Option<Decimal>) -> Result<Decimal, String> {
    let Some(amount) = amount else {
        return Err("提现金额必须大于0且最多两位小数".to_string());
    };
    if amount <= Decimal::ZERO || amount.normalize().scale() > 2 {
        return Err("提现金额必须大于0且最多两位小数".to_string());
    }
    Ok(amount)
}

/// `yyyy-MM-dd` → 当天 00:00:00 的秒级时间戳（Java `DateUtil.parse(... + " 00:00:00")`）。
#[must_use]
pub fn parse_date_start(raw: &str) -> Option<i32> {
    parse_date(raw, 0, 0, 0)
}

/// `yyyy-MM-dd` → 当天 23:59:59 的秒级时间戳。
#[must_use]
pub fn parse_date_end(raw: &str) -> Option<i32> {
    parse_date(raw, 23, 59, 59)
}

fn parse_date(raw: &str, hour: u32, minute: u32, second: u32) -> Option<i32> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let date = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok()?;
    let dt = date.and_hms_opt(hour, minute, second)?;
    use chrono::TimeZone;
    chrono::Local
        .from_local_datetime(&dt)
        .earliest()
        .map(|v| v.timestamp() as i32)
}

/// 汇总列表排序字段白名单（Java `resolveShopSortColumn`）：
/// `shopTitle`→`t.shop_title`，`shopMoney`→`t.shop_money`，`status`→`t.status`，
/// `addTime`→`t.add_time`，`withdrawnAmount`→`withdrawn_amount`，
/// `pendingWithdrawAmount`→`pending_withdraw_amount`，未知→`t.shop_id`。
#[must_use]
pub fn resolve_summary_sort_column(sort_field: Option<&str>) -> &'static str {
    match sort_field.map(str::trim) {
        Some("shopTitle") => "t.shop_title",
        Some("shopMoney") => "t.shop_money",
        Some("status") => "t.status",
        Some("addTime") => "t.add_time",
        Some("withdrawnAmount") => "withdrawn_amount",
        Some("pendingWithdrawAmount") => "pending_withdraw_amount",
        _ => "t.shop_id",
    }
}

/// 创建提现入参（Java `ShopWithdrawCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawCreateDTO {
    pub merchant_account_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub remark: Option<String>,
    /// 线下提现收款账户信息（`AccountData` 对象，原样存入 `account_data` JSON）
    pub account_data: Option<serde_json::Value>,
    /// 1 线下 2 线上（缺省 1）
    pub withdraw_type: Option<i32>,
    /// 线上提现渠道：WECHAT / HUIFU / ALIPAY
    pub pay_channel: Option<String>,
}

/// 更新提现入参（Java `ShopWithdrawUpdateDTO`）。
///
/// Java 该 DTO 由代码生成器带出 `shopWithdrawName/shopWithdrawPic/sortOrder/isShow`
/// 等通用字段，而 `shop_withdraw` 表并无对应列（`BeanUtils.copyProperties` 静默忽略）。
/// 本实现仅落库真实存在的 `status`，其余字段保留在 DTO 上做契约兼容。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawUpdateDTO {
    pub shop_withdraw_id: Option<i32>,
    pub shop_withdraw_name: Option<String>,
    pub shop_withdraw_pic: Option<String>,
    pub sort_order: Option<i32>,
    pub is_show: Option<i32>,
    pub status: Option<i32>,
}

/// 上传打款凭证入参（Java `ShopWithdrawPayVoucherDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawPayVoucherDTO {
    pub id: Option<i32>,
    pub payment_voucher: Option<String>,
}

/// 提现汇总列表查询（Java `ShopWithdrawSummaryListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawSummaryQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub shop_title: Option<String>,
    pub keyword: Option<String>,
    pub status: Option<i32>,
    pub shop_type: Option<i32>,
    /// 店铺创建时间起 `yyyy-MM-dd`
    pub add_time_start: Option<String>,
    /// 店铺创建时间止 `yyyy-MM-dd`
    pub add_time_end: Option<String>,
    /// 提现时间起 `yyyy-MM-dd`
    pub withdraw_time_start: Option<String>,
    /// 提现时间止 `yyyy-MM-dd`
    pub withdraw_time_end: Option<String>,
}

impl ShopWithdrawSummaryQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }

    /// 排序方向：`asc`（忽略大小写）→ ASC，否则 DESC。
    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }
}

/// 店铺提现汇总行（对应 Java `ShopWithdrawSummaryVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawSummaryVO {
    pub shop_id: i32,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub status: Option<i32>,
    pub status_text: Option<String>,
    pub shop_money: Option<Decimal>,
    pub withdrawn_amount: Decimal,
    pub pending_withdraw_amount: Decimal,
    pub add_time: Option<i32>,
}

/// 双余额（Java `getDualBalance` 的 `Map<String,Object>`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DualBalanceVO {
    /// 线下可用余额（`shop.shop_money`）
    pub shop_money: Decimal,
    /// 是否开启分账（未迁移 → false）
    pub profit_sharing_enabled: bool,
    /// 三渠道可用余额（未迁移 → 空）
    pub channel_balances: std::collections::BTreeMap<String, Decimal>,
    /// 三渠道状态（未迁移 → 空）
    pub channel_statuses: std::collections::BTreeMap<String, String>,
    /// 兼容旧前端：微信渠道余额
    pub wechat_balance: Option<Decimal>,
    /// 兼容旧前端：线上余额
    pub online_balance: Option<Decimal>,
    /// 兼容旧前端：线上渠道
    pub online_channel: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn withdraw_status_texts_match_java_enum() {
        assert_eq!(withdraw_status_text(0), "待审核");
        assert_eq!(withdraw_status_text(1), "正在处理");
        assert_eq!(withdraw_status_text(2), "审核不通过");
        assert_eq!(withdraw_status_text(3), "完成");
        assert_eq!(withdraw_status_text(4), "待打款");
        assert_eq!(withdraw_status_text(9), "");
        assert_eq!(shop_status_text(Some(1)), "开业");
        assert_eq!(shop_status_text(Some(4)), "停业");
        assert_eq!(shop_status_text(Some(10)), "打烊");
        assert_eq!(shop_status_text(None), "");
    }

    #[test]
    fn amount_validation_is_verbatim() {
        assert_eq!(
            validate_amount(None).unwrap_err(),
            "提现金额必须大于0且最多两位小数"
        );
        assert_eq!(
            validate_amount(Some(Decimal::ZERO)).unwrap_err(),
            "提现金额必须大于0且最多两位小数"
        );
        assert_eq!(
            validate_amount(Some(Decimal::from_str("-1.00").unwrap())).unwrap_err(),
            "提现金额必须大于0且最多两位小数"
        );
        assert_eq!(
            validate_amount(Some(Decimal::from_str("1.234").unwrap())).unwrap_err(),
            "提现金额必须大于0且最多两位小数"
        );
        assert_eq!(
            validate_amount(Some(Decimal::from_str("10.20").unwrap())).unwrap(),
            Decimal::from_str("10.20").unwrap()
        );
        // 尾随 0 不算小数位（`stripTrailingZeros().scale()` 口径）
        assert!(validate_amount(Some(Decimal::from_str("10.100").unwrap())).is_ok());
    }

    #[test]
    fn date_parsing_and_sort_whitelist() {
        assert!(parse_date_start("2026-10-18").is_some());
        assert!(parse_date_end("2026-10-18").is_some());
        assert!(parse_date_start("2026-10-18") < parse_date_end("2026-10-18"));
        assert!(parse_date_start("not-a-date").is_none());
        assert!(parse_date_start("").is_none());
        assert_eq!(
            resolve_summary_sort_column(Some("shopTitle")),
            "t.shop_title"
        );
        assert_eq!(
            resolve_summary_sort_column(Some("pendingWithdrawAmount")),
            "pending_withdraw_amount"
        );
        assert_eq!(
            resolve_summary_sort_column(Some("1; DROP TABLE shop")),
            "t.shop_id"
        );
        assert_eq!(resolve_summary_sort_column(None), "t.shop_id");
    }
}
