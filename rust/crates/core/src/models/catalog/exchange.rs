//! 积分兑换域（catalog::exchange）DTO / VO / 查询参数 + 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.product.ExchangeController`
//!   （`@RequestMapping("/api/product/exchange")`，3 个端点，`auth=optional`）
//! - `com.tigshop.service.promotion.impl.PointsExchangeServiceImpl#detail` /
//!   `#list`（本文件只迁移客户端用到的两个读方法）
//! - `com.tigshop.bean.dto.promotion.PointsExchangeListDTO`
//! - `com.tigshop.bean.vo.promotion.PointsExchangeVO`
//! - `com.tigshop.bean.model.promotion.PointsExchange`（表 `points_exchange`）
//! - `com.tigshop.bean.dto.cart.AddToCartDTO`（本文件只保留兑换用到的 3 个字段）
//! - `com.tigshop.bean.vo.product.ExchangeProductToCartVO`
//! - `com.tigshop.bean.enums.cart.CartTypeEnum#TYPE_EXCHANGE`
//! - `com.tigshop.service.product.impl.ProductSkuServiceImpl#checkSkuEnabled` /
//!   `#getProductStock`
//! - `com.tigshop.common.utils.SecurityUtils#getCurrentUserId`（游客返回 0）
//!
//! # 端点（3 条，全部是 `/api` 公开接口，auth=optional）
//!
//! | method | path | 原 Java | 落点（services 层） |
//! |--------|------|---------|---------------------|
//! | `GET`  | `/api/product/exchange/detail` | `ExchangeController.detail` | `ExchangeService::detail` |
//! | `GET`  | `/api/product/exchange/list` | `ExchangeController.list` | `ExchangeService::list` |
//! | `POST` | `/api/product/exchange/addToCart` | `ExchangeController.addExchangeProductToCart` | `ExchangeService::add_to_cart` |
//!
//! # 表 / 列（权威来源 `java/database/pure.sql`）
//!
//! 用 `cd rust && python tools/schema_parser.py --table points_exchange` 核对：
//! `id` / `product_id` / `exchange_integral` / `points_deducted_amount` /
//! `is_hot` / `is_enabled` / `sku_id`（7 列，`sku_id` 可空、默认 0）。
//!
//! # 语义要点（逐条对照 Java 源）
//!
//! - `list`：控制器**强制** `isEnabled = 1`；服务层再叠加
//!   `product_status=1 AND is_delete=0` 的商品有效过滤（Java 用 innerJoin /
//!   商品 ID 子查询，净效果相同）、`isHot`、`keyword`（商品名 LIKE）、
//!   以及「SKU 启用或未指定 SKU」条件；商品平铺字段（名称/图/价/库存/销量/
//!   SN）回填，SKU 价优先于商品价，`discountsPrice = productPrice -
//!   pointsDeductedAmount`。
//! - `detail`：先取积分活动 VO（含商品与 SKU 价），校验 SKU 可用，再取
//!   商品前台详情（复用 `catalog::product_manage::ProductManageService::
//!   client_detail`），把 `skuList` 收敛到本次活动 SKU，按 Java `filterSpe`
//!   过滤规格属性，最后把活动 VO 写入 `exchangeInfo`。
//! - `addToCart`：活动存在 / 生效 → SKU 可用 → 商品存在且上架未删 →
//!   库存足够 → 会员积分足够（游客 `userId=0`，积分按 0 处理）→ 清空该用户
//!   兑换类购物车（`type=3`）→ 写入一条兑换购物车行。
//!
//! # 与 Java 的差异（`uncertain_points`）
//!
//! 1. **购物车写入**：Java 委托 `CartServiceImpl#addProductToCart`（含实名
//!    认证、店铺营业状态、促销/秒杀价、快速购买行清理等 100+ 行逻辑）；Rust
//!    `trade::cart::CartService` 是精简实现（无购物车 `type` 维度）。本实现
//!    按兑换场景直接写 `cart` 表：先删该用户 `type = TYPE_EXCHANGE(3)` 的行
//!    （含 `cart_global_change_price`），再插入一条 `type = 3` 的兑换行；
//!    其余 Java 侧校验（实名 / 店铺状态 / 促销价）未迁移。
//! 2. **库存**：Java `getProductStock` 对「周期购」返回上限、对「卡密商品」
//!    按卡密库存计数；本实现只取 `product.product_stock` / `product_sku.
//!    sku_stock`（普通商品口径），特殊商品类型未迁移。
//! 3. **活动不存在**：Java 控制器里 `pointsExchangeService.detail(id)` 对
//!    不存在的 id 会 NPE（HTTP 500）；`addToCart` 则显式抛 `活动不存在`。
//!    本实现三处统一返回业务错误 `活动不存在`（文案取自 addToCart）。
//! 4. **详情返回结构**：Java 返回完整 `ProductDetailVO`；Rust 复用既有
//!    `ClientProductDetailVO`，其 `exchangeInfo` 字段类型为
//!    `serde_json::Value`，正好承载本域 `PointsExchangeVO`。
//! 5. `PointsExchangeVO.costPrice` Java 侧从未赋值（恒 `null`），本实现同样
//!    恒为 `null`（保留字段以对齐 JSON 契约）。
//!
//! # 金额
//!
//! `points_deducted_amount`（`decimal(8,2)`）、商品/SKU 价格均为
//! `rust_decimal::Decimal`；与既有商品域一致。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use super::product_manage::{ProductAttrGroupVO, ProductAttrsVO, ProductSkuVO};

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java / schema）
// ——————————————————————————————————————————————

