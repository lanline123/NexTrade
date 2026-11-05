//! 会员管理域（member::user_manage）DTO / VO。
//!
//! 对应原 Java：
//! - `com.tigshop.adminapi.controller.user.UserController`（`@RequestMapping("/adminapi/user/user")`）
//! - `com.tigshop.bean.dto.user.UserDTO` / `UserListDTO` / `UserFundManagementDTO`
//! - `com.tigshop.bean.param.user.UserParam` / `UserBatchParam` / `SetAdminNoteParam`
//! - `com.tigshop.bean.query.user.UserFundDetailPageQuery`
//! - `com.tigshop.bean.vo.user.UserCreateVO` / `UserItemVO` / `UserMemberTagVO`
//!   / `UserImportSuccessListVO`
//! - `com.tigshop.bean.vo.finance.UserBalanceLogVO`
//! - `com.tigshop.bean.vo.user.UserPointsLogVO` / `UserGrowthPointsLogVO`
//! - `com.tigshop.bean.dto.common.OperateDTO` / `UpdateFieldDTO`
//!
//! JSON 字段名保持与原接口 camelCase 一致（serde `rename_all = "camelCase"`）。
//!
//! 文件命名沿用项目既有切片约定 `sliceNNN.rs`（与 `product_manage` / `order_admin` /
//! `brand` / `authority` 一致），因为 Rust 模块标识符不允许连字符，
//! `member::user_manage.rs` 无法用 `pub mod user_manage;` 声明。

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ————————————————————————— 常量 —————————————————————————

/// Java `BasePage` 缺省分页大小。
pub const DEFAULT_PAGE_SIZE: u64 = 15;
/// Java `BasePage` 的 `size` 上限（超过按 100 处理）。
pub const MAX_PAGE_SIZE: u64 = 100;

/// 来源标签「后台添加」（Java `FromTag.ADMIN_ADD`，`create` / 导入时强制写入）。
pub const FROM_TAG_ADMIN_ADD: i32 = 7;

/// 会员类型「会员」（Java `UserTypeEnum.MEMBER.getCode()`，`list` 的默认筛选值）。
pub const USER_TYPE_MEMBER: i32 = 0;

/// `updateField` 允许更新的字段白名单（Java `CheckFieldConstants.USER_FIELDS`，
/// `{"username", "nickname", "status"}`，已是数据库列名形式）。
pub const USER_COLUMN_FIELDS: &[&str] = &["username", "nickname", "status"];

/// 资金变动方向：增加（Java `typeBalance` / `typePoints` / `typeFrozenBalance` 的 1）。
pub const CHANGE_TYPE_INC: i32 = 1;
/// 资金变动方向：减少（Java 的 2）。
pub const CHANGE_TYPE_DEC: i32 = 2;

/// 来源标签中文名（Java `FromTag.getFromTagName`：1 公众号 / 2 小程序 / 3 H5 /
/// 4 PC / 5 Android / 6 IOS / 7 Admin / 8 APP；未知返回空串）。
#[must_use]
pub fn from_tag_name(code: i32) -> &'static str {
    match code {
        1 => "公众号",
        2 => "小程序",
        3 => "H5",
        4 => "PC",
        5 => "Android",
        6 => "IOS",
        7 => "Admin",
        8 => "APP",
        _ => "",
    }
}

// ————————————————————————— 查询 / 入参 —————————————————————————

/// 会员列表查询条件（Java `UserListDTO extends BasePage`）。
///
/// `UserListDTO` 构造器默认 `isPage = 0`、`fromTag = 0`，故 `fromTag`
/// 缺省为 0，而 Java 的 `fromTag > 0` 条件不成立 → 不按来源筛选。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserListQuery {
    /// 来源标签（`UserListDTO.fromTag`，缺省 0；`> 0` 才参与筛选）
    pub from_tag: Option<i32>,
    /// 会员等级
    pub rank_id: Option<i32>,
    /// 可用金额（严格大于）
    pub balance: Option<Decimal>,
    /// 积分大于
    pub points_gt: Option<Decimal>,
    /// 积分小于
    pub points_lt: Option<Decimal>,
    /// 会员类型（`null` 时按「会员」= 0 处理）
    pub user_type: Option<i32>,
    /// 是否分页（Java 中该字段未参与 SQL 构造，保留以兼容入参）
    pub is_page: Option<i32>,
    /// 标记
    pub mark: Option<i32>,
    /// 是否精确匹配
    pub is_exact: Option<bool>,
    /// 会员标签ID列表，筛选拥有这些标签的用户
    pub tag_ids: Option<Vec<i64>>,
    /// 标签匹配模式：0-满足任意一个(默认)，1-满足全部(包含即可)
    pub tag_match_mode: Option<i32>,
    /// 关键词
    pub keyword: Option<String>,
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<u64>,
    /// 排序字段（保留以兼容 `BasePage` 入参；Java `list` 未使用）
    pub sort_field: Option<String>,
    /// 排序方向（同上）
    pub sort_order: Option<String>,
}

