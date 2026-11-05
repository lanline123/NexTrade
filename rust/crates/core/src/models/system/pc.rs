//! PC 前台公共域（system::pc）DTO / VO。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.vo.common.NavVO`（→ [`NavVO`]）
//! - `cn.hutool.core.lang.tree.Tree<Integer>`（→ [`NavTreeNode`] /
//!   [`CatFloorCategoryTreeNodeVO`]，均由 hutool `TreeUtil.build` 生成）
//! - `com.tigshop.bean.vo.decorate.PcCatFloorListWrapperVO`（→ [`CatFloorWrapperVO`]）
//! - `com.tigshop.bean.vo.decorate.PcCatFloorListVO`（→ [`CatFloorListVO`]）
//! - `com.tigshop.bean.vo.decorate.PcCatFloorListCategoryListDTO`
//!   （→ [`CatFloorCategoryVO`]）
//!
//! JSON 字段名保持 camelCase，与原接口逐字符一致（`#[serde(rename_all = "camelCase")]`）。
//! 本域（PC 导航 / 分类抽屉）**完全不涉及金额字段**，故无 `rust_decimal::Decimal`。
//!
//! # 与 hutool `Tree` 的对应关系
//!
//! Java 侧 4 个树状字段（`NavVO.mainNav/...`、`PcCatFloorListCategoryListDTO.children`）
//! 都是 hutool `Tree<Integer>`（`LinkedHashMap<String, Object>`），序列化时
//! **只输出 map 条目**（Jackson 走 `MapSerializer`，不会输出 `getConfig()` 等
//! getter），因此节点 JSON 的键就是 `TreeNodeConfig` 的键 + `putExtra` 的键。
//!
//! - 导航节点（`PcNavigationServiceImpl.convertTreeList`）：
//!   `id` / `parentId` / `title` / `sortOrder` / `type` / `isShow` / `isBlank` /
//!   `link` / `icon`（+ `children`）→ [`NavTreeNode`]。
//! - 分类节点（`CategoryServiceImpl.convertTreeList`）：
//!   `categoryId` / `parentId` / `categoryName` / `sortOrder` / `isShow` /
//!   `categoryPic`（+ `children`）→ [`CatFloorCategoryTreeNodeVO`]。
//!
//! 叶子节点的 `children`：Java 侧「从未挂过子节点」时**没有该键**，
//! 「被 `cutTree` 剪枝」时是显式 `null`；两者在前端 JS 中同为 falsy，
//! 本实现统一**省略**该键（见服务层 `build_nav_forest`）。分类节点沿用
//! 仓库既有约定（`models::crate::models::catalog::category::CategoryTreeVO`）输出**空数组**。

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（对应 Java `PcNavigationType`）
// ——————————————————————————————————————————————

/// 导航类型（Java `PcNavigationType`：1 主导航 / 2 顶部小导航 /
/// 3 底部导航 / 4 侧边导航）。
pub mod pc_navigation_type {
    /// 主导航（`TYPE_MAIN`）→ `NavVO.mainNav`。
    pub const MAIN: i32 = 1;
    /// 顶部小导航（`TYPE_TOP_BAR`）→ `NavVO.topBarNav`。
    pub const TOP_BAR: i32 = 2;
    /// 底部导航（`TYPE_BOTTOM`）→ `NavVO.bottomNav`。
    pub const BOTTOM: i32 = 3;
    /// 侧边导航（`TYPE_SIDEBAR`）→ `NavVO.sidebarNav`。
    pub const SIDEBAR: i32 = 4;
}

// ——————————————————————————————————————————————
// 导航（NavVO）
// ——————————————————————————————————————————————

