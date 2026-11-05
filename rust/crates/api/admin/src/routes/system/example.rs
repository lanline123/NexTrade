//! 管理端示例路由（system::example）。
//! 对应原 Java `com.tigshop.adminapi.controller.example.ExampleController`
//! （`@RequestMapping("/adminapi/example/example")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('exampleManage')")`，
//! 类上有 `@Validated`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /example/example/list`        | `ExampleController.list`        | `exampleList` |
//! | `GET  /example/example/detail`      | `ExampleController.detail`      | `exampleDetail` |
//! | `POST /example/example/create`      | `ExampleController.create`      | `exampleCreate` |
//! | `POST /example/example/update`      | `ExampleController.update`      | `exampleUpdate` |
//! | `POST /example/example/del`         | `ExampleController.del`         | `exampleDel` |
//! | `POST /example/example/updateField` | `ExampleController.updateField` | `exampleUpdateField` |
//! | `POST /example/example/batch`       | `ExampleController.batch`       | `exampleBatch` |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/example/example`，
//! > 方法级只有 `/list` 这种短路径，**没有**多余的控制器前缀重复
//! > （`example/example` 的两段分别来自 `controller.example` 包名约定
//! > 与 `@RequestMapping`，是真实路径，必须照抄）。
//! > 最终路径与 `docs/api-contract.json` 逐字符一致。
//!
//! > **权限说明**：本域 7 条各有**不同**的方法级权限（见上表）；
//! > Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 area_code / order_admin / seckill.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照记录。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus `Page<ExampleVO>`，
//! > Rust 统一使用项目既有 `PageResult`，与 product_manage/002/075/163/210 一致。
//!
//! > **`detail` 参数名**：Java 是 `@RequestParam Integer id`，
//! > 参数名 **`id`**（与 payment::tax_rate 的 `taxRateId` 不同）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::system::example::{
    BatchDTO, ExampleCreateDTO, ExampleListQuery, ExampleUpdateDTO, ExampleVO, OperateDTO,
    UpdateFieldDTO, MSG_ID_REQUIRED,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::AdminState;

/// 本域全部 7 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 7] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    ("GET", "/example/example/list", "ExampleController.list"),
    ("GET", "/example/example/detail", "ExampleController.detail"),
    (
        "POST",
        "/example/example/create",
        "ExampleController.create",
    ),
    (
        "POST",
        "/example/example/update",
        "ExampleController.update",
    ),
    ("POST", "/example/example/del", "ExampleController.del"),
    (
        "POST",
        "/example/example/updateField",
        "ExampleController.updateField",
    ),
    ("POST", "/example/example/batch", "ExampleController.batch"),
];

/// 示例管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/example/example/list", get(list))
        .route("/example/example/detail", get(detail))
        .route("/example/example/create", post(create))
        .route("/example/example/update", post(update))
        .route("/example/example/del", post(del))
        .route("/example/example/updateField", post(update_field))
        .route("/example/example/batch", post(batch))
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

/// `detail` 的查询参数（Java `@RequestParam Integer id`，必填）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 示例主键（Java 参数名就是 `id`）
    id: Option<i32>,
}

/// `GET /adminapi/example/example/list`：示例分页。
///
/// 对应 Java `ExampleController.list(ExampleListDTO listDTO)`
/// → `ExampleServiceImpl#list`。
///
/// 查询参数按 Java `BasePage` 契约：`isShow` / `keyword` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是 `pageSize`）。
///
/// ⚠️ `isShow` 只有 `0` / `1` 会真正过滤（Java `IsShowType.fromTypeCode`），
/// 其它值与不传都返回全部。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<ExampleListQuery>,
) -> ApiResult<PageResult<ExampleVO>> {
    ok(state.system.example.list(&q).await?)
}

/// `GET /adminapi/example/example/detail?id=`：示例详情。
///
/// 对应 Java `ExampleController.detail(@RequestParam Integer id)`
/// → `ExampleServiceImpl#detail`。
async fn detail(State(state): State<AdminState>, Query(q): Query<IdQuery>) -> ApiResult<ExampleVO> {
    let id = require_positive_id(q.id)?;
    ok(state.system.example.detail(id).await?)
}

/// `POST /adminapi/example/example/create`：新增示例。
///
/// 对应 Java `ExampleController.create(@Valid @RequestBody ExampleCreateDTO dto)`
/// → `ExampleServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端跳转编辑
/// （与 shop_manage/017/075/163/210 的处理方式一致）。
async fn create(
    State(state): State<AdminState>,
    Json(dto): Json<ExampleCreateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state.system.example.create(&dto).await?;
    ok(serde_json::json!({ "exampleId": id }))
}

