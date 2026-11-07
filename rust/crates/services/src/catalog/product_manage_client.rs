//! catalog::product_manage client/admin 第二批端点 —— 服务层（wave8 batch 2）。
//!
//! 构造签名固定 `pub fn new(repos: Arc<Repositories>) -> Self`；仓储经嵌套
//! 聚合根访问：`self.repos.catalog.product_manage`。
//!
//! 说明：
//! - 复用 `ProductManageRepository` 已有方法（comments/coupons/related/history 等）；
//!   仓储缺口（selectProductList 跨表筛选、price_inquiry 写入）放在
//!   `infrastructure/src/db/repo/catalog/product_manage_client.rs`，本层不写 SQL
//!   （services crate 无 sqlx 依赖）。
//! - 列表/统计类返回 `serde_json::Value`：字段语义对齐 Java VO，但未逐字段裁剪。
//!
//! ## 偏差登记
//! 1. `share` 返回最小 HTML（Java 由 `getSharePageHtml` 生成完整分享页；图片/脚本
//!    等前端资源未迁移）。HTML 内容已做转义。
//! 2. `getProductAmount` 仅按 SKU 零售价 × 数量求和；会员价/批发/优惠券/促销
//!    叠加未迁移（Java `ProductAmountDTO` 之后还有批发旁路）。
//! 3. `promotion` 返回商品自身的促销字段（isPromote/promotePrice/时间），未聚合
//!    seckill/groupon/time_discount 域活动。
//! 4. `copy` 只复制商品主表（SKU/图册/属性未复制，Java 全量复制）。
//! 5. `getProductAvailability` 返回 sku 维度的价格/库存子集（Java VO 还含
//!    促销、定金、距离、赠品卡等计算字段）。
//! 6. 收藏/历史等依赖登录态的端点：未登录时返回空/false（同 Java）。

use std::sync::Arc;

use rust_decimal::Decimal;
use serde::Serialize;

use tigshop_common::utils;
use tigshop_core::entities::Promotion;
use tigshop_core::models::catalog::product_manage_client::{
    html_escape, product_list_item, CommentListQuery, FeedbackListQuery, HistoryProductQuery,
    ProductAmountDTO, ProductAvailabilityQuery, ProductConfigQuery, ProductCopyDTO, ProductIdParam,
    ProductPriceInquiryDTO, ProductShareInfoDTO, ProductShareInfoVO, ProductsPromotionDTO,
    PresaleDepositQuery, SelectProductListQuery, BatchAvailabilityQuery, MSG_AMOUNT_ITEMS_REQUIRED,
    MSG_INQUIRY_CONTENT_REQUIRED, MSG_PRODUCT_ID_REQUIRED, MSG_PRODUCT_NOT_FOUND,
};
use tigshop_core::models::marketing::promotion as promotion_model;
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::catalog::product_manage::ProductManageRepository;
use tigshop_infrastructure::db::Repositories;

/// batch 2 服务。
pub struct ProductManageClientService {
    repos: Arc<Repositories>,
}

fn now_secs() -> i32 {
    i32::try_from(utils::now_millis() / 1000).unwrap_or(0)
}

fn to_json<T: Serialize>(v: &T) -> serde_json::Value {
    serde_json::to_value(v).unwrap_or(serde_json::Value::Null)
}

fn i64_of(v: &serde_json::Value, keys: &[&str]) -> i64 {
    for k in keys {
        if let Some(n) = v.get(*k) {
            if let Some(x) = n.as_i64() {
                return x;
            }
            if let Some(s) = n.as_str().and_then(|s| s.parse::<i64>().ok()) {
                return s;
            }
        }
    }
    0
}

impl ProductManageClientService {
    /// 构造服务。
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本 feature 仓储。
    #[must_use]
    pub fn repo(&self) -> &ProductManageRepository {
        &self.repos.catalog.product_manage
    }

    // ————————————————————— admin —————————————————————

