//! 管理端物流公司配置路由（logistics::logistics_company_config）。
//! 对应原 Java `com.tigshop.adminapi.controller.setting.LogisticsCompanyConfigController`
//! （`@RequestMapping("/adminapi/setting/logisticsCompanyConfig")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/setting/logisticsCompanyConfig/list` | `LogisticsCompanyConfigController.list` | 登录 + `logisticsCompanyConfigManage` / `posOrder` / `shopLogisticsCompanyConfigManage` / `vendorLogisticsCompanyConfigManage` |
//! | `GET  /adminapi/setting/logisticsCompanyConfig/detail` | `LogisticsCompanyConfigController.detail` | 同上 |
//! | `POST /adminapi/setting/logisticsCompanyConfig/create` | `LogisticsCompanyConfigController.create` | `logisticsCompanyConfigEditManage` |
//! | `POST /adminapi/setting/logisticsCompanyConfig/update` | `LogisticsCompanyConfigController.update` | `logisticsCompanyConfigEditManage` |
//! | `POST /adminapi/setting/logisticsCompanyConfig/del` | `LogisticsCompanyConfigController.del` | `logisticsCompanyConfigEditManage` |
//! | `POST /adminapi/setting/logisticsCompanyConfig/setDefault` | `LogisticsCompanyConfigController.setDefault` | `logisticsCompanyConfigEditManage` |
//! | `POST /adminapi/setting/logisticsCompanyConfig/updateField` | `LogisticsCompanyConfigController.updateField` | `logisticsCompanyConfigEditManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 校验；Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / shop_manage.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//!
//! > **多租户说明（重要）**：Java 在服务层用 `HeaderUtils.getShopId()` /
//! > `getVendorId()`（请求头 `x-admin-type` / `x-shop-id` / `x-vendor-id`）
//! > 判定当前店铺与供应商，并把 `null` 归一为 `0`：
//! > - `x-admin-type == "admin"` → `shop_id = 0`（平台，**先于** `x-shop-id` 判定）
//! > - `x-admin-type == "shop"` / `"pos"` → `x-shop-id`（缺失/非法 → `0`）
//! > - `x-admin-type == "vendor"`（或其它）→ `vendor_id = x-vendor-id`（缺失 → `0`）
//! >
//! > Rust JWT（`AuthUser`）未签发这两个字段，故本模块用**请求头**解析
//! > （见 [`resolve_tenant`]），与 aftersales/010/011/020/023/029 同口径。
//! > 这**不是等价实现**：`x-admin-type` 缺失时 JWT 的 `admin_type` 作为回退，
//! > 仍然缺失则按平台（`shop_id=0`）处理；带 `x-admin-type: admin` 的账号
//! > 即使传了 `x-shop-id` 也会被强制归零（对齐 Java 判定顺序）。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus 的
//! > `Page<LogisticsCompanyConfigVO>`（`records`/`total`/`size`/`current`/`pages`），
//! > Rust 统一使用项目既有的 `PageResult`（`list`/`total`/`totalPage`/`pageSize`/`page`），
//! > 与 product_manage/002/005/014 一致。
//! >
//! > **`detail` 的 null 语义**：Java `detail` 在 `id` 为空或记录不存在时
//! > **返回 `null`** 而非抛异常，故本模块返回 `ApiResult<Option<...>>`
//! > （`data: null`），不抛 404。
//! >
//! > **`setDefault` 入参形态**：Java 是 `@RequestParam Integer id`（查询串
//! > `?id=`），而同一控制器的 `create` / `update` / `del` / `updateField`
//! > 都是 `@RequestBody`（JSON body）。本模块严格照抄：`setDefault` 读
//! > `Query`，其余读 `Json`。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::logistics::logistics_company_config::{
    LogisticsCompanyConfigCreateDTO, LogisticsCompanyConfigListQuery,
    LogisticsCompanyConfigUpdateDTO, LogisticsCompanyConfigVO, OperateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域全部 7 条路由（`(HTTP method, 去掉 /adminapi 前缀的路径, 原 Java handler)`）。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    (
        "GET",
        "/setting/logisticsCompanyConfig/list",
        "LogisticsCompanyConfigController.list",
    ),
    (
        "GET",
        "/setting/logisticsCompanyConfig/detail",
        "LogisticsCompanyConfigController.detail",
    ),
    (
        "POST",
        "/setting/logisticsCompanyConfig/create",
        "LogisticsCompanyConfigController.create",
    ),
    (
        "POST",
        "/setting/logisticsCompanyConfig/update",
        "LogisticsCompanyConfigController.update",
    ),
    (
        "POST",
        "/setting/logisticsCompanyConfig/del",
        "LogisticsCompanyConfigController.del",
    ),
    (
        "POST",
        "/setting/logisticsCompanyConfig/setDefault",
        "LogisticsCompanyConfigController.setDefault",
    ),
    (
        "POST",
        "/setting/logisticsCompanyConfig/updateField",
        "LogisticsCompanyConfigController.updateField",
    ),
];

