//! 配置域（system::config_client）DTO / VO / 常量 / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.common.ConfigController`（10 个端点）
//! - `com.tigshop.service.setting.ConfigService` /
//!   `com.tigshop.service.setting.impl.ConfigServiceImpl`
//! - `com.tigshop.helper.SettingsHelper`（配置读取 / 类型解析 / 默认值回退）
//! - `com.tigshop.bean.enums.setting.SettingsEnum`（`bizCode` 权威来源）
//! - `com.tigshop.bean.enums.common.StorageType`
//! - `com.tigshop.bean.vo.config.*`（`InitConfigSettingsVO` / `ThemeSettingsVO` /
//!   `GetLoginProtocolVO` / `GetLoginProtocolContentVO`）
//! - `com.tigshop.bean.vo.setting.config.AfterSalesSettingsVO`
//! - `com.tigshop.bean.vo.setting.AreaCodeVO`
//!
//! ## 与 Java 的映射要点
//!
//! Java 侧 `ConfigServiceImpl#getSettings(Class<T>)` 是**反射**装配：遍历 VO
//! 的每个字段，读 `@ConfigItemField(SettingsEnum.X)` 注解，用
//! `SettingsHelper#get` 取值并按 `ValueTypeEnum` 解析。Rust 无运行期反射，
//! 因此这里把「字段 → bizCode → 类型」的映射**显式写死**为常量表 +
//! 手工装配函数（见 [`assemble_init_config_settings`] 等）。
//! `bizCode` 与 `ValueTypeEnum` 逐条照抄 Java `SettingsEnum` 枚举定义。
//!
//! ## JSON 字段命名
//!
//! 全部保持 camelCase（`#[serde(rename_all = "camelCase")]`），
//! 与原接口逐字符一致。注意 `getBase` / `getInitConfigSettings` 里有若干
//! **Java 字段名与 bizCode 不同名**的项（例如 `companyDataType` 字段对应
//! `SettingsEnum.TYPE` 的 bizCode `type`），本文件按 Java VO 的**字段名**输出。
//!
//! ## 金额
//!
//! 本域（系统配置读取）**不涉及任何金额列**，因此没有
//! `rust_decimal::Decimal` 出场。

use serde::{Deserialize, Serialize};

use crate::entities::{AreaCode, Config, Decorate, UserRankConfig};

// ——————————————————————————————————————————————
// 常量：`config` 表列清单（权威 schema 核对用）
// ——————————————————————————————————————————————

/// `config` 表真实存在的 10 个列
/// （`python tools/schema_parser.py --table config`）。
pub const CONFIG_COLUMNS: [&str; 10] = [
    "id",
    "biz_code",
    "biz_val",
    "create_time",
    "create_by_id",
    "create_by_name",
    "update_time",
    "update_by_id",
    "update_by_name",
    "is_del",
];

/// 软删列名（Java `ConfigPO::getIsDel`，`eq(is_del, 0)`）。
pub const COL_IS_DEL: &str = "is_del";

/// 业务编码列名。
pub const COL_BIZ_CODE: &str = "biz_code";

/// 业务值列名。
pub const COL_BIZ_VAL: &str = "biz_val";

/// 「未删除」取值（Java `ConfigServiceImpl` 里一律硬编码 `0`）。
pub const IS_DEL_NO: i32 = 0;

/// `SettingsHelper#getRaw` 在「库中无该 bizCode 行」时的最终兜底值：
/// Java 写的是 `setting.getDefaultValue() != null ? setting.getDefaultValue() : "0"`。
pub const FALLBACK_DEFAULT_VALUE: &str = "0";

// ——————————————————————————————————————————————
// Java 常量文案（逐字符照抄）
// ——————————————————————————————————————————————

/// Java `ConfigServiceImpl#getInitConfigSettings` 中 `decorateData` 的初值
/// （无装修数据时的空串）。
pub const EMPTY_STR: &str = "";

/// Java `ConfigServiceImpl#getInitConfigSettings` 的默认头部样式。
pub const DEFAULT_HEADER_STYLE: i32 = 1;

/// Java 风格枚举 `SettingsEnum.TYPE` 的 bizCode（`getBase` 的 `companyDataType`
/// 与 `InitConfigSettingsVO.type` 都取自它）。
pub const BIZ_TYPE: &str = "type";

/// 成长值配置在 `user_rank_config` 里的固定 `code`
/// （Java `userRankConfigMapper.selectOne(eq(code, "grow_config"))`）。
pub const USER_RANK_CONFIG_GROW_CODE: &str = "grow_config";

// ——————————————————————————————————————————————
// SettingsEnum.bizCode 常量（逐条照抄 Java 枚举）
// ——————————————————————————————————————————————

/// `SettingsEnum.SHOP_LOGO.bizCode`
pub const BIZ_SHOP_LOGO: &str = "shopLogo";
/// `SettingsEnum.SHOP_NAME.bizCode`
pub const BIZ_SHOP_NAME: &str = "shopName";
/// `SettingsEnum.SHOP_TITLE.bizCode`
pub const BIZ_SHOP_TITLE: &str = "shopTitle";
/// `SettingsEnum.SHOP_TITLE_SUFFIX.bizCode`
pub const BIZ_SHOP_TITLE_SUFFIX: &str = "shopTitleSuffix";
/// `SettingsEnum.SHOP_KEYWORDS.bizCode`
pub const BIZ_SHOP_KEYWORDS: &str = "shopKeywords";
/// `SettingsEnum.SHOP_DESC.bizCode`
pub const BIZ_SHOP_DESC: &str = "shopDesc";
/// `SettingsEnum.ICO_IMG.bizCode`
pub const BIZ_ICO_IMG: &str = "icoImg";
/// `SettingsEnum.AUTO_REDIRECT.bizCode`
pub const BIZ_AUTO_REDIRECT: &str = "autoRedirect";
/// `SettingsEnum.H5_DOMAIN.bizCode`
pub const BIZ_H5_DOMAIN: &str = "h5Domain";
/// `SettingsEnum.PC_DOMAIN.bizCode`
pub const BIZ_PC_DOMAIN: &str = "pcDomain";
/// `SettingsEnum.ADMIN_DOMAIN.bizCode`
pub const BIZ_ADMIN_DOMAIN: &str = "adminDomain";
/// `SettingsEnum.SHOP_ICP_NO.bizCode`
pub const BIZ_SHOP_ICP_NO: &str = "shopIcpNo";
/// `SettingsEnum.SHOP_ICP_NO_URL.bizCode`
pub const BIZ_SHOP_ICP_NO_URL: &str = "shopIcpNoUrl";
/// `SettingsEnum.SHOP_110_NO.bizCode`
pub const BIZ_SHOP_110_NO: &str = "shop110No";
/// `SettingsEnum.SHOP_110_LINK.bizCode`
pub const BIZ_SHOP_110_LINK: &str = "shop110Link";
/// `SettingsEnum.COMPANY_ADDRESS.bizCode`
pub const BIZ_COMPANY_ADDRESS: &str = "companyAddress";
/// `SettingsEnum.IS_OPEN_MOBILE_AREA_CODE.bizCode`
pub const BIZ_IS_OPEN_MOBILE_AREA_CODE: &str = "isOpenMobileAreaCode";
/// `SettingsEnum.CLOSE_ORDER.bizCode`
pub const BIZ_CLOSE_ORDER: &str = "closeOrder";
/// `SettingsEnum.SHOP_REG_CLOSED.bizCode`
pub const BIZ_SHOP_REG_CLOSED: &str = "shopRegClosed";
/// `SettingsEnum.IS_IDENTITY.bizCode`
pub const BIZ_IS_IDENTITY: &str = "isIdentity";
/// `SettingsEnum.IS_ENQUIRY.bizCode`
pub const BIZ_IS_ENQUIRY: &str = "isEnquiry";
/// `SettingsEnum.DOLLAR_SIGN.bizCode`
pub const BIZ_DOLLAR_SIGN: &str = "dollarSign";
/// `SettingsEnum.DOLLAR_SIGN_CN.bizCode`
pub const BIZ_DOLLAR_SIGN_CN: &str = "dollarSignCn";
/// `SettingsEnum.SHOW_SELLED_COUNT.bizCode`
pub const BIZ_SHOW_SELLED_COUNT: &str = "showSelledCount";
/// `SettingsEnum.SHOW_MARKETPRICE.bizCode`
pub const BIZ_SHOW_MARKETPRICE: &str = "showMarketprice";
/// `SettingsEnum.OPEN_WECHAT_OAUTH.bizCode`
pub const BIZ_OPEN_WECHAT_OAUTH: &str = "openWechatOauth";
/// `SettingsEnum.PERSON_APPLY_ENABLED.bizCode`
pub const BIZ_PERSON_APPLY_ENABLED: &str = "personApplyEnabled";
/// `SettingsEnum.KEFU_TYPE.bizCode`
pub const BIZ_KEFU_TYPE: &str = "kefuType";
/// `SettingsEnum.KEFU_PHONE.bizCode`
pub const BIZ_KEFU_PHONE: &str = "kefuPhone";
/// `SettingsEnum.KEFU_TIME.bizCode`
pub const BIZ_KEFU_TIME: &str = "kefuTime";
/// `SettingsEnum.SHOP_COMPANY.bizCode`
pub const BIZ_SHOP_COMPANY: &str = "shopCompany";
/// `SettingsEnum.POWERED_BY_STATUS.bizCode`
pub const BIZ_POWERED_BY_STATUS: &str = "poweredByStatus";
/// `SettingsEnum.POWERED_BY.bizCode`
pub const BIZ_POWERED_BY: &str = "poweredBy";
/// `SettingsEnum.IS_ENTERPRISE.bizCode`
pub const BIZ_IS_ENTERPRISE: &str = "isEnterprise";
/// `SettingsEnum.DE_COPYRIGHT.bizCode`
pub const BIZ_DE_COPYRIGHT: &str = "deCopyright";
/// `SettingsEnum.PRODUCT_CATEGORY_DECORATE_TYPE.bizCode`
pub const BIZ_PRODUCT_CATEGORY_DECORATE_TYPE: &str = "productCategoryDecorateType";
/// `SettingsEnum.CAN_INVOICE.bizCode`
pub const BIZ_CAN_INVOICE: &str = "canInvoice";
/// `SettingsEnum.INVOICE_ADDED.bizCode`
pub const BIZ_INVOICE_ADDED: &str = "invoiceAdded";
/// `SettingsEnum.DEFAULT_SHOP_NAME.bizCode`
pub const BIZ_DEFAULT_SHOP_NAME: &str = "defaultShopName";
/// `SettingsEnum.USE_SURPLUS.bizCode`
pub const BIZ_USE_SURPLUS: &str = "useSurplus";
/// `SettingsEnum.USE_POINTS.bizCode`
pub const BIZ_USE_POINTS: &str = "usePoints";
/// `SettingsEnum.USE_COUPON.bizCode`
pub const BIZ_USE_COUPON: &str = "useCoupon";
/// `SettingsEnum.MEMBER_WITHDRAWAL_ENABLED.bizCode`
pub const BIZ_MEMBER_WITHDRAWAL_ENABLED: &str = "memberWithdrawalEnabled";
/// `SettingsEnum.COMMISSION_WITHDRAWAL_ENABLED.bizCode`
pub const BIZ_COMMISSION_WITHDRAWAL_ENABLED: &str = "commissionWithdrawalEnabled";
/// `SettingsEnum.TIPS.bizCode`
pub const BIZ_TIPS: &str = "tips";
/// `SettingsEnum.ENABLE_ATTRIBUTE_FILTER.bizCode`
pub const BIZ_ENABLE_ATTRIBUTE_FILTER: &str = "enableAttributeFilter";
/// `SettingsEnum.THEME_STYLE.bizCode`
pub const BIZ_THEME_STYLE: &str = "themeStyle";
/// `SettingsEnum.PRODUCT_DETAIL_STYLE_TYPE.bizCode`
pub const BIZ_PRODUCT_DETAIL_STYLE_TYPE: &str = "productDetailStyleType";
/// `SettingsEnum.SEARCH_STYLE_TYPE.bizCode`
pub const BIZ_SEARCH_STYLE_TYPE: &str = "searchStyleType";
/// `SettingsEnum.MOBILE_SEARCH_STYLE_TYPE.bizCode`
pub const BIZ_MOBILE_SEARCH_STYLE_TYPE: &str = "mobileSearchStyleType";
/// `SettingsEnum.TEMPLATE_CONTENT.bizCode`
pub const BIZ_TEMPLATE_CONTENT: &str = "templateContent";
/// `SettingsEnum.SHOW_TEMPLATE_CONTENT.bizCode`
pub const BIZ_SHOW_TEMPLATE_CONTENT: &str = "showTemplateContent";
/// `SettingsEnum.TERMS_OF_SERVICE_SHOW.bizCode`
pub const BIZ_TERMS_OF_SERVICE_SHOW: &str = "termsOfServiceShow";
/// `SettingsEnum.TERMS_OF_SERVICE.bizCode`
pub const BIZ_TERMS_OF_SERVICE: &str = "termsOfService";
/// `SettingsEnum.PRIVACY_POLICY_SHOW.bizCode`
pub const BIZ_PRIVACY_POLICY_SHOW: &str = "privacyPolicyShow";
/// `SettingsEnum.PRIVACY_POLICY.bizCode`
pub const BIZ_PRIVACY_POLICY: &str = "privacyPolicy";
/// `SettingsEnum.AFTER_SALES_SERVICE_SHOW.bizCode`
pub const BIZ_AFTER_SALES_SERVICE_SHOW: &str = "afterSalesServiceShow";
/// `SettingsEnum.AFTER_SALES_SERVICE.bizCode`
pub const BIZ_AFTER_SALES_SERVICE: &str = "afterSalesService";

