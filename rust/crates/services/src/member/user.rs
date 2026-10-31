//! 会员用户服务：注册、登录、资料、余额操作。
//! 对应原 Java `UserServiceImpl`。

use rust_decimal::Decimal;
use std::sync::Arc;

use tigshop_core::entities::User;
use tigshop_core::{Error, Result};
use tigshop_infrastructure::db::Repositories;
use tigshop_security::{hash_password, verify_password};

pub struct UserService {
    repos: Arc<Repositories>,
}

impl UserService {
    pub fn new(repos: Arc<Repositories>) -> Self {
        Self { repos }
    }

    /// 按 ID 查询会员。
    pub async fn find(&self, user_id: i32) -> Result<Option<User>> {
        self.repos.member.user.find_by_id(user_id).await
    }

    /// 手机号注册（密码 BCrypt 存储，与原 Java 兼容）。
    pub async fn register(&self, mobile: &str, password: &str, nickname: Option<&str>) -> Result<i32> {
        if mobile.len() < 6 {
            return Err(Error::Validation("手机号格式错误".into()));
        }
        if password.len() < 6 {
            return Err(Error::Validation("密码长度不能少于6位".into()));
        }
        if self.repos.member.user.find_by_mobile(mobile).await?.is_some() {
            return Err(Error::biz(400, "该手机号已注册"));
        }
        let hash = hash_password(password)?;
        let user = User {
            username: mobile.to_string(),
            mobile: mobile.to_string(),
            nickname: nickname.map(String::from),
            password: hash,
            status: Some(1),
            mobile_validated: 1,
            // reg_time 为 int unsigned 秒级时间戳（非毫秒）
            reg_time: tigshop_common::utils::now_seconds() as i32,
            balance: Decimal::ZERO,
            points: 0,
            order_count: 0,
            ..Default::default()
        };
        self.repos.member.user.insert(&user).await
    }

    /// 手机号+密码登录。
    pub async fn login(&self, mobile: &str, password: &str) -> Result<User> {
        // 前端登录框既可能是手机号也可能是用户名：先按手机号，再按用户名兜底。
        let user = match self.repos.member.user.find_by_mobile(mobile).await? {
            Some(user) => Some(user),
            None => self.repos.member.user.find_by_username(mobile).await?,
        }
        .ok_or_else(|| Error::biz(400, "手机号或密码错误"))?;
        if !user.can_login() {
            return Err(Error::biz(403, "账号已被禁用"));
        }
        // password 为 NOT NULL 裸 String，无需 Option 解包
        let hash = user.password.as_str();
        if !verify_password(password, hash)? {
            return Err(Error::biz(400, "手机号或密码错误"));
        }
        Ok(user)
    }

    /// 修改资料（昵称/头像）。
    pub async fn update_profile(&self, user_id: i32, nickname: Option<&str>, avatar: Option<&str>) -> Result<()> {
        self.repos.member.user.update_profile(user_id, nickname, avatar).await
    }

    /// 余额入账（充值/退款），带非负约束。
    pub async fn credit_balance(&self, user_id: i32, amount: Decimal) -> Result<()> {
        if amount <= Decimal::ZERO {
            return Err(Error::Validation("入账金额必须大于0".into()));
        }
        self.repos.member.user.adjust_balance(user_id, amount).await
    }

    /// 余额出账（下单支付），余额不足返回错误。
    pub async fn debit_balance(&self, user_id: i32, amount: Decimal) -> Result<()> {
        if amount <= Decimal::ZERO {
            return Err(Error::Validation("扣款金额必须大于0".into()));
        }
        let affected = self
            .repos.member.user
            .try_debit_balance(user_id, amount)
            .await?;
        if !affected {
            return Err(Error::biz(400, "余额不足"));
        }
        Ok(())
    }
}