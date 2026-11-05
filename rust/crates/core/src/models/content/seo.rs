//! SEO 域（content::seo）DTO / VO 与纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.vo.seo.SeoProductVO` → [`SeoProductVO`]
//! - `com.tigshop.bean.vo.seo.SeoCategoryVO` → [`SeoCategoryVO`]
//! - `com.tigshop.bean.vo.seo.SeoArticleVO` → [`SeoArticleVO`]
//! - `com.tigshop.bean.vo.seo.SeoBrandVO` → [`SeoBrandVO`]
//! - `com.tigshop.common.utils.SeoIdentificationUtil#extractSeoIdentificationFromLink`
//!   → [`extract_seo_identification_from_link`]
//! - `com.tigshop.common.utils.SeoIdentificationUtil#formatEnglishText`
//!   → [`format_english_text`]
//! - `com.tigshop.common.utils.StrUtil#isNotBlank`（hutool）→ [`non_blank`]
//! - `SeoServiceImpl#getSitemapArticles` 里的时间戳换算 → [`article_last_update_millis`]
//!
//! JSON 字段名保持 camelCase（与原接口逐字符一致，`#[serde(rename_all = "camelCase")]`）。
//! 本域 **完全不涉及金额字段**，故无 `rust_decimal::Decimal`。
//!
//! 出参包装：原 Java 控制器的 `String` / `List<VO>` / `Integer` 返回值都会经
//! `GlobalResponseAdvice` 包成 `AjaxResult`（`String` 分支走
//! `JSON.toJSONString(AjaxResult.success(body))`），因此 Rust 侧统一用
//! `ok(...)` 返回 `ApiResult<T>`。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 分类 SEO 链接前缀（Java `SeoIdentificationUtil` 中硬编码的 `"/category/"`）。
pub const CATEGORY_LINK_PREFIX: &str = "/category/";

/// 「秒级 / 毫秒级时间戳」分界（Java `getSitemapArticles` 中的字面量
/// `10000000000L`）。
pub const MILLIS_THRESHOLD: i64 = 10_000_000_000;

// ——————————————————————————————————————————————
// 出参 VO（`com.tigshop.bean.vo.seo.*`）
// ——————————————————————————————————————————————

/// SEO 站点地图-商品，对应 Java `SeoProductVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoProductVO {
    /// 商品编号（`product.product_sn`）
    pub product_sn: String,
    /// 商品名称（`product.product_name`）
    pub product_name: String,
    /// SEO 友好链接；`seo_identification` 为空白时为 `null`
    pub seo_link: Option<String>,
    /// 最后更新时间戳（Java 原样回传 `product.last_update`，**未做秒→毫秒换算**）
    pub last_update: Option<i64>,
    /// 商品主图 URL（`product.pic_url`）
    pub pic_url: String,
}

/// SEO 站点地图-分类，对应 Java `SeoCategoryVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoCategoryVO {
    /// 分类 ID（Java 侧为**字符串**：`String.valueOf(categoryId)`）
    pub id: String,
    /// 分类名称
    pub category_name: String,
    /// SEO 友好链接；空白时为 `null`
    pub seo_link: Option<String>,
    /// Java 固定写 `null`（分类表无更新时间列）
    pub last_update: Option<i64>,
}

/// SEO 站点地图-文章，对应 Java `SeoArticleVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoArticleVO {
    /// 文章 ID（Java 侧为**字符串**：`String.valueOf(articleId)`）
    pub id: String,
    /// 文章标题
    pub article_title: String,
    /// 最后更新时间戳（毫秒）：`add_time`（秒）经 [`article_last_update_millis`] 换算
    pub last_update: Option<i64>,
}

/// SEO 站点地图-品牌，对应 Java `SeoBrandVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoBrandVO {
    /// 品牌 ID（Java 侧为**字符串**：`String.valueOf(brandId)`）
    pub id: String,
    /// 品牌名称
    pub brand_name: String,
    /// Java 固定写 `null`（品牌无 seo_identification 列）
    pub seo_link: Option<String>,
    /// Java 固定写 `null`
    pub last_update: Option<i64>,
}

// ——————————————————————————————————————————————
// 入参查询 DTO
// ——————————————————————————————————————————————

/// `GET /api/sys/seo/getCategoryIdBySeoLink?seoLink=` 的查询参数
/// （Java `@RequestParam(value = "seoLink") String seoLink`）。
///
/// 字段声明为 `Option`：Java 侧缺参由 `MissingServletRequestParameterException`
/// 兜底，本实现交给服务层给出同码业务错误 1001（文案对齐
/// `SeoIdentificationUtil` 的「SEO链接不能为空」）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeoLinkQuery {
    /// 商品分类 SEO 链接（如 `/category/phones` 或 `phones`）
    pub seo_link: Option<String>,
}

