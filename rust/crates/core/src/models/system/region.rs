//! 地区管理域（system::region）管理端 DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.setting.RegionController`
//!   （`@RequestMapping("/adminapi/setting/region")`，
//!    类级 `@PreAuthorize("@pms.hasPermission('regionManage')")`）
//! - `com.tigshop.bean.model.setting.Region`（表 `region`）
//! - `com.tigshop.bean.dto.setting.RegionListDTO extends BasePage`
//! - `com.tigshop.bean.dto.setting.RegionCreateDTO`
//! - `com.tigshop.bean.dto.setting.RegionUpdateDTO extends RegionCreateDTO`
//! - `com.tigshop.bean.vo.setting.RegionListVO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.CheckFieldConstants.REGION_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` /
//!   `sortField` / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（地区字典维护）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。
//!
//! ## 与 system::region_client 的关系
//!
//! `tigshop_core::models::system::region_client` 承载的是**前台**地区接口
//! （`tigshop-api` 的 `RegionController`：省份/城市/级联/路径）。
//! 本模块是**管理端**（`tigshop-adminapi` 的 `RegionController`）的
//! CRUD / 树 / 单字段更新 / 批量，两者读写同一张 `region` 表但
//! 入参出参形状不同，故各自持有副本（与 area_code 对
//! `OperateDTO` / `BatchDTO` 的处理方式一致）。

use serde::{Deserialize, Serialize};

use crate::entities::Region;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `CheckFieldConstants` / `Constants`）
// ——————————————————————————————————————————————

/// `region` 真实存在的 8 个列
/// （`python tools/schema_parser.py --table region` 核对）：
/// `region_id` / `level` / `region_name` / `parent_id` / `is_hot` /
/// `sort_order` / `first_word` / `standard_code`。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const REGION_COLUMNS: [&str; 8] = [
    "region_id",
    "level",
    "region_name",
    "parent_id",
    "is_hot",
    "sort_order",
    "first_word",
    "standard_code",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `region_id`）。
pub const KEY_COLUMN: &str = "region_id";

/// 主键**属性名**（Java `BaseServiceImpl#getKeyProperty` → `regionId`）。
///
/// `buildSortOrder` 的第一句比较用的是**属性名**而不是列名：
/// `ObjectUtil.equals(sortField, getKeyProperty())`。
pub const KEY_PROPERTY: &str = "regionId";

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.REGION_FIELDS = {"region_name", "sort_order",
/// "is_hot", "first_word"}`）。
///
/// ⚠️ 白名单里**没有** `parent_id` / `level`：管理端改层级只能走
/// `/update`（那里有「不能选自身」「按父级重算 level」的业务规则）。
/// 四项全部是 `region` 的真实列（见 [`REGION_COLUMNS`]）。
pub const REGION_FIELDS: [&str; 4] = ["region_name", "sort_order", "is_hot", "first_word"];

/// 「是」的取值（Java `Constants.YES = 1`，本域用于 `is_hot`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// 新建 / 更新地区时 `sort_order` 的默认值
/// （Java `RegionServiceImpl#updateRegion`：`dto.getSortOrder() == null ? 50 : ...`）。
pub const DEFAULT_SORT_ORDER: i32 = 50;

/// 树的最大深度（Java `TreeNodeConfig#setDeep(8)`）。
pub const TREE_MAX_DEEP: u32 = 8;

/// 地区名最大长度（Java `RegionCreateDTO` / `RegionListVO` 上的
/// `@Size(max = 200)`；库列也是 `varchar(200)`）。
pub const REGION_NAME_MAX_LEN: usize = 200;

/// 首字母最大长度（Java `RegionCreateDTO.firstWord` 上的 `@Size(max = 1)`）。
///
/// ⚠️ 与库列 `first_word varchar(50)` 不一致：Java **只允许 1 个字符**。
pub const FIRST_WORD_MAX_LEN: usize = 1;

// ————————————————————— Java 常量文案（逐字符照抄） ——————————————————————

/// Java `RegionCreateDTO.regionName` 上 `@NotNull(message = "地区名称不能为空")`。
pub const MSG_REGION_NAME_REQUIRED: &str = "地区名称不能为空";

/// Java `RegionCreateDTO.regionName` 上 `@Size(max = 200, message = "地区名称最多200个字符")`。
pub const MSG_REGION_NAME_MAX_SIZE: &str = "地区名称最多200个字符";

/// Java `RegionCreateDTO.parentId` 上 `@NotNull(message = "上级地区不能为空")`。
pub const MSG_PARENT_ID_REQUIRED: &str = "上级地区不能为空";

/// Java `RegionUpdateDTO.id` 上 `@NotNull(message = "地区ID不能为空")`。
pub const MSG_REGION_ID_REQUIRED: &str = "地区ID不能为空";

/// Java `RegionCreateDTO.firstWord` 上 `@Size(max = 1, message = "首字母最多1个字符")`。
pub const MSG_FIRST_WORD_MAX_SIZE: &str = "首字母最多1个字符";

/// Java `RegionServiceImpl#updateRegion` 的 `new GlobalException("地区不存在")`。
pub const MSG_REGION_NOT_FOUND: &str = "地区不存在";

/// Java `RegionServiceImpl#updateRegion` 的 `new GlobalException("上级地区不能选择自身")`。
pub const MSG_PARENT_IS_SELF: &str = "上级地区不能选择自身";

/// Java `RegionServiceImpl#updateRegion` 的 `new GlobalException("上级地区不存在")`。
pub const MSG_PARENT_NOT_FOUND: &str = "上级地区不存在";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `RegionServiceImpl#getRegionByParentId` 用的 `PARAM_ERROR` 文案。
///
/// 本切片的管理端接口不直接调用它，保留常量是为了与 system::region_client 的
/// 同一处 Java 文案对照。
pub const MSG_PARAM_ERROR: &str = "参数错误";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 地区 VO（对应 Java `com.tigshop.bean.vo.setting.RegionListVO`）。
///
/// Java `list` 与 `detail` 都是
/// `BeanUtils.copyProperties(region, vo)` —— 同名列逐一拷贝。
/// `RegionListVO` 的 7 个字段与 `Region` 的 7 个业务列同名，
/// **`standard_code` 不在 VO 里**（Java 未映射该字段），
/// 因此这里也不输出。
///
/// ⚠️ 类型映射的一处「按注解而非按列」：`level` 在库列里可空
/// （`tinyint unsigned NULL`），而 `RegionListVO.level` 是
/// `Integer`（可空），因此这里用 `Option<i32>`。
/// 其余 6 个字段库列都是 `NOT NULL`，VO 侧按 Java 也用可空包装
/// （`@NotNull` 只在 `regionName` / `parentId` 上，且那是**入参校验**
/// 注解，用在 `RegionListVO` 上属于复用同一个类做校验）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionListVO {
    /// 主键
    pub region_id: i32,
    /// 地区名称
    pub region_name: String,
    /// 父级 id
    pub parent_id: i32,
    /// 级别
    pub level: Option<i32>,
    /// 是否热门：1 是 0 否
    pub is_hot: i32,
    /// 排序值，数值越小越靠前
    pub sort_order: i32,
    /// 首字母
    pub first_word: String,
}

