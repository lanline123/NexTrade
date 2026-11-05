//! 区号管理域（system::area_code）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.setting.AreaCode`（表 `area_code`）
//! - `com.tigshop.bean.dto.setting.AreaCodeListDTO extends BasePage`
//! - `com.tigshop.bean.param.settings.areacode.AreaCodeSaveParam`
//! - `com.tigshop.bean.param.settings.areacode.AreaCodeEditParam extends AreaCodeSaveParam`
//! - `com.tigshop.bean.vo.setting.AreaCodeVO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.setting.AreaCodeConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.AREA_CODE_FIELDS`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（区号字典维护）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。

use serde::{Deserialize, Serialize};

use crate::entities::AreaCode;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `AreaCodeConstants` / `CheckFieldConstants` / `Constants`）
// ——————————————————————————————————————————————

/// `area_code` 真实存在的 5 个列（`python tools/schema_parser.py --table area_code`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const AREA_CODE_COLUMNS: [&str; 5] = ["id", "code", "name", "is_available", "is_default"];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.AREA_CODE_FIELDS = {"code", "name", "is_available", "is_default"}`）。
///
/// ⚠️ 与 `GENERAL_FIELDS` 不同，这里**没有** `status`，四个字段都是
/// `area_code` 的真实列，因此白名单命中即可安全执行（见 `AREA_CODE_COLUMNS`）。
pub const AREA_CODE_FIELDS: [&str; 4] = ["code", "name", "is_available", "is_default"];

/// 「是」的取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// `code` / `name` 的最大长度（Java `AreaCodeSaveParam` 上的
/// `@Size(max = 64)`；库列也是 `varchar(64)`）。
///
/// ⚠️ Java 常量文案写的是「不能超过10个字符」，但注解写的是 `max = 64`，
/// **文案与实现不一致**。本实现按注解 `64` 执行，文案保持 Java 原样
/// （见 `uncertain_points`）。
pub const AREA_CODE_MAX_LEN: usize = 64;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `AreaCodeConstants.AREA_CODE_NOT_BLANK`。
pub const MSG_AREA_CODE_NOT_BLANK: &str = "区号不能为空";

/// Java `AreaCodeConstants.AREA_CODE_MAX_SIZE`。
pub const MSG_AREA_CODE_MAX_SIZE: &str = "区号不能超过10个字符";

/// Java `AreaCodeConstants.AREA_CODE_IS_EXISTS`。
pub const MSG_AREA_CODE_IS_EXISTS: &str = "区号已存在";

/// Java `AreaCodeConstants.AREA_CODE_NAME_IS_EXISTS`。
pub const MSG_AREA_CODE_NAME_IS_EXISTS: &str = "区号名称已存在";

/// Java `AreaCodeConstants.AREA_CODE_NAME_NOT_BLANK`。
pub const MSG_AREA_CODE_NAME_NOT_BLANK: &str = "区号名称不能为空";

/// Java `AreaCodeConstants.AREA_CODE_NAME_MAX_SIZE`。
pub const MSG_AREA_CODE_NAME_MAX_SIZE: &str = "区号名称不能超过10个字符";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `AreaCodeEditParam` 上 `@NotNull(message = "区号主键不能为空")`。
pub const MSG_AREA_CODE_ID_REQUIRED: &str = "区号主键不能为空";

