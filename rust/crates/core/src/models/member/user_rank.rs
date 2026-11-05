//! 会员等级（`UserRankController`）域 DTO / VO / 查询参数（member::user_rank）。
//!
//! 对应原 Java（`tigshop-bean` / `tigshop-common`）：
//!
//! | 本文件类型 | 原 Java |
//! |-----------|---------|
//! | [`UserRankListQuery`] | `com.tigshop.bean.dto.user.UserRankListDTO`（继承 `BasePage`） |
//! | [`UserRankDTO`] | `com.tigshop.bean.dto.user.UserRankDTO` |
//! | [`UserRankEditParam`] | `com.tigshop.bean.query.user.UserRankEditParam` |
//! | [`UserRankListVO`] | `com.tigshop.bean.vo.user.UserRankListVO` |
//! | [`UserRankNotProListVO`] | `com.tigshop.bean.vo.user.UserRankNotProListVO` |
//! | [`UserRankConfigVO`] | `com.tigshop.bean.vo.user.UserRankConfigVO` |
//! | [`RankRightVO`] / [`RankRightInput`] | `UserRankListVO.Right` / `UserRankEditParam.Right` |
//! | [`OperateDTO`] / [`UpdateFieldDTO`] / [`BatchDTO`] | `com.tigshop.bean.dto.common.*`（本域自持副本） |
//!
//! 实体（表 `user_rank` / `user_rank_config`）已由
//! `tigshop_core::entities::user::{UserRank, UserRankConfig}` 自动生成，本文件不重复定义。
//!
//! ## 金额 / 精度
//!
//! `user_rank.min_growth_points` 是 `decimal(10,2)`、`discount` 是 `decimal(4,1)`，
//! 一律用 `rust_decimal::Decimal`，**禁止** `f64` / `f32`。
//!
//! ## ⚠️ 本域三处必须照抄的 Java 怪癖
//!
//! 1. **列表分页响应是 MyBatis-Plus `Page` 而不是项目统一 `PageResult`**：
//!    `listByPro` / `list` 返回 `Map<String, Object>`，其中 `userRank` 是
//!    `Page<...>`（JSON 里是 `records` / `total` / `size` / `current` / `pages`），
//!    前端 `view/admin` 的 `ProList.vue` 直接读 `result.userRank.records`。
//!    因此本域用 [`RankPageResult`]（Page 的字段子集），**不**套用 `PageResult`。
//! 2. **`getUserRights` 会把 `rankPoint = "0"` 也算作一条权益**：
//!    Java 判据是 `!rankPoint.isEmpty()`（不是「数值 > 0」），而库列
//!    `rank_point` 是 `NOT NULL DEFAULT '0'`，所以典型行会多出
//!    `"0倍积分回馈"`。见 [`build_user_rights`]。
//! 3. **`rankLevel` 在库列里是 `varchar(30)`，但 Java 实体/VO 都是 `Integer`**：
//!    本文件用 [`rank_level_to_i32`] 做「字符串 → 整数」转换（解析失败回退 0）。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::entities::user::{UserRank, UserRankConfig};
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// 版本开关 `tigshopProperties.getIsPro()`。
///
/// 取值来自随包发布的
/// `java/tigshop-adminapi/src/main/resources/application.yaml`
/// 的 `tigshop.is-pro: 1`（与 message_type 的 `EditionFlags::default()` 口径一致）。
///
/// ⚠️ 部署为**非 Pro 版**时必须改这里并重新编译，否则
/// `listByPro` / `detail` / `update` 的分支会与 Java 不一致。
pub const IS_PRO: i32 = 1;

/// 「是」（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否」（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// Java `HttpStatus.SERVICE_DATA_ERROR = 1001`
/// （`GlobalException` 的默认业务码）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// `user_rank` 的 15 个真实列
/// （`cd rust && python tools/schema_parser.py --table user_rank`）。
pub const USER_RANK_COLUMNS: [&str; 15] = [
    "rank_id",
    "rank_name",
    "min_growth_points",
    "max_growth_points",
    "discount",
    "show_price",
    "rank_type",
    "rank_logo",
    "rank_ico",
    "rank_bg",
    "rank_point",
    "free_shipping",
    "rank_card_type",
    "rights",
    "rank_level",
];

/// `user_rank_config` 的 4 个真实列
/// （`python tools/schema_parser.py --table user_rank_config`）。
pub const USER_RANK_CONFIG_COLUMNS: [&str; 4] = ["id", "code", "rank_type", "data"];

/// `user_rank` 主键列（Java `BaseServiceImpl#getKeyColumn`）。
pub const KEY_COLUMN: &str = "rank_id";

/// `user_rank` 主键属性名（Java `BaseServiceImpl#getKeyProperty`）。
pub const KEY_PROPERTY: &str = "rankId";

/// `updateField` 允许更新的列，逐字符对应 Java
/// `CheckFieldConstants.USER_RANK_FIELDS`
/// = `{"rank_name", "discount", "min_growth_points", "max_growth_points"}`。
///
/// ⚠️ 四项都是 `user_rank` 的**真实列**，因此本域 `updateField` 不存在
/// logistics::shipping_tpl 那种「白名单含幻影列」的缺陷；未知字段名会按 Java 的
/// `getColumnByPropertyName` 回退主键列 `rank_id`，而 `rank_id`
/// **不在**白名单里 ⇒ 被拒绝。
pub const USER_RANK_FIELDS: [&str; 4] = [
    "rank_name",
    "discount",
    "min_growth_points",
    "max_growth_points",
];

/// 等级配置行 `user_rank_config.code`（Java 里是内联字面量 `"rank_config"`）。
pub const RANK_CONFIG_CODE: &str = "rank_config";

/// 成长值配置行 `user_rank_config.code`（Java `detail` / `update` 用 `"grow_config"`）。
///
/// ⚠️ `UserRankServiceImpl#getRankInfo` 里用的是 `"grow_setting"`，
/// 与本域 `detail` / `update` 的 `"grow_config"` **不同名**；本域按 `detail`
/// 与 `update` 的源码用 `grow_config`。
pub const GROW_CONFIG_CODE: &str = "grow_config";

/// `data` 列表长度下限（Java `@Size(min = 1, max = 10)`）。
pub const DATA_MIN_LEN: usize = 1;

/// `data` 列表长度上限（Java `@Size(min = 1, max = 10)`）。
pub const DATA_MAX_LEN: usize = 10;

/// `BasePage.getSize()` 缺省 15。
pub const DEFAULT_PAGE_SIZE: u64 = 15;

/// `BasePage.getSize()` 上限 100。
pub const MAX_PAGE_SIZE: u64 = 100;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
//
// 来源：`com.tigshop.common.constant.user.UserRankConstants` /
//      `com.tigshop.common.constant.ResultTextConstants` /
//      `UserRankEditParam` 上的 `@Size` message。

/// `UserRankConstants.RANK_NAME_EXISTS = "等级名称已存在"`
/// （`checkUserRank` 查重命中时抛，业务码 `SERVICE_DATA_ERROR`）。
pub const MSG_RANK_NAME_EXISTS: &str = "等级名称已存在";

/// `ResultTextConstants.ID_CANNOT_IS_NULL = "id不能为空"`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// `ResultTextConstants.FIELD_NAME_CANNOT_BE_NULL = "字段名不能为空"`。
pub const MSG_FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// `ResultTextConstants.INVALID_FIELD_VALUE = "field 的值有误"`。
pub const MSG_INVALID_FIELD_VALUE: &str = "field 的值有误";

/// `UserRankEditParam#validParam` 里的 `GlobalException("请选择会员等级类型")`。
pub const MSG_RANK_TYPE_REQUIRED: &str = "请选择会员等级类型";

/// `UserRankEditParam#validParam` 里的 `GlobalException("请填写成长值设置")`。
pub const MSG_GROW_UP_SETTING_REQUIRED: &str = "请填写成长值设置";

/// `UserRankEditParam.data` 上的
/// `@Size(min = 1, max = 10, message = "用户等级；不能少于1条，不能大于10条")`。
pub const MSG_DATA_SIZE_INVALID: &str = "用户等级；不能少于1条，不能大于10条";

/// Rust 侧补的文案：`data` 字段整体缺失时使用。
///
/// Java 侧 `data` 为 `null` 时 `@Size` **跳过**校验（`@Size` 对 null 有效），
/// 随后 `param.getData().stream()` 抛 `NullPointerException`（HTTP 500）。
/// 本实现提前返回 400（见 `uncertain_points`）。
pub const MSG_DATA_REQUIRED: &str = "用户等级数据不能为空";

/// Rust 侧补的文案：`rankType` 缺失时使用。
///
/// Java `validParam` 里 `this.rankType == 0` 会对 `Integer` 拆箱，
/// `rankType == null` 时抛 `NullPointerException`（HTTP 500）。
/// 本实现提前返回 400（见 `uncertain_points`）。
pub const MSG_RANK_TYPE_MISSING: &str = "会员等级类型不能为空";

/// Rust 侧补的文案：`detail` 取不到 `rank_config` 行时使用。
///
/// Java `UserRankServiceImpl#detail` 里
/// `userRankConfigMapper.selectOne(...).getRankType()` 在无记录时
/// 抛 `NullPointerException`（HTTP 500）。本实现返回同码可诊断业务错误
/// （见 `uncertain_points`）。
pub const MSG_RANK_CONFIG_MISSING: &str = "会员等级配置不存在";

