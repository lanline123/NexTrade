//! 商品域（切片 catalog::product_manage）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.product.ProductListDTO` / `ProductListResDTO` /
//!   `ProductDetailDTO` / `ProductBatchEditDTO` / `ProductAttrsDTO` /
//!   `ProductListAttributeDTO` / `ProductSkuDTO` / `ProductDescDTO`
//! - `com.tigshop.bean.param.product.ProductSaveParam`（`ProductEditParam`
//!   在 Java 中是它的空子类，Rust 侧共用 [`ProductSaveDTO`]）
//! - `com.tigshop.bean.vo.product.ProductDetailVO` / `ProductBatchModifyVO`
//! - `com.tigshop.bean.model.product.Services` / `ProductVideo` /
//!   `ProductGallery`、`com.tigshop.bean.model.setting.GalleryPic`
//!
//! JSON 字段一律 camelCase，与前端一致。
//!
//! **注意（本切片已知取舍）**：Java 的 `ProductListResDTO` /
//! `ProductDetailDTO` 中依赖营销（秒杀/拼团/限时折扣/批发/积分/周期购/礼品卡）、
//! O2O（门店覆盖价/服务费上下文）与多语言翻译的字段，本切片**不编造**，
//! 一律以 `None` 下发（字段保留，保证 JSON 结构兼容），并在各字段注释里
//! 标明「未迁移」。依赖的域补齐后由对应切片回填。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ————————————————————— 管理端：商品列表 —————————————————————

/// 管理端商品列表查询参数（对应 Java `ProductListDTO extends BasePage`，
/// 含 `BasePage` 的 `keyword` / `page` / `size`）。
///
/// 仅包含本切片**已实现**的过滤项；Java 中依赖其它域的过滤项
/// （`couponId` / `posProductSource` / `attrs` / `deliveryTypes` /
/// `isLottery` 等）未纳入，见 `product_manage.rs`（services）中的未迁移说明。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminProductListQuery {
    /// 关键词（匹配 `product_name` / `keywords` / `product_sn` / `product_tsn`）
    pub keyword: Option<String>,
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 是否删除：0 未删除（默认）1 已删除 -1 全部
    pub is_delete: Option<i32>,
    /// 店铺 ID：-1 全部店铺，0 平台自营，>0 指定店铺
    pub shop_id: Option<i32>,
    /// 商品状态：1 上架 0 下架
    pub product_status: Option<i32>,
    /// 审核状态：0 待审核 1 通过 2 未通过
    pub check_status: Option<i32>,
    /// 指定商品 ID
    pub product_id: Option<i32>,
    /// 商品类型
    pub product_type: Option<i32>,
    /// 商品类型集合
    #[serde(default, deserialize_with = "de_i32_list_opt")]
    pub product_types: Option<Vec<i32>>,
    /// 排除的商品类型
    #[serde(default, deserialize_with = "de_i32_list_opt")]
    pub exclude_product_types: Option<Vec<i32>>,
    /// 分类 ID（含全部子孙分类）
    pub category_id: Option<i32>,
    /// 品牌 ID
    pub brand_id: Option<i32>,
    /// 品牌 ID 串（逗号分隔，Java `String brandIds`）
    pub brand_ids: Option<String>,
    /// 店铺分类 ID
    pub shop_category_id: Option<i32>,
    /// 商品 ID 串（逗号分隔，Java 用 `FIELD()` 保证返回顺序）
    pub ids: Option<String>,
    /// 商品 ID 集合
    #[serde(default, deserialize_with = "de_i32_list_opt")]
    pub id_list: Option<Vec<i32>>,
    /// 装修选品组件使用的商品 ID 集合（`productIds`）
    #[serde(default, deserialize_with = "de_i32_list_opt")]
    pub product_ids: Option<Vec<i32>>,
    /// 排除的商品 ID 集合
    #[serde(default, deserialize_with = "de_i32_list_opt")]
    pub extra_product_ids: Option<Vec<i32>>,
    /// 商品分组 ID（按 `product_group.product_ids` 展开）
    pub product_group_id: Option<i32>,
    /// 价格下限
    pub min_price: Option<Decimal>,
    /// 价格上限
    pub max_price: Option<Decimal>,
    /// 销量下限（口径 `virtual_sales`，与 Java 一致）
    pub min_sales: Option<i32>,
    /// 销量上限
    pub max_sales: Option<i32>,
    /// 创建时间下限（秒级时间戳，`add_time`）
    pub added_start_time: Option<i64>,
    /// 创建时间上限
    pub added_end_time: Option<i64>,
    /// 库存下限（`product_stock`）
    pub min_stock: Option<i32>,
    /// 库存上限
    pub max_stock: Option<i32>,
    /// 是否新品
    pub is_new: Option<i32>,
    /// 供应商 ID
    pub suppliers_id: Option<i32>,
    /// 销售模式：0 现货 1 全款预售 2 定金预售
    pub sale_mode: Option<i32>,
    /// 排序字段（Java `sortField`）
    pub sort_field: Option<String>,
    /// 排序方向：asc / desc
    pub sort_order: Option<String>,
    /// 按累计销量排序（口径复用 `virtual_sales`）
    pub sort_by_total_sales: Option<bool>,
    /// 按 30 日销量排序（口径复用 `virtual_sales`）
    pub sort_by_thirty_day_sales: Option<bool>,
    /// 是否仅展示自己的商品（门店账号语义，需鉴权中间件补 `shop_id`）
    pub only_show_me: Option<bool>,
}

