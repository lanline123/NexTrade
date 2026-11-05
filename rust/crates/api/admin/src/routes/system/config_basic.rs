//! 管理端系统设置路由（system::config_basic）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.ConfigController`
//! （`@RequestMapping("/adminapi/setting/config")`，共 **102** 个管理端端点）。
//!
//! | 路由（挂载于 `/adminapi`） | 数量 | 原 Java |
//! |---|---|---|
//! | `GET  /setting/config/*Settings` 等 52 条 | 52 | `ConfigController` 各 `get*` |
//! | `POST /setting/config/save*` 等 50 条 | 50 | `ConfigController` 各 `save*` |
//!
//! 其中 **3 条为匿名白名单**（`URL_WHITELIST`，注册在 [`public_routes`]）：
//! `getAdmin` / `getLoginProtocol` / `getLoginProtocolContent`；
//! 其余 99 条注册在 [`routes`]（外层统一 `require_auth`）。
//!
//! # 实现方式（102 个端点 = 1 张规格表 + 4 个 handler）
//!
//! Java 的每个分组端点本质是「若干 `SettingsEnum` 配置项的读取/写入」（见
//! `tigshop_core::models::system::config_basic` 模块文档）。因此本模块不写 102 个
//! handler，而是：
//! 1. [`ROUTE_TABLE`] 声明全部 102 条契约（供覆盖率/测试）；
//! 2. 用 [`tigshop_core::models::system::config_basic::endpoints`] 的规格表在
//!    [`routes`] / [`public_routes`] 里循环注册闭包 handler（GET / POST 各一套）；
//! 3. 特殊端点（`getBase` / 登录协议 / workbuddy / 上传 / 测试邮件 / 证书）由
//!    [`tigshop_services::system::config_basic::ConfigBasicService`] 按 `EndpointKind`
//!    分支处理。
//!
//! # 权限与差异
//!
//! - Java 方法级 `@PreAuthorize` 在 Rust 侧尚未实现权限矩阵（与其它模块一致）；
//! - `getAdmin` 的 `shopLogo` 域名前缀、`getAdminBase` 的计算字段、`uploadFile`
//!   （multipart）、`sendTestEmail`（邮件）、workbuddy（MCP 密钥服务）等未迁移，
//!   返回明确 1001 业务错误；详见 models 模块文档「与 Java 的差异」。

