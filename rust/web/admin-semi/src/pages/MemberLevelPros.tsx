import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Image,
  Input,
  InputNumber,
  Modal,
  Popover,
  Radio,
  RadioGroup,
  Select,
  SideSheet,
  Space,
  Table,
  TextArea,
  Toast,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  IconChevronDown,
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost, apiUpload, isDemo } from '../api';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';
import './member-level-pros.css';

/**
 * 付费会员等级设置：对应旧版 user/levelManagePro/List.vue(包装页) + src/ProList.vue
 * + Info.vue + src/AddRights.vue + src/SetCardType.vue。
 *
 * 后端端点（Rust admin 路由 rust/crates/api/admin/src/routes/member/user_rank.rs，共 7 条，
 * 无 recall / 独立 userRank 端点）：
 * - GET  /user/userRank/listByPro → { userRank: { records... }, rankConfig: { data: { type, rankAfterMonth, useMonth } } }
 * - GET  /user/userRank/detail    → { rankType, userRankList, userRankConfig, growUpSetting }
 * - POST /user/userRank/update    → UserRankEditParam（rankType 必填；data 1..10 条；rankType=1 必须带 growUpSetting）
 *
 * 旧 ProList.vue 会员权益列 prop=isCompanyAuth（无实际用途的占位 prop），新版直接渲染权益明细。
 * 旧 Info.vue 校验 prop：userRankConfig.type / buyOrder / evpi / bindPhone，均映射到本页状态。
 */

interface RankRight {
  name?: string;
  showName?: string;
  icon?: string;
  value?: number | string;
  describe?: string;
  isChecked?: number;
}

interface RankRow {
  rankId?: number;
  rankLevel?: number;
  rankName?: string;
  rankLogo?: string;
  rankCardType?: number;
  rankIco?: string;
  rankBg?: string;
  minGrowthPoints?: number | string;
  discount?: number | string;
  rankPoint?: number | string;
  freeShipping?: number;
  rights?: RankRight[];
  userCount?: number;
  rankType?: number;
  userRights?: string;
}

interface GrowUpSetting {
  buyOrder: number;
  buyOrderNumber: number;
  buyOrderGrowth: number;
  evpi: number;
  evpiGrowth: number;
  bindPhone: number;
  bindPhoneGrowth: number;
}

interface RankConfigData {
  type?: number;
  rankAfterMonth?: number;
  useMonth?: number;
}

interface RankFormState {
  rankType: number;
  userRankConfig: RankConfigData;
  growUpSetting: GrowUpSetting;
  data: RankRow[];
}

/** 金额单位：旧版 config.config.amountUnit（映射自 dollarSignCn，缺省「元」） */
const AMOUNT_UNIT = '元';

const GROW_INIT: GrowUpSetting = {
  buyOrder: 1,
  buyOrderNumber: 1,
  buyOrderGrowth: 1,
  evpi: 1,
  evpiGrowth: 1,
  bindPhone: 1,
  bindPhoneGrowth: 1,
};

const DEFAULT_FORM: RankFormState = {
  rankType: 1,
  userRankConfig: { type: 1, rankAfterMonth: 12, useMonth: 12 },
  growUpSetting: { ...GROW_INIT },
  data: [
    {
      rankLevel: 1,
      rankName: '黄金会员',
      rankLogo: 'https://oss.tigshop.com/img/gallery/202501/1735803176Yh9mCaE2r9ebXK3bGm.png',
      rankCardType: 1,
      rankIco: 'card1',
      rankBg: '',
      minGrowthPoints: 0,
      discount: '',
      rankPoint: '',
      freeShipping: 0,
      rights: [],
    },
  ],
};

/** 新增等级的默认会员名称（旧 Info.vue nameList） */
const RANK_NAME_LIST: Record<number, string> = {
  1: '黄金会员',
  2: '铂金会员',
  3: '黑金会员',
  4: '钻石会员',
  5: '至尊会员',
};

/** 新增等级的默认会员图标（旧 Info.vue vipIcons） */
const VIP_ICONS = [
  'https://oss.tigshop.com/img/gallery/202501/1737524324ro1DJxNm3aQowZKnPU.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324ZUrDWMFqTPMBTCOlhg.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324ptLNB2WynLJBBwSHHj.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324hhmoz188M0ejyXEBhT.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324O1BXVeurAyDMj9QG8f.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324T7eKXTpMiCeVQOyFb6.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324bUufpiVaGcaUad1CWd.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324NhZbUn45wj1eSaIbjY.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324bv68MBsoQXa2rLUO9i.png',
  'https://oss.tigshop.com/img/gallery/202501/1737524324urqONY3QDjaTqW7d56.png',
];

/** 会员卡面预设背景色（旧 SetCardType cardList + card.less） */
const CARD_LIST = ['card1', 'card2', 'card3', 'card4', 'card5', 'card6', 'card7', 'card8', 'card9'];

const MONTH_OPTIONS = [
  { label: '1个月', value: 1 },
  { label: '3个月', value: 3 },
  { label: '6个月', value: 6 },
  { label: '12个月', value: 12 },
];

const MODE_OPTIONS = [
  { key: 1, title: '成长值会员', desc: '根据用户的下单积累的成长值，自动升级到不同等级' },
  { key: 2, title: '消费会员', desc: '根据用户的消费金额，自动升级到不同等级' },
];

/** 后端 Decimal 字段统一回传字符串（rust_decimal serde 默认按字符串收发） */
const toDecimalString = (value: unknown, fallback = '0') => {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : String(num);
};

