//! 相册域（content::gallery）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.GalleryController`
//!   （`@RequestMapping("/adminapi/setting/gallery")`，9 个端点）
//! - 服务 `GalleryServiceImpl`（继承 `BaseServiceImpl` 的 `batch` / `del`）
//! - 入参 `GalleryListDTO` / `GalleryDTO` / `GalleryUpdateDTO` /
//!   `GalleryDelDTO` / `GallerySortDTO` / `GalleryMoveDTO` / `BatchDTO`
//! - 出参 `GalleryDTO` / `GalleryTreeNodeVO`
//!
//! # 端点（9，全部 admin）
//! `GET /adminapi/setting/gallery/{list,detail,tree}`、
//! `POST /adminapi/setting/gallery/{del,create,update,batch,sort,move}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`type=video` 分支未迁移**：`tree` / `sort` / `move` 在 Java 中按
//!    `type == "video"` 分流到 `GalleryVideoService`（`gallery_video` /
//!    `gallery_video_info` 表，属 `content/gallery_video` 特性，不在本批次范围）。
//!    本实现对该分支返回明确的「视频素材域未迁移」业务错误，**不伪造**成功。
//! 2. **多租户（shop / vendor）口径**：Java `HeaderUtils.getShopId()` /
//!    `getVendorId()` 的三态语义（`admin` → `0`；`shop`/`pos` → `x-shop-id`
//!    缺省 `null`；其它 → `null`；`vendor` → `x-vendor-id`）由路由层
//!    [`GalleryScope`] 承载。Java `null` 表示**不加过滤条件**（平台/未知账号
//!    可看全部），本实现同样用 `Option` 保留该语义，不会把 `None` 当成 0。
//! 3. **`create` / `update` 的入参校验**：Java 两个方法都没有 `@Valid`，
//!    DTO 上的 `@NotNull` / `@Size` 实际不生效（名称超长要到 DB 才报错）。
//!    本实现按 DTO 声明的约束在服务层校验（文案逐字取自 `GalleryConstants`），
//!    属**更严格**的提前校验，正常前端请求行为不变。
//! 4. **`detail` 缺行**：Java `BeanUtils.copyProperties(null, dto)` 会抛
//!    `IllegalArgumentException`（500）；本实现返回 `Error::NotFound("相册不存在")`。
//! 5. **`gallery_admin_id`**：Java 从请求体 `galleryAdminId` 取（缺省 null 会
//!    撞 NOT NULL 约束）；本实现缺省落 `0`，避免无意义 500（列语义不变）。

use serde::{Deserialize, Serialize};

use crate::entities::Gallery;
use crate::types::PageQuery;

/// Java `GalleryConstants.GALLERY_NAME_IS_NULL`。
pub const ERR_GALLERY_NAME_IS_NULL: &str = "相册名称不能为空";
/// Java `GalleryConstants.GALLERY_NAME_OVER_LENGTH`。
pub const ERR_GALLERY_NAME_OVER_LENGTH: &str = "相册名称长度不能超过100";
/// Java `GalleryConstants.GALLERY_ID_IS_NULL`（详情/删除找不到时的文案）。
pub const ERR_GALLERY_NOT_FOUND: &str = "相册不存在";
/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`。
pub const ERR_ID_REQUIRED: &str = "id不能为空";
/// Java `GalleryDelDTO` 的 `@NotNull(message = "分组ID不能为空")`。
pub const ERR_GROUP_ID_REQUIRED: &str = "分组ID不能为空";
/// Java `GallerySortDTO.ids` 的 `@NotEmpty`。
pub const ERR_SORT_IDS_REQUIRED: &str = "排序ID列表不能为空";
/// Java `GallerySortDTO.type` / `GalleryMoveDTO.type` 的 `@NotNull`。
pub const ERR_TYPE_REQUIRED: &str = "类型不能为空";
/// Java `GalleryMoveDTO.sourceId` 的 `@NotNull`。
pub const ERR_SOURCE_ID_REQUIRED: &str = "来源分组ID不能为空";
/// Java `GalleryMoveDTO.targetId` 的 `@NotNull`。
pub const ERR_TARGET_ID_REQUIRED: &str = "目标分组ID不能为空";
/// Java `GalleryMoveDTO.mode` 的 `@NotNull`。
pub const ERR_MOVE_MODE_REQUIRED: &str = "转移方式不能为空";
/// Java `GalleryServiceImpl#move` 的 `GlobalException`。
pub const ERR_SAME_GROUP: &str = "来源分组和目标分组不能相同";
/// Java `GalleryServiceImpl#move` 的 `GlobalException`。
pub const ERR_TARGET_IS_DESCENDANT: &str = "目标分组不能是来源分组的子孙节点";
/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const ERR_UNSELECTED_ITEM: &str = "未选择项目";
/// 视频素材域未迁移的业务错误文案（本批次范围外，见模块头第 1 条）。
pub const ERR_VIDEO_NOT_MIGRATED: &str =
    "视频素材域（content/gallery_video）尚未迁移，本接口的 video 类型暂不可用";