// ————————————————————— 初始化默认值（逐字符照抄 Java 字面量） —————————————————————
//
// 来源：`UserRankServiceImpl#getUserRankListInitDTO` /
//      `#getUserRankListNotProInitDTO` / `#getRankConfigInit` /
//      `#getGrowUpSettingInit`。

/// `getUserRankListInitDTO().getRankLevel()`。
pub const INIT_RANK_LEVEL: i32 = 1;

/// `getUserRankListInitDTO().getRankName()` / `getUserRankListNotProInitDTO().getRankName()`。
pub const INIT_RANK_NAME: &str = "黄金会员";

/// `getUserRankListInitDTO().getRankLogo()`（Pro 版默认图标）。
pub const INIT_RANK_LOGO_PRO: &str =
    "https://oss.tigshop.com/img/gallery/202501/1737524324ro1DJxNm3aQowZKnPU.png";

/// `getUserRankListNotProInitDTO().getRankLogo()`（非 Pro 版默认图标）。
pub const INIT_RANK_LOGO_NOT_PRO: &str =
    "https://oss.tigshop.com/img/gallery/202501/1735803176Yh9mCaE2r9ebXK3bGm.png";

/// `getUserRankListInitDTO().getRankIco()`。
pub const INIT_RANK_ICO: &str = "card1";

/// `getRankConfigInit().getRankAfterMonth()` / `useMonth()`。
pub const INIT_RANK_AFTER_MONTH: i32 = 12;

/// `getGrowUpSettingInit()` 各字段的默认值（全部为 1）。
pub const INIT_GROW_UP_VALUE: i32 = 1;

// ——————————————————————————————————————————————
// 分页出参（MyBatis-Plus `Page` 的字段子集）
// ——————————————————————————————————————————————

/// 复刻 MyBatis-Plus `Page<T>` 的 JSON 形态（前端读 `records`）。
///
/// Java `listByPro` / `list` 把 `Page` 放进 `Map` 的 `userRank` 键，
/// 前端 `ProList.vue` 用 `result.userRank.records` 取值，
/// 因此这里必须叫 `records`（**不是**项目统一 `PageResult` 的 `list`）。
///
/// ⚠️ 只输出前端实际使用的 5 个字段；MyBatis-Plus `Page` 还会额外序列化
/// `orders` / `optimizeCountSql` / `searchCount` / `maxLimit` / `countId` 等
/// 内部开关，本实现**不**伪造这些内部字段（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankPageResult<T> {
    /// 当前页数据
    pub records: Vec<T>,
    /// 满足条件的总行数
    pub total: u64,
    /// 每页条数
    pub size: u64,
    /// 当前页码（从 1 开始）
    pub current: u64,
    /// 总页数（`total == 0` 时为 0，与 MyBatis-Plus 一致）
    pub pages: u64,
}

impl<T> RankPageResult<T> {
    /// 按查询参数构造（`size` 夹在 `1..=100`，`current` 至少为 1）。
    #[must_use]
    pub fn new(records: Vec<T>, total: u64, q: &PageQuery) -> Self {
        let size = q.page_size.clamp(1, MAX_PAGE_SIZE);
        let current = q.page.max(1);
        Self {
            records,
            total,
            size,
            current,
            pages: total.div_ceil(size),
        }
    }
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 权益对象（读侧），对应 Java `UserRankListVO.Right`。
///
/// ⚠️ `value` 在 Java 里是 **`String`**，而写侧
/// [`RankRightInput::value`] 是 `BigDecimal`；fastjson 会把 JSON 数字
/// 读成字符串，因此这里用 [`de_opt_string_lenient`] 同时接受数字与字符串。
///
/// 库里的 `user_rank.rights` 既可能是 camelCase（Jackson 写入）也可能是
/// snake_case（初始化 SQL 写入，见 `pure.sql`），因此
/// `showName` / `isChecked` 都带 snake_case 别名。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankRightVO {
    /// 权益名称
    #[serde(default)]
    pub name: Option<String>,
    /// 展示名称（库中亦可能为 `show_name`）
    #[serde(default, alias = "show_name")]
    pub show_name: Option<String>,
    /// 图标 URL
    #[serde(default)]
    pub icon: Option<String>,
    /// 权益值（Java 侧是 `String`，JSON 里可能是数字）
    #[serde(default, deserialize_with = "de_opt_string_lenient")]
    pub value: Option<String>,
    /// 描述
    #[serde(default, alias = "desc")]
    pub describe: Option<String>,
    /// 是否选中（库中亦可能为 `is_checked`；Java 是 `int`）
    #[serde(default, alias = "is_checked", deserialize_with = "de_i32_lenient")]
    pub is_checked: i32,
}

/// 管理端（Pro）会员等级列表项，对应 Java `UserRankListVO`。
///
/// ⚠️ 可空字段必须保持 `Option`，因为 Java 的
/// `BeanUtils.copyProperties` 在**类型不兼容时会静默跳过**：
/// - 正常路径（`toUserRankListVO`）：`rankPoint`（实体 `String` → VO `String`）
///   与 `rights`（`parseRights` 结果）都会被设置；
/// - 空列表兜底路径（`getUserRankListInitDTO` 拷贝）：`UserRankListInitDTO.rankPoint`
///   是 `Integer`、`rights` 是 `List<String>`，与 VO 的 `String` / `List<Right>`
///   不兼容 ⇒ **保持 null**。
///
/// `userRights` 同理：兜底路径不设置 ⇒ `null`；正常路径是
/// [`build_user_rights`] 的返回值（可能是空串）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRankListVO {
    /// 权益文案（Java `getUserRights` 拼接结果；兜底路径为 null）
    #[serde(default)]
    pub user_rights: Option<String>,
    /// 该等级用户数（`detail` 不统计，恒为 0）
    #[serde(default)]
    pub user_count: i32,
    /// 等级 ID
    #[serde(default)]
    pub rank_id: i32,
    /// 等级名称
    #[serde(default)]
    pub rank_name: String,
    /// 最低成长值 / 消费额（`decimal(10,2)`）
    #[serde(default)]
    pub min_growth_points: Decimal,
    /// 最高成长值（已弃用）
    #[serde(default)]
    pub max_growth_points: i32,
    /// 折扣（`decimal(4,1)`）
    #[serde(default)]
    pub discount: Decimal,
    /// 是否显示价格（已弃用）
    #[serde(default)]
    pub show_price: i32,
    /// 等级类型 1 成长值 2 消费
    #[serde(default)]
    pub rank_type: i32,
    /// 会员图标
    #[serde(default)]
    pub rank_logo: String,
    /// 会员等级图标（卡面样式名）
    #[serde(default)]
    pub rank_ico: String,
    /// 会员等级背景图
    #[serde(default)]
    pub rank_bg: String,
    /// 权益积分（库列是 `varchar(30)`；兜底路径为 null）
    #[serde(default)]
    pub rank_point: Option<String>,
    /// 是否包邮 1 是 0 否
    #[serde(default)]
    pub free_shipping: i32,
    /// 会员卡类型 1 背景色 2 自定义图片
    #[serde(default)]
    pub rank_card_type: i32,
    /// 自定义权益（兜底路径为 null）
    #[serde(default)]
    pub rights: Option<Vec<RankRightVO>>,
    /// 会员等级（库列 `varchar(30)`，Java 侧是 `Integer`）
    #[serde(default)]
    pub rank_level: i32,
}

/// 非 Pro 版会员等级列表项，对应 Java `UserRankNotProListVO`。
///
/// 兜底路径（`UserRankListNotProInitDTO`）只设置了
/// `rankLevel` / `rankName` / `rankLogo`，因此 `rankId` 与 `userCount`
/// 都是 `null`（Java 的 `Integer` 字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRankNotProListVO {
    /// 等级 ID
    #[serde(default)]
    pub rank_id: Option<i32>,
    /// 该等级用户数
    #[serde(default)]
    pub user_count: Option<i32>,
    /// 等级名称
    #[serde(default)]
    pub rank_name: Option<String>,
    /// 等级 logo
    #[serde(default)]
    pub rank_logo: Option<String>,
    /// 等级级别
    #[serde(default)]
    pub rank_level: Option<i32>,
}

/// 会员等级配置 VO，对应 Java `UserRankConfigVO`。
///
/// `data` 是**已解析的 JSON 对象**（Java 用
/// `JsonUtil.fromJson(cfg.getData(), JSONObject.class)`），不是字符串。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRankConfigVO {
    /// 配置行主键
    #[serde(default)]
    pub id: Option<i32>,
    /// 配置编码
    #[serde(default)]
    pub code: Option<String>,
    /// 等级类型
    #[serde(default)]
    pub rank_type: Option<i32>,
    /// 等级配置（已解析）
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// 成长值设置出参，对应 Java `GrowUpSettingInitDTO`。
///
/// 字段全部可空：`detail` 会把 `grow_config.data` 反序列化到该 DTO，
/// 库里缺哪个键，响应里就是 `null`（Jackson 默认输出 null）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrowUpSettingVO {
    /// 完成下单是否赠送
    #[serde(default)]
    pub buy_order: Option<i32>,
    /// 每 N 笔订单
    #[serde(default)]
    pub buy_order_number: Option<i32>,
    /// 赠送成长值
    #[serde(default)]
    pub buy_order_growth: Option<i32>,
    /// 完善信息是否赠送
    #[serde(default)]
    pub evpi: Option<i32>,
    /// 完善信息赠送成长值
    #[serde(default)]
    pub evpi_growth: Option<i32>,
    /// 绑定手机是否赠送
    #[serde(default)]
    pub bind_phone: Option<i32>,
    /// 绑定手机赠送成长值
    #[serde(default)]
    pub bind_phone_growth: Option<i32>,
}

