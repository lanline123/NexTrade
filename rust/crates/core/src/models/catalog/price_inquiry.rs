//! 商品询价域 DTO / VO / 查询参数 / 纯函数。
//!
//! 对应 Java：
//! - `com.tigshop.bean.dto.product.PriceInquiryDTO`（extends `BasePage`）
//! - `com.tigshop.bean.dto.product.PriceInquiryReplyDTO`
//! - `com.tigshop.bean.vo.product.PriceInquiryVO`（含内部类 `ProductVO`）
//! - `com.tigshop.bean.vo.product.PriceInquiryReplyRecordVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `BatchDTO` / `UpdateFieldDTO`
//! - `com.tigshop.common.utils.TigUtils#handelTime(Long)`
//! - `com.tigshop.service.common.impl.BaseServiceImpl#buildSortOrder`
//!
//! JSON 字段全部保持 camelCase，与原接口一致。
//!
//! # 与 Java 的对照要点
//!
//! - `PriceInquiryDTO` 继承 `BasePage`（`page` / `size` / `sortField` /
//!   `keyword` / `sortOrder` / `sortItems`）。其中 `size` 是 **HTTP 参数名**，
//!   与项目内部 `PageQuery::pageSize` 不同，故由 [`PriceInquiryQuery::page_query`]
//!   做一次桥接；`sortItems` 多字段排序 Java 本域**没有使用**
//!   （调用的是三参重载 `buildSortOrder(page, sortField, sortOrder)`），
//!   本实现同样忽略。
//! - `create_time` 在库中是 `int unsigned NULL`，Java 侧 `Long`；
//!   时间戳按秒处理（i32），输出时经 [`format_unix_time`] 格式化为
//!   `yyyy-MM-dd HH:mm:ss`（UTC+8），与 `TigUtils.handelTime` 一致。
//! - `OperateDTO` / `BatchDTO` / `UpdateFieldDTO` 在本文件内定义同构副本
//!   （与 `models::catalog::brand` 的做法一致）：本切片不得修改共享文件，
//!   且 Java 这几个 DTO 的校验注解/字段随控制器而变，副本可精确对齐
//!   `PriceInquiryController` 的 `@Valid` 语义。

use serde::{Deserialize, Serialize};

use crate::entities::PriceInquiryReplyRecord;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量（对应 Java `BaseServiceImpl` / `ResultTextConstants` / 注解文案）
// ——————————————————————————————————————————————

/// 主键列（Java `BaseServiceImpl#getKeyColumn` → `id`）。
pub const KEY_COLUMN: &str = "id";

/// 主键属性名（Java `BaseServiceImpl#getKeyProperty` → `id`）。
pub const KEY_PROPERTY: &str = "id";

/// `price_inquiry` 的真实列清单（`python tools/schema_parser.py --table price_inquiry`）。
///
/// 顺序与实体 [`crate::entities::PriceInquiry`] 的字段顺序一致。
pub const INQUIRY_COLUMNS: [&str; 11] = [
    "id",
    "mobile",
    "email",
    "content",
    "product_id",
    "remark",
    "status",
    "shop_id",
    "user_id",
    "user_is_del",
    "create_time",
];

/// 询价不存在（Java `PriceInquiryServiceImpl` 抛 `GlobalException("询价信息不存在")`）。
pub const INQUIRY_NOT_FOUND: &str = "询价信息不存在";

/// 回复内容为空（Java `@NotBlank(message = "回复内容不能为空")`）。
pub const REPLY_CONTENT_REQUIRED: &str = "回复内容不能为空";

/// 回复内容超长（Java `@Size(min = 1, max = 100)` 的 message 原文如此，
/// 文案里写的是 255 但实际上限是 100，本实现按**注解真实值 100** 执行）。
pub const REPLY_CONTENT_TOO_LONG: &str = "回复内容长度在1到255之间";

/// 回复内容最大字符数（Java `@Size(max = 100)`；按字符数而非字节数）。
pub const REPLY_CONTENT_MAX_LEN: usize = 100;

/// 主键为空（Java `@NotNull(message = "id不能为空")`）。
pub const ID_REQUIRED: &str = "id不能为空";

/// 未选中任何条目（Java `BatchDTO.ids` 的 `@NotEmpty(message = "未选择项目")`）。
pub const UNSELECTED_ITEM: &str = "未选择项目";

