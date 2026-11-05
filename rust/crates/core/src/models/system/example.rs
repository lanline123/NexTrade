//! 示例域（system::example）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.example.Example`（表 `example`，实体已由
//!   `tigshop_core::entities::setting::Example` 自动生成）
//! - `com.tigshop.bean.dto.example.ExampleCreateDTO`
//! - `com.tigshop.bean.dto.example.ExampleUpdateDTO`
//! - `com.tigshop.bean.dto.example.ExampleListDTO extends BasePage`
//! - `com.tigshop.bean.vo.example.ExampleVO`
//! - `com.tigshop.bean.enums.common.IsShowType`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.example.ExampleConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.EXAMPLE_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（示例数据维护）**不涉及任何金额列**，因此没有
//! `rust_decimal::Decimal` 出场。

use serde::{Deserialize, Serialize};

use crate::entities::setting::Example;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java ExampleConstants / CheckFieldConstants / IsShowType）
// ——————————————————————————————————————————————

/// `example` 真实存在的 7 个列
/// （`python tools/schema_parser.py --table example`）。
pub const EXAMPLE_COLUMNS: [&str; 7] = [
    "example_id",
    "example_name",
    "example_pic",
    "example_desc",
    "sort_order",
    "is_show",
    "status",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `example_id`）。
pub const KEY_COLUMN: &str = "example_id";

/// 主键属性名（Java `getKeyProperty()` → `exampleId`）。
pub const KEY_PROPERTY: &str = "exampleId";

/// `updateField` 的允许字段
/// （Java `CheckFieldConstants.EXAMPLE_FIELDS
/// = {"example_name", "is_show", "sort_order"}`）。
///
/// ✅ 这三个都是 `example` 的**真实列**，白名单不含有缺陷项
/// （对比 logistics::shipping_type 的 `SHIPPING_TYPE_FIELDS` 含不存在的 `is_show`）。
pub const EXAMPLE_FIELDS: [&str; 3] = ["example_name", "is_show", "sort_order"];

/// `is_show` 的取值：不显示（Java `IsShowType.NOT_SHOW(0, "不显示")`）。
pub const IS_SHOW_NOT_SHOW: i32 = 0;

/// `is_show` 的取值：显示（Java `IsShowType.SHOW(1, "显示")`）。
pub const IS_SHOW_SHOW: i32 = 1;

/// 「是」的取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// `example_name` 的最大长度（Java `ExampleCreateDTO` 上
/// `@Size(max = 50, message = EXAMPLE_NAME_OVER_LENGTH)`，含 50）。
///
/// ⚠️ 库列是 `varchar(60)`，比注解的 50 宽 —— 注解是**更严格**的一侧，
/// 因此按 50 校验不会触发 MySQL 截断。
pub const NAME_MAX_LEN: usize = 50;

/// 库列 `example_name` 的真实长度上限（`varchar(60)`）。
pub const NAME_COLUMN_MAX_LEN: usize = 60;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `ExampleConstants.EXAMPLE_NAME_NOT_NULL`。
pub const MSG_EXAMPLE_NAME_REQUIRED: &str = "示例名称不能为空";

/// Java `ExampleConstants.EXAMPLE_NAME_OVER_LENGTH`。
pub const MSG_EXAMPLE_NAME_OVER_LENGTH: &str = "示例名称长度不能超过50";

/// Java `ExampleConstants.EXAMPLE_ID_NOT_NULL`。
pub const MSG_EXAMPLE_ID_REQUIRED: &str = "示例id不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`，注意带一个空格：
/// `"field 的值有误"`（逐字符照抄，不要「顺手」去掉空格）。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_EXAMPLE_NOT_FOUND: &str = "示例不存在";

// ——————————————————————————————————————————————
// `IsShowType` 等价物
// ——————————————————————————————————————————————

/// 复刻 Java `com.tigshop.bean.enums.common.IsShowType`。
///
/// Java 是 `NOT_SHOW(0, "不显示")` / `SHOW(1, "显示")`，
/// 并提供 `fromTypeCode(Integer code) -> IsShowType | null`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IsShowType {
    /// `NOT_SHOW(0, "不显示")`
    NotShow,
    /// `SHOW(1, "显示")`
    Show,
}

impl IsShowType {
    /// 对应 Java `getCode()`（`Integer`）。
    #[must_use]
    pub fn code(self) -> i32 {
        match self {
            Self::NotShow => IS_SHOW_NOT_SHOW,
            Self::Show => IS_SHOW_SHOW,
        }
    }

