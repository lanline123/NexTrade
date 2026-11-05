//! 会员企业认证域（member::user_company）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.model.user.UserCompany`（表 `user_company`）
//! - `com.tigshop.bean.dto.user.UserCompanyListDTO extends BasePage`
//! - `com.tigshop.bean.dto.user.UserCompanyAuditDTO`
//! - `com.tigshop.bean.vo.user.UserCompanyVO`（列表项，含嵌套 `UserVO`）
//! - `com.tigshop.bean.vo.user.UserCompanyItemVO`（详情，含
//!   `CompanyDataVO` / `PhotoVO` / `PicInfo` / `UserVO` 四个嵌套类）
//! - `com.tigshop.bean.dto.common.OperateDTO`（本域自持副本）
//! - `com.tigshop.bean.enums.user.UserCompanyAudit`（1 待审核 2 审核通过 3 审核不通过）
//! - `com.tigshop.bean.enums.user.UserCompanyType`（1 个人 2 企业）
//! - `com.tigshop.common.constant.user.UserCompanyConstants`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField` /
//!   `keyword` / `sortOrder` / `sortItems`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 本域（会员企业认证审核）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。
//!
//! ## `companyData` 的序列化口径（已核实的坑）
//!
//! Java `UserCompanyServiceImpl#list` 第 140 行：
//! ```text
//! String userCompanyJson = JSONUtil.toJsonStr(
//!         JSONUtil.toBean(userCompany.getCompanyData(), UserCompanyCreateDTO.CompanyDataVO.class));
//! userCompanyVO.setCompanyData(JsonUtil.fromJson(userCompanyJson, JSONObject.class));
//! ```
//! 即：Hutool 把库里的 JSON **先反序列化成 `CompanyDataVO` 再序列化回去**，
//! 目的是「兼容之前的 companyData 下划线的内容」——
//! Hutool 的 bean 字段名是 camelCase，这一来一回会**丢弃库中所有多余的键**
//! （例如历史遗留的下划线键 `company_name`、`license_addr_province` 等），
//! 只保留 `CompanyDataVO` 上声明过的 camelCase 字段。
//!
//! ⚠️ 随后用的 **`JsonUtil`** 是项目自有工具（Jackson +
//! `Include.ALWAYS` + `INDENT_OUTPUT`），与前面的 Hutool 不是同一个库：
//! 它对 `null` 字段**保留**（不丢弃），且输出**带缩进**。
//! 本实现按「保留 null」处理（见 `CompanyDataVO` 的 `Serialize` 派生于
//! 所有字段都无 `skip_serializing_if`）。
//!
//! 该白名单丢弃行为对 `UserCompanyVO`（列表）与 `UserCompanyItemVO`（详情）
//! 两者都适用，但**两张 CompanyData 字段清单不同**：
//! 详情多出 `licenseAddrProvinceName` / `businessScope` / `businessLicenseId`
//! 三个字段。本文件按各自的清单定义两个结构体
//! （[`CompanyDataVO`] 用于详情，[`CompanyDataListItemVO`] 用于列表）。

use serde::{Deserialize, Serialize};

use crate::entities::UserCompany;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `UserCompanyConstants` / `UserCompanyAudit` / `UserCompanyType`）
// ——————————————————————————————————————————————

/// `user_company` 真实存在的 11 个列
/// （`python tools/schema_parser.py --table user_company`）。
///
/// 用于 `list` 排序字段的二次校验，保证不会把不存在的列拼进 SQL。
pub const USER_COMPANY_COLUMNS: [&str; 11] = [
    "id",
    "user_id",
    "type",
    "contact_name",
    "contact_mobile",
    "company_name",
    "company_data",
    "status",
    "audit_remark",
    "audit_time",
    "add_time",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty`；`UserCompany.id`）。
pub const KEY_PROPERTY: &str = "id";

/// 审核状态：待审核（Java `UserCompanyAudit.PENDING`）。
pub const STATUS_PENDING: i32 = 1;

/// 审核状态：审核通过（Java `UserCompanyAudit.PASS`）。
pub const STATUS_PASS: i32 = 2;

/// 审核状态：审核不通过（Java `UserCompanyAudit.FAIL`）。
pub const STATUS_FAIL: i32 = 3;

/// 认证类型：个人（Java `UserCompanyType.PERSONAL`）。
pub const TYPE_PERSONAL: i32 = 1;

/// 认证类型：企业（Java `UserCompanyType.COMPANY`）。
pub const TYPE_COMPANY: i32 = 2;

/// 会员「已企业认证」标记（Java `user.setIsCompanyAuth(1)`）。
pub const IS_COMPANY_AUTH_YES: i32 = 1;

/// `BasePage.size` 默认值（Java `BasePage.getSize()`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;

/// `BasePage.size` 上限（Java `BasePage.getSize()`：`size > 100` 时返回 100）。
pub const MAX_PAGE_SIZE: u64 = 100;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
// 全部取自 `com.tigshop.common.constant.user.UserCompanyConstants`。

/// Java `UserCompanyConstants.USER_COMPANY_STATUS_ONLY_WAIT`。
pub const MSG_STATUS_ONLY_WAIT: &str = "只有待审核状态可以更新";

/// Java `UserCompanyConstants.USER_COMPANY_AUDIT_REMARK_NOT_NULL`。
pub const MSG_AUDIT_REMARK_NOT_NULL: &str = "请填写不通过说明";

/// Java `UserCompanyConstants.USER_NOT_EXIST`。
pub const MSG_USER_NOT_EXIST: &str = "该会员不存在";

/// Java `UserCompanyServiceImpl#detail` / `#clientDetail` 内的字面量。
pub const MSG_USER_COMPANY_NOT_FOUND: &str = "企业认证信息不存在";

/// Java `UserCompanyServiceImpl#audit` 的 `Assert.notNull` 文案
/// （注意与 `MSG_USER_COMPANY_NOT_FOUND` **不同**：审计路径用的是「未知的」）。
pub const MSG_UNKNOWN_USER_COMPANY: &str = "未知的会员企业认证信息";

/// Java `UserCompanyConstants.USER_COMPANY_ID_NOT_NULL`（本域 `OperateDTO.id` 语义）。
pub const MSG_USER_COMPANY_ID_NOT_NULL: &str = "会员企业认证id不能为空";

/// Java `UserCompanyAudit.getStatusName` 未命中时的错误码来源
/// （`ExceptionConstants.DATA_TYPE_ERROR`，配合 `HttpStatus.SERVICE_DATA_ERROR`）。
///
/// 该枚举查不到时**抛异常**而不是返回空串，本实现用 [`resolve_status_text`]
/// 返回 `None` 表达「无法解析」。
pub const MSG_DATA_TYPE_ERROR: &str = "数据类型错误";

// ——————————————————————————————————————————————
// 枚举文案（Java `UserCompanyAudit` / `UserCompanyType`）
// ——————————————————————————————————————————————

/// 审核状态文案（Java `UserCompanyAudit.getStatusName`）。
///
/// 与 Java 的一处**有意偏离**：Java 在未命中时 `throw new GlobalException(...)`，
/// 而 `list` / `detail` 都是无条件调用它 —— 也就是说库里只要出现
/// `status` 不在 `{1,2,3}` 的记录，**整个列表/详情接口就会 500**。
/// 本实现改为返回 `None`，由调用方回退为空串，避免一条脏数据打挂整个列表
/// （见返回值 `uncertain_points`，这是一处**未被授权的行为收敛**，
/// 若要求与线上逐字符一致，应改回抛错）。
#[must_use]
pub fn resolve_status_text(status: i32) -> Option<&'static str> {
    match status {
        STATUS_PENDING => Some("待审核"),
        STATUS_PASS => Some("审核通过"),
        STATUS_FAIL => Some("审核不通过"),
        _ => None,
    }
}

