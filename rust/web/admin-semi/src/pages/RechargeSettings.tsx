import { useState } from 'react';
import { Button, Modal, Space, Switch, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

interface RechargeRow {
  rechargeId: number;
  money?: number | string;
  discountMoney?: number | string;
  isShow?: number;
  sortOrder?: number;
}

/** 充值设置：对应旧版 promotion/rechargeSetting/List.vue + Info.vue。 */
export default function RechargeSettings() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((key) => key + 1);

  const updateField = async (row: RechargeRow, field: string, value: unknown) => {
    try {
      await apiPost('/promotion/rechargeSetting/updateField', { id: row.rechargeId, field, value });
      Toast.success({ content: t('修改成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('修改失败') });
    }
  };

  const columns: ColumnConfig<RechargeRow>[] = [
    {
      title: '充值金额',
      dataIndex: 'money',
      width: 160,
      render: (value: unknown) => <span title={t('充值金额')}>{value != null ? String(value) : '-'}</span>,
    },
    {
      title: '赠送金额',
      dataIndex: 'discountMoney',
      width: 160,
      render: (value: unknown) => <span title={t('赠送金额')}>{value != null ? String(value) : '-'}</span>,
    },
    {
      title: '是否显示',
      dataIndex: 'isShow',
      width: 110,
      render: (value: number, row: RechargeRow) => (
        <Switch checked={Number(value) === 1} onChange={(next) => updateField(row, 'isShow', next ? 1 : 0)} />
      ),
    },
    { title: '排序', dataIndex: 'sortOrder', width: 90 },
  ];

  return (
    <ListPage<RechargeRow>
      key={reloadKey}
      api="/promotion/rechargeSetting/list"
      rowKey="rechargeId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        { field: 'keyword', label: '充值金额', type: 'input', placeholder: '输入关键词', width: 220 },
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
                  await apiPost('/promotion/rechargeSetting/batch', {
                    ids: rows.map((row) => row.rechargeId),
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
      drawer={{
        title: '充值档位',
        addText: '添加充值档位',
        width: 520,
        labelWidth: 'auto',
        createApi: '/promotion/rechargeSetting/create',
        updateApi: '/promotion/rechargeSetting/update',
        detailApi: '/promotion/rechargeSetting/detail',
        deleteApi: '/promotion/rechargeSetting/del',
        idField: 'rechargeId',
        sections: [
          {
            key: 'basic',
            title: '档位信息',
            description:
              '提示：充值附赠赠送余额时，强烈建议关闭会员余额提现功能，避免产生资金套利风险。（去关闭：财务-提现管理-提现设置）',
            fields: [
              { field: 'money', label: t('充值金额'), type: 'number', required: true },
              { field: 'discountMoney', label: t('赠送金额'), type: 'number', required: true },
              { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 1 },
              {
                field: 'isShow',
                label: t('是否显示'),
                type: 'radio',
                initValue: 1,
                options: [
                  { label: t('是'), value: 1 },
                  { label: t('否'), value: 0 },
                ],
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          money: Number(values.money ?? 0),
          discountMoney: Number(values.discountMoney ?? 0),
          sortOrder: Number(values.sortOrder ?? 1),
          isShow: Number(values.isShow ?? 1),
        }),
      }}
    />
  );
}
