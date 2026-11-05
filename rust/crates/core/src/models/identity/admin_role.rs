//! 后台角色域（identity::admin_role）DTO / Query / 领域纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.authority.AdminRoleController`
//!   （`@RequestMapping("/adminapi/authority/adminRole")`）
//! - `com.tigshop.service.authority.impl.AdminRoleServiceImpl`
//! - `com.tigshop.bean.dto.authority.AdminRoleDTO` / `AdminRoleListDTO`
//! - `com.tigshop.bean.dto.common.BatchDTO` / `OperateDTO` / `UpdateFieldDTO`
//! - `com.tigshop.bean.model.authority.AdminRole`（表 `admin_role`）
//! - `com.tigshop.bean.enums.adminuser.AdminTypeEnum` / `o2o.ShopTypeEnum`
//! - `com.tigshop.common.constant.CheckFieldConstants#ROLE_FIELDS`
//!
//! JSON 字段保持 camelCase，与原接口一致。
//!
//! # 与原 Java 的已知差异（均为有意为之，见各处注释）
//!
//! - `AdminRoleDTO.merchantId` / `shopId` 在 Java 里是 `String`，而实体字段是
//!   `Integer`；`BeanUtils.copyProperties` **只拷贝类型可赋值的属性**，因此
//!   Java 的 `list` / `detail` 实际返回的这两个字段**恒为 `null`**。本实现
//!   保持同样的出参形状（恒 `None`），不擅自"修复"。
//! - 本模块的 `OperateDTO` / `BatchDTO` / `UpdateFieldDTO` 与 Java 一样对应
//!   `bean.dto.common` 的共享 DTO；字段取 `Option` 是因为
//!   `AdminRoleController` 的方法参数**没有 `@Valid`**，Java 侧不会触发
//!   Bean Validation，缺字段时是服务层/数据库报错（见服务层注释）。

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;
use crate::{Error, Result};

/// Java `HttpStatus.SERVICE_DATA_ERROR`（`GlobalException(String)` 的默认 code）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// Java `BasePage#getSize()` 的缺省值。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize()` 的上限截断值。
pub const MAX_PAGE_SIZE: u64 = 100;

/// Java `AdminRole` 实体的主键列（`BaseServiceImpl#getKeyColumn()`）。
pub const KEY_COLUMN: &str = "role_id";
/// Java `AdminRole` 实体的主键属性名（`BaseServiceImpl#getKeyProperty()`）。
pub const KEY_PROPERTY: &str = "roleId";

/// Java `AdminRoleConstants.ROLE_NOT_EXIST`。
pub const ROLE_NOT_EXIST: &str = "角色不存在";
/// Java `AdminRoleServiceImpl#update` / `#updateField` 的系统角色保护文案。
pub const SYSTEM_ROLE_CANNOT_MODIFY: &str = "系统内置角色不可修改";
/// Java `AdminRoleServiceImpl#delRole` 的系统角色保护文案。
pub const SYSTEM_ROLE_CANNOT_DELETE: &str = "系统内置角色不可删除";
/// Java `ResultTextConstants.INVALID_FIELD_VALUE`。
pub const INVALID_FIELD_VALUE: &str = "field 的值有误";
/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const UNSELECTED_ITEM: &str = "未选择项目";
/// Java `AdminRoleServiceImpl#list` 中 `switch` 的 `default` 分支。
pub const ADMIN_TYPE_ERROR: &str = "管理员类型错误";
/// Java `AdminRoleServiceImpl#list`（SHOP/STORE/PICKUP 分支）。
pub const SHOP_NOT_EXIST: &str = "店铺不存在";
/// Java `AdminRoleServiceImpl#list`（SHOP/STORE/PICKUP 分支）。
pub const MERCHANT_NOT_EXIST: &str = "商户不存在";

/// `admin_role.is_system == 1`（系统内置角色）。
pub const IS_SYSTEM_YES: i32 = 1;
/// 系统内置客服角色的 `role_code`（`list` 需要排除）。
pub const KEFU_ROLE_CODE: &str = "kefu_agent";

