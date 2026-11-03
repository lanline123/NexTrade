import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Dropdown,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import TagFilter from '../framework/TagFilter';
import type { ColumnConfig } from '../framework/types';
import type { MemberRow } from '../types';
import {
  MemberAccountDrawer,
  MemberDetailDrawer,
  MemberFundModal,
  MemberOrdersDrawer,
  MemberTagsDrawer,
} from '../components/MemberDrawers';

const { Text } = Typography;

type MemberAction = 'detail' | 'tags' | 'orders' | 'account' | null;

function MemberStatusSwitch({ record }: { record: MemberRow }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(record.status === 1);

  const toggle = async (next: boolean) => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    try {
      await apiPost('/user/user/updateField', {
        id: record.userId,
        field: 'status',
        val: next ? 1 : 0,
      });
      setChecked(next);
      Toast.success({ content: next ? t('已启用') : t('已禁用') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  return <Switch checked={checked} onChange={toggle} size="small" />;
}

const buildColumns = (
  t: (key: string, params?: Record<string, string | number>) => string,
): ColumnConfig<MemberRow>[] => [
  {
    title: '客户',
    dataIndex: 'username',
    width: 250,
    render: (value: string, record) => (
      <div className="member-cell">
        {record.avatar ? (
          <Avatar src={record.avatar} size="small" />
        ) : (
          <Avatar color="blue" size="small">
            {(value || 'U').slice(0, 1).toUpperCase()}
          </Avatar>
        )}
        <div>
          <div className="member-name-line">
            <span>{record.nickname || value}</span>
            {record.mark ? <Tag color="red" size="small">{t('标记')}</Tag> : null}
          </div>
          <Text type="tertiary" size="small">
            {record.mobile || `ID ${record.userId}`}
          </Text>
          {record.fromTagName && (
            <div>
              <Tag color="blue" size="small">
                {record.fromTagName}
              </Tag>
            </div>
          )}
        </div>
      </div>
    ),
  },
  {
    title: '等级 / 是否认证',
    dataIndex: 'rankName',
    width: 150,
    render: (value: string, record) => (
      <div className="member-rank-cell">
        <Tag color="blue">{value || t('普通会员')}</Tag>
        <Text type={record.isCompanyAuth ? 'success' : 'tertiary'} size="small">
          {record.isCompanyAuth ? t('已认证') : t('未认证')}
        </Text>
      </div>
    ),
  },
  {
    title: '资产',
    dataIndex: 'balance',
    width: 170,
    render: (value: string, record) => (
      <div className="member-asset-cell">
        <div className="money">¥ {Number(value || 0).toLocaleString()}</div>
        {Number(record.frozenBalance || 0) > 0 && (
          <Text type="tertiary" size="small">
            {t('冻结 ¥ {amount}', { amount: Number(record.frozenBalance) || 0 })}
          </Text>
        )}
        <Text type="tertiary" size="small">
          {t('消费积分 {points}', { points: record.points ?? 0 })}
        </Text>
      </div>
    ),
  },
  {
    title: '累计消费次数 / 累计消费金额',
    dataIndex: 'orderAmount',
    width: 270,
    render: (value: string, record) => (
      <div className="member-asset-cell">
        <div className="money">¥ {Number(value || 0).toLocaleString()}</div>
        <Text type="tertiary" size="small">
          {t('{count} 笔', { count: record.orderCount ?? 0 })}
        </Text>
      </div>
    ),
  },
  { title: '注册日期', dataIndex: 'regTime', width: 160 },
  {
    title: '是否启用',
    dataIndex: 'status',
    width: 80,
    render: (_: unknown, record: MemberRow) => <MemberStatusSwitch record={record} />,
  },
];

function BatchMemberModal({
  visible,
  type,
  ids,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  type: 'rank' | 'points' | 'balance' | null;
  ids: number[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState<number | string>(0);
  const [rankId, setRankId] = useState<number | undefined>(undefined);
  const [ranks, setRanks] = useState<Array<{ rankId: number; rankName: string }>>([]);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!visible || type !== 'rank' || ranks.length) return;
    apiGet<Array<{ rankId: number; rankName: string }>>('/user/userRank/list', { size: 200 })
      .then((result) => setRanks(Array.isArray(result) ? result : []))
      .catch(() => undefined);
  }, [visible, type, ranks.length]);

  const title =
    type === 'rank'
      ? t('批量修改客户等级')
      : type === 'points'
        ? t('批量增加客户积分')
        : t('批量增加客户余额');

  const submit = async () => {
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持操作') });
      return;
    }
    if (type === 'rank' && !rankId) {
      Toast.warning({ content: t('请选择客户等级') });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        ids,
        type: type === 'rank' ? 'setRank' : type === 'points' ? 'incrPoints' : 'incrBalance',
      };
      if (type === 'rank') body.rankId = rankId;
      if (type === 'points') body.value = Number(value);
      if (type === 'balance') body.balance = Number(value);
      await apiPost('/user/user/batch', body);
      Toast.success({ content: t('批量操作成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量操作失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={onCancel}
      width={480}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('确认')}
          </Button>
        </Space>
      }
    >
      <div className="batch-member-form">
        <div>{t('已选择 {count} 位客户', { count: ids.length })}</div>
        {type === 'rank' && (
          <Select
            placeholder={t('请选择客户等级')}
            value={rankId}
            onChange={(next) => setRankId(Number(next))}
            optionList={ranks.map((rank) => ({ label: rank.rankName, value: rank.rankId }))}
            style={{ width: 260, marginTop: 12 }}
          />
        )}
        {type === 'points' && (
          <InputNumber
            value={value}
            min={1}
            precision={0}
            onChange={(next) => setValue(next as number)}
            style={{ width: 260, marginTop: 12 }}
          />
        )}
        {type === 'balance' && (
          <InputNumber
            value={value}
            min={0.01}
            precision={2}
            onChange={(next) => setValue(next as number)}
            style={{ width: 260, marginTop: 12 }}
          />
        )}
      </div>
    </Modal>
  );
}

function BatchTagModal({
  visible,
  userIds,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  userIds: number[];
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [tagIds, setTagIds] = useState<Array<string | number>>([]);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  const submit = async () => {
    if (!tagIds.length) {
      Toast.warning({ content: t('请选择标签') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/user/userMemberTag/batchBindTags', {
        userIds,
        tagIds: tagIds.map(Number),
      });
      Toast.success({ content: t('批量打标签成功') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量打标签失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('批量打标签')}
      visible={visible}
      onCancel={onCancel}
      width={520}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('确认')}
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 8 }}>{t('已选择 {count} 位客户', { count: userIds.length })}</div>
      <TagFilter value={tagIds} onChange={setTagIds} width={360} />
    </Modal>
  );
}

export default function Members() {
  const { t } = useI18n();
  const [activeMember, setActiveMember] = useState<MemberRow | null>(null);
  const [action, setAction] = useState<MemberAction>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [batchType, setBatchType] = useState<'rank' | 'points' | 'balance' | null>(null);
  const [batchIds, setBatchIds] = useState<number[]>([]);
  const [batchClear, setBatchClear] = useState<(() => void) | null>(null);
  const [summary, setSummary] = useState({ total: 0, enabled: 0, certified: 0 });
  const [editRequest, setEditRequest] = useState<MemberRow | null>(null);
  const [fundMember, setFundMember] = useState<MemberRow | null>(null);
  const [batchTagVisible, setBatchTagVisible] = useState(false);
  const [batchTagIds, setBatchTagIds] = useState<number[]>([]);

  const startBatch = (type: 'rank' | 'points' | 'balance', rows: MemberRow[], clear: () => void) => {
    setBatchType(type);
    setBatchIds(rows.map((row) => row.userId));
    setBatchClear(() => clear);
  };

  const closeBatch = () => {
    setBatchType(null);
    setBatchIds([]);
  };

  const open = (next: MemberAction, record: MemberRow) => {
    setActiveMember(record);
    setAction(next);
  };

  const close = () => {
    setAction(null);
    setActiveMember(null);
  };

  return (
    <>
      <div className="member-overview">
        <div className="member-overview-item">
          <span>{t('客户总数')}</span>
          <b>{summary.total}</b>
        </div>
        <div className="member-overview-item">
          <span>{t('当前页启用')}</span>
          <b>{summary.enabled}</b>
        </div>
        <div className="member-overview-item">
          <span>{t('当前页企业认证')}</span>
          <b>{summary.certified}</b>
        </div>
      </div>

      <ListPage<MemberRow>
        key={reloadKey}
        api="/user/user/list"
        rowKey="userId"
        pageSize={10}
        showEdit={false}
        actionWidth={250}
        selectable
        filterLayout="popover"
        onDataLoaded={({ total, rows }) =>
          setSummary({
            total,
            enabled: rows.filter((row) => row.status === 1).length,
            certified: rows.filter((row) => row.isCompanyAuth === 1).length,
          })
        }
        editRequest={editRequest}
        onEditRequestHandled={() => setEditRequest(null)}
        batchActions={(rows, clear) => (
          <Space>
            <Button
              size="small"
              onClick={() => {
                setBatchTagIds(rows.map((row) => row.userId));
                setBatchTagVisible(true);
              }}
            >
              {t('批量打标签')}
            </Button>
            <Button size="small" onClick={() => startBatch('rank', rows, clear)}>
              {t('批量改等级')}
            </Button>
            <Button size="small" onClick={() => startBatch('points', rows, clear)}>
              {t('批量加积分')}
            </Button>
            <Button size="small" onClick={() => startBatch('balance', rows, clear)}>
              {t('批量加余额')}
            </Button>
          </Space>
        )}
        filters={[
          {
            field: 'keyword',
            label: '客户信息',
            type: 'input',
            placeholder: '客户名称 / 手机号 / 邮箱',
            width: 260,
          },
          {
            field: 'fromTag',
            label: '客户筛选',
            type: 'select',
            width: 140,
            options: [
              { label: '微信公众号', value: 1 },
              { label: '微信小程序', value: 2 },
              { label: 'H5', value: 3 },
              { label: 'PC', value: 4 },
              { label: 'APP', value: 5 },
            ],
          },
          {
            field: 'balance',
            label: '余额大于',
            type: 'number',
            width: 130,
          },
          {
            field: 'pointsGt',
            label: '积分大于',
            type: 'number',
            width: 130,
          },
          {
            field: 'pointsLt',
            label: '积分小于',
            type: 'number',
            width: 130,
          },
          {
            field: 'tagIds',
            label: '客户标签',
            type: 'tags',
            width: 240,
          },
        ]}
        columns={buildColumns(t)}
        rowActions={(record) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => open('detail', record)}>
              {t('查看')}
            </Button>
            <Dropdown
              trigger="click"
              position="bottomRight"
              menu={[
                { node: 'item', name: t('标签'), onClick: () => open('tags', record) },
                { node: 'item', name: t('查看订单'), onClick: () => open('orders', record) },
                { node: 'item', name: t('账目明细'), onClick: () => open('account', record) },
              ]}
            >
              <Button theme="borderless" size="small">
                {t('更多')}
              </Button>
            </Dropdown>
          </Space>
        )}
        drawer={{
          title: '客户',
          addText: '添加客户',
          width: 560,
          labelWidth: 'auto',
          inputWidth: 420,
          createApi: '/user/user/create',
          updateApi: '/user/user/update',
          idField: 'userId',
          sections: [
            {
              key: 'basic',
              title: '客户信息',
              fields: [
                {
                  field: 'username',
                  label: t('客户名称'),
                  required: true,
                  placeholder: t('请输入客户名称'),
                  visibleWhen: (mode) => mode === 'create',
                },
                { field: 'mobile', label: t('手机号码'), placeholder: t('请输入手机号码') },
                { field: 'email', label: t('邮箱地址'), placeholder: t('请输入邮箱地址') },
                {
                  field: 'password',
                  label: t('新密码'),
                  placeholder: t('新增时必填，编辑留空不修改'),
                  requiredWhen: (mode) => mode === 'create',
                },
                {
                  field: 'pwdConfirm',
                  label: t('确认密码'),
                  placeholder: t('请再次输入密码'),
                  requiredWhen: (mode) => mode === 'create',
                },
                {
                  field: 'rankId',
                  label: t('客户等级'),
                  type: 'select',
                  placeholder: t('请选择客户等级'),
                  optionsApi: '/user/userRank/list',
                  optionsParams: { size: 200 },
                  optionLabel: 'rankName',
                  optionValue: 'rankId',
                },
              ],
            },
          ],
        }}
      />

      <MemberDetailDrawer
        visible={action === 'detail'}
        member={activeMember}
        onCancel={close}
        onEdit={() => {
          setEditRequest(activeMember);
          close();
        }}
        onFund={() => setFundMember(activeMember)}
      />
      <MemberTagsDrawer
        visible={action === 'tags'}
        member={activeMember}
        onCancel={close}
        onSaved={() => setReloadKey((key) => key + 1)}
      />
      <MemberOrdersDrawer visible={action === 'orders'} member={activeMember} onCancel={close} />
      <MemberAccountDrawer
        visible={action === 'account'}
        member={activeMember}
        onCancel={close}
        onFund={() => setFundMember(activeMember)}
      />

      <MemberFundModal
        visible={fundMember !== null}
        member={fundMember}
        onCancel={() => setFundMember(null)}
        onSuccess={() => {
          setFundMember(null);
          setReloadKey((key) => key + 1);
        }}
      />

      <BatchTagModal
        visible={batchTagVisible}
        userIds={batchTagIds}
        onCancel={() => setBatchTagVisible(false)}
        onSuccess={() => {
          setBatchTagVisible(false);
          setBatchTagIds([]);
          setReloadKey((key) => key + 1);
        }}
      />

      <BatchMemberModal
        visible={batchType !== null}
        type={batchType}
        ids={batchIds}
        onCancel={closeBatch}
        onSuccess={() => {
          batchClear?.();
          closeBatch();
          setReloadKey((key) => key + 1);
        }}
      />
    </>
  );
}