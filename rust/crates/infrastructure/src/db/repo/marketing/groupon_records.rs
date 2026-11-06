//! 拼团记录（客户端）域仓储（marketing::groupon_records）。

use std::collections::HashMap;

use rust_decimal::Decimal;
use sqlx::{FromRow, MySql, MySqlPool, QueryBuilder};

use tigshop_core::entities::promotion::GrouponPromotionRecord;
use tigshop_core::models::marketing::groupon_records::GrouponRecordPageQuery;
use tigshop_core::{Error, Result};

const SELECT: &str = "SELECT groupon_promotion_record_id, groupon_promotion_id, groupon_promotion_item_id, product_id, product_name, join_type, join_status, avatar, username, user_id, order_id, order_sn, is_virtual, paid_amount, open_group_record_id, open_group_time, group_captain_name, join_expiration_time, min_group_num, shop_id, add_time FROM groupon_promotion_record";

/// 商品装配行。
#[derive(Debug, Clone, Default, FromRow)]
pub struct GrouponProductRow {
    pub product_id: i64,
    pub product_name: String,
    pub product_sn: String,
    pub product_price: Decimal,
    pub pic_thumb: String,
}

/// 拼团信息行（`groupon_promotion_detail.group_price` JSON）。
#[derive(Debug, Clone, Default, FromRow)]
pub struct GrouponDetailRow {
    pub groupon_promotion_item_id: i64,
    pub group_price: String,
}

/// 用户行。
#[derive(Debug, Clone, Default, FromRow)]
pub struct GrouponUserRow {
    pub user_id: i32,
    pub username: String,
    pub avatar: String,
}

/// 订单行。
#[derive(Debug, Clone, Default, FromRow)]
pub struct GrouponOrderRow {
    pub order_id: i64,
    pub order_sn: String,
    pub add_time: i32,
    pub pay_type_id: i32,
    pub order_status: i32,
}

/// 拼团活动行。
#[derive(Debug, Clone, Default, FromRow)]
pub struct GrouponPromotionRow {
    pub groupon_promotion_id: i64,
    pub groupon_image: Option<String>,
    pub pc_groupon_image: Option<String>,
}

/// 拼团记录（客户端）域仓储。
#[derive(Clone)]
pub struct GrouponRecordsRepository {
    pool: MySqlPool,
}

