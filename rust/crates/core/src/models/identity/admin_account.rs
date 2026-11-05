//! 账号管理域（identity::admin_account）DTO / VO / 查询参数 + 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.account.AdminAccountController`
//!   （`@RequestMapping("/adminapi/admin/adminAccount")`，7 个端点）
//! - `com.tigshop.service.account.impl.AdminAccountServiceImpl`（451 行）
//! - `com.tigshop.bean.param.account.*`（4 个入参）
//! - `com.tigshop.bean.vo.account.AdminUserAccountListVO` / `ShopOrVendorListVO`
//! - `com.tigshop.bean.vo.authority.AdminUserAccountVO`
//!
//! | 本域端点（挂载于 `/adminapi`） | 原 Java 方法 |
//! |--------------------------------|--------------|
//! | `GET  /admin/adminAccount/getMainAccount` | `getMainAccount` |
//! | `GET  /admin/adminAccount/pageShopOrVendor` | `pageShopOrVendor` |
//! | `POST /admin/adminAccount/bindMainAccount` | `bindMainAccount` |
//! | `POST /admin/adminAccount/updateMainAccount` | `updateMainAccount` |
//! | `POST /admin/adminAccount/updateMainAccountPwd` | `updateMainAccountPwd` |
//! | `GET  /admin/adminAccount/pageAdminUser` | `pageAdminUser` |
//! | `POST /admin/adminAccount/deleteAdminUser` | `deleteAdminUser` |
//!
//! JSON 字段一律 camelCase（与原接口 / 前端一致）。
//!
//! # 与 Java 的语义差异（详见服务层与 `uncertain_points`）
//!
//! - Java 的 `@Valid` / `@NotNull` 在这几个端点上**多数未被实际校验**
//!   （`bindMainAccount` / `updateMainAccount*` 的请求体都没有 `@Valid`），
//!   因此本文件把入参字段全部建模为 `Option`，由服务层按 Java 方法体逐条判空。
//! - `addTime` 在 Java VO 上是 `String` + `TimestampToDateSerializer`
//!   （秒级时间戳 → `yyyy-MM-dd HH:mm:ss`，`<= 0` 输出空串），
//!   故这里用 [`format_timestamp`] 生成同样口径的字符串。

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（Java `AdminUserConstants` / 枚举 / 错误文案）
// ——————————————————————————————————————————————

/// 新账号默认密码（Java `AdminUserConstants.PASSWORD`）。
pub const DEFAULT_PASSWORD: &str = "admin123321";

/// 新账号默认角色 ID（Java `AdminUserConstants.ROLE_ID = 1`）。
pub const DEFAULT_ROLE_ID: i32 = 1;

/// 主账号权限 JSON（Java `JSONUtil.toJsonStr(List.of("all"))`）。
pub const AUTH_ALL_JSON: &str = "[\"all\"]";

/// 新建管理员初始权限（Java `adminUserCreate.setAuthList("[]")`）。
pub const AUTH_EMPTY_JSON: &str = "[]";

/// 头像编号取值范围（Java `ThreadLocalRandom.nextInt(1, 34)` ⇒ `1..=33`）。
pub const AVATAR_RANDOM_RANGE: u32 = 33;

/// 「是否为管理员」标记：是（Java `VendorIsAdminEnum.YES`）。
pub const IS_ADMIN_YES: i32 = 1;

/// 「是否为管理员」标记：否（Java `VendorIsAdminEnum.NO`）。
pub const IS_ADMIN_NO: i32 = 0;

// —— 账号类型（Java `AdminTypeEnum` / `AdminUserConstants`）——

