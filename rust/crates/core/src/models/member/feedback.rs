//! 会员留言域（member::feedback）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - 控制器 `com.tigshop.adminapi.controller.user.FeedbackController`
//!   （`@RequestMapping("/adminapi/user/feedback")`，类级
//!   `@PreAuthorize("@pms.hasPermission('feedbackManage')")`）
//! - 服务 `com.tigshop.service.user.impl.FeedbackServiceImpl`
//! - 实体 `com.tigshop.bean.model.user.Feedback`（表 `feedback`，已由
//!   [`crate::entities::user::Feedback`] 自动生成，本文件不重复定义）
//! - 入参 `FeedBackListPageQuery`（继承 `BasePage`）/ `FeedbackUpdateDTO` /
//!   `com.tigshop.bean.dto.common.OperateDTO` / `BatchDTO`
//! - 出参 `UserFeedbackVO` / `UserFeedbackDetailVO`
//! - 枚举 `UserFeedbackType` / `UserFeedbackStatus`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致。
//!
//! ## 本域没有金额字段
//!
//! `feedback` 表的 16 列里没有 `decimal` 列（`python tools/schema_parser.py
//! --table feedback` 已核对），因此本域不涉及金额；**仍然遵守**
//! 「金额一律 `rust_decimal::Decimal`、禁用 f64/f32」的全局约定
//! （本域无金额 ⇒ 无浮点，见 `uncertain_points` 说明）。
//!
//! ## 时间字段
//!
//! `feedback.add_time` 是 `int unsigned`（秒级时间戳），Java 在 VO 里统一用
//! `TigUtils.handelTime` 转成 `yyyy-MM-dd HH:mm:ss` 字符串，
//! 见 [`format_add_time`]（`null` / `0` → 空串）。

use std::collections::HashMap;

use serde::{Deserialize, Deserializer, Serialize};

use crate::entities::user::Feedback;
use crate::types::PageQuery;

// ——————————————————————————————————————————————
// 常量
// ——————————————————————————————————————————————

/// `feedback` 真实存在的 16 个列
/// （`cd rust && python tools/schema_parser.py --table feedback`）。
pub const FEEDBACK_COLUMNS: [&str; 16] = [
    "id",
    "parent_id",
    "user_id",
    "username",
    "email",
    "mobile",
    "title",
    "type",
    "status",
    "content",
    "add_time",
    "feedback_pics",
    "product_id",
    "order_id",
    "complaint_info",
    "shop_id",
];

/// 主键列名（Java `BaseServiceImpl#getKeyColumn` → `feedback` 的 `id`）。
pub const KEY_COLUMN: &str = "id";

/// 主键属性名（Java `Feedback` 实体的 `@TableId` 属性名就是 `id`）。
pub const KEY_PROPERTY: &str = "id";

/// Java `HttpStatus.SERVICE_DATA_ERROR`：
/// `GlobalException(String)` 的默认业务码，也是本域所有业务错误的码。
pub const SERVICE_DATA_ERROR: i32 = 1001;

/// Java `BasePage` 默认页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;

/// Java `BasePage` 页大小上限（`getSize()` 里 `size > 100 → 100`）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// Java `ExceptionConstants.DATA_TYPE_ERROR`
/// （`UserFeedbackType#getTypeName` / `UserFeedbackStatus#getStatusName`
/// 遇到未知码时 `GlobalException(DATA_TYPE_ERROR, SERVICE_DATA_ERROR)`）。
pub const MSG_DATA_TYPE_ERROR: &str = "数据类型异常";

/// Java `FeedbackServiceImpl#requireAdminAccessibleFeedback`：
/// `id` 为 null 或记录不存在时 `GlobalException("留言不存在")`。
pub const MSG_FEEDBACK_NOT_FOUND: &str = "留言不存在";

/// Java `FeedbackServiceImpl#requireAdminAccessibleFeedback`：
/// 越权（平台账号操作店铺留言 / 店铺账号操作非本店或非商品留言）。
pub const MSG_NO_PERMISSION_FEEDBACK: &str = "无权操作该留言";

/// Java `FeedbackServiceImpl#update`：管理员记录不存在。
pub const MSG_ADMIN_NOT_FOUND: &str = "管理员不存在";

/// Java `FeedbackServiceImpl#update`：`id` 指向的回复不属于该父留言。
pub const MSG_REPLY_NOT_BELONG: &str = "回复记录不属于该留言";

/// Java `FeedbackServiceImpl#update`：父留言下没有回复记录。
pub const MSG_REPLY_NOT_FOUND: &str = "回复记录不存在";

/// Java `HeaderUtils.getAdminType()` 返回 null 时
/// `FeedbackServiceImpl#currentAdminTenantScope` 抛的文案。
pub const MSG_MISSING_TENANT: &str = "缺少后台租户信息";

/// Java `currentAdminTenantScope`：店铺类账号拿不到合法 `x-shop-id`。
pub const MSG_MISSING_SHOP: &str = "缺少当前店铺信息";

/// Java `currentAdminTenantScope`：既不是平台也不是店铺/门店账号。
pub const MSG_NO_ACCESS_FEEDBACK: &str = "无权访问会员留言";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`
/// （`OperateDTO.id` 的 `@NotNull` 文案；控制器**没有** `@Valid`，
/// 故该约束在 `del` 上不生效，这里仅作对照记录）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `ResultTextConstants.UNSELECTED_ITEM`（`BatchDTO.ids` 的 `@NotEmpty`）。
pub const MSG_UNSELECTED_ITEM: &str = "未选择项目";

/// Java `ResultTextConstants.OPERATION_TYPE_IS_NULL`
/// （`BatchDTO.type` 的 `@NotNull`；控制器**没有** `@Valid`）。
pub const MSG_OPERATION_TYPE_IS_NULL: &str = "操作类型不能为空";

/// Java `FeedbackServiceImpl#update` 写回复时硬编码的 `title`。
pub const REPLY_TITLE: &str = "reply";

/// Java `FeedbackServiceImpl.SHOP_FEEDBACK_TYPES`（`Set.of(PRODUCT.getCode())`）。
///
/// 只有「商品咨询」类型属于店铺维度；其余类型（建议/投诉/其他/店铺投诉/
/// 订单问题/订单咨询）在 Java 的租户口径里**不属于**店铺留言。
pub const SHOP_FEEDBACK_TYPES: [i32; 1] = [feedback_type::PRODUCT];

/// 留言类型（对应 Java `com.tigshop.bean.enums.user.UserFeedbackType`）。
pub mod feedback_type {
    /// 建议
    pub const SUGGESTION: i32 = 0;
    /// 投诉
    pub const COMPLAINT: i32 = 1;
    /// 商品
    pub const PRODUCT: i32 = 2;
    /// 其他
    pub const OTHER: i32 = 3;
    /// 店铺投诉
    pub const SHOP_COMPLAINT: i32 = 4;
    /// 订单问题
    pub const ORDER_PROBLEM: i32 = 5;
    /// 订单咨询
    pub const ORDER_CONSULTATION: i32 = 6;

    /// 类型文案（Java `UserFeedbackType#getTypeName`）。
    ///
    /// Java 对未知码**抛异常**（`GlobalException(DATA_TYPE_ERROR, 1001)`），
    /// 故这里返回 `Option`，由调用方转成同一业务错误。
    #[must_use]
    pub fn name(code: i32) -> Option<&'static str> {
        match code {
            SUGGESTION => Some("建议"),
            COMPLAINT => Some("投诉"),
            PRODUCT => Some("商品"),
            OTHER => Some("其他"),
            SHOP_COMPLAINT => Some("店铺投诉"),
            ORDER_PROBLEM => Some("订单问题"),
            ORDER_CONSULTATION => Some("订单咨询"),
            _ => None,
        }
    }
}

/// 留言状态（对应 Java `com.tigshop.bean.enums.user.UserFeedbackStatus`）。
pub mod feedback_status {
    /// 待回复
    pub const WAIT_REPLY: i32 = 0;
    /// 已回复
    pub const REPLIED: i32 = 1;
    /// 无效 / 已关闭
    pub const CLOSED: i32 = 2;

    /// 状态文案（Java `UserFeedbackStatus#getStatusName`；未知码 Java 抛异常）。
    #[must_use]
    pub fn name(code: i32) -> Option<&'static str> {
        match code {
            WAIT_REPLY => Some("待回复"),
            REPLIED => Some("已回复"),
            CLOSED => Some("无效"),
            _ => None,
        }
    }
}

/// 该类型是否属于「店铺留言」（Java `SHOP_FEEDBACK_TYPES.contains(type)`）。
#[must_use]
pub fn is_shop_feedback_type(code: i32) -> bool {
    SHOP_FEEDBACK_TYPES.contains(&code)
}

// ——————————————————————————————————————————————
// 租户作用域（对应 Java `TenantScope` record + `currentAdminTenantScope`）
// ——————————————————————————————————————————————

