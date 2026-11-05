//! 管理端商品样式配置路由（切片 marketing::product_style_admin）。
//!
//! 对应原 Java
//! `com.tigshop.adminapi.controller.promotion.ProductStyleController`
//! （`@RequestMapping("/adminapi/promotion/productStyle")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /promotion/productStyle/list` | `ProductStyleController.list` | `promotionStyleManage` |
//! | `GET  /promotion/productStyle/detail` | `ProductStyleController.detail` | `promotionStyleManage` |
//! | `POST /promotion/productStyle/create` | `ProductStyleController.create` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/update` | `ProductStyleController.update` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/updateField` | `ProductStyleController.updateField` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/del` | `ProductStyleController.del` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/batch` | `ProductStyleController.batch` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/addProducts` | `ProductStyleController.addProducts` | `promotionStyleModifyManage` |
//! | `POST /promotion/productStyle/removeProducts` | `ProductStyleController.removeProducts` | `promotionStyleModifyManage` |
//! | `GET  /promotion/productStyle/brandList` | `ProductStyleController.brandList` | `promotionStyleManage` |
//!
//! 控制器前缀是 `/adminapi/promotion/productStyle` —— **没有**像
//! `/product/product`、`/order/order` 那样的重复段（`promotion` 与
//! `productStyle` 是两段不同的路径）。本文件内的路径均已去掉 `/adminapi`
//! 前缀（由 `AdminState.router()` 的 `.nest("/adminapi", ...)` 统一拼接）。
//!
//! > **权限说明**：Java 用类级 `@PreAuthorize("@pms.hasPermission(
//! > 'promotionStyleManage')")` + 方法级 `promotionStyleModifyManage`
//! > 做权限校验；Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! > （与本仓其它域一致的已知缺口）。上表权限列仅作对照记录。
//!
//! > **多租户说明**：Java 通过 `HeaderUtils.getShopId()`（请求头）区分平台
//! > 与店铺账号，`detail` / `update` / `removeProducts` 会据此做归属校验，
//! > `list` 会据此过滤 `shop_id`。Rust 侧 JWT 尚未签发 `shop_id`，
//! > 故一律按「平台账号」（`shop_id = 0`）语义处理，待鉴权中间件补齐后接入。
//!
//! > **Java 返回 `void` 的处理**：本控制器 8 个写接口在 Java 侧都返回
//! > `void`（响应体只有包装器的成功标志）。Rust 侧为了让前端/运维可诊断，
//! > 回传受影响行数或主键（与 shop_manage / pc_cat_floor / area_code 的处理一致），
//! > 语义上是**超集**（见 `uncertain_points`）。
//!
//! > **不确定点**（详见返回值 `uncertain_points`）：
//! > `CheckFieldConstants.PRODUCT_STYLE_FIELDS` 里的 `sort_order`
//! > **不是 `product_style` 的真实列**；`del` / `batch` 对一张**有
//! > `is_delete` 列**的表做**物理删除**；`addProducts` 缺少归属校验。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::marketing::product_style_admin::{
    BatchDTO, BrandProductCountVO, OperateDTO, ProductStyleDetailVO, ProductStyleEditDTO,
    ProductStyleItemBatchDTO, ProductStyleListQuery, ProductStyleSaveDTO, ProductStyleVO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域路由表（相对路径，不含 `/adminapi` 前缀）。
///
/// 抽成常量是为了让单测能直接断言路径逐字符正确
/// （与 area_code / mobile_cat_nav 的 `ROUTE_TABLE` 同一做法）。
const ROUTE_TABLE: [(&str, &str, &str); 10] = [
    (
        "GET",
        "/promotion/productStyle/list",
        "ProductStyleController.list",
    ),
    (
        "GET",
        "/promotion/productStyle/detail",
        "ProductStyleController.detail",
    ),
    (
        "POST",
        "/promotion/productStyle/create",
        "ProductStyleController.create",
    ),
    (
        "POST",
        "/promotion/productStyle/update",
        "ProductStyleController.update",
    ),
    (
        "POST",
        "/promotion/productStyle/updateField",
        "ProductStyleController.updateField",
    ),
    (
        "POST",
        "/promotion/productStyle/del",
        "ProductStyleController.del",
    ),
    (
        "POST",
        "/promotion/productStyle/batch",
        "ProductStyleController.batch",
    ),
    (
        "POST",
        "/promotion/productStyle/addProducts",
        "ProductStyleController.addProducts",
    ),
    (
        "POST",
        "/promotion/productStyle/removeProducts",
        "ProductStyleController.removeProducts",
    ),
    (
        "GET",
        "/promotion/productStyle/brandList",
        "ProductStyleController.brandList",
    ),
];

/// 商品样式配置域管理端路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/promotion/productStyle/list", get(list))
        .route("/promotion/productStyle/detail", get(detail))
        .route("/promotion/productStyle/create", post(create))
        .route("/promotion/productStyle/update", post(update))
        .route("/promotion/productStyle/updateField", post(update_field))
        .route("/promotion/productStyle/del", post(del))
        .route("/promotion/productStyle/batch", post(batch))
        .route("/promotion/productStyle/addProducts", post(add_products))
        .route(
            "/promotion/productStyle/removeProducts",
            post(remove_products),
        )
        .route("/promotion/productStyle/brandList", get(brand_list))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// 返回的 `path` 是**完整契约路径**（含 `/adminapi` 前缀），
