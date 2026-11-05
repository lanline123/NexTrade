//! 会员标签组管理域（member::member_tag_group）DTO / VO / 校验 / 纯逻辑。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.user.MemberTagGroupController`
//!   （`@RequestMapping("/adminapi/user/memberTagGroup")`，
//!   类级 `@PreAuthorize("@pms.hasPermission('memberTagManage')")`）
//! - `com.tigshop.service.user.impl.MemberTagGroupServiceImpl`（318 行）
//! - `com.tigshop.bean.model.user.MemberTagGroup`（表 `member_tag_group`，
//!   实体已由 `tigshop_core::entities::MemberTagGroup` 自动生成，本文件不重复定义）
//! - `com.tigshop.bean.model.user.MemberTag`（表 `member_tag`）
//! - `com.tigshop.bean.model.user.UserMemberTag`（表 `user_member_tag`）
//! - `com.tigshop.bean.param.user.MemberTagGroupCreateParam`
//! - `com.tigshop.bean.param.user.MemberTagGroupUpdateParam`
//! - `com.tigshop.bean.param.user.MemberTagItemParam`
//! - `com.tigshop.bean.vo.user.MemberTagGroupDetailVO` / `MemberTagVO`
//! - `com.tigshop.bean.dto.common.OperateDTO`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! # 本切片的路由范围（重要）
//!
//! 本域在 `docs/slices.json` 里声明的 6 条接口是
//! `detail` / `create` / `update` / `del` / `setTop` / `cancelTop`。
//! **`GET /adminapi/user/memberTagGroup/list` 不在本切片**：它已经由
//! `crates/api/admin/src/routes/member.rs` 注册（早期域占位实现）。
//! 因此本文件**不**定义列表相关的 Query / ListVO，避免与占位实现重复
//! （重复注册同一 `(method, path)` 会让 axum 启动时 panic）。
//!
//! # 金额
//!
//! 本域**完全不涉及金额**，因此没有 `rust_decimal::Decimal` 出场。
//!
//! # 多租户（shopId）
//!
//! Java 的 `currentShopId()` 读**请求头** `HeaderUtils.getShopId()`：
//! `admin` → `0`；`shop` / `pos` → `x-shop-id`；其它/缺失 → `null` → 服务层
//! 归一为 `0`（平台）。它**不是**请求体/查询参数，前端无法通过 JSON 覆盖。
//! Rust 侧 JWT 尚未签发 `shop_id`，故由路由层按同一规则解析请求头后
//! 作为**显式入参**传给服务层（与 product_stock / stock_warning / aftersales 一致）。
//!
//! # 软删除（`@TableLogic`）
//!
//! `MemberTagGroup` / `MemberTag` 都继承 `BasePO`，其 `isDel` 带
//! `@TableLogic`（`logic-delete-value: 1` / `logic-not-delete-value: 0`），
//! 因此所有读写都显式带 `is_del = 0`，删除是 `SET is_del = 1`。
//!
//! ⚠️ `user_member_tag` **不在** `BasePO` 继承体系里（无 `is_del` 列，
//! 见 [`USER_MEMBER_TAG_COLUMNS`]），清理用户关联是**物理删除**。

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::entities::MemberTag;

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java / schema）
// ——————————————————————————————————————————————

/// 平台店铺 ID（Java `currentShopId()` 在 `HeaderUtils.getShopId() == null`
/// 时的归一值 `0`）。
pub const DEFAULT_SHOP_ID: i32 = 0;

/// `@TableLogic` 的「未删除」取值（`logic-not-delete-value: 0`）。
pub const IS_DEL_NO: i32 = 0;

/// `@TableLogic` 的「已删除」取值（`logic-delete-value: 1`）。
pub const IS_DEL_YES: i32 = 1;

/// 标签组最少标签数
/// （`MemberTagGroupCreateParam.tagNames` 的 `@Size(min = 2)`、
/// `MemberTagGroupUpdateParam.tags` 的 `@Size(min = 2)`）。
pub const MIN_TAG_COUNT: usize = 2;

/// `tagValues` 的连接符
/// （Java `Collectors.joining("，")`，**全角**逗号，不是 ASCII 逗号）。
pub const TAG_VALUES_SEPARATOR: &str = "，";

/// 自动填充 `createByName` / `updateByName` 的兜底文案
/// （Java `MybatisPlusMetaObjectHandler`：
/// `StrUtil.isNotBlank(username) ? username : "unknown"`）。
pub const OPERATOR_NAME_FALLBACK: &str = "unknown";

/// `member_tag_group` 的真实列清单
/// （`python tools/schema_parser.py --table member_tag_group`，共 11 列）。
pub const MEMBER_TAG_GROUP_COLUMNS: [&str; 11] = [
    "id",
    "shop_id",
    "group_name",
    "is_top",
    "create_time",
    "create_by_id",
    "create_by_name",
    "update_time",
    "update_by_id",
    "update_by_name",
    "is_del",
];

/// `member_tag` 的真实列清单
/// （`python tools/schema_parser.py --table member_tag`，共 11 列）。
pub const MEMBER_TAG_COLUMNS: [&str; 11] = [
    "id",
    "shop_id",
    "group_id",
    "tag_name",
    "create_time",
    "create_by_id",
    "create_by_name",
    "update_time",
    "update_by_id",
    "update_by_name",
    "is_del",
];

/// `user_member_tag` 的真实列清单
/// （`python tools/schema_parser.py --table user_member_tag`，共 5 列，
/// **没有** `is_del`）。
pub const USER_MEMBER_TAG_COLUMNS: [&str; 5] =
    ["id", "shop_id", "user_id", "tag_id", "create_time"];

