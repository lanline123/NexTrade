//! catalog::product_manage 管理端剩余端点 —— 模型层（第二批，wave8）。
//!
//! 本文件只补充**尚未实现**的管理端端点所需 DTO/VO；已有 7 条基线端点的类型
//! 保留在 `product_manage.rs`。对应 Java `ProductController`
//! （`java/tigshop-adminapi/.../controller/product/ProductController.java`）。
//!
//! 已交付：getWaitingCheckedCount / descImages / skuList / shippingTplList /
//! updateField / batch / recycle / audit / auditAgain。
//! 明确「未迁移」：getParticiple（ES 分词）、initAllToEs（ES）、post（短链/小程序码）。
//! 未开始（不在本文件）：config / copy / getPromoteData / selectProductList /
//! saveShareInfo / shareInfo + 全部 14 条 public 端点。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 未迁移业务错误码（与 config_basic 的 SERVICE_DATA_ERROR 一致）。
pub const SERVICE_DATA_ERROR: i32 = 1001;
/// 商品不存在（Java `GlobalException("商品不存在")`）。
pub const MSG_PRODUCT_NOT_FOUND: &str = "商品不存在";
/// 未知的产品（Java `recycle`：`GlobalException("未知的产品")`）。
pub const MSG_PRODUCT_UNKNOWN: &str = "未知的产品";
/// 商品审核状态错误（Java `audit`/`auditAgain` 校验）。
pub const MSG_AUDIT_STATUS_INVALID: &str = "商品审核状态错误";
/// 上架状态只能为 0/1（Java `updateFieldProduct` 文案）。
pub const MSG_PRODUCT_STATUS_INVALID: &str = "商品上架状态只能为0或1";
/// 不支持的批量操作类型。
pub const MSG_BATCH_TYPE_INVALID: &str = "不支持的批量操作类型";
/// ES 分词未迁移（`ProductService.getParticiple` → `ProductEsService`）。
pub const MSG_PARTICIPLE_NOT_MIGRATED: &str = "商品关键词分词未迁移（依赖 ES 分词服务）";
/// ES 全量同步未迁移（`ProductEsService.syncAllProductsStream`）。
pub const MSG_ES_INIT_NOT_MIGRATED: &str = "商品全量同步 ES 未迁移（依赖 Elasticsearch 客户端）";
/// 商品推广页未迁移（短链服务 + 微信小程序码）。
pub const MSG_POST_NOT_MIGRATED: &str = "商品推广页未迁移（依赖短链服务与微信小程序码生成）";

/// 商品描述图片（Java `ProductDescImageVO`）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductDescImageVO {
    /// "pic" / "video"
    pub r#type: String,
    /// 图片 URL（video 取封面）
    pub url: String,
}

/// SKU 分页查询（Java `ProductSkuListQuery`；`id` 为商品 ID）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductSkuListQuery {
    /// 商品 ID
    pub id: Option<i32>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数（Java 默认 50）
    pub size: Option<i64>,
    /// 关键字（SKU 编码）
    pub keyword: Option<String>,
    /// 库存下限
    pub stock_min: Option<i32>,
    /// 库存上限
    pub stock_max: Option<i32>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向（asc/desc）
    pub sort_order: Option<String>,
}

impl ProductSkuListQuery {
    /// 统一分页信封（默认 1/50，与 Java `ProductSkuService` 一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::try_from(self.page.unwrap_or(1).max(1)).unwrap_or(1),
            page_size: u64::try_from(self.size.unwrap_or(50).max(1)).unwrap_or(50),
        }
    }

    /// LIMIT/OFFSET。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let p = self.page_query();
        (
            u64::from(p.page_size),
            u64::from(p.page - 1) * u64::from(p.page_size),
        )
    }

    /// 排序：Java `ProductSku` 可排序列白名单；未知字段回退 `sku_id ASC`。
    #[must_use]
    pub fn order(&self) -> (&'static str, bool) {
        let asc = self
            .sort_order
            .as_deref()
            .map(|s| s.eq_ignore_ascii_case("asc"))
            .unwrap_or(true);
        let col = match self.sort_field.as_deref() {
            Some("skuPrice") => "sku_price",
            Some("skuStock") => "sku_stock",
            Some("skuSn") => "sku_sn",
            _ => "sku_id",
        };
        (col, asc)
    }
}

/// 更新商品字段（Java `UpdateFieldProductDTO`；`val` 为任意 JSON 标量）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductUpdateFieldDTO {
    /// 商品 ID
    pub id: i32,
    /// 字段名（Java 属性名）
    pub field: String,
    /// 字段值
    pub val: serde_json::Value,
}

/// 批量操作（Java `ProductBatchOperationDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductBatchOperationDTO {
    /// 商品 ID 列表
    pub ids: Vec<i64>,
    /// 操作类型：del / up / down / recycle
    #[serde(rename = "type")]
    pub type_: String,
}

/// 商品回收（Java `ProductRecycleDTO`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductRecycleDTO {
    /// 商品 ID
    pub id: i64,
}