/// 与 `docs/api-contract.json` 逐字符一致。
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

/// `GET /adminapi/promotion/productStyle/list`：商品样式分页列表。
///
/// 对应 Java `ProductStyleController.list(ProductStylePageQuery pageQuery)`
/// → `ProductStyleServiceImpl#list`。
///
/// 查询参数与 Java `BasePage` + `ProductStylePageQuery` 一致：
/// `page` / `size` / `sortField` / `sortOrder` / `keyword` /
/// `styleType` / `status` / `activityStatus` / `startTime` / `endTime`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ProductStyleListQuery>,
) -> ApiResult<PageResult<ProductStyleVO>> {
    ok(state.marketing.product_style_admin.list(&q).await?)
}

/// `GET /adminapi/promotion/productStyle/detail?id=`：商品样式详情。
///
/// 对应 Java `ProductStyleController.detail(@RequestParam("id") Integer id)`
/// → `ProductStyleServiceImpl#detail`。
///
/// `id` 必填（缺失即 400，与 Java `@RequestParam` 的必填语义一致）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ProductStyleDetailVO> {
    ok(state.marketing.product_style_admin.detail(q.id).await?)
}

/// `POST /adminapi/promotion/productStyle/create`：创建商品样式。
///
/// 对应 Java `ProductStyleController.create(@RequestBody @Validated
/// ProductStyleSaveParam param)` → `ProductStyleServiceImpl#create`。
///
/// Java 原方法返回 `void`，这里回传新建主键便于前端跳转编辑。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<ProductStyleSaveDTO>,
) -> ApiResult<i32> {
    ok(state.marketing.product_style_admin.create(&dto).await?)
}

/// `POST /adminapi/promotion/productStyle/update`：更新商品样式。
///
/// 对应 Java `ProductStyleController.update(@RequestBody @Validated
/// ProductStyleEditParam param)` → `ProductStyleServiceImpl#update`。
///
/// ⚠️ Java 的 `update` 会**全删重写**关联（`removeByStyleId` +
/// `saveStyleItems`），请求未带的类型会被清空。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ProductStyleEditDTO>,
) -> ApiResult<bool> {
    ok(state.marketing.product_style_admin.update(&dto).await?)
}

/// `POST /adminapi/promotion/productStyle/updateField`：更新单个字段。
///
/// 对应 Java `ProductStyleController.updateField(@RequestBody @Validated
/// UpdateFieldDTO updateField)` →
/// `ProductStyleServiceImpl#updateField(updateField, PRODUCT_STYLE_FIELDS)`。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .marketing
        .product_style_admin
        .update_field(&dto)
        .await?)
}

/// `POST /adminapi/promotion/productStyle/del`：删除商品样式。
///
/// 对应 Java `ProductStyleController.del(@RequestBody @Validated
/// OperateDTO operate)` → `ProductStyleServiceImpl#del(operate.getId())`。
///
/// ⚠️ 物理删除（`removeById`），且不清理 `product_style_item`。
async fn del(State(state): State<AdminState>, Json(dto): Json<OperateDTO>) -> ApiResult<bool> {
    ok(state.marketing.product_style_admin.del(&dto).await?)
}

/// `POST /adminapi/promotion/productStyle/batch`：批量操作。
///
/// 对应 Java `ProductStyleController.batch(@RequestBody @Validated
/// BatchDTO batch)` → `ProductStyleServiceImpl#batch` →
/// `BaseServiceImpl#batch`（仅 `type = "del"` 生效，其余静默返回 `false`）。
async fn batch(State(state): State<AdminState>, Json(dto): Json<BatchDTO>) -> ApiResult<bool> {
    ok(state.marketing.product_style_admin.batch(&dto).await?)
}

/// `POST /adminapi/promotion/productStyle/addProducts`：批量添加关联商品。
///
/// 对应 Java `ProductStyleController.addProducts(@RequestBody @Validated
/// ProductStyleItemBatchParam param)` → `ProductStyleServiceImpl#addProducts`。
///
/// 返回本次实际新增的关联条数。
async fn add_products(
    State(state): State<AdminState>,
    Json(dto): Json<ProductStyleItemBatchDTO>,
) -> ApiResult<u64> {
    ok(state
        .marketing
        .product_style_admin
        .add_products(&dto)
        .await?)
}

/// `POST /adminapi/promotion/productStyle/removeProducts`：批量移除关联商品。
///
/// 对应 Java `ProductStyleController.removeProducts(@RequestBody @Validated
/// ProductStyleItemBatchParam param)` → `ProductStyleServiceImpl#removeProducts`。
///
/// 返回本次实际删除的关联条数。
async fn remove_products(
    State(state): State<AdminState>,
    Json(dto): Json<ProductStyleItemBatchDTO>,
) -> ApiResult<u64> {
    ok(state
        .marketing
        .product_style_admin
        .remove_products(&dto)
        .await?)
}

