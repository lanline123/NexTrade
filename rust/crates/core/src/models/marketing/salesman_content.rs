//! 分销内容域（marketing::salesman_content）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.salesman.SalesmanContentController`
//!   （`@RequestMapping("/adminapi/salesman/content")`，8 个端点）
//! - 控制器 `com.tigshop.api.controller.salesman.SalesmanContentController`
//!   （`@RequestMapping("/api/salesman/content")`，2 个端点，auth=optional）
//! - 服务 `SalesmanContentServiceImpl`（继承 `BaseServiceImpl` 的
//!   `updateField` / `batch` / `del`）
//! - 入参 `SalesmanContentPageQuery` / `SalesmanContentSaveParam` /
//!   `SalesmanContentEditParam` + 公共 DTO `OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! - 出参 `SalesmanContentVO`；枚举 `ContentStatus`
//! - 表：`salesman_content`（实体 [`crate::entities::SalesmanContent`]）
//!
//! # 端点（10）
//! admin（8）：`GET /adminapi/salesman/content/{list,config,detail}`、
//! `POST /adminapi/salesman/content/{create,update,del,updateField,batch}`；
//! public（2）：`GET /api/salesman/content/{list,detail}`（auth=optional）。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`pics` 在 VO 中恒为 `null`**：Java `SalesmanContent` 的 `pics` 是
//!    `String`，`SalesmanContentVO.pics` 是 `List<String>`，Spring
//!    `BeanUtils.copyProperties` 类型不匹配会**静默跳过**，因此原实现的
//!    `list` / `detail` 从不返回 `pics`。本实现保持 `None`。
//! 2. **VO 的 `sortOrder` / `isShow` / `status` 恒为 `null`**：实体没有对应字段，
//!    `BeanUtils` 同样不赋值（Java 返回 `null`），本实现用 `None` 复刻。
//! 3. **`create` 的落库缺省值**：Java `SalesmanContentSaveParam` 没有
//!    `shopId` / `isAvailable` / `pics` 字段，MyBatis-Plus 默认
//!    `NOT_NULL` 插入策略会省略 `null` 列，由 DB 默认值兜底
//!    （`shop_id=0`、`is_available=1`、`pics=NULL`）。本实现按 DB 默认值显式写入。
//!    `end_time` 同理：Java 未传时由 DB 默认 `0` 兜底（不是 `NULL`）。
//! 4. **`update` 的 `pics` 不更新**：`SalesmanContentEditParam.pics` 是
//!    `List<String>`，实体是 `String`，`BeanUtils` 静默跳过（与 Java 一致）。
//! 5. **字符串时间解析失败的行为**：Java `TigUtils.toTimestampYmdHms` /
//!    `LocalDateTime.parse` 在非法格式时抛异常（HTTP 500）；本实现把
//!    "提交了但解析失败" 视为未提交（保留原值），避免把格式错误放大成 500。
//! 6. **时间按 UTC+8 解析/格式化**：Java 用 JVM 默认时区（生产为
//!    `Asia/Shanghai`）；本实现显式固定东八区，保证跨机器一致。
//! 7. **`detail` 记录不存在**：Java `BeanUtils.copyProperties(null, vo)` 抛
//!    `IllegalArgumentException`（500）；本实现返回 `Error::NotFound`。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ————————————————————— 状态枚举（Java `ContentStatus`） —————————————————————

/// 未开始。
pub const STATUS_NOT_START: i32 = 0;
/// 展示中。
pub const STATUS_SHOWING: i32 = 1;
/// 已失效。
pub const STATUS_END: i32 = 2;
/// 状态文案：未开始。
pub const MSG_STATUS_NOT_START: &str = "未开始";
/// 状态文案：展示中。
pub const MSG_STATUS_SHOWING: &str = "展示中";
/// 状态文案：已失效。
pub const MSG_STATUS_END: &str = "已失效";

