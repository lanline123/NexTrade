//! 管理端消息分类路由（system::message_type）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.MessageTypeController`
//! （`@RequestMapping("/adminapi/setting/messageType")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('messageTypeManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |--------------------------------|---------|------|
//! | `GET  /setting/messageType/list` | `MessageTypeController.list` | `messageTypeManage` |
//! | `GET  /setting/messageType/detail` | `MessageTypeController.detail` | `messageTypeManage` |
//! | `POST /setting/messageType/update` | `MessageTypeController.update` | `messageTypeUpdateManage` |
//! | `POST /setting/messageType/updateField` | `MessageTypeController.updateField` | `messageTypeUpdateManage` |
//! | `POST /setting/messageType/miniProgramMessageTemplate` | `MessageTypeController.miniProgramMessageTemplate` | `miniProgramMessageTemplateManage` |
//! | `POST /setting/messageType/wechatMessageTemplate` | `MessageTypeController.wechatMessageTemplate` | `wechatMessageTemplate` |
//!
//! > **权限说明**：Java 用类级 `messageTypeManage` + 方法级
//! > `messageTypeUpdateManage` / `miniProgramMessageTemplateManage` /
//! > `wechatMessageTemplate` 做校验；Rust 侧 `require_auth` 目前只做登录态
//! > 校验，权限矩阵尚未实现（与其余切片的已知缺口一致）。
//! >
//! > **响应结构说明**：Java `list` 返回 MyBatis-Plus 的
//! > `Page<MessageTypeListVO>`（`records/total/size/current/pages`）；
//! > Rust 统一使用项目既有的 `PageResult`
//! > （`list/total/totalPage/pageSize/page`），与其余切片一致。
//! >
//! > **`detail` 的空值语义**：Java 对不存在的 ID 返回**全空 DTO**（不抛异常），
//! > 因此这里照常返回 200 + 空对象，而不是 404。
//! >
//! > **两个微信模板生成接口**：Java 会调用 `api.weixin.qq.com` 拉取/删除/新增
//! > 模板。Rust 侧尚无微信 access_token 服务，故这两个 handler 返回明确的
//! > 业务错误（`code = 500`，文案说明未启用），**不伪造成功**。
//! > 详见 `crates/services/src/message_type.rs` 的 `uncertain_points` 说明。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::category_all::UpdateFieldDTO;
use tigshop_core::models::system::message_type::{
    MessageTypeDetailDTO, MessageTypeListQuery, MessageTypeListVO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::support::tenant::{platform_only, require_platform};

use crate::AdminState;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/messageType/list", get(list))
        .route("/setting/messageType/detail", get(detail))
        .route("/setting/messageType/update", post(update))
        .route("/setting/messageType/updateField", post(update_field))
        .route(
            "/setting/messageType/miniProgramMessageTemplate",
            post(mini_program_message_template),
        )
        .route(
            "/setting/messageType/wechatMessageTemplate",
            post(wechat_message_template),
        )
        .layer(axum::middleware::from_fn(platform_only))
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        (
            "GET",
            "/adminapi/setting/messageType/list",
            "MessageTypeController.list",
        ),
        (
            "GET",
            "/adminapi/setting/messageType/detail",
            "MessageTypeController.detail",
        ),
        (
            "POST",
            "/adminapi/setting/messageType/update",
            "MessageTypeController.update",
        ),
        (
            "POST",
            "/adminapi/setting/messageType/updateField",
            "MessageTypeController.updateField",
        ),
        (
            "POST",
            "/adminapi/setting/messageType/miniProgramMessageTemplate",
            "MessageTypeController.miniProgramMessageTemplate",
        ),
        (
            "POST",
            "/adminapi/setting/messageType/wechatMessageTemplate",
            "MessageTypeController.wechatMessageTemplate",
        ),
    ]
    .iter()
    .map(|(m, p, j)| tigshop_openapi::RouteDoc::new(m, p, j))
    .collect()
}

/// `GET /adminapi/setting/messageType/detail?id=` 的查询参数。
#[derive(Debug, Deserialize)]
struct IdQuery {
    id: i32,
}

/// `GET /adminapi/setting/messageType/list`：消息分类列表。
///
/// 对应 Java `MessageTypeController.list(MessageTypeListDTO dto)`
/// → `MessageTypeServiceImpl#list`。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<MessageTypeListQuery>,
) -> ApiResult<PageResult<MessageTypeListVO>> {
    ok(state.system.message_type.list(&q).await?)
}

/// `GET /adminapi/setting/messageType/detail?id=`：消息分类详情。
///
/// 对应 Java `MessageTypeController.detail(@RequestParam Integer id)`
/// → `MessageTypeServiceImpl#detail`。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<MessageTypeDetailDTO> {
    ok(state.system.message_type.detail(q.id).await?)
}

