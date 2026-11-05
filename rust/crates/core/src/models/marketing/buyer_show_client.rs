//! 买家秀前台（marketing::buyer_show_client）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.api.controller.buyershow.BuyerShowController`
//!   （`@RequestMapping("/api/buyerShow/buyerShow")`，本切片 12 个端点）
//! - `com.tigshop.bean.query.promotion.buyershow.BuyerShowPageClientQuery`
//! - `com.tigshop.bean.query.promotion.buyershow.BuyerShowVideoFeedClientQuery`
//! - `com.tigshop.bean.query.promotion.buyershow.BuyerShowCommentPageClientQuery`
//! - `com.tigshop.bean.param.promotion.buyershow.BuyerShowLikeClientParam` /
//!   `BuyerShowFavoriteClientParam` / `BuyerShowFollowAuthorClientParam` /
//!   `BuyerShowSaveClientParam` / `BuyerShowCommentClientParam` /
//!   `BuyerShowCommentLikeClientParam`
//! - `com.tigshop.bean.model.promotion.BuyerShowVideo` / `BuyerShowGallery`
//! - `com.tigshop.bean.model.setting.GalleryPic`
//! - `com.tigshop.bean.vo.promotion.buyershow.BuyerShowPageClientVO` /
//!   `BuyerShowClientVO` / `BuyerShowVideoFeedPageClientVO` /
//!   `BuyerShowVideoFeedItemClientVO` / `BuyerShowCommentPageClientVO`
//!
//! JSON 字段名保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! # 分页入参口径
//!
//! `BuyerShowPageClientQuery` / `BuyerShowCommentPageClientQuery` 继承 Java
//! `BasePage`：`page` 缺省 1、`size` 缺省 15、**上限 100**；
//! `BuyerShowVideoFeedClientQuery` **不继承** `BasePage`，只有自己的
//! `size`（缺省 5、上限 50）。
//!
//! # 「返回整实体」的口径
//!
//! Java 的 `imgList` / `videoList` 直接返回 MyBatis Plus 实体
//! （`BuyerShowGallery` / `BuyerShowVideo`），`productList` 直接返回
//! `Product` 实体；本文件按同名同序复刻其中的持久化列，
//! **不**复刻 Java 实体上的 `@TableName` / `@TableId` 等持久化注解字段
//! （它们不参与 Jackson 序列化）。

use chrono::TimeZone as _;
use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer, Serialize};

// ——————————————————————————————————————————————
// 常量（对齐 Java `Constants.YES` / `Constants.NO`）
// ——————————————————————————————————————————————

/// `Constants.YES`
pub const YES: i32 = 1;
/// `Constants.NO`
pub const NO: i32 = 0;

// ——————————————————————————————————————————————
// 查询参数
// ——————————————————————————————————————————————

/// `GET /buyerShow/buyerShow/list` 查询参数
/// （Java `BuyerShowPageClientQuery extends BasePage`）。
///
/// `goodsId` 在 Java 里是 `Long` 且用于 `JSON_CONTAINS(group_data, ...)`
/// ——即**买家秀分组 id**（不是商品 id）；`productId` 用于
/// `JSON_CONTAINS(range_data, ...)`——即关联商品 id。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowPageClientQuery {
    /// 当前页码（Java `BasePage#getPage`，缺省 1）
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    /// 每页条数（Java `BasePage#getSize`，缺省 15、上限 100）
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub size: Option<u64>,
    /// 查询参数（Java `BasePage#getKeyword`）
    pub keyword: Option<String>,
    /// 排序字段（Java `BasePage#getSortField`）。
    /// ⚠️ `clientList` **忽略**该字段（Java 固定 `buildClientFeedOrders()`），
    /// 保留仅为兼容前端传参。
    pub sort_field: Option<String>,
    /// 排序方向（Java `BasePage#getSortOrder`）。同上，`clientList` 忽略。
    pub sort_order: Option<String>,
    /// 分组 ID（Java `Long goodsId`，`JSON_CONTAINS(group_data, ?)`）
    #[serde(default, deserialize_with = "de_opt_i64")]
    pub goods_id: Option<i64>,
    /// 商品 ID（Java `Integer productId`，`JSON_CONTAINS(range_data, ?)`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub product_id: Option<i32>,
}

impl BuyerShowPageClientQuery {
    /// 分页参数（对齐 Java `BasePage#getPage` / `getSize`：缺省 1 / 15，上限 100）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（对齐 Java `BasePage#getSize`：缺省 15，上限 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        self.size.unwrap_or(15).clamp(1, 100)
    }
}

