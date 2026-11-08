'use client';

/**
 * PC 注册
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/Register.vue
 * - 手机号注册 / 邮箱注册切换
 * - 短信 / 邮箱验证码（60s 倒计时，源码 MobileCode）
 * - 注册协议与隐私政策勾选
 * - 邀请码选填
 * 接口：POST /api/user/login/sendMobileCode
 *       POST /api/user/login/sendEmailCode
 *       POST /api/user/regist/registAct
 *       GET  /api/common/csrf/create
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Toast, Typography } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useOauthLogin, OauthButtons } from '@/components/oauth/useOauthLogin';
async function getCsrf(): Promise<string> {
  const response = await fetch('/api/common/csrf/create', { credentials: 'include' });
  const json = await response.json();
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || (i18n.t('获取 CSRF Token 失败') as string));
  }
  return typeof json.data === 'string' ? json.data : json.data?.token || '';
}

type Mode = 'mobile' | 'email' | 'wechat';

export default function RegisterClient() {
    const { t } = useTranslation();
  /** 第三方注册入口（源码 pages/member/Register.vue:192-203） */
  const { switches: oauthSwitches, start: startOauth } = useOauthLogin();
  const [mode, setMode] = useState<Mode>('mobile');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  // 旧版 register.vue 只有一行「点击注册，表示您同意《注册协议》」文字，没有勾选框，
  // 所以这里直接视为已同意，保留这个 state 只为兼容原有校验逻辑。
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 源码 Register.vue：微信扫码注册（getWxLoginUrl + wechatEvent 轮询 2s/60s） */
  const [wechatQr, setWechatQr] = useState('');
  const [wechatExpired, setWechatExpired] = useState(false);
  const wechatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wechatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (wechatTimer.current) clearInterval(wechatTimer.current);
      if (wechatTimeout.current) clearTimeout(wechatTimeout.current);
    };
  }, []);

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  /** 源码 Register.vue showWechatLogin：拉取微信登录地址并生成二维码，轮询扫码结果 */
  const stopWechat = () => {
    if (wechatTimer.current) { clearInterval(wechatTimer.current); wechatTimer.current = null; }
    if (wechatTimeout.current) { clearTimeout(wechatTimeout.current); wechatTimeout.current = null; }
  };

  const showWechatLogin = async () => {
    stopWechat();
    setWechatExpired(false);
    try {
      const response = await fetch('/api/user/login/getWxLoginUrl', { credentials: 'include' });
      const json = await response.json();
      const url = typeof json?.data === 'string' ? json.data : String(json?.data?.url || json?.data?.qrcodeUrl || '');
      if (!url) {
        setWechatExpired(true);
        return;
      }
      const QRCode = (await import('qrcode')).default;
      setWechatQr(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
      // 轮询扫码事件
      wechatTimer.current = setInterval(async () => {
        try {
          const event = await fetch('/api/user/login/wechatEvent', { credentials: 'include' }).then((r) => r.json());
          const data = event?.data || event;
          if (data?.status === 1 || data?.success) {
            stopWechat();
            Toast.success({ content: '微信授权成功' });
            window.location.replace('/member');
          }
        } catch {
          /* 轮询失败忽略，等待超时 */
        }
      }, 2000);
      wechatTimeout.current = setTimeout(() => {
        stopWechat();
        setWechatExpired(true);
      }, 60000);
    } catch (error) {
      setWechatExpired(true);
      Toast.error({ content: error instanceof Error ? error.message : '微信二维码加载失败' });
    }
  };

  /** 切换到微信模式时自动加载二维码 */
  useEffect(() => {
    if (mode === 'wechat') {
      void showWechatLogin();
    } else {
      stopWechat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /** 源码 MobileCode：sendMobileCode / sendEmailCode */
  const sendCode = async () => {
    if (countdown > 0 || sending) return;
    if (mode === 'mobile' && !/^1\d{10}$/.test(mobile.trim())) {
      setError('请输入正确的手机号');
      return;
    }
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入正确的邮箱');
      return;
    }
    setSending(true);
    setError('');
    try {
      const url = mode === 'mobile' ? '/api/user/login/sendMobileCode' : '/api/user/login/sendEmailCode';
      const payload = mode === 'mobile' ? { mobile: mobile.trim() } : { email: email.trim() };
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        throw new Error(json.msg || json.message || t('验证码发送失败'));
      }
      Toast.success({ content: '验证码已发送' });
      startCountdown(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'mobile' && !/^1\d{10}$/.test(mobile.trim())) return setError('请输入正确的手机号');
    if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('请输入正确的邮箱');
    if (!code.trim()) return setError('请输入验证码');
    if (password.length < 6) return setError('密码至少 6 位');
    if (password !== confirm) return setError('两次输入的密码不一致');
    if (!agree) return setError('请先阅读并同意注册协议与隐私政策');

    setLoading(true);
    setError('');
    try {
      const csrf = await getCsrf();
      const body: Record<string, unknown> = {
        password,
        nickname: nickname.trim(),
        mobileCode: mode === 'mobile' ? code.trim() : '',
        emailCode: mode === 'email' ? code.trim() : '',
      };
      if (mode === 'mobile') body.mobile = mobile.trim();
      else body.email = email.trim();
      if (inviteCode.trim()) body.inviteCode = inviteCode.trim();

      const response = await fetch('/api/user/regist/registAct', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        throw new Error(json.msg || json.message || t('注册失败'));
      }
      Toast.success({ content: '注册成功，请登录' });
      setTimeout(() => window.location.replace('/login'), 600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '注册失败');
      setLoading(false);
    }
  };

  return (
    <div className="pg-auth-register">
      {/* 源码 pages/member/register.vue：.full-height-div > .register-info > .title / .content > .form-box + .btn-box + .login-box */}
      <div className="full-height-div">
        <div className="register-info" data-form-rev="ZmFocDIyODI">
          <div className="title">{t('会员注册')}</div>

          <div className="content">
            {mode === 'wechat' ? (
              <div className="wechat-main" style={{ height: 420 }}>
                <div className="wechat-main-back" onClick={() => setMode('mobile')}>
                  {t('返回')}
                </div>
                <div className="tow-title">{t('请使用微信扫码安全登录')}</div>
                {wechatQr && !wechatExpired ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="two-image" src={wechatQr} alt={t('微信二维码')} />
                  </>
                ) : (
                  <div className="image-text">{wechatExpired ? t('二维码已失效') : t('加载中...')}</div>
                )}
                <div className="login_last">
                  <button className="el-button" type="button" onClick={() => void showWechatLogin()}>
                    {wechatExpired ? t('刷新二维码') : t('返回')}
                  </button>
                </div>
                <p className="register-wechat__tip">{t('扫码后自动完成注册并登录')}</p>
              </div>
            ) : (
              <form className="form-box" onSubmit={submit}>
                {mode === 'mobile' ? (
                  <div className="form-item">
                    <div className="form-item-label">{t('手机号码')}</div>
                    <div className="form-item-input area-code-input">
                      <div className="el-input input-border-style">
                        <input
                          className="el-input__inner"
                          value={mobile}
                          onChange={(event) => setMobile(event.target.value)}
                          placeholder={t('手机号码')}
                          maxLength={11}
                        />
                      </div>
                      <div className="error-notice" />
                    </div>
                  </div>
                ) : (
                  <div className="form-item">
                    <div className="form-item-label">{t('邮箱')}</div>
                    <div className="form-item-input">
                      <div className="el-input input-border-style">
                        <input
                          className="el-input__inner"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder={t('邮箱')}
                        />
                      </div>
                      <div className="error-notice" />
                    </div>
                  </div>
                )}

                <div className="form-item">
                  <div className="form-item-label">{t('验证码')}</div>
                  <div className="form-item-input">
                    <div className="el-input input-border-style">
                      <input
                        className="el-input__inner"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder={t('验证码')}
                        maxLength={8}
                      />
                      <span className="el-input__suffix mobile-code-text">
                        <button className="el-button" type="button" disabled={countdown > 0 || sending} onClick={() => void sendCode()}>
                          {countdown > 0 ? `${countdown}s` : t('获取验证码')}
                        </button>
                      </span>
                    </div>
                    <div className="error-notice" />
                  </div>
                </div>

                <div className="form-item">
                  <div className="form-item-label">{t('昵称')}</div>
                  <div className="form-item-input">
                    <div className="el-input input-border-style">
                      <input
                        className="el-input__inner"
                        value={nickname}
                        onChange={(event) => setNickname(event.target.value)}
                        placeholder={t('昵称（选填）')}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-item">
                  <div className="form-item-label">{t('设置密码')}</div>
                  <div className="form-item-input">
                    <div className="el-input input-border-style">
                      <input
                        className="el-input__inner"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t('设置密码')}
                      />
                    </div>
                    <div className="error-notice" />
                  </div>
                </div>

                <div className="form-item">
                  <div className="form-item-label">{t('确认密码')}</div>
                  <div className="form-item-input">
                    <div className="el-input input-border-style">
                      <input
                        className="el-input__inner"
                        type="password"
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        placeholder={t('确认密码')}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-item">
                  <div className="form-item-label">{t('邀请码')}</div>
                  <div className="form-item-input">
                    <div className="el-input input-border-style">
                      <input
                        className="el-input__inner"
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value)}
                        placeholder={t('邀请码（选填）')}
                      />
                    </div>
                  </div>
                </div>

                {error ? <div className="error-notice">{error}</div> : null}
              </form>
            )}
          </div>

          <div className="btn-box">
            <div className="extra">
              {t('点击注册，表示您同意')}
              <Link className="font-color" href="/article/issue?categoryId=yhxy" target="_blank">
                {t('《用户协议》')}
              </Link>
              {t('和')}
              <Link className="font-color" href="/article/issue?categoryId=yszc" target="_blank">
                {t('《隐私政策》')}
              </Link>
            </div>
            <button className="el-button login-btn" type="button" disabled={loading} onClick={(event) => void submit(event as unknown as React.FormEvent)}>
              {loading ? t('注册中...') : t('同意协议并注册')}
            </button>

            <div className="text">
              <div className="line" />
              <div>{t('或通过以下方式加入')}</div>
              <div className="line" />
            </div>

            <div className="other-login-img">
              <div className="login-img" onClick={() => setMode('wechat')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="login-img" src="/assets/images/user/login/ico_wx.png" alt="" />
                <p>{t('微信')}</p>
              </div>
            </div>

            {/* 第三方注册（源码 pages/member/Register.vue:192-203 Google / Facebook / Twitter-X） */}
            <OauthButtons switches={oauthSwitches} onStart={startOauth} />
          </div>

          <div className="login-box">
            <Link className="font-color" href="/login">
              {t('已有账号？去登录！')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

