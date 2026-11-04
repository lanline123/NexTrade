'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface UserInfo {
  mobile?: string;
  email?: string;
}

function mask(value?: string): string {
  if (!value) return '未绑定';
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export default function SecurityClient() {
  const [user, setUser] = useState<UserInfo>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<UserInfo>('user/user/detail')
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const sendCode = async () => {
    try {
      await apiPost('user/user/sendMobileCodeByModifyPassword', {});
      setCountdown(60);
      Toast.success({ content: '验证码已发送' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '验证码发送失败' });
    }
  };

  const submit = async () => {
    if (!code || !password) {
      Toast.error({ content: '请输入验证码和新密码' });
      return;
    }
    if (password.length < 6) {
      Toast.error({ content: '新密码至少 6 位' });
      return;
    }
    if (password !== confirm) {
      Toast.error({ content: '两次密码输入不一致' });
      return;
    }
    setSubmitting(true);
    try {
      await apiPost('user/user/checkModifyPasswordMobileCode', { password, code });
      Toast.success({ content: '密码修改成功，请重新登录' });
      localStorage.removeItem('accessToken');
      document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
      window.location.href = '/login';
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '修改失败' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="member-card security-card" loading={loading}>
      <ul className="security-list">
        <li>
          <span className="security-list__label">手机</span>
          <span className="security-list__value">{mask(user.mobile)}</span>
          <span className="security-list__action">换绑</span>
        </li>
        <li>
          <span className="security-list__label">邮箱</span>
          <span className="security-list__value">{mask(user.email)}</span>
          <span className="security-list__action">换绑</span>
        </li>
        <li>
          <span className="security-list__label">登录密码</span>
          <span className="security-list__value">已设置</span>
          <button type="button" className="security-list__action" onClick={() => setOpen(true)}>修改</button>
        </li>
      </ul>
      <div className="security-tips">
        <b>安全服务提示</b>
        <p>1. 注意防范进入钓鱼网站，不要轻信各种即时通讯工具发送的商品或支付链接，谨防网购诈骗。</p>
        <p>2. 建议您安装杀毒软件，并定期更新操作系统等软件补丁，确保账户及交易安全。</p>
      </div>

      <Modal title="修改登录密码" visible={open} onCancel={() => setOpen(false)} footer={null}>
        <div className="security-form">
          <label>验证码</label>
          <div className="security-form__row">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="请输入短信验证码" />
            <Button disabled={countdown > 0} onClick={() => void sendCode()}>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Button>
          </div>
          <label>新密码</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入新密码" />
          <label>确认新密码</label>
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="请再次输入新密码" />
          <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>确认修改</Button>
        </div>
      </Modal>
    </Card>
  );
}
