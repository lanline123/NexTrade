//! 售后管理域（trade::aftersales）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.order.AftersalesListPageQuery`（`list` 查询参数）
//! - `com.tigshop.bean.param.order.AftersalesEditParam`（`update` 审核参数）
//! - `com.tigshop.bean.dto.order.AfterSalesRejectReceiveDTO`（`rejectReceive`）
//! - `com.tigshop.bean.dto.order.AfterSalesCompleteDTO`（`complete`）
//! - `com.tigshop.bean.dto.order.AftersalesRecordCreateDTO`（`record`）
//! - `com.tigshop.bean.vo.order.AftersalesVO` / `AftersalesItemVO` / `AftersalesLogVO`
//! - 枚举 `AftersalesStatusEnum` / `AftersalesTypeEnum`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! **为什么另起本文件而不是复用 `models::order_admin`**：`order_admin` 内已有一份
//! `aftersales_status` / `aftersales_type` 常量（订单域的删除/取消订单链路在用），
//! 但缺 `REFUSE` 之外的终态集合、也缺后台状态文案与列表/详情 VO；本切片不得
//! 修改共享文件，故在本文件内定义售后管理域专用结构（与 order_admin 同一约定）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ————————————————————— 枚举与常量 —————————————————————

/// 售后状态码（对应 Java `AftersalesStatusEnum`）。
pub mod aftersales_status {
    /// 审核处理中
    pub const IN_REVIEW: i32 = 1;
    /// 审核通过（仅退款：平台处理中）
    pub const APPROVED_FOR_PROCESSING: i32 = 2;
    /// 审核未通过（终态）
    pub const REFUSE: i32 = 3;
    /// 待用户回寄
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

    /// closeType：商家审核驳回（Java `CLOSE_TYPE_AUDIT_REJECT`）。
    pub const CLOSE_TYPE_AUDIT_REJECT: i32 = 1;
    /// closeType：商家/供应商拒收（Java `CLOSE_TYPE_REJECT_RECEIVE`）。
    pub const CLOSE_TYPE_REJECT_RECEIVE: i32 = 2;

