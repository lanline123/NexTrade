//! 装修模板域仓储（content::decorate_template）。
//!
//! 模板资源包/渲染引擎未迁移，本地无对应表；仓储仅保留连接占位。

use sqlx::MySqlPool;

use tigshop_core::{Error, Result};

/// 装修模板仓储（无本地表）。
#[derive(Clone)]
pub struct DecorateTemplateRepository {
    pool: MySqlPool,
}

impl DecorateTemplateRepository {
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
        assert!(std::any::type_name::<DecorateTemplateRepository>().contains("DecorateTemplate"));
    }
}
