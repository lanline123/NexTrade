//! 访问统计域（analytics::statistics）DTO / VO / 时间与增长率工具。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.panel.StatisticsAccessController`
//!   （`@RequestMapping("/adminapi/panel/statisticsAccess")`）
//! - `com.tigshop.adminapi.controller.panel.StatisticsUserController`
//!   （`@RequestMapping("/adminapi/panel/statisticsUser")`）
//! - `com.tigshop.service.panel.impl.StatisticsAccessServiceImpl`
//! - `com.tigshop.service.panel.impl.StatisticsUserServiceImpl`
//! - `com.tigshop.common.utils.TigUtils`（`getRangeDate` / `getGrowthRate` /
//!   `toTimestampYmd` / `toTimestampYmdHms` / `toDecimalConvert`）
//! - `com.tigshop.common.utils.StringUtils`（`getPrevDate`）
//! - `com.tigshop.bean.dto.panel.{AccessStatisticsDTO, UserConsumptionRankingDTO,
//!   UserStatisticsPanelDTO}`
//! - `com.tigshop.bean.query.panel.UserTrendsQuery`
//! - `com.tigshop.bean.vo.panel.{AxisVO, UserConsumptionRankingVO,
//!   UserStatisticsPanelVO}`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 入参字段名以**前端**为准
//!
//! Java 的 DTO 用 `startTime` / `endTime` / `isHits`（**不是** `startDate`
//! / `endDate` / `dateType`），`addUserTrends` 更是只有一个
//! `startEndTime`。前端 `java/view/admin/src/types/panel/*.d.ts` 逐字段确认：
//! `statisticsAccess` → `{startTime, endTime, isHits}`；
//! `newMembers` → `{startEndTime, dateType, isExport}`；
//! `consumerRanking` → `{startTime, endTime, keyword, page, size, sortField,
//! sortOrder}`；`statisticsUser` → `{startTime, endTime, isExport}`。
//! 字段名写错会静默变 `None`（serde 不会报错），所以这里是硬约束。
//!
//! ## 金额 / 比率
//!
//! 消费金额（`order_amount`）与各种增长率/转化率一律
//! `rust_decimal::Decimal`，**禁** `f64` / `f32`。
//! Java `RoundingMode.HALF_UP` 的等价物是
//! `rust_decimal::RoundingStrategy::MidpointAwayFromZero`
//! （`rust_decimal` **没有** `HalfUp` 变体）。
//!
//! ## 时区（本域最大的坑）
//!
//! Java 侧有两套时间口径：
//! 1. 序列化层 `TimestampToDateSerializer` 固定 `Asia/Shanghai`；
//! 2. `TigUtils.toTimestampYmd*` / `StringUtils.getPrevDate` 用
//!    `ZoneId.systemDefault()`（生产 JVM 通常也是 `Asia/Shanghai`）。
//!
//! 本实现统一按 **UTC+8** 换算秒级时间戳（与 tax_rate 的既定选择一致）。
//! 若部署时区不是 +8，日边界会有小时级偏移（见切片 `uncertain_points`）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// Java `PaymentStatus.PAID.getCode()`。
///
/// 用于「已支付订单」判据：访问统计链路是 `pay_status = 2`，
/// 用户面板的成交用户数是 `pay_status >= 2`（Java 用的是 `ge`，不是 `eq`）。
pub const PAYMENT_STATUS_PAID: i32 = 2;

/// 增长率保留小数位（Java `getGrowthRate` 的
/// `divide(prev, 4, RoundingMode.HALF_UP)`）。
pub const GROWTH_RATE_SCALE: u32 = 4;

/// 转化率的两位小数（Java `TigUtils.toDecimalConvert`
/// → `setScale(2, HALF_UP)`）。
pub const PERCENT_SCALE: u32 = 2;

/// UTC+8 偏移秒数（Java `ZoneId.systemDefault()` 在生产环境的等效值）。
pub const UTC8_OFFSET_SECS: i64 = 8 * 3600;

/// 一天的秒数。
pub const SECS_PER_DAY: i64 = 86_400;

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// `StatisticsAccessController.accessStatistics` 的入参
/// （Java `com.tigshop.bean.dto.panel.AccessStatisticsDTO`）。
///
/// ⚠️ 该 DTO **没有** `dateType`：横轴固定按「自定义（逐日）」生成。
/// `shopId` 会被控制器用 `HeaderUtils.getShopId()` 覆盖。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AccessStatisticsQuery {
    /// 开始时间（Java `startTime`）
    pub start_time: Option<String>,
    /// 结束时间（Java `endTime`）
    pub end_time: Option<String>,
    /// 店铺id（Java 用 `HeaderUtils.getShopId()` 覆盖）
    pub shop_id: Option<i32>,
    /// `isHits > 0` ⇒ 取 `click_count`（浏览量），否则取 `visitor_count`（访客数）
    pub is_hits: Option<i32>,
}

