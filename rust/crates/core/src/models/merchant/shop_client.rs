//! 店铺域前台（merchant::shop_client）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.shop.ShopClientController`
//!   （`@RequestMapping("/api/shop/shop")`，本切片 10 个端点）
//! - `com.tigshop.bean.dto.shop.ShopListDTO` / `CollectCreateDTO` / `StoreExtendedDto`
//! - `com.tigshop.bean.query.shop.PickupPageQuery` / `StorePageQuery` / `StoreDetailQuery`
//! - `com.tigshop.bean.query.product.CommentListPageQuery`
//! - `com.tigshop.bean.vo.shop.ClientShopVO` / `ClientShopDetailVO`
//! - `com.tigshop.bean.vo.o2o.StoreListVO` / `StoreDetailVO` / `PickupListVO`
//! - `com.tigshop.bean.vo.product.CommentVO`（含 `ReplyVO` / `ShowPic`）
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//! 分页入参沿用 Java `BasePage` 语义：`page` 缺省 1，`size` 缺省 15、上限 100。
//!
//! **`/api/shop/shop/decorate` 的返回体**未在此定义：Java 直接回吐
//! `decorate.data` 的 JSON 并追加 `decorateId`（`JSONObject`），
//! Rust 侧用 `serde_json::Value` 表达，避免复刻 `DecorateVO` 造成漂移。

use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer, Serialize};

use crate::types::PageQuery;

// ————————————————————— 查询参数 —————————————————————

/// 前台店铺列表查询（Java `ShopListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientShopListQuery {
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub size: Option<u64>,
    pub keyword: Option<String>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    /// 每店返回的上架商品数（Java `productNumber`，缺省 5，负数按 0）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub product_number: Option<i32>,
    /// C 端是否排除平台自营门店：`1`/不传=排除，`0`=纳入（Java 默认排除）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub exclude_self_operated: Option<i32>,
}

impl ClientShopListQuery {
    /// 分页参数（对齐 Java `BasePage#getPage` / `getSize`：缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// `productLimit = Integer.max(productNumber or 5, 0)`。
    #[must_use]
    pub fn product_limit(&self) -> i32 {
        self.product_number.unwrap_or(5).max(0)
    }
}

/// 店铺收藏参数（Java `CollectCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CollectShopParam {
    pub shop_id: i32,
}

/// 店铺收藏结果（Java 原接口返回 `void`，此处回传切换后的状态便于前端联动）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectShopResultVO {
    /// `true`=本次为收藏，`false`=本次为取消收藏
    pub collected: bool,
}

/// 仅需店铺 ID 的查询（Java `@RequestParam("shopId") Integer shopId`，必填）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopIdQuery {
    pub shop_id: i32,
}

/// 店铺装修查询（Java `shopDecorate(shopId, previewId)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopDecorateQuery {
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub shop_id: Option<i32>,
    /// 预览态：直接按 `decorate_id` 取（此时忽略 `shopId`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub preview_id: Option<i32>,
}

/// 店铺关联自提点分页查询（Java `PickupPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupListQuery {
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub size: Option<u64>,
    pub keyword: Option<String>,
    pub region_id: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub shop_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub longitude: Option<Decimal>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub latitude: Option<Decimal>,
}

impl PickupListQuery {
    /// 分页参数（Java `BasePage` 缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }
}

/// 门店列表查询（Java `StorePageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StoreListQuery {
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub size: Option<u64>,
    pub keyword: Option<String>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub region_id: Option<String>,
    /// o2o-pc 模式下的门店查询（有值时覆盖 `regionId`）
    pub store_region_id: Option<String>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub longitude: Option<Decimal>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub latitude: Option<Decimal>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub product_id: Option<i32>,
    #[serde(default, deserialize_with = "de_csv_i32")]
    pub shop_ids: Vec<i32>,
    /// 选中门店：非过滤条件，仅置顶并标记 `selected`
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub selected_shop_id: Option<i32>,
    /// 传 1 且带有效经纬度时，仅返回落在同城配送半径内的门店
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub within_delivery_range: Option<i32>,
    /// 配送类型多选（1 自提 / 2 上门 / 3 预约到店 / 4 同城配送 / 5 快递）
    #[serde(default, deserialize_with = "de_csv_i32")]
    pub delivery_types: Vec<i32>,
    /// `1`/不传=排除平台自营门店，`0`=纳入
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub exclude_self_operated: Option<i32>,
}

impl StoreListQuery {
    /// 分页参数（Java `BasePage` 缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// `regionId`：`storeRegionId` 非空时覆盖原值。
    #[must_use]
    pub fn effective_region_id(&self) -> Option<&str> {
        match self.store_region_id.as_deref().filter(|s| !s.is_empty()) {
            Some(v) => Some(v),
            None => self.region_id.as_deref().filter(|s| !s.is_empty()),
        }
    }
}

