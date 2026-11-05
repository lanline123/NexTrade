//! 店铺/门店分组与店铺标签（v5.8.61 `/adminapi/merchant/shopGroup`、`/adminapi/shop/tip`）。

use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use tigshop_core::Error;
use tigshop_security::web::{ok, ApiResult, AppError};

use crate::AdminState;

use super::supply_chain::row_to_json;

pub fn routes(state: &AdminState) -> Router<AdminState> {
    let _ = state;
    Router::new()
        .route("/merchant/shopGroup/list", get(group_list))
        .route("/merchant/shopGroup/detail", get(group_detail))
        .route("/merchant/shopGroup/create", post(group_create))
        .route("/merchant/shopGroup/update", post(group_update))
        .route("/merchant/shopGroup/del", post(group_del))
        .route("/merchant/shopGroup/shopList", get(group_shop_list))
        .route("/merchant/shopGroup/selectList", get(group_select_list))
        .route("/shop/tip/list", get(tip_list))
        .route("/shop/tip/detail", get(tip_detail))
        .route("/shop/tip/create", post(tip_create))
        .route("/shop/tip/update", post(tip_update))
        .route("/shop/tip/del", post(tip_delete))
        .route("/shop/tip/batch", post(tip_batch))
        .route("/shop/tip/updateField", post(tip_update_field))
        .route("/shop/tip/selectAllTip", get(tip_select_all))
        .route("/shop/tip/tipConfig", get(tip_config))
}

#[must_use]
pub fn implemented_routes() -> Vec<tigshop_openapi::RouteDoc> {
    [
        ("GET", "/api/merchant/shopGroup/list"),
        ("GET", "/api/merchant/shopGroup/detail"),
        ("POST", "/api/merchant/shopGroup/create"),
        ("POST", "/api/merchant/shopGroup/update"),
        ("POST", "/api/merchant/shopGroup/del"),
        ("GET", "/api/merchant/shopGroup/shopList"),
        ("GET", "/api/merchant/shopGroup/selectList"),
        ("GET", "/api/shop/tip/list"),
        ("GET", "/api/shop/tip/detail"),
        ("POST", "/api/shop/tip/create"),
        ("POST", "/api/shop/tip/update"),
        ("POST", "/api/shop/tip/del"),
        ("POST", "/api/shop/tip/batch"),
        ("POST", "/api/shop/tip/updateField"),
        ("GET", "/api/shop/tip/selectAllTip"),
        ("GET", "/api/shop/tip/tipConfig"),
    ]
    .iter()
    .map(|(m, p)| tigshop_openapi::RouteDoc::new(m, p, "ShopGroupController/ShopTipController"))
    .collect()
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Pg {
    page: Option<u64>,
    size: Option<u64>,
    keyword: Option<String>,
    id: Option<i32>,
    group_id: Option<i32>,
    shop_type: Option<i32>,
}

fn pg(q: &Pg) -> (u64, u64, i64) {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(15).clamp(1, 200);
    (page, size, ((page - 1) * size) as i64)
}

async fn group_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let (page, size, offset) = pg(&q);
    let kw = format!("%{}%", q.keyword.clone().unwrap_or_default().trim());
    let shop_type = q.shop_type.unwrap_or(1);
    let (total,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM shop_group WHERE shop_type=? AND (?='%%' OR group_name LIKE ?)",
    )
    .bind(shop_type)
    .bind(&kw)
    .bind(&kw)
    .fetch_one(&state.repos.pool)
    .await
    .map_err(db)?;
    let rows = sqlx::query(
        "SELECT g.*, (SELECT COUNT(*) FROM shop_group_relation r WHERE r.group_id=g.group_id) AS shop_count \
         FROM shop_group g WHERE g.shop_type=? AND (?='%%' OR g.group_name LIKE ?) ORDER BY g.group_id DESC LIMIT ? OFFSET ?",
    ).bind(shop_type).bind(&kw).bind(&kw).bind(size as i64).bind(offset)
        .fetch_all(&state.repos.pool).await.map_err(db)?;
    ok(
        json!({"records": rows.iter().map(row_to_json).collect::<Vec<_>>(), "total": total, "page": page, "size": size}),
    )
}

async fn group_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let group_id = q.group_id.or(q.id).unwrap_or(0);
    let row = sqlx::query("SELECT * FROM shop_group WHERE group_id=? LIMIT 1")
        .bind(group_id)
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(db)?;
    let Some(row) = row else {
        return ok(Value::Null);
    };
    let mut value = row_to_json(&row);
    let ids: Vec<(i32,)> =
        sqlx::query_as("SELECT shop_id FROM shop_group_relation WHERE group_id=? ORDER BY shop_id")
            .bind(group_id)
            .fetch_all(&state.repos.pool)
            .await
            .map_err(db)?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert(
            "shopIds".into(),
            json!(ids.into_iter().map(|(id,)| id).collect::<Vec<_>>()),
        );
    }
    ok(value)
}

