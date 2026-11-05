//! 管理员日志 域 DTO / VO（identity::admin_log）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。
//!
//! 对应 Java：
//! - 入参 `com.tigshop.bean.query.adminlog.AdminLogPageQuery`
//!   （`java/tigshop-bean/src/main/java/com/tigshop/bean/query/adminlog/AdminLogPageQuery.java`，
//!   继承 `BasePage`，只多一个 `keyword`）
//! - 出参 `com.tigshop.bean.dto.authority.AdminLogDTO`
//!   （`java/tigshop-bean/src/main/java/com/tigshop/bean/dto/authority/AdminLogDTO.java`）

use crate::types::PageQuery;
use serde::{Deserialize, Serialize};

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 作用域类型（Java `AdminLogServiceImpl` 的四个常量）。
pub const SCOPE_ADMIN: &str = "admin";
/// 作用域类型：店铺
pub const SCOPE_SHOP: &str = "shop";
/// 作用域类型：供应商
pub const SCOPE_VENDOR: &str = "vendor";
/// 作用域类型：历史未标注
pub const SCOPE_LEGACY: &str = "legacy";

/// `GET /adminapi/authority/adminLog/list` 查询参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AdminLogPageQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`）
    pub sort_field: Option<String>,
    /// 排序方向（`asc` / `desc`；其它值 Java 不设 ORDER BY）
    pub sort_order: Option<String>,
    /// 关键字：日志信息 / IP 地址（Java `AdminLogPageQuery.keyword`）
    pub keyword: Option<String>,
}

impl AdminLogPageQuery {
    /// 归一化分页（Java `BasePage#getPage` / `#getSize`）。
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

    /// 通用分页参数（供 [`PageResult`] 口径使用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }
}

/// 管理员日志列表项（对应 Java `AdminLogDTO`）。
///
/// 与实体 `AdminLog` 的差异（逐条来自
/// `AdminLogServiceImpl#getAdminLogListWithUsernames`）：
/// - `logTime` 由**秒级时间戳**转成 `yyyy-MM-dd HH:mm:ss` 字符串
///   （`DateUtil.date(logTime * 1000)` + `DATE_FORMAT`）；
/// - `username` 由 `admin_user` 批量回查填充，查不到时为 `null`；
/// - `requestLog` 由 `request_log_id` 回查 `request_log`，
///   `request_log_id` 为 `null` 时不查（保持 `null`）；
/// - Java DTO **没有** `scopeType` / `scopeId`（`BeanUtils.copyProperties`
///   只拷同名属性），故这里同样不输出。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminLogDTO {
    /// 日志ID
    pub log_id: i32,
    /// 日志时间（`yyyy-MM-dd HH:mm:ss`）
    pub log_time: String,
    /// 管理员ID
    pub user_id: i32,
    /// 日志详情
    pub log_info: String,
    /// ip
    pub ip_address: String,
    /// 管理员名称（`admin_user.username`，可空）
    pub username: Option<String>,
    /// 请求日志（可空）
    pub request_log: Option<AdminLogRequestLogVO>,
}

/// 请求日志（对应 Java 直接把实体 `RequestLog` 塞进 DTO 的 `requestLog`）。
///
/// 字段与列一一对应（`request_log`：`request_log_id` / `url` / `http_method` /
/// `class_method` / `request_params` / `add_time` / `admin_username` /
/// `admin_id` / `admin_ip` / `platform`）；`add_time` 在库里就是
/// `varchar(32)`，故原样透传字符串。
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminLogRequestLogVO {
    /// 主键
    pub request_log_id: i32,
    /// 地址
    pub url: String,
    /// 请求类型
    pub http_method: String,
    /// 类名 + 方法名
    pub class_method: String,
    /// 请求参数
    pub request_params: Option<String>,
    /// 操作时间（库里是字符串）
    pub add_time: Option<String>,
    /// 后台用户名称
    pub admin_username: Option<String>,
    /// 后台用户id
    pub admin_id: Option<i32>,
    /// ip地址
    pub admin_ip: Option<String>,
    /// 平台信息
    pub platform: Option<String>,
}

