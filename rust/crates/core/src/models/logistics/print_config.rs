//! 打印机配置管理域（logistics::print_config）DTO / VO / 打印模板结构 / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.print.PrintConfigController`
//!   （`@RequestMapping("/adminapi/print/printConfig")`）
//! - `com.tigshop.service.print.impl.PrintConfigServiceImpl`
//! - `com.tigshop.bean.model.print.PrintConfig`（表 `print_config`）
//! - `com.tigshop.bean.param.print.PrintConfigUpdateParam`
//! - `com.tigshop.bean.param.print.PrintOrdersParam`
//! - `com.tigshop.bean.vo.print.PrintConfigVO`
//! - `com.tigshop.bean.param.print.PrintTemplate` /
//!   `PrintTemplateItem` / `PrintTemplateOption`
//! - `com.tigshop.bean.constant.print.PrintTemplateConstant`
//! - `com.tigshop.bean.enums.print.PrintPaperSizeEnum` /
//!   `PrintConfigTypeEnum` / `PrintTriggerTypeEnum` / `PrintLogStatusEnum`
//! - `com.tigshop.common.utils.TigUtils#handelTime`（VO 时间格式化）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! # 金额
//!
//! 本域（打印机配置读取/更新、打印任务投递）**不涉及任何金额列**，
//! 因此没有 `rust_decimal::Decimal` 出场。
//!
//! # 表 / 列（权威来源 `java/database/pure.sql`）
//!
//! 用 `cd rust && python tools/schema_parser.py --table <表名>` 核对：
//! - `print_config`（7 列）：`id` / `print_id` / `template` / `type` /
//!   `paper_size` / `add_time` / `update_time`
//! - `print`（17 列，见 [`PRINT_COLUMNS`]）
//! - `print_pos_device`（5 列）：`id` / `shop_id` / `print_id` /
//!   `device_code` / `add_time`
//! - `print_log`（18 列，见 [`PRINT_LOG_COLUMNS`]）
//!
//! # 多租户（shopId）
//!
//! Java 的 `BaseServiceImpl#getShopId()` 最终读的是**请求头**
//! `HeaderUtils.getShopId()`（`admin` → `0`；`shop` / `pos` → `X-Shop-Id`；
//! 其余 → `null`）。Rust 侧鉴权中间件尚未签发 / 解析店铺上下文
//! （与本仓其它域一致的已知缺口），因此本域把 `shopId` 作为**显式入参**
//! 由路由层传入，默认取 [`DEFAULT_SHOP_ID`]（平台 `0`）。
//! 详见返回值 `uncertain_points`。

use serde::{Deserialize, Serialize};

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java / schema）
// ——————————————————————————————————————————————

/// 平台店铺 ID（Java `HeaderUtils.getShopId()` 在 `admin` 账号下的取值 `0`）。
pub const DEFAULT_SHOP_ID: i32 = 0;

/// 纸张尺寸：58mm（Java `PrintPaperSizeEnum.SIZE_58.getCode()`）。
pub const PAPER_SIZE_58: i32 = 58;

/// 纸张尺寸：80mm（Java `PrintPaperSizeEnum.SIZE_80.getCode()`）。
pub const PAPER_SIZE_80: i32 = 80;

/// 配置类型：购物小票（Java `PrintConfigTypeEnum.RECEIPT.getCode()`）。
pub const CONFIG_TYPE_RECEIPT: i32 = 1;

/// 打印机状态：启用（Java `PrintStatusEnum.ENABLED.getCode()`）。
pub const PRINT_STATUS_ENABLED: i32 = 1;

/// 打印任务触发方式：手动补打（Java `PrintTriggerTypeEnum.MANUAL.getCode()`）。
pub const TRIGGER_TYPE_MANUAL: i32 = 2;

/// 打印日志状态：待推送（Java `PrintLogStatusEnum.PENDING.getCode()`）。
pub const LOG_STATUS_PENDING: i32 = 0;

/// `print_config` 的真实列清单（7 列）。
pub const PRINT_CONFIG_COLUMNS: [&str; 7] = [
    "id",
    "print_id",
    "template",
    "type",
    "paper_size",
    "add_time",
    "update_time",
];

/// `print` 的真实列清单（17 列，顺序与 `entities::Print` 字段一致）。
pub const PRINT_COLUMNS: [&str; 17] = [
    "print_id",
    "print_name",
    "print_sn",
    "print_key",
    "third_account",
    "third_key",
    "print_number",
    "platform",
    "shop_id",
    "status",
    "add_time",
    "update_time",
    "delete_time",
    "auto_print",
    "voice_enabled",
    "voice_content_type",
    "is_default",
];

/// `print_pos_device` 的真实列清单（5 列）。
pub const PRINT_POS_DEVICE_COLUMNS: [&str; 5] =
    ["id", "shop_id", "print_id", "device_code", "add_time"];

