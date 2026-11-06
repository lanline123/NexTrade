//! 微信视频号直播记录域服务（content::api_wechat_live）。
//!
//! `getFinderLiveRecord` 依赖微信「视频号助手」开放接口，未迁移 →
//! 保留端点与查询参数，返回明确「未迁移」业务错误，不编造直播数据。

use std::sync::Arc;

use tigshop_core::models::content::api_wechat_live::{
    page_params, FinderLiveRecordQuery, FinderLiveRecordVO, MSG_NOT_MIGRATED,
};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::content::api_wechat_live::ApiWechatLiveRepository;
use tigshop_infrastructure::db::Repositories;

/// 微信视频号直播记录服务。
pub struct ApiWechatLiveService {
    repos: Arc<Repositories>,
}

impl ApiWechatLiveService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 本域仓储（NESTED：`self.repos.content.api_wechat_live`）。
    #[must_use]
    pub fn repo(&self) -> &ApiWechatLiveRepository {
        &self.repos.content.api_wechat_live
    }

    /// 直播记录（未迁移）。
    pub async fn finder_live_record(
        &self,
        q: &FinderLiveRecordQuery,
    ) -> Result<PageResult<FinderLiveRecordVO>> {
        let (page, size) = page_params(q.page, q.size);
        let page_query = PageQuery {
            page,
            page_size: size,
        };
        let _ = page_query;
        Err(Error::biz_msg(MSG_NOT_MIGRATED))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn not_migrated_message_used() {
        assert!(MSG_NOT_MIGRATED.contains("尚未迁移"));
    }
}
