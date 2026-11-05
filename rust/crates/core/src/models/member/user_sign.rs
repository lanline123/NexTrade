//! 用户签到域（member::user_sign）DTO / VO / 纯函数。
//! Java `UserSignController`（`/api/user/sign/index|sign`，需登录）。
//! 表 `sign` / `sign_in_setting` / `user` / `product`。

use serde::{Deserialize, Serialize};

pub const SERVICE_DATA_ERROR: i32 = 1001;
/// 今日已签到。
pub const ALREADY_SIGNED: &str = "今天已经签到过了";
/// 签到失败。
pub const SIGN_FAILED: &str = "签到失败";

/// 签到配置项（Java `SignInSetting`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SignInSettingVO {
    pub id: i32,
    pub name: Option<String>,
    pub points: Option<i32>,
    pub day_num: Option<i32>,
    pub sort_order: i32,
    pub create_time: i64,
}

/// 推荐商品（Java `ProductInfoVo` 子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RecommendProductVO {
    pub product_id: i32,
    pub product_name: String,
    pub pic_thumb: String,
    pub product_price: String,
}

/// 签到首页（Java `UserSignInfoVo`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserSignInfoVO {
    pub days: Vec<SignInSettingVO>,
    pub record: i32,
    pub is_sign: i32,
    pub sign_points: i32,
    pub recommend_goods: Vec<RecommendProductVO>,
}

/// 下次签到次数（Java `signNum = preNum + 1`，超过配置总数回 1）。
#[must_use]
pub fn next_sign_num(record: i32, total_days: i32) -> i32 {
    let next = if record < 0 { 1 } else { record + 1 };
    if total_days > 0 && next > total_days {
        1
    } else {
        next
    }
}

/// 今日签到可获积分（Java `getSignPoints`：按 `dayNum` 精确匹配第 N 天配置；已签到→0）。
#[must_use]
pub fn sign_points(days: &[SignInSettingVO], sign_num: i32, is_sign: i32) -> i32 {
    if is_sign == 1 {
        return 0;
    }
    days.iter()
        .find(|d| d.day_num == Some(sign_num))
        .and_then(|d| d.points)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn next_sign_num_wraps() {
        assert_eq!(next_sign_num(0, 7), 1);
        assert_eq!(next_sign_num(3, 7), 4);
        assert_eq!(next_sign_num(7, 7), 1);
        assert_eq!(next_sign_num(2, 0), 3);
    }

    #[test]
    fn sign_points_matches_day_num() {
        let days = vec![
            SignInSettingVO {
                id: 1,
                day_num: Some(1),
                points: Some(5),
                ..Default::default()
            },
            SignInSettingVO {
                id: 2,
                day_num: Some(2),
                points: Some(10),
                ..Default::default()
            },
        ];
        assert_eq!(sign_points(&days, 1, 0), 5);
        assert_eq!(sign_points(&days, 2, 0), 10);
        assert_eq!(sign_points(&days, 3, 0), 0);
        // 已签到 → 0
        assert_eq!(sign_points(&days, 1, 1), 0);
    }

    #[test]
    fn messages_and_vo_serde() {
        assert_eq!(ALREADY_SIGNED, "今天已经签到过了");
        assert_eq!(SIGN_FAILED, "签到失败");
        let vo = UserSignInfoVO {
            record: 2,
            is_sign: 0,
            sign_points: 5,
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["isSign"], 0);
        assert_eq!(v["signPoints"], 5);
    }
}
