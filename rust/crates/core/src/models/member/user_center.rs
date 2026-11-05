//! 前台用户中心域（member::user_center）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.user.{UpdateInformationDTO, CheckModifyPasswordDTO,
//!   CheckEmailModifyDTO, DelHistoryProductDTO}`
//! - `com.tigshop.bean.param.user.{CheckModifyEmailDTO, ModifyEmailParam, ModifyMobileParam}`
//! - `com.tigshop.bean.dto.login.{RegisterSmsDTO, RegisterEmailDTO}`
//! - `com.tigshop.bean.dto.user.CollectShopListDTO`（→ [`CollectShopQuery`]）
//! - `com.tigshop.bean.vo.user.{MemberCenterVO, UserLevelListVO, UserLevelInfoVO,
//!   UserRankListVO, UserRankConfigVO, CollectShopVO}`
//! - `com.tigshop.bean.vo.finance.UserCreditDetailVO`
//! - `com.tigshop.bean.dto.product.ProductListResDTO`（→ [`HistoryProductVO`]，
//!   **仅取本切片可填充的字段子集**，见其文档）
//! - `com.tigshop.bean.vo.order.OrderItemVO`（→ [`OrderItemVO`]，同 trade::order_admin 的展示子集）
//! - `com.tigshop.bean.vo.config.GalleryPicUploadVO`（→ [`GalleryPicUploadVO`]）
//! - `com.tigshop.bean.vo.setting.UploadVideoInfoVO`（→ [`UploadVideoInfoVO`]）
//!
//! JSON 字段名保持 camelCase，与原接口一致（Java 用 Jackson 默认命名）。
//!
//! 说明：仓库既定约定是每个切片持有**独占副本**的 DTO（见 `category.rs` 模块注释），
//! 因此这里对 `OrderItemVO` / `ProductListResDTO` 等跨域结构各自复制一份，
//! 避免切片之间互相耦合。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 枚举常量（逐条对照 Java 枚举类）
// ——————————————————————————————————————————————

/// 结算账期类型（Java `SettlementTypeEnum`）。
pub mod settlement_type {
    /// 月结（30 天）
    pub const MONTHLY: i32 = 1;
    /// 季结（90 天）
    pub const QUARTERLY: i32 = 2;
    /// 未命中枚举时的兜底天数（Java `getDaysByCode` 返回 30）
    pub const DEFAULT_DAYS: i32 = 30;

    /// 按账期类型取天数（Java `SettlementTypeEnum.getDaysByCode`）。
    #[must_use]
    pub fn days_of(code: i32) -> i32 {
        match code {
            MONTHLY => 30,
            QUARTERLY => 90,
            _ => DEFAULT_DAYS,
        }
    }
}

/// 账期订单结算状态（Java `CreditOrderSettlementStatusEnum`）。
pub mod credit_order_status {
    /// 待结算
    pub const UNSETTLED: i32 = 0;
    /// 已结算
    pub const SETTLED: i32 = 1;
    /// 已取消（不再参与结算）
    pub const CANCELLED: i32 = 2;
    /// 退款中（暂不允许结算）
    pub const REFUNDING: i32 = 3;

    /// 状态文案（Java `getDescByCode`，未知返回空串）。
    #[must_use]
    pub fn description(code: i32) -> String {
        match code {
            UNSETTLED => "待结算",
            SETTLED => "已结算",
            CANCELLED => "已取消",
            REFUNDING => "退款中",
            _ => "",
        }
        .to_string()
    }
}

/// 店铺 / 门店状态（Java `ShopType` / `StoreType`，两者取值与文案完全一致）。
pub mod shop_status {
    /// 开业
    pub const OPEN: i32 = 1;
    /// 停业（暂停运营）
    pub const PAUSE: i32 = 4;
    /// 打烊（关店）
    pub const CLOSE: i32 = 10;

    /// 状态文案（Java `ShopType.getTypeName`，未知返回空串）。
    ///
    /// Java 对未知取值抛 `DATA_TYPE_ERROR`；这里返回空串，
    /// 避免脏数据把整个收藏列表接口打成 500（已记入 uncertain_points）。
    #[must_use]
    pub fn type_name(status: Option<i32>) -> String {
        match status {
            Some(OPEN) => "开业",
            Some(PAUSE) => "停业",
            Some(CLOSE) => "打烊",
            _ => "",
        }
        .to_string()
    }
}

