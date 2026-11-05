//! 管理端代客下单优惠券路由（trade::proxy_shopping_user_coupon）。
//!
//! 对应原 Java
//! `com.tigshop.adminapi.controller.proxyshopping.ProxyShoppingUserCouponController`
//! （`@RequestMapping("/adminapi/proxyShopping/coupon")`，
//! 类级 `@PreAuthorize("@pms.hasPermission('proxyShoppingManage')")`）。
//!
//! | 本模块路由（挂载于 `/adminapi`） | 原 Java | 权限 |
//! |----------------------------------|---------|------|
//! | `POST /proxyShopping/coupon/claim` | `ProxyShoppingUserCouponController.claim` | `proxyShoppingManage` |
//!
//! > **路径说明**：控制器前缀 `/adminapi/proxyShopping/coupon` + 方法映射 `/claim`
//! > = `/adminapi/proxyShopping/coupon/claim`，与 `rust/docs/api-contract.json`
//! > 中 `ProxyShoppingUserCouponController.claim`（
//! > `controller\proxyshopping\ProxyShoppingUserCouponController.java:27`）
//! > 逐字符一致。注意 `proxyShopping` 的 **S 大写**、`coupon` 全小写 ——
//! > Spring 路径匹配区分大小写，写错即 404。
//!
//! > **权限说明**：Java 的 `@PreAuthorize` 在**类级**（整个
//! > `ProxyShoppingUserCouponController` 都要求 `proxyShoppingManage`）；
//! > Rust 侧权限矩阵尚未实现，`require_auth`
//! > （由 `api/admin/src/lib.rs::router` 统一套在 `/adminapi` 子树外层）
//! > 只做登录态校验（与 seckill.rs / order_admin.rs / brand.rs /
//! > shop_manage.rs / pc_navigation.rs / buyer_show.rs 的已知缺口一致）。
//! > 上表「权限」列仅作对照，当前**任何已登录管理员**都能调用本接口。
//!
//! > **返回结构说明**：Java `claim` 返回 `void`（HTTP 200 + `data: null`）。
//! > 本实现回传新建 `user_coupon.id`，便于前端/运维核对（与 buyer_show
//! > `create` 回传新建主键的既有约定一致）。
//!
//! > **`userId` 缺省语义**：Java `claim` 在 `param.userId == null` 时回落到
//! > `SecurityUtils.getCurrentUserId()`；管理端上下文里那是**管理员自己的 id**
//! > （不是会员 id）。本实现原样照抄该回落（传 `AuthUser.id`），
//! > **不擅自改成「必须传 userId」** —— 详见
//! > `crates/services/src/proxy_shopping_user_coupon.rs` 模块头第 9 条。
//!
//! > **未迁移依赖**：券关联的 `promotion.member_scope`（会员人群圈选）匹配服务
//! > 整体未迁移（`services/seckill.rs` / `services/time_discount.rs` 亦有同一缺口）。
//! > 配了 `member_scope` 的券在本接口下**明确返回业务错误**
//! > （「您不在该优惠券的领取范围内」），**不静默放行** ——
//! > 详见服务层模块头第 4 条。

use axum::{
    extract::Query,
    extract::State,
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use serde_json::Value;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AuthUser};

use crate::AdminState;

/// 本域路由（去 `/adminapi` 前缀的路径 + 原 Java handler）。
///
/// [`implemented_routes`] 的唯一来源。
/// `visible-list` 来自新版管理端前端契约（Java 控制器未含，
/// 见 `view/admin/src/api/proxyShopping/cart.ts`）。
const ROUTE_TABLE: [(&str, &str, &str); 2] = [
    // (HTTP method, 本模块路径, 原 Java handler)
    (
        "POST",
        "/proxyShopping/coupon/claim",
        "ProxyShoppingUserCouponController.claim",
    ),
    (
        "POST",
        "/proxyShopping/coupon/visible-list",
        "ProxyShoppingUserCouponController.visibleList",
    ),
];

