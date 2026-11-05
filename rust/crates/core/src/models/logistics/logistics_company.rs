//! 配送方式配置信息域（logistics::logistics_company）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.setting.LogisticsCompany`（表 `logistics_company`）
//! - `com.tigshop.bean.dto.setting.LogisticsCompanyListDTO extends BasePage`
//! - `com.tigshop.bean.dto.setting.LogisticsCompanyCreateDTO`
//! - `com.tigshop.bean.dto.setting.LogisticsCompanyUpdateDTO`
//! - `com.tigshop.bean.vo.setting.LogisticsCompanyVO`
//! - `com.tigshop.bean.vo.setting.SyncLogisticsCompanyResultVO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.adminapi.controller.setting.LogisticsCompanyController`
//!   （`LOGISTICS_UPDATE_FIELDS` 白名单常量）
//! - `com.tigshop.common.constant.setting.Kuaidi100CodeMapping`
//!   （快递鸟 ↔ 快递100 编码映射 + 常见承运商种子）
//! - `com.tigshop.bean.enums.order.LogisticsProviderType`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField`
//!   / `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（配送方式/物流公司字典维护）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。

use serde::{Deserialize, Serialize};

use crate::entities::LogisticsCompany;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `LogisticsCompanyController` / `Kuaidi100CodeMapping`）
// ——————————————————————————————————————————————

/// `logistics_company` 真实存在的 25 个列
/// （`python tools/schema_parser.py --table logistics_company`）。
///
/// 用于把 `updateField` 白名单字段映射为列名后的二次校验，
/// 保证不会把不存在的列拼进 SQL。
pub const LOGISTICS_COMPANY_COLUMNS: [&str; 25] = [
    "logistics_id",
    "logistics_code",
    "logistics_name",
    "logistics_desc",
    "sort_order",
    "is_show",
    "shop_id",
    "customer_name",
    "customer_pwd",
    "month_code",
    "send_site",
    "send_staff",
    "exp_type",
    "api_logistics_code",
    "kuaidi100_code",
    "kuaidi100_partner_id",
    "kuaidi100_partner_key",
    "kuaidi100_partner_secret",
    "kuaidi100_net",
    "kuaidi100_check_man",
    "kuaidi100_exp_type",
    "kuaidi100_temp_id",
    "kuaidi100_child_temp_id",
    "kuaidi100_back_temp_id",
    "is_enabled",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `logistics_id`）。
///
/// ⚠️ 本域主键**不是** `id`，而是 `logistics_id`
/// （Java `@TableId(value = "logistics_id", type = IdType.AUTO)`）。
pub const KEY_COLUMN: &str = "logistics_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `logisticsId`）。
///
/// `buildSortOrder` 用 `ObjectUtil.equals(sortField, getKeyProperty())` 判等，
/// 传入 `logisticsId` 时同样回退主键列。
pub const KEY_PROPERTY: &str = "logisticsId";

/// `updateField` 的允许字段（Java `LogisticsCompanyController`
/// 的 `LOGISTICS_UPDATE_FIELDS`）。
///
/// ```text
/// public static final String[] LOGISTICS_UPDATE_FIELDS =
///     {"is_show", "sort_order", "status", "logistics_code",
///      "is_enabled", "logistics_name", "logistics_desc", "kuaidi100_code"};
/// ```
///
/// ⚠️ **注意 `"status"`**：该列在 `logistics_company` 表中**不存在**
/// （权威 schema 的 25 列里没有 `status`）。Java 的白名单里却写了它
/// —— 这是 Java 侧的复制粘贴遗留。因为 `getColumnByPropertyName("status")`
/// 在 MyBatis-Plus 里找不到对应属性/列时会**静默回退主键列**
/// `logistics_id`，而 `logistics_id` 不在白名单里，所以传 `status` 实际会
/// 得到「字段值不合法」。本实现用 [`map_update_field_column`] 返回 `None`
/// 表达同一结果（见 `uncertain_points`）。
pub const LOGISTICS_UPDATE_FIELDS: [&str; 8] = [
    "is_show",
    "sort_order",
    "status",
    "logistics_code",
    "is_enabled",
    "logistics_name",
    "logistics_desc",
    "kuaidi100_code",
];

/// 物流服务商类型：快递鸟（Java `LogisticsProviderType.KDNIAO`）。
pub const PROVIDER_KDNIAO: i32 = 1;

/// 物流服务商类型：快递100（Java `LogisticsProviderType.KUAIDI100`）。
pub const PROVIDER_KUAIDI100: i32 = 2;

/// 物流服务商配置项 key（Java `SettingsEnum.LOGISTICS_PROVIDER` → `logisticsProvider`）。
pub const CONFIG_KEY_LOGISTICS_PROVIDER: &str = "logisticsProvider";

/// 「是」的取值（Java `Constants.YES` / `IsShowType.SHOW`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO` / `IsShowType.NOT_SHOW`）。
pub const NO: i32 = 0;

/// 同步新增行时的默认排序（Java `toSave.setSortOrder(50)`）。
pub const SYNC_DEFAULT_SORT_ORDER: i32 = 50;

/// 同步新增行时的默认展示状态（Java `toSave.setIsShow(1)`）。
pub const SYNC_DEFAULT_IS_SHOW: i32 = YES;

/// 列表默认每页条数（Java `BasePage#getSize` 默认 15）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;

/// 列表每页条数上限（Java `BasePage#getSize` 的 `size > 100 → 100`）。
pub const MAX_PAGE_SIZE: u64 = 100;

// ————————————————————— Java 常量文案（逐字符照抄） ——————————————————————

/// Java `LogisticsCompanyServiceImpl#create` 抛出的原文案。
pub const MSG_KUAIDI100_CODE_REQUIRED: &str = "快递100物流公司编码不能为空";

/// Java `LogisticsCompanyServiceImpl#create` 抛出的原文案。
pub const MSG_KDNIAO_CODE_REQUIRED: &str = "快递鸟物流公司编码不能为空";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// 物流公司主键缺失（`LogisticsCompanyUpdateDTO.id` 无 `@NotNull`，
/// 但 update 内部 `getById(null)` 会 NPE；Rust 侧补的通用文案）。
pub const MSG_LOGISTICS_ID_REQUIRED: &str = "物流公司主键不能为空";

/// Java `LogisticsCompanyServiceImpl#fetchYuqueKdnCompanies` 的原文案。
pub const MSG_YUQUE_MISSING_DATA: &str = "语雀接口返回异常：缺少 data 字段";

/// Java `LogisticsCompanyServiceImpl#fetchYuqueKdnCompanies` 的原文案。
pub const MSG_YUQUE_MISSING_CONTENT: &str =
    "语雀接口返回异常：缺少 data.content（快递公司编码表内容）";

/// Java `LogisticsCompanyServiceImpl#doHttpGet` 的原文案前缀。
pub const MSG_YUQUE_HTTP_FAILED: &str = "语雀接口请求失败";

/// Rust 侧补的通用提示（Java 没有对应文案）。
pub const MSG_LOGISTICS_COMPANY_NOT_FOUND: &str = "物流公司不存在";

/// 「快递鸟编码表（国内）」语雀文档接口（Java `YUQUE_KDN_LOGISTICS_DOC_URL_CN`）。
pub const YUQUE_KDN_LOGISTICS_DOC_URL_CN: &str = "https://www.yuque.com/api/docs/mza2ln?book_id=32573955&include_contributors=true&include_like=true&include_hits=true&merge_dynamic_data=false";

/// 「快递鸟编码表（国际）」语雀文档接口（Java `YUQUE_KDN_LOGISTICS_DOC_URL_INTL`）。
pub const YUQUE_KDN_LOGISTICS_DOC_URL_INTL: &str = "https://www.yuque.com/api/docs/xkc4h1?book_id=32573955&include_contributors=true&include_like=true&include_hits=true&merge_dynamic_data=false";

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 物流公司 VO（对应 Java `com.tigshop.bean.vo.setting.LogisticsCompanyVO`）。
///
/// Java 的 `list` / `detail` 都是 `BeanUtils.copyProperties(entity, vo)`
/// 后手工补 `isBound`（仅 `list` 会设值，`detail` 保持 `null`）。
///
/// ⚠️ Java `LogisticsCompanyVO.logisticsName` 带 `@JsonTranslate(dataType = 1)`
/// （跨境翻译注解）。管理端 `list` / `detail` 同样带该注解，会经翻译切面处理；
/// Rust 侧尚未实现翻译切面，本实现原样返回库中值（见 `uncertain_points`）。
///
/// ⚠️ Java VO 字段数**少于**实体（没有 `shopId` / `customerName` /
/// `customerPwd` / `monthCode` / `sendSite` / `sendStaff` / `expType`）。
/// `BeanUtils.copyProperties` 只拷贝同名属性，因此 VO **不含租户与凭证字段**。
/// 本结构体严格按 VO 字段集构造，不额外暴露敏感列。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyVO {
    /// 自增 id（`logistics_id`）
    pub logistics_id: i32,
    /// 配送方式的快递公司代号
    pub logistics_code: String,
    /// 配送方式名称
    pub logistics_name: String,
    /// 配送方式描述
    pub logistics_desc: String,
    /// 排序
    pub sort_order: i32,
    /// 是否展示
    pub is_show: i32,
    /// 无服务调用物流编号
    pub api_logistics_code: Option<String>,
    /// 快递100 快递公司编码
    pub kuaidi100_code: String,
    /// 快递100 电子面单账户/月结账号
    pub kuaidi100_partner_id: String,
    /// 快递100 电子面单密码
    pub kuaidi100_partner_key: String,
    /// 快递100 电子面单密钥
    pub kuaidi100_partner_secret: String,
    /// 快递100 电子面单收件网点名
    pub kuaidi100_net: String,
    /// 快递100 电子面单承载快递员名
    pub kuaidi100_check_man: String,
    /// 快递100 电子面单产品类型
    pub kuaidi100_exp_type: String,
    /// 快递100 电子面单主单模板 ID
    pub kuaidi100_temp_id: String,
    /// 快递100 电子面单子单模板 ID
    pub kuaidi100_child_temp_id: String,
    /// 快递100 电子面单回单模板 ID
    pub kuaidi100_back_temp_id: String,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: i32,
    /// 是否已绑定：1 已绑定，0 未绑定
    ///
    /// `detail` 返回 `null`（Java 只 `copyProperties`，未设该字段）；
    /// `list` 由 [`LogisticsCompanyVO::from_entity`] 按绑定集合计算。
    pub is_bound: Option<i32>,
}