impl GrowUpSettingVO {
    /// Java `UserRankServiceImpl#getGrowUpSettingInit()` 的默认值（全 1）。
    #[must_use]
    pub fn init() -> Self {
        Self {
            buy_order: Some(INIT_GROW_UP_VALUE),
            buy_order_number: Some(INIT_GROW_UP_VALUE),
            buy_order_growth: Some(INIT_GROW_UP_VALUE),
            evpi: Some(INIT_GROW_UP_VALUE),
            evpi_growth: Some(INIT_GROW_UP_VALUE),
            bind_phone: Some(INIT_GROW_UP_VALUE),
            bind_phone_growth: Some(INIT_GROW_UP_VALUE),
        }
    }
}

// ——————————————————————————————————————————————
// listByPro / detail 出参
// ——————————————————————————————————————————————

/// `listByPro` 的响应体（Pro 版）。
///
/// 对应 Java `UserRankController#listByPro` 的
/// `Map.of("userRank", userRankService.list(dto), "rankConfig", userRankConfigVO)`。
///
/// ⚠️ `user_rank` 是 MyBatis-Plus `Page` 的形态（[`RankPageResult`]），
/// **不是**项目统一的 `PageResult`：前端 `ProList.vue` 读 `result.userRank.records`。
///
/// ⚠️ Java 在 `tigshopProperties.getIsPro() != 1` 时返回
/// `Map.of("userRank", emptyList(), "rankConfig", emptyList())`（两个空数组）。
/// 本仓库随包配置 `tigshop.is-pro = 1`（见 [`IS_PRO`]），该分支不可达，
/// 因此本实现只提供 Pro 形态（见 `uncertain_points`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankListByProVO {
    /// 会员等级分页（MyBatis-Plus `Page` 形态）
    pub user_rank: RankPageResult<UserRankListVO>,
    /// 会员等级配置
    pub rank_config: UserRankConfigVO,
}

/// 会员等级详情出参，对应 Java `UserRankDetailVO<T>`。
///
/// `detail` 只走 Pro 分支（`tigshop.is-pro = 1`），因此 `user_rank_list`
/// 的元素类型是 [`UserRankListVO`]。
///
/// ⚠️ Java 的 `growUpSetting` 字段是 `Object`：
/// Pro 分支放 `GrowUpSettingInitDTO`（本实现用 [`GrowUpSettingVO`]），
/// 非 Pro 分支放空串 `""`。本实现只提供 Pro 形态 ⇒
/// `Option<GrowUpSettingVO>`（`None` 仅出现在 `grow_config.data` 无法解析时）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserRankDetailVO<T> {
    /// 会员等级类型（Java 取自 `user_rank_config` 的 `rank_config` 行）
    pub rank_type: i32,
    /// 会员等级列表
    pub user_rank_list: Vec<T>,
    /// 会员等级配置
    pub user_rank_config: UserRankConfigVO,
    /// 会员成长值配置（Java 里是 `Object`；Pro 分支为对象或 null）
    pub grow_up_setting: Option<GrowUpSettingVO>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询参数，对应 Java `UserRankListDTO extends BasePage`。
///
/// ⚠️ `showPrice` 在 Java 里**声明了但从未使用**（`UserRankServiceImpl#list`
/// 只读 `keyword` / `sortField` / `sortOrder` / `page` / `size` / `rankType`），
/// 这里保留字段仅为契约对齐。
///
/// ⚠️ 名称模糊搜索用的是继承来的 **`keyword`**，**不是** `rankName`
/// （`getUserRankQueryWrapper` 里是 `dto.getKeyword()`）。前端
/// `levelManagePro/src/ProList.vue` 传的是 `rankName`，因此该搜索实际不生效
/// —— 这是 Java 的既有行为，本实现照抄（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankListQuery {
    /// 是否显示商品价格（Java 声明但未使用）
    pub show_price: Option<i32>,
    /// 会员等级类型（`> 0` 时才加 `rank_type = ?`）
    pub rank_type: Option<i32>,
    /// 等级名称模糊匹配（Java `BasePage.keyword`，`LIKE %keyword%`）
    pub keyword: Option<String>,
    /// 排序字段（驼峰属性名或数据库列名）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（`list` 为空时补 `asc`；`listNotPro` 为空时按 `desc`）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15、上限 100（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl UserRankListQuery {
    /// 有效关键字（Java `StrUtil.isNotEmpty`：**不 trim**，
    /// 因此 `"   "` 仍会参与 `LIKE '%   %'`，与 area_code 的 `isNotBlank` 不同）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.is_empty())
    }

    /// 是否加 `rank_type` 过滤（Java `rankType != null && rankType > 0`）。
    #[must_use]
    pub fn effective_rank_type(&self) -> Option<i32> {
        self.rank_type.filter(|v| *v > 0)
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1、`size` 默认 15 且 `> 100 → 100`。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`），避免 `size = 0` 生成
    /// `LIMIT 0`（见 `uncertain_points`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// 解析 ORDER BY 子句
    /// （Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)`）。
    ///
    /// - `sortField` 为空或等于主键属性名 `rankId` ⇒ 主键列 `rank_id`
    /// - 其余走 [`map_order_column`]：未识别字段**回退主键列**（防注入）
    /// - `asc`（忽略大小写）升序；`desc` / 空 ⇒ 降序；
    ///   其它非法值**完全不追加 ORDER BY**（Java 是 `else if` 的缺口）
    ///
    /// `default_asc` 对应 Java `list` 里「`sortOrder` 为空则补 `asc`」的那一行；
    /// `listNotPro` 没有这一行，所以传 `false`（空 ⇒ 降序）。
    #[must_use]
    pub fn order_clause(&self, default_asc: bool) -> String {
        let field = self.sort_field.as_deref().unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        let order = match self.sort_order.as_deref() {
            Some(s) if !s.is_empty() => Some(s),
            _ if default_asc => Some("asc"),
            _ => None,
        };
        match order {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            // Java `buildSortOrder` 是 `if asc {..} else if desc||empty {..}`，
            // 非法值落到两分支之外 ⇒ 无 ORDER BY
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都能命中；
/// 未命中一律回退主键列（MyBatis-Plus 的防注入行为，**不是报错**）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "rankId" | "rank_id" | "id" => "rank_id",
        "rankName" | "rank_name" => "rank_name",
        "minGrowthPoints" | "min_growth_points" => "min_growth_points",
        "maxGrowthPoints" | "max_growth_points" => "max_growth_points",
        "discount" => "discount",
        "showPrice" | "show_price" => "show_price",
        "rankType" | "rank_type" => "rank_type",
        "rankLogo" | "rank_logo" => "rank_logo",
        "rankIco" | "rank_ico" => "rank_ico",
        "rankBg" | "rank_bg" => "rank_bg",
        "rankPoint" | "rank_point" => "rank_point",
        "freeShipping" | "free_shipping" => "free_shipping",
        "rankCardType" | "rank_card_type" => "rank_card_type",
        "rights" => "rights",
        "rankLevel" | "rank_level" => "rank_level",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（与 [`map_order_column`] 同一张表，
/// 因为 Java 两者都走 `getColumnByPropertyName`）。
#[must_use]
pub fn map_update_field_column(field: &str) -> &'static str {
    map_order_column(field)
}

/// 新增会员等级入参，对应 Java `com.tigshop.bean.dto.user.UserRankDTO`。
///
/// ⚠️ 字段上的 `@NotNull`（`rankName` / `minGrowthPoints` / `maxGrowthPoints`
/// / `discount`）在 `create` 里**不会生效**：控制器签名是
/// `create(@RequestBody UserRankDTO userRank)`，**没有** `@Valid` / `@Validated`，
/// 类级 `@Validated` 只对方法参数上的约束（AOP 方法校验）生效。
/// 因此本实现同样不做必填校验（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankDTO {
    /// 等级 ID（非空时 MyBatis-Plus 会把主键显式写进 INSERT）
    pub rank_id: Option<i32>,
    /// 会员等级名称
    pub rank_name: Option<String>,
    /// 该等级的最低成长值（`decimal(10,2)`）
    pub min_growth_points: Option<Decimal>,
    /// 该等级的最高成长值
    pub max_growth_points: Option<i32>,
    /// 该会员等级的商品折扣（`decimal(4,1)`）
    pub discount: Option<Decimal>,
    /// 是否显示商品价格
    pub show_price: Option<i32>,
    /// 等级类型
    pub rank_type: Option<i32>,
    /// 等级图标
    pub rank_ico: Option<String>,
    /// 等级背景图（移动端）
    pub rank_bg: Option<String>,
}

/// 等级配置入参，对应 Java `UserRankEditParam.RankConfig`。
///
/// ⚠️ 实现 `Serialize` 是因为 `update` 要把该对象
/// `JsonUtil.toJson(param.getUserRankConfig())` 后写入
/// `user_rank_config.data`（`code = 'rank_config'`）。Jackson 默认**包含**
/// null 字段，serde 的 `Option` 同样序列化成 `null`，两者一致。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RankConfigInput {
    /// 类型 1 永久有效 2 周期重算
    pub r#type: Option<i32>,
    /// 等级有效期（月）
    pub rank_after_month: Option<i32>,
    /// 使用有效期（月）
    pub use_month: Option<i32>,
}

