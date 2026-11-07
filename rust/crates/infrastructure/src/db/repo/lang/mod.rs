//! 多语言（lang）域仓储。

pub mod currency;
pub mod image_i18n;
pub mod locales;
pub mod locales_relation;
pub mod translations;

use crate::db::DbPool;

/// lang 域仓储集合（由组合根装配一次）。
#[derive(Clone)]
pub struct Repositories {
    pub translations: translations::TranslationsRepository,
    /// `translations` 词条主表（管理端 CRUD）。
    pub translations_index: translations::TranslationsIndexRepository,
    pub locales: locales::LocalesRepository,
    pub locales_lang: locales::LocalesLangRepository,
    pub currency: currency::CurrencyRepository,
    pub locales_relation: locales_relation::LocalesRelationRepository,
    /// 海外站图片本地化（`translations_data` 图片分支双写）。
    pub image_i18n: image_i18n::ImageI18nRepository,
}

impl Repositories {
    #[must_use]
    pub fn new(pool: DbPool) -> Self {
        Self {
            translations: translations::TranslationsRepository::new(pool.clone()),
            translations_index: translations::TranslationsIndexRepository::new(pool.clone()),
            locales: locales::LocalesRepository::new(pool.clone()),
            locales_lang: locales::LocalesLangRepository::new(pool.clone()),
            currency: currency::CurrencyRepository::new(pool.clone()),
            locales_relation: locales_relation::LocalesRelationRepository::new(pool.clone()),
            image_i18n: image_i18n::ImageI18nRepository::new(pool),
        }
    }
}
