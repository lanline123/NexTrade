//! 批发商等级域（wholesale::wholesaler_grade）DTO / VO / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.wholesale.WholesalerGradeController`
//!   （`@RequestMapping("/adminapi/wholesale/grade")`，4 个端点）
//! - `com.tigshop.service.wholesale.impl.WholesalerGradeServiceImpl`（189 行）
//! - `com.tigshop.bean.dto.wholesale.WholesalerGradeSaveDTO`
//! - `com.tigshop.bean.vo.wholesale.WholesalerGradeVO`
//!
//! # 端点（4 条）
//!
//! | method | path | 原 Java | 落点（services 层） |
//! |--------|------|---------|---------------------|
//! | `GET`  | `/adminapi/wholesale/grade/list` | `WholesalerGradeController.list` | `WholesalerGradeService::list` |
//! | `POST` | `/adminapi/wholesale/grade/save` | `WholesalerGradeController.save` | `WholesalerGradeService::save` |
//! | `POST` | `/adminapi/wholesale/grade/setStatus` | `WholesalerGradeController.setStatus` | `WholesalerGradeService::set_status` |
//! | `POST` | `/adminapi/wholesale/grade/delete` | `WholesalerGradeController.delete` | `WholesalerGradeService::delete` |
//!
//! # 语义（逐条对照 Java）
//!
//! - `list`：`status` 可选过滤；按 `sort_order ASC, grade_id ASC` 排序；
//!   `withUserCount=true`（默认）时回填已绑定客户数（`wholesaler.is_delete=0`
//!   口径，含禁用）；逐行回填 `isDefault`（= `config.wholesaleDefaultGradeId`）。
//! - `save`：等级名 trim 后必填、≤50 字；同名（`is_delete=0`，编辑时排除自身）
//!   → HTTP 409 `等级名已存在`；新增默认 `sort_order=50`、`status=1`、
//!   `remark=''`；编辑仅覆盖传入的 `sortOrder` / `remark`。
//! - `setStatus`：`status` 仅允许 0/1（否则 400）；等级不存在 → 5303。
//! - `delete`：软删（`is_delete=1`）；默认等级 → 5306；等级下仍有批发商
//!   （`wholesaler.is_delete=0`）→ 5305。
//!
//! # 金额
//!
//! 本域不涉及任何金额列，故无 `rust_decimal::Decimal`。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 业务错误码（Java `HttpStatus` 5300 段）
// ——————————————————————————————————————————————

/// Java `HttpStatus.BAD_REQUEST`。
pub const CODE_BAD_REQUEST: i32 = 400;
/// Java `HttpStatus.CONFLICT`（等级名重复用的是 HTTP 409）。
pub const CODE_CONFLICT: i32 = 409;
/// Java `HttpStatus.WHOLESALE_GRADE_NOT_FOUND`（5303）。
pub const CODE_GRADE_NOT_FOUND: i32 = 5303;
/// Java `HttpStatus.WHOLESALE_GRADE_DISABLED`（5304）。
pub const CODE_GRADE_DISABLED: i32 = 5304;
/// Java `HttpStatus.WHOLESALE_GRADE_HAS_BINDING`（5305）。
pub const CODE_GRADE_HAS_BINDING: i32 = 5305;
/// Java `HttpStatus.WHOLESALE_GRADE_CANNOT_DELETE`（5306）。
pub const CODE_GRADE_CANNOT_DELETE: i32 = 5306;

// ——————————————————————————————————————————————
// 文案（逐字符照抄 Java）
// ——————————————————————————————————————————————

