//! 买家秀域（marketing::buyer_show）DTO / VO / 查询参数 / 入参。
//! 对应 Java `com.tigshop.adminapi.controller.promotion.BuyerShowController`
//! （`@RequestMapping("/adminapi/promotion/buyerShow")`）及其依赖的
//! `bean.query.promotion.buyershow.BuyerShowPageQuery` /
//! `bean.param.promotion.buyershow.*` / `bean.vo.promotion.buyershow.*` /
//! `bean.model.promotion.BuyerShowVideo` / `bean.model.setting.GalleryPic`。
//!
//! | Rust 类型 | 原 Java |
//! |-----------|---------|
//! | [`BuyerShowListQuery`] | `query.promotion.buyershow.BuyerShowPageQuery extends BasePage` |
//! | [`BuyerShowSavePayload`] | `param.promotion.buyershow.BuyerShowSaveParam` |
//! | [`BuyerShowUpdatePayload`] | `param.promotion.buyershow.BuyerShowUpdateParam` |
//! | [`BuyerShowAuditPayload`] | `param.promotion.buyershow.BuyerShowAuditParam` |
//! | [`BuyerShowBatchDeletePayload`] | `param.promotion.buyershow.BuyerShowBatchDeleteParam` |
//! | [`BuyerShowShowOrHidePayload`] | `param.promotion.buyershow.BuyerShowShowOrHideParam` |
//! | [`BuyerShowCommentPayload`] | `param.promotion.buyershow.BuyerShowCommentParam` |
//! | [`BuyerShowVideoPayload`] | `model.promotion.BuyerShowVideo`（入参写法，`id` 被忽略） |
//! | [`GalleryPicPayload`] | `model.setting.GalleryPic`（只用到 `picUrl` / `picThumb`） |
//! | [`BuyerShowPageVO`] | `vo.promotion.buyershow.BuyerShowPageVO` |
//! | [`BuyerShowVO`] | `vo.promotion.buyershow.BuyerShowVO` |
//! | [`BuyerVO`] | `vo.promotion.buyershow.BuyerVO` |
//! | [`BuyerShowVideoVO`] | `model.promotion.BuyerShowVideo`（出参，Jackson 按 camelCase 序列化） |
//! | [`BuyerShowGalleryVO`] | `model.promotion.BuyerShowGallery`（出参，同上） |
//!
//! `OperateDTO` / `BatchDTO` / `UpdateFieldDTO`（`@RequestBody` 的公共 DTO）
//! 直接复用 `tigshop_core::models::{OperateDTO, BatchDTO, UpdateFieldDTO}`
//! （`models::catalog` 已定义，字段与 Java 逐字一致），本文件不重复定义。
//!
//! ## 约定与「不可推测」的地方
//!
//! - 时间口径：`buyer_show.add_time` / `buyer_show_comment.add_time` 在库中是
//!   **秒级 bigint**（`java/database/pure.sql`），Java 出入参都用
//!   `StringUtils.getCurrentTime()`（秒）与 `TigUtils.handelTime(秒)`
//!   （→ `yyyy-MM-dd HH:mm:ss` 字符串）。本文件入参用 `i64` 秒，
//!   出参用格式化后的 `String`。
//! - 金额：本域**无金额字段**（不涉及 `Decimal`）。`productCount` /
//!   `likeCount` / `commentCount` 均为计数。
//! - `BuyerShowSaveParam.rangeData` 在 Java 上是 `List<Integer>` 且
//!   以 `JSONUtil.toJsonStr` 落库；本文件用 `Option<Vec<i32>>` +
//!   `#[serde(default)]`，缺省时由服务层报「关联商品不能为空」
//!   （对应 Java `@NotEmpty`；Rust 侧无 Bean Validation 框架，
//!   故校验放在服务层，错误文案与 Java 逐字一致）。
//! - Java `BuyerShowSaveParam.buyerShowVideoList` / `imgList` 的**元素类型**
//!   是实体类（`model.promotion.BuyerShowVideo` / `model.setting.GalleryPic`），
//!   前端只传其中一部分字段。本文件只声明前端实际会传的字段，
//!   其余（`picId` / `picName` / `picSort` / `addTime` / `vendorId` …）
//!   在 Java 侧也不参与 `saveOrUpdateBuyerShowGallery` 的写库，故不声明。