/// 会员等级变更日志类型（Java `RankGrowthLogTypeEnum`）。
pub mod rank_growth_type {
    /// 完善信息
    pub const INFORMATION: i32 = 3;
    /// 绑定手机
    pub const BIND_PHONE: i32 = 4;

    /// 日志文案（Java `getDescription`）。
    #[must_use]
    pub fn description(code: i32) -> String {
        match code {
            INFORMATION => "完善信息",
            BIND_PHONE => "绑定手机",
            _ => "",
        }
        .to_string()
    }
}

/// 订单状态（Java `OrderStatusEnum`，本切片用到的取值）。
pub mod order_status {
    /// 待付款
    pub const PENDING: i32 = 0;
    /// 已确认，待发货
    pub const CONFIRMED: i32 = 1;
    /// 处理中（已发货）
    pub const PROCESSING: i32 = 2;
    /// 已完成
    pub const COMPLETED: i32 = 5;
}

/// 评价状态（Java `CommentStatus`）。
pub mod comment_status {
    /// 待评价
    pub const PENDING: i32 = 0;
}

// ——————————————————————————————————————————————
// 请求参数
// ——————————————————————————————————————————————

/// 更新会员信息（Java `bean.dto.user.UpdateInformationDTO`）。
///
/// 字段全为可空：Java 用 MyBatis-Plus `updateById`（默认 NOT_NULL 策略），
/// `null` 字段不参与 UPDATE，因此这里同样只更新「非 null」字段。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateInformationDTO {
    /// 出生日期（`yyyy-MM-dd`）
    pub birthday: Option<String>,
    /// 昵称
    pub nickname: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 微信二维码图片
    pub wechat_img: Option<String>,
}

/// 校验手机验证码并改密码（Java `CheckModifyPasswordDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckModifyPasswordDTO {
    pub mobile: Option<String>,
    pub code: Option<String>,
    pub password: Option<String>,
}

/// 修改手机号（Java `ModifyMobileParam`，`code` / `mobile` 均 `@NotBlank`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ModifyMobileParam {
    pub code: Option<String>,
    pub mobile: Option<String>,
}

/// 修改邮箱（Java `ModifyEmailParam`，`code` / `email` 均 `@NotBlank`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ModifyEmailParam {
    pub code: Option<String>,
    pub email: Option<String>,
}

/// 邮箱验证码校验（Java `param.user.CheckModifyEmailDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckModifyEmailDTO {
    pub email: Option<String>,
    pub code: Option<String>,
}

/// 邮箱验证 / 直接改绑（Java `dto.user.CheckEmailModifyDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CheckEmailModifyDTO {
    pub email: Option<String>,
    /// `> 0` 时直接改绑邮箱（Java `type != null && type > 0`）
    #[serde(rename = "type")]
    pub type_: Option<i32>,
}

/// 短信验证码请求（Java `dto.login.RegisterSmsDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegisterSmsDTO {
    /// 业务事件（`modify_password` / `mobile_validate` / `modify_mobile`）
    pub event: Option<String>,
    pub mobile: Option<String>,
    pub verify_token: Option<String>,
}

/// 邮件验证码请求（Java `dto.login.RegisterEmailDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegisterEmailDTO {
    /// 业务事件（`email_validate` / `modify_email`）
    pub event: Option<String>,
    pub email: Option<String>,
    pub verify_token: Option<String>,
}

/// 删除浏览历史（Java `dto.user.DelHistoryProductDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DelHistoryProductDTO {
    pub ids: Option<Vec<i32>>,
}

/// 收藏店铺列表查询（Java `dto.user.CollectShopListDTO extends BasePage`）。
///
/// `BasePage` 语义：`page` 缺省 1、`size` 缺省 15（上限 100）；
/// 排序只走 `sortField` / `sortOrder` 两参数版本（`sortItems` 在 Java 中未使用）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CollectShopQuery {
    pub page: Option<u64>,
    /// Java `BasePage.size`（前端传 `size`，这里同时兼容 `pageSize`）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段（属性名或列名，非法值回落到主键 `collect_id`）
    pub sort_field: Option<String>,
    /// `asc` / `desc`，缺省降序
    pub sort_order: Option<String>,
    /// 是否排除平台自营门店（`shop_id = 0`）：1 排除、0 纳入；
    /// 不传时非 O2O 默认排除（本项目 `application.yaml` 为 `is-o2o: 0`）
    pub exclude_self_operated: Option<i32>,
}

