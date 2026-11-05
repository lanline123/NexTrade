//! 管理端内容（文章）路由。
//! 对应原 Java `com.tigshop.adminapi.controller.content.ArticleController` 与
//! `ArticleCategoryController`（`/adminapi/content`）。
//!
//! | 路由 | 原 Java |
//! |------|---------|
//! | `GET  /adminapi/content/article/list`        | `ArticleController.list` |
//! | `GET  /adminapi/content/article/detail`      | `ArticleController.detail` |
//! | `POST /adminapi/content/article/create`      | `ArticleController.create` |
//! | `POST /adminapi/content/article/update`      | `ArticleController.update` |
//! | `POST /adminapi/content/article/updateField` | `ArticleController.updateField`（显示/隐藏） |
//! | `POST /adminapi/content/article/del`         | `ArticleController.del` |
//! | `POST /adminapi/content/article/batch`       | `ArticleController.batch` |
//! | `GET  /adminapi/content/articleCategory/list`   | `ArticleCategoryController.list` |
//! | `GET  /adminapi/content/articleCategory/tree`   | `ArticleCategoryController.tree` |
//! | `GET  /adminapi/content/articleCategory/detail` | `ArticleCategoryController.detail` |
//! | `POST /adminapi/content/articleCategory/create` | `ArticleCategoryController.create` |
//! | `POST /adminapi/content/articleCategory/del`    | `ArticleCategoryController.del` |
//!
//! 注意：原 Java 分类的「新增/更新」是两个端点（`create` / `update`），
//! 本 crate 目前用单个 `create` 承担 upsert，属实现差异，待补 `update`。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::entities::{Article, ArticleCategory};
use tigshop_core::models::{
    ArticleCategoryTreeNode, ArticleCategoryVO, ArticleDetailVO, ArticleListQuery, ArticleVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 内容域路由（挂载于 `/adminapi` 下）。
pub fn routes(_state: &AdminState) -> Router<AdminState> {
    Router::new()
        .route("/content/article/list", get(article_list))
        .route("/content/article/detail", get(article_detail))
        .route("/content/article/create", post(article_create))
        .route("/content/article/update", post(article_update))
        .route("/content/article/updateField", post(article_set_show))
        .route("/content/article/del", post(article_delete))
        .route("/content/articleCategory/list", get(category_list))
        .route("/content/articleCategory/tree", get(category_tree))
        .route("/content/articleCategory/detail", get(category_detail))
        .route("/content/articleCategory/create", post(category_save))
        .route("/content/articleCategory/del", post(category_delete))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/content/article/list",
            "ArticleController.list",
        ),
        (
            "GET",
            "/adminapi/content/article/detail",
            "ArticleController.detail",
        ),
        (
            "POST",
            "/adminapi/content/article/create",
            "ArticleController.create",
        ),
        (
            "POST",
            "/adminapi/content/article/update",
            "ArticleController.update",
        ),
        (
            "POST",
            "/adminapi/content/article/updateField",
            "ArticleController.updateField",
        ),
        (
            "POST",
            "/adminapi/content/article/del",
            "ArticleController.del",
        ),
        (
            "GET",
            "/adminapi/content/articleCategory/list",
            "ArticleCategoryController.list",
        ),
        (
            "GET",
            "/adminapi/content/articleCategory/tree",
            "ArticleCategoryController.tree",
        ),
        (
            "GET",
            "/adminapi/content/articleCategory/detail",
            "ArticleCategoryController.detail",
        ),
        (
            "POST",
            "/adminapi/content/articleCategory/create",
            "ArticleCategoryController.create",
        ),
        (
            "POST",
            "/adminapi/content/articleCategory/del",
            "ArticleCategoryController.del",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/content/article/list`：文章分页（管理端含隐藏文章）。
async fn article_list(
    State(state): State<AdminState>,
    Query(q): Query<ArticleListQuery>,
) -> ApiResult<PageResult<ArticleVO>> {
    ok(state.content.article.list(&q, false).await?)
}

#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/content/article/detail?id=`：文章详情（含正文）。
async fn article_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ArticleDetailVO> {
    ok(state.content.article.detail(q.id, false).await?)
}

/// `POST /adminapi/content/article/create`：新增文章。
async fn article_create(
    State(state): State<AdminState>,
    Json(dto): Json<ArticleSaveDTO>,
) -> ApiResult<i32> {
    ok(state.content.article.create(dto.into_article()).await?)
}

/// `POST /adminapi/content/article/update`：更新文章。
async fn article_update(
    State(state): State<AdminState>,
    Json(dto): Json<ArticleSaveDTO>,
) -> ApiResult<&'static str> {
    state.content.article.update(dto.into_article()).await?;
    ok("修改成功")
}

/// 后台文章表单 DTO（兼容 Java 的驼峰字段与 `articleCategoryId` 数组）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ArticleSaveDTO {
    id: Option<i32>,
    article_id: Option<i32>,
    article_title: Option<String>,
    article_category_id: Option<serde_json::Value>,
    article_sn: Option<String>,
    article_thumb: Option<String>,
    article_tag: Option<String>,
    article_author: Option<String>,
    article_type: Option<i32>,
    content: Option<String>,
    description: Option<String>,
    keywords: Option<String>,
    is_show: Option<i32>,
    add_time: Option<i32>,
    is_hot: Option<i32>,
    is_top: Option<i32>,
    click_count: Option<i32>,
    link: Option<String>,
}

