//! IM 客服（ImServantController） 域 DTO / VO（im::im_servant）。
//!
//! 对应原 Java：
//! - `com.tigshop.bean.dto.im.ImServantListDTO`（`extends BasePage`）
//! - `com.tigshop.bean.dto.im.ServantModifyStatusDTO`
//! - `com.tigshop.bean.vo.im.ImServantVO`（含内部类 `UserVO`）
//! - `com.tigshop.common.utils.TigUtils#handelTime`、
//!   `com.tigshop.common.core.entity.BasePage`（分页默认值）
//!
//! 约定：`#[serde(rename_all = "camelCase")]`；金额 `rust_decimal::Decimal`
//! （本片无金额字段）；时间——Java VO 的 `addTime` / `lastUpdateTime` 经
//! `handelTime` 处理为**格式化字符串** `"yyyy-MM-dd HH:mm:ss"`，故此处同为
//! `Option<String>`（与实体里的秒级 `i32` 不同，见 `handel_time`）。

use serde::{Deserialize, Serialize};

/// 客服状态默认值（离线）。
///
/// 对应 Java `ImServantServiceImpl#getStatus`：新建记录时
/// `imServant.setStatus(3)`（注释「默认离线」）。
pub const DEFAULT_OFFLINE_STATUS: i32 = 3;

/// 当前请求的店铺范围（对应 Java `HeaderUtils.getShopId()` 的三态返回）。
///
/// - `Shop(v)` → 过滤 / 落库 `shop_id = v`（平台账号 `v == 0`）；
/// - `Unscoped` → Java 返回 `null`：
///   - `list` 不加 `shop_id` 条件；
///   - `getStatus` 不加 `shop_id` 条件；
///   - `modifyStatus` 仍执行 `WHERE shop_id = NULL`（MyBatis-Plus `eq(col, null)`
///     会拼进条件，MySQL 下 `= NULL` 恒不成立 → 永远走 INSERT 分支，
///     与 Java 完全一致）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImServantScope {
    /// 有明确店铺范围（含平台 `0`）。
    Shop(i32),
    /// Java 返回 `null`（未知账号类型）。
    Unscoped,
}

impl ImServantScope {
    /// 由 `HeaderUtils.getShopId()` 的 `Option` 结果构造。
    #[must_use]
    pub fn from_optional(v: Option<i32>) -> Self {
        match v {
            Some(v) => Self::Shop(v),
            None => Self::Unscoped,
        }
    }

    /// 作为 SQL 绑定值：`Shop(v)` → `Some(v)`；`Unscoped` → `None`。
    #[must_use]
    pub fn shop_id(self) -> Option<i32> {
        match self {
            Self::Shop(v) => Some(v),
            Self::Unscoped => None,
        }
    }
}

/// `GET /im/servant/servant/transferList` 的查询参数。
///
/// 对应 Java `ImServantListDTO extends BasePage`。控制器会用请求头**覆盖**
/// `shopId`（`HeaderUtils.getShopId()`），故请求体里的 `shopId` 无意义、
/// 不接收；这里只保留排序 / 分页 / `username` 过滤所需的字段。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImServantListQuery {
    /// 当前页码（Java `BasePage.page`，缺省 1）。
    pub page: Option<i64>,
    /// 每页大小（Java `BasePage.size`，缺省 15，上限 100）。
    pub size: Option<i64>,
    /// 排序字段（驼峰或列名；缺省 / 非法 → 主键 `id`）。
    pub sort_field: Option<String>,
    /// 排序方向（`asc` / `desc`；缺省 / 其它 → `desc`）。
    pub sort_order: Option<String>,
    /// 用户名模糊过滤（对应 Java `username`，`LIKE %username%`）。
    pub username: Option<String>,
}

/// 分页规格（复刻 Java `BasePage#getPage()` / `#getSize()` 的默认与夹取规则）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ImServantPage {
    /// 页码（>= 1）。
    pub page: u64,
    /// 每页大小（1..=100）。
    pub size: u64,
}