    /// 状态名（Java `AftersalesStatusEnum.getStatusName`，未知名返回空串）。
    #[must_use]
    pub fn name(code: i32) -> &'static str {
        match code {
            IN_REVIEW => "审核处理中",
            APPROVED_FOR_PROCESSING => "审核通过",
            REFUSE => "审核未通过",
            SEND_BACK => "待回寄",
            RETURNED => "待商家收货",
            COMPLETE => "已完成",
            CANCEL => "已取消",
            WAIT_FOR_SUPPLIER_AUDIT => "待供应商审核",
            WAIT_FOR_SUPPLIER_RECEIPT => "待供应商收货",
            _ => "",
        }
    }

    /// 占用可售后数量的「有效状态」（Java `validStatus()`，不含 REFUSE）。
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

    /// 「售后进行中」状态（Java `inProgressStatus()`，三个终态之外）。
    #[must_use]
    pub fn in_progress_statuses() -> [i32; 4] {
        [IN_REVIEW, APPROVED_FOR_PROCESSING, SEND_BACK, RETURNED]
    }

    /// 「已申请售后」状态（Java `AftersalesServiceImpl#getAfterSalseStatusList`
    /// 的非供应商口径；供应商口径额外含 21/22，由 `vendor` 参数控制）。
    #[must_use]
    pub fn applied_statuses(vendor: bool) -> Vec<i32> {
        let mut v = vec![IN_REVIEW, APPROVED_FOR_PROCESSING, SEND_BACK, RETURNED];
        if vendor {
            v.push(WAIT_FOR_SUPPLIER_AUDIT);
            v.push(WAIT_FOR_SUPPLIER_RECEIPT);
        }
        v
    }

    /// 是否属于「有效状态」（Java `validStatus().contains`）。
    #[must_use]
    pub fn is_valid(code: i32) -> bool {
        valid_statuses().contains(&code)
    }

    /// 是否为供应商订单（Java `isSupplier`：`vendor_id > 0`）。
    #[must_use]
    pub fn is_supplier(vendor_id: Option<i32>) -> bool {
        vendor_id.is_some_and(|v| v > 0)
    }

    /// 是否为「仅退款」（Java `isPayReturn`，`aftersale_type == 2`）。
    #[must_use]
    pub fn is_pay_return(aftersale_type: Option<i32>) -> bool {
        aftersale_type == Some(crate::models::trade::aftersales::aftersales_type::PAY_RETURN)
    }

    /// 后台售后详情状态头文案（Java `AftersalesStatusEnum.getAdminStatusName`）。
    #[must_use]
    pub fn admin_name(
        aftersale_type: Option<i32>,
        status: i32,
        vendor_id: Option<i32>,
        finance_rejected: bool,
    ) -> Option<&'static str> {
        let supplier = is_supplier(vendor_id);
        match status {
            IN_REVIEW => Some(if supplier {
                "店铺审核中"
            } else {
                "买家申请售后"
            }),
            WAIT_FOR_SUPPLIER_AUDIT => Some("供应商审核中"),
            APPROVED_FOR_PROCESSING => {
                if is_pay_return(aftersale_type) {
                    Some(if finance_rejected {
                        "平台已拒绝"
                    } else {
                        "平台处理中"
                    })
                } else {
                    Some("已收到退货，退款处理中")
                }
            }
            SEND_BACK => Some("售后已通过，待用户回寄"),
            RETURNED => Some("已退货，待商家收货"),
            WAIT_FOR_SUPPLIER_RECEIPT => Some("已退货，待供应商收货"),
            COMPLETE => Some("售后已完成"),
            REFUSE | CANCEL => Some("售后已关闭"),
            _ => None,
        }
    }

    /// 理由拼接（Java `withReason`：`prefix + reply`，reply 为空按空串处理）。
    fn with_reason(prefix: &str, reply: Option<&str>) -> String {
        format!("{prefix}{}", reply.unwrap_or(""))
    }

    /// 后台售后详情状态副文案（Java `AftersalesStatusEnum.getAdminStatusDescription`）。
    ///
    /// 带倒计时的状态（1/21）返回 `None`，由 `auto_agree_end_time` 驱动倒计时展示。
    #[must_use]
    pub fn admin_description(
        aftersale_type: Option<i32>,
        status: i32,
        vendor_id: Option<i32>,
        close_type: i32,
        reply: Option<&str>,
        finance_rejected: bool,
    ) -> Option<String> {
        let supplier = is_supplier(vendor_id);
        match status {
            IN_REVIEW | WAIT_FOR_SUPPLIER_AUDIT => None,
            APPROVED_FOR_PROCESSING => Some(if is_pay_return(aftersale_type) {
                if finance_rejected {
                    with_reason("退款申请已被拒绝，理由：", reply)
                } else {
                    "售后已通过，平台退款处理中".to_string()
                }
            } else {
                "退货申请已通过，平台退款处理中".to_string()
            }),
            SEND_BACK => Some("售后已同意，请及时通知买家填写退货物流".to_string()),
            RETURNED | WAIT_FOR_SUPPLIER_RECEIPT => {
                Some("买家已寄出商品，请及时确认收货".to_string())
            }
            COMPLETE => Some("退款已成功，售后流程结束".to_string()),
            REFUSE => {
                if is_pay_return(aftersale_type) {
                    return Some(with_reason("退款申请已被拒绝，理由：", reply));
                }
                if close_type == CLOSE_TYPE_REJECT_RECEIVE {
                    let prefix = if supplier {
                        "供应商已拒收商品，理由："
                    } else {
                        "商家已拒收商品，理由："
                    };
                    return Some(format!("{}，售后终止", with_reason(prefix, reply)));
                }
                Some(with_reason(
                    if supplier {
                        "供应商退货退款申请已被拒绝，理由："
                    } else {
                        "退货退款申请已被拒绝，理由："
                    },
                    reply,
                ))
            }
            _ => None,
        }
    }

    /// 列表状态文案（Java `AftersalesServiceImpl#resolveListStatusName` 的后台口径）。
    ///
    /// - 财务已拒绝：按状态 2 + `financeRejected = true` 出文案；
    /// - 待财务退款：按状态 2 出文案；
    /// - 其余：沿用售后主单状态原文案。
    #[must_use]
    pub fn resolve_list_status_name(
        aftersale: &crate::entities::Aftersales,
        pending_finance_refund: bool,
        finance_rejected: bool,
    ) -> String {
        if finance_rejected {
            return admin_name(
                Some(aftersale.aftersale_type),
                APPROVED_FOR_PROCESSING,
                aftersale.vendor_id,
                true,
            )
            .unwrap_or_default()
            .to_string();
        }
        if pending_finance_refund {
            return admin_name(
                Some(aftersale.aftersale_type),
                APPROVED_FOR_PROCESSING,
                aftersale.vendor_id,
                false,
            )
            .unwrap_or_default()
            .to_string();
        }
        name(aftersale.status).to_string()
    }
}

