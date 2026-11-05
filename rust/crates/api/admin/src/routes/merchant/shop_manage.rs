//! 管理端店铺信息路由（merchant::shop_manage）。
//! 对应原 Java `com.tigshop.adminapi.controller.shop.ShopController`
//! （`@RequestMapping("/adminapi/merchant/shop")`）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/merchant/shop/list` | `ShopController.list` | 登录 |
//! | `GET  /adminapi/merchant/shop/detail` | `ShopController.detail` | 登录 |
//! | `GET  /adminapi/merchant/shop/currentDetail` | `ShopController.currentShop` | 登录 |
//! | `POST /adminapi/merchant/shop/create` | `ShopController.create` | `merchantShopModifyManage` 等 3 项 |
//! | `POST /adminapi/merchant/shop/update` | `ShopController.update` | `merchantShopModifyManage` 等 3 项 |
//! | `POST /adminapi/merchant/shop/del` | `ShopController.del` | 登录 |
//! | `POST /adminapi/merchant/shop/updateField` | `ShopController.updateField` | `merchantShopModifyManage` 等 3 项 |
//! | `POST /adminapi/merchant/shop/batch` | `ShopController.batch` | 登录 |
//! | `GET  /adminapi/merchant/shop/myShop` | `ShopController.myShop` | 登录 |
//! | `POST /adminapi/merchant/shop/setPosLoginDefault` | `ShopController.setPosLoginDefault` | 契约标 `anonymous`（见下方说明） |
//! | `POST /adminapi/merchant/shop/recordLoginSystem` | `ShopController.recordLoginSystem` | 契约标 `anonymous`（同上） |
//! | `POST /adminapi/merchant/shop/choose` | `ShopController.choose` | 登录 |
//! | `GET  /adminapi/merchant/shop/shopList` | `ShopController.shopList` | 登录 |
//! | `GET  /adminapi/merchant/shop/staffShow` | `ShopController.staffShow` | 登录 |
//! | `POST /adminapi/merchant/shop/updateInfo` | `ShopController.updateInfo` | `…,shopSettingsUpdateManage` |
//! | `POST /adminapi/merchant/shop/setting` | `ShopController.setting` | `merchantShopModifyManage` 等 3 项 |
//! | `GET  /adminapi/merchant/shop/getVendorSetting` | `ShopController.getVendorSetting` | `…,vendorSetting` |
//! | `POST /adminapi/merchant/shop/updateVendorSetting` | `ShopController.updateVendorSetting` | `merchantShopModifyManage` 等 3 项 |
//! | `GET  /adminapi/merchant/shop/getStoreListByProductId` | `ShopController.getStoreListByProductId` | 登录 |
//! | `POST /adminapi/merchant/shop/delShop` | `ShopController.delShop` | `merchantShopModifyManage` 等 3 项 |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在方法级
//! > 校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs / brand.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//! >
//! > **`anonymous` 说明**：契约里 `setPosLoginDefault` / `recordLoginSystem`
//! > 的 `auth` 标为 `anonymous`，但这两个 Java 方法都依赖
//! > `SecurityUtils.getCurrentAdminId()`，未登录时拿不到管理员；
//! > 因此本模块把它们并入 `/adminapi` 的受保护路由（需要 JWT），
//! > 这与 Java 的实际行为一致，但**与契约的 `auth` 标注不符**。
//! >
//! > **⚠️ 合并必读（路由冲突）**：`crates/api/admin/src/routes/shop.rs`
//! > （共享文件）已注册以下 **3 条完全相同的路径 + method**：
//! > - `GET  /merchant/shop/list`   → `shop::shop_list`
//! > - `GET  /merchant/shop/detail` → `shop::shop_detail`
//! > - `POST /merchant/shop/update` → `shop::shop_update`
//! >
//! > axum 0.8 的 `Router::merge` 对「同路径 + 同 method」重复注册**直接 panic**
//! > （`Overlapping method route`），而 `routes/mod.rs::merge_all` 会把两者都
//! > 合并 → **服务启动即崩**。处置（与 brand.rs 面对 catalog.rs 冲突时一致）：
//! > **`routes()` 中暂不注册这 3 条**，由 shop.rs 现有实现响应，保证服务能启动；
//! > 但 `implemented_routes()` 仍声明它们（契约覆盖率不受影响）。
//! > 本文件底部的 3 个 handler 已写好，作为**合并目标**保留。
//! >
//! > 主会话合并时请二选一：
//! > 1. **推荐**：删除 `routes/shop.rs` 中的
//! >    `.route("/merchant/shop/list", get(shop_list))` /
//! >    `.route("/merchant/shop/detail", get(shop_detail))` /
//! >    `.route("/merchant/shop/update", post(shop_update))` 三行，以及
//! >    `shop::implemented_routes()` 里对应的三条记录，然后在 [`routes`]
//! >    中恢复本模块这 3 条注册。理由：`shop.rs` 版本返回的是
//! >    `models::shop::ShopVO`（字段更少：无 `statusText` 之外的
//! >    `kefuInlet` / `shipInfo` / `receiveInfo` / `tips` / `adminUserShop`
//! >    / `lastLoginTime` 等），且 `update` 不处理 `checkStoreParam`
//! >    与门店标签 `store_tip`，无法满足前端契约。
//! > 2. 或保持现状（shop.rs 继续响应这 3 条），把本模块的 3 个 handler
//! >    与 `implemented_routes()` 中的重复声明一并删除。
//! >
//! > **登录态店铺（多租户）说明**：Java 用 `HeaderUtils.getShopId()`
//! > （`x-shop-id` 请求头）判断「当前店铺」。Rust JWT 尚未签发该字段，
//! > 因此本模块用**查询参数 / 请求体里的 `shopId`** 替代：
//! > `currentDetail` / `staffShow` / `updateInfo` / `setting` /
//! > `getVendorSetting` / `updateVendorSetting` 均需要显式传 `shopId`。
//! > 这**不是等价实现**（平台账号可伪装店铺视角；店铺账号不传时按平台处理）。
//! > 详见 `ShopManageService` 模块头第 1 条。
//! >
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus 的 `Page<ShopVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`），与 product_manage/002/005 一致。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::merchant::shop_manage::{
    BatchDTO, LoginChooseParam, OperateDTO, PosLoginSettingPayload, ShopListQuery,
    ShopSettingPayload, ShopVO, ShopWritePayload, StaffShowVO, StoreListVO, UpdateFieldDTO,
    VendorSettingUpdateParam, VendorSettingVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser, TenantContext};

