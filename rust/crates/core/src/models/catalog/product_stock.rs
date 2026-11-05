//! 商品库存管理域（catalog::product_stock）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.product.ProductStockController`
//! - 服务 `ProductStockRecordServiceImpl` / `ProductStockAdjustRecordServiceImpl`
//!   / `ProductStockAllocateRecordServiceImpl` / `ProductInventoryLogServiceImpl`
//! - bean `com.tigshop.bean.dto.product.*` / `com.tigshop.bean.vo.product.*`
//!   / `com.tigshop.bean.model.product.*`
//!
//! JSON 字段严格保持原接口的 camelCase（`#[serde(rename_all = "camelCase")]`），
//! 因为前端直接按这些字段名取值。字段名与 Java 完全同名，
//! 例如调拨分页查询用 `outboundOrganizationId`、审核用请求体用 `allocateId` + `status`。
//!
//! 本域**未迁移**的部分（Excel 模板下载 / 批量导入 / 导入错误数据回传 / 调拨导出）
//! 在 `models::crate::models::catalog::product_stock::EXCEL_UNMIGRATED_MSG` 中给出统一、明确的业务错误文案，
//! 绝不伪造实现（Excel 解析依赖 `calamine`，且 Java 走 `@ResponseExcel` 二进制流式响应）。

use serde::{Deserialize, Serialize};

use rust_decimal::Decimal;

use crate::entities::{
    ProductStockAdjustRecord, ProductStockAllocateOperationRecord, ProductStockAllocateRecord,
    ProductStockAllocateRecordDetail, ProductStockRecord, ProductStockRecordDetail,
};

/// 商品出入库导入行（Java `ProductStockOutExcelDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStockImportRow {
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_sku_name: Option<String>,
    pub quantity: Option<String>,
    pub comment: Option<String>,
}

/// 调拨单导入行（Java `AllocateBatchImportVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateBatchImportRow {
    pub stock_out_org: Option<String>,
    pub stock_in_org: Option<String>,
    pub comment: Option<String>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub sku_name: Option<String>,
    pub quantity: Option<String>,
}

/// 调拨单导入错误行（Java `AllocateBatchImportErrorVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateBatchImportErrorVO {
    pub stock_out_org: Option<String>,
    pub stock_in_org: Option<String>,
    pub comment: Option<String>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub sku_name: Option<String>,
    pub quantity: Option<String>,
    pub error_msg: String,
}

/// 调拨商品导入行（Java `AllocateProductImportExcelDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateProductImportRow {
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_sku_name: Option<String>,
    pub quantity: Option<String>,
}

/// 调拨商品导入错误行（Java `AllocateProductImportErrorExcelDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateProductImportErrorVO {
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_sku_name: Option<String>,
    pub quantity: Option<String>,
    pub error_msg: String,
}

/// 导入成功预览行（Java `ProductImportSuccessListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportSuccessVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_unit: Option<String>,
    pub product_pic_thumb: Option<String>,
    pub product_sku_id: Option<i32>,
    pub product_sku_name: Option<String>,
    pub quantity: i32,
    pub current_product_stock: i32,
}

/// 导入失败行（Java `ProductImportErrorExcelVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductImportErrorVO {
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_sku_name: Option<String>,
    pub quantity: Option<String>,
    pub comment: Option<String>,
    pub error_msg: String,
}

// ——————————————————————————————————————————————
// 未迁移能力的统一错误文案
// ——————————————————————————————————————————————

/// Excel 模板下载 / 批量导入 / 错误数据回传 / 调拨导出：Rust 侧尚未迁移。
///
/// 原 Java 用 `ExcelUtils` + `@ResponseExcel` 直接写 `HttpServletResponse`
/// 二进制流；Rust 侧既无该工具类，响应也需要完全不同的实现方式，
/// 因此这 8 个端点统一返回明确业务错误（路由已注册，前端能得到可读提示，
/// 而不是 404 或伪造的空数据）。
pub const EXCEL_UNMIGRATED_MSG: &str =
    "Excel 模板下载/批量导入/导出功能尚未迁移到 Rust 侧，请使用结构化 JSON 接口";