/// `SettingsEnum.STORAGE_TYPE.bizCode`。
pub const BIZ_STORAGE_TYPE: &str = "storageType";
/// `SettingsEnum.STORAGE_LOCAL_URL.bizCode`（`StorageType.STORAGE_LOCAL`）。
pub const BIZ_STORAGE_LOCAL_URL: &str = "storageLocalUrl";
/// `SettingsEnum.STORAGE_OSS_URL.bizCode`（`StorageType.STORAGE_OSS`）。
pub const BIZ_STORAGE_OSS_URL: &str = "storageOssUrl";
/// `SettingsEnum.STORAGE_COS_URL.bizCode`（`StorageType.STORAGE_COS`）。
pub const BIZ_STORAGE_COS_URL: &str = "storageCosUrl";
/// `SettingsEnum.STORAGE_QINIU_URL.bizCode`（`StorageType.STORAGE_QINIU`）。
pub const BIZ_STORAGE_QINIU_URL: &str = "storageQiniuUrl";

/// `getBase` 中 `getConfigVal(SETTING.getCode())` 用的翻译包 code；
/// 说明见 `tigshop_services::system::config_client` 的模块注释。
pub const TRANSLATE_PACKAGE_CODE: &str = "setting";

// ——————————————————————————————————————————————
// 数值默认值（逐条照抄 Java `ConfigServiceImpl#getBase`）
// ——————————————————————————————————————————————

/// `autoRedirect` 空值兜底（Java：`StrUtil.isBlank(v) ? 1 : parseInt(v)`）。
pub const DEFAULT_AUTO_REDIRECT: i32 = 1;
/// `isOpenMobileAreaCode` 空值兜底。
pub const DEFAULT_IS_OPEN_MOBILE_AREA_CODE: i32 = 0;
/// `closeOrder` 空值兜底。
pub const DEFAULT_CLOSE_ORDER: i32 = 0;
/// `shopRegClosed` 空值兜底。
pub const DEFAULT_SHOP_REG_CLOSED: i32 = 0;
/// `isIdentity` 空值兜底。
pub const DEFAULT_IS_IDENTITY: i32 = 0;
/// `isEnquiry` 空值兜底。
pub const DEFAULT_IS_ENQUIRY: i32 = 0;
/// `dollarSign` 空值兜底（Java：`StrUtil.isBlank(v) ? "¥" : v`）。
pub const DEFAULT_DOLLAR_SIGN: &str = "¥";
/// `dollarSignCn` 空值兜底。
pub const DEFAULT_DOLLAR_SIGN_CN: &str = "元";
/// `showSelledCount` 空值兜底。
pub const DEFAULT_SHOW_SELLED_COUNT: i32 = 1;
/// `showMarketprice` 空值兜底。
pub const DEFAULT_SHOW_MARKETPRICE: i32 = 1;
/// `companyDataType` 空值兜底（Java：`StrUtil.isBlank(type) ? 2 : parseInt(type)`）。
pub const DEFAULT_COMPANY_DATA_TYPE: i32 = 2;
/// `shopIcpNoUrl` 非空时固定填写的工信部链接。
pub const ICP_LINK_URL: &str = "https://beian.miit.gov.cn";
/// `shop110Link` 非空时固定填写的公安部链接。
pub const POLICE_LINK_URL: &str = "https://beian.mps.gov.cn/#/query/webSearch";
/// `shopCompany` 在 `deCopyright` 缺失时的兜底文案
/// （Java `DEFAULT_COMPANY.getBizDesc()`）。
///
/// ⚠️ Java 的判定条件本身很可疑（`propertiesMap.containsKey("deCopyright")`
/// 恒为 true，因为上面刚 put 过），本实现按**可观测行为**复刻，
/// 详见 `uncertain_points`。
pub const DEFAULT_COMPANY_DESC: &str = "";

/// 风格类配置的「空 / 非数字」兜底值
/// （Java `getProductDetailStyleType` / `getSearchStyleType` /
/// `getMobileSearchStyleType` 三处都 `return 1`）。
pub const DEFAULT_STYLE_TYPE: i32 = 1;

/// `MobileSearchStyleSettingsVO` 的 V 侧默认（`SettingsEnum` 里 defaultValue = "1"）。
pub const MOBILE_SEARCH_STYLE_DEFAULT_RAW: &str = "1";

// ——————————————————————————————————————————————
// 存储类型（对应 Java `StorageType` 枚举）
// ——————————————————————————————————————————————

/// 存储类型（逐条照抄 Java `com.tigshop.bean.enums.common.StorageType`）。
///
/// | Java 枚举 | typeCode | 对应 URL 的 SettingsEnum |
/// |-----------|----------|--------------------------|
/// | `STORAGE_LOCAL` | `"0"` | `STORAGE_LOCAL_URL` |
/// | `STORAGE_OSS` | `"1"` | `STORAGE_OSS_URL` |
/// | `STORAGE_COS` | `"2"` | `STORAGE_COS_URL` |
/// | `STORAGE_QINIU` | `"3"` | `STORAGE_QINIU_URL` |
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageType {
    /// 本地存储（`typeCode = "0"`）。
    Local,
    /// 阿里云 OSS（`typeCode = "1"`）。
    Oss,
    /// 腾讯云 COS（`typeCode = "2"`）。
    Cos,
    /// 七牛云 Kodo（`typeCode = "3"`）。
    Qiniu,
}

impl StorageType {
    /// 按 `typeCode` 解析（对应 Java `StorageType.fromTypeCode`）。
    ///
    /// ⚠️ Java 在无法匹配时**抛异常**：
    /// `throw new GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`；
    /// 且 `getStorageUrl()` **没有** try/catch，因此
    /// `storageType` 为 null / 空串 / 非法值时，`getBase` 与
    /// `getInitConfigSettings` 都会直接 500。
    /// 本实现用 `None` 表达同一情形，由服务层决定抛出什么错误
    /// （见 `uncertain_points`）。
    ///
    /// 注意 Java 的 `fromTypeCode` 是 `code.equals(t.getCode())` 遍历，
    /// 因此只认精确的 `"0"`–`"3"` 字符串（**不做 trim**）。
    #[must_use]
    pub fn from_type_code(code: Option<&str>) -> Option<Self> {
        match code {
            Some("0") => Some(Self::Local),
            Some("1") => Some(Self::Oss),
            Some("2") => Some(Self::Cos),
            Some("3") => Some(Self::Qiniu),
            _ => None,
        }
    }

    /// 对应的 URL 配置 bizCode（Java `StorageType.getSettingsEnum().getBizCode()`）。
    #[must_use]
    pub const fn url_biz_code(self) -> &'static str {
        match self {
            Self::Local => BIZ_STORAGE_LOCAL_URL,
            Self::Oss => BIZ_STORAGE_OSS_URL,
            Self::Cos => BIZ_STORAGE_COS_URL,
            Self::Qiniu => BIZ_STORAGE_QINIU_URL,
        }
    }
}

// ——————————————————————————————————————————————
// 出处
// ——————————————————————————————————————————————

/// 出参：区号 VO（对应 Java `com.tigshop.bean.vo.setting.AreaCodeVO`）。
///
/// 与 system::area_code 的同名结构体字段完全一致；本切片自持一份副本，
/// 避免跨切片编译期耦合（与项目内其它切片的做法一致）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AreaCodeVO {
    /// 主键
    pub id: i32,
    /// 区号
    pub code: String,
    /// 名称
    pub name: String,
    /// 是否开启：1 是 0 否
    pub is_available: i32,
    /// 是否默认：1 是 0 否
    pub is_default: i32,
    /// 展示用标签 `+{code}`
    /// （Java `vo.setLabel(StrUtil.format("+{}", item.getCode()))`）
    pub label: String,
}

impl From<&AreaCode> for AreaCodeVO {
    fn from(a: &AreaCode) -> Self {
        Self {
            id: a.id,
            code: a.code.clone(),
            name: a.name.clone(),
            is_available: a.is_available,
            is_default: a.is_default,
            label: format!("+{}", a.code),
        }
    }
}

/// 出参：主题配置项（对应 Java `com.tigshop.bean.vo.config.ThemeSettingsVO`）。
///
/// Java 只有一个字段 `themeStyle`，取 `SettingsEnum.THEME_STYLE`，
/// 类型 `STRING`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ThemeSettingsVO {
    /// 主题配置（原样字符串，通常是 JSON）
    pub theme_style: Option<String>,
}

/// 出参：登录协议开关
/// （对应 Java `com.tigshop.bean.vo.config.GetLoginProtocolVO`）。
///
/// 三个字段都是 `ValueTypeEnum.INTEGER`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GetLoginProtocolVO {
    /// 服务协议展示
    pub terms_of_service_show: Option<i32>,
    /// 隐私政策展示
    pub privacy_policy_show: Option<i32>,
    /// 售后服务展示
    pub after_sales_service_show: Option<i32>,
}

/// 出参：登录协议内容
/// （对应 Java `com.tigshop.bean.vo.config.GetLoginProtocolContentVO`）。
///
/// ⚠️ Java `getLoginProtocolContentVO` 在 `code` 不属于
/// `{termsOfService, privacyPolicy, afterSalesService}` 时 **`return null`**，
/// 因此控制器直接返回 `null` 响应体。本实现用 `Option` 表达同一情形，
/// 路由层返回 JSON `null`（见 `uncertain_points`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GetLoginProtocolContentVO {
    /// 展示（`ValueTypeEnum.INTEGER`）
    pub show: Option<i32>,
    /// 协议内容（`ValueTypeEnum.STRING`）
    pub content: Option<String>,
}

