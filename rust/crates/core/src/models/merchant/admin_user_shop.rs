//! 店铺员工域（merchant::admin_user_shop）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.shop.AdminUserShopController`
//!   （`@RequestMapping("/adminapi/merchant/adminUserShop")`，9 个端点）
//! - `com.tigshop.service.shop.impl.AdminUserShopImpl`
//! - DTO：`AdminUserShopPageQuery` / `AdminUserShopCreateDTO` / `AdminUserShopUpdateDTO` /
//!   `AdminUserShopModifyDTO`；VO：`AdminUserShopVO`（含 user/adminUser/role 三个内嵌对象）
//!
//! # 与 Java 的已知差异
//! - Java 用请求头 `x-shop-id`（`HeaderUtils.getShopId()`）确定当前店铺；Rust JWT 未签发
//!   `shop_id`，本实现用查询参数 `shopId` 兜底（与 wave1（brand/authority）一致），缺省时
//!   `list` 返回空页（Java 同样在 shopId==null 时返回空 Page）。
//! - `create` 中的角色可分配校验（`ShopEmployeeRolePolicy#requireAssignableRole`）在 Rust
//!   简化为「角色必须存在」；`merchant_user` 关联、客服生命周期
//!   （`ShopEmployeeRoleLifecycle`）、操作日志、`authList` 权限展开口径见服务层注释。
//! - 北京时间展示统一 `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Java `HttpStatus.SERVICE_DATA_ERROR`。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// Java `AdminUserShopConstants.ADMIN_USER_SHOP_NOT_EXIST`。
pub const ADMIN_USER_SHOP_NOT_EXIST: &str = "店铺员工信息不存在";
/// Java `AdminUserShopConstants.ADMIN_USER_SHOP_NOT_DELETE_SELF`。
pub const ADMIN_USER_SHOP_NOT_DELETE_SELF: &str = "不能删除自己";
/// Java `AdminUserShopConstants.ADMIN_USER_SHOP_ALREADY_EXIST`。
pub const ADMIN_USER_SHOP_ALREADY_EXIST: &str = "此店铺已存在此员工";
/// Java `AdminUserConstants.USERNAME_IS_EXIST`。
pub const USERNAME_IS_EXIST: &str = "管理员名称已存在或被商户账号占用";
/// Java `AdminUserConstants.MOBILE_IS_EXIST`。
pub const MOBILE_IS_EXIST: &str = "管理员手机号已经存在";
/// Java `AdminUserConstants.USER_NOT_EXIST`。
pub const USER_NOT_EXIST: &str = "管理员名称不存在";
/// Java 店铺不存在。
pub const SHOP_NOT_EXIST: &str = "店铺不存在";
/// Java 不能修改登录手机号（已绑定其它店铺）。
pub const MOBILE_LOCKED_BY_OTHER_SHOP: &str = "该账号已绑定其他店铺，不能修改登录手机号";
/// Java 角色不可分配（`ShopEmployeeRolePolicy` 文案未在本特性 Java 源码中；按语义给出可读文案）。
pub const ROLE_NOT_ASSIGNABLE: &str = "角色不存在或不可分配";
/// 员工数上限文案模板（Java：`"店铺员工数已达上限,上限为" + n + "个,如需修改,请前往配置"`）。
#[must_use]
pub fn staff_limit_message(limit: i64) -> String {
    format!("店铺员工数已达上限,上限为{limit}个,如需修改,请前往配置")
}

/// 默认头像（Java `../assets/avatar/{1..34}.jpeg`）。
#[must_use]
pub fn default_avatar(seed: u32) -> String {
    format!("../assets/avatar/{}.jpeg", seed % 34 + 1)
}

/// 统一时间格式（Java `TigUtils.handelTime` 等价格式）。
#[must_use]
pub fn format_time(ts: Option<i32>) -> String {
    let Some(ts) = ts.filter(|t| *t > 0) else {
        return String::new();
    };
    chrono::DateTime::from_timestamp(i64::from(ts), 0)
        .map(|dt| {
            dt.with_timezone(
                &chrono::FixedOffset::east_opt(8 * 3600)
                    .unwrap_or_else(|| chrono::FixedOffset::east_opt(0).expect("utc")),
            )
            .format("%Y-%m-%d %H:%M:%S")
            .to_string()
        })
        .unwrap_or_default()
}

/// 解析权限列表（Java `handleRes`）：
/// 1. 角色存在且 `roleId > 0` → 取角色的 `authority_list`；
/// 2. 否则回退员工自身 `auth_list`（非 `"[]"`）；
/// 3. 否则空数组。
///
/// 返回 JSON 数组。
#[must_use]
pub fn resolve_auth_list(
    role_id: i32,
    role_authority_list: Option<&str>,
    binding_auth_list: Option<&str>,
) -> Value {
    let parse = |s: &str| -> Option<Value> {
        serde_json::from_str::<Value>(s)
            .ok()
            .filter(|v| v.is_array())
    };
    if role_id > 0 {
        if let Some(v) = role_authority_list.and_then(parse) {
            return v;
        }
        return Value::Array(Vec::new());
    }
    binding_auth_list
        .filter(|s| *s != "[]")
        .and_then(parse)
        .unwrap_or_else(|| Value::Array(Vec::new()))
}

