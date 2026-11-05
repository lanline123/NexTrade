//! 管理端电子卡券组路由。
//! 对应原 Java `com.tigshop.adminapi.controller.product.ECardGroupController`
//! （`@RequestMapping("/adminapi/product/eCardGroup")`，8 个端点）。
//!
//! | 本模块路由 | 原 Java | 权限 |
//! |-----------|--------|------|
//! | `GET  /adminapi/product/eCardGroup/list` | `list` | `eCardManage` |
//! | `GET  /adminapi/product/eCardGroup/detail` | `detail` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/create` | `create` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/update` | `update` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/del` | `del` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/updateField` | `updateField` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/batch` | `batch` | `eCardManage` |
//! | `POST /adminapi/product/eCardGroup/import` | `batchImport` | `eCardManage` |
//!
//! > **权限说明**：Java 类级 `@PreAuthorize("@pms.hasPermission('eCardManage')")`；
//! > Rust 侧 `require_auth` 目前只校验登录态，权限矩阵尚未实现。
//!
//! > **多租户说明**：`list` / `create` 用请求头复刻 Java
//! > `HeaderUtils.getShopId()`：
//! > - `x-admin-type: admin` ⇒ `0`（平台）
//! > - `x-admin-type: shop|pos` ⇒ `x-shop-id`（缺失/非法 ⇒ `0`）
//! > - 其它/缺失 ⇒ `0`
//! > 其余端点（detail / update / del / updateField / batch / import）Java
//! > 不读店铺头，本模块亦不读。
//!
//! > **返回结构**：`list` 返回项目统一 `PageResult`（Java 为 MyBatis
//! > `Page<ECardGroupVO>`）；`updateField` 在 Java 返回 `boolean`，本模块
//! > 原样返回 `data: boolean`；其余 Java 为 `void` ⇒ `data: null`。
//!
//! > **Excel**：
//! > - `import`：已支持真实 `.xlsx`（服务层 `calamine` 解析后批量插 `e_card`）。
//! > - `list?isDownload>0`：xlsx 模板二进制响应仍未接，服务层返回明确业务错误。

use axum::{
    extract::{Extension, Multipart, Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::e_card_group::{
    BatchDTO, ECardGroupCreateDTO, ECardGroupListQuery, ECardGroupUpdateDTO, ECardGroupVO,
    OperateDTO, UpdateFieldDTO, ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_core::Error;
use tigshop_security::web::{client_ip, ok, ApiResult, AppError, AuthUser};

use super::tenant;
use crate::AdminState;

/// 电子卡券组域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java 方法名）。
///
/// 顺序与原 Java `ECardGroupController` 一致；`implemented_routes()` 唯一来源。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    (
        "GET",
        "/product/eCardGroup/list",
        "ECardGroupController.list",
    ),
    (
        "GET",
        "/product/eCardGroup/detail",
        "ECardGroupController.detail",
    ),
    (
        "POST",
        "/product/eCardGroup/create",
        "ECardGroupController.create",
    ),
    (
        "POST",
        "/product/eCardGroup/update",
        "ECardGroupController.update",
    ),
    (
        "POST",
        "/product/eCardGroup/del",
        "ECardGroupController.del",
    ),
    (
        "POST",
        "/product/eCardGroup/updateField",
        "ECardGroupController.updateField",
    ),
    (
        "POST",
        "/product/eCardGroup/batch",
        "ECardGroupController.batch",
    ),
    (
        "POST",
        "/product/eCardGroup/import",
        "ECardGroupController.batchImport",
    ),
];

/// 电子卡券组域路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/eCardGroup/list", get(e_card_group_list))
        .route("/product/eCardGroup/detail", get(e_card_group_detail))
        .route("/product/eCardGroup/create", post(e_card_group_create))
        .route("/product/eCardGroup/update", post(e_card_group_update))
        .route("/product/eCardGroup/del", post(e_card_group_del))
        .route(
            "/product/eCardGroup/updateField",
            post(e_card_group_update_field),
        )
        .route("/product/eCardGroup/batch", post(e_card_group_batch))
        .route("/product/eCardGroup/import", post(e_card_group_import))
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

// ——————————————————————————————————————————————
// handler
// ——————————————————————————————————————————————

/// `GET /adminapi/product/eCardGroup/list`：电子卡券组分页列表。
///
/// 服务层恒定按请求头店铺过滤；`isDownload > 0` 返回未迁移业务错误。
async fn e_card_group_list(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Query(q): Query<ECardGroupListQuery>,
) -> std::result::Result<axum::response::Response, AppError> {
    if q.wants_download_template() {
        // Java `isDownload > 0` 时写 xlsx 模板流；列与 ECardExportVO 对齐。
        let bytes = tigshop_services::system::excel::build_xlsx(
            &["卡券名称", "卡号密码"],
            &[],
            "电子卡券导入模板",
        )?;
        return Ok(crate::support::excel_response::xlsx_response(
            bytes,
            "e_card_group_template.xlsx",
        ));
    }
    let shop_id = shop_id_from_headers(&headers);
    let page = state.catalog.e_card_group.list(&q, shop_id).await?;
    Ok(axum::response::IntoResponse::into_response(ok(page)?))
}

/// `GET /adminapi/product/eCardGroup/detail?id=`：电子卡券组详情。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    id: i32,
}