/// `updateField` 字段白名单（Java `CheckFieldConstants.SALESMAN_CONTENT_FIELDS`）。
pub const SALESMAN_CONTENT_FIELDS: [&str; 3] = ["title", "is_top", "is_available"];

/// Java `SalesmanContentSaveParam.content` 的 `@NotBlank` 文案。
pub const MSG_CONTENT_REQUIRED: &str = "分销内容管理内容不能为空";
/// Java `SalesmanContentConstants.SALESMAN_CONTENT_ID_NOT_NULL`
/// （`SalesmanContentEditParam.id` 的 `@NotNull`，update 用）。
pub const MSG_EDIT_ID_REQUIRED: &str = "分销内容管理id不能为空";
/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO` 用）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// Java `ResultTextConstants.FIELD_NAME_CANNOT_BE_NULL`。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// Java `ResultTextConstants.FIELD_VALUE_CANNOT_BE_NULL`。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// Java `ResultTextConstants.INVALID_FIELD_VALUE`。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// Java `ResultTextConstants.UNSELECTED_ITEM`。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// Java `Constants.YES` / `Constants.NO`。
pub const CONST_YES: i32 = 1;
/// Java `Constants.YES` / `Constants.NO`。
pub const CONST_NO: i32 = 0;

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage#getSize` 页大小上限。
pub const MAX_PAGE_SIZE: u64 = 100;

/// `salesman_content` 表可参与 `ORDER BY` 的真实列（防注入）。
///
/// 对应 Java `BaseServiceImpl#buildSortOrder` + `getColumnByPropertyName`：
/// 属性名/列名归一到列名，未知列回退主键 `id`。
pub const SORTABLE_COLUMNS: [&str; 11] = [
    "id",
    "title",
    "img",
    "start_time",
    "end_time",
    "describe",
    "is_top",
    "content",
    "is_available",
    "shop_id",
    "pics",
];

/// Java `BaseServiceImpl#getColumnByPropertyName` 的属性名 → 列名映射。
///
/// 找不到的属性名回退主键 `id`（Java 防注入行为），随后白名单兜底。
#[must_use]
pub fn normalize_column(property: &str) -> &'static str {
    match property.trim() {
        "id" => "id",
        "title" => "title",
        "img" => "img",
        "startTime" | "start_time" => "start_time",
        "endTime" | "end_time" => "end_time",
        "describe" => "describe",
        "isTop" | "is_top" => "is_top",
        "content" => "content",
        "isAvailable" | "is_available" => "is_available",
        "shopId" | "shop_id" => "shop_id",
        "pics" => "pics",
        // Java：找不到属性 → 主键列
        _ => "id",
    }
}

/// 解析列表排序：返回 `(列名, 方向)`；`方向 = None` 表示 Java 不设置 `ORDER BY`。
///
/// 复刻 Java `SalesmanContentServiceImpl#list` +
/// `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)`：
/// - `sortField` 缺省/空 **或等于主键属性 `id`** → `id`
/// - `sortOrder == "asc"` → 升序
/// - `sortOrder == "desc"` 或**缺省/空** → 降序
/// - 其它非空值 → Java 不调用 `setOrders`（无排序子句）
#[must_use]
pub fn resolve_sort(
    sort_field: Option<&str>,
    sort_order: Option<&str>,
) -> (&'static str, Option<bool>) {
    let field = sort_field.map(str::trim).filter(|s| !s.is_empty());
    let column = match field {
        None => "id",
        Some(f) => normalize_column(f),
    };
    // 白名单兜底：只有真实列可进入 ORDER BY（未知列已在 normalize 回退 id）
    let column = SORTABLE_COLUMNS
        .iter()
        .copied()
        .find(|c| *c == column)
        .unwrap_or("id");

    let order = sort_order.map(str::trim).filter(|s| !s.is_empty());
    let desc = match order {
        // Java：sortOrder 为空 → desc 分支
        None => Some(true),
        Some(o) if o.eq_ignore_ascii_case("asc") => Some(false),
        Some(o) if o.eq_ignore_ascii_case("desc") => Some(true),
        // Java：既非 asc 也非 desc → 不设置排序
        Some(_) => None,
    };
    (column, desc)
}

