//! 素材分类域 DTO / VO（marketing::salesman_material_category）。
//!
//! 对应 Java：
//! - 控制器 `com.tigshop.adminapi.controller.salesman.SalesmanMaterialCategoryController`
//!   （`java/tigshop-adminapi/src/main/java/com/tigshop/adminapi/controller/salesman/SalesmanMaterialCategoryController.java`）
//! - 服务 `SalesmanMaterialCategoryServiceImpl`
//! - 入参 `SalesmanMaterialCategoryPageQuery` / `SalesmanMaterialCategorySaveParam`
//!   / `SalesmanMaterialCategoryEditParam`
//! - 出参 `SalesmanMaterialCategoryVO`
//! - 公共 DTO `com.tigshop.bean.dto.common.UpdateFieldDTO` / `BatchDTO` / `OperateDTO`
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；时间字段在 VO 中是
//! **已格式化的字符串**（与 Java 一致，见 [`format_add_time`]）。

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// Java `SalesmanMaterialCategoryConstants.SALESMAN_MATERIAL_CATEGORY_NOT_NULL`。
pub const ERR_CATEGORY_NAME_REQUIRED: &str = "素材分类名称不能为空";
/// Java `SalesmanMaterialCategoryConstants.SALESMAN_MATERIAL_CATEGORY_OVER_LENGTH`。
pub const ERR_CATEGORY_NAME_TOO_LONG: &str = "素材分类名称长度不能超过50";
/// Java `SalesmanMaterialCategoryServiceImpl` 中 `create` / `update` 的重名校验文案。
pub const ERR_CATEGORY_NAME_EXISTS: &str = "分类名称已存在";
/// Java `SalesmanMaterialCategoryServiceImpl#delete` 的关联素材校验文案。
pub const ERR_CATEGORY_HAS_MATERIAL: &str = "请先删除该分类下的素材";
/// Java `ResultTextConstants.INVALID_FIELD_VALUE`。
pub const ERR_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`。
pub const ERR_ID_REQUIRED: &str = "id不能为空";
/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const ERR_UNSELECTED_ITEM: &str = "未选择项目";
/// Java 分类名长度上限（`@Size(max = 50)`）。
pub const CATEGORY_NAME_MAX_LEN: usize = 50;

/// Java `CheckFieldConstants.GENERAL_FIELDS`：
/// `{"is_show", "sort_order", "status"}`，`updateField` 的字段白名单。
///
/// ⚠️ 注意：`salesman_material_category` 表只有 `sort_order` 命中该白名单，
/// `is_show` / `status` 在本表**不存在**（见 `pure.sql`）。Java 侧若传这两个
/// 字段会走到 `UpdateWrapper.set("is_show", ...)` 并在数据库层报未知列。
/// 这里保持白名单逐字一致，仍由仓储层实际列校验兜住。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// `GET /adminapi/salesman/category/list` 查询参数。
///
/// 对应 Java `SalesmanMaterialCategoryPageQuery`（继承 `BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategoryPageQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）。
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）。
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`）。
    pub sort_field: Option<String>,
    /// 排序方向：`asc` / `desc`。
    pub sort_order: Option<String>,
    /// 分类名称模糊搜索（Java `SalesmanMaterialCategoryPageQuery.categoryName`）。
    pub category_name: Option<String>,
}

impl SalesmanMaterialCategoryPageQuery {
    /// 归一化分页（Java `BasePage#getPage` / `#getSize`）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// SQL `LIMIT` / `OFFSET`。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let (page, size) = self.page_params();
        (size, (page - 1) * size)
    }

    /// 通用分页参数（供 [`crate::types::PageResult`] 口径使用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }
}

/// `POST /adminapi/salesman/category/create` 入参。
///
/// 对应 Java `SalesmanMaterialCategorySaveParam`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategorySaveParam {
    /// 素材分类名称（Java `@NotNull` + `@Size(max = 50)`）。
    pub category_name: Option<String>,
    /// 素材分类排序。
    pub sort_order: Option<i32>,
}

/// `POST /adminapi/salesman/category/update` 入参。
///
/// 对应 Java `SalesmanMaterialCategoryEditParam`。注意 Java 侧
/// `categoryId` **没有** `@NotNull`，为 `None` 时 `updateById` 主键为空，
/// 更新影响 0 行（本实现按 `NotFound` 处理，见服务层注释）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialCategoryEditParam {
    /// 素材分类 ID。
    pub category_id: Option<i32>,
    /// 素材分类名称（Java `@NotNull` + `@Size(max = 50)`）。
    pub category_name: Option<String>,
    /// 素材分类排序。
    pub sort_order: Option<i32>,
}

