//! 打印机管理域（logistics::print）DTO / VO / 查询参数 + 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.print.PrintController`
//!   （`@RequestMapping("/adminapi/print/print")`）
//! - `com.tigshop.service.print.impl.PrintServiceImpl`（600 行）
//! - `com.tigshop.service.print.impl.PrintRoutingServiceImpl#resolve`
//! - `com.tigshop.service.print.impl.PrintPosDeviceServiceImpl#bindingsByPrintIds`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#updateField`
//! - `com.tigshop.bean.param.print.PrintAddParam` / `PrintUpdateParam`
//! - `com.tigshop.bean.query.print.PrintPageQuery`（extends `BasePage`）
//! - `com.tigshop.bean.vo.print.PrintPageVO` / `PrintDetailVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `UpdateFieldDTO`
//! - `com.tigshop.bean.enums.print.PrintPlatformEnum` /
//!   `PrintStatusEnum` / `PrintPaperSizeEnum`
//! - `com.tigshop.common.utils.StringUtils#maskMiddleHalf`（详情脱敏）
//! - `com.tigshop.common.utils.TigUtils#handelTime`（VO 时间格式化）
//! - `com.tigshop.common.constant.CheckFieldConstants#PRINT_FIELDS`
//! - `com.tigshop.common.constant.ResultTextConstants#INVALID_FIELD_VALUE`
//!
//! # 端点（8 条，路径逐字符对齐 `docs/api-contract.json`）
//!
//! | method | path | 原 Java | 落点（services 层） |
//! |--------|------|---------|---------------------|
//! | `GET`  | `/adminapi/print/print/list` | `PrintController.list` | `PrintService::list` |
//! | `GET`  | `/adminapi/print/print/detail` | `PrintController.detail` | `PrintService::detail` |
//! | `POST` | `/adminapi/print/print/create` | `PrintController.create` | `PrintService::create` |
//! | `POST` | `/adminapi/print/print/update` | `PrintController.update` | `PrintService::update` |
//! | `POST` | `/adminapi/print/print/updateField` | `PrintController.updateField` | `PrintService::update_field` |
//! | `POST` | `/adminapi/print/print/del` | `PrintController.del` | `PrintService::delete` |
//! | `POST` | `/adminapi/print/print/hasEnabled` | `PrintController.hasEnabled` | `PrintService::has_enabled` |
//! | `GET`  | `/adminapi/print/print/devicePrinters` | `PrintController.devicePrinters` | `PrintService::device_printers` |
//!
//! # 表 / 列（权威来源 `java/database/pure.sql`）
//!
//! 用 `cd rust && python tools/schema_parser.py --table <表名>` 核对：
//! - `print`（17 列，主键 `print_id`）；
//! - `print_config`（7 列）：列表/详情回填 `paper_size`；
//! - `print_pos_device`（5 列）：回填 `device_code`。
//!
//! 列名清单复用 [`super::print_config`] 的常量（同一批表，避免两份定义漂移）。
//!
//! # 多租户（`shopId`）
//!
//! Java `PrintServiceImpl` 的每个读写入口都用 `getShopId()`
//! （`BaseServiceImpl` → `HeaderUtils.getShopId()`，由 `X-Admin-Type`
//! / `X-Shop-Id` 请求头解析，平台账号为 `0`）。Rust 侧鉴权中间件尚未签发
//! 店铺上下文，故 `shop_id` 作为**显式入参**由路由层传入，默认
//! [`super::print_config::DEFAULT_SHOP_ID`]（平台 `0`）——与同域
//! `print_config` 的既有约定一致，见 `uncertain_points`。
//!
//! # 金额
//!
//! 本域不涉及任何金额列，故无 `rust_decimal::Decimal`。

use serde::{Deserialize, Serialize};

use super::print_config::{paper_size_code, PAPER_SIZE_58};

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java / schema）
// ——————————————————————————————————————————————

/// 第三方平台：飞鹅云（Java `PrintPlatformEnum.FEIEYUN.getCode()`）。
pub const PLATFORM_FEIEYUN: i32 = 1;

/// 第三方平台：商米云（Java `PrintPlatformEnum.SUNMI.getCode()`）。
pub const PLATFORM_SUNMI: i32 = 2;

/// 打印机状态：启用（Java `PrintStatusEnum.ENABLED.getCode()`）。
pub const STATUS_ENABLED: i32 = 1;

/// 打印机状态：停用（Java `PrintStatusEnum.DISABLED.getCode()`）。
pub const STATUS_DISABLED: i32 = 2;

/// 语音播报开关默认值：开启（Java `create`：`voiceEnabled == null ? 1`）。
pub const VOICE_ENABLED_DEFAULT: i32 = 1;