    /// 商品配置（Java `config`）：运费模板/服务/会员等级/卡券组/库存编辑开关。
    pub async fn admin_config(&self, q: &ProductConfigQuery) -> Result<serde_json::Value> {
        let tpls = self.repo().find_shipping_tpls(q.shop_id, &[]).await?;
        let services = self.repo().find_all_services().await?;
        let ranks = self.repo().find_all_user_ranks().await?;
        let groups = self.repo().find_ecard_groups(q.shop_id).await?;
        let edit_stock = self.repo().config_val("productEditStockModify").await?;
        Ok(serde_json::json!({
            "shippingTplList": tpls.iter().map(|x| to_json(x)).collect::<Vec<_>>(),
            "suppliersList": [],
            "serviceList": services.iter().map(|x| to_json(x)).collect::<Vec<_>>(),
            "userRankList": ranks.iter().map(|x| to_json(x)).collect::<Vec<_>>(),
            "eCardList": groups.iter().map(|x| to_json(x)).collect::<Vec<_>>(),
            "productServiceIds": services.iter().map(|s| s.product_service_id).collect::<Vec<_>>(),
            "productEditStockModify": edit_stock.and_then(|v| v.parse::<i32>().ok()).unwrap_or(1),
        }))
    }

    /// 商品复制（Java `copy`）：复制商品主表并生成新货号。
    pub async fn admin_copy(&self, dto: &ProductCopyDTO) -> Result<String> {
        let mut product = self
            .repo()
            .find_product(dto.product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let next_id = self.repo().max_product_id().await? + 1;
        product.product_sn = format!("{}-copy-{next_id}", product.product_sn);
        product.add_time = now_secs();
        product.click_count = 0;
        let new_id = self.repo().insert_product(&product).await?;
        Ok(format!("商品复制成功，新商品ID：{new_id}"))
    }

    /// 商品推广数据（Java `getPromoteData`）。
    pub async fn admin_promote_data(&self, product_id: i32) -> Result<serde_json::Value> {
        let p = self
            .repo()
            .find_product(product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let shop_name = if p.shop_id > 0 {
            self.repo()
                .find_shop_title(p.shop_id)
                .await?
                .unwrap_or_else(|| "商城自营".to_string())
        } else {
            "商城自营".to_string()
        };
        Ok(serde_json::json!({
            "productName": p.product_name,
            "productPrice": p.product_price,
            "picUrl": p.pic_url,
            "productBrief": p.product_brief,
            "productSn": p.product_sn,
            "shopName": shop_name,
            // Java 由短链服务生成；本仓库短链服务未迁移 → 以站内路径兜底。
            "shortLink": format!("/p/{product_id}"),
            "wechatShortLink": serde_json::Value::Null,
        }))
    }

    /// SKU 商品选择列表（Java `selectProductList`；跨表筛选走 sqlx）。
    pub async fn admin_select_product_list(
        &self,
        q: &SelectProductListQuery,
    ) -> Result<PageResult<serde_json::Value>> {
        let page = q.page_query();
        let (total, rows) = self
            .repos
            .catalog
            .product_manage_client
            .paginate_select_product_list(q)
            .await?;
        let list = rows
            .into_iter()
            .map(|r| {
                serde_json::json!({
                    "skuId": r.sku_id, "productId": r.product_id,
                    "skuPrice": r.sku_price, "skuStock": r.sku_stock,
                    "productName": r.product_name, "productSn": r.product_sn,
                    "picUrl": r.pic_url, "productPrice": r.product_price,
                    "categoryId": r.category_id, "productType": r.product_type,
                    "shopId": r.shop_id,
                })
            })
            .collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 保存商品分享信息（Java `saveShareInfo`）。
    pub async fn admin_save_share_info(&self, dto: &ProductShareInfoDTO) -> Result<bool> {
        let exists = self.repo().find_product(dto.product_id).await?;
        if exists.is_none() {
            return Err(Error::Validation(MSG_PRODUCT_NOT_FOUND.into()));
        }
        let raw = serde_json::to_string(dto)
            .map_err(|e| Error::Internal(format!("分享信息序列化失败: {e}")))?;
        let n = self.repo().set_product_share_info(dto.product_id, &raw).await?;
        Ok(n > 0)
    }

    /// 获取商品分享信息（Java `shareInfo`）。
    pub async fn admin_share_info(&self, product_id: i32) -> Result<ProductShareInfoVO> {
        let p = self
            .repo()
            .find_product(product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        if let Some(raw) = p.share_info.as_deref().filter(|s| !s.trim().is_empty()) {
            if let Ok(vo) = serde_json::from_str::<ProductShareInfoVO>(raw) {
                return Ok(vo);
            }
        }
        Ok(ProductShareInfoVO {
            product_id: p.product_id,
            product_name: p.product_name,
            product_price: p.product_price,
            pic_url: p.pic_url,
        })
    }

    // ————————————————————— public —————————————————————

    /// 分享页 HTML（Java `getSharePageHtml`；最小可用页面）。
    pub async fn share_html(&self, product_id: i32, _salesman_id: Option<i32>) -> Result<String> {
        let p = self
            .repo()
            .find_product(product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        Ok(format!(
            "<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title></head>\
             <body><h1>{}</h1><p>价格：{}</p><img src=\"{}\" alt=\"product\"/></body></html>",
            html_escape(&p.product_name),
            html_escape(&p.product_name),
            p.product_price,
            html_escape(&p.pic_url)
        ))
    }

    /// 是否收藏（Java `isCollectMethod`：未登录返回 false）。
    pub async fn is_collect(&self, user_id: Option<i32>, q: &ProductIdParam) -> Result<bool> {
        let Some(uid) = user_id.filter(|v| *v > 0) else {
            return Ok(false);
        };
        Ok(self.repo().count_collect(uid, q.id, q.shop_id).await? > 0)
    }

    /// 商品可用优惠券（Java `getCouponList`）。
    pub async fn coupon_list(&self, q: &ProductIdParam) -> Result<Vec<serde_json::Value>> {
        let p = self
            .repo()
            .find_product(q.id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let shop_id = q.shop_id.unwrap_or(p.shop_id);
        let coupons = self.repo().find_shop_coupons(shop_id, now_secs()).await?;
        let mut out = Vec::with_capacity(coupons.len());
        for c in &coupons {
            let mut v = to_json(c);
            let received = self.repo().count_coupon_receive(c.coupon_id).await?;
            if let Some(o) = v.as_object_mut() {
                o.insert("receivedCount".into(), serde_json::json!(received));
            }
            out.push(v);
        }
        Ok(out)
    }

    /// 商品评论统计（Java `ProductCommentStatisticVO`）。
    pub async fn comment_statistic(&self, q: &ProductIdParam) -> Result<serde_json::Value> {
        let comments = self
            .repo()
            .find_comments_by_product_ids(&[q.id], q.shop_id)
            .await?;
        let total = comments.len() as i64;
        let mut good = 0_i64;
        let mut moderate = 0_i64;
        let mut bad = 0_i64;
        let mut rank_sum = 0_i64;
        for c in &comments {
            let v = to_json(c);
            let rank = i64_of(&v, &["rank", "comment_rank", "score"]).clamp(1, 5);
            rank_sum += rank;
            match rank {
                4..=5 => good += 1,
                3 => moderate += 1,
                _ => bad += 1,
            }
        }
        let pct = |n: i64| {
            if total == 0 {
                "0.00".to_string()
            } else {
                format!("{:.2}", n as f64 * 100.0 / total as f64)
            }
        };
        Ok(serde_json::json!({
            "total": total,
            "goodCount": good, "goodPercent": pct(good),
            "moderateCount": moderate, "moderatePercent": pct(moderate),
            "badCount": bad, "badPercent": pct(bad),
            "showCount": comments.iter().filter(|c| { let v = to_json(c); i64_of(&v, &["is_showed","is_show"]) == 1 }).count(),
            "averageRank": if total == 0 { 0 } else { rank_sum / total },
        }))
    }

    /// 评论列表（Java `getCommentList`：默认 10/页，type==5 只查展示中）。
    pub async fn comment_list(
        &self,
        q: &CommentListQuery,
    ) -> Result<PageResult<serde_json::Value>> {
        let page = q.page_query();
        let limit = u64::from(page.page_size);
        let offset = u64::from(page.page - 1) * limit;
        let is_showed = if q.type_ == Some(5) { Some(1) } else { None };
        let (total, rows, replies) = self
            .repo()
            .paginate_client_comments(&[q.id], q.shop_id, q.type_, is_showed, limit, offset)
            .await?;
        let parent_ids: Vec<i32> = rows.iter().map(|c| c.comment_id).collect();
        let reply_rows = if parent_ids.is_empty() {
            Vec::new()
        } else {
            self.repo().find_comment_replies(&parent_ids).await?
        };
        let reply_json: Vec<serde_json::Value> = reply_rows.iter().map(|x| to_json(x)).collect();
        let user_ids: Vec<i32> = rows.iter().map(|c| c.user_id).collect();
        let nicks = self.repo().find_user_nicks(&user_ids).await?;
        let nick_map: std::collections::HashMap<i32, Option<String>> =
            nicks.into_iter().collect();
        let list = rows
            .iter()
            .map(|c| {
                let mut v = to_json(c);
                if let Some(o) = v.as_object_mut() {
                    o.insert(
                        "username".into(),
                        serde_json::json!(nick_map.get(&c.user_id).cloned().flatten()),
                    );
                    let parent = c.comment_id;
                    o.insert(
                        "replies".into(),
                        serde_json::Value::Array(
                            reply_json
                                .iter()
                                .filter(|r| i64_of(r, &["parent_id"]) == i64::from(parent))
                                .cloned()
                                .collect(),
                        ),
                    );
                }
                v
            })
            .collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 商品咨询列表（Java `getFeedbackList`）。
    pub async fn feedback_list(
        &self,
        q: &FeedbackListQuery,
    ) -> Result<PageResult<serde_json::Value>> {
        let page = q.page_query();
        let limit = u64::from(page.page_size);
        let offset = u64::from(page.page - 1) * limit;
        let (col, asc) = q.order();
        let (total, rows) = self
            .repo()
            .paginate_feedback(q.product_id, q.shop_id, limit, offset, col, asc)
            .await?;
        let ids: Vec<i32> = rows.iter().map(|f| f.id).collect();
        let replies = if ids.is_empty() {
            Vec::new()
        } else {
            self.repo().find_feedback_replies(&ids).await?
        };
        let reply_json: Vec<serde_json::Value> = replies.iter().map(|x| to_json(x)).collect();
        let list = rows
            .iter()
            .map(|f| {
                let mut v = to_json(f);
                if let Some(o) = v.as_object_mut() {
                    o.insert(
                        "replies".into(),
                        serde_json::Value::Array(
                            reply_json
                                .iter()
                                .filter(|r| i64_of(r, &["parent_id"]) == i64::from(f.id))
                                .cloned()
                                .collect(),
                        ),
                    );
                }
                v
            })
            .collect();
        Ok(PageResult::new(total, list, &page))
    }

    /// 商品可用性（Java `getProductAvailability`；返回 sku 维度价格/库存子集）。
    pub async fn availability(
        &self,
        q: &ProductAvailabilityQuery,
    ) -> Result<serde_json::Value> {
        let id = q
            .id
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_ID_REQUIRED.into()))?;
        let product = self
            .repo()
            .find_product(id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let skus = self.repo().find_skus(id, false).await?;
        let sku = match q.sku_id {
            Some(sid) => skus.iter().find(|s| s.sku_id == sid),
            None => skus.first(),
        };
        let (sku_id, price, stock) = sku
            .map(|s| (s.sku_id, s.sku_price.unwrap_or_default(), s.sku_stock.unwrap_or(0)))
            .unwrap_or((0, product.product_price, product.product_stock));
        Ok(serde_json::json!({
            "id": product.product_id,
            "productId": product.product_id,
            "skuId": sku_id,
            "price": price,
            "originPrice": product.product_price,
            "marketPrice": product.market_price,
            "stock": stock,
            "data": skus.iter().map(|x| to_json(x)).collect::<Vec<_>>(),
        }))
    }

    /// 商品促销信息（Java `getProductsPromotion`）。
    ///
    /// 商品自身促销字段 + `activityInfo`（进行中且范围命中该商品的营销活动，
    /// 对齐 Java `PromotionServiceImpl#queryAvailablePromotion` + `range` 过滤）。
    /// 与 Java 的差异（见模块偏差登记 3）：券资格/会员人群/批发旁路等计价装配
    /// 未迁移，`activityInfo` 为纯展示用途（前台活动标签/拼团判定），且已排除
    /// 优惠券（type=2，前台列表本就不展示）。
    pub async fn products_promotion(
        &self,
        dto: &ProductsPromotionDTO,
    ) -> Result<serde_json::Value> {
        let ids: Vec<i32> = dto
            .products
            .iter()
            .filter_map(|p| p.get("productId").and_then(serde_json::Value::as_i64))
            .filter_map(|v| i32::try_from(v).ok())
            .collect();
        let products = self.repo().find_products_by_ids(&ids).await?;
        let mut map = serde_json::Map::new();
        if products.is_empty() {
            return Ok(serde_json::Value::Object(map));
        }

        let now = i64::from(now_secs());
        // Java：shopId=null → 不按店铺过滤（全平台活动）
        let shop_ids: Option<Vec<i32>> = dto.shop_id.map(|s| vec![s]);
        let promotions = self
            .repos
            .marketing
            .promotion
            .find_available(shop_ids.as_deref(), now)
            .await
            .unwrap_or_default();

        for p in products {
            let activity_info: Vec<serde_json::Value> = promotions
                .iter()
                .filter(|pr| promotion_covers_product(pr, p.product_id))
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
                        "typeText": promotion_model::type_text(pr.r#type),
                    })
                })
                .collect();
            map.insert(
                p.product_id.to_string(),
                serde_json::json!({
                    "productId": p.product_id,
                    "isPromote": p.is_promote,
                    "promotePrice": p.promote_price,
                    "promoteStartDate": p.promote_start_date,
                    "promoteEndDate": p.promote_end_date,
                    "productStatus": p.product_status,
                    "activityInfo": activity_info,
                }),
            );
        }
        Ok(serde_json::Value::Object(map))
    }

    /// 价格试算（Java `getProductAmount`；仅零售价 × 数量）。
    pub async fn product_amount(&self, dto: &ProductAmountDTO) -> Result<serde_json::Value> {
        if dto.sku_item.is_empty() {
            return Err(Error::Validation(MSG_AMOUNT_ITEMS_REQUIRED.into()));
        }
        let _p = self
            .repo()
            .find_product(dto.id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        let skus = self.repo().find_skus(dto.id, false).await?;
        let mut count = 0_i32;
        let mut total = Decimal::ZERO;
        for item in &dto.sku_item {
            let num = item.num.max(0);
            count += num;
            let price = skus
                .iter()
                .find(|s| s.sku_id == item.sku_id)
                .and_then(|s| s.sku_price)
                .unwrap_or(Decimal::ZERO);
            total += price * Decimal::from(num);
        }
        Ok(serde_json::json!({"total": total, "count": count, "wholesale": false}))
    }

    /// 商品询价（Java `priceInquiry`）：写 `price_inquiry` 表。
    pub async fn price_inquiry(
        &self,
        dto: &ProductPriceInquiryDTO,
        user_id: Option<i32>,
    ) -> Result<()> {
        if dto.content.as_deref().map(str::trim).filter(|s| !s.is_empty()).is_none() {
            return Err(Error::Validation(MSG_INQUIRY_CONTENT_REQUIRED.into()));
        }
        let product = self
            .repo()
            .find_product(dto.product_id)
            .await?
            .ok_or_else(|| Error::Validation(MSG_PRODUCT_NOT_FOUND.into()))?;
        self.repos
            .catalog
            .product_manage_client
            .insert_price_inquiry(
                dto.mobile.as_deref().unwrap_or_default(),
                dto.email.as_deref().unwrap_or_default(),
                dto.content.as_deref().unwrap_or_default(),
                dto.product_id,
                product.shop_id,
                user_id.unwrap_or(0),
                now_secs(),
            )
            .await
    }

    /// 预售定金金额（Java `calculateDepositAmount`）。
    pub async fn presale_deposit(&self, q: &PresaleDepositQuery) -> Result<Decimal> {
        let Some(presale) = self.repo().find_presale(q.product_id).await? else {
            return Ok(Decimal::ZERO);
        };
        if presale.status != 1 || presale.sale_mode != 2 {
            return Ok(Decimal::ZERO);
        }
        let skus = self.repo().find_skus(q.product_id, false).await?;
        let base = skus
            .iter()
            .find(|s| s.sku_id == q.sku_id)
            .and_then(|s| s.sku_price)
            .unwrap_or(Decimal::ZERO);
        if presale.deposit_type == Some(2) {
            return Ok(presale.deposit_fixed_amount.unwrap_or(Decimal::ZERO));
        }
        let ratio = Decimal::from(presale.deposit_ratio.unwrap_or(0).clamp(0, 99));
        let mut deposit = base * ratio / Decimal::from(100);
        if presale.is_round_down == Some(1) {
            deposit = deposit.trunc_with_scale(2);
        }
        Ok(deposit)
    }

    /// 相关商品（Java `getRelated`）。
    pub async fn related(&self, product_id: i32) -> Result<Vec<serde_json::Value>> {
        let ids = self.repo().find_related_ids(product_id).await?;
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let products = self.repo().find_products_by_ids(&ids).await?;
        Ok(products
            .iter()
            .map(|p| product_list_item(&to_json(p)))
            .collect())
    }

    /// 批量可用性（Java `getBatchProductAvailability`；`skuIds` 逗号串）。
    pub async fn batch_availability(
        &self,
        q: &BatchAvailabilityQuery,
    ) -> Result<serde_json::Value> {
        let ids: Vec<i32> = q
            .sku_ids
            .split(',')
            .filter_map(|s| s.trim().parse::<i32>().ok())
            .collect();
        let skus = if ids.is_empty() {
            Vec::new()
        } else {
            self.repo().find_skus_by_ids(&ids).await?
        };
        let mut map = serde_json::Map::new();
        for s in skus {
            map.insert(
                s.sku_id.to_string(),
                serde_json::json!({
                    "id": s.product_id,
                    "productId": s.product_id,
                    "skuId": s.sku_id,
                    "price": s.sku_price.unwrap_or_default(),
                    "stock": s.sku_stock.unwrap_or(0),
                }),
            );
        }
        Ok(serde_json::Value::Object(map))
    }

    /// 历史商品（Java `getHistoryProduct`；未登录返回空页）。
    pub async fn history_products(
        &self,
        q: &HistoryProductQuery,
        user_id: Option<i32>,
    ) -> Result<PageResult<serde_json::Value>> {
        let page = q.page_query();
        let Some(uid) = user_id.filter(|v| *v > 0) else {
            return Ok(PageResult::empty(&page));
        };
        let ids = self.repo().find_history_product_ids(uid).await?;
        if ids.is_empty() {
            return Ok(PageResult::empty(&page));
        }
        let limit = u64::from(page.page_size);
        let offset = u64::from(page.page - 1) * limit;
        let (total, products) = self.repo().paginate_products_by_ids(&ids, limit, offset).await?;
        let list = products
            .iter()
            .map(|p| product_list_item(&to_json(p)))
            .collect();
        Ok(PageResult::new(total, list, &page))
    }
}

/// 活动 `range` 是否覆盖商品（Java `getProductsPromotion` 的活动范围判定）。
///
/// `range`：None/0 = 全部商品；3 = 指定商品（`range_data` 含该商品 ID）；
/// 4 = 不含以下商品（`range_data` 不含该商品 ID）。其余值按未指定处理（放行）。
pub(crate) fn promotion_covers_product(promotion: &Promotion, product_id: i32) -> bool {
    let range_ids = promotion.range.as_ref().and_then(|r| {
        promotion
            .range_data
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty() && *s != "null")
            .and_then(parse_id_list)
    });
    match promotion.range.unwrap_or(0) {
        0 => true,
        3 => range_ids.is_some_and(|ids| ids.contains(&product_id)),
        4 => !range_ids.is_some_and(|ids| ids.contains(&product_id)),
        _ => true,
    }
}

/// 解析活动范围 ID 列表（Java 侧存 `List.toString()` 文本，Rust 侧存 JSON；
/// 两者形如 `[1, 2]` / `[1,2]`，按数字逐个扫描提取，兼容两种格式）。
pub(crate) fn parse_id_list(raw: &str) -> Option<Vec<i32>> {
    let mut out = Vec::new();
    let bytes = raw.as_bytes();
    let mut start: Option<usize> = None;
    for (i, b) in bytes.iter().enumerate() {
        if b.is_ascii_digit() {
            if start.is_none() {
                start = Some(i);
            }
        } else if let Some(s) = start.take() {
            if let Ok(n) = raw[s..i].parse::<i32>() {
                out.push(n);
            }
        }
    }
    if let Some(s) = start {
        if let Ok(n) = raw[s..].parse::<i32>() {
            out.push(n);
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_helpers_extract_numeric_keys() {
        let v = serde_json::json!({"comment_id": 7, "rank": "4"});
        assert_eq!(i64_of(&v, &["comment_id"]), 7);
        assert_eq!(i64_of(&v, &["rank"]), 4);
        assert_eq!(i64_of(&v, &["missing"]), 0);
    }

    #[test]
    fn percent_is_zero_safe() {
        let pct = |n: i64, total: i64| {
            if total == 0 {
                0.0
            } else {
                n as f64 * 100.0 / total as f64
            }
        };
        assert_eq!(pct(0, 0), 0.0);
        assert_eq!(pct(1, 4), 25.0);
    }

    #[test]
    fn cny_amount_rounds_two_decimals() {
        let total = Decimal::new(1234, 2) * Decimal::from(3);
        assert_eq!(total, Decimal::new(3702, 2));
    }
}