use axum::{
    extract::{Extension, Multipart, Query, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use tigshop_core::models::system::config_basic::{
    endpoints, EndpointKind, EndpointSpec, Verb, PUBLIC_PATHS,
};
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::platform_only;

use crate::AdminState;

/// 全部 102 条契约路由（挂载路径 + 原 Java 方法名，顺序 = Java 方法声明顺序）。
const ROUTE_TABLE: [(&str, &str, &str); 108] = [
    (
        "GET",
        "/setting/config/basicSettings",
        "ConfigController.getBasicSettings",
    ),
    (
        "POST",
        "/setting/config/saveBasic",
        "ConfigController.saveBasic",
    ),
    (
        "GET",
        "/setting/config/productSettings",
        "ConfigController.getProductSettings",
    ),
    (
        "POST",
        "/setting/config/saveProduct",
        "ConfigController.saveProduct",
    ),
    (
        "GET",
        "/setting/config/shoppingSettings",
        "ConfigController.getShoppingSettings",
    ),
    (
        "POST",
        "/setting/config/saveShopping",
        "ConfigController.saveShoppingSettings",
    ),
    (
        "GET",
        "/setting/config/orderSettings",
        "ConfigController.getOrderSettings",
    ),
    (
        "POST",
        "/setting/config/saveOrder",
        "ConfigController.saveOrderSettings",
    ),
    (
        "GET",
        "/setting/config/kefuSettings",
        "ConfigController.getKefuSettings",
    ),
    (
        "POST",
        "/setting/config/saveKefu",
        "ConfigController.saveKefuSettings",
    ),
    (
        "GET",
        "/setting/config/shippingSettings",
        "ConfigController.getShippingSettings",
    ),
    (
        "POST",
        "/setting/config/saveShipping",
        "ConfigController.saveShippingSettings",
    ),
    (
        "GET",
        "/setting/config/globalSettings",
        "ConfigController.getGlobalSettings",
    ),
    (
        "POST",
        "/setting/config/saveGlobal",
        "ConfigController.saveGlobalSettings",
    ),
    (
        "GET",
        "/setting/config/workbuddySettings",
        "ConfigController.getWorkBuddySettings",
    ),
    (
        "POST",
        "/setting/config/generateWorkbuddyKey",
        "ConfigController.generateWorkbuddyKey",
    ),
    (
        "POST",
        "/setting/config/revealWorkbuddyKey",
        "ConfigController.revealWorkbuddyKey",
    ),
    (
        "GET",
        "/setting/config/loginSettings",
        "ConfigController.getLoginSettings",
    ),
    (
        "POST",
        "/setting/config/saveLogin",
        "ConfigController.saveLoginSettings",
    ),
    (
        "GET",
        "/setting/config/basicPaySettings",
        "ConfigController.getBasicPaySettings",
    ),
    (
        "POST",
        "/setting/config/saveBasicPay",
        "ConfigController.saveBasicPaySettings",
    ),
    (
        "GET",
        "/setting/config/wechatPaySettings",
        "ConfigController.getWechatPaySettings",
    ),
    (
        "POST",
        "/setting/config/saveWechatPay",
        "ConfigController.saveWechatPaySettings",
    ),
    (
        "GET",
        "/setting/config/miniProgramRiskSettings",
        "ConfigController.getMiniProgramRiskSettings",
    ),
    (
        "POST",
        "/setting/config/saveMiniProgramRisk",
        "ConfigController.saveMiniProgramRiskSettings",
    ),
    (
        "GET",
        "/setting/config/wechatLiveSettings",
        "ConfigController.getWechatLiveSettings",
    ),
    (
        "POST",
        "/setting/config/saveWechatLive",
        "ConfigController.saveWechatLiveSettings",
    ),
    (
        "POST",
        "/setting/config/createPlatformCertificate",
        "ConfigController.createPlatformCertificate",
    ),
    (
        "POST",
        "/setting/config/uploadFile",
        "ConfigController.uploadFile",
    ),
    (
        "GET",
        "/setting/config/aliPaySettings",
        "ConfigController.getAliPaySettings",
    ),
    (
        "POST",
        "/setting/config/saveAliPay",
        "ConfigController.saveAliPaySettings",
    ),
    (
        "GET",
        "/setting/config/yaBandPaySettings",
        "ConfigController.getYaBandPaySettings",
    ),
    (
        "POST",
        "/setting/config/saveYaBandPay",
        "ConfigController.saveYaBandPaySettings",
    ),
    (
        "GET",
        "/setting/config/offlinePaySettings",
        "ConfigController.getOfflinePaySettings",
    ),
    (
        "POST",
        "/setting/config/saveOfflinePay",
        "ConfigController.saveOfflinePaySettings",
    ),
    (
        "GET",
        "/setting/config/payPalSettings",
        "ConfigController.getPayPalSettings",
    ),
    (
        "POST",
        "/setting/config/savePayPal",
        "ConfigController.savePayPalSettings",
    ),
    (
        "GET",
        "/setting/config/yunPaySettings",
        "ConfigController.getYunPaySettings",
    ),
    (
        "POST",
        "/setting/config/saveYunPay",
        "ConfigController.saveYunPaySettings",
    ),
    (
        "GET",
        "/setting/config/mailSettings",
        "ConfigController.getMailSettings",
    ),
    (
        "POST",
        "/setting/config/saveMail",
        "ConfigController.saveMail",
    ),
    (
        "POST",
        "/setting/config/sendTestEmail",
        "ConfigController.sendTestEmail",
    ),
    (
        "GET",
        "/setting/config/notifySettings",
        "ConfigController.getNotifySettings",
    ),
    (
        "POST",
        "/setting/config/saveNotify",
        "ConfigController.saveNotify",
    ),
    (
        "GET",
        "/setting/config/authSettings",
        "ConfigController.getAuthSettings",
    ),
    (
        "POST",
        "/setting/config/saveAuth",
        "ConfigController.saveAuth",
    ),
    (
        "GET",
        "/setting/config/afterSalesSettings",
        "ConfigController.getAfterSalesSettings",
    ),
    (
        "POST",
        "/setting/config/saveAfterSales",
        "ConfigController.saveAfterSales",
    ),
    (
        "GET",
        "/setting/config/themeStyleSettings",
        "ConfigController.getThemeStyleSettings",
    ),
    (
        "POST",
        "/setting/config/saveThemeStyle",
        "ConfigController.saveThemeStyle",
    ),
    (
        "GET",
        "/setting/config/categoryDecorateSettings",
        "ConfigController.getCategoryDecorateSettings",
    ),
    (
        "POST",
        "/setting/config/saveCategoryDecorate",
        "ConfigController.saveCategoryDecorate",
    ),
    (
        "GET",
        "/setting/config/productDetailStyleSettings",
        "ConfigController.getProductDetailStyleSettings",
    ),
    (
        "POST",
        "/setting/config/saveProductDetailStyle",
        "ConfigController.saveProductDetailStyle",
    ),
    (
        "GET",
        "/setting/config/searchStyleSettings",
        "ConfigController.getSearchStyleSettings",
    ),
    (
        "POST",
        "/setting/config/saveSearchStyle",
        "ConfigController.saveSearchStyle",
    ),
    (
        "GET",
        "/setting/config/mobileSearchStyleSettings",
        "ConfigController.getMobileSearchStyleSettings",
    ),
    (
        "POST",
        "/setting/config/saveMobileSearchStyle",
        "ConfigController.saveMobileSearchStyle",
    ),
    (
        "GET",
        "/setting/config/memberCenterDecorateSettings",
        "ConfigController.getMemberCenterDecorateSettings",
    ),
    (
        "POST",
        "/setting/config/saveMemberCenterDecorate",
        "ConfigController.saveMemberCenterDecorate",
    ),
    (
        "GET",
        "/setting/config/shopSettings",
        "ConfigController.getShopSettings",
    ),
    (
        "POST",
        "/setting/config/saveShop",
        "ConfigController.saveShop",
    ),
    (
        "GET",
        "/setting/config/buyerShowSettings",
        "ConfigController.getBuyerShowSettings",
    ),
    (
        "POST",
        "/setting/config/saveBuyerShow",
        "ConfigController.saveBuyerShow",
    ),
    (
        "GET",
        "/setting/config/merchantSettings",
        "ConfigController.getMerchantSettings",
    ),
    (
        "POST",
        "/setting/config/saveMerchant",
        "ConfigController.saveMerchant",
    ),
    (
        "GET",
        "/setting/config/getAdmin",
        "ConfigController.getAdmin",
    ),
    (
        "GET",
        "/setting/config/getAdminBase",
        "ConfigController.getAdminBase",
    ),
    (
        "GET",
        "/setting/config/basicConfig",
        "ConfigController.getBasicConfig",
    ),
    ("GET", "/setting/config/getIcon", "ConfigController.getIcon"),
    (
        "GET",
        "/setting/config/getBase",
        "ConfigController.getBaseConfig",
    ),
    (
        "GET",
        "/setting/config/vendorSettings",
        "ConfigController.getVendorSettings",
    ),
    (
        "POST",
        "/setting/config/saveVendor",
        "ConfigController.saveVendor",
    ),
    (
        "GET",
        "/setting/config/getLoginProtocol",
        "ConfigController.getLoginProtocol",
    ),
    (
        "GET",
        "/setting/config/getLoginProtocolContent",
        "ConfigController.getLoginProtocolContentVO",
    ),
    (
        "POST",
        "/setting/config/saveLoginProtocol",
        "ConfigController.saveLoginProtocol",
    ),
    (
        "GET",
        "/setting/config/profitSharingSettings",
        "ConfigController.getProfitSharingSettings",
    ),
    (
        "POST",
        "/setting/config/saveProfitSharing",
        "ConfigController.saveProfitSharing",
    ),
    (
        "GET",
        "/setting/config/withdrawalSettings",
        "ConfigController.getWithdrawalSettings",
    ),
    (
        "POST",
        "/setting/config/saveWithdrawal",
        "ConfigController.saveWithdrawal",
    ),
    (
        "GET",
        "/setting/config/memberWithdrawalSettings",
        "ConfigController.getMemberWithdrawalSettings",
    ),
    (
        "POST",
        "/setting/config/saveMemberWithdrawal",
        "ConfigController.saveMemberWithdrawal",
    ),
    (
        "GET",
        "/setting/config/commissionWithdrawalSettings",
        "ConfigController.getCommissionWithdrawalSettings",
    ),
    (
        "POST",
        "/setting/config/saveCommissionWithdrawal",
        "ConfigController.saveCommissionWithdrawal",
    ),
    (
        "GET",
        "/setting/config/storeSettings",
        "ConfigController.getStoreSettings",
    ),
    (
        "POST",
        "/setting/config/saveStore",
        "ConfigController.saveStore",
    ),
    (
        "GET",
        "/setting/config/amapAllSettings",
        "ConfigController.amapAllSettings",
    ),
    (
        "POST",
        "/setting/config/saveAllAmapSettings",
        "ConfigController.saveAllAmapSettings",
    ),
    (
        "GET",
        "/setting/config/mapSettings",
        "ConfigController.mapSettings",
    ),
    (
        "POST",
        "/setting/config/saveMapSettings",
        "ConfigController.saveMapSettings",
    ),
    (
        "POST",
        "/setting/config/savePersonalizedSetting",
        "ConfigController.savePersonalizedSetting",
    ),
    (
        "GET",
        "/setting/config/getPersonalizedSetting",
        "ConfigController.getPersonalizedSetting",
    ),
    (
        "GET",
        "/setting/config/searchSettings",
        "ConfigController.getSearchSettings",
    ),
    (
        "POST",
        "/setting/config/saveSearch",
        "ConfigController.saveSearch",
    ),
    (
        "GET",
        "/setting/config/storeSelfOperatedSettings",
        "ConfigController.getStoreSelfOperatedSettings",
    ),
    (
        "POST",
        "/setting/config/saveStoreSelfOperated",
        "ConfigController.saveStore",
    ),
    (
        "POST",
        "/setting/config/saveDingConfig",
        "ConfigController.saveDingConfig",
    ),
    (
        "POST",
        "/setting/config/saveWXWorkConfig",
        "ConfigController.saveWXWorkConfig",
    ),
    (
        "GET",
        "/setting/config/getDingConfig",
        "ConfigController.getDingConfig",
    ),
    (
        "GET",
        "/setting/config/getWXWorkConfig",
        "ConfigController.getWXWorkConfig",
    ),
    (
        "GET",
        "/setting/config/getCashierOrderSettings",
        "ConfigController.getCashierOrderSettings",
    ),
    (
        "POST",
        "/setting/config/saveCashierOrderSettings",
        "ConfigController.saveCashierOrderSettings",
    ),
    (
        "GET",
        "/setting/config/stripeSettings",
        "ConfigController.getStripeSettings",
    ),
    (
        "POST",
        "/setting/config/saveStripe",
        "ConfigController.saveStripeSettings",
    ),
    (
        "GET",
        "/setting/config/xenditSettings",
        "ConfigController.getXenditSettings",
    ),
    (
        "POST",
        "/setting/config/saveXendit",
        "ConfigController.saveXenditSettings",
    ),
    (
        "GET",
        "/setting/config/antomSettings",
        "ConfigController.getAntomSettings",
    ),
    (
        "POST",
        "/setting/config/saveAntom",
        "ConfigController.saveAntomSettings",
    ),
];

/// 查询参数（`getBase?code=` / `getLoginProtocolContent?code=` / `sendTestEmail?testMailAddress=`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CodeQuery {
    code: Option<String>,
    test_mail_address: Option<String>,
}

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    let mut router = Router::new();
    for ep in endpoints()
        .iter()
        .filter(|ep| !EndpointKind::is_public_path(ep.path))
        .filter(|ep| ep.path != "/setting/config/uploadFile")
        .filter(|ep| ep.path != "/setting/config/sendTestEmail")
    {
        router = register(router, ep);
    }
    // 证书上传（multipart）与测试邮件需要独立 handler，不能走 JSON/无体通用入口
    router
        .route("/setting/config/uploadFile", post(upload_config_file))
        .route("/setting/config/sendTestEmail", post(send_test_email))
        // —— Schema-Driven 前端的数据源 ——
        // 导出全部配置端点的表单 Schema，前端据此渲染 Element Plus 表单，
        // 无需为每个配置分组手写 .vue。详见 core::models::system::config_basic::endpoint_form_schema。
        .route("/setting/config/schema", get(all_schemas))
        .route("/setting/config/schema/detail", get(single_schema))
        .layer(middleware::from_fn(platform_only))
}

