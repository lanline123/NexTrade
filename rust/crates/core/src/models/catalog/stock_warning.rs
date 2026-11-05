//! 库存预警域（catalog::stock_warning）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.product.StockWarningListDTO` / `StockWarningExportDTO`
//!   / `StockWarningSaveDTO` / `StockWarningBatchSaveDTO` /
//!   `StockWarningSettingSaveDTO`
//! - `com.tigshop.bean.vo.product.StockWarningSettingVO` / `StockWarningPageVO` /
//!   `StockWarningRowVO` / `StockWarningExcelVO` / `StockWarningBatchResultVO` /
//!   `StockWarningImportResultVO` / `StockWarningImportErrorExcelVO` /
//!   `StockWarningImportExcelVO` / `StockWarningSnTargetVO`
//! - 枚举 `StockWarningStatusEnum`（0/1/2/3/9）与 `StockWarningOwnerTypeEnum`
//!   （1 自营 / 2 店铺 / 3 门店）
//!
//! JSON 字段全部保持 camelCase，与原接口一致。

use serde::{Deserialize, Serialize};

/// 未配置规则的商品/SKU 沿用升级前的固定阈值
/// （Java `StockWarningServiceImpl.DEFAULT_LOWER_LIMIT = 100`）。
pub const DEFAULT_LOWER_LIMIT: i32 = 100;

/// 预警开关：开启（Java `ENABLED`）。
pub const ENABLED: i32 = 1;

/// 预警开关：关闭（Java `DISABLED`）。
pub const DISABLED: i32 = 0;

/// 库存状态（对应 Java `StockWarningStatusEnum`，数值逐一对应）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StockWarningStatus {
    /// 正常库存
    Normal = 0,
    /// 低库存
    Low = 1,
    /// 高库存
    High = 2,
    /// 无货
    OutOfStock = 3,
    /// 未配置有效规则；仅用于列表展示与筛选，不作为已发送状态落库
    Unconfigured = 9,
}

impl StockWarningStatus {
    /// 状态码（落库值 / 接口值）。
    #[must_use]
    pub fn code(self) -> i32 {
        self as i32
    }

    /// 状态名（对应 Java `StockWarningStatusEnum.getName`）。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Normal => "正常库存",
            Self::Low => "低库存",
            Self::High => "高库存",
            Self::OutOfStock => "无货",
            Self::Unconfigured => "未配置",
        }
    }

    /// 按状态码解析（对应 Java `StockWarningStatusEnum.getNameByCode`：未知返回 `None`）。
    #[must_use]
    pub fn of(code: i32) -> Option<Self> {
        match code {
            0 => Some(Self::Normal),
            1 => Some(Self::Low),
            2 => Some(Self::High),
            3 => Some(Self::OutOfStock),
            9 => Some(Self::Unconfigured),
            _ => None,
        }
    }

    /// 状态码 → 状态名（未知返回 `None`，与 Java 的 `orElse(null)` 一致）。
    #[must_use]
    pub fn name_of(code: Option<i32>) -> Option<&'static str> {
        code.and_then(Self::of).map(Self::name)
    }
}

/// 库存预警列表的归属主体类型（对应 Java `StockWarningOwnerTypeEnum`）。
///
/// 自营不是 `shop` 表记录，而是约定 `shopId = 0` 的虚拟主体；
/// 店铺与门店由 `shop.shop_type` 区分（自提点与门店同属线下主体，一并按门店展示）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StockWarningOwnerType {
    /// 自营
    SelfOperated = 1,
    /// 店铺
    Shop = 2,
    /// 门店
    Store = 3,
}

impl StockWarningOwnerType {
    /// 主体类型码。
    #[must_use]
    pub fn code(self) -> i32 {
        self as i32
    }

    /// 主体类型名。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::SelfOperated => "自营",
            Self::Shop => "店铺",
            Self::Store => "门店",
        }
    }
}

// ————————————————————————————— 总开关 —————————————————————————————

/// 库存预警通知总开关（对应 Java `StockWarningSettingVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningSettingVO {
    /// 归属主体ID：0=平台自营
    pub shop_id: i32,
    /// 通知总开关：0=关闭，1=开启
    pub notify_enabled: i32,
    /// 未配置商品/SKU 使用的默认库存下限
    pub default_lower_limit: i32,
}

/// 保存库存预警通知总开关（对应 Java `StockWarningSettingSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockWarningSettingSaveDTO {
    /// 归属主体：0=平台自营，>0=店铺或门店；店铺/门店固定为自身
    pub shop_id: Option<i32>,
    /// 通知总开关：0=关闭，1=开启（Java `@NotNull`，服务层校验）
    pub notify_enabled: Option<i32>,
}

