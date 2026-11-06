//! 商户账户域服务（merchant::merchant_account）。
//!
//! 构造签名 `pub fn new(repos: Arc<Repositories>) -> Self`；仓储访问为**嵌套**命名：
//! `self.repos.merchant.merchant_account.<method>()`。
//!
//! 对应原 Java `com.tigshop.service.merchant.impl.MerchantAccountServiceImpl`。
//!
//! # 已实现
//! `list`（店铺过滤 + 提现方式白名单 + 排序）、`config`（账户类型字典）、`detail`
//! （含归属校验「数据不存在」）、`create`（店铺→商户覆盖 + 默认时间）、`update`
//! （只写非空字段）、`del`/`batch`（`BaseServiceImpl` 语义）。
//!
//! # 与 Java 的差异 / 未迁移
//! - 当前店铺来自 `x-shop-id` 请求头；Rust JWT 未签发 shop_id → 查询参数 `shopId` 兜底，
//!   缺省时按平台视角（不按店铺过滤；Java `getShopId()` 为 null 时同样只按类型过滤）。
//! - `list` 中 Java 会在 `shopId > 0` 时校验店铺/商户存在（「店铺不存在」/「商户不存在」），
//!   本实现同样校验。
//! - `detail` 的 `checkMerchantAuth`：管理员不存在时 Java 直接放行；本实现保持一致。
//! - Java `create` 用 `shopService.getById(shopId).getMerchantId()` 覆盖 `merchantId`，
//!   本实现同样以店铺所属商户为准（店铺不存在 → 「店铺不存在」）。

use std::sync::Arc;

