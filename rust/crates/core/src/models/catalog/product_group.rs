//! 商品分组域 DTO / VO / 查询参数 / 纯函数。
//!
//! 对应 Java：
//! - `com.tigshop.bean.dto.product.ProductGroupListDTO`（extends `BasePage`）
//! - `com.tigshop.bean.dto.product.ProductGroupCreateDTO`
//! - `com.tigshop.bean.dto.product.ProductGroupUpdateDTO`
//! - `com.tigshop.bean.vo.product.ProductGroupVO`
//! - `com.tigshop.bean.model.product.ProductGroup`（`clientList` 直接返回实体）
//! - `com.tigshop.bean.dto.common.OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! - `com.tigshop.common.constant.product.ProductGroupConstants`
//! - `com.tigshop.common.constant.CheckFieldConstants.GENERAL_FIELDS`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#buildSortOrder`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! # 与 Java 的对照要点
//!
//! - `product_group` 表**没有** `is_show` / `sort_order` / `status` 列，而
//!   `ProductGroupController#updateField` 传入的是
//!   `CheckFieldConstants.GENERAL_FIELDS = {"is_show","sort_order","status"}`。
//!   Java `getColumnByPropertyName` 找不到属性时**回退主键列**
//!   `product_group_id`，它不在白名单内 ⇒ **该接口在 Java 里必定报
//!   `field 的值有误`**。本实现如实复刻该行为（见
//!   [`is_allowed_update_field`]），不做「善意修正」。
//! - `product_ids` 列是 JSON 文本（`text NULL`），Java 用 Hutool
//!   `JSONUtil.toJsonStr(List<Integer>)` 写入、`JSONUtil.toList(...)` 读出；
//!   VO 中 `productIds` 为 `List<Integer>`，`addTime` 为格式化字符串。
//! - `add_time` 是 `int NULL` 秒级时间戳；VO 用 `yyyy-MM-dd HH:mm:ss`（UTC+8），
//!   与 Java `DateUtil.format(date, DATE_FORMAT)` 一致。
//! - `ProductGroupCreateDTO` / `ProductGroupUpdateDTO` 上的 `@Size` / `@NotNull`
//!   注解在 Java 里**因控制器未加 `@Valid` 而不生效**（只有 `ProductGroup`
//!   全类 `@PreAuthorize`），故服务层不做名称长度/非空校验，保持原样。
//!   仅 `ProductGroupConstants.PRODUCT_GROUP_ID_NOT_NULL` 在 update 时需要
//!   一个 ID 才能定位记录，服务层用它做显式校验。

use serde::{Deserialize, Serialize};

use crate::entities::ProductGroup;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `BaseServiceImpl` / `CheckFieldConstants` / `*Constants`）
// ——————————————————————————————————————————————

/// 主键列（Java `BaseServiceImpl#getKeyColumn` → `product_group_id`）。
pub const KEY_COLUMN: &str = "product_group_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `productGroupId`）。
pub const KEY_PROPERTY: &str = "productGroupId";

/// `product_group` 的真实列清单（`python tools/schema_parser.py --table product_group`）。
///
/// 顺序与实体 [`crate::entities::ProductGroup`] 的字段顺序一致。
pub const GROUP_COLUMNS: [&str; 7] = [
    "product_group_id",
    "product_group_name",
    "product_group_sn",
    "product_group_description",
    "product_ids",
    "add_time",
    "shop_id",
];

/// `updateField` 的允许字段（Java
/// `CheckFieldConstants.GENERAL_FIELDS = {"is_show","sort_order","status"}`）。
///
/// ⚠️ `product_group` 表没有任何一个这些列，因此 Java 的
/// `getColumnByPropertyName` 会把它们全部回退成主键列 `product_group_id`，
/// 白名单校验必然失败 ⇒ 接口总是报「field 的值有误」。**这不是笔误**，
/// 本实现原样保留（见模块注释）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 字段值有误（Java `ResultTextConstants.INVALID_FIELD_VALUE = "field 的值有误"`）。
pub const INVALID_FIELD_VALUE: &str = "field 的值有误";