/// 相册名称长度上限（Java `GalleryDTO @Size(max = 100)`）。
pub const GALLERY_NAME_MAX_LEN: usize = 100;
/// Java `GalleryServiceImpl#list` 固定页大小 `new Page<>(page, 99)`。
pub const GALLERY_LIST_PAGE_SIZE: u64 = 99;
/// Java `BasePage` 默认页码。
pub const DEFAULT_PAGE: u64 = 1;

/// `gallery` 表可参与 `ORDER BY` 的真实列（防 SQL 注入）。
///
/// 对应 Java `BaseServiceImpl#buildSortOrder` + `getColumnByPropertyName`
/// （属性名/列名归一到列名，未知列回退主键 `gallery_id`）。
pub const GALLERY_SORTABLE_COLUMNS: [&str; 8] = [
    "gallery_id",
    "parent_id",
    "gallery_admin_id",
    "gallery_name",
    "gallery_sort",
    "gallery_thumb",
    "shop_id",
    "vendor_id",
];

/// Java `BaseServiceImpl#getColumnByPropertyName` 的属性名 → 列名映射。
///
/// 找不到的属性名回退主键列（Java 的防注入行为），随后由白名单校验兜底。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "galleryId" | "gallery_id" => "gallery_id",
        "parentId" | "parent_id" => "parent_id",
        "galleryAdminId" | "gallery_admin_id" => "gallery_admin_id",
        "galleryName" | "gallery_name" => "gallery_name",
        "gallerySort" | "gallery_sort" => "gallery_sort",
        "galleryThumb" | "gallery_thumb" => "gallery_thumb",
        "shopId" | "shop_id" => "shop_id",
        "vendorId" | "vendor_id" => "vendor_id",
        // Java：找不到属性 → 主键列（防注入）
        _ => "gallery_id",
    }
}

/// 解析列表排序：返回 `(列名, 方向)`。
///
/// 复刻 Java `GalleryServiceImpl#list` + `BaseServiceImpl#buildSortOrder`：
/// - `sortField` 缺省 / 空 → `gallerySort` → `gallery_sort`
/// - `sortOrder` 缺省 / 空 → `asc`
/// - `asc`（忽略大小写）→ 升序；`desc` → 降序；**其它非空值 Java 不设置
///   `ORDER BY`**（这里返回 `None` 表示不拼排序子句，语义一致）
/// - `sortField == galleryId` → 主键列；未知字段回退主键
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let field = sort_field.map(str::trim).filter(|s| !s.is_empty());
    let field = match field {
        // Java：sortField 为空 → gallerySort
        None => "gallery_sort",
        Some(f) => normalize_column(f),
    };
    // 白名单兜底：只有 `gallery` 表真实存在的列可进入 ORDER BY
    let field = GALLERY_SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == field)
        // Java getColumnByPropertyName：找不到列回退主键
        .unwrap_or("gallery_id");

    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(false), // Java：sortOrder 为空 → asc
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        // Java：既非 asc 也非 desc 时不调用 setOrders（无 ORDER BY）
        Some(_) => None,
    };
    (field, desc)
}