/// `StatisticsUserController.addUserTrends` 的入参
/// （Java `com.tigshop.bean.query.panel.UserTrendsQuery`，带 `@Validated`）。
///
/// ⚠️ 只有一个日期字段 `startEndTime`（**不是** start/end 两个）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserTrendsQuery {
    /// 日期（`@NotBlank(message = "请选择日期")`）
    pub start_end_time: Option<String>,
    /// 数据类型（`@NotNull(message = "数据类型不能为空")`）：
    /// `1`=年、`2`=月、`3`=日
    ///
    /// ⚠️ 前端可能传字符串（`"1"`）；Java 的 Jackson 绑定 `Integer` 失败会
    /// 抛 400，但本契约的既有约定是「类型不符 → `None`」，故用宽松解析。
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub date_type: Option<i32>,
    /// 是否导出（Java `isExport == 1` 时写 Excel；Rust 侧忽略，仍返回 JSON）
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub is_export: Option<i32>,
    /// 店铺id（Java 读了但**没用**，本实现同样不按店铺过滤）
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub shop_id: Option<i32>,
}

/// 宽松地把 JSON 数值解析为 `Option<i32>`；字符串/对象/数组等一律视为缺失。
///
/// 仅用于**查询参数**：前端把 `dateType` / `isExport` 当字符串传是历史行为，
/// 严格解析会让整个请求 400，而 Java 侧对这两字段的容错是「忽略」。
fn de_opt_i32_lenient<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.as_i64().and_then(|v| i32::try_from(v).ok()),
        // 原版前端把 dateType/isExport 作为字符串传（"1"/"0"）。
        Some(serde_json::Value::String(s)) => s.trim().parse::<i32>().ok(),
        _ => None,
    })
}

/// `StatisticsUserController.userStatisticsPanel` 的入参
/// （Java `com.tigshop.bean.dto.panel.UserStatisticsPanelDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserStatisticsPanelDTO {
    /// 开始时间
    pub start_time: Option<String>,
    /// 结束时间
    pub end_time: Option<String>,
    /// 是否导出
    pub is_export: Option<i32>,
    /// 店铺id（Java 用 `HeaderUtils.getShopId()` 覆盖）
    pub shop_id: Option<i32>,
}

/// `StatisticsUserController.userConsumptionRanking` 的入参
/// （Java `com.tigshop.bean.dto.panel.UserConsumptionRankingDTO`）。
///
/// ⚠️ Java 该 DTO `extends BasePage` **又**重新声明了
/// `page` / `size` / `sortField` / `sortOrder`（并有自己的 `keyword`），
/// 因此这里把分页字段**平铺**，不做嵌套。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserConsumptionRankingDTO {
    /// 开始时间（`yyyy-MM-dd`）
    pub start_time: Option<String>,
    /// 结束时间（`yyyy-MM-dd`）
    pub end_time: Option<String>,
    /// 店铺id（Java 用 `HeaderUtils.getShopId()` 覆盖）
    pub shop_id: Option<i32>,
    /// 关键字（匹配 `user.username` 或 `user.mobile`）
    pub keyword: Option<String>,
    /// 是否导出
    pub is_export: Option<i32>,
    /// 页码
    pub page: Option<u64>,
    /// 每页大小
    pub size: Option<u64>,
    /// 排序字段（Java 白名单映射见 `StatisticsService::ranking_order_by`）
    pub sort_field: Option<String>,
    /// 排序方向（`asc` 表示升序，其它一律降序）
    pub sort_order: Option<String>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 复刻 Java `com.tigshop.bean.vo.panel.AxisVO`（趋势图横/纵轴）。
///
/// ⚠️ 两个列表 Java 初始化为 `new ArrayList<>()`，**永远不为 `null`**。
/// ⚠️ 纵轴是 `Vec<Decimal>`（Java `List<BigDecimal>`），禁 `f64`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AxisVO {
    /// 横轴（刻度标签）
    pub horizontal_axis: Vec<String>,
    /// 纵轴（与横轴按下标对齐的数值）
    pub longitudinal_axis: Vec<Decimal>,
}

impl AxisVO {
    /// 空轴（Java 初始化即空列表，不是 null）。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 轴是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.horizontal_axis.is_empty()
    }
}