/// `GET /adminapi/setting/seo/translateToSeoIdentification?chineseText=` 的查询参数
/// （Java `@RequestParam(value = "chineseText") String chineseText`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateSeoQuery {
    /// 待翻译的中文文本
    pub chinese_text: Option<String>,
}

// ——————————————————————————————————————————————
// 纯函数（可单测）
// ——————————————————————————————————————————————

/// 从 SEO 链接中提取 `seoIdentification`。
///
/// 对应 Java `SeoIdentificationUtil#extractSeoIdentificationFromLink`：
/// 1. `null` / 空串 → `GlobalException("SEO链接不能为空")`（本函数返回 `None`，
///    由调用方转成业务错误 1001）；
/// 2. 以 `"/category/"` 开头 → 去掉该前缀（仅去一次，`startsWith` 语义）；
/// 3. 按 `"/"` 分割，取**最后一段**（`String.split` 会丢弃尾部空串）。
///
/// ⚠️ 与 Java 的差异（**不伪造业务规则**，只把 500 变成可解释的业务错误）：
/// 对「去前缀后不含任何非空段」的输入（如 `"/"`、`"///"`），Java 的
/// `split("/")` 返回空数组，`parts[parts.length - 1]` 抛
/// `ArrayIndexOutOfBoundsException`（HTTP 500）；本实现返回空串，
/// 最终由 `seo_identification = ''` 查询未命中给出 1001
/// 「未找到对应的商品分类」。
#[must_use]
pub fn extract_seo_identification_from_link(seo_link: Option<&str>) -> Option<String> {
    let link = seo_link?;
    if link.is_empty() {
        return None;
    }
    let stripped = link.strip_prefix(CATEGORY_LINK_PREFIX).unwrap_or(link);
    // Java `split("/")` 丢弃尾部空串后取最后一项
    // ⟺ 取「最后一个非空段」（全为空段时 Java 抛异常，这里退化为空串）。
    let last = stripped.split('/').rev().find(|seg| !seg.is_empty());
    Some(last.unwrap_or("").to_string())
}

/// Java `\s`（**未开启** `UNICODE_CHARACTER_CLASS`）的等价判定：
/// `[ \t\n\x0B\f\r]`。注意不包含 U+00A0 等 Unicode 空白
/// （Rust 的 `char::is_whitespace` 会包含，直接用会产生多余中划线）。
const fn is_java_whitespace(ch: char) -> bool {
    matches!(ch, ' ' | '\t' | '\n' | '\u{000B}' | '\u{000C}' | '\r')
}

/// 格式化英文文本为 SEO 标识。
///
/// 对应 Java `SeoIdentificationUtil#formatEnglishText`：
/// 1. 转小写（`toLowerCase`）；
/// 2. `replaceAll("\\s+", "-")`：每段**连续空白**替换为**一个**中划线；
/// 3. `replaceAll("[^a-z0-9-]", "")`：删除所有非「小写字母 / 数字 / 中划线」的字符。
///
/// 空串 / `null`（Rust 侧 `""`）→ 空串（Java 显式返回 `""`）。
///
/// ⚠️ 与 Java 的细微差异：Java `String.toLowerCase()` 使用**默认 Locale**
/// （土耳其语等 Locale 下 `I` → `ı`），本实现使用 `str::to_lowercase()` 的
/// Unicode 默认映射。中文/英文数据下两者一致。
///
/// 注：本函数是 Java 批量更新链路（`generateAndUpdateCategorySeoIdentification` /
/// `generateAndUpdateProductSeoIdentification`）与 `translateToSeoIdentification`
/// 的格式化步骤；这两条链路因翻译服务未迁移而暂不可用（见服务层），
/// 此处按原文逐字符移植，待翻译服务迁移后可直接复用。
#[must_use]
pub fn format_english_text(english_text: &str) -> String {
    if english_text.is_empty() {
        return String::new();
    }
    let mut out = String::with_capacity(english_text.len());
    let mut pending_dash = false;
    for ch in english_text.to_lowercase().chars() {
        if is_java_whitespace(ch) {
            pending_dash = true;
            continue;
        }
        if pending_dash {
            out.push('-');
            pending_dash = false;
        }
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' {
            out.push(ch);
        }
    }
    // 尾部空白产生的挂起中划线同样会被 Java 的 replaceAll 写入（"a " → "a-"），保留
    if pending_dash {
        out.push('-');
    }
    out
}

