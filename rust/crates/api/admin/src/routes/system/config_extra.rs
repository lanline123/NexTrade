//! 管理端展示/接口/主题配置路由（system::config_extra）。
//!
//! Java 来源：`com.tigshop.adminapi.controller.setting.ConfigController`
//! （`@RequestMapping("/adminapi/setting/config")`）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java | config 表 `biz_code` |
//! |--------|---------------------------|---------|----------------------|
//! | `GET`  | `/setting/config/showSettings` | `getShowSettings` | `showSettings` |
//! | `POST` | `/setting/config/saveShow` | `saveShow` | `showSettings` |
//! | `GET`  | `/setting/config/apiSettings` | `getApiSettings` | `apiSettings` |
//! | `POST` | `/setting/config/saveApi` | `saveApi` | `apiSettings` |
//! | `POST` | `/setting/config/saveLayoutThemeSwitch` | `saveLayoutThemeSwitch` | `layoutThemeSwitch` |
//!
//! # 实现方式
//!
//! 与本目录 [`super::config_basic`] 的其余 `get*/save*` 完全同构：
//! `config` 表按 `biz_code` 存整组 JSON（`biz_val`）。读取时
//! `biz_val` 缺失 / 非 JSON 一律回空对象 `{}`（Java 侧为
//! `JsonUtil.fromJson`，空值返回默认实例）；写入走「先删后插」
//! （Java `SettingsHelper#set` 语义，见 `ConfigBasicRepository::save_code`）。
//!
//! > 新版管理端（b2b2b pro）前端实际调用这 5 条
//! （`view/admin/src/api/setting/config.ts` 的
//! `getConfigShow` / `saveConfigShow` / `getConfigApi` / `saveConfigApi` /
//! `saveConfigLayoutThemeSwitch`）。

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use serde_json::{Map, Value};
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// `showSettings` 配置项的 `biz_code`（与 Java `SettingsEnum.SHOW_SETTINGS` 对齐）。
pub const CODE_SHOW_SETTINGS: &str = "showSettings";
/// `apiSettings` 配置项的 `biz_code`。
pub const CODE_API_SETTINGS: &str = "apiSettings";
/// `layoutThemeSwitch` 配置项的 `biz_code`。
pub const CODE_LAYOUT_THEME_SWITCH: &str = "layoutThemeSwitch";
/// `paySettings` 配置项的 `biz_code`。
pub const CODE_PAY_SETTINGS: &str = "paySettings";
/// `storeEntryRule` 配置项的 `biz_code`。
pub const CODE_STORE_ENTRY_RULE: &str = "storeEntryRule";

/// 本域 5 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 5] = [
    (
        "GET",
        "/setting/config/showSettings",
        "ConfigController.getShowSettings",
    ),
    (
        "POST",
        "/setting/config/saveShow",
        "ConfigController.saveShow",
    ),
    (
        "GET",
        "/setting/config/apiSettings",
        "ConfigController.getApiSettings",
    ),
    (
        "POST",
        "/setting/config/saveApi",
        "ConfigController.saveApi",
    ),
    (
        "POST",
        "/setting/config/saveLayoutThemeSwitch",
        "ConfigController.saveLayoutThemeSwitch",
    ),
];

/// 展示/接口/主题配置路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/config/showSettings", get(get_show_settings))
        .route("/setting/config/saveShow", post(save_show))
        .route("/setting/config/apiSettings", get(get_api_settings))
        .route("/setting/config/saveApi", post(save_api))
        .route(
            "/setting/config/saveLayoutThemeSwitch",
            post(save_layout_theme_switch),
        )
        .route(
            "/setting/config/layoutThemeSwitchSettings",
            get(get_layout_theme_switch_settings),
        )
        .route("/setting/config/paySettings", get(get_pay_settings))
        .route("/setting/config/savePay", post(save_pay))
        .route(
            "/setting/config/storeEntryRuleSettings",
            get(get_store_entry_rule_settings),
        )
        .route(
            "/setting/config/saveStoreEntryRule",
            post(save_store_entry_rule),
        )
        .route("/setting/config/save", post(generic_save))
        .route("/setting/config/update", post(generic_save))
}

/// 本域已实现路由（覆盖率统计，完整契约路径）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, handler)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), handler)
        })
        .collect()
}

