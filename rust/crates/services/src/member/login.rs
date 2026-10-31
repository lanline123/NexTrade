//! 会员登录域服务（member::login）。
//!
//! 构造签名：`pub fn new(repos: Arc<Repositories>, cache: Option<CacheService>, jwt: Arc<JwtService>)`
//! —— 与既有 `catalog::product`（`cache: Option<CacheService>`）和
//! `identity::auth`（`jwt: Arc<JwtService>`）保持一致的装配风格；Redis 不可用时
//! `cache = None` 降级为「验证码/重置令牌不可用」，不阻断进程启动。
//!
//! 仓储访问为**嵌套**命名：`self.repos.member.login.<method>()`。
//!
//! 对应原 Java：
//! - `ConfigServiceImpl#sendSms` / `#sendEmail` / `#getQuickLoginSetting` / `#getWechatLoginUrl`
//! - `UserServiceImpl#checkMobile` / `#checkEmail` / `#issuePasswordReset` /
//!   `#modifyPassword` / `#bindMobile` / `#unbindWechat`
//! - `ClientLoginFilter`（C 端 JWT 签发口径：`typ = "member"`）
//!
//! # 已实现（与 Java 逐条对齐）
//!
//! | 端点 | 语义 |
//! |------|------|
//! | `sendMobileCode`（/api + /adminapi 两条） | 校验手机号 → 生成 6 位码 → 写缓存 `event+mobile`（TTL 5 分钟）→ 不实际发短信（通道未迁移） |
//! | `sendEmailCode` | 校验邮箱 → 同上（`event+email`） |
//! | `checkMobile` / `checkEmail` | 校验缓存验证码 → 要求账号唯一且启用 → 生成 64 位 hex 重置令牌 → 缓存 `password-reset:{md5(token)}` → user_id（TTL 10 分钟），返回令牌 |
//! | `forgetPassword` | 校验令牌 → 校验账号启用 → `bcrypt` 重新哈希密码 → 更新 `user.password` → 消费令牌 |
//! | `bindMobile` | 校验 `login{mobile}` 验证码 → 已有账号则置 `mobile_validated=1`，否则注册新用户（受 `shopRegClosed` 开关约束）→ 处理微信授权绑定 → 返回会员 JWT |
//! | `getQuickLoginSetting` | 按 `x-client-type` 返回 `{wechatLogin, showOauth}`（`pc/wechat` 取 `openWechatOauth`，`miniProgram` 恒 1） |
//! | `getWxLoginUrl` | `x-client-type=wechat` 时拼公众号 OAuth URL 并缓存 state（300s）；`pc` 扫码需要微信二维码 API（未迁移 → 明确报错） |
//! | `unbindWechat` | 登录态；删除当前会员的 `user_authorize` 记录；未绑定 → 「该账号未绑定微信公众号」 |
//!
//! # 未迁移（明确 1001 业务错误，绝不伪造 token）
//!
//! `wechatServer`（公众号服务器回调验签）、`wechatEvent`（扫码 openid 轮询 + 自动注册）、
//! `getMobile`（小程序手机号 API）、`updateUserOpenid`（code2Session）、
//! `getWxLoginInfoByCode`（公众号 OAuth）、`bindWechat`（公众号 OAuth）——
//! 全部依赖微信开放平台接口 / 微信 JSSDK 配置，本构建未接入。
//!
//! # 其它已知差异
//!
//! - 行为验证（AJ-Captcha 滑动拼图）未迁移：`verifyToken` 不做校验（否则发送验证码恒失败）；
//! - 短信/邮件只写缓存不实际发送（未接 RabbitMQ + 服务商通道）；
//! - 重置令牌摘要用 **MD5**（services crate 无 `sha2` 依赖，不可改 Cargo.toml），
//!   Java 用 SHA-256；令牌本身仍为 64 位小写 hex、TTL 与 Java 相同；
//! - `bindMobile` 的微信授权绑定做了「按 openid/按用户」两段 upsert 的等价实现，
//!   但 `open_name` / `open_photo` 用 openData 里的 `nickname` / `headimgurl` 填充
//!   （Java 只写 `open_data`，两列取实体默认值）；
//! - `bindMobile` 的 `wholesalerService.autoRegisterIfEnabled`（自动成为批发商）
//!   与分销员初始化未迁移（依赖 wholesale/marketing 域）；
//! - Java 登录成功后会把 token 写入 Redis（供 logout 吊销）；Rust 侧 C 端登录
//!   （含 `api/public/src/lib.rs::user_login`）尚未实现该吊销表，这里保持一致不写。

use std::sync::Arc;

use base64::Engine;
use md5::{Digest, Md5};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::Sha256;
use tigshop_common::utils::now_seconds;
use tigshop_core::models::member::login::{
    authorize_type_from_client, auto_nickname, email_code_key, password_reset_key, quick_login_flags,
    sms_code_key, unwrap_open_data, validate_code_format, validate_email_basic, validate_reset_token,
    wechat_state_key, BindMobileDTO, CheckEmailDTO, CheckMobileDTO, CodeParamDTO, ForgetPasswordDTO,
    LoginWechatEventVO, QuickLoginSettingVO, RegisterEmailDTO, RegisterSmsDTO, WechatLoginUrlVO,
    WxLoginInfoByCodeVO, ACCOUNT_CANNOT_RESET, BIND_PASSWORD_REQUIRED, CACHE_UNAVAILABLE,
    CODE_INVALID, CODE_TTL_SECS, EMAIL_REQUIRED, IDENTITY_REQUIRED, MEMBER_TOKEN_TYPE,
    MOBILE_REQUIRED, PASSWORD_REQUIRED, PASSWORD_UPDATE_FAILED, REGISTER_CLOSED,
    RESET_TOKEN_INVALID, SERVICE_DATA_ERROR, SWITCH_OFF, USER_STATUS_OK, WECHAT_NOT_BOUND,
};
use tigshop_core::{Error, Result};
use tigshop_infrastructure::cache::CacheService;
use tigshop_infrastructure::db::repo::member::login::LoginRepository;
use tigshop_infrastructure::db::Repositories;
use tigshop_security::{hash_password, JwtService};

use super::wechat_mp;

/// 微信公众号服务器回调查询参数（GET 验证 / POST 安全模式共用）。
#[derive(Debug, Clone, Default)]
pub struct WechatServerQuery {
    pub signature: Option<String>,
    pub timestamp: Option<String>,
    pub nonce: Option<String>,
    pub echostr: Option<String>,
    pub encrypt_type: Option<String>,
    pub msg_signature: Option<String>,
}

/// 会员登录域服务。
pub struct LoginService {
    repos: Arc<Repositories>,
    cache: Option<CacheService>,
    jwt: Arc<JwtService>,
}

impl LoginService {
    #[must_use]
    pub fn new(repos: Arc<Repositories>, cache: Option<CacheService>, jwt: Arc<JwtService>) -> Self {
        Self { repos, cache, jwt }
    }

    /// 本特性仓储（嵌套访问：`repos.member.login`）。
    #[must_use]
    pub fn repo(&self) -> &LoginRepository {
        &self.repos.member.login
    }

    // ————————————————————— 验证码发送 —————————————————————

