//! 微信菜单（content::wechat_menu）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.setting.wechat.WechatMenuController`
//!   （`@RequestMapping("/adminapi/wechat/menu")`，2 个端点）
//! - 服务 `WechatMenuServiceImpl`
//! - 入参 `WxMenuSaveDTO` / `WxMenuNodeDTO` / `WxMenuRuleDTO`
//! - 出参 `WxMenuVO` / `SaveAndPublishVO`；表 `wechat_menu`（单例，
//!   实体 [`crate::entities::WechatMenu`]）
//!
//! # 端点（2，全部 admin）
//! `GET /adminapi/wechat/menu`、`POST /adminapi/wechat/menu/saveAndPublish`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **`saveAndPublish` 的微信推送未迁移**：Java 先在事务外调用微信
//!    `menu/create`（`WxMenuApiService`），成功后独立事务落库 `menu_json` +
//!    `published_at`；本实现完成**全量本地校验**后返回明确「未迁移」业务错误，
//!    **既不推送微信也不落库**（避免 DB 与微信 key 错位）。
//! 2. `get` 纯读库：解析 `menu_json` 为树；空配置或解析失败 → 空树
//!    （`buttons: []`），与 Java 一致。
//! 3. 菜单名称字节数：Java 用 GBK 实际字节数（汉字 2 字节）；本实现按
//!    「ASCII=1 字节、其余=2 字节」估算（GBK 对常用中文等价；生僻扩展区
//!    可能差异，记录在案）。
//! 4. `publishedAt` / `updatedAt` 为 `yyyy-MM-dd HH:mm:ss` 字符串（DB DATETIME）；
//!    Java LocalDateTime 默认 Jackson 输出 ISO-8601（带 `T`），前端如依赖 `T`
//!    格式需注意。
//! 5. 业务错误码沿用项目惯例 500（Java `GlobalException` 1001），消息逐字。

use serde::{Deserialize, Serialize};

/// Java `saveAndPublish` 入参空树文案。
pub const MSG_MENU_REQUIRED: &str = "菜单不能为空";
/// Java `WxMenuSaveDTO.WxMenuTree.buttons` 的 `@Size(max = 3)`。
pub const MSG_TOP_MAX: &str = "一级菜单最多 3 个";
/// `saveAndPublish` 未迁移业务错误。
pub const MSG_PUBLISH_NOT_MIGRATED: &str =
    "微信菜单发布依赖公众号 AppID/AppSecret 与微信自定义菜单 API（menu/create），当前 Rust 侧尚未迁移；本地校验已通过，未向微信推送、未落库";

/// 一级菜单名称最大 GBK 字节数。
pub const MAX_TOP_NAME_BYTES: usize = 8;
/// 二级菜单名称最大 GBK 字节数。
pub const MAX_SUB_NAME_BYTES: usize = 16;
/// 一级菜单最大数量。
pub const MAX_TOP_BUTTONS: usize = 3;
/// 二级菜单最大数量。
pub const MAX_SUB_BUTTONS: usize = 5;
/// 文本消息最大字符数。
pub const MAX_CLICK_CONTENT_LEN: usize = 600;
/// 图文标题最大字符数。
pub const MAX_NEWS_TITLE_LEN: usize = 64;
/// 图文摘要最大字符数。
pub const MAX_NEWS_DESC_LEN: usize = 120;
/// 事件 Key 最大长度。
pub const MAX_EVENT_KEY_LEN: usize = 128;

/// 菜单树根容器（Java `WxMenuSaveDTO.WxMenuTree`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WxMenuTree {
    /// 一级菜单列表（≤3）。
    pub buttons: Vec<WxMenuNodeDTO>,
}

/// 菜单节点（Java `WxMenuNodeDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WxMenuNodeDTO {
    /// 节点 ID（前端使用，≤64）。
    pub id: Option<String>,
    /// 名称（`@NotBlank(message = 菜单名称不能为空)`）。
    pub name: Option<String>,
    /// 排序值（`@NotNull(message = 排序值不能为空)`）。
    pub sort_order: Option<i32>,
    /// 子菜单（≤5）。
    pub children: Vec<WxMenuNodeDTO>,
    /// 响应规则。
    pub rule: Option<WxMenuRuleDTO>,
}