/// 状态码 → 文案（Java `ContentStatus#getDescription`，无效码返回空串）。
#[must_use]
pub fn status_text(status: i32) -> &'static str {
    match status {
        STATUS_NOT_START => MSG_STATUS_NOT_START,
        STATUS_SHOWING => MSG_STATUS_SHOWING,
        STATUS_END => MSG_STATUS_END,
        _ => "",
    }
}

/// `GET /adminapi/salesman/content/config` 的返回：状态码 → 文案。
///
/// Java 逐个遍历 `ContentStatus.values()` 并 `translatePackage.translate`；
/// 本域文案为固定中文，翻译层不参与（与现有多域一致）。
#[must_use]
pub fn status_config() -> BTreeMap<i32, String> {
    let mut map = BTreeMap::new();
    for code in [STATUS_NOT_START, STATUS_SHOWING, STATUS_END] {
        map.insert(code, status_text(code).to_string());
    }
    map
}

/// 由起止时间推导状态文案（Java `SalesmanContentServiceImpl#getStatusText`）。
///
/// - `end_time` 为 `None`（Java `Long` 为 `null`）→ 空串（Java 直接返回 `""`）
/// - `now < start_time` → 未开始
/// - `now < end_time || end_time == 0` → 展示中
/// - 否则 → 已失效
#[must_use]
pub fn derive_status_text(now: i32, start_time: i32, end_time: Option<i32>) -> &'static str {
    let Some(end_time) = end_time else {
        return "";
    };
    if now < start_time {
        MSG_STATUS_NOT_START
    } else if now < end_time || end_time == 0 {
        MSG_STATUS_SHOWING
    } else {
        MSG_STATUS_END
    }
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；`None` / `<= 0` → `None`）。
///
/// 对应 Java `TigUtils#handelTime`：返回空串的情况在 VO 中对应字段为 `null`
/// （Java 只在 `time > 0` 时才调用 `handelTime` 并赋值）。
#[must_use]
pub fn format_time(secs: Option<i32>) -> Option<String> {
    use chrono::TimeZone;
    let secs = secs.filter(|s| *s > 0)?;
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
}

/// `yyyy-MM-dd HH:mm:ss` → Unix 秒（东八区；空/非法 → `None`）。
///
/// 对应 Java `TigUtils#toTimestampYmdHms`。
#[must_use]
pub fn parse_time(raw: Option<&str>) -> Option<i32> {
    use chrono::TimeZone;
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let dt = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S").ok()?;
    chrono::FixedOffset::east_opt(8 * 3600)?
        .from_local_datetime(&dt)
        .single()
        .map(|v| v.timestamp() as i32)
}

/// `yyyy-MM-dd` → 当日 00:00:00 Unix 秒（东八区；空/非法 → `None`）。
///
/// 对应 Java `TigUtils#toTimestampYmd`（列表时间范围过滤用）。
#[must_use]
pub fn parse_date(raw: Option<&str>) -> Option<i32> {
    use chrono::TimeZone;
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let date = chrono::NaiveDate::parse_from_str(text, "%Y-%m-%d").ok()?;
    chrono::FixedOffset::east_opt(8 * 3600)?
        .from_local_datetime(&date.and_hms_opt(0, 0, 0)?)
        .single()
        .map(|v| v.timestamp() as i32)
}

