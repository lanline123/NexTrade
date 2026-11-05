//! 管理端库存预警路由（catalog::stock_warning）。
//! 对应原 Java `com.tigshop.adminapi.controller.product.StockWarningController`
//! （`@RequestMapping("/adminapi/product/stockWarning")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('stockWarningManage')")`）。
//!
//! | 本模块路由 | 原 Java 方法 | 权限 |
//! |-----------|-------------|------|
//! | `GET  /adminapi/product/stockWarning/setting` | `StockWarningController.setting` | `stockWarningManage` |
//! | `POST /adminapi/product/stockWarning/setting` | `StockWarningController.saveSetting` | `stockWarningUpdateManage` |
//! | `GET  /adminapi/product/stockWarning/list` | `StockWarningController.list` | `stockWarningManage` |
//! | `GET  /adminapi/product/stockWarning/export` | `StockWarningController.export` | `stockWarningManage` |
//! | `GET  /adminapi/product/stockWarning/downloadTemplate` | `StockWarningController.downloadTemplate` | `stockWarningManage` |
//! | `POST /adminapi/product/stockWarning/import` | `StockWarningController.importExcel` | `stockWarningUpdateManage` |
//! | `POST /adminapi/product/stockWarning/getImportErrorData` | `StockWarningController.getImportErrorData` | `stockWarningUpdateManage` |
//! | `POST /adminapi/product/stockWarning/getBatchImportErrorData` | `StockWarningController.getImportErrorData`（同一方法的第二个映射） | `stockWarningUpdateManage` |
//! | `POST /adminapi/product/stockWarning/save` | `StockWarningController.save` | `stockWarningUpdateManage` |
//! | `POST /adminapi/product/stockWarning/batchSave` | `StockWarningController.batchSave` | `stockWarningUpdateManage` |
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级校验；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / order_admin.rs 的已知缺口一致）。
//! >
//! > **主体（仓库）说明**：Java 用 `HeaderUtils.getAdminType()` / `getShopId()`
//! > （请求头 `x-admin-type` / `x-shop-id`）在控制器里 `resolveShopId`；
//! > Rust 侧 JWT 尚未签发 `shop_id`，故同样读请求头，请求头缺失时回退 JWT 的
//! > `admin_type`（见 [`resolve_request_shop`]）。
//! >
//! > **⚠️ 契约中的 auth 字段**：`api-contract.json` 把
//! > `getImportErrorData` / `getBatchImportErrorData` 标为 `anonymous`，
//! > 但 Java 该类有类级 `@PreAuthorize`，且解析结果里同时带
//! > `stockWarningUpdateManage` 权限，二者矛盾。Rust 侧这两条与其他 8 条一样
//! > 挂在需要登录的 `/adminapi` 受保护子路由下（与 Java 实际行为一致）。
//! >
//! > **返回形态**：`downloadTemplate` 与两个导入错误数据接口返回 xlsx 下载流；`export` 仍返回导出行 JSON。
//! >
//! > **分页结构差异**：Java `list` 返回 MyBatis-Plus `Page<StockWarningPageVO>`
//! > （`records/total/size/current/pages`），Rust 统一使用项目既有的
//! > `PageResult`（`list/total/totalPage/pageSize/page`）——与 order_admin 同一约定。

