//! 管理端商品属性模板路由（catalog::attributes_tpl）。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.product.AttributesTplController`
//! （`@RequestMapping("/adminapi/product/productAttributesTpl")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('productAttributesTplManage')")`）。
//!
//! ## 原 Java 路径对照表
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java 方法 | 权限（`@PreAuthorize`） |
//! |----------------------------------|--------------|------------------------|
//! | `GET  /product/productAttributesTpl/list` | `AttributesTplController.list` | `productAttributesTplManage`（类级） |
//! | `GET  /product/productAttributesTpl/listByCategory` | `AttributesTplController.listByCategory` | `productAttributesTplManage` / `productManage`（方法级覆盖） |
//! | `GET  /product/productAttributesTpl/detail` | `AttributesTplController.detail` | `productAttributesTplManage`（类级） |
//! | `POST /product/productAttributesTpl/create` | `AttributesTplController.create` | `productAttributesTplModifyManage`（方法级覆盖） |
//! | `POST /product/productAttributesTpl/update` | `AttributesTplController.update` | `productAttributesTplModifyManage`（方法级覆盖） |
//! | `POST /product/productAttributesTpl/del` | `AttributesTplController.del` | `productAttributesTplModifyManage`（方法级覆盖） |
//! | `POST /product/productAttributesTpl/batch` | `AttributesTplController.batch` | `productAttributesTplModifyManage`（方法级覆盖） |
//! | `POST /product/productAttributesTpl/updateField` | `AttributesTplController.updateField` | `productAttributesTplModifyManage`（方法级覆盖） |
//!
//! > **路径说明**：`@RequestMapping` 的值是
//! > `/adminapi/product/productAttributesTpl`，方法级只有 `/list` 这种短路径，
//! > **没有**控制器前缀重复。因此最终路径是
//! > `/adminapi/product/productAttributesTpl/list`（**不是**
//! > `.../productAttributesTpl/productAttributesTpl/list`），
//! > 与 `docs/api-contract.json` 逐字符一致。
//! > 注意 `productAttributesTpl` 是**小驼峰**（不是
//! > `/product_attributes_tpl`），必须照抄。
//!
//! > **权限说明**：Java 用 `@PreAuthorize("@pms.hasPermission(...)")` 在类级 +
//! > 方法级校验；Rust 侧 `require_auth` 目前只做登录态校验，权限矩阵尚未实现
//! > （与 seckill.rs / product_manage.rs / order_admin.rs / area_code.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本域全部接口。
//! > 读权限（`productAttributesTplManage`）与写权限
//! > （`productAttributesTplModifyManage`）的区分同样未落地。
//!
//! > **多租户说明（重要）**：本域**所有 8 条接口**都以
//! > `shop_id = currentShopId()` 为归属边界：
//! > - `list` / `listByCategory` / `detail` 直接按 `shop_id` 过滤查询
//! > - `create` / `update` 把 `shopId` 覆盖为 `currentShopId()`
//! >   （**请求体里的 `shopId` 不被信任**）
//! > - `del` / `batch` / `updateField` 先过 `assertOwned(id)`（`tpl_id` +
//! >   `shop_id` 双条件查询），查不到即报「模板不已存在」
//! >
//! > Java 读请求头 `x-admin-type` / `x-shop-id`（`HeaderUtils.getShopId()`：
//! > `admin` ⇒ 0；`shop` / `pos` ⇒ `x-shop-id`；其余 ⇒ null ⇒ 0）。
//! > Rust 侧 JWT 尚未签发 `shop_id`，故本模块从请求头 `x-shop-id` 解析
//! > （与 admin_user 的处理一致），缺失时回退 0（平台视角）。
//! > ⚠️ **这是一个已知的安全缺口**：任何已登录管理员都能通过手工设置
//! > `x-shop-id` 头读写任意店铺的模板。补齐 `x-admin-type` 判定需要
//! > 鉴权中间件支持，超出本切片范围（见 `uncertain_points`）。
//!
//! > **返回结构说明**：Java `list` 返回 MyBatis-Plus
//! > `Page<AttributesTplDTO>`（`records/total/size/current/pages`），
//! > Rust 统一使用项目既有 `PageResult`（`list/total/totalPage/pageSize/page`），
//! > 与 product_manage/002/005/010/014/017/075 一致。
//! > `listByCategory` Java 返回 `List<AttributesTplDTO>`（不分页），本实现保持。
//! > 其余 6 个端点 Java 返回 `void` / `boolean`，Rust 统一包在 `ApiResponse`
//! > 里（`data` 为 `true` / 新主键）。
//!
//! > **⚠️ 请求体校验说明**：Java 只有 `create` / `update` 的参数带
//! > `@Valid`（`tplName` `@NotNull` + `@Size(max=100)`、`categoryId`
//! > `@NotNull`）。`del` / `batch` / `updateField` 的参数**没有** `@Valid`，
//! > 因此 `OperateDTO.id` / `BatchDTO.ids` / `UpdateFieldDTO.*` 上的
//! > `@NotNull` / `@NotEmpty` **全部不生效**：
//! > - `del {}` ⇒ `assertOwned(null)` ⇒ 「模板不已存在」
//! > - `batch {}` ⇒ 跳过校验 ⇒ `super.batch` ⇒ 静默 `false`
//! > - `updateField {}` ⇒ `assertOwned(null)` ⇒ 「模板不已存在」
//! >
//! > 本实现逐条复刻，**不额外抛 400**（见 `uncertain_points`）。