/** 详情回显时把 Decimal 字符串转成可编辑数字，空值保持 ''（旧表单语义） */
const toNumOrEmpty = (value: unknown): number | '' => {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  return Number.isNaN(num) ? '' : num;
};

const normalizeRow = (row: any): RankRow => ({
  ...row,
  minGrowthPoints: toNumOrEmpty(row.minGrowthPoints),
  discount: toNumOrEmpty(row.discount),
  rankPoint: toNumOrEmpty(row.rankPoint),
  freeShipping: Number(row.freeShipping) === 1 ? 1 : 0,
  rankCardType: Number(row.rankCardType) || 1,
  rankIco: row.rankIco || 'card1',
  rankBg: row.rankBg || '',
  rankLogo: row.rankLogo || '',
  rights: Array.isArray(row.rights)
    ? row.rights.map((right: any) => ({
        ...right,
        value: toNumOrEmpty(right.value),
        isChecked: Number(right.isChecked) === 1 ? 1 : 0,
      }))
    : [],
});

/** 卡面小预览：rankCardType=2 且有自定义图时用图片，否则用预设渐变色（旧 card_item） */
const CardPreview = ({ row }: { row: RankRow }) =>
  Number(row.rankCardType) === 2 && row.rankBg ? (
    <div className="mlp-card" style={{ backgroundImage: `url(${row.rankBg})` }} />
  ) : (
    <div className={`mlp-card ${row.rankIco || 'card1'}`} />
  );

/** 升级条件文案（无门槛 / N成长值 / 消费满N元） */
const growthText = (
  row: RankRow,
  t: (key: string, params?: Record<string, string | number>) => string,
) => {
  const value = Number(row.minGrowthPoints);
  if (row.minGrowthPoints === '' || Number.isNaN(value) || value === 0) return t('无门槛');
  if (Number(row.rankType) === 2) return t('消费满 {value}{unit}', { value, unit: t('元') });
  return t('{value}成长值', { value });
};

