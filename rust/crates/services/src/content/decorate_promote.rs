//! 装修推广短链域服务（content::decorate_promote）。
//!
//! `generateShortLink`：校验长链接 → 复用已存在短码或新建 `short_url` →
//! 拼接 config `h5Domain` 生成短链。域名为空时返回相对路径（偏差已记录）。

use std::sync::Arc;

use tigshop_common::utils::now_seconds;
use tigshop_core::models::content::decorate_promote::{
    build_short_link, short_code_for, validate_url, GenerateShortLinkDTO, CONFIG_H5_DOMAIN,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::content::decorate_promote::DecoratePromoteRepository;
use tigshop_infrastructure::db::Repositories;

/// 推广短链服务。
pub struct DecoratePromoteService {
    repos: Arc<Repositories>,
}

impl DecoratePromoteService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.content.decorate_promote`）。
    #[must_use]
    pub fn repo(&self) -> &DecoratePromoteRepository {
        &self.repos.content.decorate_promote
    }

    /// 生成短链（Java `generateShortLink`）。
    pub async fn generate_short_link(&self, dto: &GenerateShortLinkDTO) -> Result<String> {
        let url = validate_url(dto.target_url()).map_err(Error::Validation)?;
        let link_type = dto.target_type();
        let repo = self.repo();
        let code = match repo.find_short_code(url, link_type).await? {
            Some(code) => code,
            None => {
                let code = short_code_for(url, link_type);
                repo.insert_short_url(&code, url, link_type, &now_seconds().to_string())
                    .await?;
                code
            }
        };
        let domain = repo.find_config_value(CONFIG_H5_DOMAIN).await?;
        Ok(build_short_link(domain.as_deref(), &code))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_required() {
        assert!(validate_url(None).is_err());
    }

    #[test]
    fn link_builder_reused() {
        assert_eq!(build_short_link(Some("https://h5.x"), "ab"), "https://h5.x/s/ab");
    }
}
