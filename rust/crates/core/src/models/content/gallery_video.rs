//! 视频相册（content::gallery_video）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.GalleryVideoController`
//!   （`@RequestMapping("/adminapi/setting/galleryVideo")`，7 个端点）
//! - 服务 `GalleryVideoServiceImpl`（继承 `BaseServiceImpl`）
//! - 入参 `GalleryVideoCreateDTO` / `GalleryVideoUpdateDTO` / `GalleryListDTO`
//!   / `GalleryDelDTO` + 公共 `BatchDTO`
//! - 出参 `GalleryVideoVO` / `GalleryVideoListVO`（树）
//! - 表 `gallery_video`（实体 [`crate::entities::GalleryVideo`]），
//!   删除模式会操作 `gallery_video_info.gallery_id`
//!
//! # 端点（7，全部 admin）
//! `GET /adminapi/setting/galleryVideo/{getAllCategory,list,detail}`、
//! `POST /adminapi/setting/galleryVideo/{del,create,update,batch}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`store` / `pickup` 账号在 `list` 无租户过滤**（Java
//!    `buildGalleryQueryWrapper` 只判断 ADMIN / SHOP / VENDOR，STORE/PICKUP
//!    落到「无过滤」分支）；本实现逐字保留该行为。
//!    `getAllCategory`（treeList）与 `create` 的 `nextSort` 则判断
//!    SHOP/STORE/PICKUP，见 [`VideoScope`]。
//! 2. `detail`：Java `id < 1` 返回 `null`；缺行时 `BeanUtils` 抛异常（500）。
//!    本实现 `id < 1` 返回 `Ok(None)`，缺行返回 `NotFound("视频相册不存在")`。
//! 3. `list` 页大小固定 **99**（Java `new Page<>(page, 99)`）；
//!    `galleryId` 缺省 `0`（Java `GalleryListDTO` 构造器），`>= 0` 时按
//!    `parent_id` 过滤。
//! 4. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

use serde::{Deserialize, Serialize};

use crate::entities::GalleryVideo;
use crate::types::PageQuery;

/// Java `GalleryVideoCreateDTO.parentId` 的 `@NotNull`。
pub const MSG_PARENT_ID_REQUIRED: &str = "父级id不能为空";
/// Java `GalleryVideoCreateDTO/UpdateDTO.name` 的 `@NotBlank`。
pub const MSG_NAME_REQUIRED: &str = "相册名称不能为空";
/// Java `GalleryVideoUpdateDTO.id` 的 `@NotNull`。
pub const MSG_ID_REQUIRED: &str = "主键id不能为空";
/// Java `GalleryDelDTO.id` 的 `@NotNull`。
pub const MSG_GROUP_ID_REQUIRED: &str = "分组ID不能为空";
/// Java `Assert.notNull(galleryVideo, "视频相册不存在")`。
pub const MSG_VIDEO_NOT_FOUND: &str = "视频相册不存在";
/// Java `Assert.isTrue(count == 0, "视频相册名称已存在")`。
pub const MSG_NAME_EXISTS: &str = "视频相册名称已存在";
/// Java `move` 的 `GlobalException` 文案。
pub const MSG_SAME_GROUP: &str = "来源分组和目标分组不能相同";
/// Java `move` 的 `GlobalException` 文案。
pub const MSG_TARGET_IS_DESCENDANT: &str = "目标分组不能是来源分组的子孙节点";

/// Java `GalleryVideoServiceImpl#list` 固定页大小 `new Page<>(page, 99)`。
pub const VIDEO_LIST_PAGE_SIZE: u64 = 99;

/// `gallery_video` 表可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 8] = [
    "id",
    "shop_id",
    "parent_id",
    "name",
    "sort",
    "add_time",
    "add_user_id",
    "vendor_id",
];

/// 视频相册租户范围（Java `AdminTypeEnum` + `getShopId()/getVendorId()`）。
///
/// - `admin` 账号：`shop_id = Some(0)` + `vendor_id = Some(0)`（tree/create 分支）
/// - `shop` / `store` / `pickup`：`shop_id = Some(x)`（tree/create 分支）
/// - `vendor`：`vendor_id = Some(x)`
/// - `list` 只识别 ADMIN / SHOP / VENDOR（store/pickup 无过滤，见模块头差异 1）
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct VideoScope {
    /// 店铺过滤（`None` = 不过滤）。
    pub shop_id: Option<i32>,
    /// 供应商过滤（`None` = 不过滤）。
    pub vendor_id: Option<i32>,
}