/// 认证类型文案（Java `UserCompanyType.getTypeName`）。
///
/// 同 [`resolve_status_text`]：Java 未命中时抛异常，本实现返回 `None`。
#[must_use]
pub fn resolve_type_text(r#type: i32) -> Option<&'static str> {
    match r#type {
        TYPE_PERSONAL => Some("个人"),
        TYPE_COMPANY => Some("企业"),
        _ => None,
    }
}

/// 审核状态文案（回退空串版本，供 VO 直接取用）。
#[must_use]
pub fn status_text_or_empty(status: i32) -> String {
    resolve_status_text(status).unwrap_or_default().to_string()
}

/// 认证类型文案（回退空串版本，供 VO 直接取用）。
#[must_use]
pub fn type_text_or_empty(r#type: i32) -> String {
    resolve_type_text(r#type).unwrap_or_default().to_string()
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime(Long)`：
/// `null` 或 `0` 返回**空串**）。
///
/// Java 的入参是 `Long`（可空），本实现用 `Option<i32>`；
/// `user_company.audit_time` / `add_time` 都是 `int unsigned NULL`。
#[must_use]
pub fn format_time(secs: Option<i32>) -> String {
    let Some(secs) = secs else {
        return String::new();
    };
    if secs == 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

// ——————————————————————————————————————————————
// 出参：列表项
// ——————————————————————————————————————————————

/// 列表项 VO（对应 Java `com.tigshop.bean.vo.user.UserCompanyVO`）。
///
/// Java 用 `BeanUtils.copyProperties(userCompany, vo)` 拷贝同名属性，
/// 随后逐项覆盖 `user` / `username` / `isCompanyAuth` / `statusText` /
/// `typeText` / `companyData` / `addTime` / `auditTime`。
///
/// ⚠️ `addTime` / `auditTime` 是 **String**（Java 里被 `TigUtils.handelTime`
/// 覆盖成了格式化后的字符串），与实体里的秒级时间戳不同；Rust 侧同名同型。
///
/// ⚠️ `contactMobile` 带 `@Sensitive(PHONE)`（手机号脱敏切面）；
/// `companyData.contactPhone` 带 `@SensitiveJson`。Rust 侧脱敏切面尚未实现，
/// 本实现原样返回库中值（见返回值 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyListVO {
    /// 会员企业认证ID
    pub id: i32,
    /// 用户id
    pub user_id: i32,
    /// 认证类型：1 个人 2 企业
    pub r#type: i32,
    /// 联系人名称
    pub contact_name: String,
    /// 联系人手机
    pub contact_mobile: String,
    /// 企业名称
    pub company_name: String,
    /// 企业认证信息（经 `CompanyDataListItemVO` 白名单过滤后的 JSON 对象）
    pub company_data: Option<CompanyDataListItemVO>,
    /// 审核状态：1 待审核 2 审核通过 3 审核未通过
    pub status: i32,
    /// 审核备注
    pub audit_remark: String,
    /// 审核时间（已格式化）
    pub audit_time: String,
    /// 添加时间（已格式化）
    pub add_time: String,
    /// 用户名（取自关联 `user.username`；用户不存在时保持 `None`）
    pub username: Option<String>,
    /// 是否企业认证（取自关联 `user.is_company_auth`；用户不存在时保持 `None`）
    pub is_company_auth: Option<i32>,
    /// 用户信息
    pub user: UserVO,
    /// 状态文本
    pub status_text: String,
    /// 类型文本
    pub type_text: String,
}

/// 嵌套用户信息（对应 Java `UserCompanyVO.UserVO` 与
/// `UserCompanyItemVO.UserVO`，两者字段完全相同，共用一份）。
///
/// Java `list` 里对**每一条**记录都新建 `UserVO` 并
/// `BeanUtils.copyProperties(user, userVO)`；user 为 null 时字段全空。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserVO {
    /// 用户id
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 手机号
    pub mobile: String,
    /// 是否企业认证
    pub is_company_auth: i32,
}

impl UserVO {
    /// 由 `user` 实体构造（Java `BeanUtils.copyProperties(user, userVO)`）。
    #[must_use]
    pub fn from_entity(u: &crate::entities::User) -> Self {
        Self {
            user_id: u.user_id,
            username: u.username.clone(),
            mobile: u.mobile.clone(),
            is_company_auth: u.is_company_auth,
        }
    }
}

// ——————————————————————————————————————————————
// 出参：详情
// ——————————————————————————————————————————————

/// 详情 VO（对应 Java `com.tigshop.bean.vo.user.UserCompanyItemVO`）。
///
/// ⚠️ 与列表项 VO 的差异（逐条对照 Java 源码）：
/// - `auditRemark` / `auditTime` / `addTime` 同样被覆盖为字符串
/// - **没有** `username` / `isCompanyAuth` / `statusText` 之外的顶层差异：
///   详情 VO 确有 `statusText` / `typeText`
/// - `user` 用 `Optional.ofNullable(user).ifPresent(...)`：用户不存在时
///   **保持 `null`**（列表里则会赋一个全空对象）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyDetailVO {
    /// 状态文本
    pub status_text: String,
    /// 类型文本
    pub type_text: String,
    /// ID
    pub id: i32,
    /// 用户ID
    pub user_id: i32,
    /// 类型
    pub r#type: i32,
    /// 联系人姓名
    pub contact_name: String,
    /// 联系人手机号
    pub contact_mobile: String,
    /// 公司名称
    pub company_name: String,
    /// 公司数据（含 `licenseAddrProvinceName` 回填）
    pub company_data: CompanyDataVO,
    /// 状态
    pub status: i32,
    /// 审核备注
    pub audit_remark: String,
    /// 审核时间（已格式化）
    pub audit_time: String,
    /// 添加时间（已格式化）
    pub add_time: String,
    /// 用户信息（用户不存在时为 `null`）
    pub user: Option<UserVO>,
}

/// 详情 `companyData`（对应 Java `UserCompanyItemVO.CompanyDataVO`）。
///
/// ⚠️ 字段清单**逐字符**对照 Java 嵌套类，包括 `corporateName` 与
/// `companyName` 这两个 Schema 描述都写着「公司名称」的字段（真实存在的冗余）。
///
/// 所有字段都无 `skip_serializing_if` —— 与 Java `JsonUtil`
/// （Jackson `Include.ALWAYS`）保留 null 的口径一致。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CompanyDataVO {
    /// 证件正面照片
    pub front_of_photo: Option<Vec<PhotoVO>>,
    /// 证件背面照片
    pub back_of_photo: Option<Vec<PhotoVO>>,
    /// 许可证地址省份（地区 id 列表）
    pub license_addr_province: Option<Vec<i32>>,
    /// 补充信息
    pub supplementary_information: Option<Vec<PicInfo>>,
    /// 营业执照图片
    pub business_license_img: Option<Vec<PhotoVO>>,
    /// 经营期限类型
    pub operating_term_type: Option<i32>,
    /// 经营期限类型日期
    pub operating_term_type_date: Option<Vec<String>>,
    /// 经营期限类型结束日期
    pub operating_term_type_end: Option<String>,
    /// 证书有效期
    pub certificate_validity_period: Option<i32>,
    /// 证书有效期日期
    pub certificate_validity_period_date: Option<Vec<String>>,
    /// 证书有效期结束日期
    pub certificate_validity_period_end: Option<String>,
    /// 公司名称
    pub corporate_name: Option<String>,
    /// 公司名称（Java 里与 `corporateName` 冗余并存）
    pub company_name: Option<String>,
    /// 联系电话
    pub contact_phone: Option<String>,
    /// 居住地址
    pub residential_address: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 证件类型
    pub document_type: Option<i32>,
    /// 证件号码
    pub document_number: Option<String>,
    /// 地址信息（**仅详情**回填：由 `licenseAddrProvince` 查 `region` 拼接）
    pub license_addr_province_name: Option<String>,
    /// 企业经营范围（**仅详情**有）
    pub business_scope: Option<String>,
    /// 统一社会信用代码（**仅详情**有）
    pub business_license_id: Option<String>,
}

/// 列表 `companyData`（对应 Java
/// `UserCompanyCreateDTO.CompanyDataVO` —— 注意列表走的是 **Create** 的那个类）。
///
/// ⚠️ 与详情用的 `UserCompanyItemVO.CompanyDataVO` **不是同一个类**，
/// 字段清单少 3 个：`licenseAddrProvinceName` / `businessScope` /
/// `businessLicenseId`。这正是 Java「兼容之前的下划线内容」那一来一回里
/// 真正生效的白名单，因此列表与详情的 `companyData` 键集合**不同**。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CompanyDataListItemVO {
    /// 证件正面照片
    pub front_of_photo: Option<Vec<PhotoVO>>,
    /// 证件背面照片
    pub back_of_photo: Option<Vec<PhotoVO>>,
    /// 许可证地址省份（地区 id 列表）
    pub license_addr_province: Option<Vec<i32>>,
    /// 补充信息
    pub supplementary_information: Option<Vec<PicInfo>>,
    /// 营业执照图片
    pub business_license_img: Option<Vec<PhotoVO>>,
    /// 经营期限类型
    pub operating_term_type: Option<i32>,
    /// 经营期限类型日期
    pub operating_term_type_date: Option<Vec<String>>,
    /// 经营期限类型结束日期
    pub operating_term_type_end: Option<String>,
    /// 证书有效期
    pub certificate_validity_period: Option<i32>,
    /// 证书有效期日期
    pub certificate_validity_period_date: Option<Vec<String>>,
    /// 证书有效期结束日期
    pub certificate_validity_period_end: Option<String>,
    /// 公司名称
    pub corporate_name: Option<String>,
    /// 公司名称
    pub company_name: Option<String>,
    /// 联系电话
    pub contact_phone: Option<String>,
    /// 居住地址
    pub residential_address: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 证件类型
    pub document_type: Option<i32>,
    /// 证件号码
    pub document_number: Option<String>,
}

/// 图片信息（Java `UserCompanyVO.UserVO` 之外的 `PhotoVO` / `PicInfo` 结构）。
///
/// ⚠️ `PhotoVO` 与 `PicInfo` 字段不同，此处分别定义；
/// `PhotoVO` 用于 `frontOfPhoto` / `backOfPhoto` / `businessLicenseImg`，
/// `PicInfo` 用于 `supplementaryInformation`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PhotoVO {
    /// 图片名称
    pub pic_name: Option<String>,
    /// 图片缩略图
    pub pic_thumb: Option<String>,
    /// 图片URL
    pub pic_url: Option<String>,
}

/// 补充信息图片（Java `UserCompanyItemVO.PicInfo`），比 `PhotoVO` 多
/// `url` / `uid` / `status` 三个字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PicInfo {
    /// 图片缩略图
    pub pic_thumb: Option<String>,
    /// 图片URL
    pub pic_url: Option<String>,
    /// 图片名称
    pub pic_name: Option<String>,
    /// URL
    pub url: Option<String>,
    /// UID（Java `Long`）
    pub uid: Option<i64>,
    /// 状态
    pub status: Option<String>,
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `UserCompanyListDTO extends BasePage`）。
///
/// 字段来源逐条对照：
/// - `status` / `username` → `UserCompanyListDTO`
/// - `keyword` / `page` / `size` / `sortField` / `sortOrder` / `sortItems` → `BasePage`
///
/// ⚠️ 控制器 `UserCompanyController#list` 第 56–58 行有一个**默认值填充**：
/// ```text
/// if (StringUtils.isBlank(listDTO.getKeyword())) {
///     listDTO.setKeyword(listDTO.getUsername());
/// }
/// ```
/// 即 `keyword` 为空（null 或全空白）时**用 `username` 顶替**；
/// `username` 也为空时 `keyword` 即为空 ⇒ 不追加关键字条件。
/// 该填充在路由层完成（见 [`UserCompanyListQuery::apply_keyword_fallback`]）。
///
/// ⚠️ HTTP 查询参数在 Java 侧是 `size`（`BasePage`），而项目统一
/// `PageQuery` 用 `pageSize`；本结构体为**入参**，按 Java 契约用 `size`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyListQuery {
    /// 审核状态（0 或 null 都**不**过滤，见 `effective_status`）
    pub status: Option<i32>,
    /// 用户名（仅用于 `keyword` 为空时的回填）
    pub username: Option<String>,
    /// 关键字（匹配 `user.username` / `user.mobile`，或 `user_company.contact_mobile`）
    pub keyword: Option<String>,
    /// 排序字段（属性名或列名，无法识别时回退主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值：非空且非法 ⇒ 不追加 ORDER BY；空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15、上限 100（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl UserCompanyListQuery {
    /// 复刻控制器里的 `keyword` 回填：`keyword` 空白时取 `username`。
    ///
    /// Java `StringUtils.isBlank` ⇔ `null` 或全空白（Rust 侧用 `trim().is_empty()`）。
    /// **原地修改**以保持与 Java `listDTO.setKeyword(...)` 相同的可观测语义。
    pub fn apply_keyword_fallback(&mut self) {
        if self
            .keyword
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
        {
            self.keyword = self.username.clone();
        }
    }

    /// 有效关键字（去空白后为空则不过滤，对应 Java `StrUtil.isNotEmpty(keyword)`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 有效状态（Java：`status != null && status != 0` 才过滤）。
    ///
    /// ⚠️ 注意 `Some(0)` **不过滤**（Java 显式排除了 0），
    /// 与「0 = 待审核」之类的臆测无关 —— `user_company.status` 的取值域是 1/2/3。
    #[must_use]
    pub fn effective_status(&self) -> Option<i32> {
        self.status.filter(|s| *s != 0)
    }

    /// 组装内部统一分页参数。
    ///
    /// Java `BasePage.getPage()`：`null` → 1；
    /// Java `BasePage.getSize()`：`null` → 15，`> 100` → 100，
    /// **但 `size = 0` 不设下界**（会真的 `LIMIT 0`，返回空列表）。
    /// 项目统一 `PageQuery` 会 `clamp(1, 200)`，这里取 `clamp(1, 100)`
    /// 以保持 `size=0` 时也返回空列表、且不超过 Java 的 100 上限 —— 这是一处
    /// 有意的边界收敛，见返回值 `uncertain_points`。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(DEFAULT_PAGE_SIZE).min(MAX_PAGE_SIZE),
        }
    }

    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// - `sortField` 为空或等于主键**属性名** `id` → 主键列
    /// - 否则 `getColumnByPropertyName(sortField)`：属性名/列名命中则用该列，
    ///   **未命中回退主键列**（MyBatis-Plus 的安全修复行为，不是报错）
    /// - `asc`（忽略大小写）升序；`desc` 或**空**降序；
    ///   **非空且两者都不是** ⇒ 完全不追加 ORDER BY（Java 是 `if/else if`）
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY {
            KEY_COLUMN
        } else {
            map_order_column(field)
        };
        match self.sort_order.as_deref().map(str::trim) {
            Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
            None | Some("") => format!(" ORDER BY {column} DESC"),
            Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
            Some(_) => String::new(),
        }
    }
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `user_company` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "userId" | "user_id" => "user_id",
        "type" => "type",
        "contactName" | "contact_name" => "contact_name",
        "contactMobile" | "contact_mobile" => "contact_mobile",
        "companyName" | "company_name" => "company_name",
        "companyData" | "company_data" => "company_data",
        "status" => "status",
        "auditRemark" | "audit_remark" => "audit_remark",
        "auditTime" | "audit_time" => "audit_time",
        "addTime" | "add_time" => "add_time",
        // Java `getColumnByPropertyName` 找不到时返回主键列（防注入）
        _ => KEY_COLUMN,
    }
}

