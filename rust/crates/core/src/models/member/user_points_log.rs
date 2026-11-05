//! 会员积分日志 域 DTO / VO（member::user_points_log）。
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`；
//! 时间毫秒 `i64`；可选数值用 `Option<...>`，与 Java VO 的 `null` 语义一致。
//!
//! # 本片为什么几乎没有 DTO / VO
//!
//! 原 Java `UserPointsLogController.getPoints()`（`UserPointsLogController.java:39`）
//! 的签名是裸 `Integer`：
//!
//! ```java
//! @GetMapping("/getPoints")
//! @Operation(summary = "获取会员积分")
//! public Integer getPoints() {return userPointsLogService.getPoints();}
//! ```
//!
//! 既无查询入参（身份取自 JWT / 会话），返回也只是标量，经 `AjaxResult`
//! 包装后为 `{"code":0,"msg":"success","data":<积分整数>,"timestamp":..}`。
//! 因此本片**不定义**任何结构体，`data` 直接用 `i32`
//! （`user.points` 列为 `int unsigned NOT NULL`，见
//! `python tools/schema_parser.py --table user`）。

/// 当前登录管理员没有对应会员记录时的错误文案。
///
/// 原 Java `UserPointsLogServiceImpl#getPoints`（`UserPointsLogServiceImpl.java:59-66`）
/// 对 `userMapper.selectOne(...)` 的返回值**没有判空**，查不到行时
/// `currentUser.getPoints()` 抛 NPE，最终由 `GlobalExceptionHandler`
/// 兜底为 `AjaxResult.error(SERVICE_DATA_ERROR, e.getMessage())`，
/// 而 NPE 的 `getMessage()` 在多数 JVM 下为 `null`，前端拿到的是
/// `{"code":500,"msg":null}` 这种无信息量的响应。
/// Rust 侧改为显式业务错误（与 category / shop_manage 的既有做法一致）。
pub const USER_POINTS_NOT_FOUND_MSG: &str = "当前账号未绑定会员，无法获取积分";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_message_is_not_empty_like_java_npe() {
        assert!(!USER_POINTS_NOT_FOUND_MSG.trim().is_empty());
        // 中文文案，UTF-8 源码不得被转成乱码（本项目历史事故：PowerShell 读写 .rs）
        assert!(USER_POINTS_NOT_FOUND_MSG.chars().any(|c| c > '\u{2e80}'));
    }
}
