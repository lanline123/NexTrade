//! PC 导航栏（`/adminapi/decorate/pcNavigation`）域模型（content::pc_navigation）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.decorate.PcNavigationListDTO`（继承 `BasePage`）
//! - `com.tigshop.bean.dto.decorate.PcNavigationCreateDTO`
//! - `com.tigshop.bean.dto.decorate.PcNavigationUpdateDTO`
//! - `com.tigshop.bean.vo.decorate.PcNavigationVO`
//! - `com.tigshop.bean.enums.decorate.PcNavigationType`
//! - `cn.hutool.core.lang.tree.Tree`（`getParentNav` 的树节点）
//!
//! 字段名与原 Java 的 JSON 输出保持一致（camelCase），见 `#[serde(rename_all)]`。
//! 本域**不涉及金额**（`pc_navigation` 无 `decimal` 列），故不引入 `rust_decimal`。

use serde::{Deserialize, Serialize};

use crate::entities::PcNavigation;
use crate::types::PageQuery;

/// 主导航（Java `PcNavigationType.TYPE_MAIN`）。
pub const TYPE_MAIN: i32 = 1;
/// 顶部小导航 / 站点地图（Java `PcNavigationType.TYPE_TOP_BAR`）。
pub const TYPE_TOP_BAR: i32 = 2;
/// 底部导航（Java `PcNavigationType.TYPE_BOTTOM`）。
pub const TYPE_BOTTOM: i32 = 3;
/// 侧边导航（Java `PcNavigationType.TYPE_SIDEBAR`）。
pub const TYPE_SIDEBAR: i32 = 4;

/// 列表默认每页条数（Java `BasePage#getSize`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// 列表每页条数上限（Java `BasePage#getSize`：`size > 100` 归一到 100）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 对应 Java `PcNavigationType#isValidCode`：仅 1/2/3/4 为合法类型。
#[must_use]
pub fn is_valid_type(code: i32) -> bool {
    (TYPE_MAIN..=TYPE_SIDEBAR).contains(&code)
}

/// 导航类型文案，对应 Java `PcNavigationType#getName`（未知类型返回空串）。
#[must_use]
pub fn pc_navigation_type_name(code: Option<i32>) -> String {
    match code {
        Some(TYPE_MAIN) => "主导航",
        Some(TYPE_TOP_BAR) => "顶部小导航",
        Some(TYPE_BOTTOM) => "底部导航",
        Some(TYPE_SIDEBAR) => "侧边导航",
        _ => "",
    }
    .to_string()
}

/// 解析 `link` 列为「JSON 对象」形态（列表 / 详情用）。
///
/// 对应 Java `PcNavigationServiceImpl#list` / `#detail` 的处理：
/// 空白或字面量 `[]` → `{}`；其余按 Jackson 反序列化为 `JSONObject`
/// （失败，例如存的是 JSON 数组 → 返回 `null`）。
#[must_use]
pub fn parse_link_object(raw: &str) -> serde_json::Value {
    if raw.trim().is_empty() || raw == "[]" {
        return serde_json::json!({});
    }
    match serde_json::from_str::<serde_json::Value>(raw.trim()) {
        Ok(v) if v.is_object() => v,
        _ => serde_json::Value::Null,
    }
}

/// 解析 `link` 列为任意 JSON（`getParentNav` 树节点用）。
///
/// 对应 Java `JsonUtil.fromJson(object.getLink(), Object.class)`：
/// 空白或非法 JSON → `null`（Jackson 失败时返回 `null`）。
#[must_use]
pub fn parse_link_any(raw: &str) -> serde_json::Value {
    if raw.trim().is_empty() {
        return serde_json::Value::Null;
    }
    serde_json::from_str(raw.trim()).unwrap_or(serde_json::Value::Null)
}

/// 列表查询参数，对应 Java `PcNavigationListDTO`（继承 `BasePage`）。
///
/// 注意 Java 用 `size` 而非项目内其它域的 `pageSize`；
/// `sortItems` 在原实现中被 3 参 `buildSortOrder` 忽略，故此处不建模。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationListDTO {
    /// 1导航条 2顶部站点地图导航 3底部快捷导航 4侧边导航
    pub r#type: Option<i32>,
    /// 父导航 ID（仅 `type == 2` 且 `>= 0` 时生效）
    pub parent_id: Option<i32>,
    /// 当前页码（Java `BasePage#getPage` 默认 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage#getSize` 默认 15、上限 100）
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage#sortField`）
    pub sort_field: Option<String>,
    /// `asc` / 其它（缺省按 Java 语义为降序）
    pub sort_order: Option<String>,
    /// 标题模糊关键字
    pub keyword: Option<String>,
}