use serde::{Deserialize, Serialize};

/// 「非真实用户」（Java 常量：买家秀 `user_id = 0` 表示系统虚拟买家）。
pub const VIRTUAL_USER_ID: i32 = 0;

/// `buyer_show` 审核状态：待审核（Java `BuyerShow.status = 0`）。
pub const STATUS_PENDING: i32 = 0;
/// `buyer_show` 审核状态：审核通过（Java `BuyerShow.status = 1`）。
pub const STATUS_APPROVED: i32 = 1;
/// `buyer_show` 审核状态：审核拒绝（Java `BuyerShow.status = 2`）。
pub const STATUS_REJECTED: i32 = 2;

/// `buyer_show` 公开标记：公开（Java `Constants.YES = 1`）。
pub const IS_SHOW_YES: i32 = 1;
/// `buyer_show` 公开标记：隐藏（Java `Constants.NO = 0`）。
pub const IS_SHOW_NO: i32 = 0;

/// `updateField` 允许更新的列（Java `CheckFieldConstants.BUYER_SHOW_CONFIG_FIELDS`
/// = `{"sort_order"}`）。
///
/// ⚠️ 逐字照抄：只有 `sort_order` 一个列。Java `BaseServiceImpl#updateField`
/// 先把属性名映射为列名（`sortOrder` / `sort_order` 都映射到 `sort_order`），
/// 再与白名单比较，不在白名单内即抛 `GlobalException("field 的值有误")`。
pub const BUYER_SHOW_CONFIG_FIELDS: [&str; 1] = ["sort_order"];

/// `buyer_show` 允许通过 `updateField` 更新的列（Java 白名单校验的等价物）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BuyerShowEditableField {
    /// 排序列 `sort_order`
    SortOrder,
}

impl BuyerShowEditableField {
    /// 数据库列名。
    #[must_use]
    pub fn column(self) -> &'static str {
        match self {
            Self::SortOrder => BUYER_SHOW_CONFIG_FIELDS[0],
        }
    }
}

/// 把 Java 属性名 / 列名映射为 `updateField` 白名单内的列。
///
/// 复刻 Java `BaseServiceImpl#updateField` 的两步：
/// 1. `getColumnByPropertyName(field)` —— 属性名/列名匹配则返回列名，
///    **匹配不到回落主键列** `buyer_show_id`（原码注释：防 SQL 注入）；
/// 2. 与白名单 `BUYER_SHOW_CONFIG_FIELDS` 比较，不在其中即抛
///    `GlobalException("field 的值有误")`。
///
/// 因此：`sortOrder` / `sort_order` → 通过；其余（含未知字段，因为回落得到的
/// `buyer_show_id` 也不在白名单）→ 一律返回 `None`。
#[must_use]
pub fn resolve_editable_field(field: Option<&str>) -> Option<BuyerShowEditableField> {
    match field.map(str::trim) {
        Some("sortOrder" | "sort_order") => Some(BuyerShowEditableField::SortOrder),
        // 未知属性在 Java 会回落主键列 buyer_show_id，而它不在白名单内 → 同样报错
        _ => None,
    }
}

/// 列表查询的状态视角（对应 Java `BuyerShowPageQuery.status` 的三态语义）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListStatusView {
    /// 未传 `status` —— 不加任何状态条件（Java：`status == null`）。
    All,
    /// `status == -1` —— 只看待审核（Java：`eq(BuyerShow::getStatus, 0)`）。
    Pending,
    /// `status >= 0` —— 排除待审核 + `is_show = status`
    /// （Java：`ne(status, 0)` + `eq(is_show, status)`）。
    ByIsShow(i32),
}