/// 语音播报内容默认值：订单号+金额（Java `create`：`voiceContentType == null ? 0`）。
pub const VOICE_CONTENT_TYPE_DEFAULT: i32 = 0;

/// `updateField` 允许更新的列白名单
/// （Java `CheckFieldConstants.PRINT_FIELDS = {"status", "is_default"}`）。
pub const PRINT_FIELDS: [&str; 2] = ["status", "is_default"];

// ——————————————————————————————————————————————
// Java 常量文案（逐字符照抄）
// ——————————————————————————————————————————————

/// Java `PrintServiceImpl#detail/del`：`new GlobalException("打印机不存在")`。
pub const MSG_PRINTER_NOT_FOUND: &str = "打印机不存在";

/// Java `PrintAddParam.printName` / `PrintUpdateParam.printName` 上的
/// `@NotBlank(message = "打印机名称不能为空")`。
pub const MSG_PRINT_NAME_REQUIRED: &str = "打印机名称不能为空";

/// `@NotBlank(message = "第三方平台对接账号不能为空")`。
pub const MSG_THIRD_ACCOUNT_REQUIRED: &str = "第三方平台对接账号不能为空";

/// `@NotBlank(message = "第三方平台key不能为空")`。
pub const MSG_THIRD_KEY_REQUIRED: &str = "第三方平台key不能为空";

/// `@NotBlank(message = "打印机SN不能为空")`。
pub const MSG_PRINT_SN_REQUIRED: &str = "打印机SN不能为空";

/// `@NotNull(message = "订单支付自动打印不能为空")`。
pub const MSG_AUTO_PRINT_REQUIRED: &str = "订单支付自动打印不能为空";

/// `PrintUpdateParam.printId` 上的 `@NotNull(message = "打印机ID不能为空")`。
pub const MSG_PRINT_ID_REQUIRED: &str = "打印机ID不能为空";

/// `PrintUpdateParam.status` 上的 `@NotNull(message = "打印机状态")`
/// ——注意原文**没有**「不能为空」后缀，逐字符保留。
pub const MSG_PRINT_STATUS_REQUIRED: &str = "打印机状态";

/// `PrintController.detail` 的 `@NotNull(message = "id不能为空")`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// `OperateDTO.id` 的 `@NotNull(message = "id不能为空")`。
pub const MSG_OPERATE_ID_REQUIRED: &str = "id不能为空";

/// `UpdateFieldDTO.field` 的 `@NotNull(message = "字段名不能为空")`。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// `UpdateFieldDTO.val` 的 `@NotNull(message = "值不能为空")`。
pub const MSG_FIELD_VALUE_REQUIRED: &str = "值不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`：
/// `BaseServiceImpl#updateField` 字段不在白名单时抛出。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// Java `PrintPlatformEnum#getDescByCode` 的兜底文案。
pub const MSG_UNKNOWN_PLATFORM: &str = "未知平台";

/// Java `PrintStatusEnum#getDescByCode` / `PrintLogStatusEnum` 等的兜底文案。
pub const MSG_UNKNOWN: &str = "未知";

// ——————————————————————————————————————————————
// 枚举映射（Java 枚举 `getDescByCode` 的等价物）
// ——————————————————————————————————————————————

/// 第三方平台名称（Java `PrintPlatformEnum#getDescByCode`）：
/// `null` / 未知值 → [`MSG_UNKNOWN_PLATFORM`]。
#[must_use]
pub fn platform_desc(code: Option<i32>) -> &'static str {
    match code {
        Some(PLATFORM_FEIEYUN) => "飞鹅云",
        Some(PLATFORM_SUNMI) => "商米云",
        _ => MSG_UNKNOWN_PLATFORM,
    }
}

/// 打印机状态名称（Java `PrintStatusEnum#getDescByCode`）：
/// `null` / 未知值 → [`MSG_UNKNOWN`]。
#[must_use]
pub fn status_desc(code: Option<i32>) -> &'static str {
    match code {
        Some(STATUS_ENABLED) => "启用",
        Some(STATUS_DISABLED) => "停用",
        _ => MSG_UNKNOWN,
    }
}

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// 打印机列表查询参数
/// （Java `com.tigshop.bean.query.print.PrintPageQuery extends BasePage`）。
///
/// `BasePage` 提供 `page` / `size` / `sortField` / `sortOrder` / `keyword`；
/// 这里额外接受 `pageSize` 别名（旧前端两种写法都在用，见
/// `print_page_query_accepts_size_and_pagesize`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintPageQuery {
    /// 打印机名称（模糊）
    pub print_name: Option<String>,
    /// 打印机 SN（模糊）
    pub print_sn: Option<String>,
    /// 状态 1 启用 2 停用
    pub status: Option<i32>,
    /// 第三方平台 1 飞鹅云 2 商米云
    pub platform: Option<i32>,
    /// 按收银台设备码筛选（对应 `print_pos_device.device_code` 子查询）
    pub device_code: Option<String>,
    /// 关键词（打印机名称 / 打印机编号，OR 模糊）
    pub keyword: Option<String>,
    /// 页码，缺省 1
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（Java 实体属性名或数据库列名，未知回退主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序）
    pub sort_order: Option<String>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 新增打印机请求（Java `com.tigshop.bean.param.print.PrintAddParam`）。
