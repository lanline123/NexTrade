//! 首页分类栏（H5）域 DTO / VO / 查询参数（content::mobile_cat_nav）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.decorate.MobileCatNav`（表 `mobile_cat_nav`）
//! - `com.tigshop.bean.dto.decorate.MobileCatNavListDTO extends BasePage`
//! - `com.tigshop.bean.dto.decorate.MobileCatNavCreateDTO`
//! - `com.tigshop.bean.dto.decorate.MobileCatNavUpdateDTO`
//! - `com.tigshop.bean.vo.decorate.MobileCatNavVO`（含内嵌
//!   `MobileCatNavVO.ChildCatInfo` / `MobileCatNavVO.BrandInfo`）
//! - `com.tigshop.bean.dto.setting.GalleryPicDTO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.bean.enums.common.IsShowType`（`NOT_SHOW(0)` / `SHOW(1)`）
//! - `com.tigshop.common.constant.decorate.MobileCatNavConstants`
//!
//! 约定：`#[serde(rename_all = "camelCase")]`，JSON 字段名与原接口逐字符一致。
//!
//! ## 金额
//!
//! 本域（首页分类栏装修配置）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场（符合全局「金额一律 Decimal、禁用 f64」的前提
//! —— 这里没有任何金额可言）。
//!
//! ## ⚠️ `child_cat_ids` / `brand_ids` / `img_url` 的 JSON 语义不一致
//!
//! Java `MobileCatNav` 实体三个列都是 `String`（库列 `text` / `varchar(255)`），
//! 服务层用 `JsonUtil.toJson(...)` 把数组序列化后写入，读出来再
//! `JsonUtil.fromJson(...)` 还原成数组：
//!
//! | 列 | Java 实体类型 | `detail` 反序列化为 | `create` 写入的 JSON |
//! |----|---------------|----------------------|-----------------------|
//! | `child_cat_ids` | `String` | `Integer[]` | `Integer[]`（null ⇒ `[]`） |
//! | `brand_ids` | `String` | `Integer[]` | `Integer[]`（**null ⇒ `"null"`**） |
//! | `img_url` | `String` | `GalleryPicDTO[]` | `GalleryPicDTO[]`（null ⇒ `[]`） |
//!
//! `MobileCatNavVO` 把 `childCatIds` / `brandIds` 声明为 `Integer[]`、
//! `imgUrl` 声明为 `GalleryPicDTO[]`，因此对外 JSON 是**数组**而不是字符串。
//! 本实现按此还原（见 [`parse_int_array`] / [`parse_gallery_array`]）。
//!
//! ## 字段命名不一致（Java 原样，不要「顺手统一」）
//!
//! - 表列 `img_url` 存的是 **`GalleryPicDTO` 数组的 JSON**，
//!   而 Java 注释却写「分类banner字符串，使用英文符号'|'分割」——
//!   注释与实现不符。本实现按**实现**（JSON 数组）迁移，列名 `img_url` 不变。
//!
//! ## 不确定点（详见返回值 `uncertain_points`）
//!
//! - `MobileCatNavVO.childCatInfo` / `brandInfo` 两个字段在
//!   `MobileCatNavServiceImpl` 的**全部 7 条链路上都没有被赋值**
//!   （grep 全类无 `setChildCatInfo` / `setBrandInfo`），序列化后恒为 `null`。
//!   本实现保持 `null`（不凭空补数据），并在 `uncertain_points` 记录。

use serde::{Deserialize, Serialize};

use crate::entities::MobileCatNav;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `MobileCatNavConstants` / `IsShowType` / `CheckFieldConstants`）
// ——————————————————————————————————————————————

/// `mobile_cat_nav` 真实存在的 9 个列
/// （`python tools/schema_parser.py --table mobile_cat_nav`）。
///
/// 用于 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const MOBILE_CAT_NAV_COLUMNS: [&str; 9] = [
    "mobile_cat_nav_id",
    "category_id",
    "cat_color",
    "child_cat_ids",
    "brand_ids",
    "is_show",
    "img_url",
    "sort_order",
    "cat_name_alias",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `mobile_cat_nav_id`）。
pub const KEY_COLUMN: &str = "mobile_cat_nav_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `mobileCatNavId`）。
pub const KEY_PROPERTY: &str = "mobileCatNavId";

/// `updateField` 的允许字段（Java `MobileCatNavController.updateField` 内联
/// 传入 `new String[]{"is_show", "sort_order"}`）。
///
/// ⚠️ **与其它切片不同**：这里不是引用某个 `CheckFieldConstants` 常量，
/// 而是控制器里直接写的**数组字面量**，且写的已经是**列名**
/// （`is_show` / `sort_order`，snake_case），不是属性名。
pub const MOBILE_CAT_NAV_FIELDS: [&str; 2] = ["is_show", "sort_order"];