impl VideoScope {
    /// 平台账号：`shop_id = 0 AND vendor_id = 0`。
    #[must_use]
    pub fn admin() -> Self {
        Self {
            shop_id: Some(0),
            vendor_id: Some(0),
        }
    }

    /// 店铺/门店账号：只按 `shop_id` 过滤。
    #[must_use]
    pub fn shop(shop_id: i32) -> Self {
        Self {
            shop_id: Some(shop_id),
            vendor_id: None,
        }
    }

    /// 供应商账号：只按 `vendor_id` 过滤。
    #[must_use]
    pub fn vendor(vendor_id: i32) -> Self {
        Self {
            shop_id: None,
            vendor_id: Some(vendor_id),
        }
    }

    /// 无过滤（未知账号 / store、pickup 的 list 分支）。
    #[must_use]
    pub fn unscoped() -> Self {
        Self::default()
    }
}

/// 属性名 → 列名（Java `getColumnByPropertyName`；未知回退主键）。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "id" => "id",
        "shopId" | "shop_id" => "shop_id",
        "parentId" | "parent_id" => "parent_id",
        "name" => "name",
        "sort" => "sort",
        "addTime" | "add_time" => "add_time",
        "addUserId" | "add_user_id" => "add_user_id",
        "vendorId" | "vendor_id" => "vendor_id",
        _ => "id",
    }
}

/// 列表排序（Java `buildSortOrder(page, sortField, sortOrder)`；缺省 id 降序）。
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let column = match sort_field.map(str::trim).filter(|s| !s.is_empty()) {
        None => "id",
        Some(f) => normalize_column(f),
    };
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    (column, desc)
}

/// 列表查询参数（Java `GalleryListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryVideoListQuery {
    /// 页码。
    pub page: Option<u64>,
    /// 页大小（本接口不生效，固定 99）。
    pub size: Option<u64>,
    /// 排序字段。
    pub sort_field: Option<String>,
    /// 排序方向。
    pub sort_order: Option<String>,
    /// 关键字（本接口未使用）。
    pub keyword: Option<String>,
    /// 分组 ID（`>= 0` 时按 `parent_id` 过滤；缺省 0）。
    #[serde(default = "default_gallery_id")]
    pub gallery_id: Option<i32>,
}

fn default_gallery_id() -> Option<i32> {
    Some(0)
}

impl GalleryVideoListQuery {
    /// 归一化分页（页大小固定 99）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: VIDEO_LIST_PAGE_SIZE,
        }
    }

    /// 实际生效的 `parent_id` 过滤值（Java `galleryId != null && galleryId >= 0`）。
    #[must_use]
    pub fn parent_filter(&self) -> Option<i32> {
        self.gallery_id.filter(|g| *g >= 0)
    }
}

/// 创建入参（Java `GalleryVideoCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryVideoCreateDTO {
    /// 父级 ID（`@NotNull(message = 父级id不能为空)`）。
    pub parent_id: Option<i32>,
    /// 名称（`@NotBlank(message = 相册名称不能为空)`）。
    pub name: Option<String>,
    /// 排序（服务端按同级 max+1 覆盖）。
    pub sort: Option<i32>,
}

/// 更新入参（Java `GalleryVideoUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryVideoUpdateDTO {
    /// 主键（`@NotNull(message = 主键id不能为空)`）。
    pub id: Option<i32>,
    /// 名称（`@NotBlank(message = 相册名称不能为空)`）。
    pub name: Option<String>,
    /// 排序（不传则不修改）。
    pub sort: Option<i32>,
}

/// 删除入参（Java `GalleryDelDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryDelDTO {
    /// 分组 ID（`@NotNull(message = 分组ID不能为空)`）。
    pub id: Option<i32>,
    /// 删除模式：`only_group` / `group_and_files`。
    pub delete_mode: Option<String>,
}

/// 批量操作入参（Java 公共 `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型（仅 `"del"` 生效）。
    pub r#type: Option<String>,
    /// 操作值（未使用）。
    pub value: i32,
}

/// 视频相册 VO（Java `GalleryVideoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoVO {
    /// 主键。
    pub id: i32,
    /// 名称。
    pub name: String,
    /// 排序。
    pub sort: i32,
}

