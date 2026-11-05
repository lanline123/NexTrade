//! 店铺信息域（merchant::shop_manage）DTO / VO / 查询参数 / 入参。
//! 对应 Java `com.tigshop.adminapi.controller.shop.ShopController`
//! （`@RequestMapping("/adminapi/merchant/shop")`）及其依赖的
//! `bean.dto.shop.*` / `bean.vo.shop.*` / `bean.dto.common.*` /
//! `bean.param.vendor.ShopVendorSettingUpdateParam` /
//! `bean.param.login.LoginChooseParam`。
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | [`ShopListQuery`] | `dto.shop.ShopListDTO extends BasePage` |
//! | [`ShopWritePayload`] | `dto.shop.ShopCreateDTO` + `ShopUpdateDTO` + `ShopUpdateInfoDTO` + 父类 `StoreExtendedDto` |
//! | [`ShopSettingPayload`] | `dto.shop.ShopSettingDTO` |
//! | [`ShopVO`] | `vo.shop.ShopVO`（+ 父类 `StoreExtendedDto`） |
//! | [`StaffShowVO`] | `vo.shop.StaffShowVO` |
//! | [`VendorSettingVO`] | `vo.vendor.ShopVendorSettingVO` |
//! | [`StoreListVO`] | `vo.o2o.StoreListVO`（本域只用到 `shopId`/`shopTitle`） |
//! | [`OperateDTO`] | `dto.common.OperateDTO` |
//! | [`BatchDTO`] | `dto.common.BatchDTO` |
//! | [`UpdateFieldDTO`] | `dto.common.UpdateFieldDTO` |
//! | [`VendorSettingUpdateParam`] | `param.vendor.ShopVendorSettingUpdateParam` |
//! | [`LoginChooseParam`] | `param.login.LoginChooseParam` |
//! | [`PosLoginSettingPayload`] | `dto.shop.PosLoginSettingDTO` |
//!
//! **说明（重复定义原因）**：`OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! 在 `models::catalog` / `models::brand` 已有同构版本，但本切片不得修改
//! 共享文件，且原 Java 的 `BatchDTO.data`（`Map<String,Object>`）只有本域用到，
//! 故在本文件内定义自己的副本。主会话合并时如需统一可替换。
//!
//! 约定：金额一律 `rust_decimal::Decimal`；时间字段区分两种口径——
//! 「出参」的 `add_time` 为 Java `SimpleDateFormat("yyyy-MM-dd HH:mm:ss")`
//! 格式化**字符串**（`ShopVO.addTime` / `AdminUserShopVO.addTime`），
//! 「入参/库列」的秒级时间戳为 `i32`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 店铺类型（对应 Java `enums.o2o.ShopTypeEnum`）。
pub mod shop_type {
    /// 店铺
    pub const SHOP: i32 = 1;
    /// 门店
    pub const STORE: i32 = 2;
    /// 自提点
    pub const PICKUP: i32 = 3;
}

/// 店铺/门店状态（对应 Java `enums.shop.ShopType` / `StoreType`，
/// 自提点 `StorePickupType` 文案不同，见 [`shop_status_text`]）。
pub mod shop_status {
    /// 开业 / 启用
    pub const OPEN: i32 = 1;
    /// 暂停运营 / 停业
    pub const PAUSE: i32 = 4;
    /// 关店 / 打烊 / 禁用
    pub const CLOSE: i32 = 10;
}