/// `GET /buyerShow/buyerShow/videoFeed` 查询参数
/// （Java `BuyerShowVideoFeedClientQuery`，**不继承** `BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowVideoFeedClientQuery {
    /// 每页条数（Java `@Min(1) @Max(50)`，字段初值 5；getter 再 `min(size, 50)`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub size: Option<i32>,
    /// 游标（上一页返回的 `nextCursor`，纯数字买家秀 id；首次不传）
    pub cursor: Option<String>,
    /// 从列表点入的起始买家秀 id（仅首次生效，保证首屏是点击项）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub start_id: Option<i32>,
    /// 分组 ID（Java `Long groupId`，`JSON_CONTAINS(group_data, ?)`）
    #[serde(default, deserialize_with = "de_opt_i64")]
    pub group_id: Option<i64>,
    /// 关键词（可选）
    pub keyword: Option<String>,
}

impl BuyerShowVideoFeedClientQuery {
    /// 每页条数（Java `getSize()`：`null` → 5，其它 `Math.min(size, 50)`）。
    ///
    /// 注意 Java 只做**上限**裁剪，负数/0 会原样传给 `LIMIT`（MySQL 对
    /// `LIMIT` 负数报语法错误）；本实现按同一口径返回，由调用方决定。
    #[must_use]
    pub fn page_size(&self) -> i32 {
        match self.size {
            None => 5,
            Some(v) => v.min(50),
        }
    }
}

/// `GET /buyerShow/buyerShow/comment/pageList` 查询参数
/// （Java `BuyerShowCommentPageClientQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentPageClientQuery {
    /// 当前页码（缺省 1）
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub page: Option<u64>,
    /// 每页条数（缺省 15、上限 100）
    #[serde(default, deserialize_with = "de_opt_u64")]
    pub size: Option<u64>,
    /// 排序字段（`commentPageList` **忽略**，Java 固定 `is_top DESC, add_time DESC`）
    pub sort_field: Option<String>,
    /// 排序方向（同上，忽略）
    pub sort_order: Option<String>,
    /// 上级评论 id（Java `Long parentId`，一级回复传 0）
    ///
    /// ⚠️ Java 侧 `queryWrapper.eq(BuyerShowComment::getParentId, query.getParentId())`
    /// 是**无条件**等值匹配：`parentId` 不传（`null`）时会生成
    /// `parent_id = NULL`（恒不成立）→ 返回空页。本实现照抄该语义。
    #[serde(default, deserialize_with = "de_opt_i64")]
    pub parent_id: Option<i64>,
    /// 买家秀 ID（Java `Long buyerShowId`）
    #[serde(default, deserialize_with = "de_opt_i64")]
    pub buyer_show_id: Option<i64>,
}

impl BuyerShowCommentPageClientQuery {
    /// 页码（缺省 1）。
    #[must_use]
    pub fn page_no(&self) -> u64 {
        self.page.unwrap_or(1).max(1)
    }

    /// 每页条数（缺省 15、上限 100）。
    #[must_use]
    pub fn page_size(&self) -> u64 {
        self.size.unwrap_or(15).clamp(1, 100)
    }
}

/// `GET /buyerShow/buyerShow/detail?buyerShowId=` 与 `/share?buyerShowId=`
/// 的公共查询参数（Java `@RequestParam("buyerShowId") @NotNull Integer`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowIdQuery {
    /// 买家秀主键
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_id: Option<i32>,
}

// ——————————————————————————————————————————————
// 写操作入参（POST body）
// ——————————————————————————————————————————————

/// `POST /buyerShow/buyerShow/like` 入参（Java `BuyerShowLikeClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowLikeClientParam {
    /// 买家秀 id（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_id: Option<i32>,
    /// `0`：取消点赞，`1`：点赞（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub is_like: Option<i32>,
}

/// `POST /buyerShow/buyerShow/favorite` 入参（Java `BuyerShowFavoriteClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowFavoriteClientParam {
    /// 买家秀 id（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_id: Option<i32>,
    /// `0`：取消收藏，`1`：收藏（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub is_favorite: Option<i32>,
}

/// `POST /buyerShow/buyerShow/followAuthor` 入参
/// （Java `BuyerShowFollowAuthorClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowFollowAuthorClientParam {
    /// 作者（会员）id（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub author_id: Option<i32>,
    /// `0`：取消关注，`1`：关注（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub is_follow: Option<i32>,
}

/// 视频素材入参（Java `com.tigshop.bean.model.promotion.BuyerShowVideo` 作为
/// `BuyerShowSaveClientParam.buyerShowVideoList` 的元素）。
///
/// Java 直接复用**持久化实体**接收请求体，故可被前端指定 `id` /
/// `buyerShowId`，但服务层落库前会强制覆盖（`setId(null)`、
/// `setBuyerShowId(...)`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowVideoSaveItem {
    /// 主键 id（Java 落库前 `setId(null)`，传入值被忽略）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub id: Option<i32>,
    /// 视频 ID
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub video_id: Option<i32>,
    /// 买家秀 id（落库前被覆盖）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_id: Option<i32>,
    /// 视频 url
    pub video_url: Option<String>,
    /// 视频封面
    pub video_cover: Option<String>,
    /// 视频格式后缀
    pub format: Option<String>,
    /// 排序（与相册 `sort_order` 同一量纲，用于混排判定；
    /// `null` 时服务层按下标兜底）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub sort_order: Option<i32>,
}

