//! 消息分类（`MessageTypeController`）域 DTO / VO（system::message_type）。
//!
//! 对应原 Java（`tigshop-bean`）：
//! - `com.tigshop.bean.dto.setting.MessageTypeListDTO`（列表查询，继承 `BasePage`）
//! - `com.tigshop.bean.dto.setting.MessageTypeDetailDTO`（详情 / 更新入参）
//! - `com.tigshop.bean.dto.setting.MessageTemplateDTO`（模板消息）
//! - `com.tigshop.bean.vo.setting.MessageTypeListVO`（列表出参）
//! - `com.tigshop.bean.dto.common.UpdateFieldDTO`（单字段更新，复用
//!   [`crate::models::catalog::category_all::UpdateFieldDTO`]）
//! - `com.tigshop.bean.enums.setting.MessageTypeEnum`（模板类型枚举，
//!   见 [`MessageTemplateKind`]）
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；本域无金额字段。
//! `addTime` 在 VO / DTO 里都是 **`yyyy-MM-dd HH:mm:ss` 字符串**
//! （Java `DateUtil.format(date, DATE_FORMAT)`，`Constants.DATE_FORMAT`），
//! 而不是时间戳。

use serde::{Deserialize, Serialize};

// ————————————————————— 模板类型枚举 —————————————————————

/// 模板消息类型枚举，对应 Java `MessageTypeEnum`。
///
/// `code` 是落库值（`message_template.type`），`key` 是 Java 侧
/// `MessageTypeEnum.getKey()`，也是 `MessageTypeDetailDTO.templateMessage`
/// 这个 `Map<String, MessageTemplateDTO>` 的**键**。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageTemplateKind {
    /// 微信模板消息（`type = 1`，key `wechatData`）
    Wechat,
    /// 小程序订阅消息（`type = 2`，key `miniProgramData`）
    MiniProgram,
    /// 短信（`type = 3`，key `msgData`）
    Msg,
    /// 站内信（`type = 4`，key `messageData`）
    Message,
    /// APP（`type = 5`，key `appData`）
    App,
    /// 钉钉（`type = 6`，key `dingData`）
    Ding,
    /// 邮件（`type = 7`，key `emailData`）
    Email,
    /// 企业微信（`type = 8`，key `wxWorkData`）
    WxWork,
}

impl MessageTemplateKind {
    /// 全部枚举值，顺序与 Java `MessageTypeEnum` 声明一致。
    pub const ALL: [Self; 8] = [
        Self::Wechat,
        Self::MiniProgram,
        Self::Msg,
        Self::Message,
        Self::App,
        Self::Ding,
        Self::Email,
        Self::WxWork,
    ];

    /// `message_template.type` 落库值，对应 `MessageTypeEnum.getCode()`。
    #[must_use]
    pub fn code(self) -> i32 {
        match self {
            Self::Wechat => 1,
            Self::MiniProgram => 2,
            Self::Msg => 3,
            Self::Message => 4,
            Self::App => 5,
            Self::Ding => 6,
            Self::Email => 7,
            Self::WxWork => 8,
        }
    }

    /// `templateMessage` map 的键，对应 `MessageTypeEnum.getKey()`。
    #[must_use]
    pub fn key(self) -> &'static str {
        match self {
            Self::Wechat => "wechatData",
            Self::MiniProgram => "miniProgramData",
            Self::Msg => "msgData",
            Self::Message => "messageData",
            Self::App => "appData",
            Self::Ding => "dingData",
            Self::Email => "emailData",
            Self::WxWork => "wxWorkData",
        }
    }

    /// 按 `message_template.type` 落库值查枚举，对应 `MessageTypeEnum.valueToEnum`。
    #[must_use]
    pub fn from_code(code: i32) -> Option<Self> {
        Self::ALL.into_iter().find(|k| k.code() == code)
    }

    /// 按 map 键查枚举，对应 `MessageTypeEnum.fromCode(String key)`。
    /// 匹配不到返回 `None`（Java 同样返回 `null`）。
    #[must_use]
    pub fn from_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|k| k.key() == key)
    }
}

// ————————————————————— 列表查询 —————————————————————

