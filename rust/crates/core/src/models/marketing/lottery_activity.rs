//! 抽奖活动域（marketing::lottery_activity）DTO / Query / VO / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.promotion.LotteryActivity` / `LotteryPrize` /
//!   `LotteryRecord` / `LotteryUserStat`
//! - `LotteryActivityParam` / `LotteryActivityIdParam` / `GridPositionParam` /
//!   `LotteryPrizeItemParam`
//! - `LotteryActivityQuery` / `LotteryUserManageQuery` / `LotteryUserRecordQuery`
//! - `LotteryActivityListVO` / `LotteryActivityVO` / `LotteryUserManageVO` /
//!   `LotteryUserRecordVO` / `LotteryPrizeVO` / `GridPositionVO`
//!
//! 实体已由 schema 生成（`tigshop_core::entities::{LotteryActivity, LotteryPrize,
//! LotteryRecord, LotteryUserStat, Promotion}`）。
//!
//! # 关键语义 / 偏差
//!
//! - 活动状态由**时间计算**（0 未开始 / 1 进行中 / 2 已结束），不是库中列。
//! - 九宫格 8 个位置，`tempIndex` 仅在创建/编辑时用于把新奖品关联到位置；
//!   校验顺序与 Java `validateActivityBasicParam` → `convertAndValidateGridConfig`
//!   一致，文案逐字。
//! - `startTime` / `endTime` 入参是 `yyyy-MM-dd HH:mm:ss` 字符串，出参为同样
//!   格式的字符串（Java `@JsonSerialize TimestampToDate`）。
//! - 列表的 `createTime/startTime/endTime` 在 Java 里是 `String.valueOf(时间戳)`
//!   （VO 字段为 String + 序列化器，实际输出格式化值）；本实现**直接格式化**，
//!   与前端展示一致（见模块内偏差说明）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 奖品类型：积分
pub const PRIZE_TYPE_POINTS: i32 = 1;
/// 奖品类型：商品
pub const PRIZE_TYPE_PRODUCT: i32 = 2;
/// 奖品类型：优惠券
pub const PRIZE_TYPE_COUPON: i32 = 3;
/// Promotion 表活动类型：抽奖活动（Java `PromotionType.TYPE_LOTTERY` = 8）。
pub const PROMOTION_TYPE_LOTTERY: i32 = 8;

/// 活动不存在
pub const MSG_ACTIVITY_NOT_EXISTS: &str = "活动不存在";
/// 活动 ID 不能为空
pub const MSG_ACTIVITY_ID_REQUIRED: &str = "活动ID不能为空";
/// 时间冲突
pub const MSG_TIME_CONFLICT: &str = "活动时间与其他活动冲突，每个时段只能有一个抽奖活动";
/// 必须 8 个位置
pub const MSG_GRID_SIZE: &str = "必须配置8个九宫格位置";
/// 位置重复
pub const MSG_GRID_DUPLICATE: &str = "九宫格位置不能重复";
/// 有奖品的位置概率必须大于 0
pub const MSG_PRIZE_PROBABILITY_POSITIVE: &str = "有奖品的位置概率必须大于0";
/// 单个奖品概率不能超过 100%
pub const MSG_PRIZE_PROBABILITY_MAX: &str = "单个奖品概率不能超过100%";
/// 至少配置一个奖品位置
pub const MSG_GRID_NEED_PRIZE: &str = "九宫格至少需要配置一个奖品位置";
/// 概率总和必须小于 100%
pub const MSG_TOTAL_PROBABILITY: &str = "奖品概率总和必须小于100%，剩余概率为未中奖概率";
/// 活动进行中不能删除
pub const MSG_ACTIVITY_RUNNING_CANNOT_DELETE: &str = "活动进行中，不能删除。请先结束活动";
/// 活动未开始不能结束
pub const MSG_ACTIVITY_NOT_STARTED: &str = "活动未开始，不能结束";
/// 活动已结束
pub const MSG_ACTIVITY_ALREADY_ENDED: &str = "活动已结束";
/// 结束时间必须大于开始时间
pub const MSG_TIME_ORDER: &str = "活动结束时间必须大于开始时间";
/// 参与条件参数错误
pub const MSG_COST_TYPE_INVALID: &str = "抽奖参与条件参数错误";
/// 消耗积分必须大于 0
pub const MSG_COST_POINTS_INVALID: &str = "消耗积分必须大于0";
/// 未中奖名称不能为空
pub const MSG_NO_WIN_NAME_REQUIRED: &str = "未中奖名称不能为空";
/// 未中奖图片不能为空
pub const MSG_NO_WIN_IMAGE_REQUIRED: &str = "未中奖图片不能为空";
/// 未中奖图片 URL 格式不正确
pub const MSG_NO_WIN_IMAGE_URL: &str = "未中奖图片URL格式不正确";
/// 奖品列表不能为空
pub const MSG_PRIZE_LIST_REQUIRED: &str = "奖品列表不能为空";
/// 奖品数量不能超过 7 个
pub const MSG_PRIZE_LIST_TOO_MANY: &str = "奖品数量不能超过7个";
/// 关联 Promotion 表失败
pub const MSG_PROMOTION_SAVE_FAILED: &str = "关联Promotion表失败";
/// 时间格式错误（Java `TigUtils.toTimestampYmdHms` 解析失败）。
pub const MSG_TIME_FORMAT_INVALID: &str = "时间格式错误";

