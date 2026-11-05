//! 电子卡券组域 DTO / VO / 查询参数 / 纯函数。
//!
//! 对应 Java：
//! - `com.tigshop.bean.dto.product.ECardGroupListDTO`（extends `BasePage`）
//! - `com.tigshop.bean.dto.product.ECardGroupCreateDTO`
//! - `com.tigshop.bean.dto.product.ECardGroupUpdateDTO`
//! - `com.tigshop.bean.vo.product.ECardGroupVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! - `com.tigshop.common.constant.product.ECardGroupConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.E_CARD_GROUP_FIELDS`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#buildSortOrder`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! # 与 Java 的对照要点
//!
//! - `ECardGroupListDTO` 有 `groupId` / `groupName` / `isDownload` / `file`
//!   四个业务字段，但 `ECardGroupServiceImpl#list` **只读 `keyword`** 做
//!   `group_name LIKE`；`groupId` / `groupName` 未被读取。本实现保留字段
//!   以兼容请求，过滤仍只认 `keyword`（Java 原样）。
//! - `isDownload > 0` 时 Java 会先向 `HttpServletResponse` 写 xlsx 模板流，
//!   再继续查库返回 `Page`（响应已提交）。Rust 侧未迁移 Excel 能力，
//!   服务层对该分支返回明确业务错误（不伪造二进制响应），见
//!   [`EXCEL_TEMPLATE_UNMIGRATED_MSG`]。
//! - `import` 端点已支持真实 xlsx（`calamine` 解析后批量插 `e_card`）。
//! - `updateField` 的允许字段是 `CheckFieldConstants.E_CARD_GROUP_FIELDS`
//!   = `{"is_use"}`；`e_card_group` 表**有** `is_use` 列，所以该接口可用
//!   （与 product_group 的恒失败不同）。
//! - `@Size(max = 255)` 的 message 写的是「不能超过50」（原文如此），
//!   本实现按真实上限 255 字符执行、message 逐字符照抄。

use serde::{Deserialize, Serialize};

use crate::entities::ECardGroup;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 主键列（Java `BaseServiceImpl#getKeyColumn` → `group_id`）。
pub const KEY_COLUMN: &str = "group_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `groupId`）。
pub const KEY_PROPERTY: &str = "groupId";

