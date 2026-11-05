//! 订单配置域（merchant::order_config）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.shop.OrderConfigController`
//!   （`@RequestMapping("/adminapi/shop/orderConfig")`）
//! - `com.tigshop.bean.model.shop.OrderConfig`（表 `order_config`）
//! - `com.tigshop.bean.dto.shop.OrderConfigListDTO extends BasePage`
//! - `com.tigshop.bean.dto.shop.OrderConfigCreateDTO`
//! - `com.tigshop.bean.dto.shop.OrderConfigUpdateDTO`
//! - `com.tigshop.bean.vo.shop.OrderConfigVO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.shop.OrderConfigConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.ORDER_CONFIG_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## ⚠️ 本域最重要的发现：VO 与实体列**完全对不上**
//!
//! Java `OrderConfigVO` 声明的 7 个字段是
//! `orderConfigId` / `orderConfigName` / `orderConfigPic` / `sortOrder`
//! / `isShow` / `status` / `orderConfigDesc`；
//! 而表 `order_config` 只有 4 列
//! （`python tools/schema_parser.py --table order_config`）：
//! `id` / `shop_id` / `code` / `data`。
//!
//! 这是同一套脚手架在别的域（如 `shop_product_category`）上复制粘贴后
//! **没有改 VO 字段名**造成的。`BeanUtils.copyProperties(orderConfig, vo)`
//! 只按**属性名相同**拷贝，因此这 7 个字段**一个都拷不过去**，
//! Java 实际返回的 VO 是「7 个字段全为 null」的空壳。
//!
//! 本实现的选择（详见 `crates/services/src/order_config.rs` 模块头）：
//! **按表真实列返回**，因为那才是这张表唯一有意义的投影；
//! 同时把 Java 的原始字段形状保留在 [`OrderConfigJavaShapeVO`]，
//! 供主会话 / 产品在确认前端到底读哪套字段后一行切换。
//! 两者都列入 `uncertain_points`。
//!
//! ## 金额
//!
//! 本域（订单配置键值对维护）**完全不涉及任何金额列**，因此没有
//! `rust_decimal::Decimal` 出场（表 4 列中只有 `id` / `shop_id` 为整数，
//! 其余为 `varchar(50)` / `text`）。

use serde::{Deserialize, Serialize};

use crate::entities::OrderConfig;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `OrderConfigConstants` / `CheckFieldConstants`）
// ——————————————————————————————————————————————

/// `order_config` 真实存在的 4 个列
/// （`python tools/schema_parser.py --table order_config`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const ORDER_CONFIG_COLUMNS: [&str; 4] = ["id", "shop_id", "code", "data"];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.ORDER_CONFIG_FIELDS`）。
///
/// ⚠️ **Java 原值是空数组 `{}`**（`CheckFieldConstants.java:76`：
/// `public static final String[] ORDER_CONFIG_FIELDS = {};`）。
/// 因此 Java 的 `updateField` 对**任何**字段都必然抛
/// `字段值不合法`（`Arrays.asList(allowFields).contains(field)` 恒为 false）
/// —— 这个接口在 Java 里是**恒定失败**的。
///
/// 本实现逐字符复刻该行为（见 [`crate::models::merchant::order_config::ORDER_CONFIG_FIELDS`]
/// 的使用点 `OrderConfigService::update_field`），不做「顺手修好」。
/// 若产品确认 `updateField` 应当可用，把这里改成
/// `["code", "data"]`（`shop_id` 属于租户隔离列，不宜由前端直改）即可启用，
/// 但这是**与当前 Java 线上行为不一致**的变更，需产品确认。
pub const ORDER_CONFIG_FIELDS: [&str; 0] = [];

/// 「是」的取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `OrderConfigConstants._NOT_NULL`（`OrderConfigCreateDTO.orderConfigName`
/// 上的 `@NotBlank(message = _NOT_NULL)`）。
pub const MSG_ORDER_CONFIG_NAME_NOT_BLANK: &str = "订单配置名称不能为空";

/// Java `OrderConfigConstants._OVER_LENGTH`（`OrderConfigCreateDTO.orderConfigName`
/// 上的 `@Size(max = 50, message = _OVER_LENGTH)`）。
pub const MSG_ORDER_CONFIG_NAME_OVER_LENGTH: &str = "订单配置名称长度不能超过50";