/// 后台租户作用域（Java `FeedbackServiceImpl.TenantScope`）。
///
/// Java 的 record 有 3 个字段 `(scoped, platformAdmin, shopId)`，
/// 但三者只有两种合法组合：
/// - `admin` → `(false, true, 0)`
/// - `shop` / `store` → `(true, false, x-shop-id)`
///
/// 因此这里用枚举表达，避免出现非法组合。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TenantScope {
    /// 平台账号：不加 `shop_id` 过滤，但叠加
    /// `(shop_id = 0 OR type NOT IN (2))`。
    Platform,
    /// 店铺 / 门店账号：强制 `shop_id = 本店` 且 `type IN (2)`。
    Shop {
        /// 当前店铺 ID（Java `HeaderUtils.getShopId()`）
        shop_id: i32,
    },
}

impl TenantScope {
    /// 解析当前请求的租户作用域（对应 Java
    /// `FeedbackServiceImpl#currentAdminTenantScope`）。
    ///
    /// 逐条对照：
    /// 1. `adminType` 为空 → `"缺少后台租户信息"`；
    /// 2. `admin` → 平台；
    /// 3. `shop` / `store` → 店铺；`shopId` 为 null 或 `<= 0`
    ///    → `"缺少当前店铺信息"`；
    /// 4. 其余（`vendor` / `pickup` / `pos` / 未知 / 大小写不符）
    ///    → `"无权访问会员留言"`。
    ///
    /// ## `adminType` 的取值口径
    ///
    /// Java 的 `HeaderUtils.getAdminType()` **只读请求头 `x-admin-type`**，
    /// 并在「`x-admin-type = shop` 且请求属性 `x-shop-type ∈ {2,3}`」时
    /// 细化为 `store` / `pickup`（`2` → 门店，`3` → 自提点）。
    /// 该请求属性由 `ShopServiceImpl` 在登录上下文里写入（不是客户端头），
    /// Rust 侧没有等价上下文，故这里把 `shop_type` 作为**入参**由路由层提供
    /// （路由层读 `x-shop-type` 请求头，见 `uncertain_points`）。
    ///
    /// ⚠️ 细化结果会影响结论：`store` 属于店铺族（有权），
    /// `pickup` 落到「其余」分支（无权）——与 Java 一致。
    pub fn resolve(
        admin_type: Option<&str>,
        shop_type: Option<i32>,
        shop_id: Option<i32>,
    ) -> Result<Self, String> {
        let raw = admin_type.ok_or_else(|| MSG_MISSING_TENANT.to_string())?;
        // Java `HeaderUtils.getAdminType()`：`shop` + x-shop-type 2/3 → store/pickup
        let effective = match (raw, shop_type) {
            ("shop", Some(2)) => "store",
            ("shop", Some(3)) => "pickup",
            _ => raw,
        };
        match effective {
            "admin" => Ok(Self::Platform),
            "shop" | "store" => match shop_id {
                Some(v) if v > 0 => Ok(Self::Shop { shop_id: v }),
                _ => Err(MSG_MISSING_SHOP.to_string()),
            },
            _ => Err(MSG_NO_ACCESS_FEEDBACK.to_string()),
        }
    }

    /// 是否店铺维度（Java `TenantScope.scoped()`）。
    #[must_use]
    pub fn is_scoped(self) -> bool {
        matches!(self, Self::Shop { .. })
    }

    /// 是否平台账号（Java `TenantScope.platformAdmin()`）。
    #[must_use]
    pub fn platform_admin(self) -> bool {
        matches!(self, Self::Platform)
    }

    /// 当前店铺 ID（平台账号为 `None`，Java 里是 `0`）。
    #[must_use]
    pub fn shop_id(self) -> Option<i32> {
        match self {
            Self::Platform => None,
            Self::Shop { shop_id } => Some(shop_id),
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 列表查询（Java `com.tigshop.bean.query.user.FeedBackListPageQuery`）。
///
/// 继承 `BasePage`（`page` / `size` / `sortField` / `keyword` / `sortOrder` /
/// `sortItems`），另有 `type` / `isOrder` / `productId` / `status` / `userId` /
/// `shopId` / `excludeReply`。
///
/// ⚠️ `excludeReply` 只在 `listProductConsultations`（前台链路）里被写入，
/// 本域 `listForAdmin` **不读取**该字段；这里保留字段仅用于契约完整。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FeedbackListQuery {
    /// 留言类型，逗号分隔（Java `type`）
    pub r#type: Option<String>,
    /// 前端留言类型：`1` → 只看 `order_id = 0`；`> 1` → 只看 `order_id > 0`
    pub is_order: Option<i32>,
    /// 商品 ID
    pub product_id: Option<i32>,
    /// 状态，0：待回复，1：已回复，2：无效
    pub status: Option<i32>,
    /// 会员 ID（Java 里 `> 0` 才生效）
    pub user_id: Option<i32>,
    /// 店铺 / 门店 ID（店铺账号会被登录态强制覆盖）
    pub shop_id: Option<i32>,
    /// 是否排除回复（本域 `listForAdmin` 未使用）
    #[serde(default, deserialize_with = "de::opt_bool")]
    pub exclude_reply: Option<bool>,
    /// 关键字：模糊匹配 `content`（Java `BasePage.keyword`）
    pub keyword: Option<String>,
    /// 排序字段（Java `BasePage.sortField`，属性名或列名）
    pub sort_field: Option<String>,
    /// `asc` / `desc`（其余值或空 ⇒ 降序）
    pub sort_order: Option<String>,
    /// 多字段排序（Java `BasePage.sortItems`；支持 JSON 数组或 JSON 字符串）
    #[serde(default, deserialize_with = "de::opt_sort_items")]
    pub sort_items: Option<Vec<SortItem>>,
    /// 页码，默认 1
    pub page: Option<u64>,
    /// 每页条数，默认 15、上限 100（Java `BasePage.getSize()`）
    pub size: Option<u64>,
}

/// 排序项（Java `com.tigshop.common.core.entity.SortItem`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SortItem {
    /// 排序字段（属性名或列名，白名单外回退主键列）
    pub field: Option<String>,
    /// `asc` / `desc`（非 `asc` 一律按 `desc`）
    pub order: Option<String>,
}

impl FeedbackListQuery {
    /// 有效关键字（Java `StrUtil.isNotBlank(pageQuery.getKeyword())`）。
    #[must_use]
    pub fn effective_keyword(&self) -> Option<&str> {
        non_blank(self.keyword.as_deref())
    }

    /// 归一化分页参数（Java `BasePage#getPage` / `#getSize`）。
    ///
    /// ⚠️ 与 Java 的一处差异：Java `getSize()` 对 `0` / 负数**不**兜底
    /// （会生成 `LIMIT 0`），本实现按项目统一口径夹到 `1..=100`
    /// （与 tax_rate 的 `page_query()` 一致，已列入 `uncertain_points`）。
    #[must_use]
    pub fn page_query(&self) -> PageQuery {
        PageQuery {
            page: self.page.unwrap_or(1).max(1),
            page_size: self
                .size
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(1, MAX_PAGE_SIZE),
        }
    }
}

/// 后台回复请求（Java `com.tigshop.bean.dto.user.FeedbackUpdateDTO`）。
///
/// Java 上**没有** Bean Validation 注解，且控制器只写 `@RequestBody`
/// （无 `@Valid`），因此所有字段都可空。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FeedbackUpdateDTO {
    /// 反馈内容（回复正文）
    pub content: Option<String>,
    /// 留言 ID（`parentId == 0` 时表示要回复的主留言）
    pub id: Option<i32>,
    /// 父 ID：`0` → 新建回复；非 `0` → 编辑已有回复
    pub parent_id: Option<i32>,
    /// 产品信息（本域服务层**未使用**，仅保留契约字段）
    pub product: Option<FeedbackProductDTO>,
    /// 回复标题（服务层只做 XSS 清洗，落库时被硬编码为 `"reply"`）
    pub title: Option<String>,
    /// 邮箱
    pub email: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 图片上传
    pub feedback_pics: Option<Vec<String>>,
    /// `product_id`（本域服务层未使用）
    pub product_id: Option<i32>,
    /// 订单 ID（本域服务层未使用）
    pub order_id: Option<i32>,
}

/// `FeedbackUpdateDTO.Product`（Java 内部类 `Product{id, productName}`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FeedbackProductDTO {
    /// 产品 ID
    pub id: Option<i32>,
    /// 产品名称
    pub product_name: Option<String>,
}

/// 删除请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本）。
///
/// ⚠️ Java `FeedbackController.del` 只有 `@RequestBody`，**没有** `@Valid`，
/// 因此 `id` 的 `@NotNull` 不生效：`id` 为 null 时会一路传到
/// `requireAdminAccessibleFeedback(null)` → `"留言不存在"`。
/// 本实现复刻该可观测行为（不做路由层必填校验）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 主键
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

