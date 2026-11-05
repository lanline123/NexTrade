//! 商品样式配置域（marketing::product_style_admin）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.product.ProductStyle`（表 `product_style`）
//! - `com.tigshop.bean.model.product.ProductStyleItem`（表 `product_style_item`）
//! - `com.tigshop.bean.query.product.ProductStylePageQuery extends BasePage`
//! - `com.tigshop.bean.param.product.ProductStyleSaveParam`
//! - `com.tigshop.bean.param.product.ProductStyleEditParam extends ProductStyleSaveParam`
//! - `com.tigshop.bean.param.product.ProductStyleItemBatchParam`
//! - `com.tigshop.bean.vo.product.ProductStyleVO` / `ProductStyleDetailVO`
//! - `com.tigshop.bean.vo.product.BrandProductCountVO`
//! - `com.tigshop.bean.enums.product.ProductStyleTypeEnum`
//! - `com.tigshop.bean.enums.product.ProductStyleActivityStatusEnum`
//! - `com.tigshop.bean.enums.product.ProductStyleItemTypeEnum`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.CheckFieldConstants.PRODUCT_STYLE_FIELDS`
//! - `com.tigshop.common.constant.ResultTextConstants.*`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder` / `keyword`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域唯一的金额列是 `ProductStyleDetailVO.ProductItemVO.product_price`
//! （Java `BigDecimal`），Rust 侧用 `rust_decimal::Decimal`，**禁止** f64/f32。
//!
//! ## 时间列
//!
//! `product_style.start_time` / `end_time` / `add_time` / `update_time` 都是
//! MySQL `int(10) unsigned`，实体侧 `i32`，而 Java 实体是 `Long`。
//! 秒级时间戳 `i32` 会在 2038 年溢出，但**库列就是 int(10)**，
//! 本实现按实体类型 `i32` 读写（见 `uncertain_points`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::{Brand, ProductStyle};
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java 枚举 / CheckFieldConstants / ResultTextConstants）
// ——————————————————————————————————————————————

/// `product_style` 真实存在的 12 个列
/// （`cd rust && python tools/schema_parser.py --table product_style`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const PRODUCT_STYLE_COLUMNS: [&str; 12] = [
    "style_id",
    "style_name",
    "style_type",
    "style_image",
    "pc_image",
    "start_time",
    "end_time",
    "status",
    "shop_id",
    "add_time",
    "update_time",
    "is_delete",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `style_id`）。
pub const KEY_COLUMN: &str = "style_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `styleId`）。
pub const KEY_PROPERTY: &str = "styleId";

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.PRODUCT_STYLE_FIELDS = {"style_name", "status",
/// "sort_order", "pc_image"}`）。
///
/// ⚠️ **`sort_order` 不是 `product_style` 的真实列**（见 [`PRODUCT_STYLE_COLUMNS`]）。
/// 这是 Java 原代码的一处缺陷：白名单里混进了不属于本表的列名，
/// 该分支一旦命中就会生成 `UPDATE product_style SET sort_order = ?` ⇒ MySQL
/// 报 `Unknown column`（1054）。本实现**逐字符保留该白名单**并在归一阶段
/// 额外拒绝非真实列（返回与 Java 相同的 `field 的值有误` 文案，
/// 但把 500 变成 400），详见 [`map_update_field_column`] 与 `uncertain_points`。
pub const PRODUCT_STYLE_FIELDS: [&str; 4] = ["style_name", "status", "sort_order", "pc_image"];

/// 样式类型：边框背景（Java `ProductStyleTypeEnum.BORDER`）。
pub const STYLE_TYPE_BORDER: i32 = 1;

/// 样式类型：活动背景（Java `ProductStyleTypeEnum.ACTIVITY_BACKGROUND`）。
pub const STYLE_TYPE_ACTIVITY_BACKGROUND: i32 = 2;

/// 活动状态：活动未开始（Java `ProductStyleActivityStatusEnum.NOT_STARTED`）。
pub const ACTIVITY_STATUS_NOT_STARTED: i32 = 1;

/// 活动状态：活动进行中（Java `ProductStyleActivityStatusEnum.IN_PROGRESS`）。
pub const ACTIVITY_STATUS_IN_PROGRESS: i32 = 2;

/// 活动状态：活动已结束（Java `ProductStyleActivityStatusEnum.ENDED`）。
pub const ACTIVITY_STATUS_ENDED: i32 = 3;

/// 关联类型：商品（Java `ProductStyleItemTypeEnum.PRODUCT`）。
pub const ITEM_TYPE_PRODUCT: i32 = 1;

/// 关联类型：分组（Java `ProductStyleItemTypeEnum.GROUP`）。
pub const ITEM_TYPE_GROUP: i32 = 2;

/// 关联类型：品牌（Java `ProductStyleItemTypeEnum.BRAND`）。
pub const ITEM_TYPE_BRAND: i32 = 3;

/// 平台店铺 ID（Java `ProductStyleServiceImpl#create`：
/// `productStyle.setShopId(getShopId() != null ? getShopId() : 0)`）。
pub const PLATFORM_SHOP_ID: i32 = 0;

/// 未删除（Java `ProductStyleSaveParam#createProductStyle` 硬编码 `.isDelete(0)`）。
pub const NOT_DELETED: i32 = 0;

/// 已删除。
pub const IS_DELETED: i32 = 1;

/// `style_name` 最大长度（Java `@Size(min = 1, max = 120)`；库列 `varchar(120)`）。
pub const STYLE_NAME_MAX_LEN: usize = 120;

/// `Rust` 侧上架商品状态（Java mapper XML `p.product_status = 1`）。
pub const PRODUCT_STATUS_ON_SALE: i32 = 1;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
//
// 全部来自 `com.tigshop.common.constant.ResultTextConstants` 与
// `ProductStyleSaveParam` / `ProductStyleItemBatchParam` 上的注解 message。

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.FIELD_NAME_CANNOT_BE_NULL`（`UpdateFieldDTO.field`）。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// Java `ResultTextConstants.FIELD_VALUE_CANNOT_BE_NULL`（`UpdateFieldDTO.val`）。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`
/// （`BaseServiceImpl#updateField` 白名单未命中）。
///
/// ⚠️ 文案是「field 的值有误」，**不是** area_code 用的「字段值不合法」
/// （那是另一个常量）。两者不可混用。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// Java `ProductStyleSaveParam.styleName` 上 `@NotBlank`。
pub const MSG_STYLE_NAME_NOT_BLANK: &str = "样式名称不能为空";

/// Java `ProductStyleSaveParam.styleName` 上 `@Size(min = 1, max = 120)`。
pub const MSG_STYLE_NAME_MAX_SIZE: &str = "样式名称长度不能超过120个字符";

/// Java `ProductStyleSaveParam.styleType` 上 `@NotNull`。
pub const MSG_STYLE_TYPE_NOT_NULL: &str = "样式类型不能为空";

/// Java `ProductStyleSaveParam.styleImage` 上 `@NotBlank`。
pub const MSG_STYLE_IMAGE_NOT_BLANK: &str = "样式图片不能为空";

/// Java `ProductStyleItemBatchParam.styleId` 上 `@NotNull`。
pub const MSG_STYLE_ID_NOT_NULL: &str = "样式ID不能为空";

/// Java `ProductStyleServiceImpl#validateParam` → 「商品样式不存在」。
pub const MSG_STYLE_NOT_FOUND: &str = "商品样式不存在";

/// Java `ProductStyleServiceImpl#validateParam` → 活动背景开始时间必填。
pub const MSG_START_TIME_REQUIRED: &str = "活动背景的生效开始时间不能为空";

/// Java `ProductStyleServiceImpl#validateParam` → 活动背景结束时间必填。
pub const MSG_END_TIME_REQUIRED: &str = "活动背景的生效结束时间不能为空";

/// Java `ProductStyleServiceImpl#validateParam` → 结束时间必须大于开始时间。
pub const MSG_END_MUST_AFTER_START: &str = "结束时间必须大于开始时间";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 商品样式 VO（对应 Java `com.tigshop.bean.vo.product.ProductStyleVO`）。
///
/// 字段与 Java 逐条对齐。Java `list` 在返回前会做两次派生赋值：
/// - `styleTypeName = ProductStyleTypeEnum.getTypeName(styleType)`
/// - `activityStatus = ProductStyleActivityStatusEnum.calcStatus(startTime, endTime)`
/// - `activityStatusName = ...getStatusName(activityStatus)`
///
/// ⚠️ Java 的 `styleName` / `styleImage` / `pcImage` 带 `@JsonTranslate`
/// （跨境翻译注解，dataType 18 / 19），管理端接口同样会经翻译切面处理；
/// Rust 侧尚未实现翻译切面，本实现原样返回库中值（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleVO {
    /// 样式ID
    pub style_id: i32,
    /// 样式名称
    pub style_name: String,
    /// 样式类型 1=边框背景 2=活动背景
    pub style_type: i32,
    /// 样式类型名称
    pub style_type_name: Option<String>,
    /// 样式图片URL
    pub style_image: String,
    /// PC端样式图片URL
    pub pc_image: String,
    /// 生效开始时间（秒级时间戳）
    pub start_time: i32,
    /// 生效结束时间（秒级时间戳）
    pub end_time: i32,
    /// 状态 0=禁用 1=启用
    pub status: i32,
    /// 店铺ID
    pub shop_id: i32,
    /// 创建时间（秒级时间戳）
    pub add_time: i32,
    /// 更新时间（秒级时间戳）
    pub update_time: i32,
    /// 关联商品数量（SQL 子查询实时统计的别名列 `product_count`）
    pub product_count: i32,
    /// 活动状态 1=未开始 2=进行中 3=已结束（Java `calcStatus`）
    pub activity_status: Option<i32>,
    /// 活动状态名称
    pub activity_status_name: Option<String>,
}

