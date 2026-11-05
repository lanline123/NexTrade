//! 前台用户售后域（trade::aftersales_client）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.user.AfterSalesController`
//!   （`@RequestMapping("/api/user/aftersales")`）
//! - `com.tigshop.bean.query.order.AftersalesListPageQuery`
//! - `com.tigshop.bean.param.order.AftersalesApplyParam`（`create`）
//! - `com.tigshop.bean.dto.order.ClientAfterSalesUpdateDTO`（`update`）
//! - `com.tigshop.bean.dto.order.AfterSalesFeedbackDTO`（`feedback`）
//! - `com.tigshop.bean.dto.order.AfterSalesCancelDTO`（`cancel`）
//! - `com.tigshop.bean.vo.order.AfterSalesClientVO` / `AfterSalesDetailVO` /
//!   `AfterSalesApplyDataVO` / `AfterSalesClientDetailVO` / `AftersalesItemVO` /
//!   `AftersalesLogVO` / `AftersalesVO`
//! - 枚举 `AftersalesStatusEnum` / `AftersalesTypeEnum` 的**前台口径**文案
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! **文案来源**：`getClientStatusName` / `getClientStatusDesc` /
//! `getStep` 的标题与副文案原由 `messageHelper.get(key)` 从
//! `java/tigshop-common/src/main/resources/i18n/messages.properties` 读取；
//! 本模块把该文件中的 `aftersales.*` 文案按 key 一一转为常量，
//! 保证与 Java 输出逐字符一致（多语言翻译未迁移，见 `uncertain_points`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// Java `AfterSalesApplyDataVO.order` / `AfterSalesClientDetailVO.orders` 都是
// `OrderVO`。本切片**不复刻**该结构（会与 trade::order_admin 漂移），直接复用
// trade::order_admin 逐字段还原的 `OrderVO`（其构造由
// `tigshop_services::trade::order_admin::OrderAdminService::detail` 提供，Java 侧
// `AfterSalesController.applyData` 同样调用 `orderService.detail`）。
pub use crate::models::trade::order_admin::OrderVO;

// ————————————————————— 文案常量（i18n messages.properties） —————————————————————

/// `aftersales.type.return.refund`：退货/退款。
pub const TYPE_NAME_RETURN: &str = "退货/退款";
/// `aftersales.type.refund.only`：仅退款。
pub const TYPE_NAME_PAY_RETURN: &str = "仅退款";

/// `error.record.not.exist`：记录不存在。
pub const ERR_RECORD_NOT_EXIST: &str = "记录不存在";
/// `error.order.not.exist`：订单不存在。
pub const ERR_ORDER_NOT_EXIST: &str = "订单不存在";
/// `error.aftersales.record.not.exist`：售后信息不存在。
pub const ERR_AFTERSALES_NOT_EXIST: &str = "售后信息不存在";
/// `error.aftersales.apply.not.exist`：该售后申请不存在。
pub const ERR_APPLY_NOT_EXIST: &str = "该售后申请不存在";
/// `error.aftersales.giftcard.not.allowed`：电子礼品卡不支持申请售后。
pub const ERR_GIFTCARD_NOT_ALLOWED: &str = "电子礼品卡不支持申请售后";
/// `error.aftersales.unpaid.not.allowed`：未支付订单不允许售后。
pub const ERR_UNPAID_NOT_ALLOWED: &str = "未支付订单不允许售后";
/// `error.aftersales.pos.not.allowed`：收银台订单无法售后。
pub const ERR_POS_NOT_ALLOWED: &str = "收银台订单无法售后";
/// `error.aftersales.quantity.required`：请填写申请售后数量。
pub const ERR_QUANTITY_REQUIRED: &str = "请填写申请售后数量";
/// `error.aftersales.quantity.zero`：退换数量不能为0。
pub const ERR_QUANTITY_ZERO: &str = "退换数量不能为0";
/// `error.aftersales.quantity.insufficient`：该商品可申请数量不足。
pub const ERR_QUANTITY_INSUFFICIENT: &str = "该商品可申请数量不足";
/// `error.aftersales.product.has.applied`：该商品已申请售后,请勿重复申请。
pub const ERR_PRODUCT_HAS_APPLIED: &str = "该商品已申请售后,请勿重复申请";
/// `error.aftersales.status.cannot.modify`：该状态下不能修改。
pub const ERR_STATUS_CANNOT_MODIFY: &str = "该状态下不能修改";
/// `error.aftersales.status.cannot.cancel`：该状态下不能取消申请。
pub const ERR_STATUS_CANNOT_CANCEL: &str = "该状态下不能取消申请";
/// `error.order.aftersales.time.expired`：已超过该订单支持的售后时间。
pub const ERR_AFTERSALES_TIME_EXPIRED: &str = "已超过该订单支持的售后时间";
/// `error.order.item.order.not.exist`：该商品订单不存在。
pub const ERR_ORDER_ITEM_NOT_EXIST: &str = "该商品订单不存在";
/// `error.order.item.full.refund.only`：该商品只支持整单退款。
pub const ERR_FULL_REFUND_ONLY: &str = "该商品只支持整单退款";