impl LogisticsCompanyVO {
    /// 由实体构造 VO（对应 Java `BeanUtils.copyProperties(entity, vo)`）。
    ///
    /// `is_bound` 保持 `None` —— 与 Java `detail` 的可观测结果一致
    /// （VO 的 `isBound` 默认 `null`）。`list` 走
    /// [`LogisticsCompanyVO::from_entity`] 的 `bound` 参数。
    #[must_use]
    pub fn from_entity(e: &LogisticsCompany) -> Self {
        Self {
            logistics_id: e.logistics_id,
            logistics_code: e.logistics_code.clone(),
            logistics_name: e.logistics_name.clone(),
            logistics_desc: e.logistics_desc.clone(),
            sort_order: e.sort_order,
            is_show: e.is_show,
            api_logistics_code: e.api_logistics_code.clone(),
            kuaidi100_code: e.kuaidi100_code.clone(),
            kuaidi100_partner_id: e.kuaidi100_partner_id.clone(),
            kuaidi100_partner_key: e.kuaidi100_partner_key.clone(),
            kuaidi100_partner_secret: e.kuaidi100_partner_secret.clone(),
            kuaidi100_net: e.kuaidi100_net.clone(),
            kuaidi100_check_man: e.kuaidi100_check_man.clone(),
            kuaidi100_exp_type: e.kuaidi100_exp_type.clone(),
            kuaidi100_temp_id: e.kuaidi100_temp_id.clone(),
            kuaidi100_child_temp_id: e.kuaidi100_child_temp_id.clone(),
            kuaidi100_back_temp_id: e.kuaidi100_back_temp_id.clone(),
            is_enabled: e.is_enabled,
            is_bound: None,
        }
    }

    /// 由实体构造 VO 并计算 `isBound`
    /// （对应 Java `list` 的 `vo.setIsBound(boundLogisticsIds.contains(id) ? 1 : 0)`）。
    #[must_use]
    pub fn from_entity_bound(e: &LogisticsCompany, bound: bool) -> Self {
        let mut vo = Self::from_entity(e);
        vo.is_bound = Some(if bound { YES } else { NO });
        vo
    }
}

impl From<&LogisticsCompany> for LogisticsCompanyVO {
    fn from(e: &LogisticsCompany) -> Self {
        Self::from_entity(e)
    }
}

impl From<LogisticsCompany> for LogisticsCompanyVO {
    fn from(e: LogisticsCompany) -> Self {
        Self::from_entity(&e)
    }
}

/// 同步结果 VO（对应 Java `com.tigshop.bean.vo.setting.SyncLogisticsCompanyResultVO`）。
///
/// Java 四个字段都是 `int`：`remoteTotal` / `inserted` / `updated` / `conflicted`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct SyncLogisticsCompanyResultVO {
    /// 远端（或种子）条目总数
    pub remote_total: i32,
    /// 新增条数
    pub inserted: i32,
    /// 更新条数
    pub updated: i32,
    /// 冲突条数（仅快递100 同步会 > 0）
    pub conflicted: i32,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `LogisticsCompanyListDTO extends BasePage`）。
