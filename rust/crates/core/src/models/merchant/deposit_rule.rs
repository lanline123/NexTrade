//! 店铺保证金规则（`merchant::deposit_rule`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.deposit.DepositRuleController`
//!   （`@RequestMapping("/adminapi/deposit/rule")`，6 个端点）
//! - `com.tigshop.service.deposit.impl.DepositRuleServiceImpl`
//! - DTO：`DepositRuleListDTO` / `DepositRuleDTO` / `DepositRuleStatusDTO`
//! - VO：`DepositRuleVO`
//! - 表：`shop_deposit_rule` / `shop_deposit_rule_category`
//!
//! 金额 `rust_decimal::Decimal`；生效时间区间为秒级时间戳（`end_time = 0` 表示长期有效）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 规则名称不能为空。
pub const RULE_NAME_REQUIRED: &str = "规则名称不能为空";
/// 适用主体类型不能为空。
pub const MERCHANT_TYPES_REQUIRED: &str = "适用主体类型不能为空";
/// 适用店铺类型不能为空。
pub const SHOP_TYPES_REQUIRED: &str = "适用店铺类型不能为空";
/// 适用类目不能为空。
pub const CATEGORY_IDS_REQUIRED: &str = "适用类目不能为空";
/// 保证金金额非法。
pub const DEPOSIT_AMOUNT_INVALID: &str = "保证金金额非法";
/// 生效开始时间不能为空。
pub const START_TIME_REQUIRED: &str = "生效开始时间不能为空";
/// 生效开始时间不能晚于结束时间。
pub const START_AFTER_END: &str = "生效开始时间不能晚于结束时间";
/// 规则ID不能为空。
pub const RULE_ID_REQUIRED: &str = "规则ID不能为空";
/// 规则不存在。
pub const RULE_NOT_EXISTS: &str = "规则不存在";
/// 同维度生效时间重叠。
pub const RULE_TIME_OVERLAP: &str = "保证金规则同维度生效时间重叠";

/// 商户主体类型文案（Java `MerchantType`：1 个人认证 2 企业认证）。
#[must_use]
pub fn merchant_type_text(code: i32) -> &'static str {
    match code {
        1 => "个人认证",
        2 => "企业认证",
        _ => "",
    }
}

/// 店铺类型文案（Java `DepositRuleShopType`：1 店铺 2 供应商）。
#[must_use]
pub fn shop_type_text(code: i32) -> &'static str {
    match code {
        1 => "店铺",
        2 => "供应商",
        _ => "",
    }
}

