//! 分销员域 DTO/VO。对应 `com.tigshop.bean.{query,param,dto,vo}.salesman.*`。
//!
//! 约定：
//! - JSON 字段名统一 camelCase，与原 Java 接口保持一致；
//! - 时间列在库中为秒级 `i32`，对外统一输出毫秒 `i64`
//!   （原 Java 有的格式化为字符串、有的输出秒，此处统一为毫秒时间戳，
//!   属与原接口的已知差异）；
//! - 结算/佣金等深层嵌套结构（原 Java 内部类）用 `serde_json::Value` 承载，
//!   避免与原接口字段漂移。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::{Salesman, SalesmanGroup};

// ————————————————— 查询参数（GET） —————————————————

/// 分销员分页查询，对应 `SalesmanPageQuery` + `BasePage`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanListQuery {
    /// 手机号/用户名/昵称模糊搜索（原 Java `mobile`）
    pub mobile: Option<String>,
    /// 上级分销员手机号（原 Java `pidMobile`）
    pub pid_mobile: Option<String>,
    /// 关键字（原 Java `keyword`）
    pub keyword: Option<String>,
    /// 入驻时间起（`yyyy-MM-dd`）
    pub add_time_start: Option<String>,
    /// 入驻时间止（`yyyy-MM-dd`）
    pub add_time_end: Option<String>,
    pub group_id: Option<i32>,
    pub level: Option<i32>,
    pub user_id: Option<i32>,
    pub salesman_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 分销员分组分页查询，对应 `SalesmanGroupPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupListQuery {
    pub group_name: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 成交客户分页查询，对应 `CustomerListPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomerListQuery {
    pub salesman_id: Option<i32>,
    /// 客户分类：`ordered` / `salesman` / `customer`（前台 `CustomerApiPageQuery`）
    pub customer_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 分销业绩订单分页查询，对应 `SalesmanOrderPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanOrderListQuery {
    pub order_sn: Option<String>,
    /// 0 待结算 / 1 已结算 / 2 已失效，`-1` 或缺省表示不过滤
    pub status: Option<i32>,
    /// 1-按下单时间，2-按退款时间，`-1` 或缺省表示不过滤
    pub time_type: Option<i32>,
    pub order_time_start: Option<String>,
    pub order_time_end: Option<String>,
    pub salesman_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 客户成交分页查询，对应 `CustomerTransactionPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomerTransactionListQuery {
    pub salesman_id: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 分销商品分页查询，对应 `SalesmanProductPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductListQuery {
    pub product_name: Option<String>,
    /// 是否参与：0 不参与，1 参与
    pub is_join: Option<i32>,
    pub user_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 素材分页查询，对应 `SalesmanMaterialPageQuery` / `SalesmanMaterialApiPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialListQuery {
    pub is_show: Option<i32>,
    pub category_id: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    /// `user` 表示前台视角（只看有效素材、按分销员店铺过滤）
    pub from: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 素材分类分页查询，对应 `SalesmanMaterialCategoryPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategoryListQuery {
    pub category_name: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 分销内容分页查询，对应 `SalesmanContentPageQuery`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentListQuery {
    /// 0 未开始 / 1 展示中 / 2 已失效
    pub status: Option<i32>,
    pub title: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    /// `user` 表示前台视角
    pub from: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

// ————————————————— 请求体（POST） —————————————————

/// 新增分销员，对应 `SalesmanSaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanSaveParam {
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
}

/// 修改分销员，对应 `SalesmanEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanEditParam {
    pub salesman_id: Option<i32>,
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
}

/// 新增分组，对应 `SalesmanGroupSaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupSaveParam {
    pub group_name: Option<String>,
    pub describe: Option<String>,
}

/// 修改分组，对应 `SalesmanGroupEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupEditParam {
    pub group_id: Option<i32>,
    pub group_name: Option<String>,
    pub describe: Option<String>,
}

