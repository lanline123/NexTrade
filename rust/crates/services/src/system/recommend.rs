//! 推荐 域服务（system::recommend）—— wave9。
//!
//! `self.repos.system.recommend`；对应 Java `ProductService.getProductList`
//! （推荐参数）与 `getProductIds`。
//!
//! ## 偏差
//! Java 推荐策略含个性化/热度窗口/历史行为（`ProductService` 内部），本实现
//! 按「精品优先 → 点击量 → 新品」的静态排序返回；`getProductIds` 返回同口径
//! 商品 ID 逗号串。

use std::collections::HashSet;
use std::sync::Arc;

use tigshop_core::models::system::recommend::{
    GuessLikeQuery, RecommendProductVO, BEST_ID_COUNT, DEFAULT_ID_COUNT, HISTORY_ID_COUNT,
    HOT_ID_COUNT,
};
use tigshop_core::Result;
use tigshop_infrastructure::db::repo::system::recommend::RecommendRepository;
use tigshop_infrastructure::db::Repositories;

/// 推荐 域服务。
pub struct RecommendService {
    repos: Arc<Repositories>,
}

impl RecommendService {
    /// 构造服务。
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本 feature 仓储。
    #[must_use]
    pub fn repo(&self) -> &RecommendRepository {
        &self.repos.system.recommend
    }

    /// 猜你喜欢（Java `RecommendController.getProductList`）。
    ///
    /// 原版前端按数组直接 `.filter()`，Java 返回 `List`，这里不包 `PageResult`。
    pub async fn guess_like(&self, q: &GuessLikeQuery) -> Result<Vec<RecommendProductVO>> {
        let (_total, rows) = self.repo().guess_like(q).await?;
        Ok(rows
            .into_iter()
            .map(|r| RecommendProductVO {
                product_id: r.product_id,
                product_name: r.product_name,
                product_sn: r.product_sn,
                product_price: r.product_price,
                pic_url: r.pic_url,
                pic_thumb: r.pic_thumb,
                shop_id: r.shop_id,
                product_type: r.product_type,
                product_stock: r.product_stock.unwrap_or(0),
                virtual_sales: r.virtual_sales.unwrap_or(0),
            })
            .collect())
    }

    /// 推荐商品 ID 串（Java `RecommendController.getProductIds`，逗号分隔）。
    ///
    /// 复刻 Java `ProductServiceImpl.getRecommendedProductIds` 的分段策略：
    /// 精品（最多 10）→ 热销（最多 10）→ 会员浏览记录（最多 20）→ 热门兜底补足，
    /// 最终截断到 [`DEFAULT_ID_COUNT`]（40）个。
    ///
    /// 与原版的两处偏差，都是本站数据现状所迫：
    /// - 原版第 4 段只从 `is_hot = 1` 补全。本站精品 12 个 / 热销 4 个（其中 3 个同时是精品），
    ///   前两段跑完热销池已被抽空，严格照搬补不出量 —— 结果只有 11 个，反而少于改造前的 20 个。
    ///   故放宽为按点击量取在售商品。
    /// - 原版用 `ORDER BY RAND()`，这里保持确定性排序：结果稳定、可缓存，
    ///   也避免每次刷新顺序乱跳。
    ///
    /// `user_id` 传 `0` 表示游客（与 Java `SecurityUtils.getCurrentUserId()` 同口径），
    /// 游客跳过浏览记录段。
    pub async fn product_ids(&self, user_id: i32) -> Result<String> {
        let target = DEFAULT_ID_COUNT as usize;
        let mut out: Vec<i32> = Vec::with_capacity(target);
        let mut seen: HashSet<i32> = HashSet::with_capacity(target);

        // 1 + 2. 精品段 + 热销段（合成一次查询，`is_best DESC` 保证精品在前）
        let segment = BEST_ID_COUNT.saturating_add(HOT_ID_COUNT);
        for id in self.repo().best_hot_ids(segment).await? {
            if seen.insert(id) {
                out.push(id);
            }
        }

        // 3. 会员浏览记录段（游客跳过）
        if user_id > 0 && out.len() < target {
            for id in self.repo().history_ids(user_id, HISTORY_ID_COUNT).await? {
                if seen.insert(id) {
                    out.push(id);
                }
            }
        }

        // 4. 不足则按热门补足
        if out.len() < target {
            for id in self.repo().popular_ids(DEFAULT_ID_COUNT.saturating_mul(2)).await? {
                if out.len() >= target {
                    break;
                }
                if seen.insert(id) {
                    out.push(id);
                }
            }
        }

        out.truncate(target);
        Ok(out.iter().map(i32::to_string).collect::<Vec<_>>().join(","))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_join_is_comma_separated() {
        let ids: Vec<i32> = vec![3, 1, 2];
        let s = ids.iter().map(i32::to_string).collect::<Vec<_>>().join(",");
        assert_eq!(s, "3,1,2");
    }

    #[test]
    fn empty_ids_yield_empty_string() {
        let ids: Vec<i32> = Vec::new();
        let s = ids.iter().map(i32::to_string).collect::<Vec<_>>().join(",");
        assert_eq!(s, "");
    }

    #[test]
    fn default_count_positive() {
        assert!(DEFAULT_ID_COUNT > 0);
    }
}
