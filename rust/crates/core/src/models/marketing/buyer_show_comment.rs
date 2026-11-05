//! 买家秀评论管理域（marketing::buyer_show_comment）DTO / VO / 查询参数。
//!
//! 对应原 Java（`tigshop-adminapi` 的 `BuyerShowCommentController`，
//! `@RequestMapping("/adminapi/promotion/buyerShow/commentInfo")`）：
//! - `com.tigshop.bean.query.promotion.buyershow.BuyerShowCommentPageQuery`（列表查询）
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowCommentAuditParam`（审核）
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowCommentShowOrHideParam`（公开/隐藏）
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowCommentIsTopParam`（置顶）
//! - `com.tigshop.bean.dto.common.BatchDTO`（批量操作）
//! - `com.tigshop.bean.vo.promotion.buyershow.BuyerShowCommentPageVO`（列表出参）
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! ## 为什么在本文件内重新定义 `BatchDTO`
//!
//! 共享的 `tigshop_core::models::catalog::category_all::BatchDTO` 已存在（`ids` / `type` / `value`
//! 三字段），但 Java 侧 `BatchDTO.value` 是**基本类型 `int`**（缺省 `0`），
//! 而共享版为 `Option<i32>`（缺省 `None`）；`batch` 的 `audit` 分支会把这个值写入
//! `status` 与 `is_show`，`None` 与 `0` 落库结果不同（`NULL` vs `0`）。
//! 为避免静默改变语义，本切片按 Java 声明在本文件内还原（含 Java 有而共享版
//! 缺失的 `data` 字段，仅反序列化时保留，不参与业务）。
//!
//! ## 参数校验
//!
//! Java 用 `@NotNull` + `@Validated` 在进入服务前拦截；Rust 侧改为 `Option<T>`
//! 字段 + 服务层显式校验，错误文案与 Java 逐一对照（见 `services::buyer_show_comment`）。

use serde::{Deserialize, Serialize};

// ————————————————————— 查询参数 —————————————————————

/// 买家秀评论列表查询（Java `BuyerShowCommentPageQuery extends BasePage`）。
///
/// 分页字段沿用 Java `BasePage` 语义：`page` 缺省 1，`size` 缺省 15、上限 100。
/// `status` 的取值语义见 [`BuyerShowCommentListQuery::normalized_status`]。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentListQuery {
    /// 页码，从 1 开始
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
    /// 排序字段（Java 属性名驼峰，或真实列名）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余/缺省按降序）
    pub sort_order: Option<String>,
    /// 买家秀ID
    pub buyer_show_id: Option<i32>,
    /// 状态（-1：待审核，0：隐藏，1：公开；其余值过滤为空结果）
    pub status: Option<i32>,
    /// 创建开始时间 `yyyy-MM-dd`
    pub start_time: Option<String>,
    /// 创建结束时间 `yyyy-MM-dd`
    pub end_time: Option<String>,
}

impl BuyerShowCommentListQuery {
    /// 页码（Java `BasePage.getPage()`：空则 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（Java `BasePage.getSize()`：空则 15，超过 100 截断为 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数（保持与 `PageResult` 口径一致）。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// 归一化 `status` 参数。
    ///
    /// Java `BuyerShowCommentServiceImpl#list` 对 `status` 的处理是：
    /// - `status == -1` → `status = 0`（待审核）；
    /// - 其余非空值原样保留，用于过滤 `is_show`。
    ///
    /// 注意 Java 中 `Integer status == -1` 是**引用比较**（`Integer.valueOf(-1)` 恰好在
    /// 缓存区间 `[-128,127]` 内，故行为确定）；`status > -1` 会先拆箱，`null` 时短路。
    #[must_use]
    pub fn normalized_status(&self) -> Option<i32> {
        match self.status {
            Some(-1) => Some(0),
            Some(v) => Some(v),
            None => None,
        }
    }
}

// ————————————————————— 操作入参 —————————————————————

