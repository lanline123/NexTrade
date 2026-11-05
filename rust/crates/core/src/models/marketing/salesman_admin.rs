//! 分销员管理域（marketing::salesman_admin）DTO / VO / 纯逻辑。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanController`
//! （`@RequestMapping("/adminapi/salesman/salesman")`）的管理端端点。
//! 该 feature 的 `GET /adminapi/salesman/salesman/list` 已由基线
//! `routes/marketing/salesman.rs` 注册，**本模块不重复注册**（其余 8 条）。
//!
//! # 端点（本模块 8 条；spec 13 条中 8 条 admin，5 条 `/api` 见报告）
//! `GET detail` / `statisticalDetails` / `commissionDetails` / `ranking` /
//! `salesmanList` / `customerList`；`POST create` / `update`。
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. **等级文案**：Java `levelText` 取自 `salesman_config` JSON 的
//!    `level[]`；配置读取链路未迁移，本实现 `levelText` 为空串（`level`
//!    数值仍返回）。
//! 2. **`statisticalDetails` 导出**：Java `isExport=1` 时写 Excel 响应；
//!    Rust 无 Excel 依赖，忽略该标记（仍返回分页数据）。
//! 3. **`commissionDetails`**：Java 用 `salesman_order.salesman_settlement_data`
//!    JSON 区分自动/人工结算；本实现只给 `commission`（amount 合计）、
//!    `productTransactionAmount`（order_amount 合计），其余结算分项为 0。
//! 4. **`ranking`**：客户数按 `salesman_customer`（绑定期内）统计；
//!    付费客户数按区间内有 `salesman_order` 的不同客户数近似。
//! 5. **`salesmanList`**：Java 先全表查 `user` 再逐条查 `salesman`（无分页、
//!    全表扫描）；本实现改为 `salesman JOIN user` + 关键词过滤，返回全量记录
//!    放进 `PageResult`（`page=1,pageSize=len`）。
//! 6. **`customerList`**：订单数/金额/最近下单时间依赖订单聚合（Java Mapper
//!    XML 多表 JOIN），本实现返回 0 / null（见服务层）。
//! 7. `detail.statistical` 为聚合近似（订单数/销售额/客户数/邀请数/佣金）。
//!
//! # 金额：`sale_amount` / `amount` / `order_amount` 为 `Decimal`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 错误文案（Java `GlobalException`）。
pub const MSG_USER_ALREADY_ADDED: &str = "该用户已添加";
pub const MSG_UNKNOWN_SALESMAN: &str = "未知的分销员";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_USER_ID_REQUIRED: &str = "userId不能为空";
pub const MSG_SALESMAN_ID_REQUIRED: &str = "salesmanId不能为空";
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// `SalesmanPageQuery` 之外的管理端统计筛选（Java `SalesmanStatisticalDetailPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanStatisticalQuery {
    pub mobile: Option<String>,
    pub group_id: Option<i32>,
    pub level: Option<i32>,
    pub is_export: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 排行查询（Java `SalesmanRankingPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanRankingQuery {
    /// 时间维度 1 月 / 2 日 / 3 小时（Java `dateType`）
    pub date_type: Option<i32>,
    /// `start,end` 或 `start - end` 格式的展示串（Java `startEndTime`）
    pub start_end_time: Option<String>,
    pub search_start_time: Option<String>,
    pub search_end_time: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 客户列表查询（Java `CustomerListPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomerListQuery {
    pub salesman_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
}

/// 新增分销员（Java `SalesmanSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanSaveDTO {
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
}

/// 编辑分销员（Java `SalesmanEditParam`：salesmanId + 可选字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanEditDTO {
    pub salesman_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
}

/// 用户基础信息（Java `UserBaseVO` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBaseVO {
    pub user_id: i32,
    pub username: String,
    pub nickname: Option<String>,
    pub mobile: String,
    pub avatar: String,
    pub reg_time: Option<i32>,
}

/// 分销员基础 VO（Java `SalesmanVO` 子集，`detail` 内嵌）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanVO {
    pub salesman_id: i32,
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub level_text: String,
    pub group_id: Option<i32>,
    pub pid: i32,
    pub shop_id: Option<i32>,
    pub add_time: String,
    pub base_user_info: Option<UserBaseVO>,
    pub pid_user_info: Option<UserBaseVO>,
    pub group_info: Option<SalesmanGroupVO>,
}

/// 分组信息（Java `SalesmanGroup` 直出）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanGroupVO {
    pub group_id: i32,
    pub group_name: Option<String>,
    #[serde(rename = "describe")]
    pub describe: Option<String>,
    pub add_time: Option<i32>,
    pub shop_id: Option<i32>,
}

