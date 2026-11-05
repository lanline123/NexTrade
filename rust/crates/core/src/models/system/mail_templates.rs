//! 邮箱模板管理（system::mail_templates）DTO / VO / 枚举。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.setting.MailTemplatesDTO`
//! - `com.tigshop.bean.vo.setting.MailTemplatesVO`
//! - `com.tigshop.bean.enums.setting.MailTemplateType`
//! - `com.tigshop.common.constant.setting.MailTemplatesConstants`
//!
//! 实体（表 `mail_templates`）由代码生成器产出，见
//! [`crate::entities::setting::MailTemplates`]；
//! 列定义核对命令：`python tools/schema_parser.py --table mail_templates`。
//!
//! JSON 字段名一律保持 camelCase（`#[serde(rename_all = "camelCase")]`），
//! 与原前端契约逐字符一致。
//!
//! ## 金额
//!
//! 本域（邮件模板配置）**不涉及任何金额列**，`mail_templates` 的 8 列
//! 全是整型与字符串，因此没有 `rust_decimal::Decimal` 出场。

use serde::{Deserialize, Serialize};

use crate::entities::setting::MailTemplates;

// ——————————————————————————————————————————————
// 常量（对应 Java MailTemplatesConstants，逐字符照抄）
// ——————————————————————————————————————————————

/// Java `MailTemplatesConstants.TEMPLATE_ID_NOT_NULL`。
pub const MSG_TEMPLATE_ID_NOT_NULL: &str = "邮件模板自增id不能为空";

/// Java `MailTemplatesConstants.TEMPLATE_SUBJECT_NOT_NULL`。
pub const MSG_TEMPLATE_SUBJECT_NOT_NULL: &str = "该邮件模板的邮件主题不能为空";

/// Java `MailTemplatesConstants.TEMPLATE_SUBJECT_MAX_LENGTH`。
pub const MSG_TEMPLATE_SUBJECT_MAX_LENGTH: &str = "邮件的主题最多100个字符";

/// Java `MailTemplatesConstants.TEMPLATE_CONTENT_NOT_NULL`。
pub const MSG_TEMPLATE_CONTENT_NOT_NULL: &str = "邮件模板的内容不能为空";

/// `templateSubject` 的长度上限。
///
/// ⚠️ 取自 Java `MailTemplatesDTO` 的 `@Size(max = 100)`。
/// 注意库列 `template_subject` 实际是 `varchar(200)`（见 schema），
/// 即 Java 的业务校验比物理列更严 —— 本实现照抄 **100**。
pub const TEMPLATE_SUBJECT_MAX_LEN: usize = 100;

// ——————————————————————————————————————————————
// 邮件模板类型枚举（Java MailTemplateType）
// ——————————————————————————————————————————————

/// 邮件模板类型（Java `MailTemplateType`）。
///
/// Java 枚举携带 `code` + `description` 两个字段，`fromCode` 用 `code`
/// 匹配后返回 **description**（不是枚举名）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MailTemplateType {
    /// `send_password`
    SendPassword,
    /// `order_confirm`
    OrderConfirm,
    /// `deliver_notice`
    DeliverNotice,
    /// `order_cancel`
    OrderCancel,
    /// `order_invalid`
    OrderInvalid,
    /// `send_bonus`
    SendBonus,
    /// `group_buy`
    GroupBuy,
    /// `register_validate`
    RegisterValidate,
    /// `virtual_card`
    VirtualCard,
    /// `attention_list`
    AttentionList,
    /// `remind_of_new_order`
    RemindOfNewOrder,
    /// `goods_booking`
    GoodsBooking,
    /// `user_message`
    UserMessage,
    /// `recomment`
    Recomment,
    /// `order_pay_email`
    OrderPayEmail,
    /// `register_code`
    RegisterCode,
}

impl MailTemplateType {
    /// 全部枚举值，顺序与 Java `MailTemplateType.values()` 完全一致。
    pub const ALL: [Self; 16] = [
        Self::SendPassword,
        Self::OrderConfirm,
        Self::DeliverNotice,
        Self::OrderCancel,
        Self::OrderInvalid,
        Self::SendBonus,
        Self::GroupBuy,
        Self::RegisterValidate,
        Self::VirtualCard,
        Self::AttentionList,
        Self::RemindOfNewOrder,
        Self::GoodsBooking,
        Self::UserMessage,
        Self::Recomment,
        Self::OrderPayEmail,
        Self::RegisterCode,
    ];