/// 店铺状态文案（对应 Java `ShopType.getTypeName` / `StoreType.getTypeName`
/// / `StorePickupType.getTypeName`）。
///
/// 三套枚举 code 相同、文案在自提点上不同：
/// 店铺/门店「开业/停业/打烊」，自提点「启用/停业/禁用」。
/// 原 Java 对未知 code 抛 `DATA_TYPE_ERROR`，Rust 侧返回空串避免整页失败
/// （与 `models::shop::shop_status_text` 的既有取舍一致）。
#[must_use]
pub fn shop_status_text(status: Option<i32>, shop_type: Option<i32>) -> String {
    let status = match status {
        Some(s) => s,
        None => return String::new(),
    };
    let pickup = shop_type == Some(shop_type::PICKUP);
    match status {
        shop_status::OPEN => {
            if pickup {
                "启用"
            } else {
                "开业"
            }
        }
        shop_status::PAUSE => "停业",
        shop_status::CLOSE => {
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

/// 店铺分页查询（`ShopListDTO extends BasePage`）。
///
/// 分页字段沿用 Java `BasePage`：`page`（默认 1）、`size`（默认 15，上限 100）。
/// 前端亦可能传 `pageSize`，故加 alias。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopListQuery {
    /// 是否 `myShop` 接口请求（1 是，默认 0）
    pub is_my_shop: Option<i32>,
    /// 1 店铺，2 门店，3 自提点（原 Java 字段默认值 1）
    pub shop_type: Option<i32>,
    /// `myShop` 按需过滤的店铺类型集合
    pub shop_types: Option<Vec<i32>>,
    /// 是否包含平台自营主体（shopId=0）；1 包含，默认 0 不包含
    pub include_self_operated: Option<i32>,
    /// C 端是否排除平台自营门店；1/不传 排除，0 纳入
    pub exclude_self_operated: Option<i32>,
    /// 店铺状态：1 开业 4 停业 10 关店（仅 `> 0` 生效）
    pub status: Option<i32>,
    /// 店铺名称（与 `keyword` 取并集，只取其一匹配）
    pub shop_title: Option<String>,
    /// 主账号名称（模糊匹配 `admin_user.username`，限定 `is_admin = 1`）
    pub main_account: Option<String>,
    /// 账号名称（模糊匹配 `admin_user.username`，不限 `is_admin`）
    pub account: Option<String>,
    /// 店铺 id 集合（非空时优先于登录态店铺过滤）
    pub shop_ids: Option<Vec<i32>>,
    /// 登录态店铺 ID —— **Rust 侧扩展字段**，替代原 Java 请求头
    /// `x-shop-id`（`HeaderUtils.getShopId()`）。原 Java `ShopListDTO`
    /// 没有这个字段，前端传 `shopId` 时本字段生效。
    pub shop_id: Option<i32>,
    /// 门店父 id
    pub store_parent_id: Option<i32>,
    /// 创建开始日期 `yyyy-MM-dd`
    pub add_start_time: Option<String>,
    /// 创建结束日期 `yyyy-MM-dd`
    pub add_end_time: Option<String>,
    /// 区域经理 id（关联 `area_store_manager_shop`）
    pub area_store_manager_id: Option<i32>,
    /// 省市区 id（`shop_region_id` 模糊）
    pub shop_region_id: Option<String>,
    /// 商品 id（本域列表未使用）
    pub product_id: Option<i32>,
    /// 商品个数（本域列表未使用）
    pub product_number: Option<i32>,
    /// 下拉框 0 否 1 是（原 Java 字段默认值 0）
    pub select: Option<i32>,
    /// 分配商品 id（本域列表未使用）
    pub distribution_product_id: Option<i32>,
    /// 商户名称（关联 `merchant.corporate_name` 模糊）
    pub corporate_name: Option<String>,
    /// 关键词（Java `BasePage.keyword`，模糊匹配 `shop_title`）
    pub keyword: Option<String>,
    /// 排序字段（Java 属性名，驼峰；未知回落主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空按降序）
    pub sort_order: Option<String>,
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
}

impl ShopListQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// `ShopListDTO.isMyShop`（原 Java 字段默认值 0）。
    #[must_use]
    pub fn is_my_shop_flag(&self) -> i32 {
        self.is_my_shop.unwrap_or(0)
    }

    /// `ShopListDTO.shopType`（原 Java 字段默认值 1）。
    #[must_use]
    pub fn shop_type_or_default(&self) -> i32 {
        self.shop_type.unwrap_or(shop_type::SHOP)
    }

    /// `ShopListDTO.select`（原 Java 字段默认值 0）。
    #[must_use]
    pub fn select_flag(&self) -> i32 {
        self.select.unwrap_or(0)
    }

    /// `ShopListDTO.includeSelfOperated`（原 Java 字段默认值 0）。
    #[must_use]
    pub fn include_self_operated_flag(&self) -> i32 {
        self.include_self_operated.unwrap_or(0)
    }
}

/// 店铺创建/更新/更新详情共用的入参。
///
/// 三个 Java 入参（`ShopCreateDTO` / `ShopUpdateDTO` / `ShopUpdateInfoDTO`）
/// 都继承 `StoreExtendedDto`，字段高度重叠，故合并为一个 payload：
/// - `create`：忽略 `shopId`，要求 `shopTitle` 非空、`merchantId > 0`
/// - `update`：要求 `shopId > 0`
/// - `updateInfo`：要求 `shopId` 与登录态店铺一致
///
/// `shopShowPicture` / `shopContactConfig` / `shopOpenCloseConfig` /
/// `shopShowCategory` 保持原始 JSON 值（Java 侧为 `List<PicInfo>` /
/// `List<ShopContactConfig>` / `ShopOpenCloseConfig` 对象，
/// 落库统一 `JSONUtil.toJsonStr(...)` / `JSONUtil.toJson(...)`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopWritePayload {
    /// 店铺表 ID（`ShopUpdateDTO.shopId` / `ShopUpdateInfoDTO.shopId`）
    pub shop_id: Option<i32>,
    /// 店铺名称（`ShopCreateDTO.shopTitle`，`@NotNull` + `@Size(max = 50)`）
    pub shop_title: Option<String>,
    /// 店铺 logo / 门店 logo
    pub shop_logo: Option<String>,
    /// 联系电话（仅 `ShopUpdateDTO` 有）
    pub contact_mobile: Option<String>,
    /// 商户表 id（仅 `ShopCreateDTO` 有）
    pub merchant_id: Option<i32>,
    /// 店铺类型，默认门店（Java `StoreExtendedDto.shopType` 默认 1）
    pub shop_type: Option<i32>,
    /// 自提时传入门店 id
    pub store_parent_id: Option<i32>,
    /// 门店封面（门店时必填）
    pub shop_cover_picture: Option<String>,
    /// 门头照片（JSON 数组）
    pub shop_show_picture: Option<serde_json::Value>,
    /// 简介
    pub description: Option<String>,
    /// 店铺状态 1 开业 4 暂停运营 10 关店
    pub status: Option<i32>,
    /// 联系方式（JSON 数组）
    pub shop_contact_config: Option<serde_json::Value>,
    /// 运营时间（JSON 对象）
    pub shop_open_close_config: Option<serde_json::Value>,
    /// 门店 regionId 列表
    pub shop_region_ids: Option<Vec<i32>>,
    /// 门店 region 名称（只读回显，不落库）
    pub shop_region_names: Option<Vec<String>>,
    /// 门店详细地址
    pub shop_detailed_address: Option<String>,
    /// 店铺经度
    pub shop_longitude: Option<Decimal>,
    /// 店铺纬度
    pub shop_latitude: Option<Decimal>,
    /// 标签 Id 列表（落 `store_tip`）
    pub shop_tips: Option<Vec<i32>>,
}

