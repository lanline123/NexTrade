//! 管理员列表域（identity::admin_user）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.authority.AdminUserDTO`
//! - `com.tigshop.bean.dto.authority.AdminUserModifyManageAccountsDTO`
//! - `com.tigshop.bean.dto.authority.AdminApiTokenGenerateDTO`
//! - `com.tigshop.bean.vo.authority.AdminApiTokenGenerateVO` / `AdminApiTokenVO`
//! - `com.tigshop.bean.dto.common.BatchDTO` / `OperateDTO`（本域自持副本）
//! - `com.tigshop.bean.model.authority.AdminRole`（`config` 端点返回实体）
//!
//! JSON 字段全部保持 camelCase，与原接口一致（`#[serde(rename_all = "camelCase")]`）。
//!
//! **说明（为什么本文件自带 `BatchDTO` / `OperateDTO` 副本）**：
//! `models::authority` 里也有同结构体，但那是 identity::authority 的独占文件，跨切片引用
//! 会把两个切片的编译期耦合在一起；`order_admin` 等切片同样选择在本域自持 DTO。
//! 字段与 Java `BatchDTO` / `OperateDTO` 逐字段一致。
//!
//! **说明（文件名）**：模块标识符不允许连字符，故用 `admin_user.rs`
//! （`pub mod admin_user;`），与 `product_manage` / `order_admin` / `aftersales` … 的既有约定相同。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 账号类型常量（Java `AdminTypeEnum`）
// ——————————————————————————————————————————————

/// 账号类型常量（Java `com.tigshop.bean.enums.adminuser.AdminTypeEnum`）。
pub mod admin_type {
    /// 平台管理后台（`AdminTypeEnum.ADMIN`）
    pub const ADMIN: &str = "admin";
    /// 店铺（`AdminTypeEnum.SHOP`）
    pub const SHOP: &str = "shop";
    /// 供应商（`AdminTypeEnum.VENDOR`）
    pub const VENDOR: &str = "vendor";
    /// 门店（`AdminTypeEnum.STORE`）
    pub const STORE: &str = "store";
    /// 自提点（`AdminTypeEnum.PICKUP`）
    pub const PICKUP: &str = "pickup";
    /// 收银台（`AdminTypeEnum.POS`）
    pub const POS: &str = "pos";
    /// 供应商（旧数据里 `admin_user.admin_type` 的另一写法，见
    /// `AdminUserServiceImpl#list` 的 `admin,suppliers` 默认口径）
    pub const SUPPLIERS: &str = "suppliers";
}

