//! 文章分类管理域服务（content::article_category）。
//!
//! 对应 Java `ArticleCategoryServiceImpl#update/updateField/batch`：
//! - `update`：id 必填，按提供字段选择性更新（不存在 id → 0 行静默）。
//! - `updateField`：白名单 `ARTICLE_CATEGORY_FIELDS`，非法 → 「field 的值有误」。
//! - `batch`：仅 `type = del` 执行批量删除，其他类型静默（Java 返回 false）。

use std::sync::Arc;

use tigshop_core::models::content::article_category::{
    is_delete_batch, resolve_field, ArticleCategoryDTO, BatchDTO, UpdateFieldDTO,
    MSG_FIELD_INVALID, MSG_ID_REQUIRED, MSG_UNSELECTED_ITEM,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::content::article_category::{
    ArticleCategoryRepository, CategoryUpdatePatch,
};
use tigshop_infrastructure::db::Repositories;

/// 文章分类管理服务。
pub struct ArticleCategoryService {
    repos: Arc<Repositories>,
}

impl ArticleCategoryService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.content.article_category`）。
    #[must_use]
    pub fn repo(&self) -> &ArticleCategoryRepository {
        &self.repos.content.article_category
    }

    /// 更新分类（Java `update`）。
    pub async fn update(&self, dto: &ArticleCategoryDTO) -> Result<()> {
        let id = dto
            .article_category_id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::Validation(MSG_ID_REQUIRED.into()))?;
        let patch = CategoryUpdatePatch {
            article_category_name: dto.article_category_name.clone(),
            category_sn: dto.category_sn.clone(),
            category_type: dto.category_type,
            keywords: dto.keywords.clone(),
            description: dto.description.clone(),
            sort_order: dto.sort_order,
            parent_id: dto.parent_id,
        };
        self.repo().update(id, &patch).await?;
        Ok(())
    }

    /// 更新单字段（Java `updateField`）。
    pub async fn update_field(&self, dto: &UpdateFieldDTO) -> Result<()> {
        let column = resolve_field(&dto.field)
            .ok_or_else(|| Error::biz_msg(MSG_FIELD_INVALID))?;
        self.repo().update_field(dto.id, column, &dto.val).await?;
        Ok(())
    }

    /// 批量操作（Java `batch`）。
    pub async fn batch(&self, dto: &BatchDTO) -> Result<()> {
        if dto.ids.is_empty() {
            return Err(Error::Validation(MSG_UNSELECTED_ITEM.into()));
        }
        if !is_delete_batch(&dto.r#type) {
            return Ok(());
        }
        self.repo().delete_by_ids(&dto.ids).await?;
        Ok(())
    }

    /// 按 id 查分类（详情）。
    pub async fn detail(
        &self,
        id: i32,
    ) -> Result<Option<tigshop_core::models::content::article_category::ArticleCategoryVO>> {
        self.repo().find_by_id(id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn field_invalid_message() {
        assert_eq!(MSG_FIELD_INVALID, "field 的值有误");
        assert!(resolve_field("parent_id").is_none());
    }

    #[test]
    fn batch_requires_ids() {
        assert!(!is_delete_batch("on"));
    }
}
