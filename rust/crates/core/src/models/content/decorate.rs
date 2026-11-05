//! 页面装修域 DTO/VO。对应 `com.tigshop.bean.dto.decorate.*`、
//! `com.tigshop.bean.vo.decorate.*` 与 `param.decorate.DecorateDiscreteUpdateParam`。
//!
//! 字段名保持与原接口 JSON 一致（camelCase）；金额无涉，时间统一毫秒时间戳 `i64`
//! （库列 `update_time` 为秒，转换发生在实体 → VO 映射处）。

use serde::{Deserialize, Serialize};

use crate::entities::{
    Decorate, DecorateDiscrete, DecorateShare, MobileCatNav, PcCatFloor, PcNavigation,
};
use crate::types::PageQuery;

// ————————————————————— 通用小工具 —————————————————————

/// 解析库中的 JSON 文本列（`data` / `draft_data` / `link` 等）。
///
/// 空串或非法 JSON 一律返回 `None`，避免因历史脏数据把整个接口打挂。
pub fn parse_json_opt(text: &Option<String>) -> Option<serde_json::Value> {
    let raw = text.as_deref().unwrap_or("").trim();
    if raw.is_empty() {
        return None;
    }
    serde_json::from_str(raw).ok()
}

/// 库中 JSON 文本列写回（`None` 归一为 `null` 文本由调用方决定）。
pub fn to_json_string(value: &serde_json::Value) -> String {
    value.to_string()
}

/// 秒级时间戳 → 毫秒（VO 层统一毫秒）。
fn ms(sec: Option<i32>) -> Option<i64> {
    sec.map(|s| i64::from(s) * 1000)
}

/// 解析模板样式版本（对应 `DecorateServiceImpl#resolveHomeStyleVersion`）。
///
/// 真相源为前端存入的 `data.pageModule.homeStyleVersion`（"new"/"old"），
/// `data` 为空时回退 `draft_data`；两者皆空的全新模板兜底 `"new"`，
/// 有数据但字段缺失/解析异常兜底 `"old"`（兼容历史存量页面）。
pub fn resolve_home_style_version(d: &Decorate) -> String {
    let json = if d.data.as_deref().is_some_and(|s| !s.trim().is_empty()) {
        d.data.clone()
    } else {
        d.draft_data.clone()
    };
    let Some(json) = json.filter(|s| !s.trim().is_empty()) else {
        // 尚未保存任何页面内容的新建模板默认按新版返回
        return "new".into();
    };
    match serde_json::from_str::<serde_json::Value>(&json) {
        Ok(v) => v
            .get("pageModule")
            .and_then(|m| m.get("homeStyleVersion"))
            .and_then(|s| s.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| "old".into()),
        Err(_) => "old".into(),
    }
}

/// 逗号分隔整数列表解析（`decorateType=1,2`）。
pub fn parse_i32_csv(raw: &Option<String>) -> Vec<i32> {
    raw.as_deref()
        .map(|s| {
            s.split(',')
                .filter_map(|p| p.trim().parse::<i32>().ok())
                .collect()
        })
        .unwrap_or_default()
}

// ————————————————————— 装修页（decorate） —————————————————————

/// 装修页分页查询，对应 Java `DecorateListDTO`。
///
/// 多值过滤（`decorateType` / `pageType`）按逗号分隔传入，兼容原 Spring
/// 对 `List<Integer>` 的逗号解析；重复键形式由前端改为逗号拼接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateListQuery {
    pub keyword: Option<String>,
    /// 页面端类型：1:H5 2:PC 3:自定义，逗号分隔支持多值。
    pub decorate_type: Option<String>,
    /// 页面用途类型：1首页 2个人中心 3活动 4分类 5登录 6搜索 7导航 8商品详情。
    pub page_type: Option<String>,
    pub parent_id: Option<i32>,
    pub status: Option<i32>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<u64>,
    /// 前端“装修页面”选择器会传 `size=-1` 表示取全部，故用 i64 接收。
    #[serde(alias = "size")]
    pub page_size: Option<i64>,
}

