//! 管理端买家秀分组管理路由（marketing::buyer_show_group）。
//! 对应原 Java `com.tigshop.adminapi.controller.promotion.BuyerShowGroupController`
//! （`@RequestMapping("/adminapi/promotion/buyerShow/group")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `POST /adminapi/promotion/buyerShow/group/create` | `BuyerShowGroupController.create` | `buyerShowUpdateManage` |
//! | `GET  /adminapi/promotion/buyerShow/group/list`   | `BuyerShowGroupController.list`   | `buyerShowManage` |
//! | `GET  /adminapi/promotion/buyerShow/group/detail` | `BuyerShowGroupController.detail` | `buyerShowManage` |
//! | `POST /adminapi/promotion/buyerShow/group/update` | `BuyerShowGroupController.update` | `buyerShowUpdateManage` |
//! | `POST /adminapi/promotion/buyerShow/group/del`    | `BuyerShowGroupController.delete` | `buyerShowUpdateManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/promotion/buyerShow/group` +
//! > 方法级 `/create` 等，即完整路径里 `buyerShow` 只出现一次
//! > （注意 Java 实体/表名侧写作 `buyer_show`，URL 里是 `buyerShow`，
//! > 大小写必须照抄）。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 权限校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs 的已知缺口一致）。
//!
//! > **多租户说明**：Java 通过 `HeaderUtils.getShopId()`
//! > （`x-admin-type` / `x-shop-id` 请求头）判定平台 / 店铺 / 门店 / 收银台
//! > 视角。Rust 侧 JWT 尚未签发 `shop_id`，故此处按
//! > [`resolve_scope`](fn@resolve_scope) 复刻请求头口径，
//! > `x-admin-type` 缺失时回退 JWT 的 `admin_type`（与 aftersales/010/011/020 一致）。
//!
//! > **未迁移**：多语言翻译（`translatePackage` / `@JsonTranslate`），
//! > 相关字段按原文返回；详见 `crates/services/src/buyer_show_group.rs` 模块头。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus 的
//! > `Page<BuyerShowGroupPageVO>`（`records/total/size/current/pages`），
//! > Rust 统一使用项目既有的 `PageResult`
//! > （`list/total/totalPage/pageSize/page`）；`create` / `update` / `del`
//! > 原接口返回 `void`，此处回传主键或提示文案便于排查。

use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::buyer_show_group::{
    BuyerShowGroupPageQuery, BuyerShowGroupPageVO, BuyerShowGroupSaveParam, BuyerShowGroupScope,
    BuyerShowGroupUpdateParam, BuyerShowGroupVO, OperateDTO,
};
use tigshop_core::types::PageResult;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AuthUser};
use tigshop_services::marketing::buyer_show_group::{require_group_id, require_operate_id};

use crate::AdminState;