impl UserListQuery {
    /// 归一化后的 `(page, size)`（Java `BasePage#getPage` / `#getSize`）。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// SQL `LIMIT` / `OFFSET`。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let (page, size) = self.page_params();
        (size, (page - 1) * size)
    }

    /// 实际参与筛选的会员类型（Java `dto.getUserType() == null ?
    /// UserTypeEnum.MEMBER.getCode() : dto.getUserType()`）。
    #[must_use]
    pub fn effective_user_type(&self) -> i32 {
        self.user_type.unwrap_or(USER_TYPE_MEMBER)
    }

    /// 标签筛选是否为「满足全部」模式（Java `Integer.valueOf(1).equals(tagMatchMode)`）。
    #[must_use]
    pub fn tag_match_all(&self) -> bool {
        self.tag_match_mode == Some(1)
    }

    /// 去重后的标签ID（空表表示不按标签筛选）。
    #[must_use]
    pub fn tag_ids(&self) -> Vec<i64> {
        let mut out: Vec<i64> = Vec::new();
        for id in self.tag_ids.iter().flatten() {
            if !out.contains(id) {
                out.push(*id);
            }
        }
        out
    }
}

/// 会员导入行（Java `UserImportExcelDTO`）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserImportRow {
    pub username: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub nickname: Option<String>,
    pub password: Option<String>,
    pub birthday: Option<String>,
    pub rank_id: Option<String>,
    pub balance: Option<String>,
    pub points: Option<String>,
    pub growth_points: Option<String>,
    pub remark: Option<String>,
}

/// 会员导入失败行（Java `UserImportErrorExcelVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserImportErrorVO {
    pub username: Option<String>,
    pub mobile: Option<String>,
    pub email: Option<String>,
    pub nickname: Option<String>,
    pub error_msg: String,
}

/// 会员导入成功行（Java `UserImportSuccessListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserImportSuccessVO {
    pub user_id: i32,
    pub username: String,
    pub mobile: String,
    pub email: String,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub rank_name: Option<String>,
}

/// 会员新增入参（Java `UserDTO`）。
///
/// 仅保留 `create` 链路真正会写入 `user` 表的字段；关联对象
/// （`fromTagName` / `rankName` / `userAddress` 等）为出参字段，不在此声明。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CreateUserParam {
    /// 用户名
    pub username: Option<String>,
    /// 头像URL
    pub avatar: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 手机号是否验证
    pub mobile_validated: Option<i32>,
    /// 邮箱
    pub email: Option<String>,
    /// 邮箱是否验证
    pub email_validated: Option<i32>,
    /// 昵称
    pub nickname: Option<String>,
    /// 密码（明文，落库前 bcrypt 加密）
    pub password: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 余额
    pub balance: Option<Decimal>,
    /// 冻结余额
    pub frozen_balance: Option<Decimal>,
    /// 积分
    pub points: Option<i32>,
    /// 成长积分
    pub growth_points: Option<i32>,
    /// 地址ID
    pub address_id: Option<i32>,
    /// 等级ID
    pub rank_id: Option<i32>,
    /// 推荐人用户ID
    pub referrer_user_id: Option<i32>,
    /// 来源标签（对应 Java `UserDTO.fromTag`，`Integer`）。
    ///
    /// 后台创建/批量导入路径恒为 `FromTag.ADMIN_ADD.getCode()`（= 7），
    /// 见同模块常量 [`FROM_TAG_ADMIN_ADD`] 与 Java `adminapi
    /// UserController#create`、`UserServiceImpl#batchImportUser`。
    /// `None` 时由写入方回退为该常量。
    pub from_tag: Option<i32>,
    /// 是否SVIP
    pub is_svip: Option<i32>,
    /// SVIP过期时间
    pub svip_expire_time: Option<i32>,
    /// 是否分销
    pub is_distribution: Option<i32>,
    /// 微信头像
    pub wechat_img: Option<String>,
    /// 是否企业认证
    pub is_company_auth: Option<i32>,
    /// 会员状态；1-正常，0-禁用
    pub status: Option<i32>,
    /// 会员类型：0会员，1游客
    pub user_type: Option<i32>,
    /// 管理员备注
    pub admin_note: Option<String>,
    /// 标记
    pub mark: Option<i32>,
}