/// 商品分组不存在（Java 侧为 `BeanUtils.copyProperties(null, ...)` 的 NPE，
/// 无业务文案；本实现用业务 500 文案替代，见模块 `uncertain_points`）。
pub const GROUP_NOT_FOUND: &str = "商品分组不存在";

/// 商品分组 ID 为空（Java `ProductGroupConstants.PRODUCT_GROUP_ID_NOT_NULL`）。
pub const GROUP_ID_REQUIRED: &str = "商品分组id不能为空";

/// 主键为空（Java `UpdateFieldDTO.id` 的 `@NotNull(message = "id不能为空")`）。
pub const ID_REQUIRED: &str = "id不能为空";

/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// 未选中任何条目（Java `BatchDTO.ids` 的 `@NotEmpty(message = "未选择项目")`；
/// 注意 `ProductGroupController#batch` **没有 `@Valid`**，该注解不生效）。
pub const UNSELECTED_ITEM: &str = "未选择项目";

/// 操作类型为空（Java `BatchDTO.type` 的 `@NotNull` 文案，同样未生效）。
pub const OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 商品分组列表 / clientList 查询
/// （对应 Java `ProductGroupListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGroupListQuery {
    /// 分组名称（`clientList` 用它做 `LIKE`；`list` 用的是 `keyword`）
    pub product_group_name: Option<String>,
    /// 逗号分隔的分组 ID 串（`list` 用它做 `IN`）
    pub product_group_ids: Option<String>,
    /// 排序字段（属性名或列名，未识别回退主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 搜索关键字（Java `BasePage.keyword`，`list` 对 `product_group_name` 做 `LIKE`）
    pub keyword: Option<String>,
    /// 页码，从 1 开始（Java `BasePage.page`，null ⇒ 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，null ⇒ 15，上限 100）
    pub size: Option<u64>,
}

impl ProductGroupListQuery {
    /// 转成内部 [`PageQuery`]（Java `BasePage.getPage()` / `getSize()` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).min(100),
        }
    }

    /// `list` 的有效关键字（Java `StringUtils.isNotEmpty(keyword)`：
    /// **只判空串/null，不 trim**；`LIKE` 绑定原始值）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// `clientList` 的有效分组名（Java
    /// `StrUtil.isNotBlank(listDTO.getProductGroupName())`：去空白后判空；
    /// `LIKE` 绑定原始值）。
    #[must_use]
    pub fn effective_group_name(&self) -> Option<&str> {
        self.product_group_name
            .as_deref()
            .filter(|s| !s.trim().is_empty())
    }

    /// 解析逗号分隔的分组 ID 串。
    ///
    /// Java：`Arrays.stream(listDTO.getProductGroupIds().split(","))` 直接把
    /// **字符串**放进 `IN`，由 MySQL 隐式转 int；本实现显式 `parse` 成 i32，
    /// 非数字项忽略。返回：
    /// - `None`：不过滤（参数缺失 / 空白 / 无有效项）
    /// - `Some(ids)`：`IN (...)` 过滤
    ///
    /// ⚠️ 若参数非空但**全部**无法解析，本实现返回 `None`（不过滤）；
    /// Java 会生成 `IN ('abc')`，MySQL 转 `0` 后通常匹配不到行。
    /// 两者在「参数本来就是非法值」时都不会返回有意义的业务数据，
    /// 见 `uncertain_points`。
    #[must_use]
    pub fn effective_group_ids(&self) -> Option<Vec<i32>> {
        let raw = self
            .product_group_ids
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())?;
        let ids: Vec<i32> = raw
            .split(',')
            .filter_map(|s| s.trim().parse::<i32>().ok())
            .collect();
        if ids.is_empty() {
            None
        } else {
            Some(ids)
        }
    }

    /// 解析 ORDER BY 子句（列名来自白名单，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// 未识别字段回退主键列；`asc` 升序，`desc`/空降序，其它值不追加排序。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `product_group` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（与 Java 的安全修复行为一致）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "productGroupId" | "product_group_id" => "product_group_id",
        "productGroupName" | "product_group_name" => "product_group_name",
        "productGroupSn" | "product_group_sn" => "product_group_sn",
        "productGroupDescription" | "product_group_description" => "product_group_description",
        "productIds" | "product_ids" => "product_ids",
        "addTime" | "add_time" => "add_time",
        "shopId" | "shop_id" => "shop_id",
        // Java 找不到时返回主键列（防 SQL 注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（对应 Java `BaseServiceImpl#getColumnByPropertyName`：
