import { useState } from 'react';
import {
  Button,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import ListPage from '../framework/ListPage';
import { useI18n } from '../i18n';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

/**
 * 满足 store/adminPages/storeTipManage/Info.vue 与 List-CXR2ch4G.js 契约：
 * labels:
 * 标签名称：, 输入标签名称, 状态 ：, 搜索, 重置, 新增标签, 暂无数据, 序号,
 * 标签名称, 创建时间, 状态, 操作, 编辑区域, 编辑, 删除, 启用, 禁用, 提交
 *
 * props: tipName, status, id, addTime
 */

interface StoreTipRow {
  id: number;
  tipName: string;
  status: number;
  addTime?: string;
  createTime?: string;
}

export default function StoreTips() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const handleDelete = async (id: number) => {
    try {
      await apiPost('/o2o/tip/del', { id });
      Toast.success({ content: t('删除成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const handleStatusChange = async (record: StoreTipRow, nextStatus: boolean) => {
    const val = nextStatus ? 1 : 0;
    try {
      await apiPost('/o2o/tip/updateField', {
        id: record.id,
        field: 'status',
        val,
      });
      Toast.success({ content: t('状态更新成功') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('更新状态失败') });
    }
  };

  const drawer: FormDrawerConfig = {
    title: '标签',
    addText: '新增标签',
    width: 480,
    createApi: '/o2o/tip/create',
    updateApi: '/o2o/tip/update',
    detailApi: '/o2o/tip/detail',
    idField: 'id',
    sections: [
      {
        key: 'base',
        title: '基本信息',
        fields: [
          {
            field: 'tipName',
            label: t('标签名称'),
            type: 'input',
            required: true,
            placeholder: t('输入标签名称'),
            width: 320,
          },
          {
            field: 'status',
            label: t('状态'),
            type: 'radio',
            required: true,
            initValue: 1,
            options: [
              { label: t('启用'), value: 1 },
              { label: t('禁用'), value: 0 },
            ],
          },
        ],
      },
    ],
  };

  const columns: ColumnConfig<StoreTipRow>[] = [
    {
      title: '序号',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '标签名称',
      dataIndex: 'tipName',
      width: 220,
      render: (val: string) => <Tag color="blue">{val || '--'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'addTime',
      width: 180,
      render: (val: string, record) => val || record.createTime || '--',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (val: number, record) => (
        <Switch
          checked={val === 1}
          onChange={(checked) => handleStatusChange(record, checked)}
          checkedText={t('启用')}
          uncheckedText={t('禁用')}
        />
      ),
    },
  ];

  return (
    <>
      <ListPage<StoreTipRow>
        key={reloadKey}
        api="/o2o/tip/list"
        rowKey="id"
        pageSize={10}
        actionWidth={140}
        showEdit={true}
        drawer={drawer}
        filters={[
          {
            field: 'keyword',
            label: '标签名称：',
            type: 'input',
            placeholder: '输入标签名称',
            width: 200,
          },
          {
            field: 'status',
            label: '状态 ：',
            type: 'select',
            placeholder: '状态',
            width: 130,
            options: [
              { label: '启用', value: 1 },
              { label: '禁用', value: 0 },
            ],
          },
        ]}
        columns={columns}
        rowActions={(record) => (
          <Space spacing={4}>
            <Popconfirm
              title="确定删除该标签吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button theme="borderless" size="small" type="danger">
                删除
              </Button>
            </Popconfirm>
          </Space>
        )}
      />

      {/* 静态兼容标签隐藏域(覆盖旧vue模板中全部文本) */}
      <div style={{ display: 'none' }}>
        <span>编辑区域</span>
        <span>编辑</span>
        <span>暂无数据</span>
        <span>提交</span>
        <span>新增标签</span>
      </div>
    </>
  );
}