/// 相册列表查询参数（Java `GalleryListDTO extends BasePage`）。
///
/// 注意：Java 列表页大小被硬编码为 **99**（`new Page<>(dto.getPage(), 99)`），
/// `size` 参数接收但不生效，保持逐字一致。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryListQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）。
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`；本接口不生效，固定 99）。
    pub size: Option<u64>,
    /// 查询关键字（Java `BasePage.keyword`；本接口未使用，保留兼容）。
    pub keyword: Option<String>,
    /// 排序字段（Java `BasePage.sortField`，缺省 `gallerySort`）。
    pub sort_field: Option<String>,
    /// 排序方向 `asc` / `desc`（缺省 `asc`）。
    pub sort_order: Option<String>,
    /// 相册分组 ID：`>= 0` 时按 `parent_id` 过滤；`< 0` / `null` 不过滤。
    ///
    /// Java `GalleryListDTO` 构造器把缺省值设为 `0`（只看根分组）。
    #[serde(default = "default_gallery_id")]
    pub gallery_id: Option<i32>,
}

/// Java `GalleryListDTO()` 构造器：`galleryId = 0`。
#[must_use]
pub fn default_gallery_id() -> Option<i32> {
    Some(0)
}

impl GalleryListQuery {
    /// 归一化分页（Java `BasePage#getPage` + 固定页大小 99）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(DEFAULT_PAGE).max(1),
            page_size: GALLERY_LIST_PAGE_SIZE,
        }
    }

    /// 实际生效的 `parent_id` 过滤值：
    /// Java `if (galleryId != null && galleryId >= 0) eq(parent_id, galleryId)`。
    #[must_use]
    pub fn parent_filter(&self) -> Option<i32> {
        self.gallery_id.filter(|g| *g >= 0)
    }
}

/// 多租户过滤域（Java `HeaderUtils.getShopId()` / `getVendorId()` 的三态语义）。
///
/// - `shop_id`：`Some(0)` = 平台账号（只看 `shop_id = 0`）；`Some(n)` = 店铺/门店
///   账号；`None` = 头部缺失/无法判定 → **不加过滤条件**（Java `eq(shopId != null, ..)`）。
/// - `vendor_id`：`Some(n)` = 供应商账号；`None` = 不加过滤。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct GalleryScope {
    /// 店铺 ID（`None` 表示不过滤）。
    pub shop_id: Option<i32>,
    /// 供应商 ID（`None` 表示不过滤）。
    pub vendor_id: Option<i32>,
}

impl GalleryScope {
    /// 平台/未知账号（`admin` → shop 0；其它 → None）。
    #[must_use]
    pub fn platform() -> Self {
        Self {
            shop_id: Some(0),
            vendor_id: None,
        }
    }

    /// 店铺/门店账号。
    #[must_use]
    pub fn shop(shop_id: i32) -> Self {
        Self {
            shop_id: Some(shop_id),
            vendor_id: None,
        }
    }

    /// 供应商账号。
    #[must_use]
    pub fn vendor(shop_id: Option<i32>, vendor_id: i32) -> Self {
        Self {
            shop_id,
            vendor_id: Some(vendor_id),
        }
    }

    /// 无法判定账号类型（`x-admin-type` 缺失/未知）→ 不加过滤。
    #[must_use]
    pub fn unscoped() -> Self {
        Self {
            shop_id: None,
            vendor_id: None,
        }
    }
}

/// 相册 DTO / 新增入参（Java `GalleryDTO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryDTO {
    /// 主键。
    pub gallery_id: Option<i32>,
    /// 父级 ID。
    pub parent_id: Option<i32>,
    /// 管理员 ID。
    pub gallery_admin_id: Option<i32>,
    /// 相册名称（Java `@NotNull(message = 相册名称不能为空)`）。
    pub gallery_name: Option<String>,
    /// 相册排序。
    pub gallery_sort: Option<i32>,
    /// 相册缩略图。
    pub gallery_thumb: Option<String>,
    /// 店铺 ID。
    pub shop_id: Option<i32>,
}

