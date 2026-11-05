//! 管理端配送类型路由（logistics::shipping_type）。
//! 对应原 Java `com.tigshop.adminapi.controller.setting.ShippingTypeController`
//! （`@RequestMapping("/adminapi/setting/shippingType")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('shippingTypeManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /setting/shippingType/list`        | `ShippingTypeController.list`        | `shippingTypeManage` |
//! | `GET  /setting/shippingType/detail`      | `ShippingTypeController.detail`      | `shippingTypeManage` |
//! | `POST /setting/shippingType/create`      | `ShippingTypeController.create`      | `shippingTypeUpdateManage` |
//! | `POST /setting/shippingType/update`      | `ShippingTypeController.update`      | `shippingTypeUpdateManage` |
//! | `POST /setting/shippingType/del`         | `ShippingTypeController.del`         | `shippingTypeDelManage` |
//! | `POST /setting/shippingType/updateField` | `ShippingTypeController.updateField` | `shippingTypeUpdateManage` |
//! | `POST /setting/shippingType/batch`       | `ShippingTypeController.batch`       | `shippingTypeBatchManage` |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/setting/shippingType`，
//! > 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复。因此最终路径是
//! > `/adminapi/setting/shippingType/list`，与 `docs/api-contract.json`
//! > 逐字符一致。注意 `shippingType` 是**小驼峰**，必须照抄。
//!
//! > ⚠️ **`docs/slices.json` 漏登记了 `GET /list`**（该片只列了 6 条），
//! > 但 Java 控制器第 53 行确有 `@GetMapping("/list")`，契约里也有。
//! > 本实现按**契约**实现 7 条，否则该接口将永远无人实现
//! > （详见 `docs/registrations/sessionB-merge-notes.md`）。
//!
//! > **权限说明**：Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵
//! > 尚未实现（与 area_code / order_admin / seckill.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照记录。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<ShippingTypeVO>`，
//! > Rust 统一使用项目既有 `PageResult`，与 product_manage/002/075/163 一致。
//!
//! > **多租户说明（本域特别重要）**：Java `list` / `create` 用
//! > `getShopId()`（`x-admin-type` + `x-shop-id` 请求头）决定 `shop_id`，
//! > 且 `ShippingTypeListDTO.shopId` **是无效参数**（被服务层忽略）。
//! > 本实现同样以请求头为准，见 [`shop_id_from_headers`]。

use axum::{
    extract::{Extension, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::logistics::shipping_type::{
    BatchDTO, OperateDTO, ShippingTypeCreateDTO, ShippingTypeListQuery, ShippingTypeUpdateDTO,
    ShippingTypeVO, UpdateFieldDTO, MSG_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::AuthUser;
use tigshop_security::web::{ok, ApiResult, AppError};

use super::tenant;
use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/setting/shippingType/list",
        "ShippingTypeController.list",
    ),
    (
        "GET",
        "/setting/shippingType/detail",
        "ShippingTypeController.detail",
    ),
    (
        "POST",
        "/setting/shippingType/create",
        "ShippingTypeController.create",
    ),
    (
        "POST",
        "/setting/shippingType/update",
        "ShippingTypeController.update",
    ),
    (
        "POST",
        "/setting/shippingType/del",
        "ShippingTypeController.del",
    ),
    (
        "POST",
        "/setting/shippingType/updateField",
        "ShippingTypeController.updateField",
    ),
    (
        "POST",
        "/setting/shippingType/batch",
        "ShippingTypeController.batch",
    ),
];

/// 配送类型管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/shippingType/list", get(list))
        .route("/setting/shippingType/detail", get(detail))
        .route("/setting/shippingType/create", post(create))
        .route("/setting/shippingType/update", post(update))
        .route("/setting/shippingType/del", post(del))
        .route("/setting/shippingType/updateField", post(update_field))
        .route("/setting/shippingType/batch", post(batch))
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

/// `detail` 的查询参数（Java `@RequestParam Integer id`，必填）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 配送类型主键（Java 参数名就是 `id`）
    id: Option<i32>,
}

/// `GET /adminapi/setting/shippingType/list`：配送类型分页。
///
/// 对应 Java `ShippingTypeController.list(ShippingTypeListDTO listDTO)`
/// → `ShippingTypeServiceImpl#list`。
///
/// 查询参数按 Java `BasePage` 契约：`keyword` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是 `pageSize`）。
/// `shopId` 参数存在但**被忽略**（Java 用请求头）。
async fn list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ShippingTypeListQuery>,
) -> ApiResult<PageResult<ShippingTypeVO>> {
    // 店铺账号强制本店；平台账号 shop_id=0（Java HeaderUtils.getShopId() 平台 0）
    let shop_id = tenant::platform_or_shop_id(&auth);
    ok(state.logistics.shipping_type.list(&q, shop_id).await?)
}

