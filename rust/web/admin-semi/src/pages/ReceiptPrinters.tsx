import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

interface ReceiptPrinterRow {
  printId: number;
  printName?: string;
  platformText?: string;
  printSn?: string;
  deviceCode?: string;
  paperSizeDesc?: string;
  statusText?: string;
  updateTime?: string;
}

const columns: ColumnConfig<ReceiptPrinterRow>[] = [
  { title: '打印机名称', dataIndex: 'printName' },
  { title: '打印机类型', dataIndex: 'platformText', width: 120 },
  { title: '打印机编码', dataIndex: 'printSn', width: 190 },
  { title: '绑定设备', dataIndex: 'deviceCode', width: 150, render: (value: string) => value || '-' },
  { title: '纸张', dataIndex: 'paperSizeDesc', width: 100, render: (value: string) => value || '-' },
  { title: '状态', dataIndex: 'statusText', width: 100 },
  { title: '更新时间', dataIndex: 'updateTime', width: 180, render: (value: string) => value || '-' },
];

export default function ReceiptPrintersPage() {
  const { t } = useI18n();
  return (
    <ListPage<ReceiptPrinterRow>
      api="/print/print/list"
      rowKey="printId"
      pageSize={10}
      actionWidth={150}
      filters={[
        { field: 'keyword', label: '打印机', type: 'input', placeholder: '打印机名称/编码', width: 260 },
        {
          field: 'platform',
          label: '类型',
          type: 'select',
          width: 130,
          options: [
            { label: '飞鹅云', value: 1 },
            { label: '商米云', value: 2 },
          ],
        },
      ]}
      columns={columns}
      drawer={{
        title: '小票打印机',
        addText: '新增打印机',
        width: 640,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/print/print/create',
        updateApi: '/print/print/update',
        detailApi: '/print/print/detail',
        deleteApi: '/print/print/del',
        idField: 'printId',
        sections: [
          {
            key: 'basic',
            title: '打印机信息',
            fields: [
              { field: 'printName', label: t('打印机名称'), required: true },
              {
                field: 'platform',
                label: t('打印机类型'),
                type: 'select',
                initValue: 1,
                options: [
                  { label: t('飞鹅云'), value: 1 },
                  { label: t('商米云'), value: 2 },
                ],
              },
              { field: 'printSn', label: t('打印机编码'), required: true },
              { field: 'printKey', label: t('打印机 Key'), type: 'input' },
              { field: 'thirdAccount', label: t('第三方账号'), required: true },
              { field: 'thirdKey', label: t('第三方 Key'), type: 'input' },
            ],
          },
          {
            key: 'config',
            title: '打印设置',
            fields: [
              {
                field: 'paperSize',
                label: t('纸张尺寸'),
                type: 'select',
                initValue: 58,
                options: [
                  { label: '58mm', value: 58 },
                  { label: '80mm', value: 80 },
                ],
              },
              {
                field: 'autoPrint',
                label: t('自动打印'),
                type: 'select',
                initValue: 1,
                options: [
                  { label: t('开启'), value: 1 },
                  { label: t('关闭'), value: 2 },
                ],
              },
              {
                field: 'status',
                label: t('启用状态'),
                type: 'select',
                initValue: 1,
                options: [
                  { label: t('启用'), value: 1 },
                  { label: t('停用'), value: 2 },
                ],
              },
              {
                field: 'deviceCode',
                label: t('绑定设备'),
                type: 'select',
                placeholder: t('可选，绑定收银设备'),
                optionsApi: '/pos/device/all',
                optionsParams: { page: 1, size: 200 },
                optionLabel: 'deviceName',
                optionValue: 'deviceCode',
              },
              {
                field: 'isDefault',
                label: t('默认打印机'),
                type: 'select',
                initValue: 0,
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
          printId: values.printId ? Number(values.printId) : undefined,
          platform: Number(values.platform || 1),
          paperSize: Number(values.paperSize || 58),
          autoPrint: Number(values.autoPrint || 1),
          status: Number(values.status || 1),
          isDefault: Number(values.isDefault || 0),
        }),
      }}
    />
  );
}
