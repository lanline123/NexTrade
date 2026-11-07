//! 内容服务：文章与文章分类。
//! 对应原 Java `ArticleServiceImpl` / `ArticleCategoryServiceImpl`。
//!
//! 前台接口仅返回 `is_show = 1` 的文章，管理端可见全部。

use std::sync::Arc;

use tigshop_core::entities::{Article, ArticleCategory};
use tigshop_core::models::{
    ArticleCategoryTreeNode, ArticleCategoryVO, ArticleDetailVO, ArticleListQuery, ArticleVO,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

pub struct ContentService {
    repos: Arc<Repositories>,
}

impl ContentService {
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    // ————————————————————— 文章 —————————————————————

    /// 文章分页。
    ///
    /// `public_side = true` 时强制只返回已显示文章（前台），
    /// 管理端传 `false` 可查看全部（含隐藏）。
    pub async fn list(
        &self,
        q: &ArticleListQuery,
        public_side: bool,
    ) -> Result<PageResult<ArticleVO>> {
        let page = PageQuery {
            page: q.page.unwrap_or(1),
            page_size: q.page_size.unwrap_or(20),
        };
        let is_show = if public_side { Some(1) } else { q.is_show };
        let (total, rows) = self
            .repos.content.article
            .paginate(q.keyword.as_deref(), q.article_category_id, is_show, &page)
            .await?;
        let list: Vec<ArticleVO> = rows.iter().map(ArticleVO::from).collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 文章详情（含正文）。
    ///
    /// `public_side = true` 时隐藏文章返回 `NotFound`（避免泄露存在性），
    /// 并累加浏览次数。
    pub async fn detail(&self, article_id: i32, public_side: bool) -> Result<ArticleDetailVO> {
        let a = self
            .repos.content.article
            .find_by_id(article_id)
            .await?
            .ok_or_else(|| Error::NotFound("文章不存在".into()))?;

        if public_side {
            if !a.is_visible() {
                return Err(Error::NotFound("文章不存在".into()));
            }
            // 前台浏览计数（失败不影响详情返回）
            if let Err(e) = self.repos.content.article.increment_click(article_id).await {
                tracing::warn!("文章浏览计数失败 article_id={article_id}: {e}");
            }
        }
        // 关联商品 ID（Java ArticleDetailVO.productIds）：查询失败不阻断详情返回
        let product_ids = self
            .repos
            .content
            .article
            .find_product_ids_by_article(article_id)
            .await
            .unwrap_or_default();
        let mut vo = ArticleDetailVO::from(&a);
        vo.product_ids = product_ids;
        Ok(vo)
    }

    /// 热门文章（前台首页）。
    pub async fn hot_articles(&self, limit: u32) -> Result<Vec<ArticleVO>> {
        let rows = self.repos.content.article.find_hot(limit.clamp(1, 50)).await?;
        Ok(rows.iter().map(ArticleVO::from).collect())
    }

    // ————————————————————— 管理端写操作 —————————————————————

    /// 新增文章（`add_time` 由服务端填充）。
    pub async fn create(&self, mut a: Article) -> Result<i32> {
        if a.article_title.trim().is_empty() {
            return Err(Error::Validation("文章标题不能为空".into()));
        }
        if a.add_time <= 0 {
            a.add_time = tigshop_common::utils::now_seconds() as i32;
        }
        self.repos.content.article.insert(&a).await
    }

    /// 更新文章。
    pub async fn update(&self, a: Article) -> Result<()> {
        if a.article_id <= 0 {
            return Err(Error::Validation("文章ID无效".into()));
        }
        if a.article_title.trim().is_empty() {
            return Err(Error::Validation("文章标题不能为空".into()));
        }
        if !self.repos.content.article.update(&a).await? {
            return Err(Error::NotFound("文章不存在".into()));
        }
        Ok(())
    }

    /// 切换文章显示状态。
    pub async fn set_show(&self, article_id: i32, is_show: i32) -> Result<()> {
        if !self.repos.content.article.set_show(article_id, is_show).await? {
            return Err(Error::NotFound("文章不存在".into()));
        }
        Ok(())
    }

    /// 删除文章。
    pub async fn delete(&self, article_id: i32) -> Result<()> {
        if !self.repos.content.article.delete(article_id).await? {
            return Err(Error::NotFound("文章不存在".into()));
        }
        Ok(())
    }

    /// 文章批量操作（对齐 Java `ArticleServiceImpl#batch`）。
    ///
    /// 支持 `del` / `show` / `hide` / `moveCat`；`moveCat` 取
    /// `target_cat` 最后一个分类，与 Java 实现一致。
    pub async fn batch(
        &self,
        ids: &[i32],
        action: &str,
        target_cat: Option<&[i32]>,
    ) -> Result<()> {
        match action {
            "del" => {
                for id in ids {
                    self.repos.content.article.delete(*id).await?;
                }
            }
            "show" | "hide" => {
                let is_show = i32::from(action == "show");
                for id in ids {
                    self.repos.content.article.set_show(*id, is_show).await?;
                }
            }
            "moveCat" => {
                let category_id = target_cat
                    .and_then(|items| items.last().copied())
                    .ok_or_else(|| Error::Validation("目标分类不能为空".into()))?;
                for id in ids {
                    self.repos
                        .content
                        .article
                        .set_category(*id, category_id)
                        .await?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    // ————————————————————— 文章分类 —————————————————————

    /// 全部文章分类（平铺）。
    pub async fn categories(&self) -> Result<Vec<ArticleCategoryVO>> {
        let rows = self.repos.content.article.find_categories().await?;
        Ok(rows.iter().map(ArticleCategoryVO::from).collect())
    }

    /// 文章分类树。
    pub async fn category_tree(&self) -> Result<Vec<ArticleCategoryTreeNode>> {
        let all = self.repos.content.article.find_categories().await?;
        Ok(build_category_tree(&all, ArticleCategory::ROOT_PARENT))
    }

    /// 分类详情。
    pub async fn category_detail(&self, id: i32) -> Result<ArticleCategoryVO> {
        let c = self
            .repos.content.article
            .find_category_by_id(id)
            .await?
            .ok_or_else(|| Error::NotFound("文章分类不存在".into()))?;
        Ok(ArticleCategoryVO::from(&c))
    }

    /// 新增分类。
    pub async fn create_category(&self, mut c: ArticleCategory) -> Result<i32> {
        if c.article_category_name.trim().is_empty() {
            return Err(Error::Validation("分类名称不能为空".into()));
        }
        if c.category_type == 0 {
            c.category_type = ArticleCategory::TYPE_NORMAL;
        }
        self.repos.content.article.insert_category(&c).await
    }

    /// 更新分类。
    pub async fn update_category(&self, c: ArticleCategory) -> Result<()> {
        if c.article_category_id <= 0 {
            return Err(Error::Validation("分类ID无效".into()));
        }
        if c.article_category_name.trim().is_empty() {
            return Err(Error::Validation("分类名称不能为空".into()));
        }
        // 不允许把分类挂到自己名下，避免形成自环
        if c.parent_id == c.article_category_id {
            return Err(Error::Validation("父分类不能是自身".into()));
        }
        if !self.repos.content.article.update_category(&c).await? {
            return Err(Error::NotFound("文章分类不存在".into()));
        }
        Ok(())
    }

    /// 删除分类（有子分类或仍有文章占用时拒绝，对齐 Java 逻辑）。
    pub async fn delete_category(&self, id: i32) -> Result<()> {
        let children = self.repos.content.article.count_children(id).await?;
        if children > 0 {
            return Err(Error::biz(400, "该分类下存在子分类，无法删除"));
        }
        let articles = self.repos.content.article.count_articles_in_category(id).await?;
        if articles > 0 {
            return Err(Error::biz(400, "该分类下存在文章，无法删除"));
        }
        if !self.repos.content.article.delete_category(id).await? {
            return Err(Error::NotFound("文章分类不存在".into()));
        }
        Ok(())
    }
}

/// 递归构建文章分类树。
fn build_category_tree(all: &[ArticleCategory], parent_id: i32) -> Vec<ArticleCategoryTreeNode> {
    all.iter()
        .filter(|c| c.parent_id == parent_id)
        .map(|c| ArticleCategoryTreeNode {
            node: ArticleCategoryVO::from(c),
            children: build_category_tree(all, c.article_category_id),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cat(id: i32, parent: i32, name: &str) -> ArticleCategory {
        ArticleCategory {
            article_category_id: id,
            parent_id: parent,
            article_category_name: name.into(),
            ..Default::default()
        }
    }

    #[test]
    fn tree_builds_nested_children() {
        let all = vec![cat(1, 0, "根"), cat(2, 1, "子"), cat(3, 1, "子2"), cat(4, 2, "孙")];
        let tree = build_category_tree(&all, ArticleCategory::ROOT_PARENT);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].node.article_category_id, 1);
        assert_eq!(tree[0].children.len(), 2);
        // 孙节点挂在 id=2 下
        let child2 = tree[0]
            .children
            .iter()
            .find(|n| n.node.article_category_id == 2)
            .unwrap();
        assert_eq!(child2.children.len(), 1);
        assert_eq!(child2.children[0].node.article_category_id, 4);
    }

    #[test]
    fn tree_empty_when_no_roots() {
        let all = vec![cat(2, 1, "孤儿")];
        // 父节点 1 不存在：不作为根返回，避免死循环
        assert!(build_category_tree(&all, ArticleCategory::ROOT_PARENT).is_empty());
    }

    #[test]
    fn tree_handles_multiple_roots() {
        let all = vec![cat(1, 0, "A"), cat(2, 0, "B")];
        assert_eq!(build_category_tree(&all, ArticleCategory::ROOT_PARENT).len(), 2);
    }
}