/// `print_log` 的真实列清单（18 列）。
pub const PRINT_LOG_COLUMNS: [&str; 18] = [
    "log_id",
    "shop_id",
    "print_id",
    "platform",
    "order_id",
    "print_sn",
    "trigger_type",
    "status",
    "error_code",
    "error_msg",
    "task_no",
    "push_response",
    "callback_payload",
    "retry_count",
    "pushed_time",
    "printed_time",
    "add_time",
    "update_time",
];

// ——————————————————————————————————————————————
// Java 常量文案（逐字符照抄）
// ——————————————————————————————————————————————

/// Java `PrintConfigController.getConfigsByPrintId` 方法参数上的
/// `@NotNull(message = "打印机ID不能为空")`。
pub const MSG_PRINT_ID_REQUIRED: &str = "打印机ID不能为空";

/// Java `PrintConfigUpdateParam.id` 上的
/// `@NotNull(message = "配置ID不能为空")`。
pub const MSG_CONFIG_ID_REQUIRED: &str = "配置ID不能为空";

/// Java `PrintConfigUpdateParam.template` 上的
/// `@NotNull(message = "打印模板不能为空")`。
pub const MSG_TEMPLATE_REQUIRED: &str = "打印模板不能为空";

/// Java `PrintOrdersParam.ids` 上的
/// `@NotNull(message = "订单id不能为空")`。
pub const MSG_ORDER_IDS_REQUIRED: &str = "订单id不能为空";

/// Java `PrintConfigServiceImpl#updateConfig` 抛出的
/// `new GlobalException("打印配置不存在")`。
pub const MSG_CONFIG_NOT_FOUND: &str = "打印配置不存在";

/// Java `PrintConfigServiceImpl#updateConfig` 的 catch 分支前缀
/// （`"更新打印配置失败：" + e.getMessage()`）。
pub const MSG_UPDATE_FAILED_PREFIX: &str = "更新打印配置失败：";

/// Java `PrintConfigServiceImpl#print` 在无可用打印机时抛出的文案
/// （`deviceCode == null`）。
pub const MSG_NO_ENABLED_PRINTER: &str = "当前店铺没有启用的打印机";

/// Java `PrintConfigServiceImpl#print` 在指定设备无绑定打印机时抛出的文案。
pub const MSG_DEVICE_NO_PRINTER: &str = "所选设备没有绑定启用的打印机";

/// Java `PrintConfigTypeEnum.getDescByCode` 的兜底描述。
pub const MSG_TYPE_UNKNOWN: &str = "未知类型";

/// Java `PrintConfigTypeEnum.RECEIPT` 的描述。
pub const MSG_TYPE_RECEIPT: &str = "购物小票";

/// Java `PrintPaperSizeEnum.SIZE_58` 的描述。
pub const MSG_PAPER_SIZE_58: &str = "58mm";

/// Java `PrintPaperSizeEnum.SIZE_80` 的描述。
pub const MSG_PAPER_SIZE_80: &str = "80mm";

// ——————————————————————————————————————————————
// 打印模板（Java `PrintTemplate` / `PrintTemplateItem` / `PrintTemplateOption`）
// ——————————————————————————————————————————————

/// 模板项标题：配送信息（`PrintConfigVO#fillMobile` 命中它）。
pub const TITLE_DELIVERY_INFO: &str = "配送信息";

/// 模板项标题：其他订单信息（`fillQRCode` 以它为锚点插入二维码）。
pub const TITLE_OTHER_ORDER_INFO: &str = "其他订单信息";

/// 模板项标题：二维码（`fillQRCode` 的幂等判据）。
pub const TITLE_QR_CODE: &str = "二维码";

/// 选项标题：订单二维码（`fillQRCode` 插入的选项）。
pub const OPTION_ORDER_QR_CODE: &str = "订单二维码";

/// 选项标题：手机号模糊（`fillMobile` 的幂等判据与补插项）。
pub const OPTION_MOBILE_MASKED: &str = "手机号模糊";

/// 模板选项（Java `com.tigshop.bean.param.print.PrintTemplateOption`）。
///
/// 三个字段全部可为 `null`：Java 用 `new ObjectMapper()` 序列化模板时
/// **包含 null 字段**（未开 `NON_NULL`），本结构体默认同样输出 `null`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintTemplateOption {
    /// 选项标题（Java `chooseTitle`）
    pub choose_title: Option<String>,
    /// 是否选中（Java `choose`）
    pub choose: Option<bool>,
    /// 实际值（Java `value`；默认空串 `""`）
    pub value: Option<String>,
}

/// 模板项（Java `com.tigshop.bean.param.print.PrintTemplateItem`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintTemplateItem {
    /// 模板项标题（Java `title`）
    pub title: Option<String>,
    /// 模板项选项列表（Java `options`；**可能为 `null`**）
    pub options: Option<Vec<PrintTemplateOption>>,
}

/// 构造模板项（Java `PrintTemplateConstant#createTemplateItem`）。
#[must_use]
pub fn create_template_item(title: &str, options: Vec<PrintTemplateOption>) -> PrintTemplateItem {
    PrintTemplateItem {
        title: Some(title.to_string()),
        options: Some(options),
    }
}

