//! 多语言业务翻译服务（lang::translations）。
//!
//! Java 来源：
//! - `com.tigshop.adminapi.controller.lang.TranslationsController`
//!   的 `getTranslations` / `createTranslations` 两个端点
//! - `com.tigshop.service.lang.impl.TranslationsDataServiceImpl#getTranslations`
//! - `com.tigshop.service.lang.impl.TranslationsServiceImpl#createTranslations`
//!
//! # 未迁移 / 偏差（如实标注）
//!
//! - Java `createTranslations` 落库后还会把译文写 Redis 缓存、并在图片类
//!   （dataType=7/8 且原文为图片 URL）双写 `image_i18n`，随后
//!   `updateTranslation()` 触发前台缓存刷新；Rust 侧 **`image_i18n` 双写已接入**
//!   （见 [`image_localization_row`]），Redis 缓存与前台缓存刷新仍未接入
//!   （无 Redis 依赖，不影响管理端读写）。
//! - `translationKey = md5(translationName)`：Java `SecureUtil.md5`
//!   为小写十六进制，本实现等价产出。
//! - `translation_source` 语义按 Java：仅 `dataType == 7`（商品图片）时
//!   持久化，item 级优先于 param 级，缺省 `1`（AI 翻译）。

use std::sync::Arc;

use md5::{Digest, Md5};

use tigshop_common::utils::now_seconds;