/// Java `CheckFieldConstants.ROLE_FIELDS`（**数据库列名**口径）。
///
/// `BaseServiceImpl#updateField` 先把传入的「属性名或列名」映射成列名，
/// **再**与本白名单比较，故白名单里写的是 `role_name` 而非 `roleName`。
pub const ROLE_FIELDS: [&str; 1] = ["role_name"];

/// `admin_role` 实体「属性名 / 列名 → 列名」映射。
///
/// 逐条来自 Java `bean.model.authority.AdminRole` 的 10 个 `@TableField`
/// 属性（该实体没有 `exist = false` 字段），对应表结构见
/// `java/database/pure.sql`（`CREATE TABLE admin_role`）。
const ADMIN_ROLE_COLUMNS: [(&str, &str); 9] = [
    ("roleName", "role_name"),
    ("roleCode", "role_code"),
    ("roleDesc", "role_desc"),
    ("authorityList", "authority_list"),
    ("adminType", "admin_type"),
    ("merchantId", "merchant_id"),
    ("shopId", "shop_id"),
    ("vendorId", "vendor_id"),
    ("isSystem", "is_system"),
];

/// Java `BaseServiceImpl#getColumnByPropertyName` 的等价实现。
///
/// - 依次接受驼峰属性名与数据库列名（Java `fieldInfo.getProperty()` /
///   `fieldInfo.getColumn()` 双匹配）；
/// - 匹配不到时**回退主键列**（Java 的防 SQL 注入兜底），因此调用方拿到的
///   永远是一个可信列名；是否允许更新由 [`ROLE_FIELDS`] 再判一次。
#[must_use]
pub fn role_field_to_column(field: Option<&str>) -> &'static str {
    let Some(name) = field.filter(|s| !s.is_empty()) else {
        return KEY_COLUMN;
    };
    if name == KEY_PROPERTY || name == KEY_COLUMN {
        return KEY_COLUMN;
    }
    ADMIN_ROLE_COLUMNS
        .iter()
        .find(|(property, column)| *property == name || *column == name)
        .map_or(KEY_COLUMN, |(_, column)| *column)
}

/// 映射后的列是否在 `ROLE_FIELDS` 白名单内（`updateField` 专用）。
#[must_use]
pub fn is_role_field_allowed(column: &str) -> bool {
    ROLE_FIELDS.contains(&column)
}

/// 后台账号类型（Java `AdminTypeEnum`）。
///
/// 顺序与 code 均与 Java 枚举一致；`code()` 是落库/比较口径。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdminType {
    /// 平台（`"admin"`）
    Admin,
    /// 店铺（`"shop"`）
    Shop,
    /// 供应商（`"vendor"`）
    Vendor,
    /// 门店（`"store"`）
    Store,
    /// 自提点（`"pickup"`）
    Pickup,
    /// 收银台（`"pos"`）
    Pos,
}

impl AdminType {
    /// Java `AdminTypeEnum#fromCode`：大小写敏感，未知值抛
    /// `IllegalArgumentException("无效 adminType: " + code)`。
    ///
    /// # Errors
    /// 未知/缺失 `adminType` → `Error::biz(1001, "无效 adminType: …")`
    /// （Java 由 `GlobalExceptionHandler#handleException` 兜成 code 1001）。
    pub fn from_code(code: Option<&str>) -> Result<Self> {
        match code {
            Some("admin") => Ok(Self::Admin),
            Some("shop") => Ok(Self::Shop),
            Some("vendor") => Ok(Self::Vendor),
            Some("store") => Ok(Self::Store),
            Some("pickup") => Ok(Self::Pickup),
            Some("pos") => Ok(Self::Pos),
            Some(other) => Err(Error::biz(
                SERVICE_DATA_ERROR,
                format!("无效 adminType: {other}"),
            )),
            None => Err(Error::biz(SERVICE_DATA_ERROR, "无效 adminType: null")),
        }
    }

    /// 枚举 code（`AdminTypeEnum.getCode()`）。
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Shop => "shop",
            Self::Vendor => "vendor",
            Self::Store => "store",
            Self::Pickup => "pickup",
            Self::Pos => "pos",
        }
    }

    /// Java `AdminTypeEnum#resolveCodeByShopType`。
    ///
    /// `shop_type`：1 店铺 / 2 门店 / 3 自提点（`ShopTypeEnum`）；其余（含
    /// `null`）一律回 `shop`。
    #[must_use]
    pub fn from_shop_type(shop_type: Option<i32>) -> Self {
        match shop_type {
            Some(2) => Self::Store,
            Some(3) => Self::Pickup,
            _ => Self::Shop,
        }
    }
}