/// 物流公司配置域路由（挂载于 `/adminapi` 下）。
///
/// 路径逐字符照抄 Java `@RequestMapping("/adminapi/setting/logisticsCompanyConfig")`
/// 与各方法 `@GetMapping` / `@PostMapping` 的组合结果。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/logisticsCompanyConfig/list", get(list))
        .route("/setting/logisticsCompanyConfig/detail", get(detail))
        .route("/setting/logisticsCompanyConfig/create", post(create))
        .route("/setting/logisticsCompanyConfig/update", post(update))
        .route("/setting/logisticsCompanyConfig/del", post(del))
        .route(
            "/setting/logisticsCompanyConfig/setDefault",
            post(set_default),
        )
        .route(
            "/setting/logisticsCompanyConfig/updateField",
            post(update_field),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, &format!("/adminapi{p}"), j))
        .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 租户（替代 Java HeaderUtils.getShopId / getVendorId）
// ——————————————————————————————————————————————

/// 当前请求的租户视角（对应 Java `HeaderUtils.getShopId()` / `getVendorId()`）。
///
/// 两个字段都按 Java 语义**归一为 `i32`**（`null` → `0`），因为服务层的
/// `list` / `create` 一律用 `getShopId() != null ? getShopId() : 0` 兜底。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TenantScope {
    /// 店铺ID（平台 = 0）
    pub shop_id: i32,
    /// 供应商ID（非供应商 = 0）
    pub vendor_id: i32,
}

/// 读取请求头文本值（缺失 / 非 UTF-8 / 空白 → `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
}

/// 解析当前请求的租户视角。
///
/// 复刻 Java `HeaderUtils` 的判定顺序（见模块头「多租户说明」）：
/// - `admin`（含 `x-admin-type: admin` 或 JWT `admin_type == "admin"`）
///   → `shop_id = 0`，**先于** `x-shop-id` 判定；
/// - `shop` / `pos` → `x-shop-id`（缺失 / 非数字 → 0）；
/// - `vendor` → `vendor_id = x-vendor-id`（缺失 / 非数字 → 0），`shop_id = 0`；
/// - 其它 / 缺失 → 平台视角（两项均 0）。
///
/// `admin_type` 优先取请求头（Java 只认请求头），缺失时回退 JWT 的 `admin_type`
/// （与 aftersales `resolve_scope` 一致）。
#[must_use]
pub fn resolve_tenant(headers: &HeaderMap, auth: &AuthUser) -> TenantScope {
    let admin_type = header_str(headers, "x-admin-type").or_else(|| auth.admin_type.clone());
    let shop_header = header_str(headers, "x-shop-id").and_then(|v| v.parse::<i32>().ok());
    let vendor_header = header_str(headers, "x-vendor-id").and_then(|v| v.parse::<i32>().ok());

    match admin_type.as_deref() {
        // 平台账号：Java HeaderUtils.getShopId() 直接返回 0，忽略 x-shop-id
        Some("admin") => TenantScope {
            shop_id: 0,
            vendor_id: 0,
        },
        Some("shop") | Some("pos") => TenantScope {
            shop_id: shop_header.unwrap_or(0),
            vendor_id: 0,
        },
        // 供应商后台：Java getVendorId() 仅在 vendor 账号下读请求头
        Some("vendor") => TenantScope {
            shop_id: 0,
            vendor_id: vendor_header.unwrap_or(0),
        },
        _ => TenantScope {
            shop_id: 0,
            vendor_id: 0,
        },
    }
}

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// `GET .../detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 配置 ID（Java `@RequestParam Integer id`，可缺省 → Java 返回 `null`）
    id: Option<i32>,
}

