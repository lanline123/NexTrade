import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import FormDrawer from '../framework/FormDrawer';
import ImageUploader from '../components/ImageUploader';
import MultilingualField from '../components/MultilingualField';
import type { ColumnConfig, FormDrawerConfig } from '../framework/types';

const { Text } = Typography;

interface GrouponRow {
  grouponPromotionId: number;
  name?: string;
  startTime?: string;
  endTime?: string;
  groupType?: number;
  receiveAmount?: number | string;
  groupSuccessCount?: number;
  payOrderCount?: number;
  status?: number;
  statusName?: string;
}

const DEFAULT_FORM = {
  name: '',
  startTime: '',
  endTime: '',
  groupType: 1,
  expirationDays: 1,
  expirationHours: 0,
  expirationMinutes: 30,
  pcGrouponImage: '',
  grouponImage: '',
  shareImage: '',
  grouponExplain: '',
};

/** 拼团活动：对应旧版 promotion/groupon/List.vue + Info.vue + item/* + record/*。
 * 已实现：活动 CRUD、拼团商品管理（含 SKU 明细/阶梯价/虚拟成团）、
 * 参与记录（进行中的团 + 手动/批量成团 + 订单记录）、推广海报。 */
export default function Groupons() {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerInitial, setDrawerInitial] = useState<Record<string, any>>({ ...DEFAULT_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [itemTarget, setItemTarget] = useState<GrouponRow | null>(null);
  const [itemRows, setItemRows] = useState<any[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [recordTarget, setRecordTarget] = useState<GrouponRow | null>(null);
  const [recordRows, setRecordRows] = useState<any[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordTab, setRecordTab] = useState('join');
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [memberRows, setMemberRows] = useState<any[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberTarget, setMemberTarget] = useState<any | null>(null);
  const [itemEditOpen, setItemEditOpen] = useState(false);
  const [itemEditInitial, setItemEditInitial] = useState<Record<string, any> | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [postTarget, setPostTarget] = useState<any | null>(null);
  const [postInfo, setPostInfo] = useState<Record<string, any> | null>(null);
  const [postLoading, setPostLoading] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  const openCreate = () => {
    setDrawerMode('create');
    setEditingId(null);
    setDrawerInitial({ ...DEFAULT_FORM });
    setDrawerOpen(true);
  };

  const openEdit = async (row: GrouponRow) => {
    setDrawerMode('edit');
    setEditingId(row.grouponPromotionId);
    try {
      const detail = await apiGet<any>('/promotion/groupon/detail', { id: row.grouponPromotionId });
      const expiration = Number(detail?.expirationTime ?? 1800);
      setDrawerInitial({
        ...DEFAULT_FORM,
        ...detail,
        expirationDays: Math.floor(expiration / 86400),
        expirationHours: Math.floor((expiration % 86400) / 3600),
        expirationMinutes: Math.floor((expiration % 3600) / 60),
      });
    } catch {
      setDrawerInitial({ ...DEFAULT_FORM, ...row });
    }
    setDrawerOpen(true);
  };

  const saveGroupon = async (payload: Record<string, any>) => {
    if (!String(payload.name || '').trim()) {
      Toast.error({ content: t('活动名称不能为空') });
      return;
    }
    const expirationTime =
      Number(payload.expirationDays ?? 0) * 86400 +
      Number(payload.expirationHours ?? 0) * 3600 +
      Number(payload.expirationMinutes ?? 0) * 60;
    if (expirationTime < 900 || expirationTime > 30 * 86400) {
      Toast.error({ content: t('拼团有效期需在15分钟至30天之间') });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        name: payload.name,
        startTime: payload.startTime,
        endTime: payload.endTime,
        groupType: Number(payload.groupType ?? 1),
        expirationTime,
        pcGrouponImage: payload.pcGrouponImage || '',
        grouponImage: payload.grouponImage || '',
        shareImage: payload.shareImage || '',
        grouponExplain: payload.grouponExplain || '',
        memberRange: 0,
      };
      if (drawerMode === 'edit' && editingId) {
        await apiPost('/promotion/groupon/update', { ...body, grouponPromotionId: editingId });
      } else {
        await apiPost('/promotion/groupon/create', body);
      }
      Toast.success({ content: drawerMode === 'edit' ? t('更新成功') : t('创建成功') });
      setDrawerOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const finishGroupon = (row: GrouponRow) => {
    Modal.confirm({
      title: t('结束进行中的活动会影响粉丝正常购买，建议您提前告知或说明，确定要结束活动吗？'),
      onOk: async () => {
        try {
          await apiPost('/promotion/groupon/finish', { id: row.grouponPromotionId });
          Toast.success({ content: t('停止活动成功！') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const deleteGroupon = (row: GrouponRow) => {
    Modal.confirm({
      title: t('确认删除该活动？活动删除后，将不能恢复。'),
      onOk: async () => {
        try {
          await apiPost('/promotion/groupon/del', { id: row.grouponPromotionId });
          Toast.success({ content: t('删除成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const loadItems = async (row: GrouponRow) => {
    setItemLoading(true);
    try {
      const result = await apiGet<any>('/promotion/groupon/item/list', {
        grouponPromotionId: row.grouponPromotionId,
        page: 1,
        size: 50,
      });
      setItemRows(result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setItemLoading(false);
    }
  };

  const loadRecords = async (row: GrouponRow, tab = recordTab) => {
    setRecordLoading(true);
    setSelectedRecordIds([]);
    try {
      const api =
        tab === 'join'
          ? '/promotion/groupon/record/openJoinList'
          : '/promotion/groupon/record/orderList';
      const result = await apiGet<any>(api, {
        grouponPromotionId: row.grouponPromotionId,
        page: 1,
        size: 50,
      });
      setRecordRows(result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setRecordLoading(false);
    }
  };

  const openItemEdit = async (groupon: GrouponRow, item?: any) => {
    setItemTarget(groupon);
    setItemEditOpen(true);
    if (item) {
      // 编辑：拉详情回填（详情含 SKU 明细与阶梯价）
      try {
        const detail = await apiGet<any>('/promotion/groupon/item/detail', { id: item.itemId ?? item.grouponPromotionItemId });
        setItemEditInitial({ ...(item || {}), ...(detail || {}) });
      } catch {
        setItemEditInitial(item);
      }
    } else {
      setItemEditInitial({
        grouponPromotionId: groupon.grouponPromotionId,
        groupType: Number(groupon.groupType ?? 1),
        orderLimitNum: 0,
        isAutoGroup: 0,
        minGroupNum: 2,
        minGroupPrice: undefined,
        sort: 0,
        groupNums: [{ groupNumKey: 0, groupNum: 2 }],
        product: null,
        details: [],
      });
    }
  };

  const showPost = async (item: any) => {
    setPostTarget(item);
    setPostLoading(true);
    try {
      const result = await apiGet<any>('/promotion/groupon/item/post', {
        grouponPromotionItemId: item.itemId ?? item.grouponPromotionItemId,
      });
      setPostInfo(result || {});
    } catch (error) {
      setPostInfo(null);
      Toast.error({ content: error instanceof Error ? error.message : t('海报加载失败') });
    } finally {
      setPostLoading(false);
    }
  };

  const manualGroup = (record: any) => {
    Modal.confirm({
      title: t('确认手动成团？成团后不可恢复。'),
      onOk: async () => {
        try {
          await apiPost(
            `/promotion/groupon/record/manualGroup?grouponPromotionRecordId=${record.grouponPromotionRecordId}`,
          );
          Toast.success({ content: t('成团成功') });
          if (recordTarget) loadRecords(recordTarget);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const batchGroup = () => {
    if (selectedRecordIds.length === 0) return;
    Modal.confirm({
      title: t('确认对所选 {count} 个团执行手动成团？', { count: selectedRecordIds.length }),
      onOk: async () => {
        try {
          await apiPost('/promotion/groupon/record/batchGroup', selectedRecordIds);
          Toast.success({ content: t('批量成团成功') });
          if (recordTarget) loadRecords(recordTarget);
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const showMembers = async (record: any) => {
    setMemberTarget(record);
    setMemberLoading(true);
    try {
      const result = await apiGet<any>('/promotion/groupon/record/groupMemberList', {
        grouponPromotionRecordId: record.grouponPromotionRecordId,
      });
      setMemberRows(Array.isArray(result) ? result : result?.records || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载团员失败') });
      setMemberRows([]);
    } finally {
      setMemberLoading(false);
    }
  };

  const columns: ColumnConfig<GrouponRow>[] = [
    {
      title: '活动名称',
      dataIndex: 'name',
      width: 170,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: '活动时间',
      dataIndex: 'startTime',
      width: 320,
      render: (_: unknown, row: GrouponRow) => (
        <span>
          {row.startTime || '-'}{t('至')}{row.endTime || '-'}
        </span>
      ),
    },
    {
      title: '拼团类型',
      dataIndex: 'groupType',
      width: 100,
      render: (value: number) =>
        Number(value) === 1 ? <Tag color="blue">{t('普通团')}</Tag> : Number(value) === 2 ? <Tag color="purple">{t('阶梯团')}</Tag> : <span>-</span>,
    },
    { title: '应收金额', dataIndex: 'receiveAmount', width: 110 },
    { title: '成团数', dataIndex: 'groupSuccessCount', width: 90 },
    { title: '支付单数', dataIndex: 'payOrderCount', width: 90 },
    {
      title: '活动状态',
      dataIndex: 'statusName',
      width: 110,
      render: (value: string) => <span>{value || '-'}</span>,
    },
  ];

  const drawerConfig: FormDrawerConfig = {
    createApi: '/promotion/groupon/create',
    title: '拼团活动',
    width: 720,
    labelWidth: 120,
    sections: [
      {
        key: 'basic',
        title: '基础信息',
        fields: [
          {
            field: 'name',
            label: t('活动名称'),
            required: true,
            placeholder: t('请输入活动名称'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <MultilingualField
                value={values.name}
                onChange={(next: string) => formApi?.setValue('name', next)}
                dataId={editingId ?? 0}
                dataType={4}
                maxlength={60}
                placeholder={t('请输入活动名称')}
              />
            ),
          },
          {
            field: 'activityTime',
            label: t('活动时间'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <Space>
                <Input
                  style={{ width: 200 }}
                  placeholder={t('开始时间 YYYY-MM-DD HH:mm:ss')}
                  value={values.startTime || ''}
                  onChange={(next) => formApi?.setValue('startTime', next)}
                />
                <Input
                  style={{ width: 200 }}
                  placeholder={t('结束时间 YYYY-MM-DD HH:mm:ss')}
                  value={values.endTime || ''}
                  onChange={(next) => formApi?.setValue('endTime', next)}
                />
              </Space>
            ),
          },
          {
            field: 'groupType',
            label: t('拼团类型'),
            type: 'radio',
            options: [
              { label: t('普通团'), value: 1 },
              { label: t('阶梯团'), value: 2 },
            ],
          },
          {
            field: 'expirationTime',
            label: t('成团有效时间'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <div>
                <Space>
                  <InputNumber
                    style={{ width: 110 }}
                    min={0}
                    precision={0}
                    value={Number(values.expirationDays ?? 0)}
                    onChange={(next) => formApi?.setValue('expirationDays', Number(next ?? 0))}
                    addonAfter={t('日')}
                  />
                  <InputNumber
                    style={{ width: 110 }}
                    min={0}
                    precision={0}
                    value={Number(values.expirationHours ?? 0)}
                    onChange={(next) => formApi?.setValue('expirationHours', Number(next ?? 0))}
                    addonAfter={t('时')}
                  />
                  <InputNumber
                    style={{ width: 110 }}
                    min={0}
                    precision={0}
                    value={Number(values.expirationMinutes ?? 0)}
                    onChange={(next) => formApi?.setValue('expirationMinutes', Number(next ?? 0))}
                    addonAfter={t('分')}
                  />
                </Space>
                <p className="groupon-form-extra">
                  {t('拼团有效期需在15分钟至30天之间，若设置1日，用户开团后，需要在1日内成团，超时则拼团失败')}
                </p>
              </div>
            ),
          },
        ],
      },
      {
        key: 'images',
        title: '活动图片与规则',
        fields: [
          {
            field: 'pcGrouponImage',
            label: t('PC活动图片'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <ImageUploader
                single
                value={values.pcGrouponImage ? [values.pcGrouponImage] : []}
                onChange={(urls) => formApi?.setValue('pcGrouponImage', urls[0] || '')}
              />
            ),
          },
          {
            field: 'grouponImage',
            label: t('H5活动图片'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <ImageUploader
                single
                value={values.grouponImage ? [values.grouponImage] : []}
                onChange={(urls) => formApi?.setValue('grouponImage', urls[0] || '')}
              />
            ),
          },
          {
            field: 'shareImage',
            label: t('专题页分享图'),
            type: 'custom',
            render: ({ formApi, values }) => (
              <ImageUploader
                single
                value={values.shareImage ? [values.shareImage] : []}
                onChange={(urls) => formApi?.setValue('shareImage', urls[0] || '')}
              />
            ),
          },
          { field: 'grouponExplain', label: t('活动规则'), type: 'textarea' },
        ],
      },
    ],
    toPayload: (values) => {
      if (!String(values.name || '').trim()) throw new Error(t('活动名称不能为空'));
      return values;
    },
  };

  return (
    <div className="groupons-page">
      <ListPage<GrouponRow>
        key={reloadKey}
        api="/promotion/groupon/list"
        rowKey="grouponPromotionId"
        pageSize={10}
        actionWidth={300}
        filters={[
          { field: 'grouponName', label: '活动名称', type: 'input', placeholder: '输入活动名称', width: 240 },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Space spacing={2} wrap>
            <Button theme="borderless" size="small" onClick={() => openEdit(row)}>
              {t('编辑活动')}
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setItemTarget(row);
                loadItems(row);
              }}
            >
              {t('管理商品')}
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setRecordTarget(row);
                setRecordTab('join');
                loadRecords(row, 'join');
              }}
            >
              {t('参与记录')}
            </Button>
            {Number(row.status) !== 2 ? (
              <Button theme="borderless" type="danger" size="small" onClick={() => finishGroupon(row)}>
                {t('立即结束')}
              </Button>
            ) : (
              <Button theme="borderless" type="danger" size="small" onClick={() => deleteGroupon(row)}>
                {t('删除')}
              </Button>
            )}
          </Space>
        )}
        toolbarExtra={
          <Button theme="solid" type="primary" onClick={openCreate}>
            {t('添加拼团活动')}
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
        onSubmit={saveGroupon}
      />

      {/* 拼团商品管理 */}
      <Modal
        title={itemTarget ? `${t('管理商品')}：${itemTarget.name || ''}` : t('管理商品')}
        visible={Boolean(itemTarget) && !itemEditOpen}
        footer={null}
        onCancel={() => setItemTarget(null)}
        width={820}
      >
        <Spin spinning={itemLoading}>
          <Space style={{ marginBottom: 10 }}>
            <Button
              theme="solid"
              type="primary"
              disabled={Number(itemTarget?.status) === 2}
              onClick={() => itemTarget && openItemEdit(itemTarget)}
            >
              {t('添加拼团商品')}
            </Button>
            <Text type="tertiary" size="small">
              {t('活动结束后不可添加拼团商品')}
            </Text>
          </Space>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any) => String(record.itemId ?? record.grouponPromotionItemId ?? record.productId)}
            dataSource={itemRows}
            columns={[
              {
                title: t('商品名称'),
                dataIndex: 'productName',
                render: (v: any, r: any) => v || r.name || '-',
              },
              {
                title: t('拼团价'),
                dataIndex: 'grouponPrice',
                render: (v: any, r: any) =>
                  v ?? (r.minGroupPrice ? `¥${r.minGroupPrice} ~ ¥${r.maxGroupPrice}` : '-'),
              },
              {
                title: t('成团人数'),
                dataIndex: 'minGroupNum',
                render: (v: any, r: any) =>
                  v ?? (r.minGroupNum ? `${r.minGroupNum} ~ ${r.maxGroupNum}` : '-'),
              },
              { title: t('虚拟成团数'), dataIndex: 'virtualGroupCount', render: (v: any) => v ?? '-' },
              {
                title: t('操作'),
                width: 200,
                render: (_v: any, r: any) => (
                  <Space spacing={2}>
                    <Button theme="borderless" size="small" onClick={() => itemTarget && openItemEdit(itemTarget, r)}>
                      {t('编辑')}
                    </Button>
                    <Button theme="borderless" size="small" onClick={() => showPost(r)}>
                      {t('海报')}
                    </Button>
                    <Button
                      theme="borderless"
                      type="danger"
                      size="small"
                      onClick={() => {
                        Modal.confirm({
                          title: t('确认移除该拼团商品？'),
                          onOk: async () => {
                            try {
                              await apiPost('/promotion/groupon/item/del', {
                                id: r.itemId ?? r.grouponPromotionItemId,
                              });
                              Toast.success({ content: t('删除成功') });
                              if (itemTarget) loadItems(itemTarget);
                            } catch (error) {
                              Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
                            }
                          },
                        });
                      }}
                    >
                      {t('删除')}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
          {!itemRows.length && !itemLoading ? <Text type="tertiary">{t('暂无拼团商品')}</Text> : null}
        </Spin>
      </Modal>

      {/* 参与记录 */}
      <Modal
        title={recordTarget ? `${t('参与记录')}：${recordTarget.name || ''}` : t('参与记录')}
        visible={Boolean(recordTarget)}
        footer={null}
        onCancel={() => setRecordTarget(null)}
        width={860}
      >
        <Tabs
          type="card"
          activeKey={recordTab}
          onChange={(key: any) => {
            setRecordTab(String(key));
            if (recordTarget) loadRecords(recordTarget, key as string);
          }}
          tabList={[
            { itemKey: 'join', tab: t('进行中的团') },
            { itemKey: 'order', tab: t('订单记录') },
          ]}
          style={{ marginBottom: 8 }}
        />
        {recordTab === 'join' && (
          <Space style={{ marginBottom: 8 }}>
            <Button disabled={!selectedRecordIds.length} onClick={batchGroup}>
              {t('批量成团')}
            </Button>
            <Text type="tertiary" size="small">
              {t('对未满员且已到期的团可手动成团')}
            </Text>
          </Space>
        )}
        <Spin spinning={recordLoading}>
          {recordTab === 'join' ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(record: any, index?: number) => String(record.grouponPromotionRecordId ?? index)}
              dataSource={recordRows}
              rowSelection={{
                selectedRowKeys: selectedRecordIds,
                onChange: (keys) => setSelectedRecordIds((keys || []).map(Number)),
              }}
              columns={[
                {
                  title: t('开团时间'),
                  dataIndex: 'openGroupTime',
                  width: 170,
                  render: (v: any) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-'),
                },
                { title: t('商品名称'), dataIndex: 'productName' },
                { title: t('团长'), dataIndex: 'groupCaptainName', width: 120, render: (v: any) => v || '-' },
                {
                  title: t('团人数'),
                  dataIndex: 'minGroupNum',
                  width: 90,
                },
                {
                  title: t('状态'),
                  dataIndex: 'joinStatus',
                  width: 100,
                  render: (v: number) =>
                    Number(v) === 1 ? <Tag color="green">{t('已成团')}</Tag> : <Tag color="orange">{t('拼团中')}</Tag>,
                },
                {
                  title: t('操作'),
                  width: 160,
                  render: (_v: any, r: any) => (
                    <Space spacing={2}>
                      <Button theme="borderless" size="small" onClick={() => showMembers(r)}>
                        {t('查看团员')}
                      </Button>
                      <Button theme="borderless" size="small" onClick={() => manualGroup(r)}>
                        {t('手动成团')}
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey={(record: any, index?: number) => String(record.orderId ?? record.orderSn ?? index)}
              dataSource={recordRows}
              columns={[
                { title: t('订单号'), dataIndex: 'orderSn', render: (v: any) => <span className="mono">{v || '-'}</span> },
                { title: t('参团会员'), dataIndex: 'groupCaptainName', render: (v: any) => v || '-' },
                { title: t('参团方式'), dataIndex: 'joinTypeText', render: (v: any) => v || '-' },
                { title: t('状态'), dataIndex: 'statusText', render: (v: any) => v || '-' },
              ]}
            />
          )}
          {!recordRows.length && !recordLoading ? <Text type="tertiary">{t('暂无参与记录')}</Text> : null}
        </Spin>
      </Modal>

      {/* 团员列表 */}
      <Modal
        title={t('团成员')}
        visible={Boolean(memberTarget)}
        footer={null}
        onCancel={() => setMemberTarget(null)}
        width={560}
      >
        <Spin spinning={memberLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any, index?: number) => String(record.id ?? index)}
            dataSource={memberRows}
            columns={[
              { title: t('会员'), dataIndex: 'nickname', render: (v: any, r: any) => v || r.username || '-' },
              { title: t('是否团长'), dataIndex: 'isCaptain', width: 100, render: (v: any) => (Number(v) === 1 ? t('是') : t('否')) },
              { title: t('参团时间'), dataIndex: 'addTime', width: 170, render: (v: any) => v || '-' },
            ]}
          />
        </Spin>
      </Modal>

      {/* 推广海报 */}
      <Modal
        title={t('推广海报')}
        visible={Boolean(postTarget)}
        footer={null}
        onCancel={() => {
          setPostTarget(null);
          setPostInfo(null);
        }}
        width={520}
      >
        <Spin spinning={postLoading}>
          {postInfo ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {postInfo.promotionPicUrl ? (
                <img src={postInfo.promotionPicUrl} alt="" style={{ maxWidth: '100%', borderRadius: 6 }} />
              ) : null}
              <div>
                <Text type="tertiary">{t('小程序码')}</Text>
                {postInfo.miniCode ? (
                  <img src={postInfo.miniCode} alt="" style={{ width: 140, display: 'block' }} />
                ) : (
                  <span> --</span>
                )}
              </div>
              {postInfo.shortLink ? (
                <div>
                  <Text type="tertiary">{t('短链接')}</Text>
                  <div className="mono">{postInfo.shortLink}</div>
                </div>
              ) : null}
              {postInfo.promotionBrief ? (
                <div>
                  <Text type="tertiary">{t('活动简介')}</Text>
                  <div>{postInfo.promotionBrief}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Spin>
      </Modal>

      {/* 拼团商品添加/编辑 */}
      {itemTarget && (
        <GrouponItemEditDrawer
          visible={itemEditOpen}
          groupon={itemTarget}
          initial={itemEditInitial}
          saving={itemSaving}
          onCancel={() => {
            setItemEditOpen(false);
            setItemEditInitial(null);
          }}
          onSaved={() => {
            setItemEditOpen(false);
            setItemEditInitial(null);
            setItemSaving(false);
            if (itemTarget) loadItems(itemTarget);
          }}
          onSavingChange={setItemSaving}
        />
      )}
    </div>
  );
}

/* ============================== 拼团商品编辑 ============================== */

interface GrouponProductSku {
  skuId?: number;
  skuValue?: string;
  skuPrice?: number | string;
}

interface GrouponProduct {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  picUrl?: string;
  productPrice?: number | string;
  productSkus?: GrouponProductSku[];
  isAdded?: boolean;
  isOtherGrouponProduct?: boolean;
  isReservationProduct?: boolean;
  isPresaleProduct?: boolean;
  isSeckillProduct?: boolean;
  isTimeDiscountProduct?: boolean;
}

function GrouponItemEditDrawer({
  visible,
  groupon,
  initial,
  saving,
  onCancel,
  onSaved,
  onSavingChange,
}: {
  visible: boolean;
  groupon: GrouponRow;
  initial: Record<string, any> | null;
  saving: boolean;
  onCancel: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const { t } = useI18n();
  const groupType = Number(groupon.groupType ?? initial?.groupType ?? 1);
  // 成团人数阶梯（普通团 1 档；阶梯团可多档）
  const [groupNums, setGroupNums] = useState<Array<{ groupNumKey: number; groupNum: number }>>(
    initial?.groupNums?.length
      ? initial.groupNums.map((item: any, index: number) => ({
          groupNumKey: Number(item.groupNumKey ?? index),
          groupNum: Number(item.groupNum ?? 2),
        }))
      : [{ groupNumKey: 0, groupNum: 2 }],
  );
  const [keyword, setKeyword] = useState('');
  const [productRows, setProductRows] = useState<GrouponProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [product, setProduct] = useState<GrouponProduct | null>(initial?.product || null);
  /** SKU 明细：skuId → {isJoin, limitNum, prices: Record<groupNumKey, price>} */
  const [details, setDetails] = useState<Record<number, { isJoin: number; limitNum: number; prices: Record<number, string> }>>(
    () => {
      const map: Record<number, { isJoin: number; limitNum: number; prices: Record<number, string> }> = {};
      const skuList = initial?.product?.productSkus || initial?.productSkus || [];
      const detailList = initial?.grouponPromotionDetails || initial?.details || [];
      skuList.forEach((sku: any) => {
        const skuId = Number(sku.skuId);
        const matched = detailList.find((d: any) => Number(d.skuId) === skuId);
        const prices: Record<number, string> = {};
        (matched?.groupPromotionDetailPrices || []).forEach((price: any) => {
          prices[Number(price.groupNumKey ?? 0)] = String(price.price ?? '');
        });
        map[skuId] = {
          isJoin: Number(matched?.isJoin ?? 1),
          limitNum: Number(matched?.limitNum ?? sku.skuStock ?? 0),
          prices,
        };
      });
      return map;
    },
  );
  const [orderLimitNum, setOrderLimitNum] = useState<number>(Number(initial?.orderLimitNum ?? 0));
  const [isAutoGroup, setIsAutoGroup] = useState<number>(Number(initial?.isAutoGroup ?? 0));
  const [virtualGroupCount, setVirtualGroupCount] = useState<number>(Number(initial?.virtualGroupCount ?? 0));
  const [sort, setSort] = useState<number>(Number(initial?.sort ?? 0));

  const isEdit = Boolean(initial?.itemId ?? initial?.grouponPromotionItemId);

  const searchProducts = async () => {
    setProductLoading(true);
    try {
      const result = await apiGet<any>('/promotion/groupon/item/productList', {
        keyword: keyword.trim() || undefined,
        grouponPromotionId: groupon.grouponPromotionId,
        page: 1,
        size: 10,
      });
      setProductRows(result?.records || result?.list || []);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('商品加载失败') });
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    if (visible && !initial?.product) searchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const productFlags = (product: GrouponProduct | null) => {
    if (!product) return [];
    const flags: string[] = [];
    if (product.isOtherGrouponProduct) flags.push(t('已参加其它拼团'));
    if (product.isReservationProduct) flags.push(t('预约商品'));
    if (product.isPresaleProduct) flags.push(t('预售商品'));
    if (product.isSeckillProduct) flags.push(t('正在秒杀'));
    if (product.isTimeDiscountProduct) flags.push(t('正在限时折扣'));
    return flags;
  };

  const submit = async () => {
    if (!product?.productId) {
      Toast.warning({ content: t('请选择商品') });
      return;
    }
    const skuList = product.productSkus || [];
    const activeDetails = skuList.filter((sku) => {
      const state = details[Number(sku.skuId)];
      return state && state.isJoin === 1;
    });
    if (skuList.length > 0 && activeDetails.length === 0) {
      Toast.warning({ content: t('请至少选择一个参加拼团的规格') });
      return;
    }
    if (groupNums.some((item) => item.groupNum < 2)) {
      Toast.warning({ content: t('成团人数不能小于2') });
      return;
    }
    const minGroupNum = Math.min(...groupNums.map((item) => item.groupNum));
    onSavingChange(true);
    try {
      const payload = {
        grouponPromotionItemId: initial?.itemId ?? initial?.grouponPromotionItemId,
        grouponPromotionId: groupon.grouponPromotionId,
        productId: product.productId,
        groupType,
        orderLimitNum,
        isAutoGroup,
        minGroupNum,
        minGroupPrice: null,
        sort,
        groupNums: groupNums.map((item, index) => ({ groupNumKey: index, groupNum: item.groupNum })),
        grouponPromotionDetails: activeDetails.map((sku) => {
          const skuId = Number(sku.skuId);
          const state = details[skuId];
          return {
            grouponDetailId: undefined,
            productId: product.productId,
            skuId,
            limitNum: state.limitNum,
            isJoin: 1,
            groupPromotionDetailPrices: groupNums.map((tier, index) => ({
              groupNumKey: index,
              price: Number(state.prices[index] ?? sku.skuPrice ?? 0),
            })),
          };
        }),
      };
      const itemId = initial?.itemId ?? initial?.grouponPromotionItemId;
      await apiPost(itemId ? '/promotion/groupon/item/update' : '/promotion/groupon/item/create', payload);
      Toast.success({ content: itemId ? t('更新成功') : t('创建成功') });
      onSaved();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
      onSavingChange(false);
    }
  };

  return (
    <Modal
      title={isEdit ? t('编辑拼团商品') : t('添加拼团商品')}
      visible={visible}
      onCancel={onCancel}
      onOk={submit}
      okButtonProps={{ loading: saving }}
      okText={t('保存')}
      cancelText={t('取消')}
      width={860}
    >
      <div className="groupon-item-form">
        {/* 商品选择 */}
        {!initial?.product && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('选择商品')}</div>
            <Space style={{ marginBottom: 8 }}>
              <Input
                style={{ width: 240 }}
                placeholder={t('搜索商品名称 / 编号')}
                value={keyword}
                showClear
                onClear={() => setKeyword('')}
                onChange={setKeyword}
                onEnterPress={searchProducts}
              />
              <Button theme="solid" type="primary" onClick={searchProducts}>
                {t('搜索')}
              </Button>
            </Space>
            <Table
              loading={productLoading}
              dataSource={productRows}
              rowKey={(record?: GrouponProduct) => String(record?.productId ?? Math.random())}
              pagination={false}
              onRow={(record?: GrouponProduct) => ({ onClick: () => record && setProduct(record) })}
              rowClassName={(record?: GrouponProduct) =>
                Number(product?.productId) === Number(record?.productId) ? 'groupon-product-row is-active' : 'groupon-product-row'
              }
              columns={[
                {
                  title: t('商品'),
                  dataIndex: 'product',
                  render: (_v: unknown, record: GrouponProduct) => (
                    <div className="product-picker-info">
                      {record.picThumb || record.picUrl ? (
                        <img src={record.picThumb || record.picUrl} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                      ) : null}
                      <div>
                        <div>{record.productName}</div>
                        <Text type="tertiary" size="small">{record.productSn || ''}</Text>
                      </div>
                    </div>
                  ),
                },
                {
                  title: t('状态'),
                  dataIndex: 'flags',
                  width: 240,
                  render: (_v: unknown, record: GrouponProduct) => {
                    const flags = productFlags(record);
                    return (
                      <Space wrap spacing={4}>
                        {record.isAdded ? <Tag color="green">{t('已加入')}</Tag> : null}
                        {flags.map((flag) => (
                          <Tag key={flag} color="orange">
                            {flag}
                          </Tag>
                        ))}
                      </Space>
                    );
                  },
                },
              ] as any}
            />
          </div>
        )}

        {product && (
          <>
            <div style={{ fontWeight: 500, margin: '8px 0' }}>
              {product.productName}
              {productFlags(product).map((flag) => (
                <Tag key={flag} color="orange" style={{ marginLeft: 8 }}>
                  {flag}
                </Tag>
              ))}
            </div>

            {/* 成团人数设置 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>{t('成团人数设置')}</div>
              {groupNums.map((tier, index) => (
                <Space key={index} style={{ marginBottom: 6 }}>
                  <span>{t('成团人数')}</span>
                  <InputNumber
                    style={{ width: 110 }}
                    min={2}
                    precision={0}
                    value={tier.groupNum}
                    onChange={(next) =>
                      setGroupNums((current) =>
                        current.map((item, i) => (i === index ? { ...item, groupNum: Number(next ?? 2) } : item)),
                      )
                    }
                  />
                  {groupType === 2 && groupNums.length > 1 && (
                    <Button
                      theme="borderless"
                      type="danger"
                      size="small"
                      onClick={() => setGroupNums((current) => current.filter((_, i) => i !== index))}
                    >
                      {t('删除')}
                    </Button>
                  )}
                </Space>
              ))}
              {groupType === 2 && (
                <Button
                  size="small"
                  onClick={() =>
                    setGroupNums((current) => [
                      ...current,
                      { groupNumKey: current.length, groupNum: (current[current.length - 1]?.groupNum ?? 2) + 1 },
                    ])
                  }
                >
                  {t('添加阶梯人数')}
                </Button>
              )}
            </div>

            {/* SKU 明细与拼团价 */}
            <div>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>{t('规格与拼团价')}</div>
              <Table
                size="small"
                pagination={false}
                rowKey="skuId"
                dataSource={product.productSkus || []}
                columns={[
                  {
                    title: t('参加'),
                    dataIndex: 'isJoin',
                    width: 70,
                    render: (_v: unknown, record: GrouponProductSku) => (
                      <Checkbox
                        checked={details[Number(record.skuId)]?.isJoin === 1}
                        onChange={(event) =>
                          setDetails((current) => ({
                            ...current,
                            [Number(record.skuId)]: {
                              ...current[Number(record.skuId)],
                              isJoin: event.target.checked ? 1 : 0,
                              limitNum: current[Number(record.skuId)]?.limitNum ?? Number(record.skuPrice ? 999 : 0),
                              prices: current[Number(record.skuId)]?.prices ?? {},
                            },
                          }))
                        }
                      />
                    ),
                  },
                  { title: t('规格'), dataIndex: 'skuValue', render: (v: string) => v || t('默认规格') },
                  {
                    title: t('原价'),
                    dataIndex: 'skuPrice',
                    width: 100,
                    render: (v: unknown) => `¥ ${Number(v || 0).toFixed(2)}`,
                  },
                  ...groupNums.map((tier, index) => ({
                    title: groupType === 2 ? `${t('拼团价')}（${tier.groupNum}${t('人团')}）` : t('拼团价'),
                    dataIndex: `price-${index}`,
                    width: 150,
                    render: (_v: unknown, record: GrouponProductSku) => (
                      <InputNumber
                        style={{ width: 120 }}
                        min={0}
                        precision={2}
                        value={Number(details[Number(record.skuId)]?.prices?.[index] ?? '') || undefined}
                        onChange={(next) =>
                          setDetails((current) => ({
                            ...current,
                            [Number(record.skuId)]: {
                              isJoin: current[Number(record.skuId)]?.isJoin ?? 1,
                              limitNum: current[Number(record.skuId)]?.limitNum ?? 999,
                              prices: {
                                ...(current[Number(record.skuId)]?.prices || {}),
                                [index]: String(next ?? ''),
                              },
                            },
                          }))
                        }
                      />
                    ),
                  })),
                  {
                    title: t('可售数量'),
                    dataIndex: 'limitNum',
                    width: 130,
                    render: (_v: unknown, record: GrouponProductSku) => (
                      <InputNumber
                        style={{ width: 110 }}
                        min={0}
                        precision={0}
                        value={details[Number(record.skuId)]?.limitNum ?? 999}
                        onChange={(next) =>
                          setDetails((current) => ({
                            ...current,
                            [Number(record.skuId)]: {
                              isJoin: current[Number(record.skuId)]?.isJoin ?? 1,
                              limitNum: Number(next ?? 999),
                              prices: current[Number(record.skuId)]?.prices ?? {},
                            },
                          }))
                        }
                      />
                    ),
                  },
                ] as any}
              />
            </div>

            <Space wrap style={{ marginTop: 14 }}>
              <span>{t('每单限购数量')}</span>
              <InputNumber
                style={{ width: 110 }}
                min={0}
                precision={0}
                value={orderLimitNum}
                onChange={(next) => setOrderLimitNum(Number(next ?? 0))}
              />
              <Text type="tertiary" size="small">{t('0 为不限购')}</Text>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Checkbox checked={isAutoGroup === 1} onChange={(event) => setIsAutoGroup(event.target.checked ? 1 : 0)}>
                {t('是否自动成团（虚拟成团）')}
              </Checkbox>
              {isAutoGroup === 1 && (
                <Space style={{ marginLeft: 12 }}>
                  <span>{t('虚拟成团数')}</span>
                  <InputNumber
                    style={{ width: 110 }}
                    min={0}
                    precision={0}
                    value={virtualGroupCount}
                    onChange={(next) => setVirtualGroupCount(Number(next ?? 0))}
                  />
                </Space>
              )}
            </div>
            <Space wrap style={{ marginTop: 8 }}>
              <span>{t('排序')}</span>
              <InputNumber
                style={{ width: 110 }}
                precision={0}
                value={sort}
                onChange={(next) => setSort(Number(next ?? 0))}
              />
            </Space>
          </>
        )}
      </div>
    </Modal>
  );
}

// Radio/RadioGroup/Select 引用保留（活动表单类型扩展用）
void Radio;
void RadioGroup;
void Select;