///
/// Java `BasePage` 字段：`page` / `size` / `sortField` / `keyword` /
/// `sortOrder` / `sortItems`。
///
/// ⚠️ HTTP 查询参数是 `size`，而项目统一 `PageQuery` 用的是 `pageSize`。
/// 本结构体为**入参**，按 Java 契约用 `size`；转成内部 `PageQuery` 时由
/// [`LogisticsCompanyListQuery::page_query`] 完成桥接。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyListQuery {
    /// 店铺 ID（Java `shopId`；仅当取值是合法 `IsShowType` 码 0/1 时才过滤）
    ///
    /// ⚠️ Java 的判据是 `IsShowType.fromTypeCode(shopId) != null`，
    /// 而 `IsShowType` 只有 `NOT_SHOW(0)` / `SHOW(1)`，因此 **只有
    /// `shopId` 为 0 或 1 时才会真正加上 `shop_id = ?` 条件**，
    /// 其它值（如 5）**静默忽略**。这是 Java 侧把「是否显示」枚举
    /// 误用于「店铺 ID」的结果，本实现逐字符复刻（见 `uncertain_points`）。
    pub shop_id: Option<i32>,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: Option<i32>,
    /// 物流服务商类型：1 快递鸟，2 快递100；不传或非法值不过滤
    pub provider_type: Option<i32>,
    /// 搜索关键字（Java `keyword`，`LIKE %keyword%` 作用于 `logistics_name`）
    pub keyword: Option<String>,
    /// 排序字段（Java `sortField`；属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（Java `buildSortOrder` 语义）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl LogisticsCompanyListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// Java `IsShowType.fromTypeCode(shopId) != null` 的等价判据。
    ///
    /// 只有 0 与 1 是合法的 `IsShowType` 码，其它值返回 `None`（不过滤）。
    #[must_use]
    pub fn effective_shop_id(&self) -> Option<i32> {
        match self.shop_id {
            Some(v) if v == NO || v == YES => Some(v),
            _ => None,
        }
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage`：`page` 默认 1，`size` 默认 **15**、上限 100。
    /// 项目统一口径额外兜住下界（`clamp(1, 100)`，见 `uncertain_points`）。
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

    /// 用户指定的 ORDER BY（Java `buildSortOrder(page, sortField, sortOrder)`）。
    ///
    /// ⚠️ Java `list` 在 `buildSortOrder` **之后**又无条件追加了
    /// ```text
    /// queryWrapper.orderByDesc(LogisticsCompany::getIsEnabled)
    ///             .orderByDesc(LogisticsCompany::getLogisticsId);
    /// ```
    /// MyBatis-Plus 的 `QueryWrapper.orderBy*` 是**追加**语义，而
    /// `page.setOrders(...)`（`buildSortOrder` 内部）与 `QueryWrapper`
    /// 的 ORDER BY 会一起生效：最终 SQL 里 `QueryWrapper` 的条件排在前，
    /// `page.orders` 排在**后**（`PaginationInnerInterceptor` 会在
    /// 已有 ORDER BY 后追加 `page.orders`）。
    ///
    /// 为避免猜测 MP 内部的拼接顺序，本实现把两者都保留：
    /// 先拼 `is_enabled DESC, logistics_id DESC`，再拼用户排序
    /// （见 [`LogisticsCompanyListQuery::order_clause`] 与
    /// `uncertain_points` 中记录的这处不确定）。
    #[must_use]
    pub fn user_order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty()
            || field == KEY_PROPERTY
            || field.eq_ignore_ascii_case(KEY_COLUMN)
        {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!("{column} ASC"),
            None | Some("") => format!("{column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!("{column} DESC"),
            // Java `buildSortOrder` 是 `if asc {..} else if desc||empty {..}`，
            // 非法值落到两分支之外 ⇒ page.orders 保持为空
            Some(_) => String::new(),
        }
    }

    /// 完整 ORDER BY 子句（固定二级排序 + 可选用户排序）。
    ///
    /// Java 固定部分：`is_enabled DESC, logistics_id DESC`
    /// （`orderByDesc(isEnabled).orderByDesc(logisticsId)`）。
    /// 注意拼入的是**列名**，与 Java 的 lambda 属性名等价。
    #[must_use]
    pub fn order_clause(&self) -> String {
        let base = format!(" ORDER BY is_enabled DESC, {KEY_COLUMN} DESC");
        let user = self.user_order_clause();
        if user.is_empty() {
            base
        } else {
            format!("{base}, {user}")
        }
    }
}

/// 排序 / 更新字段名 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `logistics_company` 的真实列；属性名（camelCase）与列名
/// （snake_case）都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "logisticsId" | "logistics_id" => "logistics_id",
        "logisticsCode" | "logistics_code" => "logistics_code",
        "logisticsName" | "logistics_name" => "logistics_name",
        "logisticsDesc" | "logistics_desc" => "logistics_desc",
        "sortOrder" | "sort_order" => "sort_order",
        "isShow" | "is_show" => "is_show",
        "shopId" | "shop_id" => "shop_id",
        "apiLogisticsCode" | "api_logistics_code" => "api_logistics_code",
        "kuaidi100Code" | "kuaidi100_code" => "kuaidi100_code",
        "isEnabled" | "is_enabled" => "is_enabled",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 属性名（camelCase）与列名（snake_case）都可命中；未命中返回 `None`
/// —— 调用方据此报「字段值不合法」。
///
/// ⚠️ 与 Java 的一处**有意偏离**：Java 找不到时返回**主键列**
/// `logistics_id`，再拿它去比对 `LOGISTICS_UPDATE_FIELDS`
/// （`logistics_id` 不在其中，于是同样报「字段值不合法」）。
/// 两者对白名单的判定结果**完全一致**，差别只在错误分支的形状。
///
/// ⚠️ `"status"` 在白名单里但**不是真实列**：本函数返回 `None`，
/// 最终同样得到「字段值不合法」（与 Java 通过回退主键列得到的结论一致）。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "isShow" | "is_show" => Some("is_show"),
        "sortOrder" | "sort_order" => Some("sort_order"),
        "logisticsCode" | "logistics_code" => Some("logistics_code"),
        "isEnabled" | "is_enabled" => Some("is_enabled"),
        "logisticsName" | "logistics_name" => Some("logistics_name"),
        "logisticsDesc" | "logistics_desc" => Some("logistics_desc"),
        "kuaidi100Code" | "kuaidi100_code" => Some("kuaidi100_code"),
        // 主键可归一（Java 也能命中 `getKeyColumn`），但不在白名单内
        "logisticsId" | "logistics_id" => Some("logistics_id"),
        _ => None,
    }
}

/// 校验 `updateField` 的目标列是否落在 Java 白名单内，并返回真实列名。
///
/// 复刻 Java：
/// ```text
/// field = getColumnByPropertyName(field);
/// if (!Arrays.asList(allowFields).contains(field)) throw INVALID_FIELD_VALUE;
/// ```
///
/// 返回 `Ok(column)` 时 `column` 保证同时是
/// [`LOGISTICS_COMPANY_COLUMNS`] 的真实列（`"status"` 因此永远不可达）。
///
/// # Errors
/// - 字段名无法归一，或归一后不在白名单 ⇒ `字段值不合法`
pub fn resolve_update_field(field: &str) -> Result<&'static str, String> {
    let column =
        map_update_field_column(field).ok_or_else(|| MSG_INVALID_FIELD_VALUE.to_string())?;
    if !LOGISTICS_UPDATE_FIELDS.contains(&column) {
        return Err(MSG_INVALID_FIELD_VALUE.to_string());
    }
    debug_assert!(
        LOGISTICS_COMPANY_COLUMNS.contains(&column),
        "白名单列 {column} 不是 logistics_company 的真实列"
    );
    Ok(column)
}

/// 创建请求（Java `LogisticsCompanyCreateDTO`）。
///
/// Java 侧**没有任何**校验注解（无 `@NotBlank` / `@NotNull`），
/// 唯一的业务校验在 `LogisticsCompanyServiceImpl#create` 里按
/// 「当前激活的物流服务商」分支执行。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyCreateDTO {
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否展示
    pub is_show: Option<i32>,
    /// 配送方式名称
    pub logistics_name: Option<String>,
    /// 配送方式的快递公司代号
    pub logistics_code: Option<String>,
    /// 配送方式描述
    pub logistics_desc: Option<String>,
    /// 无服务调用物流编号
    pub api_logistics_code: Option<String>,
    /// 快递100 快递公司编码
    pub kuaidi100_code: Option<String>,
    /// 快递100 电子面单账户/月结账号
    pub kuaidi100_partner_id: Option<String>,
    /// 快递100 电子面单密码
    pub kuaidi100_partner_key: Option<String>,
    /// 快递100 电子面单密钥
    pub kuaidi100_partner_secret: Option<String>,
    /// 快递100 电子面单收件网点名
    pub kuaidi100_net: Option<String>,
    /// 快递100 电子面单承载快递员名
    pub kuaidi100_check_man: Option<String>,
    /// 快递100 电子面单产品类型
    pub kuaidi100_exp_type: Option<String>,
    /// 快递100 电子面单主单模板 ID
    pub kuaidi100_temp_id: Option<String>,
    /// 快递100 电子面单子单模板 ID
    pub kuaidi100_child_temp_id: Option<String>,
    /// 快递100 电子面单回单模板 ID
    pub kuaidi100_back_temp_id: Option<String>,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: Option<i32>,
}