/// 「显示」的取值（Java `IsShowType.SHOW.getCode()`）。
pub const IS_SHOW_SHOW: i32 = 1;

/// 「不显示」的取值（Java `IsShowType.NOT_SHOW.getCode()`）。
pub const IS_SHOW_NOT_SHOW: i32 = 0;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `MobileCatNavConstants.CATEGORY_ID_NOT_NULL`
/// （`MobileCatNavCreateDTO.categoryId` 上的 `@NotBlank(message = ...)`）。
///
/// ⚠️ 文案说的是「名称」，字段却是 `Integer categoryId` —— Java 原样的
/// 复制粘贴痕迹，照抄不改（见 `uncertain_points`）。
pub const MSG_CATEGORY_ID_NOT_NULL: &str = "首页分类栏名称不能为空";

/// Java `MobileCatNavConstants.MOBILE_CAT_NAV_ID_NOT_NULL`
/// （`MobileCatNavUpdateDTO.mobileCatNavId` 上的 `@NotNull(message = ...)`）。
pub const MSG_MOBILE_CAT_NAV_ID_NOT_NULL: &str = "首页分类栏id不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`
/// （`BaseServiceImpl#updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`
/// （`OperateDTO.id` / `UpdateFieldDTO.id` 上的 `@NotNull`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_MOBILE_CAT_NAV_NOT_FOUND: &str = "首页分类栏不存在";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 相册图片（对应 Java `com.tigshop.bean.dto.setting.GalleryPicDTO`）。
///
/// `img_url` 列里存的就是本结构的 JSON 数组
/// （Java `JsonUtil.toJson(GalleryPicDTO[])`）。
///
/// 字段名与 Java 逐个同名，JSON 层面 camelCase。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicVO {
    /// 主键
    pub pic_id: Option<i32>,
    /// 店铺 id（Java 是 `String`）
    pub shop_id: Option<String>,
    /// 相册 id
    pub gallery_id: Option<i32>,
    /// 操作人员 id
    pub pic_ower_id: Option<i32>,
    /// 图片地址
    pub pic_url: Option<String>,
    /// 图片名称
    pub pic_name: Option<String>,
    /// 缩略图
    pub pic_thumb: Option<String>,
    /// 添加时间（Java 是 `String`）
    pub add_time: Option<String>,
    /// 文件格式，如 jpg、png、webp
    pub file_type: Option<String>,
    /// 图片宽度
    pub pic_width: Option<i32>,
    /// 图片高度
    pub pic_height: Option<i32>,
    /// 图片大小（字节）
    pub pic_size: Option<i64>,
}

/// 子分类摘要（对应 Java `MobileCatNavVO.ChildCatInfo`）。
///
/// ⚠️ Java 在 `MobileCatNavServiceImpl` 的全部链路上**从未给它赋值**，
/// 序列化后恒为 `null`。本实现保留结构（供后续补全读取逻辑）但同样不填。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ChildCatInfo {
    /// 分类 ID
    pub category_id: i32,
    /// 分类名称
    pub category_name: String,
    /// 分类图片
    pub category_pic: String,
}

/// 品牌摘要（对应 Java `MobileCatNavVO.BrandInfo`）。
///
/// ⚠️ 同 [`ChildCatInfo`]：Java 从未赋值，恒为 `null`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandInfo {
    /// 状态文本
    pub status_text: String,
    /// 品牌 ID
    pub brand_id: i32,
    /// 品牌名称
    pub brand_name: String,
    /// 品牌 Logo
    pub brand_logo: String,
}

