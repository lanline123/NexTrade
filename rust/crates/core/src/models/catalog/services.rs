//! 商品服务域（catalog::services）DTO / VO / 查询参数 + 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.product.ServicesController`
//!   （`@RequestMapping("/adminapi/product/productServices")`）
//! - `com.tigshop.service.product.impl.ServicesServiceImpl`
//! - `com.tigshop.bean.dto.product.ServicesDTO`（请求与响应同一个 DTO）
//! - `com.tigshop.bean.model.product.Services`（表 `product_services`）
//! - `com.tigshop.service.common.impl.BaseServiceImpl`
//!   （`del` / `batch` / `updateField` 的通用实现）
//! - `com.tigshop.common.constant.CheckFieldConstants#SERVICES_FIELDS`
//! - `com.tigshop.common.constant.product.ServicesConstants`
//! - `com.tigshop.common.constant.ResultTextConstants#INVALID_FIELD_VALUE`
//!
//! # 端点（7 条，路径逐字符对齐 `docs/api-contract.json`）
//!
//! | method | path | 原 Java | 落点（services 层） |
//! |--------|------|---------|---------------------|
//! | `GET`  | `/adminapi/product/productServices/list` | `ServicesController.list` | `ServicesService::list` |
//! | `GET`  | `/adminapi/product/productServices/detail` | `ServicesController.detail` | `ServicesService::detail` |
//! | `POST` | `/adminapi/product/productServices/create` | `ServicesController.create` | `ServicesService::create` |
//! | `POST` | `/adminapi/product/productServices/update` | `ServicesController.update` | `ServicesService::update` |
//! | `POST` | `/adminapi/product/productServices/del` | `ServicesController.del` | `ServicesService::delete` |
//! | `POST` | `/adminapi/product/productServices/batch` | `ServicesController.batch` | `ServicesService::batch` |
//! | `POST` | `/adminapi/product/productServices/updateField` | `ServicesController.updateField` | `ServicesService::update_field` |
//!
//! # 表 / 列（权威来源 `java/database/pure.sql`）
//!
//! 用 `cd rust && python tools/schema_parser.py --table product_services` 核对：
//! `product_service_id` / `product_service_name` / `product_service_desc` /
//! `ico_img` / `sort_order` / `default_on` / `shop_id`（7 列）。
//!
//! DDL 默认值（Java `save` 走 MyBatis-Plus `NOT_NULL` 策略时由库兜底）：
//! `product_service_name=''`、`product_service_desc=''`、`ico_img=''`、
//! `sort_order=50`、`default_on=0`、`shop_id=0`。Rust 侧 INSERT 显式列出全部
//! 列，因此必须在服务层按同样默认值补齐，见 [`DEFAULT_SORT_ORDER`] 等常量。
//!
//! # 与 Java 的差异（`uncertain_points`）
//!
//! 1. **校验注解实际未生效**：Java 控制器 `create` / `update` 的参数是
//!    `@RequestBody ServicesDTO`（**没有** `@Valid`），类上的 `@Validated`
//!    不会触达 `@RequestBody` 内部约束，因此 `@NotNull` / `@Size` 在 Java
//!    里是**死注解**。本实现仍按注解本意做校验（名称必填、≤100 字），
//!    错误文案逐字符照抄 `ServicesConstants`。
//! 2. **`del` / `batch` 的缺失 ID**：Java `BaseServiceImpl#del(null)` 与
//!    `batch` 的非法 type 都只返回 `false`（控制器返回 `void` → HTTP 200）。
//!    本实现同样以「成功但无副作用」返回，不抛业务错误。
//! 3. **分页返回结构**：Java 是 MyBatis-Plus `Page<ServicesDTO>`
//!    （`records/total/size/current/pages`），Rust 统一 `PageResult`
//!    （`list/total/totalPage/pageSize/page`）。
//! 4. `updateField` 的 Java 通用实现不按店铺过滤（本实现一致）；列名走
//!    白名单 [`SERVICES_FIELDS`]。
//!
//! # 金额
//!
//! 本域不涉及任何金额列，故无 `rust_decimal::Decimal`。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java / DDL）
// ——————————————————————————————————————————————

/// `updateField` 允许更新的列白名单
/// （Java `CheckFieldConstants.SERVICES_FIELDS`）。
pub const SERVICES_FIELDS: [&str; 4] = [
    "product_service_name",
    "product_service_desc",
    "default_on",
    "sort_order",
];

/// `sort_order` 的 DDL 默认值（`NOT NULL DEFAULT '50'`）。
pub const DEFAULT_SORT_ORDER: i32 = 50;

/// `default_on` 的 DDL 默认值（`NOT NULL DEFAULT '0'`）。
pub const DEFAULT_ON: i32 = 0;