/// 代客下单优惠券域路由（挂载于 `/adminapi` 下，全局 `require_auth` 已生效）。
///
/// 路径逐字符对齐 Java `@RequestMapping("/adminapi/proxyShopping/coupon")` +
/// `@PostMapping("/claim")`。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/proxyShopping/coupon/claim", post(coupon_claim))
        .route(
            "/proxyShopping/coupon/visible-list",
            post(coupon_visible_list).get(coupon_visible_list_get),
        )
}

/// 本域已实现路由（用于 `/openapi/coverage` 覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

/// `claim` 的请求体。
///
/// 对应 Java `com.tigshop.bean.param.user.UserCouponClaimParam`：
/// ```text
/// @NotNull(message = "优惠券主键不能为空") Integer couponId;
/// Integer userId;   // 无 @NotNull
/// ```
///
/// `couponId` 声明为 `Option<i32>` 以便把 Java 的 `@NotNull`
/// （Bean Validation，HTTP 400 + 「优惠券主键不能为空」）在 handler 里
/// 复刻为 `Error::Validation`（与 user_manage/023/024 的既有做法一致）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct ClaimPayload {
    /// 优惠券主键（Java `@NotNull`）
    coupon_id: Option<i32>,
    /// 目标会员 id；缺省时回落到当前登录者（Java `Optional.orElse`）
    user_id: Option<i32>,
}

/// `POST /adminapi/proxyShopping/coupon/claim`：管理端代客领取优惠券。
///
/// 对应 Java `ProxyShoppingUserCouponController.claim(@RequestBody @Validated
/// UserCouponClaimParam)`（`ProxyShoppingUserCouponController.java:30-32`）
/// → `userCouponService.claim(param)`
/// → `UserCouponServiceImpl#claim`（`UserCouponServiceImpl.java:304-392`）。
///
/// Java 返回 `void`；此处回传新建的 `user_coupon.id`。
async fn coupon_claim(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    Json(payload): Json<ClaimPayload>,
) -> ApiResult<i32> {
    let coupon_id = payload
        .coupon_id
        .ok_or_else(|| Error::Validation("优惠券主键不能为空".into()))?;
    let id = state
        .trade
        .proxy_shopping_user_coupon
        .claim(payload.user_id, coupon_id, auth.id)
        .await?;
    ok(id)
}

/// `visible-list` 的请求体（前端 `{ userId, productIds? }`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct VisibleListPayload {
    /// 目标会员 id（可选，当前不参与过滤，保留契约）
    user_id: Option<i32>,
    /// 商品 id 列表（可选，当前不参与过滤，保留契约）
    product_ids: Option<Vec<i32>>,
}

/// `visible-list` 的查询参数（GET 兼容形态：`?userId=&productIds=1,2`）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct VisibleListQuery {
    user_id: Option<i32>,
    product_ids: Option<String>,
}

impl VisibleListQuery {
    fn parse_product_ids(&self) -> Vec<i32> {
        self.product_ids
            .as_deref()
            .unwrap_or_default()
            .split(',')
            .filter_map(|s| s.trim().parse::<i32>().ok())
            .collect()
    }
}

/// `Coupon` 实体 → 前端 camelCase JSON（实体 serde 是 snake_case，
/// 代客下单优惠券抽屉按 Java VO 驼峰字段读取，这里显式映射关键字段）。
fn coupon_to_json(c: &tigshop_core::entities::Coupon) -> Value {
    serde_json::json!({
        "couponId": c.coupon_id,
        "couponName": c.coupon_name,
        "couponMoney": c.coupon_money,
        "couponDiscount": c.coupon_discount,
        "couponDesc": c.coupon_desc,
        "couponType": c.coupon_type,
        "sendRange": c.send_range,
        "sendRangeData": c.send_range_data,
        "minOrderAmount": c.min_order_amount,
        "sendType": c.send_type,
        "useDay": c.use_day,
        "useStartDate": c.use_start_date,
        "useEndDate": c.use_end_date,
        "maxOrderAmount": c.max_order_amount,
        "couponUnit": c.coupon_unit,
        "reduceType": c.reduce_type,
        "limitNum": c.limit_num,
        "sendNum": c.send_num,
        "isNewUser": c.is_new_user,
        "shopId": c.shop_id,
    })
}

