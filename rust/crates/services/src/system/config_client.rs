//! 配置域服务（system::config_client）。
//!
//! 对应原 Java `com.tigshop.service.setting.impl.ConfigServiceImpl`
//! （2256 行）+ `AreaCodeServiceImpl#mobileAreaCode` +
//! `DecorateServiceImpl#getPcIndexDecoratePageConfig`，
//! 覆盖前台 `ConfigController` 的 **10 条**端点：
//!
//! | 本域端点（挂载于 `/api`） | 原 Java | 落点 |
//! |---------------------------|---------|------|
//! | `GET  /common/config/initConfigSettings` | `ConfigController.getInitConfigSettings` | [`ConfigClientService::init_config_settings`] |
//! | `GET  /common/config/themeSettings` | `ConfigController.getThemeSettings` | [`ConfigClientService::theme_settings`] |
//! | `GET  /common/config/productDetailStyle` | `ConfigController.getProductDetailStyle` | [`ConfigClientService::product_detail_style`] |
//! | `GET  /common/config/searchStyle` | `ConfigController.getSearchStyle` | [`ConfigClientService::search_style`] |
//! | `GET  /common/config/mobileSearchStyle` | `ConfigController.getMobileSearchStyle` | [`ConfigClientService::mobile_search_style`] |
//! | `GET  /common/config/base` | `ConfigController.getBase` | [`ConfigClientService::base`] |
//! | `GET  /common/config/afterSalesService` | `ConfigController.afterSalesService` | [`ConfigClientService::after_sales_service`] |
//! | `GET  /common/config/mobileAreaCode` | `ConfigController.mobileAreaCode` | [`ConfigClientService::mobile_area_code`] |
//! | `GET  /common/config/getLoginProtocol` | `ConfigController.getLoginProtocol` | [`ConfigClientService::login_protocol`] |
//! | `GET  /common/config/getLoginProtocolContent` | `ConfigController.getLoginProtocolContentVO` | [`ConfigClientService::login_protocol_content`] |
//!
//! ## 与 Java 的行为差异（**逐条列明，未迁移的部分绝不假装已实现**）
//!
//! ### 1. 通用 VO 装配：反射 → 显式
//!
//! Java `ConfigServiceImpl#getSettings(Class<T>)` 用
//! `ReflectionUtils.doWithFields` 遍历 VO 字段上的 `@ConfigItemField`
//! 注解取值。Rust 无运行期反射，改为在
//! `tigshop_core::models::system::config_client` 里**显式装配**。
//! 这要求逐字段核对注解，⚠️ 本迁移**只覆盖前台 10 个端点实际用到**的
//! VO 字段；`InitConfigSettingsVO` 中本控制器用不到的
//! `getThemeStyleSettings()` 等管理端 VO **不在本切片范围**。
//!
//! ### 2. `SettingsHelper` 的两级取值不一致（已逐条复刻）
//!
//! Java 同时存在两条取值链路：
//! - `ConfigServiceImpl#getConfigVal(SettingsEnum)`：查询带 `.eq(isDel, 0)`，
//!   取不到返回 **空串 `""`**（不是 null）。
//! - `SettingsHelper#getRaw(SettingsEnum)`：查询**不带** `isDel` 过滤，
//!   取不到回落到 `setting.getDefaultValue()`，仍为 null 则 **`"0"`**。
//!
//! 本切片涉及的两类调用：
//! - `getBase` / `getStorageUrl` / 风格三兄弟 → 走 **`getConfigVal`**
//!   （空串兜底）
//! - `getSettings(...)` 装配的 VO（`themeSettings` /
//!   `afterSalesService` / `loginProtocol` / `initConfigSettings`）
//!   → 走 **`SettingsHelper#get`**（`defaultValue` 兜底）
//!
//! 两者的差异只在「配置缺失且 `defaultValue` 非空」时显现：
//! `MOBILE_SEARCH_STYLE_TYPE` / `SHOW_TEMPLATE_CONTENT` /
//! `ENABLE_ATTRIBUTE_FILTER` / `MEMBER_WITHDRAWAL_ENABLED` 等
//! 带默认值的项。本实现在 [`ConfigClientService::load_snapshot`] 里
//! 用 `SettingsHelper` 语义（`defaultValue` 兜底）构建快照，
//! 而 `getBase` 用 `getConfigVal` 语义（空串 ⇒ 各字段自己的兜底常量）。
//!
//! ### 3. 未迁移的依赖（**会导致行为不完整，已在 `uncertain_points` 列明**）
//!
//! - **翻译切面**：`getBase` 里 `shopName` / `shopTitle` /
//!   `shopTitleSuffix` / `shopKeywords` / `shopDesc` / `shopIcpNo`
//!   在 Java 侧过 `translatePackage.translate(val, "setting")`
//!   （跨境多语言）。本实现**原样返回库中值**。
//! - **Redis 缓存**：`SettingsHelper` 的 `configCache` 与
//!   `ConfigValCache` 均未迁移，本实现每次请求直查库。
//! - **版本号**：`tigshopProperties.getVersion()` / `getVersionNum()`
//!   来自配置文件的运行时属性，本实现从 `config` 表读不到，
//!   由路由层注入 [`ConfigClientService::with_version`]（默认 `None`
//!   ⇒ JSON `null`）。
//!
//! ### 4. `getBase` 的 `shopCompany` 死代码
//!
//! Java 第 1662–1663 行：
//! `shopCompany = propertiesMap.containsKey("deCopyright") ? ... : DEFAULT_COMPANY.getBizDesc()`
//! —— `containsKey` 恒为 true（上面刚 put 过），因此该三元表达式
//! **永远走第一支**，`DEFAULT_COMPANY.getBizDesc()` 是死代码。
//! 本实现逐字符复刻可观测行为（值被原样读回再写回）。

