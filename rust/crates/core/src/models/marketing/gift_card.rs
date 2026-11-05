//! 礼品卡域（marketing::gift_card）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.promotion.GiftCards`（表 `gift_cards`）
//! - `GiftCardsPageQuery` / `GiftCardIdParam` / `GiftCardClaimParam` / `ExchangeCardParam` /
//!   `GiftCardUpdateStatusDTO`
//! - `GiftCardsVO` / `GiftCardDetailVO` / `GiftCardsExportVO` / `GiftCardsTemplateVO` /
//!   `GiftCardsImportVO`
//! - 枚举 `GiftGroupsEnum` / `GiftCardEnum` / `ValidityTypeEnum` / `GiftCardClaimedEnum` /
//!   `GiftCardTransferFromType`
//!
//! 实体 `tigshop_core::entities::GiftCards`（表 `gift_cards`，16 列）已由 schema 生成；
//! `face_amount` 是 `decimal(10,2)` → `Decimal`。
//!
//! # 关键语义 / 偏差
//!
//! - **Excel 未迁移**：`importTemplate` / `exportList` 在 Java 走
//!   `@ResponseExcel` / `ExcelUtils` 直接写 xlsx 二进制；本工作区未启用 xlsx
//!   写出/解析依赖，故分别返回模板行 / 导出行 **JSON**，`importList` 完成
//!   multipart「文件非空」校验后返回明确业务错误（与 `catalog::e_card_group`
//!   等既有切片一致）。
//! - **`addTime` 口径**：列表/详情 VO 的 `addTime` 是 Java `Long.toString()` 的
//!   **秒级时间戳字符串**（不是格式化日期）；`usedTime` 由 Jackson
//!   `TimestampToDateSerializer` 格式化，但 Java 本域从未给它赋值 ⇒ null。
//! - **手机号脱敏**：`GiftCardDetailVO.mobile` 带 `@Sensitive(PHONE)`，
//!   仅演示站（`tigshop.is-demo: 1`）脱敏，服务层 `IS_DEMO` 常量承载。
//! - **店铺名/logo**：`shopId == 0` 时 Java 读平台配置 `SHOP_NAME/SHOP_LOGO`，
//!   配置服务未迁移 ⇒ 返回 null（偏差）；店铺卡读 `shop` 表。
//! - **`delete` 入参命名**：Java `GiftCardIdParam.cardGroupsId`（String）实际承载
//!   **礼品卡 ID**，控制器 `.intValue()` 传给 `deleteGiftCards(giftCardsId)`，
//!   此处保持同名字段并同样解析。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 枚举码值（Java 枚举逐字）
// ——————————————————————————————————————————————

/// 卡组类型：1 储值卡（Java `GiftGroupsEnum.TOP_UP`）。
pub const GROUP_TYPE_TOP_UP: i32 = 1;
/// 卡组类型：2 兑换卡（Java `GiftGroupsEnum.EXCHANGE`）。
pub const GROUP_TYPE_EXCHANGE: i32 = 2;
/// 卡类型：1 电子卡（Java `GiftCardEnum.ELECTRONIC_CARD`）。
pub const CARD_TYPE_ELECTRONIC: i32 = 1;
/// 卡类型：2 实体卡（Java `GiftCardEnum.PHYSICAL_CARD`）。
pub const CARD_TYPE_PHYSICAL: i32 = 2;
/// 有效期：1 永久有效（Java `ValidityTypeEnum.PERMANENT`）。
pub const VALIDITY_PERMANENT: i32 = 1;
/// 有效期：2 天数（Java `ValidityTypeEnum.NUMBER`）。
pub const VALIDITY_NUMBER: i32 = 2;
/// 有效期：3 固定时间（Java `ValidityTypeEnum.FIXED`）。
pub const VALIDITY_FIXED: i32 = 3;
/// 领取状态：0 不可领取。
pub const CLAIMED_NONE: i32 = 0;
/// 领取状态：1 可领取。
pub const CLAIMED_RECEIVABLE: i32 = 1;
/// 领取状态：2 已领取。
pub const CLAIMED_RECEIVED: i32 = 2;
/// 转赠来源：1 H5。
pub const TRANSFER_FROM_H5: i32 = 1;
/// 转赠来源：2 PC。
pub const TRANSFER_FROM_PC: i32 = 2;