/// 构造模板选项（Java `PrintTemplateConstant#createOption`）。
#[must_use]
pub fn create_option(choose_title: &str, choose: bool, value: &str) -> PrintTemplateOption {
    PrintTemplateOption {
        choose_title: Some(choose_title.to_string()),
        choose: Some(choose),
        value: Some(value.to_string()),
    }
}

/// 默认购物小票模板（Java
/// `PrintTemplateConstant#createDefaultReceiptTemplate`）。
///
/// 逐条照抄 Java 的 11 个模板项与各自的选项；除「底部公告」的
/// `value` 外，其余选项 `value` 均为空串。
///
/// 用途：`PrintConfigVO` 在模板 JSON **解析失败**时回退到它
/// （Java `catch (Exception e) { this.template = createDefaultReceiptTemplate(); }`）。
#[must_use]
pub fn default_receipt_template() -> Vec<PrintTemplateItem> {
    vec![
        create_template_item("小票头部", vec![create_option("商家名称", true, "")]),
        create_template_item(
            TITLE_DELIVERY_INFO,
            vec![
                create_option("配送方式", true, ""),
                create_option("商配&同城-收货信息", true, ""),
                create_option(OPTION_MOBILE_MASKED, true, ""),
            ],
        ),
        create_template_item("买家备注", vec![create_option("买家备注", true, "")]),
        create_template_item(
            "商品信息",
            vec![
                create_option("商品基础信息", true, ""),
                create_option("规格编码", true, ""),
            ],
        ),
        create_template_item("运费信息", vec![create_option("运费", true, "")]),
        create_template_item(
            "优惠信息",
            vec![
                create_option("优惠明细", true, ""),
                create_option("优惠总计", true, ""),
            ],
        ),
        create_template_item(
            "支付信息",
            vec![
                create_option("实收金额", true, ""),
                create_option("支付方式", true, ""),
                create_option("第三方支付单号", true, ""),
            ],
        ),
        create_template_item("客户信息", vec![create_option("客户信息", true, "")]),
        create_template_item(
            TITLE_OTHER_ORDER_INFO,
            vec![
                create_option("下单时间", true, ""),
                create_option("支付时间", true, ""),
                create_option("渠道类型", true, ""),
            ],
        ),
        create_template_item(
            TITLE_QR_CODE,
            vec![create_option(OPTION_ORDER_QR_CODE, true, "")],
        ),
        create_template_item(
            "底部公告",
            vec![create_option(
                "底部公告",
                true,
                "感谢您的惠顾，欢迎再次光临！",
            )],
        ),
    ]
}

/// 补齐二维码模板项（Java `PrintConfigVO#fillQRCode`）。
///
/// 语义逐条照抄：
/// 1. 模板里**已有**任意一项标题为 [`TITLE_QR_CODE`] → 原样返回（幂等）
/// 2. 否则定位标题为 [`TITLE_OTHER_ORDER_INFO`] 的项，在其**后面**插入
///    `{"title":"二维码","options":[{"chooseTitle":"订单二维码","choose":true,"value":""}]}`
/// 3. 找不到锚点（`insertIndex == -1`）→ **不插入**（Java 行为）
pub fn fill_qr_code(items: &mut Vec<PrintTemplateItem>) {
    let has_qr_code = items
        .iter()
        .any(|i| i.title.as_deref() == Some(TITLE_QR_CODE));
    if has_qr_code {
        return;
    }
    let anchor = items
        .iter()
        .position(|i| i.title.as_deref() == Some(TITLE_OTHER_ORDER_INFO));
    if let Some(idx) = anchor {
        // Java `insertIndex + 1 <= template.size()`；因 `idx < size` 恒成立，
        // 这里保留同样的守卫以便与源一一对照。
        if idx + 1 <= items.len() {
            items.insert(
                idx + 1,
                create_template_item(
                    TITLE_QR_CODE,
                    vec![create_option(OPTION_ORDER_QR_CODE, true, "")],
                ),
            );
        }
    }
}

/// 补齐「手机号模糊」选项（Java `PrintConfigVO#fillMobile`）。
///
/// 对**每一个**标题为 [`TITLE_DELIVERY_INFO`] 的模板项：若其 `options` 中
/// 没有任何 `chooseTitle == "手机号模糊"` 的选项，则追加
/// `{"chooseTitle":"手机号模糊","choose":false,"value":""}`。
///
/// 返回 `None` 表示 Java 侧会抛 `NullPointerException`
/// （`item.getOptions()` 为 `null` 时 `for (... : item.getOptions())`），
/// 该异常被 `PrintConfigVO` 构造函数里的 `catch (Exception e)` 捕获 →
/// **整个模板回退为默认模板**。调用方（[`parse_template`]）据此回退。
#[must_use]
pub fn fill_mobile(items: &mut [PrintTemplateItem]) -> Option<()> {
    for item in items.iter_mut() {
        if item.title.as_deref() != Some(TITLE_DELIVERY_INFO) {
            continue;
        }
        // Java: `for (PrintTemplateOption option : item.getOptions())` → NPE
        let options = item.options.as_mut()?;
        let has_mobile = options
            .iter()
            .any(|o| o.choose_title.as_deref() == Some(OPTION_MOBILE_MASKED));
        if !has_mobile {
            options.push(create_option(OPTION_MOBILE_MASKED, false, ""));
        }
    }
    Some(())
}

