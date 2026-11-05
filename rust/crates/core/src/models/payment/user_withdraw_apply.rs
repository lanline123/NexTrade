//! 提现申请域（payment::user_withdraw_apply）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.finance.UserWithdrawApplyController`（7 端点）
//! - `com.tigshop.service.finance.impl.UserWithdrawApplyServiceImpl`（admin 部分）
//! - `com.tigshop.bean.dto.finance.{UserWithdrawApplyListDTO,
//!   UserWithdrawApplyCreateDTO, UserWithdrawApplyCreateAccountDataDTO,
//!   UserWithdrawApplyUpdateDTO}`
//! - `com.tigshop.bean.vo.finance.UserWithdrawApplyVO`
//! - `com.tigshop.bean.enums.finance.UserWithDrawApplyStatus`
//! - `com.tigshop.common.constant.finance.UserWithdrawApplyConstants`
//!
//! 表 `user_withdraw_apply`（9 列，主键 `id`）；`wallet_type` 0 余额 / 1 佣金。
//! 状态：0 待处理 / 1 已完成 / 2 拒绝申请。
//!
//! # 关键语义
//!
//! - `update`：旧状态必须 `<= 0`，否则「该笔提现申请已完成，不能修改」；
//!   置 1 ⇒ 扣减冻结；置其它 ⇒ 返还可用余额 + 扣减冻结（`wallet_type` 决定
//!   余额还是佣金账户）。
//! - `del` / `batch(del)`：包含待处理（status=0）申请时拒绝
//!   「待处理的提现申请不允许删除」。
//! - `create`：`user.balance >= amount` 否则「提现金额大于账户的可用余额」；
//!   落库后 `incFrozenBalance` + `decBalance`（两条 `user_balance_log`）。
//! - `updateField` 白名单 `GENERAL_FIELDS`，本表仅 `status` 命中。
//!
//! # 偏差
//!
//! 1. `detail` 不存在 ID：Java NPE（500）；Rust 业务 500「提现申请不存在」。
//! 2. `create` 后发送后台消息「您有新的提现申请…」未迁移（admin msg 域未迁移）。
//! 3. `list.keyword`：Java 未命中用户时**不加过滤**（返回全量，属原实现缺陷）；
//!    Rust 为安全返回空页（记录为偏差）。
//! 4. `create.postscript` 的 `@Size` 因控制器无 `@Valid` 实际不生效（Rust 同）；
//!    `update.postscript` 生效（「管理员备注最多80个字符」）。
//! 5. `list/detail.addTime` 均为格式化字符串（Java `DateUtil.format`）。
//! 6. `@Sensitive(PHONE)` demo 脱敏未迁移；`handlingFee/handlingRate` Java 未赋值
//!    ⇒ 恒为 null。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::UserWithdrawApply;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// `user_withdraw_apply` 9 列（顺序与实体一致）。
pub const WITHDRAW_COLUMNS: [&str; 9] = [
    "id",
    "user_id",
    "wallet_type",
    "amount",
    "add_time",
    "finished_time",
    "postscript",
    "status",
    "account_data",
];

/// 主键列。
pub const KEY_COLUMN: &str = "id";
/// 主键属性名。
pub const KEY_PROPERTY: &str = "id";

/// 状态：待处理。
pub const STATUS_WAIT: i32 = 0;
/// 状态：已完成。
pub const STATUS_FINISHED: i32 = 1;
/// 状态：拒绝申请。
pub const STATUS_REJECT: i32 = 2;

/// 钱包：余额。
pub const WALLET_BALANCE: i32 = 0;
/// 钱包：佣金。
pub const WALLET_COMMISSION: i32 = 1;

