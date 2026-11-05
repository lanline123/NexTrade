//! 商户/店铺域 DTO/VO。对应 `com.tigshop.bean.dto.shop.*` 与 `vo.shop.*`。
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | `ShopListQuery` | `dto.shop.ShopListDTO`（`keyword/page/pageSize` 来自 `BasePage`） |
//! | `ShopVO` | `vo.shop.ShopVO` |
//! | `ShopUpdateDTO` | `dto.shop.ShopUpdateDTO` + `updateField` 启停字段 |
//! | `ShopAccountLogListQuery` | `dto.shop.AccountListDTO` |
//! | `ShopAccountLogVO` | `vo.shop.ShopAccountLogVO` |
//! | `ShopWithdrawListQuery` | `dto.shop.ShopWithdrawListDTO` |
//! | `ShopWithdrawVO` | `vo.shop.ShopWithdrawVO` |
//! | `ShopWithdrawAuditDTO` | `dto.shop.ShopWithdrawAuditDTO` |
//! | `ShopProductCategoryListQuery` | `dto.shop.ShopProductCategoryListDTO` |
//! | `ShopProductCategoryVO` | `vo.shop.ShopProductCategoryVO` |
//! | `ShopCategoryTreeNode` | `ShopProductCategoryService#tree`（hutool `Tree<Integer>`） |
//! | `ShopParentTreeVO` | `vo.shop.ShopParentTreeVO` |
//! | `ClientShopDetailVO` | `vo.shop.ClientShopDetailVO` |
//!
//! 约定：金额一律 [`rust_decimal::Decimal`]，时间一律毫秒时间戳 `i64`
//!（库列 `add_time` 为秒，出参统一 `* 1000`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::{Shop, ShopProductCategory};

/// 店铺状态文案（对应 `enums.shop.ShopType` / `StoreType` / `StorePickupType`）。
///
/// 三套枚举的 code 相同，仅自提点（`shop_type=3`）文案不同：
/// 店铺/门店为「开业/停业/打烊」，自提点为「启用/停业/禁用」。
/// 原 Java 对未知 code 抛 `DATA_TYPE_ERROR`，Rust 侧返回空串避免整页失败。
#[must_use]
pub fn shop_status_text(status: Option<i32>, shop_type: Option<i32>) -> String {
    let status = match status {
        Some(s) => s,
        None => return String::new(),
    };
    let pickup = matches!(shop_type, Some(3));
    match status {
        1 => {
            if pickup {
                "启用"
            } else {
                "开业"
            }
        }
        4 => "停业",
        10 => {
            if pickup {
                "禁用"
            } else {
                "打烊"
            }
        }
        _ => "",
    }
    .to_string()
}

/// 店铺分页查询（`ShopListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopListQuery {
    /// 关键字（`BasePage.keyword`），模糊匹配店铺名称。
    pub keyword: Option<String>,
    /// 店铺名称（`ShopListDTO.shopTitle`），与 `keyword` 取并集后取其一匹配。
    pub shop_title: Option<String>,
    /// 店铺状态：1 开业 4 停业 10 关店。
    pub status: Option<i32>,
    /// 1 店铺 2 门店 3 自提点（`ShopListDTO.shopType` 默认 1）。
    pub shop_type: Option<i32>,
    /// 门店父级 ID（`storeParentId`）。
    pub store_parent_id: Option<i32>,
    /// 省区域 ID 模糊匹配（`shopRegionId`）。
    pub shop_region_id: Option<String>,
    /// 创建开始日期 `yyyy-MM-dd`（`addStartTime`）。
    pub add_start_time: Option<String>,
    /// 创建结束日期 `yyyy-MM-dd`（`addEndTime`）。
    pub add_end_time: Option<String>,
    /// 排序字段（白名单见仓储层）。
    pub sort_field: Option<String>,
    /// 排序方向 asc/desc。
    pub sort_order: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 店铺关联的商户 VO（原 Java `MerchantVO` / `ClientShopDetailVO.Merchant` 的字段子集）。
///
/// 管理端列表/详情与前台详情共用；`admin` 仅管理端填充
/// （原 Java `merchantVO.setAdmin(...)`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopMerchantVO {
    pub merchant_id: i32,
    pub merchant_apply_id: Option<i32>,
    pub user_id: Option<i32>,
    /// 商户创建时间（毫秒时间戳；原 Java 为格式化字符串）。
    pub add_time: i64,
    pub company_name: Option<String>,
    pub corporate_name: Option<String>,
    pub settlement_cycle: Option<i32>,
    pub status: Option<i32>,
    /// [json] 商户扩展数据原文。
    pub merchant_data: Option<String>,
    /// 类型文案（1 个人 2 企业），仅前台详情填充。
    pub type_text: Option<String>,
    /// 店铺管理员绑定（`adminId`/`username`）。
    pub admin: Option<ShopMerchantAdminVO>,
}

