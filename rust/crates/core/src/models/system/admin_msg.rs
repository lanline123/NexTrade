//! 后台消息域（system::admin_msg）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.msg.AdminMsgController`
//!   （`@RequestMapping("/adminapi/msg/adminMsg")`，7 个端点）
//! - `com.tigshop.service.msg.impl.AdminMsgServiceImpl`
//! - 枚举 `com.tigshop.bean.enums.msg.AdminMsgTypeEnum`（分类树口径）
//!
//! JSON camelCase；时间统一 `yyyy-MM-dd HH:mm:ss`（Java `DateUtil.format(...,"yyyy-MM-dd HH:mm:ss")`）。
//!
//! # 与 Java 的差异
//! - Java `msgCount` 是 **SSE 长连接**（`SseEmitter`，实时推送角标）；Rust 侧未接入 SSE，
//!   服务层返回明确 1001 业务错误（不伪造推送）。
//! - Java 用 `HeaderUtils.getAdminType/getShopId/getVendorId` 区分平台/店铺/供应商；
//!   Rust JWT 只有 `admin_type`，`shopId`/`vendorId` 用查询参数兜底（见路由文档）。
//! - `broadcastList` 的订单/商品摘要聚合（`BroadcastProductVO`）未迁移：列表口径与
//!   `list` 完全一致，商品摘要字段为空数组/0（见服务层注释）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 管理员消息统计（SSE 推送帧 `AdminMsgCountVO`，对应 Java `AdminMsgCountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminMsgCountVO {
    /// 客服未读消息数量（用于 UI 角标，可随已读回落）
    pub im_msg_count: i64,
    /// 客服消息累计数量（自 startTime 起单调递增，专供语音播报增量判断）
    pub customer_msg_count: i64,
    /// 获取新订单数量（自 startTime 起）
    pub order_count: i64,
    /// 获取未读消息数量
    pub unread_msg_count: i64,
    /// 已付款待发货订单数量（自 startTime 起）
    pub paid_order_count: i64,
    /// 新增待处理售后申请数量（自 startTime 起）
    pub aftersale_count: i64,
    /// 已取消订单数量（自 startTime 起）
    pub cancel_order_count: i64,
    /// 新订单后台消息数 (admin_msg msgType=11，自 startTime 起)
    pub new_order_msg_count: i64,
    /// 已付款后台消息数 (admin_msg msgType=12，自 startTime 起)
    pub paid_order_msg_count: i64,
    /// 售后申请后台消息数 (admin_msg msgType=32，自 startTime 起)
    pub aftersale_msg_count: i64,
    /// 订单取消后台消息数 (admin_msg msgType=31，自 startTime 起)
    pub cancel_order_msg_count: i64,
    /// 帧生成时间戳（秒）
    pub ts: i64,
    /// 协议版本号，前端按 >=2 走新逻辑（对齐 Java 为 4）
    pub version: i32,
    /// 当前管理员 ID
    pub admin_id: i32,
}

/// Java `HttpStatus.SERVICE_DATA_ERROR`。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// 未知消息类型的兜底文案（Java `getMsgTypeName` 未命中返回空串）。
pub const MSG_TYPE_UNKNOWN: &str = "";

/// 消息分类：`(catId, catName, 父分类)`，来自 `AdminMsgTypeEnum`。
///
/// 父分类（`parentId == 0`）：交易消息(1)/商品消息(2)/售后服务(3)/店铺服务(4)/
/// 其它消息(5)/财务消息(6)。
pub const MSG_CATEGORIES: [(i32, &str); 6] = [
    (1, "交易消息"),
    (2, "商品消息"),
    (3, "售后服务"),
    (4, "店铺服务"),
    (5, "其它消息"),
    (6, "财务消息"),
];

/// 全部叶子消息类型：`(msgType, name, 父分类 catId, 是否店铺可见, 是否供应商可见)`，
/// 逐条来自 `AdminMsgTypeEnum`（不含历史兼容 15/16）。
pub const MSG_TYPES: [(i32, &str, i32, bool, bool); 31] = [
    (11, "新订单", 1, true, true),
    (12, "已付款订单", 1, true, true),
    (13, "订单完成", 1, true, true),
    (15, "订单问题", 1, false, false),
    (16, "订单咨询", 1, false, false),
    (54, "发货提醒", 1, true, true),
    (21, "商品库存预警", 2, true, true),
    (22, "商品无货", 2, true, true),
    (23, "商品下架", 2, true, true),
    (24, "商品审核通知", 2, true, true),
    (25, "商品咨询", 2, true, true),
    (26, "商品询价", 2, true, true),
    (31, "订单取消", 1, true, true),
    (32, "售后申请", 3, true, true),
    (33, "提现申请", 6, true, true),
    (34, "发票资质审核", 6, true, true),
    (35, "发票申请", 6, true, true),
    (36, "售后退款", 6, true, true),
    (37, "线下支付审核", 6, true, true),
    (41, "店铺入驻申请", 4, true, false),
    (42, "店铺资质修改", 4, true, false),
    (43, "店铺违规", 4, true, false),
    (44, "保证金预警", 6, true, true),
    (51, "系统消息", 5, true, true),
    (52, "待办任务", 5, true, true),
    (53, "意见反馈", 5, true, true),
    (55, "建议", 5, true, true),
    (56, "投诉", 5, true, true),
    (57, "其它反馈", 5, true, true),
    // 以下两条为历史兼容枚举（ORDER_PROBLEM/CONSULTATION 已在上面列出，
    // 这里补齐交易类 13/31 之外的展示项无需重复；保留数组长度稳定）
    (11 + 1000, "", 0, false, false),
    (16 + 1000, "", 0, false, false),
];

