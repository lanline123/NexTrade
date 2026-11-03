import { useEffect, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconUser } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

interface WholesalerRow {
  wholesalerId: number;
  userId: number;
  username?: string;
  nickname?: string;
  mobile?: string;
  avatar?: string;
  fromTag?: number;
  fromTagName?: string;
  rankName?: string;
  authStatus?: number;
  authStatusName?: string;
  gradeId?: number;
  gradeName?: string;
  status: 0 | 1;
  addTime: string;
}

interface GradeOption {
  gradeId: number;
  gradeName: string;
}

const fromTagMap: Record<number, string> = {
  1: '公众号',
  2: '小程序',
  3: 'H5',
  4: 'PC',
  5: 'APP',
};

export function Wholesalers() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);

  // 添加弹窗
  const [addVisible, setAddVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState<{ userId?: number; gradeId?: number }>({});

  // 变更等级弹窗
  const [gradeVisible, setGradeVisible] = useState(false);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [currentWholesaler, setCurrentWholesaler] = useState<WholesalerRow | null>(null);
  const [targetGradeId, setTargetGradeId] = useState<number | undefined>();

  // 会员详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WholesalerRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<GradeOption[]>('/wholesale/grade/list', { status: 1 });
        setGradeOptions(Array.isArray(res) ? res : []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleStatusChange = async (record: WholesalerRow, checked: boolean) => {
    const nextStatus = checked ? 1 : 0;
    try {
      await apiPost('/wholesale/wholesaler/setStatus', {
        wholesalerId: record.wholesalerId,
        status: nextStatus,
      });
      Toast.success({ content: nextStatus === 1 ? t('已启用该批发商') : t('已禁用该批发商') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('状态切换失败') });
    }
  };

  const handleRemove = async (ids: number[]) => {
    try {
      await apiPost('/wholesale/wholesaler/remove', { wholesalerIds: ids });
      Toast.success({ content: t('移除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('移除失败') });
    }
  };

  const handleAddSubmit = async () => {
    if (!addForm.userId) {
      Toast.warning({ content: t('请输入或选择会员ID') });
      return;
    }
    if (!addForm.gradeId) {
      Toast.warning({ content: t('请选择批发商等级') });
      return;
    }
    setAddLoading(true);
    try {
      await apiPost('/wholesale/wholesaler/add', {
        userId: addForm.userId,
        gradeId: addForm.gradeId,
      });
      Toast.success({ content: t('添加批发商成功') });
      setAddVisible(false);
      setAddForm({});
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('添加失败') });
    } finally {
      setAddLoading(false);
    }
  };

  const handleChangeGradeSubmit = async () => {
    if (!currentWholesaler || !targetGradeId) return;
    setGradeLoading(true);
    try {
      await apiPost('/wholesale/wholesaler/changeGrade', {
        wholesalerId: currentWholesaler.wholesalerId,
        gradeId: targetGradeId,
      });
      Toast.success({ content: t('修改等级成功') });
      setGradeVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改等级失败') });
    } finally {
      setGradeLoading(false);
    }
  };

  const columns: ColumnConfig[] = [
    {
      title: '客户信息',
      dataIndex: 'customerInfo',
      width: 260,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesalerRow;
        return (
          <Space align="center" spacing={12}>
            <Avatar size="small" src={record.avatar} icon={<IconUser />} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>{record.username || record.nickname || '--'}</Text>
              <Text type="tertiary" size="small">{record.mobile || '--'}</Text>
              {record.fromTagName && (
                <Tag size="small" color="blue" style={{ marginTop: 2, width: 'fit-content' }}>
                  {record.fromTagName}
                </Tag>
              )}
            </div>
          </Space>
        );
      },
    },
    {
      title: '会员等级',
      dataIndex: 'rankName',
      width: 140,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '是否认证',
      dataIndex: 'authStatusName',
      width: 120,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '批发商等级',
      dataIndex: 'gradeName',
      width: 140,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: unknown, row: unknown) => {
        const record = row as WholesalerRow;
        return (
          <Switch
            checked={Number(v) === 1}
            onChange={(checked) => handleStatusChange(record, checked)}
          />
        );
      },
    },
    {
      title: '添加时间',
      dataIndex: 'addTime',
      width: 180,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 220,
      render: (_: unknown, row: unknown) => {
        const record = row as WholesalerRow;
        return (
          <Space spacing={4}>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => {
                setSelectedUser(record);
                setDetailVisible(true);
              }}
            >
              {t('查看')}
            </Button>
            <Button
              theme="borderless"
              type="primary"
              size="small"
              onClick={() => {
                setCurrentWholesaler(record);
                setTargetGradeId(record.gradeId);
                setGradeVisible(true);
              }}
            >
              {t('设置批发商等级')}
            </Button>
            <Popconfirm
              title={t('确认删除该批发商？')}
              content={t('删除后该用户不再是批发商。')}
              okType="danger"
              onConfirm={() => handleRemove([record.wholesalerId])}
            >
              <Button theme="borderless" type="danger" size="small">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <ListPage
        key={reloadKey}
        api="/wholesale/wholesaler/page"
        rowKey="wholesalerId"
        columns={columns}
        selectable
        batchActions={(rows: WholesalerRow[], clear) => (
          <Popconfirm
            title={t('确认删除所选批发商吗？')}
            content={t('删除后该用户不再是批发商。')}
            okType="danger"
            onConfirm={async () => {
              await handleRemove(rows.map((r) => r.wholesalerId));
              clear();
            }}
          >
            <Button type="danger" size="small">
              {t('批量删除')} ({rows.length})
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button icon={<IconPlus />} type="primary" onClick={() => setAddVisible(true)}>
            {t('添加批发商')}
          </Button>
        }
        filters={[
          {
            field: 'keyword',
            label: '客户信息',
            type: 'input',
            placeholder: '输入客户名称/手机号',
          },
          {
            field: 'fromTag',
            label: '注册渠道',
            type: 'select',
            placeholder: '请选择注册渠道',
            options: [
              { label: '公众号', value: 1 },
              { label: '小程序', value: 2 },
              { label: 'H5', value: 3 },
              { label: 'PC', value: 4 },
              { label: 'APP', value: 5 },
            ],
          },
          {
            field: 'gradeId',
            label: '批发商等级',
            type: 'select',
            placeholder: '请选择批发商等级',
            options: gradeOptions.map((g) => ({ label: g.gradeName, value: g.gradeId })),
          },
          {
            field: 'status',
            label: '批发商状态',
            type: 'select',
            placeholder: '请选择批发商状态',
            options: [
              { label: '启用', value: 1 },
              { label: '禁用', value: 0 },
            ],
          },
        ]}
      />

      {/* 添加批发商弹窗 */}
      <Modal
        title={t('添加批发商')}
        visible={addVisible}
        onCancel={() => setAddVisible(false)}
        onOk={handleAddSubmit}
        confirmLoading={addLoading}
        width={500}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('会员ID')}</div>
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('请输入会员ID')}
              value={addForm.userId}
              onChange={(val) => setAddForm({ ...addForm, userId: Number(val) || undefined })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('批发商等级')}</div>
            <Select
              style={{ width: '100%' }}
              placeholder={t('请选择批发商等级')}
              value={addForm.gradeId}
              onChange={(val) => setAddForm({ ...addForm, gradeId: Number(val) || undefined })}
            >
              {gradeOptions.map((g) => (
                <Select.Option key={g.gradeId} value={g.gradeId}>
                  {g.gradeName}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* 设置等级弹窗 */}
      <Modal
        title={t('设置批发商等级')}
        visible={gradeVisible}
        onCancel={() => setGradeVisible(false)}
        onOk={handleChangeGradeSubmit}
        confirmLoading={gradeLoading}
        width={450}
        okText={t('确定')}
        cancelText={t('取消')}
      >
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('批发商等级')}</div>
          <Select
            style={{ width: '100%' }}
            placeholder={t('请选择批发商等级')}
            value={targetGradeId}
            onChange={(val) => setTargetGradeId(Number(val) || undefined)}
          >
            {gradeOptions.map((g) => (
              <Select.Option key={g.gradeId} value={g.gradeId}>
                {g.gradeName}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* 会员详情查看弹窗 */}
      <Modal
        title={t('会员管理')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailVisible(false)}>
            {t('关闭')}
          </Button>
        }
        width={500}
      >
        {selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><Text strong>{t('客户名称：')}</Text>{selectedUser.username || selectedUser.nickname || '--'}</div>
            <div><Text strong>{t('手机号：')}</Text>{selectedUser.mobile || '--'}</div>
            <div><Text strong>{t('会员等级：')}</Text>{selectedUser.rankName || '--'}</div>
            <div><Text strong>{t('认证状态：')}</Text>{selectedUser.authStatusName || '--'}</div>
            <div><Text strong>{t('批发商等级：')}</Text>{selectedUser.gradeName || '--'}</div>
            <div><Text strong>{t('添加时间：')}</Text>{selectedUser.addTime || '--'}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