// ————————————————————— Java 常量文案（逐字符照抄） —————————————————————

/// Java `MemberTagGroupCreateParam.groupName` /
/// `MemberTagGroupUpdateParam.groupName` 上的
/// `@NotBlank(message = "组名称不能为空")`。
pub const MSG_GROUP_NAME_REQUIRED: &str = "组名称不能为空";

/// Java `MemberTagGroupCreateParam.tagNames` 上的
/// `@NotNull(message = "标签值不能为空")`。
pub const MSG_TAG_NAMES_REQUIRED: &str = "标签值不能为空";

/// Java `MemberTagGroupCreateParam.tagNames` 上的
/// `@Size(min = 2, message = "至少填写两个标签值")`。
pub const MSG_TAG_NAMES_MIN: &str = "至少填写两个标签值";

/// Java `MemberTagGroupUpdateParam.id` 上的
/// `@NotNull(message = "标签组ID不能为空")`。
pub const MSG_GROUP_ID_REQUIRED: &str = "标签组ID不能为空";

/// Java `MemberTagGroupUpdateParam.tags` 上的
/// `@NotNull(message = "标签不能为空")`。
pub const MSG_TAGS_REQUIRED: &str = "标签不能为空";

/// Java `MemberTagGroupUpdateParam.tags` 上的
/// `@Size(min = 2, message = "至少保留两个标签")`。
pub const MSG_TAGS_MIN: &str = "至少保留两个标签";

/// Java `MemberTagItemParam.tagName` 上的
/// `@NotBlank(message = "标签名称不能为空")`
/// （`MemberTagGroupUpdateParam.tags` 带 `@Valid`，因此元素级校验生效）。
pub const MSG_TAG_NAME_REQUIRED: &str = "标签名称不能为空";

/// Java `OperateDTO.id` 上的 `@NotNull(message = ID_CANNOT_IS_NULL)`，
/// 其中 `ResultTextConstants.ID_CANNOT_IS_NULL = "id不能为空"`。
///
/// ⚠️ `del` / `setTop` / `cancelTop` 三个接口收的都是 `OperateDTO`
/// （方法参数上**没有** `@Valid`），Java 侧 `id` 为 null 时会在
/// `operateDTO.getId().longValue()` 处抛 NPE（HTTP 500）。
/// 本实现按项目统一口径要求 `id` 必填并返回 400（见 `uncertain_points`）。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `MemberTagGroupServiceImpl` 四处抛出的
/// `new GlobalException("标签组不存在")`
/// （`detail` / `update` / `delGroup` / `setTop` / `cancelTop` 共用同一条文案，
/// **不区分**「不存在」与「不属于当前店铺」）。
pub const MSG_GROUP_NOT_FOUND: &str = "标签组不存在";

// ——————————————————————————————————————————————
// 时间格式化
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（东八区）。
///
/// 对应 Java `MemberTagGroupDetailVO.createTime` / `MemberTagVO.createTime`
/// 上的 `@JsonSerialize(using = TimestampToDateSerializer.class)`：
/// - `value == null` → 输出空串 `""`
/// - `timestamp > 0` → `Asia/Shanghai` 时区格式化
/// - 否则（`<= 0`）→ 输出空串 `""`
///
/// Java 字段类型是 `String`（不是 `Long`），因此**永远不会**是 JSON `null`
/// —— 无值时是 `""`。本函数据此返回 `String`（非 `Option<String>`）。
///
/// 时区硬编码 `+08:00`（东八区无夏令时，与 `Asia/Shanghai` 在全部历史时刻
/// 等价），不依赖运行机器 `TZ`。
#[must_use]
pub fn format_create_time(secs: Option<i64>) -> String {
    use chrono::TimeZone as _;
    let Some(secs) = secs else {
        // Java: `value == null` → `gen.writeString("")`
        return String::new();
    };
    if secs <= 0 {
        // Java: `timestamp > 0` 之外的分支 → `gen.writeString("")`
        return String::new();
    }
    match chrono::FixedOffset::east_opt(8 * 3600).and_then(|tz| tz.timestamp_opt(secs, 0).single())
    {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        // Java 的 catch 分支「解析失败原样输出」；对合法 i64 秒数不可达。
        None => secs.to_string(),
    }
}

// ——————————————————————————————————————————————
// 操作人（替代 Java `SecurityUtils` + `MybatisPlusMetaObjectHandler`）
// ——————————————————————————————————————————————

/// 写入 `create_by_*` / `update_by_*` 的操作人。
///
/// Java `MybatisPlusMetaObjectHandler` 的填充规则：
/// ```text
/// createById   = SecurityUtils.getCurrentAdminId()          // Long
/// createByName = isNotBlank(getCurrentUsername()) ? username : "unknown"
/// ```
/// Rust 侧操作人来自 `AuthUser`（JWT），由路由层构造本结构体。
///
/// ⚠️ `name` 为 `None` 只表示「调用方没给」，**不**等价于 Java 的
/// `"unknown"`；请用 [`AdminOperator::new`] / [`AdminOperator::from_auth`]
/// 构造（它们已按 Java 规则把空/空白归一为 [`OPERATOR_NAME_FALLBACK`]）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AdminOperator {
    /// 管理员主键（Java `SecurityUtils.getCurrentAdminId()`）
    pub id: Option<i64>,
    /// 管理员名称（Java 空/空白 → `"unknown"`）
    pub name: Option<String>,
}

impl AdminOperator {
    /// 按 Java 规则构造：名称空白/缺失 → `"unknown"`。
    #[must_use]
    pub fn new(id: Option<i64>, username: Option<&str>) -> Self {
        let name = match username.map(str::trim).filter(|s| !s.is_empty()) {
            Some(n) => n.to_string(),
            None => OPERATOR_NAME_FALLBACK.to_string(),
        };
        Self {
            id,
            name: Some(name),
        }
    }