async fn e_card_group_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<ECardGroupVO> {
    let detail = state.catalog.e_card_group.detail(q.id).await?;
    tenant::ensure_row_shop(&auth, detail.shop_id)?;
    ok(detail)
}

/// `POST /adminapi/product/eCardGroup/create`：创建电子卡券组。
///
/// Java `setShopId(getShopId())`（请求头覆盖）→ 返回 void。
async fn e_card_group_create(
    State(state): State<AdminState>,
    headers: axum::http::HeaderMap,
    Json(dto): Json<ECardGroupCreateDTO>,
) -> ApiResult<()> {
    let shop_id = shop_id_from_headers(&headers);
    let _id = state.catalog.e_card_group.create(&dto, shop_id).await?;
    ok(())
}

/// `POST /adminapi/product/eCardGroup/update`：更新电子卡券组（Java 返回 void）。
async fn e_card_group_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<ECardGroupUpdateDTO>,
) -> ApiResult<()> {
    let id = dto
        .group_id
        .ok_or_else(|| Error::Validation(ID_REQUIRED.into()))?;
    let detail = state.catalog.e_card_group.detail(id).await?;
    tenant::ensure_row_shop(&auth, detail.shop_id)?;
    state.catalog.e_card_group.update(&dto).await?;
    ok(())
}

/// `POST /adminapi/product/eCardGroup/del`：删除电子卡券组。
///
/// Java `del(@Valid @RequestBody OperateDTO)`：`id @NotNull` 生效。
async fn e_card_group_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    headers: HeaderMap,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| Error::Validation(ID_REQUIRED.into()))?;
    let detail = state.catalog.e_card_group.detail(id).await?;
    tenant::ensure_row_shop(&auth, detail.shop_id)?;
    state
        .catalog
        .e_card_group
        .delete(id, auth.id, &client_ip(&headers))
        .await?;
    ok(())
}

/// `POST /adminapi/product/eCardGroup/updateField`：更新电子卡券组字段。
///
/// Java 返回 `boolean`（服务层 `update` 的结果），本模块原样返回。
async fn e_card_group_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    if let Some(id) = dto.id {
        let detail = state.catalog.e_card_group.detail(id).await?;
        tenant::ensure_row_shop(&auth, detail.shop_id)?;
    }
    ok(state.catalog.e_card_group.update_field(&dto).await?)
}

/// `POST /adminapi/product/eCardGroup/batch`：批量操作（仅 `type = "del"`）。
async fn e_card_group_batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<()> {
    if dto.r#type.as_deref() == Some("del") {
        for id in dto.ids.as_deref().unwrap_or(&[]) {
            let detail = state.catalog.e_card_group.detail(*id).await?;
            tenant::ensure_row_shop(&auth, detail.shop_id)?;
        }
    }
    state.catalog.e_card_group.batch(&dto).await?;
    ok(())
}

/// `import` 的查询串兜底参数（Java `batchImport(Integer groupId, MultipartFile file)`
/// 的 `groupId` 既可能是表单字段、也可能在查询串里）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ImportQuery {
    group_id: Option<i32>,
}

/// `POST /adminapi/product/eCardGroup/import`：Excel 批量导入。
///
/// Java：`file == null` ⇒「文件不能为空」；否则解析 xlsx 并批量插卡券。
async fn e_card_group_import(
    State(state): State<AdminState>,
    Query(q): Query<ImportQuery>,
    mut multipart: Multipart,
) -> ApiResult<()> {
    let (form_group_id, file_present, file_bytes) = read_import_form(&mut multipart).await?;
    state
        .catalog
        .e_card_group
        .batch_import(
            form_group_id.or(q.group_id),
            file_present,
            file_bytes.as_deref(),
        )
        .await?;
    ok(())
}

/// 读取 multipart 表单：`groupId` 文本字段 + `file` 数据。
async fn read_import_form(
    multipart: &mut Multipart,
) -> Result<(Option<i32>, bool, Option<Vec<u8>>), Error> {
    let mut group_id: Option<i32> = None;
    let mut file_present = false;
    let mut file_bytes: Option<Vec<u8>> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| Error::Validation(format!("解析上传表单失败: {e}")))?
    {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            file_present = true;
            let bytes = field
                .bytes()
                .await
                .map_err(|e| Error::Validation(format!("读取上传文件失败: {e}")))?;
            file_bytes = Some(bytes.to_vec());
            continue;
        }
        let text = field
            .text()
            .await
            .map_err(|e| Error::Validation(format!("读取表单字段失败: {e}")))?;
        if name == "groupId" {
            group_id = text.trim().parse::<i32>().ok();
        }
    }
    Ok((group_id, file_present, file_bytes))
}

