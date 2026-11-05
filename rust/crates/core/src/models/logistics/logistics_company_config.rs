//! 物流公司配置域（logistics::logistics_company_config）DTO / VO / 查询参数 / 入参。
//! 对应 Java `com.tigshop.adminapi.controller.setting.LogisticsCompanyConfigController`
//! （`@RequestMapping("/adminapi/setting/logisticsCompanyConfig")`）及其依赖的
//! `bean.dto.setting.LogisticsCompanyConfigListDTO` /
//! `bean.dto.setting.LogisticsCompanyConfigCreateDTO` /
//! `bean.dto.setting.LogisticsCompanyConfigUpdateDTO` /
//! `bean.vo.setting.LogisticsCompanyConfigVO` /
//! `bean.dto.common.OperateDTO` / `bean.dto.common.UpdateFieldDTO` /
//! `common.core.entity.BasePage`。
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | [`LogisticsCompanyConfigListQuery`] | `LogisticsCompanyConfigListDTO extends BasePage` |
//! | [`LogisticsCompanyConfigCreateDTO`] | `LogisticsCompanyConfigCreateDTO` |
//! | [`LogisticsCompanyConfigUpdateDTO`] | `LogisticsCompanyConfigUpdateDTO` |
//! | [`LogisticsCompanyConfigVO`] | `LogisticsCompanyConfigVO` |
//! | [`OperateDTO`] | `dto.common.OperateDTO` |
//! | [`UpdateFieldDTO`] | `dto.common.UpdateFieldDTO` |
//!
//! **说明（重复定义原因）**：`OperateDTO` / `UpdateFieldDTO` 在
//! `models::shop_manage` / `models::catalog` 已有同构版本，但本切片不得修改
//! 共享文件（`models/mod.rs`），故在本文件内定义自己的副本。
//! 主会话合并时如需统一可替换。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；可选数值用 `Option<...>`
//! 与 Java VO 的 `null` 语义一致。本域**无金额字段**（物流公司配置全部是
//! 面单账号/模板类字符串与整型开关），故不涉及 `rust_decimal::Decimal`。
//!
//! 列名严格对齐 `java/database/pure.sql` 的 `logistics_company_config`：
//! `config_id` / `logistics_id` / `shop_id` / `vendor_id` / `customer_name` /
//! `customer_pwd` / `month_code` / `send_site` / `send_staff` / `exp_type` /
//! `kuaidi100_partner_id` / `kuaidi100_partner_key` / `kuaidi100_partner_secret` /
//! `kuaidi100_net` / `kuaidi100_check_man` / `kuaidi100_exp_type` /
//! `kuaidi100_temp_id` / `kuaidi100_child_temp_id` / `kuaidi100_back_temp_id` /
//! `sort_order` / `is_default` / `is_enabled`。

use serde::{Deserialize, Serialize};

/// `updateField` 允许更新的列（Java 控制器常量
/// `LogisticsCompanyConfigController.CONFIG_UPDATE_FIELDS`）。
pub const CONFIG_UPDATE_FIELDS: [&str; 2] = ["is_enabled", "sort_order"];

/// 创建时 `sortOrder` 的默认值（Java `create`：`config.getSortOrder() == null` → 50）。
pub const DEFAULT_SORT_ORDER: i32 = 50;

/// 创建时 `isEnabled` 的默认值（Java `create`：`config.getIsEnabled() == null` → 1）。
pub const DEFAULT_IS_ENABLED: i32 = 1;

/// 物流公司配置分页查询（`LogisticsCompanyConfigListDTO extends BasePage`）。
///
/// 字段沿用 Java `BasePage`：`page`（默认 1）、`size`（默认 15，上限 100）、
/// `keyword`（模糊匹配 `logistics_company.logistics_name`）、`sortField` /
/// `sortOrder` / `sortItems`（本域 `list` **只调用**
/// `buildSortOrder(page, sortField, sortOrder)`，未处理 `sortItems`）。
/// 前端亦可能传 `pageSize`，故加 alias。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyConfigListQuery {
    /// 是否启用：1 启用，0 禁用（不传则不过滤）
    pub is_enabled: Option<i32>,
    /// 物流服务商类型：1 快递鸟，2 快递100；不传或非法值不过滤
    pub provider_type: Option<i32>,
    /// 关键词（Java `BasePage.keyword`，模糊匹配 `logistics_name`）
    pub keyword: Option<String>,
    /// 排序字段（Java 属性名，驼峰；空或等于主键属性名时回落主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空按降序）
    pub sort_order: Option<String>,
    /// 页码，从 1 开始（Java `BasePage.getPage()`）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
}

impl LogisticsCompanyConfigListQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// 关键词（去除首尾空白后的非空值）。
    #[must_use]
    pub fn keyword_trimmed(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 是否为合法的物流服务商类型（Java 只识别 1 / 2，其余视为不过滤）。
    ///
    /// 对应 Java `list` 中的判定：
    /// `Integer.valueOf(1).equals(providerType) || Integer.valueOf(2).equals(providerType)`。
    #[must_use]
    pub fn provider_type_valid(&self) -> Option<i32> {
        match self.provider_type {
            Some(t @ (1 | 2)) => Some(t),
            _ => None,
        }
    }
}

/// 物流公司配置创建入参（`dto.setting.LogisticsCompanyConfigCreateDTO`）。
///
/// `logistics_id` 在 Java 侧标了 `@NotNull(message = "物流公司不能为空")`。
/// 其余字段全部可选，落库时缺省为空串 / `None`（见服务层 `create`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyConfigCreateDTO {
    /// 物流公司 ID（`@NotNull`）
    pub logistics_id: Option<i32>,
    /// 客户编码
    pub customer_name: Option<String>,
    /// 密码
    pub customer_pwd: Option<String>,
    /// 月结号
    pub month_code: Option<String>,
    /// 网点编码
    pub send_site: Option<String>,
    /// 网点名称
    pub send_staff: Option<String>,
    /// 快递业务类型
    pub exp_type: Option<String>,
    /// 快递100电子面单-电子面单账户/月结账号 partnerId
    pub kuaidi100_partner_id: Option<String>,
    /// 快递100电子面单-电子面单密码 partnerKey
    pub kuaidi100_partner_key: Option<String>,
    /// 快递100电子面单-电子面单密钥 partnerSecret
    pub kuaidi100_partner_secret: Option<String>,
    /// 快递100电子面单-收件网点名 net
    pub kuaidi100_net: Option<String>,
    /// 快递100电子面单-承载快递员名 checkMan
    pub kuaidi100_check_man: Option<String>,
    /// 快递100电子面单-产品类型 expType
    pub kuaidi100_exp_type: Option<String>,
    /// 快递100电子面单-主单模板ID tempId（IMAGE/HTML/CLOUD 网点面单必填）
    pub kuaidi100_temp_id: Option<String>,
    /// 快递100电子面单-子单模板ID childTempId
    pub kuaidi100_child_temp_id: Option<String>,
    /// 快递100电子面单-回单模板ID backTempId
    pub kuaidi100_back_temp_id: Option<String>,
    /// 排序（缺省 50）
    pub sort_order: Option<i32>,
    /// 是否启用：1 启用，0 禁用（缺省 1）
    pub is_enabled: Option<i32>,
}

/// 物流公司配置更新入参（`dto.setting.LogisticsCompanyConfigUpdateDTO`）。
///
/// 字段与创建入参一致，另加必填的 `id`。
/// Java 侧 `BeanUtils.copyProperties(updateDTO, config)` **只复制非 null 属性**
/// （Spring `BeanUtils` 语义），故未传的字段保持库中原值 —— 服务层据此
/// 生成「仅更新显式传入列」的动态 SET 子句。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyConfigUpdateDTO {
    /// 配置 ID（`@NotNull(message = "配置ID不能为空")`）
    pub id: Option<i32>,
    /// 物流公司 ID（改绑时校验重复）
    pub logistics_id: Option<i32>,
    /// 客户编码
    pub customer_name: Option<String>,
    /// 密码
    pub customer_pwd: Option<String>,
    /// 月结号
    pub month_code: Option<String>,
    /// 网点编码
    pub send_site: Option<String>,
    /// 网点名称
    pub send_staff: Option<String>,
    /// 快递业务类型
    pub exp_type: Option<String>,
    /// 快递100电子面单-电子面单账户/月结账号 partnerId
    pub kuaidi100_partner_id: Option<String>,
    /// 快递100电子面单-电子面单密码 partnerKey
    pub kuaidi100_partner_key: Option<String>,
    /// 快递100电子面单-电子面单密钥 partnerSecret
    pub kuaidi100_partner_secret: Option<String>,
    /// 快递100电子面单-收件网点名 net
    pub kuaidi100_net: Option<String>,
    /// 快递100电子面单-承载快递员名 checkMan
    pub kuaidi100_check_man: Option<String>,
    /// 快递100电子面单-产品类型 expType
    pub kuaidi100_exp_type: Option<String>,
    /// 快递100电子面单-主单模板ID tempId（IMAGE/HTML/CLOUD 网点面单必填）
    pub kuaidi100_temp_id: Option<String>,
    /// 快递100电子面单-子单模板ID childTempId
    pub kuaidi100_child_temp_id: Option<String>,
    /// 快递100电子面单-回单模板ID backTempId
    pub kuaidi100_back_temp_id: Option<String>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: Option<i32>,
}