///
/// Java 校验注解：`printName` / `thirdAccount` / `thirdKey` / `printSn`
/// 均为 `@NotBlank`，`autoPrint` 为 `@NotNull`；其余字段可缺省。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintAddDTO {
    /// 打印机名称（必填）
    pub print_name: Option<String>,
    /// 第三方平台对接账号（必填）
    pub third_account: Option<String>,
    /// 第三方平台 key（必填）
    pub third_key: Option<String>,
    /// 打印机 SN（必填）
    pub print_sn: Option<String>,
    /// 打印机 Key（飞鹅云必填，商米云无此概念）
    pub print_key: Option<String>,
    /// 订单支付自动打印 1 开启 2 关闭（必填）
    pub auto_print: Option<i32>,
    /// 第三方平台 1 飞鹅云 2 商米云（缺省飞鹅云）
    pub platform: Option<i32>,
    /// 纸张尺寸 58 / 80（缺省 58）
    pub paper_size: Option<i32>,
    /// 启用状态 1 启用 2 禁用（缺省禁用）
    pub status: Option<i32>,
    /// 语音播报开关 1 开启 2 关闭（缺省 1）
    pub voice_enabled: Option<i32>,
    /// 语音播报内容 0 订单号+金额 1 仅金额（缺省 0）
    pub voice_content_type: Option<i32>,
    /// 绑定的收银台设备码
    pub device_code: Option<String>,
    /// 是否店铺默认打印机 1 是 0 否
    pub is_default: Option<i32>,
}

/// 编辑打印机请求（Java `com.tigshop.bean.param.print.PrintUpdateParam`）。
///
/// 与 [`PrintAddDTO`] 的差异（逐条对照 Java）：
/// - 多 `printId`（`@NotNull`）；
/// - `status` 变为**必填**（`@NotNull(message = "打印机状态")`）；
/// - 没有 `shopId`：店铺归属不随编辑变化。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintUpdateDTO {
    /// 打印机 ID（必填）
    pub print_id: Option<i32>,
    /// 打印机名称（必填）
    pub print_name: Option<String>,
    /// 第三方平台对接账号（必填）
    pub third_account: Option<String>,
    /// 第三方平台 key（必填）
    pub third_key: Option<String>,
    /// 打印机 SN（必填；前端可能回传脱敏后的 `*` 串）
    pub print_sn: Option<String>,
    /// 打印机 Key（前端可能回传脱敏后的 `*` 串）
    pub print_key: Option<String>,
    /// 打印机状态 1 开启 2 关闭（必填）
    pub status: Option<i32>,
    /// 订单支付自动打印 1 开启 2 关闭（必填）
    pub auto_print: Option<i32>,
    /// 第三方平台（Java `update` 不落库该列，仅历史兼容）
    pub platform: Option<i32>,
    /// 纸张尺寸 58 / 80（传值才同步到 `print_config`）
    pub paper_size: Option<i32>,
    /// 语音播报开关（传值才覆盖）
    pub voice_enabled: Option<i32>,
    /// 语音播报内容（传值才覆盖）
    pub voice_content_type: Option<i32>,
    /// 绑定的收银台设备码（`Some("")` 表示解绑）
    pub device_code: Option<String>,
    /// 是否店铺默认打印机 1 是 0 否（传值才覆盖）
    pub is_default: Option<i32>,
}

/// 单 ID 操作请求（Java `com.tigshop.bean.dto.common.OperateDTO`）。
///
/// Java 还有 `adminNote` / `pageType` 两个未使用字段；serde 默认忽略
/// 未知字段，前端多传不会报错。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（必填）
    pub id: Option<i32>,
}

/// 字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 字段名（必填；驼峰属性名或数据库列名）
    pub field: Option<String>,
    /// 值（必填；按字符串传入，由 MySQL 按列类型转换）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 打印机列表行（Java `com.tigshop.bean.vo.print.PrintPageVO`）。
