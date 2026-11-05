//! 礼品卡分组域（marketing::gift_card_groups）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.promotion.GiftCardGroups`（表 `gift_card_groups`）
//! - `GiftCardGroupsPageQuery` / `GiftCardGroupsCreateParam` / `GiftCardGroupsUpdateParam` /
//!   `GiftCardGroupIdParam`
//! - `GiftCardGroupsVO`（+ `initTypeName`）
//! - 枚举 `GiftGroupsEnum` / `GiftCardEnum` / `ValidityTypeEnum`
//!
//! 实体 `tigshop_core::entities::GiftCardGroups`（表 `gift_card_groups`，15 列）已由
//! schema 生成；`face_amount` 是 `decimal(10,2)` → `Decimal`。
//!
//! # 关键语义 / 偏差
//!
//! - **店铺过滤**：Java `HeaderUtils.getShopId()`（`x-admin-type` / `x-shop-id`），
//!   路由层用既有 `shop_id_from_headers` 解析并传入服务层（缺失 ⇒ `0` 平台）。
//! - **`expireTime` 解析**：Java `StringUtils.getEndOfDayTimestamp` 只接受
//!   `yyyy-MM-dd HH:mm:ss`，失败抛「日期格式错误」；本实现逐字同格式 + 同文案。
//! - **商品信息**：Java VO 的 `giftCardProducts` 是 `List<ProductSkuVO>`；
//!   本实现用简化 [`GiftCardProductVO`]（商品名/图/规格/价格），字段子集偏差。
//! - **`validityType` 枚举**：Java 1 永久 / 2 天数 / 3 固定时间（与实体注释的
//!   0/1/2 不一致，以 Java 枚举码为准）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::models::marketing::gift_card::{
    format_unix_time, GiftCardProductVO, GROUP_TYPE_EXCHANGE, GROUP_TYPE_TOP_UP, VALIDITY_FIXED,
    VALIDITY_NUMBER, VALIDITY_PERMANENT,
};

/// `GiftCardGroupsPageQuery`/排序用的主键列。
pub const KEY_COLUMN: &str = "card_groups_id";
/// 主键属性名。
pub const KEY_PROPERTY: &str = "cardGroupsId";

/// 卡组不存在。
pub const MSG_GROUP_NOT_EXISTS: &str = "卡组不存在";
/// 卡组状态不正确。
pub const MSG_GROUP_STATUS_INVALID: &str = "卡组状态不正确";
/// 请填写天数有效期。
pub const MSG_DAYS_REQUIRED: &str = "请填写天数有效期";
/// 请填写固定时间有效期。
pub const MSG_EXPIRE_TIME_REQUIRED: &str = "请填写固定时间有效期";
/// 请最少选择一个商品。
pub const MSG_PRODUCTS_REQUIRED: &str = "请最少选择一个商品";
/// 请填写面额。
pub const MSG_FACE_AMOUNT_REQUIRED: &str = "请填写面额";
/// 未知的卡有效期类型。
pub const MSG_UNKNOWN_VALIDITY_TYPE: &str = "未知的卡有效期类型";
/// 该礼品卡组已经被商品绑定，不能删除。
pub const MSG_GROUP_BOUND_CANNOT_DELETE: &str = "该礼品卡组已经被商品绑定，不能删除";
/// 日期格式错误（Java `StringUtils.getEndOfDayTimestamp` 的 ParseException 文案）。
pub const MSG_DATE_FORMAT_INVALID: &str = "日期格式错误";

/// 卡组类型名（Java `GiftGroupsEnum`）。
#[must_use]
pub fn group_type_name(group_type: i32) -> &'static str {
    match group_type {
        GROUP_TYPE_TOP_UP => "储值卡",
        GROUP_TYPE_EXCHANGE => "兑换卡",
        _ => "未知",
    }
}

/// 卡类型名（Java `GiftCardEnum`）。
#[must_use]
pub fn card_type_name(card_type: i32) -> &'static str {
    match card_type {
        1 => "电子卡",
        2 => "实体卡",
        _ => "未知",
    }
}

/// 有效期类型名（Java `ValidityTypeEnum`）。
#[must_use]
pub fn validity_type_name(validity_type: i32) -> &'static str {
    match validity_type {
        VALIDITY_PERMANENT => "永久有效",
        VALIDITY_NUMBER => "天数",
        VALIDITY_FIXED => "固定时间",
        _ => "未知",
    }
}

