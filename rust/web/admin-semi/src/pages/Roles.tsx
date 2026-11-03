import { useState } from 'react';
import { Button, Modal, Space, Tag, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import AuthorityTree from '../components/AuthorityTree';

interface RoleRow {
  roleId: number;
  roleName: string;
  roleDesc?: string;
  roleType?: number;
  isSystem?: number;
  adminType?: string;
  authorityList?: string[];
}

export default function Roles() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [editRequest, setEditRequest] = useState<RoleRow | null>(null);

  const columns: ColumnConfig<RoleRow>[] = [
    {
      title: '角色名称',
      dataIndex: 'roleName',
      width: 240,
      render: (value: string, record) => (
        <Space>
          <span>{value}</span>
          {record.isSystem === 1 && (
            <Tag color="grey" size="small">
              {t('系统内置')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'roleDesc',
      render: (value: string) => value || '-',
    },
  ];

  const removeRole = (record: RoleRow) => {
    Modal.confirm({
      title: t('删除角色'),
      content: t('确定删除角色「{name}」？', { name: record.roleName }),
      onOk: async () => {
        try {
          await apiPost('/authority/adminRole/del', { id: record.roleId });
          Toast.success({ content: t('删除成功') });
          setReloadKey((key) => key + 1);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  const batchDelete = (ids: number[], clear: () => void) => {
    Modal.confirm({
      title: t('批量删除角色'),
      content: t('确定删除选中的 {count} 个角色？', { count: ids.length }),
      onOk: async () => {
        try {
          await apiPost('/authority/adminRole/batch', { ids, type: 'del' });
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
    <ListPage<RoleRow>
      key={reloadKey}
      api="/authority/adminRole/list"
      rowKey="roleId"
      pageSize={10}
      selectable
      showEdit={false}
      actionWidth={150}
      editRequest={editRequest}
      onEditRequestHandled={() => setEditRequest(null)}
      filters={[
        {
          field: 'keyword',
          label: '角色',
          type: 'input',
          placeholder: '输入角色名称',
          width: 260,
        },
      ]}
      columns={columns}
      rowActions={(record) =>
        record.isSystem === 1 ? (
          <span className="text-muted">{t('系统内置不可修改')}</span>
        ) : (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => setEditRequest(record)}>
              {t('编辑')}
            </Button>
            <Button theme="borderless" type="danger" size="small" onClick={() => removeRole(record)}>
              {t('删除')}
            </Button>
          </Space>
        )
      }
      batchActions={(rows, clear) => (
        <Space>
          <Button size="small" onClick={() => batchDelete(rows.map((row) => row.roleId), clear)}>
            {t('批量删除')}
          </Button>
        </Space>
      )}
      drawer={{
        title: '角色',
        addText: '添加角色',
        width: 800,
        labelWidth: 'auto',
        inputWidth: 500,
        createApi: '/authority/adminRole/create',
        updateApi: '/authority/adminRole/update',
        detailApi: '/authority/adminRole/detail',
        idField: 'roleId',
        sections: [
          {
            key: 'basic',
            title: '角色信息',
            fields: [
              {
                field: 'roleName',
                label: t('角色名称'),
                required: true,
                placeholder: t('请输入角色名称'),
              },
              {
                field: 'roleDesc',
                label: t('角色描述'),
                type: 'textarea',
                placeholder: t('请输入角色描述'),
              },
              {
                field: 'authorityList',
                label: t('权限列表'),
                hideLabel: true,
                type: 'custom',
                render: ({ formApi, values }) => (
                  <AuthorityTree
                    value={values.authorityList || []}
                    onChange={(next) => formApi?.setValue('authorityList', next)}
                  />
                ),
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          roleId: values.roleId ? Number(values.roleId) : undefined,
          authorityList: values.authorityList || [],
        }),
      }}
    />
  );
}