/// 审核参数（Java `BuyerShowCommentAuditParam`）。
///
/// Java 两个字段都是 `@NotNull`，文案分别为「买家秀评论ID不能为空」与「审核状态不能为空」。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentAuditParam {
    /// 买家秀评论ID
    pub buyer_show_comment_id: Option<i32>,
    /// 审核状态（1：通过，2：不通过）
    pub status: Option<i32>,
}

/// 公开/隐藏参数（Java `BuyerShowCommentShowOrHideParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentShowOrHideParam {
    /// 买家秀评论ID
    pub buyer_show_comment_id: Option<i32>,
    /// 状态（0：隐藏，1：公开）
    pub is_show: Option<i32>,
}

/// 置顶参数（Java `BuyerShowCommentIsTopParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentIsTopParam {
    /// 买家秀评论ID
    pub buyer_show_comment_id: Option<i32>,
    /// 是否置顶（0：否，1：是）
    pub is_top: Option<i32>,
}

/// 批量操作请求体（Java `com.tigshop.bean.dto.common.BatchDTO`）。
///
/// 本切片仅实现 `type == "audit"`（与服务层 `BuyerShowCommentServiceImpl#batch` 一致，
/// 其余 type 返回 `false`，无副作用）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合（Java `@NotEmpty`，为空时报「未选择项目」）
    pub ids: Option<Vec<i32>>,
    /// 操作类型（Java `@NotNull`，为空时报「操作类型不能为空」）
    pub r#type: Option<String>,
    /// 值：`audit` 分支写入 `status`，并据此推导 `is_show`
    /// （Java 为基本类型 `int`，JSON 缺省时为 `0`；Rust 侧缺省同样取 `0`）。
    pub value: Option<i32>,
    /// 数据（Java 声明但本链路未使用）
    pub data: Option<serde_json::Value>,
}

impl BatchDTO {
    /// `value` 归一化：Java 基本类型 `int` 缺省为 `0`，显式 `null` 亦然。
    #[must_use]
    pub fn value_or_zero(&self) -> i32 {
        self.value.unwrap_or(0)
    }

    /// 操作类型是否为空（Java `@NotNull` 校验的等价判断：`null` 视为空）。
    #[must_use]
    pub fn type_is_null(&self) -> bool {
        self.r#type.is_none()
    }

    /// 是否未选择任何主键（Java `@NotEmpty`：`null` 或空集合均不通过）。
    #[must_use]
    pub fn ids_is_empty(&self) -> bool {
        self.ids.as_ref().is_none_or(Vec::is_empty)
    }

    /// 是否为 `audit` 批量操作（Java `"audit".equals(batchDTO.getType())`）。
    #[must_use]
    pub fn is_audit(&self) -> bool {
        self.r#type.as_deref() == Some("audit")
    }
}

// ————————————————————— 出参 —————————————————————

