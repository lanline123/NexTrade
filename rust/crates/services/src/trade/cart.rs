//! 购物车服务：加购、改量、勾选、删除、价格汇总。
//! 对应原 Java `CartServiceImpl`。

use std::sync::Arc;

use rust_decimal::Decimal;
use serde::Serialize;
use tigshop_core::entities::Cart;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;

use crate::catalog::product::ProductService;

/// 带价附加属性解析结果（加购落库用）。
#[derive(Debug, Default)]
struct ExtraAttrsResolved {
    /// 命中的 `attributes_id`（用于判断是否携带附加属性）
    ids: Vec<i32>,
    /// `cart.extra_sku_data` JSON 串（未命中为 None）
    json: Option<String>,
    /// Σ`attr_price`（计入行到手价）
    total_price: Decimal,
}

/// 购物车行 VO（Java `CartVO` 前端使用子集）。
///
/// H5/PC 购物车页直接读取：cartId/productStatus/stock/price/originPrice/
/// quantity/isChecked(bool)/skuData(数组)/productName/picThumb/skuId 等
/// （java/view/uniapp `pages/cart/index.vue`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CartItemVO {
    pub cart_id: i32,
    pub user_id: i32,
    pub product_id: i32,
    pub pic_thumb: String,
    pub market_price: Decimal,
    /// Java `originalPrice` 为 String（划线价展示）。
    pub original_price: String,
    pub quantity: i32,
    pub sku_id: Option<i32>,
    pub shop_id: i32,
    pub r#type: i32,
    pub update_time: i64,
    pub product_sn: String,
    pub product_name: String,
    pub product_type: Option<i32>,
    pub product_stock: i32,
    /// 限购上限（Java `CartServiceImpl:433` `cartVO.setLimitNumber(product.getLimitNumber())`）。
    /// 0 表示不限购。
    pub limit_number: i32,
    /// 1 上架 / 0 下架。
    pub product_status: i32,
    pub product_price: Decimal,
    pub member_price: Decimal,
    /// 行生效单价。
    pub price: Decimal,
    /// 划线原价。
    pub origin_price: Decimal,
    /// 当前可售库存。
    pub stock: i32,
    pub is_checked: bool,
    /// 规格值数组（Java JSONArray；H5 `getSkuValueText` 按数组读）。
    pub sku_data: serde_json::Value,
    pub has_sku: bool,
    pub subtotal: Decimal,
    pub is_disabled: bool,
    pub disabled_reason: String,
    pub activity_info: Vec<serde_json::Value>,
    pub extra_sku_data: Vec<serde_json::Value>,
    pub service_fee: String,
    pub wholesale_multiple: i32,
}

/// 店铺分组合计（Java `CartByStoreVO.CartStoreTotal`，未迁移优惠引擎的字段为 0）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CartStoreTotalVO {
    pub coupon_ids: Vec<i32>,
    pub product_amount: Decimal,
    pub total_count: i64,
    pub checked_count: i64,
    pub discounts: Decimal,
    pub discount_after: Decimal,
    pub service_fee: Decimal,
}

/// 店铺分组（Java `CartByStoreVO`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CartByStoreVO {
    pub total: CartStoreTotalVO,
    pub carts: Vec<CartItemVO>,
    pub used_promotions: Vec<serde_json::Value>,
    pub enable_use_promotion: Vec<serde_json::Value>,
    pub gift: Vec<serde_json::Value>,
    pub shop_id: i32,
    pub shop_title: String,
    pub no_shipping: i32,
    pub is_not_reach_min_order_amount: bool,
    pub min_order_amount_diff: Decimal,
    pub wholesale_group_hint: String,
    pub wholesale_configured: bool,
    /// H5 店铺勾选框 v-model（Java 端由前端回填，这里直接给初值）。
    pub is_checked: bool,
    /// H5 列表 :key 用（Java 端无此字段，取 shopId 保证稳定）。
    pub cart_id: i32,
}