/// 门店详情查询（Java `StoreDetailQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StoreDetailQuery {
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub shop_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub longitude: Option<Decimal>,
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub latitude: Option<Decimal>,
    #[serde(default, deserialize_with = "de_csv_i32")]
    pub delivery_types: Vec<i32>,
}

/// 店铺评论列表查询（Java `getCommentList(page, type, shopId)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopCommentListQuery {
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    #[serde(rename = "type", default, deserialize_with = "de_opt_i32")]
    pub r#type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub shop_id: Option<i32>,
}

impl ShopCommentListQuery {
    /// Java 控制器固定 `size = 10`。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: 10,
        }
    }
}

/// 兼容 Spring MVC 的空值绑定：`?id=` 视为未传（`None`）而不是 400。
macro_rules! opt_num_de {
    ($fn_name:ident, $ty:ty) => {
        fn $fn_name<'de, D>(de: D) -> Result<Option<$ty>, D::Error>
        where
            D: Deserializer<'de>,
        {
            struct V;

            impl<'de> serde::de::Visitor<'de> for V {
                type Value = Option<$ty>;

                fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                    f.write_str("数字或数字字符串（空串视为未传）")
                }

                fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                    Ok(None)
                }

                fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                    Ok(None)
                }

                fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
                    let t = v.trim();
                    if t.is_empty() {
                        return Ok(None);
                    }
                    t.parse::<$ty>().map(Some).map_err(serde::de::Error::custom)
                }
            }

            de.deserialize_any(V)
        }
    };
}

opt_num_de!(de_opt_i32, i32);
opt_num_de!(de_opt_u64, u64);
opt_num_de!(de_opt_dec, Decimal);

/// 兼容 Spring MVC 的 `List<Integer>` 绑定：同时接受
/// `k=1&k=2`（重复键）与 `k=1,2`（逗号分隔）两种形式，非法项按 0 忽略。
fn de_csv_i32<'de, D>(de: D) -> Result<Vec<i32>, D::Error>
where
    D: Deserializer<'de>,
{
    struct V;

    impl<'de> serde::de::Visitor<'de> for V {
        type Value = Vec<i32>;

        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("整数、逗号分隔的整数串或整数数组")
        }

        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            Ok(split_ints(v))
        }

        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let mut out = Vec::new();
            while let Some(item) = seq.next_element::<String>()? {
                out.extend(split_ints(&item));
            }
            Ok(out)
        }
    }

    de.deserialize_any(V)
}

/// `"1, 2 ,3"` → `[1, 2, 3]`（空串/非数字项跳过）。
#[must_use]
pub fn split_ints(raw: &str) -> Vec<i32> {
    raw.split(',')
        .filter_map(|s| s.trim().parse::<i32>().ok())
        .collect()
}

// ————————————————————— 门店扩展字段（Java `StoreExtendedDto`） —————————————————————

/// 门店联系方式（Java `StoreExtendedDto.ShopContactConfig`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopContactConfigVO {
    /// 1 = 普通座机号 2 = 企业座机号 3 = 手机号码
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    /// 号码，`-` 前为区号
    pub values: Option<String>,
}

/// 营业时间段（Java `StoreExtendedDto.TimeRangeStartEnd`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopTimeRangeStartEndVO {
    pub start: Option<String>,
    pub end: Option<String>,
}

/// 营业时间（Java `StoreExtendedDto.ShopOpenCloseConfig.TimeRange`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopTimeRangeVO {
    pub start: Option<String>,
    pub end: Option<String>,
    /// 1=周一 … 7=周日（type=3 时有值）
    pub day_of_week: Option<String>,
    pub ranges: Option<Vec<ShopTimeRangeStartEndVO>>,
}

/// 营业时间配置（Java `StoreExtendedDto.ShopOpenCloseConfig`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopOpenCloseConfigVO {
    /// 1 = 全天 2 = 每日固定时间 3 = 按星期时间
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub times: Option<Vec<ShopTimeRangeVO>>,
}

// ————————————————————— 店铺 VO —————————————————————

