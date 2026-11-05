//! 用户收货地址（C 端）域（member::user_address_client）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.api.controller.user.UserAddressClientController`
//!   （`@RequestMapping("/api/user/address")`，7 个端点，auth=optional）
//! - 服务 `UserAddressServiceImpl`（继承 `BaseServiceImpl`）
//! - 入参 `UserAddressListDTO` / `UserAddressCreateDTO` / `UserAddressUpdateDTO`
//!   / 公共 `OperateDTO`
//! - 出参 `UserAddressVO`
//! - 表：`user_address`（实体 [`crate::entities::UserAddress`]）
//!
//! # 端点（7）
//! `GET /api/user/address/{tagList,list,detail}`、
//! `POST /api/user/address/{del,create,update,setSelected}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **区名顺序**：Java 用 `regionService.list(in regionIds)` 的返回顺序拼
//!    `regionName`（无显式排序）；本实现按 `region_id ASC` 稳定输出（通常与
//!    Java 的 MySQL 主键序一致）。
//! 2. **多字段默认排序**：Java 控制器在「未传 sortItems 且未传 sortField」时
//!    注入 `[is_selected desc, is_default desc]`；本实现不解析 `sortItems` 数组，
//!    只在该默认分支用同样的两列排序（前端常规请求等价）。
//! 3. **`is_system` 过滤**：Java 控制器固定 `listDTO.setIsSystem(0)`，服务按
//!    `(is_system = 0 OR is_system IS NULL)` 过滤；本实现固定该分支。
//! 4. **`create` 的 `user_id` 兜底**：Java 仅当 `regionIds` 非空时才写
//!    `user_id`（否则 `null` 撞 NOT NULL 报 500）；本实现总是写
//!    `dto.userId ?? 当前登录用户`，避免把缺参放大成 500。
//! 5. 时间：本域无时间字段；金额：本域无金额列。

/// 数值字段容错反序列化:字符串数字("7")/浮点(7.0)一律接受。
///
/// Java Jackson 默认把 `"7"` 宽松绑定到 int;H5 编辑页把 URL 参数
/// `?id=7`(字符串)原样放进 JSON 载荷,Rust serde 严格拒绝导致 422
/// 纯文本、前端只弹灰色空窗。此处对齐 Jackson 行为。
fn tolerant_opt_i32<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error as _;
    struct V;
    impl<'de> serde::de::Visitor<'de> for V {
        type Value = Option<i32>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("i32 or numeric string")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(i32::try_from(v).ok())
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(i32::try_from(v).ok())
        }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(if v.is_finite() && v.fract() == 0.0 {
                i32::try_from(v as i64).ok()
            } else {
                None
            })
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let s = v.trim();
            if s.is_empty()
                || s.eq_ignore_ascii_case("nan")
                || s.eq_ignore_ascii_case("undefined")
                || s.eq_ignore_ascii_case("null")
            {
                return Ok(None);
            }
            Ok(s.parse::<i32>().ok())
        }
    }
    deserializer.deserialize_any(V)
}

/// f64 容错(纬度/经度:前端可能传字符串)。
fn tolerant_opt_f64<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error as _;
    struct V;
    impl<'de> serde::de::Visitor<'de> for V {
        type Value = Option<f64>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("f64 or numeric string")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v as f64))
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v as f64))
        }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v))
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let s = v.trim();
            if s.is_empty()
                || s.eq_ignore_ascii_case("nan")
                || s.eq_ignore_ascii_case("undefined")
                || s.eq_ignore_ascii_case("null")
            {
                return Ok(None);
            }
            Ok(s.parse::<f64>().ok())
        }
    }
    deserializer.deserialize_any(V)
}

/// `Vec<i32>` 容错(地区 ID 列表:元素可能是字符串)。
fn tolerant_opt_i32_vec<'de, D>(deserializer: D) -> Result<Option<Vec<i32>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    struct V;
    impl<'de> serde::de::Visitor<'de> for V {
        type Value = Option<Vec<i32>>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("list of i32 (elements may be numeric strings)")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }
        fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
        where
            A: serde::de::SeqAccess<'de>,
        {
            let mut out = Vec::new();
            while let Some(item) = seq.next_element::<serde_json::Value>()? {
                let v = match &item {
                    serde_json::Value::Number(n) => n.as_i64().and_then(|i| i32::try_from(i).ok()),
                    serde_json::Value::String(s) => s.trim().parse::<i32>().ok(),
                    serde_json::Value::Null => None,
                    _ => None,
                };
                if let Some(v) = v {
                    out.push(v);
                }
            }
            Ok(Some(out))
        }
    }
    deserializer.deserialize_any(V)
}

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

