//! 税率管理域（payment::tax_rate）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.setting.TaxRate`（表 `tax_rate`，实体已由
//!   `tigshop_core::entities::setting::TaxRate` 自动生成，本文件不重复定义）
//! - `com.tigshop.bean.dto.setting.TaxRateDTO`
//! - `com.tigshop.bean.query.setting.TaxRatePageQuery`
//! - `com.tigshop.bean.vo.setting.TaxRateVO`
//! - `com.tigshop.bean.dto.common.OperateDTO`（本域自持副本，避免与其他切片
//!   产生编译期耦合；与 area_code 的处理方式一致）
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` /
//!   `sortField` / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额 / 精度
//!
//! 本域唯一的数值业务列是 `rate`（税率百分比），库列类型为
//! **`decimal(10,4)`**，因此必须用 `rust_decimal::Decimal`，
//! **禁止** `f64` / `f32`（浮点会丢精度且无法与 BigDecimal 逐位对齐）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::setting::TaxRate;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java 常量类 / CheckFieldConstants）
// ——————————————————————————————————————————————

/// `tax_rate` 真实存在的 8 个列
/// （`python tools/schema_parser.py --table tax_rate`）。
///
/// 用于 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const TAX_RATE_COLUMNS: [&str; 8] = [
    "tax_rate_id",
    "region_id",
    "region_name",
    "rate",
    "is_active",
    "remark",
    "create_time",
    "update_time",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → 实体主键属性 `taxRateId`
/// 映射到列 `tax_rate_id`）。
pub const KEY_COLUMN: &str = "tax_rate_id";

/// 主键属性名（Java `buildSortOrder` 里与 `id` 比较的其实是实体主键属性名，
/// 本域实体主键属性是 `taxRateId`；两者都视为「用主键列排序」）。
pub const KEY_PROPERTY: &str = "taxRateId";

/// 「是」的取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 税率百分比的库精度：`decimal(10,4)` → 小数位 4。
///
/// 用于 `rate` 的入参校验（见 [`validate_rate_scale`]）。
pub const RATE_SCALE: u32 = 4;

/// 税率下限（Java `TaxRateDTO` 上
/// `@DecimalMin(value = "0", message = "税率不能小于0")`，**含** 0）。
pub const RATE_MIN: &str = "0";

/// 税率上限（Java `TaxRateDTO` 上
/// `@DecimalMax(value = "100", message = "税率不能大于100")`，**含** 100）。
pub const RATE_MAX: &str = "100";

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
//
// 说明：`TaxRateServiceImpl` 的提示语是**内联字面量**（不是常量类），
// 因此这里直接照抄 `GlobalException("...")` 里的原文；
// 其余文案来自 Bean Validation 注解的 `message` 属性。

/// Java `TaxRateServiceImpl#detail`：
/// `throw new GlobalException("税率不存在")`。
pub const MSG_TAX_RATE_NOT_FOUND: &str = "税率不存在";

/// Java `TaxRateServiceImpl#update`：
/// `throw new GlobalException("税率ID不能为空")`。
pub const MSG_TAX_RATE_ID_REQUIRED: &str = "税率ID不能为空";

/// Java `TaxRateDTO.regionId` 的
/// `@NotNull(message = "国家和地区ID不能为空")`。
pub const MSG_REGION_ID_REQUIRED: &str = "国家和地区ID不能为空";

/// Java `TaxRateDTO.rate` 的 `@NotNull(message = "税率不能为空")`。
pub const MSG_RATE_REQUIRED: &str = "税率不能为空";

/// Java `TaxRateDTO.rate` 的
/// `@DecimalMin(value = "0", message = "税率不能小于0")`。
pub const MSG_RATE_MIN: &str = "税率不能小于0";

/// Java `TaxRateDTO.rate` 的
/// `@DecimalMax(value = "100", message = "税率不能大于100")`。
pub const MSG_RATE_MAX: &str = "税率不能大于100";

