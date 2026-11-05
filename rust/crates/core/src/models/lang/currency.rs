//! 货币管理表（`currency`）管理端模型（lang::currency）。
//!
//! Java 来源（overseas）：`CurrencyController.list/detail/create/update/
//! updateField/del/batch`（`CurrencyListDTO` / `CurrencyDTO` /
//! `bean.vo.setting.CurrencyVO`）。
//!
//! `config` / `exchangeRateConfig` / `saveExchangeRateConfig` /
//! `syncExchangeRateNow` / `translation` 为 b2b2b-pro 5.8.57 前端新增，
//! 无 Java 控制器对应（见路由层注释）。

use serde::{Deserialize, Serialize};

/// `GET /adminapi/lang/currency/list` 查询参数（Java `CurrencyListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CurrencyListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    /// 币种名称模糊匹配
    pub name: Option<String>,
}

impl CurrencyListQuery {
    /// 分页参数（Java `BasePage` 口径）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        (
            self.page.unwrap_or(1).max(1),
            self.size.unwrap_or(15).clamp(1, 100),
        )
    }
}

/// `create` / `update` 请求体（Java `CurrencyDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CurrencyDTO {
    pub id: Option<i32>,
    /// 币种名称
    pub name: Option<String>,
    /// 币种符号
    pub symbol: Option<String>,
    pub is_default: Option<i32>,
    /// 汇率（字符串数值）
    pub rate: Option<String>,
    /// ISO 4217 代号（b2b2b 表增量列）
    pub code: Option<String>,
}

/// 货币 VO（Java `CurrencyVO`）。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyVO {
    pub id: Option<i32>,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub is_default: Option<i32>,
    pub rate: Option<String>,
    pub code: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn currency_vo_serializes_camel_case() {
        let vo = CurrencyVO {
            id: Some(1),
            name: Some("美元".into()),
            symbol: Some("$".into()),
            is_default: Some(1),
            rate: Some("7.2".into()),
            code: Some("USD".into()),
        };
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains(r#""isDefault":1"#));
        assert!(json.contains(r#""code":"USD""#));
    }

    #[test]
    fn list_query_defaults() {
        let q = CurrencyListQuery::default();
        assert_eq!(q.page_params(), (1, 15));
    }
}
