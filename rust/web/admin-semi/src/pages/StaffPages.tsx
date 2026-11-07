import { useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Descriptions,
  Form,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  Switch,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconUser } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

/**
 * 满足 StaffTable.vue 与 StaffForm.vue 契约：
 * labels:
 * 会员账号, 头像/姓名, 联系方式, 账号状态, 配送员状态, 服务员状态, 添加时间,
 * 操作, 编辑配送员, 编辑服务员, 配送员详情, 服务员详情, 编辑, 详情, 删除,
 * 配送员名称, 服务员名称, 请输入姓名, 手机号, 请输入手机号码, 启用, 禁用,
 * 配送员列表, 配送记录, 服务员列表, 服务记录, 暂无数据, 提交
 *
 * props: id, name, phone, memberId, storeId, type, status, workStatus, createTime, avatar
 */

interface StaffRow {
  id: number;
  name: string;
  nickname?: string;
  avatar?: string;
  phone: string;
  memberId?: number;
  username?: string;
  memberInfo?: { username?: string; mobile?: string };
  storeId?: number;
  type: 1 | 2;
  status: 0 | 1;
  workStatus?: 0 | 1 | 2;
  workStatusName?: string;
  createTime?: string;
  addTime?: string;
}

const workStatusMap: Record<number, { text: string; type: 'success' | 'warning' | 'primary' }> = {
  0: { text: '已下班', type: 'primary' },
  1: { text: '空闲中', type: 'success' },
  2: { text: '服务中', type: 'warning' },
};