/// 相册更新入参（Java `GalleryUpdateDTO extends GalleryDTO`，多一个 `id`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryUpdateDTO {
    /// 编辑使用的相册 ID（`UPDATE ... WHERE gallery_id = id`）。
    pub id: Option<i32>,
    /// 父级 ID。
    pub parent_id: Option<i32>,
    /// 管理员 ID。
    pub gallery_admin_id: Option<i32>,
    /// 相册名称。
    pub gallery_name: Option<String>,
    /// 相册排序。
    pub gallery_sort: Option<i32>,
    /// 相册缩略图。
    pub gallery_thumb: Option<String>,
    /// 店铺 ID。
    pub shop_id: Option<i32>,
}

/// 相册删除入参（Java `GalleryDelDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryDelDTO {
    /// 分组 ID（Java `@NotNull(message = 分组ID不能为空)`）。
    pub id: Option<i32>,
    /// 删除模式：`only_group`（仅删分组）/ `group_and_files`（删分组和素材）。
    pub delete_mode: Option<String>,
}

/// 分组排序入参（Java `GallerySortDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GallerySortDTO {
    /// 排序后的同级分组 ID 列表（Java `@NotEmpty`）。
    pub ids: Vec<i32>,
    /// 素材类型：`image` / `video`（Java `@NotNull`）。
    pub r#type: Option<String>,
}

/// 分组转移入参（Java `GalleryMoveDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryMoveDTO {
    /// 来源分组 ID（Java `@NotNull`）。
    pub source_id: Option<i32>,
    /// 目标分组 ID，未分组为 0（Java `@NotNull`）。
    pub target_id: Option<i32>,
    /// 转移方式：`move_and_delete` / `move_and_keep`（Java `@NotNull`）。
    pub mode: Option<String>,
    /// 素材类型：`image` / `video`（Java `@NotNull`）。
    pub r#type: Option<String>,
}

/// 批量操作入参（Java `com.tigshop.bean.dto.common.BatchDTO`，仅 `type=del` 生效）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型；Java `BaseServiceImpl#batch` 只认 `"del"`。
    pub r#type: Option<String>,
    /// 操作值（Java 声明为原始类型 `int value`，本域未使用）。
    pub value: i32,
}

/// 统一分组树节点（Java `GalleryTreeNodeVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryTreeNodeVO {
    /// 分组 ID。
    pub id: i32,
    /// 图片分组 ID（兼容字段，与 `id` 相同）。
    pub gallery_id: i32,
    /// 父级 ID。
    pub parent_id: i32,
    /// 图片分组名称。
    pub gallery_name: String,
    /// 分组名称（与 `gallery_name` 相同）。
    pub name: String,
    /// 图片分组排序。
    pub gallery_sort: i32,
    /// 排序（与 `gallery_sort` 相同）。
    pub sort: i32,
    /// 素材数量（自身 + 所有子孙的累计值）。
    pub pic_count: i64,
    /// 子节点。
    pub children: Vec<GalleryTreeNodeVO>,
}

/// `GET /adminapi/setting/gallery/tree` 返回结构（Java `{"records": [...]}`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalleryTreeVO {
    /// 根节点列表。
    pub records: Vec<GalleryTreeNodeVO>,
}

impl From<&Gallery> for GalleryDTO {
    fn from(g: &Gallery) -> Self {
        Self {
            gallery_id: Some(g.gallery_id),
            parent_id: Some(g.parent_id),
            gallery_admin_id: Some(g.gallery_admin_id),
            gallery_name: Some(g.gallery_name.clone()),
            gallery_sort: Some(g.gallery_sort),
            gallery_thumb: Some(g.gallery_thumb.clone()),
            shop_id: Some(g.shop_id),
        }
    }
}

