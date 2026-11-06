//! 拼团记录（客户端）域服务（marketing::groupon_records）。
//!
//! Java `GrouponRecordsController`（2 端点）→ `GrouponPromotionRecordServiceImpl`
//! 的 `clientList` / `clientDetails`。
//!
//! # 偏差
//!
//! 1. `minGrouponPrice` 取 `groupon_promotion_detail.group_price` JSON 中每项
//!    `price` 的最小值；JSON 结构异常时返回 0（Java 可能抛异常）。
//! 2. 关键词检索：Java 同时匹配订单号/收货人/订单商品名（含 OR 优先级缺陷）；
//!    Rust 用 EXISTS 子查询匹配订单号/收货人/商品名（行为更严格，见模块注释）。
//! 3. `dateType` 已按 Java `DateTypeEnum` 对齐（0 全部 / 1 近三月 / 2 近六月 /
//!    3 近十二月，未知回落全部）；旧实现曾误用「1 今日 / 2 本周 / 3 本月 / 4 本年」，
//!    见 `infrastructure/.../groupon_records.rs::date_range`。
//! 4. `startTime/endTime` Java 用时间戳字符串 + 序列化器格式化，Rust 直接输出
//!    `yyyy-MM-dd HH:mm:ss`。

use std::collections::HashMap;
use std::sync::Arc;

use rust_decimal::Decimal;

