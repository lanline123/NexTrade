//! o2o H5 前台仓储（o2o::pickup_client）。
//!
//! b2b2b 5.8.57 移动端新增接口（无 Java 控制器对应），按表实现：
//! - `user_pickup_info`：会员自提点/自提人信息 CRUD
//! - `shop_pickup_tpl`：门店自提模板读
//! - `order_pickup_shipment`：订单自提配送读
//! - `product_reservation_stock`：到店预约库存日历读（复用 admin 侧仓储逻辑）

use serde::Serialize;
use serde_json::Value;
use sqlx::MySqlPool;
use tigshop_core::{Error, Result};

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

/// 自提人信息（Java `UserPickupInfo`）。
#[derive(Debug, Clone, Default, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserPickupVO {
    pub user_pickup_id: i32,
    pub user_id: i32,
    pub consignee: String,
    pub mobile: String,
    pub mobile_area_code: String,
    pub is_default: i32,
    pub is_selected: i32,
}

/// 自提模板（Java `ShopPickupTpl` 子集）。
#[derive(Debug, Clone, Default, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopPickupTplVO {
    pub shop_pickup_tpl_id: i64,
    pub shop_id: i64,
    pub tpl_name: String,
    pub stocking_status: i32,
    pub stocking_json: Option<String>,
    pub pickup_time_status: i32,
    pub pickup_time_json: Option<String>,
    pub pickup_end_status: i32,
    pub pickup_end_json: Option<String>,
    pub is_default: i32,
}

/// 自提配送单（Java `OrderPickupShipment` 子集）。
#[derive(Debug, Clone, Default, sqlx::FromRow, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderPickupShipmentVO {
    pub shipment_id: i32,
    pub order_id: i32,
    pub pickup_sn: String,
    pub pickup_qr_code: Option<String>,
    pub shipment_status: i32,
    pub check_time: i32,
}

/// 库存日历行（到店预约：日期 × 余量）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockDayVO {
    pub day: String,
    pub total: i32,
    pub used: i32,
    pub available: i32,
}

#[derive(Clone)]
pub struct PickupClientRepository {
    pool: MySqlPool,
}