/// `POST /adminapi/salesman/category/del` 入参。
///
/// 对应 Java `com.tigshop.bean.dto.common.OperateDTO`（只用得到 `id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键 ID。
    pub id: Option<i32>,
    /// 备注（本域未使用，保留以兼容前端字段）。
    pub admin_note: Option<String>,
    /// 页面类型（本域未使用）。
    pub page_type: Option<i32>,
}

/// `POST /adminapi/salesman/category/updateField` 入参。
///
/// 对应 Java `com.tigshop.bean.dto.common.UpdateFieldDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键 ID。
    pub id: Option<i32>,
    /// 字段名（属性名或数据库列名皆可，Java 侧两者都兼容）。
    pub field: Option<String>,
    /// 字段值（Java 侧是 `String`，由 DB 隐式转换）。
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// `POST /adminapi/salesman/category/batch` 入参。
///
/// 对应 Java `com.tigshop.bean.dto.common.BatchDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型；Java `BaseServiceImpl#batch` 只认 `"del"`。
    pub r#type: Option<String>,
    /// 操作值（Java 声明为原始类型 `int value`，缺省 0；本域未使用）。
    pub value: i32,
}

/// 素材分类 VO。
///
/// 对应 Java `SalesmanMaterialCategoryVO`，字段名逐字对齐：
/// `categoryId` / `categoryName` / `addTime` / `shopId` / `sortOrder`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanMaterialCategoryVO {
    /// 素材分类 ID。
    pub category_id: i32,
    /// 素材分类名称。
    pub category_name: Option<String>,
    /// 添加时间，**已格式化为 `yyyy-MM-dd HH:mm:ss` 字符串**。
    ///
    /// Java `list` 会格式化，但 `detail` 直接 `BeanUtils.copyProperties`
    /// 实体（`addTime` 是 `Integer`）—— 类型不匹配时 Spring 的
    /// `BeanUtils` 会静默跳过该属性，所以 `detail` 返回的 `addTime` 为 `null`。
    /// 本实现用 `None` 复刻该行为，见服务层 `detail`。
    pub add_time: Option<String>,
    /// 所属店铺 ID。
    pub shop_id: Option<i32>,
    /// 排序。
    pub sort_order: Option<i32>,
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`
/// （Java `DateUtil.date(addTime * 1000)` + `DateUtil.format(.., DATE_FORMAT)`）。
///
/// 与 Java 一致：只在 `addTime != null && addTime > 0` 时格式化，
/// 其余情况返回 `None`（对应 Java VO 里的 `null`）。
#[must_use]
pub fn format_add_time(secs: Option<i32>) -> Option<String> {
    use chrono::TimeZone;
    let secs = secs.filter(|s| *s > 0)?;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => Some(dt.format("%Y-%m-%d %H:%M:%S").to_string()),
        _ => Some(String::new()),
    }
}

/// Java `BaseServiceImpl#getColumnByPropertyName` 的等价映射：
/// 把前端传来的属性名（或列名）归一成数据库列名。
///
/// Java 的关键行为：**找不到的属性名返回主键列**（防 SQL 注入），
/// 随后该值会在白名单校验中失败并抛 `field 的值有误`。
/// 因此 `sortOrder` 与 `sort_order` 都能通过，而 `categoryName` 会被归一成
/// `category_id`（不在白名单）→ 报错。
#[must_use]
pub fn normalize_field(property: &str) -> &'static str {
    match property {
        "sortOrder" | "sort_order" => "sort_order",
        // 白名单里另两个字段：本表并不存在，但属性名映射仍如实保留，
        // 以便白名单校验产生与 Java 相同的「通过校验后被 DB 拒绝」路径。
        "isShow" | "is_show" => "is_show",
        "status" => "status",
        // 主键（Java `getKeyColumn()`）
        "categoryId" | "category_id" => "category_id",
        // 其它一律回退主键，复刻 Java 的防注入行为
        _ => "category_id",
    }
}

/// 字段是否在 `GENERAL_FIELDS` 白名单内（Java `Arrays.asList(allowFields).contains(field)`）。
#[must_use]
pub fn is_allowed_field(column: &str) -> bool {
    GENERAL_FIELDS.contains(&column)
}