use std::sync::Arc;

use tigshop_core::models::system::config_client::{
    assemble_base, assemble_init_extras, apply_init_extras, extract_header_style, get_bool, get_int,
    get_str, get_string_list_with_java_default, index_from_configs, page_module_of,
    style_type_from_raw,
    AfterSalesSettingsVO,
    BaseContext, ConfigIndex, GetLoginProtocolContentVO, GetLoginProtocolVO, InitConfigSettingsVO,
    PreviewIdQuery, ProtocolKind, StorageType, ThemeSettingsVO, BIZ_AFTER_SALES_SERVICE,
    BIZ_AFTER_SALES_SERVICE_SHOW, BIZ_IS_OPEN_MOBILE_AREA_CODE, BIZ_KEFU_TYPE,
    BIZ_MOBILE_SEARCH_STYLE_TYPE, BIZ_PRODUCT_DETAIL_STYLE_TYPE, BIZ_SEARCH_STYLE_TYPE,
    BIZ_SHOP_ICP_NO, BIZ_SHOP_LOGO, BIZ_SHOP_NAME, BIZ_SHOP_KEYWORDS, BIZ_SHOP_TITLE,
    BIZ_SHOP_TITLE_SUFFIX, BIZ_SHOP_DESC, BIZ_SHOW_TEMPLATE_CONTENT, BIZ_STORAGE_TYPE,
    BIZ_TEMPLATE_CONTENT, BIZ_THEME_STYLE, BIZ_CAN_INVOICE, BIZ_INVOICE_ADDED, BIZ_USE_SURPLUS,
    BIZ_USE_POINTS, BIZ_USE_COUPON, BIZ_AUTO_REDIRECT, BIZ_H5_DOMAIN, BIZ_PC_DOMAIN,
    BIZ_ADMIN_DOMAIN, BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS,
    DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS, DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
    BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_ENABLED, BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
    DEFAULT_AUTO_REDIRECT,
    DEFAULT_HEADER_STYLE, MOBILE_SEARCH_STYLE_DEFAULT_RAW,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::repo::system::config_client::ConfigClientRepository;
use tigshop_infrastructure::db::Repositories;

/// 通用「参数校验 / 服务数据错误」业务码（原 Java
/// `GlobalExceptionHandler` 对 `MissingServletRequestParameterException`
/// 与其自有的数据错误统一走 1001）。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// `DecorateType.H5` 的 code（Java `DecorateType.H5(1, "H5")`）。
pub const DECORATE_TYPE_H5: i32 = 1;

/// `DecorateType.PC` 的 code（Java `DecorateType.PC(2, "PC")`）。
pub const DECORATE_TYPE_PC: i32 = 2;

/// `DecorateType.CUSTOM` 的 code（Java `DecorateType.CUSTOM(3, "自定义页面")`）。
pub const DECORATE_TYPE_CUSTOM: i32 = 3;

/// 「个人中心」页面用途（Java `decorate.page_type` 注释：`2个人中心`）。
pub const DECORATE_PAGE_TYPE_MEMBER_CENTER: i32 = 2;

/// 「商城首页」页面用途（Java `decorate.page_type` 注释：`1首页`）。
pub const DECORATE_PAGE_TYPE_INDEX: i32 = 1;

/// 存储类型配置的默认值：Java `StorageType.fromTypeCode` 对 null 抛
/// `GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`；
/// 本实现用此文案表达同一失败。
pub const MSG_STORAGE_TYPE_INVALID: &str = "存储类型不合法";

/// 协议 code 非法时的错误文案（Java 侧 `default: return null`，
/// 不报错；本实现保留该行为，本常量仅供调用方在需要收紧时使用）。
pub const MSG_PROTOCOL_CODE_INVALID: &str = "不支持的协议类型";

/// 配置域服务（前台，挂载于 `PublicState.config_client`）。
pub struct ConfigClientService {
    repos: Arc<Repositories>,
    /// `tigshopProperties.getVersion()`（版本类型名，如 `b2b2b`）。
    ///
    /// ⚠️ 该值来自 Java 的配置文件属性（`@ConfigurationProperties`），
    /// **不是** `config` 表的配置项，Rust 侧无法从库里读到。
    /// 默认 `None` ⇒ JSON `null`（见 `uncertain_points`）。
    version: Option<String>,
}

impl ConfigClientService {
    /// 构造（与 order_admin / area_code / logistics_company 的
    /// `new(Arc<Repositories>)` 一致）。
    #[must_use]
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self {
            repos,
            version: None,
        }
    }

    /// 注入版本类型（`main.rs` 侧读到配置后调用；
    /// 未注入时为 `None`，对应 JSON `null`）。
    #[must_use]
    pub fn with_version(mut self, version: Option<String>) -> Self {
        self.version = version;
        self
    }

    /// 只读访问本域仓储（供路由层/其它服务复用）。
    #[must_use]
    pub fn repo(&self) -> &ConfigClientRepository {
        &self.repos.system.config_client
    }

    // ————————————————————— 内部：装载快照 —————————————————————

    /// 装载全部配置快照（对应 Java `ConfigServiceImpl#preloadAllConfigs` +
    /// `SettingsHelper#getRawSnapshot` 的合并语义）。
    ///
    /// **一次** `SELECT ... WHERE is_del = 0` 取回全表，
    /// 后续所有取值都命中内存（Java 的冷启动优化目标。
    ///
    /// ⚠️ 与 Java 的差异：Java `SettingsHelper#getRaw` 的兜底顺序是
    /// `setting.getDefaultValue() ?? "0"`，而 `preloadAllConfigs`
    /// **不写默认值**（只灌库中实有行）。本实现把兜底放在各取值点
    /// （见 `_or` / `int_or` / `effective_str` 系列），
    /// 保证与 `SettingsHelper#get` 的可观测结果一致。
    async fn load_snapshot(&self) -> Result<ConfigIndex> {
        let rows = self.repos.system.config_client.find_all_configs().await?;
        Ok(index_from_configs(&rows))
    }

    // ————————————————————— 1. initConfigSettings —————————————————————

    /// 初始化配置项（对应 Java `ConfigServiceImpl#getInitConfigSettings`
    /// + `InitConfigSettingsVO#assembleData`）。
    ///
    /// 逐条对齐 Java：
    /// 1. `getSettings(InitConfigSettingsVO.class)` 反射装配 →
    ///    本实现 [`assemble_init_config_settings`]；
    /// 2. `storageUrl = getStorageUrl()`；
    /// 3. `growConfig = userRankConfigMapper.selectOne(code = "grow_config")`；
    /// 4. `previewId != null` ⇒ 按 `decorate_id` 取装修页；否则取
    ///    `shop_id = 0 AND decorate_type = PC(2) AND is_home = 1 AND status = 1`
    ///    的**首页**，并用 `pageModule.headerStyle` 覆盖
    ///    `defaultHeaderStyle`（解析异常 ⇒ 保持 `1`）；
    /// 5. `settings.setVersion(tigshopProperties.getVersionNum())`；
    /// 6. `assembleData(storageUrl, growConfig, pageModule, version, headerStyle)`；
    /// 7. `newMemberCenterDecorate =` 是否存在
    ///    `decorate_type = H5(1) AND page_type = 2 AND is_home = 1` 的页。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn init_config_settings(
        &self,
        q: &PreviewIdQuery,
    ) -> Result<InitConfigSettingsVO> {
        let configs = self.load_snapshot().await?;

        // 3. 成长值配置（⚠️ Java 此处不判空，缺失即 NPE ⇒ 500；
        //    本实现返回 None，`growUpSetting` 输出 null，见 uncertain_points）
        let grow_row = self.repos.system.config_client.find_grow_config().await?;
        let grow_data = tigshop_core::models::system::config_client::grow_data_of(grow_row.as_ref());

        // 4. 装修数据 + headerStyle
        let (decorate_page_module, header_style) = if let Some(preview_id) = q.preview_id {
            let row = self.repos.system.config_client.find_decorate_by_id(preview_id).await?;
            // previewId 分支 **不计算** headerStyle（Java 只在 else 分支里算），
            // 保持初值 1。
            (page_module_of(row.as_ref()), DEFAULT_HEADER_STYLE)
        } else {
            let row = self
                .repos.system.config_client
                .find_pc_home_decorate(DECORATE_TYPE_PC)
                .await?;
            let data = row.as_ref().and_then(|d| d.data.as_deref());
            let pm = page_module_of(row.as_ref());
            let hs = extract_header_style(data).unwrap_or(DEFAULT_HEADER_STYLE);
            (pm, hs)
        };

        // 1. 反射装配的字段
        let mut vo = assemble_init_config_settings(&configs);

        // 2. + 6. assembleData
        let storage_url = self.storage_url(&configs);
        let kefu_type = get_int(&configs, BIZ_KEFU_TYPE);
        let extras = assemble_init_extras(
            kefu_type,
            storage_url,
            grow_data.as_deref(),
            decorate_page_module,
            self.version.clone(),
            header_style,
        );
        apply_init_extras(&mut vo, extras);

        // 5. 版本号（Java `setVersion(getVersionNum())`；
        //    本实现无该运行时属性 ⇒ None ⇒ JSON null）
        vo.version = None;

        // 7. 是否存在个人中心页
        let has_member_center = self
            .repos.system.config_client
            .exists_member_center_decorate(DECORATE_TYPE_H5, DECORATE_PAGE_TYPE_MEMBER_CENTER)
            .await?;
        vo.is_new_member_center_decorate = has_member_center;

        Ok(vo)
    }

    // ————————————————————— 2. themeSettings —————————————————————

    /// 主题配置项（对应 Java `ConfigServiceImpl#getThemeSettings` →
    /// `getSettings(ThemeSettingsVO.class)`，只有 `themeStyle` 一个字段）。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn theme_settings(&self) -> Result<ThemeSettingsVO> {
        let configs = self.load_snapshot().await?;
        Ok(ThemeSettingsVO {
            theme_style: effective_str(&configs, BIZ_THEME_STYLE),
        })
    }

    // ————————————————————— 3–5. 风格三兄弟 —————————————————————

    /// 商品详情页风格（对应 Java `getProductDetailStyleType`）。
    ///
    /// 语义：`getConfigVal(PRODUCT_DETAIL_STYLE_TYPE)`（**空串兜底**），
    /// `isBlank` ⇒ `1`；否则 `parseInt(trim())`，失败 ⇒ `1`。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn product_detail_style(&self) -> Result<i32> {
        let configs = self.load_snapshot().await?;
        // ⚠️ 走 `getConfigVal`（空串兜底），**不是** `SettingsHelper#get`。
        let raw = configs.raw(BIZ_PRODUCT_DETAIL_STYLE_TYPE);
        Ok(style_type_from_raw(raw))
    }

    /// 搜索页风格（对应 Java `getSearchStyleType`）。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn search_style(&self) -> Result<i32> {
        let configs = self.load_snapshot().await?;
        let raw = configs.raw(BIZ_SEARCH_STYLE_TYPE);
        Ok(style_type_from_raw(raw))
    }

    /// 移动端搜索风格（对应 Java `getMobileSearchStyleType`）。
    ///
    /// ⚠️ 该配置项在 `SettingsEnum` 里 `defaultValue = "1"`，
    /// 但 Java 这个方法走的是 `getConfigVal`（**空串兜底**，不看
    /// `defaultValue`），因此配置缺失时同样得到 `1`
    /// —— 两条链路在此项上**恰好同值**，无法区分。
    /// 本实现按 `getConfigVal` 语义落地（照抄方法体）。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn mobile_search_style(&self) -> Result<i32> {
        let configs = self.load_snapshot().await?;
        let raw = configs.raw(BIZ_MOBILE_SEARCH_STYLE_TYPE);
        // `MOBILE_SEARCH_STYLE_DEFAULT_RAW` 仅用于交叉校验 defaultValue 与
        // 方法兜底值一致（都为 1），不参与实际计算。
        debug_assert_eq!(MOBILE_SEARCH_STYLE_DEFAULT_RAW.parse::<i32>().ok(), Some(1));
        Ok(style_type_from_raw(raw))
    }

    // ————————————————————— 6. base —————————————————————

    /// 前台基础配置（对应 Java `ConfigServiceImpl#getBase`）。
    ///
    /// 返回 JSON 对象（Java 是 `Map<String, Object>`）。
    ///
    /// ⚠️ 与 Java 的差异：
    /// - 翻译切面未迁移（6 个 `translate` 字段原样返回）；
    /// - `growUpSetting` 在 `grow_config` 行缺失时 Java 抛 NPE ⇒ 500，
    ///   本实现输出 `null`；
    /// - `kefuType` / `productCategoryDecorateType` 在 Java 里用
    ///   裸 `Integer.parseInt`（无 try/catch），配置缺失（`""`）或非数字
    ///   都会 500；本实现按 `0` 处理（见 `uncertain_points`）；
    /// - `decorateService.getPcIndexDecoratePageConfig` 的
    ///   `decorate_type = H5(1)` 看似笔误但已照抄。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn base(&self, q: &PreviewIdQuery) -> Result<serde_json::Map<String, serde_json::Value>> {
        let configs = self.load_snapshot().await?;
        let grow_row = self.repos.system.config_client.find_grow_config().await?;
        let grow_data = tigshop_core::models::system::config_client::grow_data_of(grow_row.as_ref());

        let decorates = &self.repos.system.config_client;
        let decorate_page_config = if let Some(preview_id) = q.preview_id {
            // Java `getPcIndexDecoratePageConfig(id)`：
            // `getOne(eq(decorate_id, id))` 再取 `pageModule`。
            let row = decorates.find_decorate_by_id(preview_id).await?;
            page_module_of(row.as_ref())
        } else {
            // Java 无 id 分支：`shop_id=0 AND decorate_type=H5(1) AND
            // page_type=1 AND is_home=1 AND status=1 AND locale_id=0 LIMIT 1`
            let row = decorates
                .find_pc_index_page_config(DECORATE_TYPE_H5)
                .await?;
            page_module_of(row.as_ref())
        };

        // `getStorageUrl()` 只用同一个快照即可（Java 命中同一份
        // `ConfigValCache`，行为等价）。
        let storage_url = self.storage_url(&configs);
        let ctx = BaseContext {
            configs,
            grow_config_data: grow_data,
            decorate_page_config,
            version_type: self.version.clone(),
            storage_url,
        };
        Ok(assemble_base(&ctx))
    }

    // ————————————————————— 7. afterSalesService —————————————————————

    /// 售后服务（对应 Java `getAfterSalesSettings` →
    /// `getSettings(AfterSalesSettingsVO.class)`）。
    ///
    /// 两个字段：
    /// - `templateContent`：`STRING`（空 / 缺失 ⇒ JSON `null`）；
    /// - `showTemplateContent`：`BOOLEAN`，`SettingsEnum` 里
    ///   `defaultValue = "true"`，缺失 ⇒ `true`。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn after_sales_service(&self) -> Result<AfterSalesSettingsVO> {
        let configs = self.load_snapshot().await?;
        Ok(AfterSalesSettingsVO {
            template_content: get_str(&configs, BIZ_TEMPLATE_CONTENT),
            show_template_content: Some(get_bool(&configs, BIZ_SHOW_TEMPLATE_CONTENT)),
        })
    }

    // ————————————————————— 8. mobileAreaCode —————————————————————

    /// 移动端区号（对应 Java `AreaCodeServiceImpl#mobileAreaCode`）。
    ///
    /// 条件：`is_available = 1`，`ORDER BY is_default DESC`，
    /// 且 `label = "+{code}"`。
    ///
    /// ⚠️ 与 system::area_code 的 `mobile_area_code` **语义完全相同**，
    /// 但本切片必须自持实现：system::area_code 那条链路挂在 AdminState 上，
    /// 前台不可直接复用（且跨切片耦合会引入编译依赖）。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn mobile_area_code(&self) -> Result<Vec<tigshop_core::models::system::config_client::AreaCodeVO>> {
        let rows = self.repos.system.config_client.find_available_area_codes().await?;
        Ok(rows
            .iter()
            .map(tigshop_core::models::system::config_client::AreaCodeVO::from)
            .collect())
    }

    // ————————————————————— 9. getLoginProtocol —————————————————————

    /// 登录协议开关（对应 Java `getLoginProtocol` →
    /// `getSettings(GetLoginProtocolVO.class)`）。
    ///
    /// 三个字段都是 `INTEGER`：空白 ⇒ `0`，非法 ⇒ `null`。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn login_protocol(&self) -> Result<GetLoginProtocolVO> {
        let configs = self.load_snapshot().await?;
        Ok(GetLoginProtocolVO {
            terms_of_service_show: get_int(&configs, "termsOfServiceShow"),
            privacy_policy_show: get_int(&configs, "privacyPolicyShow"),
            after_sales_service_show: get_int(&configs, BIZ_AFTER_SALES_SERVICE_SHOW),
        })
    }

    // ————————————————————— 10. getLoginProtocolContent —————————————————————

    /// 登录协议内容（对应 Java `getLoginProtocolContentVO(String code)`）。
    ///
    /// ⚠️ Java 用 `SettingsEnum.fromKey(configCode)` 精确匹配三个
    /// bizCode；**其余一切值（含 null）走 `default: return null`**，
    /// 控制器于是返回 JSON `null` 响应体。
    /// 本实现用 `Ok(None)` 表达同一语义，路由层 `ok(None)` 会
    /// 序列化成 `{"code":0,...,"data":null}`（见 `uncertain_points`）。
    ///
    /// # Errors
    /// - 仓储层失败 ⇒ `Error::Database`
    pub async fn login_protocol_content(
        &self,
        code: Option<&str>,
    ) -> Result<Option<GetLoginProtocolContentVO>> {
        let Some(kind) = code.and_then(ProtocolKind::from_code) else {
            return Ok(None);
        };
        let configs = self.load_snapshot().await?;
        let (show_code, content_code) = kind.biz_codes();
        Ok(Some(GetLoginProtocolContentVO {
            show: get_int(&configs, show_code),
            content: get_str(&configs, content_code),
        }))
    }

    // ————————————————————— 内部工具 —————————————————————

    /// 存储 URL（对应 Java `ConfigServiceImpl#getStorageUrl`）。
    ///
    /// 语义：
    /// 1. `storageTypeVal = getConfigVal(STORAGE_TYPE)`
    /// 2. `StorageType.fromTypeCode(storageTypeVal)` —— **无法匹配即抛异常**
    ///    （`GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`）；
    /// 3. 返回该类型对应的 URL 配置项（`getConfigVal`，空串兜底）。
    ///
    /// 本实现用 `Option<String>`：
    /// - 类型非法 ⇒ `None`（Java 会 500）。**有意收敛**，
    ///   避免一个坏配置把整个 `getBase` / `initConfigSettings` 打挂
    ///   （见 `uncertain_points`）。
    /// - 类型合法但 URL 未配置 ⇒ `Some("")`（与 Java `getConfigVal`
    ///   的空串兜底一致）。
    #[must_use]
    pub fn storage_url(&self, configs: &ConfigIndex) -> Option<String> {
        let raw_type = configs.raw(BIZ_STORAGE_TYPE);
        let st = StorageType::from_type_code(raw_type)?;
        Some(configs.raw(st.url_biz_code()).unwrap_or_default().to_owned())
    }

    /// 存储 URL 的「严格版」：类型非法 ⇒ `Err`（对应 Java 抛异常）。
    ///
    /// 供需要与 Java 行为**完全一致**的调用点使用。
    ///
    /// # Errors
    /// - `storageType` 缺失 / 非法 ⇒ `Error::biz(1001, 存储类型不合法)`
    pub fn storage_url_strict(&self, configs: &ConfigIndex) -> Result<String> {
        let raw_type = configs.raw(BIZ_STORAGE_TYPE);
        let st = StorageType::from_type_code(raw_type)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, MSG_STORAGE_TYPE_INVALID))?;
        Ok(configs
            .raw(st.url_biz_code())
            .unwrap_or_default()
            .to_owned())
    }

    /// 取配置原值（不做任何兜底），供路由层/调试观察使用。
    #[must_use]
    pub fn raw_value<'a>(&self, configs: &'a ConfigIndex, biz_code: &str) -> Option<&'a str> {
        configs.raw(biz_code)
    }
}