/// 出参：售后设置
/// （对应 Java `com.tigshop.bean.vo.setting.config.AfterSalesSettingsVO`）。
///
/// `showTemplateContent` 在 Java 里是 `ValueTypeEnum.BOOLEAN`，
/// 与其它 VO 的 INTEGER 不同，故此处用 `Option<bool>`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AfterSalesSettingsVO {
    /// 售后服务内容（`SettingsEnum.TEMPLATE_CONTENT`，STRING）
    pub template_content: Option<String>,
    /// 是否展示售后服务（`SettingsEnum.SHOW_TEMPLATE_CONTENT`，BOOLEAN）
    pub show_template_content: Option<bool>,
}

/// 出参：初始化配置项的子结构「成长值设置」
/// （对应 Java `InitConfigSettingsVO.GrowUpSetting`）。
///
/// Java 用 `JSON.parseObject(growConfig.getData(), GrowUpSetting.class)` 反序列化
/// `user_rank_config.data`（`code = "grow_config"`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GrowUpSetting {
    /// 是否开启购买订单成长值
    pub buy_order: Option<i32>,
    /// 购买订单数量
    pub buy_order_number: Option<i32>,
    /// 每笔订单成长值
    pub buy_order_growth: Option<i32>,
    /// 是否开启评价成长值
    pub evpi: Option<i32>,
    /// 评价成长值
    pub evpi_growth: Option<i32>,
    /// 是否绑定手机号
    pub bind_phone: Option<i32>,
    /// 绑定手机号成长值
    pub bind_phone_growth: Option<i32>,
}

/// 出参：初始化配置项的子结构「装修页面配置」
/// （对应 Java `InitConfigSettingsVO.DecoratePageConfig`）。
///
/// Java 用 `JSON.parseObject(decorateData, DecoratePageConfig.class)`；
/// `decorateData` 来源是 `decorate.data` 的 `pageModule` 节点。
/// 本实现同样把 `pageModule` 原样透传（`serde_json::Value`），
/// 避免因未知字段导致反序列化失败（Java Jackson/fastjson 会忽略未知字段，
/// serde 默认也会忽略，但 `module` 是 `List<Object>` 多态结构，
/// 保持 `Value` 最忠实）。
pub type DecoratePageConfig = serde_json::Value;

/// 出参：初始化配置项
/// （对应 Java `com.tigshop.bean.vo.config.InitConfigSettingsVO`）。
///
/// ⚠️ 字段顺序严格按 Java VO 声明顺序，因为 Java 用
/// `JsonUtil`（Jackson + `INDENT_OUTPUT`）序列化，保留 null 字段。
///
/// ⚠️ 本结构体字段较多，且 Java 侧部分字段名与其 `@ConfigItemField`
/// 的 bizCode **不同名**（`companyDataType` ← `type`、
/// `type` ← `type`、`deCopyright` ← `defaultCopyright`），
/// 装配逻辑见 [`assemble_init_config_settings`]。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct InitConfigSettingsVO {
    // *** 商城信息 ***
    /// 客户下单配送方式（`storeCustomSubmitShippingType`）
    pub store_custom_submit_shipping_type: Option<i32>,
    /// 商城 Logo（`shopLogo`）
    pub shop_logo: Option<String>,
    /// lightShopLogo
    pub light_shop_logo: Option<String>,
    /// 商城名称（`shopName`）
    pub shop_name: Option<String>,
    /// Powered by 状态（`poweredByStatus`）
    pub powered_by_status: Option<i32>,
    /// Powered by 文案（`poweredBy`）
    pub powered_by: Option<i32>,
    /// Powered by 图标（`poweredByLogo`）
    pub powered_by_logo: Option<String>,
    /// 版权信息；1-系统默认，0-自定义（`shopCompany`）
    pub shop_company: Option<i32>,
    /// 默认版权（`defaultCopyright`）
    pub de_copyright: Option<String>,
    /// 版权信息自定义值（`shopCompanyTxt`）
    pub shop_company_txt: Option<String>,
    /// 积分名称（`integralName`）
    pub integral_name: Option<String>,

    // *** SEO 设置 ***
    /// 商品类目 SEO（`seoCategoryEnable`）
    pub seo_category_enable: Option<i32>,
    /// 商品 SEO（`seoProductEnable`）
    pub seo_product_enable: Option<i32>,
    /// 商城标题后缀（`shopTitleSuffix`）
    pub shop_title_suffix: Option<String>,
    /// 商城标题（`shopTitle`）
    pub shop_title: Option<String>,
    /// 商城关键词（`shopKeywords`）
    pub shop_keywords: Option<String>,
    /// 商城描述（`shopDesc`）
    pub shop_desc: Option<String>,
    /// ICO 图片（`icoImg`）
    pub ico_img: Option<String>,

    // *** 商品货币设置 ***
    /// 货币符号（`dollarSign`）
    pub dollar_sign: Option<String>,
    /// 货币符号中文（`dollarSignCn`）
    pub dollar_sign_cn: Option<String>,

    // *** 域名设置 ***
    /// 是否自动跳转（`autoRedirect`）
    pub auto_redirect: Option<i32>,
    /// H5 域名（`h5Domain`）
    pub h5_domain: Option<String>,
    /// PC 域名（`pcDomain`）
    pub pc_domain: Option<String>,
    /// 后台域名（`adminDomain`）
    pub admin_domain: Option<String>,

    // *** 微信登录 ***
    /// 是否开启微信 OAuth（`openWechatOauth`）
    pub open_wechat_oauth: Option<i32>,
    /// 是否开启小程序快捷登录（`openWechatRegister`）
    pub open_wechat_register: Option<i32>,
    /// 微信小程序分享是否需要登录（`wechatShareNeedLogin`）
    pub wechat_share_need_login: Option<i32>,
    /// 是否开启 pc 扫码登录（`openWechatPcLogin`）
    pub open_wechat_pc_login: Option<i32>,
    /// 微信注册是否绑定手机（`wechatRegisterBindPhone`）
    pub wechat_register_bind_phone: Option<i32>,
    /// 开启邮箱注册（`openEmailRegister`）
    pub open_email_register: Option<i32>,

    // *** 商户设置 ***
    /// 是否开启个人申请（`personApplyEnabled`）
    pub person_apply_enabled: Option<i32>,

    // *** 备案信息 ***
    /// ICP 备案号（`shopIcpNo`）
    pub shop_icp_no: Option<String>,
    /// ICP 备案跳转链接（`shopIcpNoUrl`）
    pub shop_icp_no_url: Option<String>,
    /// 公安备案号（`shop110No`）
    pub shop110_no: Option<String>,
    /// 公安备案跳转链接（`shop110Link`）
    pub shop110_link: Option<String>,

    // *** 经营许可证 ***
    /// 经营许可证显示开关（`businessLicenseEnabled`）
    pub business_license_enabled: Option<i32>,
    /// 增值电信业务经营许可证（ICP）证号（`businessLicense`）
    pub business_license: Option<String>,
    /// EDI 经营许可证号（`ediLicense`）
    pub edi_license: Option<String>,
    /// 经营许可证类型（`businessLicenseType`，JSON_ARRAY）
    pub business_license_type: Option<serde_json::Value>,

    // *** 买家秀设置 ***
    /// 是否开启买家秀（`buyerShowEnabled`）
    pub buyer_show_enabled: Option<i32>,
    /// 买家秀手机端展示名称（`buyerShowMobileShowName`）
    pub buyer_show_mobile_show_name: Option<String>,
    /// 买家秀评论引导文案（`buyerShowGuidanceContent`）
    pub buyer_show_guidance_content: Option<String>,
    /// 买家秀模板样式（`buyerShowTemplateStyle`）
    pub buyer_show_template_style: Option<i32>,

    // *** 客服设置 ***
    /// 客服类型（`kefuType`）
    pub kefu_type: Option<i32>,
    /// 客服电话（`kefuPhone`）
    pub kefu_phone: Option<String>,
    /// 客服时间（`kefuTime`）
    pub kefu_time: Option<String>,
    /// 企业地址（`kefuAddress`）
    pub kefu_address: Option<String>,

    // *** 授权信息 ***
    /// 是否企业版（`isEnterprise`）
    pub is_enterprise: Option<i32>,

    // *** 分页页装修设置 ***
    /// 分类装修模式（`productCategoryDecorateType`）
    pub category_decorate_type: Option<i32>,
    /// 是否使用新版个人中心页（`useNewMemberCenter`）
    pub use_new_member_center: Option<i32>,

    // *** 发票设置 ***
    /// 是否能开发票（`canInvoice`）
    pub can_invoice: Option<i32>,
    /// 是否支持增值税专用发票（`invoiceAdded`）
    pub invoice_added: Option<i32>,

    // *** 店铺设置 ***
    /// 默认店铺名（`defaultShopName`）
    pub default_shop_name: Option<String>,

    // *** 基础设置 ***
    /// 是否开启国际区号（`isOpenMobileAreaCode`）
    pub is_open_mobile_area_code: Option<i32>,

    // *** 商品信息显示设置 ***
    /// 是否显示销量（`showSelledCount`）
    pub show_selled_count: Option<i32>,
    /// 是否显示市场价（`showMarketprice`）
    pub show_marketprice: Option<i32>,
    /// 属性筛选开关（`enableAttributeFilter`）
    pub enable_attribute_filter: Option<i32>,

    // *** 商品评价设置 ***
    /// 是否开启商品评价（`productCommentEnabled`）
    pub product_comment_enabled: Option<i32>,
    /// 是否开启匿名评价（`anonymousCommentEnabled`）
    pub anonymous_comment_enabled: Option<i32>,

    // *** 基础设置（支付） ***
    /// 是否启用余额（`useSurplus`）
    pub use_surplus: Option<i32>,
    /// 是否启用积分（`usePoints`）
    pub use_points: Option<i32>,
    /// 是否启用优惠券（`useCoupon`）
    pub use_coupon: Option<i32>,
    /// 会员余额提现开关（`memberWithdrawalEnabled`）
    pub member_withdrawal_enabled: Option<i32>,
    /// 会员余额/佣金提现到账方式（`memberWithdrawalReceiptMethod`，JSON_ARRAY）
    pub member_withdrawal_receipt_method: Option<serde_json::Value>,
    /// 分销佣金提现开关（`commissionWithdrawalEnabled`）
    pub commission_withdrawal_enabled: Option<i32>,

    // *** Unknown ***
    /// 公司地址（`companyAddress`）
    pub company_address: Option<String>,
    /// 企业信息收集类型（Java 字段 `companyDataType` ← bizCode `type`）
    pub company_data_type: Option<i32>,
    /// 企业信息提示内容（`companyDataTips`）
    pub company_data_tips: Option<String>,

    // *** 商城状态 ***
    /// 关闭订单时间（`closeOrder`）
    pub close_order: Option<i32>,
    /// 是否关闭注册（`shopRegClosed`）
    pub shop_reg_closed: Option<i32>,

    // *** 会员认证 ***
    /// 是否关闭（`closeAuth`）；1-否，0-是
    pub close_auth: Option<i32>,
    /// 是否需要实名认证（`isIdentity`）
    pub is_identity: Option<i32>,
    /// 是否开启询价（`isEnquiry`）
    pub is_enquiry: Option<i32>,
    /// 是否批量采购（`bulkPurchase`）
    pub bulk_purchase: Option<i32>,
    /// 认证类型（Java 字段 `type` ← bizCode `type`）
    ///
    /// `type` 是 Rust 关键字，用 `r#type` + `#[serde(rename = "type")]`
    /// （与 order_config / area_code 的既有写法一致）。
    #[serde(rename = "type")]
    pub r#type: Option<i32>,

    // *** 第三方登录 ***
    /// 是否开启 Google 登陆（`googleLoginOn`）
    pub google_login_on: Option<i32>,
    /// 是否开启 Facebook 登陆（`facebookLoginOn`）
    pub facebook_login_on: Option<i32>,
    /// 是否开启 X/Twitter 登陆（`twitterLoginOn`）
    pub twitter_login_on: Option<i32>,

    // *** 个性化设置 ***
    /// 是否展示猜你喜欢（`isGuestLikeGoods`）
    pub is_guest_like_goods: Option<i32>,
    /// 猜你喜欢名称（`guestLikeGoodsName`）
    pub guest_like_goods_name: Option<String>,

    // *** Other ***
    /// 静态资源地址（`storageUrl`，非 `@ConfigItemField`，由 `assembleData` 填）
    pub storage_url: Option<String>,
    /// 是否展示客服（`showService`，由 `assembleData` 计算）
    pub show_service: Option<i32>,
    /// 版本类型（`versionType`，由 `assembleData` 填）
    pub version_type: Option<String>,
    /// 版本号（`version`，由 `getInitConfigSettings` 单独 set）
    pub version: Option<String>,
    /// 成长值设置（`growUpSetting`）
    pub grow_up_setting: Option<GrowUpSetting>,
    /// 装修页面配置（`decoratePageConfig`）
    pub decorate_page_config: Option<DecoratePageConfig>,
    /// 默认头部样式（`defaultHeaderStyle`）
    pub default_header_style: Option<i32>,
    /// 会员默认头像（`defaultAvatar`）
    pub default_avatar: Option<String>,
    /// 翻译版本（`translationVersion`，LONG）
    pub translation_version: Option<i64>,

    // 高德地图
    /// 高德地图 Key（`amapWebKey`）
    pub amap_web_key: Option<String>,
    /// 高德地图 SECRET（`amapWebSecret`）
    pub amap_web_secret: Option<String>,
    /// 高德地图 JS Key（`amapJsKey`）
    pub amap_js_key: Option<String>,
    /// 高德地图 JS SECRET（`amapJsSecret`）
    pub amap_js_secret: Option<String>,
    /// 高德地图小程序 Key（`amapMiniKey`）
    pub amap_mini_key: Option<String>,
    /// 高德地图小程序 SECRET（`amapMiniSecret`）
    pub amap_mini_secret: Option<String>,
    /// 地图服务商（`mapProvider`）
    pub map_provider: Option<String>,
    /// 天地图 JS API tk（`tiandituJsTk`）
    pub tianditu_js_tk: Option<String>,
    /// 搜本店（`searchSelfStore`）
    pub search_self_store: Option<i32>,
    /// 首页是否开启搜索店铺（`indexSearchShop`）
    pub index_search_shop: Option<i32>,
    /// 默认物流名称（`defaultLogisticsName`）
    pub default_logistics_name: Option<String>,
    /// 是否是新版本会员中心装修（`isNewMemberCenterDecorate`，非
    /// `@ConfigItemField`，由 `getInitConfigSettings` 用
    /// `memberCenterPage != null` 赋值；Java 是**原始 boolean**，
    /// 不属于任何配置项）
    pub is_new_member_center_decorate: bool,
}

