//! 打印机配置管理 —— 管理端路由（logistics::print_config）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.print.PrintConfigController`
//! （`@RequestMapping("/adminapi/print/printConfig")`）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/adminapi` 之下）
//!
//! | 本模块路由 | 原 Java 完整路径 | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |-----------|------------------|----------------|--------------------------|
//! | `GET /print/printConfig/getConfigsByPrintId` | `GET /adminapi/print/printConfig/getConfigsByPrintId` | `PrintConfigController.getConfigsByPrintId` | `baseReceiptManage` / `shopBaseReceiptManage` / `posReceiptPrint` |
//! | `POST /print/printConfig/update` | `POST /adminapi/print/printConfig/update` | `PrintConfigController.update` | `baseReceiptUpdateManage` / `shopBaseReceiptUpdateManage` / `posReceiptPrintUpdateManage` |
//! | `POST /print/printConfig/print` | `POST /adminapi/print/printConfig/print` | `PrintConfigController.print` | （无，仅需登录） |
//!
//! # 路径说明（**逐字符照抄**）
//!
//! 类级 `@RequestMapping` 的值是 `/adminapi/print/printConfig`
//! （`printConfig` 是**小驼峰**，不是 `print_config`），方法级只有
//! `/getConfigsByPrintId` 这类短路径，**没有**控制器前缀重复。
//! 因此最终路径是 `/adminapi/print/printConfig/getConfigsByPrintId`
//! （不是 `.../printConfig/printConfig/...`，也不是 `.../print_config/...`），
//! 与 `docs/api-contract.json` 逐字符一致。
//!
//! 路由串写**去掉 `/adminapi` 前缀**后的形式，`RouteDoc.path` 写完整契约路径。
//!
//! # 权限说明
//!
//! Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 做方法级校验；
//! Rust 侧 `require_auth` 目前只校验登录态，权限矩阵未实现
//! （与 seckill.rs / member_tag.rs / area_code.rs 的已知缺口一致）。
//! 上表权限列仅作对照记录，当前**任何已登录管理员**都能调用本域全部接口。
//! 注意 `print`（打印订单）在 Java 里**没有** `@PreAuthorize`，
//! 只受登录态保护，与本域另外两个接口不同。
//!
//! # 多租户说明（重要）
//!
//! Java 通过 `BaseServiceImpl#getShopId()` → `HeaderUtils.getShopId()`
//! 读**请求头**区分平台与店铺账号（`admin` → `0` 平台），并把它作为
//! SQL 的店铺过滤条件。Rust 侧 JWT 尚未签发 `shop_id`，故本模块统一以
//! [`default_shop_id`]（平台 `0`）调用服务层 —— 见
//! `uncertain_points`。
//!
//! # 返回结构说明
//!
//! - `getConfigsByPrintId`：Java 返回 `PrintConfigVO`，**可能为 `null`**
//!   （`findFirst().orElse(null)`）。此处用 `Option<PrintConfigVO>` 承接，
//!   `data` 为 `null` 时前端按「该打印机尚未配置」处理（**不是** 404）。
//! - `update`：Java 返回 `Boolean`（`updateById` 是否命中），原样透传。
//! - `print`：Java 返回 `Boolean`（恒 `true`），原样透传。
//!
//! # 打印任务投递说明（`print` 的替代实现）
//!
//! 原 Java `PrintConfigServiceImpl#print` 把 `PrintOrderDTO` 发到 RabbitMQ
//! 的 `PRINT_ORDER_QUEUE`，由 `RabbitMqConsumer` 消费；消费的第一步
//! `printLogService.createPending(...)` 会预写一条 `status = 0`（待推送）
//! 的 `print_log`。本仓 `crates/infrastructure/src/queue` 目前**只有
//! `health_check`，没有 publish**（RabbitMQ 客户端未迁移），且 `print`
//! 的渲染器 / 平台适配器（飞鹅云、商米云）也尚未迁移。
//!
//! 因此服务层把「消费端第一步」的**可观测结果**直接落库：为每个
//! 「订单 × 打印机」写一条 `trigger_type = 2`（手动补打）、`status = 0`
//! 的 `print_log`，使打印任务不丢失、可被后续消费者接管。详见
//! [`tigshop_services::logistics::print_config`] 模块头与 `uncertain_points`。