/// 买家秀分组域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/buyerShow/group/create", post(group_create))
        .route("/promotion/buyerShow/group/list", get(group_list))
        .route("/promotion/buyerShow/group/detail", get(group_detail))
        .route("/promotion/buyerShow/group/update", post(group_update))
        .route("/promotion/buyerShow/group/del", post(group_delete))
        .route(
            "/promotion/buyerShow/group/del/{id}",
            post(group_delete_path),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "POST",
            "/adminapi/promotion/buyerShow/group/create",
            "BuyerShowGroupController.create",
        ),
        (
            "GET",
            "/adminapi/promotion/buyerShow/group/list",
            "BuyerShowGroupController.list",
        ),
        (
            "GET",
            "/adminapi/promotion/buyerShow/group/detail",
            "BuyerShowGroupController.detail",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/group/update",
            "BuyerShowGroupController.update",
        ),
        (
            "POST",
            "/adminapi/promotion/buyerShow/group/del",
            "BuyerShowGroupController.delete",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `POST /adminapi/promotion/buyerShow/group/create`：新建买家秀分组。
///
/// 对应 Java `BuyerShowGroupController.create(@Valid @RequestBody
/// BuyerShowGroupSaveParam)`。原接口返回 `void`，这里回传新建主键。
async fn group_create(
    State(state): State<AdminState>,
    Json(param): Json<BuyerShowGroupSaveParam>,
) -> ApiResult<serde_json::Value> {
    let scope = scope_from_tenant();
    let buyer_show_group_id = state
        .marketing
        .buyer_show_group
        .create(&param, scope)
        .await?;
    ok(serde_json::json!({ "buyerShowGroupId": buyer_show_group_id }))
}

/// `GET /adminapi/promotion/buyerShow/group/list`：买家秀分组分页。
///
/// 对应 Java `BuyerShowGroupController.list(BuyerShowGroupPageQuery)`。
async fn group_list(
    State(state): State<AdminState>,
    Query(query): Query<BuyerShowGroupPageQuery>,
) -> ApiResult<PageResult<BuyerShowGroupPageVO>> {
    let scope = scope_from_tenant();
    ok(state.marketing.buyer_show_group.list(&query, scope).await?)
}

/// `GET /adminapi/promotion/buyerShow/group/detail?buyerShowGroupId=`：买家秀分组详情。
///
/// 对应 Java `BuyerShowGroupController.detail(@RequestParam
/// @NotNull(message = "买家分组主键不能为空") Integer buyerShowGroupId)`。
/// Java 该 `@RequestParam` 是必填项，缺失时由全局异常处理器返回 1001 +
/// 「接口参数缺失」（见 `require_group_id`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct GroupDetailQuery {
    /// 买家秀分组 ID（Java 参数名 `buyerShowGroupId`）
    buyer_show_group_id: Option<i32>,
}

async fn group_detail(
    State(state): State<AdminState>,
    Query(query): Query<GroupDetailQuery>,
) -> ApiResult<BuyerShowGroupVO> {
    let buyer_show_group_id = require_group_id(query.buyer_show_group_id)?;
    ok(state
        .marketing
        .buyer_show_group
        .detail(buyer_show_group_id)
        .await?)
}

/// `POST /adminapi/promotion/buyerShow/group/update`：更新买家秀分组。
///
/// 对应 Java `BuyerShowGroupController.update(@Valid @RequestBody
/// BuyerShowGroupUpdateParam)`。原接口返回 `void`，这里返回提示文案
/// （项目内既有约定，与 seckill.rs 的 `update` 一致）。
async fn group_update(
    State(state): State<AdminState>,
    Json(param): Json<BuyerShowGroupUpdateParam>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show_group.update(&param).await?;
    ok("更新成功")
}

/// `POST /adminapi/promotion/buyerShow/group/del`：删除买家秀分组。
///
/// 对应 Java `BuyerShowGroupController.delete(@RequestBody @Validated OperateDTO)`
/// → `BaseServiceImpl#del(id)` → `removeById(id)`。
async fn group_delete(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    let id = require_operate_id(dto.id)?;
    state.marketing.buyer_show_group.delete(id).await?;
    ok("删除成功")
}

async fn group_delete_path(
    State(state): State<AdminState>,
    Path(id): Path<i32>,
) -> ApiResult<&'static str> {
    state.marketing.buyer_show_group.delete(id).await?;
    ok("删除成功")
}

// ————————————————————— 多租户范围解析 —————————————————————

/// 读取请求头文本值（缺失 / 非 UTF-8 / 全空白时返回 `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 当前请求的店铺范围（对应 Java `HeaderUtils.getShopId()` 的三态返回）。
///
/// Java 口径（`HeaderUtils.java:133-147`）：
/// - `x-admin-type == "admin"` → `0`（平台，**先于** `x-shop-id` 判定，
///   即平台账号带 `x-shop-id` 也会被强制归零）；
/// - `x-admin-type == "shop"` / `"pos"` → `x-shop-id`（缺省 / 空 → `null`）；
/// - 其它（含缺失）→ `null` → 查询退化为 `shop_id = NULL`（查不到数据）。
///
/// `x-admin-type` 缺失时回退 JWT 的 `admin_type`（Rust 侧 JWT 不签发
/// `x-shop-id`，见模块头多租户说明；与 aftersales/010/011/020 口径一致）。
/// 由请求租户作用域构造分组 scope（平台=Platform，店铺=Shop）。
#[must_use]
fn scope_from_tenant() -> BuyerShowGroupScope {
    match TenantScope::current().shop_id() {
        Some(shop_id) => BuyerShowGroupScope::Shop(shop_id),
        None => BuyerShowGroupScope::Platform,
    }
}