/// 分销员统计（Java `SalesmanDetailVO.Statistical` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanStatStatisticalVO {
    pub sale_amount: Decimal,
    pub order_num: i64,
    pub customer_num: i64,
    pub invite_num: i64,
    pub commission_amount: Decimal,
    pub product_commission_amount: Decimal,
}

/// 详情（Java `SalesmanDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanDetailVO {
    pub salesman_vo: SalesmanVO,
    pub statistical: SalesmanStatStatisticalVO,
}

/// 统计明细分页行（Java `SalesmanStatisticalVO` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanStatisticalVO {
    pub salesman_id: i32,
    pub level: Option<i32>,
    pub level_text: String,
    pub group_id: Option<i32>,
    pub group_name: Option<String>,
    pub pid: i32,
    pub shop_id: Option<i32>,
    pub sale_amount: Decimal,
    pub order_count: i64,
    pub pay_money: Decimal,
    pub refund_amount: Decimal,
    pub total_customer: i64,
    pub add_time: String,
    pub base_user_info: Option<UserBaseVO>,
}

/// 佣金详情（Java `CommissionDetailsVO` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionDetailsVO {
    pub item: SalesmanVO,
    pub commission: Decimal,
    pub product_transaction_amount: Decimal,
    pub auto_settlement_amount: Decimal,
    pub auto_wait_settlement_amount: Decimal,
    pub artificial_settlement_amount: Decimal,
    pub artificial_wait_settlement_amount: Decimal,
}

/// 排行行（Java `SalesmanRankingVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanRankingVO {
    pub salesman_id: i32,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub total_sale_amount: Decimal,
    pub total_customers: i64,
    pub total_pay_customers: i64,
    pub order_num: i64,
}

/// 下拉选择（Java `SalesmanSelectVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanSelectVO {
    pub salesman_id: i32,
    pub user_id: Option<i32>,
    pub user: Option<UserBaseVO>,
}

/// 客户列表行（Java `CustomerListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerListVO {
    pub user_id: i32,
    pub username: String,
    pub avatar: String,
    pub mobile: String,
    pub nickname: Option<String>,
    pub reg_time: Option<i32>,
    pub rank_name: Option<String>,
    pub customer_type: i32,
    pub order_count: i64,
    pub order_amount: Decimal,
    pub last_order_time: Option<i32>,
    pub bind_time: Option<i32>,
    pub channel: String,
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

/// 排行区间解析（Java `handleSearchTime`：`searchStartTime/searchEndTime`
/// 优先，其次 `startEndTime` 的 `,`/` - ` 分隔；解析失败 → 不限制）。
#[must_use]
pub fn resolve_search_range(q: &SalesmanRankingQuery) -> (Option<i64>, Option<i64>) {
    let start = parse_time(q.search_start_time.as_deref()).or_else(|| {
        q.start_end_time
            .as_deref()
            .and_then(|s| s.split(',').next())
            .and_then(|s| parse_time(Some(s)))
    });
    let end = parse_time(q.search_end_time.as_deref()).or_else(|| {
        q.start_end_time
            .as_deref()
            .and_then(|s| s.split(',').nth(1))
            .and_then(|s| parse_time(Some(s)))
    });
    (start, end)
}

// ——————————————————————————————————————————————
// 公共端（/api/salesman/salesman，optional auth）
// ——————————————————————————————————————————————

/// 公共端错误文案（逐字符照抄 Java）。
pub const MSG_NOT_SALESMAN: &str = "当前用户不是分销员";
pub const MSG_NO_SALESMAN_CONFIG: &str = "没有对应的商户配置";
pub const MSG_NO_CUSTOMER_PERMISSION: &str = "暂无权限查看客户信息";
pub const MSG_CUSTOMER_NOT_FOUND: &str = "客户不存在";
pub const MSG_INVITER_NOT_FOUND: &str = "邀请人不存在";
pub const MSG_SELF_INVITE: &str = "不能接受自己的名片邀请";
pub const MSG_WECHAT_BIZ_DISABLED: &str = "当前未开启微商模式";
pub const MSG_CARD_INVITE_DISABLED: &str = "当前未开启名片邀请开通";
/// `salesman_config.code`（Java `SalesmanConfigTypeEnum.SALESMAN_CONFIG`）。
pub const BIZ_SALESMAN_CONFIG: &str = "salesmanConfig";
/// 分销模式：微商模式（Java `DistributionModeEnum.WECHAT_BIZ`）。
pub const DISTRIBUTION_MODE_WECHAT_BIZ: i32 = 2;
/// 招募方式：名片邀请（Java `RecruitMethodEnum.CARD_INVITE`）。
pub const RECRUIT_METHOD_CARD_INVITE: i32 = 2;

