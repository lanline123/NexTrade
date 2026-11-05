//! 评价（商品评论 / 晒单）域 DTO / VO / 查询参数 / 纯函数。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.query.product.CommentListPageQuery`（管理端/前台列表查询）
//! - `com.tigshop.bean.param.product.comment.CommentSaveParam`（管理端新增）
//! - `com.tigshop.bean.param.product.comment.CommentEvaluateParam`（前台评价/晒单）
//! - `com.tigshop.bean.dto.product.CommentUpdateDTO` / `CommentReplyDTO`
//! - `com.tigshop.bean.dto.common.{OperateDTO, UpdateFieldDTO, BatchDTO}`
//! - `com.tigshop.bean.vo.product.{CommentVO, CommentSubNumVO}`
//! - `com.tigshop.bean.query.order.OrderListPageQuery`（仅前台 `showedList` 用到的子集）
//!
//! 列名严格对齐 `java/database/pure.sql` 的 `comment` 表（23 列，见
//! `python tools/schema_parser.py --table comment`）；本文件只放 DTO/VO/纯函数，
//! 不含 SQL / IO。
//!
//! **JSON 字段全部 camelCase**（与原接口一致：`commentId` / `isShowed` /
//! `showPics` / `addTime` …）。
//!
//! **时间口径**：`comment.add_time` 是**秒级** `i32`（DDL `int unsigned`），
//! 返回给前端时统一格式化为 `yyyy-MM-dd HH:mm:ss`（对应 Java
//! `TigUtils.handelTime`，0/负值返回空串）。
//!
//! **未知点**（与 Java 的差异，服务层模块头另有汇总）：
//! - `CommentVO.commentTag` 的翻译（Java `translatePackage.translate`）未迁移，
//!   只做 JSON 解析，返回原始标签文案；
//! - `CommentUpdateDTO.kefuName` / `CommentVO.kefuName` 保留字段但不落库
//!   （`comment` 表无该列，Java 实体也没有，恒为 `null`）；
//! - `CommentVO.skuData` 按 Java `ProductSkuDTO.SkuData`（`name`/`value`/
//!   `attrPicThumb`）解析 `order_item.sku_data`。

use chrono::TimeZone;
use serde::{Deserialize, Serialize};

use crate::entities::{Comment, OrderItem, Product};
use crate::types::PageQuery;

/// 评价状态（`comment.status`）：0 待审核，1 审核通过，2 无效。
pub const COMMENT_STATUS_PENDING: i32 = 0;
/// 审核通过（后台回复评价时会把父评价置为该状态）。
pub const COMMENT_STATUS_APPROVED: i32 = 1;
/// 无效评价。
pub const COMMENT_STATUS_INVALID: i32 = 2;

/// 是否匿名：0 否。
pub const NOT_ANONYMOUS: i32 = 0;
/// 是否匿名：1 是。
pub const ANONYMOUS: i32 = 1;

/// 是否晒单：0 否。
pub const NOT_SHOWED: i32 = 0;
/// 是否晒单：1 是。
pub const SHOWED: i32 = 1;

/// `comment` 表 DDL 默认值：`sort_order mediumint NOT NULL DEFAULT 50`。
///
/// Java 走 MyBatis-Plus `save`（默认 `FieldStrategy.NOT_NULL`），DTO 未传
/// `sortOrder` 时该列**不进入 INSERT**，由 DDL 兜底为 50；Rust 显式列出列，
/// 必须在此补同样的默认值（否则排序垫底，与原系统不一致）。
pub const DEFAULT_SORT_ORDER: i32 = 50;

/// `updateField` 白名单（对应 Java `CheckFieldConstants.COMMENT_FIELDS`）。
///
/// ⚠️ 该数组含 `is_show`，但 `comment` 表**没有** `is_show` 列；
/// Java `BaseServiceImpl#updateField` 先用 `getColumnByPropertyName` 把属性名
/// 映射成列名（找不到时**回退主键 `comment_id`**），再做白名单判断，
/// 因此 `is_show` 实际永远命中「field 的值有误」。真正可更新的列见
/// [`COMMENT_UPDATABLE_FIELDS`]。
pub const COMMENT_FIELDS: [&str; 5] = [
    "is_show",
    "sort_order",
    "comment_rank",
    "is_top",
    "is_recommend",
];

/// 实际可更新的列（Java 白名单 ∩ `comment` 真实列）。
pub const COMMENT_UPDATABLE_FIELDS: [&str; 4] =
    ["comment_rank", "is_recommend", "is_top", "sort_order"];

