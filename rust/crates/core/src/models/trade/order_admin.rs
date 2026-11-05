//! 订单管理域（trade::order_admin）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.order.OrderListPageQuery`（`list` 查询参数）
//! - `com.tigshop.bean.dto.order.deliver.DeliverOrderParam` / `DeliverInfo`
//! - `com.tigshop.bean.param.order.AftersalesApplyAdminParam`（`cancelOrderByAdmin`）
//! - `com.tigshop.bean.vo.order.OrderVO` / `OrderItemVO` / `OrderActionVO`
//! - 枚举 `OrderStatusEnum` / `PaymentStatus` / `ShippingStatusEnum` /
//!   `AftersalesStatusEnum` / `AftersalesTypeEnum`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! **说明（为什么这里没有直接复用 `tigshop_core::models::trade::order`）**：
//! 共享的 `models::order::OrderVO` 是早期引导阶段的简化结构（且其配套
//! `services::order` 的状态常量 10/20/30/40 与真实库口径 0/1/2/3/4/5 不一致），
//! 与本切片对照 Java 源逐字段还原的 `OrderVO` 无法共存；本切片不得修改
//! 共享文件，故在本文件内定义订单管理域专用结构。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// URL 查询串的反序列化适配。
///
/// Spring 把 `List<Integer>` / `Boolean` 参数绑定得比 `serde_urlencoded` 宽松
/// （`orderIds=1,2`、`includeInvalid=1` 都能绑上），本模块补齐这些形态，
/// 避免主列表接口因参数形态差异直接 400。
mod de {
    use std::fmt;

    use serde::de::{self, Deserializer, SeqAccess, Visitor};

    use super::SortItemDTO;

    /// `1,2,3` 或 `[1,2,3]` 或 `null` → `Option<Vec<i32>>`。
    struct I32ListVisitor;

    impl<'de> Visitor<'de> for I32ListVisitor {
        type Value = Option<Vec<i32>>;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("整数数组或逗号分隔的整数字符串")
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            let mut out = Vec::new();
            for p in v.split(',') {
                let p = p.trim();
                if p.is_empty() {
                    continue;
                }
                out.push(p.parse::<i32>().map_err(E::custom)?);
            }
            Ok(Some(out))
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
            let mut out = Vec::new();
            while let Some(v) = seq.next_element::<i32>()? {
                out.push(v);
            }
            Ok(Some(out))
        }
    }

    /// `orderIds` / `memberTagIds` 字段反序列化。
    pub(super) fn opt_i32_list<'de, D: Deserializer<'de>>(
        d: D,
    ) -> Result<Option<Vec<i32>>, D::Error> {
        d.deserialize_any(I32ListVisitor)
    }

    /// `1,2` 或 `[1,2]` → `Option<Vec<i64>>`。
    struct I64ListVisitor;

    impl<'de> Visitor<'de> for I64ListVisitor {
        type Value = Option<Vec<i64>>;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("整数数组或逗号分隔的整数字符串")
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            let mut out = Vec::new();
            for p in v.split(',') {
                let p = p.trim();
                if p.is_empty() {
                    continue;
                }
                out.push(p.parse::<i64>().map_err(E::custom)?);
            }
            Ok(Some(out))
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
            let mut out = Vec::new();
            while let Some(v) = seq.next_element::<i64>()? {
                out.push(v);
            }
            Ok(Some(out))
        }
    }

    /// `memberTagIds` 字段反序列化。
    pub(super) fn opt_i64_list<'de, D: Deserializer<'de>>(
        d: D,
    ) -> Result<Option<Vec<i64>>, D::Error> {
        d.deserialize_any(I64ListVisitor)
    }

    /// `true/false/1/0/yes/no/on/off` 或空串（→ `None`）。
    struct BoolVisitor;

    impl<'de> Visitor<'de> for BoolVisitor {
        type Value = Option<bool>;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("布尔值(true/false/1/0)")
        }

        fn visit_bool<E: de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v != 0))
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            match v.trim().to_ascii_lowercase().as_str() {
                "" => Ok(None),
                "1" | "true" | "yes" | "on" => Ok(Some(true)),
                "0" | "false" | "no" | "off" => Ok(Some(false)),
                other => Err(E::custom(format!("非法布尔值: {other}"))),
            }
        }
    }

    /// `includeInvalid` / `invoiceScope` 字段反序列化。
    pub(super) fn opt_bool<'de, D: Deserializer<'de>>(d: D) -> Result<Option<bool>, D::Error> {
        d.deserialize_any(BoolVisitor)
    }

    /// JSON 字符串（`[{"field":"addTime","order":"asc"}]`）或 JSON 数组 → `Option<Vec<SortItemDTO>>`。
    struct SortItemsVisitor;

    impl<'de> Visitor<'de> for SortItemsVisitor {
        type Value = Option<Vec<SortItemDTO>>;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("排序项数组或其 JSON 字符串")
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            let s = v.trim();
            if s.is_empty() {
                return Ok(None);
            }
            serde_json::from_str::<Vec<SortItemDTO>>(s)
                .map(Some)
                .map_err(E::custom)
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Self::Value, A::Error> {
            let mut out = Vec::new();
            while let Some(v) = seq.next_element::<SortItemDTO>()? {
                out.push(v);
            }
            Ok(Some(out))
        }
    }

    /// `sortItems` 字段反序列化。
    pub(super) fn opt_sort_items<'de, D: Deserializer<'de>>(
        d: D,
    ) -> Result<Option<Vec<SortItemDTO>>, D::Error> {
        d.deserialize_any(SortItemsVisitor)
    }
}

// ————————————————————— 状态枚举 —————————————————————

/// 订单状态（对应 Java `OrderStatusEnum`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    /// 待支付
    Pending = 0,
    /// 已确认，待发货（支付后同步为此状态）
    Confirmed = 1,
    /// 处理中，已发货（发货后同步为此状态）
    Processing = 2,
    /// 已取消
    Cancelled = 3,
    /// 无效
    Invalid = 4,
    /// 已完成
    Completed = 5,
}

impl OrderStatus {
    /// 由 code 还原（未知返回 None，对应 Java `getStatus` 抛错）。
    #[must_use]
    pub fn of(code: i32) -> Option<Self> {
        match code {
            0 => Some(Self::Pending),
            1 => Some(Self::Confirmed),
            2 => Some(Self::Processing),
            3 => Some(Self::Cancelled),
            4 => Some(Self::Invalid),
            5 => Some(Self::Completed),
            _ => None,
        }
    }

    /// 状态文案（Java `getStatusName`，未知名返回空串）。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Pending => "待支付",
            Self::Confirmed => "已确认，待发货",
            Self::Processing => "处理中，已发货",
            Self::Cancelled => "已取消",
            Self::Invalid => "无效",
            Self::Completed => "已完成",
        }
    }

    /// 未知 code 的文案（Java `getStatusName` 返回空串）。
    #[must_use]
    pub fn name_of(code: i32) -> String {
        Self::of(code).map_or_else(String::new, |s| s.name().to_string())
    }

    /// 后台订单详情状态头文案（Java `getAdminStatusName`，其余返回 None）。
    #[must_use]
    pub fn admin_name(self) -> Option<&'static str> {
        match self {
            Self::Pending => Some("待付款，待支付"),
            Self::Confirmed => Some("已付款，待发货"),
            Self::Processing => Some("已发货，待收货"),
            Self::Cancelled => Some("订单超时，已取消"),
            Self::Completed => Some("交易完成，订单结束"),
            Self::Invalid => None,
        }
    }

    /// 状态副文案（Java `getStatusTip`）。
    #[must_use]
    pub fn tip(self) -> &'static str {
        match self {
            Self::Pending => "买家已提交订单，请等待付款",
            Self::Confirmed => "买家已提交订单，请尽快发货",
            Self::Processing => "商品已发出，请等待买家签收",
            Self::Cancelled => "买家超时未支付，订单已取消",
            Self::Invalid => "订单已失效",
            Self::Completed => "买家已确认收货，交易已完成",
        }
    }

    /// 状态回退目标（Java `getPreStatus`：待发货→已取消、已发货→待发货）。
    #[must_use]
    pub fn pre_status(self) -> Option<Self> {
        match self {
            Self::Confirmed => Some(Self::Cancelled),
            Self::Processing => Some(Self::Confirmed),
            _ => None,
        }
    }

    /// 预约订单状态文案（Java `OrderReservationStatusEnum.getStatusName`）。
    #[must_use]
    pub fn reservation_name(code: i32) -> &'static str {
        match code {
            0 => "待支付",
            1 | 2 => "预约成功",
            3 => "已取消",
            4 => "无效",
            5 => "已完成",
            _ => "",
        }
    }

    /// 同城配送订单状态文案（Java `OrderSameCityEnum.getStatusName`）。
    #[must_use]
    pub fn same_city_name(code: i32) -> &'static str {
        match code {
            0 => "待支付",
            1 => "已确认，待发货",
            2 => "配送中",
            3 => "已取消",
            4 => "无效",
            5 => "已完成",
            _ => "",
        }
    }
}

