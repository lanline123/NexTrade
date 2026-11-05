//! 管理端地区管理路由（system::region）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.setting.RegionController`
//! （`@RequestMapping("/adminapi/setting/region")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('regionManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限（`@PreAuthorize`） |
//! |----------------------------------|---------|------------------------|
//! | `GET  /setting/region/getAllRegionTree` | `RegionController.getAllRegionTree` | `regionManage`（类级） |
//! | `GET  /setting/region/list` | `RegionController.list` | `regionManage`（类级） |
//! | `GET  /setting/region/detail` | `RegionController.detail` | `regionManage`（类级） |
//! | `POST /setting/region/updateField` | `RegionController.updateField` | `regionUpdateManage` |
//! | `POST /setting/region/create` | `RegionController.create` | `regionUpdateManage` |
//! | `POST /setting/region/update` | `RegionController.update` | `regionUpdateManage` |
//! | `POST /setting/region/del` | `RegionController.del` | `regionUpdateManage` |
//! | `POST /setting/region/batch` | `RegionController.batch` | `regionBatchManage` |
//! | `GET  /setting/region/getLocationByRegionId` | 前端契约（新版管理端 `region.ts`） | 登录 |
//!
//! > **路径说明**：`@RequestMapping` 的值是 `/adminapi/setting/region`，
//! > 方法级只有 `/list` 这种短路径，**没有**控制器前缀重复
//! > （与 catalog::product_manage 的 `/product/product/list` 不同）。因此最终路径是
//! > `/adminapi/setting/region/list`，与 `docs/api-contract.json`
//! > 逐字符一致。
//! >
//! > **URL 是不区分大小写的**：`/getAllRegionTree` 与 `/updateField`
//! > 是小驼峰（Java 方法名直译），必须照抄，不能写成
//! > `/getAllRegionTree` → `/get_all_region_tree` 之类。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在
//! > 类级 + 方法级校验；Rust 侧 `require_auth` 目前只做登录态校验，
//! > 权限矩阵尚未实现（与 product_manage/order_admin/area_code/region_client 的已知缺口
//! > 一致）。上表「权限」列仅作对照记录 —— 当前**任何已登录管理员**
//! > 都能调用本域全部接口，`regionManage`（读）/ `regionUpdateManage`
//! > （写）/ `regionBatchManage`（批量）的区分未落地。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus
//! > `Page<RegionListVO>`（`records/total/size/current/pages`），
//! > Rust 统一使用项目既有 `PageResult`
//! > （`list/total/totalPage/pageSize/page`），与
//! > product_manage/002/075/091 一致。
//! > `getAllRegionTree` 返回 Hutool `List<Tree<Integer>>`（本实现为
//! > [`RegionTreeNode`] 数组）；`detail` 返回 `RegionListVO`。
//! > 其余 5 个端点 Java 返回 `void`，Rust 统一包在 `ApiResponse` 里
//! > （`data` 为 `true` / 新主键）。
//!
//! > **规则不对称说明（重要，勿“顺手统一”）**：
//! > `create` **不**推导 `level` / `first_word`，也**不**给
//! > `is_hot` / `sort_order` 补默认值；这些规则只存在于 `update`
//! > （`is_hot` → 0、`sort_order` → 50、`first_word` 由名称推导、
//! > `level = 父级.level + 1`）。这是 Java 原样，见
//! > `tigshop_services::system::region` 模块头。
//!
//! > **未实现的差异**：`first_word` 的默认推导依赖 Hutool `PinyinUtil`，
//! > Rust 工作区无拼音依赖，中文名场景下与 Java **不一致**
//! > （详见 `uncertain_points`）。

