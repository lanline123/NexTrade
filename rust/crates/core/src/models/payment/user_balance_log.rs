//! 用户余额日志 域 DTO / VO（payment::user_balance_log）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。
//!
//! 对应 Java：
//! - 入参 `com.tigshop.bean.dto.finance.UserBalanceLogListDTO`
//!   （`java/tigshop-bean/src/main/java/com/tigshop/bean/dto/finance/UserBalanceLogListDTO.java`，
//!   继承 `BasePage`）
//! - 出参 `com.tigshop.bean.vo.finance.UserBalanceLogVO`
//!   （`java/tigshop-bean/src/main/java/com/tigshop/bean/vo/finance/UserBalanceLogVO.java`）

use crate::types::PageQuery;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Java `BasePage` 默认页大小（`getSize()` 缺省 15）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage` 页大小上限（`size > 100` 时截成 100）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `GET /adminapi/finance/userBalanceLog/list` 查询参数。
///
/// 逐字段对应 Java `UserBalanceLogListDTO` + 父类 `BasePage`
/// （`page` / `size` / `sortField` / `sortOrder` / `keyword`）。
///
/// > **`sortItems` 未支持**：Java `BasePage` 还有 `List<SortItem> sortItems`
/// > （多字段排序，GET 查询串里形如 `sortItems[0].field=...`）。
/// > 本仓库既有切片（order_admin 除外）一律未复刻该形态，本域同样只支持
/// > 单字段 `sortField` + `sortOrder`；差异已记入交付说明。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserBalanceLogListQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`，属性名或列名，非法值回退主键）
    pub sort_field: Option<String>,
    /// 排序方向（`asc` / `desc`；其它值 Java 不设 ORDER BY）
    pub sort_order: Option<String>,
    /// 关键字（Java `BasePage.keyword` → `change_desc LIKE`）
    pub keyword: Option<String>,
    /// 用户ID（Java `userId`，`> 0` 才生效）
    pub user_id: Option<i32>,
    /// 金额（Java `balance`，类型是 `Integer`；只用作「`balance > 0`」开关，
    /// 值本身不进 SQL）
    pub balance: Option<i64>,
    /// 会员用户名（Java `username` → `user.username LIKE`）
    pub username: Option<String>,
    /// 是否排除分销佣金结算明细，1-排除（Java `excludeDistribution`，D1107）
    pub exclude_distribution: Option<i32>,
    /// 钱包类型筛选：0-余额账户，1-佣金账户（Java `walletType`，D1107）
    pub wallet_type: Option<i32>,
}

impl UserBalanceLogListQuery {
    /// 归一化分页（对应 Java `BasePage#getPage()` / `#getSize()`：
    /// `page` 缺省 1；`size` 缺省 15、`> 100` 截成 100）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// SQL `LIMIT` / `OFFSET`。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let (page, size) = self.page_params();
        (size, (page - 1) * size)
    }

    /// 转成项目通用分页参数（供 [`PageResult`] 口径使用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }

    /// Java `excludeDistribution != null && excludeDistribution == 1`。
    #[must_use]
    pub fn exclude_distribution_on(&self) -> bool {
        self.exclude_distribution == Some(1)
    }

    /// Java `.gt(balance != null && balance > 0, UserBalanceLog::getBalance, 0)`
    /// —— 注意条件值恒为字面量 `0`，`balance` 参数本身只是开关。
    #[must_use]
    pub fn balance_positive_filter(&self) -> bool {
        self.balance.map(|v| v > 0).unwrap_or(false)
    }
}