/// 物流公司配置 VO（`vo.setting.LogisticsCompanyConfigVO`）。
///
/// 字段顺序与 Java VO 一致。`logisticsName` / `logisticsCode` /
/// `kuaidi100Code` / `logisticsDesc` 四列**不在** `logistics_company_config`
/// 表上，由服务层用 `logistics_company` 关联回填（Java 侧逐条 `getById`
/// 或列表场景按 `logisticsIds` 批量 `listByIds` + `Map` 关联）。
///
/// 注意 Java VO **不含** `shopId` / `vendorId`：`BeanUtils.copyProperties`
/// 只复制同名属性，而 VO 未声明这两列，故租户信息不外泄。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogisticsCompanyConfigVO {
    /// 配置 ID
    pub config_id: i32,
    /// 物流公司 ID
    pub logistics_id: i32,
    /// 物流公司名称（关联 `logistics_company.logistics_name`）
    pub logistics_name: Option<String>,
    /// 物流公司编号（关联 `logistics_company.logistics_code`）
    pub logistics_code: Option<String>,
    /// 快递100快递公司编码（关联 `logistics_company.kuaidi100_code`）
    pub kuaidi100_code: Option<String>,
    /// 物流公司描述（关联 `logistics_company.logistics_desc`）
    pub logistics_desc: Option<String>,
    /// 客户编码
    pub customer_name: Option<String>,
    /// 密码
    pub customer_pwd: Option<String>,
    /// 月结号
    pub month_code: Option<String>,
    /// 网点编码
    pub send_site: Option<String>,
    /// 网点名称
    pub send_staff: Option<String>,
    /// 快递业务类型
    pub exp_type: Option<String>,
    /// 快递100电子面单-电子面单账户/月结账号 partnerId
    pub kuaidi100_partner_id: String,
    /// 快递100电子面单-电子面单密码 partnerKey
    pub kuaidi100_partner_key: String,
    /// 快递100电子面单-电子面单密钥 partnerSecret
    pub kuaidi100_partner_secret: String,
    /// 快递100电子面单-收件网点名 net
    pub kuaidi100_net: String,
    /// 快递100电子面单-承载快递员名 checkMan
    pub kuaidi100_check_man: String,
    /// 快递100电子面单-产品类型 expType
    pub kuaidi100_exp_type: String,
    /// 快递100电子面单-主单模板ID tempId（IMAGE/HTML/CLOUD 网点面单必填）
    pub kuaidi100_temp_id: String,
    /// 快递100电子面单-子单模板ID childTempId
    pub kuaidi100_child_temp_id: String,
    /// 快递100电子面单-回单模板ID backTempId
    pub kuaidi100_back_temp_id: String,
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否默认：1 默认，0 非默认
    pub is_default: Option<i32>,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: Option<i32>,
}

