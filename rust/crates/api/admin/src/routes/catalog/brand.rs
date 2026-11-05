//! 管理端品牌路由。
//! 对应原 Java `com.tigshop.adminapi.controller.product.BrandController`
//! （`@RequestMapping("/adminapi/product/brand")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/brand/list` | `BrandController.list` | `decorate`/`brandManage`/`vendorProductManage`/`productManage` |
//! | `GET  /adminapi/product/brand/detail` | `BrandController.detail` | `brandManage`/`vendorProductManage`/`productManage` |
//! | `POST /adminapi/product/brand/del` | `BrandController.del` | `brandModifyManage` |
//! | `POST /adminapi/product/brand/create` | `BrandController.create` | `brandModifyManage` |
//! | `POST /adminapi/product/brand/update` | `BrandController.update` | `brandModifyManage` |
//! | `POST /adminapi/product/brand/updateField` | `BrandController.updateField` | `brandModifyManage` |
//! | `POST /adminapi/product/brand/batch` | `BrandController.batch` | `brandModifyManage` |
//! | `GET  /adminapi/product/brand/search` | `BrandController.search` | `decorate`/`brandManage`/`vendorProductManage`/`productManage` |
//! | `POST /adminapi/product/brand/updateFirstWord` | `BrandController.updateFirstWord` | `brandManage`/`vendorProductManage`/`productManage` |
//! | `GET  /adminapi/product/brand/auditList` | `BrandController.auditList` | `brandManage`/`vendorProductManage`/`productManage` |
//! | `POST /adminapi/product/brand/audit` | `BrandController.audit` | `brandManage`/`vendorProductManage`/`productManage` |
//! | `GET  /adminapi/product/brand/auditWaitNum` | `BrandController.auditWaitNum` | `brandManage`/`vendorProductManage`/`productManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级
//! > 校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 catalog.rs 中分类域的已知缺口一致）。上表「权限」列仅作对照，
//! > 当前**任何已登录管理员**都能调用品牌域全部 12 条接口
//! > （本模块注册 11 条，`list` 暂由 catalog.rs 响应，见下方合并说明）。
//! >
//! > **多租户说明（重要缺口）**：Java 用 `HeaderUtils.getShopId()`
//! > （由 `x-admin-type` / `x-shop-id` 请求头解析）区分平台、店铺、门店账号，
//! > 并据此决定四件事：
//! > 1. `list` 是否强制 `shop_id` 过滤（店铺账号只能看到本店品牌）；
//! > 2. `create` / `update` 落库的 `shop_id` 与返回文案；
//! > 3. `create` / `update` 的初始审核状态（店铺 → 待审核）；
//! > 4. `auditList` 对店铺账号会叠加 `shop_id = 本店`。
//! >
//! > Rust 侧 JWT（`tigshop_security::web::AuthUser`）尚未签发 `shop_id`，
//! > 因此本域目前以**请求体 / 查询参数里的 `shopId`** 替代该语义
//! > （`BrandListQuery.shopId`、`BrandDTO.shopId`）。**这不是等价实现**：
//! > 平台账号可通过 `shopId` 参数伪装成店铺视角，反之店铺账号不传
//! > `shopId` 时会被当作平台账号（可看到全部品牌、建品牌直接审核通过）。
//! > 待鉴权中间件补齐 `shop_id` 后必须改回按登录态判定。
//! >
//! > **覆盖率与 `list` 归属说明（⚠️ 合并必读）**：
//! > 任务书只列了 11 条（不含 `GET /adminapi/product/brand/list`），
//! > 但 `list` 与 `auditList` 复用同一服务方法与同一 DTO，本模块已完整实现。
//! >
//! > **冲突**：`crates/api/admin/src/routes/catalog.rs` 也注册了
//! > `.route("/product/brand/list", get(catalog::brand_list))`（L52）并在自己的
//! > `implemented_routes()` 里声明了同一条（L69）。axum 0.8 的 `Router::merge`
//! > 在「同一路径 + 同一 method」重复注册时**直接 panic**
//! > （`Overlapping method route. Handler for 'GET /product/brand/list' already exists`），
//! > 两个模块都会被 `routes/mod.rs::merge_all` 合并 → **服务启动即崩**。
//! >
//! > 本模块的处置（因为 catalog.rs 是本切片不得修改的共享文件）：
//! > **暂不注册 `list`**，改由 catalog.rs 那条响应，以保证服务能启动；
//! > 但 `implemented_routes()` 仍声明该路径（契约覆盖不受影响）。
//! > 本文件底部的 `brand_list` handler 已写好并保留为**合并目标**。
//! >
//! > 主会话合并时请二选一：
//! > 1. **推荐**：删除 catalog.rs 的 `.route("/product/brand/list", ...)`、
//! >    其 `catalog::brand_list` / `BrandQuery` 与 `implemented_routes()` 中的
//! >    `("GET", "/adminapi/product/brand/list", ...)` 一行，然后在
//! >    [`routes`] 中恢复 `list` 的注册。理由：catalog 版本只返回
//! >    `{brandId, brandName, isShow}`（`models::catalog::BrandVO`），
//! >    缺少 `statusText` / `shop` / `sortOrder` / `firstWord` 等
//! >    Java `BrandVO` 字段，且分页参数只认 `page/pageSize`
//! >    （Java `BasePage` 用的是 `page/size`，见 `BrandListQuery`），
//! >    无法满足前端契约。
//! > 2. 或保持现状（catalog 提供 3 字段版列表），并把本模块的
//! >    `brand_list` 与 `list` 注册一并删除。
//! >
//! > 另注：`routes/mod.rs::implemented_routes()` 目前**重复 extend 了
//! > 本模块两次**（L59 与 L65），合并时请删掉一行。
//!
//! > **返回结构说明**：Java `list` / `auditList` 返回 MyBatis-Plus 的
//! > `Page<BrandVO>`（`records/total/size/current/pages`），Rust 统一使用项目
//! > 既有的 `PageResult`（`list/total/totalPage/pageSize/page`），与 product_manage/002
//! > 一致。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::brand::{
    BatchDTO, BrandAuditDTO, BrandDTO, BrandListQuery, BrandSearchVO, BrandVO, OperateDTO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::AuthUser;
