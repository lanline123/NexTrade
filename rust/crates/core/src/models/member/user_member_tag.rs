//! 用户标签关联管理（member::user_member_tag）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.user.UserMemberTagController`
//!   （`@RequestMapping("/adminapi/user/userMemberTag")`，5 个端点）
//! - 服务 `UserMemberTagServiceImpl`（店铺隔离 + 冻结守卫 SHOP-MEMBER-20260708）
//! - 入参 `UserMemberTagParam` / `UserMemberTagBatchParam`
//! - 出参 `UserMemberTagVO`；表 `user_member_tag`（实体
//!   [`crate::entities::UserMemberTag`]），关联读 `member_tag` / `member_tag_group`。
//!
//! # 端点（5，全部 admin）
//! `GET /adminapi/user/userMemberTag/listByUser`、
//! `POST /adminapi/user/userMemberTag/{bindTags,unbindTags,batchBindTags,batchUnbindTags}`。
//!
//! # 与 Java 的差异（诚实记录）
//! 1. **店铺会员冻结守卫**：Java `ShopMemberSettingService#assertEnabledForShop`
//!    读取配置 `shopMemberEnabled`（缺省 `0`），仅当 `shopId > 0` 且未启用时抛
//!    「平台未开放店铺会员功能，当前所有会员功能处于冻结状态，如有疑问请联系平台客服。」。
//!    本实现按同一配置表语义查询（`config.biz_code = 'shopMemberEnabled'`，缺省关闭）。
//! 2. `createTime` 序列化：Java `TimestampToDateSerializer` 把时间戳字符串格式化为
//!    `yyyy-MM-dd HH:mm:ss`（null / 0 → `""`），本实现输出同样字符串。
//! 3. 多租户：Java `HeaderUtils.getShopId()`（null → 0），由路由层解析后传入。
//! 4. 业务错误码沿用项目惯例 500（Java `GlobalException` 为 1001），消息逐字。

/// Java `UserMemberTagParam.userId` 的 `@NotNull`。
pub const MSG_USER_ID_REQUIRED: &str = "用户ID不能为空";
/// Java `UserMemberTagBatchParam.userIds` 的 `@NotEmpty`。
pub const MSG_USER_IDS_REQUIRED: &str = "用户ID列表不能为空";
/// Java `UserMemberTagParam/BatchParam.tagIds` 的 `@NotEmpty`。
pub const MSG_TAG_IDS_REQUIRED: &str = "标签ID列表不能为空";
/// Java `ShopMemberSettingService#assertEnabledForShop` 文案。
pub const MSG_SHOP_MEMBER_FROZEN: &str =
    "平台未开放店铺会员功能，当前所有会员功能处于冻结状态，如有疑问请联系平台客服。";
/// Java `SettingsEnum.SHOP_MEMBER_ENABLED` 的 bizCode。
pub const SHOP_MEMBER_ENABLED_CODE: &str = "shopMemberEnabled";

/// 单用户打标签 / 取消标签入参（Java `UserMemberTagParam`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMemberTagParam {
    /// 用户 ID（Java `@NotNull(message = 用户ID不能为空)`）。
    pub user_id: Option<i64>,
    /// 标签 ID 列表（Java `@NotEmpty(message = 标签ID列表不能为空)`）。
    pub tag_ids: Vec<i64>,
}

/// 批量打标签 / 取消标签入参（Java `UserMemberTagBatchParam`）。
#[derive(Debug, Clone, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMemberTagBatchParam {
    /// 用户 ID 列表（Java `@NotEmpty(message = 用户ID列表不能为空)`）。
    pub user_ids: Vec<i64>,
    /// 标签 ID 列表（Java `@NotEmpty(message = 标签ID列表不能为空)`）。
    pub tag_ids: Vec<i64>,
}

/// 用户标签 VO（Java `UserMemberTagVO`，字段逐字对齐）。
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMemberTagVO {
    /// 标签 ID。
    pub tag_id: i64,
    /// 标签名称。
    pub tag_name: String,
    /// 标签组 ID。
    pub group_id: i64,
    /// 标签组名称。
    pub group_name: String,
    /// 打标时间（`yyyy-MM-dd HH:mm:ss`；null / 0 → `""`）。
    pub create_time: String,
}