/// `Set<Integer>` → 逗号串（Java `joinCodes`，保持插入顺序）。
#[must_use]
pub fn join_codes(codes: &[i32]) -> String {
    codes
        .iter()
        .map(i32::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

/// 逗号串 → `Vec<i32>`（Java `parseCodes`：空白/非法项忽略）。
#[must_use]
pub fn parse_codes(raw: &str) -> Vec<i32> {
    raw.split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .collect()
}

/// 两个 code 集合是否有交集（Java `intersects`：任一为空 → false）。
#[must_use]
pub fn intersects(a: &[i32], b: &[i32]) -> bool {
    if a.is_empty() || b.is_empty() {
        return false;
    }
    a.iter().any(|v| b.contains(v))
}

/// 时间区间重叠判定（Java `checkTimeOverlap` 口径）：
/// `existing.start <= new_end` 且 `existing.end >= new_start`；
/// `end = 0` 表示长期有效（+∞）。
#[must_use]
pub fn time_overlap(new_start: i64, new_end: i64, existing_start: i64, existing_end: i64) -> bool {
    // 新规则长期有效（new_end = 0）时不限制候选起点
    let start_ok = new_end == 0 || existing_start <= new_end;
    // 候选长期有效（existing_end = 0）或候选结束 >= 新起点
    let end_ok = existing_end == 0 || existing_end >= new_start;
    start_ok && end_ok
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`；0/负值返回空串。
#[must_use]
pub fn format_ts(ts: i64) -> String {
    if ts <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(ts, 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// 规则列表查询（Java `DepositRuleListDTO`，含 BasePage 分页）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRuleListQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub rule_name: Option<String>,
    pub status: Option<i32>,
    /// 生效窗口起（与规则生效区间求交集用）
    pub start_time: Option<i64>,
    /// 生效窗口止
    pub end_time: Option<i64>,
}

impl DepositRuleListQuery {
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 200),
        }
    }
}

/// 创建/更新规则入参（Java `DepositRuleDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRuleDTO {
    pub shop_deposit_rule_id: Option<i32>,
    pub rule_name: Option<String>,
    pub merchant_types: Option<Vec<i32>>,
    pub shop_types: Option<Vec<i32>>,
    pub deposit_amount: Option<Decimal>,
    pub start_time: Option<i64>,
    /// `0`/`null` 表示长期有效
    pub end_time: Option<i64>,
    pub status: Option<i32>,
    pub category_ids: Option<Vec<i32>>,
}

impl DepositRuleDTO {
    /// Java `validateBase`：逐条校验并返回逐字错误文案。
    pub fn validate(&self) -> Result<(), String> {
        if self
            .rule_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_none()
        {
            return Err(RULE_NAME_REQUIRED.to_string());
        }
        if self
            .merchant_types
            .as_deref()
            .unwrap_or_default()
            .is_empty()
        {
            return Err(MERCHANT_TYPES_REQUIRED.to_string());
        }
        if self.shop_types.as_deref().unwrap_or_default().is_empty() {
            return Err(SHOP_TYPES_REQUIRED.to_string());
        }
        if self.category_ids.as_deref().unwrap_or_default().is_empty() {
            return Err(CATEGORY_IDS_REQUIRED.to_string());
        }
        let Some(amount) = self.deposit_amount else {
            return Err(DEPOSIT_AMOUNT_INVALID.to_string());
        };
        if amount < Decimal::ZERO {
            return Err(DEPOSIT_AMOUNT_INVALID.to_string());
        }
        let Some(start) = self.start_time else {
            return Err(START_TIME_REQUIRED.to_string());
        };
        // endTime=0 或 null = 长期有效，不校验 start<=end
        if let Some(end) = self.end_time.filter(|v| *v != 0) {
            if start > end {
                return Err(START_AFTER_END.to_string());
            }
        }
        Ok(())
    }
}

/// 启用/停用规则入参（Java `DepositRuleStatusDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRuleStatusDTO {
    pub shop_deposit_rule_id: Option<i32>,
    pub status: Option<i32>,
}

/// 规则 VO（Java `DepositRuleVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DepositRuleVO {
    pub shop_deposit_rule_id: i32,
    pub rule_name: String,
    pub merchant_types: Vec<i32>,
    pub merchant_type_text: String,
    pub shop_types: Vec<i32>,
    pub shop_type_text: String,
    pub deposit_amount: Decimal,
    pub start_time: i64,
    pub end_time: i64,
    pub start_time_text: String,
    pub end_time_text: String,
    pub status: i32,
    pub status_text: String,
    pub category_ids: Vec<i32>,
    pub category_names: Vec<String>,
    pub add_time: String,
}

impl DepositRuleVO {
    /// 由规则实体 + 类目映射构建 VO（Java `toVO`）。
    #[must_use]
    pub fn from_rule(
        rule: &crate::entities::ShopDepositRule,
        category_ids: Vec<i32>,
        category_name_map: &std::collections::HashMap<i32, String>,
    ) -> Self {
        let merchant_types = parse_codes(&rule.merchant_types);
        let shop_types = parse_codes(&rule.shop_types);
        Self {
            shop_deposit_rule_id: rule.shop_deposit_rule_id,
            rule_name: rule.rule_name.clone(),
            merchant_type_text: merchant_types
                .iter()
                .map(|c| merchant_type_text(*c))
                .collect::<Vec<_>>()
                .join("、"),
            merchant_types,
            shop_type_text: shop_types
                .iter()
                .map(|c| shop_type_text(*c))
                .collect::<Vec<_>>()
                .join("、"),
            shop_types,
            deposit_amount: rule.deposit_amount,
            start_time: i64::from(rule.start_time),
            end_time: i64::from(rule.end_time),
            start_time_text: format_ts(i64::from(rule.start_time)),
            end_time_text: if rule.end_time == 0 {
                "长期有效".to_string()
            } else {
                format_ts(i64::from(rule.end_time))
            },
            status: rule.status,
            status_text: if rule.status == 1 { "启用" } else { "停用" }.to_string(),
            category_names: category_ids
                .iter()
                .filter_map(|id| category_name_map.get(id).cloned())
                .filter(|name| !name.is_empty())
                .collect(),
            category_ids,
            add_time: format_ts(i64::from(rule.add_time)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_maps_and_code_helpers_match_java() {
        assert_eq!(merchant_type_text(1), "个人认证");
        assert_eq!(merchant_type_text(2), "企业认证");
        assert_eq!(merchant_type_text(9), "");
        assert_eq!(shop_type_text(1), "店铺");
        assert_eq!(shop_type_text(2), "供应商");
        assert_eq!(join_codes(&[1, 2, 3]), "1,2,3");
        assert_eq!(parse_codes("1, 2 ,x,3"), vec![1, 2, 3]);
        assert_eq!(parse_codes(""), Vec::<i32>::new());
        assert!(intersects(&[1, 2], &[2, 3]));
        assert!(!intersects(&[1], &[2]));
        assert!(!intersects(&[], &[1]));
    }

    #[test]
    fn time_overlap_semantics_match_java() {
        // 常规重叠
        assert!(time_overlap(10, 20, 15, 25));
        assert!(time_overlap(10, 20, 5, 12));
        // 不重叠
        assert!(!time_overlap(10, 20, 21, 30));
        assert!(!time_overlap(10, 20, 1, 9));
        // 新规则长期有效（new_end=0）→ 与任意未来候选重叠
        assert!(time_overlap(10, 0, 100, 200));
        // 候选长期有效（existing_end=0）→ 与新起点后的区间重叠
        assert!(time_overlap(10, 20, 5, 0));
        assert!(time_overlap(10, 20, 10, 0));
    }

    #[test]
    fn dto_validation_is_verbatim() {
        let mut dto = DepositRuleDTO::default();
        assert_eq!(dto.validate().unwrap_err(), RULE_NAME_REQUIRED);

        dto.rule_name = Some("  ".into());
        assert_eq!(dto.validate().unwrap_err(), RULE_NAME_REQUIRED);

        dto.rule_name = Some("规则A".into());
        assert_eq!(dto.validate().unwrap_err(), MERCHANT_TYPES_REQUIRED);

        dto.merchant_types = Some(vec![1]);
        assert_eq!(dto.validate().unwrap_err(), SHOP_TYPES_REQUIRED);

        dto.shop_types = Some(vec![1]);
        assert_eq!(dto.validate().unwrap_err(), CATEGORY_IDS_REQUIRED);

        dto.category_ids = Some(vec![100]);
        assert_eq!(dto.validate().unwrap_err(), DEPOSIT_AMOUNT_INVALID);

        dto.deposit_amount = Some(Decimal::from(-1));
        assert_eq!(dto.validate().unwrap_err(), DEPOSIT_AMOUNT_INVALID);

        dto.deposit_amount = Some(Decimal::new(1000, 2));
        assert_eq!(dto.validate().unwrap_err(), START_TIME_REQUIRED);

        dto.start_time = Some(100);
        dto.end_time = Some(99);
        assert_eq!(dto.validate().unwrap_err(), START_AFTER_END);

        // end_time=0 表示长期有效，不报 start>end
        dto.end_time = Some(0);
        assert!(dto.validate().is_ok());
    }

    #[test]
    fn vo_builds_texts_and_category_names() {
        let rule = crate::entities::ShopDepositRule {
            shop_deposit_rule_id: 5,
            rule_name: "规则A".into(),
            merchant_types: "1,2".into(),
            shop_types: "1".into(),
            deposit_amount: Decimal::new(5000, 2),
            start_time: 1_700_000_000,
            end_time: 0,
            status: 1,
            is_delete: 0,
            add_time: 1_700_000_000,
            update_time: 1_700_000_000,
        };
        let mut names = std::collections::HashMap::new();
        names.insert(10, "服饰".to_string());
        let vo = DepositRuleVO::from_rule(&rule, vec![10, 11], &names);
        assert_eq!(vo.merchant_type_text, "个人认证、企业认证");
        assert_eq!(vo.shop_type_text, "店铺");
        assert_eq!(vo.end_time_text, "长期有效");
        assert_eq!(vo.status_text, "启用");
        assert_eq!(vo.category_names, vec!["服饰".to_string()]);
        assert!(!vo.add_time.is_empty());
    }
}