/// 购物车类型：兑换商品（Java `CartTypeEnum.TYPE_EXCHANGE.getCode()`）。
pub const CART_TYPE_EXCHANGE: i32 = 3;

/// 通用「是」标记（Java `Constants.YES`）。
pub const YES: i32 = 1;

/// 列表默认每页条数（Java `BasePage#getSize()`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;

/// 列表每页条数上限（Java `BasePage#getSize()`）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// Java `ExchangeController#addExchangeProductToCart`：活动不存在。
pub const MSG_ACTIVITY_NOT_EXIST: &str = "活动不存在";

/// Java `ExchangeController#addExchangeProductToCart`：活动已下架。
pub const MSG_ACTIVITY_OFF_SHELF: &str = "活动已下架";

/// Java `ProductSkuServiceImpl#checkSkuEnabled`：SKU 不存在或未启用。
pub const MSG_SKU_DISABLED: &str = "商品规格已禁用，请重新选择";

/// Java `ExchangeController#addExchangeProductToCart`：积分商品缺失。
pub const MSG_EXCHANGE_PRODUCT_NOT_FOUND: &str = "未找到兑换商品";

/// Java `ExchangeController#addExchangeProductToCart`：商品下架 / 已删。
pub const MSG_PRODUCT_NOT_EXIST: &str = "商品不存在";

/// Java `ExchangeController#addExchangeProductToCart`：库存不足。
pub const MSG_STOCK_NOT_ENOUGH: &str = "库存不足";

/// Java `ExchangeController#addExchangeProductToCart`：积分不足。
pub const MSG_POINTS_NOT_ENOUGH: &str = "您的积分不足";

/// Java `AddToCartDTO.id` 的 `@NotNull(message = "id不能为空")`。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `AddToCartDTO.number` 的 `@NotNull(message = "数量不能为空")`。
pub const MSG_NUMBER_REQUIRED: &str = "数量不能为空";

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// 积分兑换列表查询参数（Java `PointsExchangeListDTO extends BasePage`）。
///
/// 注意：Java 控制器在调用服务前**强制** `setIsEnabled(Constants.YES)`，
/// 因此「是否生效」条件恒为 `= 1`；`productName` 字段在服务实现里
/// **未被使用**（真正生效的是 `BasePage.keyword`），故不迁移。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PointsExchangeListQuery {
    /// 是否热门 1 是 0 否
    pub is_hot: Option<i32>,
    /// 是否生效 1 是 0 否（控制器强制 1）
    pub is_enabled: Option<i32>,
    /// 关键词（匹配商品名称）
    pub keyword: Option<String>,
    /// 页码，缺省 1
    pub page: Option<u64>,
    /// 每页条数（缺省 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（Java 实体属性名或数据库列名，未知回退主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序）
    pub sort_order: Option<String>,
}