/// hutool `Tree<Integer>` 导航节点（`PcNavigationServiceImpl.convertTreeList`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavTreeNode {
    /// 导航 id（`putExtra("id", ...)`）
    pub id: i32,
    /// 父导航 id（0 为顶级）
    pub parent_id: i32,
    /// 标题（Java 侧经 `translatePackage.translate`，本实现为原文）
    pub title: String,
    /// 排序（`TreeNodeConfig.setWeightKey("sortOrder")`，hutool 依此升序）
    pub sort_order: i32,
    /// 导航类型（1~4，见 [`pc_navigation_type`]）
    pub r#type: i32,
    /// 是否显示
    pub is_show: i32,
    /// 是否新窗口打开
    pub is_blank: i32,
    /// 链接 JSON（Java `JsonUtil.fromJson(link, Object.class)`；非法/空 → `null`）
    pub link: serde_json::Value,
    /// 图标
    pub icon: String,
    /// 子节点；无子节点时省略该键（对应 hutool 未挂子节点）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<NavTreeNode>>,
}

/// 导航栏聚合，对应 Java `NavVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavVO {
    /// 主导航（`type = 1`）
    pub main_nav: Vec<NavTreeNode>,
    /// 顶部栏（`type = 2`）
    pub top_bar_nav: Vec<NavTreeNode>,
    /// 底部栏（`type = 3`）
    pub bottom_nav: Vec<NavTreeNode>,
    /// 边栏（`type = 4`）
    pub sidebar_nav: Vec<NavTreeNode>,
}

// ——————————————————————————————————————————————
// 分类抽屉（PcCatFloorListWrapperVO）
// ——————————————————————————————————————————————

/// 分类抽屉分类节点，对应 Java `CategoryServiceImpl.convertTreeList` 产出的
/// `Tree<Integer>`（`idKey = categoryId` / `parentIdKey = parentId` /
/// `nameKey = categoryName` / `weightKey = sortOrder` / `deep = 4`，
/// extras：`isShow` / `categoryPic`）。
///
/// 字段顺序与 `models::crate::models::catalog::category::CategoryTreeVO` 保持一致（同一 Java 类型的
/// 另一处实现），JSON 结构逐字符相同。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatFloorCategoryTreeNodeVO {
    /// 对应 `Tree.categoryId`
    pub category_id: i32,
    /// 对应 `Tree.parentId`
    pub parent_id: i32,
    /// 对应 `Tree.categoryName`（Java 走多语言翻译，本实现为原文）
    pub category_name: String,
    /// 对应 `Tree.sortOrder`（hutool 的 weight）
    pub sort_order: i32,
    /// 对应 `Tree.extra.isShow`
    pub is_show: i32,
    /// 对应 `Tree.extra.categoryPic`
    pub category_pic: String,
    /// 子节点（叶子节点为空数组）
    pub children: Vec<CatFloorCategoryTreeNodeVO>,
}

/// 分类抽屉内的一条分类，对应 Java `PcCatFloorListCategoryListDTO`。
///
/// ⚠️ Java 的 `getCategoryId()` / `getCategoryName()` 是**手写 getter**，
/// 分别返回 `id` / `name`，因此 Jackson 会**同时输出**
/// `id` 与 `categoryId`、`name` 与 `categoryName` 四组键。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatFloorCategoryVO {
    /// 分类 id（Java `id`）
    pub id: i32,
    /// 分类名（自定义名优先，否则取分类表名）
    pub name: String,
    /// 分类图片
    pub pic: String,
    /// 与 `id` 同值（Java `getCategoryId()`）
    pub category_id: i32,
    /// 与 `name` 同值（Java `getCategoryName()`）
    pub category_name: String,
    /// 子分类；Java 仅在「分类为顶级（`parent_id = 0`）且本次请求首次遇到」
    /// 时赋值，否则保持 `null`（**不是空数组**）
    pub children: Option<Vec<CatFloorCategoryTreeNodeVO>>,
}

/// 分类抽屉楼层，对应 Java `PcCatFloorListVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatFloorListVO {
    /// 分类抽屉 id
    pub cat_floor_id: i32,
    /// 最终显示的分类名（按分类名以「，」拼接）
    pub cat_floor_name: String,
    /// 分类 ICO 图标（iconfont class）
    pub floor_ico_font: String,
    /// 楼层内分类
    pub cat_list: Vec<CatFloorCategoryVO>,
}

