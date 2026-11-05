//! 会员标签管理域（member::member_tag）DTO / VO / 查询参数。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.user.MemberTagController`
//!   （`@RequestMapping("/adminapi/user/memberTag")`）
//! - `com.tigshop.service.user.impl.MemberTagServiceImpl`
//! - `com.tigshop.bean.model.user.MemberTag`（表 `member_tag`）
//! - `com.tigshop.bean.model.user.UserMemberTag`（表 `user_member_tag`）
//! - `com.tigshop.bean.param.user.MemberTagCreateParam`
//! - `com.tigshop.bean.param.user.MemberTagUpdateParam`
//! - `com.tigshop.bean.vo.user.MemberTagVO`
//! - `com.tigshop.bean.dto.common.OperateDTO`
//!
//! JSON 字段全部保持 camelCase，与原接口逐字符一致
//! （`#[serde(rename_all = "camelCase")]`）。
//!
//! # 金额
//!
//! 本域（会员标签增删改查）**完全不涉及金额字段**，因此没有
//! `rust_decimal::Decimal` 出场。
//!
//! # 多租户（shopId）
//!
//! Java 的 `currentShopId()` 读的是请求头 `HeaderUtils.getShopId()`，
//! **不是**请求体/查询参数：`null` 归一为 `0`（平台）。
//! Rust 侧 JWT 尚未签发 `shop_id`（与本仓其它域一致的已知缺口），
//! 因此本域把 `shopId` 作为**显式入参**由路由层传入，默认取
//! [`DEFAULT_SHOP_ID`]（平台 0）。详见返回值 `uncertain_points`。
//!
//! # 软删除（`@TableLogic`）
//!
//! `MemberTag extends BasePO`，`BasePO.isDel` 带 `@TableLogic`，
//! 且 `application.yml` 配 `logic-delete-value: 1` / `logic-not-delete-value: 0`
//! （见 `java/03-JAVA 后端开发指南.md:913`）。因此 MyBatis-Plus 会：
//! - 所有 `selectList` / `selectById` **自动追加** `is_del = 0`
//! - `deleteById` 变成 `UPDATE member_tag SET is_del = 1 WHERE id = ? AND is_del = 0`
//!
//! 本模块用 [`IS_DEL_NO`] / [`IS_DEL_YES`] 表达这两个取值。
//!
//! ⚠️ `user_member_tag` **不在** `BasePO` 继承体系里（它是一个独立的
//! `Serializable` POJO，既无 `is_del` 列也无 `@TableLogic`），
//! 所以 `delTag` 里清理用户关联是**物理删除**。这一非对称性必须保留。

use serde::{Deserialize, Serialize};

use crate::entities::MemberTag;

// ——————————————————————————————————————————————
// 常量（逐字符照抄 Java）
// ——————————————————————————————————————————————

/// 平台店铺 ID（Java `currentShopId()` 在 `HeaderUtils.getShopId() == null`
/// 时的归一值 `0`）。
pub const DEFAULT_SHOP_ID: i32 = 0;

/// `@TableLogic` 的「未删除」取值（`logic-not-delete-value: 0`）。
pub const IS_DEL_NO: i32 = 0;

/// `@TableLogic` 的「已删除」取值（`logic-delete-value: 1`）。
pub const IS_DEL_YES: i32 = 1;

/// `member_tag` 的真实列清单
/// （`python tools/schema_parser.py --table member_tag`，共 11 列）。
///
/// 用于防注入的二次校验：任何拼进 SQL 的列名都必须命中这里。
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
/// （`python tools/schema_parser.py --table user_member_tag`，共 5 列）。
pub const USER_MEMBER_TAG_COLUMNS: [&str; 5] =
    ["id", "shop_id", "user_id", "tag_id", "create_time"];

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

/// `tag_name` 的库列长度 `varchar(100)`。
///
/// ⚠️ Java `MemberTagCreateParam` / `MemberTagUpdateParam` 的 `tagName`
/// 上**只有** `@NotBlank`，**没有** `@Size` —— 也就是说 Java 侧不校验长度，
/// 超长会由 MySQL 抛 `Data too long for column 'tag_name'`（→ 500）。
/// 本实现保留这一行为：**不**在服务层做长度校验，只用本常量做文档与断言
/// （见 `uncertain_points`）。
pub const TAG_NAME_MAX_LEN: usize = 100;