    /// 对应 Java `getName()`。
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::NotShow => "不显示",
            Self::Show => "显示",
        }
    }

    /// 复刻 Java `fromTypeCode(Integer code)`。
    ///
    /// ⚠️ Java 的实现是**按声明顺序线性扫描并 `Integer.equals` 比较**：
    /// - `null` → `null`（**不会 NPE**，因为 `equals` 的接收者是枚举常量）
    /// - 未匹配（如 `2`、`-1`）→ `null`
    ///
    /// 因此调用点 `if (IsShowType.fromTypeCode(isShow) != null) { eq(...) }`
    /// **只对 0 和 1 生效**，其它值（含 null）不加过滤条件。
    /// 这是本域最容易被误实现的一处，务必按 [`is_filterable`] 使用。
    #[must_use]
    pub fn from_type_code(code: Option<i32>) -> Option<Self> {
        match code? {
            IS_SHOW_NOT_SHOW => Some(Self::NotShow),
            IS_SHOW_SHOW => Some(Self::Show),
            _ => None,
        }
    }
}

/// 判断 `isShow` 是否应产生 `eq(is_show, ?)` 过滤条件
/// （等价 Java `IsShowType.fromTypeCode(isShow) != null`）。
///
/// 只有 `Some(0)` / `Some(1)` 返回 `true`；`None` 与其它值都返回 `false`。
#[must_use]
pub fn is_show_filterable(is_show: Option<i32>) -> bool {
    IsShowType::from_type_code(is_show).is_some()
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 示例 VO（对应 Java `com.tigshop.bean.vo.example.ExampleVO`）。
///
/// Java `list` / `detail` 都是
/// `BeanUtils.copyProperties(example, vo)`，逐字段同名拷贝，
/// 没有派生字段（对比 area_code 的 `AreaCodeVO.label`）。
///
/// ⚠️ 注意 `ExampleVO` 的字段顺序是
/// `exampleId, exampleName, examplePic, sortOrder, isShow, status,
/// exampleDesc` —— 与实体/`ExampleCreateDTO` 的声明顺序**不同**
/// （VO 把 `exampleDesc` 放最后）。字段顺序不影响 JSON 语义
/// （JSON 对象无序），但为可读性本结构体按 VO 的顺序排列。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExampleVO {
    /// 示例ID
    pub example_id: i32,
    /// 示例名称
    pub example_name: String,
    /// 示例图片
    pub example_pic: String,
    /// 示例排序
    pub sort_order: i32,
    /// 是否展示
    pub is_show: i32,
    /// 状态（库列可空）
    pub status: Option<i32>,
    /// 示例描述
    pub example_desc: String,
}

impl From<&Example> for ExampleVO {
    fn from(e: &Example) -> Self {
        Self {
            example_id: e.example_id,
            example_name: e.example_name.clone(),
            example_pic: e.example_pic.clone(),
            sort_order: e.sort_order,
            is_show: e.is_show,
            status: e.status,
            example_desc: e.example_desc.clone(),
        }
    }
}