    /// 由 JWT 身份构造（`AuthUser.id` 是 `i32`，Java 侧是 `Long`）。
    #[must_use]
    pub fn from_auth(id: i64, username: Option<&str>) -> Self {
        Self::new(Some(id), username)
    }

    /// 名称（供绑定 SQL 参数）。
    #[must_use]
    pub fn name_ref(&self) -> Option<&str> {
        self.name.as_deref()
    }
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 会员标签 VO（对应 Java `com.tigshop.bean.vo.user.MemberTagVO`）。
///
/// 四个字段与 Java 一一对应，**没有** `shopId` / `isDel` 等内部列。
/// `createTime` 在 Java 里是 `String` 且带自定义序列化器 ⇒ 无值时是 `""`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagVO {
    /// 标签ID
    pub id: i64,
    /// 所属标签组ID
    pub group_id: i64,
    /// 标签名称
    pub tag_name: String,
    /// 创建时间（`yyyy-MM-dd HH:mm:ss`，无值时 `""`）
    pub create_time: String,
}

impl From<&MemberTag> for MemberTagVO {
    fn from(t: &MemberTag) -> Self {
        Self {
            id: t.id,
            group_id: t.group_id,
            tag_name: t.tag_name.clone(),
            create_time: format_create_time(t.create_time),
        }
    }
}

/// 会员标签组详情 VO
/// （对应 Java `com.tigshop.bean.vo.user.MemberTagGroupDetailVO`）。
///
/// 四个字段：`id` / `groupName` / `createTime` / `tags`。
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagGroupDetailVO {
    /// 标签组ID
    pub id: i64,
    /// 组名称
    pub group_name: String,
    /// 创建时间（`yyyy-MM-dd HH:mm:ss`，无值时 `""`）
    pub create_time: String,
    /// 组下标签列表
    pub tags: Vec<MemberTagVO>,
}

impl MemberTagGroupDetailVO {
    /// 由实体 + 标签列表组装（对应 Java `detail` 的逐字段 `set`）。
    #[must_use]
    pub fn from_parts(
        id: i64,
        group_name: &str,
        create_time: Option<i64>,
        tags: Vec<MemberTagVO>,
    ) -> Self {
        Self {
            id,
            group_name: group_name.to_string(),
            create_time: format_create_time(create_time),
            tags,
        }
    }
}

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 新增标签组请求（Java `MemberTagGroupCreateParam`）。
///
/// Java 校验注解：
/// - `groupName`：`@NotBlank(message = "组名称不能为空")`
/// - `tagNames`：`@NotNull(message = "标签值不能为空")`
///   + `@Size(min = 2, message = "至少填写两个标签值")`
///
/// ⚠️ `tagNames` 的**元素**没有 `@NotBlank`（Java 声明是 `List<String>`，
/// 未加元素级约束），因此空串元素会被原样 trim 后入库。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagGroupCreateDTO {
    /// 组名称（必填、非空白；入库时**不 trim**，与 Java 一致）
    pub group_name: Option<String>,
    /// 标签值列表（必填，至少 2 个；入库前逐个 trim）
    pub tag_names: Option<Vec<String>>,
}

/// 标签条目（Java `com.tigshop.bean.param.user.MemberTagItemParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagItemDTO {
    /// 标签ID（已有标签传 ID，新标签不传）
    pub id: Option<i64>,
    /// 标签名称（`@NotBlank(message = "标签名称不能为空")`）
    pub tag_name: Option<String>,
}

/// 更新标签组请求（Java `MemberTagGroupUpdateParam`）。
///
/// Java 校验注解：
/// - `id`：`@NotNull(message = "标签组ID不能为空")`
/// - `groupName`：`@NotBlank(message = "组名称不能为空")`
/// - `tags`：`@Valid` + `@NotNull(message = "标签不能为空")`
///   + `@Size(min = 2, message = "至少保留两个标签")`
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagGroupUpdateDTO {
    /// 标签组ID（必填）
    pub id: Option<i64>,
    /// 组名称（必填、非空白；入库时**不 trim**）
    pub group_name: Option<String>,
    /// 标签列表（必填，至少 2 个）
    pub tags: Option<Vec<MemberTagItemDTO>>,
}

/// 操作请求（Java `com.tigshop.bean.dto.common.OperateDTO`，本域自持副本，
/// 与 member_tag / tax_rate 的处理方式一致）。
///
/// ⚠️ Java `OperateDTO.id` 的类型是 **`Integer`**（不是 `Long`），
/// 控制器再调 `operateDTO.getId().longValue()` 转 `Long` 传给 service。
/// 因此请求体里 `id` 超出 `i32` 范围时 Jackson 反序列化**直接失败**（400）。
/// 本实现用 `Option<i32>` 精确复刻该语义。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct OperateDTO {
    /// 标签组ID（Java `Integer`；必填）
    pub id: Option<i32>,
    /// 备注（本域不使用）
    pub admin_note: Option<String>,
    /// 页面类型（本域不使用）
    pub page_type: Option<i32>,
}

impl OperateDTO {
    /// 取 `id` 并转 `i64`（对应 Java `operateDTO.getId().longValue()`）。
    #[must_use]
    pub fn group_id(&self) -> Option<i64> {
        self.id.map(i64::from)
    }
}

// ——————————————————————————————————————————————
// 校验（Java 注解的等价物）
// ——————————————————————————————————————————————