/// 视频相册树节点（Java `GalleryVideoListVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryVideoListVO {
    /// 主键。
    pub id: i32,
    /// 父级 ID。
    pub parent_id: i32,
    /// 名称。
    pub name: String,
    /// 排序。
    pub sort: i32,
    /// 子节点。
    pub children: Vec<GalleryVideoListVO>,
}

/// 校验创建入参（Java `@Valid`）。
///
/// # Errors
/// - `parentId` 缺失 → 「父级id不能为空」
/// - `name` 空白 → 「相册名称不能为空」
pub fn validate_create(dto: &GalleryVideoCreateDTO) -> Result<(i32, String), String> {
    let parent_id = dto
        .parent_id
        .ok_or_else(|| MSG_PARENT_ID_REQUIRED.to_string())?;
    let name = dto
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_NAME_REQUIRED.to_string())?;
    Ok((parent_id, name.to_string()))
}

/// 校验更新入参（Java `@Valid`）。
///
/// # Errors
/// - `id` 缺失 → 「主键id不能为空」
/// - `name` 空白 → 「相册名称不能为空」
pub fn validate_update(dto: &GalleryVideoUpdateDTO) -> Result<(i32, String), String> {
    let id = dto.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
    let name = dto
        .name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_NAME_REQUIRED.to_string())?;
    Ok((id, name.to_string()))
}

/// 删除分组 ID 必填校验（Java `GalleryDelDTO.id @NotNull`）。
pub fn require_group_id(id: Option<i32>) -> Result<i32, String> {
    id.ok_or_else(|| MSG_GROUP_ID_REQUIRED.to_string())
}

/// 是否 `group_and_files` 删除模式（Java `"group_and_files".equals(deleteMode)`）。
#[must_use]
pub fn is_delete_files_mode(delete_mode: &str) -> bool {
    delete_mode == "group_and_files"
}

/// 是否触发 `delWithMode`（Java `deleteMode != null && !isEmpty()`）。
#[must_use]
pub fn has_delete_mode(delete_mode: Option<&str>) -> bool {
    delete_mode.map(str::trim).is_some_and(|m| !m.is_empty())
}

/// 批量删除判定（Java `BaseServiceImpl#batch`）。
#[must_use]
pub fn is_delete_batch(dto: &BatchDTO) -> bool {
    dto.r#type.as_deref() == Some("del") && !dto.ids.is_empty()
}

/// 由实体列表组装树（Java `treeList`：父 0 为根；同级 sort 升序、id 升序）。
#[must_use]
pub fn build_video_tree(items: &[GalleryVideo]) -> Vec<GalleryVideoListVO> {
    use std::collections::HashMap;

    let mut node_map: HashMap<i32, GalleryVideoListVO> = HashMap::with_capacity(items.len());
    for g in items {
        node_map.insert(
            g.id,
            GalleryVideoListVO {
                id: g.id,
                parent_id: g.parent_id,
                name: g.name.clone(),
                sort: g.sort,
                children: Vec::new(),
            },
        );
    }

    let mut roots: Vec<i32> = Vec::new();
    let mut children_of: HashMap<i32, Vec<i32>> = HashMap::new();
    for g in items {
        if g.parent_id == 0 || !node_map.contains_key(&g.parent_id) {
            roots.push(g.id);
        } else {
            children_of.entry(g.parent_id).or_default().push(g.id);
        }
    }

    fn take_node(
        id: i32,
        node_map: &mut HashMap<i32, GalleryVideoListVO>,
        children_of: &HashMap<i32, Vec<i32>>,
    ) -> GalleryVideoListVO {
        let mut node = node_map.remove(&id).unwrap_or_else(|| GalleryVideoListVO {
            id,
            ..Default::default()
        });
        if let Some(children) = children_of.get(&id) {
            node.children = children
                .iter()
                .map(|cid| take_node(*cid, node_map, children_of))
                .collect();
            sort_nodes(&mut node.children);
        }
        node
    }

    let mut tree: Vec<GalleryVideoListVO> = roots
        .iter()
        .map(|id| take_node(*id, &mut node_map, &children_of))
        .collect();
    sort_nodes(&mut tree);
    tree
}

