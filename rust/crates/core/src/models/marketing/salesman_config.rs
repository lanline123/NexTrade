//! 分销模式设置（marketing::salesman_config）DTO / 纯逻辑。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanConfigController`
//! （`@RequestMapping("/adminapi/salesman/config")`，2 个端点）+
//! `SalesmanConfigServiceImpl` + `SalesmanConfigVO` / `SalesmanConfigSaveParam` +
//! `DistributionModeEnum` / `RecruitMethodEnum` / `SalesmanConfigTypeEnum`。
//!
//! 表：`salesman_config`（`id` / `shop_id` / `code` / `data`，`data` 为配置 JSON）。
//! Java 侧不做强类型列存储，整份配置序列化进 `data`；本实现保持该形态：
//! `detail` 返回解析后的 JSON 对象（含默认值），`save` 校验后写回 `data`。
//!
//! # 端点（2）
//! `GET /adminapi/salesman/config/detail?code=`、`POST /adminapi/salesman/config/save?code=`
//!
//! # 默认值（Java `SalesmanConfigServiceImpl#detail` 对 `salesmanConfig` 的兜底）
//! - `distributionMode` 缺省 → `1`（推广员等级模式，老数据无该字段）
//! - `viewCustomerInfo` 缺省 → `0`
//! - `wechatBizEnabled` → `true`
//! - `registerToSalesman` 缺省 → `0`（控制器层注入）

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// 配置 code（Java `SalesmanConfigTypeEnum`）。
pub const CODE_SALESMAN_CONFIG: &str = "salesmanConfig";
pub const CODE_SALESMAN_SETTLEMENT: &str = "salesmanSettlement";
/// 分销模式：推广员等级模式 / 微商模式（Java `DistributionModeEnum`）。
pub const DISTRIBUTION_MODE_PROMOTER: i32 = 1;
pub const DISTRIBUTION_MODE_WECHAT_BIZ: i32 = 2;
/// 错误文案（Java `GlobalException` 逐字）。
pub const MSG_WECHAT_BIZ_REQUIRES_METHOD: &str = "微商模式下请至少选择一种下级招募方式";
pub const MSG_INVALID_RECRUIT_METHOD: &str = "下级招募方式参数有误";
pub const MSG_CODE_REQUIRED: &str = "code不能为空";

/// 保存入参（Java `SalesmanConfigSaveParam`，配置项较多，按 JSON 对象原样接收）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanConfigSaveDTO {
    pub distribution_mode: Option<i32>,
    pub recruit_methods: Option<Vec<i32>>,
    pub view_customer_info: Option<i32>,
    pub sale_type: Option<i32>,
    pub level: Option<Value>,
    pub register_to_salesman: Option<i32>,
    /// 其余配置项（结算方式、权限等）原样保留。
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl SalesmanConfigSaveDTO {
    /// 序列化为配置 JSON（camelCase 键；`extra` 合并）。
    #[must_use]
    pub fn to_config_value(&self) -> Value {
        let mut map = self.extra.clone();
        if let Some(v) = self.distribution_mode {
            map.insert("distributionMode".into(), Value::from(v));
        }
        if let Some(v) = &self.recruit_methods {
            map.insert(
                "recruitMethods".into(),
                Value::Array(v.iter().map(|x| Value::from(*x)).collect()),
            );
        }
        if let Some(v) = self.view_customer_info {
            map.insert("viewCustomerInfo".into(), Value::from(v));
        }
        if let Some(v) = self.sale_type {
            map.insert("saleType".into(), Value::from(v));
        }
        if let Some(v) = &self.level {
            map.insert("level".into(), v.clone());
        }
        if let Some(v) = self.register_to_salesman {
            map.insert("registerToSalesman".into(), Value::from(v));
        }
        Value::Object(map)
    }
}