/// 常量 YES（Java `Constants.YES`）。
pub const YES: i32 = 1;
/// 常量 NO（Java `Constants.NO`）。
pub const NO: i32 = 0;

// ——————————————————————————————————————————————
// 数字/中文文案（逐字对齐 Java GlobalException）
// ——————————————————————————————————————————————

/// 礼品卡不存在。
pub const MSG_CARD_NOT_EXISTS: &str = "礼品卡不存在";
/// 卡组不存在（创建/兑换）。
pub const MSG_GROUP_NOT_EXISTS: &str = "卡组不存在";
/// 礼品卡组不存在（详情）。
pub const MSG_CARD_GROUP_NOT_EXISTS: &str = "礼品卡组不存在";
/// 该礼品卡不存在（领取/转赠）。
pub const MSG_SN_NOT_FOUND: &str = "该礼品卡不存在";
/// 该礼品卡不可领取。
pub const MSG_CARD_NOT_CLAIMABLE: &str = "该礼品卡不可领取";
/// 该礼品卡已经被领取，无法转赠。
pub const MSG_CARD_ALREADY_CLAIMED: &str = "该礼品卡已经被领取，无法转赠";
/// 该礼品卡已售出，请勿删除。
pub const MSG_CARD_SOLD_CANNOT_DELETE: &str = "该礼品卡已售出，请勿删除";
/// 该礼品卡信息异常。
pub const MSG_CARD_ABNORMAL: &str = "该礼品卡信息异常";
/// 已售出的卡不能修改可用状态。
pub const MSG_SOLD_CANNOT_CHANGE_STATUS: &str = "已售出的卡不能修改可用状态";
/// 卡id不能为空（`GiftCardUpdateStatusDTO.giftCardsId` 的 `@NotNull`）。
pub const MSG_CARD_ID_REQUIRED: &str = "卡id不能为空";
/// 状态值不能为空（`GiftCardUpdateStatusDTO.isAvailable` 的 `@NotNull`）。
pub const MSG_IS_AVAILABLE_REQUIRED: &str = "状态值不能为空";
/// 兑换失败，请检查卡号/密码后重试。
pub const MSG_EXCHANGE_FAILED: &str = "兑换失败，请检查卡号/密码后重试";
/// 该礼品卡已经被兑换。
pub const MSG_CARD_ALREADY_EXCHANGED: &str = "该礼品卡已经被兑换";
/// 该礼品卡已过期。
pub const MSG_CARD_EXPIRED: &str = "该礼品卡已过期";
/// 不支持的礼品卡类型。
pub const MSG_UNSUPPORTED_GROUP_TYPE: &str = "不支持的礼品卡类型";
/// 该礼品卡绑定的商品已下架。
pub const MSG_PRODUCTS_OFFLINE: &str = "该礼品卡绑定的商品已下架";
/// 没有设置赠送来源。
pub const MSG_TRANSFER_SOURCE_REQUIRED: &str = "没有设置赠送来源";
/// 没有设置礼品卡编号。
pub const MSG_TRANSFER_SN_REQUIRED: &str = "没有设置礼品卡编号";
/// 没有找到该礼品卡。
pub const MSG_TRANSFER_CARD_NOT_FOUND: &str = "没有找到该礼品卡";
/// 没有找到该礼品卡组。
pub const MSG_TRANSFER_GROUP_NOT_FOUND: &str = "没有找到该礼品卡组";
/// 请上传文件。
pub const MSG_UPLOAD_FILE_REQUIRED: &str = "请上传文件";
/// 请选择正确的礼品卡。
pub const MSG_CARD_GROUP_INVALID: &str = "请选择正确的礼品卡";
/// Excel 批量导入功能尚未迁移（Rust 侧无 xlsx 解析依赖）。
pub const MSG_EXCEL_IMPORT_UNMIGRATED: &str = "Excel 批量导入功能尚未迁移";
/// 卡号长度不能小于8位（Java 拼接：`{cardNumber}（卡号长度不能小于8位）`）。
pub const MSG_CARD_NUMBER_TOO_SHORT: &str = "（卡号长度不能小于8位）";
/// 密码长度不能小于6位或者大于16位。
pub const MSG_PASSWORD_LENGTH: &str = "（密码长度不能小于6位或者大于16位）";