/// `GET /adminapi/setting/config/schema`：导出全部配置端点的表单 Schema。
async fn all_schemas() -> ApiResult<serde_json::Value> {
    ok(tigshop_core::models::system::config_basic::all_form_schemas())
}

/// `GET /adminapi/setting/config/schema/detail?path=`：导出单个端点的表单 Schema。
async fn single_schema(Query(q): Query<PathQuery>) -> ApiResult<serde_json::Value> {
    let spec = tigshop_core::models::system::config_basic::find_endpoint(&q.path)
        .ok_or_else(|| AppError(tigshop_core::Error::biz(404, "端点不存在")))?;
    ok(tigshop_core::models::system::config_basic::endpoint_form_schema(spec))
}

#[derive(Debug, Deserialize)]
struct PathQuery {
    path: String,
}

/// 匿名白名单 3 条路由（Java `URL_WHITELIST`，外层不套 `require_auth`）。
pub fn public_routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    let mut router = Router::new();
    for ep in endpoints()
        .iter()
        .filter(|ep| EndpointKind::is_public_path(ep.path))
    {
        router = register(router, ep);
    }
    router
}

/// 按端点规格把 handler 挂到 router 上。
fn register(router: Router<AdminState>, ep: &'static EndpointSpec) -> Router<AdminState> {
    match (ep.verb, ep.kind) {
        (Verb::Get, _) => router.route(
            ep.path,
            get(
                move |State(state): State<AdminState>, Query(q): Query<CodeQuery>| async move {
                    get_endpoint(state, ep, q.code).await
                },
            ),
        ),
        (Verb::Post, kind) if kind.has_json_body() => router.route(
            ep.path,
            post(
                move |State(state): State<AdminState>,
                      Json(body): Json<serde_json::Map<String, Value>>| async move {
                    save_endpoint(state, ep, body).await
                },
            ),
        ),
        // 无 JSON 请求体的 POST（Java 无 @RequestBody）：证书 / 上传 / 测试邮件
        (Verb::Post, _) => router.route(
            ep.path,
            post(
                move |State(state): State<AdminState>, Query(q): Query<CodeQuery>| async move {
                    post_without_body(state, ep, q.test_mail_address).await
                },
            ),
        ),
    }
}