/// 列表查询参数（Java `SalesmanContentPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentPageQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）。
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）。
    pub size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`，缺省主键 `id`）。
    pub sort_field: Option<String>,
    /// 排序方向 `asc` / `desc`（缺省 `desc`）。
    pub sort_order: Option<String>,
    /// 查询关键字（Java `BasePage.keyword`；本接口未使用，保留兼容）。
    pub keyword: Option<String>,
    /// 状态筛选：0 未开始 / 1 展示中 / 其它视为已失效（Java `status`）。
    pub status: Option<i32>,
    /// 标题模糊搜索。
    pub title: Option<String>,
    /// 开始日期 `yyyy-MM-dd`（按 `start_time` 过滤）。
    pub start_time: Option<String>,
    /// 结束日期 `yyyy-MM-dd`（全部给定时按 `start_time` 区间过滤）。
    pub end_time: Option<String>,
    /// 来源标记；Java 服务端用 `"user"` 表示 C 端列表（由 public 控制器强制设置）。
    pub from: Option<String>,
}

impl SalesmanContentPageQuery {
    /// 归一化分页（Java `BasePage#getPage` / `#getSize`）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// 通用分页参数（供 [`crate::types::PageResult`] 口径使用）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        let (page, size) = self.page_params();
        PageQuery {
            page,
            page_size: size,
        }
    }

    /// 是否 C 端列表（Java `"user".equals(query.getFrom())`）。
    #[must_use]
    pub fn is_client(&self) -> bool {
        self.from.as_deref() == Some("user")
    }
}

/// 仓储分页过滤条件（由服务层把查询参数 + 账号归属归一后传入）。
#[derive(Debug, Clone, Default)]
pub struct SalesmanContentFilter {
    /// 标题模糊搜索（Java `like(title)`）。
    pub title: Option<String>,
    /// 开始日期时间戳（Java `toTimestampYmd(startTime)`）。
    pub start_time: Option<i32>,
    /// 结束日期时间戳（Java `toTimestampYmd(endTime)`）。
    pub end_time: Option<i32>,
    /// 状态筛选。
    pub status: Option<i32>,
    /// C 端过滤（Java `from == "user"` 附加的可见性条件）。
    pub from_user: bool,
    /// `shop_id` 过滤（Java 无条件 `eq(shop_id, shopId)`；`None` 对应 SQL `= NULL` 恒不命中）。
    pub shop_id: Option<i32>,
    /// 当前 Unix 秒（Java `StringUtils.getCurrentTime()`）。
    pub now: i32,
}

/// 新增入参（Java `SalesmanContentSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentSaveDTO {
    /// 主键（Java 声明但新增不使用）。
    pub id: Option<i32>,
    /// 标题。
    pub title: Option<String>,
    /// 页面描述（Java 字段名 `describe`）。
    #[serde(rename = "describe")]
    pub describe: Option<String>,
    /// 正文内容（Java `@NotBlank(message = 分销内容管理内容不能为空)`）。
    pub content: Option<String>,
    /// 封面图片。
    pub img: Option<String>,
    /// 推送时间字符串 `yyyy-MM-dd HH:mm:ss`。
    pub start_time: Option<String>,
    /// 失效时间字符串 `yyyy-MM-dd HH:mm:ss`。
    pub end_time: Option<String>,
    /// 是否置顶：1 是 0 否。
    pub is_top: Option<i32>,
}

/// 更新入参（Java `SalesmanContentEditParam`，`id` 必填）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanContentEditDTO {
    /// 主键（Java `@NotNull(message = 分销内容管理id不能为空)`）。
    pub id: Option<i32>,
    /// 标题。
    pub title: Option<String>,
    /// 页面描述。
    #[serde(rename = "describe")]
    pub describe: Option<String>,
    /// 正文内容。
    pub content: Option<String>,
    /// 封面图片。
    pub img: Option<String>,
    /// 推送时间字符串 `yyyy-MM-dd HH:mm:ss`。
    pub start_time: Option<String>,
    /// 失效时间字符串 `yyyy-MM-dd HH:mm:ss`（提交时联动 `is_available`）。
    pub end_time: Option<String>,
    /// 是否置顶：1 是 0 否。
    pub is_top: Option<i32>,
    /// 是否有效：1 是 0 否。
    pub is_available: Option<i32>,
    /// 店铺 ID。
    pub shop_id: Option<i32>,
    /// 多图（Java 类型不匹配，BeanUtils 会跳过，本实现保留字段但不落库）。
    pub pics: Option<Vec<String>>,
}

