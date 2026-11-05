//! 管理端物流路由。
//! 对应原 Java `controller.setting.ShippingTplController` /
//! `LogisticsCompanyController`。
//!
//! > `ShippingTypeController` 已由 shipping_type 接管（见 `routes/shipping_type.rs`），
//! > 本文件不再注册 `/setting/shippingType/list`，避免重复路由导致启动 panic。
//!
//! TODO(域实现者)：对照 Java 控制器补全运费模板保存（含明细）、
//! 物流公司增删改。

use axum::{
    extract::{Extension, Query, State},
    routing::get,
    Router,
};
use serde::Deserialize;
use tigshop_core::models::{ShippingTplListQuery, ShippingTplVO};
use tigshop_core::types::{PageQuery, PageResult};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 物流域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/shippingTpl/list", get(tpl_list))
        .route("/setting/logisticsCompany/list", get(company_list))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/shippingTpl/list",
            "ShippingTplController.list",
        ),
        (
            "GET",
            "/adminapi/setting/logisticsCompany/list",
            "LogisticsCompanyController.list",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/setting/shippingTpl/list`：运费模板分页。
async fn tpl_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShippingTplListQuery>,
) -> ApiResult<PageResult<ShippingTplVO>> {
    let page_query = tigshop_core::types::PageQuery {
        page: q.page.unwrap_or(1),
        page_size: q.page_size.unwrap_or(20),
    };
    let page = state
        .logistics
        .shipping_list
        .tpl_list(&q, auth.scoped_shop_id())
        .await?;
    let list: Vec<ShippingTplVO> = page.list.iter().map(ShippingTplVO::from).collect();
    ok(PageResult::new(page.total, list, &page_query))
}

/// `GET /adminapi/setting/logisticsCompany/list`：物流公司分页。
///
/// 原版 `LogisticsCompanyController.list` 返回 MyBatis-Plus `Page`，
/// 前端按 `records/total` 读取；字段为 `logisticsId/logisticsName` 等。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogisticsCompanyListQuery {
    #[serde(default)]
    page: Option<u64>,
    #[serde(default, alias = "pageSize")]
    size: Option<u64>,
    #[serde(default)]
    keyword: Option<String>,
    #[serde(default)]
    is_enabled: Option<i32>,
    #[serde(default)]
    provider_type: Option<i32>,
}

async fn company_list(
    State(state): State<AdminState>,
    Query(q): Query<LogisticsCompanyListQuery>,
) -> ApiResult<PageResult<serde_json::Value>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 200);
    let keyword = q.keyword.unwrap_or_default().trim().to_lowercase();
    let mut list = state.logistics.shipping_list.companies().await?;
    list.retain(|c| {
        (keyword.is_empty()
            || c.logistics_name.to_lowercase().contains(&keyword)
            || c.logistics_code.to_lowercase().contains(&keyword))
            && q.is_enabled.map_or(true, |v| c.is_enabled == v)
            && q.provider_type.map_or(true, |v| {
                // provider=2（快递100）时优先看 kuaidi100_code 是否配置；
                // 其余按快递鸟处理，保持历史数据可用。
                if v == 2 {
                    !c.kuaidi100_code.is_empty()
                } else {
                    c.kuaidi100_code.is_empty()
                }
            })
    });
    let total = list.len() as u64;
    let start = ((page - 1) * size) as usize;
    let items: Vec<serde_json::Value> = list
        .into_iter()
        .skip(start)
        .take(size as usize)
        .map(|c| {
            serde_json::json!({
                "logisticsId": c.logistics_id,
                "logisticsCode": c.logistics_code,
                "logisticsName": c.logistics_name,
                "logisticsDesc": c.logistics_desc,
                "sortOrder": c.sort_order,
                "isShow": c.is_show,
                "apiLogisticsCode": c.api_logistics_code,
                "kuaidi100Code": c.kuaidi100_code,
                "isEnabled": c.is_enabled,
                "isBound": 0,
            })
        })
        .collect();
    ok(PageResult::new(
        total,
        items,
        &PageQuery {
            page,
            page_size: size,
        },
    ))
}