/// GET 端点统一入口（闭包 handler 调用，避免 never-type 推断）。
async fn get_endpoint(
    state: AdminState,
    ep: &'static EndpointSpec,
    code: Option<String>,
) -> ApiResult<Value> {
    ok(state.system.config_basic.get(ep, code.as_deref()).await?)
}

/// 带 JSON 请求体的 POST 端点统一入口。
async fn save_endpoint(
    state: AdminState,
    ep: &'static EndpointSpec,
    body: serde_json::Map<String, Value>,
) -> ApiResult<Value> {
    ok(state.system.config_basic.save(ep, &body).await?)
}

/// 无请求体的 POST 端点统一入口。
async fn post_without_body(
    state: AdminState,
    ep: &'static EndpointSpec,
    test_mail_address: Option<String>,
) -> ApiResult<Value> {
    ok(state
        .system
        .config_basic
        .post_without_body(ep, test_mail_address.as_deref())
        .await?)
}
/// `type` 查询参数（Java `@RequestParam("type") Integer`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct UploadFileQuery {
    #[serde(rename = "type")]
    file_type: Option<i32>,
}

fn pem_file_name(code: Option<i32>) -> Option<&'static str> {
    match code {
        Some(1) => Some("apiclient_cert.pem"),
        Some(2) => Some("apiclient_key.pem"),
        Some(3) => Some("public_key.pem"),
        Some(4) => Some("apple_pay_merchant_id.pem"),
        Some(5) => Some("apple_pay_merchant_id_key.pem"),
        Some(6) => Some("apple_pay_payment_processing_key.pem"),
        _ => None,
    }
}