/// `BasePage` 默认分页大小（Java `BasePage.getSize()`）。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// `BasePage` 分页大小上限（Java `getSize()` 截断到 100）。
pub const MAX_PAGE_SIZE: u64 = 100;

// ————————————————————— 查询参数 —————————————————————

/// 评价列表查询参数（对应 Java `CommentListPageQuery extends BasePage`）。
///
/// 管理端 `GET /adminapi/product/comment/list` 与前台
/// `GET /api/user/comment/list` 共用；前台会把 `userId` 强制覆盖为当前会员。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentListQuery {
    /// 关键词（Java `BasePage.keyword`；按 `comment.content` LIKE 过滤）
    pub keyword: Option<String>,
    /// 页码，从 1 开始（Java 缺省 1）
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage.size`，缺省 15 / 上限 100；兼容 `pageSize`）
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    /// 排序字段（Java `BasePage.sortField`）
    pub sort_field: Option<String>,
    /// 排序方向：`asc` / `desc`（Java 缺省降序）
    pub sort_order: Option<String>,
    /// 是否展示：`-1` 表示不过滤（Java `.eq(isShowed != null && isShowed != -1, ...)`）
    pub is_showed: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// 用户 ID
    pub user_id: Option<i32>,
    /// 评价类型：2 好评（`comment_rank >= 4`）/ 3 中评（`= 3`）/ 4 差评（`<= 2`）
    pub r#type: Option<i32>,
    /// 店铺 ID（Java 里来自请求头 `HeaderUtils.getShopId()`；Rust 由查询参数传入）
    pub shop_id: Option<i32>,
}

impl CommentListQuery {
    /// 转成工作区统一分页类型（`BasePage`：缺省 15、上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .page_size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// 评价星级过滤（Java `.ge/.eq/.le(Comment::getCommentRank, ..)`）。
    #[must_use]
    pub fn rank_filter(&self) -> Option<CommentRankFilter> {
        CommentRankFilter::from_type(self.r#type)
    }
}

/// 评价星级过滤（对应 Java `CommentListPageQuery.type` 的 2/3/4 分支）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentRankFilter {
    /// 好评：`comment_rank >= 4`
    Good,
    /// 中评：`comment_rank = 3`
    Neutral,
    /// 差评：`comment_rank <= 2`
    Bad,
}

impl CommentRankFilter {
    /// `type` → 星级过滤；未知 / 其它值返回 `None`（不过滤）。
    #[must_use]
    pub fn from_type(t: Option<i32>) -> Option<Self> {
        match t {
            Some(2) => Some(Self::Good),
            Some(3) => Some(Self::Neutral),
            Some(4) => Some(Self::Bad),
            _ => None,
        }
    }
}

// ————————————————————— 管理端写入参数 —————————————————————

/// 晒单图片（Java `CommentSaveParam.ShowPic` / `CommentUpdateDTO.ShowPic` /
/// `CommentVO.ShowPic` 的输入形态；存库时序列化为 JSON 数组）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentShowPicDTO {
    /// 图片 ID（Java `Long`）
    pub pic_id: Option<i64>,
    /// 缩略图 URL
    pub pic_thumb: Option<String>,
    /// 完整 URL
    pub pic_url: Option<String>,
    /// 图片名称
    pub pic_name: Option<String>,
}

/// 管理端新增评价参数（对应 Java `CommentSaveParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentSaveParam {
    /// 用户名
    pub username: Option<String>,
    /// 头像 URL
    pub avatar: Option<String>,
    /// 商品 ID（Java `@NotNull(message = "产品ID不能为空")`）
    pub product_id: Option<i32>,
    /// 星级
    pub comment_rank: Option<i32>,
    /// 评论内容
    pub content: Option<String>,
    /// 评论时间（`yyyy-MM-dd HH:mm:ss`，Java `DateUtil.parse`）
    pub add_time: Option<String>,
    /// 是否推荐
    pub is_recommend: Option<i32>,
    /// 是否置顶
    pub is_top: Option<i32>,
    /// 排序（DDL 缺省 50）
    pub sort_order: Option<i32>,
    /// 评论标签
    pub comment_tag: Option<Vec<String>>,
    /// 晒单图片
    pub show_pics: Option<Vec<CommentShowPicDTO>>,
    /// 关联商品 ID 列表（Java 未落库，仅透传字段）
    pub product_ids: Option<Vec<i64>>,
}

