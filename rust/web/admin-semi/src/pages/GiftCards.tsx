import { useEffect, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

/**
 * 礼品卡（giftCardManage）—— 对齐旧版 promotion/giftCard：
 * - 顶部「储值卡 / 兑换卡」双入口（groupType 1/2，储值卡仅平台侧可见）；
 * - 编辑表单按 groupType 分流：储值卡有面额，兑换卡需绑定适用商品；
 * - 查看卡列表（giftCards/list）、删除；
 * 契约：rust gift_card_groups.rs / gift_card.rs（GiftCardGroupsCreateParam 等，校验文案在后端）。
 */

interface GiftCardProductDTO {
  productId: number;
}

interface GroupRow {
  cardGroupsId: number;
  groupType: number; // 1 储值卡 2 兑换卡
  cardType: number; // 1 电子卡 2 实体卡
  cardGroupName: string;
  imageUrl: string;
  validityType: number; // 1 永久 2 天数 3 固定时间
  validityDays?: number;
  expireTime?: string;
  faceAmount?: string;
  status: number;
  addTime: string;
  groupTypeName: string;
  cardTypeName?: string;
  validityTypeName?: string;
  remark: string;
  giftCardProducts?: Array<{ productId: number; productName?: string; productImg?: string }>;
  canDelete?: boolean;
}

interface GroupForm {
  cardType: number;
  cardGroupName: string;
  imageUrl: string;
  faceAmount: number | undefined;
  validityType: number;
  validityDays: number | undefined;
  expireTime: string;
  status: number;
  productIds: string[];
  remark: string;
  canDelete?: boolean;
}

const CARD_DEFAULT_BG = 'https://oss.tigshop.com/img/gallery/202511/1763106657gduKxujm9Fx7WZNjJZ.jpeg';

const groupLabel = (t: (k: string) => string, groupType: number) => (groupType === 1 ? t('储值卡') : t('兑换卡'));

const numOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

/* ------------------------------ 卡组编辑弹窗 ------------------------------ */

function GroupEditModal({
  visible,
  groupType,
  row,
  onClose,
  onSaved,
}: {
  visible: boolean;
  groupType: number;
  row: GroupRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isTopUp = groupType === 1;
  const label = groupLabel(t, groupType);
  const [form, setForm] = useState<GroupForm>({
    cardType: 1,
    cardGroupName: '',
    imageUrl: CARD_DEFAULT_BG,
    faceAmount: undefined,
    validityType: 1,
    validityDays: undefined,
    expireTime: '',
    status: 1,
    productIds: [],
    remark: '',
  });
  const [productOptions, setProductOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (row) {
      setForm({
        cardType: row.cardType || 1,
        cardGroupName: row.cardGroupName || '',
        imageUrl: row.imageUrl || CARD_DEFAULT_BG,
        faceAmount: row.faceAmount ? Number(row.faceAmount) : undefined,
        validityType: row.validityType || 1,
        validityDays: row.validityDays || undefined,
        expireTime: row.expireTime || '',
        status: row.status ?? 1,
        productIds: (row.giftCardProducts || []).map((p) => String(p.productId)),
        remark: row.remark || '',
        canDelete: row.canDelete,
      });
    } else {
      setForm({
        cardType: 1,
        cardGroupName: '',
        imageUrl: CARD_DEFAULT_BG,
        faceAmount: undefined,
        validityType: 1,
        validityDays: undefined,
        expireTime: '',
        status: 1,
        productIds: [],
        remark: '',
      });
    }
    // 商品选项（兑换卡绑定用）
    apiGet<{ records: any[] }>('/product/product/list', { page: 1, size: 100 })
      .then((res) =>
        setProductOptions(
          (res.records || []).map((p) => ({
            value: String(p.productId ?? p.id),
            label: p.name ?? p.goodsName ?? `#${p.productId ?? p.id}`,
          })),
        ),
      )
      .catch(() => setProductOptions([]));
  }, [visible, row]);

  const submit = async () => {
    if (!form.cardGroupName.trim()) {
      Toast.warning({ content: t('请输入{name}名称', { name: label }) });
      return;
    }
    if (isTopUp && (!form.faceAmount || form.faceAmount <= 0)) {
      Toast.warning({ content: t('请输入储值卡面额') });
      return;
    }
    if (form.validityType === 2 && (!form.validityDays || form.validityDays <= 0)) {
      Toast.warning({ content: t('请输入有效天数') });
      return;
    }
    if (form.validityType === 3 && !form.expireTime) {
      Toast.warning({ content: t('请选择截止时间') });
      return;
    }
    if (!isTopUp && form.productIds.length === 0) {
      Toast.warning({ content: t('请选择适用商品') });
      return;
    }
    setSaving(true);
    try {
      const products: GiftCardProductDTO[] = form.productIds.map((id) => ({ productId: Number(id) }));
      if (row) {
        await apiPost('/promotion/giftCardGroups/update', {
          cardGroupsId: row.cardGroupsId,
          cardGroupName: form.cardGroupName.trim(),
          imageUrl: form.imageUrl,
          validityType: form.validityType,
          validityDays: form.validityType === 2 ? form.validityDays : undefined,
          expireTime: form.validityType === 3 ? form.expireTime : undefined,
          faceAmount: isTopUp ? form.faceAmount : undefined,
          remark: form.remark,
          giftCardProducts: isTopUp ? undefined : products,
        });
      } else {
        await apiPost('/promotion/giftCardGroups/create', {
          groupType,
          cardType: form.cardType,
          cardGroupName: form.cardGroupName.trim(),
          imageUrl: form.imageUrl,
          validityType: form.validityType,
          validityDays: form.validityType === 2 ? form.validityDays : undefined,
          expireTime: form.validityType === 3 ? form.expireTime : undefined,
          faceAmount: isTopUp ? form.faceAmount : undefined,
          status: form.status,
          remark: form.remark,
          giftCardProducts: isTopUp ? undefined : products,
        });
      }
      Toast.success({ content: t('保存成功') });
      onSaved();
      onClose();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${row ? t('编辑') : t('添加')}${label}`}
      visible={visible}
      onOk={submit}
      onCancel={onClose}
      width={560}
      okText={t('提交')}
      okButtonProps={{ loading: saving }}
      cancelText={t('取消')}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {!row && (
          <div style={{ display: 'grid', gap: 4 }}>
            <span>{label}{t('类型')}</span>
            <RadioGroup value={form.cardType} onChange={(e) => setForm({ ...form, cardType: Number(e.target.value) })}>
              <Space>
                <Radio value={1}>{t('电子卡')}</Radio>
                <Radio value={2}>{t('实体卡')}</Radio>
              </Space>
            </RadioGroup>
            <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>
              {form.cardType === 1
                ? t('虚拟卡号，无实体卡片；购买后可在订单详情查看卡号及卡密')
                : t('快递发货实物卡片；收货后刮开图层查看卡密进行兑换')}
            </span>
          </div>
        )}
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{label}{t('名称')}</span>
          <Input style={{ width: 300 }} value={form.cardGroupName} maxLength={50} onChange={(v) => setForm({ ...form, cardGroupName: v })} placeholder={t('请输入{name}名称', { name: label })} />
        </label>
        <div style={{ display: 'grid', gap: 4 }}>
          <span>{label}{t('图片')}</span>
          <ImageUploader single max={1} value={form.imageUrl ? [form.imageUrl] : []} onChange={(next) => setForm({ ...form, imageUrl: next[0] ?? '' })} />
        </div>
        {isTopUp && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>{t('储值卡面额')}</span>
            <Space>
              <InputNumber style={{ width: 200 }} min={0.01} precision={2} value={form.faceAmount} onChange={(v) => setForm({ ...form, faceAmount: numOrNull(v) })} placeholder={t('请输入金额')} />
              <span>{t('元')}</span>
            </Space>
            <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('此金额代表可兑换至余额中的金额')}</span>
          </label>
        )}
        <div style={{ display: 'grid', gap: 4 }}>
          <span>{t('有效期')}</span>
          <RadioGroup
            value={form.validityType}
            onChange={(e) => {
              const v = Number(e.target.value);
              setForm({ ...form, validityType: v, validityDays: v === 2 && !form.validityDays ? 30 : form.validityDays });
            }}
          >
            <Space spacing={16}>
              <Radio value={1}>{t('永久有效')}</Radio>
              {form.cardType !== 2 && <Radio value={2}>{t('天数')}</Radio>}
              <Radio value={3}>{t('固定时间')}</Radio>
            </Space>
          </RadioGroup>
          {form.validityType === 2 && form.cardType !== 2 && (
            <Space>
              <span>{t('购买后立即生效，')}</span>
              <InputNumber style={{ width: 120 }} min={1} precision={0} value={form.validityDays} onChange={(v) => setForm({ ...form, validityDays: numOrNull(v) })} />
              <span>{t('天有效')}</span>
            </Space>
          )}
          {form.validityType === 3 && (
            <Space>
              <span>{t('购买后立即生效，使用时间截止为')}</span>
              <Input style={{ width: 200 }} value={form.expireTime} placeholder="YYYY-MM-DD HH:mm:ss" onChange={(v) => setForm({ ...form, expireTime: v })} />
            </Space>
          )}
        </div>
        {!row && (
          <div style={{ display: 'grid', gap: 4 }}>
            <span>{label}{t('状态')}</span>
            <Switch checked={form.status === 1} onChange={(v) => setForm({ ...form, status: v ? 1 : 0 })} />
            <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('禁用后此卡项，不可出售')}</span>
          </div>
        )}
        {!isTopUp && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>{t('适用商品')}</span>
            <Select
              style={{ width: '100%' }}
              multiple
              filter
              placeholder={t('请选择适用商品')}
              optionList={productOptions}
              value={form.productIds}
              onChange={(v) => setForm({ ...form, productIds: (v as string[]).map(String) })}
            />
          </label>
        )}
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('备注')}</span>
          <TextArea rows={3} value={form.remark} onChange={(v: string) => setForm({ ...form, remark: v })} />
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------ 查看卡列表弹窗 ------------------------------ */

function CardListModal({ visible, row, onClose }: { visible: boolean; row: GroupRow | null; onClose: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const load = (targetPage = 1) => {
    if (!row) return;
    setLoading(true);
    apiGet<{ records: any[]; total: number }>('/promotion/giftCards/list', {
      cardGroupsId: row.cardGroupsId,
      page: targetPage,
      size: 10,
      keyword: keyword || undefined,
    })
      .then((res) => {
        setRows(res.records || []);
        setTotal(res.total || 0);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible && row) {
      setPage(1);
      setKeyword('');
      load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, row]);

  const statusText = (r: any) => {
    if (Number(r.isExchange) === 1) return { text: t('已兑换'), color: 'grey' };
    if (Number(r.isSold) === 1) return { text: t('已售出'), color: 'green' };
    return { text: t('未售出'), color: 'blue' };
  };

  return (
    <Modal title={`${t('查看卡列表')} — ${row?.cardGroupName ?? ''}`} visible={visible} onCancel={onClose} footer={null} width={820}>
      <Space style={{ marginBottom: 12 }}>
        <Input style={{ width: 220 }} value={keyword} onChange={setKeyword} placeholder={t('卡号')} />
        <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey="giftCardsId"
        pagination={{ currentPage: page, pageSize: 10, total, onPageChange: (p) => { setPage(p); load(p); } }}
        empty={<Empty description={t('暂无数据')} />}
        columns={[
          { title: t('卡号'), dataIndex: 'cardNumber', width: 170 },
          { title: t('卡密'), dataIndex: 'cardPassword', width: 140 },
          {
            title: t('状态'),
            width: 100,
            render: (_: any, r: any) => {
              const s = statusText(r);
              return <Tag color={s.color as any}>{s.text}</Tag>;
            },
          },
          { title: t('兑换商品'), render: (_: any, r: any) => ((r.giftCardProducts || []).map((p: any) => p.productName).join('、') || '-') },
        ] as ColumnProps<any>[]}
      />
    </Modal>
  );
}

/* ---------------------------------- 列表页 ---------------------------------- */

export default function GiftCards() {
  const { t } = useI18n();
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [edit, setEdit] = useState<{ open: boolean; groupType: number; row: GroupRow | null }>({ open: false, groupType: 2, row: null });
  const [cardListTarget, setCardListTarget] = useState<GroupRow | null>(null);
  const isAdmin = localStorage.getItem('adminType') === 'admin';

  const load = (targetPage = page) => {
    setLoading(true);
    apiGet<{ records: GroupRow[]; total: number }>('/promotion/giftCardGroups/list', {
      page: targetPage,
      size: 15,
      keyword: keyword || undefined,
    })
      .then((res) => {
        setRows(res.records || []);
        setTotal(res.total || 0);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (row: GroupRow, checked: boolean) => {
    try {
      await apiPost('/promotion/giftCardGroups/update', { cardGroupsId: row.cardGroupsId, status: checked ? 1 : 0 });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('操作失败') });
      load();
    }
  };

  const deleteGroup = async (row: GroupRow) => {
    try {
      await apiPost('/promotion/giftCardGroups/delete', { giftCardGroupsId: row.cardGroupsId });
      Toast.success({ content: t('删除成功') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
    }
  };

  const columns: ColumnProps<GroupRow>[] = [
    { title: t('礼品卡名称'), dataIndex: 'cardGroupName', width: 180 },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 90,
      render: (_: any, row: GroupRow) => (
        <Switch checked={row.status === 1} disabled={row.canDelete === false} onChange={(v) => toggleStatus(row, v)} />
      ),
    },
    { title: t('备注'), dataIndex: 'remark', width: 200, render: (v: string) => v || '-' },
    { title: t('卡类型'), dataIndex: 'groupTypeName', width: 100, render: (v: string) => <Tag color={'blue' as const}>{v || '-'}</Tag> },
    { title: t('创建时间'), dataIndex: 'addTime', width: 170 },
    {
      title: t('操作'),
      width: 260,
      render: (_: any, row: GroupRow) => (
        <Space>
          <Button theme="borderless" type="primary" onClick={() => setCardListTarget(row)}>{t('查看卡列表')}</Button>
          <Button theme="borderless" type="primary" onClick={() => setEdit({ open: true, groupType: row.groupType, row })}>{t('编辑')}</Button>
          {(row.canDelete !== false || row.groupType === 2) && (
            <Popconfirm title={t('确认删除该{name}？', { name: groupLabel(t, row.groupType) })} onConfirm={() => deleteGroup(row)}>
              <Button theme="borderless" type="danger" disabled={row.canDelete === false}>{t('删除')}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <p style={{ fontWeight: 500, marginBottom: 8 }}>{t('按使用场景快速创建')}</p>
      <Space style={{ marginBottom: 20 }} wrap>
        {isAdmin && (
          <div style={{ minWidth: 200, padding: '14px 18px', background: 'var(--semi-color-fill-0)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t('储值卡')}</div>
            <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('例：储值卡购买可进行兑换')}<br />{t('金额直接充入账户余额中')}</div>
            <Button type="primary" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ open: true, groupType: 1, row: null })}>{t('立即创建')}</Button>
          </div>
        )}
        <div style={{ minWidth: 200, padding: '14px 18px', background: 'var(--semi-color-fill-0)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{t('兑换卡')}</div>
          <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('例：可兑换该卡绑定的商品')}<br />{t('增强品牌与营销效果')}</div>
          <Button type="primary" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ open: true, groupType: 2, row: null })}>{t('立即创建')}</Button>
        </div>
      </Space>
      <Space style={{ marginBottom: 16 }}>
        <Input style={{ width: 240 }} value={keyword} onChange={setKeyword} placeholder={t('输入礼品卡名称')} />
        <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey="cardGroupsId"
        columns={columns}
        empty={<Empty description={t('暂无数据')} />}
        pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
      />
      <GroupEditModal
        visible={edit.open}
        groupType={edit.groupType}
        row={edit.row}
        onClose={() => setEdit({ open: false, groupType: 2, row: null })}
        onSaved={() => load()}
      />
      <CardListModal visible={!!cardListTarget} row={cardListTarget} onClose={() => setCardListTarget(null)} />
    </div>
  );
}