/// 购物车总合计（Java `CartListByStoreVO.CartTotal`，未迁移优惠引擎的字段为 0）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CartTotalVO {
    pub product_amount: Decimal,
    pub checked_count: i64,
    pub discounts: Decimal,
    pub discount_after: Decimal,
    pub discount_change_price: Decimal,
    pub pos_other_discount_amount: Decimal,
    pub total_count: i64,
    pub discount_coupon_amount: Decimal,
    pub discount_seckill_amount: Decimal,
    pub discount_product_promotion_amount: Decimal,
    pub discount_time_discount_amount: Decimal,
    pub discount_group_buy_amount: Decimal,
    pub discount_discount_amount: Decimal,
    pub round_off_cents_amount: Decimal,
    pub round_off_dime_amount: Decimal,
    pub service_fee: Decimal,
}

/// 购物车列表（Java `CartListByStoreVO`，按店铺分组）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CartListByStoreVO {
    pub total: CartTotalVO,
    pub has_change_price: bool,
    pub cart_list: Vec<CartByStoreVO>,
    pub is_wholesale_buyer: bool,
}

#[derive(Clone)]
pub struct CartService {
    repos: Arc<Repositories>,
    product: ProductService,
}

impl CartService {
    pub fn new(repos: Arc<Repositories>, product: ProductService) -> Self {
        Self { repos, product }
    }

    /// 加入购物车（同款累加数量；拼团上下文以独立行保存）。
    ///
    /// `is_quick = true` 表示“立即购买”：先取消该会员其它购物车行的勾选，
    /// 保证结算页只带当前这一件商品。
    ///
    /// `extra_attr_ids`：带价附加属性 `product_attributes.attributes_id` 逗号串
    /// （旧版 `ProductAttr.vue` `attr_type=2` 选中后提交，Java `AddToCartDTO.extraAttrIds`）。
    /// 对齐 Java `CartServiceImpl`：Σ`attr_price` 计入行到手价，并把属性明细
    /// （attributesId/attrName/attrValue/attrPrice）JSON 落 `cart.extra_sku_data`。
    pub async fn add(
        &self,
        user_id: i32,
        product_id: i32,
        sku_id: Option<i32>,
        quantity: i32,
        groupon_data: Option<&tigshop_core::models::trade::check::GrouponCartData>,
        is_quick: bool,
        extra_attr_ids: Option<&str>,
    ) -> Result<i32> {
        if quantity <= 0 {
            return Err(Error::Validation("数量必须大于0".into()));
        }
        // 校验商品可购
        self.product.check_purchasable(product_id, sku_id, quantity).await?;

        // 附加属性明细 + 价格合计（Java `CartServiceImpl:1615` str2IntList →
        // `getProductAttributesByIds` → `CarExtraSkuDataDTO` 落 `cart.extraSkuData`）
        let extra = self.resolve_extra_attrs(extra_attr_ids).await?;
        let price = self
            .product
            .detail(product_id)
            .await
            .map(|v| v.product_price)
            .unwrap_or_default()
            + extra.total_price;

        if is_quick {
            self.repos.trade.cart.uncheck_all(user_id).await?;
        }

        // 已存在同款则累加（拼团商品不与普通购物车行合并）
        if groupon_data.is_none() {
            if let Some(existing) = self
                .repos.trade.cart
                .find_line(user_id, product_id, sku_id)
                .await?
            {
                let new_qty = existing.quantity + quantity;
                self.product.check_purchasable(product_id, sku_id, new_qty).await?;
                let cart_id = existing.cart_id;
                self.repos.trade.cart.update_quantity(cart_id, user_id, new_qty).await?;
                // Java 合并是「删旧行 + 按本次选择重插」，extraSkuData / 到手价随之刷新
                if !extra.ids.is_empty() {
                    self.repos.trade.cart
                        .update_extra_sku_data(cart_id, user_id, extra.json.as_deref(), price)
                        .await?;
                }
                if is_quick {
                    self.repos.trade.cart.update_checked(cart_id, user_id, true).await?;
                }
                return Ok(cart_id);
            }
        }

        let cart = Cart {
            user_id,
            product_id,
            sku_id,
            quantity,
            original_price: price,
            market_price: Some(price),
            is_checked: 1,
            r#type: 0,
            extra_data: groupon_data
                .and_then(|g| serde_json::to_string(g).ok()),
            extra_sku_data: extra.json,
            ..Default::default()
        };
        self.repos.trade.cart.insert(&cart).await
    }