/// 「普通角色」过滤掉的系统角色编号（Java
/// `AdminUserServiceImpl#listOrdinaryRoles`：`notIn("pos_cashier", "kefu_agent")`）。
pub const EXCLUDED_ROLE_CODES: [&str; 2] = ["pos_cashier", "kefu_agent"];

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 管理员账号信息（Java `AdminUserDTO`，作为 `detail` / `create` / `update` 出入参）。
///
/// **`password` 仅作入参**：Java `list` 直接 `BeanUtils.copyProperties` 会把
/// `password` 一起下发，`detail` 则显式 `setPassword(null)`。Rust 侧该字段带
/// `skip_serializing`，两处都不下发密码哈希（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserDTO {
    /// 自增id号（`update` 必填；`create` 忽略）
    pub admin_id: Option<i32>,
    /// 管理员登录名
    pub username: Option<String>,
    /// 管理员类型，admin:管理员，shop:店铺，suppliers:供应商，vendor:供货商
    pub admin_type: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 头像
    pub avatar: Option<String>,
    /// 管理员登录密码（Java `AdminUserDTO.password`，仅 `create` / `update` 入参；
    /// `skip_serializing` 保证出参永不下发密码哈希）
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// 管理员邮箱
    pub email: Option<String>,
    /// 管理员添加时间（Java `@JsonSerialize(TimestampToDateSerializer)`，
    /// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`）
    pub add_time: Option<String>,
    /// [JSON]管理员管理权限列表
    pub auth_list: Option<Vec<String>>,
    /// 绑定的会员id
    pub user_id: Option<i32>,
    /// 供应商id
    pub suppliers_id: Option<i32>,
    /// 角色id
    pub role_id: Option<i32>,
    /// 角色名称（`detail` / `list` 由角色表回填）
    pub role_name: Option<String>,
    /// 商户id
    pub merchant_id: Option<i32>,
    /// 父管理员id，表明当前为子管理员
    pub parent_id: Option<i32>,
    /// [JSON]店铺存的标签
    pub menu_tag: Option<String>,
    /// [JSON]订单导出存的标签
    pub order_export: Option<String>,
    /// [JSON]扩展信息
    pub extra: Option<String>,
    /// 店铺id
    pub shop_id: Option<i32>,
    /// 是否停用：1 是 0 否
    pub is_using: Option<i32>,
    /// 旧密码（仅 `create` / `update` 入参使用）
    pub old_password: Option<String>,
    /// 确认密码（仅入参使用）
    pub pwd_confirm: Option<String>,
    /// 初始密码（仅入参使用）
    pub initial_password: Option<String>,
    /// 店铺绑定（`detail` 填充，Java `AdminUserDTO.userShop`）
    pub user_shop: Option<Vec<UserShopDTO>>,
    /// 供应商绑定（本切片不填充，保留字段以对齐 Java 出参骨架）
    pub user_vendor: Option<Vec<serde_json::Value>>,
}

/// 店铺绑定包装（Java `AdminUserDTO.UserShopDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserShopDTO {
    pub shop: Option<AdminUserShopVO>,
}

/// `detail` 端点回传的店铺信息（Java 在 `detail` 中临时构造的 `ShopVO`）。
///
/// 注意：与 `models::shop::ShopVO` **不同**——Java 这里把
/// `shop.add_time`（秒级）格式化成 `yyyy-MM-dd HH:mm:ss` 字符串下发，
/// 且只填 7 个字段。故本域自持一个结构，避免改变共享 `ShopVO` 的序列化口径。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserShopVO {
    /// 店铺ID
    pub shop_id: i32,
    /// 店铺名称
    pub shop_title: Option<String>,
    /// 店铺LOGO
    pub shop_logo: Option<String>,
    /// 店铺状态（1 开业 4 停业 10 打烊）
    pub status: Option<i32>,
    /// 状态文案（Java `ShopType.getTypeName`）
    pub status_text: String,
    /// 联系电话
    pub contact_mobile: Option<String>,
    /// 店铺创建时间，`yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
}

/// 后台角色（对 Java 实体 `com.tigshop.bean.model.authority.AdminRole` 的逐字段还原）。
///
/// `config` 端点直接返回该实体列表（不是 VO），故字段名保持实体口径
/// （`roleName` / `authorityList` / `adminType` / `isSystem` …）。
#[derive(Debug, Clone, Default, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminRoleVO {
    /// 角色ID
    pub role_id: i32,
    /// 名称
    pub role_name: String,
    /// 系统角色稳定标识(如 pos_cashier)
    pub role_code: Option<String>,
    /// 描述
    pub role_desc: Option<String>,
    /// [JSON]权限
    pub authority_list: String,
    /// admin（平台）/ shop（店铺）/ vendor（供应商）
    pub admin_type: Option<String>,
    /// 商户id
    pub merchant_id: i32,
    /// 店铺id
    pub shop_id: i32,
    /// 供应商ID
    pub vendor_id: i32,
    /// 是否系统内置角色 0-否 1-是
    pub is_system: i32,
}

/// API Token 明文（Java `AdminApiTokenGenerateVO`，**仅生成时下发一次**）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminApiTokenGenerateVO {
    /// Token ID
    pub id: i32,
    /// 完整Token明文（仅此一次展示，请妥善保存）
    pub token: String,
    /// Token名称/备注
    pub name: String,
    /// 过期时间，null表示永不过期
    pub expires_at: Option<i64>,
}