/// `shop_id` 的 DDL 默认值（`NOT NULL DEFAULT '0'`）。
pub const DEFAULT_SHOP_ID: i32 = 0;

/// 商品服务名称最大长度（Java `@Size(max = 100)`，按字符数）。
pub const SERVICE_NAME_MAX_LEN: usize = 100;

/// Java `ServicesConstants.SERVICE_NAME_IS_NULL`。
pub const MSG_SERVICE_NAME_REQUIRED: &str = "商品服务名称不能为空";

/// Java `ServicesConstants.SERVICE_NAME_OVER_LENGTH`。
pub const MSG_SERVICE_NAME_TOO_LONG: &str = "商品服务名称长度不能超过100";

/// Java `ServicesConstants.SERVICE_NOT_FOUND`。
pub const MSG_SERVICE_NOT_FOUND: &str = "商品服务不存在";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// `OperateDTO.id` 的 `@NotNull(message = "id不能为空")`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// `UpdateFieldDTO.field` 的 `@NotNull(message = "字段名不能为空")`。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// `UpdateFieldDTO.val` 的 `@NotNull(message = "值不能为空")`。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// 商品服务列表查询参数（Java `BasePage`：`page` / `size` /
/// `sortField` / `sortOrder` / `keyword`）。
///
/// Java 只使用 `keyword`（LIKE `product_service_name`）与排序分页，
/// 其余 `BasePage` 字段（`sortItems`）未迁移，见模块头。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServicesListQuery {
    /// 关键词（匹配 `product_service_name`）
    pub keyword: Option<String>,
    /// 页码，缺省 1
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（Java 实体属性名或数据库列名，未知回退主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序）
    pub sort_order: Option<String>,
}

// ——————————————————————————————————————————————
// 入参 / 出参
// ——————————————————————————————————————————————

/// 商品服务 DTO（Java `ServicesDTO`：**请求与响应同一个结构**）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServicesDTO {
    /// 服务 ID（Java `productServiceId`）
    pub product_service_id: Option<i32>,
    /// 服务名称（`@NotNull` + `@Size(max = 100)`，见模块头差异第 1 条）
    pub product_service_name: Option<String>,
    /// 服务描述
    pub product_service_desc: Option<String>,
    /// 服务图标
    pub ico_img: Option<String>,
    /// 排序（DDL 默认 50）
    pub sort_order: Option<i32>,
    /// 默认开启：1 是 0 否
    pub default_on: Option<i32>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

/// 单 ID 操作请求（Java `com.tigshop.bean.dto.common.OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表
    pub ids: Option<Vec<i32>>,
    /// 操作类型，仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（本域 batch 未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名（驼峰属性名或数据库列名）
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 空白判定（对齐 Java `StrUtil.isBlank`）。
#[must_use]
pub fn is_blank(raw: Option<&str>) -> bool {
    raw.map(str::trim).is_none_or(str::is_empty)
}

/// 商品服务名称校验（Java `@NotNull` + `@Size(max = 100)` 的等价物）。
///
/// 返回**去首尾空白后**的名称（与既有 feature 的校验口径一致）。
///
/// # Errors
/// 返回与 Java 注解 `message` 逐字符一致的文案。
pub fn validate_service_name(raw: Option<&str>) -> std::result::Result<String, String> {
    let name = raw
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_SERVICE_NAME_REQUIRED.to_string())?;
    // Java `@Size` 按字符数（UTF-16 code unit）计算；名称均为 BMP 字符，
    // 这里按 `char` 计数等价。
    if name.chars().count() > SERVICE_NAME_MAX_LEN {
        return Err(MSG_SERVICE_NAME_TOO_LONG.to_string());
    }
    Ok(name.to_string())
}

/// `updateField` 字段名归一（Java `getColumnByPropertyName` +
/// `SERVICES_FIELDS`）：驼峰属性名或数据库列名都接受，白名单外返回 `None`
/// （调用方据此报 [`MSG_INVALID_FIELD_VALUE`]，与 Java 行为一致）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    let snake = to_snake(field);
    SERVICES_FIELDS.iter().copied().find(|f| *f == snake)
}