/// 前台店铺列表项（Java `ClientShopVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientShopVO {
    pub status_text: Option<String>,
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    pub shop_logo: Option<String>,
    pub click_count: Option<i32>,
    pub status: Option<i32>,
    pub merchant_id: Option<i32>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub contact_mobile: Option<String>,
    pub description: Option<String>,
    pub kefu_phone: Option<String>,
    pub kefu_weixin: Option<String>,
    pub kefu_link: Option<String>,
    pub is_contact_kefu: Option<i32>,
    pub kefu_inlet: Option<String>,
    /// 收藏人数（`COUNT(DISTINCT user_id)`）
    pub collect_count: Option<i64>,
    /// 上架商品数（含平台分配到门店的商品）
    pub listing_count: Option<i64>,
    /// 上架商品预览（原样返回 `product` 行）
    pub listing_product: Option<Vec<crate::entities::Product>>,
    /// 评星：评价数 < 100 固定 4.8，否则取 `shop_star`
    pub shop_star: Option<Decimal>,
    /// 商品评分（`AVG(comment_rank)`）
    pub product_score: Option<Decimal>,
    pub shop_type: Option<i32>,
    pub shop_detailed_address: Option<String>,
    pub shop_longitude: Option<Decimal>,
    pub shop_latitude: Option<Decimal>,
    pub shop_region_names: Option<Vec<String>>,
    pub tip_names: Option<Vec<String>>,
    pub contact_configs: Option<Vec<ShopContactConfigVO>>,
    pub shop_open_close_config: Option<ShopOpenCloseConfigVO>,
}

/// 前台店铺详情内的商家信息（Java `ClientShopDetailVO.Merchant`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientShopMerchantVO {
    pub type_text: Option<String>,
    pub status_text: Option<String>,
    pub merchant_id: Option<i32>,
    pub merchant_apply_id: Option<i32>,
    pub user_id: Option<i32>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    pub merchant_data: Option<serde_json::Value>,
    pub status: Option<i32>,
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub company_name: Option<String>,
    pub corporate_name: Option<String>,
    pub settlement_cycle: Option<i32>,
}

/// 前台店铺详情（Java `ClientShopDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientShopDetailVO {
    pub status_text: Option<String>,
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    pub shop_logo: Option<String>,
    pub click_count: Option<i32>,
    pub status: Option<i32>,
    pub merchant_id: Option<i32>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub contact_mobile: Option<String>,
    pub description: Option<String>,
    pub kefu_phone: Option<String>,
    pub kefu_weixin: Option<String>,
    pub kefu_link: Option<String>,
    pub is_contact_kefu: Option<i32>,
    pub kefu_inlet: Option<String>,
    pub collect_count: Option<i64>,
    pub listing_count: Option<i64>,
    pub listing_product: Option<Vec<crate::entities::Product>>,
    pub merchant: Option<ClientShopMerchantVO>,
    /// 商品总数（店铺自建 + 平台分配门店商品）
    pub product_count: Option<i64>,
    /// 新品数量
    pub new_product_count: Option<i64>,
    pub collect_shop: Option<bool>,
    pub product_score: Option<Decimal>,
    pub shop_star: Option<Decimal>,
    /// 审核通过或平台录入的营业执照图，无资料时为空串
    pub business_license_pic: Option<String>,
}

// ————————————————————— O2O 门店 / 自提点 VO —————————————————————

/// 门店列表项（Java `StoreListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StoreListVO {
    pub shop_id: Option<i32>,
    pub shop_logo: Option<String>,
    pub shop_title: Option<String>,
    pub status: Option<i32>,
    pub address: Option<String>,
    pub has_coupon: Option<i32>,
    pub tip_names: Option<Vec<String>>,
    /// 距离（米）
    pub distance: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub latitude: Option<Decimal>,
    pub contact_configs: Option<Vec<ShopContactConfigVO>>,
    pub shop_star: Option<Decimal>,
    pub shop_star_num: Option<i32>,
    pub shop_sales: Option<i32>,
    pub description: Option<String>,
    pub shop_collect: Option<i64>,
    pub collect_shop: Option<bool>,
    pub selected: Option<bool>,
    pub in_home_service_range: bool,
    pub in_local_delivery_range: bool,
    pub shop_open_close_config: Option<ShopOpenCloseConfigVO>,
    /// 联系方式原始 JSON（Java `@JsonIgnore`，不参与序列化）
    #[serde(skip)]
    pub contact_json: Option<String>,
    /// 营业时间原始 JSON（Java `@JsonIgnore`，不参与序列化）
    #[serde(skip)]
    pub open_close_json: Option<String>,
}