/// 日志作用域（Java `applyScopeFilter` 的三种结论）。
///
/// - [`Scope::All`]：平台账号，看全部；
/// - [`Scope::Shop`] / [`Scope::Vendor`]：按 `scope_type` + `scope_id` 过滤；
/// - [`Scope::Nothing`]：Java 里 `applyScopeFilter` 返回 `false`
///   （非以上账号类型、或作用域 ID 非法/缺失）→ 直接返回空页，**不查库**。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// 平台账号：不加作用域条件
    All,
    /// 店铺类账号（shop / store / pickup / pos）
    Shop {
        /// `x-shop-id`
        shop_id: i32,
    },
    /// 供应商账号
    Vendor {
        /// `x-vendor-id`
        vendor_id: i32,
    },
    /// 无权查看任何日志
    Nothing,
}

impl Scope {
    /// 由「账号类型 + 作用域ID」推导 Java 的作用域结论。
    ///
    /// 逐条对照 `AdminLogServiceImpl#applyScopeFilter` / `#isShopScope` /
    /// `#isValidScopeId`：
    /// - `admin` → 全部（**不**校验 id）；
    /// - `shop` / `store` / `pickup` / `pos` → `scope_type='shop'` +
    ///   `scope_id=shopId`；`shopId` 为 `null` 或 `<= 0` → 空页；
    /// - `vendor` → `scope_type='vendor'` + `scope_id=vendorId`；
    ///   `vendorId` 为 `null` 或 `<= 0` → 空页；
    /// - 其它（含 `None`、`legacy`、未知字符串）→ 空页；
    /// - 大小写敏感（Java 用 `String.equals`）。
    #[must_use]
    pub fn resolve(admin_type: Option<&str>, shop_id: Option<i32>, vendor_id: Option<i32>) -> Self {
        match admin_type {
            Some(SCOPE_ADMIN) => Self::All,
            Some(t) if is_shop_scope(t) => match valid_id(shop_id) {
                Some(id) => Self::Shop { shop_id: id },
                None => Self::Nothing,
            },
            Some(SCOPE_VENDOR) => match valid_id(vendor_id) {
                Some(id) => Self::Vendor { vendor_id: id },
                None => Self::Nothing,
            },
            _ => Self::Nothing,
        }
    }
}

/// Java `isShopScope`：`shop` / `store` / `pickup` / `pos`。
#[must_use]
pub fn is_shop_scope(admin_type: &str) -> bool {
    matches!(admin_type, SCOPE_SHOP | "store" | "pickup" | "pos")
}

