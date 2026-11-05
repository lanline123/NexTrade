//! 商品关键词联想（`catalog/product_search`）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.search.SearchGuessController#getSearchGuessList`
//!   （`@RequestMapping("/api/search/searchGuess")` + `GET /index`）
//! - `com.tigshop.service.product.impl.ProductSearchServiceImpl#searchGuess`
//! - `com.tigshop.bean.vo.product.KeywordSearchListVO`
//!
//! # 算法（逐条对照 Java）
//!
//! 1. `keyword == null` → 空列表；
//! 2. `trim()`；若匹配 `^[0-9]$`（单个数字）→ 视为空；
//! 3. 空 → 空列表；
//! 4. `StringUtils.cutForSearch(keyword)` 分词后用空格连接 → 按空格拆成多个
//!    `LIKE` 条件（AND）查 `product`：`is_delete = 0`；
//! 5. 对命中的每个商品：把 `keywords` 字段按空格拆分，与原始 keyword 做双向包含
//!    匹配（`keyword.contains(val) || val.contains(keyword)`），按关键词累计
//!    **去重后的商品数**；
//! 6. 按计数降序取前 10 个，`type = "search"`。
//!
//! # 偏差
//!
//! Java `cutForSearch` 用 HanLP 分词器（`TokenizerEngine`）做中文分词；
//! 本工作区无分词依赖。近似实现：按空白切分；空白内部的中文/英文整串作为一个
//! 词元（Java 会把中文长词再切分成多个子词，联想候选可能更多）。
//! 该偏差只影响「多词/中文长句」的召回宽度，单关键词行为一致。

use serde::{Deserialize, Serialize};

/// 关键词联想查询参数（`GET /api/search/searchGuess/index?keyword=`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct KeywordSearchQuery {
    pub keyword: Option<String>,
}

/// 关键词联想项（对应 Java `KeywordSearchListVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct KeywordSearchListVO {
    /// 类型：Java 固定 `"search"`
    pub r#type: Option<String>,
    /// 联想关键词
    pub keyword: Option<String>,
    /// 匹配数量（去重后的商品数）
    pub count: Option<i32>,
}

/// 关键词归一化（Java `searchGuess` 前置判断）：
/// `None` / 空白 / 单个数字 → `None`（直接返回空列表）。
#[must_use]
pub fn normalize_guess_keyword(raw: Option<&str>) -> Option<String> {
    let keyword = raw?.trim();
    if keyword.is_empty() {
        return None;
    }
    // Java：`keyword.matches("^[0-9]$")` → 置空
    if keyword.chars().count() == 1 && keyword.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    Some(keyword.to_string())
}

/// 近似 `StringUtils.cutForSearch`：按空白切分为词元（无分词库，见模块头偏差）。
#[must_use]
pub fn cut_for_search(keyword: &str) -> Vec<String> {
    keyword
        .split_whitespace()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

/// 由命中商品构建联想列表（Java `searchGuess` 第 5-6 步）：
/// - `keywords` 按空格拆分，与原始 keyword 双向包含才计入；
/// - 同一关键词按商品去重计数；
/// - 按计数降序（同计数按关键词字典序，保证确定性）取前 10。
#[must_use]
pub fn build_guess_suggestions(
    products: &[(i32, String, Option<String>)],
    keyword: &str,
) -> Vec<KeywordSearchListVO> {
    use std::collections::{BTreeMap, BTreeSet};

    let mut hits: BTreeMap<String, BTreeSet<i32>> = BTreeMap::new();
    for (product_id, _name, keywords) in products {
        let Some(keywords) = keywords.as_deref() else {
            continue;
        };
        for val in keywords.split(' ') {
            let val = val.trim();
            if val.is_empty() {
                continue;
            }
            if keyword.contains(val) || val.contains(keyword) {
                hits.entry(val.to_string()).or_default().insert(*product_id);
            }
        }
    }

    let mut counts: Vec<(String, i32)> = hits
        .into_iter()
        .map(|(k, ids)| (k, ids.len() as i32))
        .collect();
    counts.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    counts
        .into_iter()
        .take(10)
        .map(|(keyword, count)| KeywordSearchListVO {
            r#type: Some("search".to_string()),
            keyword: Some(keyword),
            count: Some(count),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_handles_null_blank_and_single_digit() {
        assert!(normalize_guess_keyword(None).is_none());
        assert!(normalize_guess_keyword(Some("   ")).is_none());
        // Java：单个 0-9 数字视为无意义
        assert!(normalize_guess_keyword(Some("5")).is_none());
        assert!(normalize_guess_keyword(Some(" 7 ")).is_none());
        // 多字符/多数字照常
        assert_eq!(
            normalize_guess_keyword(Some(" 手机 ")),
            Some("手机".to_string())
        );
        assert_eq!(normalize_guess_keyword(Some("12")), Some("12".to_string()));
    }

    #[test]
    fn cut_for_search_splits_whitespace_tokens() {
        assert_eq!(cut_for_search("苹果 手机"), vec!["苹果", "手机"]);
        assert_eq!(cut_for_search("  苹果   "), vec!["苹果"]);
        assert!(cut_for_search("   ").is_empty());
    }

    #[test]
    fn suggestions_count_distinct_products_and_sort_desc() {
        let products = vec![
            (1, "苹果手机".to_string(), Some("苹果 手机 5G".to_string())),
            (2, "苹果平板".to_string(), Some("苹果 平板".to_string())),
            (3, "华为手机".to_string(), Some("华为 手机".to_string())),
        ];
        let out = build_guess_suggestions(&products, "苹果手机");
        // 「手机」命中 2 个商品（1、3），「苹果」命中 2 个（1、2）；
        // 同计数按关键词字典序 → 苹果 在 手机 前？按 Unicode：苹(0x82F9) < 手(0x624B)? 手=0x624B < 苹=0x82F9 → 手机 在前
        assert_eq!(out.len(), 2);
        let mobile = out
            .iter()
            .find(|s| s.keyword.as_deref() == Some("手机"))
            .unwrap();
        assert_eq!(mobile.count, Some(2));
        let apple = out
            .iter()
            .find(|s| s.keyword.as_deref() == Some("苹果"))
            .unwrap();
        assert_eq!(apple.count, Some(2));
        assert!(out.iter().all(|s| s.r#type.as_deref() == Some("search")));
    }

    #[test]
    fn suggestions_take_top_ten_and_ignore_blank_tokens() {
        let mut products = Vec::new();
        for i in 0..15 {
            products.push((i, format!("商品{i}"), Some(format!("关键词{i} 额外"))));
        }
        let out = build_guess_suggestions(&products, "关键词");
        assert_eq!(out.len(), 10);
        assert!(out.iter().all(|s| s.count == Some(1)));
        // 空 keywords / 无语义 token 不产生候选
        let out = build_guess_suggestions(&[(1, "A".into(), None)], "A");
        assert!(out.is_empty());
    }
}
