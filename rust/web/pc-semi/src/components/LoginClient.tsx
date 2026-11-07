'use client';

/**
 * PC 登录
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/Login.vue
 *          components/member/login/BaseLogin.vue（loginMode=1 经典）
 *          components/member/login/OverseasLogin.vue（loginMode=2 现代）
 * 装修：home/home/pcLogin → loginMode / backgroundPic / backgroundColor
 * 接口：POST /api/user/login/signin、POST /api/user/login/sendMobileCode、GET /api/user/login/getWxLoginUrl
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Toast } from '@douyinfe/semi-ui';
import type { PcLoginDecorate } from '@/lib/api';

import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
async function getCsrf(): Promise<string> {
  const response = await fetch('/api/common/csrf/create', { credentials: 'include' });
  const json = await response.json();
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || (i18n.t('获取 CSRF Token 失败') as string));
  }
  return typeof json.data === 'string' ? json.data : json.data?.token || '';
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || json.message || (i18n.t('请求失败（{code}）', { code: response.status }) as string));
  }
  return json.data ?? json;
}

function redirectAfterLogin() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('redirect') || params.get('returnUrl') || '/member';
  window.location.replace(target);
}

export default function LoginClient({ decorate }: { decorate: PcLoginDecorate | null }) {
    const { t } = useTranslation();
  /** 源码 loginMode：1 经典 / 2 现代；默认现代 */
  const loginMode = Number(decorate?.loginMode ?? 2) === 1 ? 1 : 2;

  const [tab, setTab] = useState<'normal' | 'mobile'>(loginMode === 1 ? 'normal' : 'normal');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileCode, setMobileCode] = useState('');
  const [areaCode, setAreaCode] = useState('+86');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [wechatMode, setWechatMode] = useState(false);
  const [wechatQr, setWechatQr] = useState('');
  const [wechatExpired, setWechatExpired] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (poll.current) clearInterval(poll.current);
  }, []);

  const bgUrl = decorate?.backgroundPic?.picUrl || '';
  const bgColor = decorate?.backgroundColor || '';
  const warpStyle: React.CSSProperties = {
    backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
    backgroundColor: bgColor || undefined,
  };

  const sendCode = async () => {
    if (countdown > 0) return;
    if (!/^1\d{10}$/.test(mobile.trim())) return setError('请输入正确的手机号');
    try {
      await postJson('user/login/sendMobileCode', { mobile: mobile.trim(), areaCode });
      Toast.success({ content: '验证码已发送' });
      setCountdown(60);
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => {
        setCountdown((value) => {
          if (value <= 1) {
            if (timer.current) clearInterval(timer.current);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agreed) return setError('请先阅读并同意服务协议与隐私协议');
    if (tab === 'normal') {
      if (!username.trim() || !password) return setError('请输入账号和密码');
    } else if (!/^1\d{10}$/.test(mobile.trim()) || !mobileCode.trim()) {
      return setError('请输入手机号和验证码');
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await getCsrf();
      const result: any = await postJson(
        'user/login/signin',
        tab === 'normal'
          ? { loginType: 'password', username: username.trim(), password, mobile: '', mobileCode: '', verifyToken: '' }
          : { loginType: 'mobile', username: '', password: '', mobile: mobile.trim(), mobileCode: mobileCode.trim(), areaCode, verifyToken: '' },
        { 'X-CSRF-Token': csrf },
      );
      const token = result?.token || result?.accessToken;
      if (!token) throw new Error('登录接口未返回 token');
      localStorage.setItem('accessToken', token);
      document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      Toast.success({ content: '登录成功' });
      redirectAfterLogin();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
      setLoading(false);
    }
  };

  /** 源码 showWechatLogin：微信扫码登录 */
  const openWechat = async () => {
    setWechatMode(true);
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
      setWechatQr(await QRCode.toDataURL(url, { width: 200, margin: 1 }));
      poll.current = setInterval(async () => {
        try {
          const event = await fetch('/api/user/login/wechatEvent', { credentials: 'include' }).then((r) => r.json());
          const data = event?.data || event;
          if (data?.status === 1 || data?.success) {
            if (poll.current) clearInterval(poll.current);
            Toast.success({ content: '微信授权成功' });
            redirectAfterLogin();
          }
        } catch {
          /* 忽略轮询异常 */
        }
      }, 2000);
    } catch {
      setWechatExpired(true);
    }
  };

  const card = (
    <>
      {wechatMode ? (
        <div className="pdp-login__wechat">
          <div className="pdp-login__wechat-title">{t('请使用微信移动端扫描二维码')}</div>
          {wechatQr && !wechatExpired ? (
            <img src={wechatQr} alt={t('微信二维码')} />
          ) : (
            <div className="pdp-login__wechat-empty">{wechatExpired ? t('二维码已失效') : '加载中...'}</div>
          )}
          <div className="pdp-login__wechat-actions">
            <Button onClick={() => void openWechat()}>{t('刷新二维码')}</Button>
            <Button onClick={() => { setWechatMode(false); if (poll.current) clearInterval(poll.current); }}>{t('返回')}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="pdp-login__head">
            <h1>{loginMode === 1 ? t('欢迎登录') : '登录'}</h1>
            <div className="pdp-login__register">{t('没有账号？')}<Link href="/register">{t('去注册')}</Link>
            </div>
          </div>

          {/* 经典：普通登录 / 手机登录；现代：密码登录 / 验证码登录 */}
          <div className="pdp-login__tabs">
            <button type="button" className={tab === 'normal' ? 'is-active' : ''} onClick={() => { setTab('normal'); setError(''); }}>
              {loginMode === 1 ? t('普通登录') : '密码登录'}
            </button>
            <button type="button" className={tab === 'mobile' ? 'is-active' : ''} onClick={() => { setTab('mobile'); setError(''); }}>
              {loginMode === 1 ? t('手机登录') : '验证码登录'}
            </button>
          </div>

          <form onSubmit={submit} className="pdp-login__form">
            {tab === 'normal' ? (
              <>
                <input className="pdp-login__input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t('用户名/手机/邮箱')} />
                <input className="pdp-login__input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('密码')} />
                <div className="pdp-login__forget"><Link href="/member/reset">{t('忘记密码？')}</Link></div>
              </>
            ) : (
              <>
                <div className="pdp-login__row">
                  <select className="pdp-login__area" value={areaCode} onChange={(event) => setAreaCode(event.target.value)}>
                    <option value="+86">(+86)</option>
                    <option value="+61">(+61)</option>
                  </select>
                  <input className="pdp-login__input" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder={t('手机号')} maxLength={11} />
                </div>
                <div className="pdp-login__row">
                  <input className="pdp-login__input" value={mobileCode} onChange={(event) => setMobileCode(event.target.value)} placeholder={t('请输入验证码')} maxLength={8} />
                  <Button disabled={countdown > 0} onClick={() => void sendCode()}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Button>
                </div>
              </>
            )}

            <label className="pdp-login__agree">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
              <span>{t('我已阅读并同意')}<Link href="/article/issue/info?articleSn=fwxy" target="_blank">{t('《服务协议》')}</Link>{t('和')}<Link href="/article/issue/info?articleSn=ysxy" target="_blank">{t('《隐私协议》')}</Link>
              </span>
            </label>

            {error ? <div className="pdp-login__error">{error}</div> : null}

            <Button htmlType="submit" theme="solid" type="primary" size="large" block loading={loading}>{t('登录')}</Button>
          </form>

          <div className="pdp-login__other">
            <button type="button" onClick={() => void openWechat()}>{t('微信扫码登录')}</button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div
      className={`pdp-login pdp-login--${loginMode === 1 ? 'classic' : 'modern'}`}
      style={warpStyle}
    >
      {loginMode === 1 ? (
        <div className="pdp-login__center">
          <div className="pdp-login__card">{card}</div>
        </div>
      ) : (
        <div className="pdp-login__center pdp-login__center--modern">
          <div className="pdp-login__card">{card}</div>
        </div>
      )}
    </div>
  );
}
