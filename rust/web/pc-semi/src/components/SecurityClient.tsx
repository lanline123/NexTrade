'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface UserInfo { mobile?: string; email?: string; }
type BindType = 'mobile' | 'email';

function mask(value?: string): string {
  if (!value) return '未绑定';
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export default function SecurityClient() {
    const { t } = useTranslation();
  const [user, setUser] = useState<UserInfo>({});
  const [loading, setLoading] = useState(true);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwdCountdown, setPwdCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [bindType, setBindType] = useState<BindType | null>(null);
  const [bindStep, setBindStep] = useState(1);
  const [oldCode, setOldCode] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCode, setNewCode] = useState('');
  const [oldCountdown, setOldCountdown] = useState(0);
  const [newCountdown, setNewCountdown] = useState(0);
  const [bindSubmitting, setBindSubmitting] = useState(false);

  const refresh = () => {
    apiGet<UserInfo>('user/user/detail')
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (pwdCountdown <= 0) return;
    const timer = window.setTimeout(() => setPwdCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [pwdCountdown]);
  useEffect(() => {
    if (oldCountdown <= 0) return;
    const timer = window.setTimeout(() => setOldCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [oldCountdown]);
  useEffect(() => {
    if (newCountdown <= 0) return;
    const timer = window.setTimeout(() => setNewCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [newCountdown]);

  const sendPwdCode = async () => {
    try {
      await apiPost('user/user/sendMobileCodeByModifyPassword', {});
      setPwdCountdown(60);
      Toast.success({ content: '验证码已发送' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '验证码发送失败' });
    }
  };

  const submitPassword = async () => {
    if (!code || !password) return Toast.error({ content: '请输入验证码和新密码' });
    if (password.length < 6) return Toast.error({ content: '新密码至少 6 位' });
    if (password !== confirm) return Toast.error({ content: '两次密码输入不一致' });
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

  const openBind = (type: BindType) => {
    setBindType(type);
    setBindStep(user[type] ? 1 : 2);
    setOldCode('');
    setNewCode('');
    setNewMobile('');
    setNewEmail('');
  };

  const sendOldCode = async () => {
    if (!bindType) return;
    try {
      if (bindType === 'mobile') await apiPost('user/user/sendMobileCodeByMobileValidate', {});
      else await apiPost('user/user/sendEmailCodeByEmailValidate', {});
      setOldCountdown(60);
      Toast.success({ content: '验证码已发送' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '验证码发送失败' });
    }
  };

  const verifyOld = async () => {
    if (!bindType || !oldCode) return Toast.error({ content: '请输入原验证码' });
    try {
      if (bindType === 'mobile') await apiPost('user/user/mobileValidate', { code: oldCode });
      else await apiPost('user/user/emailValidateNew', { email: user.email, code: oldCode });
      setBindStep(2);
      Toast.success({ content: '验证通过，请填写新账号' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '验证失败' });
    }
  };

  const sendNewCode = async () => {
    if (!bindType) return;
    try {
      if (bindType === 'mobile') {
        if (!newMobile) return Toast.error({ content: '请输入新手机号' });
        await apiPost('user/user/sendMobileCodeByModifyMobile', { mobile: newMobile });
      } else {
        if (!newEmail) return Toast.error({ content: '请输入新邮箱' });
        await apiPost('user/user/sendEmailCodeByModifyEmail', { email: newEmail });
      }
      setNewCountdown(60);
      Toast.success({ content: '验证码已发送' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '验证码发送失败' });
    }
  };

  const submitBind = async () => {
    if (!bindType || !newCode) return Toast.error({ content: '请输入新验证码' });
    setBindSubmitting(true);
    try {
      if (bindType === 'mobile') {
        if (!newMobile) throw new Error('请输入新手机号');
        await apiPost('user/user/modifyMobile', { mobile: newMobile, code: newCode });
      } else {
        if (!newEmail) throw new Error('请输入新邮箱');
        await apiPost('user/user/modifyEmail', { email: newEmail, code: newCode });
      }
      Toast.success({ content: '换绑成功' });
      setBindType(null);
      refresh();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '换绑失败' });
    } finally {
      setBindSubmitting(false);
    }
  };

  return (
    <Card className="member-card security-card" title={t('账户安全')} loading={loading}>
      <ul className="security-list">
        <li>
          <span className="security-list__label">{t('手机')}</span>
          <span className="security-list__value">{mask(user.mobile)}</span>
          <button type="button" className="security-list__action" onClick={() => openBind('mobile')}>{user.mobile ? t('换绑') : '绑定'}</button>
        </li>
        <li>
          <span className="security-list__label">{t('邮箱')}</span>
          <span className="security-list__value">{mask(user.email)}</span>
          <button type="button" className="security-list__action" onClick={() => openBind('email')}>{user.email ? t('换绑') : '绑定'}</button>
        </li>
        <li>
          <span className="security-list__label">{t('登录密码')}</span>
          <span className="security-list__value">{t('已设置')}</span>
          <button type="button" className="security-list__action" onClick={() => setPwdOpen(true)}>{t('修改')}</button>
        </li>
      </ul>
      <div className="security-tips">
        <b>{t('安全服务提示')}</b>
        <p>{t('1. 注意防范进入钓鱼网站，不要轻信各种即时通讯工具发送的商品或支付链接，谨防网购诈骗。')}</p>
        <p>{t('2. 建议您安装杀毒软件，并定期更新操作系统等软件补丁，确保账户及交易安全。')}</p>
      </div>

      <Modal title={t('修改登录密码')} visible={pwdOpen} onCancel={() => setPwdOpen(false)} footer={null}>
        <div className="security-form">
          <label>{t('验证码')}</label>
          <div className="security-form__row">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('请输入短信验证码')} />
            <Button disabled={pwdCountdown > 0} onClick={() => void sendPwdCode()}>{pwdCountdown > 0 ? `${pwdCountdown}s` : '获取验证码'}</Button>
          </div>
          <label>{t('新密码')}</label>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('请输入新密码')} />
          <label>{t('确认新密码')}</label>
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={t('请再次输入新密码')} />
          <Button theme="solid" type="primary" loading={submitting} onClick={() => void submitPassword()}>{t('确认修改')}</Button>
        </div>
      </Modal>

      <Modal title={bindType === 'mobile' ? t('手机换绑') : '邮箱换绑'} visible={!!bindType} onCancel={() => setBindType(null)} footer={null}>
        <div className="security-form">
          {bindStep === 1 ? (
            <>
              <p className="security-form__tip">请先验证当前{bindType === 'mobile' ? t('手机') : '邮箱'}</p>
              <label>{t('原验证码')}</label>
              <div className="security-form__row">
                <input value={oldCode} onChange={(event) => setOldCode(event.target.value)} placeholder={t('请输入原验证码')} />
                <Button disabled={oldCountdown > 0} onClick={() => void sendOldCode()}>{oldCountdown > 0 ? `${oldCountdown}s` : '获取验证码'}</Button>
              </div>
              <Button theme="solid" type="primary" onClick={() => void verifyOld()}>{t('下一步')}</Button>
            </>
          ) : (
            <>
              <label>新{bindType === 'mobile' ? t('手机号') : '邮箱'}</label>
              <input
                value={bindType === 'mobile' ? newMobile : newEmail}
                onChange={(event) => bindType === 'mobile' ? setNewMobile(event.target.value) : setNewEmail(event.target.value)}
                placeholder={bindType === 'mobile' ? t('请输入新手机号') : '请输入新邮箱'}
              />
              <label>{t('新验证码')}</label>
              <div className="security-form__row">
                <input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder={t('请输入新验证码')} />
                <Button disabled={newCountdown > 0} onClick={() => void sendNewCode()}>{newCountdown > 0 ? `${newCountdown}s` : '获取验证码'}</Button>
              </div>
              <Button theme="solid" type="primary" loading={bindSubmitting} onClick={() => void submitBind()}>{t('确认换绑')}</Button>
            </>
          )}
        </div>
      </Modal>
    </Card>
  );
}
