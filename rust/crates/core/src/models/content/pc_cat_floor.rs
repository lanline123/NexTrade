//! PC 分类抽屉（首页分类栏）域（content::pc_cat_floor）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.decorate.PcCatFloor`（表 `pc_cat_floor`）
//! - `com.tigshop.bean.dto.decorate.PcCatFloorListDTO` / `PcCatFloorCreateDTO`
//!   / `PcCatFloorUpdateDTO`
//! - `com.tigshop.bean.vo.decorate.PcCatFloorVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `UpdateFieldDTO` / `BatchDTO`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder` / `keyword`）
//!
//! ## 为什么本域不直接复用 `models::decorate` 里的同名 DTO
//!
//! `models::decorate::{PcCatFloorVO, PcCatFloorListQuery, ...}` 已有一份，但它与
//! Java 契约有**可见差异**，本域按 Java 逐字段对齐：
//!
//! 1. `models::decorate::PcCatFloorVO` 把 `categoryIds` / `categoryNames` /
//!    `brandIds` 声明为 `Vec<_>`，Java 的 `PcCatFloorVO` 是 `Integer[]` /
//!    `String[]`，`JsonUtil.fromJson("null", ...)` 返回 `null`，Jackson 会
//!    **原样输出 `null`**。用 `Vec` 会把 `null` 变成 `[]`，前端行为不同。
//!    本域用 `Option<Vec<_>>`（`None` ↔ Java `null`）。
//! 2. `models::decorate::PcCatFloorListQuery` 缺 `sortField` / `sortOrder`，
//!    而 Java `list` 会用它们排序。
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（分类抽屉配置）**完全不涉及金额字段**，因此没有 `rust_decimal::Decimal`
//! 出场；若后续把「推荐品牌」扩展为价格相关配置，金额一律用 `Decimal`。

use serde::{Deserialize, Serialize};

use crate::entities::PcCatFloor;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `IsShowType` / `CheckFieldConstants` / `PcCatFloorConstants`）
// ——————————————————————————————————————————————

/// `pc_cat_floor.is_show` 的合法取值（Java `IsShowType`：0 不显示 / 1 显示）。
pub mod is_show_type {
    /// 不显示（`IsShowType.NOT_SHOW`）。
    pub const NOT_SHOW: i32 = 0;
    /// 显示（`IsShowType.SHOW`）。
    pub const SHOW: i32 = 1;
}