/// Rust 侧补的通用提示（Java 没有对应文案，见 `uncertain_points`）。
pub const MSG_AREA_CODE_NOT_FOUND: &str = "区号不存在";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 区号 VO（对应 Java `com.tigshop.bean.vo.setting.AreaCodeVO`）。
///
/// Java `list` / `detail` / `mobileAreaCode` 三处都是
/// `BeanUtils.copyProperties(areaCode, vo)` 后再手工
/// `vo.setLabel(StrUtil.format("+{}", code))`，因此 `label` **总是**由
/// `code` 派生的 `+{code}`（`code` 为 null 时是字面量 `"+null"`，
/// 但 `code` 列 NOT NULL，实际不会出现）。
///
/// 其余 5 个字段与实体同名，用 `From<&AreaCode>` 直接映射。
///
/// ⚠️ Java `AreaCodeVO.name` 带 `@JsonTranslate`（跨境翻译注解）。
/// 管理端 `list` / `detail` 在 Java 侧同样带该注解，会经翻译切面处理；
/// Rust 侧尚未实现翻译切面，本实现原样返回库中值（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AreaCodeVO {
    /// 主键
    pub id: i32,
    /// 区号
    pub code: String,
    /// 名称
    pub name: String,
    /// 是否开启：1 是 0 否
    pub is_available: i32,
    /// 是否默认：1 是 0 否
    pub is_default: i32,
    /// 展示用标签 `+{code}`（Java `vo.setLabel(StrUtil.format("+{}", code))`）
    pub label: String,
}

impl From<&AreaCode> for AreaCodeVO {
    fn from(a: &AreaCode) -> Self {
        Self {
            id: a.id,
            code: a.code.clone(),
            name: a.name.clone(),
            is_available: a.is_available,
            is_default: a.is_default,
            // Java `StrUtil.format("+{}", code)`：code 为 null 时 Hutool 输出 "+null"
            label: format!("+{}", a.code),
        }
    }
}

impl From<AreaCode> for AreaCodeVO {
    fn from(a: AreaCode) -> Self {
        Self::from(&a)
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `AreaCodeListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `sortOrder`。
/// （`BasePage` 还有 `sortItems`，`buildSortOrder(page, pageQuery)` 的重载会优先用它，
/// 但本域 Java 调的是三参数重载 `buildSortOrder(page, dto.getSortField(),
/// dto.getSortOrder())`，**不使用** `sortItems`。）
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`AreaCodeListQuery::page_query`] 完成桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AreaCodeListQuery {
    /// 地区名称（Java `name`，`LIKE %name%`）
    pub name: Option<String>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值或空 ⇒ 降序，Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl AreaCodeListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_name(&self) -> Option<&str> {
        self.name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
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
    /// - `asc`（忽略大小写）升序；`desc`、空、或**任何其它值**都不设置排序
    ///   —— 注意 Java 在这里是 `else if`，非 asc 且非 desc 且非空时
    ///   **完全不追加 ORDER BY**（与 `sortOrder` 为空时的降序不同！）
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
/// 只允许 `area_code` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "code" => "code",
        "name" => "name",
        "isAvailable" | "is_available" => "is_available",
        "isDefault" | "is_default" => "is_default",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 创建请求（Java `AreaCodeSaveParam`）。
///
/// Java 侧 `@NotBlank` / `@Size(max = 64)`，且控制器类上有类级 `@Validated`，
/// 因此这些注解**确实生效**（`create` / `update` 的方法参数上还有 `@Valid`）。
/// 本实现把这些校验放在服务层，文案逐字符照抄 Java 常量。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AreaCodeSaveDTO {
    /// 区号（必填，最长 64）
    pub code: Option<String>,
    /// 名称（必填，最长 64）
    pub name: Option<String>,
    /// 是否开启：1 是 0 否
    pub is_available: Option<i32>,
    /// 是否默认：1 是 0 否
    pub is_default: Option<i32>,
}

/// 更新请求（Java `AreaCodeEditParam extends AreaCodeSaveParam`）。
///
/// `#[serde(flatten)]` 对齐 Java 的继承展开：JSON 层面就是
/// `{ "id": 1, "code": "...", "name": "...", ... }` 的扁平结构。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AreaCodeEditDTO {
    /// 主键（Java `@NotNull(message = "区号主键不能为空")`）
    pub id: Option<i32>,
    /// 父类字段（Java `AreaCodeSaveParam`）
    #[serde(flatten)]
    pub base: AreaCodeSaveDTO,
}

impl AreaCodeEditDTO {
    /// 供校验复用的父类型视图（命名对应 Java `super.createAreaCode()` 的取用点）。
    #[must_use]
    pub fn as_save(&self) -> &AreaCodeSaveDTO {
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
/// 方法参数 `@Validated`，因此 `id` / `field` / `val` 缺一即 400。
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
/// ⚠️ 与 Java 的一处**有意偏离**：Java 找不到时返回**主键列** `id`，
/// 再拿它去比对 `AREA_CODE_FIELDS`（`id` 不在其中，于是同样报「字段值不合法」）。
/// 两者对白名单的判定结果**完全一致**，差别只在错误分支的形状。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "id" => Some("id"),
        "code" => Some("code"),
        "name" => Some("name"),
        "isAvailable" | "is_available" => Some("is_available"),
        "isDefault" | "is_default" => Some("is_default"),
        _ => None,
    }
}

/// 校验区号 / 名称的必填与长度（对应 Java `@NotBlank` + `@Size(max = 64)`）。
///
/// 返回 `Ok((code, name))`（已 trim），否则返回带 Java 原文案的错误。
///
/// # Errors
/// - `code` 为空 ⇒ `区号不能为空`
/// - `code` 超过 64 字符 ⇒ `区号不能超过10个字符`（Java 文案与 `max=64` 不一致，
///   文案照抄、阈值按注解，见 `uncertain_points`）
/// - `name` 为空 ⇒ `区号名称不能为空`
/// - `name` 超过 64 字符 ⇒ `区号名称不能超过10个字符`
pub fn validate_save(base: &AreaCodeSaveDTO) -> Result<(String, String), String> {
    let code = base
        .code
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_AREA_CODE_NOT_BLANK.to_string())?
        .to_string();
    if code.chars().count() > AREA_CODE_MAX_LEN {
        return Err(MSG_AREA_CODE_MAX_SIZE.to_string());
    }

    let name = base
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_AREA_CODE_NAME_NOT_BLANK.to_string())?
        .to_string();
    if name.chars().count() > AREA_CODE_MAX_LEN {
        return Err(MSG_AREA_CODE_NAME_MAX_SIZE.to_string());
    }

