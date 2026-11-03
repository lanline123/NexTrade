import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Dropdown,
  Image,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import FormDrawer from '../framework/FormDrawer';
import ImageUploader from '../components/ImageUploader';
import type { CategoryRow } from '../types';

const { Text } = Typography;

function buildTree(list: CategoryRow[]): CategoryRow[] {
  const map = new Map<number, CategoryRow>();
  list.forEach((item) => map.set(item.categoryId, { ...item, children: [] }));
  const roots: CategoryRow[] = [];
  map.forEach((item) => {
    const parent = item.parentId ? map.get(item.parentId) : undefined;
    if (parent) parent.children!.push(item);
    else roots.push(item);
  });
  const sort = (items: CategoryRow[]) => {
    items.sort((a, b) => (a.sortOrder ?? 50) - (b.sortOrder ?? 50) || a.categoryId - b.categoryId);
    items.forEach((item) => sort(item.children || []));
  };
  sort(roots);
  return roots;
}

function flattenTree(
  nodes: CategoryRow[],
  expanded: Set<number>,
  depth = 0,
  out: CategoryRow[] = [],
): CategoryRow[] {
  nodes.forEach((node) => {
    const hasChildren = node.children?.length ? 1 : 0;
    out.push({ ...node, depth, hasChildren, children: undefined });
    if (expanded.has(node.categoryId) && node.children?.length) {
      flattenTree(node.children, expanded, depth + 1, out);
    }
  });
  return out;
}