// ————————————————————————————— 列表查询 —————————————————————————————

/// 库存预警列表查询参数（对应 Java `StockWarningListDTO extends BasePage`）。
///
/// `useStoreStock` / `useTotalStock` / `targets` 在 Java 中由服务层内部填充
/// （`@Schema(hidden = true)`），不接受外部传入，故此处不暴露为查询字段。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockWarningListQuery {
    /// 当前页码（Java `BasePage.getPage`：缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.getSize`：缺省 15，上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段：currentStock/physicalStock/productStock（实物库存）、
    /// transitStock（在途库存）、lowerLimit（库存下限）、upperLimit（库存上限）；
    /// 非法值回退商品ID倒序
    pub sort_field: Option<String>,
    /// 排序方向：asc 升序，其他值按 desc 降序
    pub sort_order: Option<String>,
    /// 关键词（商品名称 / 商品编码 / SKU编码 模糊匹配）
    pub keyword: Option<String>,
    /// 归属主体：0=平台自营，>0=店铺或门店；平台可指定，店铺/门店强制为自身
    pub shop_id: Option<i32>,
    /// 库存状态筛选：不传=全部，0=正常库存，1=低库存，2=高库存，3=无货，9=未配置
    pub stock_status: Option<i32>,
    /// 预警开关筛选：不传=全部，0=已关闭，1=已开启
    pub warn_enabled: Option<i32>,
    /// 商品类型
    pub product_type: Option<i32>,
}

impl StockWarningListQuery {
    /// 转通用分页参数。
    ///
    /// 忠实对齐 Java `BasePage`：`page` 缺省 1，`size` 缺省 15 且上限 100
    /// （注意与 [`crate::types::PageQuery`] 的 200 上限不同，
    /// 故这里先行截断）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.size.unwrap_or(15).min(100),
        }
    }
}

/// 导出库存预警列表参数（对应 Java `StockWarningExportDTO extends StockWarningListDTO`）。
///
/// 只按勾选行取数：不沿用页面的筛选条件，导出结果与勾选项严格一一对应，
/// 故这里只保留 `ids` 与 `shopId`（Java 同名 DTO 的其余字段在导出链路中不被读取）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockWarningExportQuery {
    /// 勾选行标识，逗号分隔，每项为 `productId_skuId`，例：`1001_0,1002_55`
    /// （Java `@NotBlank`，服务层校验）
    pub ids: Option<String>,
    /// 归属主体：0=平台自营，>0=店铺或门店
    pub shop_id: Option<i32>,
}

// ————————————————————————————— 规则保存 —————————————————————————————

/// 商品/SKU 行标识（对应 Java `StockWarningListDTO.Target` /
/// `StockWarningBatchSaveDTO.Target`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningTarget {
    /// 商品ID
    pub product_id: Option<i32>,
    /// SKU ID；0 或不传表示单规格商品
    pub sku_id: Option<i32>,
}

/// 设置单个商品/SKU 库存预警（对应 Java `StockWarningSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockWarningSaveDTO {
    /// 归属主体：0=平台自营，>0=店铺或门店
    pub shop_id: Option<i32>,
    /// 商品ID（Java `@NotNull`）
    pub product_id: Option<i32>,
    /// SKU ID；0 或不传表示单规格商品
    pub sku_id: Option<i32>,
    /// 预警开关：0=关闭，1=开启（Java `@NotNull`）
    pub warn_enabled: Option<i32>,
    /// 库存下限（Java `@NotNull @Min(0)`）
    pub lower_limit: Option<i32>,
    /// 库存上限（Java `@NotNull @Min(0)`）
    pub upper_limit: Option<i32>,
}

/// 批量设置商品/SKU 库存预警（对应 Java `StockWarningBatchSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StockWarningBatchSaveDTO {
    /// 归属主体：0=平台自营，>0=店铺或门店
    pub shop_id: Option<i32>,
    /// 待设置的商品/SKU 列表（Java `@NotEmpty`）
    pub targets: Option<Vec<StockWarningTarget>>,
    /// 预警开关：0=关闭，1=开启（Java `@NotNull`）
    pub warn_enabled: Option<i32>,
    /// 库存下限（Java `@NotNull @Min(0)`）
    pub lower_limit: Option<i32>,
    /// 库存上限（Java `@NotNull @Min(0)`）
    pub upper_limit: Option<i32>,
}

/// 批量设置失败项（对应 Java `StockWarningBatchResultVO.FailItem`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningFailItem {
    /// 商品ID
    pub product_id: Option<i32>,
    /// SKU ID
    pub sku_id: Option<i32>,
    /// 失败原因
    pub reason: Option<String>,
}