impl ImServantPage {
    /// Java 口径：`page` 为 `null` → 1；`size` 为 `null` → 15，`> 100` → 100。
    ///
    /// 额外差异：Java `getSize()` 不夹取 `< 1` 的值（`<= 0` 交给 MyBatis-Plus
    /// 处理，语义为不分页 / 全量）；此处为产生稳定的 `LIMIT`，将下限夹到 1，
    /// 见 `uncertain_points`。
    #[must_use]
    pub fn from_query(page: Option<i64>, size: Option<i64>) -> Self {
        let page = page.unwrap_or(1).max(1) as u64;
        let size = match size {
            Some(s) if s > 100 => 100,
            Some(s) => s.max(1) as u64,
            None => 15,
        };
        Self { page, size }
    }

    /// SQL `LIMIT` / `OFFSET`。
    #[must_use]
    pub fn limit_offset(self) -> (u64, u64) {
        (self.size, (self.page - 1) * self.size)
    }

    /// 总页数（向上取整，对应 Java `Page#getPages()`）。
    #[must_use]
    pub fn total_page(total: u64, size: u64) -> u64 {
        if size == 0 {
            0
        } else {
            total.div_ceil(size)
        }
    }
}

/// `POST /im/servant/servant/modifyStatus` 请求体。
///
/// 对应 Java `ServantModifyStatusDTO`。控制器用登录态覆盖 `servantId`
/// （`SecurityUtils.getCurrentAdminId()`）与 `shopId`（`HeaderUtils.getShopId()`），
/// 故仅 `status` 生效；`servantId` / `shopId` 字段保留以兼容请求体形状，
/// 但被服务层忽略。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ServantModifyStatusDTO {
    /// 目标状态（1 在线 / 2 忙 / 3 离开……，与 `im_servant.status` 一致）。
    pub status: Option<i32>,
    /// 客服 ID（Java 请求体字段，服务端被登录态覆盖，不使用）。
    pub servant_id: Option<i32>,
    /// 店铺 ID（Java 请求体字段，服务端被请求头覆盖，不使用）。
    pub shop_id: Option<i32>,
}

/// 客服 VO（对应 Java `ImServantVO`）。
///
/// `add_time` / `last_update_time` 为 `handelTime` 格式化后的字符串
/// （`"yyyy-MM-dd HH:mm:ss"`，`0` / `null` → 空串）。
/// `getStatus` 场景 Java 仅回填 `servantId` / `status` / `lastUpdateTime` /
/// `shopId`，其余字段保持 `null`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImServantVO {
    pub id: Option<i32>,
    pub servant_id: Option<i32>,
    /// 最后更新时间（格式化字符串）。
    pub last_update_time: Option<String>,
    /// 添加时间（格式化字符串）。
    pub add_time: Option<String>,
    pub status: Option<i32>,
    pub shop_id: Option<i32>,
    /// 当前会话数量（Java `Long`）。
    pub conversation_num: Option<i64>,
    /// 用户信息（列表场景回填；未匹配到管理员时为 `null`）。
    pub user: Option<ImServantUserVO>,
}

