//! 配置 —— 商城前台路由（system::config_client）。
//!
//! 原 Java：`com.tigshop.api.controller.common.ConfigController`
//! （`java/tigshop-api/src/main/java/com/tigshop/api/controller/common/ConfigController.java`，
//! `@RequestMapping("/api/common/config")`，本切片 10 个端点）。
//!
//! ## 原 Java 路径对照表（本模块挂载于 `/api` 之下）
//!
//! | 本模块路由（`routes()` 内） | 原 Java 完整路径 | 原 Java 方法 | 契约 auth |
//! |-----------------------------|------------------|--------------|-----------|
//! | `GET /common/config/initConfigSettings` | `GET /api/common/config/initConfigSettings` | `ConfigController.getInitConfigSettings` | optional |
//! | `GET /common/config/themeSettings` | `GET /api/common/config/themeSettings` | `ConfigController.getThemeSettings` | optional |
//! | `GET /common/config/productDetailStyle` | `GET /api/common/config/productDetailStyle` | `ConfigController.getProductDetailStyle` | optional |
//! | `GET /common/config/searchStyle` | `GET /api/common/config/searchStyle` | `ConfigController.getSearchStyle` | optional |
//! | `GET /common/config/mobileSearchStyle` | `GET /api/common/config/mobileSearchStyle` | `ConfigController.getMobileSearchStyle` | optional |
//! | `GET /common/config/base` | `GET /api/common/config/base` | `ConfigController.getBase` | optional |
//! | `GET /common/config/afterSalesService` | `GET /api/common/config/afterSalesService` | `ConfigController.afterSalesService` | optional |
//! | `GET /common/config/mobileAreaCode` | `GET /api/common/config/mobileAreaCode` | `ConfigController.mobileAreaCode` | optional |
//! | `GET /common/config/getLoginProtocol` | `GET /api/common/config/getLoginProtocol` | `ConfigController.getLoginProtocol` | anonymous? |
//! | `GET /common/config/getLoginProtocolContent` | `GET /api/common/config/getLoginProtocolContent` | `ConfigController.getLoginProtocolContentVO` | anonymous? |
//!
//! > **路径说明**：控制器前缀是 `/api/common/config`，方法级 `@GetMapping`
//! > 依次为 `/initConfigSettings`、`/themeSettings`、`/productDetailStyle`、
//! > `/searchStyle`、`/mobileSearchStyle`、`/base`、`/afterSalesService`、
//! > `/mobileAreaCode`、`/getLoginProtocol`、`/getLoginProtocolContent`。
//! > 本域**没有**「控制器名重复一次」的形式。本文件挂载在 `/api` 之下，
//! > 故 `routes()` 内只写 `/common/config/...`；
//! > `implemented_routes()` 里写**完整**契约路径（含 `/api` 前缀）。
//!
//! > **auth=optional / anonymous? 的落地口径**：契约把前 8 条标为
//! > `optional`、后 2 条标为 `anonymous?`（登录页需要读取协议，
//! > 因此必须匿名可达）。Java 侧它们全部在 `permitAll` 之下，
//! > 且**这 10 条方法体都不读任何登录态**
//! > （没有一处调用 `SecurityUtils.getCurrentUserId()`）。
//! > 因此本文件**不挂** [`optional_auth`] 中间件：
//! > 无令牌 / 带非法令牌 / 带合法令牌，响应完全一致
//! > —— 这与 Java 的可观测行为一致（Java 的 JWT 过滤器即使令牌非法，
//! > 对 `permitAll` 路径也不会拦截，只是不写入用户上下文）。
//! > 参见 `crates/api/public/src/routes/wholesale_client.rs` 里为「需要区分游客」
//! > 的场景专门写 `optional_auth` 的做法，本域不需要。
//!
//! > **响应体的 null 语义**：Java 用 `com.tigshop.common.utils.JsonUtil`
//! > （**Jackson** `ObjectMapper.writeValueAsString` +
//! > `Include.ALWAYS` + `INDENT_OUTPUT`）序列化，**保留** null 字段并美化输出。
//! > 本实现用 serde 默认行为（不写 `skip_serializing_if`），
//! > 因此 `None` 字段会输出为 JSON `null`，与 Java 一致。
//! > 注意 `ApiResponse` 自身的 `data` 字段带 `skip_serializing_if`（框架统一行为），
//! > 但本域 10 条路径里只有 `getLoginProtocolContent` 的 `data` 可能为 `None`
//! > （Java 侧该方法 `default: return null`），见该 handler 的说明。

use axum::{
    extract::{Query, State},
    routing::get,
    Router,
};
use tigshop_core::models::system::config_client::{LoginProtocolContentQuery, PreviewIdQuery};
use tigshop_security::web::{ok, ApiResult};

use crate::PublicState;

