//! 商品属性模板域（catalog::attributes_tpl）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.product.AttributesTpl`（表 `product_attributes_tpl`）
//! - `com.tigshop.bean.dto.product.AttributesTplDTO`（入参与出参同构）
//! - `com.tigshop.bean.dto.product.AttributeTplDataDTO`（`tplData` 的结构）
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.product.AttributesTplConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.TPL_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（属性模板字典维护）**完全不涉及金额列**，因此没有
//! `rust_decimal::Decimal` 出场；`product_attributes_tpl` 的 5 列全是
//! 整型与文本（见仓储层模块头）。

use serde::{Deserialize, Serialize};

use crate::entities::ProductAttributesTpl;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `AttributesTplConstants` / `CheckFieldConstants` / `ResultTextConstants`）
// ——————————————————————————————————————————————

/// `product_attributes_tpl` 真实存在的 5 个列
/// （`python tools/schema_parser.py --table product_attributes_tpl`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const TPL_COLUMNS: [&str; 5] = ["tpl_id", "tpl_name", "tpl_data", "shop_id", "category_id"];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `tpl_id`）。
pub const KEY_COLUMN: &str = "tpl_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `tplId`）。
///
/// `buildSortOrder` 会先比较 `sortField` 与主键**属性名**，再回退主键列。
pub const KEY_PROPERTY: &str = "tplId";

/// `updateField` 的允许字段
/// （Java `CheckFieldConstants.TPL_FIELDS = {"tpl_name"}`）。
///
/// ⚠️ 白名单里**只有 `tpl_name` 一项** —— 这是 Java 原样，不是笔误。
/// 因此 `updateField` 传 `tplData` / `categoryId` / `tplId` 都会被拒。
pub const TPL_FIELDS: [&str; 1] = ["tpl_name"];

/// `tpl_name` 的最大长度（Java `AttributesTplDTO` 上的 `@Size(max = 100)`）。
///
/// ⚠️ 库列是 `varchar(80)`（`pure.sql`），与注解 `max = 100` **不一致**：
/// 61~100 字符的模板名能通过 Java 校验，却在入库时被 MySQL 拒绝
/// （严格模式下报 `Data too long for column 'tpl_name'`）。
/// 本实现按注解 `100` 执行以复刻 Java 的可观测行为，
/// 详见返回值 `uncertain_points`。
pub const TPL_NAME_MAX_LEN: usize = 100;

/// 默认店铺 ID（Java `HeaderUtils.getShopId()` 为 null 时
/// `Optional.ofNullable(...).orElse(0)`）。
pub const DEFAULT_SHOP_ID: i32 = 0;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
//
// ⚠️ 注意 Java 原文的错别字，**不要顺手改成通顺中文**：
// - `TPL_NOT_FOUND` = "模板不已存在"（「不已」应为「不」）
// 逐字符复刻是为了让前端 / 运维按原文案 grep 时不出现分歧。

/// Java `AttributesTplConstants.TPL_NAME_IS_NULL`。
pub const MSG_TPL_NAME_IS_NULL: &str = "模板名称不能为空";

/// Java `AttributesTplConstants.TPL_NAME_OVER_LENGTH`。
pub const MSG_TPL_NAME_OVER_LENGTH: &str = "模板名称长度不能超过100";

/// Java `AttributesTplConstants.TPL_NOT_FOUND`（原文错别字「不已存在」照抄）。
pub const MSG_TPL_NOT_FOUND: &str = "模板不已存在";

/// Java `AttributesTplDTO.categoryId` 上 `@NotNull(message = "商品类目不能为空")`。
pub const MSG_CATEGORY_ID_REQUIRED: &str = "商品类目不能为空";

/// Java `AttributesTplController.detail` 上
/// `@NotNull(message = ID_CANNOT_IS_NULL)` →
/// `ResultTextConstants.ID_CANNOT_IS_NULL` = `"id不能为空"`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.UNSELECTED_ITEM`（`BatchDTO.ids` 的 `@NotEmpty`）。
pub const MSG_UNSELECTED_ITEM: &str = "请选择要操作的数据";

/// Java `ResultTextConstants.OPERATION_TYPE_IS_NULL`（`BatchDTO.type` 的 `@NotNull`）。
pub const MSG_OPERATION_TYPE_IS_NULL: &str = "操作类型不能为空";