impl GrouponRecordsRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 分页（Java `clientList` 的过滤条件）。
    pub async fn paginate(
        &self,
        q: &GrouponRecordPageQuery,
        user_id: Option<i32>,
        limit: i64,
        offset: i64,
    ) -> Result<(i64, Vec<GrouponPromotionRecord>)> {
        let mut cq: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT COUNT(*) FROM groupon_promotion_record WHERE 1 = 1");
        Self::push_filters(&mut cq, q, user_id);
        let total: (i64,) = cq.build_query_as().fetch_one(&self.pool).await.map_err(map_err)?;
        let mut rq: QueryBuilder<'_, MySql> = QueryBuilder::new(format!("{SELECT} WHERE 1 = 1"));
        Self::push_filters(&mut rq, q, user_id);
        rq.push(" ORDER BY add_time DESC");
        rq.push(format!(" LIMIT {limit} OFFSET {offset}"));
        let rows: Vec<GrouponPromotionRecord> = rq.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total.0, rows))
    }

    fn push_filters(
        qb: &mut QueryBuilder<'_, MySql>,
        q: &GrouponRecordPageQuery,
        user_id: Option<i32>,
    ) {
        if q.is_mine.unwrap_or(false) {
            if let Some(user_id) = user_id {
                qb.push(" AND user_id = ");
                qb.push_bind(i64::from(user_id));
            }
        }
        if let Some(join_type) = q.join_type {
            qb.push(" AND join_type = ");
            qb.push_bind(join_type);
        }
        if let Some(join_status) = q.join_status {
            qb.push(" AND join_status = ");
            qb.push_bind(join_status);
        }
        if let Some(product_id) = q.product_id {
            qb.push(" AND product_id = ");
            qb.push_bind(i64::from(product_id));
        }
        if q.exclude_ended.unwrap_or(false) {
            qb.push(" AND join_status = 1");
        }
        if !q.is_mine.unwrap_or(false) {
            qb.push(" AND join_type = 1 AND EXISTS (SELECT 1 FROM groupon_promotion g WHERE g.groupon_promotion_id = groupon_promotion_record.groupon_promotion_id AND g.end_time > ");
            qb.push_bind(now_seconds());
            qb.push(")");
        }
        if let Some(day_range) = q.date_type.and_then(date_range) {
            qb.push(" AND EXISTS (SELECT 1 FROM `order` o WHERE o.order_id = groupon_promotion_record.order_id AND o.add_time >= ");
            qb.push_bind(day_range.0);
            qb.push(" AND o.add_time <= ");
            qb.push_bind(day_range.1);
            qb.push(")");
        }
        if let Some(keyword) = q.keyword.as_deref().filter(|s| !s.is_empty()) {
            qb.push(" AND (EXISTS (SELECT 1 FROM `order` o WHERE o.order_id = groupon_promotion_record.order_id AND (o.order_sn LIKE ");
            qb.push_bind(format!("%{keyword}%"));
            qb.push(" OR o.consignee LIKE ");
            qb.push_bind(format!("%{keyword}%"));
            qb.push(")) OR EXISTS (SELECT 1 FROM order_item oi WHERE oi.order_id = groupon_promotion_record.order_id AND oi.product_name LIKE ");
            qb.push_bind(format!("%{keyword}%"));
            qb.push("))");
        }
    }

    pub async fn find_by_id(&self, id: i64) -> Result<Option<GrouponPromotionRecord>> {
        sqlx::query_as::<_, GrouponPromotionRecord>(&format!(
            "{SELECT} WHERE groupon_promotion_record_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    pub async fn find_products(&self, ids: &[i64]) -> Result<HashMap<i64, GrouponProductRow>> {
        let ids: Vec<i32> = ids.iter().filter(|id| **id <= i64::from(i32::MAX)).map(|id| *id as i32).collect();
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT product_id, product_name, product_sn, product_price, pic_thumb FROM product WHERE product_id IN (");
        Self::push_i32_list(&mut qb, &ids);
        qb.push(")");
        let rows: Vec<GrouponProductRow> = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows.into_iter().map(|r| (r.product_id, r)).collect())
    }

    pub async fn find_records_by_items(&self, item_ids: &[i64]) -> Result<Vec<GrouponPromotionRecord>> {
        if item_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new(format!("{SELECT} WHERE groupon_promotion_item_id IN ("));
        Self::push_i64_list(&mut qb, item_ids);
        qb.push(")");
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    pub async fn find_details(&self, item_ids: &[i64]) -> Result<Vec<GrouponDetailRow>> {
        if item_ids.is_empty() {
            return Ok(Vec::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT groupon_promotion_item_id, group_price FROM groupon_promotion_detail WHERE groupon_promotion_item_id IN (",
        );
        Self::push_i64_list(&mut qb, item_ids);
        qb.push(")");
        qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)
    }

    pub async fn find_users(&self, ids: &[i64]) -> Result<HashMap<i64, GrouponUserRow>> {
        let ids: Vec<i32> = ids.iter().filter(|id| **id > 0 && **id <= i64::from(i32::MAX)).map(|id| *id as i32).collect();
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut qb: QueryBuilder<'_, MySql> =
            QueryBuilder::new("SELECT user_id, username, avatar FROM `user` WHERE user_id IN (");
        Self::push_i32_list(&mut qb, &ids);
        qb.push(")");
        let rows: Vec<GrouponUserRow> = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows.into_iter().map(|r| (i64::from(r.user_id), r)).collect())
    }

    pub async fn find_orders(&self, ids: &[i64]) -> Result<HashMap<i64, GrouponOrderRow>> {
        let ids: Vec<i32> = ids.iter().filter(|id| **id > 0 && **id <= i64::from(i32::MAX)).map(|id| *id as i32).collect();
        if ids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut qb: QueryBuilder<'_, MySql> = QueryBuilder::new(
            "SELECT order_id, order_sn, add_time, pay_type_id, order_status FROM `order` WHERE order_id IN (",
        );
        Self::push_i32_list(&mut qb, &ids);
        qb.push(")");
        let rows: Vec<GrouponOrderRow> = qb.build_query_as().fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows.into_iter().map(|r| (i64::from(r.order_id), r)).collect())
    }

    pub async fn find_shop_title(&self, shop_id: i32) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> =
            sqlx::query_as("SELECT shop_title FROM shop WHERE shop_id = ? LIMIT 1")
                .bind(shop_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.and_then(|(v,)| v))
    }

    pub async fn find_groupon(&self, id: i64) -> Result<Option<GrouponPromotionRow>> {
        sqlx::query_as::<_, GrouponPromotionRow>(
            "SELECT groupon_promotion_id, groupon_image, pc_groupon_image FROM groupon_promotion WHERE groupon_promotion_id = ? LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    #[must_use]
    pub fn page_window(page: Option<i64>, size: Option<i64>) -> (i64, i64) {
        let page = page.unwrap_or(1).max(1);
        let size = match size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    fn push_i32_list(qb: &mut QueryBuilder<'_, MySql>, ids: &[i32]) {
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
    }
    fn push_i64_list(qb: &mut QueryBuilder<'_, MySql>, ids: &[i64]) {
        let mut sep = qb.separated(", ");
        for id in ids {
            sep.push_bind(*id);
        }
    }
}

fn now_seconds() -> i64 {
    chrono::Utc::now().timestamp()
}

/// `dateType` 时间范围，对齐 Java `DateTypeEnum.getTimestampRangeByCode`：
/// `0` 全部 / `1` 近 3 个月 / `2` 近 6 个月 / `3` 近 12 个月。
///
/// Java 对未知 code 回落 `ALL`（`{0, now}`）；这里返回 `None` 表示不加时间条件，
/// 与之等价（订单 `add_time` 恒 >= 0，且不会有未来订单）。
/// 结束时间取当前时刻（Java `LocalDateTime.now()`），旧实现的 `+86399` 会多框一天。
fn date_range(date_type: i32) -> Option<(i32, i32)> {
    use chrono::{Local, Months, TimeZone};
    let now = Local::now();
    let end = i32::try_from(now.timestamp()).ok()?;
    let months: u32 = match date_type {
        0 => return Some((0, end)),
        1 => 3,
        2 => 6,
        3 => 12,
        _ => return None,
    };
    // Java `LocalDateTime.now().minusMonths(n)` 是日历月减法（含月末收敛），
    // 不能用固定 30/90 天近似。
    let start_date = now.date_naive().checked_sub_months(Months::new(months))?;
    let start_dt = start_date.and_time(now.naive_local().time());
    let start_ts = Local.from_local_datetime(&start_dt).single()?.timestamp();
    Some((i32::try_from(start_ts).ok()?, end))
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn date_range_branches() {
        // Java DateTypeEnum：0 全部 / 1 近三月 / 2 近六月 / 3 近十二月，未知回落全部
        assert!(date_range(0).is_some());
        assert!(date_range(1).is_some());
        assert!(date_range(2).is_some());
        assert!(date_range(3).is_some());
        assert!(date_range(4).is_none());
        assert!(date_range(9).is_none());
    }

    #[test]
    fn date_range_matches_java_date_type_enum() {
        let now = chrono::Local::now().timestamp();
        let (all_start, all_end) = date_range(0).expect("ALL");
        assert_eq!(all_start, 0);
        assert!(i64::from(all_end) <= now && i64::from(all_end) > now - 5, "end should be now");
        let (m3, _) = date_range(1).expect("3 months");
        let (m6, _) = date_range(2).expect("6 months");
        let (m12, _) = date_range(3).expect("12 months");
        assert!(m12 < m6 && m6 < m3 && m3 < all_end);
        let days3 = (now - i64::from(m3)) / 86_400;
        assert!((89..=92).contains(&days3), "3 months = {days3} days");
        let days12 = (now - i64::from(m12)) / 86_400;
        assert!((364..=367).contains(&days12), "12 months = {days12} days");
    }

    #[test]
    fn page_window_rules() {
        assert_eq!(GrouponRecordsRepository::page_window(None, None), (15, 0));
        assert_eq!(GrouponRecordsRepository::page_window(Some(3), Some(10)), (10, 20));
    }
}
