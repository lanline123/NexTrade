import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  CheckboxGroup,
  Descriptions,
  Input,
  InputNumber,
  Modal,
  Select,
  SideSheet,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import type { MemberRow } from '../types';

const { Text } = Typography;

interface DrawerProps {
  visible: boolean;
  member: MemberRow | null;
  onCancel: () => void;
}

export function MemberDetailDrawer({
  visible,
  member,
  onCancel,
  onEdit,
  onFund,
}: DrawerProps & { onEdit?: () => void; onFund?: () => void }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [tags, setTags] = useState<Array<Record<string, any>>>([]);

  useEffect(() => {
    if (!visible || !member) return;
    let alive = true;
    apiGet<Record<string, any>>('/user/user/detail', { id: member.userId })
      .then((result) => alive && setDetail(result))
      .catch(() => alive && setDetail(null));
    apiGet<Array<Record<string, any>>>('/user/userMemberTag/listByUser', { userId: member.userId })
      .then((result) => alive && setTags(result || []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible, member]);

  const data: Record<string, any> = detail || (member as Record<string, any>) || {};
  const address = data.userAddress || {};

  return (
    <SideSheet
      title={t('客户详情')}
      visible={visible}
      onCancel={onCancel}
      width={800}
      placement="right"
      bodyStyle={{ padding: '16px 24px', overflowY: 'auto' }}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('关闭')}</Button>
          {onEdit && <Button onClick={onEdit}>{t('编辑客户')}</Button>}
          {onFund && (
            <Button theme="solid" type="primary" onClick={onFund}>
              {t('资金管理')}
            </Button>
          )}
        </Space>
      }
    >
      <div className="member-detail-head">
        <Avatar src={data.avatar} size="large" color="blue">
          {(data.username || 'U').slice(0, 1)}
        </Avatar>
        <div>
          <div className="member-detail-name">{data.nickname || data.username || '-'}</div>
          <Text type="tertiary">{data.rankName || t('普通会员')}</Text>
        </div>
        <div className="member-detail-tags">
          {tags.length ? (
            tags.map((tag) => (
              <Tag key={tag.tagId} color="blue">
                {tag.tagName}
              </Tag>
            ))
          ) : (
            <Text type="tertiary" size="small">
              {t('暂无标签')}
            </Text>
          )}
        </div>
      </div>

      <div className="member-detail-metrics">
        <div>
          <span>{t('可用余额')}</span>
          <b>¥ {data.balance ?? '0.00'}</b>
        </div>
        <div>
          <span>{t('冻结资金')}</span>
          <b>¥ {data.frozenBalance ?? '0.00'}</b>
        </div>
        <div>
          <span>{t('消费积分')}</span>
          <b>{data.points ?? 0}</b>
        </div>
        <div>
          <span>{t('累计消费')}</span>
          <b>¥ {data.orderAmount ?? '0.00'}</b>
        </div>
      </div>

      <div className="detail-section-title">{t('基本信息')}</div>
      <Descriptions
        column={3}
        layout="horizontal"
        align="plain"
        data={[
          { key: t('客户名称'), value: data.username || '-' },
          { key: t('昵称'), value: data.nickname || '-' },
          { key: t('手机号'), value: data.mobile || '-' },
          { key: t('邮箱'), value: data.email || '-' },
          { key: t('客户等级'), value: data.rankName || '-' },
          { key: t('注册时间'), value: data.regTime || '-' },
          { key: t('生日'), value: data.birthday || '-' },
          { key: t('是否认证'), value: data.isCompanyAuth ? t('已认证') : t('未认证') },
          { key: t('状态'), value: data.status === 1 ? t('启用') : t('禁用') },
        ]}
      />

      <div className="detail-section-title">{t('资金信息')}</div>
      <Descriptions
        column={3}
        layout="horizontal"
        align="plain"
        data={[
          { key: t('可用资金'), value: `¥ ${data.balance ?? '0.00'}` },
          { key: t('冻结资金'), value: `¥ ${data.frozenBalance ?? '0.00'}` },
          { key: t('消费积分'), value: data.points ?? 0 },
          { key: t('成长积分'), value: data.growthPoints ?? 0 },
          { key: t('累计消费'), value: `¥ ${data.orderAmount ?? '0.00'}` },
          { key: t('订单数'), value: data.orderCount ?? 0 },
        ]}
      />

      <div className="detail-section-title">{t('收货信息')}</div>
      <Descriptions
        column={2}
        layout="horizontal"
        align="plain"
        data={[
          { key: t('收货人'), value: address.consignee || '-' },
          { key: t('联系电话'), value: address.mobile || '-' },
          { key: t('所在地区'), value: (address.regionNames || []).join(' ') || '-' },
          { key: t('详细地址'), value: address.address || '-' },
        ]}
      />
    </SideSheet>
  );
}

