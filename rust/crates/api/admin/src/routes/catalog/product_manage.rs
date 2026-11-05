//! 管理端商品路由（切片 catalog::product_manage）。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.product.ProductController`
//!   （`@RequestMapping("/adminapi/product/product")`）
//! - `com.tigshop.adminapi.controller.product.ProductBatchController`
//!   （`@RequestMapping("/adminapi/product/productBatch")`）
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |---------------------------------|---------|------------------------|
//! | `GET  /product/productBatch/downloadTemplate` | `ProductBatchController.downloadTemplate` | `productBatchAddManage` |
//! | `POST /product/productBatch/productBatchModify` | `ProductBatchController.productBatchModify` | `productBatchModifyManage` |
//! | `POST /product/productBatch/productBatchEdit` | `ProductBatchController.productBatchEdit` | `productBatchEditModifyManage` |
//! | `GET  /product/product/list` | `ProductController.list` | `decorate` / `productManage` |
//! | `GET  /product/product/detail` | `ProductController.detail` | `productManage` |
//! | `GET  /product/product/catAndBrandList` | `ProductController.catAndBrandList` | `productManage` |
//! | `POST /product/product/create` | `ProductController.create` | `productModifyManage` |
//! | `POST /product/product/update` | `ProductController.update` | `productModifyManage` |
//! | `POST /product/product/del` | `ProductController.del` | `productDeleteManage` |
//! | `GET  /product/product/saleStatus` | `ProductController.saleStatus` | `productManage` |
//! | `POST /product/product/saleStatus` | `ProductController.saleStatus` | `productModifyManage` |
//!
//! 注意路径中控制器前缀重复一次（`/product/product/...`、
//! `/product/productBatch/...`），与原 Java `@RequestMapping` 组合结果逐字符一致。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级
//! > 权限校验；Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! > （与本仓其它域一致的已知缺口）。上表权限列仅作对照记录。
//! >
//! > **多租户说明**：Java 通过 `HeaderUtils.getShopId()`（请求头）区分平台
//! > 与店铺账号，并据此覆盖 `shopId` / 强制审核状态；Rust 侧 JWT 尚未签发
//! > `shop_id`，故一律按「平台账号」语义处理（入参 `shopId` 原样落库），
//! > 待鉴权中间件补齐后接入。
//!
//! > **不确定点**（详见返回值 `uncertain_points`）：契约中的
//! > `ProductController.catAndBrandList` 与 `ProductController.del`、以及
//! > 接口清单里的 `productDeleteManage` 权限，在现存 Java 源码中**不存在**
//! > （全仓 grep 无 `catAndBrandList`，`ProductController` 只有 `/batch`、
//! > `/recycle`、`/copy`）。本模块按接口清单保留这两条路由，
//! > 实现语义为「分类+品牌下拉」与「软删除」，待确认。