///
/// `paperSize` / `paperSizeDesc` 仅列表接口从 `print_config` 回填；
/// `devicePrinters` 接口**不填**（Java 同一 VO 的两条构造路径），
/// 故两者是 `Option`，缺省序列化为 `null`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintVO {
    /// 打印机 ID
    pub print_id: i32,
    /// 打印机名称
    pub print_name: Option<String>,
    /// 打印机 SN（列表**不脱敏**，与 Java 一致）
    pub print_sn: Option<String>,
    /// 第三方平台 1 飞鹅云 2 商米云
    pub platform: Option<i32>,
    /// 平台名称（展示用）
    pub platform_text: String,
    /// 状态 1 启用 2 停用
    pub status: Option<i32>,
    /// 状态文本
    pub status_text: String,
    /// 纸张尺寸（58 / 80；`devicePrinters` 不返回）
    pub paper_size: Option<i32>,
    /// 纸张尺寸描述（58mm / 80mm；`devicePrinters` 不返回）
    pub paper_size_desc: Option<String>,
    /// 语音播报开关：`null` 兜底 1（开启）
    pub voice_enabled: i32,
    /// 语音播报内容：`null` 兜底 0（订单号+金额）
    pub voice_content_type: i32,
    /// 绑定的收银台设备码
    pub device_code: Option<String>,
    /// 是否为店铺默认打印机：`null` 兜底 0
    pub is_default: i32,
    /// 更新时间（`yyyy-MM-dd HH:mm:ss`，无值空串）
    pub update_time: String,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，无值空串）
    pub add_time: String,
}

/// 打印机详情（Java `com.tigshop.bean.vo.print.PrintDetailVO`）。
///
/// `printSn` / `printKey` / `thirdKey` 在 Java 里经
/// `StringUtils#maskMiddleHalf` 脱敏后返回；`thirdAccount` 明文。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintDetailVO {
    /// 打印机 ID
    pub print_id: i32,
    /// 打印机名称
    pub print_name: Option<String>,
    /// 打印机 SN（中间一半被 `*` 遮挡）
    pub print_sn: Option<String>,
    /// 打印机 Key（中间一半被 `*` 遮挡）
    pub print_key: Option<String>,
    /// 第三方平台对接账号（明文）
    pub third_account: Option<String>,
    /// 第三方平台 key（中间一半被 `*` 遮挡）
    pub third_key: Option<String>,
    /// 打印联数
    pub print_number: Option<i32>,
    /// 第三方平台 1 飞鹅云 2 商米云
    pub platform: Option<i32>,
    /// 平台名称（展示用）
    pub platform_text: String,
    /// 状态 1 启用 2 停用
    pub status: Option<i32>,
    /// 下单自动打印 1 开启 2 关闭
    pub auto_print: Option<i32>,
    /// 状态文本
    pub status_text: String,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 纸张尺寸（历史数据兜底 58）
    pub paper_size: i32,
    /// 纸张尺寸描述
    pub paper_size_desc: String,
    /// 语音播报开关：`null` 兜底 1
    pub voice_enabled: i32,
    /// 绑定的收银台设备码
    pub device_code: Option<String>,
    /// 是否为店铺默认打印机：`null` 兜底 0
    pub is_default: i32,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`，无值空串）
    pub add_time: String,
    /// 更新时间（`yyyy-MM-dd HH:mm:ss`，无值空串）
    pub update_time: String,
}

// ——————————————————————————————————————————————
// 纯函数（可在无 DB 情况下单测）
// ——————————————————————————————————————————————

/// 中间一半字符替换为 `*`（Java `StringUtils#maskMiddleHalf`）。
///
/// 逐分支照抄：
/// - `None` → `None`
/// - 空白串或长度 < 2 → 全 `*`（长度不变）
/// - 否则 `half = len / 2`，`start = (len - half) / 2`，把
///   `[start, start + half)` 区间替换为同长度 `*`
///
/// Java 的 `String.length()` 是 UTF-16 code unit；本实现按 `char` 计数。
/// 打印机 SN / Key 均为 ASCII，两种口径等价（已在单测覆盖典型长度）。
#[must_use]
pub fn mask_middle_half(raw: Option<&str>) -> Option<String> {
    let s = raw?;
    let chars: Vec<char> = s.chars().collect();
    let len = chars.len();
    if s.trim().is_empty() || len < 2 {
        return Some("*".repeat(len));
    }
    let half = len / 2;
    let start = (len - half) / 2;
    let end = start + half;
    let mut out = String::with_capacity(len);
    for (idx, ch) in chars.iter().enumerate() {
        if idx >= start && idx < end {
            out.push('*');
        } else {
            out.push(*ch);
        }
    }
    Some(out)
}