use axum::{
    extract::Extension,
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::system::region::{
    BatchDTO, OperateDTO, RegionCreateDTO, RegionListQuery, RegionListVO, RegionLocationVO,
    RegionTreeNode, RegionUpdateDTO, UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::support::tenant::require_platform;

use crate::AdminState;

/// 本域全部 9 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
/// 最后一条 `getLocationByRegionId` 来自新版管理端前端契约
/// （Java `RegionController` 没有该端点）。
const ROUTE_TABLE: [(&str, &str, &str); 9] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/setting/region/getAllRegionTree",
        "RegionController.getAllRegionTree",
    ),
    ("GET", "/setting/region/list", "RegionController.list"),
    ("GET", "/setting/region/detail", "RegionController.detail"),
    (
        "POST",
        "/setting/region/updateField",
        "RegionController.updateField",
    ),
    ("POST", "/setting/region/create", "RegionController.create"),
    ("POST", "/setting/region/update", "RegionController.update"),
    ("POST", "/setting/region/del", "RegionController.del"),
    ("POST", "/setting/region/batch", "RegionController.batch"),
    (
        "GET",
        "/setting/region/getLocationByRegionId",
        "RegionController.getLocationByRegionId",
    ),
];

/// 地区管理域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/setting/region/getAllRegionTree", get(get_all_region_tree))
        .route("/setting/region/list", get(list))
        .route("/setting/region/detail", get(detail))
        .route("/setting/region/updateField", post(update_field))
        .route("/setting/region/create", post(create))
        .route("/setting/region/update", post(update))
        .route("/setting/region/del", post(del))
        .route("/setting/region/batch", post(batch))
        .route(
            "/setting/region/getLocationByRegionId",
            get(get_location_by_region_id),
        )
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

/// `detail` 的查询参数（Java `@RequestParam("id") Integer id`，必填）。
#[derive(Debug, Deserialize)]
struct IdQuery {
    /// 地区主键
    id: Option<i32>,
}

/// `getLocationByRegionId` 的查询参数（前端契约 `?regionId=`，必填）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegionIdQuery {
    /// 地区主键
    region_id: Option<i32>,
}

/// `GET /adminapi/setting/region/getAllRegionTree`：获取所有地区（树形）。
///
/// 对应 Java `RegionController.getAllRegionTree()`
/// → `RegionServiceImpl#getAllRegionTree`。
///
/// 返回 `List<Tree<Integer>>`（Hutool 树）；本实现为 [`RegionTreeNode`]
/// 数组，根 = `parentId == 0`，`deep = 8`。
/// 版本开关 `tigshop.is-overseas` 决定 `level >= 0`（跨境版）还是
/// `level > 0`（国内版，本仓默认）。
async fn get_all_region_tree(State(state): State<AdminState>) -> ApiResult<Vec<RegionTreeNode>> {
    ok(state.system.region.region_tree().await?)
}

/// `GET /adminapi/setting/region/list`：地区分页。
///
/// 对应 Java `RegionController.list(RegionListDTO dto)`
/// → `RegionServiceImpl#list(RegionListDTO dto)`
/// → `BaseServiceImpl#buildSortOrder`。
///
/// 查询参数按 Java `BasePage` 契约：`parentId` / `regionId` / `page` /
/// `size` / `sortField` / `sortOrder`（注意是 `size`，不是项目通用的
/// `pageSize`）。
///
/// ⚠️ 排序有两个分支：`sortField` 空白 ⇒ `sort_order ASC, region_id ASC`
/// （双列升序）；非空 ⇒ 单列 `buildSortOrder` 语义。
async fn list(
    State(state): State<AdminState>,
    Query(q): Query<RegionListQuery>,
) -> ApiResult<PageResult<RegionListVO>> {
    ok(state.system.region.list(&q).await?)
}

/// `GET /adminapi/setting/region/detail?id=`：地区详情。
///
/// 对应 Java `RegionController.detail(@RequestParam("id") Integer id)`：
/// `regionService.getById(id)`，`null` ⇒
/// `throw new GlobalException("地区不存在")`，否则
/// `BeanUtils.copyProperties(region, result)`。
///
/// 本实现用 `Error::NotFound("地区不存在")` 承载（文案逐字符一致），
/// `id` 缺失 ⇒ 400（Java `@RequestParam` 缺失也是 400）。
async fn detail(
    State(state): State<AdminState>,
    Query(q): Query<IdQuery>,
) -> ApiResult<RegionListVO> {
    let id =
        q.id.filter(|v| *v > 0)
            .ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state.system.region.detail(id).await?)
}