/// 积分兑换详情查询参数
/// （Java `@RequestParam("id") Integer productId` +
/// `@RequestParam(value="shopId", required=false)` +
/// `@RequestParam(value="nearestShopId", required=false)`）。
///
/// ⚠️ Java 形参名叫 `productId`，但实际传的是**积分活动 ID**（`points_exchange.id`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ExchangeDetailQuery {
    /// 积分活动 ID（Java `@RequestParam("id")`，必填）
    pub id: Option<i32>,
    /// 门店上下文（O2O，未迁移，仅透传）
    pub shop_id: Option<i32>,
    /// 最近门店（O2O，未迁移，仅透传）
    pub nearest_shop_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 入参 / 出参
// ——————————————————————————————————————————————

/// 积分兑换活动 VO（Java `PointsExchangeVO`）。
///
/// 前 7 个字段来自 `points_exchange` 行；其余为商品 / SKU 平铺字段
/// （Java 由 `BeanUtils.copyProperties` + 手工回填）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PointsExchangeVO {
    /// 积分商品 ID
    pub id: i32,
    /// 商品 ID
    pub product_id: i32,
    /// 所需积分
    pub exchange_integral: i32,
    /// 积分抵扣金额
    pub points_deducted_amount: Decimal,
    /// 是否热门
    pub is_hot: i32,
    /// 是否生效
    pub is_enabled: i32,
    /// 规格 ID（0 / null 表示 SPU 维度）
    pub sku_id: Option<i32>,
    /// 商品名称
    pub product_name: Option<String>,
    /// 商品缩略图
    pub pic_thumb: Option<String>,
    /// 商品图
    pub pic_url: Option<String>,
    /// 市场价（划线价）
    pub market_price: Option<Decimal>,
    /// 成本价（Java 侧从未赋值，恒 `null`）
    pub cost_price: Option<Decimal>,
    /// 商品价格（SKU 价优先）
    pub product_price: Option<Decimal>,
    /// 折后价格 = `productPrice - pointsDeductedAmount`
    pub discounts_price: Option<Decimal>,
    /// 商品库存
    pub product_stock: Option<i32>,
    /// 虚拟销量
    pub virtual_sales: Option<i32>,
    /// 商品编号
    pub product_sn: Option<String>,
}

/// 加入兑换购物车请求（Java `AddToCartDTO` 的兑换子集）。
///
/// Java 侧该 DTO 还有 `type` / `skuItem` / `salesmanId` 等 20+ 字段；
/// 兑换接口只读取 `id`（活动 ID）/ `number` / `skuId`，其余字段 serde 忽略。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddToCartDTO {
    /// 积分活动 ID（Java `@NotNull(message = "id不能为空")`）
    pub id: Option<i32>,
    /// 数量（Java `@NotNull(message = "数量不能为空")`）
    pub number: Option<i32>,
    /// 商品规格 ID（可空；空按 0 处理）
    pub sku_id: Option<i32>,
}