impl ProductStyleVO {
    /// 由实体 + `product_count` 组装，并补齐三个派生字段
    /// （对应 Java `list` 里的 `records.forEach(...)` 与
    /// `detail` 里的三次 `vo.setXxx`）。
    ///
    /// `now` 为当前秒级时间戳（Java `System.currentTimeMillis() / 1000`），
    /// 由调用方传入以便单测可控。
    #[must_use]
    pub fn from_entity(s: &ProductStyle, product_count: i32, now: i64) -> Self {
        let activity_status =
            calc_activity_status(i64::from(s.start_time), i64::from(s.end_time), now);
        Self {
            style_id: s.style_id,
            style_name: s.style_name.clone(),
            style_type: s.style_type,
            style_type_name: style_type_name(s.style_type),
            style_image: s.style_image.clone(),
            pc_image: s.pc_image.clone(),
            start_time: s.start_time,
            end_time: s.end_time,
            status: s.status,
            shop_id: s.shop_id,
            add_time: s.add_time,
            update_time: s.update_time,
            product_count,
            activity_status,
            activity_status_name: activity_status.and_then(activity_status_name),
        }
    }
}

/// 商品样式详情 VO（对应 Java `ProductStyleDetailVO extends ProductStyleVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleDetailVO {
    /// 父类字段（Java `ProductStyleVO`，JSON 层面扁平展开）
    #[serde(flatten)]
    pub base: ProductStyleVO,
    /// 关联商品ID列表
    pub product_ids: Vec<i32>,
    /// 关联分组ID列表
    pub group_ids: Vec<i32>,
    /// 关联品牌ID列表
    pub brand_ids: Vec<i32>,
    /// 关联商品信息列表
    pub product_list: Vec<ProductItemVO>,
    /// 关联分组信息列表
    pub group_list: Vec<GroupItemVO>,
    /// 关联品牌信息列表
    pub brand_list: Vec<BrandItemVO>,
}

/// 商品简要信息（Java `ProductStyleDetailVO.ProductItemVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductItemVO {
    /// 商品ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品图片
    pub pic_thumb: String,
    /// 商品价格（Java `BigDecimal` ⇒ `Decimal`，**禁止** f64/f32）
    pub product_price: Decimal,
}

/// 分组简要信息（Java `ProductStyleDetailVO.GroupItemVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GroupItemVO {
    /// 分组ID
    pub product_group_id: i32,
    /// 分组名称
    pub product_group_name: Option<String>,
}

/// 品牌简要信息（Java `ProductStyleDetailVO.BrandItemVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandItemVO {
    /// 品牌ID
    pub brand_id: i32,
    /// 品牌名称
    pub brand_name: String,
}

/// 品牌及商品数量 VO（对应 Java
/// `com.tigshop.bean.vo.product.BrandProductCountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandProductCountVO {
    /// 品牌ID
    pub brand_id: i32,
    /// 品牌名称
    pub brand_name: String,
    /// 品牌下商品数量（实时统计）
    pub product_count: i32,
}

// ——————————————————————————————————————————————
// 仓储读写中间结构（服务层 ↔ 仓储层）
// ——————————————————————————————————————————————

/// 详情组装所需的商品行（Java `Product` 只取 4 列）。
#[derive(Debug, Clone, Default)]
pub struct StyleProductRow {
    /// 商品ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品图片
    pub pic_thumb: String,
    /// 商品价格
    pub product_price: Decimal,
}

/// 详情组装所需的分组行（Java `ProductGroup` 只取 3 列）。
#[derive(Debug, Clone, Default)]
pub struct StyleGroupRow {
    /// 分组ID
    pub product_group_id: i32,
    /// 分组名称
    pub product_group_name: Option<String>,
    /// 分组内的商品ID JSON 字符串（Java `ProductGroup.productIds`，
    /// 由 `JSONUtil.toList(...)` 解析后并入 `allProductIds`）
    pub product_ids: Option<String>,
}

/// 列表页每行的「样式 + 实时商品数」
/// （Java mapper `pageList` 的 `LEFT JOIN` 子查询结果）。
#[derive(Debug, Clone, Default)]
pub struct StyleRowWithCount {
    /// 样式实体
    pub style: ProductStyle,
    /// `IFNULL(cnt.product_count, 0)`
    pub product_count: i32,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `ProductStylePageQuery extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder` / `keyword`；
/// 本域追加：`styleType` / `status` / `activityStatus` / `startTime` / `endTime`。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`ProductStyleListQuery::page_query`] 完成桥接。
///
/// ⚠️ `startTime` / `endTime` 在 **Java 查询对象里是字符串**（`yyyy-MM-dd`，
/// 经 `TigUtils.toTimestampYmd` 解析），但**同一个名字在保存参数
/// `ProductStyleSaveParam` 里是 `yyyy-MM-dd HH:mm:ss`**。两处格式不同，
/// 详见 [`parse_time_ymd`] 与 `uncertain_points`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleListQuery {
    /// 样式类型 1=边框背景 2=活动背景
    pub style_type: Option<i32>,
    /// 状态 0=禁用 1=启用
    pub status: Option<i32>,
    /// 活动状态 1=未开始 2=进行中 3=已结束（SQL 分支按此过滤）
    pub activity_status: Option<i32>,
    /// 生效开始时间下界（`yyyy-MM-dd`，筛选 `start_time >= 该值`）
    pub start_time: Option<String>,
    /// 生效结束时间上界（`yyyy-MM-dd`，筛选 `end_time <= 该值`）
    pub end_time: Option<String>,
    /// 样式名称模糊匹配（Java `BasePage.keyword`，`LIKE %keyword%`）
    pub keyword: Option<String>,
    /// 排序字段（Java `sortField`）
    pub sort_field: Option<String>,
    /// `asc` / `desc`
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl ProductStyleListQuery {
    /// 有效关键字（去空白后为空则不过滤，与 mapper XML
    /// `<if test="query.keyword != null and query.keyword != ''">` 的判据一致）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 解析 `startTime`（Java `TigUtils.toTimestampYmd`）。
    ///
    /// ⚠️ Java `TigUtils.toTimestampYmd` 用 Hutool `DateUtil.parse(dateStr,
    /// "yyyy-MM-dd")`，**解析失败会抛异常**（不是返回 null）。本实现返回
    /// `Err` 交由服务层报「参数校验失败」，语义等价（见 `uncertain_points`）。
    ///
    /// # Errors
    /// - 格式不是 `yyyy-MM-dd` ⇒ `Err(带原始入参的说明)`
    pub fn parsed_start_time(&self) -> Result<Option<i64>, String> {
        self.start_time
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(parse_time_ymd)
            .transpose()
    }

    /// 解析 `endTime`（同上）。
    ///
    /// # Errors
    /// - 格式不是 `yyyy-MM-dd` ⇒ `Err(带原始入参的说明)`
    pub fn parsed_end_time(&self) -> Result<Option<i64>, String> {
        self.end_time
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(parse_time_ymd)
            .transpose()
    }

    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `ProductStyleServiceImpl#buildStyleOrders` 等价：
    /// - `sortField` 为 `productCount` 或 `product_count` ⇒
    ///   `ORDER BY product_count {ASC|DESC}, ps.style_id DESC`
    ///   （**恒定附加 `ps.style_id DESC` 保证稳定次序**）
    /// - 否则：`sortField` 为空或等于主键属性名 ⇒ 主键列；其余经
    ///   `getColumnByPropertyName` 归一（**未识别回退主键列**，
    ///   MyBatis-Plus 的防注入行为，不是报错）
    /// - 列名一律加 `ps.` 前缀（Java 显式拼 `"ps." + getColumnByPropertyName(field)`）
    /// - `asc`（忽略大小写，`equalsIgnoreCase`）升序；**其余一切**（含空、
    ///   含非法值）降序 —— 注意这里 Java 是 `asc ? asc : desc` 的三元表达式，
    ///   **不像** `BaseServiceImpl#buildSortOrder` 那样有「非法值不排序」的缺口
    #[must_use]
    pub fn order_clause(&self) -> String {
        let asc = self
            .sort_order
            .as_deref()
            .is_some_and(|s| s.eq_ignore_ascii_case("asc"));
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");

        // productCount 是 SQL 子查询的别名列，**不能**加 ps. 前缀
        if field == "productCount" || field == "product_count" {
            let dir = if asc { "ASC" } else { "DESC" };
            return format!(" ORDER BY product_count {dir}, ps.style_id DESC");
        }

        let column = if field.is_empty() || field == KEY_PROPERTY {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        let dir = if asc { "ASC" } else { "DESC" };
        format!(" ORDER BY ps.{column} {dir}")
    }
}

/// 创建 / 更新请求（Java `ProductStyleSaveParam`）。
///
/// Java 侧 `styleName` / `styleType` / `styleImage` 分别带
/// `@NotBlank` / `@NotNull` / `@NotBlank`，控制器参数上有 `@Validated`，
/// 因此这些注解**确实生效**。本实现把这些校验放在服务层，文案逐字符照抄。
///
/// ⚠️ `status` **没有** `@NotNull`：可以为 null。此时 Java
/// `createProductStyle()` 构造的实体 `status = null`，MyBatis-Plus 的
/// `FieldStrategy.NOT_NULL` 会跳过该列，由 MySQL 施加列默认值
/// （`status` 列 `NOT NULL` 且 `pure.sql` 未声明 DEFAULT ⇒ 隐含 0）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleSaveDTO {
    /// 样式名称（必填，1..=120 字符）
    pub style_name: Option<String>,
    /// 样式类型 1=边框背景 2=活动背景（必填）
    pub style_type: Option<i32>,
    /// 样式图片URL（必填）
    pub style_image: Option<String>,
    /// PC端样式图片URL（可空；Java `pcImage != null ? pcImage : ""`）
    pub pc_image: Option<String>,
    /// 生效开始时间（活动背景必填，`yyyy-MM-dd HH:mm:ss`）
    pub start_time: Option<String>,
    /// 生效结束时间（活动背景必填，`yyyy-MM-dd HH:mm:ss`）
    pub end_time: Option<String>,
    /// 状态 1=启用 0=禁用（可空 ⇒ 不写列）
    pub status: Option<i32>,
    /// 关联商品ID列表
    pub product_ids: Option<Vec<i32>>,
    /// 关联分组ID列表
    pub group_ids: Option<Vec<i32>>,
    /// 关联品牌ID列表
    pub brand_ids: Option<Vec<i32>>,
}

impl ProductStyleSaveDTO {
    /// Java `ProductStyleSaveParam#createProductStyle` 的 `pcImage` 归一：
    /// `pcImage != null ? pcImage : ""` ⇒ 列 `NOT NULL`，null 落为**空串**。
    #[must_use]
    pub fn pc_image_or_empty(&self) -> String {
        self.pc_image.clone().unwrap_or_default()
    }