/// 店铺设置入参（`dto.shop.ShopSettingDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopSettingPayload {
    /// 店铺表 ID（`@NotNull`）
    pub shop_id: Option<i32>,
    /// 状态（原 Java 字段默认值 1）
    pub status: Option<i32>,
    /// 联系电话
    pub contact_mobile: Option<String>,
    /// 客服电话（原 Java 默认空串）
    pub kefu_phone: Option<String>,
    /// 客服微信（原 Java 默认空串）
    pub kefu_weixin: Option<String>,
    /// 客服链接（原 Java 默认空串）
    pub kefu_link: Option<String>,
    /// 是否联系客服：1 是 0 否（原 Java 默认 1）
    pub is_contact_kefu: Option<i32>,
    /// 客服入口（JSON 数组落 `kefu_inlet`）
    pub kefu_inlet: Option<serde_json::Value>,
    /// 发货信息（JSON 对象落 `ship_info`）
    pub ship_info: Option<serde_json::Value>,
    /// 收货信息（JSON 对象落 `receive_info`）
    pub receive_info: Option<serde_json::Value>,
    /// 是否使用门店分类（0 不使用，1 使用）
    pub use_shop_category: Option<i32>,
    /// 门店分类（JSON 对象落 `shop_show_category`）
    pub shop_show_category: Option<serde_json::Value>,
}