/// 账号类型常量（Java `AdminTypeEnum` / `AdminUserConstants.SHOP_TYPE` 等）。
pub mod admin_type {
    /// 平台后台（`AdminTypeEnum.ADMIN`）
    pub const ADMIN: &str = "admin";
    /// 店铺（`AdminTypeEnum.SHOP`）
    pub const SHOP: &str = "shop";
    /// 供应商（`AdminTypeEnum.VENDOR` / `AdminUserConstants.VENDOR_TYPE`）
    pub const VENDOR: &str = "vendor";
    /// 门店（`AdminTypeEnum.STORE`）
    pub const STORE: &str = "store";
    /// 自提点（`AdminTypeEnum.PICKUP`）
    pub const PICKUP: &str = "pickup";
}

/// 店铺类型码（Java `ShopTypeEnum`）。
pub mod shop_type {
    /// 店铺
    pub const SHOP: i32 = 1;
    /// 门店
    pub const STORE: i32 = 2;
    /// 自提点
    pub const PICKUP: i32 = 3;
}

/// 绑定账号时的「管理员信息来源」类型（Java `AdminInfoEnum`）。
pub mod admin_info {
    /// 会员（`AdminInfoEnum.USER`）
    pub const USER: i32 = 1;
    /// 已有管理员（`AdminInfoEnum.ADMIN_USER`）
    pub const ADMIN_USER: i32 = 2;
}

// —— 错误文案（逐字对齐 Java，避免前端提示漂移）——

/// `参数不能为空`
pub const MSG_PARAM_REQUIRED: &str = "参数不能为空";
/// `类型参数错误，只支持shop或vendor`
pub const MSG_TYPE_INVALID: &str = "类型参数错误，只支持shop或vendor";
/// `未找到对应的主账号信息`
pub const MSG_MAIN_ACCOUNT_NOT_FOUND: &str = "未找到对应的主账号信息";
/// `店铺不存在`
pub const MSG_SHOP_NOT_FOUND: &str = "店铺不存在";
/// `会员不存在`（Java `VendorConstants.VENDOR_USER_NOT_EXIST`）
pub const MSG_USER_NOT_EXIST: &str = "会员不存在";
/// `会员手机号码不能为空`
pub const MSG_USER_MOBILE_REQUIRED: &str = "会员手机号码不能为空";
/// `管理员不存在`（Java `VendorConstants.VENDOR_ADMIN_USER_NOT_EXIST`）
pub const MSG_ADMIN_USER_NOT_EXIST: &str = "管理员不存在";
/// `用户不存在`
pub const MSG_ADMIN_NOT_EXIST: &str = "用户不存在";
/// `账号名称已经存在`
pub const MSG_USERNAME_EXISTS: &str = "账号名称已经存在";
/// `手机号已经使用`
pub const MSG_MOBILE_USED: &str = "手机号已经使用";
/// `邮箱已经使用`
pub const MSG_EMAIL_USED: &str = "邮箱已经使用";
/// `两次密码不一致`
pub const MSG_PASSWORD_MISMATCH: &str = "两次密码不一致";
/// `主账号不允许删除`
pub const MSG_MAIN_ACCOUNT_NOT_DELETABLE: &str = "主账号不允许删除";

/// `bindMainAccount` 缺少 `adminData` 时的提示。
///
/// Java 会因 `getAdminData().getType()` NPE 直接 500；本实现显式返回 500
/// 语义的 `Internal` 错误（不猜测业务码），见 `uncertain_points`。
pub const MSG_ADMIN_DATA_REQUIRED: &str = "管理员信息（adminData）不能为空";

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 判断 `type` 是否属于「店铺类」分支（Java `"shop"/"store"/"pickup"` 三值判断）。
///
/// 注意 Java 的 `getMainAccount` / `pageShopOrVendor` / `bindMainAccount`
/// **只接受**这三个值；`vendor` 会走「类型参数错误」分支（尽管文案写着支持 vendor）。
#[must_use]
pub fn is_shop_like_type(kind: &str) -> bool {
    matches!(
        kind,
        admin_type::SHOP | admin_type::STORE | admin_type::PICKUP
    )
}

