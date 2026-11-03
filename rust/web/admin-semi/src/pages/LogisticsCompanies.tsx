import { useState } from 'react';
import { Button, Modal, Space, Switch, Toast, Typography } from '@douyinfe/semi-ui';
import { apiPost, isDemo } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface LogisticsRow {
  logisticsId: number;
  logisticsName: string;
  logisticsCode?: string;
  apiLogisticsCode?: string;
  kuaidi100Code?: string;
  logisticsDesc?: string;
  sortOrder?: number;
  isEnabled?: number;
  isShow?: number;
}

function EnabledSwitch({ row, value }: { row: LogisticsRow; value?: number }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);
  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/setting/logisticsCompany/updateField', {
        id: row.logisticsId,
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

const columns: ColumnConfig<LogisticsRow>[] = [
  { title: '物流公司名称', dataIndex: 'logisticsName', width: 220 },
  {
    title: '编号',
    dataIndex: 'apiLogisticsCode',
    width: 180,
    render: (_: unknown, record) =>
      record.apiLogisticsCode || record.logisticsCode || record.kuaidi100Code || '-',
  },
  {
    title: '物流公司描述',
    dataIndex: 'logisticsDesc',
    render: (value: string) => value || '-',
  },
  {
    title: '是否启用',
    dataIndex: 'isEnabled',
    width: 110,
    render: (value: number, record) => <EnabledSwitch row={record} value={value} />,
  },
  { title: '排序', dataIndex: 'sortOrder', width: 90 },
];

export default function LogisticsCompanies() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除物流公司'),
      content: t('确定删除选中的 {count} 个物流公司？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/setting/logisticsCompany/batch', { ids, type: 'del' });
          Toast.success({ content: t('批量删除成功') });
          clear();
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const sync = (provider: 'kdn' | 'kuaidi100') => {
    Modal.confirm({
      title: provider === 'kdn' ? t('同步快递鸟数据') : t('同步快递100数据'),
      content: t('同步会覆盖当前物流公司基础数据，是否继续？'),
      onOk: async () => {
        try {
          await apiPost(
            provider === 'kdn'
              ? '/setting/logisticsCompany/syncKdn'
              : '/setting/logisticsCompany/syncKuaidi100',
            {},
          );
          Toast.success({ content: t('同步完成') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('同步失败') });
        }
      },
    });
  };

  return (
    <ListPage<LogisticsRow>
      key={reloadKey}
      api="/setting/logisticsCompany/list"
      rowKey="logisticsId"
      pageSize={10}
      selectable
      actionWidth={150}
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
      toolbarExtra={
        <Space>
          <Button onClick={() => sync('kdn')}>{t('同步快递鸟')}</Button>
          <Button onClick={() => sync('kuaidi100')}>{t('同步快递100')}</Button>
        </Space>
      }
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.logisticsId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '物流公司',
        addText: '添加物流公司',
        width: 600,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/setting/logisticsCompany/create',
        updateApi: '/setting/logisticsCompany/update',
        detailApi: '/setting/logisticsCompany/detail',
        deleteApi: '/setting/logisticsCompany/del',
        idField: 'logisticsId',
        sections: [
          {
            key: 'basic',
            title: '物流公司信息',
            fields: [
              {
                field: 'logisticsName',
                label: t('物流公司名称'),
                required: true,
                placeholder: t('请输入物流公司名称'),
              },
              {
                field: 'logisticsCode',
                label: t('快递鸟编号'),
                placeholder: t('如 SF'),
              },
              {
                field: 'kuaidi100Code',
                label: t('快递100编号'),
                placeholder: t('小写字母，如 shunfeng'),
              },
              {
                field: 'logisticsDesc',
                label: t('物流公司描述'),
                type: 'textarea',
              },
              { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
              {
                field: 'isEnabled',
                label: t('是否启用'),
                type: 'switch',
                initValue: 1,
                checkedText: t('启用'),
                uncheckedText: t('禁用'),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          sortOrder: Number(values.sortOrder ?? 50),
          isEnabled: values.isEnabled ? 1 : 0,
        }),
      }}
    />
  );
}