use crate::AdminState;

/// 本域全部 20 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 `implemented_routes()` 的唯一来源**（声明与 Java 契约的对应关系）。
/// [`routes`] 因 3 条路径与共享的 `shop.rs` 冲突而单独用字面量注册，
/// 见模块头「合并必读」。
const ROUTE_TABLE: [(&str, &str, &str); 20] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/merchant/shop/list", "ShopController.list"),
    ("GET", "/merchant/shop/detail", "ShopController.detail"),
    (
        "GET",
        "/merchant/shop/currentDetail",
        "ShopController.currentShop",
    ),
    ("POST", "/merchant/shop/create", "ShopController.create"),
    ("POST", "/merchant/shop/update", "ShopController.update"),
    ("POST", "/merchant/shop/del", "ShopController.del"),
    (
        "POST",
        "/merchant/shop/updateField",
        "ShopController.updateField",
    ),
    ("POST", "/merchant/shop/batch", "ShopController.batch"),
    ("GET", "/merchant/shop/myShop", "ShopController.myShop"),
    (
        "POST",
        "/merchant/shop/setPosLoginDefault",
        "ShopController.setPosLoginDefault",
    ),
    (
        "POST",
        "/merchant/shop/recordLoginSystem",
        "ShopController.recordLoginSystem",
    ),
    ("POST", "/merchant/shop/choose", "ShopController.choose"),
    ("GET", "/merchant/shop/shopList", "ShopController.shopList"),
    (
        "GET",
        "/merchant/shop/staffShow",
        "ShopController.staffShow",
    ),
    (
        "POST",
        "/merchant/shop/updateInfo",
        "ShopController.updateInfo",
    ),
    ("POST", "/merchant/shop/setting", "ShopController.setting"),
    (
        "GET",
        "/merchant/shop/getVendorSetting",
        "ShopController.getVendorSetting",
    ),
    (
        "POST",
        "/merchant/shop/updateVendorSetting",
        "ShopController.updateVendorSetting",
    ),
    (
        "GET",
        "/merchant/shop/getStoreListByProductId",
        "ShopController.getStoreListByProductId",
    ),
    ("POST", "/merchant/shop/delShop", "ShopController.delShop"),
];