use tigshop_core::entities::promotion::GrouponPromotionRecord;
use tigshop_core::models::marketing::groupon_records::{
    format_time, join_status_desc, GrouponRecordDetailQuery, GrouponRecordDetailVO,
    GrouponRecordPageQuery, GrouponRecordVO, JoinUserVO, MSG_RECORD_NOT_EXISTS,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::marketing::groupon_records::{
    GrouponRecordsRepository, GrouponUserRow,
};
use tigshop_infrastructure::db::Repositories;

/// 拼团记录（客户端）域服务。
pub struct GrouponRecordsService {
    repos: Arc<Repositories>,
}

impl GrouponRecordsService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    fn repo(&self) -> &GrouponRecordsRepository {
        &self.repos.marketing.groupon_records
    }

    /// 拼团活动记录列表（Java `clientList`）。
    pub async fn client_list(
        &self,
        q: &GrouponRecordPageQuery,
        user_id: Option<i32>,
    ) -> Result<PageResult<GrouponRecordVO>> {
        let (limit, offset) = q.limit_offset();
        let page = to_page(&q.page, &q.size);
        let user_id = user_id.filter(|id| *id > 0);
        let mut q = q.clone();
        if user_id.is_none() && q.product_id.is_none() {
            return Ok(PageResult::empty(&page));
        }
        if user_id.is_some() && q.product_id.is_none() {
            q.is_mine = Some(true);
        }
        let (total, rows) = self.repo().paginate(&q, user_id, limit, offset).await?;
        if rows.is_empty() {
            return Ok(PageResult::empty(&page));
        }
        let product_ids: Vec<i64> = distinct(rows.iter().map(|r| r.product_id));
        let item_ids: Vec<i64> = distinct(rows.iter().map(|r| r.groupon_promotion_item_id));
        let open_ids: Vec<i64> = distinct(rows.iter().map(|r| r.open_group_record_id));
        let order_ids: Vec<i64> = distinct(rows.iter().map(|r| r.order_id).filter(|id| *id > 0));
        let user_ids: Vec<i64> = distinct(rows.iter().map(|r| r.user_id).filter(|id| *id > 0));
        let products = self.repo().find_products(&product_ids).await?;
        let all_records = self.repo().find_records_by_items(&item_ids).await?;
        let details = self.repo().find_details(&item_ids).await?;
        let orders = self.repo().find_orders(&order_ids).await?;
        let users = self.repo().find_users(&user_ids).await?;
        let _ = open_ids;

        let list = rows
            .iter()
            .map(|item| {
                let product = products.get(&item.product_id);
                let join_num = all_records
                    .iter()
                    .filter(|r| {
                        r.groupon_promotion_item_id == item.groupon_promotion_item_id
                            && r.open_group_record_id == item.open_group_record_id
                    })
                    .count() as i64;
                let min_price = min_group_price(
                    details
                        .iter()
                        .filter(|d| d.groupon_promotion_item_id == item.groupon_promotion_item_id),
                );
                let order = orders.get(&item.order_id);
                GrouponRecordVO {
                    groupon_promotion_record_id: item.groupon_promotion_record_id,
                    groupon_promotion_item_id: item.groupon_promotion_item_id,
                    groupon_promotion_id: item.groupon_promotion_id,
                    product_name: item.product_name.clone(),
                    join_status: item.join_status,
                    join_status_desc: join_status_desc(item.join_status).to_string(),
                    min_group_num: item.min_group_num,
                    min_groupon_price: min_price,
                    groupon_price: Some(item.paid_amount),
                    product_price: product.map(|p| p.product_price),
                    product_sn: product.map(|p| p.product_sn.clone()),
                    pic_thumb: product.map(|p| p.pic_thumb.clone()),
                    join_num_count: join_num,
                    start_time: format_time(item.open_group_time),
                    end_time: format_time(item.join_expiration_time),
                    order_sn: Some(item.order_sn.clone()),
                    order_id: Some(item.order_id),
                    order_add_time: order.map(|o| format_time(i64::from(o.add_time))),
                    pay_type_id: order.map(|o| o.pay_type_id),
                    join_user: users.get(&item.user_id).map(|u| JoinUserVO {
                        user_id: item.user_id,
                        username: Some(u.username.clone()),
                        avatar: Some(u.avatar.clone()),
                        leader: u.username == item.group_captain_name,
                    }),
                }
            })
            .collect();
        Ok(PageResult::new(u64::try_from(total).unwrap_or(0), list, &page))
    }

    /// 拼团活动详情（Java `clientDetails`）。
    pub async fn client_details(
        &self,
        q: &GrouponRecordDetailQuery,
    ) -> Result<GrouponRecordDetailVO> {
        let id = q
            .groupon_promotion_record_id
            .ok_or_else(|| Error::biz(500, MSG_RECORD_NOT_EXISTS))?;
        let record = self
            .repo()
            .find_by_id(id)
            .await?
            .ok_or_else(|| Error::biz(500, MSG_RECORD_NOT_EXISTS))?;
        let product = self
            .repo()
            .find_products(&[record.product_id])
            .await?
            .remove(&record.product_id);
        let groupon = self.repo().find_groupon(record.groupon_promotion_id).await?;
        let shop_title = self.repo().find_shop_title(record.shop_id).await?;
        let join_num = self
            .repo()
            .find_records_by_items(&[record.groupon_promotion_item_id])
            .await?
            .iter()
            .filter(|r| r.open_group_record_id == record.groupon_promotion_record_id)
            .count() as i64;
        let members = self
            .repo()
            .find_records_by_items(&[record.groupon_promotion_item_id])
            .await?
            .into_iter()
            .filter(|r| r.open_group_record_id == record.open_group_record_id)
            .collect::<Vec<_>>();
        let user_ids: Vec<i64> = distinct(members.iter().map(|r| r.user_id).filter(|id| *id > 0));
        let users = self.repo().find_users(&user_ids).await?;
        let details = self.repo().find_details(&[record.groupon_promotion_item_id]).await?;
        let min_price = min_group_price(details.iter());
        let join_users: Vec<JoinUserVO> = members
            .iter()
            .map(|r| {
                let user: Option<&GrouponUserRow> = users.get(&r.user_id);
                let username = r
                    .username
                    .clone()
                    .filter(|v| !v.trim().is_empty())
                    .or_else(|| user.map(|u| u.username.clone()));
                let avatar = r
                    .avatar
                    .clone()
                    .filter(|v| !v.trim().is_empty())
                    .or_else(|| user.map(|u| u.avatar.clone()));
                JoinUserVO {
                    user_id: r.user_id,
                    leader: username.as_deref() == Some(record.group_captain_name.as_str()),
                    username,
                    avatar,
                }
            })
            .collect();
        let product_id = product.as_ref().map(|p| p.product_id as i32).unwrap_or_default();
        let product_sn = product.as_ref().map(|p| p.product_sn.clone());
        let product_price = product.as_ref().map(|p| p.product_price);
        let pic_thumb = product.as_ref().map(|p| p.pic_thumb.clone());
        Ok(GrouponRecordDetailVO {
            groupon_promotion_record_id: record.groupon_promotion_record_id,
            groupon_promotion_id: record.groupon_promotion_id,
            groupon_promotion_item_id: record.groupon_promotion_item_id,
            product_name: record.product_name.clone(),
            product_id,
            join_type: record.join_type,
            join_status: record.join_status,
            join_status_desc: join_status_desc(record.join_status).to_string(),
            min_group_num: record.min_group_num,
            shop_id: record.shop_id,
            product_sn: product.map(|p| p.product_sn.clone()),
            shop_title,
            groupon_image: groupon.as_ref().and_then(|g| g.groupon_image.clone()),
            pc_groupon_image: groupon.as_ref().and_then(|g| g.pc_groupon_image.clone()),
            min_groupon_price: min_price,
            groupon_price: Some(record.paid_amount),
            product_price,
            pic_thumb,
            start_time: format_time(record.open_group_time),
            end_time: format_time(record.join_expiration_time),
            join_num_count: join_num,
            order_id: Some(record.order_id),
            join_users,
        })
    }
}

