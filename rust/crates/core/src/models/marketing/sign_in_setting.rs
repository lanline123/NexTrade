//! 积分签到配置域（marketing::sign_in_setting）DTO / VO / 纯函数。
//! Java `SignInSettingController`（7 端点）+ `SignInSettingServiceImpl`。
//! 表 `sign_in_setting`（6 列，主键 id）；`day_num` 由服务端按最大值 +1 生成。

use serde::{Deserialize, Serialize};

pub const COLUMNS: [&str; 6] = [
    "id",
    "name",
    "points",
    "day_num",
    "sort_order",
    "create_time",
];
pub const KEY_COLUMN: &str = "id";
pub const UPDATE_FIELDS: [&str; 1] = ["sort_order"];

/// Java `SignInSettingConstants` 原文（`{integral}` 占位符逐字保留）。
pub const MSG_NAME_REQUIRED: &str = "{integral}签到名称不能为空";
pub const MSG_NAME_TOO_LONG: &str = "{integral}签到名称长度不能超过30";
pub const MSG_ID_REQUIRED: &str = "{integral}签到id不能为空";
pub const MSG_POINTS_REQUIRED: &str = "赠送{integral}必须大于0";
pub const MSG_NOT_EXISTS: &str = "该设置不存在";

#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "name" => "name",
        "points" => "points",
        "dayNum" | "day_num" => "day_num",
        "sortOrder" | "sort_order" => "sort_order",
        "createTime" | "create_time" => "create_time",
        _ => KEY_COLUMN,
    }
}

#[must_use]
pub fn limit_offset(page: Option<i64>, size: Option<i64>) -> (i64, i64) {
    let page = page.unwrap_or(1).max(1);
    let size = match size {
        None => 15,
        Some(v) if v > 100 => 100,
        Some(v) if v < 1 => 1,
        Some(v) => v,
    };
    (size, (page - 1) * size)
}

/// `updateField` 白名单（Java `SIGN_IN_SETTING_FIELDS = {"sort_order"}`）。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    UPDATE_FIELDS.contains(&column).then_some(column)
}

/// ORDER BY（Java 默认 `sort_order ASC, create_time ASC, id ASC`；
/// 仅 `sortField=sortOrder&sortOrder=desc` 时降序）。
#[must_use]
pub fn order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let desc = sort_field.map(str::trim) == Some("sortOrder")
        && sort_order
            .map(|s| s.trim().eq_ignore_ascii_case("desc"))
            .unwrap_or(false);
    let dir = if desc { "DESC" } else { "ASC" };
    format!(" ORDER BY sort_order {dir}, create_time ASC, id ASC")
}

/// 列表查询（Java `SignInSettingListDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SignInSettingListQuery {
    pub name: Option<String>,
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub size: Option<i64>,
    pub sort_field: Option<String>,
    pub sort_order: Option<String>,
}

impl SignInSettingListQuery {
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.name
            .as_deref()
            .or(self.keyword.as_deref())
            .filter(|s| !s.is_empty())
    }
}

/// 兼容原版后台把数字字段作为字符串提交（`"10"`）。
fn de_opt_i32_lenient<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(match value {
        Some(serde_json::Value::Number(n)) => n.as_i64().and_then(|v| i32::try_from(v).ok()),
        Some(serde_json::Value::String(s)) => s.trim().parse::<i32>().ok(),
        _ => None,
    })
}

/// 创建入参（Java `SignInSettingCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SignInSettingCreateDTO {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub points: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub sort_order: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignInSettingCreate {
    pub name: String,
    pub points: i32,
    pub sort_order: Option<i32>,
}

impl SignInSettingCreateDTO {
    pub fn validate(&self) -> Result<SignInSettingCreate, String> {
        let name = self
            .name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| MSG_NAME_REQUIRED.to_string())?;
        if name.chars().count() > 30 {
            return Err(MSG_NAME_TOO_LONG.to_string());
        }
        let points = self.points.unwrap_or(0);
        if points < 1 {
            return Err(MSG_POINTS_REQUIRED.to_string());
        }
        if let Some(sort_order) = self.sort_order {
            if sort_order < 0 {
                return Err("排序不能小于0".to_string());
            }
        }
        Ok(SignInSettingCreate {
            name: name.to_string(),
            points,
            sort_order: self.sort_order,
        })
    }
}

