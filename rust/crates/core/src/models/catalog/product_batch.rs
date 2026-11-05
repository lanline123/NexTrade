//! 商品批量导入/导出（`catalog/product_batch`）DTO / 导出 Excel 行 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.product.ProductBatchDealDTO`（导出查询条件）
//! - `com.tigshop.bean.vo.product.ProductImportExcelVO`（导出行，列与导入模板一致）
//! - `com.tigshop.bean.dto.product.ServicesDTO`（`productService/list` 返回行）
//!
//! 本 feature 只覆盖 `ProductBatchController` 剩余 2 条接口：
//! `GET /adminapi/product/productBatch/productBatchDeal`（导出）与
//! `GET /adminapi/product/productBatch/productService/list`（商品服务下拉）。
//! 同控制器的 `downloadTemplate` / `productBatchModify` / `productBatchEdit`
//! 已由 `catalog/product_manage` 实现，不重复注册。
//!
//! # 与 Java 的偏差（重要）
//!
//! 1. **不输出 xlsx 二进制**：Java 用 `@ResponseExcel`（EasyExcel）把
//!    `List<ProductImportExcelVO>` 写为 xlsx。本工作区 `tigshop-services`
//!    未声明 xlsx 写出依赖（`calamine` 只是读），且本切片不得修改 Cargo.toml。
//!    因此 `productBatchDeal` 返回**同样的行数据 JSON**（保留全部列名语义），
//!    由前端/运维侧导出；这与 `catalog/stock_warning` 的 `export` 处置一致。
//! 2. **导入模板下载**已由 `catalog/product_manage` 以静态模板文件实现，
//!    本 feature 不重复实现。
//! 3. `translatePackage` 翻译未迁移，导出文案取库中原值。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// `BasePage` 默认分页大小（Java `BasePage.getSize()`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// `BasePage` 分页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 导出查询条件（对应 Java `ProductBatchDealDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductBatchDealQuery {
    /// 数据类型：1 分类，2 品牌，3 商品，4 不包含商品
    pub deal_range: Option<i32>,
    /// 导出类型（Java 未使用，仅透传）
    pub deal_type: Option<i32>,
    /// 数据主键串（逗号分隔）
    pub range_ids: Option<String>,
}

impl ProductBatchDealQuery {
    /// 解析 `rangeIds`（Java `StrUtil.isBlank ? List.of() : split(",").map(Integer::valueOf)`）。
    #[must_use]
    pub fn parsed_range_ids(&self) -> Vec<i32> {
        parse_range_ids(self.range_ids.as_deref())
    }
}

/// 商品服务分页查询（对应 Java `BasePage`；`ServicesServiceImpl#list` 支持
/// `keyword` 模糊匹配服务名与 `sortField`/`sortOrder`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductServiceListQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 服务名关键词（Java `basePage.keyword` → `like product_service_name`）
    pub keyword: Option<String>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl ProductServiceListQuery {
    /// 转成工作区统一分页类型（`BasePage`：缺省 15、上限 100）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .page_size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }
}

/// 商品服务行（对应 Java `ServicesDTO` / `product_services` 表）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductServiceDTO {
    pub product_service_id: Option<i32>,
    pub product_service_name: Option<String>,
    pub product_service_desc: Option<String>,
    pub ico_img: Option<String>,
    pub sort_order: Option<i32>,
    pub default_on: Option<i32>,
    pub shop_id: Option<i32>,
}

/// 商品导出/导入 Excel 行（对应 Java `ProductImportExcelVO`，19 列 + 2 个隐藏列）。
///
/// Java 里列值全部为 `String`（数字/金额先 `toString`/`toPlainString`），
/// 本实现保持一致，方便前端按列顺序导出。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportExcelVO {
    /// 商品编码
    pub product_sn: String,
    /// 商品名称
    pub product_name: String,
    /// 商品图片
    pub pic_url: String,
    /// 商品分类（`父/子` 路径）
    pub category_name: String,
    /// 配送方式（快递发货；同城配送；到店自提）
    pub shipping_type: String,
    /// 快递运费模板
    pub shipping_tpl: String,
    /// 是否上架（默认1）
    pub product_status: String,
    /// 商品规格（多规格为 `规格:值；规格:值`）
    pub spec_name: String,
    /// 商品规格图
    pub spec_pic_url: String,
    /// 规格编码
    pub sku_sn: String,
    /// 规格条码
    pub sku_tsn: String,
    /// 商品详情图（`;` 分隔）
    pub desc_pic_url: String,
    /// 商品售价
    pub product_price: String,
    /// 库存
    pub product_stock: String,
    /// 市场价
    pub market_price: String,
    /// 商品条码
    pub product_tsn: String,
    /// 搜索关键词
    pub keywords: String,
    /// 商品描述
    pub product_brief: String,
    /// 成本价
    pub cost_price: String,
    /// 分类 ID（`@ExcelIgnore`）
    pub category_id: Option<i32>,
    /// 店铺 ID（`@ExcelIgnore`）
    pub shop_id: Option<i32>,
}