/// 配置域路由（挂载于 `/api` 下）。
pub fn routes(state: &PublicState) -> Router<PublicState> {
    let _ = state;
    Router::new()
        .route(
            "/common/config/initConfigSettings",
            get(get_init_config_settings),
        )
        .route("/common/config/themeSettings", get(get_theme_settings))
        .route(
            "/common/config/productDetailStyle",
            get(get_product_detail_style),
        )
        .route("/common/config/searchStyle", get(get_search_style))
        .route(
            "/common/config/mobileSearchStyle",
            get(get_mobile_search_style),
        )
        .route("/common/config/base", get(get_base))
        .route(
            "/common/config/afterSalesService",
            get(get_after_sales_service),
        )
        .route("/common/config/mobileAreaCode", get(get_mobile_area_code))
        .route(
            "/common/config/getLoginProtocol",
            get(get_login_protocol),
        )
        .route(
            "/common/config/getLoginProtocolContent",
            get(get_login_protocol_content),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
///
/// `RouteDoc` 的 `method` / `path` 是 `String`，故此处用
/// `&str` 元组 + `.iter()` 映射（`RouteDoc::new` 内部 `to_owned`）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/api/common/config/initConfigSettings",
            "ConfigController.getInitConfigSettings",
        ),
        (
            "GET",
            "/api/common/config/themeSettings",
            "ConfigController.getThemeSettings",
        ),
        (
            "GET",
            "/api/common/config/productDetailStyle",
            "ConfigController.getProductDetailStyle",
        ),
        (
            "GET",
            "/api/common/config/searchStyle",
            "ConfigController.getSearchStyle",
        ),
        (
            "GET",
            "/api/common/config/mobileSearchStyle",
            "ConfigController.getMobileSearchStyle",
        ),
        ("GET", "/api/common/config/base", "ConfigController.getBase"),
        (
            "GET",
            "/api/common/config/afterSalesService",
            "ConfigController.afterSalesService",
        ),
        (
            "GET",
            "/api/common/config/mobileAreaCode",
            "ConfigController.mobileAreaCode",
        ),
        (
            "GET",
            "/api/common/config/getLoginProtocol",
            "ConfigController.getLoginProtocol",
        ),
        (
            "GET",
            "/api/common/config/getLoginProtocolContent",
            "ConfigController.getLoginProtocolContentVO",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /api/common/config/initConfigSettings?previewId=`：获取初始化配置项。
///
/// 对应 Java `ConfigController.getInitConfigSettings`（第 83 行）→
/// `ConfigServiceImpl#getInitConfigSettings(previewId)`。
///
/// `previewId` 为**可选**参数（`required = false`），缺失时为 `null`。
async fn get_init_config_settings(
    State(state): State<PublicState>,
    Query(q): Query<PreviewIdQuery>,
) -> ApiResult<tigshop_core::models::system::config_client::InitConfigSettingsVO> {
    ok(state.system.config_client.init_config_settings(&q).await?)
}

/// `GET /api/common/config/themeSettings`：获取主题配置项。
///
/// 对应 Java `ConfigController.getThemeSettings`（第 89 行）→
/// `ConfigServiceImpl#getThemeSettings`。
async fn get_theme_settings(
    State(state): State<PublicState>,
) -> ApiResult<tigshop_core::models::system::config_client::ThemeSettingsVO> {
    ok(state.system.config_client.theme_settings().await?)
}

/// `GET /api/common/config/productDetailStyle`：获取商品详情页风格。
///
/// 对应 Java `ConfigController.getProductDetailStyle`（第 95 行）→
/// `ConfigServiceImpl#getProductDetailStyleType`。
///
/// 返回裸 `Integer`：1=经典版(old)、2=国内标准版(new)、3=跨境简约版(overseas)；
/// 由后台「装修 → PC端装修 → 商品页风格」`productDetailStyleType` 下发；空 / 非法 ⇒ 1。
/// PC 端 `src/lib/api.ts getProductDetailStyle` 负责把数字映射为三套结构级布局。
async fn get_product_detail_style(State(state): State<PublicState>) -> ApiResult<i32> {
    ok(state.system.config_client.product_detail_style().await?)
}

/// `GET /api/common/config/searchStyle`：获取搜索页风格。
///
/// 对应 Java `ConfigController.getSearchStyle`（第 102 行）→
/// `ConfigServiceImpl#getSearchStyleType`。
async fn get_search_style(State(state): State<PublicState>) -> ApiResult<i32> {
    ok(state.system.config_client.search_style().await?)
}

/// `GET /api/common/config/mobileSearchStyle`：获取移动端搜索风格。
///
/// 对应 Java `ConfigController.getMobileSearchStyle`（第 108 行）→
/// `ConfigServiceImpl#getMobileSearchStyleType`。
async fn get_mobile_search_style(State(state): State<PublicState>) -> ApiResult<i32> {
    ok(state.system.config_client.mobile_search_style().await?)
}

/// `GET /api/common/config/base?previewId=`：获取基础配置。
///
/// 对应 Java `ConfigController.getBase`（第 114 行）→
/// `ConfigServiceImpl#getBase(previewId)`。
///
/// 返回 `Map<String, Object>`（本实现用 `serde_json::Map`）。
async fn get_base(
    State(state): State<PublicState>,
    Query(q): Query<PreviewIdQuery>,
) -> ApiResult<serde_json::Map<String, serde_json::Value>> {
    ok(state.system.config_client.base(&q).await?)
}

/// `GET /api/common/config/afterSalesService`：获取售后服务。
///
/// 对应 Java `ConfigController.afterSalesService`（第 120 行）→
/// `ConfigServiceImpl#getAfterSalesSettings`。
async fn get_after_sales_service(
    State(state): State<PublicState>,
) -> ApiResult<tigshop_core::models::system::config_client::AfterSalesSettingsVO> {
    ok(state.system.config_client.after_sales_service().await?)
}

/// `GET /api/common/config/mobileAreaCode`：获取移动端区号。
///
/// 对应 Java `ConfigController.mobileAreaCode`（第 127 行）→
/// `AreaCodeServiceImpl#mobileAreaCode`。
async fn get_mobile_area_code(
    State(state): State<PublicState>,
) -> ApiResult<Vec<tigshop_core::models::system::config_client::AreaCodeVO>> {
    ok(state.system.config_client.mobile_area_code().await?)
}

/// `GET /api/common/config/getLoginProtocol`：获取登录协议。
///
/// 对应 Java `ConfigController.getLoginProtocol`（第 133 行）→
/// `ConfigServiceImpl#getLoginProtocol`。
async fn get_login_protocol(
    State(state): State<PublicState>,
) -> ApiResult<tigshop_core::models::system::config_client::GetLoginProtocolVO> {
    ok(state.system.config_client.login_protocol().await?)
}

/// `GET /api/common/config/getLoginProtocolContent?code=`：获取登录协议内容。
///
/// 对应 Java `ConfigController.getLoginProtocolContentVO`（第 139 行）→
/// `ConfigServiceImpl#getLoginProtocolContentVO(code)`。
///
/// ⚠️ **与 Java 的一处已知差异**：Java 方法对 `code` 不属于
/// `{termsOfService, privacyPolicy, afterSalesService}` 时 `return null`，
/// 控制器于是直接返回 **`null` 响应体**（不是 `{"code":...,"data":null}`，
/// 因为 Spring 对返回 `null` 的 `@RestController` 方法也会套 `ResultWrapper`
/// —— 实际得到 `{"code":0,"msg":"success","data":null,...}`）。
/// 本实现的 `data` 字段带 `skip_serializing_if = "Option::is_none"`
/// （框架统一约定），因此 `None` 时 **`data` 键缺失**而非 `null`。
/// 这属于框架层的统一取舍，见 `uncertain_points`。
///
/// `code` 在 Java 侧标注为必填（`@RequestParam String code`，**没有**
/// `required = false`），缺失时抛
/// `MissingServletRequestParameterException` ⇒ 业务码 1001。
/// 本实现照抄该约束：缺失 `code` ⇒ `Error::biz(1001, ...)`。
async fn get_login_protocol_content(
    State(state): State<PublicState>,
    Query(q): Query<LoginProtocolContentQuery>,
) -> ApiResult<Option<tigshop_core::models::system::config_client::GetLoginProtocolContentVO>> {
    // Java `@RequestParam String code` 必填：缺失即参数校验异常 ⇒ 1001。
    let code = q
        .code
        .as_deref()
        .ok_or_else(|| tigshop_security::web::AppError(tigshop_core::Error::biz(
            tigshop_services::system::config_client::SERVICE_DATA_ERROR,
            "接口参数缺失",
        )))?;
    ok(state.system.config_client.login_protocol_content(Some(code)).await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `implemented_routes()` 必须逐字符包含契约里的 **10 条**完整路径。
    ///
    /// 期望值直接对着 `rust/docs/api-contract.json` 里的
    /// `path` 字段抄写（**含 `/api` 前缀**），不是对着本文件的
    /// `routes()` 抄 —— 避免「实现与测试互相印证」的假绿。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let got: Vec<(String, String)> = implemented_routes()
            .into_iter()
            .map(|d| (d.method, d.path))
            .collect();

        let expected: Vec<(String, String)> = [
            "/api/common/config/initConfigSettings",
            "/api/common/config/themeSettings",
            "/api/common/config/productDetailStyle",
            "/api/common/config/searchStyle",
            "/api/common/config/mobileSearchStyle",
            "/api/common/config/base",
            "/api/common/config/afterSalesService",
            "/api/common/config/mobileAreaCode",
            "/api/common/config/getLoginProtocol",
            "/api/common/config/getLoginProtocolContent",
        ]
        .iter()
        .map(|p| ("GET".to_string(), (*p).to_string()))
        .collect();

        assert_eq!(got.len(), 10, "本片契约恰好 10 条");
        assert_eq!(got, expected);
    }

    /// 每条路由都带 Java 出处（`ConfigController.<method>`）。
    #[test]
    fn implemented_routes_carry_java_refs() {
        let docs = implemented_routes();
        for d in &docs {
            assert!(
                d.java_ref.starts_with("ConfigController."),
                "java_ref 必须指向 ConfigController，实际为 {}",
                d.java_ref
            );
        }
        // 10 个 handler 名不重复
        let mut refs: Vec<&str> = docs.iter().map(|d| d.java_ref.as_str()).collect();
        refs.sort_unstable();
        refs.dedup();
        assert_eq!(refs.len(), 10);
    }
}