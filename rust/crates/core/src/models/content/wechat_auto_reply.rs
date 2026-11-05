//! 公众号自动回复（content::wechat_auto_reply）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.wechat.WechatAutoReplyController`
//!   （`@RequestMapping("/adminapi/wechat/autoReply")`，6 个端点；其中
//!   `loginSuccess` / `loginSuccess/save` 为 **anonymous**）
//! - 服务 `WechatAutoReplyServiceImpl`
//! - 入参/出参 `ReplyPayloadDTO` / `ReplyPayloadVO`
//! - 存储：`config(biz_code, biz_val)`，`biz_val` 为载荷 JSON
//!
//! # 端点（6）
//! `GET /adminapi/wechat/autoReply/{subscribe,default,loginSuccess}`、
//! `POST /adminapi/wechat/autoReply/{subscribe,default,loginSuccess}/save`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **无外部微信 API**：原 Java 这 6 个端点只读写 `config` 表（本域为
//!    「自动回复配置」，不调用微信接口）。因此本实现全量本地校验 + 落库，
//!    不存在需要「未迁移」处理的外部调用。
//! 2. 无配置 / `biz_val` 为空 / JSON 解析失败 → 返回空载荷
//!    `{msgType:1, content:""}`（与 Java `defaultPayloadVO` 一致）。
//! 3. Java `loadByCode` / `upsert` 查 `config` 时**不判 `is_del`**，本实现保持
//!    逐字一致（可能命中软删行，属原实现行为）。
//! 4. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

use serde::{Deserialize, Serialize};

/// 关注后自动回复 bizCode（Java `WechatAutoReplyBizCodes.SUBSCRIBE`）。
pub const BIZ_SUBSCRIBE: &str = "wechatSubscribeReply";
/// 默认兜底自动回复 bizCode（`DEFAULT`）。
pub const BIZ_DEFAULT: &str = "wechatDefaultReply";
/// 扫码登录成功回复 bizCode（`LOGIN_SUCCESS`）。
pub const BIZ_LOGIN_SUCCESS: &str = "wechatLoginSuccessReply";

/// 文本内容最大长度。
pub const MAX_CONTENT_LEN: usize = 600;
/// 图文标题最大长度。
pub const MAX_NEWS_TITLE_LEN: usize = 64;
/// 图文摘要最大长度。
pub const MAX_NEWS_DESC_LEN: usize = 120;
/// URL 字段最大长度。
pub const MAX_URL_LEN: usize = 500;

/// 消息类型：文本（Java `msgType = 1`）。
pub const MSG_TYPE_TEXT: i32 = 1;
/// 消息类型：图文（Java `msgType = 2`）。
pub const MSG_TYPE_NEWS: i32 = 2;

/// Java `validateReplyPayload` 第 1 条。
pub const MSG_MSG_TYPE_REQUIRED: &str = "消息类型不能为空";
/// Java `validateReplyPayload` 第 2 条。
pub const MSG_MSG_TYPE_INVALID: &str = "消息类型仅支持 1=文本、2=图文";
/// Java `validateReplyPayload`（文本为空）。
pub const MSG_CONTENT_REQUIRED: &str = "文本内容不能为空";
/// Java `validateReplyPayload`（文本超长，注意文案中的空格）。
pub const MSG_CONTENT_TOO_LONG: &str = "文本内容长度不能超过 600";
/// Java `validateReplyPayload`（图文标题为空或超长）。
pub const MSG_NEWS_TITLE_INVALID: &str = "图文标题不能为空且长度不能超过 64";
/// Java `validateReplyPayload`（图文摘要为空或超长）。
pub const MSG_NEWS_DESC_INVALID: &str = "图文摘要不能为空且长度不能超过 120";
/// Java `validateReplyPayload`（封面图非法）。
pub const MSG_NEWS_COVER_INVALID: &str =
    "图文封面图 URL 必须为合法的 http/https 链接，且长度不能超过 500";
/// Java `validateReplyPayload`（跳转链接非法）。
pub const MSG_NEWS_URL_INVALID: &str =
    "图文跳转链接必须为合法的 http/https 链接，且长度不能超过 500";

