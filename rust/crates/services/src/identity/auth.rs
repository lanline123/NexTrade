//! 认证服务：后台登录、令牌刷新、密码管理。
//! 对应原 Java `AdminUserServiceImpl.login` + Spring Security 过滤器链。

use std::sync::Arc;

use tigshop_common::config::JwtConfig;
use tigshop_core::entities::AdminUser;
use tigshop_core::models::{LoginDTO, LoginVO, MobileLoginDTO};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::cache::CacheService;
use tigshop_infrastructure::db::Repositories;
use tigshop_security::{hash_password, verify_password, JwtService};
use validator::Validate;

pub struct AuthService {
    repos: Arc<Repositories>,
    jwt: Arc<JwtService>,
    jwt_cfg: JwtConfig,
    cache: Option<CacheService>,
}

impl AuthService {
    pub fn new(
        repos: Arc<Repositories>,
        jwt: Arc<JwtService>,
        jwt_cfg: JwtConfig,
        cache: Option<CacheService>,
    ) -> Self {
        Self {
            repos,
            jwt,
            jwt_cfg,
            cache,
        }
    }

    /// 后台登录：校验参数 → 查用户 → 校验密码 → 签发令牌。
    pub async fn login(&self, dto: &LoginDTO, client_ip: &str) -> Result<LoginVO> {
        dto.validate()
            .map_err(|e| Error::Validation(e.to_string()))?;

        // 失败次数达到阈值时要求滑块验证码（Java `CaptchaHandler` + `ERROR_THRESHOLD`）
        crate::system::captcha::validate_login_captcha(
            &dto.username,
            dto.captcha_verification.as_deref(),
        )?;

        let user = self
            .repos
            .identity
            .auth
            .find_by_username(&dto.username)
            .await?
            .ok_or_else(|| Error::biz(400, "用户名或密码错误"))?;

        if !user.is_active_admin() {
            return Err(Error::biz(403, "账号已被停用"));
        }

        let hash = user.password.as_str();
        if !verify_password(&dto.password, hash)? {
            let count = crate::system::captcha::increment_login_error(&dto.username);
            tracing::warn!(
                "登录失败: username={}, ip={}, fail_count={}",
                dto.username,
                client_ip,
                count
            );
            return Err(Error::biz(400, "用户名或密码错误"));
        }
        crate::system::captcha::reset_login_error(&dto.username);

        self.issue_for_user(&user, client_ip).await
    }

    /// 后台手机验证码登录。
    ///
    /// 验证码由 `POST /adminapi/login/sendMobileCode` 写入缓存
    /// `login + mobile`，与 Java `SmsCodeAuthenticationProvider` 一致。
    pub async fn login_mobile(&self, dto: &MobileLoginDTO, client_ip: &str) -> Result<LoginVO> {
        dto.validate()
            .map_err(|e| Error::Validation(e.to_string()))?;

        let mobile = dto.mobile.trim();
        let code = dto.mobile_code.trim();
        if mobile.is_empty() || code.is_empty() {
            return Err(Error::biz(400, "手机号或验证码不能为空"));
        }

        let cache = self
            .cache
            .as_ref()
            .ok_or_else(|| Error::biz(1001, "验证码服务不可用，请稍后重试"))?;
        let key = format!("login{mobile}");
        let expected: Option<String> = cache.get_json(&key).await?;
        if expected.as_deref().map(str::trim) != Some(code) {
            return Err(Error::biz(400, "验证码错误或已过期"));
        }

        let user = self
            .repos
            .identity
            .auth
            .find_by_mobile(mobile)
            .await?
            .ok_or_else(|| Error::biz(400, "该手机号未绑定后台账号"))?;

        if !user.is_active_admin() {
            return Err(Error::biz(403, "账号已被停用"));
        }

        // 验证码一次性使用
        let _ = cache.del(&key).await;
        self.issue_for_user(&user, client_ip).await
    }

