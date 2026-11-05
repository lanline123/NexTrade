//! 运费模板域（logistics::shipping_tpl）DTO / VO / 查询参数。
//!
//! 对应原 Java（`tigshop-adminapi` 的 `ShippingTplController`，8 条管理端链路）：
//!
//! | 本域端点（挂载于 `/adminapi`） | 原 Java |
//! |--------------------------------|---------|
//! | `GET  /setting/shippingTpl/detail` | `ShippingTplController.detail` |
//! | `POST /setting/shippingTpl/create` | `ShippingTplController.create` |
//! | `POST /setting/shippingTpl/update` | `ShippingTplController.update` |
//! | `POST /setting/shippingTpl/del` | `ShippingTplController.del` |
//! | `POST /setting/shippingTpl/updateField` | `ShippingTplController.updateField` |
//! | `POST /setting/shippingTpl/batch` | `ShippingTplController.batch` |
//! | `GET  /setting/shippingTpl/config` | `ShippingTplController.config` |
//! | `POST /setting/shippingTpl/setDefault` | `ShippingTplController.setDefault` |
//!
//! 关联 Java 类型：
//! - `com.tigshop.bean.model.setting.{ShippingTpl, ShippingTplInfo, ShippingType}`
//!   （表 `shipping_tpl` / `shipping_tpl_info` / `shipping_type`）
//! - `com.tigshop.bean.dto.setting.ShippingTplListDTO extends BasePage`
//! - `com.tigshop.bean.dto.setting.ShippingTplUpdateDTO`
//! - `com.tigshop.bean.param.settings.shippingtpl.{ShippingTplSaveParam,
//!   ShippingTypeParam, ShippingTplInfoParam, RegionDataParam}`
//! - `com.tigshop.bean.vo.setting.shippingtpl.{ShippingTplVO, ShippingTypeVO,
//!   ShippingTplInfoVO, RegionDataVO}`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//!   （本域自持副本，避免与其他切片产生编译期耦合）
//! - `com.tigshop.common.constant.setting.{ShippingTplConstants,
//!   ShippingTplInfoConstants, ShippingTypeConstants}`
//! - `com.tigshop.common.core.entity.BasePage`（`page` / `size` / `sortField` /
//!   `sortOrder`）
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! ## 金额
//!
//! 运费模板内容的「起价 / 增价 / 满额包邮」是真实金额列
//! （`shipping_tpl_info.start_price` / `add_price` / `free_price`），
//! 一律使用 [`rust_decimal::Decimal`]，**禁用 f64/f32**。
//! `start_number` / `add_number` 在库中是 `decimal(12,5)`（按件/按重），
//! 同样用 `Decimal` 承载，避免二进制浮点误差。

use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer, Serialize};

use crate::entities::{ShippingTpl as ShippingTplEntity, ShippingTplInfo, ShippingType};
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 金额反序列化（与 shop_client 的 `de_opt_dec` 同一约定）
// ——————————————————————————————————————————————

/// 兼容金额的两种前端写法：JSON **数字**（`5.00`）与 **数字字符串**（`"5.00"`）。
///
/// ⚠️ **必须显式指定**：本仓库的 `rust_decimal` 开启了 `serde-with-str`
/// 特性，`Decimal` 的默认 `Deserialize` **只接受字符串**。
/// 而 Java 侧（fastjson / Jackson 绑定 `BigDecimal`）两种都能收，
/// 前端实际发的是**裸数字**，若不做兼容会直接 400。
///
/// 与 `models::crate::models::merchant::shop_client::de_opt_dec` 的差异：本域金额是
/// `Option<Decimal>` 字段且**不区分「未传」与「空串」**
/// （两者都按「未提供」处理，服务层回退 `Decimal::ZERO`，与 Java
/// `Builder` 里 `null` 的语义对齐），故空串同样返回 `None`。
fn de_opt_dec<'de, D>(de: D) -> Result<Option<Decimal>, D::Error>
where
    D: Deserializer<'de>,
{
    // `Visitor` 被下方 `impl<'de> Visitor<'de> for V` 直接使用；
    // 各 visit_* 已用全限定 `E: serde::de::Error` 约束，故不再引入 `Error as _`。
    use serde::de::Visitor;

    struct V;

    impl<'de> Visitor<'de> for V {
        type Value = Option<Decimal>;

        fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str("数字、数字字符串（空串或 null 视为未提供）")
        }

        fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
            Ok(None)
        }

        fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
            let t = v.trim();
            if t.is_empty() {
                return Ok(None);
            }
            t.parse::<Decimal>().map(Some).map_err(E::custom)
        }

        fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Self::Value, E> {
            // 走十进制字面量解析而非 f64→Decimal 转换，避免二进制浮点误差
            Decimal::from_str_exact(&v.to_string())
                .map(Some)
                .map_err(E::custom)
        }
        fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(Decimal::from(v)))
        }

        fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(Decimal::from(v)))
        }
    }

    de.deserialize_any(V)
}

// ——————————————————————————————————————————————
// 常量（对应 Java 常量类 / 注解阈值）
// ——————————————————————————————————————————————

/// `shipping_tpl` 的真实列
/// （`python tools/schema_parser.py --table shipping_tpl`）。
pub const SHIPPING_TPL_COLUMNS: [&str; 7] = [
    "shipping_tpl_id",
    "shipping_time",
    "shipping_tpl_name",
    "is_free",
    "pricing_type",
    "is_default",
    "shop_id",
];

/// `shipping_tpl` 的主键列（Java `BaseServiceImpl#getKeyColumn`）。
pub const KEY_COLUMN: &str = "shipping_tpl_id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `shippingTplId`）。
pub const KEY_PROPERTY: &str = "shippingTplId";

/// `updateField` 的允许字段。
///
/// 逐字符对应 Java `ShippingTplController` 的类常量：
/// ```text
/// private static String[] FIELDS = { "is_show", "sort_order", "status", "shipping_tpl_name"};
/// ```
///
/// ⚠️ **这 4 个字段里只有 `shipping_tpl_name` 是 `shipping_tpl` 的真实列**：
/// `is_show` / `sort_order` / `status` 三列在 `shipping_tpl` 表中**不存在**
/// （该表只有 7 列，见 [`SHIPPING_TPL_COLUMNS`]）。
/// 也就是说 Java 这份白名单是**从别的控制器复制过来的残留**，
/// 前端传 `field=isShow` 时 Java 会让 MySQL 直接报
/// `Unknown column 'is_show' in 'field list'`（500）。
///
/// 本实现的处理：
/// - 白名单常量 [`SHIPPING_TPL_FIELDS`] **逐字符照抄 Java**（保持对照可查）；
/// - 服务层在命中白名单后**再做一次真实列校验**
///   （[`SHIPPING_TPL_COLUMNS`]），把会 500 的三列**提前**变成可诊断的
///   `400 字段值不合法`，而不是拼一条必然失败的 SQL。
///
/// 这是一处**有意的行为偏离**（Java 500 → Rust 400），已列入
/// `uncertain_points`，待产品确认这三列是否为缺失的迁移列。
pub const SHIPPING_TPL_FIELDS: [&str; 4] = ["is_show", "sort_order", "status", "shipping_tpl_name"];

/// 「是」的取值（Java `Constants.YES = 1`）。
pub const YES: i32 = 1;

/// 「否」的取值（Java `Constants.NO = 0`）。
pub const NO: i32 = 0;

/// 模板名称最大长度（库列 `shipping_tpl_name varchar(120)`）。
pub const SHIPPING_TPL_NAME_MAX_LEN: usize = 120;

/// 配送时间最大长度（库列 `shipping_time varchar(255)`）。
pub const SHIPPING_TIME_MAX_LEN: usize = 255;

/// 默认模板的配送类型 ID 固定为 1。
///
/// Java `ShippingTypeServiceImpl#getShippingTypeListByShopId` 硬编码
/// `new ShippingType(1L)`；`ShippingTypeParam#createDefaultShippingTplInfo`
/// / `#createAreaShippingTplInfos` 也把 `shippingTypeId` **写死为 1L**
/// （**忽略**入参 `shippingTypeId`）。本实现复刻该行为。
pub const DEFAULT_SHIPPING_TYPE_ID: i32 = 1;

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————
// 来源：`com.tigshop.common.constant.setting.ShippingTplConstants` /
//      `ShippingTplInfoConstants` / `ShippingTypeConstants` /
//      `com.tigshop.common.constant.ResultTextConstants`

/// Java `ShippingTplInfoConstants.TPL_NOT_NULL`
/// （`ShippingTplServiceImpl#detail` 记录不存在时抛出）。
pub const MSG_SHIPPING_TPL_NOT_FOUND: &str = "该运费模板不存在";