/// 店铺管理员账号（原 Java `MerchantAdminDataDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopMerchantAdminVO {
    pub admin_id: i32,
    pub username: String,
}

/// 店铺 VO（`vo.shop.ShopVO`）。
///
/// 保留骨架期的 `shop_name` 字段（= `shop_title`）以兼容既有调用方；
/// `add_time` 为毫秒时间戳（原 Java 为格式化字符串）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopVO {
    pub shop_id: i32,
    /// 骨架期兼容字段，值等于 `shop_title`。
    pub shop_name: String,
    pub shop_title: String,
    /// 店铺创建时间（毫秒时间戳）。
    pub add_time: i64,
    pub shop_logo: Option<String>,
    pub status: Option<i32>,
    /// 状态文案（开业/停业/打烊）。
    pub status_text: String,
    pub shop_type: Option<i32>,
    pub merchant_id: Option<i32>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub contact_mobile: Option<String>,
    pub description: Option<String>,
    pub kefu_phone: Option<String>,
    pub kefu_weixin: Option<String>,
    pub kefu_link: Option<String>,
    /// 是否联系客服：1 是 0 否。
    pub is_contact_kefu: i32,
    pub click_count: Option<i32>,
    pub shop_sales: Option<i32>,
    pub shop_star_num: Option<i32>,
    pub shop_star: Option<Decimal>,
    /// 商品评分（`AVG(comment_rank)`，仅详情接口填充）。
    pub product_score: Option<Decimal>,
    /// 商户信息（原 Java `MerchantVO`，service 填充）。
    pub merchant: Option<ShopMerchantVO>,
    pub shop_region_id: Option<String>,
    pub shop_detailed_address: Option<String>,
    pub shop_longitude: Option<Decimal>,
    pub shop_latitude: Option<Decimal>,
    pub store_parent_id: Option<i32>,
    pub is_delete: Option<i32>,
}

impl From<&Shop> for ShopVO {
    fn from(s: &Shop) -> Self {
        // schema 列名为 shop_title（pure.sql），非 shop_name
        let shop_title = s.shop_title.clone().unwrap_or_default();
        Self {
            shop_id: s.shop_id,
            shop_name: shop_title.clone(),
            shop_title,
            add_time: i64::from(s.add_time.unwrap_or(0)) * 1000,
            shop_logo: s.shop_logo.clone(),
            status: s.status,
            status_text: shop_status_text(s.status, s.shop_type),
            shop_type: s.shop_type,
            merchant_id: s.merchant_id,
            shop_money: s.shop_money,
            frozen_money: s.frozen_money,
            contact_mobile: s.contact_mobile.clone(),
            description: s.description.clone(),
            kefu_phone: s.kefu_phone.clone(),
            kefu_weixin: s.kefu_weixin.clone(),
            kefu_link: s.kefu_link.clone(),
            is_contact_kefu: s.is_contact_kefu,
            click_count: s.click_count,
            shop_sales: s.shop_sales,
            shop_star_num: s.shop_star_num,
            shop_star: s.shop_star,
            product_score: None,
            merchant: None,
            shop_region_id: s.shop_region_id.clone(),
            shop_detailed_address: s.shop_detailed_address.clone(),
            shop_longitude: s.shop_longitude,
            shop_latitude: s.shop_latitude,
            store_parent_id: s.store_parent_id,
            is_delete: s.is_delete,
        }
    }
}

/// 店铺更新请求（`ShopUpdateDTO`，`update` / `updateField` 共用）。
///
/// 字段集合对齐 `ShopUpdateDTO` + 父类 `StoreExtendedDto` 中
/// 与 `shop` 表同名（可被 `BeanUtils.copyProperties` 复制）的属性；
/// 与 MyBatis-Plus `updateById` 语义一致：`None` 字段不参与更新。
/// 注：原 Java 未复制的 JSON/列表字段（`shopShowPicture`、`shopContactConfig`、
/// `shopRegionIds`、`shopTips` 等）此处不收录，`shopTips` 落 `store_tip` 表。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopUpdateDTO {
    #[serde(alias = "id")]
    pub shop_id: i32,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub contact_mobile: Option<String>,
    /// 店铺类型（`StoreExtendedDto.shopType` 默认 1，与原 Java 一致总是参与更新）。
    pub shop_type: Option<i32>,
    /// 自提时传入门店 id。
    pub store_parent_id: Option<i32>,
    /// 门店封面。
    pub shop_cover_picture: Option<String>,
    pub description: Option<String>,
    /// 店铺启停/审核：1 开业 4 停业 10 关店。
    pub status: Option<i32>,
    pub shop_detailed_address: Option<String>,
    pub shop_longitude: Option<Decimal>,
    pub shop_latitude: Option<Decimal>,
}

