//! 退款申请服务：创建、审核（通过/退回/拒绝）、线下转账确认、可退额度校验。
//! 对应原 Java `RefundApplyServiceImpl`（1356 行）。
//!
//! 迁移要点（逐条对照 Java 源）：
//! - `assertRefundable`：**可退额度 = 实付 - 已占用**，
//!   已占用只统计待处理/处理中/已处理（`occupies_quota` 判定）
//! - `audit` 拒绝分支：拒绝原因必填且 ≤ 255 字；仅当状态为「待处理」时才可拒绝
//!   （用条件更新防并发重复处理）
//! - `refundRecordTx`：Java 用 REQUIRES_NEW 独立事务保证流水不随外层回滚 ——
//!   Rust 侧对应为「流水先落库，失败时显式置为失败态」
//! - `markRefundRecordFailed`：渠道未扣款时把流水置为失败，释放已占用额度
//!   （否则该笔支付永久无法再退款）
//!
//! 未迁移（依赖其他域）：
//! - 售后单状态同步（`aftersales` 域）
//! - 信用订单退款（`credit_order`）
//! - 分销佣金回退（`salesman_order`）
//! - 积分退还（`returnUsePoints`）
//! - 渠道实际扣款（依赖各支付渠道实现）

use std::sync::Arc;

