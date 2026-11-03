import { useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
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

/** 拼团活动：对应旧版 promotion/groupon/List.vue + Info.vue（核心流程）。
 * 旧版已注释未启用的能力(此处记录):状态页签"我创建的/下级创建"、列表列"截止日期/活动归属"。 */
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
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
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

  const loadRecords = async (row: GrouponRow) => {
    setRecordLoading(true);
    try {
      const result = await apiGet<any>('/promotion/groupon/record/openJoinList', {
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
          { field: 'name', label: t('活动名称'), type: 'input', required: true, placeholder: t('请输入活动名称') },
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
                loadRecords(row);
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

      <Modal
        title={itemTarget ? `${t('管理商品')}：${itemTarget.name || ''}` : t('管理商品')}
        visible={Boolean(itemTarget)}
        footer={null}
        onCancel={() => setItemTarget(null)}
        width={760}
      >
        <Spin spinning={itemLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any) => String(record.itemId ?? record.productId)}
            dataSource={itemRows}
            columns={[
              { title: t('商品名称'), dataIndex: 'productName', render: (v: any, r: any) => v || r.name || '-' },
              { title: t('拼团价'), dataIndex: 'grouponPrice', render: (v: any) => v ?? '-' },
              { title: t('虚拟成团数'), dataIndex: 'virtualGroupCount', render: (v: any) => v ?? '-' },
            ]}
          />
          {!itemRows.length && !itemLoading ? <Text type="tertiary">{t('暂无拼团商品，请在商品管理中添加')}</Text> : null}
        </Spin>
      </Modal>

      <Modal
        title={recordTarget ? `${t('参与记录')}：${recordTarget.name || ''}` : t('参与记录')}
        visible={Boolean(recordTarget)}
        footer={null}
        onCancel={() => setRecordTarget(null)}
        width={820}
      >
        <Spin spinning={recordLoading}>
          <Table
            size="small"
            pagination={false}
            rowKey={(record: any, index?: number) => String(record.recordId ?? record.orderId ?? index)}
            dataSource={recordRows}
            columns={[
              { title: t('订单号'), dataIndex: 'orderSn', render: (v: any, r: any) => v || r.orderSn || '-' },
              { title: t('参团会员'), dataIndex: 'nickname', render: (v: any, r: any) => v || r.username || '-' },
              { title: t('开团时间'), dataIndex: 'createTime', render: (v: any, r: any) => v || r.addTime || '-' },
              {
                title: t('状态'),
                dataIndex: 'statusText',
                render: (v: any, r: any) => v || r.statusText || r.statusName || '-',
              },
            ]}
          />
          {!recordRows.length && !recordLoading ? <Text type="tertiary">{t('暂无参与记录')}</Text> : null}
        </Spin>
      </Modal>
    </div>
  );
}