/// `POST /adminapi/example/example/update`：更新示例。
///
/// 对应 Java `ExampleController.update(@Valid @RequestBody ExampleUpdateDTO dto)`
/// → `ExampleServiceImpl#update`。
///
/// ⚠️ Java 返回 `void`；本实现回传受影响行数。Java **不检查**该值：
/// 记录不存在时影响 0 行也**不报错**，本实现保持一致。
async fn update(
    State(state): State<AdminState>,
    Json(dto): Json<ExampleUpdateDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.system.example.update(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/example/example/del`：删除示例。
///
/// 对应 Java `ExampleController.del(@Valid @RequestBody OperateDTO operateDTO)`
/// → `ExampleServiceImpl`（继承 `BaseServiceImpl#del`）→ `removeById`。
async fn del(
    State(state): State<AdminState>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<serde_json::Value> {
    let id = require_positive_id(dto.id)?;
    let deleted = state.system.example.del(id).await?;
    ok(serde_json::json!({ "deleted": deleted }))
}

/// `POST /adminapi/example/example/updateField`：更新单个字段。
///
/// 对应 Java `ExampleController.updateField(@RequestBody UpdateFieldDTO)`
/// → 白名单 `CheckFieldConstants.EXAMPLE_FIELDS`
/// = `{example_name, is_show, sort_order}`（三项均为真实列）。
async fn update_field(
    State(state): State<AdminState>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.system.example.update_field(&dto).await?;
    ok(serde_json::json!({ "affected": affected }))
}

/// `POST /adminapi/example/example/batch`：批量操作。
///
/// 对应 Java `ExampleController.batch(@Valid @RequestBody BatchDTO batchDTO)`
/// → `BaseServiceImpl#batch`：**仅 `type == "del"` 生效**，
/// 其余类型**静默返回 `false`**（不报错）。
async fn batch(
    State(state): State<AdminState>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<serde_json::Value> {
    let affected = state.system.example.batch(&dto).await?;
    let success = dto.is_delete() && affected > 0;
    ok(serde_json::json!({ "success": success, "affected": affected }))
}

/// 校验并归一化主键（缺失或非正数都判 400）。
fn require_positive_id(id: Option<i32>) -> Result<i32, AppError> {
    match id {
        Some(v) if v > 0 => Ok(v),
        _ => Err(tigshop_core::Error::Validation(MSG_ID_REQUIRED.to_string()).into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 7 条路由必须与契约逐字符一致（含 `example/example` 重复段）。
    #[test]
    fn implemented_routes_match_contract_paths() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 7, "本域应有 7 条路由");

        let keys: Vec<String> = docs.iter().map(|d| d.key()).collect();
        let expected = [
            "GET /adminapi/example/example/list",
            "GET /adminapi/example/example/detail",
            "POST /adminapi/example/example/create",
            "POST /adminapi/example/example/update",
            "POST /adminapi/example/example/del",
            "POST /adminapi/example/example/updateField",
            "POST /adminapi/example/example/batch",
        ];
        for e in expected {
            assert!(keys.contains(&e.to_string()), "缺少路由 {e}；实际={keys:?}");
        }
        assert_eq!(keys.len(), expected.len(), "不应有多余路由");
    }

    /// Java 引用必须指向 `ExampleController.*`。
    #[test]
    fn implemented_routes_reference_java_handlers() {
        for d in implemented_routes() {
            assert!(
                d.java_ref.starts_with("ExampleController."),
                "java_ref 异常: {}",
                d.java_ref
            );
        }
    }

    /// `detail` 的 `id` 参数名与校验。
    #[test]
    fn detail_id_param_and_validation() {
        let q: IdQuery = serde_json::from_str(r#"{"id":5}"#).expect("应能解析");
        assert_eq!(q.id, Some(5));

        assert!(require_positive_id(None).is_err());
        assert!(require_positive_id(Some(0)).is_err());
        assert!(require_positive_id(Some(-1)).is_err());
        assert_eq!(require_positive_id(Some(4)).expect("正数应通过"), 4);
    }

    /// `list` 的 `isShow` 参数按 camelCase 解析（Java `ExampleListDTO.isShow`）。
    #[test]
    fn list_query_parses_camel_case_is_show() {
        let q: ExampleListQuery =
            serde_json::from_str(r#"{"isShow":1,"keyword":"k","page":2,"size":30}"#)
                .expect("应能解析");
        assert_eq!(q.is_show, Some(1));
        assert_eq!(q.keyword.as_deref(), Some("k"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));
    }

    /// `batch` 的 success 语义：只有 del 且删到行才算成功。
    #[test]
    fn batch_success_semantics() {
        let not_del = BatchDTO {
            ids: Some(vec![1]),
            r#type: Some("show".into()),
            ..Default::default()
        };
        assert!(!(not_del.is_delete() && 3 > 0));

        let del_zero = BatchDTO {
            ids: Some(vec![1]),
            r#type: Some("del".into()),
            ..Default::default()
        };
        assert!(!(del_zero.is_delete() && 0 > 0));
        assert!(del_zero.is_delete() && 2 > 0);
    }

    /// 路由表条目数固定为 7（防误删）。
    #[test]
    fn route_table_size_is_seven() {
        assert_eq!(ROUTE_TABLE.len(), 7);
    }
}