// ——————————————————————————————————————————————
// Java 常量文案（逐字符照抄）
// ——————————————————————————————————————————————

/// Java `MemberTagCreateParam.groupId` 上的
/// `@NotNull(message = "标签组ID不能为空")`。
pub const MSG_GROUP_ID_REQUIRED: &str = "标签组ID不能为空";

/// Java `MemberTagCreateParam.tagName` / `MemberTagUpdateParam.tagName` 上的
/// `@NotBlank(message = "标签名称不能为空")`。
pub const MSG_TAG_NAME_REQUIRED: &str = "标签名称不能为空";

/// Java `MemberTagUpdateParam.id` 上的
/// `@NotNull(message = "标签ID不能为空")`。
pub const MSG_TAG_ID_REQUIRED: &str = "标签ID不能为空";

/// Java `ResultTextConstants.ID_CANNOT_IS_NULL`（`OperateDTO.id` 上的
/// `@NotNull`）。`del` 接口用的是 `OperateDTO`，故文案与上面那条不同。
pub const MSG_ID_REQUIRED: &str = "id不能为空";

/// Java `MemberTagServiceImpl#create` 抛出的 `new GlobalException("标签组不存在")`。
pub const MSG_GROUP_NOT_FOUND: &str = "标签组不存在";

/// Java `MemberTagServiceImpl#update` / `#delTag` 抛出的
/// `new GlobalException("标签不存在")`。
pub const MSG_TAG_NOT_FOUND: &str = "标签不存在";

// ——————————————————————————————————————————————
// 时间格式化
// ——————————————————————————————————————————————

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（东八区）。
///
/// 对应 Java `MemberTagVO.createTime` 上的
/// `@JsonSerialize(using = TimestampToDateSerializer.class)`，
/// 该序列化器（`java/tigshop-common/.../TimestampToDateSerializer.java`）：
/// - `value == null` → 输出空串 `""`
/// - `timestamp > 0` → `LocalDateTime.ofInstant(..., ZoneId.of("Asia/Shanghai"))
///   .format("yyyy-MM-dd HH:mm:ss")`
/// - 否则（`<= 0`）→ 输出空串 `""`
///
/// `MemberTagVO.createTime` 的 Java 类型是 `String`（不是 `Long`），
/// 所以它**永远不会**是 JSON `null` —— 无值时是 `""`。
/// 本函数据此返回 `String`（非 `Option<String>`），与 Java 逐字符一致。
///
/// 时区说明：Java 硬编码 `Asia/Shanghai`；本实现用 `chrono::FixedOffset`
/// 固定 `+8` 小时，以避免运行机器 `TZ` 不同导致输出漂移
/// （东八区无夏令时，`+08:00` 与 `Asia/Shanghai` 在全部历史时刻等价）。
///
/// > 本项目测试环境一次只能跑一个时区假设，故此处**不**依赖 `chrono::Local`。
#[must_use]
pub fn format_create_time(secs: Option<i64>) -> String {
    use chrono::TimeZone;
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
        // Java 的 catch 分支「解析失败原样输出」；对合法 i64 秒数不可达，
        // 这里保守回退到原始数字的字符串形式。
        None => secs.to_string(),
    }
}

// ——————————————————————————————————————————————
// 出参
// ——————————————————————————————————————————————

/// 会员标签 VO（对应 Java `com.tigshop.bean.vo.user.MemberTagVO`）。
///
/// 四个字段与 Java 一一对应，**没有** `shopId` / `isDel` 等内部列
/// （Java 的 VO 就是这四个）。
///
/// Java `createTime` 的类型是 `String` 且带自定义序列化器，
/// 故此处也是 `String`（无值时 `""`，不是 `null`）。
///
/// 序列化策略：Java `MemberTagController.listByGroup` 的返回值由 Spring
/// 的 `MappingJackson2HttpMessageConverter` 直接写 `List<MemberTagVO>`。
/// 本仓全局 Jackson 配置为 `Include.ALWAYS` 且 `INDENT_OUTPUT`
/// （见 `com.tigshop.common.utils.JsonUtil`），因此**保留 null 字段**。
/// 本结构体四个字段都不是 `Option`，序列化必然出现四个键，无需
/// `skip_serializing_if`，天然一致。
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

// ——————————————————————————————————————————————
// 入参
// ——————————————————————————————————————————————

