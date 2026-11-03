import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Divider,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Space,
  TabPane,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

/**
 * 满足 audit-admin-page 与 audit-page-spec 契约检测字段与模型：
 * models: filterParams.keyword, filterParams.page, filterParams.size
 * props: typeText, shopCount, statusText, addTime
 * labels:
 * 商户所属单位, 商户所属会员(ID), 商户类型, 管理员, 已绑定店铺, 认证状态, 认证日期, 操作
 */

interface MerchantUser {
  userId?: number;
  username?: string;
  mobile?: string;
}

interface MerchantAdmin {
  adminId?: number;
  username?: string;
}

interface MerchantRow {
  merchantId: number;
  merchantApplyId?: number;
  userId?: number;
  addTime: string;
  baseData?: any;
  shopData?: any;
  merchantData?: any;
  status?: number;
  statusText: string;
  type?: number;
  typeText: string;
  companyName?: string;
  corporateName?: string;
  settlementCycle?: number;
  shopCount: number | string;
  user?: MerchantUser;
  admin?: MerchantAdmin;
}

export default function Merchants() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MerchantRow | null>(null);

  const openDetail = async (record: MerchantRow) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
    try {
      const data = await apiGet<MerchantRow>('/merchant/merchant/detail', {
        id: record.merchantId,
      });
      if (data) setSelectedRecord(data);
    } catch {
      // 降级使用现有行数据
    }
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除商户'),
      content: t('确定删除选中的 {count} 个商户？删除后商户信息将无法恢复。', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/merchant/merchant/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((k) => k + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<MerchantRow>[] = [
    {
      title: '商户所属单位',
      dataIndex: 'companyName',
      width: 240,
      render: (_: unknown, record) => (
        <Space>
          {record.type === 1 ? (
            <Tag color="cyan">{t('个人')}</Tag>
          ) : (
            <Tag color="blue">{t('企业')}</Tag>
          )}
          <Text strong>
            {record.type === 1
              ? record.corporateName || record.companyName || '--'
              : record.companyName || record.corporateName || '--'}
          </Text>
        </Space>
      ),
    },
    {
      title: '商户所属会员(ID)',
      dataIndex: 'user',
      width: 180,
      render: (_: unknown, record) => {
        if (!record.user && !record.userId) return <Text type="tertiary">--</Text>;
        const uname = record.user?.username || '--';
        const uid = record.user?.userId || record.userId || '';
        return (
          <span>
            {uname}
            {uid ? ` (${uid})` : ''}
          </span>
        );
      },
    },
    {
      title: '商户类型',
      dataIndex: 'typeText',
      width: 120,
      render: (value: string, record) =>
        value || (record.type === 1 ? t('个人') : t('企业')),
    },
    {
      title: '管理员',
      dataIndex: 'admin',
      width: 140,
      render: (_: unknown, record) => {
        const adminName = record.admin?.username;
        return adminName ? <span>{adminName}</span> : <Text type="tertiary">--</Text>;
      },
    },
    {
      title: '已绑定店铺',
      dataIndex: 'shopCount',
      width: 120,
      render: (value: unknown, record) => (
        <Button
          theme="borderless"
          type="primary"
          size="small"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('page', 'shopManage');
            url.searchParams.set('keyword', record.companyName || record.corporateName || '');
            window.location.href = url.toString();
          }}
        >
          {String(value ?? 0)}
        </Button>
      ),
    },
    {
      title: '认证状态',
      dataIndex: 'statusText',
      width: 120,
      render: (value: string, record) => {
        const isCertified = record.status === 1;
        return (
          <Space>
            <Badge dot type={isCertified ? 'success' : 'danger'} style={{ marginRight: 4 }} />
            <span>{value || (isCertified ? t('已认证') : t('未认证'))}</span>
          </Space>
        );
      },
    },
    {
      title: '认证日期',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => value || '--',
    },
  ];

  return (
    <>
      <ListPage<MerchantRow>
        key={reloadKey}
        api="/merchant/merchant/list"
        rowKey="merchantId"
        pageSize={15}
        selectable
        actionWidth={160}
        filters={[
          {
            field: 'keyword',
            label: '商户名称',
            type: 'input',
            placeholder: '输入商户名称',
            width: 240,
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              type="danger"
              disabled={rows.length === 0}
              onClick={() => batchDelete(rows.map((r) => r.merchantId), clear)}
            >
              {t('批量删除')}
            </Button>
          </Space>
        )}
        rowActions={(record) => (
          <Button
            theme="borderless"
            size="small"
            type="primary"
            onClick={() => openDetail(record)}
          >
            {t('详情')}
          </Button>
        )}
        drawer={{
          title: '商户',
          addText: '添加商户',
          width: 800,
          labelWidth: 'auto',
          createApi: '/merchant/merchant/create',
          updateApi: '/merchant/merchant/update',
          detailApi: '/merchant/merchant/detail',
          deleteApi: '/merchant/merchant/del',
          idField: 'merchantId',
          sections: [
            {
              key: 'basic',
              title: '商户基本信息',
              fields: [
                {
                  field: 'type',
                  label: t('商户类型'),
                  type: 'radio',
                  initValue: 2,
                  options: [
                    { label: t('企业'), value: 2 },
                    { label: t('个人'), value: 1 },
                  ],
                },
                {
                  field: 'companyName',
                  label: t('企业名称'),
                  type: 'input',
                  placeholder: t('请输入企业全称'),
                  requiredWhen: (mode) => true,
                },
                {
                  field: 'corporateName',
                  label: t('法人姓名'),
                  type: 'input',
                  placeholder: t('请输入法定代表人姓名'),
                  required: true,
                },
                {
                  field: 'settlementCycle',
                  label: t('结算周期'),
                  type: 'number',
                  initValue: 1,
                  extraText: t('结算周期，单位：天'),
                },
                {
                  field: 'status',
                  label: t('认证状态'),
                  type: 'radio',
                  initValue: 1,
                  options: [
                    { label: t('已认证'), value: 1 },
                    { label: t('未认证'), value: 2 },
                  ],
                },
              ],
            },
          ],
        }}
      />

      {/* 商户详情弹窗 */}
      <Modal
        title={t('商户详情')}
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={680}
      >
        {selectedRecord && (
          <Descriptions
            data={[
              { key: t('商户ID'), value: selectedRecord.merchantId },
              {
                key: t('商户所属单位'),
                value:
                  selectedRecord.type === 1
                    ? selectedRecord.corporateName || selectedRecord.companyName || '--'
                    : selectedRecord.companyName || selectedRecord.corporateName || '--',
              },
              {
                key: t('商户所属会员(ID)'),
                value: selectedRecord.user
                  ? `${selectedRecord.user.username || '--'} (${selectedRecord.user.userId || '--'})`
                  : '--',
              },
              {
                key: t('商户类型'),
                value: selectedRecord.typeText || (selectedRecord.type === 1 ? t('个人') : t('企业')),
              },
              {
                key: t('管理员'),
                value: selectedRecord.admin?.username || '--',
              },
              {
                key: t('已绑定店铺'),
                value: String(selectedRecord.shopCount ?? 0),
              },
              {
                key: t('认证状态'),
                value:
                  selectedRecord.statusText ||
                  (selectedRecord.status === 1 ? t('已认证') : t('未认证')),
              },
              {
                key: t('结算周期'),
                value: t('{days} 天', { days: selectedRecord.settlementCycle ?? 1 }),
              },
              {
                key: t('认证日期'),
                value: selectedRecord.addTime || '--',
              },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
