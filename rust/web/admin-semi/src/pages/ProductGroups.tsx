import { useState } from 'react';
import { Button, Modal, Space, Toast } from '@douyinfe/semi-ui';
import { apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

interface ProductGroupRow {
  productGroupId: number;
  productGroupName: string;
  productGroupSn?: string;
  productGroupDescription?: string;
  addTime?: string | number;
  productIds?: number[];
}

function formatTime(value?: string | number) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return new Date(value * 1000).toLocaleString('zh-CN', { hour12: false });
}

const columns: ColumnConfig<ProductGroupRow>[] = [
  { title: '分组名称', dataIndex: 'productGroupName', width: 220 },
  { title: '分组别名', dataIndex: 'productGroupSn', width: 180, render: (value: string) => value || '-' },
  {
    title: '分组描述',
    dataIndex: 'productGroupDescription',
    render: (value: string) => value || '-',
  },
  {
    title: '添加时间',
    dataIndex: 'addTime',
    width: 180,
    render: (value: string | number) => formatTime(value),
  },
];

export default function ProductGroups() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除商品分组'),
      content: t('确定删除选中的 {count} 个分组？', { count: ids.length }),
      onOk: async () => {
        if (isDemo()) {
          Toast.warning({ content: t('演示模式不支持操作') });
          return;
        }
        try {
          await apiPost('/product/productGroup/batch', { ids, type: 'del' });
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
    <ListPage<ProductGroupRow>
      key={reloadKey}
      api="/product/productGroup/list"
      rowKey="productGroupId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        {
          field: 'keyword',
          label: '商品分组',
          type: 'input',
          placeholder: '输入分组名称',
          width: 260,
        },
      ]}
      columns={columns}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.productGroupId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '商品分组',
        addText: '添加分组',
        width: 600,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/product/productGroup/create',
        updateApi: '/product/productGroup/update',
        detailApi: '/product/productGroup/detail',
        deleteApi: '/product/productGroup/del',
        idField: 'productGroupId',
        sections: [
          {
            key: 'basic',
            title: '分组信息',
            fields: [
              {
                field: 'productGroupName',
                label: t('分组名称'),
                required: true,
                placeholder: t('请输入分组名称'),
              },
              {
                field: 'productGroupSn',
                label: t('分组别名'),
                placeholder: t('请输入分组别名'),
              },
              {
                field: 'productGroupDescription',
                label: t('分组描述'),
                type: 'textarea',
              },
              {
                field: 'productIds',
                label: t('分组商品'),
                type: 'select',
                multiple: true,
                optionsApi: '/product/product/list',
                optionsParams: { page: 1, pageSize: 100 },
                optionLabel: 'productName',
                optionValue: 'productId',
                placeholder: t('请选择分组商品'),
              },
            ],
          },
        ],
      }}
    />
  );
}