impl AdminProductListQuery {
    /// 转通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(20),
        }
    }

    /// 解析 `ids`（逗号分隔）为 ID 列表用于 `FIELD()` 排序。
    ///
    /// 对应 Java `ProductServiceImpl#list` 中对 `ids` 的
    /// `^[0-9,]+$` 注入校验：非法格式报 `非法的 ids 参数`，
    /// 全部为空报 `ids 参数为空`。
    pub fn parsed_ids(&self) -> Result<Option<Vec<i32>>, String> {
        parse_id_csv(self.ids.as_deref(), "非法的 ids 参数", "ids 参数为空")
    }

    /// 解析 `brandIds`（逗号分隔）。
    pub fn parsed_brand_ids(&self) -> Result<Option<Vec<i32>>, String> {
        parse_id_csv(
            self.brand_ids.as_deref(),
            "非法的品牌ID参数",
            "品牌ID参数为空",
        )
    }
}

/// 解析逗号分隔的 ID 串（仅允许数字与逗号）。
///
/// `None` / 空串返回 `Ok(None)`；非法字符返回 `Err(illegal_msg)`；
/// 全部为空（如 `",,"`）返回 `Err(empty_msg)`。
pub fn parse_id_csv(
    raw: Option<&str>,
    illegal_msg: &str,
    empty_msg: &str,
) -> Result<Option<Vec<i32>>, String> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if !raw.chars().all(|c| c.is_ascii_digit() || c == ',') {
        return Err(illegal_msg.to_string());
    }
    let ids: Vec<i32> = raw
        .split(',')
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<i32>().ok())
        .collect();
    if ids.is_empty() {
        return Err(empty_msg.to_string());
    }
    Ok(Some(ids))
}

/// 解析 `1,2,3` 形式的整数列表（忽略空白与空段）。
///
/// 供查询参数使用：前端既可能传 `productTypes=1,2`（Spring 习惯），
/// 也可能传重复键 `productTypes=1&productTypes=2`。
pub fn parse_i32_csv(raw: &str) -> Result<Vec<i32>, String> {
    let mut out = Vec::new();
    for part in raw.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        out.push(
            part.parse::<i32>()
                .map_err(|_| format!("非法的数字参数: {part}"))?,
        );
    }
    Ok(out)
}

/// `Option<Vec<i32>>` 的宽松反序列化：兼容
/// - 字段缺省 / `null`
/// - 单个数字（`productTypes=1`）
/// - 逗号分隔串（`productTypes=1,2`）
/// - 数组（JSON 或重复键表单，`productTypes=1&productTypes=2`）
pub fn de_i32_list_opt<'de, D>(de: D) -> Result<Option<Vec<i32>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    de.deserialize_option(I32ListVisitor)
}

/// 见 [`de_i32_list_opt`]。
struct I32ListVisitor;

impl<'de> serde::de::Visitor<'de> for I32ListVisitor {
    type Value = Option<Vec<i32>>;

    fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("整数、逗号分隔的整数串或整数数组")
    }

    fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
        Ok(None)
    }

    fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
        Ok(None)
    }

    fn visit_some<D>(self, de: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        de.deserialize_any(I32SeqVisitor).map(Some)
    }

    fn visit_str<E: serde::de::Error>(self, s: &str) -> Result<Self::Value, E> {
        parse_i32_csv(s).map(Some).map_err(E::custom)
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: serde::de::SeqAccess<'de>,
    {
        let mut out = Vec::new();
        while let Some(v) = seq.next_element::<i32>()? {
            out.push(v);
        }
        Ok(Some(out))
    }
}

/// 见 [`de_i32_list_opt`]。
struct I32SeqVisitor;

impl<'de> serde::de::Visitor<'de> for I32SeqVisitor {
    type Value = Vec<i32>;

    fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("整数或逗号分隔的整数串")
    }

    fn visit_str<E: serde::de::Error>(self, s: &str) -> Result<Self::Value, E> {
        parse_i32_csv(s).map_err(E::custom)
    }

    fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
        i32::try_from(v)
            .map(|v| vec![v])
            .map_err(|_| E::custom("数字超出 i32 范围"))
    }

    fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
        i32::try_from(v)
            .map(|v| vec![v])
            .map_err(|_| E::custom("数字超出 i32 范围"))
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
        A: serde::de::SeqAccess<'de>,
    {
        let mut out = Vec::new();
        while let Some(v) = seq.next_element::<i32>()? {
            out.push(v);
        }
        Ok(out)
    }
}

/// 商品 SKU（对应 Java `ProductSkuDTO`，前台/后台列表与详情共用）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSkuVO {
    pub sku_id: i32,
    pub product_id: i32,
    /// 规格值（前端展示串，如 `红色 XL`）
    pub sku_value: String,
    /// 规格结构（Java `List<SkuData>`；库中 `sku_data` 为 JSON 文本）
    pub sku_data: Option<serde_json::Value>,
    pub sku_sn: Option<String>,
    pub sku_stock: i32,
    pub sku_tsn: Option<String>,
    /// 单件规格重量 kg（v5.8.61）
    pub sku_weight: Option<Decimal>,
    /// 单件规格体积 m³（v5.8.61）
    pub sku_volume: Option<Decimal>,
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

