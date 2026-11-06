//! 微信直播订单同步域（content::wechat_live_order_sync）DTO / 纯函数。
//!
//! 对应原 Java `WechatLiveOrderSyncController` 的 3 个端点：
//! `GET /adminapi/content/wechatLiveOrderSync/logs`、`POST .../retry/{logId}`、
//! `POST .../reconcile`。
//!
//! 同步日志/重试/对账均依赖微信「视频号小店」订单接口与同步任务，未迁移 →
//! 保留端点与本地校验，统一返回明确「未迁移」业务错误，不编造同步记录。

use serde::{Deserialize, Serialize};

/// `id不能为空`
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 微信直播订单同步未迁移。
pub const MSG_NOT_MIGRATED: &str =
    "微信直播订单同步依赖微信「视频号小店」订单接口与同步任务，当前 Rust 侧尚未迁移，本接口暂不可用";

/// 日志分页查询（Java `WechatLiveOrderSyncLogQuery` 子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SyncLogQuery {
    pub status: Option<i32>,
    pub order_sn: Option<String>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// 对账入参（Java `ReconcileParam` 子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReconcileParam {
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

/// 同步日志 VO（Java `WechatLiveOrderSyncLogVO` 常用字段；未迁移时不会返回数据）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SyncLogVO {
    pub id: i64,
    pub wechat_order_id: Option<String>,
    pub order_sn: Option<String>,
    pub status: Option<i32>,
    pub message: Option<String>,
    pub retry_count: Option<i32>,
    pub add_time: Option<i64>,
}

/// 校验重试日志 id（路径参数）。
#[must_use]
pub fn validate_log_id(log_id: i64) -> Result<i64, String> {
    if log_id <= 0 {
        return Err(MSG_ID_REQUIRED.to_string());
    }
    Ok(log_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_id_required() {
        assert_eq!(validate_log_id(0).unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(validate_log_id(-1).unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(validate_log_id(5).unwrap(), 5);
    }

    #[test]
    fn not_migrated_message_explicit() {
        assert!(MSG_NOT_MIGRATED.contains("尚未迁移"));
    }

    #[test]
    fn params_accept_java_names() {
        let q: SyncLogQuery =
            serde_json::from_str(r#"{"status":1,"orderSn":"SN","page":2,"size":20}"#).unwrap();
        assert_eq!(q.status, Some(1));
        assert_eq!(q.order_sn.as_deref(), Some("SN"));
        let p: ReconcileParam =
            serde_json::from_str(r#"{"startTime":"2026-01-01","endTime":"2026-01-02"}"#).unwrap();
        assert!(p.start_time.is_some());
    }
}
