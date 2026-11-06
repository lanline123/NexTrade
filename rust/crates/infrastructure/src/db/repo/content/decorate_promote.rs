//! 装修推广短链域仓储（content::decorate_promote）。
//!
//! 表：`short_url(short_url_id, short_code, long_url, type, add_time)` / `config`。

use sqlx::MySqlPool;

use tigshop_core::{Error, Result};

/// 推广短链仓储。
#[derive(Clone)]
pub struct DecoratePromoteRepository {
    pool: MySqlPool,
}

impl DecoratePromoteRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 读取配置值（Java `configService.getConfigVal`）。
    pub async fn find_config_value(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND is_del = 0 LIMIT 1",
        )
        .bind(biz_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|(value,)| value))
    }

    /// 查已存在的短链（同长链接 + 类型复用）。
    pub async fn find_short_code(&self, long_url: &str, link_type: i32) -> Result<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT short_code FROM short_url WHERE long_url = ? AND type = ? LIMIT 1",
        )
        .bind(long_url)
        .bind(link_type)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(code,)| code))
    }

    /// 插入短链（Java 保存短链记录）。
    pub async fn insert_short_url(
        &self,
        code: &str,
        long_url: &str,
        link_type: i32,
        add_time: &str,
    ) -> Result<i32> {
        let res = sqlx::query(
            "INSERT INTO short_url (short_code, long_url, type, add_time) VALUES (?, ?, ?, ?)",
        )
        .bind(code)
        .bind(long_url)
        .bind(link_type)
        .bind(add_time)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
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
        assert!(std::any::type_name::<DecoratePromoteRepository>().contains("DecoratePromote"));
    }
}
