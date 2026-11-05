//! 会员人群圈选域（member::member_audience）DTO / 纯函数。
//!
//! Java `MemberAudienceController`（`/adminapi/user/memberAudience/estimate|describe`，需登录）。
//! 无独立表：按 `MemberAudienceDTO` 条件统计 `user` 表会员（`user_type = 0`），
//! 标签条件经 `user_member_tag` 关联 `member_tag`。
//!
//! # 与 Java 的差异
//! Java `upgrade()` 还把 DTO 升维为 `SendUserTargetDTO` 并复用营销发送逻辑；
//! 本实现直接按 audienceType 统计/描述（结果口径一致，未迁移 `SendUserTargetDTO` 互斥归一细节）。

use crate::{Error, Result};
use serde::{Deserialize, Serialize};

pub const SERVICE_DATA_ERROR: i32 = 1001;
pub const TYPE_ALL: i32 = 0;
pub const TYPE_RANK: i32 = 1;
pub const TYPE_TAG: i32 = 2;
pub const MATCH_ANY: i32 = 0;
pub const MATCH_ALL: i32 = 1;
/// 未选择会员。
pub const PLEASE_SELECT_MEMBER: &str = "请选择会员";
/// 全部会员描述（Java `describe`）。
pub const ALL_MEMBERS_TEXT: &str = "全部会员";

/// 人群条件（Java `MemberAudienceDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberAudienceDTO {
    pub audience_type: Option<i32>,
    pub rank_ids: Option<Vec<i32>>,
    pub tag_ids: Option<Vec<i64>>,
    pub tag_match_mode: Option<i32>,
}

/// 归一化后的人群类型。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Audience {
    All,
    Ranks(Vec<i32>),
    Tags { tag_ids: Vec<i64>, match_all: bool },
}

/// 校验 + 归一化（Java `upgrade` + `validateTarget`：未选会员 → 「请选择会员」）。
pub fn resolve(audience: &MemberAudienceDTO) -> Result<Audience> {
    match audience.audience_type.unwrap_or(TYPE_ALL) {
        TYPE_ALL => Ok(Audience::All),
        TYPE_RANK => {
            let ids = audience.rank_ids.clone().unwrap_or_default();
            if ids.is_empty() {
                return Err(Error::biz(SERVICE_DATA_ERROR, PLEASE_SELECT_MEMBER));
            }
            Ok(Audience::Ranks(ids))
        }
        TYPE_TAG => {
            let ids = audience.tag_ids.clone().unwrap_or_default();
            if ids.is_empty() {
                return Err(Error::biz(SERVICE_DATA_ERROR, PLEASE_SELECT_MEMBER));
            }
            Ok(Audience::Tags {
                tag_ids: ids,
                match_all: audience.tag_match_mode.unwrap_or(MATCH_ANY) == MATCH_ALL,
            })
        }
        other => Err(Error::biz(
            SERVICE_DATA_ERROR,
            format!("不支持的人群类型：{other}"),
        )),
    }
}

/// 文字描述（Java `describe` 口径：`全部会员` / 分段 `；` 连接）。
#[must_use]
pub fn describe_text(audience: &Audience, ranks: &[String], tags: &[String]) -> String {
    match audience {
        Audience::All => ALL_MEMBERS_TEXT.to_string(),
        Audience::Ranks(ids) => {
            if ranks.is_empty() {
                format!("会员等级：{} 个等级", ids.len())
            } else {
                format!("会员等级：{}", ranks.join("、"))
            }
        }
        Audience::Tags { tag_ids, match_all } => {
            let mode = if *match_all { "全部" } else { "任一" };
            if tags.is_empty() {
                format!("标签（{mode}）：{} 个标签", tag_ids.len())
            } else {
                format!("标签（{mode}）：{}", tags.join("、"))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_defaults_to_all() {
        assert_eq!(
            resolve(&MemberAudienceDTO::default()).unwrap(),
            Audience::All
        );
        let dto = MemberAudienceDTO {
            audience_type: Some(TYPE_ALL),
            ..Default::default()
        };
        assert_eq!(resolve(&dto).unwrap(), Audience::All);
    }

    #[test]
    fn missing_selection_errors() {
        let err = resolve(&MemberAudienceDTO {
            audience_type: Some(TYPE_RANK),
            ..Default::default()
        })
        .unwrap_err();
        assert!(err.to_string().contains("请选择会员"));
        let err = resolve(&MemberAudienceDTO {
            audience_type: Some(TYPE_TAG),
            rank_ids: Some(vec![1]),
            ..Default::default()
        })
        .unwrap_err();
        assert!(err.to_string().contains("请选择会员"));
    }

    #[test]
    fn resolve_rank_and_tag() {
        let dto = MemberAudienceDTO {
            audience_type: Some(TYPE_RANK),
            rank_ids: Some(vec![1, 2]),
            ..Default::default()
        };
        assert_eq!(resolve(&dto).unwrap(), Audience::Ranks(vec![1, 2]));
        let dto = MemberAudienceDTO {
            audience_type: Some(TYPE_TAG),
            tag_ids: Some(vec![7]),
            tag_match_mode: Some(MATCH_ALL),
            ..Default::default()
        };
        assert_eq!(
            resolve(&dto).unwrap(),
            Audience::Tags {
                tag_ids: vec![7],
                match_all: true
            }
        );
    }

    #[test]
    fn describe_matches_java_phrasing() {
        assert_eq!(describe_text(&Audience::All, &[], &[]), "全部会员");
        assert_eq!(
            describe_text(
                &Audience::Ranks(vec![1, 2]),
                &["VIP1".into(), "VIP2".into()],
                &[]
            ),
            "会员等级：VIP1、VIP2"
        );
        assert_eq!(
            describe_text(
                &Audience::Tags {
                    tag_ids: vec![1, 2],
                    match_all: true
                },
                &[],
                &["高活跃".into()]
            ),
            "标签（全部）：高活跃"
        );
        // 名称缺失时退化为数量描述
        assert_eq!(
            describe_text(&Audience::Ranks(vec![1]), &[], &[]),
            "会员等级：1 个等级"
        );
    }
}