/// 加入兑换购物车响应（Java `ExchangeProductToCartVO`）。
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangeProductToCartVO {
    /// 是否成功
    pub item: bool,
    /// 购物车类型（恒 [`CART_TYPE_EXCHANGE`]）
    pub flow_type: i32,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 校验「加入兑换购物车」入参（Java `@Valid AddToCartDTO` 等价物）。
///
/// 返回 `(活动 ID, 数量)`。
///
/// # Errors
/// 返回与 Java 注解 `message` 逐字符一致的文案。
pub fn validate_add_to_cart(dto: &AddToCartDTO) -> std::result::Result<(i32, i32), String> {
    let id = dto.id.ok_or_else(|| MSG_ID_REQUIRED.to_string())?;
    let number = dto.number.ok_or_else(|| MSG_NUMBER_REQUIRED.to_string())?;
    Ok((id, number))
}

/// 规格 ID 归一（Java：`skuId != null ? skuId : 0`）。
#[must_use]
pub fn normalize_sku_id(raw: Option<i32>) -> i32 {
    raw.unwrap_or(0)
}

/// 有效商品价（Java `PointsExchangeVO` 回填口径）：
///
/// - 活动指定了 `skuId > 0` 且**命中了 SKU 行** → 用 SKU 价（SKU 价本身
///   可能为 `null`，Java 会把它覆盖成 `null`）
/// - 否则 → 商品价
///
/// `sku_found` 必须区分「SKU 行不存在」与「SKU 存在但 `sku_price` 为
/// `null`」：前者 Java 保留商品价，后者 Java 覆盖成 `null`。
#[must_use]
pub fn effective_product_price(
    product_price: Option<Decimal>,
    sku_found: bool,
    sku_price: Option<Decimal>,
) -> Option<Decimal> {
    if sku_found {
        sku_price
    } else {
        product_price
    }
}

/// 折后价格（Java：`productPrice != null ? productPrice - deducted : 0`）。
#[must_use]
pub fn discounts_price(product_price: Option<Decimal>, deducted: Decimal) -> Decimal {
    product_price.map(|p| p - deducted).unwrap_or(Decimal::ZERO)
}

/// 把商品详情的规格列表收敛到本次活动指定的 SKU
/// （Java `productDetailVO.getSkuList().stream().filter(sku ->
/// sku.getSkuId().equals(pointsExchange.getSkuId()))`）。
///
/// ⚠️ `sku_id` 为 `None` 时过滤结果为空列表（Java 的 `equals(null)` 恒
/// `false`），这是与 Java 一致的语义。
pub fn retain_exchange_sku(sku_list: &mut Vec<ProductSkuVO>, sku_id: Option<i32>) {
    sku_list.retain(|sku| Some(sku.sku_id) == sku_id);
}

/// 过滤规格属性（逐行复刻 Java `ExchangeController#filterSpe`）。
///
/// 1. 收集（已收敛的）`skuList` 中全部 `"属性名:属性值"` 组合
///    （来源 `sku_data` JSON 数组元素的 `name` / `value`）
/// 2. 对 `attr_list.spe` 的每个属性组，只保留 `"attrName:attrValue"`
///    命中的属性值；过滤后为空的属性组**整组丢弃**
///
/// 前置条件与 Java 相同：`sku_list` 为空或 `spe` 为空时**不修改**
/// `attr_list`。
pub fn filter_spe(sku_list: &[ProductSkuVO], attr_list: &mut ProductAttrsVO) {
    if sku_list.is_empty() {
        return;
    }
    if attr_list.spe.is_empty() {
        return;
    }
    let mut sku_attr_set: std::collections::HashSet<String> = std::collections::HashSet::new();
    for sku in sku_list {
        let Some(data) = sku.sku_data.as_ref().and_then(serde_json::Value::as_array) else {
            continue;
        };
        for item in data {
            let name = item.get("name").and_then(serde_json::Value::as_str);
            let value = item.get("value").and_then(serde_json::Value::as_str);
            if let (Some(name), Some(value)) = (name, value) {
                sku_attr_set.insert(format!("{name}:{value}"));
            }
        }
    }
    let new_spe: Vec<ProductAttrGroupVO> = attr_list
        .spe
        .iter()
        .filter_map(|group| {
            let filtered: Vec<_> = group
                .attr_list
                .iter()
                .filter(|attr| {
                    sku_attr_set.contains(&format!("{}:{}", group.attr_name, attr.attr_value))
                })
                .cloned()
                .collect();
            if filtered.is_empty() {
                None
            } else {
                Some(ProductAttrGroupVO {
                    attr_name: group.attr_name.clone(),
                    attr_list: filtered,
                })
            }
        })
        .collect();
    attr_list.spe = new_spe;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::catalog::product_manage::ProductAttributeVO;

    fn price(s: &str) -> Decimal {
        s.parse().unwrap()
    }

    /// 折后价与有效价口径逐条对齐 Java。
    #[test]
    fn price_rules_match_java() {
        // SKU 行命中 → SKU 价优先
        assert_eq!(
            effective_product_price(Some(price("100")), true, Some(price("88"))),
            Some(price("88"))
        );
        // SKU 行命中但 sku_price 为 NULL → Java 覆盖成 null
        assert_eq!(
            effective_product_price(Some(price("100")), true, None),
            None
        );
        // SKU 未命中 / 活动未指定 SKU → 商品价
        assert_eq!(
            effective_product_price(Some(price("100")), false, Some(price("88"))),
            Some(price("100"))
        );
        // 折后价 = 有效价 - 抵扣金额
        assert_eq!(
            discounts_price(Some(price("100")), price("20")),
            price("80")
        );
        // 无价格 → 0（Java `BigDecimal.ZERO`）
        assert_eq!(discounts_price(None, price("20")), Decimal::ZERO);
    }

    /// 入参校验文案逐字符对齐 Java `@NotNull`。
    #[test]
    fn add_to_cart_validation_messages_are_verbatim() {
        let mut dto = AddToCartDTO::default();
        assert_eq!(validate_add_to_cart(&dto).unwrap_err(), MSG_ID_REQUIRED);
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        dto.id = Some(5);
        assert_eq!(validate_add_to_cart(&dto).unwrap_err(), MSG_NUMBER_REQUIRED);
        assert_eq!(MSG_NUMBER_REQUIRED, "数量不能为空");
        dto.number = Some(2);
        assert_eq!(validate_add_to_cart(&dto).unwrap(), (5, 2));
    }

    /// SKU 归一：null → 0（Java 三元表达式）。
    #[test]
    fn sku_id_normalization() {
        assert_eq!(normalize_sku_id(None), 0);
        assert_eq!(normalize_sku_id(Some(0)), 0);
        assert_eq!(normalize_sku_id(Some(7)), 7);
        assert_eq!(CART_TYPE_EXCHANGE, 3);
    }

    fn sku(id: i32, data: serde_json::Value) -> ProductSkuVO {
        ProductSkuVO {
            sku_id: id,
            sku_data: Some(data),
            ..Default::default()
        }
    }

    fn attr_group(name: &str, values: &[&str]) -> ProductAttrGroupVO {
        ProductAttrGroupVO {
            attr_name: name.to_string(),
            attr_list: values
                .iter()
                .map(|v| ProductAttributeVO {
                    attr_name: name.to_string(),
                    attr_value: (*v).to_string(),
                    ..Default::default()
                })
                .collect(),
        }
    }

    /// `filterSpe`：只保留 SKU 中出现的「属性名:属性值」组合，空组丢弃。
    #[test]
    fn filter_spe_keeps_only_sku_values() {
        let skus = vec![
            sku(
                11,
                serde_json::json!([
                    {"name": "颜色", "value": "红色"},
                    {"name": "尺码", "value": "XL"}
                ]),
            ),
            sku(
                12,
                serde_json::json!([
                    {"name": "颜色", "value": "蓝色"},
                    {"name": "尺码", "value": "XL"}
                ]),
            ),
        ];
        let mut attrs = ProductAttrsVO {
            spe: vec![
                attr_group("颜色", &["红色", "蓝色", "绿色"]),
                attr_group("尺码", &["XL", "XXL"]),
                attr_group("材质", &["棉", "涤纶"]),
            ],
            ..Default::default()
        };
        filter_spe(&skus, &mut attrs);
        assert_eq!(attrs.spe.len(), 2, "没有 SKU 命中的「材质」组应被丢弃");
        assert_eq!(attrs.spe[0].attr_name, "颜色");
        assert_eq!(
            attrs.spe[0]
                .attr_list
                .iter()
                .map(|a| a.attr_value.as_str())
                .collect::<Vec<_>>(),
            vec!["红色", "蓝色"]
        );
        assert_eq!(attrs.spe[1].attr_name, "尺码");
        assert_eq!(attrs.spe[1].attr_list.len(), 1);
    }

    /// `filterSpe`：sku_list 为空 / spe 为空时不修改（Java 提前 return）。
    #[test]
    fn filter_spe_noop_on_empty_inputs() {
        let mut attrs = ProductAttrsVO {
            spe: vec![attr_group("颜色", &["红色"])],
            ..Default::default()
        };
        filter_spe(&[], &mut attrs);
        assert_eq!(attrs.spe.len(), 1);

        let skus = vec![sku(11, serde_json::json!([{"name":"颜色","value":"红色"}]))];
        let mut empty = ProductAttrsVO::default();
        filter_spe(&skus, &mut empty);
        assert!(empty.spe.is_empty());
    }

    /// `retain_exchange_sku`：只留活动 SKU；活动未指定 SKU → 清空。
    #[test]
    fn retain_exchange_sku_matches_java_filter() {
        let mut skus = vec![
            sku(11, serde_json::json!([])),
            sku(12, serde_json::json!([])),
        ];
        retain_exchange_sku(&mut skus, Some(12));
        assert_eq!(skus.len(), 1);
        assert_eq!(skus[0].sku_id, 12);

        let mut skus2 = vec![sku(11, serde_json::json!([]))];
        retain_exchange_sku(&mut skus2, None);
        assert!(skus2.is_empty(), "Java equals(null) 恒 false → 空列表");
    }

    /// 列表查询：camelCase + `size` 双写法；详情查询 `id` 必填语义。
    #[test]
    fn queries_parse_camel_case() {
        let q: PointsExchangeListQuery = serde_json::from_str(
            r#"{"isHot":1,"isEnabled":1,"keyword":"耳机","page":2,"size":30,
                "sortField":"exchangeIntegral","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.is_hot, Some(1));
        assert_eq!(q.is_enabled, Some(1));
        assert_eq!(q.keyword.as_deref(), Some("耳机"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));

        let d: ExchangeDetailQuery =
            serde_json::from_str(r#"{"id":3,"shopId":1,"nearestShopId":2}"#).unwrap();
        assert_eq!(d.id, Some(3));
        assert_eq!(d.shop_id, Some(1));
        assert_eq!(d.nearest_shop_id, Some(2));
        let missing: ExchangeDetailQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(missing.id, None);
    }

    /// VO 序列化：camelCase、Decimal、折后价字段。
    #[test]
    fn vo_serializes_camel_case() {
        let vo = PointsExchangeVO {
            id: 3,
            product_id: 88,
            exchange_integral: 500,
            points_deducted_amount: price("20.00"),
            is_hot: 1,
            is_enabled: 1,
            sku_id: Some(11),
            product_name: Some("蓝牙耳机".into()),
            pic_thumb: Some("https://oss.example/t.png".into()),
            pic_url: Some("https://oss.example/p.png".into()),
            market_price: Some(price("199.00")),
            cost_price: None,
            product_price: Some(price("99.00")),
            discounts_price: Some(price("79.00")),
            product_stock: Some(10),
            virtual_sales: Some(5),
            product_sn: Some("SN-1".into()),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["id"], 3);
        assert_eq!(json["productId"], 88);
        assert_eq!(json["exchangeIntegral"], 500);
        assert_eq!(json["pointsDeductedAmount"], "20.00");
        assert_eq!(json["isHot"], 1);
        assert_eq!(json["skuId"], 11);
        assert_eq!(json["productName"], "蓝牙耳机");
        assert_eq!(json["discountsPrice"], "79.00");
        assert!(json["costPrice"].is_null());
        assert_eq!(json["productSn"], "SN-1");
    }

    /// 购物车响应：`item` / `flowType` 与 Java `ExchangeProductToCartVO` 一致。
    #[test]
    fn exchange_cart_vo_serializes() {
        let vo = ExchangeProductToCartVO {
            item: true,
            flow_type: CART_TYPE_EXCHANGE,
        };
        let json = serde_json::to_value(vo).unwrap();
        assert_eq!(json["item"], true);
        assert_eq!(json["flowType"], 3);
    }
}