/// 脱敏回填解析（Java `PrintServiceImpl#update` 的 `dbMaskAfterXxx` 三段比较）。
///
/// 前端把详情接口拿到的**脱敏值**原样回传（`12*****890`），此时必须沿用
/// 数据库中的真实值；只有与脱敏值不一致才视为「用户改了」。
///
/// Java 逐行等价：
/// ```text
/// String dbMask = maskMiddleHalf(old);
/// if (Objects.equals(dbMask, incoming)) incoming = old;   // 前端是 *，用 DB 值
/// ```
///
/// `None` 语义：前端未传（`null`）且 DB 无值 → `None`；DB 有值时，
/// 脱敏值必非 `None`，因此未传会落「不等」分支 → `None`（Java 里
/// `updateById` 的 NOT_NULL 策略会让该列保持不变，服务层随后再回落
/// 到旧值，见 [`pick_secret_for_update`]）。
#[must_use]
pub fn resolve_secret(db_value: Option<&str>, incoming: Option<&str>) -> Option<String> {
    let masked = mask_middle_half(db_value);
    if masked.as_deref() == incoming {
        db_value.map(str::to_string)
    } else {
        incoming.map(str::to_string)
    }
}

/// 编辑时某一密钥列的最终落库值（对齐 MyBatis-Plus `FieldStrategy.NOT_NULL`）。
///
/// 1. 前端传了值且与脱敏值不同 → 用前端值；
/// 2. 前端传了值与脱敏值相同（未改）→ 用 DB 值；
/// 3. 前端 `None` → 保留 DB 原值（`updateById` 不写 `null` 列）。
#[must_use]
pub fn pick_secret_for_update(db_value: Option<&str>, incoming: Option<&str>) -> Option<String> {
    resolve_secret(db_value, incoming).or_else(|| db_value.map(str::to_string))
}

/// 纸张尺寸归一（Java `PrintPaperSizeEnum#of`）：`null` / `0` / 未知 → 58。
#[must_use]
pub fn normalize_paper_size(raw: Option<i32>) -> i32 {
    paper_size_code(raw.unwrap_or(PAPER_SIZE_58))
}

/// 平台归一（Java `create` 的分发逻辑）：
/// 只有显式 `2`（商米云）走商米分支，其余（含 `null`）一律飞鹅云 `1`。
#[must_use]
pub fn normalize_platform(raw: Option<i32>) -> i32 {
    match raw {
        Some(PLATFORM_SUNMI) => PLATFORM_SUNMI,
        _ => PLATFORM_FEIEYUN,
    }
}

/// 新增时的状态取值（Java：`status == null ? DISABLED : status`）。
#[must_use]
pub fn status_or_disabled(raw: Option<i32>) -> i32 {
    raw.unwrap_or(STATUS_DISABLED)
}

/// 语音播报开关（Java：`voiceEnabled == null ? 1 : voiceEnabled`）。
#[must_use]
pub fn voice_enabled_or_default(raw: Option<i32>) -> i32 {
    raw.unwrap_or(VOICE_ENABLED_DEFAULT)
}

/// 语音播报内容（Java：`voiceContentType == null ? 0 : voiceContentType`）。
#[must_use]
pub fn voice_content_type_or_default(raw: Option<i32>) -> i32 {
    raw.unwrap_or(VOICE_CONTENT_TYPE_DEFAULT)
}

/// 默认打印机标记（Java：`Integer.valueOf(1).equals(v) ? 1 : 0`）。
#[must_use]
pub fn is_default_flag(raw: Option<i32>) -> i32 {
    if raw == Some(1) {
        1
    } else {
        0
    }
}

/// 空白判定（对齐 Java `StrUtil.isBlank` / `StringUtils.isBlank`）。
#[must_use]
pub fn is_blank(raw: Option<&str>) -> bool {
    raw.map(str::trim).is_none_or(str::is_empty)
}

/// 新增入参校验（Java `@Valid PrintAddParam` 的等价物）。
///
/// 校验顺序与 Java 字段声明顺序一致：`printName` → `thirdAccount` →
/// `thirdKey` → `printSn` → `autoPrint`。
///
/// # Errors
/// 返回与 Java 注解 `message` **逐字符一致**的错误文案。
pub fn validate_add(dto: &PrintAddDTO) -> std::result::Result<(), String> {
    if is_blank(dto.print_name.as_deref()) {
        return Err(MSG_PRINT_NAME_REQUIRED.to_string());
    }
    if is_blank(dto.third_account.as_deref()) {
        return Err(MSG_THIRD_ACCOUNT_REQUIRED.to_string());
    }
    if is_blank(dto.third_key.as_deref()) {
        return Err(MSG_THIRD_KEY_REQUIRED.to_string());
    }
    if is_blank(dto.print_sn.as_deref()) {
        return Err(MSG_PRINT_SN_REQUIRED.to_string());
    }
    if dto.auto_print.is_none() {
        return Err(MSG_AUTO_PRINT_REQUIRED.to_string());
    }
    Ok(())
}

