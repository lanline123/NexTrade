import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig } from '../framework/types';
import type { ArticleCategoryRow, ArticleRow } from '../types';
import ImageUploader from '../components/ImageUploader';
import RichTextEditor from '../components/RichTextEditor';

const { Text } = Typography;

function formatTime(value: number) {
  if (!value) return '-';
  return new Date(value * 1000).toLocaleString('zh-CN', { hour12: false });
}

function ArticleSwitch({
  record,
  field,
  value,
}: {
  record: ArticleRow;
  field: 'isShow' | 'isHot';
  value: number;
}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(value === 1);

  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      if (field === 'isShow') {
        await apiPost('/content/article/updateField', {
          articleId: record.articleId,
          isShow: next ? 1 : 0,
        });
      } else {
        await apiPost('/content/article/update', {
          id: record.articleId,
          isHot: next ? 1 : 0,
        });
      }
      setChecked(next);
      Toast.success({ content: t('已更新') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新失败') });
    }
  };

  return <Switch checked={checked} onChange={toggle} size="small" />;
}

export default function Content() {
  const { t } = useI18n();
  const [tab, setTab] = useState('articles');
  const [categories, setCategories] = useState<ArticleCategoryRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [catDrawerVisible, setCatDrawerVisible] = useState(false);
  const [catMode, setCatMode] = useState<'create' | 'edit'>('create');
  const [catInitial, setCatInitial] = useState<Record<string, any>>({});
  const [catSaving, setCatSaving] = useState(false);
  const [moveVisible, setMoveVisible] = useState(false);
  const [moveIds, setMoveIds] = useState<number[]>([]);
  const [moveCategoryId, setMoveCategoryId] = useState<number | undefined>(undefined);
  const [moveClear, setMoveClear] = useState<(() => void) | null>(null);

  const loadCategories = () => {
    if (isDemo()) return;
    apiGet<ArticleCategoryRow[]>('/content/articleCategory/list')
      .then((result) => setCategories(result || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const categoryName = (id: number) =>
    categories.find((item) => item.articleCategoryId === id)?.articleCategoryName ||
    t('分类 {id}', { id });

  const columns = useMemo<ColumnConfig<ArticleRow>[]>(
    () => [
      {
        title: '文章标题',
        dataIndex: 'articleTitle',
        width: 300,
        render: (value: string) => <span className="article-title">{value}</span>,
      },
      {
        title: '文章分类',
        dataIndex: 'articleCategoryId',
        width: 140,
        render: (value: number) => <Tag color="blue">{categoryName(value)}</Tag>,
      },
      {
        title: '文章类型',
        dataIndex: 'articleTypeText',
        width: 110,
        render: (value: string) => value || '-',
      },
      {
        title: '文章重要性',
        dataIndex: 'isTop',
        width: 110,
        render: (value: number) =>
          value === 1 ? <Tag color="orange">{t('置顶')}</Tag> : <span>{t('普通')}</span>,
      },
      {
        title: '发布时间',
        dataIndex: 'addTime',
        width: 170,
        render: (value: number) => formatTime(value),
      },
      {
        title: '是否热门',
        dataIndex: 'isHot',
        width: 100,
        render: (value: number, record) => (
          <ArticleSwitch record={record} field="isHot" value={value} />
        ),
      },
      {
        title: '是否显示',
        dataIndex: 'isShow',
        width: 100,
        render: (value: number, record) => (
          <ArticleSwitch record={record} field="isShow" value={value} />
        ),
      },
    ],
    [categories, t],
  );

  const openCreateCategory = () => {
    setCatMode('create');
    setCatInitial({ parentId: 0, sortOrder: 50 });
    setCatDrawerVisible(true);
  };

  const openEditCategory = (record: ArticleCategoryRow) => {
    setCatMode('edit');
    setCatInitial({
      articleCategoryId: record.articleCategoryId,
      articleCategoryName: record.articleCategoryName,
      parentId: record.parentId || 0,
      sortOrder: record.sortOrder ?? 50,
    });
    setCatDrawerVisible(true);
  };

  const saveCategory = async (payload: Record<string, any>) => {
    setCatSaving(true);
    try {
      await apiPost(
        catMode === 'create' ? '/content/articleCategory/create' : '/content/articleCategory/update',
        {
          ...payload,
          articleCategoryId: catMode === 'create' ? undefined : catInitial.articleCategoryId,
          parentId: Number(payload.parentId || 0),
          sortOrder: Number(payload.sortOrder || 50),
        },
      );
      Toast.success({ content: catMode === 'create' ? t('分类已创建') : t('分类已更新') });
      setCatDrawerVisible(false);
      loadCategories();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存分类失败') });
    } finally {
      setCatSaving(false);
    }
  };

  const removeCategory = async (record: ArticleCategoryRow) => {
    try {
      await apiPost('/content/articleCategory/del', { id: record.articleCategoryId });
      Toast.success({ content: t('分类已删除') });
      loadCategories();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除分类失败') });
    }
  };

  const batchArticle = async (
    action: 'del' | 'show' | 'hide' | 'moveCat',
    ids: number[],
    clear: () => void,
    targetCat?: number,
  ) => {
    try {
      await apiPost('/content/article/batch', {
        ids,
        type: action,
        targetCat: action === 'moveCat' ? [targetCat] : undefined,
      });
      Toast.success({ content: t('批量操作成功') });
      clear();
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量操作失败') });
    }
  };

  const confirmBatch = (
    title: string,
    action: 'del' | 'show' | 'hide',
    ids: number[],
    clear: () => void,
  ) => {
    Modal.confirm({
      title,
      content: t('将对 {count} 篇文章执行操作', { count: ids.length }),
      onOk: () => batchArticle(action, ids, clear),
    });
  };

  return (
    <>
      <div className="content-tabs">
        <Tabs
          type="button"
          activeKey={tab}
          onChange={setTab}
          tabList={[
            { tab: t('文章管理'), itemKey: 'articles' },
            { tab: t('文章分类'), itemKey: 'categories' },
          ]}
        />
      </div>

      {tab === 'articles' && (
        <ListPage<ArticleRow>
          key={reloadKey}
          api="/content/article/list"
          rowKey="articleId"
          pageSize={10}
          actionWidth={110}
          selectable
          batchActions={(rows, clear) => {
            const ids = rows.map((row) => row.articleId);
            return (
              <Space>
                <Button size="small" onClick={() => confirmBatch(t('批量删除文章'), 'del', ids, clear)}>
                  {t('批量删除')}
                </Button>
                <Button size="small" onClick={() => confirmBatch(t('批量显示文章'), 'show', ids, clear)}>
                  {t('批量显示')}
                </Button>
                <Button size="small" onClick={() => confirmBatch(t('批量隐藏文章'), 'hide', ids, clear)}>
                  {t('批量隐藏')}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setMoveIds(ids);
                    setMoveCategoryId(undefined);
                    setMoveClear(() => clear);
                    setMoveVisible(true);
                  }}
                >
                  {t('批量转移分类')}
                </Button>
              </Space>
            );
          }}
          filters={[
            {
              field: 'keyword',
              label: '文章名称',
              type: 'input',
              placeholder: '输入文章名称',
              width: 260,
            },
            {
              field: 'articleCategoryId',
              label: '全部分类',
              type: 'select',
              width: 160,
              options: categories.map((item) => ({
                label: item.articleCategoryName,
                value: item.articleCategoryId,
              })),
            },
            {
              field: 'isShow',
              label: '是否显示',
              type: 'select',
              width: 130,
              options: [
                { label: '显示', value: 1 },
                { label: '不显示', value: 0 },
              ],
            },
            {
              field: 'isHot',
              label: '是否热门',
              type: 'select',
              width: 130,
              options: [
                { label: '热门', value: 1 },
                { label: '不热门', value: 0 },
              ],
            },
          ]}
          columns={columns}
          drawer={{
            title: '文章',
            addText: '添加文章',
            width: 580,
            labelWidth: 'auto',
            inputWidth: 420,
            createApi: '/content/article/create',
            updateApi: '/content/article/update',
            detailApi: '/content/article/detail',
            deleteApi: '/content/article/del',
            idField: 'articleId',
            sections: [
              {
                key: 'basic',
                title: '基本信息',
                fields: [
                  {
                    field: 'articleTitle',
                    label: t('文章标题'),
                    required: true,
                    placeholder: t('请输入文章标题'),
                  },
                  {
                    field: 'articleSn',
                    label: t('文章编号'),
                    placeholder: t('编号用于前台调用某些指定文章'),
                  },
                  {
                    field: 'articleCategoryId',
                    label: t('文章分类'),
                    type: 'select',
                    required: true,
                    options: categories.map((item) => ({
                      label: item.articleCategoryName,
                      value: item.articleCategoryId,
                    })),
                  },
                  {
                    field: 'articleThumb',
                    label: t('缩略图'),
                    type: 'custom',
                    render: ({ formApi, values }) => (
                      <ImageUploader
                        value={values.articleThumb ? [values.articleThumb] : []}
                        onChange={(urls) => formApi?.setValue('articleThumb', urls[0] || '')}
                        max={1}
                      />
                    ),
                  },
                  { field: 'articleAuthor', label: t('文章作者'), placeholder: t('请输入文章作者') },
                  { field: 'keywords', label: t('关键字'), placeholder: t('请输入关键字') },
                  { field: 'articleTag', label: t('标签'), placeholder: t('请输入标签') },
                  {
                    field: 'description',
                    label: t('描述'),
                    type: 'textarea',
                  },
                  { field: 'link', label: t('相关链接'), placeholder: 'https://...' },
                  {
                    field: 'articleType',
                    label: t('文章类型'),
                    type: 'radio',
                    options: [
                      { label: t('普通文章'), value: 1 },
                      { label: t('帮助文章'), value: 2 },
                    ],
                  },
                  {
                    field: 'isTop',
                    label: t('是否置顶'),
                    type: 'radio',
                    options: [
                      { label: t('是'), value: 1 },
                      { label: t('否'), value: 0 },
                    ],
                  },
                  {
                    field: 'isHot',
                    label: t('是否热门'),
                    type: 'radio',
                    options: [
                      { label: t('是'), value: 1 },
                      { label: t('否'), value: 0 },
                    ],
                  },
                  {
                    field: 'isShow',
                    label: t('是否显示'),
                    type: 'radio',
                    options: [
                      { label: t('是'), value: 1 },
                      { label: t('否'), value: 0 },
                    ],
                  },
                ],
              },
              {
                key: 'content',
                title: '文章内容',
                fields: [
                  {
                    field: 'content',
                    label: t('正文'),
                    type: 'custom',
                    render: ({ formApi, values }) => (
                      <RichTextEditor
                        value={values.content || ''}
                        onChange={(html) => formApi?.setValue('content', html)}
                        height={380}
                      />
                    ),
                  },
                ],
              },
            ],
            toPayload: (values) => ({
              ...values,
              articleCategoryId: Number(values.articleCategoryId),
            }),
          }}
        />
      )}

      {tab === 'categories' && (
        <>
          <Card className="table-card" shadows="hover">
            <div className="table-toolbar">
              <Text type="tertiary">{t('共 {count} 个文章分类', { count: categories.length })}</Text>
              <Button theme="solid" type="primary" onClick={openCreateCategory}>
                {t('新增分类')}
              </Button>
            </div>
            <Table
              dataSource={categories}
              rowKey="articleCategoryId"
              pagination={false}
              columns={[
                { title: 'ID', dataIndex: 'articleCategoryId', width: 80 },
                { title: t('分类名称'), dataIndex: 'articleCategoryName' },
                {
                  title: t('上级分类'),
                  dataIndex: 'parentId',
                  width: 160,
                  render: (value: number) =>
                    value
                      ? categories.find((item) => item.articleCategoryId === value)
                          ?.articleCategoryName || t('分类 {id}', { id: value })
                      : t('顶级分类'),
                },
                {
                  title: t('标识'),
                  dataIndex: 'categorySn',
                  width: 130,
                  render: (value: string) => value || '-',
                },
                { title: t('排序'), dataIndex: 'sortOrder', width: 90 },
                {
                  title: t('操作'),
                  width: 150,
                  render: (_: unknown, record: ArticleCategoryRow) => (
                    <Space>
                      <Button
                        theme="borderless"
                        size="small"
                        onClick={() => openEditCategory(record)}
                      >
                        {t('编辑')}
                      </Button>
                      <Popconfirm
                        title={t('确定删除该分类？分类下有文章或子分类时不能删除。')}
                        onConfirm={() => removeCategory(record)}
                      >
                        <Button theme="borderless" type="danger" size="small">
                          {t('删除')}
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          <FormDrawer
            visible={catDrawerVisible}
            mode={catMode}
            initialValues={catInitial}
            saving={catSaving}
            onCancel={() => setCatDrawerVisible(false)}
            onSubmit={saveCategory}
            config={{
              title: '文章分类',
              addText: '新增分类',
              width: 560,
              labelWidth: 'auto',
              inputWidth: 420,
              createApi: '/content/articleCategory/create',
              updateApi: '/content/articleCategory/update',
              sections: [
                {
                  key: 'basic',
                  title: '分类信息',
                  fields: [
                    {
                      field: 'articleCategoryName',
                      label: t('分类名称'),
                      required: true,
                      placeholder: t('请输入分类名称'),
                    },
                    {
                      field: 'parentId',
                      label: t('上级分类'),
                      type: 'select',
                      options: [
                        { label: t('顶级分类'), value: 0 },
                        ...categories
                          .filter((item) => item.articleCategoryId !== catInitial.articleCategoryId)
                          .map((item) => ({
                            label: item.articleCategoryName,
                            value: item.articleCategoryId,
                          })),
                      ],
                    },
                    {
                      field: 'sortOrder',
                      label: t('排序'),
                      type: 'number',
                    },
                  ],
                },
              ],
              toPayload: (values) => ({
                articleCategoryName: values.articleCategoryName,
                parentId: values.parentId ?? 0,
                sortOrder: values.sortOrder ?? 50,
              }),
            }}
          />
        </>
      )}

      <Modal
        title={t('批量转移分类')}
        visible={moveVisible}
        onCancel={() => setMoveVisible(false)}
        width={480}
        footer={
          <Space>
            <Button onClick={() => setMoveVisible(false)}>{t('取消')}</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={async () => {
                if (!moveCategoryId) {
                  Toast.warning({ content: t('请选择目标分类') });
                  return;
                }
                await batchArticle('moveCat', moveIds, moveClear || (() => undefined), moveCategoryId);
                setMoveVisible(false);
              }}
            >
              {t('确认转移')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 10 }}>
          {t('已选择 {count} 篇文章', { count: moveIds.length })}
        </div>
        <Select
          placeholder={t('请选择目标分类')}
          value={moveCategoryId}
          onChange={(value) => setMoveCategoryId(Number(value))}
          optionList={categories.map((item) => ({
            label: item.articleCategoryName,
            value: item.articleCategoryId,
          }))}
          style={{ width: '100%' }}
        />
      </Modal>
    </>
  );
}
