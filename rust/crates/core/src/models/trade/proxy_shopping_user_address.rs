//! 代客下单 · 收货地址管理域模型（trade::proxy_shopping_user_address）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.user.UserAddressListDTO`（列表查询）
//! - `com.tigshop.bean.dto.user.UserAddressCreateDTO`（新增）
//! - `com.tigshop.bean.dto.user.UserAddressUpdateDTO`（修改 / 设置选中）
//! - `com.tigshop.bean.vo.user.UserAddressVO`（出参，本域重新声明为独立类型）
//! - `cn.hutool.core.lang.tree.Tree`（地区树，见 [`RegionTreeNode`]）
//!
//! 列名/字段名严格对齐权威 schema（`java/database/pure.sql`）：
//! `user_address` 27 列、`region` 8 列。
//!
//! > **为什么不复用 `tigshop_core::models::member::user_manage::UserAddressVO`**：
//! > member::user_manage 的同名 VO 是「会员管理」域的裁剪版（`#[serde(default)]` 且
//! > 字段可缺省）。本域是契约里独立的 6 条接口，出参与 Java
//! > `UserAddressVO`（18 个字段）逐字段对齐；跨切片复用别人的模型会让
//! > 任一方的调整互相牵制。故此处独立声明，仅**读取**实体 `UserAddress`。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ————————————————————————— 入参 —————————————————————————

/// 收货地址列表查询（Java `UserAddressListDTO extends BasePage`）。
///
/// 控制器会强制覆盖两个字段（见 `routes/proxy_shopping_user_address.rs`）：
/// - `sortField = "is_selected"` → 按选中状态降序
/// - `isSystem = 2` → **不做** `is_system` 过滤（Java 服务层只处理 1 与 0/null）
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddressListRequest {
    /// 会员ID（代客下单必填；Java 缺省时回落 `SecurityUtils.getCurrentUserId()`）
    pub user_id: Option<i32>,
    /// 是否是系统添加的地址 0 用户 1 系统 2 全部
    pub is_system: Option<i32>,
    /// 页码（Java `BasePage.getPage()` 缺省 1）
    pub page: Option<i64>,
    /// 每页大小（Java `BasePage.getSize()` 缺省 15，上限 100）
    pub size: Option<i64>,
    /// 排序字段（Java 控制器**强制**覆盖为 `is_selected`，此字段实际被忽略）
    pub sort_field: Option<String>,
    /// `desc|asc`（Java `buildSortOrder` 在空值时按 **desc** 处理）
    pub sort_order: Option<String>,
    /// 关键词（Java `BasePage.keyword`，本域查询未使用）
    pub keyword: Option<String>,
}

/// 新增收货地址（Java `UserAddressCreateDTO`）。
///
/// ⚠️ **没有** `is_system` 字段：Java 控制器强制
/// `createDTO.setIsSystem(1)`（系统地址），客户端传什么都不生效。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddressCreateRequest {
    /// 会员ID（代客下单必填）
    pub user_id: Option<i32>,
    /// 收货人
    pub consignee: Option<String>,
    /// 收货人地址 `[国家, 省, 市, 区]` 的 regionId 列表
    pub region_ids: Option<Vec<i32>>,
    /// 详细地址
    pub address: Option<String>,
    /// 定位地址
    pub position_address: Option<String>,
    /// 邮政编码（入库前 trim，超 60 字符报错）
    pub postcode: Option<String>,
    /// 收货人邮箱
    pub email: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 区号
    pub mobile_area_code: Option<String>,
    /// 固定电话
    pub telephone: Option<String>,
    /// 收货地址别名（家/公司/学校/自定义）
    pub address_tag: Option<String>,
    /// 是否默认 0/1
    pub is_default: Option<i32>,
    /// 是否选中 0/1
    pub is_selected: Option<i32>,
    /// 纬度（Java `BigDecimal`）
    pub latitude: Option<Decimal>,
    /// 经度（Java `BigDecimal`）
    pub longitude: Option<Decimal>,
}

