//! catalog::product_manage client/admin 第二批端点 —— 模型层（wave8 batch 2）。
//!
//! 覆盖 admin 6 条（config/copy/getPromoteData/selectProductList/saveShareInfo/shareInfo）
//! 与 public 14 条（share/isCollect/getCoupon/getComment/getCommentList/getFeedbackList/
//! getProductAvailability/promotion/getProductAmount/priceInquiry/getPresaleDepositAmount/
//! getRelated/getBatchProductAvailability/getHistoryProduct）。
//!
//! 对应 Java：
//! - admin `com.tigshop.adminapi.controller.product.ProductController`
//! - public `com.tigshop.api.controller.product.ProductController`
//!
//! 响应体以大结构为主的端点（列表/统计/价格试算）统一返回 `serde_json::Value`，
//! 字段与 Java VO 语义对齐但未逐字段裁剪（见服务层偏差登记）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 商品不存在（Java `GlobalException("商品不存在")`）。
pub const MSG_PRODUCT_NOT_FOUND: &str = "商品不存在";
/// 商品 ID/参数缺失。
pub const MSG_PRODUCT_ID_REQUIRED: &str = "商品id不能为空";
/// 未登录不可查询收藏/浏览记录（Java `getCurrentUsername` 为空返回 false）。
pub const MSG_LOGIN_REQUIRED: &str = "请先登录";
/// 价格试算数量不能为空。
pub const MSG_AMOUNT_ITEMS_REQUIRED: &str = "请选择商品规格";
/// 询价内容不能为空。
pub const MSG_INQUIRY_CONTENT_REQUIRED: &str = "询价内容不能为空";

/// 管理端 config 查询参数（Java `@RequestParam(required=false) Integer shopId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductConfigQuery {
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

/// 商品复制（Java `ProductCopyDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductCopyDTO {
    /// 源商品 ID
    pub product_id: i32,
    /// 前端附带的产品列表（Java 用于批量复制选择，本实现忽略）
    pub product_list: Option<Vec<serde_json::Value>>,
}

/// 商品分享信息（Java `ProductShareInfoDTO` / `ProductShareInfoVO` 同构）。
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductShareInfoDTO {
    /// 商品 ID
    pub product_id: i32,
    /// 分享标题（商品名称）
    pub product_name: String,
    /// 分享价格
    pub product_price: Decimal,
    /// 分享图片
    pub pic_url: String,
}

/// 商品分享信息 VO（Java `ProductShareInfoVO`，与 DTO 同构）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductShareInfoVO {
    /// 商品 ID
    pub product_id: i32,
    /// 分享标题（商品名称）
    pub product_name: String,
    /// 分享价格
    pub product_price: Decimal,
    /// 分享图片
    pub pic_url: String,
}

/// `selectProductList` 查询（Java `ProductSkuPageQuery` + 分页）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectProductListQuery {
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 商品类型列表
    pub product_type: Option<Vec<i32>>,
    /// 是否包含周期购
    pub is_include_cycle_product: Option<i32>,
    /// 排除商品类型
    pub exclude_product_types: Option<Vec<i32>>,
    /// 页码
    pub page: Option<u32>,
    /// 每页条数（默认 20）
    pub size: Option<u32>,
}

impl SelectProductListQuery {
    /// 分页。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::from(self.page.unwrap_or(1).max(1)),
            page_size: u64::from(self.size.unwrap_or(20).max(1)),
        }
    }
}

/// public 通用 `id` 查询。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductIdParam {
    /// 商品 ID
    pub id: i32,
    /// 店铺 ID（可空）
    pub shop_id: Option<i32>,
}

/// share 页面参数（Java `sharePage`：`id` + `salesmanId`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharePageQuery {
    /// 商品 ID
    pub id: i32,
    /// 分销员 ID
    pub salesman_id: Option<i32>,
}

/// 评论列表参数（Java `getCommentList`：`id/page/type/shopId`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentListQuery {
    /// 商品 ID
    pub id: i32,
    /// 页码
    pub page: Option<u32>,
    /// 评论类型（Java `type`；5 = 有图/展示）
    #[serde(rename = "type")]
    pub type_: Option<i32>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

impl CommentListQuery {
    /// 分页（Java 固定 size=10）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::from(self.page.unwrap_or(1).max(1)),
            page_size: 10,
        }
    }
}

/// 商品咨询列表参数（Java `getFeedbackList`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackListQuery {
    /// 商品 ID
    pub product_id: i32,
    /// 页码
    pub page: Option<u32>,
    /// 每页条数
    pub size: Option<u32>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl FeedbackListQuery {
    /// 分页。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::from(self.page.unwrap_or(1).max(1)),
            page_size: u64::from(self.size.unwrap_or(10).max(1)),
        }
    }

    /// 排序（白名单：createTime/addTime；未知回退 add_time DESC）。
    #[must_use]
    pub fn order(&self) -> (&'static str, bool) {
        let asc = self
            .sort_order
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("asc"))
            .unwrap_or(false);
        // Java `feedback` 表只有 add_time；排序字段白名单仅为前端兼容，落库列固定。
        let _ = self.sort_field.as_deref();
        ("add_time", asc)
    }
}

