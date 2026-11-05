//! 代客下单商品管理（trade::proxy_shopping_product）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.vo.product.ProductAvailabilityVO`
//! - `com.tigshop.bean.dto.product.ProductSkuDTO`（含内部类 `SkuData`）
//! - `com.tigshop.bean.dto.product.ProductListDTO`（本域只接收，不改结构）
//!
//! JSON 字段一律 camelCase，与前端一致。
//!
//! **注意（本切片已知取舍）**：原 Java `getProductSkuDetail` 返回的
//! `promotion`（秒杀 / 限时折扣 / 拼团 / 满减）、会员等级折扣、
//! 积分兑换标记、O2O 门店距离、预售定金、批发隐藏活动等字段依赖
//! **尚未迁移**的域，本文件保留字段但恒为空 / `None`，**不编造业务值**。
//! 逐条说明见 `crates/services/src/proxy_shopping_product.rs` 模块头。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ————————————————————— 入参 —————————————————————

/// `GET /adminapi/proxyShopping/product/productDetail` 查询参数。
///
/// 对应 Java `ProxyShoppingProductController.detail` 的四个 `@RequestParam`
/// （`productTsn` / `productSn` / `shopId` / `nearestShopId`，均 `required = false`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProxyProductDetailQuery {
    /// 商品 TS 货号（`product.product_tsn`）
    pub product_tsn: Option<String>,
    /// 商品货号（优先于 `productTsn`，Java 直接用它走 `clientDetail`）
    pub product_sn: Option<String>,
    /// O2O 门店上下文（未迁移，见 services 模块头）
    pub shop_id: Option<i32>,
    /// O2O 最近门店（未迁移）
    pub nearest_shop_id: Option<i32>,
}

/// `GET /adminapi/proxyShopping/product/getProductAvailability` 查询参数。
///
/// 对应 Java `ProxyShoppingProductController.getProductAvailability` 的六个
/// `@RequestParam`；`id`（商品 ID）必填，其余可空。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProxyProductAvailabilityQuery {
    /// 商品 ID（Java `@RequestParam("id")`，必填）
    #[serde(rename = "id")]
    pub product_id: Option<i32>,
    /// 规格 ID（空 = 取商品默认规格）
    #[serde(rename = "skuId")]
    pub sku_id: Option<i32>,
    /// 附加规格 ID 串（逗号分隔，Java 按 `attributes_id` 累加 `attr_price`）
    pub extra_attr_ids: Option<String>,
    /// 店铺 ID（O2O，未迁移）
    pub shop_id: Option<i32>,
    /// 收货地址 ID（仅用于算距离，未迁移）
    pub address_id: Option<i32>,
    /// 会员 ID（会员折扣未迁移）
    pub user_id: Option<i32>,
}

// ————————————————————— 返回 VO —————————————————————

/// SKU 规格键值对（对应 Java `ProductSkuDTO.SkuData`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkuAvailabilityDataVO {
    /// 规格名（如「颜色」）
    pub name: String,
    /// 规格值（如「红色」）
    pub value: String,
    /// 规格缩略图（Java `getProductAttribute`：命中 `product_attributes.attr_pic_thumb`
    /// 则用之，否则回退商品主图 `product.pic_thumb`）
    pub attr_pic_thumb: Option<String>,
}

/// SKU 明细（对应 Java `ProductSkuDTO`，本切片按 `product_sku` 可提供的字段下发）。
///
/// Java `ProductSkuDTO` 中依赖 O2O 门店覆盖层（`platform*/store*` 服务费）、
/// 供应商、预售的字段未迁移，本结构**不包含**它们（避免下发假值）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AvailabilitySkuVO {
    #[serde(rename = "skuId")]
    pub sku_id: i32,
    pub product_id: i32,
    /// 规格值展示串（如 `红色 XL`）
    pub sku_value: String,
    /// 规格结构（Java `List<SkuData>`，库中 `sku_data` 为 JSON 文本）
    pub sku_data: Option<serde_json::Value>,
    pub sku_sn: Option<String>,
    pub sku_stock: i32,
    pub sku_tsn: Option<String>,
    /// 货品价格（Java DTO 为 String，这里按十进制下发避免精度丢失）
    pub sku_price: Option<Decimal>,
    /// 是否启用：0 禁用 1 启用
    pub is_enabled: i32,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub delivery_service_fee_type: i32,
    pub delivery_service_fee_value: Decimal,
    pub server_service_fee_type: i32,
    pub server_service_fee_value: Decimal,
    pub vendor_product_sku_id: Option<i32>,
}

