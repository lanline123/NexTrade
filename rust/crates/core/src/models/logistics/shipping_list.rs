//! 物流域 DTO/VO。对应 `com.tigshop.bean.dto.setting.*` 与 `param.settings.shippingtpl.*`。
//!
//! 注意：VO 的 **JSON 字段名**（`tplId`/`tplName`/`calcType`）保持与原前端接口
//! 一致，但**结构体字段名**对齐真实库列（`shipping_tpl_id`/`shipping_tpl_name`/
//! `pricing_type`），避免转换时张冠李戴。
//!
//! TODO(域实现者)：对照 Java 源补全字段。

use serde::{Deserialize, Serialize};

/// 运费模板分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplListQuery {
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 运费模板 VO（含明细）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShippingTplVO {
    /// 库列 `shipping_tpl_id`，前端字段 `shippingTplId`
    pub shipping_tpl_id: i32,
    /// 库列 `shipping_tpl_name`，前端字段 `shippingTplName`
    pub shipping_tpl_name: String,
    /// 库列 `pricing_type`（1 按件 2 按重量），前端字段 `pricingType`
    pub pricing_type: i32,
    /// 库列 `shipping_time`（配送时间说明）
    pub shipping_time: String,
    /// 是否包邮
    pub is_free: i32,
    /// 是否默认模板
    pub is_default: i32,
    pub shop_id: i32,
}

impl From<&crate::entities::ShippingTpl> for ShippingTplVO {
    fn from(t: &crate::entities::ShippingTpl) -> Self {
        Self {
            shipping_tpl_id: t.shipping_tpl_id,
            shipping_tpl_name: t.shipping_tpl_name.clone(),
            pricing_type: t.pricing_type,
            shipping_time: t.shipping_time.clone(),
            is_free: t.is_free,
            is_default: t.is_default,
            shop_id: t.shop_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shipping_tpl_vo_keeps_frontend_json_names() {
        let t = crate::entities::ShippingTpl {
            shipping_tpl_id: 7,
            shipping_tpl_name: "默认模板".into(),
            pricing_type: 2,
            ..Default::default()
        };
        let v = serde_json::to_value(ShippingTplVO::from(&t)).unwrap();
        // 与当前后台前端字段名一致
        assert_eq!(v["shippingTplId"], 7);
        assert_eq!(v["shippingTplName"], "默认模板");
        assert_eq!(v["pricingType"], 2);
    }
}