/// 修改收货地址（Java `UserAddressUpdateDTO`）。
///
/// `id` 与 `addressId` **同时存在**是原系统的既有设计：
/// - `update` 用 `addressId` 定位记录
/// - `setSelected` 用 `id` 定位记录
///
/// 所有标量字段都是 `Option<Option<T>>`：
/// 外层 = JSON 里是否出现该 key，内层 = 是否显式给了 `null`。
/// 复刻 MyBatis-Plus `updateById` 的「null 字段不参与 UPDATE」语义，
/// 但显式 `null` 会（且仅会）被识别为「不更新」——见 `services/proxy_shopping_user_address.rs`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AddressUpdateRequest {
    /// 收货人id（`setSelected` 使用）
    pub id: Option<i32>,
    /// 收货人id（`update` 使用）
    pub address_id: Option<i32>,
    /// 会员ID（Java 控制器会用库中记录的 `user_id` 覆盖它）
    pub user_id: Option<i32>,
    /// 是否是系统添加（Java 控制器会用库中记录的 `is_system` 覆盖它）
    pub is_system: Option<i32>,
    /// 收货人
    #[serde(default, deserialize_with = "double_option")]
    pub consignee: Option<Option<String>>,
    /// 收货人地址 regionId 列表
    #[serde(default, deserialize_with = "double_option")]
    pub region_ids: Option<Option<Vec<i32>>>,
    /// 详细地址
    #[serde(default, deserialize_with = "double_option")]
    pub address: Option<Option<String>>,
    /// 定位地址
    #[serde(default, deserialize_with = "double_option")]
    pub position_address: Option<Option<String>>,
    /// 邮政编码
    #[serde(default, deserialize_with = "double_option")]
    pub postcode: Option<Option<String>>,
    /// 收货人邮箱
    #[serde(default, deserialize_with = "double_option")]
    pub email: Option<Option<String>>,
    /// 手机号
    #[serde(default, deserialize_with = "double_option")]
    pub mobile: Option<Option<String>>,
    /// 区号
    #[serde(default, deserialize_with = "double_option")]
    pub mobile_area_code: Option<Option<String>>,
    /// 固定电话
    #[serde(default, deserialize_with = "double_option")]
    pub telephone: Option<Option<String>>,
    /// 收货地址别名
    #[serde(default, deserialize_with = "double_option")]
    pub address_tag: Option<Option<String>>,
    /// 是否默认
    #[serde(default, deserialize_with = "double_option")]
    pub is_default: Option<Option<i32>>,
    /// 是否选中
    #[serde(default, deserialize_with = "double_option")]
    pub is_selected: Option<Option<i32>>,
    /// 纬度
    #[serde(default, deserialize_with = "double_option")]
    pub latitude: Option<Option<Decimal>>,
    /// 经度
    #[serde(default, deserialize_with = "double_option")]
    pub longitude: Option<Option<Decimal>>,
}

/// `GET /adminapi/proxyShopping/address/getRegionPath?regionId=...` 的查询参数。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionPathQuery {
    /// 目标地区ID（Java `@RequestParam("regionId")`，**必填**）
    pub region_id: Option<i32>,
}

/// 把「缺省 / 显式 null / 有值」三态区分开的反序列化助手。
///
/// `#[serde(default)]` 下：
/// - key 不出现 → `None`
/// - key 为 `null` → 由本函数收到 `None` → `Some(None)`
/// - key 有值 → `Some(Some(v))`
fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}

// ————————————————————————— 出参 —————————————————————————

