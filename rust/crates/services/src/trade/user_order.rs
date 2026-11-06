//! 前台用户订单域服务（trade::user_order）。
//!
//! 对应原 Java `com.tigshop.service.order.impl.OrderServiceImpl` 的
//! `orderNum` / `delOrder` / `confirmReceipt` / `getShippingInfo` 与
//! `CartServiceImpl#buyAgain`、`AfterSalesReasonConfigService#getConfig`。
//!
//! # 迁移要点（逐条对照 Java 源）
//!
//! - `orderNum`：8 项统计（待付款/待发货/待收货/待评价/已完成/商品收藏/店铺收藏/售后中），
//!   订单统计按 Java `getOrderStatusCount` 口径（`is_del = 0` + `is_valid = 1` +
//!   排除未支付拆单子单）；其中「待评价」用 `order_comment_status`，即
//!   `comment_status = 0 AND order_status = 5`。售后取进行中状态集合。
//! - `reasonConfig`：读 config（开关 + JSON 数组原因），缺失/非法用 Java 默认值；
//!   i18n 翻译未迁移（原样返回）。
//! - `delOrder`：`availableActions.delOrder` 语义（已取消/无效/已完成且未删除）→
//!   `order_status = 3` + `is_del = 1` + 订单日志「订单删除」。
//! - `confirmReceipt`：归属校验（非本人订单静默返回，与控制器 count 判断一致）→
//!   `availableActions.confirmReceipt`（处理中）→ 完成订单 + 日志。
//! - `shippingInfo`：订单/单号/物流公司缺失 → `null`（Java 返回 null）；
//!   当前激活快递鸟时实时查询 1002，其它情况返回运单快照。
//! - `buyAgain`：订单商品仍在售 → 命中同商品同规格购物车行则累加数量，否则加购；
//!   价格取订单快照（Java 会走 `addProductToCart` 的价格/活动重算，本实现未迁移）。
//!
//! # 结算级联（2026-10-25 起已迁移）
//!
//! - `confirmReceipt` 的收尾统一走 [`crate::trade::settlement::SettlementService`]：
//!   积分赠送（节点 3）、会员成长值、次卡主单推进、出账单置已结算、
//!   分销结算与佣金入账、分销佣金出账、店铺资金结算（`shop_money` +
//!   `shop_account_log` + `is_settlement` 原子抢占）、平台消息副本、分销员等级升级。
//! - `buyAgain`（2026-10-25 起）走 `CartService::add`：当前售价 + 可购校验 +
//!   同款数量合并（对齐 Java `addProductToCart`）；快递100 查询已接入。
//! - `delOrder`/`confirmReceipt` 的 `orderLogService.quickCreate` 已按 order_log 表落库。

use std::sync::Arc;