/// 操作类型为空（Java `BatchDTO.type` 的 `@NotNull(message = "操作类型不能为空")`）。
pub const OPERATION_TYPE_REQUIRED: &str = "操作类型不能为空";

/// 字段名为空（Java `UpdateFieldDTO.field` 的 `@NotNull` 文案）。
pub const FIELD_NAME_REQUIRED: &str = "字段名不能为空";

/// 字段值为空（Java `UpdateFieldDTO.val` 的 `@NotNull` 文案）。
pub const FIELD_VALUE_REQUIRED: &str = "值不能为空";

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 询价列表查询（对应 Java `PriceInquiryDTO extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PriceInquiryQuery {
    /// 手机号（`like` 模糊匹配）
    pub mobile: Option<String>,
    /// 回复状态：0 未回复 1 已回复
    pub status: Option<i32>,
    /// 商品关键词（商品名称 / 编号 / TSN），服务层先查商品 ID 再按 `IN` 过滤
    pub keyword: Option<String>,
    /// 店铺 ID（控制器用请求头 `x-admin-type`/`x-shop-id` **覆盖**该值）
    pub shop_id: Option<i32>,
    /// 用户 ID
    pub user_id: Option<i32>,
    /// 用户侧是否删除：0 否 1 是
    pub user_is_del: Option<i32>,
    /// 排序字段（属性名或列名，未识别回退主键）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 页码，从 1 开始（Java `BasePage.page`，null ⇒ 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，null ⇒ 15，上限 100）
    pub size: Option<u64>,
}

impl PriceInquiryQuery {
    /// 转成内部 [`PageQuery`]（Java `BasePage.getPage()` / `getSize()` 语义）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            // Java `getSize()`：null ⇒ 15；> 100 ⇒ 100
            page_size: self.size.unwrap_or(15).min(100),
        }
    }

    /// 有效关键字（Java `StrUtil.isNotBlank(keyword)`：**去空白后**为空则不过滤）。
    ///
    /// 注意 Java 判空用 `isNotBlank`，但 `LIKE` 绑定的是**原始值**
    /// （不 trim），故返回原始切片。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        self.keyword.as_deref().filter(|s| !s.trim().is_empty())
    }

    /// 有效手机号过滤值（Java `like(StrUtil.isNotBlank(mobile), mobile)`：
    /// **去空白后**为空则不过滤；`LIKE` 绑定原始值，不 trim）。
    #[must_use]
    pub fn effective_mobile(&self) -> Option<&str> {
        self.mobile.as_deref().filter(|s| !s.trim().is_empty())
    }

    /// 解析 ORDER BY 子句（列名来自白名单，无注入面）。
    ///
    /// 与 Java `BaseServiceImpl#buildSortOrder(page, sortField, sortOrder)` 等价：
    /// - `sortField` 为空、等于主键属性名 `id` 或列名 `id` → 主键列
    /// - 属性名 / 列名命中白名单 → 该列；未命中一律回退主键列（防注入）
    /// - `asc`（忽略大小写）升序；`desc`、空 → 降序
    /// - **其它任何值**：Java 的 `if (asc) {} else if (desc || empty) {}`
    ///   两个分支都不命中 ⇒ 不追加 ORDER BY（保持 `page.orders` 为空）
    #[must_use]
    pub fn order_clause(&self) -> String {
        let field = self.sort_field.as_deref().map(str::trim).unwrap_or("");
        let column = if field.is_empty() || field == KEY_PROPERTY || field == KEY_COLUMN {
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

/// 排序字段 → 列名（对应 Java `BaseServiceImpl#getColumnByPropertyName`）。
///
/// 只允许 `price_inquiry` 的真实列；属性名（camelCase）与列名（snake_case）
/// 都可命中，未命中一律回退主键列（与 Java 的安全修复行为一致，不是报错）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "mobile" => "mobile",
        "email" => "email",
        "content" => "content",
        "productId" | "product_id" => "product_id",
        "remark" => "remark",
        "status" => "status",
        "shopId" | "shop_id" => "shop_id",
        "userId" | "user_id" => "user_id",
        "userIsDel" | "user_is_del" => "user_is_del",
        "createTime" | "create_time" => "create_time",
        // Java 找不到时返回主键列（防 SQL 注入）
        _ => KEY_COLUMN,
    }
}