impl DecorateListQuery {
    /// 过滤后的合法 decorate_type 列表（仅 1/2/3，对应 `DecorateType.isValidCode`）。
    #[must_use]
    pub fn decorate_types(&self) -> Vec<i32> {
        parse_i32_csv(&self.decorate_type)
            .into_iter()
            .filter(|t| matches!(t, 1 | 2 | 3))
            .collect()
    }

    /// 过滤后的 page_type 列表（去重去空）。
    #[must_use]
    pub fn page_types(&self) -> Vec<i32> {
        let mut out = parse_i32_csv(&self.page_type);
        out.sort_unstable();
        out.dedup();
        out
    }

    /// 组装分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            // size=-1（选择链接“装修页面”tab）表示取全部
            page_size: match self.page_size {
                Some(v) if v > 0 => u64::try_from(v).unwrap_or(20),
                _ => 200,
            },
        }
    }
}

/// 装修页子级（多语言子页），对应 `DecorateVO.ChildrenVo`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateChildVO {
    pub decorate_id: i32,
    pub locale_id: Option<i32>,
    pub language: Option<String>,
}

/// 装修页 VO，对应 Java `DecorateVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateVO {
    pub decorate_id: i32,
    pub decorate_title: Option<String>,
    /// 已发布的页面模块数据
    pub data: Option<serde_json::Value>,
    /// 草稿页面模块数据
    pub draft_data: Option<serde_json::Value>,
    /// 页面类型 1:h5 2:PC 3:自定义
    pub decorate_type: Option<i32>,
    /// 页面用途类型 1首页 2个人中心 3活动 4分类 5登录 6搜索 7导航 8商品详情
    pub page_type: Option<i32>,
    pub is_home: Option<i32>,
    pub shop_id: Option<i32>,
    /// 1:已发布 0:未发布
    pub status: Option<i32>,
    /// 更新时间（毫秒时间戳）
    pub update_time: Option<i64>,
    pub sort_order: Option<i32>,
    pub binded_h5_id: Option<i32>,
    /// 绑定的 H5 页面名称
    pub bingding_h5_name: Option<String>,
    /// 模板样式版本 new/old
    pub home_style_version: Option<String>,
    /// 扩展：父级/语言（原 Java VO 未暴露，编辑器多语言保存需要）
    pub parent_id: Option<i32>,
    pub locale_id: Option<i32>,
    /// 分享信息 JSON（shareTitle/shareDesc/shareImage）
    pub share_info: Option<serde_json::Value>,
    pub children: Option<Vec<DecorateChildVO>>,
}

impl From<&Decorate> for DecorateVO {
    fn from(d: &Decorate) -> Self {
        Self {
            decorate_id: d.decorate_id,
            decorate_title: d.decorate_title.clone(),
            data: parse_json_opt(&d.data),
            draft_data: parse_json_opt(&d.draft_data),
            decorate_type: d.decorate_type,
            page_type: Some(d.page_type),
            is_home: d.is_home,
            shop_id: Some(d.shop_id),
            status: d.status,
            update_time: ms(d.update_time),
            sort_order: d.sort_order,
            binded_h5_id: d.binded_h5_id,
            bingding_h5_name: None,
            home_style_version: Some(resolve_home_style_version(d)),
            parent_id: d.parent_id,
            locale_id: d.locale_id,
            share_info: parse_json_opt(&d.share_info),
            children: None,
        }
    }
}

/// 创建装修页请求，对应 Java `DecorateCreateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateCreateDTO {
    pub decorate_title: Option<String>,
    pub data: Option<String>,
    pub draft_data: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub decorate_type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub page_type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub is_home: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub shop_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub status: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub sort_order: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub parent_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub locale_id: Option<i32>,
}

/// 兼容原版前端把数字字段作为字符串提交（`"1"`）。
fn de_opt_i32_lenient<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.as_i64().and_then(|v| i32::try_from(v).ok()),
        Some(serde_json::Value::String(s)) => s.trim().parse::<i32>().ok(),
        _ => None,
    })
}