impl Default for ShopUpdateDTO {
    fn default() -> Self {
        Self {
            shop_id: 0,
            shop_title: None,
            shop_logo: None,
            contact_mobile: None,
            // 原 Java `StoreExtendedDto.shopType` 字段默认 1
            shop_type: Some(1),
            store_parent_id: None,
            shop_cover_picture: None,
            description: None,
            status: None,
            shop_detailed_address: None,
            shop_longitude: None,
            shop_latitude: None,
        }
    }
}

/// 资金流水查询（`AccountListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopAccountLogListQuery {
    /// 状态（`AccountListDTO.status`，原 Java `list` 未使用，仅保留入参兼容）。
    pub status: Option<i32>,
    /// 资金类型：`all` / `online` / `offline`（默认 all）。
    pub balance_type: Option<String>,
    /// 线上渠道：WECHAT / HUIFU / ALIPAY。
    pub pay_channel: Option<String>,
    /// 按店铺标题模糊匹配（`AccountListDTO.keyword`）。
    pub keyword: Option<String>,
    pub shop_id: Option<i32>,
    /// 店铺类型：1 店铺 2 门店。
    pub shop_type: Option<i32>,
    /// 起始日期 `yyyy-MM-dd`。
    pub start_time: Option<String>,
    /// 结束日期 `yyyy-MM-dd`。
    pub end_time: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 资金流水 VO（`vo.shop.ShopAccountLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopAccountLogVO {
    pub shop_account_log_id: i32,
    /// 添加时间（毫秒时间戳；原 Java 为格式化字符串）。
    pub add_time: i64,
    /// 变动金额（旧前端语义：与 `change_amount` 一致，见 `AccountServiceImpl#list`）。
    pub shop_money: Decimal,
    pub frozen_money: Decimal,
    /// 资金事件类型（库列为 varchar，原值如 `"1"` 提现）。
    pub r#type: String,
    /// 改变原因（原 Java 按 type 走 i18n key）。
    pub change_reasons: Option<String>,
    pub remarks: Option<String>,
    pub new_shop_money: Option<Decimal>,
    pub new_frozen_money: Decimal,
    pub shop_id: i32,
    pub shop_title: Option<String>,
    pub change_amount: Option<Decimal>,
    /// 资金类型：1 线下 2 线上。
    pub balance_type: i32,
    pub pay_channel: Option<String>,
}

/// 提现列表查询（`ShopWithdrawListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawListQuery {
    /// 状态：0 待审核 2 审核不通过 3 完成 4 待打款。
    pub status: Option<i32>,
    /// 提现方式：1 线下 2 线上。
    pub withdraw_type: Option<i32>,
    /// 线上渠道：WECHAT / HUIFU / ALIPAY。
    pub pay_channel: Option<String>,
    pub shop_id: Option<i32>,
    /// 提现开始日期 `yyyy-MM-dd`。
    pub add_time_start: Option<String>,
    /// 提现结束日期 `yyyy-MM-dd`。
    pub add_time_end: Option<String>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 提现 VO（`vo.shop.ShopWithdrawVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopWithdrawVO {
    pub shop_withdraw_log_id: i32,
    pub shop_id: i32,
    pub amount: Decimal,
    pub handling_fee: Option<Decimal>,
    pub handling_rate: Option<Decimal>,
    pub status: i32,
    /// 状态文案（`enums.shop.ShopWithdrawStatus`）。
    pub status_text: String,
    /// 提现时间（毫秒时间戳；原 Java 为格式化字符串）。
    pub add_time: i64,
    pub remark: String,
    pub merchant_account_id: Option<i32>,
    /// 提现账户信息 JSON 原文（原 Java 解析为 `JSONObject`）。
    pub account_data: Option<String>,
    pub audit_remark: Option<String>,
    pub payment_voucher: Option<String>,
    pub withdraw_sn: String,
    /// 提现方式：1 线下 2 线上。
    pub withdraw_type: i32,
    pub pay_channel: Option<String>,
}

/// 提现状态文案（对应 `enums.shop.ShopWithdrawStatus`，1 正在处理对前端隐藏）。
#[must_use]
pub fn withdraw_status_text(status: i32) -> String {
    match status {
        0 => "待审核",
        1 => "正在处理",
        2 => "审核不通过",
        3 => "完成",
        4 => "待打款",
        _ => "",
    }
    .to_string()
}

/// 提现审核请求（`ShopWithdrawAuditDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWithdrawAuditDTO {
    pub id: i32,
    /// 目标状态：2 审核不通过 / 4 待打款（审核通过）。
    pub status: i32,
    pub audit_remark: Option<String>,
}