/// 活动状态（Java `calculateActivityStatus`）：0 未开始 / 1 进行中 / 2 已结束。
#[must_use]
pub fn activity_status(now: i64, start_time: i32, end_time: i32) -> i32 {
    if now < i64::from(start_time) {
        0
    } else if now <= i64::from(end_time) {
        1
    } else {
        2
    }
}

/// 活动状态文案（Java `getStatusText`）。
#[must_use]
pub fn status_text(status: i32) -> &'static str {
    match status {
        0 => "未开始",
        1 => "进行中",
        2 => "已结束",
        _ => "未知",
    }
}

/// `yyyy-MM-dd HH:mm:ss` → 秒级时间戳（UTC+8），失败 →「时间格式错误」。
pub fn parse_datetime(raw: &str) -> Result<i32, String> {
    use chrono::NaiveDateTime;
    let naive = NaiveDateTime::parse_from_str(raw.trim(), "%Y-%m-%d %H:%M:%S")
        .map_err(|_| MSG_TIME_FORMAT_INVALID.to_string())?;
    i32::try_from(naive.and_utc().timestamp() - 8 * 3600)
        .map_err(|_| MSG_TIME_FORMAT_INVALID.to_string())
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），0 ⇒ `""`。
#[must_use]
pub fn format_datetime(secs: i32) -> String {
    if secs == 0 {
        return String::new();
    }
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 九宫格「位置 → 奖品」参数（Java `GridPositionParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GridPositionParam {
    pub position: Option<i32>,
    /// 关联已有奖品
    pub prize_id: Option<i32>,
    /// 关联新增奖品（与 prizeList.tempIndex 对应）
    pub temp_index: Option<i32>,
    pub probability: Option<Decimal>,
}

/// 奖品入参（Java `LotteryPrizeItemParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryPrizeItemParam {
    pub temp_index: Option<i32>,
    pub prize_id: Option<i32>,
    pub prize_name: Option<String>,
    pub prize_type: Option<i32>,
    pub prize_value: Option<String>,
    pub prize_image: Option<String>,
    pub prize_stock: Option<i32>,
}

/// 活动保存参数（Java `LotteryActivityParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryActivityParam {
    pub activity_id: Option<i32>,
    pub activity_name: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub start_time: Option<String>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub end_time: Option<String>,
    pub cost_type: Option<i32>,
    pub cost_points: Option<i32>,
    pub daily_limit: Option<i32>,
    pub total_limit: Option<i32>,
    pub win_limit: Option<i32>,
    /// 装修配置（原样 JSON 透传）
    pub decorate_config: Option<serde_json::Value>,
    pub prize_list: Option<Vec<LotteryPrizeItemParam>>,
    pub grid_config: Option<Vec<GridPositionParam>>,
    pub no_win_name: Option<String>,
    pub no_win_image: Option<String>,
    pub no_win_tips: Option<String>,
    pub prize_entry_image: Option<String>,
}

impl LotteryActivityParam {
    /// 基础参数校验（Java `validateActivityBasicParam`，文案逐字）。
    ///
    /// 时间先后 / 参与条件 / 积分 / 九宫格结构 / 未中奖配置 / 奖品数量。
    pub fn validate_basic(&self, start_time: i32, end_time: i32) -> Result<(), String> {
        if end_time <= start_time {
            return Err(MSG_TIME_ORDER.to_string());
        }
        let cost_type = self.cost_type.unwrap_or(1);
        if cost_type != 0 && cost_type != 1 {
            return Err(MSG_COST_TYPE_INVALID.to_string());
        }
        if cost_type == 1 && self.cost_points.unwrap_or(0) <= 0 {
            return Err(MSG_COST_POINTS_INVALID.to_string());
        }
        validate_grid_shape(self.grid_config.as_deref())?;
        if self
            .no_win_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_none()
        {
            return Err(MSG_NO_WIN_NAME_REQUIRED.to_string());
        }
        let no_win_image = self.no_win_image.as_deref().unwrap_or("");
        if no_win_image.trim().is_empty() {
            return Err(MSG_NO_WIN_IMAGE_REQUIRED.to_string());
        }
        if !no_win_image.starts_with("http") {
            return Err(MSG_NO_WIN_IMAGE_URL.to_string());
        }
        validate_grid_prizes(self.grid_config.as_deref())?;
        let prizes = self.prize_list.as_deref().unwrap_or_default();
        if prizes.is_empty() {
            return Err(MSG_PRIZE_LIST_REQUIRED.to_string());
        }
        if prizes.len() > 7 {
            return Err(MSG_PRIZE_LIST_TOO_MANY.to_string());
        }
        Ok(())
    }
}

/// 九宫格结构校验（8 个位置 + 位置唯一 + 至少一个奖品位置 + 概率区间）。
pub fn validate_grid_shape(grid: Option<&[GridPositionParam]>) -> Result<(), String> {
    let Some(grid) = grid else {
        return Err(MSG_GRID_SIZE.to_string());
    };
    if grid.len() != 8 {
        return Err(MSG_GRID_SIZE.to_string());
    }
    let mut positions: Vec<i32> = Vec::new();
    for g in grid {
        positions.push(g.position.unwrap_or(-1));
    }
    positions.sort_unstable();
    positions.dedup();
    if positions.len() != 8 {
        return Err(MSG_GRID_DUPLICATE.to_string());
    }
    Ok(())
}

/// 九宫格奖品/概率校验（Java 校验顺序：8 格与位置唯一 → 未中奖文案 → 奖品/概率）。
pub fn validate_grid_prizes(grid: Option<&[GridPositionParam]>) -> Result<(), String> {
    let Some(grid) = grid else {
        return Err(MSG_GRID_SIZE.to_string());
    };
    let mut prize_count = 0;
    let mut total = Decimal::ZERO;
    let hundred = Decimal::from(100);
    for g in grid {
        // 有奖位置：使用 prizeId 或 tempIndex 之一（tempIndex 由服务层映射）
        let has_prize = g.prize_id.is_some() || g.temp_index.is_some();
        if !has_prize {
            continue;
        }
        prize_count += 1;
        let probability = g.probability.unwrap_or_default();
        if probability <= Decimal::ZERO {
            return Err(MSG_PRIZE_PROBABILITY_POSITIVE.to_string());
        }
        if probability > hundred {
            return Err(MSG_PRIZE_PROBABILITY_MAX.to_string());
        }
        total += probability;
    }
    if prize_count == 0 {
        return Err(MSG_GRID_NEED_PRIZE.to_string());
    }
    if total >= hundred {
        return Err(MSG_TOTAL_PROBABILITY.to_string());
    }
    Ok(())
}

/// 奖品 VO（Java `LotteryPrizeVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotteryPrizeVO {
    pub prize_id: i32,
    pub activity_id: i32,
    pub prize_name: String,
    pub prize_type: i32,
    pub prize_type_text: String,
    pub prize_value: String,
    pub prize_image: String,
    pub prize_stock: i32,
    pub prize_stock_used: i32,
    pub remain_stock: i32,
    pub create_time: String,
}