    /// 登录成功后统一签发令牌、写登录日志。
    async fn issue_for_user(&self, user: &AdminUser, _client_ip: &str) -> Result<LoginVO> {
        let scoped_shop_id = if user.shop_id > 0 {
            Some(user.shop_id)
        } else {
            None
        };
        // 供应商/供货商账号的租户 ID 存在 admin_user.suppliers_id；店铺账号存 shop_id。
        let scoped_vendor_id = match user.admin_type.as_str() {
            "vendor" | "suppliers" if user.suppliers_id > 0 => Some(user.suppliers_id),
            _ => None,
        };

        let (access, refresh, expires_in) = self.jwt.issue_pair_with_tenant(
            user.admin_id.to_string(),
            user.username.clone(),
            Some(user.role_id),
            Some(user.admin_type.clone()),
            scoped_shop_id,
            scoped_vendor_id,
        )?;

        let log_info = format!("管理员登录:{}", user.username);
        let admin_log = crate::identity::admin_log::AdminLogService::new(self.repos.clone());
        let (scope_type, scope_id) = if user.admin_type == "shop" && user.shop_id > 0 {
            ("shop", user.shop_id)
        } else {
            ("admin", 0)
        };
        let _ = admin_log
            .record_log(user.admin_id, scope_type, scope_id, &log_info, None, None)
            .await;

        tracing::info!(
            "管理员登录成功: {} ({}, shop_id={:?})",
            user.username,
            user.admin_id,
            scoped_shop_id
        );

        Ok(LoginVO {
            token: access.clone(),
            admin_type: Some(user.admin_type.clone()),
            access_token: access,
            refresh_token: refresh,
            token_type: "Bearer".into(),
            expires_in,
            admin_id: user.admin_id,
            username: user.username.clone(),
        })
    }

    /// 刷新访问令牌：校验刷新令牌 → 重新签发。
    pub fn refresh(&self, refresh_token: &str) -> Result<LoginVO> {
        let claims = self.jwt.decode(refresh_token)?;
        if claims.ttype != tigshop_security::jwt::TokenType::Refresh {
            return Err(Error::Unauthorized("需要刷新令牌".into()));
        }
        let (access, refresh, expires_in) = self.jwt.issue_pair_with_tenant(
            claims.sub.clone(),
            claims.usr.clone(),
            claims.role,
            claims.typ.clone(),
            claims.shop_id,
            claims.vendor_id,
        )?;
        Ok(LoginVO {
            token: access.clone(),
            admin_type: claims.typ.clone(),
            access_token: access,
            refresh_token: refresh,
            token_type: "Bearer".into(),
            expires_in,
            admin_id: claims.sub.parse().unwrap_or_default(),
            username: claims.usr,
        })
    }

    /// 修改密码（校验旧密码）。
    pub async fn change_password(
        &self,
        admin_id: i32,
        old_password: &str,
        new_password: &str,
    ) -> Result<()> {
        if new_password.len() < 6 {
            return Err(Error::Validation("新密码长度不能少于6位".into()));
        }
        let user = self
            .repos
            .identity
            .auth
            .find_by_id(admin_id)
            .await?
            .ok_or_else(|| Error::NotFound("管理员不存在".into()))?;
        let hash = user.password.as_str();
        if !verify_password(old_password, hash)? {
            return Err(Error::biz(400, "原密码错误"));
        }
        let new_hash = hash_password(new_password)?;
        self.repos
            .identity
            .auth
            .update_password(admin_id, &new_hash)
            .await?;
        tracing::info!("管理员修改密码成功: {admin_id}");
        Ok(())
    }

    /// 根据访问令牌解析当前管理员（供中间件/handler 使用）。
    pub fn current_admin(&self, authorization: Option<&str>) -> Result<AdminUserClaims> {
        let claims = self.jwt.from_authorization(authorization)?;
        let admin_id = claims
            .sub
            .parse::<i32>()
            .map_err(|_| Error::Unauthorized("令牌主体无效".into()))?;
        Ok(AdminUserClaims {
            admin_id,
            username: claims.usr,
            role_id: claims.role,
            admin_type: claims.typ,
        })
    }

    /// 后台用户分页（管理后台列表）。
    pub async fn list_admin_users(
        &self,
        keyword: Option<&str>,
        admin_type: Option<&str>,
        page: &tigshop_core::types::PageQuery,
    ) -> Result<(u64, Vec<AdminUser>)> {
        let (size, _) = page.limit_offset();
        self.repos
            .identity
            .auth
            .paginate(keyword, admin_type, page.page, size)
            .await
    }

    /// JWT 配置（供上层注入）。
    pub fn jwt(&self) -> &JwtService {
        &self.jwt
    }

    #[allow(dead_code)]
    fn jwt_cfg(&self) -> &JwtConfig {
        &self.jwt_cfg
    }
}

/// 已认证的管理员身份。
#[derive(Debug, Clone)]
pub struct AdminUserClaims {
    pub admin_id: i32,
    pub username: String,
    pub role_id: Option<i32>,
    pub admin_type: Option<String>,
}
