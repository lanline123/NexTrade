'use client';

/**
 * 绑定手机
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/BindMobilePhone.vue
 * - 手机号（含区号 +86 / +61）+ 短信验证码 + 设置密码
 * - 邮箱验证切换（源码 registType）
 * 接口：POST /api/user/login/sendMobileCode
 *       POST /api/user/login/bindMobile
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast, Typography } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';
export default function BindMobilePhoneClient() {
    const { t } = useTranslation();
  const [registType, setRegistType] = useState<'mobile' | 'mail'>('mobile');
  const [areaCode, setAreaCode] = useState('+86');
  const [mobile, setMobile] = useState('');
  const [mail, setMail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startCountdown = () => {
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
  };

  const sendCode = async () => {
    if (countdown > 0 || sending) return;
    if (registType === 'mobile' && !/^1\d{10}$/.test(mobile.trim())) {
      setError('请填写正确的手机号码，以便接收订单通知，找回密码等');
      return;
    }
    setSending(true);
    setError('');
    try {
      const url = registType === 'mobile' ? '/api/user/login/sendMobileCode' : '/api/user/login/sendEmailCode';
      const payload = registType === 'mobile' ? { mobile: mobile.trim(), areaCode } : { email: mail.trim() };
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
      startCountdown();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registType === 'mobile' && !/^1\d{10}$/.test(mobile.trim())) return setError('请填写正确的手机号码');
    if (registType === 'mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim())) return setError('请填写正确的邮箱地址');
    if (!code.trim()) return setError('请输入验证码');
    if (password.length < 6 || password.length > 20) return setError('密码应为6-20位字符');
    if (/\s/.test(password)) return setError('密码中不允许有空格');
    if (/^\d+$/.test(password) || /^[a-zA-Z]+$/.test(password)) return setError('密码不能全为数字或全为字母');

    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/user/login/bindMobile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: registType === 'mobile' ? mobile.trim() : '',
          email: registType === 'mail' ? mail.trim() : '',
          mobileCode: code.trim(),
          password,
          areaCode,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || (json.code !== undefined && json.code !== 0)) {
        throw new Error(json.msg || json.message || t('绑定失败'));
      }
      Toast.success({ content: '绑定成功' });
      setTimeout(() => window.location.replace('/member/security'), 600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '绑定失败');
      setSaving(false);
    }
  };

  return (
    <main className="pc-login-page">
      <Card className="pc-login-card">
        <Typography.Title heading={3} style={{ marginBottom: 6 }}>{t('绑定手机')}</Typography.Title>
        <Typography.Text type="tertiary">{t('绑定后可用于登录、找回密码与接收订单通知')}</Typography.Text>

        <form onSubmit={submit} style={{ marginTop: 16 }}>
          {registType === 'mobile' ? (
            <>
              <label className="bind-label">{t('手机号')}</label>
              <div className="bind-row">
                <select value={areaCode} onChange={(event) => setAreaCode(event.target.value)} className="bind-area">
                  <option value="+86">(+86) 中国</option>
                  <option value="+61">(+61) 澳洲</option>
                </select>
                <input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder={t('请输入手机号')} maxLength={11} className="bind-input" />
              </div>
              <p className="bind-tip">{t('请填写正确的手机号码，以便接收订单通知，找回密码等')}</p>
            </>
          ) : (
            <>
              <label className="bind-label">{t('邮箱')}</label>
              <div className="bind-row">
                <input value={mail} onChange={(event) => setMail(event.target.value)} placeholder={t('请输入邮箱')} className="bind-input" />
              </div>
              <p className="bind-tip">{t('请填写正确的邮箱地址，以便接收订单通知，找回密码等')}</p>
            </>
          )}

          <label className="bind-label">{t('验证码')}</label>
          <div className="bind-row">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('请输入验证码')} maxLength={8} className="bind-input" />
            <Button loading={sending} disabled={countdown > 0} onClick={() => void sendCode()}>
              {countdown > 0 ? `${countdown}s` : '获取验证码'}
            </Button>
          </div>

          <label className="bind-label">{t('设置密码')}</label>
          <div className="bind-row">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('6-20 位字符')} className="bind-input" />
          </div>

          <div className="bind-switch">
            <button type="button" onClick={() => setRegistType(registType === 'mobile' ? 'mail' : 'mobile')}>
              {registType === 'mobile' ? t('邮箱验证') : '手机验证'}
            </button>
          </div>

          {error ? <div className="pc-login-error">{error}</div> : null}

          <Button htmlType="submit" theme="solid" type="primary" size="large" block loading={saving}>{t('绑定手机')}</Button>
        </form>

        <div className="pc-login-links">
          <Link href="/member/security">{t('返回账户安全')}</Link>
          <Link href="/">{t('返回首页')}</Link>
        </div>
      </Card>
    </main>
  );
}