/// Java `ResultTextConstants.FIELD_NAME_CANNOT_BE_NULL`（`UpdateFieldDTO.field`）。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

// ——————————————————————————————————————————————
// 出参 / 入参共用的结构：模板数据
// ——————————————————————————————————————————————

/// 模板数据里的单个属性项（Java `AttributeTplDataDTO.Attribute` 内部类）。
///
/// `attrName` 属性名 + `attrValues` 候选值列表。
///
/// **null 字段不落库**：Java 侧由 Hutool `JSONUtil.toJsonStr` 序列化，其
/// `JSONConfig.ignoreNullValue` 默认为 `true`（已核对 hutool-json 5.8.37 源码
/// `JSONConfig.java:36`），因此 `attrName`/`attrValues` 为 null 时该键**不出现**。
/// 本结构用 `skip_serializing_if` 复刻同一形状，保证写进 `tpl_data` 的字符串与
/// Java 逐字节一致。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TplAttribute {
    /// 属性名
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attr_name: Option<String>,
    /// 候选值
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attr_values: Option<Vec<String>>,
}

/// 模板数据（Java `AttributeTplDataDTO`）。
///
/// 三类属性：`normal` 普通属性 / `spe` 规格属性 / `extra` 附加属性。
///
/// 库列 `tpl_data` 是 `text`，Java 用 Hutool `JSONUtil.toJsonStr` 存入、
/// `JSONUtil.parseObj(...).toBean(AttributeTplDataDTO.class)` 取出。
/// 本实现用 `serde_json` 做同样的双向转换（见
/// [`encode_tpl_data`] / [`decode_tpl_data`]）。
///
/// **null 字段不落库**：Hutool `JSONConfig.ignoreNullValue` 默认 `true`
/// （hutool-json 5.8.37 `JSONConfig.java:36`），故未设置的 `normal`/`spe`/`extra`
/// 不会出现在 JSON 里。用 `skip_serializing_if` 复刻。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AttributeTplData {
    /// 普通属性
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normal: Option<Vec<TplAttribute>>,
    /// 规格属性
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spe: Option<Vec<TplAttribute>>,
    /// 附加属性
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<Vec<TplAttribute>>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 属性模板 DTO（对应 Java `com.tigshop.bean.dto.product.AttributesTplDTO`）。
///
/// Java 的 `list` / `detail` / `listByCategory` 三个出参**都用同一个类**，
/// 由 `BeanUtils.copyProperties(attributesTpl, dto)` + 手工 `tplData` 转换构造。
/// 因此 Rust 侧也用一个结构体同时承担入参与出参。
///
/// ⚠️ `tpl_data` 在实体里是 `String`（JSON 文本），在 DTO 里是
/// [`AttributeTplData`] 对象 —— Java 靠 `convertToDTO` / `convertToBean`
/// 两侧转换。本结构体按 DTO 语义建模（`tpl_data` 是对象），
/// 与前端契约一致。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AttributesTplDTO {
    /// 属性模板表 ID（新建时为空）
    pub tpl_id: Option<i32>,
    /// 模板名称
    pub tpl_name: Option<String>,
    /// 模板数据（对象形态）
    pub tpl_data: Option<AttributeTplData>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 关联商品类目 ID
    pub category_id: Option<i32>,
}

impl From<&ProductAttributesTpl> for AttributesTplDTO {
    /// 实体 → DTO（对应 Java `AttributesTplServiceImpl#convertToDTO`）。
    ///
    /// 逐条对照 Java：
    /// ```text
    /// BeanUtils.copyProperties(attributesTpl, dto);
    /// dto.setTplData(Optional.ofNullable(attributesTpl.getTplData())
    ///     .filter(StrUtil::isNotEmpty)
    ///     .map(JSONUtil::parseObj)
    ///     .map(o -> o.toBean(AttributeTplDataDTO.class))
    ///     .orElse(null));
    /// ```
    /// 即：`tpl_data` 为**空串或 null** 时 `tplData` 输出 `null`；
    /// 非空但**不是合法 JSON** 时 Hutool `parseObj` 抛异常（Java 会 500），
    /// 本实现改为宽容地回退 `None`（见 [`decode_tpl_data`] 与
    /// `uncertain_points`）。
    fn from(e: &ProductAttributesTpl) -> Self {
        Self {
            tpl_id: Some(e.tpl_id),
            tpl_name: Some(e.tpl_name.clone()),
            tpl_data: decode_tpl_data(&e.tpl_data),
            shop_id: Some(e.shop_id),
            category_id: e.category_id,
        }
    }
}