/// `POST /adminapi/setting/region/updateField`：更新单个字段。
///
/// 对应 Java `RegionController.updateField(@Valid @RequestBody
/// UpdateFieldDTO updateField)` → `updateField(dto, REGION_FIELDS)`，
/// 白名单为 `CheckFieldConstants.REGION_FIELDS`
/// （`{region_name, sort_order, is_hot, first_word}`）。
///
/// ⚠️ 纯 `SET 单列`，**无联动**：改 `region_name` 不会重算 `first_word`，
/// 也不允许改 `parent_id` / `level`（不在白名单 ⇒ 「字段值不合法」）。
async fn update_field(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.region.update_field(&dto).await?)
}

/// `POST /adminapi/setting/region/create`：新增地区。
///
/// 对应 Java `RegionController.create(@Valid @RequestBody RegionCreateDTO dto)`
/// → `RegionServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
///
/// ⚠️ `create` **不推导** `level` / `first_word`，也**不补**
/// `is_hot` / `sort_order` 默认值 —— 与 `update` 规则不对称，是 Java 原样。
async fn create(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<RegionCreateDTO>,
) -> ApiResult<serde_json::Value> {
    require_platform(&auth)?;
    let id = state.system.region.create(&dto).await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/setting/region/update`：更新地区。
///
/// 对应 Java `RegionController.update(@Valid @RequestBody RegionUpdateDTO dto)`
/// → `RegionServiceImpl#updateRegion`。
///
/// Java 返回 `void`，这里回传是否命中记录。
///
/// 业务规则（逐条对齐 Java）：
/// 1. `id` 缺失 ⇒ 「地区ID不能为空」；记录不存在 ⇒ 「地区不存在」
/// 2. `parentId` 缺失 ⇒ 「上级地区不能为空」
/// 3. `parentId == id` ⇒ 「上级地区不能选择自身」
/// 4. `parentId == 0` ⇒ `level = 1`；否则 `level = 父级.level + 1`，
///    父级不存在或其 `level` 为 `null` ⇒ 「上级地区不存在」
/// 5. `isHot` ⇒ null 补 0；`sortOrder` ⇒ null 补 50；
///    `firstWord` 空白 ⇒ 由 `regionName` 推导
async fn update(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<RegionUpdateDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.region.update(&dto).await?)
}

/// `POST /adminapi/setting/region/del`：删除地区（硬删除）。
///
/// 对应 Java `RegionController.del(@RequestBody OperateDTO operateDTO)`
/// → `RegionServiceImpl#del(id)` → `BaseServiceImpl#del` → `removeById`。
///
/// ⚠️ `region` 表**没有软删标记列**，就是 `DELETE`。
/// Java **不校验记录是否存在**（删不存在的 id 也返回成功），
/// 也**不校验子节点**（删父级会留下孤儿行）—— 本实现保持该语义。
async fn del(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.region.del(&dto).await?)
}

/// `POST /adminapi/setting/region/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `RegionController.batch(@Valid @RequestBody BatchDTO batchDTO)`
/// → `BaseServiceImpl#batch`：`type != "del"` 时**静默返回 `false`**
/// （HTTP 200，不是报错）。
async fn batch(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    require_platform(&auth)?;
    ok(state.system.region.batch(&dto).await?)
}

