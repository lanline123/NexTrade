//! 友情链接（content::friend_links）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.FriendLinksController`
//!   （`@RequestMapping("/adminapi/setting/friendLinks")`，7 个端点）
//! - 服务 `FriendLinksServiceImpl`（继承 `BaseServiceImpl`）
//! - 入参 `FriendLinksListDTO` / `FriendLinksCreateDTO` / `FriendLinksUpdateDTO`
//!   + 公共 `OperateDTO` / `UpdateFieldDTO` / `BatchDTO`
//! - 出参 `FriendLinksVO`；表 `friend_links`（实体 [`crate::entities::FriendLinks`]）
//!
//! # 端点（7，全部 admin）
//! `GET /adminapi/setting/friendLinks/{list,detail}`、
//! `POST /adminapi/setting/friendLinks/{create,update,del,updateField,batch}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. `list` 的 `isShow` 字段 Java 声明但**未参与过滤**（服务只按 keyword 搜索），
//!    本实现同样忽略。
//! 2. `detail`：Java `getById` 缺行后 `BeanUtils.copyProperties(null, ..)` 抛
//!    `IllegalArgumentException`（500）；本实现返回 `Error::NotFound("友情链接不存在")`。
//! 3. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

/// Java `FriendLinksConstants._NOT_NULL`。
pub const MSG_LINK_TITLE_REQUIRED: &str = "友情链接名称不能为空";
/// Java `FriendLinksConstants._OVER_LENGTH`（DTO 未使用该注解，这里保留常量）。
pub const MSG_LINK_TITLE_OVER_LENGTH: &str = "友情链接名称长度不能超过50";
/// Java `FriendLinksConstants.FRIEND_LINKS_ID_NOT_NULL`。
pub const MSG_LINK_ID_REQUIRED: &str = "友情链接id不能为空";
/// Java `ResultTextConstants.INVALID_FIELD_VALUE`。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（OperateDTO / UpdateFieldDTO）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// `Error::NotFound` 文案（Java 无对应常量）。
pub const MSG_LINK_NOT_FOUND: &str = "友情链接不存在";

/// `updateField` 白名单（Java `CheckFieldConstants.FRIEND_LINKS_FIELDS`）。
pub const FRIEND_LINKS_FIELDS: [&str; 2] = ["link_title", "sort_order"];

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `friend_links` 表可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 5] = [
    "link_id",
    "link_title",
    "link_logo",
    "link_url",
    "sort_order",
];

/// 属性名 → 列名（Java `getColumnByPropertyName`；未知回退主键）。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "linkId" | "link_id" => "link_id",
        "linkTitle" | "link_title" => "link_title",
        "linkLogo" | "link_logo" => "link_logo",
        "linkUrl" | "link_url" => "link_url",
        "sortOrder" | "sort_order" => "sort_order",
        _ => "link_id",
    }
}

/// 列表排序（Java `buildSortOrder`；缺省主键降序）。
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let column = match sort_field.map(str::trim).filter(|s| !s.is_empty()) {
        None => "link_id",
        Some(f) => normalize_column(f),
    };
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("link_id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    (column, desc)
}

/// `updateField` 字段白名单归一（Java `getColumnByPropertyName` + 白名单）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    let column = normalize_column(field);
    FRIEND_LINKS_FIELDS.iter().copied().find(|f| *f == column)
}

/// 列表查询参数（Java `FriendLinksListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FriendLinksListQuery {
    /// 页码。
    pub page: Option<u64>,
    /// 页大小。
    pub size: Option<u64>,
    /// 排序字段。
    pub sort_field: Option<String>,
    /// 排序方向。
    pub sort_order: Option<String>,
    /// 标题关键字（Java `BasePage.keyword`，作用于 `link_title LIKE`）。
    pub keyword: Option<String>,
    /// 是否展示（Java `FriendLinksListDTO.isShow`；服务未使用）。
    pub is_show: Option<i32>,
}

impl FriendLinksListQuery {
    /// 归一化分页。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// 通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        let (page, size) = self.page_params();
        crate::types::PageQuery {
            page,
            page_size: size,
        }
    }
}

/// 创建入参（Java `FriendLinksCreateDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FriendLinksCreateDTO {
    /// 标题（Java `@NotBlank(message = 友情链接名称不能为空)`）。
    pub link_title: Option<String>,
    /// LOGO。
    pub link_logo: Option<String>,
    /// 排序。
    pub sort_order: Option<i32>,
    /// 链接地址。
    pub link_url: Option<String>,
}

/// 更新入参（Java `FriendLinksUpdateDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FriendLinksUpdateDTO {
    /// 主键（Java 声明但 `updateById` 用 `linkId`）。
    pub id: Option<i32>,
    /// 友情链接 ID（Java `linkId`）。
    pub link_id: Option<i32>,
    /// 标题。
    pub link_title: Option<String>,
    /// LOGO。
    pub link_logo: Option<String>,
    /// 排序。
    pub sort_order: Option<i32>,
    /// 链接地址。
    pub link_url: Option<String>,
}