/// 新增标签请求（Java `MemberTagCreateParam`）。
///
/// Java 侧两个字段的校验注解：
/// - `groupId`：`@NotNull(message = "标签组ID不能为空")`
/// - `tagName`：`@NotBlank(message = "标签名称不能为空")`
///
/// 控制器方法参数带 `@Valid`、类上带 `@Validated`，故这些注解**确实生效**
/// （`@NotBlank` 会 trim 后判空：纯空白串 → 400）。
/// 本实现把校验放在服务层，文案逐字符照抄。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagCreateDTO {
    /// 所属标签组ID（必填）
    pub group_id: Option<i64>,
    /// 标签名称（必填，非空白）
    pub tag_name: Option<String>,
}

/// 更新标签请求（Java `MemberTagUpdateParam`）。
///
/// Java 侧两个字段的校验注解：
/// - `id`：`@NotNull(message = "标签ID不能为空")`
/// - `tagName`：`@NotBlank(message = "标签名称不能为空")`
///
/// ⚠️ 与 `create` 不同，`update` **没有** `groupId` 字段
/// —— 标签不可跨组移动。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagUpdateDTO {
    /// 标签ID（必填）
    pub id: Option<i64>,
    /// 标签名称（必填，非空白）
    pub tag_name: Option<String>,
}

/// 删除标签请求（Java `com.tigshop.bean.dto.common.OperateDTO`）。
///
/// ⚠️ Java `OperateDTO.id` 的类型是 **`Integer`**（不是 `Long`），
/// 而 `MemberTagController.del` 又调 `operateDTO.getId().longValue()`
/// 转成 `Long` 传给 service。因此：
/// - 请求体里 `id` 超出 `i32` 范围时 Jackson 反序列化**直接失败**（400）
/// - 且 `OperateDTO` 上的 `@NotNull` 生效（`del` 方法参数是
///   `@RequestBody OperateDTO`，类级 `@Validated` 会让它生效）
///
/// 本实现用 `Option<i32>` 精确复刻这个 `Integer` 语义（越界即 serde 报错
/// → 400），再由服务层转 `i64`。见 `uncertain_points`。
///
/// `adminNote` / `pageType` 是本 DTO 的其它字段，`delTag` **不使用**；
/// 这里按需保留 `pageType` 以便前端原样提交（`adminNote` 同样冗余，
/// 但 serde 默认忽略未知字段，故无需声明）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MemberTagDelDTO {
    /// 标签ID（Java `Integer`；必填）
    pub id: Option<i32>,
}

impl MemberTagDelDTO {
    /// 取 `id` 并转 `i64`（对应 Java `operateDTO.getId().longValue()`）。
    #[must_use]
    pub fn tag_id(&self) -> Option<i64> {
        self.id.map(i64::from)
    }
}

// ——————————————————————————————————————————————
// 校验（Java 注解的等价物）
// ——————————————————————————————————————————————

/// 校验并归一 `create` 入参。
///
/// 与 Java `@Valid MemberTagCreateParam` 等价：
/// 1. `groupId == null` → [`MSG_GROUP_ID_REQUIRED`]
/// 2. `tagName` trim 后为空 → [`MSG_TAG_NAME_REQUIRED`]
///
/// 返回 `(groupId, tagName.trim())`。
/// ⚠️ Java 在 `create` 里显式 `param.getTagName().trim()` 再入库，
/// 因此这里返回 trim 后的值；`tagName` 本身**不做**长度校验
/// （Java 没有 `@Size`，见 [`TAG_NAME_MAX_LEN`] 的说明）。
///
/// # Errors
/// 入参不满足上述两条约束时返回错误文案。
pub fn validate_create(dto: &MemberTagCreateDTO) -> std::result::Result<(i64, String), String> {
    let group_id = dto
        .group_id
        .ok_or_else(|| MSG_GROUP_ID_REQUIRED.to_string())?;
    let tag_name = dto
        .tag_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_TAG_NAME_REQUIRED.to_string())?;
    Ok((group_id, tag_name.to_string()))
}

/// 校验并归一 `update` 入参。
///
/// 与 Java `@Valid MemberTagUpdateParam` 等价：
/// 1. `id == null` → [`MSG_TAG_ID_REQUIRED`]
/// 2. `tagName` trim 后为空 → [`MSG_TAG_NAME_REQUIRED`]
///
/// 返回 `(id, tagName.trim())`（Java `update` 里同样是 `param.getTagName().trim()`）。
///
/// # Errors
/// 入参不满足上述两条约束时返回错误文案。
pub fn validate_update(dto: &MemberTagUpdateDTO) -> std::result::Result<(i64, String), String> {
    let id = dto.id.ok_or_else(|| MSG_TAG_ID_REQUIRED.to_string())?;
    let tag_name = dto
        .tag_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| MSG_TAG_NAME_REQUIRED.to_string())?;
    Ok((id, tag_name.to_string()))
}