impl From<ProductAttributesTpl> for AttributesTplDTO {
    fn from(e: ProductAttributesTpl) -> Self {
        Self::from(&e)
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `AttributesTplController.list(BasePage basePage)`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `keyword` /
/// `sortOrder` / `sortItems`。
///
/// ⚠️ 本域 `list` **只用到 `keyword`**（`like(tplName, keyword)`）与
/// `page` / `size` / `sortField` / `sortOrder`；`sortItems` 未被读取
/// （Java 调的是三参数重载 `buildSortOrder(page, sortField, sortOrder)`）。
/// `keyword` 是 `BasePage` 自带的字段，不是本域自定义查询条件。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`AttributesTplListQuery::page_query`] 桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AttributesTplListQuery {
    /// 搜索关键字（Java `BasePage.keyword`，对 `tpl_name` 做 `LIKE %kw%`）
    pub keyword: Option<String>,
    /// 排序字段（属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值不追加排序；空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl AttributesTplListQuery {
    /// 有效关键字（去空白后为空则不过滤）。
    ///
    /// Java 的判据是 `basePage.getKeyword() != null`（**只判 null，不判空串**），
    /// 即 `keyword=""` 会生成 `tpl_name LIKE '%%'`（等价全匹配，结果相同但多一次
    /// 无谓的 LIKE）。本实现统一按「去空白后非空才过滤」处理，
    /// 结果集完全一致（见 `uncertain_points`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1；`size` 默认 **15**、超过 100 截断为 100。
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
    /// - `sortField` 为空或等于主键属性名 `tplId` → 主键列 `tpl_id`
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序；`desc`、空 → 降序
    /// - **其它任何值**：`if asc {} else if desc||empty {}` 两分支都不命中
    ///   ⇒ `page.orders` 保持为空 ⇒ **完全不追加 ORDER BY**
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            // Java 是 if/else-if，非法值落到两分支之外 ⇒ 无 ORDER BY
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `product_attributes_tpl` 的真实列；属性名（camelCase）与列名
/// （snake_case）都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "tplId" | "tpl_id" => "tpl_id",
        "tplName" | "tpl_name" => "tpl_name",
        "tplData" | "tpl_data" => "tpl_data",
        "shopId" | "shop_id" => "shop_id",
        "categoryId" | "category_id" => "category_id",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中；未命中返回 `None`
/// —— 调用方据此报「字段值不合法」。
///
/// ⚠️ 与 Java 的一处**有意偏离**：Java 找不到时返回**主键列** `tpl_id`，
/// 再拿它去比对 `TPL_FIELDS`（`tpl_id` 不在其中，于是同样报「字段值不合法」）。
/// 两者对白名单的判定结果**完全一致**，差别只在错误分支的形状。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "tplId" | "tpl_id" => Some("tpl_id"),
        "tplName" | "tpl_name" => Some("tpl_name"),
        "tplData" | "tpl_data" => Some("tpl_data"),
        "shopId" | "shop_id" => Some("shop_id"),
        "categoryId" | "category_id" => Some("category_id"),
        _ => None,
    }
}