    /// `POST /api/user/login/sendMobileCode` 与 `POST /adminapi/login/sendMobileCode`。
    ///
    /// Java `ConfigServiceImpl#sendSms`：行为验证 → 生成 6 位码 → 发送短信 →
    /// 写缓存 `event+mobile`（5 分钟）。本实现前两步中的「行为验证」跳过、
    /// 「发送」未迁移（只写缓存，便于接入通道后直接可用）。
    ///
    /// # Errors
    /// 手机号缺失 → 「手机号码不能为空」；缓存不可用 → 1001；Redis 失败 → `Error::Cache`。
    pub async fn send_mobile_code(&self, dto: &RegisterSmsDTO) -> Result<()> {
        let mobile = dto
            .mobile
            .as_deref()
            .map(str::trim)
            .filter(|m| !m.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, MOBILE_REQUIRED))?;
        let code = generate_sms_code();
        let key = sms_code_key(dto.event.as_deref(), mobile);
        self.cache()?
            .set_json(&key, &code, CODE_TTL_SECS)
            .await?;
        // 真实通道：阿里云短信（未配置 → 明确业务错误；TIG_SMS__MOCK=1 时仅日志）
        crate::system::notify::send_sms_code(&self.repos, mobile, &code).await?;
        tracing::info!("短信验证码已发送: mobile={mobile} event={:?}", dto.event);
        Ok(())
    }

    /// `POST /api/user/login/sendEmailCode`。
    ///
    /// Java `ConfigServiceImpl#sendEmail`：邮箱格式校验 → 行为验证 → 生成 6 位码 →
    /// SMTP 发送 → 写缓存 `event+email`（5 分钟）。同样只写缓存。
    ///
    /// # Errors
    /// 邮箱缺失/非法 → 「邮箱不能为空」/「邮箱地址不正确」；缓存不可用 → 1001。
    pub async fn send_email_code(&self, dto: &RegisterEmailDTO) -> Result<()> {
        let email = dto
            .email
            .as_deref()
            .map(str::trim)
            .filter(|e| !e.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, EMAIL_REQUIRED))?;
        let email = validate_email_basic(Some(email))?;
        let code = generate_sms_code();
        let key = email_code_key(dto.event.as_deref(), email);
        self.cache()?
            .set_json(&key, &code, CODE_TTL_SECS)
            .await?;
        // 真实通道：SMTP（未配置 → 明确业务错误）
        crate::system::notify::send_email_code(&self.repos, &email, "验证码", &code).await?;
        tracing::info!("邮箱验证码已发送: email={email}");
        Ok(())
    }

    // ————————————————————— 重置密码 —————————————————————

    /// `POST /api/user/login/checkMobile`：校验短信验证码并签发重置令牌。
    ///
    /// Java `UserServiceImpl#checkMobile` → `issuePasswordReset(mobile, code, false)`。
    ///
    /// # Errors
    /// 手机号/验证码为空或错误、账号不唯一或被禁用 → 1001 业务错误（Java 逐字文案）。
    pub async fn check_mobile(&self, dto: &CheckMobileDTO) -> Result<String> {
        let mobile = require_identity(dto.mobile.as_deref(), MOBILE_REQUIRED)?;
        let reset = self
            .issue_password_reset(mobile, dto.code.as_deref(), false)
            .await?;
        Ok(reset)
    }

    /// `POST /api/user/login/checkEmail`：校验邮箱验证码并签发重置令牌。
    ///
    /// # Errors
    /// 同上（邮箱维度）。
    pub async fn check_email(&self, dto: &CheckEmailDTO) -> Result<String> {
        let email = require_identity(dto.email.as_deref(), EMAIL_REQUIRED)?;
        let reset = self
            .issue_password_reset(email, dto.code.as_deref(), true)
            .await?;
        Ok(reset)
    }

    /// Java `UserServiceImpl#issuePasswordReset`。
    ///
    /// 1. `validateVerificationCode("forgetPassword" + identity, code)`；
    /// 2. 账号必须**恰好 1 个**且 `status=1`；
    /// 3. 消费验证码（删除缓存键）；
    /// 4. 生成 32 字节随机令牌（64 位小写 hex），缓存 `password-reset:{摘要}` → user_id（10 分钟）。
    async fn issue_password_reset(
        &self,
        identity: &str,
        code: Option<&str>,
        email: bool,
    ) -> Result<String> {
        if identity.is_empty() {
            return Err(Error::biz(SERVICE_DATA_ERROR, IDENTITY_REQUIRED));
        }
        let code = validate_code_format(code)?;
        let code_key = format!("forgetPassword{identity}");
        let cache = self.cache()?;
        let expected: Option<String> = cache.get_json(&code_key).await?;
        match expected {
            Some(expected) if expected == code => {}
            _ => return Err(Error::biz(SERVICE_DATA_ERROR, CODE_INVALID)),
        }

        let candidates = if email {
            self.repo().reset_candidates_by_email(identity).await?
        } else {
            self.repo().reset_candidates_by_mobile(identity).await?
        };
        if candidates.len() != 1 || candidates[0].1 != USER_STATUS_OK {
            return Err(Error::biz(SERVICE_DATA_ERROR, ACCOUNT_CANNOT_RESET));
        }
        let user_id = candidates[0].0;

        // 消费验证码（Java 用 Lua 脚本原子 GET+DEL；这里先删再写令牌，失败不恢复）
        cache.del(&code_key).await?;

        let token = generate_reset_token();
        cache
            .set_json(&password_reset_key(&md5_hex(&token)), &user_id, 600)
            .await?;
        Ok(token)
    }

    /// `POST /api/user/login/forgetPassword`：用重置令牌修改密码。
    ///
    /// Java `UserServiceImpl#modifyPassword`：令牌格式 64 hex → 缓存取 user_id →
    /// 账号启用 → 消费令牌 → `passwordEncoder.encode` → `updateById`。
    ///
    /// # Errors
    /// 令牌非法/过期、账号被禁用、写库失败 → 1001 业务错误。
    pub async fn forget_password(&self, dto: &ForgetPasswordDTO) -> Result<()> {
        let token = validate_reset_token(dto.mobile_key.as_deref())?;
        let password = dto
            .password
            .as_deref()
            .filter(|p| !p.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, PASSWORD_REQUIRED))?;

        let cache = self.cache()?;
        let key = password_reset_key(&md5_hex(token));
        let user_id: Option<i32> = cache.get_json(&key).await?;
        let user_id = user_id
            .filter(|id| *id > 0)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, RESET_TOKEN_INVALID))?;
        if self.repo().user_status(user_id).await? != Some(USER_STATUS_OK) {
            return Err(Error::biz(SERVICE_DATA_ERROR, ACCOUNT_CANNOT_RESET));
        }
        // 先一次性消费再写库（Java 注释：写库失败也不恢复凭据）
        cache.del(&key).await?;
        let hash = hash_password(password)?;
        if !self.repo().update_password(user_id, &hash).await? {
            return Err(Error::biz(SERVICE_DATA_ERROR, PASSWORD_UPDATE_FAILED));
        }
        Ok(())
    }

    // ————————————————————— 绑定手机 / 微信 —————————————————————

    /// `POST /api/user/login/bindMobile`：绑定手机号并返回会员 JWT。
    ///
    /// Java `UserServiceImpl#bindMobile` 的等价流程：
    /// 1. `validateVerificationCode("login" + mobile, mobileCode)`；
    /// 2. 已有该手机号 → 仅置 `mobile_validated=1`；否则检查 `shopRegClosed`
    ///    （「系统已关闭注册」）→ 创建用户；
    /// 3. `openData`（可多层嵌套）里的 `openid/unionid` 写入 `user_authorize`：
    ///    先按 openid 找记录（有则改归属），再按用户找同类型记录（有则换 openid），
    ///    否则新建；
    /// 4. 返回会员访问令牌（`JwtService#issue_pair`，`typ = "member"`）。
    ///
    /// # Errors
    /// 验证码错误、注册关闭、密码为空、数据库/缓存失败 → 业务错误或 `Error::Database`。
    pub async fn bind_mobile(
        &self,
        dto: &BindMobileDTO,
        client_type: Option<&str>,
    ) -> Result<String> {
        let mobile = require_identity(dto.mobile.as_deref(), MOBILE_REQUIRED)?.to_string();
        let code = validate_code_format(dto.mobile_code.as_deref())?;
        let password = dto
            .password
            .as_deref()
            .filter(|p| !p.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, BIND_PASSWORD_REQUIRED))?;

        // 1. 校验 login{mobile} 验证码（Java `validateVerificationCode`）
        let code_key = format!("login{mobile}");
        let cache = self.cache()?;
        let expected: Option<String> = cache.get_json(&code_key).await?;
        match expected {
            Some(expected) if expected == code => {}
            _ => return Err(Error::biz(SERVICE_DATA_ERROR, CODE_INVALID)),
        }
        cache.del(&code_key).await?;

        // 2. openData（兼容前端多套一层 openData）
        let open_data = unwrap_open_data(dto.open_data.as_ref());
        let openid = open_data
            .and_then(|d| d.get("openid"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let unionid = open_data
            .and_then(|d| d.get("unionid"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        let nickname = open_data
            .and_then(|d| d.get("nickname"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let avatar = open_data
            .and_then(|d| d.get("headimgurl"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        // 3. 已注册 → 只更新手机验证状态；否则注册新用户
        let existing = self.repo().find_user_by_mobile(&mobile).await?;
        let (user_id, username) = match existing {
            Some((user_id, username, _status)) => {
                self.repo().set_mobile_validated(user_id).await?;
                (user_id, username)
            }
            None => {
                let closed = self
                    .repo()
                    .config_value("shopRegClosed")
                    .await?
                    .and_then(|v| parse_switch(Some(&v)))
                    .unwrap_or(SWITCH_OFF);
                if closed != SWITCH_OFF {
                    return Err(Error::biz(SERVICE_DATA_ERROR, REGISTER_CLOSED));
                }
                let username = self.generate_unique_username().await?;
                let nickname = nickname
                    .clone()
                    .unwrap_or_else(|| auto_nickname(None, &username));
                let hash = hash_password(password)?;
                let user_id = self
                    .repo()
                    .insert_registered_user(
                        &username,
                        &nickname,
                        &avatar,
                        &mobile,
                        &hash,
                        i32::try_from(now_seconds()).unwrap_or(0),
                        dto.referrer_user_id.unwrap_or(0),
                    )
                    .await?;
                (user_id, username)
            }
        };

        // 4. 微信授权绑定（Java `bindMobile` 的 user_authorize upsert 三支）
        if let Some(openid) = openid.as_deref() {
            let authorize_type = authorize_type_from_client(client_type);
            let open_data_json = open_data.map(|d| {
                let mut cleaned = d.clone();
                // Java 为了避免特殊字符把 nickname 从 open_data 里移除
                cleaned.remove("nickname");
                Value::Object(cleaned).to_string()
            });
            let open_name = nickname.clone().unwrap_or_default();
            let now = i32::try_from(now_seconds()).unwrap_or(0);
            if let Some((authorize_id, _owner)) = self
                .repo()
                .find_authorize_by_open(openid, authorize_type)
                .await?
            {
                self.repo()
                    .update_authorize_user(
                        authorize_id,
                        user_id,
                        unionid.as_deref(),
                        open_data_json.as_deref(),
                    )
                    .await?;
            } else if let Some((authorize_id, _)) =
                self.repo().find_authorize_by_user(user_id).await?
            {
                self.repo()
                    .update_authorize_open(
                        authorize_id,
                        openid,
                        unionid.as_deref(),
                        open_data_json.as_deref(),
                    )
                    .await?;
            } else {
                self.repo()
                    .insert_authorize(
                        authorize_type,
                        user_id,
                        openid,
                        open_data_json.as_deref(),
                        &open_name,
                        &avatar,
                        unionid.as_deref(),
                        now,
                    )
                    .await?;
            }
        }

        // 5. 签发会员访问令牌（与 `api/public/src/lib.rs::user_login` 同口径）
        self.issue_member_token(user_id, &username)
    }

    /// `GET /api/user/login/unbindWechat`（需登录）。
    ///
    /// Java `UserServiceImpl#unbindWechat`：当前会员必须已绑定公众号，
    /// 按 openid 删除 `user_authorize` 记录。
    ///
    /// # Errors
    /// 未绑定 → 「该账号未绑定微信公众号」；数据库失败 → `Error::Database`。
    pub async fn unbind_wechat(&self, user_id: i32) -> Result<()> {
        let Some((_, open_id)) = self.repo().find_authorize_by_user(user_id).await? else {
            return Err(Error::biz(SERVICE_DATA_ERROR, WECHAT_NOT_BOUND));
        };
        if open_id.trim().is_empty() {
            return Err(Error::biz(SERVICE_DATA_ERROR, WECHAT_NOT_BOUND));
        }
        self.repo().delete_authorize_by_open(&open_id).await?;
        Ok(())
    }

    // ————————————————————— 快捷登录 / 微信登录（部分未迁移） —————————————————————

    /// `GET /api/user/login/getQuickLoginSetting`。
    ///
    /// Java `ConfigServiceImpl#getQuickLoginSetting`：按 `x-client-type` 决定
    /// `wechatLogin` / `showOauth`（`wechat`/`pc` 取 `openWechatOauth`，
    /// `miniProgram` 恒 1，其它 0）。
    ///
    /// # Errors
    /// 数据库失败 → `Error::Database`。
    pub async fn quick_login_setting(
        &self,
        client_type: Option<&str>,
    ) -> Result<QuickLoginSettingVO> {
        let oauth = self
            .repo()
            .config_value("openWechatOauth")
            .await?
            .as_deref()
            .and_then(|v| parse_switch(Some(v)))
            .unwrap_or(SWITCH_OFF);
        let (wechat_login, show_oauth) = quick_login_flags(client_type, oauth);
        Ok(QuickLoginSettingVO {
            wechat_login,
            show_oauth,
        })
    }

    /// `GET /api/user/login/getWxLoginUrl?url=`：微信授权 URL。
    ///
    /// Java `ConfigServiceImpl#getWechatLoginUrl`：
    /// - `x-client-type=wechat` → 拼 `buildAuthorizationUrl(redirectUrl, snsapi_userinfo, state)`
    ///   并把 `state` 缓存 300 秒；
    /// - `x-client-type=pc` → 走微信「创建二维码」API（未迁移 → 明确 1001）。
    ///
    /// # Errors
    /// 未配置 `wechatAppId`、非 wechat 客户端、缓存不可用 → 1001 业务错误。
    pub async fn wx_login_url(
        &self,
        client_type: Option<&str>,
        redirect_url: Option<&str>,
    ) -> Result<WechatLoginUrlVO> {
        let client_type = client_type.unwrap_or_default().trim().to_ascii_lowercase();
        if client_type == "pc" {
            return self.wechat_pc_qr_login().await;
        }
        if client_type != "wechat" {
            return Err(Error::biz(SERVICE_DATA_ERROR, "不支持的终端类型"));
        }
        let app_id = self
            .repo()
            .config_value("wechatAppId")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信 APPID 未配置"))?;
        let state = uuid::Uuid::new_v4().simple().to_string();
        self.cache()?
            .set_str(&wechat_state_key(&state), "valid", 300)
            .await?;
        let redirect = percent_encode_uri(redirect_url.unwrap_or(""));
        let url = format!(
            "https://open.weixin.qq.com/connect/oauth2/authorize?appid={app_id}&redirect_uri={redirect}&response_type=code&scope=snsapi_userinfo&state={state}#wechat_redirect"
        );
        Ok(WechatLoginUrlVO { url, ticket: None })
    }

    /// PC 扫码登录：调用公众号 `qrcode/create` 生成临时二维码，返回 URL + ticket。
    async fn wechat_pc_qr_login(&self) -> Result<WechatLoginUrlVO> {
        let client = crate::content::wechat_client::WechatClient::from_repos(&self.repos).await?;
        let mut token = client.access_token().await?;
        let body = serde_json::json!({
            "expire_seconds": 300,
            "action_name": "QR_STR_SCENE",
            "action_info": { "scene": { "scene_str": uuid::Uuid::new_v4().simple().to_string()[..12].to_string() } }
        });
        let make = |token: &str| {
            let url = format!(
                "https://api.weixin.qq.com/cgi-bin/qrcode/create?access_token={}",
                crate::content::wechat_client::urlencode(token)
            );
            (url, body.clone())
        };
        let (url, body) = make(&token);
        let mut raw = client.post_json(&url, &body).await?;
        let mut value = crate::content::wechat_client::parse_wechat_response(&raw)?;
        // token 失效：清缓存后重试一次（Java 对 40001/40014/42001 的处理）
        if value.get("errcode").and_then(Value::as_i64).is_some() {
            crate::content::wechat_client::invalidate_token(client.config().app_id.as_str());
            token = client.access_token().await?;
            let (url, body) = make(&token);
            raw = client.post_json(&url, &body).await?;
            value = crate::content::wechat_client::parse_wechat_response(&raw)?;
        }
        let ticket = value
            .get("ticket")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "获取微信登录二维码失败：缺少 ticket"))?;
        let qr_url = value
            .get("url")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "获取微信登录二维码失败：缺少 url"))?;
        Ok(WechatLoginUrlVO {
            url: qr_url.to_string(),
            ticket: Some(ticket.to_string()),
        })
    }

    /// `GET|POST /api/user/login/wechatServer`：微信公众号服务器消息回调。
    ///
    /// 对齐 Java `UserServiceImpl#wechatServer`：
    /// 1. 校验 `signature = sha1(sort(token,timestamp,nonce))`；
    /// 2. `echostr` 非空 → 原样回显（URL 验证）；
    /// 3. `encrypt_type=aes` → 校验 `msg_signature`，用 EncodingAESKey 解密 XML；
    /// 4. `subscribe` / `SCAN` 事件带 `Ticket` → 缓存 `ticket -> openid` 30 分钟；
    /// 5. 无被动回复时返回 `success`。
    ///
    /// # Errors
    /// 微信配置缺失、签名/解密失败、数据库/缓存错误。
    pub async fn wechat_server(
        &self,
        q: &WechatServerQuery,
        body: &[u8],
    ) -> Result<String> {
        let cfg = crate::content::wechat_client::load_mp_config(&self.repos)
            .await?
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信服务器配置未设置"))?;
        if cfg.server_token.trim().is_empty() {
            return Err(Error::biz(
                SERVICE_DATA_ERROR,
                "微信服务器 Token 未配置（wechatServerToken）",
            ));
        }
        let timestamp = q.timestamp.as_deref().unwrap_or_default();
        let nonce = q.nonce.as_deref().unwrap_or_default();
        let signature = q.signature.as_deref().unwrap_or_default();
        if !wechat_mp::verify_signature(&cfg.server_token, timestamp, nonce, signature) {
            return Ok("非法请求".to_string());
        }
        if let Some(echostr) = q.echostr.as_deref().filter(|s| !s.trim().is_empty()) {
            return Ok(echostr.to_string());
        }

        let encrypt_type = q
            .encrypt_type
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                if q.msg_signature.is_some() {
                    "aes"
                } else {
                    "raw"
                }
            });
        let xml = if encrypt_type.eq_ignore_ascii_case("aes") {
            if cfg.server_secret.trim().is_empty() {
                return Err(Error::biz(
                    SERVICE_DATA_ERROR,
                    "微信 EncodingAESKey 未配置（wechatServerSecret）",
                ));
            }
            let raw = String::from_utf8_lossy(body);
            let encrypt = wechat_mp::xml_field(&raw, "Encrypt")
                .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "安全模式回调缺少 Encrypt"))?;
            let msg_signature = q.msg_signature.as_deref().unwrap_or_default();
            if !wechat_mp::verify_msg_signature(
                &cfg.server_token,
                timestamp,
                nonce,
                &encrypt,
                msg_signature,
            ) {
                return Ok("非法请求".to_string());
            }
            wechat_mp::decrypt_message(&cfg.server_secret, &cfg.app_id, &encrypt)?
        } else {
            String::from_utf8_lossy(body).to_string()
        };

        if let (Some(event), Some(openid)) = (
            wechat_mp::xml_field(&xml, "Event"),
            wechat_mp::xml_field(&xml, "FromUserName"),
        ) {
            if matches!(event.as_str(), "subscribe" | "SCAN") {
                if let Some(ticket) =
                    wechat_mp::xml_field(&xml, "Ticket").filter(|s| !s.trim().is_empty())
                {
                    self.cache()?
                        .set_str(&ticket, &openid, 1800)
                        .await?;
                    tracing::info!(
                        "微信扫码登录 ticket 已缓存: event={event}, ticket={ticket}, openid={openid}"
                    );
                }
            }
        }
        Ok("success".to_string())
    }

    /// `POST /api/user/login/wechatEvent`：扫码后前端轮询登录结果。
    ///
    /// 对齐 Java `UserServiceImpl#wechatEvent`：
    /// - `key`（二维码 ticket）取缓存 openid；
    /// - 已有 `user_authorize` → 直接签发会员 JWT；
    /// - 无记录且允许微信注册 → 自动创建用户 + 授权记录后登录；
    /// - 不允许注册 → 返回 `type=2` + openid，前端走绑定手机号。
    pub async fn wechat_event(
        &self,
        dto: &tigshop_core::models::member::login::WechatEventDTO,
    ) -> Result<LoginWechatEventVO> {
        let key = dto
            .key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "未登录"))?;
        let openid: Option<String> = self.cache()?.get_str(key).await?;
        let openid = openid
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "未登录"))?;

        let mut user_id = self
            .repo()
            .find_authorize_by_open(&openid, 1)
            .await?
            .map(|(_, uid)| uid);
        if user_id.is_none() {
            let shop_reg_closed = self
                .repo()
                .config_value("shopRegClosed")
                .await?
                .and_then(|v| v.trim().parse::<i32>().ok())
                .unwrap_or(0);
            let wechat_oauth = self
                .repo()
                .config_value("openWechatOauth")
                .await?
                .and_then(|v| v.trim().parse::<i32>().ok())
                .unwrap_or(0);
            let wechat_register = self
                .repo()
                .config_value("openWechatRegister")
                .await?
                .and_then(|v| v.trim().parse::<i32>().ok())
                .unwrap_or(0);
            if shop_reg_closed != 0 || wechat_oauth != 1 || wechat_register != 1 {
                return Ok(LoginWechatEventVO {
                    token: None,
                    r#type: 2,
                    open_data: Some(serde_json::json!({
                        "openData": { "openid": openid }
                    })),
                    return_url: None,
                });
            }
            let username = self.generate_unique_username().await?;
            let raw_password = format!("wx_{}", &uuid::Uuid::new_v4().simple().to_string()[..12]);
            let password_hash = hash_password(&raw_password)?;
            let now = i32::try_from(now_seconds()).unwrap_or(i32::MAX);
            let new_user_id = self
                .repo()
                .insert_registered_user(
                    &username,
                    &format!("user_{username}"),
                    "",
                    "",
                    &password_hash,
                    now,
                    0,
                )
                .await?;
            self.repo()
                .insert_authorize(1, new_user_id, &openid, Some("{}"), "", "", None, now)
                .await?;
            user_id = Some(new_user_id);
            tracing::info!("微信扫码自动注册会员: user_id={new_user_id}, openid={openid}");
        }
        let user_id = user_id.ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "未登录"))?;
        let user = self
            .repos
            .member
            .user
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "会员不存在"))?;
        if user.status.unwrap_or(0) != USER_STATUS_OK {
            return Err(Error::biz(SERVICE_DATA_ERROR, "账号已被停用"));
        }
        let token = self.issue_member_token(user.user_id, &user.username)?;
        let now = i32::try_from(now_seconds()).unwrap_or(i32::MAX);
        let _ = self.repos.member.login.touch_last_login(user.user_id, "", now).await;
        Ok(LoginWechatEventVO {
            token: Some(token),
            r#type: 1,
            open_data: None,
            return_url: None,
        })
    }

    /// `POST /api/user/login/getMobile`：小程序获取手机号。
    ///
    /// **未迁移**：依赖微信 `getuserphonenumber` API。
    ///
    /// # Errors
    /// 恒返回 1001 业务错误。
    pub async fn get_mobile(&self, dto: &CodeParamDTO) -> Result<String> {
        let code = dto
            .code
            .as_deref()
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "code不能为空"))?;
        let app_id = self
            .repo()
            .config_value("wechatMiniProgramAppId")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信小程序 APPID 未配置"))?;
        let app_secret = self
            .repo()
            .config_value("wechatMiniProgramSecret")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信小程序 Secret 未配置"))?;
        let http = reqwest::Client::new();
        let token_url = format!(
            "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid={}&secret={}",
            crate::content::wechat_client::urlencode(&app_id),
            crate::content::wechat_client::urlencode(&app_secret)
        );
        let token_text = http
            .get(&token_url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("小程序 token 请求失败: {e}")))?
            .text()
            .await
            .map_err(|e| Error::Internal(format!("小程序 token 响应读取失败: {e}")))?;
        let token_json = crate::content::wechat_client::parse_wechat_response(&token_text)?;
        let access_token = token_json
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "获取小程序 access_token 失败"))?;
        let url = format!(
            "https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={}",
            crate::content::wechat_client::urlencode(access_token)
        );
        let body = serde_json::json!({ "code": code });
        let text = http
            .post(&url)
            .json(&body)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("小程序手机号请求失败: {e}")))?
            .text()
            .await
            .map_err(|e| Error::Internal(format!("小程序手机号响应读取失败: {e}")))?;
        let json = crate::content::wechat_client::parse_wechat_response(&text)?;
        let phone_info = json
            .get("phone_info")
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "小程序未返回手机号"))?;
        let phone_number = phone_info
            .get("phoneNumber")
            .and_then(Value::as_str)
            .unwrap_or("");
        let pure = phone_info
            .get("purePhoneNumber")
            .and_then(Value::as_str)
            .unwrap_or("");
        let country = phone_info
            .get("countryCode")
            .and_then(Value::as_str)
            .unwrap_or("");
        let area_code_enabled = self
            .repo()
            .config_value("isOpenMobileAreaCode")
            .await?
            .and_then(|v| v.trim().parse::<i32>().ok())
            == Some(1);
        let mobile = if area_code_enabled {
            if !country.is_empty() && !pure.is_empty() {
                format!("{country}{pure}")
            } else if !phone_number.is_empty() {
                phone_number.to_string()
            } else {
                pure.to_string()
            }
        } else {
            pure.to_string()
        };
        let mobile = mobile.trim_start_matches('+').to_string();
        if mobile.is_empty() {
            return Err(Error::biz(SERVICE_DATA_ERROR, "未获取到手机号"));
        }
        Ok(mobile)
    }

    /// `POST /api/user/login/updateUserOpenid`（需登录）：小程序 code2Session 绑定 openid。
    pub async fn update_user_openid(&self, dto: &CodeParamDTO, user_id: i32) -> Result<()> {
        let code = dto
            .code
            .as_deref()
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "缺少微信授权 code"))?;
        let app_id = self
            .repo()
            .config_value("wechatMiniProgramAppId")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信小程序 APPID 未配置"))?;
        let app_secret = self
            .repo()
            .config_value("wechatMiniProgramSecret")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信小程序 Secret 未配置"))?;

        let res = crate::content::wechat_client::code2session(&app_id, &app_secret, code).await?;
        let openid = res.get("openid").and_then(|v| v.as_str()).unwrap_or("");
        if openid.is_empty() {
            let errmsg = res.get("errmsg").and_then(|v| v.as_str()).unwrap_or("微信换取 openid 失败");
            return Err(Error::biz(SERVICE_DATA_ERROR, errmsg));
        }

        let authorize_type = 2; // MINI_PROGRAM
        if let Some((auth_id, _)) = self.repo().find_authorize_by_open(openid, authorize_type).await? {
            self.repo()
                .update_authorize_user(auth_id, user_id, None, Some(&res.to_string()))
                .await?;
        } else {
            let now = now_seconds() as i32;
            self.repo()
                .insert_authorize(
                    authorize_type,
                    user_id,
                    openid,
                    Some(&res.to_string()),
                    "",
                    "",
                    None,
                    now,
                )
                .await?;
        }
        Ok(())
    }

    /// `GET /api/user/login/getWxLoginInfoByCode`：公众号 OAuth code 换用户信息。
    ///
    /// **未迁移**：依赖微信 OAuth2 API。
    ///
    /// # Errors
    /// 恒返回 1001 业务错误。
    pub async fn wx_login_info_by_code(
        &self,
        code: Option<&str>,
    ) -> Result<WxLoginInfoByCodeVO> {
        let code = code
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "code不能为空"))?;
        let app_id = self
            .repo()
            .config_value("wechatAppId")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信 APPID 未配置"))?;
        let app_secret = self
            .repo()
            .config_value("wechatAppSecret")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信 AppSecret 未配置"))?;
        let http = reqwest::Client::new();
        let token_url = format!(
            "https://api.weixin.qq.com/sns/oauth2/access_token?appid={}&secret={}&code={}&grant_type=authorization_code",
            crate::content::wechat_client::urlencode(&app_id),
            crate::content::wechat_client::urlencode(&app_secret),
            crate::content::wechat_client::urlencode(code)
        );
        let text = http
            .get(&token_url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("微信 OAuth 请求失败: {e}")))?
            .text()
            .await
            .map_err(|e| Error::Internal(format!("微信 OAuth 响应读取失败: {e}")))?;
        let token_json = crate::content::wechat_client::parse_wechat_response(&text)?;
        let openid = token_json
            .get("openid")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信授权未返回 openid"))?
            .to_string();
        let unionid = token_json
            .get("unionid")
            .and_then(Value::as_str)
            .map(str::to_string);
        let access_token = token_json
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信授权未返回 access_token"))?
            .to_string();
        let userinfo_url = format!(
            "https://api.weixin.qq.com/sns/userinfo?access_token={}&openid={}&lang=zh_CN",
            crate::content::wechat_client::urlencode(&access_token),
            crate::content::wechat_client::urlencode(&openid)
        );
        let user_text = http
            .get(&userinfo_url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("微信用户信息请求失败: {e}")))?
            .text()
            .await
            .map_err(|e| Error::Internal(format!("微信用户信息响应读取失败: {e}")))?;
        let user_json = crate::content::wechat_client::parse_wechat_response(&user_text)?;
        let nickname = user_json
            .get("nickname")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let headimgurl = user_json
            .get("headimgurl")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        // 老用户：直接登录
        if let Some((_, user_id)) = self.repo().find_authorize_by_open(&openid, 1).await? {
            let user = self
                .repos
                .member
                .user
                .find_by_id(user_id)
                .await?
                .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "会员不存在"))?;
            if user.status.unwrap_or(0) != USER_STATUS_OK {
                return Err(Error::biz(SERVICE_DATA_ERROR, "账号已被停用"));
            }
            let token = self.issue_member_token(user.user_id, &user.username)?;
            return Ok(WxLoginInfoByCodeVO {
                r#type: 1,
                token: Some(token),
                open_data: None,
            });
        }

        // 新用户：按 Java 开关决定「绑定手机号」或「自动注册」
        let shop_reg_closed = self
            .repo()
            .config_value("shopRegClosed")
            .await?
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0);
        let wechat_oauth = self
            .repo()
            .config_value("openWechatOauth")
            .await?
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0);
        let wechat_register = self
            .repo()
            .config_value("openWechatRegister")
            .await?
            .and_then(|v| v.trim().parse::<i32>().ok())
            .unwrap_or(0);
        if shop_reg_closed != 0 {
            return Err(Error::biz(SERVICE_DATA_ERROR, "商城已停止注册"));
        }
        if wechat_oauth != 1 {
            return Err(Error::biz(SERVICE_DATA_ERROR, "公众号授权登录未开启"));
        }
        if wechat_register != 1 {
            return Err(Error::biz(SERVICE_DATA_ERROR, "微信注册未开启"));
        }
        let need_bind_phone = self
            .repo()
            .config_value("wechatRegisterBindPhone")
            .await?
            .and_then(|v| v.trim().parse::<i32>().ok())
            == Some(1);
        if need_bind_phone {
            let mut open_data = Map::new();
            open_data.insert("openid".into(), Value::String(openid));
            if let Some(unionid) = unionid {
                open_data.insert("unionid".into(), Value::String(unionid));
            }
            open_data.insert("nickname".into(), Value::String(nickname));
            open_data.insert("headimgurl".into(), Value::String(headimgurl));
            open_data.insert("mockMode".into(), Value::Bool(false));
            return Ok(WxLoginInfoByCodeVO {
                r#type: 2,
                token: None,
                open_data: Some(open_data),
            });
        }

        let username = self.generate_unique_username().await?;
        let raw_password = format!("wx_{}", &uuid::Uuid::new_v4().simple().to_string()[..12]);
        let password_hash = hash_password(&raw_password)?;
        let now = i32::try_from(now_seconds()).unwrap_or(i32::MAX);
        let nickname = if nickname.trim().is_empty() {
            format!("user_{username}")
        } else {
            nickname
        };
        let user_id = self
            .repo()
            .insert_registered_user(
                &username,
                &nickname,
                &headimgurl,
                "",
                &password_hash,
                now,
                0,
            )
            .await?;
        self.repo()
            .insert_authorize(
                1,
                user_id,
                &openid,
                Some("{}"),
                &nickname,
                &headimgurl,
                unionid.as_deref(),
                now,
            )
            .await?;
        let token = self.issue_member_token(user_id, &username)?;
        Ok(WxLoginInfoByCodeVO {
            r#type: 1,
            token: Some(token),
            open_data: None,
        })
    }

    /// `POST /api/user/login/bindWechat`（需登录）：公众号授权绑定。
    pub async fn bind_wechat(
        &self,
        dto: &tigshop_core::models::member::login::BindWechatParam,
        user_id: i32,
    ) -> Result<()> {
        let code = dto
            .code
            .as_deref()
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "code不能为空"))?;

        let user_auth = self.repo().find_authorize_by_user(user_id).await?;
        if let Some((_, open_id)) = user_auth {
            if !open_id.is_empty() {
                return Err(Error::biz(SERVICE_DATA_ERROR, "该账号已绑定微信公众号"));
            }
        }

        let app_id = self
            .repo()
            .config_value("wechatAppId")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信 APPID 未配置"))?;
        let app_secret = self
            .repo()
            .config_value("wechatAppSecret")
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "微信 AppSecret 未配置"))?;

        let url = format!(
            "https://api.weixin.qq.com/sns/oauth2/access_token?appid={}&secret={}&code={}&grant_type=authorization_code",
            crate::content::wechat_client::urlencode(&app_id),
            crate::content::wechat_client::urlencode(&app_secret),
            crate::content::wechat_client::urlencode(code)
        );
        let resp = reqwest::Client::new()
            .get(url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
            .map_err(|e| Error::Internal(format!("微信 OAuth 请求失败: {e}")))?;
        let text = resp.text().await.map_err(|e| Error::Internal(e.to_string()))?;
        let json_val = crate::content::wechat_client::parse_wechat_response(&text)?;
        let open_id = json_val
            .get("openid")
            .and_then(|v| v.as_str())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "该账号异常"))?;

        let authorize_type = 1; // WECHAT
        if let Some((_, existing_user_id)) = self.repo().find_authorize_by_open(open_id, authorize_type).await? {
            if existing_user_id != user_id {
                return Err(Error::biz(SERVICE_DATA_ERROR, "该微信号已绑定其他账号，请解绑后再重试"));
            }
        }

        let now = now_seconds() as i32;
        self.repo()
            .insert_authorize(
                authorize_type,
                user_id,
                open_id,
                Some(&text),
                "",
                "",
                None,
                now,
            )
            .await?;
        Ok(())
    }

    // ————————————————————— 内部 —————————————————————

    /// 缓存句柄（Redis 不可用时给出明确 1001，而不是伪造成功）。
    fn cache(&self) -> Result<&CacheService> {
        self.cache
            .as_ref()
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, CACHE_UNAVAILABLE))
    }

    /// 生成唯一用户名（Java `generateUniqueUsername`：随机串 + 冲突重试）。
    async fn generate_unique_username(&self) -> Result<String> {
        for _ in 0..5 {
            let candidate = format!(
                "u{}",
                &uuid::Uuid::new_v4().simple().to_string()[..12]
            );
            if !self.repo().username_exists(&candidate).await? {
                return Ok(candidate);
            }
        }
        Err(Error::biz(
            SERVICE_DATA_ERROR,
            "生成唯一用户名失败，请稍后重试",
        ))
    }

    // ————————————————————— 第三方 OAuth 登录 —————————————————————

    /// `GET /api/user/oauth/render/{source}`：生成第三方授权地址。
    pub async fn oauth_render(
        &self,
        source: &str,
        return_url: Option<&str>,
        platform: Option<&str>,
    ) -> Result<String> {
        let source = source.to_ascii_lowercase();
        let platform = platform.unwrap_or("pc");
        let domain_code = if platform.eq_ignore_ascii_case("h5") {
            "h5Domain"
        } else {
            "pcDomain"
        };
        let domain = self
            .repo()
            .config_value(domain_code)
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "未配置站点域名"))?;
        let base = domain.trim_end_matches('/');
        let redirect_uri = if platform.eq_ignore_ascii_case("h5") {
            format!("{base}/pages/oauth/callback")
        } else {
            format!("{base}/oauth/callback")
        };
        // 第三方回调地址不能带自定义 query（必须与控制台完全一致），
        // 因此把来源编码进 state 前缀，供回调页选择正确的 provider。
        let state = format!(
            "{}:{}",
            source,
            uuid::Uuid::new_v4().simple().to_string()
        );
        let code_verifier = if source == "twitter" {
            Some(twitter_code_verifier())
        } else {
            None
        };
        let state_value = OAuthState {
            redirect_uri: redirect_uri.clone(),
            return_url: return_url.map(str::to_string),
            code_verifier: code_verifier.clone(),
        };
        let cache = self
            .cache
            .as_ref()
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, CACHE_UNAVAILABLE))?;
        cache
            .set_json(&oauth_state_key(&state), &state_value, 600)
            .await?;
        let state_encoded = oauth_pct(&state);
        let redirect_encoded = oauth_pct(&redirect_uri);
        match source.as_str() {
            "google" => {
                let client_id = self.oauth_config("googleClientId").await?;
                Ok(format!(
                    "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={}&redirect_uri={}&scope=openid%20email%20profile&state={}&access_type=online",
                    oauth_pct(&client_id),
                    redirect_encoded,
                    state_encoded
                ))
            }
            "facebook" => {
                let client_id = self.oauth_config("facebookClientId").await?;
                Ok(format!(
                    "https://www.facebook.com/v18.0/dialog/oauth?client_id={}&redirect_uri={}&state={}&scope=public_profile,email",
                    oauth_pct(&client_id),
                    redirect_encoded,
                    state_encoded
                ))
            }
            "twitter" => {
                let client_id = self.oauth_config("twitterClientId").await?;
                let verifier = code_verifier.as_deref().unwrap_or_default();
                let challenge = twitter_code_challenge(verifier);
                Ok(format!(
                    "https://twitter.com/i/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
                    oauth_pct(&client_id),
                    redirect_encoded,
                    oauth_pct("users.read tweet.read"),
                    state_encoded,
                    oauth_pct(&challenge)
                ))
            }
            _ => Err(Error::biz(SERVICE_DATA_ERROR, "不支持的第三方登录平台")),
        }
    }

    /// `POST /api/user/oauth/callback/{source}`：第三方回调用 code 登录。
    pub async fn oauth_callback(
        &self,
        source: &str,
        code: &str,
        state: &str,
    ) -> Result<LoginWechatEventVO> {
        let source = source.to_ascii_lowercase();
        let state_key = oauth_state_key(state);
        let cache = self
            .cache
            .as_ref()
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, CACHE_UNAVAILABLE))?;
        let Some(state_value) = cache.get_json::<OAuthState>(&state_key).await? else {
            return Err(Error::biz(SERVICE_DATA_ERROR, "授权已过期，请重新登录"));
        };
        cache.del(&state_key).await?;
        let user = match source.as_str() {
            "google" => self.oauth_google_user(code, &state_value.redirect_uri).await?,
            "facebook" => self.oauth_facebook_user(code, &state_value.redirect_uri).await?,
            "twitter" => {
                self.oauth_twitter_user(
                    code,
                    &state_value.redirect_uri,
                    state_value.code_verifier.as_deref().unwrap_or_default(),
                )
                .await?
            }
            _ => return Err(Error::biz(SERVICE_DATA_ERROR, "不支持的第三方登录平台")),
        };
        let (open_id, nickname, avatar) = user;
        let authorize_type = match source.as_str() {
            "google" => 101,
            "facebook" => 102,
            _ => 103,
        };
        let mut token = None;
        if let Some((_, user_id)) = self
            .repo()
            .find_authorize_by_open(&open_id, authorize_type)
            .await?
        {
            if self.repo().user_status(user_id).await? == Some(USER_STATUS_OK) {
                token = Some(self.issue_member_token(user_id, &format!("user{user_id}"))?);
            }
        }
        let token = match token {
            Some(t) => t,
            None => {
                let username = self.generate_unique_username().await?;
                let raw_password = format!("oauth_{}", &uuid::Uuid::new_v4().simple().to_string()[..12]);
                let password_hash = hash_password(&raw_password)?;
                let now = now_seconds() as i32;
                let user_id = self
                    .repo()
                    .insert_registered_user(
                        &username,
                        &nickname,
                        &avatar,
                        "",
                        &password_hash,
                        now,
                        0,
                    )
                    .await?;
                let open_data = serde_json::json!({ "source": source, "openId": open_id }).to_string();
                self.repo()
                    .insert_authorize(
                        authorize_type,
                        user_id,
                        &open_id,
                        Some(&open_data),
                        &nickname,
                        &avatar,
                        Some(&open_id),
                        now,
                    )
                    .await?;
                self.issue_member_token(user_id, &username)?
            }
        };
        Ok(LoginWechatEventVO {
            token: Some(token),
            r#type: 1,
            open_data: None,
            return_url: state_value.return_url,
        })
    }

    async fn oauth_config(&self, code: &str) -> Result<String> {
        self.repo()
            .config_value(code)
            .await?
            .filter(|v| !v.trim().is_empty())
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, format!("{code} 未配置")))
    }

    async fn oauth_google_user(&self, code: &str, redirect_uri: &str) -> Result<(String, String, String)> {
        let client_id = self.oauth_config("googleClientId").await?;
        let secret = self.oauth_config("googleClientSecret").await?;
        let client = reqwest::Client::new();
        let token: Value = client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("code", code),
                ("client_id", client_id.as_str()),
                ("client_secret", secret.as_str()),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Google token 请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Google token 响应解析失败: {e}")))?;
        let access = token
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Google 未返回 access_token"))?;
        let info: Value = client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(access)
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Google 用户信息请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Google 用户信息解析失败: {e}")))?;
        let open_id = info
            .get("id")
            .or_else(|| info.get("sub"))
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Google 未返回用户 ID"))?;
        let nickname = info
            .get("name")
            .or_else(|| info.get("email"))
            .and_then(Value::as_str)
            .unwrap_or("Google用户");
        let avatar = info.get("picture").and_then(Value::as_str).unwrap_or("");
        Ok((open_id.to_string(), nickname.to_string(), truncate_avatar(avatar)))
    }

    async fn oauth_facebook_user(&self, code: &str, redirect_uri: &str) -> Result<(String, String, String)> {
        let client_id = self.oauth_config("facebookClientId").await?;
        let secret = self.oauth_config("facebookClientSecret").await?;
        let client = reqwest::Client::new();
        let token: Value = client
            .get("https://graph.facebook.com/v18.0/oauth/access_token")
            .query(&[
                ("client_id", client_id.as_str()),
                ("client_secret", secret.as_str()),
                ("redirect_uri", redirect_uri),
                ("code", code),
            ])
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Facebook token 请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Facebook token 响应解析失败: {e}")))?;
        let access = token
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Facebook 未返回 access_token"))?;
        let info: Value = client
            .get("https://graph.facebook.com/me")
            .query(&[("fields", "id,name,email,picture.type(large)"), ("access_token", access)])
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Facebook 用户信息请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Facebook 用户信息解析失败: {e}")))?;
        let open_id = info
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Facebook 未返回用户 ID"))?;
        let nickname = info
            .get("name")
            .or_else(|| info.get("email"))
            .and_then(Value::as_str)
            .unwrap_or("Facebook用户");
        let avatar = info
            .get("picture")
            .and_then(|p| p.get("data"))
            .and_then(|d| d.get("url"))
            .and_then(Value::as_str)
            .unwrap_or("");
        Ok((open_id.to_string(), nickname.to_string(), truncate_avatar(avatar)))
    }

    async fn oauth_twitter_user(
        &self,
        code: &str,
        redirect_uri: &str,
        code_verifier: &str,
    ) -> Result<(String, String, String)> {
        let client_id = self.oauth_config("twitterClientId").await?;
        let secret = self.oauth_config("twitterClientSecret").await?;
        let basic = base64::engine::general_purpose::STANDARD.encode(format!("{client_id}:{secret}"));
        let client = reqwest::Client::new();
        let token: Value = client
            .post("https://api.twitter.com/2/oauth2/token")
            .header("Authorization", format!("Basic {basic}"))
            .form(&[
                ("code", code),
                ("grant_type", "authorization_code"),
                ("client_id", client_id.as_str()),
                ("redirect_uri", redirect_uri),
                ("code_verifier", code_verifier),
            ])
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Twitter token 请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Twitter token 响应解析失败: {e}")))?;
        let access = token
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Twitter 未返回 access_token"))?;
        let info: Value = client
            .get("https://api.twitter.com/2/users/me")
            .bearer_auth(access)
            .send()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Twitter 用户信息请求失败: {e}")))?
            .json()
            .await
            .map_err(|e| Error::biz(SERVICE_DATA_ERROR, format!("Twitter 用户信息解析失败: {e}")))?;
        let data = info.get("data").unwrap_or(&Value::Null);
        let open_id = data
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, "Twitter 未返回用户 ID"))?;
        let nickname = data
            .get("name")
            .or_else(|| data.get("username"))
            .and_then(Value::as_str)
            .unwrap_or("Twitter用户");
        Ok((open_id.to_string(), nickname.to_string(), String::new()))
    }

    /// 会员访问令牌（`sub=userId` / `usr=username` / `typ="member"`）。
    fn issue_member_token(&self, user_id: i32, username: &str) -> Result<String> {
        let (access, _refresh, _expires_in) = self.jwt.issue_pair(
            user_id.to_string(),
            username.to_string(),
            None,
            Some(MEMBER_TOKEN_TYPE.to_string()),
        )?;
        Ok(access)
    }
}

