//! 微信直播订单同步回调 域 DTO / VO（content::wechat_live_sync_callback）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。
//!
//! 对应 Java `com.tigshop.bean.dto.content.WechatLiveSyncCallbackDTO`
//! （`java/tigshop-bean/src/main/java/com/tigshop/bean/dto/content/WechatLiveSyncCallbackDTO.java`）。
//!
//! ## 常量对齐 `WechatLiveOrderSyncConstants`
//! （`java/tigshop-common/src/main/java/com/tigshop/common/constant/content/WechatLiveOrderSyncConstants.java`）

use std::collections::HashMap;

use crate::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 同步方向：入站回调（Java `DIRECTION_INBOUND = "INBOUND"`）。
pub const DIRECTION_INBOUND: &str = "INBOUND";
/// 同步状态：成功（Java `SYNC_STATUS_SUCCESS = 1`）。
pub const SYNC_STATUS_SUCCESS: i32 = 1;
/// 同步状态：部分同步（Java `SYNC_STATUS_PARTIAL = 4`）。
pub const SYNC_STATUS_PARTIAL: i32 = 4;
/// `order_extension` 中最后一次回调快照的键
/// （Java `ORDER_EXTENSION_WECHAT_LIVE_LAST_CALLBACK`）。
pub const ORDER_EXTENSION_WECHAT_LIVE_LAST_CALLBACK: &str = "wechatLiveLastCallback";
/// Java `SyncLog.responseData` 写入的固定应答
/// （`JSONUtil.toJsonStr(Map.of("message", "callback accepted"))`）。
pub const CALLBACK_ACCEPTED_RESPONSE: &str = r#"{"message":"callback accepted"}"#;

/// 微信直播同步回调请求体（对应 Java `WechatLiveSyncCallbackDTO`）。
///
/// `eventType` / `idempotentKey` 在 Java 侧是 `@NotBlank`，这里用 `Option`
/// 接住「字段缺失」，由 [`WechatLiveSyncCallbackDTO::validate`] 复刻
/// Bean Validation 的文案（缺失与全空白都算不通过 —— 这正是 `@NotBlank`
/// 相对 `@NotNull` 的差异）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WechatLiveSyncCallbackDTO {
    /// 事件类型（Java `@NotBlank(message = "eventType不能为空")`）
    pub event_type: Option<String>,
    /// 幂等键（Java `@NotBlank(message = "idempotentKey不能为空")`）
    pub idempotent_key: Option<String>,
    /// 订单ID
    pub order_id: Option<i32>,
    /// 订单号
    pub order_sn: Option<String>,
    /// 售后ID
    pub aftersale_id: Option<i32>,
    /// 退款ID
    pub refund_id: Option<i32>,
    /// 直播房间ID
    pub room_id: Option<i32>,
    /// 状态
    pub status: Option<String>,
    /// 附加消息
    pub message: Option<String>,
    /// 回调载荷（Java `Map<String, Object>`，原样透传）
    #[serde(deserialize_with = "de_opt_object")]
    pub payload: Option<HashMap<String, Value>>,
}

/// 只接受 JSON **对象**（或缺失 / `null`）的 `payload` 反序列化器。
///
/// Java 侧 `payload` 声明为 `Map<String, Object>`：Jackson 遇到数组 / 字符串 /
/// 数字会直接抛 `MismatchedInputException` → `HttpMessageNotReadableException`
/// →「参数错误」。serde 默认对 `Option<HashMap>` 更宽松，这里显式收紧。
fn de_opt_object<'de, D>(de: D) -> std::result::Result<Option<HashMap<String, Value>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<Value>::deserialize(de)?;
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Object(map)) => Ok(Some(map.into_iter().collect())),
        Some(other) => Err(serde::de::Error::custom(format!(
            "payload 期望 JSON 对象，实际为 {}",
            json_kind(&other)
        ))),
    }
}

/// JSON 值的类型名（仅用于错误文案）。
fn json_kind(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "布尔值",
        Value::Number(_) => "数字",
        Value::String(_) => "字符串",
        Value::Array(_) => "数组",
        Value::Object(_) => "对象",
    }
}