impl From<&Region> for RegionListVO {
    fn from(r: &Region) -> Self {
        Self {
            region_id: r.region_id,
            region_name: r.region_name.clone(),
            parent_id: r.parent_id,
            level: r.level,
            is_hot: r.is_hot,
            sort_order: r.sort_order,
            first_word: r.first_word.clone(),
        }
    }
}

impl From<Region> for RegionListVO {
    fn from(r: Region) -> Self {
        Self::from(&r)
    }
}

/// 地区经纬度定位 VO（Java 来源：前端契约
/// `view/admin/src/api/setting/region.ts#getLocationByRegionId`，
/// 返回 `{ regionId, regionName, centor }`；`centor`（中心点
/// "经度,纬度"）在 `region` 表中已无对应列（Java `RegionVO.centor`
/// 同样只声明不映射），恒为 `null`，字段保留以兼容前端类型）。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegionLocationVO {
    /// 地区主键
    pub region_id: i32,
    /// 地区名称
    pub region_name: String,
    /// 父级 id
    pub parent_id: i32,
    /// 级别
    pub level: Option<i32>,
    /// 中心点（`region` 表已无此列，恒为 `null`）
    pub centor: Option<String>,
}

impl From<&Region> for RegionLocationVO {
    fn from(r: &Region) -> Self {
        Self {
            region_id: r.region_id,
            region_name: r.region_name.clone(),
            parent_id: r.parent_id,
            level: r.level,
            centor: None,
        }
    }
}

/// 地区树节点（对应 Java `cn.hutool.core.lang.tree.Tree<Integer>`，
/// 由 `TreeUtil.build` + `TreeNodeConfig` 产出）。
///
/// Java 的 `TreeNodeConfig` 设置：
/// - `idKey = "regionId"`
/// - `parentIdKey = "parentId"`
/// - `nameKey = "regionName"`
/// - `deep = 8`
///
/// `TreeUtil.build(regionList, 0, config, consumer)` 的 consumer 又把
/// `regionId` / `parentId` / `regionName` 三个键塞进 `extra`。
/// Hutool `Tree` 的序列化形状是
/// `{id, parentId, name, weight, children, <extra 展平>}`，
/// 其中 `id` / `parentId` / `name` 来自 `config` 的键名重命名
/// （即同样落到 `regionId` / `parentId` / `regionName`），
/// 因此最终 JSON 里 `regionId` / `parentId` / `regionName` 各出现一次
/// （extra 覆盖同名的 config 键），外加 `children`。
///
/// ⚠️ Hutool 还会输出 `weight`（null）与 `empty` 之类的内部键，
/// 其精确形状依赖 Hutool 版本，本实现只保留**有业务语义**的字段
/// （见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionTreeNode {
    /// 地区主键（`idKey = "regionId"`）
    pub region_id: i32,
    /// 父级 id（`parentIdKey = "parentId"`）
    pub parent_id: i32,
    /// 地区名称（`nameKey = "regionName"`）
    pub region_name: String,
    /// 子节点（Hutool `Tree#children`；无子节点时 Java 是 `null`，
    /// 这里为 `[]`，见 `uncertain_points`）
    pub children: Vec<RegionTreeNode>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `RegionListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder`。
