//! 买家秀分组管理（marketing::buyer_show_group）DTO / 查询参数 / VO。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowGroupSaveParam`
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowGroupUpdateParam`
//! - `com.tigshop.bean.query.promotion.buyershow.BuyerShowGroupPageQuery`
//!   （**仅继承 `BasePage`**，无自有字段）
//! - `com.tigshop.bean.vo.promotion.buyershow.{BuyerShowGroupPageVO, BuyerShowGroupVO}`
//! - `com.tigshop.bean.dto.common.OperateDTO`（`del` 入参）
//! - `com.tigshop.common.utils.HeaderUtils#getShopId`（多租户三态，见
//!   [`BuyerShowGroupScope`]）
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//! 分页入参沿用 Java `BasePage` 语义：`page` 缺省 1，`size` 缺省 15、上限 100。
//!
//! **说明（为什么本文件自带 `OperateDTO` 副本）**：与 brand / authority /
//! admin_user / shop_manage / pc_cat_floor 的做法一致——切片独占文件不允许改共享的
//! `models::catalog::OperateDTO`；本副本字段与 Java `OperateDTO` 的 `id` 对齐
//! （`adminNote` / `pageType` 本域接口未使用，不定义），并保留 `Option` 以便
//! 复刻 Java `@NotNull(message = "id不能为空")` 的报错文案。

use serde::{Deserialize, Serialize};

use crate::types::PageQuery;

// ————————————————————— 查询参数 —————————————————————

/// `GET /adminapi/promotion/buyerShow/group/list` 查询参数
/// （Java `BuyerShowGroupPageQuery extends BasePage`）。
///
/// `keyword` 在 Java 服务层**从未使用**（`BuyerShowGroupServiceImpl#list`
/// 只用了 `getPage` / `getSize` / `getSortField` / `getSortOrder`），
/// 这里保留字段仅为兼容前端可能带上的同名参数。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowGroupPageQuery {
    /// 当前页码（Java `BasePage#getPage`：`null` → 1）
    pub page: Option<u64>,
    /// 每页大小（Java `BasePage#getSize`：`null` → 15，`> 100` → 100）
    ///
    /// Java 字段名是 `size`；前端历史上也用过 `pageSize`，故两个名字都接受。
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（属性名或数据库列名，Java `getColumnByPropertyName`）
    pub sort_field: Option<String>,
    /// 排序方向：`asc` / `desc`（其它值按 Java 逻辑**不排序**）
    pub sort_order: Option<String>,
    /// 关键词（Java 本接口未使用，仅透传）
    pub keyword: Option<String>,
}

impl BuyerShowGroupPageQuery {
    /// 分页参数（对齐 Java `BasePage#getPage` / `#getSize`：缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self.page_size.unwrap_or(15).clamp(1, 100),
        }
    }
}

// ————————————————————— 入参 —————————————————————

/// 新建买家秀分组参数（Java `BuyerShowGroupSaveParam`）。
///
/// Java 校验注解（`@Valid` 在控制器方法参数上）：
/// - `groupName`：`@NotBlank(message = "分组名称不能为空")`
/// - `groupIds`：`@NotEmpty(message = "商品分组Ids不能为空")`
///
/// 用 `Option` 承载，是为了在服务层复刻上述文案（若直接用 `String`
/// 则缺失字段会退化成 serde 的英文报错）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowGroupSaveParam {
    /// 分组名称
    pub group_name: Option<String>,
    /// 关联的商品分组 ID 列表
    pub group_ids: Option<Vec<i32>>,
}

/// 更新买家秀分组参数（Java `BuyerShowGroupUpdateParam`）。
///
/// Java 校验注解：
/// - `buyerShowGroupId`：`@NotNull(message = "买家秀分组ID不能为空")`
/// - `groupName`：`@NotBlank(message = "分组名称不能为空")`
/// - `groupIds`：`@NotEmpty(message = "商品分组Ids不能为空")`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowGroupUpdateParam {
    /// 买家秀分组 ID
    pub buyer_show_group_id: Option<i32>,
    /// 分组名称
    pub group_name: Option<String>,
    /// 关联的商品分组 ID 列表
    pub group_ids: Option<Vec<i32>>,
}

/// 删除入参（Java `com.tigshop.bean.dto.common.OperateDTO`）。
///
/// Java：`@NotNull(message = "id不能为空")`。控制器只用到 `id`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

// ————————————————————— 返回体 —————————————————————

/// 买家秀分组分页项（Java `BuyerShowGroupPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowGroupPageVO {
    /// 买家秀分组 ID
    pub buyer_show_group_id: i32,
    /// 分组名称（Java 侧另挂 `@JsonTranslate(dataType = 16)`，翻译服务未迁移）
    pub group_name: String,
    /// 关联商品分组名（Java 侧逐条 `translatePackage.translate(name, DataType.API)`）
    pub product_group_name: Vec<String>,
    /// 该分组下的买家秀数量（Java `Long buyerShowCount`）
    pub buyer_show_count: i64,
}

/// 买家秀分组详情（Java `BuyerShowGroupVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowGroupVO {
    /// 买家秀分组 ID
    pub buyer_show_group_id: i32,
    /// 分组名称（Java 侧另挂 `@JsonTranslate(dataType = 16)`）
    pub group_name: String,
    /// 关联的商品分组 ID 列表（由 `product_group_id` 的 JSON 文本反序列化而来）
    pub group_ids: Vec<i32>,
    /// 关联商品分组名
    pub product_group_name: Vec<String>,
}