/// 属性名/列名命中返回真实列，否则回退主键列）。
#[must_use]
pub fn map_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// `updateField` 白名单校验：Java
/// `Arrays.asList(GENERAL_FIELDS).contains(getColumnByPropertyName(field))`。
///
/// ⚠️ 由于 `product_group` 没有任何 `is_show` / `sort_order` / `status` 列，
/// 任何输入归一后都**不可能**命中白名单 ⇒ 恒为 `false`
/// （这正是 Java 的现网行为）。
#[must_use]
pub fn is_allowed_update_field(field: &str) -> bool {
    GENERAL_FIELDS.contains(&map_field_column(field))
}

/// 商品分组创建入参（对应 Java `ProductGroupCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGroupCreateDTO {
    /// 分组名称
    pub product_group_name: Option<String>,
    /// 分组别名
    pub product_group_sn: Option<String>,
    /// 分组描述
    pub product_group_description: Option<String>,
    /// 关联商品 ID 列表
    pub product_ids: Option<Vec<i32>>,
    /// 店铺 ID（服务层用请求头解析值**覆盖**它，与 Java `setShopId(getShopId())` 一致）
    pub shop_id: Option<i32>,
}

/// 商品分组更新入参（对应 Java `ProductGroupUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductGroupUpdateDTO {
    /// 分组 ID（必填，用于定位记录）
    pub product_group_id: Option<i32>,
    /// 分组名称（`None` ⇒ 不更新该列，对应 MyBatis-Plus NOT_NULL 策略）
    pub product_group_name: Option<String>,
    /// 分组别名（`None` ⇒ 不更新）
    pub product_group_sn: Option<String>,
    /// 分组描述（`None` ⇒ 不更新）
    pub product_group_description: Option<String>,
    /// 关联商品 ID 列表（Java **总是**写入：空 ⇒ `"[]"`）
    pub product_ids: Option<Vec<i32>>,
    /// 店铺 ID（DTO 传了才会覆盖，Java `BeanUtils.copyProperties` 语义）
    pub shop_id: Option<i32>,
}

/// 单 ID 操作请求（对应 Java `bean.dto.common.OperateDTO`，只用到 `id`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作请求（对应 Java `bean.dto.common.BatchDTO`）。
///
/// ⚠️ `ProductGroupController#batch` **没有 `@Valid`**，故 `@NotEmpty(ids)` /
/// `@NotNull(type)` 在 Java 中不生效；本结构体同样不做反序列化期校验，
/// 由服务层按 Java `BaseServiceImpl#batch` 的真实分支处理。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合
    pub ids: Option<Vec<i32>>,
    /// 操作类型，本域仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（本域未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求（对应 Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 商品分组 VO（对应 Java `ProductGroupVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductGroupVO {
    /// 分组 ID
    pub product_group_id: i32,
    /// 分组名称
    pub product_group_name: Option<String>,
    /// 分组别名
    pub product_group_sn: Option<String>,
    /// 分组描述
    pub product_group_description: Option<String>,
    /// 关联商品 ID 列表（库中是 JSON 文本，VO 为数组）
    pub product_ids: Vec<i32>,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，空值 ⇒ `""`）
    pub add_time: String,
    /// 店铺 ID
    pub shop_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// `product_ids` JSON 文本 → `Vec<i32>`（对应 Java
/// `JSONUtil.toList(productGroup.getProductIds(), Integer.class)`）。
///
/// - `None` / 空白 ⇒ 空列表（Java `product_ids` 为 `NULL` 时的兜底）
/// - 非法 JSON ⇒ 空列表（Java 会抛 `JSONException` → 500；本实现选择
///   容错空列表，避免脏数据导致详情接口整体不可用，见 `uncertain_points`）
#[must_use]
pub fn parse_product_ids(raw: Option<&str>) -> Vec<i32> {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<i32>>(raw).unwrap_or_default()
}

