//! 入驻申请域（merchant::merchant_apply）DTO / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.merchant.MerchantApplyController`
//!   （`@RequestMapping("/adminapi/merchant/apply")`，8 个端点）
//! - `com.tigshop.service.merchant.impl.MerchantApplyServiceImpl`
//! - `com.tigshop.bean.vo.merchant.MerchantApplyVO`、
//!   `com.tigshop.bean.param.merchant.MerchantApplyAuditParam`、
//!   `com.tigshop.bean.query.merchant.MerchantApplyListPageQuery`、
//!   `com.tigshop.bean.dto.merchant.MerchantApplyUpdateDTO`
//!
//! # 与 Java 的已知差异
//!
//! - Java `MerchantApplyUpdateDTO` 是**空类**（没有任何字段），`update()` 只会
//!   `BeanUtils.copyProperties` 一个空对象后 `updateById` → 等价于无操作；
//!   本实现同样按「空更新」处理（保留端点行为一致）。
//! - Java `list`/`detail` 会把申请 JSON（`baseData`/`shopData`/`merchantData`）
//!   反序列化成 `JSONObject` 再返回；本实现直接返回解析后的 `serde_json` 值。
//! - Java `audit` 审核通过时会创建商户 + 后台管理员 + 商户用户 + 店铺 + 保证金账户
//!   （跨 merchant/identity/deposit 多域）；本实现只写**入驻申请状态 + merchant 行**，
//!   其余开户链路未迁移（见服务层文档）。
//! - Java `addTime`/`auditTime` 经 `TigUtils.handelTime` 格式化为本地时间串；
//!   本实现输出 `yyyy-MM-dd HH:mm:ss`（0/缺失 → 空串）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Java `HttpStatus.SERVICE_DATA_ERROR`。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// Java `MerchantApplyConstants.MERCHANT_APPLY_NOT_EXIST`。
pub const MERCHANT_APPLY_NOT_EXIST: &str = "商户申请信息不存在";
/// Java `error.audit.status.invalid`（非待审核状态不能再次审核）。
pub const AUDIT_STATUS_INVALID: &str = "审核状态不正确";
/// Java `error.resource.not.found`（审核时申请不存在）。
pub const RESOURCE_NOT_FOUND: &str = "资源不存在";
/// Java `MerchantApplyConstants.MERCHANT_APPLY_ID_NOT_NULL`。
pub const MERCHANT_APPLY_ID_NOT_NULL: &str = "商户申请id不能为空";
/// Java 审核通过前要求会员已绑定手机号。
pub const MOBILE_NOT_BOUND: &str = "请先绑定手机号";

/// 审核状态：待审核（Java `MerchantApplyStatusEnum.PENDING_REVIEW`）。
pub const STATUS_PENDING: i32 = 1;
/// 审核状态：审核通过（Java `AUDIT_PASS`）。
pub const STATUS_PASS: i32 = 10;
/// 审核状态：审核未通过（Java `AUDIT_NOT_PASS`）。
pub const STATUS_REJECT: i32 = 20;

/// Java `MerchantApplyStatusEnum.getStatusName`。
#[must_use]
pub fn status_text(status: i32) -> &'static str {
    match status {
        STATUS_PENDING => "待审核",
        STATUS_PASS => "审核通过",
        STATUS_REJECT => "审核未通过",
        _ => "",
    }
}

/// Java `CheckFieldConstants.GENERAL_FIELDS`（列名口径）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// `merchant_apply` 实体的「属性名/列名 → 列名」映射（对应 `@TableField`）。
const APPLY_COLUMNS: [(&str, &str); 15] = [
    ("merchantApplyId", "merchant_apply_id"),
    ("userId", "user_id"),
    ("addTime", "add_time"),
    ("shopTitle", "shop_title"),
    ("status", "status"),
    ("type", "type"),
    ("contactName", "contact_name"),
    ("contactMobile", "contact_mobile"),
    ("auditTime", "audit_time"),
    ("auditAdminId", "audit_admin_id"),
    ("shopData", "shop_data"),
    ("baseData", "base_data"),
    ("merchantData", "merchant_data"),
    ("companyName", "company_name"),
    ("corporateName", "corporate_name"),
];