use axum::{
    extract::{Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::stock_warning::{
    StockWarningBatchResultVO, StockWarningBatchSaveDTO, StockWarningExportQuery,
    StockWarningImportErrorRow, StockWarningImportResultVO, StockWarningImportRow,
    StockWarningListQuery, StockWarningPageVO, StockWarningSaveDTO, StockWarningSettingSaveDTO,
    StockWarningSettingVO,
};
use tigshop_core::types::PageResult;
use tigshop_core::{Error, Result};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};
use tigshop_services::catalog::stock_warning::{resolve_shop_id, ImportFile};

use crate::AdminState;

/// 库存预警域路由（挂载于 `/adminapi` 下）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/product/stockWarning/setting",
            get(stock_warning_setting).post(stock_warning_save_setting),
        )
        .route("/product/stockWarning/list", get(stock_warning_list))
        .route("/product/stockWarning/export", get(stock_warning_export))
        .route(
            "/product/stockWarning/downloadTemplate",
            get(stock_warning_download_template),
        )
        .route("/product/stockWarning/import", post(stock_warning_import))
        .route(
            "/product/stockWarning/getImportErrorData",
            post(stock_warning_import_errors),
        )
        .route(
            "/product/stockWarning/getBatchImportErrorData",
            post(stock_warning_import_errors),
        )
        .route("/product/stockWarning/save", post(stock_warning_save))
        .route(
            "/product/stockWarning/batchSave",
            post(stock_warning_batch_save),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/product/stockWarning/setting",
            "StockWarningController.setting",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/setting",
            "StockWarningController.saveSetting",
        ),
        (
            "GET",
            "/adminapi/product/stockWarning/list",
            "StockWarningController.list",
        ),
        (
            "GET",
            "/adminapi/product/stockWarning/export",
            "StockWarningController.export",
        ),
        (
            "GET",
            "/adminapi/product/stockWarning/downloadTemplate",
            "StockWarningController.downloadTemplate",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/import",
            "StockWarningController.importExcel",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/getImportErrorData",
            "StockWarningController.getImportErrorData",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/getBatchImportErrorData",
            "StockWarningController.getImportErrorData",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/save",
            "StockWarningController.save",
        ),
        (
            "POST",
            "/adminapi/product/stockWarning/batchSave",
            "StockWarningController.batchSave",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

// ——————————————————————————————————————————————
// 请求头 → 主体（替代 Java HeaderUtils + Controller.resolveShopId）
// ——————————————————————————————————————————————

/// 解析当前请求的主体 ID（对应 Java `StockWarningController.resolveShopId`）。
///
/// `adminType` 优先取请求头 `x-admin-type`（Java 只认请求头），缺失时回退 JWT 的
/// `admin_type`；`x-shop-id` 仅对 `shop` / `pos` 账号生效
/// （与 Java `HeaderUtils.getShopId()` 一致）。平台管理员可指定主体、
/// 不传视为平台自营 0；其余账号强制自身，取不到即业务报错。
fn resolve_request_shop(
    headers: &HeaderMap,
    auth: &AuthUser,
    requested_shop_id: Option<i32>,
) -> Result<i32> {
    let admin_type = header_str(headers, "x-admin-type")
        .filter(|v| !v.trim().is_empty())
        .or_else(|| auth.admin_type.clone());
    let header_shop_id =
        header_str(headers, "x-shop-id").and_then(|v| v.trim().parse::<i32>().ok());
    // 服务层提供的是自由函数 `tigshop_services::catalog::stock_warning::resolve_shop_id`
    // （非 `StockWarningService` 的关联函数），与 Java `resolveShopId` 语义一致。
    resolve_shop_id(requested_shop_id, admin_type.as_deref(), header_shop_id)
}

/// 读取请求头文本值（缺失或非 UTF-8 时返回 `None`）。
fn header_str(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .map(ToString::to_string)
}

/// 读取 multipart 上传的 `file` 与 `shopId`（对应 Java `@RequestParam`）。
async fn read_upload(
    multipart: &mut Multipart,
) -> Result<(Option<(Option<String>, Vec<u8>)>, Option<i32>)> {
    let mut file: Option<(Option<String>, Vec<u8>)> = None;
    let mut shop_id: Option<i32> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let file_name = field.file_name().map(str::to_string);
            let bytes = field
                .bytes()
                .await
                .map_err(|e| Error::Validation(format!("读取上传文件失败: {e}")))?;
            file = Some((file_name, bytes.to_vec()));
        } else {
            let text = field
                .text()
                .await
                .map_err(|e| Error::Validation(format!("读取表单字段失败: {e}")))?;
            if name == "shopId" {
                shop_id = text.trim().parse::<i32>().ok();
            }
        }
    }
    Ok((file, shop_id))
}

/// 把上传的 `(文件名, 字节)` 转成服务层视图。
fn as_import_file(file: &Option<(Option<String>, Vec<u8>)>) -> Option<ImportFile<'_>> {
    file.as_ref().map(|(name, bytes)| ImportFile {
        file_name: name.as_deref(),
        bytes: bytes.as_slice(),
    })
}

// ——————————————————————————————————————————————
// 总开关
// ——————————————————————————————————————————————

/// `GET /adminapi/product/stockWarning/setting`：获取库存预警通知总开关。
///
/// 对应 Java `StockWarningController.setting(@RequestParam shopId)`。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingQuery {
    shop_id: Option<i32>,
}

async fn stock_warning_setting(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<SettingQuery>,
) -> ApiResult<StockWarningSettingVO> {
    let owner_shop_id = resolve_request_shop(&headers, &auth, query.shop_id)?;
    ok(state
        .catalog
        .stock_warning
        .get_setting(Some(owner_shop_id))
        .await?)
}

