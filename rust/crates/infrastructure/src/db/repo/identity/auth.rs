//! `admin_user` 仓储，替代 `AdminUserMapper`。

use sqlx::MySqlPool;
use tigshop_core::entities::AdminUser;
use tigshop_core::{Error, Result};

#[derive(Clone)]
pub struct AdminUserRepository {
    pool: MySqlPool,
}

impl AdminUserRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 按登录名查询（含已删除/停用，由调用方判断）。
    pub async fn find_by_username(&self, username: &str) -> Result<Option<AdminUser>> {
        sqlx::query_as::<_, AdminUser>(
            "SELECT * FROM admin_user WHERE username = ? AND is_deleted = 0 LIMIT 1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按手机号查询（后台手机验证码登录）。
    pub async fn find_by_mobile(&self, mobile: &str) -> Result<Option<AdminUser>> {
        sqlx::query_as::<_, AdminUser>(
            "SELECT * FROM admin_user WHERE mobile = ? AND is_deleted = 0 LIMIT 1",
        )
        .bind(mobile)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 按 ID 查询。
    pub async fn find_by_id(&self, admin_id: i32) -> Result<Option<AdminUser>> {
        sqlx::query_as::<_, AdminUser>("SELECT * FROM admin_user WHERE admin_id = ? LIMIT 1")
            .bind(admin_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 后台用户分页（对应原 AdminUserPageQuery）。
    pub async fn paginate(
        &self,
        keyword: Option<&str>,
        admin_type: Option<&str>,
        page: u64,
        page_size: u64,
    ) -> Result<(u64, Vec<AdminUser>)> {
        let offset = page.saturating_sub(1) * page_size;
        let kw = keyword.map(|s| format!("%{s}%"));

        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM admin_user
             WHERE is_deleted = 0
               AND (? IS NULL OR username LIKE ?)
               AND (? IS NULL OR admin_type = ?)",
        )
        .bind(&kw)
        .bind(&kw)
        .bind(admin_type)
        .bind(admin_type)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;

        let rows = sqlx::query_as::<_, AdminUser>(
            "SELECT * FROM admin_user
             WHERE is_deleted = 0
               AND (? IS NULL OR username LIKE ?)
               AND (? IS NULL OR admin_type = ?)
             ORDER BY admin_id DESC
             LIMIT ? OFFSET ?",
        )
        .bind(&kw)
        .bind(&kw)
        .bind(admin_type)
        .bind(admin_type)
        .bind(page_size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;

        Ok((total.0 as u64, rows))
    }

    /// 重置密码。
    pub async fn update_password(&self, admin_id: i32, new_hash: &str) -> Result<()> {
        sqlx::query("UPDATE admin_user SET password = ? WHERE admin_id = ?")
            .bind(new_hash)
            .bind(admin_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("记录不存在".into()),
        other => Error::Database(other.to_string()),
    }
}