/// 收货地址出参（Java `UserAddressVO`，18 字段逐一对齐）。
///
/// 字段语义与 Java 一致：`region_names` 是 **JSON 数组反序列化后的 `List<String>`**，
/// `region_name` 是**去重后拼接**的展示串（见 `services/proxy_shopping_user_address.rs::build_region_name`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AddressVO {
    /// 用户地址（详细地址）
    pub address: String,
    /// 定位地址
    pub position_address: Option<String>,
    /// 用户地址id
    pub address_id: i32,
    /// 收货人名称
    pub consignee: String,
    /// 邮箱
    pub email: Option<String>,
    /// 是否默认
    pub is_default: i32,
    /// 是否选中
    pub is_selected: i32,
    /// 手机号
    pub mobile: String,
    /// 区号
    pub mobile_area_code: Option<String>,
    /// 地区（拼接后的展示串）
    pub region_name: String,
    /// 地区名称列表（`user_address.region_names` 的 JSON 反序列化结果）
    pub region_names: Vec<String>,
    /// 固定电话
    pub telephone: Option<String>,
    /// 用户id
    pub user_id: i32,
    /// 地区id列表（`user_address.region_ids` 的 JSON 反序列化结果）
    pub region_ids: Vec<i32>,
    /// 收货人的邮编
    pub postcode: Option<String>,
    /// 收货地址别名
    pub address_tag: String,
    /// 纬度
    pub latitude: Option<Decimal>,
    /// 经度
    pub longitude: Option<Decimal>,
    /// 是否是系统添加
    pub is_system: Option<i32>,
}

/// 地址更新补丁：**只含可被 `update` 接口改写的列**
/// （`crates/infrastructure/src/db/repo/proxy_shopping_user_address.rs::USER_ADDRESS_UPDATE_FIELDS`
/// 的强类型镜像）。
///
/// 每个字段 `Some` = 该列参与 UPDATE；`None` = 该列这条 SQL 不出现
/// （复刻 MyBatis-Plus `updateById` 的「null 字段不参与 SET」语义）。
///
/// ⚠️ `user_id` / `is_system` / `address_id` **故意不在此结构里**：
/// Java 控制器会用库中记录覆盖前两者，主键只作为 WHERE 条件。
#[derive(Debug, Clone, Default, PartialEq)]
pub struct AddressUpdatePatch {
    /// 收货地址别名
    pub address_tag: Option<String>,
    /// 收货人
    pub consignee: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// `[JSON]` 地区ID列表
    pub region_ids: Option<String>,
    /// `[JSON]` 地区名称列表（服务层按 `region_ids` 反查后写入）
    pub region_names: Option<String>,
    /// 详细地址
    pub address: Option<String>,
    /// 定位地址
    pub position_address: Option<String>,
    /// 邮编（已 trim + 长度校验）
    pub postcode: Option<String>,
    /// 固定电话
    pub telephone: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 区号
    pub mobile_area_code: Option<String>,
    /// 是否默认
    pub is_default: Option<i32>,
    /// 是否选中
    pub is_selected: Option<i32>,
    /// 纬度
    pub latitude: Option<Decimal>,
    /// 经度
    pub longitude: Option<Decimal>,
}

impl AddressUpdatePatch {
    /// 是否至少有一个列需要更新。
    ///
    /// 全 `None` 时 Java `updateById(全 null 实体)` 会抛异常（生成的 SQL 无 SET），
    /// 本实现改为返回明确的业务错误（见 `services/proxy_shopping_user_address.rs`）。
    #[must_use]
    pub fn has_any(&self) -> bool {
        self.address_tag.is_some()
            || self.consignee.is_some()
            || self.email.is_some()
            || self.region_ids.is_some()
            || self.region_names.is_some()
            || self.address.is_some()
            || self.position_address.is_some()
            || self.postcode.is_some()
            || self.telephone.is_some()
            || self.mobile.is_some()
            || self.mobile_area_code.is_some()
            || self.is_default.is_some()
            || self.is_selected.is_some()
            || self.latitude.is_some()
            || self.longitude.is_some()
    }
}