export default function MemberLevelPros() {
  const { t } = useI18n();
  // ——— 列表（旧 ProList.vue） ———
  const [rows, setRows] = useState<RankRow[]>([]);
  const [rankConfig, setRankConfig] = useState<{ data?: RankConfigData }>({});
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);

  // ——— 编辑抽屉（旧 Info.vue） ———
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RankFormState>(DEFAULT_FORM);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoIndex, setLogoIndex] = useState(-1);

  // ——— 自定义权益弹窗（旧 AddRights.vue） ———
  const [rightsOpen, setRightsOpen] = useState(false);
  const [rightsMode, setRightsMode] = useState<'add' | 'edit'>('add');
  const [rightsIndex, setRightsIndex] = useState(0);
  const [rightsForm, setRightsForm] = useState<RankRight>({
    name: '',
    showName: '',
    icon: '',
    value: 0,
    describe: '',
    isChecked: 0,
  });

  // ——— 会员卡面弹窗（旧 SetCardType.vue） ———
  const [cardOpen, setCardOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(-1);
  const [cardForm, setCardForm] = useState<{ rankCardType: number; rankIco: string; rankBg: string }>({
    rankCardType: 1,
    rankIco: 'card1',
    rankBg: '',
  });

  const rankType = Number(form.rankType) || 1;
  const configType = Number(form.userRankConfig.type) || 1;
  const firstRights = form.data[0]?.rights || [];
  const monthOptions = MONTH_OPTIONS.map((item) => ({ ...item, label: t(item.label) }));

  // ——— 数据加载 ———
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<any>('/user/userRank/listByPro', { page: 1, size: 100 })
      .then((result) => {
        if (!alive) return;
        setRows(((result?.userRank?.records || []) as any[]).map(normalizeRow));
        setRankConfig(result?.rankConfig || {});
      })
      .catch((error) => alive && Toast.error({ content: error instanceof Error ? error.message : t('请求失败') }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  // ——— 编辑状态操作 ———
  const updateRow = (index: number, patch: Partial<RankRow>) => {
    setForm((prev) => {
      const data = prev.data.slice();
      data[index] = { ...data[index], ...patch };
      return { ...prev, data };
    });
  };

  const updateRightCheck = (rowIndex: number, rightIndex: number, checked: number) => {
    setForm((prev) => {
      const data = prev.data.map((row, i) => {
        if (i !== rowIndex) return row;
        const rights = (row.rights || []).slice();
        rights[rightIndex] = { ...rights[rightIndex], isChecked: checked };
        return { ...row, rights };
      });
      return { ...prev, data };
    });
  };

  const updateGrow = (patch: Partial<GrowUpSetting>) => {
    setForm((prev) => ({ ...prev, growUpSetting: { ...prev.growUpSetting, ...patch } }));
  };

  const updateConfig = (patch: Partial<RankConfigData>) => {
    setForm((prev) => ({ ...prev, userRankConfig: { ...prev.userRankConfig, ...patch } }));
  };

  // ——— 打开编辑抽屉（旧 DialogForm act=detail） ———
  const openEdit = async () => {
    setEditOpen(true);
    if (isDemo()) {
      setForm({ ...DEFAULT_FORM, growUpSetting: { ...GROW_INIT }, data: DEFAULT_FORM.data.map((row) => ({ ...row, rights: [] })) });
      return;
    }
    setEditLoading(true);
    try {
      const result = await apiGet<any>('/user/userRank/detail');
      const configData: RankConfigData = { type: 1, rankAfterMonth: 12, useMonth: 12, ...(result?.userRankConfig?.data || {}) };
      const growSetting: GrowUpSetting = { ...GROW_INIT, ...(result?.growUpSetting || {}) };
      setForm({
        rankType: Number(result?.rankType) || 1,
        userRankConfig: configData,
        growUpSetting: growSetting,
        data: ((result?.userRankList || []) as any[]).map(normalizeRow),
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('请求失败') });
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  // ——— 新增等级（旧 addPreferential，最多 10 级） ———
  const addLevel = () => {
    const error = validateForm();
    if (error) {
      Toast.error({ content: error });
      return;
    }
    setForm((prev) => {
      const nextLevel = prev.data.length + 1;
      const rights = JSON.parse(JSON.stringify(prev.data[0]?.rights || [])) as RankRight[];
      rights.forEach((item) => {
        item.isChecked = 0;
      });
      const row: RankRow = {
        rankLevel: nextLevel,
        rankName: RANK_NAME_LIST[nextLevel] || `VIP${nextLevel}`,
        rankLogo: VIP_ICONS[prev.data.length] || VIP_ICONS[VIP_ICONS.length - 1],
        rankCardType: 1,
        rankIco: `card${nextLevel}`,
        rankBg: '',
        minGrowthPoints: '',
        discount: '',
        rankPoint: '',
        freeShipping: 0,
        rights,
      };
      return { ...prev, data: [...prev.data, row] };
    });
  };

  // ——— 删除等级（旧 onDel，仅最后一行） ———
  const removeLevel = (index: number) => {
    setForm((prev) => ({ ...prev, data: prev.data.filter((_, i) => i !== index) }));
  };

  // ——— 自定义权益（旧 AddRights.vue） ———
  const openRights = (mode: 'add' | 'edit', index = 0) => {
    setRightsMode(mode);
    setRightsIndex(index);
    if (mode === 'edit') {
      const source = firstRights[index] || {};
      setRightsForm({
        name: source.name || '',
        showName: source.showName || '',
        icon: source.icon || '',
        value: toNumOrEmpty(source.value) === '' ? 0 : Number(source.value),
        describe: source.describe || '',
        isChecked: 0,
      });
    } else {
      setRightsForm({ name: '', showName: '', icon: '', value: 0, describe: '', isChecked: 0 });
    }
    setRightsOpen(true);
  };

  /** 旧 addRights：新增时所有行 push，编辑时所有行按索引替换（isChecked 置 0） */
  const submitRights = () => {
    if (!rightsForm.name?.trim()) {
      Toast.error({ content: t('请输入权益名称') });
      return;
    }
    if (!rightsForm.showName?.trim()) {
      Toast.error({ content: t('请输入权益显示') });
      return;
    }
    if (!rightsForm.icon) {
      Toast.error({ content: t('请输入权益图标') });
      return;
    }
    if (!String(rightsForm.describe || '').trim()) {
      Toast.error({ content: t('请输入权益简介') });
      return;
    }
    setForm((prev) => {
      const data = prev.data.map((row) => {
        const rights = (row.rights || []).slice();
        const item: RankRight = { ...rightsForm, isChecked: 0 };
        if (rightsMode === 'add') rights.push(item);
        else rights[rightsIndex] = item;
        return { ...row, rights };
      });
      return { ...prev, data };
    });
    setRightsOpen(false);
  };

  /** 旧 removeRight：所有行删除该权益列，提示保存后生效 */
  const removeRight = (index: number) => {
    setForm((prev) => {
      const data = prev.data.map((row) => ({
        ...row,
        rights: (row.rights || []).filter((_, i) => i !== index),
      }));
      return { ...prev, data };
    });
  };

  // ——— 会员卡面（旧 SetCardType.vue） ———
  const openCard = (index: number) => {
    const row = form.data[index];
    if (!row) return;
    setCardIndex(index);
    setCardForm({
      rankCardType: Number(row.rankCardType) || 1,
      rankIco: row.rankIco || 'card1',
      rankBg: row.rankBg || '',
    });
    setCardOpen(true);
  };

  const saveCard = () => {
    if (cardIndex < 0) return;
    updateRow(cardIndex, { ...cardForm, rankBg: cardForm.rankBg || '' });
    setCardOpen(false);
  };

  // ——— 会员图标上传（旧 FormAddGallery :type=2 单图） ———
  const uploadLogo = async (file: File | null) => {
    if (!file || logoIndex < 0) return;
    if (isDemo()) {
      Toast.warning({ content: t('演示模式不支持上传图片') });
      return;
    }
    try {
      const result = await apiUpload<{ picUrl?: string }>('/setting/galleryPic/uploadImg?galleryId=0', file);
      if (result?.picUrl) updateRow(logoIndex, { rankLogo: result.picUrl });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('上传失败') });
    }
  };

  // ——— 提交校验（对齐旧 rules：rankName/minGrowthPoints/discount/rankPoint/buyOrder/evpi/bindPhone） ———
  const validateForm = (): string | null => {
    let previousGrowth = -Infinity;
    for (let index = 0; index < form.data.length; index += 1) {
      const row = form.data[index];
      if (!String(row.rankName || '').trim()) {
        return t('第{level}级会员名称不能为空', { level: index + 1 });
      }
      if (row.minGrowthPoints === '' || row.minGrowthPoints === null || row.minGrowthPoints === undefined) {
        return t('第{level}级请输入升级条件', { level: index + 1 });
      }
      const growth = Number(row.minGrowthPoints);
      if (Number.isNaN(growth) || growth < 0) {
        return t('第{level}级请输入有效的数字', { level: index + 1 });
      }
      if (index > 0) {
        if (growth <= 0) {
          return t('第{level}级请输入有效的数字', { level: index + 1 });
        }
        if (growth <= previousGrowth) {
          return t('第{level}级需大于上一级的{field}({previous})', {
            level: index + 1,
            field: rankType === 1 ? t('成长值') : t('消费金额'),
            previous: previousGrowth,
          });
        }
      }
      previousGrowth = growth;
      const discount = row.discount;
      if (discount !== '' && discount !== null && discount !== undefined) {
        const num = Number(discount);
        if (!Number.isNaN(num) && (num < 0 || num > 9.9)) {
          return t('第{level}级折扣需大于0小于10', { level: index + 1 });
        }
      }
      const point = row.rankPoint;
      if (point !== '' && point !== null && point !== undefined) {
        const num = Number(point);
        if (!Number.isNaN(num) && (num < 0 || num > 50)) {
          return t('第{level}级多倍积分需大于0小于50', { level: index + 1 });
        }
      }
    }
    if (rankType === 1) {
      const grow = form.growUpSetting;
      if (Number(grow.buyOrder) === 1) {
        if (!grow.buyOrderNumber || Number(grow.buyOrderNumber) < 1 || !grow.buyOrderGrowth || Number(grow.buyOrderGrowth) < 1) {
          return t('请填写完成下单的成长值设置');
        }
      }
      if (Number(grow.evpi) === 1 && (!grow.evpiGrowth || Number(grow.evpiGrowth) < 1)) {
        return t('请填写完善信息的成长值设置');
      }
      if (Number(grow.bindPhone) === 1 && (!grow.bindPhoneGrowth || Number(grow.bindPhoneGrowth) < 1)) {
        return t('请填写绑定手机号的成长值设置');
      }
    }
    return null;
  };

  // ——— 提交（旧 onSubmit → POST /user/userRank/update） ———
  const submitForm = async () => {
    const error = validateForm();
    if (error) {
      Toast.error({ content: error });
      return;
    }
    setSaving(true);
    try {
      const grow = form.growUpSetting;
      await apiPost('/user/userRank/update', {
        id: 0,
        rankType,
        // 旧 Info.vue 提交 userRankConfig（即接口 userRankConfig.data 对象）
        userRankConfig: {
          type: Number(form.userRankConfig.type) || 1,
          rankAfterMonth: Number(form.userRankConfig.rankAfterMonth) || 12,
          useMonth: Number(form.userRankConfig.useMonth) || 12,
        },
        growUpSetting: {
          buyOrder: Number(grow.buyOrder) === 1 ? 1 : 0,
          buyOrderNumber: Number(grow.buyOrderNumber) || 0,
          buyOrderGrowth: Number(grow.buyOrderGrowth) || 0,
          evpi: Number(grow.evpi) === 1 ? 1 : 0,
          evpiGrowth: Number(grow.evpiGrowth) || 0,
          bindPhone: Number(grow.bindPhone) === 1 ? 1 : 0,
          bindPhoneGrowth: Number(grow.bindPhoneGrowth) || 0,
        },
        data: form.data.map((row, index) => ({
          rankId: row.rankId || undefined,
          rankLevel: Number(row.rankLevel) || index + 1,
          rankName: String(row.rankName || ''),
          rankLogo: row.rankLogo || '',
          rankCardType: Number(row.rankCardType) || 1,
          rankIco: row.rankIco || 'card1',
          rankBg: row.rankBg || '',
          minGrowthPoints: toDecimalString(row.minGrowthPoints),
          discount:
            row.discount === '' || row.discount === null || row.discount === undefined
              ? undefined
              : toDecimalString(row.discount),
          rankPoint:
            row.rankPoint === '' || row.rankPoint === null || row.rankPoint === undefined
              ? undefined
              : toDecimalString(row.rankPoint),
          freeShipping: Number(row.freeShipping) === 1 ? 1 : 0,
          rights: (row.rights || []).map((right) => ({
            name: right.name || '',
            showName: right.showName || '',
            icon: right.icon || '',
            value: toDecimalString(right.value),
            describe: right.describe || '',
            isChecked: Number(right.isChecked) === 1 ? 1 : 0,
          })),
        })),
      });
      Toast.success({ content: t('操作成功') });
      setEditOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  // ——— 列表列（旧 ProList.vue） ———
  const listColumns = [
    {
      title: t('等级'),
      width: 100,
      render: (_: unknown, row: RankRow) => <span className="mlp-level">vip{row.rankLevel}</span>,
    },
    {
      title: t('会员图标'),
      width: 100,
      render: (_: unknown, row: RankRow) =>
        row.rankLogo ? <Image src={row.rankLogo} width={20} height={20} style={{ objectFit: 'contain' }} /> : <span>-</span>,
    },
    { title: t('会员名称'), dataIndex: 'rankName', width: 120 },
    {
      title: t('会员卡面'),
      width: 120,
      render: (_: unknown, row: RankRow) => <CardPreview row={row} />,
    },
    {
      title: t('升级条件'),
      width: 140,
      render: (_: unknown, row: RankRow) => <span>{growthText(row, t)}</span>,
    },
    {
      title: t('会员权益'),
      width: 240,
      render: (_: unknown, row: RankRow) => (
        <div className="mlp-rights-cell">
          {Number(row.discount) > 0 && row.discount !== '' ? (
            <div>{t('会员折扣{discount}折', { discount: Number(row.discount) })}</div>
          ) : null}
          {Number(row.rankPoint) > 0 && row.rankPoint !== '' ? (
            <div>{t('{point}倍会员积分', { point: Number(row.rankPoint) })}</div>
          ) : null}
          {Number(row.freeShipping) === 1 ? <div>{t('享受会员包邮')}</div> : null}
          {(row.rights || []).map(
            (right, index) => (Number(right.isChecked) === 1 ? <div key={index}>{right.name}</div> : null),
          )}
        </div>
      ),
    },
    {
      title: t('保级规则'),
      width: 320,
      render: (_: unknown, row: RankRow, index: number) => {
        if (index === 0) return <span>{t('不降级')}</span>;
        const config = rankConfig?.data || {};
        if (Number(config.type) === 1) return <span>{t('永久有效')}</span>;
        const month = Number(config.rankAfterMonth) || 0;
        const growth = Number(row.minGrowthPoints);
        if (Number(row.rankType) === 2) {
          return (
            <span>
              {t('获得等级的{month}个月内，消费满{growth}{unit}可保级', {
                month,
                growth,
                unit: t('元'),
              })}
            </span>
          );
        }
        return (
          <span>
            {t('获得等级的{month}个月内，成长值达到{growth}可保级', { month, growth })}
          </span>
        );
      },
    },
    {
      title: t('会员数'),
      dataIndex: 'userCount',
      width: 90,
      render: (value: number) => <span>{Number(value) || 0}</span>,
    },
  ] as any;

  // ——— 编辑表格列（旧 Info.vue 等级方案表） ———
  const editColumns = [
    {
      title: t('等级'),
      width: 70,
      render: (_: unknown, row: RankRow) => <span className="mlp-level-sm">vip{row.rankLevel}</span>,
    },
    {
      title: t('会员图标'),
      width: 90,
      align: 'center',
      render: (_: unknown, row: RankRow, index: number) => (
        <Tooltip content={t('点击修改')}>
          <span
            className="mlp-logo-cell"
            onClick={() => {
              setLogoIndex(index);
              logoInputRef.current?.click();
            }}
          >
            {row.rankLogo ? (
              <img src={row.rankLogo} alt={t('会员图标')} />
            ) : (
              <IconPlus size="small" />
            )}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('会员卡面'),
      width: 100,
      align: 'center',
      render: (_: unknown, row: RankRow, index: number) => (
        <span className="mlp-card-click" onClick={() => openCard(index)}>
          <CardPreview row={row} />
        </span>
      ),
    },
    {
      title: `${t('会员名称')}*`,
      width: 160,
      render: (_: unknown, row: RankRow, index: number) => (
        <Input
          value={row.rankName || ''}
          placeholder={t('请输入')}
          onChange={(next) => updateRow(index, { rankName: next })}
        />
      ),
    },
    {
      // 旧 Info.vue 列头 $t('升级条件{rankType1}*') 按模式动态渲染（audit 记录键：升级条件rankType1*）。
      title: (
        <span>
          {t('升级条件')}
          {rankType === 1 ? t('(成长值)') : ''}*
        </span>
      ),
      width: 200,
      render: (_: unknown, row: RankRow, index: number) => {
        const isEmpty = Number(row.minGrowthPoints) === 0 && row.minGrowthPoints !== '' && row.minGrowthPoints !== null;
        return (
          <div className="mlp-cell">
            {index === 0 && isEmpty ? (
              <span>{t('无门槛')}</span>
            ) : (
              <>
                {rankType === 2 ? <span className="mlp-unit">{t('消费满')}</span> : null}
                <InputNumber
                  size="small"
                  min={0}
                  precision={rankType === 1 ? 0 : 2}
                  style={{ width: 110 }}
                  placeholder={t('请输入')}
                  value={row.minGrowthPoints === '' ? undefined : Number(row.minGrowthPoints)}
                  onChange={(next) => updateRow(index, { minGrowthPoints: next === null || next === undefined ? '' : Number(next) })}
                />
                <span className="mlp-unit">{rankType === 1 ? t('成长值') : t(AMOUNT_UNIT)}</span>
              </>
            )}
            {index === 0 ? (
              <Dropdown
                trigger="click"
                position="bottomRight"
                menu={[
                  { node: 'item', name: t('无门槛'), onClick: () => updateRow(index, { minGrowthPoints: 0 }) },
                  {
                    node: 'item',
                    name: rankType === 1 ? t('达到x成长值') : t('消费x元'),
                    onClick: () => updateRow(index, { minGrowthPoints: '' }),
                  },
                ]}
              >
                <span className="mlp-caret">
                  <IconChevronDown size="small" />
                </span>
              </Dropdown>
            ) : null}
          </div>
        );
      },
    },
    {
      title: (
        <div className="mlp-rights-head">
          <span>{t('会员权益')}</span>
          <Tooltip content={t('添加权益')}>
            <Button theme="borderless" size="small" icon={<IconPlus />} onClick={() => openRights('add')} />
          </Tooltip>
        </div>
      ),
      children: [
        {
          title: t('折扣'),
          width: 130,
          render: (_: unknown, row: RankRow, index: number) => (
            <div className="mlp-cell">
              <InputNumber
                size="small"
                min={0}
                max={9.9}
                precision={1}
                style={{ width: 90 }}
                placeholder="1-9.9"
                value={row.discount === '' || row.discount === null || row.discount === undefined ? undefined : Number(row.discount)}
                onChange={(next) => updateRow(index, { discount: next === null || next === undefined ? '' : Number(next) })}
              />
              <span className="mlp-unit">{t('折')}</span>
            </div>
          ),
        },
        {
          title: t('多倍积分'),
          width: 130,
          render: (_: unknown, row: RankRow, index: number) => (
            <div className="mlp-cell">
              <InputNumber
                size="small"
                min={0}
                max={50}
                precision={1}
                style={{ width: 90 }}
                placeholder="1-50"
                value={row.rankPoint === '' || row.rankPoint === null || row.rankPoint === undefined ? undefined : Number(row.rankPoint)}
                onChange={(next) => updateRow(index, { rankPoint: next === null || next === undefined ? '' : Number(next) })}
              />
              <span className="mlp-unit">{t('倍')}</span>
            </div>
          ),
        },
        {
          title: t('包邮'),
          width: 70,
          align: 'center' as const,
          render: (_: unknown, row: RankRow, index: number) => (
            <Checkbox
              checked={Number(row.freeShipping) === 1}
              onChange={(e: any) => updateRow(index, { freeShipping: e.target.checked ? 1 : 0 })}
            />
          ),
        },
        ...firstRights.map((right, rightIndex) => ({
          title: (
            <div className="mlp-col-head">
              <span className="mlp-col-head-name">{right.name}</span>
              <Tooltip content={t('编辑权益')}>
                <Button theme="borderless" size="small" icon={<IconEdit />} onClick={() => openRights('edit', rightIndex)} />
              </Tooltip>
              <Tooltip content={t('移除后需点击底部保存按钮生效')}>
                <Button theme="borderless" size="small" icon={<IconDelete />} onClick={() => removeRight(rightIndex)} />
              </Tooltip>
            </div>
          ),
          width: 160,
          align: 'center' as const,
          render: (_: unknown, row: RankRow, index: number) => {
            const item = (row.rights || [])[rightIndex];
            return (
              <Checkbox
                checked={Number(item?.isChecked) === 1}
                onChange={(e: any) => updateRightCheck(index, rightIndex, e.target.checked ? 1 : 0)}
              />
            );
          },
        })),
      ],
    },
    {
      title: t('操作'),
      width: 80,
      align: 'center' as const,
      render: (_: unknown, row: RankRow, index: number) =>
        index === form.data.length - 1 && form.data.length > 1 ? (
          <Button theme="borderless" type="danger" size="small" onClick={() => removeLevel(index)}>
            {t('删除')}
          </Button>
        ) : null,
    },
  ] as any;

  const editScrollX = 830 + firstRights.length * 160;

  return (
    <div className="mlp-page">
      <Card shadows="hover" className="table-card">
        <div className="mlp-toolbar">
          <Space>
            <Button theme="solid" type="primary" onClick={openEdit}>
              {t('编辑会员方案')}
            </Button>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} onClick={reload}>
              {t('刷新')}
            </Button>
          </Space>
        </div>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey={(row?: RankRow) => String((row as any)?.rankId ?? row?.rankLevel ?? 0)}
          columns={listColumns}
          pagination={false}
          scroll={{ x: 1230 }}
          empty={loading ? undefined : t('暂无数据')}
        />
      </Card>

      {/* 编辑会员方案抽屉（旧 Info.vue，1100px 抽屉表单） */}
      <SideSheet
        title={t('编辑会员方案')}
        visible={editOpen}
        onCancel={() => setEditOpen(false)}
        width={1100}
        placement="right"
        bodyStyle={{ overflowY: 'auto' }}
        footer={
          <div className="mlp-drawer-footer">
            <Button onClick={() => setEditOpen(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" loading={saving} onClick={submitForm}>
              {t('保存')}
            </Button>
          </div>
        }
      >
        <div className="mlp-drawer-body">
          <div className="mlp-section-title">{t('模式切换')}</div>
          <div className="mlp-mode-options">
            {MODE_OPTIONS.map((option) => (
              <div
                key={option.key}
                className={`mlp-mode-option ${rankType === option.key ? 'is-active' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, rankType: option.key }))}
              >
                <div className="mlp-mode-title">{t(option.title)}</div>
                <div className="mlp-mode-desc">{t(option.desc)}</div>
              </div>
            ))}
          </div>

          <div className="mlp-section-title mlp-mt24">{t('等级方案')}</div>
          <div className="mlp-mb10">
            <Button
              type="primary"
              theme="borderless"
              icon={<IconPlus />}
              disabled={form.data.length >= 10}
              onClick={addLevel}
            >
              {form.data.length >= 10
                ? t('最多添加10级')
                : t('添加等级({count}/10)', { count: form.data.length })}
            </Button>
          </div>
          <Table
            loading={editLoading}
            dataSource={form.data}
            rowKey={(row?: RankRow) => String((row as any)?.rankId ?? row?.rankLevel ?? 0)}
            columns={editColumns}
            pagination={false}
            scroll={{ x: editScrollX }}
            empty={editLoading ? undefined : t('暂无数据')}
          />

          {rankType === 1 ? (
            <>
              <div className="mlp-section-title mlp-mt24">{t('成长值设置')}</div>
              <div className="mlp-form-row">
                <div className="mlp-form-label">{t('完成下单')}</div>
                <div>
                  <RadioGroup
                    value={Number(form.growUpSetting.buyOrder)}
                    onChange={(e: any) => updateGrow({ buyOrder: Number(e.target.value) })}
                  >
                    <Radio value={1}>{t('是')}</Radio>
                    <Radio value={0}>{t('否')}</Radio>
                  </RadioGroup>
                  <div className="mlp-grow-row">
                    <span>{t('每完成')}</span>
                    <InputNumber
                      size="small"
                      min={1}
                      precision={0}
                      style={{ width: 100 }}
                      disabled={Number(form.growUpSetting.buyOrder) === 0}
                      value={Number(form.growUpSetting.buyOrderNumber)}
                      onChange={(next) => updateGrow({ buyOrderNumber: Number(next ?? 0) })}
                    />
                    <span>{t('笔订单，获得')}</span>
                    <InputNumber
                      size="small"
                      min={1}
                      precision={0}
                      style={{ width: 100 }}
                      disabled={Number(form.growUpSetting.buyOrder) === 0}
                      value={Number(form.growUpSetting.buyOrderGrowth)}
                      onChange={(next) => updateGrow({ buyOrderGrowth: Number(next ?? 0) })}
                    />
                    <span>{t('成长值')}</span>
                  </div>
                </div>
              </div>
              <div className="mlp-form-row">
                <div className="mlp-form-label">{t('完善信息')}</div>
                <div>
                  <RadioGroup
                    value={Number(form.growUpSetting.evpi)}
                    onChange={(e: any) => updateGrow({ evpi: Number(e.target.value) })}
                  >
                    <Radio value={1}>{t('是')}</Radio>
                    <Radio value={0}>{t('否')}</Radio>
                  </RadioGroup>
                  <div className="mlp-grow-row">
                    <span>{t('完成后赠送：')}</span>
                    <InputNumber
                      size="small"
                      min={1}
                      precision={0}
                      style={{ width: 100 }}
                      disabled={Number(form.growUpSetting.evpi) === 0}
                      value={Number(form.growUpSetting.evpiGrowth)}
                      onChange={(next) => updateGrow({ evpiGrowth: Number(next ?? 0) })}
                    />
                    <span>{t('成长值')}</span>
                  </div>
                </div>
              </div>
              <div className="mlp-form-row">
                <div className="mlp-form-label">{t('绑定手机号')}</div>
                <div>
                  <RadioGroup
                    value={Number(form.growUpSetting.bindPhone)}
                    onChange={(e: any) => updateGrow({ bindPhone: Number(e.target.value) })}
                  >
                    <Radio value={1}>{t('是')}</Radio>
                    <Radio value={0}>{t('否')}</Radio>
                  </RadioGroup>
                  <div className="mlp-grow-row">
                    <span>{t('完成后赠送：')}</span>
                    <InputNumber
                      size="small"
                      min={1}
                      precision={0}
                      style={{ width: 100 }}
                      disabled={Number(form.growUpSetting.bindPhone) === 0}
                      value={Number(form.growUpSetting.bindPhoneGrowth)}
                      onChange={(next) => updateGrow({ bindPhoneGrowth: Number(next ?? 0) })}
                    />
                    <span>{t('成长值')}</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="mlp-section-title mlp-mt24">{t('等级规则（保级规则）')}</div>
          <div className="mlp-form-row">
            <div className="mlp-form-label">{t('等级有效期：')}</div>
            <div>
              <RadioGroup value={configType} onChange={(e: any) => updateConfig({ type: Number(e.target.value) })}>
                <Radio value={1}>{t('永久有效')}</Radio>
              </RadioGroup>
              <div className="mlp-extra">{t('获得等级后永久有效，不会降级')}</div>
            </div>
          </div>
          <div className="mlp-form-row">
            <div className="mlp-form-label"> </div>
            <div>
              <div className="mlp-grow-row">
                <Radio checked={configType === 2} onChange={() => updateConfig({ type: 2 })}>
                  {t('获得等级')}
                </Radio>
                <Select
                  size="small"
                  style={{ width: 100 }}
                  optionList={monthOptions}
                  value={Number(form.userRankConfig.rankAfterMonth) || 12}
                  onChange={(next) => updateConfig({ rankAfterMonth: Number(next), useMonth: Number(next) })}
                />
                <span>{t('后，按照近')}</span>
                <Select
                  size="small"
                  style={{ width: 100 }}
                  disabled
                  optionList={monthOptions}
                  value={Number(form.userRankConfig.rankAfterMonth) || 12}
                />
                <span>{rankType === 1 ? t('的成长值重新计算等级') : t('的累计消费重新计算等级')}</span>
              </div>
              <div className="mlp-extra">
                {t(
                  '举例: 设置12个月，用户在2023.1.1成为/设置VIP2，那么在2024.1.1将重新根据用户在2023.1.1-2024.1.1之间的累计{field}计算等级。',
                  { field: rankType === 1 ? t('成长值') : t('消费金额') },
                )}
              </div>
            </div>
          </div>
          <div className="mlp-form-row">
            <div className="mlp-form-label">{t('累计时机：')}</div>
            <div>
              <RadioGroup disabled value={1}>
                <Radio value={1}>{t('确认收货')}</Radio>
              </RadioGroup>
              <Table
                className="mlp-keep-table"
                dataSource={form.data}
                rowKey={(row?: RankRow) => String((row as any)?.rankId ?? row?.rankLevel ?? 0)}
                pagination={false}
                columns={[
                  {
                    title: t('会员等级'),
                    width: 100,
                    render: (_: unknown, row: RankRow) => <span className="mlp-level-sm">vip{row.rankLevel}</span>,
                  },
                  {
                    title: (
                      <span className="mlp-keep-head">
                        {t('保级条件')}
                        <Tooltip content={t('保级条件同升级条件一致，暂不支持自定义')}>
                          <span className="mlp-help">?</span>
                        </Tooltip>
                      </span>
                    ),
                    render: (_: unknown, row: RankRow) => <span>{growthText(row, t)}</span>,
                  },
                ] as any}
              />
            </div>
          </div>
        </div>
      </SideSheet>

      {/* 自定义权益弹窗（旧 AddRights.vue） */}
      <Modal
        title={t('自定义权益')}
        visible={rightsOpen}
        width={520}
        onCancel={() => setRightsOpen(false)}
        footer={
          <div className="mlp-drawer-footer">
            <Button onClick={() => setRightsOpen(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" onClick={submitRights}>
              {t('确定')}
            </Button>
          </div>
        }
      >
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('权益名称')}</div>
          <Input
            style={{ width: '100%' }}
            value={rightsForm.name || ''}
            placeholder={t('请输入权益名称')}
            onChange={(next) => setRightsForm((prev) => ({ ...prev, name: next }))}
          />
        </div>
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('展示名称')}</div>
          <Input
            style={{ width: '100%' }}
            value={rightsForm.showName || ''}
            placeholder={t('请输入权益显示')}
            onChange={(next) => setRightsForm((prev) => ({ ...prev, showName: next }))}
          />
        </div>
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('权益图标')}</div>
          <ImageUploader
            single
            max={1}
            value={rightsForm.icon ? [rightsForm.icon] : []}
            onChange={(next) => setRightsForm((prev) => ({ ...prev, icon: next[0] || '' }))}
          />
        </div>
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('权益简介')}</div>
          <TextArea
            style={{ width: '100%' }}
            rows={4}
            value={rightsForm.describe || ''}
            placeholder={t('请输入权益简介')}
            onChange={(next) => setRightsForm((prev) => ({ ...prev, describe: next }))}
          />
        </div>
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('权益价值')}</div>
          <div className="mlp-cell">
            <span>{t('该权益价值')}</span>
            <InputNumber
              size="small"
              min={0}
              style={{ width: 120 }}
              placeholder={t('请输入')}
              value={Number(rightsForm.value ?? 0)}
              onChange={(next) => setRightsForm((prev) => ({ ...prev, value: Number(next ?? 0) }))}
            />
            <span>{t(AMOUNT_UNIT)}</span>
          </div>
        </div>
        <div className="mlp-form-row">
          <div className="mlp-form-label">{t('服务方式')}</div>
          <div>{t('商家线下核销')}</div>
        </div>
      </Modal>

      {/* 会员卡面弹窗（旧 SetCardType.vue） */}
      <Modal
        title={t('会员卡面')}
        visible={cardOpen}
        width={850}
        onCancel={() => setCardOpen(false)}
        footer={
          <div className="mlp-drawer-footer">
            <Button onClick={() => setCardOpen(false)}>{t('取消')}</Button>
            <Button theme="solid" type="primary" onClick={saveCard}>
              {t('确定')}
            </Button>
          </div>
        }
      >
        <div className="mlp-card-dialog">
          <div>
            <div className="mlp-form-row">
              <div className="mlp-form-label">{t('背景设置：')}</div>
              <div>
                <div className="mlp-grow-row">
                  <Radio checked={Number(cardForm.rankCardType) === 1} onChange={() => setCardForm((prev) => ({ ...prev, rankCardType: 1 }))}>
                    {t('背景色')}
                  </Radio>
                  <Popover
                    trigger="click"
                    position="bottom"
                    content={
                      <div className="mlp-swatch-list">
                        {CARD_LIST.map((item) => (
                          <div
                            key={item}
                            className={`mlp-swatch ${item}`}
                            onClick={() => setCardForm((prev) => ({ ...prev, rankIco: item }))}
                          />
                        ))}
                      </div>
                    }
                  >
                    <span className={`mlp-card-check ${Number(cardForm.rankCardType) === 1 ? 'is-active' : ''}`}>
                      <span className={`mlp-card ${cardForm.rankIco || 'card1'}`} />
                    </span>
                  </Popover>
                </div>
              </div>
            </div>
            <div className="mlp-form-row">
              <div className="mlp-form-label"> </div>
              <Radio checked={Number(cardForm.rankCardType) === 2} onChange={() => setCardForm((prev) => ({ ...prev, rankCardType: 2 }))}>
                {t('自定义图片')}
              </Radio>
            </div>
            <div className="mlp-form-row">
              <div className="mlp-form-label"> </div>
              <div>
                <ImageUploader
                  single
                  max={1}
                  value={cardForm.rankBg ? [cardForm.rankBg] : []}
                  onChange={(next) => setCardForm((prev) => ({ ...prev, rankBg: next[0] || '' }))}
                />
                <div className="mlp-extra">
                  {t('尺寸：1000*525像素，小于2M，支持jpg、png、jpeg格式')}
                </div>
              </div>
            </div>
          </div>
          <div>
            {Number(cardForm.rankCardType) === 2 && cardForm.rankBg ? (
              <div className="mlp-card mlp-card-lg" style={{ backgroundImage: `url(${cardForm.rankBg})` }}>
                {form.data[cardIndex]?.rankName || ''}
              </div>
            ) : (
              <div className={`mlp-card mlp-card-lg ${cardForm.rankIco || 'card1'}`}>
                {form.data[cardIndex]?.rankName || ''}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 会员图标上传（隐藏文件选择，旧 FormAddGallery :type=2） */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          uploadLogo(event.target.files?.[0] || null);
          event.target.value = '';
        }}
      />
    </div>
  );
}