/// 售后类型（对应 Java `AftersalesTypeEnum`）。
pub mod aftersales_type {
    /// 退货/退款
    pub const RETURN: i32 = 1;
    /// 仅退款
    pub const PAY_RETURN: i32 = 2;

    /// 类型名（Java `AftersalesTypeEnum.getTypeName`，未知返回空串）。
    #[must_use]
    pub fn name(code: Option<i32>) -> &'static str {
        match code {
            Some(RETURN) => "退货/退款",
            Some(PAY_RETURN) => "仅退款",
            _ => "",
        }
    }
}

/// 后台账号类型（对应 Java `AdminTypeEnum` 的 code）。
pub mod admin_type {
    /// 平台管理后台
    pub const ADMIN: &str = "admin";
    /// 店铺
    pub const SHOP: &str = "shop";
    /// 供应商
    pub const VENDOR: &str = "vendor";
    /// 门店
    pub const STORE: &str = "store";
    /// 自提点
    pub const PICKUP: &str = "pickup";
    /// 收银台
    pub const POS: &str = "pos";

    /// 是否为 Java `AdminTypeEnum` 认可的 code（Java 未知 code 会抛 `IllegalArgumentException`）。
    #[must_use]
    pub fn is_known(code: &str) -> bool {
        matches!(code, ADMIN | SHOP | VENDOR | STORE | PICKUP | POS)
    }
}

/// 供应商端开关（对应 Java `TigshopProperties.getIsVendor()`）。
///
/// `java/tigshop-adminapi/src/main/resources/application.yaml` 中
/// `tigshop.is-vendor: 0`，Rust 侧尚无配置项服务，故按该部署默认值固定为关闭。
/// 所有依赖此开关的分支（供应商审核环节、供应商待收货状态、`returnGoodsStatus`
/// 的 21/22 文案）在 Rust 侧恒走「非供应商」分支——详见 `uncertain_points`。
pub const IS_VENDOR: i32 = 0;

/// 该部署是否为供应商端（Java `tigshopProperties.getIsVendor() == 1`）。
#[must_use]
pub fn is_vendor_deployment() -> bool {
    IS_VENDOR == 1
}

/// 自动同意退款截止时间（对应 Java `AftersalesServiceImpl#resolveAutoAgreeEndTime`）。
///
/// Java 的取数依赖 `configService.getConfigVal(SettingsEnum.AUTO_RETURN_GOODS)` 与
/// `AUTO_RETURN_GOODS_DAYS`：**只有开启自动同意退货时**才返回
/// `add_time + days*86400` 的 `yyyy-MM-dd HH:mm:ss`，否则返回 `None`。
/// Rust 侧配置项服务未迁移（无法得知开关是否开启），故恒返回 `None`——
/// 前端据 `status` 本地兜底，行为与「开关关闭」一致（详见 `uncertain_points`）。
#[must_use]
pub fn resolve_auto_agree_end_time(status: i32, _add_time: i32) -> Option<String> {
    // 仅「待审核(1)/待供应商审核(21)」才可能有倒计时；开关未迁移 → 恒 None
    let _ = matches!(
        status,
        aftersales_status::IN_REVIEW | aftersales_status::WAIT_FOR_SUPPLIER_AUDIT
    );
    None
}