/// 校验并规范化分销配置（Java `validateDistributionMode`）：
/// - 非微商模式：`distributionMode` 归 1，清空 `recruitMethods`；
/// - 微商模式：`recruitMethods` 至少一项，且每项合法（1/2）。
///
/// # Errors
/// 文案逐字返回 Java 的 `GlobalException` 消息。
pub fn normalize_distribution_mode(value: &mut Value) -> std::result::Result<(), String> {
    let Some(obj) = value.as_object_mut() else {
        return Ok(());
    };
    let mode = obj
        .get("distributionMode")
        .and_then(Value::as_i64)
        .and_then(|v| i32::try_from(v).ok())
        .unwrap_or(DISTRIBUTION_MODE_PROMOTER);
    if mode != DISTRIBUTION_MODE_WECHAT_BIZ {
        obj.insert(
            "distributionMode".into(),
            Value::from(DISTRIBUTION_MODE_PROMOTER),
        );
        obj.insert("recruitMethods".into(), Value::Null);
        return Ok(());
    }
    obj.insert(
        "distributionMode".into(),
        Value::from(DISTRIBUTION_MODE_WECHAT_BIZ),
    );
    let methods = obj
        .get("recruitMethods")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_i64)
                .filter_map(|v| i32::try_from(v).ok())
                .collect::<Vec<i32>>()
        })
        .unwrap_or_default();
    if methods.is_empty() {
        return Err(MSG_WECHAT_BIZ_REQUIRES_METHOD.to_string());
    }
    if methods.iter().any(|m| !matches!(m, 1 | 2)) {
        return Err(MSG_INVALID_RECRUIT_METHOD.to_string());
    }
    Ok(())
}

/// 为 `salesmanConfig` 补齐 Java 默认值。
#[must_use]
pub fn with_defaults(mut value: Value) -> Value {
    let Some(obj) = value.as_object_mut() else {
        return value;
    };
    obj.entry("distributionMode".to_string())
        .or_insert_with(|| Value::from(DISTRIBUTION_MODE_PROMOTER));
    obj.entry("viewCustomerInfo".to_string())
        .or_insert_with(|| Value::from(0));
    obj.entry("wechatBizEnabled".to_string())
        .or_insert_with(|| Value::Bool(true));
    obj.entry("registerToSalesman".to_string())
        .or_insert_with(|| Value::from(0));
    value
}

/// 解析 `salesman_config.data`（空/非法 → 空对象）。
#[must_use]
pub fn parse_config_data(raw: Option<&str>) -> Value {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| serde_json::from_str::<Value>(s).ok())
        .unwrap_or_else(|| Value::Object(Map::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn promoter_mode_clears_recruit_methods() {
        let mut v = serde_json::json!({"distributionMode": 1, "recruitMethods": [1, 2], "viewCustomerInfo": 1});
        normalize_distribution_mode(&mut v).unwrap();
        assert_eq!(v["distributionMode"], 1);
        assert!(v["recruitMethods"].is_null());
        // 缺省 distributionMode 视作推广员模式
        let mut v2 = serde_json::json!({});
        normalize_distribution_mode(&mut v2).unwrap();
        assert_eq!(v2["distributionMode"], 1);
    }

    #[test]
    fn wechat_biz_requires_methods() {
        let mut v = serde_json::json!({"distributionMode": 2, "recruitMethods": []});
        assert_eq!(
            normalize_distribution_mode(&mut v).unwrap_err(),
            MSG_WECHAT_BIZ_REQUIRES_METHOD
        );
        let mut bad = serde_json::json!({"distributionMode": 2, "recruitMethods": [9]});
        assert_eq!(
            normalize_distribution_mode(&mut bad).unwrap_err(),
            MSG_INVALID_RECRUIT_METHOD
        );
        let mut ok = serde_json::json!({"distributionMode": 2, "recruitMethods": [1, 2]});
        normalize_distribution_mode(&mut ok).unwrap();
        assert_eq!(ok["distributionMode"], 2);
        assert_eq!(ok["recruitMethods"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn defaults_and_parse_are_tolerant() {
        let v = with_defaults(serde_json::json!({"viewCustomerInfo": 1}));
        assert_eq!(v["distributionMode"], 1);
        assert_eq!(v["viewCustomerInfo"], 1);
        assert_eq!(v["wechatBizEnabled"], true);
        assert_eq!(v["registerToSalesman"], 0);
        assert_eq!(parse_config_data(Some("bad")), serde_json::json!({}));
        assert_eq!(parse_config_data(None), serde_json::json!({}));
        assert_eq!(
            parse_config_data(Some(r#"{"a":1}"#)),
            serde_json::json!({"a":1})
        );
    }

    #[test]
    fn save_dto_round_trips_camel_case() {
        let dto: SalesmanConfigSaveDTO = serde_json::from_str(
            r#"{"distributionMode":2,"recruitMethods":[1],"viewCustomerInfo":1,"saleType":2,"someExtra":"x"}"#,
        )
        .unwrap();
        let v = dto.to_config_value();
        assert_eq!(v["distributionMode"], 2);
        assert_eq!(v["recruitMethods"], serde_json::json!([1]));
        assert_eq!(v["someExtra"], "x");
    }
}
