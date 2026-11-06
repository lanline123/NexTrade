//! 前台用户订单域仓储（trade::user_order）。
//!
//! 涉及表（列名严格对齐 `schema_parser`）：
//! - `` `order` ``（订单，MySQL 保留字，**所有引用均加反引号**）/ `order_item`
//! - `order_log`（订单日志）
//! - `cart`（再次购买加购）
//! - `aftersales`（售后中计数）/ `collect_product` / `collect_shop`（收藏计数）
//! - `config`（售后原因配置）/ `logistics_company`（物流公司存在性）
//!
//! 查询统一使用运行时 `sqlx::query_as`（**不使用** `query!` 宏）。

use rust_decimal::Decimal;
use sqlx::MySqlPool;

use tigshop_core::models::trade::user_order::{
    cart_type_from_product_type, OrderBrief, OrderItemSeed, ORDER_STATUS_COMPLETED,
};
use tigshop_core::{Error, Result};

/// 前台用户订单域仓储（持有连接池）。
#[derive(Clone)]
pub struct UserOrderRepository {
    pool: MySqlPool,
}

impl UserOrderRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（与其它仓储一致）。
    #[must_use]
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    // ————————————————————— 统计 —————————————————————

    /// 订单数量统计（Java `OrderServiceImpl#getOrderStatusCount(userId, type, value)`）。
    ///
    /// `column` 只接受 `order_status` / `comment_status` / `order_comment_status`
    /// （白名单，防注入）。公共过滤条件与 Java 一致：未删除、有效、本人订单，
    /// 并排除「支付后拆单」产生的未支付子单（周期购 / 次卡子单除外）。
    ///
    /// 其中 `order_comment_status` 是 Java `orderNum()` 计算 `awaitComment` 时专用的
    /// type：除 `comment_status = 0` 外**还必须** `order_status = 5`（已完成）。
    /// 早期移植把它退化成 `comment_status`，导致所有未付款 / 待发货 / 已取消 /
    /// 无效订单（默认 comment_status = 0）都被算成「待评价」，会员中心左侧角标虚高。
    pub async fn count_orders(&self, user_id: i32, column: &'static str, value: i32) -> Result<i64> {
        let (sql, bind_completed) = order_count_sql(column)
            .ok_or_else(|| Error::Internal("非法统计列".into()))?;
        let mut query = sqlx::query_as::<_, (i64,)>(&sql).bind(user_id).bind(value);
        if bind_completed {
            query = query.bind(ORDER_STATUS_COMPLETED);
        }
        let row: (i64,) = query.fetch_one(&self.pool).await.map_err(map_err)?;
        Ok(row.0)
    }

    /// 售后中数量（Java `count(user_id + status IN inProgressStatus)`）。
    pub async fn count_aftersales_in_progress(&self, user_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM aftersales WHERE user_id = ? AND status IN (1, 2, 3, 4, 5, 21, 22)",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0)
    }

    /// 商品收藏数量（Java `collectProductMapper.selectCount(eq(userId))`）。
    pub async fn count_collect_products(&self, user_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM collect_product WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0)
    }

    /// 店铺收藏数量（Java `collectShopMapper.selectCount(eq(userId))`）。
    pub async fn count_collect_shops(&self, user_id: i32) -> Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM collect_shop WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(row.0)
    }

    // ————————————————————— 订单读写 —————————————————————

    /// 按 id + userId 查订单轻量行（Java `detail(id, userId)` 的归属校验部分）。
    pub async fn find_order_brief(&self, order_id: i32, user_id: i32) -> Result<Option<OrderBrief>> {
        let row = sqlx::query_as::<_, (i32, String, i32, i32, i32, Option<i32>, i32, String, i32, i32)>(
            "SELECT order_id, order_sn, order_status, shipping_status, comment_status,
                    order_type, shop_id, tracking_no, logistics_id, is_del
             FROM `order` WHERE order_id = ? AND user_id = ? LIMIT 1",
        )
        .bind(order_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|r| OrderBrief {
            order_id: r.0,
            order_sn: r.1,
            order_status: r.2,
            shipping_status: r.3,
            comment_status: r.4,
            order_type: r.5,
            shop_id: r.6,
            tracking_no: r.7,
            logistics_id: r.8,
            is_del: r.9,
        }))
    }

    /// 删除订单（Java `delOrder`：`order_status = 3(已取消)` + `is_del = 1`）。
    pub async fn mark_order_deleted(&self, order_id: i32) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE `order` SET order_status = 3, is_del = 1 WHERE order_id = ?",
        )
        .bind(order_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 确认收货（Java `confirmReceipt` 的订单状态更新：已完成 + 已收货 + received_time）。
    pub async fn complete_order(&self, order_id: i32, received_time: i32) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE `order` SET order_status = 5, shipping_status = 2, received_time = ?
             WHERE order_id = ?",
        )
        .bind(received_time)
        .bind(order_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 写订单日志（Java `orderLogService.quickCreate`）。
    pub async fn insert_order_log(
        &self,
        order_id: i32,
        order_sn: &str,
        user_id: i32,
        shop_id: i32,
        description: &str,
        log_time: i32,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO order_log (order_id, order_sn, admin_id, user_id, description, log_time, shop_id)
             VALUES (?, ?, 0, ?, ?, ?, ?)",
        )
        .bind(order_id)
        .bind(order_sn)
        .bind(user_id)
        .bind(description)
        .bind(log_time)
        .bind(shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(())
    }

    /// 订单商品行（再次购买）。
    pub async fn list_order_items(&self, order_id: i32) -> Result<Vec<OrderItemSeed>> {
        let rows = sqlx::query_as::<
            _,
            (i32, i32, i32, Decimal, String, String, String, i32, i32),
        >(
            "SELECT product_id, sku_id, quantity, price, product_sn, pic_thumb, sku_data,
                    product_type, shop_id
             FROM order_item WHERE order_id = ?",
        )
        .bind(order_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows
            .into_iter()
            .map(
                |(product_id, sku_id, quantity, price, product_sn, pic_thumb, sku_data, product_type, shop_id)| {
                    OrderItemSeed {
                        product_id,
                        sku_id,
                        quantity,
                        price,
                        product_sn,
                        pic_thumb,
                        sku_data,
                        product_type,
                        shop_id,
                    }
                },
            )
            .collect())
    }

    // ————————————————————— 再次购买（加购） —————————————————————

    /// 商品是否仍可购买（Java 校验 `product_status != 下架 && is_delete = 0`）。
    pub async fn product_available(&self, product_id: i32) -> Result<bool> {
        let row: Option<(i32, i32)> = sqlx::query_as(
            "SELECT product_status, is_delete FROM product WHERE product_id = ? LIMIT 1",
        )
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(matches!(row, Some((status, is_delete)) if status != 0 && is_delete == 0))
    }

    /// 查同商品/同规格的购物车行 id（`sku_id` 用 NULL 安全比较）。
    pub async fn find_cart_row(
        &self,
        user_id: i32,
        product_id: i32,
        sku_id: i32,
        cart_type: i32,
    ) -> Result<Option<i32>> {
        let row: Option<(i32,)> = sqlx::query_as(
            "SELECT cart_id FROM cart
             WHERE user_id = ? AND product_id = ? AND type = ? AND (sku_id <=> ?) LIMIT 1",
        )
        .bind(user_id)
        .bind(product_id)
        .bind(cart_type)
        .bind(sku_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(id,)| id))
    }

    /// 累加购物车数量（再次购买命中已有行）。
    pub async fn add_cart_quantity(
        &self,
        cart_id: i32,
        quantity: i32,
        update_time: i32,
    ) -> Result<u64> {
        let affected = sqlx::query(
            "UPDATE cart SET quantity = quantity + ?, update_time = ? WHERE cart_id = ?",
        )
        .bind(quantity)
        .bind(update_time)
        .bind(cart_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?
        .rows_affected();
        Ok(affected)
    }

    /// 插入购物车行（Java `addProductToCart` 的落库部分，价格取订单快照）。
    #[allow(clippy::too_many_arguments)]
    pub async fn insert_cart_row(
        &self,
        user_id: i32,
        item: &OrderItemSeed,
        update_time: i32,
    ) -> Result<i32> {
        let cart_type = cart_type_from_product_type(Some(item.product_type));
        let sku_id = if item.sku_id > 0 {
            Some(item.sku_id)
        } else {
            None
        };
        let sku_data = if item.sku_data.trim().is_empty() {
            None
        } else {
            Some(item.sku_data.clone())
        };
        let extra_data = serde_json::json!({
            "isQuick": false,
            "buyAgain": true,
        })
        .to_string();
        let res = sqlx::query(
            "INSERT INTO cart
               (user_id, product_id, product_sn, pic_thumb, market_price, original_price,
                quantity, sku_id, sku_data, product_type, is_checked, shop_id, type,
                update_time, salesman_id, extra_data, is_wholesale_line, wholesale_grade_id)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, ?, 0, 0)",
        )
        .bind(user_id)
        .bind(item.product_id)
        .bind(&item.product_sn)
        .bind(&item.pic_thumb)
        .bind(item.price)
        .bind(item.quantity)
        .bind(sku_id)
        .bind(sku_data)
        .bind(item.product_type)
        .bind(item.shop_id)
        .bind(cart_type)
        .bind(update_time)
        .bind(extra_data)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(res.last_insert_id()).unwrap_or(i32::MAX))
    }

    // ————————————————————— 配置 / 物流 —————————————————————

    /// 读取配置值（Java `ConfigService#getConfigVal`，缺失 → `None`）。
    pub async fn find_config_value(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND is_del = 0 LIMIT 1",
        )
        .bind(biz_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|(value,)| value))
    }

    /// 物流公司是否存在（Java `logisticsCompanyMapper.selectById`）。
    pub async fn logistics_company_exists(&self, logistics_id: i32) -> Result<bool> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM logistics_company WHERE logistics_id = ?",
        )
        .bind(logistics_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.0 > 0)
    }
    /// 我的次卡列表。
    pub async fn cycle_cards(&self, user_id: i32, page: u64, size: u64) -> Result<(i64, Vec<serde_json::Value>)> {
        let offset = (page.max(1) - 1) * size;
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM order_cycle_card WHERE user_id = ?",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('cardId', card_id, 'orderId', order_id, 'orderSn', order_sn, 'shopId', shop_id, 'productId', product_id, 'skuId', sku_id, 'productName', product_name, 'productPic', product_pic, 'skuValue', sku_value, 'totalTimes', total_times, 'redeemedTimes', redeemed_times, 'remainingTimes', remaining_times, 'totalAmount', total_amount, 'effectiveTime', effective_time, 'expireTime', expire_time, 'status', status, 'createTime', create_time) FROM order_cycle_card WHERE user_id = ? ORDER BY card_id DESC LIMIT ? OFFSET ?",
        )
        .bind(user_id)
        .bind(size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((total, rows.into_iter().map(|(v,)| v).collect()))
    }

    pub async fn cycle_card(&self, user_id: i32, card_id: i32) -> Result<Option<serde_json::Value>> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('cardId', card_id, 'orderId', order_id, 'orderSn', order_sn, 'shopId', shop_id, 'productId', product_id, 'skuId', sku_id, 'productName', product_name, 'productPic', product_pic, 'skuValue', sku_value, 'totalTimes', total_times, 'redeemedTimes', redeemed_times, 'remainingTimes', remaining_times, 'totalAmount', total_amount, 'effectiveType', effective_type, 'effectiveTime', effective_time, 'expireTime', expire_time, 'validityType', validity_type, 'status', status, 'createTime', create_time, 'updateTime', update_time) FROM order_cycle_card WHERE card_id = ? AND user_id = ?",
        )
        .bind(card_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v))
    }

    pub async fn cycle_refund_info(&self, user_id: i32, card_id: i32) -> Result<Option<serde_json::Value>> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('cardId', card_id, 'totalTimes', total_times, 'redeemedTimes', redeemed_times, 'remainingTimes', remaining_times, 'totalAmount', total_amount, 'refundable', ROUND(total_amount * remaining_times / GREATEST(total_times, 1), 2), 'status', status) FROM order_cycle_card WHERE card_id = ? AND user_id = ?",
        )
        .bind(card_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v))
    }

    pub async fn cycle_aftersales_check(&self, user_id: i32, order_id: i32) -> Result<serde_json::Value> {
        let row: Option<(serde_json::Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('orderId', order_id, 'canAftersales', IF(COUNT(*) > 0, 1, 0), 'cardCount', COUNT(*)) FROM order_cycle_card WHERE order_id = ? AND user_id = ?",
        )
        .bind(order_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v).unwrap_or(serde_json::json!({"orderId": order_id, "canAftersales": 0, "cardCount": 0})))
    }
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