/// `aftersales.step.submit`：提交申请。
pub const STEP_TITLE_SUBMIT: &str = "提交申请";
/// `aftersales.step.reviewing`：审核中。
pub const STEP_TITLE_REVIEWING: &str = "审核中";
/// `aftersales.step.completed`：已完成。
pub const STEP_TITLE_COMPLETED: &str = "已完成";
/// `aftersales.step.processing`：售后处理。
pub const STEP_TITLE_PROCESSING: &str = "售后处理";
/// `aftersales.status.cancelled`：已取消。
pub const STEP_TITLE_CANCELLED: &str = "已取消";

/// `aftersales.desc.reviewing`：售后审核中，请耐心等待。
pub const STEP_DESC_REVIEWING: &str = "售后审核中，请耐心等待";
/// `aftersales.desc.approved`：售后审核通过，等待处理。
pub const STEP_DESC_APPROVED: &str = "售后审核通过，等待处理";
/// `aftersales.desc.rejected`：您的申请未能通过，详情请联系客服。
pub const STEP_DESC_REJECTED: &str = "您的申请未能通过，详情请联系客服";
/// `aftersales.desc.wait.return`：待回寄。
pub const STEP_DESC_WAIT_RETURN: &str = "待回寄";
/// `aftersales.desc.wait.merchant.receipt`：待商家收货。
pub const STEP_DESC_WAIT_MERCHANT_RECEIPT: &str = "待商家收货";
/// `aftersales.desc.wait.supplier.review`：待供应商审核。
pub const STEP_DESC_WAIT_SUPPLIER_REVIEW: &str = "待供应商审核";
/// `aftersales.desc.wait.supplier.receipt`：待供应商收货。
pub const STEP_DESC_WAIT_SUPPLIER_RECEIPT: &str = "待供应商收货";
/// `aftersales.desc.finance.reviewing`：财务审核中，请耐心等待。
pub const STEP_DESC_FINANCE_REVIEWING: &str = "财务审核中，请耐心等待";

/// 流程条状态：进行中（Java `"process"`）。
pub const STEP_STATUS_PROCESS: &str = "process";
/// 流程条状态：已结束（Java `"finish"`）。
pub const STEP_STATUS_FINISH: &str = "finish";