/// `updateField` 白名单。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 提现申请 id 不能为空（update `@NotNull`）。
pub const MSG_ID_REQUIRED_DTO: &str = "提现申请id不能为空";
/// 提现金额大于账户的可用余额。
pub const MSG_BALANCE_NOT_ENOUGH: &str = "提现金额大于账户的可用余额";
/// 用户不存在。
pub const MSG_USER_NOT_EXISTS: &str = "用户不存在";
/// 提现申请不存在。
pub const MSG_NOT_EXISTS: &str = "提现申请不存在";
/// 该笔提现申请已完成，不能修改。
pub const MSG_ALREADY_FINISHED: &str = "该笔提现申请已完成，不能修改";
/// 待处理的提现申请不允许删除。
pub const MSG_PENDING_DELETE: &str = "待处理的提现申请不允许删除";
/// 管理员备注最多80个字符（update `@Size`）。
pub const MSG_POSTSCRIPT_TOO_LONG: &str = "管理员备注最多80个字符";
/// id 不能为空。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 字段名不能为空。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// 值不能为空。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// 字段值有误。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// 创建时增加冻结余额备注。
pub const DESC_INC_FROZEN: &str = "增加冻结余额";
/// 创建时减少余额备注。
pub const DESC_DEC_BALANCE: &str = "减少余额";
/// 审核通过扣减冻结（余额）。
pub const DESC_DEC_FROZEN_BALANCE: &str = "提现审核通过扣减冻结余额";
/// 审核通过扣减冻结（佣金）。
pub const DESC_DEC_FROZEN_COMMISSION: &str = "佣金提现审核通过扣减冻结";
/// 拒绝返还余额（余额）。
pub const DESC_INC_BALANCE_REFUND: &str = "提现审核拒绝返回余额";
/// 拒绝扣减冻结（余额）。
pub const DESC_DEC_FROZEN_REFUND: &str = "提现审核拒绝扣减冻结余额";
/// 拒绝返还佣金。
pub const DESC_INC_COMMISSION_REFUND: &str = "佣金提现审核拒绝返回";
/// 拒绝扣减冻结佣金。
pub const DESC_DEC_FROZEN_COMMISSION_REFUND: &str = "佣金提现审核拒绝扣减冻结";

/// UTC+8 时区偏移秒数。
pub const TZ_OFFSET_SECONDS: i32 = 8 * 3600;

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 状态文案（Java `STATUS_TYPE`，未知 `""`）。
#[must_use]
pub fn status_type(status: i32) -> &'static str {
    match status {
        STATUS_WAIT => "待处理",
        STATUS_FINISHED => "已完成",
        STATUS_REJECT => "拒绝申请",
        _ => "",
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（UTC+8），`0` ⇒ `""`。
#[must_use]
pub fn format_time(secs: i32) -> String {
    if secs == 0 {
        return String::new();
    }
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::seconds(i64::from(TZ_OFFSET_SECONDS)))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 排序字段 → 列名（未知回退主键）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "userId" | "user_id" => "user_id",
        "walletType" | "wallet_type" => "wallet_type",
        "amount" => "amount",
        "addTime" | "add_time" => "add_time",
        "finishedTime" | "finished_time" => "finished_time",
        "postscript" => "postscript",
        "status" => "status",
        _ => KEY_COLUMN,
    }
}

/// ORDER BY（默认主键 DESC）。
#[must_use]
pub fn order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let field = sort_field.map(str::trim).unwrap_or("");
    let column = if field.is_empty() {
        KEY_COLUMN
    } else {
        map_order_column(field)
    };
    let dir = if sort_order
        .map(|s| s.trim().eq_ignore_ascii_case("asc"))
        .unwrap_or(false)
    {
        "ASC"
    } else {
        "DESC"
    };
    format!(" ORDER BY {column} {dir}")
}

/// `updateField` 字段归一 + 白名单判定（本表仅 `status`）。
#[must_use]
pub fn resolve_update_field(field: &str) -> Option<&'static str> {
    let column = map_order_column(field);
    if GENERAL_FIELDS.contains(&column) {
        Some(column)
    } else {
        None
    }
}

/// `(LIMIT, OFFSET)`。
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

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `UserWithdrawApplyListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserWithdrawApplyListQuery {
    /// 状态（Java `status != null && status > -1` 才过滤）
    pub status: Option<i32>,
    /// 钱包类型：0 余额 / 1 佣金
    pub wallet_type: Option<i32>,
    /// 关键字（用户名）
    pub keyword: Option<String>,
    /// 页码
    pub page: Option<i64>,
    /// 每页条数
    pub size: Option<i64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// 排序方向
    pub sort_order: Option<String>,
}

impl UserWithdrawApplyListQuery {
    /// 有效关键字（`StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// 状态过滤值（`> -1` 才生效）。
    #[must_use]
    pub fn effective_status(&self) -> Option<i32> {
        self.status.filter(|s| *s > -1)
    }

    /// `(LIMIT, OFFSET)`。
    #[must_use]
    pub fn limit_offset(&self) -> (i64, i64) {
        limit_offset(self.page, self.size)
    }

    /// ORDER BY。
    #[must_use]
    pub fn order_clause(&self) -> String {
        order_clause(self.sort_field.as_deref(), self.sort_order.as_deref())
    }
}

/// 提现账户信息（Java `UserWithdrawApplyCreateAccountDataDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WithdrawAccountData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_no: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_type: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bank_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<String>,
}

