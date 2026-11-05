//! 批发商身份域（wholesale::wholesaler）DTO / VO / 查询参数 + 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.wholesale.WholesalerController`
//!   （`@RequestMapping("/adminapi/wholesale/wholesaler")`，8 个端点）
//! - `com.tigshop.service.wholesale.impl.WholesalerServiceImpl`（657 行）
//! - `com.tigshop.bean.query.wholesale.WholesalerPageQuery`
//! - `com.tigshop.bean.dto.user.UserListDTO`（可选会员分页查询，本文件取子集）
//! - `com.tigshop.bean.dto.wholesale.WholesalerAddDTO` / `WholesalerImportDTO`
//!   / `WholesalerRemoveByGradeDTO` / `WholesalerRemoveDTO`
//! - `com.tigshop.bean.vo.wholesale.WholesalerVO` /
//!   `WholesalerSelectableUserVO` / `WholesalerImportResultVO`
//! - `com.tigshop.bean.enums.user.FromTag`（注册渠道名）
//!
//! # 端点（8 条）
//!
//! | method | path | 原 Java |
//! |--------|------|---------|
//! | `GET`  | `/adminapi/wholesale/wholesaler/page` | `WholesalerController.page` |
//! | `GET`  | `/adminapi/wholesale/wholesaler/selectableUserPage` | `WholesalerController.selectableUserPage` |
//! | `POST` | `/adminapi/wholesale/wholesaler/add` | `WholesalerController.add` |
//! | `POST` | `/adminapi/wholesale/wholesaler/import` | `WholesalerController.importBatch` |
//! | `POST` | `/adminapi/wholesale/wholesaler/setStatus` | `WholesalerController.setStatus` |
//! | `POST` | `/adminapi/wholesale/wholesaler/changeGrade` | `WholesalerController.changeGrade` |
//! | `POST` | `/adminapi/wholesale/wholesaler/removeByGrade` | `WholesalerController.removeByGrade` |
//! | `POST` | `/adminapi/wholesale/wholesaler/remove` | `WholesalerController.remove` |
//!
//! # 与 Java 的差异（`uncertain_points`）
//!
//! 1. **Redis 缓存未迁移**：Java `isWholesaleBuyer` 走
//!    `wholesale:isBuyer:{userId}`（TTL 10 分钟）+ 写操作主动失效；C 端判定
//!    不在本任务 8 个管理端端点内，本域只保留写操作后的「无缓存」语义
//!    （读库即时生效）。
//! 2. **`selectableUserPage` 复用会员列表**：Java 复用 `UserService#list`
//!    （`UserListDTO` 全部条件）；本实现按 `keyword` / `fromTag` / `rankId`
//!    / `status` 子集过滤（分页口径一致），其余筛选（余额区间 / 积分区间 /
//!    标签）未迁移。
//! 3. **多租户**：Java `HeaderUtils.getShopId()`；Rust 由路由层传
//!    `shop_id`（平台=0），但 wholesaler 表检索未使用 shop 过滤（与 Java 一致）。
//! 4. **默认头像回填**：Java 读 `SettingsEnum.DEFAULT_AVATAR` 配置；本实现
//!    未迁移（`avatar` 为空串时原样返回）。
//!
//! # 时间
//!
//! Java `addTime` / `create_time` 均为 Unix 秒（`bigint`），VO 输出
//! `yyyy-MM-dd HH:mm:ss`（东八区）；查询入参时间串按同格式解析（失败忽略）。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 业务错误码（Java `HttpStatus` 5300 段）
// ——————————————————————————————————————————————

