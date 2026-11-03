import { useState } from 'react';
import { Button, Modal, Space, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import ProductPicker from '../components/ProductPicker';
import type { ColumnConfig } from '../framework/types';

interface ProductGiftRow {
  giftId: number;
  giftName?: string;
  productName?: string;
  giftStock?: number;
}

/** 活动赠品：对应旧版 promotion/productGift/List.vue + Info.vue。 */
export default function ProductGifts() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const columns: ColumnConfig<ProductGiftRow>[] = [
    {
      title: '赠品名称',
      dataIndex: 'giftName',
      width: 180,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '商品信息',
      dataIndex: 'productName',
      width: 300,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    { title: '赠品库存', dataIndex: 'giftStock', width: 110 },
  ];

  return (
    <ListPage<ProductGiftRow>
      key={reloadKey}
      api="/promotion/productGift/list"
      rowKey="giftId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        { field: 'keyword', label: '赠品名称', type: 'input', placeholder: '输入赠品名称', width: 240 },
      ]}
      columns={columns}
      batchActions={(rows, clear) => (
        <Button
          size="small"
          onClick={() => {
            Modal.confirm({
              title: t('您确认要批量删除所选数据吗？'),
              onOk: async () => {
                try {
                  await apiPost('/promotion/productGift/batch', {
                    ids: rows.map((row) => row.giftId),
                    type: 'del',
                  });
                  Toast.success({ content: t('批量删除成功') });
                  clear();
                  reload();
                } catch (error) {
                  Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
                }
              },
            });
          }}
        >
          {t('批量删除')}
        </Button>
      )}
      rowActions={(row) => (
        <Space spacing={2}>
          <Button theme="borderless" size="small">
            {t('编辑')}
          </Button>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('确认删除该赠品吗？'),
                onOk: async () => {
                  try {
                    await apiPost('/promotion/productGift/del', { id: row.giftId });
                    Toast.success({ content: t('删除成功') });
                    reload();
                  } catch (error) {
                    Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
                  }
                },
              });
            }}
          >
            {t('删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '赠品',
        addText: '添加赠品',
        width: 560,
        labelWidth: 'auto',
        createApi: '/promotion/productGift/create',
        updateApi: '/promotion/productGift/update',
        detailApi: '/promotion/productGift/detail',
        deleteApi: '/promotion/productGift/del',
        idField: 'giftId',
        sections: [
          {
            key: 'basic',
            title: '赠品信息',
            fields: [
              { field: 'giftName', label: t('赠品名称'), type: 'input', required: true },
              {
                field: 'productId',
                label: t('选择商品'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <div>
                    <ProductPicker
                      value={Array.isArray(values.productId)
                        ? (values.productId as number[])
                        : values.productId
                          ? [Number(values.productId)]
                          : []}
                      onChange={(ids) => formApi?.setValue('productId', ids)}
                      max={1}
                    />
                    <input type="hidden" data-field="skuId" data-gift-stock="giftStock" />
                  </div>
                ),
              },
              { field: 'giftStock', label: t('赠品库存'), type: 'number', initValue: 0 },
            ],
          },
        ],
        toPayload: (values) => {
          const productIds = Array.isArray(values.productId)
            ? values.productId
            : values.productId
              ? [Number(values.productId)]
              : [];
          if (!values.giftName || !String(values.giftName).trim()) {
            throw new Error(t('赠品名称不能为空!'));
          }
          return {
            ...values,
            productId: productIds[0] ?? 0,
            giftStock: Number(values.giftStock ?? 0),
          };
        },
      }}
    />
  );
}