/// OAuth state 缓存值（Redis 键 `oauth_state:<state>`，TTL 10 分钟）。
#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthState {
    redirect_uri: String,
    return_url: Option<String>,
    code_verifier: Option<String>,
}

fn oauth_state_key(state: &str) -> String {
    format!("oauth_state:{state}")
}

fn oauth_pct(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn twitter_code_verifier() -> String {
    // RFC 7636：43-128 字符；SHA256(uuid+uuid) 的 base64url 结果固定 43 字符
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let raw = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );
    URL_SAFE_NO_PAD.encode(Sha256::digest(raw.as_bytes()))
}

fn twitter_code_challenge(verifier: &str) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn truncate_avatar(url: &str) -> String {
    if url.chars().count() <= 255 {
        url.to_string()
    } else {
        String::new()
    }
}

/// 必填身份（手机号/邮箱）：Java `StrUtil.isBlank(identity)` → 文案。
pub fn require_identity<'a>(value: Option<&'a str>, message: &str) -> Result<&'a str> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| Error::biz(SERVICE_DATA_ERROR, message))
}

/// 生成 6 位数字验证码（Java `RandomUtil.randomInt(100000, 999999)`）。
#[must_use]
pub fn generate_sms_code() -> String {
    let n = uuid::Uuid::new_v4().as_u128() % 900_000 + 100_000;
    n.to_string()
}