/// 售后类型文案（Java `AftersalesTypeEnum.getTypeName`，未知类型返回空串）。
#[must_use]
pub fn type_name(aftersale_type: Option<i32>) -> String {
    match aftersale_type {
        Some(aftersales_type::RETURN) => TYPE_NAME_RETURN.into(),
        Some(aftersales_type::PAY_RETURN) => TYPE_NAME_PAY_RETURN.into(),
        _ => String::new(),
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

    /// 关闭子类型：无。
    pub const CLOSE_TYPE_NONE: i32 = 0;
    /// 关闭子类型：商家审核驳回。
    pub const CLOSE_TYPE_AUDIT_REJECT: i32 = 1;
    /// 关闭子类型：商家或供应商拒收。
    pub const CLOSE_TYPE_REJECT_RECEIVE: i32 = 2;

    /// 「售后进行中」状态（Java `AftersalesServiceImpl#getAfterSalseStatusList`）。
    ///
    /// 注意：Java 还按 `tigshopProperties.getIsVendor()` 追加 21 / 22，
    /// **前台用户入口恒为非供应商部署视角与否都会追加**，故此处**始终**包含 21 / 22
    /// ——这是 Java 该方法的字面行为（`isVendor == 1` 时追加），
    /// 而用户端接口在供应商模式下同样生效。见 `uncertain_points`。
    #[must_use]
    pub fn applied_statuses() -> [i32; 6] {
        [
            IN_REVIEW,
            APPROVED_FOR_PROCESSING,
            SEND_BACK,
            RETURNED,
            WAIT_FOR_SUPPLIER_AUDIT,
            WAIT_FOR_SUPPLIER_RECEIPT,
        ]
    }

    /// 「占用可售后数量」的有效状态
    /// （Java `AftersalesServiceImpl#getAfterSalseValidStatusList`，
    /// 不含 REFUSE：审核未通过为终态，不占用额度）。
    #[must_use]
    pub fn valid_statuses() -> [i32; 7] {
        [
            IN_REVIEW,
            APPROVED_FOR_PROCESSING,
            SEND_BACK,
            RETURNED,
            COMPLETE,
            WAIT_FOR_SUPPLIER_AUDIT,
            WAIT_FOR_SUPPLIER_RECEIPT,
        ]
    }

    /// 终态（Java `AftersalesStatusEnum.terminalStatus()`）。
    #[must_use]
    pub fn terminal_statuses() -> [i32; 3] {
        [COMPLETE, CANCEL, REFUSE]
    }
}

/// 售后类型（对应 Java `AftersalesTypeEnum`）。
pub mod aftersales_type {
    /// 退货/退款
    pub const RETURN: i32 = 1;
    /// 仅退款
    pub const PAY_RETURN: i32 = 2;

    /// 是否「仅退款」。
    #[must_use]
    pub fn is_pay_return(v: Option<i32>) -> bool {
        v == Some(PAY_RETURN)
    }
}

// ————————————————————— 状态文案（前台口径） —————————————————————

/// 买家端状态头文案（Java `AftersalesStatusEnum.getClientStatusName`）。
///
/// 对应 i18n key：
/// | status | 类型 | key |
/// |--------|------|-----|
/// | 1 / 21 | 仅退款 / 其他 | `aftersales.client.status.review.refund` / `...review.return` |
/// | 2 | 仅退款（财务驳回/正常） | `...finance.rejected` / `...finance.refunding` |
/// | 2 | 其他 | `...received.refunding` |
/// | 4 | — | `...wait.return` |
/// | 5 / 22 | — | `...returned.wait.receipt` |
/// | 6 | — | `...refund.success` |
/// | 3 | 仅退款 / 拒收 / 其他 | `...refund.rejected` / `...receive.rejected` / `...return.rejected` |
/// | 7 | — | `...cancelled` |
#[must_use]
pub fn client_status_name(
    aftersale_type: Option<i32>,
    status: Option<i32>,
    close_type: Option<i32>,
    finance_rejected: bool,
) -> Option<&'static str> {
    let status = status?;
    let pay_return = aftersales_type::is_pay_return(aftersale_type);
    Some(match status {
        aftersales_status::IN_REVIEW | aftersales_status::WAIT_FOR_SUPPLIER_AUDIT => {
            if pay_return {
                "商家审核"
            } else {
                "申请退货退款"
            }
        }
        aftersales_status::APPROVED_FOR_PROCESSING => {
            if pay_return {
                if finance_rejected {
                    "退款失败（平台财务）"
                } else {
                    "财务退款"
                }
            } else {
                "商家已收货，退款中"
            }
        }
        aftersales_status::SEND_BACK => "待退货",
        aftersales_status::RETURNED | aftersales_status::WAIT_FOR_SUPPLIER_RECEIPT => {
            "已退货，待商家收货"
        }
        aftersales_status::COMPLETE => "退款成功",
        aftersales_status::REFUSE => {
            if pay_return {
                "退款拒绝(商家)"
            } else if close_type == Some(aftersales_status::CLOSE_TYPE_REJECT_RECEIVE) {
                "商家拒收"
            } else {
                "退货退款被拒绝"
            }
        }
        aftersales_status::CANCEL => "已取消",
        _ => return None,
    })
}