/// 去空白后取非空字符串（Java `StrUtil.isNotBlank` 的等价物）。
///
/// ⚠️ `"   "` 视为空（`isBlank` 语义），用于 `@NotBlank` 类校验。
#[must_use]
pub fn non_blank(s: Option<&str>) -> Option<&str> {
    s.map(str::trim).filter(|t| !t.is_empty())
}

/// Java `StrUtil.isNotEmpty` 的等价物：非 null **且**长度 > 0。
///
/// ⚠️ 与 [`non_blank`] 不同：`"   "` 在这里**算非空**。
/// `MemberTagGroupServiceImpl#list` 的 `keyword` / `groupName` 判断用的是
/// `isNotEmpty`，因此纯空白关键字**会**产生 `LIKE '%   %'` 过滤条件。
#[must_use]
pub fn is_not_empty(s: Option<&str>) -> bool {
    matches!(s, Some(v) if !v.is_empty())
}

/// 校验并归一 `create` 入参（Java `@Valid MemberTagGroupCreateParam`）。
///
/// 返回 `(group_name, tag_names)`：
/// - `group_name`：**原样**返回（Java `group.setGroupName(param.getGroupName())`
///   不 trim，`@NotBlank` 只用于校验）
/// - `tag_names`：逐项 `trim()`（Java `tagName.trim()`）
///
/// 校验顺序固定为 `groupName` → `tagNames` 存在 → `tagNames` 长度，
/// 便于测试断言稳定（Bean Validation 自身的报错顺序不作保证）。
///
/// # Errors
/// 返回逐字符照抄 Java 注解 `message` 的错误文案。
pub fn validate_create(dto: &MemberTagGroupCreateDTO) -> Result<(String, Vec<String>), String> {
    if non_blank(dto.group_name.as_deref()).is_none() {
        return Err(MSG_GROUP_NAME_REQUIRED.to_string());
    }
    let group_name = dto.group_name.clone().unwrap_or_default();

    let tag_names = dto
        .tag_names
        .as_ref()
        .ok_or_else(|| MSG_TAG_NAMES_REQUIRED.to_string())?;
    if tag_names.len() < MIN_TAG_COUNT {
        return Err(MSG_TAG_NAMES_MIN.to_string());
    }
    Ok((
        group_name,
        tag_names.iter().map(|t| t.trim().to_string()).collect(),
    ))
}

/// 已归一的一条提交标签（`MemberTagItemParam` 的 trim 后形态）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TagItem {
    /// 已有标签的 ID（新标签为 `None`）
    pub id: Option<i64>,
    /// 标签名称（已 trim）
    pub tag_name: String,
}

/// 校验并归一 `update` 入参（Java `@Valid MemberTagGroupUpdateParam`）。
///
/// 返回 `(id, group_name, items)`；`group_name` 原样返回、`items` 名称已 trim。
///
/// 校验顺序固定为 `id` → `groupName` → `tags` 存在 → `tags` 长度 →
/// 逐个 `tagName` 非空白（Bean Validation 自身顺序不作保证）。
///
/// # Errors
/// 返回逐字符照抄 Java 注解 `message` 的错误文案。
pub fn validate_update(
    dto: &MemberTagGroupUpdateDTO,
) -> Result<(i64, String, Vec<TagItem>), String> {
    let id = dto.id.ok_or_else(|| MSG_GROUP_ID_REQUIRED.to_string())?;

    if non_blank(dto.group_name.as_deref()).is_none() {
        return Err(MSG_GROUP_NAME_REQUIRED.to_string());
    }
    let group_name = dto.group_name.clone().unwrap_or_default();

    let tags = dto
        .tags
        .as_ref()
        .ok_or_else(|| MSG_TAGS_REQUIRED.to_string())?;
    if tags.len() < MIN_TAG_COUNT {
        return Err(MSG_TAGS_MIN.to_string());
    }

    let mut items = Vec::with_capacity(tags.len());
    for t in tags {
        let name =
            non_blank(t.tag_name.as_deref()).ok_or_else(|| MSG_TAG_NAME_REQUIRED.to_string())?;
        items.push(TagItem {
            id: t.id,
            tag_name: name.to_string(),
        });
    }
    Ok((id, group_name, items))
}

// ——————————————————————————————————————————————
// 标签全量同步的纯逻辑（Java `MemberTagGroupServiceImpl#update` 的差异计算）
// ——————————————————————————————————————————————

/// 库中已存在的标签（用于差异计算）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ExistingTag {
    /// 标签主键
    pub id: i64,
    /// 标签名称
    pub tag_name: String,
}

/// 标签同步计划（Java `update` 里「删除 / 改名 / 新增」三段逻辑的净结果）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TagSyncPlan {
    /// 不在提交列表里的已有标签 ID（Java：`deleteById` + 清理 `user_member_tag`）
    pub delete_ids: Vec<i64>,
    /// 需要改名的已有标签 `(id, 新名称)`
    pub rename_ids: Vec<(i64, String)>,
    /// 需要新增的标签名称（提交时**未带 ID**）
    pub insert_names: Vec<String>,
}

impl TagSyncPlan {
    /// 计划是否为空（三个动作都没命中）。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.delete_ids.is_empty() && self.rename_ids.is_empty() && self.insert_names.is_empty()
    }
}