use tigshop_security::web::{ok, ApiResult};

use super::tenant;
use crate::AdminState;

/// 品牌域全部 12 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// **这是 `implemented_routes()` 的唯一来源**（声明与 Java 契约的对应关系）。
/// [`routes`] 因 `/list` 与 catalog.rs 冲突而单独用字面量注册，
/// `#[cfg(test)]` 中的 `routes_registers_exactly_the_non_conflicting_paths`
/// 负责守住「注册清单 == 本表去掉 `/list`」，避免两边漂移。
/// 顺序与原 Java `BrandController` 一致。
const ROUTE_TABLE: [(&str, &str, &str); 12] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/product/brand/list", "BrandController.list"),
    ("GET", "/product/brand/detail", "BrandController.detail"),
    ("POST", "/product/brand/del", "BrandController.del"),
    ("POST", "/product/brand/create", "BrandController.create"),
    ("POST", "/product/brand/update", "BrandController.update"),
    (
        "POST",
        "/product/brand/updateField",
        "BrandController.updateField",
    ),
    ("POST", "/product/brand/batch", "BrandController.batch"),
    ("GET", "/product/brand/search", "BrandController.search"),
    (
        "POST",
        "/product/brand/updateFirstWord",
        "BrandController.updateFirstWord",
    ),
    (
        "GET",
        "/product/brand/auditList",
        "BrandController.auditList",
    ),
    ("POST", "/product/brand/audit", "BrandController.audit"),
    (
        "GET",
        "/product/brand/auditWaitNum",
        "BrandController.auditWaitNum",
    ),
];