/// 首页分类栏 VO（对应 Java `com.tigshop.bean.vo.decorate.MobileCatNavVO`）。
///
/// `list` 与 `detail` 走的是**不同的填充逻辑**（Java 就是两套代码）：
/// - `list`：`BeanUtils.copyProperties(mobileCatNav, vo)` **整行同名字段拷贝**，
///   因此 `childCatIds` / `brandIds` / `imgUrl` 保持实体里的**原始 JSON 字符串**
///   （`String` 拷到 `Integer[]` / `GalleryPicDTO[]` 上是类型不兼容的，
///   Spring 的 `BeanUtils` 会**静默跳过**这两个字段 ⇒ 保持 `null`）；
///   另外补 `categoryName`。
/// - `detail`：同样先 copy，**然后显式**把三列 `JsonUtil.fromJson(...)` 成数组。
///
/// 于是同一个 VO 在两个接口里的 `childCatIds` / `brandIds` / `imgUrl`
/// **类型都可能不同**（`list` 恒 `null`，`detail` 是数组）。
/// 本实现用 [`MobileCatNavVO::for_list`] 与 [`MobileCatNavVO::for_detail`]
/// 两个构造器分别复刻，见 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavVO {
    /// 首页分类栏 ID
    pub mobile_cat_nav_id: i32,
    /// 选择分类
    pub category_id: i32,
    /// 分类名称（`list` 时由 `category` 表补；`detail` **不补**，保持 `null`）
    pub category_name: Option<String>,
    /// 分类颜色（颜色选择器）
    pub cat_color: String,
    /// 推荐子分类（多选）。`detail` 是数组，`list` 恒 `null`。
    pub child_cat_ids: Option<Vec<i32>>,
    /// 推荐品牌。`detail` 是数组，`list` 恒 `null`。
    pub brand_ids: Option<Vec<i32>>,
    /// 是否显示：1 显示，0 不显示
    pub is_show: i32,
    /// 分类 banner（`GalleryPicDTO` 数组 JSON）。`detail` 是数组，`list` 恒 `null`。
    pub img_url: Option<Vec<GalleryPicVO>>,
    /// 在页面显示的顺序，数字越大顺序越靠后
    pub sort_order: i32,
    /// 自定义分类名
    pub cat_name_alias: Option<String>,
    /// 子分类详情（⚠️ Java 从未赋值，恒 `null`）
    pub child_cat_info: Option<Vec<ChildCatInfo>>,
    /// 品牌详情（⚠️ Java 从未赋值，恒 `null`）
    pub brand_info: Option<Vec<BrandInfo>>,
}

impl MobileCatNavVO {
    /// `detail` 链路的构造（对应 Java `detail` 的 `BeanUtils.copyProperties`
    /// + 三次 `JsonUtil.fromJson` 赋值）。
    ///
    /// `category_name` **不**填充：Java `detail` 里没有查 `category` 表，
    /// 只 copy 实体同名字段（`MobileCatNav` 没有 `categoryName`）⇒ 恒 `null`。
    #[must_use]
    pub fn for_detail(m: &MobileCatNav) -> Self {
        Self {
            mobile_cat_nav_id: m.mobile_cat_nav_id,
            category_id: m.category_id,
            category_name: None,
            cat_color: m.cat_color.clone(),
            child_cat_ids: Some(parse_int_array(Some(&m.child_cat_ids))),
            brand_ids: Some(parse_int_array(Some(&m.brand_ids))),
            is_show: m.is_show,
            img_url: Some(parse_gallery_array(Some(&m.img_url))),
            sort_order: m.sort_order,
            cat_name_alias: m.cat_name_alias.clone(),
            child_cat_info: None,
            brand_info: None,
        }
    }

