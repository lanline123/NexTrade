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
    <div className="pg-auth-bind">
      {/* 源码 pages/member/BindMobilePhone.vue：.full-height-div > .register-info > .title + form.form-body
          > .el-form-item > .label + .el-input.input-border-style(.el-input__inner) + .el-input__suffix */}
      <div className="full-height-div">
        <div className="register-info">
          <div className="title">{t('绑定手机')}</div>

          <form className="form-body" onSubmit={submit}>
            {registType === 'mobile' ? (
              <div className="el-form-item">
                <div className="label">{t('手机号')}</div>
                <div className="el-input input-border-style">
                  <span className="el-input__prefix area-code-select">
                    <select className="el-select" value={areaCode} onChange={(event) => setAreaCode(event.target.value)}>
                      <option value="+86">(+86) {t('中国')}</option>
                      <option value="+61">(+61) {t('澳洲')}</option>
                    </select>
                  </span>
                  <input
                    className="el-input__inner"
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    placeholder={t('请输入手机号')}
                    maxLength={11}
                  />
                </div>
                <p className="bind-tip">{t('请填写正确的手机号码，以便接收订单通知，找回密码等')}</p>
              </div>
            ) : (
              <div className="el-form-item">
                <div className="label">{t('邮箱')}</div>
                <div className="el-input input-border-style">
                  <input
                    className="el-input__inner"
                    value={mail}
                    onChange={(event) => setMail(event.target.value)}
                    placeholder={t('请输入邮箱')}
                  />
                </div>
                <p className="bind-tip">{t('请填写正确的邮箱地址，以便接收订单通知，找回密码等')}</p>
              </div>
            )}

            <div className="el-form-item">
              <div className="label">{t('验证码')}</div>
              <div className="el-input input-border-style">
                <input
                  className="el-input__inner"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t('请输入验证码')}
                  maxLength={8}
                />
                <span className="el-input__suffix mobile-code-text">
                  <button className="el-button" type="button" disabled={sending || countdown > 0} onClick={() => void sendCode()}>
                    {countdown > 0 ? `${countdown}s` : t('获取验证码')}
                  </button>
                </span>
              </div>
            </div>

            <div className="el-form-item">
              <div className="label">{t('设置密码')}</div>
              <div className="el-input input-border-style">
                <input
                  className="el-input__inner"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('6-20 位字符')}
                />
              </div>
            </div>

            {/* 旧版这一行 v-if="false"，即默认不显示「手机验证 / 邮箱验证」切换；
                这里保留原样（切换入口在安全设置里），故不渲染。 */}

            {error ? <div className="error-notice">{error}</div> : null}

            <div className="el-form-item">
              <div style={{ width: 330 }}>
                <button className="el-button submit-button" type="submit" disabled={saving} style={{ width: 330 }}>
                  {saving ? t('提交中...') : t('确认')}
                </button>
              </div>
            </div>
          </form>

          <div className="login-box">
            <Link className="font-color" href="/member/security">
              {t('返回账户安全')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
