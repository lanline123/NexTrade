import { useEffect, useState } from 'react';
import { Button, Modal, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import TplDataEditor from '../components/TplDataEditor';

interface TplRow {
  tplId: number;
  tplName: string;
  categoryId: number;
  tplData?: {
    normal?: Array<{ attrName?: string }>;
    spe?: Array<{ attrName?: string }>;
    extra?: Array<{ attrName?: string }>;
  };
}

interface CategoryOption {
  categoryId: number;
  categoryName: string;
  parentId?: number;
}

export default function AttributesTemplates() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const all: CategoryOption[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await apiGet<{ records: CategoryOption[]; total: number }>(
          '/product/category/list',
          { page, pageSize: 100 },
        );
        all.push(...(result.records || []));
        total = result.total || 0;
        page += 1;
        if (!result.records?.length) break;
      } while (all.length < total && page <= 10);
      if (alive) setCategories(all);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const categoryName = (id: number) =>
    categories.find((item) => item.categoryId === id)?.categoryName || t('分类 {id}', { id });

  const columns: ColumnConfig<TplRow>[] = [
    { title: '属性模板名称', dataIndex: 'tplName', width: 220 },
    {
      title: '商品类目',
      dataIndex: 'categoryId',
      width: 200,
      render: (value: number) => categoryName(value),
    },
    {
      title: '名称列表',
      dataIndex: 'tplData',
      render: (value: TplRow['tplData']) => {
        const names = [
          ...(value?.normal || []),
          ...(value?.spe || []),
          ...(value?.extra || []),
        ]
          .map((item) => item.attrName)
          .filter(Boolean);
        return names.length ? (
          <Space>
            {names.slice(0, 8).map((name, index) => (
              <Tag key={`${name}-${index}`}>{name}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        );
      },
    },
  ];

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除属性模板'),
      content: t('确定删除选中的 {count} 个模板？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/product/productAttributesTpl/batch', { ids, type: 'del' });
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
    <ListPage<TplRow>
      key={reloadKey}
      api="/product/productAttributesTpl/list"
      rowKey="tplId"
      pageSize={10}
      selectable
      actionWidth={150}
      filters={[
        {
          field: 'keyword',
          label: '属性模板',
          type: 'input',
          placeholder: '输入属性模板名称',
          width: 260,
        },
      ]}
      columns={columns}
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.tplId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '属性模板',
        addText: '添加属性模板',
        width: 1030,
        labelWidth: 'auto',
        inputWidth: 420,
        createApi: '/product/productAttributesTpl/create',
        updateApi: '/product/productAttributesTpl/update',
        detailApi: '/product/productAttributesTpl/detail',
        deleteApi: '/product/productAttributesTpl/del',
        idField: 'tplId',
        sections: [
          {
            key: 'basic',
            title: '模板信息',
            fields: [
              {
                field: 'categoryId',
                label: t('商品类目'),
                type: 'select',
                required: true,
                placeholder: t('请选择商品类目'),
                options: categories.map((item) => ({
                  label: item.categoryName,
                  value: item.categoryId,
                })),
              },
              {
                field: 'tplName',
                label: t('属性模板名称'),
                required: true,
                placeholder: t('请输入属性模板名称'),
              },
              {
                field: 'tplData',
                label: t('属性配置'),
                type: 'custom',
                render: ({ formApi, values }) => (
                  <TplDataEditor
                    value={values.tplData}
                    onChange={(next) => formApi?.setValue('tplData', next)}
                  />
                ),
              },
            ],
          },
        ],
      }}
    />
  );
}