/// 九宫格位置 VO（Java `GridPositionVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GridPositionVO {
    pub position: i32,
    pub prize_id: Option<i32>,
    pub probability: Option<Decimal>,
    pub prize_name: Option<String>,
    pub prize_image: Option<String>,
    pub prize_type: Option<i32>,
    pub prize_value: Option<String>,
}

/// 活动列表查询（Java `LotteryActivityQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryActivityListQuery {
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub keyword: Option<String>,
    pub activity_name: Option<String>,
    pub status: Option<i32>,
}

impl LotteryActivityListQuery {
    /// `(LIMIT, OFFSET)`（Java `BasePage`）。
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
}

/// 活动列表 VO（Java `LotteryActivityListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotteryActivityListVO {
    pub activity_id: i32,
    pub activity_name: String,
    pub status: i32,
    pub status_text: String,
    pub participant_count: i32,
    pub create_time: String,
    pub start_time: String,
    pub end_time: String,
    pub can_edit: bool,
    pub can_delete: bool,
}

/// 活动详情 VO（Java `LotteryActivityVO`；装修配置原样 JSON）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotteryActivityVO {
    pub activity_id: i32,
    pub activity_name: String,
    pub start_time: String,
    pub end_time: String,
    pub cost_type: i32,
    pub cost_points: i32,
    pub daily_limit: i32,
    pub total_limit: i32,
    pub win_limit: i32,
    pub status: i32,
    pub status_text: String,
    pub decorate_config: Option<serde_json::Value>,
    pub prize_list: Vec<LotteryPrizeVO>,
    pub grid_config: Vec<GridPositionVO>,
    pub no_win_name: String,
    pub no_win_image: String,
    pub no_win_tips: String,
    pub prize_entry_image: String,
    pub participant_count: i32,
    pub win_count: i32,
}