/// 收发货信息（`ShopSettingDTO.ShopDeliveryInfo` / `ShopVO.ShopDeliveryInfo`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopDeliveryInfo {
    /// 联系人
    pub sender: Option<String>,
    /// 联系方式
    pub mobile: Option<String>,
    /// 省份
    pub province_name: Option<String>,
    /// 城市
    pub city_name: Option<String>,
    /// 地区
    pub area_name: Option<String>,
    /// 详细地址
    pub address: Option<String>,
}

/// 店铺管理员账号（对应 Java `MerchantAdminDataDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopMerchantAdminVO {
    /// 管理员 ID
    pub admin_id: i32,
    /// 登录名
    pub username: String,
}

/// 商户信息（`vo.merchant.MerchantVO` 的字段子集）。
///
/// 原 Java 由 `merchantService.getMerchantVO(merchantId)` 组装（含
/// `baseData` / `shopData` / `merchantData` 三个 JSON 与 `user` 关联），
/// 商户服务在 Rust 侧尚未迁移：本切片只回填 `merchant` 表自有列，
/// **`statusText` / `typeText` / `shopCount` / `user` 一律不填充**，
/// 见 `shop_manage` 的 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopMerchantVO {
    /// 商户认证日期（`yyyy-MM-dd HH:mm:ss`；原 Java 由商户服务格式化）
    pub add_time: Option<String>,
    /// 商户 ID
    pub merchant_id: i32,
    /// 入驻申请 ID
    pub merchant_apply_id: Option<i32>,
    /// 申请用户 ID
    pub user_id: Option<i32>,
    /// 企业名称
    pub company_name: Option<String>,
    /// 申请主体信息
    pub corporate_name: Option<String>,
    /// 结算周期（天）
    pub settlement_cycle: Option<i32>,
    /// 状态：1 正常，2 取消资格
    pub status: Option<i32>,
    /// 类型：1 个人，2 企业
    pub r#type: Option<i32>,
    /// 商户数据 JSON 原文（原 Java 为 `JSONObject`，且 `ShopVO.detail` 会置空
    /// `baseData` / `shopData`）
    pub merchant_data: Option<serde_json::Value>,
    /// 基础数据 JSON 原文（`detail` 中固定置空）
    pub base_data: Option<serde_json::Value>,
    /// 店铺数据 JSON 原文（`detail` 中固定置空）
    pub shop_data: Option<serde_json::Value>,
    /// 店铺管理员（列表接口回填：`admin_user_shop.is_admin = 1` 绑定账号）
    pub admin: Option<ShopMerchantAdminVO>,
}

/// 店铺员工绑定信息（`vo.shop.AdminUserShopVO` 的字段子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopAdminUserShopVO {
    /// 绑定记录 ID
    pub id: i32,
    /// 管理员 ID
    pub admin_id: i32,
    /// 用户 ID
    pub user_id: i32,
    /// 店铺 ID
    pub shop_id: i32,
    /// 员工名称
    pub username: String,
    /// 邮箱
    pub email: String,
    /// 头像
    pub avatar: Option<String>,
    /// 是否停用：1 是 0 否
    pub is_using: i32,
    /// 是否管理员：1 是 0 否
    pub is_admin: i32,
    /// 权限组 ID
    pub role_id: i32,
    /// 权限列表（`admin_user_shop.auth_list` 解析结果；`[]` / 空 → `[]`）
    pub auth_list: serde_json::Value,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，0 或空 → 空串）
    pub add_time: String,
}

/// 店铺标签（对应 Java `vo.o2o.TipListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopTipVO {
    /// 标签 ID
    pub tip_id: i32,
    /// 标签名称
    pub tip_name: String,
}