/// 地区节点（Java `com.tigshop.bean.model.setting.Region` 的 **8 列**直投）。
///
/// `getRegionPath` 返回 `List<Region>`，逐字段对齐 `Region` 实体
/// （`region_id` / `region_name` / `parent_id` / `level` / `is_hot` /
/// `sort_order` / `first_word` / `standard_code`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionPathNode {
    /// 主键
    pub region_id: i32,
    /// 地区名称
    pub region_name: String,
    /// 父级id
    pub parent_id: i32,
    /// 级别
    pub level: Option<i32>,
    /// 是否热门
    pub is_hot: i32,
    /// 排序值，数值越小越靠前
    pub sort_order: i32,
    /// 首字母
    pub first_word: String,
    /// 国家或地区稳定标准代码
    pub standard_code: Option<String>,
}

/// 地区树节点（Java `cn.hutool.core.lang.tree.Tree<Integer>` 的 JSON 形态）。
///
/// Hutool 的 `Tree<T>` 继承 `LinkedHashMap<String, Object>`，
/// `putExtra` 直接写平铺 key，因此 Java 的真实 JSON 形如：
///
/// ```json
/// [{"regionId":1,"parentId":0,"regionName":"中国","children":[
///    {"regionId":110000,"parentId":1,"regionName":"北京市","children":[...]}
/// ]}]
/// ```
///
/// 本结构复刻该形态（`children` 恒为数组，叶子节点为 `[]`，
/// 而不是 Java 剪枝时的「无 children key」——见 `services/proxy_shopping_user_address.rs` 模块头）。
/// 前端 `views/order/proxyShopping/src/SelectRegion.vue` 的级联配置为
/// `{ label: "regionName", value: "regionId", children: "children" }`。
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct RegionTreeNode {
    /// 地区ID
    pub region_id: i32,
    /// 父级ID（Java 的 `parentId` extra 字段）
    pub parent_id: i32,
    /// 地区名称
    pub region_name: String,
    /// 子节点（恒为数组）
    pub children: Vec<RegionTreeNode>,
}

impl RegionTreeNode {
    /// 新建一个叶子节点。
    #[must_use]
    pub fn leaf(region_id: i32, parent_id: i32, region_name: impl Into<String>) -> Self {
        Self {
            region_id,
            parent_id,
            region_name: region_name.into(),
            children: Vec::new(),
        }
    }