/// Java `ShippingTplConstants.SHIPPING_TPL_NAME_IS_EXISTS`
/// （`create` / `update` 的同店铺模板名查重）。
pub const MSG_SHIPPING_TPL_NAME_EXISTS: &str = "运费模板名称已存在";

/// Java `ShippingTypeConstants.SHIPPING_TYPE_NOT_NULL`
/// （`create` 无勾选运送方式 / `update` 全部 `isChecked <= 0` 时抛出）。
pub const MSG_SHIPPING_TYPE_NOT_NULL: &str = "请选择运送方式";

/// Java `ShippingTplServiceImpl#setDefault` 第 289 行的
/// 「店铺归属」校验文案。
pub const MSG_SHIPPING_TPL_NO_PERMISSION: &str = "无权操作该运费模板";

/// Java `ResultTextConstants.INVALID_FIELD_VALUE`（`updateField` 白名单未命中）。
pub const MSG_INVALID_FIELD_VALUE: &str = "字段值不合法";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO` / `UpdateFieldDTO`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ShippingTplController#detail` 参数上的
/// `@NotNull(message = "模版主键不能为空")`（注意是「模版」不是「模板」）。
pub const MSG_SHIPPING_TPL_ID_REQUIRED: &str = "模版主键不能为空";

/// Java `ShippingTplSaveParam#shippingTplName` 上的
/// `@NotBlank(message = "运费模版名称不能为空")`。
pub const MSG_SHIPPING_TPL_NAME_NOT_BLANK: &str = "运费模版名称不能为空";

/// Java `ShippingTplSaveParam#isDefault` 上的 `@NotNull(message = "是否默认不能为空")`。
pub const MSG_IS_DEFAULT_NOT_NULL: &str = "是否默认不能为空";

/// Java `ShippingTplSaveParam#isFree` 上的 `@NotNull(message = "是否包邮不能为空")`。
pub const MSG_IS_FREE_NOT_NULL: &str = "是否包邮不能为空";

/// Java `ShippingTplSaveParam#pricingType` 上的
/// `@NotNull(message = "计价方式不能为空")`。
pub const MSG_PRICING_TYPE_NOT_NULL: &str = "计价方式不能为空";

/// Rust 侧补的通用提示（Java 无对应文案）。
pub const MSG_SHIPPING_TPL_UPDATE_ID_REQUIRED: &str = "运费模板主键不能为空";

/// Rust 侧补的通用提示（Java 无对应文案）。
pub const MSG_SET_DEFAULT_ID_REQUIRED: &str = "运费模板id不能为空";

// ——————————————————————————————————————————————
// 出参：VO
// ——————————————————————————————————————————————

/// 地区信息（对应 Java `com.tigshop.bean.vo.setting.shippingtpl.RegionDataVO`）。
///
/// 库中以 JSON 文本存于 `shipping_tpl_info.region_data`。
/// Java 用 `JSON.parseObject(regionData, RegionDataVO.class)` 解析。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionDataVO {
    /// 地区 id 信息，例如 `[[1,360000],[1,360000,360100]]`
    pub area_regions: Vec<Vec<i64>>,
    /// 地区 name 信息，与 `area_regions` 顺序对应
    pub area_region_names: Vec<String>,
}

/// 运费模板内容 VO
/// （对应 Java `com.tigshop.bean.vo.setting.shippingtpl.ShippingTplInfoVO`）。
///
/// Java 构造函数把 `region_data` 从 JSON 文本解析为 `RegionDataVO` 对象
/// （`StrUtil.isNotBlank` 非空才解析），本实现保持一致。
///
/// ⚠️ Java 的构造函数**漏掉了 `pricingType` 的赋值**
/// （`ShippingTplInfoVO` 有 `pricingType` 字段，但构造器只 copy 到
/// `freePrice` 就结束了，没有 `this.pricingType = ...`）。
/// 结果是详情接口返回的 `pricingType` **恒为 `null`**。
/// 本实现**照抄这一可观测行为**（见 [`ShippingTplInfoVO::from_entity`]），
/// 并把正确赋值保留在 [`ShippingTplInfoVO::from_entity_with_pricing_type`]，
/// 由调用方（路由/产品确认后）按需切换。已列入 `uncertain_points`。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplInfoVO {
    /// 运费模板内容 ID
    pub id: i32,
    /// 配送类型 ID
    pub shipping_type_id: i32,
    /// 运费模板 ID
    pub shipping_tpl_id: i32,
    /// 是否包邮：1 是 0 否
    pub is_free: i32,
    /// 是否默认：1 是 0 否
    pub is_default: i32,
    /// 起重或起件
    pub start_number: Decimal,
    /// 起价
    pub start_price: Decimal,
    /// 每增重或增价
    pub add_number: Decimal,
    /// 增价
    pub add_price: Decimal,
    /// 满多少包邮
    pub free_price: Decimal,
    /// 按件还是按重，1：按件，2：按重
    ///
    /// ⚠️ Java 构造器漏赋值 ⇒ 线上恒为 `null`（见类型级说明）。
    pub pricing_type: Option<i32>,
    /// 地区信息（由 `region_data` JSON 解析）
    pub region_data: Option<RegionDataVO>,
}

impl ShippingTplInfoVO {
    /// 由实体构造，**逐条复刻 Java `ShippingTplInfoVO(ShippingTplInfo)`**：
    /// `pricingType` **不赋值**（保持 `None`），这是 Java 的既有缺陷。
    #[must_use]
    pub fn from_entity(e: &ShippingTplInfo) -> Self {
        Self {
            id: e.id,
            shipping_type_id: e.shipping_type_id,
            shipping_tpl_id: e.shipping_tpl_id,
            is_free: e.is_free,
            is_default: e.is_default,
            start_number: e.start_number,
            start_price: e.start_price,
            add_number: e.add_number,
            add_price: e.add_price,
            free_price: e.free_price,
            // Java 构造器没有 `this.pricingType = ...` ⇒ 恒 null
            pricing_type: None,
            region_data: parse_region_data(e.region_data.as_deref()),
        }
    }

    /// 由实体构造，**补上** Java 漏掉的 `pricingType`（意图版本）。
    ///
    /// 当前未被路由调用；保留是为了让主会话 / 产品在一行内切换，
    /// 而不必重读 Java 源码。启用后会**改变详情接口的返回体**
    /// （`pricingType` 由 `null` 变为真实值），属未被授权的业务变更。
    #[must_use]
    pub fn from_entity_with_pricing_type(e: &ShippingTplInfo) -> Self {
        let mut vo = Self::from_entity(e);
        vo.pricing_type = Some(e.pricing_type);
        vo
    }
}

/// 配送类型 VO
/// （对应 Java `com.tigshop.bean.vo.setting.shippingtpl.ShippingTypeVO`）。
///
/// Java 构造函数 `ShippingTypeVO(ShippingType, List<ShippingTplInfo>)`：
/// 把 `isDefault == 1` 的那条放进 `defaultTplInfo`，其余全部进 `areaTplInfo`。
/// 注意 Java 用 `shippingTplInfo.getIsDefault() == 1` 做**基本类型**比较
/// （`Integer` 拆箱，`null` 会 NPE；库列 `NOT NULL` 故实际安全）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeVO {
    /// 配送类型 id
    pub shipping_type_id: i32,
    /// 类型名称
    pub shipping_type_name: Option<String>,
    /// 默认发货物流公司 ID
    pub shipping_default_id: Option<i32>,
    /// 描述
    pub shipping_type_desc: Option<String>,
    /// 发货时间描述
    pub shipping_time_desc: Option<String>,
    /// 是否支持货到付款
    pub is_support_cod: Option<i32>,
    /// 排序
    pub sort_order: Option<i32>,
    /// 店铺 id
    pub shop_id: Option<i32>,
    /// 物流公司名称（Java `list` 里单独查 `logistics_company` 补上；
    /// 本域 `detail` / `config` 两条链路 Java **都不查**，恒 `null`）
    pub logistics_name: Option<String>,
    /// 默认运费模板内容（`is_default == 1` 的那条）
    pub default_tpl_info: Option<ShippingTplInfoVO>,
    /// 区域运费模板内容（`is_default == 0` 的全部）
    pub area_tpl_info: Vec<ShippingTplInfoVO>,
}