impl PickupClientRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 当前会员的自提人列表。
    pub async fn list_by_user(&self, user_id: i32) -> Result<Vec<UserPickupVO>> {
        sqlx::query_as::<_, UserPickupVO>(
            "SELECT user_pickup_id, user_id, consignee, mobile, mobile_area_code, \
             is_default, is_selected FROM user_pickup_info \
             WHERE user_id = ? ORDER BY is_default DESC, user_pickup_id DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 单条（校验归属）。
    pub async fn find_owned(&self, user_id: i32, id: i32) -> Result<Option<UserPickupVO>> {
        sqlx::query_as::<_, UserPickupVO>(
            "SELECT user_pickup_id, user_id, consignee, mobile, mobile_area_code, \
             is_default, is_selected FROM user_pickup_info \
             WHERE user_id = ? AND user_pickup_id = ?",
        )
        .bind(user_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 新增；`is_default=1` 时清除其它默认。
    pub async fn create(
        &self,
        user_id: i32,
        consignee: &str,
        mobile: &str,
        area_code: &str,
        is_default: bool,
    ) -> Result<i32> {
        let mut tx = self.pool.begin().await.map_err(map_err)?;
        if is_default {
            sqlx::query("UPDATE user_pickup_info SET is_default = 0 WHERE user_id = ?")
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(map_err)?;
        }
        let r = sqlx::query(
            "INSERT INTO user_pickup_info (user_id, consignee, mobile, mobile_area_code, \
             is_default, is_selected) VALUES (?, ?, ?, ?, ?, 0)",
        )
        .bind(user_id)
        .bind(consignee)
        .bind(mobile)
        .bind(area_code)
        .bind(i32::from(is_default))
        .execute(&mut *tx)
        .await
        .map_err(map_err)?;
        tx.commit().await.map_err(map_err)?;
        Ok(r.last_insert_id() as i32)
    }

    /// 更新（只更新提供的字段）；`is_default=1` 时清除其它默认。
    pub async fn update(
        &self,
        user_id: i32,
        id: i32,
        consignee: Option<&str>,
        mobile: Option<&str>,
        area_code: Option<&str>,
        is_default: Option<bool>,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await.map_err(map_err)?;
        if is_default == Some(true) {
            sqlx::query("UPDATE user_pickup_info SET is_default = 0 WHERE user_id = ?")
                .bind(user_id)
                .execute(&mut *tx)
                .await
                .map_err(map_err)?;
        }
        if let Some(v) = consignee {
            sqlx::query("UPDATE user_pickup_info SET consignee = ? WHERE user_id = ? AND user_pickup_id = ?")
                .bind(v).bind(user_id).bind(id)
                .execute(&mut *tx).await.map_err(map_err)?;
        }
        if let Some(v) = mobile {
            sqlx::query("UPDATE user_pickup_info SET mobile = ? WHERE user_id = ? AND user_pickup_id = ?")
                .bind(v).bind(user_id).bind(id)
                .execute(&mut *tx).await.map_err(map_err)?;
        }
        if let Some(v) = area_code {
            sqlx::query("UPDATE user_pickup_info SET mobile_area_code = ? WHERE user_id = ? AND user_pickup_id = ?")
                .bind(v).bind(user_id).bind(id)
                .execute(&mut *tx).await.map_err(map_err)?;
        }
        if let Some(v) = is_default {
            sqlx::query("UPDATE user_pickup_info SET is_default = ? WHERE user_id = ? AND user_pickup_id = ?")
                .bind(i32::from(v)).bind(user_id).bind(id)
                .execute(&mut *tx).await.map_err(map_err)?;
        }
        tx.commit().await.map_err(map_err)
    }

    /// 删除（校验归属）。
    pub async fn delete(&self, user_id: i32, id: i32) -> Result<()> {
        sqlx::query("DELETE FROM user_pickup_info WHERE user_id = ? AND user_pickup_id = ?")
            .bind(user_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    /// 门店自提模板：门店级优先，缺省回退平台默认（`shop_id=0`）。
    pub async fn find_pickup_tpl(&self, shop_id: i64) -> Result<Option<ShopPickupTplVO>> {
        let row = sqlx::query_as::<_, ShopPickupTplVO>(
            "SELECT shop_pickup_tpl_id, shop_id, tpl_name, stocking_status, stocking_json, \
             pickup_time_status, pickup_time_json, pickup_end_status, pickup_end_json, is_default \
             FROM shop_pickup_tpl WHERE shop_id = ? ORDER BY is_default DESC LIMIT 1",
        )
        .bind(shop_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        if row.is_some() {
            return Ok(row);
        }
        sqlx::query_as::<_, ShopPickupTplVO>(
            "SELECT shop_pickup_tpl_id, shop_id, tpl_name, stocking_status, stocking_json, \
             pickup_time_status, pickup_time_json, pickup_end_status, pickup_end_json, is_default \
             FROM shop_pickup_tpl WHERE shop_id = 0 ORDER BY is_default DESC LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 订单自提配送单。
    pub async fn find_shipment_by_order(
        &self,
        order_id: i32,
    ) -> Result<Option<OrderPickupShipmentVO>> {
        sqlx::query_as::<_, OrderPickupShipmentVO>(
            "SELECT shipment_id, order_id, pickup_sn, pickup_qr_code, shipment_status, check_time \
             FROM order_pickup_shipment WHERE order_id = ? ORDER BY shipment_id DESC LIMIT 1",
        )
        .bind(order_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 门店商品搜索（按 shop_id 过滤上架商品，名称模糊）。
    ///
    /// 返回 `(total, records)`；records 为前端消费的 camelCase JSON 行。
    pub async fn store_product_search(
        &self,
        shop_id: i64,
        keyword: &str,
        limit: u64,
        offset: u64,
    ) -> Result<(i64, Vec<serde_json::Value>)> {
        let kw = format!("%{}%", keyword.trim());
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM product WHERE shop_id = ? AND product_status = 1              AND product_name LIKE ?",
        )
        .bind(shop_id)
        .bind(&kw)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        let rows = sqlx::query_as::<_, (serde_json::Value,)>(
            "SELECT JSON_OBJECT('productId', product_id, 'productName', product_name,              'picThumb', pic_thumb, 'productPrice', product_price, 'marketPrice', market_price,              'productStock', product_stock)              FROM product WHERE shop_id = ? AND product_status = 1 AND product_name LIKE ?              ORDER BY product_id DESC LIMIT ? OFFSET ?",
        )
        .bind(shop_id)
        .bind(&kw)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        let rows = rows.into_iter().map(|(v,)| v).collect::<Vec<_>>();
        Ok((total.max(0), rows))
    }

    /// 到店预约库存日历：某商品（+可选门店）未来 `days` 天的余量。
    ///
    /// `product_reservation_stock` 行语义：available = total - used（见 admin 侧
    /// StockCalendarRepository 同口径）。
    pub async fn stock_calendar(
        &self,
        product_id: i32,
        shop_id: Option<i64>,
        days: u32,
    ) -> Result<Vec<StockDayVO>> {
        let today = chrono::Utc::now().date_naive();
        let end = today + chrono::Duration::days(i64::from(days.min(31)));
        let rows: Vec<(String, i32, i32)> = match shop_id {
            Some(sid) => sqlx::query_as(
                "SELECT stock_date, total_stock, used_stock FROM product_reservation_stock \
                 WHERE product_id = ? AND shop_id = ? AND stock_date BETWEEN ? AND ? \
                 ORDER BY stock_date",
            )
            .bind(product_id)
            .bind(sid)
            .bind(today.format("%Y-%m-%d").to_string())
            .bind(end.format("%Y-%m-%d").to_string())
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?,
            None => sqlx::query_as(
                "SELECT stock_date, SUM(total_stock), SUM(used_stock) \
                 FROM product_reservation_stock \
                 WHERE product_id = ? AND stock_date BETWEEN ? AND ? \
                 GROUP BY stock_date ORDER BY stock_date",
            )
            .bind(product_id)
            .bind(today.format("%Y-%m-%d").to_string())
            .bind(end.format("%Y-%m-%d").to_string())
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?,
        };
        Ok(rows
            .into_iter()
            .map(|(day, total, used)| StockDayVO {
                available: (total - used).max(0),
                day,
                total,
                used,
            })
            .collect())
    }

    // ————————————————————— C 端派送员/服务员 —————————————————————

    /// 当前会员绑定的服务人员。
    pub async fn staff_by_member(&self, member_id: i32) -> Result<Option<(i32, String, String, i32)>> {
        sqlx::query_as(
            "SELECT id, name, phone, type FROM service_staff WHERE member_id = ? AND is_delete = 0 LIMIT 1",
        )
        .bind(member_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 服务人员资料（C 端 myInfo）。
    pub async fn staff_info_by_member(&self, member_id: i32) -> Result<Option<Value>> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('id', id, 'name', name, 'nickname', nickname, 'avatar', avatar, 'phone', phone, 'storeId', store_id, 'type', type, 'status', status, 'workStatus', work_status, 'completedOrderCount', completed_order_count, 'completedOrderAmount', completed_order_amount) FROM service_staff WHERE member_id = ? AND is_delete = 0 LIMIT 1",
        )
        .bind(member_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v))
    }

    /// 更新工作状态（C 端上下班/空闲/忙碌）。
    pub async fn update_work_status(&self, member_id: i32, work_status: i32) -> Result<bool> {
        let r = sqlx::query("UPDATE service_staff SET work_status = ? WHERE member_id = ? AND is_delete = 0")
            .bind(work_status)
            .bind(member_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 个人钱包。
    pub async fn wallet_by_staff(&self, staff_id: i32) -> Result<Value> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('walletId', wallet_id, 'staffId', staff_id, 'balance', balance, 'frozenBalance', frozen_balance, 'totalIncome', total_income, 'createTime', create_time, 'updateTime', update_time) FROM service_staff_wallet WHERE staff_id = ?",
        )
        .bind(staff_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row
            .map(|(v,)| v)
            .unwrap_or_else(|| serde_json::json!({"walletId": 0, "staffId": staff_id, "balance": 0, "frozenBalance": 0, "totalIncome": 0})))
    }

    /// 个人钱包流水。
    pub async fn wallet_logs(&self, staff_id: i32, page: u64, size: u64) -> Result<(i64, Vec<Value>)> {
        let offset = (page.max(1) - 1) * size;
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM service_staff_wallet_log WHERE staff_id = ?",
        )
        .bind(staff_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        let rows: Vec<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('logId', log_id, 'staffId', staff_id, 'orderId', order_id, 'withdrawId', withdraw_id, 'transactionSn', transaction_sn, 'amount', amount, 'balanceAfter', balance_after, 'frozenAfter', frozen_after, 'businessType', business_type, 'type', type, 'remark', remark, 'createTime', create_time) FROM service_staff_wallet_log WHERE staff_id = ? ORDER BY log_id DESC LIMIT ? OFFSET ?",
        )
        .bind(staff_id)
        .bind(size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((total, rows.into_iter().map(|(v,)| v).collect()))
    }

    // ————————————————————— 收款账号 / 提现查询 —————————————————————

    pub async fn accounts_of_user(&self, user_id: i32) -> Result<Vec<Value>> {
        let rows: Vec<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('accountId', account_id, 'accountType', account_type, 'accountName', account_name, 'accountNo', account_no, 'bankName', bank_name, 'identity', identity) FROM user_withdraw_account WHERE user_id = ? ORDER BY account_id DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(rows.into_iter().map(|(v,)| v).collect())
    }

    pub async fn save_account(
        &self,
        user_id: i32,
        account_id: i32,
        account_type: i32,
        account_name: &str,
        account_no: &str,
        bank_name: &str,
    ) -> Result<i32> {
        if account_id > 0 {
            sqlx::query("UPDATE user_withdraw_account SET account_type = ?, account_name = ?, account_no = ?, bank_name = ? WHERE account_id = ? AND user_id = ?")
                .bind(account_type)
                .bind(account_name)
                .bind(account_no)
                .bind(bank_name)
                .bind(account_id)
                .bind(user_id)
                .execute(&self.pool)
                .await
                .map_err(map_err)?;
            Ok(account_id)
        } else {
            let r = sqlx::query("INSERT INTO user_withdraw_account (user_id, account_type, account_name, account_no, bank_name) VALUES (?, ?, ?, ?, ?)")
                .bind(user_id)
                .bind(account_type)
                .bind(account_name)
                .bind(account_no)
                .bind(bank_name)
                .execute(&self.pool)
                .await
                .map_err(map_err)?;
            Ok(i32::try_from(r.last_insert_id()).unwrap_or(0))
        }
    }

    pub async fn delete_account(&self, user_id: i32, account_id: i32) -> Result<()> {
        sqlx::query("DELETE FROM user_withdraw_account WHERE account_id = ? AND user_id = ?")
            .bind(account_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(())
    }

    pub async fn withdraw_list(
        &self,
        staff_id: i32,
        status: Option<i32>,
        page: u64,
        size: u64,
    ) -> Result<(i64, Vec<Value>)> {
        let offset = (page.max(1) - 1) * size;
        let status = status.unwrap_or(-1);
        let (total,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM service_staff_withdraw WHERE staff_id = ? AND is_delete = 0 AND (? = -1 OR status = ?)",
        )
        .bind(staff_id)
        .bind(status)
        .bind(status)
        .fetch_one(&self.pool)
        .await
        .map_err(map_err)?;
        let rows: Vec<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('withdrawId', withdraw_id, 'withdrawSn', withdraw_sn, 'staffId', staff_id, 'businessType', business_type, 'amount', amount, 'status', status, 'accountId', account_id, 'accountType', account_type, 'accountName', account_name, 'accountNo', account_no, 'bankName', bank_name, 'adminRemark', admin_remark, 'paymentVoucher', payment_voucher, 'rejectReason', reject_reason, 'applyTime', apply_time, 'auditTime', audit_time) FROM service_staff_withdraw WHERE staff_id = ? AND is_delete = 0 AND (? = -1 OR status = ?) ORDER BY withdraw_id DESC LIMIT ? OFFSET ?",
        )
        .bind(staff_id)
        .bind(status)
        .bind(status)
        .bind(size)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        Ok((total, rows.into_iter().map(|(v,)| v).collect()))
    }

    pub async fn withdraw_detail(&self, staff_id: i32, id: i32) -> Result<Option<Value>> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('withdrawId', withdraw_id, 'withdrawSn', withdraw_sn, 'staffId', staff_id, 'businessType', business_type, 'amount', amount, 'status', status, 'accountId', account_id, 'accountType', account_type, 'accountName', account_name, 'accountNo', account_no, 'bankName', bank_name, 'adminRemark', admin_remark, 'paymentVoucher', payment_voucher, 'rejectReason', reject_reason, 'applyTime', apply_time, 'auditTime', audit_time) FROM service_staff_withdraw WHERE withdraw_id = ? AND staff_id = ? AND is_delete = 0",
        )
        .bind(id)
        .bind(staff_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v))
    }

    /// 申请提现：冻结余额 + 提现单 + 流水，单事务。
    pub async fn apply_withdraw(
        &self,
        staff_id: i32,
        business_type: i32,
        amount: rust_decimal::Decimal,
        account_id: i32,
        remark: &str,
    ) -> Result<i32> {
        if amount <= rust_decimal::Decimal::ZERO {
            return Err(Error::Validation("提现金额必须大于 0".into()));
        }
        let mut tx = self.pool.begin().await.map_err(map_err)?;
        let account: Option<(i32, String, String, String)> = sqlx::query_as(
            "SELECT account_type, account_name, account_no, bank_name FROM user_withdraw_account WHERE account_id = ?",
        )
        .bind(account_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_err)?;
        let (account_type, account_name, account_no, bank_name) =
            account.ok_or_else(|| Error::Validation("收款账号不存在".into()))?;
        let balance: Option<(rust_decimal::Decimal,)> = sqlx::query_as(
            "SELECT balance FROM service_staff_wallet WHERE staff_id = ? FOR UPDATE",
        )
        .bind(staff_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_err)?;
        let Some((balance,)) = balance else {
            return Err(Error::Validation("钱包不存在".into()));
        };
        if balance < amount {
            return Err(Error::Validation("可提现余额不足".into()));
        }
        let now = tigshop_common::utils::now_seconds() as i64;
        let withdraw_sn = format!("WD{now}{staff_id}");
        let r = sqlx::query(
            "INSERT INTO service_staff_withdraw (withdraw_sn, staff_id, business_type, amount, status, account_id, account_type, account_name, account_no, bank_name, apply_time, frequency_unit, period_start, period_end, create_time, update_time) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'day', ?, ?, ?, ?)",
        )
        .bind(&withdraw_sn)
        .bind(staff_id)
        .bind(business_type)
        .bind(amount)
        .bind(account_id)
        .bind(account_type)
        .bind(&account_name)
        .bind(&account_no)
        .bind(&bank_name)
        .bind(now)
        .bind(now / 86400 * 86400)
        .bind(now / 86400 * 86400 + 86400)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(map_err)?;
        let withdraw_id = i32::try_from(r.last_insert_id()).unwrap_or(0);
        sqlx::query("UPDATE service_staff_wallet SET balance = balance - ?, frozen_balance = frozen_balance + ?, update_time = ? WHERE staff_id = ?")
            .bind(amount)
            .bind(amount)
            .bind(now)
            .bind(staff_id)
            .execute(&mut *tx)
            .await
            .map_err(map_err)?;
        sqlx::query("INSERT INTO service_staff_wallet_log (staff_id, amount, balance_after, frozen_after, business_type, type, remark, create_time) VALUES (?, ?, ?, ?, ?, 4, ?, ?)")
            .bind(staff_id)
            .bind(-amount)
            .bind(balance - amount)
            .bind(amount)
            .bind(business_type)
            .bind(remark)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(map_err)?;
        tx.commit().await.map_err(map_err)?;
        Ok(withdraw_id)
    }

    /// 门店同城配送配置 + 距离溢价。
    pub async fn local_delivery_config(&self, shop_id: i32) -> Result<Value> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('shopId', shop_id, 'enabled', enabled, 'deliveryRadius', delivery_radius, 'minOrderAmount', min_order_amount, 'baseDeliveryFee', base_delivery_fee, 'distancePricingEnabled', distance_pricing_enabled) FROM shop_local_delivery_config WHERE shop_id = ?",
        )
        .bind(shop_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        let Some((mut obj,)) = row else { return Ok(Value::Null) };
        let rows: Vec<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('distanceThreshold', p.distance_threshold, 'distanceUnit', p.distance_unit, 'additionalFee', p.additional_fee) FROM shop_local_delivery_distance_pricing p JOIN shop_local_delivery_config c ON c.shop_local_delivery_config_id = p.shop_local_delivery_config_id WHERE c.shop_id = ? ORDER BY p.sort_order",
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        obj["distancePricing"] = Value::Array(rows.into_iter().map(|(v,)| v).collect());
        Ok(obj)
    }

    /// 门店上门服务配置 + 距离溢价。
    pub async fn home_service_config(&self, shop_id: i32) -> Result<Value> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('shopId', shop_id, 'enabled', enabled, 'serviceRadius', service_radius, 'homeFee', home_fee, 'distancePricingEnabled', distance_pricing_enabled, 'orderDispatchMode', order_dispatch_mode, 'beforeServicePhotoEnabled', before_service_photo_enabled, 'afterServicePhotoEnabled', after_service_photo_enabled) FROM shop_home_service_config WHERE shop_id = ?",
        )
        .bind(shop_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        let Some((mut obj,)) = row else { return Ok(Value::Null) };
        let rows: Vec<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('distanceThreshold', p.distance_threshold, 'distanceUnit', p.distance_unit, 'additionalFee', p.additional_fee) FROM shop_home_service_distance_pricing p JOIN shop_home_service_config c ON c.shop_home_service_config_id = p.shop_home_service_config_id WHERE c.shop_id = ? ORDER BY p.sort_order",
        )
        .bind(shop_id)
        .fetch_all(&self.pool)
        .await
        .map_err(map_err)?;
        obj["distancePricing"] = Value::Array(rows.into_iter().map(|(v,)| v).collect());
        Ok(obj)
    }

    pub async fn delivery_list(
        &self,
        staff_id: i32,
        tab: Option<&str>,
        page: u64,
        size: u64,
    ) -> Result<(i64, Vec<Value>)> {
        let (status_cond, status_val) = match tab.unwrap_or_default() {
            "pending" => ("AND status = ?", Some(20)),
            "processing" => ("AND status = ?", Some(30)),
            "completed" => ("AND status = ?", Some(40)),
            _ => ("", None),
        };
        let offset = (page.max(1) - 1) * size;
        let count_sql = format!(
            "SELECT COUNT(*) FROM delivery_order WHERE staff_id = ? {status_cond}"
        );
        let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql)
        .bind(staff_id);
        if let Some(v) = status_val {
            count_q = count_q.bind(v);
        }
        let (total,) = count_q.fetch_one(&self.pool).await.map_err(map_err)?;
        let list_sql = format!(
            "SELECT JSON_OBJECT('deliveryOrderId', delivery_order_id, 'deliveryOrderSn', delivery_order_sn, 'orderId', order_id, 'orderSn', order_sn, 'shopId', shop_id, 'type', type, 'dispatchMode', dispatch_mode, 'status', status, 'staffId', staff_id, 'staffName', staff_name, 'staffPhone', staff_phone, 'consignee', consignee, 'mobile', mobile, 'address', address, 'regionNames', region_names, 'orderAmount', order_amount, 'buyerNote', buyer_note, 'dispatchTime', dispatch_time, 'grabTime', grab_time, 'pickupTime', pickup_time, 'completeTime', complete_time, 'cancelTime', cancel_time, 'cancelReason', cancel_reason, 'createTime', create_time) FROM delivery_order WHERE staff_id = ? {status_cond} ORDER BY delivery_order_id DESC LIMIT ? OFFSET ?"
        );
        let mut q = sqlx::query_as::<_, (Value,)>(&list_sql)
        .bind(staff_id);
        if let Some(v) = status_val {
            q = q.bind(v);
        }
        let rows = q.bind(size).bind(offset).fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total, rows.into_iter().map(|(v,)| v).collect()))
    }

    /// C 端派送订单详情（只允许本人订单）。
    pub async fn delivery_detail(&self, staff_id: i32, id: i32) -> Result<Option<Value>> {
        let row: Option<(Value,)> = sqlx::query_as(
            "SELECT JSON_OBJECT('deliveryOrderId', delivery_order_id, 'deliveryOrderSn', delivery_order_sn, 'orderId', order_id, 'orderSn', order_sn, 'shopId', shop_id, 'type', type, 'dispatchMode', dispatch_mode, 'status', status, 'staffId', staff_id, 'staffName', staff_name, 'staffPhone', staff_phone, 'consignee', consignee, 'mobile', mobile, 'address', address, 'regionNames', region_names, 'latitude', latitude, 'longitude', longitude, 'pickupAddress', pickup_address, 'pickupPhone', pickup_phone, 'serviceTime', service_time, 'orderAmount', order_amount, 'buyerNote', buyer_note, 'dispatchTime', dispatch_time, 'grabTime', grab_time, 'pickupTime', pickup_time, 'completeTime', complete_time, 'cancelTime', cancel_time, 'cancelReason', cancel_reason, 'createTime', create_time) FROM delivery_order WHERE delivery_order_id = ? AND staff_id = ?",
        )
        .bind(id)
        .bind(staff_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.map(|(v,)| v))
    }

    /// 抢单：仅待派发且抢单模式的订单。
    pub async fn grab_delivery(&self, staff_id: i32, name: &str, phone: &str, id: i32) -> Result<bool> {
        let now = tigshop_common::utils::now_seconds() as i32;
        let r = sqlx::query(
            "UPDATE delivery_order SET staff_id = ?, staff_name = ?, staff_phone = ?, status = 20, grab_time = ? WHERE delivery_order_id = ? AND status = 10 AND dispatch_mode = 1 AND staff_id IS NULL",
        )
        .bind(staff_id)
        .bind(name)
        .bind(phone)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 确认取货/开始服务。
    pub async fn confirm_pickup(&self, staff_id: i32, id: i32, photos: &str) -> Result<bool> {
        let now = tigshop_common::utils::now_seconds() as i32;
        let r = sqlx::query(
            "UPDATE delivery_order SET status = 30, pickup_time = ?, pickup_photo = ? WHERE delivery_order_id = ? AND staff_id = ? AND status = 20",
        )
        .bind(now)
        .bind(photos)
        .bind(id)
        .bind(staff_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 完成配送/服务。
    pub async fn complete_delivery(&self, staff_id: i32, id: i32, photos: &str) -> Result<bool> {
        let now = tigshop_common::utils::now_seconds() as i32;
        let r = sqlx::query(
            "UPDATE delivery_order SET status = 40, complete_time = ?, complete_photo = ? WHERE delivery_order_id = ? AND staff_id = ? AND status = 30",
        )
        .bind(now)
        .bind(photos)
        .bind(id)
        .bind(staff_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// C 端取消。
    pub async fn cancel_delivery(&self, staff_id: i32, id: i32, reason: &str) -> Result<bool> {
        let now = tigshop_common::utils::now_seconds() as i32;
        let r = sqlx::query(
            "UPDATE delivery_order SET status = 50, cancel_reason = ?, cancel_time = ? WHERE delivery_order_id = ? AND staff_id = ? AND status IN (20,30)",
        )
        .bind(reason)
        .bind(now)
        .bind(id)
        .bind(staff_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 待抢单列表（抢单模式、未分配）。
    pub async fn grab_list(&self, page: u64, size: u64, r#type: Option<i32>) -> Result<(i64, Vec<Value>)> {
        let offset = (page.max(1) - 1) * size;
        let type_cond = r#type.map(|_| "AND type = ?").unwrap_or("");
        let count_sql = format!(
            "SELECT COUNT(*) FROM delivery_order WHERE status = 10 AND dispatch_mode = 1 AND staff_id IS NULL {type_cond}"
        );
        let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
        if let Some(t) = r#type {
            cq = cq.bind(t);
        }
        let (total,) = cq.fetch_one(&self.pool).await.map_err(map_err)?;
        let list_sql = format!(
            "SELECT JSON_OBJECT('deliveryOrderId', delivery_order_id, 'deliveryOrderSn', delivery_order_sn, 'orderId', order_id, 'orderSn', order_sn, 'shopId', shop_id, 'type', type, 'status', status, 'consignee', consignee, 'mobile', mobile, 'address', address, 'regionNames', region_names, 'orderAmount', order_amount, 'createTime', create_time) FROM delivery_order WHERE status = 10 AND dispatch_mode = 1 AND staff_id IS NULL {type_cond} ORDER BY delivery_order_id DESC LIMIT ? OFFSET ?"
        );
        let mut q = sqlx::query_as::<_, (Value,)>(&list_sql);
        if let Some(t) = r#type {
            q = q.bind(t);
        }
        let rows = q.bind(size).bind(offset).fetch_all(&self.pool).await.map_err(map_err)?;
        Ok((total, rows.into_iter().map(|(v,)| v).collect()))
    }
}