impl CollectShopQuery {
    /// Java `BasePage.getPage()`。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// Java `BasePage.getSize()`：缺省 15，上限 100。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        self.size.unwrap_or(15).clamp(1, 100)
    }

    /// 是否排除平台自营门店（Java `CollectShopServiceImpl#list` 的 `excludeSelfOperated`）。
    ///
    /// 本项目为 **非 O2O**（`application.yaml` 中 `tigshop.is-o2o: 0`），
    /// 故缺省即排除；显式传 0 仍纳入。
    #[must_use]
    pub fn exclude_self_operated(&self) -> bool {
        match self.exclude_self_operated {
            Some(v) => v == 1,
            None => true,
        }
    }

    /// 分页查询参数（供 `PageResult` 复用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }
}

// ——————————————————————————————————————————————
// 账期支付（creditDetail）
// ——————————————————————————————————————————————

/// 用户账期支付信息详情（Java `bean.vo.finance.UserCreditDetailVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditDetailVO {
    /// 信用额度
    pub credit_limit: Decimal,
    /// 已使用额度
    pub used_amount: Decimal,
    /// 可用额度
    pub available_amount: Decimal,
    /// 结算账期类型：1 月结 / 2 季结
    pub settlement_type: i32,
    /// 账期天数（30 / 90）
    pub settlement_days: i32,
    /// 剩余账期天数
    pub remaining_days: i32,
    /// 未结算订单（含退款中）
    pub pending_orders: Vec<CreditOrderVO>,
    /// 已结算订单
    pub settled_orders: Vec<CreditOrderVO>,
}

/// 账期订单列表项（Java `UserCreditDetailVO.UserCreditOrderVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreditOrderVO {
    pub order_id: i32,
    pub order_sn: String,
    /// 下单时间（`yyyy-MM-dd HH:mm:ss`，无值时空串）
    pub order_time: String,
    /// 账期付款金额
    pub credit_amount: Decimal,
    /// 商品总件数
    pub total_quantity: i32,
    pub settlement_status: i32,
    pub settlement_status_text: String,
    /// 0 正常 / 1 逾期
    pub risk_status: i32,
    pub risk_status_text: String,
    /// 订单商品（同 `/api/user/order/list` 的 `items` 口径）
    pub items: Vec<OrderItemVO>,
}

/// 订单商品 VO（Java `bean.vo.order.OrderItemVO` 的展示必需子集，
/// 字段与 `models::crate::models::trade::order_admin::OrderItemVO` 完全一致，便于前端复用同一组件）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderItemVO {
    pub item_id: i32,
    pub order_id: i32,
    pub order_sn: String,
    pub user_id: i32,
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub pic_thumb: String,
    pub sku_id: i32,
    pub sku_data: String,
    pub price: Decimal,
    pub origin_price: Option<Decimal>,
    pub quantity: i32,
    pub delivery_quantity: i32,
    pub product_type: i32,
    pub is_gift: i32,
    pub shop_id: i32,
    pub suppliers_id: i32,
    pub vendor_id: Option<i32>,
    pub card_group_name: String,
    pub promotion_data: Option<String>,
    pub commission: Option<String>,
}

// ——————————————————————————————————————————————
// 会员中心（memberCenter）
// ——————————————————————————————————————————————