/// 编辑入参校验（Java `@Valid PrintUpdateParam` 的等价物）。
///
/// 校验顺序与 Java 字段声明顺序一致：`printId` → `printName` →
/// `thirdAccount` → `thirdKey` → `printSn` → `status` → `autoPrint`。
///
/// # Errors
/// 返回与 Java 注解 `message` **逐字符一致**的错误文案。
pub fn validate_update(dto: &PrintUpdateDTO) -> std::result::Result<(), String> {
    if dto.print_id.is_none() {
        return Err(MSG_PRINT_ID_REQUIRED.to_string());
    }
    if is_blank(dto.print_name.as_deref()) {
        return Err(MSG_PRINT_NAME_REQUIRED.to_string());
    }
    if is_blank(dto.third_account.as_deref()) {
        return Err(MSG_THIRD_ACCOUNT_REQUIRED.to_string());
    }
    if is_blank(dto.third_key.as_deref()) {
        return Err(MSG_THIRD_KEY_REQUIRED.to_string());
    }
    if is_blank(dto.print_sn.as_deref()) {
        return Err(MSG_PRINT_SN_REQUIRED.to_string());
    }
    if dto.status.is_none() {
        return Err(MSG_PRINT_STATUS_REQUIRED.to_string());
    }
    if dto.auto_print.is_none() {
        return Err(MSG_AUTO_PRINT_REQUIRED.to_string());
    }
    Ok(())
}

/// `updateField` 字段名归一（Java `getColumnByPropertyName` + `PRINT_FIELDS`）。
///
/// 与 Java 的差异：Java 未命中白名单时**先**把未知属性名回退成主键列，
/// 再因主键不在 `PRINT_FIELDS` 里抛 [`MSG_INVALID_FIELD_VALUE`]；本实现
/// 直接返回 `None` → 同样报 [`MSG_INVALID_FIELD_VALUE`]，对调用方等价。
#[must_use]
pub fn normalize_field(field: &str) -> Option<&'static str> {
    let snake = to_snake(field);
    PRINT_FIELDS.iter().copied().find(|f| *f == snake)
}

