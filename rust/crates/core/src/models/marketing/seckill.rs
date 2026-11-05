//! 秒杀域 DTO/VO。
//! 对应原 Java `dto.promotion.Seckill*` 与 `vo.promotion.Seckill*`。
//!
//! JSON 字段名保持 camelCase 与原前端接口一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 秒杀活动分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SeckillListQuery {
    pub keyword: Option<String>,
    pub shop_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize")]
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}

/// 秒杀明细入参（创建/更新活动时一并提交）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SeckillItemDTO {
    /// 更新场景下已有明细的主键；新增时为空
    pub rec_id: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub product_id: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub sku_id: Option<i32>,
    pub seckill_price: Option<Decimal>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_stock: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_start_time: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_end_time: Option<i32>,
}

/// 创建秒杀活动请求。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SeckillCreateDTO {
    pub seckill_name: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_start_time: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_end_time: Option<i32>,
    /// 每人限购数量（0 或空表示不限）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub seckill_limit_num: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub product_id: Option<i32>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_i32"
    )]
    pub shop_id: Option<i32>,
    #[serde(default)]
    pub seckill_item: Vec<SeckillItemDTO>,
}

/// 更新秒杀活动请求（在创建字段基础上带 `seckillId`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SeckillUpdateDTO {
    pub seckill_id: i32,
    #[serde(flatten)]
    pub base: SeckillCreateDTO,
}

/// 秒杀活动 VO（管理端列表/详情）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeckillVO {
    pub seckill_id: i32,
    pub seckill_name: String,
    pub seckill_start_time: i32,
    pub seckill_end_time: i32,
    pub seckill_limit_num: i32,
    pub product_id: i32,
    pub shop_id: i32,
    /// 明细列表
    pub seckill_item: Vec<SeckillItemVO>,
    /// 派生状态：1 未开始 2 进行中 3 已结束
    pub status: i32,
    pub status_name: String,
}

/// 秒杀明细 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeckillItemVO {
    pub rec_id: i32,
    pub seckill_id: i32,
    pub product_id: i32,
    pub sku_id: i32,
    pub seckill_price: Decimal,
    pub seckill_stock: i32,
    pub seckill_sales: i32,
    pub seckill_start_time: i32,
    pub seckill_end_time: i32,
}

/// 前台秒杀商品列表项（秒杀专区/装修组件用）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeckillPromotionVO {
    pub rec_id: i32,
    pub seckill_id: i32,
    pub product_id: i32,
    pub sku_id: i32,
    /// 秒杀价
    pub seckill_price: Decimal,
    /// 剩余库存
    pub seckill_stock: i32,
    /// 已售数量
    pub seckill_sales: i32,
    pub seckill_start_time: i32,
    pub seckill_end_time: i32,
    /// 距开始/结束的剩余秒数（进行中为距结束，未开始为距开始）
    pub remain_seconds: i64,
    /// 是否已开始
    pub started: bool,
    /// 售罄进度百分比（0-100），用于前端进度条
    pub sold_percent: i32,
}

/// 秒杀活动派生状态（非库列）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeckillStatus {
    /// 未开始
    NotStarted = 1,
    /// 进行中
    Running = 2,
    /// 已结束
    Finished = 3,
}

impl SeckillStatus {
    pub fn name(self) -> &'static str {
        match self {
            Self::NotStarted => "未开始",
            Self::Running => "进行中",
            Self::Finished => "已结束",
        }
    }

    /// 按时间窗推导状态。
    pub fn of(now: i32, start: i32, end: i32) -> Self {
        if now < start {
            Self::NotStarted
        } else if now > end {
            Self::Finished
        } else {
            Self::Running
        }
    }
}

impl TryFrom<i32> for SeckillStatus {
    type Error = String;

    fn try_from(v: i32) -> std::result::Result<Self, Self::Error> {
        match v {
            1 => Ok(Self::NotStarted),
            2 => Ok(Self::Running),
            3 => Ok(Self::Finished),
            other => Err(format!("非法秒杀状态: {other}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_derivation() {
        // 未开始
        assert_eq!(SeckillStatus::of(100, 200, 300), SeckillStatus::NotStarted);
        // 进行中（边界：等于起止时间均算进行中）
        assert_eq!(SeckillStatus::of(200, 200, 300), SeckillStatus::Running);
        assert_eq!(SeckillStatus::of(300, 200, 300), SeckillStatus::Running);
        // 已结束
        assert_eq!(SeckillStatus::of(301, 200, 300), SeckillStatus::Finished);
    }

    #[test]
    fn status_names() {
        assert_eq!(SeckillStatus::Running.name(), "进行中");
        assert_eq!(SeckillStatus::try_from(3).unwrap().name(), "已结束");
        assert!(SeckillStatus::try_from(9).is_err());
    }

    #[test]
    fn create_dto_parses_camel_case() {
        let d: SeckillCreateDTO = serde_json::from_str(
            r#"{"seckillName":"618秒杀","seckillStartTime":100,"seckillEndTime":200,
                "seckillItem":[{"productId":9,"skuId":3,"seckillPrice":"9.90","seckillStock":50}]}"#,
        )
        .unwrap();
        assert_eq!(d.seckill_name.as_deref(), Some("618秒杀"));
        assert_eq!(d.seckill_item.len(), 1);
        assert_eq!(d.seckill_item[0].sku_id, Some(3));
        assert_eq!(d.seckill_item[0].seckill_stock, Some(50));
    }

    #[test]
    fn list_query_is_default_tolerant() {
        let q: SeckillListQuery = serde_json::from_str("{}").unwrap();
        assert!(q.page.is_none() && q.keyword.is_none());
    }

    #[test]
    fn update_dto_flattens_base() {
        let d: SeckillUpdateDTO =
            serde_json::from_str(r#"{"seckillId":7,"seckillName":"改后名称","shopId":2}"#).unwrap();
        assert_eq!(d.seckill_id, 7);
        assert_eq!(d.base.seckill_name.as_deref(), Some("改后名称"));
        assert_eq!(d.base.shop_id, Some(2));
    }

    #[test]
    fn promotion_vo_serializes_camel_case() {
        let vo = SeckillPromotionVO {
            rec_id: 1,
            seckill_id: 2,
            product_id: 3,
            sku_id: 4,
            seckill_price: Decimal::from(9),
            seckill_stock: 5,
            seckill_sales: 5,
            remain_seconds: 60,
            started: true,
            sold_percent: 50,
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["seckillId"], 2);
        assert_eq!(v["remainSeconds"], 60);
        assert_eq!(v["soldPercent"], 50);
    }
}