/// 更新装修页请求，对应 Java `DecorateUpdateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateUpdateDTO {
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub decorate_id: Option<i32>,
    pub decorate_title: Option<String>,
    pub data: Option<String>,
    pub draft_data: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub decorate_type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub page_type: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub is_home: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub shop_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub status: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub parent_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub locale_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub sort_order: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub binded_h5_id: Option<i32>,
}

/// 保存草稿/发布请求，对应 Java `DecorateSaveDTO`（`data` 为 JSON 对象）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateSaveDTO {
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub id: Option<i32>,
    pub data: Option<serde_json::Value>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub parent_id: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub locale_id: Option<i32>,
}

/// 装修分享信息保存请求，对应 Java `DecorateShareInfoDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateShareInfoDTO {
    pub decorate_id: i32,
    pub share_title: Option<String>,
    pub share_desc: Option<String>,
    pub share_image: Option<String>,
}

/// 装修分享信息 VO，对应 Java `DecorateShareInfoVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateShareInfoVO {
    pub decorate_id: i32,
    pub share_title: Option<String>,
    pub share_desc: Option<String>,
    pub share_image: Option<String>,
}

/// 前台装修模块读取结果，对应 Java `DecorateModuleListVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateModuleListVO {
    pub decorate_id: Option<i32>,
    /// 模块列表（元素结构同 `DecorateModuleListDTO`：type/isShow/label/module...）
    pub module_list: Option<Vec<serde_json::Value>>,
    pub page_module: Option<serde_json::Value>,
    pub bind_decorate_id: Option<i32>,
    pub is_home: Option<i32>,
}

/// 前台首页装修查询，对应 `HomeController#index` / `#pcIndex` 参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HomeDecorateQuery {
    pub preview_id: Option<i32>,
    pub id: Option<i32>,
    pub decorate_type: Option<i32>,
}

// ————————————————————— PC 导航（pc_navigation） —————————————————————

/// PC 导航分页查询，对应 Java `PcNavigationListDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationListQuery {
    /// 1导航条 2顶部站点地图导航 3底部快捷导航 4侧边导航
    pub r#type: Option<i32>,
    pub parent_id: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

impl PcNavigationListQuery {
    /// 组装分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(20),
        }
    }
}

/// PC 导航 VO，对应 Java `PcNavigationVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcNavigationVO {
    pub id: i32,
    pub title: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub is_blank: Option<i32>,
    /// 链接数据 JSON `{name,label,link,app_link,id,sn...}`，空时为 `{}`
    pub link: serde_json::Value,
    pub r#type: Option<i32>,
    pub type_name: Option<String>,
    pub parent_id: Option<i32>,
    pub icon: Option<String>,
    pub has_children: i64,
}

/// 导航类型名（对应 `PcNavigationType`）。
#[must_use]
pub fn pc_navigation_type_name(code: Option<i32>) -> String {
    match code {
        Some(1) => "导航条",
        Some(2) => "顶部站点地图导航",
        Some(3) => "底部快捷导航",
        Some(4) => "侧边导航",
        _ => "",
    }
    .to_string()
}