/// Java `save`：等级名为空。
pub const MSG_GRADE_NAME_REQUIRED: &str = "等级名不能为空";
/// Java `save`：同名重复（HTTP 409）。
pub const MSG_GRADE_NAME_DUPLICATED: &str = "等级名已存在";
/// Java `@Size(min = 1, max = 50, message = "等级名称长度 1-50")`。
pub const MSG_GRADE_NAME_LENGTH: &str = "等级名称长度 1-50";
/// Java `@Size(max = 255, message = "备注长度不能超过255")`。
pub const MSG_REMARK_TOO_LONG: &str = "备注长度不能超过255";
/// Java `setStatus`：非法状态。
pub const MSG_STATUS_INVALID: &str = "status 必须为 0 或 1";
/// Java `getById` / `requireEnabled`：等级不存在。
pub const MSG_GRADE_NOT_FOUND: &str = "批发等级不存在";
/// Java `requireEnabled`：等级已禁用。
pub const MSG_GRADE_DISABLED: &str = "批发等级已禁用";
/// Java `delete`：默认等级保护。
pub const MSG_GRADE_CANNOT_DELETE: &str = "默认批发等级不可删除，请先在批发设置中更换默认等级";
/// Java `delete`：等级下仍有批发商。
pub const MSG_GRADE_HAS_BINDING: &str =
    "该等级下已有批发商用户。在删除该等级之前，必须先删除该等级下的所有批发商用户。";

/// 新增等级的默认排序值（Java `DEFAULT_SORT_ORDER = 50`）。
pub const DEFAULT_SORT_ORDER: i32 = 50;
/// 等级名最大长度（Java `@Size(max = 50)`）。
pub const GRADE_NAME_MAX_LEN: usize = 50;
/// 备注最大长度（Java `@Size(max = 255)`）。
pub const REMARK_MAX_LEN: usize = 255;

// ——————————————————————————————————————————————
// 查询参数 / 入参 / 出参
// ——————————————————————————————————————————————

/// 等级列表查询参数（Java `@RequestParam(required = false) Integer status` +
/// `@RequestParam(defaultValue = "true") boolean withUserCount`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerGradeListQuery {
    /// 状态筛选：0=禁用 1=启用；缺省不筛选
    pub status: Option<i32>,
    /// 是否回填已绑定客户数（Java 默认 `true`）
    pub with_user_count: Option<bool>,
}

impl WholesalerGradeListQuery {
    /// `withUserCount` 的最终取值（Java `defaultValue = "true"`）。
    #[must_use]
    pub fn with_user_count(&self) -> bool {
        self.with_user_count.unwrap_or(true)
    }
}

/// 等级新增/编辑入参（Java `WholesalerGradeSaveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerGradeSaveDTO {
    /// 不传 = 新增；`>0` = 编辑
    pub grade_id: Option<i32>,
    /// 等级名称（`@NotBlank` + `@Size(min=1,max=50)`）
    pub grade_name: Option<String>,
    /// 排序值（缺省 50）
    pub sort_order: Option<i32>,
    /// 备注（≤255）
    pub remark: Option<String>,
}