    /// Java `ProductStyleSaveParam#createProductStyle` 的 `startTime` 归一：
    /// `StrUtil.isNotBlank(startTime) ? TigUtils.toTimestampYmdHms(startTime) : 0L`
    /// ⇒ 空白落为 **`0`**（表示「不限」，与 mapper XML 的
    /// `ps.start_time = 0 OR ...` 语义配套）。
    ///
    /// # Errors
    /// - 非空白但格式不是 `yyyy-MM-dd HH:mm:ss` ⇒ `Err`
    pub fn parsed_start_time(&self) -> Result<i64, String> {
        parse_time_opt_hms(self.start_time.as_deref(), MSG_START_TIME_REQUIRED)
    }

    /// 同上（`endTime`）。
    ///
    /// # Errors
    /// - 非空白但格式不是 `yyyy-MM-dd HH:mm:ss` ⇒ `Err`
    pub fn parsed_end_time(&self) -> Result<i64, String> {
        parse_time_opt_hms(self.end_time.as_deref(), MSG_END_TIME_REQUIRED)
    }

    /// 本次请求含哪些关联类型（供服务层决定是否清理/写入
    /// `product_style_item`），与 Java `CollUtil.isNotEmpty` 判据一致。
    #[must_use]
    pub fn has_items(&self) -> bool {
        [&self.product_ids, &self.group_ids, &self.brand_ids]
            .into_iter()
            .any(|v| v.as_ref().is_some_and(|ids| !ids.is_empty()))
    }
}

/// 更新请求（Java `ProductStyleEditParam extends ProductStyleSaveParam`）。
///
/// `#[serde(flatten)]` 对齐 Java 的继承展开：JSON 层面就是
/// `{ "styleId": 1, "styleName": "...", ... }` 的扁平结构。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleEditDTO {
    /// 主键（Java `@NotNull(message = "id 不能为空")`）
    pub style_id: Option<i32>,
    /// 父类字段（Java `ProductStyleSaveParam`）
    #[serde(flatten)]
    pub base: ProductStyleSaveDTO,
}

impl ProductStyleEditDTO {
    /// 供校验复用的父类型视图（命名对应 Java `super.createProductStyle()` 的取用点）。
    #[must_use]
    pub fn as_save(&self) -> &ProductStyleSaveDTO {
        &self.base
    }
}

/// 关联批量操作请求（Java `ProductStyleItemBatchParam`）。
///
/// `styleId` 带 `@NotNull`（必填），三个 ID 列表都可空。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductStyleItemBatchDTO {
    /// 样式ID（必填）
    pub style_id: Option<i32>,
    /// 商品ID列表
    pub product_ids: Option<Vec<i32>>,
    /// 分组ID列表
    pub group_ids: Option<Vec<i32>>,
    /// 品牌ID列表
    pub brand_ids: Option<Vec<i32>>,
}

impl ProductStyleItemBatchDTO {
    /// 三个 ID 列表是否全空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        [&self.product_ids, &self.group_ids, &self.brand_ids]
            .into_iter()
            .all(|v| v.as_ref().is_none_or(Vec::is_empty))
    }
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`，本域自持副本）。
///
/// Java 侧三个字段都带 `@NotNull`，且控制器参数带 `@Validated`，
/// 因此 `id` / `field` / `val` 缺一即 400。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 字段名（属性名或列名，必填）
    pub field: Option<String>,
    /// 值（Java 侧统一按字符串 set，由 MySQL 按目标列类型隐式转换）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`，本域自持副本）。
///
/// Java 的 `value` 是 `int`（原始类型，缺省 0）、`data` 是
/// `Map<String, Object>`；本域仅支持 `type = "del"`，这两个字段不参与逻辑。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `@NotEmpty`，参数 `@Validated` ⇒ 空数组 400）
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: String,
    /// 值（本域不使用）
    pub value: Option<i64>,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// 纯函数（供服务层与单测共用）
// ——————————————————————————————————————————————

/// 样式类型名（Java `ProductStyleTypeEnum.getTypeName`）。
///
/// ⚠️ Java 用 `typeEnum.code == type` 比较，其中 `type` 是 `Integer`、
/// `code` 是 `int` ⇒ **自动拆箱**，`type == null` 时抛 NPE。
/// 本实现用 `i32` 入参（调用点已解包），返回 `Option<String>`：
/// 未识别的类型返回 `None`（Java 落到 `return null`）。
#[must_use]
pub fn style_type_name(style_type: i32) -> Option<String> {
    match style_type {
        STYLE_TYPE_BORDER => Some("边框背景".into()),
        STYLE_TYPE_ACTIVITY_BACKGROUND => Some("活动背景".into()),
        _ => None,
    }
}

/// 活动状态名（Java `ProductStyleActivityStatusEnum.getStatusName`）。
///
/// Java 对 `code == null` 返回 null，未识别也返回 null。
#[must_use]
pub fn activity_status_name(code: i32) -> Option<String> {
    match code {
        ACTIVITY_STATUS_NOT_STARTED => Some("活动未开始".into()),
        ACTIVITY_STATUS_IN_PROGRESS => Some("活动进行中".into()),
        ACTIVITY_STATUS_ENDED => Some("活动已结束".into()),
        _ => None,
    }
}

/// 计算活动状态（Java `ProductStyleActivityStatusEnum#calcStatus`）。
///
/// 边界语义**逐字符照抄**（这是最容易写反的地方）：
/// ```text
/// if (now < startTime)      -> 1 活动未开始
/// else if (now > endTime)   -> 3 活动已结束
/// else                      -> 2 活动进行中
/// ```
/// 即 `now == startTime` 与 `now == endTime` 都算**进行中**（闭区间）。
///
/// Java 在 `startTime == null || endTime == null` 时返回 null；
/// 本实现入参已是解包后的 `i64`（库列 `NOT NULL`），故返回 `Option`
/// 仅为与 `activityStatusName` 的类型对齐，**恒为 `Some`**。
#[must_use]
pub fn calc_activity_status(start_time: i64, end_time: i64, now: i64) -> Option<i32> {
    if now < start_time {
        Some(ACTIVITY_STATUS_NOT_STARTED)
    } else if now > end_time {
        Some(ACTIVITY_STATUS_ENDED)
    } else {
        Some(ACTIVITY_STATUS_IN_PROGRESS)
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `product_style` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
///
/// ⚠️ 与 Java 的一处**有意收敛**：`sort_order` 在 Java 的白名单
/// `PRODUCT_STYLE_FIELDS` 里，但**不是本表真实列**。本函数把它归一为
/// 主键列（而不是原样返回），因此 `updateField` 传 `sort_order` 时会落到
/// **「field 的值有误」**，而不是让 MySQL 抛 `Unknown column`（500）。
/// 两者对「该字段能否被改」的**判定结果一致**（都不能改），
/// 差别只在错误形态（400 vs 500），见 `uncertain_points`。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "styleId" | "style_id" => "style_id",
        "styleName" | "style_name" => "style_name",
        "styleType" | "style_type" => "style_type",
        "styleImage" | "style_image" => "style_image",
        "pcImage" | "pc_image" => "pc_image",
        "startTime" | "start_time" => "start_time",
        "endTime" | "end_time" => "end_time",
        "status" => "status",
        "shopId" | "shop_id" => "shop_id",
        "addTime" | "add_time" => "add_time",
        "updateTime" | "update_time" => "update_time",
        "isDelete" | "is_delete" => "is_delete",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中；未命中返回 `None`
/// —— 调用方据此报 `field 的值有误`。
///
/// ⚠️ **有意偏离**（同 [`map_order_column`]）：Java 找不到时返回**主键列**，
/// 再拿它比对 `PRODUCT_STYLE_FIELDS`（主键不在其中，于是同样报错）。
/// 两者对白名单的判定结果完全一致，差别只在是否命中「回退主键」分支。
///
/// 另外本函数**只认 `product_style` 的真实列**：`sort_order` 虽然出现在
/// Java 白名单里，但归一为 `None`（Java 会归一成字面量 `sort_order` 并拼进 SQL）。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "styleId" | "style_id" => Some("style_id"),
        "styleName" | "style_name" => Some("style_name"),
        "styleType" | "style_type" => Some("style_type"),
        "styleImage" | "style_image" => Some("style_image"),
        "pcImage" | "pc_image" => Some("pc_image"),
        "startTime" | "start_time" => Some("start_time"),
        "endTime" | "end_time" => Some("end_time"),
        "status" => Some("status"),
        "shopId" | "shop_id" => Some("shop_id"),
        "addTime" | "add_time" => Some("add_time"),
        "updateTime" | "update_time" => Some("update_time"),
        "isDelete" | "is_delete" => Some("is_delete"),
        // `sort_order` 及一切非本表列 ⇒ None（见函数文档的「有意偏离」）
        _ => None,
    }
}