/// `POST .../setDefault?id=` 的查询参数（Java 是 `@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
struct SetDefaultQuery {
    /// 配置 ID（Java 未标 `@NotNull`，缺失时 `getById(null)` → 空 → 报「配置记录不存在」）
    id: Option<i32>,
}

/// 配置归属校验：店铺账号仅可访问本店配置；供应商账号仅可访问本方配置；
/// 平台账号（`shop_id == 0 && vendor_id == 0`）放行（列表已按平台 0 过滤）。
///
/// `scope` 为 `None`（配置不存在）时直接放行，由服务层返回原有「配置记录不存在」语义。
fn ensure_config_access(
    tenant: &TenantScope,
    scope: Option<(i32, i32)>,
) -> Result<(), tigshop_core::Error> {
    let Some((shop_id, vendor_id)) = scope else {
        return Ok(());
    };
    if tenant.shop_id > 0 && shop_id != tenant.shop_id {
        return Err(tigshop_core::Error::Forbidden(format!(
            "无权访问店铺 {shop_id} 的物流配置"
        )));
    }
    if tenant.vendor_id > 0 && vendor_id != tenant.vendor_id {
        return Err(tigshop_core::Error::Forbidden(format!(
            "无权访问供应商 {vendor_id} 的物流配置"
        )));
    }
    Ok(())
}

// ——————————————————————————————————————————————
// Handlers
// ——————————————————————————————————————————————

/// `GET /adminapi/setting/logisticsCompanyConfig/list`：当前租户的配置分页。
///
/// 对应 Java `LogisticsCompanyConfigController.list(LogisticsCompanyConfigListDTO)`。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<LogisticsCompanyConfigListQuery>,
) -> ApiResult<PageResult<LogisticsCompanyConfigVO>> {
    let tenant = resolve_tenant(&headers, &auth);
    ok(state
        .logistics
        .logistics_company_config
        .list(&q, tenant.shop_id, tenant.vendor_id)
        .await?)
}

/// `GET /adminapi/setting/logisticsCompanyConfig/detail`：配置详情。
///
/// 对应 Java `LogisticsCompanyConfigController.detail(@RequestParam Integer id)`。
/// `id` 缺失或记录不存在时返回 `data: null`（与 Java 返回 `null` 一致）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<LogisticsCompanyConfigVO>> {
    let tenant = resolve_tenant(&headers, &auth);
    let scope = match q.id {
        Some(id) => {
            state
                .logistics
                .logistics_company_config
                .scope_of(id)
                .await?
        }
        None => None,
    };
    ensure_config_access(&tenant, scope)?;
    ok(state
        .logistics
        .logistics_company_config
        .detail(q.id)
        .await?)
}

/// `POST /adminapi/setting/logisticsCompanyConfig/create`：绑定物流公司。
///
/// 对应 Java `LogisticsCompanyConfigController.create(@RequestBody CreateDTO)`，
/// 返回新建的 `configId`。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<LogisticsCompanyConfigCreateDTO>,
) -> ApiResult<i32> {
    let tenant = resolve_tenant(&headers, &auth);
    ok(state
        .logistics
        .logistics_company_config
        .create(&dto, tenant.shop_id, tenant.vendor_id)
        .await?)
}

