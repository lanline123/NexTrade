import { useEffect, useMemo, useState } from 'react';
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
  Table,
  Tag,
  TextArea,
  Toast,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';
import type { ColumnProps } from '@douyinfe/semi-ui/lib/es/table';

/**
 * 抽奖活动（lotteryManage）—— 对齐旧版 promotion/lottery：
 * - 三步表单（创建活动 → 奖项设置 → 页面装修）+ 右侧九宫格预览（旧 Info.vue）；
 * - 奖品 ≤7（积分/商品/优惠券），未中奖配置，8 位置转盘 + 概率（第 8 格固定谢谢参与）；
 * - 用户管理 / 中奖记录（userManage / userRecord）；
 * 契约：rust lottery_activity.rs（LotteryActivityParam / LotteryActivityVO，文案逐字校验在后端）。
 */

/* ---------------------------------- 类型 ---------------------------------- */

interface PrizeItem {
  /** 已有奖品 id（编辑时后端返回） */
  prizeId?: number;
  /** 新增奖品的临时序号（与 gridConfig.tempIndex 对应） */
  tempIndex?: number;
  prizeName: string;
  prizeType: number; // 1 积分 2 商品 3 优惠券
  prizeValue: string;
  prizeImage: string;
  prizeStock: number;
  prizeStockUsed?: number;
}

interface GridRow {
  position: number;
  /** 奖品池 key：已有奖品 `p{id}`，新增奖品 `t{tempIndex}`；空 = 未中奖 */
  prizeKey: string;
  probability: number;
}

interface DecorateConfig {
  bgImage: string;
  bgColor: string;
  prizeEntryImage: string;
  showWinnerList: number;
  activityRules: string;
}

interface LotteryForm {
  activityName: string;
  startTime: string;
  endTime: string;
  winLimitType: number; // 0 无限制 / 1 限次数
  winLimit: number | undefined;
  drawLimitType: number; // 0 无限制 / 1 限次数
  dailyLimit: number | undefined;
  totalLimit: number | undefined;
  isConsumePoints: number; // 对应后端 costType
  costPoints: number | undefined;
  prizeList: PrizeItem[];
  gridConfig: GridRow[];
  noWinName: string;
  noWinImage: string;
  noWinTips: string;
  decorateConfig: DecorateConfig;
}

const DEFAULT_BG = 'https://oss.tigshop.com/img/gallery/202512/1766469537jXrMsUPDXoszzk0KCC.jpeg';
const DEFAULT_ENTRY = 'https://oss.tigshop.com/img/gallery/202601/1769405706W6G6mAb5dVkUxQIN7g.jpeg';
const DEFAULT_NO_WIN_IMAGE = 'https://oss.tigshop.com/img/gallery/202512/1766467150H93CwsgU07PQfSqwj4.jpeg';

const initialForm = (): LotteryForm => ({
  activityName: '',
  startTime: '',
  endTime: '',
  winLimitType: 0,
  winLimit: undefined,
  drawLimitType: 0,
  dailyLimit: undefined,
  totalLimit: undefined,
  isConsumePoints: 1,
  costPoints: undefined,
  prizeList: [],
  gridConfig: Array.from({ length: 8 }, (_, i) => ({ position: i + 1, prizeKey: '', probability: 12.5 })),
  noWinName: '谢谢参与',
  noWinImage: DEFAULT_NO_WIN_IMAGE,
  noWinTips: '很遗憾没有抽中',
  decorateConfig: { bgImage: DEFAULT_BG, bgColor: '', prizeEntryImage: DEFAULT_ENTRY, showWinnerList: 1, activityRules: '' },
});

const PRIZE_TYPE_NAME: Record<number, string> = { 1: '积分', 2: '商品', 3: '优惠券' };

/** Semi InputNumber onChange 可能回传 string，统一转 `number | undefined`。 */
const numOrNull = (v: unknown): number | undefined =>
  v === '' || v === null || v === undefined ? undefined : Number(v);