/// Java `HttpStatus.BAD_REQUEST`。
pub const CODE_BAD_REQUEST: i32 = 400;
/// Java `HttpStatus.NOT_FOUND`（批发商不存在）。
pub const CODE_NOT_FOUND: i32 = 404;
/// Java `HttpStatus.WHOLESALE_USER_NOT_FOUND`（5301）。
pub const CODE_USER_NOT_FOUND: i32 = 5301;
/// Java `HttpStatus.WHOLESALE_USER_ALREADY_EXISTS`（5302）。
pub const CODE_USER_ALREADY_EXISTS: i32 = 5302;
/// Java `HttpStatus.WHOLESALE_GRADE_NOT_FOUND`（5303）。
pub const CODE_GRADE_NOT_FOUND: i32 = 5303;
/// Java `HttpStatus.WHOLESALE_GRADE_DISABLED`（5304）。
pub const CODE_GRADE_DISABLED: i32 = 5304;
/// Java `HttpStatus.WHOLESALE_DEFAULT_GRADE_NOT_CONFIGURED`（5331）。
pub const CODE_DEFAULT_GRADE_NOT_CONFIGURED: i32 = 5331;

// ——————————————————————————————————————————————
// 文案（逐字符照抄 Java）
// ——————————————————————————————————————————————

/// Java `add`：用户不存在。
pub const MSG_USER_NOT_FOUND: &str = "用户不存在";
/// Java `add`：已是批发商。
pub const MSG_USER_ALREADY_EXISTS: &str = "该用户已是批发商";
/// Java `requireEnabled`：等级不存在。
pub const MSG_GRADE_NOT_FOUND: &str = "批发等级不存在";
/// Java `requireEnabled`：等级已禁用。
pub const MSG_GRADE_DISABLED: &str = "批发等级已禁用";
/// Java `importBatch`：默认等级未配置。
pub const MSG_DEFAULT_GRADE_NOT_CONFIGURED: &str = "未配置默认批发等级";
/// Java `importBatch`：自选会员为空的兜底。
pub const MSG_USER_IDS_REQUIRED: &str = "userIds 不能为空";
/// Java `setStatus` / `setStatus`：非法状态。
pub const MSG_STATUS_INVALID: &str = "status 必须为 0 或 1";
/// Java `setStatus` / `changeGrade`：批发商不存在。
pub const MSG_WHOLESALER_NOT_FOUND: &str = "批发商不存在";
/// Java `removeByGrade`：未指定任何目标。
pub const MSG_REMOVE_BY_GRADE_REQUIRED: &str = "请选择要移除的批发商或勾选全部";
/// Java `remove`：未指定任何目标。
pub const MSG_REMOVE_REQUIRED: &str = "请选择要移除的批发商";
/// Java `WholesalerAddDTO` `@NotNull(message = "userId 不能为空")`。
pub const MSG_USER_ID_REQUIRED: &str = "userId 不能为空";
/// Java `WholesalerAddDTO` `@NotNull(message = "gradeId 不能为空")`。
pub const MSG_GRADE_ID_REQUIRED: &str = "gradeId 不能为空";

/// 批发商来源：注册自动（Java `source=1`）。
pub const SOURCE_AUTO_REGISTER: i32 = 1;
/// 批发商来源：后台导入（Java `source=2`）。
pub const SOURCE_IMPORT: i32 = 2;
/// 批发商来源：手动添加（Java `source=3`）。
pub const SOURCE_MANUAL: i32 = 3;

/// 管理端分页缺省值（Java `WholesalerServiceImpl#page`：默认 20，上限 100）。
pub const DEFAULT_PAGE_SIZE: u64 = 20;
/// 管理端分页上限。
pub const MAX_PAGE_SIZE: u64 = 100;

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// 批发商分页查询参数（Java `WholesalerPageQuery`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerPageQuery {
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 20，上限 100（Java `size`）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 联合模糊：`username` / `mobile` / `email` / `nickname`
    pub keyword: Option<String>,
    /// 批发等级筛选
    pub grade_id: Option<i32>,
    /// 注册渠道筛选（`user.from_tag`）
    pub from_tag: Option<i32>,
    /// 批发商启停：0=禁用 1=启用
    pub status: Option<i32>,
    /// 批发商来源：1/2/3
    pub source: Option<i32>,
    /// 添加时间起 `yyyy-MM-dd HH:mm:ss`
    pub add_time_start: Option<String>,
    /// 添加时间止 `yyyy-MM-dd HH:mm:ss`
    pub add_time_end: Option<String>,
}

