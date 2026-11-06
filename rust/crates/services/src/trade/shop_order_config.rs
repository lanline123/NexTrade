//! 店铺订单配置域服务（trade::shop_order_config）。
//!
//! 对应 Java `OrderConfigServiceImpl#shopOrderConfigDetail/saveOrderConfig`：
//! 详情读 `order_config.data` 并解析为 JSON；保存时按 `(shop_id, code)` upsert。

use std::sync::Arc;

use tigshop_core::models::trade::shop_order_config::{
    build_config_json, parse_config_json, validate_detail, OrderConfigDTO,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::trade::shop_order_config::ShopOrderConfigRepository;
use tigshop_infrastructure::db::Repositories;

/// 店铺订单配置域服务。
pub struct ShopOrderConfigService {
    repos: Arc<Repositories>,
}

impl ShopOrderConfigService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.trade.shop_order_config`）。
    #[must_use]
    pub fn repo(&self) -> &ShopOrderConfigRepository {
        &self.repos.trade.shop_order_config
    }

    /// 配置详情（Java `shopOrderConfigDetail`：无记录/无 data → null）。
    pub async fn detail(
        &self,
        shop_id: Option<i32>,
        code: Option<&str>,
    ) -> Result<Option<serde_json::Value>> {
        validate_detail(shop_id, code).map_err(Error::Validation)?;
        let shop_id = shop_id.unwrap_or(0);
        let code = code.unwrap_or("");
        let row = self.repo().find_config(shop_id, code).await?;
        Ok(parse_config_json(row.as_ref().and_then(|(_, data)| data.as_deref())))
    }

    /// 保存配置（Java `saveOrderConfig`：不存在则插入、存在则更新 data）。
    pub async fn save(&self, dto: &OrderConfigDTO) -> Result<()> {
        validate_detail(dto.shop_id, dto.code.as_deref()).map_err(Error::Validation)?;
        let shop_id = dto.shop_id.unwrap_or(0);
        let code = dto.code.clone().unwrap_or_default();
        let data = build_config_json(dto);
        let repo = self.repo();
        match repo.find_config(shop_id, &code).await? {
            Some((id, _)) => {
                repo.update_config(id, &data).await?;
            }
            None => {
                repo.insert_config(shop_id, &code, &data).await?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_reuses_model() {
        assert!(validate_detail(None, None).is_err());
    }

    #[test]
    fn json_round_trip() {
        let dto = OrderConfigDTO {
            code: Some("c".into()),
            shop_id: Some(1),
            ..Default::default()
        };
        let raw = build_config_json(&dto);
        assert_eq!(parse_config_json(Some(&raw)).unwrap()["code"], "c");
    }
}