/// 菜单响应规则（Java `WxMenuRuleDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WxMenuRuleDTO {
    /// 类型：click / view / miniprogram（`@NotBlank`）。
    pub r#type: Option<String>,
    /// 事件 Key（click）。
    pub event_key: Option<String>,
    /// 消息类型：1=文本 2=图文（click）。
    pub msg_type: Option<i32>,
    /// 文本内容（≤600）。
    pub content: Option<String>,
    /// 图文标题（≤64）。
    pub news_title: Option<String>,
    /// 图文封面图 URL。
    pub news_cover_url: Option<String>,
    /// 图文摘要（≤120）。
    pub news_description: Option<String>,
    /// 图文跳转链接。
    pub news_url: Option<String>,
    /// 跳转地址（view）。
    pub url: Option<String>,
    /// 小程序 appid（miniprogram）。
    pub appid: Option<String>,
    /// 小程序路径（miniprogram，形如 `pages/xxx/xxx`）。
    pub pagepath: Option<String>,
    /// 备用网页（miniprogram）。
    pub miniprogram_url: Option<String>,
}

/// 保存并发布入参（Java `WxMenuSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WxMenuSaveDTO {
    /// 菜单树（`@NotNull(message = 菜单结构不能为空)`）。
    pub tree: Option<WxMenuTree>,
}

/// 菜单 VO（Java `WxMenuVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WxMenuVO {
    /// 主键（无配置时 `null`）。
    pub id: Option<i64>,
    /// 菜单树（空配置 → `buttons: []`）。
    pub tree: WxMenuTree,
    /// 最近发布成功时间。
    pub published_at: Option<String>,
    /// 更新时间。
    pub updated_at: Option<String>,
}

/// 保存并发布 VO（Java `SaveAndPublishVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAndPublishVO {
    /// 是否发布成功。
    pub published: bool,
    /// 失败原因。
    pub err_msg: Option<String>,
    /// 发布时间。
    pub published_at: Option<String>,
}

/// 解析 `menu_json`：空/null/非法 JSON → 空树（Java `get` 的兜底）。
#[must_use]
pub fn parse_menu_tree(menu_json: Option<&str>) -> WxMenuTree {
    let Some(text) = menu_json.map(str::trim).filter(|s| !s.is_empty()) else {
        return WxMenuTree::default();
    };
    serde_json::from_str::<WxMenuTree>(text).unwrap_or_default()
}

/// 估算 GBK 字节数（Java `byteLenGbk`）：ASCII=1，其余（中文等）=2。
#[must_use]
pub fn byte_len_gbk(value: &str) -> usize {
    value
        .chars()
        .map(|c| if c.is_ascii() { 1 } else { 2 })
        .sum()
}

/// 是否合法 http(s) URL（Java `HTTP_URL = ^https?://.+`）。
#[must_use]
pub fn is_http_url(url: Option<&str>) -> bool {
    let Some(url) = url.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    let lower = url.to_ascii_lowercase();
    (lower.starts_with("http://") && url.len() > 7)
        || (lower.starts_with("https://") && url.len() > 8)
}

/// 小程序 pagepath 校验（Java `PAGE_PATH = ^pages/.+`）。
#[must_use]
pub fn is_page_path(path: Option<&str>) -> bool {
    path.map(str::trim)
        .is_some_and(|p| p.starts_with("pages/") && p.len() > "pages/".len())
}