/// 「可选为批发商的会员」分页查询参数
/// （Java `UserListDTO` 的子集，见模块头差异第 2 条）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerSelectableUserQuery {
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数（`BasePage.size`，默认 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 关键词（用户名/手机号/邮箱/昵称）
    pub keyword: Option<String>,
    /// 注册渠道
    pub from_tag: Option<i32>,
    /// 会员等级
    pub rank_id: Option<i32>,
    /// 会员状态：1 正常 0 禁用
    pub status: Option<i32>,
}

// ——————————————————————————————————————————————
// 入参 / 出参
// ——————————————————————————————————————————————

/// 添加批发商入参（Java `WholesalerAddDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerAddDTO {
    /// 已存在的 user_id（必填）
    pub user_id: Option<i32>,
    /// 启用中的批发等级 ID（必填）
    pub grade_id: Option<i32>,
    /// 备注（≤255）
    pub remark: Option<String>,
}

/// 批量导入入参（Java `WholesalerImportDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerImportDTO {
    /// `true` = 导入全部启用会员
    pub import_all: Option<bool>,
    /// 自选会员 user_id 列表
    pub user_ids: Option<Vec<i32>>,
    /// 按会员等级导入的等级 ID 列表
    pub rank_ids: Option<Vec<i32>>,
    /// 统一批发等级 ID；不传则用配置的默认等级
    pub grade_id: Option<i32>,
    /// 已存在策略：`OVERWRITE_GRADE`（默认）/ `SKIP`
    pub exists_strategy: Option<String>,
}

/// 按等级移除批发商入参（Java `WholesalerRemoveByGradeDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerRemoveByGradeDTO {
    /// 批发等级 ID（必填）
    pub grade_id: Option<i32>,
    /// 指定要移除的批发商 ID（`removeAll=true` 时忽略）
    pub wholesaler_ids: Option<Vec<i32>>,
    /// 是否移除该等级下全部批发商（默认 false）
    pub remove_all: Option<bool>,
}

/// 按 ID 移除批发商入参（Java `WholesalerRemoveDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WholesalerRemoveDTO {
    /// 要移除的批发商 ID 列表（必填非空）
    pub wholesaler_ids: Option<Vec<i32>>,
}

/// 批发商列表项（Java `WholesalerVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalerVO {
    /// 批发商 ID
    pub wholesaler_id: i32,
    /// 关联 user_id
    pub user_id: i32,
    /// 用户名
    pub username: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 昵称
    pub nickname: Option<String>,
    /// 头像
    pub avatar: Option<String>,
    /// 会员等级 ID
    pub rank_id: Option<i32>,
    /// 会员等级名称
    pub rank_name: Option<String>,
    /// 是否企业认证：0 否 1 是
    pub is_company_auth: Option<i32>,
    /// 认证状态名（1→已认证 0→未认证）
    pub auth_status_name: String,
    /// 注册渠道
    pub from_tag: Option<i32>,
    /// 注册渠道名
    pub from_tag_name: String,
    /// 会员状态
    pub user_status: Option<i32>,
    /// 批发等级 ID
    pub grade_id: i32,
    /// 批发等级名称
    pub grade_name: Option<String>,
    /// 批发商启停：0 禁用 1 启用
    pub status: i32,
    /// 来源 1/2/3
    pub source: i32,
    /// 来源名
    pub source_name: String,
    /// 备注
    pub remark: String,
    /// 添加时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
}

/// 可选为批发商的会员 VO（Java `WholesalerSelectableUserVO extends UserDTO`，
/// 本实现保留会员常用字段子集）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalerSelectableUserVO {
    /// 会员 ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 昵称
    pub nickname: Option<String>,
    /// 手机号
    pub mobile: String,
    /// 邮箱
    pub email: String,
    /// 头像
    pub avatar: String,
    /// 会员等级 ID
    pub rank_id: i32,
    /// 注册渠道
    pub from_tag: i32,
    /// 注册渠道名
    pub from_tag_name: String,
    /// 会员状态
    pub status: Option<i32>,
    /// 是否已是批发商
    pub is_wholesaler: bool,
    /// 已是批发商时的等级 ID
    pub grade_id: Option<i32>,
    /// 已是批发商时的等级名称
    pub grade_name: Option<String>,
}