    Ok((code, name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vo_label_prefixed_with_plus() {
        let a = AreaCode {
            id: 3,
            code: "86".into(),
            name: "中国".into(),
            is_available: 1,
            is_default: 1,
        };
        let vo = AreaCodeVO::from(&a);
        assert_eq!(vo.label, "+86");
        assert_eq!(vo.id, 3);
        assert_eq!(vo.name, "中国");
        assert_eq!(vo.is_available, 1);
        assert_eq!(vo.is_default, 1);
    }

    #[test]
    fn whitelist_matches_java_constant() {
        assert_eq!(
            AREA_CODE_FIELDS,
            ["code", "name", "is_available", "is_default"]
        );
        // 白名单四项全部是真实列（本域不存在 pc_cat_floor 那种 status 幻觉列）
        for f in AREA_CODE_FIELDS {
            assert!(AREA_CODE_COLUMNS.contains(&f), "{f} 不是真实列");
        }
        assert!(!AREA_CODE_FIELDS.contains(&"id"));
    }

    #[test]
    fn update_field_column_normalization() {
        assert_eq!(map_update_field_column("code"), Some("code"));
        assert_eq!(map_update_field_column("name"), Some("name"));
        assert_eq!(map_update_field_column("isAvailable"), Some("is_available"));
        assert_eq!(
            map_update_field_column("is_available"),
            Some("is_available")
        );
        assert_eq!(map_update_field_column("isDefault"), Some("is_default"));
        assert_eq!(map_update_field_column("is_default"), Some("is_default"));
        // 主键能归一但是白名单外
        assert_eq!(map_update_field_column("id"), Some("id"));
        assert_eq!(map_update_field_column("nope"), None);
    }

    #[test]
    fn order_clause_semantics() {
        // 空 sortField / sortOrder ⇒ 主键降序
        assert_eq!(
            AreaCodeListQuery::default().order_clause(),
            " ORDER BY id DESC"
        );
        // 主键属性名 ⇒ 主键列
        let q = AreaCodeListQuery {
            sort_field: Some("id".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
        // 属性名 → 列名
        let q = AreaCodeListQuery {
            sort_field: Some("isDefault".into()),
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY is_default DESC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY（Java else-if 缺口）
        let q = AreaCodeListQuery {
            sort_field: Some("code".into()),
            sort_order: Some("weird".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
        // 未识别 sortField ⇒ 回退主键（防注入）
        let q = AreaCodeListQuery {
            sort_field: Some("1; DROP TABLE area_code".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    #[test]
    fn page_query_defaults_match_base_page() {
        let q = AreaCodeListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        let q = AreaCodeListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        let q = AreaCodeListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);
    }

    #[test]
    fn effective_name_trims_and_ignores_blank() {
        let q = AreaCodeListQuery {
            name: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_name(), None);
        let q = AreaCodeListQuery {
            name: Some(" 中国 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_name(), Some("中国"));
    }

    #[test]
    fn validate_save_rules() {
        let ok = AreaCodeSaveDTO {
            code: Some(" 86 ".into()),
            name: Some("中国".into()),
            is_available: Some(1),
            is_default: Some(0),
        };
        assert_eq!(validate_save(&ok).unwrap(), ("86".into(), "中国".into()));

        let blank_code = AreaCodeSaveDTO {
            code: Some("  ".into()),
            name: Some("中国".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&blank_code).unwrap_err(),
            MSG_AREA_CODE_NOT_BLANK
        );

        let blank_name = AreaCodeSaveDTO {
            code: Some("86".into()),
            name: None,
            ..Default::default()
        };
        assert_eq!(
            validate_save(&blank_name).unwrap_err(),
            MSG_AREA_CODE_NAME_NOT_BLANK
        );

        let long_code = AreaCodeSaveDTO {
            code: Some("1".repeat(65)),
            name: Some("中国".into()),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&long_code).unwrap_err(),
            MSG_AREA_CODE_MAX_SIZE
        );

        // 恰好 64 字符是合法的（注解 max = 64）
        let edge = AreaCodeSaveDTO {
            code: Some("1".repeat(64)),
            name: Some("中国".into()),
            ..Default::default()
        };
        assert!(validate_save(&edge).is_ok());

        let long_name = AreaCodeSaveDTO {
            code: Some("86".into()),
            name: Some("名".repeat(65)),
            ..Default::default()
        };
        assert_eq!(
            validate_save(&long_name).unwrap_err(),
            MSG_AREA_CODE_NAME_MAX_SIZE
        );
    }

    #[test]
    fn edit_dto_flattens_base_fields() {
        let dto: AreaCodeEditDTO = serde_json::from_str(
            r#"{"id":9,"code":"86","name":"中国","isAvailable":1,"isDefault":0}"#,
        )
        .unwrap();
        assert_eq!(dto.id, Some(9));
        assert_eq!(dto.as_save().code.as_deref(), Some("86"));
        assert_eq!(dto.as_save().is_available, Some(1));
        assert_eq!(dto.base.is_default, Some(0));
    }

    #[test]
    fn batch_dto_deserializes_type_and_ids() {
        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":0}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);

        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[],"type":"show"}"#).unwrap();
        assert_eq!(dto.r#type, "show");
        assert!(dto.ids.is_empty());
    }

    #[test]
    fn list_query_deserializes_java_param_names() {
        // Java 侧查询参数名是 `size`（BasePage），不是项目通用 `pageSize`
        let q: AreaCodeListQuery = serde_json::from_str(
            r#"{"name":"中","page":2,"size":30,"sortField":"code","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.name.as_deref(), Some("中"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY code ASC");
    }
}
