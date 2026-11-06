//! 商户账户域仓储（merchant::merchant_account）。
//!
//! 表：`merchant_account`（账户）/ `shop`（店铺→商户）/ `merchant`（商户存在性）/
//! `admin_user`（归属校验）/ `config`（提现方式白名单）。
//!
//! 对应 Java `MerchantAccountServiceImpl`（`MerchantAccountMapper` + `shopMapper` +
//! `merchantMapper` + `adminUserMapper` + `configService`）。
//! 运行时 `sqlx`（**不用** `query!` 宏）；每条 SQL 单行字面量。

use sqlx::MySqlPool;
use tigshop_core::entities::MerchantAccount;
use tigshop_core::models::merchant::merchant_account::MerchantAccountListQuery;
use tigshop_core::{Error, Result};

/// 账户 9 列。
const COLUMNS: &str = "account_id, merchant_id, account_type, account_name, account_no, bank_name, add_time, bank_branch, shop_id";

/// 商户账户域仓储。
#[derive(Clone)]
pub struct MerchantAccountRepository {
    pool: MySqlPool,
}

impl MerchantAccountRepository {
    #[must_use]
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 账户分页（Java `list`：`eq(shopId>0)` + `in(accountType, allowed)` + `buildSortOrder`）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn paginate(
        &self,
        shop_id: Option<i32>,
        allowed_types: &[i32],
        q: &MerchantAccountListQuery,
    ) -> Result<(u64, Vec<MerchantAccount>)> {
        let mut conds: Vec<String> = Vec::new();
        if shop_id.is_some_and(|s| s > 0) {
            conds.push("shop_id = ?".to_string());
        }
        if !allowed_types.is_empty() {
            let ph = vec!["?"; allowed_types.len()].join(", ");
            conds.push(format!("account_type IN ({ph})"));
        }
        let where_sql = if conds.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conds.join(" AND "))
        };
        let (page, size) = q.page_params();
        let sort = sort_column(q);
        let count_sql = format!("SELECT COUNT(*) FROM merchant_account{where_sql}");
        let mut cq = sqlx::query_as::<_, (i64,)>(&count_sql);
        if let Some(s) = shop_id.filter(|s| *s > 0) {
            cq = cq.bind(s);
        }
        for t in allowed_types {
            cq = cq.bind(*t);
        }
        let total: (i64,) = cq.fetch_one(&self.pool).await.map_err(map_err)?;

        let list_sql =
            format!("SELECT {COLUMNS} FROM merchant_account{where_sql} ORDER BY {sort} LIMIT ? OFFSET ?");
        let mut lq = sqlx::query_as::<_, MerchantAccount>(&list_sql);
        if let Some(s) = shop_id.filter(|s| *s > 0) {
            lq = lq.bind(s);
        }
        for t in allowed_types {
            lq = lq.bind(*t);
        }
        let rows = lq
            .bind(i64::try_from(size).unwrap_or(15))
            .bind(i64::try_from((page - 1) * size).unwrap_or(0))
            .fetch_all(&self.pool)
            .await
            .map_err(map_err)?;
        Ok((u64::try_from(total.0).unwrap_or(0), rows))
    }

    /// 按主键查询（Java `getById`）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn find_by_id(&self, id: i32) -> Result<Option<MerchantAccount>> {
        sqlx::query_as::<_, MerchantAccount>(&format!(
            "SELECT {COLUMNS} FROM merchant_account WHERE account_id = ? LIMIT 1"
        ))
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }

    /// 插入账户（Java `this.save(merchantAccount)`）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    #[allow(clippy::too_many_arguments)]
    pub async fn insert(
        &self,
        merchant_id: i32,
        account_type: i32,
        account_name: &str,
        account_no: &str,
        bank_name: &str,
        add_time: i32,
        bank_branch: Option<&str>,
        shop_id: Option<i32>,
    ) -> Result<i32> {
        let r = sqlx::query(
            "INSERT INTO merchant_account (merchant_id, account_type, account_name, account_no, bank_name, add_time, bank_branch, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(merchant_id)
        .bind(account_type)
        .bind(account_name)
        .bind(account_no)
        .bind(bank_name)
        .bind(add_time)
        .bind(bank_branch)
        .bind(shop_id)
        .execute(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(i32::try_from(r.last_insert_id()).unwrap_or(0))
    }

    /// 更新账户（Java `updateById`，只写非 null 字段）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn update(
        &self,
        id: i32,
        account_type: Option<i32>,
        account_name: Option<&str>,
        account_no: Option<&str>,
        bank_name: Option<&str>,
        bank_branch: Option<&str>,
        shop_scope: Option<i32>,
    ) -> Result<bool> {
        let mut sets: Vec<&str> = Vec::new();
        if account_type.is_some() {
            sets.push("account_type = ?");
        }
        if account_name.is_some() {
            sets.push("account_name = ?");
        }
        if account_no.is_some() {
            sets.push("account_no = ?");
        }
        if bank_name.is_some() {
            sets.push("bank_name = ?");
        }
        if bank_branch.is_some() {
            sets.push("bank_branch = ?");
        }
        if sets.is_empty() {
            return Ok(false);
        }
        // 多租户：店铺账号的更新语句追加 `shop_id` 条件。
        let sql = format!(
            "UPDATE merchant_account SET {} WHERE account_id = ? AND (? IS NULL OR shop_id = ?)",
            sets.join(", ")
        );
        let mut q = sqlx::query(&sql);
        if let Some(v) = account_type {
            q = q.bind(v);
        }
        if let Some(v) = account_name {
            q = q.bind(v);
        }
        if let Some(v) = account_no {
            q = q.bind(v);
        }
        if let Some(v) = bank_name {
            q = q.bind(v);
        }
        if let Some(v) = bank_branch {
            q = q.bind(v);
        }
        let r = q
            .bind(id)
            .bind(shop_scope)
            .bind(shop_scope)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 删除（Java `BaseServiceImpl#del`）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn delete(&self, id: i32, shop_scope: Option<i32>) -> Result<bool> {
        // 多租户：店铺账号只能删除本店账户。
        let r = sqlx::query(
            "DELETE FROM merchant_account WHERE account_id = ? AND (? IS NULL OR shop_id = ?)",
        )
        .bind(id)
        .bind(shop_scope)
        .bind(shop_scope)
            .execute(&self.pool)
            .await
            .map_err(map_err)?;
        Ok(r.rows_affected() > 0)
    }

    /// 批量删除（Java `BaseServiceImpl#batch` 的 `del` 分支）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn delete_many(&self, ids: &[i32], shop_scope: Option<i32>) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        // 多租户：店铺账号批量删除仅作用于本店账户。
        let ph = vec!["?"; ids.len()].join(", ");
        let sql = format!(
            "DELETE FROM merchant_account WHERE account_id IN ({ph}) AND (? IS NULL OR shop_id = ?)"
        );
        let mut q = sqlx::query(&sql);
        for id in ids {
            q = q.bind(*id);
        }
        q = q.bind(shop_scope).bind(shop_scope);
        Ok(q.execute(&self.pool).await.map_err(map_err)?.rows_affected())
    }

    /// 店铺所属商户 id（Java `shopService.getById(shopId).getMerchantId()`；店铺不存在 → None）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn shop_merchant_id(&self, shop_id: i32) -> Result<Option<i32>> {
        let row: Option<(Option<i32>,)> =
            sqlx::query_as("SELECT merchant_id FROM shop WHERE shop_id = ? LIMIT 1")
                .bind(shop_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(|(m,)| m.unwrap_or(0)))
    }

    /// 商户是否存在（Java `merchantMapper.selectById == null` 判断）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn merchant_exists(&self, merchant_id: i32) -> Result<bool> {
        let (n,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM merchant WHERE merchant_id = ?")
                .bind(merchant_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(n > 0)
    }

    /// 管理员所属商户（Java `checkMerchantAuth`：`admin_user.merchant_id`）。
    ///
    /// 返回 `None` 表示管理员不存在（Java 此时直接放行）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn admin_merchant_id(&self, admin_id: i32) -> Result<Option<i32>> {
        let row: Option<(Option<i32>,)> =
            sqlx::query_as("SELECT merchant_id FROM admin_user WHERE admin_id = ? LIMIT 1")
                .bind(admin_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.map(|(m,)| m.unwrap_or(0)))
    }

    /// 配置值（Java `configService.getConfigVal(WITHDRAWAL_RECEIPT_METHOD)`）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn config_value(&self, biz_code: &str) -> Result<Option<String>> {
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT biz_val FROM config WHERE biz_code = ? AND (is_del IS NULL OR is_del = 0) LIMIT 1",
        )
        .bind(biz_code)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)?;
        Ok(row.and_then(|(v,)| v))
    }
}