use tigshop_common::utils::now_seconds;
use tigshop_core::models::merchant::merchant_account::{
    account_type_options, account_type_text, allowed_account_types, format_time,
    MerchantAccountCreateDTO, MerchantAccountListQuery, MerchantAccountUpdateDTO, MerchantAccountVO,
    DATA_NOT_EXIST, MERCHANT_NOT_EXIST, SERVICE_DATA_ERROR, SHOP_NOT_EXIST,
    WITHDRAWAL_RECEIPT_METHOD,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::merchant::merchant_account::MerchantAccountRepository;
use tigshop_infrastructure::db::Repositories;

/// 商户账户域服务。
pub struct MerchantAccountService {
    repos: Arc<Repositories>,
}

impl MerchantAccountService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    #[must_use]
    pub fn repo(&self) -> &MerchantAccountRepository {
        &self.repos.merchant.merchant_account
    }

    /// 账户分页（Java `list`）。
    ///
    /// # Errors
    /// 店铺/商户不存在 → 业务错误；数据库失败 → `Error::Database`。
    pub async fn list(
        &self,
        q: &MerchantAccountListQuery,
        shop_id: Option<i32>,
    ) -> Result<PageResult<MerchantAccountVO>> {
        if let Some(shop_id) = shop_id.filter(|s| *s > 0) {
            let merchant_id = self
                .repo()
                .shop_merchant_id(shop_id)
                .await?
                .ok_or_else(|| biz(SHOP_NOT_EXIST))?;
            if !self.repo().merchant_exists(merchant_id).await? {
                return Err(biz(MERCHANT_NOT_EXIST));
            }
        }
        let allowed = allowed_account_types(
            self.repo()
                .config_value(WITHDRAWAL_RECEIPT_METHOD)
                .await?
                .as_deref(),
        );
        let (page, size) = q.page_params();
        let (total, rows) = self.repo().paginate(shop_id, &allowed, q).await?;
        let list = rows
            .iter()
            .map(|r| MerchantAccountVO {
                account_type_text: account_type_text(r.account_type).to_string(),
                account_id: r.account_id,
                merchant_id: r.merchant_id,
                account_type: r.account_type,
                account_name: r.account_name.clone(),
                account_no: r.account_no.clone(),
                bank_name: r.bank_name.clone(),
                add_time: format_time(r.add_time),
                bank_branch: r.bank_branch.clone(),
                shop_id: r.shop_id,
            })
            .collect();
        Ok(PageResult::new(
            total,
            list,
            &PageQuery {
                page,
                page_size: size,
            },
        ))
    }

    /// 账户类型字典（Java `config`）。
    #[must_use]
    pub fn config(&self) -> serde_json::Value {
        account_type_options()
    }

    /// 账户详情（Java `detail` + `checkMerchantAuth`）。
    ///
    /// # Errors
    /// 账户不存在返回 `null` 语义（Java `detail` 对 null id 返回 null；账户不存在时
    /// `BeanUtils` 会 NPE，这里按「数据不存在」处理）；越权 → 「数据不存在」。
    pub async fn detail(
        &self,
        id: Option<i32>,
        admin_id: i32,
    ) -> Result<Option<MerchantAccountVO>> {
        let Some(id) = id else {
            return Ok(None);
        };
        let Some(row) = self.repo().find_by_id(id).await? else {
            return Ok(None);
        };
        // Java `checkMerchantAuth`：管理员存在且 merchant_id 不一致 → 「数据不存在」
        if let Some(admin_merchant_id) = self.repo().admin_merchant_id(admin_id).await? {
            if admin_merchant_id != row.merchant_id {
                return Err(biz(DATA_NOT_EXIST));
            }
        }
        Ok(Some(MerchantAccountVO {
            account_type_text: account_type_text(row.account_type).to_string(),
            account_id: row.account_id,
            merchant_id: row.merchant_id,
            account_type: row.account_type,
            account_name: row.account_name,
            account_no: row.account_no,
            bank_name: row.bank_name,
            add_time: format_time(row.add_time),
            bank_branch: row.bank_branch,
            shop_id: row.shop_id,
        }))
    }

    /// 创建账户（Java `create`：店铺→商户覆盖 + `addTime`）。
    ///
    /// # Errors
    /// 店铺不存在 → 「店铺不存在」；数据库失败 → `Error::Database`。
    pub async fn create(
        &self,
        dto: &MerchantAccountCreateDTO,
        shop_id: Option<i32>,
    ) -> Result<i32> {
        let shop_id = shop_id.filter(|s| *s > 0);
        let merchant_id = match shop_id {
            Some(shop_id) => self
                .repo()
                .shop_merchant_id(shop_id)
                .await?
                .ok_or_else(|| biz(SHOP_NOT_EXIST))?,
            None => dto.merchant_id.unwrap_or(0),
        };
        self.repo()
            .insert(
                merchant_id,
                dto.account_type.unwrap_or(0),
                dto.account_name.as_deref().unwrap_or(""),
                dto.account_no.as_deref().unwrap_or(""),
                dto.bank_name.as_deref().unwrap_or(""),
                i32::try_from(now_seconds()).unwrap_or(0),
                dto.bank_branch.as_deref(),
                shop_id.or(dto.shop_id),
            )
            .await
    }

    /// 更新账户（Java `update`：`updateById` 只写非空字段）。
    ///
    /// # Errors
    /// 主键缺失 → 「数据不存在」；数据库失败 → `Error::Database`。
    pub async fn update(
        &self,
        dto: &MerchantAccountUpdateDTO,
        shop_scope: Option<i32>,
    ) -> Result<()> {
        let id = dto.resolved_id().ok_or_else(|| biz(DATA_NOT_EXIST))?;
        // 多租户：店铺账号只能更新本店账户（repo 以 `shop_id` 条件兜底）。
        let updated = self
            .repo()
            .update(
                id,
                dto.account_type,
                dto.account_name.as_deref(),
                dto.account_no.as_deref(),
                dto.bank_name.as_deref(),
                dto.bank_branch.as_deref(),
                shop_scope,
            )
            .await?;
        if !updated {
            return Err(biz(DATA_NOT_EXIST));
        }
        Ok(())
    }

    /// 删除账户（Java `del`）。
    ///
    /// # Errors
    /// 主键缺失 → 「数据不存在」。
    pub async fn del(&self, id: Option<i32>, shop_scope: Option<i32>) -> Result<()> {
        let id = id.ok_or_else(|| biz(DATA_NOT_EXIST))?;
        // 多租户：越权 id（非本店账户）不会产生删除效果 → 数据不存在。
        if !self.repo().delete(id, shop_scope).await? {
            return Err(biz(DATA_NOT_EXIST));
        }
        Ok(())
    }

    /// 批量操作（Java `BaseServiceImpl#batch`：仅 `type=del` 生效）。
    pub async fn batch(
        &self,
        ids: Option<&[i32]>,
        op_type: Option<&str>,
        shop_scope: Option<i32>,
    ) -> Result<bool> {
        if op_type != Some("del") {
            return Ok(false);
        }
        let Some(ids) = ids.filter(|i| !i.is_empty()) else {
            return Ok(false);
        };
        // 多租户：店铺账号批量删除仅作用于本店账户。
        self.repo().delete_many(ids, shop_scope).await?;
        Ok(true)
    }
}

fn biz(msg: &str) -> Error {
    Error::biz(SERVICE_DATA_ERROR, msg)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn business_messages_match_java() {
        assert_eq!(DATA_NOT_EXIST, "数据不存在");
        assert_eq!(SHOP_NOT_EXIST, "店铺不存在");
        assert_eq!(MERCHANT_NOT_EXIST, "商户不存在");
        assert_eq!(WITHDRAWAL_RECEIPT_METHOD, "withdrawalReceiptMethod");
    }

    #[test]
    fn config_matches_java_type_dictionary() {
        let v = account_type_options();
        assert_eq!(v.as_array().map(Vec::len), Some(3));
    }
}