/// Java `OperateDTO.id` 的 `@NotNull(message = ID_CANNOT_IS_NULL)`，
/// 其中 `ResultTextConstants.ID_CANNOT_IS_NULL = "id不能为空"`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Rust 侧补的提示：`rate` 超出 `decimal(10,4)` 精度时使用。
///
/// Java 侧 `BigDecimal` 写入 `decimal(10,4)` 由 MySQL 静默**四舍五入**，
/// 不会报错，因此这条文案在 Java 中并不存在（见 `uncertain_points`）。
pub const MSG_RATE_SCALE_EXCEEDED: &str = "税率最多保留4位小数";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 税率 VO（对应 Java `com.tigshop.bean.vo.setting.TaxRateVO`）。
///
/// Java `list` / `detail` 都是
/// `BeanUtils.copyProperties(taxRate, vo)`，即**逐字段同名拷贝**，
/// 没有额外派生字段（对比 area_code 的 `AreaCodeVO.label`）。
///
/// ## ⚠️ 时间字段的 JSON 形态（与实体不同！）
///
/// 实体的 `create_time` / `update_time` 是 `Long` 秒级时间戳，
/// 但 VO 上这两个字段带
/// `@JsonSerialize(using = TimestampToDateSerializer.class)`，
/// 因此 **JSON 输出的是格式化字符串**，不是数字：
///
/// - `null` → `""`
/// - `<= 0` → `""`
/// - `> 0` → 固定 **`Asia/Shanghai`** 时区的 `yyyy-MM-dd HH:mm:ss`
/// - 解析异常 → 原样输出该值的字符串形式
///
/// 所以本 VO 的这两个字段类型是 `String`（而不是 `Option<i64>`），
/// 由 [`format_timestamp_secs`] 在构造时完成转换，
/// 保证前端拿到的 JSON 与 Java 逐字符一致。
///
/// 注意 `rate` 是 `Decimal`，与实体同宽，不做 float 往返。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TaxRateVO {
    /// 税率ID
    pub tax_rate_id: i32,
    /// 国家和地区ID
    pub region_id: i32,
    /// 国家和地区名称
    pub region_name: Option<String>,
    /// 税率(百分比)，`decimal(10,4)`
    pub rate: Decimal,
    /// 是否生效：1 是 0 否
    pub is_active: i32,
    /// 备注
    pub remark: Option<String>,
    /// 创建时间（已按 `TimestampToDateSerializer` 格式化）
    pub create_time: String,
    /// 更新时间（已按 `TimestampToDateSerializer` 格式化）
    pub update_time: String,
}

impl From<&TaxRate> for TaxRateVO {
    fn from(t: &TaxRate) -> Self {
        Self {
            tax_rate_id: t.tax_rate_id,
            region_id: t.region_id,
            region_name: t.region_name.clone(),
            rate: t.rate,
            is_active: t.is_active,
            remark: t.remark.clone(),
            create_time: format_timestamp_secs(t.create_time),
            update_time: format_timestamp_secs(t.update_time),
        }
    }
}

impl From<TaxRate> for TaxRateVO {
    fn from(t: TaxRate) -> Self {
        Self::from(&t)
    }
}

/// 复刻 Java `com.tigshop.common.config.TimestampToDateSerializer`：
/// 秒级时间戳 → 固定 `Asia/Shanghai` 时区的 `yyyy-MM-dd HH:mm:ss`。
///
/// 逐条对齐 Java 分支：
/// - `None` → `""`
/// - `Some(v)` 且 `v <= 0` → `""`
/// - `Some(v)` 且 `v > 0` → 格式化字符串
///
/// 时区**硬编码 `Asia/Shanghai`（UTC+8）**，与 Java 的
/// `ZoneId.of("Asia/Shanghai")` 一致——注意它**不是**系统默认时区。
/// 中国自 1991 年起不再实行夏令时，因此以东八区固定偏移换算即可
/// 与 Java 结果逐秒一致（详见 `uncertain_points` 的历史时区说明）。
#[must_use]
pub fn format_timestamp_secs(ts: Option<i64>) -> String {
    const SHANGHAI_OFFSET_SECS: i64 = 8 * 3600;
    match ts {
        None => String::new(),
        Some(v) if v <= 0 => String::new(),
        Some(v) => {
            let local = v.saturating_add(SHANGHAI_OFFSET_SECS);
            civil_from_unix_secs(local)
        }
    }
}