/// `yyyy-MM-dd HH:mm:ss` 字符串 → **当天 23:59:59** 的秒级时间戳
/// （Java `StringUtils.getEndOfDayTimestamp`；失败 →「日期格式错误」）。
pub fn parse_end_of_day_timestamp(raw: &str) -> Result<i32, String> {
    use chrono::{Datelike, NaiveDate, NaiveDateTime, NaiveTime};
    let parsed = NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S")
        .map_err(|_| MSG_DATE_FORMAT_INVALID.to_string())?;
    let date = NaiveDate::from_ymd_opt(
        parsed.date().year(),
        parsed.date().month(),
        parsed.date().day(),
    )
    .ok_or_else(|| MSG_DATE_FORMAT_INVALID.to_string())?;
    let end = date.and_time(NaiveTime::from_hms_opt(23, 59, 59).unwrap_or_default());
    // 与全仓库口径一致：按 UTC+8 解释本地时间
    i32::try_from(end.and_utc().timestamp() - 8 * 3600)
        .map_err(|_| MSG_DATE_FORMAT_INVALID.to_string())
}

/// 商品绑定项（Java `GiftCardProducts` 的入参子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardProductDTO {
    pub gift_product_id: Option<i32>,
    pub card_groups_id: Option<i32>,
    pub product_id: Option<i32>,
    pub sku_id: Option<i32>,
}

/// 卡组分页查询（Java `GiftCardGroupsPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardGroupsListQuery {
    /// 页码
    pub page: Option<i64>,
    /// 分页大小
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
    /// 关键字（卡组名 LIKE）
    pub keyword: Option<String>,
}

impl GiftCardGroupsListQuery {
    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        };
        (size, (page - 1) * size)
    }

    /// ORDER BY（`buildSortOrder` 三参）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = match field {
            "" | "cardGroupsId" | "card_groups_id" => KEY_COLUMN,
            "groupType" | "group_type" => "group_type",
            "cardType" | "card_type" => "card_type",
            "cardGroupName" | "card_group_name" => "card_group_name",
            "status" => "status",
            "addTime" | "add_time" => "add_time",
            "updateTime" | "update_time" => "update_time",
            "shopId" | "shop_id" => "shop_id",
            _ => KEY_COLUMN,
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }

    /// 关键字（Java `StrUtil.isNotBlank`：空白不参与过滤）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }
}

/// 创建参数（Java `GiftCardGroupsCreateParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardGroupsCreateParam {
    pub group_type: Option<i32>,
    pub card_type: Option<i32>,
    pub card_group_name: Option<String>,
    pub image_url: Option<String>,
    pub validity_type: Option<i32>,
    pub validity_days: Option<i32>,
    /// Java `String expireTime`（`yyyy-MM-dd HH:mm:ss`）
    pub expire_time: Option<String>,
    pub face_amount: Option<Decimal>,
    pub status: Option<i32>,
    pub remark: Option<String>,
    pub shop_id: Option<i32>,
    pub gift_card_products: Option<Vec<GiftCardProductDTO>>,
}

/// 更新参数（Java `GiftCardGroupsUpdateParam`；updateStatus / productsUpdate 复用）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardGroupsUpdateParam {
    pub card_groups_id: Option<i32>,
    /// 仅 updateStatus 使用
    pub status: Option<i32>,
    pub card_group_name: Option<String>,
    pub image_url: Option<String>,
    pub validity_type: Option<i32>,
    pub validity_days: Option<i32>,
    pub expire_time: Option<String>,
    pub face_amount: Option<Decimal>,
    pub remark: Option<String>,
    pub gift_card_products: Option<Vec<GiftCardProductDTO>>,
}

/// 卡组 ID 参数（Java `GiftCardGroupIdParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardGroupIdParam {
    pub gift_card_groups_id: Option<i32>,
}