/// 店铺信息域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// ⚠️ `/merchant/shop/list`、`/merchant/shop/detail`、
/// `/merchant/shop/update` **目前故意未注册**：`routes/shop.rs` 已注册
/// 同一路径 + 同一 method，axum 0.8 对重叠路由直接 panic（详见模块头）。
/// 删掉 shop.rs 那三条后，在此恢复对应注册即可启用本模块实现。
///
/// **多租户参数说明**（JWT 无 `shop_id`，故以查询参数替代）：
/// - `currentDetail` / `staffShow` / `setting` / `updateInfo` /
///   `getVendorSetting` / `updateVendorSetting`：`?shopId=`
/// - `list` / `myShop`：`?shopId=` 可选（Java 用请求头 `x-shop-id`）
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // TODO(合并): shop.rs 的重复注册删除后恢复下面这行
        // .route("/merchant/shop/list", get(shop_list))
        // TODO(合并): shop.rs 的重复注册删除后恢复下面这行
        // .route("/merchant/shop/detail", get(shop_detail))
        .route("/merchant/shop/currentDetail", get(shop_current_detail))
        .route("/merchant/shop/create", post(shop_create))
        // TODO(合并): shop.rs 的重复注册删除后恢复下面这行
        // .route("/merchant/shop/update", post(shop_update))
        .route("/merchant/shop/del", post(shop_del))
        .route("/merchant/shop/updateField", post(shop_update_field))
        .route("/merchant/shop/batch", post(shop_batch))
        .route("/merchant/shop/myShop", get(shop_my_shop))
        .route(
            "/merchant/shop/setPosLoginDefault",
            post(shop_set_pos_login_default),
        )
        .route(
            "/merchant/shop/recordLoginSystem",
            post(shop_record_login_system),
        )
        .route("/merchant/shop/choose", post(shop_choose))
        .route("/merchant/shop/shopList", get(shop_list_picker))
        .route("/merchant/shop/staffShow", get(shop_staff_show))
        .route("/merchant/shop/updateInfo", post(shop_update_info))
        .route("/merchant/shop/setting", post(shop_setting))
        .route(
            "/merchant/shop/getVendorSetting",
            get(shop_get_vendor_setting),
        )
        .route(
            "/merchant/shop/updateVendorSetting",
            post(shop_update_vendor_setting),
        )
        .route(
            "/merchant/shop/getStoreListByProductId",
            get(shop_store_list_by_product_id),
        )
        .route("/merchant/shop/delShop", post(shop_del_shop))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 含 `list` / `detail` / `update`：这三条在契约内且服务层已实现
/// （当前由共享的 `shop.rs` 响应，路径归属见模块头「合并必读」），
/// 在此声明避免覆盖率误报为「未实现」。
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

/// 店铺 ID 查询参数（替代 Java 请求头 `x-shop-id`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShopIdQuery {
    /// 店铺 ID（`currentDetail` / `staffShow` / `setting` / `updateInfo` /
    /// `getVendorSetting` / `updateVendorSetting` 必填）
    #[serde(default)]
    shop_id: Option<i32>,
}