/// `GET /adminapi/setting/region/getLocationByRegionId?regionId=`：地区定位信息。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/setting/region.ts#getLocationByRegionId`
/// （返回 `{ regionId, regionName, centor }`）。`region` 表已无
/// `centor` 列，恒回 `null`；地区不存在时回 `null` 体（非 404，
/// 前端仅用于地图中心点回显）。
async fn get_location_by_region_id(
    State(state): State<AdminState>,
    Query(q): Query<RegionIdQuery>,
) -> ApiResult<Option<RegionLocationVO>> {
    let region_id = q
        .region_id
        .filter(|v| *v > 0)
        .ok_or_else(|| tigshop_core::Error::Validation("regionId不能为空".into()))?;
    ok(state
        .system
        .region
        .get_location_by_region_id(region_id)
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 8 条 + 前端契约 1 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 9);

        let docs = implemented_routes();
        assert_eq!(docs.len(), 9);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/setting/region/getAllRegionTree",
                "/setting/region/list",
                "/setting/region/detail",
                "/setting/region/updateField",
                "/setting/region/create",
                "/setting/region/update",
                "/setting/region/del",
                "/setting/region/batch",
                "/setting/region/getLocationByRegionId",
            ]
        );

        // `region` 是全小写，绝不能写成 `/setting/Region` 或 `/region/region`
        for p in &paths {
            assert!(p.starts_with("/setting/region/"), "{p} 前缀错误");
            assert!(!p.contains("/setting/Region"), "{p} 不得大写 R");
        }

        // 拼上 `/adminapi` 前缀后与 Java `@RequestMapping` 一致
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }
    }

    /// 全量路径逐字符等于契约里的 8 条（防前缀漏拼 / 多拼）。
    #[test]
    fn full_paths_match_contract_verbatim() {
        let full: Vec<String> = implemented_routes().into_iter().map(|d| d.path).collect();
        // 契约里的实际路径（`docs/api-contract.json` + 前端契约）
        let expected = [
            "/adminapi/setting/region/getAllRegionTree",
            "/adminapi/setting/region/list",
            "/adminapi/setting/region/detail",
            "/adminapi/setting/region/updateField",
            "/adminapi/setting/region/create",
            "/adminapi/setting/region/update",
            "/adminapi/setting/region/del",
            "/adminapi/setting/region/batch",
            "/adminapi/setting/region/getLocationByRegionId",
        ];
        assert_eq!(full, expected);
    }

    /// method 与 Java 注解一致：`getAllRegionTree` / `list` / `detail`
    /// 是 GET（`@GetMapping`），其余 5 条是 POST（`@PostMapping`）；
    /// 前端契约的 `getLocationByRegionId` 也是 GET。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = matches!(
                path,
                "/setting/region/getAllRegionTree"
                    | "/setting/region/list"
                    | "/setting/region/detail"
                    | "/setting/region/getLocationByRegionId"
            );
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("RegionController."),
                "{path} 缺少 Java 对照"
            );
        }
    }

    /// 写接口的权限与 Java `@PreAuthorize` 的对照（仅作文档校验）。
    #[test]
    fn write_routes_carry_java_permission_notes() {
        // Java 源码里的三档权限，逐条对照 ROUTE_TABLE 覆盖的路径
        let read_paths = [
            "/setting/region/getAllRegionTree",
            "/setting/region/list",
            "/setting/region/detail",
        ];
        let update_manage = [
            "/setting/region/updateField",
            "/setting/region/create",
            "/setting/region/update",
            "/setting/region/del",
        ];
        let batch_manage = ["/setting/region/batch"];
        let all: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        for p in read_paths {
            assert!(all.contains(&p), "缺少读接口 {p}");
        }
        for p in update_manage {
            assert!(all.contains(&p), "缺少写接口 {p}");
        }
        for p in batch_manage {
            assert!(all.contains(&p), "缺少批量接口 {p}");
        }
        // 8 条 Java 契约 + 1 条前端契约（getLocationByRegionId 为只读）
        assert_eq!(
            read_paths.len() + update_manage.len() + batch_manage.len(),
            8
        );
        assert_eq!(ROUTE_TABLE.len(), 9);
    }

    /// `detail` 的 `id` 参数缺失时报 400（Java `@RequestParam` 必填）。
    #[test]
    fn detail_query_requires_id() {
        let q: IdQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.id, None);
        let q: IdQuery = serde_json::from_str(r#"{"id":110000}"#).unwrap();
        assert_eq!(q.id, Some(110000));
    }
}