/// 店铺类型 → 后台管理员类型（Java `AdminTypeEnum.resolveCodeByShopType`）。
#[must_use]
pub fn admin_type_for_shop(shop_type: Option<i32>) -> &'static str {
    match shop_type {
        Some(shop_type::STORE) => admin_type::STORE,
        Some(shop_type::PICKUP) => admin_type::PICKUP,
        _ => admin_type::SHOP,
    }
}

/// 内置超级管理员角色名（Java `AdminTypeEnum.systemSuperRoleName`）。
///
/// `initAdminRole` 只用得到 shop / store / pickup 三种；其余保留以便对照。
#[must_use]
pub fn system_super_role_name(admin_type_code: &str) -> Option<&'static str> {
    match admin_type_code {
        "admin" => Some("平台超级管理员"),
        "shop" => Some("店铺超级管理员"),
        "vendor" => Some("供应商超级管理员"),
        "store" => Some("门店超级管理员"),
        "pickup" => Some("自提点超级管理员"),
        "pos" => Some("POS收银台超级管理员"),
        _ => None,
    }
}

/// 生成默认头像路径（Java `StrUtil.format("../assets/avatar/{}.jpeg", n)`,
/// `n = ThreadLocalRandom.nextInt(1, 34)`）。
///
/// `seed` 由调用方提供（服务层用 `Uuid::new_v4().as_u128()` 提供随机性）；
/// 结果恒定落在 `1..=33`。
#[must_use]
pub fn default_avatar(seed: u128) -> String {
    let n = (seed % u128::from(AVATAR_RANDOM_RANGE)) + 1;
    format!("../assets/avatar/{n}.jpeg")
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TimestampToDateSerializer`）。
///
/// Java 用 `Asia/Shanghai`；本实现沿用仓库既有 `fmt_seconds` 口径
/// （`chrono::Local`，服务器时区），见 `uncertain_points`。
/// `<= 0` 返回空串（与 Java 序列化器一致）。
#[must_use]
pub fn format_timestamp(secs: i32) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// `getMainAccount` 查询参数（Java 三个 `@RequestParam(required = false)`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GetMainAccountQuery {
    /// 管理员 ID（`adminId`）
    pub admin_id: Option<i32>,
    /// 店铺 ID / 供应商 ID（`id`）
    pub id: Option<i32>,
    /// 类型：`shop` / `store` / `pickup`（`type`）
    pub r#type: Option<String>,
}

/// `pageShopOrVendor` 查询参数（Java `ShopOrVendorPageParam extends BasePage`）。
///
/// Java 字段初始化器 `type = "shop"`：**参数缺省**时 `type` 为 `"shop"`；
/// 显式传空串时仍按空串处理（`StrUtil.isBlank` → 空分页）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopOrVendorPageParam {
    /// 主账号 ID（`adminId`）
    pub admin_id: Option<i32>,
    /// 类型：`shop` / `store` / `pickup`（缺省 `shop`）
    #[serde(default = "default_shop_param_type")]
    pub r#type: Option<String>,
    /// 页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15、上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 关键词（`shop_title LIKE %kw%`）
    pub keyword: Option<String>,
}

fn default_shop_param_type() -> Option<String> {
    Some(admin_type::SHOP.to_string())
}

impl ShopOrVendorPageParam {
    /// 转内部 [`PageQuery`]（Java `BasePage#getPage/getSize` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        base_page_query(self.page, self.size)
    }

    /// 有效关键词（Java `StrUtil.isNotBlank(keyword)`，`LIKE` 用原始值不 trim）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|kw| !kw.trim().is_empty())
    }
}

/// `pageAdminUser` 查询参数（Java `AdminUserPageParam extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserPageParam {
    /// 是否删除：Java 控制器**恒置 0**（见服务层），此字段仅用于对齐前端参数。
    pub is_deleted: Option<i32>,
    /// 页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15、上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 关键词（`username LIKE %kw% OR mobile LIKE %kw%`）
    pub keyword: Option<String>,
}

