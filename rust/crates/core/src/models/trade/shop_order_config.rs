//! 店铺订单配置域（trade::shop_order_config）DTO / 纯函数。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.order.ShopOrderConfigController`
//! （`/adminapi/order/config`，2 个端点）+ `OrderConfigServiceImpl`。
//!
//! 存储表 `order_config(shop_id, code, data)`：`data` 为 `OrderConfigDTO` 的 JSON 串。

use serde::{Deserialize, Serialize};

/// `店铺ID不能为空`
pub const MSG_SHOP_ID_REQUIRED: &str = "店铺ID不能为空";
/// `配置编码不能为空`
pub const MSG_CODE_REQUIRED: &str = "配置编码不能为空";

/// 订单配置保存入参（Java `OrderConfigDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigDTO {
    pub code: Option<String>,
    pub date_type: Option<i32>,
    pub shop_id: Option<i32>,
    pub use_day: Option<String>,
}

/// 配置详情查询（Java `@RequestParam shopId/code`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigDetailQuery {
    pub shop_id: Option<i32>,
    pub code: Option<String>,
}

/// 校验详情参数。
#[must_use]
pub fn validate_detail(shop_id: Option<i32>, code: Option<&str>) -> Result<(), String> {
    if shop_id.filter(|id| *id > 0).is_none() {
        return Err(MSG_SHOP_ID_REQUIRED.to_string());
    }
    if code.map(str::trim).filter(|c| !c.is_empty()).is_none() {
        return Err(MSG_CODE_REQUIRED.to_string());
    }
    Ok(())
}

/// 序列化配置 JSON（Java `JSONUtil.toJsonStr(dto)`，Hutool 默认忽略 null 字段）。
#[must_use]
pub fn build_config_json(dto: &OrderConfigDTO) -> String {
    let mut map = serde_json::Map::new();
    if let Some(code) = &dto.code {
        map.insert("code".into(), serde_json::Value::String(code.clone()));
    }
    if let Some(date_type) = dto.date_type {
        map.insert("dateType".into(), serde_json::Value::from(date_type));
    }
    if let Some(shop_id) = dto.shop_id {
        map.insert("shopId".into(), serde_json::Value::from(shop_id));
    }
    if let Some(use_day) = &dto.use_day {
        map.insert("useDay".into(), serde_json::Value::String(use_day.clone()));
    }
    serde_json::Value::Object(map).to_string()
}

/// 解析配置 JSON（Java `JSONUtil.parse`；非法 JSON → None）。
#[must_use]
pub fn parse_config_json(raw: Option<&str>) -> Option<serde_json::Value> {
    raw.and_then(|value| serde_json::from_str::<serde_json::Value>(value).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validations_match_java_required_params() {
        assert_eq!(
            validate_detail(None, Some("x")).unwrap_err(),
            MSG_SHOP_ID_REQUIRED
        );
        assert_eq!(
            validate_detail(Some(0), Some("x")).unwrap_err(),
            MSG_SHOP_ID_REQUIRED
        );
        assert_eq!(
            validate_detail(Some(1), None).unwrap_err(),
            MSG_CODE_REQUIRED
        );
        assert_eq!(
            validate_detail(Some(1), Some(" ")).unwrap_err(),
            MSG_CODE_REQUIRED
        );
        assert!(validate_detail(Some(1), Some("order")).is_ok());
    }

    #[test]
    fn config_json_ignores_null_fields() {
        let dto = OrderConfigDTO {
            code: Some("order".into()),
            shop_id: Some(2),
            date_type: Some(1),
            use_day: Some("7".into()),
        };
        let json = build_config_json(&dto);
        assert_eq!(
            json,
            r#"{"code":"order","dateType":1,"shopId":2,"useDay":"7"}"#
        );
        let empty = build_config_json(&OrderConfigDTO::default());
        assert_eq!(empty, "{}");
        let parsed = parse_config_json(Some(&json)).unwrap();
        assert_eq!(parsed["shopId"], 2);
        assert!(parse_config_json(Some("not json")).is_none());
        assert!(parse_config_json(None).is_none());
    }

    #[test]
    fn dto_accepts_java_names() {
        let dto: OrderConfigDTO =
            serde_json::from_str(r#"{"code":"order","dateType":2,"shopId":3,"useDay":"30"}"#)
                .unwrap();
        assert_eq!(dto.code.as_deref(), Some("order"));
        assert_eq!(dto.date_type, Some(2));
        assert_eq!(dto.use_day.as_deref(), Some("30"));
        let q: OrderConfigDetailQuery =
            serde_json::from_str(r#"{"shopId":3,"code":"order"}"#).unwrap();
        assert_eq!(q.shop_id, Some(3));
    }
}