/// Java `OrderConfigConstants.ORDER_CONFIG_ID_NOT_NULL`（`OrderConfigUpdateDTO.orderConfigId`
/// 上的 `@NotNull(message = ORDER_CONFIG_ID_NOT_NULL)`）。
pub const MSG_ORDER_CONFIG_ID_NOT_NULL: &str = "订单配置id不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`
/// 上的 `@NotNull(message = ID_CANNOT_IS_NULL)`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// `order_config.code` 的最大长度（表列 `varchar(50)`；
/// 与 `OrderConfigCreateDTO` 上 `@Size(max = 50)` 的「名称」阈值数值相同，
/// 但那处约束作用于 `orderConfigName`，与本列不是同一个字段，见 `uncertain_points`）。
pub const CODE_MAX_LEN: usize = 50;

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_ORDER_CONFIG_NOT_FOUND: &str = "订单配置不存在";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 订单配置 VO —— **按表真实列返回**（本实现的默认口径）。
///
/// 字段与 [`OrderConfig`] 实体一一对应，用 `From<&OrderConfig>` 直接映射。
///
/// ⚠️ 这不是 Java `OrderConfigVO` 的字段形状，理由见模块头
/// 「VO 与实体列完全对不上」一节：Java 的 VO 7 个字段在 `order_config`
/// 表里一个都不存在，`BeanUtils.copyProperties` 实际拷不出任何值。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigVO {
    /// 主键（Java `OrderConfig.id`）
    pub id: i32,
    /// 店铺 id（Java `OrderConfig.shopId`）
    pub shop_id: i32,
    /// 编码（Java `OrderConfig.code`）
    pub code: String,
    /// `[json]` 配置数据原文（Java `OrderConfig.data`，列可空 ⇒ `Option`）
    pub data: Option<String>,
}

impl From<&OrderConfig> for OrderConfigVO {
    fn from(c: &OrderConfig) -> Self {
        Self {
            id: c.id,
            shop_id: c.shop_id,
            code: c.code.clone(),
            data: c.data.clone(),
        }
    }
}

impl From<OrderConfig> for OrderConfigVO {
    fn from(c: OrderConfig) -> Self {
        Self::from(&c)
    }
}

/// Java `OrderConfigVO` 的**原样字段形状**（7 字段），供对照 / 切换用。
///
/// 逐字符对照 `com.tigshop.bean.vo.shop.OrderConfigVO`：
/// `orderConfigId` / `orderConfigName` / `orderConfigPic` / `sortOrder`
/// / `isShow` / `status` / `orderConfigDesc`。
///
/// 当前**未被任何路由使用**（本切片默认返回 [`OrderConfigVO`]），保留它是为了：
/// 1. 让「Java 到底返回了什么」有可编译的证据；
/// 2. 主会话 / 产品确认前端读哪套字段后，改 `OrderConfigService` 的返回类型即可，
///    不必重读 Java 源码。
///
/// Java 侧这些字段在 `order_config` 表里**没有对应列**，
/// `BeanUtils.copyProperties` 拷不出值 ⇒ 线上实际返回 7 个 `null`。
/// [`OrderConfigJavaShapeVO::from_java_behavior`] 复刻的正是这个「全 null」结果。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigJavaShapeVO {
    /// Java `orderConfigId`（表无此列 ⇒ 恒 null）
    pub order_config_id: Option<i32>,
    /// Java `orderConfigName`（表无此列 ⇒ 恒 null）
    pub order_config_name: Option<String>,
    /// Java `orderConfigPic`（表无此列 ⇒ 恒 null）
    pub order_config_pic: Option<String>,
    /// Java `sortOrder`（表无此列 ⇒ 恒 null）
    pub sort_order: Option<i32>,
    /// Java `isShow`（表无此列 ⇒ 恒 null）
    pub is_show: Option<i32>,
    /// Java `status`（表无此列 ⇒ 恒 null）
    pub status: Option<i32>,
    /// Java `orderConfigDesc`（表无此列 ⇒ 恒 null）
    pub order_config_desc: Option<String>,
}