/// 买家秀列表查询（`BuyerShowPageQuery extends BasePage`）。
///
/// Java `BasePage` 提供 `page` / `size` / `keyword` / `sortField` / `sortOrder`；
/// 本域自有的 `status` / `goodsId` / `startTime` / `endTime`。
///
/// `status` 的三态语义（Java 原码，容易读错，此处逐条记录）：
/// - `null` → 无状态条件
/// - `-1`   → `status = 0`（待审核）
/// - `> -1` → `status <> 0` **且** `is_show = status`（0 = 隐藏，1 = 公开）
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowListQuery {
    /// 状态：`-1` 待审核；`0` 隐藏；`1` 公开；缺省不过滤
    pub status: Option<i32>,
    /// 分组 ID —— 落库条件为 `JSON_CONTAINS(group_data, '<goodsId>')`
    /// （Java 用 `queryWrapper.apply("JSON_CONTAINS(group_data, {0})", goodsId)`）
    pub goods_id: Option<i64>,
    /// 创建开始时间（`yyyy-MM-dd`，Java `TigUtils.toTimestampYmd`）
    pub start_time: Option<String>,
    /// 创建结束时间（`yyyy-MM-dd`）
    pub end_time: Option<String>,
    /// 关键词（模糊匹配 `buyer_show.content`）
    pub keyword: Option<String>,
    /// 排序字段（Java 属性名或列名；未知属性在 Java 会回落主键列）
    pub sort_field: Option<String>,
    /// `asc` / `desc`；空视为降序（Java `buildSortOrder`）
    pub sort_order: Option<String>,
    /// 页码，从 1 开始（Java `BasePage.page`）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`；前端亦可能传 `pageSize`）
    #[serde(alias = "pageSize")]
    pub size: Option<u64>,
}

impl BuyerShowListQuery {
    /// 页码（`page` 缺省 1，最小 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（`size` 缺省 15，上限 100 —— 与 Java `BasePage` 一致）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        match self.size {
            None => 15,
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1),
        }
    }

    /// 转为通用分页参数。
    #[must_use]
    pub fn page_query(&self) -> crate::types::PageQuery {
        crate::types::PageQuery {
            page: self.page_no(),
            page_size: self.page_size(),
        }
    }

    /// 关键词（去空白后非空才生效，对应 Java `StrUtil.isNotBlank`）。
    #[must_use]
    pub fn keyword_opt(&self) -> Option<&str> {
        self.keyword
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
    }

    /// 状态视角（见类型文档的三态语义）。
    #[must_use]
    pub fn status_view(&self) -> ListStatusView {
        match self.status {
            None => ListStatusView::All,
            Some(-1) => ListStatusView::Pending,
            Some(v) => ListStatusView::ByIsShow(v),
        }
    }
}

/// 状态名的映射结果（`statusName` 无独立列，仅用于 `statusText`）。
impl ListStatusView {
    /// 该视角是否需要「排除待审核」条件（Java `ne(status, 0)`）。
    #[must_use]
    pub fn excludes_pending(self) -> bool {
        matches!(self, Self::ByIsShow(_))
    }
}

/// 新建/更新买家秀的视频素材入参（对应 Java `model.promotion.BuyerShowVideo`）。
///
/// Java `create` / `update` 会**忽略**入参里的 `id`（`saveOrUpdateBuyerShowVideo`
/// 强制 `setId(null)` 后 `save`），故这里不声明 `id`。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowVideoPayload {
    /// 视频ID（Java 为 `null` 时置 0）
    pub video_id: Option<i32>,
    /// 视频 url（库列 `video_url` NOT NULL）
    pub video_url: Option<String>,
    /// 视频封面（库列 `video_cover` NOT NULL）
    pub video_cover: Option<String>,
    /// 视频格式后缀（库列 `format` NOT NULL）
    pub format: Option<String>,
    /// 排序；`null` 时 Java 用**数组下标**兜底
    pub sort_order: Option<i32>,
}

