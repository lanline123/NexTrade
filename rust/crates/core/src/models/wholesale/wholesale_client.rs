//! C 端批发域（wholesale::wholesale_client）DTO / VO / 查询参数。
//!
//! 对应原 Java `com.tigshop.api.controller.wholesale.WholesaleClientController`
//! （`@RequestMapping("/api/wholesale")`）依赖的
//! `bean.vo.wholesale.WholesaleMeVO` /
//! `bean.vo.wholesale.WholesaleProductBuyRuleVO` /
//! `bean.vo.wholesale.WholesaleSkuRuleVO` /
//! `bean.vo.wholesale.WholesaleCartBatchResultVO` /
//! `bean.dto.wholesale.WholesaleCartBatchAddDTO`。
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | [`WholesaleMeVO`] | `vo.wholesale.WholesaleMeVO` |
//! | [`WholesaleBuyRuleQuery`] | `@RequestParam("productId")` |
//! | [`WholesaleProductBuyRuleVO`] | `vo.wholesale.WholesaleProductBuyRuleVO` |
//! | [`WholesaleSkuRuleVO`] | `vo.wholesale.WholesaleSkuRuleVO` |
//! | [`WholesaleCartBatchAddDTO`] | `dto.wholesale.WholesaleCartBatchAddDTO` |
//! | [`WholesaleCartBatchResultVO`] | `vo.wholesale.WholesaleCartBatchResultVO` |
//!
//! 约定：金额一律 `rust_decimal::Decimal`；JSON 字段名保持与 Java
//! （Jackson 默认 camelCase）一致，故入参/出参均 `rename_all = "camelCase"`。
//!
//! **校验口径说明**：Java 侧 `WholesaleCartBatchAddDTO` 的必填/范围由
//! Jakarta Bean Validation 在**整批**层面拦截（`items` `@NotEmpty` + `@Size(max=50)`，
//! 单行 `productId` `@NotNull @Positive`、`skuId` `@NotNull`、`quantity`
//! `@NotNull @Positive`）。为在 Rust 侧忠实复刻「缺字段也走业务错误码而非
//! 框架 400」的行为，本文件的入参字段统一建模为 `Option`，由服务层
//! （`tigshop_services::wholesale::wholesale_client::validate_batch_items`）统一校验并转为
//! [`ValidatedBatchItem`]。

use serde::{Deserialize, Serialize};

// ————————————————————— 我是否批发商（C1） —————————————————————

/// 当前会员的批发身份概览（Java `vo.wholesale.WholesaleMeVO`）。
///
/// 语义（Java `WholesaleClientController#me`）：任何"不是批发商"的情形
/// 都返回 `isWholesaler = false` 而非报错。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleMeVO {
    /// 当前会员是否为（启用中的）批发商
    pub is_wholesaler: bool,
    /// 批发等级 ID（`isWholesaler = true` 时回填）
    pub grade_id: Option<i32>,
    /// 批发等级名称（等级行缺失时为 `null`）
    pub grade_name: Option<String>,
    /// 批发功能总开关（`config.wholesaleEnabled`），前端据此决定是否渲染批发入口
    pub global_enabled: bool,
}

// ————————————————————— 商品起批规则（C2） —————————————————————

/// `GET /api/wholesale/product/buyRule` 的查询参数。
///
/// 对应 Java `@RequestParam("productId") @NotNull @Positive Integer productId`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleBuyRuleQuery {
    /// 商品 ID（必填、正整数；缺失由 serde 反序列化拦截，非正数由服务层校验）
    pub product_id: Option<i32>,
}

/// SKU 倍数规则（Java `vo.wholesale.WholesaleSkuRuleVO`）。
///
/// CR-20260604-0937 后本 VO 只承载 `multiple`（起批数统一到商品级 `moq`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleSkuRuleVO {
    /// SKU ID（`0` = SPU 兜底行）
    pub sku_id: i32,
    /// 倍数购买（`1` = 不限制）
    pub multiple: i32,
}

/// 商品起批规则（Java `vo.wholesale.WholesaleProductBuyRuleVO`）。
///
/// 契约：「非批发商也可查，前端预览用」，未配置批发能力时
/// `configured = false`（不抛错）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleProductBuyRuleVO {
    /// 商品 ID
    pub product_id: i32,
    /// 是否配置批发能力（`product_wholesale_config.status = 1`）
    pub configured: bool,
    /// 起批维度：`1` = SPU、`2` = SKU（未配置时 `null`）
    pub dimension: Option<i32>,
    /// 起批数：`dimension = 1` 时为加总起批；`= 2` 时为每 SKU 起批（未配置时 `null`）
    pub moq: Option<i32>,
    /// SKU 倍数规则（未配置时为空数组）
    pub sku_rules: Vec<WholesaleSkuRuleVO>,
    /// 前端展示提示文案（后端组装；未配置时 `null`）
    pub hint: Option<String>,
}

// ————————————————————— 批量加车（C3） —————————————————————

/// C 端批量加车入参（Java `dto.wholesale.WholesaleCartBatchAddDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleCartBatchAddDTO {
    /// 批量加车项（Java `@NotEmpty` + `@Size(max = 50)`）
    pub items: Vec<WholesaleCartBatchItem>,
}

/// 批量加车单项（Java `WholesaleCartBatchAddDTO.Item`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesaleCartBatchItem {
    /// 商品 ID（Java `@NotNull @Positive`）
    pub product_id: Option<i32>,
    /// SKU ID（Java `@NotNull`；`0` / `null` 语义见服务层 SKU 解析）
    pub sku_id: Option<i32>,
    /// 数量（Java `@NotNull @Positive`）
    pub quantity: Option<i32>,
}

/// 通过整批校验后的加车单项（纯内部类型，不做序列化）。
///
/// Java 的 `@Valid` 在整批层面拦截非法入参，故校验收敛到
/// `validate_batch_items` 后即可用非 `Option` 的强类型继续。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ValidatedBatchItem {
    /// 商品 ID（已校验为正整数）
    pub product_id: i32,
    /// SKU ID（已校验非 `null`；允许 `0` 表示 SPU 兜底）
    pub sku_id: i32,
    /// 数量（已校验为正整数）
    pub quantity: i32,
}

/// 批量加车失败明细（Java `WholesaleCartBatchResultVO.FailedItem`）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleCartBatchFailedItem {
    /// 商品 ID
    pub product_id: i32,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// 失败原因
    pub reason: String,
    /// 业务错误码
    pub code: i32,
}

/// 批量加车结果（Java `vo.wholesale.WholesaleCartBatchResultVO`）。
///
/// 部分失败不回滚成功行（Java `WholesaleCartBatchServiceImpl` 逐项
/// try-catch）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesaleCartBatchResultVO {
    /// 成功数
    pub success_count: i32,
    /// 失败数
    pub failed_count: i32,
    /// 失败明细
    pub failed_items: Vec<WholesaleCartBatchFailedItem>,
}