/// 全量本地校验（Java `saveAndPublish` 的入参 + `validateLevelOne/Two/Rule`，
/// 文案逐字；`eventKey` 规范化不在校验范围，见模块头差异 1）。
///
/// # Errors
/// 校验失败 → 对应逐字中文文案。
pub fn validate_menu(dto: &WxMenuSaveDTO) -> Result<(), String> {
    let Some(tree) = dto.tree.as_ref() else {
        return Err("菜单结构不能为空".to_string());
    };
    if tree.buttons.is_empty() {
        return Err(MSG_MENU_REQUIRED.to_string());
    }
    if tree.buttons.len() > MAX_TOP_BUTTONS {
        return Err(MSG_TOP_MAX.to_string());
    }
    for (i, top) in tree.buttons.iter().enumerate() {
        validate_level_one(top, i)?;
    }
    Ok(())
}

fn validate_level_one(node: &WxMenuNodeDTO, idx: usize) -> Result<(), String> {
    let pos = idx + 1;
    let name = node.name.as_deref().map(str::trim).unwrap_or("");
    if name.is_empty() {
        return Err(format!("第 {pos} 个一级菜单名称不能为空"));
    }
    if byte_len_gbk(name) > MAX_TOP_NAME_BYTES {
        return Err(format!(
            "一级菜单「{name}」名称超过 {MAX_TOP_NAME_BYTES} 字节"
        ));
    }
    if !node.children.is_empty() {
        // 一级有 children 时完全忽略 rule（Java 同义）
        if node.children.len() > MAX_SUB_BUTTONS {
            return Err(format!(
                "一级菜单「{name}」二级数量超过 {MAX_SUB_BUTTONS} 个"
            ));
        }
        for (j, child) in node.children.iter().enumerate() {
            validate_level_two(child, name, j)?;
        }
        return Ok(());
    }
    let Some(rule) = node.rule.as_ref() else {
        return Err(format!("一级菜单「{name}」缺少响应规则"));
    };
    validate_rule(rule, name)
}

fn validate_level_two(node: &WxMenuNodeDTO, parent_name: &str, idx: usize) -> Result<(), String> {
    let pos = idx + 1;
    let name = node.name.as_deref().map(str::trim).unwrap_or("");
    if name.is_empty() {
        return Err(format!(
            "「{parent_name}」下第 {pos} 个二级菜单名称不能为空"
        ));
    }
    if byte_len_gbk(name) > MAX_SUB_NAME_BYTES {
        return Err(format!(
            "二级菜单「{name}」名称超过 {MAX_SUB_NAME_BYTES} 字节"
        ));
    }
    if !node.children.is_empty() {
        return Err(format!("二级菜单「{name}」不允许再含子菜单"));
    }
    let Some(rule) = node.rule.as_ref() else {
        return Err(format!("二级菜单「{name}」缺少响应规则"));
    };
    validate_rule(rule, name)
}