/// 校验创建 / 更新请求的必填与长度
/// （Java `@NotBlank` + `@NotNull` + `@Size(min = 1, max = 120)`）。
///
/// 返回 `Ok((styleName, styleType, styleImage))`（`styleName` / `styleImage`
/// 已 trim），否则返回带 Java 原文案的错误。
///
/// # Errors
/// - `styleName` 空白 ⇒ `样式名称不能为空`
/// - `styleName` 超过 120 字符 ⇒ `样式名称长度不能超过120个字符`
/// - `styleType` 缺失 ⇒ `样式类型不能为空`
/// - `styleImage` 空白 ⇒ `样式图片不能为空`
pub fn validate_save(base: &ProductStyleSaveDTO) -> Result<(String, i32, String), String> {
    let style_name = base
        .style_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_STYLE_NAME_NOT_BLANK.to_string())?
        .to_string();
    if style_name.chars().count() > STYLE_NAME_MAX_LEN {
        return Err(MSG_STYLE_NAME_MAX_SIZE.to_string());
    }

    let style_type = base
        .style_type
        .ok_or_else(|| MSG_STYLE_TYPE_NOT_NULL.to_string())?;

    let style_image = base
        .style_image
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_STYLE_IMAGE_NOT_BLANK.to_string())?
        .to_string();

    Ok((style_name, style_type, style_image))
}

/// 活动背景的时间校验（Java `ProductStyleServiceImpl#validateParam`）。
///
/// 仅当 `styleType == 2`（活动背景）时校验：
/// - `startTime` 空白 ⇒ `活动背景的生效开始时间不能为空`
/// - `endTime` 空白 ⇒ `活动背景的生效结束时间不能为空`
/// - `end <= start` ⇒ `结束时间必须大于开始时间`
///   （Java `Assert.isTrue(end > start, ...)` ⇒ **相等也不允许**）
///
/// 返回解析后的 `(start, end)` 秒级时间戳；非活动背景的**空白**时间返回 0
/// —— 与 Java `createProductStyle()` 的 `StrUtil.isNotBlank(...) ? ... : 0L`
/// 归一结果一致。
///
/// ⚠️ 非活动背景**不校验必填**，但非空白的时间仍会被
/// `TigUtils.toTimestampYmdHms` 解析 ⇒ **格式非法照样报错**
/// （Java 抛异常，本实现返回 `Err`）。两条分支都如此。
///
/// # Errors
/// - 活动背景时间缺失 ⇒ 带 Java 原文案的错误
/// - 任一时间非空白但格式非法 ⇒ 解析错误
/// - 活动背景下 `end <= start` ⇒ `结束时间必须大于开始时间`
pub fn validate_activity_time(base: &ProductStyleSaveDTO) -> Result<(i64, i64), String> {
    if base.style_type != Some(STYLE_TYPE_ACTIVITY_BACKGROUND) {
        // 非活动背景：Java `validateParam` **不校验**时间；但
        // `createProductStyle()` 仍会把非空白的时间经
        // `TigUtils.toTimestampYmdHms` 解析 ⇒ **格式非法仍会抛异常**。
        // 因此这里用 `?` 而不是 `unwrap_or(0)`：
        // 空白 ⇒ 0（Java `StrUtil.isNotBlank(...) ? ... : 0L`），
        // 非空白但格式非法 ⇒ Err（与 Java 抛异常等价）。
        let start = parse_time_opt_hms(base.start_time.as_deref(), MSG_START_TIME_REQUIRED)?;
        let end = parse_time_opt_hms(base.end_time.as_deref(), MSG_END_TIME_REQUIRED)?;
        return Ok((start, end));
    }

    let start_str = base
        .start_time
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_START_TIME_REQUIRED.to_string())?;
    let end_str = base
        .end_time
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_END_TIME_REQUIRED.to_string())?;

    let start = parse_time_hms(start_str)?;
    let end = parse_time_hms(end_str)?;
    if end <= start {
        return Err(MSG_END_MUST_AFTER_START.to_string());
    }
    Ok((start, end))
}

/// Java `TigUtils.toTimestampYmd`：`yyyy-MM-dd` ⇒ 秒级时间戳（UTC+8 本地时区）。
///
/// 本实现只接受严格的 `yyyy-MM-dd`（含长度与前导零），
/// 不做 Hutool 的宽松解析（见 `uncertain_points`）。
///
/// # Errors
/// - 格式不合法或日期不存在 ⇒ `Err`
pub fn parse_time_ymd(s: &str) -> Result<i64, String> {
    parse_datetime(
        s.trim(),
        &[10],
        // 日期部分按 `yyyy-MM-dd` 解析，时间部分补 00:00:00
        false,
    )
}

/// Java `TigUtils.toTimestampYmdHms`：`yyyy-MM-dd HH:mm:ss` ⇒ 秒级时间戳。
///
/// # Errors
/// - 格式不合法或日期不存在 ⇒ `Err`
pub fn parse_time_hms(s: &str) -> Result<i64, String> {
    parse_datetime(s.trim(), &[19], true)
}

/// 可空时间的归一（Java `StrUtil.isNotBlank(x) ? parse(x) : 0L`）。
///
/// 空白（`None` / 空串 / 全空白）⇒ `Ok(0)`；非空白但解析失败 ⇒ `Err`。
/// `missing_msg` 只用于调用方决定缺失时的语义，本函数不产出它
/// （活动背景的「必填」由 [`validate_activity_time`] 先行判定）。
///
/// # Errors
/// - 非空白且格式不合法 ⇒ `Err`
pub fn parse_time_opt_hms(v: Option<&str>, _missing_msg: &str) -> Result<i64, String> {
    match v.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => parse_time_hms(s),
        None => Ok(0),
    }
}

/// 严格解析 `yyyy-MM-dd` 或 `yyyy-MM-dd HH:mm:ss`，返回秒级时间戳。
///
/// 不引入 `chrono`（本 crate 未声明依赖），用纯整数算法实现
/// 「公历日期 → Unix 秒」的换算（Howard Hinnant 的 `days_from_civil`），
/// 时区固定为 **UTC+8**（与 Java `DateUtil.parse` 的本地时区一致，
/// 前提是服务端时区为 Asia/Shanghai，见 `uncertain_points`）。
fn parse_datetime(s: &str, ok_lens: &[usize], with_time: bool) -> Result<i64, String> {
    if !ok_lens.contains(&s.len()) {
        return Err(format!("时间格式不合法: {s}"));
    }
    let bytes = s.as_bytes();
    // 形如 `yyyy-MM-dd` 或 `yyyy-MM-dd HH:mm:ss`
    if !matches!(bytes[4], b'-') || !matches!(bytes[7], b'-') {
        return Err(format!("时间格式不合法: {s}"));
    }
    let year: i64 = s[0..4]
        .parse()
        .map_err(|_| format!("时间格式不合法: {s}"))?;
    let month: i64 = s[5..7]
        .parse()
        .map_err(|_| format!("时间格式不合法: {s}"))?;
    let day: i64 = s[8..10]
        .parse()
        .map_err(|_| format!("时间格式不合法: {s}"))?;

    let (hour, minute, second) = if with_time {
        if !matches!(bytes[10], b' ') || !matches!(bytes[13], b':') || !matches!(bytes[16], b':') {
            return Err(format!("时间格式不合法: {s}"));
        }
        let h: i64 = s[11..13]
            .parse()
            .map_err(|_| format!("时间格式不合法: {s}"))?;
        let mi: i64 = s[14..16]
            .parse()
            .map_err(|_| format!("时间格式不合法: {s}"))?;
        let sec: i64 = s[17..19]
            .parse()
            .map_err(|_| format!("时间格式不合法: {s}"))?;
        (h, mi, sec)
    } else {
        (0, 0, 0)
    };

    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return Err(format!("时间格式不合法: {s}"));
    }
    if with_time
        && (!(0..=23).contains(&hour) || !(0..=59).contains(&minute) || !(0..=60).contains(&second))
    {
        return Err(format!("时间格式不合法: {s}"));
    }
    // 校验该月实际天数（含闰年），拒绝 2 月 30 日这类不存在的日期
    if day > days_in_month(year, month) {
        return Err(format!("时间格式不合法: {s}"));
    }

    let days = days_from_civil(year, month, day);
    // UTC+8：本地时间 = UTC + 8h ⇒ UTC 秒 = 本地秒 - 8*3600
    let local_secs = days * 86_400 + hour * 3600 + minute * 60 + second;
    Ok(local_secs - 8 * 3600)
}

