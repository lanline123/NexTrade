//! 代客下单自提联系人管理域（trade::proxy_shopping_pickup_contact）DTO / VO / 查询参数。
//!
//! 对应原 Java
//! `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingPickupContactController`
//! （`@RequestMapping("/adminapi/proxyShopping/pickupContact")`）所用到的 bean：
//! - `com.tigshop.bean.dto.user.PickupContactListDTO`（分页查询，`extends BasePage`）
//! - `com.tigshop.bean.dto.user.PickupContactCreateDTO`（新建入参）
//! - `com.tigshop.bean.dto.user.PickupContactUpdateDTO`（修改入参）
//! - `com.tigshop.bean.vo.user.PickupContactVO`（出参）
//!
//! JSON 字段全部保持 camelCase，与前端既有请求/响应逐字一致。
//!
//! ## 为什么入参字段一律是 `Option`
//!
//! Java 侧控制器方法**没有** `@Validated`，三个 DTO 也**没有任何** Bean
//! Validation 注解，因此「字段缺失」在 Java 里不是 400，而是**原样交给
//! MyBatis-Plus**：默认 `FieldStrategy.NOT_NULL` 会把 `null` 字段从
//! INSERT / UPDATE 列表里剔除，落到数据库时由列默认值兜底。
//! 例如 `pickup_contact.contact_name` 是 `NOT NULL DEFAULT ''`，
//! 因此 Java 传 `null` 的 `contactName` 会**插入空串**而不是报错；
//! 而 `user_id` 是 `NOT NULL` 且**无默认值**，传 `null` 则报数据库错误。
//!
//! Rust 侧必须保留 `Option` 才能复刻这套语义（见
//! `crates/services/proxy_shopping_pickup_contact.rs` / `crates/infrastructure/src/db/repo/proxy_shopping_pickup_contact.rs`）；
//! 若改成 `String` + `#[serde(default)]`，「字段缺失」会被静默变成空串，
//! 属不可见的语义漂移。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————————————————————

/// 自提联系人分页查询（Java `PickupContactListDTO extends BasePage`）。
///
/// `PickupContactListDTO` 自身只声明了 `userId`，`page` / `size` /
/// `sortField` / `sortOrder` / `keyword` 全部继承自
/// `com.tigshop.common.core.entity.BasePage`。
///
/// 分页语义沿用 Java `BasePage`：`page` 缺省 1，`size` 缺省 15、上限 100。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactListQuery {
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段（Java 属性名驼峰，或真实列名）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余取值见 `repo::crate::models::trade::proxy_shopping_pickup_contact::order_by_clause`）
    pub sort_order: Option<String>,
    /// 查询关键字（Java `BasePage.keyword`）：同时模糊匹配
    /// `contact_name` 与 `contact_phone`
    pub keyword: Option<String>,
    /// 客户ID（Java `PickupContactListDTO.userId`），为空则不过滤
    pub user_id: Option<i32>,
}

impl PickupContactListQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1；非正数按 1 处理）。
    ///
    /// Java 对 `page = 0` / 负数不做校验，只是 `Page.offset()` 在
    /// `current <= 0` 时返回 0，效果等同第一页；此处显式归一为 1。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断为 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数（与 `PageResult` 口径一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }
}

// ——————————————————————————————————————————————————————————————
// 操作入参
// ——————————————————————————————————————————————————————————————

/// 新建入参（Java `PickupContactCreateDTO`）。
///
/// Java 三个字段都没有校验注解；`null` 的字段会被 MyBatis-Plus 从
/// INSERT 列表剔除（详见模块头「为什么入参字段一律是 `Option`」）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactCreateDTO {
    /// 客户ID（`pickup_contact.user_id`，`NOT NULL` 且无默认值）
    pub user_id: Option<i32>,
    /// 联系人名称（列默认 `''`）
    pub contact_name: Option<String>,
    /// 联系人电话（列默认 `''`）
    pub contact_phone: Option<String>,
}

/// 修改入参（Java `PickupContactUpdateDTO`）。
///
/// `userId` 在 Java 里是「非空才更新」；`contactName` / `contactPhone`
/// 为 `null` 时 MyBatis-Plus `updateById` 不会把它们写进 SET 列表
/// （= 保留原值），语义见 `services/proxy_shopping_pickup_contact.rs`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactUpdateDTO {
    /// 主键ID
    pub id: Option<i64>,
    /// 客户ID（为 `None` 时不修改）
    pub user_id: Option<i32>,
    /// 联系人名称（为 `None` 时不修改）
    pub contact_name: Option<String>,
    /// 联系人电话（为 `None` 时不修改）
    pub contact_phone: Option<String>,
}

// ——————————————————————————————————————————————————————————————
// `@RequestParam` 查询串
// ——————————————————————————————————————————————————————————————