/// Unix 秒（此处已加过时区偏移）→ `yyyy-MM-dd HH:mm:ss`。
///
/// 使用 Howard Hinnant 的 `civil_from_days` 算法（纯整数运算，
/// 无时区库依赖、无浮点、无 panic 面），对
/// `i64` 全域有效；日期超出 `i32` 年时做饱和处理。
fn civil_from_unix_secs(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    // days since 1970-01-01 → (year, month, day)
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };

    format!("{year:04}-{m:02}-{d:02} {hour:02}:{minute:02}:{second:02}")
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `TaxRatePageQuery`）。
///
/// Java 侧字段（对照 `TaxRateServiceImpl#list` 的取用点）：
/// `regionName`（模糊）、`isActive`（精确）、`startTime` / `endTime`
/// （创建时间范围，**字符串日期**，经
/// `StringUtils.dateToTimestampExample` 转时间戳）、
/// `sortField` / `sortOrder`（继承自 `BasePage`）、`page` / `size`。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`，而项目统一 `PageQuery` 用的是
/// `pageSize`。本结构体为**入参**，按 Java 契约用 `size`；
/// 转成内部 `PageQuery` 时由 [`TaxRateListQuery::page_query`] 完成桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TaxRateListQuery {
    /// 国家和地区名称（Java `regionName`，`LIKE %regionName%`）
    pub region_name: Option<String>,
    /// 是否生效（Java `isActive`，`eq`）
    pub is_active: Option<i32>,
    /// 创建时间起（Java `startTime`，字符串日期）
    pub start_time: Option<String>,
    /// 创建时间止（Java `endTime`，字符串日期）
    pub end_time: Option<String>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值或空 ⇒ 降序，Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl TaxRateListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotBlank`）。
    #[must_use]
    pub fn effective_region_name(&self) -> Option<&str> {
        non_blank(self.region_name.as_deref())
    }

    /// 有效的起始时间字符串（Java `StrUtil.isNotBlank(query.getStartTime())`）。
    #[must_use]
    pub fn effective_start_time(&self) -> Option<&str> {
        non_blank(self.start_time.as_deref())
    }

    /// 有效的结束时间字符串（Java `StrUtil.isNotBlank(query.getEndTime())`）。
    #[must_use]
    pub fn effective_end_time(&self) -> Option<&str> {
        non_blank(self.end_time.as_deref())
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 是否需要「无显式排序字段」时的默认排序
    /// （Java `list`：`StrUtil.isNotBlank(sortField)` 为假时
    /// `orderByDesc(isActive).orderByDesc(createTime)`）。
    #[must_use]
    pub fn uses_default_order(&self) -> bool {
        non_blank(self.sort_field.as_deref()).is_none()
    }

    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// - `sortField` 为空或等于主键属性名 → 主键列
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序；`desc`、空 ⇒ 降序；
    ///   其它非法值**完全不追加 ORDER BY**（Java 是 `else if` 的缺口）
    ///
    /// ⚠️ 本方法**只在** `sortField` 非空时被调用；`sortField` 为空时
    /// Java 走的是 [`default_order_clause`]，两条路径不要混淆。
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
            // Java `buildSortOrder` 是 `if asc {..} else if desc||empty {..}`，
            // 非法值落到两分支之外 ⇒ 无 ORDER BY
            Some(_) => String::new(),
        }
    }
}

/// `sortField` 为空时 Java 使用的默认排序
/// （`orderByDesc(TaxRate::getIsActive).orderByDesc(TaxRate::getCreateTime)`）。
#[must_use]
pub fn default_order_clause() -> &'static str {
    " ORDER BY is_active DESC, create_time DESC"
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `tax_rate` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "taxRateId" | "tax_rate_id" | "id" => "tax_rate_id",
        "regionId" | "region_id" => "region_id",
        "regionName" | "region_name" => "region_name",
        "rate" => "rate",
        "isActive" | "is_active" => "is_active",
        "remark" => "remark",
        "createTime" | "create_time" => "create_time",
        "updateTime" | "update_time" => "update_time",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 保存请求（Java `com.tigshop.bean.dto.setting.TaxRateDTO`）。
///
/// `create` 与 `update` **共用同一个 DTO**（Java 控制器两处都是
/// `@RequestBody TaxRateDTO dto`），区别只在 `update` 要求
/// `taxRateId` 非空（`TaxRateServiceImpl#update` 内显式判空并抛
/// `"税率ID不能为空"`）。因此本项目不为更新单独建 DTO，
/// 复刻 Java 的「同一 DTO + 服务层判空」结构。
///
/// ## 已验证的 Bean Validation 约束（`@Valid @RequestBody`，逐字符照抄）
///
/// | 字段 | 约束 | message |
/// |------|------|---------|
/// | `regionId` | `@NotNull` | `国家和地区ID不能为空` |
/// | `rate` | `@NotNull` + `@DecimalMin("0")` + `@DecimalMax("100")` | 三条见常量 |
///
/// ⚠️ `@DecimalMin` / `@DecimalMax` 的边界是**闭区间**（`inclusive` 默认
/// `true`），即 `rate == 0` 与 `rate == 100` 都**合法**。
/// `taxRateId` / `regionName` / `isActive` / `remark` **无**校验注解。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TaxRateDTO {
    /// 税率ID（`update` 必填；`create` 忽略）
    pub tax_rate_id: Option<i32>,
    /// 国家和地区ID（`@NotNull`）
    pub region_id: Option<i32>,
    /// 国家和地区名称（为空时服务层按 `regionId` 回查 `region` 表补全）
    pub region_name: Option<String>,
    /// 税率(百分比)，`decimal(10,4)`（`@NotNull` + 0..=100）
    pub rate: Option<Decimal>,
    /// 是否生效：1 是 0 否（`create` 未传时默认 [`YES`]）
    pub is_active: Option<i32>,
    /// 备注
    pub remark: Option<String>,
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

