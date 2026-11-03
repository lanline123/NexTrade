import { useState } from 'react';
import { Button, Image, Modal, Space, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import ImageUploader from '../components/ImageUploader';

interface FriendLinkRow {
  linkId: number;
  linkTitle: string;
  linkUrl: string;
  linkLogo?: string;
  sortOrder?: number;
}

const columns: ColumnConfig<FriendLinkRow>[] = [
  { title: '链接名称', dataIndex: 'linkTitle', width: 220 },
  {
    title: '链接地址',
    dataIndex: 'linkUrl',
    render: (value: string) => (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    ),
  },
  {
    title: '链接LOGO',
    dataIndex: 'linkLogo',
    width: 140,
    render: (value: string) =>
      value ? <Image src={value} width={60} height={30} style={{ objectFit: 'contain' }} /> : '-',
  },
  { title: '排序', dataIndex: 'sortOrder', width: 90 },
];

export default function FriendLinks() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除友情链接'),
      content: t('确定删除选中的 {count} 条链接？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/setting/friendLinks/batch', { ids, type: 'del' });
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
    <ListPage<FriendLinkRow>
      key={reloadKey}
      api="/setting/friendLinks/list"
      rowKey="linkId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        {
          field: 'keyword',
          label: '友情链接',
          type: 'input',
          placeholder: '输入链接名称',
          width: 260,
        },
      ]}
      columns={columns}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.linkId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '友情链接',
        addText: '添加友情链接',
        width: 580,
        labelWidth: 'auto',
        inputWidth: 400,
        createApi: '/setting/friendLinks/create',
        updateApi: '/setting/friendLinks/update',
        detailApi: '/setting/friendLinks/detail',
        deleteApi: '/setting/friendLinks/del',
        idField: 'linkId',
        sections: [
          {
            key: 'basic',
            title: '链接信息',
            fields: [
              {
                field: 'linkTitle',
                label: t('链接名称'),
                required: true,
                placeholder: t('请输入链接名称'),
                extraText: t('添加文字链接时，链接LOGO会显示为链接名称'),
              },
              {
                field: 'linkUrl',
                label: t('链接地址'),
                placeholder: 'https://...',
              },
              {
                field: 'linkLogo',
                label: t('链接LOGO'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <ImageUploader
                    value={values.linkLogo ? [values.linkLogo] : []}
                    onChange={(urls) => formApi?.setValue('linkLogo', urls[0] || '')}
                    max={1}
                  />
                ),
              },
              { field: 'sortOrder', label: t('排序'), type: 'number', initValue: 50 },
            ],
          },
        ],
        toPayload: (values) => ({ ...values, sortOrder: Number(values.sortOrder ?? 50) }),
      }}
    />
  );
}