/// 创建 / 更新请求体（Java `AttributesTplDTO` 作为 `@RequestBody`）。
///
/// Java 侧 `create` / `update` 都是 `@Valid @RequestBody AttributesTplDTO`，
/// 控制器类上有类级 `@Validated`，因此：
/// - `tplName` 带 `@NotNull` ⇒ **必填**（注意是 `@NotNull` 不是 `@NotBlank`，
///   空串 `""` 能通过 Java 校验）
/// - `tplName` 带 `@Size(max = 100)`
/// - `categoryId` 带 `@NotNull` ⇒ **必填**
/// - `tplId` 无校验注解（`update` 靠 `assertOwned(dto.getTplId())` 判空）
/// - `shopId` 由控制器 / 服务层覆盖，请求体里的值**不被信任**
///   （Java 控制器 `attributesTplDTO.setShopId(HeaderUtils.getShopId())`，
///   服务层 `dto.setShopId(currentShopId())`）
///
/// 本实现把这些校验放在服务层，文案逐字符照抄 Java 常量。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AttributesTplSaveDTO {
    /// 属性模板表 ID（`update` 必填，`create` 忽略）
    pub tpl_id: Option<i32>,
    /// 模板名称（必填，最长 100）
    pub tpl_name: Option<String>,
    /// 模板数据
    pub tpl_data: Option<AttributeTplData>,
    /// 店铺 ID（请求体里的值会被服务层覆盖，见 Java `setShopId`）
    pub shop_id: Option<i32>,
    /// 关联商品类目 ID（必填）
    pub category_id: Option<i32>,
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（必填）
    ///
    /// ⚠️ Java 控制器 `del(@RequestBody OperateDTO operateDTO)` 的参数上
    /// **没有** `@Valid`，因此 `OperateDTO.id` 的 `@NotNull` **不生效**：
    /// 传 `{}` 时 `id` 为 null，`del(null)` → `BaseServiceImpl#del` 返回
    /// `false`（HTTP 200，不是 400）。本实现保持这一语义：`id` 缺失或
    /// `<= 0` 时回 `false`。
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`，本域自持副本）。
///
/// ⚠️ Java 控制器 `updateField(@RequestBody UpdateFieldDTO updateFieldDTO)`
/// 参数上**没有** `@Valid`，因此三个字段的 `@NotNull` **都不生效**。
/// 服务层 `assertOwned(updateField.getId())` 会对 null 抛
/// `GlobalException(TPL_NOT_FOUND)`（「模板不已存在」）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（见上方说明：缺失时由服务层报「模板不已存在」）
    pub id: Option<i32>,
    /// 字段名（属性名或列名）
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
/// ⚠️ Java 控制器 `batch(@RequestBody BatchDTO batchDTO)` 参数上**没有**
/// `@Valid`，因此 `ids` 的 `@NotEmpty` / `type` 的 `@NotNull` **都不生效**。
/// Java 的 `AttributesTplServiceImpl#batch` 先对 `ids != null` 的每一项
/// 调 `assertOwned`（存在性 + 归属校验），再走 `BaseServiceImpl#batch`
/// （仅 `type == "del"` 生效，其余静默 `false`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `List<Integer>`，可为 null ⇒ 本实现用空 Vec 表示）
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: Option<String>,
    /// 值（本域不使用）
    pub value: Option<i64>,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// 纯函数（供服务层与单测共用）
// ——————————————————————————————————————————————

/// `tpl_data`（库里的 JSON 文本）→ [`AttributeTplData`]。
///
/// 逐条对照 Java `AttributesTplServiceImpl#convertToDTO`：
/// ```text
/// Optional.ofNullable(raw)
///     .filter(StrUtil::isNotEmpty)     // null 或 "" ⇒ 不转换，输出 null
///     .map(JSONUtil::parseObj)         // 非法 JSON → 抛异常
///     .map(o -> o.toBean(AttributeTplDataDTO.class))
///     .orElse(null)
/// ```
///
/// ⚠️ **与 Java 的有意偏离**：Java 在 `tpl_data` 是非法 JSON 时会抛
/// `JSONException`（整个 `list` / `detail` 接口 500）；本实现选择宽容回退
/// `None`，理由是列表接口里一条脏数据不该让整页 500。
/// 这是一处**需要产品确认**的行为差异，已列入 `uncertain_points`。
///
/// 空串 / 全空白 / `null` JSON / 非对象 JSON 都回退 `None`。
#[must_use]
pub fn decode_tpl_data(raw: &str) -> Option<AttributeTplData> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return None;
    }
    serde_json::from_str::<AttributeTplData>(trimmed).ok()
}

