//! 营销活动服务（marketing::promotion）。
//!
//! 对应原 Java `PromotionServiceImpl` 的 4 个管理端端点：
//! `list` / `getCount` / `create` / `update`。
//!
//! # 语义（逐条对照 Java）
//! - `list`：keyword LIKE（`promotion_name`）+ `type` csv IN + `timeType`
//!   （1 进行中 / 2 7 天内到期 / 3 已结束）+ 排序白名单。
//! - `getCount`：`PromotionCountVO` 三个时间桶计数（SQL `SUM(CASE …)`）。
//! - `create`：校验名称必填；`range_data`/`sku_ids`/`member_marks` 序列化为
//!   文本列；`shop_id=0`、`is_delete=0`、`is_available` 缺省 1。
//! - `update`：`promotion_id` 必填且必须存在（Java 仅 `updateById`，不存在
//!   时静默返回 false；Rust 显式报「营销活动不存在」，见模块头差异）。
//!
//! # 差异
//! 1. `memberAudience` 人群圈选（Java `memberAudienceService.resolveWriteScope`
//!    → `member_scope`）未迁移，`member_scope` 保持原值。
//! 2. 列表 VO 的 `range_data`/`sku_ids`/`member_marks` 兼容 Java
//!    `List.toString()` 与 JSON 两种历史格式（`parse_value`）。
//!
//! # 金额：本域无金额列。

use std::sync::Arc;

use tigshop_core::entities::Promotion;
use tigshop_core::models::marketing::promotion::{
    parse_type_list, parse_value, time_bucket, type_text, validate_create, value_to_text,
    PromotionCountVO, PromotionCreateDTO, PromotionListQuery, PromotionUpdateDTO, PromotionVO,
    DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MSG_ID_REQUIRED, MSG_NAME_REQUIRED,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::marketing::promotion::PromotionRepository;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_infrastructure::db::Repositories;

/// 营销活动服务（挂载于 `AdminState.marketing.promotion`）。
pub struct PromotionService {
    repos: Arc<Repositories>,
}

impl PromotionService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    #[must_use]
    pub fn repo(&self) -> &PromotionRepository {
        &self.repos.marketing.promotion
    }

    /// 活动分页（Java `list`）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn list(&self, q: &PromotionListQuery) -> Result<PageResult<PromotionVO>> {
        let page = PageQuery {
            page: q.page.unwrap_or(1),
            page_size: q.page_size.unwrap_or(DEFAULT_PAGE_SIZE).min(MAX_PAGE_SIZE),
        };
        let (limit, offset) = page.limit_offset();
        let types = parse_type_list(q.r#type.as_deref());
        let now = now_secs();
        let (total, rows) = self
            .repo()
            .paginate(
                q.keyword.as_deref(),
                TenantScope::current_list_filter(),
                types.as_deref(),
                q.time_type,
                now,
                q.sort_field.as_deref(),
                q.sort_order.as_deref(),
                limit,
                offset,
            )
            .await?;
        let list = rows.iter().map(to_vo).collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 活动数量（Java `getCount`）。
    ///
    /// # Errors
    /// 数据库错误 → `Error::Database`。
    pub async fn count(&self) -> Result<PromotionCountVO> {
        let row = self.repo().count_buckets(now_secs()).await?;
        Ok(PromotionCountVO {
            time_type1_count: row.time_type1_count,
            time_type2_count: row.time_type2_count,
            time_type3_count: row.time_type3_count,
        })
    }

    /// 新增活动（Java `create`）。
    ///
    /// # Errors
    /// 名称为空 → `Validation`；数据库错误 → `Database`。
    pub async fn create(&self, dto: &PromotionCreateDTO) -> Result<i32> {
        validate_create(dto).map_err(Error::Validation)?;
        let entity = Promotion {
            promotion_id: 0,
            promotion_name: dto
                .promotion_name
                .as_deref()
                .map(str::trim)
                .unwrap_or_default()
                .to_string(),
            start_time: dto.start_time.unwrap_or(0),
            end_time: dto.end_time.unwrap_or(0),
            r#type: dto.r#type.unwrap_or(0),
            // 多租户：店铺账号强制落本店；平台账号落平台级（0）
            shop_id: TenantScope::current().write_shop_id(dto.shop_id)?,
            relation_id: dto.relation_id,
            range: dto.range,
            range_data: value_to_text(dto.range_data.as_ref()),
            sku_ids: value_to_text(dto.sku_ids.as_ref()),
            is_available: Some(1),
            is_delete: Some(0),
            member_range: dto.member_range.unwrap_or(0),
            member_marks: value_to_text(dto.member_marks.as_ref()),
            member_scope: None,
        };
        self.repo().insert(&entity).await
    }

    /// 编辑活动（Java `update`；差异见模块头）。
    ///
    /// # Errors
    /// 缺 id → `Validation`；不存在 → `营销活动不存在`。
    pub async fn update(&self, dto: &PromotionUpdateDTO) -> Result<()> {
        let id = dto
            .promotion_id
            .ok_or_else(|| Error::Validation(MSG_ID_REQUIRED.into()))?;
        let Some(mut entity) = self.repo().find_by_id(id).await? else {
            return Err(Error::biz(
                500,
                tigshop_core::models::marketing::promotion::MSG_PROMOTION_NOT_FOUND,
            ));
        };
        // 多租户：写操作必须校验活动归属
        TenantScope::current_ensure_access(entity.shop_id)?;
        if let Some(name) = dto.promotion_name.as_deref() {
            if name.trim().is_empty() {
                return Err(Error::Validation(MSG_NAME_REQUIRED.into()));
            }
            entity.promotion_name = name.trim().to_string();
        }
        if let Some(v) = dto.start_time {
            entity.start_time = v;
        }
        if let Some(v) = dto.end_time {
            entity.end_time = v;
        }
        if let Some(v) = dto.r#type {
            entity.r#type = v;
        }
        if let Some(v) = dto.relation_id {
            entity.relation_id = Some(v);
        }
        if let Some(v) = dto.range {
            entity.range = Some(v);
        }
        if let Some(v) = &dto.range_data {
            entity.range_data = value_to_text(Some(v));
        }
        if let Some(v) = &dto.sku_ids {
            entity.sku_ids = value_to_text(Some(v));
        }
        if let Some(v) = dto.member_range {
            entity.member_range = v;
        }
        if let Some(v) = &dto.member_marks {
            entity.member_marks = value_to_text(Some(v));
        }
        self.repo().update(&entity).await?;
        Ok(())
    }
}