/// （`BasePage` 还有 `sortItems`，但 Java `RegionServiceImpl#list` 调的是
/// 三参数重载 `buildSortOrder(page, dto.getSortField(), dto.getSortOrder())`，
/// **不使用** `sortItems`。）
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`RegionListQuery::page_query`] 完成桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionListQuery {
    /// 父级 id（Java `parentId`；`>= 0` 才生效，负数视为不筛选）
    pub parent_id: Option<i32>,
    /// 地区 id（Java `regionId`；`>= 0` 才生效，负数视为不筛选）
    pub region_id: Option<i32>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值或空 ⇒ 降序，Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl RegionListQuery {
    /// 生效的 `parentId` 过滤（Java `parentId != null && parentId >= 0`）。
    #[must_use]
    pub fn effective_parent_id(&self) -> Option<i32> {
        self.parent_id.filter(|v| *v >= 0)
    }

    /// 生效的 `regionId` 过滤（Java `regionId != null && regionId >= 0`）。
    #[must_use]
    pub fn effective_region_id(&self) -> Option<i32> {
        self.region_id.filter(|v| *v >= 0)
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`，与 area_code 一致）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }
}

/// 应用层默认排序子句（Java `RegionServiceImpl#list` 的
/// `queryWrapper.orderByAsc(sortOrder).orderByAsc(regionId)`）。
///
/// ⚠️ **与 Java 的一个关键差异**：Java 在 `sortField` 为空时**不是**
/// 走 `buildSortOrder`（那个默认降序），而是显式
/// `orderByAsc(sort_order).orderByAsc(region_id)` —— **双列升序**。
/// 只有当 `sortField` 非空时才走 `buildSortOrder` 的单列排序。
/// 这个分支差异必须保留，否则管理端列表默认顺序会反。
#[must_use]
pub const fn default_order_clause() -> &'static str {
    " ORDER BY sort_order ASC, region_id ASC"
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `region` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
///
/// ⚠️ Java 的 `getColumnByPropertyName` **先判主键列名**
/// （`tableInfo.getKeyColumn().equals(propertyName)` ⇒ 直接返回主键列），
/// 再遍历属性/列。对 `region_id` 这个入参而言两者结果相同
/// （`Region` 的主键列名就是 `region_id`），故可合并成一个 `match`。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "regionId" | "region_id" => "region_id",
        "regionName" | "region_name" => "region_name",
        "parentId" | "parent_id" => "parent_id",
        "level" => "level",
        "isHot" | "is_hot" => "is_hot",
        "sortOrder" | "sort_order" => "sort_order",
        "firstWord" | "first_word" => "first_word",
        "standardCode" | "standard_code" => "standard_code",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

impl RegionListQuery {
    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `RegionServiceImpl#list` + `BaseServiceImpl#buildSortOrder`
    /// 等价：
    /// - `sortField` **为空** ⇒ [`default_order_clause`]（双列升序）
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   未命中回退主键列（MyBatis-Plus 的安全修复行为，不是报错）；
    ///   若 `sortField` 等于**主键属性名** `regionId`，Java 的
    ///   `ObjectUtil.equals(sortField, getKeyProperty())` 也把它换成主键列
    /// - `asc`（忽略大小写）升序；`desc`、空、或**任何其它值**都不设置排序
    ///   —— 注意 Java 在这里是 `else if`，非 asc 且非 desc 且非空时
    ///   **完全不追加 ORDER BY**（与 `sortField` 为空时的双列升序不同！）
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        if field.is_empty() {
            // Java：`if (StrUtil.isBlank(dto.getSortField()))` 走双列升序，
            // **不进入** buildSortOrder
            return default_order_clause().to_string();
        }
        let column = if field == KEY_PROPERTY {
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

/// 创建请求（Java `RegionCreateDTO`）。
///
/// Java 侧 `@NotNull` / `@Size(max = 200)` / `@Size(max = 1)`，
/// 且控制器类上有类级 `@Validated`，`create` 参数上还有 `@Valid`，
/// 因此这些注解**确实生效**。本实现把校验放在服务层，
/// 文案逐字符照抄 Java 注解的 `message`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionCreateDTO {
    /// 主键（Java `RegionCreateDTO.regionId`；create 语义下由库自增，
    /// 但 DTO 里带着该字段，前端若传则 `BeanUtils.copyProperties` 会一并写入）
    pub region_id: Option<i32>,
    /// 地区名称（必填，最长 200）
    pub region_name: Option<String>,
    /// 父级 id（必填；0 = 根）
    pub parent_id: Option<i32>,
    /// 级别（Java `create` **不校验、不重算**，原样落库）
    pub level: Option<i32>,
    /// 是否热门：1 是 0 否（Java `create` 原样落库，可为 null）
    pub is_hot: Option<i32>,
    /// 排序值（Java `create` 原样落库，可为 null）
    pub sort_order: Option<i32>,
    /// 首字母（Java `@Size(max = 1)`；`create` 原样落库，可为 null）
    pub first_word: Option<String>,
}

/// 更新请求（Java `RegionUpdateDTO extends RegionCreateDTO`）。
///
/// `#[serde(flatten)]` 对齐 Java 的继承展开：JSON 层面就是
/// `{ "id": 1, "regionName": "...", "parentId": 0, ... }` 的扁平结构。
///
/// ⚠️ `id` 与父类的 `regionId` 是**两个不同的字段**：
/// Java `updateRegion` 用的是 `dto.getId()` 去查记录，
/// 而 `regionId` 只是 DTO 上的一个普通字段，**不参与**更新逻辑
/// （既不用它查记录，也不写回库）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionUpdateDTO {
    /// 地区 ID（Java `@NotNull(message = "地区ID不能为空")`）
    pub id: Option<i32>,
    /// 父类字段（Java `RegionCreateDTO`）
    #[serde(flatten)]
    pub base: RegionCreateDTO,
}

impl RegionUpdateDTO {
    /// 供校验复用的父类型视图（命名对应 Java 继承展开后的取用点）。
    #[must_use]
    pub fn as_create(&self) -> &RegionCreateDTO {
        &self.base
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
/// Java 侧三个字段都带 `@NotNull`，且控制器类级有 `@Validated` +
/// 方法参数 `@Valid`，因此 `id` / `field` / `val` 缺一即 400。
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
    /// 主键列表（Java `@NotEmpty`，控制器类级 `@Validated` ⇒ 空数组 400）
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

/// `updateField` 的字段名归一（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中；未命中返回 `None`
/// —— 调用方据此报「字段值不合法」。
///
/// ⚠️ 与 Java 的一处**有意偏离**：Java 找不到时返回**主键列** `region_id`，
/// 再拿它去比对 `REGION_FIELDS`（`region_id` 不在其中，于是同样报
/// 「字段值不合法」）。两者对白名单的判定结果**完全一致**，
/// 差别只在错误分支的形状（与 area_code 的处理一致）。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "regionId" | "region_id" => Some("region_id"),
        "regionName" | "region_name" => Some("region_name"),
        "parentId" | "parent_id" => Some("parent_id"),
        "level" => Some("level"),
        "isHot" | "is_hot" => Some("is_hot"),
        "sortOrder" | "sort_order" => Some("sort_order"),
        "firstWord" | "first_word" => Some("first_word"),
        "standardCode" | "standard_code" => Some("standard_code"),
        _ => None,
    }
}

/// 校验地区名（对应 Java `RegionCreateDTO.regionName` 上的
/// `@NotNull` + `@Size(max = 200)`）。
///
/// 返回 trim 后的名称。
///
/// # Errors
/// - 缺失或全空白 ⇒ `地区名称不能为空`
/// - 超过 200 字符 ⇒ `地区名称最多200个字符`
///
/// ⚠️ **`@NotNull` 不拒绝空串**：Java 的 `@NotNull` 只挡 `null`，
/// `""` 与 `"   "` 都能通过 `@NotNull`（`@Size(max = 200)` 也不挡）。
/// 本实现按「空白视为未填」处理（比 Java 更严），
/// 已记入 `uncertain_points`。
pub fn validate_region_name(raw: Option<&str>) -> Result<String, String> {
    let name = raw
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_REGION_NAME_REQUIRED.to_string())?
        .to_string();
    if name.chars().count() > REGION_NAME_MAX_LEN {
        return Err(MSG_REGION_NAME_MAX_SIZE.to_string());
    }
    Ok(name)
}

/// 校验首字母（对应 Java `RegionCreateDTO.firstWord` 上的 `@Size(max = 1)`）。
///
/// 返回 trim 后的首字母；未填返回 `None`。
///
/// ⚠️ Java 的 `@Size` **对 `null` 放行**，所以 `firstWord` 是可选的；
/// 空串 `""` 长度 0 也合法（`@Size(max = 1)` 只管上界）。
///
/// # Errors
/// - 超过 1 个字符 ⇒ `首字母最多1个字符`
pub fn validate_first_word(raw: Option<&str>) -> Result<Option<String>, String> {
    let Some(word) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    if word.chars().count() > FIRST_WORD_MAX_LEN {
        return Err(MSG_FIRST_WORD_MAX_SIZE.to_string());
    }
    Ok(Some(word.to_string()))
}

/// 校验上级地区（对应 Java `RegionCreateDTO.parentId` 上的 `@NotNull`）。
///
/// # Errors
/// - 缺失 ⇒ `上级地区不能为空`
pub fn validate_parent_id(raw: Option<i32>) -> Result<i32, String> {
    raw.ok_or_else(|| MSG_PARENT_ID_REQUIRED.to_string())
}

/// 层级推导（对应 Java `RegionServiceImpl#updateRegion`）：
/// ```text
/// Integer level = 1;
/// if (parentId != 0) {
///     Region parent = this.getById(parentId);
///     if (parent == null || parent.getLevel() == null) throw "上级地区不存在";
///     level = parent.getLevel() + 1;
/// }
/// ```
///
/// `parent_level`：
/// - `Some(Some(l))`：父节点存在且 `level` 非 null ⇒ `l + 1`
/// - `Some(None)`：父节点存在但 `level` 为 null ⇒ 报 `上级地区不存在`
/// - `None`：父节点不存在 ⇒ 报 `上级地区不存在`
///
/// `parentId == 0` 时**不查父节点**，直接返回 1。
///
/// # Errors
/// - 父节点不存在或其 `level` 为空 ⇒ `上级地区不存在`
pub fn resolve_level(parent_id: i32, parent_level: Option<Option<i32>>) -> Result<i32, String> {
    if parent_id == 0 {
        return Ok(1);
    }
    match parent_level {
        Some(Some(level)) => Ok(level + 1),
        Some(None) | None => Err(MSG_PARENT_NOT_FOUND.to_string()),
    }
}

/// 首字母归一（对应 Java `RegionServiceImpl#updateRegion` 的最后一段）：
/// ```text
/// String firstWord = StrUtil.trim(dto.getFirstWord());
/// region.setFirstWord(StrUtil.isBlank(firstWord)
///         ? PinyinUtil.getPinyin(dto.getRegionName()).substring(0, 1).toUpperCase()
///         : firstWord.substring(0, 1).toUpperCase());
/// ```
///
/// 语义：
/// - 传了非空白首字母 ⇒ 取**第一个字符**并大写
/// - 未传 / 全空白 ⇒ 用地区名的拼音首字母大写
///
/// ⚠️ **拼音不可用**：Java 用 Hutool `PinyinUtil.getPinyin(name)`，
/// Rust 工作区无拼音依赖（且不允许改 `Cargo.toml`）。
/// 本实现对 ASCII 字母/数字取该字符大写，其余（中文等）**回退为空串**
/// —— 这是与 Java 的**可观测行为差异**，已记入 `uncertain_points`。
/// 注意 Java 的 `substring(0, 1)` 在 `regionName` 为空串时会抛
/// `StringIndexOutOfBoundsException`，本实现返回空串而不崩。
#[must_use]
pub fn normalize_first_word(raw_first_word: Option<&str>, region_name: &str) -> String {
    let provided = raw_first_word.map(str::trim).filter(|s| !s.is_empty());
    match provided {
        Some(word) => first_char_upper(word),
        None => pinyin_first_letter(region_name),
    }
}

/// 取首字符并大写（Java `firstWord.substring(0, 1).toUpperCase()`）。
///
/// Java 对 `""` 会抛越界异常；这里返回空串。
#[must_use]
pub fn first_char_upper(s: &str) -> String {
    match s.chars().next() {
        Some(c) => c.to_uppercase().collect(),
        None => String::new(),
    }
}

/// 名称 → 拼音首字母大写（Java `PinyinUtil.getPinyin(name).substring(0, 1).toUpperCase()`）。
///
/// Rust 侧无拼音库：ASCII 字母/数字直接取字符大写；
/// 其它（中文、标点等）返回**空串**（Java 会返回真实拼音首字母）。
#[must_use]
pub fn pinyin_first_letter(name: &str) -> String {
    match name.trim().chars().next() {
        Some(c) if c.is_ascii_alphanumeric() => c.to_uppercase().collect(),
        _ => String::new(),
    }
}

/// 把扁平地区列表构建成树（对应 Java `RegionServiceImpl#getRegionTree`
/// → Hutool `TreeUtil.build(regionList, 0, config, consumer)`）。
///
/// 语义：
/// - **根节点的判定是「父级 == `root_parent_id`」**（Java 传的是字面量 `0`），
///   **不是** `parent_id == 0` 的递归展开
/// - 子节点按**输入顺序**挂载（Hutool `TreeUtil.build` 按 list 顺序遍历，
///   同一父节点下保持原相对顺序）
/// - `deep = 8`：Hutool 的 `TreeUtil.build` 用 `deep` 做「向上找父节点」
///   的搜索深度上限，超过就不挂载。这里做等价的**层级深度保护**：
///   递归超过 `TREE_MAX_DEEP` 层就截断（不再往下挂）
/// - 环引用（父子互指）由「已访问集合」保护，避免无限递归
///
/// ⚠️ Hutool 的 `deep` 语义（限制「向父方向」查找的层数）与这里的
/// 「限制向下递归层数」并非逐字等价，但对正常的地区树
/// （深度 4 左右）结果一致；已记入 `uncertain_points`。
#[must_use]
pub fn build_region_tree(
    mut nodes: Vec<RegionTreeNode>,
    root_parent_id: i32,
) -> Vec<RegionTreeNode> {
    // 按 parent_id 分桶，保持输入顺序
    let mut children_of: std::collections::HashMap<i32, Vec<RegionTreeNode>> =
        std::collections::HashMap::new();
    let mut roots: Vec<RegionTreeNode> = Vec::new();

    for node in nodes.drain(..) {
        if node.parent_id == root_parent_id {
            roots.push(node);
        } else {
            children_of.entry(node.parent_id).or_default().push(node);
        }
    }

    let mut visited: std::collections::HashSet<i32> = std::collections::HashSet::new();
    for root in &mut roots {
        attach_children(root, &mut children_of, &mut visited, 1);
    }
    roots
}

/// 递归挂载子节点（`depth` 从 1 开始计，达到 `TREE_MAX_DEEP` 即截断）。
fn attach_children(
    node: &mut RegionTreeNode,
    children_of: &mut std::collections::HashMap<i32, Vec<RegionTreeNode>>,
    visited: &mut std::collections::HashSet<i32>,
    depth: u32,
) {
    if depth >= TREE_MAX_DEEP {
        return;
    }
    if !visited.insert(node.region_id) {
        // 环：该节点已在当前路径上出现过，不再展开
        return;
    }
    if let Some(mut kids) = children_of.remove(&node.region_id) {
        for kid in &mut kids {
            attach_children(kid, children_of, visited, depth + 1);
        }
        node.children = kids;
    }
    // 注意：`visited` 不清理 —— 一个地区的 region_id 全局唯一，
    // 在树里也只可能出现一次（`parent_id` 单亲），因此无需回溯清理。
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `CheckFieldConstants.REGION_FIELDS` 的逐字对照。
    #[test]
    fn region_fields_matches_java_constant() {
        assert_eq!(
            REGION_FIELDS,
            ["region_name", "sort_order", "is_hot", "first_word"]
        );
        // 白名单四项全部是真实列
        for f in REGION_FIELDS {
            assert!(REGION_COLUMNS.contains(&f), "{f} 不是 region 的真实列");
        }
        // 白名单**不含** parent_id / level（改层级只能走 /update）
        assert!(!REGION_FIELDS.contains(&"parent_id"));
        assert!(!REGION_FIELDS.contains(&"level"));
        assert!(!REGION_FIELDS.contains(&"region_id"));
    }

    /// Java 注解 / 异常文案逐字符照抄。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_REGION_NAME_REQUIRED, "地区名称不能为空");
        assert_eq!(MSG_REGION_NAME_MAX_SIZE, "地区名称最多200个字符");
        assert_eq!(MSG_PARENT_ID_REQUIRED, "上级地区不能为空");
        assert_eq!(MSG_REGION_ID_REQUIRED, "地区ID不能为空");
        assert_eq!(MSG_FIRST_WORD_MAX_SIZE, "首字母最多1个字符");
        assert_eq!(MSG_REGION_NOT_FOUND, "地区不存在");
        assert_eq!(MSG_PARENT_IS_SELF, "上级地区不能选择自身");
        assert_eq!(MSG_PARENT_NOT_FOUND, "上级地区不存在");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    /// Java 的默认值 / 配置常量。
    #[test]
    fn java_default_constants() {
        assert_eq!(DEFAULT_SORT_ORDER, 50); // updateRegion 的 `== null ? 50 :`
        assert_eq!(TREE_MAX_DEEP, 8); // TreeNodeConfig#setDeep(8)
        assert_eq!(REGION_NAME_MAX_LEN, 200); // @Size(max = 200)
        assert_eq!(FIRST_WORD_MAX_LEN, 1); // @Size(max = 1)
        assert_eq!(YES, 1);
        assert_eq!(NO, 0);
    }

    // ————————————————————— 出参映射 —————————————————————

    /// VO 映射：`standard_code` **不出现**在 VO 里（与 Java `RegionListVO` 一致）。
    #[test]
    fn vo_drops_standard_code() {
        let r = Region {
            region_id: 110000,
            region_name: "北京市".into(),
            parent_id: 0,
            level: Some(2),
            is_hot: 1,
            sort_order: 10,
            first_word: "B".into(),
            standard_code: Some("CN-11".into()),
        };
        let vo = RegionListVO::from(&r);
        assert_eq!(vo.region_id, 110000);
        assert_eq!(vo.region_name, "北京市");
        assert_eq!(vo.parent_id, 0);
        assert_eq!(vo.level, Some(2));
        assert_eq!(vo.is_hot, 1);
        assert_eq!(vo.sort_order, 10);
        assert_eq!(vo.first_word, "B");
        // 序列化后不含 standardCode
        let json = serde_json::to_string(&vo).unwrap();
        assert!(!json.contains("standardCode"), "{json}");
    }

    /// `level` 可空（库列 `tinyint unsigned NULL`）。
    #[test]
    fn vo_level_is_nullable() {
        let r = Region {
            level: None,
            ..Region::default()
        };
        let vo = RegionListVO::from(&r);
        assert_eq!(vo.level, None);
    }

    /// VO 的 JSON 键名是 camelCase（前端契约）。
    #[test]
    fn vo_serializes_camel_case() {
        let vo = RegionListVO {
            region_id: 1,
            region_name: "北京".into(),
            parent_id: 0,
            level: Some(2),
            is_hot: 1,
            sort_order: 50,
            first_word: "B".into(),
        };
        let v: serde_json::Value = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["regionId"], 1);
        assert_eq!(v["regionName"], "北京");
        assert_eq!(v["parentId"], 0);
        assert_eq!(v["isHot"], 1);
        assert_eq!(v["sortOrder"], 50);
        assert_eq!(v["firstWord"], "B");
    }

    // ————————————————————— 纯逻辑：updateField 白名单 —————————————————————

    /// 归一 + 白名单：`region_id` / `parent_id` / `level` 能归一但被白名单拒绝；
    /// 未识别字段直接拒绝。
    #[test]
    fn update_field_whitelist_flow() {
        // 四个白名单字段（属性名与列名两种写法）
        for (input, column) in [
            ("regionName", "region_name"),
            ("region_name", "region_name"),
            ("sortOrder", "sort_order"),
            ("sort_order", "sort_order"),
            ("isHot", "is_hot"),
            ("is_hot", "is_hot"),
            ("firstWord", "first_word"),
            ("first_word", "first_word"),
        ] {
            let c = map_update_field_column(input).unwrap();
            assert_eq!(c, column);
            assert!(REGION_FIELDS.contains(&c));
        }
        // 能归一但不在白名单 ⇒ Java 报「字段值不合法」
        for outside in [
            "regionId",
            "region_id",
            "parentId",
            "parent_id",
            "level",
            "standardCode",
            "standard_code",
        ] {
            let c = map_update_field_column(outside).unwrap();
            assert!(!REGION_FIELDS.contains(&c), "{outside} 不应在白名单");
        }
        // 完全无法识别 ⇒ 归一失败
        assert!(map_update_field_column("something").is_none());
    }

    // ————————————————————— 纯逻辑：list 排序 —————————————————————

    /// `sortField` 为空时走**双列升序**（Java `list` 的显式分支），
    /// 而不是 `buildSortOrder` 的降序 —— 这是本域最容易写错的地方。
    #[test]
    fn blank_sort_field_uses_two_column_asc() {
        assert_eq!(
            RegionListQuery::default().order_clause(),
            " ORDER BY sort_order ASC, region_id ASC"
        );
        // 只有 sortField 非空才进入 buildSortOrder
        let q = RegionListQuery {
            sort_field: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), default_order_clause());
    }

    /// 非空 `sortField` 的三分支：asc 升序；空与 desc 降序；其它非法值不排序。
    #[test]
    fn order_clause_three_branches() {
        let q = RegionListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");

        let q = RegionListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: None,
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");

        let q = RegionListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");

        // 非法值：Java else-if 未覆盖 ⇒ 无排序
        let q = RegionListQuery {
            sort_field: Some("sortOrder".into()),
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    /// 主键属性名 `regionId` 被 `buildSortOrder` 换成主键列
    /// （`ObjectUtil.equals(sortField, getKeyProperty())`）。
    #[test]
    fn key_property_maps_to_key_column() {
        let q = RegionListQuery {
            sort_field: Some("regionId".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY region_id ASC");
        assert_eq!(KEY_PROPERTY, "regionId");
        assert_eq!(KEY_COLUMN, "region_id");
    }

    /// 未识别 `sortField` 静默回退主键列（防注入）。
    #[test]
    fn unknown_sort_field_falls_back_to_key() {
        assert_eq!(map_order_column("nope"), "region_id");
        assert_eq!(map_order_column("parent_id"), "parent_id");
        assert_eq!(map_order_column("isHot"), "is_hot");
        let q = RegionListQuery {
            sort_field: Some("region_name; DROP TABLE region".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY region_id DESC");
    }

    /// 过滤条件：`>= 0` 才生效（Java `parentId != null && parentId >= 0`）。
    #[test]
    fn filters_require_non_negative() {
        let q = RegionListQuery::default();
        assert_eq!(q.effective_parent_id(), None);
        assert_eq!(q.effective_region_id(), None);
        let q = RegionListQuery {
            parent_id: Some(-1),
            region_id: Some(-5),
            ..Default::default()
        };
        assert_eq!(q.effective_parent_id(), None);
        assert_eq!(q.effective_region_id(), None);
        let q = RegionListQuery {
            parent_id: Some(0),
            region_id: Some(0),
            ..Default::default()
        };
        assert_eq!(q.effective_parent_id(), Some(0));
        assert_eq!(q.effective_region_id(), Some(0));
        let q = RegionListQuery {
            parent_id: Some(500100),
            region_id: Some(500105),
            ..Default::default()
        };
        assert_eq!(q.effective_parent_id(), Some(500100));
        assert_eq!(q.effective_region_id(), Some(500105));
    }

    /// Java `BasePage`：`page` 默认 1，`size` 默认 15、上限 100。
    #[test]
    fn page_query_defaults_match_base_page() {
        let q = RegionListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        let q = RegionListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        let q = RegionListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);
        let q = RegionListQuery {
            page: Some(0),
            size: Some(30),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 30);
    }

    // ————————————————————— 纯逻辑：入参校验 —————————————————————

    /// `create` / `update` 的名称校验（Java `@NotNull` + `@Size(max=200)`）。
    #[test]
    fn region_name_validation() {
        assert_eq!(
            validate_region_name(None).unwrap_err(),
            MSG_REGION_NAME_REQUIRED
        );
        assert_eq!(
            validate_region_name(Some("   ")).unwrap_err(),
            MSG_REGION_NAME_REQUIRED
        );
        assert_eq!(validate_region_name(Some(" 北京市 ")).unwrap(), "北京市");
        // 200 字符合法，201 报错
        assert!(validate_region_name(Some(&"名".repeat(200))).is_ok());
        assert_eq!(
            validate_region_name(Some(&"名".repeat(201))).unwrap_err(),
            MSG_REGION_NAME_MAX_SIZE
        );
    }

    /// 首字母校验（Java `@Size(max = 1)`）：可选、空串合法、2 字符报错。
    #[test]
    fn first_word_validation() {
        assert_eq!(validate_first_word(None).unwrap(), None);
        assert_eq!(validate_first_word(Some("  ")).unwrap(), None);
        assert_eq!(validate_first_word(Some("b")).unwrap(), Some("b".into()));
        // 空串长度 0 也满足 @Size(max = 1)
        assert_eq!(validate_first_word(Some("")).unwrap(), None);
        assert_eq!(
            validate_first_word(Some("BJ")).unwrap_err(),
            MSG_FIRST_WORD_MAX_SIZE
        );
    }

    /// `parentId` 必填（Java `@NotNull`）。
    #[test]
    fn parent_id_required() {
        assert_eq!(
            validate_parent_id(None).unwrap_err(),
            MSG_PARENT_ID_REQUIRED
        );
        assert_eq!(validate_parent_id(Some(0)).unwrap(), 0);
        assert_eq!(validate_parent_id(Some(500100)).unwrap(), 500100);
    }

    // ————————————————————— 纯逻辑：level 推导 —————————————————————

    /// Java `updateRegion` 的 level 规则：
    /// `parentId == 0` ⇒ 1；否则父级 level + 1；父级不存在或其 level 为 null ⇒ 报错。
    #[test]
    fn resolve_level_rules() {
        assert_eq!(resolve_level(0, None).unwrap(), 1);
        // parentId == 0 时不查父节点，即使传了父级 level 也忽略
        assert_eq!(resolve_level(0, Some(Some(99))).unwrap(), 1);
        assert_eq!(resolve_level(1, Some(Some(1))).unwrap(), 2);
        assert_eq!(resolve_level(110000, Some(Some(2))).unwrap(), 3);
        // 父节点存在但 level 为 null ⇒ 报「上级地区不存在」
        assert_eq!(
            resolve_level(1, Some(None)).unwrap_err(),
            MSG_PARENT_NOT_FOUND
        );
        // 父节点不存在 ⇒ 同样报「上级地区不存在」
        assert_eq!(resolve_level(1, None).unwrap_err(), MSG_PARENT_NOT_FOUND);
    }

    // ————————————————————— 纯逻辑：首字母归一 —————————————————————

    /// Java `updateRegion` 的首字母规则：传了取首字符大写，未传用拼音首字母。
    #[test]
    fn normalize_first_word_rules() {
        assert_eq!(normalize_first_word(Some("beijing"), "北京市"), "B");
        assert_eq!(normalize_first_word(Some("b"), "北京市"), "B");
        // 空白视为未传 ⇒ 退回名称推导
        assert_eq!(normalize_first_word(Some("   "), "Beijing"), "B");
        assert_eq!(normalize_first_word(None, "beijing"), "B");
        assert_eq!(normalize_first_word(None, "1号店"), "1");
        // 中文无拼音库 ⇒ 空串（Java 会给出真实拼音首字母，差异已记 uncertain）
        assert_eq!(normalize_first_word(None, "北京市"), "");
        // 空名称：Java 抛 StringIndexOutOfBounds，这里返回空串
        assert_eq!(normalize_first_word(None, ""), "");
    }

    /// 首字符大写工具本身。
    #[test]
    fn first_char_upper_tool() {
        assert_eq!(first_char_upper("abc"), "A");
        assert_eq!(first_char_upper("Z"), "Z");
        assert_eq!(first_char_upper("1"), "1");
        assert_eq!(first_char_upper(""), "");
        assert_eq!(pinyin_first_letter("北京市"), "");
        assert_eq!(pinyin_first_letter("Beijing"), "B");
        assert_eq!(pinyin_first_letter(""), "");
    }

    // ————————————————————— 纯逻辑：树构建 —————————————————————

    fn node(id: i32, parent: i32, name: &str) -> RegionTreeNode {
        RegionTreeNode {
            region_id: id,
            parent_id: parent,
            region_name: name.into(),
            children: Vec::new(),
        }
    }

    /// Java `TreeUtil.build(list, 0, ...)`：根是 `parent_id == 0` 的节点，
    /// 子节点按输入顺序挂载。
    #[test]
    fn build_tree_roots_at_parent_zero() {
        let tree = build_region_tree(
            vec![
                node(110000, 0, "北京市"),
                node(110100, 110000, "市辖区"),
                node(110101, 110100, "东城区"),
                node(120000, 0, "天津市"),
            ],
            0,
        );
        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].region_name, "北京市");
        assert_eq!(tree[1].region_name, "天津市");
        assert_eq!(tree[0].children.len(), 1);
        assert_eq!(tree[0].children[0].region_name, "市辖区");
        assert_eq!(tree[0].children[0].children[0].region_name, "东城区");
        assert!(tree[1].children.is_empty());
    }

    /// 根 id 可配置（Java 传字面量 0，但语义是「哪个父级算根」）。
    #[test]
    fn build_tree_root_id_is_parameter() {
        let tree = build_region_tree(vec![node(1, 0, "中国"), node(110000, 1, "北京市")], 1);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].region_name, "北京市");
    }

    /// 孤儿节点（父级不在列表里）被丢弃，不 panic
    /// （Hutool `TreeUtil.build` 也是丢弃）。
    #[test]
    fn build_tree_drops_orphans() {
        let tree = build_region_tree(vec![node(110100, 999999, "市辖区")], 0);
        assert!(tree.is_empty());
    }

    /// 深链在 `TREE_MAX_DEEP` 层处截断，且不会因环引用死循环。
    #[test]
    fn build_tree_depth_cap_and_cycle_safe() {
        // 20 层深链：从 1 到 20
        let chain: Vec<RegionTreeNode> =
            (1..=20).map(|i| node(i, i - 1, &format!("n{i}"))).collect();
        let tree = build_region_tree(chain, 0);
        assert_eq!(tree.len(), 1);
        // 逐层下钻，层数不超过 TREE_MAX_DEEP
        let mut depth = 1;
        let mut cur = &tree[0];
        while let Some(next) = cur.children.first() {
            depth += 1;
            cur = next;
        }
        assert_eq!(depth, TREE_MAX_DEEP);

        // 环：1 -> 2 -> 1（2 的父是 1，1 的父是 2；都没有 parent==0 的根）
        // 这里用「根之下出现回指」构造：3 是根，3 的子 4 的子又指回 3
        let tree = build_region_tree(
            vec![node(3, 0, "a"), node(4, 3, "b"), node(3, 4, "a-again")],
            0,
        );
        assert_eq!(tree.len(), 1);
        // 不 panic、不死循环即通过
        assert!(tree[0].children.len() <= 1);
    }

    /// 空列表 ⇒ 空树（Java `getRegionTree` 对空列表直接返回 `emptyList()`）。
    #[test]
    fn build_tree_empty_input() {
        assert!(build_region_tree(Vec::new(), 0).is_empty());
    }

    // ————————————————————— DTO 反序列化 —————————————————————

    /// 列表查询按 Java `BasePage` 的参数名解析（`size` 而非 `pageSize`）。
    #[test]
    fn list_query_deserializes_java_param_names() {
        let q: RegionListQuery = serde_json::from_str(
            r#"{"parentId":0,"regionId":110000,"page":2,"size":30,"sortField":"sortOrder","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.effective_parent_id(), Some(0));
        assert_eq!(q.effective_region_id(), Some(110000));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
    }

    /// `RegionUpdateDTO` 继承展开：`id` 与父类字段是扁平结构。
    #[test]
    fn update_dto_flattens_base_fields() {
        let dto: RegionUpdateDTO = serde_json::from_str(
            r#"{"id":9,"regionId":7,"regionName":"北京市","parentId":0,"isHot":1,"sortOrder":50,"firstWord":"B"}"#,
        )
        .unwrap();
        assert_eq!(dto.id, Some(9));
        // `regionId` 与 `id` 是两个不同的字段，且 regionId 不参与更新逻辑
        assert_eq!(dto.as_create().region_id, Some(7));
        assert_eq!(dto.as_create().region_name.as_deref(), Some("北京市"));
        assert_eq!(dto.as_create().parent_id, Some(0));
        assert_eq!(dto.as_create().is_hot, Some(1));
        assert_eq!(dto.as_create().sort_order, Some(50));
        assert_eq!(dto.as_create().first_word.as_deref(), Some("B"));
    }

    /// `create` 只给最小字段也能解析（其余走 Java 的 null 语义）。
    #[test]
    fn create_dto_minimal() {
        let dto: RegionCreateDTO =
            serde_json::from_str(r#"{"regionName":"北京市","parentId":0}"#).unwrap();
        assert_eq!(dto.region_id, None);
        assert_eq!(dto.level, None);
        assert_eq!(dto.is_hot, None);
        assert_eq!(dto.sort_order, None);
        assert_eq!(dto.first_word, None);
    }

    /// `updateField` / `del` / `batch` 三个通用 DTO。
    #[test]
    fn generic_dtos_deserialize() {
        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"is_hot","val":"1"}"#).unwrap();
        assert_eq!(dto.id, Some(1));
        assert_eq!(dto.field.as_deref(), Some("is_hot"));
        assert_eq!(dto.val.as_deref(), Some("1"));

        let dto: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, None);
        assert_eq!(dto.admin_note.as_deref(), Some("x"));

        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);
    }

    /// 树节点 JSON 键名（对齐 Hutool `TreeNodeConfig` 的键）。
    #[test]
    fn tree_node_serializes_camel_case() {
        let t = RegionTreeNode {
            region_id: 110000,
            parent_id: 0,
            region_name: "北京市".into(),
            children: vec![node(110100, 110000, "市辖区")],
        };
        let v: serde_json::Value = serde_json::to_value(&t).unwrap();
        assert_eq!(v["regionId"], 110000);
        assert_eq!(v["parentId"], 0);
        assert_eq!(v["regionName"], "北京市");
        assert_eq!(v["children"][0]["regionName"], "市辖区");
        // 空 children 序列化为 []
        let v: serde_json::Value = serde_json::to_value(node(1, 0, "x")).unwrap();
        assert_eq!(v["children"], serde_json::json!([]));
    }
}