/// 管理端更新评价参数（对应 Java `CommentUpdateDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentUpdateDTO {
    /// 评价 ID（Java `@NotNull(message = "评价管理id不能为空")`）
    pub comment_id: Option<i32>,
    pub comment_rank: Option<i32>,
    pub is_default: Option<i32>,
    pub is_recommend: Option<i32>,
    pub is_showed: Option<i32>,
    pub is_top: Option<i32>,
    pub sort_order: Option<i32>,
    pub status: Option<i32>,
    pub usefull: Option<i32>,
    pub useless: Option<i32>,
    pub order_id: Option<i32>,
    pub order_item_id: Option<i32>,
    pub parent_id: Option<i32>,
    pub product_id: Option<i32>,
    /// Java 未落库，仅透传
    pub product_ids: Option<Vec<i32>>,
    pub comment_tag: Option<Vec<String>>,
    pub username: Option<String>,
    pub avatar: Option<String>,
    /// 评论内容（Java `@NotNull` + `@Size(max = 500)`）
    pub content: Option<String>,
    /// 评论时间（字符串，Java 解析失败抛异常）
    pub add_time: Option<String>,
    /// Java 实体无该列，恒忽略
    pub kefu_name: Option<String>,
    pub user_id: Option<i32>,
    pub show_pics: Option<Vec<CommentShowPicDTO>>,
    /// Java `update` 未使用 `reply`（DTO 内部类，前端未传），保留字段
    pub reply: Option<CommentUpdateReplyDTO>,
    pub shop_id: Option<i32>,
}

/// `CommentUpdateDTO.Reply`（Java 未使用，仅保持 DTO 同构）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentUpdateReplyDTO {
    pub comment_id: Option<i32>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<i32>,
    pub add_time: Option<String>,
}

/// 管理端回复评价参数（对应 Java `CommentReplyDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentReplyDTO {
    /// 评价 ID（父评价 `comment_id`）
    pub comment_id: Option<i32>,
    /// 回复内容
    pub content: Option<String>,
}

/// 前台评价 / 晒单参数（对应 Java `CommentEvaluateParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentEvaluateParam {
    pub product_id: Option<i32>,
    pub order_id: Option<i32>,
    pub order_item_id: Option<i32>,
    pub comment_rank: Option<i32>,
    pub comment_tag: Option<Vec<String>>,
    /// 评价内容（Java `@Size(min = 10, max = 500)`）
    pub content: Option<String>,
    pub show_pics: Option<Vec<CommentShowPicDTO>>,
    pub shop_id: Option<i32>,
    /// Java 前端传值被覆盖为登录会员，这里忽略
    pub user_id: Option<i32>,
    /// 是否匿名（不传视为 0）
    pub is_anonymous: Option<i32>,
}

// ————————————————————— 通用 DTO（与 brand/category 同构，模块内自洽） —————————————————————

/// 操作参数（对应 Java `bean.dto.common.OperateDTO`，用于删除）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键（Java `@NotNull(message = ID_CANNOT_IS_NULL)`，服务/路由层校验）
    pub id: Option<i32>,
    /// 备注（Java 未使用）
    pub admin_note: Option<String>,
    /// 页面类型（Java 未使用）
    pub page_type: Option<i32>,
}

/// 字段更新参数（对应 Java `bean.dto.common.UpdateFieldDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateFieldDTO {
    pub id: Option<i32>,
    pub field: Option<String>,
    #[serde(
        default,
        deserialize_with = "crate::models::serde_helpers::deserialize_opt_stringish"
    )]
    pub val: Option<String>,
}

/// 批量操作参数（对应 Java `bean.dto.common.BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键集合
    pub ids: Option<Vec<i32>>,
    /// 操作类型（仅支持 `del`）
    pub r#type: Option<String>,
    /// 值（Java 未使用）
    pub value: Option<i32>,
    /// 数据（Java 未使用）
    pub data: Option<serde_json::Value>,
}

/// 前台「晒单列表」查询参数（对应 Java `OrderListPageQuery` 的子集）。
///
/// 完整 Java DTO 有 30+ 字段；`showedList` 只设置 `userId`，其余由前端透传。
/// Rust 订单服务（`trade::order::OrderService::list`）当前只支持
/// `userId` / `orderStatus` / `keyword` 三个过滤条件，其余字段仅解析不使用
/// （见 public 路由模块头的「不确定点」）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OrderListQuery {
    pub user_id: Option<i32>,
    /// 订单状态（Java `String`，支持逗号分隔，Rust 仅取单个数字）
    pub order_status: Option<String>,
    pub pay_status: Option<i32>,
    pub shipping_status: Option<i32>,
    pub comment_status: Option<i32>,
    pub is_showed: Option<i32>,
    pub keyword: Option<String>,
    pub page: Option<u64>,
    #[serde(rename = "pageSize", alias = "size")]
    pub page_size: Option<u64>,
    pub shop_id: Option<i32>,
}