/// 该年该月的天数（含闰年规则）。
fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(year) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// 闰年判定（格里高利历）。
fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// 公历 `y-m-d` → 距 1970-01-01 的天数（Howard Hinnant `days_from_civil`）。
///
/// 纯整数实现，对 1970 之前同样成立，无浮点、无溢出风险（本域年份极小）。
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400; // [0, 399]
    let mp = (m + 9) % 12; // Mar=0 .. Feb=11
    let doy = (153 * mp + 2) / 5 + d - 1; // [0, 365]
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]
    era * 146_097 + doe - 719_468
}

/// 当前秒级时间戳（Java `System.currentTimeMillis() / 1000`）。
///
/// 用 `std::time::SystemTime`，不引入新依赖；系统时间早于 1970 时返回 0。
#[must_use]
pub fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| i64::try_from(d.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

/// `ProductStyleItem` 去重后的关联 ID 列表（供服务层判断是否需要写库）。
///
/// Java `ProductStyleItemServiceImpl#batchAdd` 会先查已有 `ref_id`
/// 再 `filter(!existingRefIds.contains(refId))`，因此**重复入参只写一条**。
/// 本函数只做请求内的去重（保持首次出现顺序，对应 Java 的 `LinkedHashSet`
/// 语义），与库中已有值的比对由仓储层 SQL 完成。
#[must_use]
pub fn dedup_ids(ids: &[i32]) -> Vec<i32> {
    let mut seen = std::collections::HashSet::with_capacity(ids.len());
    let mut out = Vec::with_capacity(ids.len());
    for id in ids {
        if seen.insert(*id) {
            out.push(*id);
        }
    }
    out
}

/// 品牌 VO 由实体映射（Java `selectBrandListWithProductCount` 直接返回 VO）。
#[must_use]
pub fn brand_product_count_vo(b: &Brand, product_count: i32) -> BrandProductCountVO {
    BrandProductCountVO {
        brand_id: b.brand_id,
        brand_name: b.brand_name.clone(),
        product_count,
    }
}

/// `ProductStyleItem` 的展示用类型名（Java
/// `ProductStyleItemTypeEnum.getTypeName`，供日志/调试）。
#[must_use]
pub fn item_type_name(item_type: i32) -> Option<String> {
    match item_type {
        ITEM_TYPE_PRODUCT => Some("商品".into()),
        ITEM_TYPE_GROUP => Some("分组".into()),
        ITEM_TYPE_BRAND => Some("品牌".into()),
        _ => None,
    }
}

/// 若 `q` 未指定排序，返回 Java mapper 的默认次序。
///
/// ⚠️ Java `list` **总是**调用 `buildStyleOrders` 并 `page.setOrders(...)`，
/// 因此映射到 Rust 时**总会**有 `ORDER BY`（默认主键降序），
/// 不存在「无排序」分支。本函数仅为把这一事实显式化，便于单测断言。
#[must_use]
pub fn default_order_clause() -> &'static str {
    " ORDER BY ps.style_id DESC"
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `CheckFieldConstants.PRODUCT_STYLE_FIELDS` 的逐字对照。
    #[test]
    fn product_style_fields_matches_java_constant() {
        assert_eq!(
            PRODUCT_STYLE_FIELDS,
            ["style_name", "status", "sort_order", "pc_image"]
        );
        // 白名单里的 style_name / status / pc_image 是真实列
        assert!(PRODUCT_STYLE_COLUMNS.contains(&"style_name"));
        assert!(PRODUCT_STYLE_COLUMNS.contains(&"status"));
        assert!(PRODUCT_STYLE_COLUMNS.contains(&"pc_image"));
        // sort_order **不是** product_style 的真实列（Java 原代码缺陷）
        assert!(!PRODUCT_STYLE_COLUMNS.contains(&"sort_order"));
    }

    /// Java 常量文案逐字符照抄（注意 INVALID_FIELD_VALUE 是「field 的值有误」）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_FIELD_NAME_REQUIRED, "字段名不能为空");
        assert_eq!(MSG_FIELD_VALUE_REQUIRED, "值不能为空");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
        assert_eq!(MSG_STYLE_NAME_NOT_BLANK, "样式名称不能为空");
        assert_eq!(MSG_STYLE_NAME_MAX_SIZE, "样式名称长度不能超过120个字符");
        assert_eq!(MSG_STYLE_TYPE_NOT_NULL, "样式类型不能为空");
        assert_eq!(MSG_STYLE_IMAGE_NOT_BLANK, "样式图片不能为空");
        assert_eq!(MSG_STYLE_ID_NOT_NULL, "样式ID不能为空");
        assert_eq!(MSG_STYLE_NOT_FOUND, "商品样式不存在");
        assert_eq!(MSG_START_TIME_REQUIRED, "活动背景的生效开始时间不能为空");
        assert_eq!(MSG_END_TIME_REQUIRED, "活动背景的生效结束时间不能为空");
        assert_eq!(MSG_END_MUST_AFTER_START, "结束时间必须大于开始时间");
        // 与 area_code 的「字段值不合法」不是同一个常量
        assert_ne!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
    }

    /// Java 三个枚举的 code 值逐条对照。
    #[test]
    fn enum_codes_match_java() {
        assert_eq!(STYLE_TYPE_BORDER, 1);
        assert_eq!(STYLE_TYPE_ACTIVITY_BACKGROUND, 2);
        assert_eq!(ACTIVITY_STATUS_NOT_STARTED, 1);
        assert_eq!(ACTIVITY_STATUS_IN_PROGRESS, 2);
        assert_eq!(ACTIVITY_STATUS_ENDED, 3);
        assert_eq!(ITEM_TYPE_PRODUCT, 1);
        assert_eq!(ITEM_TYPE_GROUP, 2);
        assert_eq!(ITEM_TYPE_BRAND, 3);
    }

    /// Java `ProductStyleTypeEnum.getTypeName` 的识别与未识别分支。
    #[test]
    fn style_type_name_lookup() {
        assert_eq!(style_type_name(1).as_deref(), Some("边框背景"));
        assert_eq!(style_type_name(2).as_deref(), Some("活动背景"));
        assert_eq!(style_type_name(0), None);
        assert_eq!(style_type_name(3), None);
    }

    /// Java `ProductStyleActivityStatusEnum.getStatusName`。
    #[test]
    fn activity_status_name_lookup() {
        assert_eq!(activity_status_name(1).as_deref(), Some("活动未开始"));
        assert_eq!(activity_status_name(2).as_deref(), Some("活动进行中"));
        assert_eq!(activity_status_name(3).as_deref(), Some("活动已结束"));
        assert_eq!(activity_status_name(0), None);
        assert_eq!(activity_status_name(9), None);
    }

    /// Java `ProductStyleItemTypeEnum.getTypeName`。
    #[test]
    fn item_type_name_lookup() {
        assert_eq!(item_type_name(1).as_deref(), Some("商品"));
        assert_eq!(item_type_name(2).as_deref(), Some("分组"));
        assert_eq!(item_type_name(3).as_deref(), Some("品牌"));
        assert_eq!(item_type_name(4), None);
    }

    // ————————————————————— 纯逻辑：活动状态计算（最容易写反） —————————————————————

    /// **边界语义逐字符对照 Java `calcStatus`**：
    /// `now < start` → 1；`now > end` → 3；其余（含相等）→ 2。
    #[test]
    fn calc_activity_status_boundaries() {
        // now 严格小于 start ⇒ 未开始
        assert_eq!(
            calc_activity_status(100, 200, 99),
            Some(ACTIVITY_STATUS_NOT_STARTED)
        );
        // now == start ⇒ 进行中（Java 是 `now < startTime` 才判未开始）
        assert_eq!(
            calc_activity_status(100, 200, 100),
            Some(ACTIVITY_STATUS_IN_PROGRESS)
        );
        // 区间内 ⇒ 进行中
        assert_eq!(
            calc_activity_status(100, 200, 150),
            Some(ACTIVITY_STATUS_IN_PROGRESS)
        );
        // now == end ⇒ 进行中（Java 是 `now > endTime` 才判已结束）
        assert_eq!(
            calc_activity_status(100, 200, 200),
            Some(ACTIVITY_STATUS_IN_PROGRESS)
        );
        // now 严格大于 end ⇒ 已结束
        assert_eq!(
            calc_activity_status(100, 200, 201),
            Some(ACTIVITY_STATUS_ENDED)
        );
        // start == end：now 等于它时仍算进行中
        assert_eq!(
            calc_activity_status(100, 100, 100),
            Some(ACTIVITY_STATUS_IN_PROGRESS)
        );
        // start == end == 0（Java 未填写时间时落 0）：now > 0 ⇒ 已结束
        assert_eq!(
            calc_activity_status(0, 0, 1_700_000_000),
            Some(ACTIVITY_STATUS_ENDED)
        );
    }

    // ————————————————————— 纯逻辑：updateField 白名单 —————————————————————

    /// 归一 + 白名单：`style_id` 能归一但被白名单拒绝；
    /// `sort_order` 归一失败（不是真实列）；未识别字段直接拒绝。
    #[test]
    fn update_field_whitelist_flow() {
        // 三个白名单真实列（属性名与列名两种写法）
        for (input, column) in [
            ("styleName", "style_name"),
            ("style_name", "style_name"),
            ("status", "status"),
            ("pcImage", "pc_image"),
            ("pc_image", "pc_image"),
        ] {
            let c = map_update_field_column(input).unwrap();
            assert_eq!(c, column);
            assert!(PRODUCT_STYLE_FIELDS.contains(&c));
            // 白名单里能命中的都必须是真实列
            assert!(PRODUCT_STYLE_COLUMNS.contains(&c));
        }
        // 主键可归一，但不在白名单 ⇒ Java 报「field 的值有误」
        let id_col = map_update_field_column("styleId").unwrap();
        assert_eq!(id_col, "style_id");
        assert!(!PRODUCT_STYLE_FIELDS.contains(&id_col));
        // sort_order 在白名单里却不是真实列 ⇒ 归一失败（本实现的有意收敛）
        assert!(PRODUCT_STYLE_FIELDS.contains(&"sort_order"));
        assert_eq!(map_update_field_column("sort_order"), None);
        // 完全无法识别 ⇒ 归一失败
        assert_eq!(map_update_field_column("something"), None);
    }

    /// 主键列与主键属性名的常量对照（Java `getKeyColumn` / `getKeyProperty`）。
    #[test]
    fn key_column_and_property() {
        assert_eq!(KEY_COLUMN, "style_id");
        assert_eq!(KEY_PROPERTY, "styleId");
        assert_eq!(map_order_column("styleId"), KEY_COLUMN);
        assert!(PRODUCT_STYLE_COLUMNS.contains(&KEY_COLUMN));
    }

    // ————————————————————— 纯逻辑：list 排序 —————————————————————

    /// Java `buildStyleOrders` 的 `productCount` 特例：
    /// 别名列**不加 `ps.` 前缀**，且恒定附加 `ps.style_id DESC`。
    #[test]
    fn order_clause_product_count_special_case() {
        let q = ProductStyleListQuery {
            sort_field: Some("productCount".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY product_count ASC, ps.style_id DESC"
        );

        let q = ProductStyleListQuery {
            sort_field: Some("product_count".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY product_count DESC, ps.style_id DESC"
        );
    }

    /// 普通字段：一律带 `ps.` 前缀；`asc` 大小写不敏感；
    /// **非法值也降序**（Java 是三元表达式，不存在「不排序」分支）。
    #[test]
    fn order_clause_regular_fields() {
        // 空 sortField / 空 sortOrder ⇒ 主键降序
        assert_eq!(
            ProductStyleListQuery::default().order_clause(),
            " ORDER BY ps.style_id DESC"
        );
        assert_eq!(
            ProductStyleListQuery::default().order_clause(),
            default_order_clause()
        );

        // 属性名 → 列名 + ASC
        let q = ProductStyleListQuery {
            sort_field: Some("styleName".into()),
            sort_order: Some("ASC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY ps.style_name ASC");

        // 显式主键属性名 ⇒ 主键列
        let q = ProductStyleListQuery {
            sort_field: Some("styleId".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY ps.style_id ASC");

        // 非法 sortOrder ⇒ **降序**（不是不排序！与 area_code 的 BaseServiceImpl 不同）
        let q = ProductStyleListQuery {
            sort_field: Some("status".into()),
            sort_order: Some("weird".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY ps.status DESC");

        // 未识别 sortField ⇒ 回退主键（防注入）
        let q = ProductStyleListQuery {
            sort_field: Some("1; DROP TABLE product_style".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY ps.style_id ASC");
    }

    /// 分页默认值与 Java `BasePage` 一致：page 1、size 15、上限 100。
    #[test]
    fn page_query_defaults_match_base_page() {
        let q = ProductStyleListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);

        let q = ProductStyleListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);

        let q = ProductStyleListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);

        let q = ProductStyleListQuery {
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
    }

    /// `keyword` 去空白后为空则不过滤（mapper XML 的 `<if>` 判据）。
    #[test]
    fn effective_keyword_trims_and_ignores_blank() {
        let q = ProductStyleListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), None);
        let q = ProductStyleListQuery {
            keyword: Some(" 新年 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), Some("新年"));
    }

    // ————————————————————— 纯逻辑：入参校验 —————————————————————

    /// `create` / `update` 的必填与长度校验
    /// （Java `@NotBlank` / `@NotNull` / `@Size(min = 1, max = 120)`）。
    #[test]
    fn save_validation_messages() {
        // 全缺 ⇒ 先报样式名称
        let empty = ProductStyleSaveDTO::default();
        assert_eq!(validate_save(&empty).unwrap_err(), MSG_STYLE_NAME_NOT_BLANK);

        // 有名称但缺类型
        let no_type: ProductStyleSaveDTO =
            serde_json::from_str(r#"{"styleName":"新年","styleImage":"a.png"}"#).unwrap();
        assert_eq!(
            validate_save(&no_type).unwrap_err(),
            MSG_STYLE_TYPE_NOT_NULL
        );

        // 有名称与类型但缺图片
        let no_image: ProductStyleSaveDTO =
            serde_json::from_str(r#"{"styleName":"新年","styleType":1}"#).unwrap();
        assert_eq!(
            validate_save(&no_image).unwrap_err(),
            MSG_STYLE_IMAGE_NOT_BLANK
        );

        // 120 字符边界合法；121 字符报错
        let ok = ProductStyleSaveDTO {
            style_name: Some("名".repeat(120)),
            style_type: Some(1),
            style_image: Some("a.png".into()),
            ..Default::default()
        };
        assert!(validate_save(&ok).is_ok());

        let long = ProductStyleSaveDTO {
            style_name: Some("名".repeat(121)),
            style_type: Some(1),
            style_image: Some("a.png".into()),
            ..Default::default()
        };
        assert_eq!(validate_save(&long).unwrap_err(), MSG_STYLE_NAME_MAX_SIZE);

        // 空白名称（含全空格）⇒ 必填错误；名称与图片会 trim
        let trim = ProductStyleSaveDTO {
            style_name: Some("  新年  ".into()),
            style_type: Some(1),
            style_image: Some("  a.png  ".into()),
            ..Default::default()
        };
        let (n, t, i) = validate_save(&trim).unwrap();
        assert_eq!(n, "新年");
        assert_eq!(t, 1);
        assert_eq!(i, "a.png");
    }

    /// `pcImage` 归一：`null ⇒ ""`（Java `pcImage != null ? pcImage : ""`）。
    #[test]
    fn pc_image_falls_back_to_empty_string() {
        let dto = ProductStyleSaveDTO::default();
        assert_eq!(dto.pc_image_or_empty(), "");
        let dto = ProductStyleSaveDTO {
            pc_image: Some("b.png".into()),
            ..Default::default()
        };
        assert_eq!(dto.pc_image_or_empty(), "b.png");
        // 显式空串也是空串（不是 None）
        let dto = ProductStyleSaveDTO {
            pc_image: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(dto.pc_image_or_empty(), "");
    }

    /// 活动背景时间校验（Java `validateParam`）。
    #[test]
    fn activity_time_validation() {
        // 非活动背景：完全不校验**缺失**（空白落 0）
        let border = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_BORDER),
            ..Default::default()
        };
        assert_eq!(validate_activity_time(&border).unwrap(), (0, 0));

        // 但非空白且格式非法时仍要报错
        // （Java `createProductStyle()` 里 `TigUtils.toTimestampYmdHms` 会抛异常）
        let border_bad = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_BORDER),
            start_time: Some("2026/01/01 00:00:00".into()),
            ..Default::default()
        };
        assert!(validate_activity_time(&border_bad).is_err());

        // 非活动背景带合法时间 ⇒ 正常解析（不是 0）
        let border_ok = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_BORDER),
            start_time: Some("2026-01-01 00:00:00".into()),
            end_time: Some("2026-01-02 00:00:00".into()),
            ..Default::default()
        };
        let (s, e) = validate_activity_time(&border_ok).unwrap();
        assert_eq!(s, 1_767_196_800);
        assert_eq!(e - s, 86_400);

        // 活动背景：缺开始时间
        let no_start = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_ACTIVITY_BACKGROUND),
            ..Default::default()
        };
        assert_eq!(
            validate_activity_time(&no_start).unwrap_err(),
            MSG_START_TIME_REQUIRED
        );

        // 活动背景：有开始、缺结束
        let no_end = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_ACTIVITY_BACKGROUND),
            start_time: Some("2026-01-01 00:00:00".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_activity_time(&no_end).unwrap_err(),
            MSG_END_TIME_REQUIRED
        );

        // end == start ⇒ 报错（Java `end > start` 严格大于）
        let equal = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_ACTIVITY_BACKGROUND),
            start_time: Some("2026-01-01 00:00:00".into()),
            end_time: Some("2026-01-01 00:00:00".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_activity_time(&equal).unwrap_err(),
            MSG_END_MUST_AFTER_START
        );

        // end < start ⇒ 报错
        let reversed = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_ACTIVITY_BACKGROUND),
            start_time: Some("2026-01-02 00:00:00".into()),
            end_time: Some("2026-01-01 00:00:00".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_activity_time(&reversed).unwrap_err(),
            MSG_END_MUST_AFTER_START
        );

        // end > start ⇒ 通过，且时间戳递增
        let good = ProductStyleSaveDTO {
            style_type: Some(STYLE_TYPE_ACTIVITY_BACKGROUND),
            start_time: Some("2026-01-01 00:00:00".into()),
            end_time: Some("2026-01-02 00:00:00".into()),
            ..Default::default()
        };
        let (s, e) = validate_activity_time(&good).unwrap();
        assert!(e > s);
        assert_eq!(e - s, 86_400);
    }

    // ————————————————————— 纯逻辑：时间解析 —————————————————————

    /// `yyyy-MM-dd HH:mm:ss` 解析为秒级时间戳（UTC+8）。
    #[test]
    fn parse_hms_epoch_reference_points() {
        // 1970-01-01 00:00:00 UTC+8 == Unix 0 - 8h == -28800
        assert_eq!(parse_time_hms("1970-01-01 00:00:00").unwrap(), -28_800);
        // 1970-01-01 08:00:00 UTC+8 == Unix 0
        assert_eq!(parse_time_hms("1970-01-01 08:00:00").unwrap(), 0);
        // 2026-01-01 00:00:00 UTC+8 == 1767196800
        assert_eq!(
            parse_time_hms("2026-01-01 00:00:00").unwrap(),
            1_767_196_800
        );
        // 相邻两天相差 86400
        assert_eq!(
            parse_time_hms("2026-01-02 00:00:00").unwrap()
                - parse_time_hms("2026-01-01 00:00:00").unwrap(),
            86_400
        );
        // 闰年 2 月 29 日存在
        assert!(parse_time_hms("2024-02-29 12:00:00").is_ok());
        // 平年 2 月 29 日不存在
        assert!(parse_time_hms("2023-02-29 12:00:00").is_err());
    }

    /// `yyyy-MM-dd` 解析等价于当日 00:00:00（Java `toTimestampYmd`）。
    #[test]
    fn parse_ymd_matches_midnight() {
        assert_eq!(
            parse_time_ymd("2026-01-01").unwrap(),
            parse_time_hms("2026-01-01 00:00:00").unwrap()
        );
        assert_eq!(parse_time_ymd(" 2026-01-01 ").unwrap(), 1_767_196_800);
    }

    /// 非法格式一律 `Err`（不 panic）。
    #[test]
    fn parse_rejects_malformed_input() {
        for bad in [
            "",
            "2026/01/01",
            "2026-1-1",
            "2026-13-01",
            "2026-00-01",
            "2026-01-32",
            "20260101",
            "not-a-date",
        ] {
            assert!(parse_time_ymd(bad).is_err(), "应拒绝: {bad}");
        }
        for bad in [
            "",
            "2026-01-01",
            "2026-01-01 00:00",
            "2026-01-01T00:00:00",
            "2026-01-01 24:00:00",
            "2026-01-01 00:60:00",
            "2026-01-01 00:00:61",
        ] {
            assert!(parse_time_hms(bad).is_err(), "应拒绝: {bad}");
        }
    }

    /// 列表查询的时间参数解析：空白 ⇒ 不过滤；非法 ⇒ `Err`。
    #[test]
    fn list_query_time_parsing() {
        let q = ProductStyleListQuery::default();
        assert_eq!(q.parsed_start_time().unwrap(), None);
        assert_eq!(q.parsed_end_time().unwrap(), None);

        let q = ProductStyleListQuery {
            start_time: Some("   ".into()),
            end_time: Some("2026-01-01".into()),
            ..Default::default()
        };
        assert_eq!(q.parsed_start_time().unwrap(), None);
        assert_eq!(q.parsed_end_time().unwrap(), Some(1_767_196_800));

        let q = ProductStyleListQuery {
            start_time: Some("2026/01/01".into()),
            ..Default::default()
        };
        assert!(q.parsed_start_time().is_err());
    }

    /// 可空时间归一：空白 ⇒ 0；非空白 ⇒ 解析值。
    #[test]
    fn parse_time_opt_hms_semantics() {
        assert_eq!(
            parse_time_opt_hms(None, MSG_START_TIME_REQUIRED).unwrap(),
            0
        );
        assert_eq!(
            parse_time_opt_hms(Some(""), MSG_START_TIME_REQUIRED).unwrap(),
            0
        );
        assert_eq!(
            parse_time_opt_hms(Some("   "), MSG_START_TIME_REQUIRED).unwrap(),
            0
        );
        assert_eq!(
            parse_time_opt_hms(Some("1970-01-01 08:00:00"), MSG_START_TIME_REQUIRED).unwrap(),
            0
        );
        assert!(parse_time_opt_hms(Some("bad"), MSG_START_TIME_REQUIRED).is_err());
    }

    /// `now_secs` 应返回一个合理的现代时间戳（> 2020-01-01）。
    #[test]
    fn now_secs_is_plausible() {
        assert!(now_secs() > 1_577_836_800);
    }

    // ————————————————————— 纯逻辑：去重 —————————————————————

    /// 关联 ID 去重保持首次出现顺序（Java `!existingRefIds.contains(refId)` 的请求内效果）。
    #[test]
    fn dedup_ids_keeps_first_occurrence_order() {
        assert_eq!(dedup_ids(&[3, 1, 3, 2, 1]), vec![3, 1, 2]);
        assert_eq!(dedup_ids(&[]), Vec::<i32>::new());
        assert_eq!(dedup_ids(&[5]), vec![5]);
    }

    // ————————————————————— DTO 反序列化 —————————————————————

    /// 更新请求的继承展开（Java `ProductStyleEditParam extends ProductStyleSaveParam`）。
    #[test]
    fn edit_dto_flattens_base_fields() {
        let dto: ProductStyleEditDTO = serde_json::from_str(
            r#"{"styleId":9,"styleName":"新年","styleType":2,"styleImage":"a.png","pcImage":"b.png","productIds":[1,2]}"#,
        )
        .unwrap();
        assert_eq!(dto.style_id, Some(9));
        assert_eq!(dto.as_save().style_name.as_deref(), Some("新年"));
        assert_eq!(dto.as_save().style_type, Some(2));
        assert_eq!(dto.base.product_ids, Some(vec![1, 2]));
    }

    /// 关联批量参数缺 `styleId` 时可反序列化（必填校验在服务层）。
    #[test]
    fn item_batch_dto_optional_lists() {
        let dto: ProductStyleItemBatchDTO =
            serde_json::from_str(r#"{"styleId":7,"productIds":[1]}"#).unwrap();
        assert_eq!(dto.style_id, Some(7));
        assert!(!dto.is_empty());
        assert_eq!(dto.group_ids, None);

        let dto: ProductStyleItemBatchDTO = serde_json::from_str(r#"{"styleId":7}"#).unwrap();
        assert!(dto.is_empty());

        // 空数组也算「空」（Java `CollUtil.isNotEmpty` 判据）
        let dto: ProductStyleItemBatchDTO =
            serde_json::from_str(r#"{"styleId":7,"productIds":[],"groupIds":[],"brandIds":[]}"#)
                .unwrap();
        assert!(dto.is_empty());
    }

    /// `BatchDTO` / `UpdateFieldDTO` / `OperateDTO` 的反序列化。
    #[test]
    fn common_dtos_deserialize() {
        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":0}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);

        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[],"type":"show"}"#).unwrap();
        assert!(dto.ids.is_empty());

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"status","val":"0"}"#).unwrap();
        assert_eq!(dto.id, Some(1));
        assert_eq!(dto.field.as_deref(), Some("status"));
        assert_eq!(dto.val.as_deref(), Some("0"));

        // 缺 id 仍可反序列化 ⇒ 由服务层按 Java `@NotNull` 文案报错
        let dto: UpdateFieldDTO = serde_json::from_str(r#"{"field":"status","val":"0"}"#).unwrap();
        assert_eq!(dto.id, None);

        let dto: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, None);
    }

    /// 列表查询反序列化 Java 参数名（`size` 而非 `pageSize`）。
    #[test]
    fn list_query_deserializes_java_param_names() {
        let q: ProductStyleListQuery = serde_json::from_str(
            r#"{"styleType":2,"status":1,"activityStatus":2,"startTime":"2026-01-01","endTime":"2026-02-01","keyword":"新","sortField":"productCount","sortOrder":"asc","page":2,"size":30}"#,
        )
        .unwrap();
        assert_eq!(q.style_type, Some(2));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.activity_status, Some(2));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(
            q.order_clause(),
            " ORDER BY product_count ASC, ps.style_id DESC"
        );
        assert_eq!(q.parsed_start_time().unwrap(), Some(1_767_196_800));
    }

    // ————————————————————— VO 组装 —————————————————————

    /// VO 由实体组装 + 三个派生字段（`styleTypeName` /
    /// `activityStatus` / `activityStatusName`）。
    #[test]
    fn vo_from_entity_derives_names() {
        let s = ProductStyle {
            style_id: 3,
            style_name: "新年".into(),
            style_type: STYLE_TYPE_ACTIVITY_BACKGROUND,
            style_image: "a.png".into(),
            pc_image: "b.png".into(),
            start_time: 100,
            end_time: 200,
            status: 1,
            shop_id: 0,
            add_time: 50,
            update_time: 60,
            is_delete: 0,
        };
        // now=150 ⇒ 进行中
        let vo = ProductStyleVO::from_entity(&s, 7, 150);
        assert_eq!(vo.style_id, 3);
        assert_eq!(vo.style_type_name.as_deref(), Some("活动背景"));
        assert_eq!(vo.activity_status, Some(ACTIVITY_STATUS_IN_PROGRESS));
        assert_eq!(vo.activity_status_name.as_deref(), Some("活动进行中"));
        assert_eq!(vo.product_count, 7);
        assert_eq!(vo.shop_id, 0);

        // now=99 ⇒ 未开始
        let vo = ProductStyleVO::from_entity(&s, 0, 99);
        assert_eq!(vo.activity_status, Some(ACTIVITY_STATUS_NOT_STARTED));
        assert_eq!(vo.activity_status_name.as_deref(), Some("活动未开始"));

        // now=201 ⇒ 已结束
        let vo = ProductStyleVO::from_entity(&s, 0, 201);
        assert_eq!(vo.activity_status, Some(ACTIVITY_STATUS_ENDED));
        assert_eq!(vo.activity_status_name.as_deref(), Some("活动已结束"));

        // 非法 styleType ⇒ 类型名为 null（Java `getTypeName` 返回 null）
        let bad = ProductStyle {
            style_type: 99,
            ..s
        };
        let vo = ProductStyleVO::from_entity(&bad, 0, 150);
        assert_eq!(vo.style_type_name, None);
    }

    /// VO 的 JSON 字段名必须是 camelCase（与原接口逐字符一致）。
    #[test]
    fn vo_serializes_camel_case() {
        let vo = ProductStyleVO {
            style_id: 1,
            style_name: "新年".into(),
            style_type: 1,
            style_type_name: Some("边框背景".into()),
            product_count: 2,
            activity_status: Some(2),
            activity_status_name: Some("活动进行中".into()),
            ..Default::default()
        };
        let json = serde_json::to_string(&vo).unwrap();
        for key in [
            "styleId",
            "styleName",
            "styleType",
            "styleTypeName",
            "styleImage",
            "pcImage",
            "startTime",
            "endTime",
            "shopId",
            "addTime",
            "updateTime",
            "productCount",
            "activityStatus",
            "activityStatusName",
        ] {
            assert!(
                json.contains(&format!("\"{key}\"")),
                "缺少字段 {key}: {json}"
            );
        }
        // 不出现 snake_case 泄漏
        assert!(!json.contains("style_id"));
        assert!(!json.contains("product_count"));
    }

    /// 详情 VO 的扁平展开：父类字段与子类字段同层
    /// （Java `ProductStyleDetailVO extends ProductStyleVO`）。
    #[test]
    fn detail_vo_flattens_base() {
        let dto = ProductStyleDetailVO {
            base: ProductStyleVO {
                style_id: 5,
                style_name: "新年".into(),
                ..Default::default()
            },
            product_ids: vec![1],
            group_ids: vec![],
            brand_ids: vec![2],
            product_list: vec![ProductItemVO {
                product_id: 1,
                product_name: "商品A".into(),
                pic_thumb: "p.png".into(),
                product_price: Decimal::new(1999, 2),
            }],
            group_list: vec![],
            brand_list: vec![BrandItemVO {
                brand_id: 2,
                brand_name: "品牌B".into(),
            }],
        };
        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"styleId\""));
        assert!(json.contains("\"productIds\""));
        assert!(json.contains("\"brandIds\""));
        assert!(json.contains("\"productList\""));
        assert!(json.contains("\"brandList\""));
        // 金额序列化为字符串或数字都可接受，但必须来自 Decimal 而非 f64
        assert_eq!(dto.product_list[0].product_price, Decimal::new(1999, 2));
    }

    /// 品牌 VO 由实体映射。
    #[test]
    fn brand_vo_from_entity() {
        // `Brand` 已由模块顶部的 `use crate::entities::{Brand, ProductStyle};` 引入
        let b = Brand {
            brand_id: 4,
            brand_name: "品牌B".into(),
            ..Default::default()
        };
        let vo = brand_product_count_vo(&b, 12);
        assert_eq!(vo.brand_id, 4);
        assert_eq!(vo.brand_name, "品牌B");
        assert_eq!(vo.product_count, 12);
    }
}