impl ShippingTypeVO {
    /// 由一个 `ShippingType` 实体 + 该模板下的全部 `shipping_tpl_info` 构造。
    ///
    /// 逐条复刻 Java `ShippingTypeVO(ShippingType, List<ShippingTplInfo>)`：
    /// - `shippingType` 侧的 8 个属性用 `BeanUtils.copyProperties` 直接带过
    /// - `logisticsName` **不查**（Java 在该构造函数里不涉及）
    /// - `shippingTplInfos` 非空时按 `is_default` 拆分；
    ///   **为空时 `defaultTplInfo` 与 `areaTplInfo` 都保持 `null`**
    ///   （Java 的 `if (CollUtil.isNotEmpty(...))` 守卫 —— 注意
    ///   `areaTplInfo` 不是空数组而是 `null`）
    #[must_use]
    pub fn from_entity(shipping_type: &ShippingType, infos: &[ShippingTplInfo]) -> Self {
        let mut vo = Self {
            shipping_type_id: shipping_type.shipping_type_id,
            shipping_type_name: Some(shipping_type.shipping_type_name.clone()),
            shipping_default_id: Some(shipping_type.shipping_default_id),
            shipping_type_desc: Some(shipping_type.shipping_type_desc.clone()),
            shipping_time_desc: Some(shipping_type.shipping_time_desc.clone()),
            is_support_cod: Some(shipping_type.is_support_cod),
            sort_order: Some(shipping_type.sort_order),
            shop_id: Some(shipping_type.shop_id),
            logistics_name: None,
            default_tpl_info: None,
            area_tpl_info: Vec::new(),
        };

        if !infos.is_empty() {
            for info in infos {
                let item = ShippingTplInfoVO::from_entity(info);
                if info.is_default == YES {
                    vo.default_tpl_info = Some(item);
                } else {
                    vo.area_tpl_info.push(item);
                }
            }
        }
        vo
    }

    /// Java `detail` 里 `new ShippingTypeVO(new ShippingType(), shippingTplInfos)`
    /// 的等价物：配送类型实体是**全默认的空对象**（`shippingTypeId = 0`、
    /// 各字段为 `null`/`0`），只有 `shippingTplInfo` 有内容。
    ///
    /// 这正是 Java `ShippingTplServiceImpl#detail` 第 129 行的写法
    /// —— 详情接口**根本不查 `shipping_type` 表**，永远返回一个空壳配送类型。
    #[must_use]
    pub fn empty_shell(infos: &[ShippingTplInfo]) -> Self {
        Self::from_entity(&ShippingType::default(), infos)
    }
}

/// 运费模板 VO
/// （对应 Java `com.tigshop.bean.vo.setting.shippingtpl.ShippingTplVO`）。
///
/// Java 有两个构造器：无参（`list` 用 `BeanUtils.copyProperties`）与
/// `(ShippingTpl, List<ShippingTypeVO>)`（`detail` 用）。
/// 两者字段一致，本实现统一为 [`ShippingTplVO::from_entity`]。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplVO {
    /// 运费模板 ID
    pub shipping_tpl_id: i32,
    /// 配送时间
    pub shipping_time: String,
    /// 模板名称
    pub shipping_tpl_name: String,
    /// 是否包邮：1 是 0 否
    pub is_free: i32,
    /// 1：件数，2：重量
    pub pricing_type: i32,
    /// 是否默认：1 是 0 否
    pub is_default: i32,
    /// 模板信息（`detail` 才填；`list` 走 `BeanUtils.copyProperties` 后
    /// 该字段为 `null`，本实现对应空 `Vec`）
    pub shipping_tpl_info: Vec<ShippingTypeVO>,
}

impl ShippingTplVO {
    /// 由模板实体构造（`list` 语义：不带 `shippingTplInfo`）。
    #[must_use]
    pub fn from_entity(t: &ShippingTplEntity) -> Self {
        Self {
            shipping_tpl_id: t.shipping_tpl_id,
            shipping_time: t.shipping_time.clone(),
            shipping_tpl_name: t.shipping_tpl_name.clone(),
            is_free: t.is_free,
            pricing_type: t.pricing_type,
            is_default: t.is_default,
            shipping_tpl_info: Vec::new(),
        }
    }

    /// 由模板实体 + 配送类型列表构造（`detail` 语义）。
    #[must_use]
    pub fn with_types(t: &ShippingTplEntity, types: Vec<ShippingTypeVO>) -> Self {
        Self {
            shipping_tpl_info: types,
            ..Self::from_entity(t)
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `ShippingTplListDTO extends BasePage`）。
///
/// ⚠️ **本切片没有 `/list` 路由**（接口清单只有 8 条，不含 `list`）。
/// 该结构体仍保留：Java `ShippingTplListDTO` 存在于契约中
/// （`GET /adminapi/setting/shippingTpl/list`，见 `docs/api-contract.json`），
/// 但**不在本切片任务书的 8 条清单内**，故本切片不注册该路由。
/// 保留定义以便后续切片 / 主会话直接复用，不必重读 Java。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplListQuery {
    /// 是否展示（Java `ShippingTplListDTO.isShow`；
    /// ⚠️ `shipping_tpl` 表**没有 `is_show` 列**，Java `list` 也**从未使用**
    /// 这个字段做过滤 —— 它只是接收了却不拼进 `queryWrapper`）
    pub is_show: Option<i32>,
    /// 搜索关键字（Java `BasePage.keyword`，走 `shipping_tpl_name LIKE %kw%`）
    pub keyword: Option<String>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`
    pub sort_order: Option<String>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

impl ShippingTplListQuery {
    /// 有效关键字（去空白后为空则不过滤，Java `StrUtil.isNotEmpty`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 组装内部统一分页参数（`page` 默认 1、`size` 默认 15，上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.size.unwrap_or(15).clamp(1, 100),
        }
    }

    /// 解析 ORDER BY 子句（列名由白名单映射，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// `asc` 升序；空 / `desc` 降序；**其它非法值完全不追加 `ORDER BY`**。
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

/// 区域数据入参
/// （对应 Java `com.tigshop.bean.param.settings.shippingtpl.RegionDataParam`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionDataParam {
    /// 区域 ID 列表
    pub area_regions: Vec<Vec<i64>>,
    /// 区域名称列表
    pub area_region_names: Vec<String>,
}

/// 模板信息参数
/// （对应 Java `com.tigshop.bean.param.settings.shippingtpl.ShippingTplInfoParam`）。
///
/// ⚠️ Java 侧该类的 `shippingTypeId` / `shippingTplId` / `isDefault`
/// **完全不被使用**：`ShippingTypeParam#createDefaultShippingTplInfo` 与
/// `#createAreaShippingTplInfos` 把 `shippingTypeId` 写死 `1L`、
/// `shippingTplId` 取自模板实体、`isDefault` 按「默认/区域」硬编码 1/0。
/// `pricingType` 也取自**模板**（`shippingTpl.getPricingType()`）而非本对象。
/// 本实现复刻这一行为。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplInfoParam {
    /// 配送类型 ID（Java 侧被忽略）
    pub shipping_type_id: Option<i64>,
    /// 配送模板 ID（Java 侧被忽略）
    pub shipping_tpl_id: Option<i64>,
    /// 是否默认（Java 侧被忽略）
    pub is_default: Option<i32>,
    /// 起始数量
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub start_number: Option<Decimal>,
    /// 起始价格
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub start_price: Option<Decimal>,
    /// 增加数量
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub add_number: Option<Decimal>,
    /// 增加价格
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub add_price: Option<Decimal>,
    /// 免费价格（满额包邮）
    #[serde(default, deserialize_with = "de_opt_dec")]
    pub free_price: Option<Decimal>,
    /// 区域数据
    pub region_data: Option<RegionDataParam>,
}

/// 配送类型参数
/// （对应 Java `com.tigshop.bean.param.settings.shippingtpl.ShippingTypeParam`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTypeParam {
    /// 配送类型 ID
    pub shipping_type_id: Option<i64>,
    /// 配送类型名称
    pub shipping_type_name: Option<String>,
    /// 默认配送模板 ID
    pub shipping_default_id: Option<i64>,
    /// 配送类型描述
    pub shipping_type_desc: Option<String>,
    /// 发货时间描述
    pub shipping_time_desc: Option<String>,
    /// 是否支持货到付款
    pub is_support_cod: Option<i32>,
    /// 排序顺序
    pub sort_order: Option<i32>,
    /// 店铺 ID
    pub shop_id: Option<i64>,
    /// 是否选中（Java `create` 用它过滤；`update` 用 `> 0` 判断）
    pub is_checked: Option<i32>,
    /// 默认模板信息
    pub default_tpl_info: Option<ShippingTplInfoParam>,
    /// 区域模板信息列表
    pub area_tpl_info: Option<Vec<ShippingTplInfoParam>>,
}

impl ShippingTypeParam {
    /// Java `create` 的过滤条件：
    /// `param.getShippingTplInfo().stream().filter(t -> Constants.YES.equals(t.getIsChecked()))`
    ///
    /// ⚠️ 这是 `Integer.equals`，即 `isChecked` **必须恰为 1**；
    /// `null` 或 `2` 都不算「已勾选」。
    #[must_use]
    pub fn is_checked_yes(&self) -> bool {
        self.is_checked == Some(YES)
    }