/// 入库入参用 SKU（对应 Java `ProductListAttributeDTO extends ProductSkuDTO`）。
///
/// 与 [`ProductSkuVO`] 的差别：`sku_id` 可空（空 = 新增规格），
/// 并携带 `attrNames` / `attrValues` / `attrs` 三个规格维度字段
/// （Java 侧用于生成 `sku_value` 与 `sku_data`，本切片只回传，不反向推导）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSkuSaveDTO {
    pub sku_id: Option<i32>,
    pub product_id: Option<i32>,
    pub sku_value: Option<String>,
    /// 规格结构（`[{name, value, attrPicThumb}]`，写入 `sku_data` JSON）
    pub sku_data: Option<serde_json::Value>,
    pub sku_sn: Option<String>,
    pub sku_stock: Option<i32>,
    pub sku_tsn: Option<String>,
    /// 单件规格重量，单位 kg；NULL 沿用商品重量（v5.8.61）
    pub sku_weight: Option<Decimal>,
    /// 单件规格体积，单位 m³；NULL 沿用商品体积（v5.8.61）
    pub sku_volume: Option<Decimal>,
    /// Java 侧为 String，前端可能传 `"12.00"`
    pub sku_price: Option<Decimal>,
    pub is_enabled: Option<i32>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub delivery_service_fee_type: Option<i32>,
    pub delivery_service_fee_value: Option<Decimal>,
    pub server_service_fee_type: Option<i32>,
    pub server_service_fee_value: Option<Decimal>,
    pub vendor_product_sku_id: Option<i32>,
    /// 属性名称列表（Java `attrNames`，本切片仅原样接收）
    pub attr_names: Option<Vec<String>>,
    /// 属性值列表（Java `attrValues`）
    pub attr_values: Option<Vec<String>>,
    /// 属性结构（Java `attrs`）
    pub attrs: Option<Vec<SkuAttrDTO>>,
}

/// 规格键值对（对应 Java `ProductListAttributeDTO.Attribute`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkuAttrDTO {
    pub attr_name: Option<String>,
    pub attr_value: Option<String>,
}

/// 商品相册图（对应 Java `model.setting.GalleryPic`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicDTO {
    pub pic_id: Option<i32>,
    pub pic_url: Option<String>,
    pub pic_name: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_sort: Option<i32>,
}

/// 商品属性（库存表行）DTO/VO，对应 Java `ProductAttributeDTO` 与
/// `product_attributes` 表。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAttributeVO {
    pub attributes_id: Option<i32>,
    pub product_id: Option<i32>,
    /// 0 普通属性 1 规格属性 2 附加规格
    pub attr_type: i32,
    pub attr_name: String,
    pub attr_value: String,
    pub attr_price: Option<Decimal>,
    pub attr_color: Option<String>,
    pub attr_pic: Option<String>,
    pub attr_pic_thumb: Option<String>,
    pub sort_order: Option<i32>,
}

/// 按属性名聚合的一组属性（对应 Java `ProductAttrsDTO.Attribute`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAttrGroupVO {
    pub attr_name: String,
    pub attr_list: Vec<ProductAttributeVO>,
}

/// 商品属性整体结构（对应 Java `ProductAttrsDTO`）。
///
/// `normal` = `attr_type=0`，`spe` = `attr_type=1`（规格），
/// `extra` = `attr_type=2`（附加规格）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAttrsVO {
    pub normal: Vec<ProductAttrGroupVO>,
    pub spe: Vec<ProductAttrGroupVO>,
    pub extra: Vec<ProductAttrGroupVO>,
}

/// 商品视频（对应 Java `model.product.ProductVideo`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductVideoVO {
    pub id: Option<i32>,
    pub video_id: Option<i32>,
    pub product_id: Option<i32>,
    pub video_url: Option<String>,
    pub video_cover: Option<String>,
    pub format: Option<String>,
}

/// 图文详情片段（对应 Java `ProductDescDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductDescVO {
    /// `pic` / `video` / `text`
    pub r#type: String,
    pub pic: Option<String>,
    pub html: Option<String>,
    pub cover: Option<String>,
    pub video_url: Option<String>,
}

/// 商品服务（对应 Java `model.product.Services`，即 `product_services` 表）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServicesVO {
    pub product_service_id: i32,
    pub product_service_name: String,
    pub product_service_desc: String,
    pub ico_img: String,
    pub sort_order: i32,
    pub default_on: i32,
    pub shop_id: i32,
}