/// 解析库里的模板 JSON 并补齐二维码 / 手机号选项。
///
/// 返回 `None` 表示「Java 会落到 `catch (Exception e)` 分支」
/// （JSON 解析失败，或 `options` 为 `null` 触发 `fillMobile` 的 NPE），
/// 调用方须回退 [`default_receipt_template`]。
#[must_use]
pub fn parse_template(raw: &str) -> Option<Vec<PrintTemplateItem>> {
    let mut items: Vec<PrintTemplateItem> = serde_json::from_str(raw).ok()?;
    fill_qr_code(&mut items);
    fill_mobile(&mut items)?;
    Some(items)
}

/// 把 `print_config.template` 原始列值转成 VO 的 `template` 字段。
///
/// 与 Java `PrintConfigVO` 构造函数的三个分支逐条对应：
/// - 列值为 `null` **或**空串 → VO `template = null`（**不**回退默认模板）
/// - 有值但解析/补齐失败 → 回退 [`default_receipt_template`]
/// - 有值且解析成功 → 补齐二维码 / 手机号后的模板
#[must_use]
pub fn build_vo_template(raw: Option<&str>) -> Option<Vec<PrintTemplateItem>> {
    match raw {
        None => None,
        // Java: `printConfig.getTemplate() != null && !printConfig.getTemplate().isEmpty()`
        Some(s) if s.is_empty() => None,
        Some(s) => Some(parse_template(s).unwrap_or_else(default_receipt_template)),
    }
}

// ——————————————————————————————————————————————
// 枚举映射（Java 枚举的 `of` / `getDescByCode` 等价物）
// ——————————————————————————————————————————————

/// 纸张尺寸码归一（Java `PrintPaperSizeEnum#of`）：
/// `null` / `0` / 未知值一律兜底为 [`PAPER_SIZE_58`]。
#[must_use]
pub fn paper_size_code(code: i32) -> i32 {
    if code == PAPER_SIZE_80 {
        PAPER_SIZE_80
    } else {
        PAPER_SIZE_58
    }
}

/// 纸张尺寸描述（Java `PrintPaperSizeEnum#getDesc`）。
#[must_use]
pub fn paper_size_desc(code: i32) -> &'static str {
    if paper_size_code(code) == PAPER_SIZE_80 {
        MSG_PAPER_SIZE_80
    } else {
        MSG_PAPER_SIZE_58
    }
}