/// 品牌域路由（挂载于 `/adminapi` 下）。
///
/// ⚠️ `/product/brand/list` **目前故意未注册**：`routes/catalog.rs`（L52）已注册
/// 同一路径 + 同一 method，而 `routes/mod.rs::merge_all` 会把两者都合并，
/// axum 0.8 对重叠路由直接 panic（详见模块头「合并必读」）。
/// 删掉 catalog.rs 那一条后，在此恢复 `.route("/product/brand/list", get(brand_list))`。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/brand/list", get(brand_list))
        .route("/product/brand/detail", get(brand_detail))
        .route("/product/brand/del", post(brand_del))
        .route("/product/brand/create", post(brand_create))
        .route("/product/brand/update", post(brand_update))
        .route("/product/brand/updateField", post(brand_update_field))
        .route("/product/brand/batch", post(brand_batch))
        .route("/product/brand/search", get(brand_search))
        .route(
            "/product/brand/updateFirstWord",
            post(brand_update_first_word),
        )
        .route("/product/brand/auditList", get(brand_audit_list))
        .route("/product/brand/audit", post(brand_audit))
        .route("/product/brand/auditWaitNum", get(brand_audit_wait_num))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 含 `/list`：该路径在契约内且服务层已实现（当前由 catalog.rs 响应，
/// 路径归属见模块头「合并必读」），声明在此避免覆盖率误报为「未实现」。
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

/// `GET /adminapi/product/brand/list`：品牌分页（品牌域权威实现）。
///
/// 对应 Java `BrandController.list`（`BrandListDTO` 查询参数），
/// 服务层为 [`tigshop_services::catalog::brand::BrandService::list`]，
/// 返回与 `auditList` 完全同构的 `PageResult<BrandVO>`。
///
/// ⚠️ 当前**未在本模块注册**（详见模块头「合并必读」）：catalog.rs 占用了
/// 同一路径，注册即触发 axum `Router::merge` panic。合并时删掉 catalog.rs 的
/// 那一条后，在 [`routes`] 中加上
/// `.route("/product/brand/list", get(brand_list))` 即可启用本实现。
#[allow(dead_code)] // 品牌列表的权威实现（主会话已从 catalog.rs 去重并启用本实现）
async fn brand_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<BrandListQuery>,
) -> ApiResult<PageResult<BrandVO>> {
    // 店铺账号强制本店；平台账号可用 shopId 筛选（resolve_shop_scope 内已做 403）
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    ok(state.catalog.brand.list(&q).await?)
}

/// `GET /adminapi/product/brand/detail?id=`：品牌详情。
///
/// 对应 Java `BrandController.detail`（`@RequestParam Integer id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn brand_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<BrandDTO> {
    let detail = state.catalog.brand.detail(q.id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    ok(detail)
}

/// `POST /adminapi/product/brand/del`：删除品牌。
///
/// 对应 Java `BrandController.del`（`OperateDTO`，取 `id`）。
async fn brand_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("ID不能为空".into()))?;
    let detail = state.catalog.brand.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    state.catalog.brand.delete(id).await?;
    ok("删除成功")
}

/// `POST /adminapi/product/brand/create`：创建品牌。
///
/// 对应 Java `BrandController.create`：返回**提示语文本**
/// （平台「添加成功」/ 店铺「添加成功,等待管理员审核」，
/// Java 语义由 `HeaderUtils.getShopId()` 决定，见模块头的多租户说明）。
async fn brand_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BrandDTO>,
) -> ApiResult<String> {
    // 写操作归属由登录态决定：店铺账号固定本店（请求体他店 → 403）；
    // 平台账号可用请求体 shopId 代建，未传则平台品牌 shop_id = 0。
    let shop_id = auth.resolve_shop_scope(dto.shop_id)?.unwrap_or(0);
    state.catalog.brand.create(&dto, shop_id).await?;
    ok(if shop_id > 0 {
        "添加成功,等待管理员审核".to_string()
    } else {
        "添加成功".to_string()
    })
}

/// `POST /adminapi/product/brand/update`：更新品牌。
///
/// 对应 Java `BrandController.update`，返回提示语
/// （Java：`shopId > 0` → 「修改成功,等待管理员审核」，否则「修改成功」）。
///
/// 说明：请求体里的 `shopId` **只用于挑选提示语与店铺审核语义**，
/// 不会写进 `brand.shop_id`（服务层保留库中原值）——与 Java 一致，
/// Java 的实体 `Brand` 没有 `shopId` 之外的同名 DTO 属性可覆盖，
/// 且 `updateById` 里的 `shopId` 来自请求头。见模块头多租户说明。
async fn brand_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BrandDTO>,
) -> ApiResult<&'static str> {
    let id = dto
        .brand_id
        .ok_or_else(|| tigshop_core::Error::Validation("ID不能为空".into()))?;
    let detail = state.catalog.brand.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    let shop_id = auth.resolve_shop_scope(dto.shop_id)?.unwrap_or(0);
    state.catalog.brand.update(&dto, shop_id).await?;
    ok(if shop_id > 0 {
        "修改成功,等待管理员审核"
    } else {
        "修改成功"
    })
}

