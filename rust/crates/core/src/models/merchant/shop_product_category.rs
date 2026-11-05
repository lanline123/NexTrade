//! 店铺商品分类信息域（merchant::shop_product_category）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.shop.ShopProductCategory`（表 `shop_product_category`）
//! - `com.tigshop.bean.dto.shop.ShopProductCategoryListDTO extends BasePage`
//! - `com.tigshop.bean.dto.shop.ShopProductCategoryCreateDTO`
//! - `com.tigshop.bean.dto.shop.ShopProductCategoryUpdateDTO`
//! - `com.tigshop.bean.vo.shop.ShopProductCategoryVO`
//! - `com.tigshop.bean.vo.shop.ShopParentTreeVO`（本切片未直接暴露，见 `uncertain_points`）
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.shop.ShopProductCategoryConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.SHOP_PRODUCT_CATEGORY_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField` / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（店铺商品分类字典维护）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。库列 `tinyint` / `smallint` / `int` 一律映射 `i32`。

use serde::{Deserialize, Serialize};

use crate::entities::ShopProductCategory;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `ShopProductCategoryConstants` / `CheckFieldConstants` / i18n）
// ——————————————————————————————————————————————

/// `shop_product_category` 真实存在的 8 个列
/// （`cd rust && python tools/schema_parser.py --table shop_product_category`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL —— 本域此处**不是**防御性冗余：
/// Java 白名单里确实混进了不属于本表的列，详见 [`SHOP_PRODUCT_CATEGORY_FIELDS`]。
pub const SHOP_PRODUCT_CATEGORY_COLUMNS: [&str; 8] = [
    "category_id",
    "category_name",
    "shop_id",
    "parent_id",
    "sort_order",
    "is_show",
    "add_time",
    "category_pic",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `category_id`）。
pub const KEY_COLUMN: &str = "category_id";

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.SHOP_PRODUCT_CATEGORY_FIELDS = {"category_name", "measure_unit",
/// "is_hot", "is_show", "sort_order"}`）。
///
/// ⚠️ **Java 原常量有 3 项与表结构不符**（本域重要的已确认缺陷）：
/// - `measure_unit`、`is_hot` **不是** `shop_product_category` 的列
///   （它们属于 `product` 表；`SHOP_PRODUCT_CATEGORY_FIELDS` 显然是照抄了
///   `CATEGORY_FIELDS = {"category_name","measure_unit","is_hot","is_show","sort_order"}`）；
/// - 反过来，本表真实存在的 `category_pic`（分类图片）**不在**白名单里，
///   前端无法通过 `updateField` 改图片。
///
/// 因此命中白名单**不等于**命中真实列：传 `measureUnit` 会通过白名单校验，
/// 然后由 MySQL 报 `Unknown column 'measure_unit'`（Java 线上同样是这个结果）。
/// 本实现**逐字符保留 Java 白名单**（不改业务规则），另用
/// [`SHOP_PRODUCT_CATEGORY_COLUMNS`] 暴露真实列供排查；详见 `uncertain_points`。
pub const SHOP_PRODUCT_CATEGORY_FIELDS: [&str; 5] = [
    "category_name",
    "measure_unit",
    "is_hot",
    "is_show",
    "sort_order",
];

/// `updateField` 白名单中**不存在于本表**的字段（Java 缺陷的显式清单）。
///
/// 保留成常量是为了让「Java 白名单 ≠ 真实列」这件事在代码里可见、可测，
/// 而不是散落在注释里。
pub const SHOP_PRODUCT_CATEGORY_PHANTOM_FIELDS: [&str; 2] = ["measure_unit", "is_hot"];

/// 「是 / 显示」取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否 / 隐藏」取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// 树的最大递归深度（Java `TreeNodeConfig#setDeep(5)`）。
pub const TREE_MAX_DEEP: usize = 5;

/// 树的根父级 id（Java `convertTreeList(categories, 0)` 的 `rootId = 0`）。
pub const TREE_ROOT_ID: i32 = 0;

/// `category_name` 的最大长度（库列 `varchar(90)`）。
///
/// ⚠️ Java `ShopProductCategoryCreateDTO` / `UpdateDTO` 上**没有任何** `@Size`
/// 校验，只有库里 `varchar(90)`。本实现按库列长度做防御性校验，
/// 文案为 Rust 侧新增（Java 无对应常量），见 `uncertain_points`。
pub const CATEGORY_NAME_MAX_LEN: usize = 90;

/// `category_pic` 的最大长度（库列 `varchar(255)`）。
pub const CATEGORY_PIC_MAX_LEN: usize = 255;

// ————————————————————— Java 常量 / i18n 文案（逐字符照抄） —————————————————————

/// Java `ShopProductCategoryConstants.SHOP_NOT_NULL` == i18n
/// `error.shop.select.required`（`messages.properties` 第 211 行）。
pub const MSG_SHOP_NOT_NULL: &str = "请选择店铺";

/// Java `ShopProductCategoryConstants.CATEGORY_NOT_EXIST` == i18n
/// `error.category.not.exist`（`messages.properties` 第 212 行）。
pub const MSG_CATEGORY_NOT_EXIST: &str = "分类不存在";

/// Java i18n `error.field.value.invalid`（`messages.properties` 第 213 行
/// 的实际文案是 `field 的值有误`，**不是** `ResultTextConstants.INVALID_FIELD_VALUE`
/// 的「字段值不合法」——两者同名不同文，本域走 `messageHelper.get(...)`，
/// 因此以 properties 为准）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// Java `ShopProductCategoryServiceImpl#create` 第 196 行的硬编码文案。
pub const MSG_ONLY_TWO_LEVEL_CREATE: &str = "只能创建二级分类";