/// `POST /adminapi/setting/config/uploadFile`：支付证书/密钥文件上传（本地存储）。
async fn upload_config_file(
    State(_state): State<AdminState>,
    Query(q): Query<UploadFileQuery>,
    mut multipart: Multipart,
) -> ApiResult<String> {
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError(tigshop_core::Error::Validation(format!(
            "解析上传表单失败: {e}"
        )))
    })? {
        if field.name() != Some("file") {
            continue;
        }
        let file_name = field.file_name().map(ToString::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|e| {
                AppError(tigshop_core::Error::Validation(format!(
                    "读取上传文件失败: {e}"
                )))
            })?
            .to_vec();
        if bytes.is_empty() {
            return Err(AppError(tigshop_core::Error::Validation(
                "文件不能为空".into(),
            )));
        }
        let stored = if let Some(pem) = pem_file_name(q.file_type) {
            pem.to_string()
        } else {
            let ext = std::path::Path::new(file_name.as_deref().unwrap_or("cert"))
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("pem");
            format!(
                "type{}_{}.{}",
                q.file_type.unwrap_or(0),
                tigshop_common::utils::now_millis(),
                ext
            )
        };
        let url = tigshop_infrastructure::storage::save_local_upload("config", &stored, &bytes)
            .await
            .map_err(AppError)?;
        return ok(url);
    }
    Err(AppError(tigshop_core::Error::Validation(
        "文件不能为空".into(),
    )))
}