/// 更新请求（Java `LogisticsCompanyUpdateDTO`）。
///
/// 与 create 的唯一差别是多一个 `id`
/// （Java 里是**两个独立的类**，不是继承关系；
/// `update` 中 `logisticsCompany.setLogisticsId(updateDTO.getId())`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LogisticsCompanyUpdateDTO {
    /// 主键（Java 侧无 `@NotNull`，缺省时 `getById(null)` 会 NPE）
    pub id: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 是否展示
    pub is_show: Option<i32>,
    /// 配送方式名称
    pub logistics_name: Option<String>,
    /// 配送方式的快递公司代号
    pub logistics_code: Option<String>,
    /// 配送方式描述
    pub logistics_desc: Option<String>,
    /// 无服务调用物流编号
    pub api_logistics_code: Option<String>,
    /// 快递100 快递公司编码
    pub kuaidi100_code: Option<String>,
    /// 快递100 电子面单账户/月结账号
    pub kuaidi100_partner_id: Option<String>,
    /// 快递100 电子面单密码
    pub kuaidi100_partner_key: Option<String>,
    /// 快递100 电子面单密钥
    pub kuaidi100_partner_secret: Option<String>,
    /// 快递100 电子面单收件网点名
    pub kuaidi100_net: Option<String>,
    /// 快递100 电子面单承载快递员名
    pub kuaidi100_check_man: Option<String>,
    /// 快递100 电子面单产品类型
    pub kuaidi100_exp_type: Option<String>,
    /// 快递100 电子面单主单模板 ID
    pub kuaidi100_temp_id: Option<String>,
    /// 快递100 电子面单子单模板 ID
    pub kuaidi100_child_temp_id: Option<String>,
    /// 快递100 电子面单回单模板 ID
    pub kuaidi100_back_temp_id: Option<String>,
    /// 是否启用：1 启用，0 禁用
    pub is_enabled: Option<i32>,
}

impl LogisticsCompanyUpdateDTO {
    /// 取业务写入载荷（对应 Java 的 17 个 `BeanUtils.copyProperties` 目标字段）。
    ///
    /// `id` 不参与写入列（Java 用 `setLogisticsId(id)` 只作主键条件，
    /// MyBatis-Plus 的 `updateById` 会把主键列放进 `WHERE` 而非 `SET`）。
    #[must_use]
    pub fn as_create(&self) -> LogisticsCompanyCreateDTO {
        LogisticsCompanyCreateDTO {
            sort_order: self.sort_order,
            is_show: self.is_show,
            logistics_name: self.logistics_name.clone(),
            logistics_code: self.logistics_code.clone(),
            logistics_desc: self.logistics_desc.clone(),
            api_logistics_code: self.api_logistics_code.clone(),
            kuaidi100_code: self.kuaidi100_code.clone(),
            kuaidi100_partner_id: self.kuaidi100_partner_id.clone(),
            kuaidi100_partner_key: self.kuaidi100_partner_key.clone(),
            kuaidi100_partner_secret: self.kuaidi100_partner_secret.clone(),
            kuaidi100_net: self.kuaidi100_net.clone(),
            kuaidi100_check_man: self.kuaidi100_check_man.clone(),
            kuaidi100_exp_type: self.kuaidi100_exp_type.clone(),
            kuaidi100_temp_id: self.kuaidi100_temp_id.clone(),
            kuaidi100_child_temp_id: self.kuaidi100_child_temp_id.clone(),
            kuaidi100_back_temp_id: self.kuaidi100_back_temp_id.clone(),
            is_enabled: self.is_enabled,
        }
    }
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 单字段更新请求（Java `com.tigshop.bean.dto.common.UpdateFieldDTO`，本域自持副本）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键（必填）
    pub id: Option<i32>,
    /// 字段名（属性名或列名，必填）
    pub field: Option<String>,
    /// 值（Java 侧统一按字符串 set，由 MySQL 按目标列类型隐式转换）
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`，本域自持副本）。
///
/// Java 的 `value` 是 `int`（原始类型，缺省 0）、`data` 是
/// `Map<String, Object>`；本域仅支持 `type = "del"`，这两个字段不参与逻辑。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表（Java `@NotEmpty`）
    pub ids: Vec<i32>,
    /// 操作类型（仅 `del` 生效）
    pub r#type: String,
    /// 值（本域不使用）
    pub value: Option<i64>,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

/// 同步入参（Java `syncKdn` / `syncKuaidi100` 的 `@RequestParam`）。
///
/// Java 签名：
/// ```text
/// syncKdn(@RequestParam(defaultValue = "true") boolean overwriteName,
///         @RequestParam(defaultValue = "1") int defaultIsEnabled)
/// ```
/// 即 **query 参数**（不是 body）。
// `serde(default)` 需要类型实现 `Default`；两个字段均为 `Option`，派生即可。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SyncQuery {
    /// 是否覆盖名称，默认 `true`
    ///
    /// ⚠️ Java 是 `boolean` 原始类型 + `defaultValue = "true"`，
    /// Spring 对非法值（如 `abc`）会抛 400。本实现按字符串宽松解析，
    /// 非 `1/true/yes/on` 一律视作 `false`（见 `uncertain_points`）。
    pub overwrite_name: Option<String>,
    /// 新增行的默认启用状态，默认 `1`
    ///
    /// ⚠️ Java 是 `int` + `defaultValue = "1"`，非法值同样会 400。
    /// 本实现宽松解析为 `i32`，失败时取 `1`。
    pub default_is_enabled: Option<String>,
}

impl SyncQuery {
    /// `overwriteName` 的布尔值（默认 `true`）。
    ///
    /// 逐字符对齐 Java 的「默认 true」：缺省 / 空串 → `true`。
    #[must_use]
    pub fn overwrite_name(&self) -> bool {
        match self.overwrite_name.as_deref().map(str::trim) {
            None | Some("") => true,
            Some(v) => matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"),
        }
    }

    /// `defaultIsEnabled` 的取值（默认 `1`，非 1 一律归 0）。
    ///
    /// 逐字符对齐 Java `syncKdnLogisticsCompanies` 第一行：
    /// `defaultIsEnabled = defaultIsEnabled == 1 ? 1 : 0;`
    #[must_use]
    pub fn default_is_enabled(&self) -> i32 {
        let raw = self
            .default_is_enabled
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| s.parse::<i32>().ok())
            .unwrap_or(YES);
        if raw == YES {
            YES
        } else {
            NO
        }
    }
}

// ——————————————————————————————————————————————
// 纯函数（供服务层与单测共用）
// ——————————————————————————————————————————————

/// 快递鸟编码归一：`trim().to_uppercase()`
/// （Java `normalizeLogisticsCode`，`Locale.ROOT`）。
#[must_use]
pub fn normalize_logistics_code(code: Option<&str>) -> String {
    match code {
        None => String::new(),
        Some(c) => c.trim().to_uppercase(),
    }
}

/// 快递100 编码归一：`trim().to_lowercase()`
/// （Java `normalizeKuaidi100Code`，`Locale.ROOT`）。
#[must_use]
pub fn normalize_kuaidi100_code(code: Option<&str>) -> String {
    match code {
        None => String::new(),
        Some(c) => c.trim().to_lowercase(),
    }
}

/// 语雀表格单元格的编码归一（Java `normalizeCode`）。
///
/// ```text
/// String c = code.replaceAll("\\s+", "");
/// c = StrUtil.trim(c);
/// return StrUtil.upperFirst(c).toUpperCase();
/// ```
/// `StrUtil.upperFirst` 之后又整体 `toUpperCase()`，因此净效果就是
/// **去掉所有空白 + 全大写**（`upperFirst` 是冗余的）。
#[must_use]
pub fn normalize_yuque_code(code: Option<&str>) -> String {
    match code {
        None => String::new(),
        Some(c) => {
            let no_ws: String = c.chars().filter(|ch| !ch.is_whitespace()).collect();
            no_ws.trim().to_uppercase()
        }
    }
}