/// Java `getOrderStatusCount` 的公共过滤条件（不含 type 专属条件）。
const ORDER_COUNT_BASE: &str = "FROM `order` WHERE user_id = ? AND is_del = 0 AND is_valid = 1 \
     AND (parent_order_id IS NULL OR parent_order_id <= 0 OR pay_status <> 0 \
          OR is_cycle_order = 1 OR is_card_order = 1)";

/// 生成统计 SQL；返回值第 2 项表示是否需要额外绑定「已完成」状态码。
/// `column` 走白名单，未知列返回 `None`（由调用方转成错误）。
fn order_count_sql(column: &str) -> Option<(String, bool)> {
    let condition = match column {
        "order_status" => " AND order_status = ?",
        "comment_status" => " AND comment_status = ?",
        // Java `type = "order_comment_status"`：待评价 = 已完成且未评价
        "order_comment_status" => " AND comment_status = ? AND order_status = ?",
        _ => return None,
    };
    Some((
        format!("SELECT COUNT(*) {ORDER_COUNT_BASE}{condition}"),
        column == "order_comment_status",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cart_type_mapping_used_by_insert() {
        assert_eq!(cart_type_from_product_type(Some(1)), 1);
        assert_eq!(cart_type_from_product_type(Some(2)), 6);
    }

    #[test]
    fn repository_is_constructible_stub() {
        // 仅验证类型层面的可构造性（不连接数据库）。
        let _ = std::any::type_name::<UserOrderRepository>();
    }

    #[test]
    fn await_comment_count_requires_completed_order() {
        let (sql, bind_completed) = order_count_sql("order_comment_status").expect("白名单内");
        assert!(bind_completed, "order_comment_status 需额外绑定已完成状态");
        assert_eq!(ORDER_STATUS_COMPLETED, 5);
        assert!(sql.contains("comment_status = ?"));
        assert!(sql.contains("order_status = ?"));
        assert!(sql.contains("is_del = 0"));
        assert!(sql.contains("is_valid = 1"));
    }

    #[test]
    fn order_count_sql_whitelist_and_other_types() {
        assert!(order_count_sql("order_status").unwrap().0.contains("order_status = ?"));
        assert!(order_count_sql("comment_status").unwrap().0.contains("comment_status = ?"));
        assert!(!order_count_sql("order_status").unwrap().1);
        assert!(order_count_sql("1; DROP TABLE `order`").is_none());
    }
}