function CategorySwitch({
  row,
  field,
  value,
  onChange,
}: {
  row: CategoryRow;
  field: 'isShow' | 'isHot';
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
      await apiPost('/product/category/updateField', {
        id: row.categoryId,
        field,
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

export default function Categories() {
  const { t } = useI18n();
  const [tree, setTree] = useState<CategoryRow[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Array<string | number>>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerValues, setDrawerValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [moveRow, setMoveRow] = useState<CategoryRow | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<number | undefined>(undefined);

  const load = async () => {
    if (isDemo()) return;
    setLoading(true);
    try {
      const all: CategoryRow[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await apiGet<{ records: CategoryRow[]; total: number }>(
          '/product/category/list',
          { page, pageSize: 100 },
        );
        const records = result.records || [];
        all.push(...records);
        total = result.total || 0;
        page += 1;
        if (!records.length) break;
      } while (all.length < total && page <= 10);
      setTree(buildTree(all));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('分类加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [reloadKey]);

  const flatCategories = useMemo(() => {
    const result: CategoryRow[] = [];
    const walk = (nodes: CategoryRow[], depth = 0) => {
      nodes.forEach((node) => {
        result.push({ ...node, depth });
        if (node.children?.length) walk(node.children, depth + 1);
      });
    };
    walk(tree);
    return result;
  }, [tree]);

  const visibleRows = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const categoryOptions = (excludeId?: number) =>
    [{ label: t('顶级分类'), value: 0 }].concat(
      flatCategories
        .filter((item) => item.categoryId !== excludeId)
        .map((item) => ({
          label: `${'　'.repeat(item.depth || 0)}${item.categoryName}`,
          value: item.categoryId,
        })),
    );

  const refresh = () => setReloadKey((key) => key + 1);

  const openCreate = (parentId = 0) => {
    setDrawerMode('create');
    setDrawerValues({ parentId, isShow: 1, isHot: 0, sortOrder: 50 });
    setDrawerVisible(true);
  };

  const openEdit = (record: CategoryRow) => {
    setDrawerMode('edit');
    setDrawerValues({ ...record });
    setDrawerVisible(true);
  };

  const save = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      await apiPost(
        drawerMode === 'create' ? '/product/category/create' : '/product/category/update',
        {
          ...payload,
          categoryId: drawerMode === 'create' ? undefined : drawerValues.categoryId,
          parentId: Number(payload.parentId ?? 0),
          sortOrder: Number(payload.sortOrder ?? 50),
          isShow: payload.isShow ? 1 : 0,
          isHot: payload.isHot ? 1 : 0,
        },
      );
      Toast.success({ content: drawerMode === 'create' ? t('分类已创建') : t('分类已更新') });
      setDrawerVisible(false);
      refresh();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存分类失败') });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = (record: CategoryRow) => {
    Modal.confirm({
      title: t('删除商品分类'),
      content: t('确定删除分类「{name}」？有子分类或商品时可能无法删除。', {
        name: record.categoryName,
      }),
      onOk: async () => {
        try {
          await apiPost('/product/category/del', { id: record.categoryId });
          Toast.success({ content: t('删除成功') });
          refresh();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const moveCategory = async () => {
    if (!moveRow || !targetCategoryId) {
      Toast.warning({ content: t('请选择目标分类') });
      return;
    }
    try {
      await apiPost('/product/category/moveCat', {
        id: moveRow.categoryId,
        targetCatId: targetCategoryId,
      });
      Toast.success({ content: t('商品转移成功') });
      setMoveRow(null);
      setTargetCategoryId(undefined);
      refresh();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('商品转移失败') });
    }
  };

  const batchDelete = () => {
    if (!selectedKeys.length) return;
    Modal.confirm({
      title: t('批量删除商品分类'),
      content: t('确定删除选中的 {count} 个分类？', { count: selectedKeys.length }),
      onOk: async () => {
        try {
          await apiPost('/product/category/batch', {
            ids: selectedKeys.map(Number),
            type: 'del',
          });
          Toast.success({ content: t('批量删除成功') });
          setSelectedKeys([]);
          refresh();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
        }
      },
    });
  };

  const columns = [
    {
      title: t('分类名称'),
      dataIndex: 'categoryName',
      width: 260,
      render: (value: string, record: CategoryRow) => (
        <div style={{ paddingLeft: (record.depth || 0) * 22 }}>
          {record.hasChildren ? (
            <button
              type="button"
              className="category-expand-btn"
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(record.categoryId)) next.delete(record.categoryId);
                  else next.add(record.categoryId);
                  return next;
                })
              }
            >
              {expanded.has(record.categoryId) ? '−' : '+'}
            </button>
          ) : (
            <span className="category-expand-placeholder" />
          )}
          <span>{value}</span>
        </div>
      ),
    },
    {
      title: t('分类图片'),
      dataIndex: 'categoryPic',
      width: 100,
      render: (value: string) =>
        value ? <Image src={value} width={30} height={30} style={{ objectFit: 'contain' }} /> : '-',
    },
    { title: t('单位'), dataIndex: 'measureUnit', width: 90, render: (value: string) => value || '-' },
    {
      title: t('是否热门'),
      dataIndex: 'isHot',
      width: 90,
      render: (value: number, record: CategoryRow) => (
        <CategorySwitch row={record} field="isHot" value={value} onChange={refresh} />
      ),
    },
    {
      title: t('是否显示'),
      dataIndex: 'isShow',
      width: 90,
      render: (value: number, record: CategoryRow) => (
        <CategorySwitch row={record} field="isShow" value={value} onChange={refresh} />
      ),
    },
    { title: t('排序'), dataIndex: 'sortOrder', width: 80 },
    {
      title: t('操作'),
      width: 230,
      fixed: 'right' as const,
      render: (_: unknown, record: CategoryRow) => (
        <Space spacing={2}>
          <Button theme="borderless" size="small" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <Button theme="borderless" size="small" onClick={() => openCreate(record.categoryId)}>
            {t('添加子分类')}
          </Button>
          <Dropdown
            trigger="click"
            position="bottomRight"
            menu={[
              {
                node: 'item',
                name: t('商品转移'),
                onClick: () => {
                  setMoveRow(record);
                  setTargetCategoryId(undefined);
                },
              },
              { node: 'item', name: t('删除'), onClick: () => removeCategory(record) },
            ]}
          >
            <Button theme="borderless" size="small">
              {t('更多')}
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card className="table-card" shadows="hover">
        <div className="table-toolbar">
          <Space>
            <Text type="tertiary">{t('共 {count} 个分类', { count: flatCategories.length })}</Text>
            {selectedKeys.length > 0 && (
              <Text type="tertiary">{t('已选 {count} 项', { count: selectedKeys.length })}</Text>
            )}
          </Space>
          <Space>
            <Button
              icon={<IconRefresh />}
              onClick={() => setReloadKey((key) => key + 1)}
              loading={loading}
            >
              {t('刷新')}
            </Button>
            <Button onClick={batchDelete} disabled={!selectedKeys.length}>
              {t('批量删除')}
            </Button>
            <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => openCreate(0)}>
              {t('添加分类')}
            </Button>
          </Space>
        </div>
        <Table
          loading={loading}
          dataSource={visibleRows}
          rowKey="categoryId"
          pagination={false}
          scroll={{ x: 940 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys((keys || []) as Array<string | number>),
          }}
          columns={columns as any}
        />
      </Card>

      <FormDrawer
        visible={drawerVisible}
        mode={drawerMode}
        initialValues={drawerValues}
        saving={saving}
        onCancel={() => setDrawerVisible(false)}
        onSubmit={save}
        config={{
          title: '商品分类',
          addText: '添加分类',
          width: 600,
          labelWidth: 'auto',
          inputWidth: 420,
          createApi: '/product/category/create',
          updateApi: '/product/category/update',
          idField: 'categoryId',
          sections: [
            {
              key: 'basic',
              title: '分类信息',
              fields: [
                {
                  field: 'categoryName',
                  label: t('分类名称'),
                  required: true,
                  placeholder: t('请输入分类名称'),
                },
                { field: 'shortName', label: t('分类短名') },
                {
                  field: 'parentId',
                  label: t('上级分类'),
                  type: 'select',
                  options: categoryOptions(drawerValues.categoryId),
                },
                {
                  field: 'categoryPic',
                  label: t('分类图片'),
                  type: 'custom',
                  render: ({ formApi, values }) => (
                    <div>
                      <ImageUploader
                        value={values.categoryPic ? [values.categoryPic] : []}
                        onChange={(urls) => formApi?.setValue('categoryPic', urls[0] || '')}
                        max={1}
                      />
                      <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                        {t('建议上传 2:1 图片，宽 200px，高 100px')}
                      </Text>
                    </div>
                  ),
                },
                { field: 'measureUnit', label: t('数量单位'), placeholder: t('如：件') },
                { field: 'seoTitle', label: t('SEO标题') },
                { field: 'keywords', label: t('关键字') },
                { field: 'categoryDesc', label: t('分类描述'), type: 'textarea' },
                {
                  field: 'sortOrder',
                  label: t('排序'),
                  type: 'number',
                  initValue: 50,
                },
                {
                  field: 'isHot',
                  label: t('是否热门'),
                  type: 'switch',
                  initValue: 0,
                  checkedText: t('热门'),
                  uncheckedText: t('不热门'),
                },
                {
                  field: 'isShow',
                  label: t('是否显示'),
                  type: 'switch',
                  initValue: 1,
                  checkedText: t('显示'),
                  uncheckedText: t('隐藏'),
                },
              ],
            },
          ],
          toPayload: (values) => ({
            ...values,
            parentId: Number(values.parentId ?? 0),
            sortOrder: Number(values.sortOrder ?? 50),
            isHot: values.isHot ? 1 : 0,
            isShow: values.isShow ? 1 : 0,
          }),
        }}
      />

      <Modal
        title={t('商品转移')}
        visible={Boolean(moveRow)}
        onCancel={() => setMoveRow(null)}
        width={520}
        footer={
          <Space>
            <Button onClick={() => setMoveRow(null)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" onClick={moveCategory}>
              {t('确认转移')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="tertiary">{t('将当前分类下的商品转移到目标分类：')}</Text>
        </div>
        <Select
          value={targetCategoryId}
          onChange={(value) => setTargetCategoryId(Number(value))}
          optionList={categoryOptions(moveRow?.categoryId)}
          placeholder={t('请选择目标分类')}
          style={{ width: '100%' }}
        />
      </Modal>
    </>
  );
}
