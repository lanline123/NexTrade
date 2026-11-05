//! 微信直播商品库域（content::wechat_live_goods）DTO / 纯函数。
//!
//! 对应原 Java `WechatLiveGoodsController` 的 3 个端点：
//! `POST /adminapi/content/wechatLiveGoods/import`、`GET .../list`、`GET .../query`。
//!
//! 商品库完全依赖微信侧「直播商品库」API（导入/审核/查询）：
//! 本地 `wechat_live_goods` 表只是回调缓存，未迁移同步任务前不可信。
//! 本域保留端点与本地校验，统一返回明确「未迁移」业务错误，不编造商品数据。

use serde::{Deserialize, Serialize};

/// `未选择项目`
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";
/// 微信直播商品库未迁移。
pub const MSG_NOT_MIGRATED: &str =
    "微信直播商品库依赖微信开放平台「直播商品」API（导入/审核/查询），当前 Rust 侧尚未迁移，本接口暂不可用";

/// 导入入参（Java `WechatLiveGoodsImportParam` 子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatLiveGoodsImportParam {
    pub ids: Option<Vec<i32>>,
    pub product_ids: Option<Vec<i64>>,
    pub room_id: Option<i32>,
}

/// 列表查询（Java `WechatLiveGoodsPageQuery` 子集）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatLiveGoodsPageQuery {
    pub room_id: Option<i32>,
    pub audit_status: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// 单商品查询（Java `queryGoods` 参数）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatLiveGoodsQuery {
    pub wechat_goods_id: Option<i32>,
    pub product_id: Option<i64>,
}

/// 商品 VO（Java `WechatLiveGoodsVO` 常用字段；未迁移时不会返回数据）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatLiveGoodsVO {
    pub id: i64,
    pub room_id: Option<i32>,
    pub wechat_goods_id: Option<i32>,
    pub product_id: Option<i64>,
    pub product_sku_id: i64,
    pub goods_name: Option<String>,
    pub cover_img: Option<String>,
    pub price: Option<i64>,
    pub price_type: Option<i32>,
    pub url: Option<String>,
    pub audit_status: Option<i32>,
    pub sort: Option<i32>,
}

/// 导入校验（至少提供一个商品 id）。
#[must_use]
pub fn validate_import(param: &WechatLiveGoodsImportParam) -> Result<(), String> {
    let has_ids = param.ids.as_ref().is_some_and(|v| !v.is_empty());
    let has_product_ids = param.product_ids.as_ref().is_some_and(|v| !v.is_empty());
    if !has_ids && !has_product_ids {
        return Err(MSG_UNSELECTED_ITEM.to_string());
    }
    Ok(())
}

/// 单商品查询校验（需 wechatGoodsId 或 productId）。
#[must_use]
pub fn validate_query(q: &WechatLiveGoodsQuery) -> Result<(), String> {
    if q.wechat_goods_id.unwrap_or(0) <= 0 && q.product_id.unwrap_or(0) <= 0 {
        return Err(MSG_UNSELECTED_ITEM.to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_requires_goods() {
        let param = WechatLiveGoodsImportParam::default();
        assert_eq!(validate_import(&param).unwrap_err(), MSG_UNSELECTED_ITEM);
        let param = WechatLiveGoodsImportParam {
            ids: Some(vec![1]),
            ..Default::default()
        };
        assert!(validate_import(&param).is_ok());
    }

    #[test]
    fn query_requires_id() {
        let q = WechatLiveGoodsQuery::default();
        assert_eq!(validate_query(&q).unwrap_err(), MSG_UNSELECTED_ITEM);
        let q = WechatLiveGoodsQuery {
            wechat_goods_id: Some(9),
            ..Default::default()
        };
        assert!(validate_query(&q).is_ok());
    }

    #[test]
    fn not_migrated_message_explicit() {
        assert!(MSG_NOT_MIGRATED.contains("尚未迁移"));
    }

    #[test]
    fn queries_accept_java_names() {
        let q: WechatLiveGoodsPageQuery = serde_json::from_str(
            r#"{"roomId":1,"auditStatus":2,"keyword":"a","page":1,"size":10}"#,
        )
        .unwrap();
        assert_eq!(q.room_id, Some(1));
        assert_eq!(q.audit_status, Some(2));
    }
}