/// 通用操作入参（`dto.common.OperateDTO`），本域 `del` 使用。
///
/// Java 侧 `OperateDTO` 除 `id` 外还有 `type` 等字段，本域只读 `id`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 通用字段更新入参（`dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（`@NotNull`）
    pub id: Option<i32>,
    /// 字段名（`@NotNull`；驼峰属性名或库列名）
    pub field: Option<String>,
    /// 值（`@NotNull`，字符串形态）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_query_defaults_match_java_base_page() {
        let q = LogisticsCompanyConfigListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        assert_eq!(q.is_enabled, None);
        assert_eq!(q.provider_type, None);
        assert_eq!(q.keyword_trimmed(), None);
    }

    #[test]
    fn list_query_clamps_size_and_accepts_page_size_alias() {
        let q: LogisticsCompanyConfigListQuery =
            serde_json::from_str(r#"{"pageSize":500}"#).unwrap();
        assert_eq!(q.page_size(), 100);
        let q: LogisticsCompanyConfigListQuery = serde_json::from_str(r#"{"size":0}"#).unwrap();
        assert_eq!(q.page_size(), 1);
    }

    #[test]
    fn provider_type_only_accepts_1_and_2() {
        let mut q = LogisticsCompanyConfigListQuery::default();
        assert_eq!(q.provider_type_valid(), None);
        q.provider_type = Some(1);
        assert_eq!(q.provider_type_valid(), Some(1));
        q.provider_type = Some(2);
        assert_eq!(q.provider_type_valid(), Some(2));
        // Java: 不传或非法值不过滤
        q.provider_type = Some(3);
        assert_eq!(q.provider_type_valid(), None);
        q.provider_type = Some(0);
        assert_eq!(q.provider_type_valid(), None);
    }

    #[test]
    fn keyword_trimmed_drops_blank() {
        let mut q = LogisticsCompanyConfigListQuery::default();
        q.keyword = Some("   ".into());
        assert_eq!(q.keyword_trimmed(), None);
        q.keyword = Some(" 顺丰 ".into());
        assert_eq!(q.keyword_trimmed(), Some("顺丰"));
    }

    #[test]
    fn create_dto_accepts_camel_case_json() {
        let d: LogisticsCompanyConfigCreateDTO = serde_json::from_str(
            r#"{"logisticsId":3,"customerName":"c","customerPwd":"p","monthCode":"m",
                "sendSite":"s","sendStaff":"n","expType":"e","kuaidi100PartnerId":"pi",
                "kuaidi100PartnerKey":"pk","kuaidi100PartnerSecret":"ps","kuaidi100Net":"net",
                "kuaidi100CheckMan":"man","kuaidi100ExpType":"et","kuaidi100TempId":"ti",
                "kuaidi100ChildTempId":"ci","kuaidi100BackTempId":"bi",
                "sortOrder":8,"isEnabled":0}"#,
        )
        .expect("CreateDTO 应接受 camelCase");
        assert_eq!(d.logistics_id, Some(3));
        assert_eq!(d.sort_order, Some(8));
        assert_eq!(d.is_enabled, Some(0));
        assert_eq!(d.kuaidi100_partner_key.as_deref(), Some("pk"));
    }

    #[test]
    fn update_dto_keeps_unset_fields_as_none() {
        // Java BeanUtils.copyProperties 只复制非 null 属性 → 未传字段不落库
        let d: LogisticsCompanyConfigUpdateDTO =
            serde_json::from_str(r#"{"id":7,"isEnabled":0}"#).unwrap();
        assert_eq!(d.id, Some(7));
        assert_eq!(d.is_enabled, Some(0));
        assert_eq!(d.logistics_id, None);
        assert_eq!(d.sort_order, None);
        assert_eq!(d.customer_name, None);
    }

    #[test]
    fn update_field_constants_match_java_controller() {
        assert_eq!(CONFIG_UPDATE_FIELDS, ["is_enabled", "sort_order"]);
        assert_eq!(DEFAULT_SORT_ORDER, 50);
        assert_eq!(DEFAULT_IS_ENABLED, 1);
    }

    #[test]
    fn operate_and_update_field_dtos() {
        let o: OperateDTO = serde_json::from_str(r#"{"id":9}"#).unwrap();
        assert_eq!(o.id, Some(9));
        let u: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":9,"field":"isEnabled","val":"0"}"#).unwrap();
        assert_eq!(u.field.as_deref(), Some("isEnabled"));
        assert_eq!(u.val.as_deref(), Some("0"));
    }

    #[test]
    fn vo_serializes_camel_case_without_tenant_columns() {
        let vo = LogisticsCompanyConfigVO {
            config_id: 1,
            logistics_id: 2,
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["configId"], 1);
        assert_eq!(v["logisticsId"], 2);
        // Java VO 未声明 shopId / vendorId
        assert!(v.get("shopId").is_none());
        assert!(v.get("vendorId").is_none());
    }
}
