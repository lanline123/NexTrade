//! IM 消息（ImMessageController） 域 DTO / VO（im::im_message）。
//!
//! 对应原 Java（`tigshop-bean`）：
//! - `com.tigshop.bean.dto.im.ImMessageListDTO`（列表查询参数，继承 `BasePage`）
//! - `com.tigshop.bean.dto.im.ImMessageReceivedListDTO`（播报记录列表，仅分页）
//! - `com.tigshop.bean.dto.im.ImMessageSendDTO`（发送入参）
//! - `com.tigshop.bean.dto.im.ImSetReadDTO`（设置已读入参）
//! - `com.tigshop.bean.vo.im.ContentVO` / `ImMessageListVO` / `ImMessageSendVO`
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`
//! （订单/商品金额）；时间为 Java `TigUtils.handelTime` 输出的
//! `yyyy-MM-dd HH:mm:ss` 字符串（VO 侧），入参/落库为秒级时间戳 `i64`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ————————————————————— 消息内容 —————————————————————

/// 商品卡片消息（Java `ContentVO.ProductInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ProductInfoVO {
    pub message_type: Option<String>,
    pub product_id: Option<i32>,
    pub pic_url: Option<String>,
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub product_price: Option<Decimal>,
}

/// 订单卡片消息（Java `ContentVO.OrderInfoVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderInfoVO {
    pub message_type: Option<String>,
    pub order_id: Option<i32>,
    pub order_sn: Option<String>,
    pub pic_url: Option<String>,
    pub product_name: Option<String>,
    pub product_num: Option<i32>,
    pub total_amount: Option<Decimal>,
    pub order_status_name: Option<String>,
    pub product_type: Option<i32>,
}

/// 消息内容（Java `ContentVO`）。
///
/// 落库为 `im_message.content` 的 JSON 文本；读取时反序列化回该结构
/// （对应 Java `JsonUtil.fromJson(content, ContentVO.class)`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContentVO {
    /// 消息类型：text / image / custom / sound / video / file
    pub message_type: Option<String>,
    /// 文本内容
    pub content: Option<String>,
    /// 图片
    pub pic: Option<String>,
    /// 视频地址
    pub video_url: Option<String>,
    /// 视频封面
    pub video_cover: Option<String>,
    /// 消息分类
    pub content_category: Option<String>,
    /// 订单消息
    pub order: Option<OrderInfoVO>,
    /// 商品信息
    pub product: Option<ProductInfoVO>,
}

impl ContentVO {
    /// 解析 `im_message.content` 的 JSON 文本（Java `JsonUtil.fromJson`）。
    ///
    /// 与 Java 一致：`None` / 空串 / 非法 JSON → `None`（Jackson 亦返回 `null`），
    /// **不抛错**。
    #[must_use]
    pub fn parse(raw: Option<&str>) -> Option<Self> {
        let trimmed = raw?.trim();
        if trimmed.is_empty() {
            return None;
        }
        serde_json::from_str(trimmed).ok()
    }

    /// 序列化为落库 JSON 文本（Java `JsonUtil.toJson`）。
    ///
    /// # Errors
    /// 纯数据对象，仅在序列化器异常时返回 `Error::Internal`。
    pub fn to_json_string(&self) -> crate::Result<String> {
        serde_json::to_string(self)
            .map_err(|e| crate::Error::Internal(format!("IM 消息内容序列化失败: {e}")))
    }

    /// 本条内容的有效消息类型（Java：`contentVO != null ? getMessageType() : "text"`，
    /// 再 `messageType != null ? messageType : "text"` 落库）。
    #[must_use]
    pub fn effective_message_type(&self) -> String {
        self.message_type
            .clone()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "text".to_string())
    }
}

// ————————————————————— 列表 VO —————————————————————

/// 列表 VO 内嵌用户信息（Java `ImMessageListVO.UserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MessageUserVO {
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
}

