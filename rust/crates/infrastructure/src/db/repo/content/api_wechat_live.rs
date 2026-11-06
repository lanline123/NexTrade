//! 微信视频号直播记录域仓储（content::api_wechat_live）。
//!
//! 直播记录来自微信开放接口（未迁移），本地无对应表；仓储仅保留类型占位。

use sqlx::MySqlPool;

use tigshop_core::{Error, Result};

/// 微信视频号直播记录仓储（远程接口未迁移，无本地表）。
#[derive(Clone)]
pub struct ApiWechatLiveRepository {
    pool: MySqlPool,
}

impl ApiWechatLiveRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（与其它仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 连通性占位（执行恒真查询，不读取业务数据）。
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
        assert!(std::any::type_name::<ApiWechatLiveRepository>().contains("ApiWechatLive"));
    }
}