// ——————————————————————————————————————————————
// 枚举常量（逐条对照原 Java enum）
// ——————————————————————————————————————————————

/// 商品类型（Java `ProductType`）。
pub mod product_type {
    /// 实物商品
    pub const NORMAL: i32 = 1;
    /// 虚拟商品
    pub const VIRTUAL: i32 = 2;
    /// 卡密商品
    pub const CARD: i32 = 3;
    /// 付费内容
    pub const PAID: i32 = 4;
    /// 预约上门（Java `PRODUCT_TYPE_RESERVATION_STORE`，枚举名与描述不一致，此处按 code 5）
    pub const RESERVATION_STORE: i32 = 5;
    /// 预约到店（Java `PRODUCT_TYPE_RESERVATION_HOME`，按 code 6）
    pub const RESERVATION_HOME: i32 = 6;

    /// 是否为预约类商品（Java `ProductType.isReservationProduct`）。
    #[must_use]
    pub fn is_reservation(code: Option<i32>) -> bool {
        matches!(code, Some(RESERVATION_STORE | RESERVATION_HOME))
    }
}

/// 出入库类型（Java `ProductStockRecordTypeEnum`）。
pub mod record_type {
    /// 出库（`in_or_out`）
    pub const OUT: i32 = 2;
    /// 入库（`in_or_out`）
    pub const IN: i32 = 1;
    /// 其他入库
    pub const OTHER_IN: i32 = 10;
    /// 采购入库
    pub const PURCHASE_IN: i32 = 11;
    /// 退货入库
    pub const RETURN_IN: i32 = 12;
    /// 调拨入库
    pub const ALLOCATE_IN: i32 = 13;
    /// 过期出库
    pub const EXPIRED_OUT: i32 = 21;
    /// 订单出库
    pub const ORDER_OUT: i32 = 22;
    /// 其他出库
    pub const OTHER_OUT: i32 = 23;
    /// 调拨出库
    pub const ALLOCATE_OUT: i32 = 24;
    /// 采购退货出库
    pub const PURCHASE_RETURN_OUT: i32 = 25;

    /// 类型名（Java `ProductStockRecordTypeEnum.getNameByCode`，未知返回 `None`）。
    #[must_use]
    pub fn name_of(code: i32) -> Option<&'static str> {
        match code {
            OUT => Some("出库"),
            EXPIRED_OUT => Some("过期出库"),
            ORDER_OUT => Some("订单出库"),
            OTHER_OUT => Some("其他出库"),
            ALLOCATE_OUT => Some("调拨出库"),
            PURCHASE_RETURN_OUT => Some("采购退货出库"),
            IN => Some("入库"),
            PURCHASE_IN => Some("采购入库"),
            RETURN_IN => Some("退货入库"),
            ALLOCATE_IN => Some("调拨入库"),
            OTHER_IN => Some("其他入库"),
            _ => None,
        }
    }
}

/// 调拨单状态（Java `ProductStockAllocateStateEnum`）。
pub mod allocate_status {
    /// 待审核
    pub const AUDIT_WAIT: i32 = 1;
    /// 待调出
    pub const STOCK_OUT_WAIT: i32 = 2;
    /// 待调入
    pub const STOCK_IN_WAIT: i32 = 3;
    /// 已完成
    pub const COMPLETE: i32 = 4;
    /// 已驳回
    pub const AUDIT_REJECT: i32 = 5;
    /// 已作废
    pub const CANCEL: i32 = 6;

    /// 状态文案（Java `ProductStockAllocateStateEnum.getNameByCode`，未知返回 `None`）。
    #[must_use]
    pub fn name_of(code: i32) -> Option<&'static str> {
        match code {
            AUDIT_WAIT => Some("待审核"),
            STOCK_OUT_WAIT => Some("待调出"),
            STOCK_IN_WAIT => Some("待调入"),
            COMPLETE => Some("已完成"),
            AUDIT_REJECT => Some("已驳回"),
            CANCEL => Some("已作废"),
            _ => None,
        }
    }

    /// 是否允许作废：Java `cancelAllocate` 的判定
    /// `status <= STOCK_OUT_WAIT || status == AUDIT_REJECT`。
    #[must_use]
    pub fn can_cancel(code: i32) -> bool {
        code <= STOCK_OUT_WAIT || code == AUDIT_REJECT
    }
}

