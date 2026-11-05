//! 管理端商品询价路由。
//! 对应原 Java `com.tigshop.adminapi.controller.product.PriceInquiryController`
//! （`@RequestMapping("/adminapi/product/priceInquiry")`，5 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/priceInquiry/list` | `list` | 登录 |
//! | `GET  /adminapi/product/priceInquiry/detail` | `detail` | 登录 |
//! | `POST /adminapi/product/priceInquiry/reply` | `reply` | `priceInquiryModifyManage` |
//! | `POST /adminapi/product/priceInquiry/del` | `del` | `priceInquiryModifyManage` |
//! | `POST /adminapi/product/priceInquiry/batch` | `batch` | `priceInquiryModifyManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 权限；Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现
//! > （与 catalog 域其它模块的已知缺口一致）。上表「权限」列仅作对照。
//!
//! > **多租户说明（对照 Java `HeaderUtils.getShopId()`）**：
//! > `list` 用请求头覆盖 `PriceInquiryDTO.shopId`：
//! > - `x-admin-type: admin` ⇒ `0`（平台账号；Java 的 `HeaderUtils` 对
//! >   `admin` 返回 `0`，于是只看到 `shop_id = 0` 的询价）
//! > - `x-admin-type: shop|pos` ⇒ `x-shop-id`（缺失/非法 ⇒ `null`，不过滤）
//! > - 其它/缺失 ⇒ `null`，不过滤
//! > 规则由 [`shop_filter_from_headers`] 实现，与 Java 逐分支对齐。
//!
//! > **返回结构**：Java `list` 返回 MyBatis-Plus `Page<PriceInquiryVO>`
//! > （`records/total/size/current/pages`），Rust 统一用项目既有
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与 brand /
//! > product_manage 等域一致；`detail` 返回 `PriceInquiryVO`。
//!
//! > **`reply` 的身份来源**：Java `SecurityUtils.getCurrentUsername()` /
//! > `getCurrentAdminId()`；Rust 侧取 JWT 身份 `AuthUser`（`username` / `id`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::price_inquiry::{
    BatchDTO, OperateDTO, PriceInquiryQuery, PriceInquiryReplyDTO, PriceInquiryVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};
use tigshop_services::catalog::price_inquiry::AdminOperator;

use super::tenant;
use crate::AdminState;

/// 商品询价域全部 5 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `PriceInquiryController` 一致；`implemented_routes()` 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/product/priceInquiry/list",
        "PriceInquiryController.list",
    ),
    (
        "GET",
        "/product/priceInquiry/detail",
        "PriceInquiryController.detail",
    ),
    (
        "POST",
        "/product/priceInquiry/reply",
        "PriceInquiryController.reply",
    ),
    (
        "POST",
        "/product/priceInquiry/del",
        "PriceInquiryController.del",
    ),
    (
        "POST",
        "/product/priceInquiry/batch",
        "PriceInquiryController.batch",
    ),
];

/// 商品询价域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/priceInquiry/list", get(price_inquiry_list))
        .route("/product/priceInquiry/detail", get(price_inquiry_detail))
        .route("/product/priceInquiry/reply", post(price_inquiry_reply))
        .route("/product/priceInquiry/del", post(price_inquiry_del))
        .route("/product/priceInquiry/batch", post(price_inquiry_batch))
}

/// 本模块已实现路由（用于 `/openapi/coverage` 覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `GET /adminapi/product/priceInquiry/list`：询价分页列表。
///
/// 对应 Java `PriceInquiryController#list(PriceInquiryDTO)`，其中
/// `dto.setShopId(HeaderUtils.getShopId())` 由本 handler 用请求头复刻。
async fn price_inquiry_list(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Query(q): Query<PriceInquiryQuery>,
) -> ApiResult<PageResult<PriceInquiryVO>> {
    let mut q = q;
    // Java：`dto.setShopId(HeaderUtils.getShopId())`（覆盖前端传值）
    q.shop_id = shop_filter_from_headers(&headers);
    ok(state.catalog.price_inquiry.list(&q).await?)
}

/// `GET /adminapi/product/priceInquiry/detail?id=`：询价详情。
///
/// 对应 Java `detail(@RequestParam Integer id)`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn price_inquiry_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<PriceInquiryVO> {
    let detail = state.catalog.price_inquiry.detail(q.id).await?;
    tenant::ensure_row_shop(&auth, detail.shop_id)?;
    ok(detail)
}

/// `POST /adminapi/product/priceInquiry/reply`：商家回复。
///
/// 对应 Java `reply(@RequestBody @Valid PriceInquiryReplyDTO)`；
/// 操作人来自 JWT（`AuthUser.id` / `AuthUser.username`）。
async fn price_inquiry_reply(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<PriceInquiryReplyDTO>,
) -> ApiResult<()> {
    let inquiry_id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("询价ID不能为空".into()))?;
    let detail = state.catalog.price_inquiry.detail(inquiry_id).await?;
    tenant::ensure_row_shop(&auth, detail.shop_id)?;
    let operator = AdminOperator::new(auth.id, auth.username.clone());
    state.catalog.price_inquiry.reply(&dto, &operator).await?;
    ok(())
}