/// `POST /adminapi/product/brand/updateField`：更新品牌字段。
///
/// 对应 Java `BrandController.updateField`（`UpdateFieldDTO` +
/// `BRAND_FIELDS` 白名单）。
async fn brand_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("ID不能为空".into()))?;
    let detail = state.catalog.brand.detail(id).await?;
    tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
    let field = dto
        .field
        .ok_or_else(|| tigshop_core::Error::Validation("字段名不能为空".into()))?;
    let val = dto
        .val
        .ok_or_else(|| tigshop_core::Error::Validation("字段值不能为空".into()))?;
    ok(state.catalog.brand.update_field(id, &field, &val).await?)
}

/// `POST /adminapi/product/brand/batch`：批量操作。
///
/// 对应 Java `BrandController.batch`（`BatchDTO`，仅支持 `type = "del"`）。
async fn brand_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<u64> {
    let ids = dto.ids.unwrap_or_default();
    if dto.r#type.as_deref() == Some("del") {
        for id in &ids {
            let detail = state.catalog.brand.detail(*id).await?;
            tenant::ensure_row_shop_opt(&auth, detail.shop_id)?;
        }
    }
    ok(state
        .catalog
        .brand
        .batch(&ids, dto.r#type.as_deref())
        .await?)
}

/// `GET /adminapi/product/brand/search`：品牌搜索（下拉数据）。
///
/// 对应 Java `BrandController.search`（返回 `BrandSearchVO`）。
async fn brand_search(State(state): State<AdminState>) -> ApiResult<BrandSearchVO> {
    ok(state.catalog.brand.search().await?)
}

/// `POST /adminapi/product/brand/updateFirstWord`：批量重算首字母。
///
/// 对应 Java `BrandController.updateFirstWord`（无请求体，返回 `void`）。
/// Java 前端拿不到返回值，这里额外带 `updated` 计数便于运维排查，
/// 不影响契约结构（`data` 为对象而非 void）。
async fn brand_update_first_word(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<serde_json::Value> {
    if !auth.is_platform() {
        return Err(tigshop_core::Error::Forbidden("仅平台账号可重算品牌首字母".into()).into());
    }
    let updated = state.catalog.brand.update_first_word().await?;
    ok(serde_json::json!({ "updated": updated }))
}

/// `GET /adminapi/product/brand/auditList`：品牌审核列表。
///
/// 对应 Java `BrandController.auditList`：复用 `list` 查询，
/// 强制 `isAudit = 1`（只看店铺品牌）。
async fn brand_audit_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<BrandListQuery>,
) -> ApiResult<PageResult<BrandVO>> {
    q.shop_id = tenant::list_scope(&auth, q.shop_id)?;
    q.is_audit = Some(1);
    ok(state.catalog.brand.list(&q).await?)
}

/// `POST /adminapi/product/brand/audit`：品牌审核。
///
/// 对应 Java `BrandController.audit`（`BrandAuditDTO`）。
async fn brand_audit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BrandAuditDTO>,
) -> ApiResult<&'static str> {
    if !auth.is_platform() {
        return Err(tigshop_core::Error::Forbidden("仅平台账号可审核品牌".into()).into());
    }
    state.catalog.brand.audit(&dto).await?;
    ok("审核成功")
}

