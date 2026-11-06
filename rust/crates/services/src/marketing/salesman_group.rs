//! 分销员分组服务（marketing::salesman_group）。
//!
//! 对应原 Java `SalesmanGroupServiceImpl`（5 个管理端端点：
//! `list` / `detail` / `create` / `update` / `del`）。
//!
//! # 语义（逐条对照 Java）
//! - `list`：`groupName` LIKE，默认 `add_time ASC`（可显式排序白名单列）。
//! - `detail`：`getById`，缺失返回 `null`。
//! - `create`：`groupName` 必填；`add_time=now`、`shop_id=0`。
//! - `update`：不存在 → `未知的分销员分组`。
//! - `del`：若该分组下仍有分销员（`salesman.group_id`）→
//!   `该分组下有分销员，无法删除`；否则物理删除（表无 is_delete）。
//!
//! # 与本域其它 feature 的关系
//! `salesman_admin` / `salesman` 的 `groupInfo` 回填直接读 `salesman_group`，
//! 不依赖本服务，注册顺序无耦合。

use std::sync::Arc;

use tigshop_core::entities::SalesmanGroup;
use tigshop_core::models::marketing::salesman_group::{
    format_time, validate_name, BatchDTO, OperateDTO, SalesmanGroupEditDTO, SalesmanGroupListQuery,
    SalesmanGroupSaveDTO, SalesmanGroupVO, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MSG_GROUP_IN_USE,
    MSG_GROUP_NOT_FOUND, MSG_ID_REQUIRED,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::marketing::salesman_group::SalesmanGroupRepository;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_infrastructure::db::Repositories;

/// 分组服务（挂载于 `AdminState.marketing.salesman_group`）。
pub struct SalesmanGroupService {
    repos: Arc<Repositories>,
}

impl SalesmanGroupService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    #[must_use]
    pub fn repo(&self) -> &SalesmanGroupRepository {
        &self.repos.marketing.salesman_group
    }

    /// 分组分页（Java `list`）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn list(&self, q: &SalesmanGroupListQuery) -> Result<PageResult<SalesmanGroupVO>> {
        let page = PageQuery {
            page: q.page.unwrap_or(1),
            page_size: q.page_size.unwrap_or(DEFAULT_PAGE_SIZE).min(MAX_PAGE_SIZE),
        };
        let (limit, offset) = page.limit_offset();
        let (total, rows) = self
            .repo()
            .paginate(
                q.group_name.as_deref(),
                TenantScope::current_list_filter(),
                q.sort_field.as_deref(),
                q.sort_order.as_deref(),
                limit,
                offset,
            )
            .await?;
        let list = rows.iter().map(to_vo).collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 分组详情（Java `detail`；缺失返回 `null`）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn detail(&self, id: i32) -> Result<Option<SalesmanGroupVO>> {
        let Some(group) = self.repo().find_by_id(id).await? else {
            return Ok(None);
        };
        // 多租户：店铺账号只能查看本店分组
        TenantScope::current_ensure_access(group.shop_id.unwrap_or(0))?;
        Ok(Some(to_vo(&group)))
    }

    /// 新增分组（Java `create`）。
    ///
    /// # Errors
    /// 名称空白 → `分组名称不能为空`。
    pub async fn create(&self, dto: &SalesmanGroupSaveDTO) -> Result<i32> {
        validate_name(dto.group_name.as_deref()).map_err(Error::Validation)?;
        let entity = SalesmanGroup {
            group_id: 0,
            group_name: dto.group_name.as_deref().map(str::trim).map(str::to_string),
            describe: dto.describe.clone(),
            add_time: Some(now_secs_i32()),
            // 多租户：店铺账号强制落本店；平台账号落平台级（0）
            shop_id: Some(TenantScope::current().write_shop_id(None)?),
        };
        self.repo().insert(&entity).await
    }

    /// 编辑分组（Java `update`）。
    ///
    /// # Errors
    /// 缺 id → `Validation`；不存在 → `未知的分销员分组`；名称空白 → `Validation`。
    pub async fn update(&self, dto: &SalesmanGroupEditDTO) -> Result<()> {
        let id = dto
            .group_id
            .ok_or_else(|| Error::Validation(MSG_ID_REQUIRED.into()))?;
        let Some(mut entity) = self.repo().find_by_id(id).await? else {
            return Err(Error::biz(500, MSG_GROUP_NOT_FOUND));
        };
        // 多租户：写操作必须校验分组归属
        TenantScope::current_ensure_access(entity.shop_id.unwrap_or(0))?;
        if let Some(name) = dto.group_name.as_deref() {
            validate_name(Some(name)).map_err(Error::Validation)?;
            entity.group_name = Some(name.trim().to_string());
        }
        if let Some(desc) = &dto.describe {
            entity.describe = Some(desc.clone());
        }
        self.repo().update(&entity).await?;
        Ok(())
    }

    /// 删除分组（Java `del`：先查占用）。
    ///
    /// # Errors
    /// 缺 id → `Validation`；组内有分销员 → `该分组下有分销员，无法删除`。
    pub async fn delete(&self, dto: &OperateDTO) -> Result<()> {
        let id = dto
            .id
            .ok_or_else(|| Error::Validation(MSG_ID_REQUIRED.into()))?;
        // 多租户：删除前校验分组归属
        if let Some(group) = self.repo().find_by_id(id).await? {
            TenantScope::current_ensure_access(group.shop_id.unwrap_or(0))?;
        }
        if self.repo().count_salesmen_in_group(id).await? > 0 {
            return Err(Error::biz(500, MSG_GROUP_IN_USE));
        }
        self.repo().delete(id).await?;
        Ok(())
    }

    /// 批量操作（`POST /salesman/group/batch`）。
    ///
    /// Java 来源：新版管理端前端
    /// `view/admin/src/api/salesman/subgroup.ts#batchSubmit`
    /// （body `{ type, ids }`；Java `SalesmanGroupController` 未含 `batch`）。
    /// 语义对齐各域 `BaseServiceImpl#batch`：`type = "del"` 时
    /// `removeByIds`（**不做**单删的「组内有分销员」占用检查，
    /// 与 Java 批量路径一致）；其它 `type` 静默返回 `false`。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn batch(&self, dto: &BatchDTO) -> Result<bool> {
        if dto.r#type != "del" || dto.ids.is_empty() {
            return Ok(false);
        }
        let mut deleted = false;
        for id in &dto.ids {
            if self.repo().delete(*id).await? {
                deleted = true;
            }
        }
        Ok(deleted)
    }
}

/// 实体 → VO（Java `SalesmanGroupVO::new`）。
fn to_vo(g: &SalesmanGroup) -> SalesmanGroupVO {
    SalesmanGroupVO {
        group_id: g.group_id,
        group_name: g.group_name.clone(),
        describe: g.describe.clone(),
        shop_id: g.shop_id,
        add_time: format_time(g.add_time),
    }
}

fn now_secs_i32() -> i32 {
    i32::try_from(tigshop_common::utils::now_seconds()).unwrap_or(i32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_vo_formats_time_and_keeps_nullable_fields() {
        let g = SalesmanGroup {
            group_id: 7,
            group_name: Some("A 组".into()),
            describe: None,
            add_time: Some(1_700_000_000),
            shop_id: Some(0),
        };
        let vo = to_vo(&g);
        assert_eq!(vo.group_id, 7);
        assert_eq!(vo.add_time, "2023-11-15 06:13:20");
        assert!(vo.describe.is_none());
    }

    #[test]
    fn create_requires_name() {
        let dto = SalesmanGroupSaveDTO::default();
        assert!(validate_name(dto.group_name.as_deref()).is_err());
    }
}