    /// 解析带价附加属性：id 串 → `product_attributes` 明细 + 价格合计。
    ///
    /// JSON 形状对齐 Java `CarExtraSkuDataDTO`（`JSONUtil.toJsonStr`）：
    /// `[{attributesId, attrName, attrValue, attrPrice}]`。
    async fn resolve_extra_attrs(
        &self,
        extra_attr_ids: Option<&str>,
    ) -> Result<ExtraAttrsResolved> {
        let ids = super::proxy_shopping_product::parse_extra_attr_ids(extra_attr_ids);
        if ids.is_empty() {
            return Ok(ExtraAttrsResolved::default());
        }
        let rows = self
            .repos
            .trade
            .proxy_shopping_product
            .find_attribute_details(&ids)
            .await?;
        let mut total = Decimal::ZERO;
        let items: Vec<serde_json::Value> = rows
            .iter()
            .map(|(id, name, value, price)| {
                if let Some(p) = price {
                    total += *p;
                }
                serde_json::json!({
                    "attributesId": id,
                    "attrName": name,
                    "attrValue": value,
                    "attrPrice": price.map(|p| p.to_string()),
                })
            })
            .collect();
        let json = if items.is_empty() {
            None
        } else {
            Some(serde_json::to_string(&items).unwrap_or_default())
        };
        Ok(ExtraAttrsResolved { ids, json, total_price: total })
    }

    /// 修改数量。
    pub async fn update_quantity(
        &self,
        user_id: i32,
        cart_id: i32,
        quantity: i32,
    ) -> Result<()> {
        if quantity <= 0 {
            return Err(Error::Validation("数量必须大于0".into()));
        }
        let cart = self
            .repos.trade.cart
            .find_owned(cart_id, user_id)
            .await?
            .ok_or_else(|| Error::NotFound("购物车记录不存在".into()))?;
        self.product
            .check_purchasable(cart.product_id, cart.sku_id, quantity)
            .await?;
        self.repos.trade.cart.update_quantity(cart_id, user_id, quantity).await
    }

    /// 勾选/取消勾选。
    pub async fn set_checked(&self, user_id: i32, cart_id: i32, checked: bool) -> Result<()> {
        self.repos.trade.cart.update_checked(cart_id, user_id, checked).await
    }

    /// 删除指定行。
    pub async fn remove(&self, user_id: i32, cart_ids: &[i32]) -> Result<()> {
        self.repos.trade.cart.delete(cart_ids, user_id).await?;
        Ok(())
    }

    /// 清空。
    pub async fn clear(&self, user_id: i32) -> Result<()> {
        self.repos.trade.cart.clear(user_id).await?;
        Ok(())
    }