/// `e_card_group` 的真实列清单（`python tools/schema_parser.py --table e_card_group`）。
///
/// 顺序与实体 [`crate::entities::ECardGroup`] 的字段顺序一致。
pub const GROUP_COLUMNS: [&str; 7] = [
    "group_id",
    "group_name",
    "shop_id",
    "remark",
    "is_use",
    "add_time",
    "up_time",
];

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.E_CARD_GROUP_FIELDS = {"is_use"}`）。
pub const E_CARD_GROUP_FIELDS: [&str; 1] = ["is_use"];

/// Java `@Size(max = 255)` 的真实上限（message 写的是 50，见模块注释）。
pub const FIELD_MAX_CHARS: usize = 255;

/// 分组名称必填（Java `@NotNull(message = "电子卡券组名称不能为空")`）。
pub const GROUP_NAME_REQUIRED: &str = "电子卡券组名称不能为空";

/// 分组名称超长
/// （Java `@Size(max = 255, message = "电子卡券组名称长度不能超过50")`）。
pub const GROUP_NAME_OVER_LENGTH: &str = "电子卡券组名称长度不能超过50";

/// 分组 ID 必填（Java `@NotNull(message = "电子卡券组id不能为空")`）。
pub const GROUP_ID_REQUIRED: &str = "电子卡券组id不能为空";

/// 导入文件必填（Java `ECardGroupConstants.E_CARD_GROUP_FILE_NOT_NULL`）。
pub const FILE_REQUIRED: &str = "文件不能为空";

/// 分组名称已存在（Java `ECardGroupConstants.GROUP_NAME_EXISTS`）。
pub const GROUP_NAME_EXISTS: &str = "电子卡券组名称已存在";

/// 分组不存在（Java `ECardGroupConstants.E_CARD_GROUP_NOT_EXISTS`）。
pub const GROUP_NOT_EXISTS: &str = "电子卡券组不存在";

/// 分组被上架商品占用（Java `ECardGroupConstants.GROUP_ID_BY_PRODUCT_EXISTS`）。
pub const GROUP_BOUND_PRODUCT_EXISTS: &str =
    "商品表中有关联该分组的上架商品，请先操作下架商品后再删除";

/// 字段值有误（Java `ResultTextConstants.INVALID_FIELD_VALUE`）。
pub const INVALID_FIELD_VALUE: &str = "field 的值有误";

/// 主键为空（Java `OperateDTO` / `UpdateFieldDTO` 的 `@NotNull` 文案）。
pub const ID_REQUIRED: &str = "id不能为空";

/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// 未选择项目（Java `BatchDTO.ids` 的 `@NotEmpty` 文案）。
pub const UNSELECTED_ITEM: &str = "未选择项目";

/// 操作类型为空（Java `BatchDTO.type` 的 `@NotNull` 文案）。
pub const OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

/// `list?isDownload>0` 的模板导出未迁移提示（Java 向响应写 xlsx 流）。
pub const EXCEL_TEMPLATE_UNMIGRATED_MSG: &str =
    "Excel 电子卡券导入模板导出功能尚未迁移到 Rust 侧，请使用 list 分页接口";

/// `import` 端点的批量导入未迁移提示（Java 解析 xlsx 后批量插入 `e_card`）。
pub const EXCEL_IMPORT_UNMIGRATED_MSG: &str =
    "Excel 批量导入功能尚未迁移到 Rust 侧，请使用电子卡券创建接口逐条添加";

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 电子卡券组列表查询（对应 Java `ECardGroupListDTO extends BasePage`）。
///
/// `groupId` / `groupName` / `file` 在 Java 服务层**未被使用**，这里保留
/// `groupId` / `groupName` 以兼容请求；`file`（`MultipartFile`）不在查询
/// 结构体中（`list` 端点不消费文件）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardGroupListQuery {
    /// 卡券分组 ID（Java DTO 有该字段，但 list 未使用）
    pub group_id: Option<i32>,
    /// 分组名称（Java DTO 有该字段，但 list 未使用；`clientList` 不存在于本域）
    pub group_name: Option<String>,
    /// 是否下载导入模板：`> 0` 时 Java 写 xlsx 流（Rust 未迁移，返回业务错误）
    pub is_download: Option<i32>,
    /// 搜索关键字（`BasePage.keyword`，对 `group_name` 做 `LIKE`）
    pub keyword: Option<String>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 页码，从 1 开始（Java `BasePage.page`，null ⇒ 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，null ⇒ 15，上限 100）
    pub size: Option<u64>,
}

impl ECardGroupListQuery {
    /// 转成内部 [`PageQuery`]（Java `BasePage.getPage()` / `getSize()` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).min(100),
        }
    }

    /// 有效关键字（Java `StrUtil.isNotEmpty(keyword)`：只判 null/空串，
    /// 不 trim；`LIKE` 绑定原始值）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// 是否请求下载导入模板（Java `isDownload != null && isDownload > 0`）。
    #[must_use]
    pub fn wants_download_template(&self) -> bool {
        self.is_download.is_some_and(|v| v > 0)
    }

    /// 解析 ORDER BY 子句（列名来自白名单，无注入面）。
    ///
    /// Java `list` 调三参重载 `buildSortOrder(page, sortField, sortOrder)`：
    /// 未识别字段回退主键列；`asc` 升序；`desc`/空降序；其它值不追加排序。
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
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中，未命中回退主键列。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "groupId" | "group_id" => "group_id",
        "groupName" | "group_name" => "group_name",
        "shopId" | "shop_id" => "shop_id",
        "remark" => "remark",
        "isUse" | "is_use" => "is_use",
        "addTime" | "add_time" => "add_time",
        "upTime" | "up_time" => "up_time",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（Java `getColumnByPropertyName`）。
#[must_use]
pub fn map_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// `updateField` 白名单校验（Java `Arrays.asList(E_CARD_GROUP_FIELDS)
/// .contains(getColumnByPropertyName(field))`）。
#[must_use]
pub fn is_allowed_update_field(field: &str) -> bool {
    E_CARD_GROUP_FIELDS.contains(&map_field_column(field))
}