/// 判断一个单元格文本是否「看起来像快递鸟编码」（Java `looksLikeKdnCode`）。
///
/// ```text
/// return t.length() <= 32
///     && t.matches("^[A-Za-z0-9_\\-]+$")
///     && !t.matches("^\\d+$");
/// ```
/// 其中 `t` 是**去掉所有空白**后的字符串；空白串返回 `false`。
#[must_use]
pub fn looks_like_kdn_code(s: Option<&str>) -> bool {
    let Some(s) = s else { return false };
    if s.trim().is_empty() {
        return false;
    }
    let t: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    if t.is_empty() || t.chars().count() > 32 {
        return false;
    }
    let all_wordish = t
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    let all_digits = t.chars().all(|c| c.is_ascii_digit());
    all_wordish && !all_digits
}

/// 常见承运商种子（Java `Kuaidi100CodeMapping.COMMON_CARRIERS`）。
///
/// 顺序即 Java `LinkedHashMap` 的插入顺序（覆盖率为 17 项）。
/// 返回 `&'static [(&str, &str)]` 而非 `HashMap`，以保留顺序并避免守卫。
#[must_use]
pub fn common_carriers() -> &'static [(&'static str, &'static str)] {
    &[
        ("shunfeng", "顺丰速运"),
        ("yuantong", "圆通速递"),
        ("zhongtong", "中通快递"),
        ("shentong", "申通快递"),
        ("yunda", "韵达速递"),
        ("ems", "EMS"),
        ("youzhengguonei", "邮政快递包裹"),
        ("huitongkuaidi", "百世快递"),
        ("jd", "京东物流"),
        ("debangwuliu", "德邦物流"),
        ("jtexpress", "极兔速递"),
        ("youshuwuliu", "优速快递"),
        ("zhaijisong", "宅急送"),
        ("annengwuliu", "安能物流"),
        ("tiantian", "天天快递"),
        ("kuayue", "跨越速运"),
        ("cainiao", "菜鸟裹裹"),
    ]
}

/// 快递鸟编码 → 快递100 编码的映射表
/// （Java `Kuaidi100CodeMapping.KDNIAO_TO_KUAIDI100`，20 项）。
#[must_use]
pub fn kdniao_to_kuaidi100() -> &'static [(&'static str, &'static str)] {
    &[
        ("SF", "shunfeng"),
        ("SF_EXPRESS", "shunfeng"),
        ("YTO", "yuantong"),
        ("ZTO", "zhongtong"),
        ("STO", "shentong"),
        ("STO_EXPRESS", "shentong"),
        ("YD", "yunda"),
        ("YUNDA", "yunda"),
        ("EMS", "ems"),
        ("YZPY", "youzhengguonei"),
        ("HTKY", "huitongkuaidi"),
        ("JD", "jd"),
        ("DBL", "debangwuliu"),
        ("JTSD", "jtexpress"),
        ("UC", "youshuwuliu"),
        ("ZJS", "zhaijisong"),
        ("ANE", "annengwuliu"),
        ("HHTT", "tiantian"),
        ("KYSY", "kuayue"),
        ("CNSD", "cainiao"),
    ]
}

/// 按快递鸟 / 系统 `logistics_code` 兜底解析快递100 小写编码
/// （Java `Kuaidi100CodeMapping.resolve`）；找不到返回 `None`。
///
/// ```text
/// if (StrUtil.isBlank(logisticsCode)) return null;
/// String code = logisticsCode.trim();
/// String mapped = KDNIAO_TO_KUAIDI100.get(code.toUpperCase());
/// if (StrUtil.isNotBlank(mapped)) return mapped;
/// // 已是小写拼音编码时直接复用
/// if (code.equals(code.toLowerCase()) && code.matches("[a-z0-9]+")) return code;
/// return null;
/// ```
///
/// ⚠️ Java 的 `code.equals(code.toLowerCase())` 用的是**默认 Locale**，
/// 本实现用 `to_lowercase()`（Unicode 感知）。对 ASCII 编码无差异。
#[must_use]
pub fn resolve_kuaidi100_code(logistics_code: Option<&str>) -> Option<String> {
    let code = logistics_code?.trim();
    if code.is_empty() {
        return None;
    }
    let upper = code.to_uppercase();
    if let Some((_, mapped)) = kdniao_to_kuaidi100().iter().find(|(k, _)| *k == upper) {
        return Some((*mapped).to_string());
    }
    // 已是小写拼音编码时直接复用
    let lower = code.to_lowercase();
    if code == lower
        && !code.is_empty()
        && code
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
    {
        return Some(code.to_string());
    }
    None
}

/// 按快递100 编码反向查找受控的快递鸟编码
/// （Java `Kuaidi100CodeMapping.reverseResolve`）；一个快递100 编码
/// 可能对应多个别名（如 `shunfeng` → `{SF, SF_EXPRESS}`）。
///
/// 顺序与 Java `LinkedHashSet` 一致（按映射表插入顺序）。
#[must_use]
pub fn reverse_resolve_kdniao(kuaidi100_code: Option<&str>) -> Vec<&'static str> {
    let Some(raw) = kuaidi100_code else {
        return Vec::new();
    };
    let code = raw.trim().to_lowercase();
    if code.is_empty() {
        return Vec::new();
    }
    kdniao_to_kuaidi100()
        .iter()
        .filter(|(_, v)| *v == code)
        .map(|(k, _)| *k)
        .collect()
}

/// 支持映射到快递100 的全部受控快递鸟编码
/// （Java `Kuaidi100CodeMapping.mappedLogisticsCodes`）。
#[must_use]
pub fn mapped_logistics_codes() -> Vec<&'static str> {
    kdniao_to_kuaidi100().iter().map(|(k, _)| *k).collect()
}

/// Java `LogisticsProviderType.fromCode`：未知值归 `UNKNOWN(0)`。
#[must_use]
pub const fn provider_type_from_code(code: i32) -> i32 {
    match code {
        PROVIDER_KDNIAO => PROVIDER_KDNIAO,
        PROVIDER_KUAIDI100 => PROVIDER_KUAIDI100,
        _ => 0,
    }
}

/// Java `LogisticsProviderRouter#resolveProviderType`：把配置值解析为服务商类型。
///
/// ```text
/// String val = configService.getConfigVal(SettingsEnum.LOGISTICS_PROVIDER);
/// if (StrUtil.isBlank(val)) return KDNIAO(1);
/// try {
///     int type = Integer.parseInt(val.trim());
///     if (type == KUAIDI100(2)) return 2;
///     return KDNIAO(1);
/// } catch (NumberFormatException e) {
///     return KDNIAO(1);
/// }
/// ```
///
/// 即：**只有恰好 2 才是快递100，其它一切（含 null / 空 / 非法数字）都是快递鸟**。
#[must_use]
pub fn resolve_provider_type(config_val: Option<&str>) -> i32 {
    let Some(val) = config_val else {
        return PROVIDER_KDNIAO;
    };
    let trimmed = val.trim();
    if trimmed.is_empty() {
        return PROVIDER_KDNIAO;
    }
    match trimmed.parse::<i32>() {
        Ok(PROVIDER_KUAIDI100) => PROVIDER_KUAIDI100,
        _ => PROVIDER_KDNIAO,
    }
}