/// 组 VO（Java `GiftCardGroupsVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardGroupsVO {
    pub card_groups_id: Option<i32>,
    pub group_type: Option<i32>,
    pub card_type: Option<i32>,
    pub card_group_name: Option<String>,
    pub image_url: Option<String>,
    pub validity_type: Option<i32>,
    pub validity_days: Option<i32>,
    /// FIXED 时格式化为 `yyyy-MM-dd HH:mm:ss`
    pub expire_time: Option<String>,
    pub face_amount: Option<Decimal>,
    pub status: Option<i32>,
    /// 格式化为日期（Java Jackson）
    pub add_time: Option<String>,
    /// 格式化为日期（Java Jackson）
    pub update_time: Option<String>,
    pub group_type_name: Option<String>,
    pub card_type_name: Option<String>,
    pub validity_type_name: Option<String>,
    pub remark: Option<String>,
    pub gift_card_products: Vec<GiftCardProductVO>,
    pub can_delete: Option<bool>,
}

/// `build` 后的卡组实体字段（服务层用，避免重复反序列化）。
#[derive(Debug, Clone, Default)]
pub struct GiftCardGroupsInput {
    pub card_groups_id: Option<i32>,
    pub group_type: i32,
    pub card_type: i32,
    pub card_group_name: String,
    pub image_url: Option<String>,
    pub validity_type: i32,
    pub validity_days: Option<i32>,
    pub expire_time: Option<i32>,
    pub face_amount: Option<Decimal>,
    pub status: i32,
    pub remark: Option<String>,
    pub shop_id: Option<i32>,
    pub gift_card_products: Vec<GiftCardProductDTO>,
}

impl GiftCardGroupsCreateParam {
    /// 复刻 Java `buildGiftCardGroups` 的校验分支（返回逐字中文文案）。
    ///
    /// # Errors
    /// 天数/固定时间/商品/面额缺失。
    pub fn validate(&self) -> Result<(), String> {
        let validity_type = self.validity_type.unwrap_or_default();
        let group_type = self.group_type.unwrap_or_default();
        match validity_type {
            VALIDITY_NUMBER if self.validity_days.is_none() => {
                return Err(MSG_DAYS_REQUIRED.to_string());
            }
            VALIDITY_FIXED if self.expire_time.is_none() => {
                return Err(MSG_EXPIRE_TIME_REQUIRED.to_string());
            }
            _ => {}
        }
        if group_type == GROUP_TYPE_EXCHANGE
            && self.gift_card_products.as_ref().map(Vec::len).unwrap_or(0) == 0
        {
            return Err(MSG_PRODUCTS_REQUIRED.to_string());
        }
        if group_type == GROUP_TYPE_TOP_UP && self.face_amount.is_none() {
            return Err(MSG_FACE_AMOUNT_REQUIRED.to_string());
        }
        Ok(())
    }
}

impl GiftCardGroupsUpdateParam {
    /// 更新校验（Java `buildGiftCardGroups`）；`db_group_type` 为库中组类型。
    ///
    /// # Errors
    /// 天数/固定时间缺失，储值卡缺面额，兑换卡缺商品。
    pub fn validate(&self, db_group_type: i32) -> Result<(), String> {
        let validity_type = self.validity_type.unwrap_or_default();
        match validity_type {
            VALIDITY_NUMBER if self.validity_days.is_none() => {
                return Err(MSG_DAYS_REQUIRED.to_string());
            }
            VALIDITY_FIXED if self.expire_time.is_none() => {
                return Err(MSG_EXPIRE_TIME_REQUIRED.to_string());
            }
            _ => {}
        }
        if db_group_type == GROUP_TYPE_TOP_UP && self.face_amount.is_none() {
            return Err(MSG_FACE_AMOUNT_REQUIRED.to_string());
        }
        if db_group_type == GROUP_TYPE_EXCHANGE
            && self.gift_card_products.as_ref().map(Vec::len).unwrap_or(0) == 0
        {
            return Err(MSG_PRODUCTS_REQUIRED.to_string());
        }
        Ok(())
    }
}

/// 固定有效期 → VO 展示（Java `getExpireTime`：PERMANENT 清空、FIXED 格式化）。
#[must_use]
pub fn expire_time_text(validity_type: i32, expire_time: Option<i32>) -> Option<String> {
    match validity_type {
        VALIDITY_FIXED => Some(format_unix_time(expire_time)),
        _ => None,
    }
}