/// 删除入参（Java `com.tigshop.bean.dto.common.OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 备注（本域未使用）。
    pub admin_note: Option<String>,
    /// 页面类型（本域未使用）。
    pub page_type: Option<i32>,
}

/// 字段更新入参（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键。
    pub id: Option<i32>,
    /// 字段名（属性名或列名皆可）。
    pub field: Option<String>,
    /// 字段值。
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作入参（Java `com.tigshop.bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合。
    pub ids: Vec<i32>,
    /// 操作类型；Java `BaseServiceImpl#batch` 只认 `"del"`。
    pub r#type: Option<String>,
    /// 操作值（Java 声明为 `int value`，本域未使用）。
    pub value: i32,
}

/// 内容 VO（Java `SalesmanContentVO`，字段名逐字对齐）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanContentVO {
    /// 主键。
    pub id: i32,
    /// 标题。
    pub title: String,
    /// 页面描述。
    #[serde(rename = "describe")]
    pub describe: String,
    /// 正文内容。
    pub content: Option<String>,
    /// 封面图片。
    pub img: String,
    /// 推送时间（`yyyy-MM-dd HH:mm:ss`；0/未设置 → null）。
    pub start_time: Option<String>,
    /// 失效时间（`yyyy-MM-dd HH:mm:ss`；0/未设置 → null）。
    pub end_time: Option<String>,
    /// 排序（实体无此字段，Java 恒为 null）。
    pub sort_order: Option<i32>,
    /// 是否展示（实体无此字段，Java 恒为 null）。
    pub is_show: Option<i32>,
    /// 是否有效。
    pub is_available: Option<i32>,
    /// 是否置顶。
    pub is_top: i32,
    /// 状态（实体无此字段，Java 恒为 null）。
    pub status: Option<i32>,
    /// 状态文案（列表返回；详情 Java 不赋值 → null）。
    pub status_text: Option<String>,
    /// 店铺 ID。
    pub shop_id: i32,
    /// 多图（Java `String → List<String>` 类型不匹配被跳过，恒为 null）。
    pub pics: Option<Vec<String>>,
}

/// 校验新增入参（Java `@NotBlank content`）。
///
/// 注意：Java `create` 控制器没写 `@Valid`，该注解实际不生效；本实现仍做
/// 前置校验（文案逐字取自注解），属更严格的提前校验。
pub fn validate_save(dto: &SalesmanContentSaveDTO) -> Result<(), String> {
    match dto.content.as_deref().map(str::trim) {
        Some(c) if !c.is_empty() => Ok(()),
        _ => Err(MSG_CONTENT_REQUIRED.to_string()),
    }
}