/// 会员更新入参（Java `UserParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateUserParam {
    /// 用户ID
    pub user_id: Option<i32>,
    /// 用户名
    pub username: Option<String>,
    /// 头像URL
    pub avatar: Option<String>,
    /// 手机号
    pub mobile: Option<String>,
    /// 手机号是否验证
    pub mobile_validated: Option<i32>,
    /// 邮箱
    pub email: Option<String>,
    /// 邮箱是否验证
    pub email_validated: Option<i32>,
    /// 昵称
    pub nickname: Option<String>,
    /// 密码（明文，非空时重新加密）
    pub password: Option<String>,
    /// 旧密码（仅用于与 `password` 比对一致性）
    pub pwd_confirm: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 余额
    pub balance: Option<Decimal>,
    /// 冻结余额
    pub frozen_balance: Option<Decimal>,
    /// 积分
    pub points: Option<i32>,
    /// 成长积分
    pub growth_points: Option<i32>,
    /// 地址ID
    pub address_id: Option<i32>,
    /// 等级ID
    pub rank_id: Option<i32>,
    /// 推荐人用户ID
    pub referrer_user_id: Option<i32>,
    /// 来源标签（对应 Java `UserDTO.fromTag`，`Integer`）。
    ///
    /// 后台创建/批量导入路径恒为 `FromTag.ADMIN_ADD.getCode()`（= 7），
    /// 见同模块常量 [`FROM_TAG_ADMIN_ADD`] 与 Java `adminapi
    /// UserController#create`、`UserServiceImpl#batchImportUser`。
    /// `None` 时由写入方回退为该常量。
    pub from_tag: Option<i32>,
    /// 是否SVIP
    pub is_svip: Option<i32>,
    /// SVIP过期时间
    pub svip_expire_time: Option<i32>,
    /// 是否分销
    pub is_distribution: Option<i32>,
    /// 微信头像
    pub wechat_img: Option<String>,
    /// 是否企业认证
    pub is_company_auth: Option<i32>,
    /// 会员状态；1-正常，0-禁用
    pub status: Option<i32>,
    /// 管理员备注
    pub admin_note: Option<String>,
    /// 标记
    pub mark: Option<i32>,
}

/// 批量操作入参（Java `UserBatchParam extends BatchDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserBatchParam {
    /// 会员ID列表
    pub ids: Vec<i32>,
    /// 操作类型：`setRank` / `del` / `incrPoints` / `incrBalance`
    pub r#type: String,
    /// 值（`incrPoints` 使用；Java `BatchDTO.value` 为 `int`，缺省 0）
    pub value: Option<i32>,
    /// 等级id（`setRank` 使用）
    pub rank_id: Option<i32>,
    /// 增加的余额（`incrBalance` 使用）
    pub balance: Option<Decimal>,
    /// 数据（Java `BatchDTO.data`，本域未使用，保留以兼容入参）
    pub data: Option<serde_json::Value>,
}

/// 批量操作类型：设置等级。
pub const BATCH_SET_RANK: &str = "setRank";
/// 批量操作类型：删除。
pub const BATCH_DEL: &str = "del";
/// 批量操作类型：增加积分。
pub const BATCH_INCR_POINTS: &str = "incrPoints";
/// 批量操作类型：增加余额。
pub const BATCH_INCR_BALANCE: &str = "incrBalance";

/// 会员资金管理入参（Java `UserFundManagementDTO`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FundManagementParam {
    /// 用户ID（Java 未标 `@NotNull`，但缺失时 `getById(null)` 无法定位会员）
    pub id: Option<i32>,
    /// 变动说明
    pub change_desc: Option<String>,
    /// 金额类型：1 增加，2 减少
    pub type_balance: Option<i32>,
    /// 用户余额
    pub balance: Option<Decimal>,
    /// 冻结金额类型：1 冻结（可用→冻结），2 解冻（冻结→可用）
    pub type_frozen_balance: Option<i32>,
    /// 冻结金额
    pub frozen_balance: Option<Decimal>,
    /// 积分类型：1 增加，2 减少
    pub type_points: Option<i32>,
    /// 积分
    pub points: Option<i32>,
    /// 成长积分类型：1 增加，2 减少
    pub type_growth_points: Option<i32>,
    /// 成长积分
    pub growth_points: Option<i32>,
}