/// `list` 过滤 `is_show` 时被接受的取值集合。
///
/// Java `PcCatFloorServiceImpl#list`：
/// `isShow != null && (isShow == SHOW.getCode() || isShow == NOT_SHOW.getCode())`
/// —— 传 `2` / `-1` 等**不合法值时该过滤条件整体不生效**（不是报错）。
#[must_use]
pub fn is_valid_is_show_filter(v: i32) -> bool {
    v == is_show_type::SHOW || v == is_show_type::NOT_SHOW
}

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.GENERAL_FIELDS = {"is_show", "sort_order", "status"}`）。
///
/// ⚠️ `status` 在 `pc_cat_floor` 表里**并不存在**（见 `java/database/pure.sql`：
/// 该表只有 `cat_floor_id` / `cat_floor_name` / `category_ids` / `category_names`
/// / `floor_ico` / `hot_cat` / `is_show` / `sort_order` / `floor_ico_font`
/// / `brand_ids`）。Java 走的是 `UpdateWrapper.set("status", val)`，会直接抛
/// `BadSqlGrammarException`。本实现保留该白名单条目以对齐 Java 的「校验通过」，
/// 但执行时返回明确业务错误（见 `PcCatFloorService::update_field`）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// `pc_cat_floor` 真实存在的列（用于把白名单字段映射为列名）。
pub const PC_CAT_FLOOR_COLUMNS: [&str; 10] = [
    "cat_floor_id",
    "cat_floor_name",
    "category_ids",
    "category_names",
    "floor_ico",
    "hot_cat",
    "is_show",
    "sort_order",
    "floor_ico_font",
    "brand_ids",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `cat_floor_id`）。
pub const KEY_COLUMN: &str = "cat_floor_id";

/// `create` 时 `categoryIds` 为空的报错文案
/// （Java `Assert.notNull(createDTO.getCategoryIds(), "分类不能为空")`）。
pub const MSG_CATEGORY_IDS_REQUIRED: &str = "分类不能为空";

/// `update` 时主键为空（Java `PcCatFloorUpdateDTO` `@NotNull` →
/// `PcCatFloorConstants.PC_CAT_FLOOR_ID_NOT_NULL`）。
pub const MSG_CAT_FLOOR_ID_REQUIRED: &str = "首页分类栏id不能为空";

/// `updateField` 字段不值合法（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// `pc_cat_floor.cat_floor_name` 的最大长度（Java `PcCatFloorCreateDTO`
/// 上的 `@Size(max = 50, message = CAT_FLOOR_NAME_OVER_LENGTH)`）。
///
/// ⚠️ Java `PcCatFloorController` **没有** `@Validated`（类级/方法级都没有），
/// 因此这个 `@Size` 以及 `PcCatFloorUpdateDTO.catFloorId` 的 `@NotNull`
/// **实际上都不会被 Spring 校验**。本实现同样不在路由层做强校验，
/// 只在服务层保留 Java `create` 里那句真实的
/// `Assert.notNull(categoryIds, "分类不能为空")`。
/// 常量保留以便将来主会话统一开启 Bean Validation 对齐时直接引用。
pub const CAT_FLOOR_NAME_MAX_LEN: usize = 50;

/// 超出长度时的文案。
pub const MSG_CAT_FLOOR_NAME_OVER_LENGTH: &str = "首页分类栏名称长度不能超过50";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// PC 分类楼层 VO（对应 Java `PcCatFloorVO`）。
///
/// Java 侧 `BeanUtils.copyProperties(PcCatFloor, PcCatFloorVO)` 只拷贝
/// **同名属性**；实体的 `String categoryIds` 与 VO 的 `Integer[] categoryIds`
/// 类型不同，因此 `detail` 里 Java 显式用
/// `JsonUtil.fromJson(...)` 重新赋值，`list` 则**不赋值**（保持 `null`）。
///
/// 本结构体统一承载两种形态：`None` 表示「未赋值 / 解析失败」，
/// 即 Java 的 `null`。`list` 与 `detail` 的差异由服务层决定。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorVO {
    /// 分类抽屉 ID
    pub cat_floor_id: Option<i32>,
    /// 最终显示的分类名
    pub cat_floor_name: Option<String>,
    /// 分类 ID（JSON 文本列还原为数组；Java 未赋值时为 `null`）
    pub category_ids: Option<Vec<i32>>,
    /// 分类名称（JSON 文本列还原为数组；Java 未赋值时为 `null`）
    pub category_names: Option<Vec<String>>,
    /// 分类 ICO 图片
    pub floor_ico: Option<String>,
    /// 是否热门分类
    pub hot_cat: Option<String>,
    /// 是否显示，1 显示 / 0 不显示
    pub is_show: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 分类 ICO 图标
    pub floor_ico_font: Option<String>,
    /// 推荐的品牌（JSON 文本列还原为数组；Java 未赋值时为 `null`）
    pub brand_ids: Option<Vec<i32>>,
}

impl PcCatFloorVO {
    /// `list` 的映射：只做 Java `BeanUtils.copyProperties` 能做的同名字段拷贝，
    /// **不解析** JSON 文本列（对齐 Java `list` 的 `categoryIds == null` 行为）。
    #[must_use]
    pub fn for_list(f: &PcCatFloor) -> Self {
        Self {
            cat_floor_id: Some(f.cat_floor_id),
            cat_floor_name: Some(f.cat_floor_name.clone()),
            // Java：String ↔ Integer[] 类型不匹配，BeanUtils 跳过 ⇒ null
            category_ids: None,
            category_names: None,
            floor_ico: Some(f.floor_ico.clone()),
            hot_cat: Some(f.hot_cat.clone()),
            is_show: Some(f.is_show),
            sort_order: Some(f.sort_order),
            floor_ico_font: Some(f.floor_ico_font.clone()),
            brand_ids: None,
        }
    }

    /// `detail` 的映射：在 `list` 的基础上按 Java 显式解析三个 JSON 文本列。
    #[must_use]
    pub fn for_detail(f: &PcCatFloor) -> Self {
        Self {
            category_ids: parse_int_array(&f.category_ids),
            category_names: parse_string_array(&f.category_names),
            brand_ids: parse_int_array(&f.brand_ids),
            ..Self::for_list(f)
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `PcCatFloorListDTO extends BasePage`）。
///
/// Java `BasePage.getSize()` 默认 **15**、上限 100；`getPage()` 默认 1。
/// 注意 `BasePage.getSize()` 只裁剪上界（`> 100 → 100`），**没有下界**，
/// 传 `size=0` 会被 MyBatis-Plus 当作「不分页」；本实现按项目统一口径
/// `clamp(1, 100)`（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorListQuery {
    /// 是否展示（仅 0/1 生效，其余值忽略该条件）
    pub is_show: Option<i32>,
    /// 搜索关键字（`cat_floor_name LIKE %kw%`）
    pub keyword: Option<String>,
    /// 排序字段（Java 走 `getColumnByPropertyName`：属性名或列名，无法识别时回退主键）
    pub sort_field: Option<String>,
    /// `desc` / `asc`（其余值或空 ⇒ 降序，Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15
    pub size: Option<u64>,
}

impl PcCatFloorListQuery {
    /// 有效的 `is_show` 过滤值（不合法时返回 `None`，即不过滤）。
    #[must_use]
    pub fn effective_is_show(&self) -> Option<i32> {
        self.is_show.filter(|v| is_valid_is_show_filter(*v))
    }

    /// 有效关键字（去空白后为空则不过滤）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 组装分页参数（Java `BasePage`：page 默认 1，size 默认 15、上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 解析 ORDER BY 子句（**主键/列名由白名单映射**，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// - `sortField` 为空或等于主键属性名 `catFloorId` → 主键列
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（Java 的安全修复行为）
    /// - `asc`（忽略大小写）升序，其余任何值（含空）降序
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == "catFloorId" {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        let dir = if self
            .sort_order
            .as_deref()
            .is_some_and(|s| s.eq_ignore_ascii_case("asc"))
        {
            "ASC"
        } else {
            "DESC"
        };
        format!(" ORDER BY {column} {dir}")
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `pc_cat_floor` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "catFloorId" | "cat_floor_id" => "cat_floor_id",
        "catFloorName" | "cat_floor_name" => "cat_floor_name",
        "categoryIds" | "category_ids" => "category_ids",
        "categoryNames" | "category_names" => "category_names",
        "floorIco" | "floor_ico" => "floor_ico",
        "hotCat" | "hot_cat" => "hot_cat",
        "isShow" | "is_show" => "is_show",
        "sortOrder" | "sort_order" => "sort_order",
        "floorIcoFont" | "floor_ico_font" => "floor_ico_font",
        "brandIds" | "brand_ids" => "brand_ids",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 创建请求（Java `PcCatFloorCreateDTO`）。
///
/// `categoryList`（Java `CategoryList[]`，仅前端透传、服务端完全不使用）
/// 仍然接收，避免前端多传字段导致 400（本类型 `default`，未知字段被忽略）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorCreateDTO {
    /// 最终显示的分类名 —— **服务端会按分类名重算**，入参被忽略
    /// （Java `create` 里赋值前先覆盖 `catFloorName`）
    pub cat_floor_name: Option<String>,
    /// 分类 ID 数组（必填）
    pub category_ids: Option<Vec<i32>>,
    /// 分类名称 / 自定义别名数组（与 `categoryIds` 按下标对齐）
    pub category_names: Option<Vec<String>>,
    /// 分类数组详情（服务端不使用）
    pub category_list: Option<Vec<CategoryListItem>>,
    /// 分类 ICO 图片
    pub floor_ico: Option<String>,
    /// 是否热门分类（Java 默认值 `""`）
    pub hot_cat: Option<String>,
    /// 是否显示，1 显示 / 0 不显示
    pub is_show: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 分类 ICO 图标
    pub floor_ico_font: Option<String>,
    /// 推荐的品牌（必填与否同 Java：无校验，`null` → 库中文本 `"null"`）
    pub brand_ids: Option<Vec<i32>>,
}

/// `PcCatFloorCreateDTO.CategoryList` 单项。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CategoryListItem {
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
}

/// 更新请求（Java `PcCatFloorUpdateDTO`）。
///
/// `Option<T>` 的 `None` 同时覆盖 JSON 的「缺键」与「显式 `null`」两种输入，
/// 这与 Java 完全一致：Jackson 两种情况下都把字段置为 `null`，而
/// `updateById` 默认策略 `FieldStrategy.NOT_NULL` 会**跳过 null 字段**
/// （即不更新该列）。因此：
/// - `None` ⇒ 该列不参与 `UPDATE ... SET`
/// - `Some(v)` ⇒ 该列参与更新
///
/// ⚠️ 注意 Java 的 `NOT_NULL` 策略**只跳过 null**，空串 `""` 与 `0`
/// 都会被正常写入（mybatis-plus 3.5 的 `NOT_NULL` 只判断 `!= null`），
/// 本实现必须保持这一差异（见 `repo::crate::models::content::pc_cat_floor::FloorPatch`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorUpdateDTO {
    /// 分类抽屉 ID（必填）
    pub cat_floor_id: Option<i32>,
    /// 最终显示的分类名（服务端会重算）
    pub cat_floor_name: Option<String>,
    /// 分类 ID 数组
    pub category_ids: Option<Vec<i32>>,
    /// 分类名称数组
    pub category_names: Option<Vec<String>>,
    /// 分类数组详情（服务端不使用）
    pub category_list: Option<Vec<CategoryListItem>>,
    /// 分类 ICO 图片
    pub floor_ico: Option<String>,
    /// 是否热门分类
    pub hot_cat: Option<String>,
    /// 是否显示
    pub is_show: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 分类 ICO 图标
    pub floor_ico_font: Option<String>,
    /// 推荐的品牌
    pub brand_ids: Option<Vec<i32>>,
}

/// 删除请求（Java `OperateDTO`，本域自持副本）。
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

/// 单字段更新请求（Java `UpdateFieldDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 字段名（属性名或列名）
    pub field: Option<String>,
    /// 值（Java 侧统一按字符串 set，由 MySQL 隐式转换）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作请求（Java `BatchDTO`，本域自持副本）。