/// 成长值设置入参，对应 Java `UserRankEditParam.GrowUpSetting`。
///
/// ⚠️ 实现 `Serialize` 的理由同 [`RankConfigInput`]：`update` 会把它
/// `JsonUtil.toJson(param.getGrowUpSetting())` 后写入
/// `user_rank_config.data`（`code = 'grow_config'`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrowUpSettingInput {
    /// 完成下单是否赠送
    pub buy_order: Option<i32>,
    /// 每 N 笔订单
    pub buy_order_number: Option<i32>,
    /// 赠送成长值
    pub buy_order_growth: Option<i32>,
    /// 完善信息是否赠送
    pub evpi: Option<i32>,
    /// 完善信息赠送成长值
    pub evpi_growth: Option<i32>,
    /// 绑定手机是否赠送
    pub bind_phone: Option<i32>,
    /// 绑定手机赠送成长值
    pub bind_phone_growth: Option<i32>,
}

/// 权益对象（写侧），对应 Java `UserRankEditParam.Right`。
///
/// ⚠️ `value` 在 Java 里是 **`BigDecimal`**（与读侧 [`RankRightVO::value`]
/// 的 `String` 不同）；本实现按 `Decimal` 保存，写库时经 serde 输出为
/// JSON 字符串（`"1999"`），Java/Jackson 输出为数字（`1999`）。
/// 两者读回后都是字符串 `"1999"`，对外响应一致（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RankRightInput {
    /// 权益名称
    pub name: Option<String>,
    /// 展示名称
    pub show_name: Option<String>,
    /// 图标 URL
    pub icon: Option<String>,
    /// 权益值
    pub value: Option<Decimal>,
    /// 描述
    pub describe: Option<String>,
    /// 是否选中 0/1
    pub is_checked: Option<i32>,
}

/// 等级明细项，对应 Java `UserRankEditParam.UserRankData`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankData {
    /// 等级 ID（为空 ⇒ 新增；非空 ⇒ 更新）
    pub rank_id: Option<i32>,
    /// 等级名称
    pub rank_name: Option<String>,
    /// 最小成长值 / 消费额
    pub min_growth_points: Option<Decimal>,
    /// 最大成长值
    pub max_growth_points: Option<i32>,
    /// 折扣
    pub discount: Option<Decimal>,
    /// 是否显示价格
    pub show_price: Option<i32>,
    /// 等级类型（本域**不**使用该字段：Java 用 `param.rankType` 覆盖）
    pub rank_type: Option<i32>,
    /// 等级图标 URL
    pub rank_logo: Option<String>,
    /// 等级图标（卡面样式名）
    pub rank_ico: Option<String>,
    /// 等级背景
    pub rank_bg: Option<String>,
    /// 等级积分（Java `String`；为空时写 `"0"`）
    pub rank_point: Option<String>,
    /// 是否免运费
    pub free_shipping: Option<i32>,
    /// 等级卡类型
    pub rank_card_type: Option<i32>,
    /// 权益列表
    pub rights: Option<Vec<RankRightInput>>,
    /// 等级级别
    pub rank_level: Option<i32>,
}

/// 会员等级更新入参，对应 Java `com.tigshop.bean.query.user.UserRankEditParam`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserRankEditParam {
    /// 主键（本域未使用，仅契约对齐）
    pub id: Option<i32>,
    /// 等级类型 1 成长值 2 消费
    pub rank_type: Option<i32>,
    /// 等级配置
    pub user_rank_config: Option<RankConfigInput>,
    /// 成长设置
    pub grow_up_setting: Option<GrowUpSettingInput>,
    /// 用户等级数据列表（Java `@Size(min = 1, max = 10)`）
    pub data: Option<Vec<UserRankData>>,
}

/// 删除请求，对应 Java `com.tigshop.bean.dto.common.OperateDTO`（本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求，对应 Java `com.tigshop.bean.dto.common.UpdateFieldDTO`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名（属性名或列名）
    pub field: Option<String>,
    /// 值（统一按字符串 set，由 MySQL 按目标列类型隐式转换）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作请求，对应 Java `com.tigshop.bean.dto.common.BatchDTO`。
///
/// ⚠️ `value` 在 Java 里是原始 `int`（不可为 null、缺省 0）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表
    pub ids: Option<Vec<i32>>,
    /// 操作类型（只有 `"del"` 生效）
    pub r#type: Option<String>,
    /// 值（Java 原始 `int`，缺省 0）
    pub value: i32,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

impl BatchDTO {
    /// `type == "del"` 判据（Java `BaseServiceImpl#batch` 用 `"del".equals(...)`）。
    #[must_use]
    pub fn is_delete(&self) -> bool {
        self.r#type.as_deref() == Some("del")
    }

    /// 去重后的 id 列表（Java `removeByIds` 会自行去重）。
    #[must_use]
    pub fn effective_ids(&self) -> Vec<i32> {
        let mut ids: Vec<i32> = self
            .ids
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .copied()
            .filter(|v| *v > 0)
            .collect();
        ids.sort_unstable();
        ids.dedup();
        ids
    }
}

// ——————————————————————————————————————————————
// 纯逻辑辅助（便于单测）
// ——————————————————————————————————————————————

/// 复刻 Java `UserRankServiceImpl#getUserRights(UserRank)`。
///
/// 逐条对齐（注意判据都不是「数值 > 0」）：
/// 1. `freeShipping != 0` ⇒ `会员包邮`
/// 2. `discount != null && discount != 0` ⇒ `会员折扣{discount}折`
///    （`discount` 的字符串形态是 `BigDecimal.toString()`，如 `8.5`）
/// 3. `!rankPoint.isEmpty()` ⇒ `{rankPoint}倍积分回馈`
///    ⚠️ 库列 `rank_point` 是 `NOT NULL DEFAULT '0'`，所以 `"0"` **也算一条**，
///    典型行会多出 `0倍积分回馈`（Java 既有行为，照抄）。
/// 4. 非空时前缀 `享受`，各项用单个空格连接；全空 ⇒ 空串。
///
/// `rank_point` 为 `None` 时按空串处理（Java 会 NPE，本实现不 panic，
/// 见 `uncertain_points`）。
#[must_use]
pub fn build_user_rights(rank: &UserRank) -> String {
    let mut parts: Vec<String> = Vec::new();
    if rank.free_shipping != NO {
        parts.push("会员包邮".to_string());
    }
    if rank.discount != Decimal::ZERO {
        parts.push(format!("会员折扣{}折", rank.discount));
    }
    let rank_point = rank.rank_point.as_str();
    if !rank_point.is_empty() {
        parts.push(format!("{rank_point}倍积分回馈"));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!("享受{}", parts.join(" "))
    }
}

/// 复刻 Java `UserRankServiceImpl#parseRights(String)`。
///
/// - 空白串 ⇒ 空列表
/// - 解析失败（不是数组、JSON 非法）⇒ 空列表（Java `catch (Exception) {}`）
/// - `null` 数组 ⇒ 空列表
#[must_use]
pub fn parse_rights(raw: Option<&str>) -> Vec<RankRightVO> {
    let Some(text) = raw else {
        return Vec::new();
    };
    if text.trim().is_empty() {
        return Vec::new();
    }
    serde_json::from_str::<Vec<RankRightVO>>(text).unwrap_or_default()
}

/// 库列 `user_rank.rank_level` 是 `varchar(30)`，但 Java 实体 / VO 都是
/// `Integer` ⇒ 这里做「字符串 → 整数」转换，解析失败回退 0
/// （Java 侧由 JDBC 的 `getInt` 完成同样的转换，空串通常得到 0）。
#[must_use]
pub fn rank_level_to_i32(raw: &str) -> i32 {
    raw.trim().parse::<i32>().unwrap_or(0)
}

/// 把 `user_rank_config` 行转成 VO（`data` 文本 → JSON 对象）。
///
/// Java `BeanUtils.copyProperties(cfg, vo)` + `vo.setData(fromJson(cfg.getData(), JSONObject.class))`：
/// `data` 为空白或非法 JSON 时得到 `null`（Java 的 `JsonUtil.fromJson` 返回 null）。
#[must_use]
pub fn config_to_vo(cfg: &UserRankConfig) -> UserRankConfigVO {
    UserRankConfigVO {
        id: Some(cfg.id),
        code: Some(cfg.code.clone()),
        rank_type: Some(cfg.rank_type),
        data: parse_json_object(cfg.data.as_deref()),
    }
}

/// Java `JsonUtil.fromJson(String, JSONObject.class)` 的等价物：
/// 空白 / 非法 JSON ⇒ `None`；合法 JSON 值原样返回。
#[must_use]
pub fn parse_json_object(raw: Option<&str>) -> Option<serde_json::Value> {
    let text = raw?;
    if text.trim().is_empty() {
        return None;
    }
    serde_json::from_str::<serde_json::Value>(text).ok()
}

