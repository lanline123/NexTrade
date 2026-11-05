//! 分销素材（marketing::salesman_material）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - admin `com.tigshop.adminapi.controller.salesman.SalesmanMaterialController`
//!   （`@RequestMapping("/adminapi/salesman/material")`，7 个端点）
//! - public `com.tigshop.api.controller.salesman.SalesmanMaterialController`
//!   （`@RequestMapping("/api/salesman/material")`，3 个端点）
//! - `SalesmanMaterialServiceImpl` + `SalesmanMaterialPageQuery` /
//!   `SalesmanMaterialApiPageQuery` / `SalesmanMaterialSaveParam` /
//!   `SalesmanMaterialEditParam` / `SalesmanMaterialVO`
//!
//! 表：`salesman_material`（10 列：`id` / `add_time` / `is_top` / `content` /
//! `is_available` / `shop_id` / `pics` / `category_id` / `share_num` / `product_id`）；
//! 关联只读 `salesman_material_category`、`product`。
//!
//! # 端点（10）
//! admin：`GET list/detail`、`POST create/update/del/updateField/batch`；
//! public：`GET /api/salesman/material/{list,detail,category}`。
//!
//! # 差异（uncertain_points）
//! 1. `updateField` Java 误用 `CheckFieldConstants.SALESMAN_CONTENT_FIELDS`
//!    （`title/is_top/is_available`），而素材表无 `title`；本实现白名单收敛为
//!    `is_top` / `is_available`（保留 Java 可用部分，避免无效列报错）。
//! 2. Java VO 内嵌完整 `product`（商品实体）与 `category`；Rust 端 `product`
//!    只回填 `productId/productName/productPrice` 精简对象，`category` 回填
//!    素材分类实体字段。
//! 3. Java 列表按 `shopId = HeaderUtils.getShopId()` 过滤；Rust 多租户 `shop_id=0`。
//! 4. public `list`：Java 用「当前分销员的 shopId，否则 -1（空列表）」；Rust
//!    optional auth 未接分销员上下文，固定 `shop_id=0` 且 `is_available=1`。
//! 5. Java 保存入参含 `isShow/sortOrder/status/salesmanMaterialPic` 等历史字段
//!    （素材表无对应列，BeanUtils 直接丢弃）；本实现 DTO 只保留实存列。
//!
//! # 金额：`product.product_price` 为 `Decimal`（仅 VO 精简对象内出现）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// `updateField` 白名单（素材表实存列；见差异 1）。
pub const SALESMAN_MATERIAL_FIELDS: [&str; 2] = ["is_top", "is_available"];
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
pub const MSG_MATERIAL_NOT_FOUND: &str = "素材不存在";
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 素材 VO 内嵌商品精简对象（见差异 2）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanMaterialProductVO {
    pub product_id: i32,
    pub product_name: String,
    pub product_price: Option<Decimal>,
}

/// 素材 VO（Java `SalesmanMaterialVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanMaterialVO {
    pub id: i32,
    pub add_time: String,
    pub is_top: i32,
    pub content: Option<String>,
    pub is_available: Option<i32>,
    pub shop_id: i32,
    pub category_id: Option<i32>,
    pub share_num: Option<i32>,
    pub product_id: Option<i32>,
    /// `pics` 列原始 JSON 文本（Java `picsJson`）
    pub pics_json: Option<String>,
    /// 解析后的图片数组（Java `List<Pic>`）
    pub pics: Option<Value>,
    pub category: Option<Value>,
    pub product: Option<SalesmanMaterialProductVO>,
}

/// admin 列表查询（Java `SalesmanMaterialPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialListQuery {
    pub is_show: Option<i32>,
    pub category_id: Option<i32>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    /// 内部标记：`user` 时仅返回上架素材（Java `from`）
    pub from: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// public 列表查询（Java `SalesmanMaterialApiPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialApiQuery {
    pub category_id: Option<i32>,
    pub from: Option<String>,
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 新增素材（Java `SalesmanMaterialSaveParam` 实存列子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialSaveDTO {
    pub is_top: Option<i32>,
    pub content: Option<String>,
    pub pics: Option<Value>,
    pub category_id: Option<i32>,
    pub product_id: Option<i32>,
}

/// 编辑素材（Java `SalesmanMaterialEditParam` 实存列子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanMaterialEditDTO {
    pub id: Option<i32>,
    pub is_top: Option<i32>,
    pub content: Option<String>,
    pub add_time: Option<i32>,
    pub is_available: Option<i32>,
    pub shop_id: Option<i32>,
    pub pics: Option<Value>,
    pub category_id: Option<i32>,
    pub share_num: Option<i32>,
    pub product_id: Option<i32>,
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

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；0/None → 空串）。
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

/// `yyyy-MM-dd` → Unix 秒（东八区 00:00；非法 → None）。
#[must_use]
pub fn parse_date(raw: Option<&str>) -> Option<i64> {
    use chrono::TimeZone;
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let date = chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d").ok()?;
    chrono::FixedOffset::east_opt(8 * 3600)?
        .from_local_datetime(&date.and_hms_opt(0, 0, 0)?)
        .single()
        .map(|v| v.timestamp())
}

/// `updateField` 字段归一（camelCase / snake_case 均接受）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    let mut snake = String::new();
    for ch in field.chars() {
        if ch.is_ascii_uppercase() {
            snake.push('_');
            snake.push(ch.to_ascii_lowercase());
        } else {
            snake.push(ch);
        }
    }
    SALESMAN_MATERIAL_FIELDS
        .iter()
        .copied()
        .find(|f| *f == snake)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn field_whitelist_matches_material_table() {
        assert_eq!(normalize_field("isTop"), Some("is_top"));
        assert_eq!(normalize_field("is_available"), Some("is_available"));
        // Java 白名单里的 title 在素材表不存在 → 拒绝（差异 1）
        assert_eq!(normalize_field("title"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
    }

    #[test]
    fn time_helpers_match_java() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(parse_date(Some("2023-11-15")), Some(1_699_977_600));
        assert_eq!(parse_date(Some("bad")), None);
        assert_eq!(parse_date(None), None);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = SalesmanMaterialVO {
            id: 3,
            is_top: 1,
            pics: Some(serde_json::json!([{"picThumb": "t.png"}])),
            product: Some(SalesmanMaterialProductVO {
                product_id: 9,
                product_name: "商品".into(),
                product_price: Some("1.50".parse().unwrap()),
            }),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["id"], 3);
        assert_eq!(json["isTop"], 1);
        assert_eq!(json["product"]["productId"], 9);
        assert_eq!(json["product"]["productPrice"], "1.50");
        assert!(json["pics"].is_array());
    }

    #[test]
    fn edit_dto_accepts_fields() {
        let d: SalesmanMaterialEditDTO = serde_json::from_str(
            r#"{"id":3,"isTop":1,"isAvailable":0,"pics":[{"picUrl":"a.png"}],"categoryId":2}"#,
        )
        .unwrap();
        assert_eq!(d.id, Some(3));
        assert_eq!(d.is_top, Some(1));
        assert_eq!(d.pics.as_ref().unwrap()[0]["picUrl"], "a.png");
    }
}