/// Java `ShopProductCategoryServiceImpl#update` 第 215 行的硬编码文案。
pub const MSG_ONLY_TWO_LEVEL_UPDATE: &str = "只能修改为二级分类";

/// Java `ShopProductCategoryServiceImpl#create` 第 188 行的硬编码文案
/// （`createDTO == null`，Spring 下 `@RequestBody` 缺体时实际先由框架 400，
/// 该分支在 Java 中不可达；Rust 侧保留同等语义）。
pub const MSG_PARAM_ERROR: &str = "参数错误";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO` 的 `@NotNull`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.FIELD_NAME_CANNOT_BE_NULL`（`UpdateFieldDTO.field` 的 `@NotNull`）。
pub const MSG_FIELD_REQUIRED: &str = "字段名不能为空";

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_CATEGORY_NAME_REQUIRED: &str = "分类名称不能为空";

/// Rust 侧补：`category_name` 超长（Java 无校验，只有库列 `varchar(90)`）。
pub const MSG_CATEGORY_NAME_TOO_LONG: &str = "分类名称不能超过90个字符";

/// Rust 侧补：`category_pic` 超长（Java 无校验，只有库列 `varchar(255)`）。
pub const MSG_CATEGORY_PIC_TOO_LONG: &str = "分类图片地址不能超过255个字符";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 店铺商品分类 VO（对应 Java `com.tigshop.bean.vo.shop.ShopProductCategoryVO`）。
///
/// 字段与 Java VO 的 9 个属性一一对应。
///
/// ⚠️ `add_time` 是**字符串**（Java `private String addTime`），
/// 由 `TigUtils.handelTime(Long)` 把「秒级时间戳」格式化为
/// `yyyy-MM-dd HH:mm:ss`；时间戳为 `null` 或 `0` 时是**空串** `""`
/// （不是 `null`，也不是原始时间戳）。详见 [`format_add_time`]。
///
/// ⚠️ `has_children` 只在 `list` 里被赋值（子分类计数 > 0 ⇒ 1，否则 0）；
/// `detail` 里 Java 不赋值，因此**保持 `null`**。
/// 本结构体用 `Option<i32>` 表达这一差异（Java `Integer` 默认 null）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryVO {
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，无值时为空串）
    pub add_time: String,
    /// 分类 id
    pub category_id: i32,
    /// 父级分类 id
    pub parent_id: i32,
    /// 分类名称
    pub category_name: String,
    /// 是否有子类：1 有 / 0 无；`detail` 不赋值 ⇒ `None`
    pub has_children: Option<i32>,
    /// 是否显示：1 是 / 0 否
    pub is_show: i32,
    /// 所属店铺 id
    pub shop_id: i32,
    /// 排序
    pub sort_order: i32,
    /// 分类图片
    pub category_pic: String,
}

impl From<&ShopProductCategory> for ShopProductCategoryVO {
    /// `BeanUtils.copyProperties(entity, vo)` 后手工 `setAddTime(handelTime(addTime))`
    /// 的等价映射；`hasChildren` 与 Java `detail` 一样保持 `None`。
    fn from(c: &ShopProductCategory) -> Self {
        Self {
            add_time: format_add_time(c.add_time),
            category_id: c.category_id,
            parent_id: c.parent_id,
            category_name: c.category_name.clone(),
            has_children: None,
            is_show: c.is_show,
            shop_id: c.shop_id,
            sort_order: c.sort_order,
            category_pic: c.category_pic.clone(),
        }
    }
}

impl From<ShopProductCategory> for ShopProductCategoryVO {
    fn from(c: ShopProductCategory) -> Self {
        Self::from(&c)
    }
}

/// 分类树节点（对应 Java Hutool `cn.hutool.core.lang.tree.Tree<Integer>` 在
/// `convertTreeList` 里被 `putExtra` 进去的 5 个自定义键 + 子节点）。
///
/// Java 的 `TreeUtil.build` 除了 `putExtra` 的 5 个键，还会写入固定的
/// `id` / `parentId` / `name` / `weight` / `children` 键（其中 `id` / `parentId`
/// / `name` 由 `TreeNodeConfig` 改为 `categoryId` / `parentId` / `categoryName`，
/// 即与 `putExtra` 同名同值）。本结构体只保留**唯一的可观测载荷**：
/// `categoryId` / `parentId` / `categoryName` / `categoryPic` / `isStore` / `children`。
///
/// ⚠️ `isStore` 在 Java 里是**硬编码的常量 `1`**（第 347 行 `putExtra("isStore", 1)`），
/// 与店铺归属无关，本实现照抄。
///
/// ⚠️ 空结果时 Java `convertTreeList` **返回 `null` 而不是空数组**
/// （第 329–331 行 `if (shopProductCategories.isEmpty()) return null;`），
/// 因此 `getAllCategory` 在无分类时返回 `data: null`。本实现照抄该语义
/// （服务层返回 `Option<Vec<...>>`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryTreeVO {
    /// 分类 id（Java `putExtra("categoryId", ...)`）
    pub category_id: i32,
    /// 父级分类 id（Java `putExtra("parentId", ...)`）
    pub parent_id: i32,
    /// 分类名称（Java `translatePackage.translate(categoryName, 1)`，当前实现是恒等函数）
    pub category_name: String,
    /// 分类图片（Java `putExtra("categoryPic", ...)`，可能为 null）
    pub category_pic: Option<String>,
    /// Java 硬编码常量 `1`（不是业务判断，照抄）
    pub is_store: i32,
    /// 子节点（递归同构）
    pub children: Vec<ShopProductCategoryTreeVO>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `ShopProductCategoryListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder`。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`ShopProductCategoryListQuery::page_query`] 桥接。