/// Java `BaseServiceImpl#getColumnByPropertyName`（未知属性回退主键列）。
#[must_use]
pub fn apply_field_to_column(field: Option<&str>) -> &'static str {
    let Some(name) = field.filter(|f| !f.is_empty()) else {
        return "merchant_apply_id";
    };
    if name == "merchantApplyId" || name == "merchant_apply_id" {
        return "merchant_apply_id";
    }
    APPLY_COLUMNS
        .iter()
        .find(|(p, c)| *p == name || *c == name)
        .map_or("merchant_apply_id", |(_, c)| *c)
}

/// 映射后的列是否在 `GENERAL_FIELDS` 白名单内（`updateField` 专用）。
#[must_use]
pub fn is_general_field(column: &str) -> bool {
    GENERAL_FIELDS.contains(&column)
}

/// 审核入参（Java `MerchantApplyAuditParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyAuditParam {
    /// 主键
    pub merchant_apply_id: Option<i32>,
    /// 审核状态（10 通过 / 20 未通过）
    pub status: Option<i32>,
    /// 审核备注
    pub audit_remark: Option<String>,
}

/// 更新入参（Java `MerchantApplyUpdateDTO`，**空类**）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyUpdateDTO {}

/// 列表查询（Java `MerchantApplyListPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyListQuery {
    /// 会员名称（Java 注释：暂匹配 companyName / contactName）
    pub username: Option<String>,
    /// 审核状态；`-1`/缺省 = 全部
    pub status: Option<i32>,
    /// 页码
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<u64>,
    /// 排序字段（Java `buildSortOrder`：空 → 主键降序）
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl MerchantApplyListQuery {
    /// Java `BasePage.getPage/getSize`。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self.size.unwrap_or(15).clamp(1, 100);
        (page, size)
    }

    /// 排序方向（Java `buildSortOrder`：asc 才升序，其余降序）。
    #[must_use]
    pub fn sort_dir(&self) -> &'static str {
        if self
            .sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
        {
            "ASC"
        } else {
            "DESC"
        }
    }
}

/// 列表/详情 VO（Java `MerchantApplyVO`；`user` 只保留常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantApplyVO {
    /// 入驻申请 ID
    pub merchant_apply_id: i32,
    /// 用户 ID
    pub user_id: i32,
    /// 店铺名称
    pub shop_title: Option<String>,
    /// 状态 1待审核 10审核通过 20审核未通过
    pub status: i32,
    /// 类型 1个人 2企业
    pub r#type: i32,
    /// 联系人名称
    pub contact_name: Option<String>,
    /// 联系人手机
    pub contact_mobile: Option<String>,
    /// 申请资料 shop 信息 JSON
    pub shop_data: Option<Value>,
    /// 申请资料基本信息 JSON
    pub base_data: Option<Value>,
    /// 申请资料的商户信息 JSON
    pub merchant_data: Option<Value>,
    /// 企业名称
    pub company_name: Option<String>,
    /// 申请主体信息
    pub corporate_name: Option<String>,
    /// 审核备注
    pub audit_remark: Option<String>,
    /// 会员信息（Java 内嵌 `User` 实体，这里只保留展示字段）
    pub user: Option<Value>,
    /// 审核文案
    pub status_text: String,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 审核时间
    pub audit_time: String,
    /// 审核管理员ID（0 = 系统/未审核）
    pub audit_admin_id: i32,
    /// 审核管理员姓名
    pub audit_admin_name: String,
}

