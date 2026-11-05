//! 订单服务：下单、状态流转、取消（回滚库存）、支付回调。
//! 对应原 Java `OrderServiceImpl`。

use std::sync::Arc;

use rust_decimal::Decimal;
use tigshop_common::utils;
use tigshop_core::entities::{OfflinePaymentClaim, Order, OrderItem};
use tigshop_core::models::trade::offline_claim::{
    status_name, stage_name, OfflinePaymentClaimAuditDTO, OfflinePaymentClaimSubmitDTO,
    OfflinePaymentClaimVO,
};
use tigshop_core::models::{OrderCreateDTO, OrderCreateVO, OrderVO};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

use crate::trade::cart::CartService;
use crate::catalog::product::ProductService;

/// 订单状态常量（严格对齐 `java/database/pure.sql` 中 `order.order_status`
/// 的列注释：`0 待确认/待支付 1 已确定/待发货 2 处理中/已发货 3 已取消
/// 4 无效 5 已完成`）。
///
/// ⚠️ 历史缺陷提示：本模块曾使用 `10/20/30/40/50` 一套自造状态值，与真实库
/// 口径不符——`mark_paid` 会把 `order_status` 写成 `10`，管理端与前台
/// 按 `1`（待发货）过滤时**永远查不到该订单**。已于本次修正为库口径；
/// 任何新增代码请勿再引入非 `0..=5` 的订单状态字面量。
pub mod status {
    /// 待确认 / 待支付
    pub const UNPAID: i32 = 0;
    /// 已确定 / 待发货（已付款）
    pub const PAID: i32 = 1;
    /// 处理中 / 已发货
    pub const SHIPPED: i32 = 2;
    /// 已取消
    pub const CANCELED: i32 = 3;
    /// 无效
    pub const INVALID: i32 = 4;
    /// 已完成
    pub const FINISHED: i32 = 5;
}

#[derive(Clone)]
pub struct OrderService {
    repos: Arc<Repositories>,
    product: ProductService,
    cart: CartService,
}

/// 评价状态过滤归一（Java `OrderListPageQuery.commentStatus`）：
/// `-1` / `None` → 不过滤；`0` → 待评价（仓储按 Java 语义追加 order_status=5）；
/// `n > 0` → 已评价等值。
#[must_use]
pub fn normalize_comment_status(value: Option<i32>) -> Option<i32> {
    value.filter(|v| *v != -1)
}

/// 待晒单过滤归一（Java `OrderListPageQuery.isShowed`）：`-1` / `None` → 不过滤；
/// `0` → 待晒单；`1` → 已晒单。
#[must_use]
pub fn normalize_is_showed(value: Option<i32>) -> Option<i32> {
    value.filter(|v| *v > -1)
}

impl OrderService {
    pub fn new(repos: Arc<Repositories>, product: ProductService, cart: CartService) -> Self {
        Self { repos, product, cart }
    }

    pub fn from_repos(repos: Arc<Repositories>) -> Self {
        let product = ProductService::new(repos.clone(), None);
        let cart = CartService::new(repos.clone(), product.clone());
        Self { repos, product, cart }
    }