/// 管理端商品列表项（对应 Java `ProductListResDTO`，字段顺序一致）。
///
/// 末尾若干字段依赖营销/批发/周期购/O2O 域，本切片恒为 `None`
/// （字段保留以保证前端 JSON 结构不变）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductListItemVO {
    pub category_id: i32,
    pub brand_id: i32,
    pub product_tsn: Option<String>,
    pub market_price: Decimal,
    pub shipping_tpl_id: i64,
    pub free_shipping: i32,
    pub product_id: i32,
    pub pic_url: String,
    pub pic_large: String,
    pub pic_thumb: String,
    pub product_brief: String,
    pub product_name: String,
    pub check_status: i32,
    pub check_reason: String,
    pub shop_id: i32,
    pub suppliers_id: Option<i32>,
    pub product_type: Option<i32>,
    pub sale_mode: i32,
    /// 派生：`sale_mode > 0 ? 1 : 0`
    pub product_sale_mode: i32,
    pub product_service_ids: Vec<i32>,
    pub product_sn: String,
    pub product_price: Decimal,
    pub product_status: i32,
    /// v5.8.61 最终可售状态：1 可售，0 禁售。
    pub sale_status: i32,
    /// 当前作用域手动设置：1 可售，0 禁售。
    pub manual_sale_status: i32,
    /// 定时禁售 Unix 秒，0 未启用。
    pub sale_ban_time: i64,
    /// 定时恢复 Unix 秒，0 未启用。
    pub sale_recover_time: i64,
    /// 禁售原因。
    pub sale_reason: Option<String>,
    pub is_best: i32,
    pub is_new: i32,
    pub is_hot: i32,
    pub product_stock: i32,
    pub sort_order: i32,
    pub product_sku: Vec<ProductSkuVO>,
    pub sku_count: i32,
    /// 未迁移：店铺信息（依赖 `shop` 域装配）
    pub shop: Option<serde_json::Value>,
    /// 未迁移：最近门店距离（O2O）
    pub distance: Option<Decimal>,
    /// 未迁移：营销最终价（依赖优惠计算域）
    pub price: Option<Decimal>,
    /// 未迁移：限时折扣标记
    pub is_time_discount: Option<bool>,
    pub vendor_product_id: Option<i32>,
    /// 未迁移：原价字符串（营销域）
    pub org_product_price: Option<String>,
    /// 未迁移：秒杀标记
    pub is_seckill: Option<bool>,
    /// 未迁移：拼团标记
    pub is_groupon: Option<bool>,
    pub is_need_re_import_vendor_product: Option<i32>,
    pub attributes_tpl_id: Option<i32>,
    pub limit_number: i32,
    pub delivery_mode: i32,
    /// 未迁移：礼品卡组类型
    pub group_type: Option<i32>,
    /// 未迁移：周期购标记
    pub is_cycle_product: Option<bool>,
    /// 未迁移：周期购价格
    pub cycle_price: Option<Decimal>,
    /// 未迁移：周期购划线价
    pub cycle_original_price: Option<Decimal>,
    /// 未迁移：周期购规格名
    pub cycle_period_name: Option<String>,
    pub virtual_sales: i32,
    /// 未迁移：次卡交付类型
    pub delivery_type: Option<i32>,
    /// 未迁移：次卡标记
    pub is_card_product: Option<bool>,
    /// 未迁移：兑换总次数
    pub redeem_total_times: Option<i32>,
    /// 未迁移：生效时间描述
    pub effective_type_desc: Option<String>,
    /// 未迁移：有效期描述
    pub validity_desc: Option<String>,
    /// 未迁移：折算单价
    pub unit_price: Option<Decimal>,
    /// 未迁移：首条批发价
    pub first_wholesale_price: Option<Decimal>,
    /// 未迁移：起批数
    pub wholesale_card_moq: Option<i32>,
    /// 未迁移：起批维度
    pub wholesale_moq_dimension: Option<i32>,
    /// 未迁移：倍数购买
    pub wholesale_multiple: Option<i32>,
}

/// 管理端商品详情（对应 Java `ProductDetailDTO`）。
///
/// 依赖预售/O2O 服务费/自动上下架/礼品卡/预约模板的字段本切片不编造，
/// 保持 `None`（`timedOffShelf` 恒为 0）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminProductDetailVO {
    pub product_id: i32,
    pub product_name: String,
    pub seo_identification: Option<String>,
    pub product_sn: String,
    pub product_tsn: Option<String>,
    pub product_stock: i32,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub cost_price: Option<Decimal>,
    pub shipping_tpl_id: i64,
    pub product_status: i32,
    pub product_type: Option<i32>,
    pub sale_mode: i32,
    /// 派生：`sale_mode > 0 ? 1 : 0`
    pub product_sale_mode: i32,
    /// 未迁移：预售信息（依赖 `product_presale` 域）
    pub presale_info: Option<serde_json::Value>,
    pub category_id: i32,
    pub brand_id: i32,
    pub shop_id: i32,
    pub keywords: Option<String>,
    pub shop_category_id: i32,
    pub check_status: i32,
    pub check_reason: String,
    pub click_count: i32,
    pub product_weight: Decimal,
    /// 单件商品体积 m³（v5.8.61）
    pub product_volume: Option<Decimal>,
    pub is_promote: i32,
    pub is_promote_activity: i32,
    pub promote_price: Decimal,
    pub promote_start_date: i32,
    pub promote_end_date: i32,
    pub seckill_max_num: i32,
    pub product_brief: String,
    pub product_desc: Option<String>,
    pub pic_url: String,
    pub pic_thumb: String,
    pub pic_original: String,
    pub pic_large: String,
    pub product_service_ids: Vec<i32>,
    pub free_shipping: i32,
    pub integral: i32,
    pub add_time: i64,
    pub sort_order: i32,
    pub store_sort_order: i32,
    pub is_delete: i32,
    pub is_best: i32,
    pub is_new: i32,
    pub is_hot: i32,
    pub last_update: i32,
    pub remark: String,
    pub give_integral: i32,
    pub rank_integral: i32,
    pub suppliers_id: Option<i32>,
    pub virtual_sales: i32,
    pub limit_number: i32,
    pub product_care: Option<String>,
    pub product_related: Vec<i32>,
    pub is_support_return: i32,
    pub is_support_cod: i32,
    pub product_video: Option<String>,
    pub prepay_price: Option<Decimal>,
    pub product_desc_arr: Vec<ProductDescVO>,
    pub img_list: Vec<ProductGalleryVO>,
    pub product_video_info: Vec<ProductVideoVO>,
    pub product_article_list: Vec<i32>,
    pub attr_list: ProductAttrsVO,
    pub product_list: Vec<ProductSkuVO>,
    pub sku_count: i32,
    /// 规格类型：1 统一规格，2 多规格（Java `resolveSkuType` 派生）
    pub sku_type: i32,
    pub card_group_id: i32,
    pub virtual_sample: Option<String>,
    /// `product.paid_content` 解析后的 JSON（非 JSON 时按原文下发）
    pub paid_content: Option<serde_json::Value>,
    pub no_shipping: Option<i32>,
    pub fixed_shipping_type: Option<i32>,
    pub fixed_shipping_fee: Option<Decimal>,
    pub is_shop_pickup: i32,
    /// 未迁移：到店自提模板（依赖 O2O）
    pub shop_pickup_tpl: Option<serde_json::Value>,
    pub vendor_product_id: Option<i32>,
    pub vendor_id: Option<i32>,
    pub is_logistics: i32,
    pub is_shop_delivery: i32,
    pub reservation_tpl_id: Option<i32>,
    /// 未迁移：预约时间段（依赖预约域）
    pub reservation_times: Vec<serde_json::Value>,
    pub gift_card_groups_id: Option<i32>,
    pub product_unit: Option<String>,
    pub attributes_tpl_id: Option<i32>,
    /// 未迁移：自动上下架（依赖 `product_auto_status` 任务域）
    pub auto_online_time: Option<String>,
    pub auto_offline_time: Option<String>,
    pub auto_online_task_id: Option<i32>,
    pub auto_offline_task_id: Option<i32>,
    pub auto_online_task_status: Option<i32>,
    pub auto_offline_task_status: Option<i32>,
    pub auto_task_error_msg: Option<String>,
    /// 未迁移：定时上下架开关，恒为 0
    pub timed_off_shelf: i32,
    pub delivery_mode: i32,
    /// 未迁移：O2O 服务费上下文（依赖配置域）
    pub delivery_service_fee_enabled: Option<i32>,
    pub server_service_fee_enabled: Option<i32>,
    pub store_assign_delivery_service_fee: Option<i32>,
    pub store_assign_server_service_fee: Option<i32>,
    pub delivery_fee_editable: Option<bool>,
    pub server_fee_editable: Option<bool>,
    pub platform_delivery_service_fee_type: Option<i32>,
    pub platform_delivery_service_fee_value: Option<Decimal>,
    pub platform_server_service_fee_type: Option<i32>,
    pub platform_server_service_fee_value: Option<Decimal>,
    pub store_delivery_service_fee_type: Option<i32>,
    pub store_delivery_service_fee_value: Option<Decimal>,
    pub store_server_service_fee_type: Option<i32>,
    pub store_server_service_fee_value: Option<Decimal>,
}