/// 驼峰 → 下划线（允许前端传驼峰属性名或数据库列名）。
#[must_use]
pub fn to_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for ch in s.chars() {
        if ch.is_ascii_uppercase() {
            out.push('_');
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————— 枚举文案 ————————

    #[test]
    fn platform_and_status_descriptions_match_java_enums() {
        assert_eq!(platform_desc(Some(PLATFORM_FEIEYUN)), "飞鹅云");
        assert_eq!(platform_desc(Some(PLATFORM_SUNMI)), "商米云");
        assert_eq!(platform_desc(None), MSG_UNKNOWN_PLATFORM);
        assert_eq!(platform_desc(Some(99)), MSG_UNKNOWN_PLATFORM);

        assert_eq!(status_desc(Some(STATUS_ENABLED)), "启用");
        assert_eq!(status_desc(Some(STATUS_DISABLED)), "停用");
        assert_eq!(status_desc(None), MSG_UNKNOWN);
        assert_eq!(status_desc(Some(0)), MSG_UNKNOWN);
    }

    // ———————— 脱敏 ————————

    #[test]
    fn mask_middle_half_matches_java_algorithm() {
        // len=10, half=5, start=2, end=7
        assert_eq!(
            mask_middle_half(Some("1234567890")).as_deref(),
            Some("12*****890")
        );
        // len=7, half=3, start=2, end=5
        assert_eq!(
            mask_middle_half(Some("1234567")).as_deref(),
            Some("12***67")
        );
        // len=2, half=1, start=0, end=1
        assert_eq!(mask_middle_half(Some("ab")).as_deref(), Some("*b"));
        // 长度 < 2 → 全 `*`（长度不变）
        assert_eq!(mask_middle_half(Some("a")).as_deref(), Some("*"));
        assert_eq!(mask_middle_half(Some("")).as_deref(), Some(""));
        // 空白串 → 同长度全 `*`（Java `isBlank` 分支优先于长度分支）
        assert_eq!(mask_middle_half(Some("   ")).as_deref(), Some("***"));
        // null → null
        assert_eq!(mask_middle_half(None), None);
    }

    #[test]
    fn mask_keeps_ascii_prefix_and_suffix() {
        // 打印机 SN 典型长度 12：half=6, start=3, end=9
        assert_eq!(
            mask_middle_half(Some("ABCDEFGHIJKL")).as_deref(),
            Some("ABC******JKL")
        );
    }

    #[test]
    fn resolve_secret_keeps_db_when_frontend_echoes_mask() {
        let db = Some("1234567890");
        // 前端回传脱敏值 → 用 DB 明文
        assert_eq!(
            resolve_secret(db, Some("12*****890")),
            Some("1234567890".to_string())
        );
        // 前端改了 → 用前端值
        assert_eq!(resolve_secret(db, Some("9999")), Some("9999".to_string()));
        // 前端未传 → None（随后由 pick_secret_for_update 回落 DB 值）
        assert_eq!(resolve_secret(db, None), None);
        assert_eq!(pick_secret_for_update(db, None), db.map(str::to_string));
        // DB 与前端都为 None → None
        assert_eq!(resolve_secret(None, None), None);
        // DB 为 None、前端传值 → 前端值
        assert_eq!(resolve_secret(None, Some("abc")), Some("abc".to_string()));
    }

    // ———————— 默认值 ————————

    #[test]
    fn create_defaults_match_java() {
        // 平台：null / 未知 → 飞鹅云；2 → 商米云
        assert_eq!(normalize_platform(None), PLATFORM_FEIEYUN);
        assert_eq!(normalize_platform(Some(PLATFORM_FEIEYUN)), PLATFORM_FEIEYUN);
        assert_eq!(normalize_platform(Some(PLATFORM_SUNMI)), PLATFORM_SUNMI);
        assert_eq!(normalize_platform(Some(99)), PLATFORM_FEIEYUN);

        // 状态：null → 停用（2）
        assert_eq!(status_or_disabled(None), STATUS_DISABLED);
        assert_eq!(status_or_disabled(Some(STATUS_ENABLED)), STATUS_ENABLED);

        // 语音：开关 null → 1；内容 null → 0
        assert_eq!(voice_enabled_or_default(None), 1);
        assert_eq!(voice_content_type_or_default(None), 0);
        assert_eq!(voice_enabled_or_default(Some(2)), 2);

        // isDefault：仅 1 视为默认，其余 0
        assert_eq!(is_default_flag(Some(1)), 1);
        assert_eq!(is_default_flag(Some(0)), 0);
        assert_eq!(is_default_flag(None), 0);
        assert_eq!(is_default_flag(Some(2)), 0);

        // 纸张尺寸：null / 0 / 未知 → 58，80 保留
        assert_eq!(normalize_paper_size(None), 58);
        assert_eq!(normalize_paper_size(Some(0)), 58);
        assert_eq!(normalize_paper_size(Some(58)), 58);
        assert_eq!(normalize_paper_size(Some(80)), 80);
        assert_eq!(normalize_paper_size(Some(99)), 58);
    }

    // ———————— 入参校验 ————————

    #[test]
    fn validate_add_messages_are_verbatim() {
        let mut dto = PrintAddDTO::default();
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_PRINT_NAME_REQUIRED);
        dto.print_name = Some("   ".into()); // @NotBlank 对空白串同样失败
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_PRINT_NAME_REQUIRED);
        dto.print_name = Some("前台打印机".into());
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_THIRD_ACCOUNT_REQUIRED);
        dto.third_account = Some("acc".into());
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_THIRD_KEY_REQUIRED);
        dto.third_key = Some("key".into());
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_PRINT_SN_REQUIRED);
        dto.print_sn = Some("SN-1".into());
        assert_eq!(validate_add(&dto).unwrap_err(), MSG_AUTO_PRINT_REQUIRED);
        dto.auto_print = Some(1);
        assert!(validate_add(&dto).is_ok());
    }

    #[test]
    fn validate_update_messages_are_verbatim() {
        let mut dto = PrintUpdateDTO::default();
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_PRINT_ID_REQUIRED);
        dto.print_id = Some(9);
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_PRINT_NAME_REQUIRED);
        dto.print_name = Some("前台打印机".into());
        assert_eq!(
            validate_update(&dto).unwrap_err(),
            MSG_THIRD_ACCOUNT_REQUIRED
        );
        dto.third_account = Some("acc".into());
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_THIRD_KEY_REQUIRED);
        dto.third_key = Some("key".into());
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_PRINT_SN_REQUIRED);
        dto.print_sn = Some("SN-1".into());
        // 注意：此条 message 原文没有「不能为空」后缀
        assert_eq!(validate_update(&dto).unwrap_err(), "打印机状态");
        dto.status = Some(1);
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_AUTO_PRINT_REQUIRED);
        dto.auto_print = Some(1);
        assert!(validate_update(&dto).is_ok());
    }

    // ———————— updateField 白名单 ————————

    #[test]
    fn update_field_whitelist_matches_java_constant() {
        assert_eq!(PRINT_FIELDS, ["status", "is_default"]);
        assert_eq!(normalize_field("status"), Some("status"));
        assert_eq!(normalize_field("isDefault"), Some("is_default"));
        assert_eq!(normalize_field("is_default"), Some("is_default"));
        // 不在白名单 → 报 `field 的值有误`
        assert_eq!(normalize_field("printName"), None);
        assert_eq!(normalize_field("1;DROP TABLE print"), None);
        assert_eq!(MSG_INVALID_FIELD_VALUE, "field 的值有误");
    }

    // ———————— JSON 契约（camelCase / size 别名） ————————

    #[test]
    fn print_page_query_accepts_size_and_pagesize() {
        let q: PrintPageQuery = serde_json::from_str(
            r#"{"printName":"前台","printSn":"SN","status":1,"platform":2,
                "deviceCode":"POS-A","keyword":"k","page":2,"size":30,
                "sortField":"printId","sortOrder":"asc"}"#,
        )
        .expect("PrintPageQuery 应接受 camelCase");
        assert_eq!(q.print_name.as_deref(), Some("前台"));
        assert_eq!(q.print_sn.as_deref(), Some("SN"));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.platform, Some(2));
        assert_eq!(q.device_code.as_deref(), Some("POS-A"));
        assert_eq!(q.keyword.as_deref(), Some("k"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.sort_order.as_deref(), Some("asc"));

        let q2: PrintPageQuery = serde_json::from_str(r#"{"pageSize":20}"#).unwrap();
        assert_eq!(q2.page_size, Some(20));
    }

    #[test]
    fn add_and_update_dto_parse_camel_case() {
        let add: PrintAddDTO = serde_json::from_str(
            r#"{"printName":"前台","thirdAccount":"acc","thirdKey":"tk",
                "printSn":"SN","printKey":"pk","autoPrint":1,"platform":2,
                "paperSize":80,"status":1,"voiceEnabled":2,"voiceContentType":1,
                "deviceCode":"POS-A","isDefault":1}"#,
        )
        .unwrap();
        assert_eq!(add.print_name.as_deref(), Some("前台"));
        assert_eq!(add.paper_size, Some(80));
        assert_eq!(add.is_default, Some(1));
        assert_eq!(add.device_code.as_deref(), Some("POS-A"));

        let upd: PrintUpdateDTO = serde_json::from_str(
            r#"{"printId":7,"printName":"前台","thirdAccount":"acc","thirdKey":"tk",
                "printSn":"12*****890","printKey":"pk","status":1,"autoPrint":2}"#,
        )
        .unwrap();
        assert_eq!(upd.print_id, Some(7));
        assert_eq!(upd.status, Some(1));
        assert_eq!(upd.auto_print, Some(2));
    }

    #[test]
    fn vo_serializes_camel_case_with_null_paper_size() {
        // devicePrinters 路径：VO 不回填 paperSize / paperSizeDesc → null
        let vo = PrintVO {
            print_id: 3,
            print_name: Some("前台".into()),
            print_sn: Some("SN-1".into()),
            platform: Some(PLATFORM_FEIEYUN),
            platform_text: "飞鹅云".into(),
            status: Some(STATUS_ENABLED),
            status_text: "启用".into(),
            paper_size: None,
            paper_size_desc: None,
            voice_enabled: 1,
            voice_content_type: 0,
            device_code: Some("POS-A".into()),
            is_default: 0,
            update_time: String::new(),
            add_time: "2026-01-01 00:00:00".into(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["printId"], 3);
        assert_eq!(json["printName"], "前台");
        assert_eq!(json["platformText"], "飞鹅云");
        assert_eq!(json["statusText"], "启用");
        assert!(json["paperSize"].is_null());
        assert!(json["paperSizeDesc"].is_null());
        assert_eq!(json["voiceEnabled"], 1);
        assert_eq!(json["addTime"], "2026-01-01 00:00:00");
    }

    #[test]
    fn detail_vo_serializes_masked_fields() {
        let vo = PrintDetailVO {
            print_id: 3,
            print_name: Some("前台".into()),
            print_sn: mask_middle_half(Some("1234567890")),
            print_key: mask_middle_half(Some("abcdef")),
            third_account: Some("acc".into()),
            third_key: mask_middle_half(Some("third-key")),
            print_number: Some(1),
            platform: Some(PLATFORM_FEIEYUN),
            platform_text: "飞鹅云".into(),
            status: Some(STATUS_ENABLED),
            auto_print: Some(1),
            status_text: "启用".into(),
            shop_id: Some(0),
            paper_size: 58,
            paper_size_desc: "58mm".into(),
            voice_enabled: 1,
            device_code: None,
            is_default: 0,
            add_time: String::new(),
            update_time: String::new(),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["printSn"], "12*****890");
        assert_eq!(json["thirdAccount"], "acc");
        assert_eq!(json["paperSize"], 58);
        assert!(json["deviceCode"].is_null());
        // 详情 VO 不含 voiceContentType（与 Java PrintDetailVO 一致）
        assert!(json.get("voiceContentType").is_none());
    }

    #[test]
    fn blank_helper_matches_java_is_blank() {
        assert!(is_blank(None));
        assert!(is_blank(Some("")));
        assert!(is_blank(Some("   ")));
        assert!(!is_blank(Some(" x ")));
    }
}
