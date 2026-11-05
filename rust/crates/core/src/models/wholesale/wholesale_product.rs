//! 批发商品域（wholesale::wholesale_product）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.wholesale.WholesaleProductController`
//!   （`@RequestMapping("/adminapi/wholesale/product")`，13 个端点）
//! - `com.tigshop.service.wholesale.impl.WholesaleProductConfigServiceImpl`
//!   / `WholesaleProductQueryServiceImpl` / `WholesalePriceServiceImpl`
//!   / `WholesaleSkuConfigServiceImpl`
//! - `com.tigshop.bean.dto.wholesale.*` / `bean.vo.wholesale.*` 对应结构
//!
//! # 端点（13 条）
//!
//! | method | path |
//! |--------|------|
//! | `GET`  | `/adminapi/wholesale/product/page` |
//! | `GET`  | `/adminapi/wholesale/product/selectable/page` |
//! | `POST` | `/adminapi/wholesale/product/add` |
//! | `POST` | `/adminapi/wholesale/product/batchAdd` |
//! | `POST` | `/adminapi/wholesale/product/batchDelete` |
//! | `GET`  | `/adminapi/wholesale/product/price/detail` |
//! | `POST` | `/adminapi/wholesale/product/price/save` |
//! | `POST` | `/adminapi/wholesale/product/price/batchSetCommon` |
//! | `POST` | `/adminapi/wholesale/product/price/batchSetByGrade` |
//! | `GET`  | `/adminapi/wholesale/product/buyRule/detail` |
//! | `POST` | `/adminapi/wholesale/product/buyRule/save` |
//! | `POST` | `/adminapi/wholesale/product/buyRule/batchSave` |
//! | `POST` | `/adminapi/wholesale/product/multiple/save` |
//!
//! # 与 Java 的差异（`uncertain_points`）
//!
//! 1. **多租户**：Java 用 `HeaderUtils.getShopId()`（平台 admin=0 / 商家=自己
//!    shopId）；Rust 由路由层传 `shop_id`（本任务控制台默认 0 = 平台）。
//! 2. **`selectable/page` 返回结构**：Java 返回完整 `ProductListResDTO`；
//!    本实现返回精简投影 [`WholesaleSelectableProductVO`]（列表选择器所需字段）。
//! 3. **价格区间文案**：货币符号读取 `config.dollarSign`（缺省 `¥`），
//!    与 Java `ConfigService#getCurrencySymbol` 一致；折扣区间格式化同 Java
//!    （`x.xx折`，HALF_UP 两位）。
//! 4. **阶梯 / 价格行校验**逐条照抄 Java（错误文案含「第 N 行：」前缀）。
//! 5. 删除批发商品为**物理删** `product_wholesale_config` /
//!    `product_wholesale_sku_config` / `product_wholesale_price`（Java CD-033；
//!    唯一索引不含 `is_delete`，软删会撞 1062）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 业务错误码（Java `HttpStatus` 5300 段）
// ——————————————————————————————————————————————

pub const CODE_BAD_REQUEST: i32 = 400;
pub const CODE_GRADE_NOT_FOUND: i32 = 5303;
pub const CODE_GRADE_DISABLED: i32 = 5304;
pub const CODE_PRODUCT_NOT_FOUND: i32 = 5310;
pub const CODE_PRODUCT_ALREADY_CONFIGURED: i32 = 5311;
pub const CODE_PRICE_INVALID: i32 = 5312;
pub const CODE_NON_PLATFORM_PRODUCT: i32 = 5314;
pub const CODE_PRODUCT_TYPE_NOT_SUPPORTED: i32 = 5315;

// ——————————————————————————————————————————————
// 文案（逐字符照抄 Java）
// ——————————————————————————————————————————————