/// Java `isValidScopeId`：非空且 `> 0`。
#[must_use]
fn valid_id(id: Option<i32>) -> Option<i32> {
    id.filter(|v| *v > 0)
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`
/// （Java `DateUtil.date(logTime * 1000)` + `DateUtil.format(.., DATE_FORMAT)`）。
///
/// 与 [`crate::models::payment::user_balance_log::format_change_time`] 的差别：
/// Java 本域**没有**走 `TigUtils.handelTime`，而是直接 `logTime * 1000`，
/// 因此 `0` 会被格式化成纪元时间而**不是**空串；负数同理（hutool 不抛异常）。
/// 这里保持一致：任何整数都尝试格式化，只有超出 `chrono` 可表示范围才回退空串。
#[must_use]
pub fn format_log_time(secs: i32) -> String {
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(json: serde_json::Value) -> AdminLogPageQuery {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn page_defaults_match_java_base_page() {
        assert_eq!(q(serde_json::json!({})).page_params(), (1, 15));
        assert_eq!(q(serde_json::json!({"size": 101})).page_params(), (1, 100));
        assert_eq!(
            q(serde_json::json!({"page": 4, "size": 10})).limit_offset(),
            (10, 30)
        );
        let pq = q(serde_json::json!({"page": 2})).page_query();
        assert_eq!((pq.page, pq.page_size), (2, 15));
    }

    #[test]
    fn keyword_is_camel_case_and_optional() {
        assert_eq!(
            q(serde_json::json!({"keyword": "1.2.3.4"}))
                .keyword
                .as_deref(),
            Some("1.2.3.4")
        );
        assert_eq!(q(serde_json::json!({})).keyword, None);
    }

    #[test]
    fn scope_admin_sees_everything() {
        assert_eq!(Scope::resolve(Some("admin"), None, None), Scope::All);
        // Java 对 admin 不看 shopId（即便传了也不加条件）
        assert_eq!(Scope::resolve(Some("admin"), Some(9), Some(9)), Scope::All);
    }

    #[test]
    fn scope_shop_variants_all_map_to_shop_type() {
        for t in ["shop", "store", "pickup", "pos"] {
            assert_eq!(
                Scope::resolve(Some(t), Some(7), None),
                Scope::Shop { shop_id: 7 },
                "{t}"
            );
        }
    }

    #[test]
    fn scope_missing_or_non_positive_id_yields_nothing() {
        for t in ["shop", "store", "pickup", "pos"] {
            assert_eq!(
                Scope::resolve(Some(t), None, Some(3)),
                Scope::Nothing,
                "{t}"
            );
            assert_eq!(
                Scope::resolve(Some(t), Some(0), None),
                Scope::Nothing,
                "{t}"
            );
            assert_eq!(
                Scope::resolve(Some(t), Some(-2), None),
                Scope::Nothing,
                "{t}"
            );
        }
        assert_eq!(Scope::resolve(Some("vendor"), None, None), Scope::Nothing);
        assert_eq!(
            Scope::resolve(Some("vendor"), Some(5), Some(0)),
            Scope::Nothing
        );
        assert_eq!(
            Scope::resolve(Some("vendor"), None, Some(5)),
            Scope::Vendor { vendor_id: 5 }
        );
    }

    #[test]
    fn scope_other_types_yield_nothing_and_are_case_sensitive() {
        assert_eq!(Scope::resolve(None, Some(1), Some(1)), Scope::Nothing);
        assert_eq!(
            Scope::resolve(Some("legacy"), Some(1), Some(1)),
            Scope::Nothing
        );
        // Java 用 equals，"Admin" 不是平台账号
        assert_eq!(
            Scope::resolve(Some("Admin"), Some(1), Some(1)),
            Scope::Nothing
        );
        assert_eq!(Scope::resolve(Some("Shop"), Some(1), None), Scope::Nothing);
        assert_eq!(
            Scope::resolve(Some("Vendor"), None, Some(1)),
            Scope::Nothing
        );
    }

    #[test]
    fn log_time_formats_zero_as_epoch_not_empty() {
        // 本域 Java 走 DateUtil.date(0*1000)，不是 handelTime → 0 也有文本
        let s = format_log_time(0);
        assert_eq!(s.len(), 19, "{s}");
        assert!(s.starts_with("1970-01-01"), "{s}");
        // 1733000000 秒 → 19 位日期时间
        assert_eq!(format_log_time(1_733_000_000).len(), 19);
    }

    #[test]
    fn dto_serializes_camel_case_without_scope_columns() {
        let dto = AdminLogDTO {
            log_id: 5,
            log_time: "2024-10-28 10:57:00".into(),
            user_id: 2,
            log_info: "登录后台".into(),
            ip_address: "127.0.0.1".into(),
            username: Some("admin".into()),
            request_log: None,
        };
        let v = serde_json::to_value(&dto).unwrap();
        assert_eq!(v["logId"], 5);
        assert_eq!(v["ipAddress"], "127.0.0.1");
        assert_eq!(v["logTime"], "2024-10-28 10:57:00");
        assert!(v["requestLog"].is_null());
        // Java DTO 无 scopeType / scopeId
        assert!(v.get("scopeType").is_none());
        assert!(v.get("scopeId").is_none());
    }

    #[test]
    fn request_log_vo_camel_case_field_names() {
        let v = serde_json::to_value(AdminLogRequestLogVO {
            request_log_id: 9,
            url: "/adminapi/x".into(),
            http_method: "GET".into(),
            class_method: "A.b".into(),
            request_params: Some("{}".into()),
            add_time: Some("2024-10-28 10:57:00".into()),
            admin_username: Some("admin".into()),
            admin_id: Some(1),
            admin_ip: Some("127.0.0.1".into()),
            platform: Some("pc".into()),
        })
        .unwrap();
        assert_eq!(v["requestLogId"], 9);
        assert_eq!(v["httpMethod"], "GET");
        assert_eq!(v["classMethod"], "A.b");
        assert_eq!(v["adminUsername"], "admin");
        assert_eq!(v["adminId"], 1);
        assert_eq!(v["adminIp"], "127.0.0.1");
        // 不应出现 snake_case 键
        assert!(v.get("request_log_id").is_none());
    }
}
