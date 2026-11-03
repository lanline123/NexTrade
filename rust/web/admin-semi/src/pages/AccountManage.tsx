import { useState } from 'react';
import { Avatar, Button, Input, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface AccountRow {
  adminId: number;
  username: string;
  avatar?: string;
  mobile?: string;
  email?: string;
  addTime?: string;
  isAdmin?: number;
  storeCount?: number;
  vendorCount?: number;
}

export default function AccountManage() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [editValues, setEditValues] = useState({ username: '', mobile: '', email: '' });
  const [passwordRow, setPasswordRow] = useState<AccountRow | null>(null);
  const [password, setPassword] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const columns: ColumnConfig<AccountRow>[] = [
    {
      title: '账号名称',
      dataIndex: 'username',
      width: 220,
      render: (value: string, record) => (
        <Space>
          <Avatar src={record.avatar} size="small">
            {(value || 'A').slice(0, 1)}
          </Avatar>
          <span>{value}</span>
        </Space>
      ),
    },
    { title: '手机', dataIndex: 'mobile', width: 170, render: (value: string) => value || '-' },
    { title: '邮箱', dataIndex: 'email', render: (value: string) => value || '-' },
    { title: '添加时间', dataIndex: 'addTime', width: 180, render: (value: string) => value || '-' },
    { title: '门店数', dataIndex: 'storeCount', width: 90, render: (value: number) => value || 0 },
    { title: '供应商数', dataIndex: 'vendorCount', width: 100, render: (value: number) => value || 0 },
  ];

  const saveAccount = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiPost('/admin/adminAccount/updateMainAccount', {
        adminId: editing.adminId,
        ...editValues,
      });
      Toast.success({ content: t('账号已更新') });
      setEditing(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!passwordRow) return;
    if (!password) {
      Toast.warning({ content: t('请输入新密码') });
      return;
    }
    if (password !== pwdConfirm) {
      Toast.warning({ content: t('两次密码输入不一致') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/admin/adminAccount/updateMainAccountPwd', {
        adminId: passwordRow.adminId,
        password,
        pwdConfirm,
      });
      Toast.success({ content: t('密码已修改') });
      setPasswordRow(null);
      setPassword('');
      setPwdConfirm('');
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改密码失败') });
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = (record: AccountRow) => {
    Modal.confirm({
      title: t('删除账号'),
      content: t('确定删除账号「{name}」？', { name: record.username }),
      onOk: async () => {
        try {
          await apiPost(`/admin/adminAccount/deleteAdminUser?adminId=${record.adminId}`, {});
          Toast.success({ content: t('删除成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  return (
    <>
      <ListPage<AccountRow>
        key={reloadKey}
        api="/admin/adminAccount/pageAdminUser"
        rowKey="adminId"
        pageSize={10}
        actionWidth={280}
        filters={[
          {
            field: 'keyword',
            label: '账号',
            type: 'input',
            placeholder: '输入账号名称',
            width: 260,
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Space spacing={2}>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setEditing(record);
                setEditValues({
                  username: record.username || '',
                  mobile: record.mobile || '',
                  email: record.email || '',
                });
              }}
            >
              {t('修改账号')}
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setPasswordRow(record);
                setPassword('');
                setPwdConfirm('');
              }}
            >
              {t('修改密码')}
            </Button>
            {record.isAdmin !== 1 && (
              <Button theme="borderless" type="danger" size="small" onClick={() => removeAccount(record)}>
                {t('删除')}
              </Button>
            )}
          </Space>
        )}
      />

      <Modal
        title={t('修改账号信息')}
        visible={Boolean(editing)}
        onCancel={() => setEditing(null)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setEditing(null)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={saveAccount}>
              {t('保存')}
            </Button>
          </Space>
        }
      >
        <div className="account-form">
          <label>{t('账号名称')}</label>
          <Input value={editValues.username} onChange={(value) => setEditValues({ ...editValues, username: value })} />
          <label>{t('手机号')}</label>
          <Input value={editValues.mobile} onChange={(value) => setEditValues({ ...editValues, mobile: value })} />
          <label>{t('邮箱')}</label>
          <Input value={editValues.email} onChange={(value) => setEditValues({ ...editValues, email: value })} />
        </div>
      </Modal>

      <Modal
        title={t('修改密码：{name}', { name: passwordRow?.username || '' })}
        visible={Boolean(passwordRow)}
        onCancel={() => setPasswordRow(null)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setPasswordRow(null)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={savePassword}>
              {t('确认修改')}
            </Button>
          </Space>
        }
      >
        <div className="account-form">
          <label>{t('新密码')}</label>
          <Input mode="password" value={password} onChange={setPassword} />
          <label>{t('确认密码')}</label>
          <Input mode="password" value={pwdConfirm} onChange={setPwdConfirm} />
          <Text type="tertiary" size="small">
            {t('修改密码会影响该账号登录后台的所有角色账号。')}
          </Text>
        </div>
      </Modal>
    </>
  );
}