/// 查询参数：`previewId`（`GET /api/common/config/base` 与
/// `GET /api/common/config/initConfigSettings` 共用）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PreviewIdQuery {
    /// 预览 id（Java `@RequestParam(value = "previewId", required = false) Integer`）
    pub preview_id: Option<i32>,
}

/// 查询参数：`code`（`GET /api/common/config/getLoginProtocolContent`）。
///
/// ⚠️ Java 该参数**没有** `required = false`，即必填。
/// 缺失时 `@RequestParam String code` 会抛
/// `MissingServletRequestParameterException`，由 `GlobalExceptionHandler`
/// 兜底为业务码 1001（参数校验异常）。见 `uncertain_points`。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct LoginProtocolContentQuery {
    /// 协议 code（`termsOfService` / `privacyPolicy` / `afterSalesService`）
    pub code: Option<String>,
}

// ——————————————————————————————————————————————
// 配置值解析（对应 Java `SettingsHelper#parse`）
// ——————————————————————————————————————————————

/// `SettingsEnum.ValueTypeEnum`（逐条照抄 Java 枚举成员）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValueType {
    /// `STRING` —— 原样返回（**不**做空值兜底，空串也是空串）
    String,
    /// `INTEGER` —— 空白 ⇒ `0`；非法数字 ⇒ `null`（Java catch 后 `return null`）
    Integer,
    /// `LONG` —— 空白 ⇒ `0`；非法 ⇒ `null`
    Long,
    /// `BOOLEAN` —— 空白 ⇒ `false`；否则 `Boolean.parseBoolean`
    Boolean,
    /// `DECIMAL` —— 空白 ⇒ `BigDecimal.ZERO`；非法 ⇒ `null`
    Decimal,
    /// `JSON` —— 空白 ⇒ `null`；非法 ⇒ `null`
    Json,
    /// `JSON_ARRAY` —— 空白 ⇒ `null`；非法 ⇒ `null`
    JsonArray,
    /// `JSON_OBJECT` —— 空白 ⇒ `null`；非法 ⇒ `null`
    JsonObject,
}

/// 解析后的配置值（对应 Java `SettingsHelper#parse` 的 `Object` 返回）。
///
/// Java 侧返回的是 `Object`（`String` / `Integer` / `Long` / `Boolean` /
/// `BigDecimal` / JSON 对象），由 `ReflectionUtils.setField` 直接塞进 VO 字段。
/// Rust 用本枚举表达同一组可能取值。
#[derive(Debug, Clone, PartialEq)]
pub enum ConfigValue {
    /// 字符串（`ValueType::String` 的结果；`None` 表示 Java 的 `null`）
    Text(Option<String>),
    /// 整数（`ValueType::Integer` 的结果；`None` 表示 Java 转换失败的 `null`）
    Int(Option<i32>),
    /// 长整数（`ValueType::Long`）
    Long(Option<i64>),
    /// 布尔（`ValueType::Boolean`）
    Bool(bool),
    /// 十进制金额（`ValueType::Decimal`）
    ///
    /// ⚠️ 本切片（前台配置读取）**不涉及任何 DECIMAL 配置项**，
    /// 该分支保留只为与 Java `SettingsHelper#parse` 的
    /// `ValueTypeEnum.DECIMAL` 一一对应。
    Decimal(Option<rust_decimal::Decimal>),
    /// JSON（`ValueType::Json` / `JsonArray` / `JsonObject` 的结果）
    Json(Option<serde_json::Value>),
}

impl ConfigValue {
    /// 按 [`ValueType`] 解析原始串（逐字符复刻 Java `SettingsHelper#parse`）。
    ///
    /// 关键语义（**不要凭感觉简化**）：
    /// - `STRING`：**直接返回 `valueStr`**，因此 `null` 仍然是 `null`
    ///   （`Text(None)`）；空串 `""` 也**不会**被兜底成别的值。
    /// - `INTEGER` / `LONG`：`null` 或全空白 ⇒ `0` / `0L`；
    ///   非空白但解析失败 ⇒ **`null`**（不是 0），且 Java 只 `log.error`
    ///   不抛异常。
    /// - `BOOLEAN`：空白 ⇒ `false`；否则 `Boolean.parseBoolean`
    ///   （只有 `"true"`（忽略大小写）为 `true`，其它一切为 `false`，
    ///   **且不会**走异常分支）。
    /// - `DECIMAL`：空白 ⇒ `BigDecimal.ZERO`。
    /// - JSON 三兄弟：空白 ⇒ `null`；解析失败 ⇒ `null`。
    ///
    /// ⚠️ Java 的 `blank` 判定是 `valueStr == null || valueStr.isBlank()`
    /// （`isBlank` 认 Unicode 空白），而 `STRING` 分支**不使用** `blank`。
    /// 注意 `INTEGER` 分支**不做 trim**：`" 12 "` 会 `Integer.parseInt` 失败
    /// （Java 的 `parseInt` 不 trim）⇒ `null`。本实现同样不 trim。
    #[must_use]
    pub fn parse(value_type: ValueType, raw: Option<&str>) -> Self {
        let blank = match raw {
            None => true,
            Some(s) => s.trim().is_empty(),
        };
        match value_type {
            ValueType::String => Self::Text(raw.map(str::to_owned)),
            ValueType::Integer => {
                if blank {
                    Self::Int(Some(0))
                } else {
                    // Java `Integer.parseInt(valueStr)`：不 trim、失败即 null。
                    Self::Int(raw.and_then(|s| s.parse::<i32>().ok()))
                }
            }
            ValueType::Long => {
                if blank {
                    Self::Long(Some(0))
                } else {
                    Self::Long(raw.and_then(|s| s.parse::<i64>().ok()))
                }
            }
            ValueType::Boolean => {
                if blank {
                    Self::Bool(false)
                } else {
                    // Java `Boolean.parseBoolean` 是 `"true".equalsIgnoreCase(s)`，
                    // 大小写不敏感，且**永不抛异常**。
                    Self::Bool(raw.is_some_and(|s| s.eq_ignore_ascii_case("true")))
                }
            }
            ValueType::Decimal => {
                // Java 分支：blank ? BigDecimal.ZERO : new BigDecimal(valueStr)
                // BigDecimal 失败会抛异常并被 catch 成 null。
                if blank {
                    Self::Decimal(Some(rust_decimal::Decimal::ZERO))
                } else {
                    // Java `new BigDecimal(valueStr)` 失败会抛异常并被 catch 成 null。
                    Self::Decimal(raw.and_then(|s| s.parse::<rust_decimal::Decimal>().ok()))
                }
            }
            ValueType::Json | ValueType::JsonArray | ValueType::JsonObject => {
                if blank {
                    Self::Json(None)
                } else {
                    Self::Json(raw.and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok()))
                }
            }
        }
    }
}

// ——————————————————————————————————————————————
// 装配辅助（纯逻辑，可单测）
// ——————————————————————————————————————————————

/// 取「字符串型」配置值（对应 Java `SettingsHelper#get` → `String`）。
///
/// Java `parse` 的 `STRING` 分支直接返回 `valueStr`（可能是 `null`），
/// 因此这里也返回 `Option<String>`。
#[must_use]
pub fn get_str(values: &ConfigIndex, biz_code: &str) -> Option<String> {
    match ConfigValue::parse(ValueType::String, values.raw(biz_code)) {
        ConfigValue::Text(v) => v,
        _ => None,
    }
}

/// 取「字符串型」配置值，**空值 / 全空白** 兜底为 `default`
/// （对应 Java `StrUtil.isBlank(v) ? default : v` 的手写形态，
/// 例如 `getBase` 里的 `dollarSign`）。
///
/// ⚠️ 与 [`get_str`] 的区别：Java 只有**部分**字段做了这种兜底
/// （`dollarSign` / `dollarSignCn` / 各种 int 开关），
/// 其余字符串字段（如 `shopLogo`）**原样透传**、可能为 `null`。
#[must_use]
pub fn get_str_or(values: &ConfigIndex, biz_code: &str, default: &str) -> String {
    match get_str(values, biz_code) {
        Some(v) if !v.trim().is_empty() => v,
        _ => default.to_owned(),
    }
}