/// 买家端状态副文案（Java `AftersalesStatusEnum.getClientStatusDesc`）。
///
/// `reply` 为商家拒绝理由（Java 用 `withReason` 拼接，`null` 视作空串）。
#[must_use]
pub fn client_status_desc(
    aftersale_type: Option<i32>,
    status: Option<i32>,
    close_type: Option<i32>,
    reply: Option<&str>,
    finance_rejected: bool,
) -> Option<String> {
    let status = status?;
    let pay_return = aftersales_type::is_pay_return(aftersale_type);
    let reply = reply.unwrap_or("");
    Some(match status {
        aftersales_status::IN_REVIEW | aftersales_status::WAIT_FOR_SUPPLIER_AUDIT => {
            if pay_return {
                "你的退款申请已提交，等待商家审核，超时未处理将自动同意。".to_string()
            } else {
                "你的退货退款申请已提交，等待商家审核，超时未处理将自动同意。".to_string()
            }
        }
        aftersales_status::APPROVED_FOR_PROCESSING => {
            if pay_return {
                if finance_rejected {
                    format!(
                        "您的退款申请已被财务拒绝，拒绝理由：{reply}，可联系商家协商或重新申请。"
                    )
                } else {
                    "商家已同意退款，财务正在处理退款，将按原路退回。".to_string()
                }
            } else {
                "商家已签收商品，财务正在处理退款，将按原路退回。".to_string()
            }
        }
        aftersales_status::SEND_BACK => "申请已通过，请填写退货物流信息并寄回商品。".to_string(),
        aftersales_status::RETURNED | aftersales_status::WAIT_FOR_SUPPLIER_RECEIPT => {
            "商品已寄出，等待商家签收，签收后将为你处理退款。".to_string()
        }
        aftersales_status::COMPLETE => {
            if pay_return {
                "退款已成功到账，售后流程已结束。".to_string()
            } else {
                "退款已成功到账，退货退款流程已结束。".to_string()
            }
        }
        aftersales_status::REFUSE => {
            if pay_return {
                format!("你的退款申请已被商家拒绝，拒绝理由：{reply}，可联系商家协商或重新申请。")
            } else if close_type == Some(aftersales_status::CLOSE_TYPE_REJECT_RECEIVE) {
                format!("商家已拒收退回的商品，拒绝理由：{reply}，售后已终止，可联系商家协商。")
            } else {
                format!(
                    "你的退货退款申请已被商家拒绝，拒绝理由：{reply}，可联系商家协商或重新申请。"
                )
            }
        }
        _ => return None,
    })
}

// ————————————————————— 请求参数 —————————————————————

/// 售后申请/修改明细项（Java `AftersalesApplyParam.ItemsDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesApplyItem {
    /// 订单商品明细ID（`order_item.item_id`）
    pub order_item_id: Option<i32>,
    /// 申请数量
    pub number: Option<i32>,
}

/// 售后申请参数（Java `AftersalesApplyParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateAftersalesParam {
    /// 订单ID（Java `@NotNull(message = "订单ID不能为空")`，服务层校验）
    pub order_id: Option<i32>,
    /// 售后类型：1 退货退款 2 仅退款
    pub aftersale_type: Option<i32>,
    /// 售后原因
    pub aftersale_reason: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 退款金额（前端可传；未传时由服务端按建议金额计算）
    pub refund_amount: Option<Decimal>,
    /// 反馈图片（Java `List<ReturnPicDTO>`，原样承接并序列化写入 `aftersales.pics`）
    pub pics: Option<Vec<serde_json::Value>>,
    /// 申请明细（Java `@NotEmpty(message = "请填写申请售后数量")`，服务层校验）
    pub items: Option<Vec<AftersalesApplyItem>>,
    /// 用户ID（路由层用登录态覆盖，忽略请求体）
    pub user_id: Option<i32>,
    /// 是否后台取消订单（前台接口恒为 false）
    pub is_admin_cancel: Option<bool>,
}

impl CreateAftersalesParam {
    /// 非零数量明细（Java：先按 `number != 0` 过滤）。
    #[must_use]
    pub fn non_zero_items(&self) -> Vec<AftersalesApplyItem> {
        self.items
            .as_deref()
            .unwrap_or_default()
            .iter()
            .filter(|it| it.number.unwrap_or(0) != 0)
            .cloned()
            .collect()
    }

    /// 明细数量合计（Java `mapToInt(getNumber).sum()`，`null` 视作 0）。
    #[must_use]
    pub fn total_number(&self) -> i32 {
        self.items
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(|it| it.number.unwrap_or(0))
            .sum()
    }

    /// `pics` 序列化（空则空串，对齐 Java `createAfterSales`）。
    #[must_use]
    pub fn pics_json(&self) -> String {
        match self.pics.as_deref() {
            None | Some([]) => String::new(),
            Some(v) => serde_json::to_string(v).unwrap_or_default(),
        }
    }
}

/// 售后申请修改参数（Java `ClientAfterSalesUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientAfterSalesUpdateParam {
    /// 售后ID
    pub aftersale_id: Option<i32>,
    /// 订单ID
    pub order_id: Option<i32>,
    /// 售后类型
    pub aftersale_type: Option<i32>,
    /// 售后原因
    pub aftersale_reason: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 退款金额
    pub refund_amount: Option<Decimal>,
    /// 反馈图片
    pub pics: Option<Vec<serde_json::Value>>,
    /// 明细
    pub items: Option<Vec<AftersalesApplyItem>>,
    /// 用户ID（路由层用登录态覆盖）
    pub user_id: Option<i32>,
}

