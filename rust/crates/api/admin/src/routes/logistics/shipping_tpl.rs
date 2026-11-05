//! 管理端运费模板路由（切片 logistics::shipping_tpl）。
//!
//! 对应原 Java：
//! `com.tigshop.adminapi.controller.setting.ShippingTplController`
//! （`@RequestMapping("/adminapi/setting/shippingTpl")`，111 行）
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /setting/shippingTpl/detail` | `ShippingTplController.detail` | `shippingTplManage` / `shopShippingTplManage` |
//! | `POST /setting/shippingTpl/create` | `ShippingTplController.create` | `shippingTplUpdateManage` |
//! | `POST /setting/shippingTpl/update` | `ShippingTplController.update` | `shippingTplUpdateManage` |
//! | `POST /setting/shippingTpl/del` | `ShippingTplController.del` | `shippingTplDelManage` |
//! | `POST /setting/shippingTpl/updateField` | `ShippingTplController.updateField` | `shippingTplUpdateManage` |
//! | `POST /setting/shippingTpl/batch` | `ShippingTplController.batch` | `shippingTplBatchManage` |
//! | `GET  /setting/shippingTpl/config` | `ShippingTplController.config` | `shippingTplManage` / `shopShippingTplManage` |
//! | `POST /setting/shippingTpl/setDefault` | `ShippingTplController.setDefault` | `shippingTplUpdateManage` |
//!
//! 原 Java 路径对照（类级 `@RequestMapping` + 方法级注解拼接后的**完整路径**，
//! 必须逐字符一致）：
//!
//! ```text
//! /adminapi/setting/shippingTpl/detail       ← @GetMapping("/detail")
//! /adminapi/setting/shippingTpl/create       ← @PostMapping("/create")
//! /adminapi/setting/shippingTpl/update       ← @PostMapping("/update")
//! /adminapi/setting/shippingTpl/del          ← @PostMapping("/del")
//! /adminapi/setting/shippingTpl/updateField  ← @PostMapping("/updateField")
//! /adminapi/setting/shippingTpl/batch        ← @PostMapping("/batch")
//! /adminapi/setting/shippingTpl/config       ← @GetMapping("/config")
//! /adminapi/setting/shippingTpl/setDefault   ← @PostMapping("/setDefault")
//! ```
//!
//! ⚠️ 本域**路径中没有控制器前缀重复**（不像 `/product/product/...`）：
//! 类级前缀是 `/setting/shippingTpl`，方法级是 `/detail` 等。
//!
//! > **权限说明**：Java 用类级 `@PreAuthorize("@pms.hasPermission(
//! > 'shippingTplManage','shopShippingTplManage')")` + 方法级
//! > `@PreAuthorize` 做权限校验；Rust 侧 `require_auth` 目前只校验登录态，
//! > 权限矩阵未实现（与本仓其它域一致的已知缺口）。上表权限列仅作对照记录。
//! >
//! > **多租户说明**：Java 通过 `HeaderUtils.getShopId()`（请求头）区分平台
//! > 与店铺账号，并据此覆盖查询条件 / 入库 `shopId` / 校验模板归属。
//! > Rust 侧 JWT 尚未签发 `shop_id`，故本模块统一传 `None`
//! > （= 平台账号语义：查询不过滤、入库 `shop_id = 0`、
//! > `setDefault` 不做归属校验），待鉴权中间件补齐后从 JWT 填充。
//!
//! > **不确定点**（详见 `uncertain_points`）：
//! > 1. `config` 在 Java 里是**硬编码桩**（不查 `shipping_type` 表，
//! >    固定返回 1 条只有 `shippingTypeId = 1` 的空壳），本实现逐字复刻；
//! > 2. `updateField` 的 Java 白名单含 3 个**不存在的列**
//! >    （`is_show` / `sort_order` / `status`），本实现提前返回 400
//! >    而不是让 MySQL 报 500；
//! > 3. `update` 不校验模板归属店铺（越权面），本实现逐字复刻；
//! > 4. `detail` 返回的 `shippingType` 是 `new ShippingType()` 空壳。