impl From<&PcNavigation> for PcNavigationVO {
    fn from(n: &PcNavigation) -> Self {
        let link = parse_json_opt(&Some(n.link.clone())).unwrap_or_else(|| serde_json::json!({}));
        let link = if link.is_array() && link.as_array().is_some_and(|a| a.is_empty()) {
            serde_json::json!({})
        } else {
            link
        };
        Self {
            id: n.id,
            title: Some(n.title.clone()),
            is_show: Some(n.is_show),
            sort_order: Some(n.sort_order),
            is_blank: Some(n.is_blank),
            link,
            r#type: Some(n.r#type),
            type_name: Some(pc_navigation_type_name(Some(n.r#type))),
            parent_id: Some(n.parent_id),
            icon: Some(n.icon.clone()),
            has_children: 0,
        }
    }
}

/// 上级导航树节点，对应 Java `PcNavigationController#getParentNav` 返回的
/// `List<Tree<Integer>>`（这里按 `id/parentId/title/children` 还原）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcNavTreeVO {
    pub id: i32,
    pub parent_id: i32,
    pub title: String,
    pub children: Vec<PcNavTreeVO>,
}

/// 创建 PC 导航请求，对应 Java `PcNavigationCreateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationCreateDTO {
    pub title: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub is_blank: Option<i32>,
    pub link: Option<serde_json::Value>,
    pub r#type: Option<i32>,
    pub parent_id: Option<i32>,
    pub icon: Option<String>,
}

/// 更新 PC 导航请求，对应 Java `PcNavigationUpdateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcNavigationUpdateDTO {
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

// ————————————————————— PC 分类楼层（pc_cat_floor） —————————————————————

/// PC 分类楼层分页查询，对应 Java `PcCatFloorListDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorListQuery {
    pub is_show: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

impl PcCatFloorListQuery {
    /// 组装分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(20),
        }
    }
}

/// PC 分类楼层 VO，对应 Java `PcCatFloorVO`（JSON 文本列在此还原为数组）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcCatFloorVO {
    pub cat_floor_id: i32,
    pub cat_floor_name: Option<String>,
    pub category_ids: Vec<i32>,
    pub category_names: Vec<String>,
    pub floor_ico: Option<String>,
    pub hot_cat: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub floor_ico_font: Option<String>,
    pub brand_ids: Vec<i32>,
}

impl From<&PcCatFloor> for PcCatFloorVO {
    fn from(f: &PcCatFloor) -> Self {
        Self {
            cat_floor_id: f.cat_floor_id,
            cat_floor_name: Some(f.cat_floor_name.clone()),
            category_ids: parse_json_opt(&Some(f.category_ids.clone()))
                .and_then(|v| serde_json::from_value::<Vec<i32>>(v).ok())
                .unwrap_or_default(),
            category_names: parse_json_opt(&Some(f.category_names.clone()))
                .and_then(|v| serde_json::from_value::<Vec<String>>(v).ok())
                .unwrap_or_default(),
            floor_ico: Some(f.floor_ico.clone()),
            hot_cat: Some(f.hot_cat.clone()),
            is_show: Some(f.is_show),
            sort_order: Some(f.sort_order),
            floor_ico_font: Some(f.floor_ico_font.clone()),
            brand_ids: parse_json_opt(&Some(f.brand_ids.clone()))
                .and_then(|v| serde_json::from_value::<Vec<i32>>(v).ok())
                .unwrap_or_default(),
        }
    }
}

/// 创建 PC 分类楼层请求，对应 Java `PcCatFloorCreateDTO`
/// （`catFloorName` 由服务端按分类名拼接，忽略入参）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorCreateDTO {
    pub cat_floor_name: Option<String>,
    pub category_ids: Option<Vec<i32>>,
    pub category_names: Option<Vec<String>>,
    pub floor_ico: Option<String>,
    pub hot_cat: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub floor_ico_font: Option<String>,
    pub brand_ids: Option<Vec<i32>>,
}

/// 更新 PC 分类楼层请求，对应 Java `PcCatFloorUpdateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PcCatFloorUpdateDTO {
    pub cat_floor_id: Option<i32>,
    pub cat_floor_name: Option<String>,
    pub category_ids: Option<Vec<i32>>,
    pub category_names: Option<Vec<String>>,
    pub floor_ico: Option<String>,
    pub hot_cat: Option<String>,
    pub is_show: Option<i32>,
    pub sort_order: Option<i32>,
    pub floor_ico_font: Option<String>,
    pub brand_ids: Option<Vec<i32>>,
}

// ————————————————————— 手机分类导航（mobile_cat_nav） —————————————————————

/// 手机分类导航分页查询，对应 Java `MobileCatNavListDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavListQuery {
    pub is_show: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