/// 支付状态（对应 Java `PaymentStatus`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayStatus {
    /// 未支付
    Unpaid = 0,
    /// 支付中
    Processing = 1,
    /// 已支付
    Paid = 2,
    /// 退款中
    Refunding = 3,
    /// 已退款
    Refunded = 4,
}

impl PayStatus {
    /// 由 code 还原。
    #[must_use]
    pub fn of(code: i32) -> Option<Self> {
        match code {
            0 => Some(Self::Unpaid),
            1 => Some(Self::Processing),
            2 => Some(Self::Paid),
            3 => Some(Self::Refunding),
            4 => Some(Self::Refunded),
            _ => None,
        }
    }

    /// 状态文案（Java `getStatusName`）。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Unpaid => "未支付",
            Self::Processing => "支付中",
            Self::Paid => "已支付",
            Self::Refunding => "退款中",
            Self::Refunded => "已退款",
        }
    }

    /// 未知 code 的文案（Java 返回空串）。
    #[must_use]
    pub fn name_of(code: i32) -> String {
        Self::of(code).map_or_else(String::new, |s| s.name().to_string())
    }
}

/// 发货状态（对应 Java `ShippingStatusEnum`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShippingStatus {
    /// 待发货
    Pending = 0,
    /// 已发货
    Sent = 1,
    /// 已收货
    Shipped = 2,
    /// 配送失败
    Failed = 3,
    /// 配送中
    InTransit = 4,
    /// 已发货，待配送
    SentWaitingDelivery = 5,
}

impl ShippingStatus {
    /// 由 code 还原。
    #[must_use]
    pub fn of(code: i32) -> Option<Self> {
        match code {
            0 => Some(Self::Pending),
            1 => Some(Self::Sent),
            2 => Some(Self::Shipped),
            3 => Some(Self::Failed),
            4 => Some(Self::InTransit),
            5 => Some(Self::SentWaitingDelivery),
            _ => None,
        }
    }

    /// 状态文案（Java `getStatusName`）。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Pending => "待发货",
            Self::Sent => "已发货",
            Self::Shipped => "已收货",
            Self::Failed => "配送失败",
            Self::InTransit => "配送中",
            Self::SentWaitingDelivery => "已发货，待配送",
        }
    }

    /// 未知 code 的文案（Java 返回空串）。
    #[must_use]
    pub fn name_of(code: i32) -> String {
        Self::of(code).map_or_else(String::new, |s| s.name().to_string())
    }
}

/// 售后状态码（对应 Java `AftersalesStatusEnum`）。
pub mod aftersales_status {
    /// 审核处理中
    pub const IN_REVIEW: i32 = 1;
    /// 审核通过
    pub const APPROVED_FOR_PROCESSING: i32 = 2;
    /// 审核未通过（终态）
    pub const REFUSE: i32 = 3;
    /// 待回寄
    pub const SEND_BACK: i32 = 4;
    /// 待商家收货
    pub const RETURNED: i32 = 5;
    /// 已完成（终态）
    pub const COMPLETE: i32 = 6;
    /// 已取消（终态）
    pub const CANCEL: i32 = 7;
    /// 待供应商审核
    pub const WAIT_FOR_SUPPLIER_AUDIT: i32 = 21;
    /// 待供应商收货
    pub const WAIT_FOR_SUPPLIER_RECEIPT: i32 = 22;

    /// 占用可售后数量的「有效状态」（Java `AftersalesStatusEnum.validStatus()`）。
    #[must_use]
    pub fn valid_statuses() -> [i32; 5] {
        [
            IN_REVIEW,
            APPROVED_FOR_PROCESSING,
            SEND_BACK,
            RETURNED,
            COMPLETE,
        ]
    }

    /// 「售后进行中」状态（Java `inProgressStatus()`，不含已完成/已取消/已驳回）。
    #[must_use]
    pub fn in_progress_statuses() -> [i32; 4] {
        [IN_REVIEW, APPROVED_FOR_PROCESSING, SEND_BACK, RETURNED]
    }

    /// 「已申请售后」查询用状态（Java `getAfterSalseStatusList()` 的非供应商口径）。
    #[must_use]
    pub fn applied_statuses() -> [i32; 4] {
        [IN_REVIEW, APPROVED_FOR_PROCESSING, SEND_BACK, RETURNED]
    }
}

/// 售后类型（对应 Java `AftersalesTypeEnum`）。
pub mod aftersales_type {
    /// 退货退款
    pub const RETURN: i32 = 1;
    /// 仅退款
    pub const PAY_RETURN: i32 = 2;
}

/// 订单类型（对应 Java `OrderType`，仅列出本切片用到的取值）。
pub mod order_type {
    /// 普通订单
    pub const NORMAL: i32 = 1;
    /// 拼团订单
    pub const PIN: i32 = 2;
    /// 预约到店
    pub const RESERVATION_STORE: i32 = 9;
    /// 预约上门
    pub const RESERVATION_HOME: i32 = 10;
}

/// 发货方式（Java `OrderVO.shippingMethod` / `DeliverOrderParam.shippingMethod`）。
pub mod shipping_method {
    /// 物流配送
    pub const LOGISTICS: i32 = 1;
    /// 商家配送
    pub const MERCHANT: i32 = 2;
    /// 无需配送
    pub const NONE: i32 = 3;
    /// 电子面单
    pub const WAYBILL: i32 = 4;
}

/// 支付类型（对应 Java `PayType`，`order.pay_type_id`）。
pub mod pay_type {
    /// 在线支付
    pub const ONLINE: i32 = 1;
    /// 现金支付
    pub const CASH: i32 = 2;
    /// 线下支付
    pub const OFFLINE: i32 = 3;
}

/// 拼团状态（对应 Java `JoinStatusEnum`）。
pub mod join_status {
    /// 待成团
    pub const WAIT_GROUP: i32 = 1;
    /// 拼团成功
    pub const SUCCESS: i32 = 2;
    /// 拼团失败
    pub const FAIL: i32 = 3;
    /// 已取消
    pub const CANCELLED: i32 = 4;

    /// 描述文案（Java `JoinStatusEnum.getDescription`）。
    #[must_use]
    pub fn description(code: i32) -> String {
        match code {
            WAIT_GROUP => "待成团".into(),
            SUCCESS => "拼团成功".into(),
            FAIL => "拼团失败".into(),
            CANCELLED => "已取消".into(),
            _ => String::new(),
        }
    }
}

// ————————————————————— 查询参数 —————————————————————

/// 排序项（对应 Java `com.tigshop.common.core.entity.SortItem`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SortItemDTO {
    /// 排序字段（Java 属性名，驼峰；服务层映射为真实列名，白名单外忽略）
    pub field: Option<String>,
    /// `asc` / `desc`
    pub order: Option<String>,
}