/// 消息分类列表查询参数，对应 Java `MessageTypeListDTO extends BasePage`。
///
/// Java 只声明了 `sendType` 一个业务字段，`keyword` / 分页 / 排序来自 `BasePage`。
///
/// 注意 `BasePage.getSize()` 缺省 **15**、上限 **100**（不是全局的 20）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MessageTypeListQuery {
    /// 发送类型 1会员 2商家；`None` 表示不过滤（Java `sendType != null`）。
    pub send_type: Option<i32>,
    /// 关键词，匹配 `message_type.name`（Java `like(MessageType::getName, keyword)`）。
    pub keyword: Option<String>,
    /// 页码，从 1 开始。
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）。
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（驼峰属性名或数据库列名）。
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序，对应 `buildSortOrder`）。
    pub sort_order: Option<String>,
}

// ————————————————————— 列表出参 —————————————————————

/// 消息分类列表 VO，对应 Java `MessageTypeListVO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageTypeListVO {
    /// 消息ID（`message_type.message_id`）
    #[serde(default)]
    pub message_id: i32,
    /// 通知类型
    #[serde(default)]
    pub name: Option<String>,
    /// 通知描述
    #[serde(default)]
    pub describe: Option<String>,
    /// 发送类型 1会员 2商家
    #[serde(default)]
    pub send_type: Option<i32>,
    /// 是否支持微信公众号（`-1` 表示不支持）
    #[serde(default)]
    pub is_wechat: Option<i32>,
    /// 是否支持小程序
    #[serde(default)]
    pub is_mini_program: Option<i32>,
    /// 是否支持站内信
    #[serde(default)]
    pub is_message: Option<i32>,
    /// 是否支持短信
    #[serde(default)]
    pub is_msg: Option<i32>,
    /// 是否支持 app
    #[serde(default)]
    pub is_app: Option<i32>,
    /// 是否支持钉钉
    #[serde(default)]
    pub is_ding: Option<i32>,
    /// 是否支持邮件
    #[serde(default)]
    pub is_mail: Option<i32>,
    /// 是否支持企业微信
    #[serde(default)]
    pub is_wx_work: Option<i32>,
    /// 添加时间，`yyyy-MM-dd HH:mm:ss` 字符串（Java `DATE_FORMAT`）
    #[serde(default)]
    pub add_time: Option<String>,
}

// ————————————————————— 模板消息 —————————————————————

/// 模板消息，对应 Java `MessageTemplateDTO`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageTemplateDTO {
    /// `message_template.id`
    #[serde(default)]
    pub id: Option<i32>,
    /// 消息类型ID
    #[serde(default)]
    pub message_id: Option<i32>,
    /// 消息类型 1模板消息 2订阅消息 3短信 4站内信 5app 6钉钉 7邮件 8企业微信
    #[serde(default)]
    pub r#type: Option<i32>,
    /// 通知内容
    ///
    /// 注意：Java `detail` 对「短信 / 站内信」两类会按当前短信服务商
    /// 转换占位符（`SmsPlaceholderConverter.convert`），见
    /// [`crate::models::system::message_type::MessageTemplateKind`] 说明。
    #[serde(default)]
    pub content: Option<String>,
    /// 海外短信明文文案（仅阿里云海外通道使用）
    #[serde(default)]
    pub content_oversea: Option<String>,
    /// 发送对象（暂只用于钉钉）
    #[serde(default)]
    pub to_userid: Option<String>,
    /// 模板ID
    #[serde(default)]
    pub template_id: Option<String>,
    /// 模板编号
    #[serde(default)]
    pub template_num: Option<String>,
    /// 模板名称
    #[serde(default)]
    pub template_name: Option<String>,
}

// ————————————————————— 详情 / 更新入参 —————————————————————