impl PcNavigationListDTO {
    /// 组装分页参数（对应 Java `BasePage#getPage` / `#getSize`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// Java `PcNavigationType.isValidCode(type)` 过滤后的类型。
    #[must_use]
    pub fn valid_type(&self) -> Option<i32> {
        self.r#type.filter(|t| is_valid_type(*t))
    }

    /// `type == 2 && parentId != null && parentId >= 0` 时的父级过滤。
    #[must_use]
    pub fn parent_filter(&self) -> Option<i32> {
        if self.valid_type() == Some(TYPE_TOP_BAR) {
            self.parent_id.filter(|p| *p >= 0)
        } else {
            None
        }
    }
}

/// 创建参数，对应 Java `PcNavigationCreateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationCreateDTO {
    /// 导航显示标题（Java `@NotBlank` + `@Size(max = 50)`）
    pub title: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub is_blank: Option<i32>,
    /// 链接数据（Java 声明为 `Object`，落库为 JSON 文本）
    pub link: Option<serde_json::Value>,
    pub r#type: Option<i32>,
    pub parent_id: Option<i32>,
    pub icon: Option<String>,
}

/// 更新参数，对应 Java `PcNavigationUpdateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationUpdateDTO {
    /// 导航 ID（Java `@NotNull`）
    pub id: Option<i32>,
    pub title: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub is_blank: Option<i32>,
    pub link: Option<serde_json::Value>,
    pub r#type: Option<i32>,
    pub parent_id: Option<i32>,
    pub icon: Option<String>,
}

/// 导航列表 / 详情 VO，对应 Java `PcNavigationVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcNavigationVO {
    pub id: i32,
    pub title: String,
    pub is_show: i32,
    pub sort_order: i32,
    pub is_blank: i32,
    /// 链接数据（JSON 对象；Java 侧为 `JSONObject`，解析失败时为 `null`）
    pub link: serde_json::Value,
    pub r#type: i32,
    pub type_name: String,
    pub parent_id: i32,
    pub icon: String,
    /// 是否有子导航。
    ///
    /// Java：`list` 恒显式置 0（仅 `type == 2` 时回填真实计数）；
    /// `detail` **不设置**该字段 → JSON `null`。故此处为 `Option`。
    pub has_children: Option<i64>,
}

impl From<&PcNavigation> for PcNavigationVO {
    fn from(n: &PcNavigation) -> Self {
        Self {
            id: n.id,
            title: n.title.clone(),
            is_show: n.is_show,
            sort_order: n.sort_order,
            is_blank: n.is_blank,
            link: parse_link_object(&n.link),
            r#type: n.r#type,
            type_name: pc_navigation_type_name(Some(n.r#type)),
            parent_id: n.parent_id,
            icon: n.icon.clone(),
            has_children: None,
        }
    }
}

/// 上级导航树节点（`getParentNav` 返回 `List<Tree<Integer>>` 的元素）。
///
/// 字段与 hutool `Tree` 的序列化结果对齐：`id` / `parentId` / `title` /
/// `sortOrder` / `type` / `isShow` / `isBlank` / `link` / `icon` / `children`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcNavigationTreeVO {
    pub id: i32,
    pub parent_id: i32,
    pub title: String,
    pub sort_order: i32,
    pub r#type: i32,
    pub is_show: i32,
    pub is_blank: i32,
    /// 原始链接 JSON（对象 / 数组 / `null`）
    pub link: serde_json::Value,
    pub icon: String,
    pub children: Vec<PcNavigationTreeVO>,
}

/// `selectLink` 的单项，对应 Java `List<Map<String, String>>` 中的
/// `{"name":…, "app_link":…, "link":…}`。
///
/// 注意 HashMap 的键**不是** camelCase，序列化必须保持 `app_link` 原样。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct NavSelectLinkVO {
    pub name: String,
    pub app_link: String,
    pub link: String,
}