/// 余额日志列表项（对应 Java `UserBalanceLogVO`）。
///
/// 字段口径严格跟随 Java `UserServiceImpl` 的赋值链
/// （`BeanUtils.copyProperties(userBalanceLog, vo)` +
/// `setChangeTime(handelTime(...))` + `setChangeTypeName(...)`）：
/// - `changeTime` 是**格式化字符串** `yyyy-MM-dd HH:mm:ss`
///   （Java VO 上该字段声明为 `String`，实体里是 `Long` 秒级时间戳，
///   `BeanUtils` 因类型不符跳过，随后由 `TigUtils.handelTime` 覆盖；
///   `handelTime` 对 `0` / `null` 返回**空串**）；
/// - `afterBalance` / `afterFrozenBalance` 由实体直接拷入（本查询是
///   `selectAll(UserBalanceLog.class)`，两列都有值，故非 `null`）；
/// - `username` 来自 `LEFT JOIN user`，用户被删时为 `null`。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBalanceLogVO {
    /// 余额ID
    pub log_id: i32,
    /// 用户ID
    pub user_id: i32,
    /// 用户名称（LEFT JOIN `user.username`，可空）
    pub username: Option<String>,
    /// 增加或减少的余额
    pub balance: Decimal,
    /// 增加或减少之前的余额
    pub before_balance: Decimal,
    /// 增加或减少之后的余额
    pub after_balance: Decimal,
    /// 被冻结的余额
    pub frozen_balance: Decimal,
    /// 增加或减少之前的被冻结的余额
    pub before_frozen_balance: Decimal,
    /// 增加或减少之后的被冻结的余额
    pub after_frozen_balance: Decimal,
    /// 该笔操作发生的时间（`yyyy-MM-dd HH:mm:ss`；`0` → 空串）
    pub change_time: String,
    /// 该笔操作的备注
    pub change_desc: String,
    /// 类型，1：增加，2：减少
    pub change_type: i32,
    /// 类型文案（见 [`resolve_change_type_name`]）
    pub change_type_name: String,
}

/// Java `UserBalanceLogVO` 里**没有**的列（`walletType` / `newBalance` /
/// `newFrozenBalance`）：`BeanUtils.copyProperties` 只拷同名属性，
/// 因此这些列既不参与 SELECT，也不出现在响应里。