/// 活动 ID 参数（Java `LotteryActivityIdParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryActivityIdParam {
    pub activity_id: Option<i32>,
}

/// 用户管理查询（Java `LotteryUserManageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryUserManageQuery {
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub activity_id: Option<i32>,
    pub user_name: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

impl LotteryUserManageQuery {
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
}

/// 用户中奖查询（Java `LotteryUserRecordQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LotteryUserRecordQuery {
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub activity_id: Option<i32>,
    pub user_id: Option<i32>,
}

impl LotteryUserRecordQuery {
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
}

/// 用户管理 VO（Java `LotteryUserManageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotteryUserManageVO {
    pub user_id: i32,
    pub user_name: String,
    pub avatar: Option<String>,
    pub from_tag_name: String,
    pub total_count: i32,
    pub last_lottery_time: Option<String>,
}

/// 用户中奖记录 VO（Java `LotteryUserRecordVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LotteryUserRecordVO {
    pub record_id: i32,
    pub user_name: String,
    pub avatar: Option<String>,
    pub from_tag_name: String,
    pub create_time: Option<String>,
    pub prize_name: String,
    pub status_text: String,
}

/// 奖品展示名（Java `getPrizeDisplayName`）。
#[must_use]
pub fn prize_display_name(
    is_win: i32,
    prize_type: Option<i32>,
    prize_value: &str,
    prize_name: &str,
) -> String {
    if is_win == 0 || prize_type.is_none() || prize_type == Some(0) {
        return "未中奖".to_string();
    }
    match prize_type {
        Some(PRIZE_TYPE_POINTS) => format!("积分 x {prize_value}"),
        Some(PRIZE_TYPE_PRODUCT | PRIZE_TYPE_COUPON) => prize_name.to_string(),
        _ => prize_name.to_string(),
    }
}