pub const MSG_PRODUCT_NOT_FOUND: &str = "商品不存在";
pub const MSG_PRODUCT_ALREADY_CONFIGURED: &str = "该商品已配置批发能力";
pub const MSG_PRODUCT_NOT_CONFIGURED: &str = "商品未配置批发能力";
pub const MSG_PRODUCT_NOT_FOUND_OR_CONFIG: &str = "商品不存在或未配置批发能力";
pub const MSG_NON_PLATFORM_PRODUCT: &str = "只能配置本店铺商品的批发能力";
pub const MSG_PRODUCT_TYPE_NOT_SUPPORTED: &str = "仅支持普通实物商品配置批发";
pub const MSG_PRESALE_NOT_SUPPORTED: &str = "预售商品不支持配置批发";
pub const MSG_CYCLE_NOT_SUPPORTED: &str = "周期购商品不支持配置批发";
pub const MSG_MULTI_SPEC_MODE_INVALID: &str = "multiSpecPriceMode 必须为 1 或 2";
pub const MSG_MOQ_DIMENSION_INVALID: &str = "moqDimension 必须为 1 或 2";
pub const MSG_MOQ_INVALID: &str = "moq 必须 ≥ 1";
pub const MSG_PRICE_ROWS_REQUIRED: &str = "priceRows 不能为空";
pub const MSG_TIERS_REQUIRED: &str = "tiers 不能为空";
pub const MSG_GRADE_ROWS_REQUIRED: &str = "gradeRows 不能为空";
pub const MSG_PRICE_MODE_INVALID: &str = "priceMode 必须为 1 或 2";
pub const MSG_SKU_ID_INVALID: &str = "skuId 必须 ≥ 0";
pub const MSG_GRADE_ID_INVALID: &str = "gradeRows[].gradeId 必须 > 0";
pub const MSG_MIN_QTY_INVALID: &str = "阶梯起量 minQty 必须 ≥ 1";
pub const MSG_DISCOUNT_INVALID: &str = "discount 必须在 [0.10, 9.99]";
pub const MSG_WHOLESALE_PRICE_INVALID: &str = "wholesalePrice 必须 > 0";
pub const MSG_GRADE_ID_REQUIRED: &str = "gradeId 不能为空";
pub const MSG_PRODUCT_ID_REQUIRED: &str = "productId 不能为空";
pub const MSG_PRODUCT_IDS_REQUIRED: &str = "商品 ID 列表不能为空";
pub const MSG_BATCH_SIZE_INVALID: &str = "批量数量必须在 1-50 之间";

/// 折扣下界（十分制，Java `DISCOUNT_MIN`）。
pub const DISCOUNT_MIN: &str = "0.10";
/// 折扣上界（十分制，Java `DISCOUNT_MAX`）。
pub const DISCOUNT_MAX: &str = "9.99";
/// 单次保存最大行数（Java `MAX_ROWS`）。
pub const MAX_ROWS: usize = 1000;
/// 同 (sku,grade) 阶梯段上限（Java `MAX_TIERS_PER_GROUP`）。
pub const MAX_TIERS_PER_GROUP: usize = 20;
/// 多规格价格模式默认值：商品级混批。
pub const DEFAULT_MULTI_SPEC_PRICE_MODE: i32 = 1;
/// 起批维度默认值：SPU。
pub const DEFAULT_MOQ_DIMENSION: i32 = 1;
/// 新增批发配置默认起批数（Java `DEFAULT_MOQ = 1`）。
pub const DEFAULT_MOQ: i32 = 1;
/// 通用价 `grade_id`。
pub const GRADE_UNIVERSAL: i32 = 0;
/// SPU 兜底 `sku_id`。
pub const SKU_SPU_FALLBACK: i32 = 0;
/// 空值展示（Java `EMPTY_DISPLAY = "—"`）。
pub const EMPTY_DISPLAY: &str = "—";
/// 单规格合成行展示名（Java `SINGLE_SPEC_SPEC_TEXT`）。
pub const SINGLE_SPEC_SPEC_TEXT: &str = "默认规格";
/// 通用价名称。
pub const GRADE_UNIVERSAL_NAME: &str = "通用价";