/// API Token 列表项（Java `AdminApiTokenVO`，不含明文与哈希）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminApiTokenVO {
    /// Token ID
    pub id: i32,
    /// Token前缀（前8位）
    pub token_prefix: String,
    /// Token名称/备注
    pub name: String,
    /// 创建时间（秒级时间戳）
    pub created_at: i64,
    /// 最后使用时间（秒级时间戳）
    pub last_used_at: Option<i64>,
    /// 过期时间，null表示永不过期
    pub expires_at: Option<i64>,
    /// 是否有效
    pub is_active: i32,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 修改当前管理员账号入参（Java `AdminUserModifyManageAccountsDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserModifyManageAccountsDTO {
    /// 手机号
    pub mobile: Option<String>,
    /// 头像
    pub avatar: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 密码
    pub password: Option<String>,
    /// 确认密码
    pub pwd_confirm: Option<String>,
    /// 原密码
    pub old_password: Option<String>,
    /// 验证码
    pub code: Option<String>,
    /// 修改类型：1 个人信息 2 密码 3 手机号 4 验证当前绑定手机号
    /// （缺省时 Java 控制器置为 1）
    pub modify_type: Option<i32>,
}

/// 生成 API Token 入参（Java `AdminApiTokenGenerateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminApiTokenGenerateDTO {
    /// Token名称/备注
    pub name: Option<String>,
    /// 过期天数，不填则永不过期（Java 为 `Integer`，这里用 `i64` 承接天数乘法）
    pub expires_in_days: Option<i64>,
}

/// 通用批量操作入参（Java `com.tigshop.bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// ids
    pub ids: Vec<i32>,
    /// 操作类型（`del` 走批量删除，其余直接返回 false）
    pub r#type: String,
    /// 值
    pub value: i32,
    /// 数据
    pub data: Option<serde_json::Value>,
}

/// 删除 / 单条操作入参（Java `com.tigshop.bean.dto.common.OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// id
    pub id: i32,
    /// 备注
    pub admin_note: Option<String>,
    /// 页面类型
    pub page_type: Option<i32>,
}

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// `config` 端点查询参数。
///
/// Java 签名是 `getConfig(@RequestParam(name = "adminType", required = false) String)`，
/// 但**方法体内没有用它**（`getAdminType()` 取的是请求头 `x-admin-type`）。
/// 这里保留参数以对齐前端调用，同时额外接受 `shopId` / `vendorId`
/// 替代 Rust 侧尚未签发的请求头（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserConfigQuery {
    /// Java 参数 `adminType`（源码中未使用）
    pub admin_type: Option<String>,
    /// Rust 侧替代请求头 `x-shop-id`
    pub shop_id: Option<i32>,
    /// Rust 侧替代请求头 `x-vendor-id`
    pub vendor_id: Option<i32>,
}

/// `getCode` 端点查询参数（Java
/// `getCode(type, mobile, verifyToken)`，`verifyToken` 必填）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GetCodeQuery {
    /// 场景类型（透传给短信服务，Java 未做分支）
    #[serde(rename = "type")]
    pub code_type: Option<String>,
    /// 目标手机号（缺省时用当前账号已绑定手机号）
    pub mobile: Option<String>,
    /// 短信校验令牌（Java `@RequestParam String verifyToken`，必填）
    pub verify_token: Option<String>,
}

/// `detail` 端点查询参数（Java `detail(@RequestParam Integer id)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserIdQuery {
    pub id: i32,
}

