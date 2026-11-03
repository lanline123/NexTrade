import { useState } from 'react';
import { Button, Input, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

interface TagGroupRow {
  id: number;
  groupName?: string;
  tagValues?: string;
  createTime?: string;
  isTop?: number;
}

interface TagItem {
  id?: number;
  tagName: string;
}

/** 会员标签：对应旧版 user/userTags/List.vue + Info.vue（标签组 + 动态标签值）。 */
export default function MemberTags() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitial({ groupName: '', tags: [{ tagName: '' }, { tagName: '' }] });
    setDrawerOpen(true);
  };

  const openEdit = async (row: TagGroupRow) => {
    setDrawerMode('edit');
    setEditingId(row.id);
    try {
      const detail = await apiGet<any>('/user/memberTagGroup/detail', { id: row.id });
      const tags: TagItem[] = (detail?.tags || detail?.tagList || []).map((tag: any) => ({
        id: tag.id,
        tagName: tag.tagName ?? '',
      }));
      setDrawerInitial({
        id: row.id,
        groupName: detail?.groupName || row.groupName || '',
        tags: tags.length >= 2 ? tags : [{ tagName: '' }, { tagName: '' }],
      });
    } catch {
      setDrawerInitial({ id: row.id, groupName: row.groupName || '', tags: [{ tagName: '' }, { tagName: '' }] });
    }
    setDrawerOpen(true);
  };

  const saveTagGroup = async (payload: Record<string, any>) => {
    const tags: TagItem[] = (payload.tags || []).filter((item: TagItem) => String(item.tagName || '').trim());
    if (!String(payload.groupName || '').trim()) {
      Toast.error({ content: t('请输入标签组名称') });
      return;
    }
    if (tags.length < 2) {
      Toast.error({ content: t('请至少填写两个标签值') });
      return;
    }
    setSaving(true);
    try {
      const body = { groupName: payload.groupName, tags };
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/user/memberTagGroup/update', { ...body, id: editingId });
      } else {
        await apiPost('/user/memberTagGroup/create', body);
      }
      Toast.success({ content: t('操作成功') });
      setDrawerOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const toggleTop = async (row: TagGroupRow) => {
    const isTop = Number(row.isTop ?? 0) > 0;
    try {
      await apiPost(isTop ? '/user/memberTagGroup/cancelTop' : '/user/memberTagGroup/setTop', { id: row.id });
      Toast.success({ content: t('操作成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const deleteGroup = (row: TagGroupRow) => {
    Modal.confirm({
      title: t('确认删除该标签组吗？'),
      onOk: async () => {
        try {
          await apiPost('/user/memberTagGroup/del', { id: row.id });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const columns: ColumnConfig<TagGroupRow>[] = [
    {
      title: '组名称',
      dataIndex: 'groupName',
      width: 180,
      render: (value: string, row: TagGroupRow) => (
        <span>
          {value || '-'}
          {Number(row.isTop ?? 0) > 0 ? <Text type="warning">{t('（置顶）')}</Text> : null}
        </span>
      ),
    },
    {
      title: '标签值',
      dataIndex: 'tagValues',
      width: 320,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '客户数量',
      dataIndex: 'customerCount',
      width: 100,
      render: (value: number) => <span>{value ?? '-'}</span>,
    },
    { title: '创建时间', dataIndex: 'createTime', width: 170 },
  ];

  const drawerConfig: FormDrawerConfig = {
    createApi: '/user/memberTagGroup/create',
    title: '会员标签',
    width: 560,
    labelWidth: 110,
    sections: [
      {
        key: 'basic',
        title: '标签组信息',
        fields: [
          { field: 'groupName', label: t('标签组名称'), type: 'input', required: true, placeholder: t('请输入标签组名称') },
          {
            field: 'tags',
            label: t('标签值'),
            type: 'custom',
            render: ({ formApi, values }) => {
              const tags: TagItem[] = values.tags || [];
              return (
                <div className="member-tag-values">
                  {tags.map((item, index) => (
                    <div className="member-tag-value-item" key={index}>
                      <span className="member-tag-value-label">{t('选项{index}', { index: index + 1 })}</span>
                      <Input
                        style={{ flex: 1 }}
                        placeholder={t('请输入')}
                        value={item.tagName}
                        onChange={(next) => {
                          const nextTags = [...tags];
                          nextTags[index] = { ...item, tagName: next };
                          formApi?.setValue('tags', nextTags);
                        }}
                      />
                      {tags.length > 2 ? (
                        <Button
                          theme="borderless"
                          type="danger"
                          size="small"
                          onClick={() => formApi?.setValue('tags', tags.filter((_, i) => i !== index))}
                        >
                          {t('移除')}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    theme="borderless"
                    type="primary"
                    icon={<IconPlus />}
                    onClick={() => formApi?.setValue('tags', [...tags, { tagName: '' }])}
                  >
                    {t('新增选项')}
                  </Button>
                </div>
              );
            },
          },
        ],
      },
    ],
    toPayload: (values) => {
      const tags = (values.tags || []).filter((item: TagItem) => String(item.tagName || '').trim());
      if (!String(values.groupName || '').trim()) throw new Error(t('请输入标签组名称'));
      if (tags.length < 2) throw new Error(t('请至少填写两个标签值'));
      return { groupName: values.groupName, tags };
    },
  };

  return (
    <div className="member-tags-page">
      <ListPage<TagGroupRow>
        key={reloadKey}
        api="/user/memberTagGroup/list"
        rowKey="id"
        pageSize={10}
        actionWidth={220}
        columns={columns}
        rowActions={(row) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
              {t('编辑')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => deleteGroup(row)}>
              {t('删除')}
            </Button>
            <Button theme="borderless" size="small" onClick={() => toggleTop(row)}>
              {Number(row.isTop ?? 0) > 0 ? t('取消置顶') : t('置顶')}
            </Button>
          </Space>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" onClick={openCreate}>
            {t('新增标签')}
          </Button>
        }
      />

      <FormDrawer
        visible={drawerOpen}
        mode={drawerMode}
        initialValues={drawerInitial}
        config={drawerConfig}
        saving={saving}
        onCancel={() => setDrawerOpen(false)}
        onSubmit={saveTagGroup}
      />
    </div>
  );
}
