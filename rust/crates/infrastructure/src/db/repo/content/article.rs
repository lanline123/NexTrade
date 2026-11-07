//! 文章仓储：`article` / `article_category`，替代 `ArticleMapper` / `ArticleCategoryMapper`。
//!
//! 列名严格对齐 `java/database/pure.sql`：
//! - `article`（L408）
//! - `article_category`（L440）
//!
//! 不使用 `SELECT *`，显式列出列名以保证与实体字段一一对应，
//! 避免表结构演进或列顺序变化导致 `FromRow` 映射错位。

use sqlx::MySqlPool;
use tigshop_core::entities::{Article, ArticleCategory};
use tigshop_core::types::PageQuery;
use tigshop_core::{Error, Result};

/// `article` 表全部列（顺序与 [`Article`] 字段一致）。
const ARTICLE_COLUMNS: &str = "article_id, article_title, article_category_id, article_sn, \
     article_thumb, article_tag, article_author, article_type, content, description, keywords, \
     is_show, add_time, is_hot, is_top, click_count, link";

/// `article_category` 表全部列（顺序与 [`ArticleCategory`] 字段一致）。
const CATEGORY_COLUMNS: &str = "article_category_id, article_category_name, category_sn, \
     category_type, keywords, description, sort_order, parent_id";

#[derive(Clone)]
pub struct ArticleRepository {
    pool: MySqlPool,
}