/// `update` 的写入集合（对应 Java `BeanUtils.copyProperties` +
/// MyBatis-Plus NOT_NULL 策略：`null` 字段不进入 `SET`）。
///
/// `link` 为**恒写入**字段：Java `getLink` 在请求未传 `link` 时写入 `"[]"`。
#[derive(Debug, Clone, Default)]
pub struct PcNavigationPatch {
    pub id: i32,
    pub title: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub is_blank: Option<i32>,
    /// 已完成 `getLink` 处理的 JSON 文本（恒非空）
    pub link: String,
    pub r#type: Option<i32>,
    pub parent_id: Option<i32>,
    pub icon: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn type_validity_matches_java_is_valid_code() {
        assert!(is_valid_type(1));
        assert!(is_valid_type(4));
        assert!(!is_valid_type(0));
        assert!(!is_valid_type(5));
        assert!(!is_valid_type(-1));
    }

    #[test]
    fn type_names_match_java_enum() {
        assert_eq!(pc_navigation_type_name(Some(1)), "主导航");
        assert_eq!(pc_navigation_type_name(Some(2)), "顶部小导航");
        assert_eq!(pc_navigation_type_name(Some(3)), "底部导航");
        assert_eq!(pc_navigation_type_name(Some(4)), "侧边导航");
        // 未知 / 缺省 → 空串（Java `getTypeCode` 返回 null → ""）
        assert_eq!(pc_navigation_type_name(Some(9)), "");
        assert_eq!(pc_navigation_type_name(None), "");
    }

    #[test]
    fn page_query_follows_java_base_page() {
        let q = PcNavigationListDTO::default();
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 15);

        let q = PcNavigationListDTO {
            page: Some(0),
            size: Some(500),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 1, "Java getPage 缺省 1，0 也不是合法页");
        assert_eq!(p.page_size, 100, "Java getSize：>100 归一到 100");
    }

    #[test]
    fn parent_filter_only_applies_to_top_bar() {
        let q = PcNavigationListDTO {
            r#type: Some(TYPE_TOP_BAR),
            parent_id: Some(39),
            ..Default::default()
        };
        assert_eq!(q.parent_filter(), Some(39));

        // type != 2 → 父级过滤不生效
        let q = PcNavigationListDTO {
            r#type: Some(TYPE_MAIN),
            parent_id: Some(39),
            ..Default::default()
        };
        assert_eq!(q.parent_filter(), None);

        // parentId < 0 → 不生效
        let q = PcNavigationListDTO {
            r#type: Some(TYPE_TOP_BAR),
            parent_id: Some(-1),
            ..Default::default()
        };
        assert_eq!(q.parent_filter(), None);

        // 非法 type → 整体不生效（Java isValidCode 前置判断）
        let q = PcNavigationListDTO {
            r#type: Some(9),
            parent_id: Some(39),
            ..Default::default()
        };
        assert_eq!(q.valid_type(), None);
        assert_eq!(q.parent_filter(), None);
    }

    #[test]
    fn link_object_parsing_matches_java_vo() {
        assert_eq!(parse_link_object("[]"), serde_json::json!({}));
        assert_eq!(parse_link_object(""), serde_json::json!({}));
        assert_eq!(parse_link_object("   "), serde_json::json!({}));
        assert_eq!(
            parse_link_object(r#"{"path":"article","id":5}"#),
            serde_json::json!({"path": "article", "id": 5})
        );
        // 非对象（数组）→ Jackson 反序列化 JSONObject 失败 → null
        assert_eq!(
            parse_link_object(r#"[{"path":"a"}]"#),
            serde_json::Value::Null
        );
    }

    #[test]
    fn link_any_parsing_matches_java_tree_node() {
        assert_eq!(parse_link_any("[]"), serde_json::json!([]));
        assert_eq!(parse_link_any(""), serde_json::Value::Null);
        assert_eq!(
            parse_link_any(r#"{"path":"base"}"#),
            serde_json::json!({"path": "base"})
        );
        assert_eq!(parse_link_any("not-json"), serde_json::Value::Null);
    }

    #[test]
    fn select_link_serializes_snake_case_keys() {
        let vo = NavSelectLinkVO {
            name: "商城首页".into(),
            app_link: String::new(),
            link: "/".into(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["name"], "商城首页");
        assert_eq!(json["app_link"], "");
        assert_eq!(json["link"], "/");
    }
}