/// 创建入参（Java `UserWithdrawApplyCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserWithdrawApplyCreateDTO {
    pub user_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub add_time: Option<i32>,
    pub finished_time: Option<i32>,
    pub postscript: Option<String>,
    pub status: Option<i32>,
    pub account_data: Option<WithdrawAccountData>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserWithdrawApplyCreate {
    pub user_id: i32,
    pub amount: Decimal,
    pub finished_time: i32,
    pub postscript: String,
    pub account_data_json: String,
}

impl UserWithdrawApplyCreateDTO {
    /// 校验并序列化 `account_data`（Java `JSONUtil.toJsonStr`）。
    pub fn validate(&self) -> Result<UserWithdrawApplyCreate, String> {
        let user_id = self.user_id.unwrap_or(0);
        let amount = self.amount.unwrap_or(Decimal::ZERO);
        let account_data = self.account_data.clone().unwrap_or_default();
        let account_data_json =
            serde_json::to_string(&account_data).map_err(|e| format!("账户信息序列化失败: {e}"))?;
        Ok(UserWithdrawApplyCreate {
            user_id,
            amount,
            finished_time: self.finished_time.unwrap_or(0),
            postscript: self.postscript.clone().unwrap_or_default(),
            account_data_json,
        })
    }
}

/// 更新入参（Java `UserWithdrawApplyUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserWithdrawApplyUpdateDTO {
    pub id: Option<i32>,
    pub postscript: Option<String>,
    pub status: Option<i32>,
}

/// 校验后的更新参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserWithdrawApplyUpdate {
    pub id: i32,
    pub postscript: Option<String>,
    pub status: Option<i32>,
}

impl UserWithdrawApplyUpdateDTO {
    /// `@NotNull(id)` + `@Size(postscript, max=80)`。
    pub fn validate(&self) -> Result<UserWithdrawApplyUpdate, String> {
        let id = self.id.ok_or_else(|| MSG_ID_REQUIRED_DTO.to_string())?;
        if let Some(postscript) = self.postscript.as_deref() {
            if postscript.chars().count() > 80 {
                return Err(MSG_POSTSCRIPT_TOO_LONG.to_string());
            }
        }
        Ok(UserWithdrawApplyUpdate {
            id,
            postscript: self.postscript.clone(),
            status: self.status,
        })
    }
}

/// 删除入参（Java `OperateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    pub id: Option<i32>,
    pub admin_note: Option<String>,
    pub page_type: Option<i32>,
}

/// 字段更新入参（Java `UpdateFieldDTO`）。
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
pub struct WithdrawFieldUpdate {
    pub id: i32,
    pub column: &'static str,
    pub val: String,
}

impl UpdateFieldDTO {
    /// 校验（id/field/val 必填 + 白名单）。
    pub fn validate(&self) -> Result<WithdrawFieldUpdate, String> {
        let id = self.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
        let field = self
            .field
            .as_deref()
            .ok_or_else(|| MSG_FIELD_NAME_REQUIRED.to_string())?;
        let val = self
            .val
            .as_deref()
            .ok_or_else(|| MSG_FIELD_VALUE_REQUIRED.to_string())?;
        let column =
            resolve_update_field(field).ok_or_else(|| MSG_INVALID_FIELD_VALUE.to_string())?;
        Ok(WithdrawFieldUpdate {
            id,
            column,
            val: val.to_string(),
        })
    }
}

/// 批量操作入参（Java `BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub value: Option<i32>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 提现申请 VO（Java `UserWithdrawApplyVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserWithdrawApplyVO {
    pub id: i32,
    pub user_id: i32,
    pub wallet_type: i32,
    pub username: Option<String>,
    pub amount: Decimal,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    pub finished_time: i32,
    pub postscript: String,
    pub status: i32,
    pub status_type: String,
    /// Java `Object`：`account_data` 非空且非 `"[]"` 时解析为对象
    pub account_data: Option<WithdrawAccountData>,
    /// Java 未赋值 ⇒ null
    pub handling_fee: Option<Decimal>,
    /// Java 未赋值 ⇒ null
    pub handling_rate: Option<Decimal>,
}

/// 合并更新字段（Java `updateById` NOT_NULL 语义）。
#[must_use]
pub fn merge_withdraw_update(
    existing: &UserWithdrawApply,
    input: &UserWithdrawApplyUpdate,
    now: i32,
) -> UserWithdrawApply {
    let mut entity = existing.clone();
    entity.id = input.id;
    if let Some(postscript) = input.postscript.clone() {
        entity.postscript = postscript;
    }
    if let Some(status) = input.status {
        entity.status = status;
        if status == STATUS_FINISHED {
            entity.finished_time = now;
        }
    }
    entity
}