// ————————————————————— 查询参数 —————————————————————

/// 售后列表查询（对应 Java `AftersalesListPageQuery extends BasePage`）。
///
/// 分页字段与 Java `BasePage` 一致：`page`（默认 1）、`size`（默认 15，上限 100）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesListQuery {
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 搜索关键字（匹配订单号 `order.order_sn`）
    pub keyword: Option<String>,
    /// 售后类型（1 退货退款 / 2 仅退款）
    pub aftersale_type: Option<i32>,
    /// 售后编号（模糊匹配 `aftersales.aftersales_sn`）
    pub aftersales_sn: Option<String>,
    /// 交易单号（匹配 `order.out_trade_no`）
    pub out_trade_no: Option<String>,
    /// 售后状态
    pub status: Option<i32>,
    /// 店铺ID（Java 由请求头 `x-shop-id` 覆盖）
    pub shop_id: Option<i32>,
    /// 用户ID
    pub user_id: Option<i32>,
    /// 微信直播主键ID（直播域未迁移，传入即报错）
    pub wechat_live_id: Option<i32>,
    /// 微信直播房间ID（直播域未迁移，传入即报错）
    pub wechat_live_room_id: Option<i32>,
    /// 微信直播商品ID（直播域未迁移，传入即报错）
    pub wechat_goods_id: Option<i32>,
    /// 直播分享人 OpenId（直播域未迁移，传入即报错）
    pub live_share_open_id: Option<String>,
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

    /// 转为通用分页参数（与 `PageResult` 口径一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// 是否传了微信直播筛选条件（Java `filterByLive`）。
    #[must_use]
    pub fn filter_by_live(&self) -> bool {
        self.wechat_live_id.is_some()
            || self.wechat_live_room_id.is_some()
            || self.wechat_goods_id.is_some()
            || self
                .live_share_open_id
                .as_deref()
                .is_some_and(|s| !s.trim().is_empty())
    }
}

// ————————————————————— 请求参数 —————————————————————

/// 售后审核参数（对应 Java `AftersalesEditParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesEditParam {
    /// 售后管理ID（Java `@NotNull` 语义，服务层校验）
    pub id: Option<i32>,
    /// 目标状态（2 审核通过 / 3 审核未通过）
    pub status: Option<i32>,
    /// 退款金额（Java `@Min(0)`）
    pub refund_amount: Option<Decimal>,
    /// 回复/审核备注
    pub reply: Option<String>,
    /// 退货地址
    pub return_address: Option<String>,
    /// 售后退货提示
    pub return_goods_tip: Option<String>,
}

/// 商家/供应商拒收参数（对应 Java `AfterSalesRejectReceiveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesRejectReceiveParam {
    /// 售后ID（Java `@NotNull`）
    pub id: Option<i32>,
    /// 拒收理由（Java `@NotNull` + `@Size(max = 200)`）
    pub reply: Option<String>,
}

/// 售后完结参数（对应 Java `AfterSalesCompleteDTO`）。
///
/// Java 只有一个 `id` 字段；额外接受 `aftersaleId` 别名以兼容前端既有传参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesCompleteParam {
    /// 售后ID
    pub id: Option<i32>,
    /// 售后ID（别名，等价于 `id`）
    pub aftersale_id: Option<i32>,
}