/// Java `HttpStatus.SERVICE_DATA_ERROR`（`MethodArgumentNotValidException`
/// 走 `AjaxResult.error(SERVICE_DATA_ERROR, 合并文案)`）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

impl WechatLiveSyncCallbackDTO {
    /// 复刻 Java `@Valid` 校验（`GlobalExceptionHandler
    /// #handleMethodArgumentNotValidException`）。
    ///
    /// 文案与 Java 完全一致：`eventType不能为空` / `idempotentKey不能为空`，
    /// 两个字段都不合法时用 `", "` 连接（Java `String.join(", ", errors.values())`）；
    /// 顺序按 DTO 字段声明顺序（Java 用 `HashMap` 收集，顺序不保证，
    /// 这里取稳定顺序便于测试与前端展示）。
    ///
    /// # Errors
    /// 业务码 `1001` + 上述文案。
    pub fn validate(&self) -> Result<()> {
        let mut msgs: Vec<String> = Vec::new();
        // @NotBlank：null 或 trim 后为空串都算不通过
        if !is_not_blank(self.event_type.as_deref()) {
            msgs.push("eventType不能为空".to_string());
        }
        if !is_not_blank(self.idempotent_key.as_deref()) {
            msgs.push("idempotentKey不能为空".to_string());
        }
        if msgs.is_empty() {
            return Ok(());
        }
        Err(Error::biz(SERVICE_DATA_ERROR, msgs.join(", ")))
    }

    /// `idempotentKey` 的有效值（已校验非空白；Java SpEL `#callbackDTO.idempotentKey`）。
    #[must_use]
    pub fn idempotent_key_trimmed(&self) -> Option<&str> {
        self.idempotent_key.as_deref().map(str::trim)
    }

    /// 写入 `wechat_live_sync_log.request_data` 的原文。
    ///
    /// 对应 Java `JSONUtil.toJsonStr(callbackDTO)`：Hutool 默认
    /// **忽略 null 字段**（`JSONConfig#ignoreNullValue = true`），因此这里
    /// 手工跳过 `None`，而不是直接 `serde_json::to_string(self)`
    /// （那会把 `"orderId":null` 一并写进库，与 Java 落库文本不一致）。
    /// 键名沿用 Java bean 属性名 = camelCase（与 DTO 序列化一致）。
    #[must_use]
    pub fn request_data_json(&self) -> String {
        let mut map = serde_json::Map::new();
        push_str(&mut map, "eventType", self.event_type.as_deref());
        push_str(&mut map, "idempotentKey", self.idempotent_key.as_deref());
        push_num(&mut map, "orderId", self.order_id);
        push_str(&mut map, "orderSn", self.order_sn.as_deref());
        push_num(&mut map, "aftersaleId", self.aftersale_id);
        push_num(&mut map, "refundId", self.refund_id);
        push_num(&mut map, "roomId", self.room_id);
        push_str(&mut map, "status", self.status.as_deref());
        push_str(&mut map, "message", self.message.as_deref());
        if let Some(payload) = self.payload.as_ref() {
            map.insert(
                "payload".to_string(),
                Value::Object(serde_json::Map::from_iter(
                    payload.iter().map(|(k, v)| (k.clone(), v.clone())),
                )),
            );
        }
        Value::Object(map).to_string()
    }

    /// 是否应走「微信回调自动建单」分支（Java `shouldAutoCreateOrder`）。
    ///
    /// Java 判定：`payload` 非空 且
    /// （`extractOrderItemPayload(payload)` 非空 或 `toInt(payload["productId"]) != null`）。
    /// `extractOrderItemPayload` 依次看 `items / orderItems / goodsList / products`
    /// 四个键里是否有「至少一个 Map 元素」，都没有时若 `payload` 含 `productId`
    /// 键则把整个 payload 当成单条明细。
    #[must_use]
    pub fn should_auto_create_order(&self) -> bool {
        let payload = match self.payload.as_ref() {
            Some(p) if !p.is_empty() => p,
            _ => return false,
        };
        !extract_order_item_payload(payload).is_empty()
            || to_int(payload.get("productId")).is_some()
    }

