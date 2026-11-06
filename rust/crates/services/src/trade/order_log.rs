//! 订单日志 域服务（trade::order_log）—— wave9。
//!
//! `self.repos.trade.order_log`；对应 Java `OrderLogServiceImpl`。

use std::sync::Arc;

use tigshop_common::utils;
use tigshop_core::models::trade::order_log::{
    format_time, OrderLogCreateDTO, OrderLogListQuery, OrderLogVO, OPERATOR_ADMIN, OPERATOR_SYSTEM,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::trade::order_log::OrderLogRepository;
use tigshop_infrastructure::db::Repositories;

/// 订单日志 域服务。
pub struct OrderLogService {
    repos: Arc<Repositories>,
}

impl OrderLogService {
    /// 构造服务。
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本 feature 仓储。
    #[must_use]
    pub fn repo(&self) -> &OrderLogRepository {
        &self.repos.trade.order_log
    }

    /// 分页（Java `OrderLogController.list`）。
    pub async fn list(
        &self,
        q: &OrderLogListQuery,
        shop_scope: Option<i32>,
    ) -> Result<PageResult<OrderLogVO>> {
        let page = q.page_query();
        let (total, rows) = self.repo().paginate(q, shop_scope).await?;
        if rows.is_empty() {
            return Ok(PageResult::empty(&page));
        }
        let list = rows
            .into_iter()
            .map(|r| OrderLogVO {
                log_id: r.log_id,
                order_id: r.order_id,
                order_sn: r.order_sn,
                operator: operator_name(r.admin_id, r.user_id),
                admin_id: r.admin_id,
                user_id: r.user_id,
                description: r.description,
                log_time: format_time(r.log_time),
                shop_id: r.shop_id,
            })
            .collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 创建日志（Java `OrderLogController.create`）。
    pub async fn create(&self, dto: &OrderLogCreateDTO) -> Result<()> {
        if dto.order_id <= 0 {
            return Err(Error::Validation("订单ID不能为空".into()));
        }
        let description = dto
            .description
            .clone()
            .or_else(|| dto.order_log_desc.clone())
            .unwrap_or_default();
        let log_time = dto
            .log_time
            .unwrap_or_else(|| i64::from(now_secs()));
        self.repo()
            .insert(
                dto.order_id,
                dto.order_sn.as_deref().unwrap_or_default(),
                dto.admin_id.unwrap_or(0),
                dto.user_id.unwrap_or(0),
                &description,
                log_time,
                dto.shop_id.unwrap_or(0),
            )
            .await
    }
}

/// 操作人展示名（Java `OrderLogVO.operator`）。
#[must_use]
pub fn operator_name(admin_id: i32, user_id: i32) -> String {
    if admin_id > 0 {
        OPERATOR_ADMIN.to_string()
    } else if user_id > 0 {
        OPERATOR_SYSTEM.to_string()
    } else {
        OPERATOR_SYSTEM.to_string()
    }
}

fn now_secs() -> i32 {
    i32::try_from(utils::now_millis() / 1000).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operator_admin_takes_precedence() {
        assert_eq!(operator_name(5, 8), "管理员");
        assert_eq!(operator_name(0, 8), "系统");
        assert_eq!(operator_name(0, 0), "系统");
    }

    #[test]
    fn now_secs_is_epoch() {
        assert!(now_secs() > 1_600_000_000);
    }

    #[test]
    fn create_rejects_empty_order_id() {
        let dto = OrderLogCreateDTO {
            order_id: 0,
            order_sn: None,
            admin_id: None,
            user_id: None,
            description: None,
            order_log_desc: None,
            log_time: None,
            shop_id: None,
        };
        assert!(dto.order_id <= 0);
    }
}
