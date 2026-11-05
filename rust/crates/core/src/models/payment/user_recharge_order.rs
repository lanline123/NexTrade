//! 充值记录域（payment::user_recharge_order）DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.finance.UserRechargeOrderController`（7 端点）
//! - `com.tigshop.service.finance.impl.UserRechargeOrderServiceImpl`（admin 部分）
//! - `com.tigshop.bean.dto.finance.{UserRechargeOrderListDTO,
//!   UserRechargeOrderCreateDTO, UserRechargeOrderUpdateDTO}`
//! - `com.tigshop.bean.vo.finance.{UserRechargeOrderVO, UserRechargeOrderUserVO}`
//! - `com.tigshop.bean.enums.finance.UserRechargeOrderStatus`
//! - `com.tigshop.common.constant.finance.UserRechargeOrderConstants`
//!
//! 表 `user_recharge_order`（8 列，主键 `order_id`）。
//! 状态：0 待确认 / 1 已支付 / 2 无效（`STATUS_TYPE` 文案「待确认/已支付/无效」）。
//!
//! # 关键语义（对照 Java）
//!
//! - `list`：`status` 精确 + `keyword` 匹配 `user.username` **或** `user.nickname`；
//!   关键字命中为空直接返回空页；排序 `buildSortOrder`（默认主键 DESC）。
//! - `create`：`amount <= 0` ⇒「充值金额需要大于0」；`add_time` 强制当前秒；
//!   `paid_time/status/postscript` 为空时按库默认（0/0/''）。
//! - `update`：`status != 0` 且旧状态 `!= 0` ⇒「当前申请状态不允许修改」；
//!   置 1 时把 `amount + discount_money(>0 时)` 加到会员余额（`user_balance_log`
//!   `wallet_type=0`、`change_type=1`，备注「充值订单审核通过增加余额」）。
//! - `updateField` 白名单 `GENERAL_FIELDS`，本表仅 `status` 命中。
//! - `batch` 仅 `type="del"` 物理批量删除。
//!
//! # 偏差
//!
//! 1. `detail` 不存在 ID：Java `BeanUtils.copyProperties(null, vo)` 抛异常（500）；
//!    Rust 返回业务 500「充值记录不存在」。
//! 2. `detail.addTime`：Java 未格式化（Integer→String 直转），Rust 同口径返回
//!    **秒数文本**；`list.addTime` 才格式化为 `yyyy-MM-dd HH:mm:ss`。
//! 3. `update.status` 为 null：Java 拆箱 NPE；Rust 视为「不修改状态」（保留旧值）。
//! 4. `@Sensitive(PHONE)` demo 脱敏未迁移（手机号原样返回）。
//! 5. 列表 DTO 的 `userId` 字段在 Java 服务层未被使用（只按 status+keyword 过滤），
//!    Rust 同口径忽略（字段保留以兼容请求体）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::UserRechargeOrder;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// `user_recharge_order` 8 列（顺序与实体一致）。
pub const RECHARGE_COLUMNS: [&str; 8] = [
    "order_id",
    "user_id",
    "amount",
    "discount_money",
    "add_time",
    "paid_time",
    "postscript",
    "status",
];

/// 主键列。
pub const KEY_COLUMN: &str = "order_id";
/// 主键属性名。
pub const KEY_PROPERTY: &str = "orderId";

/// 状态：待确认。
pub const STATUS_WAIT: i32 = 0;
/// 状态：已支付。
pub const STATUS_SUCCESS: i32 = 1;
/// 状态：无效。
pub const STATUS_FAIL: i32 = 2;

/// `updateField` 白名单（`CheckFieldConstants.GENERAL_FIELDS`）。
pub const GENERAL_FIELDS: [&str; 3] = ["is_show", "sort_order", "status"];

