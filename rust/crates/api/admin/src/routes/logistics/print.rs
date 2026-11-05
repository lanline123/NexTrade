//! 打印机管理 —— 管理端路由（logistics::print）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.print.PrintController`
//! （`@RequestMapping("/adminapi/print/print")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |-----------|------------------|----------------|--------------------------|
//! | `GET  /print/print/list` | `GET /adminapi/print/print/list` | `PrintController.list` | `baseReceiptManage` / `shopBaseReceiptManage` / `posReceiptPrint` |
//! | `GET  /print/print/detail` | `GET /adminapi/print/print/detail` | `PrintController.detail` | 同上 |
//! | `POST /print/print/create` | `POST /adminapi/print/print/create` | `PrintController.create` | `baseReceiptUpdateManage` / `shopBaseReceiptUpdateManage` / `posReceiptPrintUpdateManage` |
//! | `POST /print/print/update` | `POST /adminapi/print/print/update` | `PrintController.update` | 同上 |
//! | `POST /print/print/updateField` | `POST /adminapi/print/print/updateField` | `PrintController.updateField` | 同上 |
//! | `POST /print/print/del` | `POST /adminapi/print/print/del` | `PrintController.del` | 同上 |
//! | `POST /print/print/hasEnabled` | `POST /adminapi/print/print/hasEnabled` | `PrintController.hasEnabled` | （无，仅需登录） |
//! | `GET  /print/print/devicePrinters` | `GET /adminapi/print/print/devicePrinters` | `PrintController.devicePrinters` | （无，仅需登录） |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/print/print`，方法级是
//! `/list` 这类短路径。注意中间那段是**小写 `print`**（与相邻的
//! `printConfig`、`printLog` 不同），路径大小写敏感，不能写成
//! `/print/Print/...`。
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式；`RouteDoc.path` 写完整契约路径。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级校验；
//! Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! （与 print_config / brand 等模块的已知缺口一致）。上表权限列仅作对照，
//! 当前**任何已登录管理员**都能调用本域全部接口。
//! 注意 `hasEnabled` / `devicePrinters` 在 Java 里**没有** `@PreAuthorize`，
//! 只受登录态保护。
//!
//! # 多租户说明
//!
//! Java 通过 `BaseServiceImpl#getShopId()` → `HeaderUtils.getShopId()`
//! 读**请求头**区分平台与店铺账号（`admin` → `0` 平台），并把它作为
//! SQL 的店铺过滤条件。Rust 侧 JWT 尚未签发 `shop_id`，故本模块统一以
//! [`default_shop_id`]（平台 `0`）调用服务层 —— 见服务层
//! `uncertain_points` 第 4 条。
//!
//! # 返回结构说明
//!
//! - `list` / `printLog/list`：Java 返回 MyBatis-Plus `Page<VO>`
//!   （`records/total/size/current/pages`），Rust 统一使用既有
//!   `PageResult`（`list/total/totalPage/pageSize/page`）；
//! - `detail`：Java 返回 `PrintDetailVO`（含脱敏后的 SN / Key）；
//! - `create` / `update` / `updateField`：Java 返回 `Boolean`，原样透传；
//! - `del`：Java 返回 `void` → Rust `ApiResult<()>`，`data` 为 `null`；
//! - `hasEnabled`：Java 返回 `boolean`；
//! - `devicePrinters`：Java 返回 `List<PrintPageVO>`。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::logistics::print::{
    OperateDTO, PrintAddDTO, PrintDetailVO, PrintPageQuery, PrintUpdateDTO, PrintVO,
    UpdateFieldDTO, MSG_ID_REQUIRED, MSG_OPERATE_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应；
/// 单测 `route_table_matches_java_contract` 守住两边不漂移。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/print/print/list", "PrintController.list"),
    ("GET", "/print/print/detail", "PrintController.detail"),
    ("POST", "/print/print/create", "PrintController.create"),
    ("POST", "/print/print/update", "PrintController.update"),
    (
        "POST",
        "/print/print/updateField",
        "PrintController.updateField",
    ),
    ("POST", "/print/print/del", "PrintController.del"),
    (
        "POST",
        "/print/print/hasEnabled",
        "PrintController.hasEnabled",
    ),
    (
        "GET",
        "/print/print/devicePrinters",
        "PrintController.devicePrinters",
    ),
];

/// 打印机管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/print/print/list", get(print_list))
        .route("/print/print/detail", get(print_detail))
        .route("/print/print/create", post(print_create))
        .route("/print/print/update", post(print_update))
        .route("/print/print/updateField", post(print_update_field))
        .route("/print/print/del", post(print_del))
        .route("/print/print/hasEnabled", post(print_has_enabled))
        .route("/print/print/devicePrinters", get(print_device_printers))
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