/// `POST /adminapi/setting/messageType/update`：修改消息分类。
///
/// 对应 Java `MessageTypeController.update(@Validated @RequestBody
/// MessageTypeDetailDTO dto)` → `MessageTypeServiceImpl#update`。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<MessageTypeDetailDTO>,
) -> ApiResult<&'static str> {
    state.system.message_type.update(&dto).await?;
    ok("修改成功")
}

/// `POST /adminapi/setting/messageType/updateField`：修改消息分类单个字段。
///
/// 对应 Java `MessageTypeController.updateField(@RequestBody @Validated
/// UpdateFieldDTO updateField)` → `BaseServiceImpl#updateField(
/// updateField, CheckFieldConstants.MESSAGE_TYPE_FIELDS)`。
///
/// Java 返回 `void`，此处统一回文案。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<&'static str> {
    state.system.message_type.update_field(&dto).await?;
    ok("修改成功")
}

/// `POST /adminapi/setting/messageType/miniProgramMessageTemplate`：小程序模板生成。
///
/// 对应 Java `MessageTypeController.miniProgramMessageTemplate()`
/// → `MessageTypeServiceImpl#miniProgramMessageTemplate`。
///
/// **未启用**：缺少微信小程序 access_token 服务（见服务层文档）。
async fn mini_program_message_template(State(state): State<AdminState>) -> ApiResult<&'static str> {
    state
        .system
        .message_type
        .mini_program_message_template()
        .await?;
    ok("生成成功")
}

/// `POST /adminapi/setting/messageType/wechatMessageTemplate`：公众号模板生成。
///
/// 对应 Java `MessageTypeController.wechatMessageTemplate()`
/// → `MessageTypeServiceImpl#wechatMessageTemplate`。
///
/// **未启用**：缺少微信公众号 access_token 服务（见服务层文档）。
async fn wechat_message_template(State(state): State<AdminState>) -> ApiResult<&'static str> {
    state.system.message_type.wechat_message_template().await?;
    ok("生成成功")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 逐字符对齐 `rust/docs/api-contract.json` 里本切片的 6 条 path。
    ///
    /// 真实路径常见「控制器前缀重复一次」，本域
    /// `/adminapi/setting/messageType/*` 与前缀一致、**不重复**；
    /// 该断言防止后续被"顺手简化"。
    const CONTRACT_PATHS: [(&str, &str); 6] = [
        ("GET", "/adminapi/setting/messageType/list"),
        ("GET", "/adminapi/setting/messageType/detail"),
        ("POST", "/adminapi/setting/messageType/update"),
        ("POST", "/adminapi/setting/messageType/updateField"),
        (
            "POST",
            "/adminapi/setting/messageType/miniProgramMessageTemplate",
        ),
        (
            "POST",
            "/adminapi/setting/messageType/wechatMessageTemplate",
        ),
    ];

    #[test]
    fn implemented_routes_match_contract_exactly() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), CONTRACT_PATHS.len());
        for (method, path) in CONTRACT_PATHS {
            assert!(
                docs.iter().any(|d| d.method == method && d.path == path),
                "缺少契约路由 {method} {path}"
            );
        }
    }

    #[test]
    fn route_paths_are_case_sensitive_as_in_java() {
        let docs = implemented_routes();
        let paths: Vec<&str> = docs.iter().map(|d| d.path.as_str()).collect();
        // 大小写必须完全一致：messageType / updateField / miniProgram… / wechat…
        assert!(paths.contains(&"/adminapi/setting/messageType/updateField"));
        assert!(paths.contains(&"/adminapi/setting/messageType/miniProgramMessageTemplate"));
        assert!(paths.contains(&"/adminapi/setting/messageType/wechatMessageTemplate"));
        // 常见写错形式不得出现
        assert!(!paths.iter().any(|p| p.contains("messagetype")));
        assert!(!paths.iter().any(|p| p.contains("updatefield")));
        assert!(!paths.iter().any(|p| p.contains("WxWork")));
    }

    #[test]
    fn router_paths_strip_adminapi_prefix() {
        // `routes()` 里注册的是去掉 `/adminapi` 的相对路径
        let stripped: Vec<&str> = CONTRACT_PATHS
            .iter()
            .map(|(_, p)| p.strip_prefix("/adminapi").unwrap())
            .collect();
        assert_eq!(stripped[0], "/setting/messageType/list");
        assert_eq!(stripped[5], "/setting/messageType/wechatMessageTemplate");
    }
}

#[cfg(test)]
mod tenant_tests {
    use super::*;

    #[test]
    fn shop_account_is_rejected_by_platform_guard() {
        let admin = AuthUser::new(1, "a".into(), None, Some("admin".into()), Some(0));
        assert!(require_platform(&admin).is_ok());
        let shop = AuthUser::new(2, "s".into(), None, Some("shop".into()), Some(7));
        assert!(require_platform(&shop).is_err());
        assert_eq!(shop.scoped_shop_id(), Some(7));
        assert_eq!(admin.scoped_shop_id(), None);
    }
}
