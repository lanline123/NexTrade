//! 文章分类管理域仓储（content::article_category）。
//!
//! 表：`article_category`；查询使用运行时 `sqlx::query_as`。

use sqlx::{MySql, MySqlPool, QueryBuilder};

use tigshop_core::models::content::article_category::ArticleCategoryDTO;
use tigshop_core::{Error, Result};

/// 更新补丁（只写提供字段，Java `updateById` 语义）。
#[derive(Debug, Clone, Default)]
pub struct CategoryUpdatePatch {
    pub article_category_name: Option<String>,
    pub category_sn: Option<String>,
    pub category_type: Option<i32>,
    pub keywords: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub parent_id: Option<i32>,
}

/// 文章分类仓储。
#[derive(Clone)]
pub struct ArticleCategoryRepository {
    pool: MySqlPool,
}

impl ArticleCategoryRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 按主键更新提供字段。
    pub async fn update(
        &self,
        id: i32,
        patch: &CategoryUpdatePatch,
    ) -> Result<u64> {
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("UPDATE article_category SET article_category_id = ");
        qb.push_bind(id);
        let mut sep = qb.separated(", ");
        if let Some(v) = &patch.article_category_name {
            sep.push("article_category_name = ").push_bind(v.clone());
        }
        if let Some(v) = &patch.category_sn {
            sep.push("category_sn = ").push_bind(v.clone());
        }
        if let Some(v) = patch.category_type {
            sep.push("category_type = ").push_bind(v);
        }
        if let Some(v) = &patch.keywords {
            sep.push("keywords = ").push_bind(v.clone());
        }
        if let Some(v) = &patch.description {
            sep.push("description = ").push_bind(v.clone());
        }
        if let Some(v) = patch.sort_order {
            sep.push("sort_order = ").push_bind(v);
        }
        if let Some(v) = patch.parent_id {
            sep.push("parent_id = ").push_bind(v);
        }
        drop(sep);
        qb.push(" WHERE article_category_id = ").push_bind(id);
        qb.build()
            .execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .map_err(map_err)
    }

    /// 单字段更新（白名单列）。
    pub async fn update_field(
        &self,
        id: i32,
        column: &'static str,
        value: &str,
    ) -> Result<u64> {
        let sql = format!(
            "UPDATE article_category SET {column} = ? WHERE article_category_id = ?"
        );
        sqlx::query(&sql)
            .bind(value)
            .bind(id)
            .execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .map_err(map_err)
    }

    /// 批量删除（Java `removeByIds`）。
    pub async fn delete_by_ids(&self, ids: &[i32]) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders = vec!["?"; ids.len()].join(", ");
        let sql = format!(
            "DELETE FROM article_category WHERE article_category_id IN ({placeholders})"
        );
        let mut q = sqlx::query(&sql);
        for id in ids {
            q = q.bind(*id);
        }
        q.execute(&self.pool)
            .await
            .map(|r| r.rows_affected())
            .map_err(map_err)
    }

    /// 按 id 查分类（分类存在性/详情）。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<tigshop_core::models::content::article_category::ArticleCategoryVO>> {
        let row = sqlx::query_as::<_, (i32, String, String, i32, String, String, i32, i32)>(
            "SELECT article_category_id, article_category_name, category_sn, category_type,
                    keywords, description, sort_order, parent_id
             FROM article_category WHERE article_category_id = ? LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|r| tigshop_core::models::content::article_category::ArticleCategoryVO {
            article_category_id: r.0,
            article_category_name: r.1,
            category_sn: r.2,
            category_type: r.3,
            keywords: r.4,
            description: r.5,
            sort_order: r.6,
            parent_id: r.7,
        }))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patch_default_is_empty() {
        let patch = CategoryUpdatePatch::default();
        assert!(patch.article_category_name.is_none());
    }

    #[test]
    fn dto_patch_conversion_fields() {
        let dto = ArticleCategoryDTO {
            article_category_name: Some("名".into()),
            sort_order: Some(1),
            ..Default::default()
        };
        assert_eq!(dto.article_category_name.as_deref(), Some("名"));
        assert_eq!(dto.sort_order, Some(1));
    }
}
