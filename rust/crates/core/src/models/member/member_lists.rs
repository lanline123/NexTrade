//! 会员域 DTO/VO。对应 `com.tigshop.bean.dto.user.*` 与 `vo.user.*`。
//!
//! TODO(域实现者)：对照 Java 源补全字段，JSON 字段名保持 camelCase 与原接口一致。

use serde::{Deserialize, Serialize};

/// 会员等级 VO。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRankVO {
    pub rank_id: i32,
    pub rank_name: Option<String>,
    pub upgrade_amount: Option<rust_decimal::Decimal>,
    pub discount: Option<i32>,
}

/// 积分流水分页查询。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserPointsLogQuery {
    pub user_id: Option<i32>,
    pub page: Option<u64>,
    #[serde(alias = "size")]
    pub page_size: Option<u64>,
}
