//! 供应链（v5.8.61 `/adminapi/supplyChain/*`）基础路由。
//!
//! 覆盖供应商、供应商分类、供应商商品、采购单/入库/对账/退货/设置。
//! 列表/详情/状态/删除使用通用表读取；复杂保存动作先返回明确未迁移错误。

use axum::{
    extract::{Extension, Multipart, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::mysql::MySqlRow;
use sqlx::{Column, MySql, QueryBuilder, Row, TypeInfo};
use std::str::FromStr;
use tigshop_core::Error;
use tigshop_infrastructure::db::repo::marketing::tenant::TenantScope;
use tigshop_security::web::{ok, ApiResult, AppError, AuthUser};

use crate::AdminState;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        // supplier
        .route("/supplyChain/supplier/list", get(supplier_list))
        .route("/supplyChain/supplier/detail", get(supplier_detail))
        .route("/supplyChain/supplier/create", post(supplier_create))
        .route("/supplyChain/supplier/update", post(supplier_update))
        .route("/supplyChain/supplier/status", post(supplier_status))
        .route("/supplyChain/supplier/delete", post(supplier_delete))
        .route(
            "/supplyChain/supplier/qualification/upload",
            post(qualification_upload),
        )
        // category
        .route("/supplyChain/supplierCategory/list", get(category_list))
        .route("/supplyChain/supplierCategory/save", post(category_save))
        .route(
            "/supplyChain/supplierCategory/status",
            post(category_status),
        )
        .route(
            "/supplyChain/supplierCategory/delete",
            post(category_delete),
        )
        // supplier product
        .route("/supplyChain/supplierProduct/list", get(product_list))
        .route("/supplyChain/supplierProduct/summary", get(product_list))
        .route("/supplyChain/supplierProduct/selection", get(product_list))
        .route("/supplyChain/supplierProduct/detail", get(product_detail))
        .route("/supplyChain/supplierProduct/status", post(product_status))
        .route("/supplyChain/supplierProduct/delete", post(product_delete))
        .route(
            "/supplyChain/supplierProduct/batchDelete",
            post(product_batch_delete),
        )
        .route("/supplyChain/supplierProduct/save", post(product_save))
        .route(
            "/supplyChain/supplierProduct/batchSave",
            post(product_batch_save),
        )
        // purchase order
        .route("/supplyChain/purchaseOrder/list", get(order_list))
        .route("/supplyChain/purchaseOrder/detail", get(order_detail))
        .route("/supplyChain/purchaseOrder/create", post(order_create))
        .route("/supplyChain/purchaseOrder/update", post(order_update))
        .route("/supplyChain/purchaseOrder/finish", post(order_finish))
        // receipt
        .route("/supplyChain/purchaseReceipt/list", get(receipt_list))
        .route("/supplyChain/purchaseReceipt/detail", get(receipt_detail))
        .route("/supplyChain/purchaseReceipt/save", post(receipt_save))
        // reconciliation
        .route(
            "/supplyChain/purchaseReconciliation/list",
            get(reconciliation_list),
        )
        .route(
            "/supplyChain/purchaseReconciliation/detail",
            get(reconciliation_detail),
        )
        .route(
            "/supplyChain/purchaseReconciliation/candidates",
            get(reconciliation_candidates),
        )
        .route(
            "/supplyChain/purchaseReconciliation/export",
            get(reconciliation_export),
        )
        .route(
            "/supplyChain/purchaseReconciliation/create",
            post(reconciliation_create),
        )
        .route(
            "/supplyChain/purchaseReconciliation/update",
            post(reconciliation_update),
        )
        .route(
            "/supplyChain/purchaseReconciliation/approve",
            post(reconciliation_approve),
        )
        .route(
            "/supplyChain/purchaseReconciliation/reject",
            post(reconciliation_reject),
        )
        .route(
            "/supplyChain/purchaseReconciliation/resubmit",
            post(reconciliation_resubmit),
        )
        .route(
            "/supplyChain/purchaseReconciliation/void",
            post(reconciliation_void),
        )
        // return
        .route("/supplyChain/purchaseReturn/list", get(return_list))
        .route("/supplyChain/purchaseReturn/detail", get(return_detail))
        .route("/supplyChain/purchaseReturn/save", post(return_save))
        .route("/supplyChain/purchaseReturn/confirm", post(return_confirm))
        .route("/supplyChain/purchaseReturn/delete", post(return_delete))
        // setting
        .route("/supplyChain/purchaseSetting/detail", get(setting_detail))
        .route("/supplyChain/purchaseSetting/save", post(setting_save))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    let paths = [
        ("GET", "/api/supplyChain/supplier/list"),
        ("GET", "/api/supplyChain/supplier/detail"),
        ("POST", "/api/supplyChain/supplier/create"),
        ("POST", "/api/supplyChain/supplier/update"),
        ("POST", "/api/supplyChain/supplier/status"),
        ("POST", "/api/supplyChain/supplier/delete"),
        ("POST", "/api/supplyChain/supplier/qualification/upload"),
        ("GET", "/api/supplyChain/supplierCategory/list"),
        ("POST", "/api/supplyChain/supplierCategory/save"),
        ("POST", "/api/supplyChain/supplierCategory/status"),
        ("POST", "/api/supplyChain/supplierCategory/delete"),
        ("GET", "/api/supplyChain/supplierProduct/list"),
        ("GET", "/api/supplyChain/supplierProduct/summary"),
        ("GET", "/api/supplyChain/supplierProduct/selection"),
        ("GET", "/api/supplyChain/supplierProduct/detail"),
        ("POST", "/api/supplyChain/supplierProduct/status"),
        ("POST", "/api/supplyChain/supplierProduct/delete"),
        ("POST", "/api/supplyChain/supplierProduct/batchDelete"),
        ("POST", "/api/supplyChain/supplierProduct/save"),
        ("POST", "/api/supplyChain/supplierProduct/batchSave"),
        ("GET", "/api/supplyChain/purchaseOrder/list"),
        ("GET", "/api/supplyChain/purchaseOrder/detail"),
        ("POST", "/api/supplyChain/purchaseOrder/create"),
        ("POST", "/api/supplyChain/purchaseOrder/update"),
        ("POST", "/api/supplyChain/purchaseOrder/finish"),
        ("GET", "/api/supplyChain/purchaseReceipt/list"),
        ("GET", "/api/supplyChain/purchaseReceipt/detail"),
        ("POST", "/api/supplyChain/purchaseReceipt/save"),
        ("GET", "/api/supplyChain/purchaseReconciliation/list"),
        ("GET", "/api/supplyChain/purchaseReconciliation/detail"),
        ("GET", "/api/supplyChain/purchaseReconciliation/candidates"),
        ("GET", "/api/supplyChain/purchaseReconciliation/export"),
        ("POST", "/api/supplyChain/purchaseReconciliation/create"),
        ("POST", "/api/supplyChain/purchaseReconciliation/update"),
        ("POST", "/api/supplyChain/purchaseReconciliation/approve"),
        ("POST", "/api/supplyChain/purchaseReconciliation/reject"),
        ("POST", "/api/supplyChain/purchaseReconciliation/resubmit"),
        ("POST", "/api/supplyChain/purchaseReconciliation/void"),
        ("GET", "/api/supplyChain/purchaseReturn/list"),
        ("GET", "/api/supplyChain/purchaseReturn/detail"),
        ("POST", "/api/supplyChain/purchaseReturn/save"),
        ("POST", "/api/supplyChain/purchaseReturn/confirm"),
        ("POST", "/api/supplyChain/purchaseReturn/delete"),
        ("GET", "/api/supplyChain/purchaseSetting/detail"),
        ("POST", "/api/supplyChain/purchaseSetting/save"),
    ];
    paths
        .iter()
        .map(|(m, p)| tigshop_openapi::RouteDoc::new(m, p, "SupplyChainController"))
        .collect()
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Pg {
    page: Option<u64>,
    size: Option<u64>,
    keyword: Option<String>,
    id: Option<i64>,
    ids: Option<Vec<i64>>,
    status: Option<i32>,
    shop_id: Option<i32>,
}

fn page_of(q: &Pg) -> (u64, u64, i64) {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(15).clamp(1, 200);
    (page, size, ((page - 1) * size) as i64)
}

async fn list_table(
    state: &AdminState,
    table: &str,
    q: &Pg,
    supplier_only: bool,
) -> Result<Value, AppError> {
    let (page, size, offset) = page_of(q);
    let mut cq: QueryBuilder<'_, MySql> =
        QueryBuilder::new(format!("SELECT COUNT(*) FROM {table} WHERE 1=1"));
    let mut rq: QueryBuilder<'_, MySql> =
        QueryBuilder::new(format!("SELECT * FROM {table} WHERE 1=1"));
    if table != "vendor" {
        cq.push(" AND is_del = 0");
        rq.push(" AND is_del = 0");
    }
    if supplier_only {
        cq.push(" AND source_type = 2");
        rq.push(" AND source_type = 2");
    }
    if let Some(shop_id) = q.shop_id {
        cq.push(" AND shop_id = ").push_bind(shop_id);
        rq.push(" AND shop_id = ").push_bind(shop_id);
    }
    if let Some(status) = q.status {
        cq.push(" AND status = ").push_bind(status);
        rq.push(" AND status = ").push_bind(status);
    }
    if let Some(kw) = q
        .keyword
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let like = format!("%{kw}%");
        let col = if table == "vendor" {
            "vendor_name"
        } else {
            "category_name"
        };
        cq.push(format!(" AND {col} LIKE ")).push_bind(like.clone());
        rq.push(format!(" AND {col} LIKE ")).push_bind(like);
    }
    rq.push(" ORDER BY ")
        .push(if table == "vendor" { "vendor_id" } else { "id" })
        .push(" DESC LIMIT ")
        .push_bind(size as i64)
        .push(" OFFSET ")
        .push_bind(offset);
    let (total,): (i64,) = cq
        .build_query_as()
        .fetch_one(&state.repos.pool)
        .await
        .map_err(db)?;
    let rows = rq.build().fetch_all(&state.repos.pool).await.map_err(db)?;
    let records: Vec<Value> = rows.iter().map(row_to_json).collect();
    Ok(json!({"records": records, "total": total, "page": page, "size": size}))
}

async fn detail_table(state: &AdminState, table: &str, id: i64) -> Result<Value, AppError> {
    let key = if table == "vendor" { "vendor_id" } else { "id" };
    let row = sqlx::query(&format!("SELECT * FROM {table} WHERE {key} = ? LIMIT 1"))
        .bind(id)
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(db)?;
    Ok(row.as_ref().map(row_to_json).unwrap_or(Value::Null))
}

async fn set_status(state: &AdminState, table: &str, id: i64, status: i32) -> Result<(), AppError> {
    let key = if table == "vendor" { "vendor_id" } else { "id" };
    sqlx::query(&format!("UPDATE {table} SET status = ? WHERE {key} = ?"))
        .bind(status)
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    Ok(())
}

async fn soft_delete(state: &AdminState, table: &str, id: i64) -> Result<(), AppError> {
    let key = if table == "vendor" { "vendor_id" } else { "id" };
    let sql = if table == "vendor" {
        format!("DELETE FROM {table} WHERE {key} = ?")
    } else {
        format!("UPDATE {table} SET is_del = 1 WHERE {key} = ?")
    };
    sqlx::query(&sql)
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    Ok(())
}

fn db(e: sqlx::Error) -> AppError {
    AppError(Error::Database(e.to_string()))
}

pub(crate) fn row_to_json(row: &MySqlRow) -> Value {
    let mut map = Map::new();
    for (idx, col) in row.columns().iter().enumerate() {
        let name = col.name();
        let type_name = col.type_info().name().to_ascii_uppercase();
        let value = if type_name.contains("INT") {
            row.try_get::<Option<i64>, _>(idx)
                .ok()
                .flatten()
                .map(Value::from)
        } else if type_name.contains("DECIMAL") || type_name.contains("NUMERIC") {
            row.try_get::<Option<rust_decimal::Decimal>, _>(idx)
                .ok()
                .flatten()
                .map(|v| Value::String(v.to_string()))
        } else if type_name.contains("FLOAT") || type_name.contains("DOUBLE") {
            row.try_get::<Option<f64>, _>(idx)
                .ok()
                .flatten()
                .map(Value::from)
        } else if type_name.contains("JSON") {
            row.try_get::<Option<Value>, _>(idx).ok().flatten()
        } else {
            row.try_get::<Option<String>, _>(idx)
                .ok()
                .flatten()
                .map(Value::from)
        };
        map.insert(name.to_string(), value.unwrap_or(Value::Null));
    }
    Value::Object(map)
}

// ————————————————— supplier —————————————————
async fn supplier_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "vendor", &q, true).await?)
}
async fn supplier_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(detail_table(&state, "vendor", q.id.unwrap_or(0)).await?)
}
async fn supplier_create(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<i64> {
    let name = body
        .get("vendorName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if name.is_empty() {
        return Err(AppError(Error::biz(400, "供应商名称不能为空")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let r = sqlx::query(
        "INSERT INTO vendor(source_type, shop_id, vendor_code, vendor_name, contact_mobile, purchase_category_id, vendor_logo, description, status, add_time) VALUES(2,?,?,?,?,?,?,?,?,?)",
    )
    .bind(body.get("shopId").and_then(Value::as_i64).unwrap_or(0) as i32)
    .bind(body.get("vendorCode").and_then(Value::as_str).unwrap_or(""))
    .bind(name)
    .bind(body.get("contactMobile").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("purchaseCategoryId").and_then(Value::as_i64).unwrap_or(0))
    .bind(body.get("vendorLogo").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("description").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
    .bind(now)
    .execute(&state.repos.pool).await.map_err(db)?;
    ok(r.last_insert_id() as i64)
}
async fn supplier_update(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body
        .get("vendorId")
        .or_else(|| body.get("id"))
        .and_then(Value::as_i64)
        .unwrap_or(0);
    sqlx::query("UPDATE vendor SET vendor_name=COALESCE(NULLIF(?,''),vendor_name), contact_mobile=COALESCE(NULLIF(?,''),contact_mobile) WHERE vendor_id=? AND source_type=2")
        .bind(body.get("vendorName").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("contactMobile").and_then(Value::as_str).unwrap_or(""))
        .bind(id)
        .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
async fn supplier_status(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let status = body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32;
    set_status(&state, "vendor", id, status).await?;
    ok(())
}
async fn supplier_delete(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    soft_delete(
        &state,
        "vendor",
        body.get("id").and_then(Value::as_i64).unwrap_or(0),
    )
    .await?;
    ok(())
}
async fn qualification_upload(
    State(state): State<AdminState>,
    Extension(auth): Extension<AuthUser>,
    mut multipart: Multipart,
) -> ApiResult<String> {
    let mut payload: Option<(Option<String>, Option<String>, Vec<u8>)> = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError(Error::Validation(format!("文件不能为空: {e}"))))?
    {
        if field.name() != Some("file") {
            continue;
        }
        let content_type = field.content_type().map(ToString::to_string);
        let file_name = field.file_name().map(ToString::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|e| AppError(Error::Validation(format!("文件不能为空: {e}"))))?
            .to_vec();
        payload = Some((content_type, file_name, bytes));
        break;
    }
    let Some((content_type, file_name, bytes)) = payload else {
        return Err(AppError(Error::Validation("资质图片不能为空".into())));
    };
    if bytes.len() > 10 * 1024 * 1024 {
        return Err(AppError(Error::Validation(
            "单张资质图片不能超过10MB".into(),
        )));
    }
    if !matches!(
        content_type.as_deref(),
        Some("image/png" | "image/jpeg" | "image/jpg")
    ) {
        return Err(AppError(Error::Validation(
            "资质图片仅支持png、jpg、jpeg格式".into(),
        )));
    }
    let size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    let shop_id = TenantScope::current().write_shop_id(None)?;
    let vo = state
        .content
        .gallery_pic
        .upload_img(
            None,
            content_type.as_deref(),
            size,
            file_name.as_deref(),
            &bytes,
            shop_id,
            auth.id,
        )
        .await?;
    ok(serde_json::to_value(vo)
        .ok()
        .and_then(|v| {
            v.get("url")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default())
}

// ————————————————— category —————————————————
async fn category_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_supplier_category", &q, false).await?)
}
async fn category_save(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i64> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let name = body
        .get("categoryName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let now = tigshop_common::utils::now_seconds() as i64;
    if id > 0 {
        sqlx::query("UPDATE purchase_supplier_category SET category_name=?, sort_order=?, status=?, remark=?, update_time=? WHERE id=?")
            .bind(name)
            .bind(body.get("sortOrder").and_then(Value::as_i64).unwrap_or(50) as i32)
            .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
            .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
            .bind(now).bind(id)
            .execute(&state.repos.pool).await.map_err(db)?;
        ok(id)
    } else {
        let r = sqlx::query("INSERT INTO purchase_supplier_category(shop_id,category_name,sort_order,status,remark,create_time,update_time) VALUES(?,?,?,?,?,?,?)")
            .bind(body.get("shopId").and_then(Value::as_i64).unwrap_or(0) as i32)
            .bind(name)
            .bind(body.get("sortOrder").and_then(Value::as_i64).unwrap_or(50) as i32)
            .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
            .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
            .bind(now).bind(now)
            .execute(&state.repos.pool).await.map_err(db)?;
        ok(r.last_insert_id() as i64)
    }
}
async fn category_status(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    set_status(
        &state,
        "purchase_supplier_category",
        body.get("id").and_then(Value::as_i64).unwrap_or(0),
        body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32,
    )
    .await?;
    ok(())
}
async fn category_delete(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    soft_delete(
        &state,
        "purchase_supplier_category",
        body.get("id").and_then(Value::as_i64).unwrap_or(0),
    )
    .await?;
    ok(())
}

// ————————————————— supplier product —————————————————
async fn product_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "vendor_product", &q, false).await?)
}
async fn product_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(detail_table(&state, "vendor_product", q.id.unwrap_or(0)).await?)
}
async fn product_status(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let status = body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32;
    sqlx::query("UPDATE vendor_product SET product_state=? WHERE id=?")
        .bind(status)
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}
async fn product_delete(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    sqlx::query("UPDATE vendor_product SET is_del=1 WHERE id=?")
        .bind(body.get("id").and_then(Value::as_i64).unwrap_or(0))
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}
async fn product_batch_delete(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let ids = body
        .get("ids")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for id in ids {
        let _ = sqlx::query("UPDATE vendor_product SET is_del=1 WHERE id=?")
            .bind(id.as_i64().unwrap_or(0))
            .execute(&state.repos.pool)
            .await;
    }
    ok(())
}
async fn product_save(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i64> {
    save_supplier_product(&state, &body).await
}

async fn product_batch_save(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let products = body
        .get("products")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for item in products {
        let mut single = item.clone();
        if let Some(obj) = single.as_object_mut() {
            obj.insert(
                "vendorId".into(),
                body.get("vendorId").cloned().unwrap_or(Value::Null),
            );
            obj.insert(
                "shopId".into(),
                body.get("shopId").cloned().unwrap_or(Value::Null),
            );
        }
        save_supplier_product(&state, &single).await?;
    }
    ok(())
}

async fn save_supplier_product(state: &AdminState, body: &Value) -> ApiResult<i64> {
    let vendor_id = body.get("vendorId").and_then(Value::as_i64).unwrap_or(0) as i32;
    let product_id = body.get("productId").and_then(Value::as_i64).unwrap_or(0) as i32;
    if vendor_id <= 0 || product_id <= 0 {
        return Err(AppError(Error::biz(400, "请选择供应商和商品")));
    }
    let vendor = sqlx::query(
        "SELECT vendor_id FROM vendor WHERE vendor_id=? AND source_type=2 AND status=1 LIMIT 1",
    )
    .bind(vendor_id)
    .fetch_optional(&state.repos.pool)
    .await
    .map_err(db)?
    .ok_or_else(|| AppError(Error::biz(400, "供应商不存在或已停用")))?;
    let _ = vendor;
    let product = sqlx::query("SELECT product_id, product_name, product_sn, category_id, pic_url, pic_thumb, pic_original, pic_large, product_brief FROM product WHERE product_id=? AND is_delete=0 LIMIT 1")
        .bind(product_id).fetch_optional(&state.repos.pool).await.map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "商品不存在")))?;
    let skus = body
        .get("skus")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if skus.is_empty() {
        return Err(AppError(Error::biz(400, "请选择采购规格")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let existing_id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let mut tx = state.repos.pool.begin().await.map_err(db)?;
    let relation_id = if existing_id > 0 {
        let row = sqlx::query("SELECT vendor_id, source_product_id FROM vendor_product WHERE id=? AND is_del=0 LIMIT 1")
            .bind(existing_id).fetch_optional(&mut *tx).await.map_err(db)?
            .ok_or_else(|| AppError(Error::biz(400, "供应商商品不存在")))?;
        if row.try_get::<i32, _>("vendor_id").unwrap_or(0) != vendor_id
            || row.try_get::<i32, _>("source_product_id").unwrap_or(0) != product_id
        {
            return Err(AppError(Error::biz(400, "供应商和来源商品不可变更")));
        }
        sqlx::query("UPDATE vendor_product SET product_name=?, product_state=?, sku_type=?, update_time=? WHERE id=?")
            .bind(product.try_get::<String, _>("product_name").unwrap_or_default())
            .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
            .bind(if skus.len() > 1 { 2 } else { 1 })
            .bind(now).bind(existing_id)
            .execute(&mut *tx).await.map_err(db)?;
        sqlx::query("DELETE FROM vendor_product_sku WHERE vendor_product_id=?")
            .bind(existing_id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
        existing_id
    } else {
        let duplicate: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM vendor_product WHERE vendor_id=? AND source_product_id=? AND is_del=0")
            .bind(vendor_id).bind(product_id).fetch_one(&mut *tx).await.map_err(db)?;
        if duplicate.0 > 0 {
            return Err(AppError(Error::biz(400, "该供应商已绑定此商品")));
        }
        sqlx::query("INSERT INTO vendor_product(product_name,product_sn,product_category_id,product_sn_generate_type,product_brief,product_state,sku_type,audit_state,pic_url,pic_thumb,pic_original,pic_large,is_recycle,vendor_id,source_product_id,create_time,create_by_id,update_time,update_by_id,update_by_name,is_del) VALUES(?,?,?,0,?,?,?,1,?,?,?,?,0,?,?,?,0,?,0,'',0)")
            .bind(product.try_get::<String, _>("product_name").unwrap_or_default())
            .bind(product.try_get::<Option<String>, _>("product_sn").unwrap_or_default())
            .bind(product.try_get::<i32, _>("category_id").unwrap_or(0))
            .bind(product.try_get::<String, _>("product_brief").unwrap_or_default())
            .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
            .bind(if skus.len() > 1 { 2 } else { 1 })
            .bind(product.try_get::<String, _>("pic_url").unwrap_or_default())
            .bind(product.try_get::<String, _>("pic_thumb").unwrap_or_default())
            .bind(product.try_get::<String, _>("pic_original").unwrap_or_default())
            .bind(product.try_get::<String, _>("pic_large").unwrap_or_default())
            .bind(vendor_id).bind(product_id)
            .bind(now).bind(now)
            .execute(&mut *tx).await.map_err(db)?.last_insert_id() as i64
    };
    for sku in skus {
        let source_sku_id = sku.get("skuId").and_then(Value::as_i64).filter(|v| *v > 0);
        let price = rust_decimal::Decimal::from_str(
            &sku.get("supplyPrice")
                .and_then(Value::as_str)
                .unwrap_or("0"),
        )
        .unwrap_or(rust_decimal::Decimal::ZERO);
        let min_qty = sku
            .get("minPurchaseQty")
            .and_then(Value::as_i64)
            .unwrap_or(1);
        let mut attr = "默认".to_string();
        let mut sn = product
            .try_get::<Option<String>, _>("product_sn")
            .unwrap_or_default();
        if let Some(source_sku_id) = source_sku_id {
            if let Some(row) = sqlx::query("SELECT sku_value, sku_sn, sku_tsn, sku_weight, sku_stock FROM product_sku WHERE sku_id=? LIMIT 1")
                .bind(source_sku_id).fetch_optional(&mut *tx).await.map_err(db)?
            {
                attr = row.try_get::<String, _>("sku_value").unwrap_or(attr);
                sn = row.try_get::<Option<String>, _>("sku_sn").unwrap_or(sn);
                sqlx::query("INSERT INTO vendor_product_sku(vendor_product_id,source_sku_id,min_purchase_qty,sku_attr_val,sku_sn,sku_tsn,sku_weight,sku_stock,supply_price,supply_price_limit_type,supply_price_limit_val,sales_volume,vendor_id,create_time,create_by_id,update_time,update_by_id,update_by_name,is_del) VALUES(?,?,?,?,?,?,?,?,?,0,0,0,?,?,0,?,0,'',0)")
                    .bind(relation_id).bind(source_sku_id).bind(min_qty).bind(&attr).bind(&sn)
                    .bind(row.try_get::<Option<String>, _>("sku_tsn").unwrap_or_default())
                    .bind(row.try_get::<Option<rust_decimal::Decimal>, _>("sku_weight").ok().flatten())
                    .bind(row.try_get::<Option<i32>, _>("sku_stock").ok().flatten())
                    .bind(price).bind(vendor_id).bind(now).bind(now)
                    .execute(&mut *tx).await.map_err(db)?;
                continue;
            }
        }
        sqlx::query("INSERT INTO vendor_product_sku(vendor_product_id,source_sku_id,min_purchase_qty,sku_attr_val,sku_sn,supply_price,supply_price_limit_type,supply_price_limit_val,sales_volume,vendor_id,create_time,create_by_id,update_time,update_by_id,update_by_name,is_del) VALUES(?,NULL,?,?,?,?,0,0,0,?,?,0,?,0,'',0)")
            .bind(relation_id).bind(min_qty).bind(attr).bind(sn).bind(price).bind(vendor_id).bind(now).bind(now)
            .execute(&mut *tx).await.map_err(db)?;
    }
    tx.commit().await.map_err(db)?;
    ok(relation_id)
}

// ————————————————— purchase order —————————————————
async fn order_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_order", &q, false).await?)
}
async fn order_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let id = q.id.unwrap_or(0);
    let mut order = detail_table(&state, "purchase_order", id).await?;
    let rows =
        sqlx::query("SELECT * FROM purchase_order_item WHERE order_id=? AND is_del=0 ORDER BY id")
            .bind(id)
            .fetch_all(&state.repos.pool)
            .await
            .map_err(db)?;
    let items: Vec<Value> = rows.iter().map(row_to_json).collect();
    if let Some(obj) = order.as_object_mut() {
        obj.insert("items".into(), Value::Array(items));
    }
    ok(order)
}
async fn order_create(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i64> {
    use std::str::FromStr;
    let vendor_id = body.get("vendorId").and_then(Value::as_i64).unwrap_or(0) as i32;
    if vendor_id <= 0 {
        return Err(AppError(Error::biz(400, "请选择供应商")));
    }
    let vendor = sqlx::query("SELECT vendor_name, vendor_code, contact_mobile, shop_id FROM vendor WHERE vendor_id=? AND source_type=2 LIMIT 1")
        .bind(vendor_id)
        .fetch_optional(&state.repos.pool).await.map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "供应商不存在")))?;
    let vendor_name: String = vendor.try_get("vendor_name").unwrap_or_default();
    let vendor_code: String = vendor.try_get("vendor_code").unwrap_or_default();
    let vendor_contact: String = vendor.try_get("contact_mobile").unwrap_or_default();
    let shop_id: i32 = vendor.try_get("shop_id").unwrap_or(0);
    let items = body
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if items.is_empty() {
        return Err(AppError(Error::biz(400, "请选择采购商品")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let order_sn = format!("PO{}{:04}", now, rand_suffix());
    let mut tx = state.repos.pool.begin().await.map_err(db)?;
    let order_id = sqlx::query(
        "INSERT INTO purchase_order(order_sn,type,shop_id,vendor_id,vendor_name,vendor_code,vendor_contact,status,expected_delivery_date,shipping_method,logistics_id,logistics_name,tracking_no,remark,product_amount,ordered_quantity,received_quantity,version,create_time,update_time) VALUES(?,1,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,0,?,?)",
    )
    .bind(&order_sn)
    .bind(shop_id)
    .bind(vendor_id)
    .bind(&vendor_name)
    .bind(&vendor_code)
    .bind(&vendor_contact)
    .bind(1)
    .bind(body.get("expectedDeliveryDate").and_then(Value::as_i64).unwrap_or(0))
    .bind(body.get("shippingMethod").and_then(Value::as_i64).unwrap_or(1) as i32)
    .bind(body.get("logisticsId").and_then(Value::as_i64).unwrap_or(0) as i32)
    .bind(body.get("logisticsName").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("trackingNo").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
    .bind(now).bind(now)
    .execute(&mut *tx).await.map_err(db)?.last_insert_id() as i64;

    let mut total_amount = rust_decimal::Decimal::ZERO;
    let mut total_qty = 0i64;
    for item in items {
        let sku_id = item
            .get("vendorProductSkuId")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let qty = item.get("quantity").and_then(Value::as_i64).unwrap_or(0);
        let price = rust_decimal::Decimal::from_str(
            &item
                .get("purchasePrice")
                .and_then(Value::as_str)
                .unwrap_or("0"),
        )
        .unwrap_or(rust_decimal::Decimal::ZERO);
        if sku_id <= 0 || qty <= 0 {
            return Err(AppError(Error::biz(400, "采购商品或数量不合法")));
        }
        let row = sqlx::query(
            "SELECT s.id AS sku_id, s.vendor_product_id, s.source_sku_id, p.product_id, p.product_name, p.product_sn, p.pic_thumb, p.product_unit, s.sku_attr_val, s.sku_sn FROM vendor_product_sku s JOIN vendor_product vp ON vp.id=s.vendor_product_id JOIN product p ON p.product_id=vp.source_product_id WHERE s.id=? AND s.is_del=0 LIMIT 1",
        )
        .bind(sku_id)
        .fetch_optional(&mut *tx).await.map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "供应商商品规格不存在")))?;
        let product_id: i32 = row.try_get("product_id").unwrap_or(0);
        let source_sku_id: Option<i32> = row.try_get("source_sku_id").ok().flatten();
        let amount = price * rust_decimal::Decimal::from(qty);
        sqlx::query(
            "INSERT INTO purchase_order_item(order_id,vendor_product_id,vendor_product_sku_id,product_id,sku_id,product_name,sku_name,product_sn,sku_sn,pic_thumb,product_unit,quantity,received_quantity,purchase_price,amount,create_time,update_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)",
        )
        .bind(order_id)
        .bind(row.try_get::<i64, _>("vendor_product_id").unwrap_or(0))
        .bind(sku_id)
        .bind(product_id)
        .bind(source_sku_id.unwrap_or(0))
        .bind(row.try_get::<String, _>("product_name").unwrap_or_default())
        .bind(row.try_get::<String, _>("sku_attr_val").unwrap_or_default())
        .bind(row.try_get::<String, _>("product_sn").unwrap_or_default())
        .bind(row.try_get::<String, _>("sku_sn").unwrap_or_default())
        .bind(row.try_get::<String, _>("pic_thumb").unwrap_or_default())
        .bind(row.try_get::<String, _>("product_unit").unwrap_or_default())
        .bind(qty)
        .bind(price)
        .bind(amount)
        .bind(now).bind(now)
        .execute(&mut *tx).await.map_err(db)?;
        total_amount += amount;
        total_qty += qty;
    }
    sqlx::query("UPDATE purchase_order SET product_amount=?, ordered_quantity=? WHERE id=?")
        .bind(total_amount)
        .bind(total_qty)
        .bind(order_id)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    tx.commit().await.map_err(db)?;
    ok(order_id)
}
async fn order_update(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let now = tigshop_common::utils::now_seconds() as i64;
    sqlx::query(
        "UPDATE purchase_order SET expected_delivery_date=COALESCE(?,expected_delivery_date), shipping_method=COALESCE(?,shipping_method), logistics_id=?, logistics_name=?, tracking_no=?, remark=?, update_time=? WHERE id=? AND status NOT IN (3,4)",
    )
    .bind(body.get("expectedDeliveryDate").and_then(Value::as_i64))
    .bind(body.get("shippingMethod").and_then(Value::as_i64).map(|v| v as i32))
    .bind(body.get("logisticsId").and_then(Value::as_i64).unwrap_or(0) as i32)
    .bind(body.get("logisticsName").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("trackingNo").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
    .bind(now).bind(id)
    .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
async fn order_finish(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let now = tigshop_common::utils::now_seconds() as i64;
    sqlx::query("UPDATE purchase_order SET status=3, finish_reason=?, finish_time=?, update_time=? WHERE id=? AND status IN (1,2)")
        .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
        .bind(now).bind(now).bind(id)
        .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}

fn rand_suffix() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0))
        % 10000
}

// ————————————————— receipt / reconciliation / return —————————————————
async fn receipt_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_receipt", &q, false).await?)
}
async fn receipt_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let id = q.id.unwrap_or(0);
    let mut receipt = detail_table(&state, "purchase_receipt", id).await?;
    let rows = sqlx::query(
        "SELECT * FROM purchase_receipt_item WHERE receipt_id=? AND is_del=0 ORDER BY id",
    )
    .bind(id)
    .fetch_all(&state.repos.pool)
    .await
    .map_err(db)?;
    if let Some(obj) = receipt.as_object_mut() {
        obj.insert(
            "items".into(),
            Value::Array(rows.iter().map(row_to_json).collect()),
        );
    }
    ok(receipt)
}
async fn receipt_save(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i64> {
    use std::str::FromStr;
    let mut order_id = body.get("orderId").and_then(Value::as_i64).unwrap_or(0);
    let mut inputs = body
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if inputs.is_empty() {
        return Err(AppError(Error::biz(400, "请选择入库商品")));
    }
    if order_id <= 0 {
        // 直采入库：先按采购单创建逻辑生成采购单，再把供应商规格映射到采购明细。
        let order_body = serde_json::json!({
            "vendorId": body.get("vendorId"),
            "expectedDeliveryDate": body.get("expectedDeliveryDate"),
            "shippingMethod": body.get("shippingMethod"),
            "logisticsId": body.get("logisticsId"),
            "logisticsName": body.get("logisticsName"),
            "trackingNo": body.get("trackingNo"),
            "remark": body.get("remark"),
            "items": inputs.clone()
        });
        let created = order_create(State(state.clone()), Json(order_body)).await?;
        order_id = created
            .0
            .data
            .ok_or_else(|| AppError(Error::biz(400, "采购单创建失败")))?;
        let mut mapped = Vec::new();
        for input in inputs {
            let sku_id = input
                .get("vendorProductSkuId")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let qty = input.get("quantity").and_then(Value::as_i64).unwrap_or(0);
            let row = sqlx::query("SELECT id FROM purchase_order_item WHERE order_id=? AND vendor_product_sku_id=? AND is_del=0 ORDER BY id DESC LIMIT 1")
                .bind(order_id).bind(sku_id)
                .fetch_optional(&state.repos.pool).await.map_err(db)?
                .ok_or_else(|| AppError(Error::biz(400, "采购明细生成失败")))?;
            mapped.push(serde_json::json!({
                "orderItemId": row.try_get::<i64, _>("id").unwrap_or(0),
                "quantity": qty
            }));
        }
        inputs = mapped;
    }
    let order = sqlx::query("SELECT * FROM purchase_order WHERE id=? AND is_del=0 LIMIT 1")
        .bind(order_id)
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "采购订单不存在")))?;
    let status: i32 = order.try_get("status").unwrap_or(0);
    if status != 1 && status != 2 {
        return Err(AppError(Error::biz(400, "采购订单已结束或状态不允许入库")));
    }
    let shop_id: i32 = order.try_get("shop_id").unwrap_or(0);
    let vendor_id: i32 = order.try_get("vendor_id").unwrap_or(0);
    let now = tigshop_common::utils::now_seconds() as i64;
    let receipt_sn = format!("PR{}{:04}", now, rand_suffix());
    let mut tx = state.repos.pool.begin().await.map_err(db)?;
    let receipt_id = sqlx::query(
        "INSERT INTO purchase_receipt(receipt_sn,order_id,shop_id,vendor_id,business_date,status,total_quantity,total_amount,remark,confirm_time,version,create_time,update_time) VALUES(?,?,?,?,?,2,0,0,?,?,0,?,?)",
    )
    .bind(&receipt_sn)
    .bind(order_id)
    .bind(shop_id)
    .bind(vendor_id)
    .bind(body.get("businessDate").and_then(Value::as_i64).unwrap_or(now))
    .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
    .bind(now).bind(now).bind(now)
    .execute(&mut *tx).await.map_err(db)?.last_insert_id() as i64;

    let mut total_qty = 0i64;
    let mut total_amount = rust_decimal::Decimal::ZERO;
    for input in inputs {
        let order_item_id = input
            .get("orderItemId")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let qty = input.get("quantity").and_then(Value::as_i64).unwrap_or(0);
        if order_item_id <= 0 || qty <= 0 {
            return Err(AppError(Error::biz(400, "入库商品或数量不合法")));
        }
        let item = sqlx::query(
            "SELECT * FROM purchase_order_item WHERE id=? AND order_id=? AND is_del=0 LIMIT 1",
        )
        .bind(order_item_id)
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "入库商品不属于采购订单")))?;
        let ordered: i32 = item.try_get("quantity").unwrap_or(0);
        let received: i32 = item.try_get("received_quantity").unwrap_or(0);
        if received + qty as i32 > ordered {
            return Err(AppError(Error::biz(400, "入库数量超过剩余采购数量")));
        }
        let price = item
            .try_get::<rust_decimal::Decimal, _>("purchase_price")
            .unwrap_or_default();
        let amount = price * rust_decimal::Decimal::from(qty);
        let product_id: i32 = item.try_get("product_id").unwrap_or(0);
        let sku_id: i32 = item.try_get("sku_id").unwrap_or(0);
        sqlx::query(
            "UPDATE purchase_order_item SET received_quantity=received_quantity+? WHERE id=?",
        )
        .bind(qty as i32)
        .bind(order_item_id)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
        sqlx::query(
            "INSERT INTO purchase_receipt_item(receipt_id,order_item_id,product_id,sku_id,product_name,sku_name,product_sn,sku_sn,pic_thumb,product_unit,quantity,returned_quantity,purchase_price,amount,create_time,update_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)",
        )
        .bind(receipt_id).bind(order_item_id).bind(product_id).bind(sku_id)
        .bind(item.try_get::<String, _>("product_name").unwrap_or_default())
        .bind(item.try_get::<String, _>("sku_name").unwrap_or_default())
        .bind(item.try_get::<String, _>("product_sn").unwrap_or_default())
        .bind(item.try_get::<String, _>("sku_sn").unwrap_or_default())
        .bind(item.try_get::<String, _>("pic_thumb").unwrap_or_default())
        .bind(item.try_get::<String, _>("product_unit").unwrap_or_default())
        .bind(qty as i32).bind(price).bind(amount).bind(now).bind(now)
        .execute(&mut *tx).await.map_err(db)?;
        // 平台商品库存增加；SKU 与商品汇总同时更新。
        sqlx::query("UPDATE product SET product_stock=product_stock+? WHERE product_id=?")
            .bind(qty as i32)
            .bind(product_id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
        if sku_id > 0 {
            sqlx::query("UPDATE product_sku SET sku_stock=COALESCE(sku_stock,0)+? WHERE sku_id=?")
                .bind(qty as i32)
                .bind(sku_id)
                .execute(&mut *tx)
                .await
                .map_err(db)?;
        }
        total_qty += qty;
        total_amount += amount;
    }
    sqlx::query("UPDATE purchase_receipt SET total_quantity=?, total_amount=?, stock_record_id=0 WHERE id=?")
        .bind(total_qty).bind(total_amount).bind(receipt_id).execute(&mut *tx).await.map_err(db)?;
    let (pending,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM purchase_order_item WHERE order_id=? AND is_del=0 AND received_quantity < quantity",
    ).bind(order_id).fetch_one(&mut *tx).await.map_err(db)?;
    let next_status = if pending == 0 { 3 } else { 2 };
    sqlx::query("UPDATE purchase_order SET status=?, received_quantity=received_quantity+?, update_time=? WHERE id=?")
        .bind(next_status).bind(total_qty).bind(now).bind(order_id)
        .execute(&mut *tx).await.map_err(db)?;
    tx.commit().await.map_err(db)?;
    ok(receipt_id)
}