/// 订单列表查询（对应 Java `OrderListPageQuery extends BasePage`）。
///
/// 分页字段与 Java `BasePage` 一致：`page`（默认 1）、`size`（默认 15，上限 100）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderListQuery {
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 关键词：订单号 / 收货人 / 订单商品名 / 订单ID
    pub keyword: Option<String>,
    /// 排序字段（单字段排序）
    pub sort_field: Option<String>,
    /// `asc` / `desc`
    pub sort_order: Option<String>,
    /// 多字段排序（JSON 数组或 JSON 字符串；`serde_urlencoded` 不支持嵌套数组时可用字符串形式）
    #[serde(default, deserialize_with = "de::opt_sort_items")]
    pub sort_items: Option<Vec<SortItemDTO>>,

    /// 用户ID
    pub user_id: Option<i32>,
    /// 订单状态，逗号分隔；单值 `-2` 表示查询「已删除订单」
    pub order_status: Option<String>,
    /// 支付状态（-1 不限）
    pub pay_status: Option<i32>,
    /// 发货状态（-1 不限）
    pub shipping_status: Option<i32>,
    /// 地址（匹配 address / region_names）
    pub address: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 物流公司ID
    pub logistics_id: Option<i64>,
    /// 下单开始日期 `yyyy-MM-dd`
    pub add_start_time: Option<String>,
    /// 下单结束日期 `yyyy-MM-dd`
    pub add_end_time: Option<String>,
    /// 支付时间区间，`开始日期,结束日期`
    pub pay_time: Option<String>,
    /// 评论状态（-1 不限；0 表示已完成且未评价）
    pub comment_status: Option<i32>,
    /// 是否结算（>-1 生效；0 时排除待成团订单）
    pub is_settlement: Option<i32>,
    /// 是否积分兑换订单（>-1 生效）
    pub is_exchange_order: Option<i32>,
    /// 是否周期购订单（>-1 生效；周期购订单页使用）
    pub is_cycle_order: Option<i32>,
    /// 标记（-1 不限）
    pub mark: Option<i32>,
    /// 指定订单ID集合（`1,2` 或 `[1,2]`）
    #[serde(default, deserialize_with = "de::opt_i32_list")]
    pub order_ids: Option<Vec<i32>>,
    /// PC 端日期检索：1 近30天 2 近60天 3 近365天 4 近1天
    pub data_type: Option<i32>,
    /// 待晒单：>-1 时按评论表过滤（Java 需配合 userId）
    pub is_showed: Option<i32>,
    /// 店铺ID
    pub shop_id: Option<i32>,
    /// 供应商ID（-2 表示「有供应商的订单」）
    pub vendor_id: Option<i32>,
    /// 支付方式（`balance` 表示余额支付；其余按支付日志筛选）
    pub pay_code: Option<String>,
    /// 支付类型（`order.pay_type_id`，v5.8.61 线下认款列表使用）
    pub pay_type_id: Option<i32>,
    /// 订单来源，逗号分隔
    pub order_source: Option<String>,
    /// 渠道子来源（微信直播归因）
    pub order_sub_source: Option<String>,
    /// 微信直播主键ID
    pub wechat_live_id: Option<i32>,
    /// 微信直播房间ID
    pub wechat_live_room_id: Option<i32>,
    /// 微信直播商品ID
    pub wechat_goods_id: Option<i32>,
    /// 直播分享人 openId
    pub live_share_open_id: Option<String>,
    /// 直播同步状态
    pub live_sync_status: Option<i32>,
    /// 父订单ID（周期购子订单列表）
    pub parent_order_id: Option<i32>,
    /// 交易号
    pub out_trade_no: Option<String>,
    /// 是否包含已失效订单（拆单父订单）；接受 `true/false/1/0`
    #[serde(default, deserialize_with = "de::opt_bool")]
    pub include_invalid: Option<bool>,
    /// 发票场景：已完成订单或已提交发票申请；接受 `true/false/1/0`
    #[serde(default, deserialize_with = "de::opt_bool")]
    pub invoice_scope: Option<bool>,
    /// 会员标签ID集合
    #[serde(default, deserialize_with = "de::opt_i64_list")]
    pub member_tag_ids: Option<Vec<i64>>,
    /// 会员标签匹配模式：1-全部匹配，其他-任一匹配
    #[serde(default)]
    pub member_tag_match_mode: Option<i32>,
    /// 由会员标签解析出的目标用户ID列表（内部过滤用）
    #[serde(skip)]
    pub tag_user_ids: Option<Vec<i32>>,
    /// 导出列（Java `OrderListPageQuery.exportItem`，`@NotBlank`「请选择导出项」，
    /// 逗号分隔的 `getExportItemList` key；仅 `orderExport` 使用）
    pub export_item: Option<String>,
}

impl OrderListQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断为 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数（保持与 `PageResult` 口径一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// 是否为「查询已删除订单」语义（Java：`orderStatus == "-2"`）。
    #[must_use]
    pub fn only_deleted(&self) -> bool {
        self.order_status.as_deref().map(str::trim) == Some("-2")
    }

    /// 解析订单状态列表（Java：逗号分隔，负数不参与状态过滤）。
    #[must_use]
    pub fn order_status_codes(&self) -> Vec<i32> {
        self.order_status
            .as_deref()
            .map(|s| {
                s.split(',')
                    .filter_map(|x| x.trim().parse::<i32>().ok())
                    .filter(|v| *v >= 0)
                    .collect()
            })
            .unwrap_or_default()
    }
}

// ————————————————————— 发货参数 —————————————————————

/// 发货明细项（对应 Java `DeliverInfo`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DeliverInfo {
    /// 订单商品明细ID（`order_item.item_id`）
    pub item_id: Option<i32>,
    /// 本次发货数量
    pub to_delivery_quantity: Option<i32>,
}

/// 发货参数（对应 Java `DeliverOrderParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DeliverOrderParam {
    /// 订单ID（Java `@NotNull`）
    pub id: Option<i32>,
    /// 各明细发货数量
    pub deliver_data: Option<Vec<DeliverInfo>>,
    /// 物流公司ID（发货方式=1/4 必填）
    pub logistics_id: Option<i32>,
    /// 发货方式：1 物流 2 商家配送 3 无需配送 4 电子面单
    pub shipping_method: Option<i32>,
    /// 快递单号（发货方式=1 必填）
    pub tracking_no: Option<String>,
    /// 电子面单备注
    pub bill_remark: Option<String>,
    /// 是否自动核销（预约订单）
    pub is_auto_write_off: Option<bool>,
    /// 是否忽略当前登录用户（Java 内部标记）
    pub user_id_is_null: Option<bool>,
    /// 来源：1 配送订单抢单
    pub from: Option<i32>,
}

impl DeliverOrderParam {
    /// 明细ID → 发货数量。
    #[must_use]
    pub fn deliver_quantity_map(&self) -> std::collections::HashMap<i32, i32> {
        self.deliver_data
            .as_deref()
            .unwrap_or_default()
            .iter()
            .filter_map(|d| d.item_id.zip(d.to_delivery_quantity))
            .collect()
    }
}

// ————————————————————— 后台取消订单参数 —————————————————————

/// 售后申请明细（对应 Java `AftersalesApplyAdminParam.ItemsDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesAdminItemDTO {
    /// 订单商品明细ID
    pub order_item_id: Option<i32>,
    /// 申请数量
    pub number: Option<i32>,
}

/// 后台取消订单参数（对应 Java `AftersalesApplyAdminParam`）。
///
/// `pics` 用 `serde_json::Value` 原样承接（Java `List<ReturnPicDTO>`），
/// 避免凭空猜测图片 DTO 的字段名；写入 `aftersales.pics` 时原样序列化。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesApplyAdminParam {
    /// 订单ID（Java `@NotNull`）
    pub order_id: Option<i32>,
    /// 售后类型（服务层固定为「仅退款」=2）
    pub aftersale_type: Option<i32>,
    /// 售后原因（服务层固定为「其他」）
    pub aftersale_reason: Option<String>,
    /// 描述（空则「商家取消订单」）
    pub description: Option<String>,
    /// 退款金额（空则 0，由售后审核阶段计算）
    pub refund_amount: Option<Decimal>,
    /// 凭证图片（原样透传）
    pub pics: Option<Vec<serde_json::Value>>,
    /// 申请明细（后台取消订单时服务层按整单自动生成，前端传值不采用）
    pub items: Option<Vec<AftersalesAdminItemDTO>>,
    /// 用户ID（服务层覆盖为订单所属用户）
    pub user_id: Option<i32>,
}

// ————————————————————— 返回结构 —————————————————————