impl OrderConfigJavaShapeVO {
    /// 复刻 Java `list` / `detail` 的**可观测输出**：7 个字段全为 `null`。
    ///
    /// 依据：`BeanUtils.copyProperties(orderConfig, orderConfigVO)` 按属性名拷贝，
    /// 而 `OrderConfig` 的 4 个属性（`id` / `shopId` / `code` / `data`）
    /// 与 `OrderConfigVO` 的 7 个属性**无一重名**，因此一个都拷不过去。
    #[must_use]
    pub fn from_java_behavior(_c: Option<&OrderConfig>) -> Self {
        Self::default()
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `OrderConfigListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder`
/// （还有 `sortItems`，但本域 Java 调的是三参数重载
/// `buildSortOrder(page, dto.getSortField(), dto.getSortOrder())`，
/// **不使用** `sortItems`；`keyword` 与 `isShow` 的过滤在 Java 里被注释掉了）。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`OrderConfigListQuery::page_query`] 完成桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigListQuery {
    /// 是否展示（Java `isShow`）。
    ///
    /// ⚠️ Java `OrderConfigServiceImpl#list` 里对应的过滤代码**被整段注释掉了**
    /// （第 61–64 行 `/* if (IsShowType.fromTypeCode(isShow) != null) {...} */`），
    /// 因此该参数在 Java 中**完全不影响结果**。本实现同样**不过滤**，
    /// 仅在结构体里保留字段以免前端传参报错（见 `uncertain_points`）。
    pub is_show: Option<i32>,
    /// 搜索关键字（Java `keyword`）。⚠️ 同样被注释掉（第 67–70 行），
    /// 本实现**不参与过滤**。
    pub keyword: Option<String>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值或空 ⇒ 降序，Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl OrderConfigListQuery {
    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100
    /// （`getSize()` 里 `size > 100 ? 100 : size`）。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`，见 `uncertain_points`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// - `sortField` 为空或等于主键属性名 `id` → 主键列
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序；`desc` 或空降序；
    ///   **其它非法值完全不追加 ORDER BY**（Java 的 `if / else if` 缺口）
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == "id" {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            // Java `buildSortOrder` 是 `if asc {..} else if desc||empty {..}`，
            // 非法值落到两分支之外 ⇒ page.orders 保持为空 ⇒ 无 ORDER BY
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `order_config` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "shopId" | "shop_id" => "shop_id",
        "code" => "code",
        "data" => "data",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 字段名 → 列名（Java `getColumnByPropertyName` + 白名单）。
///
/// 与 [`map_order_column`] 同源（都是 `getColumnByPropertyName`），
/// 区别是这里返回 `Option`：**未识别即 `None`**。
/// Java 在未识别时回退主键列 `id`，而 `id` 不在（空的）白名单里，
/// 因此最终同样抛 `字段值不合法`；用 `Option` 表达更直白，
/// 对白名单的判定结果与 Java **完全一致**。
///
/// ⚠️ `id` 能命中并返回 `Some("id")`（Java 的 `getColumnByPropertyName`
/// 对主键列属性名直接返回主键列），随后被白名单拒绝。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field.trim() {
        "id" => Some("id"),
        "shopId" | "shop_id" => Some("shop_id"),
        "code" => Some("code"),
        "data" => Some("data"),
        _ => None,
    }
}

/// 创建请求（Java `OrderConfigCreateDTO`）。
///
/// Java 侧 `@NotBlank` / `@Size(max = 50)` 作用于 **`orderConfigName`**，
/// 且控制器类上有类级 `@Validated` + 方法参数 `@Valid`，因此这些注解**确实生效**
/// —— 但是 `OrderConfigCreateDTO` 的 7 个属性里，
/// `orderConfigName` / `orderConfigPic` / `sortOrder` / `isShow` / `status`
/// / `orderConfigDesc` **一个都不是 `order_config` 表的列**。
///
/// 因此 Java `create` 的可观测行为是：
/// 1. 校验 `orderConfigName` 非空且 ≤ 50 字符（**会真实报错**）；
/// 2. `BeanUtils.copyProperties` 拷不到任何列 ⇒ `orderConfig` 的
///    `shopId` 为 `null`、`code` 为 `null`、`data` 为 `null`；
/// 3. `save(orderConfig)` 因 `shop_id` / `code` 两列 `NOT NULL`
///    而抛 `DataIntegrityViolationException`（SQL 异常）。
///
/// 本实现保留第 1 步的校验与文案（可编译、可测试），
/// 第 2、3 步见 `OrderConfigService::create` 的说明（当前返回明确的
/// `Validation` 错误，而不是伪造一次必然违反约束的 INSERT）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigCreateDTO {
    /// 订单配置名称（Java `@NotBlank` + `@Size(max = 50)`）
    ///
    /// ⚠️ 表 `order_config` **没有**这一列（见模块头）。保留它是为了复刻
    /// Java 的入参校验行为，不参与落库。
    pub order_config_name: Option<String>,
    /// 订单配置图片（表无此列，不落库）
    pub order_config_pic: Option<String>,
    /// 订单配置排序（表无此列，不落库）
    pub sort_order: Option<i32>,
    /// 是否展示（表无此列，不落库）
    pub is_show: Option<i32>,
    /// 状态（表无此列，不落库）
    pub status: Option<i32>,
    /// 订单配置描述（表无此列，不落库）
    pub order_config_desc: Option<String>,
    /// 店铺 id。
    ///
    /// ⚠️ **Java `OrderConfigCreateDTO` 里没有这个字段**，
    /// 本实现新增它是因为表列 `shop_id` 是 `NOT NULL`，
    /// 没有它就无从落库（见 `uncertain_points`）。
    /// Java 侧该值来自请求头 `HeaderUtils.getShopId()`（多租户），
    /// 在 `create` 里也**没有被赋值**（`saveOrderConfig` 才用）。
    pub shop_id: Option<i32>,
    /// 编码。
    ///
    /// ⚠️ 同上，**Java `OrderConfigCreateDTO` 里没有这个字段**，
    /// 但表列 `code` 是 `NOT NULL`。
    pub code: Option<String>,
    /// `[json]` 配置数据（表列 `data` 可空）。
    ///
    /// ⚠️ 同上，Java DTO 里没有该字段。
    pub data: Option<String>,
}

/// 更新请求（Java `OrderConfigUpdateDTO`）。
///
/// Java 侧只有 `orderConfigId` 带 `@NotNull(message = ORDER_CONFIG_ID_NOT_NULL)`，
/// 其余 5 个字段（`orderConfigName` / `orderConfigPic` / `sortOrder`
/// / `isShow` / `status`）**无任何校验**，且**全都不是表的列**。
///
/// Java `update` 的可观测行为：`updateById` 时实体除主键外全为 `null`，
/// MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 会跳过所有 null 列 ⇒
/// 生成 `UPDATE order_config SET WHERE id = ?`（无 SET 项）。
/// 见 `OrderConfigService::update` 的处理说明。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderConfigUpdateDTO {
    /// 订单配置 ID（Java `@NotNull(message = "订单配置id不能为空")`）
    pub order_config_id: Option<i32>,
    /// 订单配置名称（表无此列，不落库）
    pub order_config_name: Option<String>,
    /// 订单配置图片（表无此列，不落库）
    pub order_config_pic: Option<String>,
    /// 订单配置排序（表无此列，不落库）
    pub sort_order: Option<i32>,
    /// 是否展示（表无此列，不落库）
    pub is_show: Option<i32>,
    /// 状态（表无此列，不落库）
    pub status: Option<i32>,
    /// 店铺 id（本实现新增，见 [`OrderConfigCreateDTO::shop_id`]）
    pub shop_id: Option<i32>,
    /// 编码（本实现新增，见 [`OrderConfigCreateDTO::code`]）
    pub code: Option<String>,
    /// `[json]` 配置数据（本实现新增，见 [`OrderConfigCreateDTO::data`]）
    pub data: Option<String>,
}