/// 相册图片入参（Java `com.tigshop.bean.model.setting.GalleryPic` 作为
/// `BuyerShowSaveClientParam.imgList` 的元素）。
///
/// 服务层只读 `picUrl` / `picThumb` 两个字段，其余字段（`picId` /
/// `shopId` / `galleryId` / ...）在 Java 里同样被忽略；这里仅保留实际读取的
/// 字段，避免误导前端以为其余字段生效。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowGallerySaveItem {
    /// 图片地址（Java `GalleryPic.picUrl`）
    pub pic_url: Option<String>,
    /// 微缩图地址（Java `GalleryPic.picThumb`）
    pub pic_thumb: Option<String>,
}

/// `POST /buyerShow/buyerShow/add` 入参（Java `BuyerShowSaveClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowSaveClientParam {
    /// 关联商品 id 列表（Java `@NotEmpty(message = "关联商品不能为空")`）
    #[serde(default)]
    pub range_data: Vec<i32>,
    /// 文字内容
    pub content: Option<String>,
    /// 视频信息
    #[serde(default)]
    pub buyer_show_video_list: Vec<BuyerShowVideoSaveItem>,
    /// 图片信息
    #[serde(default)]
    pub img_list: Vec<BuyerShowGallerySaveItem>,
}

/// `POST /buyerShow/buyerShow/comment` 入参（Java `BuyerShowCommentClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentClientParam {
    /// 上级评论 id（一级回复传 0）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub parent_id: Option<i32>,
    /// 买家秀 ID（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_id: Option<i32>,
    /// 评论内容
    pub content: Option<String>,
    /// 评论图片（Java 为**字符串**，可存 JSON 数组文本或单图 URL）
    pub comment_pic: Option<String>,
}

/// `POST /buyerShow/buyerShow/comment/like` 入参
/// （Java `BuyerShowCommentLikeClientParam`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuyerShowCommentLikeClientParam {
    /// 买家秀评论 id（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub buyer_show_comment_id: Option<i32>,
    /// `0`：取消点赞，`1`：点赞（Java `@NotNull`）
    #[serde(default, deserialize_with = "de_opt_i32")]
    pub is_like: Option<i32>,
}

// ——————————————————————————————————————————————
// 返回体 — 买家秀列表（BuyerShowPageClientVO）
// ——————————————————————————————————————————————

/// `GET /buyerShow/buyerShow/list` 的元素（Java `BuyerShowPageClientVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowPageClientVO {
    /// 买家秀 ID
    pub buyer_show_id: i32,
    /// 图片信息（Java 返回 `BuyerShowGallery` 实体列表）
    pub img_list: Vec<BuyerShowGalleryVO>,
    /// 视频信息（Java 返回 `BuyerShowVideo` 实体列表）
    pub video_list: Vec<BuyerShowVideoVO>,
    /// 文字内容
    pub content: Option<String>,
    /// 买家头像
    pub buyer_photo: String,
    /// 买家名称
    pub buyer_name: String,
    /// 点赞数（⚠️ Java 仅在 `buyerShowLikeList` 非空时回填，否则保持 `null`）
    pub like_count: Option<i64>,
    /// 当前用户是否点赞（0：否，1：是）
    /// （⚠️ 同 `likeCount`：Java 仅在点赞列表非空时回填）
    pub is_like: Option<i32>,
    /// 是否视频类（图片与视频按 `sortOrder` 混排后第一条是视频则为是，平局视频优先）
    pub is_video: i32,
}

/// 相册图片（Java `BuyerShowGallery` 实体；列名对齐 `buyer_show_gallery`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowGalleryVO {
    /// 相册 ID
    pub pic_id: i32,
    /// 买家秀 id
    pub buyer_show_id: i32,
    /// 实际图片 url（Java 落库时追加存储尺寸参数）
    pub pic_url: String,
    /// 图片说明信息
    pub pic_desc: String,
    /// 微缩图片 url
    pub pic_thumb: String,
    /// 原图 url
    pub pic_original: String,
    /// 高清图片 url
    pub pic_large: String,
    /// 排序
    pub sort_order: i32,
}

/// 视频素材（Java `BuyerShowVideo` 实体；列名对齐 `buyer_show_video`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowVideoVO {
    /// 主键 id
    pub id: i32,
    /// 视频 ID
    pub video_id: i32,
    /// 买家秀 id
    pub buyer_show_id: i32,
    /// 视频 url
    pub video_url: String,
    /// 视频封面
    pub video_cover: String,
    /// 视频格式后缀
    pub format: String,
    /// 排序（与相册 `sort_order` 同一量纲）
    pub sort_order: i32,
}