/// 订单 VO（对应 Java `OrderVO`，见模块头「未迁移字段」说明）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderVO {
    // *** Order 表字段 ***
    pub order_id: i32,
    pub order_type: Option<i32>,
    pub order_sn: String,
    pub user_id: i32,
    pub parent_order_id: Option<i32>,
    pub parent_order_sn: Option<String>,
    pub order_status: i32,
    pub shipping_status: i32,
    pub pay_status: i32,
    pub consignee: String,
    pub address: String,
    pub mobile: String,
    pub email: String,
    pub buyer_note: String,
    pub admin_note: String,
    pub shipping_method: i32,
    pub logistics_id: i32,
    pub logistics_provider: i32,
    pub logistics_name: String,
    pub shipping_type_id: i32,
    pub shipping_type_name: String,
    pub tracking_no: String,
    pub pay_type_id: i32,
    pub use_points: i32,
    pub is_need_commisson: i32,
    pub distribution_status: i32,
    pub referrer_user_id: i32,
    pub is_del: i32,
    pub shop_id: i32,
    pub is_store_splited: i32,
    pub is_valid: i32,
    pub comment_status: i32,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
    pub unpaid_amount: Decimal,
    pub unrefund_amount: Decimal,
    pub product_amount: Decimal,
    pub coupon_amount: Decimal,
    pub points_amount: Decimal,
    pub discount_amount: Decimal,
    pub balance: Decimal,
    pub credit_amount: Decimal,
    pub is_credit_order: i32,
    pub online_paid_amount: Decimal,
    pub offline_paid_amount: Decimal,
    pub service_fee: Decimal,
    pub shipping_fee: Decimal,
    pub invoice_fee: Decimal,
    pub order_extension: String,
    pub order_source: String,
    pub out_trade_no: Option<String>,
    pub is_settlement: Option<i32>,
    pub is_exchange_order: Option<i32>,
    pub mark: Option<i32>,
    pub is_presale: i32,
    pub presale_type: Option<i32>,
    pub vendor_id: Option<i32>,
    pub cancel_remark: Option<String>,
    pub round_off_cents_amount: Decimal,
    pub round_off_dime_amount: Decimal,
    pub tax_rate: Decimal,
    pub tax_rate_amount: Decimal,
    pub discount_change_price: Option<Decimal>,

    // *** 派生字段 ***
    /// 订单状态文案（Java `orderStatusName`）
    pub order_status_name: String,
    /// 订单状态副文案（Java `orderStatusTip`）
    pub order_status_tip: Option<String>,
    /// 支付状态文案
    pub pay_status_name: String,
    /// 发货状态文案
    pub shipping_status_name: String,
    /// 订单生成时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 订单支付时间（0 则为 null）
    pub pay_time: Option<String>,
    /// 订单发货时间（0 则为 null）
    pub shipping_time: Option<String>,
    /// 订单收货时间（0 则为 null）
    pub received_time: Option<String>,
    /// 【JSON】地址ID
    pub region_ids: Vec<i32>,
    /// 【JSON】地址名称
    pub region_names: Vec<String>,
    /// 【JSON】收货人信息（原样解析，字段名保持库中 JSON 结构）
    pub address_data: Option<serde_json::Value>,
    /// 【JSON】发票信息（原样解析）
    pub invoice_data: Option<serde_json::Value>,
    /// 完整地址（省市区 + 详细地址）
    pub user_address: Option<String>,
    /// 服务器当前时间 `yyyy-MM-dd HH:mm:ss`（买家端倒计时基准）
    pub server_time: Option<String>,
    /// 待支付订单的支付截止时间
    pub pay_end_time: Option<String>,
    /// 是否允许使用电子面单（Java：默认构造 false，`OrderVO(Order)` 构造 true）
    pub way_bill: bool,
    /// 上级订单状态（订单流转设置开启时下发，本切片固定 None）
    pub pre_order_status: Option<i32>,
    /// 上级订单状态描述
    pub pre_order_status_desc: Option<String>,
    /// 订单流转设置；0 关闭 1 开启（本切片固定 0）
    pub is_change_order_status: i32,
    /// 一次购买/转评论等入口是否展示（Java `toAftersalses`）
    pub to_aftersalses: bool,
    /// 拼团状态；1-待成团 2-拼团成功 3-拼团失败 4-已取消（仅拼团订单）
    pub join_status: Option<i32>,
    /// 拼团状态描述
    pub join_status_desc: Option<String>,
    /// 拼团记录ID
    pub groupon_promotion_record_id: Option<i64>,

    // *** 关联数据 ***
    /// 商品数据
    pub items: Vec<OrderItemVO>,
    /// 用户数据（Java 始终下发，未查到用户时为空对象）
    pub user: Option<OrderUserVO>,
    /// 店铺信息（仅店铺订单下发，与 Java 一致）
    pub shop: Option<OrderShopVO>,
    /// 店铺名称
    pub shop_name: Option<String>,
    /// 供应商名称（本切片未接入供应商域，固定空串）
    pub vendor_name: String,
    /// 可操作项
    pub available_actions: OrderActionVO,

    // *** 打印 / 拆单派生字段（对应 Java `OrderVO.host` / `printTime` / `subOrderIds`） ***
    /// 打印接口下发的站点根地址（Java 由 `HttpServletRequest` 的 scheme/host/port 拼装；
    /// Rust 侧改由请求头 `x-forwarded-proto` + `host` 拼装，见 `routes::order_admin`）
    pub host: Option<String>,
    /// 打印时间（Java `DateUtil.date(now)` 的 `toString()` 形态，缺省为当前时间字符串）
    pub print_time: Option<String>,
    /// 拆单子订单ID集合（仅 `parentDetail` 下发）
    pub sub_order_ids: Option<Vec<i32>>,
    /// 支付方式（Java `OrderVO.payLog.payCode`；仅导出接口按 `paylog` 回填）
    pub pay_code: Option<String>,
}

/// 订单商品 VO（对应 Java `OrderItemVO` 的展示必需字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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
    /// 规格明细数组（原版前端按数组渲染 `名称：值 | ...`）
    pub sku_data: Vec<serde_json::Value>,
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
    /// 规格文案 `名称:值|名称:值`（Java 由 `product_sku.sku_data` 生成；
    /// Rust 侧直接取下单快照 `order_item.sku_data`，见服务层 `sku_value_of`）
    pub sku_value: Option<String>,
    /// 商品重量（Java 取 `product.product_weight`；仅导出接口填充，其余接口为 null）
    pub product_weight: Option<Decimal>,
}

/// 用户摘要（对应 Java `UserBaseVO` 的展示必需字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderUserVO {
    pub user_id: i32,
    pub username: String,
    pub nickname: Option<String>,
    pub avatar: String,
    pub mobile: String,
    pub email: String,
}

/// 店铺摘要（对应 Java `OrderVO.ShopVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderShopVO {
    pub shop_id: i32,
    pub shop_title: String,
    /// 门店状态文案（Java `ShopType.getTypeName`）
    pub status_text: String,
    pub kefu_inlet: Option<String>,
    pub shop_logo: Option<String>,
}

/// 订单可操作项（对应 Java `OrderActionVO`，默认全 false）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderActionVO {
    pub cancel_order: bool,
    pub confirm_receipt: bool,
    pub del_order: bool,
    pub deliver: bool,
    pub modify_order: bool,
    pub modify_order_consignee: bool,
    pub modify_order_money: bool,
    pub modify_order_product: bool,
    pub modify_shipping_info: bool,
    pub rebuy: bool,
    pub set_confirm: bool,
    pub set_paid: bool,
    pub set_unpaid: bool,
    pub split_order: bool,
    pub to_aftersales: bool,
    pub to_comment: bool,
    pub to_pay: bool,
}

// ————————————————————— 订单操作参数（trade::order_admin 扩展） —————————————————————

/// 通用「订单ID + 备注」请求体（对应 Java `OrderIdDTO`）。
///
/// `setConfirm` / `splitStoreOrder` / `setPaid` / `cancelOrder` / `delOrder` /
/// `confirmReceipt` 六个端点共用该 DTO，Java 侧 `id` 无 `@NotNull`，
/// 服务层按「缺失即 400」处理。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderIdParam {
    /// 订单ID
    pub id: Option<i32>,
    /// 取消原因 / 支付日志描述
    pub description: Option<String>,
}

/// 商家备注参数（对应 Java `OrderAdminNoteParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderAdminNoteParam {
    /// 单个订单ID
    pub id: Option<i32>,
    /// 批量订单ID，逗号分隔（非空时优先于 `id`）
    pub ids: Option<String>,
    /// 备注
    pub admin_note: Option<String>,
    /// 标记 1~5
    pub mark: Option<i32>,
}

impl OrderAdminNoteParam {
    /// 目标订单ID（Java：`ids` 非空则按逗号拆分，否则只处理 `id`；
    /// 非法数字片段直接丢弃，与 Java `Integer.parseInt` 抛错的差异见 uncertain_points）。
    #[must_use]
    pub fn target_ids(&self) -> Vec<i32> {
        if let Some(raw) = self.ids.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            return raw
                .split(',')
                .filter_map(|p| p.trim().parse::<i32>().ok())
                .collect();
        }
        self.id.into_iter().collect()
    }
}