fn validate_rule(rule: &WxMenuRuleDTO, node_name: &str) -> Result<(), String> {
    let Some(rule_type) = rule
        .r#type
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        return Err(format!("菜单「{node_name}」响应规则类型不能为空"));
    };
    match rule_type {
        "click" => {
            let key = rule.event_key.as_deref().map(str::trim).unwrap_or("");
            if key.is_empty() {
                return Err(format!("菜单「{node_name}」事件 Key 不能为空"));
            }
            if key.len() > MAX_EVENT_KEY_LEN {
                return Err(format!(
                    "菜单「{node_name}」事件 Key 长度不能超过 {MAX_EVENT_KEY_LEN}"
                ));
            }
            match rule.msg_type {
                Some(1) => {
                    let content = rule.content.as_deref().map(str::trim).unwrap_or("");
                    if content.is_empty() {
                        return Err(format!("菜单「{node_name}」文本消息内容不能为空"));
                    }
                    if content.chars().count() > MAX_CLICK_CONTENT_LEN {
                        return Err(format!(
                            "菜单「{node_name}」文本消息内容不能超过 {MAX_CLICK_CONTENT_LEN} 字符"
                        ));
                    }
                }
                Some(2) => {
                    let title = rule.news_title.as_deref().map(str::trim).unwrap_or("");
                    let desc = rule
                        .news_description
                        .as_deref()
                        .map(str::trim)
                        .unwrap_or("");
                    if title.is_empty()
                        || desc.is_empty()
                        || rule
                            .news_cover_url
                            .as_deref()
                            .map(str::trim)
                            .unwrap_or("")
                            .is_empty()
                        || rule
                            .news_url
                            .as_deref()
                            .map(str::trim)
                            .unwrap_or("")
                            .is_empty()
                    {
                        return Err(format!(
                            "菜单「{node_name}」图文消息的标题、摘要、封面、链接均不能为空"
                        ));
                    }
                    if title.chars().count() > MAX_NEWS_TITLE_LEN {
                        return Err(format!(
                            "菜单「{node_name}」图文标题不能超过 {MAX_NEWS_TITLE_LEN} 字符"
                        ));
                    }
                    if desc.chars().count() > MAX_NEWS_DESC_LEN {
                        return Err(format!(
                            "菜单「{node_name}」图文摘要不能超过 {MAX_NEWS_DESC_LEN} 字符"
                        ));
                    }
                    if !is_http_url(rule.news_url.as_deref()) {
                        return Err(format!(
                            "菜单「{node_name}」图文跳转链接必须是 http/https URL"
                        ));
                    }
                }
                _ => {
                    return Err(format!(
                        "菜单「{node_name}」请选择发送消息类型（文本或图文）"
                    ));
                }
            }
        }
        "view" => {
            if !is_http_url(rule.url.as_deref()) {
                return Err(format!("菜单「{node_name}」跳转地址必须是 http/https URL"));
            }
        }
        "miniprogram" => {
            if rule
                .appid
                .as_deref()
                .map(str::trim)
                .unwrap_or("")
                .is_empty()
            {
                return Err(format!("菜单「{node_name}」小程序 appid 不能为空"));
            }
            if !is_page_path(rule.pagepath.as_deref()) {
                return Err(format!(
                    "菜单「{node_name}」小程序路径必须形如 pages/xxx/xxx"
                ));
            }
            if let Some(url) = rule
                .miniprogram_url
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                if !is_http_url(Some(url)) {
                    return Err(format!("菜单「{node_name}」备用网页必须是 http/https URL"));
                }
            }
        }
        other => {
            return Err(format!("菜单「{node_name}」响应规则类型非法：{other}"));
        }
    }
    Ok(())
}

/// 便捷构造函数：文本 click 菜单节点（测试/文档用）。
#[must_use]
pub fn click_rule(event_key: &str, content: &str) -> WxMenuRuleDTO {
    WxMenuRuleDTO {
        r#type: Some("click".into()),
        event_key: Some(event_key.into()),
        msg_type: Some(1),
        content: Some(content.into()),
        ..Default::default()
    }
}