/// 计算标签全量同步计划
/// （对应 Java `MemberTagGroupServiceImpl#update` 的 219–259 行）。
///
/// 逐条复刻 Java 语义：
/// 1. `submittedIds` = 提交列表里 `id != null` 的集合；
/// 2. **删除**：已有标签中 `id ∉ submittedIds` 的全部删除
///    （Java 在删除时还会顺手清理该标签的 `user_member_tag` 关联）；
/// 3. 遍历提交列表（**按提交顺序**）：
///    - `id != null` → 在 `existingMap` 里找得到且名称不同 ⇒ **改名**；
///      找不到（例如传了别的组的标签 ID）⇒ **静默忽略**
///      （Java `if (existing != null && ...)`，既不新增也不报错）；
///      名称相同 ⇒ 不动；
///    - `id == null` ⇒ **新增**。
///
/// ⚠️ 该函数是**纯函数**：仓储层在一个事务里先查出已有标签、调用本函数、
/// 再按计划执行，从而与 Java「同一 `@Transactional` 内先查后改」等价。
#[must_use]
pub fn plan_tag_sync(existing: &[ExistingTag], submitted: &[TagItem]) -> TagSyncPlan {
    let submitted_ids: HashSet<i64> = submitted.iter().filter_map(|i| i.id).collect();
    let existing_by_id: HashMap<i64, &ExistingTag> = existing.iter().map(|t| (t.id, t)).collect();

    let mut plan = TagSyncPlan::default();

    // ① 删除：不在提交列表中的已有标签（保持已有标签的库内顺序）
    for t in existing {
        if !submitted_ids.contains(&t.id) {
            plan.delete_ids.push(t.id);
        }
    }

    // ② 改名 / 新增：按提交顺序（Java 的 for 循环顺序）
    for item in submitted {
        match item.id {
            Some(id) => {
                if let Some(cur) = existing_by_id.get(&id) {
                    if cur.tag_name != item.tag_name {
                        plan.rename_ids.push((id, item.tag_name.clone()));
                    }
                }
            }
            None => plan.insert_names.push(item.tag_name.clone()),
        }
    }

    plan
}

