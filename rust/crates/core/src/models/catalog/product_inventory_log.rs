//! 库存日志（`product_inventory_log`）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.product.ProductInventoryLogPageQuery`（列表查询）
//! - `com.tigshop.bean.vo.product.ProductInventoryLogVO`（列表行）
//! - `com.tigshop.mapper.product.ProductInventoryLogMapper.xml#productInventoryLog`
//!
//! 表结构（`python tools/schema_parser.py --table product_inventory_log`，10 列）：
//! `log_id` / `product_id` / `spec_id` / `number` / `add_time` / `old_number` /
//! `type` / `change_number` / `desc` / `shop_id`。
//!
//! **时间口径**：`add_time` 为秒级 `int`，VO 输出 `yyyy-MM-dd HH:mm:ss`
//! （Java `TimestampToDateSerializer`）。

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

/// `BasePage` 默认分页大小（Java `BasePage.getSize()`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// `BasePage` 分页大小上限（Java `getSize()` 截断到 100）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 库存日志列表查询参数（对应 Java `ProductInventoryLogPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductInventoryLogQuery {
    /// 关键词（Java `BasePage.keyword`，按 `product.product_name` LIKE）
    pub keyword: Option<String>,
    /// 页码
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，兼容 `pageSize`）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`；`init()` 缺省写入 `add_time` + `desc`）
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
    /// 类型：1 增，2 减；`0` / 缺省不过滤
    pub r#type: Option<i32>,
    /// 店铺 ID（Java 由请求头 `HeaderUtils.getShopId()` 写入；Rust 由查询参数传入）
    pub shop_id: Option<i32>,
}

impl ProductInventoryLogQuery {
    /// 转成工作区统一分页类型（`BasePage`：缺省 15、上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .page_size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// 排序方向（Java `buildSortOrder`：仅显式 `asc` 升序）。
    #[must_use]
    pub fn ascending(&self) -> bool {
        self.sort_order
            .as_deref()
            .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
    }
}

/// 库存日志列表行（对应 Java `ProductInventoryLogVO`）。
///
/// `productName` 由 `LEFT JOIN product` 回填；`sn` / `skuValue` 由服务层按
/// `spec_id` / `product_id` 二次查询补全（Java 同样在循环内补全）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductInventoryLogVO {
    /// 日志 ID
    pub log_id: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// 规格 ID（>0 表示 SKU 级日志）
    pub spec_id: Option<i32>,
    /// 剩余库存
    pub number: Option<i32>,
    /// 原始库存
    pub old_number: Option<i32>,
    /// 类型：1 增，2 减
    pub r#type: Option<i32>,
    /// 变化数量
    pub change_number: Option<i32>,
    /// 描述
    pub desc: Option<String>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 商品名称（LEFT JOIN `product`）
    pub product_name: Option<String>,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    /// 编号：SKU 级取 `sku_sn`，单规格取 `product_sn`
    pub sn: Option<String>,
    /// 规格文本：`规格: 规格值, 规格: 规格值`
    pub sku_value: Option<String>,
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TimestampToDateSerializer`：
/// 空 / 0 / 负值返回空串；本地时区）。
#[must_use]
pub fn fmt_seconds(secs: Option<i32>) -> String {
    let Some(secs) = secs.filter(|v| *v > 0) else {
        return String::new();
    };
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// `sku_data` JSON → `规格:规格值` 逗号串（Java
/// `ProductInventoryLogServiceImpl#list`：翻译 `name` / `value` 后拼
/// `name:value,`；翻译域未迁移，返回原始文案）。
#[must_use]
pub fn format_sku_value(raw: Option<&str>) -> String {
    let Some(raw) = raw.filter(|s| !s.trim().is_empty()) else {
        return String::new();
    };
    let Ok(serde_json::Value::Array(items)) = serde_json::from_str::<serde_json::Value>(raw) else {
        return String::new();
    };
    let parts: Vec<String> = items
        .iter()
        .filter_map(|v| {
            let o = v.as_object()?;
            let name = o.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let value = o.get("value").and_then(|v| v.as_str()).unwrap_or("");
            Some(format!("{name}:{value}"))
        })
        .collect();
    parts.join(",")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_query_uses_base_page_defaults() {
        let q = ProductInventoryLogQuery::default();
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 15);
        let q = ProductInventoryLogQuery {
            page: Some(0),
            page_size: Some(999),
            ..Default::default()
        };
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 100);
    }

    #[test]
    fn sort_direction_matches_java_build_sort_order() {
        assert!(!ProductInventoryLogQuery::default().ascending());
        let q = ProductInventoryLogQuery {
            sort_order: Some("ASC".into()),
            ..Default::default()
        };
        assert!(q.ascending());
        let q = ProductInventoryLogQuery {
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert!(!q.ascending());
    }

    #[test]
    fn fmt_seconds_handles_zero_and_negative() {
        assert_eq!(fmt_seconds(None), "");
        assert_eq!(fmt_seconds(Some(0)), "");
        assert_eq!(fmt_seconds(Some(-1)), "");
        assert_eq!(fmt_seconds(Some(1_700_000_000)).len(), 19);
    }

    #[test]
    fn format_sku_value_matches_java_loop() {
        assert_eq!(format_sku_value(None), "");
        assert_eq!(format_sku_value(Some("")), "");
        assert_eq!(format_sku_value(Some("oops")), "");
        assert_eq!(
            format_sku_value(Some(
                r#"[{"name":"颜色","value":"红"},{"name":"尺寸","value":"L"}]"#
            )),
            "颜色:红,尺寸:L"
        );
    }
}
