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

async function getCsrf(): Promise<string> {
  const response = await fetch('/api/common/csrf/create', { credentials: 'include' });
  const json = await response.json();
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || '获取 CSRF Token 失败');
  }
  return typeof json.data === 'string' ? json.data : json.data?.token || '';
}

type Mode = 'mobile' | 'email' | 'wechat';

export default function RegisterPage() {
  const [mode, setMode] = useState<Mode>('mobile');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [agree, setAgree] = useState(false);
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
        throw new Error(json.msg || json.message || '验证码发送失败');
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
        throw new Error(json.msg || json.message || '注册失败');
      }
      Toast.success({ content: '注册成功，请登录' });
      setTimeout(() => window.location.replace('/login'), 600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '注册失败');
      setLoading(false);
    }
  };

  return (
    <main className="pc-login-page">
      <div className="pc-login-brand">
        <div className="pc-login-brand__logo">W</div>
        <h1>万物新生</h1>
        <p>退役动力电池循环利用产业服务平台</p>
        <div className="pc-login-brand__points">
          <span>安全合规</span>
          <span>高效协同</span>
          <span>绿色循环</span>
        </div>
      </div>
      <Card className="pc-login-card">
        <Typography.Title heading={3} style={{ marginBottom: 6 }}>注册账号</Typography.Title>
        <Typography.Text type="tertiary">
          {mode === 'mobile' ? '手机号注册，注册后可直接登录' : '邮箱注册，注册后可直接登录'}
        </Typography.Text>

        <div className="register-mode">
          <button type="button" className={mode === 'mobile' ? 'is-active' : ''} onClick={() => { setMode('mobile'); setCode(''); }}>手机号注册</button>
          <button type="button" className={mode === 'email' ? 'is-active' : ''} onClick={() => { setMode('email'); setCode(''); }}>邮箱注册</button>
          <button type="button" className={mode === 'wechat' ? 'is-active' : ''} onClick={() => setMode('wechat')}>微信注册</button>
        </div>

        {mode === 'wechat' ? (
          <div className="register-wechat">
            <p className="register-wechat__desc">请使用微信移动端扫描二维码</p>
            {wechatQr && !wechatExpired ? (
              <img className="register-wechat__qr" src={wechatQr} alt="微信二维码" />
            ) : (
              <div className="register-wechat__placeholder">
                {wechatExpired ? '二维码已失效' : '二维码加载中...'}
              </div>
            )}
            <Button onClick={() => void showWechatLogin()}>
              {wechatExpired ? '刷新二维码' : '返回'}
            </Button>
            <p className="register-wechat__tip">扫码后自动完成注册并登录</p>
          </div>
        ) : (
        <form onSubmit={submit} style={{ marginTop: 16 }}>
          {mode === 'mobile' ? (
            <div className="pc-form-item">
              <Input size="large" placeholder="手机号" value={mobile} onChange={setMobile} maxLength={11} />
            </div>
          ) : (
            <div className="pc-form-item">
              <Input size="large" placeholder="邮箱" value={email} onChange={setEmail} />
            </div>
          )}

          <div className="pc-form-item register-code">
            <Input size="large" placeholder="验证码" value={code} onChange={setCode} maxLength={8} />
            <Button
              type="tertiary"
              size="large"
              loading={sending}
              disabled={countdown > 0}
              onClick={() => void sendCode()}
            >
              {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
            </Button>
          </div>

          <div className="pc-form-item">
            <Input size="large" placeholder="昵称（选填）" value={nickname} onChange={setNickname} />
          </div>
          <div className="pc-form-item">
            <Input size="large" mode="password" placeholder="密码（至少 6 位）" value={password} onChange={setPassword} />
          </div>
          <div className="pc-form-item">
            <Input size="large" mode="password" placeholder="确认密码" value={confirm} onChange={setConfirm} />
          </div>
          <div className="pc-form-item">
            <Input size="large" placeholder="邀请码（选填）" value={inviteCode} onChange={setInviteCode} />
          </div>

          <label className="register-agree">
            <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
            <span>
              我已阅读并同意
              <Link href="/article/issue?categoryId=yhxy" target="_blank">《用户协议》</Link>
              和
              <Link href="/article/issue?categoryId=yszc" target="_blank">《隐私政策》</Link>
            </span>
          </label>

          {error ? <div className="pc-login-error">{error}</div> : null}
          <Button htmlType="submit" theme="solid" type="primary" size="large" block loading={loading}>
            注册
          </Button>
        </form>
        )}
        <div className="pc-login-links">
          <Link href="/login">已有账号？去登录</Link>
          <Link href="/">返回首页</Link>
        </div>
      </Card>
    </main>
  );
}