/// 审核请求（Java `UserCompanyAuditDTO`）。
///
/// Java 侧三个字段都**没有** `@NotNull`（只有 `@Valid`），
/// 因此校验全部落在服务层：`id` 查不到记录 ⇒ 「未知的会员企业认证信息」，
/// `status` 为 null 时 `Objects.equals(null, FAIL.getCode())` 为 false、
/// `setStatus(null)` 会写 null —— 但 `status` 列 `NOT NULL`，
/// 实际会在数据库层报错（见返回值 `uncertain_points`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCompanyAuditDTO {
    /// 审核不通过建议
    pub audit_remark: Option<String>,
    /// 会员企业认证ID
    pub id: Option<i32>,
    /// 审核状态：1 待审核 2 审核通过 3 审核未通过
    pub status: Option<i32>,
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
///
/// 控制器 `del` 方法只取 `operateDTO.getId()`。
/// Java `OperateDTO.id` 的 `@NotNull` 取决于该类定义；本域按「缺 id 报
/// `会员企业认证id不能为空`」处理（对应 `UserCompanyConstants.USER_COMPANY_ID_NOT_NULL`）。
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

// ——————————————————————————————————————————————
// 纯函数（供服务层与单测共用）
// ——————————————————————————————————————————————

/// 审核请求校验（对应 Java `UserCompanyServiceImpl#audit` 的两条 `Assert`）。
///
/// 返回 `Ok(())` 表示通过；否则返回 Java 原文案。
///
/// 校验**不含**「记录必须存在」与「状态必须为待审核」两项 ——
/// 那两项依赖库中数据，在服务层查库后判断（顺序也与 Java 一致：
/// 先查记录，再判状态，最后判备注）。
///
/// # Errors
/// - `status == 3`（不通过）且 `auditRemark` 空白 ⇒ 「请填写不通过说明」
pub fn validate_audit(dto: &UserCompanyAuditDTO) -> Result<(), String> {
    // Java: Assert.isFalse(FAIL.equals(status) && StringUtils.isEmpty(auditRemark), ...)
    // 注意 `StringUtils.isEmpty` 是 trim 后判空（`NULL_STR.equals(str.trim())`）。
    if dto.status == Some(STATUS_FAIL)
        && dto
            .audit_remark
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        return Err(MSG_AUDIT_REMARK_NOT_NULL.to_string());
    }
    Ok(())
}

