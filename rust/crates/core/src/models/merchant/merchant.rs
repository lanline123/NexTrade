//! 商户域（merchant::merchant）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.merchant.MerchantController`
//!   （`@RequestMapping("/adminapi/merchant/merchant")`，8 个端点）
//! - `com.tigshop.service.merchant.impl.MerchantServiceImpl`
//! - `MerchantListPageQuery` / `MerchantCreateDTO` / `MerchantUpdateDTO` /
//!   `MerchantVO` / `MerchantAdminDataDTO` / `MerchantStatus` / `MerchantType`
//! - 表 `merchant`（实体 `tigshop_core::entities::Merchant`）与
//!   `merchant_user` / `admin_user` / `user` / `region` / `shop`（只读回填）
//!
//! # 端点（8）
//! `POST uploadLicense`、`GET list/detail`、`POST create/update/del/updateField/batch`。
//!
//! # 与 Java 的差异（uncertain_points）
//! 1. `create` 只落 `merchant` 主表（Java 还会创建 `admin_user` /
//!    `merchant_user` 关联，涉及邀请码、角色、密码加密等未迁移链路）。
//! 2. `updateField` Java 用 `GENERAL_FIELDS`（is_show/sort_order/status），但
//!    `merchant` 表无 is_show/sort_order 列；本实现白名单收敛为 `status`。
//! 3. `del` / `batch` 为软删（`is_delete=1`；实体无 `@TableLogic`，Java 列表
//!    显式过滤 `is_delete is null or 0`）。
//! 4. `uploadLicense` 的水印 / 内容类型校验 / 对象存储依赖未迁移：接收
//!    multipart 后返回业务错误（见路由模块头），其余 7 条完整。
//! 5. `VO.user` 为会员精简对象（user_id/username/mobile/nickname/avatar）。
//!
//! # 金额：本域无金额列（结算周期为 i32）。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 商户状态（Java `MerchantStatus`）。
pub const STATUS_NORMAL: i32 = 1;
pub const STATUS_CANCEL: i32 = 2;
/// 商户类型（Java `MerchantType`）。
pub const TYPE_PERSONAL: i32 = 1;
pub const TYPE_ENTERPRISE: i32 = 2;

/// 状态文案（Java `MerchantStatus#getStatusName`）。
#[must_use]
pub fn status_text(status: Option<i32>) -> String {
    match status {
        Some(STATUS_NORMAL) => "正常".into(),
        Some(STATUS_CANCEL) => "取消资格".into(),
        _ => String::new(),
    }
}

/// 类型文案（Java `MerchantType#getTypeName`）。
#[must_use]
pub fn type_text(r#type: Option<i32>) -> String {
    match r#type {
        Some(TYPE_PERSONAL) => "个人认证".into(),
        Some(TYPE_ENTERPRISE) => "企业认证".into(),
        _ => String::new(),
    }
}

/// 管理端分页默认值（Java `BasePage`：15 / 100）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 错误文案（Java `update`: `Assert.notNull(merchant, () -> new GlobalException("商户不存在"))`）。
pub const MSG_MERCHANT_NOT_FOUND: &str = "商户不存在";
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_LICENSE_UNAVAILABLE: &str =
    "营业执照上传功能未迁移（水印/对象存储依赖），请使用系统文件上传后回填 merchantData.businessLicenseImg";

/// 列表查询（Java `MerchantListPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantListQuery {
    pub merchant_id: Option<i32>,
    pub status: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 新增商户入参（Java `MerchantCreateDTO` 的核心子集；`admin`/明细字段未迁移）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantCreateDTO {
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub user_id: Option<i32>,
    pub base_data: Option<Value>,
    pub shop_data: Option<Value>,
    pub merchant_data: Option<Value>,
    pub company_name: Option<String>,
    pub corporate_name: Option<String>,
    pub settlement_cycle: Option<i32>,
    pub status: Option<i32>,
}