/// 客服关联的后台用户（对应 Java `ImServantVO.UserVO`）。
///
/// Java 用 `BeanUtils.copyProperties(AdminUser, UserVO)` 拷贝
/// `adminId` / `username` / `avatar` 三个同名字段。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ImServantUserVO {
    pub admin_id: Option<i32>,
    pub username: Option<String>,
    pub avatar: Option<String>,
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`）。
///
/// Java：`time == null || time == 0` → 空串；否则按**本地时区**格式化
/// `new Date(time * 1000L)`。实体里的时间是 `Option<i32>`（秒），故入参取
/// `Option<i32>`，`None` 与 `Some(0)` 同样返回空串。
#[must_use]
pub fn handel_time(secs: Option<i32>) -> String {
    match secs {
        None | Some(0) => String::new(),
        Some(v) => {
            use chrono::{LocalResult, TimeZone};
            match chrono::Local.timestamp_opt(i64::from(v), 0) {
                LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
                _ => String::new(),
            }
        }
    }
}

/// 由 `im_servant` 行构造列表 VO（对应 Java `list` 里的
/// `BeanUtils.copyProperties(imServant, vo)` + 时间格式化 + 用户回填）。
///
/// `user` 为 `None` 时（Java `servantMap.get(...) == null`）VO 的 `user`
/// 字段序列化为 `null`。
#[must_use]
pub fn servant_vo(
    id: i32,
    servant_id: Option<i32>,
    status: Option<i32>,
    shop_id: Option<i32>,
    conversation_num: Option<i32>,
    add_time: Option<i32>,
    last_update_time: Option<i32>,
    user: Option<ImServantUserVO>,
) -> ImServantVO {
    ImServantVO {
        id: Some(id),
        servant_id,
        // Java: setLastUpdateTime(handelTime(...)) —— 永远给字符串（空串也算命中）
        last_update_time: Some(handel_time(last_update_time)),
        add_time: Some(handel_time(add_time)),
        status,
        shop_id,
        conversation_num: conversation_num.map(i64::from),
        user,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_defaults_match_java_basepage() {
        // page 缺省 1，size 缺省 15
        assert_eq!(
            ImServantPage::from_query(None, None),
            ImServantPage { page: 1, size: 15 }
        );
        // size 上限 100
        assert_eq!(ImServantPage::from_query(Some(2), Some(500)).size, 100);
        // page < 1 夹到 1
        assert_eq!(ImServantPage::from_query(Some(0), Some(10)).page, 1);
        // size <= 0 夹到 1（与 Java 的差异见文档注释）
        assert_eq!(ImServantPage::from_query(Some(1), Some(0)).size, 1);
    }

    #[test]
    fn limit_offset_follows_page() {
        assert_eq!(ImServantPage { page: 1, size: 15 }.limit_offset(), (15, 0));
        assert_eq!(ImServantPage { page: 3, size: 15 }.limit_offset(), (15, 30));
    }

    #[test]
    fn total_page_ceil() {
        assert_eq!(ImServantPage::total_page(0, 15), 0);
        assert_eq!(ImServantPage::total_page(15, 15), 1);
        assert_eq!(ImServantPage::total_page(16, 15), 2);
    }

    #[test]
    fn scope_shop_id_semantics() {
        assert_eq!(ImServantScope::Shop(0).shop_id(), Some(0));
        assert_eq!(ImServantScope::Shop(9).shop_id(), Some(9));
        assert_eq!(ImServantScope::Unscoped.shop_id(), None);
        assert_eq!(
            ImServantScope::from_optional(None),
            ImServantScope::Unscoped
        );
        assert_eq!(
            ImServantScope::from_optional(Some(0)),
            ImServantScope::Shop(0)
        );
    }

    #[test]
    fn handel_time_zero_or_none_is_empty() {
        assert_eq!(handel_time(None), "");
        assert_eq!(handel_time(Some(0)), "");
        // 有效秒级时间戳 → 非空且形如 yyyy-MM-dd HH:mm:ss
        let s = handel_time(Some(1_700_000_000));
        assert_eq!(s.len(), 19);
        assert_eq!(&s[4..5], "-");
        assert_eq!(&s[13..14], ":");
    }

    #[test]
    fn vo_serializes_camelcase_and_null_user() {
        let vo = servant_vo(
            7,
            Some(3),
            Some(1),
            Some(0),
            Some(2),
            Some(0),
            Some(0),
            None,
        );
        let json = serde_json::to_value(&vo).unwrap();
        assert_eq!(json["id"], 7);
        assert_eq!(json["servantId"], 3);
        assert_eq!(json["conversationNum"], 2);
        // add_time / last_update_time 为 0 → 空串
        assert_eq!(json["addTime"], "");
        assert_eq!(json["lastUpdateTime"], "");
        assert!(json["user"].is_null());
        // 不应出现 snake_case 键
        assert!(json.get("servant_id").is_none());
    }
}