/// 取「整型」配置值，空白 ⇒ `0`，非法 ⇒ `None`
/// （对应 Java `SettingsHelper#get` → `Integer`）。
#[must_use]
pub fn get_int(values: &ConfigIndex, biz_code: &str) -> Option<i32> {
    match ConfigValue::parse(ValueType::Integer, values.raw(biz_code)) {
        ConfigValue::Int(v) => v,
        _ => None,
    }
}

/// 取「布尔型」配置值（对应 Java `SettingsHelper#get` → `Boolean`）。
#[must_use]
pub fn get_bool(values: &ConfigIndex, biz_code: &str) -> bool {
    match ConfigValue::parse(ValueType::Boolean, values.raw(biz_code)) {
        ConfigValue::Bool(v) => v,
        _ => false,
    }
}

/// 取「JSON 型」配置值。
#[must_use]
pub fn get_json(values: &ConfigIndex, biz_code: &str) -> Option<serde_json::Value> {
    match ConfigValue::parse(ValueType::Json, values.raw(biz_code)) {
        ConfigValue::Json(v) => v,
        _ => None,
    }
}

/// 一次 `IN` 查询拿到的「bizCode → bizVal」快照
/// （对应 Java `SettingsHelper#getRawSnapshot` / `ConfigServiceImpl#preloadAllConfigs`）。
///
/// 语义与 Java 对齐：
/// - 行不存在 ⇒ [`Self::raw`] 返回 `None`（Java 会回落到 `defaultValue` 或
///   `"0"`，由调用方决定）；
/// - `biz_val` 为 SQL NULL ⇒ 也按 `None` 处理（Java `getConfigVal` 里
///   `config != null ? config.getBizVal() : ""` 会返回 `null`，
///   而 `getRaw` 里 `config.getBizVal()` 同样可能为 `null`；
///   本结构体统一用 `None` 表达「没有值」）。
///
/// ⚠️ Java `preloadAllConfigs` 用 `putIfAbsent`：**同一 bizCode 重复时保留
/// 首次出现的行**；`getConfigVal` 用 `.one()`（bizCode 唯一约束成立时等价）。
/// 本结构体沿用 `putIfAbsent` 语义。
#[derive(Debug, Clone, Default)]
pub struct ConfigIndex {
    /// bizCode → bizVal
    entries: std::collections::HashMap<String, Option<String>>,
}

impl ConfigIndex {
    /// 空索引。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 从 `config` 表行构建（`putIfAbsent` 语义）。
    #[must_use]
    pub fn from_rows(rows: &[Config]) -> Self {
        let mut entries = std::collections::HashMap::with_capacity(rows.len());
        for row in rows {
            entries
                .entry(row.biz_code.clone())
                .or_insert_with(|| row.biz_val.clone());
        }
        Self { entries }
    }

    /// 写入一项（对应 Java `values.putIfAbsent(...)`）。
    pub fn insert_if_absent(&mut self, biz_code: impl Into<String>, value: Option<String>) {
        self.entries.entry(biz_code.into()).or_insert(value);
    }

    /// 读取原始值（对应 Java `SettingsHelper#getRaw` 的
    /// `config != null ? config.getBizVal() : ...` 部分）。
    ///
    /// 返回 `None` 表示「库中没有该 bizCode 的行，或该行值为 NULL」。
    /// 调用方可按各自业务规则做默认值回退（Java 各处的兜底**不一致**，
    /// 因此这里**不**统一兜底）。
    #[must_use]
    pub fn raw(&self, biz_code: &str) -> Option<&str> {
        self.entries.get(biz_code).and_then(|v| v.as_deref())
    }

    /// 是否包含该 bizCode 的键（不论值是否为 null）。
    #[must_use]
    pub fn contains(&self, biz_code: &str) -> bool {
        self.entries.contains_key(biz_code)
    }

