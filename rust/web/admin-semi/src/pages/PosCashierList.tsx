import { useEffect, useState } from 'react';
import { Avatar, Button, Card, Input, Modal, Pagination, Space, Table, Tag, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';

interface CashierRow {
  id: number;
  adminId?: number;
  username?: string;
  email?: string;
  avatar?: string;
  isUsing?: number;
  addTime?: number;
}

const emptyForm = { username: '', email: '', password: '', isUsing: 1 };

export default function PosCashierList() {
  const { t } = useI18n();
  const [rows, setRows] = useState<CashierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashierRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiPost<{ records?: CashierRow[]; total?: number }>('/pos/adminUserPos/list', {
      page,
      size: 10,
      keyword,
    })
      .then((result) => {
        setRows(result?.records || []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('加载失败') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: CashierRow) => {
    setEditing(row);
    setForm({
      username: row.username || '',
      email: row.email || '',
      password: '',
      isUsing: row.isUsing ?? 1,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.username.trim()) {
      Toast.warning({ content: t('请输入收银员姓名/账号') });
      return;
    }
    if (!editing && !form.password) {
      Toast.warning({ content: t('请输入密码') });
      return;
    }
    setSaving(true);
    try {
      await apiPost(editing ? '/pos/adminUserPos/update' : '/pos/adminUserPos/create', {
        id: editing?.id,
        adminId: editing?.adminId,
        ...form,
        password: form.password || undefined,
      });
      Toast.success({ content: t('保存成功') });
      setOpen(false);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: CashierRow) => {
    Modal.confirm({
      title: t('删除收银员'),
      content: t('确定删除「{name}」？', { name: row.username || '' }),
      onOk: async () => {
        try {
          await apiPost('/pos/adminUserPos/del', { id: row.id });
          Toast.success({ content: t('删除成功') });
          load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const toggleStatus = async (row: CashierRow) => {
    try {
      await apiPost('/pos/adminUserPos/updateField', {
        id: row.id,
        field: 'isUsing',
        val: row.isUsing === 1 ? 2 : 1,
      });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  return (
    <Card className="cashier-list-card">
      <div className="cashier-list-toolbar">
        <input
          className="cashier-list-search"
          placeholder={t('姓名/手机号')}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              load();
            }
          }}
        />
        <Button
          theme="solid"
          type="primary"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          {t('搜索')}
        </Button>
        <Button onClick={openCreate}>{t('+ 添加收银员')}</Button>
      </div>
      <Table<CashierRow>
        dataSource={rows}
        loading={loading}
        pagination={false}
        rowKey="id"
        columns={[
          {
            title: t('头像/姓名'),
            dataIndex: 'username',
            render: (value: string, record) => (
              <Space>
                <Avatar size="small" src={record.avatar}>
                  {(value || '收').slice(0, 1)}
                </Avatar>
                <span>{value || '-'}</span>
              </Space>
            ),
          },
          { title: t('手机号'), dataIndex: 'email', render: (value: string) => value || '-' },
          {
            title: t('账号状态'),
            dataIndex: 'isUsing',
            width: 110,
            render: (value: number) => (
              <Tag color={value === 1 ? 'green' : 'grey'}>{value === 1 ? t('启用') : t('禁用')}</Tag>
            ),
          },
          {
            title: t('添加时间'),
            dataIndex: 'addTime',
            width: 170,
            render: (value: number) => (value ? new Date(value * 1000).toLocaleString() : '-'),
          },
          {
            title: t('操作'),
            width: 220,
            render: (_value, record) => (
              <Space spacing={2}>
                <Button theme="borderless" size="small" onClick={() => openEdit(record)}>
                  {t('编辑')}
                </Button>
                <Button theme="borderless" size="small" onClick={() => toggleStatus(record)}>
                  {record.isUsing === 1 ? t('禁用') : t('启用')}
                </Button>
                <Button theme="borderless" type="danger" size="small" onClick={() => remove(record)}>
                  {t('删除')}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <div className="cashier-list-pagination">
        <Pagination total={total} pageSize={10} currentPage={page} onPageChange={(next) => setPage(next)} />
      </div>

      <Modal
        title={editing ? t('编辑收银员') : t('添加收银员')}
        visible={open}
        onCancel={() => setOpen(false)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={save}>
              {t('保存')}
            </Button>
          </Space>
        }
      >
        <div className="cashier-form">
          <label>{t('姓名/账号')}</label>
          <Input
            value={form.username}
            onChange={(next) => setForm((current) => ({ ...current, username: next }))}
          />
          <label>{t('手机号/邮箱')}</label>
          <Input
            value={form.email}
            onChange={(next) => setForm((current) => ({ ...current, email: next }))}
          />
          <label>{editing ? t('重置密码（留空不修改）') : t('密码')}</label>
          <Input
            mode="password"
            value={form.password}
            onChange={(next) => setForm((current) => ({ ...current, password: next }))}
          />
        </div>
      </Modal>
    </Card>
  );
}