/// 订单金额修改参数（对应 Java `OrderModifyMoneyDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderModifyMoneyParam {
    /// 被操作的订单id
    pub id: Option<i32>,
    /// 运费
    pub shipping_fee: Option<Decimal>,
    /// 发票费
    pub invoice_fee: Option<Decimal>,
    /// 服务费
    pub service_fee: Option<Decimal>,
    /// 折扣金额（按明细小计比例分摊到各 `order_item.price`）
    pub discount_amount: Option<Decimal>,
    /// 是否更换订单号：0 否，1 是（仅未支付且待支付订单可更换）
    pub update_order_sn: Option<i32>,
}

/// 收货人信息修改参数（对应 Java `OrderModifyConsigneeDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderModifyConsigneeParam {
    /// 被操作的订单id
    pub id: Option<i32>,
    /// 收货人姓名
    pub consignee: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 电话
    pub telephone: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 邮政编码
    pub postcode: Option<String>,
    /// 地区ID列表（写入 `order.region_ids`，名称由 `region` 表回填）
    pub region_ids: Option<Vec<i32>>,
    /// 详细地址
    pub address: Option<String>,
}

/// 配送信息修改参数（对应 Java `OrderModifyShippingDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderModifyShippingParam {
    /// 被操作的订单id
    pub id: Option<i32>,
    /// 配送方式：1 物流 2 商家配送 3 无需配送 4 电子面单
    pub shipping_method: Option<i32>,
    /// 物流公司ID（配送方式 1/4 使用）
    pub logistics_id: Option<i32>,
    /// 物流跟踪号（配送方式 1 使用）
    pub tracking_no: Option<String>,
}

/// 订单明细修改项（对应 Java `OrderItemDTO` 的可写字段子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderItemParam {
    /// 明细ID；`<= 0` 或缺失时按新增处理（Java 同语义）
    pub item_id: Option<i32>,
    /// 商品ID
    pub product_id: Option<i32>,
    /// 商品名称
    pub product_name: Option<String>,
    /// 商品货号
    pub product_sn: Option<String>,
    /// 商品缩略图
    pub pic_thumb: Option<String>,
    /// 规格ID
    pub sku_id: Option<i32>,
    /// 规格数据（Java `List<SkuData>`，写库时序列化为 JSON 串）
    pub sku_data: Option<Vec<serde_json::Value>>,
    /// 额外规格（Java `List<Object>`，写库时序列化为 JSON 串）
    pub extra_sku_data: Option<Vec<serde_json::Value>>,
    /// 商品最终单价
    pub price: Decimal,
    /// 购买数量
    pub quantity: i32,
    /// 商品类型
    pub product_type: Option<i32>,
    /// 是否赠品
    pub is_gift: Option<i32>,
    /// 店铺ID
    pub shop_id: Option<i32>,
    /// 是否拼团
    pub is_pin: Option<i32>,
    /// 预售定金
    pub prepay_price: Option<Decimal>,
    /// 佣金数据
    pub commission: Option<String>,
    /// 商品初始价
    pub origin_price: Option<Decimal>,
    /// 优惠信息
    pub promotion_data: Option<String>,
    /// 是否秒杀
    pub is_seckill: Option<i32>,
    /// 供应商（O2O 门店）ID
    pub suppliers_id: Option<i32>,
    /// 卡券组名称
    pub card_group_name: Option<String>,
    /// 供应商ID
    pub vendor_id: Option<i32>,
    /// 供应商商品ID
    pub vendor_product_id: Option<i32>,
    /// 供应商商品SKU ID
    pub vendor_product_sku_id: Option<i32>,
    /// 供货价
    pub vendor_product_supply_price: Option<Decimal>,
    /// 已发货数量
    pub delivery_quantity: Option<i32>,
}

/// 商品信息修改参数（对应 Java `OrderModifyProductDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderModifyProductParam {
    /// 被操作的订单id
    pub id: Option<i32>,
    /// 修改后的订单明细（Java 以该列表为准：先清空原明细再整批写入）
    pub items: Option<Vec<OrderItemParam>>,
}

/// 修改订单状态参数（对应 Java `OrderChangeStatusParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderChangeStatusParam {
    /// 主键（Java `@NotNull`）
    pub id: Option<i32>,
    /// 字段名（Java `@NotNull`，当前只处理 `orderStatus`）
    pub field: Option<String>,
    /// 目标订单状态（Java `@NotNull`）
    pub val: Option<i32>,
    /// 备注
    pub admin_note: Option<String>,
}

/// 导出标签保存参数（对应 Java `ExportItemSaveParam`，`exportItem` `@NotBlank`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExportItemSaveParam {
    /// 导出标签信息：逗号分隔的 `getExportItemList` key
    pub export_item: Option<String>,
}

/// `getAddProductInfo` 请求体（对应 Java `Map<String, List<Integer>>`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductIdsParam {
    /// 商品ID集合
    pub ids: Option<Vec<i32>>,
}

/// 批量操作参数（对应 Java `OrderBatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderBatchParam {
    /// 订单ID集合（Java `@NotEmpty`）
    pub ids: Option<Vec<i32>>,
    /// 操作类型（Java `@NotNull`，当前仅支持 `deliver`）
    #[serde(rename = "type")]
    pub op_type: Option<String>,
    /// 发货数据
    pub data: Option<BatchDeliverData>,
}

/// 批量发货数据（对应 Java `BatchDeliverData`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDeliverData {
    /// 每个订单的发货信息
    pub deliver_data: Option<Vec<DeliverDataList>>,
    /// 物流公司ID
    pub logistics_id: Option<i32>,
    /// 订单ID（Java 保留字段，批量时不使用）
    pub id: Option<i32>,
    /// 发货方式
    pub shipping_method: Option<i32>,
}

/// 单个订单的批量发货信息（对应 Java `DeliverDataList`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DeliverDataList {
    /// 明细发货数量
    pub deliver_info: Option<Vec<DeliverInfo>>,
    /// 订单ID
    pub id: Option<i32>,
    /// 快递单号
    pub tracking_no: Option<String>,
}

// ————————————————————— 批量发货 Excel 载体（降级实现） —————————————————————

/// 批量发货导入的**单行数据**（对应 Java `OrderDeliverExcelDTO` 中被读取的列）。
///
/// **降级说明**：Java 用 EasyExcel 解析上传的 `.xlsx`；Rust 侧未引入 xlsx 读写依赖，
/// 故 `batchDeliverImport` / `getBatchDeliverImportErrorData` 同时接受
/// - `multipart/form-data` 的 CSV 文本（表头之后的数据行，逗号分隔，列序见
///   `ORDER_DELIVER_TEMPLATE_HEADERS`），
/// - JSON 数组（本结构的 camelCase 形态）。
///
/// 二进制 xlsx 无法解析时返回可读业务错误，绝不静默当作「导入 0 条」。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverImportRow {
    /// 订单编号（Java `orderSn`）
    pub order_sn: Option<String>,
    /// 商品名称（Java `productName`）
    pub product_name: Option<String>,
    /// 商品规格（Java `skuName`，`-` 表示无规格）
    pub sku_name: Option<String>,
    /// 发货数量（Java `deliveryQuantity`，字符串列，需校验为正整数）
    pub delivery_quantity: Option<String>,
    /// 配送方式名称（Java `shippingMethod`：物流配送/商家配送/无需配送/电子面单）
    pub shipping_method: Option<String>,
    /// 物流公司名称（Java `logisticsName`）
    pub logistics_name: Option<String>,
    /// 物流单号（Java `trackingNo`）
    pub tracking_no: Option<String>,
    /// Excel/CSV 行号（JSON 载体可省略；服务端按 3 起补全，与 Java 口径一致）
    pub row_num: Option<i32>,
}

/// 批量发货导入失败明细（对应 Java `OrderDeliverImportResultVO.FailDetail`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverImportFailVO {
    /// 行号
    pub row_num: i32,
    /// 订单编号
    pub order_sn: String,
    /// 失败原因
    pub reason: String,
}

/// 批量发货导入结果（对应 Java `OrderDeliverImportResultVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverImportResultVO {
    /// 总行数
    pub total_count: i32,
    /// 成功发货的订单数
    pub success_count: i32,
    /// 失败行数
    pub fail_count: i32,
    /// 失败明细
    pub fail_details: Vec<OrderDeliverImportFailVO>,
}

