//! 代客下单商品管理域仓储（trade::proxy_shopping_product）。
//!
//! 只承载 [`tigshop_services::trade::proxy_shopping_product::ProxyShoppingProductService`] 独有的查询：
//! `product_attributes`（附加规格价 / 规格缩略图）、`e_card`（卡密商品可用库存）、
//! `gift_card_groups`（礼品卡组可用库存与状态）。
//!
//! 商品主表 / 规格表 / 商品列表分页**直接复用** `repos.catalog.product_manage`
//! （`find_product` / `find_product_by_sn` / `find_skus` / `paginate_products`），
//! 因为 `crates/infrastructure/src/db/repo/product_manage.rs` 是其它实现者的独占文件，
//! 本切片不得修改；而它的方法签名已完全满足本域需求，无需重复实现。
//!
//! 列名严格对齐权威 schema
//! （`cd rust && python tools/schema_parser.py --table <表>`，权威源
//! `java/database/pure.sql`）：
//!
//! - `product_attributes`（10 列）：`attributes_id` / `product_id` / `attr_type` /
//!   `attr_name` / `attr_value` / `attr_price` / `attr_color` / `attr_pic` /
//!   `attr_pic_thumb` / `sort_order`
//! - `e_card`（9 列）：`card_id` / `group_id` / `card_number` / `card_pwd` /
//!   `is_use` / `order_id` / `order_item_id` / `add_time` / `up_time`
//! - `gift_card_groups`（15 列，本片只取 3 列）：`card_groups_id` / `status` /
//!   `availability_stock`
//!
//! 约定：
//! - 一律使用**运行时** `sqlx::query_as` / `sqlx::query`，**不使用** `query!`
//!   宏（本机无 `DATABASE_URL`，宏必然编译失败）。
//! - 每条 SQL 都是**单行字符串字面量**，便于
//!   `python tools/check_sql_columns.py` 静态校验列名。
//! - 仓储层**不做业务校验**，只忠实执行 SQL。

use std::collections::HashMap;

use rust_decimal::Decimal;
use sqlx::MySqlPool;
use tigshop_core::{Error, Result};

/// `product_attributes` 全部 10 列（供文档 / 单测核对）。
///
/// 单行常量：`tools/check_sql_columns.py` 按 SQL 字面量扫描，跨行拼接会让
/// 静态校验读到半截语句，故此处刻意不换行。
pub const PRODUCT_ATTRIBUTES_COLUMNS: &str = "attributes_id, product_id, attr_type, attr_name, attr_value, attr_price, attr_color, attr_pic, attr_pic_thumb, sort_order";

/// 礼品卡组查询结果：`(status, availability_stock)`。
///
/// 对应 Java `giftCardGroupsMapper.selectById(...)` 后被读取的
/// `getStatus()` 与 `getAvailabilityStock()` 两个字段。
pub type GiftCardGroupStock = (i32, Option<i32>);

#[derive(Clone)]
pub struct ProxyShoppingProductRepository {
    pool: MySqlPool,
}

impl ProxyShoppingProductRepository {
    pub fn new(pool: MySqlPool) -> Self {
        Self { pool }
    }

    /// 暴露连接池（供服务层做事务编排）。
    pub fn pool_clone(&self) -> MySqlPool {
        self.pool.clone()
    }