    /// `code`（`mail_templates.template_code`）。
    #[must_use]
    pub const fn code(self) -> &'static str {
        match self {
            Self::SendPassword => "send_password",
            Self::OrderConfirm => "order_confirm",
            Self::DeliverNotice => "deliver_notice",
            Self::OrderCancel => "order_cancel",
            Self::OrderInvalid => "order_invalid",
            Self::SendBonus => "send_bonus",
            Self::GroupBuy => "group_buy",
            Self::RegisterValidate => "register_validate",
            Self::VirtualCard => "virtual_card",
            Self::AttentionList => "attention_list",
            Self::RemindOfNewOrder => "remind_of_new_order",
            Self::GoodsBooking => "goods_booking",
            Self::UserMessage => "user_message",
            Self::Recomment => "recomment",
            Self::OrderPayEmail => "order_pay_email",
            Self::RegisterCode => "register_code",
        }
    }

    /// `description`（Java `MailTemplateType` 的第二构造参数，
    /// **含** `[code]` 后缀，逐字符照抄）。
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::SendPassword => "发送密码模板 [send_password]",
            Self::OrderConfirm => "订单确认模板 [order_confirm]",
            Self::DeliverNotice => "发货通知模板 [deliver_notice]",
            Self::OrderCancel => "订单取消模板 [order_cancel]",
            Self::OrderInvalid => "订单无效模板 [order_invalid]",
            Self::SendBonus => "发送红包模板 [send_bonus]",
            Self::GroupBuy => "团购商品模板 [group_buy]",
            Self::RegisterValidate => "邮件验证模板 [register_validate]",
            Self::VirtualCard => "虚拟卡片模板 [virtual_card]",
            Self::AttentionList => "关注管理 [attention_list]",
            Self::RemindOfNewOrder => "新订单提醒模板 [remind_of_new_order]",
            Self::GoodsBooking => "缺货回复模板 [goods_booking]",
            Self::UserMessage => "留言回复模板 [user_message]",
            Self::Recomment => "用户评论回复模板 [recomment]",
            Self::OrderPayEmail => "订单付款通知 [order_pay_email]",
            Self::RegisterCode => "登录注册验证码 [register_code]",
        }
    }

    /// 按 `code` 查枚举（Java `MailTemplateType.fromCode` 的匹配部分）。
    ///
    /// Java 的 `type.getCode().equals(code)` 对 `code == null` 返回 false
    /// （不会抛异常），本实现以 `&str` 入参，语义等价。
    #[must_use]
    pub fn from_code(code: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|t| t.code() == code)
    }
}

/// Java `MailTemplateType.fromCode(String)`：命中返回 `description`，
/// 未命中返回 `null`（Rust 侧为 `None`）。
///
/// 对应 Java `MailTemplatesServiceImpl#mailTemplatesList` 里
/// `vo.setTemplateName(MailTemplateType.fromCode(item.getTemplateCode()))`。
#[must_use]
pub fn template_name_of(code: &str) -> Option<&'static str> {
    MailTemplateType::from_code(code).map(MailTemplateType::description)
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 邮箱模板 VO（对应 Java
/// `com.tigshop.bean.vo.setting.MailTemplatesVO`）。
///
/// ⚠️ **`lastModify` / `lastSend` 恒为 `null`**：
/// Java 里 `MailTemplates.lastModify` 是 `Long`，而 VO 里是 `Integer`，
/// `BeanUtils.copyProperties` 内部用
/// `ClassUtils.isAssignable(Integer.class, Long.class)` 判定 —— 为 `false`，
/// 于是**静默跳过**这两个属性（不报错、不转换），VO 保持 `null`。
///
/// 本实现逐字符复刻该可观测行为（字段保留、输出 `null`），
/// 以免与线上 JSON 不一致；见 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MailTemplatesVO {
    /// 邮件模板自增id
    pub template_id: i32,
    /// 模板字符串名称（`template_code`，插件语言包匹配用）
    pub template_code: String,
    /// 邮件是否是html格式；0，否；1，是
    pub is_html: i32,
    /// 该邮件模板的邮件主题
    pub template_subject: String,
    /// 邮件模板的内容
    pub template_content: String,
    /// 最后一次修改模板的时间（Java 侧恒 `null`，见类型级说明）
    pub last_modify: Option<i32>,
    /// 最近一次发送的时间（Java 侧恒 `null`，见类型级说明）
    pub last_send: Option<i32>,
    /// 该邮件模板的邮件类型（`mail_templates.type`）
    pub r#type: String,
    /// 邮件模板名称（由 `template_code` 映射，未命中为 `null`）
    pub template_name: Option<String>,
}