/// Java `UserAddressConstants.DEFAULT_ADDRESS_TAGS`（逗号分隔）。
pub const DEFAULT_ADDRESS_TAGS: &str = "家,公司,学校";
/// Java `UserAddressConstants.USER_ADDRESS_NOT_EXIST`（detail 用「用户地址不存在」）。
pub const MSG_ADDRESS_NOT_EXIST: &str = "用户地址不存在";
/// Java i18n `error.address.not.exist` 的末次定义（update 用「地址不存在」）。
pub const MSG_ADDRESS_NOT_EXIST_UPDATE: &str = "地址不存在";
/// Java 控制器 `detail` 的越权文案。
pub const MSG_VIEW_NO_PERMISSION: &str = "无权限查看此收货地址";
/// Java 控制器匿名校验文案。
pub const MSG_USER_NOT_LOGIN: &str = "用户未登录";
/// Java 控制器 `del` 的越权/不存在文案。
pub const MSG_DEL_NO_PERMISSION: &str = "地址不存在或无权限删除";
/// Java i18n `error.address.postcode.too.long`（messages.properties 末次定义）。
pub const MSG_POSTCODE_TOO_LONG: &str = "邮政编码长度不能超过60个字符";
/// Java `user_address.postcode` 列长度。
pub const POSTCODE_MAX_LEN: usize = 60;
/// 本域无 Java 常量：`addressId` 缺失时的参数校验文案（对齐公共错误风格）。
pub const MSG_ADDRESS_ID_REQUIRED: &str = "收货地址id不能为空";

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `user_address` 表可参与 `ORDER BY` 的真实列（防注入）。
pub const SORTABLE_COLUMNS: [&str; 22] = [
    "address_id",
    "country_code",
    "country_name",
    "address_tag",
    "user_id",
    "consignee",
    "email",
    "region_ids",
    "region_names",
    "address",
    "address_line_two",
    "building_name",
    "floor",
    "unit",
    "address_data",
    "formatted_address",
    "position_address",
    "postcode",
    "telephone",
    "mobile",
    "is_default",
    "is_selected",
];

/// 属性名 → 列名（Java `getColumnByPropertyName`；未知回退主键 `address_id`）。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "addressId" | "address_id" => "address_id",
        "userId" | "user_id" => "user_id",
        "consignee" => "consignee",
        "email" => "email",
        "mobile" => "mobile",
        "telephone" => "telephone",
        "address" => "address",
        "addressTag" | "address_tag" => "address_tag",
        "positionAddress" | "position_address" => "position_address",
        "postcode" => "postcode",
        "isDefault" | "is_default" => "is_default",
        "isSelected" | "is_selected" => "is_selected",
        "isSystem" | "is_system" => "is_system",
        "regionIds" | "region_ids" => "region_ids",
        "regionNames" | "region_names" => "region_names",
        "countryCode" | "country_code" => "country_code",
        "countryName" | "country_name" => "country_name",
        "addressLineTwo" | "address_line_two" => "address_line_two",
        "buildingName" | "building_name" => "building_name",
        "floor" => "floor",
        "unit" => "unit",
        "addressData" | "address_data" => "address_data",
        "formattedAddress" | "formatted_address" => "formatted_address",
        _ => "address_id",
    }
}

/// 列表排序：Java 控制器缺省注入 `[is_selected desc, is_default desc]`；
/// 若客户端显式传 `sortField` 则按 `buildSortOrder` 单列排序。
///
/// 返回值：`None` 表示「使用默认两列排序」；`Some((列, 方向))` 表示单列排序。
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> Option<(&'static str, Option<bool>)> {
    let field = sort_field.map(str::trim).filter(|s| !s.is_empty())?;
    let column = normalize_column(field);
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("address_id");
    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        Some(_) => None,
    };
    Some((column, desc))
}