    /// 购物车列表（Java `CartServiceImpl#list` 契约：按店铺分组）。
    ///
    /// 实时回填商品名/图/状态/库存；优惠与活动引擎未迁移，相关字段为 0/空数组。
    pub async fn summary(&self, user_id: i32) -> Result<CartListByStoreVO> {
        let carts = self.repos.trade.cart.find_by_user(user_id, None).await?;
        let (mut checked_qty, mut checked_amount, mut total_qty) = (0i64, Decimal::ZERO, 0i64);

        // 按店铺分组（保持首次出现顺序；shop_id=0 自营）
        let mut shop_order: Vec<i32> = Vec::new();
        let mut groups: std::collections::HashMap<i32, Vec<Cart>> = std::collections::HashMap::new();
        for c in carts {
            if !groups.contains_key(&c.shop_id) {
                shop_order.push(c.shop_id);
            }
            groups.entry(c.shop_id).or_default().push(c);
        }

        let mut cart_list = Vec::with_capacity(shop_order.len());
        for shop_id in shop_order {
            let rows = groups.remove(&shop_id).unwrap_or_default();
            let shop_title = if shop_id > 0 {
                self.repos
                    .merchant
                    .shop
                    .find_by_id(shop_id)
                    .await
                    .ok()
                    .flatten()
                    .and_then(|s| s.shop_title)
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let mut lines = Vec::with_capacity(rows.len());
            let (mut store_qty, mut store_checked_qty, mut store_amount) =
                (0i64, 0i64, Decimal::ZERO);
            let mut group_all_checked = !rows.is_empty();

            /**
             * 购物车行的活动信息（activityInfo）。
             *
             * Java 侧购物车行的 activityInfo 来自商品促销（CartServiceImpl:962
             * `cart.setActivityInfo(product.getActivityInfo())`），用于前台展示活动标签。
             * Rust 侧此前恒为空数组 → 购物车不显示「秒杀/拼团/满减」标签。
             *
             * 匹配口径对齐 Java `ProductServiceImpl.getProductsPromotionByProductShop`
             * （第 5863-5866 行注释）：**活动按「活动店铺 == 商品店铺」匹配**，
             * 而不是「活动范围命中商品」这一条。故此处按商品的 shop_id 过滤活动，
             * 避免把别的店铺的活动挂到本行商品上。
             *
             * 金额计算（parsePrice）未迁移，与 Java 购物车一致——购物车阶段的
             * 优惠金额字段本就全为 0。
             */
            let available_promotions = self
                .repos
                .marketing
                .promotion
                .find_available(None, std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0))
                .await
                .unwrap_or_default();

            for c in rows {
                let pid = c.product_id;
                let qty = c.quantity;
                // 购物车行本身不存商品名/图，列表必须回填，否则前端会当成空行。
                let product = self.repos.catalog.product.find_by_id(pid).await.ok().flatten();
                let product_name = product
                    .as_ref()
                    .map(|p| p.product_name.clone())
                    .unwrap_or_default();
                let pic_thumb = product
                    .as_ref()
                    .map(|p| p.pic_thumb.clone())
                    .unwrap_or_else(|| c.pic_thumb.clone().unwrap_or_default());
                let product_sn = product
                    .as_ref()
                    .map(|p| p.product_sn.clone())
                    .unwrap_or_default();
                let (product_stock, product_status, product_type, limit_number) = product
                    .as_ref()
                    .map(|p| (p.product_stock, p.product_status, p.product_type, p.limit_number))
                    .unwrap_or((0, 0, Some(0), 0));
                let (product_price, market_price) = product
                    .as_ref()
                    .map(|p| (p.product_price, p.market_price))
                    .unwrap_or((Decimal::ZERO, Decimal::ZERO));

                // original_price 为 NOT NULL；market_price 可空，仅作兜底
                let price = if c.original_price > Decimal::ZERO {
                    c.original_price
                } else {
                    c.market_price.unwrap_or(product_price)
                };
                let origin_price = if market_price > Decimal::ZERO {
                    market_price
                } else {
                    price
                };
                let subtotal = price * Decimal::from(qty);
                let checked = c.is_checked();
                let is_disabled = product_status == 0;
                let disabled_reason = if is_disabled {
                    "已下架".to_string()
                } else if product_stock < qty {
                    "库存不足".to_string()
                } else {
                    String::new()
                };
                // cart.sku_data 存 JSON 字符串；H5 按数组读取规格值
                let sku_data: serde_json::Value = c
                    .sku_data
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                    .filter(|v| v.is_array())
                    .unwrap_or_else(|| serde_json::Value::Array(vec![]));
                let extra_sku_data: Vec<serde_json::Value> = c
                    .extra_sku_data
                    .as_deref()
                    .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
                    .unwrap_or_default();
                let has_sku = c.sku_id.map(|id| id > 0).unwrap_or(false)
                    || sku_data.as_array().is_some_and(|a| !a.is_empty());

                /**
                 * 该商品命中的营销活动（用于购物车活动标签）。
                 *
                 * 两条过滤（对齐 Java `getProductsPromotionByProductShop`）：
                 * 1. 活动店铺 == 商品店铺（`pr.shop_id == product.shop_id`）；
                 * 2. 活动范围命中该商品（`promotion_covers_product`）。
                 */
                let product_shop_id = product.as_ref().map(|p| p.shop_id).unwrap_or(c.shop_id);
                let activity_info: Vec<serde_json::Value> = available_promotions
                    .iter()
                    .filter(|pr| pr.shop_id == product_shop_id)
                    .filter(|pr| crate::catalog::product_manage_client::promotion_covers_product(pr, pid))
                    .map(|pr| {
                        serde_json::json!({
                            "promotionId": pr.promotion_id,
                            "promotionName": pr.promotion_name,
                            "startTime": pr.start_time,
                            "endTime": pr.end_time,
                            "type": pr.r#type,
                            "shopId": pr.shop_id,
                            "relationId": pr.relation_id,
                            "range": pr.range,
                            "typeText": tigshop_core::models::marketing::promotion::type_text(pr.r#type),
                        })
                    })
                    .collect();

                if checked {
                    checked_qty += i64::from(qty);
                    checked_amount += subtotal;
                    store_checked_qty += i64::from(qty);
                    store_amount += subtotal;
                } else {
                    group_all_checked = false;
                }
                total_qty += i64::from(qty);
                store_qty += i64::from(qty);

                lines.push(CartItemVO {
                    cart_id: c.cart_id,
                    user_id: c.user_id,
                    product_id: pid,
                    pic_thumb,
                    market_price,
                    original_price: origin_price.to_string(),
                    quantity: qty,
                    sku_id: c.sku_id,
                    shop_id: c.shop_id,
                    r#type: c.r#type,
                    update_time: i64::from(c.update_time),
                    product_sn,
                    product_name,
                    product_type,
                    product_stock,
                    limit_number,
                    product_status,
                    product_price,
                    member_price: price,
                    price,
                    origin_price,
                    stock: product_stock,
                    is_checked: checked,
                    sku_data,
                    has_sku,
                    subtotal,
                    is_disabled,
                    disabled_reason,
                    activity_info,
                    extra_sku_data,
                    service_fee: "0".to_string(),
                    wholesale_multiple: 1,
                });
            }

            cart_list.push(CartByStoreVO {
                total: CartStoreTotalVO {
                    coupon_ids: vec![],
                    product_amount: store_amount,
                    total_count: store_qty,
                    checked_count: store_checked_qty,
                    discounts: Decimal::ZERO,
                    discount_after: store_amount,
                    service_fee: Decimal::ZERO,
                },
                carts: lines,
                used_promotions: vec![],
                enable_use_promotion: vec![],
                gift: vec![],
                shop_id,
                shop_title,
                no_shipping: 0,
                is_not_reach_min_order_amount: false,
                min_order_amount_diff: Decimal::ZERO,
                wholesale_group_hint: String::new(),
                wholesale_configured: false,
                is_checked: group_all_checked,
                cart_id: shop_id,
            });
        }

        Ok(CartListByStoreVO {
            total: CartTotalVO {
                product_amount: checked_amount,
                checked_count: checked_qty,
                discounts: Decimal::ZERO,
                discount_after: checked_amount,
                discount_change_price: Decimal::ZERO,
                pos_other_discount_amount: Decimal::ZERO,
                total_count: total_qty,
                discount_coupon_amount: Decimal::ZERO,
                discount_seckill_amount: Decimal::ZERO,
                discount_product_promotion_amount: Decimal::ZERO,
                discount_time_discount_amount: Decimal::ZERO,
                discount_group_buy_amount: Decimal::ZERO,
                discount_discount_amount: Decimal::ZERO,
                round_off_cents_amount: Decimal::ZERO,
                round_off_dime_amount: Decimal::ZERO,
                service_fee: Decimal::ZERO,
            },
            has_change_price: false,
            cart_list,
            is_wholesale_buyer: false,
        })
    }

    /// 获取已勾选且可结算的购物车行（下单用）。
    pub async fn checked_lines(&self, user_id: i32, cart_ids: &[i32]) -> Result<Vec<Cart>> {
        let carts = self.repos.trade.cart.find_by_user(user_id, None).await?;
        Ok(carts
            .into_iter()
            .filter(|c| c.is_checked() && (cart_ids.is_empty() || cart_ids.contains(&c.cart_id)))
            .collect())
    }
}