// ——————————————————————————————————————————————
// 公共端（/api/product/productStyle，optional auth）
// ——————————————————————————————————————————————

/// 样式类型：边框背景（Java `ProductStyleTypeEnum.BORDER`）。
pub const STYLE_TYPE_BORDER_ACTIVE: i32 = 1;
/// 样式类型：活动背景（Java `ProductStyleTypeEnum.ACTIVITY_BACKGROUND`）。
pub const STYLE_TYPE_ACTIVITY_BACKGROUND_ACTIVE: i32 = 2;

/// 商品当前生效样式（Java `ProductActiveStyleVO`）。
///
/// 公共端 3 个端点（`activeStyle` / `batchActiveStyle` /
/// `batchActiveStyleBySn`）共用：同一商品可同时命中边框背景与活动背景两类，
/// 每类取 `itemAddTime` 最新一条（服务层按 `add_time DESC` 首行赋值）。
///
/// # 与 Java 的差异
/// Java `translatePackage.translate(styleImage, 19)` 做多语言翻译；Rust 未
/// 迁移翻译包，直接返回库内原值。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductActiveStyleVO {
    pub border_style_id: Option<i32>,
    pub border_image: Option<String>,
    pub border_pc_image: Option<String>,
    pub activity_style_id: Option<i32>,
    pub activity_style_name: Option<String>,
    pub activity_background_image: Option<String>,
    pub activity_background_pc_image: Option<String>,
}