/// 管理端分页默认 / 上限（Java `DEFAULT_SIZE=20, MAX_SIZE=100`）。
pub const DEFAULT_PAGE_SIZE: u64 = 20;
pub const MAX_PAGE_SIZE: u64 = 100;

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// 批发商品分页查询（Java `WholesaleProductPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleProductPageQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 商品名/货号模糊
    pub keyword: Option<String>,
    /// 起批维度筛选：1=SPU 2=SKU
    pub moq_dimension: Option<i32>,
}

/// 可选批发商品分页查询（Java `WholesaleSelectableProductPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleSelectableProductPageQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub keyword: Option<String>,
    pub category_id: Option<i32>,
    pub brand_id: Option<i32>,
    /// 上架状态：缺省 1（仅上架）
    pub product_status: Option<i32>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 添加批发商品（Java `WholesaleProductAddDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleProductAddDTO {
    pub product_id: Option<i32>,
    pub multi_spec_price_mode: Option<i32>,
    pub moq_dimension: Option<i32>,
}

/// 批量添加批发商品（Java `WholesaleProductBatchAddDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleProductBatchAddDTO {
    pub product_ids: Option<Vec<i32>>,
}

/// 批量删除批发商品请求体（Java `Map<String, List<Integer>>`，key=`productIds`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBatchDeleteDTO {
    pub product_ids: Option<Vec<i32>>,
}

/// 批发价行入参（Java `WholesalePriceRowDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalePriceRowDTO {
    pub sku_id: Option<i32>,
    pub grade_id: Option<i32>,
    pub tier_min_qty: Option<i32>,
    pub price_mode: Option<i32>,
    pub discount: Option<Decimal>,
    pub wholesale_price: Option<Decimal>,
}

/// 批发价保存入参（Java `WholesalePriceSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalePriceSaveDTO {
    pub product_id: Option<i32>,
    pub multi_spec_price_mode: Option<i32>,
    pub price_rows: Option<Vec<WholesalePriceRowDTO>>,
}

/// 批量设置阶梯行（Java `WholesaleBatchTierDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBatchTierDTO {
    pub min_qty: Option<i32>,
    pub discount: Option<Decimal>,
    pub wholesale_price: Option<Decimal>,
}

/// 批量设置通用售价（Java `WholesaleBatchCommonDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBatchCommonDTO {
    pub product_id: Option<i32>,
    pub sku_ids: Option<Vec<i32>>,
    pub price_mode: Option<i32>,
    pub tiers: Option<Vec<WholesaleBatchTierDTO>>,
}

/// 批量设置类型售价的等级行（Java `WholesaleGradeRowDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleGradeRowDTO {
    pub grade_id: Option<i32>,
    pub tiers: Option<Vec<WholesaleBatchTierDTO>>,
}

/// 批量设置类型售价（Java `WholesaleBatchGradeDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBatchGradeDTO {
    pub product_id: Option<i32>,
    pub sku_ids: Option<Vec<i32>>,
    pub price_mode: Option<i32>,
    pub grade_rows: Option<Vec<WholesaleGradeRowDTO>>,
}

/// 起批量设置（Java `WholesaleBuyRuleSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBuyRuleSaveDTO {
    pub product_id: Option<i32>,
    pub dimension: Option<i32>,
    pub moq: Option<i32>,
}

/// 起批量批量设置（Java `WholesaleBuyRuleBatchSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBuyRuleBatchSaveDTO {
    pub product_ids: Option<Vec<i32>>,
    pub dimension: Option<i32>,
    pub moq: Option<i32>,
}

/// SKU 倍数行（Java `WholesaleMultipleSkuDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleMultipleSkuDTO {
    pub sku_id: Option<i32>,
    pub multiple: Option<i32>,
}