impl AdminUserPageParam {
    /// 转内部 [`PageQuery`]（Java `BasePage#getPage/getSize` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        base_page_query(self.page, self.size)
    }

    /// 有效关键词（Java `StringUtils.isNotEmpty`：仅 null / 空串视为空）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|kw| !kw.is_empty())
    }
}

/// Java `BasePage#getPage()` / `getSize()` 的统一换算。
///
/// `page` 缺省 1；`size` 缺省 15、上限 100（`BasePage.getSize()` 原样口径）。
#[must_use]
pub fn base_page_query(page: Option<u64>, size: Option<u64>) -> PageQuery {
    PageQuery {
        page: page.unwrap_or(1).max(1),
        // Java：null ⇒ 15；> 100 ⇒ 100。`0` 在 Java 会原样传入 MyBatis，
        // 这里收敛到 1（避免 `PageResult::empty` 除零），见 `uncertain_points`。
        page_size: size.unwrap_or(15).clamp(1, 100),
    }
}

/// `deleteAdminUser` 查询参数（Java `@RequestParam Integer adminId`，POST 的
/// **查询串**参数而非请求体）。
///
/// 不添加 `#[serde(default)]`：缺失 `adminId` 时反序列化失败，axum 返回 400，
/// 与 Java 缺少必填 `@RequestParam` 的行为等价。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAdminUserQuery {
    /// 管理员 ID（必填）
    pub admin_id: i32,
}

/// `bindMainAccount` 请求体（Java `ShopOrVendorBindParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopOrVendorBindParam {
    /// 店铺 ID / 供应商 ID
    pub id: Option<i32>,
    /// 类型：`shop` / `store` / `pickup`（Java `@NotNull` 但控制器无 `@Valid`）
    pub r#type: Option<String>,
    /// 管理员来源信息（Java `AdminInfo`）
    pub admin_data: Option<AdminInfoParam>,
}

/// `ShopOrVendorBindParam.AdminInfo`（Java 静态内部类）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminInfoParam {
    /// 来源类型：1 会员 / 2 管理员（Java `AdminInfoEnum`）
    pub r#type: Option<i32>,
    /// 会员 ID（`type = 1` 时使用）
    pub user_id: Option<i32>,
    /// 管理员 ID（`type = 2` 时使用）
    pub admin_id: Option<i32>,
}

/// `updateMainAccount` 请求体（Java `UpdateMainAccountParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateMainAccountParam {
    /// 管理员 ID
    pub admin_id: Option<i32>,
    /// 账号名称（Java `@NotBlank`，但控制器无 `@Valid`）
    pub username: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
}

/// `updateMainAccountPwd` 请求体（Java `UpdateMainAccountPwdParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateMainAccountPwdParam {
    /// 管理员 ID
    pub admin_id: Option<i32>,
    /// 新密码
    pub password: Option<String>,
    /// 确认密码
    pub pwd_confirm: Option<String>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 管理员账号信息（Java `AdminUserAccountVO`）。
///
/// 对应 `BeanUtils.copyProperties(adminUser, accountVO)`：实体为空时各字段为
/// `null`（Java 此时会 NPE，本实现返回全 `null` 对象，见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserAccountVO {
    /// 管理员 ID
    pub admin_id: Option<i32>,
    /// 管理员登录名
    pub username: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 管理员邮箱
    pub email: Option<String>,
}