/// 素材图片，对应 `SalesmanMaterial*Param.Pic` / `SalesmanMaterialVO.Pic`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialPic {
    pub pic_id: Option<i32>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub pic_name: Option<String>,
}

/// 新增素材，对应 `SalesmanMaterialSaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialSaveParam {
    pub is_top: Option<i32>,
    pub content: Option<String>,
    pub pics: Option<Vec<SalesmanMaterialPic>>,
    pub category_id: Option<i32>,
    pub product_id: Option<i32>,
}

/// 修改素材，对应 `SalesmanMaterialEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialEditParam {
    pub id: Option<i32>,
    pub is_top: Option<i32>,
    pub content: Option<String>,
    pub is_available: Option<i32>,
    pub shop_id: Option<i32>,
    pub pics: Option<Vec<SalesmanMaterialPic>>,
    pub category_id: Option<i32>,
    pub share_num: Option<i32>,
    pub product_id: Option<i32>,
}

/// 新增素材分类，对应 `SalesmanMaterialCategorySaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategorySaveParam {
    pub category_name: Option<String>,
    pub sort_order: Option<i32>,
}

/// 修改素材分类，对应 `SalesmanMaterialCategoryEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategoryEditParam {
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub sort_order: Option<i32>,
}

/// 新增分销内容，对应 `SalesmanContentSaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentSaveParam {
    pub id: Option<i32>,
    pub title: Option<String>,
    pub describe: Option<String>,
    pub content: Option<String>,
    pub img: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub is_top: Option<i32>,
}

/// 修改分销内容，对应 `SalesmanContentEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentEditParam {
    pub id: Option<i32>,
    pub title: Option<String>,
    pub describe: Option<String>,
    pub content: Option<String>,
    pub img: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub is_top: Option<i32>,
    pub is_available: Option<i32>,
    pub shop_id: Option<i32>,
    pub pics: Option<Vec<String>>,
}

/// 绑定分销商品，对应 `SalesmanProductSaveParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductSaveParam {
    pub product_id: Option<i32>,
    pub is_join: Option<bool>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<serde_json::Value>,
}

/// 修改分销商品，对应 `SalesmanProductEditParam`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanProductEditParam {
    pub salesman_product_id: Option<i32>,
    pub product_id: Option<i32>,
    pub is_join: Option<bool>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<serde_json::Value>,
}

/// 人工结算，对应 `SalesmanOrderSettlementDTO`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanOrderSettlementParam {
    pub ids: Option<Vec<i32>>,
}

// ————————————————— VO —————————————————

/// 基础用户信息，对应 `UserBaseVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBaseVO {
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub mobile: Option<String>,
    pub avatar: Option<String>,
    pub email: Option<String>,
    pub reg_time: Option<i64>,
}

/// 分销员分组 VO，对应 `SalesmanGroupVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanGroupVO {
    pub group_id: Option<i32>,
    pub group_name: Option<String>,
    pub describe: Option<String>,
    pub shop_id: Option<i32>,
    pub add_time: Option<i64>,
}

impl From<&SalesmanGroup> for SalesmanGroupVO {
    fn from(g: &SalesmanGroup) -> Self {
        Self {
            group_id: Some(g.group_id),
            group_name: g.group_name.clone(),
            describe: g.describe.clone(),
            shop_id: g.shop_id,
            add_time: g.add_time.map(|t| i64::from(t) * 1000),
        }
    }
}

/// 上级分销员信息，对应 `SalesmanVO.PidUserInfo`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PidUserInfo {
    pub salesman_id: Option<i32>,
    pub user_id: Option<i32>,
    pub base_user_info: Option<UserBaseVO>,
}