    /// 键数量。
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// 是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// `getBase` 的入参快照：`config` 全表 + 成长值配置 + PC 首页装修。
///
/// 把三个数据源打包成结构体，便于纯函数式装配与单测。
#[derive(Debug, Clone, Default)]
pub struct BaseContext {
    /// `config` 表快照（已过滤 `is_del = 0`）
    pub configs: ConfigIndex,
    /// `user_rank_config.code = "grow_config"` 的 `data` 列
    pub grow_config_data: Option<String>,
    /// `decorate` 的 `pageModule` 节点（可为 `None`）
    pub decorate_page_config: Option<serde_json::Value>,
    /// `tigshopProperties.getVersion()`
    pub version_type: Option<String>,
    /// 存储 URL（`getStorageUrl()` 的结果）
    pub storage_url: Option<String>,
}

/// 装配 `getBase` 的响应体（Map，对应 Java `Map<String, Object>` 的
/// 手工 `propertiesMap.put(...)` 序列）。
///
/// Java 用 `HashMap` + 60 余次 `put`，**字段顺序在 JSON 里不保证**
/// （fastjson/Jackson 对 `HashMap` 无序）；本实现改用
/// `serde_json::Map`（默认 BTreeMap 有序），顺序差异不影响语义。
///
/// 逐条对齐 Java 第 1476–1667 行，见各字段行内注释。
#[must_use]
pub fn assemble_base(ctx: &BaseContext) -> serde_json::Map<String, serde_json::Value> {
    use serde_json::Value;

    let cfgs = &ctx.configs;
    let mut m = serde_json::Map::new();

    // 主题：Java `JSONUtil.parseObj(getConfigVal(THEME_STYLE))` +
    // `themeStyleJsonObject.getInt("themeId")`。
    // Hutool `parseObj` 对 null / 空串返回空 JSONObject，`getInt` 返回 0；
    // 解析失败同样得到空对象 ⇒ themeId = 0。
    let theme_style_obj = get_json(cfgs, BIZ_THEME_STYLE).unwrap_or(Value::Null);
    let theme_style_obj = if theme_style_obj.is_object() {
        theme_style_obj
    } else {
        Value::Object(serde_json::Map::new())
    };
    let theme_id = theme_style_obj
        .get("themeId")
        .and_then(json_to_int)
        .unwrap_or(0);

    m.insert("themeStyle".into(), theme_style_obj);
    m.insert("themeId".into(), Value::from(theme_id));

    // 商城配置。注意 Java 对 shopName / shopTitle / shopTitleSuffix /
    // shopKeywords / shopDesc / shopIcpNo 走了
    // `translatePackage.translate(val, "setting")`（跨境翻译切面），
    // 本实现尚未迁移翻译能力，原样返回库中值（见 uncertain_points）。
    m.insert("shopName".into(), opt_str(get_str(cfgs, BIZ_SHOP_NAME)));
    m.insert("shopTitle".into(), opt_str(get_str(cfgs, BIZ_SHOP_TITLE)));
    m.insert(
        "shopTitleSuffix".into(),
        opt_str(get_str(cfgs, BIZ_SHOP_TITLE_SUFFIX)),
    );
    m.insert("shopLogo".into(), opt_str(get_str(cfgs, BIZ_SHOP_LOGO)));
    m.insert(
        "shopKeywords".into(),
        opt_str(get_str(cfgs, BIZ_SHOP_KEYWORDS)),
    );
    m.insert("shopDesc".into(), opt_str(get_str(cfgs, BIZ_SHOP_DESC)));
    m.insert("icoImg".into(), opt_str(get_str(cfgs, BIZ_ICO_IMG)));

    // `autoRedirect`：空 ⇒ 1
    m.insert(
        "autoRedirect".into(),
        Value::from(int_or(cfgs, BIZ_AUTO_REDIRECT, DEFAULT_AUTO_REDIRECT)),
    );
    m.insert("h5Domain".into(), opt_str(get_str(cfgs, BIZ_H5_DOMAIN)));
    m.insert("pcDomain".into(), opt_str(get_str(cfgs, BIZ_PC_DOMAIN)));
    m.insert(
        "adminDomain".into(),
        opt_str(get_str(cfgs, BIZ_ADMIN_DOMAIN)),
    );
    m.insert("shopIcpNo".into(), opt_str(get_str(cfgs, BIZ_SHOP_ICP_NO)));
    // `shopIcpNoUrl`：非空（非 blank）时**固定**为工信部链接，空则空串
    m.insert(
        "shopIcpNoUrl".into(),
        Value::from(blank_fallback(
            get_str(cfgs, BIZ_SHOP_ICP_NO_URL),
            ICP_LINK_URL,
        )),
    );
    m.insert("shop110No".into(), opt_str(get_str(cfgs, BIZ_SHOP_110_NO)));
    m.insert(
        "shop110Link".into(),
        Value::from(blank_fallback(
            get_str(cfgs, BIZ_SHOP_110_LINK),
            POLICE_LINK_URL,
        )),
    );
    m.insert(
        "companyAddress".into(),
        opt_str(get_str(cfgs, BIZ_COMPANY_ADDRESS)),
    );
    m.insert(
        "isOpenMobileAreaCode".into(),
        Value::from(int_or(
            cfgs,
            BIZ_IS_OPEN_MOBILE_AREA_CODE,
            DEFAULT_IS_OPEN_MOBILE_AREA_CODE,
        )),
    );
    m.insert(
        "closeOrder".into(),
        Value::from(int_or(cfgs, BIZ_CLOSE_ORDER, DEFAULT_CLOSE_ORDER)),
    );
    m.insert(
        "shopRegClosed".into(),
        Value::from(int_or(cfgs, BIZ_SHOP_REG_CLOSED, DEFAULT_SHOP_REG_CLOSED)),
    );
    m.insert(
        "isIdentity".into(),
        Value::from(int_or(cfgs, BIZ_IS_IDENTITY, DEFAULT_IS_IDENTITY)),
    );
    m.insert(
        "isEnquiry".into(),
        Value::from(int_or(cfgs, BIZ_IS_ENQUIRY, DEFAULT_IS_ENQUIRY)),
    );

    // 存储地址：Java 直接 `getStorageUrl()`（不是一个配置项）
    m.insert("storageUrl".into(), opt_str(ctx.storage_url.clone()));

    // 商品配置：货币符号空值兜底 ¥ / 元
    m.insert(
        "dollarSign".into(),
        Value::from(get_str_or(cfgs, BIZ_DOLLAR_SIGN, DEFAULT_DOLLAR_SIGN)),
    );
    m.insert(
        "dollarSignCn".into(),
        Value::from(get_str_or(cfgs, BIZ_DOLLAR_SIGN_CN, DEFAULT_DOLLAR_SIGN_CN)),
    );
    m.insert(
        "showSelledCount".into(),
        Value::from(int_or(
            cfgs,
            BIZ_SHOW_SELLED_COUNT,
            DEFAULT_SHOW_SELLED_COUNT,
        )),
    );
    m.insert(
        "showMarketprice".into(),
        Value::from(int_or(cfgs, BIZ_SHOW_MARKETPRICE, DEFAULT_SHOW_MARKETPRICE)),
    );

    // 微信配置（Java 原样透传 String，未解析成 int）
    m.insert(
        "openWechatOauth".into(),
        opt_str(get_str(cfgs, BIZ_OPEN_WECHAT_OAUTH)),
    );

    // 商户设置
    m.insert(
        "personApplyEnabled".into(),
        opt_str(get_str(cfgs, BIZ_PERSON_APPLY_ENABLED)),
    );

    // 客服设置：`show_service = kefuType > 0 ? 1 : 0`
    // ⚠️ Java 这里**没有**空值兜底：`Integer.parseInt(getConfigVal(KEFU_TYPE))`
    // 在配置缺失（返回 `""`）时会抛 NumberFormatException ⇒ 500。
    // 本实现用 `get_int` 得到 `None` 时按「解析失败」处理，
    // 由服务层决定（见 uncertain_points）；此处按 Java 的
    // 「空白 ⇒ 0 ⇒ showService = 0」结果落地。
    let kefu_type = get_int(cfgs, BIZ_KEFU_TYPE).unwrap_or(0);
    m.insert(
        "showService".into(),
        Value::from(if kefu_type > 0 { 1 } else { 0 }),
    );
    m.insert("kefuPhone".into(), opt_str(get_str(cfgs, BIZ_KEFU_PHONE)));
    m.insert("kefuTime".into(), opt_str(get_str(cfgs, BIZ_KEFU_TIME)));

    // 声明
    m.insert(
        "shopCompany".into(),
        opt_str(get_str(cfgs, BIZ_SHOP_COMPANY)),
    );
    m.insert(
        "poweredByStatus".into(),
        opt_str(get_str(cfgs, BIZ_POWERED_BY_STATUS)),
    );
    m.insert("poweredBy".into(), opt_str(get_str(cfgs, BIZ_POWERED_BY)));

    // 自动生成许可数据
    m.insert(
        "isEnterprise".into(),
        opt_str(get_str(cfgs, BIZ_IS_ENTERPRISE)),
    );
    m.insert(
        "deCopyright".into(),
        opt_str(get_str(cfgs, BIZ_DE_COPYRIGHT)),
    );

    // 基础产品类别装修。⚠️ Java：`Integer.parseInt(getConfigVal(...))`，
    // 无空值兜底（缺失即 500）。本实现取 `get_int(...).unwrap_or(0)`，
    // 差异见 uncertain_points。
    m.insert(
        "categoryDecorateType".into(),
        Value::from(get_int(cfgs, BIZ_PRODUCT_CATEGORY_DECORATE_TYPE).unwrap_or(0)),
    );

    // 购物信息 + 成长值设置
    m.insert(
        "growUpSetting".into(),
        grow_up_setting_value(ctx.grow_config_data.as_deref()),
    );
    m.insert("canInvoice".into(), opt_str(get_str(cfgs, BIZ_CAN_INVOICE)));
    m.insert(
        "invoiceAdded".into(),
        opt_str(get_str(cfgs, BIZ_INVOICE_ADDED)),
    );

    // 店铺信息
    m.insert(
        "defaultShopName".into(),
        opt_str(get_str(cfgs, BIZ_DEFAULT_SHOP_NAME)),
    );

    // 支付信息
    m.insert("useSurplus".into(), opt_str(get_str(cfgs, BIZ_USE_SURPLUS)));
    m.insert("usePoints".into(), opt_str(get_str(cfgs, BIZ_USE_POINTS)));
    m.insert("useCoupon".into(), opt_str(get_str(cfgs, BIZ_USE_COUPON)));
    m.insert(
        "memberWithdrawalEnabled".into(),
        opt_str(get_str(cfgs, BIZ_MEMBER_WITHDRAWAL_ENABLED)),
    );
    m.insert(
        "commissionWithdrawalEnabled".into(),
        opt_str(get_str(cfgs, BIZ_COMMISSION_WITHDRAWAL_ENABLED)),
    );

    // 基础 API 公司数据：`type` 空 ⇒ 2
    m.insert(
        "companyDataType".into(),
        Value::from(int_or(cfgs, BIZ_TYPE, DEFAULT_COMPANY_DATA_TYPE)),
    );
    m.insert("companyDataTips".into(), opt_str(get_str(cfgs, BIZ_TIPS)));
    m.insert("versionType".into(), opt_str(ctx.version_type.clone()));

    // ⚠️ Java 第 1662–1663 行：
    // `shopCompany = propertiesMap.containsKey("deCopyright") ? ...get("shopCompany") : DEFAULT_COMPANY.getBizDesc()`
    // `containsKey` 恒为 true（上面刚 put 过 deCopyright），所以这一行是
    // **无操作**：`shopCompany` 只是被原样读回再写回。
    // 本实现逐字符复刻该可观测行为（值不变）。
    // `DEFAULT_COMPANY.getBizDesc()` 实际不可达，故不迁移。

    // 装修页面配置
    m.insert(
        "decoratePageConfig".into(),
        ctx.decorate_page_config
            .clone()
            .unwrap_or(serde_json::Value::Null),
    );

    m.insert(
        "enableAttributeFilter".into(),
        opt_str(get_str(cfgs, BIZ_ENABLE_ATTRIBUTE_FILTER)),
    );

    m
}

/// 装配「成长值设置」节点。
///
/// Java：`JSONUtil.parse(growConfig.getData())`（`getBase`）/
/// `JSON.parseObject(data, GrowUpSetting.class)`（`getInitConfigSettings`）。
///
/// ⚠️ Java `getBase` 里 `growConfig` 为 `null`（`user_rank_config` 没有
/// `grow_config` 行）时会在 `.getData()` 上抛 **NPE** ⇒ 500。
/// 本实现返回 `null` 并交由服务层/调用方处理（见 `uncertain_points`）。
#[must_use]
pub fn grow_up_setting_value(data: Option<&str>) -> serde_json::Value {
    match data {
        Some(s) if !s.trim().is_empty() => {
            serde_json::from_str::<serde_json::Value>(s).unwrap_or(serde_json::Value::Null)
        }
        _ => serde_json::Value::Null,
    }
}

/// 从 `decorate.data` 取 `pageModule` 节点
/// （对应 Java `JSONUtil.parseObj(decorateData).get("pageModule")`
/// / `DecorateServiceImpl#getPcIndexDecoratePageConfig`）。
///
/// Java 侧若 `pageModule` 缺失，`get("pageModule")` 返回 null 再
/// `.toString()` 得到字面量 `"null"`，随后
/// `JSON.parseObject("null", DecoratePageConfig.class)` 得到 `null`。
/// 本实现返回 `None` 表达同一语义。
#[must_use]
pub fn extract_page_module(decorate_data: Option<&str>) -> Option<serde_json::Value> {
    let raw = decorate_data?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    match parsed.get("pageModule") {
        Some(serde_json::Value::Null) | None => None,
        Some(v) => Some(v.clone()),
    }
}

/// 从 `decorate.data` 取 `pageModule.headerStyle`
/// （对应 Java `getInitConfigSettings` 里的
/// `JSONUtil.parseObj(decorateData).getJSONObject("pageModule").getInt("headerStyle")`）。
///
/// ⚠️ Java 整段包在 `try { ... } catch (Exception e) { log.debug(...) }` 里，
/// **异常被吞掉**，`headerStyle` 保持初值 `1`。
/// 因此任何解析失败（包括 `pageModule` 缺失导致的 NPE）都 ⇒ `1`。
/// 本实现返回 `Option<i32>`，由调用方套 `unwrap_or(DEFAULT_HEADER_STYLE)`。
#[must_use]
pub fn extract_header_style(decorate_data: Option<&str>) -> Option<i32> {
    let module = extract_page_module(decorate_data)?;
    let v = module.get("headerStyle")?;
    json_to_int(v)
}

/// 装配 `getInitConfigSettings` 的「由 `assembleData` 填」的四个字段
/// （对应 Java `InitConfigSettingsVO#assembleData`）。
///
/// Java：
/// ```text
/// this.showService = kefuType != null ? (kefuType > 0 ? 1 : 0) : 0;
/// this.versionType = versionType;
/// this.storageUrl = storageUrl;
/// this.growUpSetting = JSON.parseObject(growConfig.getData(), GrowUpSetting.class);
/// this.decoratePageConfig = JSON.parseObject(decorateData, DecoratePageConfig.class);
/// this.defaultHeaderStyle = defaultHeaderStyle;
/// ```
///
/// ⚠️ 注意 `assembleData` 里 `showService` 的判据是
/// **`kefuType != null`**（VO 字段来自 `@ConfigItemField(INTEGER)`，
/// 配置缺失时 `parse` 返回 `0` 而非 `null`，故实际几乎总为 0/1 二选一）。
#[must_use]
pub fn assemble_init_extras(
    kefu_type: Option<i32>,
    storage_url: Option<String>,
    grow_config_data: Option<&str>,
    decorate_page_config: Option<serde_json::Value>,
    version_type: Option<String>,
    default_header_style: i32,
) -> InitConfigExtras {
    InitConfigExtras {
        show_service: Some(if kefu_type.is_some_and(|v| v > 0) {
            1
        } else {
            0
        }),
        version_type,
        storage_url,
        grow_up_setting: match grow_up_setting_value(grow_config_data) {
            serde_json::Value::Null => None,
            v => serde_json::from_value::<GrowUpSetting>(v).ok(),
        },
        decorate_page_config,
        default_header_style: Some(default_header_style),
    }
}

/// `assembleData` 装配出来的那一组字段。
#[derive(Debug, Clone, Default)]
pub struct InitConfigExtras {
    /// `showService`
    pub show_service: Option<i32>,
    /// `versionType`
    pub version_type: Option<String>,
    /// `storageUrl`
    pub storage_url: Option<String>,
    /// `growUpSetting`
    pub grow_up_setting: Option<GrowUpSetting>,
    /// `decoratePageConfig`
    pub decorate_page_config: Option<DecoratePageConfig>,
    /// `defaultHeaderStyle`
    pub default_header_style: Option<i32>,
}

/// 把 [`InitConfigExtras`] 写回 VO（对应 Java `settings.assembleData(...)`）。
pub fn apply_init_extras(vo: &mut InitConfigSettingsVO, extras: InitConfigExtras) {
    vo.show_service = extras.show_service;
    vo.version_type = extras.version_type;
    vo.storage_url = extras.storage_url;
    vo.grow_up_setting = extras.grow_up_setting;
    vo.decorate_page_config = extras.decorate_page_config;
    vo.default_header_style = extras.default_header_style;
}

// ——————————————————————————————————————————————
// 内部工具
// ——————————————————————————————————————————————

/// `Option<String>` → JSON（`None` ⇒ `null`）。
///
/// ⚠️ Java 用 `com.tigshop.common.utils.JsonUtil`（Jackson +
/// `Include.ALWAYS` + `INDENT_OUTPUT`）序列化响应，**保留** null 字段，
/// 因此这里必须显式写 `Value::Null` 而不是省略键。
#[must_use]
pub fn opt_str(v: Option<String>) -> serde_json::Value {
    match v {
        Some(s) => serde_json::Value::String(s),
        None => serde_json::Value::Null,
    }
}

/// 「空白（或缺失）⇒ default」的字符串兜底
/// （对应 Java `StrUtil.isBlank(v) ? "" : 常量链接` 的形态）。
#[must_use]
pub fn blank_fallback(v: Option<String>, non_blank: &str) -> String {
    match v {
        Some(s) if !s.trim().is_empty() => non_blank.to_owned(),
        _ => String::new(),
    }
}

/// 「空白 / 非法 ⇒ default」的整型兜底
/// （对应 Java `StrUtil.isBlank(v) ? def : Integer.parseInt(v)`，
/// 其中 `parseInt` 失败会抛异常 —— 本实现按 `def` 处理，
/// 差异见 `uncertain_points`）。
#[must_use]
pub fn int_or(cfgs: &ConfigIndex, biz_code: &str, default: i32) -> i32 {
    match cfgs.raw(biz_code) {
        Some(s) if !s.trim().is_empty() => s.parse::<i32>().unwrap_or(default),
        _ => default,
    }
}

/// JSON 值 → `i32`（对应 Hutool `JSONObject.getInt` / fastjson `getInt`：
/// 数字直接转换，数字字符串也转换，其余失败返回 `None`）。
#[must_use]
pub fn json_to_int(v: &serde_json::Value) -> Option<i32> {
    match v {
        serde_json::Value::Number(n) => n.as_i64().and_then(|i| i32::try_from(i).ok()),
        serde_json::Value::String(s) => s.trim().parse::<i32>().ok(),
        serde_json::Value::Bool(b) => Some(i32::from(*b)),
        _ => None,
    }
}

/// 风格类配置的取值（对应 Java
/// `ConfigServiceImpl#getProductDetailStyleType` /
/// `getSearchStyleType` / `getMobileSearchStyleType`）。
///
/// 三个方法体**完全同构**（只差 `SettingsEnum`），语义：
/// - `StrUtil.isBlank(val)` ⇒ `1`
/// - 否则 `Integer.parseInt(val.trim())`
/// - `NumberFormatException` ⇒ `1`
///
/// ⚠️ 注意这里 **有 `trim()`**（与 `SettingsHelper#parse` 的 `INTEGER`
/// 分支不同，后者不 trim）。
#[must_use]
pub fn style_type_from_raw(raw: Option<&str>) -> i32 {
    let Some(s) = raw else {
        return DEFAULT_STYLE_TYPE;
    };
    if s.trim().is_empty() {
        return DEFAULT_STYLE_TYPE;
    }
    s.trim().parse::<i32>().unwrap_or(DEFAULT_STYLE_TYPE)
}

/// 「协议 code」的合法取值（对应 Java `SettingsEnum.fromKey(code)`
/// 命中 `TERMS_OF_SERVICE` / `PRIVACY_POLICY` / `AFTER_SALES_SERVICE`
/// 三个分支）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProtocolKind {
    /// `termsOfService`
    TermsOfService,
    /// `privacyPolicy`
    PrivacyPolicy,
    /// `afterSalesService`
    AfterSalesService,
}

