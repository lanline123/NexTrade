//! 配送类型域（logistics::shipping_type）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.setting.ShippingType`（表 `shipping_type`，
//!   实体已由 `tigshop_core::entities::setting::ShippingType` 自动生成）
//! - `com.tigshop.bean.dto.setting.ShippingTypeCreateDTO`
//! - `com.tigshop.bean.dto.setting.ShippingTypeUpdateDTO`
//! - `com.tigshop.bean.dto.setting.ShippingTypeListDTO extends BasePage`
//! - `com.tigshop.bean.vo.setting.shippingtpl.ShippingTypeVO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.setting.ShippingTypeConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.SHIPPING_TYPE_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` /
//!   `sortField` / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（配送类型字典维护）**不涉及任何金额列**；`shipping_type` 的 8 列
//! 全是整型与字符串，因此没有 `rust_decimal::Decimal` 出场。
//! （运费模板 `shipping_tpl_info` 才有金额，那是别的切片。）

use serde::{Deserialize, Serialize};

use crate::entities::setting::ShippingType;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java ShippingTypeConstants / CheckFieldConstants）
// ——————————————————————————————————————————————

/// `shipping_type` 真实存在的 8 个列
/// （`python tools/schema_parser.py --table shipping_type`）。
pub const SHIPPING_TYPE_COLUMNS: [&str; 8] = [
    "shipping_type_id",
    "shipping_type_name",
    "shipping_default_id",
    "shipping_type_desc",
    "shipping_time_desc",
    "is_support_cod",
    "sort_order",
    "shop_id",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `shipping_type_id`）。
pub const KEY_COLUMN: &str = "shipping_type_id";

/// 主键属性名（Java `getKeyProperty()` → `shippingTypeId`）。
pub const KEY_PROPERTY: &str = "shippingTypeId";

/// `updateField` 的允许字段
/// （Java `CheckFieldConstants.SHIPPING_TYPE_FIELDS`）。
///
/// ⚠️ **Java 原样照抄，含一个不存在于本表的列 `is_show`**：
/// `{"is_show", "sort_order", "shipping_type_name",
///   "shipping_type_desc", "is_support_cod"}`。
///
/// 由于 `getColumnByPropertyName("is_show")` 在 `shipping_type` 实体上
/// **找不到**该属性/列，MyBatis-Plus 的「安全修复」会把它**回退成主键列**
/// `shipping_type_id`，于是 `is_show` 能通过白名单（白名单里就有它），
/// 最终执行的是 `UPDATE shipping_type SET shipping_type_id = ? WHERE ...`
/// —— 一个**能成功但语义错误**的更新（会把主键改成任意值）。
///
/// 这是 Java 侧真实存在的缺陷，本实现**逐字符复刻该行为**
/// （白名单保留 `is_show`，映射函数同样回退主键列），
/// 以保证与线上一致；同时把正确的处理方式记录在
/// [`SHIPPING_TYPE_FIELDS_SAFE`] 与 `uncertain_points` 里，供后续切换。
pub const SHIPPING_TYPE_FIELDS: [&str; 5] = [
    "is_show",
    "sort_order",
    "shipping_type_name",
    "shipping_type_desc",
    "is_support_cod",
];

/// 去掉 Java 缺陷项后的**安全白名单**（本实现默认不启用）。
///
/// 只保留 `shipping_type` 真实存在的列；`is_show` 被剔除，
/// 因此 `updateField("is_show", ...)` 会命中「字段值不合法」而报错，
/// 而不是静默地把主键改掉。
///
/// 这是相对 Java 的**有意偏离**，需要产品确认后再切换
/// （见 `uncertain_points`）。
pub const SHIPPING_TYPE_FIELDS_SAFE: [&str; 4] = [
    "sort_order",
    "shipping_type_name",
    "shipping_type_desc",
    "is_support_cod",
];

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `ShippingTypeConstants._NOT_NULL`。
///
/// ⚠️ 注意常量名以 `_` 开头（Java 里就是个奇怪命名），文案是「名称」。
pub const MSG_SHIPPING_TYPE_NAME_NOT_NULL: &str = "配送类型名称不能为空";

/// Java `ShippingTypeConstants._OVER_LENGTH`。
pub const MSG_SHIPPING_TYPE_NAME_OVER_LENGTH: &str = "配送类型名称长度不能超过50";

/// Java `ShippingTypeConstants.SHIPPING_TYPE_ID_NOT_NULL`。
pub const MSG_SHIPPING_TYPE_ID_NOT_NULL: &str = "配送类型id不能为空";

/// Java `ShippingTypeConstants.SHIPPING_TYPE_NOT_NULL`。
pub const MSG_SHIPPING_TYPE_NOT_NULL: &str = "请选择运送方式";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`，注意带空格：
/// `"field 的值有误"`（逐字符照抄，不要「顺手」去掉空格）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_SHIPPING_TYPE_NOT_FOUND: &str = "配送类型不存在";

/// 配送类型名称的最大长度（Java `ShippingTypeConstants._OVER_LENGTH`
/// 文案写 50，但 `ShippingTypeCreateDTO` **没有任何 `@Size` 注解**）。
///
/// ⚠️ **重要差异**：Java 的 `ShippingTypeCreateDTO` 虽然
/// `import static ShippingTypeConstants.*`，却**一个校验注解都没加**
/// （对照 `ExampleCreateDTO` 是有 `@NotBlank` + `@Size` 的）。
/// 因此 Java 的 create **完全不校验**名称，空名称也能入库
/// （库列是 `varchar(120) NOT NULL`，MySQL 对 `''` 不报错）。
///
/// 本实现默认**同样不校验**（逐字符复刻），
/// 常量与 [`validate_name_len`] 仅作为「可切换的严格模式」备好
/// （见 `uncertain_points`）。
pub const NAME_MAX_LEN: usize = 50;

/// 库列 `shipping_type_name` 的真实长度上限（`varchar(120)`）。
///
/// 与 [`NAME_MAX_LEN`] 不同：这是**物理上**能存下的上限。
/// Java 不校验名称长度，超 120 字符时 MySQL 会按 `sql_mode`
/// 截断或报错。
pub const NAME_COLUMN_MAX_LEN: usize = 120;

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 配送类型 VO（对应 Java
/// `com.tigshop.bean.vo.setting.shippingtpl.ShippingTypeVO`）。
///
/// Java `list` 里逐条 `BeanUtils.copyProperties(shippingType, vo)` 后，
/// 再按 `shippingDefaultId` 查物流公司补 `logisticsName`（查不到就不 set）。
/// `detail` 只做 `copyProperties`，**不补** `logisticsName`。
///
/// ⚠️ Java 的 `ShippingTypeVO` 还有三个字段
/// `defaultTplInfo` / `areaTplInfo` /（构造函数里的）`shippingTplInfos`，
/// 它们**只在另一个全参构造函数里被赋值**（由运费模板相关接口使用），
/// 本切片的 `list` / `detail` 走的 `BeanUtils.copyProperties` 路径
/// **永远是 null**。因此本实现只保留 9 个真实会返回的字段
/// （与原接口 JSON 一致：多余字段 Java 输出 `null`，前端不读；
/// 见 `uncertain_points` 关于是否要补 `defaultTplInfo: null` 的说明）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeVO {
    /// 配送类型id
    pub shipping_type_id: i32,
    /// 类型名称
    pub shipping_type_name: String,
    /// 默认发货物流公司ID
    pub shipping_default_id: i32,
    /// 描述
    pub shipping_type_desc: String,
    /// 发货时间描述
    pub shipping_time_desc: String,
    /// 是否支持货到付款
    pub is_support_cod: i32,
    /// 排序
    pub sort_order: i32,
    /// 店铺id
    pub shop_id: i32,
    /// 物流公司名称（Java `list` 补，`detail` 不补 ⇒ `None`）
    pub logistics_name: Option<String>,
}

impl From<&ShippingType> for ShippingTypeVO {
    fn from(s: &ShippingType) -> Self {
        Self {
            shipping_type_id: s.shipping_type_id,
            shipping_type_name: s.shipping_type_name.clone(),
            shipping_default_id: s.shipping_default_id,
            shipping_type_desc: s.shipping_type_desc.clone(),
            shipping_time_desc: s.shipping_time_desc.clone(),
            is_support_cod: s.is_support_cod,
            sort_order: s.sort_order,
            shop_id: s.shop_id,
            // `detail` 路径不查物流公司 ⇒ 始终 None；
            // `list` 由服务层用 `with_logistics_name` 补齐。
            logistics_name: None,
        }
    }
}

impl ShippingTypeVO {
    /// 由实体构造并带上物流公司名（`list` 路径用）。
    #[must_use]
    pub fn with_logistics_name(row: &ShippingType, logistics_name: Option<String>) -> Self {
        Self {
            logistics_name,
            ..Self::from(row)
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `ShippingTypeListDTO extends BasePage`）。
///
/// Java 只额外声明了 `shopId` 一个字段；`keyword` / `page` / `size` /
/// `sortField` / `sortOrder` 来自 `BasePage`。
///
/// ⚠️ `ShippingTypeServiceImpl#list` **不使用** `listDTO.getShopId()`，
/// 而是用 `getShopId()`（请求头解析）覆盖式 `eq(shop_id, shopId)`。
/// 因此请求体/查询串里的 `shopId` **是无效参数**（Java 里被忽略）。
/// 本实现同样忽略它（保留字段只为对齐 JSON 契约、避免前端报错）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeListQuery {
    /// 店铺id（**Java 忽略此字段**，见类型级说明）
    pub shop_id: Option<i32>,
    /// 搜索关键字（Java `BasePage.keyword`，`LIKE %keyword%` 作用于名称）
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

impl ShippingTypeListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    ///
    /// ⚠️ Java 这里用的是 **`isNotEmpty`**（不是 `isNotBlank`），
    /// 因此 `"   "`（纯空白）**会**被当作有效关键字，
    /// 生成 `LIKE '%   %'`。本方法逐字符复刻该口径
    /// （与 area_code 的 `isNotBlank` 处理**不同**，不要照抄那边）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// 组装内部统一分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 解析 ORDER BY 子句。
    ///
    /// ⚠️ 与 area_code **不同**：`ShippingTypeServiceImpl#list` 第 66 行是
    /// **无条件**调用 `buildSortOrder(page, listDTO.getSortField(),
    /// listDTO.getSortOrder())`（不在 `if` 里），
    /// 因此 `sortField` 为空时走的是 `buildSortOrder` 内部的
    /// 「用主键列 + 降序」分支，**没有**本域特有的默认排序。
    ///
    /// 即：`sortField` 空 ⇒ `ORDER BY shipping_type_id DESC`。
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
            // Java `buildSortOrder` 是 `if asc {..} else if desc||empty {..}`，
            // 非法值落到两分支之外 ⇒ 无 ORDER BY
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// ⚠️ 注意 Java 的 `getColumnByPropertyName` 在**找不到**时返回**主键列**
/// （防注入的安全修复），因此本函数对未识别字段同样回退 [`KEY_COLUMN`]。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "shippingTypeId" | "shipping_type_id" | "id" => "shipping_type_id",
        "shippingTypeName" | "shipping_type_name" => "shipping_type_name",
        "shippingDefaultId" | "shipping_default_id" => "shipping_default_id",
        "shippingTypeDesc" | "shipping_type_desc" => "shipping_type_desc",
        "shippingTimeDesc" | "shipping_time_desc" => "shipping_time_desc",
        "isSupportCod" | "is_support_cod" => "is_support_cod",
        "sortOrder" | "sort_order" => "sort_order",
        "shopId" | "shop_id" => "shop_id",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 创建请求（Java `ShippingTypeCreateDTO`）。
///
/// ⚠️ **本 DTO 在 Java 侧没有任何校验注解**（虽然 import 了
/// `ShippingTypeConstants.*`）。因此 `shippingTypeName` 可以为空字符串，
/// `shopId` 也会被服务层用请求头值**覆盖**（请求里的 `shopId` 无效）。
///
/// 字段为 `Option` 是为了复刻 MyBatis-Plus `FieldStrategy.NOT_NULL`：
/// 未传的列不写，由 MySQL 施加列默认值（`varchar NOT NULL` 无显式
/// DEFAULT ⇒ `''`；`tinyint/int unsigned NOT NULL` ⇒ `0`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeCreateDTO {
    /// 是否支持货到付款
    pub is_support_cod: Option<i32>,
    /// 默认发货物流公司ID
    pub shipping_default_id: Option<i32>,
    /// 发货时间描述
    pub shipping_time_desc: Option<String>,
    /// 描述
    pub shipping_type_desc: Option<String>,
    /// 类型名称（Java 侧**无** `@NotBlank`）
    pub shipping_type_name: Option<String>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 店铺id（**Java 忽略此字段**，服务层用请求头覆盖）
    pub shop_id: Option<i32>,
}