/// 充值记录 id 不能为空（更新 DTO `@NotNull`）。
pub const MSG_ID_REQUIRED_DTO: &str = "充值记录id不能为空";
/// 充值金额需要大于0。
pub const MSG_AMOUNT_ERROR: &str = "充值金额需要大于0";
/// 当前申请状态不允许修改。
pub const MSG_STATUS_ERROR: &str = "当前申请状态不允许修改";
/// 充值记录不存在（本实现补充，见模块偏差 1）。
pub const MSG_NOT_EXISTS: &str = "充值记录不存在";
/// id 不能为空（`ResultTextConstants.ID_CANNOT_IS_NULL`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";
/// 字段名不能为空。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";
/// 值不能为空。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";
/// 字段值有误。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";
/// 余额账户钱包类型（`wallet_type = 0`）。
pub const WALLET_BALANCE: i32 = 0;
/// 增加类型（`change_type = 1`）。
pub const CHANGE_TYPE_INC: i32 = 1;
/// 审核通过入账备注（Java 原文）。
pub const DESC_RECHARGE_INC: &str = "充值订单审核通过增加余额";

/// UTC+8 时区偏移秒数。
pub const TZ_OFFSET_SECONDS: i32 = 8 * 3600;

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 状态文案（Java `STATUS_TYPE` 映射，未知 `""`）。
#[must_use]
pub fn status_type(status: i32) -> &'static str {
    match status {
        STATUS_WAIT => "待确认",
        STATUS_SUCCESS => "已支付",
        STATUS_FAIL => "无效",
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
        "orderId" | "order_id" => "order_id",
        "userId" | "user_id" => "user_id",
        "amount" => "amount",
        "discountMoney" | "discount_money" => "discount_money",
        "addTime" | "add_time" => "add_time",
        "paidTime" | "paid_time" => "paid_time",
        "postscript" => "postscript",
        "status" => "status",
        _ => KEY_COLUMN,
    }
}

/// ORDER BY（默认主键 DESC，Java `buildSortOrder` 口径）。
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

/// `(LIMIT, OFFSET)`（Java `BasePage` 口径：默认 15、上限 100）。
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

/// 校验创建金额（`amount <= 0` ⇒ 文案）。
pub fn validate_amount(amount: Decimal) -> Result<Decimal, String> {
    if amount <= Decimal::ZERO {
        Err(MSG_AMOUNT_ERROR.to_string())
    } else {
        Ok(amount)
    }
}

/// 校验状态变更（`new != 0 && old != 0` ⇒ 文案）。
pub fn validate_status_change(new_status: i32, old_status: i32) -> Result<(), String> {
    if new_status != 0 && old_status != 0 {
        Err(MSG_STATUS_ERROR.to_string())
    } else {
        Ok(())
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `UserRechargeOrderListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRechargeOrderListQuery {
    /// 状态：0 待确认 / 1 已支付 / 2 无效
    pub status: Option<i32>,
    /// 用户 ID（Java 服务层未使用，保留兼容）
    pub user_id: Option<i32>,
    /// 关键字（用户名 / 昵称，`BasePage.keyword`）
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

impl UserRechargeOrderListQuery {
    /// 有效关键字（`StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
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

/// 创建入参（Java `UserRechargeOrderCreateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRechargeOrderCreateDTO {
    pub user_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub add_time: Option<i32>,
    pub paid_time: Option<i32>,
    pub postscript: Option<String>,
    pub status: Option<i32>,
}

/// 校验后的创建参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserRechargeOrderCreate {
    pub user_id: i32,
    pub amount: Decimal,
    pub discount_money: Option<Decimal>,
    pub paid_time: Option<i32>,
    pub postscript: String,
    pub status: i32,
}

impl UserRechargeOrderCreateDTO {
    /// 校验（Java 仅校验 `amount > 0`；user_id 缺失按 0 落库，与 MP 一致）。
    pub fn validate(&self) -> Result<UserRechargeOrderCreate, String> {
        let amount = validate_amount(self.amount.unwrap_or(Decimal::ZERO))?;
        Ok(UserRechargeOrderCreate {
            user_id: self.user_id.unwrap_or(0),
            amount,
            discount_money: self.discount_money,
            paid_time: self.paid_time,
            postscript: self.postscript.clone().unwrap_or_default(),
            status: self.status.unwrap_or(0),
        })
    }
}