/// 库存预警批量设置结果（对应 Java `StockWarningBatchResultVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningBatchResultVO {
    /// 成功数量
    pub success_count: i32,
    /// 失败数量
    pub fail_count: i32,
    /// 失败明细
    pub fail_items: Vec<StockWarningFailItem>,
}

impl StockWarningBatchResultVO {
    /// 记一次成功（对应 Java `addSuccess`）。
    pub fn add_success(&mut self) {
        self.success_count += 1;
    }

    /// 记一次失败（对应 Java `addFail`）。
    pub fn add_fail(&mut self, product_id: Option<i32>, sku_id: Option<i32>, reason: String) {
        self.fail_items.push(StockWarningFailItem {
            product_id,
            sku_id,
            reason: Some(reason),
        });
        self.fail_count += 1;
    }
}

// ————————————————————————————— 列表 / 导出行 —————————————————————————————

/// 库存预警列表项（对应 Java `StockWarningPageVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningPageVO {
    /// 商品ID
    pub product_id: i32,
    /// SKU ID；0=单规格商品
    pub sku_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 规格
    pub product_sku_name: String,
    /// 商品图片
    pub product_pic_thumb: String,
    /// 商品编码
    pub product_sn: Option<String>,
    /// SKU编码
    pub sku_sn: Option<String>,
    /// 条形码
    pub product_tsn: Option<String>,
    /// 归属主体ID：0=平台自营
    pub shop_id: i32,
    /// 归属主体名称（自营门店名 / 店铺名 / 门店名）
    pub shop_name: String,
    /// 归属主体类型：1=自营，2=店铺，3=门店
    pub owner_type: i32,
    /// 归属主体类型名称
    pub owner_type_name: String,
    /// 当前库存（按主体口径）
    pub current_stock: i32,
    /// 在途库存（采购库存）：采购单已下单未入库的数量，无采购单时为 0
    pub transit_stock: i32,
    /// 库存下限；未配置时为空
    pub lower_limit: Option<i32>,
    /// 库存上限；未配置时为空
    pub upper_limit: Option<i32>,
    /// 库存状态：0=正常库存，1=低库存，2=高库存，3=无货，9=未配置
    pub stock_status: Option<i32>,
    /// 库存状态名称
    pub stock_status_name: Option<String>,
    /// 预警开关：0=关闭，1=开启；未配置时为空
    pub warn_enabled: Option<i32>,
    /// 规则更新时间
    pub update_time: Option<i64>,
    /// 相关商品ID列表，供跳转商品列表时作为 ids 参数使用
    pub related_product_ids: Vec<i32>,
    /// 相关商品数量
    pub related_product_count: i32,
}

/// 库存预警导出行（对应 Java `StockWarningExcelVO`）。
///
/// Java 经 `@ResponseExcel` 序列化为 xlsx；Rust 侧 xlsx 写出依赖未迁移，
/// 由路由以 JSON 数组返回同样的行数据（见 `routes::crate::models::catalog::stock_warning::stock_warning_export`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningExcelVO {
    /// 商品名称
    pub product_name: String,
    /// 规格
    pub product_sku_name: String,
    /// 商品编码
    pub product_sn: Option<String>,
    /// SKU编码
    pub sku_sn: Option<String>,
    /// 仓库
    pub shop_name: String,
    /// 实时库存
    pub current_stock: i32,
    /// 在途库存
    pub transit_stock: i32,
    /// 库存下限（未配置时为占位符 `--`，与页面展示一致）
    pub lower_limit: String,
    /// 库存上限（未配置时为占位符 `--`）
    pub upper_limit: String,
    /// 库存状态
    pub stock_status_name: Option<String>,
    /// 库存预警（未配置 / 开启 / 关闭）
    pub warn_enabled_name: String,
    /// 相关商品数
    pub related_product_count: i32,
}

// ————————————————————————————— 导入 —————————————————————————————

/// 库存预警导入行（对应 Java `StockWarningImportExcelVO`）。
///
/// 同时用于生成导入模板：列为 商品编码 / SKU编码 / 下限 / 上限。
/// 上下限用字符串接收，填了非数字才能落到失败明细而不是整表读取失败。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningImportRow {
    /// 商品编码，可留空；商品编码和SKU编码至少填写一个
    pub product_sn: Option<String>,
    /// SKU编码，多规格必填，单规格可留空；供应商按SKU编码导入
    pub sku_sn: Option<String>,
    /// 库存下限
    pub lower_limit: Option<String>,
    /// 库存上限
    pub upper_limit: Option<String>,
}