/// 员工列表查询（Java `AdminUserShopPageQuery extends BasePage`；实现只用到 `keyword` + 排序）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopPageQuery {
    /// 是否展示（Java 字段，实现未使用）
    pub is_show: Option<i32>,
    /// 用户名（Java 实体字段，实现未使用；实际过滤用 `keyword`）
    pub username: Option<String>,
    /// 关键字（`LIKE admin_user_shop.username`）
    pub keyword: Option<String>,
    /// 当前店铺（Rust 兜底 `x-shop-id` 请求头）
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl AdminUserShopPageQuery {
    /// Java `BasePage` 归一化。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        (
            self.page.unwrap_or(1).max(1),
            self.size.unwrap_or(15).clamp(1, 100),
        )
    }
}

/// 创建员工（Java `AdminUserShopCreateDTO`；`shopId`/`isAdmin`/`merchantId` 由服务端覆盖）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopCreateDTO {
    pub shop_id: Option<i32>,
    pub admin_id: Option<i32>,
    pub is_admin: Option<i32>,
    pub user_id: Option<i32>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub is_using: Option<i32>,
    pub role_id: Option<i32>,
    pub merchant_id: Option<i32>,
    pub avatar: Option<String>,
    pub username: Option<String>,
    pub auth_list: Option<Vec<String>>,
}

/// 更新员工（Java `AdminUserShopUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopUpdateDTO {
    pub id: Option<i32>,
    pub shop_id: Option<i32>,
    pub admin_id: Option<i32>,
    pub is_admin: Option<i32>,
    pub user_id: Option<i32>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub is_using: Option<i32>,
    pub role_id: Option<i32>,
    pub merchant_id: Option<i32>,
    pub avatar: Option<String>,
    pub username: Option<String>,
    pub auth_list: Option<Vec<String>>,
}

/// 修改员工头像/邮箱（Java `AdminUserShopModifyDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopModifyDTO {
    pub id: Option<i32>,
    pub avatar: Option<String>,
    pub email: Option<String>,
    pub admin_id: Option<i32>,
    pub shop_id: Option<i32>,
}

/// 员工 VO（Java `AdminUserShopVO`，内嵌 user / adminUser / role 摘要）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopVO {
    pub id: i32,
    pub admin_id: i32,
    pub user_id: i32,
    pub shop_id: i32,
    pub username: String,
    pub email: String,
    pub avatar: Option<String>,
    pub is_using: i32,
    pub is_admin: i32,
    pub role_id: i32,
    pub auth_list: Value,
    pub add_time: String,
    pub user: Option<Value>,
    pub admin_user: Option<Value>,
    pub role: Option<Value>,
}

/// `isAdmin` 判断（Java `checkIsAdmin`：`is_admin == 1`）。
#[must_use]
pub fn is_admin_flag(binding_is_admin: i32) -> bool {
    binding_is_admin == 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_texts_match_java_constants() {
        assert_eq!(ADMIN_USER_SHOP_NOT_EXIST, "店铺员工信息不存在");
        assert_eq!(ADMIN_USER_SHOP_NOT_DELETE_SELF, "不能删除自己");
        assert_eq!(ADMIN_USER_SHOP_ALREADY_EXIST, "此店铺已存在此员工");
        assert_eq!(USERNAME_IS_EXIST, "管理员名称已存在或被商户账号占用");
        assert_eq!(MOBILE_IS_EXIST, "管理员手机号已经存在");
        assert_eq!(USER_NOT_EXIST, "管理员名称不存在");
        assert_eq!(
            staff_limit_message(5),
            "店铺员工数已达上限,上限为5个,如需修改,请前往配置"
        );
    }

    #[test]
    fn avatar_and_time_helpers_are_stable() {
        assert_eq!(default_avatar(0), "../assets/avatar/1.jpeg");
        assert_eq!(default_avatar(33), "../assets/avatar/34.jpeg");
        assert_eq!(default_avatar(34), "../assets/avatar/1.jpeg");
        assert_eq!(format_time(None), "");
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }

    #[test]
    fn auth_list_resolution_matches_java_handle_res() {
        // 角色优先
        let v = resolve_auth_list(7, Some(r#"["a","b"]"#), Some(r#"["c"]"#));
        assert_eq!(v, serde_json::json!(["a", "b"]));
        // 角色存在但解析失败 → 空数组（Java 置 new JSONArray()）
        assert_eq!(
            resolve_auth_list(7, Some("oops"), None),
            serde_json::json!([])
        );
        // 角色为 0 → 回退员工自身 auth_list（非 "[]"）
        assert_eq!(
            resolve_auth_list(0, None, Some(r#"["x"]"#)),
            serde_json::json!(["x"])
        );
        // 自身也是 "[]" → 空数组
        assert_eq!(
            resolve_auth_list(0, None, Some("[]")),
            serde_json::json!([])
        );
    }

    #[test]
    fn page_params_and_is_admin_flag() {
        assert_eq!(AdminUserShopPageQuery::default().page_params(), (1, 15));
        let q = AdminUserShopPageQuery {
            page: Some(2),
            size: Some(999),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (2, 100));
        assert!(is_admin_flag(1));
        assert!(!is_admin_flag(0));
    }

    #[test]
    fn dto_serde_shapes() {
        let dto: AdminUserShopCreateDTO = serde_json::from_str(
            r#"{"mobile":"138","email":"a@b.c","roleId":3,"authList":["x"],"shopId":9}"#,
        )
        .unwrap();
        assert_eq!(dto.role_id, Some(3));
        assert_eq!(dto.shop_id, Some(9));
        assert_eq!(dto.auth_list, Some(vec!["x".to_string()]));
        let vo = AdminUserShopVO {
            id: 1,
            auth_list: serde_json::json!([]),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["id"], 1);
        assert!(v["authList"].is_array());
    }
}