/// `listByUserId` 的 `@RequestParam("userId") Integer userId`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactUserIdQuery {
    /// 客户ID（缺失时由服务层报 1001「接口参数缺失」）
    pub user_id: Option<i32>,
}

/// `detail` 的 `@RequestParam("id") Long id`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactIdQuery {
    /// 主键ID（缺失时由服务层报 1001「接口参数缺失」）
    pub id: Option<i64>,
}

// ——————————————————————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————————————————————

/// 自提联系人出参（Java `PickupContactVO`）。
///
/// 字段顺序与 Java 声明顺序一致；不含 `isDel`
/// （逻辑删除列不出现在 Java VO 里）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PickupContactVO {
    /// 主键ID
    pub id: i64,
    /// 客户ID
    pub user_id: i32,
    /// 联系人名称
    pub contact_name: String,
    /// 联系人电话（Java 标注 `@Sensitive(PHONE)`：**仅演示站**脱敏，
    /// 见 `services/proxy_shopping_pickup_contact.rs` 的 `IS_DEMO`）
    pub contact_phone: String,
    /// 创建时间（秒级时间戳，可为 `NULL`）
    pub create_time: Option<i64>,
    /// 更新时间（秒级时间戳，可为 `NULL`）
    pub update_time: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_defaults_match_base_page() {
        let q = PickupContactListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.page_query().page, 1);
    }

    #[test]
    fn page_size_is_capped_at_100() {
        let q: PickupContactListQuery = serde_json::from_str(r#"{"page":2,"size":500}"#).unwrap();
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.page_size(), 100);

        // `pageSize` 别名（前端两种写法都接受）
        let q: PickupContactListQuery = serde_json::from_str(r#"{"pageSize":3}"#).unwrap();
        assert_eq!(q.page_size(), 3);
    }

    #[test]
    fn non_positive_page_and_size_are_normalized() {
        let q: PickupContactListQuery = serde_json::from_str(r#"{"page":0,"size":0}"#).unwrap();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 1);
    }

    #[test]
    fn list_query_deserializes_camel_case() {
        let q: PickupContactListQuery = serde_json::from_str(
            r#"{"page":1,"size":20,"userId":7,"keyword":"138","sortField":"contactName","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.user_id, Some(7));
        assert_eq!(q.keyword.as_deref(), Some("138"));
        assert_eq!(q.sort_field.as_deref(), Some("contactName"));
        assert_eq!(q.sort_order.as_deref(), Some("asc"));
    }

    #[test]
    fn create_and_update_dtos_keep_missing_fields_as_none() {
        // Java 无 @Validated：缺字段必须能反序列化成功（由服务层/仓储复刻
        // MyBatis-Plus 的 NOT_NULL 策略），不能变成 serde 的 400。
        let c: PickupContactCreateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(c.user_id, None);
        assert_eq!(c.contact_name, None);
        assert_eq!(c.contact_phone, None);

        let u: PickupContactUpdateDTO = serde_json::from_str(r#"{"id":9}"#).unwrap();
        assert_eq!(u.id, Some(9));
        assert_eq!(u.user_id, None);
        assert_eq!(u.contact_name, None);
        assert_eq!(u.contact_phone, None);

        // 显式 null 同样落到 None
        let c: PickupContactCreateDTO =
            serde_json::from_str(r#"{"userId":null,"contactName":null}"#).unwrap();
        assert_eq!(c.user_id, None);
        assert_eq!(c.contact_name, None);

        // 空串与缺失必须可区分：空串是「有值」，MyBatis-Plus 会照写
        let c: PickupContactCreateDTO =
            serde_json::from_str(r#"{"contactName":"","contactPhone":""}"#).unwrap();
        assert_eq!(c.contact_name.as_deref(), Some(""));
        assert_eq!(c.contact_phone.as_deref(), Some(""));
    }

    #[test]
    fn request_param_queries_accept_java_parameter_names() {
        let q: PickupContactUserIdQuery = serde_json::from_str(r#"{"userId":12}"#).unwrap();
        assert_eq!(q.user_id, Some(12));
        let q: PickupContactUserIdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.user_id, None);

        let q: PickupContactIdQuery = serde_json::from_str(r#"{"id":3}"#).unwrap();
        assert_eq!(q.id, Some(3));
        let q: PickupContactIdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.id, None);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = PickupContactVO {
            id: 5,
            user_id: 42,
            contact_name: "张三".into(),
            contact_phone: "13812348000".into(),
            create_time: Some(1_700_000_000),
            update_time: None,
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["id"], 5);
        assert_eq!(json["userId"], 42);
        assert_eq!(json["contactName"], "张三");
        assert_eq!(json["contactPhone"], "13812348000");
        assert_eq!(json["createTime"], 1_700_000_000_i64);
        assert!(json["updateTime"].is_null());
        // 逻辑删除列不出现在出参里
        assert!(json.get("isDel").is_none());
    }
}