/// `POST /adminapi/product/stockWarning/setting`：保存库存预警通知总开关。
///
/// 对应 Java `StockWarningController.saveSetting(@Valid @RequestBody
/// StockWarningSettingSaveDTO)`（返回 `void`，此处回提示文案）。
async fn stock_warning_save_setting(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<StockWarningSettingSaveDTO>,
) -> ApiResult<&'static str> {
    let owner_shop_id = resolve_request_shop(&headers, &auth, dto.shop_id)?;
    let dto = StockWarningSettingSaveDTO {
        shop_id: Some(owner_shop_id),
        ..dto
    };
    state.catalog.stock_warning.save_setting(&dto).await?;
    ok("保存成功")
}

// ——————————————————————————————————————————————
// 列表 / 导出
// ——————————————————————————————————————————————

/// `GET /adminapi/product/stockWarning/list`：库存预警分页。
///
/// 对应 Java `StockWarningController.list(StockWarningListDTO)`，返回
/// MyBatis-Plus `Page<StockWarningPageVO>`；Rust 统一使用项目既有的
/// `PageResult`（`list/total/totalPage/pageSize/page`）。
async fn stock_warning_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(mut query): Query<StockWarningListQuery>,
) -> ApiResult<PageResult<StockWarningPageVO>> {
    query.shop_id = Some(resolve_request_shop(&headers, &auth, query.shop_id)?);
    ok(state.catalog.stock_warning.list(&query).await?)
}

/// `GET /adminapi/product/stockWarning/export`：导出库存预警列表。
///
/// 对应 Java `StockWarningController.export(@Valid StockWarningExportDTO)`：
/// Java 用 `@ResponseExcel` 输出 xlsx（按前端勾选的行，`ids` 为必填的
/// `productId_skuId` 列表）。Rust 侧无 xlsx 写出依赖，改为返回同样的行数据
/// JSON（`data` 为 `StockWarningExcelVO` 数组），业务取数与 Java 完全一致。
async fn stock_warning_export(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(mut query): Query<StockWarningExportQuery>,
) -> std::result::Result<axum::response::Response, AppError> {
    query.shop_id = Some(resolve_request_shop(&headers, &auth, query.shop_id)?);
    let rows = state.catalog.stock_warning.export(&query).await?;
    let headers = [
        "商品名称",
        "规格",
        "商品编码",
        "SKU编码",
        "仓库",
        "实时库存",
        "在途库存",
        "库存下限",
        "库存上限",
        "库存状态",
        "库存预警",
        "相关商品数",
    ];
    let data: Vec<Vec<String>> = rows
        .iter()
        .map(|r| {
            vec![
                r.product_name.clone(),
                r.product_sku_name.clone(),
                r.product_sn.clone().unwrap_or_default(),
                r.sku_sn.clone().unwrap_or_default(),
                r.shop_name.clone(),
                r.current_stock.to_string(),
                r.transit_stock.to_string(),
                r.lower_limit.clone(),
                r.upper_limit.clone(),
                r.stock_status_name.clone().unwrap_or_default(),
                r.warn_enabled_name.clone(),
                r.related_product_count.to_string(),
            ]
        })
        .collect();
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &data, "库存预警")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "stock_warning.xlsx",
    ))
}

// ——————————————————————————————————————————————
// 导入 / 模板
// ——————————————————————————————————————————————

/// `GET /adminapi/product/stockWarning/downloadTemplate`：下载导入模板。
///
/// 对应 Java `StockWarningController.downloadTemplate(HttpServletResponse)`：
/// Java 用 `ExcelUtils.exportExcelWebByTitle` 输出二进制 xlsx
/// （列 商品编码 / SKU编码 / 下限 / 上限）。Rust 侧无 xlsx 写出依赖，
/// 改为返回列定义 JSON，供前端或运维据此生成模板。
async fn stock_warning_download_template(
    State(state): State<AdminState>,
) -> std::result::Result<axum::response::Response, AppError> {
    let _ = &state;
    let headers = ["商品编码", "SKU编码", "下限", "上限"];
    let bytes = tigshop_services::system::excel::build_xlsx(&headers, &[], "库存预警导入模板")?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "stock_warning_template.xlsx",
    ))
}

