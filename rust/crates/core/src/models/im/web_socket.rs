//! 消息控制器（内部接口 / WebSocket 推送）域 DTO（im::web_socket）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。

use serde::Deserialize;

/// `GET /api/socket/send` 查询参数。
///
/// 对应 Java `WebSocketController.sendMessage(@RequestParam String targetUserId,
/// @RequestParam String message)`（`WebSocketController.java:67`）。
///
/// 两个参数在 Java 侧都是 **required（默认）**，缺失时 Spring 抛
/// `MissingServletRequestParameterException` → `GlobalExceptionHandler` 返回
/// 业务码 `1001` + 文案「接口参数缺失」。这里用 `Option` 接住「缺失」，
/// 由 [`missing_param_error`] 复刻同一码与文案，而不是让 axum 的
/// `Query<T>` 直接抛 400（文案不同）。
///
/// ⚠️ **空串合法**：Java 只有 `@RequestParam`，没有 `@NotBlank`，
/// 故 `message=`（空串）会照常执行；因此这里**只区分「缺失」与「存在」**，
/// 不做 trim / 非空校验。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SocketSendQuery {
    /// 目标用户ID，格式 `isAdmin::userId`（如 `false::123` / `true::1`）
    pub target_user_id: Option<String>,
    /// 要推送的消息内容
    pub message: Option<String>,
}

/// Java `HttpStatus.SERVICE_DATA_ERROR`（`GlobalException` 默认业务码）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// 参数缺失文案（`i18n/messages.properties:260` →
/// `error.param.interface.missing=接口参数缺失`）。
pub const PARAM_MISSING_MSG: &str = "接口参数缺失";

/// 校验查询参数（对应 Java 的 required 参数绑定阶段）。
///
/// # Errors
/// 业务码 `1001`「接口参数缺失」——任一参数缺失（Java
/// `MissingServletRequestParameterException` 的等价分支）。
pub fn validate_query(q: &SocketSendQuery) -> std::result::Result<(String, String), crate::Error> {
    match (q.target_user_id.as_ref(), q.message.as_ref()) {
        (Some(target), Some(message)) => Ok((target.clone(), message.clone())),
        _ => Err(crate::Error::biz(SERVICE_DATA_ERROR, PARAM_MISSING_MSG)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn camel_case_param_names_match_java() {
        // Java 形参名 targetUserId / message → 查询串必须用这两个键
        let q: SocketSendQuery = serde_json::from_value(serde_json::json!({
            "targetUserId": "false::123",
            "message": "hello"
        }))
        .unwrap();
        assert_eq!(q.target_user_id.as_deref(), Some("false::123"));
        assert_eq!(q.message.as_deref(), Some("hello"));
    }

    #[test]
    fn empty_string_is_accepted_like_java() {
        // @RequestParam 只要求「存在」，空串不报错
        let q: SocketSendQuery =
            serde_json::from_value(serde_json::json!({"targetUserId": "", "message": ""})).unwrap();
        assert!(validate_query(&q).is_ok());
    }

    #[test]
    fn missing_either_param_yields_java_error() {
        for json in [
            serde_json::json!({"targetUserId": "true::1"}),
            serde_json::json!({"message": "hi"}),
            serde_json::json!({}),
        ] {
            let q: SocketSendQuery = serde_json::from_value(json).unwrap();
            let err = validate_query(&q).unwrap_err();
            match err {
                crate::Error::Biz { code, msg } => {
                    assert_eq!(code, SERVICE_DATA_ERROR);
                    assert_eq!(msg, PARAM_MISSING_MSG);
                }
                other => panic!("期望 Biz，得到 {other:?}"),
            }
        }
    }
}