impl ClientAfterSalesUpdateParam {
    /// 明细数量合计（`null` 视作 0）。
    #[must_use]
    pub fn total_number(&self) -> i32 {
        self.items
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(|it| it.number.unwrap_or(0))
            .sum()
    }

    /// `pics` 序列化（`null` 返回 `None`，对齐 Java
    /// `if (updateDTO.getPics() != null) setPics(toJson(...))`）。
    #[must_use]
    pub fn pics_json(&self) -> Option<String> {
        self.pics
            .as_ref()
            .map(|v| serde_json::to_string(v).unwrap_or_default())
    }
}

/// 售后反馈参数（Java `AfterSalesFeedbackDTO`，买家回寄物流）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesFeedbackParam {
    /// 售后ID（Java 字段名 `id`）
    pub id: Option<i32>,
    /// 日志信息（Java 收到但未使用）
    pub log_info: Option<String>,
    /// 反馈图片（写 `aftersales_log.return_pic`）
    pub return_pic: Option<Vec<serde_json::Value>>,
    /// 物流名称
    pub logistics_name: Option<String>,
    /// 物流单号
    pub tracking_no: Option<String>,
    /// 用户ID（路由层用登录态覆盖）
    pub user_id: Option<i32>,
}

impl AftersalesFeedbackParam {
    /// `return_pic` 序列化；空时 Java 写 `"[]"`。
    #[must_use]
    pub fn return_pic_json(&self) -> String {
        match self.return_pic.as_deref() {
            None | Some([]) => "[]".to_string(),
            Some(v) => serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()),
        }
    }
}

/// 取消售后参数（Java `AfterSalesCancelDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesCancelParam {
    /// 售后ID
    pub aftersale_id: Option<i32>,
    /// 用户ID（路由层用登录态覆盖）
    pub user_id: Option<i32>,
}

/// 售后列表/记录查询参数（Java `AftersalesListPageQuery`）。
///
/// 分页字段对齐 Java `BasePage`（`page` / `size`，默认 1 / 15，上限 100）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesListQuery {
    /// 搜索关键字（订单号模糊）
    pub keyword: Option<String>,
    /// 售后类型
    pub aftersale_type: Option<i32>,
    /// 售后编号
    pub aftersales_sn: Option<String>,
    /// 交易单号
    pub out_trade_no: Option<String>,
    /// 售后状态
    pub status: Option<i32>,
    /// 店铺ID（前台忽略，由查询条件决定）
    pub shop_id: Option<i32>,
    /// 用户ID（路由层用登录态覆盖）
    pub user_id: Option<i32>,
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数
    pub size: Option<u64>,
}

impl AftersalesListQuery {
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

    /// 转为通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }
}

// ————————————————————— 响应结构 —————————————————————

/// 售后商品项（Java `AftersalesItemVO` 前台口径）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesItemVO {
    pub aftersales_item_id: i32,
    pub order_item_id: Option<i32>,
    pub number: Option<i32>,
    pub aftersale_id: Option<i32>,
    pub order_sn: Option<String>,
    pub product_name: Option<String>,
    pub order_id: Option<i32>,
    pub pic_thumb: Option<String>,
    pub product_sn: Option<String>,
    pub product_id: Option<i32>,
    /// 订单购买数量
    pub quantity: Option<i32>,
    /// 含税单价（`order_item.price + 单件税费`）
    pub price: Option<Decimal>,
    pub tax_rate: Option<Decimal>,
    pub tax_rate_amount: Option<Decimal>,
    pub tax_total_amount: Option<Decimal>,
    /// 附加规格数据（JSON 字符串原样下发）
    pub extra_sku_data: Option<String>,
    /// 规格数据（`order_item.sku_data` 解析后的数组）
    pub sku_data: Vec<SkuDataVO>,
    /// 规格值（`name:value` 以 `|` 连接）
    pub sku_value: Option<String>,
}

/// 规格项（Java `ProductSkuDTO.SkuData`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkuDataVO {
    pub name: String,
    pub value: String,
    pub attr_pic_thumb: Option<String>,
}

/// 售后日志（Java `AftersalesLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesLogVO {
    pub log_id: i32,
    /// 后台操作人
    pub admin_name: String,
    /// 售后ID（Java 声明为 `String`，此处保持字符串以对齐 JSON）
    pub aftersales_id: Option<String>,
    /// 记录图片（Java `List<ReturnPicDTO>`；库中为空时下发 `[]`）
    pub return_pic: Vec<serde_json::Value>,
    pub log_info: String,
    pub refund_desc: String,
    pub refund_money: Decimal,
    pub refund_type: i32,
    pub user_name: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    pub shop_id: Option<i32>,
    pub vendor_id: Option<i32>,
}