    /// 递归判断该子树是否包含指定地区（用于单测与调试）。
    #[must_use]
    pub fn contains(&self, region_id: i32) -> bool {
        self.region_id == region_id || self.children.iter().any(|c| c.contains(region_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_request_accepts_frontend_payload() {
        // 前端 `api/proxyShopping/address.ts::getProxyShoppingAddressList` 的真实提交体
        let q: AddressListRequest =
            serde_json::from_str(r#"{"userId":10086,"page":1,"size":15}"#).unwrap();
        assert_eq!(q.user_id, Some(10086));
        assert_eq!(q.page, Some(1));
        assert_eq!(q.size, Some(15));
        // 控制器未传的字段留空，由服务层补默认
        assert_eq!(q.sort_field, None);
        assert_eq!(q.is_system, None);
    }

    #[test]
    fn list_request_tolerates_unknown_and_null_fields() {
        let q: AddressListRequest = serde_json::from_str(r#"{"userId":null,"foo":1}"#).unwrap();
        assert_eq!(q.user_id, None);
    }

    #[test]
    fn create_request_matches_java_dto_fields() {
        let dto: AddressCreateRequest = serde_json::from_str(
            r#"{"userId":7,"consignee":"张三","regionIds":[1,110000,110100,110101],
                "address":"文一西路 1 号","positionAddress":"某大厦","postcode":"310000",
                "email":"a@b.c","mobile":"13800000000","mobileAreaCode":"86",
                "telephone":"0571-1","addressTag":"家","isDefault":1,"isSelected":0,
                "latitude":30.1,"longitude":120.2}"#,
        )
        .unwrap();
        assert_eq!(dto.user_id, Some(7));
        assert_eq!(
            dto.region_ids.as_deref(),
            Some([1, 110000, 110100, 110101].as_slice())
        );
        assert_eq!(dto.is_default, Some(1));
        assert_eq!(dto.latitude, Some("30.1".parse::<Decimal>().unwrap()));
        // Java `UserAddressCreateDTO` 有 isSystem，但控制器强制覆盖为 1，
        // 故本结构**不提供**该字段，客户端传了也会被忽略。
        let ignored: AddressCreateRequest =
            serde_json::from_str(r#"{"userId":7,"isSystem":0}"#).unwrap();
        assert_eq!(ignored.user_id, Some(7));
    }

    #[test]
    fn update_request_distinguishes_missing_null_and_value() {
        // 缺省 / null / 有值 三态必须可区分（复刻 updateById 的 null 跳过语义）
        let dto: AddressUpdateRequest = serde_json::from_str(
            r#"{"addressId":9,"consignee":"李四","address":null,"postcode":"310000"}"#,
        )
        .unwrap();
        assert_eq!(dto.address_id, Some(9));
        assert_eq!(dto.consignee, Some(Some("李四".to_string())));
        assert_eq!(dto.address, Some(None));
        assert_eq!(dto.postcode, Some(Some("310000".to_string())));
        // 未出现的 key
        assert_eq!(dto.email, None);
        assert_eq!(dto.is_default, None);
    }

    #[test]
    fn update_request_accepts_set_selected_payload() {
        // 前端 `setSelectedAddress(id)` 只发 `{ id }`
        let dto: AddressUpdateRequest = serde_json::from_str(r#"{"id":12}"#).unwrap();
        assert_eq!(dto.id, Some(12));
        assert_eq!(dto.address_id, None);
        assert_eq!(dto.consignee, None);
    }

    #[test]
    fn vo_serializes_camel_case_like_java() {
        let vo = AddressVO {
            address_id: 5,
            consignee: "张三".into(),
            mobile: "13800000000".into(),
            region_name: "浙江省 杭州市 西湖区".into(),
            region_names: vec!["浙江省".into(), "杭州市".into()],
            region_ids: vec![330000, 330100],
            is_default: 1,
            is_selected: 1,
            address_tag: "家".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["addressId"], 5);
        assert_eq!(json["isSelected"], 1);
        assert_eq!(json["regionName"], "浙江省 杭州市 西湖区");
        assert_eq!(json["regionIds"][0], 330000);
        assert!(json["positionAddress"].is_null());
    }

    #[test]
    fn update_patch_has_any_reflects_presence() {
        let empty = AddressUpdatePatch::default();
        assert!(!empty.has_any());
        let one = AddressUpdatePatch {
            consignee: Some("张三".into()),
            ..Default::default()
        };
        assert!(one.has_any());
        // 只有「显式值」才算；Option 字段为 None 不算
        let none_like = AddressUpdatePatch {
            latitude: None,
            is_default: None,
            ..Default::default()
        };
        assert!(!none_like.has_any());
    }

    #[test]
    fn region_path_query_reads_region_id() {
        let q: RegionPathQuery = serde_json::from_str(r#"{"regionId":110101}"#).unwrap();
        assert_eq!(q.region_id, Some(110101));
        let empty: RegionPathQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(empty.region_id, None);
    }

    #[test]
    fn region_tree_node_serializes_with_children_always_array() {
        let mut root = RegionTreeNode::leaf(1, 0, "中国");
        root.children
            .push(RegionTreeNode::leaf(110000, 1, "北京市"));
        let json = serde_json::to_value(&root).unwrap();
        assert_eq!(json["regionId"], 1);
        assert_eq!(json["parentId"], 0);
        assert_eq!(json["regionName"], "中国");
        assert_eq!(json["children"][0]["regionId"], 110000);
        // 叶子节点 children 是 []，不是缺失
        assert_eq!(json["children"][0]["children"], serde_json::json!([]));
        assert!(root.contains(110000));
        assert!(!root.contains(999));
    }
}