use tigshop_core::entities::{ImageI18n, TranslationsData};
use tigshop_core::models::lang::locales::LocalesVO;
use tigshop_core::models::lang::translations::{
    MultipleTranslationDTO, TranslationsBatchParam, TranslationsCreateParam, TranslationsDataVO,
    TranslationsDetailVO, TranslationsGetDTO, TranslationsListQuery, TranslationsVO,
    TranslationTextDTO, TranslationTextVO, DATA_TYPE_IMAGE_TITLE, DATA_TYPE_SPEC_IMAGE,
    DEFAULT_TRANSLATION_SOURCE,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

/// 翻译服务（挂载于 `AdminState.lang.translations`）。
pub struct TranslationsService {
    repos: Arc<Repositories>,
}

impl TranslationsService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 仓储聚合句柄（`lang::Services` 的 sibling 服务组合构造用）。
    #[must_use]
    pub fn repos_clone(&self) -> Arc<Repositories> {
        self.repos.clone()
    }

    /// 查询业务翻译（Java `TranslationsDataServiceImpl#getTranslations`）。
    ///
    /// - `dataId > 0`：按 `(data_type, data_id)` 查；
    /// - 否则按 `(data_type, translation_name)` 查
    ///   （Java 注释：`translations_data.data_id` 可能为空，优先按名查）。
    ///
    /// 无命中时返回空 `items`（`translationName` 为 `None`），
    /// 与 Java「空列表 + 不 setName」一致。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn get_translations(&self, dto: &TranslationsGetDTO) -> Result<TranslationsDetailVO> {
        let data_type = dto.data_type.unwrap_or(0);
        let data_id = dto.data_id.unwrap_or(0);
        let rows = if data_id > 0 {
            self.repos.lang.translations.find_by_data_id(data_type, data_id).await?
        } else {
            match dto.translation_name.as_deref() {
                Some(name) if !name.is_empty() => {
                    self.repos.lang.translations.find_by_name(data_type, name).await?
                }
                _ => Vec::new(),
            }
        };
        let items: Vec<TranslationsDataVO> = rows
            .iter()
            .map(|r| TranslationsDataVO {
                id: Some(r.id),
                data_id: r.data_id,
                data_type: r.data_type,
                locale_id: r.locale_id,
                translation_key: r.translation_key.clone(),
                translation_name: r.translation_name.clone(),
                translation_value: r.translation_value.clone(),
                translation_source: r.translation_source,
            })
            .collect();
        let translation_name = items
            .first()
            .and_then(|i| i.translation_name.clone())
            .or_else(|| dto.translation_name.clone());
        Ok(TranslationsDetailVO {
            id: Some(data_id),
            data_type: Some(data_type),
            translation_name,
            items,
        })
    }

    /// 创建/更新业务翻译（Java `TranslationsServiceImpl#createTranslations`）。
    ///
    /// 按 `(translationKey = md5(translationName), dataType, localeId)`
    /// 幂等 upsert：命中则仅更新 `translation_name` / `translation_value` /
    /// `data_id`（及图片类的 `translation_source`），不触碰同 key 其它语言；
    /// 未命中则插入。`localeId` 为空的 item 跳过（Java 原样）。
    ///
    /// # Errors
    /// `translation_name` 缺失 → `Validation`；数据库错误 → `Error::Database`。
    pub async fn create_translations(&self, param: &TranslationsCreateParam) -> Result<()> {
        let translation_name = param
            .translation_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| Error::Validation("translationName不能为空".into()))?;
        let data_type = param.data_type.unwrap_or(0);
        let translation_key = md5_hex(translation_name);
        // 仅图片类持久化 translation_source（Java handleSource 分支）
        let handle_source = data_type == DATA_TYPE_IMAGE_TITLE;

        for item in &param.items {
            let Some(locale_id) = item.locale_id else {
                continue;
            };
            let existing = self
                .repos
                .lang
                .translations
                .find_by_key_type_locale(&translation_key, data_type, locale_id)
                .await?;
            let persist_source = if handle_source {
                Some(
                    item.translation_source
                        .or(param.translation_source)
                        .unwrap_or(DEFAULT_TRANSLATION_SOURCE),
                )
            } else {
                None
            };
            match existing {
                Some(mut row) => {
                    row.translation_name = Some(translation_name.to_string());
                    row.translation_value = item.translation_value.clone();
                    row.data_id = param.data_id;
                    if let Some(source) = persist_source {
                        row.translation_source = Some(source);
                    }
                    self.repos.lang.translations.update(&row).await?;
                }
                None => {
                    let row = TranslationsData {
                        id: 0,
                        locale_id: Some(locale_id),
                        translation_name: Some(translation_name.to_string()),
                        translation_key: Some(translation_key.clone()),
                        translation_value: item.translation_value.clone(),
                        data_type: Some(data_type),
                        data_id: param.data_id,
                        translation_source: persist_source,
                    };
                    self.repos.lang.translations.insert(&row).await?;
                }
            }
            // 图片类译文（dataType 7 商品图 / 8 规格图）额外双写 `image_i18n`：
            // 前台按语言替换图片读的就是这张表。Java 在此之后还会刷 Redis 与
            // 前台缓存，Rust 未接缓存层（见模块头「未迁移 / 偏差」）。
            if let Some(image) = image_localization_row(
                data_type,
                translation_name,
                locale_id,
                item.translation_value.as_deref(),
            ) {
                self.repos.lang.image_i18n.upsert(&image).await?;
            }
        }
        Ok(())
    }

    // ——————————————————————————————————————————————
    // 管理端 CRUD（Java `TranslationsController` 的 list/detail/batch/del/
    // translation/multiple/batchCreateTranslations/getLocalesLimit3/config）
    // ——————————————————————————————————————————————

    fn index_repo(
        &self,
    ) -> &tigshop_infrastructure::db::repo::lang::translations::TranslationsIndexRepository {
        &self.repos.lang.translations_index
    }

    fn locales_service(&self) -> crate::lang::locales::LocalesService {
        crate::lang::locales::LocalesService::new(self.repos.clone())
    }

    /// 翻译词条分页（Java `TranslationsServiceImpl#list`）。
    ///
    /// 平台侧（无租户上下文）查 `shop_id = 0` 不强制；每行按
    /// `localeIds` 补行内译文列。
    pub async fn list(
        &self,
        q: &TranslationsListQuery,
    ) -> Result<PageResult<TranslationsVO>> {
        let (page, size) = q.page_params();
        let name_like = q
            .translation_name
            .as_deref()
            .filter(|s| !s.is_empty());
        let (total, rows) = self
            .index_repo()
            .paginate(name_like, q.data_type, "id DESC", size, (page - 1) * size)
            .await?;
        let locale_ids = q.locale_id_list();
        let mut list = Vec::with_capacity(rows.len());
        for row in &rows {
            let items = if locale_ids.is_empty() {
                Vec::new()
            } else if let Some(name) = row.translation_name.as_deref() {
                self.repos
                    .lang
                    .translations
                    .find_data_by_name_locales(row.data_type.unwrap_or(0), name, &locale_ids)
                    .await?
                    .iter()
                    .map(data_to_vo)
                    .collect()
            } else {
                Vec::new()
            };
            list.push(TranslationsVO {
                id: Some(row.id),
                data_type: row.data_type,
                translation_name: row.translation_name.clone(),
                translation_key: row.translation_key.clone(),
                shop_id: Some(row.shop_id),
                items,
            });
        }
        Ok(PageResult::new(
            total,
            list,
            &PageQuery {
                page,
                page_size: size,
            },
        ))
    }

    /// 翻译词条详情（Java `detail`：`translations` 行 + 全量译文 items）。
    pub async fn detail(&self, id: i32) -> Result<Option<TranslationsDetailVO>> {
        let Some(row) = self.index_repo().find_by_id(id).await? else {
            return Ok(None);
        };
        let data_type = row.data_type.unwrap_or(0);
        let items = match row.translation_name.as_deref() {
            Some(name) => self
                .repos
                .lang
                .translations
                .find_by_name(data_type, name)
                .await?
                .iter()
                .map(data_to_vo)
                .collect(),
            None => Vec::new(),
        };
        Ok(Some(TranslationsDetailVO {
            // Java `detail` 把词条 id 塞进 `TranslationsDetailVO.id`
            id: Some(row.id),
            data_type: Some(data_type),
            translation_name: row.translation_name.clone(),
            items,
        }))
    }

    /// 批量操作（Java `batch`：`type=del` 删词条 + 联动清译文）。
    pub async fn batch(&self, param: &TranslationsBatchParam) -> Result<()> {
        let ids = param.ids.clone().unwrap_or_default();
        if !matches!(param.r#type.as_deref(), Some("del")) || ids.is_empty() {
            return Ok(());
        }
        self.index_repo().delete_by_ids(&ids).await?;
        // Java：删除词条后按 data_id（= 词条 id）清理 translations_data；
        // Redis 翻译缓存回写未迁移（Rust 无 Redis）。
        self.repos.lang.translations.delete_data_by_data_ids(&ids).await?;
        Ok(())
    }

    /// 单条删除（Java `del`：等价 batch(type=del, ids=[id])）。
    pub async fn del(&self, id: i32) -> Result<()> {
        self.batch(&TranslationsBatchParam {
            ids: Some(vec![id]),
            r#type: Some("del".into()),
        })
        .await
    }

    /// 非中文启用语言前 3 条（Java `getLocalesLimit3`）。
    pub async fn get_locales_limit3(&self) -> Result<Vec<LocalesVO>> {
        self.locales_service().get_locales_limit3().await
    }

    /// 单条机器翻译（Java `translation` → 火山 `TranslateText`）。
    ///
    /// 无凭据 / 翻译失败时**原样返回原文**（见 [`machine_translate`]）。
    pub async fn translation(&self, dto: &TranslationTextDTO) -> Result<TranslationTextVO> {
        let code = dto.code.as_deref().unwrap_or("en");
        let text = dto.text.as_deref().unwrap_or_default();
        let translated = machine_translate(&self.repos, code, text).await?;
        Ok(TranslationTextVO {
            // 未接语言检测（Java 取火山回包的 DetectedSourceLanguage）
            detected_source_language: None,
            translation: Some(translated),
        })
    }

    /// 一键翻译（Java `multiple`：分批读词条 → 逐条机器翻译 →
    /// 按语言落 `translations_data`）。
    ///
    /// 无火山凭据时**降级为 no-op** 并返回 `false`（不报错、不落库），
    /// 对应任务约定「批量机器翻译无凭据原样返回」。
    pub async fn multiple(&self, dto: &MultipleTranslationDTO) -> Result<bool> {
        let Some(locales_id) = dto.locales_id else {
            return Ok(false);
        };
        let data_type = dto.data_type.unwrap_or(0);
        let page = dto.page.unwrap_or(1).max(1);
        let size = dto.size.unwrap_or(15).clamp(1, 100);
        // 仅词条类（0 页面 / 1 接口）支持一键翻译；商品等业务数据类型未迁移。
        if data_type != 0 && data_type != 1 {
            return Ok(false);
        }
        let rows = self
            .index_repo()
            .find_page_for_translate(data_type, &dto.ids, size, (page - 1) * size)
            .await?;
        if rows.is_empty() {
            return Ok(false);
        }
        // 先探测凭据（缺失 → 整体 no-op，不逐条报错刷屏）
        if translate_credentials(&self.repos).await.is_err() {
            tracing::info!("multiple：未配置火山翻译凭据，no-op");
            return Ok(false);
        }
        let mut count = 0u32;
        for row in &rows {
            let Some(name) = row.translation_name.as_deref() else {
                continue;
            };
            let translated = machine_translate(&self.repos, "en", name).await?;
            let key = md5_hex(name);
            match self
                .repos
                .lang
                .translations
                .find_by_key_type_locale(&key, data_type, locales_id)
                .await?
            {
                Some(mut existing) => {
                    existing.translation_value = Some(translated);
                    self.repos.lang.translations.update(&existing).await?;
                }
                None => {
                    self.repos
                        .lang
                        .translations
                        .insert(&TranslationsData {
                            id: 0,
                            locale_id: Some(locales_id),
                            translation_name: Some(name.to_string()),
                            translation_key: Some(key),
                            translation_value: Some(translated),
                            data_type: Some(data_type),
                            data_id: Some(row.id),
                            translation_source: None,
                        })
                        .await?;
                }
            }
            count += 1;
        }
        let _ = count;
        Ok(true)
    }

    /// 批量保存业务翻译（Java `batchCreateTranslations`：
    /// 逐条 `createTranslations`，汇总成功/失败数）。
    pub async fn batch_create_translations(
        &self,
        list: &[TranslationsCreateParam],
    ) -> Result<serde_json::Value> {
        let mut success = 0u32;
        let mut fail = 0u32;
        let mut errors: Vec<String> = Vec::new();
        for (i, param) in list.iter().enumerate() {
            match self.create_translations(param).await {
                Ok(()) => success += 1,
                Err(e) => {
                    fail += 1;
                    errors.push(format!("第{}条: {}", i + 1, e));
                }
            }
        }
        Ok(serde_json::json!({
            "successCount": success,
            "failCount": fail,
            "errors": errors,
        }))
    }

    /// 翻译服务配置（b2b2b 5.8.57 前端新增；Java `TranslationsController`
    /// 无 `config` 端点）。
    ///
    /// 返回火山引擎翻译凭据的配置情况（值脱敏，只报是否已配置），
    /// 供管理端「翻译设置」页展示。
    pub async fn config(&self) -> Result<serde_json::Value> {
        let creds = translate_credentials(&self.repos).await;
        Ok(serde_json::json!({
            // 无凭据 → false（前端据此隐藏机器翻译入口）
            "translateEnabled": creds.is_ok(),
        }))
    }
}