/// 店铺 VO（`vo.shop.ShopVO` + 父类 `StoreExtendedDto`）。
///
/// **出参形态说明**：原 Java 返回 MyBatis-Plus 查询出的 `Shop` 实体经
/// `BeanUtils.copyProperties` 复制的结果，因此**包含了 `shop` 表的全部列**
/// （`serviceFeeRate` / `feeRate` / `autoEraseZero` / `posProductSource` 等）。
/// Rust 侧按需列出前端与业务实际使用的字段，未列出的列（如收银台相关
/// `autoEraseZero` / `defaultCollectionMethod` / `posProductSource`）**不返回**，
/// 需要时请补 [`ShopVO`] 字段而不是让前端去猜。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShopVO {
    /// 店铺 ID（平台自营为 0）
    pub shop_id: i32,
    /// 店铺名称
    pub shop_title: String,
    /// 店铺 logo
    pub shop_logo: Option<String>,
    /// 店铺创建时间（`yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 点击量
    pub click_count: Option<i32>,
    /// 店铺状态 1 开业 4 停业 10 关店
    pub status: Option<i32>,
    /// 状态文案（`ShopType.getTypeName`，未知 code 为空串）
    pub status_text: String,
    /// 店铺类型 1 店铺 2 门店 3 自提点
    pub shop_type: Option<i32>,
    /// 商户 ID
    pub merchant_id: Option<i32>,
    /// 店铺资金
    pub shop_money: Option<Decimal>,
    /// 冻结资金
    pub frozen_money: Option<Decimal>,
    /// 联系电话
    pub contact_mobile: Option<String>,
    /// 简介
    pub description: Option<String>,
    /// 客服电话
    pub kefu_phone: Option<String>,
    /// 客服微信
    pub kefu_weixin: Option<String>,
    /// 客服链接
    pub kefu_link: Option<String>,
    /// 是否联系客服：1 是 0 否
    pub is_contact_kefu: i32,
    /// 客服入口（`shop.kefu_inlet` JSON 数组解析；空 → `[]`）
    pub kefu_inlet: Vec<i32>,
    /// 发货信息（`shop.ship_info` 解析）
    pub ship_info: Option<ShopDeliveryInfo>,
    /// 收货信息（`shop.receive_info` 解析）
    pub receive_info: Option<ShopDeliveryInfo>,
    /// 最后登录时间（秒级时间戳）
    pub last_login_time: i32,
    /// 供应商设价方式（1 按比例，2 按固定数值加价，3 默认售价）
    pub vendor_set_price_type: Option<i32>,
    /// 智能设价（百分比或固定数值）
    pub vendor_set_price_auto_value: Option<Decimal>,
    /// 服务费比例
    pub service_fee_rate: Option<Decimal>,
    /// 手续费比例
    pub fee_rate: Option<Decimal>,
    /// 店铺父级 ID
    pub store_parent_id: Option<i32>,
    /// 门店封面
    pub shop_cover_picture: Option<String>,
    /// 门店相册（`shop.shop_show_picture` 原文 JSON）
    pub shop_show_picture: Option<serde_json::Value>,
    /// 联系方式（`shop.shop_contact_json` 原文 JSON）
    pub shop_contact_config: Option<serde_json::Value>,
    /// 运营时间（`shop.shop_open_close_json` 原文 JSON）
    pub shop_open_close_config: Option<serde_json::Value>,
    /// 门店 regionId 列表（`shop.shop_region_id` 解析）
    pub shop_region_ids: Vec<i32>,
    /// 门店 region 名称（原 Java 由 `regionService` 填充，Rust 侧未迁移 → `[]`）
    pub shop_region_names: Vec<String>,
    /// 门店详细地址
    pub shop_detailed_address: Option<String>,
    /// 店铺经度
    pub shop_longitude: Option<Decimal>,
    /// 店铺纬度
    pub shop_latitude: Option<Decimal>,
    /// 评星
    pub shop_star: Option<Decimal>,
    /// 评价数量
    pub shop_star_num: Option<i32>,
    /// 销量
    pub shop_sales: Option<i32>,
    /// 是否使用门店分类
    pub use_shop_category: Option<i32>,
    /// 门店分类（`shop.shop_show_category` 原文 JSON）
    pub shop_show_category: Option<serde_json::Value>,
    /// 是否删除：null 或 0 表示未删除
    pub is_delete: Option<i32>,
    /// 标签 ID 列表（`store_tip.tip_id`）
    pub shop_tips: Vec<i32>,
    /// 标签（`store_tip` ⋈ `tip`）
    pub tips: Vec<ShopTipVO>,
    /// 商品评分（`AVG(comment_rank)`，仅 `detail` 填充）
    pub product_score: Option<Decimal>,
    /// 上级组织名称（原 Java 由店铺服务填充，Rust 侧未迁移 → `None`）
    pub store_parent_name: Option<String>,
    /// 是否选中（原 Java `ShopVO.check` 默认 false）
    pub check: bool,
    /// 商户数据
    pub merchant: Option<ShopMerchantVO>,
    /// 当前管理员的店铺绑定（仅 `detail`/`currentDetail` 填充）
    pub admin_user_shop: Option<ShopAdminUserShopVO>,
}