// ——————————————————————————————————————————————
// 名称派生 / 纯函数
// ——————————————————————————————————————————————

/// 卡组类型名（Java `GiftGroupsEnum.getByCode`；未知 → 「未知」）。
#[must_use]
pub fn group_type_name(group_type: i32) -> &'static str {
    match group_type {
        GROUP_TYPE_TOP_UP => "储值卡",
        GROUP_TYPE_EXCHANGE => "兑换卡",
        _ => "未知",
    }
}

/// 卡类型名（Java `GiftCardEnum.getByCode`；未知 → 「未知」）。
#[must_use]
pub fn card_type_name(card_type: i32) -> &'static str {
    match card_type {
        CARD_TYPE_ELECTRONIC => "电子卡",
        CARD_TYPE_PHYSICAL => "实体卡",
        _ => "未知",
    }
}

/// 有效期类型名（Java `ValidityTypeEnum.getByCode`；未知 → 「未知」）。
#[must_use]
pub fn validity_type_name(validity_type: i32) -> &'static str {
    match validity_type {
        VALIDITY_PERMANENT => "永久有效",
        VALIDITY_NUMBER => "天数",
        VALIDITY_FIXED => "固定时间",
        _ => "未知",
    }
}

/// 是否售出文案：Java `userId != null ? "是" : "否"`。
#[must_use]
pub fn is_sold_text(user_id: Option<i32>) -> String {
    if user_id.is_some() { "是" } else { "否" }.to_string()
}