    /// `list` 链路的构造（对应 Java `list` 的 `BeanUtils.copyProperties`
    /// + 补 `categoryName`）。
    ///
    /// `BeanUtils.copyProperties` 对类型不兼容的同名属性（`String` → `Integer[]`
    /// / `String` → `GalleryPicDTO[]`）**静默跳过**，因此这三个字段保持 `null`。
    #[must_use]
    pub fn for_list(m: &MobileCatNav, category_name: Option<String>) -> Self {
        Self {
            mobile_cat_nav_id: m.mobile_cat_nav_id,
            category_id: m.category_id,
            category_name,
            cat_color: m.cat_color.clone(),
            // BeanUtils 类型不兼容 ⇒ 不拷贝 ⇒ 保持 null
            child_cat_ids: None,
            brand_ids: None,
            is_show: m.is_show,
            // 同上：实体是 String，VO 是 GalleryPicDTO[]
            img_url: None,
            sort_order: m.sort_order,
            cat_name_alias: m.cat_name_alias.clone(),
            child_cat_info: None,
            brand_info: None,
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `MobileCatNavListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder`，
/// 加上本域自己的 `isShow`。
///
/// ⚠️ **契约漂移**：`MobileCatNavListDTO` 源码里**只有 `isShow`**，
/// 但 `MobileCatNavServiceImpl#list` 又调用了
/// `listDTO.getKeyword()`（`LambdaQueryWrapper.like(categoryId, keyword)`）
/// —— `getKeyword()` 来自父类 `BasePage`。本实现按服务层的**可观测行为**
/// 保留 `keyword`（与 `category_id` 列做 `LIKE`），见 `uncertain_points`。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`（`BasePage`），而项目统一 `PageQuery`
/// 用的是 `pageSize`。本结构体是**入参**，按 Java 契约用 `size`；
/// 转内部 `PageQuery` 由 [`MobileCatNavListQuery::page_query`] 桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavListQuery {
    /// 是否展示（Java `isShow`；只有 0 / 1 才参与过滤）
    pub is_show: Option<i32>,
    /// 搜索关键字（Java `BasePage.keyword`，与 `category_id` 列做 `LIKE`）
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

impl MobileCatNavListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// `isShow` 过滤条件。
    ///
    /// Java：`if (isShow != null && (isShow == SHOW || isShow == NOT_SHOW))`
    /// —— **只有 0 / 1 会加上 `eq` 条件**，其它值（如 2、-1）**静默忽略**。
    #[must_use]
    pub fn effective_is_show(&self) -> Option<i32> {
        match self.is_show {
            Some(v) if v == IS_SHOW_SHOW || v == IS_SHOW_NOT_SHOW => Some(v),
            _ => None,
        }
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100
    /// （与 area_code 同一口径）。
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
    /// - `sortField` 为空或等于主键属性名 `mobileCatNavId` → 主键列
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序；`desc`、空 ⇒ 降序；
    ///   **任何其它值完全不追加 ORDER BY**（Java 是 `else if` 的缺口）
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY {
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
/// 只允许 `mobile_cat_nav` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "mobileCatNavId" | "mobile_cat_nav_id" => "mobile_cat_nav_id",
        "categoryId" | "category_id" => "category_id",
        "catColor" | "cat_color" => "cat_color",
        "childCatIds" | "child_cat_ids" => "child_cat_ids",
        "brandIds" | "brand_ids" => "brand_ids",
        "isShow" | "is_show" => "is_show",
        "imgUrl" | "img_url" => "img_url",
        "sortOrder" | "sort_order" => "sort_order",
        "catNameAlias" | "cat_name_alias" => "cat_name_alias",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中；未命中返回 `None`
/// —— 调用方据此报「字段值不合法」。
///
/// ⚠️ 与 Java 的一处**有意偏离**：Java 找不到时返回**主键列**
/// `mobile_cat_nav_id`，再拿它去比对 `MOBILE_CAT_NAV_FIELDS`
/// （不在其中，于是同样报「字段值不合法」）。两者对白名单的判定结果
/// **完全一致**，差别只在错误分支的形状（与 area_code 同一处理）。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "mobileCatNavId" | "mobile_cat_nav_id" => Some("mobile_cat_nav_id"),
        "categoryId" | "category_id" => Some("category_id"),
        "catColor" | "cat_color" => Some("cat_color"),
        "childCatIds" | "child_cat_ids" => Some("child_cat_ids"),
        "brandIds" | "brand_ids" => Some("brand_ids"),
        "isShow" | "is_show" => Some("is_show"),
        "imgUrl" | "img_url" => Some("img_url"),
        "sortOrder" | "sort_order" => Some("sort_order"),
        "catNameAlias" | "cat_name_alias" => Some("cat_name_alias"),
        _ => None,
    }
}

/// 创建请求（Java `MobileCatNavCreateDTO`）。
///
/// Java 侧只有 `categoryId` 带 `@NotBlank`，其余全部可选。
/// 控制器类上**没有**类级 `@Validated`（见 `MobileCatNavController` 第 43–46 行，
/// 只有 `@RestController` / `@RequestMapping` / `@Tag`），方法参数上也没有
/// `@Valid` —— 因此 `@NotBlank` 在本域**实际不生效**。
/// 本实现按 Java 服务层的可观测行为：`create(null)` → `false`，
/// `categoryId` 为 null 时**不报错**、交给库的 `NOT NULL` 约束
/// （见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavCreateDTO {
    /// 选择分类
    pub category_id: Option<i32>,
    /// 分类颜色（颜色选择器）
    pub cat_color: Option<String>,
    /// 推荐子分类（多选）
    pub child_cat_ids: Option<Vec<i32>>,
    /// 推荐品牌
    pub brand_ids: Option<Vec<i32>>,
    /// 是否显示：1 显示，0 不显示
    pub is_show: Option<i32>,
    /// 分类 banner（`GalleryPicDTO` 数组）
    pub img_url: Option<Vec<GalleryPicVO>>,
    /// 在页面显示的顺序，数字越大顺序越靠后
    pub sort_order: Option<i32>,
    /// 自定义分类名
    pub cat_name_alias: Option<String>,
}

/// 更新请求（Java `MobileCatNavUpdateDTO`）。
///
/// 与 create 同构，多一个必填的 `mobileCatNavId`（Java `@NotNull`，
/// 同样因为控制器没有 `@Validated` / `@Valid` 而**不生效**；
/// 但 `updateById` 没有主键会直接失败，因此本实现在服务层显式校验，
/// 用 Java 那条 `@NotNull` 的原文案，见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavUpdateDTO {
    /// 首页分类栏 ID
    pub mobile_cat_nav_id: Option<i32>,
    /// 选择分类
    pub category_id: Option<i32>,
    /// 分类颜色（颜色选择器）
    pub cat_color: Option<String>,
    /// 推荐子分类（多选）
    pub child_cat_ids: Option<Vec<i32>>,
    /// 推荐品牌
    pub brand_ids: Option<Vec<i32>>,
    /// 是否显示：1 显示，0 不显示
    pub is_show: Option<i32>,
    /// 分类 banner（`GalleryPicDTO` 数组）
    pub img_url: Option<Vec<GalleryPicVO>>,
    /// 在页面显示的顺序，数字越大顺序越靠后
    pub sort_order: Option<i32>,
    /// 自定义分类名
    pub cat_name_alias: Option<String>,
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
/// 本域仅支持 `type = "del"`，`value` / `data` 不参与逻辑。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `@NotEmpty`）
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

/// 把库里的 JSON 数组字符串还原为 `Vec<i32>`
/// （对应 Java `JsonUtil.fromJson(json, Integer[].class)`）。
///
/// Java 语义（逐条对照 `JsonUtil` 第 118–140 行）：
/// - `null` 或**空串** ⇒ `null`（Hutool 层直接短路，返回 null）
/// - 内容不是 JSON 形态 ⇒ 打 warn 后返回 `null`
/// - 反序列化失败 ⇒ 返回 `null`
///
/// 本实现把前三种「Java 返回 null」的情况统一为**空数组**：
/// Java VO 里该字段是 `Integer[]`，`null` 与 `[]` 在 JSON 上分别是
/// `null` 与 `[]`，此处选空数组是为了让前端 `v-for` 免判空。
/// ⚠️ 这是**与 Java 的一处有意偏离**，已列入 `uncertain_points`。
#[must_use]
pub fn parse_int_array(raw: Option<&str>) -> Vec<i32> {
    let Some(text) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<i32>>(text).unwrap_or_default()
}

/// 把库里的 JSON 数组字符串还原为 `Vec<GalleryPicVO>`
/// （对应 Java `JsonUtil.fromJson(json, GalleryPicDTO[].class)`）。
///
/// 容错策略同 [`parse_int_array`]（Java 返回 `null` ⇒ 本实现返回空数组）。
#[must_use]
pub fn parse_gallery_array(raw: Option<&str>) -> Vec<GalleryPicVO> {
    let Some(text) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<GalleryPicVO>>(text).unwrap_or_default()
}

/// 数组 → 库列要写的 JSON 文本（对应 Java `JsonUtil.toJson(...)`）。
///
/// ⚠️ Java `JsonUtil.toJson` 在 `object == null` 时返回 **`null`**，
/// 而 MyBatis-Plus 的 `FieldStrategy.NOT_NULL` 会跳过 null 列。
/// 调用方据此决定「写列」还是「走库默认值」——见
/// [`json_array_or_skip`]。
#[must_use]
pub fn to_json_array<T: Serialize>(v: &[T]) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string())
}

