import { useState } from 'react';
import { Button, Image, Modal, Space, Switch, Toast, Typography } from '@douyinfe/semi-ui';
import { apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import type { ProductServiceRow } from '../types';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

function DefaultSwitch({
  row,
  value,
  onChange,
}: {
  row: ProductServiceRow;
  value?: number;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);
  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/product/productServices/updateField', {
        id: row.productServiceId,
        field: 'defaultOn',
        val: next ? 1 : 0,
      });
      setChecked(next);
      onChange();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };
  return <Switch checked={checked} onChange={toggle} size="small" />;
}

const columns: ColumnConfig<ProductServiceRow>[] = [
  { title: '服务名称', dataIndex: 'productServiceName', width: 280 },
  {
    title: '图标',
    dataIndex: 'icoImg',
    width: 120,
    render: (value: string) =>
      value ? <Image src={value} width={60} height={30} style={{ objectFit: 'contain' }} /> : '-',
  },
  {
    title: '简介',
    dataIndex: 'productServiceDesc',
    render: (value: string) => value || '-',
  },
  {
    title: '默认显示',
    dataIndex: 'defaultOn',
    width: 110,
    render: (value: number, record) => (
      <DefaultSwitch row={record} value={value} onChange={() => undefined} />
    ),
  },
  {
    title: '排序',
    dataIndex: 'sortOrder',
    width: 90,
  },
];

export default function ProductServices() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除商品服务'),
      content: t('确定删除选中的 {count} 项服务？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/product/productServices/batch', { ids, type: 'del' });
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
    <ListPage<ProductServiceRow>
      key={reloadKey}
      api="/product/productServices/list"
      rowKey="productServiceId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        {
          field: 'keyword',
          label: '商品服务',
          type: 'input',
          placeholder: '输入服务名称',
          width: 260,
        },
      ]}
      columns={columns}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.productServiceId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '商品服务',
        addText: '添加商品服务',
        width: 600,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/product/productServices/create',
        updateApi: '/product/productServices/update',
        detailApi: '/product/productServices/detail',
        deleteApi: '/product/productServices/del',
        idField: 'productServiceId',
        sections: [
          {
            key: 'basic',
            title: '服务信息',
            fields: [
              {
                field: 'productServiceName',
                label: t('名称'),
                required: true,
                placeholder: t('请输入服务名称'),
              },
              {
                field: 'productServiceDesc',
                label: t('简介'),
                type: 'textarea',
              },
              {
                field: 'icoImg',
                label: t('图标'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <div>
                    <ImageUploader
                      value={values.icoImg ? [values.icoImg] : []}
                      onChange={(urls) => formApi?.setValue('icoImg', urls[0] || '')}
                      max={1}
                    />
                    <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                      {t('建议上传 2:1 图片，宽 200px，高 100px')}
                    </Text>
                  </div>
                ),
              },
              { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
              {
                field: 'defaultOn',
                label: t('是否默认'),
                type: 'switch',
                initValue: 0,
                checkedText: t('默认'),
                uncheckedText: t('不默认'),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          sortOrder: Number(values.sortOrder ?? 50),
          defaultOn: values.defaultOn ? 1 : 0,
        }),
      }}
    />
  );
}