/// 店铺经营类目查询（`ShopProductCategoryListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryListQuery {
    pub parent_id: Option<i32>,
    pub keyword: Option<String>,
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 店铺经营类目 VO（`vo.shop.ShopProductCategoryVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopProductCategoryVO {
    pub category_id: i32,
    pub parent_id: i32,
    pub category_name: String,
    /// 是否有下级：1 有 0 无（原 Java 逐行 count，Rust 侧批量计算）。
    pub has_children: i32,
    pub is_show: i32,
    pub shop_id: i32,
    pub sort_order: i32,
    pub category_pic: String,
    /// 添加时间（毫秒时间戳；原 Java 为格式化字符串）。
    pub add_time: i64,
}

impl From<&ShopProductCategory> for ShopProductCategoryVO {
    fn from(c: &ShopProductCategory) -> Self {
        Self {
            category_id: c.category_id,
            parent_id: c.parent_id,
            category_name: c.category_name.clone(),
            has_children: 0,
            is_show: c.is_show,
            shop_id: c.shop_id,
            sort_order: c.sort_order,
            category_pic: c.category_pic.clone(),
            add_time: i64::from(c.add_time.unwrap_or(0)) * 1000,
        }
    }
}

/// 经营类目树节点（对应 hutool `Tree<Integer>` 的 JSON 形态，
/// `TreeNodeConfig` 的 id/parentId/name 键被改写为 categoryId/parentId/categoryName）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopCategoryTreeNode {
    pub category_id: i32,
    pub parent_id: i32,
    pub category_name: String,
    pub category_pic: String,
    /// 原 Java `putExtra("isStore", 1)`。
    pub is_store: i32,
    pub children: Vec<ShopCategoryTreeNode>,
}

/// 父级分类链 VO（`vo.shop.ShopParentTreeVO`，前台 `parentTree`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopParentTreeVO {
    pub category_id: i32,
    pub parent_id: i32,
    pub category_name: String,
    pub cat_list: Option<Vec<ShopParentTreeVO>>,
}

/// 前台店铺详情 VO（`vo.shop.ClientShopDetailVO`）。
///
/// 简化：`listingProduct`/`listingCount`（装修位商品）与商家扩展信息未接入，
/// 商家信息仅回填 ID/公司名等基础字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientShopDetailVO {
    pub status_text: String,
    pub shop_id: i32,
    pub shop_title: String,
    /// 添加时间（毫秒时间戳；原 Java 为格式化字符串）。
    pub add_time: i64,
    pub shop_logo: Option<String>,
    pub click_count: Option<i32>,
    pub status: Option<i32>,
    pub shop_type: Option<i32>,
    pub merchant_id: Option<i32>,
    pub shop_money: Option<Decimal>,
    pub frozen_money: Option<Decimal>,
    pub contact_mobile: Option<String>,
    pub description: Option<String>,
    pub kefu_phone: Option<String>,
    pub kefu_weixin: Option<String>,
    pub kefu_link: Option<String>,
    pub is_contact_kefu: i32,
    pub kefu_inlet: Option<String>,
    pub shop_sales: Option<i32>,
    pub shop_star_num: Option<i32>,
    pub shop_star: Option<Decimal>,
    pub shop_region_id: Option<String>,
    pub shop_detailed_address: Option<String>,
    /// 收藏人数（`COUNT(DISTINCT user_id)`）。
    pub collect_count: i64,
    /// 商品总数。
    pub product_count: i64,
    /// 新品总数。
    pub new_product_count: i64,
    /// 当前登录用户是否已收藏（公开接口恒为 false）。
    pub collect_shop: bool,
    /// 商品评分（`AVG(comment_rank)`）。
    pub product_score: Decimal,
    /// 商户信息（原 Java `ClientShopDetailVO.Merchant` 字段子集）。
    pub merchant: Option<ShopMerchantVO>,
    /// 营业执照图片，无有效资料返回空串。
    pub business_license_pic: String,
}