/// `create` 时三列 JSON 文本的取值（对应 Java `create` 的三行 setter）。
///
/// Java 逐条：
/// ```text
/// setImgUrl(toJson(dto.getImgUrl() == null ? new GalleryPicDTO[0] : dto.getImgUrl()));
/// setBrandIds(toJson(dto.getBrandIds()));          // ← null 时 toJson 返回 null
/// setChildCatIds(toJson(dto.getChildCatIds() == null ? new Integer[0] : dto.getChildCatIds()));
/// ```
///
/// 因此：
/// - `img_url`：null ⇒ `"[]"`
/// - `child_cat_ids`：null ⇒ `"[]"`
/// - `brand_ids`：null ⇒ **`None`**（`toJson(null)` = `null` ⇒ MyBatis-Plus
///   跳过该列 ⇒ 保留库中的旧值 / 走列默认值）
///
/// 返回 `(img_url, child_cat_ids, brand_ids)`，其中 `brand_ids` 为 `None`
/// 表示**不写该列**。
#[must_use]
pub fn create_json_columns(
    img_url: Option<&[GalleryPicVO]>,
    child_cat_ids: Option<&[i32]>,
    brand_ids: Option<&[i32]>,
) -> (String, String, Option<String>) {
    let img = to_json_array(img_url.unwrap_or(&[]));
    let child = to_json_array(child_cat_ids.unwrap_or(&[]));
    let brand = brand_ids.map(to_json_array);
    (img, child, brand)
}