/// `updateField` 字段白名单归一（Java `getColumnByPropertyName` + 白名单）。
///
/// 返回 `Some(列名)` 仅当列在 [`SALESMAN_CONTENT_FIELDS`] 内；否则 `None`
/// （调用方报 `field 的值有误`）。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    let column = normalize_column(field);
    SALESMAN_CONTENT_FIELDS
        .iter()
        .copied()
        .find(|f| *f == column)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_texts_match_java_enum() {
        assert_eq!(status_text(STATUS_NOT_START), "未开始");
        assert_eq!(status_text(STATUS_SHOWING), "展示中");
        assert_eq!(status_text(STATUS_END), "已失效");
        assert_eq!(status_text(9), "");
        // config 端点：Map<Integer,String>（JSON 键为字符串）
        let cfg = status_config();
        assert_eq!(cfg.len(), 3);
        assert_eq!(cfg.get(&0).map(String::as_str), Some("未开始"));
        assert_eq!(cfg.get(&1).map(String::as_str), Some("展示中"));
        assert_eq!(cfg.get(&2).map(String::as_str), Some("已失效"));
        let json = serde_json::to_value(&cfg).unwrap();
        assert_eq!(json["0"], "未开始");
        assert_eq!(json["1"], "展示中");
        assert_eq!(json["2"], "已失效");
    }

    #[test]
    fn derive_status_text_matches_java_get_status_text() {
        // endTime == null → ""（Java 先判 null）
        assert_eq!(derive_status_text(100, 200, None), "");
        assert_eq!(derive_status_text(250, 200, Some(300)), "展示中");
        assert_eq!(derive_status_text(100, 200, Some(300)), "未开始");
        // now < end || end == 0 → 展示中（0 表示无结束时间）
        assert_eq!(derive_status_text(250, 200, Some(0)), "展示中");
        assert_eq!(derive_status_text(350, 200, Some(300)), "已失效");
    }

    #[test]
    fn time_format_and_parse_match_east_eight() {
        // 东八区 2023-11-15 06:13:20 == 1700000000
        let ts = parse_time(Some("2023-11-15 06:13:20")).unwrap();
        assert_eq!(ts, 1_700_000_000i32);
        assert_eq!(
            format_time(Some(ts)).as_deref(),
            Some("2023-11-15 06:13:20")
        );
        assert_eq!(format_time(None), None);
        assert_eq!(format_time(Some(0)), None);
        assert_eq!(format_time(Some(-1)), None);
        assert_eq!(parse_time(Some("bad")), None);
        assert_eq!(parse_time(Some("  ")), None);
        assert_eq!(parse_time(None), None);
        // 日期 → 当日 00:00:00（东八区）
        assert_eq!(parse_date(Some("2023-11-15")), Some(1_699_977_600));
        assert_eq!(parse_date(Some("")), None);
        assert_eq!(parse_date(None), None);
    }

    #[test]
    fn sort_resolution_matches_base_service_impl() {
        // 缺省：主键 desc
        assert_eq!(resolve_sort(None, None), ("id", Some(true)));
        assert_eq!(resolve_sort(Some(""), Some("")), ("id", Some(true)));
        // 等于主键属性 → 主键列
        assert_eq!(resolve_sort(Some("id"), Some("asc")), ("id", Some(false)));
        // 属性名/列名都归一
        assert_eq!(
            resolve_sort(Some("isTop"), Some("DESC")),
            ("is_top", Some(true))
        );
        assert_eq!(resolve_sort(Some("is_top"), None), ("is_top", Some(true)));
        assert_eq!(
            resolve_sort(Some("startTime"), Some("asc")),
            ("start_time", Some(false))
        );
        // 非 asc/desc 值 → Java 不设置 ORDER BY
        assert_eq!(resolve_sort(Some("title"), Some("weird")), ("title", None));
        // 未知字段回退主键（防注入）
        assert_eq!(
            resolve_sort(Some("title; DROP TABLE x"), Some("asc")),
            ("id", Some(false))
        );
    }

    #[test]
    fn page_defaults_follow_java_base_page() {
        let q: SalesmanContentPageQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert_eq!(q.page_params(), (1, 15));
        assert_eq!(q.page_query().page_size, 15);
        // size > 100 → 100
        let q: SalesmanContentPageQuery =
            serde_json::from_value(serde_json::json!({"size": 101})).unwrap();
        assert_eq!(q.page_params().1, 100);
        // page 0 → 1
        let q: SalesmanContentPageQuery =
            serde_json::from_value(serde_json::json!({"page": 0, "size": 0})).unwrap();
        assert_eq!(q.page_params(), (1, 1));
    }

    #[test]
    fn dto_camel_case_binding() {
        let q: SalesmanContentPageQuery = serde_json::from_value(serde_json::json!({
            "page": 2, "size": 10, "sortField": "is_top", "sortOrder": "asc",
            "status": 1, "title": "活动", "startTime": "2026-01-01",
            "endTime": "2026-02-01", "from": "user"
        }))
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.sort_field.as_deref(), Some("is_top"));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.start_time.as_deref(), Some("2026-01-01"));
        assert!(q.is_client());

        let save: SalesmanContentSaveDTO = serde_json::from_value(serde_json::json!({
            "title": "标题", "describe": "描述", "content": "正文",
            "img": "a.png", "startTime": "2026-01-01 00:00:00",
            "endTime": "2026-12-31 23:59:59", "isTop": 1
        }))
        .unwrap();
        assert_eq!(save.title.as_deref(), Some("标题"));
        assert_eq!(save.describe.as_deref(), Some("描述"));
        assert_eq!(save.is_top, Some(1));

        let edit: SalesmanContentEditDTO = serde_json::from_value(serde_json::json!({
            "id": 5, "isAvailable": 1, "shopId": 2, "pics": ["a.png", "b.png"]
        }))
        .unwrap();
        assert_eq!(edit.id, Some(5));
        assert_eq!(edit.is_available, Some(1));
        assert_eq!(edit.shop_id, Some(2));
        assert_eq!(edit.pics.as_ref().map(Vec::len), Some(2));
    }

    #[test]
    fn validation_and_field_whitelist() {
        let mut dto = SalesmanContentSaveDTO::default();
        assert_eq!(validate_save(&dto).unwrap_err(), MSG_CONTENT_REQUIRED);
        dto.content = Some("  ".into());
        assert!(validate_save(&dto).is_err());
        dto.content = Some("正文".into());
        assert!(validate_save(&dto).is_ok());

        assert_eq!(normalize_field("isTop"), Some("is_top"));
        assert_eq!(normalize_field("is_available"), Some("is_available"));
        assert_eq!(normalize_field("title"), Some("title"));
        // 不在白名单 / 归一后回退主键 → None
        assert_eq!(normalize_field("content"), None);
        assert_eq!(normalize_field("isShow"), None);
        assert_eq!(normalize_field("unknown"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
        // 错误常量必须与 Java 逐字一致（此前误写成「分销内容管理ID不能为空」）
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_EDIT_ID_REQUIRED, "分销内容管理id不能为空");
        assert_eq!(MSG_FIELD_NAME_REQUIRED, "字段名不能为空");
        assert_eq!(MSG_FIELD_VALUE_REQUIRED, "值不能为空");
        assert_eq!(MSG_UNSELECTED_ITEM, "未选择项目");
    }

    #[test]
    fn vo_serializes_camel_case_and_null_semantics() {
        let vo = SalesmanContentVO {
            id: 1,
            title: "t".into(),
            describe: "d".into(),
            img: "i.png".into(),
            is_top: 1,
            shop_id: 2,
            status_text: Some(MSG_STATUS_SHOWING.to_string()),
            start_time: Some("2026-01-01 00:00:00".into()),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["statusText"], "展示中");
        assert_eq!(json["startTime"], "2026-01-01 00:00:00");
        assert!(json.get("describe").is_some());
        // Java 恒为 null 的字段必须序列化为 null（而不是省略）
        for key in ["sortOrder", "isShow", "status", "pics"] {
            assert!(json.get(key).is_some(), "{key} 应存在且为 null");
            assert!(json[key].is_null(), "{key} 应为 null");
        }
        // endTime 未设置 → null
        assert!(json["endTime"].is_null());
    }

    #[test]
    fn filter_defaults_and_clone() {
        let f = SalesmanContentFilter {
            title: Some("x".into()),
            shop_id: Some(0),
            now: 100,
            ..Default::default()
        };
        assert_eq!(f.now, 100);
        assert!(!f.from_user);
        assert_eq!(f.status, None);
        let cloned = f.clone();
        assert_eq!(cloned.title.as_deref(), Some("x"));
    }
}