impl OrderConfigUpdateDTO {
    /// 提取并校验主键（Java `@NotNull` 语义）。
    ///
    /// # Errors
    /// 主键缺失或非正数 ⇒ `订单配置id不能为空`
    pub fn require_id(&self) -> Result<i32, String> {
        match self.order_config_id {
            Some(id) if id > 0 => Ok(id),
            _ => Err(MSG_ORDER_CONFIG_ID_NOT_NULL.to_string()),
        }
    }
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（Java `@NotNull(message = ID_CANNOT_IS_NULL)`）
    pub id: Option<i32>,
    /// 备注（Java `adminNote`，本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（Java `pageType`，本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`，
/// 本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（Java `@NotNull(message = ID_CANNOT_IS_NULL)`）
    pub id: Option<i32>,
    /// 字段名（Java `@NotNull(message = FIELD_NAME_CANNOT_BE_NULL)`）
    pub field: Option<String>,
    /// 值（Java `@NotNull(message = FIELD_VALUE_CANNOT_BE_NULL)`，字符串绑定）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`，本域自持副本）。
///
/// `type` 是 Rust 关键字，用 `r#type` + `#[serde(rename = "type")]`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合（Java `@NotEmpty(message = UNSELECTED_ITEM)`）
    pub ids: Vec<i32>,
    /// 操作类型（Java `@NotNull(message = OPERATION_TYPE_IS_NULL)`）
    #[serde(rename = "type")]
    pub r#type: String,
    /// 值（Java `int value`，本域 `batch` 不使用）
    pub value: Option<i32>,
    /// 数据（Java `Map<String, Object> data`，本域 `batch` 不使用）
    pub data: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// 入参校验（纯函数，便于单测）
// ——————————————————————————————————————————————

/// `create` 的入参校验（Java `OrderConfigCreateDTO` 上的 bean validation）。
///
/// 逐条对照 Java 注解：
/// - `orderConfigName` 上 `@NotBlank(message = "订单配置名称不能为空")`
/// - `orderConfigName` 上 `@Size(max = 50, message = "订单配置名称长度不能超过50")`
///
/// 其它 5 个字段（`orderConfigPic` / `sortOrder` / `isShow` / `status`
/// / `orderConfigDesc`）在 Java 上**没有任何注解**，因此不校验。
///
/// 返回校验通过的**名称**（供调用方日志 / 后续切换使用）。
///
/// # Errors
/// 返回逐字符照抄 Java 常量的提示语。
pub fn validate_create(dto: &OrderConfigCreateDTO) -> Result<String, String> {
    let name = dto
        .order_config_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_ORDER_CONFIG_NAME_NOT_BLANK.to_string())?;
    // `@Size(max = 50)` 在 Java 里按 UTF-16 code unit 计数（`String.length()`）；
    // Rust `chars().count()` 与 ASCII / 常用汉字场景一致。
    if name.chars().count() > CODE_MAX_LEN {
        return Err(MSG_ORDER_CONFIG_NAME_OVER_LENGTH.to_string());
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `CheckFieldConstants.ORDER_CONFIG_FIELDS` 是**空数组**。
    ///
    /// 这是本域最反直觉的一点：`updateField` 在 Java 里对任何字段都必然失败。
    #[test]
    fn order_config_fields_is_empty_like_java() {
        assert!(ORDER_CONFIG_FIELDS.is_empty());
        assert_eq!(ORDER_CONFIG_FIELDS.len(), 0);
        // 与 GENERAL_FIELDS 不同，这里连 status / is_show / sort_order 都没有
        assert!(!ORDER_CONFIG_FIELDS.contains(&"code"));
        assert!(!ORDER_CONFIG_FIELDS.contains(&"data"));
    }

    /// Java `OrderConfigConstants` 文案逐字符照抄。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_ORDER_CONFIG_NAME_NOT_BLANK, "订单配置名称不能为空");
        assert_eq!(
            MSG_ORDER_CONFIG_NAME_OVER_LENGTH,
            "订单配置名称长度不能超过50"
        );
        assert_eq!(MSG_ORDER_CONFIG_ID_NOT_NULL, "订单配置id不能为空");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    /// 表列清单与 `schema_parser` 输出一致（4 列）。
    #[test]
    fn columns_match_schema() {
        assert_eq!(ORDER_CONFIG_COLUMNS, ["id", "shop_id", "code", "data"]);
        // 白名单里的每个列（此处为空）都必须是真实列
        for f in ORDER_CONFIG_FIELDS {
            assert!(ORDER_CONFIG_COLUMNS.contains(&f));
        }
    }

    /// Java `Constants.YES / NO`。
    #[test]
    fn yes_no_constants() {
        assert_eq!(YES, 1);
        assert_eq!(NO, 0);
    }

    // ————————————————————— 纯逻辑：list 排序 —————————————————————

    /// Java `buildSortOrder` 三分支：asc 升序；空与 desc 降序；
    /// **其它非法值不追加 ORDER BY**。
    #[test]
    fn order_clause_three_branches() {
        let q = OrderConfigListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");

        let q = OrderConfigListQuery {
            sort_order: None,
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");

        let q = OrderConfigListQuery {
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");

        // 非法值：Java else-if 未覆盖 ⇒ 无排序
        let q = OrderConfigListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    /// 未识别 `sortField` 静默回退主键列（防注入）。
    #[test]
    fn unknown_sort_field_falls_back_to_key() {
        assert_eq!(map_order_column("nope"), "id");
        assert_eq!(map_order_column("shop_id"), "shop_id");
        assert_eq!(map_order_column("shopId"), "shop_id");
        assert_eq!(map_order_column("code"), "code");
        assert_eq!(map_order_column("data"), "data");
        let q = OrderConfigListQuery {
            sort_field: Some("code; DROP TABLE order_config".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
    }

    /// `sortField` 为空或等于主键属性名 `id` 时都走主键列。
    #[test]
    fn empty_sort_field_uses_key_column() {
        for f in [None, Some(""), Some("id")] {
            let q = OrderConfigListQuery {
                sort_field: f.map(str::to_string),
                sort_order: Some("asc".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), " ORDER BY id ASC");
        }
    }

    // ————————————————————— 纯逻辑：分页 —————————————————————

    /// Java `BasePage.getPage()` / `getSize()`：默认 1 / 15，上限 100。
    #[test]
    fn page_query_defaults_and_cap() {
        let q = OrderConfigListQuery::default();
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 15);

        let q = OrderConfigListQuery {
            page: Some(3),
            size: Some(200),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 3);
        assert_eq!(p.page_size, 100);

        // 0 与负数被兜到合法区间（项目统一口径，见 uncertain_points）
        let q = OrderConfigListQuery {
            page: Some(0),
            size: Some(0),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 1);
    }

    /// `isShow` / `keyword` 被 Java 注释掉 ⇒ 不参与任何过滤条件。
    #[test]
    fn is_show_and_keyword_are_inert() {
        let a = OrderConfigListQuery {
            is_show: Some(1),
            keyword: Some("abc".into()),
            ..Default::default()
        };
        let b = OrderConfigListQuery::default();
        // 两个查询生成的 ORDER BY / 分页完全一致 ⇒ 参数确实不生效
        assert_eq!(a.order_clause(), b.order_clause());
        assert_eq!(a.page_query().page_size, b.page_query().page_size);
    }

    // ————————————————————— 纯逻辑：入参校验 —————————————————————

    /// `create` 的 `@NotBlank` + `@Size(max = 50)`（Java 文案逐字符）。
    #[test]
    fn create_validation_messages() {
        let missing = OrderConfigCreateDTO::default();
        assert_eq!(
            validate_create(&missing).unwrap_err(),
            MSG_ORDER_CONFIG_NAME_NOT_BLANK
        );

        // 纯空白同样触发 @NotBlank
        let blank = OrderConfigCreateDTO {
            order_config_name: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_create(&blank).unwrap_err(),
            MSG_ORDER_CONFIG_NAME_NOT_BLANK
        );

        // 50 字符合法，51 字符报错（边界）
        let ok = OrderConfigCreateDTO {
            order_config_name: Some("x".repeat(50)),
            ..Default::default()
        };
        assert!(validate_create(&ok).is_ok());

        let long = OrderConfigCreateDTO {
            order_config_name: Some("x".repeat(51)),
            ..Default::default()
        };
        assert_eq!(
            validate_create(&long).unwrap_err(),
            MSG_ORDER_CONFIG_NAME_OVER_LENGTH
        );
    }

    /// `update` 的 `@NotNull(orderConfigId)`（Java 文案逐字符）。
    #[test]
    fn update_requires_id() {
        let missing = OrderConfigUpdateDTO::default();
        assert_eq!(
            missing.require_id().unwrap_err(),
            MSG_ORDER_CONFIG_ID_NOT_NULL
        );

        let zero = OrderConfigUpdateDTO {
            order_config_id: Some(0),
            ..Default::default()
        };
        assert_eq!(zero.require_id().unwrap_err(), MSG_ORDER_CONFIG_ID_NOT_NULL);

        let ok = OrderConfigUpdateDTO {
            order_config_id: Some(7),
            ..Default::default()
        };
        assert_eq!(ok.require_id().unwrap(), 7);
    }

    // ————————————————————— 纯逻辑：updateField 白名单 —————————————————————

    /// 归一 + 白名单：四个真实列都能归一出列名，但白名单为空 ⇒ 全部被拒。
    #[test]
    fn update_field_whitelist_flow() {
        for (input, column) in [
            ("id", "id"),
            ("shopId", "shop_id"),
            ("shop_id", "shop_id"),
            ("code", "code"),
            ("data", "data"),
        ] {
            let c = map_update_field_column(input).unwrap();
            assert_eq!(c, column);
            // Java `ORDER_CONFIG_FIELDS` 为空数组 ⇒ 恒被拒
            assert!(!ORDER_CONFIG_FIELDS.contains(&c));
        }
        // 完全无法识别 ⇒ 归一失败（Java 回退主键列 `id`，同样不在白名单）
        assert!(map_update_field_column("something").is_none());
        assert!(map_update_field_column("orderConfigName").is_none());
    }

    // ————————————————————— 纯逻辑：VO 映射 —————————————————————

    /// 按表真实列的映射：`data` 为 null 时保持 null。
    #[test]
    fn vo_maps_real_columns() {
        let c = OrderConfig {
            id: 5,
            shop_id: 2,
            code: "settle".into(),
            data: None,
        };
        let vo = OrderConfigVO::from(&c);
        assert_eq!(vo.id, 5);
        assert_eq!(vo.shop_id, 2);
        assert_eq!(vo.code, "settle");
        assert_eq!(vo.data, None);

        let c = OrderConfig {
            data: Some("{\"useDay\":7}".into()),
            ..c
        };
        assert_eq!(
            OrderConfigVO::from(&c).data.as_deref(),
            Some("{\"useDay\":7}")
        );
    }

    /// Java `OrderConfigVO` 形状：`BeanUtils.copyProperties` 后 7 个字段**全 null**。
    #[test]
    fn java_shape_vo_is_all_null() {
        let c = OrderConfig {
            id: 5,
            shop_id: 2,
            code: "settle".into(),
            data: Some("{}".into()),
        };
        let vo = OrderConfigJavaShapeVO::from_java_behavior(Some(&c));
        assert_eq!(vo, OrderConfigJavaShapeVO::default());
        assert!(vo.order_config_id.is_none());
        assert!(vo.order_config_name.is_none());
        assert!(vo.order_config_pic.is_none());
        assert!(vo.sort_order.is_none());
        assert!(vo.is_show.is_none());
        assert!(vo.status.is_none());
        assert!(vo.order_config_desc.is_none());
        // 记录不存在时同样返回全 null（Java `detail` 的 `copyProperties(null, vo)`）
        assert_eq!(
            OrderConfigJavaShapeVO::from_java_behavior(None),
            OrderConfigJavaShapeVO::default()
        );
    }

    // ————————————————————— 纯逻辑：BatchDTO 反序列化 —————————————————————

    /// `type` 是 Rust 关键字，必须能正确反序列化。
    #[test]
    fn batch_dto_deserializes_type_field() {
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);
        assert_eq!(dto.value, None);

        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1],"type":"show","value":1}"#).unwrap();
        assert_eq!(dto.r#type, "show");
        assert_eq!(dto.value, Some(1));
    }

    /// 入参 JSON 键名保持 camelCase（与原接口逐字符一致）。
    #[test]
    fn dto_json_keys_are_camel_case() {
        let dto: OrderConfigCreateDTO =
            serde_json::from_str(r#"{"orderConfigName":"结算","sortOrder":1,"isShow":1}"#).unwrap();
        assert_eq!(dto.order_config_name.as_deref(), Some("结算"));
        assert_eq!(dto.sort_order, Some(1));
        assert_eq!(dto.is_show, Some(1));

        let dto: OperateDTO = serde_json::from_str(r#"{"id":3,"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, Some(3));
        assert_eq!(dto.admin_note.as_deref(), Some("x"));

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":3,"field":"code","val":"a"}"#).unwrap();
        assert_eq!(dto.field.as_deref(), Some("code"));
        assert_eq!(dto.val.as_deref(), Some("a"));

        // 缺省（Java `BasePage` 默认值由 page_query 兜底）
        let q: OrderConfigListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.page, None);
        assert_eq!(q.size, None);
    }
}