/// 取字符串型配置项，**与 Java `SettingsHelper#getRaw` 的
/// `defaultValue` 兜底等价**的简化版。
///
/// Java `get` 的 `STRING` 分支不使用 `blank`，仅当 `getRaw` 回落到
/// `defaultValue` 时才非 null。因此本函数返回
/// 「库中值，或 `defaultValue`」——本切片涉及的 STRING 项
/// `defaultValue` 全为 `null`，故与 [`get_str`] 同值。
/// 保留独立函数是为了在将来接入带默认值的 STRING 项时不丢语义。
fn effective_str(configs: &ConfigIndex, biz_code: &str) -> Option<String> {
    get_str(configs, biz_code)
}

/// 反射装配 `InitConfigSettingsVO` 的 `@ConfigItemField` 字段
/// （对应 Java `getSettings(InitConfigSettingsVO.class)`）。
///
/// ⚠️ **只装配本控制器可达的字段**：Java 的 VO 有 100+ 字段，
/// 其中相当一部分（`seoCategoryEnable` / `googleLoginOn` /
/// `amapWebKey` 等）的 `SettingsEnum` 项在 `SettingsEnum` 里存在但
/// **本片未逐一核对全部 bizCode**。为避免编造，本函数对
/// **已核对过 bizCode** 的字段赋值，其余字段保持 `None`
/// （JSON `null`），并把这些未覆盖项列进 `uncertain_points`。
///
/// 已核对（逐条对照 `SettingsEnum` 枚举定义）的字段见常量表。
#[must_use]
pub fn assemble_init_config_settings(configs: &ConfigIndex) -> InitConfigSettingsVO {
    // 已核对 bizCode 的字段（对应 Java VO 上有 @ConfigItemField 且本片确认过）
    let mut vo = InitConfigSettingsVO {
        // 商品原图批量下载：Java `InitConfigSettingsVO` 三项 @ConfigItemField，
        // 用户端 `normalizeRawImageConfig(res)` 依赖这三个字段决定是否展示入口。
        // Java `SettingsHelper#getRaw` 对缺失行回落 SettingsEnum.defaultValue；
        // 行存在但值为空时 parse(JSON_ARRAY, blank) 返回 null，不回落。
        product_raw_image_download_enabled: Some(
            get_int(configs, BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_ENABLED).unwrap_or(0),
        ),
        product_raw_image_download_channels: get_string_list_with_java_default(
            configs,
            BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS,
            &DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS,
        ),
        product_raw_image_download_scopes: get_string_list_with_java_default(
            configs,
            BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
            &DEFAULT_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
        ),
        shop_logo: get_str(configs, BIZ_SHOP_LOGO),
        shop_name: get_str(configs, BIZ_SHOP_NAME),
        shop_title_suffix: get_str(configs, BIZ_SHOP_TITLE_SUFFIX),
        shop_title: get_str(configs, BIZ_SHOP_TITLE),
        shop_keywords: get_str(configs, BIZ_SHOP_KEYWORDS),
        shop_desc: get_str(configs, BIZ_SHOP_DESC),
        is_open_mobile_area_code: get_int(configs, BIZ_IS_OPEN_MOBILE_AREA_CODE),
        ..InitConfigSettingsVO::default()
    };

    // 未在本片逐一核对的字段：保持 None（不编造）。
    // 下面这几项虽有 bizCode 依据，但 Java VO 里的注解值需要逐个复核，
    // 本片只填入**已确证**的部分（其余留空并在 uncertain_points 说明）。
    vo.shop_icp_no = get_str(configs, BIZ_SHOP_ICP_NO);
    vo.company_address = get_str(configs, "companyAddress");
    // 版权/备案/经营许可证：后台「基础设置」可配置，原 Java VO 直接反射装配。
    vo.shop_company = get_int(configs, "shopCompany");
    vo.shop_company_txt = get_str(configs, "shopCompanyTxt");
    vo.shop110_no = get_str(configs, "shop110No");
    vo.shop110_link = get_str(configs, "shop110Link");
    vo.business_license_enabled = get_int(configs, "businessLicenseEnabled");
    vo.business_license = get_str(configs, "businessLicense");
    vo.edi_license = get_str(configs, "ediLicense");
    vo.business_license_type = get_str(configs, "businessLicenseType")
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());
    vo.kefu_address = get_str(configs, "kefuAddress");
    vo.default_shop_name = get_str(configs, "defaultShopName");
    vo.kefu_phone = get_str(configs, "kefuPhone");
    vo.kefu_time = get_str(configs, "kefuTime");
    vo.kefu_type = get_int(configs, "kefuType");
    vo.dollar_sign = get_str(configs, "dollarSign");
    vo.dollar_sign_cn = get_str(configs, "dollarSignCn");
    // 个人中心“资产中心”用 integralName 拼“积分明细”；缺失时会显示成“null明细”。
    vo.integral_name = get_str(configs, "integralName");
    // 结算页开关：数据库里是 1，但之前没有装配到 VO，前端拿到 null 后
    // 会隐藏余额抵扣、发票信息，或把“已售”显示为 0。
    vo.can_invoice = get_int(configs, BIZ_CAN_INVOICE);
    vo.invoice_added = get_int(configs, BIZ_INVOICE_ADDED);
    vo.use_surplus = get_int(configs, BIZ_USE_SURPLUS);
    vo.use_points = get_int(configs, BIZ_USE_POINTS);
    vo.use_coupon = get_int(configs, BIZ_USE_COUPON);
    vo.show_selled_count = get_int(configs, "showSelledCount");
    vo.show_marketprice = get_int(configs, "showMarketprice");
    // H5 推荐组件显示条件：缺这两个字段会导致“猜你喜欢”整块被隐藏。
    vo.is_guest_like_goods = Some(get_int(configs, "isGuestLikeGoods").unwrap_or(1));
    vo.guest_like_goods_name = get_str(configs, "guestLikeGoodsName");
    // 域名与移动端自动跳转：PC 首页初始化配置依赖这几个字段决定是否跳 H5。
    vo.auto_redirect = Some(get_int(configs, BIZ_AUTO_REDIRECT).unwrap_or(DEFAULT_AUTO_REDIRECT));
    vo.h5_domain = get_str(configs, BIZ_H5_DOMAIN);
    vo.pc_domain = get_str(configs, BIZ_PC_DOMAIN);
    vo.admin_domain = get_str(configs, BIZ_ADMIN_DOMAIN);
    // ⚠️ `themeStyle` 在 `InitConfigSettingsVO` 里**没有**对应字段
    // （它只出现在 `ThemeSettingsVO` 与 `getBase` 的 Map 里），
    // 故此处不写入 VO。翻译切面（Java 的 `@JsonTranslate`）未迁移，
    // 详见模块头「未迁移的依赖」。
    vo
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::entities::Config;
    use tigshop_core::models::system::config_client::{
        BIZ_CLOSE_ORDER, BIZ_DOLLAR_SIGN, BIZ_DOLLAR_SIGN_CN, BIZ_KEFU_TYPE, BIZ_SHOW_SELLED_COUNT,
        DEFAULT_DOLLAR_SIGN, DEFAULT_DOLLAR_SIGN_CN, DEFAULT_STYLE_TYPE,
    };

    fn index(pairs: &[(&str, &str)]) -> ConfigIndex {
        let rows: Vec<Config> = pairs
            .iter()
            .map(|(k, v)| Config {
                id: 1,
                biz_code: (*k).to_owned(),
                biz_val: Some((*v).to_owned()),
                ..Config::default()
            })
            .collect();
        index_from_configs(&rows)
    }

    /// 风格三兄弟：空 / 缺失 / 非数字 ⇒ 1（对照 Java 三处 `return 1`）。
    #[test]
    fn style_types_fallback_to_one() {
        assert_eq!(style_type_from_raw(None), DEFAULT_STYLE_TYPE);
        assert_eq!(style_type_from_raw(Some("")), DEFAULT_STYLE_TYPE);
        assert_eq!(style_type_from_raw(Some("x")), DEFAULT_STYLE_TYPE);
    }

    /// 存储 URL 纯逻辑：类型解析 + bizCode 映射
    /// （不构造服务实例，避免依赖数据库连接池）。
    ///
    /// 对照 Java `StorageType.fromTypeCode` + `getConfigVal(storageEnum)`。
    #[test]
    fn storage_url_semantics() {
        // 类型缺失 / 非法 ⇒ 无法解析（Java 抛异常）
        let empty = ConfigIndex::new();
        assert_eq!(StorageType::from_type_code(empty.raw(BIZ_STORAGE_TYPE)), None);

        let bad = index(&[(BIZ_STORAGE_TYPE, "9")]);
        assert_eq!(StorageType::from_type_code(bad.raw(BIZ_STORAGE_TYPE)), None);

        // 合法类型 1 ⇒ storageOssUrl
        let oss = index(&[
            (BIZ_STORAGE_TYPE, "1"),
            ("storageOssUrl", "https://oss.x.com"),
        ]);
        let st = StorageType::from_type_code(oss.raw(BIZ_STORAGE_TYPE)).expect("类型 1 合法");
        assert_eq!(st, StorageType::Oss);
        assert_eq!(oss.raw(st.url_biz_code()), Some("https://oss.x.com"));

        // 合法类型 0 但 URL 未配置 ⇒ 取不到值 ⇒ 空串（Java 空串兜底）
        let local = index(&[(BIZ_STORAGE_TYPE, "0")]);
        let st = StorageType::from_type_code(local.raw(BIZ_STORAGE_TYPE)).expect("类型 0 合法");
        assert_eq!(st, StorageType::Local);
        assert_eq!(local.raw(st.url_biz_code()).unwrap_or_default(), "");
    }

    /// `after_sales_service` 的布尔语义（对应
    /// `SHOW_TEMPLATE_CONTENT` 的 `BOOLEAN` 解析）。
    #[test]
    fn after_sales_boolean_from_index() {
        let cfgs = index(&[(BIZ_SHOW_TEMPLATE_CONTENT, "true")]);
        assert!(get_bool(&cfgs, BIZ_SHOW_TEMPLATE_CONTENT));
        let cfgs = index(&[(BIZ_SHOW_TEMPLATE_CONTENT, "false")]);
        assert!(!get_bool(&cfgs, BIZ_SHOW_TEMPLATE_CONTENT));
    }

    /// `login_protocol_content`：非法 code ⇒ `None`（Java `default: return null`）。
    ///
    /// 这里只测纯逻辑分支（`ProtocolKind::from_code`），
    /// 不触碰数据库。
    #[test]
    fn protocol_content_invalid_code_is_none() {
        assert!(ProtocolKind::from_code("nope").is_none());
        assert!(ProtocolKind::from_code("").is_none());
        assert_eq!(
            ProtocolKind::from_code("termsOfService").map(ProtocolKind::biz_codes),
            Some(("termsOfServiceShow", "termsOfService"))
        );
        assert_eq!(
            ProtocolKind::from_code("afterSalesService").map(ProtocolKind::biz_codes),
            Some((BIZ_AFTER_SALES_SERVICE_SHOW, BIZ_AFTER_SALES_SERVICE))
        );
    }

    /// 装配 `init_config_settings` 的已核对字段。
    #[test]
    fn assemble_init_fields() {
        let cfgs = index(&[
            (BIZ_SHOP_NAME, "TigShop"),
            (BIZ_SHOP_LOGO, "https://x/logo.png"),
            (BIZ_IS_OPEN_MOBILE_AREA_CODE, "1"),
            (BIZ_KEFU_TYPE, "2"),
            (BIZ_DOLLAR_SIGN, "$"),
        ]);
        let vo = assemble_init_config_settings(&cfgs);
        assert_eq!(vo.shop_name.as_deref(), Some("TigShop"));
        assert_eq!(vo.shop_logo.as_deref(), Some("https://x/logo.png"));
        assert_eq!(vo.is_open_mobile_area_code, Some(1));
        assert_eq!(vo.kefu_type, Some(2));
        assert_eq!(vo.dollar_sign.as_deref(), Some("$"));
        // 未核对的字段保持 None（不编造）
        assert_eq!(vo.amap_web_key, None);
        assert_eq!(vo.map_provider, None);
    }

    /// 商品原图批量下载三项配置：JSON 数组解析、装配与 camelCase 序列化。
    #[test]
    fn assemble_raw_image_download_settings() {
        let cfgs = index(&[
            (BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_ENABLED, "1"),
            (
                BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS,
                r#"["pc","h5","miniProgram","app"]"#,
            ),
            (
                BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES,
                r#"["main","sku","detail"]"#,
            ),
        ]);
        let vo = assemble_init_config_settings(&cfgs);
        assert_eq!(vo.product_raw_image_download_enabled, Some(1));
        assert_eq!(
            vo.product_raw_image_download_channels.as_deref(),
            Some(&["pc".to_owned(), "h5".to_owned(), "miniProgram".to_owned(), "app".to_owned()][..])
        );
        assert_eq!(
            vo.product_raw_image_download_scopes.as_deref(),
            Some(&["main".to_owned(), "sku".to_owned(), "detail".to_owned()][..])
        );
        let json = serde_json::to_value(&vo).expect("VO 可序列化");
        assert_eq!(json["productRawImageDownloadEnabled"], 1);
        assert!(json["productRawImageDownloadChannels"].is_array());
        assert!(json["productRawImageDownloadScopes"].is_array());

        // 配置行缺失：Java `SettingsHelper#getRaw` 回落 SettingsEnum.defaultValue。
        let off = assemble_init_config_settings(&index(&[(
            BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_ENABLED,
            "0",
        )]));
        assert_eq!(off.product_raw_image_download_enabled, Some(0));
        assert_eq!(
            off.product_raw_image_download_channels.as_deref(),
            Some(&["pc".to_owned(), "h5".to_owned(), "miniProgram".to_owned(), "app".to_owned()][..])
        );
        assert_eq!(
            off.product_raw_image_download_scopes.as_deref(),
            Some(&["main".to_owned(), "sku".to_owned(), "detail".to_owned()][..])
        );

        // 行存在但值为空：Java parse(JSON_ARRAY, blank) = null，不回落默认值。
        let blank = assemble_init_config_settings(&index(&[
            (BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_ENABLED, "1"),
            (BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_CHANNELS, ""),
            (BIZ_PRODUCT_RAW_IMAGE_DOWNLOAD_SCOPES, "  "),
        ]));
        assert_eq!(blank.product_raw_image_download_channels, None);
        assert_eq!(blank.product_raw_image_download_scopes, None);
    }

    /// `getBase` 的关键整型/字符串兜底（对照 Java 常量）。
    #[test]
    fn base_fallbacks() {
        let empty = ConfigIndex::new();
        assert_eq!(
            tigshop_core::models::system::config_client::get_str_or(
                &empty,
                BIZ_DOLLAR_SIGN,
                DEFAULT_DOLLAR_SIGN
            ),
            "¥"
        );
        assert_eq!(
            tigshop_core::models::system::config_client::get_str_or(
                &empty,
                BIZ_DOLLAR_SIGN_CN,
                DEFAULT_DOLLAR_SIGN_CN
            ),
            "元"
        );
        assert_eq!(
            tigshop_core::models::system::config_client::int_or(&empty, BIZ_CLOSE_ORDER, 0),
            0
        );
        assert_eq!(
            tigshop_core::models::system::config_client::int_or(&empty, BIZ_SHOW_SELLED_COUNT, 1),
            1
        );
    }
}