impl AfterSalesCompleteParam {
    /// 取售后ID（`id` 优先，回退 `aftersaleId`）。
    #[must_use]
    pub fn resolved_id(&self) -> Option<i32> {
        self.id.or(self.aftersale_id)
    }
}

/// 提交售后反馈记录参数（对应 Java `AftersalesRecordCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesRecordCreateParam {
    /// 日志内容
    pub log_info: Option<String>,
    /// 售后ID
    pub aftersale_id: Option<i32>,
    /// 凭证图片（Java `List<Object>`，原样透传）
    pub return_pic: Option<Vec<serde_json::Value>>,
    /// 物流单号
    pub tracking_no: Option<String>,
    /// 物流名称
    pub logistics_name: Option<String>,
}

/// 售后创建参数（对应 Java `AftersalesApplyParam` 在 `create` 链路上用到的字段）。
///
/// **注意**：Java `AftersalesController.create` 只把本 DTO 逐字段拷进 `Aftersales`
/// 后 `save()`，不校验订单、不写明细、不写协商记录、不计算退款金额。
/// `items` / `isAdminCancel` 在该链路上完全未被使用，故此处不声明。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesCreateParam {
    /// 订单id
    pub order_id: Option<i32>,
    /// 售后类型
    pub aftersale_type: Option<i32>,
    /// 售后原因
    pub aftersale_reason: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 退款金额
    pub refund_amount: Option<Decimal>,
    /// 反馈图片（Java `List<ReturnPicDTO>`，原样序列化写入 `aftersales.pics`）
    pub pics: Option<Vec<serde_json::Value>>,
    /// 用户id
    pub user_id: Option<i32>,
}

/// 售后确认收货参数（对应 Java `receive(@RequestBody Map<String, Integer> data)`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesReceiveParam {
    /// 售后ID
    pub id: Option<i32>,
}

// ————————————————————— 返回结构 —————————————————————

/// 售后商品项 VO（对应 Java `AftersalesItemVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesItemVO {
    /// 售后项目ID
    pub aftersales_item_id: i32,
    /// 订单项ID
    pub order_item_id: Option<i32>,
    /// 申请数量
    pub number: Option<i32>,
    /// 售后ID
    pub aftersale_id: Option<i32>,
    /// 订单号
    pub order_sn: String,
    /// 产品名称
    pub product_name: String,
    /// 订单ID
    pub order_id: i32,
    /// 产品缩略图
    pub pic_thumb: String,
    /// 产品编号
    pub product_sn: String,
    /// 产品ID
    pub product_id: i32,
    /// 购买数量（来自售后明细当前所占用口径的展示需求；Java 与 `number` 分开）
    pub quantity: i32,
    /// 价格（Java 回显为「商品单价 + 单件税费」）
    pub price: Decimal,
    /// 供应商供货价快照（仅供应商视角下发；本切片恒不下发）
    pub supply_price: Option<Decimal>,
    /// 税率(百分比)
    pub tax_rate: Decimal,
    /// 单个商品税费（单价 × 税率 ÷ 100，2 位小数向上取整）
    pub tax_rate_amount: Decimal,
    /// 售后数量对应税费（`tax_rate_amount × number`）
    pub tax_total_amount: Decimal,
    /// 附加规格数据（JSON 字符串，原样透传）
    pub extra_sku_data: Option<String>,
    /// 规格数据（原样解析，字段名保持库中 JSON 结构）
    pub sku_data: Vec<serde_json::Value>,
    /// 规格值（`名称:值` 以 `|` 连接）
    pub sku_value: String,
}

/// 售后协商记录 VO（对应 Java `AftersalesLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesLogVO {
    /// 售后记录ID
    pub log_id: i32,
    /// 后台操作人
    pub admin_name: String,
    /// 售后id
    pub aftersales_id: String,
    /// 售后记录图片（原样解析）
    pub return_pic: Vec<serde_json::Value>,
    /// 日志信息
    pub log_info: String,
    /// 售后描述
    pub refund_desc: String,
    /// 退款金额
    pub refund_money: Decimal,
    /// 售后类型
    pub refund_type: i32,
    /// 用户名
    pub user_name: Option<String>,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 店铺id
    pub shop_id: Option<i32>,
    /// 供应商id
    pub vendor_id: Option<i32>,
}