impl FundManagementParam {
    /// 校验入参（逐条对照 Java `UserFundManagementDTO#validParam`）。
    ///
    /// 返回中文错误文案与 Java 一致：
    /// - 变动说明为空 → 「请填写资金变动说明」
    /// - 四类变动全为空 → 「没有账户变动」
    /// - 金额为负 → 「{label}不能为负数」
    /// - 金额变动类型不是 1/2 → 「{label}变动类型错误」
    ///
    /// # Errors
    /// 上述任一校验不通过时返回 [`tigshop_core::Error::Biz`]（`code = 0`）。
    pub fn valid_param(&self) -> crate::Result<()> {
        use crate::Error;
        if self
            .change_desc
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .is_empty()
        {
            return Err(Error::biz_msg("请填写资金变动说明"));
        }
        if self.balance.is_none()
            && self.frozen_balance.is_none()
            && self.points.is_none()
            && self.growth_points.is_none()
        {
            return Err(Error::biz_msg("没有账户变动"));
        }
        Self::validate_amount(self.balance, self.type_balance, "余额")?;
        Self::validate_amount(self.frozen_balance, self.type_frozen_balance, "冻结金额")?;
        Ok(())
    }

    /// 金额（余额 / 冻结金额）的非负与类型校验。
    fn validate_amount(
        amount: Option<Decimal>,
        change_type: Option<i32>,
        label: &str,
    ) -> crate::Result<()> {
        use crate::Error;
        let Some(amount) = amount else {
            return Ok(());
        };
        if amount.is_sign_negative() {
            return Err(Error::biz_msg(format!("{label}不能为负数")));
        }
        if change_type != Some(CHANGE_TYPE_INC) && change_type != Some(CHANGE_TYPE_DEC) {
            return Err(Error::biz_msg(format!("{label}变动类型错误")));
        }
        Ok(())
    }

    /// 余额变动方向（`None` 表示本次不调整余额）。
    #[must_use]
    pub fn balance_change(&self) -> Option<(i32, Decimal)> {
        self.balance.map(|v| (self.type_balance.unwrap_or(0), v))
    }

    /// 冻结余额变动方向（`None` 表示本次不调整冻结余额）。
    #[must_use]
    pub fn frozen_change(&self) -> Option<(i32, Decimal)> {
        self.frozen_balance
            .map(|v| (self.type_frozen_balance.unwrap_or(0), v))
    }
}

/// 设置管理员备注入参（Java `SetAdminNoteParam`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SetAdminNoteParam {
    /// 用户ID
    pub user_id: Option<i32>,
    /// 用户ID列表(逗号分隔，如：1,2,3)
    pub user_ids: Option<String>,
    /// 管理员备注
    pub admin_note: Option<String>,
    /// 标记
    pub mark: Option<i32>,
}

impl SetAdminNoteParam {
    /// 解析逗号分隔的用户ID列表（对应 Java `Arrays.stream(userIds.split(","))`
    /// 的 `trim` + `filter(isNotBlank)` + `map(Integer::parseInt)`）。
    ///
    /// 与 Java 的差异：Java 遇到非数字会抛 `NumberFormatException`（500），
    /// 这里**跳过**无法解析的片段，避免后台一个笔误导致整批 500。
    ///
    /// # Errors
    /// `userIds` 拼接出的列表全部无法解析（且原串非空白）时返回参数错误。
    pub fn parsed_user_ids(&self) -> crate::Result<Vec<i32>> {
        let Some(raw) = self.user_ids.as_deref() else {
            return Ok(Vec::new());
        };
        if raw.trim().is_empty() {
            return Ok(Vec::new());
        }
        let mut out = Vec::new();
        let mut invalid = Vec::new();
        for part in raw.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            match part.parse::<i32>() {
                Ok(v) => out.push(v),
                Err(_) => invalid.push(part.to_string()),
            }
        }
        if !invalid.is_empty() {
            return Err(crate::Error::Validation(format!(
                "用户ID列表包含非法值: {}",
                invalid.join(",")
            )));
        }
        Ok(out)
    }
}

/// 会员资金明细分页查询（Java `UserFundDetailPageQuery extends BasePage`）。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserFundDetailQuery {
    /// 会员ID
    pub user_id: Option<i32>,
    /// 来源标签：3 成长值（`user_growth_points_log`）/ 4 积分（`user_points_log`）
    /// / 其他 余额（`user_balance_log`）
    pub from_tag: Option<i32>,
    /// 关键字（Java 该字段未参与 SQL 构造，保留以兼容入参）
    pub keyword: Option<String>,
    /// 当前页码（Java `BasePage.page`，缺省 1）
    pub page: Option<u64>,
    /// 分页大小（Java `BasePage.size`，缺省 15，上限 100）
    pub size: Option<u64>,
}

impl UserFundDetailQuery {
    /// 归一化后的 `(page, size)`。
    #[must_use]
    pub fn page_params(&self) -> (u64, u64) {
        let page = self.page.unwrap_or(1).max(1);
        let size = self
            .size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE);
        (page, size)
    }

    /// SQL `LIMIT` / `OFFSET`。
    #[must_use]
    pub fn limit_offset(&self) -> (u64, u64) {
        let (page, size) = self.page_params();
        (size, (page - 1) * size)
    }
}