/// 商品可用数据（对应 Java `ProductAvailabilityVO`）。
///
/// 字段顺序与 Java 一致；依赖未迁移域的三个字段（`promotion` / `distance` /
/// `depositAmount` + `finalPaymentAmount` / `giftCardGroupsId`）恒为空值，
/// 详见 `crates/services/src/proxy_shopping_product.rs` 模块头。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAvailabilityVO {
    /// Java `setId(productId)` —— **商品 ID**，不是规格 ID
    pub id: i32,
    /// 规格结构（Java `setData(skuData)`）
    pub data: Vec<SkuAvailabilityDataVO>,
    /// SKU 明细（无规格 / 未命中时为 `None`）
    pub sku: Option<AvailabilitySkuVO>,
    /// 未迁移：预售定金（依赖 `product_presale` 域），恒 `None`
    pub deposit_amount: Option<Decimal>,
    /// 未迁移：尾款金额，恒 `None`
    pub final_payment_amount: Option<Decimal>,
    /// 原价（Java：无活动价时等于 `price`，有活动价时为活动前价）
    pub origin_price: Option<Decimal>,
    /// 市场价（`product.market_price`）
    pub market_price: Option<Decimal>,
    /// 起算价（Java `startProductPrice`：命中 SKU 时为其价，否则为商品价）
    pub start_product_price: Option<Decimal>,
    /// 最终价（Java：`productPrice + attrPrice`，两位小数 HALF_UP）
    pub price: Option<Decimal>,
    /// 库存（Java：命中 SKU 且启用时为其库存，否则为商品库存）
    pub stock: Option<i32>,
    /// 未迁移：促销信息（秒杀 / 限时折扣 / 拼团），恒空数组
    pub promotion: Vec<serde_json::Value>,
    pub product_id: i32,
    /// 未迁移：O2O 门店距离（依赖 `user_address` + 门店经纬度 + 自营门店配置），恒 `None`
    pub distance: Option<Decimal>,
    /// 未迁移：礼品卡组 ID（依赖礼品卡域），恒 `None`
    pub gift_card_groups_id: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn detail_query_accepts_camel_case_and_missing_fields() {
        // 前端真实提交：四个参数均可缺省
        let q: ProxyProductDetailQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.product_sn, None);
        assert_eq!(q.product_tsn, None);

        let q: ProxyProductDetailQuery =
            serde_json::from_str(r#"{"productTsn":"TSN1","shopId":3,"nearestShopId":5}"#).unwrap();
        assert_eq!(q.product_tsn.as_deref(), Some("TSN1"));
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.nearest_shop_id, Some(5));
    }

    #[test]
    fn availability_query_uses_lowercase_id_param_names() {
        // Java 用 `@RequestParam("id")` / `@RequestParam("skuId")`：
        // id 全小写，skuId 是 camelCase（不能统一 rename_all 得到）
        let q: ProxyProductAvailabilityQuery = serde_json::from_str(
            r#"{"id":9,"skuId":11,"extraAttrIds":"3,4","shopId":1,"addressId":2,"userId":7}"#,
        )
        .unwrap();
        assert_eq!(q.product_id, Some(9));
        assert_eq!(q.sku_id, Some(11));
        assert_eq!(q.extra_attr_ids.as_deref(), Some("3,4"));
        assert_eq!(q.address_id, Some(2));
        assert_eq!(q.user_id, Some(7));
    }

    #[test]
    fn availability_vo_serializes_camel_case_like_java() {
        let vo = ProductAvailabilityVO {
            id: 5,
            product_id: 5,
            price: Some(Decimal::from_str("12.30").unwrap()),
            stock: Some(8),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["id"], 5);
        assert_eq!(json["productId"], 5);
        assert_eq!(json["stock"], 8);
        // 金额下发为 JSON **字符串**：workspace 的 `rust_decimal` 启用了
        // `serde-with-str`，`Decimal` 一律序列化为字符串（如 `"12.30"`），
        // 因此不能用 `as_f64()`（对字符串返回 None）。
        assert_eq!(json["price"], "12.30");
        // 未迁移字段仍然出现在 JSON 里（前端结构兼容），值为 null / []
        assert!(json["promotion"].as_array().unwrap().is_empty());
        assert!(json["distance"].is_null());
        assert!(json["depositAmount"].is_null());
        assert!(json["finalPaymentAmount"].is_null());
        assert!(json["giftCardGroupsId"].is_null());
    }

    #[test]
    fn sku_vo_field_names_match_java_dto() {
        let sku = AvailabilitySkuVO {
            sku_id: 3,
            product_id: 4,
            sku_value: "红色".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&sku).unwrap();
        assert_eq!(json["skuId"], 3);
        assert_eq!(json["productId"], 4);
        assert_eq!(json["skuValue"], "红色");
        assert_eq!(json["isEnabled"], 0);
    }
}
