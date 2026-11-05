//! 管理端授权许可路由（system::licensed）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.LicensedController`
//! （`@RequestMapping("/adminapi/setting/licensed")`，3 个端点）。
//!
//! | method | path（挂载于 `/adminapi`） | 原 Java |
//! |--------|---------------------------|---------|
//! | `GET`  | `/setting/licensed/index` | `getLicensedIndex` |
//! | `POST` | `/setting/licensed/saveLicensed` | `saveLicensed` |
//! | `POST` | `/setting/licensed/update` | `update` |
//!
//! # 兼容桩说明
//!
//! Java 的授权模块依赖授权服务器（license 校验、域名绑定、企业版标识），
//! 本部署形态为「无授权」开源运行：`GET index` 固定返回未授权对象
//! （字段名对齐 Java `LicensedSettingsVO` 与前端 `LicensedFormState`，
//! 见 `view/admin/src/types/setting/licensed.d.ts`），两个写接口直接
//! 返回成功（no-op，不落库）。Java 版新工程同样已随授权模块移除
//! `LicensedService` 的实际校验逻辑。

use axum::{
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域 3 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
const ROUTE_TABLE: [(&str, &str, &str); 3] = [
    (
        "GET",
        "/setting/licensed/index",
        "LicensedController.getLicensedIndex",
    ),
    (
        "POST",
        "/setting/licensed/saveLicensed",
        "LicensedController.saveLicensed",
    ),
    (
        "POST",
        "/setting/licensed/update",
        "LicensedController.update",
    ),
];

/// 授权许可路由（挂载于 `/adminapi` 下，外层统一套 `require_auth`）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/licensed/index", get(index))
        .route("/setting/licensed/saveLicensed", post(save_licensed))
        .route("/setting/licensed/update", post(update))
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

/// `POST /setting/licensed/saveLicensed` / `/update` 的请求体。
///
/// Java `LicensedSaveParam` / `LicensedEditParam` 内容依赖授权模块，
/// 桩实现不读取任何字段，只要求 body 为合法 JSON（可为 `{}`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct LicensedBody {}

/// 无授权对象（字段与 Java `LicensedSettingsVO` / 前端 `LicensedFormState` 对齐）。
fn unlicensed_payload() -> Value {
    serde_json::json!({
        "license": "",
        "isLicensed": 0,
        "deCopyright": 0,
        "isEnterprise": -1,
        "licensedType": "",
        "authorizedDomain": "",
        "releaseTime": "",
        "expirationTime": "",
        "versionInfoHidden": 0,
        "poweredBy": 1,
        "poweredByStatus": 0,
        "shopCompany": 1,
        "shopCompanyTxt": "",
        "versionType": "",
        "version": ""
    })
}

/// `GET /adminapi/setting/licensed/index`：授权信息（无授权桩）。
async fn index() -> ApiResult<Value> {
    ok(unlicensed_payload())
}

/// `POST /adminapi/setting/licensed/saveLicensed`：保存授权（no-op 成功）。
async fn save_licensed(Json(_body): Json<LicensedBody>) -> ApiResult<()> {
    ok(())
}

/// `POST /adminapi/setting/licensed/update`：更新授权（no-op 成功）。
async fn update(Json(_body): Json<LicensedBody>) -> ApiResult<()> {
    ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn implemented_routes_match_java_contract() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 3);
        assert_eq!(docs[0].method, "GET");
        assert_eq!(docs[0].path, "/adminapi/setting/licensed/index");
        assert_eq!(docs[1].path, "/adminapi/setting/licensed/saveLicensed");
        assert_eq!(docs[2].path, "/adminapi/setting/licensed/update");
    }

    #[test]
    fn unlicensed_payload_matches_frontend_contract() {
        let v = unlicensed_payload();
        assert_eq!(v["isLicensed"], 0);
        assert_eq!(v["isEnterprise"], -1);
        assert_eq!(v["deCopyright"], 0);
        assert_eq!(v["poweredBy"], 1);
        assert_eq!(v["license"], "");
        assert!(v.get("version").is_some());
    }
}