    /// 创建订单：
    /// 1. 读取勾选购物车行
    /// 2. 校验并扣减库存（不足则整体失败）
    /// 3. 生成订单号并写入 order + order_item
    /// 4. 清理已下单的购物车行
    pub async fn create(&self, user_id: i32, dto: &OrderCreateDTO) -> Result<OrderCreateVO> {
        let lines = self.cart.checked_lines(user_id, &dto.cart_ids).await?;
        if lines.is_empty() {
            return Err(Error::Validation("未选择任何商品".into()));
        }

        // 金额计算
        let mut product_amount = Decimal::ZERO;
        let mut items: Vec<OrderItem> = Vec::with_capacity(lines.len());
        let mut order_sn = utils::generate_order_sn();

        // 订单号防重
        let mut retries = 0;
        while self.repos.trade.order.sn_exists(&order_sn).await? && retries < 5 {
            order_sn = utils::generate_order_sn();
            retries += 1;
        }

        // 商品 + 价格（与结算页同口径：商品现价；SKU 价格由 current_prices 提供）
        let product_ids: Vec<i32> = lines.iter().map(|l| l.product_id).collect();
        let products = crate::trade::check::load_products(&self.repos, &product_ids).await?;
        let prices = self.repos.catalog.product.current_prices(&product_ids).await?;
        let mut store_amounts: std::collections::BTreeMap<i32, Decimal> =
            std::collections::BTreeMap::new();

        // 秒杀活动价（与结算页同一映射）
        let now_activity = utils::now_seconds() as i32;
        let seckill = crate::trade::check::load_seckill_prices(&self.repos, &lines, now_activity)
            .await?;
        // 拼团活动价（购物车 extra_data 携带 grouponData）
        let groupon_prices = crate::trade::check::load_groupon_prices(
            &self.repos,
            &lines,
            i64::from(now_activity),
        )
        .await?;
        let mut seckill_discount = Decimal::ZERO;
        // (rec_id, 数量, 商品ID, 活动开始, 活动结束, 活动ID)
        let mut seckill_lines: Vec<(i32, i32, i32, i32, i32, i32)> = Vec::new();
        // 拼团明细：(商品名, 拼团价信息)
        let mut groupon_lines: Vec<(String, crate::trade::check::GrouponPrice)> = Vec::new();

        // 预计算活动单价（秒杀/拼团），再应用满减/满折得到最终结算价
        let mut line_prices: std::collections::HashMap<i32, Decimal> =
            std::collections::HashMap::new();
        for line in &lines {
            let pid = line.product_id;
            let sku_id = line.sku_id.unwrap_or(0);
            let base_price = prices
                .get(&pid)
                .and_then(|p| *p)
                .unwrap_or(line.original_price);
            let mut price = if let Some(g) = groupon_prices.get(&line.cart_id) {
                g.price.min(base_price)
            } else {
                seckill
                    .get(&(pid, sku_id))
                    .or_else(|| seckill.get(&(pid, 0)))
                    .and_then(|item| item.seckill_price)
                    .map(|p| p.min(base_price))
                    .unwrap_or(base_price)
            };
            // 限时折扣：在秒杀/拼团价基础上取更低者
            let time_service =
                crate::marketing::time_discount::TimeDiscountService::new(self.repos.clone());
            if let Some(time_price) = time_service
                .current_discount_price(pid, line.sku_id, price)
                .await?
            {
                price = time_price.min(price);
            }
            line_prices.insert(line.cart_id, price);
        }
        let user_rank_id = self
            .repos
            .member
            .user
            .find_by_id(user_id)
            .await?
            .map(|u| u.rank_id);
        let (_, _, applied_gifts) = crate::trade::check::apply_full_reductions(
            &self.repos,
            &lines,
            &products,
            &mut line_prices,
            now_activity,
            user_rank_id,
        )
        .await?;

        for line in &lines {
            let pid = line.product_id;
            let sku_id = line.sku_id.unwrap_or(0);
            let qty = line.quantity.max(1);
            let base_price = prices
                .get(&pid)
                .and_then(|p| *p)
                .unwrap_or(line.original_price);
            let seckill_item = seckill
                .get(&(pid, sku_id))
                .or_else(|| seckill.get(&(pid, 0)));
            let groupon_line = groupon_prices.get(&line.cart_id);
            let (activity_price, is_pin) = if let Some(g) = groupon_line {
                (g.price.min(base_price), true)
            } else {
                (
                    seckill_item
                        .and_then(|item| item.seckill_price)
                        .map(|p| p.min(base_price))
                        .unwrap_or(base_price),
                    false,
                )
            };
            // 满减/满折后的最终单价
            let price = line_prices
                .get(&line.cart_id)
                .copied()
                .unwrap_or(activity_price);
            let subtotal = price * Decimal::from(qty);
            product_amount += subtotal;
            seckill_discount +=
                (base_price - price).max(Decimal::ZERO) * Decimal::from(qty);
            *store_amounts.entry(line.shop_id).or_default() += subtotal;
            if let Some(g) = groupon_line {
                groupon_lines.push((
                    products
                        .get(&pid)
                        .map(|p| p.product_name.clone())
                        .unwrap_or_default(),
                    g.clone(),
                ));
            } else if let Some(item) = seckill_item {
                if activity_price < base_price {
                    if let (Some(rec_id), Some(start), Some(end)) =
                        (Some(item.rec_id), item.seckill_start_time, item.seckill_end_time)
                    {
                        seckill_lines.push((
                            rec_id,
                            qty,
                            pid,
                            start,
                            end,
                            item.seckill_id.unwrap_or(0),
                        ));
                    }
                }
            }

            let promotion_data = groupon_line
                .and_then(|g| serde_json::to_string(&g.data).ok());
            let product = products.get(&pid);
            items.push(OrderItem {
                order_sn: order_sn.clone(),
                user_id,
                price,
                quantity: qty,
                product_id: pid,
                product_name: product
                    .map(|p| p.product_name.clone())
                    .unwrap_or_default(),
                product_sn: product.map(|p| p.product_sn.clone()).unwrap_or_default(),
                pic_thumb: product.map(|p| p.pic_thumb.clone()).unwrap_or_default(),
                product_type: product.and_then(|p| p.product_type).unwrap_or(1),
                sku_id,
                sku_data: line.sku_data.clone().unwrap_or_default(),
                origin_price: Some(base_price),
                shop_id: line.shop_id,
                is_pin: i32::from(is_pin),
                promotion_data,
                ..Default::default()
            });
        }

        // 满赠赠品行（价格 0，isGift=1；库存扣减在事务内单独处理）
        for gift in &applied_gifts {
            let product = products.get(&gift.product_id);
            items.push(OrderItem {
                order_sn: order_sn.clone(),
                user_id,
                price: Decimal::ZERO,
                quantity: gift.num,
                product_id: gift.product_id,
                product_name: product
                    .map(|p| p.product_name.clone())
                    .unwrap_or_default(),
                product_sn: product.map(|p| p.product_sn.clone()).unwrap_or_default(),
                pic_thumb: product.map(|p| p.pic_thumb.clone()).unwrap_or_default(),
                product_type: product.and_then(|p| p.product_type).unwrap_or(1),
                sku_id: gift.sku_id,
                sku_data: String::new(),
                origin_price: Some(Decimal::ZERO),
                shop_id: gift.shop_id,
                is_gift: 1,
                promotion_data: Some(
                    serde_json::json!({
                        "giftId": gift.gift_id,
                        "promotionId": gift.promotion_id,
                        "type": 4,
                    })
                    .to_string(),
                ),
                ..Default::default()
            });
        }

        // 秒杀限购校验（按活动窗口内该用户已购数量）
        for (_, qty, pid, start, end, seckill_id) in &seckill_lines {
            if *seckill_id <= 0 {
                continue;
            }
            if let Some(record) = self.repos.marketing.seckill.find_by_id(*seckill_id).await? {
                if record.seckill_limit_num.unwrap_or(0) > 0 {
                    let bought = self
                        .repos
                        .marketing
                        .seckill
                        .count_user_purchases(user_id, *pid, *start, *end)
                        .await?;
                    if bought + i64::from(*qty) > i64::from(record.seckill_limit_num.unwrap_or(0)) {
                        return Err(Error::biz(1001, "超过秒杀商品限购数量".to_string()));
                    }
                }
            }
        }

        // —— 收货地址快照（同时取地区用于运费模板匹配）——
        let effective_shipping_method = dto.shipping_method.or(dto.delivery_type).unwrap_or(1);
        let addr = match dto.address_id.filter(|id| *id > 0) {
            Some(address_id) => {
                self.repos
                    .member
                    .user_address_client
                    .find_by_id(address_id)
                    .await?
            }
            None => None,
        };
        let (consignee, mobile, email, address, region_ids, region_names, region_id_list) =
            match addr {
                Some(a) => {
                    let ids: Vec<i32> =
                        serde_json::from_str(&a.region_ids).unwrap_or_default();
                    (
                        a.consignee,
                        a.mobile,
                        a.email.unwrap_or_default(),
                        a.address,
                        a.region_ids,
                        a.region_names,
                        ids,
                    )
                }
                None => {
                    if effective_shipping_method == 2 {
                        let contact_name = dto
                            .pickup_contact_name
                            .as_deref()
                            .unwrap_or("自提客户")
                            .to_string();
                        let contact_mobile = dto
                            .pickup_contact_mobile
                            .as_deref()
                            .unwrap_or_default()
                            .to_string();
                        let pickup_addr =
                            format!("门店自提 (自提点ID: {})", dto.pickup_id.unwrap_or(0));
                        (
                            contact_name,
                            contact_mobile,
                            String::new(),
                            pickup_addr,
                            "[]".to_string(),
                            "[]".to_string(),
                            Vec::new(),
                        )
                    } else {
                        (
                            String::new(),
                            String::new(),
                            String::new(),
                            String::new(),
                            "[]".to_string(),
                            "[]".to_string(),
                            Vec::new(),
                        )
                    }
                }
            };

        // —— 优惠券抵扣（店铺范围 + 门槛校验，与结算页同口径）——
        // 前端结算表单提交 `useCouponIds`；兼容旧字段 `couponId`。
        let coupon_used: Vec<i32> = dto
            .use_coupon_ids
            .clone()
            .filter(|ids| !ids.is_empty())
            .or_else(|| dto.coupon_id.filter(|id| *id > 0).map(|id| vec![id]))
            .unwrap_or_default();
        let mut coupon_amount = Decimal::ZERO;
        let mut valid_coupons: Vec<i32> = Vec::new();
        if !coupon_used.is_empty() {
            let coupons = self
                .repos
                .marketing
                .coupon
                .find_by_ids(&coupon_used)
                .await?;
            let by_id: std::collections::HashMap<i32, tigshop_core::entities::Coupon> = coupons
                .into_iter()
                .map(|c| (c.coupon_id, c))
                .collect();
            for coupon_id in &coupon_used {
                let coupon = by_id.get(coupon_id).ok_or_else(|| {
                    Error::biz(1001, format!("优惠券不存在: {coupon_id}"))
                })?;
                let shop_id = coupon.shop_id.unwrap_or(0);
                let base = if shop_id > 0 {
                    store_amounts.get(&shop_id).copied().unwrap_or(Decimal::ZERO)
                } else {
                    product_amount
                };
                if base <= Decimal::ZERO {
                    return Err(Error::biz(1001, "优惠券不适用于当前店铺商品".to_string()));
                }
                if base < coupon.min_order_amount {
                    return Err(Error::biz(1001, "优惠券未达到使用门槛".to_string()));
                }
                coupon_amount += tigshop_core::models::trade::check::coupon_rule_discount(
                    coupon.coupon_type,
                    coupon.coupon_money,
                    coupon.coupon_discount,
                    coupon.max_order_amount,
                    base,
                );
                valid_coupons.push(*coupon_id);
            }
        }

        // —— 运费模板（与结算页同一函数）——
        let shipping = crate::trade::check::calculate_shipping(
            &self.repos,
            &lines,
            &products,
            &region_id_list,
            if effective_shipping_method == 2 {
                Some(2)
            } else {
                None
            },
        )
        .await?;
        let shipping_fee = shipping.total;

        // —— 积分抵扣（与结算页同一函数）——
        let user = self
            .repos
            .member
            .user
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| Error::biz_msg("用户不存在"))?;
        let cfg = self
            .repos
            .trade
            .check
            .find_config_values(&[
                "integralScale",
                "integralPercent",
                "integralPercentBaseAmount",
                "usePoints",
            ])
            .await?;
        let config_enabled = |key: &str| {
            cfg.get(key).map(|v| v.trim() == "1").unwrap_or(false)
        };
        let decimal_cfg = |key: &str, default: Decimal| {
            cfg.get(key)
                .and_then(|v| v.trim().parse::<Decimal>().ok())
                .unwrap_or(default)
        };
        let points = if config_enabled("usePoints") {
            tigshop_core::models::trade::check::calc_points(
                dto.use_points.unwrap_or(0),
                user.points,
                (product_amount - coupon_amount).max(Decimal::ZERO),
                decimal_cfg("integralScale", Decimal::ZERO),
                decimal_cfg("integralPercent", Decimal::ZERO),
                decimal_cfg("integralPercentBaseAmount", Decimal::ONE_HUNDRED),
            )
        } else {
            Default::default()
        };
        let points_amount = points.points_amount;