/// 管理端详情里的相册项（对应 Java `model.product.ProductGallery`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGalleryVO {
    pub pic_id: i32,
    pub product_id: i32,
    pub pic_url: String,
    pub pic_desc: String,
    pub pic_thumb: String,
    pub pic_original: String,
    pub pic_large: String,
    pub sort_order: i32,
    pub shop_id: i64,
}

// ————————————————————— 管理端：创建 / 更新 —————————————————————

/// 商品创建 / 更新入参（对应 Java `ProductSaveParam`；
/// `ProductEditParam` 为其空子类，共用本结构）。
///
/// 只包含本切片**会落库**的字段；Java 中其余字段（`presaleConfig` /
/// `suppliersList` / `activityInfo` / `reservationTimes` 等，多为出参或
/// 依赖其它域）未纳入，见 services 层未迁移说明。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductSaveDTO {
    pub product_id: Option<i32>,
    pub product_type: Option<i32>,
    pub sale_mode: Option<i32>,
    pub delivery_mode: Option<i32>,
    pub product_stock: Option<i32>,
    pub free_shipping: Option<i32>,
    pub shop_category_id: Option<i32>,
    pub product_status: Option<i32>,
    pub give_integral: Option<i32>,
    pub rank_integral: Option<i32>,
    pub integral: Option<i32>,
    pub product_weight: Option<Decimal>,
    /// 单件商品体积，单位 m³（v5.8.61）
    pub product_volume: Option<Decimal>,
    /// 商品描述片段（Java `productDescArr`，服务端拼成 `product_desc` HTML）
    pub product_desc_arr: Option<Vec<ProductDescVO>>,
    pub product_related: Option<Vec<i32>>,
    pub product_service_ids: Option<Vec<i32>>,
    pub product_name: Option<String>,
    pub seo_identification: Option<String>,
    pub product_sn: Option<String>,
    pub product_tsn: Option<String>,
    pub product_price: Option<Decimal>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub shipping_tpl_id: Option<i64>,
    pub category_id: Option<i32>,
    pub brand_id: Option<i32>,
    pub shop_id: Option<i32>,
    pub keywords: Option<String>,
    pub check_status: Option<i32>,
    pub check_reason: Option<String>,
    pub click_count: Option<i32>,
    pub is_promote: Option<bool>,
    pub is_promote_activity: Option<bool>,
    pub promote_price: Option<Decimal>,
    /// Java 为 `String`（`yyyy-MM-dd HH:mm:ss`），库中为秒级时间戳
    pub promote_start_date: Option<String>,
    pub promote_end_date: Option<String>,
    pub seckill_max_num: Option<i32>,
    pub product_brief: Option<String>,
    pub product_desc: Option<String>,
    pub pic_url: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_original: Option<String>,
    pub comment_tag: Option<String>,
    /// Java 为 `String`，库中为秒级时间戳（本切片不写入，仅原样忽略）
    pub add_time: Option<String>,
    pub sort_order: Option<i32>,
    pub store_sort_order: Option<i32>,
    pub is_delete: Option<i32>,
    pub is_best: Option<i32>,
    pub is_new: Option<i32>,
    pub is_hot: Option<i32>,
    pub fixed_shipping_type: Option<i32>,
    pub fixed_shipping_fee: Option<Decimal>,
    pub remark: Option<String>,
    pub suppliers_id: Option<i32>,
    pub virtual_sales: Option<i32>,
    pub limit_number: Option<i32>,
    pub product_care: Option<String>,
    pub is_support_return: Option<i32>,
    pub is_support_cod: Option<i32>,
    pub product_video: Option<String>,
    pub prepay_price: Option<Decimal>,
    pub card_group_id: Option<i32>,
    pub virtual_sample: Option<String>,
    /// 付费内容（Java `JSONArray`，落库为 JSON 文本）
    pub paid_content: Option<serde_json::Value>,
    pub no_shipping: Option<i32>,
    /// 图片列表（Java `@NotEmpty`，服务层校验非空）
    pub img_list: Option<Vec<GalleryPicDTO>>,
    pub product_video_info: Option<Vec<ProductVideoVO>>,
    pub product_article_list: Option<Vec<i32>>,
    /// 属性模板数据（普通/规格/附加）
    pub attr_list: Option<ProductAttrsVO>,
    /// SKU 列表；为空数组 = 单规格（Java 会删除已有启用规格）
    pub product_list: Option<Vec<ProductSkuSaveDTO>>,
    /// 规格类型：1 统一规格 2 多规格
    pub sku_type: Option<i32>,
    pub is_shop_pickup: Option<i32>,
    pub is_logistics: Option<i32>,
    pub is_shop_delivery: Option<i32>,
    pub shop_pickup_tpl_id: Option<i64>,
    pub reservation_tpl_id: Option<i32>,
    pub gift_card_groups_id: Option<i32>,
    pub product_unit: Option<String>,
    pub attributes_tpl_id: Option<i32>,
    pub delivery_service_fee_type: Option<i32>,
    pub delivery_service_fee_value: Option<Decimal>,
    pub server_service_fee_type: Option<i32>,
    pub server_service_fee_value: Option<Decimal>,
    /// 自动上架时间（依赖任务域，本切片只接收不落库）
    pub auto_online_time: Option<String>,
    /// 自动下架时间（同上）
    pub auto_offline_time: Option<String>,
}