/// 读取一组 JSON 配置：缺失 / 空 / 非法 JSON 一律回空对象。
async fn read_group(state: &AdminState, code: &str) -> tigshop_core::Result<Value> {
    let raw = state.system.config_basic.repo().find_by_code(code).await?;
    let value = raw
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or_else(|| Value::Object(Map::new()));
    Ok(value)
}

/// 写入一组 JSON 配置（整对象覆盖，Java `SettingsHelper#set` 语义）。
async fn write_group(
    state: &AdminState,
    code: &str,
    body: Map<String, Value>,
) -> tigshop_core::Result<()> {
    let raw = Value::Object(body).to_string();
    state
        .system
        .config_basic
        .repo()
        .save_code(code, &raw)
        .await?;
    Ok(())
}

/// `GET /adminapi/setting/config/showSettings`：读取展示配置。
async fn get_show_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(read_group(&state, CODE_SHOW_SETTINGS).await?)
}

/// `POST /adminapi/setting/config/saveShow`：保存展示配置。
async fn save_show(
    State(state): State<AdminState>,
    Json(body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    write_group(&state, CODE_SHOW_SETTINGS, body).await?;
    ok(())
}

/// `GET /adminapi/setting/config/apiSettings`：读取第三方接口配置。
async fn get_api_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(read_group(&state, CODE_API_SETTINGS).await?)
}

/// `POST /adminapi/setting/config/saveApi`：保存第三方接口配置。
async fn save_api(
    State(state): State<AdminState>,
    Json(body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    write_group(&state, CODE_API_SETTINGS, body).await?;
    ok(())
}

/// `POST /adminapi/setting/config/saveLayoutThemeSwitch`：保存主题切换配置。
async fn save_layout_theme_switch(
    State(state): State<AdminState>,
    Json(body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    write_group(&state, CODE_LAYOUT_THEME_SWITCH, body).await?;
    ok(())
}

/// `GET /adminapi/setting/config/layoutThemeSwitchSettings`：主题切换配置读取。
async fn get_layout_theme_switch_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(read_group(&state, CODE_LAYOUT_THEME_SWITCH).await?)
}

/// `GET /adminapi/setting/config/paySettings`：支付配置读取。
async fn get_pay_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(read_group(&state, CODE_PAY_SETTINGS).await?)
}

/// `POST /adminapi/setting/config/savePay`：保存支付配置。
async fn save_pay(
    State(state): State<AdminState>,
    Json(body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    write_group(&state, CODE_PAY_SETTINGS, body).await?;
    ok(())
}

/// `GET /adminapi/setting/config/storeEntryRuleSettings`：店铺入驻规则读取。
async fn get_store_entry_rule_settings(State(state): State<AdminState>) -> ApiResult<Value> {
    ok(read_group(&state, CODE_STORE_ENTRY_RULE).await?)
}

/// `POST /adminapi/setting/config/saveStoreEntryRule`：保存店铺入驻规则。
async fn save_store_entry_rule(
    State(state): State<AdminState>,
    Json(body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    write_group(&state, CODE_STORE_ENTRY_RULE, body).await?;
    ok(())
}

/// `POST /adminapi/setting/config/save|update`：通用保存（body 携带 `code`
/// 指定 `biz_code`，其余字段为配置内容；b2b2b 前端通用落库入口）。
async fn generic_save(
    State(state): State<AdminState>,
    Json(mut body): Json<Map<String, Value>>,
) -> ApiResult<()> {
    let code = body
        .remove("code")
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default();
    if code.is_empty() {
        return Err(tigshop_security::web::AppError(
            tigshop_core::Error::Validation("缺少配置 code".into()),
        ));
    }
    write_group(&state, &code, body).await?;
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_frontend_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 5);
        let expected = [
            ("GET", "/adminapi/setting/config/showSettings"),
            ("POST", "/adminapi/setting/config/saveShow"),
            ("GET", "/adminapi/setting/config/apiSettings"),
            ("POST", "/adminapi/setting/config/saveApi"),
            ("POST", "/adminapi/setting/config/saveLayoutThemeSwitch"),
        ];
        for (method, path) in expected {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少 {method} {path}"
            );
        }
    }

    #[test]
    fn route_paths_are_unique() {
        let mut keys: Vec<String> = implemented_routes()
            .iter()
            .map(tigshop_openapi::RouteDoc::key)
            .collect();
        let total = keys.len();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), total);
    }
}
