//! 商米云打印回调 域 DTO / VO（logistics::sunmi_print_callback）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。

use serde::Serialize;

/// 商米云打印回调应答体（对应 Java `Map.of("code", 1, "msg", "ok")`）。
///
/// Java `SunmiPrintCallbackController.callback` 直接返回一个
/// `Map<String, Object>`，键顺序为 `code` / `msg`（`Map.of` 不保证顺序，
/// 因此这里只对齐**键与值**，不追求序列化顺序）。
///
/// > 注意：这里的 `code` / `msg` 是**商米平台要求的业务应答**，
/// > 与本项目统一响应信封 `ApiResponse { code, msg, data }` 的同名字段
/// > **不是同一个东西** —— 经 Rust/Java 信封包装后，真实响应体是
/// > `{"code":0,"msg":"success","data":{"code":1,"msg":"ok"}}`，
/// > 内层 `code:1` 表示「商米侧成功、请勿重试」。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SunmiCallbackAck {
    /// 商米约定成功码（Java 恒为 `1`；非 1 会触发商米重试）
    pub code: i32,
    /// 商米约定成功文案（Java 恒为 `"ok"`）
    pub msg: String,
}

impl SunmiCallbackAck {
    /// Java `Map.of("code", 1, "msg", "ok")` 的固定应答。
    #[must_use]
    pub fn ok() -> Self {
        Self {
            code: SUNMI_ACK_CODE,
            msg: SUNMI_ACK_MSG.to_string(),
        }
    }
}

/// 商米回调成功码（Java 字面量 `1`）。
pub const SUNMI_ACK_CODE: i32 = 1;

/// 商米回调成功文案（Java 字面量 `"ok"`）。
pub const SUNMI_ACK_MSG: &str = "ok";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ack_matches_java_map_of_literal() {
        // Java: Map.of("code", 1, "msg", "ok")
        let v = serde_json::to_value(SunmiCallbackAck::ok()).unwrap();
        assert_eq!(v["code"], 1);
        assert_eq!(v["msg"], "ok");
        assert_eq!(v.as_object().map(|m| m.len()), Some(2));
    }
}