/// 校验分类名（Java `@NotNull` + `@Size(max = 50)`）。
///
/// 返回 `Ok(trim 后的名称)`。Java 侧 `@Size` 按 UTF-16 计长，这里按
/// `char` 计数（对 BMP 内中文字符等价）。
pub fn validate_category_name(name: Option<&str>) -> Result<String, String> {
    let name = name.map(str::trim).filter(|s| !s.is_empty());
    let name = match name {
        Some(n) => n,
        None => return Err(ERR_CATEGORY_NAME_REQUIRED.to_string()),
    };
    if name.chars().count() > CATEGORY_NAME_MAX_LEN {
        return Err(ERR_CATEGORY_NAME_TOO_LONG.to_string());
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(json: serde_json::Value) -> SalesmanMaterialCategoryPageQuery {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn page_defaults_match_java_base_page() {
        assert_eq!(q(serde_json::json!({})).page_params(), (1, 15));
        // Java BasePage#getSize：>100 截断为 100
        assert_eq!(q(serde_json::json!({"size": 101})).page_params(), (1, 100));
        // Java BasePage 构造器默认 page=1
        assert_eq!(q(serde_json::json!({"page": 0})).page_params(), (1, 15));
    }

    #[test]
    fn page_limit_offset() {
        let got = q(serde_json::json!({"page": 3, "size": 10}));
        assert_eq!(got.limit_offset(), (10, 20));
    }

    #[test]
    fn query_accepts_camel_case_category_name() {
        let got = q(serde_json::json!({"categoryName": "海报"}));
        assert_eq!(got.category_name.as_deref(), Some("海报"));
        assert_eq!(got.page_query().page_size, 15);
    }

    #[test]
    fn save_param_camel_case_binding() {
        let p: SalesmanMaterialCategorySaveParam =
            serde_json::from_value(serde_json::json!({"categoryName":"A","sortOrder":3})).unwrap();
        assert_eq!(p.category_name.as_deref(), Some("A"));
        assert_eq!(p.sort_order, Some(3));
    }

    #[test]
    fn edit_param_camel_case_binding() {
        let p: SalesmanMaterialCategoryEditParam =
            serde_json::from_value(serde_json::json!({"categoryId":7,"categoryName":"B"})).unwrap();
        assert_eq!(p.category_id, Some(7));
        assert_eq!(p.category_name.as_deref(), Some("B"));
    }

    #[test]
    fn batch_dto_accepts_reserved_type_key() {
        let b: BatchDTO =
            serde_json::from_value(serde_json::json!({"ids":[1,2],"type":"del"})).unwrap();
        assert_eq!(b.r#type.as_deref(), Some("del"));
        assert_eq!(b.ids, vec![1, 2]);
    }

    #[test]
    fn update_field_normalizes_property_and_column() {
        // 属性名与列名都能通过
        assert_eq!(normalize_field("sortOrder"), "sort_order");
        assert_eq!(normalize_field("sort_order"), "sort_order");
        assert!(is_allowed_field(normalize_field("sortOrder")));
    }

    #[test]
    fn update_field_unknown_property_falls_back_to_primary_key() {
        // Java getColumnByPropertyName：找不到属性 → 返回主键列
        assert_eq!(normalize_field("categoryName"), "category_id");
        assert!(!is_allowed_field(normalize_field("categoryName")));
        // 完全随意的字段名同样回退主键，防注入
        assert_eq!(normalize_field("1=1 --"), "category_id");
        assert!(!is_allowed_field(normalize_field("1=1 --")));
    }

    #[test]
    fn general_fields_whitelist_matches_java() {
        assert_eq!(GENERAL_FIELDS, ["is_show", "sort_order", "status"]);
        // 本表只有 sort_order 命中
        assert!(is_allowed_field("sort_order"));
        assert!(is_allowed_field("is_show"));
        assert!(!is_allowed_field("category_name"));
    }

    #[test]
    fn validate_category_name_rules() {
        assert_eq!(validate_category_name(Some(" 海报 ")).unwrap(), "海报");
        assert_eq!(
            validate_category_name(None).unwrap_err(),
            ERR_CATEGORY_NAME_REQUIRED
        );
        assert_eq!(
            validate_category_name(Some("   ")).unwrap_err(),
            ERR_CATEGORY_NAME_REQUIRED
        );
        // 50 字通过，51 字拒绝
        let ok = "字".repeat(CATEGORY_NAME_MAX_LEN);
        assert!(validate_category_name(Some(&ok)).is_ok());
        let bad = "字".repeat(CATEGORY_NAME_MAX_LEN + 1);
        assert_eq!(
            validate_category_name(Some(&bad)).unwrap_err(),
            ERR_CATEGORY_NAME_TOO_LONG
        );
    }

    #[test]
    fn format_add_time_matches_java_guard() {
        // Java：addTime == null || addTime <= 0 时不格式化
        assert_eq!(format_add_time(None), None);
        assert_eq!(format_add_time(Some(0)), None);
        assert_eq!(format_add_time(Some(-1)), None);
        assert_eq!(
            format_add_time(Some(1_733_000_000)).map(|s| s.len()),
            Some(19)
        );
    }
}
