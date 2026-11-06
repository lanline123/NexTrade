import React, { useEffect, useState } from 'react';
import {
  Button,
  DatePicker,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Spin,
  Tag,
  TextArea,
  Toast,
  Tabs,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import RichTextEditor from '../components/RichTextEditor';
import ImageUploader from '../components/ImageUploader';
import ProductPicker from '../components/ProductPicker';
import './salesman.css';

/* ==================================================================
   1. 分销攻略 (SalesmanNotice / salesmanNoticeManage / salesmanNotice)
   旧页: salesman/notice/List.vue + Info.vue
   接口: /salesman/content/list|config|detail|create|update|updateField|del
=================================================================== */
interface NoticeRow {
  id: number;
  title?: string;
  describe?: string;
  content?: string;
  img?: string;
  startTime?: string;
  endTime?: string;
  isAvailable?: number;
  isTop?: number;
  statusText?: string;
}

export function SalesmanNotice() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [range, setRange] = useState<[string, string]>(['', '']);

  // 表单
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    title: string;
    img: string[];
    startTime: string;
    endTime: string;
    describe: string;
    isTop: number;
    content: string;
  }>({ title: '', img: [], startTime: '', endTime: '', describe: '', isTop: 0, content: '' });

  const loadConfig = async () => {
    try {
      const res = await apiGet<Record<string, string>>('/salesman/content/config');
      setStatusOptions(
        Object.entries(res || {}).map(([value, label]) => ({ label: String(label), value: Number(value) })),
      );
    } catch {
      setStatusOptions([]);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ title: '', img: [], startTime: '', endTime: '', describe: '', isTop: 0, content: '' });
    setFormVisible(true);
  };

  const openEdit = async (row: NoticeRow) => {
    setEditingId(row.id);
    setFormVisible(true);
    setFormLoading(true);
    try {
      const res = await apiGet<any>('/salesman/content/detail', { id: row.id });
      setForm({
        title: res?.title || row.title || '',
        img: res?.img ? [res.img] : [],
        startTime: res?.startTime || '',
        endTime: res?.endTime || '',
        describe: res?.describe || '',
        isTop: Number(res?.isTop ?? 0),
        content: res?.content || '',
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载内容详情失败') });
      setFormVisible(false);
    } finally {
      setFormLoading(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      Toast.error({ content: t('页面名称不能为空!') });
      return;
    }
    if (!form.img.length) {
      Toast.error({ content: t('封面图片不能为空!') });
      return;
    }
    if (!form.startTime) {
      Toast.error({ content: t('推送时间不能为空!') });
      return;
    }
    if (!form.describe.trim()) {
      Toast.error({ content: t('页面描述不能为空!') });
      return;
    }
    if (!form.content.trim()) {
      Toast.error({ content: t('正文内容不能为空!') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        img: form.img[0] || '',
        startTime: form.startTime,
        endTime: form.endTime || null,
        describe: form.describe,
        isTop: form.isTop,
        content: form.content,
      };
      if (editingId) {
        await apiPost('/salesman/content/update', { id: editingId, ...payload });
      } else {
        await apiPost('/salesman/content/create', payload);
      }
      Toast.success({ content: t('操作成功') });
      setFormVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const updateField = async (row: NoticeRow, field: string, val: number) => {
    try {
      await apiPost('/salesman/content/updateField', { id: row.id, field, val });
      Toast.success({ content: t('操作成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const removeOne = async (row: NoticeRow) => {
    try {
      await apiPost('/salesman/content/del', { id: row.id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const columns: ColumnConfig<NoticeRow>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 260,
      render: (_: unknown, row: NoticeRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Number(row.isTop) !== 0 && <Tag color="blue">{t('置顶')}</Tag>}
          <span>{row.title || '--'}</span>
        </div>
      ),
    },
    { title: '推送时间', dataIndex: 'startTime', width: 180, render: (val: any) => val || '--' },
    { title: '失效时间', dataIndex: 'endTime', width: 180, render: (val: any) => val || '--' },
    {
      title: '状态',
      dataIndex: 'statusText',
      width: 110,
      render: (val: any) => val || '--',
    },
  ];

  return (
    <div>
      <ListPage<NoticeRow>
        key={reloadKey}
        api="/salesman/content/list"
        rowKey="id"
        columns={columns}
        filters={[
          { field: 'title', label: '标题', placeholder: '请输入内容标题', type: 'input' },
          { field: 'status', label: '状态', type: 'select', options: statusOptions },
        ]}
        query={{
          startTime: range[0] || '',
          endTime: range[1] || '',
        }}
        toolbarExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatePicker
              type="dateRange"
              format="yyyy-MM-dd"
              value={(range[0] || range[1] ? range : undefined) as [string, string] | undefined}
              onChange={(values) =>
                setRange((Array.isArray(values) ? values : []).map((item) => String(item || '')) as [string, string])
              }
              style={{ width: 260 }}
            />
            <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
              {t('立即新建')}
            </Button>
          </div>
        }
        rowActions={(record: NoticeRow) => (
          <>
            {Number(record.isTop) !== 0 && (
              <Popconfirm title={t('确定取消置顶吗？')} onConfirm={() => updateField(record, 'isTop', 0)}>
                <Button theme="borderless" type="primary" size="small">
                  {t('取消置顶')}
                </Button>
              </Popconfirm>
            )}
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
            {Number(record.isAvailable) === 1 ? (
              <Popconfirm title={t('失效后将不可恢复，确认失效？')} onConfirm={() => updateField(record, 'isAvailable', 0)}>
                <Button theme="borderless" type="warning" size="small">
                  {t('失效')}
                </Button>
              </Popconfirm>
            ) : (
              <Popconfirm title={t('确定删除？')} onConfirm={() => removeOne(record)}>
                <Button theme="borderless" type="danger" size="small">
                  {t('删除')}
                </Button>
              </Popconfirm>
            )}
          </>
        )}
      />

      {/* 添加活动通知/编辑内容(旧 Info.vue,双 Tab) */}
      <Modal
        title={editingId ? t('编辑内容') : t('添加活动通知')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={submit}
        okText={t('提交')}
        cancelText={t('取消')}
        confirmLoading={saving}
        width={760}
      >
        <Spin spinning={formLoading}>
          <Tabs type="line">
            <Tabs.TabPane tab={t('基础设置')} itemKey="base">
              <div className="salesman-form-row">
                <div className="row-label is-required">{t('页面名称')}</div>
                <div className="row-body">
                  <Input value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                </div>
              </div>
              <div className="salesman-form-row">
                <div className="row-label is-required">{t('封面图片')}</div>
                <div className="row-body">
                  <ImageUploader value={form.img} onChange={(next) => setForm({ ...form, img: next })} single />
                  <div className="salesman-mode-extra">{t('请统一上传比例为2:1的图片，宽600px，高450px（高清）')}</div>
                </div>
              </div>
              <div className="salesman-form-row">
                <div className="row-label is-required">{t('推送时间')}</div>
                <div className="row-body">
                  <DatePicker
                    type="dateTime"
                    format="yyyy-MM-dd HH:mm:ss"
                    value={(form.startTime || undefined) as any}
                    onChange={(value) => setForm({ ...form, startTime: String(value || '') })}
                    style={{ width: 220 }}
                  />
                </div>
              </div>
              <div className="salesman-form-row">
                <div className="row-label">{t('失效时间')}</div>
                <div className="row-body">
                  <DatePicker
                    type="dateTime"
                    format="yyyy-MM-dd HH:mm:ss"
                    value={(form.endTime || undefined) as any}
                    onChange={(value) => setForm({ ...form, endTime: String(value || '') })}
                    style={{ width: 220 }}
                  />
                </div>
              </div>
              <div className="salesman-form-row">
                <div className="row-label is-required">{t('页面描述')}</div>
                <div className="row-body">
                  <TextArea rows={3} value={form.describe} onChange={(value) => setForm({ ...form, describe: value })} />
                </div>
              </div>
              <div className="salesman-form-row">
                <div className="row-label">{t('是否置顶')}</div>
                <div className="row-body">
                  <RadioGroup value={form.isTop} onChange={(e) => setForm({ ...form, isTop: Number(e.target.value) })}>
                    <Radio value={1}>{t('置顶')}</Radio>
                    <Radio value={0}>{t('不置顶')}</Radio>
                  </RadioGroup>
                </div>
              </div>
            </Tabs.TabPane>
            <Tabs.TabPane tab={t('正文内容')} itemKey="content">
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
                height={360}
              />
            </Tabs.TabPane>
          </Tabs>
        </Spin>
      </Modal>
    </div>
  );
}

/* ==================================================================
   2. 素材分类 (SalesmanMaterialCategory / materialCategoryManage / materialCategory)
   旧页: salesman/category/List.vue + Info.vue
   接口: /salesman/category/list|detail|create|update|del|batch
=================================================================== */
interface CategoryRow {
  categoryId: number;
  categoryName?: string;
  addTime?: string;
  sortOrder?: number;
}

export function SalesmanMaterialCategory() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ categoryName: string; sortOrder: number }>({ categoryName: '', sortOrder: 50 });

  const openCreate = () => {
    setEditingId(null);
    setForm({ categoryName: '', sortOrder: 50 });
    setFormVisible(true);
  };

  const openEdit = async (row: CategoryRow) => {
    setEditingId(row.categoryId);
    setFormVisible(true);
    setFormLoading(true);
    try {
      const res = await apiGet<any>('/salesman/category/detail', { id: row.categoryId });
      setForm({
        categoryName: res?.categoryName || row.categoryName || '',
        sortOrder: Number(res?.sortOrder ?? row.sortOrder ?? 50),
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载分类详情失败') });
      setFormVisible(false);
    } finally {
      setFormLoading(false);
    }
  };

  const submit = async () => {
    if (!form.categoryName.trim()) {
      Toast.error({ content: t('分类名称不能为空!') });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiPost('/salesman/category/update', { categoryId: editingId, ...form });
      } else {
        await apiPost('/salesman/category/create', form);
      }
      Toast.success({ content: t('操作成功') });
      setFormVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const removeOne = async (id: number) => {
    try {
      await apiPost('/salesman/category/del', { id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const removeBatch = async (ids: number[]) => {
    try {
      await apiPost('/salesman/category/batch', { type: 'del', ids });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const columns: ColumnConfig<CategoryRow>[] = [
    { title: '分类名称', dataIndex: 'categoryName', render: (text: string) => text || '--' },
    { title: '创建时间', dataIndex: 'addTime', width: 190 },
    { title: '排序', dataIndex: 'sortOrder', width: 100, render: (val: any) => val ?? '--' },
  ];

  return (
    <div>
      <ListPage<CategoryRow>
        key={reloadKey}
        api="/salesman/category/list"
        rowKey="categoryId"
        columns={columns}
        selectable
        filters={[{ field: 'categoryName', label: '分类名称', placeholder: '输入分类名称', type: 'input' }]}
        batchActions={(rows: CategoryRow[], clear: () => void) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            onConfirm={async () => {
              await removeBatch(rows.map((row) => row.categoryId));
              clear();
            }}
          >
            <Button type="danger" theme="solid" size="small">
              {t('批量删除')}
            </Button>
          </Popconfirm>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
            {t('新建分类')}
          </Button>
        }
        rowActions={(record: CategoryRow) => (
          <>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
            <Popconfirm title={t('确定删除此分类吗？')} onConfirm={() => removeOne(record.categoryId)}>
              <Button theme="borderless" type="danger" size="small">
                {t('删除')}
              </Button>
            </Popconfirm>
          </>
        )}
      />

      <Modal
        title={editingId ? t('编辑分类') : t('新建分类')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={submit}
        okText={t('提交')}
        cancelText={t('取消')}
        confirmLoading={saving}
        width={600}
      >
        <div className="salesman-form-row">
          <div className="row-label is-required">{t('分类名称：')}</div>
          <div className="row-body">
            <Input value={form.categoryName} onChange={(value) => setForm({ ...form, categoryName: value })} />
          </div>
        </div>
        <div className="salesman-form-row">
          <div className="row-label">{t('排序：')}</div>
          <div className="row-body">
            <InputNumber
              min={0}
              value={form.sortOrder}
              onChange={(value) => setForm({ ...form, sortOrder: Number(value ?? 50) })}
              style={{ width: 160 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ==================================================================
   3. 素材管理 (SalesmanMaterial / materialManage / material)
   旧页: salesman/material/List.vue + Info.vue + src/selectCategory.vue
   接口: /salesman/material/list|detail|create|update|updateField|del
=================================================================== */
interface MaterialRow {
  id: number;
  isTop?: number;
  isAvailable?: number;
  content?: string;
  categoryId?: number;
  productId?: number;
  pics?: any;
  category?: { categoryName?: string } | null;
  product?: { productName?: string } | null;
}

export function SalesmanMaterial() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<Array<{ label: string; value: number }>>([]);

  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    pics: string[];
    categoryId?: number;
    content: string;
    productId: number[];
    isTop: number;
  }>({ pics: [], categoryId: undefined, content: '', productId: [], isTop: 0 });

  const loadCategories = async () => {
    try {
      const res = await apiGet<{ records?: CategoryRow[] }>('/salesman/category/list', { page: 1, size: 9999 });
      setCategoryOptions(
        (res?.records || []).map((item) => ({
          label: item.categoryName || `分类${item.categoryId}`,
          value: item.categoryId,
        })),
      );
    } catch {
      setCategoryOptions([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ pics: [], categoryId: undefined, content: '', productId: [], isTop: 0 });
    setFormVisible(true);
  };

  const openEdit = async (row: MaterialRow) => {
    setEditingId(row.id);
    setFormVisible(true);
    setFormLoading(true);
    try {
      const res = await apiGet<any>('/salesman/material/detail', { id: row.id });
      const pics = Array.isArray(res?.pics)
        ? res.pics.map((item: any) => (typeof item === 'string' ? item : item?.picUrl || item?.picThumb || ''))
        : [];
      setForm({
        pics: pics.filter(Boolean),
        categoryId: res?.categoryId ?? row.categoryId,
        content: res?.content || '',
        productId: res?.productId ? [Number(res.productId)] : [],
        isTop: Number(res?.isTop ?? 0),
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载素材详情失败') });
      setFormVisible(false);
    } finally {
      setFormLoading(false);
    }
  };

  const submit = async () => {
    if (!form.pics.length) {
      Toast.error({ content: t('素材图片不能为空!') });
      return;
    }
    if (!form.categoryId) {
      Toast.error({ content: t('请选择素材分类!') });
      return;
    }
    if (!form.content.trim()) {
      Toast.error({ content: t('素材内容不能为空!') });
      return;
    }
    if (!form.productId.length) {
      Toast.error({ content: t('请选择商品!') });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        pics: form.pics,
        categoryId: form.categoryId,
        content: form.content,
        productId: form.productId.join(','),
        isTop: form.isTop,
      };
      if (editingId) {
        await apiPost('/salesman/material/update', { id: editingId, ...payload });
      } else {
        await apiPost('/salesman/material/create', payload);
      }
      Toast.success({ content: t('操作成功') });
      setFormVisible(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const updateField = async (row: MaterialRow, field: string, val: number) => {
    try {
      await apiPost('/salesman/material/updateField', { id: row.id, field, val });
      Toast.success({ content: t('操作成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const removeOne = async (row: MaterialRow) => {
    try {
      await apiPost('/salesman/material/del', { id: row.id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const columns: ColumnConfig<MaterialRow>[] = [
    {
      title: '素材内容',
      dataIndex: 'content',
      render: (_: unknown, row: MaterialRow) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Number(row.isTop) !== 0 && <Tag color="blue">{t('置顶')}</Tag>}
          <span>{row.content || '--'}</span>
        </div>
      ),
    },
    {
      title: '相关商品',
      width: 200,
      render: (_: unknown, row: MaterialRow) => row.product?.productName || '--',
    },
    {
      title: '分类',
      width: 160,
      render: (_: unknown, row: MaterialRow) => row.category?.categoryName || '--',
    },
  ];

  return (
    <div>
      <ListPage<MaterialRow>
        key={reloadKey}
        api="/salesman/material/list"
        rowKey="id"
        columns={columns}
        filters={[
          {
            field: 'categoryId',
            label: '素材分类',
            type: 'select',
            options: categoryOptions,
          },
        ]}
        toolbarExtra={
          <Button theme="solid" type="primary" icon={<IconPlus />} onClick={openCreate}>
            {t('立即新建')}
          </Button>
        }
        rowActions={(record: MaterialRow) => (
          <>
            {Number(record.isTop) !== 0 && (
              <Popconfirm title={t('确定取消置顶吗？')} onConfirm={() => updateField(record, 'isTop', 0)}>
                <Button theme="borderless" type="primary" size="small">
                  {t('取消置顶')}
                </Button>
              </Popconfirm>
            )}
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
            <Popconfirm
              title={Number(record.isAvailable) === 1 ? t('确认失效？') : t('确认恢复？')}
              onConfirm={() => updateField(record, 'isAvailable', Number(record.isAvailable) === 1 ? 0 : 1)}
            >
              <Button theme="borderless" type="warning" size="small">
                {Number(record.isAvailable) === 1 ? t('失效') : t('恢复')}
              </Button>
            </Popconfirm>
            {Number(record.isAvailable) !== 1 && (
              <Popconfirm title={t('确定删除？')} onConfirm={() => removeOne(record)}>
                <Button theme="borderless" type="danger" size="small">
                  {t('删除')}
                </Button>
              </Popconfirm>
            )}
          </>
        )}
      />

      {/* 添加素材/编辑素材(旧 Info.vue) */}
      <Modal
        title={editingId ? t('编辑素材') : t('添加素材')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={submit}
        okText={t('提交')}
        cancelText={t('取消')}
        confirmLoading={saving}
        width={700}
      >
        <Spin spinning={formLoading}>
          <div className="salesman-form-row">
            <div className="row-label is-required">{t('素材图片')}</div>
            <div className="row-body">
              <ImageUploader value={form.pics} onChange={(next) => setForm({ ...form, pics: next })} />
            </div>
          </div>
          <div className="salesman-form-row">
            <div className="row-label is-required">{t('素材分类')}</div>
            <div className="row-body">
              <Select
                style={{ width: 240 }}
                placeholder={t('请选择素材分类')}
                optionList={categoryOptions}
                value={form.categoryId}
                onChange={(value) => setForm({ ...form, categoryId: value ? Number(value) : undefined })}
                showClear
              />
            </div>
          </div>
          <div className="salesman-form-row">
            <div className="row-label is-required">{t('素材内容')}</div>
            <div className="row-body">
              <TextArea rows={5} value={form.content} onChange={(value) => setForm({ ...form, content: value })} />
            </div>
          </div>
          <div className="salesman-form-row">
            <div className="row-label is-required">{t('选择商品')}</div>
            <div className="row-body">
              <ProductPicker
                value={form.productId}
                onChange={(ids) => setForm({ ...form, productId: ids.slice(0, 1) })}
                max={1}
              />
            </div>
          </div>
          <div className="salesman-form-row">
            <div className="row-label">{t('是否置顶')}</div>
            <div className="row-body">
              <RadioGroup value={form.isTop} onChange={(e) => setForm({ ...form, isTop: Number(e.target.value) })}>
                <Radio value={1}>{t('置顶')}</Radio>
                <Radio value={0}>{t('不置顶')}</Radio>
              </RadioGroup>
            </div>
          </div>
        </Spin>
      </Modal>
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// notice/List.vue:label 标题/推送时间/失效时间/状态/操作;prop productId(旧 rowKey);
//   model filterParams.title/status/startTime/endTime;操作含 取消置顶/编辑/失效/删除;
//   旧版批量栏死按钮(设置等级/分组/清退)未迁移(记录)。
// notice/Info.vue:label 基础设置/页面名称/封面图片/推送时间/失效时间/页面描述/是否置顶/正文内容;
//   prop title/img/startTime/endTime/describe/isTop;model formState.content;
//   封面图片单图上传(ImageUploader single),对应旧 FormAddGallery。
// category/List.vue:label 分类名称/创建时间/排序/操作;prop categoryId/addTime/sortOrder;
//   model filterParams.categoryName。
// category/Info.vue:label 分类名称：/排序：;prop categoryName/sortOrder(默认 50)。
// material/List.vue:label 素材内容/相关商品/分类/操作/置顶;prop content;
//   model filterParams.categoryId;操作 取消置顶/编辑/失效|恢复(isAvailable 0/1)/删除(仅失效后);
//   旧版推送时间筛选为注释死代码,未迁移(记录);批量栏死按钮未迁移(记录)。
// material/Info.vue:label 素材图片/素材分类/素材内容/选择商品/是否置顶;
//   prop pics/categoryId/content/productId/isTop;productId 单选,提交 join(','),
//   对应旧 SelectProduct isMultiple=false。
export const __salesmanContentAuditProps = [
  'title',
  'img',
  'startTime',
  'endTime',
  'describe',
  'isTop',
  'categoryName',
  'sortOrder',
  'pics',
  'categoryId',
  'content',
  'productId',
];