/// `TranslationsData` 行 → 行内 VO。
fn data_to_vo(r: &TranslationsData) -> TranslationsDataVO {
    TranslationsDataVO {
        id: Some(r.id),
        data_id: r.data_id,
        data_type: r.data_type,
        locale_id: r.locale_id,
        translation_key: r.translation_key.clone(),
        translation_name: r.translation_name.clone(),
        translation_value: r.translation_value.clone(),
        translation_source: r.translation_source,
    }
}

/// 探测火山翻译凭据（复用 `content::volcengine_translate` 客户端）。
async fn translate_credentials(
    repos: &tigshop_infrastructure::db::Repositories,
) -> Result<()> {
    crate::content::volcengine_translate::VolcengineTranslateClient::from_repos(repos)
        .await
        .map(|_| ())
}

/// 机器翻译单条文本（无凭据 / 失败 → **原样返回原文**）。
///
/// Java 调火山 `TranslateText`；凭据缺失或上游失败时按任务约定降级，
/// 不向前端抛错（管理端翻译框显示原文即「翻译不可用」）。
pub async fn machine_translate(
    repos: &tigshop_infrastructure::db::Repositories,
    code: &str,
    text: &str,
) -> Result<String> {
    if text.is_empty() {
        return Ok(String::new());
    }
    let client = match crate::content::volcengine_translate::VolcengineTranslateClient::from_repos(repos).await {
        Ok(c) => c,
        Err(e) => {
            tracing::info!("machine_translate：无凭据，原样返回（{e}）");
            return Ok(text.to_string());
        }
    };
    match client.translate_text(code, text).await {
        Ok(translated) => Ok(translated),
        Err(e) => {
            tracing::warn!("machine_translate：翻译失败，原样返回（{e}）");
            Ok(text.to_string())
        }
    }
}

