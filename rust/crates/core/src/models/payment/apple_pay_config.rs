//! 支付渠道设置引擎 + Apple Pay 设置字段（payment::apple_pay_config）。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.setting.ApplePayConfigController`
//!   （`/adminapi/setting/config/applePaySettings`、`saveApplePay`）
//! - `ApplePayConfigServiceImpl` + `ConfigService#getSettings/saveConfigSettings`
//! - `SettingsEnum`（每字段一个 biz_code，与 VO 的 camelCase 属性同名）
//!
//! # 存储与脱敏语义（与 Java 对齐）
//! - 每字段独立存 `config(biz_code, biz_val)`；读取时缺行用 `SettingsEnum` 默认值。
//! - GET 时对敏感字段做 `StringUtils.maskMiddleHalf` 中段掩码（星号保留原长度）。
//! - POST 时若敏感字段值 == 当前掩码值 → 视为未修改，跳过不写（避免星号覆盖真实密钥）；
//!   其余非 null 字段按 biz_code 逐项 upsert（Java `saveConfigSettings` 只写非 null）。
//! - `applePayCountryList` / `applePayCurrencyList` 为 SQL 预置隐藏 JSON 配置：
//!   读取时同时回填原始串与解析后的数组（Java VO 双字段），保存时忽略（只读）。
//!
//! 本文件同时提供通用引擎（[`SettingsField`]/[`SettingsSpec`]/[`load_settings`]/
//! [`pick_updates`]/[`mask_middle_half`]），供 huifu/lakala/yeepay 设置复用。

use std::collections::HashMap;

use serde_json::{Map, Value};

/// 单个设置字段：JSON 属性名 ↔ `config.biz_code` ↔ 缺省值（`SettingsEnum` default）。
#[derive(Debug, Clone, Copy)]
pub struct SettingsField {
    /// VO/请求 JSON 的 camelCase 属性名
    pub json: &'static str,
    /// `config.biz_code`（Java `SettingsEnum#getBizCode`，与属性名一致）
    pub biz: &'static str,
    /// 缺省值（`None` = 未配置时返回 null）
    pub default: Option<&'static str>,
}

/// 一个渠道的设置规格。
#[derive(Debug, Clone, Copy)]
pub struct SettingsSpec {
    pub fields: &'static [SettingsField],
    /// 需要 `maskMiddleHalf` 脱敏且“掩码未变不覆盖”的敏感字段（JSON 属性名）
    pub masked: &'static [&'static str],
    /// 只读隐藏 JSON 字段：`(biz_code, 输出 JSON 属性名)`，读取时解析为数组
    pub derived_arrays: &'static [(&'static str, &'static str)],
}

/// Java `StringUtils.maskMiddleHalf`：空白/长度<2 全部星号；否则中段一半字符替换为星号。
#[must_use]
pub fn mask_middle_half(raw: Option<&str>) -> Option<String> {
    let Some(raw) = raw else {
        return None;
    };
    let chars: Vec<char> = raw.chars().collect();
    let length = chars.len();
    if raw.trim().is_empty() || length < 2 {
        return Some("*".repeat(length));
    }
    let half = length / 2;
    let start = (length - half) / 2;
    let end = start + half;
    let mut out = String::with_capacity(raw.len());
    for (idx, ch) in chars.iter().enumerate() {
        if idx >= start && idx < end {
            out.push('*');
        } else {
            out.push(*ch);
        }
    }
    Some(out)
}

/// 由 config 行构建 GET 响应（含缺省值、隐藏 JSON 数组、掩码）。
#[must_use]
pub fn load_settings(
    spec: &SettingsSpec,
    rows: &HashMap<String, Option<String>>,
) -> Map<String, Value> {
    let mut out = Map::new();
    for field in spec.fields {
        let raw = rows
            .get(field.biz)
            .and_then(|v| v.clone())
            .filter(|v| !v.is_empty())
            .or_else(|| field.default.map(str::to_string));
        let value = match raw {
            Some(raw) => Value::String(raw),
            None => Value::Null,
        };
        out.insert(field.json.to_string(), value);
    }
    for (biz, json_key) in spec.derived_arrays {
        let raw = rows.get(*biz).and_then(|v| v.clone()).unwrap_or_default();
        out.insert(
            (*json_key).to_string(),
            serde_json::from_str::<Value>(&raw).unwrap_or_else(|_| Value::Array(Vec::new())),
        );
    }
    // 敏感字段脱敏（仅字符串）
    for key in spec.masked {
        if let Some(Value::String(raw)) = out.get(*key) {
            let masked = mask_middle_half(Some(raw)).unwrap_or_default();
            out.insert((*key).to_string(), Value::String(masked));
        }
    }
    out
}

