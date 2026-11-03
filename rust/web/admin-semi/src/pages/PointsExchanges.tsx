import { useState } from 'react';
import { Button, Modal, Space, Switch, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import ProductPicker from '../components/ProductPicker';
import type { ColumnConfig } from '../framework/types';

interface PointsExchangeRow {
  pointsExchangeId: number;
  productId?: number;
  productName?: string;
  exchangeIntegral?: number;
  pointsDeductedAmount?: number | string;
  isEnabled?: number;
  isHot?: number;
}

/** 积分商品：对应旧版 promotion/pointsExchange/List.vue + Info.vue。 */
export default function PointsExchanges() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const updateField = async (row: PointsExchangeRow, field: string, value: unknown) => {
    try {
      await apiPost('/promotion/pointsExchange/updateField', { id: row.pointsExchangeId, field, value });
      Toast.success({ content: t('修改成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const columns: ColumnConfig<PointsExchangeRow>[] = [
    {
      title: '积分商品名称',
      dataIndex: 'productName',
      width: 350,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '使用积分值',
      dataIndex: 'exchangeIntegral',
      width: 130,
      render: (value: unknown) => <span title={t('使用积分值')}>{value != null ? String(value) : '-'}</span>,
    },
    {
      title: '减免金额',
      dataIndex: 'pointsDeductedAmount',
      width: 120,
      render: (value: unknown) => <span title={t('减免金额')}>{value != null ? String(value) : '-'}</span>,
    },
    {
      title: '是否可兑换',
      dataIndex: 'isEnabled',
      width: 120,
      render: (value: number, row: PointsExchangeRow) => (
        <span title={Number(value) === 1 ? t('可兑换') : t('不可兑换')}><Switch checked={Number(value) === 1} onChange={(next) => updateField(row, 'isEnabled', next ? 1 : 0)} /></span>
      ),
    },
    {
      title: '是否热销',
      dataIndex: 'isHot',
      width: 110,
      render: (value: number, row: PointsExchangeRow) => (
        <span title={Number(value) === 1 ? t('热销') : t('不热销')}><Switch checked={Number(value) === 1} onChange={(next) => updateField(row, 'isHot', next ? 1 : 0)} /></span>
      ),
    },
  ];

  return (
    <ListPage<PointsExchangeRow>
      key={reloadKey}
      api="/promotion/pointsExchange/list"
      rowKey="pointsExchangeId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        { field: 'keyword', label: '积分商品', type: 'input', placeholder: '输入积分商品名称', width: 240 },
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
                  await apiPost('/promotion/pointsExchange/batch', {
                    ids: rows.map((row) => row.pointsExchangeId),
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
                title: t('确认删除该积分商品吗？'),
                onOk: async () => {
                  try {
                    await apiPost('/promotion/pointsExchange/del', { id: row.pointsExchangeId });
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
        title: '积分商品',
        addText: '添加积分商品',
        width: 560,
        labelWidth: 'auto',
        createApi: '/promotion/pointsExchange/create',
        updateApi: '/promotion/pointsExchange/update',
        detailApi: '/promotion/pointsExchange/detail',
        deleteApi: '/promotion/pointsExchange/del',
        idField: 'pointsExchangeId',
        sections: [
          {
            key: 'basic',
            title: '兑换设置',
            fields: [
              { field: 'exchangeIntegral', label: t('兑换积分'), type: 'number', required: true, extraText: t('兑换该商品所需积分') },
              { field: 'pointsDeductedAmount', label: t('减免金额'), type: 'number', required: true },
              {
                field: 'isEnabled',
                label: t('兑换'),
                type: 'radio',
                initValue: 1,
                options: [
                  { label: t('是'), value: 1 },
                  { label: t('否'), value: 0 },
                ],
              },
              {
                field: 'isHot',
                label: t('是否热销'),
                type: 'radio',
                initValue: 0,
                options: [
                  { label: t('是'), value: 1 },
                  { label: t('否'), value: 0 },
                ],
              },
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
                  </div>
                ),
              },
            ],
          },
        ],
        toPayload: (values) => {
          const productIds = Array.isArray(values.productId)
            ? values.productId
            : values.productId
              ? [Number(values.productId)]
              : [];
          if (!productIds.length) {
            throw new Error(t('请选择商品!'));
          }
          return {
            ...values,
            productId: productIds[0],
            exchangeIntegral: Number(values.exchangeIntegral ?? 0),
            pointsDeductedAmount: Number(values.pointsDeductedAmount ?? 0),
            isEnabled: Number(values.isEnabled ?? 1),
            isHot: Number(values.isHot ?? 0),
          };
        },
      }}
    />
  );
}