/// 调拨操作类型（Java `ProductStockAllocateOperationEnum`，DB 存 name 文本）。
pub mod allocate_operation {
    /// 提交审核
    pub const ALLOCATE_SUBMIT: &str = "提交审核";
    /// 调拨作废
    pub const ALLOCATE_CANCEL: &str = "调拨作废";
    /// 审核通过
    pub const AUDIT_PASS: &str = "审核通过";
    /// 审核驳回
    pub const AUDIT_REJECT: &str = "审核驳回";
    /// 调拨出库
    pub const OUT_SUBMIT: &str = "调拨出库";
    /// 调拨入库
    pub const IN_SUBMIT: &str = "调拨入库";
}

/// 店铺类型「门店」（Java `ShopTypeEnum.STORE`）。
pub const SHOP_TYPE_STORE: i32 = 2;

// ——————————————————————————————————————————————
// 查询参数（GET，对应 Java DTO）
// ——————————————————————————————————————————————

/// `/adminapi/product/stock/page` 查询参数（Java `ProductStockDTO`）。
///
/// `shopId` / `targetShopId` 在 Java 中同时服务于分页与调拨选品：
/// - `page`：`shopId` 为空时用请求头 `x-shop-id` 兜底；
/// - `getAllocateProductStockPage`：`shopId` 为出库组织、`targetShopId` 为入库组织，
///   两者都必填。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockPageQuery {
    /// 库存编码
    pub stock_code: Option<String>,
    /// 类型（1=入库，2=出库）
    pub in_or_out: Option<i32>,
    /// 10/11/12=入库，21/22/23=出库
    pub r#type: Option<i32>,
    /// 开始时间 `yyyy-MM-dd`
    pub begin_time: Option<String>,
    /// 结束时间 `yyyy-MM-dd`
    pub end_time: Option<String>,
    /// 出库组织 ID
    pub shop_id: Option<i32>,
    /// 入库组织 ID
    pub target_shop_id: Option<i32>,
    /// 商品类型
    pub product_type: Option<i32>,
    /// 库存搜索（原 Java 未在库存查询中使用，仅透传）
    pub stock_search: Option<i32>,
    /// 页码（缺省 1）
    pub page: Option<u64>,
    /// 每页条数（缺省 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（原 Java 未使用，保留以兼容前端）
    pub sort_field: Option<String>,
    /// 排序方向（原 Java 未使用）
    pub sort_order: Option<String>,
    /// 关键词（来自 Java `BasePage`）
    pub keyword: Option<String>,
}

impl StockPageQuery {
    /// 统一的 `PageQuery`（缺省 page=1 / size=15，与 Java `BasePage` 一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(15),
        }
    }
}

/// `/adminapi/product/stock/stockDetail` 查询参数（Java `ProductStockDetailDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockDetailQuery {
    /// 商品 ID
    pub product_id: Option<i32>,
    /// SKU ID（为空时 Java 按 `spec_id = 0` 过滤）
    pub sku_id: Option<i32>,
    /// 页码
    pub page: Option<u64>,
    /// 每页条数
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
}

impl StockDetailQuery {
    /// 统一的 `PageQuery`。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(15),
        }
    }
}

