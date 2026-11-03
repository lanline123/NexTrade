//! 认证相关 DTO，对应原 Java `dto/authority`、`param/account`。

use serde::{Deserialize, Serialize};
use validator::Validate;

/// 后台登录请求。
#[derive(Debug, Clone, Deserialize, Serialize, Validate)]
pub struct LoginDTO {
    #[validate(length(min = 2, max = 64, message = "用户名长度须在2-64之间"))]
    pub username: String,
    #[validate(length(min = 6, max = 64, message = "密码长度须在6-64之间"))]
    pub password: String,
    /// 滑块验证码校验串（AJ-Captcha）。
    /// 前端登录失败后会带 `verifyToken`（部分页面用 `captchaVerification`）。
    #[serde(rename = "captchaVerification", alias = "verifyToken", default)]
    pub captcha_verification: Option<String>,
}

/// 后台手机验证码登录请求。
#[derive(Debug, Clone, Deserialize, Serialize, Validate)]
pub struct MobileLoginDTO {
    /// 手机号
    #[validate(length(min = 6, max = 32, message = "手机号格式不正确"))]
    pub mobile: String,
    /// 短信验证码
    #[serde(rename = "mobileCode")]
    #[validate(length(min = 4, max = 8, message = "验证码格式不正确"))]
    pub mobile_code: String,
}

/// 登录成功返回。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginVO {
    /// Java 前端读取的令牌字段（原 Java `LoginVO.token`）
    #[serde(rename = "token")]
    pub token: String,
    /// 管理员类型（原 Java `LoginVO.adminType`；C 端登录为空）
    #[serde(rename = "adminType", skip_serializing_if = "Option::is_none", default)]
    pub admin_type: Option<String>,
    /// 访问令牌（JWT）
    #[serde(rename = "accessToken")]
    pub access_token: String,
    /// 刷新令牌
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    /// 令牌类型
    #[serde(rename = "tokenType", default = "bearer")]
    pub token_type: String,
    /// 过期时间（秒）
    #[serde(rename = "expiresIn")]
    pub expires_in: i64,
    /// 管理员ID
    #[serde(rename = "adminId")]
    pub admin_id: i32,
    /// 登录名
    pub username: String,
}

fn bearer() -> String {
    "Bearer".into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_json_field_names() {
        let v = LoginVO {
            token: "t".into(),
            admin_type: Some("admin".into()),
            access_token: "t".into(),
            refresh_token: "r".into(),
            token_type: "Bearer".into(),
            expires_in: 7200,
            admin_id: 1,
            username: "admin".into(),
        };
        let json = serde_json::to_value(&v).unwrap();
        assert!(json.get("accessToken").is_some());
        assert!(json.get("expiresIn").is_some());
    }
}