/// 倍数购买保存（Java `WholesaleMultipleSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleMultipleSaveDTO {
    pub product_id: Option<i32>,
    pub sku_multiples: Option<Vec<WholesaleMultipleSkuDTO>>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 批发商品列表项（Java `WholesaleProductVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleProductVO {
    pub product_id: i32,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_no: Option<String>,
    pub pic_url: Option<String>,
    pub pic_thumb: Option<String>,
    pub retail_price_range: String,
    pub wholesale_price_display: String,
    pub moq_dimension: Option<i32>,
    pub moq_dimension_name: String,
    pub moq_display: Option<i32>,
    pub multiple_set: bool,
    pub stock: Option<i32>,
    pub shelf_status: Option<i32>,
    pub config_status: Option<i32>,
}

/// 可选批发商品精简投影（Java 返回 `ProductListResDTO`，见模块头差异第 2 条）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleSelectableProductVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_sn: String,
    pub product_tsn: Option<String>,
    pub pic_url: String,
    pub pic_thumb: String,
    pub product_price: Decimal,
    pub market_price: Decimal,
    pub product_status: i32,
    pub category_id: i32,
    pub brand_id: i32,
}

/// 批量添加结果（Java `WholesaleProductBatchAddVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleProductBatchAddVO {
    pub success_count: i32,
    pub skipped_ids: Vec<i32>,
    pub failed_items: Vec<WholesaleProductBatchAddFailedItem>,
}

/// 批量添加失败项。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleProductBatchAddFailedItem {
    pub product_id: i32,
    pub error_code: i32,
    pub error_message: String,
}

/// 批发价行 VO（Java `WholesalePriceRowVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalePriceRowVO {
    pub grade_id: Option<i32>,
    pub grade_name: Option<String>,
    pub tier_min_qty: Option<i32>,
    pub price_mode: Option<i32>,
    pub discount: Option<Decimal>,
    pub wholesale_price: Option<Decimal>,
}

/// SKU 批发价 VO（Java `WholesaleSkuPriceVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleSkuPriceVO {
    pub sku_id: i32,
    pub sku_spec_text: Option<String>,
    pub retail_price: Option<Decimal>,
    pub price_rows: Vec<WholesalePriceRowVO>,
}

/// 批发价详情（Java `WholesalePriceDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalePriceDetailVO {
    pub product_id: i32,
    pub is_multi_spec: bool,
    pub multi_spec_price_mode: Option<i32>,
    pub price_mode: Option<i32>,
    pub skus: Vec<WholesaleSkuPriceVO>,
}

/// SKU 倍数规则（Java `WholesaleSkuRuleVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleSkuRuleVO {
    pub sku_id: i32,
    pub multiple: Option<i32>,
}

/// 起批规则（Java `WholesaleProductBuyRuleVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleProductBuyRuleVO {
    pub product_id: i32,
    pub configured: bool,
    pub dimension: Option<i32>,
    pub moq: Option<i32>,
    pub sku_rules: Vec<WholesaleSkuRuleVO>,
    pub hint: Option<String>,
}

/// 通过校验的价格行（内部强类型）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedPriceRow {
    /// SKU ID（≥0）
    pub sku_id: i32,
    /// 等级 ID（0=通用价）
    pub grade_id: i32,
    /// 阶梯起量（≥1）
    pub tier_min_qty: i32,
    /// 价格模式 1 折扣 / 2 固定
    pub price_mode: i32,
    /// 折扣（缺省 0）
    pub discount: Decimal,
    /// 固定批发价（缺省 0）
    pub wholesale_price: Decimal,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

fn d(s: &str) -> Decimal {
    s.parse().unwrap_or_default()
}

/// 折扣是否落在 `[0.10, 9.99]`（Java `isDiscountInRange`）。
#[must_use]
pub fn is_discount_in_range(discount: Option<Decimal>) -> bool {
    discount.is_some_and(|v| v >= d(DISCOUNT_MIN) && v <= d(DISCOUNT_MAX))
}

/// 归一多规格价格模式（Java `normalizeMultiSpecMode`）。
///
/// # Errors
/// 非法值返回 [`MSG_MULTI_SPEC_MODE_INVALID`]。
pub fn normalize_multi_spec_mode(mode: Option<i32>) -> std::result::Result<i32, String> {
    match mode {
        Some(v) if v == 1 || v == 2 => Ok(v),
        _ => Err(MSG_MULTI_SPEC_MODE_INVALID.to_string()),
    }
}