impl OrderListQuery {
    /// 转成工作区统一分页类型（Java `BasePage`：缺省 15、上限 100）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .page_size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// 解析单值订单状态（Java 支持 `"0,1"` 这类多状态串，Rust 订单服务只收单个）。
    #[must_use]
    pub fn single_order_status(&self) -> Option<i32> {
        self.order_status
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| s.split(',').next())
            .and_then(|s| s.trim().parse::<i32>().ok())
    }
}

// ————————————————————— VO —————————————————————

/// 晒图（对应 Java `CommentVO.ShowPic`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentShowPicVO {
    pub pic_id: Option<i32>,
    pub pic_thumb: Option<String>,
    pub pic_url: Option<String>,
    pub pic_name: Option<String>,
    pub storage_url: Option<String>,
    pub errcode: Option<i32>,
    pub message: Option<String>,
}

/// 评价回复（对应 Java `CommentVO.ReplyVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentReplyVO {
    pub comment_id: Option<i32>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    /// 是否匿名（商家回复恒为 0）
    pub is_anonymous: Option<i32>,
    pub content: Option<String>,
    pub parent_id: Option<i32>,
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
}

/// 规格数据（对应 Java `ProductSkuDTO.SkuData`，来自 `order_item.sku_data` JSON）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentSkuDataVO {
    pub name: Option<String>,
    pub value: Option<String>,
    /// 规格图片缩略图
    pub attr_pic_thumb: Option<String>,
}

/// 评价 VO（对应 Java `CommentVO`：`Comment` 全字段 + 商品信息 + 子回复 + 晒图）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentVO {
    // ——— Comment ———
    pub comment_id: Option<i32>,
    pub user_id: Option<i32>,
    pub username: Option<String>,
    pub is_anonymous: Option<i32>,
    pub avatar: Option<String>,
    pub product_id: Option<i32>,
    pub order_id: Option<i32>,
    pub order_item_id: Option<i32>,
    pub comment_rank: Option<i32>,
    pub content: Option<String>,
    pub status: Option<i32>,
    pub parent_id: Option<i32>,
    pub usefull: Option<i32>,
    pub useless: Option<i32>,
    pub is_recommend: Option<i32>,
    pub is_top: Option<i32>,
    pub is_showed: Option<i32>,
    pub is_default: Option<i32>,
    pub sort_order: Option<i32>,
    pub shop_id: Option<i32>,
    // ——— Product ———
    pub product_name: Option<String>,
    pub product_sn: Option<String>,
    pub pic_thumb: Option<String>,
    // ——— Reply ———
    pub replies: Option<Vec<CommentReplyVO>>,
    // ——— Other ———
    /// `yyyy-MM-dd HH:mm:ss`
    pub add_time: Option<String>,
    pub comment_tag: Option<Vec<String>>,
    pub show_pics: Option<Vec<CommentShowPicVO>>,
    // ——— UNKNOWN（Java 保留字段） ———
    pub kefu_name: Option<String>,
    pub sku_id: Option<i32>,
    pub sku_data: Option<Vec<CommentSkuDataVO>>,
}

/// 评论晒单数量（对应 Java `CommentSubNumVO`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommentSubNumVO {
    /// 待评价订单数
    pub await_comment: i64,
    /// 待晒单数
    pub show_pics: i64,
    /// 已评价数
    pub commented: i64,
}

// ————————————————————— 纯函数 —————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（对应 Java `TigUtils.handelTime`：
/// `null` / 0 / 负值返回空串；本地时区）。
#[must_use]
pub fn fmt_time_seconds(secs: i32) -> String {
    if secs <= 0 {
        return String::new();
    }
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

/// 匿名展示名脱敏（对应 Java `AnonymousMaskUtils#maskName`，D1146）：
/// 空/空白 → `***`；1 个码点 → `*`；2 个 → 首码点 + `**`；
/// 3 个及以上 → 首码点 + `**` + 尾码点。按 Unicode 码点切割，emoji 安全。
#[must_use]
pub fn mask_name(name: &str) -> String {
    const MIDDLE_MASK: &str = "**";
    const FULL_MASK: &str = "***";
    const SINGLE_MASK: &str = "*";

    if name.trim().is_empty() {
        return FULL_MASK.to_string();
    }
    let chars: Vec<char> = name.chars().collect();
    match chars.len() {
        1 => SINGLE_MASK.to_string(),
        2 => format!("{}{MIDDLE_MASK}", chars[0]),
        _ => format!("{}{MIDDLE_MASK}{}", chars[0], chars[chars.len() - 1]),
    }
}

/// JSON 字符串数组 → `Vec<String>`（对应 Java `JSONUtil.toList(commentTag, String.class)`；
/// 非 JSON / 非数组返回空列表）。
#[must_use]
pub fn parse_string_list_json(raw: Option<&str>) -> Vec<String> {
    let Some(raw) = raw.filter(|s| !s.trim().is_empty()) else {
        return Vec::new();
    };
    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(serde_json::Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str().map(str::to_string))
            .collect(),
        _ => Vec::new(),
    }
}

