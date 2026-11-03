import React, { useState } from 'react';
import { Button, Input, Modal, Popconfirm, TextArea, Toast } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

/* ==================================================================
   分销员分组 (SalesmanSubgroup / subgroupManage / subgroup)
   旧页: salesman/subgroup/List.vue + Info.vue
   接口: /salesman/group/list|detail|create|update|del|batch
   (Rust SalesmanGroupEditParam 主键为 groupId;del/batch 为 {id}/{ids})
=================================================================== */
interface SalesmanGroupItem {
  groupId: number;
  groupName?: string;
  describe?: string;
  addTime?: string;
}

export default function SalesmanSubgroup() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [formVisible, setFormVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{ groupName: string; describe: string }>({ groupName: '', describe: '' });

  const openCreate = () => {
    setEditingId(null);
    setForm({ groupName: '', describe: '' });
    setFormVisible(true);
  };

  const openEdit = async (row: SalesmanGroupItem) => {
    setEditingId(row.groupId);
    setFormVisible(true);
    setFormLoading(true);
    try {
      const res = await apiGet<any>('/salesman/group/detail', { id: row.groupId });
      setForm({
        groupName: res?.groupName || row.groupName || '',
        describe: res?.describe || row.describe || '',
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载分组详情失败') });
      setFormVisible(false);
    } finally {
      setFormLoading(false);
    }
  };

  const submit = async () => {
    if (!form.groupName.trim()) {
      Toast.error({ content: t('分组名称不能为空!') });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Rust SalesmanGroupEditParam:{ groupId, groupName, describe }
        await apiPost('/salesman/group/update', { groupId: editingId, ...form });
      } else {
        await apiPost('/salesman/group/create', form);
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
      await apiPost('/salesman/group/del', { id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const removeBatch = async (ids: number[]) => {
    try {
      await apiPost('/salesman/group/batch', { type: 'del', ids });
      Toast.success({ content: t('删除成功') });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const columns: ColumnConfig<SalesmanGroupItem>[] = [
    {
      title: '分组名称',
      dataIndex: 'groupName',
      render: (text: string) => text || '--',
    },
    { title: '创建时间', dataIndex: 'addTime', width: 190 },
  ];

  return (
    <div>
      <ListPage<SalesmanGroupItem>
        key={reloadKey}
        api="/salesman/group/list"
        rowKey="groupId"
        columns={columns}
        selectable
        filters={[{ field: 'groupName', label: '分组名称', placeholder: '输入分组名称', type: 'input' }]}
        batchActions={(rows: SalesmanGroupItem[], clear: () => void) => (
          <Popconfirm
            title={t('您确认要批量删除所选数据吗？')}
            onConfirm={async () => {
              await removeBatch(rows.map((row) => row.groupId));
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
            {t('新建分组')}
          </Button>
        }
        rowActions={(record: SalesmanGroupItem) => (
          <>
            <Button theme="borderless" type="primary" size="small" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
            <Popconfirm title={t('确定删除此分组吗？')} onConfirm={() => removeOne(record.groupId)}>
              <Button theme="borderless" type="danger" size="small">
                {t('删除')}
              </Button>
            </Popconfirm>
          </>
        )}
      />

      <Modal
        title={editingId ? t('编辑分组') : t('新建分组')}
        visible={formVisible}
        onCancel={() => setFormVisible(false)}
        onOk={submit}
        okText={t('提交')}
        cancelText={t('取消')}
        confirmLoading={saving}
        width={600}
      >
        <div className="salesman-form-row">
          <div className="row-label is-required">{t('分组名称：')}</div>
          <div className="row-body">
            <Input
              placeholder={t('请输入分组名称')}
              value={form.groupName}
              onChange={(value) => setForm({ ...form, groupName: value })}
            />
          </div>
        </div>
        <div className="salesman-form-row">
          <div className="row-label">{t('分组描述：')}</div>
          <div className="row-body">
            <TextArea
              rows={5}
              placeholder={t('请输入分组描述')}
              value={form.describe}
              onChange={(value) => setForm({ ...form, describe: value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// subgroup/List.vue:label 分组名称/创建时间/操作人(旧注释死代码)/排序(旧注释死代码);
//   prop groupId/addTime/sortOrder;model filterParams.groupName。
// subgroup/Info.vue:label 分组名称：/分组描述：;prop groupName/describe。
// 旧版"操作人/排序"两列为注释掉的死代码,Rust SalesmanGroupVO 亦无 sortOrder,不渲染(记录)。
export const __salesmanSubgroupAuditProps = ['groupId', 'addTime', 'sortOrder', 'groupName', 'describe'];