// ——————————————————————————————————————————————
// 返回体 — 买家秀详情（BuyerShowClientVO）
// ——————————————————————————————————————————————

/// `GET /buyerShow/buyerShow/detail`（Java `BuyerShowClientVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowClientVO {
    /// 自增 ID，买家秀 ID
    pub buyer_show_id: i32,
    /// 买家头像
    pub buyer_photo: String,
    /// 买家名称
    pub buyer_name: String,
    /// 图片信息
    pub img_list: Vec<BuyerShowGalleryVO>,
    /// 视频信息
    pub video_list: Vec<BuyerShowVideoVO>,
    /// 关联商品信息（Java 直接返回 `Product` 实体列表）
    pub product_list: Vec<BuyerShowProductVO>,
    /// 文字内容
    pub content: Option<String>,
    /// 发布时间（Java `TigUtils.handelTime`，`yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 点赞数
    pub like_count: i64,
    /// 评论数
    pub comment_count: i64,
    /// 当前用户是否点赞（0：否，1：是）
    pub is_like: i32,
    /// 所属分组名称列表（Java `BuyerShowClientVO.groupNameList`）。
    ///
    /// Java 仅在 `group_data` 非空白且解析出的 id 列表非空时**才设置**
    /// 这两个字段（否则保持 `null`）。本实现用 `Option` 复刻：
    /// `group_data` 为空 / 解析为空 → `None` → JSON `null`。
    pub group_name_list: Option<Vec<String>>,
    /// 所属分组 id 列表（Java `groupIdList`，与 `groupNameList` 同条件）
    pub group_id_list: Option<Vec<i32>>,
}

/// 关联商品（Java `Product` 实体的子集：只复刻买家秀详情确实会读写的字段）。
///
/// Java 直接序列化整张 `product` 实体（81 列），本实现只复刻
/// `clientDetail` 真正触及的字段 + 前端详情页必备的展示字段；
/// 其余列（`keywords` / `product_desc` / `attributes` 等）在买家秀详情
/// 接口中并未被 Java 读取或改写，缺失见 `uncertain_points`。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowProductVO {
    /// 商品 ID
    pub product_id: i32,
    /// 商品名称
    pub product_name: String,
    /// 商品货号
    pub product_sn: String,
    /// 商品价格
    pub product_price: Decimal,
    /// 市场价
    pub market_price: Decimal,
    /// 商品主图
    pub pic_url: String,
    /// 缩略图
    pub pic_thumb: String,
    /// 商品库存（Java：`clientDetail` 用「该商品所有 SKU 库存之和」覆盖）
    pub product_stock: i32,
    /// 门店库存（Java：买家秀客户端**直接**映射为 `productStock`）
    pub store_product_stock: i32,
    /// 是否删除（0：否，1：是）
    pub is_delete: i32,
    /// 商品状态（1：上架）
    pub product_status: i32,
    /// 店铺 ID
    pub shop_id: i32,
    /// 是否支持退换货
    pub is_support_return: i32,
}

// ——————————————————————————————————————————————
// 返回体 — 视频流（BuyerShowVideoFeedPageClientVO）
// ——————————————————————————————————————————————

/// `GET /buyerShow/buyerShow/videoFeed`（Java `BuyerShowVideoFeedPageClientVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowVideoFeedPageClientVO {
    /// 当前页视频流项
    pub list: Vec<BuyerShowVideoFeedItemClientVO>,
    /// 下一页游标；无更多时为空串（Java 用 `""`，不是 `null`）
    pub next_cursor: String,
    /// 是否还有下一页
    pub has_more: bool,
}

/// 视频流单项（Java `BuyerShowVideoFeedItemClientVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowVideoFeedItemClientVO {
    /// 买家秀 ID
    pub id: i32,
    /// 视频信息（Java：无视频素材时为 `null`）
    pub video: Option<BuyerShowFeedVideoVO>,
    /// 该买家秀自带图片集，按 `sortOrder` 排序；无附图时为空数组
    pub images: Vec<BuyerShowFeedImageVO>,
    /// 作者信息
    pub author: BuyerShowFeedAuthorVO,
    /// 关联商品（可为空数组）
    pub products: Vec<BuyerShowFeedProductVO>,
    /// 文案
    pub content: Option<String>,
    /// 点赞数
    pub like_count: i64,
    /// 是否已点赞（0 否 / 1 是）
    pub is_like: i32,
    /// 收藏数
    pub favorite_count: i64,
    /// 是否已收藏（0 否 / 1 是）
    pub is_favorite: i32,
    /// 评论数
    pub comment_count: i64,
    /// 发布时间（Java `yyyy-MM-dd HH:mm`）
    pub create_time: String,
}