/// `validity_type` 的未知值校验（Java `default -> throw 未知的卡有效期类型`）。
pub fn validate_validity_type(validity_type: i32) -> Result<(), String> {
    if validity_type == VALIDITY_PERMANENT
        || validity_type == VALIDITY_NUMBER
        || validity_type == VALIDITY_FIXED
    {
        Ok(())
    } else {
        Err(MSG_UNKNOWN_VALIDITY_TYPE.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::marketing::gift_card::{
        VALIDITY_FIXED, VALIDITY_NUMBER, VALIDITY_PERMANENT,
    };

    #[test]
    fn end_of_day_parse_and_error_text() {
        // 2024-12-01 00:00:00 UTC+8 的 23:59:59 → 1733068799
        assert_eq!(
            parse_end_of_day_timestamp("2024-12-01 08:30:00").unwrap(),
            1_733_068_799
        );
        assert_eq!(
            parse_end_of_day_timestamp("2024-12-01").unwrap_err(),
            "日期格式错误"
        );
    }

    #[test]
    fn create_validation_texts_are_verbatim() {
        let p = GiftCardGroupsCreateParam {
            validity_type: Some(VALIDITY_NUMBER),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap_err(), "请填写天数有效期");
        let p = GiftCardGroupsCreateParam {
            validity_type: Some(VALIDITY_FIXED),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap_err(), "请填写固定时间有效期");
        let p = GiftCardGroupsCreateParam {
            validity_type: Some(VALIDITY_PERMANENT),
            group_type: Some(GROUP_TYPE_EXCHANGE),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap_err(), "请最少选择一个商品");
        let p = GiftCardGroupsCreateParam {
            validity_type: Some(VALIDITY_PERMANENT),
            group_type: Some(GROUP_TYPE_TOP_UP),
            ..Default::default()
        };
        assert_eq!(p.validate().unwrap_err(), "请填写面额");
        let p = GiftCardGroupsCreateParam {
            validity_type: Some(VALIDITY_PERMANENT),
            group_type: Some(GROUP_TYPE_TOP_UP),
            face_amount: Some(Decimal::new(1000, 2)),
            ..Default::default()
        };
        assert!(p.validate().is_ok());
    }

    #[test]
    fn update_validation_uses_db_group_type() {
        let p = GiftCardGroupsUpdateParam {
            validity_type: Some(VALIDITY_PERMANENT),
            ..Default::default()
        };
        assert_eq!(p.validate(GROUP_TYPE_TOP_UP).unwrap_err(), "请填写面额");
        assert_eq!(
            p.validate(GROUP_TYPE_EXCHANGE).unwrap_err(),
            "请最少选择一个商品"
        );
        let p = GiftCardGroupsUpdateParam {
            validity_type: Some(VALIDITY_NUMBER),
            validity_days: Some(30),
            face_amount: Some(Decimal::new(5000, 2)),
            ..Default::default()
        };
        assert!(p.validate(GROUP_TYPE_TOP_UP).is_ok());
    }

    #[test]
    fn names_and_validity_unknown_branch() {
        assert_eq!(group_type_name(1), "储值卡");
        assert_eq!(group_type_name(2), "兑换卡");
        assert_eq!(card_type_name(1), "电子卡");
        assert_eq!(card_type_name(2), "实体卡");
        assert_eq!(validity_type_name(1), "永久有效");
        assert_eq!(validity_type_name(2), "天数");
        assert_eq!(validity_type_name(3), "固定时间");
        assert_eq!(validate_validity_type(9).unwrap_err(), "未知的卡有效期类型");
        assert_eq!(expire_time_text(VALIDITY_PERMANENT, Some(123)), None);
        assert_eq!(
            expire_time_text(VALIDITY_FIXED, Some(0)),
            Some(String::new())
        );
    }

    #[test]
    fn page_and_order_follow_base_page() {
        let q = GiftCardGroupsListQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.order_clause(), " ORDER BY card_groups_id DESC");
        let q = GiftCardGroupsListQuery {
            page: Some(2),
            size: Some(500),
            sort_field: Some("updateTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (100, 100));
        assert_eq!(q.order_clause(), " ORDER BY update_time ASC");
        let q = GiftCardGroupsListQuery {
            sort_field: Some("x; DROP".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY card_groups_id DESC");
    }
}