/// 批量发货导入错误行（对应 Java `OrderDeliverImportErrorExcelVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverImportErrorVO {
    /// 行号
    pub row_num: i32,
    /// 订单编号
    pub order_sn: String,
    /// 商品名称
    pub product_name: Option<String>,
    /// 商品规格
    pub sku_name: Option<String>,
    /// 发货数量
    pub delivery_quantity: Option<String>,
    /// 配送方式
    pub shipping_method: Option<String>,
    /// 物流公司
    pub logistics_name: Option<String>,
    /// 物流单号
    pub tracking_no: Option<String>,
    /// 错误信息
    pub error_msg: String,
}

/// 批量发货模板行（对应 Java `downloadDeliverTemplate` 写入 Excel 的一行）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverTemplateRow {
    pub order_sn: String,
    pub username: String,
    pub consignee: String,
    pub mobile: String,
    pub address: String,
    pub total_amount: String,
    pub product_name: String,
    pub sku_name: String,
    pub quantity: String,
    pub delivery_quantity: String,
    pub shipping_method: String,
    pub logistics_name: String,
    pub logistics_code: String,
    pub tracking_no: String,
    pub add_time: String,
}

/// 批量发货模板（**降级**：Java 直接回写 xlsx 二进制流，Rust 侧回写
/// 「说明行 + 表头 + 数据行」的结构化 JSON，前端可自行落地为 CSV/Excel）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderDeliverTemplateVO {
    /// 文件名（Java 侧为 `批量发货模板.xlsx`）
    pub file_name: String,
    /// 模板首行说明（Excel 第 1 行）
    pub description: String,
    /// 表头（Excel 第 2 行，顺序即 CSV/导入列序）
    pub headers: Vec<String>,
    /// 预填数据行（每个订单明细一行）
    pub rows: Vec<OrderDeliverTemplateRow>,
}

/// 模板表头（与 Java `OrderDeliverExcelDTO` 的 `@ExcelProperty` 顺序一致）。
pub const ORDER_DELIVER_TEMPLATE_HEADERS: [&str; 15] = [
    "订单编号",
    "会员名称",
    "收货人",
    "手机号",
    "收货地址",
    "订单金额",
    "商品名称",
    "商品规格",
    "商品数量",
    "*发货数量",
    "配送方式",
    "物流公司",
    "物流代号",
    "物流单号",
    "下单时间",
];

/// 模板说明行（Java `DeliverOrderMergeStrategy` 写入的首行提示）。
pub const ORDER_DELIVER_TEMPLATE_DESCRIPTION: &str =
    "说明：请勿修改本行与表头；*发货数量、配送方式（物流配送/商家配送/无需配送/电子面单）必填，\
     配送方式为物流配送时物流公司、物流单号必填；电子面单时物流公司必填；同一订单多商品请保持订单编号一致。";

// ————————————————————— 导出相关 VO —————————————————————

impl OrderListQuery {
    /// 解析 `exportItem`（逗号分隔的导出列 key，保序去重）。
    #[must_use]
    pub fn export_items(&self) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        for p in self
            .export_item
            .as_deref()
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            if !out.iter().any(|k| k == p) {
                out.push(p.to_string());
            }
        }
        out
    }
}

/// 导出列定义（对应 Java `getExportItemList()` 的 `Map` 条目）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderExportItemVO {
    /// 列 key（前端选中后作为 `exportItem` 回传）
    pub key: String,
    /// 列中文名
    pub label: String,
}

/// 订单导出行（对应 Java `OrderExportVO`，一行 = 一个订单的一个商品）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderExportRowVO {
    pub order_sn: String,
    pub add_time: String,
    pub order_status_name: String,
    pub pay_status_name: String,
    pub shop_name: String,
    pub username: String,
    pub consignee: String,
    pub mobile: String,
    pub address: String,
    pub postcode: String,
    pub total_amount: Decimal,
    pub balance: Decimal,
    pub discount_amount: Decimal,
    pub points_amount: Decimal,
    pub coupon_amount: Decimal,
    pub pay_time: Option<String>,
    pub pay_type_id: i32,
    pub pay_type_name: String,
    pub pay_code: String,
    pub out_trade_no: Option<String>,
    pub paid_amount: Decimal,
    pub shipping_time: Option<String>,
    pub shipping_fee: Decimal,
    pub logistics_name: String,
    pub tracking_no: String,
    pub buyer_note: String,
    pub admin_note: String,
    pub shipping_status_name: String,
    pub product_weight: Decimal,
    pub use_points: i32,
    pub product_name: String,
    pub sku_data: String,
    pub product_sn: String,
    pub quantity: i32,
    pub total_price: Decimal,
    pub price: Decimal,
}

/// 订单导出结果（**降级**：Java 直接回写 xlsx，Rust 侧回写列定义 + 行数据 JSON）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderExportVO {
    /// 文件名（Java 侧 `订单列表信息{时间}.xlsx`）
    pub file_name: String,
    /// 工作表名
    pub sheet_name: String,
    /// 选中的列（key + 中文表头，顺序与 `exportItem` 一致）
    pub columns: Vec<OrderExportItemVO>,
    /// 数据行
    pub rows: Vec<OrderExportRowVO>,
}

// ————————————————————— 统计 / 配置 / 关联 VO —————————————————————

/// 订单状态统计（对应 Java `OrderStatusCountVO`，默认 0）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderStatusCountVO {
    /// 全部（不含已删除）
    pub all_count: i64,
    /// 待支付（状态 0）
    pub pending_count: i64,
    /// 待发货（状态 1）
    pub confirmed_count: i64,
    /// 已发货（状态 2）
    pub processing_count: i64,
    /// 已取消（状态 3）
    pub cancelled_count: i64,
    /// 已完成（状态 5）
    pub completed_count: i64,
    /// 已删除（虚拟状态 -2，`is_del = 1`）
    pub deleted_count: i64,
}

/// 订单列表页配置（对应 Java `OrderPageConfigVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderPageConfigVO {
    /// 订单流转设置：0 关闭，1 开启（`config.biz_code = isChangeOrderStatus`）
    pub is_change_order_status: i32,
}

/// 商品信息（`getAddProductInfo` 返回，对应 Java 直接序列化的 `Product` 实体）。
///
/// Java 返回整个 `Product` 模型（Jackson 按属性名输出 camelCase），
/// 此处输出前端修改商品时会用到的字段子集。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductAddInfoVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_stock: i32,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub product_status: i32,
    pub product_type: Option<i32>,
    pub shop_id: i32,
    pub pic_url: String,
    pub pic_thumb: String,
    pub product_weight: Decimal,
    pub virtual_sales: i32,
    pub suppliers_id: Option<i32>,
    pub product_brief: String,
    pub is_delete: Option<i32>,
}

/// 电子面单日志（对应 Java `LogisticsApiLog` 实体，Jackson camelCase）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsApiLogVO {
    pub id: i32,
    pub order_id: Option<i32>,
    /// 实际创建面单的物流服务商：0 未知，1 快递鸟，2 快递100
    pub provider_type: i32,
    /// 快递订单编号
    pub order_code: Option<String>,
    /// 物流单号
    pub logistic_code: Option<String>,
    /// 发起时间（Java 实体为秒级时间戳原值）
    pub add_time: Option<i32>,
    /// 返回模板（JSON 串）
    pub print_template: Option<String>,
}

/// 物流轨迹（对应 Java `ShippingResult.TraceVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTraceVO {
    pub action: Option<String>,
    pub accept_time: Option<String>,
    pub accept_station: Option<String>,
    pub location: Option<String>,
}

/// 物流信息（对应 Java `ShippingResult`）。
///
/// **降级说明**：Java 通过 `logisticsProviderRouter` 调用快递鸟/快递100 第三方接口
/// 实时查询轨迹；Rust 侧未迁移第三方 HTTP 客户端与密钥配置，
/// 本接口返回订单自身的运单快照（`success = "0"` 表示未接入第三方查询）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingInfoVO {
    pub e_business_id: Option<String>,
    pub shipper_code: Option<String>,
    pub logistic_code: Option<String>,
    pub state: Option<String>,
    pub state_ex: Option<String>,
    pub location: Option<String>,
    pub traces: Vec<ShippingTraceVO>,
    pub success: Option<String>,
}