/// 列表查询参数（Java `UserAddressListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserAddressListQuery {
    /// 当前页码。
    pub page: Option<u64>,
    /// 分页大小。
    pub size: Option<u64>,
    /// 排序字段。
    pub sort_field: Option<String>,
    /// 排序方向。
    pub sort_order: Option<String>,
    /// 关键字（Java `BasePage.keyword`；本域未使用）。
    pub keyword: Option<String>,
    /// 用户 ID（Java `UserAddressListDTO.userId`；缺省取登录用户）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub user_id: Option<i32>,
    /// 是否系统地址（Java 控制器固定覆盖为 0）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_system: Option<i32>,
}

impl UserAddressListQuery {
    /// 归一化分页。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// 通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }
}

/// 创建入参（Java `UserAddressCreateDTO`）。

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserAddressCreateDTO {
    /// 地址标签。
    pub address_tag: Option<String>,
    /// 详细地址。
    pub address: Option<String>,
    /// 定位地址。
    pub position_address: Option<String>,
    /// 邮编。
    pub postcode: Option<String>,
    /// 收货人。
    pub consignee: Option<String>,
    /// 邮箱。
    pub email: Option<String>,
    /// 手机号。
    pub mobile: Option<String>,
    /// 手机区号。
    pub mobile_area_code: Option<String>,
    /// 固定电话。
    pub telephone: Option<String>,
    /// 是否默认。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_default: Option<i32>,
    /// 是否选中。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_selected: Option<i32>,
    /// 地区 ID 列表。
    #[serde(default, deserialize_with = "tolerant_opt_i32_vec")]
    pub region_ids: Option<Vec<i32>>,
    /// 用户 ID（缺省取当前登录用户）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub user_id: Option<i32>,
    /// 是否系统添加。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_system: Option<i32>,
    /// 纬度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub latitude: Option<f64>,
    /// 经度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub longitude: Option<f64>,
}

/// 更新入参（Java `UserAddressUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserAddressUpdateDTO {
    /// 兼容 id（Java 同名字段，未使用）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub id: Option<i32>,
    /// 收货地址 ID（Java `addressId`，更新定位用）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub address_id: Option<i32>,
    /// 地址标签。
    pub address_tag: Option<String>,
    /// 详细地址。
    pub address: Option<String>,
    /// 定位地址。
    pub position_address: Option<String>,
    /// 邮编。
    pub postcode: Option<String>,
    /// 收货人。
    pub consignee: Option<String>,
    /// 邮箱。
    pub email: Option<String>,
    /// 手机号。
    pub mobile: Option<String>,
    /// 手机区号。
    pub mobile_area_code: Option<String>,
    /// 固定电话。
    pub telephone: Option<String>,
    /// 是否默认。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_default: Option<i32>,
    /// 是否选中。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_selected: Option<i32>,
    /// 地区 ID 列表。
    #[serde(default, deserialize_with = "tolerant_opt_i32_vec")]
    pub region_ids: Option<Vec<i32>>,
    /// 用户 ID。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub user_id: Option<i32>,
    /// 纬度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub latitude: Option<f64>,
    /// 经度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub longitude: Option<f64>,
    /// 是否系统地址。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_system: Option<i32>,
}

/// 单条操作入参（Java 公共 `OperateDTO` / `setSelected` 的 id 视角）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserAddressIdDTO {
    /// 地址 ID（`setSelected` 用 `id`，`del` 用 `id`）。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub id: Option<i32>,
    /// 备注（Java `OperateDTO.adminNote`，未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（未使用）。
    pub page_type: Option<i32>,
}

/// 收货地址 VO（Java `UserAddressVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserAddressVO {
    /// 用户地址（详细地址）。
    pub address: String,
    /// 定位地址。
    pub position_address: Option<String>,
    /// 地址 ID。
    pub address_id: i32,
    /// 收货人。
    pub consignee: String,
    /// 邮箱。
    pub email: Option<String>,
    /// 是否默认。
    pub is_default: i32,
    /// 是否选中。
    pub is_selected: i32,
    /// 手机号。
    pub mobile: String,
    /// 手机区号。
    pub mobile_area_code: Option<String>,
    /// 地区（空格拼接）。
    pub region_name: String,
    /// 地区名数组。
    pub region_names: Vec<String>,
    /// 固定电话。
    pub telephone: Option<String>,
    /// 用户 ID。
    pub user_id: i32,
    /// 地区 ID 数组。
    pub region_ids: Vec<i32>,
    /// 邮编。
    pub postcode: Option<String>,
    /// 地址标签。
    pub address_tag: String,
    /// 纬度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub latitude: Option<f64>,
    /// 经度。
    #[serde(default, deserialize_with = "tolerant_opt_f64")]
    pub longitude: Option<f64>,
    /// 是否系统添加。
    #[serde(default, deserialize_with = "tolerant_opt_i32")]
    pub is_system: Option<i32>,
}