async fn reconciliation_list(
    State(state): State<AdminState>,
    Query(q): Query<Pg>,
) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_reconciliation", &q, false).await?)
}
async fn reconciliation_detail(
    State(state): State<AdminState>,
    Query(q): Query<Pg>,
) -> ApiResult<Value> {
    let id = q.id.unwrap_or(0);
    let mut rec = detail_table(&state, "purchase_reconciliation", id).await?;
    let sources = sqlx::query(
        "SELECT s.*, CASE WHEN s.source_type=1 THEN (SELECT r.confirm_time FROM purchase_receipt r WHERE r.id=s.source_id LIMIT 1) ELSE (SELECT pr.confirm_time FROM purchase_return pr WHERE pr.id=s.source_id LIMIT 1) END AS confirm_time FROM purchase_reconciliation_source s WHERE s.reconciliation_id=? AND s.is_del=0 ORDER BY s.id",
    )
    .bind(id)
    .fetch_all(&state.repos.pool).await.map_err(db)?;
    let items = sqlx::query("SELECT * FROM purchase_reconciliation_item WHERE reconciliation_id=? AND is_del=0 ORDER BY id")
        .bind(id)
        .fetch_all(&state.repos.pool).await.map_err(db)?;
    if let Some(obj) = rec.as_object_mut() {
        obj.insert(
            "sources".into(),
            Value::Array(sources.iter().map(row_to_json).collect()),
        );
        obj.insert(
            "items".into(),
            Value::Array(items.iter().map(row_to_json).collect()),
        );
    }
    ok(rec)
}
async fn reconciliation_candidates(
    State(state): State<AdminState>,
    Query(q): Query<Pg>,
) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_receipt", &q, false).await?)
}
async fn reconciliation_export(
    State(state): State<AdminState>,
    Query(q): Query<Pg>,
) -> ApiResult<Value> {
    let mut qb: QueryBuilder<'_, MySql> =
        QueryBuilder::new("SELECT * FROM purchase_reconciliation WHERE is_del=0");
    if let Some(shop_id) = q.shop_id {
        qb.push(" AND shop_id=").push_bind(shop_id);
    }
    if let Some(status) = q.status {
        qb.push(" AND status=").push_bind(status);
    }
    qb.push(" ORDER BY id DESC LIMIT 5000");
    let rows = qb.build().fetch_all(&state.repos.pool).await.map_err(db)?;
    ok(json!(rows.iter().map(row_to_json).collect::<Vec<_>>()))
}
async fn reconciliation_create(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<i64> {
    save_reconciliation(&state, body, false).await
}
async fn reconciliation_update(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    save_reconciliation(&state, body, true).await?;
    ok(())
}

async fn save_reconciliation(state: &AdminState, body: Value, is_update: bool) -> ApiResult<i64> {
    let vendor_id = body.get("vendorId").and_then(Value::as_i64).unwrap_or(0) as i32;
    if vendor_id <= 0 {
        return Err(AppError(Error::biz(400, "请选择供应商")));
    }
    let vendor = sqlx::query("SELECT vendor_id, vendor_name, vendor_code, contact_mobile, shop_id FROM vendor WHERE vendor_id=? AND source_type=2 LIMIT 1")
        .bind(vendor_id).fetch_optional(&state.repos.pool).await.map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "供应商不存在")))?;
    let shop_id: i32 = vendor.try_get("shop_id").unwrap_or(0);
    let sources = body
        .get("sources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if sources.is_empty() {
        return Err(AppError(Error::biz(400, "请选择对账来源单据")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let existing_id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let mut tx = state.repos.pool.begin().await.map_err(db)?;
    let reconciliation_id = if is_update && existing_id > 0 {
        let row = sqlx::query(
            "SELECT status FROM purchase_reconciliation WHERE id=? AND is_del=0 LIMIT 1",
        )
        .bind(existing_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "采购对账单不存在")))?;
        let status: i32 = row.try_get("status").unwrap_or(0);
        if status != 3 {
            return Err(AppError(Error::biz(400, "只有已驳回采购对账单可以修改")));
        }
        sqlx::query("DELETE FROM purchase_reconciliation_source WHERE reconciliation_id=?")
            .bind(existing_id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
        sqlx::query("DELETE FROM purchase_reconciliation_item WHERE reconciliation_id=?")
            .bind(existing_id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
        sqlx::query("UPDATE purchase_reconciliation SET vendor_id=?, shop_id=?, remark=?, status=1, update_time=? WHERE id=?")
            .bind(vendor_id).bind(shop_id).bind(body.get("remark").and_then(Value::as_str).unwrap_or("")).bind(now).bind(existing_id)
            .execute(&mut *tx).await.map_err(db)?;
        existing_id
    } else {
        let sn = format!("PC{}{:04}", now, rand_suffix());
        let snapshot = serde_json::json!({
            "vendorId": vendor_id,
            "vendorName": vendor.try_get::<String,_>("vendor_name").unwrap_or_default(),
            "vendorCode": vendor.try_get::<String,_>("vendor_code").unwrap_or_default(),
            "contactMobile": vendor.try_get::<String,_>("contact_mobile").unwrap_or_default()
        })
        .to_string();
        sqlx::query("INSERT INTO purchase_reconciliation(reconciliation_sn,shop_id,vendor_id,status,receipt_amount,return_amount,total_amount,supplier_snapshot,remark,version,create_time,update_time) VALUES(?,?,?,1,0,0,0,?,?,0,?,?)")
            .bind(&sn).bind(shop_id).bind(vendor_id).bind(snapshot)
            .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
            .bind(now).bind(now)
            .execute(&mut *tx).await.map_err(db)?.last_insert_id() as i64
    };
    let mut receipt_amount = rust_decimal::Decimal::ZERO;
    let mut return_amount = rust_decimal::Decimal::ZERO;
    for source in sources {
        let source_type = source
            .get("sourceType")
            .and_then(Value::as_i64)
            .unwrap_or(0) as i32;
        let source_id = source.get("sourceId").and_then(Value::as_i64).unwrap_or(0);
        let row = if source_type == 1 {
            sqlx::query("SELECT id, receipt_sn, business_date, total_amount FROM purchase_receipt WHERE id=? AND vendor_id=? AND status=2 AND is_del=0 LIMIT 1")
                .bind(source_id).bind(vendor_id).fetch_optional(&mut *tx).await.map_err(db)?
        } else if source_type == 2 {
            sqlx::query("SELECT id, return_sn AS receipt_sn, business_date, total_amount FROM purchase_return WHERE id=? AND vendor_id=? AND status=2 AND is_del=0 LIMIT 1")
                .bind(source_id).bind(vendor_id).fetch_optional(&mut *tx).await.map_err(db)?
        } else {
            None
        };
        let Some(row) = row else {
            return Err(AppError(Error::biz(400, "对账来源单据不存在或状态不正确")));
        };
        let amount: rust_decimal::Decimal = row.try_get("total_amount").unwrap_or_default();
        sqlx::query("INSERT INTO purchase_reconciliation_source(reconciliation_id,source_type,source_id,source_sn,business_date,source_amount,create_time,update_time) VALUES(?,?,?,?,?,?,?,?)")
            .bind(reconciliation_id).bind(source_type).bind(source_id)
            .bind(row.try_get::<String,_>("receipt_sn").unwrap_or_default())
            .bind(row.try_get::<i64,_>("business_date").unwrap_or(0))
            .bind(amount).bind(now).bind(now)
            .execute(&mut *tx).await.map_err(db)?;
        if source_type == 1 {
            receipt_amount += amount;
        } else {
            return_amount += amount;
        }
    }
    let total = receipt_amount - return_amount;
    sqlx::query("UPDATE purchase_reconciliation SET receipt_amount=?, return_amount=?, total_amount=? WHERE id=?")
        .bind(receipt_amount).bind(return_amount).bind(total).bind(reconciliation_id)
        .execute(&mut *tx).await.map_err(db)?;
    tx.commit().await.map_err(db)?;
    ok(reconciliation_id)
}
async fn reconciliation_approve(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    sqlx::query("UPDATE purchase_reconciliation SET status=2, review_remark=?, review_time=?, update_time=? WHERE id=? AND status=1")
        .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
        .bind(tigshop_common::utils::now_seconds() as i64)
        .bind(tigshop_common::utils::now_seconds() as i64)
        .bind(id).execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
async fn reconciliation_reject(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let remark = body
        .get("remark")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if remark.is_empty() {
        return Err(AppError(Error::biz(400, "请填写驳回原因")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    sqlx::query("UPDATE purchase_reconciliation SET status=3, review_remark=?, review_time=?, update_time=? WHERE id=? AND status=1")
        .bind(remark).bind(now).bind(now).bind(id).execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
async fn reconciliation_resubmit(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    sqlx::query("UPDATE purchase_reconciliation SET status=1, review_remark=NULL, review_time=NULL, update_time=? WHERE id=? AND status=3")
        .bind(tigshop_common::utils::now_seconds() as i64).bind(id)
        .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
async fn reconciliation_void(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    let now = tigshop_common::utils::now_seconds() as i64;
    sqlx::query("UPDATE purchase_reconciliation SET status=4, review_remark=?, review_time=?, update_time=? WHERE id=? AND status=3")
        .bind(body.get("remark").and_then(Value::as_str).unwrap_or("")).bind(now).bind(now).bind(id)
        .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}

async fn return_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(list_table(&state, "purchase_return", &q, false).await?)
}
async fn return_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    ok(detail_table(&state, "purchase_return", q.id.unwrap_or(0)).await?)
}
async fn return_save(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i64> {
    let receipt_id = body.get("receiptId").and_then(Value::as_i64).unwrap_or(0);
    if receipt_id <= 0 {
        return Err(AppError(Error::biz(400, "采购入库单不能为空")));
    }
    let receipt =
        sqlx::query("SELECT * FROM purchase_receipt WHERE id=? AND is_del=0 AND status=2 LIMIT 1")
            .bind(receipt_id)
            .fetch_optional(&state.repos.pool)
            .await
            .map_err(db)?
            .ok_or_else(|| AppError(Error::biz(400, "采购入库单不存在或未确认")))?;
    let shop_id: i32 = receipt.try_get("shop_id").unwrap_or(0);
    let vendor_id: i32 = receipt.try_get("vendor_id").unwrap_or(0);
    let order_id: i64 = receipt.try_get("order_id").unwrap_or(0);
    let inputs = body
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if inputs.is_empty() {
        return Err(AppError(Error::biz(400, "请选择退货商品")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let return_sn = format!("PT{}{:04}", now, rand_suffix());
    let mut tx = state.repos.pool.begin().await.map_err(db)?;
    let return_id = sqlx::query(
        "INSERT INTO purchase_return(return_sn,order_id,receipt_id,shop_id,vendor_id,business_date,status,total_quantity,total_amount,reason,remark,confirm_time,version,create_time,update_time) VALUES(?,?,?,?,?,?,2,0,0,?,?,?,0,?,?)",
    )
    .bind(&return_sn).bind(order_id).bind(receipt_id).bind(shop_id).bind(vendor_id)
    .bind(body.get("businessDate").and_then(Value::as_i64).unwrap_or(now))
    .bind(body.get("reason").and_then(Value::as_str).unwrap_or(""))
    .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
    .bind(now).bind(now).bind(now)
    .execute(&mut *tx).await.map_err(db)?.last_insert_id() as i64;
    let mut total_qty = 0i64;
    let mut total_amount = rust_decimal::Decimal::ZERO;
    for input in inputs {
        let item_id = input
            .get("receiptItemId")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let qty = input.get("quantity").and_then(Value::as_i64).unwrap_or(0);
        if item_id <= 0 || qty <= 0 {
            return Err(AppError(Error::biz(400, "退货商品或数量不合法")));
        }
        let item = sqlx::query(
            "SELECT * FROM purchase_receipt_item WHERE id=? AND receipt_id=? AND is_del=0 LIMIT 1",
        )
        .bind(item_id)
        .bind(receipt_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db)?
        .ok_or_else(|| AppError(Error::biz(400, "退货明细不属于入库单")))?;
        let q: i32 = item.try_get("quantity").unwrap_or(0);
        let returned: i32 = item.try_get("returned_quantity").unwrap_or(0);
        if returned + qty as i32 > q {
            return Err(AppError(Error::biz(400, "退货数量超过可退数量")));
        }
        let original_price = item
            .try_get::<rust_decimal::Decimal, _>("purchase_price")
            .unwrap_or_default();
        let return_price = rust_decimal::Decimal::from_str(
            &input
                .get("returnPrice")
                .and_then(Value::as_str)
                .unwrap_or("0"),
        )
        .unwrap_or(original_price);
        let amount = return_price * rust_decimal::Decimal::from(qty);
        let product_id: i32 = item.try_get("product_id").unwrap_or(0);
        let sku_id: i32 = item.try_get("sku_id").unwrap_or(0);
        sqlx::query(
            "INSERT INTO purchase_return_item(return_id,receipt_item_id,product_id,sku_id,product_name,sku_name,product_sn,sku_sn,pic_thumb,product_unit,quantity,returnable_quantity,available_quantity,returnable_quantity_after,original_price,return_price,amount,reason,create_time,update_time) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(return_id).bind(item_id).bind(product_id).bind(sku_id)
        .bind(item.try_get::<String, _>("product_name").unwrap_or_default())
        .bind(item.try_get::<String, _>("sku_name").unwrap_or_default())
        .bind(item.try_get::<String, _>("product_sn").unwrap_or_default())
        .bind(item.try_get::<String, _>("sku_sn").unwrap_or_default())
        .bind(item.try_get::<String, _>("pic_thumb").unwrap_or_default())
        .bind(item.try_get::<String, _>("product_unit").unwrap_or_default())
        .bind(qty as i32).bind(q).bind(q - returned).bind(q - returned - qty as i32)
        .bind(original_price).bind(return_price).bind(amount)
        .bind(input.get("reason").and_then(Value::as_str).unwrap_or(""))
        .bind(now).bind(now)
        .execute(&mut *tx).await.map_err(db)?;
        sqlx::query(
            "UPDATE purchase_receipt_item SET returned_quantity=returned_quantity+? WHERE id=?",
        )
        .bind(qty as i32)
        .bind(item_id)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
        sqlx::query("UPDATE product SET product_stock=product_stock-? WHERE product_id=?")
            .bind(qty as i32)
            .bind(product_id)
            .execute(&mut *tx)
            .await
            .map_err(db)?;
        if sku_id > 0 {
            sqlx::query("UPDATE product_sku SET sku_stock=GREATEST(COALESCE(sku_stock,0)-?,0) WHERE sku_id=?")
                .bind(qty as i32).bind(sku_id).execute(&mut *tx).await.map_err(db)?;
        }
        total_qty += qty;
        total_amount += amount;
    }
    sqlx::query("UPDATE purchase_return SET total_quantity=?, total_amount=? WHERE id=?")
        .bind(total_qty)
        .bind(total_amount)
        .bind(return_id)
        .execute(&mut *tx)
        .await
        .map_err(db)?;
    tx.commit().await.map_err(db)?;
    ok(return_id)
}
async fn return_confirm(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    set_status(
        &state,
        "purchase_return",
        body.get("id").and_then(Value::as_i64).unwrap_or(0),
        1,
    )
    .await?;
    ok(())
}
async fn return_delete(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    soft_delete(
        &state,
        "purchase_return",
        body.get("id").and_then(Value::as_i64).unwrap_or(0),
    )
    .await?;
    ok(())
}

// ————————————————— setting —————————————————
async fn setting_detail(State(state): State<AdminState>) -> ApiResult<Value> {
    let row = sqlx::query("SELECT * FROM purchase_setting WHERE is_del=0 ORDER BY id DESC LIMIT 1")
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(row.as_ref().map(row_to_json).unwrap_or(Value::Null))
}
async fn setting_save(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let now = tigshop_common::utils::now_seconds() as i64;
    sqlx::query("INSERT INTO purchase_setting(shop_id,auto_finish_days,allow_over_receive,create_time,update_time) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE auto_finish_days=VALUES(auto_finish_days),allow_over_receive=VALUES(allow_over_receive),update_time=VALUES(update_time)")
        .bind(body.get("shopId").and_then(Value::as_i64).unwrap_or(0) as i32)
        .bind(body.get("autoFinishDays").and_then(Value::as_i64).unwrap_or(0) as i32)
        .bind(body.get("allowOverReceive").and_then(Value::as_i64).unwrap_or(0) as i32)
        .bind(now).bind(now)
        .execute(&state.repos.pool).await.map_err(db)?;
    ok(())
}