impl ProtocolKind {
    /// 按 `code` 解析；其余一切值 ⇒ `None`
    /// （对应 Java `switch` 的 `default: return null`）。
    ///
    /// ⚠️ Java `SettingsEnum.fromKey` 只按 `bizCode` 精确匹配
    /// （`SETTINGS_MAP.get(key)`，大小写敏感、不做 trim），
    /// 因此 `"TERMSOFSERVICE"` / `" termsOfService"` 都 ⇒ `None`。
    #[must_use]
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            BIZ_TERMS_OF_SERVICE => Some(Self::TermsOfService),
            BIZ_PRIVACY_POLICY => Some(Self::PrivacyPolicy),
            BIZ_AFTER_SALES_SERVICE => Some(Self::AfterSalesService),
            _ => None,
        }
    }

    /// 该协议对应的 (show bizCode, content bizCode)。
    #[must_use]
    pub const fn biz_codes(self) -> (&'static str, &'static str) {
        match self {
            Self::TermsOfService => (BIZ_TERMS_OF_SERVICE_SHOW, BIZ_TERMS_OF_SERVICE),
            Self::PrivacyPolicy => (BIZ_PRIVACY_POLICY_SHOW, BIZ_PRIVACY_POLICY),
            Self::AfterSalesService => (BIZ_AFTER_SALES_SERVICE_SHOW, BIZ_AFTER_SALES_SERVICE),
        }
    }
}

/// `config` 表行 → `ConfigIndex`（供仓储层调用）。
#[must_use]
pub fn index_from_configs(rows: &[Config]) -> ConfigIndex {
    ConfigIndex::from_rows(rows)
}

/// `decorate` 表行 → `pageModule` 节点（供仓储层调用）。
#[must_use]
pub fn page_module_of(decorate: Option<&Decorate>) -> Option<serde_json::Value> {
    extract_page_module(decorate.and_then(|d| d.data.as_deref()))
}