/// `/adminapi/product/stock/record/page` 查询参数（Java `ProductStockDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockRecordPageQuery {
    /// 库存编码
    pub stock_code: Option<String>,
    /// 1=入库 / 2=出库
    pub in_or_out: Option<i32>,
    /// 类型（10/11/12 入库，21/22/23 出库）
    pub r#type: Option<i32>,
    /// 开始时间 `yyyy-MM-dd`
    pub begin_time: Option<String>,
    /// 结束时间 `yyyy-MM-dd`
    pub end_time: Option<String>,
    /// 出库组织；Java 中该端点在服务层被请求头 `x-shop-id` 覆盖
    pub shop_id: Option<i32>,
    /// 页码
    pub page: Option<u64>,
    /// 每页条数
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 关键词（库存编码 / 商品名 / 商品编码 / 规格值）
    pub keyword: Option<String>,
}

impl StockRecordPageQuery {
    /// 统一的 `PageQuery`。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(15),
        }
    }
}

/// `/adminapi/product/stock/adjustDetail` 查询参数
/// （Java `adjustDetail(@RequestParam productId, @RequestParam(required=false) skuId)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdjustDetailQuery {
    /// 商品 ID
    pub product_id: i32,
    /// SKU ID（可选）
    pub sku_id: Option<i32>,
}

/// `/adminapi/product/stock/productStockAllocateRecordPage` 查询参数
/// （Java `ProductStockAllocateRecordDTO`）。
///
/// 注意：Java 该 DTO 里没有 `keyword` 字段，但 Mapper XML 用了
/// `productStockAllocateRecordDTO.keyword`（继承自 `BasePage`），故此处保留。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocatePageQuery {
    /// 出库组织
    pub outbound_organization_id: Option<i32>,
    /// 入库组织
    pub warehousing_organization_id: Option<i32>,
    /// 经手人
    pub add_by: Option<String>,
    /// 店铺 ID（Java 服务层用请求头 `x-shop-id` 覆盖）
    pub shop_id: Option<i32>,
    /// 调拨单状态
    pub status: Option<i32>,
    /// 页码
    pub page: Option<u64>,
    /// 每页条数
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 关键词（调拨单号模糊匹配）
    pub keyword: Option<String>,
}

impl AllocatePageQuery {
    /// 统一的 `PageQuery`。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(15),
        }
    }
}

// ——————————————————————————————————————————————
// 请求体（POST，对应 Java DTO）
// ——————————————————————————————————————————————

/// `/adminapi/product/stock/stockIn` 与 `/stockOut` 请求体（Java `ProductStockInDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockInDTO {
    /// 出入库类型（10/11/12 入库，21/22/23 出库）
    pub r#type: Option<i32>,
    /// 备注
    pub comment: Option<String>,
    /// 明细行（Java `List<ProductStockRecordDetail>`）
    pub product_stock_record_detail_list: Vec<StockRecordDetailItem>,
    /// 商品总数（Java 字段，服务端未使用）
    pub product_total: Option<i32>,
}

/// 出入库明细行（Java `ProductStockRecordDetail`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockRecordDetailItem {
    /// 明细 ID（新增时忽略，兼容前端回传）
    pub record_detail_id: Option<i32>,
    /// 出入库记录 ID（新增时忽略，由服务端回填）
    pub stock_record_id: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// SKU ID（无规格商品为 null/0）
    pub sku_id: Option<i32>,
    /// 数量（必须 > 0）
    pub quantity: Option<i32>,
}

/// `/adminapi/product/stock/stockAdjust` 请求体
/// （Java `ProductStockAdjustDTO extends ProductStockAdjustRecord`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockAdjustDTO {
    /// 商品 ID
    pub product_id: Option<i32>,
    /// SKU ID（无规格商品为 null）
    pub sku_id: Option<i32>,
    /// 调整类型：1=增量，0=覆盖
    pub adjust_type: Option<i32>,
    /// 调整数量
    pub quantity: Option<i32>,
    /// 操作人（Java 忽略请求体，取当前登录用户）
    pub add_by: Option<String>,
    /// 创建时间（Java 忽略请求体）
    pub add_time: Option<i64>,
    /// 店铺 ID（Java 忽略请求体，取请求头）
    pub shop_id: Option<i32>,
    /// 调整前数量（Java 忽略请求体）
    pub change_before_quantity: Option<i32>,
    /// 调整后数量（Java 忽略请求体）
    pub change_after_quantity: Option<i32>,
}