/// 公共端客户列表查询（Java `CustomerApiPageQuery extends CustomerListPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomerApiQuery {
    pub salesman_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 客户分类：`all` / `ordered` / `salesman`
    pub customer_type: Option<String>,
    /// 开始日期 `yyyy-MM-dd`
    pub start_time: Option<String>,
    /// 结束日期 `yyyy-MM-dd`
    pub end_time: Option<String>,
    pub shop_id: Option<i32>,
}

impl CustomerApiQuery {
    /// Java `normalizedCustomerType`：仅 `ordered` / `salesman` 合法，其余 → `all`。
    #[must_use]
    pub fn normalized_customer_type(&self) -> &str {
        match self.customer_type.as_deref() {
            Some("ordered") => "ordered",
            Some("salesman") => "salesman",
            _ => "all",
        }
    }
}

/// 公共端客户详情（Java `CustomerDetailVO`，含 `CustomerListVO` 字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerDetailVO {
    pub user_id: i32,
    pub username: String,
    pub avatar: String,
    pub mobile: String,
    pub nickname: Option<String>,
    pub rank_name: Option<String>,
    pub customer_type: i32,
    pub bind_time: Option<i32>,
    pub channel: String,
    pub last_order_time: Option<i32>,
    pub order_count: i64,
    pub order_amount: Decimal,
    pub average_order_amount: Decimal,
}

/// 公共端订单统计（Java `SalesmanUserDetailVO.Order`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanOrderStatVO {
    pub today_sum: Decimal,
    pub all_sum: Decimal,
    pub wait_cps_sum: Decimal,
    pub today_count: i64,
    pub all_count: i64,
    pub today_user_count: i64,
    pub all_user_count: i64,
    pub self_buy_sum: Decimal,
}

/// 公共端分销员详情（Java `SalesmanUserDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanUserDetailVO {
    pub salesman_id: i32,
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: i32,
    pub shop_id: Option<i32>,
    pub sale_amount: Option<Decimal>,
    pub add_time: String,
    pub salesman_config: Option<serde_json::Value>,
    pub level_name: Option<String>,
    pub condition: Option<serde_json::Value>,
    pub order: SalesmanOrderStatVO,
}

/// 公共端会员基础信息（Java `UserBaseVO` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanUserInfoVO {
    pub user_id: i32,
    pub username: String,
    pub avatar: String,
    pub mobile: String,
    pub email: Option<String>,
    pub nickname: Option<String>,
    pub distribution_register_time: Option<i32>,
    pub user_type: Option<i32>,
    pub balance: Option<Decimal>,
    pub points: Option<i32>,
}

/// 客户备注更新（Java `CustomerRemarkUpdateParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomerRemarkDTO {
    pub user_id: Option<i32>,
    pub remark: Option<String>,
}

/// 配置 JSON 中的整数字段。
#[must_use]
pub fn config_int(data: &serde_json::Value, key: &str) -> Option<i32> {
    data.get(key)?.as_i64().and_then(|v| i32::try_from(v).ok())
}

/// 是否允许分销员查看客户信息（`viewCustomerInfo == 1`）。
#[must_use]
pub fn config_view_customer_info(data: &serde_json::Value) -> bool {
    config_int(data, "viewCustomerInfo") == Some(1)
}

/// 是否微商模式（`distributionMode == 2`）。
#[must_use]
pub fn config_is_wechat_biz(data: &serde_json::Value) -> bool {
    config_int(data, "distributionMode") == Some(DISTRIBUTION_MODE_WECHAT_BIZ)
}

/// 是否开启「名片邀请开通」（`recruitMethods` 含 2）。
#[must_use]
pub fn config_has_card_invite(data: &serde_json::Value) -> bool {
    data.get("recruitMethods")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|arr| {
            arr.iter()
                .filter_map(serde_json::Value::as_i64)
                .any(|v| v == i64::from(RECRUIT_METHOD_CARD_INVITE))
        })
}

/// 从配置 JSON 取某等级的 `(name, condition)`。
#[must_use]
pub fn config_level(
    data: &serde_json::Value,
    level: i32,
) -> (Option<String>, Option<serde_json::Value>) {
    let Some(levels) = data.get("level").and_then(serde_json::Value::as_array) else {
        return (None, None);
    };
    for item in levels {
        if config_int(item, "id") == Some(level) {
            return (
                item.get("name")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string),
                item.get("condition").cloned(),
            );
        }
    }
    (None, None)
}