/// 把 `user_rank_config.data`（`code = 'grow_config'`）解析成 [`GrowUpSettingVO`]。
///
/// 对应 Java `UserRankServiceImpl#detail` 的
/// `JsonUtil.fromJson(userRankConfigGrow.getData(), GrowUpSettingInitDTO.class)`：
/// - `data` 为 `null` / 空串 ⇒ `None`（Java `fromJson` 直接返回 Java `null`）；
/// - `data` 是字面量 `"null"` ⇒ `None`
///   （Jackson `readValue("null", …)` = `null`，serde 用 `Option<T>` 表达同义）；
/// - 非法 JSON ⇒ `None`（Java `catch (IOException)` 吞掉后返回 `null`）；
/// - 合法 JSON 对象 ⇒ `Some`。
///
/// ⚠️ 用 `Option<GrowUpSettingVO>` 反序列化（而非直接 `GrowUpSettingVO`），
/// 才能把 `"null"` 正确识别为 `None`；直接反序列化到非 `Option` 会因类型不符报错。
#[must_use]
pub fn parse_grow_setting(raw: Option<&str>) -> Option<GrowUpSettingVO> {
    let text = raw?;
    if text.trim().is_empty() {
        return None;
    }
    // Java 侧是 `JSON.parseObject(raw, GrowUpSettingVO.class)`：只接受 JSON
    // **对象**。serde 的具名结构体也接受「数组按字段顺序」的反序列化（例如
    // `[1,2]` 会被解成前两个字段），与 Java 语义不符，因此先做对象校验。
    let value: serde_json::Value = serde_json::from_str(text).ok()?;
    if !value.is_object() {
        return None;
    }
    serde_json::from_value::<GrowUpSettingVO>(value).ok()
}

/// Java `getRankConfigInit()` 的 `data` 字段
/// （`{"type":1,"rankAfterMonth":12,"useMonth":12}`）。
#[must_use]
pub fn init_rank_config_data() -> serde_json::Value {
    serde_json::json!({
        "type": YES,
        "rankAfterMonth": INIT_RANK_AFTER_MONTH,
        "useMonth": INIT_RANK_AFTER_MONTH,
    })
}

/// Java `getRankConfigInit()` + `copyProperties` 后得到的
/// `UserRankConfigVO`（库里没有 `rank_config` 行时的兜底）。
#[must_use]
pub fn init_rank_config_vo() -> UserRankConfigVO {
    UserRankConfigVO {
        id: None,
        code: Some(RANK_CONFIG_CODE.to_string()),
        rank_type: Some(YES),
        data: Some(init_rank_config_data()),
    }
}

/// Java `getUserRankListInitDTO()` 拷贝进 `UserRankListVO` 后的结果
/// （列表为空时的兜底行）。
///
/// ⚠️ `rankPoint` / `rights` / `userRights` 保持 `None`：
/// `UserRankListInitDTO.rankPoint` 是 `Integer`、`rights` 是 `List<String>`，
/// 与 VO 的 `String` / `List<Right>` **类型不兼容**，
/// Spring `BeanUtils.copyProperties` 会静默跳过。
#[must_use]
pub fn init_rank_list_vo() -> UserRankListVO {
    UserRankListVO {
        user_rights: None,
        user_count: 0,
        rank_id: 0,
        rank_name: INIT_RANK_NAME.to_string(),
        min_growth_points: Decimal::ZERO,
        max_growth_points: 0,
        discount: Decimal::ZERO,
        show_price: 0,
        rank_type: 0,
        rank_logo: INIT_RANK_LOGO_PRO.to_string(),
        rank_ico: INIT_RANK_ICO.to_string(),
        rank_bg: String::new(),
        rank_point: None,
        free_shipping: 0,
        rank_card_type: YES,
        rights: None,
        rank_level: INIT_RANK_LEVEL,
    }
}

/// Java `getUserRankListNotProInitDTO()` 拷贝进 `UserRankNotProListVO` 后的结果。
///
/// 该 Init DTO 只有 `rankLevel` / `rankName` / `rankLogo` 三个字段，
/// 所以 `rankId` / `userCount` 都是 `null`。
#[must_use]
pub fn init_rank_not_pro_vo() -> UserRankNotProListVO {
    UserRankNotProListVO {
        rank_id: None,
        user_count: None,
        rank_name: Some(INIT_RANK_NAME.to_string()),
        rank_logo: Some(INIT_RANK_LOGO_NOT_PRO.to_string()),
        rank_level: Some(INIT_RANK_LEVEL),
    }
}

/// 由实体行构造管理端列表项（Java `toUserRankListVO`）。
///
/// `user_count` 由调用方按 Java 的
/// `userMapper.selectCount(eq(User::getRankId, rankId))` 单独查询后传入；
/// `detail` 路径不统计（传 0）。
#[must_use]
pub fn to_list_vo(rank: &UserRank, user_count: i32) -> UserRankListVO {
    UserRankListVO {
        user_rights: Some(build_user_rights(rank)),
        user_count,
        rank_id: rank.rank_id,
        rank_name: rank.rank_name.clone(),
        min_growth_points: rank.min_growth_points,
        max_growth_points: rank.max_growth_points,
        discount: rank.discount,
        show_price: rank.show_price,
        rank_type: rank.rank_type,
        rank_logo: rank.rank_logo.clone(),
        rank_ico: rank.rank_ico.clone(),
        rank_bg: rank.rank_bg.clone(),
        rank_point: Some(rank.rank_point.clone()),
        free_shipping: rank.free_shipping,
        rank_card_type: rank.rank_card_type,
        rights: Some(parse_rights(rank.rights.as_deref())),
        rank_level: rank_level_to_i32(&rank.rank_level),
    }
}

/// 由实体行构造非 Pro 列表项（Java `listNotPro` 的
/// `BeanUtils.copyProperties(userRankBo, vo)`）。
#[must_use]
pub fn to_not_pro_vo(rank: &UserRank, user_count: i32) -> UserRankNotProListVO {
    UserRankNotProListVO {
        rank_id: Some(rank.rank_id),
        user_count: Some(user_count),
        rank_name: Some(rank.rank_name.clone()),
        rank_logo: Some(rank.rank_logo.clone()),
        rank_level: Some(rank_level_to_i32(&rank.rank_level)),
    }
}

/// Java `UserRankEditParam.UserRankData#buildUserRank(int isPro, int rankType)`
/// 的纯逻辑结果（字段全部 `Option`，`None` = 不写该列）。
///
/// 逐条对照 Java：
/// - `rankId` / `rankName` / `rankCardType = 1` / `rankLevel` / `rankLogo`
///   无条件设置（`rankCardType` 先置 1）
/// - `isPro > 0` 时再设置 `minGrowthPoints` / `maxGrowthPoints` / `discount` /
///   `rankType`（**来自 `param.rankType`，不是 data 里的 rankType**）/
///   `rankIco` / `rankBg` / `rankLogo` / `rankPoint`（空 ⇒ `"0"`）/
///   `freeShipping` / `rankCardType`（来自 data）/ `rights`（`null` ⇒ `[]`）
///
/// 注意 `rankLevel` 在 Java 实体里是 `Integer`、库列是 `varchar(30)`，
/// 本函数返回 `Option<i32>`，写库时由仓储转成字符串。
#[must_use]
pub fn build_user_rank_fields(data: &UserRankData, is_pro: i32, rank_type: i32) -> UserRankFields {
    let mut out = UserRankFields {
        rank_id: data.rank_id,
        rank_name: data.rank_name.clone(),
        rank_card_type: Some(YES),
        rank_level: data.rank_level,
        rank_logo: data.rank_logo.clone(),
        ..UserRankFields::default()
    };
    if is_pro > 0 {
        out.min_growth_points = data.min_growth_points;
        out.max_growth_points = data.max_growth_points;
        out.discount = data.discount;
        out.rank_type = Some(rank_type);
        out.rank_ico = data.rank_ico.clone();
        out.rank_bg = data.rank_bg.clone();
        out.rank_point = Some(match data.rank_point.as_deref() {
            // Java `ObjectUtil.isEmpty(rankPoint) ? "0" : rankPoint`
            Some(v) if !v.is_empty() => v.to_string(),
            _ => "0".to_string(),
        });
        out.free_shipping = data.free_shipping;
        // ⚠️ Java 先 `.rankCardType(1)` 再用 `this.rankCardType` **覆盖**，
        //    因此 data 里为 null 时该字段变成 null（被 NOT_NULL 跳过），
        //    而不是回退到 1。这里逐字符复刻。
        out.rank_card_type = data.rank_card_type;
        out.rights = Some(rights_to_json(data.rights.as_deref()));
    }
    out
}

/// Java `JsonUtil.toJson(rights != null ? rights : new ArrayList<>())`。
///
/// ⚠️ Jackson 开了 `INDENT_OUTPUT`，Java 落库的是带缩进的 JSON；本实现写紧凑
/// JSON（读回后经 JSON 解析，对外响应逐字符一致，仅库里空白不同）。
/// 序列化失败（理论不可达）回退 `"[]"`。
#[must_use]
pub fn rights_to_json(rights: Option<&[RankRightInput]>) -> String {
    let empty: Vec<RankRightInput> = Vec::new();
    let list = rights.unwrap_or(&empty);
    serde_json::to_string(list).unwrap_or_else(|_| "[]".to_string())
}

