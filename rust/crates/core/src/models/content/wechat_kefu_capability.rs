//! 客服消息能力探测（content::wechat_kefu_capability）DTO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.wechat.WechatKefuCapabilityController`
//!   （`@RequestMapping("/adminapi/wechat/keywordRule")` + `GET /capability`，1 个端点）
//! - 服务 `WxKefuCapabilityProbe`（`kfList()` 调微信客服接口，结果缓存 5 分钟）
//!
//! # 端点（1，admin）
//! `GET /adminapi/wechat/keywordRule/capability` → `{ kefuEnabled: boolean }`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **外部探测未迁移**：Java 通过 `wxMpService.getKefuService().kfList()` 探测
//!    客服消息能力（需公众号 AppID/AppSecret/Token/AESKey 配置 + 微信 RPC）。
//!    本实现可**本地判定「公众号未配置」**（Java 此时恒 `enabled=false`），
//!    该分支直接返回 `{kefuEnabled:false}`；配置齐全时返回明确「未迁移」业务
//!    错误（不伪造 true/false）。
//! 2. 本地「已配置」判定依据为 `config` 表四个 bizCode 均非空：
//!    `wechatAppId` / `wechatAppSecret` / `wechatServerToken` / `wechatServerSecret`
//!    （Java `WxMpServiceHolder` 的 `StrUtil.hasBlank` 判定，`is_del=0`）。
//! 3. 业务错误码沿用项目惯例 500（Java 返回正常 200 结果），消息为明确未迁移文案。

use serde::{Deserialize, Serialize};

/// 探测未迁移业务错误。
pub const MSG_PROBE_NOT_MIGRATED: &str =
    "客服消息能力探测依赖微信客服接口（kfList），需要可用的公众号配置与微信 RPC；当前 Rust 侧尚未迁移，无法探测";

/// 公众号配置 bizCode（Java `SettingsEnum`）。
pub const WECHAT_CONFIG_CODES: [&str; 4] = [
    "wechatAppId",
    "wechatAppSecret",
    "wechatServerToken",
    "wechatServerSecret",
];

/// 能力探测 VO（Java `Map<String,Object>{kefuEnabled}`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatKefuCapabilityVO {
    /// 是否具备客服消息能力。
    pub kefu_enabled: bool,
}

impl WechatKefuCapabilityVO {
    /// 公众号未配置时的结果（Java `enabled=false`）。
    #[must_use]
    pub fn disabled() -> Self {
        Self {
            kefu_enabled: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_codes_match_java_settings_enum() {
        assert_eq!(WECHAT_CONFIG_CODES[0], "wechatAppId");
        assert_eq!(WECHAT_CONFIG_CODES[1], "wechatAppSecret");
        assert_eq!(WECHAT_CONFIG_CODES[2], "wechatServerToken");
        assert_eq!(WECHAT_CONFIG_CODES[3], "wechatServerSecret");
        assert_eq!(WECHAT_CONFIG_CODES.len(), 4);
    }

    #[test]
    fn vo_serializes_kefu_enabled_title_case() {
        let vo = WechatKefuCapabilityVO::disabled();
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["kefuEnabled"], false);

        let vo = WechatKefuCapabilityVO { kefu_enabled: true };
        assert_eq!(serde_json::to_value(&vo).unwrap()["kefuEnabled"], true);
    }

    #[test]
    fn not_migrated_message_is_explicit() {
        assert!(MSG_PROBE_NOT_MIGRATED.contains("尚未迁移"));
        assert!(MSG_PROBE_NOT_MIGRATED.contains("kfList"));
    }
}