/// 解析 `rangeIds`：空白 → 空列表；非数字项忽略（Java 会抛异常，这里更宽容）。
#[must_use]
pub fn parse_range_ids(raw: Option<&str>) -> Vec<i32> {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.split(',')
                .filter_map(|v| v.trim().parse::<i32>().ok())
                .collect()
        })
        .unwrap_or_default()
}

/// 构建分类路径 `父/子/孙`（对应 Java `buildCategoryPath`：取 `category_name`，
/// 由叶子向上回溯，最多 24 层防环）。
#[must_use]
pub fn build_category_path(leaf_id: Option<i32>, cats: &[(i32, i32, String)]) -> String {
    let Some(mut cur) = leaf_id.filter(|v| *v > 0) else {
        return String::new();
    };
    let mut names: Vec<String> = Vec::new();
    let mut guard = 0;
    while cur > 0 && guard < 24 {
        guard += 1;
        let Some((_, parent_id, name)) = cats.iter().find(|(id, _, _)| *id == cur) else {
            break;
        };
        names.push(name.clone());
        if *parent_id <= 0 {
            break;
        }
        cur = *parent_id;
    }
    names.reverse();
    names.join("/")
}

/// 配送方式文案（对应 Java `buildShippingTypeText`）：
/// `快递发货` / `同城配送` / `到店自提`，用全角分号拼接。
#[must_use]
pub fn build_shipping_type_text(
    is_logistics: i32,
    is_shop_delivery: i32,
    is_shop_pickup: i32,
) -> String {
    let mut parts: Vec<&str> = Vec::new();
    if is_logistics == 1 {
        parts.push("快递发货");
    }
    if is_shop_delivery == 1 {
        parts.push("同城配送");
    }
    if is_shop_pickup == 1 {
        parts.push("到店自提");
    }
    parts.join("；")
}

/// 运费模板文案（对应 Java `buildShippingTplText`）：
/// - `fixed_shipping_type == 1` → 固定运费金额（无则 "0"）
/// - `fixed_shipping_type == 2` 且有运费模板 → `【运费模板】{shipping_tpl_id}`
/// - 固定运费 > 0 且无模板 → 金额
/// - 否则空串
#[must_use]
pub fn build_shipping_tpl_text(
    fixed_shipping_type: Option<i32>,
    fixed_shipping_fee: Option<Decimal>,
    shipping_tpl_id: i32,
) -> String {
    if fixed_shipping_type == Some(1) {
        return fixed_shipping_fee
            .map(|f| f.normalize().to_string())
            .unwrap_or_else(|| "0".to_string());
    }
    if fixed_shipping_type == Some(2) && shipping_tpl_id > 0 {
        return format!("【运费模板】{shipping_tpl_id}");
    }
    if let Some(fee) = fixed_shipping_fee.filter(|f| *f > Decimal::ZERO) {
        if shipping_tpl_id <= 0 {
            return fee.normalize().to_string();
        }
    }
    String::new()
}

/// 商品详情 HTML → 图片 URL 串（对应 Java `ProductImportExcelVO#buildDescPicUrlText`：
/// 按 `<div data-division=1></div>` 分段，取 `desc-pic-item` 段的第一个 `<img src>`，
/// 用 `;` 拼接；文本/视频段忽略）。
#[must_use]
pub fn build_desc_pic_url_text(product_desc: Option<&str>) -> String {
    let Some(html) = product_desc.filter(|s| !s.trim().is_empty()) else {
        return String::new();
    };
    html.split("<div data-division=1></div>")
        .filter(|seg| seg.contains("desc-pic-item"))
        .filter_map(extract_img_src)
        .collect::<Vec<_>>()
        .join(";")
}

/// 从 HTML 片段提取第一个 `<img src="...">` 地址（Java 正则
/// `<img.*?src=["'](.*?)["'].*?>`；不引入 regex 依赖，用朴素扫描实现）。
fn extract_img_src(segment: &str) -> Option<String> {
    let lower = segment.to_ascii_lowercase();
    let img_at = lower.find("<img")?;
    let rest = &segment[img_at..];
    let lower_rest = &lower[img_at..];
    let src_at = lower_rest.find("src")?;
    let after = &rest[src_at + 3..];
    let after_trimmed = after.trim_start();
    let after_trimmed = after_trimmed.strip_prefix('=')?.trim_start();
    let quote = after_trimmed.chars().next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let body = &after_trimmed[1..];
    let end = body.find(quote)?;
    Some(body[..end].to_string())
}

/// 规格值落库串 → 导入模板串（对应 Java `SpecImportUtils.toImportSpecText`：
/// `|` 替换为全角 `；`）。
#[must_use]
pub fn to_import_spec_text(sku_value: Option<&str>) -> String {
    sku_value.unwrap_or_default().replace('|', "；")
}