// ——————————————————————————————————————————————
// 请求头 → 店铺 ID（替代 Java `HeaderUtils.getShopId()`）
// ——————————————————————————————————————————————

/// 解析当前店铺 ID，复刻 Java `HeaderUtils.getShopId()` 的**可用分支**：
///
/// - `x-admin-type: admin` ⇒ `0`（平台）
/// - `x-admin-type: shop|pos` ⇒ `x-shop-id`（缺失/非法 ⇒ `0`）
/// - 其它/缺失 ⇒ `0`
///
/// Java 在「缺失/未知 admin-type」时返回 `null`，随后
/// `queryWrapper.eq(shopId, null)` 在 MyBatis-Plus 下等价匹配不到行；
/// Rust 侧沿用既有域（product_stock / product_group）的 `0` 兜底。
#[must_use]
fn shop_id_from_headers(headers: &axum::http::HeaderMap) -> i32 {
    let admin_type = header_str(headers, "x-admin-type");
    match admin_type.as_deref() {
        Some("admin") => 0,
        Some("shop" | "pos") => header_str(headers, "x-shop-id")
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0),
        _ => 0,
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
    /// 8 条、`/adminapi` 前缀、`eCardGroup` 驼峰大小写敏感、`import` 不能漏。
    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8, "契约中 e_card_group 域共 8 条接口");

        let expected = [
            ("GET", "/adminapi/product/eCardGroup/list"),
            ("GET", "/adminapi/product/eCardGroup/detail"),
            ("POST", "/adminapi/product/eCardGroup/create"),
            ("POST", "/adminapi/product/eCardGroup/update"),
            ("POST", "/adminapi/product/eCardGroup/del"),
            ("POST", "/adminapi/product/eCardGroup/updateField"),
            ("POST", "/adminapi/product/eCardGroup/batch"),
            ("POST", "/adminapi/product/eCardGroup/import"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }

        // 无重复、无多余
        let mut keys: Vec<String> = docs.iter().map(tigshop_openapi::RouteDoc::key).collect();
        let mut unique = keys.clone();
        unique.sort();
        unique.dedup();
        keys.sort();
        assert_eq!(unique, keys, "implemented_routes() 存在重复项");
    }

    /// `ROUTE_TABLE` 与 `routes()` 一一对应（架构 §4 门禁：路由即契约）。
    #[test]
    fn routes_registers_every_route_table_entry() {
        let registered = [
            "/product/eCardGroup/list",
            "/product/eCardGroup/detail",
            "/product/eCardGroup/create",
            "/product/eCardGroup/update",
            "/product/eCardGroup/del",
            "/product/eCardGroup/updateField",
            "/product/eCardGroup/batch",
            "/product/eCardGroup/import",
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

    /// 路由表形状：统一前缀、GET/POST、无重复、java_ref 指向本控制器。
    #[test]
    fn route_table_shape_is_valid() {
        for (i, (method, path, java_ref)) in ROUTE_TABLE.iter().enumerate() {
            assert!(
                path.starts_with("/product/eCardGroup/"),
                "路径必须以控制器前缀开头: {path}"
            );
            assert!(*method == "GET" || *method == "POST");
            assert!(java_ref.starts_with("ECardGroupController."));
            for (m2, p2, _) in ROUTE_TABLE.iter().skip(i + 1) {
                assert_ne!((method, path), (m2, p2), "重复路由声明会导致 merge panic");
            }
        }
    }

    /// 请求头 → 店铺 ID（Java `HeaderUtils.getShopId()` 可用分支）。
    #[test]
    fn shop_id_matches_header_utils() {
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "admin"), ("x-shop-id", "9")])),
            0
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop"), ("x-shop-id", "9")])),
            9
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "pos"), ("x-shop-id", "3")])),
            3
        );
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "shop")])),
            0
        );
        assert_eq!(shop_id_from_headers(&headers(&[])), 0);
        assert_eq!(
            shop_id_from_headers(&headers(&[("x-admin-type", "vendor")])),
            0
        );
    }

    /// 查询串兜底参数（Java `batchImport(Integer groupId, ...)`）。
    #[test]
    fn import_query_accepts_group_id_from_query_string() {
        let q: ImportQuery = serde_json::from_str(r#"{"groupId":7}"#).unwrap();
        assert_eq!(q.group_id, Some(7));
        let q: ImportQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.group_id, None);
    }
    /// 多租户：电子卡券组详情/更新/删除跨店 403。
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