/// 视频流视频信息（Java `BuyerShowVideoFeedItemClientVO.Video`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowFeedVideoVO {
    /// 视频播放地址
    pub url: String,
    /// 封面图
    pub cover: String,
    /// 宽（暂无采集，恒 `null`）
    pub width: Option<i32>,
    /// 高（暂无采集，恒 `null`）
    pub height: Option<i32>,
    /// 时长（秒，暂无采集，恒 `null`）
    pub duration: Option<i32>,
}

/// 视频流图片（Java `BuyerShowVideoFeedItemClientVO.Image`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowFeedImageVO {
    /// 图片地址
    pub url: String,
    /// 原图宽（暂无采集，恒 `null`）
    pub width: Option<i32>,
    /// 原图高（暂无采集，恒 `null`）
    pub height: Option<i32>,
}

/// 视频流作者（Java `BuyerShowVideoFeedItemClientVO.Author`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowFeedAuthorVO {
    /// 作者会员 ID
    pub id: i32,
    /// 昵称
    pub name: String,
    /// 头像
    pub avatar: String,
    /// 是否已关注（0 否 / 1 是）
    pub is_follow: i32,
}

/// 视频流关联商品（Java `BuyerShowVideoFeedItemClientVO.Product`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowFeedProductVO {
    /// 商品 ID
    pub product_id: i32,
    /// skuId（商品主表无该维度，Java 恒 `null`）
    pub sku_id: Option<i32>,
    /// 商品名
    pub name: String,
    /// 价格（两位小数字符串，Java `BigDecimal.setScale(2, HALF_UP).toPlainString()`）
    pub price: String,
    /// 商品图
    pub pic_url: String,
    /// 库存
    pub stock: i32,
}

// ——————————————————————————————————————————————
// 返回体 — 评论分页（BuyerShowCommentPageClientVO）
// ——————————————————————————————————————————————

/// `GET /buyerShow/buyerShow/comment/pageList` 的元素
/// （Java `BuyerShowCommentPageClientVO`）。
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuyerShowCommentPageClientVO {
    /// 买家秀评论 ID
    pub buyer_show_comment_id: i32,
    /// 评论内容
    pub content: Option<String>,
    /// 评论图片（原文）
    pub comment_pic: Option<String>,
    /// 评论配图 URL 数组（由 `commentPic` 解析，无则为空数组）
    pub images: Vec<String>,
    /// 用户名称
    pub user_name: String,
    /// 用户头像
    pub user_photo: String,
    /// 用户 id（非真实用户为 0）
    pub user_id: i32,
    /// 点赞数（⚠️ Java 仅在 `commentLikeList` 非空时回填，否则保持 `null`）
    pub like_count: Option<i64>,
    /// 当前用户是否点赞（0：否，1：是）（同上，可能为 `null`）
    pub is_like: Option<i32>,
    /// 是否是作者评论（0：否，1：是）
    pub is_author: i32,
    /// 是否是自己评论（0：否，1：是）
    pub is_me: i32,
    /// 回复数
    pub reply_count: i64,
    /// 发布时间（Java `TigUtils.handelTime`）
    pub add_time: String,
}

// ——————————————————————————————————————————————
// 写操作返回体（原接口多为 `void`，此处回传状态便于前端联动）
// ——————————————————————————————————————————————

/// 点赞 / 取消点赞结果（原 Java `void`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleResultVO {
    /// 本次操作是否已「点亮」（`true` = 已点赞 / 已收藏 / 已关注）
    pub active: bool,
}

/// 新增资源的回执（原 Java 接口返回 `void`）。
///
/// 同时用于 `POST /add`（`id` = 新建买家秀主键）与
/// `POST /comment`（`id` = 新建评论主键）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedIdVO {
    /// 新建行主键
    pub id: i32,
}

// ——————————————————————————————————————————————
// serde 辅助：数字兼容（空串 / 数字字符串视为未传）
// ——————————————————————————————————————————————
//
// 与 `models::shop_client` 的 `de_opt_i32` 同构（Spring MVC 的 `@RequestParam`
// 允许 `?page=` 空串，serde 默认会报错，这里统一归一为 `None`）；
// 不复用 merchant::shop_client 的实现以避免跨切片引用其独占文件。

macro_rules! opt_num_de {
    ($fn_name:ident, $ty:ty) => {
        fn $fn_name<'de, D>(de: D) -> Result<Option<$ty>, D::Error>
        where
            D: Deserializer<'de>,
        {
            struct V;

            impl<'de> serde::de::Visitor<'de> for V {
                type Value = Option<$ty>;

                fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                    f.write_str("数字或数字字符串（空串视为未传）")
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
                    t.parse::<$ty>().map(Some).map_err(serde::de::Error::custom)
                }

                // 必须实现整型访问器：`deserialize_any` 遇到 JSON 数字
                // （如 `{"isLike": 1}`）会走 `visit_i64` / `visit_u64`，
                // 未实现即报 "invalid type: integer"。Spring MVC 的
                // `@RequestParam Integer` 同时接受数字与数字字符串，
                // 故这里把 JSON 数字直接转成目标类型（越界走 `try_from`）。
                fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
                    <$ty>::try_from(v)
                        .map(Some)
                        .map_err(serde::de::Error::custom)
                }

                fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
                    <$ty>::try_from(v)
                        .map(Some)
                        .map_err(serde::de::Error::custom)
                }
            }

            de.deserialize_any(V)
        }
    };
}