/// 当前请求的租户视角（Java `BaseServiceImpl#getAdminType/getShopId/getVendorId`）。
///
/// Java 全部来自请求头：`x-admin-type` / `x-shop-id` / `x-vendor-id`，
/// 且带**按类型选择性读取**的语义（见 API 层 `resolve_scope`）：
/// - `admin` → `shopId` 恒为 0（忽略 `x-shop-id`）；
/// - `shop` / `pos` → 读 `x-shop-id`；
/// - `vendor` → 读 `x-vendor-id`；
/// - 其余 → 两个 ID 都是 `None`。
#[derive(Debug, Clone, Default)]
pub struct AdminRoleScope {
    /// 当前登录管理员 ID（仅用于日志，不参与 SQL）
    pub admin_id: i32,
    /// 账号类型（`x-admin-type` / JWT `typ`）
    pub admin_type: Option<String>,
    /// 店铺 ID（Java `HeaderUtils#getShopId()`）
    pub shop_id: Option<i32>,
    /// 供应商 ID（Java `HeaderUtils#getVendorId()`）
    pub vendor_id: Option<i32>,
}

/// `admin_role` 列表的租户可见性（`AdminRoleServiceImpl#list` 的
/// `switch (adminTypeEnum)` 结果）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoleVisibility {
    /// `shop_id = {shop_id} AND admin_type = 'admin'`
    Admin {
        /// Java `getShopId()`，平台账号恒 0
        shop_id: i32,
    },
    /// 店铺 / 门店 / 自提点分支：
    /// `merchant_id > 0` 时为 `((merchant_id = m AND shop_id = 0) OR shop_id = s)`，
    /// 否则为 `shop_id = s`
    Shop {
        /// 当前店铺 ID
        shop_id: i32,
        /// 当前店铺所属商户 ID（`shop.merchant_id > 0` 时才有值）
        merchant_id: Option<i32>,
    },
    /// `vendor_id = {vendor_id} AND admin_type = 'vendor'`
    Vendor {
        /// Java `getVendorId()`；`None` 等价于 `eq(column, null)`，查不到任何行
        vendor_id: Option<i32>,
    },
}

/// `shop` 表的租户解析结果（`AdminRoleServiceImpl#list` / `#isShopRoleAccessible`
/// 用的 `shopMapper.selectById` 三列）。
#[derive(Debug, Clone, Default)]
pub struct ShopScope {
    /// `shop.shop_id`
    pub shop_id: i32,
    /// `shop.merchant_id`
    pub merchant_id: Option<i32>,
    /// `shop.shop_type`（1 店铺 / 2 门店 / 3 自提点）
    pub shop_type: Option<i32>,
}

/// 角色 DTO（Java `AdminRoleDTO`，同时是 `list` / `detail` 的出参）。
///
/// `merchantId` / `shopId` 在 Java 出参里恒为 `null`（`Integer` → `String`
/// 的 `BeanUtils.copyProperties` 类型不匹配被跳过），这里保持同形。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminRoleDTO {
    /// 角色 ID
    pub role_id: Option<i32>,
    /// 名称
    pub role_name: Option<String>,
    /// 描述
    pub role_desc: Option<String>,
    /// 权限（实体里是 JSON 文本，DTO 里是字符串数组）
    pub authority_list: Option<Vec<String>>,
    /// `admin_type`
    pub admin_type: Option<String>,
    /// `merchant_id`（Java 出参恒 `null`，见类型注释）
    pub merchant_id: Option<String>,
    /// `shop_id`（Java 出参恒 `null`，见类型注释）
    pub shop_id: Option<String>,
    /// 是否系统内置角色 0-否 1-是
    pub is_system: Option<i32>,
}