/// 分销员 VO，对应 `SalesmanVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanVO {
    pub salesman_id: Option<i32>,
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
    pub shop_id: Option<i32>,
    pub sale_amount: Option<Decimal>,
    pub level_text: Option<String>,
    pub add_time: Option<i64>,
    pub base_user_info: Option<UserBaseVO>,
    pub group_info: Option<SalesmanGroupVO>,
    pub pid_user_info: Option<PidUserInfo>,
    pub total_customer: Option<i64>,
    pub salesman_name: Option<String>,
    pub salesman_pic: Option<String>,
    pub total_commission: Option<Decimal>,
    pub total_invite: Option<i64>,
}

impl From<&Salesman> for SalesmanVO {
    fn from(s: &Salesman) -> Self {
        Self {
            salesman_id: Some(s.salesman_id),
            user_id: s.user_id,
            level: s.level,
            group_id: s.group_id,
            pid: Some(s.pid),
            shop_id: s.shop_id,
            sale_amount: s.sale_amount,
            add_time: s.add_time.map(|t| i64::from(t) * 1000),
            ..Self::default()
        }
    }
}

/// 分销员业绩统计，对应 `SalesmanDetailVO.Statistical`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticalVO {
    pub sale_amount: Option<Decimal>,
    pub order_num: Option<i64>,
    pub customer_num: Option<i64>,
    pub invite_num: Option<i64>,
    pub commission_amount: Option<Decimal>,
    pub product_commission_amount: Option<Decimal>,
}

/// 分销员详情，对应 `SalesmanDetailVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanDetailVO {
    #[serde(rename = "salesmanVO")]
    pub salesman_vo: SalesmanVO,
    pub statistical: StatisticalVO,
}

/// 佣金汇总，对应 `CommissionDetailsVO.Commission`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionSummaryVO {
    pub product_transaction_amount: Option<Decimal>,
    pub auto_settlement_amount: Option<Decimal>,
    pub auto_wait_settlement_amount: Option<Decimal>,
    pub artificial_settlement_amount: Option<Decimal>,
    pub artificial_wait_settlement_amount: Option<Decimal>,
}

/// 佣金详情，对应 `CommissionDetailsVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommissionDetailsVO {
    pub item: Option<SalesmanVO>,
    pub commission: Option<CommissionSummaryVO>,
}

/// 成交客户，对应 `CustomerListVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerListVO {
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub mobile: Option<String>,
    pub nickname: Option<String>,
    pub reg_time: Option<i64>,
    pub rank_name: Option<String>,
    pub customer_type: Option<String>,
    pub order_count: Option<i64>,
    pub order_amount: Option<Decimal>,
    pub last_order_time: Option<i64>,
    pub bind_time: Option<i64>,
    pub channel: Option<String>,
    pub remark: Option<String>,
    pub salesman_id: Option<i32>,
}

/// 分销业绩订单，对应 `SalesmanOrderVO`。
///
/// 原 Java 内部类 `SalesmanProductDataVO` / `SalesmanSettingVO` /
/// `OrderUserInfoVO` / `UserOrderItemVO` 等字段较深且随时可能扩展，
/// 此处统一用 `serde_json::Value` 承载，键名保持原样。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanOrderVO {
    pub status_text: Option<String>,
    pub salesman_order_id: Option<i32>,
    pub order_id: Option<i32>,
    pub salesman_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub status: Option<i32>,
    pub add_time: Option<i64>,
    pub item_id: Option<i32>,
    pub salesman_product_data: Option<serde_json::Value>,
    pub order_amount: Option<Decimal>,
    pub salesman_settlement_data: Option<serde_json::Value>,
    pub settlement_time: Option<i64>,
    pub product_id: Option<i32>,
    pub profit_composition: Option<String>,
    pub salesman: Option<serde_json::Value>,
    pub order_user_info: Option<serde_json::Value>,
    pub user_order: Option<serde_json::Value>,
    pub user_order_item: Option<serde_json::Value>,
    pub refund_time: Option<i64>,
}

