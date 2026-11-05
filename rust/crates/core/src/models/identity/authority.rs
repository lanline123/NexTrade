//! 权限管理域（identity::authority）DTO / VO。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.authority.AuthorityDTO` / `AuthorityListDTO` / `AuthorityChildDTO`
//! - `com.tigshop.bean.dto.common.BatchDTO` / `OperateDTO` / `UpdateFieldDTO`
//! - `com.tigshop.bean.vo.authority.AuthorityVO`
//! - `com.tigshop.bean.vo.authority.ChildAuthVO` / `AuthorityItemVO`
//! - `cn.hutool.core.lang.tree.Tree`（树形返回）
//!
//! JSON 字段名保持与原接口 camelCase 一致（serde `rename`）。
//!
//! 说明：本文件名沿用项目既有切片约定 `sliceNNN.rs`（`product_manage` / `order_admin` /
//! `brand` 同），因为 Rust 模块标识符不允许连字符，`identity::authority.rs`
//! 无法用 `pub mod authority;` 声明。

use serde::{Deserialize, Serialize};

/// 子权限（Java `AuthorityChildDTO` / `ChildAuthVO`）。
///
/// `authority.child_auth` 列存的是 `[{"authName":..,"authSn":..}]` JSON 文本。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AuthorityChildDTO {
    /// 权限名称（兼容历史 snake_case 数据）
    #[serde(alias = "auth_name")]
    pub auth_name: Option<String>,
    /// 权限编号（兼容历史 snake_case 数据）
    #[serde(alias = "auth_sn")]
    pub auth_sn: Option<String>,
}

/// 权限入参 / 出参（Java `AuthorityDTO`）。
///
/// Java 校验：`authoritySn` 非空、`authorityName` 非空且长度 1–30。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AuthorityDTO {
    /// 自增id号（`create` 时忽略；`update` 必填）
    pub authority_id: Option<i32>,
    /// 权限编号
    pub authority_sn: Option<String>,
    /// 权限名称
    pub authority_name: Option<String>,
    /// 该权限的父类ID
    pub parent_id: Option<i32>,
    /// 该权限在目录显示的顺序
    pub sort_order: Option<i32>,
    /// 是否有子菜单（Java 为子级**数量**，非布尔）
    pub has_children: Option<i64>,
    /// 是否在目录显示 1显示; 0不显示
    pub is_show: Option<i32>,
    /// JSON:子权限
    pub child_auth: Option<Vec<AuthorityChildDTO>>,
    /// 路由链接
    pub route_link: Option<String>,
    /// ICO图标
    pub authority_ico: Option<String>,
    /// 是否系统目录
    pub is_system: Option<i32>,
    /// admin管理后台使用 shop店铺使用
    pub admin_type: Option<String>,
}

/// 权限列表查询参数（Java `AuthorityListDTO extends BasePage`）。
///
/// `BasePage` 默认 `page = 1`、`size = 15`（`size` 上限 100）；
/// 排序默认「主键降序」（`sortField` 为空时）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AuthorityListQuery {
    pub admin_type: Option<String>,
    pub parent_id: Option<i32>,
    /// 当前页码（Java `page`），缺省 1
    pub page: Option<u64>,
    /// 分页大小（Java `size`），缺省 15，上限 100
    pub size: Option<u64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向 `asc` / `desc`
    pub sort_order: Option<String>,
    /// 关键词（`AuthorityListDTO` 未使用；保留以兼容 BasePage 入参）
    pub keyword: Option<String>,
}

/// Java `BasePage` 缺省分页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage.getSize()` 的上限截断值。
pub const MAX_PAGE_SIZE: u64 = 100;

impl AuthorityListQuery {
    /// 归一化后的 `(page, size)`（Java `BasePage#getPage` / `getSize`）。
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
}

/// 树节点（Java `cn.hutool.core.lang.tree.Tree<Integer>` +
/// `TreeUtil.build(..., TreeNodeConfig{idKey:"authorityId", parentIdKey:"parentId",
/// nameKey:"authorityName", weightKey:"sortOrder", deep:5})` 的 `putExtra` 集合）。
///
/// Hutool 的 `Tree` 是 `LinkedHashMap` 子类：默认键 `id` / `parentId` / `name` /
/// `weight` / `children` 与 `putExtra` 写入的业务键**在同一层**平铺。
/// Rust 侧用 `#[serde(flatten)] extra` 复刻该平铺结构。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuthorityTreeNode {
    /// Hutool 默认 id 键（`authorityId`）
    pub id: i32,
    /// Hutool 名称键（`authorityName`）
    pub name: String,
    /// Hutool 权重键（`sortOrder`）
    pub weight: i32,
    /// 子节点（深度上限 5，与 Java `config.setDeep(5)` 一致）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<AuthorityTreeNode>>,
    /// `putExtra` 写入的业务字段：`authorityId` / `parentId` / `authorityName` /
    /// `sortOrder` / `isShow` / `childAuth` / `routeLink` / `authorityIco` / `authoritySn`
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// `GET /getAuthority` 返回项（Java 直接返回 `Authority` 实体，camelCase 序列化）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorityVO {
    pub authority_id: i32,
    pub authority_sn: String,
    pub authority_name: String,
    pub parent_id: i32,
    pub sort_order: i32,
    pub is_show: i32,
    /// 原始 JSON 文本（Java 侧为 `String`，未反序列化）
    pub child_auth: Option<String>,
    pub route_link: String,
    pub authority_ico: String,
    pub is_system: i32,
    pub admin_type: String,
}