/// 分类名（Java `AdminMsgTypeEnum.getByCatId(...).getCatName()`）。
#[must_use]
pub fn msg_type_name(msg_type: i32) -> &'static str {
    MSG_TYPES
        .iter()
        .find(|(t, _, _, _, _)| *t == msg_type)
        .map(|(_, name, _, _, _)| *name)
        .unwrap_or(MSG_TYPE_UNKNOWN)
}

/// 消息类型的父分类（未命中 → 0）。
#[must_use]
pub fn msg_type_parent(msg_type: i32) -> i32 {
    MSG_TYPES
        .iter()
        .find(|(t, _, _, _, _)| *t == msg_type)
        .map(|(_, _, p, _, _)| *p)
        .unwrap_or(0)
}

/// 当前身份可见的叶子类型（Java `shopShow` / `vendorShow` 口径）。
#[must_use]
pub fn visible_types(vendor: bool) -> Vec<(i32, &'static str, i32)> {
    MSG_TYPES
        .iter()
        .filter(
            |(_, _, _, shop_show, vendor_show)| {
                if vendor {
                    *vendor_show
                } else {
                    *shop_show
                }
            },
        )
        .map(|(t, name, parent, _, _)| (*t, *name, *parent))
        .collect()
}

/// 时间格式（Java `DateUtil.format(date, "yyyy-MM-dd HH:mm:ss")`，秒级时间戳）。
#[must_use]
pub fn format_time(ts: Option<i32>) -> String {
    let Some(ts) = ts.filter(|t| *t > 0) else {
        return String::new();
    };
    chrono::DateTime::from_timestamp(i64::from(ts), 0)
        .map(|dt| {
            dt.with_timezone(
                &chrono::FixedOffset::east_opt(8 * 3600)
                    .unwrap_or_else(|| chrono::FixedOffset::east_opt(0).expect("utc")),
            )
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
        })
        .unwrap_or_default()
}

/// 可见范围（Java `getAdminType()` + `getShopId()`/`getVendorId()`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MsgScope {
    /// 平台/店铺：`shop_id = ? AND vendor_id = 0`；平台额外要求 `is_broadcast = 1`。
    Shop { shop_id: i32, platform: bool },
    /// 供应商：`vendor_id = ?`。
    Vendor { vendor_id: i32 },
}

impl MsgScope {
    /// 是否平台视角（决定 `is_broadcast = 1` 过滤）。
    #[must_use]
    pub fn is_platform(self) -> bool {
        matches!(self, Self::Shop { platform: true, .. })
    }

    /// 是否供应商视角。
    #[must_use]
    pub fn is_vendor(self) -> bool {
        matches!(self, Self::Vendor { .. })
    }
}

/// 消息列表查询（Java `AdminMsgListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgListQuery {
    pub msg_type: Option<i32>,
    pub keyword: Option<String>,
    pub shop_id: Option<i32>,
    pub vendor_id: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl AdminMsgListQuery {
    /// Java `BasePage` 归一化。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        (
            self.page.unwrap_or(1).max(1),
            self.size.unwrap_or(15).clamp(1, 100),
        )
    }
}

/// 列表项（Java `AdminMsgVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgVO {
    pub msg_id: i32,
    pub msg_type: i32,
    pub msg_type_name: String,
    pub route: Option<String>,
    pub send_time: String,
    pub is_readed: i32,
    pub shop_id: i32,
    pub admin_id: i32,
    pub order_id: i32,
    pub product_id: i32,
    pub title: String,
    pub content: String,
    pub msg_link: Option<String>,
    pub related_data: Option<Value>,
}

/// 分类树子项（Java `AdminMsgTypeListChildVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgTypeChildVO {
    pub msg_type: i32,
    pub name: String,
    pub unread_count: i32,
}

/// 分类树（Java `AdminMsgTypeListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgTypeListVO {
    pub cat_id: i32,
    pub cat_name: String,
    pub unread_count: i32,
    pub child: Vec<AdminMsgTypeChildVO>,
}

