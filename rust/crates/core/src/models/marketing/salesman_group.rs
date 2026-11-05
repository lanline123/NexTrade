//! 分销员分组（marketing::salesman_group）DTO / VO / 纯逻辑。
//!
//! 对应原 Java `com.tigshop.adminapi.controller.salesman.SalesmanGroupController`
//! （`@RequestMapping("/adminapi/salesman/group")`，5 个端点）+
//! `SalesmanGroupServiceImpl` + `SalesmanGroupPageQuery` / `SalesmanGroupSaveParam`
//! / `SalesmanGroupEditParam` / `SalesmanGroupVO`。
//!
//! 表：`salesman_group`（`group_id` / `group_name` / `describe` / `add_time` /
//! `shop_id`，实体 `entities::SalesmanGroup`）。**无逻辑删除列**：`del` 为物理删除。
//!
//! # 端点（5）
//! `GET /adminapi/salesman/group/{list,detail}`、
//! `POST /adminapi/salesman/group/{create,update,del}`。
//!
//! # 错误文案（Java `GlobalException` 逐字）
//! - `未知的分销员分组`（update 目标不存在）
//! - `该分组下有分销员，无法删除`（del 前检查 `salesman.group_id`）
//! - `分组名称不能为空`（create/update 参数校验）

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// 错误文案（逐字照抄 Java）。
pub const MSG_GROUP_NOT_FOUND: &str = "未知的分销员分组";
pub const MSG_GROUP_IN_USE: &str = "该分组下有分销员，无法删除";
pub const MSG_GROUP_NAME_REQUIRED: &str = "分组名称不能为空";
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 分页默认值（Java `BasePage`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
pub const MAX_PAGE_SIZE: u64 = 100;

/// 分组列表查询（Java `SalesmanGroupPageQuery`，字段 `groupName`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupListQuery {
    pub group_name: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

/// 新增分组（Java `SalesmanGroupSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupSaveDTO {
    pub group_name: Option<String>,
    #[serde(rename = "describe")]
    pub describe: Option<String>,
}

/// 编辑分组（Java `SalesmanGroupEditParam`：groupId + 字段）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SalesmanGroupEditDTO {
    pub group_id: Option<i32>,
    pub group_name: Option<String>,
    #[serde(rename = "describe")]
    pub describe: Option<String>,
}

/// 单 ID 操作（Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作（Java `BatchDTO`）。
///
/// Java 来源：新版管理端前端 `view/admin/src/api/salesman/subgroup.ts#batchSubmit`
/// （body `{ type, ids }`；仅 `type = "del"` 生效）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: String,
}

/// 分组 VO（Java `SalesmanGroupVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesmanGroupVO {
    pub group_id: i32,
    pub group_name: Option<String>,
    #[serde(rename = "describe")]
    pub describe: Option<String>,
    pub shop_id: Option<i32>,
    pub add_time: String,
}

/// 金额占位（本域无金额列；保留以便测试断言统一类型）。
#[must_use]
pub fn zero_money() -> Decimal {
    Decimal::ZERO
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；0/None → 空串）。
#[must_use]
pub fn format_time(secs: Option<i32>) -> String {
    use chrono::TimeZone;
    let Some(secs) = secs else {
        return String::new();
    };
    if secs == 0 {
        return String::new();
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_default()
}

/// 分组名必填校验（Java `@NotBlank` 语义）。
///
/// # Errors
/// 空白 → `分组名称不能为空`。
pub fn validate_name(name: Option<&str>) -> std::result::Result<(), String> {
    match name.map(str::trim) {
        Some(v) if !v.is_empty() => Ok(()),
        _ => Err(MSG_GROUP_NAME_REQUIRED.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_and_messages_are_verbatim() {
        assert_eq!(
            validate_name(Some("  ")).unwrap_err(),
            MSG_GROUP_NAME_REQUIRED
        );
        assert!(validate_name(Some("一级")).is_ok());
        assert!(validate_name(None).is_err());
        assert_eq!(MSG_GROUP_NOT_FOUND, "未知的分销员分组");
        assert_eq!(MSG_GROUP_IN_USE, "该分组下有分销员，无法删除");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
    }

    #[test]
    fn time_format_matches_java() {
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_time(Some(0)), "");
        assert_eq!(format_time(None), "");
        assert_eq!(zero_money(), Decimal::ZERO);
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = SalesmanGroupVO {
            group_id: 4,
            group_name: Some("一级".into()),
            add_time: format_time(Some(1_700_000_000)),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["groupId"], 4);
        assert_eq!(json["groupName"], "一级");
        assert_eq!(json["addTime"], "2023-11-15 06:13:20");
    }
}