use axum::{
    extract::{Query, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tigshop_core::models::catalog::attributes_tpl::{
    AttributesTplDTO, AttributesTplListQuery, AttributesTplSaveDTO, BatchDTO, OperateDTO,
    UpdateFieldDTO,
};
use tigshop_core::types::PageResult;
use tigshop_security::web::{ok, ApiResult};

use crate::AdminState;

/// 本域全部 8 条路由（去掉 `/adminapi` 前缀后的路径 + 原 Java handler）。
///
/// **这是 [`implemented_routes`] 的唯一来源**，与 [`routes`] 里的注册一一对应。
const ROUTE_TABLE: [(&str, &str, &str); 8] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "GET",
        "/product/productAttributesTpl/list",
        "AttributesTplController.list",
    ),
    (
        "GET",
        "/product/productAttributesTpl/listByCategory",
        "AttributesTplController.listByCategory",
    ),
    (
        "GET",
        "/product/productAttributesTpl/detail",
        "AttributesTplController.detail",
    ),
    (
        "POST",
        "/product/productAttributesTpl/create",
        "AttributesTplController.create",
    ),
    (
        "POST",
        "/product/productAttributesTpl/update",
        "AttributesTplController.update",
    ),
    (
        "POST",
        "/product/productAttributesTpl/del",
        "AttributesTplController.del",
    ),
    (
        "POST",
        "/product/productAttributesTpl/batch",
        "AttributesTplController.batch",
    ),
    (
        "POST",
        "/product/productAttributesTpl/updateField",
        "AttributesTplController.updateField",
    ),
];

/// 请求头里的店铺 ID 键名（Java `Constants.X_SHOP_ID`）。
const HEADER_SHOP_ID: &str = "x-shop-id";

/// 商品属性模板域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/product/productAttributesTpl/list", get(list))
        .route(
            "/product/productAttributesTpl/listByCategory",
            get(list_by_category),
        )
        .route("/product/productAttributesTpl/detail", get(detail))
        .route("/product/productAttributesTpl/create", post(create))
        .route("/product/productAttributesTpl/update", post(update))
        .route("/product/productAttributesTpl/del", post(del))
        .route("/product/productAttributesTpl/batch", post(batch))
        .route(
            "/product/productAttributesTpl/updateField",
            post(update_field),
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

// ——————————————————————————————————————————————
// 入参提取
// ——————————————————————————————————————————————

/// `detail` 的查询参数（Java `@RequestParam @NotNull Integer id`，必填）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdQuery {
    /// 属性模板主键（Java `AttributesTplDTO.tplId` 的入参名是 `id`）
    id: Option<i32>,
}