    /// Java `update` 的判断条件：`shippingTplInfo1.getIsChecked() > 0`
    ///
    /// ⚠️ 与 `create` **不一致**：这里是**拆箱后的数值比较**，
    /// 因此 `isChecked = 2`、`99` 都算「有运送方式」；
    /// 而 `isChecked == null` 会触发 **NPE**（Java 侧异常）。
    /// 本实现把 `null` 视为「不满足」，不抛 NPE（见 `uncertain_points`）。
    #[must_use]
    pub fn is_checked_positive(&self) -> bool {
        self.is_checked.is_some_and(|v| v > 0)
    }

    /// 构造「默认运费模板内容」对应的入库行
    /// （对应 Java `ShippingTypeParam#createDefaultShippingTplInfo`）。
    ///
    /// 逐条复刻：
    /// - `shippingTypeId` = **1**（写死，忽略入参）
    /// - `shippingTplId` = 模板主键
    /// - `isFree` = **模板**的 `isFree`（不是本对象的）
    /// - `isDefault` = `Constants.YES`
    /// - `regionData` = `defaultTplInfo.regionData` 序列化为 JSON
    /// - `pricingType` = **模板**的 `pricingType`
    ///
    /// ⚠️ Java 调 `JSON.toJSONString(this.defaultTplInfo.getRegionData())`：
    /// `defaultTplInfo` 为 `null` 时 **NPE**。本实现用 `None` 表达
    /// 「未提供」，[`build_template_info_rows`] 会返回校验错误而不是 panic。
    #[must_use]
    pub fn default_info_row(&self, tpl: &ShippingTplEntity) -> Option<ShippingTplInfoRow> {
        let d = self.default_tpl_info.as_ref()?;
        Some(ShippingTplInfoRow {
            shipping_type_id: DEFAULT_SHIPPING_TYPE_ID,
            shipping_tpl_id: tpl.shipping_tpl_id,
            is_free: tpl.is_free,
            is_default: YES,
            region_data: serialize_region_data(d.region_data.as_ref()),
            start_number: d.start_number.unwrap_or_default(),
            start_price: d.start_price.unwrap_or_default(),
            add_number: d.add_number.unwrap_or_default(),
            add_price: d.add_price.unwrap_or_default(),
            free_price: d.free_price.unwrap_or_default(),
            pricing_type: tpl.pricing_type,
        })
    }

    /// 构造「区域运费模板内容」对应的入库行列表
    /// （对应 Java `ShippingTypeParam#createAreaShippingTplInfos`）。
    ///
    /// 逐条复刻：`isDefault` = `Constants.NO`，其余同 [`Self::default_info_row`]。
    ///
    /// ⚠️ Java 直接 `this.areaTplInfo.stream()`：为 `null` 时 **NPE**。
    /// 本实现把 `None` 当作空列表。
    #[must_use]
    pub fn area_info_rows(&self, tpl: &ShippingTplEntity) -> Vec<ShippingTplInfoRow> {
        self.area_tpl_info
            .as_deref()
            .unwrap_or_default()
            .iter()
            .map(|item| ShippingTplInfoRow {
                shipping_type_id: DEFAULT_SHIPPING_TYPE_ID,
                shipping_tpl_id: tpl.shipping_tpl_id,
                is_free: tpl.is_free,
                is_default: NO,
                region_data: serialize_region_data(item.region_data.as_ref()),
                start_number: item.start_number.unwrap_or_default(),
                start_price: item.start_price.unwrap_or_default(),
                add_number: item.add_number.unwrap_or_default(),
                add_price: item.add_price.unwrap_or_default(),
                free_price: item.free_price.unwrap_or_default(),
                pricing_type: tpl.pricing_type,
            })
            .collect()
    }

    /// 本配送类型下全部待入库行（默认行在前，区域行在后）。
    ///
    /// Java `ShippingTplInfoServiceImpl#saveShippingTplInfo` 用 `flatMap`
    /// 展开，顺序正是「每条 `ShippingTypeParam` 的默认行 + 其余区域行」。
    /// `defaultTplInfo` 为 `None` 时**整个配送类型被跳过**
    /// （对应 Java 的 NPE 场景；本实现的取舍见 `uncertain_points`）。
    #[must_use]
    pub fn info_rows(&self, tpl: &ShippingTplEntity) -> Vec<ShippingTplInfoRow> {
        match self.default_info_row(tpl) {
            Some(default_row) => {
                let mut rows = vec![default_row];
                rows.extend(self.area_info_rows(tpl));
                rows
            }
            None => Vec::new(),
        }
    }
}

/// 创建请求（Java `com.tigshop.bean.param.settings.shippingtpl.ShippingTplSaveParam`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplSaveDTO {
    /// 运费模板名称（必填）
    pub shipping_tpl_name: Option<String>,
    /// 发货时间
    pub shipping_time: Option<String>,
    /// 是否默认（必填）
    pub is_default: Option<i32>,
    /// 是否包邮（必填）
    pub is_free: Option<i32>,
    /// 计价方式（必填）
    pub pricing_type: Option<i32>,
    /// 运费模板信息列表
    pub shipping_tpl_info: Option<Vec<ShippingTypeParam>>,
}

/// 更新请求（Java `com.tigshop.bean.dto.setting.ShippingTplUpdateDTO`）。
///
/// ⚠️ 与 `ShippingTplSaveParam` **不是**同一个类：`update` 的入参是
/// `ShippingTplUpdateDTO`，字段更全（多了 `id` / `shippingTplId` / `shopId`），
/// 但**没有** `@NotNull` 注解，且 `shippingTplName` 允许为空
/// （Java `update` 用 `StrUtil.isNotBlank` 守卫查重）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ShippingTplUpdateDTO {
    /// 主键（Java `id`）
    pub id: Option<i64>,
    /// 运费模板信息列表
    pub shipping_tpl_info: Option<Vec<ShippingTypeParam>>,
    /// 是否默认
    pub is_default: Option<i32>,
    /// 是否免费（包邮）
    pub is_free: Option<i32>,
    /// 定价类型
    pub pricing_type: Option<i32>,
    /// 运费模板 id（Java 侧被 `id` 覆盖，见服务层说明）
    pub shipping_tpl_id: Option<i64>,
    /// 发货时间
    pub shipping_time: Option<String>,
    /// 运费模板名称
    pub shipping_tpl_name: Option<String>,
    /// 店铺 id（Java 侧不参与：`BeanUtils.copyProperties` 会带过去，
    /// 但随后 `setShippingTplId(updateDTO.getId())` 才决定主键；
    /// `shopId` 在 Java `update` 中**没有**被显式覆盖，故可被请求体改写）
    pub shop_id: Option<i32>,
}

impl ShippingTplUpdateDTO {
    /// 请求体是否把该模板设为默认（Java `Constants.YES.equals(...)`）。
    #[must_use]
    pub fn wants_default(&self) -> bool {
        self.is_default == Some(YES)
    }

    /// 有效模板名（去空白后为空 ⇒ `None`，Java `StrUtil.isNotBlank`）。
    #[must_use]
    pub fn effective_name(&self) -> Option<&str> {
        self.shipping_tpl_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
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

/// `setDefault` 的查询参数（Java `@RequestParam("id") Long id`）。
///
/// Java 用 `@RequestParam`（**查询串**，不是 `@RequestBody`）取 `id`，
/// 因此这里是 `GET` 风格的 query extractor 但挂在 `POST` 上
/// （axum 的 `Query` 对 POST 同样有效）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SetDefaultQuery {
    /// 运费模板主键（必填）
    pub id: Option<i64>,
}

/// `detail` 的查询参数（Java `@RequestParam("id") Integer id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetailQuery {
    /// 运费模板主键（必填）
    pub id: Option<i32>,
}

// ——————————————————————————————————————————————
// 待入库行 / 纯函数
// ——————————————————————————————————————————————