/// 奖品状态文案（Java `getPrizeStatusText`）。
#[must_use]
pub fn prize_status_text(is_win: i32, prize_type: Option<i32>, status: i32) -> String {
    if is_win == 0 || prize_type.is_none() || prize_type == Some(0) {
        return "-".to_string();
    }
    match prize_type {
        Some(PRIZE_TYPE_POINTS | PRIZE_TYPE_COUPON) => if status == 1 {
            "已发放"
        } else {
            "未发放"
        }
        .to_string(),
        Some(PRIZE_TYPE_PRODUCT) => if status == 1 {
            "已兑换"
        } else {
            "未兑换"
        }
        .to_string(),
        _ => "-".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_by_time_and_text() {
        assert_eq!(activity_status(100, 200, 300), 0);
        assert_eq!(activity_status(250, 200, 300), 1);
        assert_eq!(activity_status(300, 200, 300), 1);
        assert_eq!(activity_status(301, 200, 300), 2);
        assert_eq!(status_text(0), "未开始");
        assert_eq!(status_text(1), "进行中");
        assert_eq!(status_text(2), "已结束");
        assert_eq!(status_text(9), "未知");
    }

    #[test]
    fn datetime_parse_and_format_roundtrip() {
        let ts = parse_datetime("2024-12-01 00:00:00").unwrap();
        assert_eq!(format_datetime(ts), "2024-12-01 00:00:00");
        assert_eq!(parse_datetime("bad").unwrap_err(), "时间格式错误");
        assert_eq!(format_datetime(0), "");
    }

    #[test]
    fn grid_validation_texts_are_verbatim() {
        assert_eq!(
            validate_grid_shape(None).unwrap_err(),
            "必须配置8个九宫格位置"
        );
        let one = [GridPositionParam::default()];
        assert_eq!(
            validate_grid_shape(Some(&one)).unwrap_err(),
            "必须配置8个九宫格位置"
        );
        let mut grid: Vec<GridPositionParam> = (0..8)
            .map(|i| GridPositionParam {
                position: Some(0),
                ..Default::default()
            })
            .collect();
        assert_eq!(
            validate_grid_shape(Some(&grid)).unwrap_err(),
            "九宫格位置不能重复"
        );
        for (i, item) in grid.iter_mut().enumerate() {
            item.position = Some(i32::try_from(i).unwrap());
            item.prize_id = None;
            item.probability = None;
        }
        assert_eq!(
            validate_grid_prizes(Some(&grid)).unwrap_err(),
            "九宫格至少需要配置一个奖品位置"
        );
        grid[0].prize_id = Some(1);
        grid[0].probability = Some(Decimal::ZERO);
        assert_eq!(
            validate_grid_prizes(Some(&grid)).unwrap_err(),
            "有奖品的位置概率必须大于0"
        );
        grid[0].probability = Some(Decimal::from(101));
        assert_eq!(
            validate_grid_prizes(Some(&grid)).unwrap_err(),
            "单个奖品概率不能超过100%"
        );
        grid[0].probability = Some(Decimal::from(100));
        assert_eq!(
            validate_grid_prizes(Some(&grid)).unwrap_err(),
            "奖品概率总和必须小于100%，剩余概率为未中奖概率"
        );
        grid[0].probability = Some(Decimal::new(5000, 2));
        assert!(validate_grid_prizes(Some(&grid)).is_ok());
    }

    #[test]
    fn basic_param_validation_messages() {
        let mut p = LotteryActivityParam::default();
        assert_eq!(
            p.validate_basic(300, 200).unwrap_err(),
            "活动结束时间必须大于开始时间"
        );
        p.start_time = Some("2024-12-01 00:00:00".into());
        p.cost_type = Some(2);
        assert_eq!(
            p.validate_basic(100, 200).unwrap_err(),
            "抽奖参与条件参数错误"
        );
        p.cost_type = Some(1);
        assert_eq!(p.validate_basic(100, 200).unwrap_err(), "消耗积分必须大于0");
        p.cost_points = Some(10);
        assert_eq!(
            p.validate_basic(100, 200).unwrap_err(),
            "必须配置8个九宫格位置"
        );
        p.grid_config = Some(
            (0..8)
                .map(|i| GridPositionParam {
                    position: Some(i),
                    ..Default::default()
                })
                .collect(),
        );
        assert_eq!(
            p.validate_basic(100, 200).unwrap_err(),
            "未中奖名称不能为空"
        );
    }

    #[test]
    fn prize_display_and_status_texts() {
        assert_eq!(prize_display_name(0, Some(1), "10", "x"), "未中奖");
        assert_eq!(prize_display_name(1, Some(1), "10", "x"), "积分 x 10");
        assert_eq!(prize_display_name(1, Some(2), "10", "商品A"), "商品A");
        assert_eq!(prize_status_text(1, Some(1), 0), "未发放");
        assert_eq!(prize_status_text(1, Some(2), 1), "已兑换");
        assert_eq!(prize_status_text(0, Some(2), 1), "-");
    }
}