/// 复刻 Java `com.tigshop.bean.vo.panel.UserConsumptionRankingVO`。
///
/// ⚠️ Java 的 `mobile` 带 `@Sensitive(SensitiveType.PHONE)`，
/// 但该脱敏序列化器**仅在 `tigshop.is-demo=1` 时生效**；Rust 侧无演示开关，
/// 因此**原样输出**（不脱敏），见切片 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserConsumptionRankingVO {
    /// 会员名称（Java `t1.username`）
    pub username: Option<String>,
    /// 手机号（Java `t1.mobile`；LEFT JOIN 未命中时为 null）
    pub mobile: Option<String>,
    /// 订单数（Java `COUNT(t.order_id) as order_num`）
    pub order_num: i64,
    /// 消费总额（Java `SUM(t.total_amount) AS order_amount`，必须 `Decimal`）
    pub order_amount: Decimal,
}

/// 复刻 Java `com.tigshop.bean.vo.panel.UserStatisticsPanelVO`。
///
/// 计数字段 Java 是 `Integer` / `Long`，此处统一 `i64`；
/// 增长率/转化率 Java 是 `BigDecimal`，此处 `Decimal`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserStatisticsPanelVO {
    /// 访问量（`SUM(visitor_count)`）
    pub visit_num: i64,
    /// 访问量环比增长率
    pub visit_growth_rate: Decimal,
    /// 浏览量（`SUM(click_count)`）
    pub view_num: i64,
    /// 浏览量环比增长率
    pub view_growth_rate: Decimal,
    /// 新增用户数（`user.reg_time` 落在区间内）
    pub add_user_num: i64,
    /// 新增用户数环比增长率
    pub add_user_growth_rate: Decimal,
    /// 成交用户数（`order` 去重 `user_id`）
    pub deal_user_num: i64,
    /// 成交用户数环比增长率
    ///
    /// ⚠️ Java 此处 `getGrowthRate(current, prev)` 的实参顺序与其它项**相反**，
    /// 净效果是**正负号相反**。本实现逐字复刻，见
    /// `StatisticsService::user_statistics_panel`。
    pub deal_user_growth_rate: Decimal,
    /// 访客-支付转化率（Java 实为 `新增用户 / 浏览量 × 100`）
    pub visit_to_user: Decimal,
    /// 访客-支付转化率的环比增长率
    pub visit_to_user_rate: Decimal,
    /// 充值用户数（`user_recharge_order` 去重 `user_id`）
    pub recharge_user_num: i64,
    /// 充值用户数环比增长率（同 `deal_user_growth_rate`，Java 实参顺序相反）
    pub recharge_user_growth_rate: Decimal,
}

// ——————————————————————————————————————————————
// 日期 / 数值工具（复刻 Java `TigUtils` / `StringUtils`）
// ——————————————————————————————————————————————