/// 资金明细来源标签：成长积分。
pub const FUND_TAG_GROWTH: i32 = 3;
/// 资金明细来源标签：消费积分。
pub const FUND_TAG_POINTS: i32 = 4;

// ————————————————————————— 出参 —————————————————————————

/// 会员列表 / 详情条目（Java `UserDTO`）。
///
/// 与 Java 一致：`password` 恒为空串（Java `convertToDTO` 里
/// `userDTO.setPassword("")`），`password` 字段保留以维持响应结构。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserVO {
    /// 用户ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 头像URL（`user.avatar` 为空时取配置项「默认头像」；
    /// 配置服务未迁移，此处返回空串，见 `uncertain_points`）
    pub avatar: String,
    /// 手机号
    pub mobile: String,
    /// 手机号是否验证
    pub mobile_validated: i32,
    /// 邮箱
    pub email: String,
    /// 邮箱是否验证
    pub email_validated: i32,
    /// 昵称
    pub nickname: Option<String>,
    /// 密码（恒为空串）
    pub password: String,
    /// 旧密码（Java `UserDTO.pwdConfirm`，查询链路恒为 null）
    pub pwd_confirm: Option<String>,
    /// 生日
    pub birthday: Option<String>,
    /// 余额
    pub balance: Decimal,
    /// 冻结余额
    pub frozen_balance: Decimal,
    /// 积分
    pub points: i32,
    /// 成长积分
    pub growth_points: i32,
    /// 地址ID
    pub address_id: i32,
    /// 注册时间（`yyyy-MM-dd HH:mm:ss`，由 `reg_time` 秒级时间戳格式化）
    pub reg_time: String,
    /// 最后登录时间
    pub last_login: i32,
    /// 最后登录IP
    pub last_ip: String,
    /// 等级ID
    pub rank_id: i32,
    /// 推荐人用户ID
    pub referrer_user_id: i32,
    /// 来源标签
    pub from_tag: i32,
    /// 来源标签名称
    pub from_tag_name: String,
    /// 是否SVIP
    pub is_svip: Option<i32>,
    /// SVIP过期时间
    pub svip_expire_time: Option<i32>,
    /// 订单数量（重新按「已支付」订单统计；无已支付订单时保留 `user.order_count`）
    pub order_count: i32,
    /// 订单金额（已支付订单 `total_amount` 求和；无已支付订单时保留 `user.order_amount`）
    pub order_amount: String,
    /// 历史产品ID列表
    pub history_product_ids: Option<String>,
    /// 是否分销
    pub is_distribution: Option<i32>,
    /// 分销注册时间
    pub distribution_register_time: Option<i32>,
    /// 微信头像
    pub wechat_img: String,
    /// 是否企业认证
    pub is_company_auth: i32,
    /// 等级名称
    pub rank_name: Option<String>,
    /// 等级图标
    pub rank_ico: Option<String>,
    /// 会员图标
    pub rank_logo: Option<String>,
    /// 折扣
    pub discount: Option<String>,
    /// 用户地址（默认地址优先）
    pub user_address: Option<UserAddressVO>,
    /// 会员类型：0会员，1游客
    pub user_type: Option<i32>,
    /// 管理员备注
    pub admin_note: String,
    /// 标记
    pub mark: i32,
    /// 会员状态；1-正常，0-禁用
    pub status: Option<i32>,
}

/// 会员详情（Java `UserItemVO`）。
///
/// Java 中 `UserItemVO` 是 `UserDTO` 的字段拷贝 + `memberTags`；
/// 这里用 `#[serde(flatten)]` 复刻「同一层平铺」的 JSON 结构
/// （`UserVO` 自身已按 camelCase 序列化，故外层不再叠加 `rename_all`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserItemVO {
    /// 会员基础信息（平铺）
    #[serde(flatten)]
    pub user: UserVO,
    /// 会员标签列表（Java `UserItemVO.memberTags`）
    pub member_tags: Vec<UserMemberTagVO>,
}

/// 用户会员标签（Java `UserMemberTagVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserMemberTagVO {
    /// 标签ID
    pub tag_id: i64,
    /// 标签名称
    pub tag_name: Option<String>,
    /// 标签组ID
    pub group_id: Option<i64>,
    /// 标签组名称
    pub group_name: Option<String>,
    /// 打标时间（Java 为 `String`，取 `user_member_tag.create_time`，
    /// **不**做时间格式化，直接 `toString()`）
    pub create_time: Option<String>,
}