/// 归一 MOQ 维度（Java `normalizeMoqDimension`）。
///
/// # Errors
/// 非法值返回 [`MSG_MOQ_DIMENSION_INVALID`]。
pub fn normalize_moq_dimension(dimension: Option<i32>) -> std::result::Result<i32, String> {
    match dimension {
        Some(v) if v == 1 || v == 2 => Ok(v),
        _ => Err(MSG_MOQ_DIMENSION_INVALID.to_string()),
    }
}

/// 归一价格模式（Java `requirePriceMode`）。
///
/// # Errors
/// 非法值返回 [`MSG_PRICE_MODE_INVALID`]。
pub fn require_price_mode(mode: Option<i32>) -> std::result::Result<i32, String> {
    match mode {
        Some(v) if v == 1 || v == 2 => Ok(v),
        _ => Err(MSG_PRICE_MODE_INVALID.to_string()),
    }
}

/// 校验整批价格行（Java `save` 的逐行校验，含「第 N 行：」前缀）。
///
/// # Errors
/// 返回与 Java 逐字符一致的错误文案。
pub fn validate_price_rows(
    rows: &[WholesalePriceRowDTO],
) -> std::result::Result<Vec<ValidatedPriceRow>, String> {
    if rows.is_empty() {
        return Err(MSG_PRICE_ROWS_REQUIRED.to_string());
    }
    if rows.len() > MAX_ROWS {
        return Err(format!("priceRows 不能超过 {MAX_ROWS} 条"));
    }
    let mut unique = std::collections::HashSet::new();
    let mut tier_count = std::collections::HashMap::new();
    let mut out = Vec::with_capacity(rows.len());
    for (idx, r) in rows.iter().enumerate() {
        let row_idx = idx + 1;
        let err = |reason: String| format!("第 {row_idx} 行：{reason}");
        let sku_id = r
            .sku_id
            .ok_or_else(|| err(MSG_SKU_ID_INVALID.to_string()))?;
        if sku_id < 0 {
            return Err(err(MSG_SKU_ID_INVALID.to_string()));
        }
        let grade_id = r
            .grade_id
            .ok_or_else(|| err("gradeId 必须 ≥ 0".to_string()))?;
        if grade_id < 0 {
            return Err(err("gradeId 必须 ≥ 0".to_string()));
        }
        let tier_min_qty = r
            .tier_min_qty
            .ok_or_else(|| err(MSG_MIN_QTY_INVALID.to_string()))?;
        if tier_min_qty < 1 {
            return Err(err(MSG_MIN_QTY_INVALID.to_string()));
        }
        let price_mode = require_price_mode(r.price_mode).map_err(&err)?;
        if price_mode == 1 {
            if !is_discount_in_range(r.discount) {
                return Err(err(MSG_DISCOUNT_INVALID.to_string()));
            }
        } else if !r.wholesale_price.is_some_and(|p| p > Decimal::ZERO) {
            return Err(err(MSG_WHOLESALE_PRICE_INVALID.to_string()));
        }
        if !unique.insert((sku_id, grade_id, tier_min_qty)) {
            return Err(err("(sku,grade,tier) 组合重复".to_string()));
        }
        let key = (sku_id, grade_id);
        let count = tier_count.entry(key).or_insert(0usize);
        *count += 1;
        if *count > MAX_TIERS_PER_GROUP {
            return Err(err(format!(
                "同 (sku,grade) 阶梯不能超过 {MAX_TIERS_PER_GROUP} 段"
            )));
        }
        out.push(ValidatedPriceRow {
            sku_id,
            grade_id,
            tier_min_qty,
            price_mode,
            discount: r.discount.unwrap_or_default(),
            wholesale_price: r.wholesale_price.unwrap_or_default(),
        });
    }
    Ok(out)
}