/// `buildUserRank` 的字段快照（`None` = 不写该列）。
///
/// 与仓储层的写入结构解耦：本类型只描述「Java 会写哪些列、写什么值」，
/// 由服务层转换成 `tigshop_infrastructure::db::repo::member::user_rank::UserRankWrite`。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UserRankFields {
    /// `rank_id`
    pub rank_id: Option<i32>,
    /// `rank_name`
    pub rank_name: Option<String>,
    /// `min_growth_points`
    pub min_growth_points: Option<Decimal>,
    /// `max_growth_points`
    pub max_growth_points: Option<i32>,
    /// `discount`
    pub discount: Option<Decimal>,
    /// `rank_type`
    pub rank_type: Option<i32>,
    /// `rank_logo`
    pub rank_logo: Option<String>,
    /// `rank_ico`
    pub rank_ico: Option<String>,
    /// `rank_bg`
    pub rank_bg: Option<String>,
    /// `rank_point`
    pub rank_point: Option<String>,
    /// `free_shipping`
    pub free_shipping: Option<i32>,
    /// `rank_card_type`
    pub rank_card_type: Option<i32>,
    /// `rights`（JSON 文本）
    pub rights: Option<String>,
    /// `rank_level`（Java 是 `Integer`，库列是 `varchar(30)`）
    pub rank_level: Option<i32>,
}

/// 校验 `update` 的入参（对照 Java `@Validated` + `validParam()`）。
///
/// 顺序（Java 实际顺序是：Bean Validation 先跑 `@Size`，再进方法体跑
/// `validParam()`；这里保持同一顺序，便于错误文案稳定）：
/// 1. `rankType` 缺失 ⇒ [`MSG_RANK_TYPE_MISSING`]
///    （Java 在此处 NPE ⇒ 500，本实现提前 400）
/// 2. `data` 缺失 ⇒ [`MSG_DATA_REQUIRED`]（Java 在此处 NPE ⇒ 500）
/// 3. `data.len()` 不在 `1..=10` ⇒ [`MSG_DATA_SIZE_INVALID`]
/// 4. `rankType == 0` ⇒ [`MSG_RANK_TYPE_REQUIRED`]
/// 5. `rankType == 1 && growUpSetting == null` ⇒ [`MSG_GROW_UP_SETTING_REQUIRED`]
///
/// 返回 `Ok(rank_type)`。
pub fn validate_edit_param(param: &UserRankEditParam) -> Result<i32, String> {
    let rank_type = param
        .rank_type
        .ok_or_else(|| MSG_RANK_TYPE_MISSING.to_string())?;
    let data = param
        .data
        .as_ref()
        .ok_or_else(|| MSG_DATA_REQUIRED.to_string())?;
    if data.len() < DATA_MIN_LEN || data.len() > DATA_MAX_LEN {
        return Err(MSG_DATA_SIZE_INVALID.to_string());
    }
    if rank_type == 0 {
        return Err(MSG_RANK_TYPE_REQUIRED.to_string());
    }
    if rank_type == 1 && param.grow_up_setting.is_none() {
        return Err(MSG_GROW_UP_SETTING_REQUIRED.to_string());
    }
    Ok(rank_type)
}

// ————————————————————— 宽松反序列化辅助 —————————————————————

/// 接受字符串 / 数字 / 布尔 / null，统一转成 `Option<String>`。
fn de_opt_string_lenient<'de, D>(de: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};

    struct V;

    impl Visitor<'_> for V {
        type Value = Option<String>;

        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("字符串或数字")
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }

        fn visit_string<E: de::Error>(self, v: String) -> Result<Self::Value, E> {
            Ok(Some(v))
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }

        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }

        fn visit_bool<E: de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
    }

    de.deserialize_any(V)
}