const nowText = () => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const daysLaterText = (days: number) => {
  const d = new Date(Date.now() + (days * 24 + 8) * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/* ------------------------------- 奖品编辑弹窗 ------------------------------- */

function PrizeEditModal({
  visible,
  initial,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial: PrizeItem | null;
  onClose: () => void;
  onSaved: (prize: PrizeItem) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PrizeItem>(initial ?? { prizeName: '', prizeType: 1, prizeValue: '', prizeImage: '', prizeStock: 100 });
  const [productOptions, setProductOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [couponOptions, setCouponOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    if (visible) {
      setDraft(
        initial ?? { prizeName: '', prizeType: 1, prizeValue: '', prizeImage: '', prizeStock: 100 },
      );
    }
  }, [visible, initial]);

  // 商品/优惠券选择项（编辑回显 + 下拉搜索）
  useEffect(() => {
    if (!visible) return;
    if (draft.prizeType === 2) {
      apiGet<{ records: any[] }>('/product/product/list', { page: 1, size: 50 })
        .then((res) =>
          setProductOptions(
            (res.records || []).map((p) => ({ value: String(p.productId ?? p.id), label: p.name ?? p.goodsName ?? `#${p.productId ?? p.id}` })),
          ),
        )
        .catch(() => setProductOptions([]));
    }
    if (draft.prizeType === 3) {
      apiGet<{ records?: any[] } | any[]>('/promotion/coupon/validList', {})
        .then((res) => {
          const rows = Array.isArray(res) ? res : res.records || [];
          setCouponOptions(rows.map((c: any) => ({ value: String(c.couponId ?? c.id), label: c.couponName ?? c.name ?? `#${c.couponId ?? c.id}` })));
        })
        .catch(() => setCouponOptions([]));
    }
  }, [visible, draft.prizeType]);

  const confirm = () => {
    if (!draft.prizeName.trim()) {
      Toast.warning({ content: t('请输入奖品名称') });
      return;
    }
    if (draft.prizeType !== 1 && !String(draft.prizeValue)) {
      Toast.warning({ content: t('请选择奖品对应内容') });
      return;
    }
    if (draft.prizeType === 1 && (!Number(draft.prizeValue) || Number(draft.prizeValue) <= 0)) {
      Toast.warning({ content: t('请输入积分数量') });
      return;
    }
    if (!draft.prizeImage) {
      Toast.warning({ content: t('请上传奖品图片') });
      return;
    }
    if (draft.prizeStock === undefined || draft.prizeStock === null || draft.prizeStock < 0) {
      Toast.warning({ content: t('请输入奖品库存') });
      return;
    }
    onSaved({ ...draft, prizeName: draft.prizeName.trim() });
  };

  return (
    <Modal title={initial ? t('编辑奖品') : t('添加奖品')} visible={visible} onOk={confirm} onCancel={onClose} width={520} okText={t('确定')} cancelText={t('取消')}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('奖品名称')}</span>
          <Input value={draft.prizeName} maxLength={30} onChange={(v) => setDraft({ ...draft, prizeName: v })} placeholder={t('请输入奖品名称')} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('奖品类型')}</span>
          <RadioGroup value={draft.prizeType} onChange={(e) => setDraft({ ...draft, prizeType: Number(e.target.value), prizeValue: '' })}>
            <Radio value={1}>{t('积分')}</Radio>
            <Radio value={2}>{t('商品')}</Radio>
            <Radio value={3}>{t('优惠券')}</Radio>
          </RadioGroup>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{draft.prizeType === 1 ? t('积分数量') : draft.prizeType === 2 ? t('选择商品') : t('选择优惠券')}</span>
          {draft.prizeType === 1 && (
            <InputNumber style={{ width: 200 }} min={1} value={draft.prizeValue ? Number(draft.prizeValue) : undefined} onChange={(v) => setDraft({ ...draft, prizeValue: String(v ?? '') })} />
          )}
          {draft.prizeType === 2 && (
            <Select
              style={{ width: '100%' }}
              showClear
              filter
              placeholder={t('请选择商品')}
              optionList={productOptions}
              value={draft.prizeValue || undefined}
              onChange={(v) => setDraft({ ...draft, prizeValue: String(v ?? '') })}
            />
          )}
          {draft.prizeType === 3 && (
            <Select
              style={{ width: '100%' }}
              showClear
              filter
              placeholder={t('请选择优惠券')}
              optionList={couponOptions}
              value={draft.prizeValue || undefined}
              onChange={(v) => setDraft({ ...draft, prizeValue: String(v ?? '') })}
            />
          )}
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('奖品图片')}</span>
          <ImageUploader single max={1} value={draft.prizeImage ? [draft.prizeImage] : []} onChange={(next) => setDraft({ ...draft, prizeImage: next[0] ?? '' })} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('奖品库存')}</span>
          <InputNumber style={{ width: 200 }} min={0} precision={0} value={draft.prizeStock} onChange={(v) => setDraft({ ...draft, prizeStock: Number(v ?? 0) })} />
        </label>
      </div>
    </Modal>
  );
}

/* ------------------------------- 编辑主弹窗（三步） ------------------------------ */