/// 批量导入结果（Java `WholesalerImportResultVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalerImportResultVO {
    /// 请求总数
    pub total_requested: i32,
    /// 成功数（含软删复活）
    pub success_count: i32,
    /// 跳过数（已是批发商）
    pub skipped_count: i32,
    /// 失败数
    pub failed_count: i32,
    /// 失败明细
    pub failed_details: Vec<WholesalerImportFailedItem>,
}

/// 导入失败明细项（Java `WholesalerImportResultVO.FailedItem`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WholesalerImportFailedItem {
    /// 用户 ID
    pub user_id: i32,
    /// 失败原因
    pub reason: String,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 批发商来源名（Java `WholesalerServiceImpl#sourceName`）。
#[must_use]
pub fn source_name(source: i32) -> &'static str {
    match source {
        SOURCE_AUTO_REGISTER => "注册自动",
        SOURCE_IMPORT => "后台导入",
        SOURCE_MANUAL => "手动添加",
        _ => "",
    }
}

/// 注册渠道名（Java `FromTag#getFromTagName`）。
#[must_use]
pub fn from_tag_name(from_tag: i32) -> &'static str {
    match from_tag {
        1 => "公众号",
        2 => "小程序",
        3 => "H5",
        4 => "PC",
        5 => "Android",
        6 => "IOS",
        7 => "Admin",
        8 => "APP",
        _ => "",
    }
}

/// 认证状态名（Java `isCompanyAuth == 1 ? "已认证" : "未认证"`）。
#[must_use]
pub fn auth_status_name(is_company_auth: i32) -> &'static str {
    if is_company_auth == 1 {
        "已认证"
    } else {
        "未认证"
    }
}

/// Unix 秒 → `yyyy-MM-dd HH:mm:ss`（东八区；`null` / `0` → `None`）。
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

/// `yyyy-MM-dd HH:mm:ss`（东八区）→ Unix 秒；空白 / 非法格式 → `None`。
#[must_use]
pub fn parse_time_to_unix(raw: Option<&str>) -> Option<i64> {
    use chrono::TimeZone;
    let text = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let dt = chrono::NaiveDateTime::parse_from_str(text, "%Y-%m-%d %H:%M:%S").ok()?;
    chrono::FixedOffset::east_opt(8 * 3600)?
        .from_local_datetime(&dt)
        .single()
        .map(|v| v.timestamp())
}

/// 校验添加批发商入参（Java `@Valid WholesalerAddDTO`）。
///
/// # Errors
/// 文案逐字符照抄 Java 注解。
pub fn validate_add(dto: &WholesalerAddDTO) -> std::result::Result<(), String> {
    if dto.user_id.is_none() {
        return Err(MSG_USER_ID_REQUIRED.to_string());
    }
    if dto.grade_id.is_none() {
        return Err(MSG_GRADE_ID_REQUIRED.to_string());
    }
    Ok(())
}

/// `existsStrategy` 是否为 `SKIP`（Java `"SKIP".equalsIgnoreCase(...)`）。
#[must_use]
pub fn is_skip_strategy(strategy: Option<&str>) -> bool {
    strategy.is_some_and(|s| s.eq_ignore_ascii_case("SKIP"))
}

