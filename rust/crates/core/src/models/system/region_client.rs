//! system::region_client（地区域）DTO / VO。
//!
//! 对应原 Java `com.tigshop.bean.vo.sys.RegionVO` 与
//! `com.tigshop.bean.vo.sys.CityRegionVO`。
//!
//! > **注册说明**：本文件由 system::region_client 独占，`crates/core/src/models/mod.rs`
//! > 属共享文件，本切片**不修改**。主会话需添加一行
//! > `pub mod region_client;`（放在其他 `pub mod sliceNNN;` 之间即可）。

use serde::{Deserialize, Serialize};

use crate::entities::Region;

/// 地区列表 VO（Java `com.tigshop.bean.vo.sys.RegionVO`）。
///
/// ⚠️ 本切片（`RegionController`）**不使用**该 VO：Java 控制器的 7 个接口
/// 全部直接返回 `com.tigshop.bean.model.setting.Region` 实体（或
/// `List<List<Region>>` / `List<Region>`），因此响应 JSON 的 key 是
/// **实体列名驼峰**（`regionId` / `regionName` / `parentId` / `level` /
/// `isHot` / `sortOrder` / `firstWord` / `standardCode`），共 8 个字段。
/// 相比之下 `RegionVO` 还多一个 `centor`（中心点）、少 `sortOrder` /
/// `standardCode`，**不能**拿来做本控制器出参，否则字段对不上。
///
/// 保留此结构仅为对齐 `bean/vo/sys/RegionVO.java` 的类存在性；
/// 真正出参由 [`Region`]（`crates/core/src/entities/setting.rs`，
/// 已带 `#[derive(Serialize)]` + `rename_all = "snake_case"`）直接承担 ——
/// 实体序列化为 snake_case，与原 Java 的 camelCase **不一致**，
/// 差异已记入切片返回值的 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegionVO {
    /// 主键
    pub region_id: i32,
    /// 地区名称（Java 侧带 `@JsonTranslate`）
    pub region_name: String,
    /// 父级id
    pub parent_id: i32,
    /// 级别
    pub level: Option<i32>,
    /// 是否热门
    pub is_hot: i32,
    /// 首字母
    pub first_word: String,
    /// 中心点（`region` 表已无此列，Java VO 也只声明不映射）
    pub centor: Option<String>,
}

/// 城市列表 VO（Java `com.tigshop.bean.vo.sys.CityRegionVO`）。
///
/// 对应 `RegionController.getCityRegion`，字段只有 `hot` / `city` 两个
/// `List<Region>`，本结构直接持有实体列表。
///
/// Java 侧由 `redisCache.getCacheObject(CITY_PINYING_LIST)` 缓存
/// （常量 `CITY_PINYING_LIST = "city_pinying_list"`，
/// 见 `com.tigshop.common.constant.Constants:257`），
/// 缓存的是该 VO 的 JSON 串。Rust 侧未接入 Redis，语义差异见
/// [`crate::models::system::region_client`] 所在切片说明与 `uncertain_points`。
/// 注意：这里**不能**派生 `PartialEq` / `Eq` —— 持有的 `Region` 是
/// 自动生成的实体，未实现这两个 trait；本 VO 也无按值比较的业务需求
/// （Java 侧同样只有 `@Data`，不参与相等性判断）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CityRegionVO {
    /// 热门城市
    pub hot: Vec<Region>,
    /// 城市列表
    pub city: Vec<Region>,
}

/// 城市拼音列表的 Redis 缓存 key。
///
/// 对齐 Java `com.tigshop.common.constant.Constants.CITY_PINYING_LIST`。
pub const CITY_PINYING_LIST: &str = "city_pinying_list";

/// 重庆市的 `region_id`（Java
/// `RegionServiceImpl.CHONGQING_CITY_REGION_ID`）。
pub const CHONGQING_CITY_REGION_ID: i32 = 500100;

/// 已废止的重庆原江北区 / 原渝北区 `region_id`
/// （Java `RegionServiceImpl.DEPRECATED_CHONGQING_DISTRICT_IDS`
/// = `Set.of(500105, 500112)`）。
pub const DEPRECATED_CHONGQING_DISTRICT_IDS: [i32; 2] = [500105, 500112];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn city_region_vo_serializes_camel_case() {
        let vo = CityRegionVO::default();
        let json = serde_json::to_string(&vo).unwrap();
        assert_eq!(json, r#"{"hot":[],"city":[]}"#);
    }

    #[test]
    fn region_vo_round_trips() {
        let vo = RegionVO {
            region_id: 110000,
            region_name: "北京市".into(),
            parent_id: 1,
            level: Some(2),
            is_hot: 0,
            first_word: "B".into(),
            centor: None,
        };
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains(r#""regionId":110000"#));
        assert!(json.contains(r#""firstWord":"B""#));
        let back: RegionVO = serde_json::from_str(&json).unwrap();
        assert_eq!(back, vo);
    }

    #[test]
    fn cache_key_and_deprecated_ids_match_java() {
        assert_eq!(CITY_PINYING_LIST, "city_pinying_list");
        assert_eq!(CHONGQING_CITY_REGION_ID, 500100);
        assert_eq!(DEPRECATED_CHONGQING_DISTRICT_IDS, [500105, 500112]);
    }
}