/// 审核操作的合法目标状态（Java `MerchantApplyStatusEnum`：10 通过 / 20 不通过）。
#[must_use]
pub fn valid_audit_status(status: i32) -> bool {
    status == STATUS_PASS || status == STATUS_REJECT
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime` 的等价展示格式）。
///
/// 0/负数 → 空串（Java 未审核时 auditTime 为空）。
#[must_use]
pub fn format_time(ts: Option<i32>) -> String {
    let Some(ts) = ts.filter(|t| *t > 0) else {
        return String::new();
    };
    match chrono::DateTime::from_timestamp(i64::from(ts), 0) {
        Some(dt) => dt
            .with_timezone(
                &chrono::FixedOffset::east_opt(8 * 3600)
                    .unwrap_or_else(|| chrono::FixedOffset::east_opt(0).expect("UTC offset")),
            )
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
        None => String::new(),
    }
}

/// 审计状态参数（Java `config()` 返回 `List<Map<String,String>>`）。
#[must_use]
pub fn status_options() -> Value {
    serde_json::json!([
        { "value": STATUS_PENDING.to_string(), "label": status_text(STATUS_PENDING) },
        { "value": STATUS_PASS.to_string(), "label": status_text(STATUS_PASS) },
        { "value": STATUS_REJECT.to_string(), "label": status_text(STATUS_REJECT) },
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_texts_match_java_enum() {
        assert_eq!(status_text(STATUS_PENDING), "待审核");
        assert_eq!(status_text(STATUS_PASS), "审核通过");
        assert_eq!(status_text(STATUS_REJECT), "审核未通过");
        assert_eq!(status_text(0), "");
    }

    #[test]
    fn field_mapping_and_whitelist_match_java() {
        assert_eq!(apply_field_to_column(Some("status")), "status");
        assert_eq!(apply_field_to_column(Some("shopTitle")), "shop_title");
        assert_eq!(apply_field_to_column(Some("shop_title")), "shop_title");
        assert_eq!(
            apply_field_to_column(Some("merchantApplyId")),
            "merchant_apply_id"
        );
        // 未知 → 主键列（防注入），且不在 GENERAL_FIELDS 内
        assert_eq!(apply_field_to_column(Some("nope")), "merchant_apply_id");
        assert!(is_general_field("status"));
        assert!(!is_general_field("shop_title"));
        assert!(!is_general_field(&apply_field_to_column(Some("nope"))));
    }

    #[test]
    fn page_params_and_audit_status_follow_java() {
        let q = MerchantApplyListQuery::default();
        assert_eq!(q.page_params(), (1, 15));
        let q = MerchantApplyListQuery {
            page: Some(3),
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_params(), (3, 100));
        assert!(valid_audit_status(STATUS_PASS));
        assert!(valid_audit_status(STATUS_REJECT));
        assert!(!valid_audit_status(STATUS_PENDING));
        assert!(!valid_audit_status(0));
    }

    #[test]
    fn time_formatting_is_stable() {
        assert_eq!(format_time(None), "");
        assert_eq!(format_time(Some(0)), "");
        // 2023-11-14 22:13:20 UTC+8
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }

    #[test]
    fn status_options_shape() {
        let v = status_options();
        assert_eq!(v.as_array().map(Vec::len), Some(3));
        assert_eq!(v[0]["value"], "1");
        assert_eq!(v[0]["label"], "待审核");
    }

    #[test]
    fn audit_param_and_vo_serde_shapes() {
        let p: MerchantApplyAuditParam =
            serde_json::from_str(r#"{"merchantApplyId":7,"status":10,"auditRemark":"ok"}"#)
                .unwrap();
        assert_eq!(p.merchant_apply_id, Some(7));
        assert_eq!(p.status, Some(10));
        let vo = MerchantApplyVO {
            merchant_apply_id: 1,
            status: STATUS_PASS,
            status_text: status_text(STATUS_PASS).into(),
            add_time: "2024-01-01 00:00:00".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["merchantApplyId"], 1);
        assert_eq!(v["statusText"], "审核通过");
        assert_eq!(v["auditAdminName"], "");
    }
}
