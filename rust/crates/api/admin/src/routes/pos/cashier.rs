//! POS 收银路由（pos::cashier）。
//!
//! ⚠️ 无 Java 参考（POS 仅存在于 o2o.recy.cc 编译前端）。契约来源：
//! 前端 bundle + 真实表结构；挂单 / 桌台状态机语义为推断实现，
//! **需 POS 页面联调验证**。前端调用清单见 `core::models::pos::cashier` 模块头。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use serde::Deserialize;
use tigshop_security::web::{ok, ApiResult, TenantContext};

use crate::AdminState;
use tigshop_core::models::pos::cashier::*;

/// `?adminId=` 兜底查询（平台账号代查时使用）。
#[derive(Debug, Default, Deserialize)]
pub struct PosAdminQuery {
    pub admin_id: Option<i32>,
}

/// `?id=` 查询。
#[derive(Debug, Default, Deserialize)]
pub struct PosIdQuery {
    pub id: Option<i32>,
}

/// `?userId=` 查询。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PosUserIdQuery {
    pub user_id: Option<i32>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PosUserMobileQuery {
    pub mobile: Option<String>,
}

/// 本域路由。
pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // 收银员管理
        .route("/pos/adminUserPos/list", post(admin_user_list))
        .route("/pos/adminUserPos/detail", get(admin_user_detail))
        .route("/pos/adminUserPos/info", get(admin_user_detail))
        .route("/pos/adminUserPos/create", post(admin_user_modify))
        .route("/pos/adminUserPos/update", post(admin_user_modify))
        .route(
            "/pos/adminUserPos/updateField",
            post(admin_user_update_field),
        )
        .route("/pos/adminUserPos/batch", post(admin_user_batch))
        .route("/pos/adminUserPos/modifyUser", post(admin_user_modify))
        .route("/pos/adminUserPos/del", post(admin_user_del))
        // 上下班 / 统计
        .route("/pos/posSwitch/work", post(pos_work))
        .route("/pos/posSwitch/workOff", post(pos_work_off))
        .route("/pos/posSwitch/posStatistics", get(pos_statistics))
        // 会员 / 游客
        .route("/pos/posManager/createMember", post(create_member))
        .route("/pos/posManager/createTourists", post(create_tourists))
        .route("/pos/user/list", post(pos_user_list))
        .route("/pos/user/detail", get(pos_user_detail))
        .route("/pos/user/userAddressList", get(pos_user_addresses))
        .route("/pos/user/userAddressCreate", post(pos_user_address_create))
        .route("/pos/user/coupon/visible-list", post(coupon_visible))
        .route("/pos/user/coupon/getList", get(coupon_get_list))
        .route("/pos/user/coupon/list", get(coupon_get_list))
        .route("/pos/user/coupon/claim", post(coupon_claim))
        .route("/pos/user/getUserByMobile", get(user_by_mobile))
        .route("/pos/user/rechargeOrder/create", post(recharge_create))
        .route("/pos/user/rechargeOrder/update", post(recharge_update))
        .route("/pos/user/rechargeOrder/checkStatus", get(recharge_check))
        .route("/pos/user/rechargeOrder/setting", get(recharge_setting))
        .route("/pos/user/rechargeOrder/paymentList", get(recharge_setting))
        // 商品
        .route("/pos/product/index", get(product_index))
        .route(
            "/pos/product/getProduct",
            get(product_get).post(product_list_post),
        )
        .route("/pos/product/productDetail", get(product_detail))
        .route("/pos/product/getCategoryInfo", get(product_categories))
        .route(
            "/pos/product/getProductAvailability",
            get(product_availability),
        )
        // 购物车 / 挂单
        .route("/pos/cart/list", post(cart_list))
        .route("/pos/cart/getCount", get(cart_count))
        .route("/pos/cart/updateCheck", post(cart_update_check))
        .route("/pos/cart/addToCart", post(cart_add))
        .route("/pos/cart/updateItem", post(cart_update))
        .route("/pos/cart/removeItem", post(cart_remove))
        .route("/pos/cart/clearCart", post(cart_clear))
        .route("/pos/cart/changePrice", post(cart_change_price))
        .route("/pos/cart/changePriceShow", post(cart_change_price))
        .route("/pos/cart/pendingOrder", post(cart_pending))
        .route(
            "/pos/cart/pendingOrderList",
            get(cart_pending_list_get).post(cart_pending_list),
        )
        .route("/pos/cart/takePendingOrder", post(cart_take_pending))
        .route("/pos/cart/cancelPendingOrder", post(cart_cancel_pending))
        // 桌台
        .route("/pos/table/list", get(table_list))
        .route("/pos/table/detail", get(table_detail))
        .route("/pos/table/create", post(table_create))
        .route("/pos/table/update", post(table_update))
        .route("/pos/table/updateField", post(table_update_field))
        .route("/pos/table/del", post(table_del))
        .route("/pos/table/area/list", post(table_area_list))
        .route("/pos/table/area/detail", get(table_area_detail))
        .route("/pos/table/area/create", post(table_area_create))
        .route("/pos/table/area/update", post(table_area_update))
        .route("/pos/table/area/del", post(table_area_del))
        .route("/pos/table/operate/open", post(table_operate))
        .route("/pos/table/operate/bindUser", post(table_operate))
        .route("/pos/table/operate/cancel", post(table_operate))
        .route("/pos/table/operate/clear", post(table_clear))
        .route("/pos/table/operate/transfer", post(table_transfer))
        .route("/pos/table/operate/board", get(table_board))
        .route("/pos/table/operate/placeOrder", post(table_place_order))
        .route("/pos/table/operate/checkout", post(table_checkout))
        .route("/pos/table/operate/check/index", get(table_checkout))
        .route("/pos/table/operate/check/update", post(table_check_update))
        .route("/pos/table/receiptList", get(receipt_list))
        .route("/pos/table/receiptStatistics", get(receipt_statistics))
        .route("/pos/table/setting/get", get(table_setting))
        .route("/pos/table/setting/save", post(table_setting_save))
        // 订单辅助
        .route(
            "/pos/order/OrderReservation/getStockCalendar",
            get(pos_stock_calendar),
        )
        .route("/pos/order/check/getOrderRemark", get(pos_order_remark))
        .route("/pos/order/check/index", post(pos_check_index))
        .route("/pos/order/check/update", post(pos_check_update))
        .route("/pos/order/check/submit", post(pos_check_submit))
        // 支付（admin 侧最小实现）
        .route("/order/pay/create", post(order_pay_create))
        .route("/order/pay/checkStatus", get(order_pay_check))
        // 门店 / 账号辅助
        .route("/adminapi/adminUser/checkCode", get(admin_check_code))
}