opt_num_de!(de_opt_i32, i32);
opt_num_de!(de_opt_i64, i64);
opt_num_de!(de_opt_u64, u64);

// ——————————————————————————————————————————————
// 纯逻辑（可单测）
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime(t)`）。
///
/// Java `StringUtils.timestampToDate` 用系统默认时区格式化；
/// 本实现用 `chrono::Local`（同样系统本地时区）。
/// `0` 视为空时间 → 空串（与 `buyer_show.add_time` 为 `0` 的历史数据一致）。
#[must_use]
pub fn handel_time(secs: i64) -> String {
    format_time(secs, "%Y-%m-%d %H:%M:%S")
}

/// 秒级时间戳 → 指定格式（Java `TigUtils.handelTime(t, format)`）。
#[must_use]
pub fn handel_time_with(secs: i64, fmt: &str) -> String {
    format_time(secs, fmt)
}

/// 秒级时间戳格式化公共实现（`0` → 空串；非法时间戳 → 空串）。
fn format_time(secs: i64, fmt: &str) -> String {
    if secs == 0 {
        return String::new();
    }
    match chrono::Local.timestamp_opt(secs, 0) {
        chrono::LocalResult::Single(dt) => dt.format(fmt).to_string(),
        _ => String::new(),
    }
}

/// 解析 `range_data` / `group_data` 这类「JSON 整数数组文本」
/// （Java `JSONUtil.toList(text, Integer.class)`）。
///
/// 空 / 空白 / 非法 JSON / 非数组 → 空列表（Java 侧 `parseRangeData` 捕获异常后
/// 返回 `List.of()`；`group_data` 走 `JSONUtil.toList` 无 try/catch，
/// 但写入侧保证合法，这里统一按「降级为空」处理，不抛错）。
#[must_use]
pub fn parse_i32_array_json(raw: Option<&str>) -> Vec<i32> {
    let Some(text) = raw else {
        return Vec::new();
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    serde_json::from_str::<Vec<i32>>(trimmed).unwrap_or_default()
}

/// 解析评论配图（Java `BuyerShowServiceImpl#parseCommentImages`）。
///
/// 规则（逐字符对齐 Java）：
/// 1. `null` / 空白 → 空数组；
/// 2. 去掉首尾空白后以 `[` 开头 → 按 JSON 字符串数组解析，
///    过滤掉空白项；**解析失败则回退为「单图 = 原文」**；
/// 3. 其余情况 → 单元素数组，元素是**未经 trim 的原文**。
#[must_use]
pub fn parse_comment_images(comment_pic: Option<&str>) -> Vec<String> {
    let Some(raw) = comment_pic else {
        return Vec::new();
    };
    if raw.trim().is_empty() {
        return Vec::new();
    }
    let trimmed = raw.trim();
    if trimmed.starts_with('[') {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(trimmed) {
            return list.into_iter().filter(|s| !s.trim().is_empty()).collect();
        }
    }
    vec![raw.to_string()]
}

/// 价格格式化为两位小数字符串
/// （Java `BuyerShowServiceImpl#formatPrice`：`null` → `"0.00"`，
/// 否则 `setScale(2, HALF_UP).toPlainString()`）。
#[must_use]
pub fn format_price(price: Option<Decimal>) -> String {
    use rust_decimal::RoundingStrategy;
    match price {
        None => "0.00".to_string(),
        // 两步走，语义等价于 Java 的 `setScale(2, HALF_UP).toPlainString()`：
        // 1) `round_dp_with_strategy` 满足 Java 的 HALF_UP（= MidpointAwayFromZero）
        //    舍入语义；
        // 2) 再 `rescale(2)` **补足小数位** —— 只做第 1 步的话
        //    `Decimal::ZERO` 会得到 `"0"` 而非 `"0.00"`，
        //    `Decimal::new(10, 0)` 会得到 `"10"` 而非 `"10.00"`。
        Some(v) => {
            let mut rounded = v.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero);
            rounded.rescale(2);
            rounded.to_string()
        }
    }
}