use axum::{
    extract::{Extension, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::logistics::print_config::{
    PrintConfigUpdateDTO, PrintConfigVO, PrintOrdersDTO, MSG_PRINT_ID_REQUIRED,
};
use tigshop_security::web::{ok, ApiResult, AuthUser};

use super::tenant;
use crate::AdminState;

/// 本域全部 3 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/print/printConfig/getConfigsByPrintId",
        "PrintConfigController.getConfigsByPrintId",
    ),
    (
        "POST",
        "/print/printConfig/update",
        "PrintConfigController.update",
    ),
    (
        "POST",
        "/print/printConfig/print",
        "PrintConfigController.print",
    ),
];

/// 打印机配置管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route(
            "/print/printConfig/getConfigsByPrintId",
            get(get_configs_by_print_id),
        )
        .route("/print/printConfig/update", post(update))
        .route("/print/printConfig/print", post(print))
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

/// `getConfigsByPrintId` 的查询参数
/// （Java `@RequestParam @NotNull(message = "打印机ID不能为空") Integer printId`）。
///
/// ⚠️ `printId` 声明为 `Option<i32>` 而不是裸 `i32`：裸类型在参数缺失时
/// axum 会返回自己的 400 文案；这里显式判定以复刻 Java `@NotNull` 的
/// 「必填」语义，并给出与 Java **逐字符一致**的错误文案。
///
/// ⚠️ 必须带 `rename_all = "camelCase"`：前端按 Java 契约传 `printId`
/// （Java 是 `@RequestParam Integer printId`），没有这个属性时
/// serde 只认 `print_id`，`?printId=12` 会被静默解析成 `None`
/// → 接口永远报「打印机ID不能为空」。单测
/// `get_configs_by_print_id_requires_print_id` 专门盯这个回归。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrintIdQuery {
    /// 打印机 ID（Java `@RequestParam Integer printId`）
    print_id: Option<i32>,
}

/// `GET /adminapi/print/printConfig/getConfigsByPrintId?printId=`：获取打印机配置。
///
/// 对应 Java `PrintConfigController.getConfigsByPrintId(@RequestParam Integer printId)`
/// → `PrintConfigServiceImpl#getConfigsByPrintId`。
///
/// ⚠️ 该打印机没有任何配置时返回 `data = null`，**不是** 404
/// —— 这是 Java 的真实行为（`list.stream().findFirst().orElse(null)`），
/// 已在服务层文档与 `uncertain_points` 中记录。
async fn get_configs_by_print_id(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Query(q): Query<PrintIdQuery>,
) -> ApiResult<Option<PrintConfigVO>> {
    let print_id = q
        .print_id
        .ok_or_else(|| tigshop_core::Error::Validation(MSG_PRINT_ID_REQUIRED.into()))?;
    let shop_id = tenant::platform_or_shop_id(&auth);
    let owned = state
        .logistics
        .print
        .repo()
        .find_by_id_and_shop(print_id, shop_id)
        .await?;
    owned.ok_or_else(|| tigshop_core::Error::Forbidden("无权访问该打印机配置".into()))?;
    ok(state
        .logistics
        .print_config
        .get_configs_by_print_id(print_id)
        .await?)
}

/// `POST /adminapi/print/printConfig/update`：更新打印配置。
///
/// 对应 Java `PrintConfigController.update(@RequestBody @Valid PrintConfigUpdateParam)`
/// → `PrintConfigServiceImpl#updateConfig`。
///
/// ⚠️ `paperSize` 不传（或显式 `null`）时**保留库里已有的值**
/// （Java `if (param.getPaperSize() != null)` 才覆盖）；
/// 但 Java 的 `PrintPaperSizeEnum#fromCode(null)` 会把**显式 `null`**
/// 兜底成 58mm，与「字段缺失」不同 —— 见 `uncertain_points`。
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<PrintConfigUpdateDTO>,
) -> ApiResult<bool> {
    let config_id = dto
        .id
        .ok_or_else(|| tigshop_core::Error::Validation("打印配置ID不能为空".into()))?;
    let config = state
        .logistics
        .print_config
        .repo()
        .find_config_by_id(config_id)
        .await?
        .ok_or_else(|| tigshop_core::Error::Validation("打印配置不存在".into()))?;
    let shop_id = tenant::platform_or_shop_id(&auth);
    let owned = state
        .logistics
        .print
        .repo()
        .find_by_id_and_shop(config.print_id, shop_id)
        .await?;
    owned.ok_or_else(|| tigshop_core::Error::Forbidden("无权修改该打印配置".into()))?;
    ok(state.logistics.print_config.update_config(&dto).await?)
}