/// 分类抽屉接口出参，对应 Java `PcCatFloorListWrapperVO`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatFloorWrapperVO {
    /// 楼层列表
    pub cat_floor: Vec<CatFloorListVO>,
    /// 自定义 ICO 图标库 CSS 地址（配置项 `icoDefinedCss`）
    pub ico_defined_css: String,
}

// ——————————————————————————————————————————————
// 纯函数（可单测）：JSON 文本列 / 链接解析
// ——————————————————————————————————————————————

/// JSON 值 → `i32`（对应 Jackson 对 `Integer[]` 的宽松转换）。
fn value_to_i32(v: &serde_json::Value) -> Option<i32> {
    match v {
        serde_json::Value::Number(n) => n
            .as_i64()
            .map(|i| i as i32)
            .or_else(|| n.as_f64().map(|f| f as i32)),
        // Jackson 默认 `ACCEPT_FLOAT_AS_INT` / 字符串转数字均生效
        serde_json::Value::String(s) => s.trim().parse::<i32>().ok(),
        _ => None,
    }
}

/// 解析 `pc_cat_floor.category_ids`，对应 Java
/// `JsonUtil.fromJson(pcCatFloor.getCategoryIds(), Integer[].class)`。
///
/// ⚠️ 与 Java 的差异：Java 对空串 / 非法 JSON 得到 `null`，随后
/// `List.of(null)` 抛 NPE（HTTP 500）；本实现对脏数据**宽松处理为空数组**
/// （不伪造业务规则，仅避免 500）。正常数据（`[1,2,3]`）行为完全一致。
#[must_use]
pub fn parse_i32_array(raw: &str) -> Vec<i32> {
    match serde_json::from_str::<serde_json::Value>(raw.trim()) {
        Ok(serde_json::Value::Array(items)) => items.iter().filter_map(value_to_i32).collect(),
        _ => Vec::new(),
    }
}