/// 配置类型描述（Java `PrintConfigTypeEnum#getDescByCode`）：
/// `null` / 未知值 → [`MSG_TYPE_UNKNOWN`]。
#[must_use]
pub fn type_desc(code: Option<i32>) -> &'static str {
    match code {
        Some(CONFIG_TYPE_RECEIPT) => MSG_TYPE_RECEIPT,
        _ => MSG_TYPE_UNKNOWN,
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（东八区）。
///
/// 对应 Java `TigUtils#handelTime(Long)`：`null` 或 `0` → 空串 `""`。
///
/// 时区说明：Java 用的是 JVM 默认时区（`new SimpleDateFormat(...)`），
/// 本实现固定 `+08:00`（与本仓 member_tag 等域一致，东八区无夏令时，
/// 与 `Asia/Shanghai` 在全部历史时刻等价），避免运行机器 `TZ` 漂移。
#[must_use]
pub fn format_time(secs: Option<i32>) -> String {
    use chrono::TimeZone;
    let Some(secs) = secs else {
        return String::new();
    };
    if secs == 0 {
        return String::new();
    }
    match chrono::FixedOffset::east_opt(8 * 3600)
        .and_then(|tz| tz.timestamp_opt(i64::from(secs), 0).single())
    {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        None => String::new(),
    }
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 打印配置 VO（对应 Java `com.tigshop.bean.vo.print.PrintConfigVO`）。
///
/// 九个字段与 Java 一一对应（Java 的 `type` 在 Rust 里叫 `config_type`，
/// 序列化名用显式 `rename = "type"`，避免 `r#type` 生僻写法）。
///
/// ⚠️ Java 控制器返回 `PrintConfigVO`，**可能为 `null`**
/// （`list.stream().findFirst().orElse(null)`）—— 因此路由层返回
/// `Option<PrintConfigVO>`，`data` 为 `null` 时前端按「未配置」处理。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintConfigVO {
    /// 配置ID
    pub id: i32,
    /// 打印机ID
    pub print_id: i32,
    /// 打印模板（列值为空时为 `null`）
    pub template: Option<Vec<PrintTemplateItem>>,
    /// 配置类型（1=购物小票）
    #[serde(rename = "type")]
    pub config_type: Option<i32>,
    /// 配置类型描述
    pub type_desc: String,
    /// 纸张尺寸（JSON 数字 58 / 80）
    pub paper_size: i32,
    /// 纸张尺寸描述（58mm / 80mm）
    pub paper_size_desc: String,
    /// 创建时间（`yyyy-MM-dd HH:mm:ss`，无值时 `""`）
    pub add_time: String,
    /// 更新时间（`yyyy-MM-dd HH:mm:ss`，无值时 `""`）
    pub update_time: String,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 更新打印配置请求（Java `PrintConfigUpdateParam`）。
///
/// Java 侧校验注解：
/// - `id`：`@NotNull(message = "配置ID不能为空")`
/// - `template`：`@NotNull(message = "打印模板不能为空")`
/// - `paperSize`：**无校验**，可为 `null`（不传则保留原值）
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintConfigUpdateDTO {
    /// 配置ID（必填）
    pub id: Option<i32>,
    /// 打印模板（必填；元素结构见 [`PrintTemplateItem`]）
    pub template: Option<Vec<PrintTemplateItem>>,
    /// 纸张尺寸（58 / 80；不传 / `null` 保留原值）
    pub paper_size: Option<i32>,
}

/// 打印订单请求（Java `PrintOrdersParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintOrdersDTO {
    /// 订单 ID 列表（必填；Java `@NotNull` **不**校验空数组）
    pub ids: Option<Vec<i32>>,
    /// 收银台设备码；收银台打印时传入前端选择的设备
    pub device_code: Option<String>,
}

// ——————————————————————————————————————————————
// 校验（Java 注解的等价物）
// ——————————————————————————————————————————————

/// 校验并归一 `update` 入参。
///
/// 与 Java `@Valid PrintConfigUpdateParam` 等价：
/// 1. `id == null` → [`MSG_CONFIG_ID_REQUIRED`]
/// 2. `template == null` → [`MSG_TEMPLATE_REQUIRED`]
///
/// 返回 `(id, template)`。⚠️ 空数组 `[]` **合法**（Java `@NotNull` 只拦 null）。
///
/// # Errors
/// 入参不满足上述两条约束时返回错误文案。
pub fn validate_update(
    dto: &PrintConfigUpdateDTO,
) -> std::result::Result<(i32, Vec<PrintTemplateItem>), String> {
    let id = dto.id.ok_or_else(|| MSG_CONFIG_ID_REQUIRED.to_string())?;
    let template = dto
        .template
        .clone()
        .ok_or_else(|| MSG_TEMPLATE_REQUIRED.to_string())?;
    Ok((id, template))
}

/// 校验并归一 `print` 入参。
///
/// 与 Java `@Valid PrintOrdersParam` 等价：`ids == null` →
/// [`MSG_ORDER_IDS_REQUIRED`]。⚠️ 空数组 `[]` **合法**
/// （Java 的 `@NotNull` 不拦空数组，循环零次后返回 `true`）。
///
/// # Errors
/// `ids == null` 时返回 [`MSG_ORDER_IDS_REQUIRED`]。
pub fn validate_print(dto: &PrintOrdersDTO) -> std::result::Result<Vec<i32>, String> {
    dto.ids
        .clone()
        .ok_or_else(|| MSG_ORDER_IDS_REQUIRED.to_string())
}

/// 设备码归一（Java `StrUtil.isBlank(x) ? null : x.trim()`）。
///
/// ⚠️ 判空用的是**原始串**（`"  "` 视为 `null`），非空才 trim。
#[must_use]
pub fn normalize_device_code(raw: Option<&str>) -> Option<String> {
    match raw {
        None => None,
        Some(s) if s.trim().is_empty() => None,
        Some(s) => Some(s.trim().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 schema / Java 逐字符对照 ——————————————————————

    /// 列清单必须与 `schema_parser.py` 的权威输出逐字一致。
    #[test]
    fn column_lists_match_authoritative_schema() {
        assert_eq!(
            PRINT_CONFIG_COLUMNS,
            [
                "id",
                "print_id",
                "template",
                "type",
                "paper_size",
                "add_time",
                "update_time",
            ]
        );
        assert_eq!(PRINT_POS_DEVICE_COLUMNS.len(), 5);
        assert_eq!(PRINT_COLUMNS.len(), 17);
        assert_eq!(PRINT_LOG_COLUMNS.len(), 18);
        // 关键列名存在性（写错列名 cargo check 查不出的兜底）
        assert!(PRINT_CONFIG_COLUMNS.contains(&"paper_size"));
        assert!(PRINT_POS_DEVICE_COLUMNS.contains(&"device_code"));
        assert!(PRINT_LOG_COLUMNS.contains(&"trigger_type"));
        assert!(PRINT_COLUMNS.contains(&"is_default"));
    }

    /// Java 常量文案逐字符照抄（来自不同 Java 类，不许「统一改写」）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_PRINT_ID_REQUIRED, "打印机ID不能为空");
        assert_eq!(MSG_CONFIG_ID_REQUIRED, "配置ID不能为空");
        assert_eq!(MSG_TEMPLATE_REQUIRED, "打印模板不能为空");
        assert_eq!(MSG_ORDER_IDS_REQUIRED, "订单id不能为空");
        assert_eq!(MSG_CONFIG_NOT_FOUND, "打印配置不存在");
        assert_eq!(MSG_UPDATE_FAILED_PREFIX, "更新打印配置失败：");
        assert_eq!(MSG_NO_ENABLED_PRINTER, "当前店铺没有启用的打印机");
        assert_eq!(MSG_DEVICE_NO_PRINTER, "所选设备没有绑定启用的打印机");
        assert_eq!(MSG_TYPE_UNKNOWN, "未知类型");
        assert_eq!(MSG_TYPE_RECEIPT, "购物小票");
        assert_eq!(MSG_PAPER_SIZE_58, "58mm");
        assert_eq!(MSG_PAPER_SIZE_80, "80mm");
    }

    /// 枚举码值照抄 Java 枚举。
    #[test]
    fn enum_codes_match_java() {
        assert_eq!(PAPER_SIZE_58, 58);
        assert_eq!(PAPER_SIZE_80, 80);
        assert_eq!(CONFIG_TYPE_RECEIPT, 1);
        assert_eq!(PRINT_STATUS_ENABLED, 1);
        assert_eq!(TRIGGER_TYPE_MANUAL, 2);
        assert_eq!(LOG_STATUS_PENDING, 0);
        assert_eq!(DEFAULT_SHOP_ID, 0);
    }

    // ————————————————————— 枚举映射 —————————————————————

    /// `PrintPaperSizeEnum.of`：`0` / 未知值兜底 58。
    #[test]
    fn paper_size_code_falls_back_to_58() {
        assert_eq!(paper_size_code(58), 58);
        assert_eq!(paper_size_code(80), 80);
        assert_eq!(paper_size_code(0), 58);
        assert_eq!(paper_size_code(7), 58);
        assert_eq!(paper_size_code(-1), 58);
        assert_eq!(paper_size_desc(80), "80mm");
        assert_eq!(paper_size_desc(0), "58mm");
    }

    /// `PrintConfigTypeEnum.getDescByCode`。
    #[test]
    fn type_desc_matches_java() {
        assert_eq!(type_desc(Some(1)), "购物小票");
        assert_eq!(type_desc(None), "未知类型");
        assert_eq!(type_desc(Some(9)), "未知类型");
    }

    /// `TigUtils#handelTime`：`null` / `0` → 空串。
    #[test]
    fn format_time_matches_java_branches() {
        assert_eq!(format_time(None), "");
        assert_eq!(format_time(Some(0)), "");
        // 1_700_000_000 秒 = 2023-11-15 06:13:20 +08:00（实算）
        assert_eq!(format_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        // 不得输出 ISO8601
        let s = format_time(Some(1_700_000_000));
        assert!(!s.contains('T') && !s.contains('Z'));
    }

    // ————————————————————— 默认模板 —————————————————————

    /// 默认模板 11 项、标题与顺序照抄 Java；二维码在「其他订单信息」之后。
    #[test]
    fn default_template_matches_java_structure() {
        let t = default_receipt_template();
        let titles: Vec<&str> = t.iter().map(|i| i.title.as_deref().unwrap()).collect();
        assert_eq!(
            titles,
            vec![
                "小票头部",
                "配送信息",
                "买家备注",
                "商品信息",
                "运费信息",
                "优惠信息",
                "支付信息",
                "客户信息",
                "其他订单信息",
                "二维码",
                "底部公告",
            ]
        );
        assert_eq!(t.len(), 11);
        // 底部公告带默认文案
        let last = &t[10];
        assert_eq!(
            last.options.as_ref().unwrap()[0].value.as_deref(),
            Some("感谢您的惠顾，欢迎再次光临！")
        );
        // 其余选项 value 均为空串
        assert_eq!(t[0].options.as_ref().unwrap()[0].value.as_deref(), Some(""));
        // 配送信息已自带「手机号模糊」
        let has_mobile = t[1]
            .options
            .as_ref()
            .unwrap()
            .iter()
            .any(|o| o.choose_title.as_deref() == Some(OPTION_MOBILE_MASKED));
        assert!(has_mobile);

        // 序列化键名必须是 camelCase（chooseTitle / options / title）
        let json = serde_json::to_string(&t[0]).unwrap();
        assert!(json.contains("\"title\""), "{json}");
        assert!(json.contains("\"chooseTitle\""), "{json}");
    }

    // ————————————————————— fillQRCode —————————————————————

    /// 缺少二维码时，插到「其他订单信息」之后。
    #[test]
    fn fill_qr_code_inserts_after_anchor() {
        let mut items = vec![
            create_template_item("其他订单信息", vec![create_option("下单时间", true, "")]),
            create_template_item("底部公告", vec![create_option("底部公告", true, "")]),
        ];
        fill_qr_code(&mut items);
        let titles: Vec<&str> = items.iter().map(|i| i.title.as_deref().unwrap()).collect();
        assert_eq!(titles, vec!["其他订单信息", "二维码", "底部公告"]);
        let qr = &items[1].options.as_ref().unwrap()[0];
        assert_eq!(qr.choose_title.as_deref(), Some("订单二维码"));
        assert_eq!(qr.choose, Some(true));
    }

    /// 已有二维码 → 幂等，不重复插入。
    #[test]
    fn fill_qr_code_is_idempotent() {
        let mut items = vec![
            create_template_item("其他订单信息", vec![]),
            create_template_item("二维码", vec![]),
        ];
        fill_qr_code(&mut items);
        assert_eq!(items.len(), 2);
        assert_eq!(
            items
                .iter()
                .filter(|i| i.title.as_deref() == Some("二维码"))
                .count(),
            1
        );
    }

    /// 无「其他订单信息」锚点 → 不插入（Java `insertIndex == -1` 分支）。
    #[test]
    fn fill_qr_code_without_anchor_is_noop() {
        let mut items = vec![create_template_item("小票头部", vec![])];
        fill_qr_code(&mut items);
        assert_eq!(items.len(), 1);
    }

    // ————————————————————— fillMobile —————————————————————

    /// 配送信息缺「手机号模糊」→ 追加，且 `choose=false`。
    #[test]
    fn fill_mobile_appends_missing_option() {
        let mut items = vec![create_template_item(
            "配送信息",
            vec![create_option("配送方式", true, "")],
        )];
        assert_eq!(fill_mobile(&mut items), Some(()));
        let opts = items[0].options.as_ref().unwrap();
        assert_eq!(opts.len(), 2);
        assert_eq!(opts[1].choose_title.as_deref(), Some("手机号模糊"));
        assert_eq!(opts[1].choose, Some(false));
        assert_eq!(opts[1].value.as_deref(), Some(""));
    }

    /// 已有「手机号模糊」→ 幂等；非配送信息项不受影响。
    #[test]
    fn fill_mobile_is_idempotent_and_scoped() {
        let mut items = vec![
            create_template_item("配送信息", vec![create_option("手机号模糊", true, "")]),
            create_template_item("商品信息", vec![create_option("商品基础信息", true, "")]),
        ];
        assert_eq!(fill_mobile(&mut items), Some(()));
        assert_eq!(items[0].options.as_ref().unwrap().len(), 1);
        assert_eq!(items[1].options.as_ref().unwrap().len(), 1);
    }

    /// `options == null` → `None`（Java 在 `fillMobile` 抛 NPE → 回退默认模板）。
    #[test]
    fn fill_mobile_returns_none_on_null_options() {
        let mut items = vec![PrintTemplateItem {
            title: Some("配送信息".to_string()),
            options: None,
        }];
        assert_eq!(fill_mobile(&mut items), None);
    }

    /// `parse_template` 解析失败 / options 缺失 → `None`。
    #[test]
    fn parse_template_failure_paths() {
        assert!(parse_template("not-json").is_none());
        assert!(parse_template(r#"[{"title":"配送信息"}]"#).is_none());
        // 正常路径：解析后补齐二维码
        let ok = parse_template(r#"[{"title":"其他订单信息","options":[]}]"#).unwrap();
        assert_eq!(ok.len(), 2);
        assert_eq!(ok[1].title.as_deref(), Some("二维码"));
    }

    // ————————————————————— build_vo_template —————————————————————

    /// 列值为 null / 空串 → VO `template = null`（**不**回退默认模板）。
    #[test]
    fn build_vo_template_null_and_empty_stay_null() {
        assert_eq!(build_vo_template(None), None);
        assert_eq!(build_vo_template(Some("")), None);
        // 纯空白不是 isEmpty → 解析失败 → 回退默认模板
        assert_eq!(
            build_vo_template(Some("   ")),
            Some(default_receipt_template())
        );
    }

    /// 解析失败 → 默认模板；解析成功 → 补齐后的模板。
    #[test]
    fn build_vo_template_falls_back_to_default() {
        assert_eq!(
            build_vo_template(Some("{oops")),
            Some(default_receipt_template())
        );
        let t = build_vo_template(Some(r#"[{"title":"其他订单信息","options":[]}]"#)).unwrap();
        assert_eq!(t.len(), 2);
        assert_eq!(t[0].title.as_deref(), Some("其他订单信息"));
        assert_eq!(t[1].title.as_deref(), Some("二维码"));
    }

    // ————————————————————— 校验 —————————————————————

    /// `update` 校验：先判 id 再判 template，文案各自独立。
    #[test]
    fn validate_update_reports_errors_in_order() {
        assert_eq!(
            validate_update(&PrintConfigUpdateDTO::default()).unwrap_err(),
            MSG_CONFIG_ID_REQUIRED
        );
        assert_eq!(
            validate_update(&PrintConfigUpdateDTO {
                id: Some(3),
                template: None,
                paper_size: None,
            })
            .unwrap_err(),
            MSG_TEMPLATE_REQUIRED
        );
        // 空数组合法（Java @NotNull 只拦 null）
        let (id, tpl) = validate_update(&PrintConfigUpdateDTO {
            id: Some(3),
            template: Some(Vec::new()),
            paper_size: None,
        })
        .unwrap();
        assert_eq!(id, 3);
        assert!(tpl.is_empty());
    }

    /// `print` 校验：`ids` 为 null 才报错，空数组放行。
    #[test]
    fn validate_print_allows_empty_but_not_null() {
        assert_eq!(
            validate_print(&PrintOrdersDTO::default()).unwrap_err(),
            MSG_ORDER_IDS_REQUIRED
        );
        assert_eq!(
            validate_print(&PrintOrdersDTO {
                ids: Some(Vec::new()),
                device_code: None,
            })
            .unwrap(),
            Vec::<i32>::new()
        );
    }

    /// 设备码归一：空白 → `None`；有值 → trim。
    #[test]
    fn normalize_device_code_trims_and_blanks_out() {
        assert_eq!(normalize_device_code(None), None);
        assert_eq!(normalize_device_code(Some("")), None);
        assert_eq!(normalize_device_code(Some("   ")), None);
        assert_eq!(normalize_device_code(Some("  A1 \n")), Some("A1".into()));
    }

    // ————————————————————— 出参 / 入参序列化 —————————————————————

    /// VO 九个键齐全、camelCase，`type` 键名不得变成 `configType`。
    #[test]
    fn vo_serializes_camel_case_with_all_keys() {
        let vo = PrintConfigVO {
            id: 1,
            print_id: 2,
            template: None,
            config_type: Some(1),
            type_desc: "购物小票".into(),
            paper_size: 58,
            paper_size_desc: "58mm".into(),
            add_time: String::new(),
            update_time: String::new(),
        };
        let v: serde_json::Value = serde_json::to_value(&vo).unwrap();
        let obj = v.as_object().unwrap();
        assert_eq!(obj.len(), 9);
        for key in [
            "id",
            "printId",
            "template",
            "type",
            "typeDesc",
            "paperSize",
            "paperSizeDesc",
            "addTime",
            "updateTime",
        ] {
            assert!(obj.contains_key(key), "缺少键 {key}");
        }
        assert!(!obj.contains_key("configType"));
        // template 为 null 时必须是 JSON null（Jackson Include.ALWAYS 语义）
        assert!(v["template"].is_null());
        // 数字型 paperSize（不是字符串）
        assert_eq!(v["paperSize"], serde_json::json!(58));
    }

    /// 模板项 / 选项的 camelCase 键名与 Java 一致。
    #[test]
    fn template_types_serialize_camel_case() {
        let item = create_template_item("配送信息", vec![create_option("配送方式", true, "")]);
        let v: serde_json::Value = serde_json::to_value(&item).unwrap();
        assert!(v.get("title").is_some());
        let opt = &v["options"][0];
        assert_eq!(opt["chooseTitle"], serde_json::json!("配送方式"));
        assert_eq!(opt["choose"], serde_json::json!(true));
        assert_eq!(opt["value"], serde_json::json!(""));
    }

    /// `update` 入参 camelCase 反序列化 + 未知字段忽略（Java
    /// `FAIL_ON_UNKNOWN_PROPERTIES=false`）。
    #[test]
    fn update_dto_deserializes_camel_case_and_ignores_unknown() {
        let dto: PrintConfigUpdateDTO = serde_json::from_str(
            r#"{"id":5,"paperSize":80,"template":[{"title":"x","options":[],"extra":1}]}"#,
        )
        .unwrap();
        assert_eq!(dto.id, Some(5));
        assert_eq!(dto.paper_size, Some(80));
        assert_eq!(dto.template.as_ref().unwrap().len(), 1);

        // 缺省字段全部 None
        let dto: PrintConfigUpdateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.id, None);
        assert_eq!(dto.template, None);
        assert_eq!(dto.paper_size, None);
    }

    /// `print` 入参 camelCase 反序列化（`deviceCode` 必须能解析）。
    #[test]
    fn print_dto_deserializes_device_code() {
        let dto: PrintOrdersDTO =
            serde_json::from_str(r#"{"ids":[1,2],"deviceCode":"POS-1"}"#).unwrap();
        assert_eq!(dto.ids, Some(vec![1, 2]));
        assert_eq!(dto.device_code.as_deref(), Some("POS-1"));

        let dto: PrintOrdersDTO = serde_json::from_str(r#"{"ids":[]}"#).unwrap();
        assert_eq!(dto.ids, Some(vec![]));
        assert_eq!(dto.device_code, None);
    }

    /// 显式 `null` 的 `paperSize` 与「字段缺失」在 serde 侧都落到 `None`
    /// —— 即都会保留原值。Java 侧显式 `null` 会经
    /// `PrintPaperSizeEnum#fromCode(null)` 兜底成 58mm，两者**不同**，
    /// 见 `uncertain_points`。
    #[test]
    fn paper_size_explicit_null_and_absent_both_none() {
        let absent: PrintConfigUpdateDTO =
            serde_json::from_str(r#"{"id":1,"template":[]}"#).unwrap();
        let explicit_null: PrintConfigUpdateDTO =
            serde_json::from_str(r#"{"id":1,"template":[],"paperSize":null}"#).unwrap();
        assert_eq!(absent.paper_size, None);
        assert_eq!(explicit_null.paper_size, None);
    }
}