/// 电子卡券组创建入参（对应 Java `ECardGroupCreateDTO`）。
///
/// Java 校验注解：
/// - `groupName`：`@NotNull(message = "电子卡券组名称不能为空")`
///   + `@Size(max = 255, message = "电子卡券组名称长度不能超过50")`
/// - `remark`：可空
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardGroupCreateDTO {
    /// 分组名称
    pub group_name: Option<String>,
    /// 备注
    pub remark: Option<String>,
}

/// 电子卡券组更新入参（对应 Java `ECardGroupUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ECardGroupUpdateDTO {
    /// 分组 ID（`@NotNull(message = "电子卡券组id不能为空")`）
    pub group_id: Option<i32>,
    /// 分组名称（`@NotNull`，同创建）
    pub group_name: Option<String>,
    /// 备注（`None` ⇒ 不更新该列，Java NOT_NULL 策略）
    pub remark: Option<String>,
}

/// 单 ID 操作请求（对应 Java `bean.dto.common.OperateDTO`，只用到 `id`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作请求（对应 Java `bean.dto.common.BatchDTO`）。
///
/// `ECardGroupController` 带 `@Valid`，`ids @NotEmpty` / `type @NotNull` 生效。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合
    pub ids: Option<Vec<i32>>,
    /// 操作类型，本域仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（本域未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求（对应 Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 电子卡券组 VO（对应 Java `ECardGroupVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ECardGroupVO {
    /// 分组 ID
    pub group_id: i32,
    /// 分组名称
    pub group_name: String,
    /// 店铺 ID
    pub shop_id: i32,
    /// 备注
    pub remark: Option<String>,
    /// 0:不使用 1:使用
    pub is_use: i32,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，0/空 ⇒ `""`）
    pub add_time: String,
    /// 更新时间（`yyyy-MM-dd HH:mm:ss`，0/空 ⇒ `""`）
    pub up_time: String,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8）。