impl From<&MailTemplates> for MailTemplatesVO {
    fn from(m: &MailTemplates) -> Self {
        Self {
            template_id: m.template_id,
            template_code: m.template_code.clone(),
            is_html: m.is_html,
            template_subject: m.template_subject.clone(),
            template_content: m.template_content.clone(),
            // 见类型级说明：Java 因 Long→Integer 类型不匹配而跳过拷贝 ⇒ null
            last_modify: None,
            last_send: None,
            r#type: m.r#type.clone(),
            template_name: template_name_of(&m.template_code).map(str::to_string),
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 更新邮件模板请求（对应 Java
/// `com.tigshop.bean.dto.setting.MailTemplatesDTO`）。
///
/// 字段类型全部为 `Option`，以便把「缺键」与「值非法」都收敛到
/// 服务层的业务文案（Java 侧 `@NotNull` / `@NotBlank` /
/// `@Size(max = 100)` 的 message 分别见 [`MSG_TEMPLATE_ID_NOT_NULL`]、
/// [`MSG_TEMPLATE_SUBJECT_NOT_NULL`]、[`MSG_TEMPLATE_SUBJECT_MAX_LENGTH`]、
/// [`MSG_TEMPLATE_CONTENT_NOT_NULL`]）。
///
/// ⚠️ `isHtml` 无任何校验注解（Java 侧就是个 `Short`，可为 null）；
/// 为 `None` 时对应 MyBatis-Plus `FieldStrategy.NOT_NULL` 的「不写该列」。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MailTemplatesDTO {
    /// 邮件模板自增id（Java `@NotNull`）
    pub template_id: Option<i32>,
    /// 邮件是否是html格式；0，否；1，是（无校验注解）
    pub is_html: Option<i32>,
    /// 该邮件模板的邮件主题（Java `@NotBlank` + `@Size(max = 100)`）
    pub template_subject: Option<String>,
    /// 邮件模板的内容（Java `@NotBlank`）
    pub template_content: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_name_lookup_matches_java_enum() {
        // 命中：返回 description（含 [code]）
        assert_eq!(
            template_name_of("send_password"),
            Some("发送密码模板 [send_password]")
        );
        assert_eq!(
            template_name_of("register_code"),
            Some("登录注册验证码 [register_code]")
        );
        // 未命中：Java 返回 null
        assert_eq!(template_name_of("not_exists"), None);
        assert_eq!(template_name_of(""), None);
    }

    #[test]
    fn all_codes_are_unique_and_self_consistent() {
        let mut codes: Vec<&str> = MailTemplateType::ALL.iter().map(|t| t.code()).collect();
        let before = codes.len();
        codes.sort_unstable();
        codes.dedup();
        assert_eq!(before, codes.len(), "枚举 code 必须唯一");
        assert_eq!(before, 16, "Java 枚举共 16 项");

        // description 必须包含自身 code（Java 文案形如 "xxx [code]"）
        for t in MailTemplateType::ALL {
            assert!(
                t.description().contains(t.code()),
                "description 未包含 code: {} / {}",
                t.code(),
                t.description()
            );
            assert_eq!(MailTemplateType::from_code(t.code()), Some(t));
        }
    }

    #[test]
    fn vo_from_entity_keeps_java_null_semantics() {
        let row = MailTemplates {
            template_id: 7,
            template_code: "order_confirm".into(),
            is_html: 1,
            template_subject: "订单确认".into(),
            template_content: "<p>hi</p>".into(),
            last_modify: 1_700_000_000,
            last_send: 1_700_000_001,
            r#type: "template".into(),
        };
        let vo = MailTemplatesVO::from(&row);
        assert_eq!(vo.template_id, 7);
        assert_eq!(
            vo.template_name.as_deref(),
            Some("订单确认模板 [order_confirm]")
        );
        // Java BeanUtils 因 Long→Integer 不可赋值而跳过 ⇒ 恒 null
        assert_eq!(vo.last_modify, None);
        assert_eq!(vo.last_send, None);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let row = MailTemplates {
            template_id: 3,
            template_code: "unknown_code".into(),
            is_html: 0,
            template_subject: "s".into(),
            template_content: "c".into(),
            last_modify: 1,
            last_send: 2,
            r#type: "magazine".into(),
        };
        let v = serde_json::to_value(MailTemplatesVO::from(&row)).unwrap();
        assert_eq!(v["templateId"], 3);
        assert_eq!(v["templateCode"], "unknown_code");
        assert_eq!(v["isHtml"], 0);
        assert_eq!(v["type"], "magazine");
        assert!(v["lastModify"].is_null());
        assert!(v["lastSend"].is_null());
        // 未命中 code ⇒ templateName 为 null
        assert!(v["templateName"].is_null());
    }

    #[test]
    fn dto_parses_camel_case_and_tolerates_missing_keys() {
        let d: MailTemplatesDTO = serde_json::from_str(
            r#"{"templateId":5,"isHtml":1,"templateSubject":"主题","templateContent":"正文"}"#,
        )
        .unwrap();
        assert_eq!(d.template_id, Some(5));
        assert_eq!(d.is_html, Some(1));

        let empty: MailTemplatesDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(empty.template_id, None);
        assert_eq!(empty.template_subject, None);
    }
}