/// `GET /adminapi/setting/shippingType/detail?id=`：配送类型详情。
///
/// 对应 Java `ShippingTypeController.detail(@RequestParam Integer id)`
/// → `ShippingTypeServiceImpl#detail`。
///
/// Java 记录不存在时返回全 null VO（不报错）；本实现返回 404 + 文案
/// （项目内 order_admin/005/017/075/163 的既有约定，见 `uncertain_points`）。
async fn detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ShippingTypeVO> {
    let id = require_positive_id(q.id)?;
    let vo = state.logistics.shipping_type.detail(id).await?;
    tenant::ensure_row_shop(&auth, vo.shop_id)?;
    ok(vo)
}

/// `POST /adminapi/setting/shippingType/create`：新增配送类型。
///
/// 对应 Java `ShippingTypeController.create(@RequestBody ShippingTypeCreateDTO)`
/// → `ShippingTypeServiceImpl#create`。
///
/// ⚠️ `shopId` 取自**请求头**（Java `setShopId(getShopId())`），
/// 请求体里的 `shopId` 被忽略。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ShippingTypeCreateDTO>,
) -> ApiResult<serde_json::Value> {
    // 写操作强制落到当前登录店铺（平台 0）
    let shop_id = tenant::platform_or_shop_id(&auth);
    let id = state.logistics.shipping_type.create(&dto, shop_id).await?;
    ok(serde_json::json!({ "shippingTypeId": id }))
}

/// `POST /adminapi/setting/shippingType/update`：更新配送类型。
///
/// 对应 Java `ShippingTypeController.update(@RequestBody ShippingTypeUpdateDTO)`
/// → `ShippingTypeServiceImpl#update`。
///
/// Java 返回 `void`；本实现回传受影响行数（Java 不检查该值，
/// 记录不存在时影响 0 行也**不报错**，本实现保持一致）。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ShippingTypeUpdateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = require_positive_id(dto.id)?;
    let vo = state.logistics.shipping_type.detail(id).await?;
    tenant::ensure_row_shop(&auth, vo.shop_id)?;
    let affected = state.logistics.shipping_type.update(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/setting/shippingType/del`：删除配送类型。
///
/// 对应 Java `ShippingTypeController.del(@RequestBody OperateDTO operateDTO)`
/// → `ShippingTypeServiceImpl#del`（继承 `BaseServiceImpl#del`）→ `removeById`。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = require_positive_id(dto.id)?;
    let vo = state.logistics.shipping_type.detail(id).await?;
    tenant::ensure_row_shop(&auth, vo.shop_id)?;
    let deleted = state.logistics.shipping_type.del(id).await?;
    ok(serde_json::json!({ "deleted": deleted }))
}

/// `POST /adminapi/setting/shippingType/updateField`：更新单个字段。
///
/// 对应 Java `ShippingTypeController.updateField(@RequestBody UpdateFieldDTO)`
/// → `ShippingTypeServiceImpl`（继承 `BaseServiceImpl#updateField`）
/// → 白名单 `SHIPPING_TYPE_FIELDS`。
///
/// ⚠️ 该白名单含一个**不是本表列**的 `is_show`，经「未识别回退主键列」
/// 后能通过校验并改掉主键 —— Java 真实缺陷，本实现已复刻
/// （详见 models 模块头与 `uncertain_points`）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<serde_json::Value> {
    let id = require_positive_id(dto.id)?;
    let vo = state.logistics.shipping_type.detail(id).await?;
    tenant::ensure_row_shop(&auth, vo.shop_id)?;
    let affected = state.logistics.shipping_type.update_field(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/setting/shippingType/batch`：批量操作。
///
/// 对应 Java `ShippingTypeController.batch(@RequestBody BatchDTO)`
/// → `BaseServiceImpl#batch`：**仅 `type == "del"` 生效**，
/// 其余类型静默返回 `false`。
///
/// 因此这里回传 `{ "success": bool, "affected": n }`：
/// 非 del 类型 `success = false`（与 Java 返回值一致），
/// del 类型按是否删到行为准。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<serde_json::Value> {
    if dto.is_delete() {
        for id in dto.ids.as_deref().unwrap_or(&[]) {
            let vo = state.logistics.shipping_type.detail(*id).await?;
            tenant::ensure_row_shop(&auth, vo.shop_id)?;
        }
    }
    let affected = state.logistics.shipping_type.batch(&dto).await?;
    let success = dto.is_delete() && affected > 0;
    ok(serde_json::json!({ "success": success, "affected": affected }))
}

/// 复刻 Java `HeaderUtils.getShopId()` 的三态（本域 `list`/`create` 依赖它）。
///
/// | `x-admin-type` | 结果 |
/// |----------------|------|
/// | `admin` | `0`（平台） |
/// | `shop` / `pos` | `x-shop-id` 解析值；缺失/非法 ⇒ `0` |
/// | 其它/缺失 | `0`（Java 返回 `null`，服务层 `== null ? 0 : ...` 兜底） |
///
/// 与 product_stock 的 `shop_id_from_headers` 同一口径（各 slice 自持私有副本，
/// 与仓库既有做法一致——避免改共享文件）。
#[must_use]
pub fn shop_id_from_headers(headers: &HeaderMap) -> i32 {
    match header_str(headers, "x-admin-type").as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
    }
}