///
/// 对应 Java `ECardGroupServiceImpl#convert` 的
/// `DateUtil.format(date, "yyyy-MM-dd HH:mm:ss")`。
#[must_use]
pub fn format_unix_time(secs: Option<i32>) -> String {
    let Some(secs) = secs.filter(|s| *s != 0) else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 实体 → VO（对应 Java `ECardGroupServiceImpl#convert`）。
#[must_use]
pub fn group_to_vo(entity: &ECardGroup) -> ECardGroupVO {
    ECardGroupVO {
        group_id: entity.group_id,
        group_name: entity.group_name.clone(),
        shop_id: entity.shop_id,
        remark: entity.remark.clone(),
        is_use: entity.is_use,
        add_time: format_unix_time(entity.add_time),
        up_time: format_unix_time(entity.up_time),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 查询参数 ————————————————

    #[test]
    fn list_query_accepts_java_param_names() {
        let q: ECardGroupListQuery = serde_json::from_str(
            r#"{"groupId":2,"groupName":"默认","isDownload":1,"keyword":"卡",
                "page":2,"size":30,"sortField":"upTime","sortOrder":"asc"}"#,
        )
        .expect("ECardGroupListQuery 应接受 camelCase Java 参数名");
        assert_eq!(q.group_id, Some(2));
        assert_eq!(q.group_name.as_deref(), Some("默认"));
        assert!(q.wants_download_template());
        assert_eq!(q.effective_keyword(), Some("卡"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY up_time ASC");
    }

    #[test]
    fn list_query_defaults_match_base_page() {
        let q: ECardGroupListQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert!(!q.wants_download_template());
        assert_eq!(q.effective_keyword(), None);
        assert_eq!(q.order_clause(), " ORDER BY group_id DESC");
    }

    #[test]
    fn download_flag_only_true_when_positive() {
        for (raw, want) in [
            (None, false),
            (Some(0), false),
            (Some(-1), false),
            (Some(1), true),
        ] {
            let q = ECardGroupListQuery {
                is_download: raw,
                ..Default::default()
            };
            assert_eq!(q.wants_download_template(), want, "isDownload={raw:?}");
        }
    }

    #[test]
    fn order_clause_follows_java_three_branches() {
        for (field, column) in [
            ("groupName", "group_name"),
            ("group_name", "group_name"),
            ("shopId", "shop_id"),
            ("isUse", "is_use"),
            ("add_time", "add_time"),
        ] {
            let q = ECardGroupListQuery {
                sort_field: Some(field.into()),
                sort_order: Some("DESC".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), format!(" ORDER BY {column} DESC"));
        }
        // 未识别字段回退主键（防注入）
        let q = ECardGroupListQuery {
            sort_field: Some("1; DROP TABLE e_card_group".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY group_id ASC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY
        let q = ECardGroupListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    // ———————————————— updateField 白名单 ————————————————

    #[test]
    fn update_field_whitelist_only_is_use() {
        assert_eq!(E_CARD_GROUP_FIELDS, ["is_use"]);
        // e_card_group 表有 is_use 列 ⇒ 该接口可用
        assert!(is_allowed_update_field("isUse"));
        assert!(is_allowed_update_field("is_use"));
        for input in ["groupName", "group_name", "shopId", "remark", "nope"] {
            assert!(!is_allowed_update_field(input), "{input} 不应在白名单内");
        }
        assert_eq!(map_field_column("groupName"), "group_name");
    }

    // ———————————————— VO ————————————————

    #[test]
    fn group_vo_maps_entity_and_formats_times() {
        let e = ECardGroup {
            group_id: 5,
            group_name: "默认分组".into(),
            shop_id: 0,
            remark: Some("备注".into()),
            is_use: 1,
            add_time: Some(1_700_000_000),
            up_time: Some(1_700_000_100),
        };
        let vo = group_to_vo(&e);
        assert_eq!(vo.group_id, 5);
        assert_eq!(vo.group_name, "默认分组");
        assert_eq!(vo.remark.as_deref(), Some("备注"));
        assert_eq!(vo.add_time, "2023-11-15 06:13:20");
        assert_eq!(vo.up_time, "2023-11-15 06:15:00");

        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["groupId"], 5);
        assert_eq!(json["groupName"], "默认分组");
        assert_eq!(json["upTime"], "2023-11-15 06:15:00");
    }

    #[test]
    fn null_times_serialize_empty() {
        let e = ECardGroup {
            group_id: 1,
            group_name: "A".into(),
            add_time: None,
            up_time: Some(0),
            ..Default::default()
        };
        let vo = group_to_vo(&e);
        assert_eq!(vo.add_time, "");
        assert_eq!(vo.up_time, "");
    }

    #[test]
    fn create_update_dto_parse() {
        let c: ECardGroupCreateDTO =
            serde_json::from_str(r#"{"groupName":"新组","remark":"r"}"#).unwrap();
        assert_eq!(c.group_name.as_deref(), Some("新组"));
        assert_eq!(c.remark.as_deref(), Some("r"));

        let u: ECardGroupUpdateDTO =
            serde_json::from_str(r#"{"groupId":3,"groupName":"改名"}"#).unwrap();
        assert_eq!(u.group_id, Some(3));
        assert_eq!(u.group_name.as_deref(), Some("改名"));
        assert_eq!(u.remark, None);
    }
}