/// 是否兑换文案：Java `status == 1 ? "是" : "否"`。
#[must_use]
pub fn is_exchange_text(status: Option<i32>) -> String {
    if status == Some(YES) { "是" } else { "否" }.to_string()
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`None`/`0` ⇒ `""`
/// （Java `TigUtils.handelTime`）。
#[must_use]
pub fn format_unix_time(secs: Option<i32>) -> String {
    let Some(secs) = secs.filter(|s| *s != 0) else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// Java `StringUtils.maskMiddleHalf`：把**中间一半**字符替换为 `*`
/// （`half = len/2`、`start = (len-half)/2`、`end = start+half`）。
#[must_use]
pub fn mask_middle_half(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let length = chars.len();
    if length < 2 {
        return "*".repeat(length);
    }
    let half = length / 2;
    let start = (length - half) / 2;
    let end = start + half;
    chars
        .iter()
        .enumerate()
        .map(|(i, c)| if i >= start && i < end { '*' } else { *c })
        .collect()
}

/// 秒级时间戳字符串（Java `Long.toString()`），`None` ⇒ `None`。
#[must_use]
pub fn seconds_text(secs: Option<i32>) -> Option<String> {
    secs.map(|s| s.to_string())
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 卡列表查询（Java `GiftCardsPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardsListQuery {
    /// 页码
    pub page: Option<i64>,
    /// 分页大小
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
    /// 关键字（卡号 LIKE，Java 判 `keyword != null`，空串会 LIKE '%%'）
    pub keyword: Option<String>,
    /// 卡组 ID（Java `.eq(cardGroupsId, ...)`，为 null 时 SQL 条件匹配不到行）
    pub card_groups_id: Option<i32>,
}

impl GiftCardsListQuery {
    /// `(LIMIT, OFFSET)`（Java `BasePage` 口径）。
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

    /// ORDER BY（`buildSortOrder` 三参：默认主键降序；未知方向不排序）。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = match field {
            "" | "giftCardsId" | "gift_cards_id" => "gift_cards_id",
            "cardGroupsId" | "card_groups_id" => "card_groups_id",
            "cardNumber" | "card_number" => "card_number",
            "cardPassword" | "card_password" => "card_password",
            "giftCardSn" | "gift_card_sn" => "gift_card_sn",
            "isAvailable" | "is_available" => "is_available",
            "status" => "status",
            "usedTime" | "used_time" => "used_time",
            "userId" | "user_id" => "user_id",
            "claimedUserId" | "claimed_user_id" => "claimed_user_id",
            "claimedStatus" | "claimed_status" => "claimed_status",
            "addTime" | "add_time" => "add_time",
            "expiredTime" | "expired_time" => "expired_time",
            "orderTime" | "order_time" => "order_time",
            _ => "gift_cards_id",
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }
}

/// 卡 ID 参数（Java `GiftCardIdParam`；`cardGroupsId` 实际承载卡 ID）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardIdParam {
    /// Java 是 String，`getCardGroupsId()` 里 `Long.parseLong` 后转 int
    pub card_groups_id: Option<String>,
    /// 数量（仅批量生成用；本域 8 端点未用到）
    pub count: Option<i32>,
}

impl GiftCardIdParam {
    /// 解析卡 ID（Java `getCardGroupsId().intValue()`；非法格式 ⇒ 参数错误）。
    pub fn gift_cards_id(&self) -> Result<i32, String> {
        let raw = self.card_groups_id.as_deref().unwrap_or("").trim();
        if raw.is_empty() {
            return Err("卡id不能为空".to_string());
        }
        raw.parse::<i64>()
            .map(|v| i32::try_from(v).unwrap_or(0))
            .map_err(|_| "卡id格式错误".to_string())
    }
}

/// 卡可用状态更新（Java `GiftCardUpdateStatusDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardUpdateStatusDTO {
    #[serde(default)]
    pub gift_cards_id: Option<i32>,
    #[serde(default)]
    pub is_available: Option<i32>,
}

/// 领取/转赠参数（Java `GiftCardClaimParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GiftCardClaimParam {
    /// 礼品卡序列号
    pub gift_card_sn: Option<String>,
    /// 用户 ID
    pub user_id: Option<i32>,
    /// 来源（1 H5 / 2 PC）
    pub is_from: Option<i32>,
}

/// 卡号+卡密兑换参数（Java `ExchangeCardParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExchangeCardParam {
    pub gift_cards_id: Option<i32>,
    pub card_number: Option<String>,
    pub card_password: Option<String>,
    pub user_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 兑换商品（简化版 Java `ProductSkuVO`：本域只用到商品名/图/规格/价格）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardProductVO {
    pub product_id: i32,
    pub sku_id: i32,
    pub product_name: String,
    pub pic_thumb: String,
    pub sku_value: Option<String>,
    pub sku_price: Option<Decimal>,
}

/// 加入购物车回执（Java `ExchangeProductToCartVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeProductToCartVO {
    pub item: bool,
    pub flow_type: i32,
}

/// 礼品卡 VO（Java `GiftCardsVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardsVO {
    pub gift_cards_id: Option<i32>,
    pub card_groups_id: Option<i32>,
    pub card_group_name: Option<String>,
    pub shop_id: Option<i32>,
    pub gift_card_sn: Option<String>,
    pub shop_title: Option<String>,
    pub shop_logo: Option<String>,
    pub image_url: Option<String>,
    pub card_number: Option<String>,
    pub card_password: Option<String>,
    pub is_available: Option<i32>,
    pub status: Option<i32>,
    pub is_sold: Option<String>,
    pub is_exchange: Option<String>,
    /// Java Jackson `TimestampToDateSerializer` 格式化；本域从未赋值 ⇒ null
    pub used_time: Option<String>,
    pub user_id: Option<i32>,
    /// Java `Long.toString()`（**秒级时间戳字符串**，非格式化日期）
    pub add_time: Option<String>,
    pub expired_time: Option<i32>,
    pub gift_card_products: Option<Vec<GiftCardProductVO>>,
    pub exchange_product_to_cart: Option<ExchangeProductToCartVO>,
}

/// 兑换详情（Java `GiftCardDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardDetailVO {
    pub group_type: Option<i32>,
    pub card_type: Option<i32>,
    pub card_number: Option<String>,
    pub card_password: Option<String>,
    pub is_sold: Option<String>,
    pub is_exchange: Option<String>,
    pub order_id: Option<i32>,
    pub exchange_info: Option<GiftCardExchangeInfoVO>,
}

/// 兑换信息（Java `GiftCardDetailVO.ExchangeInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardExchangeInfoVO {
    pub user_address_info: Option<GiftCardUserAddressInfoVO>,
    pub delivery_info: Option<GiftCardDeliveryInfoVO>,
    pub pay_info: Option<GiftCardPayInfoVO>,
}

/// 用户地址信息（Java `UserAddressInfoVO`；`mobile` 演示站脱敏）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardUserAddressInfoVO {
    pub username: Option<String>,
    pub consignee: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub region_name: Option<String>,
    pub address: Option<String>,
    pub buyer_note: Option<String>,
}

