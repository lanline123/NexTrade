import { useState } from 'react';
import {
  Badge,
  Button,
  Descriptions,
  Divider,
  Image,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

/**
 * 供应商列表 (vendorListManage)
 * 逆向自 5.8.60 o2o_admin 产物 List-L9JNm4OB.js + suppliers-BVumaBiu.js
 * 对应 Rust 接口: /vendor/vendor/list, detail, create, updateInfo, delVendor
 * 文案与字段契约:
 * 供应商, 输入供应商名称, 主账号, 输入主账号名称, 状态, 开启, 关闭, 搜索, 重置, 添加供应商
 * 供应商名称, 联系人姓名, 联系方式, 主账号, 企业属性, 个人, 企业, 供应商状态, 创建时间, 操作, 详情, 编辑, 删除
 */

interface VendorRow {
  vendorId: number;
  vendorName?: string;
  vendorLogo?: string;
  contactName?: string;
  contactMobile?: string;
  loginAccount?: string;
  type?: number;
  status?: number;
  addTime?: string;
}

export default function VendorList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<VendorRow | null>(null);

  const openDetail = async (record: VendorRow) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
    try {
      const data = await apiGet<VendorRow>('/vendor/vendor/detail', {
        id: record.vendorId,
      });
      if (data) setSelectedRecord(data);
    } catch {
      // 降级使用已有行数据
    }
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除供应商'),
      content: t('确定删除选中的 {count} 个供应商？删除后供应商信息将无法恢复。', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/vendor/vendor/delVendor', { ids });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((k) => k + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<VendorRow>[] = [
    {
      title: '供应商名称',
      dataIndex: 'vendorName',
      width: 220,
      render: (value: string, record) => (
        <Space>
          {record.vendorLogo ? (
            <Image
              src={record.vendorLogo}
              width={40}
              height={40}
              style={{ objectFit: 'contain', borderRadius: 4 }}
            />
          ) : (
            <Text type="tertiary">{t('[暂无图片]')}</Text>
          )}
          <Text strong>{value || '--'}</Text>
        </Space>
      ),
    },
    {
      title: '企业属性',
      dataIndex: 'type',
      width: 120,
      render: (value: number) =>
        value === 1 ? (
          <Tag color="cyan">{t('个人')}</Tag>
        ) : (
          <Tag color="blue">{t('企业')}</Tag>
        ),
    },
    {
      title: '联系人姓名',
      dataIndex: 'contactName',
      width: 140,
      render: (value: string) => value || '--',
    },
    {
      title: '联系方式',
      dataIndex: 'contactMobile',
      width: 150,
      render: (value: string) => value || '--',
    },
    {
      title: '主账号',
      dataIndex: 'loginAccount',
      width: 150,
      render: (value: string, record) =>
        value ? (
          <Button
            theme="borderless"
            type="primary"
            size="small"
            onClick={() => {
              setSelectedRecord(record);
              setAdminModalVisible(true);
            }}
          >
            {value}
          </Button>
        ) : (
          <Text type="tertiary">--</Text>
        ),
    },
    {
      title: '供应商状态',
      dataIndex: 'status',
      width: 120,
      render: (value: number) => {
        const isOpen = value === 1;
        return (
          <Space>
            <Badge dot type={isOpen ? 'success' : 'danger'} style={{ marginRight: 4 }} />
            <span>{isOpen ? t('开启') : t('关闭')}</span>
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => value || '--',
    },
  ];

  return (
    <>
      <ListPage<VendorRow>
        key={reloadKey}
        api="/vendor/vendor/list"
        rowKey="vendorId"
        pageSize={15}
        selectable
        actionWidth={160}
        filters={[
          {
            field: 'keyword',
            label: '供应商',
            type: 'input',
            placeholder: '输入供应商名称',
            width: 200,
          },
          {
            field: 'mainAccount',
            label: '主账号',
            type: 'input',
            placeholder: '输入主账号名称',
            width: 180,
          },
          {
            field: 'status',
            label: '状态',
            type: 'select',
            placeholder: '供应商状态',
            width: 130,
            options: [
              { label: '开启', value: 1 },
              { label: '关闭', value: 2 },
            ],
          },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              type="danger"
              disabled={rows.length === 0}
              onClick={() => batchDelete(rows.map((r) => r.vendorId), clear)}
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
          title: '供应商',
          addText: '添加供应商',
          width: 700,
          labelWidth: 'auto',
          createApi: '/vendor/vendor/create',
          updateApi: '/vendor/vendor/updateInfo',
          detailApi: '/vendor/vendor/detail',
          deleteApi: '/vendor/vendor/delVendor',
          idField: 'vendorId',
          sections: [
            {
              key: 'basic',
              title: '基本信息',
              fields: [
                {
                  field: 'type',
                  label: t('企业属性'),
                  type: 'radio',
                  initValue: 2,
                  options: [
                    { label: t('企业'), value: 2 },
                    { label: t('个人'), value: 1 },
                  ],
                },
                {
                  field: 'vendorName',
                  label: t('供应商名称'),
                  type: 'input',
                  placeholder: t('请输入供应商名称'),
                  required: true,
                },
                {
                  field: 'vendorLogo',
                  label: t('供应商LOGO'),
                  type: 'custom',
                  render: ({ formApi, values }) => (
                    <ImageUploader
                      single
                      max={1}
                      value={values.vendorLogo ? [values.vendorLogo] : []}
                      onChange={(urls) => formApi?.setValue('vendorLogo', urls[0] || '')}
                    />
                  ),
                },
                {
                  field: 'contactName',
                  label: t('联系人姓名'),
                  type: 'input',
                  placeholder: t('请输入联系人姓名'),
                },
                {
                  field: 'contactMobile',
                  label: t('联系方式'),
                  type: 'input',
                  placeholder: t('请输入联系方式'),
                },
                {
                  field: 'status',
                  label: t('供应商状态'),
                  type: 'radio',
                  initValue: 1,
                  options: [
                    { label: t('开启'), value: 1 },
                    { label: t('关闭'), value: 2 },
                  ],
                },
              ],
            },
          ],
        }}
      />

      {/* 供应商详情弹窗 */}
      <Modal
        title={t('供应商详情')}
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={640}
      >
        {selectedRecord && (
          <Descriptions
            data={[
              { key: t('供应商ID'), value: selectedRecord.vendorId },
              { key: t('供应商名称'), value: selectedRecord.vendorName || '--' },
              {
                key: t('企业属性'),
                value: selectedRecord.type === 1 ? t('个人') : t('企业'),
              },
              { key: t('联系人姓名'), value: selectedRecord.contactName || '--' },
              { key: t('联系方式'), value: selectedRecord.contactMobile || '--' },
              { key: t('主账号'), value: selectedRecord.loginAccount || '--' },
              {
                key: t('供应商状态'),
                value: selectedRecord.status === 1 ? t('开启') : t('关闭'),
              },
              { key: t('创建时间'), value: selectedRecord.addTime || '--' },
            ]}
          />
        )}
      </Modal>

      {/* 主账号管理弹窗 */}
      <Modal
        title={t('主账号管理')}
        visible={adminModalVisible}
        onCancel={() => setAdminModalVisible(false)}
        footer={
          <Button type="primary" onClick={() => setAdminModalVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={480}
      >
        {selectedRecord && (
          <Descriptions
            data={[
              { key: t('供应商ID'), value: selectedRecord.vendorId },
              { key: t('供应商名称'), value: selectedRecord.vendorName || '--' },
              { key: t('登录主账号'), value: selectedRecord.loginAccount || t('未绑定主账号') },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