/// 删除商品入参（对应原 Java 前端 `{id}` / `{productId}` 提交）。
///
/// **不确定点**：契约中 `/adminapi/product/product/del` 在现存 Java 源码里
/// 找不到对应方法（`ProductController` 只有 `/batch`、`/recycle`），
/// 见切片返回值的 `uncertain_points`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductDelDTO {
    pub id: Option<i32>,
    pub product_id: Option<i32>,
    pub ids: Option<Vec<i32>>,
}

impl ProductDelDTO {
    /// 归一化出待删除的 ID 列表。
    #[must_use]
    pub fn target_ids(&self) -> Vec<i32> {
        if let Some(id) = self.id.or(self.product_id) {
            return vec![id];
        }
        self.ids.clone().unwrap_or_default()
    }
}

/// 分类 + 品牌下拉数据（`GET /adminapi/product/product/catAndBrandList`）。
///
/// **不确定点**：该方法在现存 Java 源码中不存在（全仓 grep 无
/// `catAndBrandList`），字段按「商品编辑表单所需的下拉数据」推断，
/// 见返回值 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CatAndBrandVO {
    pub cat_list: Vec<CategoryOptionVO>,
    pub brand_list: Vec<BrandOptionVO>,
}

/// 分类下拉项。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryOptionVO {
    pub category_id: i32,
    pub category_name: String,
    pub parent_id: i32,
    pub sort_order: i32,
    pub is_show: i32,
}

/// 品牌下拉项。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandOptionVO {
    pub brand_id: i32,
    pub brand_name: String,
    pub brand_logo: Option<String>,
    pub first_word: Option<String>,
    pub sort_order: i32,
    pub is_show: i32,
}

// ————————————————————— 管理端：批量操作 —————————————————————

/// 商品批量修改入参（对应 Java `ProductBatchEditDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductBatchEditDTO {
    pub edit_items: Option<Vec<ProductBatchEditItem>>,
}

/// 批量修改单行（对应 Java `ProductBatchEditDTO.EditItem`）。
///
/// 注意：Java `buildProducts()` **没有**使用 `costPrice`
/// （见 `ProductBatchEditDTO.java:76-101`），本切片保持一致（忽略该字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductBatchEditItem {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub category_id: Option<i32>,
    pub brand_id: Option<i32>,
    pub product_sn: Option<String>,
    pub product_tsn: Option<String>,
    pub product_price: Option<Decimal>,
    pub market_price: Option<Decimal>,
    pub cost_price: Option<Decimal>,
    pub shipping_tpl_id: Option<i64>,
    pub free_shipping: Option<i32>,
    pub is_new: Option<i32>,
    pub is_best: Option<i32>,
    pub is_hot: Option<i32>,
    pub sort_order: Option<i32>,
    pub product_status: Option<i32>,
    pub product_service_ids: Option<Vec<i32>>,
}