async fn group_create(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<i32> {
    let name = body
        .get("groupName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if name.is_empty() {
        return Err(AppError(Error::biz(400, "分组名称不能为空")));
    }
    let now = tigshop_common::utils::now_seconds() as i64;
    let r = sqlx::query("INSERT INTO shop_group(shop_type,group_name,remark,create_time,update_time) VALUES(?,?,?,?,?)")
        .bind(body.get("shopType").and_then(Value::as_i64).unwrap_or(1) as i32)
        .bind(name)
        .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
        .bind(now).bind(now)
        .execute(&state.repos.pool).await.map_err(db)?;
    let id = r.last_insert_id() as i32;
    replace_relations(&state, id, body.get("shopIds")).await?;
    ok(id)
}

async fn group_update(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("groupId").and_then(Value::as_i64).unwrap_or(0) as i32;
    if id <= 0 {
        return Err(AppError(Error::biz(400, "分组不存在")));
    }
    sqlx::query("UPDATE shop_group SET group_name=?, remark=?, update_time=? WHERE group_id=?")
        .bind(body.get("groupName").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("remark").and_then(Value::as_str).unwrap_or(""))
        .bind(tigshop_common::utils::now_seconds() as i64)
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    replace_relations(&state, id, body.get("shopIds")).await?;
    ok(())
}

async fn replace_relations(
    state: &AdminState,
    group_id: i32,
    shop_ids: Option<&Value>,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM shop_group_relation WHERE group_id=?")
        .bind(group_id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    if let Some(Value::Array(ids)) = shop_ids {
        for id in ids {
            if let Some(shop_id) = id.as_i64() {
                sqlx::query("INSERT INTO shop_group_relation(group_id,shop_id) VALUES(?,?)")
                    .bind(group_id)
                    .bind(shop_id as i32)
                    .execute(&state.repos.pool)
                    .await
                    .map_err(db)?;
            }
        }
    }
    Ok(())
}

async fn group_del(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("groupId").and_then(Value::as_i64).unwrap_or(0);
    sqlx::query("DELETE FROM shop_group_relation WHERE group_id=?")
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    sqlx::query("DELETE FROM shop_group WHERE group_id=?")
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}

async fn group_shop_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let (page, size, offset) = pg(&q);
    let group_id = q.group_id.or(q.id).unwrap_or(0);
    let (total,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM shop_group_relation WHERE group_id=?")
            .bind(group_id)
            .fetch_one(&state.repos.pool)
            .await
            .map_err(db)?;
    let ids: Vec<(i32,)> = sqlx::query_as("SELECT shop_id FROM shop_group_relation WHERE group_id=? ORDER BY shop_id LIMIT ? OFFSET ?")
        .bind(group_id).bind(size as i64).bind(offset).fetch_all(&state.repos.pool).await.map_err(db)?;
    let mut records = Vec::new();
    for (shop_id,) in ids {
        if shop_id == 0 {
            records.push(json!({"shopId": 0, "shopTitle": "平台自营"}));
            continue;
        }
        if let Some(row) = sqlx::query("SELECT * FROM shop WHERE shop_id=? LIMIT 1")
            .bind(shop_id)
            .fetch_optional(&state.repos.pool)
            .await
            .map_err(db)?
        {
            records.push(row_to_json(&row));
        }
    }
    ok(json!({"records": records, "total": total, "page": page, "size": size}))
}

async fn group_select_list(
    State(state): State<AdminState>,
    Query(q): Query<Pg>,
) -> ApiResult<Value> {
    let rows = sqlx::query("SELECT group_id, group_name, shop_type FROM shop_group WHERE shop_type=? ORDER BY group_id DESC")
        .bind(q.shop_type.unwrap_or(1)).fetch_all(&state.repos.pool).await.map_err(db)?;
    ok(json!(rows.iter().map(row_to_json).collect::<Vec<_>>()))
}

// ————————————————— shop tip —————————————————
async fn tip_list(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let (page, size, offset) = pg(&q);
    let kw = format!("%{}%", q.keyword.clone().unwrap_or_default().trim());
    let (total,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM tip WHERE (?='%%' OR tip_name LIKE ?)")
            .bind(&kw)
            .bind(&kw)
            .fetch_one(&state.repos.pool)
            .await
            .map_err(db)?;
    let rows = sqlx::query(
        "SELECT * FROM tip WHERE (?='%%' OR tip_name LIKE ?) ORDER BY tip_id DESC LIMIT ? OFFSET ?",
    )
    .bind(&kw)
    .bind(&kw)
    .bind(size as i64)
    .bind(offset)
    .fetch_all(&state.repos.pool)
    .await
    .map_err(db)?;
    ok(
        json!({"records": rows.iter().map(row_to_json).collect::<Vec<_>>(), "total": total, "page": page, "size": size}),
    )
}

async fn tip_detail(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let row = sqlx::query("SELECT * FROM tip WHERE tip_id=?")
        .bind(q.id.unwrap_or(0))
        .fetch_optional(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(row.as_ref().map(row_to_json).unwrap_or(Value::Null))
}

async fn tip_create(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let name = body
        .get("tipName")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if name.is_empty() {
        return Err(AppError(Error::biz(400, "标签名称不能为空")));
    }
    sqlx::query("INSERT INTO tip(tip_name,status,add_time) VALUES(?,?,?)")
        .bind(name)
        .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
        .bind(tigshop_common::utils::now_seconds() as i64)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}

async fn tip_update(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    sqlx::query("UPDATE tip SET tip_name=?, status=? WHERE tip_id=?")
        .bind(body.get("tipName").and_then(Value::as_str).unwrap_or(""))
        .bind(body.get("status").and_then(Value::as_i64).unwrap_or(1) as i32)
        .bind(body.get("id").and_then(Value::as_i64).unwrap_or(0))
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}

async fn tip_delete(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    let id = body.get("id").and_then(Value::as_i64).unwrap_or(0);
    sqlx::query("DELETE FROM tip WHERE tip_id=?")
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    sqlx::query("DELETE FROM store_tip WHERE tip_id=?")
        .bind(id)
        .execute(&state.repos.pool)
        .await
        .map_err(db)?;
    ok(())
}

async fn tip_batch(State(state): State<AdminState>, Json(body): Json<Value>) -> ApiResult<()> {
    if let Some(Value::Array(ids)) = body.get("ids") {
        for id in ids {
            let id = id.as_i64().unwrap_or(0);
            if body.get("type").and_then(Value::as_str) == Some("del") {
                sqlx::query("DELETE FROM tip WHERE tip_id=?")
                    .bind(id)
                    .execute(&state.repos.pool)
                    .await
                    .map_err(db)?;
            }
        }
    }
    ok(())
}

async fn tip_update_field(
    State(state): State<AdminState>,
    Json(body): Json<Value>,
) -> ApiResult<()> {
    let field = body.get("field").and_then(Value::as_str).unwrap_or("");
    if field != "tipName" && field != "status" {
        return Err(AppError(Error::biz(400, "不允许修改字段")));
    }
    let column = if field == "tipName" {
        "tip_name"
    } else {
        "status"
    };
    let value = body.get("val").cloned().unwrap_or(Value::Null);
    let sql = format!("UPDATE tip SET {column}=? WHERE tip_id=?");
    if field == "status" {
        sqlx::query(&sql)
            .bind(
                value
                    .as_str()
                    .and_then(|s| s.parse::<i32>().ok())
                    .or(value.as_i64().map(|v| v as i32))
                    .unwrap_or(0),
            )
            .bind(body.get("id").and_then(Value::as_i64).unwrap_or(0))
            .execute(&state.repos.pool)
            .await
            .map_err(db)?;
    } else {
        sqlx::query(&sql)
            .bind(value.as_str().unwrap_or(""))
            .bind(body.get("id").and_then(Value::as_i64).unwrap_or(0))
            .execute(&state.repos.pool)
            .await
            .map_err(db)?;
    }
    ok(())
}

async fn tip_select_all(State(state): State<AdminState>, Query(q): Query<Pg>) -> ApiResult<Value> {
    let kw = format!("%{}%", q.keyword.clone().unwrap_or_default().trim());
    let rows = sqlx::query(
        "SELECT * FROM tip WHERE status=1 AND (?='%%' OR tip_name LIKE ?) ORDER BY tip_id DESC",
    )
    .bind(&kw)
    .bind(&kw)
    .fetch_all(&state.repos.pool)
    .await
    .map_err(db)?;
    ok(json!(rows.iter().map(row_to_json).collect::<Vec<_>>()))
}

async fn tip_config() -> ApiResult<Value> {
    ok(json!([
        {"value": 0, "label": "禁用"},
        {"value": 1, "label": "启用"}
    ]))
}

fn db(e: sqlx::Error) -> AppError {
    AppError(Error::Database(e.to_string()))
}
