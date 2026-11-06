'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    throw new Error(json.msg || json.message || `请求失败（${response.status}）`);
  }
  return json.data ?? json;
}

async function getCsrf(): Promise<string> {
  const response = await fetch('/api/common/csrf/create', { credentials: 'include' });
  const json = await response.json();
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || '获取 CSRF Token 失败');
  }
  return typeof json.data === 'string' ? json.data : json.data?.token || '';
}

export default function ResetPasswordClient() {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [mobileKey, setMobileKey] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    if (!mobile.trim()) {
      setError('请输入手机号');
      return;
    }
    setError('');
    try {
      const csrf = await getCsrf();
      await postJson('user/login/sendMobileCode', { mobile: mobile.trim(), event: 'forgetPassword' }, { 'X-CSRF-Token': csrf });
      setCountdown(60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mobile.trim() || !code.trim()) {
      setError('请输入手机号和验证码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await getCsrf();
      const result: any = await postJson('user/login/checkMobile', { mobile: mobile.trim(), code: code.trim() }, { 'X-CSRF-Token': csrf });
      const key = typeof result === 'string' ? result : result?.mobileKey;
      if (!key) throw new Error('验证失败');
      setMobileKey(key);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证失败');
    } finally {
      setLoading(false);
    }
  };

  const reset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || password.length < 6) {
      setError('请输入至少 6 位新密码');
      return;
    }
    if (password !== password2) {
      setError('两次密码输入不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const csrf = await getCsrf();
      await postJson('user/login/forgetPassword', { mobileKey, password }, { 'X-CSRF-Token': csrf });
      window.location.href = '/login?reset=1';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重置密码失败');
    } finally {
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
      <div className="pc-login-card pc-login-native">
        <h2>找回密码</h2>
        <p>{step === 1 ? '验证手机号后设置新密码' : '设置新的登录密码'}</p>
        {step === 1 ? (
          <form onSubmit={verify}>
            <label htmlFor="reset-mobile">手机号码</label>
            <input id="reset-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="请输入手机号" autoComplete="tel" />
            <label htmlFor="reset-code">验证码</label>
            <div className="pc-reset-code-row">
              <input id="reset-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入验证码" />
              <button type="button" disabled={countdown > 0} onClick={() => void sendCode()}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</button>
            </div>
            {error ? <div className="pc-login-native__error">{error}</div> : null}
            <button type="submit" disabled={loading}>{loading ? '验证中...' : '下一步'}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <label htmlFor="reset-password">新密码</label>
            <input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入新密码" autoComplete="new-password" />
            <label htmlFor="reset-password2">确认密码</label>
            <input id="reset-password2" type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} placeholder="请再次输入新密码" autoComplete="new-password" />
            {error ? <div className="pc-login-native__error">{error}</div> : null}
            <button type="submit" disabled={loading}>{loading ? '提交中...' : '重置密码'}</button>
          </form>
        )}
        <div className="pc-login-tip">
          想起密码了？<Link href="/login">返回登录</Link>
        </div>
      </div>
    </main>
  );
}