/// 编辑商户入参（Java `MerchantUpdateDTO`；`merchantId` 必填）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MerchantUpdateDTO {
    #[serde(alias = "id")]
    pub merchant_id: Option<i32>,
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub user_id: Option<i32>,
    pub base_data: Option<Value>,
    pub shop_data: Option<Value>,
    pub merchant_data: Option<Value>,
    pub company_name: Option<String>,
    pub corporate_name: Option<String>,
    pub settlement_cycle: Option<i32>,
    pub status: Option<i32>,
}

/// 单 ID / 字段 / 批量通用入参。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 会员精简对象（Java `MerchantVO.user` 为完整 `User`；本实现取常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantUserVO {
    pub user_id: i32,
    pub username: String,
    pub nickname: Option<String>,
    pub mobile: String,
    pub avatar: String,
}

/// 商户管理员（Java `MerchantAdminDataDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantAdminVO {
    pub merchant_id: i32,
    pub admin_user_id: Option<i32>,
    pub user_id: Option<i32>,
    pub is_admin: Option<i32>,
    pub admin_id: Option<i32>,
    pub username: Option<String>,
}

/// 商户 VO（Java `MerchantVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantVO {
    pub merchant_id: i32,
    pub merchant_apply_id: Option<i32>,
    pub user_id: Option<i32>,
    pub add_time: String,
    pub base_data: Option<Value>,
    pub shop_data: Option<Value>,
    pub merchant_data: Option<Value>,
    pub status: Option<i32>,
    pub status_text: String,
    #[serde(rename = "type")]
    pub r#type: Option<i32>,
    pub type_text: String,
    pub company_name: Option<String>,
    pub corporate_name: Option<String>,
    pub settlement_cycle: Option<i32>,
    pub shop_count: i64,
    pub user: Option<MerchantUserVO>,
    pub admin: Option<MerchantAdminVO>,
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；0 → 空串）。
#[must_use]
pub fn format_time(secs: Option<i32>) -> String {
    use chrono::TimeZone;
    let Some(secs) = secs else {
        return String::new();
    };
    if secs == 0 {
        return String::new();
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// `updateField` 白名单归一（Java `GENERAL_FIELDS` 中 `merchant` 唯一实存列）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    match field {
        "status" => Some("status"),
        _ => None,
    }
}

/// 从 `base_data` JSON 中取 `type` / `companyName` / `corporateName`
/// （Java `create/update` 显式从 `baseData` 取这三项）。
#[must_use]
pub fn base_field_str(base: Option<&Value>, key: &str) -> Option<String> {
    base?.get(key)?.as_str().map(str::to_string)
}

#[must_use]
pub fn base_field_i32(base: Option<&Value>, key: &str) -> Option<i32> {
    base?.get(key)?.as_i64().and_then(|v| i32::try_from(v).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_and_type_texts_match_java_enums() {
        assert_eq!(status_text(Some(1)), "正常");
        assert_eq!(status_text(Some(2)), "取消资格");
        assert_eq!(status_text(None), "");
        assert_eq!(type_text(Some(1)), "个人认证");
        assert_eq!(type_text(Some(2)), "企业认证");
        assert_eq!(type_text(Some(9)), "");
    }

    #[test]
    fn time_format_matches_java() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(format_time(None), "");
    }

    #[test]
    fn field_whitelist_and_base_data_extraction() {
        assert_eq!(normalize_field("status"), Some("status"));
        assert_eq!(normalize_field("isShow"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");

        let base = serde_json::json!({"type":2,"companyName":"ACME","corporateName":"张三"});
        assert_eq!(base_field_i32(Some(&base), "type"), Some(2));
        assert_eq!(
            base_field_str(Some(&base), "companyName").as_deref(),
            Some("ACME")
        );
        assert_eq!(base_field_str(None, "companyName"), None);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = MerchantVO {
            merchant_id: 3,
            status_text: status_text(Some(1)),
            type_text: type_text(Some(2)),
            shop_count: 2,
            add_time: format_time(Some(1_700_000_000)),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["merchantId"], 3);
        assert_eq!(json["statusText"], "正常");
        assert_eq!(json["typeText"], "企业认证");
        assert_eq!(json["shopCount"], 2);
    }
}
