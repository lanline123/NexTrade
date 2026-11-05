//! 店铺保证金设置（merchant::deposit_setting）模型层 —— wave9。
//!
//! 对应 Java `DepositSettingController`（`@RequestMapping("/adminapi/deposit/setting")`），
//! 2 个端点。设置存 `config` 表（`biz_code` / `biz_val`，与 system/config 口径一致），
//! 键名沿用 Java `SettingsEnum` 的 camelCase code（`depositEnable` …）。

use serde::{Deserialize, Serialize};

/// 配置键：保证金开关。
pub const CODE_DEPOSIT_ENABLE: &str = "depositEnable";
/// 配置键：收取规则。
pub const CODE_COLLECT_RULE: &str = "depositCollectRule";
/// 配置键：收取节点。
pub const CODE_COLLECT_NODE: &str = "depositCollectNode";
/// 配置键：收取缓冲天数。
pub const CODE_COLLECT_BUFFER_DAYS: &str = "depositCollectBufferDays";
/// 配置键：收取缓冲动作。
pub const CODE_COLLECT_BUFFER_ACTION: &str = "depositCollectBufferAction";
/// 配置键：补缴缓冲天数。
pub const CODE_SUPPLEMENT_BUFFER_DAYS: &str = "depositSupplementBufferDays";
/// 配置键：补缴缓冲动作。
pub const CODE_SUPPLEMENT_BUFFER_ACTION: &str = "depositSupplementBufferAction";
/// 配置键：协议开关。
pub const CODE_PROTOCOL_ENABLE: &str = "depositProtocolEnable";
/// 配置键：协议内容。
pub const CODE_PROTOCOL_CONTENT: &str = "depositProtocolContent";

/// 全部配置键。
pub const CODES: [&str; 9] = [
    CODE_DEPOSIT_ENABLE,
    CODE_COLLECT_RULE,
    CODE_COLLECT_NODE,
    CODE_COLLECT_BUFFER_DAYS,
    CODE_COLLECT_BUFFER_ACTION,
    CODE_SUPPLEMENT_BUFFER_DAYS,
    CODE_SUPPLEMENT_BUFFER_ACTION,
    CODE_PROTOCOL_ENABLE,
    CODE_PROTOCOL_CONTENT,
];

/// 保证金设置（Java `DepositSettingDTO` / `DepositSettingVO` 同构）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositSetting {
    /// 保证金开关
    pub deposit_enable: Option<i32>,
    /// 收取规则
    pub deposit_collect_rule: Option<i32>,
    /// 收取节点
    pub deposit_collect_node: Option<i32>,
    /// 收取缓冲天数
    pub deposit_collect_buffer_days: Option<i32>,
    /// 收取缓冲动作
    pub deposit_collect_buffer_action: Option<i32>,
    /// 补缴缓冲天数
    pub deposit_supplement_buffer_days: Option<i32>,
    /// 补缴缓冲动作
    pub deposit_supplement_buffer_action: Option<i32>,
    /// 协议开关
    pub deposit_protocol_enable: Option<i32>,
    /// 协议内容
    pub deposit_protocol_content: Option<String>,
}

impl DepositSetting {
    /// 由配置行组装（缺失项 default：整数 0、文本空）。
    #[must_use]
    pub fn from_rows(rows: &[(String, String)]) -> Self {
        let get = |code: &str| {
            rows.iter()
                .find(|(c, _)| c == code)
                .map(|(_, v)| v.as_str())
        };
        let int = |code: &str| get(code).and_then(|v| v.parse::<i32>().ok());
        Self {
            deposit_enable: int(CODE_DEPOSIT_ENABLE),
            deposit_collect_rule: int(CODE_COLLECT_RULE),
            deposit_collect_node: int(CODE_COLLECT_NODE),
            deposit_collect_buffer_days: int(CODE_COLLECT_BUFFER_DAYS),
            deposit_collect_buffer_action: int(CODE_COLLECT_BUFFER_ACTION),
            deposit_supplement_buffer_days: int(CODE_SUPPLEMENT_BUFFER_DAYS),
            deposit_supplement_buffer_action: int(CODE_SUPPLEMENT_BUFFER_ACTION),
            deposit_protocol_enable: int(CODE_PROTOCOL_ENABLE),
            deposit_protocol_content: get(CODE_PROTOCOL_CONTENT).map(str::to_string),
        }
    }

    /// 转配置键值对（仅保存非空字段）。
    #[must_use]
    pub fn to_pairs(&self) -> Vec<(String, String)> {
        let mut out = Vec::new();
        let mut push_i = |code: &str, v: Option<i32>| {
            if let Some(v) = v {
                out.push((code.to_string(), v.to_string()));
            }
        };
        push_i(CODE_DEPOSIT_ENABLE, self.deposit_enable);
        push_i(CODE_COLLECT_RULE, self.deposit_collect_rule);
        push_i(CODE_COLLECT_NODE, self.deposit_collect_node);
        push_i(CODE_COLLECT_BUFFER_DAYS, self.deposit_collect_buffer_days);
        push_i(
            CODE_COLLECT_BUFFER_ACTION,
            self.deposit_collect_buffer_action,
        );
        push_i(
            CODE_SUPPLEMENT_BUFFER_DAYS,
            self.deposit_supplement_buffer_days,
        );
        push_i(
            CODE_SUPPLEMENT_BUFFER_ACTION,
            self.deposit_supplement_buffer_action,
        );
        push_i(CODE_PROTOCOL_ENABLE, self.deposit_protocol_enable);
        if let Some(v) = &self.deposit_protocol_content {
            out.push((CODE_PROTOCOL_CONTENT.to_string(), v.clone()));
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rows_round_trip() {
        let rows = vec![
            (CODE_DEPOSIT_ENABLE.to_string(), "1".to_string()),
            (CODE_COLLECT_RULE.to_string(), "2".to_string()),
            (CODE_PROTOCOL_CONTENT.to_string(), "协议".to_string()),
        ];
        let s = DepositSetting::from_rows(&rows);
        assert_eq!(s.deposit_enable, Some(1));
        assert_eq!(s.deposit_collect_rule, Some(2));
        assert_eq!(s.deposit_protocol_content.as_deref(), Some("协议"));
        assert_eq!(s.deposit_collect_node, None);
    }

    #[test]
    fn to_pairs_skips_none() {
        let s = DepositSetting {
            deposit_enable: Some(1),
            ..Default::default()
        };
        let pairs = s.to_pairs();
        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].0, CODE_DEPOSIT_ENABLE);
        assert_eq!(pairs[0].1, "1");
    }

    #[test]
    fn empty_rows_yield_empty_setting() {
        let s = DepositSetting::from_rows(&[]);
        assert!(s.deposit_enable.is_none());
        assert!(s.to_pairs().is_empty());
    }
}