use tigshop_common::utils::now_seconds;
use tigshop_core::models::trade::user_order::{
    can_confirm_receipt, can_delete_order, parse_reason_enabled, parse_reason_list, OrderBrief,
    OrderIdDTO, OrderNumVO, ReasonConfigVO, ShippingResult, ShippingTraceVO, COMMENT_STATUS_PENDING,
    CONFIG_REASON_ENABLED, CONFIG_REASON_LIST, MSG_ORDER_NOT_EXIST,
    MSG_ORDER_STATUS_ERROR, ORDER_STATUS_COMPLETED, ORDER_STATUS_CONFIRMED, ORDER_STATUS_PENDING,
    ORDER_STATUS_PROCESSING, ORDER_TYPE_RESERVATION_HOME,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::trade::user_order::UserOrderRepository;
use tigshop_infrastructure::db::Repositories;

/// 前台用户订单域服务。
pub struct UserOrderService {
    repos: Arc<Repositories>,
}

impl UserOrderService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED 访问：`self.repos.trade.user_order`）。
    #[must_use]
    pub fn repo(&self) -> &UserOrderRepository {
        &self.repos.trade.user_order
    }

    pub async fn cycle_cards(
        &self,
        user_id: i32,
        page: u64,
        size: u64,
    ) -> Result<(i64, Vec<serde_json::Value>)> {
        self.repo().cycle_cards(user_id, page, size).await
    }

    pub async fn cycle_card(&self, user_id: i32, card_id: i32) -> Result<Option<serde_json::Value>> {
        self.repo().cycle_card(user_id, card_id).await
    }

    pub async fn cycle_refund_info(&self, user_id: i32, card_id: i32) -> Result<Option<serde_json::Value>> {
        self.repo().cycle_refund_info(user_id, card_id).await
    }

    pub async fn cycle_aftersales_check(&self, user_id: i32, order_id: i32) -> Result<serde_json::Value> {
        self.repo().cycle_aftersales_check(user_id, order_id).await
    }

    /// 订单数量（Java `OrderServiceImpl#orderNum`）。
    pub async fn order_num(&self, user_id: i32) -> Result<OrderNumVO> {
        let repo = self.repo();
        let await_pay = repo
            .count_orders(user_id, "order_status", ORDER_STATUS_PENDING)
            .await?;
        let await_shipping = repo
            .count_orders(user_id, "order_status", ORDER_STATUS_CONFIRMED)
            .await?;
        let await_received = repo
            .count_orders(user_id, "order_status", ORDER_STATUS_PROCESSING)
            .await?;
        // Java `orderNum()` 传的 type 是 `order_comment_status`（不是 `comment_status`）：
        // 待评价必须同时满足 comment_status = 0 且 order_status = 5（已完成），
        // 否则未付款 / 待发货 / 已取消订单会被误计入左侧「评价晒单」角标。
        let await_comment = repo
            .count_orders(user_id, "order_comment_status", COMMENT_STATUS_PENDING)
            .await?;
        let order_completed = repo
            .count_orders(user_id, "order_status", ORDER_STATUS_COMPLETED)
            .await?;
        let await_aftersales_collect = repo.count_aftersales_in_progress(user_id).await?;
        let product_collect = repo.count_collect_products(user_id).await?;
        let shop_collect = repo.count_collect_shops(user_id).await?;
        Ok(OrderNumVO {
            await_pay,
            await_shipping,
            await_received,
            await_comment,
            order_completed,
            product_collect,
            shop_collect,
            await_aftersales_collect,
        })
    }

    /// 售后与取消订单共用原因配置（Java `AfterSalesReasonConfigService#getConfig`）。
    pub async fn reason_config(&self) -> Result<ReasonConfigVO> {
        let repo = self.repo();
        let enabled_raw = repo.find_config_value(CONFIG_REASON_ENABLED).await?;
        let list_raw = repo.find_config_value(CONFIG_REASON_LIST).await?;
        Ok(ReasonConfigVO {
            after_sales_reason_enabled: parse_reason_enabled(enabled_raw.as_deref()),
            after_sales_reason_list: parse_reason_list(list_raw.as_deref()),
        })
    }

    /// 删除订单（Java `OrderServiceImpl#delOrder(id, userId)`）。
    pub async fn del_order(&self, user_id: i32, dto: &OrderIdDTO) -> Result<()> {
        let order = self.require_owned_order(user_id, dto).await?;
        if !can_delete_order(order.order_status, order.is_del) {
            return Err(Error::biz_msg(MSG_ORDER_STATUS_ERROR));
        }
        let repo = self.repo();
        repo.mark_order_deleted(order.order_id).await?;
        repo.insert_order_log(
            order.order_id,
            &order.order_sn,
            user_id,
            order.shop_id,
            "订单删除",
            now_i32(),
        )
        .await?;
        Ok(())
    }

    /// 确认收货（Java `OrderServiceImpl#confirmReceipt(orderId, userId)`）。
    ///
    /// 控制器先按 `order_id + user_id` 计数，非本人订单静默返回。
    pub async fn confirm_receipt(&self, user_id: i32, dto: &OrderIdDTO) -> Result<()> {
        let Some(order_id) = dto.id else {
            return Ok(());
        };
        let repo = self.repo();
        let Some(order) = repo.find_order_brief(order_id, user_id).await? else {
            // Java：count <= 0 → return（静默）
            return Ok(());
        };
        if !can_confirm_receipt(order.order_status, order.is_del) {
            return Err(Error::biz_msg(MSG_ORDER_STATUS_ERROR));
        }
        repo.complete_order(order.order_id, now_i32()).await?;
        let description = if order.order_type == Some(ORDER_TYPE_RESERVATION_HOME) {
            "完成上门服务"
        } else {
            "确认收货"
        };
        repo.insert_order_log(
            order.order_id,
            &order.order_sn,
            user_id,
            order.shop_id,
            description,
            now_i32(),
        )
        .await?;

        // 完成收尾：店铺完成消息 + 统一收尾（积分/成长值/次卡/出账单/结算级联）
        if let Ok(Some(full_order)) = self.repos.trade.order.find_by_id(order.order_id).await {
            // 店铺侧完成消息（对齐 Java AdminMsgTypeEnum.ORDER_COMPLETED = 13；
            // 平台 shopId=0 副本与供应商副本由结算级联 / 管理端路径补发）
            let msg_title = format!("订单已完成通知：{},金额：{}", full_order.order_sn, full_order.total_amount);
            let msg_content = format!("您有订单【{}】已完成，请注意查看。", full_order.order_sn);
            let related_data = serde_json::json!({ "orderId": full_order.order_id }).to_string();
            let _ = self.repos.system.admin_msg.create_message(
                13, // ORDER_COMPLETED
                full_order.shop_id,
                full_order.order_id,
                &msg_title,
                &msg_content,
                &related_data,
            ).await;

            crate::trade::settlement::SettlementService::new(self.repos.clone())
                .after_order_completed(&full_order)
                .await;
        }

        tracing::info!(
            "订单确认收货成功: id={}, user_id={user_id}",
            order.order_id
        );
        Ok(())
    }

    /// 物流信息（Java `OrderServiceImpl#getShippingInfo`）。
    ///
    /// 无订单/无单号/物流公司缺失 → `Ok(None)`（Java 返回 null）；
    /// 物流平台未迁移 → 明确业务错误。
    pub async fn shipping_info(
        &self,
        user_id: i32,
        id: Option<i32>,
    ) -> Result<Option<ShippingResult>> {
        let Some(id) = id.filter(|id| *id > 0) else {
            return Ok(None);
        };
        let repo = self.repo();
        let Some(order) = repo.find_order_brief(id, user_id).await? else {
            return Ok(None);
        };
        if order.tracking_no.trim().is_empty() {
            return Ok(None);
        }
        if !repo.logistics_company_exists(order.logistics_id).await? {
            return Ok(None);
        }

        // 快递鸟激活时实时查询 1002；与 Java 一致，失败/未配置返回 null。
        let provider = crate::logistics::logistics_company::LogisticsCompanyService::new(
            self.repos.clone(),
        )
        .resolve_active_provider_type()
        .await?;
        if provider == tigshop_core::models::logistics::logistics_company::PROVIDER_KDNIAO {
            if let Some((company_code, _)) = self
                .repos
                .trade
                .order_admin
                .find_company_code_name(order.logistics_id)
                .await?
            {
                if let Ok(client) =
                    crate::logistics::kdniao::KdniaoClient::from_repos(&self.repos).await
                {
                    let full = self.repos.trade.order_admin.find_order(id).await?;
                    let mobile = full.as_ref().map(|o| o.mobile.as_str()).unwrap_or("");
                    let customer_name = kdn_customer_name(&company_code, mobile);
                    match client
                        .query_track(&company_code, &order.tracking_no, customer_name.as_deref())
                        .await
                    {
                        Ok(r) if r.success => {
                            return Ok(Some(ShippingResult {
                                e_business_id: None,
                                shipper_code: r.shipper_code.or(Some(company_code)),
                                logistic_code: r.logistic_code.or(Some(order.tracking_no.clone())),
                                state: r.state,
                                state_ex: r.state_ex,
                                location: r.location,
                                traces: r
                                    .traces
                                    .into_iter()
                                    .map(|t| ShippingTraceVO {
                                        action: None,
                                        accept_time: t.accept_time,
                                        accept_station: t.accept_station,
                                        location: t.location,
                                    })
                                    .collect(),
                                success: Some("true".to_string()),
                            }));
                        }
                        Ok(r) => {
                            tracing::warn!(
                                order_id = id,
                                reason = r.reason.as_deref().unwrap_or(""),
                                "快递鸟轨迹查询失败"
                            );
                            return Ok(None);
                        }
                        Err(e) => {
                            tracing::warn!(order_id = id, "快递鸟轨迹查询异常: {e}");
                            return Ok(None);
                        }
                    }
                }
            }
        } else if provider == tigshop_core::models::logistics::logistics_company::PROVIDER_KUAIDI100
        {
            // 快递100 实时查询（Java Kuaidi100LogisticsProvider#queryTrack）
            if let Some(company) = self
                .repos
                .logistics
                .logistics_company
                .find_by_id(order.logistics_id)
                .await?
            {
                let com = tigshop_core::models::logistics::logistics_company::resolve_kuaidi100_code(
                    Some(&company.logistics_code),
                )
.or_else(|| {
                    let s = company.kuaidi100_code.trim();
                    (!s.is_empty()).then(|| s.to_string())
                });
                let Some(com) = com else {
                    tracing::warn!(order_id = id, "物流公司未配置快递100编码，跳过轨迹查询");
                    return Ok(None);
                };
                let Ok(client) =
                    crate::logistics::kuaidi100::Kuaidi100Client::from_repos(&self.repos).await
                else {
                    return Ok(None);
                };
                if !client.is_configured() {
                    tracing::warn!("快递100凭证未配置，跳过轨迹查询");
                    return Ok(None);
                }
                match client.query_track(&com, &order.tracking_no, None).await {
                    Ok(r) if r.success => {
                        return Ok(Some(ShippingResult {
                            e_business_id: None,
                            shipper_code: r.shipper_code.or(Some(com)),
                            logistic_code: r
                                .logistic_code
                                .or(Some(order.tracking_no.clone())),
                            state: r.state,
                            state_ex: r.state_ex,
                            location: r.location,
                            traces: r
                                .traces
                                .into_iter()
                                .map(|t| ShippingTraceVO {
                                    action: None,
                                    accept_time: t.accept_time,
                                    accept_station: t.accept_station,
                                    location: t.location,
                                })
                                .collect(),
                            success: Some("true".to_string()),
                        }));
                    }
                    Ok(r) => {
                        tracing::warn!(
                            order_id = id,
                            reason = r.reason.as_deref().unwrap_or(""),
                            "快递100轨迹查询未成功"
                        );
                        return Ok(None);
                    }
                    Err(e) => {
                        tracing::warn!(order_id = id, "快递100轨迹查询异常: {e}");
                        return Ok(None);
                    }
                }
            }
        }

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        Ok(Some(ShippingResult {
            e_business_id: None,
            shipper_code: None,
            logistic_code: Some(order.tracking_no.clone()),
            state: Some("2".to_string()),
            state_ex: None,
            location: None,
            traces: vec![ShippingTraceVO {
                action: Some("揽件".to_string()),
                accept_time: Some(now),
                accept_station: Some(format!("包裹已由物流公司承运，运单号：{}", order.tracking_no)),
                location: None,
            }],
            success: Some("true".to_string()),
        }))
    }

    /// 再次购买（Java `CartServiceImpl#buyAgain(id, userId)` 的加购部分）。
    pub async fn buy_again(&self, user_id: i32, dto: &OrderIdDTO) -> Result<()> {
        let order = self.require_owned_order(user_id, dto).await?;
        let repo = self.repo();
        let items = repo.list_order_items(order.order_id).await?;
        // Java `buyAgain` 走 `addProductToCart`：以**当前售价**加购并做可购校验
        // （库存/上架），而非沿用订单快照价。下架商品静默跳过（Java 同款）。
        let product = crate::catalog::product::ProductService::new(self.repos.clone(), None);
        let cart = crate::trade::cart::CartService::new(self.repos.clone(), product);
        let mut added = 0_u32;
        for item in &items {
            if !repo.product_available(item.product_id).await? {
                continue;
            }
            let sku_id = (item.sku_id > 0).then_some(item.sku_id);
            let quantity = item.quantity.max(1);
            match cart
                .add(user_id, item.product_id, sku_id, quantity, None, false)
                .await
            {
                Ok(_) => added += 1,
                Err(e) => {
                    tracing::warn!(
                        "再次购买加购失败(跳过): order_id={}, product={}, err={e}",
                        order.order_id,
                        item.product_id
                    );
                }
            }
        }
        tracing::info!(
            "再次购买加购成功: order_id={}, user_id={user_id}, items={added}",
            order.order_id
        );
        Ok(())
    }

    /// 取本人订单，缺失/非本人 → 「订单不存在」。
    async fn require_owned_order(&self, user_id: i32, dto: &OrderIdDTO) -> Result<OrderBrief> {
        let id = dto
            .id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation(MSG_ORDER_NOT_EXIST.into()))?;
        self.repo()
            .find_order_brief(id, user_id)
            .await?
            .ok_or_else(|| Error::biz_msg(MSG_ORDER_NOT_EXIST))
    }
}

fn now_i32() -> i32 {
    i32::try_from(now_seconds()).unwrap_or(i32::MAX)
}

/// 快递鸟 SF/KYSY/ZTO 查询所需的手机号后四位。
fn kdn_customer_name(company_code: &str, mobile: &str) -> Option<String> {
    let code = company_code.to_ascii_uppercase();
    if !matches!(code.as_str(), "SF" | "KYSY" | "ZTO") || mobile.len() < 4 {
        return None;
    }
    Some(mobile[mobile.len() - 4..].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reason_config_defaults_via_model() {
        let parsed = parse_reason_list(None);
        assert_eq!(parsed.len(), 5);
        assert_eq!(parse_reason_enabled(Some("0")), 0);
    }

}