/// `auditRemark` 落库值（Java `userCompany.setAuditRemark(
/// auditDTO.getAuditRemark() != null ? auditDTO.getAuditRemark() : "")`）。
///
/// ⚠️ Java 只判 `!= null`，**空白串原样写入**（不做 trim、不转空串）。
#[must_use]
pub fn audit_remark_value(remark: Option<&str>) -> String {
    remark.unwrap_or("").to_string()
}

/// 本次审核是否需要写 `audit_time`（Java：仅**通过**时写）。
#[must_use]
pub fn should_stamp_audit_time(status: Option<i32>) -> bool {
    status == Some(STATUS_PASS)
}

/// 本次审核是否需要把会员标记为企业已认证（Java：仅**通过**时写 `is_company_auth = 1`）。
#[must_use]
pub fn should_mark_user_company_auth(status: Option<i32>) -> bool {
    status == Some(STATUS_PASS)
}

/// 记录能否被审核（Java：`Objects.equals(UserCompanyAudit.PENDING.getCode(), status)`
/// ⇒ 必须等于 1）。
#[must_use]
pub fn is_auditable(current_status: i32) -> bool {
    current_status == STATUS_PENDING
}

/// `company_data` 文本 → 详情结构体（对应 Java
/// `JsonUtil.fromJson(userCompany.getCompanyData(), UserCompanyItemVO.CompanyDataVO.class)`）。
///
/// ⚠️ Java 的 Jackson 在 `companyData` 为 `null` 时会返回 `null`，
/// 紧接着 `companyDataVO.getLicenseAddrProvince()` **抛 NPE**
/// （`buildDetailVO` 第 192 行，没有任何 null 判断）。
/// 本实现返回 `Default`（全空对象）以保证详情可访问 —— 这是一处
/// **有意的健壮性偏离**，见返回值 `uncertain_points`。
#[must_use]
pub fn parse_company_data_detail(raw: Option<&str>) -> CompanyDataVO {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return CompanyDataVO::default();
    };
    serde_json::from_str(raw).unwrap_or_default()
}