/// 同级排序：`sort` 升序、`id` 升序（Java `sortVideoTreeNodes`）。
fn sort_nodes(nodes: &mut [GalleryVideoListVO]) {
    nodes.sort_by(|a, b| a.sort.cmp(&b.sort).then(a.id.cmp(&b.id)));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn video(id: i32, parent_id: i32, name: &str, sort: i32) -> GalleryVideo {
        GalleryVideo {
            id,
            shop_id: 0,
            parent_id,
            name: name.to_string(),
            sort,
            add_time: 1_700_000_000,
            add_user_id: 1,
            vendor_id: 0,
        }
    }

    #[test]
    fn validations_match_java_messages() {
        assert_eq!(
            validate_create(&GalleryVideoCreateDTO::default()).unwrap_err(),
            MSG_PARENT_ID_REQUIRED
        );
        assert_eq!(
            validate_create(&GalleryVideoCreateDTO {
                parent_id: Some(0),
                name: None,
                sort: None,
            })
            .unwrap_err(),
            MSG_NAME_REQUIRED
        );
        assert_eq!(
            validate_create(&GalleryVideoCreateDTO {
                parent_id: Some(2),
                name: Some("  视频 ".into()),
                sort: None,
            })
            .unwrap(),
            (2, "视频".to_string())
        );
        assert_eq!(
            validate_update(&GalleryVideoUpdateDTO::default()).unwrap_err(),
            MSG_ID_REQUIRED
        );
        assert_eq!(
            validate_update(&GalleryVideoUpdateDTO {
                id: Some(1),
                name: Some(" ".into()),
                sort: None,
            })
            .unwrap_err(),
            MSG_NAME_REQUIRED
        );
        assert_eq!(require_group_id(None).unwrap_err(), MSG_GROUP_ID_REQUIRED);
    }

    #[test]
    fn tree_builds_sorts_and_orphans_to_root() {
        let items = vec![
            video(1, 0, "A", 2),
            video(2, 0, "B", 1),
            video(3, 2, "B1", 2),
            video(4, 2, "B2", 1),
            video(5, 99, "孤儿", 1),
        ];
        let tree = build_video_tree(&items);
        // 根：B(sort1) / 孤儿(sort1, id5 与 B id2 比较 → 2 在前) / A(sort2)
        assert_eq!(tree.len(), 3);
        assert_eq!(tree[0].id, 2);
        assert_eq!(tree[1].id, 5);
        assert_eq!(tree[2].id, 1);
        // B 的子节点按 sort 升序：B2(1) 在 B1(2) 前
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].id, 4);
        assert_eq!(tree[0].children[1].id, 3);
        // 空输入
        assert!(build_video_tree(&[]).is_empty());
    }

    #[test]
    fn sort_and_page_defaults() {
        assert_eq!(resolve_sort(None, None), ("id", Some(true)));
        assert_eq!(
            resolve_sort(Some("sort"), Some("asc")),
            ("sort", Some(false))
        );
        let q: GalleryVideoListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page_size, 99);
        assert_eq!(q.parent_filter(), Some(0));
        let q: GalleryVideoListQuery =
            serde_json::from_value(serde_json::json!({"page": 2, "galleryId": -1})).unwrap();
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.parent_filter(), None);
    }

    #[test]
    fn delete_mode_helpers_and_batch_rule() {
        assert!(has_delete_mode(Some("group_and_files")));
        assert!(!has_delete_mode(Some("  ")));
        assert!(is_delete_files_mode("group_and_files"));
        assert!(!is_delete_files_mode("only_group"));
        assert!(is_delete_batch(&BatchDTO {
            ids: vec![1],
            r#type: Some("del".into()),
            value: 0
        }));
        assert!(!is_delete_batch(&BatchDTO::default()));
    }

    #[test]
    fn dto_and_vo_camel_case() {
        let d: GalleryVideoCreateDTO =
            serde_json::from_value(serde_json::json!({"parentId": 0, "name": "视频", "sort": 3}))
                .unwrap();
        assert_eq!(d.parent_id, Some(0));
        let d: GalleryDelDTO =
            serde_json::from_value(serde_json::json!({"id": 1, "deleteMode": "only_group"}))
                .unwrap();
        assert_eq!(d.delete_mode.as_deref(), Some("only_group"));

        let mut vo = GalleryVideoListVO {
            id: 1,
            parent_id: 0,
            name: "A".into(),
            sort: 1,
            children: Vec::new(),
        };
        vo.children = vec![GalleryVideoListVO {
            id: 2,
            parent_id: 1,
            name: "B".into(),
            sort: 1,
            children: Vec::new(),
        }];
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["parentId"], 0);
        assert_eq!(json["children"][0]["name"], "B");
        let _ = HashMap::<i32, i32>::new();
    }
}