/// `GET /adminapi/merchant/shop/list`：店铺分页。
///
/// 对应 Java `ShopController.list(ShopListDTO)` / `ShopServiceImpl#list`。
/// `?shopId=` 替代请求头 `x-shop-id`（见模块头多租户说明）。
///
/// ⚠️ 当前**未在本模块注册**（shop.rs 占用同一路径 + method），
/// 详见模块头「合并必读」。
#[allow(dead_code)] // 保留为店铺列表的权威实现，待 shop.rs 去重后启用
async fn shop_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(mut q): Query<ShopListQuery>,
) -> ApiResult<PageResult<ShopVO>> {
    // 多租户：店铺账号强制过滤自身店铺；平台可见全部（可选 shopId 过滤）。
    if let Some(scope) = tenant_shop(&tenant) {
        q.shop_id = Some(scope);
    }
    ok(state.merchant.shop_manage.list(&q, q.shop_id).await?)
}

/// `GET /adminapi/merchant/shop/detail?shopId=`：店铺详情（含评星 / 商品评分）。
///
/// 对应 Java `ShopController.detail(@RequestParam("shopId") Integer id)`。
///
/// ⚠️ 当前**未在本模块注册**（shop.rs 占用同一路径 + method），
/// 详见模块头「合并必读」。
#[allow(dead_code)]
async fn shop_detail(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
) -> ApiResult<ShopVO> {
    let _ = target_shop(&tenant, q.shop_id)?;
    let shop_id = q
        .shop_id
        .ok_or_else(|| tigshop_core::Error::Validation("店铺ID不能为空".into()))?;
    ok(state
        .merchant
        .shop_manage
        .detail_with_score(shop_id)
        .await?)
}

/// 当前账号的店铺范围（仅来自认证身份）。
#[must_use]
fn tenant_shop(tenant: &TenantContext) -> Option<i32> {
    tenant.shop_scope()
}

/// 平台级接口：店铺/供应商账号一律 403。
fn require_platform(tenant: &TenantContext) -> Result<(), AppError> {
    if tenant.is_shop_account() || tenant.is_vendor_account() {
        return Err(tigshop_core::Error::Forbidden("平台账号才可访问该接口".into()).into());
    }
    Ok(())
}

/// 解析目标店铺：店铺账号强制自身店铺（越权 → 403）；平台账号必须显式指定。
fn target_shop(tenant: &TenantContext, requested: Option<i32>) -> Result<i32, AppError> {
    match tenant.shop_scope() {
        Some(scope) => match requested.filter(|v| *v > 0) {
            Some(req) if req != scope => {
                Err(tigshop_core::Error::Forbidden(format!("无权访问店铺 {req} 的数据")).into())
            }
            _ => Ok(scope),
        },
        None => requested
            .filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Forbidden("平台账号必须指定店铺".into()).into()),
    }
}

/// `GET /adminapi/merchant/shop/currentDetail?shopId=`：当前登录用户的店铺信息。
///
/// 对应 Java `ShopController.currentShop()`：先刷新 `last_login_time`，
/// 再按「仅当前管理员」返回详情。
async fn shop_current_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
) -> ApiResult<ShopVO> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    ok(state
        .merchant
        .shop_manage
        .current_detail(shop_id, auth.id)
        .await?)
}

/// `POST /adminapi/merchant/shop/create`：创建店铺。
///
/// 对应 Java `ShopController.create(@Valid @RequestBody ShopCreateDTO)`；
/// Java 返回 `void`，此处返回新建店铺 ID 便于前端跳转。
/// `?shopId=` 表示「店铺后台内新建」（沿用当前店铺的商户）。
async fn shop_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
    Json(p): Json<ShopWritePayload>,
) -> ApiResult<serde_json::Value> {
    // 平台端“新增店铺”不传 shopId，表示从平台直接创建，不能按 403 拒绝；
    // 店铺账号仍强制自身店铺，传其它店铺继续拒绝。
    let scope = if tenant.shop_scope().is_some() {
        target_shop(&tenant, q.shop_id)?
    } else {
        q.shop_id.filter(|v| *v > 0).unwrap_or(0)
    };
    let shop_id = state
        .merchant
        .shop_manage
        .create(&p, auth.id, Some(scope))
        .await?;
    ok(serde_json::json!({ "shopId": shop_id }))
}