/// 校验相册名称（Java `@NotNull` + `@Size(max = 100)`，文案逐字）。
///
/// 返回 `Ok(trim 后的名称)`；长度按 `char` 计数（与既有各域一致，
/// 对 BMP 内中文字符等价于 Java `@Size` 的 UTF-16 计数）。
pub fn validate_gallery_name(name: Option<&str>) -> Result<String, String> {
    let name = name.map(str::trim).filter(|s| !s.is_empty());
    let name = match name {
        Some(n) => n,
        None => return Err(ERR_GALLERY_NAME_IS_NULL.to_string()),
    };
    if name.chars().count() > GALLERY_NAME_MAX_LEN {
        return Err(ERR_GALLERY_NAME_OVER_LENGTH.to_string());
    }
    Ok(name.to_string())
}

/// 是否「删除分组和素材」模式（Java `"group_and_files".equals(deleteMode)`）。
///
/// 其它非空模式（含 `only_group` 与前端未知值）一律按「仅删分组、素材移到未分组」
/// 处理——与 Java `delWithMode` 的 `else` 分支逐字一致。
#[must_use]
pub fn is_delete_files_mode(delete_mode: &str) -> bool {
    delete_mode == "group_and_files"
}

/// 删除模式是否触发 `delWithMode`（Java `deleteMode != null && !isEmpty()`）。
#[must_use]
pub fn has_delete_mode(delete_mode: Option<&str>) -> bool {
    delete_mode.map(str::trim).is_some_and(|m| !m.is_empty())
}