/// 批量操作请求（Java `com.tigshop.bean.dto.common.BatchDTO`）。
///
/// 控制器同样只有 `@RequestBody`（无 `@Valid`），故 `ids` / `type` 的空值
/// 由服务层自行判断（Java `batch` 直接 `return false`）。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BatchDTO {
    /// 主键列表
    pub ids: Option<Vec<i32>>,
    /// 操作类型（本域只认 `"del"`）
    pub r#type: Option<String>,
    /// 值（本域不使用）
    pub value: Option<i32>,
    /// 数据（本域不使用）
    pub data: Option<serde_json::Value>,
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 留言列表项（对应 Java `com.tigshop.bean.vo.user.UserFeedbackVO`）。
///
/// 由 `BeanUtils.copyProperties(feedback, vo)` + 若干显式赋值构造：
/// 同名属性直拷（`id` / `title` / `userId` / `username` / `content` / `type` /
/// `status` / `productId` / `orderId` / `shopId`），
/// `addTime` 单独格式化为字符串，`typeName` 由枚举派生，
/// `nickname` / `orderSn` / `product` / `shop` / `reply` 由关联表回查。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackVO {
    /// 问题类型名称
    pub type_name: String,
    /// 留言 ID
    pub id: i32,
    /// 留言标题
    pub title: String,
    /// 添加时间（`yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 用户 ID
    pub user_id: i32,
    /// 用户名（`feedback.username`）
    pub username: String,
    /// 留言内容
    pub content: String,
    /// 问题类型
    pub r#type: i32,
    /// 状态
    pub status: i32,
    /// 产品 ID
    pub product_id: Option<i32>,
    /// 订单 ID
    pub order_id: Option<i32>,
    /// 订单号（回查 `order`，查不到为 null）
    pub order_sn: Option<String>,
    /// 用户昵称（回查 `user`，查不到为 null）
    pub nickname: Option<String>,
    /// 产品信息（`productId > 0` 且回查到商品才有值）
    pub product: Option<UserFeedbackProductVO>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 店铺信息（`shopId > 0` 且回查到店铺才有值）
    pub shop: Option<UserFeedbackShopVO>,
    /// 最新一条回复（按 `id DESC` 取第一条）
    pub reply: Option<UserFeedbackReplyVO>,
}

/// `UserFeedbackVO.Product`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackProductVO {
    /// 产品 ID
    pub product_id: i32,
    /// 产品名称
    pub product_name: String,
}

/// `UserFeedbackVO.Shop`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackShopVO {
    /// 店铺 ID
    pub shop_id: i32,
    /// 店铺名称
    pub shop_title: Option<String>,
}

/// `UserFeedbackVO.Reply`（列表里的最新回复摘要）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackReplyVO {
    /// 回复时间（`yyyy-MM-dd HH:mm:ss`）
    pub add_time: String,
    /// 回复内容
    pub content: String,
    /// 回复 ID
    pub id: i32,
    /// 父 ID
    pub parent_id: i32,
    /// 回复人姓名
    pub username: String,
}

/// 留言详情（对应 Java `com.tigshop.bean.vo.user.UserFeedbackDetailVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackDetailVO {
    /// 问题类型名称
    pub type_name: String,
    /// 状态名称
    pub status_name: String,
    /// 留言 ID
    pub id: i32,
    /// 留言标题
    pub title: String,
    /// 添加时间
    pub add_time: String,
    /// 用户 ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 留言内容
    pub content: String,
    /// 问题类型
    pub r#type: i32,
    /// 状态
    pub status: i32,
    /// 产品 ID
    pub product_id: Option<i32>,
    /// 订单 ID
    pub order_id: Option<i32>,
    /// 订单号（回查到订单才有值）
    pub order_sn: Option<String>,
    /// 用户昵称
    pub nickname: Option<String>,
    /// 产品信息
    pub product: Option<UserFeedbackDetailProductVO>,
    /// 订单信息
    pub order_info: Option<UserFeedbackDetailOrderVO>,
    /// 店铺 ID
    pub shop_id: Option<i32>,
    /// 店铺信息
    pub shop: Option<UserFeedbackDetailShopVO>,
    /// 回复列表（无回复时为 null）
    pub reply_list: Option<Vec<UserFeedbackDetailReplyVO>>,
    /// 图片（`feedback_pics` 解析失败或长度 ≤ 3 时为 null）
    pub feedback_pics: Option<Vec<String>>,
}

/// `UserFeedbackDetailVO.Product`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackDetailProductVO {
    /// 产品 ID
    pub product_id: i32,
    /// 产品名称
    pub product_name: String,
}

/// `UserFeedbackDetailVO.OrderInfo`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackDetailOrderVO {
    /// 订单 ID
    pub order_id: i32,
    /// 订单号
    pub order_sn: String,
}

/// `UserFeedbackDetailVO.Shop`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackDetailShopVO {
    /// 店铺 ID
    pub shop_id: i32,
    /// 店铺名称
    pub shop_title: Option<String>,
}

/// `UserFeedbackDetailVO.Reply`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFeedbackDetailReplyVO {
    /// 回复 ID
    pub id: i32,
    /// 父 ID
    pub parent_id: i32,
    /// 用户名
    pub username: String,
    /// 邮箱
    pub email: Option<String>,
    /// 手机号（Java 侧带 `@Sensitive(PHONE)`，仅在 `tigshop.is-demo=1` 时脱敏）
    pub mobile: Option<String>,
    /// 回复内容
    pub content: String,
    /// 状态
    pub status: i32,
    /// 类型
    pub r#type: i32,
}

// ——————————————————————————————————————————————
// 关联表回查结果（纯数据结构，便于单测 VO 组装）
// ——————————————————————————————————————————————

/// `list` / `detail` 的关联表回查结果。
///
/// 对应 Java 里的 `userMap` / `orderMap` / `productMap` / `shopMap`
/// （全部来自 `IN (...)` 批量查询，避免 N+1）。
#[derive(Debug, Clone, Default)]
pub struct FeedbackLookups {
    /// `user_id → nickname`
    pub users: HashMap<i32, Option<String>>,
    /// `order_id → order_sn`
    pub orders: HashMap<i32, String>,
    /// `product_id → product_name`
    pub products: HashMap<i32, String>,
    /// `shop_id → shop_title`
    pub shops: HashMap<i32, Option<String>>,
}

impl FeedbackLookups {
    /// 用户昵称（查不到用户 → `None`）。
    #[must_use]
    pub fn nickname(&self, user_id: i32) -> Option<String> {
        self.users.get(&user_id).cloned().flatten()
    }

    /// 订单号（`order_id <= 0` 或查不到 → `None`）。
    #[must_use]
    pub fn order_sn(&self, order_id: Option<i32>) -> Option<String> {
        order_id
            .filter(|v| *v > 0)
            .and_then(|v| self.orders.get(&v).cloned())
    }

    /// 商品信息（`product_id <= 0` 或查不到 → `None`）。
    #[must_use]
    pub fn product(&self, product_id: Option<i32>) -> Option<UserFeedbackProductVO> {
        let id = product_id.filter(|v| *v > 0)?;
        self.products.get(&id).map(|name| UserFeedbackProductVO {
            product_id: id,
            product_name: name.clone(),
        })
    }

    /// 店铺信息（`shop_id <= 0` 或查不到 → `None`）。
    #[must_use]
    pub fn shop(&self, shop_id: Option<i32>) -> Option<UserFeedbackShopVO> {
        let id = shop_id.filter(|v| *v > 0)?;
        self.shops.get(&id).map(|title| UserFeedbackShopVO {
            shop_id: id,
            shop_title: title.clone(),
        })
    }
}

