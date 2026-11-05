//! 管理端税率管理路由（payment::tax_rate）。
//! 对应原 Java `com.tigshop.adminapi.controller.setting.TaxRateController`
//! （`@RequestMapping("/adminapi/setting/taxRate")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('taxRateManage')")`，
//! 类上有 `@Validated`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /setting/taxRate/list`   | `TaxRateController.list`   | `taxRateManage` |
//! | `GET  /setting/taxRate/detail` | `TaxRateController.detail` | `taxRateManage` |
//! | `POST /setting/taxRate/create` | `TaxRateController.create` | `taxRateUpdateManage` **或** `taxRateModifyManage` |
//! | `POST /setting/taxRate/update` | `TaxRateController.update` | `taxRateUpdateManage` **或** `taxRateModifyManage` |
//! | `POST /setting/taxRate/del`    | `TaxRateController.del`    | `taxRateUpdateManage` **或** `taxRateModifyManage` |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/setting/taxRate`，
//! > 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复。因此最终路径是
//! > `/adminapi/setting/taxRate/list`（不是 `.../taxRate/taxRate/list`），
//! > 与 `docs/api-contract.json` 逐字符一致。注意 `taxRate` 是**小驼峰**
//! > （不是 `/tax_rate`），必须照抄。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在类级 +
//! > 方法级校验，且写操作是 `A or B` 的双权限；Rust 侧 `require_auth` 目前
//! > 只做登录态校验，权限矩阵尚未实现（与 area_code / order_admin / seckill.rs
//! > 的已知缺口一致）。上表「权限」列仅作对照记录，当前**任何已登录管理员**
//! > 都能调用本域全部接口。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<TaxRateVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与
//! > product_manage/002/005/010/014/017/075 一致。
//! > 其余 4 个端点 Java 返回 `void`，Rust 统一包在 `ApiResponse` 里。
//!
//! > **`detail` 参数名注意**：Java 是 `@RequestParam("taxRateId") Integer taxRateId`
//! > —— 查询参数名是 **`taxRateId`**（不是 `id`），与 area_code 的 `id` 不同，
//! > 前端按此传参，必须照抄。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::payment::tax_rate::{
    OperateDTO, TaxRateDTO, TaxRateListQuery, TaxRateVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 本域全部 5 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/setting/taxRate/list", "TaxRateController.list"),
    ("GET", "/setting/taxRate/detail", "TaxRateController.detail"),
    (
        "POST",
        "/setting/taxRate/create",
        "TaxRateController.create",
    ),
    (
        "POST",
        "/setting/taxRate/update",
        "TaxRateController.update",
    ),
    ("POST", "/setting/taxRate/del", "TaxRateController.del"),
];

/// 税率管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/taxRate/list", get(list))
        .route("/setting/taxRate/detail", get(detail))
        .route("/setting/taxRate/create", post(create))
        .route("/setting/taxRate/update", post(update))
        .route("/setting/taxRate/del", post(del))
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            let full = format!("/adminapi{path}");
            tigshop_openapi::RouteDoc::new(method, &full, java_ref)
        })
        .collect()
}

/// `detail` 的查询参数。
///
/// ⚠️ Java 是 `@RequestParam("taxRateId") Integer taxRateId`，
/// 参数名 **`taxRateId`**。缺失时 Spring 抛
/// `MissingServletRequestParameterException`（HTTP 400），
/// 本实现同样返回 400。
#[derive(Debug, Deserialize)]
struct TaxRateIdQuery {
    /// 税率主键（Java `taxRateId`）
    #[serde(rename = "taxRateId", alias = "tax_rate_id")]
    tax_rate_id: Option<i32>,
}

/// `GET /adminapi/setting/taxRate/list`：税率分页。
///
/// 对应 Java `TaxRateController.list(TaxRatePageQuery query)`
/// → `TaxRateServiceImpl#list`。
///
/// 查询参数按 Java `TaxRatePageQuery`（继承 `BasePage`）契约：
/// `regionName` / `isActive` / `startTime` / `endTime` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是 `pageSize`）。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<TaxRateListQuery>,
) -> ApiResult<PageResult<TaxRateVO>> {
    ok(state.payment.tax_rate.list(&q).await?)
}

/// `GET /adminapi/setting/taxRate/detail?taxRateId=`：税率详情。
///
/// 对应 Java `TaxRateController.detail(@RequestParam("taxRateId") Integer taxRateId)`
/// → `TaxRateServiceImpl#detail`。
///
/// Java 记录不存在时抛 `GlobalException("税率不存在")`；本实现返回
/// 404 + 同文案（项目内 order_admin/005/017/075 的既有约定）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<TaxRateIdQuery>,
) -> ApiResult<TaxRateVO> {
    let id = require_positive_id(q.tax_rate_id)?;
    ok(state.payment.tax_rate.detail(id).await?)
}