/// 更新入参（Java `SignInSettingUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SignInSettingUpdateDTO {
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub id: Option<i32>,
    pub name: Option<String>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub points: Option<i32>,
    #[serde(default, deserialize_with = "de_opt_i32_lenient")]
    pub sort_order: Option<i32>,
}

/// 校验后的更新参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignInSettingUpdate {
    pub id: i32,
    pub name: String,
    pub points: i32,
    pub sort_order: Option<i32>,
}

impl SignInSettingUpdateDTO {
    pub fn validate(&self) -> Result<SignInSettingUpdate, String> {
        let id = self.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        let name = self
            .name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| MSG_NAME_REQUIRED.to_string())?;
        if name.chars().count() > 30 {
            return Err(MSG_NAME_TOO_LONG.to_string());
        }
        let points = self.points.unwrap_or(0);
        if points < 1 {
            return Err(MSG_POINTS_REQUIRED.to_string());
        }
        if let Some(sort_order) = self.sort_order {
            if sort_order < 0 {
                return Err("排序不能小于0".to_string());
            }
        }
        Ok(SignInSettingUpdate {
            id,
            name: name.to_string(),
            points,
            sort_order: self.sort_order,
        })
    }
}

/// 删除入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
    pub admin_note: Option<String>,
    pub page_type: Option<i32>,
}

impl OperateDTO {
    pub fn validate_id(&self) -> Result<i32, String> {
        self.id.ok_or_else(|| "id不能为空".to_string())
    }
}

/// 字段更新入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 校验后的字段更新。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldUpdate {
    pub id: i32,
    pub column: &'static str,
    pub val: String,
}

impl UpdateFieldDTO {
    pub fn validate(&self) -> Result<FieldUpdate, String> {
        let id = self.id.ok_or_else(|| "id不能为空".to_string())?;
        let field = self
            .field
            .as_deref()
            .ok_or_else(|| "字段名不能为空".to_string())?;
        let val = self
            .val
            .as_deref()
            .ok_or_else(|| "值不能为空".to_string())?;
        let column = resolve_update_field(field).ok_or_else(|| "field 的值有误".to_string())?;
        Ok(FieldUpdate {
            id,
            column,
            val: val.to_string(),
        })
    }
}

/// 批量入参。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

/// 签到配置 VO（Java `SignInSettingVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInSettingVO {
    pub id: i32,
    pub name: Option<String>,
    pub points: Option<i32>,
    pub day_num: Option<i32>,
    pub sort_order: i32,
    pub create_time: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_validation_messages() {
        let dto = SignInSettingCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_NAME_REQUIRED);
        let dto = SignInSettingCreateDTO {
            name: Some("x".repeat(31)),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_NAME_TOO_LONG);
        let dto = SignInSettingCreateDTO {
            name: Some("签到1".into()),
            points: Some(0),
            ..Default::default()
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_POINTS_REQUIRED);
        let dto = SignInSettingCreateDTO {
            name: Some("签到1".into()),
            points: Some(5),
            sort_order: Some(2),
        };
        let input = dto.validate().unwrap();
        assert_eq!(input.points, 5);
        assert_eq!(input.sort_order, Some(2));
    }

    #[test]
    fn update_validation_and_field_whitelist() {
        let dto = SignInSettingUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(resolve_update_field("sortOrder"), Some("sort_order"));
        assert_eq!(resolve_update_field("name"), None);
        let dto = UpdateFieldDTO {
            id: Some(1),
            field: Some("name".into()),
            val: Some("x".into()),
        };
        assert_eq!(dto.validate().unwrap_err(), "field 的值有误");
    }

    #[test]
    fn ordering_and_paging() {
        assert_eq!(
            order_clause(None, None),
            " ORDER BY sort_order ASC, create_time ASC, id ASC"
        );
        assert_eq!(
            order_clause(Some("sortOrder"), Some("desc")),
            " ORDER BY sort_order DESC, create_time ASC, id ASC"
        );
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(2), Some(10)), (10, 10));
    }
}