/// 校验「当前激活服务商」对编码的必填要求
/// （对应 Java `create` / `update` 里的两段 `StrUtil.isBlank` 判断）。
///
/// # Errors
/// - 服务商为快递100 且 `kuaidi100_code` 为空 ⇒ `快递100物流公司编码不能为空`
/// - 服务商为快递鸟 且 `logistics_code` 为空 ⇒ `快递鸟物流公司编码不能为空`
pub fn validate_provider_codes(
    provider_type: i32,
    logistics_code: Option<&str>,
    kuaidi100_code: Option<&str>,
) -> Result<(), String> {
    let blank = |v: Option<&str>| v.map(str::trim).map_or(true, str::is_empty);
    if provider_type == PROVIDER_KUAIDI100 && blank(kuaidi100_code) {
        return Err(MSG_KUAIDI100_CODE_REQUIRED.to_string());
    }
    if provider_type == PROVIDER_KDNIAO && blank(logistics_code) {
        return Err(MSG_KDNIAO_CODE_REQUIRED.to_string());
    }
    Ok(())
}

/// `StrUtil.blankToDefault(name, code)`：名称为空白时用编码兜底。
#[must_use]
pub fn blank_to_default(name: Option<&str>, default: &str) -> String {
    match name.map(str::trim) {
        Some(v) if !v.is_empty() => v.to_string(),
        _ => default.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java 逐字符对照 —————————————————————

    /// Java `LogisticsCompanyController.LOGISTICS_UPDATE_FIELDS` 的逐字对照。
    #[test]
    fn update_fields_matches_java_constant() {
        assert_eq!(
            LOGISTICS_UPDATE_FIELDS,
            [
                "is_show",
                "sort_order",
                "status",
                "logistics_code",
                "is_enabled",
                "logistics_name",
                "logistics_desc",
                "kuaidi100_code",
            ]
        );
    }

    /// ⚠️ 白名单里的 `"status"` **不是** `logistics_company` 的真实列。
    ///
    /// 该断言把这个 Java 侧的事实固化下来：若有人「顺手」往
    /// `LOGISTICS_COMPANY_COLUMNS` 里补 `status`，此测试会立刻失败。
    #[test]
    fn status_is_not_a_real_column() {
        assert!(LOGISTICS_UPDATE_FIELDS.contains(&"status"));
        assert!(!LOGISTICS_COMPANY_COLUMNS.contains(&"status"));
        // 因此 `status` 永远无法通过 resolve_update_field
        assert!(resolve_update_field("status").is_err());
    }

    /// Java 常量文案逐字符照抄。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_KUAIDI100_CODE_REQUIRED, "快递100物流公司编码不能为空");
        assert_eq!(MSG_KDNIAO_CODE_REQUIRED, "快递鸟物流公司编码不能为空");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_YUQUE_MISSING_DATA, "语雀接口返回异常：缺少 data 字段");
        assert_eq!(
            MSG_YUQUE_MISSING_CONTENT,
            "语雀接口返回异常：缺少 data.content（快递公司编码表内容）"
        );
        assert_eq!(CONFIG_KEY_LOGISTICS_PROVIDER, "logisticsProvider");
    }

    /// 本域主键列是 `logistics_id`（**不是** `id`）。
    #[test]
    fn key_column_is_logistics_id() {
        assert_eq!(KEY_COLUMN, "logistics_id");
        assert_eq!(KEY_PROPERTY, "logisticsId");
        assert!(LOGISTICS_COMPANY_COLUMNS.contains(&KEY_COLUMN));
        assert!(!LOGISTICS_COMPANY_COLUMNS.contains(&"id"));
    }

    /// 25 个列全部来自权威 schema，且无重复。
    #[test]
    fn columns_match_authoritative_schema() {
        assert_eq!(LOGISTICS_COMPANY_COLUMNS.len(), 25);
        let mut seen = std::collections::HashSet::new();
        for c in LOGISTICS_COMPANY_COLUMNS {
            assert!(seen.insert(c), "列 {c} 重复");
        }
        // 白名单里除 status 外全部是真实列
        for f in LOGISTICS_UPDATE_FIELDS {
            if f != "status" {
                assert!(LOGISTICS_COMPANY_COLUMNS.contains(&f), "{f} 不是真实列");
            }
        }
    }

    // ————————————————————— 纯逻辑：updateField 白名单 —————————————————————

    /// 归一 + 白名单：`logisticsId` 能归一但被白名单拒绝；
    /// 未识别字段与 `status` 都直接拒绝。
    #[test]
    fn update_field_whitelist_flow() {
        for (input, column) in [
            ("isShow", "is_show"),
            ("is_show", "is_show"),
            ("sortOrder", "sort_order"),
            ("sort_order", "sort_order"),
            ("logisticsCode", "logistics_code"),
            ("logistics_code", "logistics_code"),
            ("isEnabled", "is_enabled"),
            ("is_enabled", "is_enabled"),
            ("logisticsName", "logistics_name"),
            ("logistics_name", "logistics_name"),
            ("logisticsDesc", "logistics_desc"),
            ("logistics_desc", "logistics_desc"),
            ("kuaidi100Code", "kuaidi100_code"),
            ("kuaidi100_code", "kuaidi100_code"),
        ] {
            assert_eq!(resolve_update_field(input), Ok(column), "{input}");
        }
        // 主键可归一，但不在白名单 ⇒ Java 报「字段值不合法」
        let id_col = map_update_field_column("logisticsId").unwrap();
        assert_eq!(id_col, "logistics_id");
        assert!(!LOGISTICS_UPDATE_FIELDS.contains(&id_col));
        assert_eq!(
            resolve_update_field("logisticsId"),
            Err(MSG_INVALID_FIELD_VALUE.to_string())
        );
        // 完全无法识别 ⇒ 归一失败
        assert_eq!(
            resolve_update_field("nope"),
            Err(MSG_INVALID_FIELD_VALUE.to_string())
        );
        // status 在白名单里却不是真实列 ⇒ 同样拒绝
        assert_eq!(
            resolve_update_field("status"),
            Err(MSG_INVALID_FIELD_VALUE.to_string())
        );
    }

    // ————————————————————— 纯逻辑：排序 —————————————————————

    /// Java `buildSortOrder` 三分支 + 固定二级排序。
    #[test]
    fn order_clause_three_branches() {
        // 默认：主键降序，且固定排序在前
        assert_eq!(
            LogisticsCompanyListQuery::default().order_clause(),
            " ORDER BY is_enabled DESC, logistics_id DESC, logistics_id DESC"
        );
        // asc
        let q = LogisticsCompanyListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY is_enabled DESC, logistics_id DESC, logistics_id ASC"
        );
        // desc（显式）
        let q = LogisticsCompanyListQuery {
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY is_enabled DESC, logistics_id DESC, logistics_id DESC"
        );
        // 非法值：Java else-if 未覆盖 ⇒ 只有固定排序
        let q = LogisticsCompanyListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY is_enabled DESC, logistics_id DESC"
        );
    }

    /// 未识别 `sortField` 静默回退主键列（防注入）。
    #[test]
    fn unknown_sort_field_falls_back_to_key() {
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("logisticsName"), "logistics_name");
        assert_eq!(map_order_column("is_enabled"), "is_enabled");
        let q = LogisticsCompanyListQuery {
            sort_field: Some("1; DROP TABLE logistics_company".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(
            q.order_clause(),
            " ORDER BY is_enabled DESC, logistics_id DESC, logistics_id DESC"
        );
        // sortField == 主键属性名 ⇒ 主键列
        let q = LogisticsCompanyListQuery {
            sort_field: Some("logisticsId".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.user_order_clause(), "logistics_id ASC");
    }

    // ————————————————————— 纯逻辑：list 过滤 —————————————————————

    /// ⚠️ `shopId` 只在取值为 0 / 1（合法 `IsShowType` 码）时才生效，
    /// 其它值**静默忽略** —— 复刻 Java 的枚举误用。
    #[test]
    fn shop_id_filter_only_accepts_is_show_type_codes() {
        for (input, expected) in [
            (Some(0), Some(0)),
            (Some(1), Some(1)),
            (Some(5), None), // 真实店铺 ID 反而被丢弃
            (Some(100), None),
            (Some(-1), None),
            (None, None),
        ] {
            let q = LogisticsCompanyListQuery {
                shop_id: input,
                ..Default::default()
            };
            assert_eq!(q.effective_shop_id(), expected, "shopId={input:?}");
        }
    }

    /// 关键字去空白后为空则不过滤（Java `StrUtil.isNotEmpty`）。
    #[test]
    fn keyword_trims_and_ignores_blank() {
        let q = LogisticsCompanyListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), None);
        let q = LogisticsCompanyListQuery {
            keyword: Some(" 顺丰 ".into()),
            ..Default::default()
        };
        assert_eq!(q.effective_keyword(), Some("顺丰"));
    }

    /// Java `BasePage`：`page` 默认 1，`size` 默认 15、上限 100。
    #[test]
    fn page_query_defaults_match_base_page() {
        let q = LogisticsCompanyListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);

        let q = LogisticsCompanyListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);

        let q = LogisticsCompanyListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 1);

        let q = LogisticsCompanyListQuery {
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
    }

    // ————————————————————— 纯逻辑：编码归一 —————————————————————

    /// 快递鸟编码：去空白 + 全大写；快递100 编码：去空白 + 全小写。
    #[test]
    fn code_normalization_directions() {
        assert_eq!(normalize_logistics_code(Some("  sf ")), "SF");
        assert_eq!(normalize_logistics_code(Some("sto")), "STO");
        assert_eq!(normalize_logistics_code(None), "");
        assert_eq!(normalize_kuaidi100_code(Some("  SF ")), "sf");
        assert_eq!(normalize_kuaidi100_code(Some("YuanTong")), "yuantong");
        assert_eq!(normalize_kuaidi100_code(None), "");
    }

    /// 语雀编码归一 = 去掉所有空白 + 全大写（`upperFirst` 是冗余步骤）。
    #[test]
    fn yuque_code_normalization() {
        assert_eq!(normalize_yuque_code(Some(" sf ")), "SF");
        assert_eq!(normalize_yuque_code(Some("S F _ E X")), "SF_EX");
        assert_eq!(normalize_yuque_code(Some("sto")), "STO");
        assert_eq!(normalize_yuque_code(None), "");
    }

    /// `looksLikeKdnCode`：≤32 位、`[A-Za-z0-9_-]`、非纯数字。
    #[test]
    fn looks_like_kdn_code_rules() {
        assert!(looks_like_kdn_code(Some("SF")));
        assert!(looks_like_kdn_code(Some("SF_EXPRESS")));
        assert!(looks_like_kdn_code(Some("sto")));
        // 纯数字不算编码（排除「序号」列）
        assert!(!looks_like_kdn_code(Some("123")));
        // 含中文/空格分隔的中文名不算编码
        assert!(!looks_like_kdn_code(Some("顺丰速运")));
        // 空白串
        assert!(!looks_like_kdn_code(Some("   ")));
        assert!(!looks_like_kdn_code(None));
        // 超长（>32）
        assert!(!looks_like_kdn_code(Some(&"A".repeat(33))));
        assert!(looks_like_kdn_code(Some(&"A".repeat(32))));
        // 带点的编码不算（正则不含 `.`）
        assert!(!looks_like_kdn_code(Some("SF.EX")));
    }

    // ————————————————————— 纯逻辑：快递100 编码解析 —————————————————————

    /// `resolve` 三分支：受控映射 → 已是小写拼音 → null。
    #[test]
    fn resolve_kuaidi100_code_branches() {
        assert_eq!(
            resolve_kuaidi100_code(Some("SF")).as_deref(),
            Some("shunfeng")
        );
        assert_eq!(
            resolve_kuaidi100_code(Some(" sf ")).as_deref(),
            Some("shunfeng")
        );
        assert_eq!(
            resolve_kuaidi100_code(Some("STO_EXPRESS")).as_deref(),
            Some("shentong")
        );
        // 已是小写拼音编码 → 直接复用
        assert_eq!(
            resolve_kuaidi100_code(Some("shunfeng")).as_deref(),
            Some("shunfeng")
        );
        assert_eq!(
            resolve_kuaidi100_code(Some("abc123")).as_deref(),
            Some("abc123")
        );
        // 大写但不在映射表里 → null
        assert_eq!(resolve_kuaidi100_code(Some("UNKNOWNX")), None);
        // 混合大小写拼音 → 既不在映射表，也不等于全小写 → null
        assert_eq!(resolve_kuaidi100_code(Some("ShunFeng")), None);
        // 空 / null
        assert_eq!(resolve_kuaidi100_code(Some("   ")), None);
        assert_eq!(resolve_kuaidi100_code(None), None);
    }

    /// `reverseResolve`：一个快递100 编码可对应多个快递鸟别名。
    #[test]
    fn reverse_resolve_returns_all_aliases() {
        assert_eq!(
            reverse_resolve_kdniao(Some("shunfeng")),
            vec!["SF", "SF_EXPRESS"]
        );
        assert_eq!(
            reverse_resolve_kdniao(Some(" SHUNFENG ")),
            vec!["SF", "SF_EXPRESS"]
        );
        assert_eq!(
            reverse_resolve_kdniao(Some("shentong")),
            vec!["STO", "STO_EXPRESS"]
        );
        // 单别名
        assert_eq!(reverse_resolve_kdniao(Some("yuantong")), vec!["YTO"]);
        // 未知 / 空
        assert!(reverse_resolve_kdniao(Some("nope")).is_empty());
        assert!(reverse_resolve_kdniao(None).is_empty());
        assert!(reverse_resolve_kdniao(Some("  ")).is_empty());
    }

    /// 映射表与常见承运商种子的规模（Java 里分别是 20 / 17 项）。
    #[test]
    fn mapping_table_sizes_match_java() {
        assert_eq!(kdniao_to_kuaidi100().len(), 20);
        assert_eq!(common_carriers().len(), 17);
        assert_eq!(mapped_logistics_codes().len(), 20);
        // 常见承运商的首项与末项（Java LinkedHashMap 顺序）
        assert_eq!(common_carriers()[0], ("shunfeng", "顺丰速运"));
        assert_eq!(common_carriers()[16], ("cainiao", "菜鸟裹裹"));
        // 每个承运商编码都必须是已归一的小写（否则同步会匹配不上）
        for (code, name) in common_carriers() {
            assert_eq!(normalize_kuaidi100_code(Some(code)), *code);
            assert!(!name.is_empty());
        }
    }

    // ————————————————————— 纯逻辑：服务商路由 —————————————————————

    /// Java `resolveProviderType`：**只有恰好 2 是快递100**，其余一切是快递鸟。
    #[test]
    fn provider_type_resolution_defaults_to_kdniao() {
        assert_eq!(resolve_provider_type(Some("2")), PROVIDER_KUAIDI100);
        assert_eq!(resolve_provider_type(Some(" 2 ")), PROVIDER_KUAIDI100);
        assert_eq!(resolve_provider_type(Some("1")), PROVIDER_KDNIAO);
        assert_eq!(resolve_provider_type(Some("3")), PROVIDER_KDNIAO);
        assert_eq!(resolve_provider_type(Some("abc")), PROVIDER_KDNIAO);
        assert_eq!(resolve_provider_type(Some("")), PROVIDER_KDNIAO);
        assert_eq!(resolve_provider_type(None), PROVIDER_KDNIAO);
    }

    /// `LogisticsProviderType.fromCode`：未知值归 UNKNOWN(0)。
    #[test]
    fn provider_type_from_code_matches_java_enum() {
        assert_eq!(provider_type_from_code(0), 0);
        assert_eq!(provider_type_from_code(1), PROVIDER_KDNIAO);
        assert_eq!(provider_type_from_code(2), PROVIDER_KUAIDI100);
        assert_eq!(provider_type_from_code(7), 0);
        assert_eq!(provider_type_from_code(-1), 0);
    }

    /// 服务商编码必填校验（Java `create` / `update` 的两段 `isBlank`）。
    #[test]
    fn provider_code_validation() {
        // 快递100：kuaidi100Code 必填，logisticsCode 不要
        assert_eq!(
            validate_provider_codes(PROVIDER_KUAIDI100, Some("SF"), None),
            Err(MSG_KUAIDI100_CODE_REQUIRED.to_string())
        );
        assert_eq!(
            validate_provider_codes(PROVIDER_KUAIDI100, Some("SF"), Some("   ")),
            Err(MSG_KUAIDI100_CODE_REQUIRED.to_string())
        );
        assert!(validate_provider_codes(PROVIDER_KUAIDI100, None, Some("shunfeng")).is_ok());
        assert!(validate_provider_codes(PROVIDER_KUAIDI100, Some("SF"), Some("shunfeng")).is_ok());

        // 快递鸟：logisticsCode 必填，kuaidi100Code 不要
        assert_eq!(
            validate_provider_codes(PROVIDER_KDNIAO, None, Some("shunfeng")),
            Err(MSG_KDNIAO_CODE_REQUIRED.to_string())
        );
        assert_eq!(
            validate_provider_codes(PROVIDER_KDNIAO, Some("  "), Some("shunfeng")),
            Err(MSG_KDNIAO_CODE_REQUIRED.to_string())
        );
        assert!(validate_provider_codes(PROVIDER_KDNIAO, Some("SF"), None).is_ok());

        // blankToDefault
        assert_eq!(blank_to_default(Some("顺丰"), "SF"), "顺丰");
        assert_eq!(blank_to_default(Some("  "), "SF"), "SF");
        assert_eq!(blank_to_default(None, "SF"), "SF");
    }

    // ————————————————————— 纯逻辑：同步参数 —————————————————————

    /// `SyncQuery` 默认值：`overwriteName` 默认 true，`defaultIsEnabled` 默认 1。
    #[test]
    fn sync_query_defaults_match_java_request_params() {
        let q: SyncQuery = serde_json::from_str("{}").unwrap();
        assert!(q.overwrite_name());
        assert_eq!(q.default_is_enabled(), 1);

        let q: SyncQuery = serde_json::from_str(r#"{"overwriteName":"false"}"#).unwrap();
        assert!(!q.overwrite_name());
        assert_eq!(q.default_is_enabled(), 1);

        let q: SyncQuery =
            serde_json::from_str(r#"{"overwriteName":"true","defaultIsEnabled":"0"}"#).unwrap();
        assert!(q.overwrite_name());
        assert_eq!(q.default_is_enabled(), 0);
    }

    /// `defaultIsEnabled` 逐字符复刻 Java 的 `== 1 ? 1 : 0`。
    #[test]
    fn default_is_enabled_collapses_to_binary() {
        for (input, expected) in [
            (Some("1"), 1),
            (Some("0"), 0),
            (Some("2"), 0),
            (Some("-1"), 0),
            (Some("abc"), 1), // 解析失败 → 走 defaultValue "1"
            (Some(""), 1),
            (None, 1),
        ] {
            let q = SyncQuery {
                overwrite_name: None,
                default_is_enabled: input.map(str::to_string),
            };
            assert_eq!(q.default_is_enabled(), expected, "input={input:?}");
        }
    }

    // ————————————————————— 纯逻辑：VO 映射 —————————————————————

    /// `detail` 的 VO 不含 `isBound`（Java 未设该字段 ⇒ JSON 为 null）。
    #[test]
    fn vo_from_entity_leaves_is_bound_none() {
        let e = LogisticsCompany {
            logistics_id: 7,
            logistics_code: "SF".into(),
            logistics_name: "顺丰速运".into(),
            logistics_desc: "".into(),
            sort_order: 50,
            is_show: 1,
            shop_id: 0,
            api_logistics_code: Some("".into()),
            kuaidi100_code: "shunfeng".into(),
            is_enabled: 1,
            ..Default::default()
        };
        let vo = LogisticsCompanyVO::from(&e);
        assert_eq!(vo.logistics_id, 7);
        assert_eq!(vo.logistics_name, "顺丰速运");
        assert_eq!(vo.is_bound, None);

        // list 场景带绑定标记
        let bound = LogisticsCompanyVO::from_entity_bound(&e, true);
        assert_eq!(bound.is_bound, Some(1));
        let unbound = LogisticsCompanyVO::from_entity_bound(&e, false);
        assert_eq!(unbound.is_bound, Some(0));
    }

    /// VO 序列化为 camelCase，且**不包含**租户 / 凭证字段。
    #[test]
    fn vo_json_shape_hides_sensitive_columns() {
        let e = LogisticsCompany {
            logistics_id: 1,
            shop_id: 9,
            customer_pwd: Some("secret".into()),
            customer_name: Some("cust".into()),
            ..Default::default()
        };
        let vo = LogisticsCompanyVO::from(&e);
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains("\"logisticsId\":1"));
        assert!(json.contains("\"kuaidi100Code\""));
        assert!(json.contains("\"isBound\":null"));
        // Java VO 没有这些字段，BeanUtils 不会拷贝 ⇒ Rust 也不得暴露
        assert!(!json.contains("shopId"));
        assert!(!json.contains("customerPwd"));
        assert!(!json.contains("secret"));
        assert!(!json.contains("customerName"));
    }

    /// `DetailQuery` 风格的入参鉴权：`SyncQuery` 之外的核心 DTO 反序列化。
    #[test]
    fn dtos_deserialize_java_param_names() {
        let dto: LogisticsCompanyCreateDTO = serde_json::from_str(
            r#"{"logisticsName":"顺丰","logisticsCode":"SF","sortOrder":50,"isShow":1,"isEnabled":1}"#,
        )
        .unwrap();
        assert_eq!(dto.logistics_name.as_deref(), Some("顺丰"));
        assert_eq!(dto.logistics_code.as_deref(), Some("SF"));
        assert_eq!(dto.sort_order, Some(50));
        assert_eq!(dto.is_show, Some(1));
        assert_eq!(dto.is_enabled, Some(1));

        let dto: LogisticsCompanyUpdateDTO =
            serde_json::from_str(r#"{"id":3,"logisticsName":"圆通"}"#).unwrap();
        assert_eq!(dto.id, Some(3));
        assert_eq!(dto.as_create().logistics_name.as_deref(), Some("圆通"));

        let dto: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":3,"field":"isShow","val":"1"}"#).unwrap();
        assert_eq!(dto.field.as_deref(), Some("isShow"));
        assert_eq!(dto.val.as_deref(), Some("1"));

        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(dto.r#type, "del");
        assert_eq!(dto.ids, vec![1, 2]);

        let dto: OperateDTO = serde_json::from_str(r#"{"id":4}"#).unwrap();
        assert_eq!(dto.id, Some(4));

        let q: LogisticsCompanyListQuery = serde_json::from_str(
            r#"{"keyword":"顺","isEnabled":1,"providerType":2,"page":2,"size":30,"sortField":"sortOrder","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.effective_keyword(), Some("顺"));
        assert_eq!(q.is_enabled, Some(1));
        assert_eq!(q.provider_type, Some(2));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.user_order_clause(), "sort_order ASC");
    }

    /// 同步结果的 JSON 形状（Java `SyncLogisticsCompanyResultVO`）。
    #[test]
    fn sync_result_json_shape() {
        let r = SyncLogisticsCompanyResultVO {
            remote_total: 20,
            inserted: 3,
            updated: 1,
            conflicted: 2,
        };
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["remoteTotal"], 20);
        assert_eq!(json["inserted"], 3);
        assert_eq!(json["updated"], 1);
        assert_eq!(json["conflicted"], 2);
    }
}