use axum::{
    extract::{Multipart, State},
    http::{header, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
    routing::{get, post},
    Extension, Json, Router,
};
// 用 axum-extra 的 Query（serde_html_form）：支持重复键数组
// （`productTypes=1&productTypes=2`），axum 内置的 serde_urlencoded 不支持
// 序列类型；两者都兼容逗号分隔串（见 models::tigshop_core::models::catalog::product_manage::de_i32_list_opt）。
use axum_extra::extract::Query;
use serde::Deserialize;
use tigshop_core::models::catalog::product_manage::{
    AdminProductDetailVO, AdminProductListQuery, CatAndBrandVO, ProductBatchEditDTO,
    ProductBatchModifyVO, ProductDelDTO, ProductListItemVO, ProductSaveDTO,
};
use tigshop_core::models::catalog::product_sale::{ProductSaleParam, ProductSaleState};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::routes::system::image_search::enqueue_product_sync;
use crate::AdminState;

/// 商品域管理端路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // —— ProductBatchController @ /adminapi/product/productBatch ——
        .route(
            "/product/productBatch/downloadTemplate",
            get(download_template),
        )
        .route(
            "/product/productBatch/productBatchModify",
            post(product_batch_modify),
        )
        .route(
            "/product/productBatch/productBatchEdit",
            post(product_batch_edit),
        )
        // —— ProductController @ /adminapi/product/product ——
        .route("/product/product/list", get(product_list))
        .route("/product/product/detail", get(product_detail))
        .route("/product/product/catAndBrandList", get(cat_and_brand_list))
        .route("/product/product/create", post(product_create))
        .route("/product/product/update", post(product_update))
        .route("/product/product/del", post(product_del))
        .route(
            "/product/product/saleStatus",
            get(product_sale_status).post(product_sale_save),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/product/productBatch/downloadTemplate",
            "ProductBatchController.downloadTemplate",
        ),
        (
            "POST",
            "/adminapi/product/productBatch/productBatchModify",
            "ProductBatchController.productBatchModify",
        ),
        (
            "POST",
            "/adminapi/product/productBatch/productBatchEdit",
            "ProductBatchController.productBatchEdit",
        ),
        (
            "GET",
            "/adminapi/product/product/list",
            "ProductController.list",
        ),
        (
            "GET",
            "/adminapi/product/product/detail",
            "ProductController.detail",
        ),
        (
            "GET",
            "/adminapi/product/product/catAndBrandList",
            "ProductController.catAndBrandList",
        ),
        (
            "POST",
            "/adminapi/product/product/create",
            "ProductController.create",
        ),
        (
            "POST",
            "/adminapi/product/product/update",
            "ProductController.update",
        ),
        (
            "POST",
            "/adminapi/product/product/del",
            "ProductController.del",
        ),
        (
            "GET",
            "/adminapi/product/product/saleStatus",
            "ProductController.saleStatus",
        ),
        (
            "POST",
            "/adminapi/product/product/saleStatus",
            "ProductController.saleStatus",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/product/product/saleStatus`：读取商品禁售状态。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductSaleStatusQuery {
    product_id: i32,
    shop_id: Option<i32>,
}

async fn product_sale_status(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<ProductSaleStatusQuery>,
) -> ApiResult<ProductSaleState> {
    let shop_id = auth.scoped_shop_id().or(q.shop_id);
    ok(state
        .repos
        .catalog
        .product_sale
        .setting(q.product_id, shop_id)
        .await?)
}

/// `POST /adminapi/product/product/saleStatus`：平台/门店设置禁售。
async fn product_sale_save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut param): Json<ProductSaleParam>,
) -> ApiResult<&'static str> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        param.shop_id = Some(shop_id);
    }
    state.repos.catalog.product_sale.save(&param).await?;
    ok("操作成功")
}

/// `GET /adminapi/product/product/list`：商品分页。
///
/// 对应 Java `ProductController.list`（`ProductListDTO` 查询参数）。
/// Java 在该方法里会把请求头 `shopId` 与 `onlyShowMe` 覆盖进查询条件，
/// 该逻辑依赖鉴权中间件（见模块头「多租户说明」）。
async fn product_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(mut q): Query<AdminProductListQuery>,
) -> ApiResult<PageResult<ProductListItemVO>> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        q.shop_id = Some(shop_id);
    }
    ok(state.catalog.product_manage.admin_list(&q).await?)
}

/// `GET /adminapi/product/product/detail?id=`：商品详情。
///
/// 对应 Java `ProductController.detail`（`@RequestParam Integer id`）；
/// Java 在商品不存在时返回 `null`，这里保持 `data: null`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn product_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<Option<AdminProductDetailVO>> {
    let detail = state.catalog.product_manage.admin_detail(q.id).await?;
    if let (Some(shop_id), Some(ref d)) = (auth.scoped_shop_id(), &detail) {
        if d.shop_id != shop_id && d.shop_id != 0 {
            return Err(AppError(tigshop_core::Error::biz(
                403,
                "无权查看其他商户商品",
            )));
        }
    }
    ok(detail)
}

/// `GET /adminapi/product/product/catAndBrandList`：分类 + 品牌下拉。
///
/// 对应 Java `ProductController.catAndBrandList`（**该方法在现存 Java 源码中
/// 不存在**，见模块头「不确定点」）。
async fn cat_and_brand_list(State(state): State<AdminState>) -> ApiResult<CatAndBrandVO> {
    ok(state.catalog.product_manage.cat_and_brand_list().await?)
}

/// `POST /adminapi/product/product/create`：创建商品。
///
/// 对应 Java `ProductController.create`（`ProductSaveParam`），
/// 返回提示语文本（Java 返回 `String`，由响应包装器放入 `data`）。
async fn product_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<ProductSaveDTO>,
) -> ApiResult<String> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        dto.shop_id = Some(shop_id);
    }
    let id = state.catalog.product_manage.create(&dto).await?;
    if let Ok(pid) = id.parse::<i32>() {
        enqueue_product_sync(&state, pid).await;
    }
    ok(id)
}

/// `POST /adminapi/product/product/update`：更新商品。
///
/// 对应 Java `ProductController.update`（`ProductEditParam`，与
/// `ProductSaveParam` 同构）。
async fn product_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(mut dto): Json<ProductSaveDTO>,
) -> ApiResult<String> {
    if let Some(shop_id) = auth.scoped_shop_id() {
        dto.shop_id = Some(shop_id);
    }
    let id = state.catalog.product_manage.update(&dto).await?;
    if let Ok(pid) = id.parse::<i32>() {
        enqueue_product_sync(&state, pid).await;
    }
    ok(id)
}

/// `POST /adminapi/product/product/del`：删除商品（软删除）。
///
/// 对应 Java `ProductController.del`（**该方法在现存 Java 源码中不存在**）。
/// 入参兼容 `{id}` / `{productId}` / `{ids: []}` 三种前端写法。
async fn product_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProductDelDTO>,
) -> ApiResult<u64> {
    let ids = dto.target_ids();
    let deleted = state
        .catalog
        .product_manage
        .delete_scoped(&ids, auth.scoped_shop_id())
        .await?;
    for id in &ids {
        enqueue_product_sync(&state, *id as i32).await;
    }
    ok(deleted)
}

/// `GET /adminapi/product/productBatch/downloadTemplate`：下载导入模板。
///
/// 对应 Java `ProductBatchController.downloadTemplate`：直接输出二进制
/// xlsx（`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`），
/// `Content-Disposition` 中的中文名按 Java 的 `URLEncoder` 规则编码
/// （空格 `%20`，非 ASCII 按 UTF-8 百分号编码）。
async fn download_template(State(state): State<AdminState>) -> Response {
    match state.catalog.product_manage.download_template().await {
        Ok((name, bytes)) => {
            let encoded = tigshop_services::catalog::product_manage::percent_encode_utf8(&name);
            let mut headers = HeaderMap::new();
            headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static(
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
            );
            let disposition =
                format!("attachment; filename=\"{encoded}\"; filename*=UTF-8''{encoded}");
            if let Ok(value) = HeaderValue::from_str(&disposition) {
                headers.insert(header::CONTENT_DISPOSITION, value);
            }
            (headers, bytes).into_response()
        }
        Err(e) => AppError(e).into_response(),
    }
}

/// `POST /adminapi/product/productBatch/productBatchModify`：商品导入。
///
/// 对应 Java `ProductBatchController.productBatchModify`：`multipart/form-data`，
/// 参数 `isAutoCat` / `isAutoBrand` / `isChangePic` / `isUpload` + 文件 `file`。
async fn product_batch_modify(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> ApiResult<ProductBatchModifyVO> {
    let mut params: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let mut file: Option<(Option<String>, Vec<u8>)> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "解析上传表单失败: {e}"
        )))
    })? {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let file_name = field.file_name().map(str::to_string);
            let bytes = field.bytes().await.map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "读取上传文件失败: {e}"
                )))
            })?;
            file = Some((file_name, bytes.to_vec()));
        } else {
            let value = field.text().await.map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "读取表单字段失败: {e}"
                )))
            })?;
            params.insert(name, value);
        }
    }

    let parse_i32 = |key: &str| params.get(key).and_then(|v| v.trim().parse::<i32>().ok());
    let (file_name, bytes) = file.unwrap_or((None, Vec::new()));
    ok(state
        .catalog
        .product_manage
        .batch_modify_scoped(
            parse_i32("isAutoCat"),
            parse_i32("isAutoBrand"),
            parse_i32("isChangePic"),
            parse_i32("isUpload"),
            file_name.as_deref(),
            &bytes,
            auth.scoped_shop_id(),
        )
        .await?)
}

/// `POST /adminapi/product/productBatch/productBatchEdit`：商品批量修改。
///
/// 对应 Java `ProductBatchController.productBatchEdit`（`ProductBatchEditDTO`）。
/// Java 原方法返回 `void`，这里回传 `true`/受影响结果便于前端与运维排查。
async fn product_batch_edit(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ProductBatchEditDTO>,
) -> ApiResult<bool> {
    ok(state
        .catalog
        .product_manage
        .batch_edit_scoped(&dto, auth.scoped_shop_id())
        .await?)
}
