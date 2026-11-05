//! 客服人员管理（im::admin_user_kefu）模型层。
//!
//! 对应 Java `AdminUserKefuController`
//! （`java/tigshop-adminapi/.../controller/im/AdminUserKefuController.java`，
//! `@RequestMapping("/adminapi/im/adminUserKefu")`，9 个端点，类级
//! `@PreAuthorize('kefuManageList')`，写操作 `kefuManageModify`）。
//!
//! 数据来源：`admin_user_shop`（店铺员工/客服绑定，主键 `id`）关联
//! `admin_user`（管理员账号）与 `admin_role`（`role_code='kefu_agent'`）。
//!
//! 文案逐字取自 Java 常量：
//! - `AdminUserConstants.USERNAME_IS_EXIST` = 管理员名称已存在或被商户账号占用
//! - `AdminUserConstants.MOBILE_IS_EXIST` = 管理员手机号已经存在
//! - `AdminUserShopConstants.ADMIN_USER_SHOP_NOT_EXIST` = 店铺员工信息不存在
//! - `AdminUserShopConstants.ADMIN_USER_SHOP_NOT_DELETE_SELF` = 不能删除自己

use serde::{Deserialize, Serialize};

/// 客服角色编码（Java `KEFU_AGENT_ROLE_CODE = "kefu_agent"`）。
pub const KEFU_AGENT_ROLE_CODE: &str = "kefu_agent";
/// 管理员名称已存在或被商户账号占用。
pub const MSG_USERNAME_EXIST: &str = "管理员名称已存在或被商户账号占用";
/// 管理员手机号已经存在。
pub const MSG_MOBILE_EXIST: &str = "管理员手机号已经存在";
/// 店铺员工信息不存在。
pub const MSG_BINDING_NOT_EXIST: &str = "店铺员工信息不存在";
/// 不能删除自己。
pub const MSG_NOT_DELETE_SELF: &str = "不能删除自己";
/// 当前店铺不存在客服角色（Java `requireKefuAgentRole` 抛出的错误）。
pub const MSG_KEFU_ROLE_NOT_EXIST: &str = "当前店铺未配置客服角色";

/// 列表查询（Java `AdminUserKefuPageQuery`：分页 + isUsing + 关键字 + 创建时间范围）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserKefuPageQuery {
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
    /// 关键字（管理员名称 / 手机号）
    pub keyword: Option<String>,
    /// 是否启用
    pub is_using: Option<i32>,
    /// 创建时间起（yyyy-MM-dd）
    pub search_start_time: Option<String>,
    /// 创建时间止（yyyy-MM-dd）
    pub search_end_time: Option<String>,
    /// 排序字段（Java `sortField`）
    pub sort_field: Option<String>,
    /// 排序方向（asc/desc）
    pub sort_order: Option<String>,
}

impl AdminUserKefuPageQuery {
    /// 统一分页信封（与其余已迁移 feature 一致：默认 1/15）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: u64::try_from(self.page.unwrap_or(1).max(1)).unwrap_or(1),
            page_size: u64::try_from(self.size.unwrap_or(15).max(1)).unwrap_or(15),
        }
    }

    /// LIMIT/OFFSET。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let p = self.page_query();
        (
            u64::from(p.page_size),
            u64::from(p.page - 1) * u64::from(p.page_size),
        )
    }
}

/// 创建客服（Java `AdminUserKefuCreateDTO`；`shopId`/`authList` 由服务端注入）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserKefuCreateDTO {
    /// 管理员 ID（服务端置空，按手机号复用）
    pub admin_id: Option<i32>,
    /// 手机号
    pub mobile: String,
    /// 邮箱
    pub email: Option<String>,
    /// 是否启用
    pub is_using: Option<i32>,
    /// 角色 ID（服务端改为客服角色）
    pub role_id: Option<i32>,
    /// 头像
    pub avatar: Option<String>,
    /// 管理员名称
    pub username: String,
}