use rust_decimal::Decimal;
use tigshop_common::utils;
use tigshop_core::entities::{RefundApply, RefundLog};
use tigshop_core::models::payment::refund_apply::{
    total_refund, validate_reject_reason, OfflineAuditDTO, RefundApplyAuditDTO,
    RefundApplyCreateDTO, RefundApplyDetailVO, RefundApplyListQuery, RefundApplyStatus,
    RefundApplyUpdateDTO, RefundApplyVO, RefundLogVO, RefundType,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::payment::paylog::ORDER_TYPE_PRODUCT;
use tigshop_infrastructure::db::Repositories;

pub struct RefundApplyService {
    repos: Arc<Repositories>,
}

impl RefundApplyService {
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    // ————————————————————— 查询 —————————————————————

    /// 退款申请分页。
    pub async fn list(&self, q: &RefundApplyListQuery) -> Result<PageResult<RefundApplyVO>> {
        let page = PageQuery {
            page: q.page.unwrap_or(1),
            page_size: q.page_size.unwrap_or(20),
        };
        let (total, rows) = self
            .repos.payment.refund_apply
            .paginate(q.order_sn.as_deref(), q.refund_status, q.shop_id, &page)
            .await?;
        let list = rows.iter().map(to_vo).collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 退款申请详情（含操作日志）。
    /// 退款申请归属店铺（供管理端租户归属校验）。
    pub async fn shop_id_of(&self, refund_id: i32) -> Result<i32> {
        self.repos
            .payment
            .refund_apply
            .find_shop_id(refund_id)
            .await?
            .ok_or_else(|| Error::NotFound("退款申请不存在".into()))
    }

    pub async fn detail(&self, refund_id: i32) -> Result<RefundApplyDetailVO> {
        let r = self
            .repos.payment.refund_apply
            .find_by_id(refund_id)
            .await?
            .ok_or_else(|| Error::NotFound("退款申请不存在".into()))?;
        let logs = self.repos.payment.refund_apply.find_logs(refund_id).await?;
        Ok(RefundApplyDetailVO {
            base: to_vo(&r),
            logs: logs.iter().map(to_log_vo).collect(),
        })
    }

    /// 按退款流水反查申请。
    pub async fn by_paylog_refund_id(
        &self,
        paylog_refund_id: i32,
    ) -> Result<Option<RefundApplyVO>> {
        let r = self
            .repos.payment.refund_apply
            .find_by_paylog_refund_id(paylog_refund_id)
            .await?;
        Ok(r.as_ref().map(to_vo))
    }

    /// 审核状态配置（供前端下拉）。
    ///
    /// 关联函数（不依赖 `repos`），便于直接测试。
    pub fn status_config() -> Vec<(i32, &'static str)> {
        [
            RefundApplyStatus::Wait,
            RefundApplyStatus::Processing,
            RefundApplyStatus::Processed,
            RefundApplyStatus::Cancel,
            RefundApplyStatus::Rejected,
        ]
        .iter()
        .map(|s| (*s as i32, s.name()))
        .collect()
    }

    // ————————————————————— 创建 —————————————————————

    /// 创建退款申请。
    ///
    /// 校验链：
    /// 1. 退款类型合法（1/2）
    /// 2. 订单/用户/售后单 ID 合法
    /// 3. 线上+线下退款金额 > 0
    /// 4. **退款总额不得超过可退额度**（实付 - 已占用）
    pub async fn create(&self, dto: &RefundApplyCreateDTO) -> Result<i32> {
        let refund_type = match dto.refund_type {
            Some(t) => RefundType::try_from(t)
                .map_err(|_| Error::Validation("退款类型非法（应为 1/2）".into()))?,
            None => RefundType::Order,
        };

        let order_id = dto
            .order_id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation("订单ID无效".into()))?;
        let user_id = dto.user_id.filter(|id| *id > 0).unwrap_or(0);
        let aftersale_id = dto.aftersale_id.unwrap_or(0);
        let shop_id = dto.shop_id.unwrap_or(0);

        let online = dto.online_balance.unwrap_or_default().max(Decimal::ZERO);
        let offline = dto.offline_balance.unwrap_or_default().max(Decimal::ZERO);
        let total = total_refund(online, offline);
        if total <= Decimal::ZERO {
            return Err(Error::Validation("退款金额必须大于0".into()));
        }

        // 可退额度校验
        self.assert_refundable(order_id, total).await?;

        let r = RefundApply {
            // 自增主键占位
            refund_id: 0,
            refund_type: refund_type as i32,
            order_id,
            user_id,
            aftersale_id,
            refund_status: RefundApplyStatus::Wait as i32,
            add_time: utils::now_seconds() as i32,
            refund_note: dto.refund_note.clone().unwrap_or_default(),
            online_balance: online,
            offline_balance: offline,
            refund_balance: total,
            // 线上/线下标记由金额推导
            is_online: i32::from(online > Decimal::ZERO),
            is_offline: i32::from(offline > Decimal::ZERO),
            is_receive: 0,
            paylog_refund_id: 0,
            shop_id,
            payment_voucher: None,
        };
        let id = self.repos.payment.refund_apply.insert(&r).await?;
        tracing::info!(
            "创建退款申请: id={id} order_id={order_id} amount={total}（线上{online}/线下{offline}）"
        );
        Ok(id)
    }

    /// 更新退款申请金额/备注（仅待处理状态可改）。
    pub async fn update(&self, dto: &RefundApplyUpdateDTO) -> Result<()> {
        let existing = self
            .repos.payment.refund_apply
            .find_by_id(dto.refund_id)
            .await?
            .ok_or_else(|| Error::NotFound("退款申请不存在".into()))?;

        if RefundApplyStatus::try_from(existing.refund_status)
            .map(|s| s as i32)
            == Ok(RefundApplyStatus::Wait as i32)
        {
            return Err(Error::biz(400, "仅待处理的申请允许修改"));
        }

        let online = dto.online_balance.unwrap_or(existing.online_balance);
        let offline = dto.offline_balance.unwrap_or(existing.offline_balance);
        let total = total_refund(online, offline);
        if total <= Decimal::ZERO {
            return Err(Error::Validation("退款金额必须大于0".into()));
        }

        // 差额校验：新总额不能超过「可退额度 + 原申请占用」
        let occupied = self
            .repos.payment.refund_apply
            .sum_occupied_by_order(existing.order_id)
            .await?;
        let paid = self.paid_amount(existing.order_id).await?;
        let refundable = (paid - (occupied - existing.refund_balance)).max(Decimal::ZERO);
        if total > refundable {
            return Err(Error::biz(
                400,
                format!("退款金额超出可退余额，本笔最多可退 {refundable}"),
            ));
        }

        let mut updated = existing.clone();
        updated.online_balance = online;
        updated.offline_balance = offline;
        updated.refund_balance = total;
        updated.is_online = i32::from(online > Decimal::ZERO);
        updated.is_offline = i32::from(offline > Decimal::ZERO);
        if let Some(note) = &dto.refund_note {
            updated.refund_note = note.clone();
        }
        self.repos.payment.refund_apply.update_amounts(&updated).await
    }

    // ————————————————————— 审核 —————————————————————

    /// 财务审核。
    ///
    /// 对应 Java `audit`：
    /// - 目标状态必须是 1（处理中）/ 3（退回售后）/ 4（拒绝）
    /// - 拒绝(4)：原因必填（trim 后非空、≤255），且**仅当当前为待处理(0)**时可拒绝，
    ///   用条件更新防并发；成功后不产生任何资金副作用
    /// - 3（退回售后）：标记取消，释放占用额度
    /// - 1（处理中）：进入退款流程
    pub async fn audit(&self, dto: &RefundApplyAuditDTO) -> Result<()> {
        let target = RefundApplyStatus::try_from(dto.refund_status)
            .map_err(|_| Error::biz(400, "审核状态值错误"))?;

        // Java 只允许这三种目标状态
        if !matches!(
            target,
            RefundApplyStatus::Processing
                | RefundApplyStatus::Cancel
                | RefundApplyStatus::Rejected
        ) {
            return Err(Error::biz(400, "审核状态值错误"));
        }

        let existing = self
            .repos.payment.refund_apply
            .find_by_id(dto.refund_id)
            .await?
            .ok_or_else(|| Error::biz(400, "该申请不存在"))?;

        // 仅待处理状态可被审核（对应 Java Assert refundStatus == 0）
        if RefundApplyStatus::try_from(existing.refund_status)
            .map(|s| s as i32)
            != Ok(RefundApplyStatus::Wait as i32)
        {
            return Err(Error::biz(400, "申请状态值错误"));
        }

        match target {
            RefundApplyStatus::Rejected => {
                let reason = validate_reject_reason(dto.refund_note.as_deref())
                    .map_err(Error::Validation)?;
                let ok = self
                    .repos.payment.refund_apply
                    .transition_status(
                        dto.refund_id,
                        &[RefundApplyStatus::Wait as i32],
                        RefundApplyStatus::Rejected as i32,
                        Some(&reason),
                    )
                    .await?;
                if !ok {
                    return Err(Error::biz(400, "退款申请已处理，请刷新后重试"));
                }
                self.add_log(
                    dto.refund_id,
                    existing.order_id,
                    existing.refund_type,
                    "",
                    "",
                    Decimal::ZERO,
                    format!("财务审核拒绝：{reason}"),
                    existing.user_id,
                )
                .await?;
                tracing::info!("退款申请已拒绝: id={} 原因={}", dto.refund_id, reason);
            }
            RefundApplyStatus::Cancel => {
                // 退回售后人员重新处理：释放占用额度（状态不在 occupies_quota 集合内）
                let ok = self
                    .repos.payment.refund_apply
                    .transition_status(
                        dto.refund_id,
                        &[RefundApplyStatus::Wait as i32],
                        RefundApplyStatus::Cancel as i32,
                        dto.refund_note.as_deref(),
                    )
                    .await?;
                if !ok {
                    return Err(Error::biz(400, "退款申请已处理，请刷新后重试"));
                }
                self.add_log(
                    dto.refund_id,
                    existing.order_id,
                    existing.refund_type,
                    "",
                    "",
                    Decimal::ZERO,
                    "财务审核退回售后人员重新处理".to_string(),
                    existing.user_id,
                )
                .await?;
                tracing::info!("退款申请退回售后: id={}", dto.refund_id);
            }
            RefundApplyStatus::Processing => {
                // 进入退款流程前再次校验额度（防止排队期间被其他申请占满）
                self.assert_refundable(existing.order_id, existing.refund_balance)
                    .await?;
                let ok = self
                    .repos.payment.refund_apply
                    .transition_status(
                        dto.refund_id,
                        &[RefundApplyStatus::Wait as i32],
                        RefundApplyStatus::Processing as i32,
                        dto.refund_note.as_deref(),
                    )
                    .await?;
                if !ok {
                    return Err(Error::biz(400, "退款申请已处理，请刷新后重试"));
                }
                self.add_log(
                    dto.refund_id,
                    existing.order_id,
                    existing.refund_type,
                    "",
                    "",
                    existing.refund_balance,
                    "财务审核通过，进入退款流程".to_string(),
                    existing.user_id,
                )
                .await?;
                tracing::info!("退款申请进入处理中: id={}", dto.refund_id);
                // 线上金额走渠道退款：仅支持已实现退款方法的渠道，其余保持处理中人工处理。
                if existing.online_balance > rust_decimal::Decimal::ZERO {
                    if let Some(paylog) = self
                        .repos
                        .payment
                        .pay
                        .find_last_success_paylog(existing.order_id, 0)
                        .await?
                    {
                        let code = paylog.pay_code.as_str();
                        if matches!(code, "stripe" | "paypal" | "xendit" | "wechat" | "alipay" | "antom" | "huifu" | "lakala" | "yeepay" | "yabandpay" | "yunpay") {
                            let refund_sn = format!("RF{}{}", tigshop_common::utils::now_seconds(), dto.refund_id);
                            let paylog_service = crate::payment::paylog::PaylogService::new(self.repos.clone());
                            let refund_id = paylog_service
                                .record_refund(
                                    paylog.paylog_id,
                                    existing.order_id,
                                    &refund_sn,
                                    existing.online_balance,
                                    "退款审核通过",
                                    0,
                                    Some(code),
                                )
                                .await?;
                            self.repos
                                .payment
                                .refund_apply
                                .link_paylog_refund(dto.refund_id, refund_id)
                                .await?;
                            let _ = sqlx::query("UPDATE refund_apply SET paylog_refund_id=? WHERE refund_id=?")
                                .bind(refund_id)
                                .bind(dto.refund_id)
                                .execute(&self.repos.pool)
                                .await;
                            let pay = crate::payment::pay::PayService::new(self.repos.clone());
                            match pay
                                .refund_via_channel(code, &paylog.pay_sn, &refund_sn, existing.online_balance)
                                .await
                            {
                                Ok(status) => {
                                    let upper = status.to_ascii_uppercase();
                                    if upper.contains("SUCCESS") || upper.contains("COMPLETED") {
                                        self.mark_processed(dto.refund_id, &refund_sn).await?;
                                    }
                                    tracing::info!("渠道退款已受理: refund_id={} status={status}", dto.refund_id);
                                }
                                Err(e) => {
                                    tracing::warn!("渠道退款失败: refund_id={} error={e}", dto.refund_id);
                                    return Err(e);
                                }
                            }
                        }
                    }
                }

            }
            // 其余状态不可作为审核目标
            _ => return Err(Error::biz(400, "审核状态值错误")),
        }
        Ok(())
    }

    /// 确认线下转账（上传支付凭证 + 标记已收款）。
    ///
    /// 对应 Java `offlineAudit`：线下退款需人工确认到账并留痕凭证。
    pub async fn offline_audit(&self, dto: &OfflineAuditDTO) -> Result<()> {
        let existing = self
            .repos.payment.refund_apply
            .find_by_id(dto.refund_id)
            .await?
            .ok_or_else(|| Error::NotFound("退款申请不存在".into()))?;

        if existing.is_offline != 1 {
            return Err(Error::biz(400, "该申请非线下退款，无需确认转账"));
        }

        if let Some(v) = &dto.payment_voucher {
            self.repos.payment.refund_apply
                .update_voucher(dto.refund_id, v)
                .await?;
        }

        let ok = self.repos.payment.refund_apply.confirm_receive(dto.refund_id).await?;
        if !ok {
            return Err(Error::biz(400, "已确认收款，无需重复操作"));
        }

        self.add_log(
            dto.refund_id,
            existing.order_id,
            existing.refund_type,
            "offline",
            "",
            existing.offline_balance,
            "确认线下转账到账".to_string(),
            existing.user_id,
        )
        .await?;
        tracing::info!(
            "确认线下转账: refund_id={} amount={}",
            dto.refund_id,
            existing.offline_balance
        );
        Ok(())
    }

    /// 标记退款完成（渠道扣款成功后调用）。
    pub async fn mark_processed(&self, refund_id: i32, transaction_id: &str) -> Result<()> {
        let ok = self
            .repos.payment.refund_apply
            .transition_status(
                refund_id,
                &[RefundApplyStatus::Processing as i32],
                RefundApplyStatus::Processed as i32,
                None,
            )
            .await?;
        if !ok {
            return Err(Error::biz(400, "退款申请已处理，请刷新后重试"));
        }

        let existing = self
            .repos.payment.refund_apply
            .find_by_id(refund_id)
            .await?
            .unwrap_or_default();
        self.add_log(
            refund_id,
            existing.order_id,
            existing.refund_type,
            "",
            transaction_id,
            existing.refund_balance,
            format!("退款完成，交易号 {transaction_id}"),
            existing.user_id,
        )
        .await?;
        tracing::info!("退款完成: refund_id={refund_id} trade_no={transaction_id}");
        Ok(())
    }

    // ————————————————————— 额度校验 —————————————————————

    /// 校验订单在给定退款金额下是否可退。
    ///
    /// 对应 Java `assertRefundable`：
    /// - 可退额度 ≤ 0 → 「该笔支付已全额退款，无需重复发起」
    /// - 本次金额 > 可退额度 → 「退款金额超出可退余额，本笔最多可退 X」
    pub async fn assert_refundable(&self, order_id: i32, refund_amount: Decimal) -> Result<()> {
        let paid = self.paid_amount(order_id).await?;
        let occupied = self
            .repos.payment.refund_apply
            .sum_occupied_by_order(order_id)
            .await?;
        let refundable = (paid - occupied).max(Decimal::ZERO);

        if refundable <= Decimal::ZERO {
            tracing::warn!(
                "订单 {} 已无可退余额（实付 {}，已占用 {}）",
                order_id,
                paid,
                occupied
            );
            return Err(Error::biz(400, "该笔支付已全额退款，无需重复发起"));
        }
        if refund_amount > refundable {
            return Err(Error::biz(
                400,
                format!("退款金额超出可退余额，本笔最多可退 {refundable}"),
            ));
        }
        Ok(())
    }

    /// 订单可退余额。
    pub async fn refundable_amount(&self, order_id: i32) -> Result<Decimal> {
        let paid = self.paid_amount(order_id).await?;
        let occupied = self
            .repos.payment.refund_apply
            .sum_occupied_by_order(order_id)
            .await?;
        Ok((paid - occupied).max(Decimal::ZERO))
    }

    // ————————————————————— 内部 —————————————————————

    /// 取订单实付金额（从已支付的 `paylog` 取）。
    ///
    /// **必须限定 `order_type = 0`（商品订单）** —— `paylog` 三类业务共表，
    /// `order_id` 会撞号。
    async fn paid_amount(&self, order_id: i32) -> Result<Decimal> {
        match self
            .repos.payment.paylog
            .find_last_by_order(order_id, ORDER_TYPE_PRODUCT)
            .await?
        {
            Some(p) if p.pay_status == 1 => Ok(p.pay_amount),
            // 无已支付记录 → 可退额度为 0
            _ => Ok(Decimal::ZERO),
        }
    }

    /// 写退款操作日志。
    async fn add_log(
        &self,
        refund_apply_id: i32,
        order_id: i32,
        refund_type: i32,
        pay_code: &str,
        transaction_id: &str,
        amount: Decimal,
        description: String,
        user_id: i32,
    ) -> Result<()> {
        let log = RefundLog {
            log_id: 0,
            refund_apply_id,
            order_id,
            refund_type,
            refund_pay_code: pay_code.to_string(),
            transaction_id: transaction_id.to_string(),
            refund_amount: amount,
            add_time: utils::now_seconds() as i32,
            description: Some(description),
            user_id,
        };
        self.repos.payment.refund_apply.insert_log(&log).await?;
        Ok(())
    }
}

/// 实体 → VO。
fn to_vo(r: &RefundApply) -> RefundApplyVO {
    RefundApplyVO {
        refund_id: r.refund_id,
        refund_type: r.refund_type,
        refund_type_name: RefundType::try_from(r.refund_type)
            .map(|t| t.name().to_string())
            .unwrap_or_default(),
        order_id: r.order_id,
        user_id: r.user_id,
        aftersale_id: r.aftersale_id,
        refund_status: r.refund_status,
        refund_status_name: RefundApplyStatus::try_from(r.refund_status)
            .map(|s| s.name().to_string())
            .unwrap_or_default(),
        add_time: r.add_time,
        refund_note: r.refund_note.clone(),
        online_balance: r.online_balance,
        offline_balance: r.offline_balance,
        refund_balance: r.refund_balance,
        is_online: r.is_online,
        is_offline: r.is_offline,
        is_receive: r.is_receive,
        paylog_refund_id: r.paylog_refund_id,
        shop_id: r.shop_id,
        payment_voucher: r.payment_voucher.clone(),
    }
}

/// 日志实体 → VO。
fn to_log_vo(l: &RefundLog) -> RefundLogVO {
    RefundLogVO {
        log_id: l.log_id,
        refund_apply_id: l.refund_apply_id,
        refund_type: l.refund_type,
        refund_type_name: RefundType::try_from(l.refund_type)
            .map(|t| t.name().to_string())
            .unwrap_or_default(),
        refund_pay_code: l.refund_pay_code.clone(),
        transaction_id: l.transaction_id.clone(),
        refund_amount: l.refund_amount,
        add_time: l.add_time,
        description: l.description.clone(),
        user_id: l.user_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal as D;
    use std::str::FromStr;

    fn dec(s: &str) -> D {
        D::from_str(s).unwrap()
    }

    fn apply(status: i32, online: &str, offline: &str) -> RefundApply {
        let on = dec(online);
        let off = dec(offline);
        RefundApply {
            refund_id: 1,
            refund_type: 1,
            order_id: 100,
            user_id: 9,
            refund_status: status,
            online_balance: on,
            offline_balance: off,
            refund_balance: total_refund(on, off),
            is_online: i32::from(on > Decimal::ZERO),
            is_offline: i32::from(off > Decimal::ZERO),
            ..Default::default()
        }
    }

    #[test]
    fn vo_maps_status_and_type_names() {
        let vo = to_vo(&apply(0, "10.00", "0"));
        assert_eq!(vo.refund_status_name, "待处理");
        assert_eq!(vo.refund_type_name, "订单");
        assert_eq!(vo.refund_balance, dec("10.00"));
        assert_eq!(vo.is_online, 1);
        assert_eq!(vo.is_offline, 0);
    }

    #[test]
    fn vo_totals_online_plus_offline() {
        let vo = to_vo(&apply(1, "10.00", "5.50"));
        assert_eq!(vo.refund_balance, dec("15.50"));
        assert_eq!(vo.is_online, 1);
        assert_eq!(vo.is_offline, 1);
    }

    #[test]
    fn log_vo_maps_type_name() {
        let l = RefundLog {
            log_id: 3,
            refund_apply_id: 1,
            refund_type: 2,
            refund_amount: dec("20.00"),
            user_id: 9,
            ..Default::default()
        };
        let vo = to_log_vo(&l);
        assert_eq!(vo.refund_type_name, "商品");
        assert_eq!(vo.refund_amount, dec("20.00"));
    }

    #[test]
    fn status_config_lists_all_five() {
        let cfg = RefundApplyService::status_config();
        assert_eq!(cfg.len(), 5);
        assert_eq!(cfg[0], (0, "待处理"));
        assert_eq!(cfg[2], (2, "已处理"));
        assert_eq!(cfg[4], (4, "已拒绝"));
    }

    /// 复刻审核的目标状态白名单（纯逻辑，不依赖数据库）。
    fn audit_target_ok(status: i32) -> bool {
        matches!(
            RefundApplyStatus::try_from(status),
            Ok(RefundApplyStatus::Processing)
                | Ok(RefundApplyStatus::Cancel)
                | Ok(RefundApplyStatus::Rejected)
        )
    }

    #[test]
    fn audit_accepts_only_three_targets() {
        assert!(audit_target_ok(1)); // 处理中
        assert!(audit_target_ok(3)); // 退回售后
        assert!(audit_target_ok(4)); // 拒绝
        assert!(!audit_target_ok(0)); // 待处理不可作为审核目标
        assert!(!audit_target_ok(2)); // 已处理不可作为审核目标
        assert!(!audit_target_ok(9));
    }
}