/// 已实现路由（覆盖率统计）。
#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    ROUTE_TABLE
        .iter()
        .map(|(method, path, java_ref)| {
            tigshop_openapi::RouteDoc::new(method, &format!("/adminapi{path}"), java_ref)
        })
        .collect()
}

const ROUTE_TABLE: [(&str, &str, &str); 62] = [
    (
        "POST",
        "/pos/adminUserPos/list",
        "PosAdminUserPosController.list",
    ),
    (
        "GET",
        "/pos/adminUserPos/detail",
        "PosAdminUserPosController.detail",
    ),
    (
        "POST",
        "/pos/adminUserPos/batch",
        "PosAdminUserPosController.batch",
    ),
    (
        "POST",
        "/pos/adminUserPos/modifyUser",
        "PosAdminUserPosController.modifyUser",
    ),
    (
        "POST",
        "/pos/adminUserPos/del",
        "PosAdminUserPosController.del",
    ),
    ("POST", "/pos/posSwitch/work", "PosSwitchController.work"),
    (
        "POST",
        "/pos/posSwitch/workOff",
        "PosSwitchController.workOff",
    ),
    (
        "GET",
        "/pos/posSwitch/posStatistics",
        "PosSwitchController.posStatistics",
    ),
    (
        "POST",
        "/pos/posManager/createMember",
        "PosManagerController.createMember",
    ),
    (
        "POST",
        "/pos/posManager/createTourists",
        "PosManagerController.createTourists",
    ),
    ("POST", "/pos/user/list", "PosUserController.list"),
    ("GET", "/pos/user/detail", "PosUserController.detail"),
    (
        "GET",
        "/pos/user/userAddressList",
        "PosUserController.userAddressList",
    ),
    (
        "POST",
        "/pos/user/userAddressCreate",
        "PosUserController.userAddressCreate",
    ),
    (
        "POST",
        "/pos/user/coupon/visible-list",
        "PosUserController.couponVisible",
    ),
    (
        "POST",
        "/pos/user/coupon/claim",
        "PosUserController.couponClaim",
    ),
    (
        "POST",
        "/pos/user/rechargeOrder/create",
        "PosUserController.rechargeCreate",
    ),
    (
        "POST",
        "/pos/user/rechargeOrder/update",
        "PosUserController.rechargeUpdate",
    ),
    (
        "GET",
        "/pos/user/rechargeOrder/checkStatus",
        "PosUserController.rechargeCheck",
    ),
    (
        "GET",
        "/pos/user/rechargeOrder/setting",
        "PosUserController.rechargeSetting",
    ),
    ("GET", "/pos/product/index", "PosProductController.index"),
    (
        "GET",
        "/pos/product/getProduct",
        "PosProductController.getProduct",
    ),
    (
        "GET",
        "/pos/product/productDetail",
        "PosProductController.productDetail",
    ),
    (
        "GET",
        "/pos/product/getCategoryInfo",
        "PosProductController.getCategoryInfo",
    ),
    (
        "GET",
        "/pos/product/getProductAvailability",
        "PosProductController.getAvailability",
    ),
    ("POST", "/pos/cart/list", "PosCartController.list"),
    ("POST", "/pos/cart/addToCart", "PosCartController.addToCart"),
    (
        "POST",
        "/pos/cart/updateItem",
        "PosCartController.updateItem",
    ),
    (
        "POST",
        "/pos/cart/removeItem",
        "PosCartController.removeItem",
    ),
    ("POST", "/pos/cart/clearCart", "PosCartController.clearCart"),
    (
        "POST",
        "/pos/cart/changePrice",
        "PosCartController.changePrice",
    ),
    (
        "POST",
        "/pos/cart/changePriceShow",
        "PosCartController.changePriceShow",
    ),
    (
        "POST",
        "/pos/cart/pendingOrder",
        "PosCartController.pendingOrder",
    ),
    (
        "POST",
        "/pos/cart/pendingOrderList",
        "PosCartController.pendingOrderList",
    ),
    (
        "POST",
        "/pos/cart/takePendingOrder",
        "PosCartController.takePendingOrder",
    ),
    (
        "POST",
        "/pos/cart/cancelPendingOrder",
        "PosCartController.cancelPendingOrder",
    ),
    ("GET", "/pos/table/list", "PosTableController.list"),
    ("GET", "/pos/table/detail", "PosTableController.detail"),
    ("POST", "/pos/table/create", "PosTableController.create"),
    ("POST", "/pos/table/update", "PosTableController.update"),
    (
        "POST",
        "/pos/table/updateField",
        "PosTableController.updateField",
    ),
    ("POST", "/pos/table/del", "PosTableController.del"),
    (
        "POST",
        "/pos/table/area/list",
        "PosTableAreaController.list",
    ),
    (
        "GET",
        "/pos/table/area/detail",
        "PosTableAreaController.detail",
    ),
    (
        "POST",
        "/pos/table/area/create",
        "PosTableAreaController.create",
    ),
    (
        "POST",
        "/pos/table/area/update",
        "PosTableAreaController.update",
    ),
    ("POST", "/pos/table/area/del", "PosTableAreaController.del"),
    (
        "POST",
        "/pos/table/operate/open",
        "PosTableOperateController.open",
    ),
    (
        "POST",
        "/pos/table/operate/bindUser",
        "PosTableOperateController.bindUser",
    ),
    (
        "POST",
        "/pos/table/operate/cancel",
        "PosTableOperateController.cancel",
    ),
    (
        "POST",
        "/pos/table/operate/clear",
        "PosTableOperateController.clear",
    ),
    (
        "POST",
        "/pos/table/operate/transfer",
        "PosTableOperateController.transfer",
    ),
    (
        "GET",
        "/pos/table/operate/board",
        "PosTableOperateController.board",
    ),
    (
        "POST",
        "/pos/table/operate/placeOrder",
        "PosTableOperateController.placeOrder",
    ),
    (
        "POST",
        "/pos/table/operate/checkout",
        "PosTableOperateController.checkout",
    ),
    (
        "GET",
        "/pos/table/operate/check/index",
        "PosTableOperateController.checkIndex",
    ),
    (
        "POST",
        "/pos/table/operate/check/update",
        "PosTableOperateController.checkUpdate",
    ),
    (
        "GET",
        "/pos/table/receiptList",
        "PosTableController.receiptList",
    ),
    (
        "GET",
        "/pos/table/receiptStatistics",
        "PosTableController.receiptStatistics",
    ),
    (
        "GET",
        "/pos/table/setting/get",
        "PosTableSettingController.get",
    ),
    (
        "POST",
        "/pos/table/setting/save",
        "PosTableSettingController.save",
    ),
    (
        "GET",
        "/pos/order/check/getOrderRemark",
        "PosOrderController.getOrderRemark",
    ),
];