/// 驼峰 → 下划线（允许前端传驼峰属性名或数据库列名）。
#[must_use]
pub fn to_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for ch in s.chars() {
        if ch.is_ascii_uppercase() {
            out.push('_');
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 名称校验：必填与长度上限的文案逐字符对齐 `ServicesConstants`。
    #[test]
    fn service_name_validation_messages_are_verbatim() {
        assert_eq!(
            validate_service_name(None).unwrap_err(),
            MSG_SERVICE_NAME_REQUIRED
        );
        assert_eq!(
            validate_service_name(Some("   ")).unwrap_err(),
            MSG_SERVICE_NAME_REQUIRED
        );
        assert_eq!(MSG_SERVICE_NAME_REQUIRED, "商品服务名称不能为空");

        // 100 字合法（按字符数，不是字节数）
        let ok = "服".repeat(100);
        assert!(validate_service_name(Some(&ok)).is_ok());
        let too_long = "服".repeat(101);
        assert_eq!(
            validate_service_name(Some(&too_long)).unwrap_err(),
            MSG_SERVICE_NAME_TOO_LONG
        );
        assert_eq!(MSG_SERVICE_NAME_TOO_LONG, "商品服务名称长度不能超过100");
        // 去首尾空白
        assert_eq!(validate_service_name(Some("  包邮 ")).unwrap(), "包邮");
    }

    /// `updateField` 白名单逐条对齐 Java `SERVICES_FIELDS`。
    #[test]
    fn update_field_whitelist_matches_java_constant() {
        assert_eq!(
            SERVICES_FIELDS,
            [
                "product_service_name",
                "product_service_desc",
                "default_on",
                "sort_order"
            ]
        );
        assert_eq!(
            normalize_field("productServiceName"),
            Some("product_service_name")
        );
        assert_eq!(
            normalize_field("product_service_name"),
            Some("product_service_name")
        );
        assert_eq!(
            normalize_field("productServiceDesc"),
            Some("product_service_desc")
        );
        assert_eq!(normalize_field("defaultOn"), Some("default_on"));
        assert_eq!(normalize_field("sortOrder"), Some("sort_order"));
        // 图标 / 店铺 ID / 主键不在白名单 → 报 `field 的值有误`
        assert_eq!(normalize_field("icoImg"), None);
        assert_eq!(normalize_field("shopId"), None);
        assert_eq!(normalize_field("productServiceId"), None);
        assert_eq!(normalize_field("1;DROP TABLE product_services"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
    }

    /// DDL 默认值常量与 `pure.sql` 对齐。
    #[test]
    fn ddl_defaults_match_schema() {
        assert_eq!(DEFAULT_SORT_ORDER, 50);
        assert_eq!(DEFAULT_ON, 0);
        assert_eq!(DEFAULT_SHOP_ID, 0);
        assert_eq!(SERVICE_NAME_MAX_LEN, 100);
    }

    /// 列表查询：camelCase + `size` / `pageSize` 双写法。
    #[test]
    fn list_query_accepts_camel_case_and_size_alias() {
        let q: ServicesListQuery = serde_json::from_str(
            r#"{"keyword":"包邮","page":2,"size":30,"sortField":"sortOrder","sortOrder":"asc"}"#,
        )
        .expect("ServicesListQuery 应接受 camelCase");
        assert_eq!(q.keyword.as_deref(), Some("包邮"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.sort_field.as_deref(), Some("sortOrder"));
        assert_eq!(q.sort_order.as_deref(), Some("asc"));

        let q2: ServicesListQuery = serde_json::from_str(r#"{"pageSize":20}"#).unwrap();
        assert_eq!(q2.page_size, Some(20));
    }

    /// 响应 DTO 序列化字段名与 Java `ServicesDTO` 一致。
    #[test]
    fn services_dto_serializes_camel_case() {
        let dto = ServicesDTO {
            product_service_id: Some(1),
            product_service_name: Some("售全球".into()),
            product_service_desc: Some("支持海外收货".into()),
            ico_img: Some("https://oss.example/i.png".into()),
            sort_order: Some(50),
            default_on: Some(1),
            shop_id: Some(0),
        };
        let json = serde_json::to_value(&dto).unwrap();
        assert_eq!(json["productServiceId"], 1);
        assert_eq!(json["productServiceName"], "售全球");
        assert_eq!(json["icoImg"], "https://oss.example/i.png");
        assert_eq!(json["sortOrder"], 50);
        assert_eq!(json["defaultOn"], 1);
        assert_eq!(json["shopId"], 0);

        // 反向：请求体 camelCase 可解析
        let back: ServicesDTO =
            serde_json::from_str(r#"{"productServiceName":"包邮","sortOrder":3,"defaultOn":0}"#)
                .unwrap();
        assert_eq!(back.product_service_name.as_deref(), Some("包邮"));
        assert_eq!(back.sort_order, Some(3));
    }

    /// 驼峰转换幂等（列名原样传入也命中白名单）。
    #[test]
    fn snake_conversion_is_idempotent_for_snake_input() {
        assert_eq!(to_snake("default_on"), "default_on");
        assert_eq!(to_snake("defaultOn"), "default_on");
    }
}
