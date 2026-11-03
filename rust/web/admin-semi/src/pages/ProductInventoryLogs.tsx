import { useState } from 'react';
import { Button, Tabs, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import { useI18n } from '../i18n';
import type { ColumnConfig } from '../framework/types';

interface InventoryLogRow {
  logId?: number;
  productName?: string;
  picThumb?: string;
  skuValue?: string;
  oldNumber?: number;
  number?: number;
  changeNumber?: number;
  desc?: string;
}

const LOG_TABS = [
  { value: 0, label: '全部' },
  { value: 1, label: '入库' },
  { value: 2, label: '出库' },
];

/** 库存日志：对应旧版 product/productInventoryLog/List.vue。 */
export default function ProductInventoryLogs() {
  const { t } = useI18n();
  const [logType, setLogType] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const columns: ColumnConfig<InventoryLogRow>[] = [
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 340,
      render: (value: string, row: InventoryLogRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.picThumb ? <img src={row.picThumb} alt="" width={36} height={36} style={{ borderRadius: 4, objectFit: 'cover' }} /> : null}
          <span>{value || '-'}</span>
        </div>
      ),
    },
    {
      title: '规格',
      dataIndex: 'skuValue',
      width: 300,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    { title: '变化前库存', dataIndex: 'oldNumber', width: 110 },
    { title: '变化后库存', dataIndex: 'number', width: 110 },
    {
      title: '变化量',
      dataIndex: 'changeNumber',
      width: 100,
      render: (value: number) => (
        <span style={{ color: Number(value) >= 0 ? 'var(--semi-color-success)' : 'var(--semi-color-danger)' }}>
          {Number(value) >= 0 ? `+${value}` : value}
        </span>
      ),
    },
    {
      title: '操作',
      dataIndex: 'desc',
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '操作时间', dataIndex: 'addTime' },
  ];

  return (
    <ListPage<InventoryLogRow>
      key={reloadKey}
      api="/product/productInventoryLog/list"
      rowKey={(row?: InventoryLogRow) => String(row?.logId ?? Math.random())}
      pageSize={10}
      actionWidth={120}
      query={{ type: logType }}
      filters={[
        { field: 'keyword', label: '关键词', type: 'input', placeholder: '输入关键词', width: 240 },
      ]}
      columns={columns}
      toolbarExtra={
        <Tabs
          type="button"
          size="small"
          activeKey={String(logType)}
          onChange={(key: string) => {
            setLogType(Number(key));
            reload();
          }}
          tabList={LOG_TABS.map((tab) => ({ tab: t(tab.label), itemKey: String(tab.value) }))}
        />
      }
      rowActions={(row) => (
        <Button
          theme="borderless"
          size="small"
          onClick={async () => {
            try {
              await apiPost('/product/productInventoryLog/batch', { ids: [row.logId], type: 'del' });
              Toast.success({ content: t('删除成功') });
              reload();
            } catch (error) {
              Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
            }
          }}
        >
          {t('删除')}
        </Button>
      )}
    />
  );
}