/// 新建/更新买家秀的图片素材入参（对应 Java `model.setting.GalleryPic` 的用到的子集）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GalleryPicPayload {
    /// 图片地址（库列 `pic_original` 原样落库）
    pub pic_url: Option<String>,
    /// 缩略图地址（库列 `pic_thumb`）
    pub pic_thumb: Option<String>,
}

/// `POST /adminapi/promotion/buyerShow/create` 入参（`BuyerShowSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowSavePayload {
    /// 关联商品 ID（Java `@NotEmpty`；落库 `JSONUtil.toJsonStr`）
    pub range_data: Option<Vec<i32>>,
    /// 买家头像（Java `@NotBlank`）
    pub buyer_photo: Option<String>,
    /// 买家名称（Java `@NotBlank`）
    pub buyer_name: Option<String>,
    /// 文字内容
    pub content: Option<String>,
    /// 视频信息
    pub buyer_show_video_list: Option<Vec<BuyerShowVideoPayload>>,
    /// 图片信息
    pub img_list: Option<Vec<GalleryPicPayload>>,
    /// 所属分组
    pub group_data: Option<Vec<i32>>,
    /// 排序
    pub sort_order: Option<i32>,
}

/// `POST /adminapi/promotion/buyerShow/update` 入参（`BuyerShowUpdateParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowUpdatePayload {
    /// 买家秀 ID（Java `@NotNull`）
    pub buyer_show_id: Option<i32>,
    /// 关联商品 ID（Java `@NotEmpty`）
    pub range_data: Option<Vec<i32>>,
    /// 买家头像（Java `@NotBlank`）
    pub buyer_photo: Option<String>,
    /// 买家名称（Java `@NotBlank`）
    pub buyer_name: Option<String>,
    /// 文字内容
    pub content: Option<String>,
    /// 视频信息
    pub buyer_show_video_list: Option<Vec<BuyerShowVideoPayload>>,
    /// 图片信息
    pub img_list: Option<Vec<GalleryPicPayload>>,
    /// 所属分组
    pub group_data: Option<Vec<i32>>,
    /// 排序
    pub sort_order: Option<i32>,
}

/// `POST /adminapi/promotion/buyerShow/audit` 入参（`BuyerShowAuditParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowAuditPayload {
    /// 买家秀 ID（Java `@NotNull`）
    pub buyer_show_id: Option<i32>,
    /// 审核状态：1 通过，2 不通过（Java `@NotNull`）
    pub status: Option<i32>,
}

/// `POST /adminapi/promotion/buyerShow/batchDel` 入参（`BuyerShowBatchDeleteParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowBatchDeletePayload {
    /// 买家秀 ID 列表（Java `@NotEmpty` + 元素 `@NotNull`）
    pub ids: Option<Vec<Option<i32>>>,
}

/// `POST /adminapi/promotion/buyerShow/showOrHide` 入参（`BuyerShowShowOrHideParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowShowOrHidePayload {
    /// 买家秀 ID（Java `@NotNull`）
    pub buyer_show_id: Option<i32>,
    /// 是否公开：0 隐藏，1 公开（Java `@NotNull`）
    pub is_show: Option<i32>,
}

/// `POST /adminapi/promotion/buyerShow/comment` 入参（`BuyerShowCommentParam`）。
///
/// Java 的 `comment` 是**管理员代发**评论：`user_id` 强制 0（虚拟用户），
/// `status` / `is_show` 直接置 1（无需审核）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentPayload {
    /// 买家秀 ID（Java `@NotNull`）
    pub buyer_show_id: Option<i32>,
    /// 用户名称（Java `@NotBlank`）
    pub user_name: Option<String>,
    /// 用户头像（Java `@NotBlank`）
    pub user_photo: Option<String>,
    /// 评论内容（Java `@NotBlank`）
    pub content: Option<String>,
}