/// 晒图 JSON → `Vec<CommentShowPicVO>`（对应 Java
/// `CommentVO#getCommentShowPicsByJson`：`[]`/空/非 JSON → `None`；
/// `{...}` 对象 → 单元素列表；解析失败 → `None`）。
#[must_use]
pub fn parse_show_pics(raw: Option<&str>) -> Option<Vec<CommentShowPicVO>> {
    let raw = raw.filter(|s| !s.trim().is_empty() && s.trim() != "[]")?;
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;
    let items = match value {
        serde_json::Value::Array(items) => items,
        obj @ serde_json::Value::Object(_) => vec![obj],
        _ => return None,
    };
    Some(
        items
            .iter()
            .filter_map(|v| {
                let o = v.as_object()?;
                Some(CommentShowPicVO {
                    pic_id: o
                        .get("picId")
                        .and_then(serde_json::Value::as_i64)
                        .and_then(|i| i32::try_from(i).ok()),
                    pic_thumb: o
                        .get("picThumb")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                    pic_url: o.get("picUrl").and_then(|v| v.as_str()).map(str::to_string),
                    pic_name: o
                        .get("picName")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                    storage_url: o
                        .get("storageUrl")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                    errcode: o
                        .get("errcode")
                        .and_then(serde_json::Value::as_i64)
                        .and_then(|i| i32::try_from(i).ok()),
                    message: o
                        .get("message")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                })
            })
            .collect(),
    )
}

/// `order_item.sku_data` JSON → `Vec<CommentSkuDataVO>`
/// （Java `JSONUtil.toList(orderItem.getSkuData(), ProductSkuDTO.SkuData.class)`；
/// 非 JSON 数组返回 `None`）。
#[must_use]
pub fn parse_sku_data(raw: &str) -> Option<Vec<CommentSkuDataVO>> {
    if raw.trim().is_empty() {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(raw).ok()?;
    let items = value.as_array()?;
    Some(
        items
            .iter()
            .filter_map(|v| {
                let o = v.as_object()?;
                Some(CommentSkuDataVO {
                    name: o.get("name").and_then(|v| v.as_str()).map(str::to_string),
                    value: o.get("value").and_then(|v| v.as_str()).map(str::to_string),
                    attr_pic_thumb: o
                        .get("attrPicThumb")
                        .and_then(|v| v.as_str())
                        .map(str::to_string),
                })
            })
            .collect(),
    )
}

/// 实体 `Comment` → [`CommentVO`]（对应 Java `CommentVO(comment, product, replyComments)` 构造器）。
///
/// - `default_avatar`：会员头像为空时使用的配置默认头像
///   （Java `CommentServiceImpl#getDefaultAvatar`）；
/// - `replies`：子评论（`parent_id = comment.comment_id`）；
/// - `order_item`：用于回填 `skuId` / `skuData`（Java `batchGetOrderItemMap`）。
#[must_use]
pub fn build_comment_vo(
    c: &Comment,
    product: Option<&Product>,
    replies: &[Comment],
    order_item: Option<&OrderItem>,
    default_avatar: &str,
) -> CommentVO {
    let (sku_id, sku_data) = match order_item {
        Some(item) => (Some(item.sku_id), parse_sku_data(&item.sku_data)),
        None => (None, None),
    };
    CommentVO {
        comment_id: Some(c.comment_id),
        user_id: Some(c.user_id),
        username: Some(c.username.clone()),
        is_anonymous: Some(c.is_anonymous),
        avatar: Some(if c.avatar.trim().is_empty() {
            default_avatar.to_string()
        } else {
            c.avatar.clone()
        }),
        product_id: Some(c.product_id),
        order_id: Some(c.order_id),
        order_item_id: Some(c.order_item_id),
        comment_rank: Some(c.comment_rank),
        content: Some(c.content.clone()),
        status: Some(c.status),
        parent_id: Some(c.parent_id),
        usefull: Some(c.usefull),
        useless: Some(c.useless),
        is_recommend: c.is_recommend,
        is_top: Some(c.is_top),
        is_showed: Some(c.is_showed),
        is_default: Some(c.is_default),
        sort_order: Some(c.sort_order),
        shop_id: Some(c.shop_id),
        product_name: product.map(|p| p.product_name.clone()),
        product_sn: product.map(|p| p.product_sn.clone()),
        pic_thumb: product.map(|p| p.pic_thumb.clone()),
        replies: Some(
            replies
                .iter()
                .map(|r| CommentReplyVO {
                    comment_id: Some(r.comment_id),
                    user_id: Some(r.user_id),
                    username: Some(r.username.clone()),
                    is_anonymous: Some(r.is_anonymous),
                    content: Some(r.content.clone()),
                    parent_id: Some(r.parent_id),
                    add_time: Some(fmt_time_seconds(r.add_time)),
                })
                .collect(),
        ),
        add_time: Some(fmt_time_seconds(c.add_time)),
        comment_tag: Some(parse_string_list_json(c.comment_tag.as_deref())),
        show_pics: parse_show_pics(c.show_pics.as_deref()),
        kefu_name: None,
        sku_id,
        sku_data,
    }
}

/// `updateField` 字段规范化：驼峰 → 下划线，并校验白名单。
///
/// 返回 `Some(列名)` 表示允许更新；`None` 对应 Java
/// `BaseServiceImpl#updateField` 抛出的 `INVALID_FIELD_VALUE`（`field 的值有误`）。
#[must_use]
pub fn normalize_update_field(field: &str) -> Option<&'static str> {
    let snake = to_snake(field);
    COMMENT_UPDATABLE_FIELDS
        .iter()
        .copied()
        .find(|f| *f == snake)
}