#[cfg(test)]
fn resolve_scope(headers: &HeaderMap, auth: &AuthUser) -> BuyerShowGroupScope {
    let admin_type = header_str(headers, "x-admin-type").or_else(|| auth.admin_type.clone());
    let shop_id = header_str(headers, "x-shop-id").and_then(|v| v.parse::<i32>().ok());
    match admin_type.as_deref() {
        // 平台账号：Java `HeaderUtils.getShopId()` 直接返回 0
        Some("admin") => BuyerShowGroupScope::Platform,
        // 店铺 / 收银台账号：取请求头（缺失即 null → Unscoped）
        Some("shop" | "pos") => BuyerShowGroupScope::from_optional(shop_id),
        // 供应商 / 门店 / 未知账号：Java 返回 null
        _ => BuyerShowGroupScope::Unscoped,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderName, HeaderValue};

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(
                HeaderName::from_bytes(k.as_bytes()).unwrap(),
                HeaderValue::from_str(v).unwrap(),
            );
        }
        h
    }

    /// 仅带请求头、JWT 无 `admin_type` 的身份（模拟 Rust 侧不签发该字段）。
    fn auth_without_type() -> AuthUser {
        AuthUser {
            id: 1,
            username: "tester".into(),
            role_id: None,
            admin_type: None,
            shop_id: None,
        }
    }

    #[test]
    fn platform_admin_is_forced_to_shop_id_zero() {
        // 即使带了 x-shop-id，`admin` 也归零（对齐 Java 的判定顺序）
        let scope = resolve_scope(
            &headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")]),
            &auth_without_type(),
        );
        assert_eq!(scope, BuyerShowGroupScope::Platform);
        assert_eq!(scope.shop_id(), Some(0));
    }

    #[test]
    fn shop_and_pos_admins_use_x_shop_id() {
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
                &auth_without_type()
            ),
            BuyerShowGroupScope::Shop(9)
        );
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")]),
                &auth_without_type()
            ),
            BuyerShowGroupScope::Shop(3)
        );
    }

    #[test]
    fn missing_or_invalid_shop_id_is_unscoped_for_shop_admin() {
        assert_eq!(
            resolve_scope(&headers(&[("x-admin-type", "shop")]), &auth_without_type()),
            BuyerShowGroupScope::Unscoped
        );
        // 非数字同样按 null 处理（Java `Integer.parseInt` 会抛错，
        // 此处容错为 Unscoped，差异见 uncertain_points）
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")]),
                &auth_without_type()
            ),
            BuyerShowGroupScope::Unscoped
        );
    }

    #[test]
    fn other_or_missing_admin_type_is_unscoped() {
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "vendor")]),
                &auth_without_type()
            ),
            BuyerShowGroupScope::Unscoped
        );
        assert_eq!(
            resolve_scope(&headers(&[]), &auth_without_type()),
            BuyerShowGroupScope::Unscoped
        );
    }

    #[test]
    fn jwt_admin_type_is_used_when_header_missing() {
        let auth = AuthUser {
            admin_type: Some("shop".into()),
            ..auth_without_type()
        };
        assert_eq!(
            resolve_scope(&headers(&[("x-shop-id", "5")]), &auth),
            BuyerShowGroupScope::Shop(5)
        );
        // 请求头优先于 JWT
        assert_eq!(
            resolve_scope(
                &headers(&[("x-admin-type", "admin"), ("x-shop-id", "5")]),
                &auth
            ),
            BuyerShowGroupScope::Platform
        );
    }

    #[test]
    fn detail_query_accepts_java_param_name() {
        let q: GroupDetailQuery = serde_json::from_str(r#"{"buyerShowGroupId":12}"#).unwrap();
        assert_eq!(q.buyer_show_group_id, Some(12));
        // 缺失 → None（由 require_group_id 转成 1001「接口参数缺失」）
        let q: GroupDetailQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.buyer_show_group_id, None);
    }

    #[test]
    fn implemented_routes_cover_all_five_endpoints() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
    }
}