/// 客户成交，对应 `CustomerTransactionOrderVO` 的核心字段
/// （原 VO 深度依赖订单域快照，这里保留订单/客户/分销员三组关键信息）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerTransactionVO {
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub mobile: Option<String>,
    pub order_status: Option<i32>,
    pub pay_status: Option<i32>,
    pub total_amount: Option<Decimal>,
    pub paid_amount: Option<Decimal>,
    pub add_time: Option<i64>,
    pub pay_time: Option<i64>,
    pub salesman_id: Option<i32>,
    pub salesman_name: Option<String>,
    pub amount: Option<Decimal>,
    pub status: Option<i32>,
    pub status_text: Option<String>,
}

/// 分销商品 VO，对应 `SalesmanProductVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanProductVO {
    pub salesman_product_id: Option<i32>,
    pub product_id: Option<i32>,
    pub is_join: Option<i32>,
    pub commission_type: Option<i32>,
    pub commission_data: Option<serde_json::Value>,
    pub add_time: Option<i64>,
    pub update_time: Option<i64>,
    pub shop_id: Option<i32>,
    pub product_commission: Option<serde_json::Value>,
}

/// 分销商品列表行，对应 `SalesmanProductListVO` 的核心字段
/// （原 VO 还内嵌完整 `Product`，此处保留商品基础信息 + 分销配置）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanProductListVO {
    pub product_id: Option<i32>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub pic_thumb: Option<String>,
    pub product_price: Option<Decimal>,
    pub product_status: Option<i32>,
    pub salesman_product: Option<SalesmanProductVO>,
}

/// 素材分类 VO，对应 `SalesmanMaterialCategoryVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanMaterialCategoryVO {
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub add_time: Option<i64>,
    pub shop_id: Option<i32>,
    pub sort_order: Option<i32>,
}

impl From<&crate::entities::SalesmanMaterialCategory> for SalesmanMaterialCategoryVO {
    fn from(c: &crate::entities::SalesmanMaterialCategory) -> Self {
        Self {
            category_id: Some(c.category_id),
            category_name: c.category_name.clone(),
            add_time: c.add_time.map(|t| i64::from(t) * 1000),
            shop_id: c.shop_id,
            sort_order: c.sort_order,
        }
    }
}

/// 素材 VO，对应 `SalesmanMaterialVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanMaterialVO {
    pub id: Option<i32>,
    pub add_time: Option<i64>,
    pub is_top: Option<i32>,
    pub content: Option<String>,
    pub is_available: Option<i32>,
    pub shop_id: Option<i32>,
    pub category_id: Option<i32>,
    pub share_num: Option<i32>,
    pub product_id: Option<i32>,
    pub pics_json: Option<String>,
    pub pics: Option<Vec<SalesmanMaterialPic>>,
    pub category: Option<SalesmanMaterialCategoryVO>,
    pub product: Option<serde_json::Value>,
}

/// 分销内容 VO，对应 `SalesmanContentVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanContentVO {
    pub id: Option<i32>,
    pub title: Option<String>,
    pub describe: Option<String>,
    pub content: Option<String>,
    pub img: Option<String>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub is_available: Option<i32>,
    pub is_top: Option<i32>,
    pub status: Option<i32>,
    pub status_text: Option<String>,
    pub shop_id: Option<i32>,
    pub pics: Option<Vec<String>>,
}

/// 分销员中心概览，对应 `SalesmanUserDetailVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanCenterVO {
    pub salesman_id: Option<i32>,
    pub user_id: Option<i32>,
    pub level: Option<i32>,
    pub level_name: Option<String>,
    pub condition: Option<serde_json::Value>,
    pub group_id: Option<i32>,
    pub pid: Option<i32>,
    pub shop_id: Option<i32>,
    pub sale_amount: Option<Decimal>,
    pub add_time: Option<i64>,
    pub salesman_config: Option<serde_json::Value>,
    pub order: Option<serde_json::Value>,
}