impl MobileCatNavListQuery {
    /// 组装分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(20),
        }
    }
}

/// 手机分类导航 VO，对应 Java `MobileCatNavVO`（明细的品牌/子分类/图片列表
/// 由调用方按需补充，这里保留库中可还原的字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileCatNavVO {
    pub mobile_cat_nav_id: i32,
    pub category_id: Option<i32>,
    pub category_name: Option<String>,
    pub cat_color: Option<String>,
    pub child_cat_ids: Vec<i32>,
    pub brand_ids: Vec<i32>,
    pub is_show: Option<i32>,
    /// 分类 banner 图片数组
    pub img_url: serde_json::Value,
    pub sort_order: Option<i32>,
    pub cat_name_alias: Option<String>,
}

impl From<&MobileCatNav> for MobileCatNavVO {
    fn from(n: &MobileCatNav) -> Self {
        Self {
            mobile_cat_nav_id: n.mobile_cat_nav_id,
            category_id: Some(n.category_id),
            category_name: None,
            cat_color: Some(n.cat_color.clone()),
            child_cat_ids: parse_json_opt(&Some(n.child_cat_ids.clone()))
                .and_then(|v| serde_json::from_value::<Vec<i32>>(v).ok())
                .unwrap_or_default(),
            brand_ids: parse_json_opt(&Some(n.brand_ids.clone()))
                .and_then(|v| serde_json::from_value::<Vec<i32>>(v).ok())
                .unwrap_or_default(),
            is_show: Some(n.is_show),
            img_url: parse_json_opt(&Some(n.img_url.clone()))
                .unwrap_or_else(|| serde_json::json!([])),
            sort_order: Some(i32::from(n.sort_order)),
            cat_name_alias: n.cat_name_alias.clone(),
        }
    }
}

/// 创建手机分类导航请求，对应 Java `MobileCatNavCreateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavCreateDTO {
    pub category_id: Option<i32>,
    pub cat_color: Option<String>,
    pub child_cat_ids: Option<Vec<i32>>,
    pub brand_ids: Option<Vec<i32>>,
    pub is_show: Option<i32>,
    pub img_url: Option<Vec<serde_json::Value>>,
    pub sort_order: Option<i32>,
    pub cat_name_alias: Option<String>,
}

/// 更新手机分类导航请求，对应 Java `MobileCatNavUpdateDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MobileCatNavUpdateDTO {
    pub mobile_cat_nav_id: Option<i32>,
    pub category_id: Option<i32>,
    pub cat_color: Option<String>,
    pub child_cat_ids: Option<Vec<i32>>,
    pub brand_ids: Option<Vec<i32>>,
    pub is_show: Option<i32>,
    pub img_url: Option<Vec<serde_json::Value>>,
    pub sort_order: Option<i32>,
    pub cat_name_alias: Option<String>,
}

// ————————————————————— 装修分享（decorate_share） —————————————————————

/// 装修分享分页查询，对应 Java `DecorateShareListDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DecorateShareListQuery {
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

impl DecorateShareListQuery {
    /// 组装分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1),
            page_size: self.page_size.unwrap_or(20),
        }
    }
}

/// 装修分享 VO，对应 Java `DecorateShareVO`。
///
/// 注：Java 侧 `BeanUtils.copyProperties` 因属性名不一致（`shareSn` vs `sn`）
/// 实际回传全空对象，这里按字段真实含义还原，供管理端列表/详情使用。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateShareVO {
    pub share_id: Option<i32>,
    pub sn: Option<String>,
    pub token: Option<String>,
    pub decorate_id: Option<i32>,
    /// token 失效时间（毫秒时间戳）
    pub valid_time: Option<i64>,
    pub create_time: Option<i64>,
    pub update_time: Option<i64>,
    /// 分享导入链接：`/api/home/share/import?sn=..&token=..`
    pub api_url: Option<String>,
}