/// 等级 VO（Java `WholesalerGradeVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalerGradeVO {
    /// 等级 ID
    pub grade_id: i32,
    /// 等级名称
    pub grade_name: String,
    /// 状态：0=禁用 1=启用
    pub status: i32,
    /// 排序值（升序）
    pub sort_order: i32,
    /// 已绑定客户数（`withUserCount=false` 时仍返回 0，与 Java 一致）
    pub user_count: i32,
    /// 是否默认等级（= 批发设置 `wholesaleDefaultGradeId`）
    pub is_default: bool,
    /// 备注
    pub remark: String,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`（无值 null）
    pub add_time: Option<String>,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 等级名校验（Java `@NotBlank` + `@Size(1..=50)`）：返回 trim 后名称。
///
/// # Errors
/// 文案逐字符照抄 Java 注解。
pub fn validate_grade_name(raw: Option<&str>) -> std::result::Result<String, String> {
    let name = raw
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_GRADE_NAME_REQUIRED.to_string())?;
    if name.chars().count() > GRADE_NAME_MAX_LEN {
        return Err(MSG_GRADE_NAME_LENGTH.to_string());
    }
    Ok(name.to_string())
}

/// 备注校验（Java `@Size(max = 255)`）。
///
/// # Errors
/// 超长时返回 [`MSG_REMARK_TOO_LONG`]。
pub fn validate_remark(raw: Option<&str>) -> std::result::Result<(), String> {
    if let Some(remark) = raw {
        if remark.chars().count() > REMARK_MAX_LEN {
            return Err(MSG_REMARK_TOO_LONG.to_string());
        }
    }
    Ok(())
}

/// 状态校验（Java `setStatus`：仅允许 0/1）。
///
/// # Errors
/// 返回 [`MSG_STATUS_INVALID`]。
pub fn validate_status(status: Option<i32>) -> std::result::Result<i32, String> {
    match status {
        Some(v) if v == 0 || v == 1 => Ok(v),
        _ => Err(MSG_STATUS_INVALID.to_string()),
    }
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；Java `formatTime`：`null` / `0` → `null`）。
#[must_use]
pub fn format_time(secs: Option<i64>) -> Option<String> {
    use chrono::TimeZone;
    let secs = secs?;
    if secs == 0 {
        return None;
    }
    chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(secs, 0).single())
        .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 等级名校验文案逐字符对齐 Java 注解。
    #[test]
    fn grade_name_validation_messages_are_verbatim() {
        assert_eq!(
            validate_grade_name(None).unwrap_err(),
            MSG_GRADE_NAME_REQUIRED
        );
        assert_eq!(
            validate_grade_name(Some("   ")).unwrap_err(),
            MSG_GRADE_NAME_REQUIRED
        );
        assert_eq!(
            validate_grade_name(Some(" 一级批发商 ")).unwrap(),
            "一级批发商"
        );
        // 50 字合法（按字符数）
        assert!(validate_grade_name(Some(&"等".repeat(50))).is_ok());
        assert_eq!(
            validate_grade_name(Some(&"等".repeat(51))).unwrap_err(),
            MSG_GRADE_NAME_LENGTH
        );
    }

    /// 备注 / 状态校验。
    #[test]
    fn remark_and_status_validation() {
        assert!(validate_remark(None).is_ok());
        assert!(validate_remark(Some(&"备".repeat(255))).is_ok());
        assert_eq!(
            validate_remark(Some(&"备".repeat(256))).unwrap_err(),
            MSG_REMARK_TOO_LONG
        );

        assert_eq!(validate_status(Some(0)).unwrap(), 0);
        assert_eq!(validate_status(Some(1)).unwrap(), 1);
        assert_eq!(validate_status(Some(2)).unwrap_err(), MSG_STATUS_INVALID);
        assert_eq!(validate_status(None).unwrap_err(), MSG_STATUS_INVALID);
    }

    /// 时间格式化：null / 0 → null；正常值按东八区。
    #[test]
    fn format_time_matches_java() {
        assert_eq!(format_time(None), None);
        assert_eq!(format_time(Some(0)), None);
        assert_eq!(
            format_time(Some(1_700_000_000)).as_deref(),
            Some("2023-11-15 06:13:20")
        );
    }

    /// 查询参数 camelCase 解析与 `withUserCount` 缺省 true。
    #[test]
    fn list_query_defaults_with_user_count_true() {
        let q: WholesalerGradeListQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(q.status, None);
        assert!(q.with_user_count(), "Java defaultValue = true");
        let q2: WholesalerGradeListQuery =
            serde_json::from_str(r#"{"status":1,"withUserCount":false}"#).unwrap();
        assert_eq!(q2.status, Some(1));
        assert!(!q2.with_user_count());
    }

    /// VO 序列化 camelCase（isDefault / addTime 为 Java 字段名）。
    #[test]
    fn vo_serializes_camel_case() {
        let vo = WholesalerGradeVO {
            grade_id: 1,
            grade_name: "一级批发商".into(),
            status: 1,
            sort_order: 50,
            user_count: 3,
            is_default: true,
            remark: "默认等级".into(),
            add_time: Some("2026-06-02 10:00:00".into()),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["gradeId"], 1);
        assert_eq!(json["gradeName"], "一级批发商");
        assert_eq!(json["userCount"], 3);
        assert_eq!(json["isDefault"], true);
        assert_eq!(json["addTime"], "2026-06-02 10:00:00");
    }
}