/// 是否闰年（格里高利历）。
#[must_use]
pub fn is_leap(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// 某年某月的天数（复刻 Java `LocalDate.lengthOfMonth()` /
/// hutool `DateUtil.lengthOfMonth`）；非法月份返回 `0`。
#[must_use]
pub fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap(year) {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

/// Howard Hinnant 的 `days_from_civil`（公历 → Unix 天数）。
#[must_use]
pub fn days_from_civil(y: i32, m: u32, d: u32) -> i64 {
    let y = i64::from(if m <= 2 { y - 1 } else { y });
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = i64::from((m + 9) % 12);
    let doy = (153 * mp + 2) / 5 + i64::from(d) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `days_from_civil` 的逆运算（Unix 天数 → 公历年月日）。
#[must_use]
pub fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = u32::try_from(doy - (153 * mp + 2) / 5 + 1).unwrap_or(1);
    let m = u32::try_from(if mp < 10 { mp + 3 } else { mp - 9 }).unwrap_or(1);
    let y = if m <= 2 { y + 1 } else { y };
    (i32::try_from(y).unwrap_or(0), m, d)
}

/// 归一化为 `yyyy-MM-dd` 字符串。
#[must_use]
pub fn format_ymd(year: i32, month: u32, day: u32) -> String {
    format!("{year:04}-{month:02}-{day:02}")
}

/// 严格解析 `yyyy-MM-dd`（**恰好 10 字符**，且月/日合法）。
#[must_use]
pub fn parse_ymd(s: &str) -> Option<(i32, u32, u32)> {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return None;
    }
    let year: i32 = s.get(0..4)?.parse().ok()?;
    let month: u32 = s.get(5..7)?.parse().ok()?;
    let day: u32 = s.get(8..10)?.parse().ok()?;
    if !(1..=12).contains(&month) || day == 0 || day > days_in_month(year, month) {
        return None;
    }
    Some((year, month, day))
}

/// 取 `yyyy-MM-dd...` 的前 10 个字符当作日期解析
/// （hutool `new DateTime(String)` / `DateUtil.parse(String)` 都允许带时间部分）。
#[must_use]
pub fn parse_ymd_prefix(s: &str) -> Option<(i32, u32, u32)> {
    if s.len() < 10 {
        return None;
    }
    parse_ymd(s.get(0..10)?)
}

/// 严格解析 `yyyy-MM-dd HH:mm:ss`（**恰好 19 字符**）。
#[must_use]
pub fn parse_datetime(s: &str) -> Option<(i32, u32, u32, i64, i64, i64)> {
    let b = s.as_bytes();
    if b.len() != 19
        || b[4] != b'-'
        || b[7] != b'-'
        || b[10] != b' '
        || b[13] != b':'
        || b[16] != b':'
    {
        return None;
    }
    let (y, mo, d) = parse_ymd(s.get(0..10)?)?;
    let hour: i64 = s.get(11..13)?.parse().ok()?;
    let minute: i64 = s.get(14..16)?.parse().ok()?;
    let second: i64 = s.get(17..19)?.parse().ok()?;
    if hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    Some((y, mo, d, hour, minute, second))
}

/// 夏令时/年 0 等都不考虑：把合法年月日时分秒按 **UTC+8** 折算成秒级时间戳。
#[must_use]
pub fn datetime_secs(y: i32, mo: u32, d: u32, h: i64, mi: i64, s: i64) -> i64 {
    days_from_civil(y, mo, d) * SECS_PER_DAY + h * 3600 + mi * 60 + s - UTC8_OFFSET_SECS
}

/// 解析 `yyyy-MM-dd`（当日 00:00:00，UTC+8）为秒级时间戳。
///
/// 复刻 Java `TigUtils.toTimestampYmd(String)`
/// （`DateUtil.parse(dateStr, "yyyy-MM-dd").getTime() / 1000`）。
#[must_use]
pub fn date_start_secs(date: &str) -> Option<i64> {
    let (y, m, d) = parse_ymd_prefix(date)?;
    Some(datetime_secs(y, m, d, 0, 0, 0))
}

/// 解析 `yyyy-MM-dd HH:mm:ss`（UTC+8）为秒级时间戳。
///
/// 复刻 Java `TigUtils.toTimestampYmdHms(String)`。
#[must_use]
pub fn datetime_secs_str(s: &str) -> Option<i64> {
    let (y, m, d, h, mi, sec) = parse_datetime(s)?;
    Some(datetime_secs(y, m, d, h, mi, sec))
}

/// 宽松解析：接受 `yyyy-MM-dd`（补 `00:00:00`）或 `yyyy-MM-dd HH:mm:ss`。
///
/// 复刻 hutool `DateUtil.parse(String)`（`UserTrendsQuery#transStartEndTime`
/// 用的就是不指定格式的 `DateUtil.parse`）。
#[must_use]
pub fn parse_flexible_secs(s: &str) -> Option<i64> {
    if s.len() == 19 {
        datetime_secs_str(s)
    } else {
        date_start_secs(s)
    }
}

/// 日期加减天数（`yyyy-MM-dd` 进出）。
#[must_use]
pub fn shift_date(date: &str, delta_days: i64) -> Option<String> {
    let (y, m, d) = parse_ymd(date)?;
    let (y2, m2, d2) = civil_from_days(days_from_civil(y, m, d) + delta_days);
    Some(format_ymd(y2, m2, d2))
}

/// 两个 `yyyy-MM-dd` 之间的天数差（后减前）。
#[must_use]
pub fn days_between(start: &str, end: &str) -> Option<i64> {
    let (sy, sm, sd) = parse_ymd(start)?;
    let (ey, em, ed) = parse_ymd(end)?;
    Some(days_from_civil(ey, em, ed) - days_from_civil(sy, sm, sd))
}

/// 复刻 Java `StringUtils.getPrevDate(String[] startEndTime, int type)`
/// 的 `type == 4` 分支（本域唯一用到的分支）：
///
/// ```text
/// daysBetween = DAYS.between(startDate, endDate)
/// prevStart   = startDate.minusDays(daysBetween)
/// prevEnd     = endDate.minusDays(daysBetween)
/// ```
///
/// ⚠️ 不是「整体平移一个窗口长度」—— 区间长度不变但会**与本期重叠**：
/// `[2024-05-01, 2024-05-31]`（delta=30）→ `[2024-04-01, 2024-05-01]`。
#[must_use]
pub fn get_prev_date(start: &str, end: &str) -> Option<(String, String)> {
    let delta = days_between(start, end)?;
    Some((shift_date(start, -delta)?, shift_date(end, -delta)?))
}

/// 复刻 Java `TigUtils.getRangeDate(Integer dateType, String startTime,
/// String endTime)`。
///
/// Java 逻辑：
/// - `startTime` 形如 `yyyy-MM`（长度 7）→ 追加 `"-01"`
/// - `startTime` 形如 `yyyy`（长度 4）→ 追加 `"-01-01"`
/// - `dateType == 1` → `[当年 01-01, 当年 12-31]`（年份取自 startTime）
/// - `dateType == 2` → `[当月 01, 当月最后一天]`（闰年感知，取自 startTime）
/// - `dateType == 3` → `[startTime + " 00:00:00", endTime + " 23:59:59"]`
/// - 其它 → `[归一化后的 startTime, 原样 endTime]`
///
/// 返回 `None` 表示 Java 侧会抛异常（解析失败 / case 3 缺 endTime）。
#[must_use]
pub fn get_range_date(
    date_type: Option<i32>,
    start: Option<&str>,
    end: Option<&str>,
) -> Option<(String, String)> {
    let raw_start = start?;
    let norm_start = normalize_short_start(raw_start);
    let (y, m, _) = parse_ymd_prefix(&norm_start)?;
    match date_type {
        Some(1) => Some((format!("{y:04}-01-01"), format!("{y:04}-12-31"))),
        Some(2) => {
            let last = days_in_month(y, m);
            Some((
                format!("{y:04}-{m:02}-01"),
                format!("{y:04}-{m:02}-{last:02}"),
            ))
        }
        Some(3) => Some((
            format!("{norm_start} 00:00:00"),
            format!("{} 23:59:59", end?),
        )),
        _ => Some((norm_start, end?.to_string())),
    }
}

/// `yyyy-MM`（恰好 7 字符，`\d{4}-\d{2}`）→ 追加 `-01`；
/// `yyyy`（恰好 4 字符）→ 追加 `-01-01`；其它原样。
///
/// 复刻 Java `getRangeDate` 开头的两个 `matches` 判断。
#[must_use]
pub fn normalize_short_start(s: &str) -> String {
    if is_yyyy_mm(s) {
        format!("{s}-01")
    } else if is_yyyy(s) {
        format!("{s}-01-01")
    } else {
        s.to_string()
    }
}

/// `\d{4}-\d{2}` 判据。
fn is_yyyy_mm(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 7
        && b[4] == b'-'
        && b[0..4].iter().all(u8::is_ascii_digit)
        && b[5..7].iter().all(u8::is_ascii_digit)
}

/// `\d{4}` 判据。
fn is_yyyy(s: &str) -> bool {
    s.len() == 4 && s.as_bytes().iter().all(u8::is_ascii_digit)
}

/// 生成 `[start, end]` 内**逐日**的 `yyyy-MM-dd` 列表（含两端）。
///
/// 对应 Java `OverviewServiceImpl#getHorizontalAxis` 的 default 分支。
#[must_use]
pub fn date_range_days(start: &str, end: &str) -> Option<Vec<String>> {
    let (sy, sm, sd) = parse_ymd(start)?;
    let (ey, em, ed) = parse_ymd(end)?;
    let mut cur = days_from_civil(sy, sm, sd);
    let last = days_from_civil(ey, em, ed);
    if cur > last {
        return Some(Vec::new());
    }
    let mut out = Vec::new();
    while cur <= last {
        let (y, m, d) = civil_from_days(cur);
        out.push(format_ymd(y, m, d));
        cur += 1;
    }
    Some(out)
}

/// 复刻 Java `TigUtils.getGrowthRate(BigDecimal prev, BigDecimal current)`。
///
/// Java 逐条：
/// - 任一为 `null` → `0`
/// - `prev == 0` → `current == 0 ? 0 : 100`
/// - 否则 `(current - prev) / prev`，`setScale(4, HALF_UP)`，再 `× 100`
///
/// ⚠️ `prev == 0 && current != 0` 时 Java **硬编码 100**（不是无穷大）。
#[must_use]
pub fn get_growth_rate(prev: Option<Decimal>, current: Option<Decimal>) -> Decimal {
    let (Some(prev), Some(current)) = (prev, current) else {
        return Decimal::ZERO;
    };
    if prev.is_zero() {
        return if current.is_zero() {
            Decimal::ZERO
        } else {
            Decimal::from(100)
        };
    }
    let ratio = (current - prev) / prev;
    let rounded = ratio.round_dp_with_strategy(
        GROWTH_RATE_SCALE,
        rust_decimal::RoundingStrategy::MidpointAwayFromZero,
    );
    rounded * Decimal::from(100)
}

/// 复刻 Java `TigUtils.toDecimalConvert(BigDecimal)`
/// = `setScale(2, HALF_UP)`；`null → ZERO`。
#[must_use]
pub fn to_decimal_convert(value: Decimal) -> Decimal {
    value.round_dp_with_strategy(
        PERCENT_SCALE,
        rust_decimal::RoundingStrategy::MidpointAwayFromZero,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dec(s: &str) -> Decimal {
        s.parse().expect("合法 Decimal 字面量")
    }

    /// 天/闰年判据。
    #[test]
    fn calendar_helpers() {
        assert!(is_leap(2024));
        assert!(is_leap(2000));
        assert!(!is_leap(1900));
        assert!(!is_leap(2023));
        assert_eq!(days_in_month(2024, 2), 29);
        assert_eq!(days_in_month(2023, 2), 28);
        assert_eq!(days_in_month(2024, 5), 31);
        assert_eq!(days_in_month(2024, 13), 0, "非法月份");
    }

    /// `days_from_civil` / `civil_from_days` 互逆且对齐 Unix epoch。
    #[test]
    fn civil_day_roundtrip() {
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(days_from_civil(1970, 1, 2), 1);
        assert_eq!(days_from_civil(1969, 12, 31), -1);
        assert_eq!(days_from_civil(2000, 3, 1), 11_017);
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(1), (1970, 1, 2));
        assert_eq!(civil_from_days(-1), (1969, 12, 31));
        assert_eq!(civil_from_days(11_017), (2000, 3, 1));
    }

    /// `format_ymd` 补零。
    #[test]
    fn format_ymd_pads() {
        assert_eq!(format_ymd(2024, 5, 6), "2024-05-06");
        assert_eq!(format_ymd(999, 12, 31), "0999-12-31");
    }

    /// `parse_ymd` 严格校验。
    #[test]
    fn parse_ymd_strict() {
        assert_eq!(parse_ymd("2024-02-29"), Some((2024, 2, 29)));
        assert_eq!(parse_ymd("2023-02-29"), None, "2023 非闰年");
        assert_eq!(parse_ymd("2024-13-01"), None);
        assert_eq!(parse_ymd("2024-00-01"), None);
        assert_eq!(parse_ymd("2024-05-06 10:00:00"), None, "必须恰好 10 字符");
        assert_eq!(parse_ymd_prefix("2024-05-06 10:00:00"), Some((2024, 5, 6)));
        assert_eq!(parse_ymd_prefix("2024-05-06"), Some((2024, 5, 6)));
        assert_eq!(parse_ymd_prefix("2024-05"), None);
    }

    /// `parse_datetime` / 秒级时间戳按 UTC+8 折算。
    #[test]
    fn datetime_secs_utc8() {
        // 1970-01-01 00:00:00 UTC+8 == -28800
        assert_eq!(date_start_secs("1970-01-01"), Some(-28_800));
        // 1970-01-01 08:00:00 UTC+8 == 0
        assert_eq!(datetime_secs_str("1970-01-01 08:00:00"), Some(0));
        assert_eq!(parse_flexible_secs("1970-01-01 08:00:00"), Some(0));
        assert_eq!(parse_flexible_secs("1970-01-01"), Some(-28_800));
        assert_eq!(
            parse_datetime("2024-05-06 10:30:00"),
            Some((2024, 5, 6, 10, 30, 0))
        );
        assert_eq!(parse_datetime("2024-05-06 24:00:00"), None);
        assert_eq!(datetime_secs_str("not-a-datetime"), None);
    }

    /// `shift_date` / `days_between`。
    #[test]
    fn date_arithmetic() {
        assert_eq!(days_between("2024-05-01", "2024-05-31"), Some(30));
        assert_eq!(shift_date("2024-05-01", -30).as_deref(), Some("2024-04-01"));
        assert_eq!(shift_date("2024-05-31", -30).as_deref(), Some("2024-05-01"));
        assert_eq!(shift_date("2024-03-01", -1).as_deref(), Some("2024-02-29"));
        assert_eq!(shift_date("2023-03-01", -1).as_deref(), Some("2023-02-28"));
        assert_eq!(shift_date("bad", 1), None);
    }

    /// `getPrevDate(.., 4)`：两端各自减「区间天数」，会与本期重叠。
    #[test]
    fn prev_date_matches_java() {
        assert_eq!(
            get_prev_date("2024-05-01", "2024-05-31"),
            Some(("2024-04-01".to_string(), "2024-05-01".to_string()))
        );
        assert_eq!(
            get_prev_date("2024-01-01", "2024-01-31"),
            Some(("2023-12-02".to_string(), "2024-01-01".to_string()))
        );
        // 单日区间：delta = 0 ⇒ 环比区间与本期完全相同
        assert_eq!(
            get_prev_date("2024-05-06", "2024-05-06"),
            Some(("2024-05-06".to_string(), "2024-05-06".to_string()))
        );
        assert_eq!(get_prev_date("2024/05/06", "2024-05-06"), None);
    }

    /// `getRangeDate` 的四个分支。
    #[test]
    fn range_date_branches() {
        // 年：yyyy → 追加 -01-01 再取当年范围
        assert_eq!(
            get_range_date(Some(1), Some("2024"), Some("2024")),
            Some(("2024-01-01".to_string(), "2024-12-31".to_string()))
        );
        // 月：yyyy-MM（闰年感知）
        assert_eq!(
            get_range_date(Some(2), Some("2024-02"), Some("2024-02")),
            Some(("2024-02-01".to_string(), "2024-02-29".to_string()))
        );
        assert_eq!(
            get_range_date(Some(2), Some("2023-02"), Some("2023-02")),
            Some(("2023-02-01".to_string(), "2023-02-28".to_string()))
        );
        // 月分支不使用 end
        assert_eq!(
            get_range_date(Some(2), Some("2024-05"), None),
            Some(("2024-05-01".to_string(), "2024-05-31".to_string()))
        );
        // 日：补时分秒
        assert_eq!(
            get_range_date(Some(3), Some("2024-05-06"), Some("2024-05-06")),
            Some((
                "2024-05-06 00:00:00".to_string(),
                "2024-05-06 23:59:59".to_string()
            ))
        );
        // 默认：原样（start 归一化）
        assert_eq!(
            get_range_date(Some(0), Some("2024-05-06"), Some("2024-05-07")),
            Some(("2024-05-06".to_string(), "2024-05-07".to_string()))
        );
        assert_eq!(
            get_range_date(None, Some("2024-05-06"), Some("2024-05-07")),
            Some(("2024-05-06".to_string(), "2024-05-07".to_string()))
        );
        // 日分支缺 end ⇒ None（Java 侧 NPE）
        assert_eq!(get_range_date(Some(3), Some("2024-05-06"), None), None);
    }

    /// `normalize_short_start` 的判据。
    #[test]
    fn normalize_short_start_by_shape() {
        assert_eq!(normalize_short_start("2024"), "2024-01-01");
        assert_eq!(normalize_short_start("2024-05"), "2024-05-01");
        assert_eq!(normalize_short_start("2024-05-06"), "2024-05-06");
        assert_eq!(normalize_short_start("abcd-ef"), "abcd-ef");
        assert_eq!(normalize_short_start("2024-5"), "2024-5");
    }

    /// `date_range_days` 含两端且升序；start > end 返回空。
    #[test]
    fn date_range_days_inclusive() {
        assert_eq!(
            date_range_days("2024-02-27", "2024-03-02"),
            Some(vec![
                "2024-02-27".to_string(),
                "2024-02-28".to_string(),
                "2024-02-29".to_string(),
                "2024-03-01".to_string(),
                "2024-03-02".to_string(),
            ])
        );
        assert_eq!(date_range_days("2024-05-02", "2024-05-01"), Some(vec![]));
        assert_eq!(date_range_days("x", "2024-05-01"), None);
    }

    /// `getGrowthRate` 的 Java 规则（含硬编码 100）。
    #[test]
    fn growth_rate_matches_java() {
        assert_eq!(get_growth_rate(None, Some(dec("10"))), Decimal::ZERO);
        assert_eq!(get_growth_rate(Some(dec("10")), None), Decimal::ZERO);
        assert_eq!(
            get_growth_rate(Some(dec("0")), Some(dec("0"))),
            Decimal::ZERO
        );
        assert_eq!(get_growth_rate(Some(dec("0")), Some(dec("5"))), dec("100"));
        assert_eq!(
            get_growth_rate(Some(dec("100")), Some(dec("120"))),
            dec("20.0000")
        );
        assert_eq!(
            get_growth_rate(Some(dec("100")), Some(dec("80"))),
            dec("-20.0000")
        );
        // (1-3)/3 = -0.666666… → scale4 HALF_UP → -0.6667 → ×100 = -66.6700
        assert_eq!(
            get_growth_rate(Some(dec("3")), Some(dec("1"))),
            dec("-66.6700")
        );
    }

    /// `toDecimalConvert` 保留 2 位并 HALF_UP。
    #[test]
    fn to_decimal_convert_half_up() {
        assert_eq!(to_decimal_convert(dec("1.005")), dec("1.01"));
        assert_eq!(to_decimal_convert(dec("1.004")), dec("1.00"));
        assert_eq!(to_decimal_convert(dec("33")), dec("33"));
        assert_eq!(to_decimal_convert(dec("-1.005")), dec("-1.01"));
    }

    /// 入参字段名必须与前端 camelCase 逐字符一致。
    #[test]
    fn access_query_wire_names() {
        let q: AccessStatisticsQuery =
            serde_json::from_str(r#"{"startTime":"2024-05-01","endTime":"2024-05-02","isHits":1}"#)
                .expect("应能解析");
        assert_eq!(q.start_time.as_deref(), Some("2024-05-01"));
        assert_eq!(q.end_time.as_deref(), Some("2024-05-02"));
        assert_eq!(q.is_hits, Some(1));
        assert_eq!(q.shop_id, None);
    }

    /// `UserTrendsQuery` 只有 `startEndTime` 一个日期字段。
    #[test]
    fn trends_query_wire_names() {
        let q: UserTrendsQuery =
            serde_json::from_str(r#"{"startEndTime":"2024","dateType":1,"isExport":"1"}"#)
                .expect("应能解析");
        assert_eq!(q.start_end_time.as_deref(), Some("2024"));
        assert_eq!(q.date_type, Some(1));
        // 原版前端把 isExport / dateType 传成字符串，宽松解析后应保留数值。
        assert_eq!(q.is_export, Some(1));

        let q2: UserTrendsQuery =
            serde_json::from_str(r#"{"startEndTime":"2024","dateType":"1"}"#).expect("应能解析");
        assert_eq!(q2.date_type, Some(1), "前端传字符串 dateType 时也应解析");
    }

    /// 排行 DTO 的分页字段是**平铺**的。
    #[test]
    fn ranking_dto_is_flattened() {
        let dto: UserConsumptionRankingDTO = serde_json::from_str(
            r#"{"page":2,"size":25,"startTime":"2024-05-01","endTime":"2024-05-31","keyword":"ab","sortField":"orderNum","sortOrder":"asc"}"#,
        )
        .expect("应能平铺解析");
        assert_eq!(dto.page, Some(2));
        assert_eq!(dto.size, Some(25));
        assert_eq!(dto.keyword.as_deref(), Some("ab"));
        assert_eq!(dto.sort_field.as_deref(), Some("orderNum"));
        assert_eq!(dto.sort_order.as_deref(), Some("asc"));
    }

    /// `AxisVO` 默认是空列表（Java `new ArrayList<>()`，不是 null）。
    #[test]
    fn axis_vo_default_is_empty_lists() {
        let vo = AxisVO::new();
        assert!(vo.is_empty());
        let json = serde_json::to_string(&vo).expect("可序列化");
        assert_eq!(json, r#"{"horizontalAxis":[],"longitudinalAxis":[]}"#);
    }

    /// `UserStatisticsPanelVO` 的 JSON 字段逐个 camelCase。
    #[test]
    fn panel_vo_field_names() {
        let vo = UserStatisticsPanelVO::default();
        let json = serde_json::to_string(&vo).expect("可序列化");
        for key in [
            "visitNum",
            "visitGrowthRate",
            "viewNum",
            "viewGrowthRate",
            "addUserNum",
            "addUserGrowthRate",
            "dealUserNum",
            "dealUserGrowthRate",
            "visitToUser",
            "visitToUserRate",
            "rechargeUserNum",
            "rechargeUserGrowthRate",
        ] {
            assert!(json.contains(key), "缺少字段 {key}: {json}");
        }
    }

    /// 金额字段必须是 `Decimal`（编译期护栏：改成 f64 会失败）。
    #[test]
    fn ranking_vo_amount_is_decimal() {
        let vo = UserConsumptionRankingVO {
            username: Some("u".into()),
            mobile: None,
            order_num: 3,
            order_amount: dec("12345.67"),
        };
        let json = serde_json::to_string(&vo).expect("可序列化");
        assert!(json.contains("12345.67"), "json={json}");
        assert_eq!(vo.order_amount.to_string(), "12345.67");
    }
}