/// 校验 `del` 入参。
///
/// ⚠️ 文案用 [`MSG_ID_REQUIRED`]（`id不能为空`），因为 `del` 收的是
/// `OperateDTO` 而不是 `MemberTagUpdateParam` —— 两个 Java 类上的
/// `@NotNull` message 不同，不能混用。
///
/// # Errors
/// `id == null` 时返回 [`MSG_ID_REQUIRED`]。
pub fn validate_del(dto: &MemberTagDelDTO) -> std::result::Result<i64, String> {
    dto.tag_id().ok_or_else(|| MSG_ID_REQUIRED.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ————————————————————— 常量：与 Java / schema 逐字符对照 —————————————————————

    /// 列清单必须与 `schema_parser.py` 的权威输出逐字一致。
    #[test]
    fn column_lists_match_authoritative_schema() {
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
    }

    /// `user_member_tag` **没有** `is_del` 列 —— 这是 `delTag` 里
    /// 「清关联用物理删除、删标签用逻辑删除」这一非对称行为的根据。
    #[test]
    fn user_member_tag_has_no_logical_delete_column() {
        assert!(!USER_MEMBER_TAG_COLUMNS.contains(&"is_del"));
        assert!(MEMBER_TAG_COLUMNS.contains(&"is_del"));
    }

    /// `member_tag_group` 有 `is_del`，且 `is_top` 存在（create 校验用它）。
    #[test]
    fn member_tag_group_has_is_del_and_is_top() {
        assert!(MEMBER_TAG_GROUP_COLUMNS.contains(&"is_del"));
        assert!(MEMBER_TAG_GROUP_COLUMNS.contains(&"is_top"));
    }

    /// `@TableLogic` 的取值：`logic-delete-value: 1` / `logic-not-delete-value: 0`。
    #[test]
    fn logic_delete_values_match_application_yml() {
        assert_eq!(IS_DEL_NO, 0);
        assert_eq!(IS_DEL_YES, 1);
        // 平台店铺 ID 归一值（Java `currentShopId()`）
        assert_eq!(DEFAULT_SHOP_ID, 0);
        // 库列 varchar(100)
        assert_eq!(TAG_NAME_MAX_LEN, 100);
    }

    /// Java 常量文案逐字符照抄（四条 message 全部来自不同的 Java 类，
    /// 不允许「统一改写」）。
    #[test]
    fn java_message_constants_are_verbatim() {
        assert_eq!(MSG_GROUP_ID_REQUIRED, "标签组ID不能为空");
        assert_eq!(MSG_TAG_NAME_REQUIRED, "标签名称不能为空");
        assert_eq!(MSG_TAG_ID_REQUIRED, "标签ID不能为空");
        assert_eq!(MSG_ID_REQUIRED, "id不能为空");
        assert_eq!(MSG_GROUP_NOT_FOUND, "标签组不存在");
        assert_eq!(MSG_TAG_NOT_FOUND, "标签不存在");
        // 两条「不能为空」的 id 文案确实不同，不能合并
        assert_ne!(MSG_TAG_ID_REQUIRED, MSG_ID_REQUIRED);
    }

    // ————————————————————— 时间格式化 —————————————————————

    /// 秒级时间戳按东八区格式化为 `yyyy-MM-dd HH:mm:ss`
    /// （Java `TimestampToDateSerializer` 的 `timestamp > 0` 分支）。
    ///
    /// ⚠️ 期望值必须**实算**，不要手算：
    /// `1_700_000_000` 秒 = 2023-11-14 22:13:20 UTC = **2023-11-15 06:13:20** +08:00
    /// （早先此处误写成 14:13:20，是把 UTC 小时数 22 当成 +8 前的值再减 8 了）。
    #[test]
    fn format_create_time_uses_east8() {
        assert_eq!(
            format_create_time(Some(1_700_000_000)),
            "2023-11-15 06:13:20"
        );
        // Unix 纪元 + 1 秒 = 1970-01-01 00:00:01 UTC = 1970-01-01 08:00:01 +08:00
        // （注意不是 08:00:00；`Some(0)` 走的是 `<= 0` 分支返回空串）
        assert_eq!(format_create_time(Some(1)), "1970-01-01 08:00:01");
    }

    /// 与 Java 逐字对齐的三个边界分支：
    /// `null` → `""`；`<= 0` → `""`；正常值 → 格式化串。
    #[test]
    fn format_create_time_matches_java_serializer_branches() {
        // value == null → gen.writeString("")
        assert_eq!(format_create_time(None), "");
        // timestamp 不 > 0 → gen.writeString("")
        assert_eq!(format_create_time(Some(0)), "");
        assert_eq!(format_create_time(Some(-1)), "");
        // 有值 → 格式化（绝不返回带 "Z" 的 ISO 串）
        let s = format_create_time(Some(1_700_000_000));
        assert!(!s.contains('T'), "不得输出 ISO8601：{s}");
        assert!(!s.contains('Z'), "不得输出 UTC 标记：{s}");
        assert_eq!(s.len(), "2023-11-15 14:13:20".len());
    }

    // ————————————————————— 出参映射 —————————————————————

    /// VO 映射：四个字段一一对应，`createTime` 走 Java 序列化器语义。
    #[test]
    fn vo_from_entity_maps_four_fields() {
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
        // VO **不**暴露 shopId / isDel 等内部列（Java VO 只有四个字段）
        let json = serde_json::to_string(&vo).unwrap();
        assert!(!json.contains("shopId"), "VO 不应包含 shopId：{json}");
        assert!(!json.contains("isDel"), "VO 不应包含 isDel：{json}");
    }

    /// `create_time` 为 `None` 时 VO 的 `createTime` 是**空串**，
    /// 不是 `null`（Java 字段类型是 `String`）。
    #[test]
    fn vo_create_time_is_empty_string_not_null() {
        let t = MemberTag {
            id: 1,
            shop_id: 0,
            group_id: 2,
            tag_name: "x".to_string(),
            create_time: None,
            ..Default::default()
        };
        let vo = MemberTagVO::from(&t);
        assert_eq!(vo.create_time, "");
        let json = serde_json::to_string(&vo).unwrap();
        assert!(json.contains("\"createTime\":\"\""), "{json}");
        assert!(!json.contains("\"createTime\":null"), "{json}");
    }

    /// VO 的 JSON 键名必须是 camelCase 且四个键齐全
    /// （Jackson `Include.ALWAYS` ⇒ 不丢字段）。
    #[test]
    fn vo_serializes_camel_case_with_all_keys() {
        let vo = MemberTagVO {
            id: 1,
            group_id: 2,
            tag_name: "n".to_string(),
            create_time: String::new(),
        };
        let v: serde_json::Value = serde_json::to_value(&vo).unwrap();
        let obj = v.as_object().unwrap();
        assert_eq!(obj.len(), 4);
        for key in ["id", "groupId", "tagName", "createTime"] {
            assert!(obj.contains_key(key), "缺少键 {key}");
        }
    }

    // ————————————————————— 入参反序列化 —————————————————————

    /// `create` 入参 camelCase 反序列化 + 缺失字段走默认值。
    #[test]
    fn create_dto_deserializes_camel_case_and_defaults() {
        let dto: MemberTagCreateDTO =
            serde_json::from_str(r#"{"groupId":9,"tagName":" VIP "}"#).unwrap();
        assert_eq!(dto.group_id, Some(9));
        assert_eq!(dto.tag_name.as_deref(), Some(" VIP "));

        // 空对象：两个字段都取默认 None（Java 侧则是 400）
        let dto: MemberTagCreateDTO = serde_json::from_str("{}").unwrap();
        assert_eq!(dto.group_id, None);
        assert_eq!(dto.tag_name, None);
    }

    /// `update` 入参：`groupId` 是**未知字段**（Java `MemberTagUpdateParam`
    /// 没有它），被 serde 静默忽略，不得报错。
    #[test]
    fn update_dto_ignores_unknown_group_id() {
        let dto: MemberTagUpdateDTO =
            serde_json::from_str(r#"{"id":5,"tagName":"n","groupId":9}"#).unwrap();
        assert_eq!(dto.id, Some(5));
        assert_eq!(dto.tag_name.as_deref(), Some("n"));
    }

    /// `del` 入参的 `id` 是 `Integer` 语义：`i32` 越界直接在反序列化阶段失败
    /// （对应 Java Jackson 反序列化 `Integer` 失败 → 400），
    /// 而不是悄悄截断。
    #[test]
    fn del_dto_id_uses_i32_range_like_java_integer() {
        let ok: MemberTagDelDTO = serde_json::from_str(r#"{"id":2147483647}"#).unwrap();
        assert_eq!(ok.tag_id(), Some(2_147_483_647));

        let overflow: std::result::Result<MemberTagDelDTO, _> =
            serde_json::from_str(r#"{"id":2147483648}"#);
        assert!(
            overflow.is_err(),
            "超 i32 应反序列化失败（Java Integer 语义）"
        );

        // 冗余字段被忽略
        let dto: MemberTagDelDTO =
            serde_json::from_str(r#"{"id":3,"adminNote":"n","pageType":1}"#).unwrap();
        assert_eq!(dto.tag_id(), Some(3));
    }

    // ————————————————————— 校验 —————————————————————

    /// `create` 校验：先判 groupId，再判 tagName。
    #[test]
    fn validate_create_reports_group_id_first() {
        // 两个都缺失时，group 的文案优先（字段声明顺序 / `@NotNull` 先行）
        let dto = MemberTagCreateDTO {
            group_id: None,
            tag_name: None,
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_GROUP_ID_REQUIRED);

        let dto = MemberTagCreateDTO {
            group_id: Some(1),
            tag_name: None,
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_TAG_NAME_REQUIRED);

        // 纯空白等价于空（Java `@NotBlank` 会 trim 后判空）
        let dto = MemberTagCreateDTO {
            group_id: Some(1),
            tag_name: Some("   \t ".to_string()),
        };
        assert_eq!(validate_create(&dto).unwrap_err(), MSG_TAG_NAME_REQUIRED);
    }

    /// `create` 校验通过后返回 trim 后的 tagName
    /// （Java `tag.setTagName(param.getTagName().trim())`）。
    #[test]
    fn validate_create_trims_tag_name() {
        let dto = MemberTagCreateDTO {
            group_id: Some(0),
            tag_name: Some("  高价值客户  ".to_string()),
        };
        let (gid, name) = validate_create(&dto).unwrap();
        assert_eq!(gid, 0);
        assert_eq!(name, "高价值客户");
        // 中间的空格保留（只 trim 首尾）
        let dto = MemberTagCreateDTO {
            group_id: Some(1),
            tag_name: Some("  A B  ".to_string()),
        };
        assert_eq!(validate_create(&dto).unwrap().1, "A B");
    }

    /// `create` **不**校验 tagName 长度（Java 无 `@Size`），
    /// 超长一律放行、交由 DB 报错。
    #[test]
    fn validate_create_does_not_check_length_like_java() {
        let long = "名".repeat(TAG_NAME_MAX_LEN + 50);
        let dto = MemberTagCreateDTO {
            group_id: Some(1),
            tag_name: Some(long.clone()),
        };
        assert_eq!(validate_create(&dto).unwrap().1, long);
    }

    /// `update` 校验：先判 id，再判 tagName；id 用专属文案。
    #[test]
    fn validate_update_reports_id_first_with_its_own_message() {
        let dto = MemberTagUpdateDTO {
            id: None,
            tag_name: Some("n".to_string()),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_TAG_ID_REQUIRED);
        assert_ne!(MSG_TAG_ID_REQUIRED, MSG_ID_REQUIRED);

        let dto = MemberTagUpdateDTO {
            id: Some(1),
            tag_name: Some("  ".to_string()),
        };
        assert_eq!(validate_update(&dto).unwrap_err(), MSG_TAG_NAME_REQUIRED);

        let dto = MemberTagUpdateDTO {
            id: Some(-5),
            tag_name: Some(" n ".to_string()),
        };
        // 负数 id **不**被拦（Java `@NotNull` 不管范围，DB 查不到 → "标签不存在"）
        assert_eq!(validate_update(&dto).unwrap(), (-5, "n".to_string()));
    }

    /// `del` 校验用 `OperateDTO` 的文案（`id不能为空`）。
    #[test]
    fn validate_del_uses_operate_dto_message() {
        assert_eq!(
            validate_del(&MemberTagDelDTO { id: None }).unwrap_err(),
            MSG_ID_REQUIRED
        );
        assert_eq!(validate_del(&MemberTagDelDTO { id: Some(0) }).unwrap(), 0);
    }
}