    /// 按 `attributes_id` 批量查询附加规格价。
    ///
    /// 对应 Java `ProductServiceImpl#getProductAttributeList(List<Integer> productIds)`
    /// —— 方法名里的「productIds」是笔误，`queryWrapper.in(ProductAttribute::getAttributesId, productIds)`
    /// 实际按**属性主键**过滤，用于累加 `extraAttrIds` 的 `attr_price`。
    ///
    /// 返回 `(attributes_id, attr_price)` 列表（跳过 `attr_price` 为 `NULL` 的行：
    /// Java `stream().map(ProductAttribute::getAttrPrice).reduce(ZERO, add)`
    /// 在价格为空时会抛 NPE，本实现选择跳过而非崩溃，见服务层模块头第 10 条）。
    pub async fn find_attribute_prices(
        &self,
        attributes_ids: &[i32],
    ) -> Result<Vec<(i32, Decimal)>> {
        if attributes_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = std::iter::repeat_n("?", attributes_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT attributes_id, attr_price FROM product_attributes WHERE attributes_id IN ({placeholders})"
        );
        let mut q = sqlx::query_as::<_, (i32, Option<Decimal>)>(&sql);
        for id in attributes_ids {
            q = q.bind(*id);
        }
        let rows = q.fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows
            .into_iter()
            .filter_map(|(id, price)| price.map(|p| (id, p)))
            .collect())
    }

    /// 按 `attributes_id` 批量查询附加属性明细（名称 / 值 / 价格）。
    ///
    /// 对应 Java `ProductAttributesService#getProductAttributesByIds(ids)`，
    /// 加购时用于构造 `Cart.extraSkuData`（Java `CarExtraSkuDataDTO`：
    /// attributesId / attrName / attrValue / attrPrice）。
    /// 返回 `(attributes_id, attr_name, attr_value, attr_price)`。
    pub async fn find_attribute_details(
        &self,
        attributes_ids: &[i32],
    ) -> Result<Vec<(i32, String, String, Option<Decimal>)>> {
        if attributes_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders = std::iter::repeat_n("?", attributes_ids.len())
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT attributes_id, attr_name, attr_value, attr_price FROM product_attributes WHERE attributes_id IN ({placeholders})"
        );
        let mut q = sqlx::query_as::<_, (i32, String, String, Option<Decimal>)>(&sql);
        for id in attributes_ids {
            q = q.bind(*id);
        }
        let rows = q.fetch_all(&self.pool).await.map_err(map_err)?;
        Ok(rows)
    }

    /// 每条规格维度的缩略图。
    ///
    /// 对应 Java `ProductServiceImpl#getProductAttribute(productId, attrName, attrValue)`：
    /// 1. `product_attributes` 按 `product_id + attr_name + attr_value` 查一行；
    /// 2. 命中且 `attr_pic_thumb` 非空 → 用它；
    /// 3. 否则回退**商品主图** `product.pic_thumb`（Java 对商品不存在返回空串）。
    ///
    /// 入参 `(attr_name, attr_value)` 保持调用顺序，返回值与入参一一对应。
    /// 本方法只覆盖第 1、2 步；回退值由服务层用已取到的商品主图补齐
    /// （避免 N 次 `SELECT ... FROM product`）。
    pub async fn find_sku_attr_pic_thumbs(
        &self,
        product_id: i32,
        pairs: &[(String, String)],
    ) -> Result<Vec<Option<String>>> {
        let mut out: Vec<Option<String>> = Vec::with_capacity(pairs.len());
        // 规格维度通常只有 1~3 条（颜色 / 尺码…），逐条查询与 Java 逐条
        // `productAttributesService.list(...)` 的调用形状一致，不做复杂批量化。
        for (name, value) in pairs {
            let row: Option<(Option<String>,)> = sqlx::query_as(
                "SELECT attr_pic_thumb FROM product_attributes WHERE product_id = ? AND attr_name = ? AND attr_value = ? LIMIT 1",
            )
            .bind(product_id)
            .bind(name)
            .bind(value)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_err)?;
            out.push(row.and_then(|(pic,)| pic).filter(|p| !p.trim().is_empty()));
        }
        Ok(out)
    }

    /// 卡密商品（`product_type = 3`）的可用库存。
    ///
    /// 对应 Java `ProductServiceImpl#updateStockByECard`：
    /// `SELECT COUNT(*) FROM e_card WHERE group_id = ? AND is_use = 0`
    /// （`group_id` 取 `product.card_group_id`）。Java 在**任何**
    /// `product_type == 3` 的商品详情上都会把库存改写成该计数。
    pub async fn count_unused_ecards(&self, group_id: i32) -> Result<i64> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM e_card WHERE group_id = ? AND is_use = 0")
                .bind(group_id)
                .fetch_one(&self.pool)
                .await
                .map_err(map_err)?;
        Ok(row.0.max(0))
    }

    /// 礼品卡组（`product_type = 7/8`）的 `(status, availability_stock)`。
    ///
    /// 对应 Java `getProductSkuDetailWithCycle` 中的
    /// `giftCardGroupsMapper.selectById(product.getGiftCardGroupsId())`
    /// 后读取 `getStatus()` / `getAvailabilityStock()`。
    /// 组不存在 → `None`。
    pub async fn find_gift_card_group_stock(
        &self,
        card_groups_id: i32,
    ) -> Result<Option<GiftCardGroupStock>> {
        sqlx::query_as::<_, (i32, Option<i32>)>(
            "SELECT status, availability_stock FROM gift_card_groups WHERE card_groups_id = ? LIMIT 1",
        )
        .bind(card_groups_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_err)
    }
}