/// 商品推广海报/链接数据（Java `ProductPostVO`，管理端 `GET /product/product/post`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductPostVO {
    /// 商品名称
    pub product_name: String,
    /// 商品价格
    pub product_price: Option<Decimal>,
    /// 商品主图 URL
    pub pic_url: Option<String>,
    /// 商品简介
    pub product_brief: Option<String>,
    /// 商品编号
    pub product_sn: Option<String>,
    /// 店铺名称
    pub shop_name: String,
    /// H5 短链完整 URL
    pub h5_short_link: Option<String>,
    /// H5 原始链接
    pub h5_original_link: Option<String>,
    /// PC 短链完整 URL
    pub pc_short_link: Option<String>,
    /// PC 原始链接
    pub pc_original_link: Option<String>,
    /// 小程序二维码（Base64 data URL）
    pub mini_code: Option<String>,
    /// 微信小程序短链
    pub wechat_short_link: Option<String>,
    /// 微信短链失败原因
    pub wechat_short_link_error: Option<String>,
}

/// 商品审核（Java `ProductAuditDTO`；`checkStatus` 1=通过 2=不通过）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAuditDTO {
    /// 商品 ID
    pub id: i32,
    /// 审核状态
    pub check_status: i32,
    /// 未通过原因
    pub check_reason: Option<String>,
}

/// Java `CheckStatus`：待审核。
pub const CHECK_STATUS_PENDING: i32 = 0;
/// Java `CheckStatus`：审核通过。
pub const CHECK_STATUS_APPROVED: i32 = 1;
/// Java `CheckStatus`：审核未通过。
pub const CHECK_STATUS_REJECTED: i32 = 2;

/// 解析商品描述 JSON 中的图片/视频封面（对应 Java `getProductDescArr` +
/// `getDescImages`）。非法 JSON 返回空列表（Java 侧也容错为空）。
#[must_use]
pub fn parse_desc_images(product_desc: Option<&str>) -> Vec<ProductDescImageVO> {
    let Some(raw) = product_desc else {
        return Vec::new();
    };
    let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(raw) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in arr {
        let ty = item
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let url = match ty {
            "pic" => item.get("pic").and_then(|v| v.as_str()),
            "video" => item.get("cover").and_then(|v| v.as_str()),
            _ => None,
        };
        if let Some(u) = url.map(str::trim).filter(|s| !s.is_empty()) {
            out.push(ProductDescImageVO {
                r#type: ty.to_string(),
                url: u.to_string(),
            });
        }
    }
    out
}

/// 商品字段名 → 数据库列名（Java `PRODUCT_FIELDS` 的安全子集）。
#[must_use]
pub fn product_field_column(field: &str) -> Option<&'static str> {
    match field {
        "productName" => Some("product_name"),
        "productSn" => Some("product_sn"),
        "productBrief" => Some("product_brief"),
        "productStatus" => Some("product_status"),
        "sortOrder" => Some("sort_order"),
        "isBest" => Some("is_best"),
        "isNew" => Some("is_new"),
        "isHot" => Some("is_hot"),
        _ => None,
    }
}

/// `ProductUpdateFieldDTO` 值 → 落库字符串（JSON 数字/字符串/布尔）；
/// 空值/对象/数组不允许（与 Java 标量字段口径一致）。
#[must_use]
pub fn scalar_to_string(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(if *b { "1" } else { "0" }.to_string()),
        _ => None,
    }
}

/// 商品价格（保留给未开始端点使用，避免后续重复定义）。
pub type Money = Decimal;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sku_query_defaults_and_order() {
        let q: ProductSkuListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 50);
        assert_eq!(q.order(), ("sku_id", true));
        let q: ProductSkuListQuery = serde_json::from_value(serde_json::json!({
            "id": 7, "page":2, "size":20, "sortField":"skuStock", "sortOrder":"desc"
        }))
        .unwrap();
        assert_eq!(q.id, Some(7));
        assert_eq!(q.limit_offset(), (20, 20));
        assert_eq!(q.order(), ("sku_stock", false));
    }

    #[test]
    fn desc_images_parse_pic_and_video() {
        let raw = r#"[{"type":"pic","pic":"https://a/1.jpg"},{"type":"video","cover":"https://a/c.jpg"},{"type":"text","content":"x"},{"type":"pic","pic":""}]"#;
        let imgs = parse_desc_images(Some(raw));
        assert_eq!(imgs.len(), 2);
        assert_eq!(imgs[0].url, "https://a/1.jpg");
        assert_eq!(imgs[1].r#type, "video");
        assert!(parse_desc_images(None).is_empty());
        assert!(parse_desc_images(Some("not-json")).is_empty());
    }

    #[test]
    fn field_whitelist_and_scalar_conversion() {
        assert_eq!(
            product_field_column("productStatus"),
            Some("product_status")
        );
        assert_eq!(product_field_column("productName"), Some("product_name"));
        assert_eq!(product_field_column("id"), None);
        assert_eq!(scalar_to_string(&serde_json::json!(1)), Some("1".into()));
        assert_eq!(
            scalar_to_string(&serde_json::json!("abc")),
            Some("abc".into())
        );
        assert_eq!(scalar_to_string(&serde_json::json!([1])), None);
    }
}