/// 规格串 → 规格对（对应 Java `SpecImportUtils.parseSpecPairs` 的分隔符集合
/// `; ； , ，`，每组 `名称:值`）。
#[must_use]
pub fn parse_spec_pairs(spec_text: &str) -> Vec<(String, String)> {
    spec_text
        .split([';', '；', ',', '，'])
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|pair| {
            let (name, value) = pair.split_once(':')?;
            let (name, value) = (name.trim(), value.trim());
            if name.is_empty() || value.is_empty() {
                return None;
            }
            Some((name.to_string(), value.to_string()))
        })
        .collect()
}

/// 金额/数字 → `toPlainString`（保留小数位，不科学计数）。
#[must_use]
pub fn decimal_plain(v: Option<Decimal>) -> String {
    v.map(|d| d.to_string()).unwrap_or_default()
}

/// 金额/数字 → `stripTrailingZeros().toPlainString()`（市场价/成本价用）。
#[must_use]
pub fn decimal_strip(v: Option<Decimal>) -> String {
    v.map(|d| d.normalize().to_string()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn range_ids_parse_like_java() {
        assert!(parse_range_ids(None).is_empty());
        assert!(parse_range_ids(Some("  ")).is_empty());
        assert_eq!(parse_range_ids(Some("1,2, 3")), vec![1, 2, 3]);
        // 非数字容错（Java 会 500，本实现忽略）
        assert_eq!(parse_range_ids(Some("1,x,2")), vec![1, 2]);
    }

    #[test]
    fn category_path_walks_to_root() {
        let cats = vec![
            (1, 0, "一级".to_string()),
            (2, 1, "二级".to_string()),
            (3, 2, "三级".to_string()),
        ];
        assert_eq!(build_category_path(Some(3), &cats), "一级/二级/三级");
        assert_eq!(build_category_path(Some(1), &cats), "一级");
        // 未知分类 / 空 → 空串
        assert_eq!(build_category_path(Some(99), &cats), "");
        assert_eq!(build_category_path(None, &cats), "");
        assert_eq!(build_category_path(Some(0), &cats), "");
    }

    #[test]
    fn shipping_texts_match_java() {
        assert_eq!(build_shipping_type_text(1, 0, 0), "快递发货");
        assert_eq!(
            build_shipping_type_text(1, 1, 1),
            "快递发货；同城配送；到店自提"
        );
        assert_eq!(build_shipping_type_text(0, 0, 0), "");
        assert_eq!(build_shipping_tpl_text(Some(2), None, 8), "【运费模板】8");
        assert_eq!(
            build_shipping_tpl_text(Some(1), Some(Decimal::new(500, 2)), 0),
            "5"
        );
        assert_eq!(
            build_shipping_tpl_text(None, Some(Decimal::new(500, 2)), 0),
            "5"
        );
        assert_eq!(build_shipping_tpl_text(None, None, 8), "");
    }

    #[test]
    fn desc_pic_url_extracts_pic_segments_only() {
        let html = concat!(
            "<div class=\"desc-pic-item\"><img src=\"https://a/1.png\"></div>",
            "<div data-division=1></div>",
            "<div>纯文本</div>",
            "<div data-division=1></div>",
            "<div class=\"desc-pic-item\"><img src='https://a/2.png'></div>"
        );
        assert_eq!(
            build_desc_pic_url_text(Some(html)),
            "https://a/1.png;https://a/2.png"
        );
        assert_eq!(build_desc_pic_url_text(None), "");
        assert_eq!(build_desc_pic_url_text(Some("<div>无图</div>")), "");
    }

    #[test]
    fn spec_text_and_pairs_match_spec_import_utils() {
        assert_eq!(
            to_import_spec_text(Some("颜色:红|尺寸:L")),
            "颜色:红；尺寸:L"
        );
        assert_eq!(to_import_spec_text(None), "");
        assert_eq!(
            parse_spec_pairs("颜色:红；尺寸:L"),
            vec![
                ("颜色".to_string(), "红".to_string()),
                ("尺寸".to_string(), "L".to_string())
            ]
        );
        assert!(parse_spec_pairs("").is_empty());
        assert!(parse_spec_pairs("无冒号").is_empty());
    }

    #[test]
    fn decimal_plain_keeps_scale_text() {
        // 商品售价：Java `toPlainString()`（保留 2 位）
        assert_eq!(decimal_plain(Some(Decimal::new(1990, 2))), "19.90");
        assert_eq!(decimal_plain(None), "");
        // 市场价/成本价：Java `stripTrailingZeros().toPlainString()`
        assert_eq!(decimal_strip(Some(Decimal::new(1990, 2))), "19.9");
        assert_eq!(decimal_strip(Some(Decimal::new(200, 2))), "2");
        assert_eq!(decimal_strip(None), "");
    }
}