///
/// Java 的 `value` 是 `int`（原始类型，缺省 0）、`data` 是
/// `Map<String, Object>`；本域仅支持 `type = "del"`，这两个字段不参与逻辑。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（`@NotEmpty`，但控制器未挂 `@Validated`…… 见 `update` 注释）
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: String,
    /// 值（本域不使用）
    pub value: Option<i64>,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// JSON 文本列解析（对应 Java `JsonUtil.fromJson`）
// ——————————————————————————————————————————————

/// `Integer[]` JSON 文本 → `Option<Vec<i32>>`。
///
/// 对应 Java `JsonUtil.fromJson(raw, Integer[].class)`：
/// - 库中文本 `"null"` → Jackson 返回 `null` ⇒ 本函数返回 `None`
/// - 空串 / 非法 JSON → Java 抛异常被 `JsonUtil` 吞掉并返回 `null` ⇒ `None`
/// - `"[1,2]"` → `Some([1, 2])`
///
/// ⚠️ Java 侧拿到 `null` 后紧接着 `List.of(...)` / `Arrays.asList(...)`
/// 会抛 NPE（`getCatFloor` / `getCatFloorName`），本实现按 `None`/空表继续，
/// 避免整个接口 500（见 `uncertain_points`）。
#[must_use]
pub fn parse_int_array(raw: &str) -> Option<Vec<i32>> {
    let t = raw.trim();
    if t.is_empty() || t == "null" {
        return None;
    }
    serde_json::from_str::<Vec<i32>>(t).ok()
}

/// `String[]` JSON 文本 → `Option<Vec<String>>`（语义同 [`parse_int_array`]）。
#[must_use]
pub fn parse_string_array(raw: &str) -> Option<Vec<String>> {
    let t = raw.trim();
    if t.is_empty() || t == "null" {
        return None;
    }
    serde_json::from_str::<Vec<String>>(t).ok()
}

/// Java `JsonUtil.toJson(Object)`：`null` 会被序列化成字面量 `"null"`。
///
/// `pc_cat_floor` 的 `category_ids` / `category_names` / `brand_ids` 三列
/// 都是 `NOT NULL`，Java 在 DTO 传 `null` 时正是写入了字面量 `"null"` 文本。
#[must_use]
pub fn to_json_text<T: Serialize>(value: &Option<T>) -> String {
    match value {
        Some(v) => serde_json::to_string(v).unwrap_or_else(|_| "null".to_string()),
        None => "null".to_string(),
    }
}