/// 角色列表查询参数（Java `AdminRoleListDTO extends BasePage`）。
///
/// `AdminRoleListDTO` 本身是**空类**，全部条件来自 `BasePage`：
/// `page` / `size` / `sortField` / `sortOrder` / `keyword`。
/// `BasePage.sortItems` 未被 `AdminRoleServiceImpl#list` 使用
/// （它调用的是 `buildSortOrder(page, sortField, sortOrder)` 三参重载），
/// 故不建模。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminRoleListQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段（属性名或列名，未知值回退主键）
    pub sort_field: Option<String>,
    /// 排序方向 `asc` / `desc`（空串等价 `desc`，其它值不排序）
    pub sort_order: Option<String>,
    /// 关键词（`role_name LIKE` 或 `role_desc LIKE`）
    pub keyword: Option<String>,
    /// **Rust 侧替代请求头** `x-admin-type` 的查询参数（仅在请求头与 JWT
    /// 都没有 `adminType` 时兜底）。
    pub admin_type: Option<String>,
    /// **Rust 侧替代请求头** `x-shop-id` 的查询参数。
    pub shop_id: Option<i32>,
    /// **Rust 侧替代请求头** `x-vendor-id` 的查询参数。
    pub vendor_id: Option<i32>,
}

impl AdminRoleListQuery {
    /// 归一化后的 `(page, size)`（Java `BasePage#getPage` / `#getSize`）。
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

    /// 转成通用 [`PageQuery`]（用于 `PageResult::new` 与仓储分页）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }
}

/// 删除 / 单条操作入参（Java `bean.dto.common.OperateDTO`）。
///
/// Java 控制器参数**没有 `@Valid`**，故 `id` 缺失时不会在绑定阶段报错，
/// 而是进入 `delRole(null)` → `ROLE_NOT_EXIST`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// id
    pub id: Option<i32>,
    /// 备注（本域未使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域未使用）
    pub page_type: Option<i32>,
}

/// 批量操作入参（Java `bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// ids
    pub ids: Option<Vec<i32>>,
    /// 操作类型（本域仅支持 `del`）
    pub r#type: Option<String>,
    /// 值（本域未使用）
    pub value: Option<i32>,
    /// 数据（本域未使用）
    pub data: Option<serde_json::Value>,
}

/// 单字段更新入参（Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名（属性名或列名）
    pub field: Option<String>,
    /// 值（Java 为 `String`，由 MySQL 隐式转换到目标列类型）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 实体 `authority_list`（JSON 文本）→ DTO 的 `Vec<String>`。
///
/// 对应 Java `JSONUtil.toList(adminRole.getAuthorityList(), String.class)`。
///
/// - 空串 / `"null"`（Java `JSONUtil.toJsonStr(null)` 的产物）→ 空列表；
/// - 其它按 JSON 字符串数组解析。
///
/// # Errors
/// 非法 JSON / 非字符串数组 → `Error::biz(1001, …)`，与 Java 抛
/// `JSONException` 后由全局异常处理器兜成 1001 的行为一致。
pub fn authority_list_from_json(raw: &str) -> Result<Vec<String>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<String>>(trimmed)
        .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("权限列表 JSON 解析失败: {e}")))
}