/// 导入失败项（对应 Java `StockWarningImportResultVO.FailItem`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningImportFailItem {
    /// Excel 行号（含表头）
    pub row_number: i32,
    /// 该行填写的商品编码
    pub product_sn: Option<String>,
    /// 该行填写的SKU编码
    pub sku_sn: Option<String>,
    /// 失败原因
    pub reason: Option<String>,
}

/// 库存预警导入结果（对应 Java `StockWarningImportResultVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningImportResultVO {
    /// 读取到的有效数据行数
    pub total_count: i32,
    /// 成功数量
    pub success_count: i32,
    /// 失败数量
    pub fail_count: i32,
    /// 失败明细
    pub fail_items: Vec<StockWarningImportFailItem>,
}

impl StockWarningImportResultVO {
    /// 记一次成功（对应 Java `addSuccess`）。
    pub fn add_success(&mut self) {
        self.total_count += 1;
        self.success_count += 1;
    }

    /// 记一次失败（对应 Java `addFail`）。
    pub fn add_fail(
        &mut self,
        row_number: i32,
        product_sn: Option<String>,
        sku_sn: Option<String>,
        reason: String,
    ) {
        self.fail_items.push(StockWarningImportFailItem {
            row_number,
            product_sn,
            sku_sn,
            reason: Some(reason),
        });
        self.total_count += 1;
        self.fail_count += 1;
    }
}

/// 导入失败数据导出行（对应 Java `StockWarningImportErrorExcelVO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockWarningImportErrorRow {
    /// 商品编码
    pub product_sn: Option<String>,
    /// SKU编码
    pub sku_sn: Option<String>,
    /// 下限
    pub lower_limit: Option<String>,
    /// 上限
    pub upper_limit: Option<String>,
    /// 导入失败信息
    pub error_msg: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_codes_match_java_enum() {
        assert_eq!(StockWarningStatus::Normal.code(), 0);
        assert_eq!(StockWarningStatus::Low.code(), 1);
        assert_eq!(StockWarningStatus::High.code(), 2);
        assert_eq!(StockWarningStatus::OutOfStock.code(), 3);
        assert_eq!(StockWarningStatus::Unconfigured.code(), 9);
        assert_eq!(StockWarningStatus::name_of(Some(1)), Some("低库存"));
        assert_eq!(StockWarningStatus::name_of(Some(7)), None);
        assert_eq!(StockWarningStatus::name_of(None), None);
    }

    #[test]
    fn owner_type_codes_match_java_enum() {
        assert_eq!(StockWarningOwnerType::SelfOperated.code(), 1);
        assert_eq!(StockWarningOwnerType::Shop.code(), 2);
        assert_eq!(StockWarningOwnerType::Store.code(), 3);
        assert_eq!(StockWarningOwnerType::SelfOperated.name(), "自营");
    }

    #[test]
    fn list_query_defaults_follow_base_page() {
        let q = StockWarningListQuery::default();
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 15);

        let q = StockWarningListQuery {
            page: Some(3),
            size: Some(500),
            ..Default::default()
        };
        let page = q.page_query();
        assert_eq!(page.page, 3);
        // Java BasePage 上限 100（PageQuery 自身为 200）
        assert_eq!(page.page_size, 100);
        assert_eq!(page.limit_offset(), (100, 200));
    }

    #[test]
    fn batch_result_accumulators_match_java() {
        let mut r = StockWarningBatchResultVO::default();
        r.add_success();
        r.add_fail(Some(9), Some(0), "失败".into());
        assert_eq!(r.success_count, 1);
        assert_eq!(r.fail_count, 1);
        assert_eq!(r.fail_items.len(), 1);
        assert_eq!(r.fail_items[0].product_id, Some(9));

        let mut i = StockWarningImportResultVO::default();
        i.add_success();
        i.add_fail(2, Some("P1".into()), Some("S1".into()), "导入失败".into());
        assert_eq!(i.total_count, 2);
        assert_eq!(i.success_count, 1);
        assert_eq!(i.fail_count, 1);
        assert_eq!(i.fail_items[0].row_number, 2);
    }

    #[test]
    fn dto_json_uses_camel_case() {
        let vo = StockWarningSettingVO {
            shop_id: 3,
            notify_enabled: 1,
            default_lower_limit: DEFAULT_LOWER_LIMIT,
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["shopId"], 3);
        assert_eq!(v["notifyEnabled"], 1);
        assert_eq!(v["defaultLowerLimit"], 100);

        // 查询参数同时接受 size 与 pageSize
        let q: StockWarningListQuery =
            serde_json::from_value(serde_json::json!({"page": 2, "size": 30})).unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));
    }
}