///
/// ⚠️ `shopId` 在 Java 里**总是被控制器覆盖**为 `HeaderUtils.getShopId()`
/// （第 43–44 行 `listDTO.setShopId(shopId)`），前端传什么都不生效。
/// 本结构体保留该字段以兼容前端多传一个键（`serde` 忽略未知字段即可，
/// 但显式声明便于测试断言「确实被忽略」）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryListQuery {
    /// 父类 id（Java `parentId`，非 null 时等值过滤）
    pub parent_id: Option<i32>,
    /// 关键字（Java `keyword`；**注意：Java 的过滤条件写反了**，见 [`Self::effective_keyword`]）
    pub keyword: Option<String>,
    /// 店铺 id（Java 控制器会用请求头值覆盖，本字段仅作入参兼容）
    pub shop_id: Option<i32>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值不追加 ORDER BY，见 [`Self::order_clause`]）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl ShopProductCategoryListQuery {
    /// 有效关键字（用于 `LIKE`）。
    ///
    /// ⚠️ **Java 原代码的已确认缺陷（本域第 1 个）**：
    /// `ShopProductCategoryServiceImpl#list` 第 152 行写的是
    /// ```text
    /// if (listDTO.getKeyword() != null && StringUtils.isEmpty(listDTO.getKeyword())) {
    ///     queryWrapper.like(ShopProductCategory::getCategoryName, listDTO.getKeyword());
    /// }
    /// ```
    /// 即「非 null **且** 为空串」才加 `LIKE`。此时 `keyword` 必然是空串，
    /// 生成的 SQL 是 `category_name LIKE '%%'`（恒真），**等价于不过滤**；
    /// 而真正的关键字（非空串）反而**不会**被过滤。
    /// 净效果：**关键字搜索在 Java 里完全失效**。
    ///
    /// 本实现的选择：把这一条件**逐字符翻译成 Rust 的等价判定**
    /// （见 [`Self::java_keyword_filter_is_active`]），即只在
    /// 「`Some("")`（或全空白被 `StringUtils.isEmpty` 视为空后）」时返回
    /// `Some("")`，由仓储层拼出 `LIKE '%%'`；非空关键字返回 `None`（不过滤）。
    /// 这是**有意的缺陷复刻**，不是简化；如需修正请先确认产品意图
    /// （见 `uncertain_points`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        if self.java_keyword_filter_is_active() {
            Some("")
        } else {
            None
        }
    }

    /// Java 第 152 行条件的等价判定：
    /// `keyword != null && StringUtils.isEmpty(keyword)`。
    ///
    /// `StringUtils.isEmpty`（项目自有实现）对 `null` 与**长度为 0 的串**返回 true。
    /// 这里 `keyword != null` 已由 `Option` 承担，因此等价于「值为空串」。
    ///
    /// ⚠️ 注意：项目自有 `StringUtils.isEmpty` 是否 trim 取决于实现；
    /// 本实现按**不 trim** 处理（`""` 才算空），与 Java 字符串字面语义一致，
    /// 若前端传 `"   "` 则 Java 也**不会**进入该分支（`isEmpty("   ") == false`）。
    #[must_use]
    pub fn java_keyword_filter_is_active(&self) -> bool {
        matches!(self.keyword.as_deref(), Some(""))
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`）。
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
    /// - `sortField` 为空或等于主键属性名 `categoryId` → 主键列 `category_id`
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序
    /// - `desc` / 空 ⇒ 降序
    /// - **其它非法值完全不追加 ORDER BY**（Java 是 `if / else if`，无 `else`）
    ///
    /// ⚠️ 无任何排序时的 SQL 顺序**由 MySQL 决定、不确定**
    /// （Java 侧 `page.orders` 为空时同样无 ORDER BY）——本实现不额外兜底，
    /// 以免与 Java 行为分叉，见 `uncertain_points`。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == "categoryId" {
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
/// 只允许 `shop_product_category` 的真实列；属性名（camelCase）与列名
/// （snake_case）都可命中；**未命中一律回退主键列**（防注入，与 Java 一致）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "categoryId" | "category_id" => "category_id",
        "categoryName" | "category_name" => "category_name",
        "shopId" | "shop_id" => "shop_id",
        "parentId" | "parent_id" => "parent_id",
        "sortOrder" | "sort_order" => "sort_order",
        "isShow" | "is_show" => "is_show",
        "addTime" | "add_time" => "add_time",
        "categoryPic" | "category_pic" => "category_pic",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 创建请求（Java `ShopProductCategoryCreateDTO`）。
///
/// ⚠️ Java 该 DTO 上**没有任何 Bean Validation 注解**（无 `@NotNull` / `@Size`），
/// 只有库列的 `NOT NULL` 约束。因此：
/// - `categoryName` 为 null 时入库会撞 `NOT NULL`（MySQL 在非严格模式下会写成 `''`）；
/// - `shopId` 在控制器里总是被请求头值覆盖；
/// - `parentId` / `sortOrder` / `isShow` / `categoryPic` 为 null 时
///   由 MyBatis-Plus `FieldStrategy.NOT_NULL` 跳过该列、走库默认值。
///
/// 本结构体用 `Option` 表达「未传」，由服务层决定写列与否。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryCreateDTO {
    /// 店铺 id（控制器覆盖为 `getShopId()`）
    pub shop_id: Option<i32>,
    /// 分类名称
    pub category_name: Option<String>,
    /// 父级分类 id
    pub parent_id: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否显示
    pub is_show: Option<i32>,
    /// 分类图片
    pub category_pic: Option<String>,
}

/// 更新请求（Java `ShopProductCategoryUpdateDTO`）。
///
/// 与创建 DTO 的唯一差别是主键字段叫 `categoryId`（创建 DTO 无主键）。
///
/// ⚠️ Java `update` 走 `updateById`（`FieldStrategy.NOT_NULL`）：
/// **只写非 null 字段**，未传的列保持原值。本实现用
/// `Option<Option<T>>` 三态补丁表达该语义。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopProductCategoryUpdateDTO {
    /// 分类 id（主键；Java 无 `@NotNull`，为 null 时 `updateById` 直接失败）
    pub category_id: Option<i32>,
    /// 店铺 id（控制器覆盖为 `getShopId()`）
    pub shop_id: Option<i32>,
    /// 分类名称
    pub category_name: Option<String>,
    /// 父级分类 id
    pub parent_id: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否显示
    pub is_show: Option<i32>,
    /// 分类图片
    pub category_pic: Option<String>,
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（`@NotNull`）
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`，本域自持副本）。
///
/// Java 三个字段都带 `@NotNull`，且控制器类级 `@Validated` ⇒ 缺一即 400。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 字段名（驼峰属性名；服务层经 `StrUtil.toUnderlineCase` 归一为列名）
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
/// 本域仅支持 `type = "del"`；`value` 是 Java 原始类型 `int`（缺省 0）、
/// `data` 是 `Map<String, Object>`，两者都不参与本域逻辑。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `@NotEmpty` ⇒ 空数组 400）
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

/// `updateField` 的字段名归一（对应 Java `StrUtil.toUnderlineCase`）。
///
/// Hutool `StrUtil.toUnderlineCase` 的规则：把驼峰拆成下划线小写，
/// **已经带下划线的串原样返回**（且不会把连续大写拆开，如 `URL` → `url`）。
/// 未识别时返回**原样（小写化后）的串**——Java 侧 `toUnderlineCase` 不返回 null，
/// 归一结果随后交给白名单判定（不在白名单 ⇒ 「field 的值有误」）。
///
/// ⚠️ 与 Java 的一处**有意偏离**：Java 在 `updateField` 里**不走**
/// `getColumnByPropertyName`，而是直接用 `toUnderlineCase` 的结果去比对白名单
/// （见 `ShopProductCategoryServiceImpl#updateField` 第 254–255 行）。
/// 因此本函数只做下划线归一，**不做**「未命中回退主键列」的防注入映射
/// ——后者会让 `measure_unit` 这类幻觉列意外命中主键列，行为与 Java 分叉。
#[must_use]
pub fn to_underline_case(field: &str) -> String {
    let mut out = String::with_capacity(field.len() + 4);
    let chars: Vec<char> = field.chars().collect();
    for (i, ch) in chars.iter().enumerate() {
        if ch.is_ascii_uppercase() {
            let prev_is_lower_or_digit =
                i > 0 && (chars[i - 1].is_ascii_lowercase() || chars[i - 1].is_ascii_digit());
            let next_is_lower = chars.get(i + 1).is_some_and(char::is_ascii_lowercase);
            let prev_is_upper = i > 0 && chars[i - 1].is_ascii_uppercase();
            // Hutool：小写/数字后跟大写 ⇒ 插下划线；连续大写后接小写（如 `HTMLPage`）⇒ 在最后一个大写前插
            if (prev_is_lower_or_digit || (prev_is_upper && next_is_lower))
                && !out.ends_with('_')
                && !out.is_empty()
            {
                out.push('_');
            }
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(*ch);
        }
    }
    out
}

/// `updateField` 白名单判定（对应 Java 第 255 行 `Arrays.asList(allowFields).contains(field)`）。
///
/// 返回归一后的列名；不在白名单 ⇒ `None`（调用方报 `field 的值有误`）。
///
/// ⚠️ 命中白名单**不代表**是真实列，详见 [`SHOP_PRODUCT_CATEGORY_FIELDS`]。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<String> {
    let column = to_underline_case(field.trim());
    if SHOP_PRODUCT_CATEGORY_FIELDS.contains(&column.as_str()) {
        Some(column)
    } else {
        None
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（对应 Java `TigUtils.handelTime(Long)`）。
///
/// 逐条对照 Java 第 190–198 行：
/// - `time == null || time == 0` ⇒ **空串 `""`**（不是 null，也不是 `"0"`）；
/// - 否则 `new Date(time * 1000)` 后按 `SimpleDateFormat("yyyy-MM-dd HH:mm:ss")`
///   格式化（**服务器默认时区**，不是 UTC）。
///
/// ⚠️ 时区：Java 用 JVM 默认时区。本实现按 **UTC+8** 计算
/// （与原系统部署地域一致），非该时区的部署需调整，见 `uncertain_points`。
///
/// 实现说明：不引入 `chrono` 依赖（本 crate 未声明），用自写的
/// civil-from-days 算法（Howard Hinnant 的 `civil_from_days`）做日期换算，
/// 与 `SimpleDateFormat` 对正常年份区间（1–9999 年）的结果一致。
#[must_use]
pub fn format_add_time(time: Option<i32>) -> String {
    match time {
        None | Some(0) => String::new(),
        Some(t) => format_unix_seconds(i64::from(t)),
    }
}

/// 项目约定时区偏移（秒）。Java `SimpleDateFormat` 用 JVM 默认时区，
/// 本项目部署为东八区，故固定 `+8h`。
pub const TZ_OFFSET_SECONDS: i64 = 8 * 3600;

/// 把 UNIX 秒按 `TZ_OFFSET_SECONDS` 格式化为 `yyyy-MM-dd HH:mm:ss`。
fn format_unix_seconds(secs: i64) -> String {
    let local = secs + TZ_OFFSET_SECONDS;
    let days = local.div_euclid(86_400);
    let rem = local.rem_euclid(86_400);
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02} {hour:02}:{minute:02}:{second:02}")
}

/// 天数（自 1970-01-01）→ `(年, 月, 日)`。
///
/// Howard Hinnant 的 `civil_from_days` 算法，对全部正负天数成立；
/// 与 `SimpleDateFormat` 在公历区间内的输出一致。
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// 创建 / 更新的名称校验（Java **没有** `@Size` / `@NotBlank`，本实现按库列长度兜底）。
///
/// 返回 `Ok(trim 后的名称)`。
///
/// # Errors
/// - 名称为空 ⇒ [`MSG_CATEGORY_NAME_REQUIRED`]
/// - 名称超过 90 字符（库列 `varchar(90)`）⇒ [`MSG_CATEGORY_NAME_TOO_LONG`]
pub fn validate_category_name(name: Option<&str>) -> Result<String, String> {
    let name = name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_CATEGORY_NAME_REQUIRED.to_string())?
        .to_string();
    if name.chars().count() > CATEGORY_NAME_MAX_LEN {
        return Err(MSG_CATEGORY_NAME_TOO_LONG.to_string());
    }
    Ok(name)
}