/// 买家秀视频出参（对应 Java `model.promotion.BuyerShowVideo`）。
///
/// Jackson 按属性名序列化 → camelCase；库列是 snake_case，故此处显式映射。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowVideoVO {
    /// 主键 `buyer_show_video.id`
    pub id: i32,
    /// 视频 ID `video_id`
    pub video_id: i32,
    /// 买家秀 ID `buyer_show_id`
    pub buyer_show_id: i32,
    /// 视频 url `video_url`
    pub video_url: String,
    /// 视频封面 `video_cover`
    pub video_cover: String,
    /// 视频格式后缀 `format`
    pub format: String,
    /// 排序 `sort_order`
    pub sort_order: i32,
}

/// 买家秀相册出参（对应 Java `model.promotion.BuyerShowGallery`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowGalleryVO {
    /// 相册 ID `pic_id`
    pub pic_id: i32,
    /// 买家秀 ID `buyer_show_id`
    pub buyer_show_id: i32,
    /// 实际图片 url `pic_url`
    pub pic_url: String,
    /// 图片说明信息 `pic_desc`
    pub pic_desc: String,
    /// 微缩图片 url `pic_thumb`
    pub pic_thumb: String,
    /// 原图 url `pic_original`
    pub pic_original: String,
    /// 高清图片 url `pic_large`
    pub pic_large: String,
    /// 排序 `sort_order`
    pub sort_order: i32,
}

/// 买家秀分页行（对应 Java `vo.promotion.buyershow.BuyerShowPageVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowPageVO {
    /// 买家秀 ID
    pub buyer_show_id: i32,
    /// 图片信息
    pub img_list: Vec<BuyerShowGalleryVO>,
    /// 视频信息
    pub video_list: Vec<BuyerShowVideoVO>,
    /// 文字内容
    pub content: Option<String>,
    /// 分组名称（仅当 `group_data` 非空才填充，Java 语义如此）
    pub group_list: Option<Vec<String>>,
    /// 关联商品个数（`range_data` JSON 数组长度）
    pub product_count: usize,
    /// 点赞数
    pub like_count: i64,
    /// 评论数
    pub comment_count: i64,
    /// 创建时间 `yyyy-MM-dd HH:mm:ss`
    pub add_time: String,
    /// 发布人（系统数据为 `buyer_name`，真实用户为 `user.username + "(客户)"`）
    pub buyer_name: String,
    /// 状态（0 待审核，1 通过，2 拒绝）
    pub status: i32,
    /// 是否公开（0 隐藏，1 公开）
    pub is_show: i32,
    /// 状态文案：待审核 / 公开 / 隐藏
    pub status_text: String,
    /// 排序
    pub sort_order: Option<i32>,
}

/// 买家秀详情（对应 Java `vo.promotion.buyershow.BuyerShowVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowVO {
    /// 买家秀 ID
    pub buyer_show_id: i32,
    /// 关联商品 ID
    pub range_data: Vec<i32>,
    /// 买家头像
    pub buyer_photo: String,
    /// 买家名称
    pub buyer_name: String,
    /// 图片信息
    pub img_list: Vec<BuyerShowGalleryVO>,
    /// 视频信息
    pub video_list: Vec<BuyerShowVideoVO>,
    /// 文字内容
    pub content: Option<String>,
    /// 分组 ID（仅当 `group_data` 非空才填充）
    pub group_id_list: Option<Vec<i32>>,
    /// 分组名称（仅当 `group_data` 非空才填充）
    pub group_name_list: Option<Vec<String>>,
    /// 排序
    pub sort_order: Option<i32>,
}