/// `listByCategory` 的查询参数
/// （Java `@RequestParam @NotNull(message = "商品类目不能为空") Integer categoryId`）。
///
/// 用 `i32`（非 `Option`）反序列化：缺失时 axum 直接回 400，
/// 与 Java `@NotNull` 的 400 语义一致。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryQuery {
    /// 关联商品类目 ID（`0` 是合法值）
    category_id: i32,
}

/// 读取请求头里的店铺 ID（对应 Java `HeaderUtils.getShopId()` 的请求头部分）。
///
/// Java `getShopId()`：
/// - `x-admin-type == "admin"` ⇒ 恒 `0`（平台视角）
/// - `x-admin-type == "shop"` / `"pos"` ⇒ `x-shop-id`（缺失 ⇒ null ⇒ 调用方 `orElse(0)`）
/// - 其它 ⇒ `null`
///
/// ⚠️ Rust 侧 **尚未实现 `x-admin-type` 判定**（JWT 只签发 `admin_type`，
/// 而本模块的 AuthUser 未注入），因此这里**无条件**读 `x-shop-id`。
/// 补齐后应改成「先判 `x-admin-type`，仅在 shop/pos 时读 `x-shop-id`」。
/// 详见模块头「多租户说明」与 `uncertain_points`。
///
/// 负数与非法值一律被 [`tigshop_services::catalog::attributes_tpl::resolve_shop_id`] 折成 0。
fn header_shop_id(headers: &HeaderMap) -> Option<i32> {
    headers
        .get(HEADER_SHOP_ID)
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| s.parse::<i32>().ok())
}

/// 从请求头解析当前店铺 ID（缺失 / 非法 ⇒ 0，平台视角）。
///
/// 等价于 Java `Optional.ofNullable(HeaderUtils.getShopId()).orElse(0)`。
fn shop_id_of(headers: &HeaderMap) -> i32 {
    tigshop_services::catalog::attributes_tpl::resolve_shop_id(header_shop_id(headers))
}

// ——————————————————————————————————————————————
// GET
// ——————————————————————————————————————————————

/// `GET /adminapi/product/productAttributesTpl/list`：属性模板分页。
///
/// 对应 Java `AttributesTplController.list(BasePage basePage)`
/// → `AttributesTplServiceImpl#list`。
///
/// 查询参数按 Java `BasePage` 契约：`keyword` / `page` / `size` /
/// `sortField` / `sortOrder`（注意是 `size`，不是项目通用的 `pageSize`）。
///
/// ⚠️ Java 在该方法里用 `HeaderUtils.getShopId()` 做**恒定的店铺过滤**，
/// 本模块从 `x-shop-id` 请求头解析后传入（见模块头「多租户说明」）。
async fn list(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<AttributesTplListQuery>,
) -> ApiResult<PageResult<AttributesTplDTO>> {
    ok(state
        .catalog
        .attributes_tpl
        .list(&q, shop_id_of(&headers))
        .await?)
}

/// `GET /adminapi/product/productAttributesTpl/listByCategory?categoryId=`：
/// 按类目获取属性模板（不分页）。
///
/// 对应 Java `AttributesTplController.listByCategory(@RequestParam
/// @NotNull Integer categoryId)` → `AttributesTplServiceImpl#listByCategory`。
///
/// `categoryId` 缺失 ⇒ axum 400（对应 Java `@NotNull` 的 400）。
/// `categoryId = 0` 是合法值。
async fn list_by_category(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<CategoryQuery>,
) -> ApiResult<Vec<AttributesTplDTO>> {
    ok(state
        .catalog
        .attributes_tpl
        .list_by_category(q.category_id, shop_id_of(&headers))
        .await?)
}

/// `GET /adminapi/product/productAttributesTpl/detail?id=`：属性模板详情。
///
/// 对应 Java `AttributesTplController.detail(@RequestParam @NotNull Integer id)`
/// → `AttributesTplServiceImpl#detail`（`convertToDTO(assertOwned(id))`）。
///
/// `id` 缺失 ⇒ 400（对应 Java `@NotNull(message = ID_CANNOT_IS_NULL)`）；
/// 记录不存在或不属于当前店铺 ⇒ `模板不已存在`（404）。
///
/// ⚠️ Java 的两条失败路径（`id == null` 与「查不到」）**文案不同**：
/// 前者由 `@NotNull` 拦在 400，后者由 `assertOwned` 报「模板不已存在」。
/// 本实现同样区分（`Validation` vs `NotFound`）。
async fn detail(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Query(q): Query<IdQuery>,
) -> ApiResult<AttributesTplDTO> {
    let id =
        q.id.ok_or_else(|| tigshop_core::Error::Validation("id不能为空".into()))?;
    ok(state
        .catalog
        .attributes_tpl
        .detail(id, shop_id_of(&headers))
        .await?)
}