/// 组装列表项 VO（对应 Java `FeedbackServiceImpl#list` 里的
/// `feedbackList.stream().map(...)`）。
///
/// `replies` 的键是 `parent_id`，值是该父留言**最新的一条**回复
/// （Java 用 `orderByDesc(id)` + `putIfAbsent` 得到同一结果）。
///
/// 未知的 `type` 会返回 `Err(1001, "数据类型异常")` —— 与 Java
/// `UserFeedbackType#getTypeName` 抛异常的可观测行为一致（整页请求失败）。
pub fn build_list_vo(
    f: &Feedback,
    replies: &HashMap<i32, Feedback>,
    lookups: &FeedbackLookups,
) -> crate::Result<UserFeedbackVO> {
    let type_name = feedback_type::name(f.r#type)
        .ok_or_else(|| crate::Error::biz(SERVICE_DATA_ERROR, MSG_DATA_TYPE_ERROR))?;
    Ok(UserFeedbackVO {
        type_name: type_name.to_string(),
        id: f.id,
        title: f.title.clone(),
        add_time: format_add_time(Some(f.add_time)),
        user_id: f.user_id,
        username: f.username.clone(),
        content: f.content.clone(),
        r#type: f.r#type,
        status: f.status,
        product_id: f.product_id,
        order_id: f.order_id,
        order_sn: lookups.order_sn(f.order_id),
        nickname: lookups.nickname(f.user_id),
        product: lookups.product(f.product_id),
        shop_id: f.shop_id,
        shop: lookups.shop(f.shop_id),
        reply: replies.get(&f.id).map(|r| UserFeedbackReplyVO {
            add_time: format_add_time(Some(r.add_time)),
            content: r.content.clone(),
            id: r.id,
            parent_id: r.parent_id,
            username: r.username.clone(),
        }),
    })
}

/// 组装详情 VO（对应 Java `FeedbackServiceImpl#detail`）。
///
/// - `nickname`：回查 `user.nickname`；
/// - `order`：`(order_id, order_sn)`，仅当 `order_id > 0` 且查得到时才有值
///   （Java 查不到订单时 `orderSn` / `orderInfo` 都不设置）；
/// - `product` / `shop`：同理；
/// - `replies`：按 `id DESC` 的全量回复；为空时 `replyList` 保持 `null`。
pub fn build_detail_vo(
    f: &Feedback,
    nickname: Option<String>,
    order: Option<(i32, String)>,
    product: Option<(i32, String)>,
    shop: Option<(i32, Option<String>)>,
    replies: &[Feedback],
) -> crate::Result<UserFeedbackDetailVO> {
    let type_name = feedback_type::name(f.r#type)
        .ok_or_else(|| crate::Error::biz(SERVICE_DATA_ERROR, MSG_DATA_TYPE_ERROR))?;
    let status_name = feedback_status::name(f.status)
        .ok_or_else(|| crate::Error::biz(SERVICE_DATA_ERROR, MSG_DATA_TYPE_ERROR))?;

    let reply_list = if replies.is_empty() {
        None
    } else {
        Some(
            replies
                .iter()
                .map(|r| UserFeedbackDetailReplyVO {
                    id: r.id,
                    parent_id: r.parent_id,
                    username: r.username.clone(),
                    email: r.email.clone(),
                    mobile: r.mobile.clone(),
                    content: r.content.clone(),
                    status: r.status,
                    r#type: r.r#type,
                })
                .collect(),
        )
    };

    Ok(UserFeedbackDetailVO {
        type_name: type_name.to_string(),
        status_name: status_name.to_string(),
        id: f.id,
        title: f.title.clone(),
        add_time: format_add_time(Some(f.add_time)),
        user_id: f.user_id,
        username: f.username.clone(),
        content: f.content.clone(),
        r#type: f.r#type,
        status: f.status,
        product_id: f.product_id,
        order_id: f.order_id,
        order_sn: order.as_ref().map(|(_, sn)| sn.clone()),
        nickname,
        product: product.map(|(product_id, product_name)| UserFeedbackDetailProductVO {
            product_id,
            product_name,
        }),
        order_info: order
            .map(|(order_id, order_sn)| UserFeedbackDetailOrderVO { order_id, order_sn }),
        shop_id: f.shop_id,
        shop: shop.map(|(shop_id, shop_title)| UserFeedbackDetailShopVO {
            shop_id,
            shop_title,
        }),
        reply_list,
        feedback_pics: parse_detail_feedback_pics(f.feedback_pics.as_deref()),
    })
}

// ——————————————————————————————————————————————
// 类型筛选（对应 Java `list` 里的 types 解析）
// ——————————————————————————————————————————————

/// 店铺账号的类型筛选（Java `FeedbackServiceImpl#resolveShopFeedbackTypes`）。
///
/// - `requestedTypes` 为 blank → `[2]`（`SHOP_FEEDBACK_TYPES`）；
/// - 否则按 `,` 切分、逐个 `trim`，**只保留字符串等于 `"2"` 的项**，
///   去重后返回（可能为空 —— 此时 Java 会追加 `1 = 0` 得到空页）。
#[must_use]
pub fn resolve_shop_feedback_types(requested: Option<&str>) -> Vec<i32> {
    if is_blank(requested) {
        return SHOP_FEEDBACK_TYPES.to_vec();
    }
    let mut out: Vec<i32> = Vec::new();
    for part in split_types(requested.unwrap_or_default()) {
        // Java：`SHOP_FEEDBACK_TYPES.stream().anyMatch(t -> t.toString().equals(type))`
        // 即**字符串**比较，故只可能是 "2"，`Integer::valueOf` 必然成功。
        if part.trim() == "2" && !out.contains(&feedback_type::PRODUCT) {
            out.push(feedback_type::PRODUCT);
        }
    }
    out
}

/// 平台账号的类型筛选（Java `StrUtil.split(pageQuery.getType(), ',')`）。
///
/// ⚠️ 逐条复刻 hutool 语义：
/// - `null` / `""` → 空表（hutool `split` 对 `isEmpty` 直接返回空表）；
/// - `"   "` → 长度为 1 的表 `["   "]`（`isTrim=false`、`ignoreEmpty=false`）；
/// - 连续分隔符产生空串（`"1,,2"` → `["1","","2"]`）。
///
/// MyBatis-Plus 把每个元素当**字符串**绑定到 `tinyint` 列，MySQL 在比较时
/// 把无法解析的串（含空串）转成 `0`，故这里用 `parse().unwrap_or(0)`
/// 得到与 Java 相同的过滤结果。
#[must_use]
pub fn resolve_platform_feedback_types(requested: Option<&str>) -> Vec<i32> {
    match requested {
        None => Vec::new(),
        Some(s) if s.is_empty() => Vec::new(),
        Some(s) => split_types(s)
            .into_iter()
            .map(|p| p.trim().parse::<i32>().unwrap_or(0))
            .collect(),
    }
}

/// Java `StrUtil.split(str, ',')`：不做 trim、不忽略空串。
fn split_types(s: &str) -> Vec<&str> {
    s.split(',').collect()
}

// ——————————————————————————————————————————————
// 排序（对应 Java `BaseServiceImpl#buildSortOrder`）
// ——————————————————————————————————————————————

/// `feedback` 的排序白名单（属性名 / 列名 → 真实列名）。
///
/// Java `BaseServiceImpl#getColumnByPropertyName`：命中属性名或列名则返回该列，
/// **未命中回退主键列**（安全修复，防注入）。
#[must_use]
pub fn map_order_column(field: &str) -> &'static str {
    match field {
        "id" => "id",
        "parentId" | "parent_id" => "parent_id",
        "userId" | "user_id" => "user_id",
        "username" => "username",
        "email" => "email",
        "mobile" => "mobile",
        "title" => "title",
        "type" => "type",
        "status" => "status",
        "content" => "content",
        "addTime" | "add_time" => "add_time",
        "feedbackPics" | "feedback_pics" => "feedback_pics",
        "productId" | "product_id" => "product_id",
        "orderId" | "order_id" => "order_id",
        "complaintInfo" | "complaint_info" => "complaint_info",
        "shopId" | "shop_id" => "shop_id",
        _ => KEY_COLUMN,
    }
}

/// 计算 `list` 的 `ORDER BY` 子句（含前导空格；无排序时返回空串）。
///
/// 逐条对照 Java `BaseServiceImpl#buildSortOrder(Page, BasePage)`：
/// 1. `sortItems` **非空** → 只用 items（每项 `field` 为空则跳过；
///    `order` 忽略大小写等于 `asc` 用 ASC，**其余一律 DESC**）；
///    items 全部被跳过时**完全没有** ORDER BY；
/// 2. 否则走三参数版本：`sortField` 为空或等于主键属性名 → 主键列；
///    `asc` → 升序；`desc` 或**空串** → 降序；其它值 → 完全不追加 ORDER BY。
///
/// ⚠️ 这里**不做 trim**：Java 用 `StrUtil.isEmpty` / `equalsIgnoreCase`
/// 逐字符判断，`" rate "` 会落到「未命中 → 主键列」，`" asc"` 会落到
/// 「其它值 → 无 ORDER BY」。trim 会改变结论，故必须保持原样。
#[must_use]
pub fn list_order_clause(q: &FeedbackListQuery) -> String {
    if let Some(items) = q.sort_items.as_ref().filter(|v| !v.is_empty()) {
        let parts: Vec<String> = items
            .iter()
            .filter_map(|it| {
                let field = it.field.as_deref().filter(|f| !f.is_empty())?;
                let column = if field == KEY_PROPERTY {
                    KEY_COLUMN
                } else {
                    map_order_column(field)
                };
                let dir = if it
                    .order
                    .as_deref()
                    .is_some_and(|o| o.eq_ignore_ascii_case("asc"))
                {
                    "ASC"
                } else {
                    "DESC"
                };
                Some(format!("{column} {dir}"))
            })
            .collect();
        return if parts.is_empty() {
            String::new()
        } else {
            format!(" ORDER BY {}", parts.join(", "))
        };
    }
    single_order_clause(q.sort_field.as_deref(), q.sort_order.as_deref())
}

/// Java `BaseServiceImpl#buildSortOrder(Page, String, String)`。
fn single_order_clause(sort_field: Option<&str>, sort_order: Option<&str>) -> String {
    let field = sort_field.filter(|s| !s.is_empty()).unwrap_or(KEY_COLUMN);
    let column = if field == KEY_PROPERTY || field == KEY_COLUMN {
        KEY_COLUMN
    } else {
        map_order_column(field)
    };
    match sort_order {
        Some(s) if s.eq_ignore_ascii_case("asc") => format!(" ORDER BY {column} ASC"),
        Some(s) if s.eq_ignore_ascii_case("desc") => format!(" ORDER BY {column} DESC"),
        None => format!(" ORDER BY {column} DESC"),
        Some(s) if s.is_empty() => format!(" ORDER BY {column} DESC"),
        // Java 是 `if asc ... else if desc||empty ...`，非法值两个分支都不进
        Some(_) => String::new(),
    }
}

// ——————————————————————————————————————————————
// 文本工具
// ——————————————————————————————————————————————

/// Java `StrUtil.isBlank`。
#[must_use]
pub fn is_blank(s: Option<&str>) -> bool {
    s.map(|v| v.trim().is_empty()).unwrap_or(true)
}

/// 去空白后取非空字符串（Java `StrUtil.isNotBlank` 口径）。
#[must_use]
pub fn non_blank(s: Option<&str>) -> Option<&str> {
    s.map(str::trim).filter(|t| !t.is_empty())
}

/// Java `StrUtil.blankToDefault(str, default)`。
#[must_use]
pub fn blank_to_default(s: Option<&str>, default: &str) -> String {
    match s {
        Some(v) if !v.trim().is_empty() => v.to_string(),
        _ => default.to_string(),
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`
/// （Java `TigUtils.handelTime(Long)`）。
///
/// - `null` / `0` → `""`；
/// - 其余按**本地时区**格式化（Java 用 `SimpleDateFormat` 默认时区，
///   本项目部署时区为 `Asia/Shanghai`，故这里固定 UTC+8，与 tax_rate 的
///   `TimestampToDateSerializer` 口径一致）。
#[must_use]
pub fn format_add_time(secs: Option<i32>) -> String {
    match secs {
        None | Some(0) => String::new(),
        Some(v) => format_secs_utc8(i64::from(v)),
    }
}

/// epoch 秒 → 固定 UTC+8 的 `yyyy-MM-dd HH:mm:ss`（纯整数运算，无时区依赖）。
fn format_secs_utc8(secs: i64) -> String {
    let local = secs.saturating_add(8 * 3600);
    let days = local.div_euclid(86_400);
    let rem = local.rem_euclid(86_400);
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    format!("{year:04}-{m:02}-{d:02} {hour:02}:{minute:02}:{second:02}")
}

/// `String[] feedbackPics` → 库列文本
/// （Java `FeedbackServiceImpl#toFeedbackPics` + `JsonUtil.toJson`）。
///
/// `null` / 空数组 → 字面量 `"[]"`。
///
/// ⚠️ Java 的 `JsonUtil`（Jackson）开了 `INDENT_OUTPUT`，落库的是**美化** JSON；
/// 本实现写紧凑 JSON（`["a","b"]`），语义等价、字节不同
/// （与 im_config / user_rank / mobile_cat_nav 的既有取舍一致）。
#[must_use]
pub fn to_feedback_pics(pics: Option<&[String]>) -> String {
    match pics {
        Some(v) if !v.is_empty() => serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()),
        _ => "[]".to_string(),
    }
}

/// 库列文本 → `Vec<String>`
/// （Java `JsonUtil.jsonToList(pics, String.class)`）。
///
/// 解析失败（Jackson 抛异常被 `JsonUtil` 吞掉）返回 `null`。
/// 本实现返回 `Option`：解析失败 → `None`（字段保持 `null`）。
///
/// ⚠️ 本函数**只做「非空白才解析」**；`detail` 链路还额外要求
/// `length() > 3`，请用 [`parse_detail_feedback_pics`]。
#[must_use]
pub fn parse_feedback_pics(raw: Option<&str>) -> Option<Vec<String>> {
    let text = non_blank(raw)?;
    serde_json::from_str::<Vec<String>>(text).ok()
}

/// `detail` 的 `feedbackPics`（对应 Java `detail` 里的
/// `StrUtil.isNotBlank(pics) && pics.length() > 3` 才解析）。
///
/// ⚠️ 与 [`parse_feedback_pics`] 不同：这里额外要求**非空白且长度 > 3**，
/// 因此 `"[]"`（长度 2）、`"[1]"`（长度 3）等短串保持 `None`
/// —— 与 Java 的可观测行为一致（字段不设置 ⇒ JSON `null`）。
///
/// ⚠️ 长度按**字符数**近似 Java `String.length()`（UTF-16 码元）；对
/// BMP 以外的字符（emoji 等）两者会差 1，仅影响「3 与 4 之间」的病态 JSON，
/// 已列入 `uncertain_points`。
#[must_use]
pub fn parse_detail_feedback_pics(raw: Option<&str>) -> Option<Vec<String>> {
    let text = non_blank(raw)?;
    if text.chars().count() <= 3 {
        return None;
    }
    serde_json::from_str::<Vec<String>>(text).ok()
}

// ——————————————————————————————————————————————
// XSS 清洗（对应 Java `com.tigshop.common.utils.XssUtils#clean`）
// ——————————————————————————————————————————————

/// 复刻 Java `XssUtils#clean`：移除 script 标签、`javascript:` / `vbscript:`
/// 协议、事件处理器属性、`expression(` / `eval(` / `alert(` / `confirm(` /
/// `prompt(`。
///
/// 逐条对照 `XssUtils` 的 9 个 `Pattern`（全部 `CASE_INSENSITIVE`，
/// script 正则另加 `DOTALL`）：
/// 1. `<script[^>]*?>.*?</script>` → 删除整段；
/// 2. `javascript\s*:`；3. `vbscript\s*:`；4. `on\w+\s*= `（即 `on\w+\s*=`）；
/// 5. `expression\s*\(`；6. `eval\s*\(`；7. `alert\s*\(`；
/// 8. `confirm\s*\(`；9. `prompt\s*\(`。
///
/// ⚠️ `XssUtils` 里还定义了 `DATA_PATTERN`（`data\s*:`），但 `clean` **没有**
/// 使用它，故本实现同样**不**移除 `data:`（照抄 Java 的可观测行为）。
///
/// ⚠️ 与 Java 一样，该清洗**不转义** HTML（`escape` / `cleanAndEscape`
/// 在本域未被调用）。
#[must_use]
pub fn xss_clean(content: &str) -> String {
    if content.trim().is_empty() {
        // Java `StrUtil.isBlank(content)` 直接原样返回
        return content.to_string();
    }
    let mut s = content.to_string();
    s = strip_ci(&s, find_script_block);
    s = strip_ci(&s, |h, from| find_keyword_colon(h, "javascript", from));
    s = strip_ci(&s, |h, from| find_keyword_colon(h, "vbscript", from));
    s = strip_ci(&s, find_event_handler);
    s = strip_ci(&s, |h, from| find_call(h, "expression", from));
    s = strip_ci(&s, |h, from| find_call(h, "eval", from));
    s = strip_ci(&s, |h, from| find_call(h, "alert", from));
    s = strip_ci(&s, |h, from| find_call(h, "confirm", from));
    s = strip_ci(&s, |h, from| find_call(h, "prompt", from));
    s
}

/// 按「从左到右、不重叠」的语义删除所有匹配（等价 `Matcher.replaceAll("")`）。
fn strip_ci<F>(input: &str, mut find: F) -> String
where
    F: FnMut(&str, usize) -> Option<(usize, usize)>,
{
    let mut out = String::with_capacity(input.len());
    let mut cursor = 0usize;
    let mut search = 0usize;
    while let Some((start, end)) = find(input, search) {
        if start < cursor {
            // 理论上不会发生（find 从 search ≥ cursor 开始），保险处理
            break;
        }
        out.push_str(&input[cursor..start]);
        cursor = end;
        search = end;
    }
    out.push_str(&input[cursor..]);
    out
}

/// ASCII 大小写不敏感查找（返回**字节**下标；ASCII 字节必为字符边界）。
fn find_ci(hay: &str, needle: &str, from: usize) -> Option<usize> {
    let hb = hay.as_bytes();
    let nb = needle.as_bytes();
    if nb.is_empty() || from >= hb.len() || nb.len() > hb.len() - from {
        return None;
    }
    (from..=hb.len() - nb.len()).find(|&i| {
        hb[i..i + nb.len()]
            .iter()
            .zip(nb)
            .all(|(a, b)| a.eq_ignore_ascii_case(b))
    })
}

/// Java `\w`（默认 ASCII）：`[A-Za-z0-9_]`。
fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Java `\s`（ASCII）：`[ \t\n\x0B\f\r]`。
fn is_space_byte(b: u8) -> bool {
    matches!(b, b' ' | b'\t' | b'\n' | 0x0B | 0x0C | b'\r')
}

fn skip_spaces(hay: &str, mut i: usize) -> usize {
    let hb = hay.as_bytes();
    while i < hb.len() && is_space_byte(hb[i]) {
        i += 1;
    }
    i
}

/// `<script[^>]*?>.*?</script>`（忽略大小写 + DOTALL）。
fn find_script_block(hay: &str, from: usize) -> Option<(usize, usize)> {
    const CLOSE: &str = "</script>";
    let mut search = from;
    loop {
        let start = find_ci(hay, "<script", search)?;
        // `[^>]*?>`：必须存在 '>'（可以跨越 '<'，但不能跨越 '>'）
        let Some(gt) = hay[start..].find('>').map(|i| start + i) else {
            return None;
        };
        match find_ci(hay, CLOSE, gt + 1) {
            Some(close) => return Some((start, close + CLOSE.len())),
            // 没有闭合标签 ⇒ 本次出现不算匹配，继续找下一个 `<script`
            None => search = start + 1,
        }
    }
}

/// `word\s*:`。
fn find_keyword_colon(hay: &str, word: &str, from: usize) -> Option<(usize, usize)> {
    let mut search = from;
    while let Some(start) = find_ci(hay, word, search) {
        let after = skip_spaces(hay, start + word.len());
        if hay.as_bytes().get(after) == Some(&b':') {
            return Some((start, after + 1));
        }
        search = start + 1;
    }
    None
}

/// `name\s*\(`。
fn find_call(hay: &str, name: &str, from: usize) -> Option<(usize, usize)> {
    let mut search = from;
    while let Some(start) = find_ci(hay, name, search) {
        let after = skip_spaces(hay, start + name.len());
        if hay.as_bytes().get(after) == Some(&b'(') {
            return Some((start, after + 1));
        }
        search = start + 1;
    }
    None
}

/// `on\w+\s*=`（`\w+` 至少一个字符）。
fn find_event_handler(hay: &str, from: usize) -> Option<(usize, usize)> {
    let hb = hay.as_bytes();
    let mut search = from;
    while let Some(start) = find_ci(hay, "on", search) {
        let mut i = start + 2;
        let word_start = i;
        while i < hb.len() && is_word_byte(hb[i]) {
            i += 1;
        }
        if i == word_start {
            search = start + 1;
            continue;
        }
        let after = skip_spaces(hay, i);
        if hb.get(after) == Some(&b'=') {
            return Some((start, after + 1));
        }
        search = start + 1;
    }
    None
}

/// `sortItems` 反序列化：JSON 数组或 JSON 字符串。
mod de {
    use super::SortItem;
    use serde::{de, Deserialize, Deserializer};

    /// `sortItems` 的两种形态。
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum SortItemsLike {
        /// JSON 数组
        Arr(Vec<SortItem>),
        /// JSON 字符串（`"[{\"field\":\"id\"}]"`）
        Str(String),
    }

    /// `sortItems` 字段反序列化（缺失 / null / 空串 → `None`）。
    pub fn opt_sort_items<'de, D: Deserializer<'de>>(
        d: D,
    ) -> Result<Option<Vec<SortItem>>, D::Error> {
        match Option::<SortItemsLike>::deserialize(d)? {
            None => Ok(None),
            Some(SortItemsLike::Arr(v)) => Ok(Some(v)),
            Some(SortItemsLike::Str(s)) => {
                let t = s.trim();
                if t.is_empty() {
                    return Ok(None);
                }
                serde_json::from_str::<Vec<SortItem>>(t)
                    .map(Some)
                    .map_err(de::Error::custom)
            }
        }
    }

    /// `excludeReply` 反序列化：`true/false/1/0/yes/no/on/off` 或空串（→ `None`）。
    ///
    /// Java（Spring `StringToBooleanConverter`）接受 `true/false/on/off/yes/no/1/0`，
    /// 这里保持同一宽容度，避免 `?excludeReply=1` 被 serde_urlencoded 直接判 400。
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum BoolLike {
        /// `true` / `false`
        Bool(bool),
        /// `1` / `0`
        Int(i64),
        /// 文本
        Str(String),
    }

    /// `Option<bool>` 字段反序列化。
    pub fn opt_bool<'de, D: Deserializer<'de>>(d: D) -> Result<Option<bool>, D::Error> {
        match Option::<BoolLike>::deserialize(d)? {
            None => Ok(None),
            Some(BoolLike::Bool(v)) => Ok(Some(v)),
            Some(BoolLike::Int(v)) => Ok(Some(v != 0)),
            Some(BoolLike::Str(s)) => match s.trim().to_ascii_lowercase().as_str() {
                "" => Ok(None),
                "1" | "true" | "yes" | "on" => Ok(Some(true)),
                "0" | "false" | "no" | "off" => Ok(Some(false)),
                other => Err(de::Error::custom(format!("非法布尔值: {other}"))),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn q(json: serde_json::Value) -> FeedbackListQuery {
        serde_json::from_value(json).expect("应能反序列化")
    }

    fn feedback(id: i32, r#type: i32) -> Feedback {
        Feedback {
            id,
            parent_id: 0,
            user_id: 9,
            username: "buyer".into(),
            email: None,
            mobile: None,
            title: "标题".into(),
            r#type,
            status: feedback_status::WAIT_REPLY,
            content: "内容".into(),
            add_time: 1_700_000_000,
            feedback_pics: None,
            product_id: Some(0),
            order_id: Some(0),
            complaint_info: None,
            shop_id: Some(0),
        }
    }

    // ————————————— 枚举文案 —————————————

    #[test]
    fn type_and_status_names_match_java_enums() {
        assert_eq!(feedback_type::name(0), Some("建议"));
        assert_eq!(feedback_type::name(1), Some("投诉"));
        assert_eq!(feedback_type::name(2), Some("商品"));
        assert_eq!(feedback_type::name(3), Some("其他"));
        assert_eq!(feedback_type::name(4), Some("店铺投诉"));
        assert_eq!(feedback_type::name(5), Some("订单问题"));
        assert_eq!(feedback_type::name(6), Some("订单咨询"));
        // Java 对未知码抛 GlobalException(DATA_TYPE_ERROR, 1001)
        assert_eq!(feedback_type::name(7), None);

        assert_eq!(feedback_status::name(0), Some("待回复"));
        assert_eq!(feedback_status::name(1), Some("已回复"));
        assert_eq!(feedback_status::name(2), Some("无效"));
        assert_eq!(feedback_status::name(3), None);
    }

    #[test]
    fn shop_feedback_types_only_contains_product() {
        assert_eq!(SHOP_FEEDBACK_TYPES, [2]);
        assert!(is_shop_feedback_type(2));
        for t in [0, 1, 3, 4, 5, 6, 7] {
            assert!(!is_shop_feedback_type(t), "{t}");
        }
    }

    // ————————————— 租户作用域 —————————————

    #[test]
    fn tenant_scope_admin_is_platform() {
        assert_eq!(
            TenantScope::resolve(Some("admin"), None, None),
            Ok(TenantScope::Platform)
        );
        // 平台账号不看 shop_id（Java 传的是常量 0）
        assert_eq!(
            TenantScope::resolve(Some("admin"), None, Some(5)),
            Ok(TenantScope::Platform)
        );
    }

    #[test]
    fn tenant_scope_shop_and_store_require_shop_id() {
        assert_eq!(
            TenantScope::resolve(Some("shop"), None, Some(7)),
            Ok(TenantScope::Shop { shop_id: 7 })
        );
        // x-shop-type = 2 → Java 细化为 store，同样属于店铺族
        assert_eq!(
            TenantScope::resolve(Some("shop"), Some(2), Some(7)),
            Ok(TenantScope::Shop { shop_id: 7 })
        );
        // 直接以 store 作为 x-admin-type（JWT typ）
        assert_eq!(
            TenantScope::resolve(Some("store"), None, Some(7)),
            Ok(TenantScope::Shop { shop_id: 7 })
        );
        // 缺 shop-id / 非正数 → "缺少当前店铺信息"
        assert_eq!(
            TenantScope::resolve(Some("shop"), None, None),
            Err(MSG_MISSING_SHOP.to_string())
        );
        assert_eq!(
            TenantScope::resolve(Some("shop"), None, Some(0)),
            Err(MSG_MISSING_SHOP.to_string())
        );
        assert_eq!(
            TenantScope::resolve(Some("store"), None, Some(-3)),
            Err(MSG_MISSING_SHOP.to_string())
        );
    }

    #[test]
    fn tenant_scope_missing_or_other_types_are_rejected() {
        assert_eq!(
            TenantScope::resolve(None, None, Some(1)),
            Err(MSG_MISSING_TENANT.to_string())
        );
        for t in ["vendor", "pos", "pickup", "Admin", "Shop", ""] {
            assert_eq!(
                TenantScope::resolve(Some(t), None, Some(1)),
                Err(MSG_NO_ACCESS_FEEDBACK.to_string()),
                "{t}"
            );
        }
        // x-shop-type = 3 → 自提点，Java 判为无权
        assert_eq!(
            TenantScope::resolve(Some("shop"), Some(3), Some(1)),
            Err(MSG_NO_ACCESS_FEEDBACK.to_string())
        );
    }

    // ————————————— 类型筛选 —————————————

    #[test]
    fn shop_types_default_to_product_only() {
        assert_eq!(resolve_shop_feedback_types(None), vec![2]);
        assert_eq!(resolve_shop_feedback_types(Some("")), vec![2]);
        assert_eq!(resolve_shop_feedback_types(Some("   ")), vec![2]);
        // 请求里带 2 → 仍是 [2]（去重）
        assert_eq!(resolve_shop_feedback_types(Some("2")), vec![2]);
        assert_eq!(resolve_shop_feedback_types(Some("2,2,2")), vec![2]);
        // 带其它类型 → 被过滤掉（Java 里配合 1 = 0 得到空页）
        assert_eq!(resolve_shop_feedback_types(Some("0,1")), Vec::<i32>::new());
        assert_eq!(resolve_shop_feedback_types(Some(" 2 , 0 ")), vec![2]);
        assert_eq!(resolve_shop_feedback_types(Some("abc")), Vec::<i32>::new());
    }

    #[test]
    fn platform_types_follow_hutool_split() {
        assert_eq!(resolve_platform_feedback_types(None), Vec::<i32>::new());
        assert_eq!(resolve_platform_feedback_types(Some("")), Vec::<i32>::new());
        assert_eq!(resolve_platform_feedback_types(Some("0,2")), vec![0, 2]);
        // 连续分隔符产生空串 ⇒ MySQL 比较时转成 0
        assert_eq!(resolve_platform_feedback_types(Some("1,,2")), vec![1, 0, 2]);
        // 不可解析的串 ⇒ 0（与 MySQL 比较语义一致）
        assert_eq!(resolve_platform_feedback_types(Some("abc")), vec![0]);
        // 纯空白：hutool isEmpty(" ") == false ⇒ [" "]，trim 后仍不可解析 ⇒ 0
        assert_eq!(resolve_platform_feedback_types(Some(" ")), vec![0]);
        // 带空格的数字
        assert_eq!(resolve_platform_feedback_types(Some(" 3 , 4 ")), vec![3, 4]);
    }

    // ————————————— 排序 —————————————

    #[test]
    fn order_clause_defaults_to_primary_key_desc() {
        let c = list_order_clause(&q(serde_json::json!({})));
        assert_eq!(c, " ORDER BY id DESC");
        // sortField = 主键属性名 → 主键列
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "id", "sortOrder": "asc"}),
        ));
        assert_eq!(c, " ORDER BY id ASC");
        // 属性名 / 列名都要命中
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "addTime", "sortOrder": "asc"}),
        ));
        assert_eq!(c, " ORDER BY add_time ASC");
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "add_time", "sortOrder": "desc"}),
        ));
        assert_eq!(c, " ORDER BY add_time DESC");
        // 未命中 → 主键列（防注入）
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "1; DROP TABLE feedback", "sortOrder": "asc"}),
        ));
        assert_eq!(c, " ORDER BY id ASC");
        // 不做 trim：`" rate "` 未命中 → 主键列
        let c = list_order_clause(&q(serde_json::json!({"sortField": " type "})));
        assert_eq!(c, " ORDER BY id DESC");
    }

    #[test]
    fn order_clause_direction_edge_cases() {
        // 空串 sortOrder → 降序（Java isEmpty 分支）
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "status", "sortOrder": ""}),
        ));
        assert_eq!(c, " ORDER BY status DESC");
        // 非法值 → 完全不追加 ORDER BY（Java 的 else-if 缺口）
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "status", "sortOrder": "weird"}),
        ));
        assert_eq!(c, "");
        // 不做 trim：`" asc"` 也不等于 asc
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "status", "sortOrder": " asc"}),
        ));
        assert_eq!(c, "");
        // 大小写不敏感
        let c = list_order_clause(&q(
            serde_json::json!({"sortField": "status", "sortOrder": "ASC"}),
        ));
        assert_eq!(c, " ORDER BY status ASC");
    }

    #[test]
    fn sort_items_take_precedence_over_single_field() {
        let c = list_order_clause(&q(serde_json::json!({
            "sortField": "status",
            "sortOrder": "asc",
            "sortItems": [{"field": "addTime", "order": "asc"}, {"field": "id", "order": "desc"}]
        })));
        assert_eq!(c, " ORDER BY add_time ASC, id DESC");

        // 非 asc 一律 desc
        let c = list_order_clause(&q(serde_json::json!({
            "sortItems": [{"field": "status", "order": "whatever"}]
        })));
        assert_eq!(c, " ORDER BY status DESC");

        // 空 field 被跳过；全部跳过 ⇒ 完全没有 ORDER BY
        let c = list_order_clause(&q(serde_json::json!({
            "sortItems": [{"field": "", "order": "asc"}, {"order": "asc"}]
        })));
        assert_eq!(c, "");

        // 空数组 ⇒ 回退到 sortField 分支
        let c = list_order_clause(&q(serde_json::json!({"sortItems": [], "sortField": "id"})));
        assert_eq!(c, " ORDER BY id DESC");

        // JSON 字符串形态也要能解析
        let c = list_order_clause(&q(serde_json::json!({
            "sortItems": "[{\"field\":\"id\",\"order\":\"asc\"}]"
        })));
        assert_eq!(c, " ORDER BY id ASC");
    }

    // ————————————— 分页 / 文本 —————————————

    #[test]
    fn page_defaults_match_java_base_page() {
        let p = q(serde_json::json!({})).page_query();
        assert_eq!((p.page, p.page_size), (1, 15));
        let p = q(serde_json::json!({"page": 3, "size": 20})).page_query();
        assert_eq!((p.page, p.page_size), (3, 20));
        let p = q(serde_json::json!({"size": 101})).page_query();
        assert_eq!(p.page_size, 100);
        // Rust 侧兜住下界（Java 会生成 LIMIT 0）
        let p = q(serde_json::json!({"page": 0, "size": 0})).page_query();
        assert_eq!((p.page, p.page_size), (1, 1));
    }

    #[test]
    fn query_fields_bind_camel_case() {
        let v = q(serde_json::json!({
            "type": "0,2",
            "isOrder": 1,
            "productId": 5,
            "status": 1,
            "userId": 9,
            "shopId": 3,
            "keyword": " 你好 ",
            "excludeReply": 1
        }));
        assert_eq!(v.r#type.as_deref(), Some("0,2"));
        assert_eq!(v.is_order, Some(1));
        assert_eq!(v.product_id, Some(5));
        assert_eq!(v.status, Some(1));
        assert_eq!(v.user_id, Some(9));
        assert_eq!(v.shop_id, Some(3));
        assert_eq!(v.effective_keyword(), Some("你好"));
        assert_eq!(v.exclude_reply, Some(true));

        let v = q(serde_json::json!({"excludeReply": "off"}));
        assert_eq!(v.exclude_reply, Some(false));
        let v = q(serde_json::json!({}));
        assert_eq!(v.exclude_reply, None);
        assert_eq!(v.effective_keyword(), None);
    }

    #[test]
    fn blank_helpers_match_hutool() {
        assert!(is_blank(None));
        assert!(is_blank(Some("")));
        assert!(is_blank(Some("  ")));
        assert!(!is_blank(Some("x")));
        assert_eq!(non_blank(Some("  x ")), Some("x"));
        assert_eq!(non_blank(Some("   ")), None);
        assert_eq!(blank_to_default(None, ""), "");
        assert_eq!(blank_to_default(Some("  "), ""), "");
        assert_eq!(blank_to_default(Some(" a "), ""), " a ");
    }

    // ————————————— 时间 / 图片 JSON —————————————

    #[test]
    fn add_time_formats_like_handel_time() {
        assert_eq!(format_add_time(None), "");
        assert_eq!(format_add_time(Some(0)), "");
        // 1700000000 = 2023-11-14 22:13:20 UTC → +8h
        assert_eq!(format_add_time(Some(1_700_000_000)), "2023-11-15 06:13:20");
        assert_eq!(format_add_time(Some(1)), "1970-01-01 08:00:01");
    }

    #[test]
    fn feedback_pics_roundtrip_and_failure_modes() {
        assert_eq!(to_feedback_pics(None), "[]");
        assert_eq!(to_feedback_pics(Some(&[])), "[]");
        let pics = vec!["a.jpg".to_string(), "b.jpg".to_string()];
        assert_eq!(to_feedback_pics(Some(&pics)), r#"["a.jpg","b.jpg"]"#);

        assert_eq!(
            parse_feedback_pics(Some(r#"["a"]"#)),
            Some(vec!["a".to_string()])
        );
        assert_eq!(parse_feedback_pics(Some("[]")), Some(Vec::new()));
        // 非法 JSON / 空 / 纯空白 → None（Java JsonUtil 返回 null）
        assert_eq!(parse_feedback_pics(Some("not json")), None);
        assert_eq!(parse_feedback_pics(Some("")), None);
        assert_eq!(parse_feedback_pics(Some("   ")), None);
        assert_eq!(parse_feedback_pics(None), None);
        // 元素不是字符串 → 解析失败
        assert_eq!(parse_feedback_pics(Some("[1,2]")), None);
    }

    // ————————————— XSS 清洗 —————————————

    #[test]
    fn xss_clean_removes_script_blocks() {
        assert_eq!(xss_clean("<script>alert(1)</script>hello"), "hello");
        assert_eq!(xss_clean("<SCRIPT src=x>bad</SCRIPT>ok"), "ok");
        assert_eq!(
            xss_clean("a<script type=\"text/javascript\">x</script>b"),
            "ab"
        );
        // 没有闭合标签 ⇒ 不删除 script 块（Java 正则要求 `</script>`），
        // 但 `alert(` 仍会被后续的 ALERT_PATTERN 删掉
        assert_eq!(xss_clean("<script>alert(1)"), "<script>1)");
        // 大小写混合
        assert_eq!(xss_clean("<ScRiPt>1</sCrIpT>"), "");
    }

    #[test]
    fn xss_clean_removes_protocols_handlers_and_calls() {
        assert_eq!(xss_clean("javascript:alert(1)"), "1)");
        assert_eq!(xss_clean("java script:"), "java script:");
        assert_eq!(xss_clean("JavaScript :x"), "x");
        assert_eq!(xss_clean("vbscript:x"), "x");
        assert_eq!(xss_clean("onclick=alert(1)"), "1)");
        // `on` 与 `=` 之间必须是 `\w+`（"on mouseover" 中间是空格 ⇒ 不匹配）
        assert_eq!(xss_clean("on mouseover = x"), "on mouseover = x");
        assert_eq!(xss_clean("eval(1)"), "1)");
        assert_eq!(xss_clean("expression(1)"), "1)");
        assert_eq!(xss_clean("confirm(1)"), "1)");
        assert_eq!(xss_clean("prompt(1)"), "1)");
        // `data:` 在 Java 的 clean 里**没有**被移除（DATA_PATTERN 未被使用）
        assert_eq!(xss_clean("data:text/html"), "data:text/html");
        // 普通文本不受影响（`on` 后面必须紧跟 \w+ 和 =）
        assert_eq!(xss_clean("season = 5"), "season = 5");
        assert_eq!(xss_clean("你好，世界"), "你好，世界");
        // 空白输入原样返回
        assert_eq!(xss_clean("   "), "   ");
        assert_eq!(xss_clean(""), "");
    }

    // ————————————— VO 组装 —————————————

    #[test]
    fn build_list_vo_maps_entity_and_lookups() {
        let mut f = feedback(1, feedback_type::PRODUCT);
        f.product_id = Some(5);
        f.order_id = Some(8);
        f.shop_id = Some(3);

        let lookups = FeedbackLookups {
            users: HashMap::from([(9, Some("昵称".to_string()))]),
            orders: HashMap::from([(8, "SN123".to_string())]),
            products: HashMap::from([(5, "商品A".to_string())]),
            shops: HashMap::from([(3, Some("店铺A".to_string()))]),
        };
        let mut reply = feedback(2, feedback_type::PRODUCT);
        reply.parent_id = 1;
        reply.username = "admin".into();
        reply.content = "回复".into();
        reply.add_time = 1_700_000_100;
        let replies = HashMap::from([(1, reply)]);

        let vo = build_list_vo(&f, &replies, &lookups).expect("应能组装");
        assert_eq!(vo.type_name, "商品");
        assert_eq!(vo.id, 1);
        assert_eq!(vo.add_time, "2023-11-15 06:13:20");
        assert_eq!(vo.nickname.as_deref(), Some("昵称"));
        assert_eq!(vo.order_sn.as_deref(), Some("SN123"));
        assert_eq!(
            vo.product.as_ref().map(|p| p.product_name.as_str()),
            Some("商品A")
        );
        assert_eq!(
            vo.shop.as_ref().and_then(|s| s.shop_title.as_deref()),
            Some("店铺A")
        );
        let r = vo.reply.expect("应有回复");
        assert_eq!(r.username, "admin");
        assert_eq!(r.add_time, "2023-11-15 06:15:00");
        assert_eq!(r.parent_id, 1);
    }

    #[test]
    fn build_list_vo_rejects_unknown_type() {
        let f = feedback(1, 99);
        let err = build_list_vo(&f, &HashMap::new(), &FeedbackLookups::default())
            .expect_err("未知类型应报错");
        assert_eq!(err.business_code(), SERVICE_DATA_ERROR);
        assert!(err.to_string().contains(MSG_DATA_TYPE_ERROR));
    }

    #[test]
    fn build_detail_vo_null_semantics() {
        let mut f = feedback(7, feedback_type::SUGGESTION);
        f.feedback_pics = Some(r#"["p1.jpg"]"#.to_string());
        // 无关联数据、无回复
        let vo = build_detail_vo(&f, None, None, None, None, &[]).expect("应能组装");
        assert_eq!(vo.type_name, "建议");
        assert_eq!(vo.status_name, "待回复");
        assert!(vo.nickname.is_none());
        assert!(vo.order_info.is_none());
        assert!(vo.order_sn.is_none());
        assert!(vo.product.is_none());
        assert!(vo.shop.is_none());
        assert!(vo.reply_list.is_none());
        assert_eq!(vo.feedback_pics, Some(vec!["p1.jpg".to_string()]));

        // 有关联数据 / 回复
        let mut reply = feedback(8, feedback_type::SUGGESTION);
        reply.parent_id = 7;
        reply.email = Some("a@b.c".into());
        let vo = build_detail_vo(
            &f,
            Some("昵称".into()),
            Some((3, "SN".into())),
            Some((4, "商品".into())),
            Some((5, Some("店铺".into()))),
            std::slice::from_ref(&reply),
        )
        .expect("应能组装");
        assert_eq!(vo.order_sn.as_deref(), Some("SN"));
        assert_eq!(vo.order_info.as_ref().map(|o| o.order_id), Some(3));
        assert_eq!(vo.product.as_ref().map(|p| p.product_id), Some(4));
        assert_eq!(vo.shop.as_ref().map(|s| s.shop_id), Some(5));
        let list = vo.reply_list.expect("应有回复列表");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].email.as_deref(), Some("a@b.c"));
    }

    #[test]
    fn build_detail_vo_keeps_pics_null_for_short_json() {
        let mut f = feedback(7, feedback_type::SUGGESTION);
        // Java：`length() > 3` 才解析，"[]"（长度 2）保持 null
        f.feedback_pics = Some("[]".to_string());
        let vo = build_detail_vo(&f, None, None, None, None, &[]).expect("应能组装");
        assert!(vo.feedback_pics.is_none());
    }

    #[test]
    fn vo_serializes_camel_case() {
        let f = feedback(1, feedback_type::PRODUCT);
        let vo = build_list_vo(&f, &HashMap::new(), &FeedbackLookups::default()).expect("应能组装");
        let v = serde_json::to_value(&vo).expect("应能序列化");
        assert_eq!(v["typeName"], "商品");
        assert_eq!(v["addTime"], "2023-11-15 06:13:20");
        assert_eq!(v["userId"], 9);
        assert_eq!(v["type"], 2);
        assert_eq!(v["shopId"], 0);
        assert!(v.get("type_name").is_none());
        assert!(v["reply"].is_null());
    }

    #[test]
    fn column_constants_match_schema() {
        assert_eq!(KEY_COLUMN, "id");
        assert_eq!(KEY_PROPERTY, "id");
        assert_eq!(FEEDBACK_COLUMNS.len(), 16);
        assert_eq!(FEEDBACK_COLUMNS[0], "id");
        assert_eq!(FEEDBACK_COLUMNS[15], "shop_id");
        assert_eq!(map_order_column("nope"), KEY_COLUMN);
    }
}