impl ArticleSaveDTO {
    fn category_id(&self) -> i32 {
        match self.article_category_id.as_ref() {
            Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0) as i32,
            Some(serde_json::Value::Array(a)) => {
                a.first().and_then(serde_json::Value::as_i64).unwrap_or(0) as i32
            }
            Some(serde_json::Value::String(s)) => s.parse().unwrap_or(0),
            _ => 0,
        }
    }

    fn into_article(self) -> Article {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i32;
        let category_id = self.category_id();
        Article {
            article_id: self.id.or(self.article_id).unwrap_or(0),
            article_title: self.article_title.unwrap_or_default(),
            article_category_id: category_id,
            article_sn: self.article_sn.unwrap_or_default(),
            article_thumb: self.article_thumb.unwrap_or_default(),
            article_tag: self.article_tag.unwrap_or_default(),
            article_author: self.article_author.unwrap_or_default(),
            article_type: self.article_type.unwrap_or(1),
            content: self.content.unwrap_or_default(),
            description: self.description,
            keywords: self.keywords.unwrap_or_default(),
            is_show: Some(self.is_show.unwrap_or(1)),
            add_time: self.add_time.filter(|v| *v > 0).unwrap_or(now),
            is_hot: self.is_hot.unwrap_or(0),
            is_top: self.is_top.unwrap_or(0),
            click_count: self.click_count.unwrap_or(0),
            link: self.link.unwrap_or_default(),
        }
    }
}

/// 显示状态切换请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetShowDTO {
    article_id: i32,
    is_show: i32,
}

/// `POST /adminapi/content/article/setShow`：显示/隐藏切换。
async fn article_set_show(
    State(state): State<AdminState>,
    Json(dto): Json<SetShowDTO>,
) -> ApiResult<&'static str> {
    state
        .content
        .article
        .set_show(dto.article_id, dto.is_show)
        .await?;
    ok("操作成功")
}

/// `POST /adminapi/content/article/delete`：删除文章。
async fn article_delete(
    State(state): State<AdminState>,
    Json(dto): Json<IdBody>,
) -> ApiResult<&'static str> {
    state.content.article.delete(dto.id).await?;
    ok("删除成功")
}

#[derive(Debug, Deserialize)]
struct IdBody {
    id: i32,
}

/// 文章批量操作入参（对应 Java `ArticleBatchParam`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ArticleBatchDTO {
    ids: Vec<i32>,
    #[serde(rename = "type")]
    type_: String,
    target_cat: Option<Vec<i32>>,
}

/// `POST /adminapi/content/article/batch`：批量删除/显示/隐藏/转移分类。
async fn article_batch(
    State(state): State<AdminState>,
    Json(dto): Json<ArticleBatchDTO>,
) -> ApiResult<&'static str> {
    state
        .content
        .article
        .batch(&dto.ids, &dto.type_, dto.target_cat.as_deref())
        .await?;
    ok("操作成功")
}

/// `GET /adminapi/content/articleCategory/list`：文章分类平铺列表。
async fn category_list(State(state): State<AdminState>) -> ApiResult<Vec<ArticleCategoryVO>> {
    ok(state.content.article.categories().await?)
}

/// `GET /adminapi/content/articleCategory/tree`：文章分类树。
async fn category_tree(State(state): State<AdminState>) -> ApiResult<Vec<ArticleCategoryTreeNode>> {
    ok(state.content.article.category_tree().await?)
}

/// `GET /adminapi/content/articleCategory/detail?id=`：分类详情。
async fn category_detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ArticleCategoryVO> {
    ok(state.content.article.category_detail(q.id).await?)
}

/// `POST /adminapi/content/articleCategory/save`：新增或更新分类。
///
/// `articleCategoryId` 为 0 或缺省时新增，否则更新。
async fn category_save(
    State(state): State<AdminState>,
    Json(dto): Json<ArticleCategorySaveDTO>,
) -> ApiResult<i32> {
    let c = dto.into_entity();
    if c.article_category_id > 0 {
        let id = c.article_category_id;
        state.content.article.update_category(c).await?;
        ok(id)
    } else {
        ok(state.content.article.create_category(c).await?)
    }
}

/// 文章分类表单 DTO（兼容 Java Admin 的驼峰字段）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ArticleCategorySaveDTO {
    article_category_id: Option<i32>,
    id: Option<i32>,
    article_category_name: Option<String>,
    category_type: Option<i32>,
    keywords: Option<String>,
    description: Option<String>,
    sort_order: Option<i32>,
    parent_id: Option<i32>,
}

impl ArticleCategorySaveDTO {
    fn into_entity(self) -> ArticleCategory {
        ArticleCategory {
            article_category_id: self.article_category_id.or(self.id).unwrap_or(0),
            article_category_name: self.article_category_name.unwrap_or_default(),
            category_sn: String::new(),
            category_type: self.category_type.unwrap_or(1),
            keywords: self.keywords.unwrap_or_default(),
            description: self.description.unwrap_or_default(),
            sort_order: self.sort_order.unwrap_or(50),
            parent_id: self.parent_id.unwrap_or(0),
        }
    }
}

/// `POST /adminapi/content/articleCategory/delete`：删除分类（有子分类/文章时拒绝）。
async fn category_delete(
    State(state): State<AdminState>,
    Json(dto): Json<IdBody>,
) -> ApiResult<&'static str> {
    state.content.article.delete_category(dto.id).await?;
    ok("删除成功")
}