/// `/adminapi/product/stock/createAllocate` 请求体
/// （Java `ProductStockAllocateRecordCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateAllocateDTO {
    /// 出库组织
    pub outbound_organization_id: Option<i32>,
    /// 入库组织
    pub warehousing_organization_id: Option<i32>,
    /// 出库备注（Java 落库到 `stock_allocate_comment`）
    pub comment: Option<String>,
    /// 调拨商品明细
    pub product_stock_allocate_record_detail_list: Vec<AllocateDetailItem>,
}

/// 调拨明细行（Java `ProductStockAllocateRecordDetail`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateDetailItem {
    /// 明细 ID
    pub allocate_detail_id: Option<i32>,
    /// 调拨单 ID
    pub allocate_id: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// 调拨数量
    pub quantity: Option<i32>,
    /// 实际入库数量
    pub stock_in_quantity: Option<i32>,
    /// 实际出库数量
    pub stock_out_quantity: Option<i32>,
}

/// `/auditAllocate` 查询参数（Java `@RequestParam id / auditType / remark`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AuditAllocateQuery {
    /// 调拨单 ID
    pub id: i32,
    /// 审核类型：2=通过（待调出）、5=驳回
    pub audit_type: i32,
    /// 备注 / 驳回原因
    pub remark: Option<String>,
}

/// `/cancelAllocate` 请求体（Java `@RequestBody List<Integer> allocateIds`）。
pub type CancelAllocateDTO = Vec<i32>;

/// `/stockOutAllocate` 与 `/stockInAllocate` 请求体（Java `AllocateStockOutDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateStockOutDTO {
    /// 调拨单 ID
    pub allocate_id: Option<i32>,
    /// 出库/入库备注
    pub comment: Option<String>,
    /// 明细（含实际出库/入库数量）
    pub stock_allocate_record_details: Vec<AllocateDetailItem>,
}

/// `/exportAllocate` 请求体（Java `ProductStockAllocateExcelExportDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AllocateExcelExportDTO {
    /// 调拨单 ID 列表
    pub allocate_ids: Option<Vec<i32>>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 响应 VO
// ——————————————————————————————————————————————

/// 库存分页行（Java `ProductStockPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockPageVO {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品 SKU 名称
    pub product_sku_name: Option<String>,
    /// 商品 SKU ID
    pub product_sku_id: Option<i32>,
    /// 商品单位
    pub product_unit: Option<String>,
    /// 当前库存（预约类商品为 null；卡密商品为可用卡券数）
    pub current_product_stock: Option<i32>,
    /// 商品成本
    pub product_cost: Option<Decimal>,
    /// 商品图片
    pub product_pic_thumb: String,
    /// 商品编码
    pub product_sn: String,
    /// 条形码
    pub product_tsn: Option<String>,
}

/// 出入库明细行（Java `ProductStockDetailVO`，来自 `product_inventory_log`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockDetailVO {
    /// 出入库类型描述
    pub desc: Option<String>,
    /// 商品名称
    pub product_name: String,
    /// 商品 SKU 名称（仅当查询指定了 skuId）
    pub product_sku_name: Option<String>,
    /// 变化数量
    pub quantity: Option<i32>,
    /// 商品图片
    pub product_pic_thumb: String,
    /// 1=增 2=减
    pub in_or_out: Option<i32>,
}

/// 出入库记录分页行（Java `ProductStockRecordVO`，不含明细）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockRecordVO {
    /// 主键
    pub product_stock_id: i32,
    /// 仓库编号
    pub stock_code: Option<String>,
    /// 类型
    pub r#type: Option<i32>,
    /// 经办人
    pub add_by: Option<String>,
    /// 备注
    pub comment: Option<String>,
    /// 创建时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 出入库明细（仅 `getRecordDetail` 返回）
    pub product_list: Option<Vec<ProductStockRecordDetailVO>>,
}