// ——————————————————————————————————————————————
// POST
// ——————————————————————————————————————————————

/// `POST /adminapi/product/productAttributesTpl/create`：创建属性模板。
///
/// 对应 Java `AttributesTplController.create(@Valid @RequestBody
/// AttributesTplDTO dto)` → `AttributesTplServiceImpl#create`。
///
/// Java 返回 `void`；此处回传新建主键，便于前端跳转编辑
/// （与 shop_manage / pc_cat_floor / area_code 的处理方式一致）。
///
/// ⚠️ 请求体里的 `shopId` 被**忽略**，一律写入当前店铺
/// （Java 控制器 + 服务层双次 `setShopId`）。
async fn create(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<AttributesTplSaveDTO>,
) -> ApiResult<serde_json::Value> {
    let id = state
        .catalog
        .attributes_tpl
        .create(&dto, shop_id_of(&headers))
        .await?;
    ok(serde_json::json!({ "id": id }))
}

/// `POST /adminapi/product/productAttributesTpl/update`：更新属性模板。
///
/// 对应 Java `AttributesTplController.update(@Valid @RequestBody
/// AttributesTplDTO dto)` → `AttributesTplServiceImpl#update`。
///
/// ⚠️ Java 的顺序是**先 `assertOwned(dto.getTplId())` 再 `@Valid` 校验**：
/// 传不存在的 `tplId` 且 `tplName` 为空时，报的是「模板不已存在」。
/// 本实现保持（服务层 `update` 同样先 `assert_owned`）。
///
/// Java 返回 `void`，这里回传是否命中记录。
async fn update(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<AttributesTplSaveDTO>,
) -> ApiResult<bool> {
    ok(state
        .catalog
        .attributes_tpl
        .update(&dto, shop_id_of(&headers))
        .await?)
}

/// `POST /adminapi/product/productAttributesTpl/del`：删除属性模板（硬删除）。
///
/// 对应 Java `AttributesTplController.del(@RequestBody OperateDTO dto)`
/// → `AttributesTplServiceImpl#del`（`assertOwned(id)` + `removeById`）。
///
/// ⚠️ `product_attributes_tpl` 表**没有**软删标记列，就是 `DELETE`。
/// ⚠️ 控制器参数**没有** `@Valid` ⇒ 传 `{}` 时 `id == null`，
/// 落到 `assertOwned(null)` 报「模板不已存在」（HTTP 200 + 业务码），
/// **不是** 400。本实现复刻。
async fn del(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<OperateDTO>,
) -> ApiResult<bool> {
    ok(state
        .catalog
        .attributes_tpl
        .del(&dto, shop_id_of(&headers))
        .await?)
}

/// `POST /adminapi/product/productAttributesTpl/batch`：批量操作（仅 `del`）。
///
/// 对应 Java `AttributesTplController.batch(@RequestBody BatchDTO dto)`
/// → `AttributesTplServiceImpl#batch` → `BaseServiceImpl#batch`。
///
/// ⚠️ **顺序易漏**：Java 在判断 `type` **之前**先对每个 id 做 `assertOwned`。
/// 因此 `type != "del"` 但 ids 含非本店铺 id 时会**报错**，
/// 而不是静默返回 `false`。详见服务层 [`tigshop_services::catalog::attributes_tpl`] 模块头。
///
/// ⚠️ 控制器参数**没有** `@Valid` ⇒ `ids` 为空 / `type` 缺失都不报 400。
async fn batch(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<BatchDTO>,
) -> ApiResult<bool> {
    ok(state
        .catalog
        .attributes_tpl
        .batch(&dto, shop_id_of(&headers))
        .await?)
}