/// 售后申请记录行（Java `AftersalesVO` 前台口径）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesVO {
    pub aftersale_id: i32,
    pub status: i32,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    pub aftersale_reason: Option<String>,
    pub aftersale_type: i32,
    pub aftersales_items: Vec<AftersalesItemVO>,
    pub aftersales_sn: Option<String>,
    pub aftersales_type_name: String,
    pub audit_time: Option<String>,
    pub deal_time: Option<String>,
    pub description: String,
    pub final_time: Option<String>,
    pub logistics_name: String,
    pub order_id: Option<i32>,
    pub order_sn: String,
    /// 退款金额（Java 为字符串）
    pub refund_amount: String,
    pub reply: String,
    pub return_address: Option<String>,
    pub shop_id: i32,
    pub status_name: Option<String>,
    pub tracking_no: String,
    pub user_id: Option<i32>,
    /// 服务端当前时间 `yyyy-MM-dd HH:mm:ss`
    pub server_time: Option<String>,
}

/// 售后申请数据明细（Java `AfterSalesDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesDetailVO {
    pub item_id: i32,
    pub pic_thumb: String,
    pub product_sn: String,
    pub product_id: i32,
    pub product_name: String,
    /// 含税单价（`price + taxRateAmount`）
    pub price: Decimal,
    /// 单件税费（按订单税率，保留 2 位向上取整）
    pub tax_rate_amount: Decimal,
    pub quantity: i32,
    /// `含税单价 × 数量`（2 位向上取整）
    pub subtotal: Decimal,
    pub sku_data: Vec<SkuDataVO>,
    /// 可申请数量
    pub can_apply_quantity: i32,
    pub is_gift: i32,
    /// 附加规格价格（由 Controller 从 `order_item.extra_sku_data` 回填）
    pub attr_price: Option<Decimal>,
}

/// 售后申请数据（Java `AfterSalesApplyDataVO`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AfterSalesApplyDataVO {
    pub list: Vec<AfterSalesDetailVO>,
    pub order: OrderVO,
}

/// 售后进度条（Java `AfterSalesClientDetailVO.StepStatusVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StepStatusVO {
    /// 当前流程数（Java `current`）
    pub current: i32,
    /// `process` / `finish`
    pub status: String,
    /// 每一步：`{ title, active, description }`
    pub steps: Vec<StepVO>,
}

/// 进度条单步。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StepVO {
    pub title: String,
    pub active: bool,
    pub description: String,
}

/// 买家端售后详情（Java `AfterSalesClientDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesClientDetailVO {
    pub aftersale_id: i32,
    pub status: i32,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    pub aftersale_reason: Option<String>,
    pub aftersale_type: i32,
    pub aftersales_items: Vec<AftersalesItemVO>,
    pub aftersales_log: Vec<AftersalesLogVO>,
    pub aftersales_sn: Option<String>,
    pub aftersales_type_name: String,
    /// `yyyy-MM-dd HH:mm:ss`（0 则为 None）
    pub audit_time: Option<String>,
    pub deal_time: Option<String>,
    pub description: String,
    pub final_time: Option<String>,
    pub logistics_name: String,
    pub order_id: Option<i32>,
    /// 图片列表（Java `List<ReturnPicDTO>`）
    pub pics: Vec<serde_json::Value>,
    /// 退款金额（Java 为字符串）
    pub refund_amount: String,
    pub reply: String,
    pub return_address: Option<String>,
    pub shop_id: i32,
    pub status_name: Option<String>,
    pub status_desc: Option<String>,
    pub tracking_no: String,
    pub user_id: Option<i32>,
    /// 关联订单（Java `AfterSalesClientDetailVO.orders`）
    pub orders: Option<OrderVO>,
    pub step_status: StepStatusVO,
    pub can_cancel: bool,
    /// 售后退货提示（仅状态=待回寄时下发，其余为 None）
    pub return_goods_tip: Option<String>,
    /// 自动同意退款截止时间 `yyyy-MM-dd HH:mm:ss`
    pub auto_agree_end_time: Option<String>,
    /// 服务端当前时间 `yyyy-MM-dd HH:mm:ss`
    pub server_time: Option<String>,
}