/// 首页消息摘要（Java `HomeMsgSummaryVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HomeMsgSummaryVO {
    pub unread_count: i32,
    pub latest_message: Option<HomeMsgLatestVO>,
}

/// 最新一条消息（Java `HomeMsgSummaryVO.LatestMessage`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HomeMsgLatestVO {
    pub msg_id: i32,
    pub msg_type: i32,
    pub type_name: String,
    pub title: String,
    pub send_time: Option<String>,
}

/// 语音播报项（Java `AdminMsgBroadcastVO`；商品摘要未迁移，仅基础字段 + 空 products）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgBroadcastVO {
    pub msg_id: i32,
    pub msg_type: i32,
    pub msg_type_name: String,
    pub send_time: String,
    pub title: String,
    pub content: String,
    pub msg_link: Option<String>,
    pub products: Vec<Value>,
    pub total_amount: String,
    pub refund_amount: String,
}

/// 单条已读入参（Java `AdminMsgUpdateDTO`，只需 `msgId`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminMsgUpdateDTO {
    pub msg_id: Option<i32>,
    pub msg_type: Option<i32>,
}

/// 智能构建分类树（与 Java `getAdminMsgTypeList` 相同的「父分类累加子分类未读数」）。
#[must_use]
pub fn build_type_tree(
    vendor: bool,
    unread: &std::collections::HashMap<i32, i32>,
) -> Vec<AdminMsgTypeListVO> {
    let mut tree: Vec<AdminMsgTypeListVO> = Vec::new();
    for (cat_id, cat_name) in MSG_CATEGORIES {
        let child: Vec<AdminMsgTypeChildVO> = visible_types(vendor)
            .into_iter()
            .filter(|(_, _, parent)| *parent == cat_id)
            .map(|(msg_type, name, _)| AdminMsgTypeChildVO {
                msg_type,
                name: name.to_string(),
                unread_count: unread.get(&msg_type).copied().unwrap_or(0),
            })
            .collect();
        let total = child.iter().map(|c| c.unread_count).sum();
        tree.push(AdminMsgTypeListVO {
            cat_id,
            cat_name: cat_name.to_string(),
            unread_count: total,
            child,
        });
    }
    tree
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn msg_type_names_match_java_enum() {
        assert_eq!(msg_type_name(11), "新订单");
        assert_eq!(msg_type_name(32), "售后申请");
        assert_eq!(msg_type_name(44), "保证金预警");
        assert_eq!(msg_type_name(999), "");
        assert_eq!(msg_type_parent(11), 1);
        assert_eq!(msg_type_parent(33), 6);
        assert_eq!(msg_type_parent(999), 0);
    }

    #[test]
    fn visibility_matches_shop_and_vendor_flags() {
        let shop_types = visible_types(false);
        assert!(shop_types.iter().any(|(t, _, _)| *t == 41)); // 店铺入驻申请对店铺可见
        let vendor_types = visible_types(true);
        assert!(!vendor_types.iter().any(|(t, _, _)| *t == 41)); // 供应商不可见
        assert!(vendor_types.iter().any(|(t, _, _)| *t == 44));
    }

    #[test]
    fn type_tree_accumulates_child_unread() {
        let mut unread = std::collections::HashMap::new();
        unread.insert(11, 2);
        unread.insert(12, 3);
        let tree = build_type_tree(false, &unread);
        let transaction = tree.iter().find(|t| t.cat_id == 1).unwrap();
        assert_eq!(transaction.unread_count, 5);
        assert!(transaction
            .child
            .iter()
            .any(|c| c.msg_type == 11 && c.unread_count == 2));
        // 未读为 0 的分类仍返回（Java 树包含空分类）
        let finance = tree.iter().find(|t| t.cat_id == 6).unwrap();
        assert_eq!(finance.unread_count, 0);
    }

    #[test]
    fn scope_helpers_and_time_format() {
        assert!(MsgScope::Shop {
            shop_id: 0,
            platform: true
        }
        .is_platform());
        assert!(!MsgScope::Shop {
            shop_id: 3,
            platform: false
        }
        .is_platform());
        assert!(MsgScope::Vendor { vendor_id: 3 }.is_vendor());
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(None), "");
    }

    #[test]
    fn query_and_vo_serde_shapes() {
        let q: AdminMsgListQuery =
            serde_json::from_str(r#"{"msgType":11,"keyword":"订单","shopId":3}"#).unwrap();
        assert_eq!(q.msg_type, Some(11));
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.page_params(), (1, 15));
        let vo = AdminMsgVO {
            msg_id: 1,
            msg_type: 11,
            msg_type_name: msg_type_name(11).into(),
            related_data: Some(serde_json::json!({"route":"/order"})),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["msgTypeName"], "新订单");
        assert_eq!(v["relatedData"]["route"], "/order");
    }
}