/// POST → 待写配置项（biz_code, biz_val）。
///
/// 语义（Java `noUpdate` + `saveConfigSettings`）：
/// - 请求缺失/`null` 的字段不写（保留库内旧值）；
/// - 敏感字段若与当前掩码值相同 → 视为未修改，跳过；
/// - 数字/布尔按 Java `String.valueOf` 落库；字符串原样（不 trim，避免密钥首尾空格被吞）。
#[must_use]
pub fn pick_updates(
    spec: &SettingsSpec,
    payload: &Value,
    current_masked: &Map<String, Value>,
) -> Vec<(String, String)> {
    let Some(obj) = payload.as_object() else {
        return Vec::new();
    };
    let mut updates = Vec::new();
    for field in spec.fields {
        let Some(incoming) = obj.get(field.json) else {
            continue;
        };
        if incoming.is_null() {
            continue;
        }
        let value = match incoming {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => {
                if *b {
                    "1".to_string()
                } else {
                    "0".to_string()
                }
            }
            _ => continue,
        };
        if spec.masked.contains(&field.json) {
            if let Some(Value::String(current)) = current_masked.get(field.json) {
                if *current == value {
                    // 掩码回显值未改动 → 跳过，避免覆盖真实密钥
                    continue;
                }
            }
        }
        updates.push((field.biz.to_string(), value));
    }
    updates
}

/// 只读隐藏数组字段的 biz_code（供 repo 预取，避免写入）。
#[must_use]
pub fn derived_biz_codes(spec: &SettingsSpec) -> Vec<&'static str> {
    spec.derived_arrays.iter().map(|(biz, _)| *biz).collect()
}

// ————————————————————— Apple Pay 规格 —————————————————————

/// Apple Pay 设置字段（顺序与 Java `ApplePaySettingsVO` 一致）。
pub const APPLE_PAY_FIELDS: &[SettingsField] = &[
    SettingsField {
        json: "useApplePay",
        biz: "useApplePay",
        default: Some("0"),
    },
    SettingsField {
        json: "applePayMerchantId",
        biz: "applePayMerchantId",
        default: None,
    },
    SettingsField {
        json: "applePayDisplayName",
        biz: "applePayDisplayName",
        default: None,
    },
    SettingsField {
        json: "applePayCountryCode",
        biz: "applePayCountryCode",
        default: Some("CN"),
    },
    SettingsField {
        json: "applePayCurrency",
        biz: "applePayCurrency",
        default: Some("CNY"),
    },
    SettingsField {
        json: "applePaySupportedNetworks",
        biz: "applePaySupportedNetworks",
        default: Some("chinaUnionPay,visa,masterCard"),
    },
    SettingsField {
        json: "applePayMerchantIdentityCert",
        biz: "applePayMerchantIdentityCert",
        default: Some("0"),
    },
    SettingsField {
        json: "applePayMerchantIdentityKey",
        biz: "applePayMerchantIdentityKey",
        default: Some("0"),
    },
    SettingsField {
        json: "applePayProcessingPrivateKey",
        biz: "applePayProcessingPrivateKey",
        default: Some("0"),
    },
    SettingsField {
        json: "applePayAcquirerProvider",
        biz: "applePayAcquirerProvider",
        default: Some("generic"),
    },
    SettingsField {
        json: "applePayUmsSignType",
        biz: "applePayUmsSignType",
        default: Some("SHA256"),
    },
    SettingsField {
        json: "applePayAcquirerGateway",
        biz: "applePayAcquirerGateway",
        default: None,
    },
    SettingsField {
        json: "applePayAcquirerMerchantNo",
        biz: "applePayAcquirerMerchantNo",
        default: None,
    },
    SettingsField {
        json: "applePayAcquirerKey",
        biz: "applePayAcquirerKey",
        default: None,
    },
    SettingsField {
        json: "applePayCountryListStr",
        biz: "applePayCountryList",
        default: Some(""),
    },
    SettingsField {
        json: "applePayCurrencyListStr",
        biz: "applePayCurrencyList",
        default: Some(""),
    },
];