/// 商品导入结果（对应 Java `ProductBatchModifyVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductBatchModifyVO {
    /// 新增数量
    pub add_num: i32,
    /// 更新数量
    pub update_num: i32,
    /// 失败数量
    pub fail_num: i32,
    /// 错误信息
    pub error_msg: Option<String>,
    /// 导入失败明细（行号 + 原因）
    pub error_list: Vec<String>,
}

// ————————————————————— 前台：商品详情 —————————————————————

/// 前台商品详情（对应 Java `ProductDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientProductDetailVO {
    pub shop_id: i32,
    pub item: ClientProductInfoVO,
    pub desc_arr: Vec<ProductDescVO>,
    pub sku_list: Vec<ProductSkuVO>,
    pub pic_list: Vec<ProductGalleryVO>,
    pub video_list: Vec<ProductVideoVO>,
    pub attr_list: ProductAttrsVO,
    /// 未迁移：评论统计（依赖 `comment` 服务与开关配置）
    pub rank_detail: Option<serde_json::Value>,
    /// 未迁移：秒杀详情（依赖 `seckill` 域装配）
    pub seckill_detail: Vec<serde_json::Value>,
    /// 未迁移：拼团详情（依赖拼团域）
    pub groupon_detail: Option<serde_json::Value>,
    pub service_list: Vec<ServicesVO>,
    /// 未迁移：默认勾选属性（依赖 SKU 规格解析）
    pub checked_value: Vec<String>,
    /// 未迁移：咨询总数（依赖反馈域）
    pub consultation_total: Option<i32>,
    /// 未迁移：积分兑换信息（依赖积分域）
    pub exchange_info: Option<serde_json::Value>,
    pub delivery_mode: i32,
    /// 派生：`delivery_mode == 2` 时 `周期购`，否则 `普通商品`
    pub delivery_mode_text: String,
    /// 未迁移：批发阶梯价（依赖批发域）
    pub wholesale_price_list: Option<serde_json::Value>,
    /// 未迁移：批发定价模式（依赖批发域）
    pub wholesale_price_mode: Option<i32>,
}

/// 前台商品详情主体（对应 Java `ProductInfoDTO`，按商品主表可提供的字段下发）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientProductInfoVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_tsn: Option<String>,
    pub seo_identification: Option<String>,
    pub product_stock: i32,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub cost_price: Option<Decimal>,
    pub product_brief: String,
    pub product_desc: Option<String>,
    pub pic_url: String,
    pub pic_thumb: String,
    pub pic_original: String,
    pub pic_large: String,
    pub keywords: Option<String>,
    pub category_id: i32,
    pub brand_id: i32,
    pub shop_id: i32,
    pub product_status: i32,
    pub product_type: Option<i32>,
    pub sale_mode: i32,
    /// 派生：`sale_mode > 0 ? 1 : 0`
    pub product_sale_mode: i32,
    pub delivery_mode: i32,
    pub free_shipping: i32,
    pub fixed_shipping_type: Option<i32>,
    pub fixed_shipping_fee: Option<Decimal>,
    pub no_shipping: Option<i32>,
    pub integral: i32,
    pub give_integral: i32,
    pub rank_integral: i32,
    pub virtual_sales: i32,
    pub limit_number: i32,
    pub product_weight: Decimal,
    /// 单件商品体积 m³（v5.8.61）
    pub product_volume: Option<Decimal>,
    pub product_unit: Option<String>,
    pub product_care: Option<String>,
    pub product_service_ids: Vec<i32>,
    pub is_support_return: i32,
    pub is_support_cod: i32,
    pub is_best: i32,
    pub is_new: i32,
    pub is_hot: i32,
    pub add_time: i32,
    pub click_count: i32,
    pub is_delete: i32,
    pub card_group_id: i32,
    pub virtual_sample: Option<String>,
    pub paid_content: Option<serde_json::Value>,
    pub prepay_price: Option<Decimal>,
    pub card_product: Option<i32>,
    /// 未迁移：预售信息（依赖预售域）
    pub presale_info: Option<serde_json::Value>,
    /// 未迁移：销售模式文案
    pub sale_mode_text: Option<String>,
    /// 未迁移：是否参与分销
    pub is_distribution: Option<bool>,
}