/// `img_url` 列在 `create` 时的取值：null ⇒ `"[]"`（Java 的 `new GalleryPicDTO[0]`）。
#[must_use]
pub fn img_url_for_create(v: Option<&[GalleryPicVO]>) -> String {
    to_json_array(v.unwrap_or(&[]))
}

/// `child_cat_ids` 列在 `create` 时的取值：null ⇒ `"[]"`（Java 的 `new Integer[0]`）。
#[must_use]
pub fn child_cat_ids_for_create(v: Option<&[i32]>) -> String {
    to_json_array(v.unwrap_or(&[]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> MobileCatNav {
        MobileCatNav {
            mobile_cat_nav_id: 7,
            category_id: 42,
            cat_color: "#ff0000".into(),
            child_cat_ids: "[1,2]".into(),
            brand_ids: "[9]".into(),
            is_show: 1,
            img_url: r#"[{"picId":3,"picUrl":"/a.png"}]"#.into(),
            sort_order: 5,
            cat_name_alias: Some("别名".into()),
        }
    }

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `MobileCatNavController.updateField` 的内联白名单。
    #[test]
    fn update_field_whitelist_matches_java_literal() {
        assert_eq!(MOBILE_CAT_NAV_FIELDS, ["is_show", "sort_order"]);
        // 白名单两项必须在真实列里
        for f in MOBILE_CAT_NAV_FIELDS {
            assert!(MOBILE_CAT_NAV_COLUMNS.contains(&f), "{f} 不是真实列");
        }
        // 主键可归一但并不在白名单里
        assert!(!MOBILE_CAT_NAV_FIELDS.contains(&KEY_COLUMN));
    }

    /// Java `IsShowType` 的两个码值。
    #[test]
    fn is_show_type_codes() {
        assert_eq!(IS_SHOW_SHOW, 1);
        assert_eq!(IS_SHOW_NOT_SHOW, 0);
    }

    /// Java 常量文案逐字符照抄（含「名称」指代 `categoryId` 的笔误）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_CATEGORY_ID_NOT_NULL, "首页分类栏名称不能为空");
        assert_eq!(MSG_MOBILE_CAT_NAV_ID_NOT_NULL, "首页分类栏id不能为空");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    // ————————————————————— 纯逻辑：JSON 列解析 —————————————————————

    #[test]
    fn parse_int_array_handles_java_shapes() {
        assert_eq!(parse_int_array(Some("[1,2,3]")), vec![1, 2, 3]);
        assert_eq!(parse_int_array(Some("[]")), Vec::<i32>::new());
        // Java `JsonUtil.fromJson` 对 null / 空串直接返回 null ⇒ 本实现给空数组
        assert_eq!(parse_int_array(None), Vec::<i32>::new());
        assert_eq!(parse_int_array(Some("")), Vec::<i32>::new());
        assert_eq!(parse_int_array(Some("   ")), Vec::<i32>::new());
        // 非 JSON 形态 / 反序列化失败 ⇒ 不 panic，退化为空数组
        assert_eq!(parse_int_array(Some("abc")), Vec::<i32>::new());
        assert_eq!(parse_int_array(Some("{\"a\":1}")), Vec::<i32>::new());
    }

    #[test]
    fn parse_gallery_array_handles_java_shapes() {
        let v = parse_gallery_array(Some(r#"[{"picId":3,"picUrl":"/a.png"}]"#));
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].pic_id, Some(3));
        assert_eq!(v[0].pic_url.as_deref(), Some("/a.png"));

        assert!(parse_gallery_array(Some("[]")).is_empty());
        assert!(parse_gallery_array(None).is_empty());
        assert!(parse_gallery_array(Some("")).is_empty());
        // 非法 JSON 不 panic
        assert!(parse_gallery_array(Some("not json")).is_empty());
    }

    /// `create` 三列 JSON：`brand_ids` 的 null 语义与另两列**不同**。
    #[test]
    fn create_json_columns_null_semantics() {
        // 三者都为 null：img / child 落 "[]"，brand 不写列
        let (img, child, brand) = create_json_columns(None, None, None);
        assert_eq!(img, "[]");
        assert_eq!(child, "[]");
        assert_eq!(brand, None);

        // 有值时正常序列化
        let pics = vec![GalleryPicVO {
            pic_id: Some(1),
            pic_url: Some("/x.png".into()),
            ..Default::default()
        }];
        let (img, child, brand) = create_json_columns(Some(&pics), Some(&[1, 2]), Some(&[9]));
        // 本域序列化器是 **Jackson**（项目 `JsonUtil.toJson` →
        // `ObjectMapper.writeValueAsString`），默认 `Include.ALWAYS`：
        // null 字段**照常输出**。故这里断言 JSON 语义与字段全集，
        // 而不是逐字节字符串（Jackson 还开了 `INDENT_OUTPUT`）。
        let v: serde_json::Value = serde_json::from_str(&img).unwrap();
        let arr = v.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["picId"], 1);
        assert_eq!(arr[0]["picUrl"], "/x.png");
        assert_eq!(
            arr[0].as_object().unwrap().len(),
            12,
            "必须镜像 Java `GalleryPicDTO` 的全部 12 个字段"
        );
        assert_eq!(child, "[1,2]");
        assert_eq!(brand.as_deref(), Some("[9]"));

        // 空数组显式传入 ⇒ 写 "[]"（与 null 的 img/child 同结果）
        let (img, child, _) = create_json_columns(Some(&[]), Some(&[]), Some(&[]));
        assert_eq!(img, "[]");
        assert_eq!(child, "[]");
    }

    #[test]
    fn create_helpers_default_to_empty_array() {
        assert_eq!(img_url_for_create(None), "[]");
        assert_eq!(child_cat_ids_for_create(None), "[]");
        let pics = vec![GalleryPicVO::default()];
        assert!(img_url_for_create(Some(&pics)).starts_with('['));
    }

    // ————————————————————— 纯逻辑：VO 构造（list vs detail） —————————————————————

    /// `detail`：三列 JSON 还原为数组；`categoryName` **不**补（恒 null）。
    #[test]
    fn detail_vo_parses_json_and_leaves_category_name_null() {
        let vo = MobileCatNavVO::for_detail(&sample());
        assert_eq!(vo.mobile_cat_nav_id, 7);
        assert_eq!(vo.category_name, None);
        assert_eq!(vo.child_cat_ids, Some(vec![1, 2]));
        assert_eq!(vo.brand_ids, Some(vec![9]));
        assert_eq!(vo.img_url.as_ref().map(Vec::len), Some(1));
        assert_eq!(vo.sort_order, 5);
        assert_eq!(vo.cat_name_alias.as_deref(), Some("别名"));
        // Java 从未赋值的两个字段恒为 null
        assert!(vo.child_cat_info.is_none());
        assert!(vo.brand_info.is_none());
    }

    /// `list`：BeanUtils 类型不兼容 ⇒ 三列保持 `null`；`categoryName` 由调用方补。
    #[test]
    fn list_vo_keeps_json_columns_null_but_fills_category_name() {
        let vo = MobileCatNavVO::for_list(&sample(), Some("手机".into()));
        assert_eq!(vo.category_name.as_deref(), Some("手机"));
        assert!(vo.child_cat_ids.is_none());
        assert!(vo.brand_ids.is_none());
        assert!(vo.img_url.is_none());
        // 分类没查到时不填（Java `if (category != null) setCategoryName`）
        let vo = MobileCatNavVO::for_list(&sample(), None);
        assert_eq!(vo.category_name, None);
    }

    // ————————————————————— 纯逻辑：list 过滤与排序 —————————————————————

    /// `isShow` 只有 0 / 1 参与过滤，其它值静默忽略。
    #[test]
    fn is_show_filter_only_accepts_zero_and_one() {
        let q = MobileCatNavListQuery {
            is_show: Some(1),
            ..Default::default()
        };
        assert_eq!(q.effective_is_show(), Some(1));
        let q = MobileCatNavListQuery {
            is_show: Some(0),
            ..Default::default()
        };
        assert_eq!(q.effective_is_show(), Some(0));
        let q = MobileCatNavListQuery {
            is_show: None,
            ..Default::default()
        };
        assert_eq!(q.effective_is_show(), None);
        for bad in [2, -1, 99] {
            let q = MobileCatNavListQuery {
                is_show: Some(bad),
                ..Default::default()
            };
            assert_eq!(q.effective_is_show(), None, "isShow={bad} 应被忽略");
        }
    }

    #[test]
    fn effective_keyword_trims_and_ignores_blank() {
        let q = MobileCatNavListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), None);
        let q = MobileCatNavListQuery {
            keyword: Some(" 42 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), Some("42"));
    }

    /// Java `buildSortOrder` 三分支：asc 升序；空与 desc 降序；
    /// **其它非法值不追加 ORDER BY**。
    #[test]
    fn order_clause_three_branches() {
        let q = MobileCatNavListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY mobile_cat_nav_id ASC");

        let q = MobileCatNavListQuery {
            sort_order: None,
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY mobile_cat_nav_id DESC");

        let q = MobileCatNavListQuery {
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY mobile_cat_nav_id DESC");

        let q = MobileCatNavListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");

        // 属性名与列名都能命中
        let q = MobileCatNavListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
        let q = MobileCatNavListQuery {
            sort_field: Some("sort_order".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");

        // 主键属性名 ⇒ 主键列
        let q = MobileCatNavListQuery {
            sort_field: Some(KEY_PROPERTY.into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY mobile_cat_nav_id ASC");
    }

    /// 未识别 `sortField` 静默回退主键列（防注入）。
    #[test]
    fn unknown_sort_field_falls_back_to_key() {
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("is_show"), "is_show");
        assert_eq!(map_order_column("isShow"), "is_show");
        let q = MobileCatNavListQuery {
            sort_field: Some("id; DROP TABLE mobile_cat_nav".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY mobile_cat_nav_id DESC");
    }

    #[test]
    fn page_query_defaults_match_base_page() {
        let q = MobileCatNavListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        let q = MobileCatNavListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        let q = MobileCatNavListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);
        let q = MobileCatNavListQuery {
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
    }

    // ————————————————————— 纯逻辑：updateField 白名单 —————————————————————

    #[test]
    fn update_field_column_normalization() {
        assert_eq!(map_update_field_column("isShow"), Some("is_show"));
        assert_eq!(map_update_field_column("is_show"), Some("is_show"));
        assert_eq!(map_update_field_column("sortOrder"), Some("sort_order"));
        assert_eq!(map_update_field_column("sort_order"), Some("sort_order"));
        // 主键能归一但不在白名单
        assert_eq!(map_update_field_column("mobileCatNavId"), Some(KEY_COLUMN));
        assert_eq!(
            map_update_field_column("mobile_cat_nav_id"),
            Some(KEY_COLUMN)
        );
        assert_eq!(map_update_field_column("nope"), None);
        // 真实列但不在白名单（会被服务层拒绝）
        assert_eq!(map_update_field_column("catColor"), Some("cat_color"));
        assert!(!MOBILE_CAT_NAV_FIELDS.contains(&"cat_color"));
    }

    // ————————————————————— 纯逻辑：入参反序列化 —————————————————————

    #[test]
    fn list_query_deserializes_java_param_names() {
        // Java 侧查询参数名是 `size`（BasePage），不是项目通用 `pageSize`
        let q: MobileCatNavListQuery = serde_json::from_str(
            r#"{"isShow":1,"keyword":"42","page":2,"size":30,"sortField":"sortOrder","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.effective_is_show(), Some(1));
        assert_eq!(q.effective_keyword(), Some("42"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
    }

    #[test]
    fn create_dto_deserializes_camel_case() {
        // 注意：`catColor` 的值以 `#` 开头（`"#fff"`），而该值前一个字符是 `"`，
        // 会与 `r#"..."#` 的结束分隔符 `"#` 撞车导致原始字符串提前闭合。
        // 故这里用 `r##"..."##`（更多 # 的定界符）。
        let dto: MobileCatNavCreateDTO = serde_json::from_str(
            r##"{"categoryId":42,"catColor":"#fff","childCatIds":[1,2],"brandIds":[9],
                "isShow":1,"imgUrl":[{"picId":3}],"sortOrder":5,"catNameAlias":"别名"}"##,
        )
        .unwrap();
        assert_eq!(dto.category_id, Some(42));
        assert_eq!(dto.child_cat_ids, Some(vec![1, 2]));
        assert_eq!(dto.brand_ids, Some(vec![9]));
        assert_eq!(dto.sort_order, Some(5));
        assert_eq!(dto.img_url.as_ref().map(Vec::len), Some(1));
        // 全空也能反序列化（Java 侧 @NotBlank 未生效，见 uncertain_points）
        let dto: MobileCatNavCreateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.category_id, None);
        assert!(dto.brand_ids.is_none());
    }

    #[test]
    fn update_dto_deserializes_camel_case() {
        let dto: MobileCatNavUpdateDTO =
            serde_json::from_str(r#"{"mobileCatNavId":7,"categoryId":42,"isShow":0}"#).unwrap();
        assert_eq!(dto.mobile_cat_nav_id, Some(7));
        assert_eq!(dto.category_id, Some(42));
        assert_eq!(dto.is_show, Some(0));
        // 缺主键时是 None（服务层据此报 Java 原文案）
        let dto: MobileCatNavUpdateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.mobile_cat_nav_id, None);
    }

    #[test]
    fn common_dtos_deserialize() {
        let dto: OperateDTO = serde_json::from_str(r#"{"id":7}"#).unwrap();
        assert_eq!(dto.id, Some(7));
        let dto: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, None);

        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":0}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[],"type":"show"}"#).unwrap();
        assert_eq!(dto.r#type, "show");
        assert!(dto.ids.is_empty());
        // Java `value` 是原始 int（缺省 0）
        assert_eq!(dto.value, None);
    }
}