/// 收货地址视图（Java `UserAddressVO`，仅本域用到的字段）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserAddressVO {
    /// 用户地址
    pub address: String,
    /// 定位地址
    pub position_address: Option<String>,
    /// 用户地址id
    pub address_id: i32,
    /// 收货人名称
    pub consignee: String,
    /// 邮箱
    pub email: Option<String>,
    /// 是否默认
    pub is_default: i32,
    /// 是否选中
    pub is_selected: i32,
    /// 手机号
    pub mobile: String,
    /// 区号
    pub mobile_area_code: Option<String>,
    /// 地区（拼接后的中文名）
    pub region_name: String,
    /// 地区列表
    pub region_names: Vec<String>,
    /// 固定电话
    pub telephone: Option<String>,
    /// 用户id
    pub user_id: i32,
    /// 地区id列表
    pub region_ids: Vec<i32>,
    /// 收货人的邮编
    pub postcode: Option<String>,
    /// 收货地址别名
    pub address_tag: String,
    /// 纬度
    pub latitude: Option<Decimal>,
    /// 经度
    pub longitude: Option<Decimal>,
    /// 是否是系统添加
    pub is_system: Option<i32>,
}

/// 创建会员返回（Java `UserCreateVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserCreateVO {
    /// 用户ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 手机号
    pub mobile: String,
}

/// 会员批量导入成功条目（Java `UserImportSuccessListVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserImportSuccessListVO {
    /// 会员ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 手机号
    pub mobile: String,
    /// 邮箱
    pub email: String,
    /// 昵称
    pub nickname: Option<String>,
    /// 会员等级名称
    pub rank_name: Option<String>,
    /// 头像
    pub avatar: String,
}

/// 会员搜索命中结果（Java `SalesmanServiceImpl#getUserByMobileOrUsername`
/// 返回的 `UserDTO`）。
///
/// 说明：原 Java 控制器 `searchByMobile` 声明返回 `void`，故实际响应体恒为
/// `null`；Rust 侧回传命中结果（空对象表示未命中）便于前端使用，
/// 详见 `uncertain_points`。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserSearchVO {
    /// 用户ID
    pub user_id: i32,
    /// 用户名
    pub username: String,
    /// 手机号
    pub mobile: String,
    /// 邮箱
    pub email: String,
    /// 昵称
    pub nickname: Option<String>,
    /// 头像
    pub avatar: String,
    /// 等级ID
    pub rank_id: i32,
    /// 来源标签
    pub from_tag: i32,
    /// 会员状态
    pub status: Option<i32>,
}

/// 资金明细：消费积分日志（Java `UserPointsLogVO`）。
///
/// Java 的 `changeTime` 为 `String.valueOf(changeTime)`（**秒级时间戳原文**，
/// 不做 `yyyy-MM-dd HH:mm:ss` 转换），此处保持一致。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserPointsLogVO {
    /// 积分id
    pub log_id: i32,
    /// 用户id
    pub user_id: i32,
    /// 增加或减少的消费积分
    pub points: i32,
    /// 该操作发生的时间（秒级时间戳字符串）
    pub change_time: String,
    /// 该操作的备注
    pub change_desc: String,
    /// 增加还是减少
    pub change_type: i32,
    /// 类型文案（1 增加 / 2 减少 / 99 其他 / 其他 未知）
    pub change_type_name: String,
}

/// 资金明细：成长值日志（Java `UserGrowthPointsLogVO`）。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserGrowthPointsLogVO {
    /// 成长值日志ID
    pub log_id: i32,
    /// 用户ID
    pub user_id: i32,
    /// 增加或减少的成长值
    pub points: i32,
    /// 该操作发生的时间（`yyyy-MM-dd HH:mm:ss`）
    pub change_time: String,
    /// 该操作的备注
    pub change_desc: String,
    /// 类型，1：增加，2：减少
    pub change_type: i32,
    /// 类型文案
    pub change_type_name: String,
}

/// 资金明细：余额日志（Java `UserBalanceLogVO`）。
///
/// 逐条对齐 Java 构造器：
/// - `changeTime` 走 `TigUtils.handelTime`（`yyyy-MM-dd HH:mm:ss`）
/// - `changeTypeName` 1 增加 / 2 减少 / 99 其他 / 其他 未知
/// - `beforeFrozenBalance` 由「当前冻结余额」反推：
///   `changeType == 1 ? current - frozenBalance : current + frozenBalance`，
///   并 `setScale(2, HALF_UP)`
/// - `afterBalance` / `afterFrozenBalance` / `username` **不赋值**（Java 未 set）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UserBalanceLogVO {
    /// 余额ID
    pub log_id: i32,
    /// 用户ID
    pub user_id: i32,
    /// 用户名称（Java 未赋值 → null）
    pub username: Option<String>,
    /// 增加或减少的余额
    pub balance: Decimal,
    /// 增加或减少之前的余额
    pub before_balance: Decimal,
    /// 增加或减少之后的余额（Java 未赋值 → null）
    pub after_balance: Option<Decimal>,
    /// 被冻结的余额
    pub frozen_balance: Decimal,
    /// 增加或减少之前的被冻结的余额
    pub before_frozen_balance: Decimal,
    /// 增加或减少之后的被冻结的余额（Java 未赋值 → null）
    pub after_frozen_balance: Option<Decimal>,
    /// 该笔操作发生的时间（`yyyy-MM-dd HH:mm:ss`）
    pub change_time: String,
    /// 该笔操作的备注
    pub change_desc: String,
    /// 类型，1：增加，2：减少
    pub change_type: i32,
    /// 类型文案
    pub change_type_name: String,
}