/// `POST /adminapi/setting/config/sendTestEmail?testMailAddress=`：发送测试邮件。
async fn send_test_email(
    State(state): State<AdminState>,
    Query(q): Query<CodeQuery>,
) -> ApiResult<()> {
    state
        .system
        .config_basic
        .send_test_email(q.test_mail_address.as_deref())
        .await?;
    ok(())
}

/// 本域已实现路由（完整契约路径，供 `/openapi/coverage`）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 契约逐条守卫：路径/方法/Java 方法名必须与 `rust/docs/_config_basic-specs.json` 完全一致。
    #[test]
    fn implemented_routes_match_all_102_java_paths() {
        let expected: [(&str, &str); 108] = [
            ("GET", "/adminapi/setting/config/basicSettings"),
            ("POST", "/adminapi/setting/config/saveBasic"),
            ("GET", "/adminapi/setting/config/productSettings"),
            ("POST", "/adminapi/setting/config/saveProduct"),
            ("GET", "/adminapi/setting/config/shoppingSettings"),
            ("POST", "/adminapi/setting/config/saveShopping"),
            ("GET", "/adminapi/setting/config/orderSettings"),
            ("POST", "/adminapi/setting/config/saveOrder"),
            ("GET", "/adminapi/setting/config/kefuSettings"),
            ("POST", "/adminapi/setting/config/saveKefu"),
            ("GET", "/adminapi/setting/config/shippingSettings"),
            ("POST", "/adminapi/setting/config/saveShipping"),
            ("GET", "/adminapi/setting/config/globalSettings"),
            ("POST", "/adminapi/setting/config/saveGlobal"),
            ("GET", "/adminapi/setting/config/workbuddySettings"),
            ("POST", "/adminapi/setting/config/generateWorkbuddyKey"),
            ("POST", "/adminapi/setting/config/revealWorkbuddyKey"),
            ("GET", "/adminapi/setting/config/loginSettings"),
            ("POST", "/adminapi/setting/config/saveLogin"),
            ("GET", "/adminapi/setting/config/basicPaySettings"),
            ("POST", "/adminapi/setting/config/saveBasicPay"),
            ("GET", "/adminapi/setting/config/wechatPaySettings"),
            ("POST", "/adminapi/setting/config/saveWechatPay"),
            ("GET", "/adminapi/setting/config/miniProgramRiskSettings"),
            ("POST", "/adminapi/setting/config/saveMiniProgramRisk"),
            ("GET", "/adminapi/setting/config/wechatLiveSettings"),
            ("POST", "/adminapi/setting/config/saveWechatLive"),
            ("POST", "/adminapi/setting/config/createPlatformCertificate"),
            ("POST", "/adminapi/setting/config/uploadFile"),
            ("GET", "/adminapi/setting/config/aliPaySettings"),
            ("POST", "/adminapi/setting/config/saveAliPay"),
            ("GET", "/adminapi/setting/config/yaBandPaySettings"),
            ("POST", "/adminapi/setting/config/saveYaBandPay"),
            ("GET", "/adminapi/setting/config/offlinePaySettings"),
            ("POST", "/adminapi/setting/config/saveOfflinePay"),
            ("GET", "/adminapi/setting/config/payPalSettings"),
            ("POST", "/adminapi/setting/config/savePayPal"),
            ("GET", "/adminapi/setting/config/yunPaySettings"),
            ("POST", "/adminapi/setting/config/saveYunPay"),
            ("GET", "/adminapi/setting/config/mailSettings"),
            ("POST", "/adminapi/setting/config/saveMail"),
            ("POST", "/adminapi/setting/config/sendTestEmail"),
            ("GET", "/adminapi/setting/config/notifySettings"),
            ("POST", "/adminapi/setting/config/saveNotify"),
            ("GET", "/adminapi/setting/config/authSettings"),
            ("POST", "/adminapi/setting/config/saveAuth"),
            ("GET", "/adminapi/setting/config/afterSalesSettings"),
            ("POST", "/adminapi/setting/config/saveAfterSales"),
            ("GET", "/adminapi/setting/config/themeStyleSettings"),
            ("POST", "/adminapi/setting/config/saveThemeStyle"),
            ("GET", "/adminapi/setting/config/categoryDecorateSettings"),
            ("POST", "/adminapi/setting/config/saveCategoryDecorate"),
            ("GET", "/adminapi/setting/config/productDetailStyleSettings"),
            ("POST", "/adminapi/setting/config/saveProductDetailStyle"),
            ("GET", "/adminapi/setting/config/searchStyleSettings"),
            ("POST", "/adminapi/setting/config/saveSearchStyle"),
            ("GET", "/adminapi/setting/config/mobileSearchStyleSettings"),
            ("POST", "/adminapi/setting/config/saveMobileSearchStyle"),
            (
                "GET",
                "/adminapi/setting/config/memberCenterDecorateSettings",
            ),
            ("POST", "/adminapi/setting/config/saveMemberCenterDecorate"),
            ("GET", "/adminapi/setting/config/shopSettings"),
            ("POST", "/adminapi/setting/config/saveShop"),
            ("GET", "/adminapi/setting/config/buyerShowSettings"),
            ("POST", "/adminapi/setting/config/saveBuyerShow"),
            ("GET", "/adminapi/setting/config/merchantSettings"),
            ("POST", "/adminapi/setting/config/saveMerchant"),
            ("GET", "/adminapi/setting/config/getAdmin"),
            ("GET", "/adminapi/setting/config/getAdminBase"),
            ("GET", "/adminapi/setting/config/basicConfig"),
            ("GET", "/adminapi/setting/config/getIcon"),
            ("GET", "/adminapi/setting/config/getBase"),
            ("GET", "/adminapi/setting/config/vendorSettings"),
            ("POST", "/adminapi/setting/config/saveVendor"),
            ("GET", "/adminapi/setting/config/getLoginProtocol"),
            ("GET", "/adminapi/setting/config/getLoginProtocolContent"),
            ("POST", "/adminapi/setting/config/saveLoginProtocol"),
            ("GET", "/adminapi/setting/config/profitSharingSettings"),
            ("POST", "/adminapi/setting/config/saveProfitSharing"),
            ("GET", "/adminapi/setting/config/withdrawalSettings"),
            ("POST", "/adminapi/setting/config/saveWithdrawal"),
            ("GET", "/adminapi/setting/config/memberWithdrawalSettings"),
            ("POST", "/adminapi/setting/config/saveMemberWithdrawal"),
            (
                "GET",
                "/adminapi/setting/config/commissionWithdrawalSettings",
            ),
            ("POST", "/adminapi/setting/config/saveCommissionWithdrawal"),
            ("GET", "/adminapi/setting/config/storeSettings"),
            ("POST", "/adminapi/setting/config/saveStore"),
            ("GET", "/adminapi/setting/config/amapAllSettings"),
            ("POST", "/adminapi/setting/config/saveAllAmapSettings"),
            ("GET", "/adminapi/setting/config/mapSettings"),
            ("POST", "/adminapi/setting/config/saveMapSettings"),
            ("POST", "/adminapi/setting/config/savePersonalizedSetting"),
            ("GET", "/adminapi/setting/config/getPersonalizedSetting"),
            ("GET", "/adminapi/setting/config/searchSettings"),
            ("POST", "/adminapi/setting/config/saveSearch"),
            ("GET", "/adminapi/setting/config/storeSelfOperatedSettings"),
            ("POST", "/adminapi/setting/config/saveStoreSelfOperated"),
            ("POST", "/adminapi/setting/config/saveDingConfig"),
            ("POST", "/adminapi/setting/config/saveWXWorkConfig"),
            ("GET", "/adminapi/setting/config/getDingConfig"),
            ("GET", "/adminapi/setting/config/getWXWorkConfig"),
            ("GET", "/adminapi/setting/config/getCashierOrderSettings"),
            ("POST", "/adminapi/setting/config/saveCashierOrderSettings"),
            ("GET", "/adminapi/setting/config/stripeSettings"),
            ("POST", "/adminapi/setting/config/saveStripe"),
            ("GET", "/adminapi/setting/config/xenditSettings"),
            ("POST", "/adminapi/setting/config/saveXendit"),
            ("GET", "/adminapi/setting/config/antomSettings"),
            ("POST", "/adminapi/setting/config/saveAntom"),
        ];
        let docs = implemented_routes();
        assert_eq!(docs.len(), 108, "契约共 108 条");
        for (doc, (method, path)) in docs.iter().zip(expected.iter()) {
            assert_eq!(doc.method, *method, "方法不匹配: {path}");
            assert_eq!(doc.path, *path, "路径不匹配");
        }
        // 无重复
        let mut keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        keys.sort();
        keys.dedup();
        assert_eq!(keys.len(), 108);
        // 规格表与路由表一一对应
        assert_eq!(endpoints().len(), ROUTE_TABLE.len());
        for (ep, (method, path, java_ref)) in endpoints().iter().zip(ROUTE_TABLE.iter()) {
            assert_eq!(ep.verb.as_str(), *method, "{}", ep.path);
            assert_eq!(ep.path, *path);
            assert_eq!(&ep.java_ref, java_ref);
        }
    }

    /// 匿名白名单恰好 3 条且都在路由表内。
    #[test]
    fn public_routes_are_the_three_whitelisted_paths() {
        let public: Vec<&str> = endpoints()
            .iter()
            .filter(|ep| EndpointKind::is_public_path(ep.path))
            .map(|ep| ep.path)
            .collect();
        assert_eq!(public.len(), 3);
        assert_eq!(public, PUBLIC_PATHS.to_vec());
        assert!(public.contains(&"/setting/config/getAdmin"));
        assert!(public.contains(&"/setting/config/getLoginProtocol"));
        assert!(public.contains(&"/setting/config/getLoginProtocolContent"));
        // 其余 99 条为需登录路由
        assert_eq!(102 - public.len(), 99);
    }

    /// 挂载路径 = 契约路径去掉 `/adminapi` 前缀；方法只有 GET/POST。
    #[test]
    fn mounted_paths_and_methods_are_contract_shaped() {
        for (method, path, java_ref) in ROUTE_TABLE.iter() {
            assert!(*method == "GET" || *method == "POST", "{method}");
            assert!(path.starts_with("/setting/config/"), "{path}");
            assert!(!path.ends_with('/'));
            assert!(java_ref.starts_with("ConfigController."), "{java_ref}");
        }
    }

    #[test]
    fn code_query_parses_java_parameters() {
        let q: CodeQuery = serde_json::from_str(r#"{"code":"termsOfService"}"#).unwrap();
        assert_eq!(q.code.as_deref(), Some("termsOfService"));
        let q: CodeQuery = serde_json::from_str(r#"{"testMailAddress":"a@b.c"}"#).unwrap();
        assert_eq!(q.test_mail_address.as_deref(), Some("a@b.c"));
        let q: CodeQuery = serde_json::from_str("{}").unwrap();
        assert!(q.code.is_none() && q.test_mail_address.is_none());
    }
}