/// `POST /adminapi/merchant/shop/update`：更新店铺。
///
/// 对应 Java `ShopController.update(@RequestBody ShopUpdateDTO)`。
///
/// ⚠️ 当前**未在本模块注册**（shop.rs 占用同一路径 + method），
/// 详见模块头「合并必读」。
#[allow(dead_code)]
async fn shop_update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(p): Json<ShopWritePayload>,
) -> ApiResult<&'static str> {
    require_platform(&tenant)?;
    state.merchant.shop_manage.update(&p).await?;
    ok("修改成功")
}

/// `POST /adminapi/merchant/shop/del`：删除店铺（硬删）。
///
/// 对应 Java `ShopController.del(@RequestBody OperateDTO)`。
async fn shop_del(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<&'static str> {
    require_platform(&tenant)?;
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("ID不能为空".into()))?;
    state.merchant.shop_manage.delete(id).await?;
    ok("删除成功")
}

/// `POST /adminapi/merchant/shop/updateField`：更新单个字段。
///
/// 对应 Java `ShopController.updateField(@RequestBody UpdateFieldDTO)`，
/// 白名单为 `CheckFieldConstants.GENERAL_FIELDS`。
async fn shop_update_field(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    require_platform(&tenant)?;
    state.merchant.shop_manage.update_field(&dto).await?;
    ok("修改成功")
}

/// `POST /adminapi/merchant/shop/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `ShopController.batch(@RequestBody BatchDTO)`。
/// Java 返回 `void`；这里回传是否命中（`type` 非 `del` 由服务层报错）。
async fn shop_batch(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    require_platform(&tenant)?;
    ok(state.merchant.shop_manage.batch(&dto).await?)
}

/// `GET /adminapi/merchant/shop/myShop`：当前登录用户的店铺 / 供应商 / 账号信息。
///
/// 对应 Java `ShopController.myShop(ShopListDTO dto)`。
/// `?shopId=` 替代请求头（Java 用 `getShopId()` 判断是否平台视角）。
async fn shop_my_shop(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopListQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .merchant
        .shop_manage
        .my_shop(&q, auth.id, tenant_shop(&tenant))
        .await?)
}

/// `POST /adminapi/merchant/shop/setPosLoginDefault`：设置登录后默认进收银台。
///
/// 对应 Java `ShopController.setPosLoginDefault(@RequestBody PosLoginSettingDTO)`
/// → `AdminUserShopServiceImpl#setPosLoginDefault`。
async fn shop_set_pos_login_default(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(mut p): Json<PosLoginSettingPayload>,
) -> ApiResult<&'static str> {
    if let Some(scope) = tenant_shop(&tenant) {
        p.shop_id = Some(scope);
    }
    state
        .merchant
        .shop_manage
        .set_pos_login_default(&p, auth.id)
        .await?;
    ok("设置成功")
}

/// `POST /adminapi/merchant/shop/recordLoginSystem`：记录上次登录端。
///
/// 对应 Java `ShopController.recordLoginSystem(@RequestBody PosLoginSettingDTO)`
/// → `AdminUserShopServiceImpl#recordLoginSystem`（找不到绑定时静默成功）。
async fn shop_record_login_system(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Extension(tenant): Extension<TenantContext>,
    Json(mut p): Json<PosLoginSettingPayload>,
) -> ApiResult<&'static str> {
    if let Some(scope) = tenant_shop(&tenant) {
        p.shop_id = Some(scope);
    }
    state
        .merchant
        .shop_manage
        .record_login_system(&p, auth.id)
        .await?;
    ok("记录成功")
}

/// `POST /adminapi/merchant/shop/choose`：选择管理员 / 店铺 / 供应商或门店登录。
///
/// 对应 Java `ShopController.choose(@RequestBody LoginChooseParam)`
/// （`@Deprecated`）→ `ShopServiceImpl#choose`。
///
/// ⚠️ Java 会把权限清单写入 Redis（key `admin::auth::<adminId>`）；
/// Rust 侧无服务端会话，**不写缓存**，只回传校验后的权限清单。
async fn shop_choose(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(p): Json<LoginChooseParam>,
) -> ApiResult<serde_json::Value> {
    let (shop_view, authorities) = state.merchant.shop_manage.choose(&p, auth.id).await?;
    ok(serde_json::json!({
        "shopView": shop_view,
        "authorities": authorities,
        // Java 写入 Redis 的键名，便于前端/运维对照
        "cacheKey": format!("admin::auth::[{}]", auth.id),
    }))
}