/// 会员中心（Java `bean.vo.user.MemberCenterVO`）。
///
/// ⚠️ 两处按 Spring `BeanUtils.copyProperties` 的**类型不匹配静默跳过**语义保留为
/// `None`（Java 中恒为 `null`）：
/// - `rankPoint`：目标 `Integer` ← 源 `user_rank.rank_point`（`varchar(30)`）
/// - `rankLevel`：目标 `Integer` ← 源 `user_rank.rank_level`（`varchar(30)`）
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberCenterVO {
    /// 用户名掩码（`a***z`）
    pub dim_username: String,
    pub user_id: i32,
    pub username: String,
    pub nickname: Option<String>,
    pub avatar: String,
    pub rank_id: i32,
    pub balance: Decimal,
    /// 分销佣金可用余额
    pub commission_balance: Decimal,
    pub points: i32,
    pub mobile_validated: i32,
    pub email_validated: i32,
    pub is_svip: Option<i32>,
    pub is_company_auth: i32,
    /// 等级名称
    pub rank_name: Option<String>,
    pub min_growth_points: Option<Decimal>,
    pub rank_ico: Option<String>,
    pub discount: Option<Decimal>,
    pub rank_type: Option<i32>,
    pub rank_bg: Option<String>,
    /// Java 恒为 `null`（类型不匹配，见类型注释）
    pub rank_point: Option<i32>,
    pub free_shipping: Option<i32>,
    /// 自定义权益（原始 JSON 数组）
    pub rights: Option<serde_json::Value>,
    /// Java 恒为 `null`（类型不匹配，见类型注释）
    pub rank_level: Option<i32>,
    /// 安全等级：1 无验证 / 2 单项验证 / 3 双项验证
    pub security_lv: i32,
    pub await_pay: i64,
    pub await_shipping: i64,
    pub await_received: i64,
    pub await_comment: i64,
    pub await_coupon: i64,
}

// ——————————————————————————————————————————————
// 会员等级（levelList / levelInfo）
// ——————————————————————————————————————————————

/// 会员等级列表（Java `bean.vo.user.UserLevelListVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserLevelListVO {
    /// 等级条目（按 `min_growth_points` 升序）
    pub item: Vec<UserRankListVO>,
    /// 等级配置（`user_rank_config.code = 'rank_config'`；Java 缺行会 NPE，这里为 `null`）
    pub rank_config: Option<UserRankConfigVO>,
    /// 成长值配置（`user_rank_config.code = 'grow_config'` 的 `data` JSON）
    pub grow_config: Option<serde_json::Value>,
}

/// 等级条目（Java `bean.vo.user.UserRankListVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankListVO {
    /// 权益文案（Java `getUserRights` 拼接结果，`levelList` 未回填，恒空串）
    pub user_rights: String,
    /// 用户数量（`levelList` 未回填，恒 0）
    pub user_count: i32,
    pub rank_id: i32,
    pub rank_name: String,
    pub min_growth_points: Decimal,
    pub max_growth_points: i32,
    pub discount: Decimal,
    pub show_price: i32,
    pub rank_type: i32,
    pub rank_logo: String,
    pub rank_ico: String,
    pub rank_bg: String,
    /// `user_rank.rank_point`（`varchar`，hutool 拷贝按字符串直传）
    pub rank_point: String,
    pub free_shipping: i32,
    pub rank_card_type: i32,
    /// 自定义权益（`user_rank.rights` JSON 解析；非法 JSON 时为空表）
    pub rights: Vec<RankRight>,
    /// `user_rank.rank_level`（`varchar`）→ hutool `Convert.toInt` 结果
    pub rank_level: Option<i32>,
}

/// 等级权益项（Java `UserRankListVO.Right`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RankRight {
    pub name: Option<String>,
    pub show_name: Option<String>,
    pub icon: Option<String>,
    pub value: Option<String>,
    /// 注意字段名就是 `describe`（Java 声明 `private String describe;`）
    pub describe: Option<String>,
    pub is_checked: i32,
}

/// 等级配置（Java `bean.vo.user.UserRankConfigVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankConfigVO {
    pub id: i32,
    pub code: String,
    pub rank_type: i32,
    /// `data` 字段解析为 JSON 对象
    pub data: Option<serde_json::Value>,
}

/// `user_rank` 行的 camelCase JSON 视图（`levelInfo` 的 `userRank` 字段）。
///
/// Java `getRankInfo` 用 `JSONUtil.parseObj(userRank)` 把**实体**整体序列化
/// （camelCase，`rankLevel` 仍是 `varchar` 原文），再把 `rights` 从字符串
/// 换成解析后的数组。这里用同字段名的结构体复刻该形状，避免直接序列化
/// Rust 实体得到 snake_case 键名。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankJsonVO {
    pub rank_id: i32,
    pub rank_name: String,
    pub min_growth_points: Decimal,
    pub max_growth_points: i32,
    pub discount: Decimal,
    pub show_price: i32,
    pub rank_type: i32,
    pub rank_logo: String,
    pub rank_ico: String,
    pub rank_bg: String,
    pub rank_point: String,
    pub free_shipping: i32,
    pub rank_card_type: i32,
    /// 已解析的权益数组（原字段是 JSON 字符串）
    pub rights: Option<serde_json::Value>,
    pub rank_level: String,
}