/// `GET /adminapi/product/brand/auditWaitNum`：待审核数量。
///
/// 对应 Java `BrandController.auditWaitNum`（返回 `Long`）。
async fn brand_audit_wait_num(State(state): State<AdminState>) -> ApiResult<i64> {
    ok(state.catalog.brand.audit_wait_num().await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须与 Java 契约逐字符一致：
    /// 12 条、前缀 `/adminapi`、method 大小写敏感、路径大小写敏感
    /// （`updateField` / `updateFirstWord` / `auditList` / `auditWaitNum` 易写错）。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 12, "契约中 brand 域共 12 条接口");

        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();

        let expected = [
            ("GET", "/adminapi/product/brand/list"),
            ("GET", "/adminapi/product/brand/detail"),
            ("POST", "/adminapi/product/brand/del"),
            ("POST", "/adminapi/product/brand/create"),
            ("POST", "/adminapi/product/brand/update"),
            ("POST", "/adminapi/product/brand/updateField"),
            ("POST", "/adminapi/product/brand/batch"),
            ("GET", "/adminapi/product/brand/search"),
            ("POST", "/adminapi/product/brand/updateFirstWord"),
            ("GET", "/adminapi/product/brand/auditList"),
            ("POST", "/adminapi/product/brand/audit"),
            ("GET", "/adminapi/product/brand/auditWaitNum"),
        ];
        for (method, path) in expected {
            assert!(
                actual.iter().any(|(m, p)| m == method && p == path),
                "缺少 {method} {path}"
            );
        }
        // 不允许有重复声明（路由表改错时会暴露）
        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            actual.len(),
            "implemented_routes() 存在重复项"
        );
    }

    /// 回归守卫：本模块的路径表必须**恰好** 12 条且互不重复，
    /// 避免 `/list` 之类的重复声明（catalog.rs 曾与本模块重复注册同一路径，
    /// axum `Router::merge` 会因此 panic）。
    #[test]
    fn route_table_has_no_duplicates() {
        assert_eq!(ROUTE_TABLE.len(), 12);
        for (i, (m, p, _)) in ROUTE_TABLE.iter().enumerate() {
            assert!(p.starts_with("/product/brand/"), "路径必须以控制器前缀开头");
            assert!(*m == "GET" || *m == "POST");
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((m, p), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// `routes()` 中注册的路径每条都必须在 [`ROUTE_TABLE`] 内（反之 `/list`
    /// 是唯一允许未注册的例外）。
    /// `routes()` 中注册的路径必须与 [`ROUTE_TABLE`] 完全一致（12/12）。
    ///
    /// 历史：`/product/brand/list` 曾因与 `catalog.rs` 重复注册而暂时未挂载；
    /// 主会话已把该条从 `catalog.rs` 移除，本域现为品牌域唯一归属，
    /// 故 `routes()` 必须注册全部 12 条。
    #[test]
    fn routes_registers_all_table_paths() {
        // `routes()` 用字面量注册，这里以字符串形式复述同一份清单：
        // 若有人改了 `routes()` 却忘了改 ROUTE_TABLE，本测试即刻失败。
        let registered = [
            "/product/brand/list",
            "/product/brand/detail",
            "/product/brand/del",
            "/product/brand/create",
            "/product/brand/update",
            "/product/brand/updateField",
            "/product/brand/batch",
            "/product/brand/search",
            "/product/brand/updateFirstWord",
            "/product/brand/auditList",
            "/product/brand/audit",
            "/product/brand/auditWaitNum",
        ];
        assert_eq!(registered.len(), ROUTE_TABLE.len());
        for path in registered {
            assert!(
                ROUTE_TABLE.iter().any(|(_, p, _)| *p == path),
                "{path} 不在 ROUTE_TABLE 内"
            );
        }
        // 反向校验：ROUTE_TABLE 里每条都被 routes() 注册（防止漏挂）
        for (_, p, _) in ROUTE_TABLE.iter() {
            assert!(registered.contains(p), "{p} 未在 routes() 中注册");
        }
    }
    /// 多租户隔离：店铺账号跨店 shopId 必须 403，列表强制本店过滤。
    #[test]
    fn tenant_scope_rejects_cross_shop_and_forces_list_filter() {
        let shop = AuthUser {
            id: 7,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(3),
        };
        assert_eq!(tenant::list_scope(&shop, None).unwrap(), Some(3));
        assert!(tenant::list_scope(&shop, Some(9)).is_err());
        assert!(tenant::ensure_row_shop_opt(&shop, Some(9)).is_err());
        assert!(tenant::ensure_row_shop_opt(&shop, Some(3)).is_ok());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(tenant::list_scope(&platform, None).unwrap(), None);
        assert_eq!(tenant::list_scope(&platform, Some(9)).unwrap(), Some(9));
    }
}