/// 门店详情（Java `StoreDetailVO extends StoreExtendedDto`）。
///
/// 注意：Java `BeanUtils.copyProperties(shop, vo)` 只复制**同名且类型兼容**的字段，
/// 因此 `shopRegionIds`（String → List）/`shopShowPicture`/`shopTips` 均为 `null`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StoreDetailVO {
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub shop_star: Option<Decimal>,
    pub shop_star_num: Option<i32>,
    pub shop_sales: Option<i32>,
    pub tip_names: Option<Vec<String>>,
    pub collect_shop: Option<bool>,
    /// 距离（米），Java 为 `String`
    pub distance: Option<String>,
    pub in_home_service_range: bool,
    pub in_local_delivery_range: bool,
    pub business_license_pic: Option<String>,
    // ——— `StoreExtendedDto` ———
    pub shop_type: Option<i32>,
    pub store_parent_id: Option<i32>,
    pub shop_cover_picture: Option<String>,
    pub shop_show_picture: Option<Vec<serde_json::Value>>,
    pub description: Option<String>,
    pub status: Option<i32>,
    pub shop_contact_config: Option<Vec<ShopContactConfigVO>>,
    pub shop_open_close_config: Option<ShopOpenCloseConfigVO>,
    pub shop_region_ids: Option<Vec<i32>>,
    pub shop_region_names: Option<Vec<String>>,
    pub shop_detailed_address: Option<String>,
    pub shop_longitude: Option<Decimal>,
    pub shop_latitude: Option<Decimal>,
    pub shop_tips: Option<Vec<i32>>,
}

/// 自提点列表项 / 详情（Java `PickupListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupListVO {
    pub shop_id: Option<i32>,
    pub shop_title: Option<String>,
    /// 距离（米）
    pub distance: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub latitude: Option<Decimal>,
    pub contact_configs: Option<Vec<ShopContactConfigVO>>,
    pub shop_open_close_config: Option<ShopOpenCloseConfigVO>,
    pub shop_region_ids: Option<Vec<i32>>,
    pub shop_region_names: Option<Vec<String>>,
    pub address: Option<String>,
}

// ————————————————————— 评价 VO —————————————————————

/// 评价回复（Java `CommentVO.ReplyVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentReplyVO {
    pub comment_id: Option<i32>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub is_anonymous: Option<i32>,
    pub content: Option<String>,
    pub parent_id: Option<i32>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
}

/// 评价晒图（Java `CommentVO.ShowPic`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentShowPicVO {
    pub pic_id: Option<i32>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub pic_name: Option<String>,
    pub storage_url: Option<String>,
    pub errcode: Option<i32>,
    pub message: Option<String>,
}

/// 评价（Java `CommentVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentVO {
    pub comment_id: Option<i32>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub is_anonymous: Option<i32>,
    pub avatar: Option<String>,
    pub product_id: Option<i32>,
    pub order_id: Option<i32>,
    pub order_item_id: Option<i32>,
    pub comment_rank: Option<i32>,
    pub content: Option<String>,
    pub status: Option<i32>,
    pub parent_id: Option<i32>,
    pub usefull: Option<i32>,
    pub useless: Option<i32>,
    pub is_recommend: Option<i32>,
    pub is_top: Option<i32>,
    pub is_showed: Option<i32>,
    pub is_default: Option<i32>,
    pub sort_order: Option<i32>,
    pub shop_id: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub pic_thumb: Option<String>,
    pub replies: Option<Vec<CommentReplyVO>>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    pub comment_tag: Option<Vec<String>>,
    pub show_pics: Option<Vec<CommentShowPicVO>>,
    pub kefu_name: Option<String>,
    pub sku_id: Option<i32>,
    pub sku_data: Option<Vec<serde_json::Value>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_ints_tolerates_spaces_and_junk() {
        assert_eq!(split_ints("1, 2 ,3"), vec![1, 2, 3]);
        assert_eq!(split_ints(""), Vec::<i32>::new());
        assert_eq!(split_ints("x,4"), vec![4]);
    }

    #[test]
    fn page_query_matches_java_base_page_defaults() {
        let q = ClientShopListQuery::default();
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 15);

        let q = ClientShopListQuery {
            page: Some(0),
            size: Some(500),
            ..Default::default()
        };
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 100);
    }

    #[test]
    fn product_limit_defaults_to_five_and_clamps_negative() {
        assert_eq!(ClientShopListQuery::default().product_limit(), 5);
        let q = ClientShopListQuery {
            product_number: Some(-3),
            ..Default::default()
        };
        assert_eq!(q.product_limit(), 0);
    }

    #[test]
    fn store_region_id_overrides_region_id() {
        let q = StoreListQuery {
            region_id: Some("1".into()),
            store_region_id: Some("9".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_region_id(), Some("9"));
        let q = StoreListQuery {
            region_id: Some("1".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_region_id(), Some("1"));
        let q = StoreListQuery {
            region_id: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(q.effective_region_id(), None);
    }

    #[test]
    fn comment_list_size_is_fixed_to_ten() {
        assert_eq!(ShopCommentListQuery::default().page_query().page_size, 10);
    }
}
