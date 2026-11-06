//! 微信视频号直播记录域（content::api_wechat_live）DTO / 纯函数。
//!
//! 对应原 Java `WechatVideoAccountController#getFinderLiveRecord`
//! （`GET /api/content/wechatVideoAccount/finderLiveRecord`，契约 auth=optional）。
//!
//! 直播记录来自微信「视频号助手」开放接口，未迁移 → 本地校验后返回明确
//! 「未迁移」业务错误，不编造直播数据。

use serde::{Deserialize, Serialize};

/// 微信视频号直播接口未迁移。
pub const MSG_NOT_MIGRATED: &str =
    "微信视频号直播记录依赖微信「视频号助手」开放接口，当前 Rust 侧尚未迁移，本接口暂不可用";

/// 直播记录查询参数（Java `@RequestParam` 子集，均可选）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FinderLiveRecordQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

/// 直播记录 VO（Java `FinderLiveRecordVO` 常用字段；未迁移时不会返回数据）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FinderLiveRecordVO {
    pub live_id: Option<String>,
    pub title: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub viewer_count: Option<i64>,
}

/// 分页归一（Java `BasePage`：缺省 1/15，上限 100）。
#[must_use]
pub fn page_params(page: Option<u64>, size: Option<u64>) -> (u64, u64) {
    (page.unwrap_or(1).max(1), size.unwrap_or(15).clamp(1, 100))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_params_match_base_page() {
        assert_eq!(page_params(None, None), (1, 15));
        assert_eq!(page_params(Some(3), Some(500)), (3, 100));
    }

    #[test]
    fn not_migrated_message_explicit() {
        assert!(MSG_NOT_MIGRATED.contains("尚未迁移"));
    }

    #[test]
    fn query_accepts_java_names() {
        let q: FinderLiveRecordQuery =
            serde_json::from_str(r#"{"page":2,"size":20,"startTime":"2026-01-01"}"#).unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.start_time.as_deref(), Some("2026-01-01"));
    }
}