/// `user_rank_config` 行 → `data` 列（供仓储层调用）。
#[must_use]
pub fn grow_data_of(row: Option<&UserRankConfig>) -> Option<String> {
    row.and_then(|r| r.data.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idx(pairs: &[(&str, &str)]) -> ConfigIndex {
        let rows: Vec<Config> = pairs
            .iter()
            .map(|(k, v)| Config {
                id: 1,
                biz_code: (*k).to_owned(),
                biz_val: Some((*v).to_owned()),
                ..Config::default()
            })
            .collect();
        ConfigIndex::from_rows(&rows)
    }

    /// `ValueType::String` 原样返回：空串保持空串，缺失保持 `None`
    /// （**不**做 `StrUtil.isBlank` 兜底）。
    #[test]
    fn string_type_passes_through_blank() {
        let cfgs = idx(&[(BIZ_SHOP_LOGO, "")]);
        assert_eq!(get_str(&cfgs, BIZ_SHOP_LOGO), Some(String::new()));
        assert_eq!(get_str(&cfgs, BIZ_SHOP_NAME), None);
    }

    /// `ValueType::Integer`：空白 ⇒ `0`；非法 ⇒ `null`（**不是 0**）；
    /// 前后带空格 ⇒ 解析失败 ⇒ `null`（Java `parseInt` 不 trim）。
    #[test]
    fn integer_type_blank_zero_and_invalid_null() {
        let cfgs = idx(&[
            (BIZ_CLOSE_ORDER, ""),
            (BIZ_SHOP_REG_CLOSED, "abc"),
            (BIZ_IS_IDENTITY, " 12 "),
            (BIZ_IS_ENQUIRY, "12"),
        ]);
        assert_eq!(get_int(&cfgs, BIZ_CLOSE_ORDER), Some(0));
        assert_eq!(get_int(&cfgs, BIZ_SHOP_REG_CLOSED), None);
        assert_eq!(get_int(&cfgs, BIZ_IS_IDENTITY), None);
        assert_eq!(get_int(&cfgs, BIZ_IS_ENQUIRY), Some(12));
    }

    /// `ValueType::Boolean`：空白 ⇒ false；只有 `"true"`（忽略大小写）为 true。
    #[test]
    fn boolean_type_semantics() {
        let cfgs = idx(&[
            (BIZ_SHOW_TEMPLATE_CONTENT, "TRUE"),
            (BIZ_THEME_STYLE, "1"),
            (BIZ_SHOP_NAME, ""),
        ]);
        assert!(get_bool(&cfgs, BIZ_SHOW_TEMPLATE_CONTENT));
        // Java `Boolean.parseBoolean("1")` == false
        assert!(!get_bool(&cfgs, BIZ_THEME_STYLE));
        assert!(!get_bool(&cfgs, BIZ_SHOP_NAME));
    }

    /// `StorageType::from_type_code` 精确匹配 `"0"`–`"3"`，其余 ⇒ `None`。
    ///
    /// 对照 Java `StorageType.fromTypeCode`（`code.equals(...)` 遍历）。
    #[test]
    fn storage_type_exact_match_only() {
        assert_eq!(
            StorageType::from_type_code(Some("0")),
            Some(StorageType::Local)
        );
        assert_eq!(
            StorageType::from_type_code(Some("3")),
            Some(StorageType::Qiniu)
        );
        assert_eq!(StorageType::from_type_code(Some(" 1")), None);
        assert_eq!(StorageType::from_type_code(Some("")), None);
        assert_eq!(StorageType::from_type_code(None), None);
        // 4 / 5 在 Java 枚举里不存在
        assert_eq!(StorageType::from_type_code(Some("4")), None);
    }

    /// 存储类型 → URL bizCode 映射（照抄 `StorageType` 枚举构造参数）。
    #[test]
    fn storage_type_url_biz_code() {
        assert_eq!(StorageType::Local.url_biz_code(), "storageLocalUrl");
        assert_eq!(StorageType::Oss.url_biz_code(), "storageOssUrl");
        assert_eq!(StorageType::Cos.url_biz_code(), "storageCosUrl");
        assert_eq!(StorageType::Qiniu.url_biz_code(), "storageQiniuUrl");
    }

    /// 风格类型：空 / 缺失 / 非数字都 ⇒ 1；带空格 ⇒ trim 后成功
    /// （与 `SettingsHelper#parse` 不 trim 的行为**不同**）。
    #[test]
    fn style_type_defaults_and_trim() {
        assert_eq!(style_type_from_raw(None), 1);
        assert_eq!(style_type_from_raw(Some("")), 1);
        assert_eq!(style_type_from_raw(Some("   ")), 1);
        assert_eq!(style_type_from_raw(Some("abc")), 1);
        assert_eq!(style_type_from_raw(Some(" 2 ")), 2);
        assert_eq!(style_type_from_raw(Some("2")), 2);
    }

    /// 协议 code 精确匹配，其余 ⇒ `None`（Java `default: return null`）。
    #[test]
    fn protocol_kind_from_code() {
        assert_eq!(
            ProtocolKind::from_code("termsOfService"),
            Some(ProtocolKind::TermsOfService)
        );
        assert_eq!(
            ProtocolKind::from_code("privacyPolicy"),
            Some(ProtocolKind::PrivacyPolicy)
        );
        assert_eq!(
            ProtocolKind::from_code("afterSalesService"),
            Some(ProtocolKind::AfterSalesService)
        );
        assert_eq!(ProtocolKind::from_code("TermsOfService"), None);
        assert_eq!(ProtocolKind::from_code(" termsOfService"), None);
        assert_eq!(ProtocolKind::from_code(""), None);
        // 售后设置里的 `templateContent` 不是协议 code
        assert_eq!(ProtocolKind::from_code("templateContent"), None);
    }

    /// 协议 (show, content) bizCode 对照。
    #[test]
    fn protocol_kind_biz_codes() {
        assert_eq!(
            ProtocolKind::TermsOfService.biz_codes(),
            ("termsOfServiceShow", "termsOfService")
        );
        assert_eq!(
            ProtocolKind::PrivacyPolicy.biz_codes(),
            ("privacyPolicyShow", "privacyPolicy")
        );
        assert_eq!(
            ProtocolKind::AfterSalesService.biz_codes(),
            ("afterSalesServiceShow", "afterSalesService")
        );
    }

    /// `getBase` 的整型兜底：`autoRedirect` 空 ⇒ 1，
    /// `isOpenMobileAreaCode` / `closeOrder` / `shopRegClosed` /
    /// `isIdentity` / `isEnquiry` 空 ⇒ 0，
    /// `showSelledCount` / `showMarketprice` 空 ⇒ 1，
    /// `companyDataType`(type) 空 ⇒ 2。
    #[test]
    fn base_int_defaults_match_java() {
        let empty = ConfigIndex::new();
        assert_eq!(int_or(&empty, BIZ_AUTO_REDIRECT, DEFAULT_AUTO_REDIRECT), 1);
        assert_eq!(
            int_or(
                &empty,
                BIZ_IS_OPEN_MOBILE_AREA_CODE,
                DEFAULT_IS_OPEN_MOBILE_AREA_CODE
            ),
            0
        );
        assert_eq!(int_or(&empty, BIZ_CLOSE_ORDER, DEFAULT_CLOSE_ORDER), 0);
        assert_eq!(
            int_or(&empty, BIZ_SHOP_REG_CLOSED, DEFAULT_SHOP_REG_CLOSED),
            0
        );
        assert_eq!(int_or(&empty, BIZ_IS_IDENTITY, DEFAULT_IS_IDENTITY), 0);
        assert_eq!(int_or(&empty, BIZ_IS_ENQUIRY, DEFAULT_IS_ENQUIRY), 0);
        assert_eq!(
            int_or(&empty, BIZ_SHOW_SELLED_COUNT, DEFAULT_SHOW_SELLED_COUNT),
            1
        );
        assert_eq!(
            int_or(&empty, BIZ_SHOW_MARKETPRICE, DEFAULT_SHOW_MARKETPRICE),
            1
        );
        assert_eq!(int_or(&empty, BIZ_TYPE, DEFAULT_COMPANY_DATA_TYPE), 2);

        // 值存在时按值走，不走兜底
        let cfgs = idx(&[
            (BIZ_AUTO_REDIRECT, "0"),
            (BIZ_SHOW_SELLED_COUNT, "0"),
            (BIZ_TYPE, "1"),
        ]);
        assert_eq!(int_or(&cfgs, BIZ_AUTO_REDIRECT, DEFAULT_AUTO_REDIRECT), 0);
        assert_eq!(
            int_or(&cfgs, BIZ_SHOW_SELLED_COUNT, DEFAULT_SHOW_SELLED_COUNT),
            0
        );
        assert_eq!(int_or(&cfgs, BIZ_TYPE, DEFAULT_COMPANY_DATA_TYPE), 1);
    }

    /// 货币符号兜底：空 / 缺失 ⇒ `¥` / `元`；有值（含纯空格）⇒ 原值 / 兜底。
    #[test]
    fn dollar_sign_defaults() {
        let empty = ConfigIndex::new();
        assert_eq!(
            get_str_or(&empty, BIZ_DOLLAR_SIGN, DEFAULT_DOLLAR_SIGN),
            "¥"
        );
        assert_eq!(
            get_str_or(&empty, BIZ_DOLLAR_SIGN_CN, DEFAULT_DOLLAR_SIGN_CN),
            "元"
        );
        let cfgs = idx(&[(BIZ_DOLLAR_SIGN, "$"), (BIZ_DOLLAR_SIGN_CN, "")]);
        assert_eq!(get_str_or(&cfgs, BIZ_DOLLAR_SIGN, DEFAULT_DOLLAR_SIGN), "$");
        assert_eq!(
            get_str_or(&cfgs, BIZ_DOLLAR_SIGN_CN, DEFAULT_DOLLAR_SIGN_CN),
            "元"
        );
    }

    /// 备案链接：非空 ⇒ 固定链接；空 / 缺失 ⇒ 空串。
    #[test]
    fn beian_links() {
        assert_eq!(blank_fallback(None, ICP_LINK_URL), "");
        assert_eq!(blank_fallback(Some(String::new()), ICP_LINK_URL), "");
        assert_eq!(blank_fallback(Some("   ".into()), ICP_LINK_URL), "");
        assert_eq!(
            blank_fallback(Some("任意值".into()), ICP_LINK_URL),
            "https://beian.miit.gov.cn"
        );
        assert_eq!(
            blank_fallback(Some("x".into()), POLICE_LINK_URL),
            "https://beian.mps.gov.cn/#/query/webSearch"
        );
    }

    /// `extract_page_module`：正常取 `pageModule`；
    /// 缺失 / 非法 JSON ⇒ `None`。
    #[test]
    fn extract_page_module_semantics() {
        let data = r#"{"pageModule":{"headerStyle":2,"module":[]}}"#;
        let m = extract_page_module(Some(data)).expect("应取到 pageModule");
        assert_eq!(m.get("headerStyle").and_then(json_to_int), Some(2));

        assert!(extract_page_module(None).is_none());
        assert!(extract_page_module(Some("")).is_none());
        assert!(extract_page_module(Some("not json")).is_none());
        assert!(extract_page_module(Some(r#"{"other":1}"#)).is_none());
        assert!(extract_page_module(Some(r#"{"pageModule":null}"#)).is_none());
    }

    /// `headerStyle` 解析失败一律回落 `1`（Java try/catch 吞异常）。
    #[test]
    fn header_style_fallback() {
        let ok = r#"{"pageModule":{"headerStyle":3}}"#;
        assert_eq!(
            extract_header_style(Some(ok)).unwrap_or(DEFAULT_HEADER_STYLE),
            3
        );
        // 缺失 headerStyle
        let no_hs = r#"{"pageModule":{"module":[]}}"#;
        assert_eq!(
            extract_header_style(Some(no_hs)).unwrap_or(DEFAULT_HEADER_STYLE),
            1
        );
        // 非法 JSON
        assert_eq!(
            extract_header_style(Some("{")).unwrap_or(DEFAULT_HEADER_STYLE),
            1
        );
        // 无装修数据
        assert_eq!(
            extract_header_style(None).unwrap_or(DEFAULT_HEADER_STYLE),
            1
        );
    }

    /// `showService = kefuType > 0 ? 1 : 0`
    /// （`assembleData` 里 `kefuType != null` 才计算）。
    #[test]
    fn assemble_init_show_service() {
        let e = assemble_init_extras(Some(3), None, None, None, None, 1);
        assert_eq!(e.show_service, Some(1));
        let e = assemble_init_extras(Some(0), None, None, None, None, 1);
        assert_eq!(e.show_service, Some(0));
        // Java：kefuType == null ⇒ showService = 0
        let e = assemble_init_extras(None, None, None, None, None, 1);
        assert_eq!(e.show_service, Some(0));
    }

    /// `assembleData` 其余字段原样带入。
    #[test]
    fn assemble_init_extras_carries_fields() {
        let grow = r#"{"buyOrder":1,"buyOrderNumber":5,"buyOrderGrowth":10,"evpi":0,"evpiGrowth":0,"bindPhone":0,"bindPhoneGrowth":0}"#;
        let e = assemble_init_extras(
            Some(1),
            Some("https://cdn.example.com".into()),
            Some(grow),
            Some(serde_json::json!({"headerStyle": 2})),
            Some("b2b2b".into()),
            2,
        );
        assert_eq!(e.storage_url.as_deref(), Some("https://cdn.example.com"));
        assert_eq!(e.version_type.as_deref(), Some("b2b2b"));
        assert_eq!(e.default_header_style, Some(2));
        // 用 `as_ref()` 借用取出：`expect()` 会**移动** `grow_up_setting`，
        // 之后 `e` 就成了部分移动的值，不能再整体传给 `apply_init_extras`
        // （E0382: use of partially moved value）。
        let gs = e.grow_up_setting.as_ref().expect("成长值应解析成功");
        assert_eq!(gs.buy_order, Some(1));
        assert_eq!(gs.buy_order_number, Some(5));
        assert_eq!(gs.evpi, Some(0));

        let mut vo = InitConfigSettingsVO::default();
        apply_init_extras(&mut vo, e);
        assert_eq!(vo.show_service, Some(1));
        assert_eq!(vo.storage_url.as_deref(), Some("https://cdn.example.com"));
        assert_eq!(vo.default_header_style, Some(2));
    }

    /// `grow_config` 缺失时返回 `Value::Null`
    /// （⚠️ Java 侧此处会 NPE，见 `uncertain_points`）。
    #[test]
    fn grow_up_missing_is_null() {
        assert_eq!(grow_up_setting_value(None), serde_json::Value::Null);
        assert_eq!(grow_up_setting_value(Some("")), serde_json::Value::Null);
        assert_eq!(
            grow_up_setting_value(Some("not json")),
            serde_json::Value::Null
        );
    }

    /// `ConfigIndex` 的 `putIfAbsent` 语义：重复 bizCode 保留**首个**。
    #[test]
    fn config_index_keeps_first_duplicate() {
        let rows = vec![
            Config {
                id: 1,
                biz_code: "a".into(),
                biz_val: Some("first".into()),
                ..Config::default()
            },
            Config {
                id: 2,
                biz_code: "a".into(),
                biz_val: Some("second".into()),
                ..Config::default()
            },
        ];
        let cfgs = ConfigIndex::from_rows(&rows);
        assert_eq!(cfgs.raw("a"), Some("first"));
        assert_eq!(cfgs.len(), 1);
    }

    /// `biz_val` 为 SQL NULL 时，`raw` 返回 `None`
    /// （Java `getConfigVal` 会返回 `null`，`getRaw` 亦然）。
    #[test]
    fn config_index_null_value_is_none() {
        let rows = vec![Config {
            id: 1,
            biz_code: "a".into(),
            biz_val: None,
            ..Config::default()
        }];
        let cfgs = ConfigIndex::from_rows(&rows);
        assert_eq!(cfgs.raw("a"), None);
        assert!(cfgs.contains("a"));
        // INTEGER 类型遇到 null ⇒ 0（Java parse 的 blank 分支）
        assert_eq!(get_int(&cfgs, "a"), Some(0));
        // STRING 类型遇到 null ⇒ None
        assert_eq!(get_str(&cfgs, "a"), None);
    }

    /// `assemble_base` 的若干关键字段（对照 Java 手工 put 的结果）。
    #[test]
    fn assemble_base_key_fields() {
        let cfgs = idx(&[
            (BIZ_SHOP_NAME, "TigShop"),
            // Java：kefuType = 4 ⇒ showService = 1
            (BIZ_KEFU_TYPE, "4"),
            (BIZ_AUTO_REDIRECT, ""),
            (BIZ_DOLLAR_SIGN, ""),
            (BIZ_TYPE, ""),
            (BIZ_IS_OPEN_MOBILE_AREA_CODE, "1"),
            (BIZ_THEME_STYLE, r#"{"themeId":7}"#),
        ]);
        let ctx = BaseContext {
            configs: cfgs,
            grow_config_data: None,
            decorate_page_config: None,
            version_type: Some("b2b2b".into()),
            storage_url: Some("https://oss.example.com".into()),
        };
        let m = assemble_base(&ctx);
        assert_eq!(m.get("shopName"), Some(&serde_json::json!("TigShop")));
        assert_eq!(m.get("themeId"), Some(&serde_json::json!(7)));
        assert_eq!(m.get("showService"), Some(&serde_json::json!(1)));
        assert_eq!(m.get("autoRedirect"), Some(&serde_json::json!(1)));
        assert_eq!(m.get("dollarSign"), Some(&serde_json::json!("¥")));
        assert_eq!(m.get("companyDataType"), Some(&serde_json::json!(2)));
        assert_eq!(m.get("isOpenMobileAreaCode"), Some(&serde_json::json!(1)));
        assert_eq!(
            m.get("storageUrl"),
            Some(&serde_json::json!("https://oss.example.com"))
        );
        assert_eq!(m.get("versionType"), Some(&serde_json::json!("b2b2b")));
        // 缺失的字符串字段必须输出 null（Jackson Include.ALWAYS）
        assert_eq!(m.get("shopLogo"), Some(&serde_json::Value::Null));
        // 缺失的备案链接 ⇒ 空串（Java `StrUtil.isBlank(v) ? "" : ...`）
        assert_eq!(m.get("shopIcpNoUrl"), Some(&serde_json::json!("")));
        assert_eq!(m.get("shop110Link"), Some(&serde_json::json!("")));
    }

    /// `themeStyle` 非法 / 缺失 ⇒ 空对象且 `themeId = 0`
    /// （Hutool `parseObj` 对空值返回空 JSONObject）。
    #[test]
    fn assemble_base_theme_style_fallback() {
        let ctx = BaseContext {
            configs: idx(&[(BIZ_THEME_STYLE, "")]),
            ..BaseContext::default()
        };
        let m = assemble_base(&ctx);
        assert_eq!(m.get("themeStyle"), Some(&serde_json::json!({})));
        assert_eq!(m.get("themeId"), Some(&serde_json::json!(0)));
    }

    /// `decoratePageConfig` 缺失 ⇒ JSON `null`
    /// （Java `getPcIndexDecoratePageConfig` 返回 null）。
    #[test]
    fn assemble_base_decorate_null() {
        let ctx = BaseContext::default();
        let m = assemble_base(&ctx);
        assert_eq!(m.get("decoratePageConfig"), Some(&serde_json::Value::Null));
    }
}