/// `GET /adminapi/merchant/shop/shopList`：店铺标题与名称下拉列表。
///
/// 对应 Java `ShopController.shopList(ShopListDTO dto)`
/// → `ShopServiceImpl#getShopList`。
async fn shop_list_picker(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(mut q): Query<ShopListQuery>,
) -> ApiResult<Vec<serde_json::Value>> {
    if let Some(scope) = tenant_shop(&tenant) {
        q.shop_id = Some(scope);
    }
    let shops = state.merchant.shop_manage.shop_list(&q).await?;
    ok(shops
        .iter()
        .map(|s| {
            serde_json::json!({
                "shopId": s.shop_id,
                "shopTitle": s.shop_title,
                "shopType": s.shop_type,
                "status": s.status,
            })
        })
        .collect())
}

/// `GET /adminapi/merchant/shop/staffShow?shopId=`：员工展示信息。
///
/// 对应 Java `ShopController.staffShow()` → `ShopServiceImpl#staffShow`。
/// `?shopId=` 替代请求头 `x-shop-id`。
async fn shop_staff_show(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
) -> ApiResult<StaffShowVO> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    ok(state.merchant.shop_manage.staff_show(shop_id).await?)
}

/// `POST /adminapi/merchant/shop/updateInfo`：更新店铺信息。
///
/// 对应 Java `ShopController.updateInfo(@Valid @RequestBody ShopUpdateInfoDTO)`
/// → `ShopServiceImpl#updateInfo`（强校验 `dto.shopId == 当前店铺`，
/// 成功时 Java 返回本次 `updateById` 的 `Shop` 实体）。
/// `?shopId=` 替代请求头 `x-shop-id`。
///
/// ⚠️ Java 返回的是 `Shop` 实体，Jackson 按**属性名（camelCase）**序列化
/// （`shopId` / `shopTitle` / `shopLogo` / `storeParentId` …）。
/// `tigshop_core::entities::Shop` 用 `#[sqlx(rename_all = "snake_case")]`
/// 派生的是 **snake_case** 字段名（`shop_id` / `shop_title` …），
/// 直接序列化会与前端契约不符，故这里**显式映射为 camelCase**
/// （见 `shop_entity_json`）。实体本身不得修改（自动生成）。
async fn shop_update_info(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
    Json(p): Json<ShopWritePayload>,
) -> ApiResult<serde_json::Value> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    let shop = state
        .merchant
        .shop_manage
        .update_info(&p, Some(shop_id))
        .await?;
    ok(shop_entity_json(&shop))
}

/// `Shop` 实体 → 与 Java Jackson 一致的 camelCase JSON（`updateInfo` 的返回）。
///
/// 只列出 `ShopUpdateInfoDTO` 相关的字段子集 + 主键/状态；其余列前端未使用。
fn shop_entity_json(s: &tigshop_core::entities::Shop) -> serde_json::Value {
    serde_json::json!({
        "shopId": s.shop_id,
        "shopTitle": s.shop_title,
        "shopLogo": s.shop_logo,
        "status": s.status,
        "shopType": s.shop_type,
        "storeParentId": s.store_parent_id,
        "shopCoverPicture": s.shop_cover_picture,
        "description": s.description,
        "shopContactJson": s.shop_contact_json,
        "shopOpenCloseJson": s.shop_open_close_json,
        "shopRegionId": s.shop_region_id,
        "shopDetailedAddress": s.shop_detailed_address,
        "shopLongitude": s.shop_longitude,
        "shopLatitude": s.shop_latitude,
        "merchantId": s.merchant_id,
    })
}