/// 一条待写入 `shipping_tpl_info` 的行（对应 Java `ShippingTplInfo` 实体）。
///
/// 与实体字段一一对应，单独定义是因为插入时
/// `shipping_tpl_id` 需要模板入库后的自增主键回填。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShippingTplInfoRow {
    /// 配送类型 ID（Java 写死 1）
    pub shipping_type_id: i32,
    /// 运费模板 ID
    pub shipping_tpl_id: i32,
    /// 是否包邮（取自模板）
    pub is_free: i32,
    /// 是否默认（默认行 1 / 区域行 0）
    pub is_default: i32,
    /// 地区信息 JSON 文本
    pub region_data: Option<String>,
    /// 起重或起件
    pub start_number: Decimal,
    /// 起价
    pub start_price: Decimal,
    /// 每增重或增价
    pub add_number: Decimal,
    /// 增价
    pub add_price: Decimal,
    /// 满多少包邮
    pub free_price: Decimal,
    /// 按件还是按重（取自模板）
    pub pricing_type: i32,
}

/// 把 `RegionDataParam` 序列化为库中的 JSON 文本
/// （对应 Java `JSON.toJSONString(regionData)`）。
///
/// ⚠️ Java 用的是 **fastjson**，字段顺序为声明顺序
/// （`areaRegions` → `areaRegionNames`），本实现用 serde 保持同样顺序。
/// `None` 时 Java 会输出字面量 `"null"`（`JSON.toJSONString(null)`），
/// 本实现返回 `None`（写库为 SQL NULL）—— 这是一处**有意偏离**：
/// 两种写法在读取侧都解析为「无地区数据」，但库中字节不同，
/// 已列入 `uncertain_points`。
#[must_use]
pub fn serialize_region_data(data: Option<&RegionDataParam>) -> Option<String> {
    data.and_then(|d| serde_json::to_string(d).ok())
}

/// 把库中的 JSON 文本解析为 `RegionDataVO`
/// （对应 Java `JSON.parseObject(regionData, RegionDataVO.class)`）。
///
/// Java 侧有 `StrUtil.isNotBlank` 守卫：空串 / `null` 都不解析。
/// 解析失败时 Java 抛 `JSONException`；本实现返回 `None`
/// （容错，见 `uncertain_points`）。
#[must_use]
pub fn parse_region_data(raw: Option<&str>) -> Option<RegionDataVO> {
    let s = raw.map(str::trim).filter(|s| !s.is_empty())?;
    serde_json::from_str::<RegionDataVO>(s).ok()
}

/// 排序字段 → 列名（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `shipping_tpl` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "shippingTplId" | "shipping_tpl_id" => "shipping_tpl_id",
        "shippingTime" | "shipping_time" => "shipping_time",
        "shippingTplName" | "shipping_tpl_name" => "shipping_tpl_name",
        "isFree" | "is_free" => "is_free",
        "pricingType" | "pricing_type" => "pricing_type",
        "isDefault" | "is_default" => "is_default",
        "shopId" | "shop_id" => "shop_id",
        _ => KEY_COLUMN,
    }
}

/// `updateField` 的字段名归一（Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// ⚠️ 白名单 `SHIPPING_TPL_FIELDS` 里的 `is_show` / `sort_order` / `status`
/// **不是 `shipping_tpl` 的真实列**，因此本函数对它们返回 `None`
/// （见 [`SHIPPING_TPL_FIELDS`] 的说明）。
/// `shipping_tpl_name` 两种写法都可命中，其余未识别字段返回 `None`。
#[must_use]
pub fn map_update_field_column(field: &str) -> Option<&'static str> {
    match field {
        "shippingTplId" | "shipping_tpl_id" => Some("shipping_tpl_id"),
        "shippingTime" | "shipping_time" => Some("shipping_time"),
        "shippingTplName" | "shipping_tpl_name" => Some("shipping_tpl_name"),
        "isFree" | "is_free" => Some("is_free"),
        "pricingType" | "pricing_type" => Some("pricing_type"),
        "isDefault" | "is_default" => Some("is_default"),
        "shopId" | "shop_id" => Some("shop_id"),
        _ => None,
    }
}

/// 校验创建请求（对应 Java `ShippingTplSaveParam` 上的 `@NotBlank` / `@NotNull`）。
///
/// 控制器类上有类级 `@PreAuthorize` 但**没有** `@Validated`，
/// 不过 Spring Boot 3 的 `@RequestBody` 参数若带 `@Valid` 才生效 ——
/// 该控制器 `create` 的参数是裸 `@RequestBody ShippingTplSaveParam param`
/// （**无 `@Valid`**），因此 Java 侧这些注解**实际上不生效**。
///
/// 本实现**仍然做校验**（更安全，且与大部分其他域的 Rust 实现一致），
/// 文案逐字符照抄 Java 注解；这是一处**行为收紧**，已列入 `uncertain_points`。
///
/// # Errors
/// 返回带 Java 原文案的错误字符串。
pub fn validate_save(dto: &ShippingTplSaveDTO) -> Result<ValidatedSave, String> {
    let name = dto
        .shipping_tpl_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_SHIPPING_TPL_NAME_NOT_BLANK.to_string())?
        .to_string();
    if name.chars().count() > SHIPPING_TPL_NAME_MAX_LEN {
        return Err(format!(
            "运费模板名称不能超过{SHIPPING_TPL_NAME_MAX_LEN}个字符"
        ));
    }

    let shipping_time = dto.shipping_time.clone().unwrap_or_default();
    if shipping_time.chars().count() > SHIPPING_TIME_MAX_LEN {
        return Err(format!("配送时间不能超过{SHIPPING_TIME_MAX_LEN}个字符"));
    }

    let is_default = dto
        .is_default
        .ok_or_else(|| MSG_IS_DEFAULT_NOT_NULL.to_string())?;
    let is_free = dto
        .is_free
        .ok_or_else(|| MSG_IS_FREE_NOT_NULL.to_string())?;
    let pricing_type = dto
        .pricing_type
        .ok_or_else(|| MSG_PRICING_TYPE_NOT_NULL.to_string())?;
    if !(1..=3).contains(&pricing_type) {
        return Err("计价方式只能为按件数、按重量或按体积".to_string());
    }
    // v5.8.61 体积计费：首/续体积、首/续费、满免金额的精度与范围。
    if pricing_type == 3 && is_free != 1 {
        let types = dto.shipping_tpl_info.as_deref().unwrap_or_default();
        if types.is_empty() {
            return Err(MSG_SHIPPING_TYPE_NOT_NULL.to_string());
        }
        for item in types.iter().filter(|t| t.is_checked_yes()) {
            let default_rule = item
                .default_tpl_info
                .as_ref()
                .ok_or_else(|| "请填写体积运费规则".to_string())?;
            validate_volume_rule(default_rule)?;
            for area in item.area_tpl_info.as_deref().unwrap_or_default() {
                validate_volume_rule(area)?;
            }
        }
    }

    Ok(ValidatedSave {
        name,
        shipping_time,
        is_default,
        is_free,
        pricing_type,
    })
}

/// v5.8.61 体积计费规则校验（对齐 Java `validateVolumeRule`）。
fn validate_volume_rule(rule: &ShippingTplInfoParam) -> Result<(), String> {
    validate_volume_value(rule.start_number, true, 5, 7, "首体积")?;
    validate_volume_value(rule.add_number, true, 5, 7, "续体积")?;
    validate_volume_value(rule.start_price, false, 2, 8, "首费")?;
    validate_volume_value(rule.add_price, false, 2, 8, "续费")?;
    validate_volume_value(rule.free_price, false, 2, 6, "满免金额")?;
    Ok(())
}

fn validate_volume_value(
    value: Option<Decimal>,
    must_be_positive: bool,
    scale: u32,
    integer_digits: u32,
    label: &str,
) -> Result<(), String> {
    let Some(value) = value else {
        return Err(format!(
            "{label}须为{}，最多{integer_digits}位整数、{scale}位小数",
            if must_be_positive {
                "正数"
            } else {
                "非负数"
            }
        ));
    };
    let lower_ok = if must_be_positive {
        value > Decimal::ZERO
    } else {
        value >= Decimal::ZERO
    };
    let upper = Decimal::from(10_i64.pow(integer_digits));
    if !lower_ok || value.normalize().scale() > scale || value >= upper {
        return Err(format!(
            "{label}须为{}，最多{integer_digits}位整数、{scale}位小数",
            if must_be_positive {
                "正数"
            } else {
                "非负数"
            }
        ));
    }
    Ok(())
}