    /// 目标订单ID（Java `resolveOrderId` 的第一优先级：body 里直接带的 `orderId`）。
    #[must_use]
    pub fn declared_order_id(&self) -> Option<i32> {
        self.order_id
    }

    /// 有效的 `orderSn`（Java `StringUtils.isNotBlank` 才算数）。
    #[must_use]
    pub fn effective_order_sn(&self) -> Option<&str> {
        self.order_sn
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 构造写入 `order_extension` 的回调快照
    /// （Java `callbackSnapshot.put("eventType"/"status"/"message"/"payload", ...)`；
    /// fastjson 默认同样忽略 null 值）。
    #[must_use]
    pub fn callback_snapshot(&self) -> Value {
        let mut map = serde_json::Map::new();
        push_str(&mut map, "eventType", self.event_type.as_deref());
        push_str(&mut map, "status", self.status.as_deref());
        push_str(&mut map, "message", self.message.as_deref());
        if let Some(payload) = self.payload.as_ref() {
            map.insert(
                "payload".to_string(),
                Value::Object(serde_json::Map::from_iter(
                    payload.iter().map(|(k, v)| (k.clone(), v.clone())),
                )),
            );
        }
        Value::Object(map)
    }
}

fn push_str(map: &mut serde_json::Map<String, Value>, key: &str, value: Option<&str>) {
    if let Some(v) = value {
        map.insert(key.to_string(), Value::String(v.to_string()));
    }
}

fn push_num(map: &mut serde_json::Map<String, Value>, key: &str, value: Option<i32>) {
    if let Some(v) = value {
        map.insert(key.to_string(), Value::from(v));
    }
}

/// Java `StringUtils.isNotBlank`。
#[must_use]
pub fn is_not_blank(value: Option<&str>) -> bool {
    value.map(|v| !v.trim().is_empty()).unwrap_or(false)
}

/// Java `extractOrderItemPayload`：从 payload 中取订单明细数组。
#[must_use]
pub fn extract_order_item_payload(payload: &HashMap<String, Value>) -> Vec<Value> {
    for key in ["items", "orderItems", "goodsList", "products"] {
        let Some(Value::Array(arr)) = payload.get(key) else {
            continue;
        };
        let result: Vec<Value> = arr
            .iter()
            .filter(|item| matches!(item, Value::Object(_)))
            .cloned()
            .collect();
        if !result.is_empty() {
            return result;
        }
    }
    // 兜底：`productId` 存在**且可转 int** 时，把整个 payload 当单条明细。
    // 注意必须用 `to_int(...).is_some()` 而非 `contains_key`：Java 条件为
    // `toInt(payload.get("productId")) != null`，像 `{"productId":{"a":1}}`
    // 这种不可转 int 的值**不应**被当成有效明细（否则会误触发自动建单）。
    if to_int(payload.get("productId")).is_some() {
        // Java: List.of(new HashMap<>(payload))
        let whole = Value::Object(serde_json::Map::from_iter(
            payload.iter().map(|(k, v)| (k.clone(), v.clone())),
        ));
        return vec![whole];
    }
    Vec::new()
}

/// Java `toInt(Object)`：`Integer.parseInt(String.valueOf(value))`，
/// 任何异常（含 null）都返回 `None`。
#[must_use]
pub fn to_int(value: Option<&Value>) -> Option<i32> {
    match value? {
        Value::Null => None,
        Value::Number(n) => n.to_string().parse::<i32>().ok(),
        Value::String(s) => s.trim().parse::<i32>().ok(),
        // Java: String.valueOf(true) = "true" → parseInt 抛 → null
        Value::Bool(_) => None,
        // Java 对 Map/List 走 String.valueOf → parseInt 必抛 → null
        Value::Object(_) | Value::Array(_) => None,
    }
}

/// Java `WechatLiveOrderContextUtils.applyLastCallback(orderExtension, snapshot)`。
///
/// - 原值空白或**不是合法 JSON 对象** → 先退化成空对象（Java `parseObject`
///   的 catch 分支返回 `new JSONObject()`）；
/// - 快照非空才写入 `wechatLiveLastCallback` 键；
/// - 恒返回新的 JSON 文本（不会返回 `null`，因为 Java 返回
///   `jsonObject.toJSONString()`）。
#[must_use]
pub fn apply_last_callback(order_extension: Option<&str>, snapshot: &Value) -> String {
    let mut base = match order_extension {
        Some(raw) if !raw.trim().is_empty() => serde_json::from_str::<Value>(raw)
            .ok()
            .filter(|v| v.is_object())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default(),
        _ => serde_json::Map::new(),
    };
    if snapshot.as_object().is_some_and(|m| !m.is_empty()) {
        base.insert(
            ORDER_EXTENSION_WECHAT_LIVE_LAST_CALLBACK.to_string(),
            snapshot.clone(),
        );
    }
    Value::Object(base).to_string()
}

/// 自动建单链路未迁移时的应答文案（见服务层模块头）。
pub const AUTO_CREATE_UNMIGRATED_MSG: &str =
    "微信直播回调自动建单链路尚未迁移（依赖微信直播商品/房间归因、SKU 与促销快照等多个未迁移服务），请携带 orderId 或已存在的 orderSn 调用，或在 Java 侧处理该回调";

#[cfg(test)]
mod tests {
    use super::*;