/// `POST /adminapi/print/printConfig/print`：打印订单（手动补打）。
///
/// 对应 Java `PrintConfigController.print(@RequestBody @Valid PrintOrdersParam)`
/// → `PrintConfigServiceImpl#print`。
///
/// 语义：解析该店铺启用的打印机（可选按收银台设备码过滤）→ 为每个
/// 「订单 × 打印机」落一条待推送 `print_log`（原 Java 为投递 RabbitMQ，
/// 见模块头「打印任务投递说明」）。Java 返回 `true`，此处原样透传。
async fn print(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<PrintOrdersDTO>,
) -> ApiResult<bool> {
    ok(state
        .logistics
        .print_config
        .print_orders(&dto, tenant::platform_or_shop_id(&auth))
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

    /// 路由表必须与 `docs/api-contract.json` 的 3 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 3);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/print/printConfig/getConfigsByPrintId",
                "/print/printConfig/update",
                "/print/printConfig/print",
            ]
        );

        // `printConfig` 是小驼峰，绝不能写成 `/print_config`
        for p in &paths {
            assert!(p.starts_with("/print/printConfig/"), "{p} 前缀错误");
            assert!(!p.contains("print_config"), "{p} 不得用下划线写法");
            // 控制器前缀**不重复**
            assert!(
                !p.starts_with("/print/printConfig/printConfig"),
                "{p} 不得重复控制器前缀"
            );
        }

        // 本模块路径不带 `/adminapi`（由父路由统一挂载）
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// `implemented_routes()` 必须返回**完整**契约路径（含 `/adminapi`），
    /// 与 `docs/api-contract.json` 逐字符一致。
    #[test]
    fn implemented_routes_are_full_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);

        let got: Vec<(String, String)> = docs
            .iter()
            .map(|d| (d.method.clone(), d.path.clone()))
            .collect();
        let want: Vec<(String, String)> = vec![
            (
                "GET".to_string(),
                "/adminapi/print/printConfig/getConfigsByPrintId".to_string(),
            ),
            (
                "POST".to_string(),
                "/adminapi/print/printConfig/update".to_string(),
            ),
            (
                "POST".to_string(),
                "/adminapi/print/printConfig/print".to_string(),
            ),
        ];
        assert_eq!(got, want);

        // 每条都必须带 `/adminapi` 前缀
        for d in &docs {
            assert!(d.path.starts_with("/adminapi/"), "{} 缺少前缀", d.path);
        }
    }

    /// method 与 Java 注解一致：只有 `getConfigsByPrintId` 是 `@GetMapping`。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = path.ends_with("/getConfigsByPrintId");
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
        // 恰好 1 个 GET、2 个 POST
        let gets = ROUTE_TABLE.iter().filter(|(m, _, _)| *m == "GET").count();
        assert_eq!(gets, 1);
        assert_eq!(ROUTE_TABLE.len() - gets, 2);
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("PrintConfigController."),
                "{path} 缺少 Java 对照"
            );
        }
        // handler 名与路径末段一致（Java 方法名 = 路径末段）
        for (_, path, java) in ROUTE_TABLE {
            let last = path.rsplit('/').next().unwrap();
            assert_eq!(java, format!("PrintConfigController.{last}"));
        }
    }

    /// 默认店铺 ID 是平台 0（Java `HeaderUtils.getShopId()` 在 `admin` 下取 0）。
    #[test]
    fn default_shop_id_is_platform() {
        assert_eq!(default_shop_id(), 0);
        assert_eq!(
            default_shop_id(),
            tigshop_core::models::logistics::print_config::DEFAULT_SHOP_ID
        );
    }

    /// `getConfigsByPrintId` 的 `printId` 缺失时必须报错（Java
    /// `@RequestParam @NotNull Integer printId` 必填 → 400），
    /// 不能静默当 0 处理。
    #[test]
    fn get_configs_by_print_id_requires_print_id() {
        let missing: PrintIdQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(missing.print_id, None);

        let camel: PrintIdQuery = serde_json::from_str(r#"{"printId":12}"#).unwrap();
        assert_eq!(camel.print_id, Some(12));
    }

    /// 校验文案与 Java `@NotNull(message = "打印机ID不能为空")` 逐字符一致。
    #[test]
    fn print_id_message_is_verbatim() {
        assert_eq!(MSG_PRINT_ID_REQUIRED, "打印机ID不能为空");
    }
}