/// 列表 VO 内嵌客服信息（Java `ImMessageListVO.ServantVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MessageServantVO {
    pub admin_id: Option<i32>,
    pub username: Option<String>,
    pub avatar: Option<String>,
}

/// 会话消息列表 VO（Java `ImMessageListVO`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImMessageListVO {
    pub message_type_text: Option<String>,
    pub id: Option<i32>,
    pub conversation_id: Option<i32>,
    pub content: Option<ContentVO>,
    pub message_type: Option<String>,
    pub r#type: Option<i32>,
    pub user_id: Option<i32>,
    pub servant_id: Option<i32>,
    pub send_time: Option<String>,
    pub status: Option<i32>,
    pub extend: Option<String>,
    pub push_status: Option<i32>,
    pub is_read: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub user: Option<MessageUserVO>,
    pub servant: Option<MessageServantVO>,
}

/// 发送会话消息 VO（Java `ImMessageSendVO`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImMessageSendVO {
    pub message_type_text: Option<String>,
    pub id: Option<i32>,
    pub conversation_id: Option<i32>,
    pub content: Option<ContentVO>,
    pub message_type: Option<String>,
    pub r#type: Option<i32>,
    pub user_id: Option<i32>,
    pub servant_id: Option<i32>,
    pub send_time: Option<String>,
    pub status: Option<i32>,
    pub extend: Option<String>,
    pub push_status: Option<i32>,
    pub is_read: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_from: Option<String>,
    pub user: Option<MessageUserVO>,
    pub servant: Option<MessageServantVO>,
}

// ————————————————————— 入参 DTO —————————————————————

/// 分页基础参数（Java `BasePage`：`page` 默认 1，`size` 默认 15、上限 100）。
#[derive(Debug, Clone, Deserialize)]
pub struct BasePageParams {
    pub page: Option<i64>,
    pub size: Option<i64>,
}

impl BasePageParams {
    /// 归一化页码（Java `getPage()`：null → 1）。
    #[must_use]
    pub fn page_no(&self) -> i64 {
        self.page.filter(|p| *p >= 1).unwrap_or(1)
    }

    /// 归一化每页大小（Java `getSize()`：null → 15，>100 → 100）。
    #[must_use]
    pub fn page_size(&self) -> i64 {
        match self.size {
            None => 15,
            Some(v) if v > 100 => 100,
            Some(v) if v < 1 => 1,
            Some(v) => v,
        }
    }

    /// (LIMIT, OFFSET)。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        let size = self.page_size();
        (size, (self.page_no() - 1) * size)
    }
}

/// 会话消息列表查询参数（Java `ImMessageListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImMessageListDTO {
    pub conversation_id: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_id: Option<i32>,
    pub first_id: Option<i32>,
    pub servant_id: Option<i32>,
    /// 消息类型（Java DTO 里是 `String`，落库为 tinyint）。
    pub r#type: Option<i32>,
    pub is_read: Option<i32>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
}

impl ImMessageListDTO {
    /// 归一化分页参数（复用 [`BasePageParams`] 口径）。
    #[must_use]
    pub fn paging(&self) -> BasePageParams {
        BasePageParams {
            page: self.page,
            size: self.size,
        }
    }
}

/// 客服消息播报记录列表查询参数（Java `ImMessageReceivedListDTO`，仅分页）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImMessageReceivedListDTO {
    pub page: Option<i64>,
    pub size: Option<i64>,
}

impl ImMessageReceivedListDTO {
    /// 归一化分页参数。
    #[must_use]
    pub fn paging(&self) -> BasePageParams {
        BasePageParams {
            page: self.page,
            size: self.size,
        }
    }
}

/// 发送消息入参（Java `ImMessageSendDTO`）。
///
/// `type` / `servantId` / `userId` / `shopId` 会被控制器按登录态覆盖，
/// 客户端传值无效（对齐 Java）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImMessageSendDTO {
    pub conversation_id: Option<i32>,
    pub user_id: Option<i32>,
    pub content: Option<ContentVO>,
    pub shop_id: Option<i32>,
    pub product_id: Option<i32>,
    pub r#type: Option<i32>,
    pub servant_id: Option<i32>,
    pub user_from: Option<String>,
}