/// 可用性查询（Java `getProductAvailability`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAvailabilityQuery {
    /// 商品 ID
    pub id: Option<i32>,
    /// SKU ID（可空）
    pub sku_id: Option<i32>,
    /// 是否积分兑换
    pub is_exchange: Option<i32>,
    /// 额外属性 ID
    pub extra_attr_ids: Option<String>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 地址 ID
    pub address_id: Option<i32>,
}

/// 批量可用性查询（Java `getBatchProductAvailability`：`skuIds` 逗号串）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchAvailabilityQuery {
    /// 逗号分隔 SKU ID
    pub sku_ids: String,
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

/// 预售定金查询（Java `getPresaleDepositAmount`：`productId` + `skuId`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresaleDepositQuery {
    /// 商品 ID
    pub product_id: i32,
    /// SKU ID
    pub sku_id: i32,
}

/// 历史商品分页（Java `BasePage` 子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryProductQuery {
    /// 页码
    pub page: Option<u32>,
    /// 每页条数
    pub size: Option<u32>,
}

impl HistoryProductQuery {
    /// 分页。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::from(self.page.unwrap_or(1).max(1)),
            page_size: u64::from(self.size.unwrap_or(10).max(1)),
        }
    }
}

/// 促销查询（Java `ProductsPromotionDTO`；`products` 为 ProductSaveParam 列表）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductsPromotionDTO {
    /// 商品列表（每项至少包含 `productId`）
    pub products: Vec<serde_json::Value>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 来源
    pub promotion_from: Option<String>,
}

/// 价格试算（Java `ProductAmountDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAmountDTO {
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 商品 ID
    pub id: i32,
    /// 规格数量列表
    pub sku_item: Vec<SkuAmountItem>,
}

/// 价格试算单项（Java `ProductAmountDTO.SkuItem`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkuAmountItem {
    /// SKU ID
    pub sku_id: i32,
    /// 数量
    pub num: i32,
}

/// 商品询价（Java `ProductPriceInquiryDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductPriceInquiryDTO {
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 询价内容
    pub content: Option<String>,
    /// 商品 ID
    pub product_id: i32,
}

/// 从商品实体 JSON 组装列表项（`ProductListResDTO` 的前端常用字段子集）。
#[must_use]
pub fn product_list_item(product: &serde_json::Value) -> serde_json::Value {
    let get = |k: &str| product.get(k).cloned().unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "productId": get("product_id"),
        "productName": get("product_name"),
        "productSn": get("product_sn"),
        "productPrice": get("product_price"),
        "marketPrice": get("market_price"),
        "picUrl": get("pic_url"),
        "picThumb": get("pic_thumb"),
        "productBrief": get("product_brief"),
        "shopId": get("shop_id"),
        "productType": get("product_type"),
        "saleMode": get("sale_mode"),
        "productStock": get("product_stock"),
    })
}

/// HTML 转义（share 页拼接最小 HTML 用）。
#[must_use]
pub fn html_escape(raw: &str) -> String {
    raw.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_list_defaults_to_page_ten() {
        let q: CommentListQuery = serde_json::from_value(serde_json::json!({
            "id": 3, "page": 2, "type": 5
        }))
        .unwrap();
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 10);
        assert_eq!(q.type_, Some(5));
    }

    #[test]
    fn feedback_order_whitelist() {
        let q: FeedbackListQuery =
            serde_json::from_value(serde_json::json!({"productId":1,"sortField":"createTime"}))
                .unwrap();
        assert_eq!(q.order(), ("add_time", false));
        let q: FeedbackListQuery = serde_json::from_value(
            serde_json::json!({"productId":1,"sortField":"addTime","sortOrder":"asc"}),
        )
        .unwrap();
        assert_eq!(q.order(), ("add_time", true)); // feedback 只有 add_time；方向取 sortOrder
    }

    #[test]
    fn html_escape_handles_xss_chars() {
        assert_eq!(
            html_escape("<a href=\"x\">A&B</a>"),
            "&lt;a href=&quot;x&quot;&gt;A&amp;B&lt;/a&gt;"
        );
    }

    #[test]
    fn product_list_item_picks_snake_case_entity_keys() {
        let p = serde_json::json!({"product_id":9,"product_name":"测试","product_price":"12.30","pic_url":"x.jpg"});
        let item = product_list_item(&p);
        assert_eq!(item["productId"], 9);
        assert_eq!(item["productName"], "测试");
        assert_eq!(item["picUrl"], "x.jpg");
    }
}