impl ProductActiveStyleVO {
    /// 按 Java `batchGetActiveStyles` 合并一行（每类只取首行）。
    pub fn apply_row(
        &mut self,
        style_type: i32,
        style_id: i32,
        style_name: Option<&str>,
        style_image: Option<&str>,
        pc_image: Option<&str>,
    ) {
        if style_type == STYLE_TYPE_BORDER_ACTIVE && self.border_style_id.is_none() {
            self.border_style_id = Some(style_id);
            self.border_image = style_image.map(str::to_string);
            self.border_pc_image = pc_image.map(str::to_string);
        } else if style_type == STYLE_TYPE_ACTIVITY_BACKGROUND_ACTIVE
            && self.activity_style_id.is_none()
        {
            self.activity_style_id = Some(style_id);
            self.activity_style_name = style_name.map(str::to_string);
            self.activity_background_image = style_image.map(str::to_string);
            self.activity_background_pc_image = pc_image.map(str::to_string);
        }
    }

    /// 是否为空 VO（Java 找不到时返回 `new ProductActiveStyleVO()`）。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.border_style_id.is_none()
            && self.activity_style_id.is_none()
            && self.border_image.is_none()
            && self.activity_background_image.is_none()
    }
}

#[cfg(test)]
mod public_active_style_tests {
    use super::*;