/// 时间戳 → `yyyy-MM-dd HH:mm:ss`（东八区；`None` / `<= 0` → `""`）。
///
/// 复刻 Java `TimestampToDateSerializer`：null → `""`；数值 → 东八区格式化；
/// 0 / 负数 → `""`。
#[must_use]
pub fn format_create_time(secs: Option<i64>) -> String {
    use chrono::TimeZone;
    let Some(secs) = secs.filter(|s| *s > 0) else {
        return String::new();
    };
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(secs, 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// 校验单用户参数（Java `@Valid`）。
///
/// # Errors
/// - `userId` 缺失 → 「用户ID不能为空」
/// - `tagIds` 为空 → 「标签ID列表不能为空」
pub fn validate_param(p: &UserMemberTagParam) -> Result<i64, String> {
    let user_id = p.user_id.ok_or_else(|| MSG_USER_ID_REQUIRED.to_string())?;
    if p.tag_ids.is_empty() {
        return Err(MSG_TAG_IDS_REQUIRED.to_string());
    }
    Ok(user_id)
}

/// 校验批量参数（Java `@Valid`）。
///
/// # Errors
/// - `userIds` 为空 → 「用户ID列表不能为空」
/// - `tagIds` 为空 → 「标签ID列表不能为空」
pub fn validate_batch_param(p: &UserMemberTagBatchParam) -> Result<(), String> {
    if p.user_ids.is_empty() {
        return Err(MSG_USER_IDS_REQUIRED.to_string());
    }
    if p.tag_ids.is_empty() {
        return Err(MSG_TAG_IDS_REQUIRED.to_string());
    }
    Ok(())
}

/// 计算需要删除的旧标签（Java `bindTags` 的 `existing - newTagIds`）。
#[must_use]
pub fn tags_to_delete(existing_tag_ids: &[i64], new_tag_ids: &[i64]) -> Vec<i64> {
    existing_tag_ids
        .iter()
        .copied()
        .filter(|id| !new_tag_ids.contains(id))
        .collect()
}

/// 计算需要新增的标签（Java `bindTags` 的 `newTagIds - existing`）。
#[must_use]
pub fn tags_to_insert(existing_tag_ids: &[i64], new_tag_ids: &[i64]) -> Vec<i64> {
    // Java 用 `HashSet` 去重后新增，重复提交同一 tagId 只插入一次
    let mut out: Vec<i64> = Vec::new();
    for id in new_tag_ids {
        if !existing_tag_ids.contains(id) && !out.contains(id) {
            out.push(*id);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_messages_match_java() {
        assert_eq!(
            validate_param(&UserMemberTagParam::default()).unwrap_err(),
            MSG_USER_ID_REQUIRED
        );
        assert_eq!(
            validate_param(&UserMemberTagParam {
                user_id: Some(1),
                tag_ids: vec![],
            })
            .unwrap_err(),
            MSG_TAG_IDS_REQUIRED
        );
        assert_eq!(
            validate_param(&UserMemberTagParam {
                user_id: Some(1),
                tag_ids: vec![2, 3],
            })
            .unwrap(),
            1
        );

        assert_eq!(
            validate_batch_param(&UserMemberTagBatchParam::default()).unwrap_err(),
            MSG_USER_IDS_REQUIRED
        );
        assert_eq!(
            validate_batch_param(&UserMemberTagBatchParam {
                user_ids: vec![1],
                tag_ids: vec![],
            })
            .unwrap_err(),
            MSG_TAG_IDS_REQUIRED
        );
        assert!(validate_batch_param(&UserMemberTagBatchParam {
            user_ids: vec![1],
            tag_ids: vec![2],
        })
        .is_ok());
        assert_eq!(
            MSG_SHOP_MEMBER_FROZEN,
            "平台未开放店铺会员功能，当前所有会员功能处于冻结状态，如有疑问请联系平台客服。"
        );
    }

    #[test]
    fn tag_diff_logic_matches_java_bind_rules() {
        // existing [1,2,3]，new [2,3,4] → 删 1、增 4
        assert_eq!(tags_to_delete(&[1, 2, 3], &[2, 3, 4]), vec![1]);
        assert_eq!(tags_to_insert(&[1, 2, 3], &[2, 3, 4]), vec![4]);
        // 相同集合 → 无变化
        assert!(tags_to_delete(&[1], &[1]).is_empty());
        assert!(tags_to_insert(&[1], &[1]).is_empty());
        // 重复提交不重复新增
        assert_eq!(tags_to_insert(&[1], &[1, 2, 2]), vec![2]);
    }

    #[test]
    fn create_time_format_matches_serializer() {
        assert_eq!(format_create_time(None), "");
        assert_eq!(format_create_time(Some(0)), "");
        assert_eq!(format_create_time(Some(-5)), "");
        assert_eq!(
            format_create_time(Some(1_700_000_000)),
            "2023-11-15 06:13:20"
        );
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = UserMemberTagVO {
            tag_id: 3,
            tag_name: "高价值".into(),
            group_id: 1,
            group_name: "分组A".into(),
            create_time: "2023-11-15 06:13:20".into(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["tagId"], 3);
        assert_eq!(json["tagName"], "高价值");
        assert_eq!(json["groupId"], 1);
        assert_eq!(json["createTime"], "2023-11-15 06:13:20");
    }

    #[test]
    fn param_binds_camel_case() {
        let p: UserMemberTagParam =
            serde_json::from_value(serde_json::json!({"userId": 9, "tagIds": [1, 2]})).unwrap();
        assert_eq!(p.user_id, Some(9));
        assert_eq!(p.tag_ids, vec![1, 2]);
        let b: UserMemberTagBatchParam =
            serde_json::from_value(serde_json::json!({"userIds": [1, 2], "tagIds": [3]})).unwrap();
        assert_eq!(b.user_ids, vec![1, 2]);
        assert_eq!(b.tag_ids, vec![3]);
    }
}