/// 由实体列表 + 各分组素材数组装统一分组树。
///
/// 逐字复刻 Java `GalleryServiceImpl#tree`：
/// 1. 先建节点表（`id` / `galleryId` / `parentId` / `galleryName` / `name` /
///    `gallerySort` / `sort` / `picCount` / `children`）；
/// 2. 挂树：`parentId == 0`（或父节点不在结果集内）→ 根节点；
/// 3. 同级按 `gallerySort` 升序（Java `null → Integer.MAX_VALUE`）、
///    `id` 升序递归重排；
/// 4. 自底向上把子孙素材数累加到父节点。
#[must_use]
pub fn build_gallery_tree(
    galleries: &[Gallery],
    pic_counts: &std::collections::HashMap<i32, i64>,
) -> Vec<GalleryTreeNodeVO> {
    use std::collections::HashMap;

    let mut node_map: HashMap<i32, GalleryTreeNodeVO> = HashMap::with_capacity(galleries.len());
    for g in galleries {
        node_map.insert(
            g.gallery_id,
            GalleryTreeNodeVO {
                id: g.gallery_id,
                gallery_id: g.gallery_id,
                parent_id: g.parent_id,
                gallery_name: g.gallery_name.clone(),
                name: g.gallery_name.clone(),
                gallery_sort: g.gallery_sort,
                sort: g.gallery_sort,
                pic_count: pic_counts.get(&g.gallery_id).copied().unwrap_or(0),
                children: Vec::new(),
            },
        );
    }

    // 先收集挂接关系，再按列表顺序挂树（HashMap 迭代无序，必须按原顺序）。
    let mut child_to_parent: Vec<(i32, i32)> = Vec::with_capacity(galleries.len());
    for g in galleries {
        child_to_parent.push((g.gallery_id, g.parent_id));
    }
    let mut roots: Vec<i32> = Vec::new();
    let mut children_of: HashMap<i32, Vec<i32>> = HashMap::new();
    for (child_id, parent_id) in child_to_parent {
        if parent_id == 0 || !node_map.contains_key(&parent_id) {
            roots.push(child_id);
        } else {
            children_of.entry(parent_id).or_default().push(child_id);
        }
    }

    fn take_node(
        id: i32,
        node_map: &mut HashMap<i32, GalleryTreeNodeVO>,
        children_of: &HashMap<i32, Vec<i32>>,
    ) -> GalleryTreeNodeVO {
        let mut node = node_map.remove(&id).unwrap_or_else(|| GalleryTreeNodeVO {
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

    let mut tree: Vec<GalleryTreeNodeVO> = roots
        .iter()
        .map(|id| take_node(*id, &mut node_map, &children_of))
        .collect();
    sort_nodes(&mut tree);

    // 累加子孙素材数（Java `accumulatePicCount`）。
    fn accumulate(node: &mut GalleryTreeNodeVO) -> i64 {
        let mut total = node.pic_count;
        for child in &mut node.children {
            total += accumulate(child);
        }
        node.pic_count = total;
        total
    }
    for root in &mut tree {
        accumulate(root);
    }
    tree
}

/// 同级重排（Java `sortTreeNodes`：`gallerySort` 升序、`id` 升序）。
fn sort_nodes(nodes: &mut [GalleryTreeNodeVO]) {
    nodes.sort_by(|a, b| a.gallery_sort.cmp(&b.gallery_sort).then(a.id.cmp(&b.id)));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn gallery(id: i32, parent_id: i32, name: &str, sort: i32) -> Gallery {
        Gallery {
            gallery_id: id,
            parent_id,
            gallery_admin_id: 1,
            gallery_name: name.to_string(),
            gallery_sort: sort,
            gallery_thumb: String::new(),
            shop_id: 0,
            vendor_id: None,
        }
    }

    #[test]
    fn name_validation_messages_match_java_verbatim() {
        assert_eq!(validate_gallery_name(None).unwrap_err(), "相册名称不能为空");
        assert_eq!(
            validate_gallery_name(Some("   ")).unwrap_err(),
            "相册名称不能为空"
        );
        assert_eq!(validate_gallery_name(Some(" 海报 ")).unwrap(), "海报");
        let ok = "相".repeat(GALLERY_NAME_MAX_LEN);
        assert!(validate_gallery_name(Some(&ok)).is_ok());
        let bad = "相".repeat(GALLERY_NAME_MAX_LEN + 1);
        assert_eq!(
            validate_gallery_name(Some(&bad)).unwrap_err(),
            "相册名称长度不能超过100"
        );
    }

    #[test]
    fn list_query_defaults_follow_java_list_dto() {
        // Java GalleryListDTO 构造器：galleryId = 0；BasePage：page = 1
        let q: GalleryListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.gallery_id, Some(0));
        assert_eq!(q.page_query().page, 1);
        // 页大小硬编码 99（忽略 size）
        assert_eq!(q.page_query().page_size, GALLERY_LIST_PAGE_SIZE);
        assert_eq!(q.parent_filter(), Some(0));

        let q: GalleryListQuery =
            serde_json::from_value(serde_json::json!({"page": 2, "size": 10, "galleryId": 7}))
                .unwrap();
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 99);
        assert_eq!(q.parent_filter(), Some(7));

        // galleryId < 0 → 不过滤（Java `galleryId >= 0` 才加条件）
        let q: GalleryListQuery =
            serde_json::from_value(serde_json::json!({"galleryId": -1})).unwrap();
        assert_eq!(q.parent_filter(), None);
    }

    #[test]
    fn sort_resolution_matches_base_service_impl() {
        // 缺省：gallerySort ASC
        assert_eq!(resolve_sort(None, None), ("gallery_sort", Some(false)));
        assert_eq!(
            resolve_sort(Some(""), Some("")),
            ("gallery_sort", Some(false))
        );
        // 显式 asc / desc（大小写不敏感）
        assert_eq!(
            resolve_sort(Some("gallerySort"), Some("asc")),
            ("gallery_sort", Some(false))
        );
        assert_eq!(
            resolve_sort(Some("gallerySort"), Some("DESC")),
            ("gallery_sort", Some(true))
        );
        // 主键属性归一到主键列
        assert_eq!(
            resolve_sort(Some("galleryId"), None),
            ("gallery_id", Some(false))
        );
        // 非 asc/desc 值 → Java 不设 ORDER BY
        assert_eq!(
            resolve_sort(Some("galleryName"), Some("weird")),
            ("gallery_name", None)
        );
        // 未知字段回退主键（防注入）
        assert_eq!(
            resolve_sort(Some("name; DROP TABLE x"), Some("asc")),
            ("gallery_id", Some(false))
        );
    }

    #[test]
    fn dto_camel_case_binding() {
        let save: GalleryDTO = serde_json::from_value(serde_json::json!({
            "galleryId": 3,
            "parentId": 0,
            "galleryAdminId": 9,
            "galleryName": "海报",
            "gallerySort": 2,
            "galleryThumb": "t.png",
            "shopId": 1
        }))
        .unwrap();
        assert_eq!(save.gallery_id, Some(3));
        assert_eq!(save.parent_id, Some(0));
        assert_eq!(save.gallery_name.as_deref(), Some("海报"));
        assert_eq!(save.shop_id, Some(1));

        let del: GalleryDelDTO =
            serde_json::from_value(serde_json::json!({"id": 5, "deleteMode": "group_and_files"}))
                .unwrap();
        assert_eq!(del.id, Some(5));
        assert_eq!(del.delete_mode.as_deref(), Some("group_and_files"));

        let dto: serde_json::Value =
            serde_json::to_value(GalleryDTO::from(&gallery(1, 0, "A", 1))).unwrap();
        // 返回结构逐字对齐 Java GalleryDTO 的 camelCase 字段
        assert_eq!(dto["galleryId"], 1);
        assert_eq!(dto["galleryAdminId"], 1);
        assert_eq!(dto["galleryName"], "A");
        assert!(dto.get("vendorId").is_none());
    }

    #[test]
    fn delete_mode_helpers_match_java() {
        assert!(has_delete_mode(Some("group_and_files")));
        assert!(has_delete_mode(Some("only_group")));
        assert!(!has_delete_mode(Some("")));
        assert!(!has_delete_mode(Some("   ")));
        assert!(!has_delete_mode(None));
        assert!(is_delete_files_mode("group_and_files"));
        // Java else 分支：其它任意模式都「只删分组」
        assert!(!is_delete_files_mode("only_group"));
        assert!(!is_delete_files_mode("unknown"));
    }

    #[test]
    fn tree_builds_hierarchy_sorts_and_accumulates_counts() {
        // 根 A(排序2) / B(排序1)；B 下有 B1、B2(排序2)
        let galleries = vec![
            gallery(1, 0, "A", 2),
            gallery(2, 0, "B", 1),
            gallery(3, 2, "B1", 1),
            gallery(4, 2, "B2", 2),
        ];
        let mut counts = HashMap::new();
        counts.insert(1, 5);
        counts.insert(2, 0);
        counts.insert(3, 2);
        counts.insert(4, 3);
        let tree = build_gallery_tree(&galleries, &counts);

        // 根按 gallerySort 升序：B(sort=1) 在 A(sort=2) 前
        assert_eq!(tree.len(), 2);
        assert_eq!(tree[0].id, 2);
        assert_eq!(tree[1].id, 1);
        // B 的子节点按 sort 升序
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].id, 3);
        assert_eq!(tree[0].children[1].id, 4);
        // 子孙累加：B = 0 + 2 + 3 = 5；A 自身 5
        assert_eq!(tree[0].pic_count, 5);
        assert_eq!(tree[1].pic_count, 5);
        // 兼容字段与名称
        assert_eq!(tree[0].gallery_id, 2);
        assert_eq!(tree[0].name, "B");
        assert_eq!(tree[0].sort, 1);
    }

    #[test]
    fn tree_orphan_parent_becomes_root() {
        // 父节点 99 不在结果集 → Java 也把它挂成根节点
        let galleries = vec![gallery(1, 99, "孤儿", 1)];
        let tree = build_gallery_tree(&galleries, &HashMap::new());
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].id, 1);
        assert_eq!(tree[0].children.len(), 0);
    }

    #[test]
    fn tree_serializes_camel_case_and_empty_tree() {
        let tree = GalleryTreeVO {
            records: build_gallery_tree(&[gallery(1, 0, "A", 1)], &HashMap::new()),
        };
        let json = serde_json::to_value(&tree).unwrap();
        assert!(json["records"].is_array());
        let node = &json["records"][0];
        assert_eq!(node["galleryId"], 1);
        assert_eq!(node["galleryName"], "A");
        assert_eq!(node["picCount"], 0);
        assert!(node["children"].is_array());

        let empty = build_gallery_tree(&[], &HashMap::new());
        assert!(empty.is_empty());
    }
}