    #[test]
    fn apply_row_keeps_first_per_style_type() {
        let mut vo = ProductActiveStyleVO::default();
        vo.apply_row(
            STYLE_TYPE_BORDER_ACTIVE,
            3,
            Some("边框"),
            Some("b.png"),
            Some("b_pc.png"),
        );
        vo.apply_row(
            STYLE_TYPE_BORDER_ACTIVE,
            9,
            Some("边框2"),
            Some("x.png"),
            None,
        );
        assert_eq!(vo.border_style_id, Some(3));
        assert_eq!(vo.border_image.as_deref(), Some("b.png"));
        // 边框不落 styleName（Java 行为）
        assert!(vo.activity_style_name.is_none());

        vo.apply_row(
            STYLE_TYPE_ACTIVITY_BACKGROUND_ACTIVE,
            5,
            Some("活动"),
            Some("a.png"),
            Some("a_pc.png"),
        );
        assert_eq!(vo.activity_style_id, Some(5));
        assert_eq!(vo.activity_style_name.as_deref(), Some("活动"));
        assert_eq!(vo.activity_background_pc_image.as_deref(), Some("a_pc.png"));
        assert!(!vo.is_empty());
    }

    #[test]
    fn empty_vo_serializes_null_fields() {
        let vo = ProductActiveStyleVO::default();
        assert!(vo.is_empty());
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["borderStyleId"], serde_json::Value::Null);
        assert_eq!(json["activityStyleName"], serde_json::Value::Null);
    }

    #[test]
    fn style_type_constants_match_java_enum() {
        assert_eq!(STYLE_TYPE_BORDER_ACTIVE, 1);
        assert_eq!(STYLE_TYPE_ACTIVITY_BACKGROUND_ACTIVE, 2);
    }
}