/// `company_data` 文本 → 列表结构体（对应 Java 列表里
/// Hutool `toBean` + `toJsonStr` 的一来一回）。
///
/// ⚠️ 列表侧 Java 走的是 `JSONUtil.toBean(...)`（Hutool），
/// 与详情侧的 `JsonUtil.fromJson`（Jackson）**不是同一个库**，
/// 但两者对「多余键丢弃、缺失键置 null、类型不匹配抛错」的行为一致。
/// 本实现统一用 `serde_json` 解析，解析失败时返回 `Default`
/// （Java 侧会抛异常，见返回值 `uncertain_points`）。
#[must_use]
pub fn parse_company_data_list(raw: Option<&str>) -> CompanyDataListItemVO {
    let Some(raw) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return CompanyDataListItemVO::default();
    };
    serde_json::from_str(raw).unwrap_or_default()
}

/// 由 `user_company.contact_name` 等实体字段构造列表项的「无关联数据」部分。
///
/// 关联的 `user` / `statusText` / `typeText` / `companyData` 由服务层补齐。
#[must_use]
pub fn list_vo_base(entity: &UserCompany) -> UserCompanyListVO {
    UserCompanyListVO {
        id: entity.id,
        user_id: entity.user_id,
        r#type: entity.r#type,
        contact_name: entity.contact_name.clone(),
        contact_mobile: entity.contact_mobile.clone(),
        company_name: entity.company_name.clone(),
        status: entity.status,
        audit_remark: entity.audit_remark.clone(),
        ..UserCompanyListVO::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 枚举文案：与 Java 逐字符对照 —————————————————————

    #[test]
    fn audit_status_text_matches_java_enum() {
        // Java `UserCompanyAudit`：PENDING(1,"待审核") PASS(2,"审核通过") FAIL(3,"审核不通过")
        assert_eq!(resolve_status_text(1), Some("待审核"));
        assert_eq!(resolve_status_text(2), Some("审核通过"));
        assert_eq!(resolve_status_text(3), Some("审核不通过"));
        // ⚠️ 注意是「审核不通过」，不是枚举名 FAIL 的字面量
        assert_eq!(resolve_status_text(3), Some("审核不通过"));
        assert_ne!(resolve_status_text(3), Some("审核未通过"));
        assert_eq!(resolve_status_text(0), None);
        assert_eq!(resolve_status_text(4), None);
    }

    #[test]
    fn company_type_text_matches_java_enum() {
        // Java `UserCompanyType`：PERSONAL(1,"个人") COMPANY(2,"企业")
        assert_eq!(resolve_type_text(1), Some("个人"));
        assert_eq!(resolve_type_text(2), Some("企业"));
        assert_eq!(resolve_type_text(0), None);
        assert_eq!(resolve_type_text(3), None);
    }

    #[test]
    fn status_type_codes_are_the_java_ones() {
        assert_eq!((STATUS_PENDING, STATUS_PASS, STATUS_FAIL), (1, 2, 3));
        assert_eq!((TYPE_PERSONAL, TYPE_COMPANY), (1, 2));
        assert_eq!(IS_COMPANY_AUTH_YES, 1);
    }

    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_STATUS_ONLY_WAIT, "只有待审核状态可以更新");
        assert_eq!(MSG_AUDIT_REMARK_NOT_NULL, "请填写不通过说明");
        assert_eq!(MSG_USER_NOT_EXIST, "该会员不存在");
        assert_eq!(MSG_USER_COMPANY_NOT_FOUND, "企业认证信息不存在");
        // audit 路径用的文案带「未知的」前缀，与 detail 的**不同**
        assert_eq!(MSG_UNKNOWN_USER_COMPANY, "未知的会员企业认证信息");
        assert_ne!(MSG_UNKNOWN_USER_COMPANY, MSG_USER_COMPANY_NOT_FOUND);
        assert_eq!(MSG_USER_COMPANY_ID_NOT_NULL, "会员企业认证id不能为空");
    }

    // ————————————————————— 时间格式化 —————————————————————

    #[test]
    fn format_time_matches_tig_utils() {
        // Java `handelTime(null)` / `handelTime(0L)` 都返回空串
        assert_eq!(format_time(None), "");
        assert_eq!(format_time(Some(0)), "");
        // 负数在 Java 里不会被拦（只有 null 与 0），会格式化成 1970 前的日期；
        // 本实现同样不拦，仅断言非空避免依赖本地时区。
        assert!(!format_time(Some(1_700_000_000)).is_empty());
        assert_eq!(
            format_time(Some(1_700_000_000)).len(),
            "2023-11-15 06:13:20".len()
        );
    }

    // ————————————————————— audit 校验 —————————————————————

    #[test]
    fn fail_status_requires_remark() {
        // status=3 且无备注 ⇒ Java `请填写不通过说明`
        let dto = UserCompanyAuditDTO {
            id: Some(1),
            status: Some(STATUS_FAIL),
            audit_remark: None,
        };
        assert_eq!(
            validate_audit(&dto).unwrap_err(),
            MSG_AUDIT_REMARK_NOT_NULL.to_string()
        );

        // 全空白也算空（Java `StringUtils.isEmpty` 是 trim 后判空）
        let dto = UserCompanyAuditDTO {
            id: Some(1),
            status: Some(STATUS_FAIL),
            audit_remark: Some("   ".into()),
        };
        assert_eq!(
            validate_audit(&dto).unwrap_err(),
            MSG_AUDIT_REMARK_NOT_NULL.to_string()
        );

        // 有备注 ⇒ 通过
        let dto = UserCompanyAuditDTO {
            id: Some(1),
            status: Some(STATUS_FAIL),
            audit_remark: Some("资料不全".into()),
        };
        assert!(validate_audit(&dto).is_ok());

        // 通过 / 待审核**不要求**备注
        for status in [STATUS_PENDING, STATUS_PASS] {
            let dto = UserCompanyAuditDTO {
                id: Some(1),
                status: Some(status),
                audit_remark: None,
            };
            assert!(validate_audit(&dto).is_ok(), "status={status} 不该要求备注");
        }

        // status 为 null 时 Java `Objects.equals(null, 3)` = false ⇒ 不报错
        let dto = UserCompanyAuditDTO {
            id: Some(1),
            status: None,
            audit_remark: None,
        };
        assert!(validate_audit(&dto).is_ok());
    }

    #[test]
    fn audit_side_effects_only_on_pass() {
        assert!(should_stamp_audit_time(Some(STATUS_PASS)));
        assert!(should_mark_user_company_auth(Some(STATUS_PASS)));
        // 待审核 / 不通过 / null 都不写
        for s in [Some(STATUS_PENDING), Some(STATUS_FAIL), None] {
            assert!(!should_stamp_audit_time(s));
            assert!(!should_mark_user_company_auth(s));
        }
    }

    #[test]
    fn only_pending_is_auditable() {
        assert!(is_auditable(STATUS_PENDING));
        assert!(!is_auditable(STATUS_PASS));
        assert!(!is_auditable(STATUS_FAIL));
        assert!(!is_auditable(0));
    }

    #[test]
    fn audit_remark_null_becomes_empty_string() {
        // Java: `auditDTO.getAuditRemark() != null ? ... : ""`
        assert_eq!(audit_remark_value(None), "");
        // ⚠️ 空白串**原样写入**（Java 不 trim）；这是防「顺手 trim」的回归测试
        assert_eq!(audit_remark_value(Some("   ")), "   ");
        assert_eq!(audit_remark_value(Some("资料不全")), "资料不全");
    }

    // ————————————————————— list 查询语义 —————————————————————

    #[test]
    fn keyword_falls_back_to_username_only_when_blank() {
        // 控制器：keyword 空白 ⇒ 用 username 顶替
        let mut q = UserCompanyListQuery {
            keyword: None,
            username: Some("alice".into()),
            ..Default::default()
        };
        q.apply_keyword_fallback();
        assert_eq!(q.effective_keyword(), Some("alice"));

        // 全空白同样顶替（`StringUtils.isBlank`）
        let mut q = UserCompanyListQuery {
            keyword: Some("   ".into()),
            username: Some("bob".into()),
            ..Default::default()
        };
        q.apply_keyword_fallback();
        assert_eq!(q.effective_keyword(), Some("bob"));

        // keyword 非空 ⇒ **不被** username 覆盖
        let mut q = UserCompanyListQuery {
            keyword: Some("13800".into()),
            username: Some("bob".into()),
            ..Default::default()
        };
        q.apply_keyword_fallback();
        assert_eq!(q.effective_keyword(), Some("13800"));

        // 两者都空 ⇒ 不过滤
        let mut q = UserCompanyListQuery::default();
        q.apply_keyword_fallback();
        assert_eq!(q.effective_keyword(), None);
    }

    #[test]
    fn status_zero_does_not_filter() {
        // Java `.eq(status != null && status != 0, ...)`
        let q = UserCompanyListQuery {
            status: Some(0),
            ..Default::default()
        };
        assert_eq!(q.effective_status(), None);
        for s in [1, 2, 3, 99] {
            let q = UserCompanyListQuery {
                status: Some(s),
                ..Default::default()
            };
            assert_eq!(q.effective_status(), Some(s));
        }
        assert_eq!(UserCompanyListQuery::default().effective_status(), None);
    }

    #[test]
    fn page_defaults_match_base_page() {
        let q = UserCompanyListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, DEFAULT_PAGE_SIZE);
        // size 上限 100（Java `size > 100 ⇒ 100`）
        let q = UserCompanyListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        let q = UserCompanyListQuery {
            size: Some(100),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
        // page 0 / null 都取 1
        let q = UserCompanyListQuery {
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_query().page, 1);
    }

    #[test]
    fn order_clause_three_branches() {
        // 空 sortField / 空 sortOrder ⇒ 主键降序
        assert_eq!(
            UserCompanyListQuery::default().order_clause(),
            " ORDER BY id DESC"
        );
        let q = UserCompanyListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
        let q = UserCompanyListQuery {
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY（Java else-if 缺口）
        let q = UserCompanyListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
        // 属性名 → 列名
        let q = UserCompanyListQuery {
            sort_field: Some("addTime".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
        // 主键属性名 ⇒ 主键列
        let q = UserCompanyListQuery {
            sort_field: Some("id".into()),
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
        // 未识别 sortField ⇒ 回退主键（防注入）
        let q = UserCompanyListQuery {
            sort_field: Some("1; DROP TABLE user_company".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    #[test]
    fn every_order_column_is_a_real_column() {
        for f in [
            "id",
            "userId",
            "type",
            "contactName",
            "contactMobile",
            "companyName",
            "companyData",
            "status",
            "auditRemark",
            "auditTime",
            "addTime",
        ] {
            let col = map_order_column(f);
            assert!(
                USER_COMPANY_COLUMNS.contains(&col),
                "排序映射产出非真实列: {f} -> {col}"
            );
        }
    }

    // ————————————————————— companyData 解析 —————————————————————

    #[test]
    fn parse_company_data_keeps_camel_case_and_drops_unknown_keys() {
        // 包含历史下划线键：Java 一来一回会丢弃它们
        let raw = r#"{
            "corporateName":"甲公司",
            "companyName":"甲公司",
            "contactPhone":"13800000000",
            "licenseAddrProvince":[1,2],
            "company_name":"旧值",
            "license_addr_province":[9]
        }"#;
        let vo = parse_company_data_detail(Some(raw));
        assert_eq!(vo.corporate_name.as_deref(), Some("甲公司"));
        assert_eq!(vo.company_name.as_deref(), Some("甲公司"));
        assert_eq!(vo.contact_phone.as_deref(), Some("13800000000"));
        assert_eq!(vo.license_addr_province, Some(vec![1, 2]));
        // 未声明字段不会被“吸收”，解析结果里也没有旧键的位置
        let json = serde_json::to_value(&vo).unwrap();
        assert!(json.get("company_name").is_none());
        assert!(json.get("license_addr_province").is_none());
    }

    #[test]
    fn detail_and_list_company_data_have_different_key_sets() {
        // 详情多出 3 个键，列表没有 —— 这是 Java 两个不同嵌套类的差异
        let detail = serde_json::to_value(CompanyDataVO::default()).unwrap();
        let list = serde_json::to_value(CompanyDataListItemVO::default()).unwrap();
        for k in [
            "licenseAddrProvinceName",
            "businessScope",
            "businessLicenseId",
        ] {
            assert!(detail.get(k).is_some(), "详情应有 {k}");
            assert!(list.get(k).is_none(), "列表不应有 {k}");
        }
        // 共有键两边都在
        for k in [
            "corporateName",
            "companyName",
            "contactPhone",
            "licenseAddrProvince",
        ] {
            assert!(detail.get(k).is_some(), "详情缺少共有键 {k}");
            assert!(list.get(k).is_some(), "列表缺少共有键 {k}");
        }
    }

    #[test]
    fn null_fields_are_serialized_not_dropped() {
        // Java `JsonUtil`（Jackson + Include.ALWAYS）保留 null：
        // 因此 VO 里未取到的字段会以 `null` 出现在响应中，而不是消失。
        let json = serde_json::to_value(CompanyDataVO::default()).unwrap();
        assert!(json.get("corporateName").is_some());
        assert!(json["corporateName"].is_null());
        // 图片数组同理
        assert!(json.get("frontOfPhoto").is_some());
        assert!(json["frontOfPhoto"].is_null());
    }

    #[test]
    fn parse_company_data_handles_null_and_blank() {
        assert_eq!(
            parse_company_data_detail(None).corporate_name,
            CompanyDataVO::default().corporate_name
        );
        assert_eq!(
            parse_company_data_detail(Some("  ")).company_name,
            CompanyDataVO::default().company_name
        );
        assert!(parse_company_data_list(None).corporate_name.is_none());
    }

    #[test]
    fn photo_and_pic_info_shapes() {
        let raw = r#"{
            "frontOfPhoto":[{"picName":"a.png","picThumb":"t","picUrl":"u"}],
            "supplementaryInformation":[{"picThumb":"t","picUrl":"u","picName":"n","url":"x","uid":7,"status":"1"}]
        }"#;
        let vo = parse_company_data_detail(Some(raw));
        let photos = vo.front_of_photo.unwrap();
        assert_eq!(photos[0].pic_name.as_deref(), Some("a.png"));
        let pics = vo.supplementary_information.unwrap();
        assert_eq!(pics[0].uid, Some(7));
        assert_eq!(pics[0].status.as_deref(), Some("1"));
    }

    #[test]
    fn list_vo_base_copies_entity_scalars() {
        let e = UserCompany {
            id: 5,
            user_id: 9,
            r#type: TYPE_COMPANY,
            contact_name: "张三".into(),
            contact_mobile: "13800000000".into(),
            company_name: "甲公司".into(),
            company_data: Some("{}".into()),
            status: STATUS_PENDING,
            audit_remark: String::new(),
            audit_time: None,
            add_time: Some(1_700_000_000),
        };
        let vo = list_vo_base(&e);
        assert_eq!(vo.id, 5);
        assert_eq!(vo.user_id, 9);
        assert_eq!(vo.r#type, TYPE_COMPANY);
        assert_eq!(vo.contact_name, "张三");
        assert_eq!(vo.company_name, "甲公司");
        assert_eq!(vo.status, STATUS_PENDING);
        // 关联数据未填：user 为全空对象、companyData 为 None
        assert_eq!(vo.user.user_id, 0);
        assert!(vo.company_data.is_none());
        assert!(vo.status_text.is_empty());
    }

    #[test]
    fn list_query_deserializes_java_param_names() {
        let q: UserCompanyListQuery = serde_json::from_str(
            r#"{"status":2,"keyword":"alice","username":"bob","page":2,"size":30,"sortField":"addTime","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.status, Some(2));
        assert_eq!(q.keyword.as_deref(), Some("alice"));
        assert_eq!(q.username.as_deref(), Some("bob"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY add_time ASC");
    }

    #[test]
    fn audit_dto_deserializes() {
        let dto: UserCompanyAuditDTO =
            serde_json::from_str(r#"{"id":3,"status":3,"auditRemark":"资料不全"}"#).unwrap();
        assert_eq!(dto.id, Some(3));
        assert_eq!(dto.status, Some(STATUS_FAIL));
        assert_eq!(dto.audit_remark.as_deref(), Some("资料不全"));
        assert!(validate_audit(&dto).is_ok());
    }

    #[test]
    fn operate_dto_deserializes() {
        let dto: OperateDTO = serde_json::from_str(r#"{"id":8,"adminNote":"x"}"#).unwrap();
        assert_eq!(dto.id, Some(8));
        assert!(OperateDTO::default().id.is_none());
    }

    #[test]
    fn user_vo_from_entity() {
        let mut u = crate::entities::User::default();
        u.user_id = 4;
        u.username = "alice".into();
        u.mobile = "13800000000".into();
        u.is_company_auth = IS_COMPANY_AUTH_YES;
        let vo = UserVO::from_entity(&u);
        assert_eq!(vo.user_id, 4);
        assert_eq!(vo.username, "alice");
        assert_eq!(vo.mobile, "13800000000");
        assert_eq!(vo.is_company_auth, 1);
    }
}