/// 员工展示信息（`vo.shop.StaffShowVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffShowVO {
    /// 已有员工数（`is_using = 0`）
    pub using_user: i32,
    /// 停用员工数（`is_using = 1`）
    pub stop_using_user: i32,
    /// 剩余可添加的子管理员数
    pub residue: i32,
    /// 最近员工操作（最多 5 条）
    pub admin_log: Vec<StaffAdminLogVO>,
}

/// 员工操作日志（`StaffShowVO.AdminLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffAdminLogVO {
    /// 日志 ID
    pub log_id: i32,
    /// 日志时间（`yyyy-MM-dd HH:mm:ss`）
    pub log_time: String,
    /// 操作人 ID
    pub user_id: i32,
    /// 日志详情
    pub log_info: String,
    /// IP
    pub ip_address: String,
    /// 操作人名称（查不到时为空串）
    pub username: String,
}

/// 供应商配置（`vo.vendor.ShopVendorSettingVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VendorSettingVO {
    /// 供应商设价方式：1 按比例，2 按固定数值加价，3 默认售价
    pub vendor_set_price_type: Option<i32>,
    /// 智能设价（原 Java 为 `String`，库列为 `decimal(10,2)`，按原文返回）
    pub vendor_set_price_auto_value: Option<String>,
}

/// 供应商配置更新入参（`param.vendor.ShopVendorSettingUpdateParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct VendorSettingUpdateParam {
    /// 供应商设价方式：1 按比例，2 按固定数值加价，3 默认售价
    pub vendor_set_price_type: Option<i32>,
    /// 智能设价（原 Java 为 `String`）
    pub vendor_set_price_auto_value: Option<String>,
}

/// 门店列表项（`vo.o2o.StoreListVO` 的字段子集，本域只用 `shopId`/`shopTitle`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreListVO {
    /// 门店 ID
    pub shop_id: i32,
    /// 门店名称
    pub shop_title: Option<String>,
}

/// 收银台登录偏好设置入参（`dto.shop.PosLoginSettingDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PosLoginSettingPayload {
    /// 门店 ID
    pub shop_id: Option<i32>,
    /// 登录后是否默认进收银台：1 是 0 否
    pub default_pos_login: Option<i32>,
    /// 上次登录端：admin/shop/store/pos
    pub last_login_system: Option<String>,
}

/// 选择登录平台入参（`param.login.LoginChooseParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LoginChooseParam {
    /// 登录端类型：`admin` / `shop` / `vendor` / `store`
    pub admin_type: Option<String>,
    /// 目标组织 ID（字符串形态，原 Java 字段为 `String id`）
    pub id: Option<String>,
}

/// 通用操作入参（`dto.common.OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作入参（`dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合（`@NotEmpty`）
    pub ids: Option<Vec<i32>>,
    /// 操作类型（`@NotNull`，本域仅支持 `del`）
    pub r#type: Option<String>,
    /// 值
    pub value: Option<i32>,
    /// 数据
    pub data: Option<serde_json::Value>,
}