/// `POST /adminapi/setting/logisticsCompanyConfig/update`：更新配置。
///
/// 对应 Java `LogisticsCompanyConfigController.update(@RequestBody UpdateDTO)`。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<LogisticsCompanyConfigUpdateDTO>,
) -> ApiResult<&'static str> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("配置ID不能为空".into()))?;
    let tenant = resolve_tenant(&headers, &auth);
    let scope = state
        .logistics
        .logistics_company_config
        .scope_of(id)
        .await?;
    ensure_config_access(&tenant, scope)?;
    state
        .logistics
        .logistics_company_config
        .update(&dto)
        .await?;
    ok("更新成功")
}

/// `POST /adminapi/setting/logisticsCompanyConfig/del`：解绑物流公司。
///
/// 对应 Java `LogisticsCompanyConfigController.del(@RequestBody OperateDTO)`。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    let tenant = resolve_tenant(&headers, &auth);
    let scope = match dto.id {
        Some(id) => {
            state
                .logistics
                .logistics_company_config
                .scope_of(id)
                .await?
        }
        None => None,
    };
    ensure_config_access(&tenant, scope)?;
    state
        .logistics
        .logistics_company_config
        .delete(dto.id)
        .await?;
    ok("删除成功")
}

/// `POST /adminapi/setting/logisticsCompanyConfig/setDefault`：设置默认物流公司。
///
/// 对应 Java `LogisticsCompanyConfigController.setDefault(@RequestParam Integer id)`
/// —— 注意入参是**查询串**而非 JSON body。
async fn set_default(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<SetDefaultQuery>,
) -> ApiResult<&'static str> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("配置ID不能为空".into()))?;
    let tenant = resolve_tenant(&headers, &auth);
    let scope = state
        .logistics
        .logistics_company_config
        .scope_of(id)
        .await?;
    ensure_config_access(&tenant, scope)?;
    state
        .logistics
        .logistics_company_config
        .set_default(id)
        .await?;
    ok("设置成功")
}

