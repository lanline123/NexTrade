//! 品牌域 DTO / VO / 查询参数。
//! 对应 Java `com.tigshop.bean.dto.product.BrandDTO` / `BrandListDTO` /
//! `BrandAuditDTO`、`bean.dto.common.OperateDTO` / `BatchDTO` /
//! `UpdateFieldDTO`、`bean.vo.product.BrandVO` / `BrandSearchVO`。
//!
//! JSON 字段保持 camelCase，与原接口一致。
//!
//! **说明**：`OperateDTO` / `BatchDTO` / `UpdateFieldDTO` 已有共享版本
//! （`tigshop_core::models::catalog::category_all`），但本切片不得修改共享文件，
//! 且原 Java 的这三个 DTO 字段比 catalog 版本更多（`adminNote` /
//! `pageType` / `value` / `data` 等），故在本文件内定义同构结构。
//! 主会话合并时如需统一，可改用共享 DTO 并删除此处的重复定义。

use serde::{Deserialize, Serialize};

/// 品牌审核状态（对应 Java `BrandStatusEnum` / `CheckStatus`，数值一致）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrandStatus {
    /// 待审核
    Pending = 0,
    /// 审核通过
    Approved = 1,
    /// 已拒绝
    Rejected = 2,
}

impl BrandStatus {
    /// 状态文案（对应 Java `BrandStatusEnum.getStatusName`）。
    pub fn name(self) -> &'static str {
        match self {
            Self::Pending => "待审核",
            Self::Approved => "审核通过",
            Self::Rejected => "已拒绝",
        }
    }
}

impl TryFrom<i32> for BrandStatus {
    type Error = String;

    fn try_from(v: i32) -> Result<Self, String> {
        match v {
            0 => Ok(Self::Pending),
            1 => Ok(Self::Approved),
            2 => Ok(Self::Rejected),
            other => Err(format!("非法品牌审核状态: {other}")),
        }
    }
}

/// 品牌 DTO（对应 Java `BrandDTO`，也作 `detail` 的返回结构）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandDTO {
    pub brand_id: Option<i32>,
    /// 品牌名称（Java `@Size(min=1, max=30)` + `@NotNull`，服务层校验）
    pub brand_name: Option<String>,
    /// 品牌英文名
    pub brand_en_name: Option<String>,
    /// 公司 Logo 图片
    pub brand_logo: Option<String>,
    /// 品牌描述
    pub brand_desc: Option<String>,
    /// 品牌网址
    pub site_url: Option<String>,
    /// 显示顺序，数字越大越靠后
    pub sort_order: Option<i32>,
    /// 是否显示：0 否 1 显示
    pub is_show: Option<i32>,
    /// 品牌分类
    pub brand_type: Option<String>,
    /// 是否热销品牌：0 否 1 是
    pub brand_is_hot: Option<i32>,
    /// 首字母
    pub first_word: Option<String>,
    /// （已废弃）是否店铺品牌
    pub is_store_brand: Option<i32>,
    /// 审核状态：0 待审核 1 通过 2 不通过
    pub check_status: Option<i32>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 审核状态：0 待审核 1 通过 2 已拒绝
    pub status: Option<i32>,
    /// 拒绝原因
    pub reject_remark: Option<String>,
}

/// 品牌列表 / 审核列表查询参数（对应 Java `BrandListDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BrandListQuery {
    /// 关键词（匹配品牌名，Java `BasePage.keyword`）
    pub keyword: Option<String>,
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，默认 15，上限 100）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段
    pub sort_field: Option<String>,
    /// `asc` / `desc`（缺省降序）
    pub sort_order: Option<String>,
    /// 是否显示：0 否 1 显示
    pub is_show: Option<i32>,
    /// 是否热销品牌
    pub brand_is_hot: Option<i32>,
    /// 首字母
    pub first_word: Option<String>,
    /// 审核状态：-1 / 缺省不限
    pub status: Option<i32>,
    /// 店铺 ID 过滤（仅平台账号语义有效）
    pub shop_id: Option<i32>,
    /// 是否审核列表：1 时强制 `shop_id <> 0`（`auditList` 固定传 1）
    pub is_audit: Option<i32>,
}

/// 品牌 VO（对应 Java `BrandVO`：DTO 全字段 + 状态文案 + 店铺信息）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandVO {
    #[serde(flatten)]
    pub base: BrandDTO,
    /// 审核状态名称
    pub status_text: String,
    /// 店铺信息（Java 内嵌 `Shop` 实体，这里仅取列表展示所需字段）
    pub shop: Option<BrandShopVO>,
}

/// 品牌 VO 内嵌店铺摘要（对应 Java `BrandVO.shop`，仅保留常用字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandShopVO {
    pub shop_id: i32,
    pub shop_title: String,
}