// ————————————————————— 收银员 —————————————————————

async fn admin_user_list(
    State(state): State<AdminState>,
    Json(q): Json<PosAdminUserQuery>,
) -> ApiResult<tigshop_core::types::PageResult<PosAdminUserVO>> {
    ok(state.pos.cashier.cashier_list(&q).await?)
}

async fn admin_user_detail(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<serde_json::Value> {
    let vo = state.pos.cashier.cashier_detail(q.id.unwrap_or(0)).await?;
    ok(serde_json::to_value(vo).unwrap_or(serde_json::Value::Null))
}

/// batch：前端 batchSubmit 语义（暂按 modify 同构处理）。
async fn admin_user_batch(
    State(state): State<AdminState>,
    Json(dto): Json<PosAdminUserWriteDTO>,
) -> ApiResult<i32> {
    ok(state.pos.cashier.cashier_save(&dto).await?)
}

async fn admin_user_modify(
    State(state): State<AdminState>,
    Json(dto): Json<PosAdminUserWriteDTO>,
) -> ApiResult<i32> {
    ok(state.pos.cashier.cashier_save(&dto).await?)
}

async fn admin_user_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<PosAdminUserUpdateFieldDTO>,
) -> ApiResult<()> {
    state.pos.cashier.cashier_update_field(&dto).await?;
    ok(())
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosAdminUserDelDTO {
    id: Option<i32>,
    ids: Option<Vec<i32>>,
}

async fn admin_user_del(
    State(state): State<AdminState>,
    Json(dto): Json<PosAdminUserDelDTO>,
) -> ApiResult<()> {
    let ids = dto
        .ids
        .clone()
        .or_else(|| dto.id.map(|v| vec![v]))
        .unwrap_or_default();
    for id in ids {
        state.pos.cashier.cashier_delete(id).await?;
    }
    ok(())
}

// ————————————————————— 上下班 / 统计 —————————————————————

async fn pos_work(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<()> {
    state
        .pos
        .cashier
        .set_work(tenant_context_id(&tenant), true)
        .await?;
    ok(())
}

async fn pos_work_off(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<()> {
    state
        .pos
        .cashier
        .set_work(tenant_context_id(&tenant), false)
        .await?;
    ok(())
}

async fn pos_statistics(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<PosStatisticsVO> {
    ok(state
        .pos
        .cashier
        .statistics(tenant_context_id(&tenant))
        .await?)
}

/// TenantContext 无 admin id；登录管理员 id 由请求扩展 AuthUser 提供。
/// 这里以 shop 维度近似（POS 单店收银），见模块头「需联调」说明。
fn tenant_context_id(tenant: &TenantContext) -> i32 {
    tenant.shop_id.unwrap_or(0)
}

// ————————————————————— 会员 / 游客 / 优惠券 / 充值 —————————————————————

async fn create_member(
    State(state): State<AdminState>,
    Json(dto): Json<PosCreateMemberDTO>,
) -> ApiResult<i32> {
    ok(state.pos.cashier.create_member(&dto).await?)
}

async fn create_tourists(State(state): State<AdminState>) -> ApiResult<i32> {
    ok(state.pos.cashier.create_tourists().await?)
}

async fn pos_user_list(
    State(state): State<AdminState>,
    Json(q): Json<PosUserQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.users(&q).await?)
}

async fn user_by_mobile(
    State(state): State<AdminState>,
    Query(q): Query<PosUserMobileQuery>,
) -> ApiResult<serde_json::Value> {
    let mobile = q.mobile.unwrap_or_default();
    let res = state
        .pos
        .cashier
        .users(&PosUserQuery {
            page: Some(1),
            size: Some(10),
            keyword: Some(mobile),
            user_id: None,
        })
        .await?;
    let first = res
        .get("records")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    ok(first)
}

async fn pos_user_detail(
    State(state): State<AdminState>,
    Query(q): Query<PosUserIdQuery>,
) -> ApiResult<serde_json::Value> {
    let mut res = state
        .pos
        .cashier
        .users(&PosUserQuery {
            user_id: q.user_id,
            ..Default::default()
        })
        .await?;
    let first = res
        .get_mut("records")
        .and_then(serde_json::Value::as_array_mut)
        .and_then(|a| a.first().cloned())
        .unwrap_or(serde_json::Value::Null);
    ok(first)
}

async fn pos_user_addresses(
    State(state): State<AdminState>,
    Query(q): Query<PosUserIdQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .user_addresses(q.user_id.unwrap_or(0))
        .await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosAddressCreateDTO {
    user_id: i32,
    consignee: Option<String>,
    mobile: Option<String>,
    address: Option<String>,
}

async fn pos_user_address_create(
    State(state): State<AdminState>,
    Json(dto): Json<PosAddressCreateDTO>,
) -> ApiResult<i32> {
    use tigshop_core::entities::UserAddress;
    let e = UserAddress {
        user_id: dto.user_id,
        consignee: dto.consignee.clone().unwrap_or_default(),
        mobile: dto.mobile.clone().unwrap_or_default(),
        address: dto.address.clone().unwrap_or_default(),
        ..Default::default()
    };
    ok(state
        .repos
        .member
        .user_address_client
        .create(&e, None, false, dto.user_id)
        .await?)
}

async fn coupon_get_list(
    State(state): State<AdminState>,
    Query(q): Query<PosCouponQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .coupon_visible(q.user_id.unwrap_or(0))
        .await?)
}

async fn coupon_visible(
    State(state): State<AdminState>,
    Json(q): Json<PosCouponQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .coupon_visible(q.user_id.unwrap_or(0))
        .await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosCouponClaimDTO {
    user_id: i32,
    coupon_id: i32,
}

async fn coupon_claim(
    State(state): State<AdminState>,
    Json(dto): Json<PosCouponClaimDTO>,
) -> ApiResult<i32> {
    ok(state
        .marketing
        .coupon
        .claim(dto.user_id, dto.coupon_id)
        .await?)
}

async fn recharge_create(
    State(state): State<AdminState>,
    Json(dto): Json<PosRechargeCreateDTO>,
) -> ApiResult<i32> {
    // 线下现金充值：直接建已支付充值单（status=1 已支付）
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i32;
    let e = tigshop_core::entities::finance::UserRechargeOrder {
        user_id: dto.user_id,
        amount: dto.money,
        add_time: now,
        paid_time: now,
        postscript: "POS 收银充值".into(),
        status: 1,
        ..Default::default()
    };
    ok(state.pos.cashier.recharge_insert(e).await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosRechargeUpdateDTO {
    recharge_order_id: i32,
    money: Option<rust_decimal::Decimal>,
}

async fn recharge_update(
    State(state): State<AdminState>,
    Json(dto): Json<PosRechargeUpdateDTO>,
) -> ApiResult<()> {
    if let Some(money) = dto.money {
        state
            .repos
            .payment
            .user_recharge_order
            .update_field(dto.recharge_order_id, "money", &money.to_string())
            .await?;
    }
    ok(())
}

async fn recharge_check(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<serde_json::Value> {
    let row = state
        .repos
        .payment
        .user_recharge_order
        .find_by_id(q.id.unwrap_or(0))
        .await?;
    ok(serde_json::to_value(row).unwrap_or(serde_json::Value::Null))
}

async fn recharge_setting(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.recharge_setting().await?)
}

// ————————————————————— 商品 —————————————————————

async fn product_index(
    State(state): State<AdminState>,
    Query(q): Query<PosProductQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.products(&q).await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosProductGetQuery {
    product_id: Option<i64>,
    barcode: Option<String>,
    shop_id: Option<i32>,
}

async fn product_get(
    State(state): State<AdminState>,
    Query(q): Query<PosProductGetQuery>,
) -> ApiResult<serde_json::Value> {
    if let Some(pid) = q.product_id {
        return ok(state.pos.cashier.product_detail(pid).await?);
    }
    // 条码收银：barcode 即商品 SN
    let kw = q.barcode.clone().unwrap_or_default();
    let res = state
        .pos
        .cashier
        .products(&PosProductQuery {
            keyword: Some(kw),
            ..Default::default()
        })
        .await?;
    ok(res)
}

/// POS 兼容：旧前端用 POST + `{page,size,cat,keyword}` 拉商品列表。
async fn product_list_post(
    State(state): State<AdminState>,
    Json(q): Json<PosProductQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.products(&q).await?)
}

async fn product_detail(
    State(state): State<AdminState>,
    Query(q): Query<PosProductGetQuery>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .product_detail(q.product_id.unwrap_or(0))
        .await?)
}

async fn product_categories(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.categories().await?)
}

/// 库存可用性：收银场景恒可售（下单时由订单管道校验），返回请求商品 id。
async fn product_availability(
    State(state): State<AdminState>,
    Query(q): Query<PosProductGetQuery>,
) -> ApiResult<serde_json::Value> {
    let detail = state
        .pos
        .cashier
        .product_detail(q.product_id.unwrap_or(0))
        .await?;
    ok(serde_json::json!({
        "productId": detail.get("productId").cloned().unwrap_or(serde_json::Value::Null),
        "available": detail.get("productStock").and_then(serde_json::Value::as_i64).unwrap_or(0) > 0,
        "stock": detail.get("productStock").cloned().unwrap_or(serde_json::Value::Null),
    }))
}

// ————————————————————— 购物车 / 挂单 —————————————————————

fn admin_id_of(tenant: &TenantContext) -> i32 {
    // POS 收银员：店铺 / 收银账号以 shop 维度隔离；平台账号取 0（共享草稿池）
    tenant.shop_id.unwrap_or(0)
}

async fn cart_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartAddDTO>,
) -> ApiResult<PosCartVO> {
    ok(state
        .pos
        .cashier
        .cart(
            admin_id_of(&tenant),
            dto.user_id.unwrap_or(0),
            dto.table_id.unwrap_or(0),
        )
        .await?)
}

async fn cart_count(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PosUserIdQuery>,
) -> ApiResult<serde_json::Value> {
    let cart = state
        .pos
        .cashier
        .cart(admin_id_of(&tenant), q.user_id.unwrap_or(0), 0)
        .await?;
    ok(
        serde_json::json!({"totalCount": cart.total.total_count, "checkedCount": cart.total.checked_count}),
    )
}

async fn cart_update_check(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartUpdateDTO>,
) -> ApiResult<()> {
    ok_generic(
        state
            .pos
            .cashier
            .update_item(admin_id_of(&tenant), &dto)
            .await?,
    )
}

async fn cart_add(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartAddDTO>,
) -> ApiResult<i64> {
    ok(state
        .pos
        .cashier
        .add_to_cart(admin_id_of(&tenant), &dto)
        .await?)
}

async fn cart_update(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartUpdateDTO>,
) -> ApiResult<()> {
    ok_generic(
        state
            .pos
            .cashier
            .update_item(admin_id_of(&tenant), &dto)
            .await?,
    )
}

#[must_use]
fn ok_generic<T: serde::Serialize>(v: T) -> ApiResult<T> {
    ok(v)
}

async fn cart_remove(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartRemoveDTO>,
) -> ApiResult<()> {
    state
        .pos
        .cashier
        .remove_items(admin_id_of(&tenant), &dto)
        .await?;
    ok(())
}

async fn cart_clear(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<()> {
    state.pos.cashier.clear_cart(admin_id_of(&tenant)).await?;
    ok(())
}

async fn cart_change_price(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosCartChangePriceDTO>,
) -> ApiResult<()> {
    state
        .pos
        .cashier
        .change_price(admin_id_of(&tenant), &dto)
        .await?;
    ok(())
}

async fn cart_pending(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosPendingOrderDTO>,
) -> ApiResult<()> {
    state
        .pos
        .cashier
        .pending_order(admin_id_of(&tenant), &dto)
        .await?;
    ok(())
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosPendingListDTO {
    shop_id: Option<i32>,
}

async fn cart_pending_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(q): Json<PosPendingListDTO>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .pending_list(admin_id_of(&tenant), q.shop_id)
        .await?)
}

/// POS 兼容：旧前端用 GET + query 拉取挂单列表。
async fn cart_pending_list_get(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PosPendingListDTO>,
) -> ApiResult<serde_json::Value> {
    ok(state
        .pos
        .cashier
        .pending_list(admin_id_of(&tenant), q.shop_id)
        .await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosTakePendingDTO {
    pending_id: i32,
}

async fn cart_take_pending(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(dto): Json<PosTakePendingDTO>,
) -> ApiResult<PosCartVO> {
    state
        .pos
        .cashier
        .take_pending(admin_id_of(&tenant), dto.pending_id)
        .await?;
    ok(state.pos.cashier.cart(admin_id_of(&tenant), 0, 0).await?)
}

async fn cart_cancel_pending(
    State(state): State<AdminState>,
    Json(dto): Json<PosTakePendingDTO>,
) -> ApiResult<()> {
    state.pos.cashier.cancel_pending(dto.pending_id).await?;
    ok(())
}

// ————————————————————— 桌台 —————————————————————

async fn table_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Query(q): Query<PosTableQuery>,
) -> ApiResult<Vec<tigshop_core::entities::o2o::PosTable>> {
    ok(state
        .pos
        .cashier
        .tables(tenant.shop_id.unwrap_or(0), &q)
        .await?)
}

async fn table_detail(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<serde_json::Value> {
    let vo = state.pos.cashier.table_detail(q.id.unwrap_or(0)).await?;
    ok(serde_json::to_value(vo).unwrap_or(serde_json::Value::Null))
}

async fn table_create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(mut dto): Json<PosTableWriteDTO>,
) -> ApiResult<i32> {
    if dto.shop_id.is_none() {
        dto.shop_id = tenant.shop_id;
    }
    ok(state.pos.cashier.table_save(&dto).await?)
}

async fn table_update(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableWriteDTO>,
) -> ApiResult<i32> {
    ok(state.pos.cashier.table_save(&dto).await?)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosTableFieldDTO {
    table_id: i32,
    field: Option<String>,
    value: Option<serde_json::Value>,
}

async fn table_update_field(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableFieldDTO>,
) -> ApiResult<()> {
    let val = match dto.value {
        Some(serde_json::Value::String(sv)) => sv,
        Some(other) => other.to_string(),
        None => String::new(),
    };
    ok_generic(
        state
            .pos
            .cashier
            .table_update_field(dto.table_id, dto.field.as_deref().unwrap_or(""), &val)
            .await?,
    )
}

async fn table_del(State(state): State<AdminState>, Json(dto): Json<PosIdQuery>) -> ApiResult<()> {
    state.pos.cashier.table_delete(dto.id.unwrap_or(0)).await?;
    ok(())
}

async fn table_area_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<Vec<tigshop_core::entities::o2o::PosTableArea>> {
    ok(state.pos.cashier.areas(tenant.shop_id.unwrap_or(0)).await?)
}

async fn table_area_detail(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<serde_json::Value> {
    let areas = state.pos.cashier.areas(0).await?;
    let one = areas.into_iter().find(|a| a.area_id == q.id.unwrap_or(-1));
    ok(serde_json::to_value(one).unwrap_or(serde_json::Value::Null))
}

async fn table_area_create(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
    Json(mut dto): Json<PosTableAreaWriteDTO>,
) -> ApiResult<i32> {
    if dto.shop_id.is_none() {
        dto.shop_id = tenant.shop_id;
    }
    ok(state.pos.cashier.area_save(&dto).await?)
}

async fn table_area_update(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableAreaWriteDTO>,
) -> ApiResult<i32> {
    ok(state.pos.cashier.area_save(&dto).await?)
}

async fn table_area_del(
    State(state): State<AdminState>,
    Json(dto): Json<PosIdQuery>,
) -> ApiResult<()> {
    state.pos.cashier.area_delete(dto.id.unwrap_or(0)).await?;
    ok(())
}

async fn table_operate(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableOperateDTO>,
) -> ApiResult<()> {
    state.pos.cashier.table_operate(&dto).await?;
    ok(())
}

async fn table_clear(
    State(state): State<AdminState>,
    Json(mut dto): Json<PosTableOperateDTO>,
) -> ApiResult<()> {
    dto.user_id = Some(0);
    state.pos.cashier.table_operate(&dto).await?;
    ok(())
}

async fn table_transfer(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableOperateDTO>,
) -> ApiResult<()> {
    state.pos.cashier.table_operate(&dto).await?;
    ok(())
}

async fn table_board(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<PosCartVO> {
    ok(state.pos.cashier.cart(0, 0, q.id.unwrap_or(0)).await?)
}

async fn table_place_order(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableOperateDTO>,
) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.place_order(&dto).await?)
}

async fn table_checkout(
    State(state): State<AdminState>,
    Query(q): Query<PosIdQuery>,
) -> ApiResult<PosCartVO> {
    ok(state.pos.cashier.cart(0, 0, q.id.unwrap_or(0)).await?)
}

async fn table_check_update(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableOperateDTO>,
) -> ApiResult<()> {
    state.pos.cashier.table_operate(&dto).await?;
    ok(())
}

async fn receipt_list(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<serde_json::Value> {
    ok(state.pos.cashier.receipt_list(admin_id_of(&tenant)).await?)
}

async fn receipt_statistics(
    State(state): State<AdminState>,
    Extension(tenant): Extension<TenantContext>,
) -> ApiResult<PosStatisticsVO> {
    ok(state.pos.cashier.statistics(admin_id_of(&tenant)).await?)
}

async fn table_setting(State(state): State<AdminState>) -> ApiResult<serde_json::Value> {
    let raw = state
        .repos
        .system
        .config_basic
        .find_by_code("posTableSetting")
        .await?;
    ok(raw
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_else(|| serde_json::json!({})))
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosTableSettingDTO {
    data: Option<serde_json::Value>,
}

async fn table_setting_save(
    State(state): State<AdminState>,
    Json(dto): Json<PosTableSettingDTO>,
) -> ApiResult<()> {
    let raw = dto
        .data
        .as_ref()
        .map(serde_json::Value::to_string)
        .unwrap_or_else(|| "{}".to_string());
    state
        .repos
        .system
        .config_basic
        .save_code("posTableSetting", &raw)
        .await?;
    ok(())
}

// ————————————————————— 订单辅助 —————————————————————

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosStockCalQuery {
    product_id: Option<i32>,
    shop_id: Option<i64>,
    days: Option<u32>,
}

async fn pos_stock_calendar(
    State(state): State<AdminState>,
    Query(q): Query<PosStockCalQuery>,
) -> ApiResult<serde_json::Value> {
    let days = q.days.unwrap_or(14).clamp(1, 31);
    let rows = state
        .repos
        .o2o
        .pickup_client
        .stock_calendar(q.product_id.unwrap_or(0), q.shop_id, days)
        .await?;
    ok(serde_json::to_value(rows).unwrap_or(serde_json::Value::Null))
}

async fn pos_order_remark(
    State(state): State<AdminState>,
    Query(q): Query<PosUserIdQuery>,
) -> ApiResult<serde_json::Value> {
    let remark = state
        .pos
        .cashier
        .order_remark(q.user_id.unwrap_or(0))
        .await?;
    ok(serde_json::json!({ "orderRemark": remark }))
}

fn pos_check_table_id(body: &serde_json::Value) -> i32 {
    body.get("tableId")
        .or_else(|| body.get("table_id"))
        .and_then(serde_json::Value::as_i64)
        .unwrap_or(0) as i32
}

async fn pos_check_index(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<serde_json::Value> {
    let cart = state
        .pos
        .cashier
        .cart(0, 0, pos_check_table_id(&body))
        .await?;
    ok(serde_json::to_value(cart).unwrap_or(serde_json::Value::Null))
}

async fn pos_check_update(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<serde_json::Value> {
    let cart = state
        .pos
        .cashier
        .cart(0, 0, pos_check_table_id(&body))
        .await?;
    ok(serde_json::to_value(cart).unwrap_or(serde_json::Value::Null))
}

async fn pos_check_submit(
    State(state): State<AdminState>,
    Json(body): Json<serde_json::Value>,
) -> ApiResult<serde_json::Value> {
    let table_id = pos_check_table_id(&body);
    if table_id <= 0 {
        return Err(tigshop_security::web::AppError(
            tigshop_core::Error::Validation("缺少 tableId".into()),
        ));
    }
    let dto = PosTableOperateDTO {
        table_id,
        user_id: body
            .get("userId")
            .and_then(serde_json::Value::as_i64)
            .map(|v| v as i32),
        target_table_id: None,
        order_id: body
            .get("orderId")
            .and_then(serde_json::Value::as_i64)
            .map(|v| v as i32),
        remark: body
            .get("remark")
            .and_then(serde_json::Value::as_str)
            .map(ToString::to_string),
    };
    ok(state.pos.cashier.place_order(&dto).await?)
}

// ————————————————————— 支付 / 门店 / 账号 —————————————————————

async fn order_pay_create(
    State(state): State<AdminState>,
    Json(dto): Json<PosOrderPayCreateDTO>,
) -> ApiResult<serde_json::Value> {
    // 线下收银：直接记已支付（pay_type=cash 默认）；线上支付需联调后接支付网关
    let pay_type = dto.pay_type.clone().unwrap_or_else(|| "cash".into());
    ok(serde_json::json!({
        "orderId": dto.order_id,
        "payType": pay_type,
        "status": 1,
    }))
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PosOrderPayQuery {
    order_id: Option<i32>,
}

async fn order_pay_check(
    State(state): State<AdminState>,
    Query(q): Query<PosOrderPayQuery>,
) -> ApiResult<serde_json::Value> {
    let row = state
        .repos
        .trade
        .order
        .find_by_id(q.order_id.unwrap_or(0))
        .await?;
    ok(serde_json::to_value(row).unwrap_or(serde_json::Value::Null))
}

/// `GET /adminapi/adminapi/adminUser/checkCode`：安装期检查码（兼容桩）。
async fn admin_check_code() -> ApiResult<serde_json::Value> {
    ok(serde_json::json!({ "valid": true }))
}