/// 常用标签列表（Java `getAddressTagList`）。
#[must_use]
pub fn address_tag_list() -> Vec<&'static str> {
    DEFAULT_ADDRESS_TAGS
        .split(',')
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .collect()
}

/// 邮编规范化（Java `normalizePostcode`）：`None` 保持 `None`；超 60 报错。
///
/// # Errors
/// 去空白后长度 > 60 → [`MSG_POSTCODE_TOO_LONG`]。
pub fn normalize_postcode(postcode: Option<&str>) -> Result<Option<String>, String> {
    let Some(raw) = postcode else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.chars().count() > POSTCODE_MAX_LEN {
        return Err(MSG_POSTCODE_TOO_LONG.to_string());
    }
    Ok(Some(trimmed.to_string()))
}

/// 序列化 JSON 字符串（Java `JsonUtil.toJson`；`None` → `"[]"`）。
#[must_use]
pub fn to_json<T: Serialize + ?Sized>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "[]".to_string())
}

/// 解析 JSON 字符串数组（Java `JsonUtil.jsonToList`；失败 → 空数组）。
#[must_use]
pub fn parse_string_list(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw.trim()).unwrap_or_default()
}

/// 解析 JSON 数字数组（Java `JsonUtil.jsonToList(..., Integer.class)`）。
#[must_use]
pub fn parse_i32_list(raw: &str) -> Vec<i32> {
    serde_json::from_str::<Vec<i32>>(raw.trim()).unwrap_or_default()
}

/// 拼接区名（Java `joinRegionNames`：空 → `""`，否则空格连接）。
#[must_use]
pub fn join_region_names(names: &[String]) -> String {
    names.join(" ")
}