/// 品牌搜索结果（对应 Java `BrandSearchVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandSearchVO {
    /// 品牌列表（仅 id / 名称 / 首字母）
    pub brand_list: Vec<BrandSearchItem>,
    /// 首字母列表（去重）
    pub first_word_list: Vec<String>,
}

/// 品牌搜索项（对应 Java `BrandSearchDTO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandSearchItem {
    pub brand_id: i32,
    pub brand_name: String,
    pub first_word: Option<String>,
}

/// 品牌审核请求（对应 Java `BrandAuditDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrandAuditDTO {
    /// 品牌 ID
    pub brand_id: i32,
    /// 审核状态：1 通过 2 拒绝
    pub status: i32,
    /// 拒绝原因（拒绝时必填）
    pub reject_remark: Option<String>,
}

/// 单 ID 操作请求（对应 Java `bean.dto.common.OperateDTO`）。
///
/// 与共享 `models::catalog::OperateDTO` 同构；保留本切片独占副本的原因
/// 见模块注释。`adminNote` / `pageType` 原接口未使用，不定义。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperateDTO {
    pub id: Option<i32>,
}

/// 批量操作请求（对应 Java `bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDTO {
    pub ids: Option<Vec<i32>>,
    /// 操作类型，目前仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（品牌域 batch 未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求（对应 Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    /// 字段名（驼峰或下划线）
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brand_status_names_match_java_enum() {
        // BrandStatusEnum: PENDING(0,"待审核") APPROVED(1,"审核通过") REJECTED(2,"已拒绝")
        assert_eq!(BrandStatus::Pending.name(), "待审核");
        assert_eq!(BrandStatus::Approved.name(), "审核通过");
        assert_eq!(BrandStatus::Rejected.name(), "已拒绝");
        assert_eq!(BrandStatus::Pending as i32, 0);
        assert_eq!(BrandStatus::Approved as i32, 1);
        assert_eq!(BrandStatus::Rejected as i32, 2);
    }

    #[test]
    fn brand_status_try_from_rejects_unknown() {
        assert!(BrandStatus::try_from(0).is_ok());
        assert!(BrandStatus::try_from(3).is_err());
        assert!(BrandStatus::try_from(-1).is_err());
    }

    #[test]
    fn list_query_accepts_camel_case_and_size_alias() {
        // 前端字段为 camelCase；BasePage 分页字段是 page/size
        let q: BrandListQuery = serde_json::from_str(
            r#"{"keyword":"果","page":2,"size":30,"isShow":1,"brandIsHot":0,
                "firstWord":"A","status":-1,"shopId":0,"isAudit":1}"#,
        )
        .expect("BrandListQuery 应接受 camelCase");
        assert_eq!(q.keyword.as_deref(), Some("果"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.page_size, Some(30));
        assert_eq!(q.is_show, Some(1));
        assert_eq!(q.brand_is_hot, Some(0));
        assert_eq!(q.status, Some(-1));
        assert_eq!(q.is_audit, Some(1));
    }

    #[test]
    fn list_query_accepts_pagesize_alias_too() {
        let q: BrandListQuery = serde_json::from_str(r#"{"pageSize":20}"#).unwrap();
        assert_eq!(q.page_size, Some(20));
    }

    #[test]
    fn audit_dto_parses_remark() {
        let d: BrandAuditDTO =
            serde_json::from_str(r#"{"brandId":5,"status":2,"rejectRemark":"不符"}"#).unwrap();
        assert_eq!(d.brand_id, 5);
        assert_eq!(d.status, 2);
        assert_eq!(d.reject_remark.as_deref(), Some("不符"));
    }

    #[test]
    fn batch_dto_type_is_not_reserved() {
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.r#type.as_deref(), Some("del"));
        assert_eq!(b.ids, Some(vec![1, 2]));
    }

    #[test]
    fn vo_flattens_base_fields() {
        let vo = BrandVO {
            base: BrandDTO {
                brand_id: Some(3),
                brand_name: Some("X".into()),
                ..Default::default()
            },
            status_text: "待审核".into(),
            shop: None,
        };
        let json = serde_json::to_value(&vo).unwrap();
        // flatten 后 brandId/brandName 在顶层，与 Java BrandVO 结构一致
        assert_eq!(json["brandId"], 3);
        assert_eq!(json["statusText"], "待审核");
        assert_eq!(json["brandName"], "X");
    }

    #[test]
    fn operate_dto_parses_id() {
        let o: OperateDTO = serde_json::from_str(r#"{"id":9}"#).unwrap();
        assert_eq!(o.id, Some(9));
    }
}