/// 账号管理分页列表项（Java `AdminUserAccountListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminUserAccountListVO {
    /// 管理员 ID
    pub admin_id: Option<i32>,
    /// 头像
    pub avatar: Option<String>,
    /// 账号名称
    pub username: Option<String>,
    /// 手机
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 创建时间，`yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 关联店铺数（主账号关系，`shop_type = 1`）
    pub shop_count: Option<i64>,
    /// 关联供应商数（`admin_user_vendor.is_admin = 1`）
    pub vendor_count: Option<i64>,
    /// 关联门店数（主账号关系，`shop_type = 2`）
    pub store_count: Option<i64>,
    /// 是否主账号：1 是，0 否
    pub is_admin: Option<i32>,
}

/// 店铺 / 供应商分页列表项（Java `ShopOrVendorListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShopOrVendorListVO {
    /// ID（店铺 ID 或供应商 ID）
    pub id: i32,
    /// 名称
    pub name: Option<String>,
    /// Logo
    pub logo: Option<String>,
    /// 商户名称（仅店铺有此字段）
    pub merchant_name: Option<String>,
    /// 状态（店铺 1 开业 / 4 暂停 / 10 关店）
    pub status: Option<i32>,
    /// 主账号名称
    pub admin_username: Option<String>,
    /// 创建时间，`yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 类型（Java 固定填 `"shop"`）
    #[serde(default)]
    pub r#type: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 分页参数（对应 Java BasePage） ————————————————

    #[test]
    fn shop_or_vendor_page_defaults_match_java_base_page() {
        let p: ShopOrVendorPageParam = serde_json::from_str(r#"{}"#).unwrap();
        // 字段初始化器 `type = "shop"`
        assert_eq!(p.r#type.as_deref(), Some("shop"));
        let page = p.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 15);
        assert_eq!(p.effective_keyword(), None);
    }

    #[test]
    fn base_page_query_caps_size_and_floors_values() {
        assert_eq!(base_page_query(None, None).page, 1);
        assert_eq!(base_page_query(Some(0), Some(0)).page, 1);
        assert_eq!(base_page_query(Some(3), Some(500)).page_size, 100);
        assert_eq!(base_page_query(Some(2), Some(30)).page_size, 30);
    }

    #[test]
    fn blank_keyword_is_ignored_but_blank_type_is_not_defaulted() {
        let p: ShopOrVendorPageParam =
            serde_json::from_str(r#"{"keyword":"   ","type":""}"#).unwrap();
        assert_eq!(p.effective_keyword(), None);
        // 显式空串保持空串（服务层会按 StrUtil.isBlank → 空分页）
        assert_eq!(p.r#type.as_deref(), Some(""));
        // pageSize 别名
        let p: ShopOrVendorPageParam = serde_json::from_str(r#"{"pageSize":30}"#).unwrap();
        assert_eq!(p.size, Some(30));
    }

    // ———————————————— 类型判定（对应 Java 分支） ————————————————

    #[test]
    fn shop_like_type_only_accepts_three_values() {
        assert!(is_shop_like_type("shop"));
        assert!(is_shop_like_type("store"));
        assert!(is_shop_like_type("pickup"));
        assert!(!is_shop_like_type("vendor"));
        assert!(!is_shop_like_type(""));
        assert!(!is_shop_like_type("admin"));
    }

    #[test]
    fn admin_type_for_shop_matches_resolve_code_by_shop_type() {
        assert_eq!(admin_type_for_shop(None), "shop");
        assert_eq!(admin_type_for_shop(Some(shop_type::SHOP)), "shop");
        assert_eq!(admin_type_for_shop(Some(shop_type::STORE)), "store");
        assert_eq!(admin_type_for_shop(Some(shop_type::PICKUP)), "pickup");
        assert_eq!(admin_type_for_shop(Some(99)), "shop");
        assert_eq!(system_super_role_name("shop"), Some("店铺超级管理员"));
        assert_eq!(system_super_role_name("store"), Some("门店超级管理员"));
        assert_eq!(system_super_role_name("pickup"), Some("自提点超级管理员"));
        assert_eq!(system_super_role_name("nope"), None);
    }

    // ———————————————— 默认头像 ————————————————

    #[test]
    fn default_avatar_stays_in_java_random_range() {
        for seed in [0_u128, 1, 32, 33, 34, 1_000_000] {
            let path = default_avatar(seed);
            let n: u32 = path
                .trim_start_matches("../assets/avatar/")
                .trim_end_matches(".jpeg")
                .parse()
                .unwrap();
            assert!((1..=33).contains(&n), "头像编号越界: {n}");
        }
        assert_eq!(default_avatar(0), "../assets/avatar/1.jpeg");
        assert_eq!(default_avatar(32), "../assets/avatar/33.jpeg");
        assert_eq!(default_avatar(33), "../assets/avatar/1.jpeg");
    }

    // ———————————————— 时间格式（对应 TimestampToDateSerializer） ————————————————

    #[test]
    fn format_timestamp_handles_non_positive_and_normal_values() {
        assert_eq!(format_timestamp(0), "");
        assert_eq!(format_timestamp(-1), "");
        let s = format_timestamp(1_700_000_000);
        assert_eq!(s.len(), 19, "yyyy-MM-dd HH:mm:ss 长度应为 19: {s}");
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[10..11], " ");
        assert_eq!(&s[13..14], ":");
    }

    // ———————————————— DTO / VO 字段名 ————————————————

    #[test]
    fn bind_param_accepts_java_field_names() {
        let p: ShopOrVendorBindParam =
            serde_json::from_str(r#"{"id":9,"type":"shop","adminData":{"type":1,"userId":7}}"#)
                .unwrap();
        assert_eq!(p.id, Some(9));
        assert_eq!(p.r#type.as_deref(), Some("shop"));
        let info = p.admin_data.unwrap();
        assert_eq!(info.r#type, Some(admin_info::USER));
        assert_eq!(info.user_id, Some(7));
        assert_eq!(info.admin_id, None);

        // 全缺省
        let p: ShopOrVendorBindParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.id, None);
        assert!(p.admin_data.is_none());
    }

    #[test]
    fn update_params_accept_java_field_names() {
        let p: UpdateMainAccountPwdParam =
            serde_json::from_str(r#"{"adminId":3,"password":"a","pwdConfirm":"a"}"#).unwrap();
        assert_eq!(p.admin_id, Some(3));
        assert_eq!(p.password.as_deref(), Some("a"));
        assert_eq!(p.pwd_confirm.as_deref(), Some("a"));

        let p: UpdateMainAccountParam = serde_json::from_str(
            r#"{"adminId":3,"username":"root","mobile":"13800000000","email":"a@b.c"}"#,
        )
        .unwrap();
        assert_eq!(p.username.as_deref(), Some("root"));
        assert_eq!(p.mobile.as_deref(), Some("13800000000"));
        assert_eq!(p.email.as_deref(), Some("a@b.c"));
    }

    #[test]
    fn vos_serialize_camel_case_matching_java() {
        let vo = AdminUserAccountListVO {
            admin_id: Some(2),
            avatar: Some("../assets/avatar/1.jpeg".into()),
            username: Some("root".into()),
            mobile: Some("13800000000".into()),
            email: Some("a@b.c".into()),
            add_time: "2026-01-01 00:00:00".into(),
            shop_count: Some(1),
            vendor_count: Some(0),
            store_count: Some(2),
            is_admin: Some(1),
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["adminId"], 2);
        assert_eq!(v["shopCount"], 1);
        assert_eq!(v["storeCount"], 2);
        assert_eq!(v["vendorCount"], 0);
        assert_eq!(v["isAdmin"], 1);
        assert_eq!(v["addTime"], "2026-01-01 00:00:00");

        let vo = ShopOrVendorListVO {
            id: 5,
            name: Some("店铺A".into()),
            merchant_name: Some("商户A".into()),
            add_time: "2026-01-01 00:00:00".into(),
            r#type: "shop".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["id"], 5);
        assert_eq!(v["name"], "店铺A");
        assert_eq!(v["merchantName"], "商户A");
        assert_eq!(v["adminUsername"], serde_json::Value::Null);
        assert_eq!(v["type"], "shop");

        let vo = AdminUserAccountVO {
            admin_id: Some(1),
            username: Some("admin".into()),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["adminId"], 1);
        assert!(v["mobile"].is_null());
    }
}
