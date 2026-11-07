import { useEffect, useState } from 'react';
import { Avatar, Banner, Button, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
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
      <Tabs
        type="line"
        defaultActiveKey="accounts"
        tabList={[
          { itemKey: 'accounts', tab: t('账号管理') },
          { itemKey: 'apiToken', tab: t('API Token') },
        ]}
        style={{ marginBottom: 12 }}
      >
        <Tabs.TabPane itemKey="accounts" tab={t('账号管理')}>
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
        </Tabs.TabPane>
        <Tabs.TabPane itemKey="apiToken" tab={t('API Token')}>
          <ApiTokenPanel />
        </Tabs.TabPane>
      </Tabs>

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

/* ============================== API Token（旧版 accountEditing/ApiToken.vue + GenerateToken.vue） ============================== */

interface ApiTokenRow {
  id: number;
  tokenPrefix: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number | null;
  expiresAt?: number | null;
  isActive: number;
}

const tokenTime = (value: number | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(Number(value) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const isTokenExpired = (expiresAt?: number | null): boolean =>
  Boolean(expiresAt) && Number(expiresAt) * 1000 < Date.now();

function ApiTokenPanel() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ApiTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | null>(30);
  const [generated, setGenerated] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadList = () => {
    setLoading(true);
    apiGet<ApiTokenRow[]>('/authority/adminUser/apiToken/list')
      .then((result) => setRows(Array.isArray(result) ? result : []))
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('获取 Token 列表失败') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
  }, []);

  const generate = async () => {
    setSaving(true);
    try {
      const result = await apiPost<{ token?: string }>('/authority/adminUser/apiToken/generate', {
        name: name.trim() || undefined,
        expiresInDays,
      });
      setGenerated(result?.token || '');
      setCopied(false);
      loadList();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('生成失败') });
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
    } catch {
      Toast.warning({ content: t('复制失败，请手动选择复制') });
    }
  };

  const revoke = async (row: ApiTokenRow) => {
    try {
      await apiPost('/authority/adminUser/apiToken/revoke', { id: row.id });
      Toast.success({ content: t('Token 已吊销') });
      loadList();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('吊销失败') });
    }
  };

  const tokenStatus = (row: ApiTokenRow): { text: string; color: string } => {
    if (row.isActive === 0) return { text: t('已吊销'), color: 'grey' };
    if (isTokenExpired(row.expiresAt)) return { text: t('已过期'), color: 'red' };
    return { text: t('有效'), color: 'green' };
  };

  return (
    <div>
      <Button theme="solid" type="primary" onClick={() => {
        setName('');
        setExpiresInDays(30);
        setGenerated('');
        setGenerateOpen(true);
      }}>
        {t('生成 Token')}
      </Button>
      <Table<ApiTokenRow>
        style={{ marginTop: 12 }}
        loading={loading}
        dataSource={rows}
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: 'Token',
            dataIndex: 'tokenPrefix',
            render: (value: string) => <code>{value}************************</code>,
          },
          { title: t('名称'), dataIndex: 'name' },
          {
            title: t('创建时间'),
            dataIndex: 'createdAt',
            width: 170,
            render: (value: number) => tokenTime(value),
          },
          {
            title: t('最后使用'),
            dataIndex: 'lastUsedAt',
            width: 170,
            render: (value?: number | null) => (value ? tokenTime(value) : t('从未使用')),
          },
          {
            title: t('过期时间'),
            dataIndex: 'expiresAt',
            width: 170,
            render: (value?: number | null) => (value ? tokenTime(value) : t('永不过期')),
          },
          {
            title: t('状态'),
            dataIndex: 'isActive',
            width: 90,
            render: (_: unknown, row: ApiTokenRow) => {
              const status = tokenStatus(row);
              return <Tag color={status.color as never}>{status.text}</Tag>;
            },
          },
          {
            title: t('操作'),
            width: 90,
            render: (_: unknown, row: ApiTokenRow) =>
              row.isActive === 1 ? (
                <Popconfirm
                  title={t('确认要吊销此 Token 吗？吊销后将无法恢复。')}
                  onConfirm={() => void revoke(row)}
                >
                  <Button theme="borderless" type="danger" size="small">
                    {t('吊销')}
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]}
        empty={t('暂无 Token')}
      />

      <Modal
        title={t('生成 API Token')}
        visible={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        width={520}
        footer={
          generated ? (
            <Button theme="solid" type="primary" onClick={() => setGenerateOpen(false)}>
              {t('完成')}
            </Button>
          ) : (
            <Space>
              <Button onClick={() => setGenerateOpen(false)}>{t('取消')}</Button>
              <Button theme="solid" type="primary" loading={saving} onClick={() => void generate()}>
                {t('生成')}
              </Button>
            </Space>
          )
        }
      >
        {generated ? (
          <>
            <Banner
              type="warning"
              closeIcon={null}
              style={{ marginBottom: 14 }}
              description={t('请立即复制并保存此 Token，关闭后将无法再次查看完整内容。')}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, wordBreak: 'break-all', padding: 8, background: 'var(--semi-color-fill-0)', borderRadius: 4 }}>
                {generated}
              </code>
              <Button theme="solid" size="small" onClick={() => void copyToken()}>
                {copied ? t('已复制') : t('复制')}
              </Button>
            </div>
          </>
        ) : (
          <div className="account-form">
            <label>{t('名称/备注')}</label>
            <Input value={name} onChange={setName} maxLength={50} placeholder={t('请输入 Token 用途备注')} />
            <label>{t('有效期')}</label>
            <Select
              value={expiresInDays ?? undefined}
              optionList={[
                { label: t('7 天'), value: 7 },
                { label: t('30 天'), value: 30 },
                { label: t('60 天'), value: 60 },
                { label: t('90 天'), value: 90 },
                { label: t('永不过期'), value: 0 },
              ]}
              onChange={(next) => setExpiresInDays(Number(next) === 0 ? null : Number(next))}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