/// `POST /adminapi/proxyShopping/coupon/visible-list`：可领取优惠券列表。
///
/// Java 来源：新版管理端前端
/// `view/admin/src/api/proxyShopping/cart.ts#getProxyShoppingCouponList`
/// （body `{ userId, productIds? }`，代客下单优惠券抽屉）。
/// 返回 camelCase 优惠券数组。
async fn coupon_visible_list(
    State(state): State<AdminState>,
    Json(payload): Json<VisibleListPayload>,
) -> ApiResult<Vec<Value>> {
    let list = state
        .trade
        .proxy_shopping_user_coupon
        .visible_list(
            payload.user_id,
            payload.product_ids.as_deref().unwrap_or_default(),
        )
        .await?;
    ok(list.iter().map(coupon_to_json).collect())
}

/// `GET /adminapi/proxyShopping/coupon/visible-list`：同上的 GET 兼容形态。
async fn coupon_visible_list_get(
    State(state): State<AdminState>,
    Query(q): Query<VisibleListQuery>,
) -> ApiResult<Vec<Value>> {
    let list = state
        .trade
        .proxy_shopping_user_coupon
        .visible_list(q.user_id, &q.parse_product_ids())
        .await?;
    ok(list.iter().map(coupon_to_json).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_table_has_contract_paths() {
        assert_eq!(ROUTE_TABLE.len(), 2);
        assert_eq!(ROUTE_TABLE[0].0, "POST");
        assert_eq!(ROUTE_TABLE[0].1, "/proxyShopping/coupon/claim");
        assert_eq!(ROUTE_TABLE[0].2, "ProxyShoppingUserCouponController.claim");
        assert_eq!(ROUTE_TABLE[1].0, "POST");
        assert_eq!(ROUTE_TABLE[1].1, "/proxyShopping/coupon/visible-list");
        assert_eq!(
            ROUTE_TABLE[1].2,
            "ProxyShoppingUserCouponController.visibleList"
        );
    }

    #[test]
    fn implemented_routes_use_adminapi_prefix() {
        let docs = implemented_routes();
        assert_eq!(docs.len(), 2);
        assert_eq!(docs[0].path, "/adminapi/proxyShopping/coupon/claim");
        assert_eq!(docs[0].method, "POST");
        assert_eq!(docs[1].path, "/adminapi/proxyShopping/coupon/visible-list");
    }

    #[test]
    fn payload_accepts_frontend_camel_case_body() {
        // 前端真实提交体（字段名逐字取自 Java `UserCouponClaimParam`）
        let full: ClaimPayload = serde_json::from_str(r#"{"couponId":12,"userId":34}"#).unwrap();
        assert_eq!(full.coupon_id, Some(12));
        assert_eq!(full.user_id, Some(34));

        // 代客下单只传 couponId 时 userId 缺省 → 服务层回落到当前登录者
        let no_user: ClaimPayload = serde_json::from_str(r#"{"couponId":12}"#).unwrap();
        assert_eq!(no_user.coupon_id, Some(12));
        assert_eq!(no_user.user_id, None);

        // userId = 0 是合法入参（服务层不得回落到当前登录者）
        let zero: ClaimPayload = serde_json::from_str(r#"{"couponId":12,"userId":0}"#).unwrap();
        assert_eq!(zero.user_id, Some(0));

        // snake_case 不被接受（与 Java 的驼峰 JSON 契约一致）
        let snake: ClaimPayload = serde_json::from_str(r#"{"coupon_id":12}"#).unwrap();
        assert_eq!(snake.coupon_id, None);
    }

    #[test]
    fn missing_coupon_id_is_validation_error() {
        // Java `@NotNull(message = "优惠券主键不能为空")` 的 Rust 等价
        let payload: ClaimPayload = serde_json::from_str(r#"{"userId":34}"#).unwrap();
        let err = payload
            .coupon_id
            .ok_or_else(|| Error::Validation("优惠券主键不能为空".into()))
            .unwrap_err();
        match err {
            Error::Validation(msg) => assert_eq!(msg, "优惠券主键不能为空"),
            other => panic!("应为 Validation 错误，实际 {other:?}"),
        }
    }
}