/// 资金明细统一返回（Java `Page<?>`，按 `fromTag` 分支的实际类型）。
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum FundDetailItem {
    /// `fromTag = 3`：成长值日志
    Growth(UserGrowthPointsLogVO),
    /// `fromTag = 4`：消费积分日志
    Points(UserPointsLogVO),
    /// 其他：余额日志
    Balance(UserBalanceLogVO),
}

/// 变动类型中文文案（Java `UserBalanceLogVO` / `UserPointsLogVO` /
/// `UserGrowthPointsLogVO` 构造器中的同一 switch）。
#[must_use]
pub fn change_type_name(change_type: i32) -> &'static str {
    match change_type {
        1 => "增加",
        2 => "减少",
        99 => "其他",
        _ => "未知",
    }
}

/// 秒级时间戳 → `yyyy-MM-dd HH:mm:ss`（Java `TigUtils.handelTime`：
/// 0 或负数返回空串）。
#[must_use]
pub fn fmt_time(secs: i32) -> String {
    if secs <= 0 {
        return String::new();
    }
    use chrono::TimeZone;
    match chrono::Local.timestamp_opt(i64::from(secs), 0) {
        chrono::LocalResult::Single(dt) => dt.format("%Y-%m-%d %H:%M:%S").to_string(),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_tag_names_match_java_enum() {
        assert_eq!(from_tag_name(1), "公众号");
        assert_eq!(from_tag_name(2), "小程序");
        assert_eq!(from_tag_name(3), "H5");
        assert_eq!(from_tag_name(4), "PC");
        assert_eq!(from_tag_name(5), "Android");
        assert_eq!(from_tag_name(6), "IOS");
        assert_eq!(from_tag_name(7), "Admin");
        assert_eq!(from_tag_name(8), "APP");
        // Java 未命中时返回空串（不是 panic）
        assert_eq!(from_tag_name(0), "");
        assert_eq!(from_tag_name(99), "");
    }

    #[test]
    fn fmt_time_handles_zero_and_positive() {
        assert_eq!(fmt_time(0), "");
        assert_eq!(fmt_time(-1), "");
        assert_eq!(fmt_time(1_700_000_000).len(), 19);
    }

    #[test]
    fn user_list_query_json_uses_camel_case() {
        let q: UserListQuery = serde_json::from_str(
            r#"{"fromTag":7,"rankId":2,"balance":"5.00","pointsGt":"1","pointsLt":"9",
                "userType":0,"isPage":1,"mark":2,"isExact":true,"tagIds":[1,2],
                "tagMatchMode":1,"keyword":"abc","page":2,"size":30}"#,
        )
        .unwrap();
        assert_eq!(q.from_tag, Some(7));
        assert_eq!(q.rank_id, Some(2));
        assert_eq!(q.balance, Some(Decimal::new(500, 2)));
        assert_eq!(q.points_gt, Some(Decimal::new(1, 0)));
        assert_eq!(q.points_lt, Some(Decimal::new(9, 0)));
        assert_eq!(q.user_type, Some(0));
        assert_eq!(q.is_page, Some(1));
        assert_eq!(q.mark, Some(2));
        assert_eq!(q.is_exact, Some(true));
        assert_eq!(q.tag_ids, Some(vec![1, 2]));
        assert_eq!(q.tag_match_mode, Some(1));
        assert_eq!(q.keyword.as_deref(), Some("abc"));
        assert_eq!(q.page, Some(2));
        assert_eq!(q.size, Some(30));
    }

    #[test]
    fn user_item_vo_flattens_member_fields() {
        let vo = UserItemVO {
            user: UserVO {
                user_id: 7,
                username: "alice".into(),
                from_tag: 7,
                from_tag_name: "Admin".into(),
                ..Default::default()
            },
            member_tags: vec![UserMemberTagVO {
                tag_id: 3,
                tag_name: Some("VIP".into()),
                group_id: Some(1),
                group_name: Some("分组".into()),
                create_time: Some("1700000000".into()),
            }],
        };
        let v = serde_json::to_value(&vo).unwrap();
        // 会员字段与 memberTags 必须在同一层平铺（对应 Java `UserItemVO`）
        assert_eq!(v["userId"], 7);
        assert_eq!(v["username"], "alice");
        assert_eq!(v["fromTagName"], "Admin");
        // `UserItemVO` 自身未加 `rename_all`（内层 `UserVO` 已 camelCase），
        // 故此处键名是 snake_case 的 `member_tags`。
        assert_eq!(v["member_tags"][0]["tagName"], "VIP");
        assert_eq!(v["member_tags"][0]["groupId"], 1);
        // 不应出现把整个 UserVO 包一层的键
        assert!(v.get("user").is_none());
    }

    #[test]
    fn fund_detail_item_serializes_untagged() {
        let growth = FundDetailItem::Growth(UserGrowthPointsLogVO {
            log_id: 1,
            user_id: 2,
            points: 5,
            change_time: "2026-01-01 00:00:00".into(),
            change_desc: "增加".into(),
            change_type: 1,
            change_type_name: "增加".into(),
        });
        let v = serde_json::to_value(&growth).unwrap();
        // 无 tag：直接输出字段，且不出现变体名
        assert_eq!(v["logId"], 1);
        assert_eq!(v["changeTypeName"], "增加");
        assert!(v.get("Growth").is_none());

        let balance = FundDetailItem::Balance(UserBalanceLogVO {
            log_id: 9,
            user_id: 2,
            balance: Decimal::new(500, 2),
            ..Default::default()
        });
        let v = serde_json::to_value(&balance).unwrap();
        assert_eq!(v["logId"], 9);
        assert_eq!(v["userId"], 2);
        // Java 未赋值的字段序列化为 null
        assert!(v["afterBalance"].is_null());
        assert!(v["username"].is_null());
        assert!(v["afterFrozenBalance"].is_null());
    }

    #[test]
    fn change_type_name_matches_java_switch() {
        assert_eq!(change_type_name(1), "增加");
        assert_eq!(change_type_name(2), "减少");
        assert_eq!(change_type_name(99), "其他");
        assert_eq!(change_type_name(0), "未知");
    }

    #[test]
    fn fund_management_param_validation_matches_java() {
        // 说明为空
        let p = FundManagementParam {
            change_desc: Some(" ".into()),
            balance: Some(Decimal::ONE),
            type_balance: Some(CHANGE_TYPE_INC),
            ..Default::default()
        };
        assert!(p.valid_param().is_err());

        // 无任何变动
        let p = FundManagementParam {
            change_desc: Some("x".into()),
            ..Default::default()
        };
        assert!(p.valid_param().is_err());

        // 金额为负
        let p = FundManagementParam {
            change_desc: Some("x".into()),
            balance: Some(Decimal::NEGATIVE_ONE),
            type_balance: Some(CHANGE_TYPE_INC),
            ..Default::default()
        };
        assert!(p.valid_param().is_err());

        // 变动类型错误（既不是 1 也不是 2）
        let p = FundManagementParam {
            change_desc: Some("x".into()),
            frozen_balance: Some(Decimal::ONE),
            type_frozen_balance: Some(3),
            ..Default::default()
        };
        assert!(p.valid_param().is_err());

        // 仅积分也能通过（金额类型校验跳过）
        let p = FundManagementParam {
            change_desc: Some("x".into()),
            points: Some(1),
            ..Default::default()
        };
        assert!(p.valid_param().is_ok());
    }

    #[test]
    fn set_admin_note_parses_ids_and_rejects_garbage() {
        let p = SetAdminNoteParam {
            user_ids: Some(" 1, 2 ,3 ".into()),
            ..Default::default()
        };
        assert_eq!(p.parsed_user_ids().unwrap(), vec![1, 2, 3]);

        let p = SetAdminNoteParam {
            user_ids: Some("1,abc".into()),
            ..Default::default()
        };
        assert!(p.parsed_user_ids().is_err());

        let p = SetAdminNoteParam {
            user_ids: Some("  ".into()),
            ..Default::default()
        };
        assert!(p.parsed_user_ids().unwrap().is_empty());
    }

    #[test]
    fn user_list_query_defaults_follow_base_page() {
        let q = UserListQuery::default();
        assert_eq!(q.page_params(), (1, DEFAULT_PAGE_SIZE));
        assert_eq!(q.effective_user_type(), USER_TYPE_MEMBER);
        assert!(!q.tag_match_all());
        assert!(q.tag_ids().is_empty());
    }
}