// ——————————————————————————————————————————————
// 校验辅助（纯函数，便于单测）
// ——————————————————————————————————————————————

/// 去空白后取非空字符串（Java `StrUtil.isNotBlank` 的等价物）。
///
/// ⚠️ 与 `isNotEmpty` 不同：`"   "` 视为空（`isBlank` 语义）。
/// `TaxRateServiceImpl` 里三处判断用的是 `isNotBlank`（`regionName` /
/// `startTime` / `endTime`），因此这里必须按 `isBlank` 口径。
#[must_use]
pub fn non_blank(s: Option<&str>) -> Option<&str> {
    s.map(str::trim).filter(|t| !t.is_empty())
}

/// 校验 `rate` 的取值范围：`@DecimalMin("0")` ~ `@DecimalMax("100")`，
/// **闭区间**（Java 这两个注解的 `inclusive` 默认为 `true`）。
///
/// 返回 `Err(msg)` 时 `msg` 逐字符照抄 Java 注解的 `message`，
/// 便于前端按原文案展示。
pub fn validate_rate_range(rate: Decimal) -> Result<(), String> {
    if rate < Decimal::ZERO {
        return Err(MSG_RATE_MIN.to_string());
    }
    if rate > Decimal::from(100) {
        return Err(MSG_RATE_MAX.to_string());
    }
    Ok(())
}

/// 校验 `rate` 是否放得进库列 `decimal(10,4)`（整数位 6 位 + 小数位 4 位）。
///
/// ⚠️ 这是 Rust 侧**新增**的校验，Java 没有对应逻辑：Java 把
/// `BigDecimal` 直接交给 MySQL，超出精度时 MySQL 按
/// `sql_mode` **静默四舍五入**（不报错），因此 Java 侧观察不到错误。
/// 本实现显式拒绝，避免"看起来写成功了但值被改小"的静默数据损坏
/// （见 `uncertain_points`）。
///
/// 注意：`Decimal::scale()` 只反映**小数位数**，不含整数位；
/// 整数位上限由 `validate_rate_range` 的 `<= 100` 覆盖，
/// 因此这里只需守住小数位。
pub fn validate_rate_scale(rate: Decimal) -> Result<(), String> {
    if rate.scale() > RATE_SCALE {
        return Err(MSG_RATE_SCALE_EXCEEDED.to_string());
    }
    Ok(())
}