/// 视频类判定（Java `BuyerShowServiceImpl#isVideoBuyerShow`，唯一口径）。
///
/// 规则：
/// - 无视频 → `false`；
/// - 无图片 → `true`；
/// - 否则比较各自最小 `sort_order`，视频 `<=` 图片时判为视频（平局视频优先）。
///
/// `sort_order` 归一：`None` 视为默认值 `0`
/// （Java `normSortOrder`，与 `videoFeed` SQL 的 `COALESCE(v.sort_order, 0)` 一致）。
#[must_use]
pub fn is_video_buyer_show(
    img_list: &[BuyerShowGalleryVO],
    video_list: &[BuyerShowVideoVO],
) -> bool {
    if video_list.is_empty() {
        return false;
    }
    if img_list.is_empty() {
        return true;
    }
    let video_first = video_list
        .iter()
        .map(|v| v.sort_order)
        .min()
        .unwrap_or(DEFAULT_SORT_ORDER);
    let img_first = img_list
        .iter()
        .map(|g| g.sort_order)
        .min()
        .unwrap_or(DEFAULT_SORT_ORDER);
    video_first <= img_first
}

/// 素材默认排序值（Java `BuyerShowServiceImpl.DEFAULT_SORT_ORDER`）。
pub const DEFAULT_SORT_ORDER: i32 = 0;

