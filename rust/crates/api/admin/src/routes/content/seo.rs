//! 管理端 SEO 设置路由（content::seo）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.SeoController`
//! （`@RequestMapping("/adminapi/setting/seo")`，3 个端点）。
//!
//! ## 原 Java 路径对照表
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 完整路径 | 原 Java 方法 | 权限 |
//! |----------------------------------|------------------|--------------|------|
//! | `GET  /setting/seo/translateToSeoIdentification` | `GET /adminapi/setting/seo/translateToSeoIdentification` | `SeoController.translateToEnglish` | 登录（jwt） |
//! | `POST /setting/seo/batchUpdateCategoryLink` | `POST /adminapi/setting/seo/batchUpdateCategoryLink` | `SeoController.batchUpdateCategoryLink` | 登录（jwt） |
//! | `POST /setting/seo/batchUpdateProductLink` | `POST /adminapi/setting/seo/batchUpdateProductLink` | `SeoController.batchUpdateProductLink` | 登录（jwt） |
//!
//! > **路径说明**：本域**没有**「控制器名重复一次」的形式
//! > （类注解 `/adminapi/setting/seo` + 方法级 `@GetMapping("translateToSeoIdentification")`）。
//! > `routes()` 内写的是去掉 `/adminapi` 前缀后的形式。
//! >
//! > **权限说明**：Java 该控制器**没有** `@PreAuthorize`（契约 `permissions` 为空），
//! > 仅由 Spring Security 登录过滤器拦截；Rust 侧依赖 `/adminapi` 内层统一的
//! > `require_auth`（`crates/api/admin/src/lib.rs`），不追加额外权限校验。
//! >
//! > **⚠️ 未迁移依赖（3 条端点的成功路径均不可用）**：Java 全部实现依赖翻译服务
//! > `TranslationsService`（火山引擎机器翻译 SDK + 配置项
//! > `langVolcengineAccessKey` / `langVolcengineSecret`）；批量更新还依赖
//! > Redis 缓存清理。该服务在 Rust 侧未迁移，故 3 条端点均返回业务码 1001 与
//! > 明确文案（**不伪造实现、不静默成功**），详见
//! > [`tigshop_services::content::seo`] 模块头「未迁移依赖」。
//! >
//! > **返回结构说明**：Java 两条批量更新接口是 `@Async` + `void`（**总是返回成功**，
//! > 失败只写日志），Rust 侧改为同步返回明确错误——这是**有意**的差异，
//! > 见服务层模块注释。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Router,
};
use tigshop_core::models::content::seo::TranslateSeoQuery;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// SEO 设置域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/setting/seo/translateToSeoIdentification",
            get(translate_to_seo_identification),
        )
        .route(
            "/setting/seo/batchUpdateCategoryLink",
            post(batch_update_category_link),
        )
        .route(
            "/setting/seo/batchUpdateProductLink",
            post(batch_update_product_link),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/seo/translateToSeoIdentification",
            "SeoController.translateToEnglish",
        ),
        (
            "POST",
            "/adminapi/setting/seo/batchUpdateCategoryLink",
            "SeoController.batchUpdateCategoryLink",
        ),
        (
            "POST",
            "/adminapi/setting/seo/batchUpdateProductLink",
            "SeoController.batchUpdateProductLink",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/setting/seo/translateToSeoIdentification?chineseText=`：
/// 中文转英文并格式化。
///
/// 对应 Java `SeoController.translateToEnglish(@RequestParam("chineseText"))` →
/// `TranslationsService#getTranslations("en", chineseText)` +
/// `SeoIdentificationUtil#formatEnglishText`。
///
/// **未迁移**：翻译服务不可用，恒定返回业务码 1001（文案见
/// [`tigshop_services::content::seo::TRANSLATION_UNMIGRATED_MSG`]）。
/// Java 返回裸 `String`，经 `GlobalResponseAdvice` 包成 `AjaxResult`，
/// 故 Rust 侧返回 `ApiResult<String>`（`data` 为格式化后的英文）。
async fn translate_to_seo_identification(
    State(state): State<AdminState>,
    Query(q): Query<TranslateSeoQuery>,
) -> ApiResult<String> {
    ok(state
        .content
        .seo
        .translate_to_seo_identification(q.chinese_text.as_deref())
        .await?)
}

/// `POST /adminapi/setting/seo/batchUpdateCategoryLink`：商品类目链接批量更新。
///
/// 对应 Java `SeoController.batchUpdateCategoryLink()` →
/// `SeoServiceImpl#generateAndUpdateCategorySeoIdentification`（`@Async`）。
///
/// **未迁移**：依赖翻译服务与 Redis 缓存清理，恒定返回业务码 1001。
async fn batch_update_category_link(State(state): State<AdminState>) -> ApiResult<()> {
    state.content.seo.batch_update_category_link().await?;
    ok(())
}

/// `POST /adminapi/setting/seo/batchUpdateProductLink`：商品链接批量更新。
///
/// 对应 Java `SeoController.batchUpdateProductLink()` →
/// `SeoServiceImpl#generateAndUpdateProductSeoIdentification`（`@Async`）。
///
/// **未迁移**：依赖翻译服务，恒定返回业务码 1001。
async fn batch_update_product_link(State(state): State<AdminState>) -> ApiResult<()> {
    state.content.seo.batch_update_product_link().await?;
    ok(())
}