/// 消息分类详情 / 更新入参，对应 Java `MessageTypeDetailDTO`。
///
/// `detail` 返回它，`update` 也用它作为请求体。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MessageTypeDetailDTO {
    /// 消息ID
    pub message_id: Option<i32>,
    /// 通知类型
    pub name: Option<String>,
    /// 通知描述
    pub describe: Option<String>,
    /// 发送类型 1会员 2商家
    pub send_type: Option<i32>,
    /// 是否支持微信公众号
    pub is_wechat: Option<i32>,
    /// 是否支持小程序
    pub is_mini_program: Option<i32>,
    /// 是否支持站内信
    pub is_message: Option<i32>,
    /// 是否支持短信
    pub is_msg: Option<i32>,
    /// 是否支持 app
    pub is_app: Option<i32>,
    /// 是否支持钉钉
    pub is_ding: Option<i32>,
    /// 添加时间（`detail` 出参为 `yyyy-MM-dd HH:mm:ss` 字符串）
    pub add_time: Option<String>,
    /// 是否支持邮件
    pub is_mail: Option<i32>,
    /// 是否支持企业微信
    pub is_wx_work: Option<i32>,
    /// 当前短信服务商；1-阿里云，2-腾讯云，3-华为云，4-火山引擎（**仅 `detail` 出参**）
    pub sms_provider: Option<i32>,
    /// 阿里云短信通道开关（`1`=+86国内、`2`=其他海外、`1,2`=两者）；**仅 `detail` 出参**
    pub sms_aliyun_channel: Option<String>,
    /// 模板消息，键为 [`MessageTemplateKind::key`]
    pub template_message: std::collections::HashMap<String, MessageTemplateDTO>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_kind_codes_match_java_enum() {
        // Java MessageTypeEnum：WECHAT(1) MIN_PROGRAM(2) MSG(3) MESSAGE(4)
        // APP(5) DING(6) EMAIL(7) WXWORK(8)
        assert_eq!(MessageTemplateKind::Wechat.code(), 1);
        assert_eq!(MessageTemplateKind::MiniProgram.code(), 2);
        assert_eq!(MessageTemplateKind::Msg.code(), 3);
        assert_eq!(MessageTemplateKind::Message.code(), 4);
        assert_eq!(MessageTemplateKind::App.code(), 5);
        assert_eq!(MessageTemplateKind::Ding.code(), 6);
        assert_eq!(MessageTemplateKind::Email.code(), 7);
        assert_eq!(MessageTemplateKind::WxWork.code(), 8);
    }

    #[test]
    fn template_kind_keys_match_java_enum() {
        assert_eq!(MessageTemplateKind::Wechat.key(), "wechatData");
        assert_eq!(MessageTemplateKind::MiniProgram.key(), "miniProgramData");
        assert_eq!(MessageTemplateKind::Msg.key(), "msgData");
        assert_eq!(MessageTemplateKind::Message.key(), "messageData");
        assert_eq!(MessageTemplateKind::App.key(), "appData");
        assert_eq!(MessageTemplateKind::Ding.key(), "dingData");
        assert_eq!(MessageTemplateKind::Email.key(), "emailData");
        assert_eq!(MessageTemplateKind::WxWork.key(), "wxWorkData");
    }

    #[test]
    fn template_kind_round_trips() {
        for k in MessageTemplateKind::ALL {
            assert_eq!(MessageTemplateKind::from_code(k.code()), Some(k));
            assert_eq!(MessageTemplateKind::from_key(k.key()), Some(k));
        }
        assert_eq!(MessageTemplateKind::from_code(0), None);
        assert_eq!(MessageTemplateKind::from_code(99), None);
        assert_eq!(MessageTemplateKind::from_key("nope"), None);
    }

    #[test]
    fn list_query_accepts_camel_case_and_size_alias() {
        let q: MessageTypeListQuery =
            serde_json::from_str(r#"{"sendType":2,"keyword":"订单","page":2,"size":30}"#).unwrap();
        assert_eq!(q.send_type, Some(2));
        assert_eq!(q.keyword.as_deref(), Some("订单"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
    }

    #[test]
    fn list_query_defaults_when_body_empty() {
        let q: MessageTypeListQuery = serde_json::from_str("{}").unwrap();
        assert!(q.send_type.is_none());
        assert!(q.page.is_none());
        assert!(q.page_size.is_none());
    }

    #[test]
    fn list_vo_serializes_camel_case() {
        let vo = MessageTypeListVO {
            message_id: 2,
            name: Some("用户支付成功通知".into()),
            is_mail: Some(1),
            add_time: Some("1970-01-01 08:00:00".into()),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["messageId"], 2);
        assert_eq!(json["isMail"], 1);
        assert_eq!(json["addTime"], "1970-01-01 08:00:00");
        assert!(json.get("is_mini_program").is_none());
    }
}