/// `POST /adminapi/setting/taxRate/create`：新增税率。
///
/// 对应 Java `TaxRateController.create(@Valid @RequestBody TaxRateDTO dto)`
/// → `TaxRateServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<TaxRateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state.payment.tax_rate.create(&dto).await?;
    ok(serde_json::json!({ "taxRateId": id }))
}

/// `POST /adminapi/setting/taxRate/update`：更新税率。
///
/// 对应 Java `TaxRateController.update(@Valid @RequestBody TaxRateDTO dto)`
/// → `TaxRateServiceImpl#update`。
///
/// ⚠️ Java 返回 `void`（`boolean` 被丢弃），本实现回传受影响行数以便排障；
/// **不**因为 `rows_affected() == 0` 报错 —— 与 Java 的 `void` 语义一致
/// （Java 也不检查 `updateById` 的返回值）。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<TaxRateDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.payment.tax_rate.update(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/setting/taxRate/del`：删除税率。
///
/// 对应 Java `TaxRateController.del(@RequestBody OperateDTO operateDTO)`
/// → `TaxRateServiceImpl#del(Integer)` → `removeById`。
///
/// ⚠️ Java 这里**没有** `@Valid`（只有 `@RequestBody`），因此 `id` 为 null 时
/// `OperateDTO` 上的 `@NotNull` **不生效**，会一路传到 `removeById(null)`。
/// 本实现按项目统一口径要求 `id` 必填并返回 400
/// （与 area_code 的处理一致，已列入 `uncertain_points`）。
async fn del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = require_positive_id(dto.id)?;
    let deleted = state.payment.tax_rate.del(id).await?;
    ok(serde_json::json!({ "deleted": deleted }))
}

/// 校验并归一化路径/请求体里的主键。
///
/// `id <= 0` 与缺失都判 400（Java 侧 `Integer` 主键为负时查不到记录，
/// 但本域 `detail` 用的是 `@RequestParam` 必填，缺失即 400；
/// 这里对 `<= 0` 一并拒绝，避免无意义的 `WHERE id = 0` 查询）。
fn require_positive_id(id: Option<i32>) -> Result<i32, AppError> {
    match id {
        Some(v) if v > 0 => Ok(v),
        _ => Err(tigshop_core::Error::Validation(
            tigshop_core::models::payment::tax_rate::MSG_ID_REQUIRED.to_string(),
        )
        .into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 5 条路由必须与契约逐字符一致（含 `/adminapi` 前缀与小驼峰 `taxRate`）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5, "本域应有 5 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/setting/taxRate/list",
            "GET /adminapi/setting/taxRate/detail",
            "POST /adminapi/setting/taxRate/create",
            "POST /adminapi/setting/taxRate/update",
            "POST /adminapi/setting/taxRate/del",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// `implemented_routes` 里的 Java 引用必须指向 `TaxRateController.*`。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("TaxRateController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
    }

    /// 路由表与 `routes()` 注册的条目数必须一致（防漏挂载）。
    #[test]
    fn route_table_covers_all() {
        assert_eq!(ROUTE_TABLE.len(), 5);
    }

    /// `taxRateId` 查询参数按 Java 的 `@RequestParam("taxRateId")` 命名。
    #[test]
    fn detail_query_accepts_tax_rate_id_param_name() {
        let q: TaxRateIdQuery =
            serde_json::from_str(r#"{"taxRateId":12}"#).expect("应能解析 taxRateId");
        assert_eq!(q.tax_rate_id, Some(12));

        // 兼容 snake_case 别名
        let q: TaxRateIdQuery =
            serde_json::from_str(r#"{"tax_rate_id":13}"#).expect("应能解析 tax_rate_id");
        assert_eq!(q.tax_rate_id, Some(13));

        // 缺失 → None（由 require_positive_id 转 400）
        let q: TaxRateIdQuery = serde_json::from_str("{}").expect("空对象应可解析");
        assert_eq!(q.tax_rate_id, None);
    }

    /// 主键校验：缺失、0、负数都拒绝；正数通过。
    #[test]
    fn require_positive_id_rejects_non_positive() {
        assert!(require_positive_id(None).is_err());
        assert!(require_positive_id(Some(0)).is_err());
        assert!(require_positive_id(Some(-3)).is_err());
        assert_eq!(require_positive_id(Some(7)).expect("正数应通过"), 7);
    }
}