/// 出入库记录明细行（Java `ProductStockRecordDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockRecordDetailVO {
    /// 商品名称
    pub product_name: Option<String>,
    /// 商品 SKU 名称
    pub product_sku_name: Option<String>,
    /// 商品单位
    pub product_unit: Option<String>,
    /// 数量
    pub quantity: Option<i32>,
    /// 商品图片
    pub product_pic_thumb: Option<String>,
}

/// 库存调整记录（Java `ProductStockAdjustRecordDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockAdjustRecordDetailVO {
    /// 调整类型
    pub adjust_type: Option<i32>,
    /// 调整数量
    pub quantity: Option<i32>,
    /// 创建人
    pub add_by: Option<String>,
    /// 创建时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 调整前数量
    pub change_before_quantity: Option<i32>,
    /// 调整后数量
    pub change_after_quantity: Option<i32>,
}

/// 调拨单分页行（Java `ProductStockAllocateRecordPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockAllocateRecordPageVO {
    /// 调拨单 ID
    pub allocate_id: i32,
    /// 调拨单号
    pub allocate_code: Option<String>,
    /// 出库组织
    pub outbound_organization_id: Option<i32>,
    /// 入库组织
    pub warehousing_organization_id: Option<i32>,
    /// 单据状态
    pub status: Option<i32>,
    /// 经办人
    pub add_by: Option<String>,
    /// 创建时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 调拨备注
    pub comment: Option<String>,
    /// 入库备注
    pub stock_in_comment: Option<String>,
    /// 出库备注
    pub stock_out_comment: Option<String>,
    /// 出库组织名称
    pub outbound_organization_name: Option<String>,
    /// 入库组织名称
    pub warehousing_organization_name: Option<String>,
    /// 当前登录组织是否为入库方且单据待审核
    pub is_can_audit: bool,
}

/// 调拨单详情（Java `ProductStockAllocateRecordDetailVO`，
/// 只包一层 `productAllocateDetailVOList`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockAllocateRecordDetailVO {
    /// 调拨商品明细
    pub product_allocate_detail_vo_list: Vec<ProductAllocateDetailVO>,
}

/// 调拨商品明细行（Java `ProductAllocateDetailVO extends ProductStockAllocateRecordDetail`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductAllocateDetailVO {
    /// 明细 ID
    pub allocate_detail_id: Option<i32>,
    /// 调拨单 ID
    pub allocate_id: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// 调拨数量
    pub quantity: Option<i32>,
    /// 实际入库数量
    pub stock_in_quantity: Option<i32>,
    /// 实际出库数量
    pub stock_out_quantity: Option<i32>,
    /// 商品名称
    pub product_name: Option<String>,
    /// SKU 名称
    pub sku_name: Option<String>,
    /// 商品单位
    pub product_unit: Option<String>,
    /// 商品图片
    pub product_pic_thumb: Option<String>,
}

/// 调拨操作记录行（Java `ProductStockAllocateOperationRecordVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductStockAllocateOperationRecordVO {
    /// 操作类型
    pub operation_type: Option<String>,
    /// 操作时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 操作人
    pub add_by: Option<String>,
    /// 审核驳回原因
    pub review_rejected_reason: Option<String>,
}

/// 调拨组织项（Java `AllocateOrgVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AllocateOrgVO {
    /// 组织 ID（0=平台）
    pub shop_id: i32,
    /// 组织名称
    pub shop_name: String,
}

// ——————————————————————————————————————————————
// 仓储内部的行结构（避免服务层直接拼 SQL）
// ——————————————————————————————————————————————

/// 库存分页查询的原始行（对应 `ProductSkuMapper.getProductStockPage`）。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct StockPageRow {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品总库存
    pub product_stock: i32,
    /// 商品单位
    pub product_unit: Option<String>,
    /// 商品缩略图
    pub product_pic_thumb: String,
    /// 商品编码
    pub product_sn: String,
    /// 商品条形码
    pub product_tsn: Option<String>,
    /// 商品类型
    pub product_type: Option<i32>,
    /// 商品成本价
    pub product_cost: Option<Decimal>,
    /// 关联卡券分组
    pub card_group_id: i32,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// SKU 规格值
    pub product_sku_name: Option<String>,
    /// SKU 库存
    pub product_sku_stock: Option<i32>,
    /// SKU 成本价
    pub product_sku_cost: Option<Decimal>,
}

