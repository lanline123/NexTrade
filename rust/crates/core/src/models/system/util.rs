//! 通用工具（system::util）模型层。
//!
//! 对应 Java `UtilController`
//! （`java/tigshop-api/.../controller/common/UtilController.java`，
//! `@RequestMapping("/api/common/util")`），3 个 GET 端点，契约 `auth=optional`：
//!
//! | 端点 | Java 实现 | 本实现 |
//! |------|-----------|--------|
//! | `GET /api/common/util/qrCode?url=` | `QrCodeUtil.generateAsBase64`（hutool） | 本地参数校验后返回 1001「未迁移」 |
//! | `GET /api/common/util/miniCode?path=&id=&salesmanId=&shopId=` | `WechatOAuthService.getMiniCode` | 同上 |
//! | `GET /api/common/util/miniScene?scene=` | `WechatOAuthService.resolveMiniScene` | 同上 |
//!
//! 外部依赖（二维码编码库 / 微信 OAuth 客户端）本波次未迁移，按任务要求
//! **保留端点并返回明确「未迁移」业务错误，不伪造成功**。

use serde::Deserialize;

/// 二维码生成未迁移（Java `QrCodeUtil.generateAsBase64`）。
pub const MSG_QRCODE_NOT_MIGRATED: &str = "二维码生成功能未迁移（QrCodeUtil.generateAsBase64）";
/// 小程序码生成未迁移（Java `WechatOAuthService.getMiniCode`）。
pub const MSG_MINI_CODE_NOT_MIGRATED: &str =
    "小程序码生成功能未迁移（WechatOAuthService.getMiniCode）";
/// 小程序码 scene 解析未迁移（Java `WechatOAuthService.resolveMiniScene`）。
pub const MSG_MINI_SCENE_NOT_MIGRATED: &str =
    "小程序码 scene 解析未迁移（WechatOAuthService.resolveMiniScene）";
/// `url` 参数缺失（Java `@RequestParam String url` 必填）。
pub const MSG_URL_REQUIRED: &str = "url不能为空";
/// `path` 参数缺失（Java `@RequestParam String path` 必填）。
pub const MSG_PATH_REQUIRED: &str = "path不能为空";
/// `id` 参数缺失（Java `@RequestParam Integer id` 必填）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// `scene` 参数缺失（Java `@RequestParam String scene` 必填）。
pub const MSG_SCENE_REQUIRED: &str = "scene不能为空";

/// `GET /api/common/util/qrCode` 查询参数。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCodeQuery {
    /// 待编码 URL
    pub url: Option<String>,
}

/// `GET /api/common/util/miniCode` 查询参数。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniCodeQuery {
    /// 小程序页面路径
    pub path: Option<String>,
    /// 业务 ID（商品/活动等）
    pub id: Option<i32>,
    /// 分销员 ID（可空）
    pub salesman_id: Option<i32>,
    /// 店铺 ID（可空）
    pub shop_id: Option<i32>,
}

/// `GET /api/common/util/miniScene` 查询参数。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniSceneQuery {
    /// 小程序码 scene 短码
    pub scene: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn qr_query_is_optional_camel_case() {
        let q: QrCodeQuery =
            serde_json::from_value(serde_json::json!({"url":"https://a"})).unwrap();
        assert_eq!(q.url.as_deref(), Some("https://a"));
        let empty: QrCodeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(empty.url.is_none());
    }

    #[test]
    fn mini_code_query_reads_camel_case_ids() {
        let q: MiniCodeQuery = serde_json::from_value(serde_json::json!({
            "path":"pages/index","id":7,"salesmanId":8,"shopId":9
        }))
        .unwrap();
        assert_eq!(q.path.as_deref(), Some("pages/index"));
        assert_eq!(q.id, Some(7));
        assert_eq!(q.salesman_id, Some(8));
        assert_eq!(q.shop_id, Some(9));
    }

    #[test]
    fn not_migrated_messages_are_explicit() {
        assert!(MSG_QRCODE_NOT_MIGRATED.contains("未迁移"));
        assert!(MSG_MINI_CODE_NOT_MIGRATED.contains("未迁移"));
        assert!(MSG_MINI_SCENE_NOT_MIGRATED.contains("未迁移"));
    }
}