use axum::{
    extract::{Extension, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::Query;

use tigshop_core::models::logistics::shipping_tpl::{
    BatchDTO, DetailQuery, OperateDTO, SetDefaultQuery, ShippingTplSaveDTO, ShippingTplUpdateDTO,
    ShippingTplVO, ShippingTypeVO, UpdateFieldDTO,
};
use tigshop_security::web::{client_ip, ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 运费模板域管理端路由（挂载于 `/adminapi` 下）。
///
/// 8 条路径逐字符对应 Java `ShippingTplController` 的
/// `@RequestMapping("/adminapi/setting/shippingTpl")` + 方法级映射。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/shippingTpl/detail", get(detail))
        .route("/setting/shippingTpl/create", post(create))
        .route("/setting/shippingTpl/update", post(update))
        .route("/setting/shippingTpl/del", post(del))
        .route("/setting/shippingTpl/updateField", post(update_field))
        .route("/setting/shippingTpl/batch", post(batch))
        .route("/setting/shippingTpl/config", get(config))
        .route("/setting/shippingTpl/setDefault", post(set_default))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/shippingTpl/detail",
            "ShippingTplController.detail",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/create",
            "ShippingTplController.create",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/update",
            "ShippingTplController.update",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/del",
            "ShippingTplController.del",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/updateField",
            "ShippingTplController.updateField",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/batch",
            "ShippingTplController.batch",
        ),
        (
            "GET",
            "/adminapi/setting/shippingTpl/config",
            "ShippingTplController.config",
        ),
        (
            "POST",
            "/adminapi/setting/shippingTpl/setDefault",
            "ShippingTplController.setDefault",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// 当前店铺 ID（多租户）。
///
/// Java 走 `HeaderUtils.getShopId()`（请求头）。Rust 侧 JWT 尚未签发
/// `shop_id`，故一律返回 `None`（平台账号语义）。
/// 鉴权中间件补齐后，这里改为从 `AdminState` / 请求扩展中读取即可，
/// **服务层与仓储层无需改动**（它们的签名已经是 `Option<i32>`）。
#[inline]
fn current_shop_id(auth: &AuthUser) -> Option<i32> {
    // 店铺/门店/POS 账号 → 本店；平台账号 → None（Java HeaderUtils.getShopId() 平台为 null）
    auth.scoped_shop_id()
}

/// `GET /adminapi/setting/shippingTpl/detail?id=`：运费模板详情。
///
/// 对应 Java `ShippingTplController.detail`
/// （`@RequestParam(value = "id") @NotNull Integer id`）。
///
/// Java 在模板不存在时抛 `GlobalException("该运费模板不存在")`，
/// 本实现映射为同文案的校验错误（与 order_admin/005/017 的既有约定一致）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<DetailQuery>,
) -> ApiResult<ShippingTplVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("运费模板ID不能为空".into()))?;
    let owner = state.logistics.shipping_tpl.shop_id_of(id).await?;
    tenant::ensure_row_shop_opt(&auth, owner)?;
    ok(state.logistics.shipping_tpl.detail(&q).await?)
}

/// `POST /adminapi/setting/shippingTpl/create`：创建运费模板。
///
/// 对应 Java `ShippingTplController.create`（`@RequestBody ShippingTplSaveParam`）。
/// Java 原方法返回 `void`，这里回传新建主键便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ShippingTplSaveDTO>,
) -> ApiResult<i32> {
    ok(state
        .logistics
        .shipping_tpl
        .create(&dto, current_shop_id(&auth), auth.id, &client_ip(&headers))
        .await?)
}

/// `POST /adminapi/setting/shippingTpl/update`：更新运费模板。
///
/// 对应 Java `ShippingTplController.update`
/// （`@RequestBody ShippingTplUpdateDTO`）。
///
/// ⚠️ 入参类型是 `ShippingTplUpdateDTO`（与 create 的 `ShippingTplSaveParam`
/// **不是同一个类**），字段更全：含 `id` / `isFree` / `pricingType` /
/// `shippingTime` / `shopId` 等。
/// Java 原方法返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<ShippingTplUpdateDTO>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .shipping_tpl
        .update(&dto, current_shop_id(&auth), auth.id, &client_ip(&headers))
        .await?)
}

/// `POST /adminapi/setting/shippingTpl/del`：删除运费模板。
///
/// 对应 Java `ShippingTplController.del`（`@RequestBody OperateDTO`）→
/// `shippingTplService.del(operateDTO.getId())` → `removeById`（硬删除）。
///
/// ⚠️ Java 不级联删除 `shipping_tpl_info` 子表记录（留下孤儿行），
/// 本实现逐字复刻。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("运费模板ID不能为空".into()))?;
    let owner = state.logistics.shipping_tpl.shop_id_of(id).await?;
    tenant::ensure_row_shop_opt(&auth, owner)?;
    ok(state.logistics.shipping_tpl.del(&dto).await?)
}

/// `POST /adminapi/setting/shippingTpl/updateField`：更新单个字段。
///
/// 对应 Java `ShippingTplController.updateField`（`@RequestBody UpdateFieldDTO`）
/// → `shippingTplService.updateField(updateField, FIELDS)`。
///
/// ⚠️ Java 白名单 `FIELDS = {is_show, sort_order, status, shipping_tpl_name}`
/// 里**只有 `shipping_tpl_name` 是真实列**；其余三个会让 MySQL 报
/// `Unknown column`（500）。本实现提前返回 `字段值不合法`（400）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("运费模板ID不能为空".into()))?;
    let owner = state.logistics.shipping_tpl.shop_id_of(id).await?;
    tenant::ensure_row_shop_opt(&auth, owner)?;
    ok(state.logistics.shipping_tpl.update_field(&dto).await?)
}