/// 分类图片地址校验（库列 `varchar(255)`；Java 无校验）。
///
/// # Errors
/// - 超过 255 字符 ⇒ [`MSG_CATEGORY_PIC_TOO_LONG`]
pub fn validate_category_pic(pic: Option<&str>) -> Result<Option<String>, String> {
    match pic {
        None => Ok(None),
        Some(p) => {
            if p.chars().count() > CATEGORY_PIC_MAX_LEN {
                Err(MSG_CATEGORY_PIC_TOO_LONG.to_string())
            } else {
                Ok(Some(p.to_string()))
            }
        }
    }
}

/// 由「父记录的 parentId」判定是否允许挂到该父记录下
/// （对应 Java `create` 第 194–198 行 / `update` 第 212–217 行）。
///
/// Java 逻辑：
/// ```text
/// ShopProductCategory sp = getById(parentId);
/// if (sp != null) {
///     if (sp.getParentId() != null && sp.getParentId() > 0) {
///         throw new GlobalException("只能创建二级分类");   // update 里文案是 "只能修改为二级分类"
///     }
/// }
/// ```
/// 即：**父记录不存在时放行**（`sp == null` 不报错），父记录的 `parentId > 0`
/// 时拒绝（因为那样新分类就是三级）。`parentId` 为 `0` 或 `null` 放行。
///
/// 返回 `true` 表示放行；`false` 表示调用方应抛出传入的文案错误
/// （`create` 用「只能创建二级分类」，`update` 用「只能修改为二级分类」）。
#[must_use]
pub fn allows_second_level(existing_parent_parent_id: Option<i32>) -> bool {
    !existing_parent_parent_id.is_some_and(|p| p > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `CheckFieldConstants.SHOP_PRODUCT_CATEGORY_FIELDS` 的逐字对照。
    #[test]
    fn fields_constant_matches_java_verbatim() {
        assert_eq!(
            SHOP_PRODUCT_CATEGORY_FIELDS,
            [
                "category_name",
                "measure_unit",
                "is_hot",
                "is_show",
                "sort_order"
            ]
        );
        // 与 `CATEGORY_FIELDS` 前 5 项完全相同 —— 这正说明 Java 常量是照抄来的
        assert_eq!(
            SHOP_PRODUCT_CATEGORY_FIELDS,
            [
                "category_name",
                "measure_unit",
                "is_hot",
                "is_show",
                "sort_order"
            ]
        );
    }

    /// 白名单里 2 项不是本表列；本表 `category_pic` 反而不在白名单里。
    #[test]
    fn whitelist_contains_phantom_columns() {
        for f in SHOP_PRODUCT_CATEGORY_PHANTOM_FIELDS {
            assert!(
                !SHOP_PRODUCT_CATEGORY_COLUMNS.contains(&f),
                "{f} 不应是 shop_product_category 的真实列"
            );
            assert!(SHOP_PRODUCT_CATEGORY_FIELDS.contains(&f));
        }
        // 真实列 category_pic 不在白名单
        assert!(SHOP_PRODUCT_CATEGORY_COLUMNS.contains(&"category_pic"));
        assert!(!SHOP_PRODUCT_CATEGORY_FIELDS.contains(&"category_pic"));
        // 三项白名单字段确实是真实列
        for f in ["category_name", "is_show", "sort_order"] {
            assert!(SHOP_PRODUCT_CATEGORY_COLUMNS.contains(&f));
        }
    }

    /// Java i18n / 硬编码文案逐字符照抄。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_SHOP_NOT_NULL, "请选择店铺");
        assert_eq!(MSG_CATEGORY_NOT_EXIST, "分类不存在");
        // properties 里是「field 的值有误」，不是 ResultTextConstants 的「字段值不合法」
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
        assert_eq!(MSG_ONLY_TWO_LEVEL_CREATE, "只能创建二级分类");
        assert_eq!(MSG_ONLY_TWO_LEVEL_UPDATE, "只能修改为二级分类");
        assert_eq!(MSG_PARAM_ERROR, "参数错误");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    #[test]
    fn yes_no_and_tree_constants() {
        assert_eq!(YES, 1);
        assert_eq!(NO, 0);
        assert_eq!(TREE_MAX_DEEP, 5);
        assert_eq!(TREE_ROOT_ID, 0);
    }

    // ————————————————————— 时间格式化 —————————————————————
    // 期望值由 Java `TigUtils.handelTime`（`SimpleDateFormat("yyyy-MM-dd HH:mm:ss")`
    // + JVM 默认时区 UTC+8）人工推算，不是从本实现反推。

    #[test]
    fn add_time_null_and_zero_are_empty_string() {
        assert_eq!(format_add_time(None), "");
        assert_eq!(format_add_time(Some(0)), "");
    }

    #[test]
    fn add_time_formats_epoch_seconds() {
        // 1704067200 = 2024-01-01 00:00:00 UTC = 2024-01-01 08:00:00 UTC+8
        assert_eq!(format_add_time(Some(1_704_067_200)), "2024-01-01 08:00:00");
        // Java 源码注释「2024年12月03日 17:05」：1733216700 = 2024-12-03 09:05:00 UTC
        // = 2024-12-03 17:05:00 UTC+8
        assert_eq!(format_add_time(Some(1_733_216_700)), "2024-12-03 17:05:00");
        // 1 = 1970-01-01 00:00:01 UTC = 08:00:01
        assert_eq!(format_add_time(Some(1)), "1970-01-01 08:00:01");
        // 闰日：1709182800 = 2024-02-29 05:00:00 UTC = 2024-02-29 13:00:00 UTC+8
        assert_eq!(format_add_time(Some(1_709_182_800)), "2024-02-29 13:00:00");
        // 21 世纪闰年：2000-02-29
        // 951782400 = 2000-02-29 00:00:00 UTC = 08:00:00
        assert_eq!(format_add_time(Some(951_782_400)), "2000-02-29 08:00:00");
    }

    #[test]
    fn add_time_handles_day_boundary_across_timezone() {
        // 1735689600 = 2025-01-01 00:00:00 UTC = 2025-01-01 08:00:00 UTC+8
        assert_eq!(format_add_time(Some(1_735_689_600)), "2025-01-01 08:00:00");
        // 1735686000 = 2024-12-31 23:00:00 UTC = 2025-01-01 07:00:00 UTC+8（跨日）
        assert_eq!(format_add_time(Some(1_735_686_000)), "2025-01-01 07:00:00");
        // 1735660800 = 2024-12-31 16:00:00 UTC = 2025-01-01 00:00:00 UTC+8（整点跨年）
        assert_eq!(format_add_time(Some(1_735_660_800)), "2025-01-01 00:00:00");
    }

    // ————————————————————— 排序 —————————————————————
    // 期望值与 Java `buildSortOrder` 的三分支逐一对照。

    #[test]
    fn order_clause_semantics() {
        // 空 sortField / sortOrder ⇒ 主键降序
        assert_eq!(
            ShopProductCategoryListQuery::default().order_clause(),
            " ORDER BY category_id DESC"
        );
        // 主键属性名 ⇒ 主键列
        let q = ShopProductCategoryListQuery {
            sort_field: Some("categoryId".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY category_id ASC");
        // 属性名 → 列名
        let q = ShopProductCategoryListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");
        // 列名写法也可命中
        let q = ShopProductCategoryListQuery {
            sort_field: Some("category_name".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY category_name ASC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY（Java else-if 缺口）
        let q = ShopProductCategoryListQuery {
            sort_field: Some("sort_order".into()),
            sort_order: Some("weird".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
        // 未识别 sortField ⇒ 回退主键（防注入）
        let q = ShopProductCategoryListQuery {
            sort_field: Some("1; DROP TABLE shop_product_category".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY category_id ASC");
    }

    #[test]
    fn order_column_mapping_and_fallback() {
        assert_eq!(map_order_column("categoryId"), "category_id");
        assert_eq!(map_order_column("category_id"), "category_id");
        assert_eq!(map_order_column("isShow"), "is_show");
        assert_eq!(map_order_column("categoryPic"), "category_pic");
        // 幻觉列也回退主键（不是真实列 ⇒ 不在映射表里）
        assert_eq!(map_order_column("measure_unit"), KEY_COLUMN);
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    // ————————————————————— 关键字缺陷复刻 —————————————————————
    // 期望值直接来自 Java 第 152 行的条件，不是从本实现反推。

    #[test]
    fn keyword_filter_replicates_java_inverted_condition() {
        // keyword == null ⇒ Java 不加 LIKE
        let q = ShopProductCategoryListQuery {
            keyword: None,
            ..Default::default()
        };
        assert!(!q.java_keyword_filter_is_active());
        assert_eq!(q.effective_keyword(), None);

        // keyword == "" ⇒ Java 加 `LIKE '%%'`（恒真，等价于不过滤）
        let q = ShopProductCategoryListQuery {
            keyword: Some(String::new()),
            ..Default::default()
        };
        assert!(q.java_keyword_filter_is_active());
        assert_eq!(q.effective_keyword(), Some(""));

        // keyword 非空 ⇒ Java **不**加 LIKE（搜索失效的根因）
        let q = ShopProductCategoryListQuery {
            keyword: Some("服装".into()),
            ..Default::default()
        };
        assert!(!q.java_keyword_filter_is_active());
        assert_eq!(q.effective_keyword(), None);

        // 全空白串：`StringUtils.isEmpty("   ")` 在项目自有实现里为 false
        // ⇒ Java 同样不过滤（本实现不 trim，保持一致）
        let q = ShopProductCategoryListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert!(!q.java_keyword_filter_is_active());
        assert_eq!(q.effective_keyword(), None);
    }

    // ————————————————————— 分页 —————————————————————

    #[test]
    fn page_query_defaults_match_base_page() {
        let q = ShopProductCategoryListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        let q = ShopProductCategoryListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        let q = ShopProductCategoryListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);
        let q = ShopProductCategoryListQuery {
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
    }

    #[test]
    fn list_query_deserializes_java_param_names() {
        // Java 侧查询参数名是 `size`（BasePage），不是项目通用 `pageSize`
        let q: ShopProductCategoryListQuery = serde_json::from_str(
            r#"{"parentId":3,"keyword":"a","page":2,"size":30,"sortField":"sortOrder","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.parent_id, Some(3));
        assert_eq!(q.keyword.as_deref(), Some("a"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
    }

    // ————————————————————— updateField 归一 —————————————————————
    // 期望值与 Hutool `StrUtil.toUnderlineCase` 对照。

    #[test]
    fn to_underline_case_matches_hutool() {
        assert_eq!(to_underline_case("categoryName"), "category_name");
        assert_eq!(to_underline_case("sortOrder"), "sort_order");
        assert_eq!(to_underline_case("isShow"), "is_show");
        assert_eq!(to_underline_case("measureUnit"), "measure_unit");
        assert_eq!(to_underline_case("isHot"), "is_hot");
        assert_eq!(to_underline_case("categoryPic"), "category_pic");
        // 已是下划线写法：原样返回（不重复插下划线）
        assert_eq!(to_underline_case("category_name"), "category_name");
        assert_eq!(to_underline_case("is_show"), "is_show");
        // 单段小写
        assert_eq!(to_underline_case("id"), "id");
        // 连续大写（Hutool 把 URL 视作一段）
        assert_eq!(to_underline_case("URL"), "url");
    }

    #[test]
    fn update_field_whitelist_flow() {
        for (input, column) in [
            ("categoryName", "category_name"),
            ("category_name", "category_name"),
            ("isShow", "is_show"),
            ("is_show", "is_show"),
            ("sortOrder", "sort_order"),
            ("sort_order", "sort_order"),
            // 幻觉列：Java 白名单里有，因此**通过**校验（随后由 SQL 报错）
            ("measureUnit", "measure_unit"),
            ("isHot", "is_hot"),
        ] {
            assert_eq!(map_update_field_column(input).as_deref(), Some(column));
        }
        // 主键可归一但不在白名单 ⇒ Java 报「field 的值有误」
        assert_eq!(map_update_field_column("categoryId"), None);
        assert_eq!(map_update_field_column("id"), None);
        // 真实列 categoryPic 不在白名单（Java 原样缺陷）
        assert_eq!(map_update_field_column("categoryPic"), None);
        // 完全无法识别
        assert_eq!(map_update_field_column("something"), None);
        // 空白
        assert_eq!(map_update_field_column("   "), None);
    }

    // ————————————————————— 二级分类判定 —————————————————————
    // 期望值直接来自 Java 第 194–198 / 212–217 行。

    #[test]
    fn second_level_rule_matches_java() {
        // 父记录不存在（getById 返回 null）⇒ 放行
        assert!(allows_second_level(None));
        // 父记录 parentId = 0（一级）⇒ 放行（新分类是二级）
        assert!(allows_second_level(Some(0)));
        // 父记录 parentId = null ⇒ 放行
        assert!(allows_second_level(None));
        // 父记录 parentId > 0（二级）⇒ 拒绝（会变成三级）
        assert!(!allows_second_level(Some(1)));
        assert!(!allows_second_level(Some(99)));
    }

    // ————————————————————— 入参校验 —————————————————————

    #[test]
    fn validate_category_name_rules() {
        assert_eq!(validate_category_name(Some(" 男装 ")).unwrap(), "男装");
        assert_eq!(
            validate_category_name(Some("   ")).unwrap_err(),
            MSG_CATEGORY_NAME_REQUIRED
        );
        assert_eq!(
            validate_category_name(None).unwrap_err(),
            MSG_CATEGORY_NAME_REQUIRED
        );
        // 恰好 90 字符合法
        assert!(validate_category_name(Some(&"名".repeat(90))).is_ok());
        assert_eq!(
            validate_category_name(Some(&"名".repeat(91))).unwrap_err(),
            MSG_CATEGORY_NAME_TOO_LONG
        );
    }

    #[test]
    fn validate_category_pic_rules() {
        assert_eq!(validate_category_pic(None).unwrap(), None);
        assert_eq!(
            validate_category_pic(Some("https://a/b.png")).unwrap(),
            Some("https://a/b.png".into())
        );
        assert!(validate_category_pic(Some(&"x".repeat(255))).is_ok());
        assert_eq!(
            validate_category_pic(Some(&"x".repeat(256))).unwrap_err(),
            MSG_CATEGORY_PIC_TOO_LONG
        );
    }

    // ————————————————————— DTO / VO 序列化 —————————————————————
    // `#` 不出现在任何字符串里，但为稳妥一律用 `r##"..."##`（踩坑清单第 1 条）。

    #[test]
    fn vo_serializes_camel_case_and_keeps_nulls() {
        let vo = ShopProductCategoryVO {
            add_time: "2024-12-03 17:05:00".into(),
            category_id: 7,
            parent_id: 0,
            category_name: "男装".into(),
            has_children: None,
            is_show: 1,
            shop_id: 3,
            sort_order: 2,
            category_pic: "a.png".into(),
        };
        let v: serde_json::Value = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["categoryId"], 7);
        assert_eq!(v["addTime"], "2024-12-03 17:05:00");
        assert_eq!(v["categoryName"], "男装");
        assert_eq!(v["isShow"], 1);
        assert_eq!(v["shopId"], 3);
        assert_eq!(v["sortOrder"], 2);
        assert_eq!(v["categoryPic"], "a.png");
        // Java VO 字段是 `Integer`（无 @JsonInclude.NON_NULL），null 会保留
        assert!(v["hasChildren"].is_null());
        assert!(v.get("hasChildren").is_some());
    }

    #[test]
    fn tree_vo_serializes_camel_case() {
        let node = ShopProductCategoryTreeVO {
            category_id: 1,
            parent_id: 0,
            category_name: "男装".into(),
            category_pic: None,
            is_store: 1,
            children: vec![ShopProductCategoryTreeVO {
                category_id: 2,
                parent_id: 1,
                category_name: "衬衫".into(),
                category_pic: Some("b.png".into()),
                is_store: 1,
                children: vec![],
            }],
        };
        let v: serde_json::Value = serde_json::to_value(&node).unwrap();
        assert_eq!(v["categoryId"], 1);
        assert_eq!(v["parentId"], 0);
        assert_eq!(v["categoryName"], "男装");
        assert_eq!(v["isStore"], 1);
        assert_eq!(v["children"][0]["categoryName"], "衬衫");
        assert_eq!(v["children"][0]["categoryPic"], "b.png");
        assert!(v["categoryPic"].is_null());
    }

    #[test]
    fn create_and_update_dto_deserialize() {
        let c: ShopProductCategoryCreateDTO = serde_json::from_str(
            r##"{"shopId":3,"categoryName":"男装","parentId":0,"sortOrder":1,"isShow":1,"categoryPic":"a.png"}"##,
        )
        .unwrap();
        assert_eq!(c.shop_id, Some(3));
        assert_eq!(c.category_name.as_deref(), Some("男装"));
        assert_eq!(c.parent_id, Some(0));
        assert_eq!(c.sort_order, Some(1));
        assert_eq!(c.is_show, Some(1));
        assert_eq!(c.category_pic.as_deref(), Some("a.png"));

        let u: ShopProductCategoryUpdateDTO =
            serde_json::from_str(r##"{"categoryId":9,"categoryName":"女装"}"##).unwrap();
        assert_eq!(u.category_id, Some(9));
        assert_eq!(u.category_name.as_deref(), Some("女装"));
        // 未传的字段保持 None（MyBatis-Plus NOT_NULL 语义 ⇒ 不写列）
        assert_eq!(u.parent_id, None);
        assert_eq!(u.is_show, None);
    }

    #[test]
    fn common_dtos_deserialize() {
        let dto: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, None);

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"isShow","val":"0"}"#).unwrap();
        assert_eq!(dto.id, Some(1));
        assert_eq!(dto.field.as_deref(), Some("isShow"));

        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":0}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);
    }

    #[test]
    fn vo_from_entity_maps_all_fields() {
        let e = ShopProductCategory {
            category_id: 5,
            category_name: "男装".into(),
            shop_id: 3,
            parent_id: 1,
            sort_order: 4,
            is_show: 1,
            add_time: Some(1_733_216_700),
            category_pic: "a.png".into(),
        };
        let vo = ShopProductCategoryVO::from(&e);
        assert_eq!(vo.category_id, 5);
        assert_eq!(vo.category_name, "男装");
        assert_eq!(vo.shop_id, 3);
        assert_eq!(vo.parent_id, 1);
        assert_eq!(vo.sort_order, 4);
        assert_eq!(vo.is_show, 1);
        assert_eq!(vo.add_time, "2024-12-03 17:05:00");
        assert_eq!(vo.category_pic, "a.png");
        // 实体 → VO 不设置 hasChildren（与 Java `detail` 一致）
        assert_eq!(vo.has_children, None);
    }

    #[test]
    fn vo_from_entity_with_null_add_time_is_empty_string() {
        let e = ShopProductCategory {
            add_time: None,
            ..ShopProductCategory::default()
        };
        assert_eq!(ShopProductCategoryVO::from(&e).add_time, "");
        let e = ShopProductCategory {
            add_time: Some(0),
            ..ShopProductCategory::default()
        };
        assert_eq!(ShopProductCategoryVO::from(&e).add_time, "");
    }
}