        // —— 地区税率（与结算页同一函数）——
        let (tax_rate, _) =
            crate::trade::check::resolve_tax_rate(&self.repos, &region_id_list).await;
        let taxable_base = (product_amount - coupon_amount - seckill_discount).max(Decimal::ZERO);
        let tax_rate_amount = crate::trade::check::calc_tax_amount(taxable_base, tax_rate);

        // 应付金额 = 商品 - 优惠券 + 运费 + 税额 - 积分抵扣（与结算页 totalAmount 一致）
        let total = (product_amount - coupon_amount + shipping_fee + tax_rate_amount - points_amount)
            .max(Decimal::ZERO);

        // —— 定金预售：单商品 + product_presale.sale_mode = 2 ——
        let now_ts = utils::now_seconds() as i32;
        let mut presale_row: Option<tigshop_core::entities::OrderPresale> = None;
        let mut deposit_now = total;
        if lines.len() == 1 {
            let product_id = lines[0].product_id;
            if let Some(product) = products.get(&product_id) {
                if product.sale_mode == 2 {
                    if let Some(ps) = self
                        .repos
                        .catalog
                        .product_manage
                        .find_presale(product_id)
                        .await?
                    {
                        let deposit = tigshop_core::models::trade::check::calc_deposit(
                            total,
                            ps.deposit_type,
                            ps.deposit_ratio,
                            ps.deposit_fixed_amount,
                            ps.is_round_down,
                        );
                        if deposit > Decimal::ZERO {
                            deposit_now = deposit;
                            presale_row = Some(tigshop_core::entities::OrderPresale {
                                presale_order_id: 0,
                                order_id: 0,
                                order_sn: order_sn.clone(),
                                product_id,
                                sale_mode: 2,
                                deposit_amount: deposit,
                                final_payment_amount: (total - deposit).max(Decimal::ZERO),
                                deposit_paid_time: None,
                                final_payment_start_time: None,
                                final_payment_paid_time: None,
                                presale_status: 0,
                                delivery_days: if ps.delivery_type == 1 {
                                    Some(ps.delivery_relative_days.unwrap_or(0))
                                } else {
                                    None
                                },
                                delivery_date: if ps.delivery_type == 2 {
                                    ps.delivery_date
                                } else {
                                    None
                                },
                                create_time: now_ts,
                                update_time: now_ts,
                            });
                        }
                    }
                }
            }
        }

        let order = Order {
            is_presale: if presale_row.is_some() { 1 } else { 0 },
            presale_type: presale_row.as_ref().map(|_| 2),
            order_type: if groupon_lines.is_empty() { Some(0) } else { Some(2) },
            order_sn: order_sn.clone(),
            user_id,
            order_status: status::UNPAID,
            shipping_status: 0,
            pay_status: 1, // 1=未支付
            add_time: utils::now_seconds() as i32,
            buyer_note: dto.buyer_note.clone().unwrap_or_default(),
            shipping_method: effective_shipping_method,
            pay_type_id: dto.pay_type_id.unwrap_or(0),
            consignee,
            mobile,
            email,
            address,
            region_ids,
            region_names,
            use_points: points.used_points,
            points_amount,
            is_valid: 1,
            is_del: 0,
            total_amount: total,
            paid_amount: Decimal::ZERO,
            unpaid_amount: deposit_now,
            product_amount,
            coupon_amount,
            shipping_fee,
            discount_amount: seckill_discount,
            tax_rate: Some(tax_rate),
            tax_rate_amount: Some(tax_rate_amount),
            order_source: dto.order_source.clone().unwrap_or_else(|| "web".into()),
            pos_user_id: dto.pos_user_id,
            ..Default::default()
        };

        // 「扣库存 + 写订单」同一事务：任一行库存不足或订单写入失败，
        // 事务整体回滚，不残留已扣库存（原 Java 由 @Transactional 保证）。
        let mut groupon_record_id: Option<i64> = None;