/// 最低拼团价：`group_price` JSON 中每项 `price` 的最小值（异常 ⇒ 0）。
fn min_group_price<'a>(details: impl Iterator<Item = &'a tigshop_infrastructure::db::repo::marketing::groupon_records::GrouponDetailRow>) -> Option<Decimal> {
    let mut min: Option<Decimal> = None;
    for detail in details {
        if let Ok(items) = serde_json::from_str::<Vec<serde_json::Value>>(&detail.group_price) {
            for item in items {
                if let Some(price) = item
                    .get("price")
                    .and_then(serde_json::Value::as_str)
                    .and_then(|s| s.parse::<Decimal>().ok())
                    .or_else(|| {
                        item.get("price")
                            .and_then(serde_json::Value::as_f64)
                            .and_then(|f| Decimal::try_from(f).ok())
                    })
                {
                    min = Some(match min {
                        Some(current) if current <= price => current,
                        _ => price,
                    });
                }
            }
        }
    }
    Some(min.unwrap_or(Decimal::ZERO))
}

fn distinct(ids: impl Iterator<Item = i64>) -> Vec<i64> {
    let mut out: Vec<i64> = Vec::new();
    for id in ids {
        if !out.contains(&id) {
            out.push(id);
        }
    }
    out
}

fn to_page(page: &Option<i64>, size: &Option<i64>) -> tigshop_core::types::PageQuery {
    let (size, offset) = GrouponRecordsRepository::page_window(*page, *size);
    let page_no = if size > 0 { offset / size + 1 } else { 1 };
    tigshop_core::types::PageQuery {
        page: u64::try_from(page_no.max(1)).unwrap_or(1),
        page_size: u64::try_from(size.max(1)).unwrap_or(15),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_infrastructure::db::repo::marketing::groupon_records::GrouponDetailRow;

    #[test]
    fn min_group_price_parses_json() {
        let rows = vec![GrouponDetailRow {
            groupon_promotion_item_id: 1,
            group_price: r#"[{"groupNum":2,"price":"19.90"},{"groupNum":3,"price":9.9}]"#.into(),
        }];
        assert_eq!(
            min_group_price(rows.iter()),
            Some(rust_decimal::Decimal::new(990, 2))
        );
        let bad = vec![GrouponDetailRow {
            groupon_promotion_item_id: 1,
            group_price: "not-json".into(),
        }];
        assert_eq!(min_group_price(bad.iter()), Some(Decimal::ZERO));
    }

    #[test]
    fn page_and_distinct() {
        let p = to_page(&Some(2), &Some(10));
        assert_eq!((p.page, p.page_size), (2, 10));
        assert_eq!(distinct([3, 1, 3].into_iter()), vec![3, 1]);
    }
}