/// 一次性执行 `create` 的入参校验（对照 Java `@Valid` 的触发点）。
///
/// 顺序与 Bean Validation 的**不确定**性不同，这里固定为
/// 先 `regionId` 再 `rate`，便于测试断言稳定。
pub fn validate_create(dto: &TaxRateDTO) -> Result<Decimal, String> {
    if dto.region_id.is_none() {
        return Err(MSG_REGION_ID_REQUIRED.to_string());
    }
    let rate = dto.rate.ok_or_else(|| MSG_RATE_REQUIRED.to_string())?;
    validate_rate_range(rate)?;
    validate_rate_scale(rate)?;
    Ok(rate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("测试常量必须是合法 Decimal")
    }

    /// `sortField` 为空时走默认排序：`is_active DESC, create_time DESC`。
    #[test]
    fn default_order_when_sort_field_blank() {
        let q = TaxRateListQuery::default();
        assert!(q.uses_default_order());
        assert_eq!(
            default_order_clause(),
            " ORDER BY is_active DESC, create_time DESC"
        );
    }

    /// 属性名与列名都要能映射到真实列。
    #[test]
    fn order_column_accepts_property_and_column_names() {
        assert_eq!(map_order_column("isActive"), "is_active");
        assert_eq!(map_order_column("is_active"), "is_active");
        assert_eq!(map_order_column("createTime"), "create_time");
        assert_eq!(map_order_column("rate"), "rate");
        // 未识别字段回退主键列（MyBatis-Plus 防注入行为）
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("1; DROP TABLE tax_rate"), KEY_COLUMN);
    }

    /// `sortOrder` 语义：asc 升序；desc / 空 降序；非法值完全不排序。
    #[test]
    fn order_direction_semantics() {
        let mut q = TaxRateListQuery {
            sort_field: Some("rate".into()),
            ..Default::default()
        };
        q.sort_order = Some("asc".into());
        assert_eq!(q.order_clause(), " ORDER BY rate ASC");
        q.sort_order = Some("DESC".into());
        assert_eq!(q.order_clause(), " ORDER BY rate DESC");
        q.sort_order = None;
        assert_eq!(q.order_clause(), " ORDER BY rate DESC");
        // Java `else if` 缺口：非法值完全不追加 ORDER BY
        q.sort_order = Some("weird".into());
        assert_eq!(q.order_clause(), "");
    }

    /// 主键属性名 / 列名 / 字面 `id` 都按其主键列解析。
    #[test]
    fn order_by_primary_key_variants() {
        for f in ["taxRateId", "tax_rate_id", "id"] {
            let q = TaxRateListQuery {
                sort_field: Some(f.into()),
                sort_order: Some("asc".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), " ORDER BY tax_rate_id ASC", "field={f}");
        }
    }

    /// `non_blank`：`"   "` 视为空（`isBlank` 而不是 `isNotEmpty`）。
    #[test]
    fn non_blank_treats_whitespace_as_empty() {
        assert_eq!(non_blank(Some("  x ")), Some("x"));
        assert_eq!(non_blank(Some("   ")), None);
        assert_eq!(non_blank(Some("")), None);
        assert_eq!(non_blank(None), None);
    }

    /// 分页默认值：page=1、size=15，并夹在 1..=100。
    #[test]
    fn page_query_defaults_and_clamp() {
        let q = TaxRateListQuery::default();
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 15);

        let q = TaxRateListQuery {
            page: Some(0),
            size: Some(9999),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 100);
    }

    /// `rate` 精度校验：`decimal(10,4)` 最多 4 位小数。
    #[test]
    fn rate_scale_validation() {
        assert!(validate_rate_scale(dec("13")).is_ok());
        assert!(validate_rate_scale(dec("13.0000")).is_ok());
        assert!(validate_rate_scale(dec("0.0001")).is_ok());
        assert!(validate_rate_scale(dec("13.00001")).is_err());
    }

    /// `rate` 范围校验：0..=100 **闭区间**（Java 的 inclusive 默认 true）。
    #[test]
    fn rate_range_is_inclusive() {
        // 边界合法
        assert!(validate_rate_range(dec("0")).is_ok());
        assert!(validate_rate_range(dec("100")).is_ok());
        assert!(validate_rate_range(dec("100.0000")).is_ok());
        // 越界报 Java 原文案
        assert_eq!(
            validate_rate_range(dec("-0.0001")),
            Err(MSG_RATE_MIN.to_string())
        );
        assert_eq!(
            validate_rate_range(dec("100.0001")),
            Err(MSG_RATE_MAX.to_string())
        );
        assert_eq!(MSG_RATE_MIN, "税率不能小于0");
        assert_eq!(MSG_RATE_MAX, "税率不能大于100");
    }

    /// `create` 校验顺序：缺 regionId → 缺 rate → 越界 → 精度。
    #[test]
    fn validate_create_order_and_messages() {
        // 缺 regionId
        let dto = TaxRateDTO {
            rate: Some(dec("13")),
            ..Default::default()
        };
        assert_eq!(
            validate_create(&dto),
            Err("国家和地区ID不能为空".to_string())
        );

        // 有 regionId 但缺 rate
        let dto = TaxRateDTO {
            region_id: Some(1),
            ..Default::default()
        };
        assert_eq!(validate_create(&dto), Err("税率不能为空".to_string()));

        // 正常
        let dto = TaxRateDTO {
            region_id: Some(1),
            rate: Some(dec("13.0000")),
            ..Default::default()
        };
        assert_eq!(validate_create(&dto), Ok(dec("13.0000")));

        // 精度超限（Rust 侧新增校验）
        let dto = TaxRateDTO {
            region_id: Some(1),
            rate: Some(dec("1.00001")),
            ..Default::default()
        };
        assert_eq!(
            validate_create(&dto),
            Err("税率最多保留4位小数".to_string())
        );
    }

    /// 时间戳格式化必须复刻 `TimestampToDateSerializer`：
    /// null / <=0 → 空串；>0 → 固定 UTC+8 的 `yyyy-MM-dd HH:mm:ss`。
    #[test]
    fn timestamp_formats_like_java_serializer() {
        assert_eq!(format_timestamp_secs(None), "");
        assert_eq!(format_timestamp_secs(Some(0)), "");
        assert_eq!(format_timestamp_secs(Some(-1)), "");
        // 1700000000 = 2023-11-14 22:13:20 UTC → +8h = 2023-11-15 06:13:20
        assert_eq!(
            format_timestamp_secs(Some(1_700_000_000)),
            "2023-11-15 06:13:20"
        );
        // 边界：1970-01-01 00:00:01 UTC → 1970-01-01 08:00:01 (+08:00)
        assert_eq!(format_timestamp_secs(Some(1)), "1970-01-01 08:00:01");
        // 闰年 2024-02-29（UTC 2024-02-29 04:00:00 → +8h 同日 12:00）
        assert_eq!(
            format_timestamp_secs(Some(1_709_179_200)),
            "2024-02-29 12:00:00"
        );
    }

    /// VO 与实体同名映射；时间字段是**格式化字符串**而不是数字。
    #[test]
    fn vo_maps_entity_fields_verbatim() {
        let e = TaxRate {
            tax_rate_id: 7,
            region_id: 3,
            region_name: Some("中国大陆".into()),
            rate: dec("13.0000"),
            is_active: YES,
            remark: Some("标准税率".into()),
            create_time: Some(1_700_000_000),
            update_time: Some(1_700_000_001),
        };
        let vo = TaxRateVO::from(&e);
        assert_eq!(vo.tax_rate_id, 7);
        assert_eq!(vo.region_id, 3);
        assert_eq!(vo.region_name.as_deref(), Some("中国大陆"));
        // 逐位相等（Decimal 而不是 f64）
        assert_eq!(vo.rate, dec("13.0000"));
        assert_eq!(vo.is_active, YES);
        assert_eq!(vo.create_time, "2023-11-15 06:13:20");
        assert_eq!(vo.update_time, "2023-11-15 06:13:21");
    }

    /// VO 序列化后的 JSON 字段名是 camelCase，时间为字符串。
    #[test]
    fn vo_serializes_camel_case_with_string_time() {
        let e = TaxRate {
            tax_rate_id: 1,
            region_id: 2,
            rate: dec("5.5"),
            is_active: YES,
            create_time: None,
            ..Default::default()
        };
        let json = serde_json::to_string(&TaxRateVO::from(&e)).expect("应能序列化");
        assert!(json.contains("\"taxRateId\":1"), "json={json}");
        assert!(json.contains("\"regionId\":2"), "json={json}");
        assert!(json.contains("\"isActive\":1"), "json={json}");
        assert!(json.contains("\"createTime\":\"\""), "json={json}");
        // rate 保持 decimal 精度（5.5 而不是浮点）
        assert!(json.contains("\"rate\":\"5.5\""), "json={json}");
    }

    /// `TaxRateDTO` 的 camelCase JSON 往返（前端字段名契约）。
    #[test]
    fn dto_camel_case_roundtrip() {
        let raw = r#"{"taxRateId":5,"regionId":2,"regionName":"美国","rate":"8.2500","isActive":1,"remark":"r"}"#;
        let dto: TaxRateDTO = serde_json::from_str(raw).expect("应能反序列化");
        assert_eq!(dto.tax_rate_id, Some(5));
        assert_eq!(dto.region_id, Some(2));
        assert_eq!(dto.rate, Some(dec("8.2500")));
        assert_eq!(dto.is_active, Some(1));
        // 缺省字段应为 None（`#[serde(default)]` + Option）
        let empty: TaxRateDTO = serde_json::from_str("{}").expect("空对象应可用");
        assert_eq!(empty.tax_rate_id, None);
        assert_eq!(empty.rate, None);
    }

    /// 列/字段常量必须与 `python tools/schema_parser.py --table tax_rate` 一致。
    #[test]
    fn column_constants_match_schema() {
        assert_eq!(
            TAX_RATE_COLUMNS,
            [
                "tax_rate_id",
                "region_id",
                "region_name",
                "rate",
                "is_active",
                "remark",
                "create_time",
                "update_time",
            ]
        );
        assert_eq!(KEY_COLUMN, "tax_rate_id");
        assert_eq!(KEY_PROPERTY, "taxRateId");
    }
}