/// 计算下一个置顶权重
/// （对应 Java `setTop`：`selectMaxIsTop(shopId)` → `(maxTop == null ? 0 : maxTop) + 1`）。
///
/// Java 用的是 `int` 加法（溢出会回绕成负数）；本实现用 `saturating_add`
/// 饱和到 `i32::MAX`，避免置顶权重变负后**排到最后**（见 `uncertain_points`）。
///
/// ⚠️ 不能标 `const fn`：`Option::unwrap_or` 至今**未**在 const 上下文稳定
/// （`const_option` 特性未完整落地），会报 E0658。
#[must_use]
pub fn next_top(max_top: Option<i32>) -> i32 {
    max_top.unwrap_or(0).saturating_add(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量 / schema 对照 —————————————————————

    /// 三个表的列清单必须与 `schema_parser.py` 的权威输出逐字一致。
    #[test]
    fn column_lists_match_authoritative_schema() {
        assert_eq!(
            MEMBER_TAG_GROUP_COLUMNS,
            [
                "id",
                "shop_id",
                "group_name",
                "is_top",
                "create_time",
                "create_by_id",
                "create_by_name",
                "update_time",
                "update_by_id",
                "update_by_name",
                "is_del",
            ]
        );
        assert_eq!(
            MEMBER_TAG_COLUMNS,
            [
                "id",
                "shop_id",
                "group_id",
                "tag_name",
                "create_time",
                "create_by_id",
                "create_by_name",
                "update_time",
                "update_by_id",
                "update_by_name",
                "is_del",
            ]
        );
        assert_eq!(
            USER_MEMBER_TAG_COLUMNS,
            ["id", "shop_id", "user_id", "tag_id", "create_time"]
        );
    }

    /// `user_member_tag` **没有** `is_del` 列 —— 这是「清关联用物理删除、
    /// 删标签/组用逻辑删除」这一非对称行为的根据。
    #[test]
    fn user_member_tag_has_no_logical_delete_column() {
        assert!(!USER_MEMBER_TAG_COLUMNS.contains(&"is_del"));
        assert!(MEMBER_TAG_COLUMNS.contains(&"is_del"));
        assert!(MEMBER_TAG_GROUP_COLUMNS.contains(&"is_del"));
    }

    /// `@TableLogic` 取值 + 其它常量。
    #[test]
    fn constants_match_java() {
        assert_eq!(IS_DEL_NO, 0);
        assert_eq!(IS_DEL_YES, 1);
        assert_eq!(DEFAULT_SHOP_ID, 0);
        assert_eq!(MIN_TAG_COUNT, 2);
        // 全角逗号（Java `Collectors.joining("，")`）
        assert_eq!(TAG_VALUES_SEPARATOR, "，");
        assert_ne!(TAG_VALUES_SEPARATOR, ",");
        assert_eq!(OPERATOR_NAME_FALLBACK, "unknown");
    }

    /// 八条文案逐字符照抄 Java（来自四个不同的 Java 类，不允许合并改写）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_GROUP_NAME_REQUIRED, "组名称不能为空");
        assert_eq!(MSG_TAG_NAMES_REQUIRED, "标签值不能为空");
        assert_eq!(MSG_TAG_NAMES_MIN, "至少填写两个标签值");
        assert_eq!(MSG_GROUP_ID_REQUIRED, "标签组ID不能为空");
        assert_eq!(MSG_TAGS_REQUIRED, "标签不能为空");
        assert_eq!(MSG_TAGS_MIN, "至少保留两个标签");
        assert_eq!(MSG_TAG_NAME_REQUIRED, "标签名称不能为空");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_GROUP_NOT_FOUND, "标签组不存在");
        // 「至少填写两个标签值」（create）与「至少保留两个标签」（update）不同
        assert_ne!(MSG_TAG_NAMES_MIN, MSG_TAGS_MIN);
    }

    // ————————————————————— 时间格式化 —————————————————————

    /// 秒级时间戳按东八区格式化。
    ///
    /// ⚠️ 期望值口径（曾两次算错，勿改）：`1_700_000_000` 的 UTC 是
    /// `2023-11-14 22:13:20`，**+8h ⇒ `2023-11-15 06:13:20`**（不是 14:13:20）。
    /// `Some(1)` = epoch +1 秒 ⇒ 东八区 `08:00:01`（不是 08:00:00）。
    #[test]
    fn format_create_time_uses_east8() {
        assert_eq!(
            format_create_time(Some(1_700_000_000)),
            "2023-11-15 06:13:20"
        );
        assert_eq!(format_create_time(Some(1)), "1970-01-01 08:00:01");
    }

    /// 与 Java 逐字对齐的三个分支：`null` → `""`；`<= 0` → `""`；正常 → 格式化。
    #[test]
    fn format_create_time_matches_java_serializer_branches() {
        assert_eq!(format_create_time(None), "");
        assert_eq!(format_create_time(Some(0)), "");
        assert_eq!(format_create_time(Some(-1)), "");
        let s = format_create_time(Some(1_700_000_000));
        assert!(!s.contains('T'), "不得输出 ISO8601：{s}");
        assert!(!s.contains('Z'), "不得输出 UTC 标记：{s}");
    }

    // ————————————————————— 出参映射 —————————————————————

    /// VO 映射：四个字段一一对应，`createTime` 走 Java 序列化器语义。
    #[test]
    fn tag_vo_from_entity_maps_four_fields() {
        let t = MemberTag {
            id: 7,
            shop_id: 3,
            group_id: 42,
            tag_name: "高价值客户".to_string(),
            create_time: Some(1_700_000_000),
            create_by_id: Some(1),
            create_by_name: Some("admin".to_string()),
            update_time: Some(1_700_000_001),
            update_by_id: Some(1),
            update_by_name: Some("admin".to_string()),
            is_del: IS_DEL_NO,
        };
        let vo = MemberTagVO::from(&t);
        assert_eq!(vo.id, 7);
        assert_eq!(vo.group_id, 42);
        assert_eq!(vo.tag_name, "高价值客户");
        assert_eq!(vo.create_time, "2023-11-15 06:13:20");
        let json = serde_json::to_string(&vo).unwrap();
        assert!(!json.contains("shopId"), "VO 不应包含 shopId：{json}");
        assert!(!json.contains("isDel"), "VO 不应包含 isDel：{json}");
    }

    /// `create_time` 为 `None` 时 `createTime` 是**空串**，不是 `null`。
    #[test]
    fn tag_vo_create_time_is_empty_string_not_null() {
        let t = MemberTag {
            id: 1,
            shop_id: 0,
            group_id: 2,
            tag_name: "x".to_string(),
            ..Default::default()
        };
        let vo = MemberTagVO::from(&t);
        assert_eq!(vo.create_time, "");
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains("\"createTime\":\"\""), "{json}");
        assert!(!json.contains("\"createTime\":null"), "{json}");
    }

    /// 详情 VO 的 JSON 键必须是 camelCase 且四个键齐全
    /// （Jackson `Include.ALWAYS` ⇒ 不丢字段）。
    #[test]
    fn detail_vo_serializes_camel_case_with_all_keys() {
        let vo = MemberTagGroupDetailVO::from_parts(
            5,
            "重点客户",
            Some(1_700_000_000),
            vec![MemberTagVO {
                id: 1,
                group_id: 5,
                tag_name: "VIP".to_string(),
                create_time: String::new(),
            }],
        );
        assert_eq!(vo.create_time, "2023-11-15 06:13:20");
        let v: serde_json::Value = serde_json::to_value(&vo).unwrap();
        let obj = v.as_object().unwrap();
        assert_eq!(obj.len(), 4);
        for key in ["id", "groupName", "createTime", "tags"] {
            assert!(obj.contains_key(key), "缺少键 {key}");
        }
        // 标签元素同样是 camelCase
        let tag = &v["tags"][0];
        for key in ["id", "groupId", "tagName", "createTime"] {
            assert!(tag.get(key).is_some(), "标签缺少键 {key}");
        }
    }

    // ————————————————————— 入参反序列化 —————————————————————

    /// `create` 入参 camelCase 反序列化 + 缺失字段走默认值。
    #[test]
    fn create_dto_deserializes_camel_case_and_defaults() {
        let dto: MemberTagGroupCreateDTO =
            serde_json::from_str(r#"{"groupName":" 重点客户 ","tagNames":["A","B"]}"#).unwrap();
        assert_eq!(dto.group_name.as_deref(), Some(" 重点客户 "));
        assert_eq!(dto.tag_names.as_ref().map(Vec::len), Some(2));

        let dto: MemberTagGroupCreateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.group_name, None);
        assert_eq!(dto.tag_names, None);
    }

    /// `update` 入参：`tags` 元素里的 `id` 可缺省（新标签）。
    #[test]
    fn update_dto_deserializes_items_with_and_without_id() {
        let dto: MemberTagGroupUpdateDTO = serde_json::from_str(
            r#"{"id":9,"groupName":"g","tags":[{"id":1,"tagName":"A"},{"tagName":"B"}]}"#,
        )
        .unwrap();
        assert_eq!(dto.id, Some(9));
        let tags = dto.tags.unwrap();
        assert_eq!(tags[0].id, Some(1));
        assert_eq!(tags[1].id, None);
    }

    /// `OperateDTO.id` 是 `Integer` 语义：`i32` 越界在反序列化阶段失败
    /// （对应 Java Jackson 反序列化 `Integer` 失败 → 400），不静默截断。
    #[test]
    fn operate_dto_id_uses_i32_range_like_java_integer() {
        let ok: OperateDTO = serde_json::from_str(r#"{"id":2147483647}"#).unwrap();
        assert_eq!(ok.group_id(), Some(2_147_483_647));

        let overflow: std::result::Result<OperateDTO, _> =
            serde_json::from_str(r#"{"id":2147483648}"#);
        assert!(
            overflow.is_err(),
            "超 i32 应反序列化失败（Java Integer 语义）"
        );

        // 冗余字段被忽略
        let dto: OperateDTO =
            serde_json::from_str(r#"{"id":3,"adminNote":"n","pageType":1}"#).unwrap();
        assert_eq!(dto.group_id(), Some(3));
    }

    // ————————————————————— 校验 —————————————————————

    /// `create` 校验：先判 groupName，再判 tagNames 存在，最后判长度。
    #[test]
    fn validate_create_reports_group_name_first() {
        // 两个都缺 → 组名文案优先
        let dto = MemberTagGroupCreateDTO {
            group_name: None,
            tag_names: None,
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_GROUP_NAME_REQUIRED);

        // 纯空白等价于空（Java `@NotBlank` 会 trim 后判空）
        let dto = MemberTagGroupCreateDTO {
            group_name: Some("  \t ".to_string()),
            tag_names: Some(vec!["A".into(), "B".into()]),
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_GROUP_NAME_REQUIRED);

        // 组名有了，标签列表为 null
        let dto = MemberTagGroupCreateDTO {
            group_name: Some("g".into()),
            tag_names: None,
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_TAG_NAMES_REQUIRED);

        // 少于 2 个
        let dto = MemberTagGroupCreateDTO {
            group_name: Some("g".into()),
            tag_names: Some(vec!["A".into()]),
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_TAG_NAMES_MIN);

        let dto = MemberTagGroupCreateDTO {
            group_name: Some("g".into()),
            tag_names: Some(vec![]),
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_TAG_NAMES_MIN);
    }

    /// `create`：`groupName` **不 trim**（Java `setGroupName(param.getGroupName())`），
    /// 标签名**逐个 trim**（Java `tagName.trim()`），且**不校验**元素是否空白。
    #[test]
    fn validate_create_keeps_group_name_raw_and_trims_tag_names() {
        let dto = MemberTagGroupCreateDTO {
            group_name: Some("  重点客户  ".into()),
            // 第三个元素是纯空白：Java 侧 `List<String>` 无元素级 @NotBlank ⇒ 放行
            tag_names: Some(vec!["  A  ".into(), " B ".into(), "   ".into()]),
        };
        let (name, tags) = validate_create(&dto).unwrap();
        assert_eq!(name, "  重点客户  ", "groupName 不应被 trim");
        assert_eq!(tags, vec!["A".to_string(), "B".to_string(), String::new()]);
    }

    /// `update` 校验：id → groupName → tags 存在 → tags 长度 → 元素名称。
    #[test]
    fn validate_update_reports_in_declared_order() {
        let dto = MemberTagGroupUpdateDTO {
            id: None,
            group_name: Some("g".into()),
            tags: Some(vec![]),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_GROUP_ID_REQUIRED);

        let dto = MemberTagGroupUpdateDTO {
            id: Some(1),
            group_name: Some("  ".into()),
            tags: Some(vec![]),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_GROUP_NAME_REQUIRED);

        let dto = MemberTagGroupUpdateDTO {
            id: Some(1),
            group_name: Some("g".into()),
            tags: None,
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_TAGS_REQUIRED);

        let dto = MemberTagGroupUpdateDTO {
            id: Some(1),
            group_name: Some("g".into()),
            tags: Some(vec![MemberTagItemDTO {
                id: None,
                tag_name: Some("A".into()),
            }]),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_TAGS_MIN);

        let dto = MemberTagGroupUpdateDTO {
            id: Some(1),
            group_name: Some("g".into()),
            tags: Some(vec![
                MemberTagItemDTO {
                    id: Some(2),
                    tag_name: Some("A".into()),
                },
                MemberTagItemDTO {
                    id: None,
                    tag_name: Some("   ".into()),
                },
            ]),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_TAG_NAME_REQUIRED);
    }

    /// `update` 通过后：id 原样、groupName 原样、标签名 trim。
    #[test]
    fn validate_update_normalizes_items() {
        let dto = MemberTagGroupUpdateDTO {
            id: Some(-5), // 负数 id **不**被拦（Java @NotNull 不管范围）
            group_name: Some(" g ".into()),
            tags: Some(vec![
                MemberTagItemDTO {
                    id: Some(11),
                    tag_name: Some("  A  ".into()),
                },
                MemberTagItemDTO {
                    id: None,
                    tag_name: Some(" B ".into()),
                },
            ]),
        };
        let (id, name, items) = validate_update(&dto).unwrap();
        assert_eq!(id, -5);
        assert_eq!(name, " g ");
        assert_eq!(
            items,
            vec![
                TagItem {
                    id: Some(11),
                    tag_name: "A".into()
                },
                TagItem {
                    id: None,
                    tag_name: "B".into()
                },
            ]
        );
    }

    /// `isNotEmpty` 与 `isBlank` 的口径差异必须保留：
    /// `"   "` 在 Java `StrUtil.isNotEmpty` 下**算非空**。
    #[test]
    fn is_not_empty_counts_whitespace_as_non_empty() {
        assert!(!is_not_empty(None));
        assert!(!is_not_empty(Some("")));
        assert!(is_not_empty(Some(" ")));
        assert!(is_not_empty(Some("kw")));
        // 与 non_blank 形成对照
        assert_eq!(non_blank(Some(" ")), None);
        assert_eq!(non_blank(Some(" kw ")), Some("kw"));
    }

    // ————————————————————— 标签同步计划 —————————————————————

    fn existing(id: i64, name: &str) -> ExistingTag {
        ExistingTag {
            id,
            tag_name: name.to_string(),
        }
    }

    fn item(id: Option<i64>, name: &str) -> TagItem {
        TagItem {
            id,
            tag_name: name.to_string(),
        }
    }

    /// 改名 + 新增 + 删除 三种动作同时出现。
    #[test]
    fn plan_tag_sync_covers_all_three_actions() {
        let cur = vec![existing(1, "A"), existing(2, "B")];
        // 1 保留并改名；2 未提交 → 删除；新增 "D"
        let submitted = vec![item(Some(1), "A2"), item(None, "D")];
        let plan = plan_tag_sync(&cur, &submitted);

        assert_eq!(plan.delete_ids, vec![2], "未提交的 2 应被删除");
        assert_eq!(plan.rename_ids, vec![(1, "A2".to_string())]);
        assert_eq!(plan.insert_names, vec!["D".to_string()]);
        assert!(!plan.is_empty());
    }

    /// 多个未提交标签全部进入删除列表，且保持**已有标签的库内顺序**。
    #[test]
    fn plan_tag_sync_deletes_all_unsubmitted_in_storage_order() {
        let cur = vec![existing(1, "A"), existing(2, "B"), existing(3, "C")];
        // 只提交 1 ⇒ 2 / 3 都删除
        let submitted = vec![item(Some(1), "A")];
        let plan = plan_tag_sync(&cur, &submitted);
        assert_eq!(plan.delete_ids, vec![2, 3]);
    }

    /// 名称未变的已有标签**不产生** UPDATE。
    #[test]
    fn plan_tag_sync_skips_unchanged_names() {
        let cur = vec![existing(1, "A"), existing(2, "B")];
        let submitted = vec![item(Some(1), "A"), item(Some(2), "B")];
        let plan = plan_tag_sync(&cur, &submitted);
        assert!(plan.is_empty(), "无差异时计划必须为空: {plan:?}");
    }

    /// 提交了**不属于本组**的标签 ID：静默忽略（Java `existing != null` 判定）。
    ///
    /// 同时验证「未提交的已有标签会被删除」——两者在一次调用里同时成立：
    /// `99` 既不改名也不新增；`2` 未提交 ⇒ 删除。
    #[test]
    fn plan_tag_sync_ignores_foreign_ids() {
        let cur = vec![existing(1, "A"), existing(2, "B")];
        let submitted = vec![item(Some(1), "A"), item(Some(99), "外来标签")];
        let plan = plan_tag_sync(&cur, &submitted);
        assert!(plan.rename_ids.is_empty(), "外来 ID 不应改名: {plan:?}");
        assert!(
            plan.insert_names.is_empty(),
            "带 ID 的提交项不应变成新增: {plan:?}"
        );
        assert_eq!(plan.delete_ids, vec![2], "未提交的 2 应被删除: {plan:?}");
    }

    /// 全部已有标签都被提交（且只有 1 个外来 ID）⇒ 计划只有删除之外的动作为空。
    #[test]
    fn plan_tag_sync_foreign_id_alone_changes_nothing() {
        let cur = vec![existing(1, "A")];
        let submitted = vec![item(Some(1), "A"), item(Some(99), "外来标签")];
        let plan = plan_tag_sync(&cur, &submitted);
        assert!(plan.is_empty(), "外来 ID 不应产生任何动作: {plan:?}");
    }

    /// 提交顺序决定改名/新增的先后（Java 的 for 循环顺序）。
    #[test]
    fn plan_tag_sync_preserves_submitted_order() {
        let cur = vec![existing(1, "A")];
        let submitted = vec![item(None, "N1"), item(Some(1), "A2"), item(None, "N2")];
        let plan = plan_tag_sync(&cur, &submitted);
        assert_eq!(plan.insert_names, vec!["N1".to_string(), "N2".to_string()]);
        assert_eq!(plan.rename_ids, vec![(1, "A2".to_string())]);
        assert!(plan.delete_ids.is_empty());
    }

    /// 空库 + 全新标签：只新增。
    #[test]
    fn plan_tag_sync_on_empty_group_only_inserts() {
        let plan = plan_tag_sync(&[], &[item(None, "A"), item(None, "B")]);
        assert_eq!(plan.insert_names, vec!["A".to_string(), "B".to_string()]);
        assert!(plan.delete_ids.is_empty());
        assert!(plan.rename_ids.is_empty());
    }

    // ————————————————————— 置顶权重 —————————————————————

    /// `setTop` 的权重递推：空表 → 1；已有最大 3 → 4。
    #[test]
    fn next_top_follows_java_max_plus_one() {
        assert_eq!(next_top(None), 1);
        assert_eq!(next_top(Some(0)), 1);
        assert_eq!(next_top(Some(3)), 4);
        // 溢出饱和而非回绕成负数（Java int 会回绕，见 uncertain_points）
        assert_eq!(next_top(Some(i32::MAX)), i32::MAX);
    }

    // ————————————————————— 操作人 —————————————————————

    /// 名称缺失/空白 → `"unknown"`（Java `MybatisPlusMetaObjectHandler`）。
    #[test]
    fn admin_operator_falls_back_to_unknown() {
        assert_eq!(
            AdminOperator::from_auth(7, None).name_ref(),
            Some("unknown")
        );
        assert_eq!(
            AdminOperator::from_auth(7, Some("   ")).name_ref(),
            Some("unknown")
        );
        assert_eq!(
            AdminOperator::from_auth(7, Some(" admin ")).name_ref(),
            Some("admin")
        );
        assert_eq!(AdminOperator::from_auth(7, Some("admin")).id, Some(7));
    }
}