/// 排序字段（Java `buildSortOrder`：空 → 主键列；白名单，未知回退 `account_id`）。
#[must_use]
fn sort_column(q: &MerchantAccountListQuery) -> String {
    const SORTABLE: [(&str, &str); 5] = [
        ("accountId", "account_id"),
        ("accountType", "account_type"),
        ("accountName", "account_name"),
        ("addTime", "add_time"),
        ("shopId", "shop_id"),
    ];
    let field = q
        .sort_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("account_id");
    let column = SORTABLE
        .iter()
        .find(|(p, c)| *p == field || *c == field)
        .map_or("account_id", |(_, c)| *c);
    let dir = if q
        .sort_order
        .as_deref()
        .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    {
        "ASC"
    } else {
        "DESC"
    };
    format!("{column} {dir}")
}

fn map_err(e: sqlx::Error) -> Error {
    Error::Database(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_column_is_whitelisted() {
        let q = MerchantAccountListQuery::default();
        assert_eq!(sort_column(&q), "account_id DESC");
        let q = MerchantAccountListQuery {
            sort_field: Some("accountType".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(sort_column(&q), "account_type ASC");
        let q = MerchantAccountListQuery {
            sort_field: Some("account_id; DROP TABLE merchant_account".into()),
            ..Default::default()
        };
        assert_eq!(sort_column(&q), "account_id DESC");
    }
}