/// 买家秀评论列表项（Java `BuyerShowCommentPageVO`）。
///
/// 字段顺序与 Java 一致；`statusText` / `userName` / `addTime` 为派生字段
/// （见 `services::buyer_show_comment`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentPageVO {
    /// 买家秀ID
    pub buyer_show_id: i32,
    /// 买家秀评论ID
    pub buyer_show_comment_id: i32,
    /// 发布时间（`yyyy-MM-dd HH:mm:ss`；时间戳为 0 时空串）
    pub add_time: String,
    /// 发布人（`昵称或用户名` + `(系统)` / `(客户)`）
    pub user_name: String,
    /// 是否置顶（0：否，1：是）
    pub is_top: i32,
    /// 状态（0：待审核，1：通过，2：拒绝）
    pub status: i32,
    /// 是否显示（0：隐藏，1：公开）
    pub is_show: i32,
    /// 当前状态（待审核，隐藏，公开）
    pub status_text: String,
    /// 评论内容
    pub content: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_defaults_match_base_page() {
        let q = BuyerShowCommentListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        assert_eq!(q.page_query().page_size, 15);
    }

    #[test]
    fn page_size_is_capped_at_100() {
        let q: BuyerShowCommentListQuery =
            serde_json::from_str(r#"{"page":2,"size":500}"#).unwrap();
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.page_size(), 100);
        assert_eq!(q.page_query().page_size, 100);

        // `pageSize` 别名（前端两种写法都接受）
        let q: BuyerShowCommentListQuery =
            serde_json::from_str(r#"{"page":1,"pageSize":3}"#).unwrap();
        assert_eq!(q.page_size(), 3);
    }

    #[test]
    fn status_is_normalized_like_java() {
        let q = BuyerShowCommentListQuery {
            status: Some(-1),
            ..Default::default()
        };
        assert_eq!(q.normalized_status(), Some(0));

        let q = BuyerShowCommentListQuery {
            status: Some(1),
            ..Default::default()
        };
        assert_eq!(q.normalized_status(), Some(1));

        let q = BuyerShowCommentListQuery::default();
        assert_eq!(q.normalized_status(), None);
    }

    #[test]
    fn query_deserializes_camel_case() {
        let q: BuyerShowCommentListQuery = serde_json::from_str(
            r#"{"buyerShowId":7,"status":0,"startTime":"2026-01-01","endTime":"2026-01-31","sortField":"addTime","sortOrder":"asc"}"#,
        )
        .unwrap();
        assert_eq!(q.buyer_show_id, Some(7));
        assert_eq!(q.status, Some(0));
        assert_eq!(q.start_time.as_deref(), Some("2026-01-01"));
        assert_eq!(q.end_time.as_deref(), Some("2026-01-31"));
        assert_eq!(q.sort_field.as_deref(), Some("addTime"));
        assert_eq!(q.sort_order.as_deref(), Some("asc"));
    }

    #[test]
    fn batch_defaults_value_to_zero() {
        // Java `int value` 的缺省语义：JSON 中不出现该字段时为 0
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"audit"}"#).unwrap();
        assert_eq!(dto.value_or_zero(), 0);
        assert!(dto.is_audit());
        assert!(!dto.type_is_null());
        assert!(!dto.ids_is_empty());

        // 显式 null 同样落到 0（Java 基本类型不会为 null）
        let dto: BatchDTO =
            serde_json::from_str(r#"{"ids":[1],"type":"audit","value":null}"#).unwrap();
        assert_eq!(dto.value_or_zero(), 0);

        // 空 ids / 缺 type
        let dto: BatchDTO = serde_json::from_str(r#"{"type":"audit"}"#).unwrap();
        assert!(dto.ids_is_empty());
        let dto: BatchDTO = serde_json::from_str(r#"{"ids":[]}"#).unwrap();
        assert!(dto.ids_is_empty());
        assert!(dto.type_is_null());
        assert!(!dto.is_audit());
    }

    #[test]
    fn param_validation_fields_are_optional() {
        // 缺字段必须能反序列化成功（由服务层给出 Java 同文案的校验错误，
        // 而不是 serde 的 400）
        let p: BuyerShowCommentAuditParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.buyer_show_comment_id, None);
        assert_eq!(p.status, None);

        let p: BuyerShowCommentShowOrHideParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.is_show, None);

        let p: BuyerShowCommentIsTopParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.is_top, None);
    }

    #[test]
    fn page_vo_serializes_camel_case() {
        let vo = BuyerShowCommentPageVO {
            buyer_show_id: 3,
            buyer_show_comment_id: 9,
            add_time: "2026-01-01 08:00:00".into(),
            user_name: "张三(客户)".into(),
            is_top: 1,
            status: 1,
            is_show: 1,
            status_text: "公开".into(),
            content: Some("很好".into()),
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["buyerShowCommentId"], 9);
        assert_eq!(json["userName"], "张三(客户)");
        assert_eq!(json["statusText"], "公开");
        assert_eq!(json["content"], "很好");
    }
}