export function MemberAccountDrawer({
  visible,
  member,
  onCancel,
  onFund,
}: DrawerProps & { onFund?: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fromTag, setFromTag] = useState('1');

  useEffect(() => {
    if (!visible || !member) return;
    let alive = true;
    apiGet<{ records: Array<Record<string, any>>; total: number }>('/user/user/userFundDetail', {
      userId: member.userId,
      fromTag,
      page,
      size: 10,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible, member, page, fromTag]);

  return (
    <SideSheet
      title={t('{name} 的账目明细', { name: member?.username || '' })}
      visible={visible}
      onCancel={onCancel}
      width={800}
      placement="right"
      bodyStyle={{ padding: '16px 24px', overflowY: 'auto' }}
    >
      <Space style={{ marginBottom: 12 }}>
        <Select
          value={fromTag}
          onChange={(value) => {
            setFromTag(String(value));
            setPage(1);
          }}
          optionList={[
            { label: t('可用资金账户'), value: '1' },
            { label: t('冻结资金账户'), value: '2' },
            { label: t('成长积分账户'), value: '3' },
            { label: t('消费积分账户'), value: '4' },
          ]}
          style={{ width: 160 }}
        />
        {onFund && (
          <Button theme="solid" type="primary" onClick={onFund}>
            {t('调节客户账户')}
          </Button>
        )}
      </Space>
      <Table
        dataSource={rows}
        rowKey={(record: any) => String(record.logId ?? record.id ?? record.changeTime)}
        pagination={{ currentPage: page, pageSize: 10, total, onChange: setPage }}
        columns={[
          { title: t('变动时间'), dataIndex: 'changeTime', width: 170 },
          { title: t('变动原因'), dataIndex: 'changeDesc' },
          { title: t('可用资金'), dataIndex: 'balance', width: 110 },
          { title: t('冻结资金'), dataIndex: 'frozenBalance', width: 110 },
          { title: t('积分'), dataIndex: 'points', width: 90 },
        ]}
      />
    </SideSheet>
  );
}

export function MemberOrdersDrawer({ visible, member, onCancel }: DrawerProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!visible || !member) return;
    let alive = true;
    apiGet<{ records: Array<Record<string, any>>; total: number }>('/order/order/list', {
      userId: member.userId,
      page,
      size: 10,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible, member, page]);

  return (
    <SideSheet
      title={t('{name} 的订单', { name: member?.username || '' })}
      visible={visible}
      onCancel={onCancel}
      width={1200}
      placement="right"
      bodyStyle={{ padding: '16px 24px', overflowY: 'auto' }}
    >
      <Table
        dataSource={rows}
        rowKey={(record: any) => String(record.orderId)}
        pagination={{ currentPage: page, pageSize: 10, total, onChange: setPage }}
        columns={[
          { title: t('订单号'), dataIndex: 'orderSn' },
          { title: t('收货人'), dataIndex: 'consignee' },
          { title: t('订单金额'), dataIndex: 'totalAmount', width: 130 },
          { title: t('支付状态'), dataIndex: 'payStatusName', width: 110, render: (value: string) => (value ? t(value) : '-') },
          { title: t('订单状态'), dataIndex: 'orderStatusName', width: 120, render: (value: string) => (value ? t(value) : '-') },
          { title: t('下单时间'), dataIndex: 'addTime', width: 170 },
        ]}
      />
    </SideSheet>
  );
}

export function MemberTagsDrawer({
  visible,
  member,
  onCancel,
  onSaved,
}: DrawerProps & { onSaved: () => void }) {
  const { t } = useI18n();
  const [allTags, setAllTags] = useState<Array<Record<string, any>>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !member) return;
    let alive = true;
    Promise.all([
      apiGet<Array<Record<string, any>>>('/user/userMemberTag/listByUser', { userId: member.userId }),
      apiGet<any>('/user/memberTagGroup/list', { page: 1, size: 100 }),
    ])
      .then(async ([userTags, groupsResult]) => {
        if (!alive) return;
        const groups = Array.isArray(groupsResult)
          ? groupsResult
          : groupsResult?.records || groupsResult?.list || [];
        const tagGroups = await Promise.all(
          groups.map((group: Record<string, any>) =>
            apiGet<Array<Record<string, any>>>('/user/memberTag/listByGroup', {
              groupId: group.groupId,
            })
              .then((tags) => tags || [])
              .catch(() => []),
          ),
        );
        if (!alive) return;
        setAllTags(tagGroups.flat());
        setSelected((userTags || []).map((tag) => Number(tag.tagId)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [visible, member]);

  const save = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const current = selected;
      const before = new Set<number>();
      const userTags = await apiGet<Array<Record<string, any>>>('/user/userMemberTag/listByUser', {
        userId: member.userId,
      });
      (userTags || []).forEach((tag) => before.add(Number(tag.tagId)));
      const added = current.filter((id) => !before.has(id));
      const removed = [...before].filter((id) => !current.includes(id));
      if (added.length) {
        await apiPost('/user/userMemberTag/bindTags', { userId: member.userId, tagIds: added });
      }
      if (removed.length) {
        await apiPost('/user/userMemberTag/unbindTags', { userId: member.userId, tagIds: removed });
      }
      Toast.success({ content: t('标签已更新') });
      onSaved();
      onCancel();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存标签失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideSheet
      title={t('{name} 的标签', { name: member?.username || '' })}
      visible={visible}
      onCancel={onCancel}
      width={560}
      placement="right"
      bodyStyle={{ padding: '16px 24px', overflowY: 'auto' }}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={save}>
            {t('保存')}
          </Button>
        </Space>
      }
    >
      {allTags.length ? (
        <CheckboxGroup
          value={selected}
          onChange={(value) => setSelected((value as number[]).map(Number))}
          options={allTags.map((tag) => ({
            label: tag.tagName,
            value: Number(tag.tagId),
          }))}
          direction="vertical"
        />
      ) : (
        <Typography.Text type="tertiary">
          {t('暂无可用标签，请先在「客户标签」中创建标签组和标签。')}
        </Typography.Text>
      )}
    </SideSheet>
  );
}

export function MemberFundModal({
  visible,
  member,
  onCancel,
  onSuccess,
}: DrawerProps & { onSuccess: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [form, setForm] = useState({
    typeBalance: 1,
    balance: 0,
    typeFrozenBalance: 1,
    frozenBalance: 0,
    typePoints: 1,
    points: 0,
    typeGrowthPoints: 1,
    growthPoints: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason('');
      setForm({
        typeBalance: 1,
        balance: 0,
        typeFrozenBalance: 1,
        frozenBalance: 0,
        typePoints: 1,
        points: 0,
        typeGrowthPoints: 1,
        growthPoints: 0,
      });
    }
  }, [visible]);

  const submit = async () => {
    if (!member) return;
    if (!reason.trim()) {
      Toast.warning({ content: t('请填写资金变动说明') });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = { id: member.userId, changeDesc: reason.trim() };
      if (Number(form.balance) > 0) {
        payload.typeBalance = form.typeBalance;
        payload.balance = form.balance;
      }
      if (Number(form.frozenBalance) > 0) {
        payload.typeFrozenBalance = form.typeFrozenBalance;
        payload.frozenBalance = form.frozenBalance;
      }
      if (Number(form.points) > 0) {
        payload.typePoints = form.typePoints;
        payload.points = form.points;
      }
      if (Number(form.growthPoints) > 0) {
        payload.typeGrowthPoints = form.typeGrowthPoints;
        payload.growthPoints = form.growthPoints;
      }
      await apiPost('/user/user/fundManagement', payload);
      Toast.success({ content: t('账户已调整') });
      onSuccess();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('账户调整失败') });
    } finally {
      setSaving(false);
    }
  };

  const rows: Array<{ label: string; amountKey: keyof typeof form; typeKey: keyof typeof form }> = [
    { label: '可用余额', amountKey: 'balance', typeKey: 'typeBalance' },
    { label: '冻结资金', amountKey: 'frozenBalance', typeKey: 'typeFrozenBalance' },
    { label: '消费积分', amountKey: 'points', typeKey: 'typePoints' },
    { label: '成长积分', amountKey: 'growthPoints', typeKey: 'typeGrowthPoints' },
  ];

  return (
    <Modal
      title={t('资金管理')}
      visible={visible}
      onCancel={onCancel}
      width={560}
      footer={
        <Space>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={saving} onClick={submit}>
            {t('确认调整')}
          </Button>
        </Space>
      }
    >
      <div className="member-fund-form">
        <label>{t('变动说明')}</label>
        <Input value={reason} onChange={setReason} placeholder={t('请输入资金变动说明')} />
        {rows.map((row) => (
          <div className="member-fund-row" key={row.label}>
            <span>{t(row.label)}</span>
            <Select
              value={form[row.typeKey]}
              onChange={(value) => setForm({ ...form, [row.typeKey]: Number(value) })}
              optionList={[
                { label: t('增加'), value: 1 },
                { label: t('减少'), value: 2 },
              ]}
              style={{ width: 100 }}
            />
            <InputNumber
              value={form[row.amountKey]}
              min={0}
              precision={row.label.includes('积分') ? 0 : 2}
              onChange={(value) => setForm({ ...form, [row.amountKey]: Number(value) })}
              style={{ width: 200 }}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
