import { useState } from 'react';
import { Button, Modal, Popconfirm, Space, Switch, Toast } from '@douyinfe/semi-ui';
import { apiPost, isDemo } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

interface LogisticsConfigRow {
  logisticsConfigId: number;
  logisticsId: number;
  logisticsName?: string;
  logisticsCode?: string;
  logisticsDesc?: string;
  customerName?: string;
  monthCode?: string;
  sendSite?: string;
  sendStaff?: string;
  isEnabled?: number;
  sortOrder?: number;
}

function EnabledSwitch({ row, value }: { row: LogisticsConfigRow; value?: number }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);
  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/setting/logisticsCompanyConfig/updateField', {
        id: row.logisticsConfigId,
        field: 'isEnabled',
        val: next ? 1 : 0,
      });
      setChecked(next);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };
  return <Switch checked={checked} onChange={toggle} size="small" />;
}

const columns: ColumnConfig<LogisticsConfigRow>[] = [
  { title: '物流公司名称', dataIndex: 'logisticsName', width: 220, render: (value: string) => value || '-' },
  { title: '编号', dataIndex: 'logisticsCode', width: 130, render: (value: string) => value || '-' },
  { title: '物流公司描述', dataIndex: 'logisticsDesc', render: (value: string) => value || '-' },
  { title: '客户编码', dataIndex: 'customerName', width: 150, render: (value: string) => value || '-' },
  { title: '月结号', dataIndex: 'monthCode', width: 140, render: (value: string) => value || '-' },
  { title: '网点编码', dataIndex: 'sendSite', width: 140, render: (value: string) => value || '-' },
  { title: '网点名称', dataIndex: 'sendStaff', width: 140, render: (value: string) => value || '-' },
  {
    title: '是否启用',
    dataIndex: 'isEnabled',
    width: 110,
    render: (value: number, record) => <EnabledSwitch row={record} value={value} />,
  },
];

export default function LogisticsSettings() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const setDefault = async (record: LogisticsConfigRow) => {
    try {
      await apiPost('/setting/logisticsCompanyConfig/setDefault', { id: record.logisticsConfigId });
      Toast.success({ content: t('已设为默认物流') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('设置失败') });
    }
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除物流配置'),
      content: t('确定删除选中的 {count} 条配置？', { count: ids.length }),
      onOk: async () => {
        try {
          await Promise.all(ids.map((id) => apiPost('/setting/logisticsCompanyConfig/del', { id })));
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  return (
    <ListPage<LogisticsConfigRow>
      key={reloadKey}
      api="/setting/logisticsCompanyConfig/list"
      rowKey="logisticsConfigId"
      pageSize={10}
      selectable
      actionWidth={200}
      filters={[
        {
          field: 'keyword',
          label: '物流公司',
          type: 'input',
          placeholder: '输入物流公司名称',
          width: 260,
        },
      ]}
      columns={columns}
      rowActions={(record) => (
        <Space spacing={2}>
          <Popconfirm title={t('确认将该配置设为默认物流吗？')} onConfirm={() => setDefault(record)}>
            <Button theme="borderless" size="small">
              {t('设为默认')}
            </Button>
          </Popconfirm>
        </Space>
      )}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.logisticsConfigId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '物流配置',
        addText: '添加物流配置',
        width: 620,
        labelWidth: 'auto',
        inputWidth: 440,
        createApi: '/setting/logisticsCompanyConfig/create',
        updateApi: '/setting/logisticsCompanyConfig/update',
        detailApi: '/setting/logisticsCompanyConfig/detail',
        deleteApi: '/setting/logisticsCompanyConfig/del',
        idField: 'logisticsConfigId',
        sections: [
          {
            key: 'base',
            title: '物流公司',
            fields: [
              {
                field: 'logisticsId',
                label: t('物流公司'),
                type: 'select',
                required: true,
                placeholder: t('请选择物流公司'),
                optionsApi: '/setting/logisticsCompany/list',
                optionsParams: { page: 1, pageSize: 100 },
                optionLabel: 'logisticsName',
                optionValue: 'logisticsId',
              },
              { field: 'customerName', label: t('客户编码') },
              { field: 'customerPwd', label: t('密码'), type: 'input' },
              { field: 'monthCode', label: t('月结号') },
              { field: 'sendSite', label: t('网点编码') },
              { field: 'sendStaff', label: t('网点名称') },
              { field: 'expType', label: t('快递业务类型') },
            ],
          },
          {
            key: 'kuaidi100',
            title: '快递100 面单',
            fields: [
              { field: 'kuaidi100PartnerId', label: 'partnerId' },
              { field: 'kuaidi100PartnerKey', label: 'partnerKey' },
              { field: 'kuaidi100PartnerSecret', label: 'partnerSecret' },
              { field: 'kuaidi100Net', label: t('收件网点名称') },
              { field: 'kuaidi100CheckMan', label: t('承载快递员名') },
              { field: 'kuaidi100ExpType', label: t('产品类型') },
              { field: 'kuaidi100TempId', label: t('面单模板ID') },
              { field: 'kuaidi100ChildTempId', label: t('子单模板ID') },
              { field: 'kuaidi100BackTempId', label: t('回单模板ID') },
            ],
          },
          {
            key: 'status',
            title: '状态',
            fields: [
              { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
              {
                field: 'isEnabled',
                label: t('是否启用'),
                type: 'switch',
                initValue: 1,
                checkedText: t('启用'),
                uncheckedText: t('停用'),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          logisticsConfigId: values.logisticsConfigId
            ? Number(values.logisticsConfigId)
            : undefined,
          logisticsId: values.logisticsId ? Number(values.logisticsId) : undefined,
          sortOrder: Number(values.sortOrder ?? 50),
          isEnabled: values.isEnabled ? 1 : 0,
        }),
      }}
    />
  );
}