/// 变动类型文案（对应 Java `UserBalanceLogServiceImpl#resolveChangeTypeName`
/// 的**兜底分支**）。
///
/// Java 先查 i18n（`messageHelper.get("balance.log.change.type.*")`），
/// 命中不到 key 时才回落到中文：
/// `1 → 增加`、`2 → 减少`、`3 / 99 → 其他`、其它（含 null）→ `未知`。
/// 本仓库 i18n 消息源未迁移（与 user_manage 同口径），故直接实现中文兜底；
/// 中文兜底取自 `UserBalanceLogType` 枚举描述
/// （`CHANGE_TYPE_INCREASE("增加")` / `CHANGE_TYPE_DECREASE("减少")` /
/// `CHANGE_TYPE_FROZEN("其他")`）。
///
/// ⚠️ 注意与 member::user_manage 的 `change_type_name` **不同**：那一版把 `3` 归为
/// 「未知」，Java 本服务把 `3` 与 `99` 一起归为「其他」。
#[must_use]
pub fn resolve_change_type_name(change_type: Option<i32>) -> String {
    match change_type {
        Some(1) => "增加".to_string(),
        Some(2) => "减少".to_string(),
        Some(3) | Some(99) => "其他".to_string(),
        _ => "未知".to_string(),
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`：
/// `null` 或 `0` 返回空串）。
#[must_use]
pub fn format_change_time(secs: i32) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// Java `notLike(changeDesc, "结算佣金")` 的 LIKE 模式串。
pub const DISTRIBUTION_SETTLE_KEYWORD: &str = "结算佣金";

#[cfg(test)]
mod tests {
    use super::*;

    fn q(json: serde_json::Value) -> UserBalanceLogListQuery {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn camel_case_param_names() {
        let query = q(serde_json::json!({
            "page": 2, "size": 20, "sortField": "changeTime", "sortOrder": "asc",
            "keyword": "充值", "userId": 8, "balance": 1, "username": "bob",
            "excludeDistribution": 1, "walletType": 0
        }));
        assert_eq!(query.page, Some(2));
        assert_eq!(query.sort_field.as_deref(), Some("changeTime"));
        assert_eq!(query.user_id, Some(8));
        assert_eq!(query.exclude_distribution, Some(1));
        // walletType=0 也要生效（Java `.eq(walletType != null, ...)`）
        assert_eq!(query.wallet_type, Some(0));
    }

    #[test]
    fn page_defaults_and_cap_match_java_base_page() {
        assert_eq!(
            q(serde_json::json!({})).page_params(),
            (1, DEFAULT_PAGE_SIZE)
        );
        assert_eq!(q(serde_json::json!({"size": 101})).page_params(), (1, 100));
        assert_eq!(q(serde_json::json!({"size": 100})).page_params(), (1, 100));
        assert_eq!(q(serde_json::json!({"page": 0})).page_params(), (1, 15));
        // 第 3 页、每页 15 → OFFSET 30
        assert_eq!(q(serde_json::json!({"page": 3})).limit_offset(), (15, 30));
    }

    #[test]
    fn balance_is_only_a_switch() {
        // Java: gt(balance != null && balance > 0, getBalance, 0)
        assert!(q(serde_json::json!({"balance": 5})).balance_positive_filter());
        assert!(!q(serde_json::json!({"balance": 0})).balance_positive_filter());
        assert!(!q(serde_json::json!({"balance": -3})).balance_positive_filter());
        assert!(!q(serde_json::json!({})).balance_positive_filter());
    }

    #[test]
    fn exclude_distribution_only_when_one() {
        assert!(q(serde_json::json!({"excludeDistribution": 1})).exclude_distribution_on());
        assert!(!q(serde_json::json!({"excludeDistribution": 0})).exclude_distribution_on());
        assert!(!q(serde_json::json!({"excludeDistribution": 2})).exclude_distribution_on());
        assert!(!q(serde_json::json!({})).exclude_distribution_on());
    }

    #[test]
    fn change_type_names_follow_java_fallback() {
        assert_eq!(resolve_change_type_name(Some(1)), "增加");
        assert_eq!(resolve_change_type_name(Some(2)), "减少");
        // 3 与 99 同为「其他」（Java case 3, 99 -> CHANGE_TYPE_FROZEN.getDescription()）
        assert_eq!(resolve_change_type_name(Some(3)), "其他");
        assert_eq!(resolve_change_type_name(Some(99)), "其他");
        assert_eq!(resolve_change_type_name(Some(7)), "未知");
        assert_eq!(resolve_change_type_name(None), "未知");
    }

    #[test]
    fn change_time_formats_seconds_and_zero_is_empty() {
        // 2024-12-03 17:05:00 UTC+8 之类依赖本地时区，这里只锁定格式与 0 的语义
        assert_eq!(format_change_time(0), "");
        assert_eq!(format_change_time(-5), "");
        let s = format_change_time(1_733_000_000);
        assert_eq!(s.len(), 19, "{s}");
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[13..14], ":");
    }

    #[test]
    fn vo_serializes_camel_case_with_string_time() {
        let vo = UserBalanceLogVO {
            log_id: 1,
            user_id: 2,
            username: Some("bob".into()),
            balance: Decimal::new(150, 2),
            before_balance: Decimal::ZERO,
            after_balance: Decimal::new(150, 2),
            frozen_balance: Decimal::ZERO,
            before_frozen_balance: Decimal::ZERO,
            after_frozen_balance: Decimal::ZERO,
            change_time: "2024-12-01 10:00:00".into(),
            change_desc: "充值".into(),
            change_type: 1,
            change_type_name: "增加".into(),
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["logId"], 1);
        // 金额走 `rust_decimal` 的 `serde-with-str`：一律序列化为字符串。
        assert_eq!(v["balance"], "1.50");
        assert_eq!(v["beforeBalance"], "0");
        assert_eq!(v["afterBalance"], "1.50");
        assert_eq!(v["changeTime"], "2024-12-01 10:00:00");
        assert_eq!(v["changeTypeName"], "增加");
        // Java VO 没有 walletType / newBalance
        assert!(v.get("walletType").is_none());
        assert!(v.get("newBalance").is_none());
    }
}