/// 接受数字 / 数字字符串，统一转成 `i32`（缺失时由 `#[serde(default)]` 给 0）。
fn de_i32_lenient<'de, D>(de: D) -> Result<i32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};

    struct V;

    impl Visitor<'_> for V {
        type Value = i32;

        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("整数或整数字符串")
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(i32::try_from(v).unwrap_or(0))
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(i32::try_from(v).unwrap_or(0))
        }

        fn visit_f64<E: de::Error>(self, v: f64) -> Result<Self::Value, E> {
            #[allow(clippy::cast_possible_truncation)]
            Ok(v as i32)
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<Self::Value, E> {
            Ok(v.trim().parse::<i32>().unwrap_or(0))
        }

        fn visit_bool<E: de::Error>(self, v: bool) -> Result<Self::Value, E> {
            Ok(i32::from(v))
        }

        fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(0)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
            Ok(0)
        }
    }

    de.deserialize_any(V)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("测试常量必须是合法 Decimal")
    }

    fn rank(free_shipping: i32, discount: &str, rank_point: &str) -> UserRank {
        UserRank {
            rank_id: 3,
            rank_name: "黄金会员".into(),
            min_growth_points: dec("0.00"),
            max_growth_points: 0,
            discount: dec(discount),
            show_price: 1,
            rank_type: 1,
            rank_logo: "logo".into(),
            rank_ico: "card1".into(),
            rank_bg: String::new(),
            rank_point: rank_point.into(),
            free_shipping,
            rank_card_type: 1,
            rights: None,
            rank_level: "1".into(),
        }
    }

    // ————————————— 权益文案（对照 getUserRights） —————————————

    /// `rankPoint = "0"` 也算一条权益（Java 用 `isEmpty` 而不是数值判断）。
    #[test]
    fn user_rights_counts_zero_rank_point() {
        let r = rank(0, "0.0", "0");
        assert_eq!(build_user_rights(&r), "享受0倍积分回馈");
    }

    /// 三项齐全时按「包邮 / 折扣 / 积分」顺序、单空格连接。
    #[test]
    fn user_rights_joins_in_java_order() {
        let r = rank(1, "8.5", "2");
        assert_eq!(
            build_user_rights(&r),
            "享受会员包邮 会员折扣8.5折 2倍积分回馈"
        );
    }

    /// 三项都为空 ⇒ 空串（不加「享受」前缀）。
    #[test]
    fn user_rights_empty_when_all_disabled() {
        let r = rank(0, "0.0", "");
        assert_eq!(build_user_rights(&r), "");
    }

    /// 折扣字符串是 `BigDecimal.toString()` 口径（保留库里的标度）。
    #[test]
    fn user_rights_uses_decimal_to_string() {
        let r = rank(0, "0.0", "");
        assert_eq!(build_user_rights(&r), "");
        let r = rank(0, "9.9", "");
        assert_eq!(build_user_rights(&r), "享受会员折扣9.9折");
    }

    // ————————————— rights JSON 解析 —————————————

    /// 兼容 camelCase（Jackson 写入）与 snake_case（初始化 SQL 写入）。
    #[test]
    fn parse_rights_accepts_both_naming_styles() {
        let camel = r#"[{"name":"送手机","showName":"送手机","icon":"i","value":"1999","describe":"d","isChecked":1}]"#;
        let snake = r#"[{"name":"送手机","show_name":"送手机","icon":"i","value":1999,"describe":"d","is_checked":0}]"#;
        let a = parse_rights(Some(camel));
        assert_eq!(a.len(), 1);
        assert_eq!(a[0].show_name.as_deref(), Some("送手机"));
        assert_eq!(a[0].is_checked, 1);
        assert_eq!(a[0].value.as_deref(), Some("1999"));

        let b = parse_rights(Some(snake));
        assert_eq!(b.len(), 1);
        assert_eq!(b[0].show_name.as_deref(), Some("送手机"));
        assert_eq!(b[0].is_checked, 0);
        // 数字 1999 → 字符串 "1999"（Java VO 的 value 是 String）
        assert_eq!(b[0].value.as_deref(), Some("1999"));
    }

    /// 空白 / 非法 JSON / `null` 都得到空列表（Java 吞掉异常）。
    #[test]
    fn parse_rights_falls_back_to_empty() {
        assert!(parse_rights(None).is_empty());
        assert!(parse_rights(Some("")).is_empty());
        assert!(parse_rights(Some("   ")).is_empty());
        assert!(parse_rights(Some("not-json")).is_empty());
        assert!(parse_rights(Some("{\"a\":1}")).is_empty());
        assert!(parse_rights(Some("null")).is_empty());
    }

    /// 写侧 JSON 的键名是 camelCase（Jackson 口径）。
    #[test]
    fn rights_to_json_uses_camel_case() {
        let input = RankRightInput {
            name: Some("送手机".into()),
            show_name: Some("送手机".into()),
            icon: Some("i".into()),
            value: Some(dec("1999")),
            describe: Some("d".into()),
            is_checked: Some(1),
        };
        let json = rights_to_json(Some(std::slice::from_ref(&input)));
        assert!(json.contains("\"showName\""), "json={json}");
        assert!(json.contains("\"isChecked\""), "json={json}");
        // `null` 权益列表 ⇒ `[]`
        assert_eq!(rights_to_json(None), "[]");
    }

    // ————————————— rank_level / 配置解析 —————————————

    /// 库列是 `varchar(30)`，VO 是整数：空串/非法值回退 0。
    #[test]
    fn rank_level_conversion() {
        assert_eq!(rank_level_to_i32("1"), 1);
        assert_eq!(rank_level_to_i32(" 12 "), 12);
        assert_eq!(rank_level_to_i32(""), 0);
        assert_eq!(rank_level_to_i32("abc"), 0);
    }

    /// `rank_config.data` 文本 → JSON 对象；空白/非法 ⇒ None。
    #[test]
    fn config_data_parsing() {
        assert!(parse_json_object(None).is_none());
        assert!(parse_json_object(Some("")).is_none());
        assert!(parse_json_object(Some("  ")).is_none());
        assert!(parse_json_object(Some("{oops")).is_none());
        let v = parse_json_object(Some(r#"{"type":2,"rankAfterMonth":12}"#)).expect("应能解析");
        assert_eq!(v["type"], 2);
    }

    /// `getRankConfigInit()` 的 data 内容逐字段核对。
    #[test]
    fn init_config_matches_java_literals() {
        let vo = init_rank_config_vo();
        assert_eq!(vo.code.as_deref(), Some("rank_config"));
        assert_eq!(vo.rank_type, Some(1));
        assert_eq!(vo.id, None);
        let data = vo.data.expect("init 应有 data");
        assert_eq!(data["type"], 1);
        assert_eq!(data["rankAfterMonth"], 12);
        assert_eq!(data["useMonth"], 12);
    }

    /// 列表兜底行：`rankPoint` / `rights` / `userRights` 必须是 null
    /// （Java `copyProperties` 类型不兼容会跳过）。
    #[test]
    fn init_list_vo_keeps_incompatible_fields_null() {
        let vo = init_rank_list_vo();
        assert!(vo.rank_point.is_none());
        assert!(vo.rights.is_none());
        assert!(vo.user_rights.is_none());
        assert_eq!(vo.rank_name, "黄金会员");
        assert_eq!(vo.rank_ico, "card1");
        assert_eq!(vo.rank_card_type, 1);
        assert_eq!(vo.rank_level, 1);
    }

    /// 非 Pro 兜底行：`rankId` / `userCount` 是 null。
    #[test]
    fn init_not_pro_vo_has_null_ids() {
        let vo = init_rank_not_pro_vo();
        assert_eq!(vo.rank_id, None);
        assert_eq!(vo.user_count, None);
        assert_eq!(vo.rank_level, Some(1));
    }

    // ————————————— 排序 / 字段映射 —————————————

    /// `list`：`sortOrder` 为空 ⇒ 补 `asc`；`listNotPro`：为空 ⇒ 降序。
    #[test]
    fn order_clause_defaults_differ_between_list_and_list_not_pro() {
        let q = UserRankListQuery::default();
        assert_eq!(q.order_clause(true), " ORDER BY rank_id ASC");
        assert_eq!(q.order_clause(false), " ORDER BY rank_id DESC");
    }

    /// 属性名与列名都要能映射；非法值完全不排序。
    #[test]
    fn order_clause_mapping_and_illegal_direction() {
        let q = UserRankListQuery {
            sort_field: Some("minGrowthPoints".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(true), " ORDER BY min_growth_points DESC");

        let q = UserRankListQuery {
            sort_field: Some("nope".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        // 未识别字段回退主键列（MyBatis-Plus 防注入行为）
        assert_eq!(q.order_clause(true), " ORDER BY rank_id ASC");

        let q = UserRankListQuery {
            sort_field: Some("discount".into()),
            sort_order: Some("weird".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(true), "");
    }

    /// 白名单四项都必须是真实列；未知字段回退主键列后会被白名单拒绝。
    #[test]
    fn update_field_whitelist_is_real_columns() {
        for f in USER_RANK_FIELDS {
            assert!(USER_RANK_COLUMNS.contains(&f), "白名单含不存在的列: {f}");
        }
        assert_eq!(map_update_field_column("rankName"), "rank_name");
        assert_eq!(map_update_field_column("rank_name"), "rank_name");
        assert_eq!(map_update_field_column("discount"), "discount");
        assert_eq!(
            map_update_field_column("minGrowthPoints"),
            "min_growth_points"
        );
        assert_eq!(
            map_update_field_column("max_growth_points"),
            "max_growth_points"
        );
        assert_eq!(map_update_field_column("unknown"), KEY_COLUMN);
        assert!(!USER_RANK_FIELDS.contains(&KEY_COLUMN), "主键列不在白名单");
    }

    // ————————————— 查询参数 —————————————

    /// `keyword` 的判据是 `isNotEmpty`（**不 trim**）。
    #[test]
    fn keyword_uses_is_not_empty_semantics() {
        let q = UserRankListQuery {
            keyword: Some("  ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), Some("  "));
        let q = UserRankListQuery {
            keyword: Some(String::new()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), None);
        assert_eq!(UserRankListQuery::default().effective_keyword(), None);
    }

    /// `rankType` 只有 `> 0` 才过滤。
    #[test]
    fn rank_type_filter_requires_positive() {
        let mk = |v: i32| UserRankListQuery {
            rank_type: Some(v),
            ..Default::default()
        };
        assert_eq!(mk(0).effective_rank_type(), None);
        assert_eq!(mk(-1).effective_rank_type(), None);
        assert_eq!(mk(2).effective_rank_type(), Some(2));
    }

    /// 分页默认值与夹取。
    #[test]
    fn page_query_defaults_and_clamp() {
        let p = UserRankListQuery::default().page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 15);

        let q = UserRankListQuery {
            page: Some(0),
            size: Some(9999),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!(p.page, 1);
        assert_eq!(p.page_size, 100);
    }

    /// `RankPageResult` 的 `pages` 计算（`total = 0` ⇒ 0）。
    #[test]
    fn rank_page_result_pages() {
        let q = PageQuery {
            page: 2,
            page_size: 10,
        };
        let r: RankPageResult<i32> = RankPageResult::new(vec![1], 25, &q);
        assert_eq!(r.pages, 3);
        assert_eq!(r.current, 2);
        assert_eq!(r.size, 10);
        let r: RankPageResult<i32> = RankPageResult::new(Vec::new(), 0, &q);
        assert_eq!(r.pages, 0);
    }

    // ————————————— update 入参校验 —————————————

    fn data_row(rank_id: Option<i32>) -> UserRankData {
        UserRankData {
            rank_id,
            rank_name: Some("黄金会员".into()),
            min_growth_points: Some(dec("0.00")),
            ..Default::default()
        }
    }

    /// 顺序：rankType 缺失 → data 缺失 → 长度 → rankType==0 → 成长值设置。
    #[test]
    fn validate_edit_param_order_and_messages() {
        let mut p = UserRankEditParam::default();
        assert_eq!(
            validate_edit_param(&p),
            Err("会员等级类型不能为空".to_string())
        );

        p.rank_type = Some(1);
        assert_eq!(
            validate_edit_param(&p),
            Err("用户等级数据不能为空".to_string())
        );

        p.data = Some(Vec::new());
        assert_eq!(
            validate_edit_param(&p),
            Err("用户等级；不能少于1条，不能大于10条".to_string())
        );

        p.data = Some(vec![data_row(None)]);
        // rankType == 1 但没有 growUpSetting
        assert_eq!(validate_edit_param(&p), Err("请填写成长值设置".to_string()));

        p.grow_up_setting = Some(GrowUpSettingInput::default());
        assert_eq!(validate_edit_param(&p), Ok(1));

        // rankType == 0
        p.rank_type = Some(0);
        assert_eq!(
            validate_edit_param(&p),
            Err("请选择会员等级类型".to_string())
        );

        // 超过 10 条
        p.rank_type = Some(2);
        p.data = Some((0..11).map(|_| data_row(None)).collect());
        assert_eq!(
            validate_edit_param(&p),
            Err("用户等级；不能少于1条，不能大于10条".to_string())
        );
    }

    // ————————————— buildUserRank 净语义 —————————————

    /// `isPro = 1` 时写满全部列；`rankType` 来自参数而不是 data。
    #[test]
    fn build_fields_pro_writes_full_row() {
        let data = UserRankData {
            rank_id: Some(7),
            rank_name: Some("铂金会员".into()),
            min_growth_points: Some(dec("100.00")),
            max_growth_points: Some(999),
            discount: Some(dec("9.5")),
            show_price: Some(1),
            rank_type: Some(99), // 应被 param.rankType 覆盖
            rank_logo: Some("logo.png".into()),
            rank_ico: Some("card2".into()),
            rank_bg: Some("bg.png".into()),
            rank_point: None, // 空 ⇒ "0"
            free_shipping: Some(1),
            rank_card_type: Some(2),
            rights: None,
            rank_level: Some(2),
        };
        let f = build_user_rank_fields(&data, IS_PRO, 2);
        assert_eq!(f.rank_id, Some(7));
        assert_eq!(f.rank_type, Some(2), "rankType 必须来自 param");
        assert_eq!(f.rank_card_type, Some(2));
        assert_eq!(f.rank_point.as_deref(), Some("0"));
        assert_eq!(f.rights.as_deref(), Some("[]"));
        assert_eq!(f.rank_level, Some(2));
        assert_eq!(f.min_growth_points, Some(dec("100.00")));
    }

    /// `isPro = 0` 时只写 5 个字段（其余为 None ⇒ 不写列）。
    #[test]
    fn build_fields_not_pro_writes_minimal_row() {
        let data = UserRankData {
            rank_id: None,
            rank_name: Some("黄金会员".into()),
            min_growth_points: Some(dec("100.00")),
            discount: Some(dec("9.5")),
            rank_level: Some(1),
            rank_logo: Some("logo.png".into()),
            ..Default::default()
        };
        let f = build_user_rank_fields(&data, 0, 0);
        assert_eq!(f.rank_name.as_deref(), Some("黄金会员"));
        assert_eq!(f.rank_card_type, Some(1));
        assert_eq!(f.rank_logo.as_deref(), Some("logo.png"));
        assert!(f.min_growth_points.is_none());
        assert!(f.discount.is_none());
        assert!(f.rank_type.is_none());
        assert!(f.rights.is_none());
    }

    /// `rankPoint` 为 `""` 或 `None` 都写 `"0"`；非空则原样。
    #[test]
    fn build_fields_rank_point_default() {
        let mk = |v: Option<&str>| UserRankData {
            rank_point: v.map(str::to_string),
            ..Default::default()
        };
        assert_eq!(
            build_user_rank_fields(&mk(None), IS_PRO, 1)
                .rank_point
                .as_deref(),
            Some("0")
        );
        assert_eq!(
            build_user_rank_fields(&mk(Some("")), IS_PRO, 1)
                .rank_point
                .as_deref(),
            Some("0")
        );
        assert_eq!(
            build_user_rank_fields(&mk(Some("3")), IS_PRO, 1)
                .rank_point
                .as_deref(),
            Some("3")
        );
    }

    // ————————————— 实体 → VO —————————————

    /// 实体行映射：`userRights` / `rights` / `rankLevel` 都要有值。
    #[test]
    fn to_list_vo_maps_entity() {
        let mut r = rank(1, "8.5", "2");
        r.rights = Some(r#"[{"name":"n","show_name":"s","is_checked":1}]"#.into());
        let vo = to_list_vo(&r, 12);
        assert_eq!(vo.user_count, 12);
        assert_eq!(vo.rank_level, 1);
        assert_eq!(vo.rank_point.as_deref(), Some("2"));
        assert_eq!(
            vo.user_rights.as_deref(),
            Some("享受会员包邮 会员折扣8.5折 2倍积分回馈")
        );
        assert_eq!(vo.rights.as_ref().map(Vec::len), Some(1));
    }

    /// 非 Pro 映射只带 5 个字段。
    #[test]
    fn to_not_pro_vo_maps_entity() {
        let r = rank(0, "0.0", "0");
        let vo = to_not_pro_vo(&r, 3);
        assert_eq!(vo.rank_id, Some(3));
        assert_eq!(vo.user_count, Some(3));
        assert_eq!(vo.rank_name.as_deref(), Some("黄金会员"));
        assert_eq!(vo.rank_level, Some(1));
    }

    /// `BatchDTO` 的 ids 去重与 `type` 判据。
    #[test]
    fn batch_dto_helpers() {
        let d: BatchDTO =
            serde_json::from_str(r#"{"ids":[3,1,3,-2],"type":"del"}"#).expect("应能反序列化");
        assert!(d.is_delete());
        assert_eq!(d.effective_ids(), vec![1, 3]);
        let d: BatchDTO = serde_json::from_str(r#"{"type":"show"}"#).expect("应能反序列化");
        assert!(!d.is_delete());
        assert!(d.effective_ids().is_empty());
        assert_eq!(d.value, 0);
    }

    /// 三个公共 DTO 的字段名契约。
    #[test]
    fn common_dtos_deserialize() {
        let o: OperateDTO =
            serde_json::from_str(r#"{"id":9,"adminNote":"n","pageType":1}"#).expect("应能反序列化");
        assert_eq!(o.id, Some(9));
        let u: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":9,"field":"rankName","val":"x"}"#).expect("应能反序列化");
        assert_eq!(u.field.as_deref(), Some("rankName"));
        let b: BatchDTO =
            serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":5}"#).expect("应能反序列化");
        assert_eq!(b.value, 5);
    }

    /// 列常量必须与 `python tools/schema_parser.py` 一致。
    #[test]
    fn column_constants_match_schema() {
        assert_eq!(USER_RANK_COLUMNS.len(), 15);
        assert_eq!(
            USER_RANK_CONFIG_COLUMNS,
            ["id", "code", "rank_type", "data"]
        );
        assert_eq!(KEY_COLUMN, "rank_id");
        assert_eq!(KEY_PROPERTY, "rankId");
        assert_eq!(
            USER_RANK_FIELDS,
            [
                "rank_name",
                "discount",
                "min_growth_points",
                "max_growth_points"
            ]
        );
    }

    // ————————————— grow_config 解析（对照 detail 的 fromJson） —————————————

    /// `null` / 空串 / 非法 JSON / 字面量 `"null"` 都得到 `None`；
    /// 合法对象才得到 `Some`（缺键字段为 `None`）。
    #[test]
    fn parse_grow_setting_matches_java_from_json() {
        assert!(parse_grow_setting(None).is_none());
        assert!(parse_grow_setting(Some("")).is_none());
        assert!(parse_grow_setting(Some("   ")).is_none());
        assert!(parse_grow_setting(Some("null")).is_none());
        assert!(parse_grow_setting(Some("not-json")).is_none());
        assert!(parse_grow_setting(Some("[1,2]")).is_none());

        let vo = parse_grow_setting(Some(
            r#"{"buyOrder":1,"buyOrderNumber":2,"bindPhoneGrowth":5}"#,
        ))
        .expect("合法对象应能解析");
        assert_eq!(vo.buy_order, Some(1));
        assert_eq!(vo.buy_order_number, Some(2));
        assert_eq!(vo.bind_phone_growth, Some(5));
        // 缺失键 ⇒ None（与 Java 的 Integer 字段保持一致）
        assert_eq!(vo.evpi, None);
    }

    /// `init()` 的七个字段全是 1（Java `getGrowUpSettingInit()`）。
    #[test]
    fn grow_setting_init_uses_ones() {
        let s = serde_json::to_value(GrowUpSettingVO::init()).expect("应可序列化");
        for key in [
            "buyOrder",
            "buyOrderNumber",
            "buyOrderGrowth",
            "evpi",
            "evpiGrowth",
            "bindPhone",
            "bindPhoneGrowth",
        ] {
            assert_eq!(s[key], 1, "{key} 应为 1");
        }
    }

    // ————————————— update 入参序列化（写入 user_rank_config.data） —————————————

    /// `RankConfigInput` 的 JSON 键名与 Java `RankConfig` 一致，
    /// 且 **null 字段也会被序列化**（Jackson 默认行为）。
    #[test]
    fn rank_config_input_serializes_like_jackson() {
        let v = serde_json::to_value(RankConfigInput {
            r#type: Some(2),
            rank_after_month: Some(12),
            use_month: None,
        })
        .expect("应可序列化");
        assert_eq!(v["type"], 2);
        assert_eq!(v["rankAfterMonth"], 12);
        assert!(v["useMonth"].is_null(), "null 字段也要输出: {v}");
        assert_eq!(v.as_object().map(serde_json::Map::len), Some(3));
    }

    /// `GrowUpSettingInput` 的 JSON 键名与 Java `GrowUpSetting` 一致。
    #[test]
    fn grow_setting_input_serializes_like_jackson() {
        let v = serde_json::to_value(GrowUpSettingInput {
            buy_order: Some(1),
            buy_order_number: Some(3),
            buy_order_growth: Some(2),
            evpi: Some(1),
            evpi_growth: Some(4),
            bind_phone: Some(0),
            bind_phone_growth: Some(5),
        })
        .expect("应可序列化");
        assert_eq!(v["buyOrder"], 1);
        assert_eq!(v["buyOrderNumber"], 3);
        assert_eq!(v["buyOrderGrowth"], 2);
        assert_eq!(v["evpi"], 1);
        assert_eq!(v["evpiGrowth"], 4);
        assert_eq!(v["bindPhone"], 0);
        assert_eq!(v["bindPhoneGrowth"], 5);
    }

    /// `listByPro` 的响应形态：顶层键是 `userRank` / `rankConfig`，
    /// `userRank` 用 `records` 而非 `list`。
    #[test]
    fn list_by_pro_vo_shape() {
        let vo = RankListByProVO {
            user_rank: RankPageResult::new(
                vec![init_rank_list_vo()],
                0,
                &PageQuery {
                    page: 1,
                    page_size: 15,
                },
            ),
            rank_config: init_rank_config_vo(),
        };
        let v = serde_json::to_value(&vo).expect("应可序列化");
        assert!(v["userRank"]["records"].is_array(), "v={v}");
        assert_eq!(v["userRank"]["total"], 0);
        assert_eq!(v["rankConfig"]["code"], "rank_config");
        assert!(v.get("user_rank").is_none(), "不得用 snake_case: {v}");
    }

    /// `detail` 的响应形态：`rankType` / `userRankList` / `userRankConfig` /
    /// `growUpSetting` 四个键。
    #[test]
    fn detail_vo_shape() {
        let vo = UserRankDetailVO {
            rank_type: 1,
            user_rank_list: vec![init_rank_list_vo()],
            user_rank_config: init_rank_config_vo(),
            grow_up_setting: Some(GrowUpSettingVO::init()),
        };
        let v = serde_json::to_value(&vo).expect("应可序列化");
        assert_eq!(v["rankType"], 1);
        assert!(v["userRankList"].is_array());
        assert_eq!(v["userRankConfig"]["code"], "rank_config");
        assert_eq!(v["growUpSetting"]["buyOrder"], 1);

        // grow_up_setting 为 None 时输出 JSON null
        let vo2: UserRankDetailVO<UserRankListVO> = UserRankDetailVO {
            rank_type: 1,
            user_rank_list: Vec::new(),
            user_rank_config: init_rank_config_vo(),
            grow_up_setting: None,
        };
        let v2 = serde_json::to_value(&vo2).expect("应可序列化");
        assert!(v2["growUpSetting"].is_null());
    }
}