/// 售后订单商品项（Java `AfterSalesClientVO.Item`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesClientItemVO {
    pub item_id: i32,
    pub order_id: i32,
    pub product_id: i32,
    pub price: Decimal,
    pub quantity: i32,
    pub product_name: String,
    pub product_sn: String,
    pub pic_thumb: String,
    /// 商品当前缩略图（`product.pic_thumb`）
    pub product_pic_thumb: Option<String>,
    /// 商品当前库存（`product.product_stock`）
    pub product_stock: Option<i32>,
    /// 商品重量（`product.product_weight`）
    pub product_weight: Option<Decimal>,
    /// 虚拟样品（`product.virtual_sample`）
    pub virtual_sample: Option<String>,
    /// 付费内容（`product.paid_content` 解析后的 JSON）
    pub paid_content: Option<serde_json::Value>,
    /// 卡组ID（`product.card_group_id`）
    pub card_group_id: Option<i32>,
    /// 该商品已有的售后明细
    pub aftersales_item: Option<AftersalesItemVO>,
    /// 0 不可申请 / 1 可申请（Java `aftersaleFlag`）
    pub aftersale_flag: i32,
    /// 是否可申请售后（Java `toAftersalses`）
    pub to_aftersalses: bool,
}

/// 售后申请列表行（Java `AfterSalesClientVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesClientVO {
    pub order_id: i32,
    pub order_sn: String,
    /// 发货时间 `yyyy-MM-dd HH:mm:ss`（0 则空串）
    pub shipping_time: String,
    pub items: Vec<AfterSalesClientItemVO>,
}