        let order_id = {
            let mut tx = self
                .repos.trade.order
                .begin()
                .await
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut deducted: Vec<(i32, Option<i32>, i32)> = Vec::with_capacity(items.len());
            let mut result: Result<i32> = Ok(0);

            for (idx, item) in items.iter().enumerate() {
                let pid = item.product_id;
                let qty = item.quantity;
                if item.is_gift == 1 {
                    let gift_id = item
                        .promotion_data
                        .as_deref()
                        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
                        .and_then(|v| v.get("giftId").and_then(|g| g.as_i64()))
                        .and_then(|g| i32::try_from(g).ok())
                        .unwrap_or(0);
                    match self
                        .repos
                        .marketing
                        .product_gift
                        .dec_gift_stock_in_tx(&mut tx, gift_id, qty)
                        .await
                    {
                        Ok(true) => {}
                        Ok(false) => {
                            result = Err(Error::InsufficientStock {
                                product_id: pid.to_string(),
                                stock: 0,
                            });
                            break;
                        }
                        Err(e) => {
                            result = Err(e);
                            break;
                        }
                    }
                    continue;
                }
                // 无 SKU 商品（sku_id 缺省）必须按 product_stock 扣减：
                // 传 Some(0) 会 UPDATE product_sku WHERE sku_id=0 → 0 行 → 误报库存不足。
                let sku = lines.get(idx).and_then(|l| l.sku_id);
                match self
                    .repos.catalog.product
                    .deduct_stock_in_tx(&mut tx, pid, sku, qty)
                    .await
                {
                    Ok(true) => deducted.push((pid, sku, qty)),
                    Ok(false) => {
                        result = Err(Error::InsufficientStock {
                            product_id: pid.to_string(),
                            stock: 0,
                        });
                        break;
                    }
                    Err(e) => {
                        result = Err(e);
                        break;
                    }
                }
            }

            if result.is_ok() {
                result = self
                    .repos.trade.order
                    .insert_order_in_tx(&mut tx, &order, &items)
                    .await;
            }

            // 拼团记录（与订单同事务；开团/参团状态机）
            if result.is_ok() && !groupon_lines.is_empty() {
                if let Some(order_id) = result.as_ref().ok().copied() {
                    for (product_name, line) in &groupon_lines {
                        match crate::trade::groupon::create_record_in_tx(
                            &mut tx,
                            &self.repos,
                            user_id,
                            &user.username,
                            order_id,
                            &order_sn,
                            product_name,
                            line,
                        )
                        .await
                        {
                            Ok(id) => {
                                if groupon_record_id.is_none() {
                                    groupon_record_id = Some(id);
                                }
                            }
                            Err(e) => {
                                result = Err(e);
                                break;
                            }
                        }
                    }
                }
            }

            // 秒杀库存扣减（与订单同事务，失败整体回滚）
            if result.is_ok() {
                for (rec_id, qty, _, _, _, _) in &seckill_lines {
                    match self
                        .repos
                        .marketing
                        .seckill
                        .dec_stock_inc_sales_in_tx(&mut tx, *rec_id, *qty)
                        .await
                    {
                        Ok(true) => {}
                        Ok(false) => {
                            result = Err(Error::biz(1001, "秒杀库存不足".to_string()));
                            break;
                        }
                        Err(e) => {
                            result = Err(e);
                            break;
                        }
                    }
                }
            }

            // 预售订单信息与订单同事务写入，避免「订单在、预售信息丢」
            if result.is_ok() {
                if let Some(mut row) = presale_row.clone() {
                    if let Some(order_id) = result.as_ref().ok() {
                        row.order_id = *order_id;
                        result = self
                            .repos
                            .payment
                            .pay
                            .insert_presale_in_tx(&mut tx, &row)
                            .await
                            .map(|_| row.order_id);
                    }
                }
            }

            // 随单发票申请与订单同事务写入（order_invoice + order.invoice_data）
            if result.is_ok() {
                if let (Some(order_id), Some(ref inv)) =
                    (result.as_ref().ok().copied(), &dto.invoice_data)
                {
                    if let Some(inv_type) = inv.invoice_type {
                        if inv_type > 0 {
                            let company_name = inv
                                .company_name
                                .as_deref()
                                .or(inv.title.as_deref())
                                .unwrap_or("个人");
                            let company_code = inv.tax_no.as_deref();
                            let title_type = if inv_type == 2 {
                                2
                            } else {
                                inv.title_type.unwrap_or(1)
                            };
                            match self
                                .repos
                                .trade
                                .order_invoice_client
                                .insert_invoice_in_tx(
                                    &mut tx,
                                    user_id,
                                    order_id,
                                    inv_type,
                                    title_type,
                                    company_name,
                                    company_code,
                                    None,
                                    inv.tax_phone.as_deref(),
                                    None,
                                    None,
                                    inv.content.as_deref(),
                                    total,
                                    inv.mobile.as_deref(),
                                    inv.email.as_deref(),
                                    now_ts,
                                )
                                .await
                            {
                                Ok(inv_id) => {
                                    let invoice_json = serde_json::json!({
                                        "id": inv_id,
                                        "orderId": order_id,
                                        "userId": user_id,
                                        "invoiceType": inv_type,
                                        "titleType": title_type,
                                        "companyName": company_name,
                                        "companyCode": company_code.unwrap_or(""),
                                        "amount": total.to_string(),
                                        "status": 0,
                                        "addTime": now_ts.to_string(),
                                    })
                                    .to_string();
                                    if let Err(e) = self
                                        .repos
                                        .trade
                                        .order
                                        .update_invoice_data_in_tx(&mut tx, order_id, &invoice_json)
                                        .await
                                    {
                                        result = Err(e);
                                    }
                                }
                                Err(e) => {
                                    result = Err(e);
                                }
                            }
                        }
                    }
                }
            }

            match result {
                Ok(id) => {
                    tx.commit().await.map_err(|e| Error::Database(e.to_string()))?;
                    id
                }
                Err(e) => {
                    // 事务回滚即撤消本事务内已扣的库存，无需手工补偿
                    let _ = tx.rollback().await;
                    // 库存被回滚，需失效详情缓存避免读到脏数据
                    for (pid, _, _) in &deducted {
                        self.product.invalidate_detail_cache(*pid).await;
                    }
                    return Err(e);
                }
            }
        };

        for item in items.iter_mut() {
            item.order_id = order_id;
        }

        // 清理已下单购物车行
        let cart_ids: Vec<i32> = lines.iter().map(|l| l.cart_id).collect();
        if let Err(e) = self.cart.remove(user_id, &cart_ids).await {
            tracing::warn!("清理购物车失败: {e}");
        }

        // 占用优惠券（尽力而为；失败仅告警，避免订单已建但接口失败）
        if !valid_coupons.is_empty() {
            if let Err(e) = crate::marketing::coupon::CouponService::new(self.repos.clone())
                .use_coupons(user_id, &valid_coupons, order_id)
                .await
            {
                tracing::warn!("订单 {order_id} 优惠券占用失败: {e}");
            }
        }

        // 扣减积分（与结算页口径一致；失败仅告警，避免已建订单接口失败）
        if points.used_points > 0
            && !self
                .repos
                .member
                .user
                .try_debit_points(user_id, points.used_points)
                .await?
        {
            tracing::warn!(
                "订单 {order_id} 积分扣减失败: user={user_id}, points={}",
                points.used_points
            );
        }

        // 扣减成功，失效商品详情缓存
        for line in &lines {
            self.product.invalidate_detail_cache(line.product_id).await;
        }

        tracing::info!("创建订单成功: order_id={order_id}, sn={order_sn}, user={user_id}");

        // —— 余额抵扣（Java `OrderCheckServiceImpl#calcBalanceDeduction`）——
        // 定金预售：本次只支付定金，余额抵扣留给尾款阶段（避免把定金当全款结算）
        let mut online_amount = if presale_row.is_some() { deposit_now } else { total };
        let mut return_type = 1_i32;
        let mut final_balance_used = Decimal::ZERO;
        if presale_row.is_none() {
        if let Some(requested) = dto.use_balance {
            if requested > Decimal::ZERO {
                let available = self
                    .repos
                    .member
                    .user
                    .find_by_id(user_id)
                    .await?
                    .map(|u| u.available_balance())
                    .unwrap_or(Decimal::ZERO);
                let mut balance_used = requested.min(total).min(available);
                if balance_used > Decimal::ZERO {
                    let debited = self
                        .repos
                        .member
                        .user
                        .try_debit_balance(user_id, balance_used)
                        .await?;
                    if !debited {
                        balance_used = Decimal::ZERO;
                    }
                }
                if balance_used > Decimal::ZERO {
                    final_balance_used = balance_used;
                    let _ = self
                        .repos
                        .trade
                        .order
                        .set_balance_amount(order_id, balance_used)
                        .await;
                    let now = utils::now_seconds() as i32;
                    if balance_used >= total {
                        if self
                            .repos
                            .trade
                            .order
                            .mark_paid(order_id, now, total)
                            .await?
                        {
                            online_amount = Decimal::ZERO;
                            return_type = 2;
                            self.write_balance_paylog(order_id, &order_sn, total, balance_used, now)
                                .await;
                        }
                    } else {
                        let _ = self
                            .repos
                            .trade
                            .order
                            .apply_partial_payment(order_id, balance_used)
                            .await;
                        online_amount = total - balance_used;
                        self.write_balance_paylog(order_id, &order_sn, total, balance_used, now)
                            .await;
                    }
                }
            }
        }
        }