/// 通用字段更新入参（`dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（`@NotNull`）
    pub id: Option<i32>,
    /// 字段名（`@NotNull`；驼峰属性名或库列名）
    pub field: Option<String>,
    /// 值（`@NotNull`，字符串形态）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shop_status_text_matches_java_enums() {
        // ShopType / StoreType: 1 开业 4 停业 10 打烊
        assert_eq!(shop_status_text(Some(1), Some(1)), "开业");
        assert_eq!(shop_status_text(Some(4), Some(2)), "停业");
        assert_eq!(shop_status_text(Some(10), Some(1)), "打烊");
        // StorePickupType: 1 启用 4 停业 10 禁用
        assert_eq!(shop_status_text(Some(1), Some(3)), "启用");
        assert_eq!(shop_status_text(Some(10), Some(3)), "禁用");
        // 未知 code / 空状态 → 空串（Java 抛异常，Rust 侧避免整页失败）
        assert_eq!(shop_status_text(Some(99), Some(1)), "");
        assert_eq!(shop_status_text(None, Some(1)), "");
    }

    #[test]
    fn list_query_accepts_camel_case_and_size_alias() {
        let q: ShopListQuery = serde_json::from_str(
            r#"{"isMyShop":1,"shopType":2,"shopTypes":[2,3],"includeSelfOperated":1,
                "excludeSelfOperated":0,"status":1,"shopTitle":"店","mainAccount":"a",
                "account":"b","shopIds":[1,2],"shopId":5,"storeParentId":9,
                "addStartTime":"2026-01-01",
                "addEndTime":"2026-01-31","areaStoreManagerId":3,"shopRegionId":"1",
                "corporateName":"公司","keyword":"kw","sortField":"lastLoginTime",
                "sortOrder":"desc","page":2,"size":30}"#,
        )
        .expect("ShopListQuery 应接受 camelCase");
        assert_eq!(q.is_my_shop_flag(), 1);
        assert_eq!(q.shop_type_or_default(), 2);
        assert_eq!(q.shop_types.as_deref(), Some(&[2, 3][..]));
        assert_eq!(q.include_self_operated_flag(), 1);
        assert_eq!(q.exclude_self_operated, Some(0));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.shop_ids.as_deref(), Some(&[1, 2][..]));
        assert_eq!(q.shop_id, Some(5));
        assert_eq!(q.store_parent_id, Some(9));
        assert_eq!(q.area_store_manager_id, Some(3));
        assert_eq!(q.corporate_name.as_deref(), Some("公司"));
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.page_size(), 30);
    }

    #[test]
    fn list_query_page_size_clamps_and_aliases() {
        let q: ShopListQuery = serde_json::from_str(r#"{"pageSize":500}"#).unwrap();
        assert_eq!(q.page_size(), 100);
        let q = ShopListQuery::default();
        assert_eq!(q.page_size(), 15);
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.shop_type_or_default(), 1);
        assert_eq!(q.is_my_shop_flag(), 0);
        assert_eq!(q.select_flag(), 0);
    }

    #[test]
    fn write_payload_keeps_raw_json_fields() {
        let p: ShopWritePayload = serde_json::from_str(
            r#"{"shopId":5,"shopTitle":"店","shopType":2,"shopShowPicture":[{"picUrl":"a.png"}],
                "shopContactConfig":[{"type":3,"values":"0571-1"}],
                "shopOpenCloseConfig":{"type":2,"times":[{"start":"09:00","end":"18:00"}]},
                "shopRegionIds":[1,2],"shopTips":[7],"shopLongitude":"120.1","shopLatitude":"30.2"}"#,
        )
        .unwrap();
        assert_eq!(p.shop_id, Some(5));
        assert!(p.shop_show_picture.as_ref().unwrap().is_array());
        assert!(p.shop_open_close_config.as_ref().unwrap().is_object());
        assert_eq!(p.shop_region_ids.as_deref(), Some(&[1, 2][..]));
        assert_eq!(p.shop_tips.as_deref(), Some(&[7][..]));
        assert_eq!(p.shop_longitude, Some("120.1".parse::<Decimal>().unwrap()));
    }

    #[test]
    fn setting_payload_defaults_are_none_but_java_defaults_are_documented() {
        let s: ShopSettingPayload = serde_json::from_str(r#"{"shopId":1}"#).unwrap();
        assert_eq!(s.shop_id, Some(1));
        // 原 Java 字段默认值：status=1、isContactKefu=1、kefu*=""
        assert_eq!(s.status, None);
    }
}
