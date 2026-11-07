//! 海外站图片本地化仓储（lang::image_i18n）。
//!
//! Java 来源：`TranslationsServiceImpl#createTranslations` 的图片分支
//! （原文为图片 URL 时双写 `image_i18n`），以及图片本地化的读取侧。
//!
//! 表 `image_i18n`（实体 `entities::ImageI18n`，7 列）：
//! `id` / `locale_id` / `data_type` / `original_key` / `original_url` /
//! `localized_url` / `add_time`。
//!
//! SQL 一律运行时 `sqlx::query_as`（本机无 `DATABASE_URL`，不用宏）。

use sqlx::MySqlPool;

use tigshop_core::entities::ImageI18n;
use tigshop_core::{Error, Result};

/// `image_i18n` 固定 SELECT 列清单（顺序与实体一致，7 列）。
pub const IMAGE_I18N_COLUMNS: [&str; 7] = [
    "id",
    "locale_id",
    "data_type",
    "original_key",
    "original_url",
    "localized_url",
    "add_time",
];

/// 海外站图片本地化仓储。
#[derive(Clone)]
pub struct ImageI18nRepository {
    pool: MySqlPool,
}

impl ImageI18nRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    fn select_sql(where_sql: &str) -> String {
        format!(
            "SELECT {} FROM image_i18n {where_sql}",
            IMAGE_I18N_COLUMNS.join(", ")
        )
    }

    /// 按 `(original_key, data_type, locale_id)` 查单条
    /// （`createTranslations` 双写的幂等判断）。
    pub async fn find_by_key_type_locale(
        &self,
        original_key: &str,
        data_type: i32,
        locale_id: i32,
    ) -> Result<Option<ImageI18n>> {
        let sql = Self::select_sql(
            "WHERE original_key = ? AND data_type = ? AND locale_id = ? LIMIT 1",
        );
        sqlx::query_as::<_, ImageI18n>(&sql)
            .bind(original_key)
            .bind(data_type)
            .bind(locale_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按原图 URL 查各语言译文（前台按当前语言替换图片）。
    pub async fn find_by_original_url(
        &self,
        original_url: &str,
        data_type: i32,
    ) -> Result<Vec<ImageI18n>> {
        let sql = Self::select_sql("WHERE original_url = ? AND data_type = ?");
        sqlx::query_as::<_, ImageI18n>(&sql)
            .bind(original_url)
            .bind(data_type)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按原图 MD5 查各语言译文（Java 侧以 `original_key` 为索引键）。
    pub async fn find_by_original_key(
        &self,
        original_key: &str,
        data_type: i32,
    ) -> Result<Vec<ImageI18n>> {
        let sql = Self::select_sql("WHERE original_key = ? AND data_type = ?");
        sqlx::query_as::<_, ImageI18n>(&sql)
            .bind(original_key)
            .bind(data_type)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 幂等写入：`(original_key, data_type, locale_id)` 命中则只更新
    /// `localized_url` / `original_url`，未命中则插入（Java 图片分支等价语义）。
    pub async fn upsert(&self, row: &ImageI18n) -> Result<()> {
        if let Some(mut existing) = self
            .find_by_key_type_locale(&row.original_key, row.data_type, row.locale_id)
            .await?
        {
            existing.original_url = row.original_url.clone();
            existing.localized_url = row.localized_url.clone();
            self.update(&existing).await?;
            return Ok(());
        }
        self.insert(row).await?;
        Ok(())
    }

    /// 插入一条图片本地化记录。
    pub async fn insert(&self, row: &ImageI18n) -> Result<i64> {
        let res = sqlx::query(
            "INSERT INTO image_i18n (locale_id, data_type, original_key, original_url, localized_url, add_time) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(row.locale_id)
        .bind(row.data_type)
        .bind(&row.original_key)
        .bind(&row.original_url)
        .bind(&row.localized_url)
        .bind(row.add_time)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i64::try_from(res.last_insert_id()).unwrap_or(0))
    }

    /// 更新一条图片本地化记录（按主键）。
    pub async fn update(&self, row: &ImageI18n) -> Result<u64> {
        let res = sqlx::query(
            "UPDATE image_i18n SET locale_id = ?, data_type = ?, original_key = ?, original_url = ?, localized_url = ?, add_time = ? WHERE id = ?",
        )
        .bind(row.locale_id)
        .bind(row.data_type)
        .bind(&row.original_key)
        .bind(&row.original_url)
        .bind(&row.localized_url)
        .bind(row.add_time)
        .bind(row.id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(res.rows_affected())
    }

    /// 按 `(data_type, locale_id)` 批量查（列表页一次性取整页图片译文）。
    pub async fn find_by_locale(
        &self,
        data_type: i32,
        locale_id: i32,
        original_keys: &[&str],
    ) -> Result<Vec<ImageI18n>> {
        if original_keys.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = vec!["?"; original_keys.len()].join(", ");
        let sql = Self::select_sql(&format!(
            "WHERE data_type = ? AND locale_id = ? AND original_key IN ({placeholders})"
        ));
        let mut q = sqlx::query_as::<_, ImageI18n>(&sql)
            .bind(data_type)
            .bind(locale_id);
        for key in original_keys {
            q = q.bind(*key);
        }
        q.fetch_all(&self.pool).await.map_err(map_err)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn column_list_matches_entity() {
        assert_eq!(IMAGE_I18N_COLUMNS.len(), 7);
        assert!(IMAGE_I18N_COLUMNS.contains(&"original_key"));
        assert!(IMAGE_I18N_COLUMNS.contains(&"localized_url"));
    }
}
