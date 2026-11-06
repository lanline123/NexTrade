//! 微信直播订单同步域服务（content::wechat_live_order_sync）。
//!
//! 日志/重试/对账均依赖微信「视频号小店」订单接口与同步任务，未迁移 →
//! 保留端点与本地校验，返回明确「未迁移」业务错误。

use std::sync::Arc;

use tigshop_core::models::content::wechat_live_order_sync::{
    validate_log_id, ReconcileParam, SyncLogQuery, SyncLogVO, MSG_NOT_MIGRATED,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::content::wechat_live_order_sync::WechatLiveOrderSyncRepository;
use tigshop_infrastructure::db::Repositories;

/// 微信直播订单同步服务。
pub struct WechatLiveOrderSyncService {
    repos: Arc<Repositories>,
}

impl WechatLiveOrderSyncService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.content.wechat_live_order_sync`）。
    #[must_use]
    pub fn repo(&self) -> &WechatLiveOrderSyncRepository {
        &self.repos.content.wechat_live_order_sync
    }

    /// 同步日志（未迁移）。
    pub async fn logs(&self, _q: &SyncLogQuery) -> Result<PageResult<SyncLogVO>> {
        Err(Error::biz_msg(MSG_NOT_MIGRATED))
    }

    /// 重试同步（未迁移）。
    pub async fn retry(&self, log_id: i64) -> Result<()> {
        validate_log_id(log_id).map_err(Error::Validation)?;
        Err(Error::biz_msg(MSG_NOT_MIGRATED))
    }

    /// 对账（未迁移）。
    pub async fn reconcile(&self, _param: &ReconcileParam) -> Result<()> {
        Err(Error::biz_msg(MSG_NOT_MIGRATED))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_validates_log_id() {
        assert!(validate_log_id(0).is_err());
        assert!(MSG_NOT_MIGRATED.contains("尚未迁移"));
    }
}