impl From<&DecorateShare> for DecorateShareVO {
    fn from(s: &DecorateShare) -> Self {
        Self {
            share_id: Some(s.share_id),
            sn: Some(s.share_sn.clone()),
            token: Some(s.share_token.clone()),
            decorate_id: Some(s.decorate_id),
            valid_time: Some(i64::from(s.valid_time) * 1000),
            create_time: Some(i64::from(s.create_time) * 1000),
            update_time: Some(i64::from(s.update_time) * 1000),
            api_url: Some(share_api_url(&s.share_sn, &s.share_token)),
        }
    }
}

/// 分享导入链接（对应 `DecorateShareConstants.API_URL`）。
#[must_use]
pub fn share_api_url(sn: &str, token: &str) -> String {
    format!("/api/home/share/import?sn={sn}&token={token}")
}

// ————————————————————— 装修组件（decorate_discrete） —————————————————————

/// 装修组件 VO，对应 Java `DecorateDiscreteVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateDiscreteVO {
    pub id: Option<i32>,
    pub decorate_sn: Option<String>,
    pub decorate_name: Option<String>,
    pub shop_id: Option<i32>,
    /// 模块数据（原样 JSON，Java 侧对 openAdvertising/PcIndexTips 保留原文）
    pub data: Option<serde_json::Value>,
}

impl From<&DecorateDiscrete> for DecorateDiscreteVO {
    fn from(d: &crate::entities::DecorateDiscrete) -> Self {
        Self {
            id: Some(d.id),
            decorate_sn: Some(d.decorate_sn.clone()),
            decorate_name: d.decorate_name.clone(),
            shop_id: Some(d.shop_id),
            data: parse_json_opt(&Some(d.data.clone())),
        }
    }
}

/// 装修组件更新请求，对应 Java `DecorateDiscreteUpdateParam`（按 sn + 店铺 upsert）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateDiscreteUpdateParam {
    #[serde(default)]
    pub id: Option<i32>,
    pub decorate_sn: String,
    #[serde(default)]
    pub decorate_name: Option<String>,
    #[serde(default)]
    pub shop_id: Option<i32>,
    pub data: serde_json::Value,
}

// ————————————————————— 个人中心基础数据 —————————————————————

/// 个人中心菜单项，对应 Java `DecorateDiscreteMenuItemDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateDiscreteMenuItemDTO {
    pub is_show: Option<i32>,
    pub r#type: Option<String>,
    pub pic_title: Option<String>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub pic_link: Option<DecorateDiscretePicLink>,
}

/// 菜单链接，对应 Java `DecorateDiscreteMenuItemDTO.PicLink`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateDiscretePicLink {
    pub path: Option<String>,
    pub label: Option<String>,
    pub name: Option<String>,
    pub link: Option<String>,
}

/// 个人中心基础数据 VO，对应 Java `DecorateMemberDataVO<T>`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecorateMemberDataVO {
    pub menus: Vec<DecorateDiscreteMenuItemDTO>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_csv_filters_invalid_type() {
        let q = DecorateListQuery {
            decorate_type: Some("1,9,2".into()),
            ..Default::default()
        };
        assert_eq!(q.decorate_types(), vec![1, 2]);
    }

    #[test]
    fn create_dto_accepts_original_string_numbers() {
        let dto: DecorateCreateDTO = serde_json::from_str(
            r#"{"decorateTitle":"测试","sortOrder":"1","decorateType":"2","status":"0"}"#,
        )
        .expect("原版前端把排序/类型作为字符串提交");
        assert_eq!(dto.sort_order, Some(1));
        assert_eq!(dto.decorate_type, Some(2));
        assert_eq!(dto.status, Some(0));
    }

    #[test]
    fn empty_template_is_new_style() {
        let d = Decorate::default();
        assert_eq!(resolve_home_style_version(&d), "new");
    }

    #[test]
    fn missing_style_version_falls_back_old() {
        let mut d = Decorate::default();
        d.data = Some(r#"{"pageModule":{}}"#.into());
        assert_eq!(resolve_home_style_version(&d), "old");
    }
}