/// 解析 `account_data` JSON（Java `JSONUtil.toBean`，非空且非 `"[]"` 才解析）。
#[must_use]
pub fn parse_account_data(raw: &str) -> Option<WithdrawAccountData> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "[]" {
        return None;
    }
    serde_json::from_str::<WithdrawAccountData>(trimmed).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn existing() -> UserWithdrawApply {
        UserWithdrawApply {
            id: 9,
            user_id: 7,
            wallet_type: WALLET_BALANCE,
            amount: Decimal::new(10000, 2),
            add_time: 1_700_000_000,
            finished_time: 0,
            postscript: "旧备注".into(),
            status: STATUS_WAIT,
            account_data: r#"{"accountName":"张三","accountNo":"6222"}"#.into(),
        }
    }

    #[test]
    fn status_and_time_helpers() {
        assert_eq!(status_type(0), "待处理");
        assert_eq!(status_type(1), "已完成");
        assert_eq!(status_type(2), "拒绝申请");
        assert_eq!(status_type(9), "");
        assert_eq!(format_time(1_700_000_000), "2023-11-15 06:13:20");
        assert_eq!(format_time(0), "");
    }

    #[test]
    fn create_validation_and_account_json() {
        let mut dto = UserWithdrawApplyCreateDTO {
            user_id: Some(7),
            amount: Some(Decimal::new(100, 2)),
            finished_time: Some(5),
            postscript: Some("备注".into()),
            account_data: Some(WithdrawAccountData {
                account_name: Some("张三".into()),
                account_no: Some("6222".into()),
                account_type: Some(1),
                bank_name: Some("工行".into()),
                identity: None,
            }),
            ..Default::default()
        };
        let input = dto.validate().unwrap();
        assert_eq!(input.user_id, 7);
        assert_eq!(input.finished_time, 5);
        assert!(input.account_data_json.contains("accountName"));
        // 无 accountData ⇒ 默认空对象 JSON
        dto.account_data = None;
        let input = dto.validate().unwrap();
        assert_eq!(input.account_data_json, "{}");
    }

    #[test]
    fn update_validation_and_merge() {
        let dto = UserWithdrawApplyUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED_DTO);
        let long = "超".repeat(81);
        let dto = UserWithdrawApplyUpdateDTO {
            id: Some(9),
            postscript: Some(long),
            status: None,
        };
        assert_eq!(dto.validate().unwrap_err(), MSG_POSTSCRIPT_TOO_LONG);
        let dto = UserWithdrawApplyUpdateDTO {
            id: Some(9),
            postscript: Some("同意".into()),
            status: Some(STATUS_FINISHED),
        };
        let input = dto.validate().unwrap();
        let merged = merge_withdraw_update(&existing(), &input, 1_800_000_000);
        assert_eq!(merged.status, STATUS_FINISHED);
        assert_eq!(merged.postscript, "同意");
        assert_eq!(merged.finished_time, 1_800_000_000);
        assert_eq!(merged.amount, Decimal::new(10000, 2));
        // 拒绝不会修改 finished_time
        let input = UserWithdrawApplyUpdate {
            id: 9,
            postscript: None,
            status: Some(STATUS_REJECT),
        };
        let merged = merge_withdraw_update(&existing(), &input, 1_800_000_000);
        assert_eq!(merged.finished_time, 0);
        assert_eq!(merged.postscript, "旧备注");
    }

    #[test]
    fn account_data_parsing() {
        assert!(parse_account_data("[]").is_none());
        assert!(parse_account_data("  ").is_none());
        assert!(parse_account_data("not-json").is_none());
        let parsed = parse_account_data(r#"{"accountNo":"6222"}"#).unwrap();
        assert_eq!(parsed.account_no.as_deref(), Some("6222"));
    }

    #[test]
    fn field_update_whitelist_and_paging() {
        let dto = UpdateFieldDTO {
            id: Some(9),
            field: Some("status".into()),
            val: Some("1".into()),
        };
        assert_eq!(dto.validate().unwrap().column, "status");
        for field in ["amount", "id", "nope", "status "] {
            let dto = UpdateFieldDTO {
                id: Some(9),
                field: Some(field.into()),
                val: Some("1".into()),
            };
            assert_eq!(
                dto.validate().unwrap_err(),
                MSG_INVALID_FIELD_VALUE,
                "{field}"
            );
        }
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(2), Some(10)), (10, 10));
        assert_eq!(order_clause(None, None), " ORDER BY id DESC");
        assert_eq!(
            order_clause(Some("amount"), Some("asc")),
            " ORDER BY amount ASC"
        );
    }
}