// ————————————————————— 分页 —————————————————————

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_csv_parsing_matches_java_guard() {
        // 合法：数字与逗号
        let q = AdminProductListQuery {
            ids: Some("3,1,2".into()),
            ..Default::default()
        };
        assert_eq!(q.parsed_ids().unwrap(), Some(vec![3, 1, 2]));

        // 非法字符（Java `^[0-9,]+$` 不通过）
        let q = AdminProductListQuery {
            ids: Some("1;drop table product".into()),
            ..Default::default()
        };
        assert_eq!(q.parsed_ids().unwrap_err(), "非法的 ids 参数");

        // 全空（如 ",,"）
        let q = AdminProductListQuery {
            ids: Some(",,".into()),
            ..Default::default()
        };
        assert_eq!(q.parsed_ids().unwrap_err(), "ids 参数为空");

        // 未传
        let q = AdminProductListQuery::default();
        assert_eq!(q.parsed_ids().unwrap(), None);
    }

    #[test]
    fn list_query_accepts_size_and_page_size() {
        let q: AdminProductListQuery =
            serde_json::from_str(r#"{"keyword":"苹果","page":2,"size":30}"#).unwrap();
        assert_eq!(q.keyword.as_deref(), Some("苹果"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));

        let q2: AdminProductListQuery = serde_json::from_str(r#"{"pageSize":50}"#).unwrap();
        assert_eq!(q2.page_size, Some(50));
    }

    #[test]
    fn i32_list_accepts_comma_string_array_and_single() {
        // Spring 习惯：逗号分隔
        let q: AdminProductListQuery = serde_json::from_str(r#"{"productTypes":"1,2,5"}"#).unwrap();
        assert_eq!(q.product_types, Some(vec![1, 2, 5]));

        // 数组（重复键表单 / JSON 数组）
        let q: AdminProductListQuery =
            serde_json::from_str(r#"{"excludeProductTypes":[5,6]}"#).unwrap();
        assert_eq!(q.exclude_product_types, Some(vec![5, 6]));

        // 单个数字
        let q: AdminProductListQuery = serde_json::from_str(r#"{"idList":7}"#).unwrap();
        assert_eq!(q.id_list, Some(vec![7]));

        // 缺省 / null
        let q: AdminProductListQuery = serde_json::from_str(r#"{"idList":null}"#).unwrap();
        assert_eq!(q.id_list, None);
        let q: AdminProductListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.extra_product_ids, None);

        // 非法内容报错，不静默丢弃
        assert!(serde_json::from_str::<AdminProductListQuery>(r#"{"productTypes":"a"}"#).is_err());
    }

    #[test]
    fn parse_i32_csv_ignores_blank_segments() {
        assert_eq!(parse_i32_csv(" 1 , 2 ,, 3 ").unwrap(), vec![1, 2, 3]);
        assert_eq!(parse_i32_csv("").unwrap(), Vec::<i32>::new());
        assert!(parse_i32_csv("1,x").is_err());
    }

    #[test]
    fn list_query_defaults_page() {
        let q = AdminProductListQuery::default();
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 20);
    }

    #[test]
    fn list_item_serializes_camel_case_with_null_placeholders() {
        let vo = ProductListItemVO {
            product_id: 7,
            product_name: "测试商品".into(),
            product_price: Decimal::new(1999, 2),
            sale_mode: 0,
            product_sale_mode: 0,
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["productId"], 7);
        assert_eq!(json["productSaleMode"], 0);
        // 依赖其它域的字段保留为 null，前端结构不变
        assert!(json.get("isSeckill").is_some());
        assert!(json["isSeckill"].is_null());
        // 金额按字符串下发（rust_decimal serde-with-str）
        assert!(json["productPrice"].is_string() || json["productPrice"].is_number());
    }

    #[test]
    fn del_dto_normalizes_target_ids() {
        let d: ProductDelDTO = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(d.target_ids(), vec![5]);

        let d: ProductDelDTO = serde_json::from_str(r#"{"productId":6}"#).unwrap();
        assert_eq!(d.target_ids(), vec![6]);

        let d: ProductDelDTO = serde_json::from_str(r#"{"ids":[1,2,3]}"#).unwrap();
        assert_eq!(d.target_ids(), vec![1, 2, 3]);

        let d = ProductDelDTO::default();
        assert!(d.target_ids().is_empty());
    }

    #[test]
    fn sku_save_dto_parses_front_end_shape() {
        // 前端 skuPrice 可能传字符串
        let dto: ProductSkuSaveDTO = serde_json::from_str(
            r#"{"skuId":3,"skuValue":"红色","skuPrice":"19.90","skuStock":5,
                "isEnabled":1,"attrNames":["颜色"],"attrValues":["红色"],
                "attrs":[{"attrName":"颜色","attrValue":"红色"}]}"#,
        )
        .unwrap();
        assert_eq!(dto.sku_id, Some(3));
        assert_eq!(dto.sku_price, Some(Decimal::new(1990, 2)));
        assert_eq!(dto.sku_stock, Some(5));
        assert_eq!(dto.attrs.unwrap()[0].attr_name.as_deref(), Some("颜色"));
    }

    #[test]
    fn batch_edit_dto_parses_items() {
        let dto: ProductBatchEditDTO = serde_json::from_str(
            r#"{"editItems":[{"productId":1,"productName":"A","productSn":"SN1",
                "productPrice":"9.90","productServiceIds":[1,2]}]}"#,
        )
        .unwrap();
        let items = dto.edit_items.unwrap();
        assert_eq!(items[0].product_id, Some(1));
        assert_eq!(items[0].product_price, Some(Decimal::new(990, 2)));
        assert_eq!(items[0].product_service_ids.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn product_save_dto_parses_desc_arr_and_sku_list() {
        let dto: ProductSaveDTO = serde_json::from_str(
            r#"{"productName":"N","productPrice":"1.00","imgList":[{"picUrl":"a.jpg"}],
                "productDescArr":[{"type":"pic","pic":"a.jpg"},{"type":"text","html":"<p>x</p>"}],
                "productList":[{"skuId":1,"skuStock":2}],
                "attrList":{"normal":[],"spe":[{"attrName":"颜色","attrList":[{"attrType":1,"attrName":"颜色","attrValue":"红"}]}]}}"#,
        )
        .unwrap();
        assert_eq!(
            dto.img_list.as_ref().unwrap()[0].pic_url.as_deref(),
            Some("a.jpg")
        );
        assert_eq!(dto.product_desc_arr.as_ref().unwrap().len(), 2);
        assert_eq!(dto.product_list.as_ref().unwrap().len(), 1);
        let spe = dto.attr_list.unwrap().spe;
        assert_eq!(spe[0].attr_name, "颜色");
        assert_eq!(spe[0].attr_list[0].attr_value, "红");
    }
}