/// 校验一组阶梯行（Java `buildBatchRows` 的校验部分）。
///
/// # Errors
/// 返回 Java 同款文案（无行号前缀）。
pub fn validate_tiers(
    tiers: &[WholesaleBatchTierDTO],
    price_mode: i32,
) -> std::result::Result<Vec<(i32, Decimal, Decimal)>, String> {
    if tiers.is_empty() {
        return Err(MSG_TIERS_REQUIRED.to_string());
    }
    if tiers.len() > MAX_TIERS_PER_GROUP {
        return Err(format!(
            "同 (sku,grade) 阶梯不能超过 {MAX_TIERS_PER_GROUP} 段"
        ));
    }
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(tiers.len());
    for t in tiers {
        let min_qty = t.min_qty.ok_or_else(|| MSG_MIN_QTY_INVALID.to_string())?;
        if min_qty < 1 {
            return Err(MSG_MIN_QTY_INVALID.to_string());
        }
        if price_mode == 1 {
            if !is_discount_in_range(t.discount) {
                return Err(MSG_DISCOUNT_INVALID.to_string());
            }
        } else if !t.wholesale_price.is_some_and(|p| p > Decimal::ZERO) {
            return Err(MSG_WHOLESALE_PRICE_INVALID.to_string());
        }
        if !seen.insert(min_qty) {
            return Err(format!("阶梯起量 minQty 重复：{min_qty}"));
        }
        out.push((
            min_qty,
            t.discount.unwrap_or_default(),
            t.wholesale_price.unwrap_or_default(),
        ));
    }
    Ok(out)
}

/// 目标 SKU 解析（Java `resolveTargetSkus`）：空 = 全 SKU → SPU 兜底 `sku_id=0`。
///
/// # Errors
/// 负数 SKU 返回 [`MSG_SKU_ID_INVALID`]。
pub fn resolve_target_skus(sku_ids: Option<&[i32]>) -> std::result::Result<Vec<i32>, String> {
    match sku_ids {
        None => Ok(vec![SKU_SPU_FALLBACK]),
        Some(ids) if ids.is_empty() => Ok(vec![SKU_SPU_FALLBACK]),
        Some(ids) => {
            let mut set = std::collections::HashSet::new();
            let mut out = Vec::with_capacity(ids.len());
            for id in ids {
                if *id < 0 {
                    return Err(MSG_SKU_ID_INVALID.to_string());
                }
                if set.insert(*id) {
                    out.push(*id);
                }
            }
            Ok(out)
        }
    }
}

/// 价格行是否归属某 SKU（Java `belongsToSku`：`sku_id == 0` 兜底或精确命中）。
#[must_use]
pub fn belongs_to_sku(row_sku_id: i32, sku_id: i32) -> bool {
    row_sku_id == SKU_SPU_FALLBACK || row_sku_id == sku_id
}

/// 两位小数 HALF_UP 格式化，**固定两位**（含补零）。
///
/// Java 用 `BigDecimal.setScale(2, RoundingMode.HALF_UP).toPlainString()`：
/// `setScale` 会把小数位**补齐**到恰好 2 位（`5` → `"5.00"`、`8.5` → `"8.50"`）。
/// `rust_decimal::Decimal::round_dp_with_strategy` 在 `scale <= 2` 时**不补零**，
/// 因此这里先按 HALF_UP 收敛到 ≤2 位，再显式补齐两位，保证与 Java 逐字符一致。
fn format_2dp(value: Decimal) -> String {
    let scaled =
        value.round_dp_with_strategy(2, rust_decimal::RoundingStrategy::MidpointAwayFromZero);
    let text = scaled.to_string();
    let (int_part, frac) = match text.split_once('.') {
        Some((int_part, frac)) => (int_part, frac),
        None => (text.as_str(), ""),
    };
    let frac: String = if frac.len() >= 2 {
        frac.chars().take(2).collect()
    } else {
        format!("{frac}{}", "0".repeat(2 - frac.len()))
    };
    format!("{int_part}.{frac}")
}

/// 金额格式化（Java `money`：货币符号 + HALF_UP 两位小数，固定两位）。
#[must_use]
pub fn format_money(currency_symbol: &str, value: Decimal) -> String {
    format!("{currency_symbol}{}", format_2dp(value))
}