/// 售后配置（Java `AfterSalesController.config` 返回值）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesConfigVO {
    /// 售后类型：`{"1":"退货/退款","2":"仅退款"}`
    ///
    /// Java 用 `Map<Integer, String>`，JSON 序列化后**键为字符串**
    /// （`{"1":"退货/退款","2":"仅退款"}`），此处用 `BTreeMap<String, String>`
    /// 保持完全一致的输出形态。
    pub aftersale_type: std::collections::BTreeMap<String, String>,
    /// 售后原因列表
    pub aftersale_reason: Vec<String>,
    /// 原因开关：0 关闭 1 开启
    pub after_sales_reason_enabled: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn type_name_matches_java_enum() {
        assert_eq!(type_name(Some(1)), "退货/退款");
        assert_eq!(type_name(Some(2)), "仅退款");
        assert_eq!(type_name(Some(9)), "");
        assert_eq!(type_name(None), "");
    }

    #[test]
    fn status_sets_match_java_helpers() {
        assert_eq!(aftersales_status::applied_statuses(), [1, 2, 4, 5, 21, 22]);
        assert_eq!(aftersales_status::valid_statuses(), [1, 2, 4, 5, 6, 21, 22]);
        assert_eq!(aftersales_status::terminal_statuses(), [6, 7, 3]);
    }

    #[test]
    fn client_status_name_covers_matrix() {
        // 仅退款待审核
        assert_eq!(
            client_status_name(Some(2), Some(1), Some(0), false),
            Some("商家审核")
        );
        // 退货退款待审核
        assert_eq!(
            client_status_name(Some(1), Some(1), Some(0), false),
            Some("申请退货退款")
        );
        // 仅退款审核通过
        assert_eq!(
            client_status_name(Some(2), Some(2), Some(0), false),
            Some("财务退款")
        );
        // 仅退款财务驳回
        assert_eq!(
            client_status_name(Some(2), Some(2), Some(0), true),
            Some("退款失败（平台财务）")
        );
        // 退货退款审核通过
        assert_eq!(
            client_status_name(Some(1), Some(2), Some(0), false),
            Some("商家已收货，退款中")
        );
        // 待退货 / 已退货
        assert_eq!(
            client_status_name(Some(1), Some(4), Some(0), false),
            Some("待退货")
        );
        assert_eq!(
            client_status_name(Some(1), Some(22), Some(0), false),
            Some("已退货，待商家收货")
        );
        // 完成 / 取消
        assert_eq!(
            client_status_name(Some(1), Some(6), Some(0), false),
            Some("退款成功")
        );
        assert_eq!(
            client_status_name(Some(1), Some(7), Some(0), false),
            Some("已取消")
        );
        // 驳回：仅退款 vs 退货退款 vs 拒收
        assert_eq!(
            client_status_name(Some(2), Some(3), Some(1), false),
            Some("退款拒绝(商家)")
        );
        assert_eq!(
            client_status_name(Some(1), Some(3), Some(1), false),
            Some("退货退款被拒绝")
        );
        assert_eq!(
            client_status_name(Some(1), Some(3), Some(2), false),
            Some("商家拒收")
        );
        // 未知状态 → None（Java 返回 null）
        assert_eq!(client_status_name(Some(1), Some(99), Some(0), false), None);
        assert_eq!(client_status_name(Some(1), None, Some(0), false), None);
    }

    #[test]
    fn client_status_desc_appends_reply_like_java() {
        assert_eq!(
            client_status_desc(Some(2), Some(1), Some(0), None, false).as_deref(),
            Some("你的退款申请已提交，等待商家审核，超时未处理将自动同意。")
        );
        assert_eq!(
            client_status_desc(Some(1), Some(1), Some(0), None, false).as_deref(),
            Some("你的退货退款申请已提交，等待商家审核，超时未处理将自动同意。")
        );
        // 财务驳回带理由
        assert_eq!(
            client_status_desc(Some(2), Some(2), Some(0), Some("金额不符"), true).as_deref(),
            Some("您的退款申请已被财务拒绝，拒绝理由：金额不符，可联系商家协商或重新申请。")
        );
        // 非仅退款：忽略 finance_rejected（Java 只在 payReturn 分支判定）
        assert_eq!(
            client_status_desc(Some(1), Some(2), Some(0), Some("x"), true).as_deref(),
            Some("商家已签收商品，财务正在处理退款，将按原路退回。")
        );
        // 拒收 vs 普通驳回
        assert_eq!(
            client_status_desc(Some(1), Some(3), Some(2), Some("破损"), false).as_deref(),
            Some("商家已拒收退回的商品，拒绝理由：破损，售后已终止，可联系商家协商。")
        );
        assert_eq!(
            client_status_desc(Some(1), Some(3), Some(1), Some("破损"), false).as_deref(),
            Some("你的退货退款申请已被商家拒绝，拒绝理由：破损，可联系商家协商或重新申请。")
        );
        // reply 缺省视作空串
        assert_eq!(
            client_status_desc(Some(2), Some(3), Some(0), None, false).as_deref(),
            Some("你的退款申请已被商家拒绝，拒绝理由：，可联系商家协商或重新申请。")
        );
        // 取消状态无副文案
        assert_eq!(
            client_status_desc(Some(1), Some(7), Some(0), None, false),
            None
        );
    }

    #[test]
    fn param_helpers_match_java() {
        let p: CreateAftersalesParam = serde_json::from_str(
            r#"{"orderId":7,"aftersaleType":1,"items":[{"orderItemId":1,"number":0},
                {"orderItemId":2,"number":3}],"pics":[{"picUrl":"a.png"}]}"#,
        )
        .unwrap();
        assert_eq!(p.order_id, Some(7));
        assert_eq!(p.total_number(), 3);
        // number == 0 的明细被过滤（Java filter(item.getNumber() != 0)）
        let nz = p.non_zero_items();
        assert_eq!(nz.len(), 1);
        assert_eq!(nz[0].order_item_id, Some(2));
        assert_eq!(p.pics_json(), r#"[{"picUrl":"a.png"}]"#);

        // 空 pics → 空串
        let empty = CreateAftersalesParam::default();
        assert_eq!(empty.pics_json(), "");
        assert_eq!(empty.total_number(), 0);
    }

    #[test]
    fn update_param_pics_json_is_none_when_absent() {
        let p: ClientAfterSalesUpdateParam =
            serde_json::from_str(r#"{"aftersaleId":1,"items":[{"orderItemId":1,"number":2}]}"#)
                .unwrap();
        assert_eq!(p.pics_json(), None);
        assert_eq!(p.total_number(), 2);

        let p2: ClientAfterSalesUpdateParam =
            serde_json::from_str(r#"{"aftersaleId":1,"pics":[]}"#).unwrap();
        assert_eq!(p2.pics_json().as_deref(), Some("[]"));
    }

    #[test]
    fn feedback_return_pic_defaults_to_empty_array_string() {
        let p = AftersalesFeedbackParam::default();
        assert_eq!(p.return_pic_json(), "[]");
        let p: AftersalesFeedbackParam =
            serde_json::from_str(r#"{"id":1,"returnPic":[{"picUrl":"x"}]}"#).unwrap();
        assert_eq!(p.return_pic_json(), r#"[{"picUrl":"x"}]"#);
    }

    #[test]
    fn list_query_paging_matches_base_page() {
        let q = AftersalesListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);

        let q: AftersalesListQuery = serde_json::from_str(r#"{"page":0,"size":999}"#).unwrap();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 100);

        let q: AftersalesListQuery = serde_json::from_str(r#"{"page":3,"size":20}"#).unwrap();
        assert_eq!(q.page_query().page, 3);
        assert_eq!(q.page_query().page_size, 20);
    }
}