/// [`validate_save`] 的产物（已 trim / 已确认非空）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedSave {
    /// 模板名称（已 trim）
    pub name: String,
    /// 配送时间
    pub shipping_time: String,
    /// 是否默认
    pub is_default: i32,
    /// 是否包邮
    pub is_free: i32,
    /// 计价方式
    pub pricing_type: i32,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::ShippingType;

    fn tpl() -> ShippingTplEntity {
        ShippingTplEntity {
            shipping_tpl_id: 7,
            shipping_time: "1天内".into(),
            shipping_tpl_name: "默认模板".into(),
            is_free: 0,
            pricing_type: 2,
            is_default: 1,
            shop_id: 3,
        }
    }

    fn info(id: i32, is_default: i32) -> ShippingTplInfo {
        ShippingTplInfo {
            id,
            shipping_type_id: 1,
            shipping_tpl_id: 7,
            is_free: 0,
            is_default,
            region_data: Some(r#"{"areaRegions":[[1,360000]],"areaRegionNames":["江西"]}"#.into()),
            start_number: Decimal::new(1, 0),
            start_price: Decimal::new(500, 2),
            add_number: Decimal::new(1, 0),
            add_price: Decimal::new(200, 2),
            free_price: Decimal::new(9900, 2),
            pricing_type: 2,
        }
    }

    // ————————————————————— 常量对照 —————————————————————

    /// Java `ShippingTplController.FIELDS` 逐字符照抄。
    #[test]
    fn fields_matches_java_constant() {
        assert_eq!(
            SHIPPING_TPL_FIELDS,
            ["is_show", "sort_order", "status", "shipping_tpl_name"]
        );
    }

    /// 白名单里**只有 1 个**是 `shipping_tpl` 的真实列。
    #[test]
    fn whitelist_has_three_phantom_columns() {
        let real: Vec<&str> = SHIPPING_TPL_FIELDS
            .iter()
            .copied()
            .filter(|f| SHIPPING_TPL_COLUMNS.contains(f))
            .collect();
        assert_eq!(real, vec!["shipping_tpl_name"]);
        for phantom in ["is_show", "sort_order", "status"] {
            assert!(
                !SHIPPING_TPL_COLUMNS.contains(&phantom),
                "{phantom} 不应是真实列"
            );
            assert!(
                SHIPPING_TPL_FIELDS.contains(&phantom),
                "{phantom} 应在 Java 白名单里"
            );
        }
    }

    /// 列清单与 `schema_parser.py --table shipping_tpl` 的 7 列一致。
    #[test]
    fn columns_match_schema() {
        assert_eq!(
            SHIPPING_TPL_COLUMNS,
            [
                "shipping_tpl_id",
                "shipping_time",
                "shipping_tpl_name",
                "is_free",
                "pricing_type",
                "is_default",
                "shop_id"
            ]
        );
        assert_eq!(SHIPPING_TPL_COLUMNS.len(), 7);
    }

    /// Java 常量文案逐字符照抄。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_SHIPPING_TPL_NOT_FOUND, "该运费模板不存在");
        assert_eq!(MSG_SHIPPING_TPL_NAME_EXISTS, "运费模板名称已存在");
        assert_eq!(MSG_SHIPPING_TYPE_NOT_NULL, "请选择运送方式");
        assert_eq!(MSG_SHIPPING_TPL_NO_PERMISSION, "无权操作该运费模板");
        assert_eq!(MSG_INVALID_FIELD_VALUE, "字段值不合法");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_SHIPPING_TPL_ID_REQUIRED, "模版主键不能为空");
        assert_eq!(MSG_SHIPPING_TPL_NAME_NOT_BLANK, "运费模版名称不能为空");
        assert_eq!(MSG_IS_DEFAULT_NOT_NULL, "是否默认不能为空");
        assert_eq!(MSG_IS_FREE_NOT_NULL, "是否包邮不能为空");
        assert_eq!(MSG_PRICING_TYPE_NOT_NULL, "计价方式不能为空");
    }

    /// Java `Constants.YES / NO`。
    #[test]
    fn yes_no_constants() {
        assert_eq!(YES, 1);
        assert_eq!(NO, 0);
        assert_eq!(DEFAULT_SHIPPING_TYPE_ID, 1);
    }

    // ————————————————————— VO 映射 —————————————————————

    /// `ShippingTplVO::from_entity` 6 个字段一一对应，`shippingTplInfo` 为空。
    #[test]
    fn tpl_vo_from_entity() {
        let vo = ShippingTplVO::from_entity(&tpl());
        assert_eq!(vo.shipping_tpl_id, 7);
        assert_eq!(vo.shipping_time, "1天内");
        assert_eq!(vo.shipping_tpl_name, "默认模板");
        assert_eq!(vo.is_free, 0);
        assert_eq!(vo.pricing_type, 2);
        assert_eq!(vo.is_default, 1);
        assert!(vo.shipping_tpl_info.is_empty());
    }

    /// ⚠️ 复刻 Java 构造器漏赋值：`pricingType` 恒 `None`。
    #[test]
    fn tpl_info_vo_pricing_type_is_none_like_java() {
        let e = info(1, 1);
        let vo = ShippingTplInfoVO::from_entity(&e);
        assert_eq!(vo.pricing_type, None, "Java 构造器漏赋值 ⇒ 恒 null");
        // 意图版本才有值
        let fixed = ShippingTplInfoVO::from_entity_with_pricing_type(&e);
        assert_eq!(fixed.pricing_type, Some(2));
        // 其余字段两者一致
        assert_eq!(vo.start_price, fixed.start_price);
        assert_eq!(vo.region_data, fixed.region_data);
    }

    /// 金额用 `Decimal` 精确承载（`9.90` 而非浮点近似）。
    #[test]
    fn tpl_info_vo_keeps_decimal_precision() {
        let vo = ShippingTplInfoVO::from_entity(&info(1, 1));
        assert_eq!(vo.start_price, Decimal::new(500, 2));
        assert_eq!(vo.add_price, Decimal::new(200, 2));
        assert_eq!(vo.free_price, Decimal::new(9900, 2));
        assert_eq!(vo.start_price.to_string(), "5.00");
        assert_eq!(vo.free_price.to_string(), "99.00");
    }

    /// `region_data` JSON 解析为结构化 `RegionDataVO`。
    #[test]
    fn tpl_info_vo_parses_region_data() {
        let vo = ShippingTplInfoVO::from_entity(&info(1, 1));
        let rd = vo.region_data.expect("应解析出地区数据");
        assert_eq!(rd.area_regions, vec![vec![1_i64, 360000]]);
        assert_eq!(rd.area_region_names, vec!["江西".to_string()]);
    }

    /// `is_default == 1` 进 `defaultTplInfo`，其余进 `areaTplInfo`。
    #[test]
    fn type_vo_splits_default_and_area() {
        let st = ShippingType {
            shipping_type_id: 1,
            shipping_type_name: "快递".into(),
            shipping_default_id: 9,
            shipping_type_desc: "desc".into(),
            shipping_time_desc: "1天内".into(),
            is_support_cod: 1,
            sort_order: 0,
            shop_id: 3,
        };
        let infos = vec![info(1, 1), info(2, 0), info(3, 0)];
        let vo = ShippingTypeVO::from_entity(&st, &infos);
        assert_eq!(vo.shipping_type_id, 1);
        assert_eq!(vo.shipping_type_name.as_deref(), Some("快递"));
        assert_eq!(vo.default_tpl_info.as_ref().unwrap().id, 1);
        assert_eq!(vo.area_tpl_info.len(), 2);
        assert_eq!(vo.area_tpl_info[0].id, 2);
        assert_eq!(vo.area_tpl_info[1].id, 3);
        // Java 该构造函数不查物流公司名
        assert_eq!(vo.logistics_name, None);
    }

    /// `shippingTplInfos` 为空 ⇒ `defaultTplInfo` 与 `areaTplInfo` 都不填
    /// （Java `CollUtil.isNotEmpty` 守卫）。
    #[test]
    fn type_vo_empty_infos_keeps_both_null() {
        let vo = ShippingTypeVO::from_entity(&ShippingType::default(), &[]);
        assert!(vo.default_tpl_info.is_none());
        assert!(vo.area_tpl_info.is_empty());
    }

    /// ⚠️ Java `detail` 用 `new ShippingType()` 空壳：`shippingTypeId = 0`。
    ///
    /// 字段值说明：Java 实体用包装类型（`Long`/`String`），一个**未落库**的
    /// `new ShippingType()` 各字段是 `null`。Rust 实体字段对应库中 NOT NULL
    /// 列，故是 `i32`/`String`，`Default` 得到 `0`/`""`；`from_entity` 用
    /// `Some(...)` 包裹即忠实映射「有值」。
    /// 因此 `shipping_type_name` 是 `Some("")` 而非 `None`——差异只源于
    /// 「Java 未初始化对象 vs Rust 零值」的类型系统差别，JSON 上
    /// `""` 与 `null` 对前端的「空名称」判断等价。
    #[test]
    fn detail_shell_type_has_zero_id() {
        let vo = ShippingTypeVO::empty_shell(&[info(1, 1)]);
        assert_eq!(vo.shipping_type_id, 0, "Java detail 返回的配送类型是空壳");
        assert_eq!(vo.shipping_type_name.as_deref(), Some(""));
        assert_eq!(vo.shop_id, Some(0));
        assert_eq!(vo.default_tpl_info.as_ref().unwrap().id, 1);
        assert!(vo.area_tpl_info.is_empty());
    }

    // ————————————————————— 入参：校验 —————————————————————

    /// `validate_save` 必填校验与 trim。
    #[test]
    fn validate_save_rules() {
        let ok: ShippingTplSaveDTO = serde_json::from_str(
            r#"{"shippingTplName":"  默认模板 ","shippingTime":"1天内","isDefault":0,"isFree":0,"pricingType":1}"#,
        )
        .unwrap();
        let v = validate_save(&ok).unwrap();
        assert_eq!(v.name, "默认模板");
        assert_eq!(v.shipping_time, "1天内");
        assert_eq!(v.is_default, 0);
        assert_eq!(v.is_free, 0);
        assert_eq!(v.pricing_type, 1);

        let blank: ShippingTplSaveDTO = serde_json::from_str(
            r#"{"shippingTplName":"  ","isDefault":0,"isFree":0,"pricingType":1}"#,
        )
        .unwrap();
        assert_eq!(
            validate_save(&blank).unwrap_err(),
            MSG_SHIPPING_TPL_NAME_NOT_BLANK
        );

        let no_default: ShippingTplSaveDTO =
            serde_json::from_str(r#"{"shippingTplName":"x","isFree":0,"pricingType":1}"#).unwrap();
        assert_eq!(
            validate_save(&no_default).unwrap_err(),
            MSG_IS_DEFAULT_NOT_NULL
        );

        let no_free: ShippingTplSaveDTO =
            serde_json::from_str(r#"{"shippingTplName":"x","isDefault":0,"pricingType":1}"#)
                .unwrap();
        assert_eq!(validate_save(&no_free).unwrap_err(), MSG_IS_FREE_NOT_NULL);

        let no_pricing: ShippingTplSaveDTO =
            serde_json::from_str(r#"{"shippingTplName":"x","isDefault":0,"isFree":0}"#).unwrap();
        assert_eq!(
            validate_save(&no_pricing).unwrap_err(),
            MSG_PRICING_TYPE_NOT_NULL
        );

        // 名称恰好 120 字符合法，121 报错
        let edge = ShippingTplSaveDTO {
            shipping_tpl_name: Some("名".repeat(120)),
            is_default: Some(0),
            is_free: Some(0),
            pricing_type: Some(1),
            ..Default::default()
        };
        assert!(validate_save(&edge).is_ok());
        let over = ShippingTplSaveDTO {
            shipping_tpl_name: Some("名".repeat(121)),
            ..edge.clone()
        };
        assert!(validate_save(&over).is_err());
    }

    /// ⚠️ `create` 用 `isChecked == 1`；`update` 用 `isChecked > 0` —— 两者不一致。
    #[test]
    fn is_checked_semantics_differ_between_create_and_update() {
        let mk = |v: Option<i32>| ShippingTypeParam {
            is_checked: v,
            ..Default::default()
        };

        // create 口径：必须恰为 1
        assert!(mk(Some(1)).is_checked_yes());
        assert!(!mk(Some(2)).is_checked_yes());
        assert!(!mk(Some(0)).is_checked_yes());
        assert!(!mk(None).is_checked_yes());
        assert!(!mk(Some(-1)).is_checked_yes());

        // update 口径：> 0 即可
        assert!(mk(Some(1)).is_checked_positive());
        assert!(mk(Some(2)).is_checked_positive());
        assert!(mk(Some(99)).is_checked_positive());
        assert!(!mk(Some(0)).is_checked_positive());
        assert!(!mk(Some(-3)).is_checked_positive());
        // Java 在此处会 NPE；本实现视为不满足
        assert!(!mk(None).is_checked_positive());
    }

    /// `wants_default` 只在 `isDefault == 1` 时为真（`Constants.YES.equals`）。
    #[test]
    fn wants_default_only_on_yes() {
        let mk = |v: Option<i32>| ShippingTplUpdateDTO {
            is_default: v,
            ..Default::default()
        };
        assert!(mk(Some(1)).wants_default());
        assert!(!mk(Some(0)).wants_default());
        assert!(!mk(Some(2)).wants_default());
        assert!(!mk(None).wants_default());
    }

    /// `effective_name` 忽略空白名（Java `StrUtil.isNotBlank` 守卫）。
    #[test]
    fn effective_name_ignores_blank() {
        let dto = ShippingTplUpdateDTO {
            shipping_tpl_name: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(dto.effective_name(), None);
        let dto = ShippingTplUpdateDTO {
            shipping_tpl_name: Some(" A ".into()),
            ..Default::default()
        };
        assert_eq!(dto.effective_name(), Some("A"));
    }

    // ————————————————————— 行构造（create 语义） —————————————————————

    /// 默认行的 `shippingTypeId`/`isFree`/`pricingType` 都取自**模板**，`isDefault = 1`。
    #[test]
    fn default_row_uses_template_fields() {
        let p: ShippingTypeParam = serde_json::from_str(
            r#"{"shippingTypeId":99,"isChecked":1,
                "defaultTplInfo":{"startNumber":1,"startPrice":5.00,"addNumber":1,
                "addPrice":2.00,"freePrice":99.00,
                "regionData":{"areaRegions":[[1,360000]],"areaRegionNames":["江西"]}},
                "areaTplInfo":[]}"#,
        )
        .unwrap();
        let t = tpl();
        let row = p.default_info_row(&t).expect("应有默认行");
        // 写死 1，忽略入参 99
        assert_eq!(row.shipping_type_id, DEFAULT_SHIPPING_TYPE_ID);
        assert_eq!(row.shipping_tpl_id, 7);
        // isFree / pricingType 取自模板
        assert_eq!(row.is_free, t.is_free);
        assert_eq!(row.pricing_type, t.pricing_type);
        assert_eq!(row.is_default, YES);
        assert_eq!(row.start_price, Decimal::new(500, 2));
        assert_eq!(row.add_price, Decimal::new(200, 2));
        assert_eq!(row.free_price, Decimal::new(9900, 2));
        assert_eq!(
            row.region_data.as_deref(),
            Some(r#"{"areaRegions":[[1,360000]],"areaRegionNames":["江西"]}"#)
        );
    }

    /// 区域行 `isDefault = 0`，且保持入参顺序。
    #[test]
    fn area_rows_are_not_default_and_keep_order() {
        let p: ShippingTypeParam = serde_json::from_str(
            r#"{"isChecked":1,
                "defaultTplInfo":{"startPrice":5.00},
                "areaTplInfo":[{"startPrice":1.00,"regionData":{"areaRegions":[[1,1]]}},
                               {"startPrice":2.00,"regionData":{"areaRegions":[[1,2]]}}]}"#,
        )
        .unwrap();
        let t = tpl();
        let rows = p.info_rows(&t);
        assert_eq!(rows.len(), 3, "1 条默认 + 2 条区域");
        assert_eq!(rows[0].is_default, YES);
        assert_eq!(rows[1].is_default, NO);
        assert_eq!(rows[1].start_price, Decimal::new(100, 2));
        assert_eq!(rows[2].is_default, NO);
        assert_eq!(rows[2].start_price, Decimal::new(200, 2));
        assert!(rows.iter().all(|r| r.shipping_type_id == 1));
    }

    /// 缺 `defaultTplInfo` ⇒ 该配送类型整体不产出行（对应 Java 的 NPE 场景）。
    #[test]
    fn missing_default_tpl_info_yields_no_rows() {
        let p = ShippingTypeParam {
            is_checked: Some(1),
            ..Default::default()
        };
        assert!(p.info_rows(&tpl()).is_empty());
    }

    /// 缺 `areaTplInfo` ⇒ 只有默认行，不 panic（Java 此处会 NPE）。
    #[test]
    fn missing_area_tpl_info_is_treated_as_empty() {
        let p: ShippingTypeParam =
            serde_json::from_str(r#"{"defaultTplInfo":{"startPrice":5.00}}"#).unwrap();
        let rows = p.info_rows(&tpl());
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].is_default, YES);
    }

    // ————————————————————— JSON 往返 —————————————————————

    /// `region_data` 序列化 → 解析往返一致。
    #[test]
    fn region_data_round_trip() {
        let p = RegionDataParam {
            area_regions: vec![vec![1, 360000], vec![1, 360000, 360100]],
            area_region_names: vec!["江西".into(), "南昌".into()],
        };
        let s = serialize_region_data(Some(&p)).unwrap();
        assert_eq!(
            parse_region_data(Some(&s)),
            Some(RegionDataVO {
                area_regions: vec![vec![1, 360000], vec![1, 360000, 360100]],
                area_region_names: vec!["江西".into(), "南昌".into()],
            })
        );
    }

    /// `None` / 空串 / 非法 JSON 都不解析（Java 有 `isNotBlank` 守卫）。
    #[test]
    fn parse_region_data_guards() {
        assert_eq!(parse_region_data(None), None);
        assert_eq!(parse_region_data(Some("")), None);
        assert_eq!(parse_region_data(Some("   ")), None);
        assert_eq!(parse_region_data(Some("not json")), None);
        assert_eq!(serialize_region_data(None), None);
    }

    /// 查询参数按 Java camelCase 反序列化。
    #[test]
    fn dtos_deserialize_java_camel_case() {
        let q: ShippingTplListQuery =
            serde_json::from_str(r#"{"isShow":1,"keyword":"默认","page":2,"size":30,"sortField":"shippingTplName","sortOrder":"asc"}"#)
                .unwrap();
        assert_eq!(q.is_show, Some(1));
        assert_eq!(q.effective_keyword(), Some("默认"));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);

        let d: DetailQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(d.id, Some(5));

        let s: SetDefaultQuery = serde_json::from_str(r#"{"id":5}"#).unwrap();
        assert_eq!(s.id, Some(5));
    }

    /// 金额字段同时接受 JSON 数字与数字字符串。
    ///
    /// ⚠️ 本仓库 `rust_decimal` 开了 `serde-with-str`，`Decimal` 默认只收字符串；
    /// 前端（Java 契约）发的是裸数字，故必须有 `de_opt_dec` 兼容，否则直接 400。
    #[test]
    fn decimal_accepts_number_and_string() {
        // 裸数字（前端实际写法）
        let p: ShippingTplInfoParam = serde_json::from_str(
            r#"{"startPrice":5.00,"addPrice":2,"freePrice":99.9,
                "startNumber":1,"addNumber":1.5}"#,
        )
        .unwrap();
        assert_eq!(p.start_price, Some(Decimal::new(500, 2)));
        assert_eq!(p.add_price, Some(Decimal::new(2, 0)));
        assert_eq!(p.free_price, Some(Decimal::new(999, 1)));
        assert_eq!(p.start_number, Some(Decimal::new(1, 0)));
        assert_eq!(p.add_number, Some(Decimal::new(15, 1)));

        // 数字字符串（同样必须支持）
        let p: ShippingTplInfoParam =
            serde_json::from_str(r#"{"startPrice":"5.00","addPrice":"2","freePrice":"99.9"}"#)
                .unwrap();
        assert_eq!(p.start_price, Some(Decimal::new(500, 2)));
        assert_eq!(p.add_price, Some(Decimal::new(2, 0)));
        assert_eq!(p.free_price, Some(Decimal::new(999, 1)));

        // 缺键 / null / 空串 ⇒ 未提供
        let p: ShippingTplInfoParam =
            serde_json::from_str(r#"{"startPrice":null,"addPrice":"","freePrice":"  "}"#).unwrap();
        assert_eq!(p.start_price, None);
        assert_eq!(p.add_price, None);
        assert_eq!(p.free_price, None);
        assert_eq!(ShippingTplInfoParam::default().start_price, None);

        // 非数字字符串应报错（不静默吞掉）
        assert!(serde_json::from_str::<ShippingTplInfoParam>(r#"{"startPrice":"abc"}"#).is_err());
    }

    /// 端到端：`create` 请求体的完整 JSON 能解析出金额与嵌套结构。
    #[test]
    fn save_dto_deserializes_full_payload() {
        let dto: ShippingTplSaveDTO = serde_json::from_str(
            r#"{
                "shippingTplName":"默认模板",
                "shippingTime":"1天内",
                "isDefault":1,
                "isFree":0,
                "pricingType":2,
                "shippingTplInfo":[{
                    "shippingTypeId":1,
                    "isChecked":1,
                    "defaultTplInfo":{
                        "startNumber":1,"startPrice":5.00,
                        "addNumber":1,"addPrice":2.00,"freePrice":99.00,
                        "regionData":{"areaRegions":[[1,360000]],"areaRegionNames":["江西"]}
                    },
                    "areaTplInfo":[
                        {"startPrice":1.00,"regionData":{"areaRegions":[[1,1]]}}
                    ]
                }]
            }"#,
        )
        .unwrap();
        assert_eq!(dto.shipping_tpl_name.as_deref(), Some("默认模板"));
        assert_eq!(dto.is_default, Some(1));
        let params = dto.shipping_tpl_info.as_ref().unwrap();
        assert_eq!(params.len(), 1);
        assert!(params[0].is_checked_yes());
        let d = params[0].default_tpl_info.as_ref().unwrap();
        assert_eq!(d.start_price, Some(Decimal::new(500, 2)));
        assert_eq!(d.free_price, Some(Decimal::new(9900, 2)));
        let rd = d.region_data.as_ref().unwrap();
        assert_eq!(rd.area_regions, vec![vec![1_i64, 360000]]);
        assert_eq!(params[0].area_tpl_info.as_ref().unwrap().len(), 1);
    }

    /// `UpdateFieldDTO` / `BatchDTO` / `OperateDTO` 反序列化。
    #[test]
    fn common_dtos_deserialize() {
        let u: UpdateFieldDTO =
            serde_json::from_str(r#"{"id":1,"field":"shipping_tpl_name","val":"新名"}"#).unwrap();
        assert_eq!(u.id, Some(1));
        assert_eq!(u.field.as_deref(), Some("shipping_tpl_name"));

        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del","value":0}"#).unwrap();
        assert_eq!(b.r#type, "del");
        assert_eq!(b.ids, vec![1, 2]);

        let o: OperateDTO = serde_json::from_str(r#"{"adminNote":"x"}"#).unwrap();
        assert_eq!(o.id, None);
    }

    // ————————————————————— 排序 —————————————————————

    /// Java `buildSortOrder` 三分支。
    #[test]
    fn order_clause_three_branches() {
        let q = ShippingTplListQuery {
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY shipping_tpl_id ASC");

        let q = ShippingTplListQuery {
            sort_order: None,
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY shipping_tpl_id DESC");

        let q = ShippingTplListQuery {
            sort_order: Some("desc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY shipping_tpl_id DESC");

        // 非法值：Java else-if 未覆盖 ⇒ 无排序
        let q = ShippingTplListQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    /// 属性名 / 列名都能映射；未识别回退主键（防注入）。
    #[test]
    fn order_column_mapping() {
        let q = ShippingTplListQuery {
            sort_field: Some("shippingTplName".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY shipping_tpl_name ASC");

        let q = ShippingTplListQuery {
            sort_field: Some("is_default".into()),
            sort_order: Some("DESC".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY is_default DESC");

        let q = ShippingTplListQuery {
            sort_field: Some("1; DROP TABLE shipping_tpl".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY shipping_tpl_id ASC");
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }

    /// 分页默认值（Java `BasePage`：page 1 / size 15）。
    #[test]
    fn page_query_defaults() {
        let q = ShippingTplListQuery::default();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15);
        let q = ShippingTplListQuery {
            size: Some(500),
            ..Default::default()
        };
        assert_eq!(q.page_query().page_size, 100);
    }

    /// `updateField` 归一：真实列可命中，幻觉列不行。
    #[test]
    fn update_field_column_normalization() {
        assert_eq!(
            map_update_field_column("shippingTplName"),
            Some("shipping_tpl_name")
        );
        assert_eq!(
            map_update_field_column("shipping_tpl_name"),
            Some("shipping_tpl_name")
        );
        assert_eq!(map_update_field_column("isFree"), Some("is_free"));
        assert_eq!(map_update_field_column("isDefault"), Some("is_default"));
        // Java 白名单里但库里没有的列
        assert_eq!(map_update_field_column("is_show"), None);
        assert_eq!(map_update_field_column("sort_order"), None);
        assert_eq!(map_update_field_column("status"), None);
        assert_eq!(map_update_field_column("nope"), None);
    }
}
