//! 优惠券 DTO/VO。
//! 对应 `com.tigshop.bean.query.promotion.coupon.CouponPageQuery`、
//! `com.tigshop.bean.vo.promotion.CouponVO` / `CouponClientVO`、
//! `com.tigshop.bean.param.user.UserCouponClaimParam`。
//!
//! JSON 字段名保持 camelCase，与原前端接口一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 用户优惠券派生状态（非数据库列，由起止时间与使用情况推导）。
/// 对应原 Java `UserCouponStatus` 枚举。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserCouponStatus {
    /// 即将过期
    ExpiringSoon = 1,
    /// 正常
    Normal = 2,
    /// 未开始
    NotStarted = 3,
    /// 已使用
    Used = 4,
    /// 已过期
    Expired = 5,
}

impl UserCouponStatus {
    /// 状态中文名（与前端展示一致）。
    pub fn name(self) -> &'static str {
        match self {
            Self::ExpiringSoon => "即将过期",
            Self::Normal => "正常",
            Self::NotStarted => "未开始",
            Self::Used => "已使用",
            Self::Expired => "已过期",
        }
    }
}

impl TryFrom<i32> for UserCouponStatus {
    type Error = String;

    fn try_from(v: i32) -> Result<Self, Self::Error> {
        match v {
            1 => Ok(Self::ExpiringSoon),
            2 => Ok(Self::Normal),
            3 => Ok(Self::NotStarted),
            4 => Ok(Self::Used),
            5 => Ok(Self::Expired),
            other => Err(format!("非法用户优惠券状态: {other}")),
        }
    }
}

impl From<UserCouponStatus> for i32 {
    fn from(s: UserCouponStatus) -> Self {
        s as i32
    }
}

/// 优惠券分页查询参数。
/// 同时服务管理端 `CouponController#list` 与前台 `UserCouponController#getList`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CouponListQuery {
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
    /// 店铺ID，-1 表示不限
    pub shop_id: Option<i32>,
    /// 是否展示（前台固定传 1）
    pub is_show: Option<i32>,
    /// 有效期过滤：1 启用 -1 不限
    pub valid_date: Option<i32>,
    /// 领取时间过滤
    pub receive_date: Option<i32>,
    /// 是否按可领取过滤：1 启用
    pub receive_flag: Option<i32>,
    /// 状态筛选：1 进行中 2 待生效 3 已失效
    pub status: Option<i32>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 领取优惠券请求（对应 `UserCouponClaimParam`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCouponClaimDTO {
    pub coupon_id: i32,
    /// 管理端代领时可指定；前台由登录态覆盖。
    pub user_id: Option<i32>,
}

/// 删除用户优惠券请求（对应 `UserCouponIdParam`）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCouponIdDTO {
    pub id: i32,
}

/// 我的优惠券列表查询（对应 `UserCouponListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCouponListQuery {
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
    /// 使用时间过滤
    pub used_time: Option<i64>,
    /// 管理端可指定用户
    pub user_id: Option<i32>,
}

/// 优惠券 VO（管理端列表/详情，对应 `CouponVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CouponVO {
    pub coupon_id: i32,
    pub coupon_name: String,
    pub coupon_money: Decimal,
    pub coupon_discount: Decimal,
    pub coupon_desc: String,
    pub coupon_type: i32,
    pub send_range: i32,
    pub send_range_data: Vec<i32>,
    pub min_order_amount: Decimal,
    pub send_type: i32,
    pub use_day: i32,
    pub use_start_date: i32,
    pub use_end_date: i32,
    pub is_show: i32,
    pub is_global: i32,
    pub is_new_user: i32,
    pub enabled_click_get: i32,
    pub limit_user_rank: Vec<i32>,
    pub shop_id: i32,
    pub is_delete: i32,
    pub limit_num: i32,
    pub delay_day: i32,
    pub send_num: i32,
    pub max_order_amount: Decimal,
    pub coupon_unit: i32,
    pub reduce_type: i32,
    pub add_time: i32,
    /// 已领取数量
    pub receive_num: i64,
    /// 派生状态：1 进行中 2 待生效 3 已失效
    pub status: i32,
    pub status_name: String,
}

/// 前台可领取优惠券 VO（对应 `CouponClientVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CouponClientVO {
    pub coupon_id: i32,
    pub coupon_name: String,
    pub coupon_money: Decimal,
    pub coupon_discount: Decimal,
    pub coupon_desc: String,
    pub coupon_type: i32,
    pub send_range: i32,
    pub send_range_data: Vec<i32>,
    pub min_order_amount: Decimal,
    pub send_type: i32,
    pub use_day: i32,
    pub use_start_date: i32,
    pub use_end_date: i32,
    pub is_show: i32,
    pub is_global: i32,
    pub is_new_user: i32,
    pub enabled_click_get: i32,
    pub limit_user_rank: Vec<i32>,
    pub shop_id: i32,
    pub limit_num: i32,
    pub delay_day: i32,
    pub send_num: i32,
    pub max_order_amount: Decimal,
    pub coupon_unit: i32,
    pub reduce_type: i32,
    pub add_time: i32,
    /// 当前用户是否已领取
    pub is_receive: i32,
    /// 已领取数量
    pub receive_num: i64,
}

/// 我的优惠券 VO（对应 `UserCouponVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCouponVO {
    pub id: i32,
    pub coupon_id: i32,
    pub coupon_sn: String,
    pub coupon_name: String,
    pub coupon_money: Decimal,
    pub coupon_discount: Decimal,
    pub coupon_desc: String,
    pub coupon_type: i32,
    pub min_order_amount: Decimal,
    pub send_range: i32,
    pub send_range_data: Vec<i32>,
    pub start_date: i32,
    pub end_date: i32,
    pub used_time: i32,
    pub order_id: i32,
    /// 派生状态：1 即将过期 2 正常 3 未开始 4 已使用 5 已过期
    pub status: i32,
    pub status_name: String,
}

impl UserCouponVO {
    /// 由用户券派生状态并填充状态名。
    pub fn with_status(mut self, status: i32) -> Self {
        self.status = status;
        self.status_name = UserCouponStatus::try_from(status)
            .map(|s| s.name().to_string())
            .unwrap_or_default();
        self
    }
}

/// 管理端各状态优惠券数量统计（对应 `CouponStatusCountVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CouponStatusCountVO {
    pub processing: i64,
    pub pending: i64,
    pub expired: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn query_accepts_camel_case_and_snake_case_paging() {
        let q: CouponListQuery =
            serde_json::from_str(r#"{"page":2,"pageSize":15,"isShow":1}"#).unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(15));
        assert_eq!(q.is_show, Some(1));
    }

    #[test]
    fn query_is_default_tolerant() {
        let q: CouponListQuery = serde_json::from_str("{}").unwrap();
        assert!(q.page.is_none() && q.keyword.is_none());
    }

    #[test]
    fn claim_dto_parses_camel_case() {
        let d: UserCouponClaimDTO = serde_json::from_str(r#"{"couponId":9}"#).unwrap();
        assert_eq!(d.coupon_id, 9);
        assert!(d.user_id.is_none());
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = CouponVO {
            coupon_id: 3,
            coupon_name: "满减券".into(),
            status: 1,
            status_name: "进行中".into(),
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["couponId"], 3);
        assert_eq!(v["statusName"], "进行中");
    }

    #[test]
    fn user_coupon_vo_status_name() {
        let vo = UserCouponVO::default().with_status(UserCouponStatus::Used as i32);
        assert_eq!(vo.status_name, "已使用");
        assert_eq!(vo.status, 4);
    }
}