/// 列表用区名拼接：Java 在 `list` 中对「前两个相等」的重复区名去重后再拼接；
/// `detail` 不去重（原样）。
#[must_use]
pub fn join_region_names_dedup(names: &[String]) -> String {
    let mut names = names.to_vec();
    if names.len() > 1 && names[0] == names[1] {
        names.remove(1);
    }
    names.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_list_matches_java_constant() {
        assert_eq!(address_tag_list(), vec!["家", "公司", "学校"]);
    }

    #[test]
    fn postcode_normalization_matches_java() {
        assert_eq!(normalize_postcode(None), Ok(None));
        assert_eq!(
            normalize_postcode(Some(" 100000 ")),
            Ok(Some("100000".to_string()))
        );
        let too_long = "1".repeat(61);
        assert_eq!(
            normalize_postcode(Some(&too_long)),
            Err(MSG_POSTCODE_TOO_LONG.to_string())
        );
        let ok = "1".repeat(60);
        assert!(normalize_postcode(Some(&ok)).is_ok());
    }

    #[test]
    fn json_helpers_round_trip() {
        assert_eq!(to_json(&vec![1, 2, 3]), "[1,2,3]");
        assert_eq!(parse_i32_list("[1,2,3]"), vec![1, 2, 3]);
        assert_eq!(parse_i32_list("bad"), Vec::<i32>::new());
        assert_eq!(to_json(&vec!["北京", "朝阳"]), "[\"北京\",\"朝阳\"]");
        assert_eq!(
            parse_string_list("[\"北京\",\"朝阳\"]"),
            vec!["北京", "朝阳"]
        );
    }

    #[test]
    fn region_name_join_and_dedup_match_java() {
        assert_eq!(join_region_names(&[]), "");
        assert_eq!(
            join_region_names(&["北京".into(), "朝阳".into()]),
            "北京 朝阳"
        );
        // 列表：前两个相同 → 去掉第二个
        assert_eq!(
            join_region_names_dedup(&["北京".into(), "北京".into(), "朝阳".into()]),
            "北京 朝阳"
        );
        // 详情：不去重
        assert_eq!(
            join_region_names(&["北京".into(), "北京".into(), "朝阳".into()]),
            "北京 北京 朝阳"
        );
    }

    #[test]
    fn sort_resolution_matches_controller_default() {
        // 未传 sortField → 默认两列排序（None）
        assert_eq!(resolve_sort(None, None), None);
        assert_eq!(resolve_sort(Some("  "), None), None);
        // 传了 → 单列（属性名归一）
        assert_eq!(
            resolve_sort(Some("isDefault"), Some("asc")),
            Some(("is_default", Some(false)))
        );
        assert_eq!(
            resolve_sort(Some("is_selected"), None),
            Some(("is_selected", Some(true)))
        );
        // 未知字段回退主键；非 asc/desc → 无 ORDER BY
        assert_eq!(
            resolve_sort(Some("nope"), Some("weird")),
            Some(("address_id", None))
        );
    }

    #[test]
    fn create_dto_accepts_camel_case() {
        let d: UserAddressCreateDTO = serde_json::from_value(serde_json::json!({
            "addressTag": "家", "address": "某路 1 号", "positionAddress": "某地",
            "postcode": "100000", "consignee": "张三", "email": "a@b.c",
            "mobile": "13800000000", "mobileAreaCode": "+86",
            "telephone": "010-1", "isDefault": 1, "isSelected": 1,
            "regionIds": [1, 2, 3], "userId": 9, "isSystem": 0,
            "latitude": 39.9, "longitude": 116.4
        }))
        .unwrap();
        assert_eq!(d.address_tag.as_deref(), Some("家"));
        assert_eq!(d.region_ids.as_ref().map(Vec::len), Some(3));
        assert_eq!(d.is_default, Some(1));
        assert_eq!(d.latitude, Some(39.9));
    }

    #[test]
    fn vo_serializes_camel_case_fields() {
        let vo = UserAddressVO {
            address: "某路 1 号".into(),
            address_id: 2,
            consignee: "张三".into(),
            mobile: "13800000000".into(),
            is_default: 1,
            is_selected: 1,
            address_tag: "家".into(),
            user_id: 9,
            region_names: vec!["北京".into(), "朝阳".into()],
            region_ids: vec![1, 2],
            region_name: "北京 朝阳".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["addressId"], 2);
        assert_eq!(json["positionAddress"], serde_json::Value::Null);
        assert_eq!(json["regionName"], "北京 朝阳");
        assert_eq!(json["regionIds"][1], 2);
        assert_eq!(json["addressTag"], "家");
        assert_eq!(json["isSystem"], serde_json::Value::Null);
    }
}

#[cfg(test)]
mod tolerant_dto_tests {
    use super::*;

    /// H5 编辑页把 URL 参数 `?id=7`(字符串)原样放进 JSON 载荷,
    /// Java Jackson 宽松接受;serde 必须同样接受(线上 422 实测)。
    #[test]
    fn update_dto_accepts_string_ids() {
        let dto: UserAddressUpdateDTO = serde_json::from_str(
            r#"{"id":"7","addressId":"7","consignee":"A","mobile":"18834155321",
                "regionIds":["1","110000","110100","110101"],"address":"x",
                "isDefault":"0","latitude":"28.71","longitude":115.85}"#,
        )
        .expect("string numerics must parse");
        assert_eq!(dto.id, Some(7));
        assert_eq!(dto.address_id, Some(7));
        assert_eq!(dto.region_ids, Some(vec![1, 110000, 110100, 110101]));
        assert_eq!(dto.is_default, Some(0));
        assert_eq!(dto.latitude, Some(28.71));
        assert_eq!(dto.longitude, Some(115.85));
    }

    #[test]
    fn id_dto_accepts_string_id() {
        let dto: UserAddressIdDTO = serde_json::from_str(r#"{"id":"7"}"#).expect("string id ok");
        assert_eq!(dto.id, Some(7));
    }

    #[test]
    fn garbage_still_none_not_error() {
        let dto: UserAddressIdDTO = serde_json::from_str(r#"{"id":"NaN"}"#).expect("NaN → None");
        assert_eq!(dto.id, None);
        let dto: UserAddressUpdateDTO =
            serde_json::from_str(r#"{"latitude":"undefined"}"#).expect("undefined → None");
        assert_eq!(dto.latitude, None);
    }
}
