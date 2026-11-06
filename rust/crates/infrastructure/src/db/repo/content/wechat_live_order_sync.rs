//! 微信直播订单同步域仓储（content::wechat_live_order_sync）。
//!
//! 同步日志表/微信订单接口未迁移；仓储仅保留连接占位。

use sqlx::MySqlPool;

use tigshop_core::{Error, Result};

/// 微信直播订单同步仓储（无本地同步日志表）。
#[derive(Clone)]
pub struct WechatLiveOrderSyncRepository {
    pool: MySqlPool,
}

impl WechatLiveOrderSyncRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 连通性占位（恒真查询）。
    pub async fn ping(&self) -> Result<()> {
        sqlx::query_as::<_, (i32,)>("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .map(|_| ())
            .map_err(map_err)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repository_type_exists() {
        assert!(std::any::type_name::<WechatLiveOrderSyncRepository>()
            .contains("WechatLiveOrderSync"));
    }
}