/// 更新请求（Java `ShippingTypeUpdateDTO`）。
///
/// ⚠️ 三个关键点：
/// 1. 主键字段名是 **`id`**（不是 `shippingTypeId`），且 Java 类型是 `Long`；
/// 2. `@NotNull(message = "配送类型id不能为空")` ⇒ `id` 必填；
/// 3. **没有 `shopId` 字段**（无法通过 update 改店铺归属）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeUpdateDTO {
    /// 配送类型ID（Java `@NotNull`）
    pub id: Option<i32>,
    /// 是否支持货到付款
    pub is_support_cod: Option<i32>,
    /// 默认发货物流公司ID
    pub shipping_default_id: Option<i32>,
    /// 发货时间描述
    pub shipping_time_desc: Option<String>,
    /// 描述
    pub shipping_type_desc: Option<String>,
    /// 类型名称
    pub shipping_type_name: Option<String>,
    /// 排序
    pub sort_order: Option<i32>,
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

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`）。
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

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`）。
///
/// ⚠️ `value` 在 Java 里是**原始 `int`**（不是 `Integer`），
/// 因此不可为 null、默认 `0`；本实现用裸 `i32` 对齐。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `@NotEmpty(message = "未选择项目")`）
    pub ids: Option<Vec<i32>>,
    /// 操作类型（Java `@NotNull(message = "操作类型不能为空")`）
    pub r#type: Option<String>,
    /// 值（Java 原始 `int`，默认 0）
    pub value: i32,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