/// 询价回复入参（对应 Java `PriceInquiryReplyDTO`）。
///
/// Java 校验注解：
/// - `id`：`@NotNull(message = "id不能为空")`
/// - `remark`：`@NotBlank(message = "回复内容不能为空")` +
///   `@Size(min = 1, max = 100, message = "回复内容长度在1到255之间")`
///
/// 本结构体保留 `Option` 以容忍缺字段，校验在服务层（`reply`）执行。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PriceInquiryReplyDTO {
    /// 询价主键
    pub id: Option<i32>,
    /// 回复内容
    pub remark: Option<String>,
}

/// 单 ID 操作请求（对应 Java `bean.dto.common.OperateDTO`，只用到 `id`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
}

/// 批量操作请求（对应 Java `bean.dto.common.BatchDTO`）。
///
/// Java 校验注解：`ids` `@NotEmpty`、`type` `@NotNull`。
/// `PriceInquiryController#batch` 带 `@Valid`，故注解生效。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合
    pub ids: Option<Vec<i32>>,
    /// 操作类型，本域仅支持 `del`
    #[serde(default)]
    pub r#type: Option<String>,
    /// 值（本域未使用）
    #[serde(default)]
    pub value: Option<i32>,
}

/// 通用字段更新请求（对应 Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    /// 主键
    pub id: Option<i32>,
    /// 字段名
    pub field: Option<String>,
    /// 值
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

// ——————————————————————————————————————————————
// 出参 VO
// ——————————————————————————————————————————————

/// 询价列表 / 详情 VO（对应 Java `PriceInquiryVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceInquiryVO {
    /// 主键
    pub id: i32,
    /// 联系电话
    pub mobile: String,
    /// 联系邮箱
    pub email: String,
    /// 需求信息
    pub content: String,
    /// 商品 ID
    pub product_id: i32,
    /// 回复备注
    pub remark: String,
    /// 回复状态：0 未回复 1 已回复
    pub status: i32,
    /// 店铺 ID
    pub shop_id: i32,
    /// 用户 ID
    pub user_id: i32,
    /// 创建时间（`yyyy-MM-dd HH:mm:ss`，空值 ⇒ `""`）
    pub create_time: String,
    /// 商品摘要（商品已删除时 `None`）
    pub product: Option<PriceInquiryProductVO>,
    /// 回复记录（列表接口 Java 不设置，保持 `None`）
    pub reply_records: Option<Vec<PriceInquiryReplyRecordVO>>,
}

/// 询价商品摘要（对应 Java `PriceInquiryVO.ProductVO`）。
///
/// 注意：管理端 VO **不含**价格字段（价格仅在商城端 `PriceInquiryDetailVO`
/// 的 `ProductVO` 里出现），故这里只有 4 个字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceInquiryProductVO {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称（Java 标注 `@JsonTranslate(dataType = 2)`，翻译能力未迁移）
    pub product_name: String,
    /// 商品编号
    pub product_sn: String,
    /// 缩略图（Java 取 `product.getPicUrl()`，即原图列，不是 `pic_thumb`）
    pub pic_thumb: String,
}

/// 询价回复记录 VO（对应 Java `PriceInquiryReplyRecordVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PriceInquiryReplyRecordVO {
    /// 回复人名称
    pub reply_name: String,
    /// 回复时间（`yyyy-MM-dd HH:mm:ss`）
    pub create_time: String,
    /// 回复内容
    pub content: String,
    /// 回复类型：1 商家回复 2 用户回复
    pub reply_type: i32,
}

// ——————————————————————————————————————————————
// 纯函数
// ——————————————————————————————————————————————