/// 回复内容载荷入参（Java `ReplyPayloadDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ReplyPayloadDTO {
    /// 消息类型：1=文本 2=图文（Java `@NotNull(message = 消息类型不能为空)`）。
    pub msg_type: Option<i32>,
    /// 文本内容（`msgType=1` 时必填，≤600）。
    pub content: Option<String>,
    /// 图文标题（`msgType=2` 时必填，≤64）。
    pub news_title: Option<String>,
    /// 图文封面图 URL（`msgType=2` 时必填）。
    pub news_cover_url: Option<String>,
    /// 图文摘要（`msgType=2` 时必填，≤120）。
    pub news_description: Option<String>,
    /// 图文跳转链接（`msgType=2` 时必填）。
    pub news_url: Option<String>,
}

/// 回复内容载荷 VO（Java `ReplyPayloadVO`，与 DTO 同构）。
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyPayloadVO {
    /// 消息类型。
    pub msg_type: Option<i32>,
    /// 文本内容。
    pub content: Option<String>,
    /// 图文标题。
    pub news_title: Option<String>,
    /// 图文封面图 URL。
    pub news_cover_url: Option<String>,
    /// 图文摘要。
    pub news_description: Option<String>,
    /// 图文跳转链接。
    pub news_url: Option<String>,
}

impl ReplyPayloadVO {
    /// Java `defaultPayloadVO`：`{msgType:1, content:""}`，其余字段 `null`。
    #[must_use]
    pub fn default_payload() -> Self {
        Self {
            msg_type: Some(MSG_TYPE_TEXT),
            content: Some(String::new()),
            ..Default::default()
        }
    }
}

/// 解析存储 JSON（Java `loadByCode`）：
/// 空串 / 解析失败 / JSON `null` → 空载荷；否则按字段反序列化（字段可为 `null`）。
#[must_use]
pub fn parse_payload(raw: Option<&str>) -> ReplyPayloadVO {
    let Some(text) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return ReplyPayloadVO::default_payload();
    };
    match serde_json::from_str::<ReplyPayloadVO>(text) {
        Ok(vo) => vo,
        Err(_) => ReplyPayloadVO::default_payload(),
    }
}

/// 序列化存储 JSON（Java `JSON.toJSONString(dto)`；`null` 字段保留）。
#[must_use]
pub fn to_storage_json(dto: &ReplyPayloadDTO) -> String {
    serde_json::to_string(dto).unwrap_or_else(|_| "{}".to_string())
}

/// 校验回复载荷（Java `validateReplyPayload` 六条规则，文案逐字）。
///
/// # Errors
/// 校验失败 → 对应逐字文案。
pub fn validate_payload(dto: &ReplyPayloadDTO) -> Result<(), String> {
    let Some(msg_type) = dto.msg_type else {
        return Err(MSG_MSG_TYPE_REQUIRED.to_string());
    };
    if msg_type != MSG_TYPE_TEXT && msg_type != MSG_TYPE_NEWS {
        return Err(MSG_MSG_TYPE_INVALID.to_string());
    }
    if msg_type == MSG_TYPE_TEXT {
        let content = dto.content.as_deref().map(str::trim).unwrap_or("");
        if content.is_empty() {
            return Err(MSG_CONTENT_REQUIRED.to_string());
        }
        if content.chars().count() > MAX_CONTENT_LEN {
            return Err(MSG_CONTENT_TOO_LONG.to_string());
        }
        return Ok(());
    }
    // msgType == 2
    let title = dto.news_title.as_deref().map(str::trim).unwrap_or("");
    if title.is_empty() || title.chars().count() > MAX_NEWS_TITLE_LEN {
        return Err(MSG_NEWS_TITLE_INVALID.to_string());
    }
    let desc = dto.news_description.as_deref().map(str::trim).unwrap_or("");
    if desc.is_empty() || desc.chars().count() > MAX_NEWS_DESC_LEN {
        return Err(MSG_NEWS_DESC_INVALID.to_string());
    }
    if !is_valid_http_url(dto.news_cover_url.as_deref()) {
        return Err(MSG_NEWS_COVER_INVALID.to_string());
    }
    if !is_valid_http_url(dto.news_url.as_deref()) {
        return Err(MSG_NEWS_URL_INVALID.to_string());
    }
    Ok(())
}