#[must_use]
pub fn leaf_node(name: &str, rule: WxMenuRuleDTO) -> WxMenuNodeDTO {
    WxMenuNodeDTO {
        id: Some(format!("node_{name}")),
        name: Some(name.into()),
        sort_order: Some(1),
        children: Vec::new(),
        rule: Some(rule),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_menu() -> WxMenuSaveDTO {
        WxMenuSaveDTO {
            tree: Some(WxMenuTree {
                buttons: vec![leaf_node("资讯", click_rule("MENU_1", "欢迎"))],
            }),
        }
    }

    #[test]
    fn valid_menu_passes() {
        assert!(validate_menu(&valid_menu()).is_ok());
    }

    #[test]
    fn empty_menu_messages() {
        assert_eq!(
            validate_menu(&WxMenuSaveDTO::default()).unwrap_err(),
            "菜单结构不能为空"
        );
        assert_eq!(
            validate_menu(&WxMenuSaveDTO {
                tree: Some(WxMenuTree::default())
            })
            .unwrap_err(),
            MSG_MENU_REQUIRED
        );
    }

    #[test]
    fn gbk_byte_length_is_approximated() {
        assert_eq!(byte_len_gbk("abc"), 3);
        assert_eq!(byte_len_gbk("资讯"), 4);
        assert_eq!(byte_len_gbk("1234资讯"), 8);
    }

    #[test]
    fn top_name_and_count_limits() {
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].name = Some("123456789".into());
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "一级菜单「123456789」名称超过 8 字节"
        );
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons = vec![
            leaf_node("A", click_rule("MENU_1", "x")),
            leaf_node("B", click_rule("MENU_2", "x")),
            leaf_node("C", click_rule("MENU_3", "x")),
            leaf_node("D", click_rule("MENU_4", "x")),
        ];
        assert_eq!(validate_menu(&menu).unwrap_err(), MSG_TOP_MAX);
    }

    #[test]
    fn click_rule_validation_messages() {
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO::default());
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」响应规则类型不能为空"
        );
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("click".into()),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」事件 Key 不能为空"
        );
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("click".into()),
            event_key: Some("MENU_1".into()),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」请选择发送消息类型（文本或图文）"
        );
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("click".into()),
            event_key: Some("MENU_1".into()),
            msg_type: Some(2),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」图文消息的标题、摘要、封面、链接均不能为空"
        );
    }

    #[test]
    fn view_and_miniprogram_rules() {
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("view".into()),
            url: Some("ftp://a.com".into()),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」跳转地址必须是 http/https URL"
        );
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("view".into()),
            url: Some("https://a.com".into()),
            ..Default::default()
        });
        assert!(validate_menu(&menu).is_ok());
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("miniprogram".into()),
            appid: Some("wx123".into()),
            pagepath: Some("pages/home/index".into()),
            ..Default::default()
        });
        assert!(validate_menu(&menu).is_ok());
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("miniprogram".into()),
            appid: Some("wx123".into()),
            pagepath: Some("home/index".into()),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」小程序路径必须形如 pages/xxx/xxx"
        );
        menu.tree.as_mut().unwrap().buttons[0].rule = Some(WxMenuRuleDTO {
            r#type: Some("unknown".into()),
            ..Default::default()
        });
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "菜单「资讯」响应规则类型非法：unknown"
        );
    }

    #[test]
    fn sub_menu_rules() {
        let mut menu = valid_menu();
        menu.tree.as_mut().unwrap().buttons[0] = WxMenuNodeDTO {
            name: Some("资讯".into()),
            children: vec![WxMenuNodeDTO {
                name: Some("子".into()),
                rule: Some(click_rule("MENU_SUB", "x")),
                ..Default::default()
            }],
            ..Default::default()
        };
        assert!(validate_menu(&menu).is_ok());
        // 二级再含子菜单
        menu.tree.as_mut().unwrap().buttons[0].children[0].children = vec![WxMenuNodeDTO {
            name: Some("孙".into()),
            rule: Some(click_rule("MENU_G", "x")),
            ..Default::default()
        }];
        assert_eq!(
            validate_menu(&menu).unwrap_err(),
            "二级菜单「子」不允许再含子菜单"
        );
    }

    #[test]
    fn parse_menu_tree_falls_back_to_empty() {
        assert!(parse_menu_tree(None).buttons.is_empty());
        assert!(parse_menu_tree(Some("not-json")).buttons.is_empty());
        assert!(parse_menu_tree(Some("{}")).buttons.is_empty());
        let tree = parse_menu_tree(Some(
            r#"{"buttons":[{"name":"资讯","rule":{"type":"click","eventKey":"K","msgType":1,"content":"hi"}}]}"#,
        ));
        assert_eq!(tree.buttons.len(), 1);
        assert_eq!(tree.buttons[0].name.as_deref(), Some("资讯"));
        assert_eq!(
            tree.buttons[0].rule.as_ref().unwrap().event_key.as_deref(),
            Some("K")
        );
    }

    #[test]
    fn menu_vo_serializes_camel_case() {
        let vo = WxMenuVO {
            id: Some(1),
            tree: parse_menu_tree(None),
            published_at: Some("2026-04-23 10:00:00".into()),
            updated_at: Some("2026-04-23 10:00:00".into()),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["publishedAt"], "2026-04-23 10:00:00");
        assert!(json["tree"]["buttons"].as_array().unwrap().is_empty());
    }
}