/// 去重保序（Java `stream().filter(nonNull).distinct()`）。
#[must_use]
pub fn distinct_ids(ids: &[i32]) -> Vec<i32> {
    let mut seen = std::collections::HashSet::new();
    ids.iter().copied().filter(|id| seen.insert(*id)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 来源 / 渠道 / 认证文案逐字符对齐 Java。
    #[test]
    fn enum_names_match_java() {
        assert_eq!(source_name(1), "注册自动");
        assert_eq!(source_name(2), "后台导入");
        assert_eq!(source_name(3), "手动添加");
        assert_eq!(source_name(0), "");
        assert_eq!(source_name(9), "");

        assert_eq!(from_tag_name(1), "公众号");
        assert_eq!(from_tag_name(2), "小程序");
        assert_eq!(from_tag_name(3), "H5");
        assert_eq!(from_tag_name(4), "PC");
        assert_eq!(from_tag_name(5), "Android");
        assert_eq!(from_tag_name(6), "IOS");
        assert_eq!(from_tag_name(7), "Admin");
        assert_eq!(from_tag_name(8), "APP");
        assert_eq!(from_tag_name(99), "");

        assert_eq!(auth_status_name(1), "已认证");
        assert_eq!(auth_status_name(0), "未认证");
    }

    /// 时间解析 / 格式化（东八区，失败忽略）。
    #[test]
    fn time_parse_and_format() {
        let ts = parse_time_to_unix(Some("2023-11-15 06:13:20")).unwrap();
        assert_eq!(ts, 1_700_000_000);
        assert_eq!(
            format_time(Some(ts)).as_deref(),
            Some("2023-11-15 06:13:20")
        );
        assert_eq!(parse_time_to_unix(None), None);
        assert_eq!(parse_time_to_unix(Some("  ")), None);
        assert_eq!(parse_time_to_unix(Some("2023-11-15")), None);
        assert_eq!(format_time(None), None);
        assert_eq!(format_time(Some(0)), None);
    }

    /// 添加校验 / 策略判定 / 去重保序。
    #[test]
    fn validations_and_helpers() {
        let mut dto = WholesalerAddDTO::default();
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_USER_ID_REQUIRED);
        dto.user_id = Some(100);
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_GRADE_ID_REQUIRED);
        dto.grade_id = Some(1);
        assert!(validate_add(&dto).is_ok());

        assert!(is_skip_strategy(Some("SKIP")));
        assert!(is_skip_strategy(Some("skip")));
        assert!(!is_skip_strategy(Some("OVERWRITE_GRADE")));
        assert!(!is_skip_strategy(None));

        assert_eq!(distinct_ids(&[3, 1, 3, 2, 1]), vec![3, 1, 2]);
        assert!(distinct_ids(&[]).is_empty());
    }

    /// 查询参数 camelCase + `size` 别名。
    #[test]
    fn page_query_parses_camel_case() {
        let q: WholesalerPageQuery = serde_json::from_str(
            r#"{"page":2,"size":30,"keyword":"张","gradeId":1,"fromTag":2,
                "status":1,"source":3,"addTimeStart":"2026-01-01 00:00:00"}"#,
        )
        .unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.keyword.as_deref(), Some("张"));
        assert_eq!(q.grade_id, Some(1));
        assert_eq!(q.from_tag, Some(2));
        assert_eq!(q.source, Some(3));
        assert_eq!(q.add_time_start.as_deref(), Some("2026-01-01 00:00:00"));
    }

    /// VO 序列化字段名与 Java `WholesalerVO` 一致。
    #[test]
    fn vo_serializes_camel_case() {
        let vo = WholesalerVO {
            wholesaler_id: 5,
            user_id: 100,
            source: 3,
            source_name: source_name(3).into(),
            grade_id: 1,
            status: 1,
            from_tag_name: from_tag_name(1).into(),
            auth_status_name: auth_status_name(1).into(),
            add_time: Some("2026-06-02 10:00:00".into()),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["wholesalerId"], 5);
        assert_eq!(json["userId"], 100);
        assert_eq!(json["sourceName"], "手动添加");
        assert_eq!(json["gradeId"], 1);
        assert_eq!(json["fromTagName"], "公众号");
        assert_eq!(json["authStatusName"], "已认证");
        assert_eq!(json["addTime"], "2026-06-02 10:00:00");
    }
}