/// `POST /adminapi/setting/shippingTpl/batch`：批量操作。
///
/// 对应 Java `ShippingTplController.batch`（`@RequestBody BatchDTO`）→
/// `BaseServiceImpl#batch`。仅 `type == "del"` 生效，其余**静默返回 false**。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    if dto.r#type == "del" {
        for id in &dto.ids {
            let owner = state.logistics.shipping_tpl.shop_id_of(*id).await?;
            tenant::ensure_row_shop_opt(&auth, owner)?;
        }
    }
    ok(state.logistics.shipping_tpl.batch(&dto).await?)
}

/// `GET /adminapi/setting/shippingTpl/config`：获取运费模板（运送方式下拉）。
///
/// 对应 Java `ShippingTplController.config` →
/// `ShippingTypeServiceImpl#getShippingTypeListByShopId`。
///
/// ⚠️⚠️ **Java 该链路是硬编码桩，根本不查 `shipping_type` 表**：
/// 固定返回 1 条 `{ "shippingTypeId": 1, 其余字段全 null }`。
/// 本实现逐字复刻（不查库），以免 Rust 与 Java 行为不一致；
/// 「查库的真实实现」保留在
/// `ShippingTplService::config_from_db`，待产品确认后一行切换。
async fn config(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<Vec<ShippingTypeVO>> {
    ok(state
        .logistics
        .shipping_tpl
        .config(current_shop_id(&auth))?)
}

/// `POST /adminapi/setting/shippingTpl/setDefault?id=`：设置默认运费模板。
///
/// 对应 Java `ShippingTplController.setDefault`
/// （`@RequestParam(value = "id", required = true) Long id`）。
///
/// ⚠️ Java 的 `id` 是 **`@RequestParam`（查询串）而非 `@RequestBody`**，
/// 因此本路由用 `Query` 提取（axum 的 `Query` 对 `POST` 同样有效）。
async fn set_default(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(q): Query<SetDefaultQuery>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .shipping_tpl
        .set_default(&q, current_shop_id(&auth), auth.id, &client_ip(&headers))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 8 条路由的**完整路径**必须与 Java 拼接结果逐字符一致。
    #[test]
    fn route_paths_match_java_verbatim() {
        let docs = implemented_routes();
        // `RouteDoc.method` / `RouteDoc.path` 是 `String`，故此处用 `Vec<(String, String)>`
        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let expected: Vec<(String, String)> = vec![
            ("GET", "/adminapi/setting/shippingTpl/detail"),
            ("POST", "/adminapi/setting/shippingTpl/create"),
            ("POST", "/adminapi/setting/shippingTpl/update"),
            ("POST", "/adminapi/setting/shippingTpl/del"),
            ("POST", "/adminapi/setting/shippingTpl/updateField"),
            ("POST", "/adminapi/setting/shippingTpl/batch"),
            ("GET", "/adminapi/setting/shippingTpl/config"),
            ("POST", "/adminapi/setting/shippingTpl/setDefault"),
        ]
        .into_iter()
        .map(|(m, p)| (m.to_string(), p.to_string()))
        .collect();
        assert_eq!(actual, expected);
        assert_eq!(docs.len(), 8);
    }

    /// 本域路径**没有**控制器前缀重复（区别于 `/product/product/...`）。
    #[test]
    fn no_duplicated_controller_prefix() {
        for d in implemented_routes() {
            assert!(
                d.path.starts_with("/adminapi/setting/shippingTpl/"),
                "{} 前缀不符",
                d.path
            );
            assert!(
                !d.path.contains("shippingTpl/shippingTpl"),
                "{} 不应出现重复前缀",
                d.path
            );
        }
    }

    /// 每个 RouteDoc 都标了对应的 Java handler。
    #[test]
    fn route_docs_carry_java_handler() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("ShippingTplController."),
                "{} 的 java_ref 不符: {}",
                d.path,
                d.java_ref
            );
        }
    }

    /// 多租户占位：鉴权中间件未接入前恒为 `None`（平台账号语义）。
    #[test]
    fn shipping_tpl_scope_comes_from_auth() {
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(current_shop_id(&platform), None);
        let shop = AuthUser {
            id: 2,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(6),
        };
        assert_eq!(current_shop_id(&shop), Some(6));
        assert!(tenant::ensure_row_shop_opt(&shop, Some(9)).is_err());
    }
}