/// DTO 的 `Vec<String>` → 实体 `authority_list`（JSON 文本）。
///
/// 对应 Java `JSONUtil.toJsonStr(dto.getAuthorityList())`：
/// - `None` → 字面量 `"null"`（**不是** SQL NULL；Java 的 hutool 就是返回
///   `"null"` 字符串，而 `authority_list` 列是 `NOT NULL`，所以必须如此）；
/// - `Some([])` → `"[]"`；
/// - 其余 → 紧凑 JSON 数组（与 hutool 一样不带空格）。
#[must_use]
pub fn authority_list_to_json(list: Option<&[String]>) -> String {
    match list {
        None => "null".to_string(),
        Some(items) => serde_json::to_string(items).unwrap_or_else(|_| "null".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_type_from_code_matches_java_enum() {
        assert_eq!(
            AdminType::from_code(Some("admin")).unwrap(),
            AdminType::Admin
        );
        assert_eq!(AdminType::from_code(Some("shop")).unwrap(), AdminType::Shop);
        assert_eq!(
            AdminType::from_code(Some("vendor")).unwrap(),
            AdminType::Vendor
        );
        assert_eq!(
            AdminType::from_code(Some("store")).unwrap(),
            AdminType::Store
        );
        assert_eq!(
            AdminType::from_code(Some("pickup")).unwrap(),
            AdminType::Pickup
        );
        assert_eq!(AdminType::from_code(Some("pos")).unwrap(), AdminType::Pos);
        // code 大小写敏感（Java `type.getCode().equals(code)`）
        assert!(AdminType::from_code(Some("Admin")).is_err());
        assert!(AdminType::from_code(Some("")).is_err());
        let err = AdminType::from_code(None).unwrap_err();
        assert!(err.to_string().contains("无效 adminType: null"));
    }

    #[test]
    fn admin_type_codes_round_trip() {
        for (code, ty) in [
            ("admin", AdminType::Admin),
            ("shop", AdminType::Shop),
            ("vendor", AdminType::Vendor),
            ("store", AdminType::Store),
            ("pickup", AdminType::Pickup),
            ("pos", AdminType::Pos),
        ] {
            assert_eq!(AdminType::from_code(Some(code)).unwrap(), ty);
            assert_eq!(ty.code(), code);
        }
    }

    #[test]
    fn shop_type_resolution_matches_java() {
        // ShopTypeEnum: SHOP(1) STORE(2) PICKUP(3)；null/其它 → shop
        assert_eq!(AdminType::from_shop_type(Some(1)), AdminType::Shop);
        assert_eq!(AdminType::from_shop_type(Some(2)), AdminType::Store);
        assert_eq!(AdminType::from_shop_type(Some(3)), AdminType::Pickup);
        assert_eq!(AdminType::from_shop_type(Some(9)), AdminType::Shop);
        assert_eq!(AdminType::from_shop_type(None), AdminType::Shop);
    }

    #[test]
    fn list_query_page_params_follow_base_page() {
        let q = AdminRoleListQuery::default();
        assert_eq!(q.page_params(), (1, 15));
        assert_eq!(q.limit_offset(), (15, 0));

        let q = AdminRoleListQuery {
            page: Some(0),
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (1, 1));

        let q = AdminRoleListQuery {
            page: Some(3),
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (3, 100));
        assert_eq!(q.limit_offset(), (100, 200));
        assert_eq!(q.page_query().page, 3);
        assert_eq!(q.page_query().page_size, 100);
    }

    #[test]
    fn list_query_accepts_java_size_and_pagesize_alias() {
        let q: AdminRoleListQuery =
            serde_json::from_str(r#"{"page":2,"size":30,"sortOrder":"asc","keyword":"客服"}"#)
                .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));
        assert_eq!(q.sort_order.as_deref(), Some("asc"));
        assert_eq!(q.keyword.as_deref(), Some("客服"));

        // 前端有的页面用 pageSize；作为别名接受
        let q: AdminRoleListQuery = serde_json::from_str(r#"{"pageSize":20}"#).unwrap();
        assert_eq!(q.size, Some(20));
        // 全缺省
        let q: AdminRoleListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.page_params(), (1, 15));
    }

    #[test]
    fn role_dto_parses_camel_case() {
        let dto: AdminRoleDTO = serde_json::from_str(
            r#"{"roleId":7,"roleName":"店长","roleDesc":"d",
                "authorityList":["a","b"],"adminType":"shop","isSystem":0}"#,
        )
        .unwrap();
        assert_eq!(dto.role_id, Some(7));
        assert_eq!(dto.role_name.as_deref(), Some("店长"));
        assert_eq!(
            dto.authority_list,
            Some(vec!["a".to_string(), "b".to_string()])
        );
        assert_eq!(dto.admin_type.as_deref(), Some("shop"));
        assert_eq!(dto.is_system, Some(0));
    }

    #[test]
    fn role_dto_serializes_java_null_quirks() {
        // Java: merchantId / shopId 是 String，实体是 Integer，BeanUtils 跳过
        // → 出参恒 null。这里保证同样的形状（字段存在且为 null）。
        let dto = AdminRoleDTO {
            role_id: Some(1),
            role_name: Some("平台超级管理员".into()),
            ..Default::default()
        };
        let v = serde_json::to_value(&dto).unwrap();
        assert_eq!(v["roleId"], 1);
        assert_eq!(v["roleName"], "平台超级管理员");
        assert!(v.get("merchantId").is_some());
        assert!(v["merchantId"].is_null());
        assert!(v["shopId"].is_null());
        assert!(v["authorityList"].is_null());
    }

    #[test]
    fn authority_list_json_round_trip_matches_hutool() {
        // Java `JSONUtil.toJsonStr(null)` → "null"（字符串），列是 NOT NULL
        assert_eq!(authority_list_to_json(None), "null");
        assert_eq!(authority_list_to_json(Some(&[])), "[]");
        let items = vec!["all".to_string(), "posCheckout".to_string()];
        assert_eq!(
            authority_list_to_json(Some(&items)),
            r#"["all","posCheckout"]"#
        );

        assert_eq!(
            authority_list_from_json("null").unwrap(),
            Vec::<String>::new()
        );
        assert_eq!(authority_list_from_json("").unwrap(), Vec::<String>::new());
        assert_eq!(
            authority_list_from_json("[]").unwrap(),
            Vec::<String>::new()
        );
        assert_eq!(authority_list_from_json(r#"["a"]"#).unwrap(), vec!["a"]);
        // 种子数据里的转义写法
        assert_eq!(authority_list_from_json(r#"["all"]"#).unwrap(), vec!["all"]);
        assert!(authority_list_from_json("{oops").is_err());
        assert!(authority_list_from_json("[1,2]").is_err());
    }

    #[test]
    fn role_field_mapping_matches_get_column_by_property_name() {
        // 属性名
        assert_eq!(role_field_to_column(Some("roleName")), "role_name");
        assert_eq!(role_field_to_column(Some("roleDesc")), "role_desc");
        assert_eq!(
            role_field_to_column(Some("authorityList")),
            "authority_list"
        );
        assert_eq!(role_field_to_column(Some("adminType")), "admin_type");
        assert_eq!(role_field_to_column(Some("merchantId")), "merchant_id");
        assert_eq!(role_field_to_column(Some("shopId")), "shop_id");
        assert_eq!(role_field_to_column(Some("vendorId")), "vendor_id");
        assert_eq!(role_field_to_column(Some("isSystem")), "is_system");
        // 列名同样接受（Java 兼容传入数据库字段）
        assert_eq!(role_field_to_column(Some("role_name")), "role_name");
        assert_eq!(role_field_to_column(Some("role_id")), "role_id");
        assert_eq!(role_field_to_column(Some("roleId")), "role_id");
        // 未知 / 空 → 主键列（防注入兜底）
        assert_eq!(
            role_field_to_column(Some("role_name; DROP TABLE admin_role")),
            "role_id"
        );
        assert_eq!(role_field_to_column(Some("")), "role_id");
        assert_eq!(role_field_to_column(None), "role_id");
    }

    #[test]
    fn role_fields_allow_list_contains_only_role_name() {
        // CheckFieldConstants.ROLE_FIELDS = {"role_name"}
        assert_eq!(ROLE_FIELDS, ["role_name"]);
        assert!(is_role_field_allowed(&role_field_to_column(Some(
            "roleName"
        ))));
        assert!(is_role_field_allowed("role_name"));
        // 其它列被映射出来但不在白名单
        assert!(!is_role_field_allowed(&role_field_to_column(Some(
            "roleDesc"
        ))));
        assert!(!is_role_field_allowed(&role_field_to_column(Some(
            "isSystem"
        ))));
        assert!(!is_role_field_allowed(&role_field_to_column(Some("nope"))));
    }

    #[test]
    fn common_dtos_accept_minimal_payloads() {
        let o: OperateDTO = serde_json::from_str(r#"{"id":9}"#).unwrap();
        assert_eq!(o.id, Some(9));
        let o: OperateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(o.id, None);

        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.r#type.as_deref(), Some("del"));
        assert_eq!(b.ids, Some(vec![1, 2]));

        let u: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":3,"field":"roleName","val":"x"}"#).unwrap();
        assert_eq!(u.field.as_deref(), Some("roleName"));
        assert_eq!(u.val.as_deref(), Some("x"));
    }
}