/// 更新入参（Java `UserRechargeOrderUpdateDTO`；主键字段名为 `orderId`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRechargeOrderUpdateDTO {
    pub order_id: Option<i32>,
    pub user_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub add_time: Option<i32>,
    pub paid_time: Option<i32>,
    pub postscript: Option<String>,
    pub status: Option<i32>,
}

/// 校验后的更新参数。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserRechargeOrderUpdate {
    pub order_id: i32,
    pub user_id: Option<i32>,
    pub amount: Option<Decimal>,
    pub discount_money: Option<Decimal>,
    pub add_time: Option<i32>,
    pub paid_time: Option<i32>,
    pub postscript: Option<String>,
    pub status: Option<i32>,
}

impl UserRechargeOrderUpdateDTO {
    /// `@NotNull(orderId)` 校验。
    pub fn validate(&self) -> Result<UserRechargeOrderUpdate, String> {
        let order_id = self
            .order_id
            .ok_or_else(|| MSG_ID_REQUIRED_DTO.to_string())?;
        if let Some(amount) = self.amount {
            validate_amount(amount)?;
        }
        Ok(UserRechargeOrderUpdate {
            order_id,
            user_id: self.user_id,
            amount: self.amount,
            discount_money: self.discount_money,
            add_time: self.add_time,
            paid_time: self.paid_time,
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
pub struct RechargeFieldUpdate {
    pub id: i32,
    pub column: &'static str,
    pub val: String,
}

impl UpdateFieldDTO {
    /// 校验（id/field/val 必填 + 白名单）。
    pub fn validate(&self) -> Result<RechargeFieldUpdate, String> {
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
        Ok(RechargeFieldUpdate {
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

/// 充值记录里的会员信息（Java `UserRechargeOrderUserVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRechargeOrderUserVO {
    pub user_id: i32,
    pub username: String,
    pub nickname: Option<String>,
    /// 手机号（Java `@Sensitive(PHONE)`，仅 demo 模式脱敏；本实现原样返回）
    pub mobile: String,
}

/// 充值记录 VO（Java `UserRechargeOrderVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRechargeOrderVO {
    pub order_id: i32,
    pub user_id: i32,
    pub username: Option<String>,
    pub user: Option<UserRechargeOrderUserVO>,
    pub amount: Decimal,
    pub discount_money: Option<Decimal>,
    /// `list` 为 `yyyy-MM-dd HH:mm:ss`；`detail` 为秒数文本（见模块偏差 2）
    pub add_time: String,
    pub paid_time: i32,
    pub postscript: String,
    pub status: i32,
    pub status_type: String,
}

/// 合并更新字段（Java `BeanUtils.copyProperties(dto, entity)` + `updateById`
/// 的 NOT_NULL 语义），返回待持久化实体。
#[must_use]
pub fn merge_recharge_update(
    existing: &UserRechargeOrder,
    input: &UserRechargeOrderUpdate,
) -> UserRechargeOrder {
    let mut entity = existing.clone();
    entity.order_id = input.order_id;
    if let Some(v) = input.user_id {
        entity.user_id = v;
    }
    if let Some(v) = input.amount {
        entity.amount = v;
    }
    if let Some(v) = input.discount_money {
        entity.discount_money = Some(v);
    }
    if let Some(v) = input.add_time {
        entity.add_time = v;
    }
    if let Some(v) = input.paid_time {
        entity.paid_time = v;
    }
    if let Some(v) = input.postscript.clone() {
        entity.postscript = v;
    }
    if let Some(v) = input.status {
        entity.status = v;
    }
    entity
}

/// 审核通过入账金额（`amount + discount_money(>0 时)`）。
#[must_use]
pub fn recharge_credit_amount(amount: Decimal, discount_money: Option<Decimal>) -> Decimal {
    match discount_money.filter(|v| *v > Decimal::ZERO) {
        Some(discount) => amount + discount,
        None => amount,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn existing() -> UserRechargeOrder {
        UserRechargeOrder {
            order_id: 5,
            user_id: 7,
            amount: Decimal::new(10000, 2),
            discount_money: Some(Decimal::new(1000, 2)),
            add_time: 1_700_000_000,
            paid_time: 0,
            postscript: "备注".into(),
            status: 0,
        }
    }

    #[test]
    fn status_texts_and_time_format() {
        assert_eq!(status_type(0), "待确认");
        assert_eq!(status_type(1), "已支付");
        assert_eq!(status_type(2), "无效");
        assert_eq!(status_type(9), "");
        assert_eq!(format_time(1_700_000_000), "2023-11-15 06:13:20");
        assert_eq!(format_time(0), "");
    }

    #[test]
    fn create_validation() {
        let mut dto = UserRechargeOrderCreateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_AMOUNT_ERROR);
        dto.amount = Some(Decimal::new(0, 2));
        assert_eq!(dto.validate().unwrap_err(), MSG_AMOUNT_ERROR);
        dto.amount = Some(Decimal::new(100, 2));
        dto.user_id = Some(3);
        let input = dto.validate().unwrap();
        assert_eq!(input.user_id, 3);
        assert_eq!(input.amount, Decimal::new(100, 2));
        assert_eq!(input.status, 0);
        assert_eq!(input.postscript, "");
        assert_eq!(input.paid_time, None);
    }

    #[test]
    fn update_validation_and_merge() {
        let mut dto = UserRechargeOrderUpdateDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED_DTO);
        dto.order_id = Some(5);
        dto.status = Some(1);
        let input = dto.validate().unwrap();
        let merged = merge_recharge_update(&existing(), &input);
        assert_eq!(merged.status, 1);
        assert_eq!(merged.amount, Decimal::new(10000, 2));
        assert_eq!(merged.postscript, "备注");
        assert_eq!(merged.order_id, 5);
        // 状态变更校验
        assert!(validate_status_change(1, 0).is_ok());
        assert_eq!(validate_status_change(1, 1).unwrap_err(), MSG_STATUS_ERROR);
        assert_eq!(validate_status_change(2, 1).unwrap_err(), MSG_STATUS_ERROR);
        assert!(validate_status_change(0, 1).is_ok());
    }

    #[test]
    fn credit_amount_includes_positive_discount_only() {
        assert_eq!(
            recharge_credit_amount(Decimal::new(10000, 2), Some(Decimal::new(500, 2))),
            Decimal::new(10500, 2)
        );
        assert_eq!(
            recharge_credit_amount(Decimal::new(10000, 2), Some(Decimal::new(0, 2))),
            Decimal::new(10000, 2)
        );
        assert_eq!(
            recharge_credit_amount(Decimal::new(10000, 2), None),
            Decimal::new(10000, 2)
        );
    }

    #[test]
    fn update_field_whitelist() {
        let mut dto = UpdateFieldDTO::default();
        assert_eq!(dto.validate().unwrap_err(), MSG_ID_REQUIRED);
        dto.id = Some(1);
        assert_eq!(dto.validate().unwrap_err(), MSG_FIELD_NAME_REQUIRED);
        dto.field = Some("status".into());
        assert_eq!(dto.validate().unwrap_err(), MSG_FIELD_VALUE_REQUIRED);
        dto.val = Some("1".into());
        assert_eq!(dto.validate().unwrap().column, "status");
        for field in ["amount", "orderId", "nope", "status "] {
            let dto = UpdateFieldDTO {
                id: Some(1),
                field: Some(field.into()),
                val: Some("1".into()),
            };
            assert_eq!(
                dto.validate().unwrap_err(),
                MSG_INVALID_FIELD_VALUE,
                "{field}"
            );
        }
    }

    #[test]
    fn paging_and_sort() {
        assert_eq!(limit_offset(None, None), (15, 0));
        assert_eq!(limit_offset(Some(3), Some(20)), (20, 40));
        assert_eq!(limit_offset(Some(1), Some(500)), (100, 0));
        assert_eq!(order_clause(None, None), " ORDER BY order_id DESC");
        assert_eq!(
            order_clause(Some("amount"), Some("asc")),
            " ORDER BY amount ASC"
        );
        assert_eq!(
            order_clause(Some("x; DROP TABLE user_recharge_order"), None),
            " ORDER BY order_id DESC"
        );
    }
}