impl BatchDTO {
    /// `type == "del"` 判据（Java `BaseServiceImpl#batch` 用 `"del".equals(...)`）。
    #[must_use]
    pub fn is_delete(&self) -> bool {
        self.r#type.as_deref() == Some("del")
    }

    /// 有效 ids（Java `@NotEmpty` ⇒ 空列表即 400）。
    #[must_use]
    pub fn validated_ids(&self) -> Result<Vec<i32>, String> {
        match self.ids.as_ref() {
            Some(v) if !v.is_empty() => Ok(v.clone()),
            _ => Err(MSG_UNSELECTED_ITEM.to_string()),
        }
    }
}

// ——————————————————————————————————————————————
// 校验辅助（纯函数，便于单测）
// ——————————————————————————————————————————————

/// 把 `updateField` 的字段名映射为**真实列名**
/// （Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 语义逐条对齐 Java：
/// 1. 命中主键列名 → 主键列；
/// 2. 属性名（camelCase）或列名（snake_case）命中 → 该列；
/// 3. **未命中 → 回退主键列**（防 SQL 注入的「安全修复」）。
///
/// ⚠️ 第 3 条正是 `SHIPPING_TYPE_FIELDS` 里 `is_show` 能产生
/// 「静默改主键」的原因（见 [`SHIPPING_TYPE_FIELDS`] 的说明）。
#[must_use]
pub fn map_update_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// 严格模式下的名称长度校验（Java 侧**没有**这条校验，默认不启用）。
///
/// 启用后会返回 [`MSG_SHIPPING_TYPE_NAME_OVER_LENGTH`]，
/// 文案取自 Java `ShippingTypeConstants._OVER_LENGTH`（长度 50）。
pub fn validate_name_len(name: &str) -> Result<(), String> {
    if name.chars().count() > NAME_MAX_LEN {
        return Err(MSG_SHIPPING_TYPE_NAME_OVER_LENGTH.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `keyword` 用 `isNotEmpty` 口径：纯空白**仍**是有效关键字。
    #[test]
    fn keyword_uses_is_not_empty_not_is_blank() {
        assert_eq!(
            ShippingTypeListQuery {
                keyword: Some("   ".into()),
                ..Default::default()
            }
            .effective_keyword(),
            Some("   ")
        );
        assert_eq!(
            ShippingTypeListQuery {
                keyword: Some("abc".into()),
                ..Default::default()
            }
            .effective_keyword(),
            Some("abc")
        );
        // 空串才视为「没有关键字」
        assert_eq!(
            ShippingTypeListQuery {
                keyword: Some(String::new()),
                ..Default::default()
            }
            .effective_keyword(),
            None
        );
        assert_eq!(ShippingTypeListQuery::default().effective_keyword(), None);
    }

    /// `sortField` 为空时**不是**「无排序」，而是「主键列 DESC」
    /// （与 area_code 的默认排序分支不同）。
    #[test]
    fn empty_sort_field_falls_back_to_key_desc() {
        let q = ShippingTypeListQuery::default();
        assert_eq!(q.order_clause(), " ORDER BY shipping_type_id DESC");
    }

    /// `sortOrder` 语义：asc 升序；desc / 空 降序；非法值不排序。
    #[test]
    fn order_direction_semantics() {
        let mut q = ShippingTypeListQuery {
            sort_field: Some("sortOrder".into()),
            ..Default::default()
        };
        q.sort_order = Some("asc".into());
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
        q.sort_order = Some("DESC".into());
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");
        q.sort_order = None;
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");
        q.sort_order = Some("bogus".into());
        assert_eq!(q.order_clause(), "");
    }

    /// 属性名与列名都要能映射；未识别字段回退主键列（防注入）。
    #[test]
    fn order_column_accepts_property_and_column_names() {
        assert_eq!(map_order_column("shippingTypeName"), "shipping_type_name");
        assert_eq!(map_order_column("shipping_type_name"), "shipping_type_name");
        assert_eq!(map_order_column("shopId"), "shop_id");
        assert_eq!(map_order_column("1; DROP TABLE shipping_type"), KEY_COLUMN);
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    /// ⚠️ 关键缺陷复刻：`is_show` 不在本表，映射后回退成主键列
    /// `shipping_type_id`，而**主键列不在** Java 白名单 `SHIPPING_TYPE_FIELDS` 里
    /// ⇒ 实际会被拒绝（400 INVALID_FIELD_VALUE）。
    ///
    /// Java `BaseServiceImpl#updateField` 的顺序是
    /// `getColumnByPropertyName(field)` → `allowFields.contains(column)`，
    /// 白名单比的是**映射后**的列名；`SHIPPING_TYPE_FIELDS` 里只有
    /// `is_show / sort_order / shipping_type_name / shipping_type_desc / is_support_cod`，
    /// 不含 `shipping_type_id`。所以 Java 侧「白名单里的 `is_show`」
    /// **永远走不到**（先被映射成主键列，再被白名单拒掉）。
    #[test]
    fn is_show_maps_to_key_column_and_is_then_rejected() {
        let col = map_update_field_column("is_show");
        assert_eq!(col, KEY_COLUMN, "is_show 应回退成主键列（复刻 Java）");
        assert!(
            !SHIPPING_TYPE_FIELDS.contains(&col),
            "映射后是主键列，而主键列不在 Java 白名单里 ⇒ 会被拒绝"
        );
        // 安全白名单同样不含它
        assert!(
            !SHIPPING_TYPE_FIELDS_SAFE.contains(&col),
            "安全白名单不应包含回退后的主键列"
        );
    }

    /// 安全白名单只含真实存在的列。
    #[test]
    fn safe_whitelist_only_contains_real_columns() {
        for f in SHIPPING_TYPE_FIELDS_SAFE {
            assert!(
                SHIPPING_TYPE_COLUMNS.contains(&f),
                "安全白名单含不存在的列: {f}"
            );
        }
    }

    /// 列常量必须与 `schema_parser --table shipping_type` 一致。
    #[test]
    fn column_constants_match_schema() {
        assert_eq!(
            SHIPPING_TYPE_COLUMNS,
            [
                "shipping_type_id",
                "shipping_type_name",
                "shipping_default_id",
                "shipping_type_desc",
                "shipping_time_desc",
                "is_support_cod",
                "sort_order",
                "shop_id",
            ]
        );
    }

    /// `BatchDTO.type` 的 JSON 键名就是 `type`（Rust 里是 `r#type`）。
    #[test]
    fn batch_dto_maps_type_key_and_delete_flag() {
        let raw = r#"{"ids":[1,2],"type":"del","value":0}"#;
        let dto: BatchDTO = serde_json::from_str(raw).expect("应能反序列化");
        assert_eq!(dto.ids, Some(vec![1, 2]));
        assert!(dto.is_delete());
        assert_eq!(dto.value, 0);
        assert_eq!(dto.validated_ids(), Ok(vec![1, 2]));

        // 非 del 类型不删
        let other: BatchDTO = serde_json::from_str(r#"{"ids":[1],"type":"show"}"#).unwrap();
        assert!(!other.is_delete());
        // Java 原始 int ⇒ 缺省为 0
        assert_eq!(other.value, 0);
    }

    /// `ids` 缺失或空都报 Java 原文案「未选择项目」。
    #[test]
    fn batch_dto_requires_non_empty_ids() {
        assert_eq!(
            BatchDTO::default().validated_ids(),
            Err("未选择项目".to_string())
        );
        let empty: BatchDTO = serde_json::from_str(r#"{"ids":[],"type":"del"}"#).unwrap();
        assert_eq!(empty.validated_ids(), Err("未选择项目".to_string()));
    }

    /// VO 字段同名映射；`detail` 路径 `logisticsName` 恒为 None。
    #[test]
    fn vo_maps_entity_and_logistics_name() {
        let e = ShippingType {
            shipping_type_id: 3,
            shipping_type_name: "顺丰快递".into(),
            shipping_default_id: 11,
            shipping_type_desc: "次日达".into(),
            shipping_time_desc: "24小时内".into(),
            is_support_cod: 1,
            sort_order: 2,
            shop_id: 5,
        };

        let detail_vo = ShippingTypeVO::from(&e);
        assert_eq!(detail_vo.shipping_type_id, 3);
        assert_eq!(detail_vo.shipping_type_name, "顺丰快递");
        assert_eq!(detail_vo.shipping_default_id, 11);
        assert_eq!(detail_vo.shop_id, 5);
        assert_eq!(detail_vo.logistics_name, None, "detail 不补物流公司名");

        let list_vo = ShippingTypeVO::with_logistics_name(&e, Some("顺丰".into()));
        assert_eq!(list_vo.logistics_name.as_deref(), Some("顺丰"));
        assert_eq!(list_vo.shipping_type_id, 3);
    }

    /// VO 序列化键名为 camelCase。
    #[test]
    fn vo_serializes_camel_case() {
        let e = ShippingType {
            shipping_type_id: 1,
            shipping_type_name: "n".into(),
            shipping_default_id: 2,
            shipping_type_desc: "d".into(),
            shipping_time_desc: "t".into(),
            is_support_cod: 1,
            sort_order: 0,
            shop_id: 7,
        };
        let json = serde_json::to_string(&ShippingTypeVO::from(&e)).unwrap();
        assert!(json.contains("\"shippingTypeId\":1"), "json={json}");
        assert!(json.contains("\"shippingDefaultId\":2"), "json={json}");
        assert!(json.contains("\"isSupportCod\":1"), "json={json}");
        assert!(json.contains("\"shopId\":7"), "json={json}");
        assert!(json.contains("\"logisticsName\":null"), "json={json}");
    }

    /// `ShippingTypeUpdateDTO` 的主键键名是 `id`（不是 `shippingTypeId`）。
    #[test]
    fn update_dto_uses_id_key() {
        let dto: ShippingTypeUpdateDTO =
            serde_json::from_str(r#"{"id":9,"shippingTypeName":"x"}"#).expect("应能解析");
        assert_eq!(dto.id, Some(9));
        assert_eq!(dto.shipping_type_name.as_deref(), Some("x"));
        // 没有 shopId 字段：即便传了也不会被解析进结构体
        let dto2: ShippingTypeUpdateDTO =
            serde_json::from_str(r#"{"id":9,"shopId":4}"#).expect("应能解析");
        assert_eq!(dto2.id, Some(9));
    }

    /// `ShippingTypeCreateDTO` 在 Java 侧无校验注解 ⇒ 名称可空。
    #[test]
    fn create_dto_accepts_empty_name() {
        let dto: ShippingTypeCreateDTO =
            serde_json::from_str(r#"{"shippingTypeName":""}"#).expect("应能解析");
        assert_eq!(dto.shipping_type_name.as_deref(), Some(""));
        // 全空对象也应可用（Java 无 @NotNull）
        let empty: ShippingTypeCreateDTO = serde_json::from_str("{}").expect("空对象应可用");
        assert!(empty.shipping_type_name.is_none());
    }

    /// 名称长度校验（严格模式，Java 未启用）：50 字符含边界。
    #[test]
    fn name_len_validation_is_inclusive() {
        let ok = "a".repeat(NAME_MAX_LEN);
        assert!(validate_name_len(&ok).is_ok());
        let too_long = "a".repeat(NAME_MAX_LEN + 1);
        assert_eq!(
            validate_name_len(&too_long),
            Err("配送类型名称长度不能超过50".to_string())
        );
        // 按字符（不是字节）计数：中文 50 字应通过
        let cn = "测".repeat(NAME_MAX_LEN);
        assert!(validate_name_len(&cn).is_ok());
        assert!(validate_name_len(&"测".repeat(NAME_MAX_LEN + 1)).is_err());
    }

    /// 分页默认值与夹取。
    #[test]
    fn page_query_defaults_and_clamp() {
        let p = ShippingTypeListQuery::default().page_query();
        assert_eq!((p.page, p.page_size), (1, 15));
        let p = ShippingTypeListQuery {
            page: Some(0),
            size: Some(10_000),
            ..Default::default()
        }
        .page_query();
        assert_eq!((p.page, p.page_size), (1, 100));
    }

    /// `MSG_INVALID_FIELD_VALUE` 必须保留 Java 里的那个空格。
    #[test]
    fn invalid_field_message_keeps_java_space() {
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
    }
}