/// `POST /adminapi/merchant/shop/setting`：更新店铺配置。
///
/// 对应 Java `ShopController.setting(@RequestBody ShopSettingDTO)`
/// → `ShopServiceImpl#setting`（含停业前置校验 + 商品下架）。
/// `?shopId=` 替代请求头 `x-shop-id`。
async fn shop_setting(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
    Json(p): Json<ShopSettingPayload>,
) -> ApiResult<&'static str> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    state
        .merchant
        .shop_manage
        .setting(&p, Some(shop_id))
        .await?;
    ok("设置成功")
}

/// `GET /adminapi/merchant/shop/getVendorSetting?shopId=`：获取供应商配置。
///
/// 对应 Java `ShopController.getVendorSetting()` → `ShopServiceImpl#getVendorSetting`。
/// `?shopId=` 替代请求头 `x-shop-id`。
async fn shop_get_vendor_setting(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
) -> ApiResult<VendorSettingVO> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    ok(state
        .merchant
        .shop_manage
        .get_vendor_setting(shop_id)
        .await?)
}

/// `POST /adminapi/merchant/shop/updateVendorSetting?shopId=`：保存供应商配置。
///
/// 对应 Java `ShopController.updateVendorSetting(@RequestBody
/// ShopVendorSettingUpdateParam)` → `ShopServiceImpl#updateVendorSetting`。
/// `?shopId=` 替代请求头 `x-shop-id`。
async fn shop_update_vendor_setting(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<ShopIdQuery>,
    Json(p): Json<VendorSettingUpdateParam>,
) -> ApiResult<&'static str> {
    let shop_id = target_shop(&tenant, q.shop_id)?;
    state
        .merchant
        .shop_manage
        .update_vendor_setting(shop_id, &p)
        .await?;
    ok("保存成功")
}

/// `GET /adminapi/merchant/shop/getStoreListByProductId?productId=`：
/// 获取商品对应的门店列表。
///
/// 对应 Java `ShopController.getStoreListByProductId(@RequestParam Integer productId)`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductIdQuery {
    product_id: Option<i32>,
}

async fn shop_store_list_by_product_id(
    State(state): State<AdminState>,
    Query(q): Query<ProductIdQuery>,
) -> ApiResult<Vec<StoreListVO>> {
    let product_id = q
        .product_id
        .filter(|v| *v > 0)
        .ok_or_else(|| tigshop_core::Error::Validation("商品ID不能为空".into()))?;
    ok(state
        .merchant
        .shop_manage
        .store_list_by_product_id(product_id)
        .await?)
}

/// `POST /adminapi/merchant/shop/delShop`：删除店铺 / 门店 / 自提点（软删除）。
///
/// 对应 Java `ShopController.delShop(@RequestBody OperateDTO)`
/// → `ShopServiceImpl#delShop`（返回 `boolean`）。
async fn shop_del_shop(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    require_platform(&tenant)?;
    ok(state.merchant.shop_manage.del_shop(&dto).await?)
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    fn platform() -> TenantContext {
        TenantContext::new(Some("admin".into()), None, None)
    }

    fn shop(shop_id: i32) -> TenantContext {
        TenantContext::new(Some("shop".into()), Some(shop_id), None)
    }

    fn vendor() -> TenantContext {
        TenantContext::new(Some("vendor".into()), None, Some(3))
    }

    /// 店铺账号读/写目标强制自身店铺；越权 shopId → 403。
    #[test]
    fn target_shop_is_forced_for_shop_account() {
        assert_eq!(target_shop(&shop(9), None).unwrap(), 9);
        assert_eq!(target_shop(&shop(9), Some(9)).unwrap(), 9);
        let err = target_shop(&shop(9), Some(8)).unwrap_err();
        assert!(err.0.to_string().contains("无权访问店铺 8"));
        // 平台必须显式指定
        assert!(target_shop(&platform(), None).is_err());
        assert_eq!(target_shop(&platform(), Some(3)).unwrap(), 3);
    }

    /// 平台专属写操作（del/updateField/batch/delShop）拒绝店铺/供应商账号。
    #[test]
    fn platform_only_writes() {
        assert!(require_platform(&platform()).is_ok());
        assert!(require_platform(&shop(9)).is_err());
        assert!(require_platform(&vendor()).is_err());
    }
}