/// `list` 端点查询参数（Java `AdminUserPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserListQuery {
    /// 供应商id（Java `String suppliersId`）
    pub suppliers_id: Option<String>,
    /// 管理员类型（`shop` / `vendor` / 其他；Java `String adminUserType`）
    pub admin_user_type: Option<String>,
    /// 关键词（Java `BasePage.keyword`，匹配 `username` / `mobile`）
    pub keyword: Option<String>,
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15、上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_user_dto_serializes_camel_case_without_password() {
        let dto = AdminUserDTO {
            admin_id: Some(3),
            username: Some("root".into()),
            add_time: Some("2026-01-01 00:00:00".into()),
            auth_list: Some(vec!["a".into()]),
            ..Default::default()
        };
        let v = serde_json::to_value(&dto).unwrap();
        assert_eq!(v["adminId"], 3);
        assert_eq!(v["username"], "root");
        assert_eq!(v["addTime"], "2026-01-01 00:00:00");
        assert_eq!(v["authList"][0], "a");
        // Rust 出参不含密码哈希
        assert!(v.get("password").is_none());
    }

    #[test]
    fn modify_accounts_dto_accepts_java_field_names() {
        let dto: AdminUserModifyManageAccountsDTO = serde_json::from_str(
            r#"{"modifyType":2,"oldPassword":"a","password":"b","pwdConfirm":"b","code":"1234"}"#,
        )
        .unwrap();
        assert_eq!(dto.modify_type, Some(2));
        assert_eq!(dto.old_password.as_deref(), Some("a"));
        assert_eq!(dto.password.as_deref(), Some("b"));
        assert_eq!(dto.pwd_confirm.as_deref(), Some("b"));
        assert_eq!(dto.code.as_deref(), Some("1234"));
        // 缺省全部为 None
        let dto: AdminUserModifyManageAccountsDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.modify_type, None);
    }

    #[test]
    fn api_token_dto_and_vo_field_names() {
        let dto: AdminApiTokenGenerateDTO =
            serde_json::from_str(r#"{"name":"ci","expiresInDays":30}"#).unwrap();
        assert_eq!(dto.name.as_deref(), Some("ci"));
        assert_eq!(dto.expires_in_days, Some(30));

        let vo = AdminApiTokenVO {
            id: 1,
            token_prefix: "abcdef01".into(),
            name: "ci".into(),
            created_at: 100,
            last_used_at: None,
            expires_at: Some(200),
            is_active: 1,
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["tokenPrefix"], "abcdef01");
        assert_eq!(v["createdAt"], 100);
        assert!(v["lastUsedAt"].is_null());
        assert_eq!(v["expiresAt"], 200);
        assert_eq!(v["isActive"], 1);
    }

    #[test]
    fn batch_and_operate_dto_match_java_shape() {
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.ids, vec![1, 2]);
        assert_eq!(b.r#type, "del");
        assert_eq!(b.value, 0);

        let o: OperateDTO = serde_json::from_str(r#"{"id":9,"adminNote":"n"}"#).unwrap();
        assert_eq!(o.id, 9);
        assert_eq!(o.admin_note.as_deref(), Some("n"));
    }

    #[test]
    fn role_vo_serializes_entity_field_names() {
        let r = AdminRoleVO {
            role_id: 2,
            role_name: "平台超管".into(),
            authority_list: "[]".into(),
            is_system: 1,
            ..Default::default()
        };
        let v = serde_json::to_value(&r).unwrap();
        assert_eq!(v["roleId"], 2);
        assert_eq!(v["roleName"], "平台超管");
        assert_eq!(v["authorityList"], "[]");
        assert_eq!(v["isSystem"], 1);
        assert!(v["roleCode"].is_null());
    }

    #[test]
    fn code_query_keeps_java_param_names() {
        let q: GetCodeQuery =
            serde_json::from_str(r#"{"type":"login","mobile":"13800000000","verifyToken":"t"}"#)
                .unwrap();
        assert_eq!(q.code_type.as_deref(), Some("login"));
        assert_eq!(q.mobile.as_deref(), Some("13800000000"));
        assert_eq!(q.verify_token.as_deref(), Some("t"));
    }
}
