//! 装修推广短链域（content::decorate_promote）DTO / 纯函数。
//!
//! 对应 Java `DecorateController#generateShortLink`
//! （`POST /adminapi/decorate/promote/generateShortLink`）。
//!
//! 实现：校验长链接 → 查/建 `short_url`（`short_code` 由长链接+类型确定性生成）
//! → 拼接 h5 域名（config `h5Domain`）返回短链。

use serde::{Deserialize, Serialize};

/// `链接不能为空`
pub const MSG_URL_REQUIRED: &str = "链接不能为空";
/// 配置键：H5 域名（Java `h5Domain`）
pub const CONFIG_H5_DOMAIN: &str = "h5Domain";
/// 默认类型（无类型区分）
pub const DEFAULT_LINK_TYPE: i32 = 0;

/// 生成短链入参（Java `ShortLinkDTO` 兼容字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GenerateShortLinkDTO {
    /// 长链接（`url` 或 `longUrl` 均可）
    pub url: Option<String>,
    pub long_url: Option<String>,
    pub r#type: Option<i32>,
}

impl GenerateShortLinkDTO {
    /// 取生效长链接（`url` 优先，其次 `longUrl`）。
    #[must_use]
    pub fn target_url(&self) -> Option<&str> {
        self.url
            .as_deref()
            .or(self.long_url.as_deref())
            .map(str::trim)
            .filter(|url| !url.is_empty())
    }

    /// 生效类型。
    #[must_use]
    pub fn target_type(&self) -> i32 {
        self.r#type.unwrap_or(DEFAULT_LINK_TYPE)
    }
}

/// 长链接校验。
#[must_use]
pub fn validate_url(url: Option<&str>) -> Result<&str, String> {
    url.filter(|value| !value.trim().is_empty())
        .ok_or_else(|| MSG_URL_REQUIRED.to_string())
}

/// 确定性短码（FNV-1a 32bit + base36，最长 7 位）。
#[must_use]
pub fn short_code_for(url: &str, link_type: i32) -> String {
    let mut hash: u32 = 0x811c_9dc5;
    for byte in url.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(0x0100_0193);
    }
    hash ^= link_type as u32;
    let mut value = u64::from(hash);
    if value == 0 {
        value = 1;
    }
    const ALPHABET: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = Vec::new();
    while value > 0 {
        out.push(ALPHABET[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8_lossy(&out).into_owned()
}

/// 拼接短链（域名为空 → 相对路径）。
#[must_use]
pub fn build_short_link(domain: Option<&str>, code: &str) -> String {
    match domain.map(str::trim).filter(|d| !d.is_empty()) {
        Some(domain) => {
            let domain = domain.trim_end_matches('/');
            format!("{domain}/s/{code}")
        }
        None => format!("/s/{code}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_validation_and_target_selection() {
        assert_eq!(validate_url(None).unwrap_err(), MSG_URL_REQUIRED);
        assert_eq!(validate_url(Some("  ")).unwrap_err(), MSG_URL_REQUIRED);
        let dto = GenerateShortLinkDTO {
            long_url: Some(" https://a.com/x ".into()),
            ..Default::default()
        };
        assert_eq!(dto.target_url(), Some("https://a.com/x"));
        let dto = GenerateShortLinkDTO {
            url: Some("https://b.com".into()),
            long_url: Some("https://c.com".into()),
            r#type: Some(2),
        };
        assert_eq!(dto.target_url(), Some("https://b.com"));
        assert_eq!(dto.target_type(), 2);
    }

    #[test]
    fn short_code_is_deterministic_and_type_aware() {
        let a = short_code_for("https://a.com/x", 0);
        let b = short_code_for("https://a.com/x", 0);
        let c = short_code_for("https://a.com/x", 1);
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert!(!a.is_empty() && a.len() <= 7);
        assert_eq!(
            build_short_link(Some("https://h5.x.com/"), "abc"),
            "https://h5.x.com/s/abc"
        );
        assert_eq!(build_short_link(None, "abc"), "/s/abc");
    }

    #[test]
    fn dto_accepts_java_names() {
        let dto: GenerateShortLinkDTO =
            serde_json::from_str(r#"{"longUrl":"https://x.com","type":1}"#).unwrap();
        assert_eq!(dto.target_url(), Some("https://x.com"));
        assert_eq!(dto.target_type(), 1);
    }
}