/// 实体 → VO（Java `PromotionVO` 子集 + 兼容解析）。
fn to_vo(p: &Promotion) -> PromotionVO {
    PromotionVO {
        promotion_id: p.promotion_id,
        promotion_name: p.promotion_name.clone(),
        start_time: p.start_time,
        end_time: p.end_time,
        r#type: p.r#type,
        type_text: type_text(p.r#type).to_string(),
        shop_id: p.shop_id,
        relation_id: p.relation_id,
        range: p.range,
        range_data: parse_value(p.range_data.as_deref()),
        sku_ids: parse_value(p.sku_ids.as_deref()),
        is_available: p.is_available,
        is_delete: p.is_delete,
        member_range: p.member_range,
        member_marks: parse_value(p.member_marks.as_deref()),
    }
}

fn now_secs() -> i64 {
    i64::try_from(tigshop_common::utils::now_seconds()).unwrap_or(i64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_vo_derives_type_text_and_parses_json() {
        let p = Promotion {
            promotion_id: 3,
            promotion_name: "活动".into(),
            start_time: 1_700_000_000,
            end_time: 1_700_086_400,
            r#type: 1,
            shop_id: 0,
            range_data: Some("[1, 2]".into()),
            sku_ids: Some(r#"[3,4]"#.into()),
            ..Default::default()
        };
        let vo = to_vo(&p);
        assert_eq!(vo.type_text, "秒杀");
        assert_eq!(vo.range_data.as_ref().unwrap(), &serde_json::json!([1, 2]));
        assert_eq!(vo.sku_ids.as_ref().unwrap(), &serde_json::json!([3, 4]));
    }

    #[test]
    fn time_bucket_used_for_documented_semantics() {
        let now = 1_700_000_000;
        assert_eq!(time_bucket(now, 0, 0), 1);
        assert_eq!(time_bucket(now, (now - 5) as i32, (now - 1) as i32), 3);
    }

    #[test]
    fn create_requires_name() {
        let err = promote_err();
        assert_eq!(err, MSG_NAME_REQUIRED);
    }

    fn promote_err() -> String {
        match validate_create(&PromotionCreateDTO::default()) {
            Ok(()) => String::new(),
            Err(e) => e,
        }
    }
}