/// `POST /adminapi/product/stockWarning/import`：导入库存预警配置。
///
/// 对应 Java `StockWarningController.importExcel(@RequestParam MultipartFile file,
/// @RequestParam shopId)`：multipart 表单字段 `file` + `shopId`。
///
/// **未迁移**：xlsx 解析依赖未启用，服务层完成 Java 的文件校验
/// （非空 / `.xlsx` 后缀）后返回明确的未实现业务错误。
async fn stock_warning_import(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<SettingQuery>,
    mut multipart: Multipart,
) -> ApiResult<StockWarningImportResultVO> {
    let (file, form_shop_id) = read_upload(&mut multipart).await?;
    let Some((_, bytes)) = file.as_ref() else {
        return Err(AppError(tigshop_core::Error::Validation(
            "文件不能为空".into(),
        )));
    };
    // Java `@RequestParam("shopId")` 同时接受表单字段与查询串参数
    let owner_shop_id = resolve_request_shop(&headers, &auth, form_shop_id.or(query.shop_id))?;
    let rows = parse_stock_warning_rows(bytes)?;
    ok(state
        .catalog
        .stock_warning
        .import_rows(&rows, Some(owner_shop_id))
        .await?)
}

/// 解析库存预警导入 xlsx（列：商品编码 / SKU编码 / 下限 / 上限，首行为表头）。
fn parse_stock_warning_rows(
    bytes: &[u8],
) -> std::result::Result<Vec<StockWarningImportRow>, AppError> {
    let sheet = tigshop_services::system::excel::read_xlsx(bytes)?;
    let mut rows = Vec::new();
    for row in sheet.iter().skip(1) {
        let cell = |idx: usize| -> Option<String> {
            row.get(idx)
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };
        let product_sn = cell(0);
        let sku_sn = cell(1);
        let lower_limit = cell(2);
        let upper_limit = cell(3);
        if product_sn.is_none()
            && sku_sn.is_none()
            && lower_limit.is_none()
            && upper_limit.is_none()
        {
            continue;
        }
        rows.push(StockWarningImportRow {
            product_sn,
            sku_sn,
            lower_limit,
            upper_limit,
        });
    }
    if rows.is_empty() {
        return Err(AppError(tigshop_core::Error::Validation(
            "表格数据为空".into(),
        )));
    }
    Ok(rows)
}

/// `POST /adminapi/product/stockWarning/getImportErrorData` 与
/// `POST /adminapi/product/stockWarning/getBatchImportErrorData`：
/// 获取库存预警导入失败数据。
///
/// 对应 Java `StockWarningController.getImportErrorData`——**同一个方法上有两个
/// 映射**（`@PostMapping({"/getImportErrorData", "/getBatchImportErrorData"})`），
/// 故此处两个路径复用同一个 handler。
///
/// **未迁移**：Java 把失败明细直接写成 xlsx 返回；Rust 侧 xlsx 读取与写出依赖
/// 均未启用，服务层完成文件校验后返回明确的未实现业务错误。
async fn stock_warning_import_errors(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Query(query): Query<SettingQuery>,
    mut multipart: Multipart,
) -> std::result::Result<axum::response::Response, AppError> {
    let (file, form_shop_id) = read_upload(&mut multipart).await?;
    // Java `@RequestParam("shopId")` 同时接受表单字段与查询串参数
    let owner_shop_id = resolve_request_shop(&headers, &auth, form_shop_id.or(query.shop_id))?;
    let bytes = state
        .catalog
        .stock_warning
        .get_import_error_data_xlsx(as_import_file(&file), Some(owner_shop_id))
        .await?;
    Ok(crate::support::excel_response::xlsx_response(
        bytes,
        "stock_warning_error.xlsx",
    ))
}

// ——————————————————————————————————————————————
// 规则设置
// ——————————————————————————————————————————————

/// `POST /adminapi/product/stockWarning/save`：设置商品库存预警。
///
/// 对应 Java `StockWarningController.save(@Valid @RequestBody
/// StockWarningSaveDTO)`（返回 `void`，此处回提示文案）。
async fn stock_warning_save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<StockWarningSaveDTO>,
) -> ApiResult<&'static str> {
    let owner_shop_id = resolve_request_shop(&headers, &auth, dto.shop_id)?;
    let dto = StockWarningSaveDTO {
        shop_id: Some(owner_shop_id),
        ..dto
    };
    state.catalog.stock_warning.save(&dto).await?;
    ok("保存成功")
}

/// `POST /adminapi/product/stockWarning/batchSave`：批量设置商品库存预警。
///
/// 对应 Java `StockWarningController.batchSave(@Valid @RequestBody
/// StockWarningBatchSaveDTO)`，返回成功/失败明细
/// （`StockWarningBatchResultVO`）。
async fn stock_warning_batch_save(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<StockWarningBatchSaveDTO>,
) -> ApiResult<StockWarningBatchResultVO> {
    let owner_shop_id = resolve_request_shop(&headers, &auth, dto.shop_id)?;
    let dto = StockWarningBatchSaveDTO {
        shop_id: Some(owner_shop_id),
        ..dto
    };
    ok(state.catalog.stock_warning.batch_save(&dto).await?)
}