impl From<Example> for ExampleVO {
    fn from(e: Example) -> Self {
        Self::from(&e)
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `ExampleListDTO extends BasePage`）。
///
/// Java 只额外声明了 `isShow`；`keyword` / `page` / `size` /
/// `sortField` / `sortOrder` 来自 `BasePage`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExampleListQuery {
    /// 是否展示（Java `isShow`）
    ///
    /// ⚠️ 只有 `0` / `1` 会产生过滤条件（见 [`is_show_filterable`]）。
    pub is_show: Option<i32>,
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

impl ExampleListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    ///
    /// ⚠️ Java 这里用的是 **`isNotEmpty`**（不是 `isNotBlank`），
    /// 因此 `"   "`（纯空白）**会**被当作有效关键字，生成 `LIKE '%   %'`。
    /// 本方法逐字符复刻该口径（与 area_code 的 `isNotBlank` **不同**）。
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
    /// ⚠️ `ExampleServiceImpl#list` 第 57 行是**无条件**调用
    /// `buildSortOrder(page, listDTO.getSortField(), listDTO.getSortOrder())`
    /// （不在 `if` 里），因此 `sortField` 为空时走的是 `buildSortOrder` 内部的
    /// 「用主键列 + 降序」分支，**没有**本域特有的默认排序。
    ///
    /// 即：`sortField` 空 ⇒ `ORDER BY example_id DESC`。
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
/// ⚠️ 未识别字段**回退主键列**（Java 的防注入「安全修复」，不是报错）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "exampleId" | "example_id" | "id" => "example_id",
        "exampleName" | "example_name" => "example_name",
        "examplePic" | "example_pic" => "example_pic",
        "exampleDesc" | "example_desc" => "example_desc",
        "sortOrder" | "sort_order" => "sort_order",
        "isShow" | "is_show" => "is_show",
        "status" => "status",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 创建请求（Java `ExampleCreateDTO`）。
///
/// Java 约束（逐字符照抄）：
/// - `exampleName`：`@NotBlank(message = "示例名称不能为空")`
///   + `@Size(max = 50, message = "示例名称长度不能超过50")`
/// - 其余字段**无**约束。
///
/// 字段为 `Option` 是为了复刻 MyBatis-Plus `FieldStrategy.NOT_NULL`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExampleCreateDTO {
    /// 示例名称（`@NotBlank` + `@Size(max = 50)`）
    pub example_name: Option<String>,
    /// 示例图片
    pub example_pic: Option<String>,
    /// 示例排序
    pub sort_order: Option<i32>,
    /// 是否展示
    pub is_show: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    /// 示例描述
    pub example_desc: Option<String>,
}

/// 更新请求（Java `ExampleUpdateDTO`）。
///
/// ⚠️ 两个关键差异（与 `ExampleCreateDTO` 对比）：
/// 1. 主键字段是 `exampleId`（不是 `id`），带
///    `@NotNull(message = "示例id不能为空")`；
/// 2. **没有 `exampleDesc` 字段**，且 `exampleName` **没有**
///    `@NotBlank` / `@Size` 约束 —— 也就是说**更新接口无法改描述**，
///    且可以传空名称。
///
/// 这两点都是 Java 契约的真实形态（不是笔误），必须照抄，
/// 否则会出现「Rust 能改描述但 Java 不能」的行为漂移。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExampleUpdateDTO {
    /// 示例ID（Java `@NotNull`）
    pub example_id: Option<i32>,
    /// 示例名称（Java 侧**无**校验注解）
    pub example_name: Option<String>,
    /// 示例图片
    pub example_pic: Option<String>,
    /// 示例排序
    pub sort_order: Option<i32>,
    /// 是否展示
    pub is_show: Option<i32>,
    /// 状态
    pub status: Option<i32>,
    // ⚠️ 故意没有 example_desc：Java ExampleUpdateDTO 无此字段
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
#[must_use]
pub fn map_update_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// 校验创建时的 `exampleName`（对照 Java 的 `@NotBlank` + `@Size(max=50)`）。
///
/// `@NotBlank` 的语义是「非 null 且 trim 后长度 > 0」，
/// 因此 `"   "` **不合法**。
///
/// 返回**归一化后**的名称（已 trim）——这与 Java 不同：
/// Java 的 `@NotBlank` 只校验、**不修改**字段值，入库的仍是原始串
/// （含前后空格）。因此本函数只返回校验结果，
/// 入库值由调用方使用**原始串**，见 [`validate_create`]。
pub fn validate_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err(MSG_EXAMPLE_NAME_REQUIRED.to_string());
    }
    if name.chars().count() > NAME_MAX_LEN {
        return Err(MSG_EXAMPLE_NAME_OVER_LENGTH.to_string());
    }
    Ok(())
}