/// 折扣格式化（Java `discount`：HALF_UP 两位 + `折`）。
///
/// Java `v.setScale(2, HALF_UP).toPlainString() + "折"` → `5` 输出 `"5.00折"`。
#[must_use]
pub fn format_discount(value: Decimal) -> String {
    format!("{}折", format_2dp(value))
}

/// 零售价区间（Java `formatRetailRange`）：SKU 价 min/max；无 SKU 回退商品价。
#[must_use]
pub fn format_retail_range(
    sku_prices: &[Decimal],
    product_price: Option<Decimal>,
    currency: &str,
) -> String {
    let mut prices: Vec<Decimal> = sku_prices.to_vec();
    if prices.is_empty() {
        if let Some(p) = product_price {
            prices.push(p);
        }
    }
    if prices.is_empty() {
        return EMPTY_DISPLAY.to_string();
    }
    let min = prices.iter().copied().min().unwrap_or_default();
    let max = prices.iter().copied().max().unwrap_or_default();
    if min == max {
        format_money(currency, min)
    } else {
        format!(
            "{}-{}",
            format_money(currency, min),
            format_money(currency, max)
        )
    }
}

/// 起批规则提示文案（Java `buildHint`）。
#[must_use]
pub fn build_hint(dimension: i32, moq: i32, multiples: &[Option<i32>]) -> String {
    let moq = if moq > 0 { moq } else { 1 };
    let mut sb = if dimension == DEFAULT_MOQ_DIMENSION {
        format!("批发起订 {moq} 件")
    } else {
        format!("按 SKU 起订，每规格 {moq} 件起")
    };
    let multiple = multiples.iter().filter_map(|m| *m).filter(|m| *m > 1).min();
    if let Some(m) = multiple {
        sb.push_str(&format!("，需按 {m} 的倍数购买"));
    }
    sb
}

#[cfg(test)]
mod tests {
    use super::*;

    fn price(s: &str) -> Decimal {
        s.parse().unwrap()
    }

    /// 金额 / 折扣 / 区间格式化（HALF_UP 两位，货币符号可配）。
    #[test]
    fn price_formatting_matches_java() {
        assert_eq!(format_money("¥", price("60.995")), "¥61.00");
        assert_eq!(format_money("$", price("60.99")), "$60.99");
        assert_eq!(format_discount(price("5")), "5.00折");
        assert_eq!(format_discount(price("4.5")), "4.50折");

        assert_eq!(
            format_retail_range(&[price("10"), price("99")], None, "¥"),
            "¥10.00-¥99.00"
        );
        assert_eq!(format_retail_range(&[price("10")], None, "¥"), "¥10.00");
        // 无 SKU → 商品价
        assert_eq!(format_retail_range(&[], Some(price("8.5")), "¥"), "¥8.50");
        // 无任何价格 → `—`
        assert_eq!(format_retail_range(&[], None, "¥"), EMPTY_DISPLAY);
    }

    /// 归一枚举与折扣区间。
    #[test]
    fn normalization_and_discount_range() {
        assert_eq!(normalize_multi_spec_mode(Some(1)).unwrap(), 1);
        assert_eq!(normalize_multi_spec_mode(Some(2)).unwrap(), 2);
        assert_eq!(
            normalize_multi_spec_mode(Some(3)).unwrap_err(),
            MSG_MULTI_SPEC_MODE_INVALID
        );
        assert_eq!(
            normalize_moq_dimension(None).unwrap_err(),
            MSG_MOQ_DIMENSION_INVALID
        );
        assert_eq!(require_price_mode(Some(2)).unwrap(), 2);
        assert_eq!(
            require_price_mode(None).unwrap_err(),
            MSG_PRICE_MODE_INVALID
        );

        assert!(is_discount_in_range(Some(price("0.10"))));
        assert!(is_discount_in_range(Some(price("9.99"))));
        assert!(!is_discount_in_range(Some(price("0.09"))));
        assert!(!is_discount_in_range(Some(price("10.00"))));
        assert!(!is_discount_in_range(None));
    }