/// 调拨操作记录行（需要 `tigshop_core` 实体之外的字段，故单独定义）。
pub type AllocateOperationRow = ProductStockAllocateOperationRecord;

/// 导出用调拨单行（`exportAllocate` 的服务层输入）。
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct AllocateExportRow {
    /// 调拨单号
    pub allocate_code: Option<String>,
    /// 出库组织
    pub outbound_organization_id: Option<i32>,
    /// 入库组织
    pub warehousing_organization_id: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    /// 经办人
    pub add_by: Option<String>,
    /// 创建时间（秒）
    pub add_time: Option<i64>,
}

/// 库存调整记录分页/列表查询的返回项（复用实体）。
pub type StockAdjustRecordRow = ProductStockAdjustRecord;

/// 出入库记录（复用实体）。
pub type StockRecordRow = ProductStockRecord;

/// 出入库明细（复用实体）。
pub type StockRecordDetailRow = ProductStockRecordDetail;

/// 调拨单（复用实体）。
pub type AllocateRecordRow = ProductStockAllocateRecord;

/// 调拨明细（复用实体）。
pub type AllocateDetailRow = ProductStockAllocateRecordDetail;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stock_page_query_parses_java_dto_fields() {
        let q: StockPageQuery = serde_json::from_str(
            r#"{"stockCode":"SC1","inOrOut":1,"type":11,"beginTime":"2026-01-01",
                "endTime":"2026-01-31","shopId":3,"targetShopId":0,"productType":1,
                "stockSearch":2,"page":2,"size":30,"keyword":"手机"}"#,
        )
        .unwrap();
        assert_eq!(q.stock_code.as_deref(), Some("SC1"));
        assert_eq!(q.in_or_out, Some(1));
        assert_eq!(q.r#type, Some(11));
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.target_shop_id, Some(0));
        assert_eq!(q.product_type, Some(1));
        assert_eq!(q.stock_search, Some(2));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.keyword.as_deref(), Some("手机"));
        // Java `BasePage` 缺省 page=1 / size=15
        let default = StockPageQuery::default();
        assert_eq!(default.page_query().page, 1);
        assert_eq!(default.page_query().page_size, 15);
    }

    #[test]
    fn stock_in_dto_parses_detail_list() {
        let d: StockInDTO = serde_json::from_str(
            r#"{"type":11,"comment":"采购","productTotal":2,
                "productStockRecordDetailList":[
                    {"productId":1,"skuId":10,"quantity":5},
                    {"productId":2,"quantity":3}]}"#,
        )
        .unwrap();
        assert_eq!(d.r#type, Some(11));
        assert_eq!(d.product_total, Some(2));
        assert_eq!(d.product_stock_record_detail_list.len(), 2);
        assert_eq!(d.product_stock_record_detail_list[0].sku_id, Some(10));
        assert_eq!(d.product_stock_record_detail_list[1].quantity, Some(3));
    }

    #[test]
    fn stock_adjust_dto_matches_java_record_fields() {
        let d: StockAdjustDTO = serde_json::from_str(
            r#"{"productId":7,"skuId":9,"adjustType":0,"quantity":42,"changeBeforeQuantity":10}"#,
        )
        .unwrap();
        assert_eq!(d.product_id, Some(7));
        assert_eq!(d.sku_id, Some(9));
        assert_eq!(d.adjust_type, Some(0));
        assert_eq!(d.quantity, Some(42));
        assert_eq!(d.change_before_quantity, Some(10));
    }

    #[test]
    fn create_allocate_dto_parses_details() {
        let d: CreateAllocateDTO = serde_json::from_str(
            r#"{"outboundOrganizationId":0,"warehousingOrganizationId":2,"comment":"调拨",
                "productStockAllocateRecordDetailList":[
                    {"productId":1,"skuId":10,"quantity":5}]}"#,
        )
        .unwrap();
        assert_eq!(d.outbound_organization_id, Some(0));
        assert_eq!(d.warehousing_organization_id, Some(2));
        assert_eq!(d.product_stock_allocate_record_detail_list.len(), 1);
        assert_eq!(
            d.product_stock_allocate_record_detail_list[0].quantity,
            Some(5)
        );
    }

    #[test]
    fn audit_query_and_cancel_body_match_java_params() {
        let q: AuditAllocateQuery =
            serde_json::from_str(r#"{"id":3,"auditType":2,"remark":"ok"}"#).unwrap();
        assert_eq!(q.id, 3);
        assert_eq!(q.audit_type, 2);
        assert_eq!(q.remark.as_deref(), Some("ok"));

        // Java `@RequestBody List<Integer>`
        let body: CancelAllocateDTO = serde_json::from_str("[1,2,3]").unwrap();
        assert_eq!(body, vec![1, 2, 3]);
    }

    #[test]
    fn allocate_stock_out_dto_parses_actual_quantities() {
        let d: AllocateStockOutDTO = serde_json::from_str(
            r#"{"allocateId":5,"comment":"出库",
                "stockAllocateRecordDetails":[
                    {"allocateDetailId":1,"productId":1,"skuId":2,
                     "stockOutQuantity":4,"stockInQuantity":3}]}"#,
        )
        .unwrap();
        assert_eq!(d.allocate_id, Some(5));
        assert_eq!(d.stock_allocate_record_details.len(), 1);
        assert_eq!(
            d.stock_allocate_record_details[0].stock_out_quantity,
            Some(4)
        );
        assert_eq!(
            d.stock_allocate_record_details[0].stock_in_quantity,
            Some(3)
        );
    }

    #[test]
    fn page_vo_serializes_camel_case() {
        let vo = ProductStockPageVO {
            product_id: 1,
            product_name: "手机".into(),
            product_sn: "SN1".into(),
            product_pic_thumb: "a.png".into(),
            current_product_stock: Some(9),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["productId"], 1);
        assert_eq!(v["productSkuName"], serde_json::Value::Null);
        assert_eq!(v["currentProductStock"], 9);
        assert!(v.get("product_id").is_none());
    }

    #[test]
    fn enum_constants_match_java() {
        assert_eq!(product_type::CARD, 3);
        assert!(product_type::is_reservation(Some(5)));
        assert!(product_type::is_reservation(Some(6)));
        assert!(!product_type::is_reservation(Some(1)));
        assert!(!product_type::is_reservation(None));

        assert_eq!(record_type::name_of(13), Some("调拨入库"));
        assert_eq!(record_type::name_of(24), Some("调拨出库"));
        assert_eq!(record_type::name_of(99), None);

        assert_eq!(allocate_status::name_of(3), Some("待调入"));
        assert_eq!(allocate_status::name_of(99), None);
        // Java `cancelAllocate`：status <= 2 或 == 5 可作废
        assert!(allocate_status::can_cancel(1));
        assert!(allocate_status::can_cancel(2));
        assert!(!allocate_status::can_cancel(3));
        assert!(!allocate_status::can_cancel(4));
        assert!(allocate_status::can_cancel(5));
        assert!(!allocate_status::can_cancel(6));
    }

    #[test]
    fn record_type_and_allocate_vo_serialize_camel_case() {
        let vo = ProductStockRecordVO {
            product_stock_id: 3,
            r#type: Some(11),
            add_time: "2026-01-01 00:00:00".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["productStockId"], 3);
        assert_eq!(v["type"], 11);
        assert_eq!(v["addTime"], "2026-01-01 00:00:00");

        let row = ProductStockAllocateRecordPageVO {
            allocate_id: 1,
            ..Default::default()
        };
        let v = serde_json::to_value(&row).unwrap();
        assert_eq!(v["isCanAudit"], false);
        assert_eq!(v["outboundOrganizationName"], serde_json::Value::Null);
    }
}