        let out_trade_no = format!("PAY{order_sn}");
        Ok(OrderCreateVO {
            order_id,
            order_sn,
            total_amount: total,
            online_amount,
            out_trade_no,
            return_type,
            groupon_promotion_record_id: groupon_record_id.and_then(|v| i32::try_from(v).ok()),
            balance: if final_balance_used > Decimal::ZERO { Some(final_balance_used) } else { None },
            is_card_redeem: Some(false),
        })
    }

    /// 余额抵扣流水（对应 Java `PaylogService#creatPayLog(payCode="balance")`）。
    async fn write_balance_paylog(
        &self,
        order_id: i32,
        order_sn: &str,
        order_amount: Decimal,
        pay_amount: Decimal,
        now: i32,
    ) {
        use tigshop_core::entities::Paylog;
        use tigshop_core::models::payment::paylog::{generate_pay_sn, PayOrderType};
        use tigshop_infrastructure::db::repo::payment::paylog::PAYLOG_STATUS_PAID;
        let paylog = Paylog {
            paylog_id: 0,
            pay_sn: generate_pay_sn(),
            pay_name: format!("余额支付-订单{order_sn}"),
            order_id,
            order_sn: order_sn.to_string(),
            order_amount,
            order_type: PayOrderType::Product as i32,
            pay_amount,
            pay_status: PAYLOG_STATUS_PAID,
            pay_code: "balance".to_string(),
            profit_sharing_channel: None,
            add_time: Some(now),
            transaction_id: format!("BAL{}", utils::now_millis()),
            notify_data: String::new(),
            refund_amount: Decimal::ZERO,
            token_code: String::new(),
            appid: None,
        };
        if let Err(e) = self.repos.payment.paylog.insert(&paylog).await {
            tracing::warn!("余额支付流水写入失败: order_id={order_id} {e}");
        }
    }

    /// 订单详情。
    pub async fn detail(&self, order_id: i32, user_id: Option<i32>) -> Result<(OrderVO, Vec<OrderItem>)> {
        let order = self
            .repos.trade.order
            .find_by_id(order_id)
            .await?
            .ok_or_else(|| Error::NotFound("订单不存在".into()))?;

        // 归属校验（非本人不可查）
        if let Some(uid) = user_id {
            if order.user_id != uid {
                return Err(Error::Forbidden("无权查看该订单".into()));
            }
        }

        let items = self.repos.trade.order.find_items(order_id).await?;
        let mut vo = to_vo(&order, &items);
        // 卡密订单：补齐每个商品项已分配的电子卡券（原版 ECardItemVO）
        let mut has_card = false;
        for (idx, item) in items.iter().enumerate() {
            let mut cards = self
                .repos
                .catalog
                .e_card
                .find_by_order_item_id(item.item_id)
                .await?;
            // 历史卡密订单可能未在支付回调里分配成功；查看详情时兜底分配一次
            if cards.is_empty() && item.product_type == 3 {
                if let Ok(Some(prod)) = self.repos.catalog.product.find_by_id(item.product_id).await {
                    if prod.card_group_id > 0 {
                        if let Ok(allocated) = self
                            .repos
                            .catalog
                            .e_card
                            .allocate_cards_to_order_item(
                                prod.card_group_id,
                                order_id,
                                item.item_id,
                                item.quantity,
                            )
                            .await
                        {
                            cards = allocated;
                        }
                    }
                }
            }
            if cards.is_empty() {
                continue;
            }
            has_card = true;
            vo.items[idx]["eCard"] = serde_json::json!(cards
                .iter()
                .map(|c| serde_json::json!({
                    "cardId": c.card_id,
                    "groupId": c.group_id,
                    "cardNumber": c.card_number,
                    "cardPwd": c.card_pwd,
                    "orderItemId": c.order_item_id,
                }))
                .collect::<Vec<_>>());
        }
        if has_card || items.iter().any(|it| it.product_type == 3) {
            vo.is_card_order = true;
        }
        // 纯卡密订单：卡券下发后直接进入“待收货”，无需物流发货
        if has_card && !items.is_empty() && items.iter().all(|it| it.product_type == 3) {
            let now = utils::now_seconds() as i32;
            if self
                .repos
                .trade
                .order
                .mark_card_shipped(order_id, now)
                .await
                .is_ok()
            {
                vo.order_status = 2;
                vo.order_status_name = "待收货".into();
                vo.status_label = "待收货".into();
                vo.shipping_status = 1;
                vo.shipping_status_name = "已发货".into();
            }
        }
        Ok((vo, items))
    }

    /// 订单分页。
    ///
    /// 过滤语义对齐 Java `OrderServiceImpl#list`：
    /// - `comment_status = Some(0)` → 待评价（`comment_status=0` 且订单已完成）；
    /// - `comment_status = Some(n>0)` → 已评价等值；
    /// - `-1` / `None` → 不过滤（前端“全部/待付款/…”标签传 -1）。
    /// - `is_showed = Some(0/1)` → 待晒单（按 comment 表过滤，见仓储注释）。
    pub async fn list(
        &self,
        user_id: Option<i32>,
        order_status: Option<i32>,
        comment_status: Option<i32>,
        is_showed: Option<i32>,
        keyword: Option<&str>,
        page: &PageQuery,
    ) -> Result<PageResult<OrderVO>> {
        // 与 Java 一致：-1 视为不过滤；待晒单 > -1 生效
        let comment_status = normalize_comment_status(comment_status);
        let is_showed = normalize_is_showed(is_showed);
        let keyword = keyword.map(str::trim).filter(|s| !s.is_empty());
        let (total, orders) = self
            .repos.trade.order
            .paginate(
                user_id,
                order_status,
                comment_status,
                is_showed,
                keyword,
                page.page,
                page.page_size,
            )
            .await?;
        let mut list = Vec::with_capacity(orders.len());
        for o in &orders {
            let items = self.repos.trade.order.find_items(o.order_id).await?;
            list.push(to_vo(o, &items));
        }
        Ok(PageResult::new(total, list, page))
    }

    /// 取消订单（仅待付款可取消，取消后回滚库存）。
    pub async fn cancel(&self, order_id: i32, user_id: Option<i32>, reason: Option<&str>) -> Result<()> {
        let order = self
            .repos.trade.order
            .find_by_id(order_id)
            .await?
            .ok_or_else(|| Error::NotFound("订单不存在".into()))?;
        if let Some(uid) = user_id {
            if order.user_id != uid {
                return Err(Error::Forbidden("无权操作该订单".into()));
            }
        }
        if !order.is_cancellable() {
            return Err(Error::Conflict("当前订单状态不可取消".into()));
        }

        // 原子状态流转：0 → 40
        let ok = self
            .repos.trade.order
            .transition_status(order_id, &[status::UNPAID], status::CANCELED)
            .await?;
        // Java `cancelOrder(..., description)`:`order.cancel_remark = 取消原因`
        let remark = reason.map(str::trim).filter(|s| !s.is_empty());
        if let Some(remark) = remark {
            sqlx::query("UPDATE `order` SET cancel_remark = ? WHERE order_id = ?")
                .bind(remark)
                .bind(order_id)
                .execute(&self.repos.pool)
                .await
                .map_err(|e| Error::Database(e.to_string()))?;
        }
        if !ok {
            return Err(Error::Conflict("订单状态已变更，请刷新后重试".into()));
        }

        // 回滚库存
        let items = self.repos.trade.order.find_items(order_id).await?;
        for item in items {
            let pid = item.product_id;
            let qty = item.quantity;
            if let Err(e) = self.product.restore_stock(pid, Some(item.sku_id), qty).await {
                tracing::error!("取消订单回滚库存失败 order={order_id} product={pid}: {e}");
            }
        }
        tracing::info!("订单已取消: {order_id}");
        Ok(())
    }

    /// 支付成功回调（由支付服务调用，幂等）。
    pub async fn on_payment_success(
        &self,
        order_id: i32,
        paid_amount: Decimal,
        out_trade_no: Option<String>,
    ) -> Result<()> {
        let order = self
            .repos.trade.order
            .find_by_id(order_id)
            .await?
            .ok_or_else(|| Error::NotFound("订单不存在".into()))?;

        if order.is_paid() {
            tracing::info!("订单已支付，跳过重复回调: {order_id}");
            return Ok(()); // 幂等
        }

        let now = utils::now_seconds() as i32;
        self.repos.trade.order
            .mark_paid(order_id, now, paid_amount)
            .await?;

        // 1. 记录订单日志
        let _ = self.repos.trade.user_order.insert_order_log(
            order_id,
            &order.order_sn,
            order.user_id,
            order.shop_id,
            "订单支付成功",
            now,
        ).await;

        // 2. 积分赠送（待发货节点 Node 1）
        let _ = self.order_success_point(&order, 1).await;

        // 3. 电子卡券分配
        if let Ok(items) = self.repos.trade.order.find_items(order_id).await {
            let has_items = !items.is_empty();
            let all_card = has_items && items.iter().all(|it| it.product_type == 3);
            let mut allocated_ok = true;
            for it in &items {
                if it.product_type != 3 {
                    continue;
                }
                if let Ok(Some(prod)) = self.repos.catalog.product.find_by_id(it.product_id).await {
                    if prod.card_group_id > 0 {
                        let gid = prod.card_group_id;
                        if self
                            .repos
                            .catalog
                            .e_card
                            .allocate_cards_to_order_item(gid, order_id, it.item_id, it.quantity)
                            .await
                            .is_err()
                        {
                            allocated_ok = false;
                        }
                    }
                }
            }
            // 纯卡密订单：下发卡券后直接转为“待收货”
            if all_card && allocated_ok {
                let _ = self.repos.trade.order.mark_card_shipped(order_id, now).await;
                let _ = self.repos.trade.user_order.insert_order_log(
                    order_id,
                    &order.order_sn,
                    order.user_id,
                    order.shop_id,
                    "卡券已发放，订单待收货",
                    now,
                ).await;
            }
        }

        // 4. 对账单出账流水
        let output = tigshop_core::entities::StatementOutput {
            statement_output_id: 0,
            shop_id: Some(order.shop_id),
            vendor_id: order.vendor_id,
            income: Some(paid_amount),
            expenditure: Some(Decimal::ZERO),
            gmt_create: Some(now as i64),
            record_sn: Some(order.order_sn.clone()),
            // Java `StatementType.ORDER`（3=订单收支）。此前误写 1（手续费）。
            record_type: Some(tigshop_core::models::payment::statement::statement_type::ORDER),
            record_id: Some(order.order_id),
            settlement_status: Some(0),
            real_settlement: Some(0),
            real_settlement_time: None,
        };
        let _ = self.repos.payment.statement.insert_statement_output(&output).await;

        if let Some(no) = out_trade_no {
            tracing::info!("订单支付成功: {order_id}, trade_no={no}");
        }
        Ok(())
    }

    /// 订单节点赠送积分（对齐 Java OrderServiceImpl#orderSuccessPoint）
    pub async fn order_success_point(&self, order: &Order, current_node: i32) -> Result<()> {
        let node_val = self
            .repos
            .system
            .config_basic
            .find_by_code("orderSendPointNode")
            .await?
            .unwrap_or_else(|| "1".into());
        let config_node = node_val.trim().parse::<i32>().unwrap_or(1);
        if current_node != config_node {
            return Ok(());
        }

        if current_node == 3 {
            let days_val = self
                .repos
                .system
                .config_basic
                .find_by_code("orderCompleteSendPointDays")
                .await?
                .unwrap_or_default();
            let delay_days = days_val.trim().parse::<i32>().unwrap_or(0);
            if delay_days > 0 {
                tracing::info!(
                    "订单已完成，积分延迟{}天后赠送: order_id={}",
                    delay_days,
                    order.order_id
                );
                return Ok(());
            }
        }

        let send_point_val = self
            .repos
            .system
            .config_basic
            .find_by_code("orderSendPoint")
            .await?
            .unwrap_or_default();
        let rate = send_point_val.trim().parse::<Decimal>().unwrap_or(Decimal::ZERO);
        if rate <= Decimal::ZERO {
            return Ok(());
        }

        let integral_name = self
            .repos
            .system
            .config_basic
            .find_by_code("integralName")
            .await?
            .unwrap_or_else(|| "积分".into());

        let base_points = (order.total_amount * rate)
            .ceil()
            .to_string()
            .parse::<i32>()
            .unwrap_or(0);
        if base_points <= 0 {
            return Ok(());
        }

        let desc = format!("下单送{}", integral_name);
        self.repos
            .member
            .user_points_log
            .inc_points(base_points, order.user_id, &desc, Some(order.order_id))
            .await?;

        tracing::info!(
            "订单节点赠送积分成功: order_id={}, user_id={}, node={}, points={}",
            order.order_id,
            order.user_id,
            current_node,
            base_points
        );
        Ok(())
    }

    /// 发货（后台操作）。
    pub async fn ship(&self, order_id: i32, tracking_no: &str, logistics_name: &str) -> Result<()> {
        let ok = self
            .repos.trade.order
            .transition_status(order_id, &[status::PAID], status::SHIPPED)
            .await?;
        if !ok {
            return Err(Error::Conflict("订单当前状态不可发货".into()));
        }
        self.repos.trade.order
            .update_shipping(order_id, tracking_no, logistics_name, utils::now_seconds() as i32)
            .await?;
        if let Ok(Some(order)) = self.repos.trade.order.find_by_id(order_id).await {
            let _ = self.order_success_point(&order, 2).await;
        }
        tracing::info!("订单已发货: {order_id}, 运单号: {tracking_no}");
        Ok(())
    }

    // ————————————————————— 线下支付认款（v5.8.61） —————————————————————

    /// 提交线下认款申请。
    pub async fn offline_claim_submit(
        &self,
        user_id: i32,
        dto: OfflinePaymentClaimSubmitDTO,
    ) -> Result<i32> {
        let order_id = dto.order_id.ok_or_else(|| Error::biz(400, "认款参数不完整"))?;
        let order = self
            .repos
            .trade
            .order
            .find_by_id(order_id)
            .await?
            .ok_or_else(|| Error::biz(400, "订单不存在"))?;
        if order.user_id != user_id {
            return Err(Error::biz(400, "订单不存在"));
        }
        if order.pay_type_id != tigshop_core::models::trade::order_admin::pay_type::OFFLINE
            || order.pay_status != 0
            || order.order_status != status::UNPAID
        {
            return Err(Error::biz(400, "当前订单不可提交线下认款"));
        }
        if let Some(latest) = self
            .repos
            .trade
            .offline_payment_claim
            .latest_for_order(order_id)
            .await?
        {
            if latest.status == OfflinePaymentClaim::STATUS_PENDING
                || (latest.status == OfflinePaymentClaim::STATUS_APPROVED && latest.paid_time == 0)
            {
                return Err(Error::biz(400, "该订单已有认款申请，请等待财务审核"));
            }
        }
        let vouchers: Vec<String> = dto
            .voucher_urls
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .collect();
        if vouchers.is_empty() {
            return Err(Error::biz(400, "请上传付款凭证"));
        }
        let (stage, due) = self.offline_claim_stage(&order).await?;
        let now = utils::now_seconds() as i64;
        let claim = OfflinePaymentClaim {
            order_id,
            order_sn: order.order_sn.clone(),
            user_id,
            shop_id: order.shop_id,
            claimed_amount: due,
            pay_stage: stage,
            transfer_time: dto.transfer_time.unwrap_or(0),
            payer_name: dto.payer_name.unwrap_or_default().trim().to_string(),
            payer_account: dto.payer_account.unwrap_or_default().trim().to_string(),
            bank_serial_no: dto.bank_serial_no.unwrap_or_default().trim().to_string(),
            voucher_urls: Some(serde_json::to_string(&vouchers).unwrap_or_else(|_| "[]".to_string())),
            remark: dto.remark.unwrap_or_default().trim().to_string(),
            status: OfflinePaymentClaim::STATUS_PENDING,
            review_admin_id: 0,
            review_time: 0,
            paid_time: 0,
            audit_remark: String::new(),
            reject_reason: String::new(),
            add_time: now,
            update_time: now,
            claim_id: 0,
        };
        let claim_id = self
            .repos
            .trade
            .offline_payment_claim
            .insert(&claim)
            .await?;
        let _ = self
            .repos
            .trade
            .user_order
            .insert_order_log(
                order_id,
                &order.order_sn,
                user_id,
                order.shop_id,
                "用户提交线下付款凭证，等待财务审核",
                now as i32,
            )
            .await;
        Ok(claim_id)
    }

    pub async fn offline_claim_latest(
        &self,
        order_id: i32,
        user_id: i32,
    ) -> Result<Option<OfflinePaymentClaimVO>> {
        let claim = self
            .repos
            .trade
            .offline_payment_claim
            .latest_for_order(order_id)
            .await?;
        Ok(claim
            .filter(|c| c.user_id == user_id)
            .map(|c| to_offline_claim_vo(&c)))
    }

    pub async fn offline_claim_history(
        &self,
        order_id: i32,
        user_id: i32,
    ) -> Result<Vec<OfflinePaymentClaimVO>> {
        let claims = self
            .repos
            .trade
            .offline_payment_claim
            .history_for_order(order_id, Some(user_id))
            .await?;
        Ok(claims.iter().map(to_offline_claim_vo).collect())
    }

    pub async fn offline_claim_admin_detail(&self, claim_id: i32) -> Result<OfflinePaymentClaimVO> {
        let claim = self
            .repos
            .trade
            .offline_payment_claim
            .find_by_id(claim_id)
            .await?
            .ok_or_else(|| Error::biz(400, "认款单不存在"))?;
        Ok(to_offline_claim_vo(&claim))
    }

    /// 审核线下认款：通过后同步完成订单入账。
    pub async fn offline_claim_audit(
        &self,
        admin_id: i32,
        dto: OfflinePaymentClaimAuditDTO,
    ) -> Result<()> {
        let claim_id = dto.claim_id.ok_or_else(|| Error::biz(400, "审核参数不完整"))?;
        let pass = dto.pass.ok_or_else(|| Error::biz(400, "审核参数不完整"))?;
        let claim = self
            .repos
            .trade
            .offline_payment_claim
            .find_by_id(claim_id)
            .await?
            .ok_or_else(|| Error::biz(400, "认款单不存在"))?;
        if claim.status != OfflinePaymentClaim::STATUS_PENDING {
            return Err(Error::biz(400, "该认款单已审核，请勿重复操作"));
        }
        let order = self
            .repos
            .trade
            .order
            .find_by_id(claim.order_id)
            .await?
            .ok_or_else(|| Error::biz(400, "订单当前不可审核认款"))?;
        if order.pay_status != 0 || order.order_status != status::UNPAID {
            return Err(Error::biz(400, "订单当前不可审核认款"));
        }
        let audit_remark = dto.audit_remark.unwrap_or_default().trim().to_string();
        let now = utils::now_seconds() as i64;
        if pass {
            let (stage, due) = self.offline_claim_stage(&order).await?;
            if claim.pay_stage != stage || claim.claimed_amount != due {
                return Err(Error::biz(400, "订单应付金额已变更，请驳回后让用户重新提交"));
            }
            let updated = self
                .repos
                .trade
                .offline_payment_claim
                .audit(claim_id, true, admin_id, &audit_remark, "", now)
                .await?;
            if !updated {
                return Err(Error::biz(400, "认款单已被其他管理员处理"));
            }
            // 入账口径与余额/在线支付一致：定金推进预售状态，全款/尾款触发支付成功。
            if claim.pay_stage == OfflinePaymentClaim::STAGE_DEPOSIT {
                if let Some(ps) = self
                    .repos
                    .payment
                    .pay
                    .find_presale_by_order_id(order.order_id)
                    .await?
                {
                    self.repos
                        .payment
                        .pay
                        .settle_presale_deposit(order.order_id, ps.deposit_amount)
                        .await?;
                    self.repos
                        .payment
                        .pay
                        .update_presale_deposit_paid(order.order_id, now as i32, Some(now as i32))
                        .await?;
                }
            } else {
                self.on_payment_success(order.order_id, order.total_amount, None)
                    .await?;
                if claim.pay_stage == OfflinePaymentClaim::STAGE_FINAL {
                    self.repos
                        .payment
                        .pay
                        .update_presale_final_paid(order.order_id, now as i32)
                        .await?;
                }
            }
            self.repos
                .trade
                .offline_payment_claim
                .mark_paid(claim_id, now)
                .await?;
            let _ = self
                .repos
                .trade
                .user_order
                .insert_order_log(
                    order.order_id,
                    &order.order_sn,
                    order.user_id,
                    order.shop_id,
                    &format!("线下认款审核通过，认款单号：{claim_id}，已入账"),
                    now as i32,
                )
                .await;
            Ok(())
        } else {
            let reason = dto.reject_reason.unwrap_or_default().trim().to_string();
            if reason.is_empty() {
                return Err(Error::biz(400, "请填写驳回原因"));
            }
            let updated = self
                .repos
                .trade
                .offline_payment_claim
                .audit(claim_id, false, admin_id, &audit_remark, &reason, now)
                .await?;
            if !updated {
                return Err(Error::biz(400, "认款单已被其他管理员处理"));
            }
            let _ = self
                .repos
                .trade
                .user_order
                .insert_order_log(
                    order.order_id,
                    &order.order_sn,
                    order.user_id,
                    order.shop_id,
                    &format!("线下认款审核驳回，原因：{reason}"),
                    now as i32,
                )
                .await;
            Ok(())
        }
    }

    async fn offline_claim_stage(&self, order: &Order) -> Result<(i32, Decimal)> {
        if order.presale_type != Some(2) {
            return Ok((OfflinePaymentClaim::STAGE_FULL, order.unpaid_amount));
        }
        let ps = self
            .repos
            .payment
            .pay
            .find_presale_by_order_id(order.order_id)
            .await?
            .ok_or_else(|| Error::biz(400, "当前订单不可提交线下认款"))?;
        match ps.presale_status {
            0 => {
                let due = ps.deposit_amount - order.balance;
                if due <= Decimal::ZERO {
                    return Err(Error::biz(400, "当前订单不可提交线下认款"));
                }
                Ok((OfflinePaymentClaim::STAGE_DEPOSIT, due))
            }
            1 => Ok((OfflinePaymentClaim::STAGE_FINAL, order.unpaid_amount)),
            _ => Err(Error::biz(400, "当前订单不可提交线下认款")),
        }
    }
}