/// 小写十六进制 MD5（Java `SecureUtil.md5` 等价）。
#[must_use]
pub fn md5_hex(input: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// 图片类数据类型（商品图 7 / 规格图 8）—— 这类「译文」本身就是图片 URL。
#[must_use]
pub fn is_image_data_type(data_type: i32) -> bool {
    data_type == DATA_TYPE_IMAGE_TITLE || data_type == DATA_TYPE_SPEC_IMAGE
}

/// 是否为绝对图片地址（`http://` / `https://` 前缀，忽略大小写与首尾空格）。
#[must_use]
pub fn looks_like_image_url(value: &str) -> bool {
    let v = value.trim().to_ascii_lowercase();
    v.starts_with("http://") || v.starts_with("https://")
}

/// 构造一条 `image_i18n`（图片本地化）记录。
///
/// 返回 `None` 表示这次译文不该写图片表：不是图片数据类型、原文不是绝对
/// URL，或译文为空（= 还没翻译）。
///
/// # 偏差（推断，需真实数据回归核对）
///
/// Java 注释只写「dataType=7/8 且原文为图片 URL」。Rust 的 URL 判定放宽为
/// 「`http(s)://` 开头 + 译文非空」，不校验扩展名 —— dataType 已经声明了
/// 图片语义，再按 `.jpg/.png` 过滤会漏掉 CDN 上的无后缀图片地址。
#[must_use]
pub fn image_localization_row(
    data_type: i32,
    original_url: &str,
    locale_id: i32,
    localized_url: Option<&str>,
) -> Option<ImageI18n> {
    if !is_image_data_type(data_type) {
        return None;
    }
    let localized = localized_url.map(str::trim).filter(|s| !s.is_empty())?;
    if !looks_like_image_url(original_url) {
        return None;
    }
    Some(ImageI18n {
        id: 0,
        locale_id,
        data_type,
        original_key: md5_hex(original_url),
        original_url: original_url.to_string(),
        localized_url: localized.to_string(),
        add_time: Some(i32::try_from(now_seconds()).unwrap_or(0)),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn md5_hex_matches_java_secure_util() {
        // `SecureUtil.md5("abc")` = 900150983cd24fb0d6963f7d28e17f72
        assert_eq!(md5_hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(md5_hex(""), "d41d8cd98f00b204e9800998ecf8427e");
    }

    #[test]
    fn image_data_types_are_7_and_8() {
        assert!(is_image_data_type(DATA_TYPE_IMAGE_TITLE));
        assert!(is_image_data_type(DATA_TYPE_SPEC_IMAGE));
        assert!(!is_image_data_type(0));
        assert!(!is_image_data_type(1));
    }

    #[test]
    fn image_url_detection_needs_absolute_http_url() {
        assert!(looks_like_image_url("https://cdn.example.com/a/b.png"));
        assert!(looks_like_image_url("  HTTP://cdn.example.com/a.png "));
        assert!(!looks_like_image_url("/static/upload/a.png"));
        assert!(!looks_like_image_url("red shoes"));
        assert!(!looks_like_image_url(""));
    }

    #[test]
    fn image_row_is_built_for_product_images_only() {
        let url = "https://cdn.example.com/goods/1001.jpg";
        let row = image_localization_row(DATA_TYPE_IMAGE_TITLE, url, 2, Some("https://cdn.example.com/goods/1001-en.jpg"))
            .expect("图片类译文应写 image_i18n");
        assert_eq!(row.locale_id, 2);
        assert_eq!(row.data_type, DATA_TYPE_IMAGE_TITLE);
        assert_eq!(row.original_key, md5_hex(url));
        assert_eq!(row.original_url, url);
        assert_eq!(row.localized_url, "https://cdn.example.com/goods/1001-en.jpg");
        assert!(row.add_time.unwrap_or(0) > 0);

        // 规格图同样写
        assert!(image_localization_row(
            DATA_TYPE_SPEC_IMAGE,
            url,
            3,
            Some("https://cdn.example.com/goods/1001-fr.jpg")
        )
        .is_some());
    }

    #[test]
    fn image_row_is_skipped_for_text_and_empty_values() {
        let url = "https://cdn.example.com/goods/1001.jpg";
        // 文字类译文（词条 / 接口）不写图片表
        assert!(image_localization_row(0, "Red shoes", 2, Some("红色鞋子")).is_none());
        assert!(image_localization_row(1, "Red shoes", 2, Some("红色鞋子")).is_none());
        // 译文为空 = 还没翻译
        assert!(image_localization_row(DATA_TYPE_IMAGE_TITLE, url, 2, None).is_none());
        assert!(image_localization_row(DATA_TYPE_IMAGE_TITLE, url, 2, Some("   ")).is_none());
        // 原文不是绝对地址
        assert!(image_localization_row(DATA_TYPE_IMAGE_TITLE, "/static/a.jpg", 2, Some(url)).is_none());
    }
}