    fn dto(json: Value) -> WechatLiveSyncCallbackDTO {
        serde_json::from_value(json).unwrap()
    }

    #[test]
    fn validate_accepts_the_two_required_fields() {
        let d = dto(serde_json::json!({"eventType": "ORDER_PAID", "idempotentKey": "k-1"}));
        assert!(d.validate().is_ok());
    }

    #[test]
    fn validate_messages_match_java_annotations() {
        let err = dto(serde_json::json!({})).validate().unwrap_err();
        match err {
            Error::Biz { code, msg } => {
                assert_eq!(code, SERVICE_DATA_ERROR);
                assert_eq!(msg, "eventType不能为空, idempotentKey不能为空");
            }
            other => panic!("期望 Biz，得到 {other:?}"),
        }

        // @NotBlank：全空白同样不通过（区别于 @NotNull）
        let msg = dto(serde_json::json!({"eventType": "   ", "idempotentKey": "k"}))
            .validate()
            .unwrap_err()
            .to_string();
        assert!(msg.contains("eventType不能为空"), "{msg}");
    }

    #[test]
    fn request_data_json_skips_null_like_hutool() {
        let d = dto(serde_json::json!({"eventType": "E", "idempotentKey": "K"}));
        let s = d.request_data_json();
        assert_eq!(s, r#"{"eventType":"E","idempotentKey":"K"}"#);
        assert!(!s.contains("null"));

        // 0 与空串都要保留（Hutool 只忽略 null）
        let d = dto(serde_json::json!({
            "eventType": "E", "idempotentKey": "K", "orderId": 0, "orderSn": "", "roomId": 7
        }));
        let s = d.request_data_json();
        assert!(s.contains(r#""orderId":0"#), "{s}");
        assert!(s.contains(r#""orderSn":""#), "{s}");
        assert!(s.contains(r#""roomId":7"#), "{s}");
    }

    #[test]
    fn payload_kept_in_request_data_and_snapshot() {
        let d = dto(serde_json::json!({
            "eventType": "E", "idempotentKey": "K",
            "payload": {"productId": 12, "viewerOpenId": "ox"}
        }));
        assert!(d.request_data_json().contains(r#""productId":12"#));
        let snap = d.callback_snapshot();
        assert_eq!(snap["eventType"], "E");
        assert_eq!(snap["payload"]["viewerOpenId"], "ox");
        // status / message 为 null → fastjson 忽略
        assert!(snap.get("status").is_none());
    }

    #[test]
    fn should_auto_create_order_follows_java_branches() {
        // 无 payload
        assert!(
            !dto(serde_json::json!({"eventType":"E","idempotentKey":"K"}))
                .should_auto_create_order()
        );
        // 空 payload
        assert!(
            !dto(serde_json::json!({"eventType":"E","idempotentKey":"K","payload":{}}))
                .should_auto_create_order()
        );
        // items 里有 Map 元素
        assert!(dto(serde_json::json!({"eventType":"E","idempotentKey":"K",
            "payload":{"items":[{"productId":1}]}}))
        .should_auto_create_order());
        // items 全是非 Map → 视为空，再看 productId
        assert!(!dto(serde_json::json!({"eventType":"E","idempotentKey":"K",
            "payload":{"items":["a","b"]}}))
        .should_auto_create_order());
        // 顶层 productId
        assert!(dto(serde_json::json!({"eventType":"E","idempotentKey":"K",
            "payload":{"productId":"9"}}))
        .should_auto_create_order());
        // productId 不可转 int → toInt=null → 不自动建单
        assert!(!dto(serde_json::json!({"eventType":"E","idempotentKey":"K",
            "payload":{"productId":{"a":1}}}))
        .should_auto_create_order());
    }

    #[test]
    fn extract_prefers_first_non_empty_item_array_in_java_key_order() {
        let mut payload = HashMap::new();
        payload.insert("orderItems".to_string(), serde_json::json!([{"a":1}]));
        payload.insert("items".to_string(), serde_json::json!([{"b":2}]));
        // Java 遍历顺序：items → orderItems → goodsList → products
        let got = extract_order_item_payload(&payload);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0]["b"], 2);

        // 非 Map 元素被过滤掉（Java instanceof Map）
        payload.insert("items".to_string(), serde_json::json!(["x", {"c":3}]));
        let got = extract_order_item_payload(&payload);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0]["c"], 3);
    }

    #[test]
    fn to_int_matches_java_parse_int() {
        assert_eq!(to_int(Some(&serde_json::json!(12))), Some(12));
        assert_eq!(to_int(Some(&serde_json::json!("12"))), Some(12));
        assert_eq!(to_int(Some(&serde_json::json!(" 12 "))), Some(12));
        assert_eq!(to_int(Some(&serde_json::json!(12.7))), None); // parseInt("12.7") 抛
        assert_eq!(to_int(Some(&serde_json::json!(true))), None); // parseInt("true") 抛
        assert_eq!(to_int(Some(&serde_json::json!(null))), None);
        assert_eq!(to_int(None), None);
        assert_eq!(to_int(Some(&serde_json::json!({"a":1}))), None);
    }

    #[test]
    fn apply_last_callback_merges_and_repairs_bad_json() {
        let snap = serde_json::json!({"eventType": "E"});
        // 正常合并：保留原键
        let out = apply_last_callback(Some(r#"{"subSource":"wechatLive"}"#), &snap);
        let v: Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["subSource"], "wechatLive");
        assert_eq!(
            v[ORDER_EXTENSION_WECHAT_LIVE_LAST_CALLBACK]["eventType"],
            "E"
        );

        // 空白 / 非法 JSON → 退化为空对象（Java parseObject 的 catch 分支）
        for bad in [None, Some(""), Some("   "), Some("not-json"), Some("[1,2]")] {
            let out = apply_last_callback(bad, &snap);
            let v: Value = serde_json::from_str(&out).unwrap();
            assert!(v.is_object(), "{bad:?} → {out}");
            assert_eq!(
                v[ORDER_EXTENSION_WECHAT_LIVE_LAST_CALLBACK]["eventType"],
                "E"
            );
        }

        // 空快照不写入（Java `!callbackSnapshot.isEmpty()`）
        let out = apply_last_callback(Some(r#"{"a":1}"#), &serde_json::json!({}));
        assert_eq!(out, r#"{"a":1}"#);
    }

    #[test]
    fn effective_order_sn_requires_non_blank() {
        let d = dto(serde_json::json!({"eventType":"E","idempotentKey":"K","orderSn":"  "}));
        assert_eq!(d.effective_order_sn(), None);
        let d = dto(serde_json::json!({"eventType":"E","idempotentKey":"K","orderSn":" SN1 "}));
        assert_eq!(d.effective_order_sn(), Some("SN1"));
    }

    #[test]
    fn constants_match_java_sources() {
        assert_eq!(DIRECTION_INBOUND, "INBOUND");
        assert_eq!(SYNC_STATUS_SUCCESS, 1);
        assert_eq!(SYNC_STATUS_PARTIAL, 4);
        assert_eq!(
            CALLBACK_ACCEPTED_RESPONSE,
            r#"{"message":"callback accepted"}"#
        );
    }
}