/// `POST /adminapi/setting/logisticsCompanyConfig/updateField`：更新字段（启用/排序）。
///
/// 对应 Java `LogisticsCompanyConfigController.updateField(@RequestBody UpdateFieldDTO)`，
/// 白名单为控制器常量 `CONFIG_UPDATE_FIELDS = {"is_enabled", "sort_order"}`。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("配置ID不能为空".into()))?;
    let tenant = resolve_tenant(&headers, &auth);
    let scope = state
        .logistics
        .logistics_company_config
        .scope_of(id)
        .await?;
    ensure_config_access(&tenant, scope)?;
    state
        .logistics
        .logistics_company_config
        .update_field(&dto)
        .await?;
    ok("更新成功")
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

    fn auth_with_type(t: Option<&str>) -> AuthUser {
        AuthUser {
            id: 1,
            username: "tester".into(),
            role_id: Some(1),
            admin_type: t.map(ToString::to_string),
            shop_id: None,
        }
    }

    #[test]
    fn admin_header_forces_platform_zero() {
        // 平台账号即使带了 x-shop-id / x-vendor-id 也归零（Java 判定顺序）
        let t = resolve_tenant(
            &headers(&[
                ("x-admin-type", "admin"),
                ("x-shop-id", "9"),
                ("x-vendor-id", "7"),
            ]),
            &auth_with_type(None),
        );
        assert_eq!(
            t,
            TenantScope {
                shop_id: 0,
                vendor_id: 0
            }
        );
    }

    #[test]
    fn shop_and_pos_take_x_shop_id() {
        let t = resolve_tenant(
            &headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")]),
            &auth_with_type(None),
        );
        assert_eq!(t.shop_id, 9);
        assert_eq!(t.vendor_id, 0);

        let t = resolve_tenant(
            &headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")]),
            &auth_with_type(None),
        );
        assert_eq!(t.shop_id, 3);
    }

    #[test]
    fn missing_or_dirty_shop_header_falls_back_to_zero() {
        // Java HeaderUtils.getShopId() 返回 null，服务层兜底 0
        let t = resolve_tenant(&headers(&[("x-admin-type", "shop")]), &auth_with_type(None));
        assert_eq!(t.shop_id, 0);

        let t = resolve_tenant(
            &headers(&[("x-admin-type", "shop"), ("x-shop-id", "abc")]),
            &auth_with_type(None),
        );
        assert_eq!(t.shop_id, 0);

        let t = resolve_tenant(
            &headers(&[("x-admin-type", "shop"), ("x-shop-id", "   ")]),
            &auth_with_type(None),
        );
        assert_eq!(t.shop_id, 0);
    }

    #[test]
    fn vendor_takes_x_vendor_id_and_zero_shop() {
        let t = resolve_tenant(
            &headers(&[
                ("x-admin-type", "vendor"),
                ("x-vendor-id", "12"),
                ("x-shop-id", "9"),
            ]),
            &auth_with_type(None),
        );
        assert_eq!(t.vendor_id, 12);
        // 供应商账号不会带店铺视角
        assert_eq!(t.shop_id, 0);
    }

    #[test]
    fn jwt_admin_type_is_fallback_when_header_missing() {
        let t = resolve_tenant(
            &headers(&[("x-shop-id", "5")]),
            &auth_with_type(Some("shop")),
        );
        assert_eq!(t.shop_id, 5);

        // 请求头优先于 JWT
        let t = resolve_tenant(
            &headers(&[("x-admin-type", "admin"), ("x-shop-id", "5")]),
            &auth_with_type(Some("shop")),
        );
        assert_eq!(t.shop_id, 0);
    }

    #[test]
    fn no_headers_defaults_to_platform() {
        let t = resolve_tenant(&headers(&[]), &auth_with_type(None));
        assert_eq!(t, TenantScope::default());
    }

    #[test]
    fn route_table_matches_java_contract() {
        // 7 条路由，路径逐字符对齐 Java @RequestMapping + @GetMapping/@PostMapping
        assert_eq!(ROUTE_TABLE.len(), 7);
        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/list"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/detail"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/create"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/update"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/del"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/setDefault"));
        assert!(paths.contains(&"/setting/logisticsCompanyConfig/updateField"));
    }

    #[test]
    fn implemented_routes_prefix_adminapi() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7);
        for d in &docs {
            assert!(d
                .path
                .starts_with("/adminapi/setting/logisticsCompanyConfig/"));
        }
    }

    #[test]
    fn id_query_and_set_default_query_deserialize_from_json() {
        // 两个 Query 结构体都是「可选 id」；用 serde_json 验证字段名与空对象行为
        // （`serde_urlencoded` 不是本 crate 的直接依赖，故不在此处引入）。
        let q: IdQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(q.id, Some(5));
        let q: IdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.id, None);

        let q: SetDefaultQuery = serde_json::from_str(r#"{"id":8}"#).unwrap();
        assert_eq!(q.id, Some(8));
        let q: SetDefaultQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.id, None);
    }
    /// 跨店物流配置访问必须被拒；平台账号放行。
    #[test]
    fn config_scope_isolation() {
        let shop_tenant = TenantScope {
            shop_id: 6,
            vendor_id: 0,
        };
        assert!(ensure_config_access(&shop_tenant, Some((6, 0))).is_ok());
        assert!(ensure_config_access(&shop_tenant, Some((9, 0))).is_err());
        // 配置不存在：交给服务层原有语义
        assert!(ensure_config_access(&shop_tenant, None).is_ok());
        let platform = TenantScope {
            shop_id: 0,
            vendor_id: 0,
        };
        assert!(ensure_config_access(&platform, Some((9, 0))).is_ok());
    }
}