/// 随机买家信息（对应 Java `vo.promotion.buyershow.BuyerVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerVO {
    /// 买家头像（`virtual_user_info.photo`）
    pub buyer_photo: String,
    /// 买家名称（`virtual_user_info.nickname`）
    pub buyer_name: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_query_paging_defaults_match_java_base_page() {
        let q = BuyerShowListQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        let q = BuyerShowListQuery {
            size: Some(1000),
            ..Default::default()
        };
        assert_eq!(q.page_size(), 100, "上限 100 与 Java BasePage 一致");
        let q = BuyerShowListQuery {
            size: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_size(), 1);
    }

    #[test]
    fn status_view_three_states() {
        let all = BuyerShowListQuery::default();
        assert_eq!(all.status_view(), ListStatusView::All);
        assert!(!all.status_view().excludes_pending());

        let pending = BuyerShowListQuery {
            status: Some(-1),
            ..Default::default()
        };
        assert_eq!(pending.status_view(), ListStatusView::Pending);
        assert!(!pending.status_view().excludes_pending());

        let hidden = BuyerShowListQuery {
            status: Some(0),
            ..Default::default()
        };
        assert_eq!(hidden.status_view(), ListStatusView::ByIsShow(0));
        assert!(hidden.status_view().excludes_pending());

        let shown = BuyerShowListQuery {
            status: Some(1),
            ..Default::default()
        };
        assert_eq!(shown.status_view(), ListStatusView::ByIsShow(1));
    }

    #[test]
    fn keyword_blank_is_ignored_like_strutil_isnotblank() {
        let q = BuyerShowListQuery {
            keyword: Some("   ".into()),
            ..Default::default()
        };
        assert_eq!(q.keyword_opt(), None);
        let q = BuyerShowListQuery {
            keyword: Some(" 鞋子 ".into()),
            ..Default::default()
        };
        assert_eq!(q.keyword_opt(), Some("鞋子"));
    }

    #[test]
    fn query_deserializes_camel_case_and_page_size_alias() {
        let q: BuyerShowListQuery = serde_json::from_str(
            r#"{"status":-1,"goodsId":9,"startTime":"2025-01-01","endTime":"2025-01-31",
                "keyword":"a","sortField":"sortOrder","sortOrder":"asc","page":2,"pageSize":30}"#,
        )
        .expect("deserialize");
        assert_eq!(q.status, Some(-1));
        assert_eq!(q.goods_id, Some(9));
        assert_eq!(q.start_time.as_deref(), Some("2025-01-01"));
        assert_eq!(q.end_time.as_deref(), Some("2025-01-31"));
        assert_eq!(q.keyword_opt(), Some("a"));
        assert_eq!(q.sort_field.as_deref(), Some("sortOrder"));
        assert_eq!(q.page_no(), 2);
        assert_eq!(q.page_size(), 30);
    }

    #[test]
    fn batch_delete_payload_keeps_null_elements() {
        // Java `List<@NotNull Integer>`：元素为 null 时控制器校验失败；
        // Rust 无 Bean Validation，故保留 Option 以便服务层复刻同一报错。
        let p: BuyerShowBatchDeletePayload =
            serde_json::from_str(r#"{"ids":[1,null,3]}"#).expect("deserialize");
        let ids = p.ids.expect("ids");
        assert_eq!(ids, vec![Some(1), None, Some(3)]);
    }

    #[test]
    fn white_list_is_exactly_sort_order() {
        assert_eq!(BUYER_SHOW_CONFIG_FIELDS, ["sort_order"]);
    }

    #[test]
    fn page_vo_serializes_camel_case() {
        let vo = BuyerShowPageVO {
            buyer_show_id: 7,
            buyer_name: "系统".into(),
            product_count: 2,
            ..Default::default()
        };
        let j = serde_json::to_value(&vo).expect("serialize");
        assert_eq!(j["buyerShowId"], 7);
        assert_eq!(j["productCount"], 2);
        assert!(j.get("imgList").is_some());
        assert!(j.get("statusText").is_some());
    }
}