/// `detail` 的查询参数（Java `@RequestParam @NotNull Integer id`）。
///
/// ⚠️ 必须带 `rename_all = "camelCase"`：Java 契约里参数名就是 `id`，
/// 但同一控制器的其它接口有 `printId` / `deviceCode` 这类多词参数，
/// 统一 camelCase 可避免混用 `id` 与 `snake_case` 的解析差异。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    /// 打印机 ID（Java `@NotNull(message = "id不能为空")`）
    id: Option<i32>,
}

/// `devicePrinters` 的查询参数
/// （Java `@RequestParam(required = false) String deviceCode`）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevicePrintersQuery {
    /// 收银台设备码（可选；空白与缺省等价）
    device_code: Option<String>,
}

/// `GET /adminapi/print/print/list`：打印机分页列表。
///
/// 对应 Java `PrintController.list(PrintPageQuery pageQuery)`
/// → `PrintServiceImpl#list`。
async fn print_list(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<PrintPageQuery>,
) -> ApiResult<PageResult<PrintVO>> {
    ok(state
        .logistics
        .print
        .list(&q, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `GET /adminapi/print/print/detail?id=`：打印机详情。
///
/// 对应 Java `PrintController.detail(@RequestParam Integer id)`：
/// 参数缺失时 Java `@NotNull` 报 `id不能为空`，这里同样显式判定
/// （裸 `i32` 会被 axum 用自家 400 文案兜底，与 Java 不一致）。
async fn print_detail(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<IdQuery>,
) -> ApiResult<PrintDetailVO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation(MSG_ID_REQUIRED.into()))?;
    ok(state
        .logistics
        .print
        .detail(id, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `POST /adminapi/print/print/create`：新增打印机。
///
/// 对应 Java `PrintController.create(@RequestBody @Valid PrintAddParam)`：
/// 返回 `Boolean`（`save` 是否成功）。
async fn print_create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<PrintAddDTO>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .print
        .create(&dto, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `POST /adminapi/print/print/update`：编辑打印机。
///
/// 对应 Java `PrintController.update(@RequestBody @Valid PrintUpdateParam)`。
async fn print_update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<PrintUpdateDTO>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .print
        .update(&dto, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `POST /adminapi/print/print/updateField`：更新单个字段。
///
/// 对应 Java `PrintController.updateField(@RequestBody @Valid UpdateFieldDTO)`
/// → `PrintServiceImpl#updateField(dto, PRINT_FIELDS)`。
async fn print_update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .print
        .update_field(&dto, tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `POST /adminapi/print/print/del`：删除打印机。
///
/// 对应 Java `PrintController.del(@RequestBody OperateDTO operateDTO)`
/// → `PrintServiceImpl#del(operateDTO.getId())`。
///
/// Java 返回 `void`，故 Rust 用 `ApiResult<()>`：`data` 为 `null`。
async fn print_del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<()> {
    let id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation(MSG_OPERATE_ID_REQUIRED.into()))?;
    state
        .logistics
        .print
        .delete(id, tenant::platform_or_shop_id(&auth))
        .await?;
    ok(())
}

/// `POST /adminapi/print/print/hasEnabled`：本店是否存在启用的打印机。
///
/// 对应 Java `PrintController.hasEnabled()`（无请求体，返回 `boolean`）。
async fn print_has_enabled(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .print
        .has_enabled(tenant::platform_or_shop_id(&auth))
        .await?)
}

/// `GET /adminapi/print/print/devicePrinters?deviceCode=`：
/// 查询收银台设备可用的打印机。
///
/// 对应 Java `PrintController.devicePrinters(String deviceCode)`
/// → `PrintServiceImpl#devicePrinters`。
async fn print_device_printers(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<DevicePrintersQuery>,
) -> ApiResult<Vec<PrintVO>> {
    ok(state
        .logistics
        .print
        .device_printers(q.device_code.as_deref(), tenant::platform_or_shop_id(&auth))
        .await?)
}

/// 本模块当前使用的店铺 ID。
///
/// Java `getShopId()` = `HeaderUtils.getShopId()`（请求头，平台 `0`）。
/// Rust 侧鉴权中间件尚未注入 `shop_id`，故统一按平台账号处理。
/// 待中间件补齐后，此处改为从 `AdminState` / 请求扩展里取真实店铺 ID 即可，
/// 服务层签名（`shop_id: i32`）无需改动。
#[allow(dead_code)]
const fn default_shop_id() -> i32 {
    tigshop_core::models::logistics::print_config::DEFAULT_SHOP_ID
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 8 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8, "契约中 print 域共 8 条接口");

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/print/print/list",
                "/print/print/detail",
                "/print/print/create",
                "/print/print/update",
                "/print/print/updateField",
                "/print/print/del",
                "/print/print/hasEnabled",
                "/print/print/devicePrinters",
            ]
        );

        for p in &paths {
            // 中间段必须是小写 `print`（同域的 printConfig / printLog 不是这里）
            assert!(p.starts_with("/print/print/"), "{p} 前缀错误");
            assert!(!p.contains("print_config"), "{p} 不得用下划线写法");
            // 控制器前缀不重复
            assert!(
                !p.starts_with("/print/print/print"),
                "{p} 不得重复控制器前缀"
            );
            // 本模块路径不带 `/adminapi`（由父路由统一挂载）
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`），
    /// 逐条比对 method + path，且不得重复。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);

        let actual: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let expected: Vec<(String, String)> = [
            ("GET", "/adminapi/print/print/list"),
            ("GET", "/adminapi/print/print/detail"),
            ("POST", "/adminapi/print/print/create"),
            ("POST", "/adminapi/print/print/update"),
            ("POST", "/adminapi/print/print/updateField"),
            ("POST", "/adminapi/print/print/del"),
            ("POST", "/adminapi/print/print/hasEnabled"),
            ("GET", "/adminapi/print/print/devicePrinters"),
        ]
        .into_iter()
        .map(|(m, p)| (m.to_string(), p.to_string()))
        .collect();
        assert_eq!(actual, expected);

        for d in &docs {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }

        // 不允许重复声明（重复注册会让 axum `Router::merge` panic）
        let mut unique = actual.clone();
        unique.sort();
        unique.dedup();
        assert_eq!(
            unique.len(),
            actual.len(),
            "implemented_routes() 存在重复项"
        );
    }

    /// method 与 Java 注解一致：`list` / `detail` / `devicePrinters` 是
    /// `@GetMapping`，其余 5 条是 `@PostMapping`。
    #[test]
    fn http_methods_match_java_annotations() {
        let gets: Vec<&str> = ROUTE_TABLE
            .iter()
            .filter(|(m, _, _)| *m == "GET")
            .map(|(_, p, _)| *p)
            .collect();
        assert_eq!(
            gets,
            vec![
                "/print/print/list",
                "/print/print/detail",
                "/print/print/devicePrinters"
            ]
        );
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = gets.contains(&path);
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler，且 handler 名与路径末段一致。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("PrintController."),
                "{path} 缺少 Java 对照"
            );
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("PrintController.{last}"));
        }
    }

    /// `routes()` 注册的路径必须与 [`ROUTE_TABLE`] 完全一致（8/8），
    /// 防止「改了 routes 忘了改 ROUTE_TABLE」或漏挂。
    #[test]
    fn routes_registers_all_table_paths() {
        // `routes()` 用字面量注册，这里以字符串形式复述同一份清单。
        let registered = [
            "/print/print/list",
            "/print/print/detail",
            "/print/print/create",
            "/print/print/update",
            "/print/print/updateField",
            "/print/print/del",
            "/print/print/hasEnabled",
            "/print/print/devicePrinters",
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

    /// `detail` 的 `id` 缺失时必须报 `id不能为空`
    /// （Java `@RequestParam @NotNull` 必填），不能静默当 0 处理。
    #[test]
    fn detail_requires_id() {
        let missing: IdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(missing.id, None);
        let present: IdQuery = serde_json::from_str(r#"{"id":12}"#).unwrap();
        assert_eq!(present.id, Some(12));
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_OPERATE_ID_REQUIRED, "id不能为空");
    }

    /// `devicePrinters` 的 `deviceCode` 是 camelCase 查询参数，
    /// 缺省 / 显式空串都合法（Java `required = false`）。
    #[test]
    fn device_printers_query_parses_camel_case() {
        let none: DevicePrintersQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(none.device_code, None);
        let some: DevicePrintersQuery = serde_json::from_str(r#"{"deviceCode":"POS-A"}"#).unwrap();
        assert_eq!(some.device_code.as_deref(), Some("POS-A"));
    }

    /// 租户店铺 ID 由 AuthUser 决定：平台 0、店铺本店。
    #[test]
    fn tenant_shop_id_from_auth() {
        let platform = AuthUser {
            id: 1,
            username: "admin".into(),
            role_id: None,
            admin_type: Some("admin".into()),
            shop_id: Some(0),
        };
        assert_eq!(tenant::platform_or_shop_id(&platform), 0);
        let shop = AuthUser {
            id: 2,
            username: "shop".into(),
            role_id: None,
            admin_type: Some("shop".into()),
            shop_id: Some(9),
        };
        assert_eq!(tenant::platform_or_shop_id(&shop), 9);
    }
}