/// 设置已读入参（Java `ImSetReadDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImSetReadDTO {
    pub conversation_id: Option<i32>,
    pub shop_id: Option<i32>,
    pub user_id: Option<i32>,
    pub servant_id: Option<i32>,
    pub time: Option<String>,
}

// ————————————————————— 消息类型文本 —————————————————————

/// 视频上传结果（Java `bean.vo.setting.UploadVideoInfoVO`）。
///
/// 仅 `POST /im/conversation/message/uploadVideo`（后台）返回体形状；
/// 该端点依赖对象存储 + 视频抽帧（jcodec），本构建**未迁移**，
/// 成功路径不可用（服务层返回明确业务错误）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UploadVideoInfoVO {
    pub video_url: String,
    pub video_name: String,
    pub format: String,
    pub video_cover: String,
}

/// 消息类型码 → 中文描述（Java `MessageType.getTypeName`）。
///
/// Java 命中返回中文，未命中 `throw GlobalException(DATA_TYPE_ERROR)`。
/// 迁移侧：未命中返回 `None`（映射为 VO 的 `messageTypeText = null`），
/// 避免脏数据使整页查询失败——差异见切片 `uncertain_points`。
#[must_use]
pub fn message_type_text(code: Option<&str>) -> Option<&'static str> {
    match code {
        Some("text") => Some("文本"),
        Some("image") => Some("图片"),
        Some("custom") => Some("自定义"),
        Some("video") => Some("视频"),
        Some("sound") => Some("语音"),
        Some("file") => Some("文件"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paging_defaults_match_java_base_page() {
        // Java：page null → 1；size null → 15，>100 → 100
        let p = BasePageParams {
            page: None,
            size: None,
        };
        assert_eq!((p.page_no(), p.page_size()), (1, 15));
        assert_eq!(p.limit_offset(), (15, 0));

        let p2 = BasePageParams {
            page: Some(3),
            size: Some(200),
        };
        assert_eq!(p2.page_size(), 100);
        assert_eq!(p2.limit_offset(), (100, 200));
    }

    #[test]
    fn message_type_text_table() {
        assert_eq!(message_type_text(Some("text")), Some("文本"));
        assert_eq!(message_type_text(Some("image")), Some("图片"));
        assert_eq!(message_type_text(Some("custom")), Some("自定义"));
        assert_eq!(message_type_text(Some("video")), Some("视频"));
        assert_eq!(message_type_text(Some("sound")), Some("语音"));
        assert_eq!(message_type_text(Some("file")), Some("文件"));
        assert_eq!(message_type_text(Some("unknown")), None);
        assert_eq!(message_type_text(None), None);
    }

    #[test]
    fn content_round_trip_uses_camel_case_keys() {
        let c = ContentVO {
            message_type: Some("video".into()),
            video_url: Some("https://cdn/v.mp4".into()),
            ..Default::default()
        };
        let json = c.to_json_string().unwrap();
        assert!(json.contains("\"messageType\":\"video\""));
        assert!(json.contains("\"videoUrl\":\"https://cdn/v.mp4\""));
        let back = ContentVO::parse(Some(&json)).unwrap();
        assert_eq!(back.message_type.as_deref(), Some("video"));
    }

    #[test]
    fn content_parse_null_like_json_util() {
        assert!(ContentVO::parse(None).is_none());
        assert!(ContentVO::parse(Some("")).is_none());
        assert!(ContentVO::parse(Some("not json")).is_none());
    }

    #[test]
    fn effective_message_type_falls_back_to_text() {
        assert_eq!(
            ContentVO::default().effective_message_type(),
            "text".to_string()
        );
        let c = ContentVO {
            message_type: Some("image".into()),
            ..Default::default()
        };
        assert_eq!(c.effective_message_type(), "image".to_string());
    }
}