/// 父订单详情（对应 Java `parentDetail` 返回的 `Object`：
/// 拆单日志存在时返回父订单 `OrderVO` 或 `parent_order_data` JSON）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ParentOrderDetailVO {
    /// 父订单仍可从 `order` 表读取详情
    Order(OrderVO),
    /// 父订单已被删除，回退拆单日志中的 JSON 快照
    Snapshot(serde_json::Value),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn order_status_matches_java_enum() {
        // OrderStatusEnum: 0 待支付 1 已确认待发货 2 处理中已发货 3 已取消 4 无效 5 已完成
        assert_eq!(OrderStatus::Pending as i32, 0);
        assert_eq!(OrderStatus::Confirmed as i32, 1);
        assert_eq!(OrderStatus::Processing as i32, 2);
        assert_eq!(OrderStatus::Cancelled as i32, 3);
        assert_eq!(OrderStatus::Invalid as i32, 4);
        assert_eq!(OrderStatus::Completed as i32, 5);
        assert_eq!(
            OrderStatus::of(1).map(OrderStatus::name),
            Some("已确认，待发货")
        );
        assert_eq!(OrderStatus::name_of(9), "");
        assert_eq!(OrderStatus::Confirmed.admin_name(), Some("已付款，待发货"));
        assert_eq!(OrderStatus::Invalid.admin_name(), None);
        assert_eq!(
            OrderStatus::Processing.pre_status(),
            Some(OrderStatus::Confirmed)
        );
        assert_eq!(
            OrderStatus::Confirmed.pre_status(),
            Some(OrderStatus::Cancelled)
        );
        assert_eq!(OrderStatus::Pending.pre_status(), None);
    }

    #[test]
    fn reservation_and_same_city_names_match_java() {
        assert_eq!(OrderStatus::reservation_name(1), "预约成功");
        assert_eq!(OrderStatus::reservation_name(2), "预约成功");
        assert_eq!(OrderStatus::reservation_name(5), "已完成");
        assert_eq!(OrderStatus::reservation_name(9), "");
        assert_eq!(OrderStatus::same_city_name(1), "已确认，待发货");
        assert_eq!(OrderStatus::same_city_name(2), "配送中");
        assert_eq!(OrderStatus::same_city_name(0), "待支付");
    }

    #[test]
    fn pay_and_shipping_status_names() {
        assert_eq!(PayStatus::name_of(2), "已支付");
        assert_eq!(PayStatus::name_of(4), "已退款");
        assert_eq!(PayStatus::name_of(7), "");
        assert_eq!(ShippingStatus::name_of(1), "已发货");
        assert_eq!(ShippingStatus::name_of(5), "已发货，待配送");
        assert_eq!(ShippingStatus::name_of(6), "");
    }

    #[test]
    fn aftersales_status_sets_match_java() {
        assert_eq!(aftersales_status::valid_statuses(), [1, 2, 4, 5, 6]);
        assert_eq!(aftersales_status::in_progress_statuses(), [1, 2, 4, 5]);
        assert_eq!(aftersales_type::PAY_RETURN, 2);
        assert_eq!(join_status::WAIT_GROUP, 1);
        assert_eq!(join_status::description(2), "拼团成功");
    }

    #[test]
    fn list_query_defaults_match_base_page() {
        // Java BasePage: page 默认 1，size 默认 15，超过 100 截断
        let q = OrderListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);

        let q: OrderListQuery = serde_json::from_str(r#"{"size":500,"page":0}"#).unwrap();
        assert_eq!(q.page_size(), 100);
        assert_eq!(q.page_no(), 1);
    }

    #[test]
    fn list_query_accepts_camel_case_and_camel_fields() {
        let q: OrderListQuery = serde_json::from_str(
            r#"{"page":2,"size":30,"keyword":"TIG","orderStatus":"1,2","payStatus":2,
                "shippingStatus":0,"addStartTime":"2026-01-01","addEndTime":"2026-01-31",
                "shopId":3,"vendorId":-2,"payCode":"balance","orderSource":"pc,h5",
                "includeInvalid":true,"invoiceScope":true,"outTradeNo":"PAY1",
                "memberTagIds":[1,2],"sortItems":[{"field":"addTime","order":"asc"}]}"#,
        )
        .expect("OrderListQuery 应接受 camelCase 字段");
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.page_size(), 30);
        assert_eq!(q.keyword.as_deref(), Some("TIG"));
        assert_eq!(q.order_status_codes(), vec![1, 2]);
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.vendor_id, Some(-2));
        assert_eq!(q.include_invalid, Some(true));
        assert_eq!(q.invoice_scope, Some(true));
        assert_eq!(q.member_tag_ids.as_deref(), Some(&[1i64, 2][..]));
        assert_eq!(
            q.sort_items.as_ref().unwrap()[0].field.as_deref(),
            Some("addTime")
        );
        assert!(!q.only_deleted());
    }

    #[test]
    fn list_query_accepts_spring_style_query_string_forms() {
        // 查询串里 List/Boolean 只有字符串形态：`1,2` / `[1,2]` / `1` / `true` 都要能绑上
        let q: OrderListQuery = serde_json::from_str(
            r#"{"orderIds":"1,2","memberTagIds":"5,6","includeInvalid":"1",
                "invoiceScope":"true","sortItems":"[{\"field\":\"addTime\",\"order\":\"asc\"}]"}"#,
        )
        .expect("应接受 Spring 风格的字符串参数");
        assert_eq!(q.order_ids.as_deref(), Some(&[1i32, 2][..]));
        assert_eq!(q.member_tag_ids.as_deref(), Some(&[5i64, 6][..]));
        assert_eq!(q.include_invalid, Some(true));
        assert_eq!(q.invoice_scope, Some(true));
        assert_eq!(
            q.sort_items.as_ref().unwrap()[0].field.as_deref(),
            Some("addTime")
        );

        let q: OrderListQuery = serde_json::from_str(
            r#"{"orderIds":[1,2],"includeInvalid":0,"invoiceScope":false,
                "sortItems":[{"field":"totalAmount","order":"desc"}]}"#,
        )
        .expect("应接受 JSON 原生形态");
        assert_eq!(q.order_ids.as_deref(), Some(&[1i32, 2][..]));
        assert_eq!(q.include_invalid, Some(false));
        assert_eq!(q.invoice_scope, Some(false));
        assert_eq!(
            q.sort_items.as_ref().unwrap()[0].field.as_deref(),
            Some("totalAmount")
        );

        // 空串等价于「未传」（Spring 绑定为 null）
        let q: OrderListQuery = serde_json::from_str(r#"{"includeInvalid":""}"#).unwrap();
        assert_eq!(q.include_invalid, None);
    }

    #[test]
    fn list_query_detects_deleted_semantics() {
        let q: OrderListQuery = serde_json::from_str(r#"{"orderStatus":"-2"}"#).unwrap();
        assert!(q.only_deleted());
        // "-2" 不参与状态过滤（负数）
        assert!(q.order_status_codes().is_empty());

        let q: OrderListQuery = serde_json::from_str(r#"{"orderStatus":"1"}"#).unwrap();
        assert!(!q.only_deleted());
        assert_eq!(q.order_status_codes(), vec![1]);
    }

    #[test]
    fn deliver_param_builds_quantity_map() {
        let p: DeliverOrderParam = serde_json::from_str(
            r#"{"id":7,"deliverData":[{"itemId":1,"toDeliveryQuantity":2},
                {"itemId":2,"toDeliveryQuantity":1}],"shippingMethod":1,
                "logisticsId":9,"trackingNo":"SF123"}"#,
        )
        .unwrap();
        assert_eq!(p.id, Some(7));
        assert_eq!(p.shipping_method, Some(1));
        let map = p.deliver_quantity_map();
        assert_eq!(map.get(&1), Some(&2));
        assert_eq!(map.get(&2), Some(&1));
        // 缺 itemId 的非法行被忽略，不 panic
        let bad: DeliverOrderParam =
            serde_json::from_str(r#"{"id":1,"deliverData":[{"toDeliveryQuantity":2}]}"#).unwrap();
        assert!(bad.deliver_quantity_map().is_empty());
    }

    #[test]
    fn admin_param_keeps_pics_verbatim() {
        let p: AftersalesApplyAdminParam = serde_json::from_str(
            r#"{"orderId":3,"description":"商家取消","refundAmount":"12.30",
                "pics":[{"picUrl":"a.png","sort":1}]}"#,
        )
        .unwrap();
        assert_eq!(p.order_id, Some(3));
        assert_eq!(p.refund_amount, Some(Decimal::from_str("12.30").unwrap()));
        assert_eq!(p.pics.as_ref().unwrap()[0]["picUrl"], "a.png");
    }

    #[test]
    fn order_vo_serializes_camel_case() {
        let vo = OrderVO {
            order_id: 11,
            order_sn: "SN1".into(),
            order_status_name: "待支付".into(),
            available_actions: OrderActionVO {
                deliver: true,
                ..Default::default()
            },
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["orderId"], 11);
        assert_eq!(json["orderSn"], "SN1");
        assert_eq!(json["orderStatusName"], "待支付");
        assert_eq!(json["availableActions"]["deliver"], true);
        assert_eq!(json["availableActions"]["cancelOrder"], false);
        assert_eq!(json["wayBill"], false);
    }

    #[test]
    fn order_id_param_accepts_camel_case_body() {
        let p: OrderIdParam =
            serde_json::from_str(r#"{"id":9,"description":"客户重复下单"}"#).unwrap();
        assert_eq!(p.id, Some(9));
        assert_eq!(p.description.as_deref(), Some("客户重复下单"));
        // Java `OrderIdDTO` 无校验注解：空体也必须能反序列化
        let p: OrderIdParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.id, None);
    }

    #[test]
    fn admin_note_param_prefers_ids_over_id() {
        let p: OrderAdminNoteParam =
            serde_json::from_str(r#"{"id":1,"ids":"2, 3 ,x,4","adminNote":"加急","mark":2}"#)
                .unwrap();
        assert_eq!(p.target_ids(), vec![2, 3, 4]);
        assert_eq!(p.admin_note.as_deref(), Some("加急"));
        assert_eq!(p.mark, Some(2));

        let p: OrderAdminNoteParam = serde_json::from_str(r#"{"id":7}"#).unwrap();
        assert_eq!(p.target_ids(), vec![7]);

        let p: OrderAdminNoteParam = serde_json::from_str(r#"{"ids":""}"#).unwrap();
        assert!(p.target_ids().is_empty());
    }

    #[test]
    fn modify_params_accept_java_camel_case_bodies() {
        let m: OrderModifyMoneyParam = serde_json::from_str(
            r#"{"id":3,"shippingFee":"8.00","discountAmount":"10.50","updateOrderSn":1}"#,
        )
        .unwrap();
        assert_eq!(m.id, Some(3));
        assert_eq!(m.shipping_fee, Some(Decimal::from_str("8.00").unwrap()));
        assert_eq!(m.discount_amount, Some(Decimal::from_str("10.50").unwrap()));
        assert_eq!(m.update_order_sn, Some(1));

        let c: OrderModifyConsigneeParam = serde_json::from_str(
            r#"{"id":3,"consignee":"张三","mobile":"13800000000","regionIds":[110000,110100]}"#,
        )
        .unwrap();
        assert_eq!(c.region_ids.as_deref(), Some(&[110_000i32, 110_100][..]));

        let s: OrderModifyShippingParam = serde_json::from_str(
            r#"{"id":3,"shippingMethod":1,"logisticsId":5,"trackingNo":"SF1"}"#,
        )
        .unwrap();
        assert_eq!(s.shipping_method, Some(1));
        assert_eq!(s.tracking_no.as_deref(), Some("SF1"));

        let p: OrderModifyProductParam = serde_json::from_str(
            r#"{"id":3,"items":[{"itemId":-1,"productId":8,"price":"9.90","quantity":2,
                "skuData":[{"name":"颜色","value":"红"}]}]}"#,
        )
        .unwrap();
        let items = p.items.unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].item_id, Some(-1));
        assert_eq!(items[0].price, Decimal::from_str("9.90").unwrap());
        assert_eq!(items[0].sku_data.as_ref().unwrap()[0]["name"], "颜色");

        let ch: OrderChangeStatusParam = serde_json::from_str(
            r#"{"id":3,"field":"orderStatus","val":1,"adminNote":"取消发货"}"#,
        )
        .unwrap();
        assert_eq!(ch.field.as_deref(), Some("orderStatus"));
        assert_eq!(ch.val, Some(1));
    }

    #[test]
    fn batch_param_keeps_type_field() {
        let b: OrderBatchParam = serde_json::from_str(
            r#"{"ids":[1,2],"type":"deliver","data":{"shippingMethod":1,"logisticsId":3,
                "deliverData":[{"id":1,"trackingNo":"SF1","deliverInfo":[
                    {"itemId":5,"toDeliveryQuantity":1}]}]}}"#,
        )
        .unwrap();
        assert_eq!(b.op_type.as_deref(), Some("deliver"));
        let data = b.data.unwrap();
        assert_eq!(data.shipping_method, Some(1));
        let row = &data.deliver_data.unwrap()[0];
        assert_eq!(row.id, Some(1));
        assert_eq!(row.tracking_no.as_deref(), Some("SF1"));
        assert_eq!(row.deliver_info.as_ref().unwrap()[0].item_id, Some(5));
    }

    #[test]
    fn export_items_parses_and_dedups() {
        let q: OrderListQuery =
            serde_json::from_str(r#"{"exportItem":"orderSn, addTime ,orderSn,"}"#).unwrap();
        assert_eq!(q.export_items(), vec!["orderSn", "addTime"]);
        assert!(OrderListQuery::default().export_items().is_empty());
    }

    #[test]
    fn deliver_import_row_and_error_row_shapes() {
        let r: OrderDeliverImportRow = serde_json::from_str(
            r#"{"orderSn":"SN1","productName":"衬衫","skuName":"-","deliveryQuantity":"2",
                "shippingMethod":"物流配送","logisticsName":"顺丰","trackingNo":"SF1"}"#,
        )
        .unwrap();
        assert_eq!(r.order_sn.as_deref(), Some("SN1"));
        assert_eq!(r.sku_name.as_deref(), Some("-"));

        let json = serde_json::to_value(OrderDeliverImportResultVO {
            total_count: 3,
            success_count: 1,
            fail_count: 2,
            fail_details: vec![OrderDeliverImportFailVO {
                row_num: 4,
                order_sn: "SN2".into(),
                reason: "订单不存在".into(),
            }],
        })
        .unwrap();
        assert_eq!(json["totalCount"], 3);
        assert_eq!(json["failDetails"][0]["rowNum"], 4);
        assert_eq!(json["failDetails"][0]["reason"], "订单不存在");

        let e = serde_json::to_value(OrderDeliverImportErrorVO {
            row_num: 4,
            order_sn: "SN2".into(),
            error_msg: "订单不存在".into(),
            ..Default::default()
        })
        .unwrap();
        assert_eq!(e["errorMsg"], "订单不存在");
    }

    #[test]
    fn template_headers_match_excel_dto_column_order() {
        // 与 Java OrderDeliverExcelDTO 的 @ExcelProperty 顺序严格一致
        assert_eq!(ORDER_DELIVER_TEMPLATE_HEADERS.len(), 15);
        assert_eq!(ORDER_DELIVER_TEMPLATE_HEADERS[0], "订单编号");
        assert_eq!(ORDER_DELIVER_TEMPLATE_HEADERS[9], "*发货数量");
        assert_eq!(ORDER_DELIVER_TEMPLATE_HEADERS[10], "配送方式");
        assert_eq!(ORDER_DELIVER_TEMPLATE_HEADERS[14], "下单时间");
    }

    #[test]
    fn parent_detail_untagged_serializes_inner_shape() {
        let vo = ParentOrderDetailVO::Order(OrderVO {
            order_id: 5,
            sub_order_ids: Some(vec![6, 7]),
            ..Default::default()
        });
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["orderId"], 5);
        assert_eq!(json["subOrderIds"], serde_json::json!([6, 7]));

        let vo = ParentOrderDetailVO::Snapshot(serde_json::json!({"orderId": 9}));
        assert_eq!(serde_json::to_value(&vo).unwrap()["orderId"], 9);
    }

    #[test]
    fn status_count_vo_defaults_to_zero() {
        let json = serde_json::to_value(OrderStatusCountVO::default()).unwrap();
        for k in [
            "allCount",
            "pendingCount",
            "confirmedCount",
            "processingCount",
            "cancelledCount",
            "completedCount",
            "deletedCount",
        ] {
            assert_eq!(json[k], 0, "{k} 应默认 0（Java 字段初始化值）");
        }
    }
}