#[cfg(test)]
mod public_tests {
    use super::*;

    #[test]
    fn customer_type_normalization_matches_java() {
        let mut q = CustomerApiQuery::default();
        assert_eq!(q.normalized_customer_type(), "all");
        q.customer_type = Some("ordered".into());
        assert_eq!(q.normalized_customer_type(), "ordered");
        q.customer_type = Some("salesman".into());
        assert_eq!(q.normalized_customer_type(), "salesman");
        q.customer_type = Some("bogus".into());
        assert_eq!(q.normalized_customer_type(), "all");
    }

    #[test]
    fn config_helpers_parse_json() {
        let cfg = serde_json::json!({
            "distributionMode": 2,
            "recruitMethods": [1, 2],
            "viewCustomerInfo": 1,
            "level": [{"id": 1, "name": "一级", "condition": {"salesAmount": {"value": "100"}}}]
        });
        assert!(config_is_wechat_biz(&cfg));
        assert!(config_has_card_invite(&cfg));
        assert!(config_view_customer_info(&cfg));
        let (name, condition) = config_level(&cfg, 1);
        assert_eq!(name.as_deref(), Some("一级"));
        assert_eq!(condition.unwrap()["salesAmount"]["value"], "100");
        let (n2, c2) = config_level(&cfg, 9);
        assert!(n2.is_none() && c2.is_none());
        // 非微商模式 / 无名片邀请 / 无查看权限
        let other = serde_json::json!({"distributionMode": 1, "recruitMethods": [1]});
        assert!(!config_is_wechat_biz(&other));
        assert!(!config_has_card_invite(&other));
        assert!(!config_view_customer_info(&other));
    }

    #[test]
    fn public_messages_are_verbatim() {
        assert_eq!(MSG_NOT_SALESMAN, "当前用户不是分销员");
        assert_eq!(MSG_NO_CUSTOMER_PERMISSION, "暂无权限查看客户信息");
        assert_eq!(MSG_CUSTOMER_NOT_FOUND, "客户不存在");
        assert_eq!(MSG_WECHAT_BIZ_DISABLED, "当前未开启微商模式");
        assert_eq!(MSG_CARD_INVITE_DISABLED, "当前未开启名片邀请开通");
        assert_eq!(MSG_SELF_INVITE, "不能接受自己的名片邀请");
    }

    #[test]
    fn detail_vo_serializes_order_stats() {
        let vo = SalesmanUserDetailVO {
            salesman_id: 3,
            order: SalesmanOrderStatVO {
                all_sum: "10.00".parse().unwrap(),
                all_count: 2,
                ..Default::default()
            },
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["salesmanId"], 3);
        assert_eq!(json["order"]["allSum"], "10.00");
        assert_eq!(json["order"]["allCount"], 2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_format_and_parse() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(parse_time(Some("2023-11-15 06:13:20")), Some(1_700_000_000));
        assert_eq!(parse_time(Some("2023-11-15")), Some(1_699_977_600));
        assert_eq!(parse_time(Some("bad")), None);
    }

    #[test]
    fn ranking_range_prefers_explicit_fields() {
        let mut q = SalesmanRankingQuery::default();
        assert_eq!(resolve_search_range(&q), (None, None));
        q.start_end_time = Some("2023-11-01,2023-11-30".into());
        let (s, e) = resolve_search_range(&q);
        assert_eq!(s, Some(1_698_768_000));
        assert_eq!(e, Some(1_701_273_600));
        q.search_start_time = Some("2023-11-15".into());
        let (s2, _) = resolve_search_range(&q);
        assert_eq!(s2, Some(1_699_977_600));
    }

    #[test]
    fn messages_are_verbatim() {
        assert_eq!(MSG_USER_ALREADY_ADDED, "该用户已添加");
        assert_eq!(MSG_UNKNOWN_SALESMAN, "未知的分销员");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = SalesmanDetailVO {
            salesman_vo: SalesmanVO {
                salesman_id: 5,
                level_text: String::new(),
                add_time: format_time(Some(1_700_000_000)),
                ..Default::default()
            },
            statistical: SalesmanStatStatisticalVO {
                sale_amount: "10.50".parse().unwrap(),
                order_num: 2,
                ..Default::default()
            },
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["salesmanVo"]["salesmanId"], 5);
        assert_eq!(json["statistical"]["saleAmount"], "10.50");
        assert_eq!(json["statistical"]["orderNum"], 2);
    }
}