/// 驼峰 → 下划线（允许前端传驼峰或数据库列名）。
#[must_use]
pub fn to_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for ch in s.chars() {
        if ch.is_ascii_uppercase() {
            out.push('_');
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

/// 评论内容更新校验（Java `CommentUpdateDTO.content` 的 `@NotNull` +
/// `@Size(max = 500)`；长度按 Java `String.length()` 口径 = UTF-16 码元数）。
///
/// ⚠️ Java 控制器 `update(@RequestBody CommentUpdateDTO)` **没有** `@Valid` /
/// `@Validated`，因此这两个注解在原系统里并不生效；本函数只保留「长度上限」
/// 这一防御性校验，`None`（未传）合法——调用方保留库中原内容（对应 MyBatis
/// `NOT_NULL` 把 null 排除出 SET 子句）。
pub fn validate_update_content(raw: Option<&str>) -> crate::Result<Option<String>> {
    let Some(content) = raw else {
        return Ok(None);
    };
    if content.encode_utf16().count() > 500 {
        return Err(crate::Error::Validation("评论名称最多500个字符".into()));
    }
    Ok(Some(content.to_string()))
}

/// 前台评价内容校验（Java `CommentEvaluateParam.content` 的
/// `@Size(min = 10, max = 500)`；`null` 合法，空串非法）。
pub fn validate_evaluate_content(raw: Option<&str>) -> crate::Result<()> {
    let Some(content) = raw else {
        return Ok(());
    };
    // Java `String.length()` 口径（UTF-16 码元），与 `@Size` 一致
    if (10..=500).contains(&content.encode_utf16().count()) {
        Ok(())
    } else {
        Err(crate::Error::Validation(
            "评价内容长度必须在10到500个字符之间".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 匿名脱敏（Java AnonymousMaskUtils） —————————————————————

    #[test]
    fn mask_name_matches_java_rules() {
        // 空 / 空白 → ***
        assert_eq!(mask_name(""), "***");
        assert_eq!(mask_name("   "), "***");
        // 1 个码点 → *
        assert_eq!(mask_name("张"), "*");
        // 2 个码点 → 首码点 + **
        assert_eq!(mask_name("张三"), "张**");
        // 3 个及以上 → 首 + ** + 尾
        assert_eq!(mask_name("张三丰"), "张**丰");
        assert_eq!(mask_name("Alice"), "A**e");
    }

    #[test]
    fn mask_name_is_code_point_safe_for_emoji() {
        // emoji 是代理对：按码点而非 UTF-16 / 字节切分，不能出现乱码
        let masked = mask_name("😀abc😀");
        assert_eq!(masked, "😀**😀");
        assert_eq!(mask_name("😀"), "*");
    }

    // ————————————————————— 时间格式化（Java TigUtils.handelTime） —————————————————————

    #[test]
    fn fmt_time_seconds_formats_and_handles_zero() {
        assert_eq!(fmt_time_seconds(0), "");
        assert_eq!(fmt_time_seconds(-1), "");
        // 1_700_000_000 = 2023-11-15 06:13:20 (Asia/Shanghai 为 14:13:20)
        let s = fmt_time_seconds(1_700_000_000);
        assert_eq!(s.len(), 19, "yyyy-MM-dd HH:mm:ss 长度必须为 19: {s}");
        assert!(s.starts_with("2023-11-1"), "实际: {s}");
    }

    // ————————————————————— 列表查询（Java CommentListPageQuery） —————————————————————

    #[test]
    fn page_query_uses_base_page_defaults() {
        let q = CommentListQuery::default();
        let page = q.page_query();
        assert_eq!(page.page, 1);
        assert_eq!(page.page_size, 15, "Java BasePage 默认 size=15");

        let q = CommentListQuery {
            page: Some(0),
            page_size: Some(500),
            ..Default::default()
        };
        let page = q.page_query();
        assert_eq!(page.page, 1, "page 必须 >= 1");
        assert_eq!(page.page_size, 100, "Java BasePage 上限 100");
    }

    #[test]
    fn rank_filter_matches_java_type_branches() {
        // Java: type=2 -> comment_rank >= 4；3 -> =3；4 -> <=2；其它不过滤
        assert_eq!(
            CommentRankFilter::from_type(Some(2)),
            Some(CommentRankFilter::Good)
        );
        assert_eq!(
            CommentRankFilter::from_type(Some(3)),
            Some(CommentRankFilter::Neutral)
        );
        assert_eq!(
            CommentRankFilter::from_type(Some(4)),
            Some(CommentRankFilter::Bad)
        );
        assert_eq!(CommentRankFilter::from_type(Some(1)), None);
        assert_eq!(CommentRankFilter::from_type(None), None);
        // 查询 DTO 透传
        let q = CommentListQuery {
            r#type: Some(4),
            ..Default::default()
        };
        assert_eq!(q.rank_filter(), Some(CommentRankFilter::Bad));
    }

    // ————————————————————— JSON 解析（Java JSONUtil） —————————————————————

    #[test]
    fn parse_string_list_json_tolerates_junk() {
        assert_eq!(
            parse_string_list_json(Some(r#"["好评","物流快"]"#)),
            vec!["好评".to_string(), "物流快".to_string()]
        );
        assert!(parse_string_list_json(Some("[]")).is_empty());
        assert!(parse_string_list_json(Some("not-json")).is_empty());
        assert!(parse_string_list_json(None).is_empty());
        // 非字符串元素被忽略（Java Jackson 反序列化到 String 的行为近似）
        assert_eq!(parse_string_list_json(Some(r#"[1,"a"]"#)), vec!["a"]);
    }

    #[test]
    fn parse_show_pics_handles_array_object_and_empty() {
        // 空 / "[]" / 非 JSON → None（Java 返回 null）
        assert!(parse_show_pics(Some("[]")).is_none());
        assert!(parse_show_pics(Some("")).is_none());
        assert!(parse_show_pics(None).is_none());
        assert!(parse_show_pics(Some("oops")).is_none());
        // 数组 → 多元素
        let arr = parse_show_pics(Some(
            r#"[{"picId":1,"picUrl":"a.png","picThumb":"t.png","picName":"a"}]"#,
        ))
        .unwrap();
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0].pic_id, Some(1));
        assert_eq!(arr[0].pic_url.as_deref(), Some("a.png"));
        // 单个对象 → 单元素列表（Java startsWith("{") 分支）
        let one = parse_show_pics(Some(r#"{"picId":2,"picUrl":"b.png"}"#)).unwrap();
        assert_eq!(one.len(), 1);
        assert_eq!(one[0].pic_id, Some(2));
    }

    #[test]
    fn parse_sku_data_matches_product_sku_dto() {
        assert!(parse_sku_data("").is_none());
        assert!(parse_sku_data("[]").unwrap().is_empty());
        let items =
            parse_sku_data(r#"[{"name":"颜色","value":"红","attrPicThumb":"x.png"}]"#).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].name.as_deref(), Some("颜色"));
        assert_eq!(items[0].value.as_deref(), Some("红"));
        assert_eq!(items[0].attr_pic_thumb.as_deref(), Some("x.png"));
    }

    // ————————————————————— updateField 白名单（Java COMMENT_FIELDS） —————————————————————

    #[test]
    fn update_field_whitelist_matches_java_effective_set() {
        // COMMENT_FIELDS 常量与 Java CheckFieldConstants 完全一致
        assert_eq!(
            COMMENT_FIELDS,
            [
                "is_show",
                "sort_order",
                "comment_rank",
                "is_top",
                "is_recommend"
            ]
        );
        // 真实可更新列（is_show 在 comment 表不存在，Java 也会报错）
        assert_eq!(
            COMMENT_UPDATABLE_FIELDS,
            ["comment_rank", "is_recommend", "is_top", "sort_order"]
        );
        assert_eq!(normalize_update_field("sortOrder"), Some("sort_order"));
        assert_eq!(normalize_update_field("sort_order"), Some("sort_order"));
        assert_eq!(normalize_update_field("commentRank"), Some("comment_rank"));
        assert_eq!(normalize_update_field("isTop"), Some("is_top"));
        assert_eq!(normalize_update_field("isRecommend"), Some("is_recommend"));
        // is_show 在白名单常量里但表无此列 → 必须拒绝
        assert_eq!(normalize_update_field("is_show"), None);
        assert_eq!(normalize_update_field("content"), None);
        assert_eq!(normalize_update_field("1;DROP TABLE comment"), None);
    }

    // ————————————————————— 请求校验 —————————————————————

    #[test]
    fn update_content_validation() {
        // Java 控制器未加 @Validated，`null` 合法（保留原内容）
        assert!(validate_update_content(None).unwrap().is_none());
        // 传空串是「传了值」，Java 会照写空串
        assert_eq!(
            validate_update_content(Some("")).unwrap(),
            Some(String::new())
        );
        assert_eq!(
            validate_update_content(Some(" 好评 ")).unwrap(),
            Some(" 好评 ".to_string())
        );
        // 500 字符合法（中文按 Java String.length 口径）
        let ok = "好".repeat(500);
        assert!(validate_update_content(Some(&ok)).is_ok());
        let too_long = "好".repeat(501);
        assert!(validate_update_content(Some(&too_long)).is_err());
    }

    #[test]
    fn evaluate_content_length_is_ten_to_five_hundred() {
        assert!(validate_evaluate_content(None).is_ok());
        // Java `@Size(min=10)`：空串不合法
        assert!(validate_evaluate_content(Some("")).is_err());
        assert!(validate_evaluate_content(Some("太短了")).is_err());
        assert!(validate_evaluate_content(Some(&"好".repeat(10))).is_ok());
        assert!(validate_evaluate_content(Some(&"好".repeat(500))).is_ok());
        assert!(validate_evaluate_content(Some(&"好".repeat(501))).is_err());
    }

    // ————————————————————— VO 组装 —————————————————————

    #[test]
    fn build_comment_vo_fills_default_avatar_and_parses_json() {
        let mut c = Comment {
            comment_id: 9,
            user_id: 3,
            username: "张三".into(),
            avatar: "".into(),
            product_id: 7,
            comment_rank: 5,
            content: "很好".into(),
            add_time: 1_700_000_000,
            parent_id: 0,
            comment_tag: Some(r#"["好评"]"#.into()),
            show_pics: Some(r#"{"picId":1,"picUrl":"a.png"}"#.into()),
            ..Default::default()
        };
        c.status = COMMENT_STATUS_APPROVED;

        let product = Product {
            product_id: 7,
            product_name: "测试商品".into(),
            product_sn: "SN-1".into(),
            pic_thumb: "p.png".into(),
            ..Default::default()
        };
        let reply = Comment {
            comment_id: 10,
            user_id: 1,
            username: "客服".into(),
            content: "谢谢".into(),
            parent_id: 9,
            add_time: 1_700_000_100,
            ..Default::default()
        };
        let vo = build_comment_vo(&c, Some(&product), &[reply], None, "default.png");
        assert_eq!(vo.comment_id, Some(9));
        // 空头像回退配置默认头像
        assert_eq!(vo.avatar.as_deref(), Some("default.png"));
        assert_eq!(vo.product_name.as_deref(), Some("测试商品"));
        assert_eq!(vo.comment_tag, Some(vec!["好评".to_string()]));
        assert_eq!(vo.show_pics.as_ref().unwrap()[0].pic_id, Some(1));
        let replies = vo.replies.unwrap();
        assert_eq!(replies.len(), 1);
        assert_eq!(replies[0].parent_id, Some(9));
        assert_eq!(replies[0].add_time.as_deref().map(str::len), Some(19));
    }
}