/// 线下认款实体 → VO。
fn to_offline_claim_vo(c: &OfflinePaymentClaim) -> OfflinePaymentClaimVO {
    OfflinePaymentClaimVO {
        claim_id: c.claim_id,
        order_id: c.order_id,
        order_sn: c.order_sn.clone(),
        user_id: c.user_id,
        shop_id: c.shop_id,
        claimed_amount: c.claimed_amount,
        pay_stage: c.pay_stage,
        pay_stage_name: stage_name(c.pay_stage),
        transfer_time: c.transfer_time,
        payer_name: c.payer_name.clone(),
        payer_account: c.payer_account.clone(),
        bank_serial_no: c.bank_serial_no.clone(),
        voucher_urls: c
            .voucher_urls
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok())
            .unwrap_or_default(),
        remark: c.remark.clone(),
        status: c.status,
        status_name: status_name(c.status),
        review_admin_id: c.review_admin_id,
        review_time: c.review_time,
        paid_time: c.paid_time,
        audit_remark: c.audit_remark.clone(),
        reject_reason: c.reject_reason.clone(),
        add_time: c.add_time,
        update_time: c.update_time,
    }
}

/// 原版客户端 `OrderStatusEnum` 文案（0–5）；兼容历史内部状态 10/20/30/40/50。
fn client_status_label(status: i32) -> String {
    match status {
        0 => "待付款",
        1 => "已确认，待发货",
        2 => "待收货",
        3 => "已取消",
        4 => "无效",
        5 => "已完成",
        10 => "待发货",
        20 => "已发货",
        30 => "已完成",
        40 => "已取消",
        50 => "已关闭",
        _ => "未知状态",
    }
    .to_string()
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`：≤0 返回空串）。
fn fmt_time(secs: i32) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

fn to_vo(o: &Order, items: &[OrderItem]) -> OrderVO {
    let status_label = client_status_label(o.order_status);
    let item_values: Vec<serde_json::Value> = items
        .iter()
        .map(|it| {
            serde_json::json!({
                "itemId": it.item_id,
                "orderId": it.order_id,
                "productId": it.product_id,
                "productName": it.product_name,
                "productSn": it.product_sn,
                "picThumb": it.pic_thumb,
                "productImage": it.pic_thumb,
                "quantity": it.quantity,
                "price": it.price,
                "subtotal": it.price * Decimal::from(it.quantity),
                "productType": it.product_type,
                "shopId": it.shop_id,
                "skuId": it.sku_id,
                "skuData": serde_json::from_str::<serde_json::Value>(&it.sku_data)
                    .unwrap_or(serde_json::Value::Array(Vec::new())),
                "extraSkuData": it
                    .extra_sku_data
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                    .unwrap_or(serde_json::Value::Array(Vec::new())),
                "seoLink": serde_json::Value::Null,
                "aftersalesItem": serde_json::Value::Null,
                "aftersalesNumber": 0,
                "eCard": serde_json::Value::Array(Vec::new()),
                "isGift": it.is_gift,
            })
        })
        .collect();
    let order_type = o.order_type.unwrap_or(0);
    let to_pay = o.order_status == 0;
    let to_comment = o.order_status == 5;
    let available_actions = serde_json::json!({
        "toPay": to_pay,
        "cancelOrder": to_pay,
        "delOrder": matches!(o.order_status, 3 | 4 | 5 | 40 | 50),
        "confirmReceipt": o.order_status == 2,
        "toAftersales": matches!(o.order_status, 2 | 5),
        "rebuy": true,
        "toComment": to_comment,
    });
    let pay_status_name = match o.pay_status {
        0 => "未支付",
        1 => "支付中",
        2 => "已支付",
        3 => "退款中",
        4 => "已退款",
        _ => "未知状态",
    }
    .to_string();
    let shipping_status_name = match o.shipping_status {
        0 => "未发货",
        1 => "部分发货",
        2 => "已发货",
        3 => "已收货",
        _ => "未知状态",
    }
    .to_string();
    let user_address = {
        let regions = serde_json::from_str::<Vec<String>>(&o.region_names)
            .map(|v| v.join(""))
            .unwrap_or_else(|_| o.region_names.clone());
        format!("{regions}{}", o.address)
    };
    OrderVO {
        order_id: o.order_id,
        order_sn: o.order_sn.clone(),
        shop_id: o.shop_id,
        order_status: o.order_status,
        order_status_name: status_label.clone(),
        status_label,
        pay_status: o.pay_status,
        shipping_status: o.shipping_status,
        total_amount: o.total_amount,
        paid_amount: o.paid_amount,
        consignee: o.consignee.clone(),
        mobile: o.mobile.clone(),
        add_time: fmt_time(o.add_time),
        item_count: i32::try_from(items.len()).unwrap_or(0),
        items: item_values,
        available_actions,
        cancel_remark: o.cancel_remark.clone(),
        order_type: o.order_type,
        parent_order_sn: o.parent_order_sn.clone(),
        is_card_order: o.is_card_order != 0,
        is_cycle_order: o.is_cycle_order != 0,
        is_pickup: matches!(o.shipping_method, 2),
        presale_info: None,
        order_source: Some(o.order_source.clone()),
        cycle_card_info: None,
        invoice_data: o
            .invoice_data
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        balance: o.balance,
        shipping_fee: o.shipping_fee,
        pay_status_name,
        shipping_status_name,
        pay_end_time: None,
        shipping_type_name: o.shipping_type_name.clone(),
        tracking_no: o.tracking_no.clone(),
        logistics_name: o.logistics_name.clone(),
        user_address,
        pay_type_id: o.pay_type_id,
        product_amount: o.product_amount,
        coupon_amount: o.coupon_amount,
        points_amount: o.points_amount,
        discount_amount: o.discount_amount,
        service_fee: o.service_fee,
        unpaid_amount: o.unpaid_amount,
        is_presale: o.is_presale != 0,
        auto_delivery_days: None,
        join_status: None,
        join_status_desc: None,
        after_sales_ing: false,
        pickup_detail: None,
        delivery_order_info: None,
        order_reservation: None,
        is_reservation_home: false,
        shop: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_create_dto_deserialization_with_invoice_and_o2o() {
        let json_str = r#"{
            "cartIds": [1, 2],
            "deliveryType": 2,
            "pickupId": 105,
            "pickupContactName": "王五",
            "pickupContactMobile": "13800138000",
            "invoiceData": {
                "invoiceType": 2,
                "titleType": 2,
                "companyName": "佰商科技",
                "taxNo": "91360100MA35XXXXXX",
                "content": "技术服务费",
                "email": "finance@tigshop.com"
            }
        }"#;

        let dto: OrderCreateDTO =
            serde_json::from_str(json_str).expect("deserialize OrderCreateDTO");
        assert_eq!(dto.cart_ids, vec![1, 2]);
        assert_eq!(dto.delivery_type, Some(2));
        assert_eq!(dto.pickup_id, Some(105));
        assert_eq!(dto.pickup_contact_name.as_deref(), Some("王五"));
        assert_eq!(dto.pickup_contact_mobile.as_deref(), Some("13800138000"));

        let inv = dto.invoice_data.expect("invoice_data present");
        assert_eq!(inv.invoice_type, Some(2));
        assert_eq!(inv.title_type, Some(2));
        assert_eq!(inv.company_name.as_deref(), Some("佰商科技"));
        assert_eq!(inv.tax_no.as_deref(), Some("91360100MA35XXXXXX"));
        assert_eq!(inv.content.as_deref(), Some("技术服务费"));
        assert_eq!(inv.email.as_deref(), Some("finance@tigshop.com"));
    }

    #[test]
    fn test_tax_amount_calculation_and_ceiling() {
        use crate::trade::check::calc_tax_amount;

        // 100 元，10% 税率 -> 10.00
        assert_eq!(calc_tax_amount(Decimal::new(10000, 2), Decimal::new(100, 1)), Decimal::new(1000, 2));

        // 0 元或 0 税率 -> 0
        assert_eq!(calc_tax_amount(Decimal::ZERO, Decimal::new(100, 1)), Decimal::ZERO);
        assert_eq!(calc_tax_amount(Decimal::new(10000, 2), Decimal::ZERO), Decimal::ZERO);

        // 向上取整 (CEILING)：10.55 元 * 6.5% = 0.68575 -> 0.69
        let res = calc_tax_amount(Decimal::new(1055, 2), Decimal::new(65, 1));
        assert_eq!(res, Decimal::new(69, 2));
    }
}

#[cfg(test)]
mod order_list_filter_tests {
    use super::{normalize_comment_status, normalize_is_showed};

    #[test]
    fn comment_status_minus_one_means_no_filter() {
        assert_eq!(normalize_comment_status(None), None);
        assert_eq!(normalize_comment_status(Some(-1)), None);
    }

    #[test]
    fn comment_status_zero_means_pending_and_positive_is_exact() {
        // 0 = 待评价（仓储层追加 order_status=5 条件）；>0 = 已评价等值
        assert_eq!(normalize_comment_status(Some(0)), Some(0));
        assert_eq!(normalize_comment_status(Some(1)), Some(1));
        assert_eq!(normalize_comment_status(Some(2)), Some(2));
    }

    #[test]
    fn is_showed_only_filters_from_zero_upwards() {
        assert_eq!(normalize_is_showed(None), None);
        assert_eq!(normalize_is_showed(Some(-1)), None);
        assert_eq!(normalize_is_showed(Some(0)), Some(0));
        assert_eq!(normalize_is_showed(Some(1)), Some(1));
    }
}
