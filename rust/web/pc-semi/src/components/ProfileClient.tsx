'use client';

/**
 * 个人资料
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/profile/Info.vue
 * - 用户信息：「请在这里填写准确的个人信息」
 * - 头像上传（/user/user/modifyAvatar）
 * - 生日（必填）、昵称（必填）、邮箱
 * - 手机/邮箱绑定状态：已绑定「修改」、未绑定「去绑定」
 * - 取消 / 保存
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface Profile {
  userId?: number;
  username?: string;
  nickname?: string;
  avatar?: string;
  mobile?: string;
  email?: string;
  birthday?: string;
}

export default function ProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ nickname: '', email: '', birthday: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  const applyProfile = (data: Profile) => {
    setProfile(data);
    setForm({
      nickname: data.nickname || '',
      email: data.email || '',
      birthday: String(data.birthday || '').slice(0, 10),
    });
  };

  useEffect(() => {
    apiGet<Profile>('user/user/detail')
      .then((result) => applyProfile(result || {}))
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  /** 源码 el-upload → /user/user/modifyAvatar */
  const uploadAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      Toast.error({ content: '头像需小于 2M' });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('accessToken') || '';
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/user/user/modifyAvatar', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        credentials: 'include',
      });
      const json = await response.json();
      if (json?.code !== undefined && json.code !== 0) {
        Toast.error({ content: String(json?.msg || json?.message || '上传失败') });
        return;
      }
      const data = json?.data;
      const url = typeof data === 'string' ? data : String(data?.avatar || data?.picUrl || '');
      if (url) setProfile((current) => ({ ...current, avatar: url }));
      Toast.success({ content: '头像已更新' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!form.birthday) return Toast.error({ content: '请选择生日' });
    if (!form.nickname.trim()) return Toast.error({ content: '请输入昵称' });
    setSaving(true);
    try {
      await apiPost('user/user/updateInformation', {
        nickname: form.nickname.trim(),
        email: form.email.trim(),
        birthday: form.birthday,
      });
      Toast.success({ content: '资料已更新' });
      setProfile((current) => ({ ...current, ...form }));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="member-card">资料加载中...</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后查看资料</h2>
        <Link href="/login?redirect=/member/profile">
          <Button theme="solid" type="primary" size="large">去登录</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="member-card member-profile">
      <h3 className="profile-title">用户信息</h3>
      <p className="profile-tip">请在这里填写准确的个人信息</p>

      <div className="profile-avatar">
        {profile?.avatar ? <img src={profile.avatar} alt="头像" /> : <span>头像</span>}
        <label className="profile-avatar__pick">
          {uploading ? '上传中...' : '更换头像'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadAvatar(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="security-form profile-form">
        <label>生日</label>
        <input type="date" value={form.birthday} onChange={(event) => setForm((current) => ({ ...current, birthday: event.target.value }))} />

        <label>昵称</label>
        <input value={form.nickname} onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))} placeholder="请输入昵称" />

        <label>手机</label>
        <div className="profile-bind">
          {profile?.mobile ? (
            <>
              <span>{profile.mobile}</span>
              <Link href="/member/security/info">[修改]</Link>
            </>
          ) : (
            <>
              <span>未绑定</span>
              <Link href="/member/security/info">[去绑定]</Link>
            </>
          )}
        </div>

        <label>邮箱</label>
        <div className="profile-bind">
          {profile?.email ? (
            <>
              <span>{profile.email}</span>
              <Link href="/member/security/info">[修改]</Link>
            </>
          ) : (
            <>
              <span>未绑定</span>
              <Link href="/member/security/info">[去绑定]</Link>
            </>
          )}
        </div>

        <div className="profile-actions">
          <Button onClick={() => window.history.back()}>取消</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>保存资料</Button>
        </div>
      </div>
    </Card>
  );
}