function LotteryEditModal({
  visible,
  activityId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  activityId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LotteryForm>(initialForm());
  const [saving, setSaving] = useState(false);
  const [prizeModal, setPrizeModal] = useState<{ open: boolean; index: number }>({ open: false, index: -1 });

  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setForm(initialForm());
    if (activityId > 0) {
      apiGet<any>('/promotion/lotteryActivity/detail', { id: activityId })
        .then((vo) => {
          const prizes: PrizeItem[] = (vo.prizeList || []).map((p: any) => ({
            prizeId: p.prizeId,
            prizeName: p.prizeName ?? '',
            prizeType: p.prizeType ?? 1,
            prizeValue: String(p.prizeValue ?? ''),
            prizeImage: p.prizeImage ?? '',
            prizeStock: p.prizeStock ?? 0,
            prizeStockUsed: p.prizeStockUsed ?? 0,
          }));
          const prizeById = new Map(prizes.filter((p) => p.prizeId).map((p) => [`p${p.prizeId}`, p]));
          const grid: GridRow[] = Array.from({ length: 8 }, (_, i) => {
            const row = (vo.gridConfig || []).find((g: any) => Number(g.position) === i + 1);
            return {
              position: i + 1,
              prizeKey: row?.prizeId && prizeById.has(`p${row.prizeId}`) ? `p${row.prizeId}` : '',
              probability: Number(row?.probability ?? 12.5),
            };
          });
          const dc = vo.decorateConfig || {};
          setForm({
            activityName: vo.activityName ?? '',
            startTime: vo.startTime ?? '',
            endTime: vo.endTime ?? '',
            winLimitType: Number(vo.winLimit) > 0 ? 1 : 0,
            winLimit: Number(vo.winLimit) > 0 ? Number(vo.winLimit) : undefined,
            drawLimitType: Number(vo.dailyLimit) > 0 || Number(vo.totalLimit) > 0 ? 1 : 0,
            dailyLimit: Number(vo.dailyLimit) > 0 ? Number(vo.dailyLimit) : undefined,
            totalLimit: Number(vo.totalLimit) > 0 ? Number(vo.totalLimit) : undefined,
            isConsumePoints: Number(vo.costType) === 1 ? 1 : 0,
            costPoints: Number(vo.costPoints) > 0 ? Number(vo.costPoints) : undefined,
            prizeList: prizes,
            gridConfig: grid,
            noWinName: vo.noWinName || '谢谢参与',
            noWinImage: vo.noWinImage || DEFAULT_NO_WIN_IMAGE,
            noWinTips: vo.noWinTips || '很遗憾没有抽中',
            decorateConfig: {
              bgImage: dc.bgImage || DEFAULT_BG,
              bgColor: dc.bgColor || '',
              prizeEntryImage: dc.prizeEntryImage || DEFAULT_ENTRY,
              showWinnerList: Number(dc.showWinnerList ?? 1),
              activityRules: dc.activityRules ?? '',
            },
          });
        })
        .catch((e) => Toast.error({ content: e.message }));
    }
  }, [visible, activityId]);

  const prizeKeyLabel = (key: string) => {
    if (!key) return form.noWinName || t('未中奖');
    const prize = form.prizeList.find((p) => (p.prizeId ? `p${p.prizeId}` : `t${p.tempIndex}`) === key);
    return prize?.prizeName || '-';
  };
  const prizeKeyImage = (key: string) => {
    if (!key) return form.noWinImage;
    return form.prizeList.find((p) => (p.prizeId ? `p${p.prizeId}` : `t${p.tempIndex}`) === key)?.prizeImage || form.noWinImage;
  };

  /** 逐步校验（文案对齐旧版 / Rust 校验语义） */
  const validateStep = (current: number): string | null => {
    if (current === 0) {
      if (!form.activityName.trim()) return t('请输入活动名称');
      if (!form.startTime || !form.endTime) return t('请输入活动时间');
      if (form.endTime <= form.startTime) return t('活动结束时间必须大于开始时间');
      if (form.winLimitType === 1 && (!form.winLimit || form.winLimit <= 0)) return t('请输入中奖次数，且必须大于0');
      if (form.drawLimitType === 1) {
        if (!form.dailyLimit || form.dailyLimit <= 0) return t('请输入每日最大抽奖次数');
        if (!form.totalLimit || form.totalLimit <= 0) return t('请输入活动最大抽奖次数');
        if (Number(form.dailyLimit) > Number(form.totalLimit)) return t('每日最大抽奖次数不能大于活动最大抽奖次数');
      }
      if (form.isConsumePoints === 1 && (!form.costPoints || form.costPoints <= 0)) return t('每次抽奖消耗积分必须大于0');
    }
    if (current === 1) {
      if (!form.prizeList.length) return t('奖品列表不能为空');
      if (form.prizeList.length > 7) return t('奖品数量不能超过7个');
      if (!form.noWinName.trim()) return t('未中奖名称不能为空');
      if (!form.noWinImage.startsWith('http')) return t('未中奖图片URL格式不正确');
      const prizeCount = form.gridConfig.filter((g) => g.prizeKey).length;
      if (prizeCount === 0) return t('九宫格至少需要配置一个奖品位置');
      const total = form.gridConfig.filter((g) => g.prizeKey).reduce((sum, g) => sum + Number(g.probability || 0), 0);
      if (form.gridConfig.some((g) => g.prizeKey && (!g.probability || g.probability <= 0))) return t('有奖品的位置概率必须大于0');
      if (form.gridConfig.some((g) => g.prizeKey && g.probability > 100)) return t('单个奖品概率不能超过100%');
      if (total >= 100) return t('奖品概率总和必须小于100%，剩余概率为未中奖概率');
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      Toast.warning({ content: err });
      return;
    }
    setStep(step + 1);
  };

  const submit = async () => {
    for (const s of [0, 1]) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        Toast.warning({ content: err });
        return;
      }
    }
    setSaving(true);
    try {
      const param = {
        activityId: activityId > 0 ? activityId : undefined,
        activityName: form.activityName.trim(),
        startTime: form.startTime,
        endTime: form.endTime,
        costType: form.isConsumePoints,
        costPoints: form.isConsumePoints === 1 ? Number(form.costPoints) : 0,
        dailyLimit: form.drawLimitType === 1 ? Number(form.dailyLimit) : 0,
        totalLimit: form.drawLimitType === 1 ? Number(form.totalLimit) : 0,
        winLimit: form.winLimitType === 1 ? Number(form.winLimit) : 0,
        prizeList: form.prizeList.map((p, index) => ({
          prizeId: p.prizeId,
          tempIndex: p.prizeId ? undefined : index,
          prizeName: p.prizeName,
          prizeType: p.prizeType,
          prizeValue: p.prizeValue,
          prizeImage: p.prizeImage,
          prizeStock: Number(p.prizeStock),
        })),
        gridConfig: form.gridConfig.map((g) => {
          const prize = form.prizeList.find((p) => (p.prizeId ? `p${p.prizeId}` : `t${p.tempIndex}`) === g.prizeKey);
          return {
            position: g.position,
            prizeId: prize?.prizeId,
            tempIndex: prize?.prizeId ? undefined : prize?.tempIndex,
            probability: g.prizeKey ? Number(g.probability) : 0,
          };
        }),
        noWinName: form.noWinName.trim(),
        noWinImage: form.noWinImage,
        noWinTips: form.noWinTips,
        prizeEntryImage: form.decorateConfig.prizeEntryImage,
        decorateConfig: form.decorateConfig,
      };
      await apiPost(`/promotion/lotteryActivity/${activityId > 0 ? 'update' : 'create'}`, param);
      Toast.success({ content: t('保存成功') });
      onSaved();
      onClose();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const savePrize = (prize: PrizeItem) => {
    setForm((prev) => {
      const list = [...prev.prizeList];
      if (prizeModal.index >= 0) list[prizeModal.index] = prize;
      else list.push({ ...prize, tempIndex: list.length });
      return { ...prev, prizeList: list };
    });
    setPrizeModal({ open: false, index: -1 });
  };

  const stepTitles = [t('创建活动'), t('奖项设置'), t('页面装修')];

  return (
    <Modal
      title={`${activityId > 0 ? t('编辑抽奖活动') : t('添加抽奖活动')} — ${stepTitles[step]}`}
      visible={visible}
      onCancel={onClose}
      width={960}
      footer={
        <Space>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>{t('上一步')}</Button>}
          {step < 2 && <Button type="primary" onClick={next}>{t('下一步')}</Button>}
          {step === 2 && <Button type="primary" loading={saving} onClick={submit}>{t('确认')}</Button>}
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 20 }}>
        {/* 左：三步表单 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {step === 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('活动名称')}</span>
                <Input style={{ width: 420 }} value={form.activityName} maxLength={50} onChange={(v) => setForm({ ...form, activityName: v })} placeholder={t('请输入活动名称')} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>{t('活动时间')}</span>
                <Space>
                  <Input style={{ width: 180 }} value={form.startTime} placeholder="YYYY-MM-DD HH:mm:ss" onChange={(v) => setForm({ ...form, startTime: v })} />
                  <span>~</span>
                  <Input style={{ width: 180 }} value={form.endTime} placeholder="YYYY-MM-DD HH:mm:ss" onChange={(v) => setForm({ ...form, endTime: v })} />
                  <Button size="small" onClick={() => setForm({ ...form, startTime: nowText(), endTime: daysLaterText(1) })}>{t('1天')}</Button>
                  <Button size="small" onClick={() => setForm({ ...form, startTime: nowText(), endTime: daysLaterText(7) })}>{t('7天')}</Button>
                  <Button size="small" onClick={() => setForm({ ...form, startTime: nowText(), endTime: daysLaterText(15) })}>{t('15天')}</Button>
                </Space>
              </label>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('中奖次数')}</span>
                <RadioGroup value={form.winLimitType} onChange={(e) => setForm({ ...form, winLimitType: Number(e.target.value), winLimit: Number(e.target.value) === 1 && !form.winLimit ? 1 : form.winLimit })}>
                  <Radio value={0}>{t('无限制')}</Radio>
                  <Radio value={1}>
                    <Space>
                      <span>{t('每人最多抽中')}</span>
                      <InputNumber style={{ width: 100 }} min={1} disabled={form.winLimitType !== 1} value={form.winLimit} onChange={(v) => setForm({ ...form, winLimit: numOrNull(v) })} />
                      <span>{t('次')}</span>
                    </Space>
                  </Radio>
                </RadioGroup>
                {form.winLimitType === 1 && <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('每位用户有中奖次数上限，一旦达到上限，后续抽奖将不再中奖')}</span>}
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('每人基础抽奖次数')}</span>
                <RadioGroup value={form.drawLimitType} onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm({
                    ...form,
                    drawLimitType: v,
                    dailyLimit: v === 1 && !form.dailyLimit ? 1 : form.dailyLimit,
                    totalLimit: v === 1 && !form.totalLimit ? 1 : form.totalLimit,
                  });
                }}>
                  <Radio value={0}>{t('无限制')}</Radio>
                  <Radio value={1}>
                    <Space>
                      <span>{t('每日最大抽奖次数')}</span>
                      <InputNumber style={{ width: 90 }} min={1} disabled={form.drawLimitType !== 1} value={form.dailyLimit} onChange={(v) => setForm({ ...form, dailyLimit: numOrNull(v) })} />
                      <span>{t('活动时间内最大抽奖次数')}</span>
                      <InputNumber style={{ width: 90 }} min={1} disabled={form.drawLimitType !== 1} value={form.totalLimit} onChange={(v) => setForm({ ...form, totalLimit: numOrNull(v) })} />
                    </Space>
                  </Radio>
                </RadioGroup>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('基础抽奖参与条件')}</span>
                <RadioGroup value={form.isConsumePoints} onChange={(e) => setForm({ ...form, isConsumePoints: Number(e.target.value), costPoints: Number(e.target.value) === 1 && !form.costPoints ? 1 : form.costPoints })}>
                  <Radio value={0}>{t('无限制')}</Radio>
                  <Radio value={1}>
                    <Space>
                      <span>{t('每次抽奖消耗')}</span>
                      <InputNumber style={{ width: 100 }} min={1} disabled={form.isConsumePoints !== 1} value={form.costPoints} onChange={(v) => setForm({ ...form, costPoints: numOrNull(v) })} />
                      <span>{t('积分')}</span>
                    </Space>
                  </Radio>
                </RadioGroup>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{t('奖品设置')}</span>
                  <Button size="small" icon={<IconPlus />} disabled={form.prizeList.length >= 7} onClick={() => setPrizeModal({ open: true, index: -1 })}>
                    {t('添加奖品（{length}/7）', { length: form.prizeList.length })}
                  </Button>
                </Space>
                <Table
                  size="small"
                  empty={<Empty description={t('暂无奖品')} />}
                  dataSource={form.prizeList}
                  rowKey={(r?: any) => String(r.prizeId ?? `t${r.tempIndex}`)}
                  pagination={false}
                  columns={[
                    { title: t('奖品名称'), dataIndex: 'prizeName' },
                    { title: t('奖品类型'), dataIndex: 'prizeType', width: 90, render: (v: number) => PRIZE_TYPE_NAME[v] ?? '-' },
                    { title: t('奖品内容'), dataIndex: 'prizeValue', width: 110, render: (v: any, r: PrizeItem) => (r.prizeType === 1 ? `${v} ${t('积分')}` : r.prizeType === 2 ? `#${v}` : `#${v}`) },
                    { title: t('奖品库存'), dataIndex: 'prizeStock', width: 90 },
                    { title: t('图片'), width: 70, render: (_: any, r: PrizeItem) => (r.prizeImage ? <img src={r.prizeImage} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} /> : '-') },
                    {
                      title: t('操作'),
                      width: 120,
                      render: (_: any, r: PrizeItem) => {
                        const index = form.prizeList.indexOf(r);
                        return (
                          <Space>
                            <Button theme="borderless" type="primary" size="small" onClick={() => setPrizeModal({ open: true, index })}>{t('编辑')}</Button>
                            <Button theme="borderless" type="danger" size="small" onClick={() => setForm({ ...form, prizeList: form.prizeList.filter((_, i) => i !== index) })}>{t('移除')}</Button>
                          </Space>
                        );
                      },
                    },
                  ] as ColumnProps<PrizeItem>[]}
                />
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{t('未中奖设置')}</span>
                <Space>
                  <span style={{ width: 100 }}>{t('未中奖名称')}</span>
                  <Input style={{ width: 240 }} value={form.noWinName} onChange={(v) => setForm({ ...form, noWinName: v })} placeholder={t('谢谢参与')} />
                </Space>
                <Space>
                  <span style={{ width: 100 }}>{t('图片')}</span>
                  <ImageUploader single max={1} value={form.noWinImage ? [form.noWinImage] : []} onChange={(next) => setForm({ ...form, noWinImage: next[0] ?? '' })} />
                  <Button theme="borderless" type="primary" onClick={() => setForm({ ...form, noWinImage: DEFAULT_NO_WIN_IMAGE })}>{t('恢复默认图')}</Button>
                </Space>
                <Space>
                  <span style={{ width: 100 }}>{t('未中奖提示语')}</span>
                  <Input style={{ width: 240 }} value={form.noWinTips} onChange={(v) => setForm({ ...form, noWinTips: v })} placeholder={t('很遗憾没有抽中')} />
                </Space>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('转盘设置')}</div>
                <Table
                  size="small"
                  dataSource={form.gridConfig}
                  rowKey="position"
                  pagination={false}
                  columns={[
                    { title: t('转盘位置'), dataIndex: 'position', width: 80, render: (v: number) => `${v}` },
                    {
                      title: t('奖品名称'),
                      dataIndex: 'prizeKey',
                      render: (_: any, row: GridRow) =>
                        row.position === 8 ? (
                          <span style={{ color: 'var(--semi-color-text-2)' }}>{form.noWinName || t('谢谢参与')}</span>
                        ) : (
                          <Select
                            style={{ width: '100%' }}
                            showClear
                            placeholder={t('请选择奖品')}
                            optionList={[
                              { value: '', label: form.noWinName || t('未中奖') },
                              ...form.prizeList.map((p) => ({ value: p.prizeId ? `p${p.prizeId}` : `t${p.tempIndex}`, label: p.prizeName })),
                            ]}
                            value={row.prizeKey || undefined}
                            onChange={(v) =>
                              setForm({
                                ...form,
                                gridConfig: form.gridConfig.map((g) => (g.position === row.position ? { ...g, prizeKey: String(v ?? '') } : g)),
                              })
                            }
                          />
                        ),
                    },
                    { title: t('奖品图片'), width: 80, render: (_: any, row: GridRow) => <img src={prizeKeyImage(row.prizeKey)} alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} /> },
                    {
                      title: t('概率(%)'),
                      width: 110,
                      render: (_: any, row: GridRow) =>
                        row.position === 8 ? (
                          <span style={{ color: 'var(--semi-color-text-2)' }}>-</span>
                        ) : (
                          <InputNumber
                            size="small"
                            style={{ width: 90 }}
                            min={0}
                            max={100}
                            value={row.probability}
                            disabled={!row.prizeKey}
                            onChange={(v) =>
                              setForm({
                                ...form,
                                gridConfig: form.gridConfig.map((g) => (g.position === row.position ? { ...g, probability: Number(v ?? 0) } : g)),
                              })
                            }
                          />
                        ),
                    },
                  ] as ColumnProps<GridRow>[]}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('背景图')}</span>
                <Space align="end">
                  <ImageUploader single max={1} value={form.decorateConfig.bgImage ? [form.decorateConfig.bgImage] : []} onChange={(next) => setForm({ ...form, decorateConfig: { ...form.decorateConfig, bgImage: next[0] ?? '' } })} />
                  <Button theme="borderless" type="primary" onClick={() => setForm({ ...form, decorateConfig: { ...form.decorateConfig, bgImage: DEFAULT_BG } })}>{t('恢复默认图')}</Button>
                </Space>
                <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>{t('建议尺寸 750x1625 px (手机全屏)')}</span>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('背景色')}</span>
                <Space>
                  {['', '#EE0A24', '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#c71585'].map((color) => (
                    <div
                      key={color || 'none'}
                      onClick={() => setForm({ ...form, decorateConfig: { ...form.decorateConfig, bgColor: color } })}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: color || 'var(--semi-color-fill-0)',
                        border: form.decorateConfig.bgColor === color ? '2px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: 'var(--semi-color-text-2)',
                      }}
                    >
                      {color ? '' : '×'}
                    </div>
                  ))}
                </Space>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('奖品入口图')}</span>
                <Space align="end">
                  <ImageUploader single max={1} value={form.decorateConfig.prizeEntryImage ? [form.decorateConfig.prizeEntryImage] : []} onChange={(next) => setForm({ ...form, decorateConfig: { ...form.decorateConfig, prizeEntryImage: next[0] ?? '' } })} />
                  <Button theme="borderless" type="primary" onClick={() => setForm({ ...form, decorateConfig: { ...form.decorateConfig, prizeEntryImage: DEFAULT_ENTRY } })}>{t('恢复默认图')}</Button>
                </Space>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('中奖名单')}</span>
                <RadioGroup value={form.decorateConfig.showWinnerList} onChange={(e) => setForm({ ...form, decorateConfig: { ...form.decorateConfig, showWinnerList: Number(e.target.value) } })}>
                  <Radio value={1}>{t('显示')}</Radio>
                  <Radio value={0}>{t('不显示')}</Radio>
                </RadioGroup>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <span>{t('玩法规则')}</span>
                <TextArea
                  style={{ width: 460 }}
                  rows={5}
                  maxCount={500}
                  value={form.decorateConfig.activityRules}
                  onChange={(v: string) => setForm({ ...form, decorateConfig: { ...form.decorateConfig, activityRules: v } })}
                  placeholder={t('请输入活动规则说明')}
                />
              </div>
            </div>
          )}
        </div>

        {/* 右：九宫格预览（简化版 MobilePreview） */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              width: 240,
              height: 420,
              borderRadius: 12,
              border: '1px solid var(--semi-color-border)',
              overflow: 'hidden',
              background: form.decorateConfig.bgColor || '#f7f7f7',
              backgroundImage: form.decorateConfig.bgImage ? `url(${form.decorateConfig.bgImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'top center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.4)', fontSize: 16 }}>{form.activityName || t('大转盘')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: 4, background: '#fff', padding: 6, borderRadius: 8 }}>
              {[1, 2, 3, 8, 0, 4, 7, 6, 5].map((slot) => {
                if (slot === 0) {
                  return (
                    <div key="center" style={{ width: 60, height: 60, borderRadius: 6, background: '#df4544', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {form.decorateConfig.prizeEntryImage ? (
                        <img src={form.decorateConfig.prizeEntryImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: '#fff', fontSize: 12 }}>{t('抽奖')}</span>
                      )}
                    </div>
                  );
                }
                const row = form.gridConfig.find((g) => g.position === slot);
                return (
                  <div key={slot} style={{ width: 60, height: 60, borderRadius: 6, background: '#fff4e3', border: '1px solid #ffe1b3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 2 }}>
                    <img src={prizeKeyImage(row?.prizeKey || '')} alt="" style={{ width: 24, height: 24, objectFit: 'cover' }} />
                    <span style={{ fontSize: 9, color: '#a05a1e', textAlign: 'center', lineHeight: '11px', overflow: 'hidden', maxHeight: 22 }}>{prizeKeyLabel(row?.prizeKey || '')}</span>
                  </div>
                );
              })}
            </div>
            {form.decorateConfig.showWinnerList === 1 && <div style={{ fontSize: 11, color: '#fff', background: 'rgba(0,0,0,.35)', padding: '2px 10px', borderRadius: 10 }}>{t('中奖名单')}</div>}
          </div>
        </div>
      </div>

      <PrizeEditModal visible={prizeModal.open} initial={prizeModal.index >= 0 ? form.prizeList[prizeModal.index] ?? null : null} onClose={() => setPrizeModal({ open: false, index: -1 })} onSaved={savePrize} />
    </Modal>
  );
}

/* --------------------------------- 用户管理 --------------------------------- */

function UserManageModal({ visible, activity, onClose }: { visible: boolean; activity: any; onClose: () => void }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [recordUser, setRecordUser] = useState<any>(null);

  const load = (targetPage = page) => {
    if (!activity) return;
    setLoading(true);
    apiGet<{ records: any[]; total: number }>('/promotion/lotteryActivity/userManage', {
      activityId: activity.activityId,
      page: targetPage,
      size: 10,
      userName: userName || undefined,
    })
      .then((res) => {
        setRows(res.records || []);
        setTotal(res.total || 0);
      })
      .catch((e) => Toast.error({ content: e.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible && activity) {
      setPage(1);
      setUserName('');
      load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, activity]);

  return (
    <Modal title={`${t('用户管理')} — ${activity?.activityName ?? ''}`} visible={visible} onCancel={onClose} footer={null} width={720}>
      <Space style={{ marginBottom: 12 }}>
        <Input style={{ width: 200 }} value={userName} onChange={setUserName} placeholder={t('用户名')} />
        <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey="userId"
        pagination={{ currentPage: page, pageSize: 10, total, onPageChange: (p) => { setPage(p); load(p); } }}
        columns={[
          { title: 'ID', dataIndex: 'userId', width: 70 },
          { title: t('用户名'), dataIndex: 'userName' },
          { title: t('来源'), dataIndex: 'fromTagName', width: 100 },
          { title: t('抽奖次数'), dataIndex: 'totalCount', width: 90 },
          { title: t('最后抽奖时间'), dataIndex: 'lastLotteryTime', width: 170 },
          {
            title: t('操作'),
            width: 100,
            render: (_: any, row: any) => <Button theme="borderless" type="primary" onClick={() => setRecordUser(row)}>{t('中奖记录')}</Button>,
          },
        ] as ColumnProps<any>[]}
      />
      <Modal title={`${t('中奖记录')} — ${recordUser?.userName ?? ''}`} visible={!!recordUser} onCancel={() => setRecordUser(null)} footer={null} width={640}>
        {recordUser && (
          <UserRecordTable activityId={activity.activityId} userId={recordUser.userId} />
        )}
      </Modal>
    </Modal>
  );
}

function UserRecordTable({ activityId, userId }: { activityId: number; userId: number }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    apiGet<{ records: any[] }>('/promotion/lotteryActivity/userRecord', { activityId, userId, page: 1, size: 50 })
      .then((res) => setRows(res.records || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [activityId, userId]);
  return (
    <Table
      loading={loading}
      dataSource={rows}
      rowKey="recordId"
      pagination={false}
      empty={<Empty description={t('暂无数据')} />}
      columns={[
        { title: t('奖品名称'), dataIndex: 'prizeName' },
        { title: t('状态'), dataIndex: 'statusText', width: 90 },
        { title: t('时间'), dataIndex: 'createTime', width: 170 },
      ] as ColumnProps<any>[]}
    />
  );
}

/* ---------------------------------- 列表页 ---------------------------------- */

export default function Lottery() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [edit, setEdit] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });
  const [userTarget, setUserTarget] = useState<any>(null);

  const load = (targetPage = page) => {
    setLoading(true);
    apiGet<{ records: any[]; total: number }>('/promotion/lotteryActivity/list', {
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

  const statusTag = (row: any) => {
    const color = row.status === 1 ? 'green' : row.status === 2 ? 'grey' : 'orange';
    return <Tag color={color}>{row.statusText || t('未知')}</Tag>;
  };

  const endActivity = async (row: any) => {
    try {
      await apiPost('/promotion/lotteryActivity/end', { activityId: row.activityId });
      Toast.success({ content: t('活动已结束') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('操作失败') });
    }
  };

  const deleteActivity = async (row: any) => {
    try {
      await apiPost('/promotion/lotteryActivity/delete', { activityId: row.activityId });
      Toast.success({ content: t('删除成功') });
      load();
    } catch (e) {
      Toast.error({ content: e instanceof Error ? e.message : t('删除失败') });
    }
  };

  const columns = useMemo(
    () =>
      [
        { title: t('活动名称'), dataIndex: 'activityName', width: 200 },
        { title: t('状态'), dataIndex: 'status', width: 100, render: (_: any, row: any) => statusTag(row) },
        { title: t('参与人数'), dataIndex: 'participantCount', width: 100 },
        { title: t('开始时间'), dataIndex: 'startTime', width: 170 },
        { title: t('结束时间'), dataIndex: 'endTime', width: 170 },
        { title: t('创建时间'), dataIndex: 'createTime', width: 170 },
        {
          title: t('操作'),
          width: 250,
          render: (_: any, row: any) => (
            <Space>
              <Button theme="borderless" type="primary" onClick={() => setEdit({ open: true, id: row.activityId })}>{t('编辑')}</Button>
              <Button theme="borderless" onClick={() => setUserTarget(row)}>{t('用户管理')}</Button>
              {row.status !== 2 && (
                <Popconfirm title={t('确认结束该活动？')} onConfirm={() => endActivity(row)}>
                  <Button theme="borderless" type="warning">{t('结束')}</Button>
                </Popconfirm>
              )}
              {row.canDelete !== false && (
                <Popconfirm title={t('确认删除该活动？')} onConfirm={() => deleteActivity(row)}>
                  <Button theme="borderless" type="danger">{t('删除')}</Button>
                </Popconfirm>
              )}
            </Space>
          ),
        },
      ] as ColumnProps<any>[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, keyword],
  );

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input style={{ width: 240 }} value={keyword} onChange={setKeyword} placeholder={t('活动名称')} />
        <Button type="primary" onClick={() => { setPage(1); load(1); }}>{t('搜索')}</Button>
        <Button theme="solid" icon={<IconPlus />} onClick={() => setEdit({ open: true, id: 0 })}>{t('添加抽奖活动')}</Button>
      </Space>
      <Table
        loading={loading}
        dataSource={rows}
        rowKey="activityId"
        columns={columns}
        empty={<Empty description={t('暂无数据')} />}
        pagination={{ currentPage: page, pageSize: 15, total, onPageChange: (p) => { setPage(p); load(p); } }}
      />
      <LotteryEditModal
        visible={edit.open}
        activityId={edit.id}
        onClose={() => setEdit({ open: false, id: 0 })}
        onSaved={() => load()}
      />
      <UserManageModal visible={!!userTarget} activity={userTarget} onClose={() => setUserTarget(null)} />
    </div>
  );
}