/// 更新客服（Java `AdminUserKefuUpdateDTO`；`id` 为 `admin_user_shop.id`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserKefuUpdateDTO {
    /// 绑定 ID
    pub id: i32,
    /// 管理员 ID（服务端注入）
    pub admin_id: Option<i32>,
    /// 手机号
    pub mobile: String,
    /// 邮箱
    pub email: Option<String>,
    /// 是否启用
    pub is_using: Option<i32>,
    /// 角色 ID
    pub role_id: Option<i32>,
    /// 头像
    pub avatar: Option<String>,
    /// 管理员名称
    pub username: String,
}

/// 通用操作 DTO（Java `OperateDTO`；本 feature 只用 `id`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KefuOperateDTO {
    /// 绑定 ID
    pub id: i32,
}

/// 批量删除 DTO（Java `BatchDTO`，只支持 `type='del'`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KefuBatchDTO {
    /// 绑定 ID 列表
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    #[serde(rename = "type")]
    pub type_: Option<String>,
}

/// 更新字段 DTO（Java `UpdateFieldDTO`；本 feature 仅允许 `isUsing`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KefuUpdateFieldDTO {
    /// 绑定 ID
    pub id: i32,
    /// 字段名
    pub field: String,
    /// 字段值
    #[serde(deserialize_with = "crate::models::serde_helpers::deserialize_stringish")]
    pub val: String,
}

/// 客服角色（Java `KefuRoleSimpleVO`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KefuRoleSimpleVO {
    /// 角色 ID
    pub role_id: i32,
    /// 角色名称
    pub role_name: String,
    /// 角色编码
    pub role_code: String,
    /// 店铺 ID
    pub shop_id: i32,
}

/// 客服人员 VO（Java `AdminUserKefuVO`；`user` 字段对客服场景恒为 null，省略）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserKefuVO {
    /// 绑定 ID
    pub id: i32,
    /// 管理员 ID
    pub admin_id: i32,
    /// 店铺 ID
    pub shop_id: i32,
    /// 管理员名称
    pub username: String,
    /// 邮箱
    pub email: String,
    /// 头像
    pub avatar: String,
    /// 是否启用
    pub is_using: i32,
    /// 角色 ID
    pub role_id: Option<i32>,
    /// 授权列表（Java `JSONArray`，本实现存 JSON 字符串解析后的值）
    pub auth_list: Vec<String>,
    /// 添加时间（yyyy-MM-dd HH:mm:ss）
    pub add_time: String,
    /// 角色名称
    pub role_name: Option<String>,
}

/// 绑定 + 管理员 + 角色名称的联表行。
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AdminUserKefuRow {
    /// 绑定 ID
    pub id: i32,
    /// 管理员 ID
    pub admin_id: i32,
    /// 店铺 ID
    pub shop_id: i32,
    /// 管理员名称（`admin_user_shop.username`）
    pub username: String,
    /// 邮箱
    pub email: String,
    /// 头像
    pub avatar: String,
    /// 是否启用
    pub is_using: i32,
    /// 角色 ID
    pub role_id: Option<i32>,
    /// 授权列表 JSON
    pub auth_list: Option<String>,
    /// 添加时间（秒）
    pub add_time: i32,
    /// 角色名称（LEFT JOIN `admin_role`）
    pub role_name: Option<String>,
}

/// 毫秒/秒时间戳格式化（Java `TigUtils.handelTime`：0 → ""）。
#[must_use]
pub fn format_time(ts: i32) -> String {
    if ts <= 0 {
        return String::new();
    }
    chrono::DateTime::from_timestamp(i64::from(ts), 0)
        .map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_query_defaults() {
        let q: AdminUserKefuPageQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.limit_offset(), (15, 0));
    }

    #[test]
    fn batch_dto_reads_type_keyword() {
        let d: KefuBatchDTO =
            serde_json::from_value(serde_json::json!({"ids":[1,2],"type":"del"})).unwrap();
        assert_eq!(d.ids, vec![1, 2]);
        assert_eq!(d.type_.as_deref(), Some("del"));
    }

    #[test]
    fn time_format_zero_is_empty() {
        assert_eq!(format_time(0), "");
        assert_eq!(format_time(-1), "");
        assert_eq!(format_time(1_733_000_000).len(), 19);
    }
}