/// `getAllAuthority` / `getAuthority` 的调用方上下文。
///
/// Java 由 Spring Security `Authentication`（权限项）+ Redis 缓存的 `AdminUser`
/// + 请求头 `x-admin-type` / `x-shop-id` / `x-vendor-id` 共同决定；
/// Rust 对应物见 `tigshop_security::web::AuthUser` 与 `authority` 路由层。
#[derive(Debug, Clone, Default)]
pub struct AuthorityContext {
    /// 当前登录管理员ID（`admin_user.admin_id`）
    pub admin_id: i32,
    /// 账号类型（`admin` / `shop` / `store` / `pickup` / `vendor` / `suppliers`）
    pub admin_type: Option<String>,
    /// 当前请求选定的店铺ID（Java `HeaderUtils.getShopId()`），0 或 None 表示平台视角
    pub shop_id: Option<i32>,
    /// 当前请求选定的供应商ID（Java `HeaderUtils.getVendorId()`）
    pub vendor_id: Option<i32>,
    /// 当前账号被授予的权限编号（Spring Security `GrantedAuthority`）；
    /// 含 `all` 表示不受限
    pub granted: Vec<String>,
}

/// 通用批量操作（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// ids
    pub ids: Vec<i32>,
    /// 操作类型（`del` 走批量删除）
    pub r#type: String,
    /// 值
    pub value: i32,
    /// 数据
    pub data: Option<serde_json::Value>,
}

/// 删除 / 单条操作入参（Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// id
    pub id: i32,
    /// 备注
    pub admin_note: Option<String>,
    /// 页面类型
    pub page_type: Option<i32>,
}

/// 单字段更新入参（Java `UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: i32,
    /// 字段名（属性名或列名）
    pub field: String,
    /// 值（Java 为 `String`，由 MySQL 隐式转换到目标列类型）
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_stringish")]
    pub val: String,
}

/// `authority` 属性名 / 列名 → 列名。
///
/// 对应 Java `BaseServiceImpl#getColumnByPropertyName`（先匹配
/// `@TableField` 列名，再匹配驼峰属性名；都匹配不到则回退主键列）。
#[must_use]
pub fn authority_field_to_column(name: &str) -> Option<&'static str> {
    Some(match name {
        "authorityId" | "authority_id" => "authority_id",
        "authoritySn" | "authority_sn" => "authority_sn",
        "authorityName" | "authority_name" => "authority_name",
        "parentId" | "parent_id" => "parent_id",
        "sortOrder" | "sort_order" => "sort_order",
        "isShow" | "is_show" => "is_show",
        "childAuth" | "child_auth" => "child_auth",
        "routeLink" | "route_link" => "route_link",
        "authorityIco" | "authority_ico" => "authority_ico",
        "isSystem" | "is_system" => "is_system",
        "adminType" | "admin_type" => "admin_type",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_params_follow_java_base_page() {
        let q = AuthorityListQuery::default();
        assert_eq!(q.page_params(), (1, 15));

        let q = AuthorityListQuery {
            page: Some(0),
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (1, 1));

        let q = AuthorityListQuery {
            page: Some(3),
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (3, 100));
        assert_eq!(q.limit_offset(), (100, 200));
    }

    #[test]
    fn dto_accepts_camel_case_and_defaults() {
        let dto: AuthorityDTO = serde_json::from_str(
            r#"{"authoritySn":"a","authorityName":"A","parentId":0,
                "childAuth":[{"authName":"x","authSn":"y"}]}"#,
        )
        .unwrap();
        assert_eq!(dto.authority_sn.as_deref(), Some("a"));
        assert_eq!(dto.parent_id, Some(0));
        assert_eq!(dto.authority_id, None);
        assert_eq!(
            dto.child_auth,
            Some(vec![AuthorityChildDTO {
                auth_name: Some("x".into()),
                auth_sn: Some("y".into())
            }])
        );
    }

    #[test]
    fn batch_dto_type_field_maps_to_java_type() {
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.r#type, "del");
        assert_eq!(b.ids, vec![1, 2]);
    }

    #[test]
    fn tree_node_flattens_extra() {
        let mut extra = serde_json::Map::new();
        extra.insert("authoritySn".into(), serde_json::json!("dashboard"));
        let node = AuthorityTreeNode {
            id: 5,
            name: "仪表盘".into(),
            weight: 1,
            children: None,
            extra,
        };
        let v = serde_json::to_value(&node).unwrap();
        assert_eq!(v["id"], 5);
        assert_eq!(v["name"], "仪表盘");
        assert_eq!(v["weight"], 1);
        assert_eq!(v["authoritySn"], "dashboard");
        assert!(v.get("children").is_none());
    }

    #[test]
    fn authority_child_dto_accepts_camel_and_snake_case() {
        let camel: Vec<AuthorityChildDTO> =
            serde_json::from_str(r#"[{"authName":"编辑","authSn":"refundApplyUpdateManage"}]"#)
                .unwrap();
        assert_eq!(camel[0].auth_name.as_deref(), Some("编辑"));
        assert_eq!(camel[0].auth_sn.as_deref(), Some("refundApplyUpdateManage"));

        let snake: Vec<AuthorityChildDTO> =
            serde_json::from_str(r#"[{"auth_name":"编辑","auth_sn":"userInvoiceUpdateManage"}]"#)
                .unwrap();
        assert_eq!(snake[0].auth_name.as_deref(), Some("编辑"));
        assert_eq!(snake[0].auth_sn.as_deref(), Some("userInvoiceUpdateManage"));
    }

    #[test]
    fn field_to_column_matches_java_property_lookup() {
        assert_eq!(
            authority_field_to_column("authoritySn"),
            Some("authority_sn")
        );
        assert_eq!(
            authority_field_to_column("authority_sn"),
            Some("authority_sn")
        );
        assert_eq!(authority_field_to_column("nope"), None);
    }
}