/// 读取请求头为字符串（缺失或非 UTF-8 时 `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 校验并归一化主键（缺失或非正数都判 400）。
fn require_positive_id(id: Option<i32>) -> Result<i32, AppError> {
    match id {
        Some(v) if v > 0 => Ok(v),
        _ => Err(tigshop_core::Error::Validation(MSG_ID_REQUIRED.to_string()).into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    /// 7 条路由必须与契约逐字符一致。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(
            docs.len(),
            7,
            "本域应有 7 条路由（含 slices.json 漏掉的 /list）"
        );

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/setting/shippingType/list",
            "GET /adminapi/setting/shippingType/detail",
            "POST /adminapi/setting/shippingType/create",
            "POST /adminapi/setting/shippingType/update",
            "POST /adminapi/setting/shippingType/del",
            "POST /adminapi/setting/shippingType/updateField",
            "POST /adminapi/setting/shippingType/batch",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
    }

    /// ⚠️ 回归护栏：`/list` 必须在（slices.json 漏了它，别再漏）。
    #[test]
    fn list_route_is_present_even_though_slices_json_omits_it() {
        let keys: Vec<String> = implemented_routes().iter().map(|d| d.key()).collect();
        assert!(
            keys.contains(&"GET /adminapi/setting/shippingType/list".to_string()),
            "GET /list 必须被实现（契约里有、slices.json 漏登记）"
        );
    }

    /// Java 引用必须指向 `ShippingTypeController.*`。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("ShippingTypeController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
    }

    /// 请求头 → shop_id 的三态解析。
    #[test]
    fn shop_id_resolution_from_headers() {
        let mut h = HeaderMap::new();
        // 无头 → 0
        assert_eq!(shop_id_from_headers(&h), 0);

        // admin → 0（即便是 shop 头也返回 0）
        h.insert("x-admin-type", HeaderValue::from_static("admin"));
        h.insert("x-shop-id", HeaderValue::from_static("42"));
        assert_eq!(shop_id_from_headers(&h), 0);

        // shop → x-shop-id
        h.insert("x-admin-type", HeaderValue::from_static("shop"));
        assert_eq!(shop_id_from_headers(&h), 42);

        // pos → x-shop-id
        h.insert("x-admin-type", HeaderValue::from_static("pos"));
        assert_eq!(shop_id_from_headers(&h), 42);

        // shop 但缺 x-shop-id → 0
        let mut h2 = HeaderMap::new();
        h2.insert("x-admin-type", HeaderValue::from_static("shop"));
        assert_eq!(shop_id_from_headers(&h2), 0);

        // shop 但 x-shop-id 非法 → 0
        h2.insert("x-shop-id", HeaderValue::from_static("abc"));
        assert_eq!(shop_id_from_headers(&h2), 0);

        // 未知 admin-type → 0
        let mut h3 = HeaderMap::new();
        h3.insert("x-admin-type", HeaderValue::from_static("vendor"));
        h3.insert("x-shop-id", HeaderValue::from_static("9"));
        assert_eq!(shop_id_from_headers(&h3), 0);
    }

    /// `detail` 的 `id` 参数名与校验。
    #[test]
    fn detail_id_param_and_validation() {
        let q: IdQuery = serde_json::from_str(r#"{"id":5}"#).expect("应能解析");
        assert_eq!(q.id, Some(5));

        assert!(require_positive_id(None).is_err());
        assert!(require_positive_id(Some(0)).is_err());
        assert!(require_positive_id(Some(-1)).is_err());
        assert_eq!(require_positive_id(Some(4)).expect("正数应通过"), 4);
    }

    /// `batch` 的 success 语义：只有 del 且删到行才算成功。
    #[test]
    fn batch_success_semantics() {
        // 非 del ⇒ Java 返回 false
        let d = BatchDTO {
            ids: Some(vec![1]),
            r#type: Some("show".into()),
            ..Default::default()
        };
        assert!(!(d.is_delete() && 3 > 0));

        // del 但 0 行 ⇒ false
        let d = BatchDTO {
            ids: Some(vec![1]),
            r#type: Some("del".into()),
            ..Default::default()
        };
        assert!(!(d.is_delete() && 0 > 0));
        // del 且有行 ⇒ true
        assert!(d.is_delete() && 2 > 0);
    }

    /// 路由表条目数固定为 7（防误删）。
    #[test]
    fn route_table_size_is_seven() {
        assert_eq!(ROUTE_TABLE.len(), 7);
    }
    /// 店铺账号跨店读写必须被拒（detail/update/del 均先做归属校验）。
    #[test]
    fn cross_shop_access_is_rejected() {
        let shop = AuthUser {
            id: 2,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(6),
        };
        assert!(tenant::ensure_row_shop(&shop, 9).is_err());
        assert!(tenant::ensure_row_shop(&shop, 6).is_ok());
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert!(tenant::ensure_row_shop(&platform, 9).is_ok());
        assert_eq!(tenant::platform_or_shop_id(&shop), 6);
        assert_eq!(tenant::platform_or_shop_id(&platform), 0);
    }
}