    /// 价格行校验：含「第 N 行：」前缀、重复组合、阶梯上限。
    #[test]
    fn validate_price_rows_messages() {
        let bad_sku = vec![WholesalePriceRowDTO {
            sku_id: None,
            ..Default::default()
        }];
        assert_eq!(
            validate_price_rows(&bad_sku).unwrap_err(),
            format!("第 1 行：{MSG_SKU_ID_INVALID}")
        );

        let bad_discount = vec![WholesalePriceRowDTO {
            sku_id: Some(0),
            grade_id: Some(0),
            tier_min_qty: Some(10),
            price_mode: Some(1),
            discount: Some(price("12")),
            wholesale_price: None,
        }];
        assert_eq!(
            validate_price_rows(&bad_discount).unwrap_err(),
            format!("第 1 行：{MSG_DISCOUNT_INVALID}")
        );

        let ok_row = WholesalePriceRowDTO {
            sku_id: Some(11),
            grade_id: Some(0),
            tier_min_qty: Some(10),
            price_mode: Some(2),
            discount: None,
            wholesale_price: Some(price("8.5")),
        };
        // 单行合法（Java 逐行校验：1 行通过 → 1 行结果）
        let validated = validate_price_rows(std::slice::from_ref(&ok_row)).unwrap();
        assert_eq!(validated.len(), 1);
        assert_eq!(validated[0].sku_id, 11);
        assert_eq!(validated[0].tier_min_qty, 10);
        // 完全重复的 (sku,grade,tier) → 报错
        let dup_err = validate_price_rows(&[
            WholesalePriceRowDTO {
                sku_id: Some(11),
                grade_id: Some(0),
                tier_min_qty: Some(10),
                price_mode: Some(2),
                discount: None,
                wholesale_price: Some(price("8.5")),
            },
            WholesalePriceRowDTO {
                sku_id: Some(11),
                grade_id: Some(0),
                tier_min_qty: Some(10),
                price_mode: Some(2),
                discount: None,
                wholesale_price: Some(price("9.5")),
            },
        ])
        .unwrap_err();
        assert!(dup_err.contains("组合重复"));
    }

    /// 起批提示文案逐字符对齐 Java `buildHint`。
    #[test]
    fn build_hint_matches_java() {
        assert_eq!(build_hint(1, 10, &[Some(1), None]), "批发起订 10 件");
        assert_eq!(
            build_hint(2, 5, &[Some(3), Some(2)]),
            "按 SKU 起订，每规格 5 件起，需按 2 的倍数购买"
        );
        // moq 为 0 / 负数按 1 兜底
        assert_eq!(build_hint(1, 0, &[]), "批发起订 1 件");
    }

    /// 目标 SKU 解析与归属判定。
    #[test]
    fn target_skus_and_belongs() {
        assert_eq!(resolve_target_skus(None).unwrap(), vec![0]);
        assert_eq!(resolve_target_skus(Some(&[])).unwrap(), vec![0]);
        assert_eq!(resolve_target_skus(Some(&[3, 1, 3])).unwrap(), vec![3, 1]);
        assert_eq!(
            resolve_target_skus(Some(&[-1])).unwrap_err(),
            MSG_SKU_ID_INVALID
        );

        assert!(belongs_to_sku(0, 11));
        assert!(belongs_to_sku(11, 11));
        assert!(!belongs_to_sku(12, 11));
    }

    /// 阶梯校验：空 / 非法 mode / 重复 minQty。
    #[test]
    fn validate_tiers_rules() {
        assert_eq!(validate_tiers(&[], 1).unwrap_err(), MSG_TIERS_REQUIRED);
        let tier = WholesaleBatchTierDTO {
            min_qty: Some(10),
            discount: Some(price("5.0")),
            wholesale_price: None,
        };
        assert_eq!(
            validate_tiers(std::slice::from_ref(&tier), 1)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            validate_tiers(&[tier.clone(), tier], 1).unwrap_err(),
            "阶梯起量 minQty 重复：10"
        );
    }
}