/// Apple Pay 设置规格。
pub const APPLE_PAY_SPEC: SettingsSpec = SettingsSpec {
    fields: APPLE_PAY_FIELDS,
    masked: &["applePayAcquirerMerchantNo", "applePayAcquirerKey"],
    derived_arrays: &[
        ("applePayCountryList", "applePayCountryList"),
        ("applePayCurrencyList", "applePayCurrencyList"),
    ],
};

#[cfg(test)]
mod tests {
    use super::*;

    fn rows(pairs: &[(&str, &str)]) -> HashMap<String, Option<String>> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), Some((*v).to_string())))
            .collect()
    }

    #[test]
    fn mask_middle_half_matches_java() {
        assert_eq!(mask_middle_half(None), None);
        assert_eq!(mask_middle_half(Some("")), Some(String::new()));
        assert_eq!(mask_middle_half(Some("a")), Some("*".to_string()));
        // 长度 4：half=2，start=1，end=3 → 中间两位掩码
        assert_eq!(mask_middle_half(Some("abcd")), Some("a**d".to_string()));
        // 长度 8：half=4，start=2，end=6
        assert_eq!(
            mask_middle_half(Some("abcdefgh")),
            Some("ab****gh".to_string())
        );
        assert_eq!(
            mask_middle_half(Some("1234567890")),
            Some("12*****890".to_string())
        );
    }

    #[test]
    fn load_settings_applies_defaults_and_arrays() {
        let rows = rows(&[
            ("useApplePay", "1"),
            ("applePayCountryList", r#"[{"code":"CN"}]"#),
        ]);
        let out = load_settings(&APPLE_PAY_SPEC, &rows);
        assert_eq!(out["useApplePay"], Value::String("1".into()));
        assert_eq!(out["applePayCountryCode"], Value::String("CN".into()));
        assert_eq!(out["applePayCurrency"], Value::String("CNY".into()));
        assert_eq!(out["applePayMerchantId"], Value::Null);
        assert!(out["applePayCountryList"].is_array());
        assert!(out["applePayCurrencyList"].is_array());
    }

    #[test]
    fn load_settings_masks_sensitive_fields() {
        let rows = rows(&[
            ("applePayAcquirerMerchantNo", "1234567890"),
            ("applePayAcquirerKey", "abcdefgh"),
        ]);
        let out = load_settings(&APPLE_PAY_SPEC, &rows);
        assert_eq!(
            out["applePayAcquirerMerchantNo"],
            Value::String("12*****890".into())
        );
        assert_eq!(out["applePayAcquirerKey"], Value::String("ab****gh".into()));
    }

    #[test]
    fn pick_updates_skips_masked_unchanged_and_ignores_null() {
        let current = load_settings(
            &APPLE_PAY_SPEC,
            &rows(&[
                ("applePayAcquirerMerchantNo", "1234567890"),
                ("applePayAcquirerKey", "abcdefgh"),
            ]),
        );
        let payload = serde_json::json!({
            "useApplePay": 1,
            "applePayAcquirerMerchantNo": "12*****890", // 掩码未改 → 跳过
            "applePayAcquirerKey": "new-secret",        // 已改 → 写
            "applePayDisplayName": null,                // null → 不写
            "applePayCountryList": [{"code": "XX"}],    // 只读派生 → 不写
        });
        let updates = pick_updates(&APPLE_PAY_SPEC, &payload, &current);
        assert!(updates.contains(&("useApplePay".to_string(), "1".to_string())));
        assert!(updates.contains(&("applePayAcquirerKey".to_string(), "new-secret".to_string())));
        assert!(!updates
            .iter()
            .any(|(biz, _)| biz == "applePayAcquirerMerchantNo"));
        assert!(!updates.iter().any(|(biz, _)| biz == "applePayDisplayName"));
        assert!(!updates.iter().any(|(biz, _)| biz == "applePayCountryList"));
    }

    #[test]
    fn derived_biz_codes_lists_hidden_fields() {
        let codes = derived_biz_codes(&APPLE_PAY_SPEC);
        assert!(codes.contains(&"applePayCountryList"));
        assert!(codes.contains(&"applePayCurrencyList"));
    }
}
