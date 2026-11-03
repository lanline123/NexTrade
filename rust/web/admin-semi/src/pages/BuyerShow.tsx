import { useState } from 'react';
import { Button, Modal, Space, Tabs, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import AutoConfigPage from './AutoConfigPage';

interface BuyerShowRow {
  buyerShowId: number;
  content?: string;
  groupList?: string;
  productCount?: number;
  likeCount?: number;
  commentCount?: number;
  addTime?: string;
  buyerName?: string;
  statusText?: string;
  status?: number;
  sortOrder?: number;
}

interface GroupRow {
  buyerShowGroupId: number;
  groupName?: string;
  productGroupName?: string;
  buyerShowCount?: number;
}

interface CommentRow {
  buyerShowCommentId: number;
  content?: string;
  addTime?: string;
  userName?: string;
  statusText?: string;
  isTop?: number;
  buyerShowId?: number;
}

function BuyerShowList() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const action = async (api: string, payload: Record<string, unknown>, message: string) => {
    try {
      await apiPost(api, payload);
      Toast.success({ content: message });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const columns: ColumnConfig<BuyerShowRow>[] = [
    { title: '买家秀内容', dataIndex: 'content', width: 300, render: (value: string) => value || '-' },
    { title: '分组', dataIndex: 'groupList', width: 160, render: (value: string) => value || '-' },
    { title: '商品数', dataIndex: 'productCount', width: 80 },
    { title: '点赞数', dataIndex: 'likeCount', width: 80 },
    { title: '评论数', dataIndex: 'commentCount', width: 80 },
    { title: '创建时间', dataIndex: 'addTime', width: 180 },
    { title: '发布人', dataIndex: 'buyerName', width: 130 },
    { title: '状态', dataIndex: 'statusText', width: 90 },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
  ];

  return (
    <ListPage<BuyerShowRow>
      key={reloadKey}
      api="/promotion/buyerShow/list"
      rowKey="buyerShowId"
      pageSize={10}
      selectable
      actionWidth={220}
      filters={[
        {
          field: 'status',
          label: '状态',
          type: 'select',
          width: 120,
          options: [
            { label: '待审核', value: -1 },
            { label: '隐藏', value: 0 },
            { label: '公开', value: 1 },
          ],
        },
        {
          field: 'goodsId',
          label: '商品',
          type: 'input',
          width: 200,
          placeholder: '输入商品ID',
        },
        {
          field: 'keyword',
          label: '买家秀内容',
          type: 'input',
          placeholder: '请输入买家秀内容',
          width: 240,
        },
      ]}
      columns={columns}
      rowActions={(record) => (
        <Space spacing={2}>
          <Button
            theme="borderless"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/audit',
                { buyerShowId: record.buyerShowId, status: 1 },
                t('审核通过'),
              )
            }
          >
            {t('通过')}
          </Button>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/audit',
                { buyerShowId: record.buyerShowId, status: 2 },
                t('已拒绝'),
              )
            }
          >
            {t('拒绝')}
          </Button>
          <Button
            theme="borderless"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/showOrHide',
                { buyerShowId: record.buyerShowId, isShow: record.status === 1 ? 0 : 1 },
                t('状态已更新'),
              )
            }
          >
            {record.status === 1 ? t('隐藏') : t('公开')}
          </Button>
        </Space>
      )}
      batchActions={(rows, clear) => (
        <Space>
          <Button
            size="small"
            onClick={() =>
              apiPost('/promotion/buyerShow/batch', {
                ids: rows.map((row) => row.buyerShowId),
                type: 'audit',
                value: 1,
              }).then(() => {
                Toast.success({ content: t('批量通过成功') });
                clear();
                setReloadKey((key) => key + 1);
              })
            }
          >
            {t('批量通过')}
          </Button>
          <Button
            size="small"
            onClick={() =>
              apiPost('/promotion/buyerShow/batch', {
                ids: rows.map((row) => row.buyerShowId),
                type: 'audit',
                value: 2,
              }).then(() => {
                Toast.success({ content: t('批量拒绝成功') });
                clear();
                setReloadKey((key) => key + 1);
              })
            }
          >
            {t('批量拒绝')}
          </Button>
        </Space>
      )}
    />
  );
}