/// 会员等级详情（Java `bean.vo.user.UserLevelInfoVO`）。
///
/// Java 中三个字段都是 `Object`，且语义随分支不同：
/// - 等级存在：`userRank` 为等级行 JSON（`rights` 已解析为数组）、
///   `rankConfig` 为 `UserRankConfigVO`、`growUpSetting` 为
///   `user_rank_config('grow_setting').data` 的**原始字符串**；
/// - 等级不存在：三者都是内置初始化对象（见 Java `getRankInfo` 的 else 分支）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserLevelInfoVO {
    /// Java 恒为 1
    pub rank_type: i32,
    pub user_rank: serde_json::Value,
    pub rank_config: Option<serde_json::Value>,
    pub grow_up_setting: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// 浏览历史（historyProduct）
// ——————————————————————————————————————————————

/// 最近浏览商品（Java `bean.dto.product.ProductListResDTO` 的可填充子集）。
///
/// **未迁移字段**（Java 会返回、本实现一律为 `null` / 不出现）：
/// `productSku`（SKU 明细数组）、`shop`（店铺实体）、`isTimeDiscount`、
/// `isSeckill`、`isGroupon`、`orgProductPrice`、`distance`、
/// 周期购（`cyclePrice` / `cyclePeriodName` / `deliveryType` / `isCardProduct` /
/// `redeemTotalTimes` / `effectiveTypeDesc` / `validityDesc` / `unitPrice`）、
/// 批发字段（`firstWholesalePrice` / `wholesaleCardMoq` / `wholesaleMoqDimension` /
/// `wholesaleMultiple`）、`productServiceIds`、`groupType`、`isCycleProduct`、
/// `productSaleMode`、`isNeedReImportVendorProduct`。
///
/// `price`（最终价）在 Java 中由 `getProductSkuDetail`（会员折扣 / 促销 / 秒杀 /
/// 门店覆盖）计算，本实现取商品零售价 `product_price`（与 catalog::product_manage / catalog::category
/// 已记录的同一未迁移缺口一致）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HistoryProductVO {
    pub category_id: i32,
    pub brand_id: i32,
    pub product_tsn: Option<String>,
    pub market_price: Decimal,
    pub shipping_tpl_id: i32,
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
    pub product_sn: String,
    pub product_price: Decimal,
    pub product_status: i32,
    pub is_best: i32,
    pub is_new: i32,
    pub is_hot: i32,
    pub product_stock: i32,
    pub sort_order: i32,
    /// SKU 数量（Java `skuCount`）
    pub sku_count: i32,
    /// 最终价（未迁移促销链路，等于 `product_price`）
    pub price: Decimal,
    pub vendor_product_id: Option<i32>,
    pub limit_number: i32,
    pub delivery_mode: i32,
    pub virtual_sales: i32,
    /// 商品 SKU 明细数组（未迁移，恒 `null`）
    pub product_sku: Option<Vec<serde_json::Value>>,
}

// ——————————————————————————————————————————————
// 收藏店铺（collectionShop）
// ——————————————————————————————————————————————

/// 收藏店铺列表项（Java `bean.vo.user.CollectShopVO`）。
///
/// 未派生 `PartialEq`：内嵌的 `Vec<Product>` 实体未实现 `PartialEq`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CollectShopVO {
    pub collect_id: i32,
    pub user_id: i32,
    pub shop_id: i32,
    /// 收藏时间（`yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 店铺在售商品数
    pub product_count: i64,
    /// 店铺被收藏数
    pub collect_count: i64,
    /// 店铺信息（店铺行缺失时为 `null`）
    pub shop: Option<CollectShopShopVO>,
}