/// `POST /adminapi/product/productAttributesTpl/updateField`：更新单个字段。
///
/// 对应 Java `AttributesTplController.updateField(@RequestBody
/// UpdateFieldDTO dto)` → `updateField(dto, TPL_FIELDS)`，
/// 白名单为 `CheckFieldConstants.TPL_FIELDS`（**只有 `tpl_name`**）。
///
/// ⚠️ 控制器参数**没有** `@Valid` ⇒ `id` / `field` / `val` 缺失都不报 400：
/// - `id` 缺失 ⇒ `assertOwned(null)` ⇒ 「模板不已存在」
/// - `field` 缺失或不在白名单 ⇒ 「字段值不合法」
/// - `val` 缺失 ⇒ 按空串写入（列 `NOT NULL`，空串合法）
async fn update_field(
    State(state): State<AdminState>,
    headers: HeaderMap,
    Json(dto): Json<UpdateFieldDTO>,
) -> ApiResult<bool> {
    ok(state
        .catalog
        .attributes_tpl
        .update_field(&dto, shop_id_of(&headers))
        .await?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 路由表必须与 `docs/api-contract.json` 的 8 条逐字符一致，
    /// 且 `/adminapi` 前缀只在 `implemented_routes` 拼接时才出现。
    #[test]
    fn route_table_matches_java_contract() {
        assert_eq!(ROUTE_TABLE.len(), 8);

        let docs = implemented_routes();
        assert_eq!(docs.len(), 8);

        let paths: Vec<&str> = ROUTE_TABLE.iter().map(|(_, p, _)| *p).collect();
        assert_eq!(
            paths,
            vec![
                "/product/productAttributesTpl/list",
                "/product/productAttributesTpl/listByCategory",
                "/product/productAttributesTpl/detail",
                "/product/productAttributesTpl/create",
                "/product/productAttributesTpl/update",
                "/product/productAttributesTpl/del",
                "/product/productAttributesTpl/batch",
                "/product/productAttributesTpl/updateField",
            ]
        );

        // `productAttributesTpl` 是小驼峰，绝不能写成下划线写法
        for p in &paths {
            assert!(
                p.starts_with("/product/productAttributesTpl/"),
                "{p} 前缀错误"
            );
            assert!(
                !p.contains("/product_attributes_tpl"),
                "{p} 不得用下划线写法"
            );
        }

        // 拼上 `/adminapi` 前缀后与 Java `@RequestMapping` 一致
        for (_, p, _) in ROUTE_TABLE {
            assert!(p.starts_with('/'));
            assert!(!p.starts_with("/adminapi"));
        }
        for d in &docs {
            assert!(
                d.path
                    .starts_with("/adminapi/product/productAttributesTpl/"),
                "{} 缺少 /adminapi 前缀",
                d.path
            );
        }
    }

    /// Java `@RequestMapping` 组合结果中，控制器前缀**只出现一次**。
    #[test]
    fn controller_prefix_appears_exactly_once() {
        for d in implemented_routes() {
            assert_eq!(
                d.path.matches("productAttributesTpl").count(),
                1,
                "{} 里的控制器前缀重复了",
                d.path
            );
        }
    }

    /// method 与 Java 注解一致：只有 `list` / `listByCategory` / `detail` 是 GET。
    #[test]
    fn http_methods_match_java_annotations() {
        for (method, path, _) in ROUTE_TABLE {
            let expect_get = path.ends_with("/list")
                || path.ends_with("/listByCategory")
                || path.ends_with("/detail");
            assert_eq!(method == "GET", expect_get, "{path} 的 method 不对");
        }
    }

    /// 每条路由都标注了对应的原 Java handler。
    #[test]
    fn every_route_documents_java_handler() {
        for (_, path, java) in ROUTE_TABLE {
            assert!(
                java.starts_with("AttributesTplController."),
                "{path} 缺少 Java 对照"
            );
        }
        // 8 个 handler 名互不相同，且与控制器源码一一对应
        let handlers: Vec<&str> = ROUTE_TABLE.iter().map(|(_, _, j)| *j).collect();
        for h in [
            "AttributesTplController.list",
            "AttributesTplController.listByCategory",
            "AttributesTplController.detail",
            "AttributesTplController.create",
            "AttributesTplController.update",
            "AttributesTplController.del",
            "AttributesTplController.batch",
            "AttributesTplController.updateField",
        ] {
            assert!(handlers.contains(&h), "缺少 {h}");
        }
    }

    // ————————————————————— 请求头解析 —————————————————————

    /// `x-shop-id` 缺失 / 空 / 非法 ⇒ `None`（调用方折成 0）。
    #[test]
    fn header_shop_id_parses_and_rejects_garbage() {
        let mut headers = HeaderMap::new();
        assert_eq!(header_shop_id(&headers), None);
        assert_eq!(shop_id_of(&headers), 0);

        headers.insert(HEADER_SHOP_ID, "7".parse().unwrap());
        assert_eq!(header_shop_id(&headers), Some(7));
        assert_eq!(shop_id_of(&headers), 7);

        // 纯空白 ⇒ 视为缺失（Java `StrUtil.isEmpty` 不 trim，此处更严，
        // 但空白值本就不是合法店铺 ID）
        headers.insert(HEADER_SHOP_ID, "   ".parse().unwrap());
        assert_eq!(header_shop_id(&headers), None);

        // 非数字 ⇒ 视为缺失
        headers.insert(HEADER_SHOP_ID, "abc".parse().unwrap());
        assert_eq!(header_shop_id(&headers), None);

        // 0 是合法值（平台店铺）
        headers.insert(HEADER_SHOP_ID, "0".parse().unwrap());
        assert_eq!(shop_id_of(&headers), 0);

        // 负数被 resolve_shop_id 折成 0（shop_id 列是 int unsigned）
        headers.insert(HEADER_SHOP_ID, "-1".parse().unwrap());
        assert_eq!(header_shop_id(&headers), Some(-1));
        assert_eq!(shop_id_of(&headers), 0);
    }

    /// 多个同名请求头时取第一个（`HeaderMap::get` 语义）。
    #[test]
    fn header_shop_id_takes_first_value() {
        let mut headers = HeaderMap::new();
        headers.append(HEADER_SHOP_ID, "3".parse().unwrap());
        headers.append(HEADER_SHOP_ID, "9".parse().unwrap());
        assert_eq!(header_shop_id(&headers), Some(3));
    }

    // ————————————————————— 查询参数 —————————————————————

    /// `detail` 的入参名是 `id`（不是 `tplId`）。
    #[test]
    fn detail_query_uses_id_param() {
        let q: IdQuery = serde_json::from_str(r#"{"id":12}"#).unwrap();
        assert_eq!(q.id, Some(12));

        let q: IdQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.id, None);

        // `tplId` 不是 Java 的入参名 —— 传了也不认
        let q: IdQuery = serde_json::from_str(r#"{"tplId":12}"#).unwrap();
        assert_eq!(q.id, None, "Java 的 @RequestParam 名是 id，不是 tplId");
    }

    /// `listByCategory` 的入参名是 `categoryId`（必填，`0` 合法）。
    #[test]
    fn category_query_requires_category_id() {
        let q: CategoryQuery = serde_json::from_str(r#"{"categoryId":0}"#).unwrap();
        assert_eq!(q.category_id, 0);

        let q: CategoryQuery = serde_json::from_str(r#"{"categoryId":42}"#).unwrap();
        assert_eq!(q.category_id, 42);

        // 缺失 ⇒ 反序列化失败（对应 Java `@NotNull` 的 400）
        let err = serde_json::from_str::<CategoryQuery>(r#"{}"#);
        assert!(err.is_err(), "categoryId 缺失应当报 400");
    }

    /// 列表查询接受 Java `BasePage` 的参数名（`size` 而非 `pageSize`）。
    #[test]
    fn list_query_accepts_java_param_names() {
        let q: AttributesTplListQuery = serde_json::from_str(
            r#"{"keyword":"手机","page":2,"size":30,"sortField":"tplName","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.effective_keyword(), Some("手机"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY tpl_name ASC");
    }
}
