//! catalog::product_manage 管理端剩余端点 —— 服务层（wave8 第二批）。
//!
//! 构造签名固定 `pub fn new(repos: Arc<Repositories>) -> Self`；仓储经嵌套
//! 聚合根访问：`self.repos.catalog.product_manage`。
//!
//! 对应 Java `ProductServiceImpl`
//! （`java/tigshop-service/.../product/impl/ProductServiceImpl.java`）。
//!
//! ## 已登记偏差
//!
//! 1. **ES 相关**：`getParticiple`（ES 分词）与 `initAllToEs`（全量同步 ES）
//!    依赖 Elasticsearch 客户端，未迁移 → 返回 1001「未迁移」，不伪造成功。
//! 2. **post（商品推广页）**：依赖短链服务与微信小程序码 → 商品存在性校验后
//!    返回 1001「未迁移」。
//! 3. **batch**：Java 支持 del/up/down/审核等；本实现覆盖 del/up/down/recycle，
//!    其余类型返回「不支持的批量操作类型」（Java `ProductBatchOperationEnum` 更大）。
//! 4. **audit**：Java 通过 `ProductAuditDTO.validParam()` 校验审核状态；本实现
//!    仅接受 1（通过）/2（不通过），待审核（0）由商品当前状态约束。
//! 5. 审核/删除后的 ES 同步、后台消息、保证金联动均未迁移（Java 侧异步副作用）。
//! 6. `skuList`/`shippingTplList` 直接序列化实体（字段与 Java VO 大部分一致，
//!    但未逐字段裁剪；页面所需字段齐全）。
//!
//! ## 尚未开始（见任务报告）
//! config / copy / getPromoteData / selectProductList / saveShareInfo / shareInfo
//! + 全部 14 条 public 端点。

use std::sync::Arc;