/// 执行 `create` 的完整校验（对照 Java `@Valid ExampleCreateDTO`）。
///
/// ⚠️ 与 [`validate_name`] 一样**不修改**名称（Java 不 trim 入库值），
/// 因此返回 `Ok(())` 而不是归一化后的串。
pub fn validate_create(dto: &ExampleCreateDTO) -> Result<(), String> {
    let name = dto
        .example_name
        .as_deref()
        .ok_or_else(|| MSG_EXAMPLE_NAME_REQUIRED.to_string())?;
    validate_name(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Java `IsShowType.fromTypeCode` 的语义：只有 0/1 命中，null 与其它值都 null。
    #[test]
    fn is_show_type_from_type_code_matches_java() {
        assert_eq!(
            IsShowType::from_type_code(Some(0)),
            Some(IsShowType::NotShow)
        );
        assert_eq!(IsShowType::from_type_code(Some(1)), Some(IsShowType::Show));
        // 未匹配 → None（Java 返回 null）
        assert_eq!(IsShowType::from_type_code(Some(2)), None);
        assert_eq!(IsShowType::from_type_code(Some(-1)), None);
        // null → None（Java 不会 NPE）
        assert_eq!(IsShowType::from_type_code(None), None);
    }

    /// 枚举的 code/name 必须与 Java 逐字符一致。
    #[test]
    fn is_show_type_codes_and_names() {
        assert_eq!(IsShowType::NotShow.code(), 0);
        assert_eq!(IsShowType::Show.code(), 1);
        assert_eq!(IsShowType::NotShow.name(), "不显示");
        assert_eq!(IsShowType::Show.name(), "显示");
    }

    /// ⚠️ 关键：只有 0/1 才产生过滤条件（Java `!= null` 判据）。
    #[test]
    fn only_zero_and_one_are_filterable() {
        assert!(is_show_filterable(Some(0)));
        assert!(is_show_filterable(Some(1)));
        assert!(!is_show_filterable(Some(2)));
        assert!(!is_show_filterable(Some(99)));
        assert!(!is_show_filterable(None));
    }

    /// `sortField` 为空 ⇒ 主键列 DESC（不是「无排序」）。
    #[test]
    fn empty_sort_field_falls_back_to_key_desc() {
        assert_eq!(
            ExampleListQuery::default().order_clause(),
            " ORDER BY example_id DESC"
        );
    }

    /// `sortOrder` 语义：asc 升序；desc / 空 降序；非法值不排序。
    #[test]
    fn order_direction_semantics() {
        let mut q = ExampleListQuery {
            sort_field: Some("sortOrder".into()),
            ..Default::default()
        };
        q.sort_order = Some("asc".into());
        assert_eq!(q.order_clause(), " ORDER BY sort_order ASC");
        q.sort_order = Some("DeSc".into());
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");
        q.sort_order = None;
        assert_eq!(q.order_clause(), " ORDER BY sort_order DESC");
        q.sort_order = Some("bogus".into());
        assert_eq!(q.order_clause(), "");
    }

    /// 属性名与列名都能映射；未识别回退主键列。
    #[test]
    fn order_column_accepts_property_and_column_names() {
        assert_eq!(map_order_column("exampleName"), "example_name");
        assert_eq!(map_order_column("example_name"), "example_name");
        assert_eq!(map_order_column("isShow"), "is_show");
        assert_eq!(map_order_column("1; DROP TABLE example"), KEY_COLUMN);
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    /// `keyword` 用 `isNotEmpty` 口径：纯空白**仍**算有效关键字。
    #[test]
    fn keyword_uses_is_not_empty() {
        assert_eq!(
            ExampleListQuery {
                keyword: Some("   ".into()),
                ..Default::default()
            }
            .effective_keyword(),
            Some("   ")
        );
        assert_eq!(
            ExampleListQuery {
                keyword: Some(String::new()),
                ..Default::default()
            }
            .effective_keyword(),
            None
        );
    }

    /// `@NotBlank` 语义：null 与纯空白都不合法；边界 50 含。
    #[test]
    fn name_validation_matches_java_annotations() {
        // null
        assert_eq!(
            validate_create(&ExampleCreateDTO::default()),
            Err("示例名称不能为空".to_string())
        );
        // 纯空白 → @NotBlank 不通过
        assert_eq!(validate_name("   "), Err("示例名称不能为空".to_string()));
        assert_eq!(validate_name(""), Err("示例名称不能为空".to_string()));
        // 边界：50 通过，51 不通过
        assert!(validate_name(&"a".repeat(NAME_MAX_LEN)).is_ok());
        assert_eq!(
            validate_name(&"a".repeat(NAME_MAX_LEN + 1)),
            Err("示例名称长度不能超过50".to_string())
        );
        // 按字符计数（中文 50 字通过）
        assert!(validate_name(&"示".repeat(NAME_MAX_LEN)).is_ok());
        assert!(validate_name(&"示".repeat(NAME_MAX_LEN + 1)).is_err());
    }

    /// `create` 的合法输入通过。
    #[test]
    fn validate_create_accepts_valid() {
        let dto = ExampleCreateDTO {
            example_name: Some("演示".into()),
            ..Default::default()
        };
        assert_eq!(validate_create(&dto), Ok(()));
    }

    /// ⚠️ `ExampleUpdateDTO` **没有** `exampleDesc` 字段
    /// （Java 契约如此，不是漏写）：传了也应被忽略。
    #[test]
    fn update_dto_has_no_example_desc_field() {
        let dto: ExampleUpdateDTO =
            serde_json::from_str(r#"{"exampleId":3,"exampleName":"n","exampleDesc":"IGNORED"}"#)
                .expect("应能解析（未知字段被忽略）");
        assert_eq!(dto.example_id, Some(3));
        assert_eq!(dto.example_name.as_deref(), Some("n"));
        // 结构体里根本没有该字段，因此无法表达 —— 这是有意的
    }

    /// `update` 的主键键名是 `exampleId`（不是 `id`）。
    #[test]
    fn update_dto_uses_example_id_key() {
        let dto: ExampleUpdateDTO = serde_json::from_str(r#"{"exampleId":8}"#).expect("应能解析");
        assert_eq!(dto.example_id, Some(8));
        // 传 `id` 不会被解析到 exampleId
        let dto2: ExampleUpdateDTO = serde_json::from_str(r#"{"id":8}"#).expect("应能解析");
        assert_eq!(dto2.example_id, None);
    }

    /// VO 同名映射，`status` 可空。
    #[test]
    fn vo_maps_entity_fields() {
        let e = Example {
            example_id: 1,
            example_name: "演示".into(),
            example_pic: "/a.png".into(),
            example_desc: "描述".into(),
            sort_order: 3,
            is_show: IS_SHOW_SHOW,
            status: None,
        };
        let vo = ExampleVO::from(&e);
        assert_eq!(vo.example_id, 1);
        assert_eq!(vo.example_name, "演示");
        assert_eq!(vo.example_pic, "/a.png");
        assert_eq!(vo.example_desc, "描述");
        assert_eq!(vo.sort_order, 3);
        assert_eq!(vo.is_show, 1);
        assert_eq!(vo.status, None);
    }

    /// VO 序列化键名为 camelCase。
    #[test]
    fn vo_serializes_camel_case() {
        let e = Example {
            example_id: 2,
            example_name: "n".into(),
            example_pic: "p".into(),
            example_desc: "d".into(),
            sort_order: 1,
            is_show: 1,
            status: Some(1),
        };
        let json = serde_json::to_string(&ExampleVO::from(&e)).unwrap();
        assert!(json.contains("\"exampleId\":2"), "json={json}");
        assert!(json.contains("\"exampleName\":\"n\""), "json={json}");
        assert!(json.contains("\"isShow\":1"), "json={json}");
        assert!(json.contains("\"exampleDesc\":\"d\""), "json={json}");
    }

    /// `BatchDTO` 的解析与判据。
    #[test]
    fn batch_dto_semantics() {
        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).expect("应能解析");
        assert!(dto.is_delete());
        assert_eq!(dto.value, 0, "Java 原始 int 缺省为 0");
        assert_eq!(dto.validated_ids(), Ok(vec![1, 2]));

        assert_eq!(
            BatchDTO {
                ids: Some(vec![]),
                r#type: Some("del".into()),
                ..Default::default()
            }
            .validated_ids(),
            Err("未选择项目".to_string())
        );
    }

    /// 列常量、白名单与 schema 一致；`EXAMPLE_FIELDS` 必须全是真实列。
    #[test]
    fn constants_match_schema() {
        assert_eq!(
            EXAMPLE_COLUMNS,
            [
                "example_id",
                "example_name",
                "example_pic",
                "example_desc",
                "sort_order",
                "is_show",
                "status",
            ]
        );
        assert_eq!(KEY_COLUMN, "example_id");
        assert_eq!(KEY_PROPERTY, "exampleId");
        // 与 logistics::shipping_type 的缺陷白名单不同：这里三项全是真实列
        for f in EXAMPLE_FIELDS {
            assert!(
                EXAMPLE_COLUMNS.contains(&f),
                "EXAMPLE_FIELDS 含不存在的列: {f}"
            );
        }
    }

    /// `MSG_INVALID_FIELD_VALUE` 必须保留 Java 里的那个空格。
    #[test]
    fn invalid_field_message_keeps_java_space() {
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
    }

    /// 分页默认值与夹取。
    #[test]
    fn page_query_defaults_and_clamp() {
        let p = ExampleListQuery::default().page_query();
        assert_eq!((p.page, p.page_size), (1, 15));
        let p = ExampleListQuery {
            page: Some(0),
            size: Some(10_000),
            ..Default::default()
        }
        .page_query();
        assert_eq!((p.page, p.page_size), (1, 100));
    }

    /// 注解长度 50 必须**不大于**库列宽度 60（否则注解形同虚设）。
    #[test]
    fn annotation_limit_fits_column() {
        const _: () = assert!(NAME_MAX_LEN <= NAME_COLUMN_MAX_LEN);
    }
}