/// hutool `StrUtil.isNotBlank` 的等价实现：
/// `null` / 空串 / 全空白（`Character.isWhitespace` 口径）→ `None`，
/// 否则返回**原字符串**（不做 trim，与 Java 一致）。
///
/// 用于 `SeoProductVO.seoLink` / `SeoCategoryVO.seoLink`：
/// Java 写的是 `StrUtil.isNotBlank(x) ? x : null`。
#[must_use]
pub fn non_blank(value: Option<&str>) -> Option<String> {
    let v = value?;
    if v.trim().is_empty() {
        None
    } else {
        Some(v.to_string())
    }
}

/// `getSitemapArticles` 的 `lastUpdate` 换算，对应 Java：
///
/// ```text
/// Long lastUpdate = null;
/// if (a.getAddTime() != null && a.getAddTime() > 0) {
///     lastUpdate = a.getAddTime() < 10000000000L ? a.getAddTime() * 1000 : a.getAddTime();
/// }
/// ```
///
/// ⚠️ `article.add_time` 在权威 schema 中是 `int unsigned`（Rust 实体 `i32`），
/// 取值范围恒 `< 10_000_000_000`，因此 `else` 分支在现有表结构下不可达
/// —— 这里仍按 Java 逐字保留，避免表结构变更（改 `bigint` 存毫秒）后行为漂移。
#[must_use]
pub fn article_last_update_millis(add_time: i32) -> Option<i64> {
    if add_time <= 0 {
        return None;
    }
    let v = i64::from(add_time);
    Some(if v < MILLIS_THRESHOLD { v * 1000 } else { v })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ————— 链接解析 —————

    #[test]
    fn extract_link_handles_prefix_and_segments() {
        // 无前缀：整体即标识
        assert_eq!(
            extract_seo_identification_from_link(Some("phones")),
            Some("phones".into())
        );
        // 标准 /category/ 前缀
        assert_eq!(
            extract_seo_identification_from_link(Some("/category/phones")),
            Some("phones".into())
        );
        // 多级路径取最后一段
        assert_eq!(
            extract_seo_identification_from_link(Some("/category/a/b/c")),
            Some("c".into())
        );
        // 仅剥一次前缀（Java startsWith + substring）
        assert_eq!(
            extract_seo_identification_from_link(Some("/category/category/x")),
            Some("x".into())
        );
        // 尾部斜杠：Java split 丢弃尾部空串
        assert_eq!(
            extract_seo_identification_from_link(Some("/category/phones/")),
            Some("phones".into())
        );
        // 中间空段：取最后一个非空段
        assert_eq!(
            extract_seo_identification_from_link(Some("a//b")),
            Some("b".into())
        );
        // 首部斜杠保留（非 /category/ 前缀）
        assert_eq!(
            extract_seo_identification_from_link(Some("/phones")),
            Some("phones".into())
        );
    }

    #[test]
    fn extract_link_reports_empty_input_as_missing() {
        // Java：null / "" → GlobalException("SEO链接不能为空")
        assert_eq!(extract_seo_identification_from_link(None), None);
        assert_eq!(extract_seo_identification_from_link(Some("")), None);
    }

    #[test]
    fn extract_link_degenerate_slashes_degrade_to_empty() {
        // Java 此处抛 ArrayIndexOutOfBoundsException（500）；本实现返回空串，
        // 由查询未命中介入 1001（见函数文档）
        assert_eq!(
            extract_seo_identification_from_link(Some("/")),
            Some(String::new())
        );
        assert_eq!(
            extract_seo_identification_from_link(Some("///")),
            Some(String::new())
        );
    }

    // ————— 英文格式化 —————

    #[test]
    fn format_english_text_follows_java_pipeline() {
        assert_eq!(format_english_text("Hello World"), "hello-world");
        // 连续空白 → 单个中划线
        assert_eq!(format_english_text("Hello   World"), "hello-world");
        // 制表符 / 换行同属 Java \s
        assert_eq!(format_english_text("A\tB\nC"), "a-b-c");
        // 特殊字符被删除，字母数字与中划线保留
        assert_eq!(format_english_text("Sony WH-1000XM4!"), "sony-wh-1000xm4");
        assert_eq!(
            format_english_text("iPhone 15 Pro (2024)"),
            "iphone-15-pro-2024"
        );
        // 中文字符非 [a-z0-9-] → 全部删除
        assert_eq!(format_english_text("手机"), "");
        // 已经是小写 / 空串
        assert_eq!(format_english_text("abc-123"), "abc-123");
        assert_eq!(format_english_text(""), "");
        // 数字保留（含 Unicode 数字会被删除，与 Java [0-9] 口径一致）
        assert_eq!(format_english_text("5"), "5");
        assert_eq!(format_english_text("٣"), "");
        // U+00A0 不是 Java 的 \s：不会产生中划线，直接删除
        assert_eq!(format_english_text("a\u{00A0}b"), "ab");
        // 尾部空白：Java replaceAll 先写中划线，再被保留（"a " → "a-"）
        assert_eq!(format_english_text("a "), "a-");
    }

    // ————— 空白判定 —————

    #[test]
    fn non_blank_matches_hutool_is_not_blank() {
        assert_eq!(non_blank(None), None);
        assert_eq!(non_blank(Some("")), None);
        assert_eq!(non_blank(Some("   ")), None);
        assert_eq!(non_blank(Some("\t\n")), None);
        // 非空白：原样返回，不 trim
        assert_eq!(non_blank(Some(" phones ")), Some(" phones ".into()));
        assert_eq!(non_blank(Some("x")), Some("x".into()));
    }

    // ————— 文章时间戳 —————

    #[test]
    fn article_last_update_seconds_are_converted_to_millis() {
        assert_eq!(article_last_update_millis(0), None);
        assert_eq!(article_last_update_millis(-1), None);
        assert_eq!(
            article_last_update_millis(1_700_000_000),
            Some(1_700_000_000_000)
        );
        // i32 上限仍小于 10^10 → 恒走秒→毫秒分支
        assert_eq!(
            article_last_update_millis(i32::MAX),
            Some(i64::from(i32::MAX) * 1000)
        );
    }

    // ————— 出参 JSON 形状 —————

    #[test]
    fn vo_serializes_camel_case_and_keeps_nulls() {
        let product = SeoProductVO {
            product_sn: "SN1".into(),
            product_name: "手机".into(),
            seo_link: None,
            last_update: Some(1_700_000_000),
            pic_url: "p.png".into(),
        };
        let v = serde_json::to_value(&product).unwrap();
        assert_eq!(v["productSn"], json!("SN1"));
        assert_eq!(v["productName"], json!("手机"));
        assert_eq!(v["seoLink"], serde_json::Value::Null);
        assert_eq!(v["lastUpdate"], json!(1700000000));
        assert_eq!(v["picUrl"], json!("p.png"));

        let category = SeoCategoryVO {
            id: "3".into(),
            category_name: "分类".into(),
            seo_link: Some("phones".into()),
            last_update: None,
        };
        let v = serde_json::to_value(&category).unwrap();
        assert_eq!(v["id"], json!("3")); // Java 侧 id 为字符串
        assert_eq!(v["categoryName"], json!("分类"));
        assert_eq!(v["seoLink"], json!("phones"));
        assert_eq!(v["lastUpdate"], serde_json::Value::Null);

        let article = SeoArticleVO {
            id: "7".into(),
            article_title: "标题".into(),
            last_update: Some(1_700_000_000_000),
        };
        let v = serde_json::to_value(&article).unwrap();
        assert_eq!(v["articleTitle"], json!("标题"));
        assert_eq!(v["lastUpdate"], json!(1700000000000i64));

        let brand = SeoBrandVO {
            id: "9".into(),
            brand_name: "品牌".into(),
            seo_link: None,
            last_update: None,
        };
        let v = serde_json::to_value(&brand).unwrap();
        assert_eq!(v["brandName"], json!("品牌"));
        assert_eq!(v["seoLink"], serde_json::Value::Null);
    }

    // ————— 查询参数绑定（camelCase） —————

    #[test]
    fn query_dtos_bind_camel_case_names() {
        // `Query<T>` 走 serde，rename_all = camelCase 决定字段名
        let q: SeoLinkQuery = serde_json::from_value(json!({ "seoLink": "/category/x" })).unwrap();
        assert_eq!(q.seo_link.as_deref(), Some("/category/x"));
        let q: SeoLinkQuery = serde_json::from_value(json!({})).unwrap();
        assert_eq!(q.seo_link, None);

        let q: TranslateSeoQuery =
            serde_json::from_value(json!({ "chineseText": "手机" })).unwrap();
        assert_eq!(q.chinese_text.as_deref(), Some("手机"));
        let q: TranslateSeoQuery = serde_json::from_value(json!({})).unwrap();
        assert_eq!(q.chinese_text, None);
    }
}