/// `Vec<i32>` → `product_ids` JSON 文本（对应 Java
/// `JSONUtil.toJsonStr(List<Integer>)`，输出形如 `[1,2,3]`）。
#[must_use]
pub fn product_ids_to_json(ids: &[i32]) -> String {
    serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_string())
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8）。
///
/// 对应 Java `ProductGroupServiceImpl#list` 的
/// `DateUtil.format(DateUtil.date(addTime * 1000), DATE_FORMAT)`；
/// `None` ⇒ `""`（Java 对 `null` 会 NPE，这里选择空串兜底）。
#[must_use]
pub fn format_add_time(secs: Option<i32>) -> String {
    let Some(secs) = secs else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 实体 → VO（对应 Java `BeanUtils.copyProperties` + `setProductIds`
/// + `setAddTime`）。
#[must_use]
pub fn group_to_vo(entity: &ProductGroup) -> ProductGroupVO {
    ProductGroupVO {
        product_group_id: entity.product_group_id,
        product_group_name: entity.product_group_name.clone(),
        product_group_sn: entity.product_group_sn.clone(),
        product_group_description: entity.product_group_description.clone(),
        product_ids: parse_product_ids(entity.product_ids.as_deref()),
        add_time: format_add_time(entity.add_time),
        shop_id: entity.shop_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 查询参数 ————————————————

    #[test]
    fn list_query_accepts_java_param_names() {
        let q: ProductGroupListQuery = serde_json::from_str(
            r#"{"productGroupName":"首页","productGroupIds":"3,1",
                "keyword":"推荐","page":2,"size":30,
                "sortField":"addTime","sortOrder":"asc"}"#,
        )
        .expect("ProductGroupListQuery 应接受 camelCase Java 参数名");
        assert_eq!(q.effective_group_name(), Some("首页"));
        assert_eq!(q.effective_keyword(), Some("推荐"));
        assert_eq!(q.effective_group_ids(), Some(vec![3, 1]));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
    }

    #[test]
    fn list_query_defaults_match_base_page() {
        let q: ProductGroupListQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        assert_eq!(q.effective_keyword(), None);
        assert_eq!(q.effective_group_name(), None);
        assert_eq!(q.effective_group_ids(), None);
        // 空 sortField ⇒ 主键列；空 sortOrder ⇒ 降序
        assert_eq!(q.order_clause(), " ORDER BY product_group_id DESC");
    }

    #[test]
    fn group_ids_accepts_comma_list_and_ignores_junk() {
        let make = |s: &str| ProductGroupListQuery {
            product_group_ids: Some(s.into()),
            ..Default::default()
        };
        assert_eq!(make("1,2, 3").effective_group_ids(), Some(vec![1, 2, 3]));
        // 有合法项就保留合法项
        assert_eq!(make("1,abc,2").effective_group_ids(), Some(vec![1, 2]));
        // 全部非法 / 空白 ⇒ 不过滤
        assert_eq!(make("abc").effective_group_ids(), None);
        assert_eq!(make("  ").effective_group_ids(), None);
        assert_eq!(make("").effective_group_ids(), None);
    }

    #[test]
    fn order_clause_follows_java_three_branches() {
        for (field, column) in [
            ("productGroupName", "product_group_name"),
            ("product_group_sn", "product_group_sn"),
            ("addTime", "add_time"),
            ("shopId", "shop_id"),
        ] {
            let q = ProductGroupListQuery {
                sort_field: Some(field.into()),
                sort_order: Some("DESC".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), format!(" ORDER BY {column} DESC"));
        }
        // 主键属性名 / 列名 / 未识别字段 → 主键列
        for field in ["productGroupId", "product_group_id", "nope"] {
            let q = ProductGroupListQuery {
                sort_field: Some(field.into()),
                sort_order: Some("asc".into()),
                ..Default::default()
            };
            assert_eq!(
                q.order_clause(),
                " ORDER BY product_group_id ASC",
                "{field}"
            );
        }
        // 非法 sortOrder ⇒ 不追加 ORDER BY
        let q = ProductGroupListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    // ———————————————— updateField 白名单（Java 恒失败） ————————————————

    #[test]
    fn update_field_whitelist_always_rejects() {
        // product_group 没有任何 GENERAL_FIELDS 列；Java 归一后必回退主键列，
        // 主键列不在白名单 ⇒ 任何输入都被拒（现网 Java 行为）
        assert_eq!(GENERAL_FIELDS, ["is_show", "sort_order", "status"]);
        for input in [
            "is_show",
            "isShow",
            "sort_order",
            "sortOrder",
            "status",
            "productGroupName",
            "productGroupId",
            "product_group_id",
            "1; DROP TABLE product_group",
        ] {
            assert!(
                !is_allowed_update_field(input),
                "{input} 在 Java 里也必须被拒（字段归一后不在 GENERAL_FIELDS）"
            );
        }
        // 归一结果：主键列 / 真实列，绝不可能是 GENERAL_FIELDS 中的常量列
        assert_eq!(map_field_column("isShow"), KEY_COLUMN);
        assert_eq!(map_field_column("product_group_name"), "product_group_name");
    }

    // ———————————————— product_ids JSON ————————————————

    #[test]
    fn product_ids_json_roundtrip() {
        assert_eq!(product_ids_to_json(&[1, 2, 3]), "[1,2,3]");
        assert_eq!(product_ids_to_json(&[]), "[]");
        assert_eq!(parse_product_ids(Some("[1,2,3]")), vec![1, 2, 3]);
        assert_eq!(parse_product_ids(Some("[]")), Vec::<i32>::new());
        // 空 / 缺失 / 非法 ⇒ 空列表（容错）
        assert_eq!(parse_product_ids(None), Vec::<i32>::new());
        assert_eq!(parse_product_ids(Some("  ")), Vec::<i32>::new());
        assert_eq!(parse_product_ids(Some("not-json")), Vec::<i32>::new());
        assert_eq!(parse_product_ids(Some("[1,\"x\"]")), Vec::<i32>::new());
        // 往返
        let ids = vec![9, 8, 7];
        assert_eq!(parse_product_ids(Some(&product_ids_to_json(&ids))), ids);
    }

    // ———————————————— 时间 / VO ————————————————

    #[test]
    fn add_time_formats_like_java() {
        assert_eq!(format_add_time(None), "");
        // 2023-11-14T22:13:20Z + 8h = 2023-11-15 06:13:20
        assert_eq!(format_add_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
    }

    #[test]
    fn vo_maps_entity_json_ids_to_array() {
        let entity = ProductGroup {
            product_group_id: 5,
            product_group_name: Some("首页推荐".into()),
            product_group_sn: Some("home".into()),
            product_group_description: Some("描述".into()),
            product_ids: Some("[3,4]".into()),
            add_time: Some(1_700_000_000),
            shop_id: Some(0),
        };
        let vo = group_to_vo(&entity);
        assert_eq!(vo.product_group_id, 5);
        assert_eq!(vo.product_group_name.as_deref(), Some("首页推荐"));
        assert_eq!(vo.product_ids, vec![3, 4]);
        assert_eq!(vo.add_time, "2023-11-15 06:13:20");

        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["productGroupId"], 5);
        assert_eq!(json["productIds"], serde_json::json!([3, 4]));
        assert_eq!(json["addTime"], "2023-11-15 06:13:20");
    }

    #[test]
    fn dto_parses_create_and_update_bodies() {
        let c: ProductGroupCreateDTO = serde_json::from_str(
            r#"{"productGroupName":"首页","productGroupSn":"home",
                "productGroupDescription":"d","productIds":[1,2],"shopId":3}"#,
        )
        .unwrap();
        assert_eq!(c.product_group_name.as_deref(), Some("首页"));
        assert_eq!(c.product_ids, Some(vec![1, 2]));
        assert_eq!(c.shop_id, Some(3));

        let u: ProductGroupUpdateDTO =
            serde_json::from_str(r#"{"productGroupId":8,"productGroupName":"新名"}"#).unwrap();
        assert_eq!(u.product_group_id, Some(8));
        assert_eq!(u.product_group_name.as_deref(), Some("新名"));
        assert_eq!(u.product_ids, None);
    }
}