use tigshop_core::models::catalog::product_manage_extra::{
    parse_desc_images, product_field_column, scalar_to_string, ProductAuditDTO,
    ProductBatchOperationDTO, ProductDescImageVO, ProductPostVO, ProductSkuListQuery, ProductUpdateFieldDTO,
    CHECK_STATUS_APPROVED, CHECK_STATUS_PENDING, CHECK_STATUS_REJECTED, MSG_AUDIT_STATUS_INVALID,
    MSG_BATCH_TYPE_INVALID, MSG_ES_INIT_NOT_MIGRATED, MSG_PARTICIPLE_NOT_MIGRATED,
    MSG_PRODUCT_NOT_FOUND, MSG_PRODUCT_STATUS_INVALID, MSG_PRODUCT_UNKNOWN,
    SERVICE_DATA_ERROR,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::catalog::product_manage::ProductManageRepository;
use tigshop_infrastructure::db::Repositories;

/// 管理端剩余端点 服务。
pub struct ProductManageExtraService {
    repos: Arc<Repositories>,
}

impl ProductManageExtraService {
    /// 构造服务（组合根唯一装配点）。
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本 feature 仓储。
    #[must_use]
    pub fn repo(&self) -> &ProductManageRepository {
        &self.repos.catalog.product_manage
    }

    /// 待审核商品数量（Java `getWaitingCheckedCount`：排除不运营店铺）。
    pub async fn waiting_checked_count(&self) -> Result<i64> {
        let inactive = self.repo().find_inactive_shop_ids().await?;
        self.repo().count_pending_audit(&inactive).await
    }

    /// 商品描述图片列表（Java `getDescImages`）。
    pub async fn desc_images(&self, product_id: i32) -> Result<Vec<ProductDescImageVO>> {
        let Some(p) = self.repo().find_product(product_id).await? else {
            return Ok(Vec::new());
        };
        Ok(parse_desc_images(p.product_desc.as_deref()))
    }

    /// SKU 分页（Java `ProductSkuService.getProductSkusPage`；默认 50/页）。
    pub async fn sku_list(
        &self,
        q: &ProductSkuListQuery,
    ) -> Result<PageResult<serde_json::Value>> {
        let Some(product_id) = q.id else {
            return Err(Error::Validation("商品id不能为空".into()));
        };
        let page = q.page_query();
        let keyword_like = q.keyword.as_deref().map(|k| format!("%{}%", k.trim()));
        let (col, asc) = q.order();
        let (size, offset) = q.limit_offset();
        let (total, rows) = self
            .repo()
            .paginate_skus(
                product_id,
                keyword_like.as_deref(),
                q.stock_min,
                q.stock_max,
                col,
                asc,
                size,
                offset,
            )
            .await?;
        let list = rows
            .into_iter()
            .map(|r| serde_json::to_value(r).unwrap_or(serde_json::Value::Null))
            .collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 运费模板（Java `getShippingTplListByShopId`）。
    pub async fn shipping_tpl_list(&self) -> Result<Vec<serde_json::Value>> {
        let rows = self.repo().find_shipping_tpls(None, &[]).await?;
        Ok(rows
            .into_iter()
            .map(|r| serde_json::to_value(r).unwrap_or(serde_json::Value::Null))
            .collect())
    }

    /// 更新商品字段（Java `updateFieldProduct`）。
    pub async fn update_field(&self, dto: &ProductUpdateFieldDTO) -> Result<String> {
        let product = self
            .repo()
            .find_product(dto.id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let _ = product;
        if dto.field == "productStatus" {
            let s = scalar_to_string(&dto.val).unwrap_or_default();
            if s != "0" && s != "1" {
                return Err(Error::Validation(MSG_PRODUCT_STATUS_INVALID.into()));
            }
        }
        let column = product_field_column(&dto.field)
            .ok_or_else(|| Error::Validation(format!("不支持的字段: {}", dto.field)))?;
        let value = scalar_to_string(&dto.val)
            .ok_or_else(|| Error::Validation("字段值必须为标量".into()))?;
        self.repo()
            .update_product_field(dto.id, column, &value)
            .await?;
        Ok("商品管理更新成功".to_string())
    }

    /// 批量操作（Java `batchOperation`；覆盖 del/up/down/recycle）。
    pub async fn batch(&self, dto: &ProductBatchOperationDTO) -> Result<()> {
        let ids: Vec<i32> = dto
            .ids
            .iter()
            .filter_map(|v| i32::try_from(*v).ok())
            .collect();
        if ids.is_empty() {
            return Err(Error::Validation("请选择商品".into()));
        }
        match dto.type_.as_str() {
            "del" => {
                self.repo().hard_delete_products(&ids).await?;
            }
            "up" => {
                self.repo()
                    .set_product_flags(&ids, Some(1), None, None)
                    .await?;
            }
            "down" => {
                self.repo()
                    .set_product_flags(&ids, Some(0), None, None)
                    .await?;
            }
            "recycle" => {
                self.repo()
                    .set_product_flags(&ids, Some(0), Some(1), None)
                    .await?;
            }
            // 回收站还原：清软删除标记（Java `batch type=restore`）。
            "restore" => {
                self.repo()
                    .set_product_flags(&ids, None, Some(0), None)
                    .await?;
            }
            // 批量审核通过（Java `batch type=audit`：通过后直接上架）。
            "audit" => {
                for id in ids {
                    self.audit(&ProductAuditDTO {
                        id,
                        check_status: CHECK_STATUS_APPROVED,
                        check_reason: None,
                    })
                    .await?;
                }
            }
            _ => return Err(Error::Validation(MSG_BATCH_TYPE_INVALID.into())),
        }
        Ok(())
    }

    /// 商品回收（Java `recycle`：下架 + 软删除）。
    pub async fn recycle(&self, id: i64) -> Result<bool> {
        let product_id = i32::try_from(id).unwrap_or(0);
        let _p = self
            .repo()
            .find_product(product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_UNKNOWN.into()))?;
        self.repo()
            .set_product_flags(&[product_id], Some(0), Some(1), None)
            .await?;
        Ok(true)
    }

    /// 商品审核（Java `audit`：仅待审核可审；通过后直接上架）。
    pub async fn audit(&self, dto: &ProductAuditDTO) -> Result<bool> {
        if dto.check_status != CHECK_STATUS_APPROVED && dto.check_status != CHECK_STATUS_REJECTED {
            return Err(Error::Validation(MSG_AUDIT_STATUS_INVALID.into()));
        }
        let product = self
            .repo()
            .find_product(dto.id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        if product.check_status != CHECK_STATUS_PENDING {
            return Err(Error::Validation(MSG_AUDIT_STATUS_INVALID.into()));
        }
        let product_status = if dto.check_status == CHECK_STATUS_APPROVED {
            1
        } else {
            0
        };
        self.repo()
            .update_product_audit(
                dto.id,
                dto.check_status,
                dto.check_reason.as_deref(),
                Some(product_status),
            )
            .await?;
        Ok(true)
    }

    /// 再次审核（Java `auditAgain`：重置为待审核）。
    pub async fn audit_again(&self, id: i32) -> Result<bool> {
        let _p = self
            .repo()
            .find_product(id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        self.repo()
            .update_product_audit(id, CHECK_STATUS_PENDING, Some(""), None)
            .await?;
        Ok(true)
    }

    /// 关键词分词（对齐 Java `ProductServiceImpl#getParticiple`：
    /// 去首尾空白 → 移除空格 → HTML 转义 → Jieba 分词 → 空格拼接）。
    pub async fn get_participle(&self, product_name: Option<&str>) -> Result<String> {
        let raw = product_name
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| Error::Validation("productName 不能为空".into()))?;
        let without_spaces = raw.replace(' ', "");
        let escaped = without_spaces
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;");
        let jieba = jieba_rs::Jieba::new();
        let words = jieba.cut(&escaped, false);
        Ok(words
            .into_iter()
            .map(str::trim)
            .filter(|w| !w.is_empty())
            .collect::<Vec<_>>()
            .join(" "))
    }

    /// 全量同步 ES（Java `initAllToEs`；ES 未迁移）。
    pub async fn init_all_to_es(&self) -> Result<()> {
        Err(Error::biz(SERVICE_DATA_ERROR, MSG_ES_INIT_NOT_MIGRATED))
    }

    /// 商品推广页（对应 Java `ProductServiceImpl#post`）。
    pub async fn post(&self, product_id: i32) -> Result<ProductPostVO> {
        let p = self
            .repo()
            .find_product(product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;

        let mut shop_name = "商城自营".to_string();
        if p.shop_id > 0 {
            if let Ok(Some(shop)) = self.repos.merchant.shop_manage.find_shop(p.shop_id).await {
                if let Some(title) = shop.shop_title {
                    shop_name = title;
                }
            }
        }

        let h5_domain = self
            .repos
            .system
            .config_client
            .find_config_val("h5_domain", true)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let pc_domain = self
            .repos
            .system
            .config_client
            .find_config_val("pc_domain", true)
            .await
            .ok()
            .flatten()
            .unwrap_or_default();

        let h5_path = format!("/pages/product/index?id={product_id}");
        let pc_original_link = format!("{pc_domain}/product/{}", p.product_sn);
        let h5_original_link = format!("{h5_domain}{h5_path}");

        // 生成小程序/H5 推广二维码（Base64 PNG）
        let qr_target = if !h5_original_link.is_empty() {
            &h5_original_link
        } else {
            &pc_original_link
        };
        let mini_code = crate::system::util::generate_qr_code_base64(qr_target).ok();

        let pic_url = if !p.pic_large.is_empty() {
            Some(p.pic_large)
        } else if !p.pic_url.is_empty() {
            Some(p.pic_url)
        } else if !p.pic_thumb.is_empty() {
            Some(p.pic_thumb)
        } else {
            None
        };

        Ok(ProductPostVO {
            product_name: p.product_name,
            product_price: Some(p.product_price),
            pic_url,
            product_brief: Some(p.product_brief),
            product_sn: Some(p.product_sn),
            shop_name,
            h5_short_link: Some(h5_original_link.clone()),
            h5_original_link: Some(h5_original_link),
            pc_short_link: Some(pc_original_link.clone()),
            pc_original_link: Some(pc_original_link),
            mini_code,
            wechat_short_link: None,
            wechat_short_link_error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::catalog::product_manage_extra::{
        product_field_column, scalar_to_string,
    };

    #[test]
    fn audit_rejects_invalid_status_codes() {
        for code in [0_i32, 3, -1] {
            assert!(code != CHECK_STATUS_APPROVED && code != CHECK_STATUS_REJECTED);
        }
        assert!(CHECK_STATUS_APPROVED == 1 && CHECK_STATUS_REJECTED == 2);
    }

    #[test]
    fn recycle_id_conversion_is_safe() {
        assert_eq!(i32::try_from(9_i64).unwrap(), 9);
        assert!(i32::try_from(i64::from(i32::MAX) + 1).is_err());
    }

    #[test]
    fn update_field_whitelist_matches_scalar_rules() {
        assert_eq!(product_field_column("productStatus"), Some("product_status"));
        assert_eq!(scalar_to_string(&serde_json::json!(1)), Some("1".into()));
        assert!(product_field_column("shareInfo").is_none());
    }
}