/// `GET /adminapi/promotion/productStyle/brandList?keyword=`：品牌列表（含商品数）。
///
/// 对应 Java `ProductStyleController.brandList(@RequestParam(value =
/// "keyword", required = false) String keyword)` →
/// `ProductStyleServiceImpl#brandListWithProductCount`。
///
/// `keyword` **可选**（Java `required = false`）。
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct BrandListQuery {
    /// 品牌名称模糊匹配关键字（可空）
    keyword: Option<String>,
}

async fn brand_list(
    State(state): State<AdminState>,
    Query(q): Query<BrandListQuery>,
) -> ApiResult<Vec<BrandProductCountVO>> {
    ok(state
        .marketing
        .product_style_admin
        .brand_list(q.keyword.as_deref())
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 契约路径必须**逐字符**一致（含 `/adminapi` 前缀），
    /// 且控制器前缀 `/promotion/productStyle` **不重复**。
    #[test]
    fn implemented_routes_match_contract_verbatim() {
        let routes: Vec<(String, String)> = implemented_routes()
            .into_iter()
            .map(|r| (r.method, r.path))
            .collect();

        let expected: Vec<(String, String)> = [
            ("GET", "/adminapi/promotion/productStyle/list"),
            ("GET", "/adminapi/promotion/productStyle/detail"),
            ("POST", "/adminapi/promotion/productStyle/create"),
            ("POST", "/adminapi/promotion/productStyle/update"),
            ("POST", "/adminapi/promotion/productStyle/updateField"),
            ("POST", "/adminapi/promotion/productStyle/del"),
            ("POST", "/adminapi/promotion/productStyle/batch"),
            ("POST", "/adminapi/promotion/productStyle/addProducts"),
            ("POST", "/adminapi/promotion/productStyle/removeProducts"),
            ("GET", "/adminapi/promotion/productStyle/brandList"),
        ]
        .iter()
        .map(|(m, p)| ((*m).to_string(), (*p).to_string()))
        .collect();

        assert_eq!(routes, expected);
        assert_eq!(routes.len(), 10);
    }

    /// 路由表的相对路径与 `implemented_routes` 的完整路径一一对应
    /// （防止两处写歪）。
    #[test]
    fn route_table_matches_implemented_routes() {
        let full: Vec<(String, String)> = implemented_routes()
            .into_iter()
            .map(|r| (r.method, r.path))
            .collect();
        assert_eq!(full.len(), ROUTE_TABLE.len());
        for (i, (method, path, _)) in ROUTE_TABLE.iter().enumerate() {
            assert_eq!(full[i].0, *method);
            assert_eq!(full[i].1, format!("/adminapi{path}"));
        }
    }

    /// Java 引用名逐条正确（用于覆盖率报告与人工对照）。
    #[test]
    fn java_refs_are_correct() {
        let refs: Vec<String> = implemented_routes()
            .into_iter()
            .map(|r| r.java_ref)
            .collect();
        assert_eq!(
            refs,
            vec![
                "ProductStyleController.list",
                "ProductStyleController.detail",
                "ProductStyleController.create",
                "ProductStyleController.update",
                "ProductStyleController.updateField",
                "ProductStyleController.del",
                "ProductStyleController.batch",
                "ProductStyleController.addProducts",
                "ProductStyleController.removeProducts",
                "ProductStyleController.brandList",
            ]
        );
    }

    /// 路径不得出现「控制器前缀重复」以外的重复段，
    /// 也不得误写成 `/promotion/promotion/...` 或漏掉 `productStyle`。
    #[test]
    fn paths_have_no_accidental_duplication() {
        for (_, path, _) in ROUTE_TABLE {
            assert!(
                path.starts_with("/promotion/productStyle/"),
                "前缀错误: {path}"
            );
            assert!(!path.contains("/promotion/promotion/"), "前缀重复: {path}");
            // 两段不同名，不应出现 `productStyle/productStyle`
            assert!(
                !path.contains("/productStyle/productStyle"),
                "段重复: {path}"
            );
            assert!(
                !path.contains("/adminapi"),
                "本表不应含 /adminapi 前缀: {path}"
            );
        }
    }

    /// `IdQuery` 只认 `id`（Java `@RequestParam("id")`），
    /// 且缺 `id` 时反序列化失败 ⇒ 路由层返回 400。
    #[test]
    fn id_query_requires_id() {
        let q: IdQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(q.id, 5);
        assert!(serde_json::from_str::<IdQuery>(r#"{"styleId":5}"#).is_err());
    }

    /// `brandList` 的 `keyword` 可选（Java `required = false`）。
    #[test]
    fn brand_list_query_keyword_optional() {
        let q: BrandListQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.keyword, None);
        let q: BrandListQuery = serde_json::from_str(r#"{"keyword":"华为"}"#).unwrap();
        assert_eq!(q.keyword.as_deref(), Some("华为"));
    }
}