/// 配送信息（Java `DeliveryInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardDeliveryInfoVO {
    pub shipping_type_name: Option<String>,
    pub shipping_time: Option<String>,
    pub logistics_name: Option<String>,
    pub tracking_no: Option<String>,
}

/// 支付信息（Java `PayInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardPayInfoVO {
    pub pay_type_name: Option<String>,
    pub exchange_time: Option<String>,
    pub exchange_amount: Option<Decimal>,
    pub received_time: Option<String>,
}

/// 导出记录（Java `GiftCardsExportVO`；xlsx 未迁移，直接 JSON 返回）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardsExportVO {
    pub card_number: String,
    pub card_password: String,
    pub gift_card_sn: Option<String>,
    pub is_sold: String,
    pub is_exchange: String,
    pub add_time: String,
}

/// 导入模板行（Java `GiftCardsTemplateVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardsTemplateVO {
    pub card_number: String,
    pub card_password: String,
}

/// 导入结果（Java `GiftCardsImportVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GiftCardsImportVO {
    pub success_count: i32,
    pub fail_count: i32,
    pub fail_list: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_names_match_java() {
        assert_eq!(group_type_name(GROUP_TYPE_TOP_UP), "储值卡");
        assert_eq!(group_type_name(GROUP_TYPE_EXCHANGE), "兑换卡");
        assert_eq!(group_type_name(0), "未知");
        assert_eq!(card_type_name(CARD_TYPE_ELECTRONIC), "电子卡");
        assert_eq!(card_type_name(CARD_TYPE_PHYSICAL), "实体卡");
        assert_eq!(validity_type_name(VALIDITY_PERMANENT), "永久有效");
        assert_eq!(validity_type_name(VALIDITY_NUMBER), "天数");
        assert_eq!(validity_type_name(VALIDITY_FIXED), "固定时间");
        assert_eq!(validity_type_name(0), "未知");
    }

    #[test]
    fn sold_and_exchange_texts() {
        assert_eq!(is_sold_text(Some(3)), "是");
        assert_eq!(is_sold_text(None), "否");
        assert_eq!(is_exchange_text(Some(1)), "是");
        assert_eq!(is_exchange_text(Some(0)), "否");
        assert_eq!(is_exchange_text(None), "否");
    }

    #[test]
    fn mask_middle_half_matches_java_algorithm() {
        // len=16 → half=8, start=4, end=12
        assert_eq!(mask_middle_half("GC20251031133058"), "GC20********3058");
        // len=2 → half=1, start=0, end=1（只遮第一个字符）
        assert_eq!(mask_middle_half("ab"), "*b");
        // len<2 → 全 *
        assert_eq!(mask_middle_half("a"), "*");
        assert_eq!(mask_middle_half(""), "");
    }

    #[test]
    fn add_time_is_raw_seconds_string() {
        assert_eq!(
            seconds_text(Some(1_733_000_000)).as_deref(),
            Some("1733000000")
        );
        assert_eq!(seconds_text(None), None);
        // 格式化函数与 Java handelTime 一致（0 → ""）
        assert_eq!(format_unix_time(Some(0)), "");
        assert_eq!(format_unix_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }

    #[test]
    fn card_id_param_parses_java_string_field() {
        let p = GiftCardIdParam {
            card_groups_id: Some(" 42 ".into()),
            ..Default::default()
        };
        assert_eq!(p.gift_cards_id().unwrap(), 42);
        let empty = GiftCardIdParam::default();
        assert_eq!(empty.gift_cards_id().unwrap_err(), "卡id不能为空");
        let bad = GiftCardIdParam {
            card_groups_id: Some("abc".into()),
            ..Default::default()
        };
        assert_eq!(bad.gift_cards_id().unwrap_err(), "卡id格式错误");
    }

    #[test]
    fn page_and_order_follow_base_page() {
        let q = GiftCardsListQuery::default();
        assert_eq!(q.limit_offset(), (15, 0));
        assert_eq!(q.order_clause(), " ORDER BY gift_cards_id DESC");
        let q = GiftCardsListQuery {
            page: Some(2),
            size: Some(10),
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.limit_offset(), (10, 10));
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
        let q = GiftCardsListQuery {
            sort_field: Some("x; DROP TABLE gift_cards".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY gift_cards_id DESC");
    }
}