/// 删除入参（Java 公共 `OperateDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FriendLinksIdDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 备注（未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（未使用）。
    pub page_type: Option<i32>,
}

/// 字段更新入参（Java 公共 `UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 字段名。
    pub field: Option<String>,
    /// 字段值。
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作入参（Java 公共 `BatchDTO`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型（仅 `"del"` 生效）。
    pub r#type: Option<String>,
    /// 操作值（未使用）。
    pub value: i32,
}

/// 友情链接 VO（Java `FriendLinksVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendLinksVO {
    /// 友情链接 ID。
    pub link_id: i32,
    /// LOGO。
    pub link_logo: String,
    /// 标题。
    pub link_title: String,
    /// 链接地址。
    pub link_url: String,
    /// 排序。
    pub sort_order: i32,
}

/// 校验创建入参（Java `@NotBlank linkTitle`）。
///
/// # Errors
/// 标题为空 → [`MSG_LINK_TITLE_REQUIRED`]。
pub fn validate_create(dto: &FriendLinksCreateDTO) -> Result<String, String> {
    let title = dto
        .link_title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_LINK_TITLE_REQUIRED.to_string())?;
    Ok(title.to_string())
}

/// 批量删除判定（Java `BaseServiceImpl#batch`，仅 `type == "del"`）。
#[must_use]
pub fn is_delete_batch(dto: &BatchDTO) -> bool {
    dto.r#type.as_deref() == Some("del") && !dto.ids.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sort_resolution_matches_base_service_impl() {
        assert_eq!(resolve_sort(None, None), ("link_id", Some(true)));
        assert_eq!(
            resolve_sort(Some("sortOrder"), Some("asc")),
            ("sort_order", Some(false))
        );
        assert_eq!(
            resolve_sort(Some("linkTitle"), None),
            ("link_title", Some(true))
        );
        assert_eq!(
            resolve_sort(Some("sort_order"), Some("x")),
            ("sort_order", None)
        );
        assert_eq!(
            resolve_sort(Some("1=1 --"), Some("asc")),
            ("link_id", Some(false))
        );
    }

    #[test]
    fn create_validation_message_is_verbatim() {
        assert_eq!(
            validate_create(&FriendLinksCreateDTO::default()).unwrap_err(),
            MSG_LINK_TITLE_REQUIRED
        );
        assert_eq!(
            validate_create(&FriendLinksCreateDTO {
                link_title: Some("   ".into()),
                ..Default::default()
            })
            .unwrap_err(),
            MSG_LINK_TITLE_REQUIRED
        );
        assert_eq!(
            validate_create(&FriendLinksCreateDTO {
                link_title: Some(" TigShop ".into()),
                ..Default::default()
            })
            .unwrap(),
            "TigShop"
        );
    }

    #[test]
    fn page_defaults_and_dto_binding() {
        let q: FriendLinksListQuery =
            serde_json::from_value(serde_json::json!({"page": 2, "size": 1000, "keyword": "友链"}))
                .unwrap();
        assert_eq!(q.page_params(), (2, 100));
        assert_eq!(q.keyword.as_deref(), Some("友链"));
        let dto: FriendLinksCreateDTO = serde_json::from_value(serde_json::json!({
            "linkTitle": "官网", "linkLogo": "a.png", "sortOrder": 1,
            "linkUrl": "https://tigshop.com"
        }))
        .unwrap();
        assert_eq!(dto.link_title.as_deref(), Some("官网"));
        assert_eq!(dto.sort_order, Some(1));
    }

    #[test]
    fn update_field_whitelist_and_batch_rule() {
        assert_eq!(normalize_field("linkTitle"), Some("link_title"));
        assert_eq!(normalize_field("sort_order"), Some("sort_order"));
        assert_eq!(normalize_field("linkUrl"), None);
        assert_eq!(normalize_field("unknown"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");

        assert!(is_delete_batch(&BatchDTO {
            ids: vec![1],
            r#type: Some("del".into()),
            value: 0
        }));
        assert!(!is_delete_batch(&BatchDTO::default()));
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = FriendLinksVO {
            link_id: 1,
            link_logo: "a.png".into(),
            link_title: "官网".into(),
            link_url: "https://tigshop.com".into(),
            sort_order: 2,
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["linkId"], 1);
        assert_eq!(json["linkLogo"], "a.png");
        assert_eq!(json["linkTitle"], "官网");
        assert_eq!(json["linkUrl"], "https://tigshop.com");
        assert_eq!(json["sortOrder"], 2);
    }
}