/// 秒级时间戳 → Java `TigUtils.handelTime(Long)` 的 `yyyy-MM-dd HH:mm:ss`。
///
/// Java 语义：`null` 或 `0` 返回空串；否则按 **JVM 默认时区 + 8 小时**
/// （本项目部署在 UTC+8）格式化。
#[must_use]
pub fn format_unix_time(secs: Option<i32>) -> String {
    let Some(secs) = secs.filter(|s| *s != 0) else {
        return String::new();
    };
    let Some(utc) = chrono::DateTime::from_timestamp(i64::from(secs), 0) else {
        return String::new();
    };
    (utc.naive_utc() + chrono::Duration::hours(8))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

/// 实体 → 基础 VO（不含商品 / 回复记录，对应 Java `BeanUtil.copyProperties`
/// + `setCreateTime(TigUtils.handelTime(...))`）。
#[must_use]
pub fn inquiry_to_vo(entity: &crate::entities::PriceInquiry) -> PriceInquiryVO {
    PriceInquiryVO {
        id: entity.id,
        mobile: entity.mobile.clone(),
        email: entity.email.clone(),
        content: entity.content.clone(),
        product_id: entity.product_id,
        remark: entity.remark.clone(),
        status: entity.status,
        shop_id: entity.shop_id,
        user_id: entity.user_id,
        create_time: format_unix_time(entity.create_time),
        product: None,
        reply_records: None,
    }
}

/// 回复记录 → VO 列表（对应 Java `buildReplyRecords`）：
/// - 有记录：逐条转换（`createTime` 走 `TigUtils.handelTime`），按
///   `create_time ASC, id ASC` 排序（排序由仓储 SQL 保证）
/// - 无记录但询价 `remark` 非空白：生成一条「商家」兜底记录，
///   `createTime` 为空串、`replyType = 1`（与 Java 完全一致）
/// - 否则：空列表
#[must_use]
pub fn build_reply_records(
    records: &[PriceInquiryReplyRecord],
    remark: &str,
) -> Vec<PriceInquiryReplyRecordVO> {
    if records.is_empty() {
        if remark.trim().is_empty() {
            return Vec::new();
        }
        return vec![PriceInquiryReplyRecordVO {
            reply_name: "商家".to_string(),
            create_time: String::new(),
            content: remark.to_string(),
            reply_type: 1,
        }];
    }
    records
        .iter()
        .map(|r| PriceInquiryReplyRecordVO {
            reply_name: r.reply_name.clone(),
            create_time: format_unix_time(Some(r.create_time)),
            content: r.content.clone(),
            reply_type: r.reply_type,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    // ———————————————— 查询参数 ————————————————

    #[test]
    fn query_accepts_java_param_names() {
        let q: PriceInquiryQuery = serde_json::from_str(
            r#"{"mobile":"138","status":1,"keyword":"苹果","shopId":3,
                "userId":7,"userIsDel":0,"page":2,"size":30,
                "sortField":"createTime","sortOrder":"asc"}"#,
        )
        .expect("PriceInquiryQuery 应接受 camelCase Java 参数名");
        assert_eq!(q.mobile.as_deref(), Some("138"));
        assert_eq!(q.status, Some(1));
        assert_eq!(q.keyword.as_deref(), Some("苹果"));
        assert_eq!(q.shop_id, Some(3));
        assert_eq!(q.user_id, Some(7));
        assert_eq!(q.user_is_del, Some(0));
        assert_eq!(q.page_query().page, 2);
        assert_eq!(q.page_query().page_size, 30);
        assert_eq!(q.order_clause(), " ORDER BY create_time ASC");
    }

    #[test]
    fn query_defaults_match_base_page() {
        let q: PriceInquiryQuery = serde_json::from_str(r#"{}"#).unwrap();
        assert_eq!(q.page_query().page, 1);
        assert_eq!(q.page_query().page_size, 15, "BasePage.getSize() 默认 15");
        assert_eq!(q.effective_keyword(), None);
        assert_eq!(q.effective_mobile(), None);
        // 空 sortField ⇒ 主键列；空 sortOrder ⇒ 降序
        assert_eq!(q.order_clause(), " ORDER BY id DESC");
    }

    #[test]
    fn query_size_is_capped_at_100() {
        let q: PriceInquiryQuery = serde_json::from_str(r#"{"size":500}"#).unwrap();
        assert_eq!(
            q.page_query().page_size,
            100,
            "BasePage.getSize() > 100 ⇒ 100"
        );
    }

    #[test]
    fn order_clause_follows_java_three_branches() {
        // 属性名 / 列名都能命中
        for (field, column) in [
            ("productId", "product_id"),
            ("product_id", "product_id"),
            ("userIsDel", "user_is_del"),
            ("status", "status"),
        ] {
            let q = PriceInquiryQuery {
                sort_field: Some(field.into()),
                sort_order: Some("DESC".into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), format!(" ORDER BY {column} DESC"));
        }
        // 主键属性名/列名 → 主键列
        for field in ["id", "Id"] {
            let q = PriceInquiryQuery {
                sort_field: Some(field.into()),
                ..Default::default()
            };
            assert_eq!(q.order_clause(), " ORDER BY id DESC");
        }
        // 未识别字段回退主键（防注入）
        let q = PriceInquiryQuery {
            sort_field: Some("1; DROP TABLE price_inquiry".into()),
            sort_order: Some("asc".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), " ORDER BY id ASC");
        // 非法 sortOrder ⇒ 不追加 ORDER BY（Java if/else-if 落空）
        let q = PriceInquiryQuery {
            sort_order: Some("ascending".into()),
            ..Default::default()
        };
        assert_eq!(q.order_clause(), "");
    }

    #[test]
    fn map_order_column_rejects_unknown() {
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
        assert_eq!(map_order_column("mobile"), "mobile");
        assert_eq!(map_order_column("shopId"), "shop_id");
    }

    // ———————————————— 时间格式化 ————————————————

    #[test]
    fn handel_time_matches_java() {
        // null / 0 ⇒ 空串（Java `TigUtils.handelTime`）
        assert_eq!(format_unix_time(None), "");
        assert_eq!(format_unix_time(Some(0)), "");
        // 2023-11-14T22:13:20Z + 8h = 2023-11-15 06:13:20
        assert_eq!(format_unix_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        // 1970-01-01T00:00:00Z + 8h
        assert_eq!(format_unix_time(Some(1)), "1970-01-01 08:00:01");
    }

    // ———————————————— 回复记录 ————————————————

    fn record(
        id: i32,
        reply_type: i32,
        name: &str,
        content: &str,
        ts: i32,
    ) -> PriceInquiryReplyRecord {
        PriceInquiryReplyRecord {
            id,
            inquiry_id: 9,
            reply_type,
            reply_name: name.into(),
            content: content.into(),
            admin_id: 1,
            user_id: 0,
            create_time: ts,
        }
    }

    #[test]
    fn reply_records_map_entity_fields() {
        let rows = vec![
            record(1, 1, "admin", "收到", 1_700_000_000),
            record(2, 2, "用户", "谢谢", 1_700_000_100),
        ];
        let vos = build_reply_records(&rows, "旧备注");
        assert_eq!(vos.len(), 2);
        assert_eq!(vos[0].reply_name, "admin");
        assert_eq!(vos[0].content, "收到");
        assert_eq!(vos[0].reply_type, 1);
        assert_eq!(vos[0].create_time, "2023-11-15 06:13:20");
        assert_eq!(vos[1].reply_type, 2);
    }

    #[test]
    fn empty_records_fall_back_to_remark() {
        // Java：无回复记录但 remark 非空白 ⇒ 一条「商家」兜底记录（createTime 空串）
        let vos = build_reply_records(&[], "已电话联系");
        assert_eq!(vos.len(), 1);
        assert_eq!(vos[0].reply_name, "商家");
        assert_eq!(vos[0].create_time, "");
        assert_eq!(vos[0].content, "已电话联系");
        assert_eq!(vos[0].reply_type, 1);
        // remark 空白 ⇒ 空列表
        assert!(build_reply_records(&[], "   ").is_empty());
        assert!(build_reply_records(&[], "").is_empty());
    }

    // ———————————————— DTO / VO ————————————————

    #[test]
    fn reply_dto_parses_body() {
        let d: PriceInquiryReplyDTO =
            serde_json::from_str(r#"{"id":5,"remark":"已回复"}"#).unwrap();
        assert_eq!(d.id, Some(5));
        assert_eq!(d.remark.as_deref(), Some("已回复"));
    }

    #[test]
    fn batch_dto_type_is_not_reserved() {
        let b: BatchDTO = serde_json::from_str(r#"{"ids":[1,2],"type":"del"}"#).unwrap();
        assert_eq!(b.ids, Some(vec![1, 2]));
        assert_eq!(b.r#type.as_deref(), Some("del"));
    }

    #[test]
    fn vo_serializes_camel_case() {
        let vo = PriceInquiryVO {
            id: 1,
            product_id: 8,
            create_time: "2023-11-15 06:13:20".into(),
            product: Some(PriceInquiryProductVO {
                product_id: 8,
                product_name: "苹果".into(),
                product_sn: "SN001".into(),
                pic_thumb: "/a.jpg".into(),
            }),
            ..Default::default()
        };
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["productId"], 8);
        assert_eq!(json["createTime"], "2023-11-15 06:13:20");
        assert_eq!(json["product"]["productName"], "苹果");
        assert_eq!(json["product"]["picThumb"], "/a.jpg");
        assert!(json["replyRecords"].is_null());
    }
}