/// 售后 VO（对应 Java `AftersalesVO` 的后台必需字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AftersalesVO {
    // *** aftersales 表字段 ***
    pub aftersale_id: i32,
    pub status: i32,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 售后原因
    pub aftersale_reason: Option<String>,
    pub aftersale_type: i32,
    /// 售后单号
    pub aftersales_sn: Option<String>,
    /// 审核时间 `yyyy-MM-dd HH:mm:ss`
    pub audit_time: String,
    /// 处理时间 `yyyy-MM-dd HH:mm:ss`
    pub deal_time: String,
    /// 完结时间 `yyyy-MM-dd HH:mm:ss`
    pub final_time: String,
    pub description: String,
    /// 物流名称
    pub logistics_name: String,
    /// 跟踪号
    pub tracking_no: String,
    /// 订单ID
    pub order_id: i32,
    /// 订单号
    pub order_sn: String,
    /// 凭证图片（原样解析 `aftersales.pics`）
    pub pics: Vec<serde_json::Value>,
    /// 退款金额（Java 用 `Decimal.toString()`，此处同为字符串）
    pub refund_amount: String,
    /// 实际退款金额（审核前为 0）
    pub actual_refund_amount: Decimal,
    /// 回复/审核备注
    pub reply: String,
    /// 退货地址
    pub return_address: Option<String>,
    /// 售后退货提示
    pub return_goods_tip: String,
    pub shop_id: i32,
    pub user_id: i32,
    pub vendor_id: Option<i32>,
    /// 关闭/拒绝子类型
    pub close_type: i32,

    // *** 派生字段 ***
    /// 状态名称
    pub status_name: String,
    /// 状态副文案（缺失时前端按 status 本地兜底）
    pub status_description: Option<String>,
    /// 售后类型名称
    pub aftersales_type_name: String,
    /// 建议退款金额
    pub suggest_refund_amount: Option<Decimal>,
    /// 退款税费金额（本次退款金额中包含的税费）
    pub refund_tax_amount: Option<Decimal>,
    /// 关联订单标记
    pub mark: Option<i32>,
    /// 关联订单商家备注
    pub admin_note: Option<String>,
    /// 自动同意退款截止时间 `yyyy-MM-dd HH:mm:ss`
    pub auto_agree_end_time: Option<String>,
    /// 服务器当前时间 `yyyy-MM-dd HH:mm:ss`
    pub server_time: String,

    // *** 关联数据 ***
    /// 售后项目列表
    pub aftersales_items: Vec<AftersalesItemVO>,
    /// 售后协商记录
    pub aftersales_log: Vec<AftersalesLogVO>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::Aftersales;

    fn aftersale(aftersale_type: i32, status: i32, vendor_id: Option<i32>) -> Aftersales {
        Aftersales {
            aftersale_id: 1,
            aftersale_type,
            status,
            vendor_id,
            ..Default::default()
        }
    }

    #[test]
    fn status_constants_match_java_enum() {
        assert_eq!(aftersales_status::IN_REVIEW, 1);
        assert_eq!(aftersales_status::APPROVED_FOR_PROCESSING, 2);
        assert_eq!(aftersales_status::REFUSE, 3);
        assert_eq!(aftersales_status::SEND_BACK, 4);
        assert_eq!(aftersales_status::RETURNED, 5);
        assert_eq!(aftersales_status::COMPLETE, 6);
        assert_eq!(aftersales_status::CANCEL, 7);
        assert_eq!(aftersales_status::WAIT_FOR_SUPPLIER_AUDIT, 21);
        assert_eq!(aftersales_status::WAIT_FOR_SUPPLIER_RECEIPT, 22);
        assert_eq!(aftersales_status::valid_statuses(), [1, 2, 4, 5, 6]);
        assert_eq!(aftersales_status::in_progress_statuses(), [1, 2, 4, 5]);
        assert_eq!(aftersales_status::applied_statuses(false), vec![1, 2, 4, 5]);
        assert_eq!(
            aftersales_status::applied_statuses(true),
            vec![1, 2, 4, 5, 21, 22]
        );
        // REFUSE 为终态，不占用可售后数量
        assert!(!aftersales_status::is_valid(aftersales_status::REFUSE));
        assert!(aftersales_status::is_valid(aftersales_status::COMPLETE));
    }

    #[test]
    fn type_names_match_java_enum() {
        assert_eq!(aftersales_type::name(Some(1)), "退货/退款");
        assert_eq!(aftersales_type::name(Some(2)), "仅退款");
        assert_eq!(aftersales_type::name(Some(9)), "");
        assert_eq!(aftersales_type::name(None), "");
    }

    #[test]
    fn admin_status_name_follows_java_switch() {
        // 无供应商时的状态 1
        assert_eq!(
            aftersales_status::admin_name(Some(1), 1, None, false),
            Some("买家申请售后")
        );
        // 供应商订单的状态 1
        assert_eq!(
            aftersales_status::admin_name(Some(1), 1, Some(9), false),
            Some("店铺审核中")
        );
        // 仅退款：财务拒绝文案切换
        assert_eq!(
            aftersales_status::admin_name(Some(2), 2, None, false),
            Some("平台处理中")
        );
        assert_eq!(
            aftersales_status::admin_name(Some(2), 2, None, true),
            Some("平台已拒绝")
        );
        // 退货退款：状态 2 文案不同
        assert_eq!(
            aftersales_status::admin_name(Some(1), 2, None, false),
            Some("已收到退货，退款处理中")
        );
        // 3 与 7 同为「售后已关闭」
        assert_eq!(
            aftersales_status::admin_name(Some(1), 3, None, false),
            Some("售后已关闭")
        );
        assert_eq!(
            aftersales_status::admin_name(Some(1), 7, Some(3), false),
            Some("售后已关闭")
        );
        assert_eq!(
            aftersales_status::admin_name(Some(1), 99, None, false),
            None
        );
    }

    #[test]
    fn admin_status_description_follows_java_switch() {
        // 带倒计时的状态无副文案
        assert_eq!(
            aftersales_status::admin_description(Some(1), 1, None, 0, Some("x"), false),
            None
        );
        assert_eq!(
            aftersales_status::admin_description(Some(1), 21, None, 0, Some("x"), false),
            None
        );
        // 仅退款 + 财务驳回：拼理由
        assert_eq!(
            aftersales_status::admin_description(Some(2), 2, None, 0, Some("资料不全"), true)
                .as_deref(),
            Some("退款申请已被拒绝，理由：资料不全")
        );
        // 仅退款审核驳回：同一前缀
        assert_eq!(
            aftersales_status::admin_description(Some(2), 3, None, 1, Some("超时"), false)
                .as_deref(),
            Some("退款申请已被拒绝，理由：超时")
        );
        // 商家拒收（closeType=2）：前缀区分供应商
        assert_eq!(
            aftersales_status::admin_description(
                Some(1),
                3,
                None,
                aftersales_status::CLOSE_TYPE_REJECT_RECEIVE,
                Some("破损"),
                false
            )
            .as_deref(),
            Some("商家已拒收商品，理由：破损，售后终止")
        );
        assert_eq!(
            aftersales_status::admin_description(
                Some(1),
                3,
                Some(7),
                aftersales_status::CLOSE_TYPE_REJECT_RECEIVE,
                Some("破损"),
                false
            )
            .as_deref(),
            Some("供应商已拒收商品，理由：破损，售后终止")
        );
        // 退货退款审核驳回
        assert_eq!(
            aftersales_status::admin_description(Some(1), 3, None, 1, Some("不符合"), false)
                .as_deref(),
            Some("退货退款申请已被拒绝，理由：不符合")
        );
        // reply 为空时不出现 "null"
        assert_eq!(
            aftersales_status::admin_description(Some(1), 3, None, 1, None, false).as_deref(),
            Some("退货退款申请已被拒绝，理由：")
        );
    }

    #[test]
    fn resolve_list_status_name_prefers_finance_flags() {
        let a = aftersale(
            aftersales_type::PAY_RETURN,
            aftersales_status::COMPLETE,
            None,
        );
        // 常态：主单状态原文案
        assert_eq!(
            aftersales_status::resolve_list_status_name(&a, false, false),
            "已完成"
        );
        // 待财务退款：按状态 2 展示
        assert_eq!(
            aftersales_status::resolve_list_status_name(&a, true, false),
            "平台处理中"
        );
        // 财务已拒绝优先于待退款
        assert_eq!(
            aftersales_status::resolve_list_status_name(&a, true, true),
            "平台已拒绝"
        );
    }

    #[test]
    fn list_query_defaults_match_base_page() {
        let q = AftersalesListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);

        let q: AftersalesListQuery = serde_json::from_str(r#"{"size":500,"page":0}"#).unwrap();
        assert_eq!(q.page_size(), 100);
        assert_eq!(q.page_no(), 1);
    }

    #[test]
    fn list_query_accepts_camel_case_fields() {
        let q: AftersalesListQuery = serde_json::from_str(
            r#"{"page":2,"size":30,"keyword":"TIG","aftersaleType":1,
                "aftersalesSn":"SN1","outTradeNo":"PAY1","status":2,"shopId":3,
                "userId":9,"wechatLiveId":5}"#,
        )
        .expect("AftersalesListQuery 应接受 camelCase 字段");
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.aftersale_type, Some(1));
        assert_eq!(q.aftersales_sn.as_deref(), Some("SN1"));
        assert_eq!(q.out_trade_no.as_deref(), Some("PAY1"));
        assert_eq!(q.status, Some(2));
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.user_id, Some(9));
        assert!(q.filter_by_live());

        let q: AftersalesListQuery = serde_json::from_str(r#"{"liveShareOpenId":"  "}"#).unwrap();
        assert!(!q.filter_by_live());
    }

    #[test]
    fn complete_param_accepts_id_alias() {
        let p: AfterSalesCompleteParam = serde_json::from_str(r#"{"id":7}"#).unwrap();
        assert_eq!(p.resolved_id(), Some(7));
        let p: AfterSalesCompleteParam = serde_json::from_str(r#"{"aftersaleId":8}"#).unwrap();
        assert_eq!(p.resolved_id(), Some(8));
        let p = AfterSalesCompleteParam::default();
        assert_eq!(p.resolved_id(), None);
    }

    #[test]
    fn reject_receive_param_parses() {
        let p: AfterSalesRejectReceiveParam =
            serde_json::from_str(r#"{"id":3,"reply":"数量不符"}"#).unwrap();
        assert_eq!(p.id, Some(3));
        assert_eq!(p.reply.as_deref(), Some("数量不符"));
    }

    #[test]
    fn admin_type_vendor_and_known_codes() {
        assert!(admin_type::is_known("vendor"));
        assert!(!admin_type::is_known("unknown"));
        // 当前部署 is-vendor: 0 → 非供应商端
        assert!(!is_vendor_deployment());
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = AftersalesVO {
            aftersale_id: 11,
            order_id: 3,
            order_sn: "SN1".into(),
            refund_amount: "12.30".into(),
            status_name: "审核处理中".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["aftersaleId"], 11);
        assert_eq!(json["orderId"], 3);
        assert_eq!(json["orderSn"], "SN1");
        assert_eq!(json["refundAmount"], "12.30");
        assert_eq!(json["statusName"], "审核处理中");
        assert_eq!(json["aftersalesItems"], serde_json::json!([]));
    }
}