/// 解析 `pc_cat_floor.category_names`，对应 Java
/// `JsonUtil.fromJson(pcCatFloor.getCategoryNames(), String[].class)`。
///
/// 元素保留 `None`（JSON `null`）语义：Java 里 `categoryNames.get(i) == null`
/// 表示「该分类未自定义名称，取分类表里的名字」（见 [`build_cat_floor_name`]）。
#[must_use]
pub fn parse_opt_string_array(raw: &str) -> Vec<Option<String>> {
    match serde_json::from_str::<serde_json::Value>(raw.trim()) {
        Ok(serde_json::Value::Array(items)) => items
            .iter()
            .map(|v| match v {
                serde_json::Value::String(s) => Some(s.clone()),
                serde_json::Value::Null => None,
                serde_json::Value::Number(n) => Some(n.to_string()),
                serde_json::Value::Bool(b) => Some(b.to_string()),
                // 数组 / 对象无法映射为 String（Java 侧 Jackson 会直接抛错）
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

/// 解析 `pc_navigation.link`，对应 Java
/// `JsonUtil.fromJson(object.getLink(), Object.class)`。
///
/// Java 语义（`JsonUtil#fromJson`）：
/// 1. `null` / 空串 → `null`；
/// 2. 首字符不是 `{ [ " -` 或数字，且不是 `null` / `true` / `false`
///    → 记录 warn 并返回 `null`；
/// 3. 解析失败 → 返回 `null`。
///
/// 因此 `"[]"` → 空数组、`"{}"` → 空对象、`"abc"` → `null`。
#[must_use]
pub fn parse_nav_link(raw: &str) -> serde_json::Value {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return serde_json::Value::Null;
    }
    let looks_like_json = match trimmed.chars().next() {
        Some('{') | Some('[') | Some('"') | Some('-') => true,
        Some(c) => c.is_ascii_digit(),
        None => false,
    } || trimmed.eq_ignore_ascii_case("null")
        || trimmed.eq_ignore_ascii_case("true")
        || trimmed.eq_ignore_ascii_case("false");
    if !looks_like_json {
        return serde_json::Value::Null;
    }
    serde_json::from_str::<serde_json::Value>(trimmed).unwrap_or(serde_json::Value::Null)
}

/// 楼层标题拼接，对应 `PcCatFloorServiceImpl#buildTranslatedCatFloorName`。
///
/// 逐段规则（`translatePackage.translate` 未迁移 → 恒等返回原文）：
/// - 自定义名非空且为 `"-"` → `[分类表名]`；
/// - 自定义名非空且非 `"-"` → 自定义名；
/// - 自定义名缺失 / 空 → 分类表名（分类查不到时为 `""`）；
/// - 段间以「，」连接。
#[must_use]
pub fn build_cat_floor_name(
    category_ids: &[i32],
    category_names: &[Option<String>],
    real_name_by_id: &HashMap<i32, String>,
) -> String {
    let mut out = String::new();
    for (i, category_id) in category_ids.iter().enumerate() {
        let custom = category_names.get(i).and_then(|v| v.as_deref());
        let real = real_name_by_id
            .get(category_id)
            .map(String::as_str)
            .unwrap_or("");
        let segment = match custom {
            Some(name) if !name.is_empty() => {
                if name == "-" {
                    format!("[{real}]")
                } else {
                    name.to_string()
                }
            }
            _ => real.to_string(),
        };
        if i > 0 {
            out.push('，');
        }
        out.push_str(&segment);
    }
    out
}

/// 楼层内某一分类的显示名，对应 `getCatFloor` 里
/// `categoryNameMap` + `translatePackage.translate` 的两分支。
///
/// 自定义名非空 → 用自定义名；否则用分类表名。
#[must_use]
pub fn display_category_name(custom: Option<&str>, real_name: &str) -> String {
    match custom {
        Some(name) if !name.is_empty() => name.to_string(),
        _ => real_name.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parse_nav_link_matches_json_util() {
        // 空 / 非 JSON → null
        assert_eq!(parse_nav_link(""), serde_json::Value::Null);
        assert_eq!(parse_nav_link("   "), serde_json::Value::Null);
        assert_eq!(parse_nav_link("abc"), serde_json::Value::Null);
        assert_eq!(parse_nav_link("undefined"), serde_json::Value::Null);
        // 合法 JSON → 原样
        assert_eq!(parse_nav_link("[]"), json!([]));
        assert_eq!(parse_nav_link("{}"), json!({}));
        assert_eq!(
            parse_nav_link(r#"{"path":"article","id":3}"#),
            json!({"path": "article", "id": 3})
        );
        assert_eq!(parse_nav_link("null"), serde_json::Value::Null);
        assert_eq!(parse_nav_link("true"), json!(true));
        assert_eq!(parse_nav_link("12"), json!(12));
        assert_eq!(parse_nav_link("-3"), json!(-3));
        assert_eq!(parse_nav_link("\"goods\""), json!("goods"));
        // 破损 JSON（首字符像 JSON 但解析失败）→ null
        assert_eq!(parse_nav_link("{oops"), serde_json::Value::Null);
    }

    #[test]
    fn parse_i32_array_handles_lenient_input() {
        assert_eq!(parse_i32_array("[1,2,3]"), vec![1, 2, 3]);
        assert_eq!(parse_i32_array(" [] "), Vec::<i32>::new());
        // Jackson 的宽松数字转换（1.0 → 1，字符串 → 数字）
        assert_eq!(parse_i32_array(r#"[1.0,"2"]"#), vec![1, 2]);
        // 脏数据：不 panic，退化为空
        assert_eq!(parse_i32_array(""), Vec::<i32>::new());
        assert_eq!(parse_i32_array("null"), Vec::<i32>::new());
        assert_eq!(parse_i32_array("[a,b]"), Vec::<i32>::new());
    }

    #[test]
    fn parse_opt_string_array_keeps_nulls() {
        assert_eq!(
            parse_opt_string_array(r#"["自定义",null,"-"]"#),
            vec![Some("自定义".into()), None, Some("-".into())]
        );
        assert_eq!(
            parse_opt_string_array("[1,true]"),
            vec![Some("1".into()), Some("true".into())]
        );
        assert_eq!(parse_opt_string_array(""), Vec::<Option<String>>::new());
    }

    #[test]
    fn cat_floor_name_follows_java_branches() {
        let mut real = HashMap::new();
        real.insert(1, "手机".to_string());
        real.insert(2, "电脑".to_string());
        // 第 1 段：自定义名 → 用自定义名
        // 第 2 段："-" → [分类表名]
        let names = vec![Some("自定义名".to_string()), Some("-".to_string())];
        assert_eq!(
            build_cat_floor_name(&[1, 2], &names, &real),
            "自定义名，[电脑]"
        );

        // 第 1 段：null → 分类表名；第 2 段：空串 → 分类表名
        let names = vec![None, Some(String::new())];
        assert_eq!(build_cat_floor_name(&[1, 2], &names, &real), "手机，电脑");

        // names 比 ids 短 → 缺位按 null（Java 里 `i < size` 判断）
        let names = vec![Some("自定义名".to_string())];
        assert_eq!(
            build_cat_floor_name(&[1, 2], &names, &real),
            "自定义名，电脑"
        );

        // 分类不存在 → 用空串，不 panic
        let names = vec![Some("-".to_string())];
        assert_eq!(build_cat_floor_name(&[999], &names, &real), "[]");

        // 空入参 → 空串
        assert_eq!(build_cat_floor_name(&[], &[], &real), "");
    }

    #[test]
    fn display_category_name_prefers_custom() {
        assert_eq!(display_category_name(Some("别名"), "真名"), "别名");
        assert_eq!(display_category_name(Some(""), "真名"), "真名");
        assert_eq!(display_category_name(None, "真名"), "真名");
    }

    #[test]
    fn nav_vo_serializes_camel_case_and_omits_empty_children() {
        let node = NavTreeNode {
            id: 7,
            parent_id: 0,
            title: "首页".into(),
            sort_order: 1,
            r#type: pc_navigation_type::MAIN,
            is_show: 1,
            is_blank: 0,
            link: json!({"path": "index"}),
            icon: "icon-home".into(),
            children: None,
        };
        let value = serde_json::to_value(node.clone()).unwrap();
        assert_eq!(value["parentId"], json!(0));
        assert_eq!(value["sortOrder"], json!(1));
        assert_eq!(value["type"], json!(1));
        assert_eq!(value["isShow"], json!(1));
        assert_eq!(value["isBlank"], json!(0));
        assert!(value.get("children").is_none());

        let vo = NavVO {
            main_nav: vec![node],
            ..Default::default()
        };
        let value = serde_json::to_value(vo).unwrap();
        assert!(value["mainNav"].is_array());
        assert_eq!(value["topBarNav"], json!([]));
        assert_eq!(value["bottomNav"], json!([]));
        assert_eq!(value["sidebarNav"], json!([]));
    }

    #[test]
    fn cat_floor_wrapper_serializes_expected_keys() {
        let vo = CatFloorWrapperVO {
            cat_floor: vec![CatFloorListVO {
                cat_floor_id: 1,
                cat_floor_name: "手机".into(),
                floor_ico_font: "icon-shouji".into(),
                cat_list: vec![CatFloorCategoryVO {
                    id: 5,
                    name: "手机".into(),
                    pic: "p.png".into(),
                    category_id: 5,
                    category_name: "手机".into(),
                    children: None,
                }],
            }],
            ico_defined_css: "https://a/b.css".into(),
        };
        let value = serde_json::to_value(vo).unwrap();
        assert_eq!(value["icoDefinedCss"], json!("https://a/b.css"));
        assert_eq!(value["catFloor"][0]["catFloorId"], json!(1));
        assert_eq!(value["catFloor"][0]["floorIcoFont"], json!("icon-shouji"));
        let cat = &value["catFloor"][0]["catList"][0];
        assert_eq!(cat["categoryId"], json!(5));
        assert_eq!(cat["categoryName"], json!("手机"));
        // Java：非顶级分类的 children 为 null（不是空数组）
        assert_eq!(cat["children"], serde_json::Value::Null);
    }
}