impl ArticleRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 按 ID 查询文章（含正文）。
    pub async fn find_by_id(&self, article_id: i32) -> Result<Option<Article>> {
        let sql = format!("SELECT {ARTICLE_COLUMNS} FROM article WHERE article_id = ? LIMIT 1");
        sqlx::query_as::<_, Article>(&sql)
            .bind(article_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 文章分页（关键词匹配标题/作者，可按分类与显示状态过滤）。
    ///
    /// `is_show` 为 `None` 时不限显示状态（管理端）；前台固定传 `Some(1)`。
    pub async fn paginate(
        &self,
        keyword: Option<&str>,
        category_id: Option<i32>,
        is_show: Option<i32>,
        page: &PageQuery,
    ) -> Result<(u64, Vec<Article>)> {
        let like = keyword.map(|k| format!("%{k}%"));
        let (limit, offset) = page.limit_offset();

        let where_sql = "WHERE (? IS NULL OR article_title LIKE ? OR article_author LIKE ?)
               AND (? IS NULL OR article_category_id = ?)
               AND (? IS NULL OR is_show = ?)";

        let count_sql = format!("SELECT COUNT(*) FROM article {where_sql}");
        let total: (i64,) = sqlx::query_as(&count_sql)
            .bind(&like)
            .bind(&like)
            .bind(&like)
            .bind(category_id)
            .bind(category_id)
            .bind(is_show)
            .bind(is_show)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;

        // 置顶优先，其次按添加时间倒序
        let list_sql = format!(
            "SELECT {ARTICLE_COLUMNS} FROM article {where_sql}
             ORDER BY is_top DESC, add_time DESC, article_id DESC LIMIT ? OFFSET ?"
        );
        let rows = sqlx::query_as::<_, Article>(&list_sql)
            .bind(&like)
            .bind(&like)
            .bind(&like)
            .bind(category_id)
            .bind(category_id)
            .bind(is_show)
            .bind(is_show)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;

        Ok((total.0.max(0) as u64, rows))
    }

    /// 按分类查询文章列表（前台分类页）。
    pub async fn find_by_category(
        &self,
        category_id: i32,
        is_show: Option<i32>,
    ) -> Result<Vec<Article>> {
        let sql = format!(
            "SELECT {ARTICLE_COLUMNS} FROM article
             WHERE article_category_id = ? AND (? IS NULL OR is_show = ?)
             ORDER BY is_top DESC, add_time DESC, article_id DESC"
        );
        sqlx::query_as::<_, Article>(&sql)
            .bind(category_id)
            .bind(is_show)
            .bind(is_show)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 热门文章（前台首页）。
    pub async fn find_hot(&self, limit: u32) -> Result<Vec<Article>> {
        let sql = format!(
            "SELECT {ARTICLE_COLUMNS} FROM article
             WHERE is_hot = 1 AND is_show = 1
             ORDER BY click_count DESC, add_time DESC LIMIT ?"
        );
        sqlx::query_as::<_, Article>(&sql)
            .bind(limit)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 原子累加浏览次数（并发安全，不覆盖其他字段）。
    pub async fn increment_click(&self, article_id: i32) -> Result<()> {
        sqlx::query("UPDATE article SET click_count = click_count + 1 WHERE article_id = ?")
            .bind(article_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    /// 查询文章关联的商品 ID（`product_article.goods_id`，按 article_id 关联）。
    ///
    /// 对应 Java `ArticleServiceImpl.detail` 内的
    /// `productArticleService.lambdaQuery().eq(ProductArticle::getArticleId, id)`；
    /// 结果填充 `ArticleDetailVO.productIds`，旧 PC 文章详情「相关商品」区块使用。
    pub async fn find_product_ids_by_article(&self, article_id: i32) -> Result<Vec<i32>> {
        let rows: Vec<(i32,)> =
            sqlx::query_as("SELECT goods_id FROM product_article WHERE article_id = ?")
                .bind(article_id)
                .fetch_all(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(rows.into_iter().map(|(id,)| id).collect())
    }

    /// 新增文章，返回自增主键。
    pub async fn insert(&self, a: &Article) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO article
               (article_title, article_category_id, article_sn, article_thumb, article_tag,
                article_author, article_type, content, description, keywords, is_show,
                add_time, is_hot, is_top, click_count, link)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&a.article_title)
        .bind(a.article_category_id)
        .bind(&a.article_sn)
        .bind(&a.article_thumb)
        .bind(&a.article_tag)
        .bind(&a.article_author)
        .bind(a.article_type)
        .bind(&a.content)
        .bind(&a.description)
        .bind(&a.keywords)
        .bind(a.is_show.unwrap_or(1))
        .bind(a.add_time)
        .bind(a.is_hot)
        .bind(a.is_top)
        .bind(a.click_count)
        .bind(&a.link)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 更新文章。
    pub async fn update(&self, a: &Article) -> Result<bool> {
        let r = sqlx::query(
            "UPDATE article SET article_title = ?, article_category_id = ?, article_sn = ?,
                article_thumb = ?, article_tag = ?, article_author = ?, article_type = ?,
                content = ?, description = ?, keywords = ?, is_show = ?, is_hot = ?, is_top = ?,
                link = ?
             WHERE article_id = ?",
        )
        .bind(&a.article_title)
        .bind(a.article_category_id)
        .bind(&a.article_sn)
        .bind(&a.article_thumb)
        .bind(&a.article_tag)
        .bind(&a.article_author)
        .bind(a.article_type)
        .bind(&a.content)
        .bind(&a.description)
        .bind(&a.keywords)
        .bind(a.is_show.unwrap_or(1))
        .bind(a.is_hot)
        .bind(a.is_top)
        .bind(&a.link)
        .bind(a.article_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 切换显示状态。
    pub async fn set_show(&self, article_id: i32, is_show: i32) -> Result<bool> {
        let r = sqlx::query("UPDATE article SET is_show = ? WHERE article_id = ?")
            .bind(is_show)
            .bind(article_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 删除文章。
    pub async fn delete(&self, article_id: i32) -> Result<bool> {
        let r = sqlx::query("DELETE FROM article WHERE article_id = ?")
            .bind(article_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 批量转移文章分类。
    pub async fn set_category(&self, article_id: i32, category_id: i32) -> Result<bool> {
        let r = sqlx::query("UPDATE article SET article_category_id = ? WHERE article_id = ?")
            .bind(category_id)
            .bind(article_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    // ————————————————————— 文章分类 —————————————————————

    /// 全部文章分类（按 sort_order 排序）。
    pub async fn find_categories(&self) -> Result<Vec<ArticleCategory>> {
        let sql = format!(
            "SELECT {CATEGORY_COLUMNS} FROM article_category
             ORDER BY sort_order ASC, article_category_id ASC"
        );
        sqlx::query_as::<_, ArticleCategory>(&sql)
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 按 ID 查询分类。
    pub async fn find_category_by_id(&self, id: i32) -> Result<Option<ArticleCategory>> {
        let sql = format!(
            "SELECT {CATEGORY_COLUMNS} FROM article_category WHERE article_category_id = ? LIMIT 1"
        );
        sqlx::query_as::<_, ArticleCategory>(&sql)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)
    }

    /// 统计某分类下的文章数（删除分类前的占用检查）。
    pub async fn count_articles_in_category(&self, category_id: i32) -> Result<i64> {
        let (n,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM article WHERE article_category_id = ?")
                .bind(category_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(n)
    }

    /// 统计某分类的子分类数（删除分类前的占用检查）。
    pub async fn count_children(&self, category_id: i32) -> Result<i64> {
        let (n,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM article_category WHERE parent_id = ?",
        )
        .bind(category_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(n)
    }

    /// 新增分类，返回自增主键。
    pub async fn insert_category(&self, c: &ArticleCategory) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO article_category
               (article_category_name, category_sn, category_type, keywords, description,
                sort_order, parent_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&c.article_category_name)
        .bind(&c.category_sn)
        .bind(c.category_type)
        .bind(&c.keywords)
        .bind(&c.description)
        .bind(c.sort_order)
        .bind(c.parent_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 更新分类。
    pub async fn update_category(&self, c: &ArticleCategory) -> Result<bool> {
        let r = sqlx::query(
            "UPDATE article_category SET article_category_name = ?, category_sn = ?,
                category_type = ?, keywords = ?, description = ?, sort_order = ?, parent_id = ?
             WHERE article_category_id = ?",
        )
        .bind(&c.article_category_name)
        .bind(&c.category_sn)
        .bind(c.category_type)
        .bind(&c.keywords)
        .bind(&c.description)
        .bind(c.sort_order)
        .bind(c.parent_id)
        .bind(c.article_category_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 删除分类。
    pub async fn delete_category(&self, id: i32) -> Result<bool> {
        let r = sqlx::query("DELETE FROM article_category WHERE article_category_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("文章不存在".into()),
        other => Error::Database(other.to_string()),
    }
}