/// 收藏项内嵌的店铺信息（Java `CollectShopVO.ShopVO`）。
///
/// ⚠️ 按 Spring `BeanUtils.copyProperties` 的类型不匹配静默跳过语义：
/// - `addTime`：目标 `String` ← 源 `shop.add_time`（`Integer`）→ 恒 `null`
/// - `kefuInlet`：目标 `List<Integer>` ← 源 `shop.kefu_inlet`（`String`）→ 恒 `null`
///
/// 未派生 `PartialEq`：内嵌的 `Vec<Product>` 实体未实现 `PartialEq`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CollectShopShopVO {
    pub status_text: String,
    pub shop_id: i32,
    pub shop_title: Option<String>,
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
    pub is_contact_kefu: i32,
    pub kefu_inlet: Option<Vec<i32>>,
    /// 热销商品（Java 返回 `List<Product>` 实体全字段）
    pub hot_product: Vec<crate::entities::Product>,
    /// 新品
    pub new_product: Vec<crate::entities::Product>,
    /// 推荐商品
    pub best_product: Vec<crate::entities::Product>,
}

// ——————————————————————————————————————————————
// 上传（uploadImg / uploadVideo，均未迁移）
// ——————————————————————————————————————————————

/// 图片上传结果（Java `bean.vo.config.GalleryPicUploadVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicUploadVO {
    pub pic_thumb: String,
    pub pic_url: String,
    pub pic_name: String,
    pub pic_id: i32,
    pub pic_width: i32,
    pub pic_height: i32,
    pub pic_size: i64,
    pub gallery_id: i32,
    pub file_type: String,
}

/// 视频上传结果（Java `bean.vo.setting.UploadVideoInfoVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UploadVideoInfoVO {
    pub video_url: String,
    pub video_name: String,
    pub format: String,
    pub video_cover: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settlement_days_falls_back_to_30() {
        assert_eq!(settlement_type::days_of(settlement_type::MONTHLY), 30);
        assert_eq!(settlement_type::days_of(settlement_type::QUARTERLY), 90);
        assert_eq!(settlement_type::days_of(0), 30);
        assert_eq!(settlement_type::days_of(99), 30);
    }

    #[test]
    fn credit_order_status_text() {
        assert_eq!(credit_order_status::description(0), "待结算");
        assert_eq!(credit_order_status::description(3), "退款中");
        assert_eq!(credit_order_status::description(9), "");
    }

    #[test]
    fn collect_shop_query_defaults_follow_base_page() {
        let q = CollectShopQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        // 非 O2O：缺省排除平台自营
        assert!(q.exclude_self_operated());

        let q = CollectShopQuery {
            size: Some(500),
            page: Some(0),
            exclude_self_operated: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_size(), 100); // 上限 100
        assert_eq!(q.page_no(), 1); // 下限 1
        assert!(!q.exclude_self_operated());
    }

    #[test]
    fn shop_status_type_name_matches_java_shop_type() {
        assert_eq!(shop_status::type_name(Some(1)), "开业");
        assert_eq!(shop_status::type_name(Some(4)), "停业");
        assert_eq!(shop_status::type_name(Some(10)), "打烊");
        assert_eq!(shop_status::type_name(None), "");
    }

    #[test]
    fn serializes_camel_case_with_java_field_names() {
        let vo = UserRankListVO {
            rank_id: 3,
            rank_name: "黄金会员".into(),
            min_growth_points: Decimal::new(100, 2),
            rank_level: Some(2),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["rankId"], 3);
        assert_eq!(json["rankLevel"], 2);
        // 金额字段存在即可（`rust_decimal` 的 serde 形态由工作区特性决定，不做硬断言）
        assert!(json.get("minGrowthPoints").is_some());
        // BasePage 参数同时接受 size 与 pageSize
        let q: CollectShopQuery = serde_json::from_value(serde_json::json!({
            "page": 2,
            "pageSize": 5,
            "sortField": "addTime",
            "sortOrder": "asc",
            "excludeSelfOperated": 1
        }))
        .unwrap();
        assert_eq!(q.page_size(), 5);
        assert_eq!(q.sort_field.as_deref(), Some("addTime"));
        assert!(q.exclude_self_operated());
    }

    #[test]
    fn check_email_modify_dto_reads_type_field() {
        let dto: CheckEmailModifyDTO =
            serde_json::from_value(serde_json::json!({"email": "a@b.c", "type": 1})).unwrap();
        assert_eq!(dto.type_, Some(1));
        assert_eq!(dto.email.as_deref(), Some("a@b.c"));
    }
}
