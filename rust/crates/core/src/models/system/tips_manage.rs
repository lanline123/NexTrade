//! 提示管理域（system::tips_manage）DTO / VO + 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.common.TipsManageController`
//!   （`@RequestMapping("/adminapi/common/tipsManage")`，1 个端点）
//! - `com.tigshop.service.common.impl.TipsManageServiceImpl`
//! - `com.tigshop.bean.vo.common.TipsVO`
//!
//! `list` 的语义（Java 原文）：
//!
//! 1. `pcDomain = configService.getConfigVal(SettingsEnum.PC_DOMAIN)`
//!    （`config` 表 `biz_code = "pcDomain"` 且 `is_del = 0`；**无行返回空串**，
//!    行存在但 `biz_val` 为 NULL 返回 `null`）
//! 2. `domainBindStatus = StrUtil.contains(url, pcDomain)` ——
//!    Hutool `contains(CharSequence, CharSequence)` 在 `searchStr` 为 null 时
//!    返回 false，否则退化为 `String#contains`（**空串恒 true**）
//! 3. `passwordTooSimple = redisCache.getCacheObject("password_too_simple:" + adminId) != null`
//! 4. 返回 `[TipsVO("domainBind", …), TipsVO("passwordTooSimple", …)]`
//!
//! 见 [`domain_bind_status`] / [`password_too_simple_key`]。

use serde::{Deserialize, Serialize};

/// PC 端域名配置项 `biz_code`（Java `SettingsEnum.PC_DOMAIN`）。
pub const CONFIG_PC_DOMAIN: &str = "pcDomain";

/// 「密码过于简单」缓存 key 前缀（Java `Constants.PASSWORD_TOO_SIMPLE`）。
pub const PASSWORD_TOO_SIMPLE_KEY_PREFIX: &str = "password_too_simple:";

/// 域名绑定提示 code（Java `new TipsVO("domainBind", …)`）。
pub const TIP_CODE_DOMAIN_BIND: &str = "domainBind";

/// 密码简单提示 code（Java `new TipsVO("passwordTooSimple", …)`）。
pub const TIP_CODE_PASSWORD_TOO_SIMPLE: &str = "passwordTooSimple";

/// `list` 查询参数（Java `@RequestParam("url") String url`，**必填**）。
///
/// 注意：不添加 `#[serde(default)]`，缺失 `url` 时反序列化失败，
/// axum 直接返回 400 —— 与 Java 缺少必填 `@RequestParam` 的行为等价。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TipsManageQuery {
    /// 当前后台页面地址（Java `url`）
    pub url: String,
}

/// 提示项（Java `TipsVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TipsVO {
    /// 提示编码
    pub code: String,
    /// 提示状态
    pub status: bool,
}

/// 计算「后台域名是否与 PC 域名一致」提示（Java `StrUtil.contains(url, pcDomain)`）。
///
/// 入参是 `config` 查询的**三态**结果（对齐 Java `getConfigVal`）：
/// - `None`：`config` 无匹配行 ⇒ Java 返回空串 ⇒ `url.contains("")` = **true**
/// - `Some(None)`：行存在但 `biz_val` 为 NULL ⇒ Java 传 null ⇒ `contains` = **false**
/// - `Some(Some(domain))`：正常 `url.contains(domain)`
///
/// 注：`url` 在 Java 侧是必填 `@RequestParam`，不会为 null，故无需空值分支。
#[must_use]
pub fn domain_bind_status(url: &str, raw_pc_domain: Option<Option<&str>>) -> bool {
    match raw_pc_domain {
        // Java：getConfigVal 无行 ⇒ ""；`url.contains("")` 恒 true
        None => true,
        // Java：行存在但 bizVal = null ⇒ StrUtil.contains(url, null) = false
        Some(None) => false,
        Some(Some(domain)) => url.contains(domain),
    }
}

/// 「密码过于简单」缓存 key（Java `Constants.PASSWORD_TOO_SIMPLE + adminId`）。
#[must_use]
pub fn password_too_simple_key(admin_id: i32) -> String {
    format!("{PASSWORD_TOO_SIMPLE_KEY_PREFIX}{admin_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 域名提示（对应 StrUtil.contains） ————————————————

    #[test]
    fn domain_bind_matches_hutool_contains_semantics() {
        // 无配置行 ⇒ getConfigVal 空串 ⇒ url.contains("") = true
        assert!(domain_bind_status("https://admin.example.com", None));
        // 行存在但 biz_val = NULL ⇒ contains(url, null) = false
        assert!(!domain_bind_status("https://admin.example.com", Some(None)));
        // 正常包含
        assert!(domain_bind_status(
            "https://admin.example.com/login",
            Some(Some("example.com"))
        ));
        assert!(!domain_bind_status(
            "https://admin.example.com",
            Some(Some("shop.example.com"))
        ));
        // 配置值为空串 ⇒ contains 恒 true（与 Java 一致）
        assert!(domain_bind_status(
            "https://admin.example.com",
            Some(Some(""))
        ));
    }

    // ———————————————— 缓存 key ————————————————

    #[test]
    fn password_too_simple_key_matches_java_constant() {
        assert_eq!(password_too_simple_key(1), "password_too_simple:1");
        assert_eq!(password_too_simple_key(42), "password_too_simple:42");
        assert_eq!(PASSWORD_TOO_SIMPLE_KEY_PREFIX, "password_too_simple:");
    }

    // ———————————————— 入参 / 出参 ————————————————

    #[test]
    fn query_requires_url_parameter() {
        let q: TipsManageQuery =
            serde_json::from_str(r#"{"url":"https://admin.example.com"}"#).unwrap();
        assert_eq!(q.url, "https://admin.example.com");
        // 缺失 url ⇒ 反序列化失败（对应 Java 必填 @RequestParam）
        assert!(serde_json::from_str::<TipsManageQuery>("{}").is_err());
    }

    #[test]
    fn tips_vo_serializes_camel_case() {
        let vo = TipsVO {
            code: TIP_CODE_DOMAIN_BIND.to_string(),
            status: true,
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["code"], "domainBind");
        assert_eq!(v["status"], true);

        let vo = TipsVO {
            code: TIP_CODE_PASSWORD_TOO_SIMPLE.to_string(),
            status: false,
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["code"], "passwordTooSimple");
        assert_eq!(v["status"], false);
    }
}