// ————————————————————— 多租户范围 —————————————————————

/// 当前请求的店铺范围（对应 Java `HeaderUtils.getShopId()` 的三态返回）。
///
/// Java 口径（`HeaderUtils.java:133-147`）：
/// - `x-admin-type == "admin"` → `0`（平台，**先于** `x-shop-id` 判定）
/// - `x-admin-type == "shop"` / `"pos"` → `x-shop-id`（缺失 / 空 → `null`）
/// - 其它（含请求头缺失）→ `null`
///
/// Rust 侧 JWT 尚未签发 `shop_id`，故由路由层读请求头得到本枚举。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BuyerShowGroupScope {
    /// 平台账号 → `shop_id = 0`
    Platform,
    /// 店铺 / 门店 / 收银台账号 → `x-shop-id`
    Shop(i32),
    /// 其它账号类型或 `x-shop-id` 缺失（Java 返回 `null`，查询退化为 `shop_id = NULL`）
    Unscoped,
}

impl BuyerShowGroupScope {
    /// 由 `x-shop-id` 解析结果构造（`None` → [`BuyerShowGroupScope::Unscoped`]）。
    #[must_use]
    pub fn from_optional(shop_id: Option<i32>) -> Self {
        match shop_id {
            Some(id) => Self::Shop(id),
            None => Self::Unscoped,
        }
    }

    /// 作为 `shop_id` 过滤条件的值。
    ///
    /// `None` 对应 Java 里 `eq(shop_id, null)` 生成的 `shop_id = NULL`
    /// （恒不成立 → 查不到任何行），调用方须按「空结果」处理。
    #[must_use]
    pub fn shop_id(self) -> Option<i32> {
        match self {
            Self::Platform => Some(0),
            Self::Shop(id) => Some(id),
            Self::Unscoped => None,
        }
    }

    /// 落库使用的 `shop_id`（`buyer_show_group.shop_id` 是
    /// `int unsigned NOT NULL DEFAULT 0`）。
    ///
    /// Java `setShopId(null)` 后 MyBatis-Plus 的 NOT_NULL 策略会**跳过该列**，
    /// 由列默认值补 `0`，故此处等价取 `0`。
    #[must_use]
    pub fn insert_shop_id(self) -> i32 {
        self.shop_id().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_query_follows_java_base_page() {
        // 缺省：page=1 / size=15（Java `BasePage` 构造器与 getter）
        let q = BuyerShowGroupPageQuery::default();
        let p = q.page_query();
        assert_eq!((p.page, p.page_size), (1, 15));

        // size > 100 截断为 100
        let q = BuyerShowGroupPageQuery {
            page: Some(3),
            page_size: Some(500),
            ..Default::default()
        };
        let p = q.page_query();
        assert_eq!((p.page, p.page_size), (3, 100));
    }

    #[test]
    fn query_accepts_both_size_and_page_size() {
        let a: BuyerShowGroupPageQuery = serde_json::from_str(r#"{"page":2,"size":30}"#).unwrap();
        assert_eq!(a.page_query().page_size, 30);
        let b: BuyerShowGroupPageQuery =
            serde_json::from_str(r#"{"page":2,"pageSize":30}"#).unwrap();
        assert_eq!(b.page_query().page_size, 30);
    }

    #[test]
    fn params_use_camel_case_json_names() {
        let p: BuyerShowGroupSaveParam =
            serde_json::from_str(r#"{"groupName":"夏季","groupIds":[1,2]}"#).unwrap();
        assert_eq!(p.group_name.as_deref(), Some("夏季"));
        assert_eq!(p.group_ids.as_deref(), Some(&[1, 2][..]));

        let u: BuyerShowGroupUpdateParam =
            serde_json::from_str(r#"{"buyerShowGroupId":7,"groupName":"x","groupIds":[3]}"#)
                .unwrap();
        assert_eq!(u.buyer_show_group_id, Some(7));

        let o: OperateDTO = serde_json::from_str(r#"{"id":9,"adminNote":"n"}"#).unwrap();
        assert_eq!(o.id, Some(9));
    }

    #[test]
    fn scope_matches_header_utils_semantics() {
        assert_eq!(BuyerShowGroupScope::Platform.shop_id(), Some(0));
        assert_eq!(BuyerShowGroupScope::Shop(9).shop_id(), Some(9));
        assert_eq!(BuyerShowGroupScope::Unscoped.shop_id(), None);
        // 落库值：Java 跳过 null 列 → 列默认 0
        assert_eq!(BuyerShowGroupScope::Unscoped.insert_shop_id(), 0);
        assert_eq!(
            BuyerShowGroupScope::from_optional(None),
            BuyerShowGroupScope::Unscoped
        );
        assert_eq!(
            BuyerShowGroupScope::from_optional(Some(4)),
            BuyerShowGroupScope::Shop(4)
        );
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = BuyerShowGroupPageVO {
            buyer_show_group_id: 1,
            group_name: "g".into(),
            product_group_name: vec!["n".into()],
            buyer_show_count: 3,
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["buyerShowGroupId"], 1);
        assert_eq!(json["groupName"], "g");
        assert_eq!(json["productGroupName"][0], "n");
        assert_eq!(json["buyerShowCount"], 3);
    }
}