/// 视频流发布时间格式（Java `BuyerShowServiceImpl.FEED_TIME_FORMAT`）。
pub const FEED_TIME_FORMAT: &str = "%Y-%m-%d %H:%M";

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ————————————— 分页口径 —————————————

    #[test]
    fn client_query_follows_base_page_defaults_and_cap() {
        let q = BuyerShowPageClientQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
        let q = BuyerShowPageClientQuery {
            size: Some(500),
            page: Some(0),
            ..Default::default()
        };
        assert_eq!(q.page_size(), 100, "BasePage#getSize 上限 100");
        assert_eq!(q.page_no(), 1, "page 最小为 1");
    }

    #[test]
    fn video_feed_query_defaults_to_five_and_caps_at_fifty() {
        // Java 字段初值 5 + getter Math.min(size, 50)
        assert_eq!(BuyerShowVideoFeedClientQuery::default().page_size(), 5);
        assert_eq!(
            BuyerShowVideoFeedClientQuery {
                size: Some(80),
                ..Default::default()
            }
            .page_size(),
            50
        );
        assert_eq!(
            BuyerShowVideoFeedClientQuery {
                size: Some(3),
                ..Default::default()
            }
            .page_size(),
            3
        );
    }

    #[test]
    fn comment_query_defaults_to_fifteen() {
        let q = BuyerShowCommentPageClientQuery::default();
        assert_eq!(q.page_no(), 1);
        assert_eq!(q.page_size(), 15);
    }

    #[test]
    fn query_accepts_empty_string_numbers_like_spring() {
        // serde_urlencoded 把 `?page=&goodsId=` 解析成字符串 `""`，
        // 与 Spring MVC 的 `@RequestParam` 行为一致 → 归一为「未传」。
        let q: BuyerShowPageClientQuery = serde_json::from_value(json!({
            "page": "",
            "size": "",
            "goodsId": "",
            "productId": "7",
        }))
        .unwrap();
        assert_eq!(q.page, None);
        assert_eq!(q.size, None);
        assert_eq!(q.goods_id, None);
        assert_eq!(q.product_id, Some(7));

        let p: BuyerShowLikeClientParam =
            serde_json::from_value(json!({ "buyerShowId": "", "isLike": 1 })).unwrap();
        assert_eq!(p.buyer_show_id, None);
        assert_eq!(p.is_like, Some(1));
    }

    // ————————————— JSON 解析 —————————————

    #[test]
    fn parse_range_data_degrades_to_empty() {
        assert_eq!(parse_i32_array_json(None), Vec::<i32>::new());
        assert_eq!(parse_i32_array_json(Some("")), Vec::<i32>::new());
        assert_eq!(parse_i32_array_json(Some("   ")), Vec::<i32>::new());
        assert_eq!(parse_i32_array_json(Some("not-json")), Vec::<i32>::new());
        assert_eq!(parse_i32_array_json(Some("{\"a\":1}")), Vec::<i32>::new());
        assert_eq!(parse_i32_array_json(Some("[1, 2, 3]")), vec![1, 2, 3]);
        assert_eq!(parse_i32_array_json(Some("[]")), Vec::<i32>::new());
    }

    #[test]
    fn parse_comment_images_matches_java_fallback_rules() {
        // null / 空 → 空数组
        assert!(parse_comment_images(None).is_empty());
        assert!(parse_comment_images(Some("")).is_empty());
        assert!(parse_comment_images(Some("   ")).is_empty());
        // JSON 数组 → 逐项，过滤空白项
        assert_eq!(
            parse_comment_images(Some(r#"["a.jpg","","  ","b.jpg"]"#)),
            vec!["a.jpg".to_string(), "b.jpg".to_string()]
        );
        // 以 `[` 开头但非法 JSON → 单图兜底（保留原文）
        assert_eq!(
            parse_comment_images(Some("[broken")),
            vec!["[broken".to_string()]
        );
        // 非 JSON → 单元素数组，元素为**原文**（不 trim）
        assert_eq!(
            parse_comment_images(Some("  a.jpg  ")),
            vec!["  a.jpg  ".to_string()]
        );
    }

    // ————————————— 价格格式化 —————————————

    #[test]
    fn format_price_always_two_decimals() {
        assert_eq!(format_price(None), "0.00");
        assert_eq!(format_price(Some(Decimal::ZERO)), "0.00");
        assert_eq!(format_price(Some(Decimal::new(10, 0))), "10.00");
        assert_eq!(format_price(Some(Decimal::new(999, 2))), "9.99");
        // HALF_UP：10.005 → 10.01
        assert_eq!(
            format_price(Some(Decimal::from_str_exact("10.005").unwrap())),
            "10.01"
        );
        // 已是两位小数不产生多余尾零
        assert_eq!(format_price(Some(Decimal::new(12345, 2))), "123.45");
    }

    // ————————————— 视频类判定 —————————————

    fn gallery(pic_id: i32, sort_order: i32) -> BuyerShowGalleryVO {
        BuyerShowGalleryVO {
            pic_id,
            sort_order,
            ..Default::default()
        }
    }

    fn video(id: i32, sort_order: i32) -> BuyerShowVideoVO {
        BuyerShowVideoVO {
            id,
            sort_order,
            ..Default::default()
        }
    }

    #[test]
    fn is_video_buyer_show_follows_java_rules() {
        // 无视频 → false
        assert!(!is_video_buyer_show(&[gallery(1, 0)], &[]));
        // 有视频无图 → true
        assert!(is_video_buyer_show(&[], &[video(1, 5)]));
        // 视频 sort 更小 → true
        assert!(is_video_buyer_show(&[gallery(1, 3)], &[video(1, 1)]));
        // 图片 sort 更小 → false
        assert!(!is_video_buyer_show(&[gallery(1, 1)], &[video(1, 3)]));
        // 平局：视频优先 → true
        assert!(is_video_buyer_show(&[gallery(1, 2)], &[video(1, 2)]));
        // 多素材取各自最小值
        assert!(is_video_buyer_show(
            &[gallery(1, 9), gallery(2, 4)],
            &[video(1, 7), video(2, 4)]
        ));
    }

    // ————————————— 时间格式化 —————————————

    #[test]
    fn handel_time_zero_is_empty_and_formats_seconds() {
        assert_eq!(handel_time(0), "");
        // 2026-01-02 03:04:05 UTC+8 的秒级时间戳按本地时区格式化，
        // 这里只断言长度与结构，避免强绑测试机时区。
        let s = handel_time(1_767_315_845);
        assert_eq!(s.len(), 19);
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[13..14], ":");
        let feed = handel_time_with(1_767_315_845, FEED_TIME_FORMAT);
        assert_eq!(feed.len(), 16, "yyyy-MM-dd HH:mm");
    }

    // ————————————— serde 字段名 —————————————

    #[test]
    fn vo_serializes_camel_case_like_java() {
        let vo = BuyerShowVideoFeedItemClientVO {
            id: 3,
            content: Some("hi".into()),
            like_count: 1,
            is_like: 0,
            favorite_count: 2,
            is_favorite: 1,
            comment_count: 4,
            create_time: "2026-01-01 00:00".into(),
            author: BuyerShowFeedAuthorVO {
                id: 9,
                name: "n".into(),
                avatar: "a".into(),
                is_follow: 1,
            },
            ..Default::default()
        };
        let v = serde_json::to_value(&vo).unwrap();
        assert_eq!(v["likeCount"], json!(1));
        assert_eq!(v["isFavorite"], json!(1));
        assert_eq!(v["commentCount"], json!(4));
        assert_eq!(v["createTime"], "2026-01-01 00:00");
        assert_eq!(v["author"]["isFollow"], json!(1));
        // 嵌套 Video / Image 的 null 维度字段仍在（Java 输出 null）
        let video = BuyerShowFeedVideoVO {
            url: "u".into(),
            cover: "c".into(),
            ..Default::default()
        };
        let vv = serde_json::to_value(&video).unwrap();
        assert!(vv["width"].is_null());
        assert!(vv["duration"].is_null());
    }

    #[test]
    fn like_param_defaults_are_none() {
        let p: BuyerShowLikeClientParam = serde_json::from_str("{}").unwrap();
        assert_eq!(p.buyer_show_id, None);
        assert_eq!(p.is_like, None);
        let p: BuyerShowLikeClientParam =
            serde_json::from_str(r#"{"buyerShowId":5,"isLike":1}"#).unwrap();
        assert_eq!(p.buyer_show_id, Some(5));
        assert_eq!(p.is_like, Some(1));
    }
}
