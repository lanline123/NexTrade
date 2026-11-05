//! IM 配置域 DTO / VO（im::im_config）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.im.ConfigDataDTO`（IM 配置内容，落库为 `im_config.data` 的 JSON）
//! - `com.tigshop.bean.dto.im.ConfigCreateDTO`（保存入参）
//!
//! 字段命名严格对齐 Java Jackson 的默认输出（**camelCase**，无
//! `@JsonProperty` 覆盖）：
//! - `ConfigDataDTO`：`activate` / `sendText` / `sendWechat` / `wechatImage` /
//!   `replyContent`
//! - `ConfigCreateDTO`：`code` / `data` / `shopId`
//!
//! 反序列化口径对齐 `com.tigshop.common.utils.JsonUtil`（`ObjectMapper`
//! 显式 `FAIL_ON_UNKNOWN_PROPERTIES = false`）：未知字段忽略、缺失字段回落
//! Java 默认值（`boolean` → `false`，对象 → `null`）。

use serde::{Deserialize, Serialize};

/// IM 配置内容（Java `ConfigDataDTO`）。
///
/// 该结构既作为 `im_config.data` 的 JSON 落库形态，也作为 `/detail` 的返回体。
/// **注意**：Java 的 `boolean` 字段是原生类型（`private boolean activate;`），
/// 因此字段缺失 / 为 `null` 时一律解析为 `false`，本结构保持一致。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ConfigDataDTO {
    /// 激活状态
    pub activate: bool,
    /// 发送文本
    pub send_text: bool,
    /// 发送微信
    pub send_wechat: bool,
    /// 微信图片
    pub wechat_image: Option<String>,
    /// 回复内容
    pub reply_content: Option<String>,
}

impl ConfigDataDTO {
    /// 序列化为 `im_config.data` 的 JSON 文本。
    ///
    /// Java 侧走 `JsonUtil.toJson`（`ObjectMapper` + `INDENT_OUTPUT`，即**美化
    /// 输出**）；此处产出**紧凑 JSON**，与 Java 仅在空白字符上有差异，语义等价
    /// （前端按 JSON 解析，不做字符串比对）。
    ///
    /// # Errors
    /// 仅在序列化器异常时返回 `crate::Error::Internal`；
    /// 本结构为纯数据对象，正常不会失败。
    pub fn to_json_string(&self) -> crate::Result<String> {
        serde_json::to_string(self)
            .map_err(|e| crate::Error::Internal(format!("IM 配置序列化失败: {e}")))
    }

    /// 从 `im_config.data` 的 JSON 文本解析（Java `JsonUtil.fromJson`）。
    ///
    /// 与 Java 完全一致：`data` 为 `null` / 空串 / 首尾仅空白 / 非法 JSON 时
    /// 一律返回 `None`（Java 返回 `null`），**不抛错**。
    #[must_use]
    pub fn from_json_str(raw: Option<&str>) -> Option<Self> {
        let trimmed = raw?.trim();
        if trimmed.is_empty() {
            return None;
        }
        serde_json::from_str(trimmed).ok()
    }
}

/// IM 配置保存入参（Java `ConfigCreateDTO`）。
///
/// Java 侧 `@NotBlank` 校验 `code`；`shopId` 由控制器用
/// `HeaderUtils.getShopId()` 覆盖（请求体里的 `shopId` 会被忽略）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ConfigCreateDTO {
    /// 配置名称（Java `@NotBlank`）
    pub code: String,
    /// 配置信息 [json]
    pub data: Option<ConfigDataDTO>,
    /// 店铺 id（Java 侧由控制器按请求头覆盖，客户端传值无效）
    pub shop_id: Option<i32>,
}

/// IM 配置读取范围（替代 Java `HeaderUtils.getShopId()` 的三态返回值）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImConfigScope {
    /// Java `getShopId() == null`：不做 `shop_id` 过滤（取任意店铺的首条。
    /// Java `LambdaQueryWrapper` 未加条件，`getOne` 在命中多行时会抛异常，
    /// 此处取首条以保持可用性，差异见 `uncertain_points`）。
    Unscoped,
    /// Java `getShopId() != null`：按 `shop_id = ?` 过滤（平台账号为 `0`）。
    Shop(i32),
}

impl ImConfigScope {
    /// 参与 `shop_id = ?` 过滤的值；`Unscoped` 时为 `None`。
    #[must_use]
    pub fn shop_id(self) -> Option<i32> {
        match self {
            Self::Unscoped => None,
            Self::Shop(id) => Some(id),
        }
    }

    /// 由「可能缺失的 shopId」构造（Java `getShopId()` → `Integer`）。
    #[must_use]
    pub fn from_optional(shop_id: Option<i32>) -> Self {
        match shop_id {
            Some(id) => Self::Shop(id),
            None => Self::Unscoped,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_serializes_with_java_camel_case_keys() {
        let dto = ConfigDataDTO {
            activate: true,
            send_text: true,
            send_wechat: false,
            wechat_image: Some("https://cdn.example.com/a.png".into()),
            reply_content: Some("您好".into()),
        };
        let json = dto.to_json_string().unwrap();
        assert_eq!(
            json,
            r#"{"activate":true,"sendText":true,"sendWechat":false,"wechatImage":"https://cdn.example.com/a.png","replyContent":"您好"}"#
        );
    }

    #[test]
    fn data_deserializes_ignoring_unknown_fields_and_missing_bools() {
        // JsonUtil 显式关闭 FAIL_ON_UNKNOWN_PROPERTIES
        let parsed: ConfigDataDTO = serde_json::from_str(
            r#"{"activate":true,"unknownField":1,"sendText":true,"data":{"a":1}}"#,
        )
        .unwrap();
        assert_eq!(
            parsed,
            ConfigDataDTO {
                activate: true,
                send_text: true,
                send_wechat: false,
                wechat_image: None,
                reply_content: None,
            }
        );
    }

    #[test]
    fn from_json_str_matches_json_util_null_semantics() {
        assert_eq!(ConfigDataDTO::from_json_str(None), None);
        assert_eq!(ConfigDataDTO::from_json_str(Some("")), None);
        assert_eq!(ConfigDataDTO::from_json_str(Some("   ")), None);
        assert_eq!(ConfigDataDTO::from_json_str(Some("not json")), None);
        assert!(
            ConfigDataDTO::from_json_str(Some(" {\"activate\":true} ")).is_some_and(|d| d.activate)
        );
    }

    #[test]
    fn create_dto_reads_camel_case_shop_id() {
        let parsed: ConfigCreateDTO =
            serde_json::from_str(r#"{"code":"kefu","data":{"activate":true},"shopId":3}"#).unwrap();
        assert_eq!(parsed.code, "kefu");
        assert_eq!(parsed.shop_id, Some(3));
        assert!(parsed.data.is_some_and(|d| d.activate));
    }

    #[test]
    fn scope_from_optional_is_three_state() {
        assert_eq!(ImConfigScope::from_optional(None), ImConfigScope::Unscoped);
        assert_eq!(
            ImConfigScope::from_optional(Some(0)),
            ImConfigScope::Shop(0)
        );
        assert_eq!(
            ImConfigScope::from_optional(Some(7)),
            ImConfigScope::Shop(7)
        );
        assert_eq!(ImConfigScope::from_optional(Some(7)).shop_id(), Some(7));
        assert_eq!(ImConfigScope::Unscoped.shop_id(), None);
    }
}