/// 合法 http(s) URL（Java `isValidHttpUrl`：非空、≤500、前缀 http:// 或 https://）。
#[must_use]
pub fn is_valid_http_url(url: Option<&str>) -> bool {
    let Some(url) = url.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    if url.chars().count() > MAX_URL_LEN {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    // 与 Java `isValidHttpUrl` 等价：前缀 http(s):// 且之后必须有主机部分
    let rest = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"));
    matches!(rest, Some(host) if !host.is_empty() && !host.starts_with('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_payload_validation_matches_java() {
        assert_eq!(
            validate_payload(&ReplyPayloadDTO::default()).unwrap_err(),
            MSG_MSG_TYPE_REQUIRED
        );
        let mut dto = ReplyPayloadDTO {
            msg_type: Some(3),
            ..Default::default()
        };
        assert_eq!(validate_payload(&dto).unwrap_err(), MSG_MSG_TYPE_INVALID);
        dto.msg_type = Some(1);
        assert_eq!(validate_payload(&dto).unwrap_err(), MSG_CONTENT_REQUIRED);
        dto.content = Some("你好".into());
        assert!(validate_payload(&dto).is_ok());
        dto.content = Some("字".repeat(MAX_CONTENT_LEN + 1));
        assert_eq!(validate_payload(&dto).unwrap_err(), MSG_CONTENT_TOO_LONG);
        // 600 字边界通过
        dto.content = Some("字".repeat(MAX_CONTENT_LEN));
        assert!(validate_payload(&dto).is_ok());
    }

    #[test]
    fn news_payload_validation_matches_java() {
        let base = ReplyPayloadDTO {
            msg_type: Some(2),
            ..Default::default()
        };
        assert_eq!(validate_payload(&base).unwrap_err(), MSG_NEWS_TITLE_INVALID);
        let with_title = ReplyPayloadDTO {
            news_title: Some("标题".into()),
            ..base.clone()
        };
        assert_eq!(
            validate_payload(&with_title).unwrap_err(),
            MSG_NEWS_DESC_INVALID
        );
        let with_desc = ReplyPayloadDTO {
            news_description: Some("摘要".into()),
            ..with_title.clone()
        };
        assert_eq!(
            validate_payload(&with_desc).unwrap_err(),
            MSG_NEWS_COVER_INVALID
        );
        let with_cover = ReplyPayloadDTO {
            news_cover_url: Some("https://cdn.example.com/a.png".into()),
            ..with_desc.clone()
        };
        assert_eq!(
            validate_payload(&with_cover).unwrap_err(),
            MSG_NEWS_URL_INVALID
        );
        let full = ReplyPayloadDTO {
            news_url: Some("https://example.com/news".into()),
            ..with_cover
        };
        assert!(validate_payload(&full).is_ok());
    }

    #[test]
    fn url_rules_match_java() {
        assert!(!is_valid_http_url(None));
        assert!(!is_valid_http_url(Some("  ")));
        assert!(!is_valid_http_url(Some("ftp://x")));
        assert!(!is_valid_http_url(Some("http://")));
        assert!(is_valid_http_url(Some("http://a.com")));
        assert!(is_valid_http_url(Some("HTTPS://A.COM/x")));
        let too_long = format!("https://a.com/{}", "x".repeat(MAX_URL_LEN));
        assert!(!is_valid_http_url(Some(&too_long)));
    }

    #[test]
    fn payload_parse_serialize_round_trip() {
        // 无配置 → 空载荷
        assert_eq!(parse_payload(None), ReplyPayloadVO::default_payload());
        assert_eq!(
            parse_payload(Some("   ")),
            ReplyPayloadVO::default_payload()
        );
        assert_eq!(
            parse_payload(Some("not-json")),
            ReplyPayloadVO::default_payload()
        );
        assert_eq!(
            parse_payload(Some("null")),
            ReplyPayloadVO::default_payload()
        );

        let dto = ReplyPayloadDTO {
            msg_type: Some(1),
            content: Some("欢迎关注{shopName}".into()),
            ..Default::default()
        };
        let json = to_storage_json(&dto);
        // Java fastjson 序列化保留 null 字段（与 config 种子数据一致）
        assert!(json.contains("\"newsTitle\":null"));
        let vo = parse_payload(Some(&json));
        assert_eq!(vo.msg_type, Some(1));
        assert_eq!(vo.content.as_deref(), Some("欢迎关注{shopName}"));
        assert_eq!(vo.news_title, None);

        // 空对象解析成功（字段全 null，Java parseObject 同构）
        let vo = parse_payload(Some("{}"));
        assert_eq!(vo.msg_type, None);
        assert_eq!(vo.content, None);
    }

    #[test]
    fn vo_serializes_camel_case_with_nulls() {
        let vo = ReplyPayloadVO::default_payload();
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["msgType"], 1);
        assert_eq!(json["content"], "");
        assert!(json["newsTitle"].is_null());
        assert!(json["newsCoverUrl"].is_null());
        assert!(json["newsDescription"].is_null());
        assert!(json["newsUrl"].is_null());
    }
}
