'use client';

import { useEffect, useState } from 'react';

export default function OAuthCallbackPage() {
  const [message, setMessage] = useState('正在完成第三方登录...');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code') || '';
      const state = params.get('state') || '';
      // 后端把 provider 编码进 state 前缀（provider:uuid）。
      const stateSource = state.includes(':') ? state.split(':')[0] : '';
      const source = (params.get('source') || params.get('provider') || stateSource || 'google').toLowerCase();
      if (!code) {
        setMessage('缺少第三方授权 code，请重新登录');
        return;
      }
      try {
        const response = await fetch(`/api/user/oauth/callback/${source}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || (json.code !== undefined && json.code !== 0)) {
          throw new Error(json.msg || json.message || '第三方登录失败');
        }
        const data = json.data || {};
        const token = data.token || data.accessToken;
        if (!token) throw new Error('第三方登录未返回 token');
        localStorage.setItem('accessToken', token);
        document.cookie = `accessToken=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
        const returnUrl = data.returnUrl || '/';
        window.location.replace(typeof returnUrl === 'string' && returnUrl.startsWith('/') ? returnUrl : '/');
      } catch (reason) {
        setMessage(reason instanceof Error ? reason.message : '第三方登录失败');
      }
    };
    run();
  }, []);

  return (
    <main className="pc-static-page">
      <div className="pc-container">
        <div className="pc-static-card">
          <b>{message}</b>
          <p><a href="/login">返回登录</a></p>
        </div>
      </div>
    </main>
  );
}