/// [`AttributeTplData`] → `tpl_data`（库里的 JSON 文本）。
///
/// 逐条对照 Java `AttributesTplServiceImpl#convertToBean`：
/// ```text
/// attributesTpl.setTplData(
///     Optional.ofNullable(dto.getTplData())
///         .map(JSONUtil::toJsonStr)
///         .orElse(""));
/// ```
/// 即 `tplData` 为 null ⇒ 写入**空串**（`tpl_data` 列 `NOT NULL`，
/// 空串是合法值）；否则写入 JSON 文本。
///
/// Hutool `JSONUtil.toJsonStr` 默认会**丢弃 null 字段**，本实现用
/// `skip_serializing_if` 对齐这一行为（`{"normal":[{"attrName":"颜色",
/// "attrValues":["红"]}]}`），保证与 Java 落库文本形态一致。
#[must_use]
pub fn encode_tpl_data(data: Option<&AttributeTplData>) -> String {
    match data {
        None => String::new(),
        Some(d) => serde_json::to_string(d).unwrap_or_default(),
    }
}

/// 校验模板名称与类目（对应 Java `@NotNull` + `@Size(max = 100)`）。
///
/// 返回 `Ok((tpl_name, category_id))`，其中 `tpl_name` 已 trim；
/// 否则返回带 Java 原文案的错误。
///
/// ⚠️ 语义细节（逐条对照 Java 注解）：
/// - `tplName` 用的是 `@NotNull` **不是** `@NotBlank` ⇒ 空串 `""` 合法，
///   本实现只把「缺失（None）」判为非法，空串照常放行。
/// - `categoryId` 用 `@NotNull` ⇒ **0 也是合法值**（不是「必须 > 0」）。
/// - 长度按 `@Size(max = 100)`，超长报 `模板名称长度不能超过100`。
///   `tplName` 的长度以**字符数**计（Java `String.length()` 是 UTF-16 码元数，
///   对 BMP 内的中文一致；本实现用 `chars().count()`，
///   对辅助平面字符与 Java 略有差异，见 `uncertain_points`）。
///
/// # Errors
/// - `tplName` 缺失 ⇒ `模板名称不能为空`
/// - `tplName` 超过 100 字符 ⇒ `模板名称长度不能超过100`
/// - `categoryId` 缺失 ⇒ `商品类目不能为空`
pub fn validate_save(dto: &AttributesTplSaveDTO) -> Result<(String, i32), String> {
    let name = dto
        .tpl_name
        .as_deref()
        .ok_or_else(|| MSG_TPL_NAME_IS_NULL.to_string())?;
    if name.chars().count() > TPL_NAME_MAX_LEN {
        return Err(MSG_TPL_NAME_OVER_LENGTH.to_string());
    }
    let category_id = dto
        .category_id
        .ok_or_else(|| MSG_CATEGORY_ID_REQUIRED.to_string())?;
    Ok((name.trim().to_string(), category_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 白名单逐字符对照 Java `CheckFieldConstants.TPL_FIELDS`。
    #[test]
    fn tpl_fields_matches_java_constant() {
        assert_eq!(TPL_FIELDS, ["tpl_name"]);
        // 白名单只有一项 —— 这是 Java 原样，不是漏写
        assert_eq!(TPL_FIELDS.len(), 1);
        assert!(!TPL_FIELDS.contains(&"tpl_data"));
        assert!(!TPL_FIELDS.contains(&"category_id"));
        assert!(!TPL_FIELDS.contains(&"shop_id"));
    }

    /// 白名单里的列必须是真实列。
    #[test]
    fn tpl_fields_are_real_columns() {
        for f in TPL_FIELDS {
            assert!(
                TPL_COLUMNS.contains(&f),
                "{f} 不是 product_attributes_tpl 的真实列"
            );
        }
        assert_eq!(
            TPL_COLUMNS,
            ["tpl_id", "tpl_name", "tpl_data", "shop_id", "category_id"]
        );
    }

    /// Java 常量文案逐字符照抄（含「不已存在」这处错别字）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_TPL_NAME_IS_NULL, "模板名称不能为空");
        assert_eq!(MSG_TPL_NAME_OVER_LENGTH, "模板名称长度不能超过100");
        // ⚠️ Java 原文就是「不已存在」（多一个「已」），照抄
        assert_eq!(MSG_TPL_NOT_FOUND, "模板不已存在");
        assert_eq!(MSG_CATEGORY_ID_REQUIRED, "商品类目不能为空");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
    }

    /// 注解 `max = 100` 与库列 `varchar(80)` 不一致 —— 阈值按注解。
    #[test]
    fn name_max_len_follows_annotation_not_column() {
        assert_eq!(TPL_NAME_MAX_LEN, 100);
        // 文案里的数字与阈值一致（本域不存在 area_code 那种文案/注解打架）
        assert!(MSG_TPL_NAME_OVER_LENGTH.contains("100"));
    }

    // ————————————————————— 纯逻辑：排序 —————————————————————

    /// `order_clause` 三分支：asc 升序；空与 desc 降序；非法值不追加排序。
    #[test]
    fn order_clause_three_branches() {
        // 空 sortField / 空 sortOrder ⇒ 主键降序
        assert_eq!(
            AttributesTplListQuery::default().order_clause(),
            " ORDER BY tpl_id DESC"
        );

        let q = AttributesTplListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY tpl_id ASC");

        // 主键属性名 `tplId` 与列名 `tpl_id` 都回退主键列
        for key in ["tplId", "tpl_id"] {
            let q = AttributesTplListQuery {
                sort_field: Some(key.into()),
                sort_order: Some("asc".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), " ORDER BY tpl_id ASC", "{key}");
        }

        // 属性名 → 列名
        let q = AttributesTplListQuery {
            sort_field: Some("tplName".into()),
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY tpl_name DESC");

        let q = AttributesTplListQuery {
            sort_field: Some("category_id".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY category_id DESC");

        // 非法值：Java else-if 未覆盖 ⇒ 无 ORDER BY
        let q = AttributesTplListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    /// 未识别 `sortField` 静默回退主键列（防注入）。
    #[test]
    fn unknown_sort_field_falls_back_to_key() {
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("tpl_data"), "tpl_data");
        assert_eq!(map_order_column("shopId"), "shop_id");
        let q = AttributesTplListQuery {
            sort_field: Some("tpl_name; DROP TABLE product_attributes_tpl".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY tpl_id ASC");
    }

    // ————————————————————— 纯逻辑：updateField —————————————————————

    /// 归一 + 白名单：`tplData` 能归一但被白名单拒绝；未识别字段直接拒绝。
    #[test]
    fn update_field_whitelist_flow() {
        // 唯一白名单字段（属性名与列名两种写法）
        for input in ["tplName", "tpl_name"] {
            let c = map_update_field_column(input).unwrap();
            assert_eq!(c, "tpl_name");
            assert!(TPL_FIELDS.contains(&c));
        }
        // 主键 / tplData / categoryId 能归一，但都不在白名单 ⇒ 「字段值不合法」
        for input in [
            "tplId",
            "tpl_id",
            "tplData",
            "tpl_data",
            "categoryId",
            "category_id",
        ] {
            let c = map_update_field_column(input).unwrap();
            assert!(!TPL_FIELDS.contains(&c), "{input} 不应在白名单内");
            assert!(TPL_COLUMNS.contains(&c), "{input} 应能归一为真实列");
        }
        // 完全无法识别 ⇒ 归一失败
        assert!(map_update_field_column("something").is_none());
        // shopId 也是真实列但不在白名单
        assert_eq!(map_update_field_column("shopId"), Some("shop_id"));
        assert!(!TPL_FIELDS.contains(&"shop_id"));
    }

    // ————————————————————— 纯逻辑：list 分页 —————————————————————

    /// Java `BasePage` 默认值与上限（size 默认 15、>100 截断为 100）。
    #[test]
    fn page_query_defaults_match_base_page() {
        let q = AttributesTplListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);

        let q = AttributesTplListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);

        let q = AttributesTplListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);
    }

    /// 关键字去空白（Java 只判 null，本实现收紧为「非空白才过滤」，结果等价）。
    #[test]
    fn effective_keyword_trims_and_ignores_blank() {
        let q = AttributesTplListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), None);

        let q = AttributesTplListQuery {
            keyword: Some(" 手机 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), Some("手机"));

        assert_eq!(AttributesTplListQuery::default().effective_keyword(), None);
    }

    // ————————————————————— 纯逻辑：tplData 编解码 —————————————————————

    /// `decode_tpl_data`：空串 / null / 非法 JSON 都回退 `None`。
    #[test]
    fn decode_tpl_data_edge_cases() {
        assert_eq!(decode_tpl_data(""), None);
        assert_eq!(decode_tpl_data("   "), None);
        assert_eq!(decode_tpl_data("null"), None);
        // 非法 JSON：Java 会抛异常，本实现宽容回退（见 uncertain_points）
        assert_eq!(decode_tpl_data("{不是 json"), None);
        // 合法但非对象
        assert_eq!(decode_tpl_data("[1,2]"), None);
        // 空对象是合法的
        assert_eq!(decode_tpl_data("{}"), Some(AttributeTplData::default()));
    }

    /// `decode_tpl_data` 正常解析 camelCase 的三类属性。
    #[test]
    fn decode_tpl_data_parses_camel_case() {
        let raw =
            r#"{"normal":[{"attrName":"颜色","attrValues":["红","蓝"]}],"spe":[],"extra":null}"#;
        let d = decode_tpl_data(raw).unwrap();
        let normal = d.normal.unwrap();
        assert_eq!(normal.len(), 1);
        assert_eq!(normal[0].attr_name.as_deref(), Some("颜色"));
        assert_eq!(
            normal[0].attr_values.as_deref(),
            Some(["红".to_string(), "蓝".to_string()].as_slice())
        );
        // 显式空数组保留为 Some(vec![])，null / 缺键为 None
        assert_eq!(d.spe, Some(vec![]));
        assert_eq!(d.extra, None);
    }

    /// `encode_tpl_data`：`None` ⇒ 空串（Java `orElse("")`）。
    #[test]
    fn encode_tpl_data_none_is_empty_string() {
        assert_eq!(encode_tpl_data(None), "");
    }

    /// 编解码往返一致。
    #[test]
    fn tpl_data_round_trip() {
        let data = AttributeTplData {
            normal: Some(vec![TplAttribute {
                attr_name: Some("颜色".into()),
                attr_values: Some(vec!["红".into(), "蓝".into()]),
            }]),
            spe: Some(vec![]),
            extra: None,
        };
        let raw = encode_tpl_data(Some(&data));
        assert_eq!(decode_tpl_data(&raw), Some(data));
    }

    // ————————————————————— 纯逻辑：实体 → DTO —————————————————————

    /// 实体 → DTO：`tpl_data` 解析为对象，`shopId` / `categoryId` 原样带出。
    #[test]
    fn entity_to_dto_decodes_tpl_data() {
        let e = ProductAttributesTpl {
            tpl_id: 7,
            tpl_name: "手机模板".into(),
            tpl_data: r#"{"normal":[{"attrName":"颜色","attrValues":["黑"]}]}"#.into(),
            shop_id: 0,
            category_id: Some(42),
        };
        let dto = AttributesTplDTO::from(&e);
        assert_eq!(dto.tpl_id, Some(7));
        assert_eq!(dto.tpl_name.as_deref(), Some("手机模板"));
        assert_eq!(dto.shop_id, Some(0));
        assert_eq!(dto.category_id, Some(42));
        assert_eq!(dto.tpl_data.unwrap().normal.unwrap().len(), 1);
    }

    /// `tpl_data` 为空串 ⇒ `tplData` 输出 `null`（Java `filter(StrUtil::isNotEmpty)`）。
    #[test]
    fn entity_to_dto_empty_tpl_data_is_none() {
        let e = ProductAttributesTpl {
            tpl_id: 1,
            tpl_name: "空模板".into(),
            tpl_data: String::new(),
            shop_id: 0,
            // category_id 列可空
            category_id: None,
        };
        let dto = AttributesTplDTO::from(&e);
        assert_eq!(dto.tpl_data, None);
        assert_eq!(dto.category_id, None);
    }

    // ————————————————————— 纯逻辑：入参校验 —————————————————————

    /// `create` / `update` 的必填与长度校验。
    #[test]
    fn validate_save_rules() {
        // 正常
        let dto = AttributesTplSaveDTO {
            tpl_name: Some(" 手机模板 ".into()),
            category_id: Some(3),
            ..Default::default()
        };
        assert_eq!(validate_save(&dto).unwrap(), ("手机模板".to_string(), 3));

        // tplName 用 @NotNull 不是 @NotBlank ⇒ 空串放行
        let blank = AttributesTplSaveDTO {
            tpl_name: Some(String::new()),
            category_id: Some(3),
            ..Default::default()
        };
        assert_eq!(validate_save(&blank).unwrap(), (String::new(), 3));

        // tplName 缺失
        let no_name = AttributesTplSaveDTO {
            category_id: Some(3),
            ..Default::default()
        };
        assert_eq!(validate_save(&no_name).unwrap_err(), MSG_TPL_NAME_IS_NULL);

        // tplName 超长（101 字符）
        let long_name = AttributesTplSaveDTO {
            tpl_name: Some("名".repeat(101)),
            category_id: Some(3),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&long_name).unwrap_err(),
            MSG_TPL_NAME_OVER_LENGTH
        );

        // 恰好 100 字符合法
        let edge = AttributesTplSaveDTO {
            tpl_name: Some("名".repeat(100)),
            category_id: Some(3),
            ..Default::default()
        };
        assert!(validate_save(&edge).is_ok());

        // categoryId 缺失
        let no_cat = AttributesTplSaveDTO {
            tpl_name: Some("手机模板".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&no_cat).unwrap_err(),
            MSG_CATEGORY_ID_REQUIRED
        );

        // categoryId = 0 是合法的（@NotNull 不排除 0）
        let zero_cat = AttributesTplSaveDTO {
            tpl_name: Some("手机模板".into()),
            category_id: Some(0),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&zero_cat).unwrap(),
            ("手机模板".to_string(), 0)
        );
    }

    // ————————————————————— 纯逻辑：请求体反序列化 —————————————————————

    /// 入参 camelCase 与 Java 契约一致。
    #[test]
    fn save_dto_deserializes_camel_case() {
        let raw = r#"{"tplId":9,"tplName":"手机模板","tplData":{"normal":[{"attrName":"颜色","attrValues":["黑"]}]},"shopId":5,"categoryId":42}"#;
        let dto: AttributesTplSaveDTO = serde_json::from_str(raw).unwrap();
        assert_eq!(dto.tpl_id, Some(9));
        assert_eq!(dto.tpl_name.as_deref(), Some("手机模板"));
        assert_eq!(dto.shop_id, Some(5));
        assert_eq!(dto.category_id, Some(42));
        assert_eq!(
            dto.tpl_data.unwrap().normal.unwrap()[0]
                .attr_name
                .as_deref(),
            Some("颜色")
        );
    }

    /// 删除请求缺 `id`（Java 控制器无 `@Valid` ⇒ 不是 400）。
    #[test]
    fn operate_dto_allows_missing_id() {
        let dto: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, None);
    }

    /// `updateField` 请求缺字段。
    #[test]
    fn update_field_dto_allows_missing_fields() {
        let dto: UpdateFieldDTO = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(dto.id, None);
        assert_eq!(dto.field, None);
        assert_eq!(dto.val, None);

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"tplName","val":"新名字"}"#).unwrap();
        assert_eq!(dto.id, Some(1));
        assert_eq!(dto.field.as_deref(), Some("tplName"));
        assert_eq!(dto.val.as_deref(), Some("新名字"));
    }

    /// `batch` 请求：`type` 可缺省，`ids` 可为空。
    #[test]
    fn batch_dto_deserializes_type_and_ids() {
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(dto.r#type.as_deref(), Some("del"));
        assert_eq!(dto.ids, vec![1, 2]);

        let dto: BatchDTO = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(dto.r#type, None);
        assert!(dto.ids.is_empty());
    }

    /// 列表查询反序列化（Java 参数名是 `size`，不是 `pageSize`）。
    #[test]
    fn list_query_deserializes_java_param_names() {
        let q: AttributesTplListQuery = serde_json::from_str(
            r#"{"keyword":"手机","page":2,"size":30,"sortField":"tplName","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.effective_keyword(), Some("手机"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY tpl_name ASC");
    }

    /// 缺省查询参数全部走默认值。
    #[test]
    fn list_query_defaults() {
        let q: AttributesTplListQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.effective_keyword(), None);
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.order_clause(), " ORDER BY tpl_id DESC");
    }
}