function BuyerShowGroups() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const columns: ColumnConfig<GroupRow>[] = [
    { title: '分组名称', dataIndex: 'groupName', width: 240 },
    { title: '关联商品分组', dataIndex: 'productGroupName', render: (value: string) => value || '-' },
    { title: '买家秀数量', dataIndex: 'buyerShowCount', width: 140 },
  ];

  return (
    <ListPage<GroupRow>
      key={reloadKey}
      api="/promotion/buyerShow/group/list"
      rowKey="buyerShowGroupId"
      pageSize={10}
      actionWidth={150}
      columns={columns}
      drawer={{
        title: '买家秀分组',
        addText: '添加分组',
        width: 560,
        labelWidth: 'auto',
        inputWidth: 360,
        createApi: '/promotion/buyerShow/group/create',
        updateApi: '/promotion/buyerShow/group/update',
        detailApi: '/promotion/buyerShow/group/detail',
        deleteApi: '/promotion/buyerShow/group/del',
        idField: 'buyerShowGroupId',
        sections: [
          {
            key: 'basic',
            title: '分组信息',
            fields: [
              { field: 'groupName', label: t('分组名称'), required: true },
              {
                field: 'productGroups',
                label: t('关联商品分组'),
                type: 'select',
                multiple: true,
                required: true,
                optionsApi: '/product/productGroup/list',
                optionsParams: { page: 1, size: 100 },
                optionLabel: 'groupName',
                optionValue: 'groupId',
              },
            ],
          },
        ],
        toPayload: (values) => ({
          ...values,
          buyerShowGroupId: values.buyerShowGroupId
            ? Number(values.buyerShowGroupId)
            : undefined,
          productGroups: values.productGroups || [],
        }),
      }}
    />
  );
}

function BuyerShowComments() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);

  const action = async (api: string, payload: Record<string, unknown>, message: string) => {
    try {
      await apiPost(api, payload);
      Toast.success({ content: message });
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const columns: ColumnConfig<CommentRow>[] = [
    { title: '评论内容', dataIndex: 'content', render: (value: string) => value || '-' },
    { title: '发布时间', dataIndex: 'addTime', width: 180 },
    { title: '发布人', dataIndex: 'userName', width: 140 },
    { title: '状态', dataIndex: 'statusText', width: 100 },
  ];

  return (
    <ListPage<CommentRow>
      key={reloadKey}
      api="/promotion/buyerShow/commentInfo/list"
      rowKey="buyerShowCommentId"
      pageSize={10}
      selectable
      actionWidth={260}
      filters={[
        {
          field: 'status',
          label: '状态',
          type: 'select',
          width: 120,
          options: [
            { label: '待审核', value: -1 },
            { label: '隐藏', value: 0 },
            { label: '公开', value: 1 },
          ],
        },
      ]}
      columns={columns}
      rowActions={(record) => (
        <Space spacing={2}>
          <Button
            theme="borderless"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/commentInfo/audit',
                { buyerShowCommentId: record.buyerShowCommentId, status: 1 },
                t('审核通过'),
              )
            }
          >
            {t('通过')}
          </Button>
          <Button
            theme="borderless"
            type="danger"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/commentInfo/audit',
                { buyerShowCommentId: record.buyerShowCommentId, status: 2 },
                t('已拒绝'),
              )
            }
          >
            {t('拒绝')}
          </Button>
          <Button
            theme="borderless"
            size="small"
            onClick={() =>
              action(
                '/promotion/buyerShow/commentInfo/isTop',
                { buyerShowCommentId: record.buyerShowCommentId, isTop: record.isTop === 1 ? 0 : 1 },
                t('置顶状态已更新'),
              )
            }
          >
            {record.isTop === 1 ? t('取消置顶') : t('置顶')}
          </Button>
        </Space>
      )}
      batchActions={(rows, clear) => (
        <Space>
          <Button
            size="small"
            onClick={() =>
              apiPost('/promotion/buyerShow/commentInfo/batch', {
                ids: rows.map((row) => row.buyerShowCommentId),
                type: 'audit',
                value: 1,
              }).then(() => {
                Toast.success({ content: t('批量通过成功') });
                clear();
                setReloadKey((key) => key + 1);
              })
            }
          >
            {t('批量通过')}
          </Button>
        </Space>
      )}
    />
  );
}

function BuyerShowSettings() {
  return (
    <AutoConfigPage
      title="买家秀设置"
      getApi="/setting/config/buyerShowSettings"
      saveApi="/setting/config/saveBuyerShow"
    />
  );
}

export default function BuyerShow() {
  const { t } = useI18n();
  const [tab, setTab] = useState('list');
  return (
    <Tabs activeKey={tab} onChange={(key) => setTab(String(key))} type="line">
      <Tabs.TabPane tab={t('买家秀')} itemKey="list">
        <BuyerShowList />
      </Tabs.TabPane>
      <Tabs.TabPane tab={t('分组')} itemKey="groups">
        <BuyerShowGroups />
      </Tabs.TabPane>
      <Tabs.TabPane tab={t('评论')} itemKey="comments">
        <BuyerShowComments />
      </Tabs.TabPane>
      <Tabs.TabPane tab={t('设置')} itemKey="settings">
        <BuyerShowSettings />
      </Tabs.TabPane>
    </Tabs>
  );
}