/// 生成 32 字节随机重置令牌：64 位小写十六进制
/// （Java `SecureRandom.nextBytes(32)` + `HexFormat.of().formatHex`）。
#[must_use]
pub fn generate_reset_token() -> String {
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// MD5 小写十六进制（替代 Java `SecureUtil.sha256`，见模块文档「已知差异」）。
#[must_use]
pub fn md5_hex(input: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// 解析配置开关：Java `Integer.parseInt(bizVal)`（空 → `None`，非法 → `None`）。
#[must_use]
pub fn parse_switch(raw: Option<&str>) -> Option<i32> {
    raw.map(str::trim).filter(|v| !v.is_empty())?.parse().ok()
}

/// 简化版 URI 组件编码（Java `buildAuthorizationUrl` 会对 redirect_uri 编码）。
///
/// 保留 RFC 3986 unreserved 字符，其余按 `%XX` 编码（UTF-8）。
#[must_use]
pub fn percent_encode_uri(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.bytes() {
        let keep = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if keep {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// 未迁移能力判定（供路由/文档对齐；纯函数便于测试）。
#[must_use]
pub fn is_unmigrated_wechat_endpoint(handler: &str) -> bool {
    matches!(
        handler,
        "wechatServer"
            | "wechatEvent"
            | "getMobile"
            | "updateUserOpenId"
            | "getWxLoginInfoByCode"
            | "bindWechat"
    )
}

/// 让错误类型与 Java 的 `GlobalException` 默认 code 对齐（1001）的便捷构造。
#[must_use]
pub fn biz_error(message: &'static str) -> Error {
    Error::biz(SERVICE_DATA_ERROR, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tigshop_core::models::member::login::CODE_INVALID;

    #[test]
    fn md5_hex_matches_known_vector() {
        // RFC 1321: md5("abc") = 900150983cd24fb0d6963f7d28e17f72
        assert_eq!(md5_hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
        assert_eq!(md5_hex(""), "d41d8cd98f00b204e9800998ecf8427e");
    }

    #[test]
    fn generated_codes_and_tokens_have_java_shapes() {
        for _ in 0..20 {
            let code = generate_sms_code();
            assert_eq!(code.len(), 6, "{code}");
            assert!(code.bytes().all(|b| b.is_ascii_digit()));
            let n: i32 = code.parse().unwrap();
            assert!((100_000..=999_999).contains(&n));
        }
        for _ in 0..20 {
            let token = generate_reset_token();
            assert_eq!(token.len(), 64);
            assert!(token
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)));
        }
    }

    #[test]
    fn switch_parsing_matches_java_integer_parse_behavior() {
        assert_eq!(parse_switch(Some("1")), Some(1));
        assert_eq!(parse_switch(Some("0")), Some(0));
        assert_eq!(parse_switch(Some("  1 ")), Some(1));
        assert_eq!(parse_switch(Some("")), None);
        assert_eq!(parse_switch(None), None);
        assert_eq!(parse_switch(Some("abc")), None);
    }

    #[test]
    fn percent_encoding_matches_oauth_redirect_requirement() {
        assert_eq!(
            percent_encode_uri("https://a.com/cb?x=1&y=中"),
            "https%3A%2F%2Fa.com%2Fcb%3Fx%3D1%26y%3D%E4%B8%AD"
        );
        assert_eq!(percent_encode_uri(""), "");
        assert_eq!(percent_encode_uri("abc-_.~"), "abc-_.~");
    }

    #[test]
    fn error_helpers_use_business_code_1001() {
        let e = biz_error(CODE_INVALID);
        match e {
            Error::Biz { code, msg } => {
                assert_eq!(code, 1001);
                assert_eq!(msg, "验证码错误或已过期，请重试");
            }
            other => panic!("应为业务错误: {other:?}"),
        }
        let e = require_identity(Some("  "), MOBILE_REQUIRED).unwrap_err();
        assert!(e.to_string().contains(MOBILE_REQUIRED));
        assert_eq!(require_identity(Some(" 138 "), MOBILE_REQUIRED).unwrap(), "138");
    }

    #[test]
    fn unmigrated_wechat_endpoints_are_exactly_the_six_java_flows() {
        for h in [
            "wechatServer",
            "wechatEvent",
            "getMobile",
            "updateUserOpenId",
            "getWxLoginInfoByCode",
            "bindWechat",
        ] {
            assert!(is_unmigrated_wechat_endpoint(h), "{h}");
        }
        for h in ["bindMobile", "unbindWechat", "checkMobile", "getWxLoginUrl"] {
            assert!(!is_unmigrated_wechat_endpoint(h), "{h}");
        }
    }
}