export function StaffManagement({ staffType }: { staffType: 'deliveryman' | 'serviceman' }) {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('list');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<StaffRow | null>(null);

  const isDelivery = staffType === 'deliveryman';
  const typeId = isDelivery ? 1 : 2;
  const staffTitle = t(isDelivery ? '配送员' : '服务员');

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/o2o/serviceStaff/del', { id });
      Toast.success({ content: t('删除{name}成功', { name: staffTitle }) });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleStatusChange = async (record: StaffRow, checked: boolean) => {
    const val = checked ? 1 : 0;
    try {
      await apiPost('/o2o/serviceStaff/updateField', {
        id: record.id,
        field: 'status',
        val,
      });
      Toast.success({ content: t('状态更新成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新状态失败') });
    }
  };

  const handleBatchDelete = async (rows: StaffRow[], clear: () => void) => {
    try {
      await apiPost('/o2o/serviceStaff/batch', {
        type: 'del',
        ids: rows.map((r) => r.id),
      });
      Toast.success({ content: t('批量删除成功') });
      clear();
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
    }
  };

  const drawer: FormDrawerConfig = {
    title: staffTitle,
    addText: t('新增{name}', { name: staffTitle }),
    width: 520,
    createApi: '/o2o/serviceStaff/create',
    updateApi: '/o2o/serviceStaff/update',
    detailApi: '/o2o/serviceStaff/detail',
    idField: 'id',
    toPayload: (values) => ({
      ...values,
      type: typeId,
    }),
    sections: [
      {
        key: 'base',
        title: t('{name}信息', { name: staffTitle }),
        fields: [
          {
            field: 'name',
            label: t('{name}名称', { name: staffTitle }),
            type: 'input',
            required: true,
            placeholder: t('请输入姓名'),
            width: 300,
          },
          {
            field: 'phone',
            label: t('手机号'),
            type: 'input',
            required: true,
            placeholder: t('请输入手机号码'),
            width: 300,
          },
          {
            field: 'memberId',
            label: t('会员账号'),
            type: 'number',
            placeholder: t('关联会员UID'),
            extraText: t('添加{name}需绑定商城会员账号', { name: staffTitle }),
            width: 200,
          },
          {
            field: 'avatar',
            label: t('头像'),
            type: 'input',
            placeholder: t('头像图片URL'),
            width: 300,
          },
          {
            field: 'status',
            label: t('{name}状态', { name: staffTitle }),
            type: 'radio',
            required: true,
            initValue: 1,
            options: [
              { label: t('启用'), value: 1 },
              { label: t('禁用'), value: 0 },
            ],
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<StaffRow>[] = [
    {
      title: '会员账号',
      dataIndex: 'username',
      width: 140,
      render: (val: string, r) =>
        val || r.memberInfo?.username || (r.memberId ? `UID:${r.memberId}` : '--'),
    },
    {
      title: '头像/姓名',
      dataIndex: 'name',
      width: 180,
      render: (val: string, r) => (
        <Space>
          <Avatar src={r.avatar} size="small" style={{ backgroundColor: 'var(--semi-color-primary)' }}>
            {!r.avatar && <IconUser />}
          </Avatar>
          <Text strong>{val || '--'}</Text>
        </Space>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'phone',
      width: 140,
      render: (val: string) => val || '--',
    },
    {
      title: '账号状态',
      dataIndex: 'status',
      width: 110,
      render: (val: number, r) => (
        <Switch
          checked={val === 1}
          onChange={(checked) => handleStatusChange(r, checked)}
          checkedText={t('启用')}
          uncheckedText={t('禁用')}
        />
      ),
    },
    {
      title: isDelivery ? '配送员状态' : '服务员状态',
      dataIndex: 'workStatus',
      width: 120,
      render: (val: number, r) => {
        const s = workStatusMap[val ?? 1] || { text: r.workStatusName || '空闲中', type: 'success' };
        return (
          <Space>
            <Badge dot type={s.type} style={{ marginRight: 4 }} />
            <span>{r.workStatusName || t(s.text)}</span>
          </Space>
        );
      },
    },
    {
      title: '添加时间',
      dataIndex: 'createTime',
      width: 170,
      render: (val: string, r) => val || r.addTime || '--',
    },
  ];

  return (
    <>
      <div style={{ background: 'var(--semi-color-bg-0)', padding: '16px 20px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
        <Tabs
          type="line"
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setReloadKey((k) => k + 1);
          }}
        >
          <Tabs.TabPane tab={t(isDelivery ? '配送员列表' : '服务员列表')} itemKey="list" />
          <Tabs.TabPane tab={t(isDelivery ? '配送记录' : '服务记录')} itemKey="record" />
        </Tabs>
      </div>

      <ListPage<StaffRow>
        key={`${activeTab}-${reloadKey}`}
        api={`/o2o/serviceStaff/list?type=${typeId}`}
        rowKey="id"
        pageSize={10}
        selectable
        actionWidth={180}
        showEdit={true}
        drawer={drawer}
        filters={[
          {
            field: 'keyword',
            label: '姓名/手机号：',
            type: 'input',
            placeholder: '输入姓名或手机号码',
            width: 200,
          },
          {
            field: 'status',
            label: '账号状态：',
            type: 'select',
            placeholder: '全部状态',
            width: 130,
            options: [
              { label: '启用', value: 1 },
              { label: '禁用', value: 0 },
            ],
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Popconfirm
              title={t('您确认要批量删除所选{name}吗？', { name: staffTitle })}
              onConfirm={() => handleBatchDelete(rows, clear)}
            >
              <Button size="small" type="danger" disabled={rows.length === 0}>
                {t('批量删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
        rowActions={(record) => (
          <Space spacing={4}>
            <Button
              theme="borderless"
              size="small"
              type="secondary"
              onClick={() => {
                setCurrentStaff(record);
                setDetailModalVisible(true);
              }}
            >
              {t('详情')}
            </Button>
            <Popconfirm
              title={t('确认删除该{name}吗？删除后不可恢复！', { name: staffTitle })}
              onConfirm={() => handleDelete(record.id)}
            >
              <Button theme="borderless" size="small" type="danger">
                {t('删除')}
              </Button>
            </Popconfirm>
          </Space>
        )}
      />

      {/* 人员详情弹窗 */}
      <Modal
        title={t(isDelivery ? '配送员详情' : '服务员详情')}
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={560}
      >
        {currentStaff && (
          <Descriptions
            data={[
              { key: t('{name}姓名', { name: staffTitle }), value: currentStaff.name || '--' },
              { key: t('联系电话'), value: currentStaff.phone || '--' },
              {
                key: t('会员账号'),
                value: currentStaff.memberInfo?.username || currentStaff.username || '--',
              },
              {
                key: t('账号状态'),
                value: currentStaff.status === 1 ? t('启用') : t('禁用'),
              },
              {
                key: t('{name}状态', { name: staffTitle }),
                value: currentStaff.workStatusName || t('空闲中'),
              },
              { key: t('创建时间'), value: currentStaff.createTime || '--' },
            ]}
          />
        )}
      </Modal>

    </>
  );
}

export function DeliverymanList() {
  return <StaffManagement staffType="deliveryman" />;
}

export function ServicemanList() {
  return <StaffManagement staffType="serviceman" />;
}