/// 把 `(attributes_id, attr_price)` 折叠成 `attributes_id -> price` 映射。
///
/// 抽成自由函数便于单测（服务层的累加逻辑依赖它）。
#[must_use]
pub fn price_map(rows: &[(i32, Decimal)]) -> HashMap<i32, Decimal> {
    rows.iter().copied().collect()
}

/// 累加附加规格价（对应 Java `attrPrice = list.map(getAttrPrice).reduce(ZERO, add)`）。
///
/// `ids` 中查不到的属性按 **0** 计（Java `getProductAttributeList` 是 `IN` 查询，
/// 未命中即不在结果中，同样不参与累加）。
#[must_use]
pub fn sum_attr_price(prices: &HashMap<i32, Decimal>, ids: &[i32]) -> Decimal {
    ids.iter()
        .filter_map(|id| prices.get(id))
        .fold(Decimal::ZERO, |acc, p| acc + *p)
}

fn map_err(e: sqlx::Error) -> Error {
    match e {
        sqlx::Error::RowNotFound => Error::NotFound("记录不存在".into()),
        other => Error::Database(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }

    #[test]
    fn product_attributes_columns_cover_all_ten_from_schema() {
        // 列数必须与 `schema_parser.py --table product_attributes` 的 10 列一致
        // （列名本身由 `check_sql_columns.py` 对 pure.sql 校验）。
        assert_eq!(PRODUCT_ATTRIBUTES_COLUMNS.split(',').count(), 10);
        for col in [
            "attributes_id",
            "product_id",
            "attr_name",
            "attr_value",
            "attr_price",
            "attr_pic_thumb",
        ] {
            assert!(
                PRODUCT_ATTRIBUTES_COLUMNS.contains(col),
                "PRODUCT_ATTRIBUTES_COLUMNS 缺少列 {col}"
            );
        }
    }

    #[test]
    fn sum_attr_price_ignores_missing_ids() {
        let prices = HashMap::from([(1, dec("1.50")), (2, dec("2.25"))]);
        assert_eq!(sum_attr_price(&prices, &[1, 2]), dec("3.75"));
        // 未命中 / 空集合 → 0，与 Java `IN` 查询未命中不参与累加一致
        assert_eq!(sum_attr_price(&prices, &[3]), Decimal::ZERO);
        assert_eq!(sum_attr_price(&prices, &[]), Decimal::ZERO);
        // 按 `ids` 逐项累加：重复 ID 计两份（前端不会重复传同一个 attributes_id）
        assert_eq!(sum_attr_price(&prices, &[1, 1]), dec("3.00"));
    }

    #[test]
    fn price_map_last_write_wins_for_duplicate_ids() {
        // 表主键唯一，正常不会重复；此处只锁死折叠行为，避免静默 panic。
        let rows = vec![(1, dec("1.00")), (1, dec("2.00"))];
        assert_eq!(price_map(&rows).get(&1), Some(&dec("2.00")));
    }
}