/// `POST /adminapi/product/priceInquiry/del`：删除询价。
///
/// 对应 Java `del(@RequestBody OperateDTO)` → `removeById(dto.getId())`。
/// Java `OperateDTO.id` 的 `@NotNull` 因控制器**没有 `@Valid`** 而不生效：
/// `id` 缺失时 `removeById(null)` 影响 0 行、控制器返回 `void`，
/// 因此本 handler 在 `id` 缺失时也静默成功（不报参数错误）。
async fn price_inquiry_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    if let Some(id) = dto.id {
        let detail = state.catalog.price_inquiry.detail(id).await?;
        tenant::ensure_row_shop(&auth, detail.shop_id)?;
        state.catalog.price_inquiry.delete(id).await?;
    }
    ok(())
}

/// `POST /adminapi/product/priceInquiry/batch`：批量操作（仅 `type = "del"`）。
///
/// 对应 Java `batch(@RequestBody @Valid BatchDTO)`。
async fn price_inquiry_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    if dto.r#type.as_deref() == Some("del") {
        for id in dto.ids.as_deref().unwrap_or(&[]) {
            let detail = state.catalog.price_inquiry.detail(*id).await?;
            tenant::ensure_row_shop(&auth, detail.shop_id)?;
        }
    }
    state.catalog.price_inquiry.batch(&dto).await?;
    ok(())
}

// ——————————————————————————————————————————————
// 请求头 → 店铺过滤值（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 解析 Java `HeaderUtils.getShopId()` 的语义，专供 `list` 覆盖
/// `PriceInquiryDTO.shopId`：
///
/// - `x-admin-type: admin` ⇒ `Some(0)`（平台账号，Java 对 `admin` 返回 `0`）
/// - `x-admin-type: shop|pos` ⇒ `Some(x-shop-id)`；缺失/非法 ⇒ `None`
///   （Java 对空 `x-shop-id` 返回 `null`）
/// - 其它/缺失 ⇒ `None`（Java 返回 `null`）
///
/// `None` 在服务层等价「不过滤店铺」（Java `eq(shopId != null, ...)`）。
#[must_use]
fn shop_filter_from_headers(headers: &axum::http::HeaderMap) -> Option<i32> {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => Some(0),
        Some("shop" | "pos") => {
            header_str(headers, "x-shop-id").and_then(|v| v.trim().parse::<i32>().ok())
        }
        _ => None,
    }
}

fn header_str(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                axum::http::HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 5 条、`/adminapi` 前缀、method 大小写敏感、`priceInquiry` 驼峰大小写敏感。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5, "契约中 price_inquiry 域共 5 条接口");

        let expected = [
            ("GET", "/adminapi/product/priceInquiry/list"),
            ("GET", "/adminapi/product/priceInquiry/detail"),
            ("POST", "/adminapi/product/priceInquiry/reply"),
            ("POST", "/adminapi/product/priceInquiry/del"),
            ("POST", "/adminapi/product/priceInquiry/batch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }

        // 无重复、无多余
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let unique = {
            let mut k = keys.clone();
            k.sort();
            k.dedup();
            k
        };
        keys.sort();
        assert_eq!(unique, keys, "implemented_routes() 存在重复项");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应（架构 §4 门禁：路由即契约）。
    #[test]
    fn routes_registers_every_route_table_entry() {
        // `routes()` 用字面量注册；这里复述同一份清单，改一边漏另一边即失败。
        let registered = [
            "/product/priceInquiry/list",
            "/product/priceInquiry/detail",
            "/product/priceInquiry/reply",
            "/product/priceInquiry/del",
            "/product/priceInquiry/batch",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }

    /// 路由表路径统一以控制器前缀开头，method 只允许 GET/POST。
    #[test]
    fn route_table_shape_is_valid() {
        for (i, (method, path, java_ref)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                path.starts_with("/product/priceInquiry/"),
                "路径必须以控制器前缀开头: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(java_ref.starts_with("PriceInquiryController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 请求头 → 店铺过滤值，逐分支对齐 Java `HeaderUtils.getShopId()`。
    #[test]
    fn shop_filter_matches_header_utils() {
        // 平台账号 ⇒ 0（不是 None）
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            Some(0)
        );
        // 店铺 / 门店 ⇒ x-shop-id
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            Some(9)
        );
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            Some(3)
        );
        // 店铺账号缺 / 非法 x-shop-id ⇒ null ⇒ 不过滤
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop")])),
            None
        );
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")])),
            None
        );
        // 缺失 / 未知 admin-type ⇒ null ⇒ 不过滤
        assert_eq!(shop_filter_from_headers(&headers(&[])), None);
        assert_eq!(
            shop_filter_from_headers(&headers(&[("x-admin-type", "vendor")])),
            None
        );
    }
    /// 多租户：店铺账号的询价归属校验（跨店 403）。
    #[test]
    fn tenant_scope_isolation() {
        let shop = AuthUser {
            id: 3,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(5),
        };
        assert!(tenant::ensure_row_shop(&shop, 5).is_ok());
        assert!(tenant::ensure_row_shop(&shop, 6).is_err());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert!(tenant::ensure_row_shop(&platform, 6).is_ok());
    }
}
